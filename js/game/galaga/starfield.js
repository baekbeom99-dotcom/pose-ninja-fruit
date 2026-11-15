/**
 * Parallax Starfield Background Engine for Galaga Mode
 * Produces organic multi-depth stars with twinkling alpha and warp speed.
 */
export class Starfield {
  constructor(width = 1280, height = 720, count = 100) {
    this.width = width;
    this.height = height;
    this.count = count;
    this.stars = [];
    this.warpMultiplier = 1;
    this.targetWarp = 1;
    this.stage = 1;
    this.nebulaTime = 0;

    this.palette = [
      '#ffffff',
      '#38bdf8', // Neon Cyan
      '#facc15', // Amber
      '#c084fc', // Lavender
      '#f43f5e', // Coral
      '#4ade80'  // Lime
    ];

    this._initStars();
  }

  setStage(stage = 1) {
    this.stage = stage;
  }

  _initStars() {
    this.stars = [];
    for (let i = 0; i < this.count; i++) {
      const layer = (i % 3) + 1; // 1: distant, 2: mid, 3: near
      let baseSpeed, size, baseAlpha;

      if (layer === 1) {
        baseSpeed = 35 + Math.random() * 25;
        size = 1.0;
        baseAlpha = 0.4 + Math.random() * 0.25;
      } else if (layer === 2) {
        baseSpeed = 80 + Math.random() * 35;
        size = 1.6;
        baseAlpha = 0.65 + Math.random() * 0.2;
      } else {
        baseSpeed = 160 + Math.random() * 60;
        size = 2.4;
        baseAlpha = 0.85 + Math.random() * 0.15;
      }

      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        layer,
        speed: baseSpeed,
        size,
        baseAlpha,
        alpha: baseAlpha,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 2 + Math.random() * 4,
        color: this.palette[Math.floor(Math.random() * this.palette.length)]
      });
    }
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  setWarp(active) {
    this.targetWarp = active ? 6 : 1;
    this.warpMultiplier = this.targetWarp;
  }

  update(dt, speedMultiplier = 1.0) {
    this.nebulaTime += dt * 0.4;
    const effectiveSpeed = speedMultiplier * this.warpMultiplier;

    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      s.y += s.speed * effectiveSpeed * dt;

      // Twinkle alpha
      s.twinklePhase += s.twinkleSpeed * dt;
      s.alpha = Math.max(0.1, s.baseAlpha + Math.sin(s.twinklePhase) * 0.25);

      // Wrap-around
      if (s.y >= this.height) {
        s.y = 0;
        s.x = Math.random() * this.width;
      } else if (s.y < 0) {
        s.y = this.height;
      }
    }
  }

  render(ctx) {
    ctx.save();

    // Stage Nebula Atmosphere (Deep ambient color wash per stage)
    const stageTheme = (this.stage - 1) % 5;
    if (stageTheme === 1) {
      // Stage 2: Violet Nebula
      const g = ctx.createRadialGradient(this.width * 0.7, this.height * 0.35, 80, this.width * 0.7, this.height * 0.35, 520);
      g.addColorStop(0, 'rgba(147, 51, 234, 0.18)');
      g.addColorStop(0.6, 'rgba(88, 28, 135, 0.08)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.width, this.height);
    } else if (stageTheme === 2) {
      // Stage 3: Challenging Stage (Electric Blue / Golden Cosmos)
      const g = ctx.createRadialGradient(this.width * 0.5, this.height * 0.45, 60, this.width * 0.5, this.height * 0.45, 600);
      g.addColorStop(0, 'rgba(14, 165, 233, 0.22)');
      g.addColorStop(0.5, 'rgba(234, 179, 8, 0.09)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.width, this.height);
    } else if (stageTheme === 3) {
      // Stage 4: Solar Crimson
      const g = ctx.createRadialGradient(this.width * 0.3, this.height * 0.3, 100, this.width * 0.3, this.height * 0.3, 560);
      g.addColorStop(0, 'rgba(225, 29, 72, 0.20)');
      g.addColorStop(0.5, 'rgba(234, 88, 12, 0.09)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.width, this.height);
    } else if (stageTheme === 4) {
      // Stage 5+: Cyber Matrix Emerald
      const g = ctx.createRadialGradient(this.width * 0.6, this.height * 0.4, 90, this.width * 0.6, this.height * 0.4, 540);
      g.addColorStop(0, 'rgba(16, 185, 129, 0.20)');
      g.addColorStop(0.6, 'rgba(6, 95, 70, 0.08)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      ctx.globalAlpha = Math.min(1.0, s.alpha);
      ctx.fillStyle = s.color;

      if (this.warpMultiplier > 1) {
        // Streaking warp lines
        const streakLength = s.speed * 0.08 * this.warpMultiplier;
        ctx.fillRect(s.x, s.y - streakLength, s.size, streakLength);
      } else {
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
    }
    ctx.restore();
  }
}
