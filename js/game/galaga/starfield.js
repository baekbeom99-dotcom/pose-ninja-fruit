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
