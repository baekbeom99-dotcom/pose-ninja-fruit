/**
 * Alien Formations & Dive AI for Galaga Mode
 * Renders authentic neon vector sprites of Zako, Goei, and Boss Galaga
 */

export const AlienType = {
  ZAKO: 'ZAKO',
  GOEI: 'GOEI',
  BOSS_GALAGA: 'BOSS_GALAGA'
};

export class Alien {
  constructor(type, row, col, homeX, homeY) {
    this.type = type;
    this.row = row;
    this.col = col;
    this.homeX = homeX;
    this.homeY = homeY;
    this.x = homeX;
    this.y = homeY;
    this.angle = 0;
    this.radius = 16;

    this.maxHp = type === AlienType.BOSS_GALAGA ? 2 : 1;
    this.hp = this.maxHp;
    this.isInjured = false;
    this.isDead = false;
    this.isDiving = false;
    this.diveT = 0;
    this.diveDuration = 3.2;
    this.diveCurve = null;

    // Tractor beam run states (Boss Galaga descends before firing)
    this.isTractorRun = false;
    this.tractorState = 'IDLE'; // 'DESCENDING', 'BEAMING', 'RETURNING'
    this.targetTractorY = 0;

    // Wing flapping animation
    this.animTime = Math.random() * 10;
  }

  startTractorDescent(targetY) {
    this.isTractorRun = true;
    this.tractorState = 'DESCENDING';
    this.targetTractorY = targetY;
  }

  finishTractorRun() {
    this.tractorState = 'RETURNING';
  }

  hit() {
    if (this.isDead) return 0;
    this.hp--;

    if (this.hp <= 0) {
      this.isDead = true;
      if (this.type === AlienType.ZAKO) {
        return this.isDiving ? 200 : 100;
      } else if (this.type === AlienType.GOEI) {
        return this.isDiving ? 320 : 160;
      } else {
        // BOSS_GALAGA
        return this.isDiving ? 400 : 200;
      }
    } else {
      this.isInjured = true;
      return 0; // Not dead yet
    }
  }

  startDive(startX, startY, targetX, targetY, canvasWidth, canvasHeight) {
    this.isDiving = true;
    this.diveT = 0;
    this.diveDuration = 2.8 + Math.random() * 0.8;

    // Generate cubic Bezier dive path: start -> sweep across center -> target area -> loop back up
    const dir = Math.random() > 0.5 ? 1 : -1;
    this.diveCurve = {
      p0: { x: startX, y: startY },
      p1: { x: startX + dir * 180, y: canvasHeight * 0.35 },
      p2: { x: targetX + dir * 120, y: canvasHeight * 0.75 },
      p3: { x: targetX, y: canvasHeight + 40 },
      exitP0: { x: targetX, y: -40 },
      exitP1: { x: this.homeX, y: this.homeY }
    };
  }

