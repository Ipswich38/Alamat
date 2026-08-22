// Where a shape lands, answered with numbers only.
//
// ── WHY THIS IS SEPARATE FROM EVERYTHING THAT CALLS IT ──────────────────────
// Nothing here knows what a hero is, what three.js is, or what damage means.
// It answers one question: does this aimed shape cover this point. That is the
// hot path of a game where nothing locks on, it is the part most likely to be
// wrong in a way that is invisible on screen, and it is the only part that can
// be checked by reading it. Mixed into the frame loop it was none of those.
//
// ⚠ EVERY TEST TAKES THE TARGET'S RADIUS, never a bare point. A body is a
// circle, and a skillshot that only hits the exact centre of one feels broken
// in a way players describe as lag.

/** Unit vector for a heading, in the same convention the actors face. */
export function direction(heading: number): { x: number; z: number } {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

/** A rectangle cast forward from a point: the basic attack and every skillshot. */
export function lineHitsPoint(
  sx: number,
  sz: number,
  heading: number,
  range: number,
  halfWidth: number,
  tx: number,
  tz: number,
  targetRadius: number
): boolean {
  const dir = direction(heading);
  const lx = tx - sx;
  const lz = tz - sz;
  const along = lx * dir.x + lz * dir.z;
  if (along < 0 || along > range) return false;
  const lateral = Math.abs(lx * dir.z - lz * dir.x);
  return lateral <= halfWidth + targetRadius;
}

/**
 * The path something travelled between two frames.
 *
 * ⚠ A SEGMENT, NOT THE END POINT. A projectile moving twenty units a second
 * jumps a third of a unit per frame, and a body is only a unit wide: testing
 * where it ARRIVED lets it pass clean through anything it should have hit.
 */
export function segmentHitsPoint(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  tx: number,
  tz: number,
  radius: number
): boolean {
  const vx = bx - ax;
  const vz = bz - az;
  const len2 = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((tx - ax) * vx + (tz - az) * vz) / len2));
  const px = ax + vx * t;
  const pz = az + vz * t;
  return Math.hypot(tx - px, tz - pz) <= radius;
}

/** A wedge in front of the caster. `halfAngle` is radians off the heading. */
export function coneHitsPoint(
  sx: number,
  sz: number,
  heading: number,
  range: number,
  halfAngle: number,
  tx: number,
  tz: number,
  targetRadius: number
): boolean {
  const vx = tx - sx;
  const vz = tz - sz;
  const d = Math.hypot(vx, vz);
  if (d > range + targetRadius || d < 0.001) return d <= targetRadius;
  const dir = direction(heading);
  const dot = Math.max(-1, Math.min(1, ((vx / d) * dir.x) + ((vz / d) * dir.z)));
  // Widens the wedge by however much of it a body of this size subtends at
  // this distance, so a target grazed at the edge counts.
  const padding = Math.asin(Math.min(1, targetRadius / d));
  return Math.acos(dot) <= halfAngle + padding;
}
