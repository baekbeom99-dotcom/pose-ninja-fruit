/**
 * Player Fighter Ship for Galaga Mode
 * Smooth X-axis movement driven by head tracking with continuous auto-fire.
 */

export class Fighter {
  constructor(startX = 640, startY = 645) {
    this.x = startX;
    this.y = startY;
    this.targetX = startX;
    this.width = 36;
    this.height = 36;
    this.smoothFactor = 0.14; // LERP smoothing factor for jitter-free glide

    this.isDual = false;
    this.isDead = false;
    this.isCaptured = false;
    this.isInvulnerable = false;
    this.invulnerableTimer = 0;

    // Continuous auto-fire interval
    this.autoFireInterval = 0.18;
    this.autoFireTimer = 0;

    // Engine pulse animation
    this.animTime = 0;
  }

  setDual(active) {
    this.isDual = active;
    this.width = active ? 72 : 36;
  }

  setInvulnerable(seconds = 2.0) {
    this.isInvulnerable = true;
    this.invulnerableTimer = seconds;
  }

  update(dt, targetX, canvasWidth, canvasHeight, bulletManager, soundManager) {
    if (this.isDead || this.isCaptured) return;
    this.animTime += dt * 12;

    const halfW = this.width / 2;

    // 1. Process targetX from head tracking or mouse fallback
    if (targetX !== undefined && targetX !== null) {
      this.targetX = Math.max(halfW, Math.min(canvasWidth - halfW, targetX));
    }

    // 2. Smooth exponential glide towards target
    this.x += (this.targetX - this.x) * this.smoothFactor;
    this.x = Math.max(halfW, Math.min(canvasWidth - halfW, this.x));
    this.y = canvasHeight - 75;

    // 3. Invulnerability timer
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      if (this.invulnerableTimer <= 0) {
        this.isInvulnerable = false;
      }
    }

    // 4. Continuous auto-fire
    this.autoFireTimer -= dt;
    if (this.autoFireTimer <= 0) {
      this.autoFireTimer = this.autoFireInterval;

      if (bulletManager) {
        bulletManager.firePlayerBullet(this.x, this.y - 18, this.isDual);
      }
      if (soundManager && typeof soundManager.playGalagaShoot === 'function') {
        soundManager.playGalagaShoot();
      }
    }
  }

  render(ctx) {
    if (this.isDead) return;

    ctx.save();
    // Flash when invulnerable
    if (this.isInvulnerable && Math.floor(this.animTime * 2) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    if (this.isDual) {
      // Two ships docked side by side
      this._renderSingleHull(ctx, this.x - 18, this.y);
      this._renderSingleHull(ctx, this.x + 18, this.y);
      // Central docking connector beam
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(this.x - 4, this.y - 6, 8, 4);
    } else {
      if (this.isCaptured && this.angle) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        this._renderSingleHull(ctx, 0, 0);
        ctx.restore();
      } else {
        this._renderSingleHull(ctx, this.x, this.y);
      }
    }

    ctx.restore();
  }

  _renderSingleHull(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);

    const isCapt = this.isCaptured;
    ctx.shadowColor = isCapt ? '#f59e0b' : '#38bdf8';
    ctx.shadowBlur = 8;

    // Main arrow hull (turns amber/reddish when captured)
    ctx.fillStyle = isCapt ? '#fed7aa' : '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(8, -4);
    ctx.lineTo(16, 12);
    ctx.lineTo(8, 14);
    ctx.lineTo(4, 10);
    ctx.lineTo(-4, 10);
    ctx.lineTo(-8, 14);
    ctx.lineTo(-16, 12);
    ctx.lineTo(-8, -4);
    ctx.closePath();
    ctx.fill();

    // Red wing stripes & nose tip
    ctx.fillStyle = '#ef4444';
    // Nose tip
    ctx.fillRect(-2, -18, 4, 7);
    // Left wing stripe
    ctx.fillRect(-15, 6, 6, 6);
    // Right wing stripe
    ctx.fillRect(9, 6, 6, 6);

    // Cyan cockpit canopy
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.ellipse(0, -4, 3, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Engine thrust flare pulse
    const flameH = 6 + Math.sin(this.animTime) * 3;
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(-4, 11);
    ctx.lineTo(0, 11 + flameH);
    ctx.lineTo(4, 11);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
