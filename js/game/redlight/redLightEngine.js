/**
 * Red Light, Green Light ("🌺 무궁화 꽃이 피었습니다") Core Engine
 *
 * Inspired by Squid Game & traditional Korean tag:
 *   1. GREEN_LIGHT: Young-hee closes eyes & chants 10 syllables ("무궁화 꽃이 피었습니다!").
 *      Running in place zooms the 1st-person perspective forward toward Young-hee (0% -> 100%).
 *   2. RED_LIGHT: Right as chant finishes, Young-hee snaps eyes wide OPEN with glowing crimson irises!
 *      Any detected body motion above threshold triggers laser lock-on failure.
 *   3. TAG_READY: Arriving at 100% prompts Manse (🙌 both hands up) to slap/tag Young-hee!
 *   4. ESCAPE_RUN: 180-degree reverse sprint back to the Start Safe Gate as Young-hee chases from behind.
 *      Being too slow lets her catch you ("늦으면 잡힘"); crossing the gate clears the round!
 */

import { soundManager } from '../../audio/soundManager.js';
import { RedLightPoseController } from './redLightPoseController.js';

export const CHANT_SYLLABLES = ['무', '궁', '화', '꽃', '이', '피', '었', '습', '니', '다!'];

export const CHANT_RHYTHMS = {
  NORMAL: {
    id: 'NORMAL',
    label: '🎵 정박자',
    weights: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    durationScale: [0.95, 1.15]
  },
  SYNCOPATED: {
    id: 'SYNCOPATED',
    label: '⚡ 엇박자',
    weights: [1.45, 0.45, 1.35, 0.45, 1.4, 0.55, 1.25, 0.4, 0.4, 0.65],
    durationScale: [0.85, 1.1]
  },
  ACCELERANDO: {
    id: 'ACCELERANDO',
    label: '🚀 느리다 급발진',
    weights: [1.75, 1.65, 1.45, 0.6, 0.45, 0.35, 0.3, 0.25, 0.22, 0.28],
    durationScale: [0.9, 1.15]
  },
  SUSPENSE: {
    id: 'SUSPENSE',
    label: '⏳ 멈칫 엇박',
    weights: [0.45, 0.45, 0.45, 0.5, 0.55, 1.85, 1.65, 0.45, 0.35, 0.45],
    durationScale: [0.95, 1.2]
  },
  TURBO: {
    id: 'TURBO',
    label: '🔥 기습 초고속',
    weights: [0.8, 0.8, 0.8, 0.8, 0.8, 0.75, 0.7, 0.65, 0.6, 0.65],
    durationScale: [0.52, 0.65]
  }
};

export const CHANT_RHYTHM_IDS = Object.keys(CHANT_RHYTHMS);

export const RedLightPhase = {
  GREEN_LIGHT: 'GREEN_LIGHT',
  RED_LIGHT: 'RED_LIGHT',
  TAG_READY: 'TAG_READY',
  ESCAPE_RUN: 'ESCAPE_RUN',
  ROUND_CLEAR: 'ROUND_CLEAR',
  CAUGHT_FAIL: 'CAUGHT_FAIL'
};

// Measured normalized pupil coordinates on assets/sprites/redlight/younghee.png (537x462)
const DOLL_LEFT_EYE = { x: 0.4347, y: 0.4042 };
const DOLL_RIGHT_EYE = { x: 0.5890, y: 0.4049 };

export class RedLightEngine {
  constructor(width = 1280, height = 720, ui = null, sound = null) {
    this.width = width;
    this.height = height;
    this.ui = ui;
    this.sound = sound || soundManager;

    this.poseController = new RedLightPoseController();

    this.dollImg = null;
    this._initAssets();

    this.state = 'IDLE'; // 'IDLE', 'PLAYING', 'GAMEOVER'
    this.phase = RedLightPhase.GREEN_LIGHT;

    this.round = 1;
    this.score = 0;
    this.bestDistancePct = 0;

    // Approach progress (0 = start line, 1 = right in front of Young-hee)
    this.distance = 0;
    this.chantProgress = 0;
    this.chantElapsed = 0;
    this.chantDuration = 3.4;
    this.chantTimes = [];
    this.chantCount = 0;
    this.chantRhythm = CHANT_RHYTHMS.NORMAL;
    this.lastSyllableIdx = -1;
    this.redTimer = 0;
    this.redDuration = 2.2;
    this.tagTimer = 0;

    // Reverse escape run progress (0 = at Young-hee, 1 = safe back across start gate)
    this.escapeProgress = 0;
    this.chaserProgress = -0.14;
    this.playerSpeed = 0;
    this.peakEscapeSpeed = 0.142;
    this.chaseSpeed = 0.142 * 0.90;
    this.chaserStride = 0;
    this.chaserStepTimer = 0;

    this.phaseTimer = 0;
    this.failReason = null; // 'MOTION' | 'TAG_TIMEOUT' | 'CAUGHT_ESCAPE'
    this.failLaserTimer = 0;

    // Visual camera motion
    this.runIntensity = 0;
    this.motionMeter = 0;
    this.isManse = false;
    this.stridePhase = 0;
    this.cameraBob = 0;
    this.stepSoundCooldown = 0;
    this.shakeTimer = 0;

    this.particles = [];
    this.floatingTexts = [];

    this.onScore = () => {};
    this.onLivesChanged = () => {};
    this.onGameOver = () => {};
  }

