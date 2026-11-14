/**
 * Game Engine - 60 FPS Multi-Layer Canvas Orchestrator
 * Coordinates rendering pipeline, physics delta-time, camera video, state machine,
 * Ultimate Move Consonant Gestures, Random Visual Themes, and 1P/2P Duo Mode.
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
    this.isTwoPlayerMode = false;
    this.gameMode = CONFIG.MODES.CLASSIC;
    this.p1Score = 0;
    this.p2Score = 0;
    this.lives = CONFIG.GAME.START_LIVES;

    // Ultimate Move System
    this.ultimateThreshold = CONFIG.GAME.ULTIMATE_THRESHOLD || 10;
    this.ultimateCount = 0;
    this.isUltimateReady = false;
    this.currentConsonantPose = CONSONANT_POSES[0];

    this.lastTime = performance.now();
    this.width = CONFIG.CANVAS.WIDTH;
    this.height = CONFIG.CANVAS.HEIGHT;

    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.lastPoses = null;

    this._bindFruitCallbacks();
    this._setupResizeHandler();
    this._bindUIExit();
  }

  _bindUIExit() {
    this.ui.onExitRequested = () => {
      this.stopGameAndReset();
    };
  }

  _bindFruitCallbacks() {
    this.fruitManager.onScore = (points, fruit, hitPoint, owner = 'P1') => {
      if (this.state !== GameState.PLAYING) return;

      if (this.isTwoPlayerMode && owner === 'P2') {
        this.p2Score += points;
      } else {
        this.p1Score += points;
      }

      this.ui.updateScores(this.p1Score, this.p2Score, this.isTwoPlayerMode);

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

    this.fruitManager.onBomb = (bomb, owner = 'P1') => {
      if (this.state !== GameState.PLAYING) return;
      this.triggerScreenShake(0.65, 24);
      this.lives = Math.max(0, this.lives - 2);
      this.ui.updateLives(this.lives, CONFIG.GAME.MAX_LIVES);
      if (this.lives <= 0) {
        this.triggerGameOver();
      }
    };

    this.fruitManager.onHeart = (item, hitPoint, owner = 'P1') => {
      if (this.state !== GameState.PLAYING) return;
      if (this.lives < CONFIG.GAME.MAX_LIVES) {
        this.lives++;
        this.ui.updateLives(this.lives, CONFIG.GAME.MAX_LIVES);
      }
      const points = item.points || 5;
      if (this.isTwoPlayerMode && owner === 'P2') {
        this.p2Score += points;
      } else {
        this.p1Score += points;
      }
      this.ui.updateScores(this.p1Score, this.p2Score, this.isTwoPlayerMode);
      this.ui.showHeal();
    };

    this.fruitManager.onCombo = (count, bonus, owner = 'P1') => {
      if (this.state !== GameState.PLAYING) return;
      this.ui.showCombo(count, bonus, owner);
    };

    this.fruitManager.onHeadingDefuse = (bomb, head, bonusPoints = 10) => {
      if (this.state !== GameState.PLAYING) return;
      this.triggerScreenShake(0.35, 14);
      this.ui.showHeadingDefuse(head.owner, bonusPoints);
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

  stopGameAndReset() {
    this.state = GameState.READY;
    this.p1Score = 0;
    this.p2Score = 0;
    this.fruitManager.reset();
    this.particles.clear();
    this.ui.updateScores(0, 0, this.isTwoPlayerMode);
    this.ui.updateChargingProgress(0);
    this.ui.updateUltimateGauge(0, this.ultimateThreshold, false, this.currentConsonantPose);
  }

  startNewGame(twoPlayer = false, gameMode = 'CLASSIC') {
    this.isTwoPlayerMode = !!twoPlayer;
    this.gameMode = gameMode || CONFIG.MODES.CLASSIC;
    this.p1Score = 0;
    this.p2Score = 0;
    this.lives = CONFIG.GAME.START_LIVES;

    const isDocStrange = this.gameMode === CONFIG.MODES.DOCTOR_STRANGE;
    this.blades.setMode(this.isTwoPlayerMode);
    this.blades.setDoctorStrangeMode(isDocStrange);
    this.fruitManager.setGameMode(this.gameMode);

    this.ui.updateHUDMode(this.isTwoPlayerMode, this.gameMode);
    this.ui.updateScores(0, 0, this.isTwoPlayerMode);
    this.ui.updateLives(this.lives, CONFIG.GAME.MAX_LIVES);

    // Reset Ultimate Move
    this.ultimateCount = 0;
    this.isUltimateReady = false;
    this._pickPoseForMode();
    this.gestureDetector.reset();
    this.ui.updateChargingProgress(0);
    this.ui.updateUltimateGauge(0, this.ultimateThreshold, false, this.currentConsonantPose);

    this.fruitManager.reset();
    this.particles.clear();
    this.state = GameState.PLAYING;
    this.ui.hideStartModal();
    this.ui.hideGameOverModal();
  }

  _pickPoseForMode() {
    if (this.gameMode === CONFIG.MODES.DOCTOR_STRANGE) {
      this.currentConsonantPose = CONSONANT_POSES.find(p => p.id === 'PORTAL') || CONSONANT_POSES[0];
    } else {
      const standardPoses = CONSONANT_POSES.filter(p => p.id !== 'PORTAL');
      const randIdx = Math.floor(Math.random() * standardPoses.length);
      this.currentConsonantPose = standardPoses[randIdx] || CONSONANT_POSES[0];
    }
  }

  activateUltimateMove(owner = 'P1') {
    this.isUltimateReady = false;
    this.ultimateCount = 0;

    soundManager.playUltimateTrigger();
    this.particles.createUltimateScreenSlashes(this.width, this.height, this.currentConsonantPose.color);
    this.triggerScreenShake(0.8, 30);
    this.ui.showUltimateBanner(this.currentConsonantPose.name, owner);

    this.fruitManager.sliceAllFruits(owner);

    this._pickPoseForMode();
    this.gestureDetector.reset();
    this.ui.updateChargingProgress(0);
    this.ui.updateUltimateGauge(0, this.ultimateThreshold, false, this.currentConsonantPose);
  }

  triggerGameOver() {
    this.state = GameState.GAMEOVER;
    this.ui.showGameOverModal(this.p1Score, this.p2Score, this.isTwoPlayerMode);
  }

  startLoop() {
    const loop = (currentTime) => {
      const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
      this.lastTime = currentTime;

      try {
        this.update(dt, currentTime);
        this.render();
      } catch (err) {
        console.error('Frame execution error:', err);
      }

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
    let poses = null;
    if (this.poseTracker && this.video.readyState >= 2) {
      poses = this.poseTracker.detect(this.video, currentTime);

      // STRICT 1-PLAYER ISOLATION: Never track or register second person if not in 2-Player mode!
      if (poses && !this.isTwoPlayerMode) {
        poses = poses.slice(0, 1);
      }
    }

    // 2. Update Blade Tracker with filtered poses first
    this.blades.update(poses, this.width, this.height, currentTime, CONFIG.CANVAS.MIRROR);

    // 3. Evaluate Consonant Pose for Ultimate Move if Ready
    if (this.state === GameState.PLAYING && this.isUltimateReady && poses && poses.length > 0) {
      let triggered = false;
      let maxProgress = 0;
      let triggeringOwner = 'P1';

      poses.forEach((lm, pIdx) => {
        const owner = pIdx === 0 ? 'P1' : 'P2';
        // If player is actively swinging blades to slice fruits, pose charging is paused
        const isSwinging = owner === 'P1'
          ? (this.blades.p1LeftBlade.isSwinging || this.blades.p1RightBlade.isSwinging)
          : (this.blades.p2LeftBlade.isSwinging || this.blades.p2RightBlade.isSwinging);

        const evalResult = this.gestureDetector.evaluate(
          this.currentConsonantPose.id,
          lm,
          dt,
          CONFIG.CANVAS.MIRROR,
          isSwinging
        );
        if (evalResult.progress > maxProgress) {
          maxProgress = evalResult.progress;
        }
        if (evalResult.triggered) {
          triggered = true;
          triggeringOwner = owner;
        }
      });

      this.ui.updateChargingProgress(maxProgress);

      if (triggered) {
        this.activateUltimateMove(triggeringOwner);
      }
    } else {
      this.ui.updateChargingProgress(0);
    }

    // 4. Update Particle FX (always update every frame so slashes, flashes, and splatters fade and clear)
    this.particles.update(dt);

    // 5. Update Game & Fruits
    if (this.state === GameState.PLAYING) {
      const activeSegments = this.blades.getActiveSegments();
      const headHitboxes = this.blades.getHeadHitboxes();
      this.fruitManager.update(dt, activeSegments, this.width, this.height, currentTime, this.lives, headHitboxes);
    }

    this.lastPoses = poses;
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

    // Layer 1: Background Video & Skeletons
    this.bgCtx.clearRect(0, 0, w, h);
    if (this.video.readyState >= 2) {
      this.bgCtx.save();
      this.bgCtx.translate(w, 0);
      this.bgCtx.scale(-1, 1);
      this.bgCtx.drawImage(this.video, 0, 0, w, h);
      this.bgCtx.restore();
    }

    if (this.lastPoses) {
      this.poseTracker.drawSkeletons(this.bgCtx, this.lastPoses, w, h, CONFIG.CANVAS.MIRROR);
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
