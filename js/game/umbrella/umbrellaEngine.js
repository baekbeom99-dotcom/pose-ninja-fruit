/**
 * Umbrella Mode Core Engine ("☔ 우산 씌워주기")
 *
 * Features:
 *   - Warm storybook/pencil-sketch rainy after-school atmosphere
 *   - Right side: School porch sheltering a queue of small kids; Left side: Warm glowing Home
 *   - Continuous heavy shower ("소낙비") modeled strictly as a spatial rain REGION (not individual droplet objects)
 *   - Only the area directly UNDER a player's hand palm/umbrella is dry & safe
 *   - Each kid walks left toward Home at a distinct, irregular speed; getting caught in rain sends them crying back to school
 *   - Rescuing one kid seamlessly brings out the next waiting kid at school
 */

import { soundManager } from '../../audio/soundManager.js';

export const KID_PROFILES = [
  {
    id: 'TINY',
    label: '꼬마',
    coatColor: '#facc15',
    hatColor: '#f59e0b',
    baseSpeed: 76,
    freq: 1.8,
    amp: 0.45,
    pauseChance: 0.28
  },
  {
    id: 'DREAMER',
    label: '느긋이',
    coatColor: '#86efac',
    hatColor: '#22c55e',
    baseSpeed: 88,
    freq: 1.2,
    amp: 0.58,
    pauseChance: 0.18
  },
  {
    id: 'BOUNCY',
    label: '폴짝이',
    coatColor: '#fda4af',
    hatColor: '#f43f5e',
    baseSpeed: 102,
    freq: 3.1,
    amp: 0.48,
    pauseChance: 0.12
  },
  {
    id: 'SPRINTER',
    label: '달리기왕',
    coatColor: '#93c5fd',
    hatColor: '#3b82f6',
    baseSpeed: 126,
    freq: 2.3,
    amp: 0.42,
    pauseChance: 0.15
  }
];

export const KidState = {
  WAITING_AT_SCHOOL: 'WAITING_AT_SCHOOL',
  WALKING_HOME: 'WALKING_HOME',
  RETURNING_CRYING: 'RETURNING_CRYING'
};

export class UmbrellaEngine {
  constructor(width = 1280, height = 720, ui = null, sound = null) {
    this.width = width;
    this.height = height;
    this.ui = ui;
    this.sound = sound || soundManager;

    this.state = 'IDLE'; // 'IDLE', 'PLAYING', 'GAMEOVER'
    this.score = 0;
    this.rescuedCount = 0;
    this.lives = 5;
    this.maxLives = 5;
    this.elapsedTime = 0;

    // Hands acting as dry umbrellas: [{ x, y, halfWidth, label }]
    this.hands = [];
    this.pointerHand = null;
    this.shelterHalfWidth = 86;

    // Shower sheet visual streaks (cosmetic curtain lines matching the active rain region)
    this.showerLines = [];
    this._initShowerLines();

    this.kidQueue = [];
    this.activeChild = null;

    this.particles = [];
    this.floatingTexts = [];
    this.homeGlowTimer = 0;
    this.wasSheltering = false;

    this.onScore = () => {};
    this.onLivesChanged = () => {};
    this.onGameOver = () => {};

    this.reset();
  }

  _initShowerLines() {
    this.showerLines = [];
    for (let i = 0; i < 110; i++) {
      this.showerLines.push({
        rx: Math.random(),
        yOffset: Math.random(),
        len: 42 + Math.random() * 54,
        speed: 780 + Math.random() * 340,
        alpha: 0.28 + Math.random() * 0.34,
        width: 1.2 + Math.random() * 1.4
      });
    }
  }

  getLayout() {
    const w = this.width;
    const h = this.height;
    const floorY = Math.max(220, h - 76);
    const homePorchRightX = Math.min(200, w * 0.16);
    const schoolPorchLeftX = Math.max(w - 220, w * 0.82);
    return { w, h, floorY, homePorchRightX, schoolPorchLeftX };
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    if (this.activeChild) {
      const { floorY } = this.getLayout();
      this.activeChild.y = floorY;
    }
  }

