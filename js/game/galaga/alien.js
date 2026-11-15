/**
 * Alien Formations & Dive AI for Galaga Mode
 * Renders authentic neon vector sprites of Zako, Goei, and Boss Galaga
 */

export const AlienType = {
  ZAKO: 'ZAKO',
  GOEI: 'GOEI',
  BOSS_GALAGA: 'BOSS_GALAGA',
  PHANTOM: 'PHANTOM' // Stage 7+ Elite Stealth Viper
};

export class Alien {
  constructor(type, row, col, homeX, homeY, stage = 1) {
    this.type = type;
    this.row = row;
    this.col = col;
    this.homeX = homeX;
    this.homeY = homeY;
    this.x = homeX;
    this.y = homeY;
    this.stage = stage;
    this.angle = 0;
    this.radius = type === AlienType.PHANTOM ? 17 : 16;

    this.maxHp = (type === AlienType.BOSS_GALAGA || type === AlienType.PHANTOM) ? 2 : 1;
    this.hp = this.maxHp;
    this.isInjured = false;
    this.isDead = false;
    this.isDiving = false;
    this.diveT = 0;
    this.diveDuration = 3.2;
    this.diveCurve = null;
    this.diveMissilesFired = 0;
    this.diveMaxMissiles = 1;

    // Tractor beam run states (Boss Galaga descends before firing)
    this.isTractorRun = false;
    this.tractorState = 'IDLE'; // 'DESCENDING', 'BEAMING', 'RETURNING'
    this.targetTractorY = 0;

    this.animTime = Math.random() * 10;

    // Boss Galaga energy shield on stage 4+; Phantom always shielded
    this.isShielded = (type === AlienType.BOSS_GALAGA && stage >= 4) || type === AlienType.PHANTOM;

    // Formation fly-in animation states
    this.isFlyIn = false;
    this.flyInDelay = 0;
    this.flyInTime = 0;
    this.flyInDuration = 2.0;
    this.flyInCurve = null;
  }

  startTractorDescent(targetY) {
    this.isTractorRun = true;
    this.tractorState = 'DESCENDING';
    this.startY = this.y;
    this.startX = this.x;
    this.targetTractorY = targetY;
  }

  finishTractorRun() {
    this.tractorState = 'RETURNING';
  }

  hit() {
    if (this.isDead) return 0;

    // Shield absorbs 1st hit
    if (this.isShielded) {
      this.isShielded = false;
      return 50;
    }

    this.hp--;

    if (this.hp <= 0) {
      this.isDead = true;
      const wasDiving = this.isDiving;
      this.isFlyIn = false;
      if (this.type === AlienType.ZAKO) {
        return wasDiving ? 200 : 100;
      } else if (this.type === AlienType.GOEI) {
        return wasDiving ? 320 : 160;
      } else if (this.type === AlienType.PHANTOM) {
        return wasDiving ? 800 : 500;
      } else {
        // BOSS_GALAGA
        return wasDiving ? 400 : 200;
      }
    } else {
      this.isInjured = true;
      return 0; // Not dead yet
    }
  }