  update(dt, formationX, formationY, formationScale, bulletManager, fighterX, fighterY) {
    if (this.isDead) return;
    this.animTime += dt * 8;

    if (this.isTractorRun) {
      if (this.tractorState === 'DESCENDING') {
        this.y += 140 * dt;
        this.x += (formationX - this.x) * 0.05;
        this.angle = 0;
        if (this.y >= this.targetTractorY) {
          this.y = this.targetTractorY;
          this.tractorState = 'BEAMING';
        }
      } else if (this.tractorState === 'BEAMING') {
        // Hover at targetTractorY with subtle oscillation
        this.angle = Math.sin(this.animTime * 0.6) * 0.06;
      } else if (this.tractorState === 'RETURNING') {
        // Return back to formation slot
        this.y -= 130 * dt;
        const targetHomeX = formationX + (this.homeX - formationX) * formationScale;
        const targetHomeY = formationY + (this.homeY - formationY) * formationScale;
        this.x += (targetHomeX - this.x) * 0.08;

        if (this.y <= targetHomeY + 10) {
          this.isTractorRun = false;
          this.tractorState = 'IDLE';
          this.angle = 0;
        }
      }
    } else if (!this.isDiving) {
      // In formation
      this.x = formationX + (this.homeX - formationX) * formationScale;
      this.y = formationY + (this.homeY - formationY) * formationScale;
      this.angle = 0;
    } else {
      // Diving along curve
      this.diveT += dt / this.diveDuration;

      if (this.diveT <= 1.0) {
        const t = this.diveT;
        const c = this.diveCurve;
        const prevX = this.x;
        const prevY = this.y;

        // Cubic Bezier interpolation
        const u = 1 - t;
        const tt = t * t;
        const uu = u * u;
        const uuu = uu * u;
        const ttt = tt * t;

        this.x = uuu * c.p0.x + 3 * uu * t * c.p1.x + 3 * u * tt * c.p2.x + ttt * c.p3.x;
        this.y = uuu * c.p0.y + 3 * uu * t * c.p1.y + 3 * u * tt * c.p2.y + ttt * c.p3.y;

        // Face dive direction
        this.angle = Math.atan2(this.y - prevY, this.x - prevX) - Math.PI / 2;

        // Chance to fire missile mid-dive
        if (bulletManager && Math.random() < 0.015 && this.y < fighterY - 120) {
          bulletManager.fireAlienMissile(this.x, this.y, fighterX, fighterY);
        }
      } else {
        // Return to formation
        this.isDiving = false;
        this.angle = 0;
      }
    }
  }

  render(ctx) {
    if (this.isDead) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const flap = Math.sin(this.animTime) * 0.25;

    if (this.type === AlienType.ZAKO) {
      this._renderZako(ctx, flap);
    } else if (this.type === AlienType.GOEI) {
      this._renderGoei(ctx, flap);
    } else {
      this._renderBoss(ctx, flap);
    }

    ctx.restore();
  }

  _renderZako(ctx, flap) {
    // Blue Bee
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 6;

    // Body
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    ctx.fillStyle = '#e0f2fe';
    // Left wing
    ctx.beginPath();
    ctx.ellipse(-11 - flap * 4, -2, 8, 5, -0.3 + flap, 0, Math.PI * 2);
    ctx.fill();
    // Right wing
    ctx.beginPath();
    ctx.ellipse(11 + flap * 4, -2, 8, 5, 0.3 - flap, 0, Math.PI * 2);
    ctx.fill();

    // Yellow antennas / eyes
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-5, -12, 3, 5);
    ctx.fillRect(2, -12, 3, 5);
    ctx.fillRect(-6, 8, 12, 3);
  }

  _renderGoei(ctx, flap) {
    // Red Butterfly
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 6;

    // Body
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    ctx.fillStyle = '#f87171';
    // Left wing
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.lineTo(-18 - flap * 4, -10 + flap * 4);
    ctx.lineTo(-14, 6);
    ctx.closePath();
    ctx.fill();

    // Right wing
    ctx.beginPath();
    ctx.moveTo(4, -4);
    ctx.lineTo(18 + flap * 4, -10 + flap * 4);
    ctx.lineTo(14, 6);
    ctx.closePath();
    ctx.fill();

    // Wing accents
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-12, -4, 3, 3);
    ctx.fillRect(9, -4, 3, 3);

    // Yellow head
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-4, -11, 8, 4);
  }

  _renderBoss(ctx, flap) {
    // Green-Blue Boss (Turns Blue-Yellow if injured)
    const baseColor = this.isInjured ? '#eab308' : '#10b981';
    const mantleColor = this.isInjured ? '#3b82f6' : '#0284c7';
    ctx.shadowColor = baseColor;
    ctx.shadowBlur = 8;

    // Mantle / Outer shell
    ctx.fillStyle = mantleColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.ellipse(0, 2, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Horns
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-8, -14, 4, 7);
    ctx.fillRect(4, -14, 4, 7);

    // Side claws
    ctx.fillStyle = baseColor;
    ctx.fillRect(-17 - flap * 3, -4, 5, 10);
    ctx.fillRect(12 + flap * 3, -4, 5, 10);
  }
}

