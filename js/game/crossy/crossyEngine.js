/**
 * Crossy Mode Core Engine ("길건너 점프" - 1-Axis Forward Timing)
 * Implements 방안 1:
 *   - Forward-only progression triggered by Jump OR Manse (or Space/Up/Tap fallback)
 *   - River rafts physically drift player left/right (dynamic path shift!)
 *   - Solid land hops smoothly auto-center player back toward x = 0 with zero obstacle softlocks
 */

import { soundManager } from '../../audio/soundManager.js';
import {
  CrossyLane,
  CrossyPlayer,
  LaneType,
  WORLD_HALF_WIDTH
} from './crossyEntities.js';
import { CrossyPoseController } from './crossyPoseController.js';

export class CrossyEngine {
  constructor(width = 1280, height = 720, ui = null, sound = null) {
    this.width = width;
    this.height = height;
    this.ui = ui;
    this.sound = sound || soundManager;

    this.poseController = new CrossyPoseController();
    this.player = new CrossyPlayer();

    this.lanes = new Map();
    this.generatedMaxRow = -5;
    this.lastSafeRow = 0;

    this.score = 0;
    this.coins = 0;
    this.maxRow = 0;
    this.lives = 5;
    this.maxLives = 5;
    this.state = 'IDLE'; // 'IDLE', 'PLAYING', 'GAMEOVER'

    this.cameraRow = 1.5;
    this.idleTimer = 0;
    this.idleLimit = 7.8;
    this.streak = 0;
    this.streakWindow = 0;

    this.poseState = { jumpRatio: 0, isWingFlapUp: false, wingSpreadRatio: 0, lastReason: null };
    this.wingAnimTimer = 0;
    this.particles = [];
    this.groundRipples = [];
    this.floatingTexts = [];
    this.shakeTimer = 0;
    this.landCameraBounce = 0;

    this.onScore = () => {};
    this.onLivesChanged = () => {};
    this.onGameOver = () => {};

    if (typeof window !== 'undefined') {
      this._onKeyDown = (e) => {
        if (this.state !== 'PLAYING') return;
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          this.triggerHop('KEY');
        }
      };
      window.addEventListener('keydown', this._onKeyDown);
    }
  }

  destroy() {
    if (typeof window !== 'undefined' && this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
    }
    this.stop();
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  reset() {
    this.poseController.reset();
    this.player.reset(0, 0);
    this.lanes.clear();
    this.generatedMaxRow = -5;
    this.lastSafeRow = 0;

    this.score = 0;
    this.coins = 0;
    this.maxRow = 0;
    this.lives = this.maxLives;
    this.cameraRow = 1.8;
    this.idleTimer = 0;
    this.streak = 0;
    this.streakWindow = 0;
    this.poseState = { jumpRatio: 0, isWingFlapUp: false, wingSpreadRatio: 0, lastReason: null };
    this.wingAnimTimer = 0;
    this.particles = [];
    this.groundRipples = [];
    this.floatingTexts = [];
    this.shakeTimer = 0;
    this.landCameraBounce = 0;

    // Generate initial visible terrain (-4 .. +22)
    for (let r = -4; r <= 2; r++) {
      this.lanes.set(r, new CrossyLane(r, LaneType.GRASS, 1));
    }
    this.generatedMaxRow = 2;
    this._ensureLanesAhead(22);

    if (this.ui) {
      this.ui.updateScores(0, 0, false);
      this.ui.updateLives(this.lives, this.maxLives);
    }
  }

  start() {
    this.reset();
    this.state = 'PLAYING';
    this.player.invulnerableTimer = 1.0;
  }

  stop() {
    this.state = 'IDLE';
  }

  /**
   * Generates procedural chunks ahead: alternating Roads, short Rivers (1-2 rows), Rails, and Grass rest lanes.
   */
  _ensureLanesAhead(targetMaxRow) {
    while (this.generatedMaxRow < targetMaxRow) {
      const nextStart = this.generatedMaxRow + 1;
      const diff = 1 + Math.floor(nextStart / 8);

      // Pick a clean biome burst
      const roll = Math.random();
      if (nextStart <= 5) {
        // Gentle opening: 2-lane road then grass
        for (let i = 0; i < 2; i++) {
          const r = nextStart + i;
          this.lanes.set(r, new CrossyLane(r, LaneType.ROAD, 1, { dir: i % 2 === 0 ? 1 : -1 }));
        }
        this.lanes.set(nextStart + 2, new CrossyLane(nextStart + 2, LaneType.GRASS, 1));
        this.generatedMaxRow = nextStart + 2;
      } else if (roll < 0.42) {
        // Road section (2-3 lanes) + Grass buffer
        const roadCount = diff >= 3 && Math.random() < 0.5 ? 3 : 2;
        for (let i = 0; i < roadCount; i++) {
          const r = nextStart + i;
          const dir = i % 2 === 0 ? 1 : -1;
          this.lanes.set(r, new CrossyLane(r, LaneType.ROAD, diff, { dir }));
        }
        const grassRow = nextStart + roadCount;
        this.lanes.set(grassRow, new CrossyLane(grassRow, LaneType.GRASS, diff));
        this.generatedMaxRow = grassRow;
      } else if (roll < 0.76) {
        // River section (1-2 lanes of drifting rafts) + Grass exit
        const riverCount = diff >= 2 && Math.random() < 0.55 ? 2 : 1;
        for (let i = 0; i < riverCount; i++) {
          const r = nextStart + i;
          const dir = i % 2 === 0 ? -1 : 1;
          this.lanes.set(r, new CrossyLane(r, LaneType.RIVER, diff, { dir }));
        }
        const grassRow = nextStart + riverCount;
        this.lanes.set(grassRow, new CrossyLane(grassRow, LaneType.GRASS, diff));
        this.generatedMaxRow = grassRow;
      } else {
        // Railroad crossing + Grass buffer
        this.lanes.set(nextStart, new CrossyLane(nextStart, LaneType.RAIL, diff));
        const hasSecond = Math.random() < 0.35;
        if (hasSecond) {
          this.lanes.set(nextStart + 1, new CrossyLane(nextStart + 1, LaneType.RAIL, diff));
          this.lanes.set(nextStart + 2, new CrossyLane(nextStart + 2, LaneType.GRASS, diff));
          this.generatedMaxRow = nextStart + 2;
        } else {
          this.lanes.set(nextStart + 1, new CrossyLane(nextStart + 1, LaneType.GRASS, diff));
          this.generatedMaxRow = nextStart + 1;
        }
      }
    }

    // Prune far behind rows while preserving lastSafeRow for respawn
    const pruneCutoff = Math.min(this.player.row, this.lastSafeRow) - 6;
    for (const r of this.lanes.keys()) {
      if (r < pruneCutoff) {
        this.lanes.delete(r);
      }
    }
  }

  getLane(row) {
    return this.lanes.get(row) || null;
  }

  /**
   * Triggers 1 forward hop (+1 row) via Jump, Wing Flap, Keyboard, or Click/Touch.
   */
  triggerHop(source = 'MANUAL') {
    if (this.state !== 'PLAYING') return false;
    const currentLane = this.getLane(this.player.row);
    const currentType = currentLane ? currentLane.type : LaneType.GRASS;

    const launchX = this.player.x;
    const launchRow = this.player.row;
    const started = this.player.startHop(currentType);
    if (!started) return false;

    this.idleTimer = 0;
    this.wingAnimTimer = 0.28;
    this.poseState.lastReason = source;

    // Takeoff puff & launch ripple
    this._spawnGroundRipple(launchX, launchRow, 'rgba(255, 255, 255, 0.75)', 28);
    this._spawnBurst(launchX, launchRow, '#f8fafc', 7);

    if (this.sound && typeof this.sound.playCrossyHop === 'function') {
      this.sound.playCrossyHop();
    }
    return true;
  }

  _spawnGroundRipple(x, row, color = 'rgba(255,255,255,0.8)', maxRadius = 36) {
    this.groundRipples.push({
      x,
      row,
      color,
      radius: 8,
      maxRadius,
      life: 0.34,
      maxLife: 0.34
    });
  }

  _addScore(points) {
    this.score += points;
    this.onScore(this.score);
    if (this.ui) {
      this.ui.updateScores(this.score, 0, false);
    }
  }

  _spawnBurst(x, row, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const spd = 90 + Math.random() * 190;
      this.particles.push({
        x,
        row,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        z: 10 + Math.random() * 20,
        vz: 80 + Math.random() * 140,
        color,
        life: 0.45 + Math.random() * 0.25,
        maxLife: 0.7
      });
    }
  }

  _spawnFloatingText(text, x, row, color = '#facc15') {
    this.floatingTexts.push({
      text,
      x,
      row,
      z: 36,
      color,
      life: 0.85,
      maxLife: 0.85
    });
  }

  _handleHazardHit(reason = 'CRASH') {
    if (this.state !== 'PLAYING') return;
    if (this.player.invulnerableTimer > 0 && reason !== 'IDLE') return;

    this.lives = Math.max(0, this.lives - 1);
    this.onLivesChanged(this.lives);
    if (this.ui) {
      this.ui.updateLives(this.lives, this.maxLives);
    }

    this.shakeTimer = 0.35;
    this.streak = 0;
    this.idleTimer = 0;

    if (reason === 'SPLASH') {
      this._spawnBurst(this.player.x, this.player.row, '#38bdf8', 18);
      this._spawnFloatingText('💦 SPLASH!', this.player.x, this.player.row, '#38bdf8');
      if (this.sound && typeof this.sound.playCrossySplash === 'function') {
        this.sound.playCrossySplash();
      }
    } else if (reason === 'IDLE') {
      this._spawnBurst(this.player.x, this.player.row, '#f97316', 18);
      this._spawnFloatingText('🦅 시간 초과!', this.player.x, this.player.row, '#f97316');
      if (this.sound && typeof this.sound.playCrossyCrash === 'function') {
        this.sound.playCrossyCrash();
      }
    } else {
      this._spawnBurst(this.player.x, this.player.row, '#ef4444', 18);
      this._spawnFloatingText('💥 CRASH!', this.player.x, this.player.row, '#ef4444');
      if (this.sound && typeof this.sound.playCrossyCrash === 'function') {
        this.sound.playCrossyCrash();
      }
    }

    if (this.lives <= 0) {
      this.state = 'GAMEOVER';
      this.onGameOver();
      return;
    }

    // Respawn on nearest safe Grass row at x = 0 with brief invulnerability
    let safeRow = this.lastSafeRow;
    while (safeRow > this.player.row - 8) {
      const l = this.getLane(safeRow);
      if (l && l.type === LaneType.GRASS) break;
      safeRow--;
    }
    if (!this.getLane(safeRow)) {
      this.lanes.set(safeRow, new CrossyLane(safeRow, LaneType.GRASS, 1));
    }
    this.player.reset(safeRow, 0);
    this.player.invulnerableTimer = 1.6;
    // Follow player cleanly back onto the respawn safe row
    this.cameraRow = Math.max(1.8, safeRow + 1.8);
  }

  _onPlayerLanded(row) {
    const lane = this.getLane(row);
    const landedOnRaft = lane && lane.type === LaneType.RIVER && !!lane.findRaftAt(this.player.x, 15);
    const landColor = landedOnRaft
      ? '#fef3c7'
      : lane && lane.type === LaneType.GRASS
        ? '#86efac'
        : '#cbd5e1';

    this._spawnGroundRipple(this.player.x, row, landColor, landedOnRaft ? 40 : 34);
    this._spawnBurst(this.player.x, row, landColor, 8);
    this.landCameraBounce = 0.15;

    if (this.sound && typeof this.sound.playCrossyLand === 'function') {
      if (!lane || lane.type !== LaneType.RIVER || landedOnRaft) {
        this.sound.playCrossyLand(landedOnRaft);
      }
    }

    if (lane && lane.type === LaneType.GRASS) {
      this.lastSafeRow = Math.max(this.lastSafeRow, row);
    }

    if (row > this.maxRow) {
      const gained = row - this.maxRow;
      this.maxRow = row;

      let pts = gained;
      if (this.streakWindow > 0) {
        this.streak++;
        if (this.streak >= 3) {
          const bonus = Math.min(3, Math.floor(this.streak / 3));
          pts += bonus;
          this._spawnFloatingText(
            `🔥 ${this.streak} STREAK +${pts}`,
            this.player.x,
            row,
            '#facc15'
          );
        }
      } else {
        this.streak = 1;
      }
      this.streakWindow = 1.8;
      this._addScore(pts);
    }

    // Coin pickup check
    if (lane && lane.coin && !lane.coin.collected) {
      if (Math.abs(this.player.x - lane.coin.x) <= 44) {
        lane.coin.collected = true;
        this.coins++;
        this._addScore(5);
        this._spawnBurst(lane.coin.x, row, '#facc15', 14);
        this._spawnFloatingText('⭐ +5 COIN!', lane.coin.x, row, '#fde047');
        if (this.sound && typeof this.sound.playCrossyCoin === 'function') {
          this.sound.playCrossyCoin();
        }
      }
    }
  }

  update(dt, currentTime, headPose = null, poses = null) {
    const safeDt = Math.min(Math.max(dt || 0, 0), 0.1);
    this._updateEffects(safeDt);

    if (this.state !== 'PLAYING') return;

    if (this.streakWindow > 0) {
      this.streakWindow = Math.max(0, this.streakWindow - safeDt);
      if (this.streakWindow <= 0) this.streak = 0;
    }

    // 1. Evaluate Jump / Wing Flap Pose Triggers
    if (this.wingAnimTimer > 0) {
      this.wingAnimTimer = Math.max(0, this.wingAnimTimer - safeDt);
    }
    const poseRes = this.poseController.update(poses, safeDt);
    this.poseState.jumpRatio = poseRes.jumpRatio;
    this.poseState.isWingFlapUp = poseRes.isWingFlapUp;
    this.poseState.wingSpreadRatio = poseRes.wingSpreadRatio;
    if (poseRes.triggerHop) {
      this.triggerHop(poseRes.reason);
    }

    // 2. Update procedural lanes & vehicles/rafts/trains
    this._ensureLanesAhead(this.player.row + 20);
    for (const lane of this.lanes.values()) {
      lane.update(safeDt, (warnLane) => {
        // Play rail warning beep if train lane is near the player viewport
        if (
          Math.abs(warnLane.row - this.player.row) <= 9 &&
          this.sound &&
          typeof this.sound.playCrossyTrainWarn === 'function'
        ) {
          this.sound.playCrossyTrainWarn();
        }
      });
    }

    // 3. Update player hop arc & landing
    const hopRes = this.player.update(safeDt);
    if (hopRes.landed) {
      this._onPlayerLanded(hopRes.row);
      if (this.state !== 'PLAYING') return;
    }

    // 4. Evaluate ground collision & River Raft Drifting when grounded
    if (!this.player.isHopping) {
      const lane = this.getLane(this.player.row);
      if (lane) {
        if (lane.type === LaneType.RIVER) {
          const raft = lane.findRaftAt(this.player.x, 15);
          if (raft) {
            this.player.standingRaft = raft;
            this.player.x += raft.vx * safeDt;

            // Grab coin if drifting into it!
            if (lane.coin && !lane.coin.collected && Math.abs(this.player.x - lane.coin.x) <= 40) {
              lane.coin.collected = true;
              this.coins++;
              this._addScore(5);
              this._spawnBurst(lane.coin.x, this.player.row, '#facc15', 14);
              this._spawnFloatingText('⭐ +5 COIN!', lane.coin.x, this.player.row, '#fde047');
              if (this.sound && typeof this.sound.playCrossyCoin === 'function') {
                this.sound.playCrossyCoin();
              }
            }

            // Drifted off playable screen river border
            if (Math.abs(this.player.x) > WORLD_HALF_WIDTH) {
              this._handleHazardHit('SPLASH');
              return;
            }
          } else {
            this.player.standingRaft = null;
            if (this.player.invulnerableTimer <= 0) {
              this._handleHazardHit('SPLASH');
              return;
            }
          }
        } else {
          this.player.standingRaft = null;
          if (lane.hitsHazard(this.player.x, 16)) {
            this._handleHazardHit('CRASH');
            return;
          }
        }
      }

      // 5. Idle pressure countdown while standing still
      this.idleTimer += safeDt;
      if (this.idleTimer >= this.idleLimit) {
        this._handleHazardHit('IDLE');
        return;
      }
    }

    // 6. Smooth camera row follow
    const desiredCam = Math.max(this.cameraRow, this.player.visualRow + 2.2);
    const camDiff = desiredCam - this.cameraRow;
    this.cameraRow += camDiff * (1 - Math.exp(-7.5 * safeDt));
  }

  _updateEffects(dt) {
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    }
    if (this.landCameraBounce > 0) {
      this.landCameraBounce = Math.max(0, this.landCameraBounce - dt);
    }

    for (let i = this.groundRipples.length - 1; i >= 0; i--) {
      const gr = this.groundRipples[i];
      gr.life -= dt;
      const t = 1 - Math.max(0, gr.life) / gr.maxLife;
      gr.radius = 8 + (gr.maxRadius - 8) * t;
      if (gr.life <= 0) this.groundRipples.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.row += (p.vy * dt) / 70;
      p.z = Math.max(0, p.z + p.vz * dt);
      p.vz -= 420 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.z += 42 * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  /**
   * Projects world (x, row) into 2.5D canvas screen coordinates.
   */
  _worldToScreen(worldX, row) {
    const scaleX = Math.min(1.15, Math.max(0.55, this.width / 1180));
    const laneHeight = Math.max(46, Math.min(68, this.height * 0.09));
    const sx = this.width * 0.5 + worldX * scaleX;
    const sy = this.height * 0.68 - (row - this.cameraRow) * laneHeight;
    return { sx, sy, scaleX, laneHeight };
  }

  render(ctx) {
    if (!ctx) return;
    const w = this.width;
    const h = this.height;

    ctx.save();

    if (this.shakeTimer > 0) {
      const mag = (this.shakeTimer / 0.35) * 10;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    } else if (this.landCameraBounce > 0) {
      const bump = Math.sin((this.landCameraBounce / 0.15) * Math.PI) * 3.5;
      ctx.translate(0, bump);
    }

    // Subtle dark sky/vignette behind world
    ctx.fillStyle = 'rgba(15, 23, 42, 0.52)';
    ctx.fillRect(0, 0, w, h);

    // Determine visible rows top-to-bottom for clean 2.5D painter's order
    const minRow = Math.floor(this.cameraRow - 8);
    const maxRow = Math.ceil(this.cameraRow + 12);

    // 1. Render terrain strips first (top -> bottom)
    for (let r = maxRow; r >= minRow; r--) {
      const lane = this.getLane(r);
      if (lane) {
        this._renderLaneBase(ctx, lane);
      }
    }

    // 2. Render 3D objects, rafts, vehicles, trains, player, coins top-to-bottom
    const playerSortRow = Math.round(this.player.visualRow);
    for (let r = maxRow; r >= minRow; r--) {
      const lane = this.getLane(r);
      if (lane) {
        this._renderLaneObjects(ctx, lane);
      }
      if (r === playerSortRow) {
        this._renderPlayer(ctx);
      }
    }

    // 3. Particles & Floating Texts
    this._renderEffects(ctx);

    // 4. Jump / Manse Sensor HUD + Score/Row Status (non-overlapping top HUD)
    this._renderHUD(ctx);

    ctx.restore();
  }

  _renderLaneBase(ctx, lane) {
    const { sy, scaleX, laneHeight } = this._worldToScreen(0, lane.row);
    const yTop = sy - laneHeight * 0.5;
    const playW = WORLD_HALF_WIDTH * 2 * scaleX;
    const playLeft = this.width * 0.5 - playW * 0.5;

    if (lane.type === LaneType.GRASS) {
      const shade = lane.row % 2 === 0 ? '#4ade80' : '#22c55e';
      ctx.fillStyle = 'rgba(22, 163, 74, 0.65)';
      ctx.fillRect(0, yTop, this.width, laneHeight + 1);
      ctx.fillStyle = shade;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(playLeft, yTop, playW, laneHeight + 1);
      ctx.globalAlpha = 1;
      // Subtle center path strip hint
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(this.width * 0.5 - 26 * scaleX, yTop, 52 * scaleX, laneHeight + 1);
    } else if (lane.type === LaneType.ROAD) {
      ctx.fillStyle = lane.row % 2 === 0 ? '#334155' : '#1e293b';
      ctx.fillRect(0, yTop, this.width, laneHeight + 1);
      // Dashed lane dividers
      ctx.fillStyle = 'rgba(226, 232, 240, 0.38)';
      const dashW = 28 * scaleX;
      for (let dx = 10; dx < this.width; dx += dashW * 2.2) {
        ctx.fillRect(dx, yTop + laneHeight - 4, dashW, 3);
      }
    } else if (lane.type === LaneType.RIVER) {
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, yTop, this.width, laneHeight + 1);
      // Shimmering water highlights + danger banks outside playable river
      ctx.fillStyle = 'rgba(125, 211, 252, 0.3)';
      for (let wx = 20; wx < this.width; wx += 90 * scaleX) {
        ctx.fillRect(wx, sy - 4, 34 * scaleX, 4);
      }
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.fillRect(0, yTop, Math.max(0, playLeft), laneHeight + 1);
      ctx.fillRect(playLeft + playW, yTop, Math.max(0, this.width - (playLeft + playW)), laneHeight + 1);
    } else if (lane.type === LaneType.RAIL) {
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, yTop, this.width, laneHeight + 1);
      // Wooden ties
      ctx.fillStyle = '#78350f';
      for (let rx = 12; rx < this.width; rx += 32 * scaleX) {
        ctx.fillRect(rx, yTop + 6, 10 * scaleX, laneHeight - 12);
      }
      // Twin steel rails
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(0, yTop + 12, this.width, 4);
      ctx.fillRect(0, yTop + laneHeight - 16, this.width, 4);
    }
  }

  _renderLaneObjects(ctx, lane) {
    const { sy, scaleX, laneHeight } = this._worldToScreen(0, lane.row);
    const cx = this.width * 0.5;

    // Decorative side trees/rocks on grass
    for (const d of lane.sideDecor) {
      const dx = cx + d.x * scaleX;
      if (dx < -40 || dx > this.width + 40) continue;
      const s = d.scale * scaleX;
      if (d.kind === 'TREE') {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(dx - 8 * s, sy - 16 * s, 16 * s, 20 * s);
        ctx.fillStyle = '#15803d';
        ctx.fillRect(dx - 24 * s, sy - 54 * s, 48 * s, 40 * s);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(dx - 20 * s, sy - 60 * s, 40 * s, 28 * s);
      } else {
        ctx.fillStyle = '#64748b';
        ctx.fillRect(dx - 18 * s, sy - 18 * s, 36 * s, 24 * s);
      }
    }

    // River Rafts (drifting wooden rafts)
    if (lane.type === LaneType.RIVER) {
      for (const r of lane.rafts) {
        const rx = cx + r.x * scaleX;
        const rw = r.width * scaleX;
        const rh = laneHeight * 0.72;
        ctx.fillStyle = '#78350f';
        ctx.fillRect(rx - rw * 0.5, sy - rh * 0.42, rw, rh);
        ctx.fillStyle = '#b45309';
        ctx.fillRect(rx - rw * 0.5 + 3, sy - rh * 0.5, rw - 6, rh * 0.76);
        // Log bindings
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(rx - rw * 0.34, sy - rh * 0.48, 5 * scaleX, rh * 0.74);
        ctx.fillRect(rx + rw * 0.30, sy - rh * 0.48, 5 * scaleX, rh * 0.74);
      }
    }

    // Coins
    if (lane.coin && !lane.coin.collected) {
      const coinX = cx + lane.coin.x * scaleX;
      const bob = Math.sin(lane.coin.bobPhase) * 5;
      ctx.save();
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(coinX, sy - 16 + bob, 13 * scaleX, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Road Vehicles
    if (lane.type === LaneType.ROAD) {
      for (const v of lane.vehicles) {
        const vx = cx + v.x * scaleX;
        const vw = v.width * scaleX;
        const vh = (v.kind === 'TRUCK' ? 38 : 30) * scaleX;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(vx - vw * 0.5, sy - vh * 0.25, vw, vh * 0.75);
        // Body
        ctx.fillStyle = v.color;
        ctx.fillRect(vx - vw * 0.5, sy - vh * 0.75, vw, vh);
        // Roof cabin
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        const cabW = v.kind === 'TRUCK' ? vw * 0.32 : vw * 0.52;
        const cabX = v.kind === 'TRUCK'
          ? (v.vx > 0 ? vx + vw * 0.14 : vx - vw * 0.46)
          : vx - cabW * 0.5;
        ctx.fillRect(cabX, sy - vh * 0.95, cabW, vh * 0.48);
        // Headlight glow
        ctx.fillStyle = '#fef08a';
        const lightX = v.vx > 0 ? vx + vw * 0.48 : vx - vw * 0.52;
        ctx.fillRect(lightX, sy - vh * 0.55, 6 * scaleX, 10 * scaleX);
      }
    }

    // Rail Signal & High-Speed Train
    if (lane.type === LaneType.RAIL) {
      const warnOn = lane.isRailWarningActive();
      const blink = warnOn && Math.floor(performance.now() / 140) % 2 === 0;
      const sigX = cx - WORLD_HALF_WIDTH * scaleX - 18;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(sigX - 6, sy - 38, 12, 40);
      ctx.fillStyle = warnOn ? (blink ? '#ef4444' : '#7f1d1d') : '#334155';
      ctx.beginPath();
      ctx.arc(sigX, sy - 34, 8, 0, Math.PI * 2);
      ctx.fill();

      if (lane.trainActive) {
        const tx = cx + lane.trainX * scaleX;
        const tw = lane.trainLength * scaleX;
        const th = 46 * scaleX;
        ctx.fillStyle = '#1e40af';
        ctx.fillRect(tx - tw * 0.5, sy - th * 0.85, tw, th);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(tx - tw * 0.5, sy - th * 0.95, tw, th * 0.25);
        // Train windows
        ctx.fillStyle = '#e0f2fe';
        for (let wx = tx - tw * 0.44; wx < tx + tw * 0.44; wx += 36 * scaleX) {
          ctx.fillRect(wx, sy - th * 0.65, 22 * scaleX, 12 * scaleX);
        }
      }
    }
  }

  _renderPlayer(ctx) {
    const p = this.player;
    const { sx, sy, scaleX } = this._worldToScreen(p.x, p.visualRow);

    ctx.save();

    if (p.invulnerableTimer > 0 && Math.floor(p.invulnerableTimer * 12) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    // Ground Shadow shrinks slightly during airborne hop & responds to squash/stretch
    const totalZ = p.arcZ + (p.bounceZ || 0);
    const shadowScale = Math.max(0.55, 1 - totalZ / 90) * Math.max(0.9, p.scaleX || 1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 6, 20 * scaleX * shadowScale, 10 * scaleX * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stylized 2.5D Voxel Chicken Rear View anchored at feet for Squash & Stretch Bounce
    const py = sy - totalZ;
    const s = scaleX;
    const wingLift = this.poseState.isWingFlapUp || this.wingAnimTimer > 0 ? 1 : 0;

    ctx.translate(sx, py);
    ctx.scale(p.scaleX || 1, p.scaleY || 1);

    // Tiny orange feet tucked behind/below
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-9 * s, -2 * s, 5 * s, 5 * s);
    ctx.fillRect(4 * s, -2 * s, 5 * s, 5 * s);

    // Flapping side wings (spread out & up when jumping/flapping)
    ctx.fillStyle = '#f1f5f9';
    if (wingLift) {
      ctx.fillRect(-25 * s, -29 * s, 10 * s, 14 * s);
      ctx.fillRect(15 * s, -29 * s, 10 * s, 14 * s);
      // Feather tips
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-26 * s, -21 * s, 5 * s, 6 * s);
      ctx.fillRect(21 * s, -21 * s, 5 * s, 6 * s);
    } else {
      ctx.fillRect(-20 * s, -22 * s, 5 * s, 15 * s);
      ctx.fillRect(15 * s, -22 * s, 5 * s, 15 * s);
    }

    // Back body block & soft back shading
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-15 * s, -34 * s, 30 * s, 32 * s);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-13 * s, -26 * s, 26 * s, 21 * s);

    // Ninja headband tied cleanly at the back of the head (with trailing tails!)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-16 * s, -30 * s, 32 * s, 6 * s);
    // Headband knot & flowing ribbons on the back of head
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-3 * s, -30 * s, 6 * s, 7 * s);
    ctx.fillRect(-7 * s, -25 * s, 4 * s, 8 * s);
    ctx.fillRect(3 * s, -25 * s, 4 * s, 8 * s);

    // Red comb peeking at crown
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(-5 * s, -42 * s, 10 * s, 8 * s);

    // Fluffy White Tail Feathers prominent at the rear bottom!
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-9 * s, -11 * s, 18 * s, 11 * s);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(-6 * s, -8 * s, 12 * s, 8 * s);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-4 * s, -14 * s, 8 * s, 7 * s);

    ctx.restore();
  }

  _renderEffects(ctx) {
    for (const gr of this.groundRipples) {
      const { sx, sy, scaleX } = this._worldToScreen(gr.x, gr.row);
      const alpha = Math.max(0, gr.life / gr.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeStyle = gr.color;
      ctx.lineWidth = 2.5 * alpha + 1;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 4, gr.radius * scaleX, gr.radius * 0.45 * scaleX, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const pt of this.particles) {
      const { sx, sy } = this._worldToScreen(pt.x, pt.row);
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.fillRect(sx - 3, sy - pt.z - 3, 6, 6);
      ctx.restore();
    }

    for (const ft of this.floatingTexts) {
      const { sx, sy } = this._worldToScreen(ft.x, ft.row);
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '900 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, sx, sy - ft.z);
      ctx.restore();
    }
  }

  _renderHUD(ctx) {
    const w = this.width;
    const h = this.height;

    ctx.save();

    // Bottom-left Live Jump & Wing Flap Input Sensor Gauge (never overlaps top Score/Hearts)
    const panelX = 24;
    const panelY = h - 104;
    const panelW = 264;
    const panelH = 82;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = this.poseState.isWingFlapUp ? '#facc15' : 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🦘 점프 또는 🪽 날개짓 → 전진!', panelX + 12, panelY + 22);

    // Jump progress bar
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(panelX + 12, panelY + 32, panelW - 24, 10);
    const fillRatio = Math.min(1, this.poseState.jumpRatio);
    ctx.fillStyle = fillRatio >= 0.85 ? '#4ade80' : '#38bdf8';
    ctx.fillRect(panelX + 12, panelY + 32, (panelW - 24) * fillRatio, 10);

    // Wing flap indicator + key fallback hint
    ctx.font = '700 11.5px system-ui, sans-serif';
    ctx.fillStyle = this.poseState.isWingFlapUp ? '#facc15' : '#94a3b8';
    ctx.fillText(
      this.poseState.isWingFlapUp ? '🪽 날개 올림 감지! (내렸다 다시 파닥!)' : '[Space / ↑ / 화면 클릭] 점프 가능',
      panelX + 12,
      panelY + 64
    );

    // Bottom-right Distance & Coins badge (cleanly away from top HUD)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#4ade80';
    ctx.font = '900 16px system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(`ROW ${this.maxRow} · ⭐ ${this.coins}`, w - 24, h - 24);

    // Idle Chase Warning Banner (center lower-middle)
    if (this.idleTimer >= 4.5 && this.state === 'PLAYING') {
      const blink = Math.floor(this.idleTimer * 6) % 2 === 0;
      ctx.textAlign = 'center';
      ctx.fillStyle = blink ? '#ef4444' : '#facc15';
      ctx.font = '900 22px system-ui, sans-serif';
      const remain = Math.max(0, this.idleLimit - this.idleTimer).toFixed(1);
      ctx.fillText(`⚠️ 빨리 앞으로 점프하세요! (${remain}s)`, w * 0.5, h - 110);
    }

    ctx.restore();
  }
}
