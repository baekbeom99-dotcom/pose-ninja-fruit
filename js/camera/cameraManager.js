/**
 * Camera Manager - Manages Webcam & Mobile Front Camera Stream
 */
export class CameraManager {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
    this.isReady = false;
  }

  /**
   * Starts user-facing webcam / mobile camera
   */
  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('이 브라우저에서는 카메라(getUserMedia)를 지원하지 않거나 HTTPS 환경이 아닙니다.');
    }

    const constraints = {
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;

      return new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play().then(() => {
            this.isReady = true;
            resolve({
              videoWidth: this.video.videoWidth,
              videoHeight: this.video.videoHeight
            });
          });
        };
      });
    } catch (err) {
      console.error('Camera access failed:', err);
      throw err;
    }
  }

  /**
   * Stops the camera stream
   */
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
      this.isReady = false;
    }
  }
}
