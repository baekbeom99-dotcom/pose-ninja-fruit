/**
 * Tractor Beam & Dual Fighter Docking System for Galaga Mode
 */

export class TractorBeam {
  constructor() {
    this.isActive = false;
    this.boss = null;
    this.beamTopWidth = 28;
    this.beamBottomWidth = 240;
    this.maxDuration = 6.0;
    this.timer = 0;
    this.animTime = 0;

    // 1.0 second exposure requirement before capture
    this.exposureTimer = 0;
    this.requiredExposure = 1.0;

    this.capturedShip = null;
    this.pullingShip = null;
    this.isPulling = false;
    this.pullSpeed = 160;
    this.onCaptureComplete = null;
  }

  activate(boss) {
    this.isActive = true;
    this.boss = boss;
    this.timer = 0;
    this.animTime = 0;
    this.exposureTimer = 0;
    this.isPulling = false;
    this.pullingShip = null;
  }

  deactivate() {
    this.isActive = false;
    this.boss = null;
    this.isPulling = false;
    this.pullingShip = null;
    this.exposureTimer = 0;
  }

  updateExposure(dt, fighter) {
    if (!this.isActive || !this.boss || !fighter || fighter.isInvulnerable) {
      if (!this.isPulling) {
        this.exposureTimer = 0;
      }
      return {
        isExposed: false,
        timer: this.exposureTimer,
        progress: 0,
        triggerCapture: false
      };
    }

    // 1초 이후 또는 포획 진행 중에는 포획이 풀리지 않음
    if (this.isPulling || fighter.isCaptured) {
      return {
        isExposed: true,
        timer: this.requiredExposure,
        progress: 1.0,
        triggerCapture: false
      };
    }

    const inside = this.isFighterInside(fighter);
    if (inside) {
      // 빔 내에서는 움직여도 포획 풀리지 않고 계속 타이머 누적
      this.exposureTimer += dt;
      const reached = this.exposureTimer >= this.requiredExposure;
      return {
        isExposed: true,
        timer: this.exposureTimer,
        progress: Math.min(1.0, this.exposureTimer / this.requiredExposure),
        triggerCapture: reached
      };
    } else {
      // 단 1초 이내에 빔 밖으로 나가면 타이머 즉시 초기화
      this.exposureTimer = 0;
      return {
        isExposed: false,
        timer: 0,
        progress: 0,
        triggerCapture: false
      };
    }
  }

  isFighterInside(fighter) {
    if (!this.isActive || !this.boss || !fighter) return false;

    const topY = this.boss.y + 12;
    const bottomY = 720;
    if (fighter.y < topY) return false;

    // Linear expansion of cone width from top to bottom
    const progress = Math.min(1.0, Math.max(0, (fighter.y - topY) / Math.max(1, bottomY - topY)));
    const currentHalfWidth = (this.beamTopWidth + (this.beamBottomWidth - this.beamTopWidth) * progress) / 2;

    // Generous boundary (+45% fighter width) so moving within the beam remains firmly inside
    const tolerance = fighter.width * 0.45;
    return Math.abs(fighter.x - this.boss.x) <= (currentHalfWidth + tolerance);
  }

  startCapture(fighter) {
    if (!fighter) return;
    this.isPulling = true;
    this.pullingShip = fighter;
    fighter.isCaptured = true;
    fighter.angle = 0;
  }

  releaseCapturedShip() {
    if (this.capturedShip && !this.capturedShip.isRescued) {
      this.capturedShip.isRescued = true;
      this.capturedShip.boss = null;
    }
  }

