// The jungle: what blocks you, and what hides you.
//
// ── TWO DIFFERENT THINGS, DELIBERATELY SEPARATE ─────────────────────────────
// A BARRIER stops a body and blocks sight. A BRUSH stops neither: you walk into
// it and you are concealed. Conflating them is the classic way to ruin a jungle,
// because the tactical value of brush is entirely that you can be standing in
// it and the enemy cannot know, which requires it to be passable.
//
// ── WHY BARRIERS HAVE GAPS ──────────────────────────────────────────────────
// A jungle sealed off from its lanes is scenery. Every barrier here is a line
// with a hole in the middle, and that hole is the entrance a player takes when
// they decide to leave the lane. The gap IS the gameplay; the trees are what
// makes the decision visible.

import { LANE_WIDTH, laneDistance, LANES } from './lanes';

export interface Barrier {
  id: string;
  /** Both ends of the tree line. */
  from: [number, number];
  to: [number, number];
  /** How thick the line is: bodies inside this are pushed out. */
  thickness: number;
  /** Half-width of the gap at the midpoint, in units. Zero for a solid line. */
  gap: number;
}

export interface Brush {
  id: string;
  x: number;
  z: number;
  radius: number;
}

/**
 * The barriers, in mirrored pairs.
 *
 * They run parallel to the mid lane, one either side, which is what separates
 * the middle of the map from the two jungle halves and gives each half a shape.
 */
export const BARRIERS: Barrier[] = [
  // ⚠ PARALLEL TO MID, NOT ACROSS IT. The first version ran these along the
  // (1,1) diagonal, which is PERPENDICULAR to the mid lane, so both barriers
  // cut the middle of the map in half and made mid impassable. The audit caught
  // it; a screenshot would not have, because a tree line across a lane looks
  // exactly like a tree line beside one.
  {
    id: 'mid-north',
    from: [-38.2, 4.2],
    to: [4.2, -38.2],
    thickness: 5,
    gap: 7,
  },
  {
    id: 'mid-south',
    from: [-4.2, 38.2],
    to: [38.2, -4.2],
    thickness: 5,
    gap: 7,
  },
  // Shorter lines closing the outer corners of each jungle, so a quadrant is a
  // room with doors rather than an open field.
  { id: 'outer-north', from: [-70, -46], to: [-46, -70], thickness: 5, gap: 6 },
  { id: 'outer-south', from: [70, 46], to: [46, 70], thickness: 5, gap: 6 },
];

/**
 * Brush pockets. Mirrored, and placed where an ambush is worth setting: beside
 * a lane, and on the approach to a camp.
 */
export const BRUSH: Brush[] = [
  { id: 'brush-nw-lane', x: -34, z: -34, radius: 7 },
  { id: 'brush-se-lane', x: 34, z: 34, radius: 7 },
  { id: 'brush-nw-camp', x: -56, z: -30, radius: 6 },
  { id: 'brush-se-camp', x: 56, z: 30, radius: 6 },
  { id: 'brush-sw-camp', x: -30, z: 56, radius: 6 },
  { id: 'brush-ne-camp', x: 30, z: -56, radius: 6 },
];

/** Distance from a point to a segment, and how far along it that lands. */
function toSegment(
  x: number,
  z: number,
  a: [number, number],
  b: [number, number]
): { distance: number; t: number; px: number; pz: number } {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / len2));
  const px = a[0] + dx * t;
  const pz = a[1] + dz * t;
  return { distance: Math.hypot(x - px, z - pz), t, px, pz };
}

/** Is this point inside a barrier, allowing for the body's own width? */
export function insideBarrier(x: number, z: number, radius = 0): boolean {
  for (const b of BARRIERS) {
    const { distance, t, px, pz } = toSegment(x, z, b.from, b.to);
    if (distance > b.thickness / 2 + radius) continue;
    if (b.gap > 0) {
      // The gap sits at the midpoint. Measured in world units along the line,
      // not as a fraction of it, so a long barrier and a short one have the
      // same size door.
      const mid: [number, number] = [(b.from[0] + b.to[0]) / 2, (b.from[1] + b.to[1]) / 2];
      if (Math.hypot(px - mid[0], pz - mid[1]) < b.gap) continue;
    }
    void t;
    return true;
  }
  return false;
}

/**
 * Push a body out of a barrier, perpendicular to the line.
 *
 * Sliding rather than stopping, for the same reason the walls do it: a body
 * that halts on contact catches and reads as the game ignoring input.
 */
export function resolveJungle(x: number, z: number, radius: number): { x: number; z: number } {
  for (const b of BARRIERS) {
    const { distance, px, pz } = toSegment(x, z, b.from, b.to);
    const push = b.thickness / 2 + radius;
    if (distance > push) continue;
    if (b.gap > 0) {
      const mid: [number, number] = [(b.from[0] + b.to[0]) / 2, (b.from[1] + b.to[1]) / 2];
      if (Math.hypot(px - mid[0], pz - mid[1]) < b.gap) continue;
    }
    const d = distance || 0.0001;
    return { x: px + ((x - px) / d) * push, z: pz + ((z - pz) / d) * push };
  }
  return { x, z };
}

/** Which brush a point is standing in, or null. Passable: this only conceals. */
export function brushAt(x: number, z: number): Brush | null {
  for (const b of BRUSH) {
    if (Math.hypot(x - b.x, z - b.z) <= b.radius) return b;
  }
  return null;
}

/**
 * Check nothing in the jungle sits on a lane.
 *
 * A barrier across a lane makes that lane impassable and a brush on one lets a
 * player vanish mid-fight in the middle of the road. Both look fine on screen.
 */
export function auditJungle(): string[] {
  const problems: string[] = [];
  const clear = LANE_WIDTH / 2;

  for (const b of BARRIERS) {
    // Sampled along the line, because a segment can miss a lane at both ends
    // and cross it in the middle.
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const x = b.from[0] + (b.to[0] - b.from[0]) * t;
      const z = b.from[1] + (b.to[1] - b.from[1]) * t;
      for (const lane of LANES) {
        if (laneDistance(x, z, lane.path) < clear + b.thickness / 2) {
          problems.push(`${b.id} crosses the ${lane.id} lane`);
          i = 99;
          break;
        }
      }
    }
  }

  for (const br of BRUSH) {
    for (const lane of LANES) {
      if (laneDistance(br.x, br.z, lane.path) < clear + br.radius) {
        problems.push(`${br.id} overlaps the ${lane.id} lane`);
      }
    }
    if (!BRUSH.some((o) => Math.abs(o.x + br.x) < 0.01 && Math.abs(o.z + br.z) < 0.01)) {
      problems.push(`${br.id} has no mirror, so the jungle is unbalanced`);
    }
  }

  return [...new Set(problems)];
}
