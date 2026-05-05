import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Zap, Clock } from 'lucide-react';
import { MarkerTarget } from '../constants';
import './HUD.css';

interface Props {
  score: number;
  combo: number;
  currentTime: number;
  upcomingMarkers: MarkerTarget[];
  judgment: { text: string; id: number } | null;
}

export const HUD: React.FC<Props> = ({ score, combo, currentTime, upcomingMarkers, judgment }) => {
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
            <div className="text-4xl font-black font-mono text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
              {currentTime?.toFixed(1) || "0.0"}
            </div>
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

      {/* ダンエボスタイル: 3Dシルエットを使用するため2DSVGパネルは削除 */}

      {/* Judgment Display Center Screen */}
      <AnimatePresence>
        {judgment && (
          <motion.div
            key={judgment.id}
            initial={{ scale: 0.5, opacity: 0, rotate: -5, y: "40%" }}
            animate={{ scale: 1, opacity: 1, rotate: 0, y: "-50%" }}
            exit={{ scale: 1.5, opacity: 0, filter: "blur(10px)" }}
            transition={{ type: "spring", bounce: 0.5 }}
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 judgment-text-premium ${judgment.text.toLowerCase().replace('!', '')}`}
          >
            {judgment.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spatial Markers (Ripple type) */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <AnimatePresence>
          {upcomingMarkers.map((marker, i) => {
            if (marker.type === 'Silhouette') return null;

            const timeDiff = marker.hitTime - currentTime;
            if (timeDiff > 2.0 || timeDiff < -0.5) return null;

            const ringScale = 1 + Math.max(0, timeDiff);

            const isLeft = marker.targetLimb === 'leftWrist';
            const color = isLeft ? 'border-cyan-400' : 'border-fuchsia-400';
            const bgColor = isLeft ? 'bg-cyan-400/20' : 'bg-fuchsia-400/20';

            return (
              <motion.div
                key={`${marker.hitTime}-${marker.targetLimb}-${i}`}
                className="absolute flex items-center justify-center"
                style={{ 
                  left: `${marker.x * 100}%`, 
                  top: `${marker.y * 100}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 1.5 }}
              >
                {/* Target Circle (Inner) */}
                <div className={`absolute w-16 h-16 rounded-full border-4 ${color} ${bgColor} shadow-[0_0_20px_currentColor] flex items-center justify-center`}>
                  <span className="text-white text-xs font-black">{isLeft ? 'L' : 'R'}</span>
                </div>

                {/* Shrinking Ring (Outer) */}
                {timeDiff > 0 && (
                  <div 
                    className={`absolute w-16 h-16 rounded-full border-2 ${color} opacity-80`}
                    style={{ 
                      transform: `scale(${ringScale})`,
                      transition: 'transform 0.1s linear'
                    }}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default HUD;
