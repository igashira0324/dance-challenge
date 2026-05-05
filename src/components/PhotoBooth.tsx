import { useEffect, useRef, useState, useCallback } from 'react';
import { VRM } from '@pixiv/three-vrm';
import { Pose, Hand } from 'kalidokit';
import { poseService } from '../services/poseService';
import { vrmService } from '../services/vrmService';
import { Camera, Download, RefreshCw, X, Move, RotateCw, Maximize, ChevronDown, User, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeCanvas } from './QRCodeCanvas';
import ModelSelector from './ModelSelector';
import { BUILTIN_MODELS } from '../constants/models';
import type { BuiltinModel } from '../constants/models';
import { uploadService } from '../services/uploadService';

// --- Constants & Utilities ---

const MIKU_COLOR = '#39C5BB';

const DECORATION_ASSETS_MOJI = [
  'deco_moji_01.png', 'deco_moji_02.png', 'deco_moji_03.png', 'deco_moji_04.png', 'deco_moji_05.png'
];

const DECORATION_ASSETS_CHIBI = [
  'chibi_01.png', 'chibi_02.png', 'chibi_03.png', 'chibi_04.png', 'chibi_05.png',
  'chibi_06.png', 'chibi_07.png', 'chibi_08.png', 'chibi_09.png', 'chibi_10.png'
];

const pickRandom = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });

interface Props {
  vrm: VRM | null;
  selectedModelId: string;
  onExit: () => void;
  onVrmChange: (model: BuiltinModel) => Promise<void>;
}

