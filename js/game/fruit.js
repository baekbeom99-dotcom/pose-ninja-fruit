/**
 * Pose Ninja Fruit - Fruit & HalfFruit Entities
 * Vector Illustration Art Style matching reference design.
 * Features 3x thicker banana bunch, crescent watermelon wedge, indented apple with leaf,
 * star-calyx orange, diamond-grid pineapple, cannonball bomb, and glowing heart.
 */
import { CONFIG } from '../config.js';

export class HalfFruit {
  constructor(fruitConfig, x, y, vx, vy, cutAngle, isLeftHalf, scale = 1.0) {
    this.config = fruitConfig;
    this.scale = scale;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = fruitConfig.radius * scale;
    this.cutAngle = cutAngle;
    this.isLeftHalf = isLeftHalf;
    this.rotation = cutAngle;
    this.angularVelocity = isLeftHalf ? -CONFIG.PHYSICS.HALF_ANGULAR_VELOCITY : CONFIG.PHYSICS.HALF_ANGULAR_VELOCITY;
    this.isDead = false;

    // 3-second smooth fadeout before removal
    this.maxLife = 3.0;
    this.life = 3.0;
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) {
      this.isDead = true;
      return;
    }

    this.vy += CONFIG.PHYSICS.GRAVITY * dt;
    this.vx *= CONFIG.PHYSICS.AIR_RESISTANCE;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.angularVelocity * dt;

    // Floor dampening: keep sliced debris visible bouncing/sliding at the screen bottom while fading
    const floorY = CONFIG.CANVAS.HEIGHT - this.radius * 0.35;
    if (this.y > floorY) {
      this.y = floorY;
      if (this.vy > 0) {
        this.vy = -this.vy * 0.22;
      }
      this.vx *= 0.88;
      this.angularVelocity *= 0.85;
    }
  }

  draw(ctx) {
    if (this.isDead || this.life <= 0) return;

    const alpha = Math.max(0, Math.min(1.0, this.life / this.maxLife));

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(this.scale, this.scale);

    // Clip to half space cleanly along the cut line (x <= 0 or x >= 0)
    const baseR = this.radius / this.scale;
    const clipR = baseR * 2.5;
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
  }
}

export class Fruit {
  constructor(fruitConfig, startX, startY, vx, vy, scale = 1.0) {
    this.config = fruitConfig;
    this.type = fruitConfig.type;
    this.scale = scale;
    this.radius = fruitConfig.radius * scale;
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
      true,
      this.scale
    );

    const h2 = new HalfFruit(
      this.config,
      this.x,
      this.y,
      this.vx - normal.x * pushSpeed,
      this.vy - normal.y * pushSpeed - 50,
      cutAngle,
      false,
      this.scale
    );

    return [h1, h2];
  }

  draw(ctx) {
    if (this.isDead) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(this.scale, this.scale);

    FruitRenderer.drawFruitBody(ctx, this.config, this.animTimer);

    ctx.restore();
  }
}