  startDive(startX, startY, targetX, targetY, canvasWidth, canvasHeight, stage = this.stage) {
    this.isDiving = true;
    this.diveT = 0;
    this.diveMissilesFired = 0;

    // Stage 1: calm & readable pace (~3.1s), progressively faster on higher stages
    const speedUp = Math.min(1.5, (stage - 1) * 0.22);
    this.diveDuration = Math.max(1.6, (3.1 - speedUp) + Math.random() * 0.3);

    // Stage-by-stage missile quota per dive
    if (stage <= 1) {
      this.diveMaxMissiles = 1; // Classic Stage 1: max 1 missile per dive
    } else if (stage <= 3) {
      this.diveMaxMissiles = this.type === AlienType.BOSS_GALAGA ? 2 : 1;
    } else if (stage <= 6) {
      this.diveMaxMissiles = 2;
    } else {
      this.diveMaxMissiles = (this.type === AlienType.BOSS_GALAGA || this.type === AlienType.PHANTOM) ? 3 : 2;
    }

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

    // Fly-in entrance animation
    if (this.isFlyIn && this.flyInCurve) {
      this.flyInTime += dt;
      if (this.flyInTime < this.flyInDelay) {
        this.x = -200;
        this.y = -200;
        return;
      }
      const t = Math.min(1.0, (this.flyInTime - this.flyInDelay) / this.flyInDuration);
      const u = 1 - t;
      const c = this.flyInCurve;
      this.x = u * u * c.p0.x + 2 * u * t * c.p1.x + t * t * this.homeX;
      this.y = u * u * c.p0.y + 2 * u * t * c.p1.y + t * t * this.homeY;
      this.angle = (1 - t) * Math.PI * 2;
      if (t >= 1.0) {
        this.isFlyIn = false;
        this.angle = 0;
        this.x = this.homeX;
        this.y = this.homeY;
      }
      return;
    }

    if (this.isTractorRun) {
      if (this.tractorState === 'DESCENDING') {
        this.y += 140 * dt;
        this.x += (formationX - this.x) * 0.05;

        // 출발할 때 180도(Math.PI) 회전하면서 하강
        const startY = this.startY !== undefined ? this.startY : (this.homeY || 80);
        const totalDist = Math.max(1, this.targetTractorY - startY);
        const currentDist = Math.max(0, this.y - startY);
        const rotProgress = Math.min(1.0, currentDist / (totalDist * 0.45));
        const easedRot = 0.5 - 0.5 * Math.cos(rotProgress * Math.PI);
        this.angle = easedRot * Math.PI;

        if (this.y >= this.targetTractorY) {
          this.y = this.targetTractorY;
          this.tractorState = 'BEAMING';
          this.angle = Math.PI;
        }
      } else if (this.tractorState === 'BEAMING') {
        // 180도 회전된 상태(플레이어를 향한 상태)로 호버링하며 미세 진동
        this.angle = Math.PI + Math.sin(this.animTime * 0.8) * 0.08;
      } else if (this.tractorState === 'RETURNING') {
        // Return back to formation slot, rotating back to 0 degrees
        this.y -= 130 * dt;
        const targetHomeX = formationX + (this.homeX - formationX) * formationScale;
        const targetHomeY = formationY + (this.homeY - formationY) * formationScale;
        this.x += (targetHomeX - this.x) * 0.08;

        const returnTotalDist = Math.max(1, this.targetTractorY - targetHomeY);
        const returnCurrentDist = Math.max(0, this.targetTractorY - this.y);
        const returnProgress = Math.min(1.0, returnCurrentDist / returnTotalDist);
        this.angle = Math.PI * (1.0 - returnProgress);

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

        let diveX = uuu * c.p0.x + 3 * uu * t * c.p1.x + 3 * u * tt * c.p2.x + ttt * c.p3.x;
        const diveY = uuu * c.p0.y + 3 * uu * t * c.p1.y + 3 * u * tt * c.p2.y + ttt * c.p3.y;

        // Phantom weaves side-to-side during its dive attack
        if (this.type === AlienType.PHANTOM) {
          diveX += Math.sin(t * Math.PI * 5) * 60 * Math.sin(t * Math.PI);
        }

        this.x = diveX;
        this.y = diveY;

        // Face dive direction
        this.angle = Math.atan2(this.y - prevY, this.x - prevX) - Math.PI / 2;

        // Stage-scaled deterministic missile firing quota
        const missileSpeed = Math.min(450, 230 + (this.stage - 1) * 28);
        const fireStep = 0.65 / (this.diveMaxMissiles + 0.5);
        const nextTriggerT = 0.22 + this.diveMissilesFired * fireStep;
        if (bulletManager && this.diveMissilesFired < this.diveMaxMissiles && t >= nextTriggerT && this.y < fighterY - 60) {
          this.diveMissilesFired++;
          if (this.type === AlienType.PHANTOM) {
            bulletManager.fireAlienMissile(this.x, this.y, fighterX, fighterY, missileSpeed, -0.16, '#e879f9');
            bulletManager.fireAlienMissile(this.x, this.y, fighterX, fighterY, missileSpeed, 0.16, '#e879f9');
          } else {
            bulletManager.fireAlienMissile(this.x, this.y, fighterX, fighterY, missileSpeed);
          }
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
    } else if (this.type === AlienType.PHANTOM) {
      this._renderPhantom(ctx, flap);
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

    // Rotating Energy Shield Barrier (Stage 4+)
    if (this.isShielded) {
      ctx.save();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      const shieldR = 21 + Math.sin(this.animTime * 0.8) * 2;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI / 3) + this.animTime * 0.2;
        const sx = Math.cos(a) * shieldR;
        const sy = Math.sin(a) * shieldR;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(0, 240, 255, 0.22)';
      ctx.fill();
      ctx.restore();
    }
  }

  _renderPhantom(ctx, flap) {
    // Stage 7+ Elite Cyber Phantom (Magenta/Violet stealth viper, turns Gold/Crimson when injured)
    const hullColor = this.isInjured ? '#f59e0b' : '#d946ef';
    const wingColor = this.isInjured ? '#fde047' : '#a855f7';
    ctx.shadowColor = hullColor;
    ctx.shadowBlur = 12;

    // Swept stealth wings
    ctx.fillStyle = wingColor;
    ctx.beginPath();
    ctx.moveTo(-4, -6);
    ctx.lineTo(-20 - flap * 4, 4 + flap * 3);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(4, -6);
    ctx.lineTo(20 + flap * 4, 4 + flap * 3);
    ctx.lineTo(10, 12);
    ctx.closePath();
    ctx.fill();

    // Central armored fuselage
    ctx.fillStyle = hullColor;
    ctx.beginPath();
    ctx.moveTo(0, 15);
    ctx.lineTo(-9, -4);
    ctx.lineTo(0, -14);
    ctx.lineTo(9, -4);
    ctx.closePath();
    ctx.fill();

    // Twin golden mandibles & core eye
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-7, -15, 3, 7);
    ctx.fillRect(4, -15, 3, 7);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Violet energy barrier
    if (this.isShielded) {
      ctx.save();
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#e879f9';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      const shieldR = 22 + Math.sin(this.animTime * 0.9) * 2;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI / 3) - this.animTime * 0.25;
        const sx = Math.cos(a) * shieldR;
        const sy = Math.sin(a) * shieldR;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(232, 121, 249, 0.18)';
      ctx.fill();
      ctx.restore();
    }
  }
}

export class AlienFormation {
  constructor(canvasWidth = 1280, canvasHeight = 720, stage = 1) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.stage = stage;
    this.aliens = [];
    this.formationTime = 0;
    this.diveTimer = 2.0; // Start ready soon after fly-in completes
    this.centerX = canvasWidth / 2;
    this.centerY = 180;
    this.isFlyIn = false;
    this.flyInTimer = 0;
    // Stage 1 starts at calm 3.4s interval, progressively tightening per stage
    this.diveInterval = Math.max(1.1, 3.4 - (stage - 1) * 0.28);
    this.formationFireTimer = 0;
    this.formationFireInterval = stage <= 1 ? Infinity : Math.max(1.6, 5.2 - (stage - 2) * 0.55);

