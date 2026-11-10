/**
 * 2D Vector & Collision Mathematics for Pose Ninja Fruit
 */

/**
 * Calculates squared distance between two points
 */
export function distanceSquared(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return dx * dx + dy * dy;
}

/**
 * Calculates Euclidean distance between two points
 */
export function distance(p1, p2) {
  return Math.sqrt(distanceSquared(p1, p2));
}

/**
 * Checks if a line segment AB intersects with a circle at center C with radius R.
 * Also supports touch padding for generous touch-to-slice detection and stationary hand touches.
 * 
 * @param {{x: number, y: number}} p1 - Start of blade segment
 * @param {{x: number, y: number}} p2 - End of blade segment
 * @param {{x: number, y: number, radius: number}} circle - Fruit bounding circle
 * @param {number} [touchPadding=0] - Additional touch radius padding around hand/fruit
 * @returns {{hit: boolean, closestPoint?: {x: number, y: number}, normal?: {x: number, y: number}, cutAngle?: number}}
 */
export function checkSegmentCircleCollision(p1, p2, circle, touchPadding = 0) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;
  const effectiveRadius = (circle.radius || 0) + touchPadding;

  // Handle case where p1 and p2 are practically identical (stationary hand or single touch)
  if (lenSq < 0.0001) {
    const dSq = distanceSquared(p1, circle);
    if (dSq <= effectiveRadius * effectiveRadius) {
      return {
        hit: true,
        closestPoint: { x: p1.x, y: p1.y },
        normal: { x: 0, y: -1 },
        cutAngle: (Math.random() - 0.5) * (Math.PI / 3)
      };
    }
    return { hit: false };
  }

  // Projection parameter t of circle center onto segment AB
  // t = ((C - A) . (B - A)) / |B - A|^2
  const t = ((circle.x - p1.x) * dx + (circle.y - p1.y) * dy) / lenSq;

  // Clamp t to segment bounds [0, 1]
  const clampedT = Math.max(0, Math.min(1, t));

  // Closest point on segment AB to circle center C
  const closestPoint = {
    x: p1.x + clampedT * dx,
    y: p1.y + clampedT * dy
  };

  const distSq = distanceSquared(closestPoint, circle);

  if (distSq <= effectiveRadius * effectiveRadius) {
    // Slicing angle in radians along the cut direction
    const cutAngle = lenSq > 1 ? Math.atan2(dy, dx) : (Math.random() - 0.5) * (Math.PI / 3);

    // Normal vector perpendicular to the cut direction (for separating fruit halves)
    const segLength = Math.sqrt(lenSq);
    const unitDx = segLength > 0.001 ? dx / segLength : 0;
    const unitDy = segLength > 0.001 ? dy / segLength : -1;

    // Normal vector pointing 90 degrees clockwise
    const normal = {
      x: -unitDy,
      y: unitDx
    };

    return {
      hit: true,
      closestPoint,
      normal,
      cutAngle
    };
  }

  return { hit: false };
}
