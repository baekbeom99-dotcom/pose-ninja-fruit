/**
 * Crossy Mode Entities & Procedural Terrain Lanes
 * Supports 1-axis forward hopping + 방안 1 River Raft Drift & Auto-Center on Safe Land.
 */

export const LaneType = {
  GRASS: 'GRASS',
  ROAD: 'ROAD',
  RIVER: 'RIVER',
  RAIL: 'RAIL'
};

export const WORLD_HALF_WIDTH = 420;
export const TILE_SIZE = 74;

const CAR_COLORS = ['#ef4444', '#38bdf8', '#facc15', '#a855f7', '#fb923c', '#22d3ee'];

export class CrossyLane {
  constructor(row, type = LaneType.GRASS, difficulty = 1, options = {}) {
    this.row = row;
    this.type = type;
    this.difficulty = difficulty;

    this.vehicles = [];
    this.rafts = [];
    this.sideDecor = [];
    this.coin = null;

    // Rail state
    this.railTimer = options.initialRailPhase != null ? options.initialRailPhase : Math.random() * 4.5;
    this.railCycle = Math.max(3.6, 5.8 - difficulty * 0.14);
    this.railWarnLead = 1.45;
    this.trainDir = options.dir != null ? options.dir : (Math.random() < 0.5 ? 1 : -1);
    this.trainActive = false;
    this.trainX = 0;
    this.trainSpeed = 1350 + difficulty * 45;
    this.trainLength = 520;
    this.warnTriggeredThisCycle = false;

    this.dir = options.dir != null ? options.dir : (Math.random() < 0.5 ? 1 : -1);
    this._populate(options);
  }

  _populate(options) {
    // Always place decorative trees/rocks strictly OUTSIDE playable corridor [-WORLD_HALF_WIDTH, +WORLD_HALF_WIDTH]
    // so drifting on a raft never traps the player behind an obstacle on land!
    if (this.type === LaneType.GRASS) {
      [-510, -595, 510, 595].forEach((tx) => {
        if (Math.random() < 0.72) {
          this.sideDecor.push({
            x: tx + (Math.random() - 0.5) * 32,
            kind: Math.random() < 0.78 ? 'TREE' : 'ROCK',
            scale: 0.85 + Math.random() * 0.35
          });
        }
      });

      if (this.row > 2 && Math.random() < 0.34) {
        // Place grass coins strictly within reachable central corridor [-18..+18]
        this.coin = {
          x: (Math.random() - 0.5) * 36,
          raftIndex: null,
          collected: false,
          bobPhase: Math.random() * Math.PI * 2
        };
      }
    } else if (this.type === LaneType.ROAD) {
      const speedBase = (155 + Math.min(260, this.difficulty * 14)) * (0.9 + Math.random() * 0.25);
      const vx = this.dir * speedBase;
      const count = options.vehicleCount || (this.difficulty > 5 && Math.random() < 0.4 ? 3 : 2);
      const wrapSpan = WORLD_HALF_WIDTH * 2 + 460; // ~1300px loop

      for (let i = 0; i < count; i++) {
        const isTruck = Math.random() < 0.32;
        const w = isTruck ? 136 : 78;
        const spacing = wrapSpan / count;
        const x = -wrapSpan / 2 + i * spacing + (Math.random() - 0.5) * 40;
        this.vehicles.push({
          x,
          width: w,
          vx,
          kind: isTruck ? 'TRUCK' : 'CAR',
          color: CAR_COLORS[(this.row + i) % CAR_COLORS.length]
        });
      }
    } else if (this.type === LaneType.RIVER) {
      const speedBase = (105 + Math.min(135, this.difficulty * 9)) * (0.9 + Math.random() * 0.22);
      const vx = this.dir * speedBase;
      const count = options.raftCount || 3;
      const wrapSpan = WORLD_HALF_WIDTH * 2 + 480;

      for (let i = 0; i < count; i++) {
        const w = Math.max(138, 185 - Math.min(35, this.difficulty * 2.5));
        const spacing = wrapSpan / count;
        const x = -wrapSpan / 2 + i * spacing + (Math.random() - 0.5) * 30;
        this.rafts.push({
          x,
          width: w,
          vx
        });
      }

      if (this.rafts.length > 0 && Math.random() < 0.48) {
        // Ride coin squarely on top of a raft so there are no unreachable floating coins over water
        const raftIndex = Math.floor(Math.random() * this.rafts.length);
        this.coin = {
          x: this.rafts[raftIndex].x,
          raftIndex,
          collected: false,
          bobPhase: Math.random() * Math.PI * 2
        };
      }
    }
  }