const PhotoBooth = ({ vrm, selectedModelId, onExit, onVrmChange }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('Initializing...');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isFlash, setIsFlash] = useState(false);
  const [showModelPanel, setShowModelPanel] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const lastPoseRef = useRef<any>(null);
  const idlePoseAppliedRef = useRef(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isDecorating, setIsDecorating] = useState(false);

  // Use Ref for transformation to avoid re-triggering the useEffect
  const transformRef = useRef({
    x: -0.5,
    y: 0,
    z: 0,
    rotX: 0,   // vertical (X-axis) rotation
    rotY: 0,   // horizontal (Y-axis) rotation
    scale: 1.0
  });

  const currentModel = BUILTIN_MODELS.find(m => m.id === selectedModelId);
  const [isCameraReady, setIsCameraReady] = useState(false);

  // --- Camera Init Effect ---
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setStatus('Initializing Camera...');
        await poseService.init();
        if (!videoRef.current) return;
        await poseService.startCamera(videoRef.current);
        if (alive) {
          setIsCameraReady(true);
          setStatus('Ready');
        }
      } catch (e: any) {
        if (alive) setStatus('ERROR: ' + (e?.message || e));
      }
    })();
    return () => {
      alive = false;
      if (videoRef.current) poseService.stopCamera(videoRef.current);
    };
  }, []);

  // --- Render Loop Effect ---
  useEffect(() => {
    let alive = true;
    if (!isCameraReady) return;

    lastPoseRef.current = null;
    idlePoseAppliedRef.current = false;

    if (vrm && currentModel?.photoBoothIdlePose) {
      vrmService.applyCorrectionPose(vrm, currentModel.photoBoothIdlePose, true);
      idlePoseAppliedRef.current = true;
    } else if (vrm) {
      vrmService.resetToCorrectedPose(vrm);
    }

    const baseScale = vrm ? vrm.scene.scale.x : 1.0;
    let lastFaceFrame = 0;
    let lastHandFrame = 0;
    const FACE_INTERVAL = 1000 / 15;
    const HAND_INTERVAL = 1000 / 20;

    const loop = (t: number) => {
      if (!alive) return;
      rafRef.current = requestAnimationFrame(loop);

      const v = videoRef.current;
      if (!v || v.readyState < 2) return;

      const result = poseService.detect(v, t);
      if (result && result.landmarks?.[0] && result.worldLandmarks?.[0]) {
        const landmarks = result.landmarks[0];
        const worldLandmarks = result.worldLandmarks[0];

        if (vrm) {
          const now = performance.now();
          if (now - lastFaceFrame > FACE_INTERVAL) {
            lastFaceFrame = now;
            const faceResult = poseService.detectFace(v, t);
            if (faceResult?.faceBlendshapes?.[0]?.categories) {
              vrmService.applyFaceFromBlendshapes(vrm, faceResult.faceBlendshapes[0].categories);
            }
          }

          if (now - lastHandFrame > HAND_INTERVAL) {
            lastHandFrame = now;
            const handResult = poseService.detectHands(v, t);
            if (handResult && handResult.landmarks) {
              const hands: { left: any, right: any } = { left: null, right: null };
              handResult.landmarks.forEach((handLM, idx) => {
                const isLeft = handResult.handedness[idx][0].categoryName === 'Left';
                const solvedHand = (Hand as any).solve(handLM, isLeft ? 'Left' : 'Right');
                if (isLeft) hands.left = solvedHand; else hands.right = solvedHand;
              });
              vrmService.applyHands(vrm, hands);
            }
          }

          const enableBodyTracking = currentModel?.enablePhotoBoothBodyTracking !== false;
          if (enableBodyTracking) {
            const poseResult = (Pose as any).solve(worldLandmarks, landmarks, { runtime: 'mediapipe', video: v });
            if (poseResult) {
              lastPoseRef.current = poseResult;
              vrmService.applyPose(vrm, poseResult, 0.5);
              idlePoseAppliedRef.current = false;
            } else if (lastPoseRef.current) {
              vrmService.applyPose(vrm, lastPoseRef.current, 0.05);
            }
          } else {
            if (vrm && currentModel?.photoBoothIdlePose && !idlePoseAppliedRef.current) {
              vrmService.applyCorrectionPose(vrm, currentModel.photoBoothIdlePose, true);
              idlePoseAppliedRef.current = true;
            }
          }
        }
      } else {
        if (vrm && vrm.humanoid) {
          lastPoseRef.current = null;
          if (currentModel?.photoBoothIdlePose) {
            vrmService.applyCorrectionPose(vrm, currentModel.photoBoothIdlePose, true);
            idlePoseAppliedRef.current = true;
          } else {
            vrmService.resetToCorrectedPose(vrm);
          }
        }
      }

      if (vrm) {
        const tf = transformRef.current;
        const isVrm0 = vrm.meta?.metaVersion === '0';
        const baseRotY = isVrm0 ? Math.PI : 0;

        vrm.scene.position.set(tf.x, tf.y, tf.z);
        vrm.scene.rotation.x = tf.rotX;
        vrm.scene.rotation.y = baseRotY + tf.rotY;
        vrm.scene.scale.setScalar(baseScale * tf.scale);

        const now = performance.now();
        const dt = lastTsRef.current ? (now - lastTsRef.current) / 1000 : 0.016;
        lastTsRef.current = now;
        vrmService.update(vrm, dt);
      }
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (vrm) {
        const isVrm0 = vrm.meta?.metaVersion === '0';
        vrm.scene.position.set(0, 0, 0);
        vrm.scene.rotation.set(0, isVrm0 ? Math.PI : 0, 0);
        vrm.scene.scale.set(baseScale, baseScale, baseScale);
      }
    };
  }, [vrm, isCameraReady, selectedModelId, currentModel]);

  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    if (e.shiftKey) {
      transformRef.current.rotY += dx * 0.01;
    } else if (e.ctrlKey) {
      transformRef.current.rotX += dy * 0.01;
    } else {
      transformRef.current.x += dx * 0.005;
      transformRef.current.y -= dy * 0.005;
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    setIsDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    transformRef.current.scale = Math.max(0.1, Math.min(3.0, transformRef.current.scale + delta));
  }, []);

  const handleSelectBuiltin = async (model: BuiltinModel) => {
    setIsLoadingModel(true);
    setModelError(null);
    setShowModelPanel(false);
    try {
      await onVrmChange(model);
    } catch (e) {
      console.warn('Model load failed', e);
      setModelError('モデルの読み込みに失敗しました');
    } finally {
      setIsLoadingModel(false);
    }
  };

  const handleCustomVRM = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const customModel: BuiltinModel = {
      id: file.name,
      label: file.name,
      url,
      author: 'Custom',
    };

    setIsLoadingModel(true);
    setModelError(null);
    setShowModelPanel(false);
    try {
      await onVrmChange(customModel);
    } catch (e) {
      console.warn('Custom model load failed', e);
      setModelError('カスタムVRMの読み込みに失敗しました');
    } finally {
      URL.revokeObjectURL(url);
      setIsLoadingModel(false);
    }
  };

  const startCapture = () => {
    if (countdown !== null) return;
    setCountdown(3);
  };

  const handleShare = async () => {
    if (!capturedImage) return;
    setIsSharing(true);
    setShareError(null);
    try {
      const url = await uploadService.uploadImage(capturedImage);
      setShareUrl(url);
    } catch (e) {
      console.error('Share failed', e);
      setShareError('写真のアップロードに失敗しました。外部通信またはuguu.seへの接続を確認してください。');
    } finally {
      setIsSharing(false);
    }
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setIsFlash(true);
      setTimeout(() => setIsFlash(false), 150);
      setTimeout(capturePhoto, 50);
      setCountdown(null);
    }
  }, [countdown]);

  const drawStylizedText = (ctx: CanvasRenderingContext2D, w: number, h: number, modelId: string) => {
    ctx.save();
    const fontScale = w / 1280;
    const x = 60 * fontScale;
    const y = 120 * fontScale;
    const title = 'HATSUNE MIKU';
    
    ctx.font = `black ${90 * fontScale}px "Outfit", sans-serif`;
    ctx.letterSpacing = "2px";
    ctx.shadowBlur = 30 * fontScale;
    ctx.shadowColor = MIKU_COLOR;
    ctx.fillStyle = MIKU_COLOR;
    ctx.fillText(title, x, y);
    
    ctx.shadowBlur = 15 * fontScale;
    ctx.shadowColor = 'white';
    ctx.fillText(title, x, y);
    
    const grad = ctx.createLinearGradient(x, y - 60 * fontScale, x, y);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, MIKU_COLOR);
    
    ctx.fillStyle = grad;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 4 * fontScale;
    ctx.strokeText(title, x, y);
    ctx.fillText(title, x, y);

    ctx.font = `${40 * fontScale}px "Outfit", sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.shadowColor = MIKU_COLOR;
    ctx.shadowBlur = 15 * fontScale;
    ctx.fillText('♪', x + 340 * fontScale, y - 30 * fontScale);
    ctx.fillText('♫', x + 380 * fontScale, y - 55 * fontScale);

    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    const eventName = 'なんでも生成AI展示会 Vol.5';

    ctx.font = `bold ${24 * fontScale}px "Noto Sans JP", sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowColor = MIKU_COLOR;
    ctx.shadowBlur = 10 * fontScale;
    ctx.textAlign = 'right';
    ctx.fillText(eventName, w - 40 * fontScale, h - 70 * fontScale);

    ctx.font = `bold ${20 * fontScale}px "Outfit", monospace`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 8 * fontScale;
    ctx.fillText(dateStr, w - 40 * fontScale, h - 40 * fontScale);

    const selectedBuiltin = BUILTIN_MODELS.find(m => m.id === modelId);
    const creditText = selectedBuiltin?.author && selectedBuiltin.author !== 'Unknown' 
      ? `Model Author: ${selectedBuiltin.author}` 
      : `Model: Custom VRM`;

    ctx.textAlign = 'left';
    ctx.font = `bold ${16 * fontScale}px "Outfit", "Noto Sans JP", sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4 * fontScale;
    ctx.fillText(creditText, 30 * fontScale, h - 30 * fontScale);
    ctx.restore();
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    const finalizePhoto = async () => {
      setIsDecorating(true);
      try {
        const randomMoji = pickRandom(DECORATION_ASSETS_MOJI);
        const randomChibi = pickRandom(DECORATION_ASSETS_CHIBI);

        const [imgMoji, imgChibi] = await Promise.all([
          loadImage(`/photo/${randomMoji}`),
          loadImage(`/photo/${randomChibi}`)
        ]);

        const mojiSize = tempCanvas.height * 0.3;
        ctx.drawImage(imgMoji, 20, 5, mojiSize, mojiSize);

        const chibiSize = tempCanvas.height * 0.35;
        ctx.drawImage(imgChibi, tempCanvas.width - chibiSize - 20, 20, chibiSize, chibiSize);
      } catch (e) {
        console.warn('Failed to load decorations', e);
      }

      const cLen = 60;
      const pad = 12;
      ctx.strokeStyle = MIKU_COLOR;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pad, pad + cLen); ctx.lineTo(pad, pad); ctx.lineTo(pad + cLen, pad); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tempCanvas.width - pad - cLen, pad); ctx.lineTo(tempCanvas.width - pad, pad); ctx.lineTo(tempCanvas.width - pad, pad + cLen); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad, tempCanvas.height - pad - cLen); ctx.lineTo(pad, tempCanvas.height - pad); ctx.lineTo(pad + cLen, tempCanvas.height - pad); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tempCanvas.width - pad - cLen, tempCanvas.height - pad); ctx.lineTo(tempCanvas.width - pad, tempCanvas.height - pad); ctx.lineTo(tempCanvas.width - pad, tempCanvas.height - pad - cLen); ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(pad + 2, pad + 2, tempCanvas.width - (pad + 2) * 2, tempCanvas.height - (pad + 2) * 2);

      drawStylizedText(ctx, tempCanvas.width, tempCanvas.height, selectedModelId);
      setCapturedImage(tempCanvas.toDataURL('image/png'));
      setIsDecorating(false);
    };

    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-tempCanvas.width, 0);
    ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    ctx.restore();

    const vrmDataUrl = vrmService.takeScreenshot();
    if (vrmDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
        finalizePhoto();
      };
      img.src = vrmDataUrl;
    } else {
      finalizePhoto();
    }
  };

  const downloadPhoto = () => {
    if (!capturedImage) return;
    const link = document.createElement('a');
    link.download = `photo_${Date.now()}.png`;
    link.href = capturedImage;
    link.click();
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1] z-0" muted playsInline />
      <div
        className={`absolute inset-0 z-[60] ${countdown !== null ? 'pointer-events-none' : ''}`}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
      />

      <AnimatePresence>
        {isFlash && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-white z-[200]" />}
      </AnimatePresence>

      <div className="absolute inset-0 z-[100] pointer-events-none flex flex-col justify-between p-8">
        <div className="flex justify-between items-start pointer-events-auto">
          <div className="bg-black/70 backdrop-blur-xl p-5 rounded-3xl border border-white/10 text-white shadow-2xl">
            <h2 className="text-2xl font-black flex items-center gap-3 tracking-tighter">
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: MIKU_COLOR }} />
              PHOTO BOOTH
            </h2>
            <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em] mt-1 font-bold">初音ミクとプリクラ風記念撮影</p>
            <p className={`text-[9px] mt-3 font-mono px-2 py-1 rounded bg-black/40 ${status.startsWith('ERROR') ? 'text-rose-400' : 'text-cyan-400'}`}>
              STATUS: {status}
            </p>
            <div className="flex flex-col gap-2 mt-4 text-[11px] font-mono opacity-80">
              <div className="flex items-center gap-2"><Move size={12} /> Drag: 位置移動</div>
              <div className="flex items-center gap-2"><RotateCw size={12} /> Shift+Drag: 左右回転</div>
              <div className="flex items-center gap-2"><RotateCw size={12} /> Ctrl+Drag: 上下回転</div>
              <div className="flex items-center gap-2"><Maximize size={12} /> Wheel: 拡大・縮小</div>
            </div>
            
            <div className="mt-4 border-t border-white/10 pt-4">
              <button onClick={() => setShowModelPanel(p => !p)} className="w-full flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest text-cyan-300 hover:text-white transition-colors">
                <span className="flex items-center gap-1"><User size={10} /> MODEL SELECT</span>
                <ChevronDown size={10} className={`transition-transform ${showModelPanel ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showModelPanel && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-3">
                    <ModelSelector selectedModelId={selectedModelId} isLoading={isLoadingModel} onSelect={handleSelectBuiltin} onUploadClick={() => fileInputRef.current?.click()} />
                    <input ref={fileInputRef} type="file" accept=".vrm" className="hidden" onChange={handleCustomVRM} />
                  </motion.div>
                )}
              </AnimatePresence>
              {isLoadingModel && <p className="text-[9px] text-cyan-400 animate-pulse mt-2 flex items-center gap-2"><RefreshCw size={10} className="animate-spin" /> Loading model...</p>}
              {modelError && <p className="text-[9px] text-rose-400 mt-2 flex items-center gap-1 font-bold">⚠️ {modelError}</p>}
            </div>
          </div>

          <button onClick={onExit} className="w-14 h-14 bg-black/70 backdrop-blur-xl rounded-full flex items-center justify-center text-white border border-white/10 hover:bg-rose-500 transition-all active:scale-90 shadow-2xl">
            <X size={28} />
          </button>
        </div>

        {countdown !== null && (
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1.5, opacity: 1 }} className="text-[240px] font-black text-white self-center select-none bg-black/30 backdrop-blur-sm rounded-[3rem] px-16 py-8" style={{ textShadow: `0 0 40px ${MIKU_COLOR}, 0 0 80px rgba(0,0,0,0.8), 0 0 10px rgba(255,255,255,0.5)` }}>
            {countdown === 0 ? 'SHOT!' : countdown}
          </motion.div>
        )}

        <div className="flex flex-col items-center justify-center pointer-events-auto pb-12 gap-6">
          {!capturedImage ? (
            <button onClick={startCapture} disabled={countdown !== null} className="group relative px-16 py-8 bg-white text-black font-black text-3xl rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_60px_rgba(57,197,187,0.4)] disabled:opacity-30 disabled:grayscale disabled:scale-100">
              <div className="absolute inset-0 transition-opacity opacity-0 group-hover:opacity-100" style={{ background: `linear-gradient(45deg, ${MIKU_COLOR}, #ffffff)` }} />
              <span className="relative z-10 flex items-center gap-4 group-hover:text-cyan-900"><Camera size={40} /> TAKE PHOTO</span>
            </button>
          ) : (
            <div className="flex gap-6">
              <button onClick={() => { setCapturedImage(null); setShareUrl(null); }} className="px-10 py-5 bg-white/10 backdrop-blur-2xl text-white font-bold rounded-3xl border border-white/20 flex items-center gap-3 hover:bg-white/20 transition-all shadow-2xl">
                <RefreshCw size={24} /> RETAKE
              </button>
              <button onClick={downloadPhoto} className="px-16 py-5 text-white font-black text-2xl rounded-3xl flex items-center gap-4 transition-all shadow-[0_0_40px_rgba(57,197,187,0.6)] hover:brightness-110 active:scale-95" style={{ backgroundColor: MIKU_COLOR }}>
                <Download size={32} /> SAVE PHOTO
              </button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isDecorating && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[180] bg-black/60 backdrop-blur-sm flex items-center justify-center text-white text-4xl font-black italic tracking-widest">
            デコ中...
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {capturedImage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[120] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-8">
            <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} className="relative max-w-5xl w-full bg-neutral-900 p-3 rounded-[2rem] shadow-[0_0_100px_rgba(57,197,187,0.3)] border border-white/5">
              <img src={capturedImage} alt="Captured" className="w-full h-auto rounded-2xl" />
              <button onClick={() => { setCapturedImage(null); setShareUrl(null); }} className="absolute -top-6 -right-6 w-16 h-16 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-2xl border-4 border-neutral-900 transition-transform hover:rotate-90 active:scale-90"><X size={32} /></button>
            </motion.div>
            <div className="mt-12 flex gap-8 pointer-events-auto">
              <button onClick={() => { setCapturedImage(null); setShareUrl(null); }} className="px-12 py-5 bg-white/10 backdrop-blur-2xl text-white font-bold text-xl rounded-2xl border border-white/20 flex items-center gap-3 hover:bg-white/20 transition-all shadow-2xl"><RefreshCw size={24} /> RETAKE</button>
              <button onClick={handleShare} disabled={isSharing} className={`px-12 py-5 bg-white/10 backdrop-blur-2xl text-white font-bold text-xl rounded-2xl border border-white/20 flex items-center gap-3 hover:bg-white/20 transition-all shadow-2xl ${isSharing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {isSharing ? <RefreshCw size={24} className="animate-spin" /> : <Share2 size={24} />}
                <span>QR SHARE</span>
              </button>
              <button onClick={downloadPhoto} className="px-20 py-5 text-white font-black text-2xl rounded-2xl flex items-center gap-4 transition-all shadow-2xl" style={{ backgroundColor: MIKU_COLOR }}><Download size={32} /> DOWNLOAD NOW</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shareUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 pointer-events-auto" onClick={() => setShareUrl(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-gray-900 border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center relative" onClick={e => e.stopPropagation()}>
              <button onClick={() => setShareUrl(null)} className="absolute top-4 right-4 text-white/50 hover:text-white"><X className="w-6 h-6" /></button>
              <h3 className="text-2xl font-bold text-white mb-2">QR SHARE</h3>
              <p className="text-white/60 mb-6 text-sm">スマホで読み取ると写真をダウンロードできます。<br />画像は一時保存され、一定時間後に自動削除されます。</p>
              <div className="p-1.5 rounded-[2.8rem] inline-block mb-6 shadow-2xl relative overflow-hidden bg-gradient-to-br from-[#39C5BB] via-[#FF007F] to-[#00A39C]">
                <div className="bg-white p-6 rounded-[2.5rem] relative z-10">
                  <QRCodeCanvas value={shareUrl} size={260} level="H" includeMargin={true} bgColor="#FFFFFF" fgColor="#111111" imageSettings={{ src: '/Chibi-style_Hatsune_Miku_adorable_icon_illustratio-1777978579165.png', width: 52, height: 52, excavate: true }} />
                  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.5rem]">
                    <div className="w-full h-1.5 bg-cyan-400/30 absolute top-0 animate-[scan_3s_linear_infinite]" />
                  </div>
                </div>
              </div>
              <div className="text-white/40 text-xs mt-2 break-all px-4">{shareUrl}</div>
              <p className="text-white/30 text-[10px] mt-4 uppercase tracking-widest">Temporary public share / Expires automatically</p>
              {shareError && <p className="mt-4 text-sm text-rose-400 font-bold">{shareError}</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PhotoBooth;