  _createChild(profileOverride = null) {
    const profile =
      profileOverride || KID_PROFILES[Math.floor(Math.random() * KID_PROFILES.length)];
    const { floorY, schoolPorchLeftX } = this.getLayout();
    const speedScale = 1 + Math.min(0.45, this.rescuedCount * 0.045);

    return {
      profile,
      x: schoolPorchLeftX + 26,
      y: floorY,
      headHeight: 54,
      state: KidState.WAITING_AT_SCHOOL,
      speed: profile.baseSpeed * speedScale,
      walkPhase: Math.random() * Math.PI * 2,
      pacePhase: Math.random() * Math.PI * 2,
      pauseTimer: 0,
      wetness: 0,
      tearsPhase: 0
    };
  }

  reset() {
    this.score = 0;
    this.rescuedCount = 0;
    this.lives = this.maxLives;
    this.elapsedTime = 0;
    this.hands = [];
    this.pointerHand = null;
    this.particles = [];
    this.floatingTexts = [];
    this.homeGlowTimer = 0;
    this.wasSheltering = false;

    this.kidQueue = [
      this._createChild(),
      this._createChild(),
      this._createChild()
    ];
    this._promoteNextChild();

    if (this.ui) {
      this.ui.updateScores(0, 0, false);
      this.ui.updateLives(this.lives, this.maxLives);
    }
  }

  _promoteNextChild() {
    if (this.kidQueue.length === 0) {
      this.kidQueue.push(this._createChild());
    }
    this.activeChild = this.kidQueue.shift();
    const { schoolPorchLeftX, floorY } = this.getLayout();
    this.activeChild.x = schoolPorchLeftX + 24;
    this.activeChild.y = floorY;
    this.activeChild.state = KidState.WAITING_AT_SCHOOL;
    this.activeChild.wetness = 0;
    this.kidQueue.push(this._createChild());
  }

  start() {
    this.reset();
    this.state = 'PLAYING';
  }

  stop() {
    this.state = 'IDLE';
  }

  setPointerFallback(x, y, active = true) {
    if (!active) {
      this.pointerHand = null;
      return;
    }
    this.pointerHand = {
      x: Math.max(20, Math.min(this.width - 20, x)),
      y: Math.max(40, Math.min(this.height - 60, y)),
      halfWidth: this.shelterHalfWidth,
      label: 'HAND'
    };
  }

  _extractHands(poses) {
    const hands = [];
    const { w, h } = this.getLayout();

    if (Array.isArray(poses) && poses.length > 0 && Array.isArray(poses[0])) {
      const lm = poses[0];
      const candidates = [
        { wrist: 15, tip: 19, label: 'L' },
        { wrist: 16, tip: 20, label: 'R' }
      ];
      for (const c of candidates) {
        const pw = lm[c.wrist];
        const pt = lm[c.tip];
        const point =
          pt && (pt.visibility == null || pt.visibility > 0.35)
            ? pt
            : pw && (pw.visibility == null || pw.visibility > 0.35)
              ? pw
              : null;
        if (point) {
          // Mirror X for natural webcam interaction
          hands.push({
            x: (1.0 - point.x) * w,
            y: point.y * h,
            halfWidth: this.shelterHalfWidth,
            label: c.label
          });
        }
      }
    }

    if (hands.length === 0 && this.pointerHand) {
      hands.push({ ...this.pointerHand });
    }
    return hands;
  }

  /**
   * Determines whether position (px, py) sits safely UNDER one of the active hands.
   * Only the rectangular column directly below a hand palm (within halfWidth and py >= hand.y) is dry!
   */
  isPointShelteredByHand(px, py) {
    for (let i = 0; i < this.hands.length; i++) {
      const hand = this.hands[i];
      if (Math.abs(px - hand.x) <= hand.halfWidth && py >= hand.y - 6) {
        return true;
      }
    }
    return false;
  }

