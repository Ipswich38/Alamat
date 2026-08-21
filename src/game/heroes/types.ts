// What a hero is.
//
// ── WHY THIS IS DATA AND NOT CODE ───────────────────────────────────────────
// The single most useful thing carried over from the Godot prototype: a hero is
// a record, not a class. Adding one is a new entry in a catalogue file, never a
// new subclass, a new scene and a new controller. The moment heroes are code,
// balancing becomes a refactor and nobody balances anything.
//
// ── WHY EVERY ABILITY IS AIMED ──────────────────────────────────────────────
// There is no target-lock anywhere in this game, and that is the design's whole
// differentiator. Mobile MOBAs auto-target because it is easier on a phone, and
// the cost is that the mechanical ceiling collapses: at high level everyone
// lands everything. Every ability here is a SHAPE thrown at a DIRECTION, so it
// can be dodged, blocked and mispredicted. That decision belongs at the type
// level, which is why there is no `target` field to be tempted by.

/** The shape an ability puts into the world. All are aimed, none are locked. */
export type AbilityShape =
  /** Travels in a straight line until it hits something or expires. */
  | 'projectile'
  /** A circle centred on a point you choose, landing after a wind-up. */
  | 'ground'
  /** A wedge in front of the caster, resolved instantly. */
  | 'cone'
  /** Moves the caster, damaging what it passes through. */
  | 'dash';

export interface Ability {
  id: string;
  name: string;
  /** One line, in the game's voice, shown on the button and in the codex. */
  blurb: string;
  emoji: string;
  shape: AbilityShape;
  /** Seconds before it can be used again. */
  cooldown: number;
  /** How far it reaches, in world units. */
  range: number;
  /** Half-width for a projectile, radius for ground, half-angle for a cone. */
  width: number;
  damage: number;
  /**
   * Seconds between the input and the effect.
   *
   * The counterplay window. An ability with no wind-up cannot be reacted to,
   * only predicted, and a game made only of those is a coin-flip.
   */
  windup: number;
  /** Seconds the caster is rooted while casting. Zero for mobile abilities. */
  lock: number;
}

export type HeroRole = 'vanguard' | 'mystic' | 'stalker' | 'warden' | 'ranger';

export interface Hero {
  id: string;
  name: string;
  /** The creature or figure from folklore this is drawn from. */
  origin: string;
  /** Two or three lines. This is the only place the myth gets told. */
  lore: string;
  role: HeroRole;
  emoji: string;
  /** Flat-shaded palette, so one rigged model serves every hero. See render3d. */
  palette: { skin: string; cloth: string; accent: string; hair: string };
  health: number;
  /** World units per second. */
  speed: number;
  /** Damage of the basic attack, which is also aimed. */
  attack: number;
  attackRange: number;
  attackCooldown: number;
  abilities: [Ability, Ability];
  ultimate: Ability;
}
