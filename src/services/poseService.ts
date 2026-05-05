import { FilesetResolver, PoseLandmarker, FaceLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';

class PoseService {
  private landmarker: PoseLandmarker | null = null;
  private faceLandmarker: FaceLandmarker | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;

  private initPromise: Promise<void> | null = null;
  private startPromise: Promise<void> | null = null;

  private lastPoseTs: number = 0;
  private lastFaceTs: number = 0;
  private lastHandTs: number = 0;

  async init() {
    if (this.landmarker && this.faceLandmarker && this.handLandmarker) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInit();

    try {
      await this.initPromise;
    } catch (e) {
      this.initPromise = null;
      throw e;
    }
  }

  private async doInit() {
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
    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.doStartCamera(videoElement);

    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private async doStartCamera(videoElement: HTMLVideoElement): Promise<void> {
    await this.stopCamera(videoElement, { delay: false });

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
      videoElement.muted = true;
      videoElement.playsInline = true;

      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          videoElement.onloadedmetadata = null;
          videoElement.onerror = null;
        };

        const timeout = window.setTimeout(() => {
          cleanup();
          reject(new Error("Camera video metadata timeout"));
        }, 10000);

        videoElement.onloadedmetadata = async () => {
          try {
            await videoElement.play();
            window.clearTimeout(timeout);
            cleanup();
            resolve();
          } catch (e) {
            window.clearTimeout(timeout);
            cleanup();
            reject(e);
          }
        };

        videoElement.onerror = (e) => {
          window.clearTimeout(timeout);
          cleanup();
          reject(new Error("Video element error: " + e));
        };
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

  async stopCamera(videoElement?: HTMLVideoElement, options: { delay?: boolean } = { delay: true }) {
    if (videoElement) {
      videoElement.pause();
      videoElement.srcObject = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log("PoseService: Managed camera track stopped");
      });
      this.stream = null;
    }
    
    if (options.delay) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    this.lastPoseTs = 0;
    this.lastFaceTs = 0;
    this.lastHandTs = 0;
  }
}

export const poseService = new PoseService();
