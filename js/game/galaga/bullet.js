/**
 * Bullet and Missile System for Galaga Mode
 */

export class Bullet {
  constructor(x, y, vy = -900) {
    this.x = x;
    this.y = y;
    this.vy = vy;
    this.width = 4;
    this.height = 18;
    this.isDead = false;
  }

  update(dt) {
    this.y += this.vy * dt;
    if (this.y < -20) {
      this.isDead = true;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
    // Outer yellow glow core
    ctx.fillStyle = '#facc15';
    ctx.fillRect(this.x - 1, this.y - this.height / 2 + 2, 2, this.height - 4);
    ctx.restore();
  }
}

export class AlienMissile {
  constructor(x, y, targetX, targetY, speed = 380) {
    this.x = x;
    this.y = y;
    this.radius = 5;
    this.isDead = false;

    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy) || 1;
    this.vx = (dx / dist) * speed;
    this.vy = (dy / dist) * speed;
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
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ef4444';
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
  }

  firePlayerBullet(x, y, isDual = false) {
    if (isDual) {
      // Two parallel lasers 18px offset from center
      this.playerBullets.push(new Bullet(x - 18, y));
      this.playerBullets.push(new Bullet(x + 18, y));
    } else {
      this.playerBullets.push(new Bullet(x, y));
    }
  }

  fireAlienMissile(x, y, targetX, targetY) {
    this.alienMissiles.push(new AlienMissile(x, y, targetX, targetY));
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
  }

  render(ctx) {
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
  }
}
