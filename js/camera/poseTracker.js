/**
 * MediaPipe Pose Landmarker Wrapper
 * Uses @mediapipe/tasks-vision ES Module to detect full-body landmarks
 */
import {
  FilesetResolver,
  PoseLandmarker
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs';

export class PoseTracker {
  constructor() {
    this.landmarker = null;
    this.isReady = false;
    this.lastVideoTime = -1;
  }

  /**
   * Initializes MediaPipe PoseLandmarker
   */
  async init(onProgress = () => {}) {
    onProgress('AI 비전 엔진 초기화 중...');

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    onProgress('포즈 랜드마크 모델 다운로드 중...');

    const modelPath =
      'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

    try {
      // 1. Try GPU acceleration first
      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
    } catch (gpuError) {
      console.warn('GPU 가속 초기화 실패, CPU 모드로 대체 실행합니다:', gpuError);
      onProgress('CPU 모드로 모델 전환 중...');
      // 2. Fallback to CPU
      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'CPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
    }

    this.isReady = true;
    onProgress('준비 완료! 게임 시작 버튼을 눌러주세요.');
  }

  /**
   * Detects landmarks in current video frame
   * @param {HTMLVideoElement} video 
   * @param {number} timestamp 
   * @returns {Array|null} Array of 33 normalized landmarks or null
   */
  detect(video, timestamp) {
    if (!this.isReady || !this.landmarker || video.readyState < 2) return null;

    if (video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = video.currentTime;
      try {
        const results = this.landmarker.detectForVideo(video, timestamp);
        if (results && results.landmarks && results.landmarks.length > 0) {
          return results.landmarks[0];
        }
      } catch (e) {
        // Suppress temporary frame inference error
      }
    }
    return null;
  }

  /**
   * Draws a stylized semi-transparent neon skeleton on the background canvas
   */
  drawSkeleton(ctx, landmarks, canvasWidth, canvasHeight, mirror = true) {
    if (!landmarks || landmarks.length === 0) return;

    // Connections between joints
    const connections = [
      [11, 12], // Shoulders
      [11, 13], [13, 15], // Left arm (shoulder -> elbow -> wrist)
      [12, 14], [14, 16], // Right arm (shoulder -> elbow -> wrist)
      [15, 19], // Left wrist to index
      [16, 20], // Right wrist to index
      [11, 23], [12, 24], // Torso
      [23, 24], // Hips
      [23, 25], [25, 27], // Left leg
      [24, 26], [26, 28]  // Right leg
    ];

    const toPixel = (normPoint) => {
      const x = mirror ? (1 - normPoint.x) * canvasWidth : normPoint.x * canvasWidth;
      const y = normPoint.y * canvasHeight;
      return { x, y };
    };

    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineCap = 'round';

    // Draw lines
    connections.forEach(([i, j]) => {
      const p1 = landmarks[i];
      const p2 = landmarks[j];
      if (p1 && p2 && (p1.visibility === undefined || (p1.visibility > 0.4 && p2.visibility > 0.4))) {
        const pt1 = toPixel(p1);
        const pt2 = toPixel(p2);
        ctx.beginPath();
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.stroke();
      }
    });

    // Draw joints
    landmarks.forEach((p, idx) => {
      if (p && (p.visibility === undefined || p.visibility > 0.4)) {
        const pt = toPixel(p);
        ctx.beginPath();
        // Hand joints are highlighted differently
        if (idx === 15 || idx === 19) {
          ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
          ctx.fillStyle = '#00e5ff'; // Left hand Cyan
        } else if (idx === 16 || idx === 20) {
          ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
          ctx.fillStyle = '#ff007f'; // Right hand Pink
        } else {
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(125, 211, 252, 0.7)';
        }
        ctx.fill();
      }
    });

    ctx.restore();
  }
}
