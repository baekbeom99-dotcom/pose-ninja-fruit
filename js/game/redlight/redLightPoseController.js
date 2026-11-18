/**
 * Red Light, Green Light ("무궁화 꽃이 피었습니다") Pose & Motion Controller
 *
 * Extracts three distinct, webcam-resilient signals from MediaPipe Pose landmarks:
 *   1. In-place Running Intensity (`runIntensity`): normalized limb & body bounce velocity
 *   2. Red-Light Motion Detection (`motionMeter` / `motionDetected`): drift + velocity vs freeze anchor after human reaction grace
 *   3. Manse Touch Gesture (`isManse`): both wrists raised high above shoulders/head to tag Young-hee
 */

const TRACKED_RUN_INDICES = [
  { idx: 0, weight: 0.7 },   // nose vertical bounce
  { idx: 11, weight: 0.8 },  // left shoulder
  { idx: 12, weight: 0.8 },  // right shoulder
  { idx: 13, weight: 1.0 },  // left elbow
  { idx: 14, weight: 1.0 },  // right elbow
  { idx: 15, weight: 1.4 },  // left wrist (arm pump)
  { idx: 16, weight: 1.4 },  // right wrist (arm pump)
  { idx: 23, weight: 0.7 },  // left hip
  { idx: 24, weight: 0.7 },  // right hip
  { idx: 25, weight: 1.2 },  // left knee
  { idx: 26, weight: 1.2 },  // right knee
  { idx: 27, weight: 1.1 },  // left ankle
  { idx: 28, weight: 1.1 }   // right ankle
];

const FREEZE_INDICES = [0, 11, 12, 13, 14, 15, 16];

function isVisible(pt) {
  return pt && (pt.visibility === undefined || pt.visibility > 0.35);
}

export class RedLightPoseController {
  constructor() {
    this.reset();
  }

  reset() {
    this.prevFrame = null;
    this.freezeAnchor = null;
    this.graceTimer = 0;

    this.runIntensity = 0;
    this.motionMeter = 0;
    this.isManse = false;
    this.manualStepPulse = 0;
    this.manualMansePulse = 0;
  }

  triggerManualStep(strength = 0.95) {
    this.manualStepPulse = Math.max(this.manualStepPulse, strength);
  }

  triggerManualManse() {
    this.manualMansePulse = 0.25;
  }

  startFreezeCheck(graceSeconds = 0.28) {
    this.graceTimer = graceSeconds;
    this.freezeAnchor = null;
    this.motionMeter = 0;
  }

  clearFreezeCheck() {
    this.graceTimer = 0;
    this.freezeAnchor = null;
    this.motionMeter = Math.max(0, this.motionMeter * 0.5);
  }

  _getShoulderSpan(landmarks) {
    const ls = landmarks[11];
    const rs = landmarks[12];
    if (isVisible(ls) && isVisible(rs)) {
      return Math.max(0.08, Math.hypot(ls.x - rs.x, ls.y - rs.y));
    }
    return 0.18;
  }

  evaluateManse(landmarks) {
    if (!landmarks || landmarks.length < 17) return false;
    const nose = landmarks[0];
    const ls = landmarks[11];
    const rs = landmarks[12];
    const lw = landmarks[15];
    const rw = landmarks[16];
    if (!isVisible(ls) || !isVisible(rs) || !isVisible(lw) || !isVisible(rw)) {
      return false;
    }

    const wristsAboveShoulders = lw.y < ls.y - 0.04 && rw.y < rs.y - 0.04;
    const wristsNearOrAboveHead = !isVisible(nose) || (lw.y < nose.y + 0.06 && rw.y < nose.y + 0.06);
    return wristsAboveShoulders && wristsNearOrAboveHead;
  }

  _snapshotFreezeAnchor(landmarks) {
    const anchor = {};
    for (const idx of FREEZE_INDICES) {
      const pt = landmarks[idx];
      if (isVisible(pt)) {
        anchor[idx] = { x: pt.x, y: pt.y };
      }
    }
    this.freezeAnchor = anchor;
  }

