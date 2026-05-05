import React from 'react';
import { motion, AnimatePresence, useTransform, MotionValue } from 'framer-motion';
import { Trophy, Zap, Clock } from 'lucide-react';
import { MarkerTarget } from '../constants';
import './HUD.css';

interface Props {
  score: number;
  combo: number;
  currentTime: MotionValue<number>;
  upcomingMarkers: MarkerTarget[];
  judgment: { text: string; id: number } | null;
}

const RippleMarker: React.FC<{ marker: MarkerTarget, currentTime: MotionValue<number> }> = ({ marker, currentTime }) => {
  // MotionValueを使って再レンダリングなしでスケールを更新
  const scale = useTransform(currentTime, (time) => {
    const timeDiff = marker.hitTime - time;
    return 1 + Math.max(0, timeDiff);
  });

  const opacity = useTransform(currentTime, (time) => {
    const timeDiff = marker.hitTime - time;
    if (timeDiff > 2.0 || timeDiff < -0.5) return 0;
    return 1;
  });

  const isLeft = marker.targetLimb === 'leftWrist';
  const color = isLeft ? 'border-cyan-400' : 'border-fuchsia-400';
  const bgColor = isLeft ? 'bg-cyan-400/20' : 'bg-fuchsia-400/20';

  return (
    <motion.div
      className="absolute flex items-center justify-center"
      style={{ 
        left: `${marker.x * 100}%`, 
        top: `${marker.y * 100}%`,
        transform: 'translate(-50%, -50%)',
        opacity
      }}
      initial={{ opacity: 0 }}
      exit={{ opacity: 0, scale: 1.5 }}
    >
      <div className={`absolute w-16 h-16 rounded-full border-4 ${color} ${bgColor} shadow-[0_0_20px_currentColor] flex items-center justify-center`}>
        <span className="text-white text-xs font-black">{isLeft ? 'L' : 'R'}</span>
      </div>

      <motion.div 
        className={`absolute w-16 h-16 rounded-full border-2 ${color} opacity-80`}
        style={{ scale }}
      />
    </motion.div>
  );
};

export const HUD: React.FC<Props> = ({ score, combo, currentTime, upcomingMarkers, judgment }) => {
  // TIME表示用のトランスフォーム
  const timeDisplay = useTransform(currentTime, (v) => v.toFixed(1));

  return (
    <div className="absolute inset-0 p-8 pointer-events-none flex flex-col z-20">
      
      {/* Top Header */}
      <div className="w-full flex justify-between items-start">
        {/* Left Side: Score & Time */}
        <div className="flex gap-4">
          <div className="glass-panel px-8 py-4 flex flex-col items-center min-w-[160px]">
            <div className="text-[10px] font-black text-white/50 tracking-[0.3em] flex items-center gap-2 mb-1">
              <Trophy size={14} className="text-amber-400" /> SCORE
            </div>
            <div className="text-4xl font-black font-mono text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
              {score.toLocaleString()}
            </div>
          </div>
          
          <div className="glass-panel px-8 py-4 flex flex-col items-center min-w-[160px]">
            <div className="text-[10px] font-black text-white/50 tracking-[0.3em] flex items-center gap-2 mb-1">
              <Clock size={14} className="text-cyan-400" /> TIME
            </div>
            <motion.div className="text-4xl font-black font-mono text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
              {timeDisplay}
            </motion.div>
          </div>
        </div>

        {/* Right Side: Combo */}
        <div className="glass-panel px-8 py-4 flex flex-col items-center min-w-[160px] bg-black/60 border-fuchsia-500/30">
          <div className="text-[10px] font-black text-white/50 tracking-[0.3em] flex items-center gap-2 mb-1 text-fuchsia-400">
            <Zap size={14} className="text-fuchsia-500" /> COMBO
          </div>
          <div className="text-5xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-br from-fuchsia-400 to-pink-600 drop-shadow-[0_0_15px_rgba(217,70,239,0.5)]">
            {combo}
          </div>
        </div>
      </div>

      {/* Judgment Display Center Screen */}
      <AnimatePresence>
        {judgment && (
          <motion.div
            key={judgment.id}
            initial={{ scale: 0.5, opacity: 0, rotate: -5, y: "40%" }}
            animate={{ scale: 1, opacity: 1, rotate: 0, y: "-50%" }}
            exit={{ scale: 1.5, opacity: 0, filter: "blur(10px)" }}
            transition={{ type: "spring", bounce: 0.5 }}
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 judgment-text-premium ${judgment.text.toLowerCase().replace('!', '').replace(' ', '')}`}
          >
            {judgment.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spatial Markers (Ripple type) */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <AnimatePresence>
          {upcomingMarkers.map((marker) => {
            if (marker.type === 'Silhouette') return null;
            return <RippleMarker key={marker.id} marker={marker} currentTime={currentTime} />;
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default HUD;
