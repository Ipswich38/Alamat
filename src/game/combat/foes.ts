// The things on the other side.
//
// From the canon: the Aswang Lair fields a Kapre brute and a Manananggal
// assassin. This is the Kapre, and it is the first thing in this game that is
// not the player.
//
// ⚠ IT IS NOT A HERO AND MUST NOT BECOME ONE. Heroes are picked, balanced
// against each other and owned by a player. A foe is placed, tuned against the
// player's power alone, and belongs to the map. Keeping them in separate files
// is what stops the enemy Kapre and a future playable Kapre becoming the same
// record with a flag on it.

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
}

export const KAPRE: Foe = {
  id: 'kapre',
  name: 'Kapre',
  blurb: 'The tree giant. It was here first, it is smoking, and it has noticed you.',
  model: {
    rigged: '/models/creatures/kapre-rigged.glb',
    walk: '/models/creatures/kapre-walk.glb',
    // Half again a hero's height. The whole point of a Kapre is that it is
    // enormous, and a giant the size of a person is just a person.
    height: 2.8,
  },
  health: 1800,
  speed: 3.4,
  reach: 3.2,
  awareness: 22,
};
