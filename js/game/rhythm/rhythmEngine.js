/**
 * Rhythm Mode Core Engine ("Beat Pose Arena" - Type C Hybrid)
 * Features:
 *   - Body-centered Semicircular Hitbox divided into 5 spaced arc sectors
 *   - 3D Perspective LED Tunnel with light-passing beat arches
 *   - Base-beat micro-vibration & pulse across arena elements for strong beat feel
 */

import { soundManager } from '../../audio/soundManager.js';
import {
  RHYTHM_TRACKS,
  RhythmSynth,
  getTrackById
} from './rhythmSynth.js';
import {
  RHYTHM_LANES,
  SEMICIRCLE_SECTOR_COUNT,
  RhythmNoteType,
  SlashDirection,
  DodgeZone,
  TIMING_WINDOWS,
  GRADE_POINTS,
  evaluateTiming,
  generateChart
} from './chartGenerator.js';
import { PoseRhythmJudge } from './poseRhythmJudge.js';

const TUNNEL_RIB_COLORS = [
  '#f59e0b',
  '#f59e0b',
  '#10b981',
  '#38bdf8',
  '#d946ef',
  '#fb7185',
  '#f59e0b',
  '#10b981',
  '#38bdf8',
  '#d946ef'
];

export function computeBeatVibration(songTime, bpm, isFever = false) {
  const safeBpm = Math.max(40, bpm || 120);
  const beatFloat = Math.max(0, songTime * (safeBpm / 60));
  const beatFrac = beatFloat % 1;
  // Crisp kick impulse on every integer beat, decaying exponentially over ~30% of a beat
  const beatImpulse = Math.pow(1 - beatFrac, 3.4);
  const maxAmp = isFever ? 5.2 : 3.6;
  const vibAmp = beatImpulse * maxAmp;
  const vibX = Math.sin(beatFloat * Math.PI * 10) * vibAmp * 0.65;
  const vibY = Math.cos(beatFloat * Math.PI * 12) * vibAmp;
  const scalePulse = 1 + beatImpulse * 0.018;

  return { beatFloat, beatFrac, beatImpulse, vibX, vibY, scalePulse };
}

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
    this.lastVibration = computeBeatVibration(0, 112, false);

    // Body-centered semicircular arch anchor
    this.bodyAnchor = this.judge.computeBodyAnchor(null, null, width, height, true, 0);

    this.stats = {
      PERFECT: 0,
      GREAT: 0,
      GOOD: 0,
      MISS: 0,
      DODGE_CLEAR: 0
    };

    this.particles = [];
    this.floatingJudgments = [];
    this.padFlashes = new Array(SEMICIRCLE_SECTOR_COUNT).fill(0);
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
    this.bodyAnchor = this.judge.computeBodyAnchor(null, this.bodyAnchor, width, height, true, 0);
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
    this.lastVibration = computeBeatVibration(0, this.chart.track.bpm, false);

    this.bodyAnchor = this.judge.computeBodyAnchor(null, null, this.width, this.height, true, 0);

    this.stats = {
      PERFECT: 0,
      GREAT: 0,
      GOOD: 0,
      MISS: 0,
      DODGE_CLEAR: 0
    };

    this.particles = [];
    this.floatingJudgments = [];
    this.padFlashes = new Array(SEMICIRCLE_SECTOR_COUNT).fill(0);
    this.activeHandPoints = [];

    if (this.ui && typeof this.ui.pulseBeatHUD === 'function') {
      this.ui.pulseBeatHUD(0);
    }
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
    if (this.ui && typeof this.ui.pulseBeatHUD === 'function') {
      this.ui.pulseBeatHUD(0);
    }
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

  /**
   * Returns annular sector geometry & midpoint coordinates for the given semicircle lane
   * relative to the current body-centered anchor.
   */
  getLaneCenter(lane) {
    const anchor = this.bodyAnchor;
    const midAngle = lane.midAngle;
    const x = anchor.cx + Math.cos(midAngle) * anchor.midRadius;
    const y = anchor.cy + Math.sin(midAngle) * anchor.midRadius;

    return {
      id: lane.id,
      cx: anchor.cx,
      cy: anchor.cy,
      innerRadius: anchor.innerRadius,
      outerRadius: anchor.outerRadius,
      midRadius: anchor.midRadius,
      bandWidth: anchor.bandWidth,
      startAngle: lane.startAngle,
      endAngle: lane.endAngle,
      midAngle,
      x,
      y,
      radius: anchor.bandWidth * 0.52
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
      if (this.ui && typeof this.ui.pulseBeatHUD === 'function') {
        this.ui.pulseBeatHUD(0);
      }
      this.onGameOver();
    }
  }

  update(dt, currentTime, headPose = null, poses = null, externalSegments = []) {
    const safeDt = Math.min(Math.max(dt || 0, 0), 0.1);
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

    // Update body-centered semicircular hitbox anchor dynamically from pose landmarks
    this.bodyAnchor = this.judge.computeBodyAnchor(
      poses,
      this.bodyAnchor,
      this.width,
      this.height,
      true,
      safeDt
    );

    this.synth.advanceFallbackTime(safeDt);
    this.songTime = this.synth.getSongTime();

    if (this.chart) {
      this.lastVibration = computeBeatVibration(
        this.songTime,
        this.chart.track.bpm,
        this.feverTimer > 0
      );
      if (this.ui && typeof this.ui.pulseBeatHUD === 'function') {
        this.ui.pulseBeatHUD(this.lastVibration.beatImpulse);
      }
    }

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
              this.bodyAnchor.cx,
              this.bodyAnchor.cy - this.bodyAnchor.outerRadius * 0.55,
              '#facc15',
              1.35
            );
            this._spawnBurst(
              this.bodyAnchor.cx,
              this.bodyAnchor.cy - this.bodyAnchor.midRadius * 0.6,
              '#facc15',
              24
            );
          }
        } else if (this.songTime > ev.windowEnd) {
          ev.missed = true;
        }
        continue;
      }

      if (ev.type === RhythmNoteType.DODGE) {
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
              this.bodyAnchor.cx,
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

      // TAP or SLASH note timing evaluation against 5 semicircular sector hitboxes
      const deltaSec = this.songTime - ev.targetTime;
      const absDeltaMs = Math.abs(deltaSec) * 1000;

      if (deltaSec > maxGoodSec) {
        ev.missed = true;
        this.combo = 0;
        this.stats.MISS++;
        const sector = this.getLaneCenter(ev.lane);
        this.synth.playHitSFX('MISS');
        this._spawnJudgment('MISS', sector.x, sector.y - 16, '#ef4444', 0.95);
        this._damageLife(1);
        if (this.state !== 'PLAYING') return;
        continue;
      }

      if (absDeltaMs <= TIMING_WINDOWS.GOOD_MS && handSegments.length > 0) {
        const sector = this.getLaneCenter(ev.lane);
        let match = { hit: false };

        if (ev.type === RhythmNoteType.TAP) {
          match = this.judge.checkTapHit(sector, handSegments, 16);
        } else if (ev.type === RhythmNoteType.SLASH) {
          match = this.judge.checkSlashHit(sector, ev.direction, handSegments, 20, 5);
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
          this._spawnJudgment(
            label,
            sector.x,
            sector.y - 22,
            gradeColor,
            grade === 'PERFECT' ? 1.2 : 1.0
          );
          this._spawnBurst(sector.x, sector.y, ev.lane.color, grade === 'PERFECT' ? 18 : 12);
        }
      }
    }

    const totalDuration = this.synth.getTrackDuration(this.chart.track);
    if (this.songTime >= totalDuration + 0.6 && this.state === 'PLAYING') {
      this.state = 'TRACK_CLEAR';
      this.trackClearTimer = 3.5;
      this.synth.stop();
      this.synth.playFeverTriggerSFX();
      if (this.ui && typeof this.ui.pulseBeatHUD === 'function') {
        this.ui.pulseBeatHUD(0);
      }
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

  /**
   * Computes perspective tunnel depth interpolation (center & radius) for progress t in [0..1].
   */
  _projectTunnelDepth(anchor, t) {
    const vanishX = anchor.cx;
    const vanishY = anchor.cy - anchor.outerRadius * 0.24;
    const p = 0.10 + 0.90 * Math.pow(Math.max(0, Math.min(1.05, t)), 1.9);

    return {
      cx: vanishX + (anchor.cx - vanishX) * p,
      cy: vanishY + (anchor.cy - vanishY) * p,
      radius: anchor.midRadius * p,
      innerR: anchor.innerRadius * p,
      outerR: anchor.outerRadius * p,
      p
    };
  }

  render(ctx) {
    if (!ctx || !this.chart) return;
    const w = this.width;
    const h = this.height;
    const track = this.chart.track;
    const vib = computeBeatVibration(this.songTime, track.bpm, this.feverTimer > 0);
    const { beatFloat, beatImpulse, vibX, vibY, scalePulse } = vib;
    const anchor = this.bodyAnchor;

    ctx.save();

    // Base background vignette so camera feed shows cleanly behind neon tunnel
    const grad = ctx.createRadialGradient(
      anchor.cx,
      anchor.cy - anchor.outerRadius * 0.2,
      anchor.outerRadius * 0.1,
      anchor.cx,
      anchor.cy,
      w * 0.78
    );
    grad.addColorStop(0, 'rgba(2, 6, 23, 0.18)');
    grad.addColorStop(0.65, 'rgba(15, 23, 42, 0.42)');
    grad.addColorStop(1, 'rgba(2, 6, 23, 0.78)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Apply subtle base-beat micro-vibration & scale kick to the interactive tunnel & arena elements
    ctx.save();
    ctx.translate(anchor.cx + vibX, anchor.cy + vibY);
    ctx.scale(scalePulse, scalePulse);
    ctx.translate(-anchor.cx, -anchor.cy);

    // 1. Perspective 3D LED Tunnel Arches & Ceiling Light Pods
    this._renderTunnelArchitecture(ctx, anchor, beatFloat, beatImpulse, track);

    // 2. Active Dodge Laser Warnings & Fever Pose Prompts
    this._renderHazardsAndFever(ctx);

    // 3. Passing Tunnel Light Beat Notes flying forward along tunnel walls into sectors
    this._renderBeatNotes(ctx, anchor, beatImpulse);

    // 4. Body-Centered 5 Spaced Semicircular Hitbox Sectors
    this._renderSemicircleHitboxes(ctx, anchor, beatImpulse);

    // 5. Hand Wrist Cursors
    this.activeHandPoints.forEach((pt) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 17 + beatImpulse * 3, 0, Math.PI * 2);
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
      ctx.font = `900 ${Math.round(23 * j.scale)}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = j.color;
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 8;
      ctx.fillText(j.text, j.x, j.y);
      ctx.restore();
    }

    ctx.restore(); // end micro-vibration transform

    // 7. Rhythm Top/Bottom Arena HUD Overlay (with subtle vertical beat pulse)
    this._renderArenaHUD(ctx, track, beatFloat, beatImpulse, vibY);

    // 8. Track Clear Overlay
    if (this.state === 'TRACK_CLEAR') {
      ctx.save();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.76)';
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

  /**
   * Renders the receding 3D perspective tunnel arches and ceiling/side LED light strips
   * continuously rushing forward with BPM speed.
   */
  _renderTunnelArchitecture(ctx, anchor, beatFloat, beatImpulse, track) {
    const deep = this._projectTunnelDepth(anchor, 0);
    const front = this._projectTunnelDepth(anchor, 1);

    // Subtle tunnel sector rail guide lines converging from hitbox sector gaps into deep tunnel
    ctx.save();
    RHYTHM_LANES.forEach((lane) => {
      [lane.startAngle, lane.endAngle].forEach((ang) => {
        ctx.beginPath();
        ctx.moveTo(deep.cx + Math.cos(ang) * deep.radius, deep.cy + Math.sin(ang) * deep.radius);
        ctx.lineTo(front.cx + Math.cos(ang) * front.outerR, front.cy + Math.sin(ang) * front.outerR);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    });

    // Streaming concentric LED tunnel ribs (inspired by illuminated highway tunnel arches)
    const ribCount = 9;
    const scrollPhase = (beatFloat * 0.35) % 1;
    for (let i = 0; i < ribCount; i++) {
      const z = ((i / ribCount) + scrollPhase) % 1;
      const proj = this._projectTunnelDepth(anchor, z);
      const ribColor =
        this.feverTimer > 0
          ? '#facc15'
          : TUNNEL_RIB_COLORS[i % TUNNEL_RIB_COLORS.length] || track.accentColor;

      const alpha = (0.14 + z * 0.52) * (0.85 + beatImpulse * 0.35);
      const ribWidth = Math.max(1.5, 2 + proj.p * 7 + beatImpulse * 2.5);

      ctx.save();
      ctx.beginPath();
      ctx.arc(proj.cx, proj.cy, proj.radius, Math.PI, Math.PI * 2);
      ctx.strokeStyle = ribColor;
      ctx.globalAlpha = Math.min(0.88, alpha);
      ctx.lineWidth = ribWidth;
      ctx.shadowColor = ribColor;
      ctx.shadowBlur = 8 + proj.p * 16 + beatImpulse * 10;
      ctx.stroke();

      // Overhead twin tunnel ceiling LED light fixtures (receding left & right)
      const podOffsetAngleLeft = Math.PI + Math.PI * 0.34;
      const podOffsetAngleRight = Math.PI + Math.PI * 0.66;
      const podW = 4 + proj.p * 12;
      const podH = 2.5 + proj.p * 6;
      [podOffsetAngleLeft, podOffsetAngleRight].forEach((podAng) => {
        const lx = proj.cx + Math.cos(podAng) * (proj.radius * 0.96);
        const ly = proj.cy + Math.sin(podAng) * (proj.radius * 0.96);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = Math.min(0.95, alpha * 1.15);
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 10 + beatImpulse * 10;
        ctx.fillRect(lx - podW * 0.5, ly - podH * 0.5, podW, podH);
      });
      ctx.restore();
    }

    // Center body anchor marker (subtle glowing core reticle)
    ctx.beginPath();
    ctx.arc(anchor.cx, anchor.cy, 9 + beatImpulse * 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Renders the 5 curved semicircular hitbox arcs around the player's body
   * with visible un-hittable gaps between adjacent hitboxes.
   */
  _renderSemicircleHitboxes(ctx, anchor, beatImpulse) {
    RHYTHM_LANES.forEach((lane, idx) => {
      const flash = this.padFlashes[idx] || 0;
      const rIn = anchor.innerRadius - beatImpulse * 2 - flash * 4;
      const rOut = anchor.outerRadius + beatImpulse * 3 + flash * 6;

      ctx.save();
      ctx.beginPath();
      ctx.arc(anchor.cx, anchor.cy, rOut, lane.startAngle, lane.endAngle, false);
      ctx.arc(anchor.cx, anchor.cy, rIn, lane.endAngle, lane.startAngle, true);
      ctx.closePath();

      ctx.fillStyle = flash > 0 ? `${lane.color}77` : `${lane.color}22`;
      ctx.fill();

      ctx.lineWidth = 2.5 + flash * 3.5 + beatImpulse * 1.2;
      ctx.strokeStyle = flash > 0 ? '#ffffff' : lane.color;
      ctx.shadowColor = lane.color;
      ctx.shadowBlur = 10 + beatImpulse * 10 + flash * 22;
      ctx.stroke();

      // Subtle inner groove arc
      ctx.beginPath();
      ctx.arc(anchor.cx, anchor.cy, (rIn + rOut) * 0.5, lane.startAngle + 0.03, lane.endAngle - 0.03);
      ctx.strokeStyle = flash > 0 ? '#ffffff' : `${lane.color}99`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    });
  }

  /**
   * Renders beat notes as glowing curved LED tunnel light strips sweeping forward
   * along the tunnel ceiling/walls with volumetric passing light streaks.
   */
  _renderBeatNotes(ctx, anchor, beatImpulse) {
    for (const ev of this.events) {
      if (ev.hit || ev.missed) continue;
      if (ev.type !== RhythmNoteType.TAP && ev.type !== RhythmNoteType.SLASH) continue;

      const timeUntil = ev.targetTime - this.songTime;
      if (timeUntil > ev.approachTime || timeUntil < -(TIMING_WINDOWS.GOOD_MS / 1000)) continue;

      const t = Math.max(0, Math.min(1.04, 1 - timeUntil / ev.approachTime));
      const curr = this._projectTunnelDepth(anchor, t);
      const trail = this._projectTunnelDepth(anchor, Math.max(0, t - 0.16));

      const lane = ev.lane;
      const noteColor = ev.type === RhythmNoteType.SLASH ? '#facc15' : lane.color;
      const arcBandHalf = Math.max(5, (anchor.bandWidth * 0.36) * curr.p);
      const rOuter = curr.radius + arcBandHalf;
      const rInner = Math.max(4, curr.radius - arcBandHalf);
      const padA = 0.015;
      const sAng = lane.startAngle + padA;
      const eAng = lane.endAngle - padA;

      ctx.save();

      // 1. Volumetric Passing Light Streak (illuminating the tunnel rail behind the note)
      ctx.beginPath();
      ctx.arc(curr.cx, curr.cy, curr.radius, sAng, eAng, false);
      ctx.arc(trail.cx, trail.cy, trail.radius, eAng, sAng, true);
      ctx.closePath();

      const streakGrad = ctx.createRadialGradient(
        trail.cx,
        trail.cy,
        trail.radius * 0.4,
        curr.cx,
        curr.cy,
        rOuter
      );
      streakGrad.addColorStop(0, 'rgba(255,255,255,0.0)');
      streakGrad.addColorStop(0.55, `${lane.color}38`);
      streakGrad.addColorStop(1, `${noteColor}aa`);
      ctx.fillStyle = streakGrad;
      ctx.fill();

      // 2. Main Glowing Tunnel Light Arch Block
      ctx.beginPath();
      ctx.arc(curr.cx, curr.cy, rOuter, sAng, eAng, false);
      ctx.arc(curr.cx, curr.cy, rInner, eAng, sAng, true);
      ctx.closePath();

      ctx.globalAlpha = 0.45 + Math.min(0.55, t * 0.55);
      ctx.fillStyle = noteColor;
      ctx.shadowColor = noteColor;
      ctx.shadowBlur = 18 + t * 18 + beatImpulse * 8;
      ctx.fill();

      ctx.lineWidth = 2.5 + t * 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Core white LED filament line down the middle of the passing light arc
      ctx.beginPath();
      ctx.arc(curr.cx, curr.cy, curr.radius, sAng + 0.03, eAng - 0.03);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 + t * 3;
      ctx.stroke();

      // 3. Directional Slash Chevrons on SLASH light arches
      if (ev.type === RhythmNoteType.SLASH) {
        const midX = curr.cx + Math.cos(lane.midAngle) * curr.radius;
        const midY = curr.cy + Math.sin(lane.midAngle) * curr.radius;
        this._drawSlashArrow(ctx, midX, midY, Math.max(12, 22 * curr.p), ev.direction);
      }

      ctx.restore();
    }
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

        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 28px system-ui, sans-serif';
        ctx.fillText(ev.label, rx + rw * 0.5, ry + rh * 0.5);

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

  _renderArenaHUD(ctx, track, beatFloat, beatImpulse, vibY = 0) {
    const w = this.width;
    const h = this.height;
    const totalDuration = this.synth.getTrackDuration(track);
    const progress = Math.max(0, Math.min(1, this.songTime / Math.max(0.1, totalDuration)));

    ctx.save();
    ctx.translate(0, vibY * 0.65);

    // Top-center track pill + progress bar pulsing with beat
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fillRect(w * 0.32, 16, w * 0.36, 50);
    ctx.strokeStyle = track.accentColor;
    ctx.lineWidth = 2 + beatImpulse * 2.2;
    ctx.strokeRect(w * 0.32, 16, w * 0.36, 50);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillText(`🎵 ${track.title} (${track.bpm} BPM)`, w * 0.5, 38);

    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(w * 0.34, 48, w * 0.32, 7);
    ctx.fillStyle = track.accentColor;
    ctx.fillRect(w * 0.34, 48, w * 0.32 * progress, 7);

    // Count-in indicator (before beat 4)
    if (beatFloat < this.synth.countInBeats && this.state === 'PLAYING') {
      const countdown = Math.max(1, Math.ceil(this.synth.countInBeats - beatFloat));
      ctx.fillStyle = '#facc15';
      ctx.font = `900 ${Math.round(72 + beatImpulse * 10)}px system-ui, sans-serif`;
      ctx.fillText(`${countdown}`, w * 0.5, h * 0.46);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.fillText('몸 위 5개 반원 아치에 다가오는 터널 조명을 터치하거나 베어주세요!', w * 0.5, h * 0.46 + 44);
    }

    // Combo & Accuracy badge bottom-center pulsing subtly with beat
    if (this.combo > 0 || this.feverTimer > 0) {
      ctx.fillStyle = this.feverTimer > 0 ? '#facc15' : '#38bdf8';
      ctx.font = `900 ${Math.round(33 + beatImpulse * 5)}px system-ui, sans-serif`;
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
