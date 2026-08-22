// The three lanes, and the towers standing on them.
//
// ── WHY THE TOWERS COME FROM THE LANES ──────────────────────────────────────
// Tower positions are DERIVED by walking each lane, never typed in. A hand-kept
// list of 22 coordinates drifts the moment a lane moves, and the drift is
// invisible: the towers still draw, they are just no longer on the road they
// are supposed to guard. Sampling by arc length also means towers are evenly
// spaced on the GROUND rather than evenly spaced between corners, which is not
// the same thing on a lane that bends.
//
// ── THE SHAPE ───────────────────────────────────────────────────────────────
// Bases sit south-west and north-east. Mid runs the diagonal between them; top
// goes north up the western edge then east along the northern one; bottom goes
// east along the south then north up the east. That is the standard MOBA
// layout, and it is standard because the diagonal makes mid the shortest and
// most dangerous route while the edges are long and safe.

import { HALF, TEAMS, type TeamId } from './nexus';

export type LaneId = 'top' | 'mid' | 'bottom';

export interface Lane {
  id: LaneId;
  name: string;
  /** From the Anito base to the Malakas base. */
  path: [number, number][];
}

const A = TEAMS.anito;
const M = TEAMS.malakas;
/** How far from the map edge the outer lanes run. */
const EDGE = HALF - 14;

export const LANES: Lane[] = [
  {
    id: 'top',
    name: 'Bukid',
    path: [
      [A.x, A.z],
      [-EDGE, 20],
      [-EDGE, -EDGE],
      [-20, -EDGE],
      [M.x, M.z],
    ],
  },
  {
    id: 'mid',
    name: 'Kapatagan',
    path: [
      [A.x, A.z],
      [-30, 30],
      [0, 0],
      [30, -30],
      [M.x, M.z],
    ],
  },
  {
    id: 'bottom',
    name: 'Baybayin',
    path: [
      [A.x, A.z],
      [-20, EDGE],
      [EDGE, EDGE],
      [EDGE, -20],
      [M.x, M.z],
    ],
  },
];

/** How wide a lane is. Wide enough for a five-hero fight, not a field. */
export const LANE_WIDTH = 14;

export type Tier = 1 | 2 | 3;

export interface TowerNode {
  id: string;
  team: TeamId;
  lane: LaneId | 'nexus';
  tier: Tier;
  x: number;
  z: number;
  /** Half-extent of the hitbox, in units. The brief asks for 3 by 3. */
  hitbox: number;
  /** How far it can shoot. */
  range: number;
}

/** Half of the 3x3 hitbox from the brief. */
const HITBOX = 1.5;
/** Range collider radius, from the brief. */
const RANGE = 12;

/** Walk a polyline and return the point a given fraction along its length. */
function along(path: [number, number][], frac: number): [number, number] {
  const segs: { a: [number, number]; b: [number, number]; len: number }[] = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, b, len });
    total += len;
  }
  let want = frac * total;
  for (const s of segs) {
    if (want <= s.len) {
      const t = s.len === 0 ? 0 : want / s.len;
      return [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t];
    }
    want -= s.len;
  }
  return path[path.length - 1];
}

/**
 * All 22 tower positions: 3 per lane per team, plus 2 flanking each nexus.
 *
 * ⚠ TIER 1 IS THE OUTERMOST, which means it is the one FURTHEST from its own
 * base and closest to the middle. Reading it the other way round puts the
 * high-ground base tower out on the river, which is the sort of mistake that
 * looks fine on screen and breaks every rule about pushing a lane.
 */
export function buildTowers(): TowerNode[] {
  const out: TowerNode[] = [];

  for (const lane of LANES) {
    // 0.5 is the middle of the lane and belongs to nobody, so the tiers sit
    // either side of it, tier 1 nearest the middle.
    for (const [frac, team, tier] of [
      [0.2, 'anito', 3],
      [0.31, 'anito', 2],
      [0.42, 'anito', 1],
      [0.58, 'malakas', 1],
      [0.69, 'malakas', 2],
      [0.8, 'malakas', 3],
    ] as [number, TeamId, Tier][]) {
      const [x, z] = along(lane.path, frac);
      out.push({
        id: `${team}-${lane.id}-t${tier}`,
        team,
        lane: lane.id,
        tier,
        x,
        z,
        hitbox: HITBOX,
        range: RANGE,
      });
    }
  }

  // The two nexus towers per team, set either side of the line running from the
  // base toward the centre of the map: the last thing standing before the core.
  for (const team of Object.values(TEAMS)) {
    const toCentre = Math.atan2(-team.x, -team.z);
    for (const [i, side] of [-1, 1].entries()) {
      const a = toCentre + (side * Math.PI) / 3.4;
      out.push({
        id: `${team.id}-nexus-${i}`,
        team: team.id,
        lane: 'nexus',
        tier: 3,
        x: team.x + Math.sin(a) * 26,
        z: team.z + Math.cos(a) * 26,
        hitbox: HITBOX,
        range: RANGE,
      });
    }
  }

  return out;
}

/** Shortest distance from a point to a lane's centre line. */
export function laneDistance(x: number, z: number, path: [number, number][]): number {
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i];
    const [bx, bz] = path[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    // Clamped projection, which is what makes a polyline behave like a road
    // with corners rather than like a set of infinite lines.
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) best = d;
  }
  return best;
}

/** Is this point on a lane? Used by the ground shading and by movement. */
export function onLane(x: number, z: number): boolean {
  return LANES.some((l) => laneDistance(x, z, l.path) < LANE_WIDTH / 2);
}
