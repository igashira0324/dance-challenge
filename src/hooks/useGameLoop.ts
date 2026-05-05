import { useEffect, useRef, useCallback } from 'react';
import { useMotionValue } from 'framer-motion';
import { audioEngine } from '../services/audioEngine';
import { vrmService } from '../services/vrmService';
import { poseService } from '../services/poseService';
import { checkPoseMatch } from '../utils/poseUtils';
import { Face } from 'kalidokit';
import type { MarkerTarget } from '../types/game';
import { VRM } from '@pixiv/three-vrm';

interface GameLoopProps {
  gameState: 'IDLE' | 'PLAYING' | 'RESULT' | 'MOCAP' | 'PHOTO_BOOTH';
  setGameState: (s: 'IDLE' | 'PLAYING' | 'RESULT' | 'MOCAP' | 'PHOTO_BOOTH') => void;
  vrm: VRM | null;
  updatePose: (world: any, landmarks: any) => void;
  evaluateMarker: (target: MarkerTarget, result: 'PERFECT' | 'GOOD' | 'MISS', bonus: number) => void;
  updateMarkers: (time: number) => MarkerTarget[];
  scoredPosesRef: React.MutableRefObject<Set<string>>;
  bestResultsRef: React.MutableRefObject<Map<string, 'PERFECT' | 'GOOD' | 'MISS'>>;
  bestTimingRef: React.MutableRefObject<Map<string, number>>;
  worldLandmarksRef: React.MutableRefObject<any[]>;
  imageLandmarksRef: React.MutableRefObject<any[]>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export const useGameLoop = ({
  gameState,
  setGameState,
  vrm,
  updatePose,
  evaluateMarker,
  updateMarkers,
  scoredPosesRef,
  bestResultsRef,
  bestTimingRef,
  worldLandmarksRef,
  imageLandmarksRef,
  videoRef
}: GameLoopProps) => {
  const requestRef = useRef<number>(null);
  const currentTimeMotion = useMotionValue(0);

  const animate = useCallback((time: number) => {
    if (gameState === 'PLAYING') {
      const musicTime = audioEngine.getCurrentTime();
      currentTimeMotion.set(musicTime);

      // --- 1. マーカー表示管理 ---
      const visibleMarkers = updateMarkers(musicTime);

      // --- 2. ポーズ検出 ---
      if (videoRef.current) {
        const results = poseService.detect(videoRef.current, time);
        if (results && results.landmarks?.[0] && results.worldLandmarks?.[0]) {
          worldLandmarksRef.current = results.worldLandmarks[0];
          imageLandmarksRef.current = results.landmarks[0];
          updatePose(results.worldLandmarks[0], results.landmarks[0]);
        }

        // --- 2b. 顔検出 (表情: まばたき等) ---
        if (vrm) {
          const faceResult = poseService.detectFace(videoRef.current, time);
          if (faceResult && faceResult.faceLandmarks?.[0]) {
            const solvedFace = (Face as any).solve(faceResult.faceLandmarks[0], {
              runtime: 'mediapipe',
              video: videoRef.current
            });
            if (solvedFace) {
              vrmService.applyFace(vrm, solvedFace);
            }
          }
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
            
            if (result === 'PERFECT' || (result === 'GOOD' && currentBest === 'MISS')) {
              bestResultsRef.current.set(marker.id, result);
              const prevBestT = bestTimingRef.current.get(marker.id);
              if (prevBestT === undefined || Math.abs(timeToHit) < Math.abs(prevBestT)) {
                bestTimingRef.current.set(marker.id, timeToHit);
              }
            }

            if (result === 'PERFECT') {
              const timingFactor = Math.max(0.5, 1.0 - (Math.max(0, Math.abs(timeToHit) - 0.15) / 0.45));
              evaluateMarker(marker, 'PERFECT', timingFactor);
              scoredPosesRef.current.add(marker.id);
            }
          }
        } 
        
        if (timeToHit < -HIT_WINDOW && !scoredPosesRef.current.has(marker.id)) {
          const finalResult = bestResultsRef.current.get(marker.id) || 'MISS';
          const bestT = bestTimingRef.current.get(marker.id) ?? -HIT_WINDOW;
          const timingFactor = Math.max(0.5, 1.0 - (Math.max(0, Math.abs(bestT) - 0.15) / 0.45));
          
          evaluateMarker(marker, finalResult, timingFactor);
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
      }
    }

    // --- 6. レンダリング ---
    if (vrm) {
      vrmService.update(vrm, 0.016);
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [gameState, vrm, updatePose, evaluateMarker, updateMarkers, setGameState]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  return { currentTimeMotion };
};
