/**
 * Fruit, HalfFruit, Bomb, and HeartBonus Entities with Multi-Theme Support (2x Size Scale)
 */
import { CONFIG } from '../config.js';

export class HalfFruit {
  constructor(fruitConfig, x, y, vx, vy, cutAngle, isLeftHalf, themeId = 'CLAYMORPHISM') {
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
    this.themeId = themeId;
  }

  update(dt) {
    this.vy += CONFIG.PHYSICS.GRAVITY * dt;
    this.vx *= CONFIG.PHYSICS.AIR_RESISTANCE;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.angularVelocity * dt;

    if (this.y > CONFIG.CANVAS.HEIGHT + 180) {
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
      ctx.arc(0, 0, this.radius + 8, -Math.PI / 2, Math.PI / 2, true);
    } else {
      ctx.arc(0, 0, this.radius + 8, -Math.PI / 2, Math.PI / 2, false);
    }
    ctx.closePath();
    ctx.clip();

    // Draw the fruit content in current theme
    FruitRenderer.drawFruitBody(ctx, this.config, 0, this.themeId);

    ctx.restore();

    // Sliced cut face rim highlight
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.beginPath();
    ctx.moveTo(0, -this.radius);
    ctx.lineTo(0, this.radius);
    ctx.strokeStyle = this.config.fleshColor || '#ffffff';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();
  }
}

export class Fruit {
  constructor(fruitConfig, startX, startY, vx, vy, themeId = 'CLAYMORPHISM') {
    this.config = fruitConfig;
    this.type = fruitConfig.type;
    this.radius = fruitConfig.radius;
    this.points = fruitConfig.points;

    this.x = startX;
    this.y = startY;
    this.vx = vx;
    this.vy = vy;

    this.rotation = Math.random() * Math.PI * 2;
    this.angularVelocity = (Math.random() - 0.5) * 3.5;

    this.isSliced = false;
    this.isMissed = false;
    this.isDead = false;

    this.animTimer = Math.random() * 10;
    this.themeId = themeId;
  }

  update(dt) {
    this.vy += CONFIG.PHYSICS.GRAVITY * dt;
    this.vx *= CONFIG.PHYSICS.AIR_RESISTANCE;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.angularVelocity * dt;
    this.animTimer += dt;

    if (!this.isSliced && this.vy > 0 && this.y > CONFIG.CANVAS.HEIGHT + this.radius + 20) {
      this.isMissed = true;
      this.isDead = true;
    }
  }

  slice(cutAngle, normal) {
    this.isSliced = true;
    this.isDead = true;

    if (this.type === 'BOMB') {
      return [];
    }

    const pushSpeed = CONFIG.PHYSICS.HALF_SEPARATION_SPEED;
    const h1 = new HalfFruit(
      this.config,
      this.x,
      this.y,
      this.vx + normal.x * pushSpeed,
      this.vy + normal.y * pushSpeed - 50,
      cutAngle,
      true,
      this.themeId
    );

    const h2 = new HalfFruit(
      this.config,
      this.x,
      this.y,
      this.vx - normal.x * pushSpeed,
      this.vy - normal.y * pushSpeed - 50,
      cutAngle,
      false,
      this.themeId
    );

    return [h1, h2];
  }

  draw(ctx) {
    if (this.isDead) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    if (this.type === 'BOMB') {
      FruitRenderer.drawBomb(ctx, this.config, this.animTimer, this.themeId);
    } else if (this.type === 'HEART_BONUS') {
      FruitRenderer.drawHeartBonus(ctx, this.config, this.animTimer, this.themeId);
    } else {
      FruitRenderer.drawFruitBody(ctx, this.config, this.animTimer, this.themeId);
    }

    ctx.restore();
  }
}

/**
 * Multi-Theme Procedural Graphics Renderer (Scaled for 2x size)
 */
class FruitRenderer {
  static drawFruitBody(ctx, config, animTimer = 0, theme = 'CLAYMORPHISM') {
    switch (theme) {
      case 'PIXEL_ART':
        this.drawPixelStyle(ctx, config);
        break;
      case 'CLAYMORPHISM':
        this.drawClayStyle(ctx, config);
        break;
      case 'PAPER_CUT':
        this.drawPaperStyle(ctx, config);
        break;
      default:
        this.drawClassicStyle(ctx, config);
        break;
    }
  }

