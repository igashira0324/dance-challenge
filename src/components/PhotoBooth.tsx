import { useEffect, useRef, useState } from 'react';
import { VRM } from '@pixiv/three-vrm';
import { Pose, Face, Hand } from 'kalidokit';
import { poseService } from '../services/poseService';
import { vrmService } from '../services/vrmService';
import { Camera, Download, RefreshCw, X, Camera as CameraIcon } from 'lucide-react';
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

  useEffect(() => {
    let alive = true;
    
    // Initial position for photo: shift VRM to the right slightly so user can stand on the left
    vrmService.setPosition(-0.6, 0, 0);

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
      // Reset position when leaving
      vrmService.setPosition(0, 0, 0);
    };
  }, [vrm]);

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
      // Flash and Capture!
      setIsFlash(true);
      setTimeout(() => setIsFlash(false), 150);
      
      // We need to capture both the video (background) and the VRM canvas
      // This is tricky because they are separate elements.
      // We'll create a temporary canvas to merge them.
      capturePhoto();
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
    // We assume the 3D canvas is the one from App.tsx. 
    // We can find it via selector since it's a demo.
    const vrmCanvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (vrmCanvas) {
      // We need to scale the VRM canvas to match the photo aspect ratio if needed,
      // but usually we just draw it over.
      ctx.drawImage(vrmCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
    }

    // 3. Add decorative frame (Purikura style)
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 20;
    ctx.strokeRect(10, 10, tempCanvas.width - 20, tempCanvas.height - 20);
    
    ctx.fillStyle = '#ff00ff';
    ctx.font = 'bold 40px Arial';
    ctx.fillText('MEMORY WITH MIKU', 50, tempCanvas.height - 50);

    setCapturedImage(tempCanvas.toDataURL('image/png'));
  };

  const downloadPhoto = () => {
    if (!capturedImage) return;
    const link = document.createElement('a');
    link.download = `photo-with-miku-${Date.now()}.png`;
    link.href = capturedImage;
    link.click();
  };

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center overflow-hidden">
      {/* Full Screen Camera Background */}
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
            className="absolute inset-0 bg-white z-[110]"
          />
        )}
      </AnimatePresence>

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-8">
        <div className="flex justify-between items-start pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-white font-bold">
            <h2 className="text-xl flex items-center gap-2">
              <CameraIcon className="text-fuchsia-400" /> PHOTO BOOTH
            </h2>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Stand next to the avatar and strike a pose!</p>
            <p className={`text-[9px] mt-2 font-mono ${status.startsWith('ERROR') ? 'text-rose-400' : 'text-cyan-400'}`}>
              SYSTEM: {status}
            </p>
          </div>
          
          <button 
            onClick={onExit}
            className="w-12 h-12 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10 hover:bg-rose-500/80 transition-colors"
          >
            <X />
          </button>
        </div>

        {countdown !== null && (
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            className="text-[200px] font-black text-white drop-shadow-[0_0_50px_rgba(255,0,255,0.8)] self-center"
          >
            {countdown === 0 ? 'CHEESE!' : countdown}
          </motion.div>
        )}

        <div className="flex justify-center pointer-events-auto pb-8">
          {!capturedImage ? (
            <button 
              onClick={startCapture}
              className="group relative px-12 py-6 bg-white text-black font-black text-2xl rounded-full overflow-hidden transition-all hover:scale-110 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.5)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500 to-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative z-10 flex items-center gap-3 group-hover:text-white">
                <Camera size={32} /> TAKE PHOTO
              </span>
            </button>
          ) : (
            <div className="flex gap-4">
              <button 
                onClick={() => setCapturedImage(null)}
                className="px-8 py-4 bg-white/20 backdrop-blur-md text-white font-bold rounded-2xl border border-white/20 flex items-center gap-2 hover:bg-white/30 transition-all"
              >
                <RefreshCw size={20} /> RETAKE
              </button>
              <button 
                onClick={downloadPhoto}
                className="px-12 py-4 bg-fuchsia-500 text-white font-black text-xl rounded-2xl border border-fuchsia-400 flex items-center gap-3 hover:bg-fuchsia-400 transition-all shadow-[0_0_30px_rgba(217,70,239,0.5)]"
              >
                <Download size={24} /> SAVE PHOTO
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Captured Image Preview */}
      <AnimatePresence>
        {capturedImage && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 z-[120] bg-black/90 flex items-center justify-center p-12"
          >
            <div className="relative max-w-4xl w-full bg-white p-2 rounded-lg shadow-2xl">
              <img src={capturedImage} alt="Captured" className="w-full h-auto rounded" />
              <button 
                onClick={() => setCapturedImage(null)}
                className="absolute -top-6 -right-6 w-12 h-12 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-xl border-4 border-white"
              >
                <X />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PhotoBooth;
