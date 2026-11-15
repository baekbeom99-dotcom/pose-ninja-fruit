/**
 * Rhythm Mode Core Engine ("Beat Pose Arena" - Type C Hybrid)
 * Coordinates synth beat playback, chart event scheduling, hand/pose judgment,
 * combo/accuracy/fever multipliers, track progression, and neon arena visuals.
 */

import { soundManager } from '../../audio/soundManager.js';
import {
  RHYTHM_TRACKS,
  RhythmSynth,
  getTrackById
} from './rhythmSynth.js';
import {
  RHYTHM_LANES,
  RhythmNoteType,
  SlashDirection,
  DodgeZone,
  TIMING_WINDOWS,
  GRADE_POINTS,
  evaluateTiming,
  generateChart
} from './chartGenerator.js';
import { PoseRhythmJudge } from './poseRhythmJudge.js';

export class RhythmEngine {
  constructor(width = 1280, height = 720, ui = null, sound = null) {
    this.width = width;
    this.height = height;
    this.ui = ui;
    this.sound = sound || soundManager;

    this.synth = new RhythmSynth(this.sound);
    this.judge = new PoseRhythmJudge();

    this.selectedTrackId = RHYTHM_TRACKS[0].id;
    this.state = 'IDLE'; // 'IDLE', 'PLAYING', 'TRACK_CLEAR', 'GAMEOVER'
    this.chart = null;
    this.events = [];

    this.score = 0;
    this.lives = 5;
    this.maxLives = 5;
    this.combo = 0;
    this.maxCombo = 0;
    this.feverTimer = 0;
    this.trackClearTimer = 0;
    this.songTime = 0;

    this.stats = {
      PERFECT: 0,
      GREAT: 0,
      GOOD: 0,
      MISS: 0,
      DODGE_CLEAR: 0
    };

    this.particles = [];
    this.floatingJudgments = [];
    this.padFlashes = [0, 0, 0, 0];
    this.activeHandPoints = [];

    this.onScore = () => {};
    this.onLivesChanged = () => {};
    this.onGameOver = () => {};
  }

