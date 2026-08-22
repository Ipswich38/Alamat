// The sanctuaries, and the cores inside them.
//
// ── WHAT A SANCTUARY IS ─────────────────────────────────────────────────────
// A circular zone at each base corner. It is not decoration: it is the thing
// the whole match is about, and per the canon the game ends when one of them
// breaks. Everything else on the map exists to move a fight towards or away
// from these two circles.
//
// ── WHY IT IS DATA AND NOT A MESH ───────────────────────────────────────────
// The renderer needs to draw it, the movement needs to know you are standing in
// it, and combat will need to know what can be hit. A sanctuary defined inside
// a mesh is a sanctuary only the renderer understands, and the first thing that
// breaks is a player healing on ground that merely LOOKS like a base.

/** Half-width of the map. The world runs from -HALF to +HALF on both axes. */
export const HALF = 100;

export type TeamId = 'anito' | 'malakas';

export interface Team {
  id: TeamId;
  name: string;
  /** Where the base sits. South-west and north-east, per the brief. */
  x: number;
  z: number;
  /**
   * The team's light, as a hex colour.
   *
   * ⚠ THIS IS THE READABILITY SYSTEM, NOT A PREFERENCE. A player has to know
   * whose core, whose tower and whose ability an effect belongs to before they
   * read what it does, so every emissive thing a team owns takes this colour
   * and nothing else does.
   */
  light: number;
  /** The same colour as a CSS string, for anything drawn in the DOM. */
  css: string;
}

export const TEAMS: Record<TeamId, Team> = {
  anito: {
    id: 'anito',
    name: 'Anito Sentinels',
    x: -78,
    z: 78,
    light: 0xffc84a,
    css: '#ffc84a',
  },
  malakas: {
    id: 'malakas',
    name: 'Malakas Clan',
    x: 78,
    z: -78,
    light: 0x4ad8ff,
    css: '#4ad8ff',
  },
};

/**
 * Radius of the sanctuary zone, in world units.
 *
 * The brief calls for 20 by 20. Taken as a RADIUS rather than a diameter,
 * because a 10-unit circle would be barely wider than five heroes standing
 * abreast and a base has to be somewhere a team can regroup, not a doorway.
 */
export const SANCTUARY_RADIUS = 20;

/** Is this point inside a team's sanctuary? Returns the team, or null. */
export function sanctuaryAt(x: number, z: number): Team | null {
  for (const t of Object.values(TEAMS)) {
    if (Math.hypot(x - t.x, z - t.z) <= SANCTUARY_RADIUS) return t;
  }
  return null;
}

/** How high the core floats above its pedestal. */
export const CORE_HEIGHT = 4.2;
