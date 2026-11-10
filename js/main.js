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

    // 4. Add Mouse & Touch fallback interaction
    this._setupMouseTouchFallback();

    // 5. Connect Camera first
    let cameraConnected = false;
    try {
      this.ui.setStatus('카메라 연결 요청 중...', false);
      await this.camera.start();
      cameraConnected = true;
      this.ui.setStatus('카메라 연결 성공. AI 모션 인식 모델 로드 중...', false);
    } catch (camErr) {
      console.warn('Camera access failed:', camErr);
      this.ui.setStatus('카메라가 연결되지 않았습니다. 마우스/터치로 플레이할 수 있습니다.', false);
    }

    // 6. Initialize MediaPipe PoseLandmarker
    try {
      await this.poseTracker.init((statusMsg) => {
        this.ui.setStatus(statusMsg, false);
      });
      this.ui.setStatus('준비 완료! 시작 버튼을 눌러주세요.', true);
    } catch (modelErr) {
      console.error('MediaPipe PoseLandmarker initialization failed:', modelErr);
      if (cameraConnected) {
        this.ui.setStatus('AI 모델 로드 실패. 마우스/터치로 플레이할 수 있습니다.', true);
      } else {
        this.ui.setStatus('마우스 또는 터치로 플레이할 수 있습니다.', true);
      }
    }
  }

  _setupEventListeners() {
    const unlockAudioAndStart = () => {
      soundManager.init();
      soundManager.resume();
      this.gameEngine.startNewGame(this.ui.isTwoPlayer, this.ui.selectedGameMode);
    };

    if (this.startBtn) {
      this.startBtn.addEventListener('click', unlockAudioAndStart);
    }

    if (this.restartBtn) {
      this.restartBtn.addEventListener('click', unlockAudioAndStart);
    }
  }

  /**
   * Allows mouse / touch drag to simulate a blade if webcam is unavailable or in addition
   */
  _setupMouseTouchFallback() {
    let isDown = false;

    const handlePointerMove = (x, y) => {
      if (!isDown) return;
      const now = performance.now();
      // Inject into P1 Right Blade as pointer emulation
      this.gameEngine.blades.p1RightBlade.update({ x, y }, now);

      // In Doctor Strange mode without webcam, provide left hand anchor for mouse testing
      if (this.gameEngine && this.gameEngine.gameMode === 'DOCTOR_STRANGE') {
        const lx = this.gameEngine.width * 0.25;
        const ly = this.gameEngine.height * 0.5;
        this.gameEngine.blades.p1LeftBlade.update({ x: lx, y: ly }, now);
      }
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
      this.gameEngine.blades.p1RightBlade.update(null, performance.now());
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
      this.gameEngine.blades.p1RightBlade.update(null, performance.now());
    });
  }
}

// Bootstrap on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
