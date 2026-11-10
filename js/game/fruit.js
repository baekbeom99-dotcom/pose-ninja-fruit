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

    // Clip to half space cleanly along the cut line (x <= 0 or x >= 0)
    const clipR = this.radius * 2.2;
    ctx.beginPath();
    if (this.isLeftHalf) {
      ctx.rect(-clipR, -clipR, clipR, clipR * 2);
    } else {
      ctx.rect(0, -clipR, clipR, clipR * 2);
    }
    ctx.clip();

    // Draw the full detailed fruit within the half clip
    FruitRenderer.drawFruitBody(ctx, this.config, 0, this.themeId);

    ctx.restore();

    // Draw realistic sliced cross-section cut face
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    FruitRenderer.drawCutFaceDetails(ctx, this.config, this.radius, this.themeId);
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

    FruitRenderer.drawFruitBody(ctx, this.config, this.animTimer, this.themeId);

    ctx.restore();
  }
}

/**
 * Procedural Vector & Multi-Theme Graphics Renderer
 * Delivers rich, mouth-watering details for Watermelon, Orange, Apple, Banana, Pineapple, Bomb, and Heart.
 */
class FruitRenderer {
  static drawFruitBody(ctx, config, animTimer = 0, theme = 'CLAYMORPHISM') {
    switch (config.type) {
      case 'WATERMELON':
        this.drawWatermelon(ctx, config, animTimer, theme);
        break;
      case 'ORANGE':
        this.drawOrange(ctx, config, animTimer, theme);
        break;
      case 'APPLE':
        this.drawApple(ctx, config, animTimer, theme);
        break;
      case 'BANANA':
        this.drawBanana(ctx, config, animTimer, theme);
        break;
      case 'PINEAPPLE':
        this.drawPineapple(ctx, config, animTimer, theme);
        break;
      case 'BOMB':
        this.drawBomb(ctx, config, animTimer, theme);
        break;
      case 'HEART_BONUS':
        this.drawHeartBonus(ctx, config, animTimer, theme);
        break;
      default:
        this.drawClassicBase(ctx, config, theme);
        break;
    }
  }

  /* ---------------- 1. WATERMELON (수박) ---------------- */
  static drawWatermelon(ctx, config, animTimer, theme) {
    const r = config.radius;

    // Outer Drop Shadow for Clay/Paper
    if (theme === 'CLAYMORPHISM') {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 12;
    }

    // Outer Green Sphere Rind
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const rindGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 4, 0, 0, r);
    rindGrad.addColorStop(0, '#22c55e');
    rindGrad.addColorStop(0.7, '#16a34a');
    rindGrad.addColorStop(1, '#15803d');
    ctx.fillStyle = rindGrad;
    ctx.fill();

    if (theme === 'CLAYMORPHISM') ctx.restore();

    // Iconic Wavy Dark Green Stripes (수박 줄무늬)
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = '#052e16';
    ctx.lineWidth = r * 0.14;
    ctx.lineCap = 'round';

