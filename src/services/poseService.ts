import { FilesetResolver, PoseLandmarker, FaceLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';

class PoseService {
  private landmarker: PoseLandmarker | null = null;
  private faceLandmarker: FaceLandmarker | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;

  // Each landmarker needs its own independent timestamp tracker
  // Sharing one timestamp across 3 detectForVideo calls in the same frame
  // breaks the monotonic-increase constraint and causes silent detection failures
  private lastPoseTs: number = 0;
  private lastFaceTs: number = 0;
  private lastHandTs: number = 0;

  async init() {
    if (this.landmarker && this.faceLandmarker && this.handLandmarker) return;
    
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm"
    );

    if (!this.landmarker) {
      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
    }

    if (!this.faceLandmarker) {
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        numFaces: 1,
        minFaceDetectionConfidence: 0.3,
        minFacePresenceConfidence: 0.3,
        minTrackingConfidence: 0.3
      });
    }

    if (!this.handLandmarker) {
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.3,
        minHandPresenceConfidence: 0.3,
        minTrackingConfidence: 0.3
      });
    }
  }

  async startCamera(videoElement: HTMLVideoElement): Promise<void> {
    await this.stopCamera(videoElement);

    const tryGetCamera = async (width: number, height: number): Promise<MediaStream> => {
      return await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: width }, height: { ideal: height }, facingMode: "user" },
        audio: false
      });
    };

    try {
      try {
        this.stream = await tryGetCamera(1280, 720);
      } catch (e) {
        console.warn("PoseService: 720p failed, falling back to 360p", e);
        this.stream = await tryGetCamera(640, 360);
      }

      videoElement.srcObject = this.stream;
      return new Promise((resolve, reject) => {
        videoElement.onloadedmetadata = () => {
          videoElement.play().then(resolve).catch(reject);
        };
        videoElement.onerror = (e) => reject(new Error("Video element error: " + e));
      });
    } catch (err) {
      console.error("PoseService: All camera access attempts failed", err);
      throw err;
    }
  }

  detect(video: HTMLVideoElement, timestamp: number) {
    if (!this.landmarker || video.readyState < 2) return null;
    const us = Math.max(this.lastPoseTs + 1, Math.floor(timestamp * 1000));
    this.lastPoseTs = us;
    try {
      return this.landmarker.detectForVideo(video, us);
    } catch (e) {
      return null;
    }
  }

  detectFace(video: HTMLVideoElement, timestamp: number) {
    if (!this.faceLandmarker || video.readyState < 2) return null;
    const us = Math.max(this.lastFaceTs + 1, Math.floor(timestamp * 1000));
    this.lastFaceTs = us;
    try {
      return this.faceLandmarker.detectForVideo(video, us);
    } catch (e) {
      return null;
    }
  }

  detectHands(video: HTMLVideoElement, timestamp: number) {
    if (!this.handLandmarker || video.readyState < 2) return null;
    const us = Math.max(this.lastHandTs + 1, Math.floor(timestamp * 1000));
    this.lastHandTs = us;
    try {
      return this.handLandmarker.detectForVideo(video, us);
    } catch (e) {
      return null;
    }
  }

  async stopCamera(videoElement?: HTMLVideoElement) {
    if (videoElement) {
      videoElement.srcObject = null;
      videoElement.pause();
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log("PoseService: Managed camera track stopped");
      });
      this.stream = null;
    }
    await new Promise(resolve => setTimeout(resolve, 800));
  }
}

export const poseService = new PoseService();

