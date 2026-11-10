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
    this.isDoctorStrangeMode = false;
    this.mandalaAngle = 0;
    this.headHitboxes = [];
  }

  setMode(twoPlayer = false) {
    this.isTwoPlayerMode = twoPlayer;
  }

  setDoctorStrangeMode(enabled = false) {
    this.isDoctorStrangeMode = enabled;
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

    // Extract Head Hitboxes for Bomb Heading Defense
    this.headHitboxes = [];
    if (p1Pose) {
      const h1 = this._extractHead(p1Pose, canvasWidth, canvasHeight, mirror, 0);
      if (h1) this.headHitboxes.push(h1);
    }

    // Update Player 2 if in 2-Player mode
    if (this.isTwoPlayerMode) {
      const p2Coords = this._extractWristCoords(p2Pose, canvasWidth, canvasHeight, mirror);
      this.p2LeftBlade.update(p2Coords.left, currentTime);
      this.p2RightBlade.update(p2Coords.right, currentTime);

      if (p2Pose) {
        const h2 = this._extractHead(p2Pose, canvasWidth, canvasHeight, mirror, 1);
        if (h2) this.headHitboxes.push(h2);
      }
    } else {
      this.p2LeftBlade.update(null, currentTime);
      this.p2RightBlade.update(null, currentTime);
    }
  }

  _extractHead(landmarks, canvasWidth, canvasHeight, mirror, playerIdx) {
    if (!landmarks || landmarks.length === 0) return null;
    const nose = landmarks[0];
    if (!nose || (nose.visibility !== undefined && nose.visibility < 0.25)) return null;

    // Use nose and eye landmarks to find forehead center
    const leftEye = landmarks[2] || landmarks[1];
    const rightEye = landmarks[5] || landmarks[4];
    const avgEyeY = (leftEye && rightEye) ? (leftEye.y + rightEye.y) * 0.5 : nose.y;
    // Forehead is slightly above eyes
    const headNormY = Math.min(nose.y, avgEyeY) - 0.045;
    const headNormX = nose.x;

    const x = mirror ? (1 - headNormX) * canvasWidth : headNormX * canvasWidth;
    const y = Math.max(20, headNormY * canvasHeight);

    return {
      x,
      y,
      radius: 64, // Generous head contact radius
      owner: playerIdx === 0 ? 'P1' : 'P2'
    };
  }

  getHeadHitboxes() {
    return this.headHitboxes;
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

    // Doctor Strange Mode: Laser blade line segment connecting Left Hand and Right Hand!
    if (this.isDoctorStrangeMode && this.p1LeftBlade.currentPos && this.p1RightBlade.currentPos) {
      segments.push({
        p1: this.p1LeftBlade.currentPos,
        p2: this.p1RightBlade.currentPos,
        bladeName: 'DOCTOR_STRANGE_BEAM_P1',
        owner: 'P1'
      });
    }

    if (this.isTwoPlayerMode) {
      const p2L = this.p2LeftBlade.getSegment();
      if (p2L) segments.push(p2L);
      const p2R = this.p2RightBlade.getSegment();
      if (p2R) segments.push(p2R);

      if (this.isDoctorStrangeMode && this.p2LeftBlade.currentPos && this.p2RightBlade.currentPos) {
        segments.push({
          p1: this.p2LeftBlade.currentPos,
          p2: this.p2RightBlade.currentPos,
          bladeName: 'DOCTOR_STRANGE_BEAM_P2',
          owner: 'P2'
        });
      }
    }

    return segments;
  }

  draw(ctx) {
    this.mandalaAngle += 0.05;

    // In Doctor Strange Mode, draw connecting Eldritch magic energy rays & mandalas
    if (this.isDoctorStrangeMode) {
      if (this.p1LeftBlade.currentPos && this.p1RightBlade.currentPos) {
        this._drawDoctorStrangeBeam(ctx, this.p1LeftBlade.currentPos, this.p1RightBlade.currentPos, '#f59e0b', '#f97316');
      }
      if (this.isTwoPlayerMode && this.p2LeftBlade.currentPos && this.p2RightBlade.currentPos) {
        this._drawDoctorStrangeBeam(ctx, this.p2LeftBlade.currentPos, this.p2RightBlade.currentPos, '#ec4899', '#f43f5e');
      }

      // Draw Eldritch Mandalas at each active hand
      if (this.p1LeftBlade.currentPos) this._drawEldritchMandala(ctx, this.p1LeftBlade.currentPos, '#f59e0b', '#f97316');
      if (this.p1RightBlade.currentPos) this._drawEldritchMandala(ctx, this.p1RightBlade.currentPos, '#f59e0b', '#f97316');

      if (this.isTwoPlayerMode) {
        if (this.p2LeftBlade.currentPos) this._drawEldritchMandala(ctx, this.p2LeftBlade.currentPos, '#ec4899', '#f43f5e');
        if (this.p2RightBlade.currentPos) this._drawEldritchMandala(ctx, this.p2RightBlade.currentPos, '#ec4899', '#f43f5e');
      }
    }

    // Standard trail drawing
    this.p1LeftBlade.draw(ctx);
    this.p1RightBlade.draw(ctx);

    if (this.isTwoPlayerMode) {
      this.p2LeftBlade.draw(ctx);
      this.p2RightBlade.draw(ctx);
    }

    // Draw Head Shield / Header Defense Halo around active heads
    this.headHitboxes.forEach(h => this._drawHeadShield(ctx, h));
  }

  _drawHeadShield(ctx, head) {
    ctx.save();
    ctx.translate(head.x, head.y);

    const isP1 = head.owner === 'P1';
    const mainColor = isP1 ? '#38bdf8' : '#fb923c';
    const glowColor = isP1 ? 'rgba(56, 189, 248, 0.28)' : 'rgba(251, 146, 60, 0.28)';

    // Pulsing energy headband aura
    const pulse = Math.sin(Date.now() * 0.006) * 3;
    const r = head.radius + pulse;

    // Glowing protective arc over forehead
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI * 0.82, -Math.PI * 0.18);
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Floating Header badge
    ctx.fillStyle = mainColor;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚽ 헤딩', 0, -r - 6);

    ctx.restore();
  }

  /**
   * Draws fiery Doctor Strange Eldritch Beam between hands
   * Highly optimized: uses concentric additive GPU blending (zero-cost shadowBlur)
   */
  _drawDoctorStrangeBeam(ctx, p1, p2, glowColor, sparkColor) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 10) {
      ctx.restore();
      return;
    }

    // High-performance GPU-accelerated concentric glow passes (0 shadowBlur for solid 60 FPS!)
    // 1. Broad outer atmospheric energy halo
    ctx.strokeStyle = 'rgba(234, 88, 12, 0.22)';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // 2. Focused amber fiery ray
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // 3. Bright yellow electric beam
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // 4. Pure white laser core
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // 5. Fast crackling lightning sparks
    const segments = 8;
    const nx = -dy / dist;
    const ny = dx / dist;
    const timeFactor = Date.now() * 0.012;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const jitter = Math.sin(timeFactor + i * 2.5) * 6;
      ctx.lineTo(p1.x + t * dx + nx * jitter, p1.y + t * dy + ny * jitter);
    }
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draws rotating mystical Eldritch Mandala magic shield glyph around wrist (Optimized)
   */
  _drawEldritchMandala(ctx, pos, mainColor, glowColor) {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.globalCompositeOperation = 'lighter';

    const r = 36;

    // Outer Runic Halo & Ring
    ctx.save();
    ctx.rotate(this.mandalaAngle);

    // Glowing aura ring
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Outer Ring Tick Notches (12 runes)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI * 2) / 12;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r - 4), Math.sin(a) * (r - 4));
      ctx.lineTo(Math.cos(a) * (r + 4), Math.sin(a) * (r + 4));
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
    ctx.restore();

    // Inner Intersecting Geometric Squares (8-pointed star mandala)
    ctx.save();
    ctx.rotate(-this.mandalaAngle * 1.5);
    const sqR = r * 0.65;
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.6;

    // Square 1
    ctx.strokeRect(-sqR, -sqR, sqR * 2, sqR * 2);

    // Square 2 (rotated 45 deg)
    ctx.rotate(Math.PI / 4);
    ctx.strokeRect(-sqR, -sqR, sqR * 2, sqR * 2);
    ctx.restore();

    // Central Mystic Glowing Eye
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.restore();
  }
}
