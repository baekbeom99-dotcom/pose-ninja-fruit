/**
 * Mouth Catch Mode Core Engine ("😋 냠냠! 입 벌려 받아먹기")
 *
 * Dual Sub-Modes:
 *   - TOSS: Arcing upward launches from bottom (classic arcade toss trajectories)
 *   - RAIN: Pouring items descending from the sky like rain
 *
 * Face & Mouth Tracking:
 *   - Driven by MediaPipe FaceLandmarker (mouthX/Y, jawOpen, face bounds) with mouse/Space fallback
 *   - Open mouth catches items: Food (+pts), Yellow Mushroom (+50), Green Mushroom (+1❤️), Red Mushroom (-1❤️), Non-Food (-1❤️)
 */

import { soundManager } from '../../audio/soundManager.js';

export const MouthSubMode = {
  TOSS: 'TOSS',
  RAIN: 'RAIN'
};

export const MouthItemKind = {
  // Tasty foods
  BURGER: { id: 'BURGER', emoji: '🍔', category: 'FOOD', points: 15, fxColor: '#f59e0b', radius: 32 },
  PIZZA: { id: 'PIZZA', emoji: '🍕', category: 'FOOD', points: 15, fxColor: '#ef4444', radius: 32 },
  CAKE: { id: 'CAKE', emoji: '🍰', category: 'FOOD', points: 20, fxColor: '#fbcfe8', radius: 32 },
  SUSHI: { id: 'SUSHI', emoji: '🍣', category: 'FOOD', points: 15, fxColor: '#fb7185', radius: 30 },
  DONUT: { id: 'DONUT', emoji: '🍩', category: 'FOOD', points: 12, fxColor: '#92400e', radius: 30 },
  CHICKEN: { id: 'CHICKEN', emoji: '🍗', category: 'FOOD', points: 15, fxColor: '#ea580c', radius: 32 },

  // Color-coded mushrooms (drawn crisply with distinct caps!)
  MUSHROOM_RED: { id: 'MUSHROOM_RED', category: 'MUSHROOM_RED', color: '#ef4444', fxColor: '#dc2626', points: 0, radius: 34 },
  MUSHROOM_YELLOW: { id: 'MUSHROOM_YELLOW', category: 'MUSHROOM_YELLOW', color: '#facc15', fxColor: '#eab308', points: 50, radius: 34 },
  MUSHROOM_GREEN: { id: 'MUSHROOM_GREEN', category: 'MUSHROOM_GREEN', color: '#22c55e', fxColor: '#16a34a', points: 15, radius: 34 },

  // Non-food hazards (shut mouth!)
  SHOE: { id: 'SHOE', emoji: '🥾', category: 'TRASH', points: 0, fxColor: '#78350f', radius: 32 },
  BOMB: { id: 'BOMB', emoji: '💣', category: 'TRASH', points: 0, fxColor: '#334155', radius: 32 },
  FISHBONE: { id: 'FISHBONE', emoji: '🦴', category: 'TRASH', points: 0, fxColor: '#94a3b8', radius: 30 },
  BUG: { id: 'BUG', emoji: '🪲', category: 'TRASH', points: 0, fxColor: '#3f6212', radius: 29 }
};

const FOOD_KEYS = ['BURGER', 'PIZZA', 'CAKE', 'SUSHI', 'DONUT', 'CHICKEN'];
const TRASH_KEYS = ['SHOE', 'BOMB', 'FISHBONE', 'BUG'];