  update(dt, onTrainWarn = null) {
    const wrapLimit = WORLD_HALF_WIDTH + 240;

    if (this.type === LaneType.ROAD) {
      for (const v of this.vehicles) {
        v.x += v.vx * dt;
        if (v.vx > 0 && v.x - v.width / 2 > wrapLimit) {
          v.x = -wrapLimit - v.width / 2;
        } else if (v.vx < 0 && v.x + v.width / 2 < -wrapLimit) {
          v.x = wrapLimit + v.width / 2;
        }
      }
    } else if (this.type === LaneType.RIVER) {
      for (const r of this.rafts) {
        r.x += r.vx * dt;
        if (r.vx > 0 && r.x - r.width / 2 > wrapLimit) {
          r.x = -wrapLimit - r.width / 2;
        } else if (r.vx < 0 && r.x + r.width / 2 < -wrapLimit) {
          r.x = wrapLimit + r.width / 2;
        }
      }
    } else if (this.type === LaneType.RAIL) {
      if (this.trainActive) {
        this.trainX += this.trainDir * this.trainSpeed * dt;
        if (
          (this.trainDir > 0 && this.trainX - this.trainLength / 2 > wrapLimit + 200) ||
          (this.trainDir < 0 && this.trainX + this.trainLength / 2 < -wrapLimit - 200)
        ) {
          this.trainActive = false;
          this.railTimer = 0;
          this.warnTriggeredThisCycle = false;
        }
      } else {
        this.railTimer += dt;
        const warnStart = this.railCycle - this.railWarnLead;
        if (this.railTimer >= warnStart && !this.warnTriggeredThisCycle) {
          this.warnTriggeredThisCycle = true;
          if (typeof onTrainWarn === 'function') {
            onTrainWarn(this);
          }
        }
        if (this.railTimer >= this.railCycle) {
          this.trainActive = true;
          this.trainX =
            this.trainDir > 0
              ? -wrapLimit - this.trainLength * 0.6
              : wrapLimit + this.trainLength * 0.6;
        }
      }
    }

    if (this.coin && !this.coin.collected) {
      if (this.type === LaneType.RIVER && this.coin.raftIndex != null && this.rafts[this.coin.raftIndex]) {
        this.coin.x = this.rafts[this.coin.raftIndex].x;
      }
      this.coin.bobPhase += dt * 4.5;
    }
  }

  isRailWarningActive() {
    if (this.type !== LaneType.RAIL) return false;
    if (this.trainActive) return true;
    return this.railTimer >= this.railCycle - this.railWarnLead;
  }

  findRaftAt(playerX, footMargin = 14) {
    if (this.type !== LaneType.RIVER) return null;
    for (const r of this.rafts) {
      const half = r.width * 0.5 + footMargin;
      if (playerX >= r.x - half && playerX <= r.x + half) {
        return r;
      }
    }
    return null;
  }

  hitsHazard(playerX, playerHalfW = 16) {
    if (this.type === LaneType.ROAD) {
      for (const v of this.vehicles) {
        const half = v.width * 0.5 - 6;
        if (playerX + playerHalfW > v.x - half && playerX - playerHalfW < v.x + half) {
          return true;
        }
      }
    } else if (this.type === LaneType.RAIL && this.trainActive) {
      const half = this.trainLength * 0.5 - 10;
      if (playerX + playerHalfW > this.trainX - half && playerX - playerHalfW < this.trainX + half) {
        return true;
      }
    }
    return false;
  }
}

export class CrossyPlayer {
  constructor() {
    this.x = 0;
    this.row = 0;
    this.visualRow = 0;
    this.arcZ = 0;

    this.isHopping = false;
    this.hopProgress = 0;
    this.hopDuration = 0.17;
    this.hopStartRow = 0;
    this.hopTargetRow = 0;
    this.hopStartX = 0;
    this.hopTargetX = 0;

    this.invulnerableTimer = 0;
    this.standingRaft = null;

    // Squash & Stretch + Landing Bounce animation state
    this.scaleX = 1;
    this.scaleY = 1;
    this.bounceTimer = 0;
    this.bounceDuration = 0.24;
    this.bounceZ = 0;
  }