  /**
   * Spatial region-based rain check (not object-based!).
   * Returns true when (px, py) lies in the outdoor shower zone AND is not sheltered beneath a hand.
   */
  isPointInRain(px, py) {
    const { homePorchRightX, schoolPorchLeftX } = this.getLayout();
    if (px <= homePorchRightX || px >= schoolPorchLeftX) {
      return false; // Covered by Home porch or School roof awning
    }
    return !this.isPointShelteredByHand(px, py);
  }

  _addScore(pts) {
    this.score += pts;
    this.onScore(this.score);
    if (this.ui) {
      this.ui.updateScores(this.score, 0, false);
    }
  }

  _spawnBurst(x, y, color, count = 12, speed = 160) {
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
        life: 0.5 + Math.random() * 0.25,
        maxLife: 0.75
      });
    }
  }

  _spawnFloatingText(text, x, y, color = '#f59e0b', scale = 1.0) {
    this.floatingTexts.push({
      text,
      x,
      y,
      color,
      scale,
      life: 1.0,
      maxLife: 1.0
    });
  }

  _updateEffects(dt) {
    if (this.homeGlowTimer > 0) {
      this.homeGlowTimer = Math.max(0, this.homeGlowTimer - dt);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 36 * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  update(dt, currentTime, poses = null) {
    const safeDt = Math.min(Math.max(dt || 0, 0), 0.1);
    this.elapsedTime += safeDt;
    this._updateEffects(safeDt);

    if (this.state !== 'PLAYING') return;

    this.hands = this._extractHands(poses);

    const child = this.activeChild;
    if (!child) return;

    const { floorY, homePorchRightX, schoolPorchLeftX } = this.getLayout();
    child.y = floorY;
    const childHeadY = child.y - child.headHeight;
    const shelteredNow = this.isPointShelteredByHand(child.x, childHeadY);

    if (child.state === KidState.WAITING_AT_SCHOOL) {
      // Child steps out into the rain corridor once player holds a hand shelter over them!
      if (shelteredNow || this.isPointShelteredByHand(schoolPorchLeftX - 18, childHeadY)) {
        child.state = KidState.WALKING_HOME;
        this.wasSheltering = true;
        this._spawnFloatingText(`☔ ${child.profile.label} 출발!`, child.x - 10, childHeadY - 24, '#fef08a', 1.05);
        if (this.sound && typeof this.sound.playUmbrellaShelter === 'function') {
          this.sound.playUmbrellaShelter();
        }
      }
    } else if (child.state === KidState.WALKING_HOME) {
      // Irregular per-kid walking speed modulation
      child.pacePhase += safeDt * child.profile.freq;
      if (child.pauseTimer > 0) {
        child.pauseTimer = Math.max(0, child.pauseTimer - safeDt);
      } else {
        // Occasional short unpredictable hesitation or skip
        if (Math.random() < child.profile.pauseChance * safeDt * 0.6) {
          child.pauseTimer = 0.25 + Math.random() * 0.35;
        }
      }

      const mod = child.pauseTimer > 0 ? 0.22 : 1.0 + Math.sin(child.pacePhase) * child.profile.amp;
      const curSpeed = Math.max(20, child.speed * mod);

      child.x -= curSpeed * safeDt;
      child.walkPhase += safeDt * (curSpeed * 0.14);

      if (this.isPointInRain(child.x, childHeadY)) {
        // Exposed outside hand shelter -> gets soaked fast and runs crying back to school!
        child.wetness += safeDt / 0.20;
        if (child.wetness >= 1.0) {
          child.state = KidState.RETURNING_CRYING;
          child.wetness = 1.0;
          this.lives = Math.max(0, this.lives - 1);
          this.onLivesChanged(this.lives);
          if (this.ui) {
            this.ui.updateLives(this.lives, this.maxLives);
          }
          this._spawnBurst(child.x, childHeadY, '#60a5fa', 14, 150);
          this._spawnFloatingText('😭 으앙! 비 맞았어!', child.x, childHeadY - 28, '#93c5fd', 1.2);
          if (this.sound && typeof this.sound.playUmbrellaCry === 'function') {
            this.sound.playUmbrellaCry();
          }
          if (this.lives <= 0) {
            this.state = 'GAMEOVER';
            this.onGameOver();
            return;
          }
        }
      } else {
        child.wetness = Math.max(0, child.wetness - safeDt * 3.0);
        if (!this.wasSheltering && shelteredNow) {
          if (this.sound && typeof this.sound.playUmbrellaShelter === 'function') {
            this.sound.playUmbrellaShelter();
          }
        }
      }
      this.wasSheltering = shelteredNow;

      // Arrived safely at Left Home Porch!
      if (child.x <= homePorchRightX) {
        this.rescuedCount++;
        const pts = 100 + Math.round(child.profile.baseSpeed * 0.25);
        this._addScore(pts);
        this.homeGlowTimer = 1.0;
        this._spawnBurst(homePorchRightX - 24, childHeadY, '#fbbf24', 18, 190);
        this._spawnFloatingText(`🏠 무사 귀가! +${pts}`, homePorchRightX + 40, childHeadY - 34, '#fde047', 1.25);
        if (this.sound && typeof this.sound.playUmbrellaHome === 'function') {
          this.sound.playUmbrellaHome();
        }
        this._promoteNextChild();
      }
    } else if (child.state === KidState.RETURNING_CRYING) {
      child.tearsPhase += safeDt * 12;
      child.x += 220 * safeDt;
      child.walkPhase += safeDt * 20;
      if (child.x >= schoolPorchLeftX + 24) {
        child.x = schoolPorchLeftX + 24;
        child.state = KidState.WAITING_AT_SCHOOL;
        child.wetness = 0;
      }
    }
  }

  render(ctx) {
    if (!ctx) return;
    const layout = this.getLayout();
    const { w, h, floorY } = layout;

    ctx.save();

    // 1. Warm Sketchbook Rainy Afternoon Wash (keeps webcam subtly visible underneath)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, floorY);
    skyGrad.addColorStop(0, 'rgba(203, 213, 225, 0.52)');
    skyGrad.addColorStop(0.55, 'rgba(254, 243, 199, 0.44)');
    skyGrad.addColorStop(1, 'rgba(253, 230, 138, 0.48)');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, floorY);

    // Paper sketchbook cozy street & lamp pools
    this._renderSketchBackdrop(ctx, layout);

    // 2. Dry Safe Zones under Hand Palms (visual highlight BEFORE rain curtain)
    this._renderHandShelters(ctx, layout);

    // 3. Continuous Shower Field ("소낙비" — stops cleanly at hand palm roofs!)
    this._renderShowerField(ctx, layout);

    // 4. Left Home + Right School Awning + Waiting Children Queue
    this._renderHomeAndSchool(ctx, layout);

    // 5. Active Child + Hand Umbrella Sketch Icons
    if (this.activeChild) {
      this._renderChild(ctx, this.activeChild);
    }
    this._renderHandsVisual(ctx);

    // 6. Particles & Popups
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
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(41, 37, 36, 0.85)';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 7. Bottom HUD
    this._renderHUD(ctx, w, h);

    ctx.restore();
  }

  _renderSketchBackdrop(ctx, { w, h, floorY }) {
    ctx.save();
    // Warm amber streetlamp pools along the sidewalk
    [w * 0.34, w * 0.56, w * 0.74].forEach((lx) => {
      // Sketchy lamppost
      ctx.strokeStyle = 'rgba(87, 83, 78, 0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(lx, floorY);
      ctx.lineTo(lx, floorY - 190);
      ctx.lineTo(lx - 18, floorY - 190);
      ctx.stroke();

      // Warm cozy glow pool
      const lampGrad = ctx.createRadialGradient(lx - 18, floorY - 186, 4, lx - 18, floorY - 140, 120);
      lampGrad.addColorStop(0, 'rgba(253, 224, 71, 0.42)');
      lampGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
      ctx.fillStyle = lampGrad;
      ctx.beginPath();
      ctx.arc(lx - 18, floorY - 150, 120, 0, Math.PI * 2);
      ctx.fill();
    });

    // Warm sketched sidewalk ground
    ctx.fillStyle = 'rgba(231, 216, 193, 0.84)';
    ctx.fillRect(0, floorY, w, h - floorY);

    // Double pencil sketch ground line
    ctx.strokeStyle = '#57534e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(w, floorY);
    ctx.moveTo(0, floorY + 4);
    ctx.lineTo(w, floorY + 3.5);
    ctx.stroke();

    // Wet puddles rippling on sidewalk
    const t = this.elapsedTime;
    [w * 0.29, w * 0.48, w * 0.67].forEach((px, idx) => {
      const rPulse = 1 + ((t * 1.4 + idx * 0.33) % 1) * 0.5;
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(px, floorY + 18, 28 * rPulse, 5 * rPulse, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }

  _renderHandShelters(ctx, { floorY }) {
    ctx.save();
    for (const hand of this.hands) {
      const leftX = hand.x - hand.halfWidth;
      const rightX = hand.x + hand.halfWidth;
      const dryGrad = ctx.createLinearGradient(0, hand.y, 0, floorY);
      dryGrad.addColorStop(0, 'rgba(254, 240, 138, 0.34)');
      dryGrad.addColorStop(1, 'rgba(254, 249, 195, 0.14)');
      ctx.fillStyle = dryGrad;
      ctx.fillRect(leftX, hand.y, rightX - leftX, Math.max(0, floorY - hand.y));

      // Sketchy dashed shelter column edges
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(leftX, hand.y);
      ctx.lineTo(leftX, floorY);
      ctx.moveTo(rightX, hand.y);
      ctx.lineTo(rightX, floorY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  _renderShowerField(ctx, { floorY, homePorchRightX, schoolPorchLeftX }) {
    const t = this.elapsedTime;
    const outdoorW = Math.max(40, schoolPorchLeftX - homePorchRightX);

    ctx.save();
    // Continuous semi-transparent shower curtain tint over outdoor zone
    ctx.fillStyle = 'rgba(148, 163, 184, 0.10)';
    ctx.fillRect(homePorchRightX, 0, outdoorW, floorY);

    // Dense diagonal 소낙비 shower streaks — clipped vertically if hitting a hand palm!
    const slantX = -10;
    for (const ln of this.showerLines) {
      const xTop = homePorchRightX + ln.rx * outdoorW;
      const yTop = ((ln.yOffset + t * (ln.speed / floorY)) % 1.15 - 0.15) * floorY;
      let yBot = yTop + ln.len;

      // Stop streak cleanly when it hits top of any player hand palm!
      for (let hIdx = 0; hIdx < this.hands.length; hIdx++) {
        const hand = this.hands[hIdx];
        if (Math.abs(xTop - hand.x) <= hand.halfWidth && yBot > hand.y && yTop < hand.y) {
          yBot = hand.y;
        }
      }
      if (yBot <= yTop) continue;
      yBot = Math.min(floorY, yBot);

      const xBot = xTop + slantX * ((yBot - yTop) / ln.len);
      ctx.strokeStyle = `rgba(226, 232, 240, ${ln.alpha})`;
      ctx.lineWidth = ln.width;
      ctx.beginPath();
      ctx.moveTo(xTop, yTop);
      ctx.lineTo(xBot, yBot);
      ctx.stroke();
    }
    ctx.restore();
  }

  _renderHomeAndSchool(ctx, { w, floorY, homePorchRightX, schoolPorchLeftX }) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // --- LEFT: Cozy Warm House (목적지 집) ---
    const houseW = Math.max(115, homePorchRightX - 24);
    const houseH = 148;
    const houseX = 16;
    const houseY = floorY - houseH;

    // House walls
    ctx.fillStyle = '#fef3c7';
    ctx.strokeStyle = '#57534e';
    ctx.lineWidth = 3;
    ctx.fillRect(houseX, houseY + 46, houseW, houseH - 46);
    ctx.strokeRect(houseX, houseY + 46, houseW, houseH - 46);

    // Warm pitched roof
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.moveTo(houseX - 10, houseY + 50);
    ctx.lineTo(houseX + houseW * 0.5, houseY);
    ctx.lineTo(houseX + houseW + 18, houseY + 50);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing amber window + door
    const glowBoost = this.homeGlowTimer > 0 ? 1.0 : 0.78;
    ctx.fillStyle = `rgba(251, 191, 36, ${glowBoost})`;
    ctx.fillRect(houseX + 18, houseY + 72, 34, 34);
    ctx.strokeRect(houseX + 18, houseY + 72, 34, 34);
    ctx.fillStyle = '#b45309';
    ctx.fillRect(houseX + houseW - 44, floorY - 58, 30, 58);
    ctx.strokeRect(houseX + houseW - 44, floorY - 58, 30, 58);

    // Home Porch Overhang
    ctx.fillStyle = '#fdba74';
    ctx.beginPath();
    ctx.moveTo(houseX + houseW, houseY + 66);
    ctx.lineTo(homePorchRightX + 6, houseY + 80);
    ctx.lineTo(homePorchRightX + 6, houseY + 88);
    ctx.lineTo(houseX + houseW, houseY + 88);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '900 15px system-ui, sans-serif';
    ctx.fillStyle = '#9a3412';
    ctx.fillText('🏠 우리 집', houseX + houseW * 0.5, houseY - 8);

    // --- RIGHT: Sketched School Awning (학교 현관) ---
    const schX = schoolPorchLeftX + 12;
    const schW = w - schX - 12;
    const schH = 170;
    const schY = floorY - schH;

    ctx.fillStyle = '#e7e5e4';
    ctx.fillRect(schX, schY + 34, schW, schH - 34);
    ctx.strokeRect(schX, schY + 34, schW, schH - 34);

    // Awning overhang reaching to schoolPorchLeftX
    ctx.fillStyle = '#fca5a5';
    ctx.beginPath();
    ctx.moveTo(schoolPorchLeftX - 12, floorY - 94);
    ctx.lineTo(schX + 12, floorY - 114);
    ctx.lineTo(schX + 12, floorY - 94);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // School sign & clock
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(schX + schW * 0.45, schY + 62, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 15px system-ui, sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('🏫 학교 (비 피하는 중)', schX + schW * 0.45, schY + 20);

    // Draw waiting children lined up safely under school porch!
    this.kidQueue.slice(0, 3).forEach((kid, idx) => {
      const kx = schoolPorchLeftX + 62 + idx * 34;
      if (kx < w - 18) {
        this._drawSketchKidBody(ctx, kx, floorY, kid.profile.coatColor, kid.profile.hatColor, 0, false, false, 0.78);
      }
    });

    ctx.restore();
  }

  _drawSketchKidBody(ctx, x, floorY, coatColor, hatColor, walkPhase, isCrying, isSheltered, scale = 1.0) {
    ctx.save();
    ctx.translate(x, floorY);
    ctx.scale(scale, scale);

    const bob = Math.abs(Math.sin(walkPhase)) * 4;
    const legSwing = Math.sin(walkPhase) * 6;

    ctx.strokeStyle = '#44403c';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';

    // Sketch legs
    ctx.beginPath();
    ctx.moveTo(-5, -14);
    ctx.lineTo(-5 - legSwing, 0);
    ctx.moveTo(5, -14);
    ctx.lineTo(5 + legSwing, 0);
    ctx.stroke();

    // Cute raincoat bell body
    ctx.fillStyle = coatColor;
    ctx.beginPath();
    ctx.moveTo(-14, -12 - bob);
    ctx.lineTo(-9, -36 - bob);
    ctx.lineTo(9, -36 - bob);
    ctx.lineTo(14, -12 - bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Round sketchy head
    ctx.fillStyle = '#ffedd5';
    ctx.beginPath();
    ctx.arc(0, -47 - bob, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rain hood / cap
    ctx.fillStyle = hatColor;
    ctx.beginPath();
    ctx.arc(0, -50 - bob, 13, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Face expression
    ctx.fillStyle = '#292524';
    if (isCrying) {
      // Crying X/arch eyes + waterfall tears
      ctx.beginPath();
      ctx.arc(-4, -47 - bob, 1.8, 0, Math.PI * 2);
      ctx.arc(4, -47 - bob, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(-6, -45 - bob, 3, 10);
      ctx.fillRect(3, -45 - bob, 3, 10);
    } else {
      ctx.beginPath();
      ctx.arc(-4, -47 - bob, 1.7, 0, Math.PI * 2);
      ctx.arc(4, -47 - bob, 1.7, 0, Math.PI * 2);
      ctx.fill();
      // Smile
      ctx.beginPath();
      ctx.arc(0, -43 - bob, 3.2, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    }

    ctx.restore();
  }

  _renderChild(ctx, child) {
    const isCrying = child.state === KidState.RETURNING_CRYING;
    const isSheltered = this.isPointShelteredByHand(child.x, child.y - child.headHeight);
    this._drawSketchKidBody(
      ctx,
      child.x,
      child.y,
      child.profile.coatColor,
      child.profile.hatColor,
      child.walkPhase,
      isCrying,
      isSheltered,
      1.08
    );

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(41, 37, 36, 0.88)';
    let tag = `🎒 ${child.profile.label}`;
    let col = '#fef08a';
    if (child.state === KidState.WAITING_AT_SCHOOL) {
      tag = '✋ 손으로 가려주세요!';
      col = '#fde047';
    } else if (isCrying) {
      tag = '😭 으앙!';
      col = '#93c5fd';
    } else if (!isSheltered) {
      tag = '🌧️ 비 맞아요!';
      col = '#fca5a5';
    }
    ctx.strokeText(tag, child.x, child.y - 76);
    ctx.fillStyle = col;
    ctx.fillText(tag, child.x, child.y - 76);
    ctx.restore();
  }

  _renderHandsVisual(ctx) {
    ctx.save();
    for (const hand of this.hands) {
      // Drawn sketchy umbrella canopy / warm hand shelter barrier right at palm position
      const r = hand.halfWidth;
      ctx.fillStyle = 'rgba(251, 146, 60, 0.85)';
      ctx.strokeStyle = '#44403c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hand.x - r, hand.y + 4);
      ctx.quadraticCurveTo(hand.x, hand.y - 36, hand.x + r, hand.y + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Palm center emblem
      ctx.font = '900 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✋', hand.x, hand.y - 2);
    }
    ctx.restore();
  }

  _renderHUD(ctx, w, h) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(41, 37, 36, 0.85)';

    ctx.textAlign = 'left';
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.lineWidth = 3.5;
    const leftTxt = '✋ 손바닥 아래만 안전지대 · 소낙비를 막아 집(🏠)으로 데려다주세요!';
    ctx.strokeText(leftTxt, 24, h - 22);
    ctx.fillStyle = '#fef3c7';
    ctx.fillText(leftTxt, 24, h - 22);

    ctx.textAlign = 'right';
    ctx.font = '900 18px system-ui, sans-serif';
    ctx.lineWidth = 4;
    const rightTxt = `🏠 귀가 완료: ${this.rescuedCount}명`;
    ctx.strokeText(rightTxt, w - 24, h - 22);
    ctx.fillStyle = '#fde047';
    ctx.fillText(rightTxt, w - 24, h - 22);

    ctx.restore();
  }
}
