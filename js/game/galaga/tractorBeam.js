/**
 * Tractor Beam & Dual Fighter Docking System for Galaga Mode
 */

export class TractorBeam {
  constructor() {
    this.isActive = false;
    this.boss = null;
    this.beamTopWidth = 24;
    this.beamBottomWidth = 180;
    this.maxDuration = 4.2;
    this.timer = 0;
    this.animTime = 0;

    this.capturedShip = null;
    this.isPulling = false;
    this.pullSpeed = 160;
  }

  activate(boss) {
    this.isActive = true;
    this.boss = boss;
    this.timer = 0;
    this.animTime = 0;
  }

  deactivate() {
    this.isActive = false;
    this.boss = null;
    this.isPulling = false;
  }

  isFighterInside(fighter) {
    if (!this.isActive || !this.boss || !fighter) return false;

    const topY = this.boss.y + 10;
    const bottomY = fighter.y;
    if (fighter.y < topY) return false;

    // Linear expansion of cone width from top to bottom
    const progress = Math.min(1.0, (fighter.y - topY) / Math.max(1, bottomY - topY));
    const currentHalfWidth = (this.beamTopWidth + (this.beamBottomWidth - this.beamTopWidth) * progress) / 2;

    return Math.abs(fighter.x - this.boss.x) <= currentHalfWidth;
  }

  startCapture(fighter) {
    if (!fighter) return;
    this.isPulling = true;
    fighter.isCaptured = true;
  }

  releaseCapturedShip() {
    if (this.capturedShip) {
      this.capturedShip.isRescued = true;
    }
  }

  update(dt, fighter, soundManager) {
    this.animTime += dt * 6;

    if (this.isActive) {
      this.timer += dt;
      if (this.timer >= this.maxDuration) {
        this.deactivate();
      }
    }

    // Pulling fighter upwards
    if (this.isPulling && fighter && this.boss) {
      fighter.y -= this.pullSpeed * dt;
      fighter.x += (this.boss.x - fighter.x) * 0.1;

      // Check if pulled to boss level
      if (fighter.y <= this.boss.y + 20) {
        this.isPulling = false;
        this.deactivate();
        this.capturedShip = {
          x: this.boss.x,
          y: this.boss.y - 18,
          isRescued: false,
          angle: 0
        };
      }
    }
  }

  updateRescue(dt, fighter, soundManager) {
    if (!this.capturedShip || !this.capturedShip.isRescued || !fighter) return;

    // Rescued ship spirals down towards player fighter
    this.capturedShip.y += 180 * dt;
    this.capturedShip.x += (fighter.x - this.capturedShip.x) * 0.12;

    if (this.capturedShip.y >= fighter.y - 4) {
      // Dock complete! Transform into Dual Fighter
      fighter.setDual(true);
      if (soundManager && typeof soundManager.playGalagaDock === 'function') {
        soundManager.playGalagaDock();
      }
      this.capturedShip = null;
    }
  }

  render(ctx, canvasHeight = 720) {
    if (this.isActive && this.boss) {
      ctx.save();
      const topY = this.boss.y + 12;
      const bottomY = canvasHeight;
      const topHalfW = this.beamTopWidth / 2;
      const botHalfW = this.beamBottomWidth / 2;
      const bx = this.boss.x;

      // Cone gradient
      const grad = ctx.createLinearGradient(0, topY, 0, bottomY);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
      grad.addColorStop(0.5, 'rgba(6, 182, 212, 0.3)');
      grad.addColorStop(1, 'rgba(37, 99, 235, 0.1)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(bx - topHalfW, topY);
      ctx.lineTo(bx + topHalfW, topY);
      ctx.lineTo(bx + botHalfW, bottomY);
      ctx.lineTo(bx - botHalfW, bottomY);
      ctx.closePath();
      ctx.fill();

      // Spiraling / pulsing rings
      const numRings = 7;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      for (let i = 0; i < numRings; i++) {
        const ringProgress = ((this.animTime + i / numRings) % 1.0);
        const ry = topY + (bottomY - topY) * ringProgress;
        const rw = topHalfW + (botHalfW - topHalfW) * ringProgress;
        ctx.globalAlpha = 0.7 * (1.0 - ringProgress * 0.6);

        ctx.beginPath();
        ctx.ellipse(bx, ry, rw, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Render captured ship if held by boss or descending for rescue
    if (this.capturedShip) {
      ctx.save();
      ctx.translate(this.capturedShip.x, this.capturedShip.y);
      ctx.fillStyle = this.capturedShip.isRescued ? '#38bdf8' : '#eab308';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 8;

      // Small captured fighter silhouette
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(10, 8);
      ctx.lineTo(0, 5);
      ctx.lineTo(-10, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}
