/**
 * Poop Dodge Mode Core Engine ("💩 똥피하기")
 * Head X-axis controlled dodge game with escalating waves, giant/angled poops,
 * toilet paper & umbrella shield power-ups, splat puddles, particles, and SFX.
 */

import { soundManager } from '../../audio/soundManager.js';
import { DropType, FallingDrop, PoopPlayer } from './poopEntities.js';

export class PoopEngine {
  constructor(width = 1280, height = 720, ui = null, sound = null) {
    this.width = width;
    this.height = height;
    this.ui = ui;
    this.sound = sound || soundManager;

    this.floorOffset = 46;
    this.player = new PoopPlayer(width * 0.5, this.getFloorY() - 36);

    this.drops = [];
    this.particles = [];
    this.floorSplats = [];
    this.floatingTexts = [];

    this.score = 0;
    this.dodgedCount = 0;
    this.lives = 5;
    this.maxLives = 5;
    this.level = 1;
    this.elapsedTime = 0;
    this.spawnTimer = 0;
    this.dustTimer = 0;
    this.shakeTimer = 0;
    this.state = 'IDLE'; // 'IDLE', 'PLAYING', 'GAMEOVER'

    this.onScore = () => {};
    this.onLivesChanged = () => {};
    this.onGameOver = () => {};
  }

  getFloorY() {
    return Math.max(180, this.height - this.floorOffset);
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    if (this.player) {
      this.player.y = this.getFloorY() - this.player.radius * 1.06;
    }
  }

  reset() {
    this.drops = [];
    this.particles = [];
    this.floorSplats = [];
    this.floatingTexts = [];

    this.score = 0;
    this.dodgedCount = 0;
    this.lives = this.maxLives;
    this.level = 1;
    this.elapsedTime = 0;
    this.spawnTimer = 0.25;
    this.dustTimer = 0;
    this.shakeTimer = 0;

    this.player.reset(this.width * 0.5, this.getFloorY() - this.player.radius * 1.06);

    if (this.ui) {
      this.ui.updateScores(0, 0, false);
      this.ui.updateLives(this.lives, this.maxLives);
    }
  }

  start() {
    this.reset();
    this.state = 'PLAYING';
  }

  stop() {
    this.state = 'IDLE';
  }

  _addScore(pts) {
    this.score += pts;
    this.onScore(this.score);
    if (this.ui) {
      this.ui.updateScores(this.score, 0, false);
    }
  }

  _spawnDrop(forcedType = null, forcedX = null) {
    const margin = 40;
    const x = forcedX != null
      ? Math.max(margin, Math.min(this.width - margin, forcedX))
      : margin + Math.random() * Math.max(60, this.width - margin * 2);

    let type = forcedType;
    let vx = 0;

    if (!type) {
      const roll = Math.random();
      if (roll < 0.05) {
        type = DropType.TOILET_PAPER;
      } else if (roll < 0.085) {
        type = DropType.UMBRELLA;
      } else if (roll < 0.105 && this.lives < this.maxLives) {
        type = DropType.HEART;
      } else if (this.level >= 2 && roll < 0.22) {
        type = DropType.POOP_GIANT;
        if (this.sound && typeof this.sound.playPoopWarning === 'function') {
          this.sound.playPoopWarning();
        }
      } else if (this.level >= 3 && roll < 0.38) {
        type = DropType.POOP_FAST;
        vx = (Math.random() < 0.5 ? -1 : 1) * (80 + Math.random() * 110);
      } else {
        type = DropType.POOP_NORMAL;
      }
    }

    const drop = new FallingDrop(x, 12, type, this.level, vx);
    this.drops.push(drop);
    return drop;
  }

