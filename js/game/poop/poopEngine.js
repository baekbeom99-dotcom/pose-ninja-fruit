/**
 * Poop Dodge Mode Core Engine ("💩 똥피하기")
 * Features:
 *   - Head X-axis controlled dodge with 033-038 sprite characters selected randomly
 *   - Anti-camping targeted poop spawn if player stays in one spot ~3s
 *   - Collectible Rainbow Poop (+25 bonus points)
 *   - Past Lv5: Huge Elephant Poops leaving 5s slippery ice patches that hinder steering
 *   - Periodic Poop Storm Alarm highlighting Safe Zone before carpet-bombing all other columns
 */

import { soundManager } from '../../audio/soundManager.js';
import {
  DropType,
  FallingDrop,
  POOP_SPRITE_IDS,
  PoopPlayer
} from './poopEntities.js';

export class PoopEngine {
  constructor(width = 1280, height = 720, ui = null, sound = null) {
    this.width = width;
    this.height = height;
    this.ui = ui;
    this.sound = sound || soundManager;

    this.floorOffset = 52;
    this.player = new PoopPlayer(width * 0.5, this.getFloorY() - 36);

    // Preload 033-038 walk sprite sheets in browser environments
    this.spriteCache = {};
    this.selectedSpriteId = POOP_SPRITE_IDS[0];
    this._initSprites();

    this.drops = [];
    this.particles = [];
    this.floorSplats = [];
    this.icePatches = [];
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

    // Anti-camping tracker (prevent staying in same X spot >= 3s)
    this.campAnchorX = width * 0.5;
    this.campTimer = 0;
    this.campWarned = false;

    // Periodic Poop Storm with Safe Zone Alarm
    this.stormCooldown = 14.0;
    this.stormState = null; // { phase: 'WARNING'|'POST', timer, safeX, safeHalfW }

    this.onScore = () => {};
    this.onLivesChanged = () => {};
    this.onGameOver = () => {};
  }

  _initSprites() {
    if (typeof Image === 'undefined') return;
    POOP_SPRITE_IDS.forEach((id) => {
      const img = new Image();
      img.src = `assets/sprites/poop/${id}_walk.png`;
      this.spriteCache[id] = img;
    });
  }

