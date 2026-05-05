import { useState, useEffect, useRef } from 'react';
import { VRM } from '@pixiv/three-vrm';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Play } from 'lucide-react';

import { vrmService } from './services/vrmService';
import { poseService } from './services/poseService';
import { audioEngine } from './services/audioEngine';
import { DEMO_LYRICS } from './constants';

import HUD from './components/HUD';
import KineticTypography from './components/KineticTypography';
import MocapTest from './components/MocapTest';

import { useGameEngine } from './hooks/useGameEngine';
import { useCameraPose } from './hooks/useCameraPose';
import { useGameLoop } from './hooks/useGameLoop';

import './App.css';

const App = () => {
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'RESULT' | 'MOCAP'>('IDLE');
  const [vrm, setVrm] = useState<VRM | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    score,
    combo,
    judgment,
    upcomingMarkers,
    scoredPosesRef,
    bestResultsRef,
    bestTimingRef,
    judgmentCountsRef,
    evaluateMarker,
    updateMarkers,
    resetEngine
  } = useGameEngine();

  const {
    videoRef,
    isStartingCamera,
    cameraError,
    worldLandmarksRef,
    imageLandmarksRef,
    updatePose,
    startCamera,
    stopCamera,
    setCameraError
  } = useCameraPose(vrm);

  // カメラシェイク演出のラップ
  const evaluateWithShake = (target: any, result: any, bonus: number) => {
    evaluateMarker(target, result, bonus);
    if (result === 'PERFECT') {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 200);
    }
  };

  const { currentTimeMotion } = useGameLoop({
    gameState,
    setGameState,
    vrm,
    updatePose,
    evaluateMarker: evaluateWithShake,
    updateMarkers,
    scoredPosesRef,
    bestResultsRef,
    bestTimingRef,
    worldLandmarksRef,
    imageLandmarksRef,
    videoRef
  });

  // --- Initial Setup ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) {
      startCamera().catch(err => console.warn("Initial camera start failed", err));
      vrmService.init(canvasRef.current);
    }
    vrmService.loadVRM('/default.vrm')
      .then(setVrm)
      .catch(err => console.warn("Default VRM load failed", err));

    return () => {
      audioEngine.stop();
      stopCamera();
    };
  }, [stopCamera]);

  // --- Handlers ---
  const handleVRMUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const newVrm = await vrmService.loadVRM(url);
      setVrm(newVrm);
    } catch (e) {
      alert("VRMの読み込みに失敗しました");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const handleStart = async () => {
    try {
      await startCamera();
      await audioEngine.playDemo();
      setGameState('PLAYING');
    } catch (err: any) {
      setCameraError(err?.message || "カメラの起動に失敗しました");
    }
  };

  return (
    <div className={`relative w-full h-screen bg-neutral-950 overflow-hidden flex flex-col items-center justify-center font-sans ${isShaking ? 'camera-shake' : ''}`}>
      <video 
        ref={videoRef} 
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1] z-0 opacity-60" 
        muted 
        playsInline 
      />
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] z-[1]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(120,0,255,0.1),_rgba(0,0,0,0.4)_100%)] pointer-events-none z-[2]" />
      
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10" />

      {gameState === 'PLAYING' && (
        <div className="absolute bottom-6 right-6 px-4 py-2 bg-rose-600/80 backdrop-blur-md rounded-full text-xs font-black text-white flex items-center gap-3 animate-pulse shadow-2xl z-50 border border-white/20">
          <div className="w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_10px_#fff]" /> LIVE RECORDING
        </div>
      )}

      {gameState !== 'MOCAP' && (
        <>
          <HUD 
            score={score} 
            combo={combo} 
            currentTime={currentTimeMotion} 
            upcomingMarkers={upcomingMarkers} 
            judgment={judgment}
          />
          
          <KineticTypography lyrics={DEMO_LYRICS} currentTime={currentTimeMotion} />
        </>
      )}

      <AnimatePresence>
        {gameState === 'IDLE' && (
          <motion.div 
            key="idle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            className="absolute z-40 glass-panel p-12 max-w-xl w-full text-center"
          >
            <div className="mb-8 relative flex justify-center">
              <div className="absolute inset-0 bg-fuchsia-500/20 blur-3xl rounded-full" />
              <Play className="w-20 h-20 text-fuchsia-400 relative drop-shadow-[0_0_20px_rgba(217,70,239,0.5)]" />
            </div>
            
            <h1 className="text-6xl font-black mb-3 tracking-tighter text-gradient uppercase">
              AI Dance<br />Challenge
            </h1>
            <p className="text-gray-300 mb-10 text-lg mx-auto leading-relaxed font-light">
              Become the star of your own MV.<br />
              <span className="text-sm opacity-60">Powered by WebGL & MediaPipe.</span>
            </p>

            <div className="flex flex-col gap-4">
              {cameraError && (
                <div className="text-rose-200 bg-rose-950/50 border border-rose-500/30 rounded-xl px-4 py-3 text-sm text-left backdrop-blur-md">
                  <p className="font-bold mb-1 flex items-center gap-2">⚠️ <span className="text-rose-400">Camera Error</span></p>
                  <p className="text-xs opacity-70 mb-3 font-mono break-all line-clamp-2">{cameraError}</p>
                  <button onClick={handleStart} className="w-full py-2.5 bg-rose-600/80 hover:bg-rose-500 text-white font-bold rounded-lg text-sm transition-all">
                    🔄 Retry Camera Access
                  </button>
                </div>
              )}

              <button 
                onClick={handleStart}
                disabled={isStartingCamera}
                className="group relative w-full py-5 bg-white text-black font-black text-xl rounded-2xl overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-rose-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative z-10 flex items-center justify-center gap-3 group-hover:text-white transition-colors">
                  {isStartingCamera ? 'INITIALIZING...' : <>START MISSION <Play size={20} /></>}
                </span>
              </button>

              <input type="file" accept=".vrm" ref={fileInputRef} onChange={handleVRMUpload} style={{ display: 'none' }} />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 bg-transparent hover:bg-white/5 text-gray-300 font-bold rounded-2xl border border-white/10 transition-all text-sm tracking-widest flex items-center justify-center gap-2"
              >
                <Upload size={16} /> CUSTOM VRM
              </button>

              <button
                onClick={() => setGameState('MOCAP')}
                className="w-full py-3 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 font-bold rounded-2xl border border-cyan-400/20 text-xs tracking-[0.2em] transition-all"
              >
                🔬 MOCAP TEST MODE
              </button>
            </div>
          </motion.div>
        )}

        {gameState === 'RESULT' && (
          <motion.div 
            key="result"
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute z-40 glass-panel p-10 max-w-2xl w-full text-center"
          >
            <div className="flex flex-col items-center">
              <div className="relative mb-4">
                <h2 className="text-8xl font-black tracking-tighter text-gradient pb-2 drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                  {(() => {
                    const total = judgmentCountsRef.current.PERFECT + judgmentCountsRef.current.GOOD + judgmentCountsRef.current.MISS;
                    const rate = (judgmentCountsRef.current.PERFECT * 1.0 + judgmentCountsRef.current.GOOD * 0.5) / (total || 1);
                    if (rate >= 0.9) return 'RANK S';
                    if (rate >= 0.8) return 'RANK A';
                    if (rate >= 0.6) return 'RANK B';
                    return 'RANK C';
                  })()}
                </h2>
                <p className="text-cyan-300 text-xl font-bold tracking-[0.5em] uppercase">Mission Clear</p>
              </div>

              <div className="grid grid-cols-3 gap-4 w-full mb-8">
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Perfect</p>
                  <p className="text-2xl font-black text-white">{judgmentCountsRef.current.PERFECT}</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Good</p>
                  <p className="text-2xl font-black text-fuchsia-400">{judgmentCountsRef.current.GOOD}</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Miss</p>
                  <p className="text-2xl font-black text-rose-500">{judgmentCountsRef.current.MISS}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6 w-full mb-10">
                <div className="bg-black/40 backdrop-blur-xl p-6 rounded-3xl border border-white/5 shadow-inner">
                  <p className="text-gray-400 text-xs tracking-widest mb-2 uppercase">Score</p>
                  <p className="text-5xl font-black text-white">{score}</p>
                </div>
                <div className="bg-black/40 backdrop-blur-xl p-6 rounded-3xl border border-white/5 shadow-inner">
                  <p className="text-gray-400 text-xs tracking-widest mb-2 uppercase">Max Combo</p>
                  <p className="text-5xl font-black text-fuchsia-400">{combo}</p>
                </div>
              </div>

              <button 
                onClick={() => {
                  resetEngine();
                  setGameState('IDLE');
                }}
                className="px-14 py-4 bg-white text-black font-black text-lg tracking-wider rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)]"
              >
                RETRY MISSION
              </button>
            </div>
          </motion.div>
        )}

        {gameState === 'MOCAP' && (
          <MocapTest vrm={vrm} onExit={() => setGameState('IDLE')} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
