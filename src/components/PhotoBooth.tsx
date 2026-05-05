import { useEffect, useRef, useState, useCallback } from 'react';
import { VRM } from '@pixiv/three-vrm';
import { Pose, Face, Hand } from 'kalidokit';
import { poseService } from '../services/poseService';
import { vrmService } from '../services/vrmService';
import { Camera, Download, RefreshCw, X, Move, RotateCw, Maximize } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  vrm: VRM | null;
  onExit: () => void;
}

const PhotoBooth = ({ vrm, onExit }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState('Initializing...');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isFlash, setIsFlash] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);

  // Miku Teal color
  const MIKU_COLOR = '#39C5BB';

  // Avatar transformation state
  const [transform, setTransform] = useState({
    x: -0.5,
    y: 0,
    z: 0,
    rotationY: 0,
    scale: 1.0
  });

  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let alive = true;
    
    (async () => {
      try {
        setStatus('Starting camera...');
        if (!videoRef.current) return;
        await poseService.startCamera(videoRef.current);
        setStatus('Ready');
      } catch (e: any) {
        setStatus('ERROR: ' + (e?.message || e));
        return;
      }

      const loop = (t: number) => {
        if (!alive) return;
        rafRef.current = requestAnimationFrame(loop);

        const v = videoRef.current;
        if (!v || v.readyState < 2) return;

        const result = poseService.detect(v, t);
        if (result && result.landmarks?.[0] && result.worldLandmarks?.[0]) {
          const landmarks = result.landmarks[0];
          const worldLandmarks = result.worldLandmarks[0];

          // Face
          const faceResult = poseService.detectFace(v, t);
          if (faceResult && faceResult.faceLandmarks?.[0]) {
            const solvedFace = (Face as any).solve(faceResult.faceLandmarks[0], { runtime: 'mediapipe', video: v });
            if (solvedFace && vrm) vrmService.applyFace(vrm, solvedFace);
          }

          // Hands
          const handResult = poseService.detectHands(v, t);
          if (handResult && handResult.landmarks) {
            const hands: { left: any, right: any } = { left: null, right: null };
            handResult.landmarks.forEach((handLM, idx) => {
              const isLeft = handResult.handedness[idx][0].categoryName === 'Left';
              const solvedHand = (Hand as any).solve(handLM, isLeft ? 'Left' : 'Right');
              if (isLeft) hands.left = solvedHand; else hands.right = solvedHand;
            });
            if (vrm) vrmService.applyHands(vrm, hands);
          }

          // Pose
          if (vrm) {
            const poseResult = (Pose as any).solve(worldLandmarks, landmarks, { runtime: 'mediapipe', video: v });
            if (poseResult) vrmService.applyPose(vrm, poseResult, 0.5);
            
            // Apply mouse-driven transformations
            vrm.scene.position.set(transform.x, transform.y, transform.z);
            vrm.scene.rotation.y = Math.PI + transform.rotationY; // Base rotation + user adjustment
            vrm.scene.scale.set(transform.scale, transform.scale, transform.scale);

            const now = performance.now();
            const dt = lastTsRef.current ? (now - lastTsRef.current) / 1000 : 0.016;
            lastTsRef.current = now;
            vrmService.update(vrm, dt);
          }
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    })();

    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (videoRef.current) poseService.stopCamera(videoRef.current);
      vrmService.setPosition(0, 0, 0);
      if (vrm) vrm.scene.scale.set(1, 1, 1);
    };
  }, [vrm, transform]);

  // Mouse transformation handlers
  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    if (e.shiftKey) {
      // Rotation
      setTransform(prev => ({ ...prev, rotationY: prev.rotationY + dx * 0.01 }));
    } else {
      // Position
      setTransform(prev => ({ 
        ...prev, 
        x: prev.x + dx * 0.005,
        y: prev.y - dy * 0.005
      }));
    }
  }, []);

  const onMouseUp = () => {
    isDragging.current = false;
  };

  const onWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY * -0.001;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.1, Math.min(3.0, prev.scale + delta))
    }));
  };

  const startCapture = () => {
    if (countdown !== null) return;
    setCountdown(3);
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

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    // 1. Draw Camera Background (mirrored)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-tempCanvas.width, 0);
    ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    ctx.restore();

    // 2. Draw VRM Canvas
    const vrmCanvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (vrmCanvas) {
      ctx.drawImage(vrmCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
    }

    // 3. Frame
    ctx.strokeStyle = MIKU_COLOR;
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, tempCanvas.width - 16, tempCanvas.height - 16);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, tempCanvas.width - 40, tempCanvas.height - 40);

    // 4. Text with Shadow
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Outfit, Arial';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;
    ctx.fillText('MEMORY WITH MIKU', 60, tempCanvas.height - 70);
    
    setCapturedImage(tempCanvas.toDataURL('image/png'));
  };

  const downloadPhoto = () => {
    if (!capturedImage) return;
    const link = document.createElement('a');
    link.download = `miku-photo-${Date.now()}.png`;
    link.href = capturedImage;
    link.click();
  };

  return (
    <div 
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
    >
      {/* Background Video - z-index 0 to stay behind 3D canvas at z-10 */}
      <video 
        ref={videoRef} 
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1] z-0" 
        muted 
        playsInline 
      />

      {/* Flash Effect */}
      <AnimatePresence>
        {isFlash && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white z-[200]"
          />
        )}
      </AnimatePresence>

      {/* UI Overlay - z-index 100 to stay above everything */}
      <div className="absolute inset-0 z-[100] pointer-events-none flex flex-col justify-between p-8">
        <div className="flex justify-between items-start pointer-events-auto">
          <div className="bg-black/70 backdrop-blur-xl p-5 rounded-3xl border border-white/10 text-white shadow-2xl">
            <h2 className="text-2xl font-black flex items-center gap-3 tracking-tighter">
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: MIKU_COLOR }} />
              PHOTO BOOTH
            </h2>
            <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em] mt-1 font-bold">Adjust Miku with your mouse!</p>
            <p className={`text-[9px] mt-3 font-mono px-2 py-1 rounded bg-black/40 ${status.startsWith('ERROR') ? 'text-rose-400' : 'text-cyan-400'}`}>
              STATUS: {status}
            </p>
            <div className="flex gap-4 mt-4 text-[9px] font-mono opacity-80">
               <div className="flex items-center gap-1"><Move size={10} /> Drag: Move</div>
               <div className="flex items-center gap-1"><RotateCw size={10} /> Shift+Drag: Rotate</div>
               <div className="flex items-center gap-1"><Maximize size={10} /> Wheel: Scale</div>
            </div>
          </div>
          
          <button 
            onClick={onExit}
            className="w-14 h-14 bg-black/70 backdrop-blur-xl rounded-full flex items-center justify-center text-white border border-white/10 hover:bg-rose-500 transition-all active:scale-90 shadow-2xl"
          >
            <X size={28} />
          </button>
        </div>

        {countdown !== null && (
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 1 }}
            className="text-[240px] font-black text-white self-center select-none"
            style={{ textShadow: `0 0 40px ${MIKU_COLOR}, 0 0 80px rgba(0,0,0,0.5)` }}
          >
            {countdown === 0 ? 'SHOT!' : countdown}
          </motion.div>
        )}

        <div className="flex justify-center pointer-events-auto pb-12">
          {!capturedImage ? (
            <button 
              onClick={startCapture}
              className="group relative px-16 py-8 bg-white text-black font-black text-3xl rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_60px_rgba(57,197,187,0.4)]"
            >
              <div className="absolute inset-0 transition-opacity opacity-0 group-hover:opacity-100" style={{ background: `linear-gradient(45deg, ${MIKU_COLOR}, #ffffff)` }} />
              <span className="relative z-10 flex items-center gap-4 group-hover:text-cyan-900">
                <Camera size={40} /> TAKE PHOTO
              </span>
            </button>
          ) : (
            <div className="flex gap-6">
              <button 
                onClick={() => setCapturedImage(null)}
                className="px-10 py-5 bg-white/10 backdrop-blur-2xl text-white font-bold rounded-3xl border border-white/20 flex items-center gap-3 hover:bg-white/20 transition-all shadow-2xl"
              >
                <RefreshCw size={24} /> RETAKE
              </button>
              <button 
                onClick={downloadPhoto}
                className="px-16 py-5 text-white font-black text-2xl rounded-3xl flex items-center gap-4 transition-all shadow-[0_0_40px_rgba(57,197,187,0.6)] hover:brightness-110 active:scale-95"
                style={{ backgroundColor: MIKU_COLOR }}
              >
                <Download size={32} /> SAVE PHOTO
              </button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {capturedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[120] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="relative max-w-5xl w-full bg-neutral-900 p-3 rounded-[2rem] shadow-[0_0_100px_rgba(57,197,187,0.3)] border border-white/5"
            >
              <img src={capturedImage} alt="Captured" className="w-full h-auto rounded-2xl" />
              <button 
                onClick={() => setCapturedImage(null)}
                className="absolute -top-6 -right-6 w-16 h-16 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-2xl border-4 border-neutral-900 transition-transform hover:rotate-90 active:scale-90"
              >
                <X size={32} />
              </button>
            </motion.div>
            <div className="mt-12 flex gap-8 pointer-events-auto">
              <button 
                onClick={downloadPhoto}
                className="px-20 py-5 text-white font-black text-2xl rounded-2xl flex items-center gap-4 transition-all shadow-2xl"
                style={{ backgroundColor: MIKU_COLOR }}
              >
                <Download size={32} /> DOWNLOAD NOW
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PhotoBooth;
