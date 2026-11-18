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
  PoopPlayer,
  isHazardType
} from './poopEntities.js';

export const POOP_SCENE_THEMES = ['PARK', 'BEACH', 'CHERRY_BLOSSOM', 'SUNSET_MEADOW'];

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
    this.sceneTheme = POOP_SCENE_THEMES[0];
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

  _pickRandomScene() {
    const candidates = POOP_SCENE_THEMES.filter((t) => t !== this.sceneTheme);
    const pool = candidates.length > 0 ? candidates : POOP_SCENE_THEMES;
    this.sceneTheme = pool[Math.floor(Math.random() * pool.length)];
    return this.sceneTheme;
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
    this._pickRandomScene();
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

  isXInSafeZone(x, extraPad = 0) {
    if (!this.stormState) return false;
    return Math.abs(x - this.stormState.safeX) <= this.stormState.safeHalfW + extraPad;
  }

  _pickXOutsideSafeZone(margin, pad = 40) {
    if (!this.stormState) {
      return margin + Math.random() * Math.max(60, this.width - margin * 2);
    }
    const safeLeft = this.stormState.safeX - this.stormState.safeHalfW - pad;
    const safeRight = this.stormState.safeX + this.stormState.safeHalfW + pad;
    const segments = [];
    if (safeLeft > margin + 8) {
      segments.push([margin, safeLeft]);
    }
    if (safeRight < this.width - margin - 8) {
      segments.push([safeRight, this.width - margin]);
    }
    if (segments.length === 0) {
      return Math.random() < 0.5 ? margin : this.width - margin;
    }
    const widths = segments.map(([a, b]) => b - a);
    const total = widths.reduce((sum, w) => sum + w, 0);
    let pick = Math.random() * total;
    for (let i = 0; i < segments.length; i++) {
      if (pick <= widths[i] || i === segments.length - 1) {
        const [a, b] = segments[i];
        return a + Math.random() * (b - a);
      }
      pick -= widths[i];
    }
    return segments[0][0];
  }

  _spawnDrop(forcedType = null, forcedX = null, forcedVx = 0) {
    const margin = 44;
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

    const hazard = isHazardType(type);
    const dropPad =
      type === DropType.POOP_ELEPHANT ? 72 : type === DropType.POOP_GIANT ? 48 : 34;

    let x;
    if (forcedX != null) {
      x = Math.max(margin, Math.min(this.width - margin, forcedX));
    } else if (this.stormState && hazard) {
      // Never spawn hazardous poops inside or overlapping Safe Zone (before & after activation)
      x = this._pickXOutsideSafeZone(margin, dropPad);
    } else {
      x = margin + Math.random() * Math.max(60, this.width - margin * 2);
    }

    // Prevent horizontal drift of fast poops into the Safe Zone while storm protection is active
    if (this.stormState && hazard) {
      vx = 0;
    }

    const drop = new FallingDrop(x, 12, type, this.level, vx);
    this.drops.push(drop);
    return drop;
  }

  /**
   * Starts a Poop Storm Alarm announcing a Safe Zone before carpet-bombing all other columns.
   * Clears existing falling hazards inside the Safe Zone and keeps it hazard-free before and after activation.
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

    // Purge any mid-air hazardous poops inside the Safe Zone column so it is immediately safe
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (!d.isHazardous) continue;
      if (Math.abs(d.x - safeX) <= safeHalfW + d.radius + 10) {
        this._spawnBurst(d.x, d.y, '#4ade80', 8, 120);
        this.drops.splice(i, 1);
      } else if (d.vx !== 0) {
        // Stop diagonal fast poops outside the Safe Zone from drifting sideways into it
        d.vx = 0;
      }
    }

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
      if (Math.abs(cx - safeX) <= safeHalfW + 30) {
        // Leave Safe Zone completely clear of storm poops (including edge radius)
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
    //    Pause enforcement while sheltering inside active Safe Zone (before & after barrage)
    if (this.stormState && this.isXInSafeZone(this.player.x, 30)) {
      this.campTimer = 0;
      this.campWarned = false;
    } else if (Math.abs(this.player.x - this.campAnchorX) <= 52) {
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
          timer: 2.5,
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

    // 1. Light Pastel Scenic Background (preserves subtle webcam visibility underneath)
    const groundColors = this._renderScenicBackground(ctx, w, h, floorY);

    // 2. Poop Storm Safe Zone Highlight / Danger Columns (borderless!)
    this._renderStormZones(ctx, floorY);

    // 3. Soft Pastel Ground Platform Line
    ctx.fillStyle = groundColors.base;
    ctx.fillRect(0, floorY, w, h - floorY);
    ctx.fillStyle = groundColors.trim;
    ctx.fillRect(0, floorY, w, 5);

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
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 8. Bottom HUD
    this._renderHUD(ctx);

    ctx.restore();
  }

  _drawSoftCloud(ctx, cx, cy, scale = 1.0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.arc(24, -6, 20, 0, Math.PI * 2);
    ctx.arc(-22, -4, 18, 0, Math.PI * 2);
    ctx.arc(42, 4, 14, 0, Math.PI * 2);
    ctx.arc(-38, 5, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawRollingHill(ctx, w, floorY, peakHeight, crestRatio, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.quadraticCurveTo(w * crestRatio, floorY - peakHeight, w, floorY);
    ctx.lineTo(w, floorY);
    ctx.closePath();
    ctx.fill();
  }

  _renderScenicBackground(ctx, w, h, floorY) {
    const palettes = {
      PARK: {
        skyTop: 'rgba(186, 230, 253, 0.56)',
        skyBot: 'rgba(224, 242, 254, 0.44)',
        sunColor: 'rgba(254, 240, 138, 0.72)',
        hillBack: 'rgba(134, 239, 172, 0.38)',
        hillFront: 'rgba(110, 231, 183, 0.46)',
        base: 'rgba(134, 239, 172, 0.78)',
        trim: 'rgba(74, 222, 128, 0.85)'
      },
      BEACH: {
        skyTop: 'rgba(207, 250, 254, 0.56)',
        skyBot: 'rgba(254, 249, 195, 0.46)',
        sunColor: 'rgba(253, 224, 71, 0.68)',
        hillBack: 'rgba(125, 211, 252, 0.42)',
        hillFront: 'rgba(56, 189, 248, 0.34)',
        base: 'rgba(253, 230, 138, 0.82)',
        trim: 'rgba(252, 211, 77, 0.88)'
      },
      CHERRY_BLOSSOM: {
        skyTop: 'rgba(252, 231, 243, 0.58)',
        skyBot: 'rgba(255, 241, 242, 0.46)',
        sunColor: 'rgba(254, 205, 211, 0.72)',
        hillBack: 'rgba(221, 214, 254, 0.42)',
        hillFront: 'rgba(251, 207, 232, 0.48)',
        base: 'rgba(251, 207, 232, 0.80)',
        trim: 'rgba(244, 114, 182, 0.68)'
      },
      SUNSET_MEADOW: {
        skyTop: 'rgba(254, 215, 170, 0.56)',
        skyBot: 'rgba(254, 249, 195, 0.46)',
        sunColor: 'rgba(253, 186, 116, 0.75)',
        hillBack: 'rgba(216, 180, 254, 0.35)',
        hillFront: 'rgba(190, 242, 100, 0.42)',
        base: 'rgba(253, 224, 71, 0.68)',
        trim: 'rgba(163, 230, 53, 0.78)'
      }
    };

    const theme = palettes[this.sceneTheme] ? this.sceneTheme : 'PARK';
    const pal = palettes[theme];

    // Soft pastel sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, floorY);
    skyGrad.addColorStop(0, pal.skyTop);
    skyGrad.addColorStop(1, pal.skyBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, floorY);

    ctx.save();
    // Gentle sun / pastel orb
    const sunX = theme === 'SUNSET_MEADOW' ? w * 0.78 : w * 0.84;
    const sunY = theme === 'SUNSET_MEADOW' ? floorY * 0.42 : h * 0.16;
    ctx.fillStyle = pal.sunColor;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 36, 0, Math.PI * 2);
    ctx.fill();

    // Gently drifting pastel clouds
    const t = this.elapsedTime || 0;
    const cloudDrift1 = ((t * 14) % (w + 180)) - 90;
    const cloudDrift2 = ((t * 9 + w * 0.45) % (w + 180)) - 90;
    this._drawSoftCloud(ctx, cloudDrift1, h * 0.17, 0.95);
    this._drawSoftCloud(ctx, cloudDrift2, h * 0.25, 0.78);

    // Distant & foreground hills (or sea strip for BEACH)
    if (theme === 'BEACH') {
      const seaY = floorY - 38;
      ctx.fillStyle = pal.hillBack;
      ctx.fillRect(0, seaY, w, 38);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.fillRect(0, floorY - 7, w, 4);

      // Pastel beach trees & striped umbrella
      this._drawPalmTree(ctx, w * 0.10, floorY, 1.0);
      this._drawPalmTree(ctx, w * 0.90, floorY, -0.9);
      this._drawBeachUmbrella(ctx, w * 0.24, floorY);
    } else {
      this._drawRollingHill(ctx, w, floorY, floorY * 0.24, 0.28, pal.hillBack);
      this._drawRollingHill(ctx, w, floorY, floorY * 0.18, 0.74, pal.hillFront);

      if (theme === 'PARK') {
        this._drawPastelTree(ctx, w * 0.11, floorY, '#86efac', '#4ade80', 1.0);
        this._drawPastelTree(ctx, w * 0.88, floorY, '#bbf7d0', '#86efac', 0.85);
        this._drawPastelFence(ctx, w * 0.17, floorY, 4);
      } else if (theme === 'CHERRY_BLOSSOM') {
        this._drawPastelTree(ctx, w * 0.12, floorY, '#fbcfe8', '#f9a8d4', 1.05);
        this._drawPastelTree(ctx, w * 0.87, floorY, '#fce7f3', '#fbcfe8', 0.92);
        // Gently falling pastel petals
        ctx.fillStyle = 'rgba(249, 168, 212, 0.65)';
        for (let i = 0; i < 10; i++) {
          const px = ((i * w * 0.11 + t * (18 + (i % 3) * 7) + Math.sin(t + i) * 18) % w);
          const py = ((i * 53 + t * (26 + (i % 4) * 6)) % Math.max(80, floorY - 20));
          ctx.beginPath();
          ctx.ellipse(px, py, 5, 2.8, t + i, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (theme === 'SUNSET_MEADOW') {
        this._drawWindmill(ctx, w * 0.14, floorY, t);
        this._drawPastelTree(ctx, w * 0.88, floorY, '#bef264', '#a3e635', 0.9);
        // Distant hot air balloon
        const bx = w * 0.66 + Math.sin(t * 0.4) * 18;
        const by = h * 0.28 + Math.cos(t * 0.6) * 8;
        ctx.fillStyle = 'rgba(251, 146, 60, 0.55)';
        ctx.beginPath();
        ctx.arc(bx, by, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(120, 53, 15, 0.45)';
        ctx.fillRect(bx - 4, by + 16, 8, 5);
      }
    }

    ctx.restore();
    return { base: pal.base, trim: pal.trim };
  }

  _drawPastelTree(ctx, x, floorY, canopyLight, canopyMid, scale = 1.0) {
    ctx.save();
    ctx.translate(x, floorY);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(180, 130, 95, 0.62)';
    ctx.fillRect(-7, -70, 14, 70);
    ctx.fillStyle = canopyMid;
    ctx.beginPath();
    ctx.arc(0, -82, 34, 0, Math.PI * 2);
    ctx.arc(-22, -66, 22, 0, Math.PI * 2);
    ctx.arc(22, -66, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = canopyLight;
    ctx.beginPath();
    ctx.arc(-6, -88, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawPastelFence(ctx, startX, floorY, posts = 4) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
    const gap = 20;
    ctx.fillRect(startX, floorY - 20, posts * gap, 4);
    ctx.fillRect(startX, floorY - 10, posts * gap, 4);
    for (let i = 0; i <= posts; i++) {
      ctx.fillRect(startX + i * gap, floorY - 28, 6, 28);
    }
  }

  _drawPalmTree(ctx, x, floorY, dir = 1) {
    ctx.save();
    ctx.translate(x, floorY);
    ctx.scale(dir, 1);
    ctx.strokeStyle = 'rgba(180, 130, 90, 0.58)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(18, -55, 34, -108);
    ctx.stroke();
    ctx.fillStyle = 'rgba(74, 222, 128, 0.62)';
    [-0.9, -0.3, 0.35, 0.95].forEach((ang) => {
      ctx.save();
      ctx.translate(34, -108);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.ellipse(22, 0, 26, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();
  }

  _drawBeachUmbrella(ctx, x, floorY) {
    ctx.save();
    ctx.translate(x, floorY);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -68);
    ctx.stroke();
    ctx.fillStyle = 'rgba(251, 113, 133, 0.62)';
    ctx.beginPath();
    ctx.arc(0, -64, 34, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawWindmill(ctx, x, floorY, time) {
    ctx.save();
    ctx.translate(x, floorY);
    ctx.fillStyle = 'rgba(248, 250, 252, 0.68)';
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(-12, -92);
    ctx.lineTo(12, -92);
    ctx.lineTo(22, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(248, 113, 113, 0.55)';
    ctx.beginPath();
    ctx.moveTo(-16, -92);
    ctx.lineTo(0, -114);
    ctx.lineTo(16, -92);
    ctx.closePath();
    ctx.fill();
    // Rotating blades
    ctx.save();
    ctx.translate(0, -84);
    ctx.rotate(time * 0.45);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.fillRect(-3, 0, 6, 42);
    }
    ctx.restore();
    ctx.restore();
  }

  _renderStormZones(ctx, floorY) {
    if (!this.stormState) return;
    const { phase, timer, safeX, safeHalfW } = this.stormState;
    const leftSafe = Math.max(0, safeX - safeHalfW);
    const rightSafe = Math.min(this.width, safeX + safeHalfW);

    ctx.save();
    ctx.lineJoin = 'round';
    if (phase === 'WARNING') {
      const blink = Math.floor(timer * 8) % 2 === 0;
      // Danger red columns everywhere except Safe Zone
      ctx.fillStyle = blink ? 'rgba(239, 68, 68, 0.24)' : 'rgba(239, 68, 68, 0.13)';
      ctx.fillRect(0, 0, leftSafe, floorY);
      ctx.fillRect(rightSafe, 0, Math.max(0, this.width - rightSafe), floorY);

      // Glowing Green Safe Sanctuary Pillar (borderless!)
      ctx.fillStyle = 'rgba(34, 197, 94, 0.28)';
      ctx.fillRect(leftSafe, 0, rightSafe - leftSafe, floorY);

      ctx.textAlign = 'center';
      ctx.font = '900 20px system-ui, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.strokeText('🛡️ SAFE ZONE', safeX, floorY - 22);
      ctx.fillStyle = '#dcfce7';
      ctx.fillText('🛡️ SAFE ZONE', safeX, floorY - 22);

      // Urgent Banner below Hearts (no HUD overlap)
      ctx.font = '900 26px system-ui, sans-serif';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
      const bannerText = `🚨 똥 폭격 경보! 초록 안전구역으로 대피! (${timer.toFixed(1)}s)`;
      ctx.strokeText(bannerText, this.width * 0.5, 122);
      ctx.fillStyle = blink ? '#facc15' : '#ef4444';
      ctx.fillText(bannerText, this.width * 0.5, 122);
    } else {
      const postAlpha = Math.min(1, timer / 0.8);
      ctx.globalAlpha = postAlpha;
      // Soft green sanctuary glow after barrage (borderless!)
      ctx.fillStyle = 'rgba(34, 197, 94, 0.22)';
      ctx.fillRect(leftSafe, 0, rightSafe - leftSafe, floorY);
      ctx.textAlign = 'center';
      ctx.font = '800 18px system-ui, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.strokeText(`🛡️ SAFE ZONE (${timer.toFixed(1)}s)`, safeX, floorY - 22);
      ctx.fillStyle = '#dcfce7';
      ctx.fillText(`🛡️ SAFE ZONE (${timer.toFixed(1)}s)`, safeX, floorY - 22);
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
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.82)';

    ctx.textAlign = 'left';
    let leftText = `🙂 머리 좌우 이동 · 캐릭터 #${this.selectedSpriteId}`;
    let leftColor = '#f8fafc';
    let leftFont = '800 13px system-ui, sans-serif';
    if (this.player.shieldTimer > 0) {
      leftText = `☂️ SHIELD: ${this.player.shieldTimer.toFixed(1)}s`;
      leftColor = '#38bdf8';
      leftFont = '900 15px system-ui, sans-serif';
    } else if (this.player.isOnIce) {
      leftText = '❄️ 빙판 위! 미끄러짐 주의!';
      leftColor = '#7dd3fc';
      leftFont = '900 14px system-ui, sans-serif';
    }
    ctx.font = leftFont;
    ctx.lineWidth = 3.5;
    ctx.strokeText(leftText, 24, h - 22);
    ctx.fillStyle = leftColor;
    ctx.fillText(leftText, 24, h - 22);

    ctx.textAlign = 'right';
    ctx.font = '900 16px system-ui, sans-serif';
    ctx.lineWidth = 4;
    const rightText = `LVL ${this.level} · DODGED ${this.dodgedCount}`;
    ctx.strokeText(rightText, w - 24, h - 24);
    ctx.fillStyle = '#fde047';
    ctx.fillText(rightText, w - 24, h - 24);

    ctx.restore();
  }
}