  _pickRandomSpriteId() {
    const candidates = POOP_SPRITE_IDS.filter((id) => id !== this.selectedSpriteId);
    const pool = candidates.length > 0 ? candidates : POOP_SPRITE_IDS;
    this.selectedSpriteId = pool[Math.floor(Math.random() * pool.length)];
    return this.selectedSpriteId;
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
    this.icePatches = [];
    this.floatingTexts = [];

    this.score = 0;
    this.dodgedCount = 0;
    this.lives = this.maxLives;
    this.level = 1;
    this.elapsedTime = 0;
    this.spawnTimer = 0.25;
    this.dustTimer = 0;
    this.shakeTimer = 0;

    this.campAnchorX = this.width * 0.5;
    this.campTimer = 0;
    this.campWarned = false;

    this.stormCooldown = 14.0;
    this.stormState = null;

    this._pickRandomSpriteId();
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

  _spawnDrop(forcedType = null, forcedX = null, forcedVx = 0) {
    const margin = 44;
    const x =
      forcedX != null
        ? Math.max(margin, Math.min(this.width - margin, forcedX))
        : margin + Math.random() * Math.max(60, this.width - margin * 2);

    let type = forcedType;
    let vx = forcedVx;

    if (!type) {
      const roll = Math.random();
      if (roll < 0.055) {
        type = DropType.POOP_RAINBOW;
      } else if (roll < 0.095) {
        type = DropType.TOILET_PAPER;
      } else if (roll < 0.125) {
        type = DropType.UMBRELLA;
      } else if (roll < 0.145 && this.lives < this.maxLives) {
        type = DropType.HEART;
      } else if (this.level > 5 && roll < 0.25) {
        // Unlocked past Lv5: huge Elephant Poop!
        type = DropType.POOP_ELEPHANT;
        if (this.sound && typeof this.sound.playPoopWarning === 'function') {
          this.sound.playPoopWarning();
        }
      } else if (this.level >= 2 && roll < 0.34) {
        type = DropType.POOP_GIANT;
        if (this.sound && typeof this.sound.playPoopWarning === 'function') {
          this.sound.playPoopWarning();
        }
      } else if (this.level >= 3 && roll < 0.48) {
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

  /**
   * Starts a Poop Storm Alarm announcing a Safe Zone before carpet-bombing all other columns.
   */
  triggerPoopStorm(safeXOverride = null) {
    const margin = 120;
    const safeHalfW = Math.max(76, Math.min(100, this.width * 0.08));
    const safeX =
      safeXOverride != null
        ? Math.max(margin, Math.min(this.width - margin, safeXOverride))
        : margin + Math.random() * Math.max(80, this.width - margin * 2);

    this.stormState = {
      phase: 'WARNING',
      timer: 2.2,
      safeX,
      safeHalfW
    };

    if (this.sound && typeof this.sound.playPoopStormAlarm === 'function') {
      this.sound.playPoopStormAlarm();
    }
    return this.stormState;
  }

  _executeStormBarrage(safeX, safeHalfW) {
    const step = 80;
    const startX = 44;
    const endX = this.width - 44;
    for (let cx = startX; cx <= endX; cx += step) {
      if (Math.abs(cx - safeX) <= safeHalfW) {
        // Leave Safe Zone completely clear of storm poops!
        continue;
      }
      const d = new FallingDrop(cx, 10, DropType.POOP_NORMAL, this.level, 0);
      d.vy = 320 + this.level * 18;
      this.drops.push(d);
    }
  }

  isPointOnIce(x) {
    for (let i = 0; i < this.icePatches.length; i++) {
      const ip = this.icePatches[i];
      if (ip.life > 0 && Math.abs(x - ip.x) <= ip.halfWidth) {
        return true;
      }
    }
    return false;
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
    if (drop.type === DropType.POOP_ELEPHANT) {
      // Elephant poop impact creates a 5-second slippery ice patch & heavy shake!
      this.shakeTimer = Math.max(this.shakeTimer, 0.45);
      this.icePatches.push({
        x,
        y: floorY,
        halfWidth: 145,
        life: 5.0,
        maxLife: 5.0
      });
      this._spawnBurst(x, floorY - 6, '#38bdf8', 16, 210);
      this._spawnBurst(x, floorY - 6, '#78350f', 12, 160);
      this._spawnFloatingText('❄️ 빙판 생성 (5초)!', x, floorY - 36, '#7dd3fc', 1.15);
      if (this.sound && typeof this.sound.playPoopElephantSplat === 'function') {
        this.sound.playPoopElephantSplat();
      }
      return;
    }

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

    // Level escalates smoothly every 10s (reaches past Lv5 around 50s -> unlocks Elephant Poop)
    const nextLevel = 1 + Math.floor(this.elapsedTime / 10);
    if (nextLevel > this.level) {
      this.level = nextLevel;
      const lvlMsg =
        this.level === 6
          ? '🐘 LEVEL 6! 코끼리 똥 + 빙판 등장!'
          : `🔥 LEVEL ${this.level}!`;
      this._spawnFloatingText(lvlMsg, this.width * 0.5, this.height * 0.34, '#facc15', 1.35);
      if (this.sound && typeof this.sound.playPoopBonus === 'function') {
        this.sound.playPoopBonus();
      }
    }

    // 1. Update player horizontal X from mirrored head pose X (and apply Ice slip physics)
    let targetX = this.player.targetX;
    if (headPose && typeof headPose.x === 'number') {
      targetX = (1.0 - headPose.x) * this.width;
    }
    const groundY = this.getFloorY() - this.player.radius * 1.06;
    const onIce = this.isPointOnIce(this.player.x);
    this.player.update(safeDt, targetX, this.width, groundY, onIce);

    // Running dust or ice frost puffs
    if (Math.abs(this.player.vx) > 200) {
      this.dustTimer -= safeDt;
      if (this.dustTimer <= 0) {
        this.dustTimer = 0.08;
        this.particles.push({
          x: this.player.x - Math.sign(this.player.vx) * 14,
          y: this.getFloorY() - 3,
          vx: -this.player.vx * 0.18,
          vy: -35 - Math.random() * 25,
          radius: 4 + Math.random() * 3,
          color: onIce ? 'rgba(125, 211, 252, 0.85)' : 'rgba(226, 232, 240, 0.7)',
          life: 0.32,
          maxLife: 0.32
        });
      }
    }

    // 2. Anti-Camping Enforcement: prevent standing in the same spot >= 3 seconds
    if (Math.abs(this.player.x - this.campAnchorX) <= 52) {
      this.campTimer += safeDt;
      if (this.campTimer >= 2.0 && !this.campWarned) {
        this.campWarned = true;
        this._spawnFloatingText('⚠️ 한 자리 오래 금지!', this.player.x, this.player.y - 60, '#fb923c', 1.0);
      }
      if (this.campTimer >= 2.65) {
        this.campTimer = 0;
        this.campWarned = false;
        const aimX = this.player.x + (Math.random() - 0.5) * 20;
        this._spawnDrop(DropType.POOP_FAST, aimX, 0);
      }
    } else {
      this.campAnchorX = this.player.x;
      this.campTimer = 0;
      this.campWarned = false;
    }

    // 3. Periodic Poop Storm Alarm & Safe Zone Curtain Drop
    if (this.stormState) {
      this.stormState.timer -= safeDt;
      if (this.stormState.phase === 'WARNING' && this.stormState.timer <= 0) {
        this._executeStormBarrage(this.stormState.safeX, this.stormState.safeHalfW);
        this.stormState = {
          phase: 'POST',
          timer: 0.9,
          safeX: this.stormState.safeX,
          safeHalfW: this.stormState.safeHalfW
        };
      } else if (this.stormState.phase === 'POST' && this.stormState.timer <= 0) {
        this.stormState = null;
        this.stormCooldown = 16.0 + Math.random() * 5.0;
      }
    } else {
      this.stormCooldown -= safeDt;
      if (this.stormCooldown <= 0 && this.level >= 2) {
        this.triggerPoopStorm();
      }
    }

    // 4. Regular falling drops spawner
    this.spawnTimer -= safeDt;
    if (this.spawnTimer <= 0) {
      this._spawnDrop();
      const baseInterval = Math.max(0.24, 0.80 - (this.level - 1) * 0.068);
      this.spawnTimer = baseInterval * (0.75 + Math.random() * 0.45);
    }

    // 5. Update drops & check collisions / floor splats
    const floorY = this.getFloorY();
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      drop.update(safeDt, this.width);

      if (this.player.collidesWith(drop)) {
        if (!drop.isHazardous) {
          drop.isDead = true;
          this._handleBonusPickup(drop);
        } else if (this.player.shieldTimer > 0) {
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

      if (!drop.isDead && drop.y + drop.radius >= floorY) {
        drop.isDead = true;
        if (drop.isHazardous) {
          this.dodgedCount++;
          this._addScore(drop.points);
          this._spawnFloorSplat(drop.x, drop);
          if (drop.type !== DropType.POOP_ELEPHANT) {
            this._spawnFloatingText(`+${drop.points}`, drop.x, floorY - 22, '#a3e635', 0.9);
            if (this.sound && typeof this.sound.playPoopFloorSplat === 'function') {
              this.sound.playPoopFloorSplat();
            }
          }
        } else if (drop.type === DropType.POOP_RAINBOW) {
          this._spawnBurst(drop.x, floorY - 6, '#f472b6', 8, 120);
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
    if (drop.type === DropType.POOP_RAINBOW) {
      this._addScore(drop.points);
      ['#ef4444', '#facc15', '#4ade80', '#38bdf8', '#d946ef'].forEach((c) => {
        this._spawnBurst(drop.x, drop.y, c, 4, 210);
      });
      this._spawnFloatingText(`🌈 무지개 똥 +${drop.points}!`, drop.x, drop.y - 22, '#fde047', 1.3);
      if (this.sound && typeof this.sound.playPoopBonus === 'function') {
        this.sound.playPoopBonus();
      }
    } else if (drop.type === DropType.TOILET_PAPER) {
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

    if (drop.type === DropType.POOP_ELEPHANT) {
      this._spawnFloorSplat(drop.x, drop);
    }

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

    for (let i = this.icePatches.length - 1; i >= 0; i--) {
      this.icePatches[i].life -= dt;
      if (this.icePatches[i].life <= 0) {
        this.icePatches.splice(i, 1);
      }
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

    // 1. Dark Atmospheric Arena Overlay
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.55)');
    bgGrad.addColorStop(1, 'rgba(30, 41, 59, 0.72)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Poop Storm Safe Zone Highlight / Danger Columns (when alarm active)
    this._renderStormZones(ctx, floorY);

    // 3. Ground Platform Line
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, floorY, w, h - floorY);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(0, floorY, w, 4);

    // 4. Slippery Ice Patches & Floor Splats
    this._renderIcePatches(ctx, floorY);

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

    // 5. Falling Poops & Bonus Items
    for (const drop of this.drops) {
      this._renderDrop(ctx, drop);
    }

    // 6. Player Character (033-038 Sprite or procedural fallback)
    this._renderPlayer(ctx);

    // 7. Particles & Floating Popups
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

    // 8. Bottom HUD
    this._renderHUD(ctx);

    ctx.restore();
  }

  _renderStormZones(ctx, floorY) {
    if (!this.stormState) return;
    const { phase, timer, safeX, safeHalfW } = this.stormState;
    const leftSafe = Math.max(0, safeX - safeHalfW);
    const rightSafe = Math.min(this.width, safeX + safeHalfW);

    ctx.save();
    if (phase === 'WARNING') {
      const blink = Math.floor(timer * 8) % 2 === 0;
      // Danger red columns everywhere except Safe Zone
      ctx.fillStyle = blink ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.12)';
      ctx.fillRect(0, 0, leftSafe, floorY);
      ctx.fillRect(rightSafe, 0, Math.max(0, this.width - rightSafe), floorY);

      // Glowing Green Safe Sanctuary Pillar
      ctx.fillStyle = 'rgba(34, 197, 94, 0.22)';
      ctx.fillRect(leftSafe, 0, rightSafe - leftSafe, floorY);
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 3;
      ctx.strokeRect(leftSafe, 4, rightSafe - leftSafe, floorY - 4);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#86efac';
      ctx.font = '900 20px system-ui, sans-serif';
      ctx.fillText('🛡️ SAFE ZONE', safeX, floorY - 22);

      // Urgent Banner below Hearts (no HUD overlap)
      ctx.fillStyle = blink ? '#facc15' : '#ef4444';
      ctx.font = '900 26px system-ui, sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 10;
      ctx.fillText(
        `🚨 똥 폭격 경보! 초록 안전구역으로 대피! (${timer.toFixed(1)}s)`,
        this.width * 0.5,
        122
      );
    } else {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.12)';
      ctx.fillRect(leftSafe, 0, rightSafe - leftSafe, floorY);
    }
    ctx.restore();
  }

  _renderIcePatches(ctx, floorY) {
    for (const ip of this.icePatches) {
      const alpha = Math.min(1, ip.life / 0.8);
      ctx.save();
      ctx.globalAlpha = alpha;

      // Translucent icy frozen surface right along the floor
      const grad = ctx.createLinearGradient(ip.x - ip.halfWidth, floorY, ip.x + ip.halfWidth, floorY);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
      grad.addColorStop(0.5, 'rgba(186, 230, 253, 0.78)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.15)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(ip.x - ip.halfWidth, floorY - 4, ip.halfWidth * 2, 16, 8);
      ctx.fill();

      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Central dung stain & crack lines fading out over 5s
      ctx.fillStyle = 'rgba(120, 53, 15, 0.55)';
      ctx.beginPath();
      ctx.ellipse(ip.x, floorY + 2, 42, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#bae6fd';
      ctx.font = '800 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`❄️ 빙판 (${Math.ceil(ip.life)}s)`, ip.x, floorY + 28);
      ctx.restore();
    }
  }

  _renderDrop(ctx, drop) {
    ctx.save();

    // Giant / Elephant poop pre-drop warning reticle
    if (drop.warningTimer > 0) {
      const blink = Math.floor(drop.warningTimer * 16) % 2 === 0;
      ctx.fillStyle = blink ? '#ef4444' : '#facc15';
      ctx.font = drop.type === DropType.POOP_ELEPHANT ? '900 22px system-ui, sans-serif' : '900 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        drop.type === DropType.POOP_ELEPHANT ? '⚠️ 🐘 코끼리 똥!' : '⚠️ GIANT!',
        drop.x,
        82
      );
      ctx.restore();
      return;
    }

    ctx.translate(drop.x, drop.y);
    ctx.rotate(drop.rotation + Math.sin(drop.wobblePhase) * 0.08);

    const r = drop.radius;

    if (drop.type === DropType.POOP_RAINBOW) {
      // Shimmering Rainbow Poop Bonus!
      ctx.shadowColor = '#f472b6';
      ctx.shadowBlur = 18;

      const hues = [
        (this.elapsedTime * 180) % 360,
        (this.elapsedTime * 180 + 60) % 360,
        (this.elapsedTime * 180 + 130) % 360
      ];
      ctx.fillStyle = `hsl(${hues[0]}, 92%, 58%)`;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.42, r * 0.95, r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `hsl(${hues[1]}, 92%, 60%)`;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.05, r * 0.72, r * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `hsl(${hues[2]}, 92%, 62%)`;
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, -r * 0.05);
      ctx.quadraticCurveTo(0, -r * 1.05, r * 0.35, -r * 0.35);
      ctx.quadraticCurveTo(r * 0.5, -r * 0.05, r * 0.4, -r * 0.05);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-r * 0.2, 0, r * 0.16, 0, Math.PI * 2);
      ctx.arc(r * 0.2, 0, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-r * 0.2, 1, r * 0.08, 0, Math.PI * 2);
      ctx.arc(r * 0.2, 1, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
    } else if (drop.isHazardous) {
      const isElephant = drop.type === DropType.POOP_ELEPHANT;
      const isGiant = drop.type === DropType.POOP_GIANT;
      const isFast = drop.type === DropType.POOP_FAST;

      const baseCol = isElephant ? '#451a03' : isGiant ? '#713f12' : isFast ? '#9a3412' : '#78350f';
      const midCol = isElephant ? '#78350f' : isGiant ? '#a16207' : isFast ? '#c2410c' : '#92400e';
      const topCol = isElephant ? '#92400e' : isGiant ? '#ca8a04' : isFast ? '#ea580c' : '#a16207';

      ctx.fillStyle = isElephant
        ? 'rgba(56, 189, 248, 0.22)'
        : isFast
          ? 'rgba(234, 88, 12, 0.25)'
          : 'rgba(132, 204, 22, 0.18)';
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = baseCol;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.42, r * 0.95, r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = midCol;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.05, r * 0.72, r * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = topCol;
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, -r * 0.05);
      ctx.quadraticCurveTo(0, -r * 1.05, r * 0.35, -r * 0.35);
      ctx.quadraticCurveTo(r * 0.5, -r * 0.05, r * 0.4, -r * 0.05);
      ctx.closePath();
      ctx.fill();

      if (isElephant) {
        // Icy frost glint + angry brow on Mega Elephant Poop
        ctx.fillStyle = '#bae6fd';
        ctx.beginPath();
        ctx.arc(-r * 0.3, -r * 0.35, r * 0.1, 0, Math.PI * 2);
        ctx.arc(r * 0.25, r * 0.1, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-r * 0.22, -r * 0.02, r * 0.15, 0, Math.PI * 2);
        ctx.arc(r * 0.22, -r * 0.02, r * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(-r * 0.22, 0, r * 0.08, 0, Math.PI * 2);
        ctx.arc(r * 0.22, 0, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
      } else if (isGiant) {
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
    const r = p.radius;
    const floorY = this.getFloorY();
    ctx.save();

    if (p.invulnerableTimer > 0 && Math.floor(p.invulnerableTimer * 12) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    // Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.ellipse(p.x, floorY + 3, r * 0.95, 9, 0, 0, Math.PI * 2);
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
      ctx.arc(p.x, p.y - 12, r + 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0ea5e9';
      ctx.beginPath();
      ctx.arc(p.x, p.y - r * 1.45, r * 1.25, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    const img = this.spriteCache[this.selectedSpriteId];
    const spriteReady = img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;

    if (spriteReady) {
      const cellW = img.naturalWidth / 4;
      const cellH = img.naturalHeight / 4;

      let row = 0;
      let col = 0;
      if (p.vx > 28) {
        row = 2; // Right walk
        col = Math.floor(p.walkFrame) % 4;
      } else if (p.vx < -28) {
        row = 3; // Left walk
        col = Math.floor(p.walkFrame) % 4;
      }

      const drawH = r * 3.35; // ~114px tall crisp +30% chibi sprite
      const drawW = drawH * (cellW / cellH);

      ctx.save();
      ctx.translate(p.x, floorY + 2);
      ctx.rotate(p.tilt * 0.65);
      ctx.drawImage(
        img,
        col * cellW,
        row * cellH,
        cellW,
        cellH,
        -drawW * 0.5,
        -drawH,
        drawW,
        drawH
      );
      ctx.restore();
    } else {
      // Headless / pre-load stylized ninja fallback
      const s = r / 26;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.tilt);
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, -10 * s, 16 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-16 * s, -20 * s, 32 * s, 6 * s);
      ctx.restore();
    }

    // Floating status badge above character when slipping on ice / dizzy / happy
    if (p.isOnIce) {
      ctx.textAlign = 'center';
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.fillStyle = '#7dd3fc';
      ctx.fillText('❄️ 미끄럼!', p.x, floorY - r * 3.55);
    } else if (p.expression === 'OUCH') {
      ctx.textAlign = 'center';
      ctx.font = '900 16px system-ui, sans-serif';
      ctx.fillStyle = '#ef4444';
      ctx.fillText('💫 앗!', p.x, floorY - r * 3.55);
    }

    ctx.restore();
  }

  _renderHUD(ctx) {
    const w = this.width;
    const h = this.height;

    ctx.save();

    ctx.textAlign = 'left';
    if (this.player.shieldTimer > 0) {
      ctx.fillStyle = '#38bdf8';
      ctx.font = '900 15px system-ui, sans-serif';
      ctx.fillText(`☂️ SHIELD: ${this.player.shieldTimer.toFixed(1)}s`, 24, h - 24);
    } else if (this.player.isOnIce) {
      ctx.fillStyle = '#7dd3fc';
      ctx.font = '900 14px system-ui, sans-serif';
      ctx.fillText('❄️ 빙판 위! 미끄러짐 주의!', 24, h - 22);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillText(`🙂 머리 좌우 이동 · 캐릭터 #${this.selectedSpriteId}`, 24, h - 22);
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = '#facc15';
    ctx.font = '900 16px system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 6;
    ctx.fillText(`LVL ${this.level} · DODGED ${this.dodgedCount}`, w - 24, h - 24);

    ctx.restore();
  }
}
