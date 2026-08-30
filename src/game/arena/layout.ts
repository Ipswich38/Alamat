// The ground you fight on.
//
// ── WHY ONE ARENA AND NOT A THREE-LANE MAP ──────────────────────────────────
// A lane map only makes sense with ten players in it. This game is built to be
// playable with nobody else online (see the note in game/ai on asynchronous
// opponents), so the unit of play is a bounded duel arena that works for a bot
// fight, a ghost of another player's hero, and the tutorial without changing.
//
// ── WHY COVER IS THE WHOLE DESIGN ───────────────────────────────────────────
// Every ability in this game is aimed and none of them lock on. That only
// matters if there is something to break line of sight with and something to
// dodge behind, so the pillars are not decoration: they are the reason a
// skillshot can miss for a reason other than bad aim.

export interface Obstacle {
  x: number;
  z: number;
  radius: number;
  /** Tall enough to block sight, or low enough to shoot over. */
  tall: boolean;
}

/** Half-width of the arena. The floor runs from -SIZE to +SIZE on both axes. */
export const ARENA_SIZE = 20;

/** Where the two fighters start, facing each other down the long diagonal. */
export const SPAWNS = {
  home: { x: -13, z: -13 },
  away: { x: 13, z: 13 },
};

/**
 * The cover.
 *
 * Deliberately ASYMMETRIC around the centre line but MIRRORED across the
 * diagonal the spawns sit on, so neither side has better ground while the fight
 * still has a shape rather than being a bare circle.
 */
export const OBSTACLES: Obstacle[] = [
  // The banyan at the centre. The one piece of cover both players want, which
  // is what makes the middle worth contesting instead of avoiding.
  { x: 0, z: 0, radius: 2.4, tall: true },

  // Dawn shrines, in mirrored pairs.
  { x: -7, z: 2, radius: 1.1, tall: true },
  { x: 7, z: -2, radius: 1.1, tall: true },
  { x: -2, z: -7, radius: 1.1, tall: true },
  { x: 2, z: 7, radius: 1.1, tall: true },

  // Low stones: they stop a dash and break a projectile, but you can see over
  // them. Cover you can fight around rather than hide behind.
  { x: -11, z: 6, radius: 1.6, tall: false },
  { x: 11, z: -6, radius: 1.6, tall: false },
  { x: 5, z: 11, radius: 1.4, tall: false },
  { x: -5, z: -11, radius: 1.4, tall: false },
];

/** Is this point inside the arena floor, allowing for the body's own width? */
export function insideArena(x: number, z: number, radius = 0): boolean {
  const limit = ARENA_SIZE - radius;
  return x > -limit && x < limit && z > -limit && z < limit;
}

/**
 * The obstacle this point is inside, or null.
 *
 * Returns the obstacle rather than a boolean because a caller that has to push
 * a body out needs to know which thing it is standing in.
 */
export function obstacleAt(x: number, z: number, radius = 0): Obstacle | null {
  for (const o of OBSTACLES) {
    const dx = x - o.x;
    const dz = z - o.z;
    if (dx * dx + dz * dz < (o.radius + radius) ** 2) return o;
  }
  return null;
}

/**
 * Slide a body out of anything it is overlapping and back inside the walls.
 *
 * Sliding rather than stopping, because a body that stops dead on contact
 * catches on corners and reads as the game refusing input. Pushing it along the
 * surface keeps the movement continuous.
 */
export function resolvePosition(
  x: number,
  z: number,
  radius: number
): { x: number; z: number } {
  let px = x;
  let pz = z;

  const hit = obstacleAt(px, pz, radius);
  if (hit) {
    const dx = px - hit.x;
    const dz = pz - hit.z;
    const d = Math.hypot(dx, dz) || 0.0001;
    const push = hit.radius + radius;
    px = hit.x + (dx / d) * push;
    pz = hit.z + (dz / d) * push;
  }

  const limit = ARENA_SIZE - radius;
  px = Math.max(-limit, Math.min(limit, px));
  pz = Math.max(-limit, Math.min(limit, pz));
  return { x: px, z: pz };
}

/** Does a straight line from a to b reach without crossing tall cover? */
export function hasLineOfSight(
  ax: number,
  az: number,
  bx: number,
  bz: number
): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 0.001) return true;

  // Sampled rather than solved. At a tenth of a unit the smallest pillar here
  // is four samples wide, and the arithmetic stays something anyone can read.
  const steps = Math.ceil(len / 0.1);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = ax + dx * t;
    const pz = az + dz * t;
    const o = obstacleAt(px, pz);
    if (o?.tall) return false;
  }
  return true;
}