export class AlienFormation {
  constructor(canvasWidth = 1280, canvasHeight = 720) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.aliens = [];
    this.formationTime = 0;
    this.centerX = canvasWidth / 2;
    this.centerY = 180;
    this.diveTimer = 0;
    this.diveInterval = 3.0;

    this._buildGrid();
  }

  _buildGrid() {
    this.aliens = [];
    const colSpacing = 62;
    const rowSpacing = 38;

    // Row 0: 6 Boss Galagas (Spaced wide in top row)
    const bossCols = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];
    bossCols.forEach((colOffset, idx) => {
      const hx = this.centerX + colOffset * colSpacing * 1.15;
      const hy = this.centerY - rowSpacing * 2.0;
      this.aliens.push(new Alien(AlienType.BOSS_GALAGA, 0, idx, hx, hy));
    });

    // Row 1: 10 Goeis (Wide escort formation)
    const goeiCols = [-4.5, -3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5, 4.5];
    goeiCols.forEach((colOffset, idx) => {
      const hx = this.centerX + colOffset * colSpacing;
      const hy = this.centerY - rowSpacing * 0.9;
      this.aliens.push(new Alien(AlienType.GOEI, 1, idx, hx, hy));
    });

    // Rows 2, 3 & 4: 12 Zakos each (36 Zakos total, spanning wide across screen)
    const zakoCols = [-5.5, -4.5, -3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5, 4.5, 5.5];
    for (let r = 0; r < 3; r++) {
      zakoCols.forEach((colOffset, idx) => {
        const hx = this.centerX + colOffset * colSpacing;
        const hy = this.centerY + (r + 0.2) * rowSpacing;
        this.aliens.push(new Alien(AlienType.ZAKO, r + 2, idx, hx, hy));
      });
    }
  }

  resize(width, height) {
    const scale = width / this.canvasWidth;
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.centerX = width / 2;
    this.centerY = Math.min(220, height * 0.28);
    this._buildGrid();
  }

  getAliveCount() {
    return this.aliens.filter(a => !a.isDead).length;
  }

  allDestroyed() {
    return this.aliens.every(a => a.isDead);
  }

  update(dt, canvasWidth, canvasHeight, bulletManager, fighterX, fighterY) {
    this.formationTime += dt;

    // Horizontal breathing and sway
    const swayX = this.centerX + Math.sin(this.formationTime * 1.3) * 55;
    const swayY = this.centerY + Math.cos(this.formationTime * 0.8) * 12;
    const scale = 1.0 + Math.sin(this.formationTime * 2.2) * 0.05;

    // Periodic dive attacks
    this.diveTimer += dt;
    if (this.diveTimer >= this.diveInterval) {
      this.diveTimer = 0;
      this._launchDiveAttack(fighterX, fighterY, canvasWidth, canvasHeight);
    }

    // Update each alien
    for (let i = 0; i < this.aliens.length; i++) {
      this.aliens[i].update(dt, swayX, swayY, scale, bulletManager, fighterX, fighterY);
    }
  }

  _launchDiveAttack(fighterX, fighterY, canvasWidth, canvasHeight) {
    const candidates = this.aliens.filter(a => !a.isDead && !a.isDiving);
    if (candidates.length === 0) return;

    // Select 1 to 2 random aliens to dive
    const count = Math.min(candidates.length, Math.random() < 0.6 ? 1 : 2);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * candidates.length);
      const chosen = candidates.splice(idx, 1)[0];
      chosen.startDive(chosen.x, chosen.y, fighterX || canvasWidth / 2, fighterY || canvasHeight - 80, canvasWidth, canvasHeight);
    }
  }

  render(ctx) {
    for (let i = 0; i < this.aliens.length; i++) {
      this.aliens[i].render(ctx);
    }
  }
}