  _spawnBurst(x, y, color, count = 12, speed = 180) {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const spd = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 60,
        radius: 3 + Math.random() * 4.5,
        color,
        life: 0.45 + Math.random() * 0.25,
        maxLife: 0.7
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

  _spawnFloorSplat(x, drop) {
    const floorY = this.getFloorY();
    this.floorSplats.push({
      x,
      y: floorY,
      rx: drop.radius * 1.15,
      ry: drop.radius * 0.36,
      color: drop.type === DropType.POOP_GIANT ? '#78350f' : '#854d0e',
      life: 1.5,
      maxLife: 1.5
    });
    if (this.floorSplats.length > 18) {
      this.floorSplats.shift();
    }
    this._spawnBurst(x, floorY - 4, '#92400e', 6, 110);
  }

  update(dt, currentTime, headPose = null) {
    const safeDt = Math.min(Math.max(dt || 0, 0), 0.1);
    this._updateEffects(safeDt);

    if (this.state !== 'PLAYING') return;

    this.elapsedTime += safeDt;

    // Level escalation every 14 seconds
    const nextLevel = 1 + Math.floor(this.elapsedTime / 14);
    if (nextLevel > this.level) {
      this.level = nextLevel;
      this._spawnFloatingText(`🔥 LEVEL ${this.level}!`, this.width * 0.5, this.height * 0.34, '#facc15', 1.4);
      if (this.sound && typeof this.sound.playPoopBonus === 'function') {
        this.sound.playPoopBonus();
      }
    }

    // 1. Update player horizontal X from mirrored head pose X
    let targetX = this.player.targetX;
    if (headPose && typeof headPose.x === 'number') {
      targetX = (1.0 - headPose.x) * this.width;
    }
    const groundY = this.getFloorY() - this.player.radius * 1.06;
    this.player.update(safeDt, targetX, this.width, groundY);

    // Foot dust puffs when running fast
    if (Math.abs(this.player.vx) > 220) {
      this.dustTimer -= safeDt;
      if (this.dustTimer <= 0) {
        this.dustTimer = 0.08;
        this.particles.push({
          x: this.player.x - Math.sign(this.player.vx) * 14,
          y: this.getFloorY() - 3,
          vx: -this.player.vx * 0.18,
          vy: -35 - Math.random() * 25,
          radius: 4 + Math.random() * 3,
          color: 'rgba(226, 232, 240, 0.7)',
          life: 0.32,
          maxLife: 0.32
        });
      }
    }

    // 2. Spawn falling poops & items
    this.spawnTimer -= safeDt;
    if (this.spawnTimer <= 0) {
      this._spawnDrop();
      // Tighter interval as level rises, minimum 0.24s
      const baseInterval = Math.max(0.24, 0.82 - (this.level - 1) * 0.075);
      this.spawnTimer = baseInterval * (0.75 + Math.random() * 0.45);
    }

    // 3. Update drops & check collisions / floor splats
    const floorY = this.getFloorY();
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      drop.update(safeDt, this.width);

      // Player collision check
      if (this.player.collidesWith(drop)) {
        if (!drop.isHazardous) {
          drop.isDead = true;
          this._handleBonusPickup(drop);
        } else if (this.player.shieldTimer > 0) {
          // Shield deflects poop safely!
          drop.isDead = true;
          this.dodgedCount++;
          this._addScore(drop.points * 2);
          this._spawnBurst(drop.x, drop.y, '#38bdf8', 12, 220);
          this._spawnFloatingText(`☂️ 튕겨냄 +${drop.points * 2}`, drop.x, drop.y - 12, '#38bdf8', 1.05);
          if (this.sound && typeof this.sound.playPoopFlush === 'function') {
            this.sound.playPoopFlush();
          }
        } else if (this.player.invulnerableTimer <= 0) {
          drop.isDead = true;
          this._handlePlayerHit(drop);
          if (this.state !== 'PLAYING') return;
        }
      }

      // Floor hit check
      if (!drop.isDead && drop.y + drop.radius >= floorY) {
        drop.isDead = true;
        if (drop.isHazardous) {
          this.dodgedCount++;
          this._addScore(drop.points);
          this._spawnFloorSplat(drop.x, drop);
          this._spawnFloatingText(`+${drop.points}`, drop.x, floorY - 22, '#a3e635', 0.9);
          if (this.sound && typeof this.sound.playPoopFloorSplat === 'function') {
            this.sound.playPoopFloorSplat();
          }
        } else {
          this._spawnBurst(drop.x, floorY - 6, '#e2e8f0', 6, 90);
        }
      }

      if (drop.isDead) {
        this.drops.splice(i, 1);
      }
    }
  }

