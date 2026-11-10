/**
 * Particle and Splatter FX System
 * Manages fruit juice drops, shockwaves, magical healing particles, and blade spark emitters
 */

class Particle {
  constructor(x, y, vx, vy, color, radius, life, gravity = 800) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.radius = radius;
    this.initialLife = life;
    this.life = life;
    this.gravity = gravity;
    this.isDead = false;
  }

  update(dt) {
    this.vy += this.gravity * dt;
    this.vx *= 0.985;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;

    if (this.life <= 0) {
      this.isDead = true;
    }
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.initialLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class Shockwave {
  constructor(x, y, color, maxRadius = 110, life = 0.35) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.maxRadius = maxRadius;
    this.radius = 10;
    this.initialLife = life;
    this.life = life;
    this.isDead = false;
  }

  update(dt) {
    this.life -= dt;
    const progress = 1 - Math.max(0, this.life / this.initialLife);
    this.radius = 10 + progress * (this.maxRadius - 10);
    if (this.life <= 0) {
      this.isDead = true;
    }
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.initialLife);
    ctx.save();
    ctx.globalAlpha = alpha * 0.85;
    ctx.lineWidth = 5 * alpha;
    ctx.strokeStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

class Splatter {
  constructor(x, y, color, radius, life = 2.8) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = radius;
    this.initialLife = life;
    this.life = life;
    this.isDead = false;

    // Pre-calculate randomized droplet splash satellites
    this.droplets = [];
    const count = 5 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = radius * (0.8 + Math.random() * 1.6);
      const r = radius * (0.18 + Math.random() * 0.35);
      this.droplets.push({
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        r
      });
    }
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) {
      this.isDead = true;
    }
  }

  draw(ctx) {
    const alpha = Math.max(0, (this.life / this.initialLife) * 0.45);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;

    // Main splash body
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Satellite splatter droplets
    this.droplets.forEach(d => {
      ctx.beginPath();
      ctx.arc(this.x + d.dx, this.y + d.dy, d.r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }
}

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.splatters = [];
    this.shockwaves = [];
  }

  /**
   * Spawns juice burst, expanding shockwave, and wall splatters
   */
  createFruitSplash(x, y, juiceColor, normal = null) {
    // 1. Shockwave ring
    this.shockwaves.push(new Shockwave(x, y, juiceColor, 90, 0.32));

    // 2. Background wall splatter
    this.splatters.push(new Splatter(x, y, juiceColor, 32 + Math.random() * 20, 3.2));

    // 3. Flying juice droplets
    const count = 28 + Math.floor(Math.random() * 14);
    for (let i = 0; i < count; i++) {
      let vx, vy;
      if (normal) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const spread = (Math.random() - 0.5) * 240;
        const speed = 180 + Math.random() * 360;
        vx = normal.x * speed * side + spread;
        vy = normal.y * speed * side - Math.random() * 200;
      } else {
        const angle = Math.random() * Math.PI * 2;
        const speed = 140 + Math.random() * 340;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
      }

      const radius = 2.5 + Math.random() * 5.0;
      const life = 0.6 + Math.random() * 0.6;
      this.particles.push(new Particle(x, y, vx, vy, juiceColor, radius, life, 750));
    }
  }

  /**
   * Spawns dazzling golden & rose glitter explosion for Heart Bonus
   */
  createHeartHealParticles(x, y) {
    // Double Shockwave
    this.shockwaves.push(new Shockwave(x, y, '#ec4899', 140, 0.45));
    this.shockwaves.push(new Shockwave(x, y, '#facc15', 180, 0.55));

    // Heart sparkle bursts
    for (let i = 0; i < 48; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 380;
      const color = Math.random() > 0.4 ? '#fb7185' : '#fde047';
      this.particles.push(
        new Particle(
          x,
          y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed - 100, // bias upward
          color,
          3 + Math.random() * 5.5,
          0.8 + Math.random() * 0.7,
          300
        )
      );
    }
  }

  /**
   * Spawns intense fire and smoke explosion for a bomb
   */
  createBombExplosion(x, y) {
    this.shockwaves.push(new Shockwave(x, y, '#ff0044', 220, 0.6));
    this.splatters.push(new Splatter(x, y, '#0f172a', 75, 4.5));

    // Fire sparks
    for (let i = 0; i < 55; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 200 + Math.random() * 500;
      const color = Math.random() > 0.3 ? '#f97316' : '#facc15';
      this.particles.push(
        new Particle(
          x,
          y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          color,
          3.5 + Math.random() * 5.5,
          0.7 + Math.random() * 0.6,
          400
        )
      );
    }

    // Smoke puffs
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 160;
      this.particles.push(
        new Particle(
          x,
          y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          '#64748b',
          9 + Math.random() * 12,
          0.9 + Math.random() * 0.7,
          -60
        )
      );
    }
  }

  /**
   * Spawns glowing neon blade embers during rapid swing
   */
  createBladeSparks(x, y, sparkColor) {
    for (let i = 0; i < 4; i++) {
      const vx = (Math.random() - 0.5) * 110;
      const vy = (Math.random() - 0.5) * 110;
      this.particles.push(
        new Particle(x, y, vx, vy, sparkColor, 2 + Math.random() * 2.5, 0.3 + Math.random() * 0.25, 80)
      );
    }
  }

  update(dt) {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      this.shockwaves[i].update(dt);
      if (this.shockwaves[i].isDead) {
        this.shockwaves.splice(i, 1);
      }
    }

    for (let i = this.splatters.length - 1; i >= 0; i--) {
      this.splatters[i].update(dt);
      if (this.splatters[i].isDead) {
        this.splatters.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].isDead) {
        this.particles.splice(i, 1);
      }
    }
  }

  drawSplatters(ctx) {
    this.splatters.forEach(s => s.draw(ctx));
  }

  drawParticles(ctx) {
    this.shockwaves.forEach(w => w.draw(ctx));
    this.particles.forEach(p => p.draw(ctx));
  }

  clear() {
    this.particles = [];
    this.splatters = [];
    this.shockwaves = [];
  }
}
