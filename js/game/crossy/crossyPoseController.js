/**
 * Crossy Mode Pose & Input Controller
 * Dual 1-axis forward triggers:
 *   1. Physical Jump detection (adaptive standing baseline EMA + landing cooldown)
 *   2. Manse (Hands-Up) rising-edge detection (instant response fallback)
 *   3. Shared 0.22s co-trigger deduplication so jumping while raising arms hops ONCE.
 */

export class CrossyPoseController {
  constructor() {
    this.reset();
  }

  reset() {
    this.baseY = null;
    this.jumpCooldown = 0;
    this.waitingForLanding = false;

    this.prevManse = false;
    this.manseCooldown = 0;

    this.sharedHopLock = 0;

    this.lastJumpRatio = 0;
    this.isManseHeld = false;
    this.lastTriggerKind = null;
  }

  /**
   * Checks whether landmarks form a clean Manse (both wrists raised above shoulders).
   */
  isMansePose(landmarks) {
    if (!landmarks || landmarks.length < 17) return false;
    const nose = landmarks[0];
    const ls = landmarks[11];
    const rs = landmarks[12];
    const lw = landmarks[15];
    const rw = landmarks[16];
    if (!ls || !rs || !lw || !rw) return false;

    const visOk = (p) => p && (p.visibility == null || p.visibility > 0.35);
    if (!visOk(lw) || !visOk(rw)) return false;

    const avgShoulderY = (ls.y + rs.y) * 0.5;
    const aboveShoulders = lw.y < avgShoulderY - 0.05 && rw.y < avgShoulderY - 0.05;
    const aboveNose = !nose || (lw.y < nose.y + 0.06 && rw.y < nose.y + 0.06);
    const handsApart = Math.abs(lw.x - rw.x) > 0.10;

    return aboveShoulders && aboveNose && handsApart;
  }

  /**
   * Computes normalized body elevation height (smaller Y in MediaPipe = higher on screen)
   * plus shoulder span scale.
   */
  _extractElevation(landmarks) {
    if (!landmarks || landmarks.length < 13) return null;
    const nose = landmarks[0];
    const ls = landmarks[11];
    const rs = landmarks[12];

    if (ls && rs && (ls.visibility == null || ls.visibility > 0.35) && (rs.visibility == null || rs.visibility > 0.35)) {
      const shoulderMidY = (ls.y + rs.y) * 0.5;
      const bodyY = nose ? nose.y * 0.4 + shoulderMidY * 0.6 : shoulderMidY;
      const shoulderSpan = Math.max(0.08, Math.hypot(ls.x - rs.x, ls.y - rs.y));
      return { bodyY, shoulderSpan };
    }

    if (nose && (nose.visibility == null || nose.visibility > 0.35)) {
      return { bodyY: nose.y, shoulderSpan: 0.16 };
    }
    return null;
  }

  /**
   * Evaluates current pose frame and returns whether a forward hop should trigger.
   * @param {Array<Array>|null} poses
   * @param {number} dt
   * @returns {{ triggerHop: boolean, reason: string|null, jumpRatio: number, isManseHeld: boolean }}
   */
  update(poses, dt = 0.016) {
    const safeDt = Math.min(Math.max(dt || 0, 0), 0.1);

    if (this.jumpCooldown > 0) this.jumpCooldown = Math.max(0, this.jumpCooldown - safeDt);
    if (this.manseCooldown > 0) this.manseCooldown = Math.max(0, this.manseCooldown - safeDt);
    if (this.sharedHopLock > 0) this.sharedHopLock = Math.max(0, this.sharedHopLock - safeDt);

    if (!Array.isArray(poses) || poses.length === 0 || !Array.isArray(poses[0])) {
      return {
        triggerHop: false,
        reason: null,
        jumpRatio: this.lastJumpRatio,
        isManseHeld: this.isManseHeld
      };
    }

    const lm = poses[0];
    let jumpTriggered = false;
    let manseTriggered = false;

    // 1. Jump evaluation via adaptive baseline
    const elev = this._extractElevation(lm);
    if (elev) {
      if (this.baseY === null) {
        this.baseY = elev.bodyY;
      }

      const displacement = this.baseY - elev.bodyY; // positive when rising upward
      const jumpRatio = displacement / elev.shoulderSpan;
      this.lastJumpRatio = Math.max(0, Math.min(1.5, jumpRatio / 0.24));

      if (this.waitingForLanding) {
        // Wait until body returns near standing baseline before re-arming jump
        if (jumpRatio < 0.10 && this.jumpCooldown <= 0) {
          this.waitingForLanding = false;
        }
      } else if (jumpRatio >= 0.24 && this.jumpCooldown <= 0) {
        jumpTriggered = true;
        this.waitingForLanding = true;
        this.jumpCooldown = 0.34;
      } else {
        // Slowly adapt standing baseline only when near neutral resting zone
        if (Math.abs(jumpRatio) < 0.18) {
          const alpha = 1 - Math.exp(-2.2 * safeDt);
          this.baseY += (elev.bodyY - this.baseY) * alpha;
        }
      }
    }

    // 2. Manse evaluation via Rising Edge (must lower hands before next trigger)
    const manseNow = this.isMansePose(lm);
    this.isManseHeld = manseNow;
    if (manseNow && !this.prevManse && this.manseCooldown <= 0) {
      manseTriggered = true;
      this.manseCooldown = 0.24;
    }
    this.prevManse = manseNow;

    // 3. Shared co-trigger deduplication (0.22s lock prevents simultaneous jump + manse double-hop)
    if ((jumpTriggered || manseTriggered) && this.sharedHopLock <= 0) {
      this.sharedHopLock = 0.22;
      const reason = manseTriggered && !jumpTriggered ? 'MANSE' : 'JUMP';
      this.lastTriggerKind = reason;
      return {
        triggerHop: true,
        reason,
        jumpRatio: this.lastJumpRatio,
        isManseHeld: this.isManseHeld
      };
    }

    return {
      triggerHop: false,
      reason: null,
      jumpRatio: this.lastJumpRatio,
      isManseHeld: this.isManseHeld
    };
  }
}