  _handleBonusPickup(drop) {
    this.player.setExpression('HAPPY', 0.8);
    if (drop.type === DropType.TOILET_PAPER) {
      this._addScore(drop.points);
      this._spawnBurst(drop.x, drop.y, '#f8fafc', 16, 220);
      this._spawnBurst(drop.x, drop.y, '#facc15', 10, 180);
      this._spawnFloatingText(`🧻 +${drop.points} BONUS!`, drop.x, drop.y - 18, '#fde047', 1.25);
      if (this.sound && typeof this.sound.playPoopBonus === 'function') {
        this.sound.playPoopBonus();
      }
    } else if (drop.type === DropType.UMBRELLA) {
      this.player.shieldTimer = 5.5;
      this._addScore(drop.points);
      this._spawnBurst(drop.x, drop.y, '#38bdf8', 18, 220);
      this._spawnFloatingText('☂️ 우산 보호막 ON!', drop.x, drop.y - 18, '#38bdf8', 1.25);
      if (this.sound && typeof this.sound.playPoopFlush === 'function') {
        this.sound.playPoopFlush();
      }
    } else if (drop.type === DropType.HEART) {
      if (this.lives < this.maxLives) {
        this.lives++;
        this.onLivesChanged(this.lives);
        if (this.ui) {
          this.ui.updateLives(this.lives, this.maxLives);
          if (typeof this.ui.showHeal === 'function') this.ui.showHeal();
        }
      }
      this._addScore(drop.points);
      this._spawnBurst(drop.x, drop.y, '#f43f5e', 16, 200);
      this._spawnFloatingText('💖 +1 LIFE!', drop.x, drop.y - 18, '#fb7185', 1.2);
      if (this.sound && typeof this.sound.playPoopBonus === 'function') {
        this.sound.playPoopBonus();
      }
    }
  }

  _handlePlayerHit(drop) {
    this.lives = Math.max(0, this.lives - 1);
    this.onLivesChanged(this.lives);
    if (this.ui) {
      this.ui.updateLives(this.lives, this.maxLives);
    }

    this.player.invulnerableTimer = 1.6;
    this.player.setExpression('OUCH', 1.2);
    this.shakeTimer = 0.42;

    this._spawnBurst(this.player.x, this.player.y - 10, '#78350f', 20, 260);
    this._spawnBurst(this.player.x, this.player.y - 10, '#84cc16', 10, 170);
    this._spawnFloatingText('💩 앗! -1 ❤️', this.player.x, this.player.y - 44, '#ef4444', 1.3);

    if (this.sound && typeof this.sound.playPoopSplat === 'function') {
      this.sound.playPoopSplat();
    }

    if (this.lives <= 0) {
      this.state = 'GAMEOVER';
      this.onGameOver();
    }
  }

  _updateEffects(dt) {
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    }

