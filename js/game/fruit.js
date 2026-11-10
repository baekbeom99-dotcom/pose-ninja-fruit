/**
 * Pose Ninja Fruit - Fruit & HalfFruit Entities
 * Vector Illustration Art Style matching reference design.
 * Features 3x thicker banana bunch, crescent watermelon wedge, indented apple with leaf,
 * star-calyx orange, diamond-grid pineapple, cannonball bomb, and glowing heart.
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

    if (this.y > CONFIG.CANVAS.HEIGHT + 180) {
      this.isDead = true;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Clip to half space cleanly along the cut line (x <= 0 or x >= 0)
    const clipR = this.radius * 2.5;
    ctx.beginPath();
    if (this.isLeftHalf) {
      ctx.rect(-clipR, -clipR, clipR, clipR * 2);
    } else {
      ctx.rect(0, -clipR, clipR, clipR * 2);
    }
    ctx.clip();

    // Draw the full detailed fruit within the half clip
    FruitRenderer.drawFruitBody(ctx, this.config, 0);

    ctx.restore();

    // Draw realistic sliced cross-section cut face
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    FruitRenderer.drawCutFaceDetails(ctx, this.config, this.radius);
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
    this.angularVelocity = (Math.random() - 0.5) * 3.5;

    this.isSliced = false;
    this.isMissed = false;
    this.isDead = false;

    this.animTimer = Math.random() * 10;
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
      true
    );

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

    FruitRenderer.drawFruitBody(ctx, this.config, this.animTimer);

    ctx.restore();
  }
}

/**
 * Procedural Vector Graphics Renderer matching Reference Vector Art Style
 */
export class FruitRenderer {
  static drawFruitBody(ctx, config, animTimer = 0) {
    switch (config.type) {
      case 'WATERMELON':
        this.drawWatermelon(ctx, config, animTimer);
        break;
      case 'ORANGE':
        this.drawOrange(ctx, config, animTimer);
        break;
      case 'APPLE':
        this.drawApple(ctx, config, animTimer);
        break;
      case 'BANANA':
        this.drawBanana(ctx, config, animTimer);
        break;
      case 'PINEAPPLE':
        this.drawPineapple(ctx, config, animTimer);
        break;
      case 'BOMB':
        this.drawBomb(ctx, config, animTimer);
        break;
      case 'HEART_BONUS':
        this.drawHeartBonus(ctx, config, animTimer);
        break;
      default:
        this.drawClassicBase(ctx, config);
        break;
    }
  }

  /* ---------------- 1. WATERMELON (수박 조각 슬라이스 - Reference Row 3, Col 2) ---------------- */
  static drawWatermelon(ctx, config, animTimer) {
    const r = config.radius;

    // Outer Crescent Wedge Contour
    // Bottom curved rind arc
    const startX = -r * 0.90;
    const startY = -r * 0.22;
    const endX = r * 0.90;
    const endY = -r * 0.22;
    const bottomY = r * 0.72;

    // 1. Thick Green Outer Rind (진한 초록 껍질)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(startX - 4, startY - 2);
    ctx.quadraticCurveTo(0, bottomY + 12, endX + 4, endY - 2);
    ctx.lineTo(endX, endY);
    ctx.quadraticCurveTo(0, bottomY - 6, startX, startY);
    ctx.closePath();
    const rindGrad = ctx.createLinearGradient(0, startY, 0, bottomY + 12);
    rindGrad.addColorStop(0, '#16a34a');
    rindGrad.addColorStop(0.6, '#15803d');
    rindGrad.addColorStop(1, '#052e16');
    ctx.fillStyle = rindGrad;
    ctx.fill();
    ctx.restore();

    // 2. Pale Mint/White Inner Rind Stripe (연두/흰색 속 껍질 줄기)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(startX + 2, startY);
    ctx.quadraticCurveTo(0, bottomY - 6, endX - 2, endY);
    ctx.lineTo(endX - 5, endY + 2);
    ctx.quadraticCurveTo(0, bottomY - 14, startX + 5, startY + 2);
    ctx.closePath();
    ctx.fillStyle = '#dcfce7';
    ctx.fill();
    ctx.restore();

    // 3. Juicy Ruby-Red Watermelon Flesh (달콤한 빨간 과육 슬라이스)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(startX + 4, startY + 2);
    // Outer curved boundary
    ctx.quadraticCurveTo(0, bottomY - 14, endX - 4, endY + 2);
    // Slightly dipped top cut edge
    ctx.quadraticCurveTo(0, -r * 0.12, startX + 4, startY + 2);
    ctx.closePath();

    const fleshGrad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 0.85);
    fleshGrad.addColorStop(0, '#f87171');
    fleshGrad.addColorStop(0.4, '#ef4444');
    fleshGrad.addColorStop(1, '#dc2626');
    ctx.fillStyle = fleshGrad;
    ctx.fill();

