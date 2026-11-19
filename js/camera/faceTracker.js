/**
 * MediaPipe FaceLandmarker Wrapper
 * Lazily downloads & runs MediaPipe FaceLandmarker (with 52 ARKit blendshapes)
 * to extract mirrored mouth position, jawOpen mouth aperture, and face bounds.
 */
import {
  FilesetResolver,
  FaceLandmarker
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs';

export class FaceTracker {
  constructor() {
    this.landmarker = null;
    this.isReady = false;
    this.isLoading = false;
    this._initPromise = null;
    this.lastVideoTime = -1;
    this.lastResult = null;
  }

  async ensureReady() {
    if (this.isReady) return true;
    if (this._initPromise) return this._initPromise;

    this.isLoading = true;
    this._initPromise = (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        const modelPath =
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

        const opts = {
          baseOptions: { modelAssetPath: modelPath, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          minFaceDetectionConfidence: 0.45,
          minFacePresenceConfidence: 0.45,
          minTrackingConfidence: 0.45
        };

        try {
          this.landmarker = await FaceLandmarker.createFromOptions(vision, opts);
        } catch (gpuErr) {
          console.warn('FaceLandmarker GPU fallback to CPU:', gpuErr);
          opts.baseOptions.delegate = 'CPU';
          this.landmarker = await FaceLandmarker.createFromOptions(vision, opts);
        }

        this.isReady = true;
        return true;
      } catch (err) {
        console.warn('FaceLandmarker initialization failed:', err);
        this.isReady = false;
        return false;
      } finally {
        this.isLoading = false;
      }
    })();

    return this._initPromise;
  }

  /**
   * Detects face landmarks & jawOpen ratio in normalized [0..1] screen coords.
   */
  detect(video, timestamp, mirror = true) {
    if (!this.isReady || !this.landmarker || !video || video.readyState < 2) {
      return this.lastResult;
    }

    if (video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = video.currentTime;
      try {
        const res = this.landmarker.detectForVideo(video, timestamp);
        if (res && res.faceLandmarks && res.faceLandmarks.length > 0) {
          const lm = res.faceLandmarks[0];
          const toScreenNormX = (rawX) => (mirror ? 1.0 - rawX : rawX);

          // Upper inner lip (13) and lower inner lip (14)
          const topLip = lm[13] || lm[0];
          const botLip = lm[14] || lm[17];
          const mouthX = toScreenNormX((topLip.x + botLip.x) * 0.5);
          const mouthY = (topLip.y + botLip.y) * 0.5;

          // Face bounds from forehead (10), chin (152), cheeks (234, 454)
          const forehead = lm[10] || topLip;
          const chin = lm[152] || botLip;
          const cheekA = lm[234] || lm[61] || topLip;
          const cheekB = lm[454] || lm[291] || topLip;
          const noseTip = lm[1] || lm[4] || topLip;

          const faceX = toScreenNormX((cheekA.x + cheekB.x) * 0.5 || noseTip.x);
          const faceY = (forehead.y + chin.y) * 0.5;
          const faceW = Math.max(0.12, Math.abs(cheekA.x - cheekB.x));
          const faceH = Math.max(0.16, Math.abs(chin.y - forehead.y));

          // Extract jawOpen blendshape (with geometric lip gap fallback)
          let jawOpen = 0;
          const cats = res.faceBlendshapes?.[0]?.categories;
          if (Array.isArray(cats)) {
            const jawCat = cats.find((c) => c.categoryName === 'jawOpen');
            if (jawCat) jawOpen = jawCat.score;
          }
          const lipGapNorm = Math.abs(botLip.y - topLip.y) / Math.max(0.12, faceH);
          const geoJaw = Math.max(0, Math.min(1, (lipGapNorm - 0.03) / 0.16));
          jawOpen = Math.max(jawOpen, geoJaw);

          this.lastResult = {
            detected: true,
            mouthX,
            mouthY,
            jawOpen,
            faceX,
            faceY,
            faceW,
            faceH
          };
        } else {
          this.lastResult = null;
        }
      } catch (e) {
        // Ignore transient frame inference hiccups
      }
    }
    return this.lastResult;
  }
}
