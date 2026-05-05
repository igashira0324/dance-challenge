import { useState, useRef, useCallback } from 'react';
import { VRM } from '@pixiv/three-vrm';
import { Pose } from 'kalidokit';
import { poseService } from '../services/poseService';
import { vrmService } from '../services/vrmService';

export const useCameraPose = (vrm: VRM | null) => {
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const worldLandmarksRef = useRef<any[]>([]);
  const imageLandmarksRef = useRef<any[]>([]);
  const kalidokitPoseRef = useRef<any>(null);

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

  const startCamera = useCallback(async () => {
    if (isStartingCamera || !videoRef.current) return;
    setIsStartingCamera(true);
    setCameraError(null);
    try {
      await poseService.startCamera(videoRef.current);
    } catch (err: any) {
      setCameraError(err?.message || String(err));
      throw err;
    } finally {
      setIsStartingCamera(false);
    }
  }, [isStartingCamera]);

  const stopCamera = useCallback(async () => {
    if (videoRef.current) {
      await poseService.stopCamera(videoRef.current);
    }
  }, []);

  return {
    videoRef,
    isStartingCamera,
    cameraError,
    worldLandmarksRef,
    imageLandmarksRef,
    kalidokitPoseRef,
    updatePose,
    startCamera,
    stopCamera,
    setCameraError
  };
};
