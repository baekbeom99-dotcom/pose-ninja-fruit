/**
 * Main Application Bootstrap - Pose Ninja Fruit
 */
import { CameraManager } from './camera/cameraManager.js';
import { PoseTracker } from './camera/poseTracker.js';
import { UIManager } from './ui/uiManager.js';
import { GameEngine } from './game/gameEngine.js';
import { soundManager } from './audio/soundManager.js';

class App {
  constructor() {
    this.video = document.getElementById('webcam-video');
    this.bgCanvas = document.getElementById('bg-canvas');
    this.gameCanvas = document.getElementById('game-canvas');
    this.bladeCanvas = document.getElementById('blade-canvas');

    this.startBtn = document.getElementById('start-btn');
    this.restartBtn = document.getElementById('restart-btn');

    this.ui = new UIManager();
    this.camera = new CameraManager(this.video);
    this.poseTracker = new PoseTracker();
    this.gameEngine = null;
  }

  async init() {
    this.ui.setStatus('카메라 및 AI 모델 로드 중...', false);

    // 1. Initialize GameEngine
    this.gameEngine = new GameEngine(
      this.video,
      this.bgCanvas,
      this.gameCanvas,
      this.bladeCanvas,
      this.poseTracker,
      this.ui
    );

    // 2. Start Game Loop immediately
    this.gameEngine.startLoop();

    // 3. Setup Button Listeners & Web Audio unlock
    this._setupEventListeners();

    // 4. Initialize Camera & MediaPipe in parallel
    try {
      this.ui.setStatus('웹캠 권한 요청 중...', false);
      await this.camera.start();

      this.ui.setStatus('MediaPipe Pose 모델 초기화 중...', false);
      await this.poseTracker.init((statusMsg) => {
        this.ui.setStatus(statusMsg, false);
      });

      this.ui.setStatus('준비 완료! 시작 버튼을 눌러주세요.', true);
    } catch (err) {
      console.warn('Camera / MediaPipe setup failed or blocked:', err);
      this.ui.setStatus(
        '카메라를 찾을 수 없거나 차단되었습니다. 마우스/터치로도 플레이할 수 있습니다!',
        true
      );
    }

    // 5. Add Mouse & Touch fallback interaction
    this._setupMouseTouchFallback();
  }

  _setupEventListeners() {
    const unlockAudioAndStart = () => {
      soundManager.init();
      soundManager.resume();
      this.gameEngine.startNewGame();
    };

    if (this.startBtn) {
      this.startBtn.addEventListener('click', unlockAudioAndStart);
    }

    if (this.restartBtn) {
      this.restartBtn.addEventListener('click', unlockAudioAndStart);
    }
  }

  /**
   * Allows mouse / touch drag to simulate a blade if webcam is unavailable
   */
  _setupMouseTouchFallback() {
    let isDown = false;

    const handlePointerMove = (x, y) => {
      if (!isDown) return;
      const now = performance.now();
      // Inject into Right Blade as pointer emulation
      this.gameEngine.blades.rightBlade.update({ x, y }, now);
    };

    window.addEventListener('mousedown', (e) => {
      isDown = true;
      handlePointerMove(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      handlePointerMove(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      isDown = false;
      this.gameEngine.blades.rightBlade.update(null, performance.now());
    });

    // Touch support
    window.addEventListener('touchstart', (e) => {
      isDown = true;
      if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      isDown = false;
      this.gameEngine.blades.rightBlade.update(null, performance.now());
    });
  }
}

// Bootstrap on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
