/**
 * Neon Blade Tracker and Trail Motion System
 * Manages dual-hand tracking, EMA smoothing, velocity calculation, and glowing blade trails
 */
import { CONFIG } from '../config.js';
import { soundManager } from '../audio/soundManager.js';

class Blade {
  constructor(name, colors) {
    this.name = name;
    this.colors = colors;
    this.history = []; // Array of {x, y, time}
    this.currentPos = null;
    this.previousPos = null;
    this.smoothedPos = null;
    this.velocity = 0;
    this.isActive = false;
    this.lastActiveTime = 0;
    this.wasActive = false;
  }

  /**
   * Updates blade position with EMA filter & calculates velocity
   * @param {{x: number, y: number}|null} rawPos - Screen pixel coordinate
   * @param {number} currentTime - Milliseconds
   */
  update(rawPos, currentTime) {
    if (!rawPos) {
      // Fade out trail if tracking is lost
      if (this.history.length > 0) {
        this.history.shift();
      }
      this.isActive = false;
      this.wasActive = false;
      return;
    }

    // Apply Exponential Moving Average (EMA)
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

    // Add to history
    this.history.push({
      x: this.currentPos.x,
      y: this.currentPos.y,
      time: currentTime
    });

    // Prune history to max length and expire older points (> 150ms)
    while (
      this.history.length > CONFIG.BLADE.TRAIL_LENGTH ||
      (this.history.length > 2 && currentTime - this.history[0].time > 160)
    ) {
      this.history.shift();
    }

    // Calculate instantaneous velocity over recent frames
    if (this.history.length >= 3) {
      const oldest = this.history[0];
      const newest = this.history[this.history.length - 1];
      const dt = (newest.time - oldest.time) / 1000; // in seconds

      if (dt > 0.015) {
        const dx = newest.x - oldest.x;
        const dy = newest.y - oldest.y;
        this.velocity = Math.sqrt(dx * dx + dy * dy) / dt;
      }
    } else {
      this.velocity = 0;
    }

    // Determine active slicing state
    this.isActive = this.velocity >= CONFIG.BLADE.MIN_VELOCITY_TO_SLICE;

    // Trigger swish sound on high-speed entry
    if (this.isActive && !this.wasActive && currentTime - this.lastActiveTime > 280) {
      soundManager.playSwish();
      this.lastActiveTime = currentTime;
    }
    this.wasActive = this.isActive;
  }

  /**
   * Returns current slicing line segment {p1, p2} if active
   */
  getSegment() {
    if (!this.isActive || !this.previousPos || !this.currentPos) return null;
    return {
      p1: this.previousPos,
      p2: this.currentPos,
      bladeName: this.name
    };
  }

  /**
   * Draws smooth neon blade trail using quadratic curves
   */
  draw(ctx) {
    if (this.history.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Outer Glow (Screen/Lighter blend)
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = this.isActive ? 20 : 8;
    ctx.shadowColor = this.colors.GLOW;
    ctx.strokeStyle = this.colors.GLOW;

    for (let i = 0; i < this.history.length - 1; i++) {
      const p1 = this.history[i];
      const p2 = this.history[i + 1];
      const progress = (i + 1) / this.history.length; // 0 to 1

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineWidth = progress * (this.isActive ? 16 : 7);
      ctx.stroke();
    }

    // 2. Bright Inner Core
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#ffffff';
    ctx.strokeStyle = this.colors.CORE;

    for (let i = 0; i < this.history.length - 1; i++) {
      const p1 = this.history[i];
      const p2 = this.history[i + 1];
      const progress = (i + 1) / this.history.length;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineWidth = progress * (this.isActive ? 6 : 2.5);
      ctx.stroke();
    }

    // 3. Leading blade tip marker
    if (this.currentPos) {
      ctx.beginPath();
      ctx.arc(this.currentPos.x, this.currentPos.y, this.isActive ? 10 : 6, 0, Math.PI * 2);
      ctx.fillStyle = this.colors.CORE;
      ctx.fill();
    }

    ctx.restore();
  }
}

export class BladeManager {
  constructor() {
    this.leftBlade = new Blade('LEFT', CONFIG.BLADE.COLORS.LEFT);
    this.rightBlade = new Blade('RIGHT', CONFIG.BLADE.COLORS.RIGHT);
  }

  /**
   * Updates blade tracking from MediaPipe landmarks
   * Left: #19 (Index) or #15 (Wrist)
   * Right: #20 (Index) or #16 (Wrist)
   */
  update(landmarks, canvasWidth, canvasHeight, currentTime, mirror = true) {
    let leftPt = null;
    let rightPt = null;

    if (landmarks && landmarks.length > 20) {
      // Prefer index finger tip (19/20), fallback to wrist (15/16)
      const lIndex = landmarks[19];
      const lWrist = landmarks[15];
      const lTarget = (lIndex && lIndex.visibility > 0.4) ? lIndex : lWrist;

      if (lTarget && (lTarget.visibility === undefined || lTarget.visibility > 0.35)) {
        leftPt = {
          x: mirror ? (1 - lTarget.x) * canvasWidth : lTarget.x * canvasWidth,
          y: lTarget.y * canvasHeight
        };
      }

      const rIndex = landmarks[20];
      const rWrist = landmarks[16];
      const rTarget = (rIndex && rIndex.visibility > 0.4) ? rIndex : rWrist;

      if (rTarget && (rTarget.visibility === undefined || rTarget.visibility > 0.35)) {
        rightPt = {
          x: mirror ? (1 - rTarget.x) * canvasWidth : rTarget.x * canvasWidth,
          y: rTarget.y * canvasHeight
        };
      }
    }

    this.leftBlade.update(leftPt, currentTime);
    this.rightBlade.update(rightPt, currentTime);
  }

  /**
   * Gets all active slicing line segments for collision testing
   */
  getActiveSegments() {
    const segments = [];
    const leftSeg = this.leftBlade.getSegment();
    if (leftSeg) segments.push(leftSeg);

    const rightSeg = this.rightBlade.getSegment();
    if (rightSeg) segments.push(rightSeg);

    return segments;
  }

  draw(ctx) {
    this.leftBlade.draw(ctx);
    this.rightBlade.draw(ctx);
  }
}
