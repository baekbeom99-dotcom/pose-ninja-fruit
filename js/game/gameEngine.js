/**
 * Game Engine - 60 FPS Multi-Layer Canvas Orchestrator
 * Coordinates rendering pipeline, physics delta-time, camera video, and state machine
 */
import { CONFIG } from '../config.js';
import { BladeManager } from './bladeManager.js';
import { FruitManager } from './fruitManager.js';
import { ParticleSystem } from './particleSystem.js';

export const GameState = {
  READY: 'READY',
  PLAYING: 'PLAYING',
  GAMEOVER: 'GAMEOVER'
};

export class GameEngine {
  constructor(videoElement, bgCanvas, gameCanvas, bladeCanvas, poseTracker, uiManager) {
    this.video = videoElement;
    this.bgCanvas = bgCanvas;
    this.gameCanvas = gameCanvas;
    this.bladeCanvas = bladeCanvas;

    this.bgCtx = bgCanvas.getContext('2d');
    this.gameCtx = gameCanvas.getContext('2d');
    this.bladeCtx = bladeCanvas.getContext('2d');

    this.poseTracker = poseTracker;
    this.ui = uiManager;

    this.particles = new ParticleSystem();
    this.blades = new BladeManager();
    this.fruitManager = new FruitManager(this.particles);

    this.state = GameState.READY;
    this.score = 0;
    this.lives = CONFIG.GAME.START_LIVES;

    this.lastTime = performance.now();
    this.width = CONFIG.CANVAS.WIDTH;
    this.height = CONFIG.CANVAS.HEIGHT;

    // Screen Shake Effect for Bomb explosions
    this.shakeDuration = 0;
    this.shakeIntensity = 0;

    this._bindFruitCallbacks();
    this._setupResizeHandler();
  }

  _bindFruitCallbacks() {
    this.fruitManager.onScore = (points, fruit, hitPoint) => {
      if (this.state !== GameState.PLAYING) return;
      this.score += points;
      this.ui.updateScore(this.score);
    };

    this.fruitManager.onMiss = (fruit) => {
      if (this.state !== GameState.PLAYING) return;
      this.lives = Math.max(0, this.lives - 1);
      this.ui.updateLives(this.lives, CONFIG.GAME.MAX_LIVES);

      if (this.lives <= 0) {
        this.triggerGameOver();
      }
    };

    this.fruitManager.onBomb = (bomb) => {
      if (this.state !== GameState.PLAYING) return;
      this.triggerScreenShake(0.6, 22);
      this.lives = 0;
      this.ui.updateLives(0, CONFIG.GAME.MAX_LIVES);
      this.triggerGameOver();
    };

    this.fruitManager.onCombo = (count, bonus) => {
      if (this.state !== GameState.PLAYING) return;
      this.ui.showCombo(count, bonus);
    };
  }

  _setupResizeHandler() {
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.width = w;
      this.height = h;

      [this.bgCanvas, this.gameCanvas, this.bladeCanvas].forEach(c => {
        c.width = w;
        c.height = h;
      });

      CONFIG.CANVAS.WIDTH = w;
      CONFIG.CANVAS.HEIGHT = h;
    };

    window.addEventListener('resize', resize);
    resize();
  }

  triggerScreenShake(duration = 0.5, intensity = 18) {
    this.shakeDuration = duration;
    this.shakeIntensity = intensity;
  }

  startNewGame() {
    this.score = 0;
    this.lives = CONFIG.GAME.START_LIVES;
    this.ui.updateScore(0);
    this.ui.updateLives(this.lives, CONFIG.GAME.MAX_LIVES);
    this.fruitManager.reset();
    this.particles.clear();
    this.state = GameState.PLAYING;
    this.ui.hideStartModal();
    this.ui.hideGameOverModal();
  }

  triggerGameOver() {
    this.state = GameState.GAMEOVER;
    this.ui.showGameOverModal(this.score);
  }

  /**
   * Main 60 FPS RequestAnimationFrame Loop
   */
  startLoop() {
    const loop = (currentTime) => {
      const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1); // clamp max dt to 100ms
      this.lastTime = currentTime;

      this.update(dt, currentTime);
      this.render();

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  update(dt, currentTime) {
    // Screen shake update
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      if (this.shakeDuration <= 0) {
        this.shakeIntensity = 0;
      }
    }

    // 1. MediaPipe Pose Detection
    let landmarks = null;
    if (this.poseTracker && this.video.readyState >= 2) {
      landmarks = this.poseTracker.detect(this.video, currentTime);
    }

    // 2. Update Blade Tracker
    this.blades.update(landmarks, this.width, this.height, currentTime, CONFIG.CANVAS.MIRROR);

    // 3. Update Game & Fruits if currently playing
    if (this.state === GameState.PLAYING) {
      const activeSegments = this.blades.getActiveSegments();
      this.fruitManager.update(dt, activeSegments, this.width, this.height, currentTime);
    } else {
      // Just update particles when not in playing state
      this.particles.update(dt);
    }

    this.lastLandmarks = landmarks;
  }

  render() {
    const w = this.width;
    const h = this.height;

    // Apply screen shake to game canvas
    let offsetX = 0;
    let offsetY = 0;
    if (this.shakeIntensity > 0) {
      offsetX = (Math.random() - 0.5) * this.shakeIntensity;
      offsetY = (Math.random() - 0.5) * this.shakeIntensity;
    }

    // --- Layer 1: Background Video & Skeleton ---
    this.bgCtx.clearRect(0, 0, w, h);
    if (this.video.readyState >= 2) {
      this.bgCtx.save();
      // Mirror video horizontally
      this.bgCtx.translate(w, 0);
      this.bgCtx.scale(-1, 1);
      this.bgCtx.drawImage(this.video, 0, 0, w, h);
      this.bgCtx.restore();
    }

    // Draw neon skeleton
    if (this.lastLandmarks) {
      this.poseTracker.drawSkeleton(this.bgCtx, this.lastLandmarks, w, h, CONFIG.CANVAS.MIRROR);
    }

    // --- Layer 2: Game Objects (Fruits, Halves, Splatters, Juice) ---
    this.gameCtx.clearRect(0, 0, w, h);
    this.gameCtx.save();
    if (offsetX !== 0 || offsetY !== 0) {
      this.gameCtx.translate(offsetX, offsetY);
    }
    this.fruitManager.draw(this.gameCtx);
    this.gameCtx.restore();

    // --- Layer 3: Neon Blade Trails ---
    this.bladeCtx.clearRect(0, 0, w, h);
    this.blades.draw(this.bladeCtx);
  }
}
