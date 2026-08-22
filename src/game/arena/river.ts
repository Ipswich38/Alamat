// The Pasig Agimat: the river, its trough, and the three ways across it.
//
// ── WHY THE RIVER IS A SIGNED DISTANCE AND NOT A MESH ───────────────────────
// Everything wants to ask a different question of it. The renderer asks how
// deep the ground is here. Movement asks whether this is river (it is slow).
// Combat will ask which half of the map a fight is happening in. All three
// answers come from one number: how far this point is from the line the river
// runs along. A river defined as geometry can only answer the first.
//
// ── AND WHY IT RUNS ALONG x = z ─────────────────────────────────────────────
// The brief puts it north-west to south-east. With north as -z and west as -x,
// that is the line where x equals z, and it is exactly perpendicular to the mid
// lane running south-west to north-east between the bases. Perpendicular is the
// point: the river divides the two halves a team can win separately.

import { LANES, type LaneId } from './lanes';

/** How wide the river is, bank to bank. */
export const RIVER_WIDTH = 22;

/** How far the trough is cut below the surrounding ground. */
export const RIVER_DEPTH = 2;

/**
 * How far into the river a point is: 1 at the centre line, 0 at the bank.
 *
 * Distance from the line x - z = 0, which is |x - z| / sqrt(2).
 */
export function riverDepth(x: number, z: number): number {
  const d = Math.abs(x - z) / Math.SQRT2;
  return Math.max(0, 1 - d / (RIVER_WIDTH / 2));
}

/** Ground height from the river alone. Zero outside it, -RIVER_DEPTH inside. */
export function riverFloor(x: number, z: number): number {
  const t = riverDepth(x, z);
  if (t <= 0) return 0;
  // Smoothstepped, so the bank is a slope you walk down rather than a step you
  // fall off. A hard edge here reads as a trench, not a river.
  return -RIVER_DEPTH * (t * t * (3 - 2 * t));
}

/** Which side of the river a point is on. The two halves of the map. */
export function riverSide(x: number, z: number): 'anito' | 'malakas' {
  return x - z < 0 ? 'anito' : 'malakas';
}

export interface Crossing {
  lane: LaneId;
  x: number;
  z: number;
  /** Bearing of the lane where it crosses, so a bridge lies along it. */
  bearing: number;
  /** Half-length of the trigger zone along the lane. */
  radius: number;
}

/**
 * Where each lane crosses the river.
 *
 * ⚠ FOUND BY WALKING THE LANE, NOT TYPED IN. Three hand-written coordinates
 * would be wrong the first time a lane moved, and wrong invisibly: the bridge
 * would still be drawn, just no longer under the road. Each lane is sampled and
 * the crossing is the point where `x - z` changes sign.
 */
export function findCrossings(): Crossing[] {
  const out: Crossing[] = [];

  for (const lane of LANES) {
    // Sampled densely along the whole polyline, which handles a lane that
    // crosses at a corner as easily as one that crosses mid-segment.
    const pts: [number, number][] = [];
    for (let i = 0; i < lane.path.length - 1; i++) {
      const a = lane.path[i];
      const b = lane.path[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const steps = Math.max(2, Math.ceil(len / 0.5));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    pts.push(lane.path[lane.path.length - 1]);

    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1][0] - pts[i - 1][1];
      const here = pts[i][0] - pts[i][1];
      if (prev === 0 || Math.sign(prev) === Math.sign(here)) continue;
      const [x, z] = pts[i];
      // The lane's direction here, so the bridge lies along the road rather
      // than across it.
      const back = pts[Math.max(0, i - 4)];
      const fwd = pts[Math.min(pts.length - 1, i + 4)];
      out.push({
        lane: lane.id,
        x,
        z,
        bearing: Math.atan2(fwd[0] - back[0], fwd[1] - back[1]),
        radius: RIVER_WIDTH / 2 + 3,
      });
      break;
    }
  }

  return out;
}

const CROSSINGS = findCrossings();

/** Is this point on a bridge? Bridges are dry, level and fast. */
export function onCrossing(x: number, z: number): Crossing | null {
  for (const c of CROSSINGS) {
    if (Math.hypot(x - c.x, z - c.z) <= c.radius) return c;
  }
  return null;
}

/**
 * Ground height including bridges.
 *
 * A bridge holds the ground at zero across the trough, which is the entire
 * reason to build one: without it a lane dips two units into a river and the
 * crossing is a scramble instead of a road.
 */
export function groundHeight(x: number, z: number): number {
  return onCrossing(x, z) ? 0 : riverFloor(x, z);
}

/** Movement multiplier. Wading is slow; a bridge is not. */
export function riverSpeed(x: number, z: number): number {
  if (onCrossing(x, z)) return 1;
  const t = riverDepth(x, z);
  // Slow enough that crossing outside a bridge is a decision, which is what
  // makes the bridges worth contesting.
  return t > 0 ? 1 - 0.32 * t : 1;
}
