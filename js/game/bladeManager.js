/**
 * Neon Blade Tracker and Trail Motion System with Multi-Player Support
 * Manages dual-hand tracking for Player 1 and Player 2
 */
import { CONFIG } from '../config.js';
import { soundManager } from '../audio/soundManager.js';

class Blade {
  constructor(name, colors, owner = 'P1') {
    this.name = name;
    this.colors = colors;
    this.owner = owner;
    this.history = [];
    this.currentPos = null;
    this.previousPos = null;
    this.smoothedPos = null;
    this.velocity = 0;
    this.isActive = false;
    this.isSwinging = false;
    this.lastActiveTime = 0;
    this.wasSwinging = false;
  }

  update(rawPos, currentTime) {
    if (!rawPos) {
      if (this.history.length > 0) {
        this.history.shift();
      }
      this.currentPos = null;
      this.previousPos = null;
      this.smoothedPos = null;
      this.isActive = false;
      this.isSwinging = false;
      this.wasSwinging = false;
      return;
    }

    const alpha = CONFIG.BLADE.SMOOTHING_ALPHA;
    if (!this.smoothedPos) {
      this.smoothedPos = { x: rawPos.x, y: rawPos.y };
    } else {
      this.smoothedPos = {
        x: alpha * rawPos.x + (1 - alpha) * this.smoothedPos.x,
        y: alpha * rawPos.y + (1 - alpha) * this.smoothedPos.y
      };
    }

    this.previousPos = this.currentPos;
    this.currentPos = { x: this.smoothedPos.x, y: this.smoothedPos.y };

    this.history.push({
      x: this.currentPos.x,
      y: this.currentPos.y,
      time: currentTime
    });

    while (
      this.history.length > CONFIG.BLADE.TRAIL_LENGTH ||
      (this.history.length > 2 && currentTime - this.history[0].time > 190)
    ) {
      this.history.shift();
    }

    if (this.history.length >= 3) {
      const oldest = this.history[0];
      const newest = this.history[this.history.length - 1];
      const dt = (newest.time - oldest.time) / 1000;

      if (dt > 0.015) {
        const dx = newest.x - oldest.x;
        const dy = newest.y - oldest.y;
        this.velocity = Math.sqrt(dx * dx + dy * dy) / dt;
      }
    } else {
      this.velocity = 0;
    }

    // Touch slicing: Always active whenever the hand/touch point is tracked!
    this.isActive = true;
    this.isSwinging = this.velocity >= (CONFIG.BLADE.SWING_SOUND_VELOCITY || 160);

    if (this.isSwinging && !this.wasSwinging && currentTime - this.lastActiveTime > 260) {
      soundManager.playSwish();
      this.lastActiveTime = currentTime;
    }
    this.wasSwinging = this.isSwinging;
  }

  getSegment() {
    if (!this.isActive || !this.currentPos) return null;
    return {
      p1: this.previousPos || this.currentPos,
      p2: this.currentPos,
      bladeName: this.name,
      owner: this.owner
    };
  }

  draw(ctx) {
    if (!this.currentPos) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Outer Glow Trail
    if (this.history.length >= 2) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowBlur = this.isSwinging ? 28 : 16;
      ctx.shadowColor = this.colors.GLOW;
      ctx.strokeStyle = this.colors.GLOW;

      for (let i = 0; i < this.history.length - 1; i++) {
        const p1 = this.history[i];
        const p2 = this.history[i + 1];
        const progress = (i + 1) / this.history.length;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineWidth = progress * (this.isSwinging ? 24 : 12);
        ctx.stroke();
      }

      // Focused Stroke
      ctx.shadowBlur = this.isSwinging ? 14 : 8;
      ctx.shadowColor = this.colors.SPARK;
      ctx.strokeStyle = this.colors.SPARK;

      for (let i = 0; i < this.history.length - 1; i++) {
        const p1 = this.history[i];
        const p2 = this.history[i + 1];
        const progress = (i + 1) / this.history.length;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineWidth = progress * (this.isSwinging ? 14 : 6);
        ctx.stroke();
      }

      // Plasma Core
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#ffffff';
      ctx.strokeStyle = this.colors.CORE;

      for (let i = 0; i < this.history.length - 1; i++) {
        const p1 = this.history[i];
        const p2 = this.history[i + 1];
        const progress = (i + 1) / this.history.length;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineWidth = progress * (this.isSwinging ? 6 : 3);
        ctx.stroke();
      }
    }

