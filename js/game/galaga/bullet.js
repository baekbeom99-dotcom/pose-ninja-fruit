/**
 * Bullet and Missile System for Galaga Mode
 */

export class Bullet {
  constructor(x, y, vy = -900, vx = 0, isPiercing = false, color = '#facc15') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.width = isPiercing ? 8 : 4;
    this.height = isPiercing ? 24 : 18;
    this.isPiercing = isPiercing;
    this.color = color;
    this.isDead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y < -25 || this.x < -30 || this.x > 1400) {
      this.isDead = true;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.isPiercing ? 14 : 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
    // Outer glow core
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - 1, this.y - this.height / 2 + 2, 2, this.height - 4);
    ctx.restore();
  }
}

export class PowerUp {
  constructor(x, y, type = 'TRIPLE') {
    this.x = x;
    this.y = y;
    this.type = type; // 'TRIPLE', 'PIERCER', 'SHIELD', 'HEART'
    this.vy = 110;
    this.radius = 16;
    this.isDead = false;
    this.animTime = Math.random() * 5;
  }

  update(dt, canvasHeight = 720) {
    this.animTime += dt * 6;
    this.y += this.vy * dt;
    if (this.y > canvasHeight + 30) {
      this.isDead = true;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const colors = {
      TRIPLE: '#38bdf8', // Neon Sky Blue
      PIERCER: '#a855f7', // Electric Violet
      SHIELD: '#10b981', // Emerald Shield
      HEART: '#f43f5e'   // Rose Pink
    };
    const c = colors[this.type] || '#facc15';

    ctx.shadowColor = c;
    ctx.shadowBlur = 12;

    // Glowing capsule base
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = c;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-14, -14, 28, 28, 8);
    ctx.fill();
    ctx.stroke();

    // Pulse inner ring
    const pulse = 1.0 + Math.sin(this.animTime) * 0.15;
    ctx.fillStyle = c;
    ctx.font = '900 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const icons = {
      TRIPLE: '3X',
      PIERCER: '⚡',
      SHIELD: '🛡️',
      HEART: '💖'
    };
    ctx.fillText(icons[this.type] || '★', 0, 1);

    ctx.restore();
  }
}

export class AlienMissile {
  constructor(x, y, targetX, targetY, speed = 380, angleOffset = 0, color = '#ef4444') {
    this.x = x;
    this.y = y;
    this.radius = 5;
    this.isDead = false;
    this.color = color;

    const dx = targetX - x;
    const dy = targetY - y;
    const baseAngle = Math.atan2(dy, dx) + angleOffset;
    this.vx = Math.cos(baseAngle) * speed;
    this.vy = Math.sin(baseAngle) * speed;
  }

  update(dt, canvasWidth, canvasHeight) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.y > canvasHeight + 50 || this.x < -50 || this.x > canvasWidth + 50 || this.y < -50) {
      this.isDead = true;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class BulletManager {
  constructor() {
    this.playerBullets = [];
    this.alienMissiles = [];
    this.powerups = [];
  }

  firePlayerBullet(x, y, isDual = false, weaponType = 'NORMAL') {
    if (weaponType === 'PIERCER') {
      // Thick penetrating rail laser
      if (isDual) {
        this.playerBullets.push(new Bullet(x - 18, y, -1100, 0, true, '#c084fc'));
        this.playerBullets.push(new Bullet(x + 18, y, -1100, 0, true, '#c084fc'));
      } else {
        this.playerBullets.push(new Bullet(x, y, -1100, 0, true, '#c084fc'));
      }
    } else if (weaponType === 'TRIPLE') {
      // 3-way spread volley
      if (isDual) {
        [-32, -18, 0, 18, 32].forEach((offset, idx) => {
          const vx = (idx - 2) * 120;
          this.playerBullets.push(new Bullet(x + offset, y, -900, vx, false, '#38bdf8'));
        });
      } else {
        this.playerBullets.push(new Bullet(x, y, -900, 0, false, '#38bdf8'));
        this.playerBullets.push(new Bullet(x - 12, y, -880, -140, false, '#38bdf8'));
        this.playerBullets.push(new Bullet(x + 12, y, -880, 140, false, '#38bdf8'));
      }
    } else {
      // Standard Galaga lasers
      if (isDual) {
        this.playerBullets.push(new Bullet(x - 18, y));
        this.playerBullets.push(new Bullet(x + 18, y));
      } else {
        this.playerBullets.push(new Bullet(x, y));
      }
    }
  }

  spawnPowerUp(x, y, type) {
    this.powerups.push(new PowerUp(x, y, type));
  }

  fireAlienMissile(x, y, targetX, targetY, speed = 380, angleOffset = 0, color = '#ef4444') {
    this.alienMissiles.push(new AlienMissile(x, y, targetX, targetY, speed, angleOffset, color));
  }

  /**
   * Fires a Galaga-style Hyper Cannon & Twin Wingman Barrage:
   * 3 vertical piercing main beams + 6 wide-fanning plasma bolts.
   */
  fireHyperBarrage(x, y, canvasWidth = 1280) {
    const wingOffset = Math.min(130, Math.max(75, canvasWidth * 0.1));
    const wingXs = [
      Math.max(24, x - wingOffset),
      x,
      Math.min(canvasWidth - 24, x + wingOffset)
    ];

    wingXs.forEach((bx) => {
      this.playerBullets.push(new Bullet(bx, y - 16, -1280, 0, true, '#22d3ee'));
    });

    [-460, -280, -140, 140, 280, 460].forEach((vx) => {
      this.playerBullets.push(new Bullet(x, y - 12, -1120, vx, true, '#facc15'));
    });
  }

  update(dt, canvasWidth, canvasHeight) {
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const b = this.playerBullets[i];
      b.update(dt);
      if (b.isDead) {
        this.playerBullets.splice(i, 1);
      }
    }

    for (let i = this.alienMissiles.length - 1; i >= 0; i--) {
      const m = this.alienMissiles[i];
      m.update(dt, canvasWidth, canvasHeight);
      if (m.isDead) {
        this.alienMissiles.splice(i, 1);
      }
    }

    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.update(dt, canvasHeight);
      if (p.isDead) {
        this.powerups.splice(i, 1);
      }
    }
  }

  render(ctx) {
    for (let i = 0; i < this.powerups.length; i++) {
      this.powerups[i].render(ctx);
    }
    for (let i = 0; i < this.playerBullets.length; i++) {
      this.playerBullets[i].render(ctx);
    }
    for (let i = 0; i < this.alienMissiles.length; i++) {
      this.alienMissiles[i].render(ctx);
    }
  }

  clear() {
    this.playerBullets = [];
    this.alienMissiles = [];
    this.powerups = [];
  }
}
