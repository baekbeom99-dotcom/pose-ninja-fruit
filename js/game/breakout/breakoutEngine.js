/**
 * Seesaw Breakout Core Engine ("🧱 벽돌깨기")
 *
 * Precision Tilt-Reflect Breakout:
 *   - Controls seesaw paddle horizontal X via hands midpoint / shoulders / nose X
 *   - Tilts paddle angle via left/right wrist height difference (or shoulder tilt / keys / wheel)
 *   - True surface-normal reflection physics along tilted paddle + aim guide vector
 *   - Multi-stage brick grids, armored 2-hit bricks, multi-ball & wide-seesaw powerups
 */

import { soundManager } from '../../audio/soundManager.js';

const ROW_COLORS = [
  '#f43f5e', // crimson
  '#fb923c', // amber
  '#facc15', // gold
  '#4ade80', // emerald
  '#38bdf8', // sky
  '#c084fc'  // violet
];

function isVisible(pt) {
  return pt && (pt.visibility === undefined || pt.visibility > 0.35);
}

export class BreakoutEngine {
  constructor(width = 1280, height = 720, ui = null, sound = null) {
    this.width = width;
    this.height = height;
    this.ui = ui;
    this.sound = sound || soundManager;

    this.state = 'IDLE'; // 'IDLE', 'PLAYING', 'GAMEOVER'
    this.score = 0;
    this.stage = 1;
    this.lives = 5;
    this.maxLives = 5;
    this.elapsedTime = 0;

    this.paddle = {
      x: width * 0.5,
      targetX: width * 0.5,
      y: Math.max(200, height - 86),
      halfW: 96,
      baseHalfW: 96,
      halfH: 11,
      angle: 0,
      targetAngle: 0,
      wideTimer: 0
    };

    this.manualAngle = 0;
    this.pointerX = null;

    this.balls = [];
    this.bricks = [];
    this.powerups = [];
    this.particles = [];
    this.floatingTexts = [];
    this.serveTimer = 0.85;
    this.shakeTimer = 0;

    this.onScore = () => {};
    this.onLivesChanged = () => {};
    this.onGameOver = () => {};

    this.reset();
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.paddle.y = Math.max(200, height - 86);
  }

  reset() {
    this.score = 0;
    this.stage = 1;
    this.lives = this.maxLives;
    this.elapsedTime = 0;
    this.manualAngle = 0;
    this.shakeTimer = 0;

    this.paddle.x = this.width * 0.5;
    this.paddle.targetX = this.width * 0.5;
    this.paddle.y = Math.max(200, this.height - 86);
    this.paddle.halfW = this.paddle.baseHalfW;
    this.paddle.angle = 0;
    this.paddle.targetAngle = 0;
    this.paddle.wideTimer = 0;

    this.powerups = [];
    this.particles = [];
    this.floatingTexts = [];

    this._buildStage(this.stage);
    this._resetServeBall();

    if (this.ui) {
      this.ui.updateScores(0, 0, false);
      this.ui.updateLives(this.lives, this.maxLives);
    }
  }

