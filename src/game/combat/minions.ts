// Minion waves for the three lanes.
//
// ── WHY MINIONS ARE THE HEART OF A MOBA ───────────────────────────────────────
// Without minions, a tower is an impassable roadblock that one hero cannot dive,
// and lanes are empty corridors. Minions provide the meat shield that absorbs
// tower shots, create lane momentum that pushes objectives, and give players a
// reason to fight in the lanes.
//
// ── DERIVED FROM LANE PATHS ──────────────────────────────────────────────────
// Minions march along the exact same lane paths defined in `arena/lanes.ts`.
// Anito minions travel 0 -> 1; Malakas minions travel 1 -> 0.

import { LANES, type LaneId } from '@/game/arena/lanes';
import type { TeamId } from '@/game/arena/nexus';
import type { Objectives } from './objectives';

export type MinionKind = 'vanguard' | 'archer';

export interface Minion {
  id: string;
  team: TeamId;
  lane: LaneId;
  kind: MinionKind;
  /** Position along lane 0..1 */
  progress: number;
  x: number;
  z: number;
  facing: number;
  health: number;
  maxHealth: number;
  radius: number;
  damage: number;
  range: number;
  attackCooldown: number;
  alive: boolean;
}

export interface MinionStrikeReport {
  hits: Minion[];
  felled: Minion[];
}

export interface MinionManager {
  readonly minions: Minion[];
  /** Spawn a new wave if enough time has elapsed. */
  update(
    dt: number,
    clock: number,
    objectives: Objectives,
    onMinionAttack?: (from: Minion, tx: number, tz: number, isRanged: boolean) => void
  ): void;
  /** Damage minions matching the coverage shape. */
  strike(
    defender: TeamId,
    covers: (x: number, z: number, radius: number) => boolean,
    amount: number
  ): MinionStrikeReport;
  /** Find closest alive enemy minion to a point within maxRange. */
  findTargetFor(
    defender: TeamId,
    x: number,
    z: number,
    maxRange: number
  ): Minion | null;
  /** Total count of alive minions for a team. */
  count(team: TeamId): number;
}

/** World units per second along the lane path. */
const MINION_SPEED = 5.2;
/** Seconds between minion waves. */
const WAVE_INTERVAL = 22;
/** First wave delay from match start. */
const FIRST_WAVE = 3;

/** Stats per minion type. */
const STATS: Record<MinionKind, { health: number; damage: number; range: number; cooldown: number; radius: number }> = {
  vanguard: { health: 440, damage: 26, range: 2.3, cooldown: 1.1, radius: 0.9 },
  archer: { health: 260, damage: 20, range: 7.2, cooldown: 1.25, radius: 0.75 },
};

function along(path: [number, number][], frac: number): { x: number; z: number } {
  const segs: { a: [number, number]; b: [number, number]; len: number }[] = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, b, len });
    total += len;
  }
  let want = Math.max(0, Math.min(1, frac)) * total;
  for (const s of segs) {
    if (want <= s.len) {
      const t = s.len === 0 ? 0 : want / s.len;
      return { x: s.a[0] + (s.b[0] - s.a[0]) * t, z: s.a[1] + (s.b[1] - s.a[1]) * t };
    }
    want -= s.len;
  }
  const last = path[path.length - 1];
  return { x: last[0], z: last[1] };
}

function pathTotalLength(path: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
  }
  return Math.max(1, total);
}

