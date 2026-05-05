import { useState, useEffect, useRef, useCallback } from 'react';
import { VRM } from '@pixiv/three-vrm';
import { Pose } from 'kalidokit';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Play } from 'lucide-react';
import confetti from 'canvas-confetti';

import { poseService } from './services/poseService';
import { vrmService } from './services/vrmService';
import { audioEngine } from './services/audioEngine';
import { MarkerTarget, Lyric, DEMO_MARKERS, DEMO_LYRICS } from './constants';

import HUD from './components/HUD';
import KineticTypography from './components/KineticTypography';

import { 
  extractPoseFeatures, 
  calculatePoseSimilarity
} from './utils/poseUtils';

const checkPoseMatch = (
  worldLandmarks: any[], 
  imageLandmarks: any[], 
  target: MarkerTarget,
  videoAspectRatio: number = 1.0
): { result: 'PERFECT' | 'GOOD' | 'MISS', similarity: number } => {
  if (!worldLandmarks || worldLandmarks.length === 0) return { result: 'MISS', similarity: 0 };

  // --- Silhouette Pose Matching (3D Vector Basis) ---
  if (target.type === 'Silhouette') {
    if (!target.targetPoseVectors) return { result: 'MISS', similarity: 0 };
    
    const correctedLandmarks = worldLandmarks.map(lm => ({
      ...lm,
      x: -lm.x 
    }));

    const userFeatures = extractPoseFeatures(correctedLandmarks);
    if (!userFeatures) return { result: 'MISS', similarity: 0 };

    const similarity = calculatePoseSimilarity(userFeatures, target.targetPoseVectors);
    
    // ダンエボ風しきい値調整
    if (similarity > 0.86) return { result: 'PERFECT', similarity }; 
    if (similarity > 0.65) return { result: 'GOOD', similarity };
    return { result: 'MISS', similarity };
  }

  // --- Ripple Hand Matching (2D Screen Basis) ---
  if (target.type === 'Ripple') {
    if (!imageLandmarks || imageLandmarks.length === 0) return { result: 'MISS', similarity: 0 };

    const limbIdx = target.targetLimb === 'rightWrist' ? 16 : 15;
    const hand = imageLandmarks[limbIdx];
    if (!hand) return { result: 'MISS', similarity: 0 };

    // アスペクト比を考慮した距離計算 (Y方向を1.0とした相対距離)
    const dx = ((1.0 - hand.x) - target.x) * videoAspectRatio;
    const dy = (hand.y - target.y);
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // 距離を0-1の「類似度」に変換 (0.3を最大半径とする)
    const similarity = Math.max(0, 1.0 - dist / 0.3);
    
    if (dist < 0.12) return { result: 'PERFECT', similarity };
    if (dist < 0.22) return { result: 'GOOD', similarity };
    return { result: 'MISS', similarity };
  }

  return { result: 'MISS', similarity: 0 }; 
};

