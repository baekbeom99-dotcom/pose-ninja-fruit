/**
 * Pose & Hand Motion Judge for Rhythm Mode
 * Supports body-centered 5-sector semicircular hitboxes with angular gaps,
 * wrist segment swept collision, directional slash vectors, head dodge zones,
 * and minimized Manse fever triggers.
 */

import { checkSegmentCircleCollision } from '../collision.js';
import { DodgeZone, SlashDirection, SEMICIRCLE_SECTOR_COUNT } from './chartGenerator.js';

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
   * Computes smoothed body-center anchor & semicircular arch radii from MediaPipe pose.
   * Uses shoulder midpoint + torso offset (and hips when visible), clamped so all
   * 5 semicircular hitboxes fit inside the visible canvas.
   */
  computeBodyAnchor(poses, prevAnchor, width, height, mirror = true, dt = 0.016) {
    const outerRadius = Math.max(190, Math.min(width * 0.43, height * 0.58));
    const bandWidth = Math.max(110, Math.min(185, outerRadius * 0.48));
    const innerRadius = Math.max(46, outerRadius - bandWidth);
    const midRadius = (innerRadius + outerRadius) * 0.5;

    const minX = outerRadius + 24;
    const maxX = Math.max(minX, width - outerRadius - 24);
    const minY = outerRadius + 76;
    const maxY = Math.max(minY, height - 28);

    const clampAnchor = (x, y) => ({
      cx: Math.max(minX, Math.min(maxX, x)),
      cy: Math.max(minY, Math.min(maxY, y)),
      innerRadius,
      outerRadius,
      midRadius,
      bandWidth
    });

    const fallback = clampAnchor(width * 0.5, height * 0.72);

    let target = null;
    if (Array.isArray(poses) && poses.length > 0 && Array.isArray(poses[0])) {
      const lm = poses[0];
      const mapPt = (pt) => ({
        x: (mirror ? 1 - pt.x : pt.x) * width,
        y: pt.y * height
      });

      const ls = lm[11];
      const rs = lm[12];
      const lh = lm[23];
      const rh = lm[24];
      const visOk = (p) => p && (p.visibility == null || p.visibility > 0.35);

      if (visOk(ls) && visOk(rs)) {
        const pLs = mapPt(ls);
        const pRs = mapPt(rs);
        const shoulderMidX = (pLs.x + pRs.x) * 0.5;
        const shoulderMidY = (pLs.y + pRs.y) * 0.5;
        const shoulderSpan = Math.hypot(pLs.x - pRs.x, pLs.y - pRs.y);

        let bodyY = shoulderMidY + Math.max(55, shoulderSpan * 0.42);
        let bodyX = shoulderMidX;

        if (visOk(lh) && visOk(rh)) {
          const pLh = mapPt(lh);
          const pRh = mapPt(rh);
          const hipMidX = (pLh.x + pRh.x) * 0.5;
          const hipMidY = (pLh.y + pRh.y) * 0.5;
          bodyX = shoulderMidX * 0.65 + hipMidX * 0.35;
          bodyY = shoulderMidY * 0.55 + hipMidY * 0.45;
        }

        target = clampAnchor(bodyX, bodyY);
      } else if (visOk(lm[0])) {
        const nose = mapPt(lm[0]);
        target = clampAnchor(nose.x, nose.y + outerRadius * 0.48);
      }
    }

    if (!target) {
      target = prevAnchor ? clampAnchor(prevAnchor.cx, prevAnchor.cy) : fallback;
      return target;
    }

    if (!prevAnchor || dt <= 0) {
      return target;
    }

    const alpha = 1 - Math.exp(-8.5 * Math.min(dt, 0.1));
    return clampAnchor(
      prevAnchor.cx + (target.cx - prevAnchor.cx) * alpha,
      prevAnchor.cy + (target.cy - prevAnchor.cy) * alpha
    );
  }

  /**
   * Tests whether a canvas point (px, py) lies inside an annular sector hitbox,
   * strictly preserving the angular gaps between adjacent sectors.
   */
  isPointInSector(px, py, sector, radialPad = 14) {
    const dx = px - sector.cx;
    const dy = py - sector.cy;
    const r = Math.hypot(dx, dy);

    if (r < sector.innerRadius - radialPad || r > sector.outerRadius + radialPad) {
      return false;
    }

    // Raw atan2 returns (-PI, PI]; map upper arch (dy <= 0) to [PI, 2*PI]
    let theta = Math.atan2(dy, dx);
    if (theta < 0) {
      theta += Math.PI * 2;
    }

    // Allow small outer-horizon extension only on leftmost bottom edge (id 0) and rightmost bottom edge (last)
    const isFirst = sector.id === 0;
    const isLast = sector.id === SEMICIRCLE_SECTOR_COUNT - 1;
    const outerHorizonTol = 0.08;

    // Normalize wrap near 0/2*PI for last sector bottom edge (small positive dy -> theta just > 0)
    if (isLast && theta >= 0 && theta <= outerHorizonTol) {
      return true;
    }
    // Near PI positive dy (dy > 0 on left side -> theta just < PI) for first sector
    if (isFirst && theta >= Math.PI - outerHorizonTol && theta <= Math.PI) {
      return true;
    }

    return theta >= sector.startAngle && theta <= sector.endAngle;
  }

  /**
   * Sweeps a hand movement segment against an annular sector hitbox so fast swings
   * cannot tunnel through sector arcs while strictly respecting inter-sector gaps.
   */
  checkSegmentSectorCollision(p1, p2, sector, radialPad = 14) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const segLen = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(segLen / 8));

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const sx = p1.x + dx * t;
      const sy = p1.y + dy * t;
      if (this.isPointInSector(sx, sy, sector, radialPad)) {
        return { hit: true, closestPoint: { x: sx, y: sy } };
      }
    }
    return { hit: false };
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
   * Checks whether any active hand segment enters a sector hitbox (or fallback circle).
   */
  checkTapHit(targetHitbox, handSegments, touchPadding = 16) {
    const isSector =
      targetHitbox &&
      typeof targetHitbox.startAngle === 'number' &&
      typeof targetHitbox.endAngle === 'number';

    for (const seg of handSegments) {
      const res = isSector
        ? this.checkSegmentSectorCollision(seg.p1, seg.p2, targetHitbox, touchPadding)
        : checkSegmentCircleCollision(seg.p1, seg.p2, targetHitbox, touchPadding);
      if (res.hit) {
        return { hit: true, seg, closestPoint: res.closestPoint };
      }
    }
    return { hit: false };
  }

  /**
   * Checks directional slash note: hand must intersect the sector hitbox AND move
   * generally in the requested arrow direction (with forgiving angular tolerance).
   */
  checkSlashHit(targetHitbox, direction, handSegments, touchPadding = 20, minMovePx = 6) {
    const expected = DIR_VECTORS[direction];
    const isSector =
      targetHitbox &&
      typeof targetHitbox.startAngle === 'number' &&
      typeof targetHitbox.endAngle === 'number';

    for (const seg of handSegments) {
      const res = isSector
        ? this.checkSegmentSectorCollision(seg.p1, seg.p2, targetHitbox, touchPadding)
        : checkSegmentCircleCollision(seg.p1, seg.p2, targetHitbox, touchPadding);
      if (!res.hit) continue;

      const dx = seg.p2.x - seg.p1.x;
      const dy = seg.p2.y - seg.p1.y;
      const len = Math.hypot(dx, dy);
      if (len < minMovePx) continue;

      if (!expected) {
        return { hit: true, seg, closestPoint: res.closestPoint };
      }

      const dot = (dx / len) * expected.x + (dy / len) * expected.y;
      if (dot >= 0.2) {
        return { hit: true, seg, closestPoint: res.closestPoint };
      }
    }
    return { hit: false };
  }

  /**
   * Checks whether head/nose stays clear of a dodge barrier hazard zone.
   */
  checkDodgeSafe(dodgeZone, headPos, width, height) {
    if (!headPos) return { safe: true, reason: 'no_head_pose' };

    if (dodgeZone === DodgeZone.LEFT) {
      return { safe: headPos.x >= width * 0.44 };
    }
    if (dodgeZone === DodgeZone.RIGHT) {
      return { safe: headPos.x <= width * 0.56 };
    }
    if (dodgeZone === DodgeZone.TOP) {
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
