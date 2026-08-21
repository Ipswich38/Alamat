// The map: Diwata's Awakening.
//
// ── THE SHAPE, AND WHY IT IS THIS SHAPE ─────────────────────────────────────
// Two bases on opposite corners of one diagonal, a river along the other, and
// three lanes between them. That is the standard MOBA layout and it is standard
// because it works: the diagonal makes mid the shortest and most dangerous
// route, the river divides the map into halves that can be won separately, and
// the four wedges the lanes cut out become jungle.
//
// ── THE TWO REALMS ──────────────────────────────────────────────────────────
// Kaluwalhatian, the celestial realm, and Kasamaan, the underworld. They are
// not a reskin of each other: one is warm stone, gold and growing things, the
// other is obsidian, ash and lava. The river between them is the seam, and it
// glows because it is agimat, a charm.
//
// ── WHY THIS FILE HAS NO THREE.JS IN IT ─────────────────────────────────────
// It is the map's TRUTH: where the ground is, what kind it is, what can be
// walked on. The renderer reads it, the collision reads it, and one day the
// bots will read it. A map defined inside a mesh is a map only the renderer
// understands.

/** Half-width of the map. The world runs from -HALF to +HALF on both axes. */
export const HALF = 58;

export type Realm = 'diwata' | 'aswang';

export type Surface =
  /** Walkable lane, paved. Fast. */
  | 'lane'
  /** Open ground between the lanes. Walkable, slower, this is the jungle. */
  | 'jungle'
  /** The river. Walkable, slowest, and it is the dividing line. */
  | 'river'
  /** Base ground, inside the fountain ring. */
  | 'base'
  /** Off the map. */
  | 'void';

export interface Base {
  realm: Realm;
  x: number;
  z: number;
  /** Radius of the base platform. */
  radius: number;
}

// ⚠ THE BASES SIT ON THE MAIN DIAGONAL, THE RIVER ON THE OTHER ONE. The first
// version put them at (-42,42) and (42,-42), and since the river is the line
// x + z = 0, both bases summed to exactly zero: each team's fountain was built
// in the middle of the river, on the seam between the two realms. A base has to
// be as deep inside its own half as the map allows, which is the corner where
// |x + z| is largest.
export const BASES: Record<Realm, Base> = {
  diwata: { realm: 'diwata', x: -42, z: -42, radius: 11 },
  aswang: { realm: 'aswang', x: 42, z: 42, radius: 11 },
};

/**
 * The three lanes, as polylines from the Diwata base to the Aswang base.
 *
 * Top and bottom hug the edges in an L; mid runs the diagonal. Named for the
 * ground they cross rather than for their position on a minimap, because a
 * player calls out "bukid" long before they think about which side of a square
 * it is on.
 */
export const LANES: { id: string; name: string; path: [number, number][] }[] = [
  {
    id: 'top',
    name: 'Bukid',
    // Up the western edge, then east along the north.
    path: [
      [-42, -42],
      [-49, -12],
      [-49, 30],
      [-30, 49],
      [12, 49],
      [42, 42],
    ],
  },
  {
    id: 'mid',
    name: 'Kapatagan',
    path: [
      [-42, -42],
      [-18, -18],
      [0, 0],
      [18, 18],
      [42, 42],
    ],
  },
  {
    id: 'bottom',
    name: 'Baybayin',
    // East along the south, then up the eastern edge.
    path: [
      [-42, -42],
      [-12, -49],
      [30, -49],
      [49, -30],
      [49, 12],
      [42, 42],
    ],
  },
];

/** How wide a lane is, in world units. Wide enough for a fight, not a field. */
export const LANE_WIDTH = 7;

/** Towers, placed along each lane at even intervals. */
export interface Tower {
  realm: Realm;
  lane: string;
  x: number;
  z: number;
  /** 1 is outermost, 3 is the one guarding the base. */
  tier: 1 | 2 | 3;
}

/**
 * The river, as a band along the anti-diagonal.
 *
 * Expressed as a signed distance from the line x + z = 0 rather than as a mesh,
 * so any system can ask "how far into the river is this point" without knowing
 * anything about geometry.
 */
export const RIVER_WIDTH = 9;

export function riverDepth(x: number, z: number): number {
  // Distance from the line x + z = 0, normalised so 1 is the middle of the
  // river and 0 is its bank.
  const d = Math.abs(x + z) / Math.SQRT2;
  return Math.max(0, 1 - d / (RIVER_WIDTH / 2));
}

/** Which realm a point belongs to. The river is the seam. */
export function realmAt(x: number, z: number): Realm {
  return x + z < 0 ? 'diwata' : 'aswang';
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
    // Clamped projection onto the segment, which is what makes a polyline
    // behave like a road with corners rather than like infinite lines.
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    const px = ax + dx * t;
    const pz = az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) best = d;
  }
  return best;
}

/** How far into a lane a point is: 1 at the centre line, 0 at the edge. */
export function laneStrength(x: number, z: number): number {
  let best = 0;
  for (const lane of LANES) {
    const d = laneDistance(x, z, lane.path);
    const k = Math.max(0, 1 - d / (LANE_WIDTH / 2));
    if (k > best) best = k;
  }
  return best;
}

/** What kind of ground is at this point. */
export function surfaceAt(x: number, z: number): Surface {
  if (Math.abs(x) > HALF || Math.abs(z) > HALF) return 'void';
  for (const b of Object.values(BASES)) {
    if (Math.hypot(x - b.x, z - b.z) < b.radius) return 'base';
  }
  if (laneStrength(x, z) > 0) return 'lane';
  if (riverDepth(x, z) > 0) return 'river';
  return 'jungle';
}

/** Movement multiplier per surface. Lanes are the fast way round for a reason. */
export const SURFACE_SPEED: Record<Surface, number> = {
  lane: 1.12,
  base: 1.2,
  jungle: 0.92,
  // Slow enough that crossing the river is a decision, which is what makes the
  // river a real boundary rather than a painted line.
  river: 0.74,
  void: 0,
};

/** Build the towers from the lanes, so moving a lane moves its towers. */
export function buildTowers(): Tower[] {
  const towers: Tower[] = [];
  for (const lane of LANES) {
    // Sampled along the polyline by arc length, so towers are evenly spaced on
    // the ground rather than evenly spaced between corners.
    const pts: [number, number][] = [];
    let total = 0;
    const segs: { a: [number, number]; b: [number, number]; len: number }[] = [];
    for (let i = 0; i < lane.path.length - 1; i++) {
      const a = lane.path[i];
      const b = lane.path[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      segs.push({ a, b, len });
      total += len;
    }
    const at = (frac: number): [number, number] => {
      let want = frac * total;
      for (const s of segs) {
        if (want <= s.len) {
          const t = want / s.len;
          return [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t];
        }
        want -= s.len;
      }
      return lane.path[lane.path.length - 1];
    };
    // Three each side. 0.5 is the middle of the lane and belongs to nobody, so
    // the tiers sit either side of it.
    for (const [frac, realm, tier] of [
      [0.18, 'diwata', 3],
      [0.3, 'diwata', 2],
      [0.42, 'diwata', 1],
      [0.58, 'aswang', 1],
      [0.7, 'aswang', 2],
      [0.82, 'aswang', 3],
    ] as [number, Realm, 1 | 2 | 3][]) {
      const [x, z] = at(frac);
      towers.push({ realm, lane: lane.id, x, z, tier });
      void pts;
    }
  }
  return towers;
}
