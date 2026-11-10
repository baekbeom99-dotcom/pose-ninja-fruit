/**
 * Space Fishes for UFO Flying Fish Mode (Zero-Gravity Aquatic Cosmic Entities)
 * Features predictable yet rich mathematical flight paths:
 * Sine Wave, Lissajous Figure-8, Pulsing Dash-Glide, Spiral, and Screen Ricochet.
 */
import { CONFIG } from '../config.js';

export class HalfFish {
  constructor(fishConfig, x, y, vx, vy, cutAngle, isLeftHalf, themeId = 'CLASSIC_VECTOR') {
    this.config = fishConfig;
    this.type = fishConfig.type;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = fishConfig.radius;
    this.cutAngle = cutAngle;
    this.isLeftHalf = isLeftHalf;
    this.rotation = cutAngle;
    this.angularVelocity = isLeftHalf ? -3.5 : 3.5;
    this.isDead = false;
    this.themeId = themeId;

    // 3-second smooth fadeout
    this.maxLife = 3.0;
    this.life = 3.0;
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) {
      this.isDead = true;
      return;
    }

    // Drifts in zero gravity with slight air friction
    this.vx *= 0.992;
    this.vy *= 0.992;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.angularVelocity * dt;

    if (
      this.x < -150 ||
      this.x > CONFIG.CANVAS.WIDTH + 150 ||
      this.y < -150 ||
      this.y > CONFIG.CANVAS.HEIGHT + 150
    ) {
      this.isDead = true;
    }
  }

  draw(ctx) {
    if (this.isDead || this.life <= 0) return;

    const alpha = Math.max(0, Math.min(1.0, this.life / this.maxLife));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    const clipR = this.radius * 2.2;
    ctx.beginPath();
    if (this.isLeftHalf) {
      ctx.rect(-clipR, -clipR, clipR, clipR * 2);
    } else {
      ctx.rect(0, -clipR, clipR, clipR * 2);
    }
    ctx.clip();

    FishRenderer.drawFishBody(ctx, this.config, 0);

    ctx.restore();

    // Sliced Cut Face Highlight
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.beginPath();
    ctx.moveTo(0, -this.radius);
    ctx.lineTo(0, this.radius);
    ctx.strokeStyle = this.config.juiceColor || '#38bdf8';
    ctx.lineWidth = 5;
    ctx.shadowColor = this.config.juiceColor || '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.restore();
  }
}

export class Fish {
  constructor(fishConfig, startX, startY, pathType = 'SINE_WAVE', params = {}) {
    this.config = fishConfig;
    this.type = fishConfig.type;
    this.radius = fishConfig.radius;
    this.points = fishConfig.points;

    this.x = startX;
    this.y = startY;
    this.startX = startX;
    this.startY = startY;

    this.pathType = pathType;
    this.params = {
      vx: params.vx || 160,
      vy: params.vy || 0,
      amplitude: params.amplitude || 85,
      frequency: params.frequency || 2.2,
      phase: params.phase || Math.random() * Math.PI * 2,
      centerX: params.centerX || CONFIG.CANVAS.WIDTH / 2,
      centerY: params.centerY || CONFIG.CANVAS.HEIGHT / 2,
      ...params
    };

    this.vx = this.params.vx;
    this.vy = this.params.vy;
    this.rotation = 0;
    this.animTimer = Math.random() * 10;
    this.flightTime = 0;

    this.isSliced = false;
    this.isMissed = false;
    this.isDead = false;
  }