/**
 * Procedural Vector Graphics Renderer matching Reference Illustration ('Vector Fruits & Vegetable' Kawaii Art)
 * Based on iStock kawaii character set (cute faces, flat solid colors, border-free silhouettes, capsule highlights).
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
      case 'STRAWBERRY':
        this.drawStrawberry(ctx, config, animTimer);
        break;
      case 'PEACH':
        this.drawPeach(ctx, config, animTimer);
        break;
      case 'AVOCADO':
        this.drawAvocado(ctx, config, animTimer);
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

  /**
   * Universal Cute/Kawaii Face Template matching Reference Illustration Exactly
   * - Flat solid dark charcoal dots for eyes (#1a1a1a) with wide baby-like spacing
   * - Flat solid pink circular dots for blushing cheeks (#ff8a99)
   * - Clean sweet upward curve stroke for smile (⌣)
   */
  static drawKawaiiFace(ctx, cx, cy, r, options = {}) {
    const {
      eyeDist = r * 0.46,
      eyeR = r * 0.082,
      smileR = r * 0.15,
      smileOffsetY = r * 0.06,
      blushOffsetX = r * 0.48,
      blushOffsetY = r * 0.07,
      blushR = r * 0.115,
      blushColor = '#ff8a99',
      eyeColor = '#1a1a1a',
      expression = 'smile', // 'smile', 'wink', 'happy', 'bomb'
      tiltAngle = 0
    } = options;

    ctx.save();
    ctx.translate(cx, cy);
    if (tiltAngle) ctx.rotate(tiltAngle);

    // 1. Rosy Blushing Cheeks (발그레한 핑크빛 볼터치)
    ctx.fillStyle = blushColor;
    ctx.beginPath();
    ctx.arc(-blushOffsetX, blushOffsetY, blushR, 0, Math.PI * 2);
    ctx.arc(blushOffsetX, blushOffsetY, blushR, 0, Math.PI * 2);
    ctx.fill();

    // 2. Eyes (단색 블랙 써클 눈)
    ctx.fillStyle = eyeColor;
    ctx.strokeStyle = eyeColor;
    ctx.lineWidth = r * 0.052;
    ctx.lineCap = 'round';

    if (expression === 'wink') {
      ctx.beginPath();
      ctx.arc(-eyeDist / 2, 0, eyeR, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(eyeDist / 2, eyeR * 0.35, eyeR * 1.25, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.stroke();
    } else if (expression === 'happy') {
      ctx.beginPath();
      ctx.arc(-eyeDist / 2, eyeR * 0.35, eyeR * 1.25, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(eyeDist / 2, eyeR * 0.35, eyeR * 1.25, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.stroke();
    } else if (expression === 'bomb') {
      ctx.beginPath();
      ctx.arc(-eyeDist / 2, 0, eyeR, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(eyeDist / 2, eyeR * 0.35, eyeR * 1.25, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.stroke();

      ctx.strokeStyle = eyeColor;
      ctx.lineWidth = r * 0.045;
      ctx.beginPath();
      ctx.moveTo(-eyeDist / 2 - eyeR * 1.1, -eyeR * 1.3);
      ctx.lineTo(-eyeDist / 2 + eyeR * 0.9, -eyeR * 0.8);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(eyeDist / 2 + eyeR * 1.1, -eyeR * 1.3);
      ctx.lineTo(eyeDist / 2 - eyeR * 0.9, -eyeR * 0.8);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(-eyeDist / 2, 0, eyeR, 0, Math.PI * 2);
      ctx.arc(eyeDist / 2, 0, eyeR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Sweet smiling mouth arc (⌣)
    ctx.strokeStyle = eyeColor;
    ctx.lineWidth = r * 0.052;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, smileOffsetY, smileR, 0.22 * Math.PI, 0.78 * Math.PI, false);
    ctx.stroke();

    ctx.restore();
  }

  /* ---------------- 1. WATERMELON (수박 - Reference Row 3, Col 5: 삼각 웨지 조각) ---------------- */
  static drawWatermelon(ctx, config, animTimer) {
    const r = config.radius;

    // 1. Outer Green Rind Arc (하단 둥근 초록 껍질)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-r * 0.76, r * 0.44);
    ctx.quadraticCurveTo(0, r * 1.08, r * 0.76, r * 0.44);
    ctx.lineTo(r * 0.70, r * 0.28);
    ctx.quadraticCurveTo(0, r * 0.86, -r * 0.70, r * 0.28);
    ctx.closePath();
    ctx.fillStyle = '#52b759';
    ctx.fill();

    // 2. Inner Pale Green/Cream Rim (연두빛 속껍질 띠)
    ctx.beginPath();
    ctx.moveTo(-r * 0.70, r * 0.28);
    ctx.quadraticCurveTo(0, r * 0.86, r * 0.70, r * 0.28);
    ctx.lineTo(r * 0.64, r * 0.16);
    ctx.quadraticCurveTo(0, r * 0.72, -r * 0.64, r * 0.16);
    ctx.closePath();
    ctx.fillStyle = '#d8f0bc';
    ctx.fill();

    // 3. Red Flesh Triangular Wedge (빨간 과육 삼각 조각)
    ctx.beginPath();
    ctx.moveTo(-r * 0.64, r * 0.16);
    ctx.quadraticCurveTo(0, r * 0.72, r * 0.64, r * 0.16);
    ctx.quadraticCurveTo(r * 0.24, -r * 0.48, 0, -r * 0.88);
    ctx.quadraticCurveTo(-r * 0.24, -r * 0.48, -r * 0.64, r * 0.16);
    ctx.closePath();
    ctx.fillStyle = '#e83a45';
    ctx.fill();

    // 4. Black Teardrop Seeds (검은 씨앗들)
    const seeds = [
      { x: 0, y: -r * 0.58 },
      { x: -r * 0.20, y: -r * 0.36 },
      { x: r * 0.20, y: -r * 0.36 },
      { x: -r * 0.36, y: -r * 0.10 },
      { x: r * 0.36, y: -r * 0.10 },
      { x: -r * 0.35, y: r * 0.22 },
      { x: r * 0.35, y: r * 0.22 },
      { x: 0, y: r * 0.32 }
    ];

    ctx.fillStyle = '#1a1a1a';
    seeds.forEach(s => {
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, r * 0.04, r * 0.068, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // 5. Kawaii Face (정중앙 카와이 표정)
    this.drawKawaiiFace(ctx, 0, 0.04 * r, r * 0.78, {
      blushColor: '#ff6b81',
      eyeColor: '#1a1a1a'
    });

    ctx.restore();
  }

  /* ---------------- 2. APPLE (사과 - Reference Row 2, Col 4) ---------------- */
  static drawApple(ctx, config, animTimer) {
    const r = config.radius;

    // 1. Brown Twig Stem pointing right (갈색 줄기)
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.45);
    ctx.quadraticCurveTo(r * 0.05, -r * 0.75, r * 0.12, -r * 0.90);
    ctx.strokeStyle = '#8b573a';
    ctx.lineWidth = r * 0.11;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 2. Rounded Green Leaf on Right (오른쪽 둥근 초록 잎)
    ctx.beginPath();
    ctx.ellipse(r * 0.35, -r * 0.72, r * 0.26, r * 0.16, -0.28, 0, Math.PI * 2);
    ctx.fillStyle = '#52b759';
    ctx.fill();

    // 3. Apple Body with Indentations (빨간 사과 몸체)
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.45);
    ctx.bezierCurveTo(r * 0.36, -r * 0.88, r * 0.92, -r * 0.55, r * 0.86, r * 0.08);
    ctx.bezierCurveTo(r * 0.80, r * 0.68, r * 0.36, r * 0.90, r * 0.12, r * 0.84);
    ctx.bezierCurveTo(r * 0.04, r * 0.82, -r * 0.04, r * 0.82, -r * 0.12, r * 0.84);
    ctx.bezierCurveTo(-r * 0.36, r * 0.90, -r * 0.80, r * 0.68, -r * 0.86, r * 0.08);
    ctx.bezierCurveTo(-r * 0.92, -r * 0.55, -r * 0.36, -r * 0.88, 0, -r * 0.45);
    ctx.closePath();
    ctx.fillStyle = '#f04351';
    ctx.fill();

    // 4. White Capsule Gloss Highlight on Upper-Left (좌측 상단 캡슐형 광택)
    ctx.save();
    ctx.translate(-r * 0.48, -r * 0.32);
    ctx.rotate(-0.55);
    ctx.beginPath();
    ctx.roundRect(-r * 0.09, -r * 0.20, r * 0.18, r * 0.40, r * 0.09);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // 5. Kawaii Face (카와이 표정)
    this.drawKawaiiFace(ctx, 0, r * 0.12, r * 0.85, {
      blushColor: '#ff8595',
      eyeColor: '#1a1a1a'
    });
  }

  /* ---------------- 3. ORANGE (오렌지 - Reference Row 1, Col 5) ---------------- */
  static drawOrange(ctx, config, animTimer) {
    const r = config.radius;

    // 1. Brown Twig Stem (갈색 꼭지)
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.82);
    ctx.quadraticCurveTo(r * 0.06, -r * 1.02, r * 0.16, -r * 1.12);
    ctx.strokeStyle = '#8b573a';
    ctx.lineWidth = r * 0.11;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 2. Horizontal Rounded Green Leaf on Right (우측 수평 초록 잎)
    ctx.beginPath();
    ctx.ellipse(r * 0.44, -r * 0.92, r * 0.30, r * 0.16, 0.12, 0, Math.PI * 2);
    ctx.fillStyle = '#52b759';
    ctx.fill();

    // 3. Plump Round Orange Body (오렌지 둥근 몸체)
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
    ctx.fillStyle = '#ff8b26';
    ctx.fill();

    // 4. Kawaii Face (카와이 표정)
    this.drawKawaiiFace(ctx, 0, r * 0.05, r * 0.85, {
      blushColor: '#ff6d50',
      eyeColor: '#1a1a1a'
    });
  }

  /* ---------------- 4. BANANA (바나나 - Reference Row 3, Col 1) ---------------- */
  static drawBanana(ctx, config, animTimer) {
    const r = config.radius;

    ctx.save();
    // 1. Top Flat-Cut Stem (상단 각진 꼭지)
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, -r * 0.72);
    ctx.lineTo(-r * 0.28, -r * 0.78);
    ctx.lineTo(-r * 0.22, -r * 0.62);
    ctx.lineTo(-r * 0.38, -r * 0.58);
    ctx.closePath();
    ctx.fillStyle = '#fce068';
    ctx.fill();

    // 2. Main Curved Banana Body (바나나 곡면 몸체)
    ctx.beginPath();
    ctx.moveTo(-r * 0.38, -r * 0.58);
    ctx.bezierCurveTo(-r * 0.20, -r * 0.10, r * 0.05, r * 0.40, r * 0.52, r * 0.72);
    ctx.bezierCurveTo(r * 0.65, r * 0.80, r * 0.78, r * 0.75, r * 0.75, r * 0.58);
    ctx.bezierCurveTo(r * 0.40, r * 0.15, 0, -r * 0.25, -r * 0.22, -r * 0.62);
    ctx.closePath();
    ctx.fillStyle = '#ffdd40';
    ctx.fill();

    // 3. Inner Pale Facet Highlight Ribbon (안쪽 연노랑 면 하이라이트)
    ctx.beginPath();
    ctx.moveTo(-r * 0.30, -r * 0.54);
    ctx.bezierCurveTo(-r * 0.10, -r * 0.12, r * 0.12, r * 0.30, r * 0.58, r * 0.64);
    ctx.bezierCurveTo(r * 0.48, r * 0.42, r * 0.15, r * 0.05, -r * 0.24, -r * 0.46);
    ctx.closePath();
    ctx.fillStyle = '#fffa85';
    ctx.fill();

    // 4. Dark Brown Blossom Tip (하단 갈색 끝점)
    ctx.beginPath();
    ctx.ellipse(r * 0.68, r * 0.68, r * 0.09, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#5a3825';
    ctx.fill();

    // 5. Kawaii Face along Banana Spine (바나나 몸통의 카와이 표정)
    this.drawKawaiiFace(ctx, 0.05 * r, 0.05 * r, r * 0.80, {
      blushColor: '#ff8a99',
      eyeColor: '#1a1a1a',
      tiltAngle: 0.52
    });

    ctx.restore();
  }

  /* ---------------- 5. PINEAPPLE (파인애플 - Reference Row 1, Col 3) ---------------- */
  static drawPineapple(ctx, config, animTimer) {
    const r = config.radius;

    // 1. Spiky Green 5-Blade Crown Leaves (상단 5개 녹색 잎)
    ctx.save();
    const leaves = [
      { tipX: -r * 0.52, tipY: -r * 0.70, baseL: -r * 0.35, baseR: -r * 0.15 },
      { tipX: -r * 0.28, tipY: -r * 0.98, baseL: -r * 0.22, baseR: -r * 0.04 },
      { tipX: 0, tipY: -r * 1.12, baseL: -r * 0.15, baseR: r * 0.15 },
      { tipX: r * 0.28, tipY: -r * 0.98, baseL: r * 0.04, baseR: r * 0.22 },
      { tipX: r * 0.52, tipY: -r * 0.70, baseL: r * 0.15, baseR: r * 0.35 }
    ];

    leaves.forEach(l => {
      ctx.beginPath();
      ctx.moveTo(l.baseL, -r * 0.40);
      ctx.lineTo(l.tipX, l.tipY);
      ctx.lineTo(l.baseR, -r * 0.40);
      ctx.closePath();
      ctx.fillStyle = '#52b759';
      ctx.fill();
    });
    ctx.restore();

    // 2. Plump Golden Oval Body (둥근 타원형 황금빛 몸체)
    ctx.save();
    const bodyCenterY = r * 0.15;
    const bodyR = r * 0.68;
    const bodyH = r * 0.82;

    ctx.beginPath();
    ctx.ellipse(0, bodyCenterY, bodyR, bodyH, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd147';
    ctx.fill();

    // 3. Orange Diamond Lattice Grid (오렌지색 마름모 격자 선)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, bodyCenterY, bodyR, bodyH, 0, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = '#ffa526';
    ctx.lineWidth = 3.2;

    const spacing = r * 0.30;
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
    ctx.restore();

    // 4. Centered Kawaii Face (정중앙 카와이 표정)
    this.drawKawaiiFace(ctx, 0, bodyCenterY, r * 0.88, {
      blushColor: '#ff8a99',
      eyeColor: '#1a1a1a'
    });

    ctx.restore();
  }

  /* ---------------- 6. STRAWBERRY (딸기 - Reference Row 3, Col 3) ---------------- */
  static drawStrawberry(ctx, config, animTimer) {
    const r = config.radius;

    // 1. Green Stem & Calyx Cap (상단 줄기와 4엽 꽃받침)
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.65);
    ctx.lineTo(0, -r * 0.90);
    ctx.strokeStyle = '#52b759';
    ctx.lineWidth = r * 0.12;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.fillStyle = '#52b759';
    const lobes = [
      { cx: -r * 0.42, cy: -r * 0.58, rx: r * 0.20, ry: r * 0.14, rot: -0.4 },
      { cx: -r * 0.15, cy: -r * 0.62, rx: r * 0.18, ry: r * 0.14, rot: -0.1 },
      { cx: r * 0.15, cy: -r * 0.62, rx: r * 0.18, ry: r * 0.14, rot: 0.1 },
      { cx: r * 0.42, cy: -r * 0.58, rx: r * 0.20, ry: r * 0.14, rot: 0.4 }
    ];
    lobes.forEach(l => {
      ctx.beginPath();
      ctx.ellipse(l.cx, l.cy, l.rx, l.ry, l.rot, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. Red Berry Body (빨간 딸기 몸체)
    ctx.beginPath();
    ctx.moveTo(-r * 0.65, -r * 0.45);
    ctx.bezierCurveTo(-r * 0.85, -r * 0.10, -r * 0.55, r * 0.60, 0, r * 0.82);
    ctx.bezierCurveTo(r * 0.55, r * 0.60, r * 0.85, -r * 0.10, r * 0.65, -r * 0.45);
    ctx.quadraticCurveTo(0, -r * 0.52, -r * 0.65, -r * 0.45);
    ctx.closePath();
    ctx.fillStyle = '#f23c4a';
    ctx.fill();

    // 3. Cream Seed Polka Dots (크림색 땡땡이 씨앗)
    const seedPositions = [
      { x: -r * 0.45, y: -r * 0.20 },
      { x: r * 0.45, y: -r * 0.20 },
      { x: -r * 0.28, y: -r * 0.32 },
      { x: r * 0.28, y: -r * 0.32 },
      { x: 0, y: -r * 0.36 },
      { x: -r * 0.48, y: 0.08 },
      { x: r * 0.48, y: 0.08 },
      { x: -r * 0.32, y: r * 0.35 },
      { x: r * 0.32, y: r * 0.35 },
      { x: -r * 0.15, y: r * 0.55 },
      { x: r * 0.15, y: r * 0.55 },
      { x: 0, y: r * 0.68 }
    ];
    ctx.fillStyle = '#ffe5e8';
    seedPositions.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 0.045, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. Kawaii Face (정중앙 카와이 표정)
    this.drawKawaiiFace(ctx, 0, 0.06 * r, r * 0.82, {
      blushColor: '#ff8595',
      eyeColor: '#1a1a1a'
    });
  }

  /* ---------------- 7. PEACH (복숭아 - Reference Row 3, Col 2) ---------------- */
  static drawPeach(ctx, config, animTimer) {
    const r = config.radius;

    // 1. Green Leaf on Top Right (상단 우측 녹색 잎)
    ctx.beginPath();
    ctx.ellipse(r * 0.24, -r * 0.72, r * 0.24, r * 0.14, 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#52b759';
    ctx.fill();

    // 2. Peach Body with Bottom-Left Tip (좌하단 꼭지 복숭아 몸체)
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.55);
    ctx.bezierCurveTo(r * 0.40, -r * 0.85, r * 0.90, -r * 0.45, r * 0.84, r * 0.15);
    ctx.bezierCurveTo(r * 0.75, r * 0.65, r * 0.30, r * 0.85, -r * 0.15, r * 0.82);
    ctx.lineTo(-r * 0.30, r * 0.84);
    ctx.bezierCurveTo(-r * 0.55, r * 0.70, -r * 0.88, r * 0.45, -r * 0.84, -r * 0.05);
    ctx.bezierCurveTo(-r * 0.80, -r * 0.55, -r * 0.35, -r * 0.85, 0, -r * 0.55);
    ctx.closePath();
    ctx.fillStyle = '#ff9f96';
    ctx.fill();

    // 3. White Capsule Gloss Highlight on Upper-Left Shoulder (좌상단 캡슐형 광택)
    ctx.save();
    ctx.translate(-r * 0.45, -r * 0.35);
    ctx.rotate(-0.6);
    ctx.beginPath();
    ctx.roundRect(-r * 0.08, -r * 0.18, r * 0.16, r * 0.36, r * 0.08);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // 4. Kawaii Face (카와이 표정)
    this.drawKawaiiFace(ctx, 0, r * 0.10, r * 0.82, {
      blushColor: '#ff6b7d',
      eyeColor: '#1a1a1a'
    });
  }

  /* ---------------- 8. AVOCADO (아보카도 - Reference Row 1, Col 4) ---------------- */
  static drawAvocado(ctx, config, animTimer) {
    const r = config.radius;

    const tracePear = (scale) => {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.85 * scale);
      ctx.bezierCurveTo(r * 0.45 * scale, -r * 0.85 * scale, r * 0.52 * scale, -r * 0.25 * scale, r * 0.72 * scale, r * 0.25 * scale);
      ctx.bezierCurveTo(r * 0.85 * scale, r * 0.65 * scale, r * 0.50 * scale, r * 0.95 * scale, 0, r * 0.95 * scale);
      ctx.bezierCurveTo(-r * 0.50 * scale, r * 0.95 * scale, -r * 0.85 * scale, r * 0.65 * scale, -r * 0.72 * scale, r * 0.25 * scale);
      ctx.bezierCurveTo(-r * 0.52 * scale, -r * 0.25 * scale, -r * 0.45 * scale, -r * 0.85 * scale, 0, -r * 0.85 * scale);
      ctx.closePath();
    };

    // 1. Dark Green Outer Skin Rim
    tracePear(1.0);
    ctx.fillStyle = '#52a338';
    ctx.fill();

    // 2. Pale Creamy Flesh Face
    tracePear(0.88);
    ctx.fillStyle = '#fcf395';
    ctx.fill();

    // 3. Round Brown Pit (하단 갈색 씨앗)
    ctx.beginPath();
    ctx.arc(0, r * 0.35, r * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = '#855333';
    ctx.fill();

    // 4. Kawaii Face above Pit (씨앗 윗부분 카와이 표정)
    this.drawKawaiiFace(ctx, 0, -r * 0.28, r * 0.68, {
      blushColor: '#ff8a99',
      eyeColor: '#1a1a1a'
    });
  }

  /* ---------------- 9. BOMB (폭탄 - 카와이 캐논볼) ---------------- */
  static drawBomb(ctx, config, animTimer) {
    const r = config.radius;

    // 1. Sinuous Fuse with Spark
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.80);
    ctx.bezierCurveTo(r * 0.15, -r * 1.10, r * 0.35, -r * 0.85, r * 0.48, -r * 1.05);
    ctx.strokeStyle = '#8b573a';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Animated Fiery Sparks at Fuse Tip
    const sparkX = r * 0.48;
    const sparkY = -r * 1.05;
    const flicker = Math.sin(animTimer * 20) * 3;

    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 14 + flicker, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 165, 38, 0.45)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 7 + flicker * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#f04351';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd147';
    ctx.fill();
    ctx.restore();

    // 2. Brass Neck Collar
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-r * 0.22, -r * 0.90, r * 0.44, r * 0.22, 4);
    ctx.fillStyle = '#ffa526';
    ctx.fill();
    ctx.restore();

    // 3. Charcoal Cannonball Sphere
    ctx.beginPath();
    ctx.arc(0, r * 0.08, r * 0.88, 0, Math.PI * 2);
    ctx.fillStyle = '#2c3437';
    ctx.fill();

    // 4. White Capsule Gloss Highlight on Upper-Left
    ctx.save();
    ctx.translate(-r * 0.42, -r * 0.28);
    ctx.rotate(-0.55);
    ctx.beginPath();
    ctx.roundRect(-r * 0.08, -r * 0.18, r * 0.16, r * 0.36, r * 0.08);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // 5. Mischievous Kawaii Bomb Face
    this.drawKawaiiFace(ctx, 0, r * 0.15, r * 0.85, {
      blushColor: '#ff8a99',
      eyeColor: '#f8fafc',
      expression: 'bomb'
    });
  }

  /* ---------------- 10. HEART BONUS (보너스 하트) ---------------- */
  static drawHeartBonus(ctx, config, animTimer) {
    const r = config.radius;
    const pulse = Math.sin(animTimer * 5) * 0.05;

    ctx.save();
    ctx.scale(1 + pulse, 1 + pulse);

    // Heart Shape Path
    ctx.beginPath();
    ctx.moveTo(0, r * 0.72);
    ctx.bezierCurveTo(-r * 0.85, r * 0.25, -r * 0.95, -r * 0.45, -r * 0.45, -r * 0.72);
    ctx.bezierCurveTo(-r * 0.15, -r * 0.85, 0, -r * 0.52, 0, -r * 0.35);
    ctx.bezierCurveTo(0, -r * 0.52, r * 0.15, -r * 0.85, r * 0.45, -r * 0.72);
    ctx.bezierCurveTo(r * 0.95, -r * 0.45, r * 0.85, r * 0.25, 0, r * 0.72);
    ctx.closePath();
    ctx.fillStyle = '#f43f5e';
    ctx.fill();

    // White Capsule Gloss Highlight on Upper-Left Lobe
    ctx.save();
    ctx.translate(-r * 0.45, -r * 0.38);
    ctx.rotate(-0.55);
    ctx.beginPath();
    ctx.roundRect(-r * 0.07, -r * 0.16, r * 0.14, r * 0.32, r * 0.07);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // Joyful Kawaii Heart Face
    this.drawKawaiiFace(ctx, 0, -r * 0.02, r * 0.85, {
      blushColor: '#fda4af',
      eyeColor: '#ffffff',
      expression: 'happy'
    });

    ctx.restore();
  }

  /* ---------------- Sliced Cross-Section Details (절단면 표현 없음) ---------------- */
  static drawCutFaceDetails(ctx, config, radius) {
    // 절단면 표현 생략
  }

  static drawClassicBase(ctx, config) {
    const r = config.radius;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = config.color;
    ctx.fill();
  }
}