export class MouthEngine {
  constructor(width = 1280, height = 720, ui = null, sound = null) {
    this.width = width;
    this.height = height;
    this.ui = ui;
    this.sound = sound || soundManager;

    this.state = 'IDLE'; // 'IDLE', 'PLAYING', 'GAMEOVER'
    this.subMode = MouthSubMode.TOSS; // 'TOSS' | 'RAIN'

    this.score = 0;
    this.eatenCount = 0;
    this.lives = 5;
    this.maxLives = 5;
    this.elapsedTime = 0;
    this.spawnTimer = 0.5;

    // Live face/mouth state in screen pixels
    this.face = {
      x: width * 0.5,
      y: height * 0.45,
      rx: 95,
      ry: 122,
      mouthX: width * 0.5,
      mouthY: height * 0.50,
      jawOpen: 0,
      isOpen: false,
      eatRadius: 40,
      hasCameraFace: false
    };

    // Fallback mouse/Space input
    this.pointerPos = null;
    this.manualOpen = false;

    this.items = [];
    this.particles = [];
    this.floatingTexts = [];
    this.shakeTimer = 0;
    this.chompFlashTimer = 0;

    this.onScore = () => {};
    this.onLivesChanged = () => {};
    this.onGameOver = () => {};
  }

  setSubMode(mode) {
    this.subMode = mode === MouthSubMode.RAIN ? MouthSubMode.RAIN : MouthSubMode.TOSS;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  setPointerFallback(x, y, isOpen = null) {
    if (x != null && y != null) {
      this.pointerPos = {
        x: Math.max(40, Math.min(this.width - 40, x)),
        y: Math.max(60, Math.min(this.height - 60, y))
      };
    }
    if (isOpen !== null) {
      this.manualOpen = !!isOpen;
    }
  }

  reset() {
    this.score = 0;
    this.eatenCount = 0;
    this.lives = this.maxLives;
    this.elapsedTime = 0;
    this.spawnTimer = 0.45;
    this.items = [];
    this.particles = [];
    this.floatingTexts = [];
    this.shakeTimer = 0;
    this.chompFlashTimer = 0;

    this.face.x = this.width * 0.5;
    this.face.y = this.height * 0.46;
    this.face.mouthX = this.width * 0.5;
    this.face.mouthY = this.height * 0.52;
    this.face.jawOpen = 0;
    this.face.isOpen = false;

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

  _updateFaceState(faceData, fallbackHeadPose, dt) {
    const f = this.face;
    const lerp = Math.min(1, dt * 20);

    if (faceData && faceData.detected) {
      f.hasCameraFace = true;
      const targetFx = faceData.faceX * this.width;
      const targetFy = faceData.faceY * this.height;
      const targetMx = faceData.mouthX * this.width;
      const targetMy = faceData.mouthY * this.height;

      f.x += (targetFx - f.x) * lerp;
      f.y += (targetFy - f.y) * lerp;
      f.mouthX += (targetMx - f.mouthX) * lerp;
      f.mouthY += (targetMy - f.mouthY) * lerp;
      f.rx = Math.max(72, faceData.faceW * this.width * 0.52);
      f.ry = Math.max(92, faceData.faceH * this.height * 0.54);
      f.jawOpen = this.manualOpen ? Math.max(faceData.jawOpen, 0.85) : faceData.jawOpen;
    } else if (fallbackHeadPose && typeof fallbackHeadPose.x === 'number') {
      f.hasCameraFace = false;
      const targetX = (1.0 - fallbackHeadPose.x) * this.width;
      const targetY = Math.max(120, Math.min(this.height - 100, fallbackHeadPose.y * this.height));
      f.x += (targetX - f.x) * lerp;
      f.y += (targetY - f.y) * lerp;
      f.mouthX = f.x;
      f.mouthY = f.y + 28;
      f.jawOpen = this.manualOpen ? 0.85 : 0.0;
    } else if (this.pointerPos) {
      f.hasCameraFace = false;
      f.x += (this.pointerPos.x - f.x) * lerp;
      f.y += (this.pointerPos.y - 24 - f.y) * lerp;
      f.mouthX = f.x;
      f.mouthY = f.y + 24;
      f.jawOpen = this.manualOpen ? 0.85 : 0.0;
    } else {
      f.hasCameraFace = false;
      f.jawOpen = this.manualOpen ? 0.85 : 0.0;
    }

    f.isOpen = f.jawOpen >= 0.28;
    f.eatRadius = 38 + f.jawOpen * 32;
  }

  _pickRandomSpec() {
    const roll = Math.random();
    if (roll < 0.56) {
      const k = FOOD_KEYS[Math.floor(Math.random() * FOOD_KEYS.length)];
      return MouthItemKind[k];
    }
    if (roll < 0.78) {
      const k = TRASH_KEYS[Math.floor(Math.random() * TRASH_KEYS.length)];
      return MouthItemKind[k];
    }
    // 22% chance: Color-coded Mushrooms (Red=hurt, Yellow=points, Green=+1 life)
    const mRoll = Math.random();
    if (mRoll < 0.36) return MouthItemKind.MUSHROOM_RED;
    if (mRoll < 0.76) return MouthItemKind.MUSHROOM_YELLOW;
    return MouthItemKind.MUSHROOM_GREEN;
  }

  spawnItem(specOverride = null, forcedX = null, forcedY = null) {
    const spec = specOverride || this._pickRandomSpec();
    const margin = 90;
    const x =
      forcedX != null
        ? forcedX
        : margin + Math.random() * Math.max(80, this.width - margin * 2);

    const speedLevelBoost = 1 + Math.min(0.6, this.elapsedTime / 90);
    let y, vx, vy, gravity;

    if (this.subMode === MouthSubMode.TOSS) {
      y = forcedY != null ? forcedY : this.height + 36;
      const targetCenter = this.width * 0.5;
      vx = ((targetCenter - x) * (0.28 + Math.random() * 0.36)) + (Math.random() - 0.5) * 140;
      const apexHeight = this.height * (0.58 + Math.random() * 0.24);
      gravity = 540;
      vy = -Math.sqrt(2 * gravity * apexHeight);
    } else {
      // RAIN mode: pours downward from top sky
      y = forcedY != null ? forcedY : -32;
      vx = (Math.random() - 0.5) * 65;
      vy = (205 + Math.random() * 115) * speedLevelBoost;
      gravity = 22;
    }

    const item = {
      spec,
      x,
      y,
      vx,
      vy,
      gravity,
      radius: spec.radius,
      rotation: (Math.random() - 0.5) * 0.4,
      rotSpeed: (Math.random() - 0.5) * 2.8,
      isDead: false
    };
    this.items.push(item);
    return item;
  }

  _handleEatItem(item) {
    const cat = item.spec.category;
    this.chompFlashTimer = 0.22;

    if (cat === 'FOOD') {
      this.eatenCount++;
      this._addScore(item.spec.points);
      this._spawnBurst(this.face.mouthX, this.face.mouthY, item.spec.fxColor, 12, 180);
      this._spawnFloatingText(`😋 냠냠 +${item.spec.points}`, item.x, item.y - 24, '#4ade80', 1.2);
      if (this.sound && typeof this.sound.playMouthChomp === 'function') {
        this.sound.playMouthChomp();
      }
    } else if (cat === 'MUSHROOM_YELLOW') {
      this.eatenCount++;
      this._addScore(item.spec.points);
      this._spawnBurst(this.face.mouthX, this.face.mouthY, '#facc15', 18, 220);
      this._spawnFloatingText(`🌟 노란버섯 +${item.spec.points}!`, item.x, item.y - 28, '#fde047', 1.35);
      if (this.sound && typeof this.sound.playMouthGolden === 'function') {
        this.sound.playMouthGolden();
      }
    } else if (cat === 'MUSHROOM_GREEN') {
      this.eatenCount++;
      this._addScore(item.spec.points);
      if (this.lives < this.maxLives) {
        this.lives++;
        this.onLivesChanged(this.lives);
        if (this.ui) {
          this.ui.updateLives(this.lives, this.maxLives);
          if (typeof this.ui.showHeal === 'function') this.ui.showHeal();
        }
      }
      this._spawnBurst(this.face.mouthX, this.face.mouthY, '#22c55e', 16, 200);
      this._spawnFloatingText('🍄 초록버섯 +1❤️!', item.x, item.y - 28, '#4ade80', 1.3);
      if (this.sound && typeof this.sound.playMouthHeal === 'function') {
        this.sound.playMouthHeal();
      }
    } else {
      // Non-food TRASH or MUSHROOM_RED -> eating deducts 1 life!
      this.lives = Math.max(0, this.lives - 1);
      this.onLivesChanged(this.lives);
      this.shakeTimer = 0.35;
      if (this.ui) {
        this.ui.updateLives(this.lives, this.maxLives);
      }
      const msg =
        cat === 'MUSHROOM_RED' ? '🍄 독버섯! -1❤️' : '🤢 음식이 아니야! -1❤️';
      this._spawnBurst(this.face.mouthX, this.face.mouthY, '#ef4444', 16, 210);
      this._spawnFloatingText(msg, item.x, item.y - 28, '#ef4444', 1.3);
      if (this.sound && typeof this.sound.playMouthBad === 'function') {
        this.sound.playMouthBad();
      }
      if (this.lives <= 0) {
        this.state = 'GAMEOVER';
        this.onGameOver();
      }
    }
  }

  _addScore(pts) {
    if (pts <= 0) return;
    this.score += pts;
    this.onScore(this.score);
    if (this.ui) {
      this.ui.updateScores(this.score, 0, false);
    }
  }

  _spawnBurst(x, y, color, count = 10, speed = 170) {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const spd = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 40,
        radius: 3 + Math.random() * 4,
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
      life: 0.95,
      maxLife: 0.95
    });
  }

