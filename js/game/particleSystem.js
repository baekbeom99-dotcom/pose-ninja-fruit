/**
 * Particle and Splatter FX System
 * Manages fruit juice drops, wall splatters, and blade spark emitters
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
    this.vx *= 0.98;
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

class Splatter {
  constructor(x, y, color, radius, life = 2.5) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = radius;
    this.initialLife = life;
    this.life = life;
    this.isDead = false;

    // Pre-calculate randomized droplet splash satellites
    this.droplets = [];
    const count = 4 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = radius * (0.8 + Math.random() * 1.5);
      const r = radius * (0.2 + Math.random() * 0.35);
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
  }

  /**
   * Spawns juice burst and wall splatters upon slicing a fruit
   * @param {number} x - Cut center X
   * @param {number} y - Cut center Y
   * @param {string} juiceColor - Color of the juice
   * @param {{x: number, y: number}} [normal] - Cut normal vector
   */
  createFruitSplash(x, y, juiceColor, normal = null) {
    // 1. Background wall splatter
    this.splatters.push(new Splatter(x, y, juiceColor, 28 + Math.random() * 18, 3.0));

    // 2. Flying juice droplets
    const count = 24 + Math.floor(Math.random() * 12);
    for (let i = 0; i < count; i++) {
      let vx, vy;
      if (normal) {
        // Bias droplet spray along normal vector direction
        const side = Math.random() > 0.5 ? 1 : -1;
        const spread = (Math.random() - 0.5) * 200;
        const speed = 150 + Math.random() * 320;
        vx = normal.x * speed * side + spread;
        vy = normal.y * speed * side - Math.random() * 180;
      } else {
        const angle = Math.random() * Math.PI * 2;
        const speed = 120 + Math.random() * 300;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
      }

      const radius = 2.5 + Math.random() * 4.5;
      const life = 0.5 + Math.random() * 0.6;
      this.particles.push(new Particle(x, y, vx, vy, juiceColor, radius, life, 750));
    }
  }

  /**
   * Spawns intense fire and smoke explosion for a bomb
   */
  createBombExplosion(x, y) {
    // Large scorched splatter
    this.splatters.push(new Splatter(x, y, '#0f172a', 65, 4.0));

    // Fire sparks
    for (let i = 0; i < 45; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 180 + Math.random() * 420;
      const color = Math.random() > 0.3 ? '#f97316' : '#facc15';
      this.particles.push(
        new Particle(
          x,
          y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          color,
          3 + Math.random() * 5,
          0.6 + Math.random() * 0.5,
          400
        )
      );
    }

    // Smoke puffs
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 140;
      this.particles.push(
        new Particle(
          x,
          y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          '#64748b',
          8 + Math.random() * 10,
          0.8 + Math.random() * 0.6,
          -50 // floats upward
        )
      );
    }
  }

  /**
   * Spawns glowing neon blade embers during rapid swing
   */
  createBladeSparks(x, y, sparkColor) {
    for (let i = 0; i < 3; i++) {
      const vx = (Math.random() - 0.5) * 80;
      const vy = (Math.random() - 0.5) * 80;
      this.particles.push(
        new Particle(x, y, vx, vy, sparkColor, 1.5 + Math.random() * 2, 0.25 + Math.random() * 0.2, 100)
      );
    }
  }

  update(dt) {
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
    this.particles.forEach(p => p.draw(ctx));
  }

  clear() {
    this.particles = [];
    this.splatters = [];
  }
}