  update(dt) {
    this.flightTime += dt;
    this.animTimer += dt;
    const t = this.flightTime;
    const p = this.params;

    const prevX = this.x;
    const prevY = this.y;

    if (this.pathType === 'SINE_WAVE') {
      // 1. Sinuous Sine Wave Swimming Path
      this.x += p.vx * dt;
      this.y = this.startY + Math.sin(t * p.frequency + p.phase) * p.amplitude;
    } else if (this.pathType === 'LISSAJOUS_8') {
      // 2. Figure-8 Looping Patrol Path
      this.x = p.centerX + Math.cos(t * p.frequency + p.phase) * p.amplitude * 1.5;
      this.y = p.centerY + Math.sin(2 * (t * p.frequency + p.phase)) * p.amplitude * 0.9;
    } else if (this.pathType === 'PULSE_DASH') {
      // 3. Pulsing Jet Thrust & Glide (Jellyfish / Squid surge)
      const pulse = 1.0 + Math.pow(Math.max(0, Math.sin(t * p.frequency)), 3) * 1.8;
      this.x += p.vx * pulse * dt;
      this.y += p.vy * pulse * dt;
    } else if (this.pathType === 'SPIRAL') {
      // 4. Spiral Vortex Flight
      const r = p.amplitude * (1 - t * 0.12);
      const angle = t * p.frequency + p.phase;
      this.x = p.centerX + Math.cos(angle) * r;
      this.y = p.centerY + Math.sin(angle) * r;
    } else {
      // 5. Zero-G Screen Ricochet Path
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Bounce smoothly off screen edges
      const pad = this.radius;
      if (this.x < pad && this.vx < 0) this.vx = -this.vx;
      if (this.x > CONFIG.CANVAS.WIDTH - pad && this.vx > 0) this.vx = -this.vx;
      if (this.y < pad && this.vy < 0) this.vy = -this.vy;
      if (this.y > CONFIG.CANVAS.HEIGHT - pad && this.vy > 0) this.vy = -this.vy;
    }

    // Instantaneous velocity vector & facing rotation
    const dx = this.x - prevX;
    const dy = this.y - prevY;
    if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
      this.vx = dx / dt;
      this.vy = dy / dt;
      this.rotation = Math.atan2(dy, dx);
    }

    // Check if exited screen bounds
    const margin = 140;
    if (
      this.flightTime > 1.2 &&
      (this.x < -margin ||
        this.x > CONFIG.CANVAS.WIDTH + margin ||
        this.y < -margin ||
        this.y > CONFIG.CANVAS.HEIGHT + margin)
    ) {
      this.isMissed = true;
      this.isDead = true;
    }
  }

  slice(cutAngle, normal) {
    this.isSliced = true;
    this.isDead = true;

    if (this.type === 'ALIEN_BOMB') {
      return [];
    }

    const pushSpeed = 260;
    const h1 = new HalfFish(
      this.config,
      this.x,
      this.y,
      this.vx + normal.x * pushSpeed,
      this.vy + normal.y * pushSpeed,
      cutAngle,
      true
    );

    const h2 = new HalfFish(
      this.config,
      this.x,
      this.y,
      this.vx - normal.x * pushSpeed,
      this.vy - normal.y * pushSpeed,
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

    FishRenderer.drawFishBody(ctx, this.config, this.animTimer);

    ctx.restore();
  }
}

/**
 * Procedural Space Fish Renderer with Wiggling Fins & Starlight Glow
 */
export class FishRenderer {
  static drawFishBody(ctx, config, animTimer = 0) {
    switch (config.type) {
      case 'NEON_GOLDFISH':
        this.drawNeonGoldfish(ctx, config, animTimer);
        break;
      case 'CYBER_CLOWNFISH':
        this.drawCyberClownfish(ctx, config, animTimer);
        break;
      case 'COSMIC_JELLYFISH':
        this.drawCosmicJellyfish(ctx, config, animTimer);
        break;
      case 'ALAMO_FLYING_FISH':
        this.drawAlamoFlyingFish(ctx, config, animTimer);
        break;
      case 'MECHA_PUFFERFISH':
        this.drawMechaPufferfish(ctx, config, animTimer);
        break;
      case 'COSMIC_STAR':
        this.drawCosmicStar(ctx, config, animTimer);
        break;
      case 'ALIEN_BOMB':
        this.drawAlienBomb(ctx, config, animTimer);
        break;
      default:
        this.drawNeonGoldfish(ctx, config, animTimer);
        break;
    }
  }