  _updateEffects(dt) {
    if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    if (this.chompFlashTimer > 0) this.chompFlashTimer = Math.max(0, this.chompFlashTimer - dt);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 42 * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  update(dt, currentTime, faceData = null, fallbackHeadPose = null) {
    const safeDt = Math.min(Math.max(dt || 0, 0), 0.1);
    this._updateEffects(safeDt);

    if (this.state !== 'PLAYING') return;

    this.elapsedTime += safeDt;
    this._updateFaceState(faceData, fallbackHeadPose, safeDt);

    // Spawner
    this.spawnTimer -= safeDt;
    if (this.spawnTimer <= 0) {
      this.spawnItem();
      const baseInt = Math.max(0.42, 1.05 - Math.min(0.5, this.elapsedTime * 0.008));
      this.spawnTimer = baseInt * (0.75 + Math.random() * 0.45);
    }

    const f = this.face;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.vy += item.gravity * safeDt;
      item.x += item.vx * safeDt;
      item.y += item.vy * safeDt;
      item.rotation += item.rotSpeed * safeDt;

      // Keep toss/rain within horizontal playbounds cleanly
      if (item.x < item.radius && item.vx < 0) {
        item.x = item.radius;
        item.vx *= -0.8;
      } else if (item.x > this.width - item.radius && item.vx > 0) {
        item.x = this.width - item.radius;
        item.vx *= -0.8;
      }

      // Check open mouth catch!
      const distMouth = Math.hypot(item.x - f.mouthX, item.y - f.mouthY);
      if (f.isOpen && distMouth <= f.eatRadius + item.radius) {
        item.isDead = true;
        this._handleEatItem(item);
        if (this.state !== 'PLAYING') return;
      }

      // Cull offscreen
      if (item.y - item.radius > this.height + 60 && item.vy > 0) {
        item.isDead = true;
      }

      if (item.isDead) {
        this.items.splice(i, 1);
      }
    }
  }