    for (let i = this.floorSplats.length - 1; i >= 0; i--) {
      const sp = this.floorSplats[i];
      sp.life -= dt;
      if (sp.life <= 0) this.floorSplats.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 380 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 48 * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  render(ctx) {
    if (!ctx) return;
    const w = this.width;
    const h = this.height;
    const floorY = this.getFloorY();

    ctx.save();

    if (this.shakeTimer > 0) {
      const mag = (this.shakeTimer / 0.42) * 14;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    // 1. Dark Atmospheric Arena Overlay over subtle webcam feed
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.55)');
    bgGrad.addColorStop(1, 'rgba(30, 41, 59, 0.72)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Ground Platform Line
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, floorY, w, h - floorY);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(0, floorY, w, 4);

    // 3. Floor Poop Splats
    for (const sp of this.floorSplats) {
      const alpha = Math.max(0, sp.life / sp.maxLife) * 0.75;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y + 4, sp.rx, sp.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Falling Poops & Bonus Items
    for (const drop of this.drops) {
      this._renderDrop(ctx, drop);
    }

    // 5. Player Character
    this._renderPlayer(ctx);

    // 6. Particles & Floating Popups
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const ft of this.floatingTexts) {
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${Math.round(20 * ft.scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 8;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 7. Bottom HUD (Shield bar bottom-left, Level/Dodged badge bottom-right -> zero top HUD overlap)
    this._renderHUD(ctx);

    ctx.restore();
  }

  _renderDrop(ctx, drop) {
    ctx.save();

    // Giant poop pre-drop warning reticle at top
    if (drop.warningTimer > 0) {
      const blink = Math.floor(drop.warningTimer * 16) % 2 === 0;
      ctx.fillStyle = blink ? '#ef4444' : '#facc15';
      ctx.font = '900 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ GIANT!', drop.x, 78);
      ctx.restore();
      return;
    }

    ctx.translate(drop.x, drop.y);
    ctx.rotate(drop.rotation + Math.sin(drop.wobblePhase) * 0.08);

    const r = drop.radius;

    if (drop.isHazardous) {
      // Cartoon Coiled Poop Tiers
      const isGiant = drop.type === DropType.POOP_GIANT;
      const isFast = drop.type === DropType.POOP_FAST;

      const baseCol = isGiant ? '#713f12' : isFast ? '#9a3412' : '#78350f';
      const midCol = isGiant ? '#a16207' : isFast ? '#c2410c' : '#92400e';
      const topCol = isGiant ? '#ca8a04' : isFast ? '#ea580c' : '#a16207';

      // Faint stink aura
      ctx.fillStyle = isFast ? 'rgba(234, 88, 12, 0.25)' : 'rgba(132, 204, 22, 0.18)';
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // Bottom coil
      ctx.fillStyle = baseCol;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.42, r * 0.95, r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();

      // Middle coil
      ctx.fillStyle = midCol;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.05, r * 0.72, r * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();

      // Top peak swirl
      ctx.fillStyle = topCol;
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, -r * 0.05);
      ctx.quadraticCurveTo(0, -r * 1.05, r * 0.35, -r * 0.35);
      ctx.quadraticCurveTo(r * 0.5, -r * 0.05, r * 0.4, -r * 0.05);
      ctx.closePath();
      ctx.fill();

      // Cute comical googly eyes (or cool sunglasses on King Giant Poop!)
      if (isGiant) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-r * 0.48, -r * 0.12, r * 0.4, r * 0.24);
        ctx.fillRect(r * 0.08, -r * 0.12, r * 0.4, r * 0.24);
        ctx.fillRect(-r * 0.1, -r * 0.04, r * 0.2, r * 0.07);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-r * 0.2, 0, r * 0.16, 0, Math.PI * 2);
        ctx.arc(r * 0.2, 0, r * 0.16, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(-r * 0.2, 2, r * 0.08, 0, Math.PI * 2);
        ctx.arc(r * 0.2, 2, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (drop.type === DropType.TOILET_PAPER) {
      // Glowing Golden-White Toilet Roll
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-r * 0.7, -r * 0.75, r * 1.4, r * 1.5);
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.75, r * 0.7, r * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.75, r * 0.26, r * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      // Hanging loose sheet
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(r * 0.55, -r * 0.35, r * 0.35, r * 0.9);
    } else if (drop.type === DropType.UMBRELLA) {
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, 2, r * 0.9, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.85);
      ctx.lineTo(0, r * 0.85);
      ctx.arc(-4, r * 0.85, 4, 0, Math.PI);
      ctx.stroke();
    } else if (drop.type === DropType.HEART) {
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(-r * 0.35, -r * 0.2, r * 0.42, 0, Math.PI * 2);
      ctx.arc(r * 0.35, -r * 0.2, r * 0.42, 0, Math.PI * 2);
      ctx.moveTo(-r * 0.75, -r * 0.05);
      ctx.lineTo(0, r * 0.82);
      ctx.lineTo(r * 0.75, -r * 0.05);
      ctx.fill();
    }

    ctx.restore();
  }

  _renderPlayer(ctx) {
    const p = this.player;
    const r = p.radius; // 34 (+30% larger chibi ninja runner)
    const s = r / 26;   // ~1.308 overall proportional visual scale
    ctx.save();

    if (p.invulnerableTimer > 0 && Math.floor(p.invulnerableTimer * 12) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    // Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.ellipse(p.x, this.getFloorY() + 3, r * 0.92, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Active Umbrella Bubble Shield + Overhead Parasol
    if (p.shieldTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 6 * s, r + 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Canopy umbrella dome overhead
      ctx.fillStyle = '#0ea5e9';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 28 * s, r * 1.15, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    const bob = Math.abs(Math.sin(p.runAnim)) * 3.5 * s * (Math.abs(p.vx) > 40 ? 1 : 0);
    ctx.translate(p.x, p.y - bob);
    ctx.rotate(p.tilt);

    const legSwing = Math.sin(p.runAnim) * 8 * s * Math.min(1, Math.abs(p.vx) / 140);
    const armSwing = -legSwing * 0.85;
    const lookBias = Math.max(-2.5, Math.min(2.5, p.vx / 260)) * s;
    const tailWave = Math.sin(this.elapsedTime * 11) * 4 * s - Math.sign(p.vx) * 5 * s;

    // 1. Dynamic Flowing Headband Ribbon Tails (behind head/neck)
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4.5 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(11 * s, -17 * s);
    ctx.quadraticCurveTo(21 * s + tailWave * 0.4, -19 * s, 26 * s + tailWave, -11 * s);
    ctx.moveTo(10 * s, -15 * s);
    ctx.quadraticCurveTo(18 * s + tailWave * 0.3, -12 * s, 22 * s + tailWave * 0.8, -5 * s);
    ctx.stroke();

    // 2. Running Legs & Sneakers
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(-7 * s, 10 * s);
    ctx.lineTo(-9 * s + legSwing, 23 * s);
    ctx.moveTo(7 * s, 10 * s);
    ctx.lineTo(9 * s - legSwing, 23 * s);
    ctx.stroke();

    // Shoes (white soles + sky trim)
    [
      { x: -9 * s + legSwing, dir: -1 },
      { x: 9 * s - legSwing, dir: 1 }
    ].forEach((shoe) => {
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.ellipse(shoe.x + shoe.dir * 2 * s, 24 * s, 7 * s, 4 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(shoe.x - 5 * s, 25.5 * s, 11 * s, 2.5 * s);
    });

    // 3. Back Arm
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(-11 * s, 2 * s);
    ctx.lineTo(-19 * s - armSwing * 0.5, 9 * s + armSwing * 0.4);
    ctx.moveTo(11 * s, 2 * s);
    ctx.lineTo(19 * s + armSwing * 0.5, 9 * s - armSwing * 0.4);
    ctx.stroke();

    // 4. Stylized Ninja Tunic Torso (navy with cyan sash belt)
    ctx.fillStyle = '#1e3a8a';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.roundRect(-12 * s, -2 * s, 24 * s, 16 * s, 6 * s);
    ctx.fill();
    ctx.stroke();

    // Cyan belt sash & chest emblem
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-12 * s, 7 * s, 24 * s, 4 * s);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, 9 * s, 2.8 * s, 0, Math.PI * 2);
    ctx.fill();

    // 5. Chibi Character Head (warm gradient + crisp outline)
    const headGrad = ctx.createRadialGradient(-4 * s, -18 * s, 3 * s, 0, -14 * s, 19 * s);
    headGrad.addColorStop(0, '#fef9c3');
    headGrad.addColorStop(0.65, '#fde047');
    headGrad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(0, -14 * s, 16.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.2 * s;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();

    // Spiky Dark Hair Tufts poking above headband
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(-12 * s, -22 * s);
    ctx.lineTo(-14 * s, -32 * s);
    ctx.lineTo(-5 * s, -27 * s);
    ctx.lineTo(0, -35 * s);
    ctx.lineTo(6 * s, -27 * s);
    ctx.lineTo(14 * s, -31 * s);
    ctx.lineTo(12 * s, -22 * s);
    ctx.closePath();
    ctx.fill();

    // Crimson Ninja Headband + Metal Emblem Plate
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.roundRect(-16 * s, -24 * s, 32 * s, 7 * s, 2.5 * s);
    ctx.fill();
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 1.4 * s;
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-5 * s, -23 * s, 10 * s, 5 * s);

    // Rosy Cheeks
    ctx.fillStyle = 'rgba(244, 63, 94, 0.42)';
    ctx.beginPath();
    ctx.ellipse(-9 * s + lookBias * 0.5, -10 * s, 3.2 * s, 2 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(9 * s + lookBias * 0.5, -10 * s, 3.2 * s, 2 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 6. Expressive Anime Eyes + Catchlights
    ctx.strokeStyle = '#0f172a';
    ctx.fillStyle = '#0f172a';
    if (p.expression === 'OUCH') {
      ctx.lineWidth = 2.4 * s;
      ctx.beginPath();
      ctx.moveTo(-9 * s, -15 * s);
      ctx.lineTo(-4 * s, -10 * s);
      ctx.moveTo(-4 * s, -15 * s);
      ctx.lineTo(-9 * s, -10 * s);
      ctx.moveTo(4 * s, -15 * s);
      ctx.lineTo(9 * s, -10 * s);
      ctx.moveTo(9 * s, -15 * s);
      ctx.lineTo(4 * s, -10 * s);
      ctx.stroke();
    } else if (p.expression === 'HAPPY') {
      ctx.lineWidth = 2.4 * s;
      ctx.beginPath();
      ctx.arc(-6.5 * s, -12 * s, 3.5 * s, Math.PI, 0);
      ctx.arc(6.5 * s, -12 * s, 3.5 * s, Math.PI, 0);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(-6.5 * s + lookBias, -13 * s, 2.8 * s, 3.6 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(6.5 * s + lookBias, -13 * s, 2.8 * s, 3.6 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // Sparkling eye catchlights
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-7.3 * s + lookBias, -14.3 * s, 1.1 * s, 0, Math.PI * 2);
      ctx.arc(5.7 * s + lookBias, -14.3 * s, 1.1 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7. Expressive Mouth
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.8 * s;
    ctx.beginPath();
    if (p.expression === 'OUCH') {
      ctx.arc(0, -5 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (p.expression === 'HAPPY') {
      ctx.arc(lookBias * 0.4, -7 * s, 5 * s, 0, Math.PI);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.moveTo(-4 * s + lookBias * 0.5, -6 * s);
      ctx.quadraticCurveTo(lookBias * 0.5, -4.5 * s, 4 * s + lookBias * 0.5, -6 * s);
      ctx.stroke();
    }

    ctx.restore();
  }

  _renderHUD(ctx) {
    const w = this.width;
    const h = this.height;

    ctx.save();

    // Bottom-left Head X Tracking & Shield Status Pill
    ctx.textAlign = 'left';
    if (this.player.shieldTimer > 0) {
      ctx.fillStyle = '#38bdf8';
      ctx.font = '900 15px system-ui, sans-serif';
      ctx.fillText(`☂️ SHIELD: ${this.player.shieldTimer.toFixed(1)}s`, 24, h - 24);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillText('🙂 머리를 좌우로 움직여 똥을 피하세요!', 24, h - 22);
    }

    // Bottom-right Level & Dodged Count
    ctx.textAlign = 'right';
    ctx.fillStyle = '#facc15';
    ctx.font = '900 16px system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 6;
    ctx.fillText(`LVL ${this.level} · DODGED ${this.dodgedCount}`, w - 24, h - 24);

    ctx.restore();
  }
}
