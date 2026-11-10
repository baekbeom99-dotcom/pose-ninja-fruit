/**
 * MediaPipe Pose Landmarker Wrapper with Multi-Person (2-Player) Support
 * Uses @mediapipe/tasks-vision ES Module to track up to 2 bodies simultaneously.
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

  async init(onProgress = () => {}) {
    onProgress('AI 비전 엔진 초기화 중...');

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    onProgress('포즈 랜드마크 모델 다운로드 중 (2인 지원)...');

    const modelPath =
      'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

    try {
      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 2, // 2-Player Tracking Enabled
        minPoseDetectionConfidence: 0.45,
        minPosePresenceConfidence: 0.45,
        minTrackingConfidence: 0.45
      });
    } catch (gpuError) {
      console.warn('GPU 가속 초기화 실패, CPU 모드로 대체 실행합니다:', gpuError);
      onProgress('CPU 모드로 모델 전환 중...');
      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'CPU'
        },
        runningMode: 'VIDEO',
        numPoses: 2,
        minPoseDetectionConfidence: 0.45,
        minPosePresenceConfidence: 0.45,
        minTrackingConfidence: 0.45
      });
    }

    this.isReady = true;
    onProgress('준비 완료! 게임 시작 버튼을 눌러주세요.');
  }

  /**
   * Detects landmarks in current video frame, returning up to 2 players sorted Left-to-Right
   * @param {HTMLVideoElement} video 
   * @param {number} timestamp 
   * @returns {Array<Array>|null} Array of poses
   */
  detect(video, timestamp) {
    if (!this.isReady || !this.landmarker || video.readyState < 2) return null;

    if (video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = video.currentTime;
      try {
        const results = this.landmarker.detectForVideo(video, timestamp);
        if (results && results.landmarks && results.landmarks.length > 0) {
          // Sort players by horizontal position (in mirrored coordinates, smaller mirrored X is left)
          return results.landmarks.sort((a, b) => {
            const xA = (a[11] ? a[11].x : a[0].x);
            const xB = (b[11] ? b[11].x : b[0].x);
            // In mirror mode: visual left is larger raw X
            return xB - xA;
          });
        }
      } catch (e) {
        // Suppress temporary frame inference error
      }
    }
    return null;
  }

  /**
   * Draws stylized skeletons for both players with distinct colors
   */
  drawSkeletons(ctx, poseLandmarksArray, canvasWidth, canvasHeight, mirror = true) {
    if (!poseLandmarksArray || poseLandmarksArray.length === 0) return;

    poseLandmarksArray.forEach((landmarks, playerIdx) => {
      this._drawSingleSkeleton(ctx, landmarks, canvasWidth, canvasHeight, mirror, playerIdx);
    });
  }

  _drawSingleSkeleton(ctx, landmarks, canvasWidth, canvasHeight, mirror, playerIdx) {
    if (!landmarks || landmarks.length === 0) return;

    const connections = [
      [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
      [15, 19], [16, 20], [11, 23], [12, 24], [23, 24],
      [23, 25], [25, 27], [24, 26], [26, 28]
    ];

    const toPixel = (normPoint) => {
      const x = mirror ? (1 - normPoint.x) * canvasWidth : normPoint.x * canvasWidth;
      const y = normPoint.y * canvasHeight;
      return { x, y };
    };

    const isP1 = playerIdx === 0;
    const strokeColor = isP1 ? 'rgba(56, 189, 248, 0.45)' : 'rgba(244, 63, 94, 0.45)';
    const handLColor = isP1 ? '#00e5ff' : '#ff007f';
    const handRColor = isP1 ? '#3b82f6' : '#f59e0b';
    const jointColor = isP1 ? 'rgba(125, 211, 252, 0.7)' : 'rgba(251, 146, 60, 0.7)';

    ctx.save();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = strokeColor;
    ctx.lineCap = 'round';

    connections.forEach(([i, j]) => {
      const p1 = landmarks[i];
      const p2 = landmarks[j];
      if (p1 && p2 && (p1.visibility === undefined || (p1.visibility > 0.35 && p2.visibility > 0.35))) {
        const pt1 = toPixel(p1);
        const pt2 = toPixel(p2);
        ctx.beginPath();
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.stroke();
      }
    });

    landmarks.forEach((p, idx) => {
      if (p && (p.visibility === undefined || p.visibility > 0.35)) {
        const pt = toPixel(p);
        ctx.beginPath();
        if (idx === 15 || idx === 19) {
          ctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2);
          ctx.fillStyle = handLColor;
        } else if (idx === 16 || idx === 20) {
          ctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2);
          ctx.fillStyle = handRColor;
        } else {
          ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = jointColor;
        }
        ctx.fill();
      }
    });

    ctx.restore();
  }
}