  render(ctx) {
    if (!ctx) return;
    const w = this.width;
    const h = this.height;

    ctx.save();
    if (this.shakeTimer > 0) {
      const mag = (this.shakeTimer / 0.35) * 12;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    // 1. Subtle perimeter vignette keeping full real webcam center crystal clear!
    const f = this.face;
    ctx.save();
    ctx.strokeStyle = f.isOpen ? '#4ade80' : 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = f.isOpen ? 4 : 2;
    ctx.setLineDash(f.isOpen ? [] : [6, 6]);
    ctx.beginPath();
    ctx.arc(f.mouthX, f.mouthY, f.eatRadius, 0, Math.PI * 2);
    ctx.stroke();

    if (f.isOpen) {
      ctx.fillStyle = 'rgba(74, 222, 128, 0.22)';
      ctx.fill();
    }
    ctx.restore();

    // 2. Render flying/falling Foods, Mushrooms & Non-Food Items
    for (const item of this.items) {
      this._renderItem(ctx, item);
    }

    // 4. Particles & Floating Popups
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
      ctx.font = `900 ${Math.round(21 * ft.scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 5. Bottom HUD
    this._renderHUD(ctx, w, h);

    ctx.restore();
  }

  _renderItem(ctx, item) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotation);

    const cat = item.spec.category;
    if (cat.startsWith('MUSHROOM')) {
      this._drawMushroomSprite(ctx, item.spec.color, item.radius);
    } else {
      ctx.font = `${Math.round(item.radius * 1.65)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.spec.emoji, 0, 2);
    }
    ctx.restore();
  }

