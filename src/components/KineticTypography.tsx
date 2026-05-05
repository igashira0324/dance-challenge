import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lyric, type AnimationType } from '../constants';
import './KineticTypography.css';

interface Props {
  currentTime: number;
  lyrics: Lyric[];
}

const TypewriterText: React.FC<{ text: string }> = ({ text }) => {
  return (
    <span>
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.1 }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
};

const WaveText: React.FC<{ text: string }> = ({ text }) => {
  return (
    <span className="wave-wrapper">
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 1, delay: i * 0.1 }}
          style={{ display: 'inline-block' }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
};

function getAnimationProps(animation: AnimationType): any {
  switch (animation) {
    case 'fadeInUp':
      return { initial: { opacity: 0, y: 50 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, scale: 0.5 } };
    case 'fadeInDown':
      return { initial: { opacity: 0, y: -50 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, scale: 0.5 } };
    case 'bounceIn':
      return { initial: { scale: 0 }, animate: { scale: 1 }, transition: { type: 'spring', stiffness: 260, damping: 20 } };
    case 'scaleUp':
      return { initial: { scale: 0, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 1.5, opacity: 0 } };
    case 'slideFromLeft':
      return { initial: { x: -200, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: 200, opacity: 0 } };
    case 'slideFromRight':
      return { initial: { x: 200, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: -200, opacity: 0 } };
    case 'glitch':
      return { 
        initial: { x: 0, opacity: 0 }, 
        animate: { 
          opacity: 1,
          x: [0, -5, 5, -2, 2, 0],
          filter: ["none", "hue-rotate(90deg)", "hue-rotate(-90deg)", "none"]
        },
        transition: { duration: 0.2, repeat: Infinity, repeatType: "reverse" as const }
      };
    case 'explode':
      return { initial: { scale: 0, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 3, opacity: 0, filter: "blur(10px)" } };
    default:
      return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
  }
}

export const KineticTypography: React.FC<Props> = ({ currentTime, lyrics }) => {
  const activeLyric = useMemo(() => {
    return lyrics.find(l => currentTime >= l.time && currentTime < l.time + l.duration);
  }, [currentTime, lyrics]);

  if (!activeLyric) return null;

  return (
    <>
      {/* Background Flash Effect */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`flash-${activeLyric.time}`}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-flash"
          style={{ backgroundColor: activeLyric.isChorus ? 'white' : 'rgba(255,255,255,0.2)' }}
        />
      </AnimatePresence>

      <div className="lyric-container">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeLyric.text + activeLyric.time}
            {...getAnimationProps(activeLyric.animation)}
            className={`lyric-text ${activeLyric.style} ${activeLyric.isChorus ? 'chorus' : ''}`}
          >
            {activeLyric.isChorus && (
              <motion.div 
                className="chorus-bg-text"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 0.1, scale: 1.2 }}
                transition={{ duration: 0.5 }}
              >
                {activeLyric.text}
              </motion.div>
            )}
            
            <div className="lyric-content-wrapper">
              {activeLyric.animation === 'typewriter' ? (
                <TypewriterText text={activeLyric.text} />
              ) : activeLyric.animation === 'wave' ? (
                <WaveText text={activeLyric.text} />
              ) : (
                activeLyric.text
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
};

export default KineticTypography;
