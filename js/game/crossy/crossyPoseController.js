/**
 * Crossy Mode Pose & Input Controller
 * Dual 1-axis forward triggers:
 *   1. Physical Jump detection (adaptive standing baseline EMA + landing cooldown)
 *   2. Wing Flap (날개짓) cycle detection (arms spread outward + DOWN -> UP lift)
 *   3. Shared 0.22s co-trigger deduplication so jumping while flapping hops ONCE.
 */

export class CrossyPoseController {
  constructor() {
    this.reset();
  }

  reset() {
    this.baseY = null;
    this.jumpCooldown = 0;
    this.waitingForLanding = false;

    // Wing flap state: 'DOWN' (ready) -> 'UP' (triggers hop!) -> must return 'DOWN' before next flap
    this.wingPhase = 'DOWN';
    this.flapCooldown = 0;

    this.sharedHopLock = 0;

    this.lastJumpRatio = 0;
    this.isWingFlapUp = false;
    this.wingSpreadRatio = 0;
    this.lastTriggerKind = null;
  }

  /**
   * Checks wing posture relative to shoulders:
   * - UP: Both wrists spread wider than shoulders and lifted to/above shoulder band (flap lift)
   * - DOWN: Both wrists lowered comfortably below shoulders (reset for next flap)
   */
  evaluateWings(landmarks) {
    if (!landmarks || landmarks.length < 17) {
      return { isUp: false, isDown: false, spreadRatio: 0 };
    }
    const ls = landmarks[11];
    const rs = landmarks[12];
    const lw = landmarks[15];
    const rw = landmarks[16];
    if (!ls || !rs || !lw || !rw) {
      return { isUp: false, isDown: false, spreadRatio: 0 };
    }

    const visOk = (p) => p && (p.visibility == null || p.visibility > 0.35);
    if (!visOk(lw) || !visOk(rw)) {
      return { isUp: false, isDown: false, spreadRatio: 0 };
    }

    const avgShoulderY = (ls.y + rs.y) * 0.5;
    const shoulderSpan = Math.max(0.08, Math.hypot(ls.x - rs.x, ls.y - rs.y));
    const wristDist = Math.abs(lw.x - rw.x);
    const spreadRatio = wristDist / shoulderSpan;

    // Outward spread wing-up posture (shoulder level or higher, comfortable range)
    const armsSpreadOut = wristDist >= Math.max(0.22, shoulderSpan * 1.2);
    const wristsLifted = lw.y <= avgShoulderY + 0.05 && rw.y <= avgShoulderY + 0.05;
    const isUp = armsSpreadOut && wristsLifted;

    // Arms lowered below shoulder band resets the flap cycle
    const isDown = lw.y >= avgShoulderY + 0.11 && rw.y >= avgShoulderY + 0.11;

    return { isUp, isDown, spreadRatio };
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

    if (
      ls &&
      rs &&
      (ls.visibility == null || ls.visibility > 0.35) &&
      (rs.visibility == null || rs.visibility > 0.35)
    ) {
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
   */
  update(poses, dt = 0.016) {
    const safeDt = Math.min(Math.max(dt || 0, 0), 0.1);

    if (this.jumpCooldown > 0) this.jumpCooldown = Math.max(0, this.jumpCooldown - safeDt);
    if (this.flapCooldown > 0) this.flapCooldown = Math.max(0, this.flapCooldown - safeDt);
    if (this.sharedHopLock > 0) this.sharedHopLock = Math.max(0, this.sharedHopLock - safeDt);

    if (!Array.isArray(poses) || poses.length === 0 || !Array.isArray(poses[0])) {
      return {
        triggerHop: false,
        reason: null,
        jumpRatio: this.lastJumpRatio,
        isWingFlapUp: this.isWingFlapUp,
        wingSpreadRatio: this.wingSpreadRatio
      };
    }

    const lm = poses[0];
    let jumpTriggered = false;
    let flapTriggered = false;

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
        if (jumpRatio < 0.10 && this.jumpCooldown <= 0) {
          this.waitingForLanding = false;
        }
      } else if (jumpRatio >= 0.24 && this.jumpCooldown <= 0) {
        jumpTriggered = true;
        this.waitingForLanding = true;
        this.jumpCooldown = 0.34;
      } else {
        if (Math.abs(jumpRatio) < 0.18) {
          const alpha = 1 - Math.exp(-2.2 * safeDt);
          this.baseY += (elev.bodyY - this.baseY) * alpha;
        }
      }
    }

    // 2. Wing Flap cycle evaluation (DOWN -> UP triggers hop; must drop to DOWN to re-arm)
    const wing = this.evaluateWings(lm);
    this.isWingFlapUp = wing.isUp;
    this.wingSpreadRatio = wing.spreadRatio;

    if (this.wingPhase === 'DOWN') {
      if (wing.isUp && this.flapCooldown <= 0) {
        flapTriggered = true;
        this.wingPhase = 'UP';
        this.flapCooldown = 0.22;
      }
    } else if (wing.isDown) {
      this.wingPhase = 'DOWN';
    }

    // 3. Shared co-trigger deduplication (0.22s lock prevents simultaneous jump + flap double-hop)
    if ((jumpTriggered || flapTriggered) && this.sharedHopLock <= 0) {
      this.sharedHopLock = 0.22;
      const reason = flapTriggered && !jumpTriggered ? 'FLAP' : 'JUMP';
      this.lastTriggerKind = reason;
      return {
        triggerHop: true,
        reason,
        jumpRatio: this.lastJumpRatio,
        isWingFlapUp: this.isWingFlapUp,
        wingSpreadRatio: this.wingSpreadRatio
      };
    }

    return {
      triggerHop: false,
      reason: null,
      jumpRatio: this.lastJumpRatio,
      isWingFlapUp: this.isWingFlapUp,
      wingSpreadRatio: this.wingSpreadRatio
    };
  }
}
