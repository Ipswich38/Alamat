// The base perimeters, and the three ways through each one.
//
// ── WHY THE GATES ARE COMPUTED FROM THE LANES ───────────────────────────────
// A gate is not a place, it is the ANSWER to "where does this lane leave the
// base". Typing three angles per team in by hand would look identical on the
// first day and be wrong the first time a lane moves, and wrong in the worst
// possible way: a wall with no opening onto a lane makes that lane unreachable
// and the bug reads as "the map is broken" rather than as "a number is stale".
//
// So each gate's bearing comes from the direction its lane actually leaves the
// base. Move a lane and its gate follows.
//
// ── WHY IT IS A RING AND NOT A POLYGON ──────────────────────────────────────
// Collision against an arc is one distance and one angle. Collision against a
// polygon is a segment test per edge, per actor, per frame, for a shape nobody
// will ever notice is round. The cheap version is also the one that never has a
// corner an actor can wedge itself into.

import { LANES } from './lanes';
import { SANCTUARY_RADIUS, TEAMS, type TeamId } from './nexus';

/**
 * How far out the wall sits from the base centre.
 *
 * Outside the sanctuary, so a team standing on its own core is inside its own
 * walls with room to spare, and far enough that the gates are real corridors
 * rather than notches cut in a fence.
 */
export const WALL_RADIUS = SANCTUARY_RADIUS + 12;

/** How thick the barrier is. A body is stopped inside this band. */
export const WALL_THICKNESS = 2.2;

/** How wide each gate is, in radians. Roughly a lane's width at this radius. */
const GATE_ARC = 0.34;

export interface Gate {
  team: TeamId;
  lane: string;
  /** Bearing from the base centre, in radians, matching Math.atan2(dx, dz). */
  bearing: number;
  arc: number;
}

/** Where each lane leaves each base. */
export function buildGates(): Gate[] {
  const out: Gate[] = [];
  for (const team of Object.values(TEAMS)) {
    for (const lane of LANES) {
      // The lane's path runs Dawn to Dusk, so Dawn reads the second point
      // and Dusk reads the second from last: both are asking "which way does
      // this road go when it leaves MY door".
      const next = team.id === 'dawn' ? lane.path[1] : lane.path[lane.path.length - 2];
      out.push({
        team: team.id,
        lane: lane.id,
        bearing: Math.atan2(next[0] - team.x, next[1] - team.z),
        arc: GATE_ARC,
      });
    }
  }
  return out;
}

const GATES = buildGates();

/** Shortest angular distance between two bearings, in radians. */
function angleGap(a: number, b: number): number {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

/**
 * Is this point inside a wall?
 *
 * Called per actor per frame, so it is deliberately two square roots and a
 * handful of comparisons.
 */
export function insideWall(x: number, z: number, radius = 0): boolean {
  for (const team of Object.values(TEAMS)) {
    const dx = x - team.x;
    const dz = z - team.z;
    const d = Math.hypot(dx, dz);
    if (Math.abs(d - WALL_RADIUS) > WALL_THICKNESS / 2 + radius) continue;

    // In the band. It only blocks if this bearing is not a gate.
    const bearing = Math.atan2(dx, dz);
    const open = GATES.some(
      (g) => g.team === team.id && angleGap(g.bearing, bearing) < g.arc / 2
    );
    if (!open) return true;
  }
  return false;
}

/**
 * Push a body out of a wall it is standing in.
 *
 * Pushed along the RADIUS, to whichever side it was already closer to, so
 * walking into a wall slides you along it rather than stopping you dead. A body
 * that stops on contact catches on things and reads as the game ignoring input.
 */
export function resolveWalls(
  x: number,
  z: number,
  radius: number
): { x: number; z: number } {
  for (const team of Object.values(TEAMS)) {
    const dx = x - team.x;
    const dz = z - team.z;
    const d = Math.hypot(dx, dz) || 0.0001;
    const push = WALL_THICKNESS / 2 + radius;
    if (Math.abs(d - WALL_RADIUS) > push) continue;

    const bearing = Math.atan2(dx, dz);
    if (GATES.some((g) => g.team === team.id && angleGap(g.bearing, bearing) < g.arc / 2)) {
      continue;
    }

    const target = d < WALL_RADIUS ? WALL_RADIUS - push : WALL_RADIUS + push;
    return { x: team.x + (dx / d) * target, z: team.z + (dz / d) * target };
  }
  return { x, z };
}

/**
 * The solid stretches of each perimeter, as arcs to be filled with fence.
 *
 * Returned as spans rather than as posts so the renderer decides how many
 * sections fit, which keeps section length a rendering concern.
 */
export function wallSpans(): { team: TeamId; from: number; to: number }[] {
  const spans: { team: TeamId; from: number; to: number }[] = [];
  for (const team of Object.values(TEAMS)) {
    const gates = GATES.filter((g) => g.team === team.id)
      .map((g) => g.bearing)
      .sort((a, b) => a - b);
    for (let i = 0; i < gates.length; i++) {
      const from = gates[i] + GATE_ARC / 2;
      // Wraps round to the first gate on the last pass, which is what closes
      // the ring: without it every perimeter has one permanent hole.
      const to = (i === gates.length - 1 ? gates[0] + Math.PI * 2 : gates[i + 1]) - GATE_ARC / 2;
      if (to > from) spans.push({ team: team.id, from, to });
    }
  }
  return spans;
}