  reset(row = 0, x = 0) {
    this.x = x;
    this.row = row;
    this.visualRow = row;
    this.arcZ = 0;
    this.isHopping = false;
    this.hopProgress = 0;
    this.hopStartRow = row;
    this.hopTargetRow = row;
    this.hopStartX = x;
    this.hopTargetX = x;
    this.standingRaft = null;
    this.scaleX = 1;
    this.scaleY = 1;
    this.bounceTimer = 0;
    this.bounceZ = 0;
  }

  /**
   * Starts a 1-row forward hop.
   * Implements 방안 1: preserves drifted X when leaping off a river raft,
   * and gently auto-centers X toward 0 when hopping from solid land.
   */
  startHop(currentLaneType = LaneType.GRASS) {
    if (this.isHopping) return false;

    this.isHopping = true;
    this.hopProgress = 0;
    this.hopStartRow = this.row;
    this.hopTargetRow = this.row + 1;
    this.hopStartX = this.x;
    this.standingRaft = null;
    this.bounceTimer = 0;
    this.bounceZ = 0;
    // Takeoff anticipation stretch
    this.scaleX = 0.84;
    this.scaleY = 1.24;

    if (currentLaneType === LaneType.RIVER) {
      // Keep exact drifted X when jumping forward from a moving raft
      this.hopTargetX = this.x;
    } else {
      // Smoothly converge back toward center corridor on solid ground hops
      this.hopTargetX = Math.abs(this.x) <= 22 ? 0 : this.x * 0.42;
    }
    return true;
  }

  update(dt) {
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    }

    if (!this.isHopping) {
      this.visualRow = this.row;
      this.arcZ = 0;

      if (this.bounceTimer > 0) {
        this.bounceTimer = Math.max(0, this.bounceTimer - dt);
        const phase = 1 - this.bounceTimer / this.bounceDuration; // 0 -> 1
        const decay = Math.exp(-5.0 * phase);
        const squashWave = Math.cos(phase * Math.PI * 2.5);
        this.scaleX = 1 + 0.32 * decay * squashWave;
        this.scaleY = 1 - 0.30 * decay * squashWave;
        // Little elastic rebound hop right after impact squash
        this.bounceZ = phase > 0.18 && phase < 0.72
          ? Math.sin(((phase - 0.18) / 0.54) * Math.PI) * 7
          : 0;
      } else {
        this.scaleX = 1;
        this.scaleY = 1;
        this.bounceZ = 0;
      }
      return { landed: false };
    }

    this.hopProgress += dt / this.hopDuration;
    if (this.hopProgress >= 1) {
      this.isHopping = false;
      this.hopProgress = 0;
      this.row = this.hopTargetRow;
      this.visualRow = this.row;
      this.x = this.hopTargetX;
      this.arcZ = 0;
      // Trigger landing squash & bounce rebound
      this.bounceTimer = this.bounceDuration;
      this.scaleX = 1.32;
      this.scaleY = 0.68;
      this.bounceZ = 0;
      return { landed: true, row: this.row, x: this.x };
    }

    const p = this.hopProgress;
    this.visualRow = this.hopStartRow + (this.hopTargetRow - this.hopStartRow) * p;
    this.x = this.hopStartX + (this.hopTargetX - this.hopStartX) * p;
    // Parabolic jump arc
    this.arcZ = Math.sin(p * Math.PI) * 34;

    // Mid-air squash & stretch: tall launch -> neutral apex -> pre-land stretch
    if (p < 0.35) {
      const k = 1 - p / 0.35;
      this.scaleX = 1 - 0.16 * k;
      this.scaleY = 1 + 0.24 * k;
    } else if (p > 0.72) {
      const k = (p - 0.72) / 0.28;
      this.scaleX = 1 - 0.10 * k;
      this.scaleY = 1 + 0.14 * k;
    } else {
      this.scaleX = 1;
      this.scaleY = 1;
    }

    return { landed: false };
  }
}