const App = () => {
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'RESULT'>('IDLE');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [upcomingMarkers, setUpcomingMarkers] = useState<MarkerTarget[]>([]);
  const [vrm, setVrm] = useState<VRM | null>(null);
  const [lyrics, setLyrics] = useState<Lyric[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [judgment, setJudgment] = useState<{text: string; id: number} | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<number>(null);
  const scoredPosesRef = useRef<Set<string>>(new Set()); // Changed to Set<string> for complex IDs
  const worldLandmarksRef = useRef<any[]>([]);
  const imageLandmarksRef = useRef<any[]>([]);
  const kalidokitPoseRef = useRef<any>(null);
  const comboRef = useRef(0); // Use ref for logic to avoid animate recreate
  const judgmentTimeoutRef = useRef<number | null>(null);
  const bestResultsRef = useRef<Map<string, 'PERFECT' | 'GOOD' | 'MISS'>>(new Map());

  // --- Initial Setup ---
  useEffect(() => {
    if (canvasRef.current) {
      vrmService.init(canvasRef.current);
    }
    poseService.init().catch(console.error);
    
    vrmService.loadVRM('/default.vrm')
      .then(setVrm)
      .catch(err => console.warn("Default VRM load failed, using primitive", err));

    setLyrics(DEMO_LYRICS);

    audioEngine.init();

    return () => {
      audioEngine.stop();
      poseService.stopCamera();
    };
  }, []);

  // --- Debug: Capture Pose ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'c') {
        const worldLandmarks = worldLandmarksRef.current;
        if (!worldLandmarks || worldLandmarks.length === 0) return;

        // Capture時もミラー補正を適用して「標準ポーズ」として保存する
        const corrected = worldLandmarks.map(lm => ({ ...lm, x: -lm.x }));
        const features = extractPoseFeatures(corrected);

        if (features) {
          console.group("📸 Captured Pose Vectors (Metric)");
          console.log("Copy and paste this into constants/index.ts:");
          console.log("targetPoseVectors: " + JSON.stringify(features, (_key, value) => 
            typeof value === 'number' ? parseFloat(value.toFixed(3)) : value, 2));
          
          // 現在の画面上のマーカーと比較して類似度を表示（デバッグ用）
          const musicTime = audioEngine.getCurrentTime();
          const nearestMarker = DEMO_MARKERS.find(m => Math.abs(m.hitTime - musicTime) < 1.5);
          if (nearestMarker?.targetPoseVectors) {
            const sim = calculatePoseSimilarity(features, nearestMarker.targetPoseVectors);
            console.log(`Current Similarity to "${nearestMarker.name}": ${(sim * 100).toFixed(1)}%`);
          }
          
          console.groupEnd();
          alert("Pose Captured! check console (F12) for the code.");
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Core Loop ---
  const updatePose = useCallback((worldLandmarks: any, landmarks: any) => {
    const pose = (Pose as any).solve(worldLandmarks, landmarks, {
      runtime: 'mediapipe',
      video: videoRef.current ? {
        height: videoRef.current.videoHeight,
        width: videoRef.current.videoWidth
      } : undefined
    });

    if (pose) {
      kalidokitPoseRef.current = pose;
      if (vrm) {
        vrmService.applyPose(vrm, pose);
      }
    }
  }, [vrm]);

  const evaluateMarker = useCallback((_target: MarkerTarget, result: 'PERFECT' | 'GOOD' | 'MISS', timingBonus: number = 1.0) => {
    const newJudgment = { 
      text: result === 'PERFECT' ? 'PERFECT!' : result === 'GOOD' ? 'GOOD' : 'MISS', 
      id: Date.now() 
    };
    setJudgment(newJudgment);

    if (result !== 'MISS') {
      // 基本点 (PERFECT: 100, GOOD: 50) + タイミングボーナス (最大20)
      const basePoints = result === 'PERFECT' ? 100 : 50;
      const points = Math.round(basePoints * timingBonus);
      
      setScore(prev => prev + points);
      setCombo(prev => {
        const next = prev + 1;
        comboRef.current = next;
        if (next > 10 && next % 5 === 0) confetti({
          particleCount: 40,
          spread: 70,
          origin: { y: 0.6 }
        });
        return next;
      });
    } else {
      setCombo(0);
      comboRef.current = 0;
    }
    if (judgmentTimeoutRef.current) {
      window.clearTimeout(judgmentTimeoutRef.current);
    }
    judgmentTimeoutRef.current = window.setTimeout(() => setJudgment(null), 1000);
  }, []); // No dependency on combo

  const animate = useCallback((time: number) => {
    if (gameState === 'PLAYING') {
      const musicTime = audioEngine.getCurrentTime();
      setCurrentTime(musicTime);

      // --- 1. マーカー表示管理 ---
      const visibleMarkers = DEMO_MARKERS.filter(m => 
        musicTime >= m.hitTime - 1.2 && musicTime <= m.hitTime + 0.5
      );
      setUpcomingMarkers(visibleMarkers);

      // --- 2. ポーズ検出 ---
      if (videoRef.current) {
        const results = poseService.detect(videoRef.current, time);
        if (results && results.landmarks?.[0] && results.worldLandmarks?.[0]) {
          worldLandmarksRef.current = results.worldLandmarks[0];
          imageLandmarksRef.current = results.landmarks[0];
          updatePose(results.worldLandmarks[0], results.landmarks[0]);
        }
      }

      // --- 3. 判定ロジック ---
      visibleMarkers.forEach(marker => {
        if (scoredPosesRef.current.has(marker.id)) return;

        const timeToHit = marker.hitTime - musicTime;
        const HIT_WINDOW = 0.6; 
        const aspect = videoRef.current ? videoRef.current.videoWidth / videoRef.current.videoHeight : 1.77;

        if (Math.abs(timeToHit) < HIT_WINDOW) {
          const { result } = checkPoseMatch(
            worldLandmarksRef.current, 
            imageLandmarksRef.current, 
            marker,
            aspect
          );

          if (result !== 'MISS') {
            const currentBest = bestResultsRef.current.get(marker.id) || 'MISS';
            
            // PERFECTなら即時確定（最高評価のため）
            if (result === 'PERFECT') {
              const timingFactor = Math.max(0.5, 1.0 - (Math.max(0, Math.abs(timeToHit) - 0.15) / 0.45));
              evaluateMarker(marker, 'PERFECT', timingFactor);
              scoredPosesRef.current.add(marker.id);
              bestResultsRef.current.set(marker.id, 'PERFECT');
            } 
            // GOODなら保持（後でPERFECTになる可能性があるため）
            else if (result === 'GOOD' && currentBest === 'MISS') {
              bestResultsRef.current.set(marker.id, 'GOOD');
            }
          }
        } 
        
        // 判定期間終了（PERFECTを逃した場合の最終評価）
        if (timeToHit < -HIT_WINDOW && !scoredPosesRef.current.has(marker.id)) {
          const finalResult = bestResultsRef.current.get(marker.id) || 'MISS';
          evaluateMarker(marker, finalResult, 0.7); // 窓際評価なのでボーナス低め
          scoredPosesRef.current.add(marker.id);
        }
      });

      // --- 4. シルエットアニメーション ---
      const activeSilhouette = visibleMarkers.find(m => 
        m.type === 'Silhouette' && 
        m.hitTime - musicTime > -0.5 && 
        m.hitTime - musicTime < 1.2
      );

      vrmService.updateSilhouettes(activeSilhouette ? {
        marker: activeSilhouette,
        timeToHit: activeSilhouette.hitTime - musicTime
      } : null);

      // --- 5. 終了判定 ---
      if (musicTime >= 19) {
        setGameState('RESULT');
        audioEngine.stop();
        confetti({
          particleCount: 200,
          spread: 120,
          origin: { y: 0.5 },
          colors: ['#ff00ff', '#00ffff', '#ffffff']
        });
      }
    }

    // --- 6. レンダリング ---
    if (vrm) {
      vrmService.update(vrm, 0.016);
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [gameState, vrm, updatePose, evaluateMarker]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  // --- Handlers ---
  const handleVRMUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    var url = URL.createObjectURL(file);
    try {
      const newVrm = await vrmService.loadVRM(url);
      setVrm(newVrm);
    } catch (e) {
      console.error(e);
      alert("VRMの読み込みに失敗しました");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const handleStart = async () => {
    if (isStartingCamera) return; // Prevent double-click
    if (!videoRef.current) return;

    setIsStartingCamera(true);
    setCameraError(null);

    try {
      await poseService.startCamera(videoRef.current);
      await audioEngine.playDemo();
      setGameState('PLAYING');
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error("handleStart: camera failed", err);
      setCameraError(msg);
    } finally {
      setIsStartingCamera(false);
    }
  };

  const handleCameraRetry = async () => {
    if (!videoRef.current) return;
    setCameraError(null);
    // Force release before retry
    await poseService.stopCamera(videoRef.current);
    handleStart();
  };

  return (
    <div className="relative w-full h-screen bg-neutral-950 overflow-hidden flex flex-col items-center justify-center font-sans">
      {/* Dynamic Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(120,0,255,0.15),_rgba(0,0,0,1)_80%)] pointer-events-none z-0"></div>
      
      {/* 3D Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10" />

      {/* Camera Preview PIP at Bottom Right */}
      <div className="absolute bottom-6 right-6 w-72 h-48 glass-panel overflow-hidden z-30 group hover:scale-[1.02] transition-transform duration-300">
        <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1] opacity-70" muted playsInline />
        <div className="absolute top-3 left-3 bg-rose-500/80 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-2 animate-pulse shadow-lg">
          <div className="w-2 h-2 bg-white rounded-full" /> REC
        </div>
      </div>

      <HUD 
        score={score} 
        combo={combo} 
        currentTime={currentTime} 
        upcomingMarkers={upcomingMarkers} 
        judgment={judgment}
      />
      
      <KineticTypography lyrics={lyrics} currentTime={currentTime} />

      <AnimatePresence>
        {gameState === 'IDLE' && (
          <motion.div 
            key="idle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute z-40 glass-panel p-12 max-w-xl w-full text-center"
          >
            <div className="mb-8 relative flex justify-center">
              <div className="absolute inset-0 bg-fuchsia-500/20 blur-3xl rounded-full" />
              <Play className="w-20 h-20 text-fuchsia-400 relative drop-shadow-[0_0_20px_rgba(217,70,239,0.5)]" />
            </div>
            
            <h1 className="text-6xl font-black mb-3 tracking-tighter text-gradient uppercase">
              AI Dance
              <br />
              Challenge
            </h1>
            <p className="text-gray-300 mb-10 text-lg mx-auto leading-relaxed font-light">
              Become the star of your own MV.
              <br />
              <span className="text-sm opacity-60">Powered by WebGL & MediaPipe.</span>
            </p>

            <div className="flex flex-col gap-4">
              {cameraError && (
                <div className="text-rose-200 bg-rose-950/50 border border-rose-500/30 rounded-xl px-4 py-3 text-sm text-left backdrop-blur-md">
                  <p className="font-bold mb-1 flex items-center gap-2">⚠️ <span className="text-rose-400">Camera Access Denied</span></p>
                  <p className="text-xs opacity-70 mb-3 font-mono break-all line-clamp-2">{cameraError}</p>
                  <button
                    onClick={handleCameraRetry}
                    className="w-full py-2.5 bg-rose-600/80 hover:bg-rose-500 text-white font-bold rounded-lg text-sm transition-all shadow-[0_0_15px_rgba(225,29,72,0.3)] hover:shadow-[0_0_25px_rgba(225,29,72,0.5)]"
                  >
                    🔄 Retry Camera Access
                  </button>
                </div>
              )}

              <button 
                onClick={handleStart}
                disabled={isStartingCamera}
                className="group relative w-full py-5 bg-white text-black font-black text-xl rounded-2xl overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-wait"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-rose-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative z-10 flex items-center justify-center gap-3 group-hover:text-white transition-colors duration-300">
                  {isStartingCamera ? 'INITIALIZING...' : <>START MISSION <Play size={20} className="group-hover:fill-white transition-colors duration-300" /></>}
                </span>
              </button>

              <input type="file" accept=".vrm" ref={fileInputRef} onChange={handleVRMUpload} style={{ display: 'none' }} />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 bg-transparent hover:bg-white/5 text-gray-300 font-bold rounded-2xl border border-white/10 transition-all text-sm tracking-widest flex items-center justify-center gap-2 hover:border-white/30"
              >
                <Upload size={16} /> CUSTOM VRM
              </button>
            </div>
          </motion.div>
        )}

        {gameState === 'RESULT' && (
          <motion.div 
            key="result"
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0.4 }}
            className="absolute z-40 glass-panel p-16 max-w-2xl w-full text-center"
          >
            <h2 className="text-8xl font-black mb-2 tracking-tighter text-gradient pb-2 drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              CLEAR!
            </h2>
            <p className="text-cyan-300 text-xl font-bold mb-10 tracking-[0.5em] uppercase">Session Complete</p>
            
            <div className="grid grid-cols-2 gap-6 mb-12">
              <div className="bg-black/40 backdrop-blur-xl p-8 rounded-3xl border border-white/5 shadow-inner">
                <p className="text-gray-400 text-xs tracking-widest mb-2 uppercase">Final Score</p>
                <p className="text-6xl font-black text-white drop-shadow-lg">{score}</p>
              </div>
              <div className="bg-black/40 backdrop-blur-xl p-8 rounded-3xl border border-white/5 shadow-inner">
                <p className="text-gray-400 text-xs tracking-widest mb-2 uppercase">Max Combo</p>
                <p className="text-6xl font-black text-fuchsia-400 drop-shadow-[0_0_15px_rgba(217,70,239,0.5)]">{combo}</p>
              </div>
            </div>

            <button 
              onClick={() => {
                setScore(0);
                setCombo(0);
                scoredPosesRef.current.clear();
                bestResultsRef.current.clear();
                setGameState('IDLE');
              }}
              className="px-14 py-5 bg-white text-black font-black text-xl tracking-wider rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)]"
            >
              PLAY AGAIN
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;

