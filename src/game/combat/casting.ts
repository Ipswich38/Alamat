// The four things a hero can throw, and what each one is while it is in flight.
//
// ── WHY A SLOT AND NOT AN ABILITY ───────────────────────────────────────────
// Cooldowns, keys and buttons all key off the SLOT, never off the ability in
// it. The hero can change under a running frame loop, and everything that
// remembers "the fireball is on cooldown" instead of "slot 1 is on cooldown"
// leaks one hero's state into the next one picked.

import type { Ability, Hero } from '@/game/heroes';
import type * as THREE from 'three';

export type CastSlot = 'basic' | 'basic_minion' | 'basic_tower' | 'ability0' | 'ability1' | 'ability2' | 'ultimate' | 'potion' | 'spell' | 'recall';

/** Seconds remaining on each slot. Zero means ready. */
export type CooldownState = Record<CastSlot, number>;

export const EMPTY_COOLDOWNS: CooldownState = {
  basic: 0,
  basic_minion: 0,
  basic_tower: 0,
  ability0: 0,
  ability1: 0,
  ability2: 0,
  ultimate: 0,
  potion: 0,
  spell: 0,
  recall: 0,
};

/** Keyboard bindings. The on-screen buttons cast through the same path. */
export const CAST_KEYS: Record<string, CastSlot> = {
  j: 'basic',
  ' ': 'basic',
  t: 'basic_tower',
  m: 'basic_minion',
  k: 'basic_minion',
  q: 'ability0',
  '1': 'ability0',
  w: 'ability1',
  '2': 'ability1',
  e: 'ability2',
  '3': 'ability2',
  r: 'ultimate',
  '4': 'ultimate',
  d: 'potion',
  f: 'spell',
  b: 'recall',
};


/** Half-width of a basic attack, which has no ability record to carry one. */
export const BASIC_WIDTH = 0.55;

/** World units per second for a thrown projectile. */
export const PROJECTILE_SPEED = 20;

export function abilityForSlot(hero: Hero, slot: CastSlot): Ability | null {
  if (slot === 'ability0') return hero.abilities[0];
  if (slot === 'ability1') return hero.abilities[1];
  if (slot === 'ability2') return hero.abilities[2] ?? hero.abilities[0];
  if (slot === 'ultimate') return hero.ultimate;
  return null;
}

/**
 * A cast that has been aimed and has not landed yet.
 *
 * ⚠ IT REMEMBERS WHERE IT WAS AIMED FROM. Resolving against the caster's
 * position at landing time would let a player start a cast, walk, and have it
 * land from the new spot: the wind-up would stop being the counterplay window
 * it exists to be.
 */
export interface WindupCast {
  ability: Ability;
  slot: CastSlot;
  x: number;
  z: number;
  heading: number;
  triggerAt: number;
}

export interface ProjectileCast {
  ability: Ability;
  object: THREE.Object3D;
  x: number;
  z: number;
  heading: number;
  travelled: number;
}

export interface DashCast {
  ability: Ability;
  heading: number;
  remaining: number;
  speed: number;
  /** A dash damages what it passes through once, not once per frame. */
  hit: boolean;
}
