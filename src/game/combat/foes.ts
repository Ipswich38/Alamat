// The things on the other side.
//
// From the canon: the Hollow Lair fields a Treant brute and a Sever
// assassin. This is the Treant, and it is the first thing in this game that is
// not the player.
//
// ⚠ IT IS NOT A HERO AND MUST NOT BECOME ONE. Heroes are picked, balanced
// against each other and owned by a player. A foe is placed, tuned against the
// player's power alone, and belongs to the map. Keeping them in separate files
// is what stops the enemy Treant and a future playable Treant becoming the same
// record with a flag on it.

import { heroHeight } from '@/game/heroes';
import type { ActorModel } from '@/game/render3d/actor';

export interface Foe {
  id: string;
  name: string;
  blurb: string;
  model: ActorModel;
  health: number;
  /** World units per second. Slower than any hero: a brute closes, it does not chase. */
  speed: number;
  /** How close it comes before it stops walking at you. */
  reach: number;
  /** How far away it notices you at all. */
  awareness: number;
  damage: number;
  attackCooldown: number;
}

export const KAPRE: Foe = {
  id: 'treant',
  name: 'Treant',
  blurb: 'The tree giant. It was here first, it is smoking, and it has noticed you.',
  model: {
    rigged: '/models/creatures/treant-rigged.glb',
    walk: '/models/creatures/treant-walk.glb',
    // ⚠ EXPRESSED AS A MULTIPLE OF A HERO, not as an absolute. The whole point
    // of a Treant is that it towers over you, and an absolute height silently
    // turns a giant into a dwarf the moment heroes are rescaled.
    height: heroHeight() * 1.6,
  },
  health: 1800,
  speed: 3.4,
  // ⚠ THIS MUST STAY BELOW THE SHORTEST MELEE attackRange IN THE ROSTER.
  // It was 3.2 while the melee heroes reach 2.2 (Veer) and 2.0 (Hollow),
  // so the Treant parked outside both of them and swung. A melee hero could not
  // land a basic attack on it at all: measured over forty swings from every
  // facing, it took zero damage while dealing ninety-five a swing. The bug was
  // invisible because nothing errors, the strike just reports empty air.
  // A brute closing INSIDE a hero's guard is also the right read for a thing
  // that towers over you. Ranged heroes are unaffected: they kite it, which is
  // what a 3.4 speed against a 6.2 hero is for.
  reach: 1.9,
  awareness: 22,
  damage: 95,
  attackCooldown: 1.65,
};
