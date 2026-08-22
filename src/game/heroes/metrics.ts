// How big a hero is, in one place.
//
// ── WHY THESE ARE NOT THREE SEPARATE NUMBERS ────────────────────────────────
// A hero's visual height, its collision radius and its selection ring all have
// to agree, and the classic way they stop agreeing is that each one is typed in
// where it is used. Then the model grows, the collider does not, and a player
// is blocked by air a metre from a wall while their own body clips through a
// tree. Everything here derives from ONE height.

/** The unscaled reference height a hero model is fitted to. */
const BASE_HEIGHT = 1.75;

/**
 * Global multiplier on every hero.
 *
 * ⚠ RAISED FROM 1 TO 2.2. At the original size a hero was under two units tall
 * on a 200-unit map and read as a speck: the camera has to show enough ground
 * to aim an ability across, and at that scale the character lost the argument.
 * Everything that depends on hero size flows from this constant, so changing it
 * again is one edit.
 */
export const HERO_SCALE = 2.2;

/** How tall a hero stands after scaling, before its own build multiplier. */
export const HERO_HEIGHT = BASE_HEIGHT * HERO_SCALE;

/**
 * Body radius as a fraction of height.
 *
 * A person is roughly six to seven times as tall as they are wide across the
 * shoulders, so 0.16 gives a collider that matches the silhouette instead of a
 * cylinder the model rattles around inside.
 */
const RADIUS_RATIO = 0.16;

/** Collision radius for a hero of a given build scale. */
export function heroRadius(buildScale = 1): number {
  return HERO_HEIGHT * buildScale * RADIUS_RATIO;
}

/** Visual height for a hero of a given build scale. */
export function heroHeight(buildScale = 1): number {
  return HERO_HEIGHT * buildScale;
}

/**
 * Radius of the ring drawn under the active hero.
 *
 * Deliberately WIDER than the collider. The ring's job is for the player never
 * to lose their own character in a crowded fight, so it has to be visible past
 * the body's own silhouette from a camera looking down at it.
 */
export const SELECTION_RING = 1.5;