  update(dt, activeFighter, soundManager) {
    this.animTime += dt * 6;

    if (this.isActive) {
      // 포획 중(pulling)일 때는 빔 타이머로 인한 강제 중단 금지!
      if (!this.isPulling) {
        this.timer += dt;
        if (this.timer >= this.maxDuration) {
          this.deactivate();
        }
      }
    }

    // Pulling fighter upwards
    const shipToPull = this.pullingShip || (this.isPulling ? activeFighter : null);
    if (this.isPulling && shipToPull && this.boss) {
      shipToPull.y -= this.pullSpeed * dt;
      shipToPull.x += (this.boss.x - shipToPull.x) * 0.12;
      shipToPull.angle = (shipToPull.angle || 0) + dt * 10; // Classic spinning capture!

      // Check if pulled to boss level
      if (shipToPull.y <= this.boss.y + 16) {
        this.isPulling = false;
        this.capturedShip = {
          boss: this.boss,
          x: this.boss.x,
          y: this.boss.y - 18,
          isRescued: false,
          angle: 0
        };
        const finishedShip = shipToPull;
        this.pullingShip = null;
        this.deactivate();

        if (this.onCaptureComplete) {
          this.onCaptureComplete(finishedShip);
        }
      }
    }

    // Keep captured ship attached to boss if held
    if (this.capturedShip && !this.capturedShip.isRescued) {
      if (this.capturedShip.boss && !this.capturedShip.boss.isDead) {
        this.capturedShip.x = this.capturedShip.boss.x;
        this.capturedShip.y = this.capturedShip.boss.y - 18;
      } else {
        this.capturedShip.isRescued = true;
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

  render(ctx, canvasHeight = 720, fighter = null) {
    if (this.isActive && this.boss) {
      ctx.save();
      const topY = this.boss.y + 12;
      const bottomY = canvasHeight;
      const topHalfW = this.beamTopWidth / 2;
      const botHalfW = this.beamBottomWidth / 2;
      const bx = this.boss.x;

      // Color shifts towards amber/red warning as exposure progresses
      const exposureProgress = Math.min(1.0, this.exposureTimer / this.requiredExposure);
      const grad = ctx.createLinearGradient(0, topY, 0, bottomY);
      if (exposureProgress > 0) {
        grad.addColorStop(0, `rgba(250, 204, 21, ${0.45 + exposureProgress * 0.3})`);
        grad.addColorStop(0.5, `rgba(249, 115, 22, ${0.35 + exposureProgress * 0.3})`);
        grad.addColorStop(1, `rgba(239, 68, 68, ${0.2 + exposureProgress * 0.25})`);
      } else {
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
        grad.addColorStop(0.5, 'rgba(6, 182, 212, 0.3)');
        grad.addColorStop(1, 'rgba(37, 99, 235, 0.1)');
      }

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
      ctx.strokeStyle = exposureProgress > 0 ? '#facc15' : '#38bdf8';
      ctx.lineWidth = exposureProgress > 0 ? 3 : 2;
      for (let i = 0; i < numRings; i++) {
        const ringProgress = ((this.animTime + i / numRings) % 1.0);
        const ry = topY + (bottomY - topY) * ringProgress;
        const rw = topHalfW + (botHalfW - topHalfW) * ringProgress;
        ctx.globalAlpha = 0.7 * (1.0 - ringProgress * 0.6);

        ctx.beginPath();
        ctx.ellipse(bx, ry, rw, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // If fighter is exposed inside the beam, render an energetic warning capture progress ring!
      if (fighter && exposureProgress > 0 && !fighter.isCaptured) {
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 12;

        // Progress arc around fighter
        ctx.beginPath();
        ctx.arc(fighter.x, fighter.y, 28, -Math.PI / 2, -Math.PI / 2 + exposureProgress * Math.PI * 2);
        ctx.stroke();

        // Warning text
        ctx.fillStyle = '#facc15';
        ctx.font = '900 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`CAPTURE: ${Math.round(exposureProgress * 100)}%`, fighter.x, fighter.y + 38);
      }

      ctx.restore();
    }

    // Render pulling ship if spinning upwards
    if (this.pullingShip) {
      this.pullingShip.render(ctx);
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
