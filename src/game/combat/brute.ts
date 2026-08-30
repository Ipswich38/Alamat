// What a brute does when it notices you.
//
// ── WHY THE ENEMY'S MIND IS NOT IN THE FRAME LOOP ───────────────────────────
// It was, and the loop is the wrong home for it: every second creature added
// there would copy the same chase, the same swing timer and the same respawn,
// and the three would drift apart within a session. The canon names a second
// foe already (a Sever assassin), so this is the moment to make ONE
// brain that a foe record configures, rather than two that merely resemble
// each other.
//
// ⚠ IT OWNS THE FOE'S POSITION AND HEALTH, and nothing else does. Combat asks
// it where the body is; the renderer is told where to draw. A second copy of
// those numbers anywhere is a foe that can be hit where it is not standing.

import type { Foe } from './foes';

/** Everything the brain is allowed to know about the world this tick. */
export interface BruteSenses {
  clock: number;
  playerX: number;
  playerZ: number;
  /** Added to the foe's reach, so a bigger hero is swung at from further out. */
  playerRadius: number;
  /** Brush hides you, unless you are already close enough to be swung at. */
  playerHidden: boolean;
}

export interface BruteTick {
  /** Damage dealt to the player this tick. Zero on every frame it does not swing. */
  damage: number;
  /** Walking towards you, as opposed to standing and facing you. */
  walking: boolean;
  /** True on the single frame it comes back from being down. */
  returned: boolean;
}

export interface Brute {
  readonly foe: Foe;
  readonly x: number;
  readonly z: number;
  readonly facing: number;
  readonly health: number;
  readonly alive: boolean;
  /**
   * Apply damage. False when it is already down, which is what stops a
   * projectile in flight from "killing" a corpse and restarting its timer.
   */
  hurt(amount: number, clock: number): boolean;
  update(dt: number, senses: BruteSenses): BruteTick;
}

/** Seconds a downed foe stays gone before it gathers itself again. */
const RESPAWN = 5.5;

export function createBrute(foe: Foe, spawnX: number, spawnZ: number): Brute {
  let x = spawnX;
  let z = spawnZ;
  let facing = 0;
  let health = foe.health;
  let downUntil = 0;
  let nextStrike = 0;

  return {
    foe,
    get x() {
      return x;
    },
    get z() {
      return z;
    },
    get facing() {
      return facing;
    },
    get health() {
      return health;
    },
    get alive() {
      return health > 0;
    },

    hurt(amount, clock) {
      if (amount <= 0 || health <= 0 || clock < downUntil) return false;
      health = Math.max(0, health - amount);
      if (health <= 0) downUntil = clock + RESPAWN;
      return true;
    },

    update(dt, senses) {
      if (health <= 0) {
        if (senses.clock < downUntil) return { damage: 0, walking: false, returned: false };
        health = foe.health;
        x = spawnX;
        z = spawnZ;
        return { damage: 0, walking: false, returned: true };
      }

      const dx = senses.playerX - x;
      const dz = senses.playerZ - z;
      const gap = Math.hypot(dx, dz);
      const sees = !senses.playerHidden || gap <= foe.reach + 1;
      // Notices you, closes, stops at reach.
      const closing = sees && gap < foe.awareness && gap > foe.reach;
      if (closing) {
        const step = (foe.speed * dt) / gap;
        x += dx * step;
        z += dz * step;
      }
      // Always turns to face you, even when standing still, which is what makes
      // a thing read as aware rather than idle.
      if (gap > 0.1 && sees) facing = Math.atan2(dx, dz);

      let damage = 0;
      if (sees && gap <= foe.reach + senses.playerRadius && senses.clock >= nextStrike) {
        nextStrike = senses.clock + foe.attackCooldown;
        damage = foe.damage;
      }
      return { damage, walking: closing, returned: false };
    },
  };
}