    // Touch Slicing Cursor / Blade Tip Orb
    ctx.beginPath();
    ctx.arc(this.currentPos.x, this.currentPos.y, this.isSwinging ? 14 : 10, 0, Math.PI * 2);
    ctx.fillStyle = this.colors.CORE;
    ctx.shadowBlur = this.isSwinging ? 20 : 12;
    ctx.shadowColor = this.colors.GLOW;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.currentPos.x, this.currentPos.y, this.isSwinging ? 24 : 16, 0, Math.PI * 2);
    ctx.strokeStyle = this.colors.GLOW;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }
}

export class BladeManager {
  constructor() {
    // Player 1 Blades
    this.p1LeftBlade = new Blade('P1_LEFT', CONFIG.BLADE.COLORS.P1_LEFT, 'P1');
    this.p1RightBlade = new Blade('P1_RIGHT', CONFIG.BLADE.COLORS.P1_RIGHT, 'P1');

    // Player 2 Blades
    this.p2LeftBlade = new Blade('P2_LEFT', CONFIG.BLADE.COLORS.P2_LEFT, 'P2');
    this.p2RightBlade = new Blade('P2_RIGHT', CONFIG.BLADE.COLORS.P2_RIGHT, 'P2');

    this.isTwoPlayerMode = false;
  }

  setMode(twoPlayer = false) {
    this.isTwoPlayerMode = twoPlayer;
  }

  /**
   * Updates blade tracking from MediaPipe landmarks (supports array of poses for 1 or 2 players)
   */
  update(poses, canvasWidth, canvasHeight, currentTime, mirror = true) {
    const posesList = Array.isArray(poses) ? poses : (poses ? [poses] : []);
    const p1Pose = posesList[0] || null;
    const p2Pose = posesList[1] || null;

    // Update Player 1
    const p1Coords = this._extractWristCoords(p1Pose, canvasWidth, canvasHeight, mirror);
    this.p1LeftBlade.update(p1Coords.left, currentTime);
    this.p1RightBlade.update(p1Coords.right, currentTime);

    // Update Player 2 if in 2-Player mode
    if (this.isTwoPlayerMode) {
      const p2Coords = this._extractWristCoords(p2Pose, canvasWidth, canvasHeight, mirror);
      this.p2LeftBlade.update(p2Coords.left, currentTime);
      this.p2RightBlade.update(p2Coords.right, currentTime);
    } else {
      this.p2LeftBlade.update(null, currentTime);
      this.p2RightBlade.update(null, currentTime);
    }
  }

  _extractWristCoords(landmarks, canvasWidth, canvasHeight, mirror) {
    let left = null;
    let right = null;

    if (landmarks && landmarks.length > 20) {
      const lIndex = landmarks[19];
      const lWrist = landmarks[15];
      const lTarget = (lIndex && lIndex.visibility > 0.35) ? lIndex : lWrist;

      if (lTarget && (lTarget.visibility === undefined || lTarget.visibility > 0.3)) {
        left = {
          x: mirror ? (1 - lTarget.x) * canvasWidth : lTarget.x * canvasWidth,
          y: lTarget.y * canvasHeight
        };
      }

      const rIndex = landmarks[20];
      const rWrist = landmarks[16];
      const rTarget = (rIndex && rIndex.visibility > 0.35) ? rIndex : rWrist;

      if (rTarget && (rTarget.visibility === undefined || rTarget.visibility > 0.3)) {
        right = {
          x: mirror ? (1 - rTarget.x) * canvasWidth : rTarget.x * canvasWidth,
          y: rTarget.y * canvasHeight
        };
      }
    }

    return { left, right };
  }

  getActiveSegments() {
    const segments = [];
    const p1L = this.p1LeftBlade.getSegment();
    if (p1L) segments.push(p1L);
    const p1R = this.p1RightBlade.getSegment();
    if (p1R) segments.push(p1R);

    if (this.isTwoPlayerMode) {
      const p2L = this.p2LeftBlade.getSegment();
      if (p2L) segments.push(p2L);
      const p2R = this.p2RightBlade.getSegment();
      if (p2R) segments.push(p2R);
    }

    return segments;
  }

  draw(ctx) {
    this.p1LeftBlade.draw(ctx);
    this.p1RightBlade.draw(ctx);

    if (this.isTwoPlayerMode) {
      this.p2LeftBlade.draw(ctx);
      this.p2RightBlade.draw(ctx);
    }
  }
}
