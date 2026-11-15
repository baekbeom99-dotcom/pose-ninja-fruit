/**
 * Splitting Asteroids for Galaga Mode
 * Drifts from deep space; splits into fast sub-fragments when blasted.
 */

export class Asteroid {
  constructor(x, y, size = 'LARGE', vx = null, vy = null) {
    this.x = x;
    this.y = y;
    this.size = size; // 'LARGE' (splits into 2) or 'SMALL'
    this.radius = size === 'LARGE' ? 24 : 14;
    this.isDead = false;
    this.points = size === 'LARGE' ? 150 : 100;

    // Movement: Large asteroids drift down slowly, Small fragments scatter faster
    if (vx !== null && vy !== null) {
      this.vx = vx;
      this.vy = vy;
    } else {
      this.vx = (Math.random() - 0.5) * 50;
      this.vy = size === 'LARGE' ? (60 + Math.random() * 40) : (110 + Math.random() * 50);
    }

    this.angle = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 2.2;

    // Irregular polygonal rock silhouette
    const numPoints = size === 'LARGE' ? 10 : 8;
    this.vertices = [];
    for (let i = 0; i < numPoints; i++) {
      const a = (i / numPoints) * Math.PI * 2;
      const r = this.radius * (0.72 + Math.random() * 0.48);
      this.vertices.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
  }

  update(dt, canvasWidth, canvasHeight) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.rotSpeed * dt;

    if (this.y > canvasHeight + 60 || this.x < -60 || this.x > canvasWidth + 60 || this.y < -80) {
      this.isDead = true;
    }
  }

  render(ctx) {
    if (this.isDead) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    ctx.strokeStyle = this.size === 'LARGE' ? '#94a3b8' : '#cbd5e1';
    ctx.lineWidth = 2.5;
    ctx.fillStyle = '#1e293b';
    ctx.shadowColor = '#64748b';
    ctx.shadowBlur = 8;

    ctx.beginPath();
    this.vertices.forEach((v, idx) => {
      if (idx === 0) ctx.moveTo(v.x, v.y);
      else ctx.lineTo(v.x, v.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Rock craters
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-this.radius * 0.3, -this.radius * 0.2, this.radius * 0.22, 0, Math.PI * 2);
    ctx.arc(this.radius * 0.2, this.radius * 0.28, this.radius * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
