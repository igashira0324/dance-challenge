import { useEffect, useRef, useState } from 'react';
import { VRM } from '@pixiv/three-vrm';
import { Pose, Face, Hand } from 'kalidokit';
import { poseService } from '../services/poseService';
import { vrmService } from '../services/vrmService';

interface Props {
  vrm: VRM | null;
  onExit: () => void;
}

const MocapTest = ({ vrm, onExit }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const [status, setStatus] = useState('Initializing...');
  const [detected, setDetected] = useState(false);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let alive = true;
    let frameCount = 0;
    let lastFpsT = performance.now();

    (async () => {
      try {
        setStatus('Loading MediaPipe model...');
        await poseService.init();          
        setStatus('Starting camera...');
        if (!videoRef.current) return;
        await poseService.startCamera(videoRef.current);
        setStatus('Running');
      } catch (e: any) {
        setStatus('ERROR: ' + (e?.message || e));
        return;
      }

      const loop = (t: number) => {
        if (!alive) return;
        rafRef.current = requestAnimationFrame(loop);
        
        // FPS calculation moved here
        frameCount++;
        const now = performance.now();
        if (now - lastFpsT > 500) {
          setFps(Math.round((frameCount * 1000) / (now - lastFpsT)));
          frameCount = 0;
          lastFpsT = now;
        }

        const v = videoRef.current;
        if (!v || v.readyState < 2) return;

        const result = poseService.detect(v, t);
        if (!result || !result.landmarks?.[0] || !result.worldLandmarks?.[0]) {
          setDetected(false);
          if (vrm && vrm.humanoid) {
            vrm.humanoid.resetNormalizedPose();
          }
          // Do not return here, we want the loop to continue
        } else {
          setDetected(true);

          const landmarks = result.landmarks[0];
          const worldLandmarks = result.worldLandmarks[0];

          // ====== ① 2D ランドマーク描画（詳細版） ======
          const canvas = overlayRef.current;
          if (canvas) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Pose (Green)
            ctx.fillStyle = '#00ff66';
            ctx.strokeStyle = '#00ff66';
            ctx.lineWidth = 2;
            for (const lm of landmarks) {
              ctx.beginPath(); ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 3, 0, Math.PI * 2); ctx.fill();
            }
            const conns: [number, number][] = [[11,13],[13,15],[12,14],[14,16],[11,12],[23,24],[11,23],[12,24]];
            for (const [a, b] of conns) {
              ctx.beginPath(); ctx.moveTo(landmarks[a].x * canvas.width, landmarks[a].y * canvas.height);
              ctx.lineTo(landmarks[b].x * canvas.width, landmarks[b].y * canvas.height); ctx.stroke();
            }

            // Face (Cyan) - Only subset for performance
            const faceResult = poseService.detectFace(v, t);
            if (faceResult && faceResult.faceLandmarks?.[0]) {
              ctx.fillStyle = '#00ffff';
              for (let i = 0; i < faceResult.faceLandmarks[0].length; i += 5) {
                const lm = faceResult.faceLandmarks[0][i];
                ctx.beginPath(); ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 1, 0, Math.PI * 2); ctx.fill();
              }
              const solvedFace = (Face as any).solve(faceResult.faceLandmarks[0], { runtime: 'mediapipe', video: v });
              if (solvedFace && vrm) vrmService.applyFace(vrm, solvedFace);
            }

            // Hands (Yellow/Pink)
            const handResult = poseService.detectHands(v, t);
            if (handResult && handResult.landmarks) {
              const hands: { left: any, right: any } = { left: null, right: null };
              handResult.landmarks.forEach((handLM, idx) => {
                const isLeft = handResult.handedness[idx][0].categoryName === 'Left';
                ctx.fillStyle = isLeft ? '#ff00ff' : '#ffff00';
                ctx.strokeStyle = ctx.fillStyle;
                handLM.forEach(lm => {
                  ctx.beginPath(); ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 2, 0, Math.PI * 2); ctx.fill();
                });
                const solvedHand = (Hand as any).solve(handLM, isLeft ? 'Left' : 'Right');
                if (isLeft) hands.left = solvedHand; else hands.right = solvedHand;
              });
              if (vrm) vrmService.applyHands(vrm, hands);
            }

            // ====== ② Kalidokit で VRM を駆動 (Pose) ======
            if (vrm) {
              const poseResult = (Pose as any).solve(worldLandmarks, landmarks, { runtime: 'mediapipe', video: v });
              if (poseResult) vrmService.applyPose(vrm, poseResult, 0.5);
            }
          }
        }

        // Always render VRM
        if (vrm) {
          const isVrm0 = vrm.meta?.metaVersion === '0';
          const baseRotY = isVrm0 ? Math.PI : 0;
          vrm.scene.rotation.y = baseRotY;

          const now = performance.now();
          const dt = lastTsRef.current ? (now - lastTsRef.current) / 1000 : 0.016;
          lastTsRef.current = now;
          vrmService.update(vrm, dt);
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    })();

    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (videoRef.current) poseService.stopCamera(videoRef.current);
    };
  }, [vrm]);

  return (
    <div className="absolute inset-0 z-50 pointer-events-none">
      {/* Top Left: Status */}
      <div className="absolute top-4 left-4 text-white font-mono text-[10px] bg-black/60 px-4 py-2 rounded-lg border border-white/10 pointer-events-auto">
        <div className="text-cyan-400 font-bold mb-1 border-b border-cyan-400/30 pb-1">🔬 MOCAP DEBUG</div>
        <div>Status: <span className={status.startsWith('ERROR') ? 'text-rose-400' : 'text-cyan-300'}>{status}</span></div>
        <div>Pose: <span className={detected ? 'text-emerald-400' : 'text-rose-400'}>{detected ? 'DETECTED' : 'NOT FOUND'}</span></div>
        <div>FPS: {fps}</div>
      </div>

      <button
        onClick={onExit}
        className="absolute top-4 right-4 px-6 py-2 bg-white/90 hover:bg-white text-black font-black text-xs rounded-full border border-white shadow-xl pointer-events-auto transition-all active:scale-95"
      >
        ← EXIT TEST
      </button>

      {/* Bottom Left: Camera PiP */}
      <div className="absolute bottom-6 left-6 w-[320px] h-[240px] border-2 border-cyan-500/50 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.3)] pointer-events-auto bg-black">
        <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" muted playsInline />
        <canvas ref={overlayRef} className="absolute inset-0 w-full h-full scale-x-[-1] pointer-events-none" />
        <div className="absolute top-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[8px] text-cyan-300 uppercase tracking-widest font-bold">
          Camera / Overlay
        </div>
      </div>

      {/* Bottom Center: Guidance (Minimal) */}
      <div className="absolute bottom-6 left-[350px] right-6 flex items-center">
        <p className="text-white/80 text-[11px] bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-2xl">
          <span className="text-cyan-300 font-bold">SIDE-BY-SIDE:</span> 左下の骨格オーバーレイと、中央のアバターの動きを比較してください。
        </p>
      </div>
    </div>
  );
};

export default MocapTest;
