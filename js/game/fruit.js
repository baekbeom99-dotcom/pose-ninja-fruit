/**
 * Fruit, HalfFruit, and Bomb Entities
 * Procedurally rendered with Canvas 2D, parabolic physics, and slicing split mechanics
 */
import { CONFIG } from '../config.js';

export class HalfFruit {
  constructor(fruitConfig, x, y, vx, vy, cutAngle, isLeftHalf) {
    this.config = fruitConfig;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = fruitConfig.radius;
    this.cutAngle = cutAngle;
    this.isLeftHalf = isLeftHalf;
    this.rotation = cutAngle;
    this.angularVelocity = isLeftHalf ? -CONFIG.PHYSICS.HALF_ANGULAR_VELOCITY : CONFIG.PHYSICS.HALF_ANGULAR_VELOCITY;
    this.isDead = false;
  }

  update(dt) {
    this.vy += CONFIG.PHYSICS.GRAVITY * dt;
    this.vx *= CONFIG.PHYSICS.AIR_RESISTANCE;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.angularVelocity * dt;

    if (this.y > CONFIG.CANVAS.HEIGHT + 120) {
      this.isDead = true;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Clip to half circle along the cut line
    ctx.beginPath();
    if (this.isLeftHalf) {
      ctx.arc(0, 0, this.radius + 2, -Math.PI / 2, Math.PI / 2, true);
    } else {
      ctx.arc(0, 0, this.radius + 2, -Math.PI / 2, Math.PI / 2, false);
    }
    ctx.closePath();
    ctx.clip();

    // Draw the fruit content
    FruitRenderer.drawFruitBody(ctx, this.config);

    // Draw slice face cross-section highlight along the cut diameter
    ctx.restore();

    // Subtle edge highlight along the cut
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.beginPath();
    ctx.moveTo(0, -this.radius);
    ctx.lineTo(0, this.radius);
    ctx.strokeStyle = this.config.fleshColor || '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
}

export class Fruit {
  constructor(fruitConfig, startX, startY, vx, vy) {
    this.config = fruitConfig;
    this.type = fruitConfig.type;
    this.radius = fruitConfig.radius;
    this.points = fruitConfig.points;

    this.x = startX;
    this.y = startY;
    this.vx = vx;
    this.vy = vy;

    this.rotation = Math.random() * Math.PI * 2;
    this.angularVelocity = (Math.random() - 0.5) * 4;

    this.isSliced = false;
    this.isMissed = false;
    this.isDead = false;

    // Bomb fuse animation timer
    this.fuseTimer = 0;
  }

  update(dt) {
    this.vy += CONFIG.PHYSICS.GRAVITY * dt;
    this.vx *= CONFIG.PHYSICS.AIR_RESISTANCE;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.angularVelocity * dt;
    this.fuseTimer += dt;

    // Check if missed falling below screen without being sliced
    if (!this.isSliced && this.vy > 0 && this.y > CONFIG.CANVAS.HEIGHT + this.radius) {
      this.isMissed = true;
      this.isDead = true;
    }
  }

  /**
   * Slices the fruit into two halves ejected along the normal vector
   * @param {number} cutAngle - Angle of cut in radians
   * @param {{x: number, y: number}} normal - Normal vector perpendicular to cut
   * @returns {[HalfFruit, HalfFruit]}
   */
  slice(cutAngle, normal) {
    this.isSliced = true;
    this.isDead = true;

    if (this.type === 'BOMB') {
      return []; // Bombs detonate rather than producing clean halves
    }

    const pushSpeed = CONFIG.PHYSICS.HALF_SEPARATION_SPEED;
    
    // Half 1 pushed along +normal
    const h1 = new HalfFruit(
      this.config,
      this.x,
      this.y,
      this.vx + normal.x * pushSpeed,
      this.vy + normal.y * pushSpeed - 50,
      cutAngle,
      true
    );

    // Half 2 pushed along -normal
    const h2 = new HalfFruit(
      this.config,
      this.x,
      this.y,
      this.vx - normal.x * pushSpeed,
      this.vy - normal.y * pushSpeed - 50,
      cutAngle,
      false
    );

    return [h1, h2];
  }

  draw(ctx) {
    if (this.isDead) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    if (this.type === 'BOMB') {
      FruitRenderer.drawBomb(ctx, this.config, this.fuseTimer);
    } else {
      FruitRenderer.drawFruitBody(ctx, this.config);
    }

    ctx.restore();
  }
}

/**
 * Procedural Vector Graphics Renderer for Canvas 2D
 */
class FruitRenderer {
  static drawFruitBody(ctx, config) {
    switch (config.type) {
      case 'WATERMELON':
        this.drawWatermelon(ctx, config);
        break;
      case 'ORANGE':
        this.drawOrange(ctx, config);
        break;
      case 'APPLE':
        this.drawApple(ctx, config);
        break;
      case 'BANANA':
        this.drawBanana(ctx, config);
        break;
      case 'PINEAPPLE':
        this.drawPineapple(ctx, config);
        break;
      default:
        this.drawGenericFruit(ctx, config);
    }
  }

  static drawWatermelon(ctx, config) {
    const r = config.radius;
    // Outer dark green rind
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = config.color;
    ctx.fill();

    // Dark green rind stripes
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 4;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, r - 2, r * 0.7, (i * Math.PI) / 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Pale green inner rind
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
    ctx.fillStyle = config.rindColor;
    ctx.fill();

    // Red flesh
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = config.fleshColor;
    ctx.fill();

    // Seeds
    ctx.fillStyle = '#0f172a';
    const seedAngles = [0, 0.7, 1.4, 2.1, 2.8, 3.5, 4.2, 4.9, 5.6];
    seedAngles.forEach(a => {
      const sx = Math.cos(a) * (r * 0.52);
      const sy = Math.sin(a) * (r * 0.52);
      ctx.beginPath();
      ctx.ellipse(sx, sy, 3, 2, a + Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  static drawOrange(ctx, config) {
    const r = config.radius;
    // Orange skin
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = config.color;
    ctx.fill();

    // Inner white pith
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
    ctx.fillStyle = config.rindColor;
    ctx.fill();

    // Orange flesh center
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
    ctx.fillStyle = config.fleshColor;
    ctx.fill();

    // Segment lines
    ctx.strokeStyle = config.rindColor;
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82);
      ctx.stroke();
    }
  }

  static drawApple(ctx, config) {
    const r = config.radius;
    // Apple lobes shape
    ctx.beginPath();
    ctx.arc(-r * 0.35, 0, r * 0.7, 0, Math.PI * 2);
    ctx.arc(r * 0.35, 0, r * 0.7, 0, Math.PI * 2);
    ctx.arc(0, r * 0.3, r * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = config.color;
    ctx.fill();

    // Top stem
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.7);
    ctx.quadraticCurveTo(6, -r * 1.1, 10, -r * 1.25);
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Green leaf
    ctx.beginPath();
    ctx.ellipse(8, -r * 0.95, 8, 4, Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = '#22c55e';
    ctx.fill();
  }

  static drawBanana(ctx, config) {
    const r = config.radius;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-r * 1.1, -r * 0.3);
    ctx.quadraticCurveTo(0, r * 0.9, r * 1.1, -r * 0.3);
    ctx.quadraticCurveTo(0, r * 0.4, -r * 1.1, -r * 0.3);
    ctx.fillStyle = config.color;
    ctx.fill();

    // End tips
    ctx.fillStyle = '#713f12';
    ctx.beginPath();
    ctx.arc(-r * 1.05, -r * 0.28, 4, 0, Math.PI * 2);
    ctx.arc(r * 1.05, -r * 0.28, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  static drawPineapple(ctx, config) {
    const r = config.radius;
    // Oval body
    ctx.beginPath();
    ctx.ellipse(0, r * 0.15, r * 0.75, r * 0.9, 0, 0, Math.PI * 2);
    ctx.fillStyle = config.color;
    ctx.fill();

    // Cross-hatch diamond texture
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, i * 15 - 10);
      ctx.lineTo(r * 0.6, i * 15 + 10);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-r * 0.6, i * 15 + 10);
      ctx.lineTo(r * 0.6, i * 15 - 10);
      ctx.stroke();
    }

    // Green spiky crown
    ctx.fillStyle = config.rindColor;
    [-0.3, 0, 0.3].forEach(offset => {
      ctx.beginPath();
      ctx.moveTo(offset * r, -r * 0.6);
      ctx.lineTo(offset * r * 1.4, -r * 1.35);
      ctx.lineTo((offset + 0.15) * r, -r * 0.6);
      ctx.fill();
    });
  }

  static drawBomb(ctx, config, fuseTimer) {
    const r = config.radius;
    // Dark sphere
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
    grad.addColorStop(0, '#64748b');
    grad.addColorStop(0.5, '#1e293b');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fill();

    // Fuse cap
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-6, -r - 5, 12, 6);

    // Fuse rope
    ctx.beginPath();
    ctx.moveTo(0, -r - 5);
    ctx.quadraticCurveTo(10, -r - 18, 16, -r - 22);
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Animated spark at the tip of the fuse
    const sparkX = 16 + Math.sin(fuseTimer * 25) * 2;
    const sparkY = -r - 22 + Math.cos(fuseTimer * 25) * 2;
    
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 5 + Math.sin(fuseTimer * 30) * 2, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  static drawGenericFruit(ctx, config) {
    ctx.beginPath();
    ctx.arc(0, 0, config.radius, 0, Math.PI * 2);
    ctx.fillStyle = config.color;
    ctx.fill();
  }
}
