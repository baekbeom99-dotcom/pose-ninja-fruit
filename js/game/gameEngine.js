/**
 * Game Engine - 60 FPS Multi-Layer Canvas Orchestrator
 * Coordinates rendering pipeline, physics delta-time, camera video, state machine,
 * Ultimate Move Consonant Gestures, and Random Visual Themes.
 */
import { CONFIG } from '../config.js';
import { BladeManager } from './bladeManager.js';
import { FruitManager } from './fruitManager.js';
import { ParticleSystem } from './particleSystem.js';
import { GestureDetector, CONSONANT_POSES } from './gestureDetector.js';
import { soundManager } from '../audio/soundManager.js';

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
    this.gestureDetector = new GestureDetector();

    this.state = GameState.READY;
    this.score = 0;
    this.lives = CONFIG.GAME.START_LIVES;

    // Ultimate Move System
    this.ultimateThreshold = CONFIG.GAME.ULTIMATE_THRESHOLD || 10;
    this.ultimateCount = 0;
    this.isUltimateReady = false;
    this.currentConsonantPose = CONSONANT_POSES[0];

    // Visual Theme
    this.currentTheme = CONFIG.THEMES[0];

    this.lastTime = performance.now();
    this.width = CONFIG.CANVAS.WIDTH;
    this.height = CONFIG.CANVAS.HEIGHT;

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

      // Charge Ultimate Move
      if (!this.isUltimateReady) {
        this.ultimateCount++;
        if (this.ultimateCount >= this.ultimateThreshold) {
          this.isUltimateReady = true;
          soundManager.playUltimateReady();
          this.triggerScreenShake(0.2, 8);
        }
        this.ui.updateUltimateGauge(
          this.ultimateCount,
          this.ultimateThreshold,
          this.isUltimateReady,
          this.currentConsonantPose
        );
      }
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
      this.triggerScreenShake(0.65, 24);
      this.lives = 0;
      this.ui.updateLives(0, CONFIG.GAME.MAX_LIVES);
      this.triggerGameOver();
    };

    this.fruitManager.onHeart = (item, hitPoint) => {
      if (this.state !== GameState.PLAYING) return;
      if (this.lives < CONFIG.GAME.MAX_LIVES) {
        this.lives++;
        this.ui.updateLives(this.lives, CONFIG.GAME.MAX_LIVES);
      }
      this.score += item.points || 5;
      this.ui.updateScore(this.score);
      this.ui.showHeal();
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

  /**
   * Resets and initializes new game with a random visual theme and random target consonant
   */
  startNewGame() {
    this.score = 0;
    this.lives = CONFIG.GAME.START_LIVES;
    this.ui.updateScore(0);
    this.ui.updateLives(this.lives, CONFIG.GAME.MAX_LIVES);

    // 1. Pick Random Visual Theme
    const themeIdx = Math.floor(Math.random() * CONFIG.THEMES.length);
    this.currentTheme = CONFIG.THEMES[themeIdx];
    this.fruitManager.setTheme(this.currentTheme.id);
    this.ui.setThemeBadge(this.currentTheme);

    // 2. Reset Ultimate Move & Pick Random Consonant Pose
    this.ultimateCount = 0;
    this.isUltimateReady = false;
    this._pickRandomConsonantPose();
    this.gestureDetector.reset();
    this.ui.updateChargingProgress(0);
    this.ui.updateUltimateGauge(0, this.ultimateThreshold, false, this.currentConsonantPose);

    this.fruitManager.reset();
    this.particles.clear();
    this.state = GameState.PLAYING;
    this.ui.hideStartModal();
    this.ui.hideGameOverModal();
  }

  _pickRandomConsonantPose() {
    const randIdx = Math.floor(Math.random() * CONSONANT_POSES.length);
    this.currentConsonantPose = CONSONANT_POSES[randIdx];
  }

  /**
   * Triggers the Ultimate Consonant Fullscreen Slash!
   */
  activateUltimateMove() {
    this.isUltimateReady = false;
    this.ultimateCount = 0;

    // Visual & Sound Spectacle
    soundManager.playUltimateTrigger();
    this.particles.createUltimateScreenSlashes(this.width, this.height, this.currentConsonantPose.color);
    this.triggerScreenShake(0.8, 30);
    this.ui.showUltimateBanner(this.currentConsonantPose.name);

    // Wipe out all fruits on screen!
    this.fruitManager.sliceAllFruits();

    // Select new random consonant pose for next round
    this._pickRandomConsonantPose();
    this.gestureDetector.reset();
    this.ui.updateChargingProgress(0);
    this.ui.updateUltimateGauge(0, this.ultimateThreshold, false, this.currentConsonantPose);
  }

  triggerGameOver() {
    this.state = GameState.GAMEOVER;
    this.ui.showGameOverModal(this.score);
  }

  startLoop() {
    const loop = (currentTime) => {
      const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
      this.lastTime = currentTime;

      this.update(dt, currentTime);
      this.render();

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  update(dt, currentTime) {
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

    // 2. Evaluate Consonant Pose for Ultimate Move if Ready
    if (this.state === GameState.PLAYING && this.isUltimateReady && landmarks) {
      const evalResult = this.gestureDetector.evaluate(
        this.currentConsonantPose.id,
        landmarks,
        dt,
        CONFIG.CANVAS.MIRROR
      );

      this.ui.updateChargingProgress(evalResult.progress);

      if (evalResult.triggered) {
        this.activateUltimateMove();
      }
    } else {
      this.ui.updateChargingProgress(0);
    }

    // 3. Update Blade Tracker
    this.blades.update(landmarks, this.width, this.height, currentTime, CONFIG.CANVAS.MIRROR);

    // 4. Update Game & Fruits
    if (this.state === GameState.PLAYING) {
      const activeSegments = this.blades.getActiveSegments();
      this.fruitManager.update(dt, activeSegments, this.width, this.height, currentTime, this.lives);
    } else {
      this.particles.update(dt);
    }

    this.lastLandmarks = landmarks;
  }

  render() {
    const w = this.width;
    const h = this.height;

    let offsetX = 0;
    let offsetY = 0;
    if (this.shakeIntensity > 0) {
      offsetX = (Math.random() - 0.5) * this.shakeIntensity;
      offsetY = (Math.random() - 0.5) * this.shakeIntensity;
    }

    // Layer 1: Background Video & Skeleton
    this.bgCtx.clearRect(0, 0, w, h);
    if (this.video.readyState >= 2) {
      this.bgCtx.save();
      this.bgCtx.translate(w, 0);
      this.bgCtx.scale(-1, 1);
      this.bgCtx.drawImage(this.video, 0, 0, w, h);
      this.bgCtx.restore();
    }

    if (this.lastLandmarks) {
      this.poseTracker.drawSkeleton(this.bgCtx, this.lastLandmarks, w, h, CONFIG.CANVAS.MIRROR);
    }

    // Layer 2: Game Objects (Fruits, Halves, Splatters, Shockwaves, Lightning)
    this.gameCtx.clearRect(0, 0, w, h);
    this.gameCtx.save();
    if (offsetX !== 0 || offsetY !== 0) {
      this.gameCtx.translate(offsetX, offsetY);
    }
    this.fruitManager.draw(this.gameCtx);
    this.gameCtx.restore();

    // Layer 3: Radiant Neon Blade Trails
    this.bladeCtx.clearRect(0, 0, w, h);
    this.blades.draw(this.bladeCtx);
  }
}
