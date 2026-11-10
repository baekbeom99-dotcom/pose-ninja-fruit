/**
 * Particle and Splatter FX System with Ultimate Move Visuals
 */

class Particle {
  constructor(x, y, vx, vy, color, radius, life, gravity = 800, isPixel = false) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.radius = radius;
    this.initialLife = life;
    this.life = life;
    this.gravity = gravity;
    this.isPixel = isPixel;
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
    if (this.isPixel) {
      const size = this.radius * 2;
      ctx.fillRect(this.x - this.radius, this.y - this.radius, size, size);
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
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
    ctx.globalAlpha = alpha * 0.9;
    ctx.lineWidth = 6 * alpha;
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

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    this.droplets.forEach(d => {
      ctx.beginPath();
      ctx.arc(this.x + d.dx, this.y + d.dy, d.r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }
}

class LightningSlash {
  constructor(w, h, color = '#facc15') {
    this.w = w;
    this.h = h;
    this.color = color;
    this.life = 0.4;
    this.initialLife = 0.4;
    this.isDead = false;

    // Generate dramatic diagonal slash lines
    this.slashes = [
      { x1: 0, y1: h * 0.2, x2: w, y2: h * 0.8 },
      { x1: 0, y1: h * 0.8, x2: w, y2: h * 0.2 },
      { x1: w * 0.2, y1: 0, x2: w * 0.8, y2: h }
    ];
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) {
      this.isDead = true;
    }
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.initialLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 30;
    ctx.lineWidth = 14 * alpha;
    ctx.lineCap = 'round';

    this.slashes.forEach(s => {
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    });

    // Screen flash overlay
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.35})`;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.restore();
  }
}

class DoctorStrangePortal {
  constructor(w, h) {
    this.x = w / 2;
    this.y = h / 2;
    this.targetRadius = Math.min(w, h) * 0.42;
    this.radius = 20;
    this.life = 1.35;
    this.initialLife = 1.35;
    this.isDead = false;
    this.sparksAngle = 0;
  }

  update(dt) {
    this.life -= dt;
    this.sparksAngle += dt * 8.5;
    const elapsed = this.initialLife - this.life;
    if (elapsed < 0.28) {
      this.radius = 20 + (elapsed / 0.28) * (this.targetRadius - 20);
    } else if (this.life < 0.28) {
      this.radius = Math.max(0, (this.life / 0.28) * this.targetRadius);
    } else {
      this.radius = this.targetRadius;
    }

    if (this.life <= 0) {
      this.isDead = true;
    }
  }

  draw(ctx) {
    const alpha = Math.min(1.0, this.life / 0.25);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalCompositeOperation = 'lighter';

    // 1. Cosmic Void Inside the Portal
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    const voidGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, this.radius);
    voidGrad.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
    voidGrad.addColorStop(0.7, 'rgba(88, 28, 135, 0.65)');
    voidGrad.addColorStop(1, 'rgba(234, 88, 12, 0.3)');
    ctx.fillStyle = voidGrad;
    ctx.fill();

    // 2. Fiery Eldritch Ring with High-Performance Additive Concentric Passes
    // Outer atmospheric orange halo
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.35)';
    ctx.lineWidth = 24 * alpha;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Mid amber fiery ring
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 12 * alpha;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner bright yellow core ring
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 4 * alpha;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Fast Rotating Fiery Sparks Spitting Outwards
    const sparkCount = 42;
    for (let i = 0; i < sparkCount; i++) {
      const a = (i * Math.PI * 2) / sparkCount + this.sparksAngle;
      const rOffset = (Math.sin(a * 4 + this.sparksAngle * 2)) * 14;
      const sx = Math.cos(a) * (this.radius + rOffset);
      const sy = Math.sin(a) * (this.radius + rOffset);

      // Tangent spark trail
      const tx = sx - Math.sin(a) * (20 + (i % 3) * 12);
      const ty = sy + Math.cos(a) * (20 + (i % 3) * 12);

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = (i % 2 === 0) ? '#fde047' : '#ffffff';
      ctx.lineWidth = 3.5 * alpha;
      ctx.stroke();
    }

    ctx.restore();
  }
}

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.splatters = [];
    this.shockwaves = [];
    this.lightningSlashes = [];
    this.portals = [];
  }

  createDoctorStrangePortal(w, h) {
    this.portals.push(new DoctorStrangePortal(w, h));

    // Swirling Eldritch Fire Sparks
    const cx = w / 2;
    const cy = h / 2;
    for (let i = 0; i < 95; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.min(w, h) * (0.35 + Math.random() * 0.12);
      const speed = 180 + Math.random() * 320;
      const color = Math.random() > 0.3 ? '#f59e0b' : '#fde047';
      this.particles.push(
        new Particle(
          cx + Math.cos(angle) * dist,
          cy + Math.sin(angle) * dist,
          -Math.sin(angle) * speed,
          Math.cos(angle) * speed,
          color,
          3.5 + Math.random() * 4.5,
          0.9 + Math.random() * 0.4,
          50
        )
      );
    }
  }

  createStarlightBubbles(x, y, color = '#38bdf8') {
    this.shockwaves.push(new Shockwave(x, y, color, 120, 0.38));
    this.splatters.push(new Splatter(x, y, color, 28, 2.5));

    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 320;
      this.particles.push(
        new Particle(
          x,
          y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          color,
          3.5 + Math.random() * 4.5,
          0.7 + Math.random() * 0.5,
          80
        )
      );
    }
  }

  createFruitSplash(x, y, juiceColor, normal = null, isPixel = false) {
    this.shockwaves.push(new Shockwave(x, y, juiceColor, 95, 0.32));
    this.splatters.push(new Splatter(x, y, juiceColor, 34 + Math.random() * 20, 3.2));

    const count = 30 + Math.floor(Math.random() * 15);
    for (let i = 0; i < count; i++) {
      let vx, vy;
      if (normal) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const spread = (Math.random() - 0.5) * 260;
        const speed = 200 + Math.random() * 380;
        vx = normal.x * speed * side + spread;
        vy = normal.y * speed * side - Math.random() * 220;
      } else {
        const angle = Math.random() * Math.PI * 2;
        const speed = 150 + Math.random() * 360;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
      }

      const radius = 3.0 + Math.random() * 5.0;
      const life = 0.6 + Math.random() * 0.6;
      this.particles.push(new Particle(x, y, vx, vy, juiceColor, radius, life, 750, isPixel));
    }
  }

  createHeartHealParticles(x, y) {
    this.shockwaves.push(new Shockwave(x, y, '#ec4899', 140, 0.45));
    this.shockwaves.push(new Shockwave(x, y, '#facc15', 180, 0.55));

    for (let i = 0; i < 48; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 380;
      const color = Math.random() > 0.4 ? '#fb7185' : '#fde047';
      this.particles.push(
        new Particle(
          x,
          y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed - 100,
          color,
          3.5 + Math.random() * 5.5,
          0.8 + Math.random() * 0.7,
          300
        )
      );
    }
  }

  createUltimateScreenSlashes(w, h, color = '#facc15') {
    this.lightningSlashes.push(new LightningSlash(w, h, color));

    // Fill screen with dazzling lightning spark embers
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const speed = 200 + Math.random() * 400;
      const angle = Math.random() * Math.PI * 2;
      this.particles.push(
        new Particle(
          x,
          y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          color,
          3 + Math.random() * 6,
          0.6 + Math.random() * 0.6,
          200
        )
      );
    }
  }

  createBombExplosion(x, y) {
    this.shockwaves.push(new Shockwave(x, y, '#ff0044', 220, 0.6));
    this.splatters.push(new Splatter(x, y, '#0f172a', 75, 4.5));

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
    for (let i = this.portals.length - 1; i >= 0; i--) {
      this.portals[i].update(dt);
      if (this.portals[i].isDead) {
        this.portals.splice(i, 1);
      }
    }

    for (let i = this.lightningSlashes.length - 1; i >= 0; i--) {
      this.lightningSlashes[i].update(dt);
      if (this.lightningSlashes[i].isDead) {
        this.lightningSlashes.splice(i, 1);
      }
    }

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
    this.portals.forEach(p => p.draw(ctx));
    this.lightningSlashes.forEach(s => s.draw(ctx));
    this.shockwaves.forEach(w => w.draw(ctx));
    this.particles.forEach(p => p.draw(ctx));
  }

  clear() {
    this.particles = [];
    this.splatters = [];
    this.shockwaves = [];
    this.lightningSlashes = [];
    this.portals = [];
  }
}