  update(poses, dt = 0.016, isRedLight = false) {
    const safeDt = Math.max(0.001, Math.min(dt || 0.016, 0.1));

    // Decay manual fallback pulses smoothly
    if (this.manualStepPulse > 0) {
      this.manualStepPulse = Math.max(0, this.manualStepPulse - safeDt * 3.0);
    }
    if (this.manualMansePulse > 0) {
      this.manualMansePulse = Math.max(0, this.manualMansePulse - safeDt);
    }

    const lm = Array.isArray(poses) && poses.length > 0 && Array.isArray(poses[0]) ? poses[0] : null;
    if (!lm) {
      this.runIntensity = Math.max(this.manualStepPulse, this.runIntensity * Math.exp(-safeDt * 8));
      this.isManse = this.manualMansePulse > 0;

      if (isRedLight) {
        if (this.graceTimer > 0) {
          this.graceTimer = Math.max(0, this.graceTimer - safeDt);
        } else if (this.manualStepPulse > 0.35) {
          // Pressing Space / tapping while RED_LIGHT counts as moving!
          this.motionMeter = Math.min(1.0, this.motionMeter + safeDt * 6.5);
        } else {
          this.motionMeter = Math.max(0, this.motionMeter - safeDt * 1.5);
        }
      } else {
        this.motionMeter = 0;
      }

      return {
        runIntensity: this.runIntensity,
        motionMeter: this.motionMeter,
        motionDetected: isRedLight && this.motionMeter >= 1.0,
        isManse: this.isManse,
        inGracePeriod: isRedLight && this.graceTimer > 0
      };
    }

    const span = this._getShoulderSpan(lm);

    // 1. Compute normalized frame-to-frame body velocity for in-place running & jitter checks
    let weightedDisp = 0;
    let totalWeight = 0;
    if (this.prevFrame) {
      for (const { idx, weight } of TRACKED_RUN_INDICES) {
        const cur = lm[idx];
        const prev = this.prevFrame[idx];
        if (isVisible(cur) && prev) {
          const dist = Math.hypot(cur.x - prev.x, cur.y - prev.y) / span;
          // Prioritize dynamic running axes (vertical bounce + limb swing)
          weightedDisp += dist * weight;
          totalWeight += weight;
        }
      }
    }

    const nextPrev = {};
    for (const { idx } of TRACKED_RUN_INDICES) {
      if (isVisible(lm[idx])) {
        nextPrev[idx] = { x: lm[idx].x, y: lm[idx].y };
      }
    }
    this.prevFrame = nextPrev;

    const frameSpeed = totalWeight > 0 ? weightedDisp / totalWeight / safeDt : 0;

    // Noise deadzone: ignore tiny standing sway < 0.28 shoulder-widths/sec
    const activeRunSample = Math.max(0, Math.min(1.0, (frameSpeed - 0.28) / 1.45));
    const targetRun = Math.max(activeRunSample, this.manualStepPulse);

    if (targetRun >= this.runIntensity) {
      this.runIntensity += (targetRun - this.runIntensity) * Math.min(1, safeDt * 14);
    } else {
      // Smoothly carry momentum briefly between strides so running looks natural
      this.runIntensity += (targetRun - this.runIntensity) * Math.min(1, safeDt * 6.5);
    }

    // 2. Manse pose check
    this.isManse = this.evaluateManse(lm) || this.manualMansePulse > 0;

    // 3. Red Light freeze violation detector
    let motionDetected = false;
    if (isRedLight) {
      if (this.graceTimer > 0) {
        this.graceTimer = Math.max(0, this.graceTimer - safeDt);
        if (this.graceTimer === 0) {
          this._snapshotFreezeAnchor(lm);
        }
      } else {
        if (!this.freezeAnchor) {
          this._snapshotFreezeAnchor(lm);
        }

        let maxDrift = 0;
        let avgDrift = 0;
        let count = 0;
        for (const idx of FREEZE_INDICES) {
          const pt = lm[idx];
          const anc = this.freezeAnchor[idx];
          if (isVisible(pt) && anc) {
            const d = Math.hypot(pt.x - anc.x, pt.y - anc.y) / span;
            avgDrift += d;
            if (d > maxDrift) maxDrift = d;
            count++;
          }
        }
        avgDrift = count > 0 ? avgDrift / count : 0;

        // Moving hands/head noticeably away from freeze anchor OR sudden speed bursts fail!
        const overDrift = maxDrift > 0.22 || avgDrift > 0.14;
        const overSpeed = frameSpeed > 1.25 || this.manualStepPulse > 0.35;

        if (overDrift || overSpeed) {
          const severity = Math.max(
            overDrift ? (maxDrift - 0.18) * 18 : 0,
            overSpeed ? (frameSpeed - 0.9) * 5.0 : 0,
            this.manualStepPulse > 0.35 ? 8.0 : 0
          );
          this.motionMeter = Math.min(1.0, this.motionMeter + Math.max(3.5, severity) * safeDt);
        } else {
          this.motionMeter = Math.max(0, this.motionMeter - safeDt * 1.6);
        }

        motionDetected = this.motionMeter >= 1.0;
      }
    } else {
      this.motionMeter = 0;
    }

    return {
      runIntensity: this.runIntensity,
      motionMeter: this.motionMeter,
      motionDetected,
      isManse: this.isManse,
      inGracePeriod: isRedLight && this.graceTimer > 0
    };
  }
}