  _initAssets() {
    if (typeof Image === 'undefined') return;
    const img = new Image();
    img.src = 'assets/sprites/redlight/younghee.png';
    this.dollImg = img;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  reset() {
    this.poseController.reset();

    this.round = 1;
    this.score = 0;
    this.bestDistancePct = 0;

    this.particles = [];
    this.floatingTexts = [];
    this.shakeTimer = 0;
    this.runIntensity = 0;
    this.motionMeter = 0;
    this.isManse = false;
    this.stridePhase = 0;
    this.cameraBob = 0;
    this.stepSoundCooldown = 0;
    this.failReason = null;
    this.failLaserTimer = 0;

    this._startRoundState();

    if (this.ui) {
      this.ui.updateScores(0, 0, false);
    }
  }

  _startRoundState() {
    this.distance = 0;
    this.escapeProgress = 0;
    this.chaserProgress = -0.14;
    this.bestDistancePct = 0;
    this.chantCount = 0;
    this.failReason = null;
    this.poseController.clearFreezeCheck();

    this._enterGreenLight();
  }

  _pickChantRhythm() {
    if (this.round === 1 && this.chantCount === 0) {
      return CHANT_RHYTHMS.NORMAL;
    }
    const prevId = this.chantRhythm ? this.chantRhythm.id : null;
    const pool = CHANT_RHYTHM_IDS.filter((id) => id !== prevId || id === 'NORMAL' || id === 'SYNCOPATED');
    const chosenId = pool[Math.floor(Math.random() * pool.length)] || 'NORMAL';
    return CHANT_RHYTHMS[chosenId];
  }

  _enterGreenLight(rhythmOverride = null) {
    this.phase = RedLightPhase.GREEN_LIGHT;
    const rhythm =
      (rhythmOverride && CHANT_RHYTHMS[rhythmOverride]) || this._pickChantRhythm();
    this.chantRhythm = rhythm;
    this.chantCount++;
    this.chantProgress = 0;
    this.chantElapsed = 0;
    this.lastSyllableIdx = -1;

    // Pace tightens gradually with rounds while varying cleanly by rhythm profile
    const baseDur = Math.max(2.0, 3.6 - (this.round - 1) * 0.24);
    const [sMin, sMax] = rhythm.durationScale;
    const scale = sMin + Math.random() * (sMax - sMin);
    this.chantDuration = baseDur * scale;

    // Build exact cumulative syllable timestamps so syncopated/accelerando beats are truly uneven
    const weights = rhythm.weights;
    const totalW = weights.reduce((sum, w) => sum + w, 0);
    const times = [];
    let acc = 0;
    for (let i = 0; i < weights.length; i++) {
      times.push((acc / totalW) * this.chantDuration);
      acc += weights[i];
    }
    this.chantTimes = times;
    this.poseController.clearFreezeCheck();
  }

  _enterRedLight() {
    this.phase = RedLightPhase.RED_LIGHT;
    this.redDuration = Math.max(1.6, 2.4 - (this.round - 1) * 0.1) + Math.random() * 0.5;
    this.redTimer = this.redDuration;
    this.poseController.startFreezeCheck(0.28);

    if (this.sound && typeof this.sound.playRedLightSnap === 'function') {
      this.sound.playRedLightSnap();
    }
  }

  _enterTagReady() {
    this.phase = RedLightPhase.TAG_READY;
    this.distance = 1.0;
    this.tagTimer = Math.max(2.6, 4.0 - (this.round - 1) * 0.18);
    this.poseController.clearFreezeCheck();
    this._spawnFloatingText('🙌 지금 만세해서 터치!', this.width * 0.5, this.height * 0.32, '#fde047', 1.25);
  }

  _enterEscapeRun() {
    this.phase = RedLightPhase.ESCAPE_RUN;
    this.escapeProgress = 0.14; // Razor-thin ~14m head-start!
    this.chaserProgress = 0.0;
    this.playerSpeed = 0;
    this.peakEscapeSpeed = 0.142;
    this.chaseSpeed = this.peakEscapeSpeed * 0.90;
    this.chaserStride = 0;
    this.chaserStepTimer = 0;
    this._addScore(50);
    this._spawnBurst(this.width * 0.5, this.height * 0.45, '#facc15', 22, 260);
    this._spawnFloatingText('💥 터치 성공! 뒤돌아 전력 질주!!', this.width * 0.5, this.height * 0.30, '#4ade80', 1.3);
    if (this.sound && typeof this.sound.playRedLightTag === 'function') {
      this.sound.playRedLightTag();
    }
  }

  _triggerCaughtFail(reason = 'MOTION') {
    this.phase = RedLightPhase.CAUGHT_FAIL;
    this.failReason = reason;
    this.failLaserTimer = 1.15;
    this.shakeTimer = 0.5;

    const msg =
      reason === 'CAUGHT_ESCAPE'
        ? '😱 늦었다! 술래에게 잡혔습니다!'
        : reason === 'TAG_TIMEOUT'
          ? '⏱️ 터치가 늦어 탈락했습니다!'
          : '🚨 움직임 감지! 탈락!';
    this._spawnFloatingText(msg, this.width * 0.5, this.height * 0.36, '#ef4444', 1.4);

    if (this.sound && typeof this.sound.playRedLightDetected === 'function') {
      this.sound.playRedLightDetected();
    }
  }

  start() {
    this.reset();
    this.state = 'PLAYING';
  }

  stop() {
    this.state = 'IDLE';
  }

  triggerManualStep() {
    if (this.state !== 'PLAYING') return;
    if (this.phase === RedLightPhase.TAG_READY) {
      this.poseController.triggerManualManse();
      return;
    }
    this.poseController.triggerManualStep(0.95);
  }

  triggerManualTag() {
    if (this.state !== 'PLAYING') return;
    this.poseController.triggerManualManse();
  }

  _addScore(pts) {
    if (pts <= 0) return;
    this.score += pts;
    this.onScore(this.score);
    if (this.ui) {
      this.ui.updateScores(this.score, 0, false);
    }
  }

  _spawnBurst(x, y, color, count = 14, speed = 200) {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const spd = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 40,
        radius: 3 + Math.random() * 4.5,
        color,
        life: 0.45 + Math.random() * 0.3,
        maxLife: 0.75
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
      life: 1.05,
      maxLife: 1.05
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

  update(dt, currentTime, poses = null) {
    const safeDt = Math.min(Math.max(dt || 0, 0), 0.1);
    this._updateEffects(safeDt);

    if (this.state !== 'PLAYING') return;

    const isRedPhase = this.phase === RedLightPhase.RED_LIGHT;
    const poseRes = this.poseController.update(poses, safeDt, isRedPhase);

    this.runIntensity = poseRes.runIntensity;
    this.motionMeter = poseRes.motionMeter;
    this.isManse = poseRes.isManse;

    if (this.stepSoundCooldown > 0) {
      this.stepSoundCooldown = Math.max(0, this.stepSoundCooldown - safeDt);
    }

    // Running camera bob & footstep cadence
    const activelyRunning =
      (this.phase === RedLightPhase.GREEN_LIGHT || this.phase === RedLightPhase.ESCAPE_RUN) &&
      this.runIntensity > 0.16;
    if (activelyRunning) {
      this.stridePhase += safeDt * (9 + this.runIntensity * 12);
      this.cameraBob = Math.sin(this.stridePhase) * (4 + this.runIntensity * 10);
      if (this.stepSoundCooldown <= 0) {
        this.stepSoundCooldown = Math.max(0.16, 0.34 - this.runIntensity * 0.16);
        if (this.sound && typeof this.sound.playRedLightStep === 'function') {
          this.sound.playRedLightStep();
        }
      }
    } else {
      this.cameraBob *= Math.exp(-safeDt * 12);
    }

    if (this.phase === RedLightPhase.GREEN_LIGHT) {
      // Advance chant elapsed & fire syllables according to active rhythm schedule (normal / syncopated / turbo / etc.)
      this.chantElapsed += safeDt;
      this.chantProgress = Math.min(1.0, this.chantElapsed / Math.max(0.1, this.chantDuration));

      let targetIdx = 0;
      for (let i = 0; i < this.chantTimes.length; i++) {
        if (this.chantElapsed >= this.chantTimes[i]) {
          targetIdx = i;
        }
      }
      if (targetIdx > this.lastSyllableIdx) {
        for (let s = this.lastSyllableIdx + 1; s <= targetIdx; s++) {
          if (this.sound && typeof this.sound.playRedLightSyllable === 'function') {
            this.sound.playRedLightSyllable(s);
          }
        }
        this.lastSyllableIdx = targetIdx;
      }

      // Advance forward toward Young-hee when running in place (longer 100m course ~13s sprint)
      if (this.runIntensity > 0.08) {
        const approachRate = 0.078 * this.runIntensity;
        this.distance = Math.min(1.0, this.distance + approachRate * safeDt);
        const pct = Math.floor(this.distance * 100);
        if (pct > this.bestDistancePct) {
          this._addScore(pct - this.bestDistancePct);
          this.bestDistancePct = pct;
        }
      }

      if (this.distance >= 1.0) {
        this._enterTagReady();
      } else if (this.chantProgress >= 1.0) {
        this._enterRedLight();
      }
    } else if (this.phase === RedLightPhase.RED_LIGHT) {
      if (poseRes.motionDetected) {
        this._triggerCaughtFail('MOTION');
        return;
      }

      this.redTimer -= safeDt;
      if (this.redTimer <= 0) {
        if (this.distance >= 1.0) {
          this._enterTagReady();
        } else {
          this._enterGreenLight();
        }
      }
    } else if (this.phase === RedLightPhase.TAG_READY) {
      this.tagTimer -= safeDt;
      if (this.isManse) {
        this._enterEscapeRun();
      } else if (this.tagTimer <= 0) {
        this._triggerCaughtFail('TAG_TIMEOUT');
      }
    } else if (this.phase === RedLightPhase.ESCAPE_RUN) {
      // Thrilling 90%-speed pursuit: Young-hee runs at 90% of player's sprint speed & surges if player slows down!
      const baseEscapeRate = 0.142;
      const currentSpeed = this.runIntensity > 0.08 ? baseEscapeRate * this.runIntensity : 0;
      this.playerSpeed = currentSpeed;
      this.escapeProgress = Math.min(1.0, this.escapeProgress + currentSpeed * safeDt);

      if (currentSpeed > this.peakEscapeSpeed) {
        this.peakEscapeSpeed = currentSpeed;
      }
      const baseChase = this.peakEscapeSpeed * 0.90;
      const roundMult = 1 + Math.min(0.24, (this.round - 1) * 0.04);
      const slowPenaltySurge = currentSpeed < baseChase * 0.82 ? 1.42 : 1.0;
      this.chaseSpeed = baseChase * roundMult * slowPenaltySurge;

      this.chaserProgress += this.chaseSpeed * safeDt;
      this.chaserStride += safeDt * (10 + slowPenaltySurge * 4);

      const gap = this.escapeProgress - this.chaserProgress;
      const proximity = Math.max(0, Math.min(1, 1 - gap / 0.24));
      this.chaserStepTimer -= safeDt;
      if (this.chaserStepTimer <= 0) {
        this.chaserStepTimer = Math.max(0.14, 0.34 - proximity * 0.18);
        if (this.sound && typeof this.sound.playRedLightChaserStep === 'function') {
          this.sound.playRedLightChaserStep(proximity);
        }
      }
      if (gap < 0.11 && this.shakeTimer <= 0.02) {
        this.shakeTimer = 0.08;
      }

      if (this.escapeProgress >= 1.0) {
        // Round Victory!
        this.phase = RedLightPhase.ROUND_CLEAR;
        this.phaseTimer = 1.9;
        const marginBonus = Math.round(Math.max(0, this.escapeProgress - this.chaserProgress) * 150);
        const clearBonus = 200 + marginBonus;
        this._addScore(clearBonus);
        this._spawnBurst(this.width * 0.5, this.height * 0.5, '#4ade80', 26, 280);
        this._spawnFloatingText(`🎉 ROUND ${this.round} 탈출 성공! +${clearBonus}`, this.width * 0.5, this.height * 0.35, '#4ade80', 1.35);
        if (this.sound && typeof this.sound.playRedLightClear === 'function') {
          this.sound.playRedLightClear();
        }
      } else if (this.chaserProgress >= this.escapeProgress) {
        this._triggerCaughtFail('CAUGHT_ESCAPE');
      }
    } else if (this.phase === RedLightPhase.ROUND_CLEAR) {
      this.phaseTimer -= safeDt;
      if (this.phaseTimer <= 0) {
        this.round++;
        this._startRoundState();
      }
    } else if (this.phase === RedLightPhase.CAUGHT_FAIL) {
      this.failLaserTimer -= safeDt;
      if (this.failLaserTimer <= 0) {
        this.state = 'GAMEOVER';
        this.onGameOver();
      }
    }
  }

  /**
   * Computes perspective zoom scale [0.14 .. 1.0] for the approaching target.
   */
  getTargetScale(progressVal) {
    const p = Math.max(0, Math.min(1, progressVal));
    return 0.14 + 0.86 * Math.pow(p, 1.65);
  }

  render(ctx) {
    if (!ctx) return;
    const w = this.width;
    const h = this.height;
    const horizonY = h * 0.44 + this.cameraBob * 0.6;

    ctx.save();
    if (this.shakeTimer > 0) {
      const mag = (this.shakeTimer / 0.5) * 16;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    // 1. 1st-Person Perspective Squid Game Field (semi-transparent to keep webcam silhouette subtle underneath)
    this._renderField(ctx, w, h, horizonY);

    // 2. Render active target ahead (Young-hee doll OR Reverse Safe Start Gate + Thrilling Chaser Effects!)
    if (this.phase === RedLightPhase.ESCAPE_RUN || this.phase === RedLightPhase.ROUND_CLEAR) {
      const gap = this.escapeProgress - this.chaserProgress;
      this._renderEscapeGate(ctx, w, h, horizonY);
      this._renderChaserShadow(ctx, w, h, horizonY, gap);
      this._renderSpeedLines(ctx, w, h, Math.max(this.runIntensity, 0.45));
      if (this.phase === RedLightPhase.ESCAPE_RUN) {
        this._renderDangerHands(ctx, w, h, gap);
        this._renderRearviewMirror(ctx, w, h, gap);
        this._renderChaseRadar(ctx, w, h);
      }
    } else {
      this._renderYoungHee(ctx, w, h, horizonY);
      if (this.phase === RedLightPhase.GREEN_LIGHT && this.runIntensity > 0.25) {
        this._renderSpeedLines(ctx, w, h, this.runIntensity * 0.75);
      }
    }

    // 3. Red-Light crimson vignette / detection laser strike
    if (this.phase === RedLightPhase.RED_LIGHT || this.phase === RedLightPhase.CAUGHT_FAIL) {
      this._renderScannerOverlay(ctx, w, h);
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
      ctx.font = `900 ${Math.round(22 * ft.scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 5. Top Chant Banner & Bottom Motion/Progress HUD
    this._renderHUD(ctx, w, h);

    ctx.restore();
  }

  _renderField(ctx, w, h, horizonY) {
    const isEscape = this.phase === RedLightPhase.ESCAPE_RUN;
    // Soft translucent sky wash (allows subtle webcam behind)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    if (isEscape) {
      skyGrad.addColorStop(0, 'rgba(254, 215, 170, 0.54)');
      skyGrad.addColorStop(1, 'rgba(254, 202, 202, 0.48)');
    } else {
      skyGrad.addColorStop(0, 'rgba(186, 230, 253, 0.56)');
      skyGrad.addColorStop(1, 'rgba(224, 242, 254, 0.44)');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, horizonY);

    // Distant painted Squid Game courtyard walls
    ctx.fillStyle = 'rgba(241, 245, 249, 0.42)';
    ctx.fillRect(0, horizonY - 26, w, 26);

    // Sandy playground ground trapezoid
    const sandGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    sandGrad.addColorStop(0, 'rgba(253, 230, 170, 0.58)');
    sandGrad.addColorStop(1, 'rgba(217, 179, 130, 0.72)');
    ctx.fillStyle = sandGrad;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    // Perspective track lanes converging at horizon center
    const cx = w * 0.5;
    const laneLines = [-0.45, -0.22, 0.22, 0.45];
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = 3;
    laneLines.forEach((off) => {
      ctx.beginPath();
      ctx.moveTo(cx + off * w * 0.14, horizonY);
      ctx.lineTo(cx + off * w * 1.15, h);
      ctx.stroke();
    });

    // Horizontal ground stripes rushing downward briskly to preserve high-speed running feel
    const scrollFrac = ((isEscape ? this.escapeProgress * 22 : this.distance * 32)) % 1;
    for (let i = 0; i < 6; i++) {
      const t = (i + scrollFrac) / 6;
      const y = horizonY + (h - horizonY) * Math.pow(t, 1.8);
      const halfSpan = w * (0.08 + 0.56 * Math.pow(t, 1.3));
      ctx.strokeStyle = `rgba(180, 130, 80, ${0.15 + 0.25 * t})`;
      ctx.lineWidth = 2 + 2 * t;
      ctx.beginPath();
      ctx.moveTo(cx - halfSpan, y);
      ctx.lineTo(cx + halfSpan, y);
      ctx.stroke();
    }
  }

  _renderYoungHee(ctx, w, h, horizonY) {
    const scale = this.getTargetScale(this.distance);
    const cx = w * 0.5;
    const feetY = horizonY + 18 + (h - horizonY) * 0.42 * scale;
    const dollH = h * (0.20 + 0.64 * scale);
    const dollW = dollH * (537 / 462);

    // Finish / Touch red-gold line on floor at Young-hee's feet
    const lineHalfW = w * (0.14 + 0.34 * scale);
    ctx.save();
    ctx.strokeStyle = this.phase === RedLightPhase.TAG_READY ? '#facc15' : '#ef4444';
    ctx.lineWidth = 3 + 5 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - lineHalfW, feetY);
    ctx.lineTo(cx + lineHalfW, feetY);
    ctx.stroke();

    // Stylized tree behind Young-hee
    ctx.fillStyle = 'rgba(139, 90, 43, 0.65)';
    ctx.fillRect(cx - dollW * 0.12, feetY - dollH * 1.28, dollW * 0.24, dollH * 1.28);
    ctx.fillStyle = 'rgba(74, 222, 128, 0.58)';
    ctx.beginPath();
    ctx.arc(cx, feetY - dollH * 1.25, dollW * 0.42, 0, Math.PI * 2);
    ctx.fill();

    // Draw uploaded Young-hee doll sprite
    const drawX = cx - dollW * 0.5;
    const drawY = feetY - dollH;
    const spriteReady = this.dollImg && this.dollImg.complete && this.dollImg.naturalWidth > 0;
    const isEyesOpenRed = this.phase === RedLightPhase.RED_LIGHT || this.phase === RedLightPhase.CAUGHT_FAIL;

    if (spriteReady) {
      ctx.drawImage(this.dollImg, drawX, drawY, dollW, dollH);
    } else {
      // Headless / pre-load fallback doll silhouette
      ctx.fillStyle = '#f8dece';
      ctx.beginPath();
      ctx.arc(cx, drawY + dollH * 0.4, dollW * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(cx - dollW * 0.22, drawY + dollH * 0.66, dollW * 0.44, dollH * 0.34);
    }

    // Eye Overlay anchored to exact pupil coords (0.4347, 0.4042) & (0.5890, 0.4049)
    const eyes = [DOLL_LEFT_EYE, DOLL_RIGHT_EYE];
    eyes.forEach((eye) => {
      const ex = drawX + eye.x * dollW;
      const ey = drawY + eye.y * dollH;
      const eyeRx = dollW * 0.044;
      const eyeRy = dollH * 0.032;

      if (!isEyesOpenRed && this.phase !== RedLightPhase.TAG_READY) {
        // GREEN_LIGHT: Closed eyelids matching Young-hee's skin tone (#f8dece)
        ctx.fillStyle = '#f8dece';
        ctx.beginPath();
        ctx.ellipse(ex, ey, eyeRx * 1.18, eyeRy * 1.35, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#3f2316';
        ctx.lineWidth = Math.max(1.5, dollW * 0.008);
        ctx.beginPath();
        ctx.arc(ex, ey - eyeRy * 0.2, eyeRx * 0.92, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      } else if (isEyesOpenRed) {
        // RED_LIGHT: Eyes snapped WIDE OPEN with glowing crimson irises & scanner laser!
        ctx.save();
        const glowR = eyeRx * 2.2;
        const glowGrad = ctx.createRadialGradient(ex, ey, 1, ex, ey, glowR);
        glowGrad.addColorStop(0, 'rgba(255, 50, 50, 0.95)');
        glowGrad.addColorStop(0.45, 'rgba(239, 68, 68, 0.75)');
        glowGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(ex, ey, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Crimson iris
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(ex, ey, eyeRx * 0.62, 0, Math.PI * 2);
        ctx.fill();

        // Glowing hot inner pupil glint
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(ex - eyeRx * 0.16, ey - eyeRx * 0.16, eyeRx * 0.18, 0, Math.PI * 2);
        ctx.fill();

        // Sweeping crimson laser cone toward player camera
        const sweepX = cx + Math.sin((this.redTimer || 0) * 4.5) * w * 0.36;
        const beamGrad = ctx.createLinearGradient(ex, ey, sweepX, h);
        beamGrad.addColorStop(0, 'rgba(239, 68, 68, 0.42)');
        beamGrad.addColorStop(1, 'rgba(239, 68, 68, 0.04)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(sweepX - w * 0.14, h);
        ctx.lineTo(sweepX + w * 0.14, h);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    });

    // TAG_READY glowing touch target prompt on Young-hee
    if (this.phase === RedLightPhase.TAG_READY) {
      const pulse = 1 + 0.12 * Math.sin((this.tagTimer || 0) * 10);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, drawY + dollH * 0.55, 58 * pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = '900 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
      const tagMsg = `🙌 만세해서 술래 터치! (${this.tagTimer.toFixed(1)}s)`;
      ctx.strokeText(tagMsg, cx, drawY + dollH * 0.25);
      ctx.fillStyle = '#fde047';
      ctx.fillText(tagMsg, cx, drawY + dollH * 0.25);
    }

    ctx.restore();
  }

  _renderEscapeGate(ctx, w, h, horizonY) {
    const scale = this.getTargetScale(this.escapeProgress);
    const cx = w * 0.5;
    const gateY = horizonY + 14 + (h - horizonY) * 0.44 * scale;
    const gateW = w * (0.20 + 0.52 * scale);
    const gateH = h * (0.14 + 0.34 * scale);

    ctx.save();
    // Safe Return Finish Banner Arch
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = Math.max(4, 12 * scale);
    ctx.beginPath();
    ctx.moveTo(cx - gateW * 0.5, gateY);
    ctx.lineTo(cx - gateW * 0.5, gateY - gateH);
    ctx.lineTo(cx + gateW * 0.5, gateY - gateH);
    ctx.lineTo(cx + gateW * 0.5, gateY);
    ctx.stroke();

    // Floor emerald finish line
    ctx.fillStyle = 'rgba(34, 197, 94, 0.35)';
    ctx.fillRect(cx - gateW * 0.55, gateY - 6, gateW * 1.1, 14 * scale);

    ctx.textAlign = 'center';
    ctx.font = `900 ${Math.round(16 + 22 * scale)}px system-ui, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeText('🏁 출발선 (안전구역)', cx, gateY - gateH - 12);
    ctx.fillStyle = '#86efac';
    ctx.fillText('🏁 출발선 (안전구역)', cx, gateY - gateH - 12);
    ctx.restore();
  }

  _renderSpeedLines(ctx, w, h, intensity) {
    if (intensity <= 0.15) return;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.22 * intensity})`;
    ctx.lineWidth = 3;
    const cx = w * 0.5;
    const cy = h * 0.45;
    for (let i = 0; i < 16; i++) {
      const ang = (Math.PI * 2 * i) / 16 + (this.stridePhase * 0.03);
      const rIn = Math.min(w, h) * (0.38 - intensity * 0.08);
      const rOut = Math.max(w, h) * 0.72;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * rIn, cy + Math.sin(ang) * rIn);
      ctx.lineTo(cx + Math.cos(ang) * rOut, cy + Math.sin(ang) * rOut);
      ctx.stroke();
    }
    ctx.restore();
  }

  _renderChaserShadow(ctx, w, h, horizonY, gap) {
    const proximity = Math.max(0, Math.min(1, 1 - gap / 0.28));
    if (proximity <= 0.05) return;

    const cx = w * 0.5 + Math.sin(this.chaserStride) * (10 + 18 * proximity);
    const tipY = h - (h - horizonY) * (0.28 + 0.42 * proximity);
    const bodyW = w * (0.14 + 0.22 * proximity);

    ctx.save();
    ctx.fillStyle = `rgba(15, 23, 42, ${0.18 + 0.34 * proximity})`;

    // Looming torso & head shadow stretching up the sandy floor from behind player
    ctx.beginPath();
    ctx.moveTo(cx - bodyW * 0.9, h);
    ctx.lineTo(cx - bodyW * 0.35, tipY + 46);
    ctx.lineTo(cx + bodyW * 0.35, tipY + 46);
    ctx.lineTo(cx + bodyW * 0.9, h);
    ctx.closePath();
    ctx.fill();

    // Head + Twin Pigtails shadow
    ctx.beginPath();
    ctx.arc(cx, tipY + 26, bodyW * 0.26, 0, Math.PI * 2);
    ctx.arc(cx - bodyW * 0.28, tipY + 34, bodyW * 0.12, 0, Math.PI * 2);
    ctx.arc(cx + bodyW * 0.28, tipY + 34, bodyW * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // Outstretched reaching shadow arms
    ctx.lineWidth = Math.max(8, bodyW * 0.13);
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(15, 23, 42, ${0.18 + 0.34 * proximity})`;
    ctx.beginPath();
    ctx.moveTo(cx - bodyW * 0.24, tipY + 52);
    ctx.lineTo(cx - bodyW * 0.65, tipY - 8 * proximity);
    ctx.moveTo(cx + bodyW * 0.24, tipY + 52);
    ctx.lineTo(cx + bodyW * 0.65, tipY - 8 * proximity);
    ctx.stroke();

    ctx.restore();
  }

  _renderDangerHands(ctx, w, h, gap) {
    if (gap >= 0.15) return;
    const urgency = Math.max(0, Math.min(1, 1 - gap / 0.15));
    const lunge = Math.sin(this.chaserStride * 1.4) * 14 * urgency;

    ctx.save();
    // Pulsing crimson peripheral danger vignette
    const pulse = 0.65 + 0.35 * Math.sin(this.chaserStride * 2.2);
    ctx.fillStyle = `rgba(220, 38, 38, ${0.32 * urgency * pulse})`;
    ctx.fillRect(0, 0, w, h);

    // Reaching shadowy hands creeping in from bottom-left & bottom-right corners
    ctx.fillStyle = `rgba(15, 23, 42, ${0.55 * urgency})`;
    [-1, 1].forEach((side) => {
      const baseX = side < 0 ? 0 : w;
      const reachX = baseX - side * (70 * urgency + lunge);
      const reachY = h - 90 * urgency;
      ctx.beginPath();
      ctx.arc(reachX, reachY, 34, 0, Math.PI * 2);
      ctx.fill();
      for (let f = -1; f <= 2; f++) {
        ctx.beginPath();
        ctx.ellipse(reachX - side * 14, reachY - 22 + f * 12, 22, 6, side * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
  }

  _renderRearviewMirror(ctx, w, h, gap) {
    const mirrorW = 196;
    const mirrorH = 88;
    const mx = w * 0.5;
    const my = 128;
    const proximity = Math.max(0, Math.min(1, 1 - gap / 0.25));

    ctx.save();
    // Mirror chrome frame
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(mx - mirrorW * 0.5 - 5, my - mirrorH * 0.5 - 5, mirrorW + 10, mirrorH + 10, 22);
    ctx.fill();
    ctx.strokeStyle = gap < 0.14 ? '#ef4444' : '#94a3b8';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Clip interior rearview glass
    ctx.beginPath();
    ctx.roundRect(mx - mirrorW * 0.5, my - mirrorH * 0.5, mirrorW, mirrorH, 18);
    ctx.clip();

    // Rearview mini sky & track
    ctx.fillStyle = '#fca5a5';
    ctx.fillRect(mx - mirrorW * 0.5, my - mirrorH * 0.5, mirrorW, mirrorH * 0.45);
    ctx.fillStyle = '#d6b384';
    ctx.fillRect(mx - mirrorW * 0.5, my - mirrorH * 0.05, mirrorW, mirrorH * 0.55);

    // Looming Young-hee inside rearview mirror growing bigger & bouncing fiercely as gap narrows!
    const bounceY = Math.abs(Math.sin(this.chaserStride)) * (5 + 6 * proximity);
    const swayX = Math.sin(this.chaserStride * 0.5) * (6 + 8 * proximity);
    const dollH = mirrorH * (0.48 + 0.92 * proximity);
    const dollW = dollH * (537 / 462);
    const dx = mx + swayX - dollW * 0.5;
    const dy = my + mirrorH * 0.48 - dollH * 0.88 - bounceY;

    const spriteReady = this.dollImg && this.dollImg.complete && this.dollImg.naturalWidth > 0;
    if (spriteReady) {
      ctx.drawImage(this.dollImg, dx, dy, dollW, dollH);
    } else {
      ctx.fillStyle = '#f8dece';
      ctx.beginPath();
      ctx.arc(mx + swayX, dy + dollH * 0.38, dollW * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    // Glowing crimson eyes in the rearview mirror
    [DOLL_LEFT_EYE, DOLL_RIGHT_EYE].forEach((eye) => {
      const ex = dx + eye.x * dollW;
      const ey = dy + eye.y * dollH;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(ex, ey, Math.max(2.2, dollW * 0.032), 0, Math.PI * 2);
      ctx.fill();
    });

    // Subtle "백미러" tag
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.fillRect(mx - 36, my - mirrorH * 0.5, 72, 16);
    ctx.fillStyle = '#fca5a5';
    ctx.font = '800 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔙 후방 추격', mx, my - mirrorH * 0.5 + 12);

    ctx.restore();
  }

  _renderChaseRadar(ctx, w, h) {
    const barW = Math.min(460, w * 0.62);
    const barH = 14;
    const x0 = (w - barW) * 0.5;
    const y0 = 204;

    const gap = this.escapeProgress - this.chaserProgress;
    const gapM = Math.max(0, Math.round(gap * 100));

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.76)';
    ctx.beginPath();
    ctx.roundRect(x0 - 14, y0 - 24, barW + 28, 52, 14);
    ctx.fill();

    // Track rail
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    ctx.roundRect(x0, y0, barW, barH, 7);
    ctx.fill();

    // Safe Finish Flag
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(x0 + barW, y0 + barH * 0.5, 10, 0, Math.PI * 2);
    ctx.fill();

    // Chaser marker
    const chaserX = x0 + Math.max(0, Math.min(1, this.chaserProgress)) * barW;
    const playerX = x0 + Math.max(0, Math.min(1, this.escapeProgress)) * barW;

    ctx.font = '900 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏃', playerX, y0 + 12);
    ctx.fillText('👹', chaserX, y0 + 12);

    ctx.font = '800 12.5px system-ui, sans-serif';
    ctx.fillStyle = gap < 0.14 ? '#fca5a5' : '#fde047';
    ctx.fillText(
      gap < 0.14
        ? `😱 영희 거리 ${gapM}m! 멈추면 바로 잡힙니다!!`
        : `💨 추격 거리 ${gapM}m (영희 속도 90% 추적 중!)`,
      w * 0.5,
      y0 - 7
    );
    ctx.restore();
  }

  _renderScannerOverlay(ctx, w, h) {
    ctx.save();
    const alpha = this.phase === RedLightPhase.CAUGHT_FAIL ? 0.34 : 0.14 + this.motionMeter * 0.22;
    ctx.fillStyle = `rgba(220, 38, 38, ${alpha})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  _renderHUD(ctx, w, h) {
    ctx.save();
    ctx.lineJoin = 'round';

    // Top-center phase/chant indicator pill (cleanly below Score HUD)
    const bannerY = 66;
    if (this.phase === RedLightPhase.GREEN_LIGHT) {
      const activeCount = Math.min(CHANT_SYLLABLES.length, this.lastSyllableIdx + 1);
      const spoken = CHANT_SYLLABLES.slice(0, Math.max(1, activeCount)).join(' ');
      const rhythmTag = this.chantRhythm ? this.chantRhythm.label : '🎵 정박자';

      ctx.textAlign = 'center';
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeText(rhythmTag, w * 0.5, bannerY - 30);
      ctx.fillStyle = this.chantRhythm && this.chantRhythm.id !== 'NORMAL' ? '#fde047' : '#bae6fd';
      ctx.fillText(rhythmTag, w * 0.5, bannerY - 30);

      ctx.font = '900 28px system-ui, sans-serif';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeText(`🟢 ${spoken}`, w * 0.5, bannerY);
      ctx.fillStyle = '#4ade80';
      ctx.fillText(`🟢 ${spoken}`, w * 0.5, bannerY);

      if (this.runIntensity < 0.14) {
        ctx.font = '900 20px system-ui, sans-serif';
        ctx.lineWidth = 4;
        ctx.strokeText('🏃 점프하세요! (제자리 달리기)', w * 0.5, bannerY + 36);
        ctx.fillStyle = '#fde047';
        ctx.fillText('🏃 점프하세요! (제자리 달리기)', w * 0.5, bannerY + 36);
      }
    } else if (this.phase === RedLightPhase.RED_LIGHT) {
      ctx.textAlign = 'center';
      ctx.font = '900 32px system-ui, sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.92)';
      const txt = '🔴 얼음! 움직이지 마세요!';
      ctx.strokeText(txt, w * 0.5, bannerY);
      ctx.fillStyle = '#f87171';
      ctx.fillText(txt, w * 0.5, bannerY);
    } else if (this.phase === RedLightPhase.ESCAPE_RUN) {
      ctx.textAlign = 'center';
      ctx.font = '900 28px system-ui, sans-serif';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
      const txt = '💨 출발선으로 전력 질주!';
      ctx.strokeText(txt, w * 0.5, bannerY);
      ctx.fillStyle = '#fde047';
      ctx.fillText(txt, w * 0.5, bannerY);
    }

    // Bottom Progress + Motion / Run Meter
    const pct =
      this.phase === RedLightPhase.ESCAPE_RUN || this.phase === RedLightPhase.ROUND_CLEAR
        ? Math.round(this.escapeProgress * 100)
        : Math.round(this.distance * 100);
    const barW = Math.min(360, w * 0.36);
    const barX = 24;
    const barY = h - 40;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, 18, 9);
    ctx.fill();

    const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    if (this.phase === RedLightPhase.RED_LIGHT) {
      fillGrad.addColorStop(0, '#ef4444');
      fillGrad.addColorStop(1, '#f97316');
    } else {
      fillGrad.addColorStop(0, '#ec4899');
      fillGrad.addColorStop(1, '#4ade80');
    }
    const meterRatio =
      this.phase === RedLightPhase.RED_LIGHT ? this.motionMeter : this.runIntensity;
    ctx.fillStyle = fillGrad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * Math.min(1, Math.max(0.03, meterRatio)), 18, 9);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
    const meterLabel =
      this.phase === RedLightPhase.RED_LIGHT
        ? `🚨 움직임 감지 게이지: ${Math.round(this.motionMeter * 100)}%`
        : `🏃 달리기 속도: ${Math.round(this.runIntensity * 100)}% (제자리 뛰기 / Space)`;
    ctx.strokeText(meterLabel, barX, barY - 8);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(meterLabel, barX, barY - 8);

    ctx.textAlign = 'right';
    ctx.font = '900 18px system-ui, sans-serif';
    ctx.lineWidth = 4;
    const remainM = Math.max(0, 100 - pct);
    const rightTxt =
      this.phase === RedLightPhase.ESCAPE_RUN
        ? `ROUND ${this.round} · 출발선까지 ${remainM}m`
        : `ROUND ${this.round} · 남은 거리 ${remainM}m (${pct}%)`;
    ctx.strokeText(rightTxt, w - 24, h - 22);
    ctx.fillStyle = '#fde047';
    ctx.fillText(rightTxt, w - 24, h - 22);

    ctx.restore();
  }
}
