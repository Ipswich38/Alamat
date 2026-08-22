// The things you break to win, and the order the map insists you break them in.
//
// ── WHY THE WIN CONDITION IS A MODULE AND NOT A FLAG ────────────────────────
// The canon is explicit: the match ends when a core breaks, and everything on
// the map exists to move a fight towards or away from that. Until now the game
// had a fight and no reason for it, which is the difference between a combat
// demo and a MOBA. This file is that reason.
//
// ── WHY VULNERABILITY IS COMPUTED, NEVER STORED ─────────────────────────────
// A tower is not attackable because something set a flag on it: it is
// attackable because the tower in front of it has fallen. Deriving that from
// what is standing means the rule can never disagree with the map, and a
// structure destroyed by any future source (a minion wave, a second player's
// replay) opens the next one without anyone remembering to tell it to.
//
// ⚠ THE ORDER IS THE WHOLE GAME'S PACING. Without it a hero walks the river,
// ignores three lanes of towers and hits the core in the first minute, and no
// amount of tower damage fixes that: it is a rule, not a number.

import { buildTowers, type LaneId, type Tier } from '@/game/arena/lanes';
import { TEAMS, type TeamId } from '@/game/arena/nexus';

export type StructureKind = 'tower' | 'core';

export interface Structure {
  id: string;
  team: TeamId;
  kind: StructureKind;
  /** 'nexus' for the two towers flanking a core, and for the core itself. */
  lane: LaneId | 'nexus';
  tier: Tier;
  x: number;
  z: number;
  /**
   * Hit radius.
   *
   * ⚠ NOT THE 1.5 HITBOX FROM THE LANE DATA. That is the collision footprint
   * of the shaft; this is what an aimed shot has to cover, and a tower you can
   * miss by standing beside it reads as broken rather than as difficult.
   */
  radius: number;
  health: number;
  maxHealth: number;
}

/**
 * How much a tower holds, by tier. Deeper towers are worth the walk.
 *
 * ⚠ TUNED FOR A LONE HERO, WHICH IS NOT WHAT THESE NUMBERS WILL BE. In a real
 * MOBA a wave of minions does most of the damage to a tower and the hero adds
 * to it; there are no minions yet, so one player has to be able to finish a
 * match alone. Clearing a lane, both base towers and the core is about two
 * minutes of attacking at the Tikbalang's rate. These go UP the day minions
 * arrive, and the reason is here so that raise is not read as a nerf.
 */
const TOWER_HEALTH: Record<Tier, number> = { 1: 900, 2: 1200, 3: 1500 };
const CORE_HEALTH = 2400;

const TOWER_RADIUS = 3.1;
const CORE_RADIUS = 4.2;

export interface HitReport {
  /** Structures the shape covered and damaged, in map order. */
  hits: Structure[];
  /** Structures it covered that are not yet attackable. */
  shielded: Structure[];
  /** Destroyed by this hit, a subset of `hits`. */
  felled: Structure[];
}

export interface Objectives {
  all: Structure[];
  alive(s: Structure): boolean;
  /** Can this be damaged right now, per the push order? */
  vulnerable(s: Structure): boolean;
  core(team: TeamId): Structure;
  /**
   * Damage everything of `defender`'s that an aimed shape covers.
   *
   * The shape arrives as a predicate rather than as data, so this file never
   * learns what a cone is: geometry stays in one place and the push order
   * stays in another.
   */
  strike(
    defender: TeamId,
    covers: (x: number, z: number, radius: number) => boolean,
    amount: number
  ): HitReport;
}

export function createObjectives(): Objectives {
  const all: Structure[] = [];

  for (const node of buildTowers()) {
    all.push({
      id: node.id,
      team: node.team,
      kind: 'tower',
      lane: node.lane,
      tier: node.tier,
      x: node.x,
      z: node.z,
      radius: TOWER_RADIUS,
      health: TOWER_HEALTH[node.tier],
      maxHealth: TOWER_HEALTH[node.tier],
    });
  }

  for (const team of Object.values(TEAMS)) {
    all.push({
      id: `${team.id}-core`,
      team: team.id,
      kind: 'core',
      lane: 'nexus',
      tier: 3,
      x: team.x,
      z: team.z,
      radius: CORE_RADIUS,
      health: CORE_HEALTH,
      maxHealth: CORE_HEALTH,
    });
  }

  const alive = (s: Structure) => s.health > 0;

  const find = (team: TeamId, lane: LaneId | 'nexus', tier: Tier) =>
    all.find((s) => s.kind === 'tower' && s.team === team && s.lane === lane && s.tier === tier);

  function vulnerable(s: Structure): boolean {
    if (!alive(s)) return false;

    if (s.kind === 'tower' && s.lane !== 'nexus') {
      // Tier 1 is the outermost and is always open; every tier behind it waits
      // for the one in front.
      if (s.tier === 1) return true;
      const front = find(s.team, s.lane, (s.tier - 1) as Tier);
      return !!front && !alive(front);
    }

    // The two towers at the base open once ANY lane has been pushed through.
    // Requiring all three would mean a solo player has to clear the whole map
    // to end a match, which is a chore rather than a decision.
    const laneCleared = all.some(
      (t) => t.kind === 'tower' && t.team === s.team && t.lane !== 'nexus' && t.tier === 3 && !alive(t)
    );
    if (s.kind === 'tower') return laneCleared;

    // The core is last, and only once both of its guards are down.
    const guards = all.filter((t) => t.kind === 'tower' && t.team === s.team && t.lane === 'nexus');
    return guards.every((g) => !alive(g));
  }

  return {
    all,
    alive,
    vulnerable,
    core: (team) => all.find((s) => s.kind === 'core' && s.team === team)!,
    strike: (defender, covers, amount) => {
      const report: HitReport = { hits: [], shielded: [], felled: [] };
      if (amount <= 0) return report;

      for (const s of all) {
        if (s.team !== defender || !alive(s)) continue;
        if (!covers(s.x, s.z, s.radius)) continue;
        if (!vulnerable(s)) {
          report.shielded.push(s);
          continue;
        }
        s.health = Math.max(0, s.health - amount);
        report.hits.push(s);
        if (!alive(s)) report.felled.push(s);
      }
      return report;
    },
  };
}