export function createMinionManager(): MinionManager {
  let minions: Minion[] = [];
  let nextWaveClock = FIRST_WAVE;
  let waveId = 0;
  const attackTimers = new Map<string, number>();

  const laneLengths = new Map<LaneId, number>();
  for (const l of LANES) {
    laneLengths.set(l.id, pathTotalLength(l.path));
  }

  function spawnWave() {
    waveId++;
    for (const lane of LANES) {
      const kinds: MinionKind[] = ['vanguard', 'archer', 'archer'];
      // Spacing offsets so they march in single file
      const offsets = [0, 0.016, 0.032];

      for (let i = 0; i < kinds.length; i++) {
        const kind = kinds[i];
        const stat = STATS[kind];
        const off = offsets[i];

        // Anito minion (starts near 0)
        const aProg = Math.max(0, 0 + off);
        const aPt = along(lane.path, aProg);
        const aNext = along(lane.path, aProg + 0.01);
        minions.push({
          id: `anito-${lane.id}-w${waveId}-${i}`,
          team: 'anito',
          lane: lane.id,
          kind,
          progress: aProg,
          x: aPt.x,
          z: aPt.z,
          facing: Math.atan2(aNext.x - aPt.x, aNext.z - aPt.z),
          health: stat.health,
          maxHealth: stat.health,
          radius: stat.radius,
          damage: stat.damage,
          range: stat.range,
          attackCooldown: stat.cooldown,
          alive: true,
        });

        // Malakas minion (starts near 1)
        const mProg = Math.min(1, 1 - off);
        const mPt = along(lane.path, mProg);
        const mNext = along(lane.path, mProg - 0.01);
        minions.push({
          id: `malakas-${lane.id}-w${waveId}-${i}`,
          team: 'malakas',
          lane: lane.id,
          kind,
          progress: mProg,
          x: mPt.x,
          z: mPt.z,
          facing: Math.atan2(mNext.x - mPt.x, mNext.z - mPt.z),
          health: stat.health,
          maxHealth: stat.health,
          radius: stat.radius,
          damage: stat.damage,
          range: stat.range,
          attackCooldown: stat.cooldown,
          alive: true,
        });
      }
    }
  }

  return {
    get minions() {
      return minions;
    },

    count(team) {
      return minions.filter((m) => m.team === team && m.alive).length;
    },

    findTargetFor(defender, x, z, maxRange) {
      let best: Minion | null = null;
      let bestDist = maxRange;
      for (const m of minions) {
        if (m.team !== defender || !m.alive) continue;
        const d = Math.hypot(m.x - x, m.z - z);
        if (d < bestDist) {
          best = m;
          bestDist = d;
        }
      }
      return best;
    },

    strike(defender, covers, amount) {
      const report: MinionStrikeReport = { hits: [], felled: [] };
      if (amount <= 0) return report;

      for (const m of minions) {
        if (m.team !== defender || !m.alive) continue;
        if (!covers(m.x, m.z, m.radius)) continue;
        m.health = Math.max(0, m.health - amount);
        report.hits.push(m);
        if (m.health <= 0) {
          m.alive = false;
          report.felled.push(m);
        }
      }
      return report;
    },

    update(dt, clock, objectives, onMinionAttack) {
      if (clock >= nextWaveClock) {
        spawnWave();
        nextWaveClock = clock + WAVE_INTERVAL;
      }

      // Filter out dead minions after a delay to keep memory clean
      minions = minions.filter((m) => m.alive);

      for (const m of minions) {
        if (!m.alive) continue;
        const lane = LANES.find((l) => l.id === m.lane)!;
        const len = laneLengths.get(m.lane) ?? 200;
        const stepFrac = (MINION_SPEED * dt) / len;

        // Check for opposing minions in range
        const enemyTeam = m.team === 'anito' ? 'malakas' : 'anito';
        let targetMinion: Minion | null = null;
        let minionGap = Infinity;

        for (const other of minions) {
          if (other.team !== enemyTeam || other.lane !== m.lane || !other.alive) continue;
          const gap = Math.hypot(other.x - m.x, other.z - m.z);
          if (gap <= m.range + other.radius && gap < minionGap) {
            targetMinion = other;
            minionGap = gap;
          }
        }

        // Check for opposing enemy structures in range
        let targetStructure = null;
        if (!targetMinion) {
          for (const s of objectives.all) {
            if (s.team !== enemyTeam || !objectives.alive(s)) continue;
            const gap = Math.hypot(s.x - m.x, s.z - m.z);
            if (gap <= m.range + s.radius && objectives.vulnerable(s)) {
              targetStructure = s;
              break;
            }
          }
        }

        // Combat behavior: attack target or advance
        if (targetMinion) {
          // Face target
          m.facing = Math.atan2(targetMinion.x - m.x, targetMinion.z - m.z);
          const nextAtk = attackTimers.get(m.id) ?? 0;
          if (clock >= nextAtk) {
            attackTimers.set(m.id, clock + m.attackCooldown);
            targetMinion.health = Math.max(0, targetMinion.health - m.damage);
            if (targetMinion.health <= 0) targetMinion.alive = false;
            onMinionAttack?.(m, targetMinion.x, targetMinion.z, m.kind === 'archer');
          }
        } else if (targetStructure) {
          m.facing = Math.atan2(targetStructure.x - m.x, targetStructure.z - m.z);
          const nextAtk = attackTimers.get(m.id) ?? 0;
          if (clock >= nextAtk) {
            attackTimers.set(m.id, clock + m.attackCooldown);
            targetStructure.health = Math.max(0, targetStructure.health - m.damage);
            onMinionAttack?.(m, targetStructure.x, targetStructure.z, m.kind === 'archer');
          }
        } else {
          // Advance along lane
          const dir = m.team === 'anito' ? 1 : -1;
          const nextProg = Math.max(0, Math.min(1, m.progress + dir * stepFrac));
          m.progress = nextProg;
          const pt = along(lane.path, m.progress);
          const lookAhead = along(lane.path, Math.max(0, Math.min(1, m.progress + dir * 0.015)));
          m.x = pt.x;
          m.z = pt.z;
          if (Math.hypot(lookAhead.x - pt.x, lookAhead.z - pt.z) > 0.001) {
            m.facing = Math.atan2(lookAhead.x - pt.x, lookAhead.z - pt.z);
          }
        }
      }
    },
  };
}