    // 4. Teardrop Black Seeds (선명한 수박씨)
    const seeds = [
      { x: -r * 0.58, y: -r * 0.05, rot: -0.35 },
      { x: -r * 0.38, y: r * 0.16, rot: -0.22 },
      { x: -r * 0.15, y: r * 0.32, rot: -0.08 },
      { x: r * 0.12, y: r * 0.35, rot: 0.10 },
      { x: r * 0.38, y: r * 0.20, rot: 0.25 },
      { x: r * 0.60, y: -r * 0.02, rot: 0.38 }
    ];

    seeds.forEach(s => {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);

      // Teardrop seed shape
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.bezierCurveTo(3, -2, 3.5, 3, 0, 4.5);
      ctx.bezierCurveTo(-3.5, 3, -3, -2, 0, -5);
      ctx.fillStyle = '#1e293b';
      ctx.fill();

      // Seed specular gleam dot
      ctx.beginPath();
      ctx.arc(0.8, -0.5, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fill();
      ctx.restore();
    });

    // 5. Crisp Curved Specular Highlight (상단 흰색 광택 라인)
    ctx.beginPath();
    ctx.moveTo(startX + 18, startY + 12);
    ctx.quadraticCurveTo(0, -r * 0.04, endX - 18, endY + 12);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = r * 0.07;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
  }

  /* ---------------- 2. APPLE (사과 - Reference Row 2, Col 3) ---------------- */
  static drawApple(ctx, config, animTimer) {
    const r = config.radius;

    // 1. Brown Angled Stem (갈색 줄기)
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.50);
    ctx.quadraticCurveTo(-r * 0.08, -r * 0.75, -r * 0.14, -r * 0.94);
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = r * 0.10;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 2. Fresh Green Leaf pointing right (싱그러운 나뭇잎)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.54);
    ctx.quadraticCurveTo(r * 0.18, -r * 0.82, r * 0.44, -r * 0.74);
    ctx.quadraticCurveTo(r * 0.32, -r * 0.50, 0, -r * 0.54);
    ctx.closePath();
    ctx.fillStyle = '#22c55e';
    ctx.fill();

    // Leaf spine vein
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.54);
    ctx.quadraticCurveTo(r * 0.20, -r * 0.66, r * 0.40, -r * 0.72);
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 3. Apple Body with Top/Bottom Indentations (사과 몸체)
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.50);
    // Right upper shoulder
    ctx.bezierCurveTo(r * 0.38, -r * 0.92, r * 0.94, -r * 0.58, r * 0.88, r * 0.08);
    // Right bottom lobe
    ctx.bezierCurveTo(r * 0.82, r * 0.68, r * 0.38, r * 0.92, r * 0.14, r * 0.86);
    // Bottom indentation
    ctx.bezierCurveTo(r * 0.05, r * 0.84, -r * 0.05, r * 0.84, -r * 0.14, r * 0.86);
    // Left bottom lobe
    ctx.bezierCurveTo(-r * 0.38, r * 0.92, -r * 0.82, r * 0.68, -r * 0.88, r * 0.08);
    // Left upper shoulder
    ctx.bezierCurveTo(-r * 0.94, -r * 0.58, -r * 0.38, -r * 0.92, 0, -r * 0.50);
    ctx.closePath();

    const appleGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.20, 8, 0, 0, r * 0.95);
    appleGrad.addColorStop(0, '#f87171');
    appleGrad.addColorStop(0.35, '#ef4444');
    appleGrad.addColorStop(0.85, '#dc2626');
    appleGrad.addColorStop(1, '#991b1b');
    ctx.fillStyle = appleGrad;
    ctx.fill();

    // 4. Iconic Curved White Specular Highlight on Right Shoulder (우측 상단 곡선 광택)
    ctx.beginPath();
    ctx.moveTo(r * 0.56, -r * 0.48);
    ctx.bezierCurveTo(r * 0.78, -r * 0.30, r * 0.78, 0.05, r * 0.66, r * 0.32);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.lineWidth = r * 0.09;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Subtle small top-left reflection
    ctx.beginPath();
    ctx.arc(-r * 0.45, -r * 0.45, r * 0.10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.40)';
    ctx.fill();
  }

  /* ---------------- 3. ORANGE (오렌지 - Reference Row 3, Col 1) ---------------- */
  static drawOrange(ctx, config, animTimer) {
    const r = config.radius;

    // 1. Plump Round Orange Body (오렌지 둥근 몸체)
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const orangeGrad = ctx.createRadialGradient(-r * 0.28, -r * 0.28, 6, 0, 0, r);
    orangeGrad.addColorStop(0, '#fb923c');
    orangeGrad.addColorStop(0.6, '#f97316');
    orangeGrad.addColorStop(0.9, '#ea580c');
    orangeGrad.addColorStop(1, '#c2410c');
    ctx.fillStyle = orangeGrad;
    ctx.fill();

    // 2. Top Star Stem Calyx (상단 초록색 5각 꼭지 잎 - Reference 1:1)
    ctx.save();
    ctx.translate(0, -r * 0.86);
    ctx.beginPath();
    const starPoints = 5;
    const outerR = r * 0.22;
    const innerR = r * 0.10;
    for (let i = 0; i < starPoints * 2; i++) {
      const radius = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / starPoints - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#16a34a';
    ctx.fill();

    // Center brown stem pip
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#78350f';
    ctx.fill();
    ctx.restore();

    // 3. Smooth Curved White Specular Highlight on Upper-Right (우측 상단 부드러운 광택)
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.74, -Math.PI * 0.28, -Math.PI * 0.04);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.68)';
    ctx.lineWidth = r * 0.09;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Inner subtle glow
    ctx.beginPath();
    ctx.arc(r * 0.35, -r * 0.35, r * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fill();
  }

  /* ---------------- 4. BANANA (바나나송이 3배 굵기 - Reference Row 3, Col 4) ---------------- */
  static drawBanana(ctx, config, animTimer) {
    const r = config.radius;

    // 1. Brown Top Stem Cap (상단 꼭지 결합부 - 바나나 묶음 캡)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(r * 0.48, -r * 0.75);
    ctx.lineTo(r * 0.82, -r * 0.52);
    ctx.lineTo(r * 0.76, -r * 0.40);
    ctx.lineTo(r * 0.42, -r * 0.62);
    ctx.closePath();
    ctx.fillStyle = '#78350f';
    ctx.fill();
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 2. Lower / Rear Banana (뒤쪽 바나나 - 굵고 풍성한 2송이 묶음 볼륨)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(r * 0.62, -r * 0.45);
    // Outer sweep (very thick belly)
    ctx.bezierCurveTo(r * 0.50, r * 0.35, -r * 0.15, r * 0.72, -r * 0.62, r * 0.40);
    // Tip
    ctx.lineTo(-r * 0.68, r * 0.36);
    // Inner sweep
    ctx.bezierCurveTo(-r * 0.20, r * 0.42, r * 0.32, r * 0.15, r * 0.45, -r * 0.48);
    ctx.closePath();

    const rearGrad = ctx.createLinearGradient(r * 0.5, -r * 0.4, -r * 0.5, r * 0.5);
    rearGrad.addColorStop(0, '#facc15');
    rearGrad.addColorStop(0.7, '#eab308');
    rearGrad.addColorStop(1, '#ca8a04');
    ctx.fillStyle = rearGrad;
    ctx.fill();

    // Rear blossom tip
    ctx.beginPath();
    ctx.arc(-r * 0.66, r * 0.37, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#451a03';
    ctx.fill();
    ctx.restore();

    // 3. Main Front Banana (앞쪽 바나나 - 기존보다 3배 이상 굵고 통통한 형태!)
    ctx.save();
    ctx.beginPath();
    // Start at top stem junction
    ctx.moveTo(r * 0.52, -r * 0.60);
    // Sweeping outer curve (plump 3x belly width)
    ctx.bezierCurveTo(r * 0.35, r * 0.05, -r * 0.25, r * 0.58, -r * 0.85, 0.05);
    // Blossom bottom tip
    ctx.lineTo(-r * 0.88, -r * 0.04);
    // Sweeping inner belly curve (thick, juicy curvature)
    ctx.bezierCurveTo(-r * 0.35, -r * 0.08, r * 0.12, -r * 0.22, r * 0.42, -r * 0.66);
    ctx.closePath();

    const frontGrad = ctx.createLinearGradient(r * 0.4, -r * 0.5, -r * 0.6, 0.2);
    frontGrad.addColorStop(0, '#fef08a');
    frontGrad.addColorStop(0.35, '#fde047');
    frontGrad.addColorStop(0.85, '#facc15');
    frontGrad.addColorStop(1, '#eab308');
    ctx.fillStyle = frontGrad;
    ctx.fill();

    // 4. Creamy Top Ridge Highlight Ribbon (바나나 능선 밝은 면)
    ctx.beginPath();
    ctx.moveTo(r * 0.45, -r * 0.62);
    ctx.bezierCurveTo(r * 0.20, -r * 0.20, -r * 0.25, -r * 0.05, -r * 0.84, -r * 0.02);
    ctx.strokeStyle = '#fef9c3';
    ctx.lineWidth = r * 0.12;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 5. Dark Blossom Tip (바나나 끝부분 흑갈색 점)
    ctx.beginPath();
    ctx.arc(-r * 0.86, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#451a03';
    ctx.fill();

    // 6. Crisp Curved White Specular Highlight (바나나 외곽선 매끄러운 흰색 광택)
    ctx.beginPath();
    ctx.moveTo(r * 0.35, -r * 0.45);
    ctx.bezierCurveTo(r * 0.15, -r * 0.02, -r * 0.22, r * 0.32, -r * 0.68, 0.14);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = r * 0.07;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
  }

  /* ---------------- 5. PINEAPPLE (파인애플 - Reference Row 1, Col 3) ---------------- */
  static drawPineapple(ctx, config, animTimer) {
    const r = config.radius;

    // 1. Spiky Tropical 5-Point Crown Leaves (상단 5개의 야자형 왕관 잎 - Reference 1:1)
    ctx.save();
    const leaves = [
      // Outer left leaf
      { startX: -r * 0.10, startY: -r * 0.35, tipX: -r * 0.58, tipY: -r * 0.72, ctrlX: -r * 0.45, ctrlY: -r * 0.45 },
      // Inner left leaf
      { startX: -r * 0.05, startY: -r * 0.38, tipX: -r * 0.35, tipY: -r * 0.98, ctrlX: -r * 0.25, ctrlY: -r * 0.65 },
      // Center tall leaf
      { startX: 0, startY: -r * 0.40, tipX: 0, tipY: -r * 1.08, ctrlX: 0, ctrlY: -r * 0.75 },
      // Inner right leaf
      { startX: r * 0.05, startY: -r * 0.38, tipX: r * 0.35, tipY: -r * 0.98, ctrlX: r * 0.25, ctrlY: -r * 0.65 },
      // Outer right leaf
      { startX: r * 0.10, startY: -r * 0.35, tipX: r * 0.58, tipY: -r * 0.72, ctrlX: r * 0.45, ctrlY: -r * 0.45 }
    ];

    leaves.forEach((l, idx) => {
      ctx.beginPath();
      ctx.moveTo(l.startX, l.startY);
      ctx.quadraticCurveTo(l.ctrlX, l.ctrlY, l.tipX, l.tipY);
      ctx.quadraticCurveTo(l.ctrlX * 0.7, l.ctrlY * 1.1, l.startX, l.startY);
      ctx.closePath();

      const leafGrad = ctx.createLinearGradient(l.startX, l.startY, l.tipX, l.tipY);
      leafGrad.addColorStop(0, '#65a30d');
      leafGrad.addColorStop(0.6, '#4d7c0f');
      leafGrad.addColorStop(1, '#15803d');
      ctx.fillStyle = leafGrad;
      ctx.fill();
    });
    ctx.restore();

    // 2. Plump Golden Oval Body (둥글고 풍성한 황금빛 파인애플 몸체)
    ctx.save();
    const bodyCenterY = r * 0.20;
    const bodyR = r * 0.68;
    const bodyH = r * 0.78;

    ctx.beginPath();
    ctx.ellipse(0, bodyCenterY, bodyR, bodyH, 0, 0, Math.PI * 2);
    const bodyGrad = ctx.createRadialGradient(-r * 0.22, bodyCenterY - r * 0.25, 8, 0, bodyCenterY, bodyR);
    bodyGrad.addColorStop(0, '#fde047');
    bodyGrad.addColorStop(0.5, '#facc15');
    bodyGrad.addColorStop(0.9, '#eab308');
    bodyGrad.addColorStop(1, '#ca8a04');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // 3. Diamond Lattice Grid Pattern (마름모 격자 무늬 - Reference 1:1)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, bodyCenterY, bodyR - 2, bodyH - 2, 0, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2.8;

    const spacing = r * 0.28;
    // 45-degree diagonal lines
    for (let offset = -r * 2; offset <= r * 2; offset += spacing) {
      ctx.beginPath();
      ctx.moveTo(offset - r, bodyCenterY - r);
      ctx.lineTo(offset + r, bodyCenterY + r);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(offset + r, bodyCenterY - r);
      ctx.lineTo(offset - r, bodyCenterY + r);
      ctx.stroke();
    }

    // Small warm amber dots in each diamond center
    ctx.fillStyle = '#b45309';
    for (let x = -bodyR; x <= bodyR; x += spacing) {
      for (let y = bodyCenterY - bodyH; y <= bodyCenterY + bodyH; y += spacing) {
        if ((x * x) / (bodyR * bodyR) + ((y - bodyCenterY) * (y - bodyCenterY)) / (bodyH * bodyH) < 0.70) {
          ctx.beginPath();
          ctx.arc(x + spacing * 0.5, y + spacing * 0.5, 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();

    // 4. Curved White Specular Highlight on Right Shoulder
    ctx.beginPath();
    ctx.arc(0, bodyCenterY, bodyR * 0.82, -Math.PI * 0.25, 0);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = r * 0.08;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
  }

  /* ---------------- 6. BOMB (폭탄 - 캐논볼 벡터 스타일) ---------------- */
  static drawBomb(ctx, config, animTimer) {
    const r = config.radius;

    // 1. Sinuous Fuse with Spark (도화선 및 불꽃 애니메이션)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.80);
    ctx.bezierCurveTo(r * 0.15, -r * 1.10, r * 0.35, -r * 0.85, r * 0.48, -r * 1.05);
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Animated Fiery Sparks at Fuse Tip
    const sparkX = r * 0.48;
    const sparkY = -r * 1.05;
    const flicker = Math.sin(animTimer * 20) * 3;

    // Golden glow halo
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 14 + flicker, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
    ctx.fill();

    // Fire core star
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 7 + flicker * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
    ctx.restore();

    // 2. Brass Neck Collar (황동 결합부)
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-r * 0.22, -r * 0.90, r * 0.44, r * 0.22, 4);
    ctx.fillStyle = '#d97706';
    ctx.fill();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 3. Charcoal Cannonball Sphere (매끄러운 검은색 구체)
    ctx.beginPath();
    ctx.arc(0, r * 0.08, r * 0.88, 0, Math.PI * 2);
    const bombGrad = ctx.createRadialGradient(-r * 0.28, -r * 0.20, 6, 0, r * 0.08, r * 0.88);
    bombGrad.addColorStop(0, '#475569');
    bombGrad.addColorStop(0.4, '#1e293b');
    bombGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bombGrad;
    ctx.fill();

    // 4. White Curved Specular Highlight (좌측 상단 하이라이트)
    ctx.beginPath();
    ctx.arc(0, r * 0.08, r * 0.68, -Math.PI * 0.85, -Math.PI * 0.55);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.80)';
    ctx.lineWidth = r * 0.09;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  /* ---------------- 7. HEART BONUS (보너스 하트) ---------------- */
  static drawHeartBonus(ctx, config, animTimer) {
    const r = config.radius;
    const pulse = Math.sin(animTimer * 5) * 0.05;

    ctx.save();
    ctx.scale(1 + pulse, 1 + pulse);

    // Heart Shape Path
    ctx.beginPath();
    ctx.moveTo(0, r * 0.72);
    // Left bottom curve to upper lobe
    ctx.bezierCurveTo(-r * 0.85, r * 0.25, -r * 0.95, -r * 0.45, -r * 0.45, -r * 0.72);
    ctx.bezierCurveTo(-r * 0.15, -r * 0.85, 0, -r * 0.52, 0, -r * 0.35);
    // Right upper lobe to bottom point
    ctx.bezierCurveTo(0, -r * 0.52, r * 0.15, -r * 0.85, r * 0.45, -r * 0.72);
    ctx.bezierCurveTo(r * 0.95, -r * 0.45, r * 0.85, r * 0.25, 0, r * 0.72);
    ctx.closePath();

    const heartGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.35, 6, 0, 0, r * 0.9);
    heartGrad.addColorStop(0, '#fb7185');
    heartGrad.addColorStop(0.4, '#f43f5e');
    heartGrad.addColorStop(0.85, '#e11d48');
    heartGrad.addColorStop(1, '#9f1239');
    ctx.fillStyle = heartGrad;
    ctx.fill();

    // Curved Specular Highlight on Left Lobe
    ctx.beginPath();
    ctx.arc(-r * 0.45, -r * 0.48, r * 0.28, -Math.PI * 0.75, -Math.PI * 0.15);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = r * 0.08;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
  }

  /* ---------------- Sliced Cross-Section Details ---------------- */
  static drawCutFaceDetails(ctx, config, radius) {
    const r = radius;

    // Sliced cut rim line
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.strokeStyle = config.fleshColor || '#ffffff';
    ctx.lineWidth = 6;
    ctx.stroke();

    if (config.type === 'WATERMELON') {
      // 2 black seeds visible along the cut face
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, -r * 0.35, 4.5, 0, Math.PI * 2);
      ctx.arc(0, r * 0.35, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (config.type === 'ORANGE') {
      // Radial citrus segments and center core
      ctx.fillStyle = '#fff7ed';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (config.type === 'APPLE') {
      // Core and seed pip
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (config.type === 'BANANA') {
      // 3 tiny black center seed specks
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.arc(0, -8, 2.5, 0, Math.PI * 2);
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.arc(0, 8, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  static drawClassicBase(ctx, config) {
    const r = config.radius;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = config.color;
    ctx.fill();
  }
}
