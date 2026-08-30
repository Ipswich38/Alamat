// What a tower does to whoever walks into it.
//
// ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────
// Without it the objectives are a wall you hit until it falls, and a wall is
// not a decision. A tower that shoots turns "push the lane" into a question
// with a cost: how long can I stand here, is the brute coming, do I have the
// health to take the next one. That question IS the genre.
//
// ── WHY THE NEAREST TOWER SHOOTS AND NOT ALL OF THEM ────────────────────────
// Towers are placed close enough that two ranges overlap at a lane's choke
// points, and letting both fire doubles the damage in exactly the spot the
// design wants a player to fight over. One shooter, always the closest, keeps
// the pressure legible.
//
// ⚠ IT SHOOTS WHETHER OR NOT IT CAN BE HURT. A tower warded by the one in
// front of it is still a tower, and the whole reason to push in order is that
// walking past a live tower is punished.

import type { Objectives, Structure } from './objectives';
import type { Minion, MinionManager } from './minions';
import type { TeamId } from '@/game/arena/nexus';

/** How far a tower reaches. Matches the range ring drawn on the ground. */
const RANGE = 12;

/** Seconds between shots. */
const CADENCE = 1.5;

/** Damage per shot. */
const DAMAGE = 96;
const MINION_TOWER_DAMAGE = 140;

export interface TowerShot {
  /** Damage dealt to hero. Zero if firing at a minion or nothing. */
  damage: number;
  /** The tower that fired, for drawing the bolt. */
  from: Structure | null;
  targetX: number;
  targetZ: number;
  minionHit?: Minion | null;
}

export interface TowerFire {
  update(clock: number, heroX: number, heroZ: number, minionManager?: MinionManager): TowerShot;
}

const QUIET: TowerShot = { damage: 0, from: null, targetX: 0, targetZ: 0 };

/** Seconds between walking into range and the first shot. */
const ACQUIRE = 0.6;

export function createTowerFire(objectives: Objectives, defender: TeamId): TowerFire {
  const nextShot = new Map<string, number>();
  const lastSeen = new Map<string, number>();
  const attackerTeam: TeamId = defender === 'dawn' ? 'dusk' : 'dawn';

  return {
    update(clock, heroX, heroZ, minionManager) {
      let best: Structure | null = null;
      let bestGap = Infinity;
      let targetMinion: Minion | null = null;

      for (const s of objectives.all) {
        if (s.team !== defender || s.kind !== 'tower' || !objectives.alive(s)) continue;

        // Check if any attacker minion is in range of this tower
        const m = minionManager?.findTargetFor(attackerTeam, s.x, s.z, RANGE);
        if (m) {
          const gap = Math.hypot(s.x - m.x, s.z - m.z);
          if (gap < bestGap) {
            best = s;
            bestGap = gap;
            targetMinion = m;
          }
          continue;
        }

        // Otherwise check hero
        const heroGap = Math.hypot(s.x - heroX, s.z - heroZ);
        if (heroGap <= RANGE && heroGap < bestGap) {
          best = s;
          bestGap = heroGap;
          targetMinion = null;
        }
      }

      if (!best) return QUIET;

      const seen = lastSeen.get(best.id);
      lastSeen.set(best.id, clock);
      if (seen === undefined || clock - seen > CADENCE) {
        nextShot.set(best.id, clock + ACQUIRE);
        return QUIET;
      }

      if (clock < (nextShot.get(best.id) ?? 0)) return QUIET;
      nextShot.set(best.id, clock + CADENCE);

      if (targetMinion) {
        targetMinion.health = Math.max(0, targetMinion.health - MINION_TOWER_DAMAGE);
        if (targetMinion.health <= 0) targetMinion.alive = false;
        return {
          damage: 0,
          from: best,
          targetX: targetMinion.x,
          targetZ: targetMinion.z,
          minionHit: targetMinion,
        };
      }

      return {
        damage: DAMAGE,
        from: best,
        targetX: heroX,
        targetZ: heroZ,
      };
    },
  };
}
