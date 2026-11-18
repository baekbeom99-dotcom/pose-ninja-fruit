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
    this.changeModeBtn = document.getElementById('change-mode-btn');

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

    if (this.changeModeBtn) {
      this.changeModeBtn.addEventListener('click', () => {
        soundManager.init();
        soundManager.resume();
        soundManager.playSwish();
        this.gameEngine.stopGameAndReset();
        this.ui.showStartModal();
      });
    }
  }

  /**
   * Allows mouse / touch drag to simulate a blade if webcam is unavailable or in addition
   */
  _setupMouseTouchFallback() {
    let isDown = false;

    const handlePointerMove = (x, y) => {
      // In Galaga / Poop Dodge modes, mouse position maps to head position (even without dragging)
      if (
        this.gameEngine &&
        (this.gameEngine.gameMode === 'GALAGA' || this.gameEngine.gameMode === 'POOP_DODGE')
      ) {
        const normalizedX = 1.0 - (x / Math.max(1, this.gameEngine.width));
        this.gameEngine.lastHeadPose = { x: normalizedX, y: y / Math.max(1, this.gameEngine.height) };
      }

      if (this.gameEngine && this.gameEngine.gameMode === 'UMBRELLA') {
        this.gameEngine.umbrellaEngine.setPointerFallback(x, y, true);
      }

      if (this.gameEngine && this.gameEngine.gameMode === 'BREAKOUT') {
        this.gameEngine.breakoutEngine.setPointerX(x);
      }

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

    window.addEventListener('keydown', (e) => {
      if (this.gameEngine && this.gameEngine.gameMode === 'RED_LIGHT' && this.gameEngine.state === 'PLAYING') {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
          e.preventDefault();
          this.gameEngine.redLightEngine.triggerManualStep();
        }
      }
      if (this.gameEngine && this.gameEngine.gameMode === 'BREAKOUT' && this.gameEngine.state === 'PLAYING') {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          this.gameEngine.breakoutEngine.adjustManualAngle(-0.08);
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          this.gameEngine.breakoutEngine.adjustManualAngle(0.08);
        } else if (e.code === 'Space') {
          e.preventDefault();
          this.gameEngine.breakoutEngine.launchStuckBalls();
        }
      }
    });

    window.addEventListener('wheel', (e) => {
      if (this.gameEngine && this.gameEngine.gameMode === 'BREAKOUT' && this.gameEngine.state === 'PLAYING') {
        this.gameEngine.breakoutEngine.adjustManualAngle(Math.sign(e.deltaY) * 0.06);
      }
    }, { passive: true });

    window.addEventListener('mousedown', (e) => {
      // In Crossy mode, a tap/click triggers a forward hop cleanly
      if (this.gameEngine && this.gameEngine.gameMode === 'CROSSY' && this.gameEngine.state === 'PLAYING') {
        if (!e.target.closest('button')) {
          this.gameEngine.crossyEngine.triggerHop('CLICK');
        }
        return;
      }
      // In Red Light mode, tap/click simulates a running step or Manse tag
      if (this.gameEngine && this.gameEngine.gameMode === 'RED_LIGHT' && this.gameEngine.state === 'PLAYING') {
        if (!e.target.closest('button')) {
          this.gameEngine.redLightEngine.triggerManualStep();
        }
        return;
      }
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
      if (this.gameEngine && this.gameEngine.gameMode === 'CROSSY' && this.gameEngine.state === 'PLAYING') {
        if (!e.target.closest('button')) {
          this.gameEngine.crossyEngine.triggerHop('TOUCH');
        }
        return;
      }
      if (this.gameEngine && this.gameEngine.gameMode === 'RED_LIGHT' && this.gameEngine.state === 'PLAYING') {
        if (!e.target.closest('button')) {
          this.gameEngine.redLightEngine.triggerManualStep();
        }
        return;
      }
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