  /* ---------------- 1. NEON GOLDFISH (네온 금붕어) ---------------- */
  static drawNeonGoldfish(ctx, config, animTimer) {
    const r = config.radius;
    const tailWiggle = Math.sin(animTimer * 14) * 0.28;

    // Glowing Starlight Aura
    ctx.save();
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 24;

    // Sinuous Double Tail Fin (wiggling smoothly)
    ctx.save();
    ctx.translate(-r * 0.72, 0);
    ctx.rotate(tailWiggle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-r * 0.55, -r * 0.65, -r * 0.95, -r * 0.45, -r * 0.95, 0);
    ctx.bezierCurveTo(-r * 0.95, r * 0.45, -r * 0.55, r * 0.65, 0, 0);
    const tailGrad = ctx.createLinearGradient(0, 0, -r, 0);
    tailGrad.addColorStop(0, '#facc15');
    tailGrad.addColorStop(1, '#06b6d4');
    ctx.fillStyle = tailGrad;
    ctx.fill();

    // Fin rays
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-r * 0.85, -r * 0.25);
    ctx.moveTo(0, 0);
    ctx.lineTo(-r * 0.85, r * 0.25);
    ctx.stroke();
    ctx.restore();

    // Dorsal Fin (등지느러미)
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, -r * 0.32);
    ctx.quadraticCurveTo(0, -r * 0.72, r * 0.25, -r * 0.28);
    ctx.fillStyle = '#facc15';
    ctx.fill();

    // Sleek Streamlined Fish Body (물고기 몸통)
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.78, r * 0.44, 0, 0, Math.PI * 2);
    const bodyGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.1, 4, 0, 0, r * 0.8);
    bodyGrad.addColorStop(0, '#67e8f9');
    bodyGrad.addColorStop(0.5, '#06b6d4');
    bodyGrad.addColorStop(1, '#0e7490');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Radiant Gold Scale Arcs (금빛 비늘)
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.6)';
    ctx.lineWidth = 2.2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(i * 18, 0, 16, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
    }

    // Glowing Neon Eye (빛나는 큰 눈)
    ctx.beginPath();
    ctx.arc(r * 0.45, -r * 0.12, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(r * 0.47, -r * 0.12, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(r * 0.49, -r * 0.14, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();

    ctx.restore();
  }

  /* ---------------- 2. CYBER CLOWNFISH (사이버 광대어) ---------------- */
  static drawCyberClownfish(ctx, config, animTimer) {
    const r = config.radius;
    const wiggle = Math.sin(animTimer * 12) * 0.24;

    ctx.save();
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 22;

    // Tail Fin
    ctx.save();
    ctx.translate(-r * 0.72, 0);
    ctx.rotate(wiggle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-r * 0.55, -r * 0.42);
    ctx.lineTo(-r * 0.45, 0);
    ctx.lineTo(-r * 0.55, r * 0.42);
    ctx.closePath();
    ctx.fillStyle = '#f97316';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Orange Rounded Body
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.74, r * 0.52, 0, 0, Math.PI * 2);
    const grad = ctx.createLinearGradient(-r * 0.7, 0, r * 0.7, 0);
    grad.addColorStop(0, '#ea580c');
    grad.addColorStop(0.5, '#f97316');
    grad.addColorStop(1, '#fb923c');
    ctx.fillStyle = grad;
    ctx.fill();

    // 3 Cyber Neon White/Cyan Stripe Bands (광대어 특유의 3개 밴드)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.73, r * 0.51, 0, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 3.5;

    // Band 1 (Head)
    ctx.fillRect(r * 0.15, -r, 16, r * 2);
    ctx.strokeRect(r * 0.15, -r, 16, r * 2);

    // Band 2 (Mid Body)
    ctx.fillRect(-r * 0.22, -r, 18, r * 2);
    ctx.strokeRect(-r * 0.22, -r, 18, r * 2);

    // Band 3 (Tail Base)
    ctx.fillRect(-r * 0.58, -r, 12, r * 2);
    ctx.strokeRect(-r * 0.58, -r, 12, r * 2);
    ctx.restore();

    // Cute Eye
    ctx.beginPath();
    ctx.arc(r * 0.42, -r * 0.14, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.44, -r * 0.14, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#0284c7';
    ctx.fill();

    ctx.restore();
  }

  /* ---------------- 3. COSMIC JELLYFISH (우주 해파리) ---------------- */
  static drawCosmicJellyfish(ctx, config, animTimer) {
    const r = config.radius;
    const pulse = 1 + Math.sin(animTimer * 5) * 0.12;

    ctx.save();
    ctx.scale(pulse, 1 / pulse);
    ctx.shadowColor = '#d946ef';
    ctx.shadowBlur = 28;

    // Pulsing Translucent Bell Dome (해파리 우산 갓)
    ctx.beginPath();
    ctx.arc(r * 0.15, 0, r * 0.58, -Math.PI / 2, Math.PI / 2, false);
    ctx.quadraticCurveTo(-r * 0.1, r * 0.58, -r * 0.15, 0);
    ctx.quadraticCurveTo(-r * 0.1, -r * 0.58, r * 0.15, -r * 0.58);
    ctx.closePath();

    const bellGrad = ctx.createRadialGradient(r * 0.2, 0, 4, r * 0.1, 0, r * 0.65);
    bellGrad.addColorStop(0, '#fdf4ff');
    bellGrad.addColorStop(0.4, '#e879f9');
    bellGrad.addColorStop(0.85, '#a855f7');
    bellGrad.addColorStop(1, '#7e22ce');
    ctx.fillStyle = bellGrad;
    ctx.fill();

    // Inner Bioluminescent Core (발광 코어)
    ctx.beginPath();
    ctx.arc(r * 0.25, 0, r * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fill();

    // Trailing Wavy Starlight Tentacles (촉수)
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    for (let i = -3; i <= 3; i++) {
      const baseY = i * (r * 0.14);
      ctx.beginPath();
      ctx.moveTo(-r * 0.15, baseY);
      for (let x = -r * 0.15; x >= -r * 1.05; x -= 10) {
        const wave = Math.sin((animTimer * 8) - (x * 0.08) + i) * 12;
        ctx.lineTo(x, baseY + wave);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  /* ---------------- 4. ALAMO FLYING FISH (은하 날치) ---------------- */
  static drawAlamoFlyingFish(ctx, config, animTimer) {
    const r = config.radius;
    const wingFlap = Math.sin(animTimer * 16) * (r * 0.18);

    ctx.save();
    ctx.shadowColor = '#60a5fa';
    ctx.shadowBlur = 24;

    // Huge Outstretched Starlight Pectoral Wings (날개 지느러미)
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.2);
    ctx.bezierCurveTo(r * 0.4, -r * 0.95 + wingFlap, -r * 0.4, -r * 1.1 + wingFlap, -r * 0.5, -r * 0.3);
    ctx.closePath();
    ctx.fillStyle = 'rgba(147, 197, 253, 0.72)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(r * 0.1, r * 0.2);
    ctx.bezierCurveTo(r * 0.4, r * 0.95 - wingFlap, -r * 0.4, r * 1.1 - wingFlap, -r * 0.5, r * 0.3);
    ctx.closePath();
    ctx.fillStyle = 'rgba(147, 197, 253, 0.72)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Sleek Glider Body (유선형 날치 몸통)
    ctx.beginPath();
    ctx.moveTo(r * 0.9, 0);
    ctx.quadraticCurveTo(0, -r * 0.35, -r * 0.85, -r * 0.08);
    ctx.lineTo(-r * 1.05, -r * 0.35); // Forked tail
    ctx.lineTo(-r * 0.92, 0);
    ctx.lineTo(-r * 1.05, r * 0.35);
    ctx.quadraticCurveTo(0, r * 0.35, r * 0.9, 0);
    ctx.closePath();

    const bodyGrad = ctx.createLinearGradient(0, -r * 0.3, 0, r * 0.3);
    bodyGrad.addColorStop(0, '#1e3a8a');
    bodyGrad.addColorStop(0.5, '#3b82f6');
    bodyGrad.addColorStop(1, '#93c5fd');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Eye
    ctx.beginPath();
    ctx.arc(r * 0.65, -r * 0.08, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.67, -r * 0.08, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    ctx.restore();
  }

  /* ---------------- 5. MECHA PUFFERFISH (메카 복어) ---------------- */
  static drawMechaPufferfish(ctx, config, animTimer) {
    const r = config.radius;
    const pulse = 1 + Math.sin(animTimer * 4) * 0.06;

    ctx.save();
    ctx.scale(pulse, pulse);
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 24;

    // Glowing Cyber Spines (가시 침)
    const spineCount = 14;
    for (let i = 0; i < spineCount; i++) {
      const a = (i * Math.PI * 2) / spineCount;
      const x1 = Math.cos(a) * (r * 0.68);
      const y1 = Math.sin(a) * (r * 0.68);
      const x2 = Math.cos(a) * (r * 1.02);
      const y2 = Math.sin(a) * (r * 1.02);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Round Robotic Sphere Body
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    const bodyGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.25, 4, 0, 0, r * 0.75);
    bodyGrad.addColorStop(0, '#6ee7b7');
    bodyGrad.addColorStop(0.6, '#10b981');
    bodyGrad.addColorStop(1, '#064e3b');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Cyber Metal Armor Seams
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.52, -Math.PI / 2, Math.PI / 2);
    ctx.strokeStyle = '#064e3b';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Robotic LED Eye
    ctx.beginPath();
    ctx.arc(r * 0.35, -r * 0.16, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(r * 0.35, -r * 0.16, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 12;
    ctx.fill();

    ctx.restore();
  }

  /* ---------------- 6. COSMIC STAR (보너스 하트 스타피쉬) ---------------- */
  static drawCosmicStar(ctx, config, animTimer) {
    const r = config.radius;
    const pulse = 1 + Math.sin(animTimer * 6) * 0.1;

    ctx.save();
    ctx.scale(pulse, pulse);
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 32;

    // 5-Pointed Radiant Crystal Starfish
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const inA = a + Math.PI / 5;
      const x1 = Math.cos(a) * r;
      const y1 = Math.sin(a) * r;
      const x2 = Math.cos(inA) * (r * 0.42);
      const y2 = Math.sin(inA) * (r * 0.42);
      if (i === 0) ctx.moveTo(x1, y1);
      else ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.closePath();

    const starGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, r);
    starGrad.addColorStop(0, '#ffffff');
    starGrad.addColorStop(0.35, '#fef08a');
    starGrad.addColorStop(0.7, '#f59e0b');
    starGrad.addColorStop(1, '#ec4899');
    ctx.fillStyle = starGrad;
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center Glowing Jewel
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }

  /* ---------------- 7. ALIEN BOMB (우주 기뢰) ---------------- */
  static drawAlienBomb(ctx, config, animTimer) {
    const r = config.radius;

    ctx.save();
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 24;

    // Dark Spiked Outer Shell
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI * 2) / 8 + animTimer * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r * 0.6), Math.sin(a) * (r * 0.6));
      ctx.lineTo(Math.cos(a) * (r * 1.08), Math.sin(a) * (r * 1.08));
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Heavy Metal Sphere
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    const droneGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 4, 0, 0, r * 0.72);
    droneGrad.addColorStop(0, '#64748b');
    droneGrad.addColorStop(0.5, '#1e293b');
    droneGrad.addColorStop(1, '#020617');
    ctx.fillStyle = droneGrad;
    ctx.fill();

    // Pulsing Red Warning Eye
    const blink = Math.sin(animTimer * 22) > 0;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = blink ? '#ef4444' : '#7f1d1d';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = blink ? 30 : 6;
    ctx.fill();

    ctx.restore();
  }
}