    this._buildGrid();
  }

  startFlyIn() {
    this.isFlyIn = true;
    this.flyInTimer = 0;
    for (let i = 0; i < this.aliens.length; i++) {
      const a = this.aliens[i];
      a.isFlyIn = true;
      a.flyInTime = 0;
      a.flyInDuration = 1.9;

      const fromLeft = a.col % 2 === 0;
      const startX = fromLeft ? -50 : this.canvasWidth + 50;
      const startY = 60 + (a.row % 3) * 60;
      const midX = fromLeft ? this.canvasWidth * 0.35 : this.canvasWidth * 0.65;
      const midY = this.canvasHeight * 0.40;

      a.flyInDelay = (a.row % 3) * 0.25 + (a.col % 4) * 0.06;
      a.flyInCurve = {
        p0: { x: startX, y: startY },
        p1: { x: midX, y: midY }
      };
      a.x = -300;
      a.y = -300;
    }
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
      this.aliens.push(new Alien(AlienType.BOSS_GALAGA, 0, idx, hx, hy, this.stage));
    });

    // Stage 7+: 4 Elite Cyber Phantoms flanking the top Boss row
    if (this.stage >= 7) {
      const phantomCols = [-3.9, -3.2, 3.2, 3.9];
      phantomCols.forEach((colOffset, idx) => {
        const hx = this.centerX + colOffset * colSpacing * 1.15;
        const hy = this.centerY - rowSpacing * 2.0;
        this.aliens.push(new Alien(AlienType.PHANTOM, 0, idx + 10, hx, hy, this.stage));
      });
    }

    // Row 1: 10 Goeis (Wide escort formation)
    const goeiCols = [-4.5, -3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5, 4.5];
    goeiCols.forEach((colOffset, idx) => {
      const hx = this.centerX + colOffset * colSpacing;
      const hy = this.centerY - rowSpacing * 0.9;
      this.aliens.push(new Alien(AlienType.GOEI, 1, idx, hx, hy, this.stage));
    });

    // Rows 2, 3 & 4: 12 Zakos each (36 Zakos total, spanning wide across screen)
    const zakoCols = [-5.5, -4.5, -3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5, 4.5, 5.5];
    for (let r = 0; r < 3; r++) {
      zakoCols.forEach((colOffset, idx) => {
        const hx = this.centerX + colOffset * colSpacing;
        const hy = this.centerY + (r + 0.2) * rowSpacing;
        this.aliens.push(new Alien(AlienType.ZAKO, r + 2, idx, hx, hy, this.stage));
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

    // Horizontal breathing and sway - scales with stage speed
    const swayFreq = 1.3 + Math.min(1.2, (this.stage - 1) * 0.2);
    const swayAmp = 55 + Math.min(25, (this.stage - 1) * 5);
    const swayX = this.centerX + Math.sin(this.formationTime * swayFreq) * swayAmp;
    const swayY = this.centerY + Math.cos(this.formationTime * 0.8) * 12;
    const scale = 1.0 + Math.sin(this.formationTime * (2.2 + Math.min(1.0, (this.stage - 1) * 0.2))) * 0.05;

    // Fly-in master timer
    if (this.isFlyIn) {
      this.flyInTimer += dt;
      if (this.flyInTimer >= 2.0) {
        this.isFlyIn = false;
        for (let i = 0; i < this.aliens.length; i++) {
          this.aliens[i].isFlyIn = false;
        }
      }
    }

    // Periodic dive attacks & formation sniping (active once fly-in completes)
    if (!this.isFlyIn) {
      this.diveTimer += dt;
      if (this.diveTimer >= this.diveInterval) {
        this.diveTimer = 0;
        this._launchDiveAttack(fighterX, fighterY, canvasWidth, canvasHeight);
      }

      if (this.stage >= 2) {
        this.formationFireTimer += dt;
        if (this.formationFireTimer >= this.formationFireInterval) {
          this.formationFireTimer = 0;
          this._launchFormationMissile(bulletManager, fighterX, fighterY);
        }
      }
    }

    // Update each alien
    for (let i = 0; i < this.aliens.length; i++) {
      this.aliens[i].update(dt, swayX, swayY, scale, bulletManager, fighterX, fighterY);
    }
  }

  _launchFormationMissile(bulletManager, fighterX, fighterY) {
    if (!bulletManager) return;
    const candidates = this.aliens.filter(a => !a.isDead && !a.isDiving && !a.isTractorRun && !a.isFlyIn);
    if (candidates.length === 0) return;

    // Favor bottom-row aliens (Zakos & Goeis) facing the player
    candidates.sort((a, b) => b.row - a.row);
    const pool = candidates.slice(0, Math.min(candidates.length, 14));
    const shooter = pool[Math.floor(Math.random() * pool.length)];

    const missileSpeed = Math.min(440, 220 + (this.stage - 1) * 28);
    bulletManager.fireAlienMissile(shooter.x, shooter.y, fighterX, fighterY, missileSpeed);
  }

  _launchDiveAttack(fighterX, fighterY, canvasWidth, canvasHeight) {
    const candidates = this.aliens.filter(a => !a.isDead && !a.isDiving && !a.isTractorRun && !a.isFlyIn);
    if (candidates.length === 0) return;

    // Stage-scaled simultaneous diving squad size:
    // Stage 1: classic 1~2 enemies; progressively climbs to 2~4 squads in later stages
    let count = 1;
    if (this.stage <= 1) {
      count = Math.random() < 0.35 ? 2 : 1;
    } else if (this.stage <= 3) {
      count = 1 + Math.floor(Math.random() * 2); // 1 ~ 2
    } else if (this.stage <= 6) {
      count = 2 + Math.floor(Math.random() * 2); // 2 ~ 3
    } else {
      count = 2 + Math.floor(Math.random() * 3); // 2 ~ 4
    }
    count = Math.min(candidates.length, count);

    for (let i = 0; i < count; i++) {
      if (candidates.length === 0) break;
      const idx = Math.floor(Math.random() * candidates.length);
      const chosen = candidates.splice(idx, 1)[0];
      chosen.startDive(chosen.x, chosen.y, fighterX || canvasWidth / 2, fighterY || canvasHeight - 80, canvasWidth, canvasHeight, this.stage);
    }
  }

  render(ctx) {
    for (let i = 0; i < this.aliens.length; i++) {
      this.aliens[i].render(ctx);
    }
  }
}

export class BonusAlien extends Alien {
  constructor(type, curve, delay = 0, duration = 4.2) {
    super(type, 0, 0, -200, -200, 1);
    this.curve = curve;
    this.delay = delay;
    this.duration = duration;
    this.flightTime = 0;
    this.isBonus = true;
  }

  updateBonus(dt) {
    if (this.isDead) return;
    this.animTime += dt * 8;
    this.flightTime += dt;

    if (this.flightTime < this.delay) {
      this.x = -200;
      this.y = -200;
      return;
    }

    const t = Math.min(1.0, (this.flightTime - this.delay) / this.duration);
    if (t >= 1.0) {
      this.isDead = true; // Escaped off-screen
      return;
    }

    const prevX = this.x;
    const prevY = this.y;
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    const c = this.curve;

    this.x = uuu * c.p0.x + 3 * uu * t * c.p1.x + 3 * u * tt * c.p2.x + ttt * c.p3.x;
    this.y = uuu * c.p0.y + 3 * uu * t * c.p1.y + 3 * u * tt * c.p2.y + ttt * c.p3.y;

    if (Math.hypot(this.x - prevX, this.y - prevY) > 0.1) {
      this.angle = Math.atan2(this.y - prevY, this.x - prevX) - Math.PI / 2;
    }
  }
}