  _drawMushroomSprite(ctx, capColor, radius) {
    const s = radius / 30;
    // Cream stem
    ctx.fillStyle = '#fef3c7';
    ctx.strokeStyle = '#44403c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-9 * s, 2 * s, 18 * s, 20 * s, 6 * s);
    ctx.fill();
    ctx.stroke();

    // Colored dome cap (Red / Yellow / Green)
    ctx.fillStyle = capColor;
    ctx.beginPath();
    ctx.arc(0, 4 * s, 24 * s, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Crisp spots on mushroom cap
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-10 * s, -6 * s, 4.2 * s, 0, Math.PI * 2);
    ctx.arc(9 * s, -7 * s, 3.8 * s, 0, Math.PI * 2);
    ctx.arc(0, -13 * s, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  _renderHUD(ctx, w, h) {
    const f = this.face;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.88)';

    // Mouth Open Meter Bottom Left
    const barW = 190;
    const barX = 24;
    const barY = h - 40;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, 16, 8);
    ctx.fill();
    ctx.fillStyle = f.isOpen ? '#4ade80' : '#94a3b8';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * Math.max(0.05, Math.min(1, f.jawOpen)), 16, 8);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.lineWidth = 3.5;
    const modeTag = this.subMode === MouthSubMode.RAIN ? '🌧️ 하늘비' : '🚀 튀어오르기';
    const leftTxt = `${f.isOpen ? '😮 아~ 먹는 중!' : '😐 입 다물기'} · ${modeTag} (Space/클릭)`;
    ctx.strokeText(leftTxt, barX, barY - 8);
    ctx.fillStyle = f.isOpen ? '#86efac' : '#f8fafc';
    ctx.fillText(leftTxt, barX, barY - 8);

    ctx.textAlign = 'right';
    ctx.font = '900 17px system-ui, sans-serif';
    ctx.lineWidth = 4;
    const rightTxt = `😋 EATEN ${this.eatenCount}`;
    ctx.strokeText(rightTxt, w - 24, h - 22);
    ctx.fillStyle = '#fde047';
    ctx.fillText(rightTxt, w - 24, h - 22);

    if (this.state === 'PLAYING' && this.elapsedTime < 4.0) {
      ctx.textAlign = 'center';
      ctx.font = '900 20px system-ui, sans-serif';
      ctx.lineWidth = 4;
      const tip = '😮 입을 벌려 음식·노랑/초록버섯만 받아먹고, 💣·🔴독버섯은 피하세요!';
      ctx.strokeText(tip, w * 0.5, h - 104);
      ctx.fillStyle = '#fde047';
      ctx.fillText(tip, w * 0.5, h - 104);
    }

    ctx.restore();
  }
}