  _buildStage(stageNum = 1) {
    this.bricks = [];
    const cols = 10;
    const rows = Math.min(6, 4 + Math.floor((stageNum - 1) / 2));
    const marginX = Math.max(60, this.width * 0.08);
    const usableW = this.width - marginX * 2;
    const gap = 8;
    const brickW = (usableW - gap * (cols - 1)) / cols;
    const brickH = 26;
    const startY = 122;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Architectural variety cleanly derived per stage
        if (stageNum >= 2 && r % 2 === 1 && (c === 0 || c === cols - 1)) continue;
        const armored = stageNum >= 2 && r === 0 && (c + stageNum) % 2 === 0;
        const color = ROW_COLORS[r % ROW_COLORS.length];
        this.bricks.push({
          x: marginX + c * (brickW + gap),
          y: startY + r * (brickH + gap),
          w: brickW,
          h: brickH,
          row: r,
          hp: armored ? 2 : 1,
          maxHp: armored ? 2 : 1,
          points: (rows - r) * 10 + (armored ? 20 : 0),
          color,
          isDead: false
        });
      }
    }
  }

  _resetServeBall() {
    const speed = Math.min(620, 440 + (this.stage - 1) * 30);
    this.balls = [
      {
        x: this.paddle.x,
        y: this.paddle.y - this.paddle.halfH - 12,
        vx: Math.sin(this.paddle.angle) * speed * 0.5,
        vy: -speed,
        radius: 11,
        speed,
        stuckToPaddle: true,
        trail: []
      }
    ];
    this.serveTimer = 0.85;
  }

  start() {
    this.reset();
    this.state = 'PLAYING';
  }

  stop() {
    this.state = 'IDLE';
  }

  setPointerX(x) {
    this.pointerX = x;
  }

  adjustManualAngle(deltaRad) {
    this.manualAngle = Math.max(-0.52, Math.min(0.52, this.manualAngle + deltaRad));
  }

  launchStuckBalls() {
    this.serveTimer = 0;
    for (const b of this.balls) {
      if (b.stuckToPaddle) {
        b.stuckToPaddle = false;
        const ang = this.paddle.angle * 0.9;
        b.vx = Math.sin(ang) * b.speed;
        b.vy = -Math.cos(ang) * b.speed;
      }
    }
  }

  _extractSeesawInput(poses) {
    if (!Array.isArray(poses) || poses.length === 0 || !Array.isArray(poses[0])) {
      return null;
    }
    const lm = poses[0];
    const lw = lm[15];
    const rw = lm[16];
    const ls = lm[11];
    const rs = lm[12];
    const nose = lm[0];

    // Priority 1: Both wrists spread -> midpoint X + exact height-diff seesaw tilt!
    if (isVisible(lw) && isVisible(rw)) {
      const mx1 = (1.0 - lw.x) * this.width;
      const my1 = lw.y * this.height;
      const mx2 = (1.0 - rw.x) * this.width;
      const my2 = rw.y * this.height;
      const leftPt = mx1 <= mx2 ? { x: mx1, y: my1 } : { x: mx2, y: my2 };
      const rightPt = mx1 <= mx2 ? { x: mx2, y: my2 } : { x: mx1, y: my1 };

      const centerX = (leftPt.x + rightPt.x) * 0.5;
      const dx = Math.max(48, rightPt.x - leftPt.x);
      const dy = rightPt.y - leftPt.y;
      const angle = Math.max(-0.52, Math.min(0.52, Math.atan2(dy, dx) * 1.15));
      return { x: centerX, angle, source: 'WRISTS' };
    }

    // Priority 2: Left/right shoulders -> midpoint X + shoulder tilt!
    if (isVisible(ls) && isVisible(rs)) {
      const mx1 = (1.0 - ls.x) * this.width;
      const my1 = ls.y * this.height;
      const mx2 = (1.0 - rs.x) * this.width;
      const my2 = rs.y * this.height;
      const leftPt = mx1 <= mx2 ? { x: mx1, y: my1 } : { x: mx2, y: my2 };
      const rightPt = mx1 <= mx2 ? { x: mx2, y: my2 } : { x: mx1, y: my1 };

      const centerX = (leftPt.x + rightPt.x) * 0.5;
      const dx = Math.max(40, rightPt.x - leftPt.x);
      const dy = rightPt.y - leftPt.y;
      const angle = Math.max(-0.52, Math.min(0.52, Math.atan2(dy, dx) * 1.35));
      return { x: centerX, angle, source: 'SHOULDERS' };
    }

    // Priority 3: Nose / head X fallback
    if (isVisible(nose)) {
      return { x: (1.0 - nose.x) * this.width, angle: this.manualAngle, source: 'HEAD' };
    }

    return null;
  }

  _addScore(pts) {
    this.score += pts;
    this.onScore(this.score);
    if (this.ui) {
      this.ui.updateScores(this.score, 0, false);
    }
  }

  _spawnBurst(x, y, color, count = 10, speed = 200) {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const spd = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        radius: 2.8 + Math.random() * 3.5,
        color,
        life: 0.4 + Math.random() * 0.25,
        maxLife: 0.65
      });
    }
  }

  _spawnFloatingText(text, x, y, color = '#facc15', scale = 1.0) {
    this.floatingTexts.push({
      text,
      x,
      y,
      color,
      scale,
      life: 0.85,
      maxLife: 0.85
    });
  }

  _spawnPowerup(x, y) {
    if (Math.random() > 0.20) return;
    const roll = Math.random();
    const kind =
      roll < 0.45 ? 'MULTI' : roll < 0.82 ? 'WIDE' : this.lives < this.maxLives ? 'HEART' : 'WIDE';
    this.powerups.push({
      x,
      y,
      vy: 165,
      radius: 15,
      kind,
      isDead: false
    });
  }

  _updateEffects(dt) {
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 40 * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  /**
   * Collides a moving ball against the tilted seesaw paddle using exact surface-normal reflection.
   */
  _resolvePaddleBounce(ball) {
    const p = this.paddle;
    const cos = Math.cos(p.angle);
    const sin = Math.sin(p.angle);

    // Express ball center in paddle's rotated local frame
    const dx = ball.x - p.x;
    const dy = ball.y - p.y;
    const localX = dx * cos + dy * sin;
    const localY = -dx * sin + dy * cos;

    // Velocity in paddle local frame
    const localVy = -ball.vx * sin + ball.vy * cos;
    if (localVy <= 0) return false; // Moving away upward relative to paddle surface

    const clampedX = Math.max(-p.halfW, Math.min(p.halfW, localX));
    const clampedY = Math.max(-p.halfH, Math.min(p.halfH, localY));
    const dist = Math.hypot(localX - clampedX, localY - clampedY);
    if (dist > ball.radius) return false;

    // Push ball cleanly above paddle top surface
    const pushLocalY = -p.halfH - ball.radius - 1;
    ball.x = p.x + localX * cos - pushLocalY * sin;
    ball.y = p.y + localX * sin + pushLocalY * cos;

    // Exact geometric reflection across tilted paddle normal: n = (sin(angle), -cos(angle))
    const nx = sin;
    const ny = -cos;
    const dot = ball.vx * nx + ball.vy * ny;
    let rvx = ball.vx - 2 * dot * nx;
    let rvy = ball.vy - 2 * dot * ny;

    // Subtle edge-hit spin nuance while keeping seesaw angle primary controller
    const hitOffset = localX / Math.max(1, p.halfW);
    const curMag = Math.max(ball.speed, Math.hypot(rvx, rvy));
    let outAngle = Math.atan2(rvx, -rvy) + hitOffset * 0.14;
    outAngle = Math.max(-1.22, Math.min(1.22, outAngle)); // Prevent flat horizontal loops

    ball.vx = Math.sin(outAngle) * curMag;
    ball.vy = -Math.cos(outAngle) * curMag;
    return true;
  }

  update(dt, currentTime, poses = null) {
    const safeDt = Math.min(Math.max(dt || 0, 0), 0.05);
    this.elapsedTime += safeDt;
    this._updateEffects(safeDt);

    if (this.state !== 'PLAYING') return;

    // 1. Update paddle target X & tilt angle from Pose or Pointer/Manual fallback
    const poseInput = this._extractSeesawInput(poses);
    if (poseInput) {
      this.paddle.targetX = poseInput.x;
      this.paddle.targetAngle = poseInput.angle;
    } else {
      if (this.pointerX != null) {
        this.paddle.targetX = this.pointerX;
      }
      this.paddle.targetAngle = this.manualAngle;
    }

    const p = this.paddle;
    const clampMin = p.halfW + 14;
    const clampMax = Math.max(clampMin, this.width - p.halfW - 14);
    p.targetX = Math.max(clampMin, Math.min(clampMax, p.targetX));

    const lerp = Math.min(1, safeDt * 18);
    p.x += (p.targetX - p.x) * lerp;
    p.angle += (p.targetAngle - p.angle) * lerp;

    if (p.wideTimer > 0) {
      p.wideTimer = Math.max(0, p.wideTimer - safeDt);
      p.halfW = p.wideTimer > 0 ? p.baseHalfW * 1.38 : p.baseHalfW;
    }

    // Auto-serve countdown for stuck ball
    if (this.serveTimer > 0) {
      this.serveTimer -= safeDt;
      if (this.serveTimer <= 0) {
        this.launchStuckBalls();
      }
    }

    // 2. Move Balls & Check Wall / Seesaw / Brick Collisions
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      if (ball.stuckToPaddle) {
        const cos = Math.cos(p.angle);
        const sin = Math.sin(p.angle);
        const localUp = -p.halfH - ball.radius - 2;
        ball.x = p.x - localUp * sin;
        ball.y = p.y + localUp * cos;
        continue;
      }

      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 8) ball.trail.shift();

      ball.x += ball.vx * safeDt;
      ball.y += ball.vy * safeDt;

      // Side & ceiling wall bounces
      if (ball.x - ball.radius < 10) {
        ball.x = 10 + ball.radius;
        ball.vx = Math.abs(ball.vx);
      } else if (ball.x + ball.radius > this.width - 10) {
        ball.x = this.width - 10 - ball.radius;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.y - ball.radius < 68) {
        ball.y = 68 + ball.radius;
        ball.vy = Math.abs(ball.vy);
      }

      // Seesaw angled bounce
      if (this._resolvePaddleBounce(ball)) {
        this._spawnBurst(ball.x, ball.y + ball.radius, '#38bdf8', 7, 150);
        if (this.sound && typeof this.sound.playBreakoutPaddle === 'function') {
          this.sound.playBreakoutPaddle();
        }
      }

      // Brick AABB hit check
      for (let j = 0; j < this.bricks.length; j++) {
        const br = this.bricks[j];
        if (br.isDead) continue;

        const cx = Math.max(br.x, Math.min(br.x + br.w, ball.x));
        const cy = Math.max(br.y, Math.min(br.y + br.h, ball.y));
        const ddx = ball.x - cx;
        const ddy = ball.y - cy;
        if (ddx * ddx + ddy * ddy <= ball.radius * ball.radius) {
          // Reflect along shallower overlap axis
          const overlapX = Math.min(Math.abs(ball.x - br.x), Math.abs(ball.x - (br.x + br.w)));
          const overlapY = Math.min(Math.abs(ball.y - br.y), Math.abs(ball.y - (br.y + br.h)));
          if (overlapX < overlapY) {
            ball.vx *= -1;
          } else {
            ball.vy *= -1;
          }

          br.hp--;
          if (br.hp <= 0) {
            br.isDead = true;
            this._addScore(br.points);
            this._spawnBurst(br.x + br.w * 0.5, br.y + br.h * 0.5, br.color, 12, 220);
            this._spawnPowerup(br.x + br.w * 0.5, br.y + br.h * 0.5);
          } else {
            this._spawnBurst(ball.x, ball.y, '#e2e8f0', 6, 120);
          }
          if (this.sound && typeof this.sound.playBreakoutBrick === 'function') {
            this.sound.playBreakoutBrick(br.row);
          }
          break;
        }
      }

      // Bottom floor miss
      if (ball.y - ball.radius > this.height) {
        this.balls.splice(i, 1);
      }
    }

    // Prune dead bricks & check stage clear
    let remaining = 0;
    for (let j = this.bricks.length - 1; j >= 0; j--) {
      if (this.bricks[j].isDead) {
        this.bricks.splice(j, 1);
      } else {
        remaining++;
      }
    }
    if (remaining === 0) {
      this.stage++;
      this._addScore(300);
      this._spawnFloatingText(`🎉 STAGE ${this.stage}! +300`, this.width * 0.5, this.height * 0.42, '#4ade80', 1.4);
      if (this.sound && typeof this.sound.playBreakoutClear === 'function') {
        this.sound.playBreakoutClear();
      }
      this.powerups = [];
      this._buildStage(this.stage);
      this._resetServeBall();
      return;
    }

    // All balls lost -> lose 1 heart or GAMEOVER
    if (this.balls.length === 0) {
      this.lives = Math.max(0, this.lives - 1);
      this.onLivesChanged(this.lives);
      this.shakeTimer = 0.3;
      if (this.ui) {
        this.ui.updateLives(this.lives, this.maxLives);
      }
      if (this.sound && typeof this.sound.playBreakoutMiss === 'function') {
        this.sound.playBreakoutMiss();
      }
      if (this.lives <= 0) {
        this.state = 'GAMEOVER';
        this.onGameOver();
        return;
      }
      this._resetServeBall();
    }

    // 3. Update falling Powerups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      pu.y += pu.vy * safeDt;
      const dist = Math.hypot(pu.x - p.x, pu.y - p.y);
      if (Math.abs(pu.x - p.x) <= p.halfW + pu.radius && Math.abs(pu.y - p.y) <= p.halfH + pu.radius + 10) {
        pu.isDead = true;
        this._applyPowerup(pu);
      } else if (dist < 22) {
        pu.isDead = true;
        this._applyPowerup(pu);
      } else if (pu.y - pu.radius > this.height) {
        pu.isDead = true;
      }
      if (pu.isDead) this.powerups.splice(i, 1);
    }
  }

  _applyPowerup(pu) {
    this._addScore(25);
    if (this.sound && typeof this.sound.playBreakoutPowerup === 'function') {
      this.sound.playBreakoutPowerup();
    }
    if (pu.kind === 'WIDE') {
      this.paddle.wideTimer = 9.0;
      this.paddle.halfW = this.paddle.baseHalfW * 1.38;
      this._spawnFloatingText('↔️ 넓은 시소 패들!', pu.x, pu.y - 16, '#38bdf8', 1.1);
    } else if (pu.kind === 'HEART') {
      if (this.lives < this.maxLives) {
        this.lives++;
        this.onLivesChanged(this.lives);
        if (this.ui) {
          this.ui.updateLives(this.lives, this.maxLives);
          if (typeof this.ui.showHeal === 'function') this.ui.showHeal();
        }
      }
      this._spawnFloatingText('💖 +1 LIFE!', pu.x, pu.y - 16, '#fb7185', 1.15);
    } else if (pu.kind === 'MULTI' && this.balls.length > 0 && this.balls.length < 6) {
      const src = this.balls[0];
      [-0.35, 0.35].forEach((offset) => {
        const ang = Math.atan2(src.vx, -src.vy) + offset;
        this.balls.push({
          x: src.x,
          y: src.y,
          vx: Math.sin(ang) * src.speed,
          vy: -Math.cos(ang) * src.speed,
          radius: src.radius,
          speed: src.speed,
          stuckToPaddle: false,
          trail: []
        });
      });
      this._spawnFloatingText('⚡ 멀티볼 x3!', pu.x, pu.y - 16, '#facc15', 1.15);
    }
  }

  render(ctx) {
    if (!ctx) return;
    const w = this.width;
    const h = this.height;

    ctx.save();
    if (this.shakeTimer > 0) {
      const mag = (this.shakeTimer / 0.3) * 10;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    // 1. Sleek semi-transparent neon slate arena over subtle webcam feed
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.60)');
    bgGrad.addColorStop(1, 'rgba(30, 41, 59, 0.72)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Arena boundary rails
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 68, w - 20, h - 60);

    // 2. Bricks
    for (const br of this.bricks) {
      ctx.save();
      ctx.fillStyle = br.color;
      ctx.beginPath();
      ctx.roundRect(br.x, br.y, br.w, br.h, 6);
      ctx.fill();

      // Glossy top highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.fillRect(br.x + 4, br.y + 3, br.w - 8, 5);

      if (br.maxHp > 1) {
        ctx.strokeStyle = br.hp > 1 ? '#f8fafc' : 'rgba(248, 250, 252, 0.45)';
        ctx.lineWidth = br.hp > 1 ? 3 : 1.5;
        ctx.strokeRect(br.x + 1, br.y + 1, br.w - 2, br.h - 2);
      }
      ctx.restore();
    }

    // 3. Falling Powerups
    for (const pu of this.powerups) {
      ctx.save();
      ctx.fillStyle = pu.kind === 'MULTI' ? '#facc15' : pu.kind === 'WIDE' ? '#38bdf8' : '#fb7185';
      ctx.beginPath();
      ctx.arc(pu.x, pu.y, pu.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '900 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(pu.kind === 'MULTI' ? 'x3' : pu.kind === 'WIDE' ? '↔' : '♥', pu.x, pu.y + 1);
      ctx.restore();
    }

    // 4. Seesaw Tilting Paddle + Surface Normal Aim Indicator
    this._renderSeesawPaddle(ctx);

    // 5. Balls & Glowing Trails
    for (const b of this.balls) {
      ctx.save();
      b.trail.forEach((pt, idx) => {
        const a = ((idx + 1) / b.trail.length) * 0.38;
        ctx.fillStyle = `rgba(56, 189, 248, ${a})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, b.radius * (0.45 + 0.45 * (idx / b.trail.length)), 0, Math.PI * 2);
        ctx.fill();
      });

      const radGrad = ctx.createRadialGradient(b.x - 3, b.y - 3, 2, b.x, b.y, b.radius);
      radGrad.addColorStop(0, '#ffffff');
      radGrad.addColorStop(0.55, '#7dd3fc');
      radGrad.addColorStop(1, '#0284c7');
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6. Particles & Floating Text
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      ctx.font = `900 ${Math.round(20 * ft.scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 7. Bottom HUD
    this._renderHUD(ctx, w, h);

    ctx.restore();
  }

  _renderSeesawPaddle(ctx) {
    const p = this.paddle;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);

    // Dotted surface-normal reflection preview guide
    ctx.save();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.42)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(0, -p.halfH);
    ctx.lineTo(0, -110);
    ctx.stroke();
    ctx.restore();

    // Glowing seesaw bar
    const padGrad = ctx.createLinearGradient(-p.halfW, 0, p.halfW, 0);
    padGrad.addColorStop(0, '#38bdf8');
    padGrad.addColorStop(0.5, '#f8fafc');
    padGrad.addColorStop(1, '#fbbf24');
    ctx.fillStyle = padGrad;
    ctx.beginPath();
    ctx.roundRect(-p.halfW, -p.halfH, p.halfW * 2, p.halfH * 2, p.halfH);
    ctx.fill();

    // Seesaw fulcrum pivot triangle & glowing end grips
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath();
    ctx.arc(-p.halfW + 10, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(p.halfW - 10, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _renderHUD(ctx, w, h) {
    const deg = Math.round((this.paddle.angle * 180) / Math.PI);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(
      `⚖️ 시소 각도: ${deg > 0 ? '+' : ''}${deg}° · 양손 높이 차로 정밀 반사! (A/D · 휠 기울기)`,
      24,
      h - 22
    );

    ctx.textAlign = 'right';
    ctx.font = '900 17px system-ui, sans-serif';
    ctx.fillStyle = '#fde047';
    ctx.fillText(`STAGE ${this.stage} · BRICKS ${this.bricks.length}`, w - 24, h - 22);
    ctx.restore();
  }
}