    for (let stripe = -3; stripe <= 3; stripe++) {
      const baseX = stripe * (r * 0.28);
      ctx.beginPath();
      for (let y = -r; y <= r; y += 8) {
        const wave = Math.sin(y * 0.08 + stripe * 1.5) * (r * 0.06);
        const x = baseX * Math.sqrt(Math.max(0, 1 - (y * y) / (r * r))) + wave;
        if (y === -r) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Pale Mint-Green Inner Rind (속 껍질)
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2);
    ctx.fillStyle = config.rindColor || '#bbf7d0';
    ctx.fill();

    // Juicy Ruby Red Flesh (빨간 과육)
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2);
    const fleshGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, r * 0.74);
    fleshGrad.addColorStop(0, '#ef4444');
    fleshGrad.addColorStop(0.75, '#dc2626');
    fleshGrad.addColorStop(1, '#b91c1c');
    ctx.fillStyle = fleshGrad;
    ctx.fill();

    // Concentric Teardrop Watermelon Seeds (수박씨)
    const seedAngles = [0.2, 0.8, 1.45, 2.1, 2.75, 3.4, 4.05, 4.7, 5.35, 6.0];
    seedAngles.forEach(angle => {
      const dist = r * 0.50;
      const sx = Math.cos(angle) * dist;
      const sy = Math.sin(angle) * dist;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(angle + Math.PI / 2);

      // Black teardrop seed
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.quadraticCurveTo(4, 0, 0, 6);
      ctx.quadraticCurveTo(-4, 0, 0, -6);
      ctx.fillStyle = '#09090b';
      ctx.fill();

      // Seed specular glint
      ctx.beginPath();
      ctx.arc(-1, -1.5, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.restore();
    });

    // Clay/Classic Specular Highlight Arc
    this._drawGlossyArc(ctx, r);
  }

  /* ---------------- 2. ORANGE (오렌지) ---------------- */
  static drawOrange(ctx, config, animTimer, theme) {
    const r = config.radius;

    // Drop Shadow
    if (theme === 'CLAYMORPHISM') {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 12;
    }

    // Outer Orange Peel Body with Dimpled Texture
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const peelGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 4, 0, 0, r);
    peelGrad.addColorStop(0, '#fb923c');
    peelGrad.addColorStop(0.65, '#f97316');
    peelGrad.addColorStop(1, '#ea580c');
    ctx.fillStyle = peelGrad;
    ctx.fill();

    if (theme === 'CLAYMORPHISM') ctx.restore();

    // Citrus Peel Pores (오렌지 껍질 모공 엠보싱)
    ctx.save();
    ctx.fillStyle = 'rgba(194, 65, 12, 0.28)';
    for (let p = 0; p < 18; p++) {
      const a = (p * 2.39);
      const d = r * (0.86 + (p % 3) * 0.04);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Creamy White Pith Layer (하얀 속껍질)
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
    ctx.fillStyle = '#ffedd5';
    ctx.fill();

    // 8 Juicy Citrus Segments / Wedges (과육 8조각)
    const segCount = 8;
    const segRadius = r * 0.74;
    const wedgeAngle = (Math.PI * 2) / segCount;

    for (let s = 0; s < segCount; s++) {
      const startA = s * wedgeAngle + 0.08;
      const endA = (s + 1) * wedgeAngle - 0.08;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, segRadius, startA, endA);
      ctx.closePath();

      const segGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, segRadius);
      segGrad.addColorStop(0, '#fdba74');
      segGrad.addColorStop(0.6, '#fb923c');
      segGrad.addColorStop(1, '#ea580c');
      ctx.fillStyle = segGrad;
      ctx.fill();

      // Translucent pulp vesicle highlights (과육 알갱이)
      const midA = (startA + endA) / 2;
      const vx = Math.cos(midA) * (segRadius * 0.65);
      const vy = Math.sin(midA) * (segRadius * 0.65);
      ctx.beginPath();
      ctx.arc(vx, vy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fill();
    }

    // Central White Core Star (중심 기둥)
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = '#fff7ed';
    ctx.fill();

    // Top Calyx / Emerald Star Leaf (꼭지 별모양)
    ctx.save();
    ctx.translate(0, -r * 0.82);
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const tipX = Math.cos(a) * (r * 0.15);
      const tipY = Math.sin(a) * (r * 0.15);
      if (i === 0) ctx.moveTo(tipX, tipY);
      else ctx.lineTo(tipX, tipY);
      const inA = a + Math.PI / 5;
      ctx.lineTo(Math.cos(inA) * (r * 0.06), Math.sin(inA) * (r * 0.06));
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    this._drawGlossyArc(ctx, r);
  }

  /* ---------------- 3. APPLE (사과) ---------------- */
  static drawApple(ctx, config, animTimer, theme) {
    const r = config.radius;

    // Sculpted Parametric Apple Silhouette Path
    const drawApplePath = () => {
      ctx.beginPath();
      // Start at top stem indent cleft
      ctx.moveTo(0, -r * 0.68);
      // Top right lobe curve
      ctx.bezierCurveTo(r * 0.55, -r * 0.95, r * 1.05, -r * 0.45, r * 0.95, r * 0.15);
      // Bottom right curve
      ctx.bezierCurveTo(r * 0.88, r * 0.65, r * 0.48, r * 0.98, r * 0.15, r * 0.95);
      // Bottom center cleft
      ctx.lineTo(0, r * 0.86);
      // Bottom left curve
      ctx.lineTo(-r * 0.15, r * 0.95);
      ctx.bezierCurveTo(-r * 0.48, r * 0.98, -r * 0.88, r * 0.65, -r * 0.95, r * 0.15);
      // Top left lobe curve
      ctx.bezierCurveTo(-r * 1.05, -r * 0.45, -r * 0.55, -r * 0.95, 0, -r * 0.68);
      ctx.closePath();
    };

    // Shadow
    if (theme === 'CLAYMORPHISM') {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 14;
      drawApplePath();
      ctx.fillStyle = '#dc2626';
      ctx.fill();
      ctx.restore();
    }

    // Apple Body with Rich Crimson Gradient & Golden Blush
    drawApplePath();
    const appleGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.25, 6, 0, 0, r * 1.05);
    appleGrad.addColorStop(0, '#fde047'); // Sunny golden highlight
    appleGrad.addColorStop(0.2, '#f87171');
    appleGrad.addColorStop(0.65, '#dc2626');
    appleGrad.addColorStop(1, '#991b1b'); // Deep crimson shadow
    ctx.fillStyle = appleGrad;
    ctx.fill();

    // Fine Speckles / Lenticels (사과 표면 점박이 텍스처)
    ctx.save();
    ctx.fillStyle = 'rgba(254, 240, 138, 0.35)';
    for (let i = 0; i < 22; i++) {
      const a = i * 1.7;
      const d = r * (0.3 + (i % 5) * 0.12);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Realistic Curved Brown Stem (사과 꼭지)
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.66);
    ctx.bezierCurveTo(-r * 0.08, -r * 0.95, r * 0.15, -r * 1.15, r * 0.18, -r * 1.22);
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Emerald Green Leaf with Vein (신선한 초록 잎사귀)
    ctx.save();
    ctx.translate(r * 0.08, -r * 0.88);
    ctx.rotate(-0.4);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(r * 0.35, -r * 0.28, r * 0.52, 0);
    ctx.quadraticCurveTo(r * 0.35, r * 0.28, 0, 0);
    const leafGrad = ctx.createLinearGradient(0, -r * 0.2, r * 0.5, r * 0.2);
    leafGrad.addColorStop(0, '#22c55e');
    leafGrad.addColorStop(1, '#15803d');
    ctx.fillStyle = leafGrad;
    ctx.fill();

    // Leaf center vein
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(r * 0.25, -r * 0.04, r * 0.50, 0);
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();

    // Glossy Specular Shine on Left Lobe
    ctx.beginPath();
    ctx.ellipse(-r * 0.42, -r * 0.28, r * 0.18, r * 0.34, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fill();
  }

  /* ---------------- 4. BANANA (바나나) ---------------- */
  static drawBanana(ctx, config, animTimer, theme) {
    const r = config.radius;

    // Iconic Curved Crescent Banana Body
    const drawBananaCrescent = () => {
      ctx.beginPath();
      // Start at stalk tip
      ctx.moveTo(-r * 0.82, -r * 0.55);
      // Outer sweeping curve
      ctx.bezierCurveTo(-r * 0.45, r * 0.72, r * 0.45, r * 0.72, r * 0.82, -r * 0.25);
      // Blossom bottom tip
      ctx.lineTo(r * 0.88, -r * 0.20);
      // Inner sweeping curve
      ctx.bezierCurveTo(r * 0.40, r * 0.25, -r * 0.40, r * 0.25, -r * 0.78, -r * 0.60);
      ctx.closePath();
    };

    // Shadow
    if (theme === 'CLAYMORPHISM') {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 12;
      drawBananaCrescent();
      ctx.fillStyle = '#facc15';
      ctx.fill();
      ctx.restore();
    }

    // Outer Sunny Golden Yellow Peel
    drawBananaCrescent();
    const peelGrad = ctx.createLinearGradient(-r * 0.7, -r * 0.5, r * 0.7, r * 0.5);
    peelGrad.addColorStop(0, '#fef08a');
    peelGrad.addColorStop(0.5, '#facc15');
    peelGrad.addColorStop(1, '#eab308');
    ctx.fillStyle = peelGrad;
    ctx.fill();

    // Faceted Ridge Spine (바나나 능선 선)
    ctx.beginPath();
    ctx.moveTo(-r * 0.80, -r * 0.58);
    ctx.bezierCurveTo(-r * 0.42, r * 0.52, r * 0.42, r * 0.52, r * 0.85, -r * 0.22);
    ctx.strokeStyle = 'rgba(202, 138, 4, 0.65)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Green-brown Stem Stalk at Top End (꼭지 줄기)
    ctx.beginPath();
    ctx.moveTo(-r * 0.78, -r * 0.60);
    ctx.lineTo(-r * 0.95, -r * 0.72);
    ctx.strokeStyle = '#65a30d';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Dark Blossom Crown at Bottom End (바나나 끝부분)
    ctx.beginPath();
    ctx.arc(r * 0.87, -r * 0.21, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#451a03';
    ctx.fill();

    // Scattered Sugar Freckles (달콤하게 익은 슈가스팟 점박이)
    ctx.fillStyle = 'rgba(120, 53, 15, 0.55)';
    const sugarSpots = [
      [-r * 0.35, r * 0.42],
      [-r * 0.15, r * 0.48],
      [r * 0.15, r * 0.46],
      [r * 0.42, r * 0.28],
      [r * 0.62, r * 0.05]
    ];
    sugarSpots.forEach(([sx, sy]) => {
      ctx.beginPath();
      ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Specular Highlight Glaze along Outer Curve
    ctx.beginPath();
    ctx.moveTo(-r * 0.65, -r * 0.35);
    ctx.bezierCurveTo(-r * 0.35, r * 0.55, r * 0.35, r * 0.55, r * 0.70, -r * 0.15);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.62)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  /* ---------------- 5. PINEAPPLE (파인애플) ---------------- */
  static drawPineapple(ctx, config, animTimer, theme) {
    const r = config.radius;

    // Drop Shadow
    if (theme === 'CLAYMORPHISM') {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 14;
    }

    // Oval Body Silhouette (둥근 몸통)
    const bodyW = r * 0.82;
    const bodyH = r * 1.05;
    const bodyY = r * 0.12;

    ctx.beginPath();
    ctx.ellipse(0, bodyY, bodyW, bodyH, 0, 0, Math.PI * 2);
    const pineGrad = ctx.createRadialGradient(-bodyW * 0.3, bodyY - bodyH * 0.3, 8, 0, bodyY, bodyH);
    pineGrad.addColorStop(0, '#fde047');
    pineGrad.addColorStop(0.4, '#f59e0b');
    pineGrad.addColorStop(1, '#b45309');
    ctx.fillStyle = pineGrad;
    ctx.fill();

    if (theme === 'CLAYMORPHISM') ctx.restore();

    // Diamond Scales Mesh / Cross-Hatch Grid (파인애플 껍질 그물 패턴)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, bodyY, bodyW - 2, bodyH - 2, 0, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3.5;

    // Diagonal lines /
    for (let x = -bodyW * 2; x <= bodyW * 2; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x - bodyH, bodyY - bodyH);
      ctx.lineTo(x + bodyH, bodyY + bodyH);
      ctx.stroke();
    }

    // Diagonal lines \
    for (let x = -bodyW * 2; x <= bodyW * 2; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x + bodyH, bodyY - bodyH);
      ctx.lineTo(x - bodyH, bodyY + bodyH);
      ctx.stroke();
    }

    // Diamond Center Eye Bracts (껍질 눈 점들)
    ctx.fillStyle = '#451a03';
    for (let row = -3; row <= 3; row++) {
      for (let col = -3; col <= 3; col++) {
        const eyeX = col * 22 + (row % 2) * 11;
        const eyeY = bodyY + row * 18;
        if ((eyeX * eyeX) / (bodyW * bodyW) + ((eyeY - bodyY) * (eyeY - bodyY)) / (bodyH * bodyH) < 0.82) {
          ctx.beginPath();
          ctx.arc(eyeX, eyeY, 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();

    // Crown of Spiky Tropical Green Leaves (풍성한 열대 잎사귀 왕관)
    ctx.save();
    ctx.translate(0, -r * 0.82);

    const leafSpecs = [
      { angle: -0.65, length: r * 0.70, width: 14, color: '#15803d' },
      { angle: 0.65, length: r * 0.70, width: 14, color: '#15803d' },
      { angle: -0.42, length: r * 0.85, width: 16, color: '#16a34a' },
      { angle: 0.42, length: r * 0.85, width: 16, color: '#16a34a' },
      { angle: -0.20, length: r * 0.98, width: 18, color: '#22c55e' },
      { angle: 0.20, length: r * 0.98, width: 18, color: '#22c55e' },
      { angle: 0, length: r * 1.05, width: 20, color: '#4ade80' }
    ];

    leafSpecs.forEach(leaf => {
      ctx.save();
      ctx.rotate(leaf.angle);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-leaf.width, -leaf.length * 0.5, 0, -leaf.length);
      ctx.quadraticCurveTo(leaf.width, -leaf.length * 0.5, 0, 0);
      ctx.fillStyle = leaf.color;
      ctx.fill();

      // Leaf center vein
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -leaf.length * 0.88);
      ctx.strokeStyle = '#86efac';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.restore();
    });
    ctx.restore();

    this._drawGlossyArc(ctx, r);
  }

  /* ---------------- 6. BOMB (폭탄) ---------------- */
  static drawBomb(ctx, config, animTimer, theme) {
    const r = config.radius;

    // Drop Shadow
    if (theme === 'CLAYMORPHISM') {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = 26;
      ctx.shadowOffsetY = 14;
    }

    // Cast Iron Metallic Sphere
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const ironGrad = ctx.createRadialGradient(-r * 0.35, -r * 0.35, 6, 0, 0, r);
    ironGrad.addColorStop(0, '#94a3b8');
    ironGrad.addColorStop(0.3, '#475569');
    ironGrad.addColorStop(0.75, '#1e293b');
    ironGrad.addColorStop(1, '#020617');
    ctx.fillStyle = ironGrad;
    ctx.fill();

    if (theme === 'CLAYMORPHISM') ctx.restore();

    // Hazard Yellow/Black Caution Stripes Band (위험 경고 줄무늬)
    ctx.save();
    ctx.beginPath();
    ctx.rect(-r * 0.85, -r * 0.22, r * 1.7, r * 0.44);
    ctx.clip();

    ctx.fillStyle = '#facc15';
    ctx.fillRect(-r, -r * 0.25, r * 2, r * 0.5);

    ctx.fillStyle = '#0f172a';
    ctx.lineWidth = 14;
    for (let x = -r * 2; x <= r * 2; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, -r * 0.25);
      ctx.lineTo(x + 18, r * 0.25);
      ctx.lineTo(x + 8, r * 0.25);
      ctx.lineTo(x - 10, -r * 0.25);
      ctx.fill();
    }
    ctx.restore();

    // Brass Neck Fuse Collar (황동 결합부)
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-r * 0.25, -r - 12, r * 0.5, 14);

    // Braided Rope Fuse (도화선)
    ctx.beginPath();
    ctx.moveTo(0, -r - 10);
    ctx.quadraticCurveTo(r * 0.3, -r - 30, r * 0.45, -r - 42);
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Flickering Animated Spark & Smoke (타오르는 도화선 불꽃)
    const sparkX = r * 0.45 + (Math.random() - 0.5) * 6;
    const sparkY = -r - 42 + (Math.random() - 0.5) * 6;

    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 24;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  /* ---------------- 7. HEART BONUS (보너스 하트) ---------------- */
  static drawHeartBonus(ctx, config, animTimer, theme) {
    const r = config.radius;
    const pulse = 1 + Math.sin(animTimer * 6.5) * 0.08;

    ctx.save();
    ctx.scale(pulse, pulse);

    // Glowing Golden Aura
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 32;

    ctx.beginPath();
    const topH = r * 0.6;
    ctx.moveTo(0, r * 0.25);
    ctx.bezierCurveTo(-r * 0.9, -r * 0.45, -r * 0.95, topH, 0, r * 0.95);
    ctx.bezierCurveTo(r * 0.95, topH, r * 0.9, -r * 0.45, 0, r * 0.25);
    ctx.closePath();

    const rubyGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 6, 0, 0, r);
    rubyGrad.addColorStop(0, '#fef08a');
    rubyGrad.addColorStop(0.35, '#f43f5e');
    rubyGrad.addColorStop(1, '#9f1239');
    ctx.fillStyle = rubyGrad;
    ctx.fill();

    // Golden Edge Rim
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Facet Highlight Cuts
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, 0);
    ctx.lineTo(0, r * 0.65);
    ctx.lineTo(r * 0.4, 0);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.restore();
  }

  /* ---------------- SLICED CUT FACE DETAILS (단면 디테일) ---------------- */
  static drawCutFaceDetails(ctx, config, radius, theme) {
    const r = radius;

    // Outer Sliced Rim Highlight Line
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.strokeStyle = config.fleshColor || '#ffffff';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Specific inner cross-section details
    if (config.type === 'WATERMELON') {
      // 2 black seeds visible along the cut face
      ctx.fillStyle = '#09090b';
      ctx.beginPath();
      ctx.arc(0, -r * 0.35, 4, 0, Math.PI * 2);
      ctx.arc(0, r * 0.35, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (config.type === 'ORANGE') {
      // Center core dot
      ctx.fillStyle = '#fff7ed';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (config.type === 'APPLE') {
      // Dark brown seed pip in the cut center
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (config.type === 'BANANA') {
      // Tiny black center dots
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.arc(0, -6, 2, 0, Math.PI * 2);
      ctx.arc(0, 6, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---------------- HELPER: Specular Shine ---------------- */
  static _drawGlossyArc(ctx, r) {
    ctx.beginPath();
    ctx.arc(-r * 0.32, -r * 0.32, r * 0.20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fill();
  }

  static drawClassicBase(ctx, config, theme) {
    const r = config.radius;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = config.color;
    ctx.fill();
  }
}
