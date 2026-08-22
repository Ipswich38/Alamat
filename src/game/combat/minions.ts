// Lane minion waves: Mandirigma (Melee), Mapanahong (Ranged), and Bagani (Siege).
//
// ── THE THREE PANGKAT (DIVISIONS) ───────────────────────────────────────────
// 1. Mandirigma (Melee): Pre-colonial warriors with Kalasag shield & Kampilan short sword. High HP frontline.
// 2. Mapanahong (Ranged): Village hunters with bamboo bow / Sumpit blowgun. Ranged poison dart / spirit arrow fire.
// 3. Bagani (Siege): Armored battering ram vanguard dealing 2.5x bonus damage against turrets & palisade gates.

import { LANES, type LaneId } from '@/game/arena/lanes';
import type { TeamId } from '@/game/arena/nexus';
import type { Objectives } from './objectives';

export type MinionKind = 'mandirigma' | 'mapanahong' | 'bagani';

export interface Minion {
  id: string;
  team: TeamId;
  lane: LaneId;
  kind: MinionKind;
  /** Position along lane 0..1 */
  progress: number;
  /** Lateral offset across the lane path perpendicular to tangent */
  lateralOffset: number;
  x: number;
  z: number;
  facing: number;
  health: number;
  maxHealth: number;
  radius: number;
  damage: number;
  range: number;
  attackCooldown: number;
  structureMultiplier: number;
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
const FIRST_WAVE = 2.5;

/** Stats per minion division. */
export const MINION_STATS: Record<
  MinionKind,
  {
    name: string;
    health: number;
    damage: number;
    range: number;
    cooldown: number;
    radius: number;
    structureMultiplier: number;
  }
> = {
  mandirigma: {
    name: 'Pangkat Mandirigma',
    health: 520,
    damage: 28,
    range: 2.2,
    cooldown: 1.05,
    radius: 0.9,
    structureMultiplier: 1.0,
  },
  mapanahong: {
    name: 'Pangkat Mapanahong',
    health: 280,
    damage: 22,
    range: 7.5,
    cooldown: 1.2,
    radius: 0.75,
    structureMultiplier: 1.0,
  },
  bagani: {
    name: 'Pangkat Bagani',
    health: 820,
    damage: 45,
    range: 2.5,
    cooldown: 1.4,
    radius: 1.15,
    structureMultiplier: 2.5, // 2.5x bonus siege damage vs turrets & gates
  },
};

function alongWithTangent(
  path: [number, number][],
  frac: number
): { x: number; z: number; tx: number; tz: number } {
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
      const x = s.a[0] + (s.b[0] - s.a[0]) * t;
      const z = s.a[1] + (s.b[1] - s.a[1]) * t;
      const tLen = s.len || 1;
      const tx = (s.b[0] - s.a[0]) / tLen;
      const tz = (s.b[1] - s.a[1]) / tLen;
      return { x, z, tx, tz };
    }
    want -= s.len;
  }
  const last = path[path.length - 1];
  const prev = path[Math.max(0, path.length - 2)];
  const tLen = Math.hypot(last[0] - prev[0], last[1] - prev[1]) || 1;
  return {
    x: last[0],
    z: last[1],
    tx: (last[0] - prev[0]) / tLen,
    tz: (last[1] - prev[1]) / tLen,
  };
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
      // Formation:
      // Row 1 (Front): 3 Melee Mandirigma (left, center, right)
      // Row 2 (Mid): 2 Ranged Mapanahong (left, right)
      // Row 3 (Rear): 1 Siege Bagani (center)
      const waveUnits: { kind: MinionKind; progressOffset: number; lateralOffset: number }[] = [
        // Frontline Mandirigma
        { kind: 'mandirigma', progressOffset: 0.0, lateralOffset: -1.8 },
        { kind: 'mandirigma', progressOffset: 0.0, lateralOffset: 0.0 },
        { kind: 'mandirigma', progressOffset: 0.0, lateralOffset: 1.8 },
        // Ranged Mapanahong
        { kind: 'mapanahong', progressOffset: -0.015, lateralOffset: -1.2 },
        { kind: 'mapanahong', progressOffset: -0.015, lateralOffset: 1.2 },
        // Siege Bagani
        { kind: 'bagani', progressOffset: -0.03, lateralOffset: 0.0 },
      ];

      for (let i = 0; i < waveUnits.length; i++) {
        const u = waveUnits[i];
        const stat = MINION_STATS[u.kind];

        // Anito minion (starts near 0, marching towards 1)
        const aProg = Math.max(0, 0.005 - u.progressOffset);
        const aSample = alongWithTangent(lane.path, aProg);
        // Perpendicular normal (-tz, tx)
        const aPx = -aSample.tz;
        const aPz = aSample.tx;
        const aX = aSample.x + aPx * u.lateralOffset;
        const aZ = aSample.z + aPz * u.lateralOffset;
        const aHeading = Math.atan2(aSample.tx, aSample.tz);

        minions.push({
          id: `anito-${lane.id}-w${waveId}-${i}`,
          team: 'anito',
          lane: lane.id,
          kind: u.kind,
          progress: aProg,
          lateralOffset: u.lateralOffset,
          x: aX,
          z: aZ,
          facing: aHeading,
          health: stat.health,
          maxHealth: stat.health,
          radius: stat.radius,
          damage: stat.damage,
          range: stat.range,
          attackCooldown: stat.cooldown,
          structureMultiplier: stat.structureMultiplier,
          alive: true,
        });

        // Malakas minion (starts near 1, marching towards 0)
        const mProg = Math.min(1, 0.995 + u.progressOffset);
        const mSample = alongWithTangent(lane.path, mProg);
        const mPx = -mSample.tz;
        const mPz = mSample.tx;
        const mX = mSample.x + mPx * (-u.lateralOffset);
        const mZ = mSample.z + mPz * (-u.lateralOffset);
        const mHeading = Math.atan2(-mSample.tx, -mSample.tz);

        minions.push({
          id: `malakas-${lane.id}-w${waveId}-${i}`,
          team: 'malakas',
          lane: lane.id,
          kind: u.kind,
          progress: mProg,
          lateralOffset: -u.lateralOffset,
          x: mX,
          z: mZ,
          facing: mHeading,
          health: stat.health,
          maxHealth: stat.health,
          radius: stat.radius,
          damage: stat.damage,
          range: stat.range,
          attackCooldown: stat.cooldown,
          structureMultiplier: stat.structureMultiplier,
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

      // Filter out dead minions
      minions = minions.filter((m) => m.alive);

      for (const m of minions) {
        if (!m.alive) continue;
        const lane = LANES.find((l) => l.id === m.lane)!;
        const len = laneLengths.get(m.lane) ?? 200;
        const stepFrac = (MINION_SPEED * dt) / len;
        const enemyTeam = m.team === 'anito' ? 'malakas' : 'anito';

        // 1. Check for opposing minions in range
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

        // 2. Check for opposing enemy structures in range
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

        // 3. Combat Execution or Lane Advance
        if (targetMinion) {
          m.facing = Math.atan2(targetMinion.x - m.x, targetMinion.z - m.z);
          const nextAtk = attackTimers.get(m.id) ?? 0;
          if (clock >= nextAtk) {
            attackTimers.set(m.id, clock + m.attackCooldown);
            targetMinion.health = Math.max(0, targetMinion.health - m.damage);
            if (targetMinion.health <= 0) targetMinion.alive = false;
            onMinionAttack?.(m, targetMinion.x, targetMinion.z, m.kind === 'mapanahong');
          }
        } else if (targetStructure) {
          m.facing = Math.atan2(targetStructure.x - m.x, targetStructure.z - m.z);
          const nextAtk = attackTimers.get(m.id) ?? 0;
          if (clock >= nextAtk) {
            attackTimers.set(m.id, clock + m.attackCooldown);
            const appliedDamage = m.damage * m.structureMultiplier;
            targetStructure.health = Math.max(0, targetStructure.health - appliedDamage);
            onMinionAttack?.(m, targetStructure.x, targetStructure.z, m.kind === 'mapanahong');
          }
        } else {
          // Advance along lane spline keeping lateral formation offset
          const dir = m.team === 'anito' ? 1 : -1;
          const nextProg = Math.max(0, Math.min(1, m.progress + dir * stepFrac));
          m.progress = nextProg;
          const sample = alongWithTangent(lane.path, m.progress);
          const px = -sample.tz;
          const pz = sample.tx;
          m.x = sample.x + px * m.lateralOffset;
          m.z = sample.z + pz * m.lateralOffset;
          m.facing = Math.atan2(sample.tx * dir, sample.tz * dir);
        }
      }
    },
  };
}