  /* ---------------- 1. CLAYMORPHISM STYLE ---------------- */
  static drawClayStyle(ctx, config) {
    const r = config.radius;

    // Clay drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 14;

    // Base Puffy Body
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = config.color;
    ctx.fill();
    ctx.restore();

    // Inner bevel / 3D inflated volume highlight
    const clayGrad = ctx.createRadialGradient(-r * 0.35, -r * 0.35, 6, 0, 0, r);
    clayGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
    clayGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.15)');
    clayGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0)');
    clayGrad.addColorStop(1, 'rgba(0, 0, 0, 0.38)');

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = clayGrad;
    ctx.fill();

    // Soft Inner Core
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = config.fleshColor;
    ctx.fill();

    // Glossy specular highlight
    ctx.beginPath();
    ctx.arc(-r * 0.35, -r * 0.35, r * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.fill();
  }

  /* ---------------- 2. RETRO PIXEL ART STYLE ---------------- */
  static drawPixelStyle(ctx, config) {
    const r = config.radius;
    const px = 10; // Scaled pixel block size for 2x
    const steps = Math.floor(r / px);

    for (let gx = -steps; gx <= steps; gx++) {
      for (let gy = -steps; gy <= steps; gy++) {
        const dist = Math.sqrt(gx * gx + gy * gy) * px;
        if (dist <= r) {
          const x = gx * px;
          const y = gy * px;

          let blockColor = config.color;
          if (dist > r - px * 1.5) {
            blockColor = '#0f172a'; // Black pixel outline
          } else if (dist < r * 0.68) {
            blockColor = config.fleshColor;
          }

          if (gx >= -steps * 0.6 && gx <= -steps * 0.3 && gy >= -steps * 0.6 && gy <= -steps * 0.3) {
            blockColor = '#ffffff';
          }

          ctx.fillStyle = blockColor;
          ctx.fillRect(x, y, px, px);
        }
      }
    }
  }

  /* ---------------- 3. PAPER-CUT STYLE ---------------- */
  static drawPaperStyle(ctx, config) {
    const r = config.radius;

    // Layer 1: Dark Backing Paper
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 8;

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = config.color;
    ctx.fill();
    ctx.restore();

    // Layer 2: Middle Rind Paper Sheet with Crease
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 6;

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = config.rindColor || '#ffffff';
    ctx.fill();
    ctx.restore();

    // Layer 3: Top Flesh Paper Cutout
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = config.fleshColor;
    ctx.fill();
    ctx.restore();

    // Paper fold crease line across middle
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, 0);
    ctx.lineTo(r * 0.7, 0);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  /* ---------------- 4. CLASSIC VECTOR STYLE ---------------- */
  static drawClassicStyle(ctx, config) {
    const r = config.radius;
    // Outer Rind
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = config.color;
    ctx.fill();

    // Outer Rind Stripes for Watermelon
    if (config.type === 'WATERMELON') {
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 6;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, r - 3, r * 0.72, (i * Math.PI) / 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Inner Rind
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
    ctx.fillStyle = config.rindColor;
    ctx.fill();

    // Center Flesh
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.76, 0, Math.PI * 2);
    ctx.fillStyle = config.fleshColor;
    ctx.fill();

    // Seeds for Watermelon
    if (config.type === 'WATERMELON') {
      ctx.fillStyle = '#0f172a';
      const seedAngles = [0, 0.7, 1.4, 2.1, 2.8, 3.5, 4.2, 4.9, 5.6];
      seedAngles.forEach(a => {
        const sx = Math.cos(a) * (r * 0.52);
        const sy = Math.sin(a) * (r * 0.52);
        ctx.beginPath();
        ctx.ellipse(sx, sy, 5, 3, a + Math.PI / 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  /* ---------------- HEART BONUS RENDERER (2x) ---------------- */
  static drawHeartBonus(ctx, config, animTimer, theme) {
    const r = config.radius;
    const pulse = 1 + Math.sin(animTimer * 6.5) * 0.08;

    ctx.save();
    ctx.scale(pulse, pulse);

    if (theme === 'PIXEL_ART') {
      const px = 10;
      const heartMatrix = [
        [0, 1, 1, 0, 0, 1, 1, 0],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [0, 1, 1, 1, 1, 1, 1, 0],
        [0, 0, 1, 1, 1, 1, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0]
      ];
      const ox = -4 * px;
      const oy = -3.5 * px;
      for (let row = 0; row < heartMatrix.length; row++) {
        for (let col = 0; col < heartMatrix[row].length; col++) {
          if (heartMatrix[row][col]) {
            ctx.fillStyle = (row === 1 && col === 1) ? '#ffffff' : '#f43f5e';
            ctx.fillRect(ox + col * px, oy + row * px, px, px);
          }
        }
      }
      ctx.restore();
      return;
    }

    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 32;

    ctx.beginPath();
    const topCurveHeight = r * 0.6;
    ctx.moveTo(0, r * 0.25);
    ctx.bezierCurveTo(-r * 0.9, -r * 0.45, -r * 0.95, topCurveHeight, 0, r * 0.95);
    ctx.bezierCurveTo(r * 0.95, topCurveHeight, r * 0.9, -r * 0.45, 0, r * 0.25);
    ctx.closePath();

    const grad = ctx.createRadialGradient(0, 0, 6, 0, 0, r);
    grad.addColorStop(0, '#fef08a');
    grad.addColorStop(0.3, '#ec4899');
    grad.addColorStop(1, '#e11d48');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.restore();
  }

  /* ---------------- BOMB RENDERER (2x) ---------------- */
  static drawBomb(ctx, config, fuseTimer, theme) {
    const r = config.radius;

    if (theme === 'PIXEL_ART') {
      const px = 10;
      const steps = Math.floor(r / px);
      for (let gx = -steps; gx <= steps; gx++) {
        for (let gy = -steps; gy <= steps; gy++) {
          if (Math.sqrt(gx * gx + gy * gy) * px <= r) {
            ctx.fillStyle = (gx < -2 && gy < -2) ? '#94a3b8' : '#0f172a';
            ctx.fillRect(gx * px, gy * px, px, px);
          }
        }
      }
      ctx.fillStyle = Math.sin(fuseTimer * 20) > 0 ? '#facc15' : '#ef4444';
      ctx.fillRect(12, -r - 18, px, px);
      return;
    }

    // Sphere Body
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 4, 0, 0, r);
    grad.addColorStop(0, '#64748b');
    grad.addColorStop(0.5, '#1e293b');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fill();

    // Fuse cap & line
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-10, -r - 8, 20, 10);

    ctx.beginPath();
    ctx.moveTo(0, -r - 8);
    ctx.quadraticCurveTo(14, -r - 26, 22, -r - 32);
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Animated spark
    const sparkX = 22 + Math.sin(fuseTimer * 25) * 3;
    const sparkY = -r - 32 + Math.cos(fuseTimer * 25) * 3;
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 22;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