  setSelectedTrack(trackId) {
    this.selectedTrackId = getTrackById(trackId).id;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  reset(trackId = this.selectedTrackId) {
    this.synth.stop();
    this.judge.reset();

    this.selectedTrackId = getTrackById(trackId).id;
    this.chart = generateChart(this.selectedTrackId, this.synth.countInBeats);
    this.events = this.chart.events;

    this.score = 0;
    this.lives = this.maxLives;
    this.combo = 0;
    this.maxCombo = 0;
    this.feverTimer = 0;
    this.trackClearTimer = 0;
    this.songTime = 0;

    this.stats = {
      PERFECT: 0,
      GREAT: 0,
      GOOD: 0,
      MISS: 0,
      DODGE_CLEAR: 0
    };

    this.particles = [];
    this.floatingJudgments = [];
    this.padFlashes = [0, 0, 0, 0];
    this.activeHandPoints = [];
  }

  start(trackId = this.selectedTrackId, keepScore = false) {
    const prevScore = keepScore ? this.score : 0;
    const prevLives = keepScore ? this.lives : this.maxLives;

    this.reset(trackId);
    this.score = prevScore;
    this.lives = prevLives;
    this.state = 'PLAYING';

    this.synth.start(this.selectedTrackId);

    this.onScore(this.score);
    this.onLivesChanged(this.lives);
    if (this.ui) {
      this.ui.updateScores(this.score, 0, false);
      this.ui.updateLives(this.lives, this.maxLives);
    }
  }

  stop() {
    this.synth.stop();
    this.state = 'IDLE';
  }

  getAccuracy() {
    const total =
      this.stats.PERFECT + this.stats.GREAT + this.stats.GOOD + this.stats.MISS;
    if (total === 0) return 100;
    const weighted =
      this.stats.PERFECT * 1.0 + this.stats.GREAT * 0.7 + this.stats.GOOD * 0.4;
    return Math.round((weighted / total) * 100);
  }

  getRank() {
    const acc = this.getAccuracy();
    if (acc >= 92) return 'S';
    if (acc >= 80) return 'A';
    if (acc >= 65) return 'B';
    return 'C';
  }

  getLaneCenter(lane) {
    return {
      x: lane.nx * this.width,
      y: lane.ny * this.height,
      radius: Math.max(42, Math.min(this.width, this.height) * 0.068)
    };
  }

  _addScore(basePoints) {
    const feverMult = this.feverTimer > 0 ? 2 : 1;
    const comboMult = 1 + Math.min(0.5, Math.floor(this.combo / 10) * 0.1);
    const points = Math.round(basePoints * feverMult * comboMult);
    this.score += points;
    this.onScore(this.score);
    if (this.ui) {
      this.ui.updateScores(this.score, 0, false);
    }
    return points;
  }

  _spawnJudgment(text, x, y, color = '#ffffff', scale = 1.0) {
    this.floatingJudgments.push({
      text,
      x,
      y,
      color,
      scale,
      life: 0.75,
      maxLife: 0.75
    });
  }

  _spawnBurst(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 110 + Math.random() * 240;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3 + Math.random() * 4,
        color,
        life: 0.45 + Math.random() * 0.2,
        maxLife: 0.65
      });
    }
  }

  _damageLife(amount = 1) {
    this.lives = Math.max(0, this.lives - amount);
    this.onLivesChanged(this.lives);
    if (this.ui) {
      this.ui.updateLives(this.lives, this.maxLives);
    }
    if (this.lives <= 0 && this.state === 'PLAYING') {
      this.state = 'GAMEOVER';
      this.synth.stop();
      this.onGameOver();
    }
  }

  update(dt, currentTime, headPose = null, poses = null, externalSegments = []) {
    const safeDt = Math.min(Math.max(dt || 0, 0), 0.1);

    // Update particles, flashes & floating judgments regardless of track clear state
    this._updateEffects(safeDt);

    if (this.state === 'TRACK_CLEAR') {
      this.trackClearTimer -= safeDt;
      if (this.trackClearTimer <= 0) {
        const idx = RHYTHM_TRACKS.findIndex((t) => t.id === this.selectedTrackId);
        const nextTrack = RHYTHM_TRACKS[(idx + 1) % RHYTHM_TRACKS.length];
        this.start(nextTrack.id, true);
      }
      return;
    }

    if (this.state !== 'PLAYING') return;

    if (this.feverTimer > 0) {
      this.feverTimer = Math.max(0, this.feverTimer - safeDt);
    }

    this.synth.advanceFallbackTime(safeDt);
    this.songTime = this.synth.getSongTime();

    const handSegments = this.judge.extractHandSegments(
      poses,
      this.width,
      this.height,
      true,
      externalSegments
    );
    this.activeHandPoints = handSegments.map((s) => s.p2);
    const headPos = this.judge.extractHeadPosition(
      poses,
      headPose,
      this.width,
      this.height,
      true
    );

    const maxGoodSec = TIMING_WINDOWS.GOOD_MS / 1000;

    // Evaluate active chart notes
    for (const ev of this.events) {
      if (ev.hit || ev.missed) continue;

      if (ev.type === RhythmNoteType.FEVER_POSE) {
        if (this.songTime >= ev.windowStart && this.songTime <= ev.windowEnd) {
          if (this.judge.checkMansePose(poses)) {
            ev.hit = true;
            this.feverTimer = ev.durationMultiplierSec || 8.0;
            const gained = this._addScore(GRADE_POINTS.FEVER_BONUS);
            this.synth.playFeverTriggerSFX();
            this._spawnJudgment(
              `🙌 FEVER x2! +${gained}`,
              this.width * 0.5,
              this.height * 0.28,
              '#facc15',
              1.35
            );
            this._spawnBurst(this.width * 0.5, this.height * 0.3, '#facc15', 24);
          }
        } else if (this.songTime > ev.windowEnd) {
          // Fever pose is bonus-only (no life penalty on skip)
          ev.missed = true;
        }
        continue;
      }

      if (ev.type === RhythmNoteType.DODGE) {
        // Resolve at targetTime
        if (this.songTime >= ev.targetTime) {
          const check = this.judge.checkDodgeSafe(ev.dodgeZone, headPos, this.width, this.height);
          if (check.safe) {
            ev.hit = true;
            this.combo++;
            this.maxCombo = Math.max(this.maxCombo, this.combo);
            this.stats.DODGE_CLEAR++;
            const gained = this._addScore(GRADE_POINTS.DODGE_CLEAR);
            this.synth.playDodgeClearSFX();
            this._spawnJudgment(
              `⚡ DODGE CLEAR +${gained}`,
              this.width * 0.5,
              this.height * 0.35,
              '#34d399',
              1.15
            );
          } else {
            ev.missed = true;
            this.combo = 0;
            this.stats.MISS++;
            this.synth.playHitSFX('MISS');
            this._spawnJudgment('💥 LASER HIT!', this.width * 0.5, this.height * 0.4, '#ef4444', 1.2);
            this._damageLife(1);
            if (this.state !== 'PLAYING') return;
          }
        }
        continue;
      }

      // TAP or SLASH note timing check
      const deltaSec = this.songTime - ev.targetTime;
      const absDeltaMs = Math.abs(deltaSec) * 1000;

      // Expired note -> MISS
      if (deltaSec > maxGoodSec) {
        ev.missed = true;
        this.combo = 0;
        this.stats.MISS++;
        const center = this.getLaneCenter(ev.lane);
        this.synth.playHitSFX('MISS');
        this._spawnJudgment('MISS', center.x, center.y - 18, '#ef4444', 0.95);
        this._damageLife(1);
        if (this.state !== 'PLAYING') return;
        continue;
      }

      // Inside hit window -> check hand hit
      if (absDeltaMs <= TIMING_WINDOWS.GOOD_MS && handSegments.length > 0) {
        const center = this.getLaneCenter(ev.lane);
        let match = { hit: false };

        if (ev.type === RhythmNoteType.TAP) {
          match = this.judge.checkTapHit(center, handSegments, 28);
        } else if (ev.type === RhythmNoteType.SLASH) {
          match = this.judge.checkSlashHit(center, ev.direction, handSegments, 34, 5);
        }

        if (match.hit) {
          const grade = evaluateTiming(absDeltaMs);
          ev.hit = true;
          ev.grade = grade;
          this.combo++;
          this.maxCombo = Math.max(this.maxCombo, this.combo);
          this.stats[grade]++;

          const gained = this._addScore(GRADE_POINTS[grade]);
          this.padFlashes[ev.laneIndex] = 1.0;
          this.synth.playHitSFX(grade, ev.type === RhythmNoteType.SLASH);

          const gradeColor =
            grade === 'PERFECT' ? '#facc15' : grade === 'GREAT' ? '#38bdf8' : '#a7f3d0';
          const label =
            ev.type === RhythmNoteType.SLASH ? `⚔️ ${grade}! +${gained}` : `${grade}! +${gained}`;
          this._spawnJudgment(label, center.x, center.y - 24, gradeColor, grade === 'PERFECT' ? 1.2 : 1.0);
          this._spawnBurst(center.x, center.y, ev.lane.color, grade === 'PERFECT' ? 18 : 12);
        }
      }
    }

    // Check song completion
    const totalDuration = this.synth.getTrackDuration(this.chart.track);
    if (this.songTime >= totalDuration + 0.6 && this.state === 'PLAYING') {
      this.state = 'TRACK_CLEAR';
      this.trackClearTimer = 3.5;
      this.synth.stop();
      this.synth.playFeverTriggerSFX();
      this._spawnBurst(this.width * 0.5, this.height * 0.4, '#22d3ee', 28);
      this._spawnBurst(this.width * 0.5, this.height * 0.4, '#f472b6', 24);
    }
  }

  _updateEffects(dt) {
    for (let i = 0; i < this.padFlashes.length; i++) {
      if (this.padFlashes[i] > 0) {
        this.padFlashes[i] = Math.max(0, this.padFlashes[i] - dt * 3.5);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingJudgments.length - 1; i >= 0; i--) {
      const j = this.floatingJudgments[i];
      j.y -= 48 * dt;
      j.life -= dt;
      if (j.life <= 0) this.floatingJudgments.splice(i, 1);
    }
  }

  render(ctx) {
    if (!ctx || !this.chart) return;
    const w = this.width;
    const h = this.height;
    const track = this.chart.track;
    const beatFloat = Math.max(0, this.songTime * (track.bpm / 60));
    const beatPulse = Math.pow(1 - (beatFloat % 1), 2.5);

    ctx.save();

    // 1. Dark Neon Beat Vignette & Beat Pulse Ring
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, h * 0.12, w * 0.5, h * 0.5, w * 0.72);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.12)');
    grad.addColorStop(1, 'rgba(2, 6, 23, 0.72)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Center BPM Pulse Circle
    const pulseRadius = Math.min(w, h) * (0.16 + beatPulse * 0.045);
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, pulseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = this.feverTimer > 0 ? 'rgba(250, 204, 21, 0.5)' : `${track.accentColor}44`;
    ctx.lineWidth = 3 + beatPulse * 5;
    ctx.stroke();

    // 2. Active Dodge Laser Warnings & Fever Pose Prompts
    this._renderHazardsAndFever(ctx);

    // 3. Draw 4 Ergonomic Target Receptors
    RHYTHM_LANES.forEach((lane, idx) => {
      const center = this.getLaneCenter(lane);
      const flash = this.padFlashes[idx] || 0;

      ctx.save();
      ctx.beginPath();
      ctx.arc(center.x, center.y, center.radius + flash * 10, 0, Math.PI * 2);
      ctx.fillStyle = flash > 0 ? `${lane.color}55` : 'rgba(15, 23, 42, 0.55)';
      ctx.fill();
      ctx.lineWidth = 3.5 + flash * 4;
      ctx.strokeStyle = flash > 0 ? '#ffffff' : lane.color;
      ctx.shadowColor = lane.color;
      ctx.shadowBlur = 12 + beatPulse * 10 + flash * 20;
      ctx.stroke();

      // Inner beat dot
      ctx.beginPath();
      ctx.arc(center.x, center.y, 7 + beatPulse * 3, 0, Math.PI * 2);
      ctx.fillStyle = lane.color;
      ctx.fill();
      ctx.restore();
    });

    // 4. Draw Approaching Beat Notes (TAP & SLASH)
    this._renderBeatNotes(ctx);

    // 5. Hand Wrist Cursors (Neon Rings)
    this.activeHandPoints.forEach((pt) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 18, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.restore();
    });

    // 6. Particles & Floating Judgments
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

    for (const j of this.floatingJudgments) {
      const alpha = Math.max(0, j.life / j.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${Math.round(24 * j.scale)}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = j.color;
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 8;
      ctx.fillText(j.text, j.x, j.y);
      ctx.restore();
    }

    // 7. Rhythm Top/Bottom Arena HUD Overlay (Track Name, Progress, Combo, Rank)
    this._renderArenaHUD(ctx, track, beatFloat);

    // 8. Track Clear Overlay
    if (this.state === 'TRACK_CLEAR') {
      ctx.save();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
      ctx.fillRect(0, h * 0.34, w, h * 0.32);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#facc15';
      ctx.font = '900 44px system-ui, sans-serif';
      ctx.fillText(`🎵 ${track.title} CLEAR!`, w * 0.5, h * 0.46);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '800 26px system-ui, sans-serif';
      ctx.fillText(
        `RANK ${this.getRank()} · ACCURACY ${this.getAccuracy()}% · MAX COMBO ${this.maxCombo}`,
        w * 0.5,
        h * 0.54
      );

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.fillText('잠시 후 다음 트랙으로 이동합니다...', w * 0.5, h * 0.61);
      ctx.restore();
    }

    ctx.restore();
  }

  _renderHazardsAndFever(ctx) {
    const w = this.width;
    const h = this.height;

    for (const ev of this.events) {
      if (ev.hit || ev.missed) continue;

      if (ev.type === RhythmNoteType.DODGE) {
        const timeUntil = ev.targetTime - this.songTime;
        if (timeUntil > ev.approachTime * 1.15 || timeUntil < -0.1) continue;

        const progress = Math.max(0, Math.min(1, 1 - timeUntil / (ev.approachTime * 1.15)));
        const pulseAlpha = 0.18 + progress * 0.36;

        ctx.save();
        ctx.fillStyle = `rgba(239, 68, 68, ${pulseAlpha})`;
        ctx.strokeStyle = progress > 0.78 ? '#fef08a' : '#ef4444';
        ctx.lineWidth = 4;

        let rx = 0;
        let ry = 0;
        let rw = w;
        let rh = h;
        if (ev.dodgeZone === DodgeZone.LEFT) {
          rw = w * 0.44;
        } else if (ev.dodgeZone === DodgeZone.RIGHT) {
          rx = w * 0.56;
          rw = w * 0.44;
        } else if (ev.dodgeZone === DodgeZone.TOP) {
          rh = h * 0.45;
        }

        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx + 2, ry + 2, rw - 4, rh - 4);

        // Warning label
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 28px system-ui, sans-serif';
        ctx.fillText(ev.label, rx + rw * 0.5, ry + rh * 0.5);

        // Countdown bar
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(w * 0.35, h * 0.16, w * 0.3, 12);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(w * 0.35, h * 0.16, w * 0.3 * progress, 12);
        ctx.restore();
      } else if (ev.type === RhythmNoteType.FEVER_POSE) {
        if (this.songTime >= ev.windowStart && this.songTime <= ev.windowEnd) {
          ctx.save();
          ctx.fillStyle = 'rgba(250, 204, 21, 0.18)';
          ctx.fillRect(w * 0.2, h * 0.14, w * 0.6, 66);
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 3;
          ctx.strokeRect(w * 0.2, h * 0.14, w * 0.6, 66);

          ctx.textAlign = 'center';
          ctx.fillStyle = '#fef08a';
          ctx.font = '900 26px system-ui, sans-serif';
          ctx.fillText(ev.label, w * 0.5, h * 0.14 + 42);
          ctx.restore();
        }
      }
    }
  }

  _renderBeatNotes(ctx) {
    const centerArena = { x: this.width * 0.5, y: this.height * 0.5 };

    for (const ev of this.events) {
      if (ev.hit || ev.missed) continue;
      if (ev.type !== RhythmNoteType.TAP && ev.type !== RhythmNoteType.SLASH) continue;

      const timeUntil = ev.targetTime - this.songTime;
      if (timeUntil > ev.approachTime || timeUntil < -(TIMING_WINDOWS.GOOD_MS / 1000)) continue;

      const laneCenter = this.getLaneCenter(ev.lane);
      const t = Math.max(0, Math.min(1, 1 - timeUntil / ev.approachTime)); // 0 -> spawn, 1 -> on beat

      // Moving orb flying radially from screen center toward lane pad
      const orbX = centerArena.x + (laneCenter.x - centerArena.x) * t;
      const orbY = centerArena.y + (laneCenter.y - centerArena.y) * t;
      const orbRadius = 18 + t * (laneCenter.radius - 24);

      ctx.save();
      // 1. Shrinking outer approach ring on the target receptor
      const approachRadius = laneCenter.radius * (1 + (1 - t) * 1.45);
      ctx.beginPath();
      ctx.arc(laneCenter.x, laneCenter.y, approachRadius, 0, Math.PI * 2);
      ctx.strokeStyle = ev.type === RhythmNoteType.SLASH ? '#facc15' : ev.lane.color;
      ctx.globalAlpha = 0.25 + t * 0.75;
      ctx.lineWidth = 3;
      ctx.stroke();

      // 2. Incoming Beat Orb
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.arc(orbX, orbY, orbRadius, 0, Math.PI * 2);
      ctx.fillStyle = ev.type === RhythmNoteType.SLASH ? '#f59e0b' : ev.lane.color;
      ctx.shadowColor = ev.lane.color;
      ctx.shadowBlur = 16;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // 3. Directional Arrow inside SLASH notes
      if (ev.type === RhythmNoteType.SLASH) {
        this._drawSlashArrow(ctx, orbX, orbY, orbRadius * 0.65, ev.direction);
      }
      ctx.restore();
    }
  }

  _drawSlashArrow(ctx, cx, cy, size, direction) {
    let angle = 0;
    if (direction === SlashDirection.RIGHT) angle = 0;
    else if (direction === SlashDirection.DOWN) angle = Math.PI * 0.5;
    else if (direction === SlashDirection.LEFT) angle = Math.PI;
    else if (direction === SlashDirection.UP) angle = -Math.PI * 0.5;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(-size * 0.75, 0);
    ctx.lineTo(size * 0.6, 0);
    ctx.moveTo(size * 0.15, -size * 0.45);
    ctx.lineTo(size * 0.7, 0);
    ctx.lineTo(size * 0.15, size * 0.45);
    ctx.stroke();
    ctx.restore();
  }

  _renderArenaHUD(ctx, track, beatFloat) {
    const w = this.width;
    const h = this.height;
    const totalDuration = this.synth.getTrackDuration(track);
    const progress = Math.max(0, Math.min(1, this.songTime / Math.max(0.1, totalDuration)));

    ctx.save();
    // Top-center track pill + progress bar
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(w * 0.32, 16, w * 0.36, 50);
    ctx.strokeStyle = track.accentColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(w * 0.32, 16, w * 0.36, 50);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillText(`🎵 ${track.title} (${track.bpm} BPM)`, w * 0.5, 38);

    // Song progress bar
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(w * 0.34, 48, w * 0.32, 7);
    ctx.fillStyle = track.accentColor;
    ctx.fillRect(w * 0.34, 48, w * 0.32 * progress, 7);

    // Count-in indicator (before beat 4)
    if (beatFloat < this.synth.countInBeats && this.state === 'PLAYING') {
      const countdown = Math.max(1, Math.ceil(this.synth.countInBeats - beatFloat));
      ctx.fillStyle = '#facc15';
      ctx.font = '900 72px system-ui, sans-serif';
      ctx.fillText(`${countdown}`, w * 0.5, h * 0.5 + 24);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.fillText('리듬에 맞춰 원 안에 손을 대거나 베어주세요!', w * 0.5, h * 0.5 + 64);
    }

    // Combo & Accuracy badge bottom-center
    if (this.combo > 0 || this.feverTimer > 0) {
      ctx.fillStyle = this.feverTimer > 0 ? '#facc15' : '#38bdf8';
      ctx.font = '900 34px system-ui, sans-serif';
      const comboText =
        this.feverTimer > 0
          ? `🔥 FEVER x2 · ${this.combo} COMBO`
          : `${this.combo} COMBO`;
      ctx.fillText(comboText, w * 0.5, h - 54);
    }

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(
      `ACC ${this.getAccuracy()}% · RANK ${this.getRank()} · MAX ${this.maxCombo}`,
      w * 0.5,
      h - 24
    );
    ctx.restore();
  }
}
