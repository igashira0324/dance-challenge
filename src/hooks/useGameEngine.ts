import { useState, useRef, useCallback } from 'react';
import { MarkerTarget, DEMO_MARKERS } from '../constants';
import confetti from 'canvas-confetti';

export const useGameEngine = () => {
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [judgment, setJudgment] = useState<{text: string; id: number} | null>(null);
  const [upcomingMarkers, setUpcomingMarkers] = useState<MarkerTarget[]>([]);
  
  const comboRef = useRef(0);
  const judgmentTimeoutRef = useRef<number | null>(null);
  const scoredPosesRef = useRef<Set<string>>(new Set());
  const bestResultsRef = useRef<Map<string, 'PERFECT' | 'GOOD' | 'MISS'>>(new Map());
  const bestTimingRef = useRef<Map<string, number>>(new Map());
  const judgmentCountsRef = useRef({ PERFECT: 0, GOOD: 0, MISS: 0 });

  const evaluateMarker = useCallback((_target: MarkerTarget, result: 'PERFECT' | 'GOOD' | 'MISS', timingBonus: number = 1.0) => {
    const newJudgment = { 
      text: result === 'PERFECT' ? 'PERFECT!' : result === 'GOOD' ? 'GOOD' : 'MISS', 
      id: Date.now() 
    };
    setJudgment(newJudgment);

    if (result !== 'MISS') {
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
    judgmentCountsRef.current[result]++;
  }, []);

  const updateMarkers = useCallback((musicTime: number) => {
    const visibleMarkers = DEMO_MARKERS.filter(m => 
      musicTime >= m.hitTime - 1.2 && musicTime <= m.hitTime + 0.5
    );
    // UI更新頻度を下げるため、リストが変わったときだけsetStateする
    setUpcomingMarkers(prev => {
      if (prev.length === visibleMarkers.length && prev.every((m, i) => m.id === visibleMarkers[i].id)) {
        return prev;
      }
      return visibleMarkers;
    });
    return visibleMarkers;
  }, []);

  const resetEngine = useCallback(() => {
    setScore(0);
    setCombo(0);
    setJudgment(null);
    setUpcomingMarkers([]);
    comboRef.current = 0;
    scoredPosesRef.current.clear();
    bestResultsRef.current.clear();
    bestTimingRef.current.clear();
    judgmentCountsRef.current = { PERFECT: 0, GOOD: 0, MISS: 0 };
  }, []);

  return {
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
  };
};
