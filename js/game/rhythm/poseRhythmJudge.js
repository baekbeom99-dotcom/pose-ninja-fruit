/**
 * Pose & Hand Motion Judge for Rhythm Mode
 * Evaluates wrist segment collisions, directional slash velocity vectors,
 * head/nose dodge zones, and minimized Manse fever triggers.
 */

import { checkSegmentCircleCollision } from '../collision.js';
import { DodgeZone, SlashDirection } from './chartGenerator.js';

const DIR_VECTORS = {
  [SlashDirection.LEFT]: { x: -1, y: 0 },
  [SlashDirection.RIGHT]: { x: 1, y: 0 },
  [SlashDirection.UP]: { x: 0, y: -1 },
  [SlashDirection.DOWN]: { x: 0, y: 1 }
};

export class PoseRhythmJudge {
  constructor() {
    this.prevLeft = null;
    this.prevRight = null;
  }

  reset() {
    this.prevLeft = null;
    this.prevRight = null;
  }

  /**
   * Converts MediaPipe normalized [0..1] landmarks + optional pointer segments
   * into canvas-space segment objects with displacement vectors.
   */
  extractHandSegments(poses, width, height, mirror = true, externalSegments = []) {
    const segments = [];

    if (Array.isArray(poses) && poses.length > 0 && Array.isArray(poses[0])) {
      const lm = poses[0];
      const mapPoint = (pt) => ({
        x: (mirror ? 1 - pt.x : pt.x) * width,
        y: pt.y * height
      });

      const leftWrist = lm[15];
      if (leftWrist && (leftWrist.visibility == null || leftWrist.visibility > 0.35)) {
        const curr = mapPoint(leftWrist);
        const prev = this.prevLeft || curr;
        segments.push({ p1: prev, p2: curr, hand: 'LEFT' });
        this.prevLeft = curr;
      } else {
        this.prevLeft = null;
      }

      const rightWrist = lm[16];
      if (rightWrist && (rightWrist.visibility == null || rightWrist.visibility > 0.35)) {
        const curr = mapPoint(rightWrist);
        const prev = this.prevRight || curr;
        segments.push({ p1: prev, p2: curr, hand: 'RIGHT' });
        this.prevRight = curr;
      } else {
        this.prevRight = null;
      }
    } else {
      this.prevLeft = null;
      this.prevRight = null;
    }

    if (Array.isArray(externalSegments)) {
      externalSegments.forEach((seg) => {
        if (seg && seg.p1 && seg.p2) {
          segments.push({ p1: seg.p1, p2: seg.p2, hand: seg.bladeName || 'POINTER' });
        }
      });
    }

    return segments;
  }

  /**
   * Computes canvas-space head center {x, y} from MediaPipe nose or fallback head pose.
   */
  extractHeadPosition(poses, lastHeadPose, width, height, mirror = true) {
    let raw = null;
    if (Array.isArray(poses) && poses.length > 0 && poses[0] && poses[0][0]) {
      raw = poses[0][0];
    } else if (lastHeadPose) {
      raw = lastHeadPose;
    }
    if (!raw) return null;

    return {
      x: (mirror ? 1 - raw.x : raw.x) * width,
      y: raw.y * height
    };
  }

  /**
   * Checks whether any active hand segment enters or sweeps through a target circle.
   */
  checkTapHit(targetCircle, handSegments, touchPadding = 24) {
    for (const seg of handSegments) {
      const res = checkSegmentCircleCollision(seg.p1, seg.p2, targetCircle, touchPadding);
      if (res.hit) {
        return { hit: true, seg, closestPoint: res.closestPoint };
      }
    }
    return { hit: false };
  }

  /**
   * Checks directional slash note: hand must intersect the target zone AND move
   * generally in the requested arrow direction (with forgiving angular tolerance).
   */
  checkSlashHit(targetCircle, direction, handSegments, touchPadding = 32, minMovePx = 6) {
    const expected = DIR_VECTORS[direction];
    for (const seg of handSegments) {
      const res = checkSegmentCircleCollision(seg.p1, seg.p2, targetCircle, touchPadding);
      if (!res.hit) continue;

      const dx = seg.p2.x - seg.p1.x;
      const dy = seg.p2.y - seg.p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < minMovePx) continue;

      if (!expected) {
        return { hit: true, seg, closestPoint: res.closestPoint };
      }

      const dot = (dx / len) * expected.x + (dy / len) * expected.y;
      // dot >= 0.20 allows roughly +-78 degree cone for comfortable webcam swiping
      if (dot >= 0.2) {
        return { hit: true, seg, closestPoint: res.closestPoint };
      }
    }
    return { hit: false };
  }

  /**
   * Checks whether head/nose stays clear of a dodge barrier hazard zone.
   * If camera head tracking is unavailable, returns safe=true so mouse-only users aren't unfairly penalized.
   */
  checkDodgeSafe(dodgeZone, headPos, width, height) {
    if (!headPos) return { safe: true, reason: 'no_head_pose' };

    if (dodgeZone === DodgeZone.LEFT) {
      // Hazard occupies left side x < 0.44 * width
      return { safe: headPos.x >= width * 0.44 };
    }
    if (dodgeZone === DodgeZone.RIGHT) {
      // Hazard occupies right side x > 0.56 * width
      return { safe: headPos.x <= width * 0.56 };
    }
    if (dodgeZone === DodgeZone.TOP) {
      // Hazard occupies upper beam y < 0.45 * height
      return { safe: headPos.y >= height * 0.45 };
    }
    return { safe: true };
  }

  /**
   * Checks minimized Chorus Fever Pose (Manse: both wrists raised clearly above nose).
   */
  checkMansePose(poses) {
    if (!Array.isArray(poses) || poses.length === 0 || !Array.isArray(poses[0])) {
      return false;
    }
    const lm = poses[0];
    const nose = lm[0];
    const lw = lm[15];
    const rw = lm[16];
    if (!nose || !lw || !rw) return false;

    const visOk =
      (lw.visibility == null || lw.visibility > 0.35) &&
      (rw.visibility == null || rw.visibility > 0.35);
    if (!visOk) return false;

    const bothAboveHead = lw.y < nose.y - 0.03 && rw.y < nose.y - 0.03;
    const handsApart = Math.abs(lw.x - rw.x) > 0.1;
    return bothAboveHead && handsApart;
  }
}
