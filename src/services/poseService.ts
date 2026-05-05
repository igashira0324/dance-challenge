import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

class PoseService {
  private landmarker: PoseLandmarker | null = null;
  private stream: MediaStream | null = null;

  async init() {
    if (this.landmarker) return;
    
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm"
    );

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

  async startCamera(videoElement: HTMLVideoElement): Promise<void> {
    // 1. Force stop all existing tracks globally in this window
    await this.stopCamera(videoElement);

    const tryGetCamera = async (width: number, height: number): Promise<MediaStream> => {
      return await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: width }, height: { ideal: height }, facingMode: "user" },
        audio: false
      });
    };

    try {
      // Try 720p first
      try {
        this.stream = await tryGetCamera(1280, 720);
      } catch (e) {
        console.warn("PoseService: 720p failed, falling back to 360p", e);
        // Fallback to 360p
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
    try {
      return this.landmarker.detectForVideo(video, timestamp);
    } catch (e) {
      console.error("PoseService: Detection failed", e);
      return null;
    }
  }

  async stopCamera(videoElement?: HTMLVideoElement) {
    // Clear video element reference
    if (videoElement) {
      videoElement.srcObject = null;
      videoElement.pause();
    }

    // Stop all tracks in the current stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log("PoseService: Managed camera track stopped");
      });
      this.stream = null;
    }

    // Wait for hardware to fully release before allowing new requests
    await new Promise(resolve => setTimeout(resolve, 800));
  }
}

export const poseService = new PoseService();
