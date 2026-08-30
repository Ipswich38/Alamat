// Major Boss Camps (Epic Objectives): Maw and Treant.
//
// ── EPIC BOSS 1: BAKUNAWA (The Moon-Eater) ──────────────────────────────────
// Sunken river basin pit (East river bend). Giant aquatic dragon/sea serpent emerging
// from a deep dark whirlpool.
// Attacks: AoE Tail Sweep, Water Jet Cone, Eclipse Aura (darkens skybox during combat).
// Reward: "Moon's Eclipse" Team Buff (+20% damage to structures & true damage for 3 mins).
//
// ── EPIC BOSS 2: KAPRE (The Giant Tree Warden) ──────────────────────────────
// Ancient Banyan Tree lair (West jungle pit). Massive dark-furred giant holding
// a glowing tobacco pipe (Tabako).
// Attacks: Heavy Ground Stomp (Stun/Slow), Smoke Ring Debuff (blinds & slows attack).
// Reward: Spawns an allied Pushing Treant Siege Giant in the nearest lane to smash turrets.

import { type LaneId } from '@/game/arena/lanes';
import type { Objectives } from './objectives';

export type BossKind = 'maw' | 'treant';

export interface EpicBoss {
  id: string;
  kind: BossKind;
  name: string;
  title: string;
  spawnX: number;
  spawnZ: number;
  x: number;
  z: number;
  facing: number;
  health: number;
  maxHealth: number;
  radius: number;
  alive: boolean;
  inCombat: boolean;
  respawnAt: number;
}

export interface PushingTreantUnit {
  id: string;
  name: string;
  lane: LaneId;
  progress: number;
  x: number;
  z: number;
  facing: number;
  health: number;
  maxHealth: number;
  radius: number;
  damage: number;
  structureMultiplier: number;
  attackCooldown: number;
  alive: boolean;
}

export interface BossTickResult {
  damageToPlayer: number;
  eclipseActive: boolean;
  buffGranted?: {
    type: 'moons_eclipse';
    name: string;
    duration: number;
    description: string;
  };
  treantSummoned?: boolean;
  announcement?: string;
  telegraphs: {
    type: 'circle' | 'cone' | 'ring';
    x: number;
    z: number;
    heading?: number;
    range?: number;
    radius?: number;
    halfAngle?: number;
    colour: number;
  }[];
}

export interface BossStrikeReport {
  hits: (EpicBoss | PushingTreantUnit)[];
  felled: (EpicBoss | PushingTreantUnit)[];
}

export interface BossManager {
  readonly maw: EpicBoss;
  readonly treant: EpicBoss;
  readonly pushingTreant: PushingTreantUnit | null;
  update(
    dt: number,
    clock: number,
    player: { x: number; z: number; radius: number; hidden: boolean },
    objectives: Objectives,
    onPushingTreantAttack?: (k: PushingTreantUnit, tx: number, tz: number) => void
  ): BossTickResult;
  strike(
    covers: (x: number, z: number, radius: number) => boolean,
    amount: number,
    clock: number
  ): BossStrikeReport;
  findTargetNear(x: number, z: number, maxRange: number): EpicBoss | null;
}

const BOSS_RESPAWN = 240.0; // 4 minutes
const LEASH_RADIUS = 10.5;
const AWARENESS_RADIUS = 9.5;

export function createBossManager(): BossManager {
  const maw: EpicBoss = {
    id: 'boss-maw',
    kind: 'maw',
    name: 'Maw',
    title: 'The Moon-Eater',
    spawnX: 36,
    spawnZ: -14,
    x: 36,
    z: -14,
    facing: Math.PI * 0.75,
    health: 4500,
    maxHealth: 4500,
    radius: 3.4,
    alive: true,
    inCombat: false,
    respawnAt: 0,
  };

  const treant: EpicBoss = {
    id: 'boss-treant',
    kind: 'treant',
    name: 'Treant',
    title: 'Giant Tree Warden',
    spawnX: -36,
    spawnZ: 14,
    x: -36,
    z: 14,
    facing: -Math.PI * 0.25,
    health: 4000,
    maxHealth: 4000,
    radius: 2.8,
    alive: true,
    inCombat: false,
    respawnAt: 0,
  };

  let pushingTreant: PushingTreantUnit | null = null;

  // Attack timers
  let bNextStrike = 0;
  let bNextSweep = 0;
  let bNextWaterJet = 0;

  let kNextStrike = 0;
  let kNextStomp = 0;
  let kNextSmoke = 0;
  let pTreantNextAtk = 0;

  function summonPushingTreant(laneId: LaneId = 'mid') {
    pushingTreant = {
      id: 'allied-treant-siege',
      name: 'Pushing Treant',
      lane: laneId,
      progress: 0.12,
      x: -30,
      z: 30,
      facing: -Math.PI * 0.25,
      health: 2600,
      maxHealth: 2600,
      radius: 2.4,
      damage: 180,
      structureMultiplier: 3.0, // 540 dmg to towers!
      attackCooldown: 1.8,
      alive: true,
    };
  }

  return {
    get maw() {
      return maw;
    },
    get treant() {
      return treant;
    },
    get pushingTreant() {
      return pushingTreant && pushingTreant.alive ? pushingTreant : null;
    },

    findTargetNear(x, z, maxRange) {
      if (maw.alive && Math.hypot(maw.x - x, maw.z - z) <= maxRange) return maw;
      if (treant.alive && Math.hypot(treant.x - x, treant.z - z) <= maxRange) return treant;
      return null;
    },

    strike(covers, amount, clock) {
      const report: BossStrikeReport = { hits: [], felled: [] };
      if (amount <= 0) return report;

      // Maw
      if (maw.alive && covers(maw.x, maw.z, maw.radius)) {
        maw.health = Math.max(0, maw.health - amount);
        maw.inCombat = true;
        report.hits.push(maw);
        if (maw.health <= 0) {
          maw.alive = false;
          maw.inCombat = false;
          maw.respawnAt = clock + BOSS_RESPAWN;
          report.felled.push(maw);
        }
      }

      // Treant Boss
      if (treant.alive && covers(treant.x, treant.z, treant.radius)) {
        treant.health = Math.max(0, treant.health - amount);
        treant.inCombat = true;
        report.hits.push(treant);
        if (treant.health <= 0) {
          treant.alive = false;
          treant.inCombat = false;
          treant.respawnAt = clock + BOSS_RESPAWN;
          report.felled.push(treant);
        }
      }

      return report;
    },

    update(dt, clock, player, objectives, onPushingTreantAttack) {
      let totalDamage = 0;
      let eclipseActive = false;
      let buffGranted: BossTickResult['buffGranted'] = undefined;
      let treantSummoned = false;
      let announcement: string | undefined = undefined;
      const telegraphs: BossTickResult['telegraphs'] = [];

      // ── 1. BAKUNAWA AI ───────────────────────────────────────────────────
      if (!maw.alive) {
        if (clock >= maw.respawnAt) {
          maw.health = maw.maxHealth;
          maw.alive = true;
          maw.inCombat = false;
          announcement = 'Maw has risen from the river whirlpool!';
        }
      } else {
        const distToPlayer = Math.hypot(maw.x - player.x, maw.z - player.z);
        const distToAnchor = Math.hypot(maw.x - maw.spawnX, maw.z - maw.spawnZ);

        if (distToPlayer <= AWARENESS_RADIUS || maw.inCombat) {
          if (distToPlayer > LEASH_RADIUS || distToAnchor > LEASH_RADIUS) {
            // Leash return & regenerate
            maw.inCombat = false;
            maw.health = Math.min(maw.maxHealth, maw.health + maw.maxHealth * 0.2 * dt);
          } else {
            maw.inCombat = true;
            eclipseActive = true; // Darkens skybox during battle
            const dx = player.x - maw.x;
            const dz = player.z - maw.z;
            maw.facing = Math.atan2(dx, dz);

            // Basic Serpent Strike
            if (clock >= bNextStrike) {
              bNextStrike = clock + 1.6;
              if (distToPlayer <= 3.8 + player.radius) {
                totalDamage += 80;
              }
            }

            // AoE Tail Sweep (360° Ring)
            if (clock >= bNextSweep) {
              bNextSweep = clock + 8.5;
              telegraphs.push({
                type: 'circle',
                x: maw.x,
                z: maw.z,
                radius: 6.5,
                colour: 0x4ad8ff,
              });
              if (distToPlayer <= 6.5 + player.radius) {
                totalDamage += 160;
              }
            }

            // Water Jet Cone
            if (clock >= bNextWaterJet) {
              bNextWaterJet = clock + 12.0;
              telegraphs.push({
                type: 'cone',
                x: maw.x,
                z: maw.z,
                heading: maw.facing,
                range: 9.0,
                halfAngle: Math.PI / 6,
                colour: 0x2e8b9a,
              });
              if (distToPlayer <= 9.0 + player.radius) {
                const angleToPlayer = Math.atan2(dx, dz);
                let diff = Math.abs(angleToPlayer - maw.facing);
                if (diff > Math.PI) diff = Math.PI * 2 - diff;
                if (diff <= Math.PI / 6) {
                  totalDamage += 220;
                }
              }
            }
          }
        }
      }

      // Check if Maw died this frame for reward
      if (!maw.alive && maw.respawnAt === clock + BOSS_RESPAWN) {
        buffGranted = {
          type: 'moons_eclipse',
          name: "Moon's Eclipse",
          duration: 180,
          description: '+20% Damage to Structures & True Damage for 3 mins',
        };
        announcement = "Maw slain! The Moon's Eclipse empowers the seekers!";
      }

      // ── 2. KAPRE AI ──────────────────────────────────────────────────────
      if (!treant.alive) {
        if (clock >= treant.respawnAt) {
          treant.health = treant.maxHealth;
          treant.alive = true;
          treant.inCombat = false;
          announcement = 'Treant has reawakened in the Banyan tree!';
        }
      } else {
        const distToPlayer = Math.hypot(treant.x - player.x, treant.z - player.z);
        const distToAnchor = Math.hypot(treant.x - treant.spawnX, treant.z - treant.spawnZ);

        if (distToPlayer <= AWARENESS_RADIUS || treant.inCombat) {
          if (distToPlayer > LEASH_RADIUS || distToAnchor > LEASH_RADIUS) {
            treant.inCombat = false;
            treant.health = Math.min(treant.maxHealth, treant.health + treant.maxHealth * 0.2 * dt);
          } else {
            treant.inCombat = true;
            const dx = player.x - treant.x;
            const dz = player.z - treant.z;
            treant.facing = Math.atan2(dx, dz);

            // Basic Club Slam
            if (clock >= kNextStrike) {
              kNextStrike = clock + 1.65;
              if (distToPlayer <= 3.2 + player.radius) {
                totalDamage += 95;
              }
            }

            // Heavy Ground Stomp (Stun/Slow AoE)
            if (clock >= kNextStomp) {
              kNextStomp = clock + 9.0;
              telegraphs.push({
                type: 'circle',
                x: treant.x,
                z: treant.z,
                radius: 5.5,
                colour: 0xff7a36,
              });
              if (distToPlayer <= 5.5 + player.radius) {
                totalDamage += 150;
              }
            }

            // Tabako Smoke Ring Cone
            if (clock >= kNextSmoke) {
              kNextSmoke = clock + 13.0;
              telegraphs.push({
                type: 'cone',
                x: treant.x,
                z: treant.z,
                heading: treant.facing,
                range: 7.5,
                halfAngle: Math.PI / 4,
                colour: 0x8c6239,
              });
              if (distToPlayer <= 7.5 + player.radius) {
                totalDamage += 110;
              }
            }
          }
        }
      }

      // Check if Treant died this frame for reward
      if (!treant.alive && treant.respawnAt === clock + BOSS_RESPAWN) {
        summonPushingTreant('mid');
        treantSummoned = true;
        announcement = 'Treant tamed! The Banyan Giant marches to crush enemy towers!';
      }

      // ── 3. PUSHING KAPRE SIEGE MARCH ─────────────────────────────────────
      const pk = pushingTreant;
      if (pk && pk.alive) {
        const stepFrac = (3.6 * dt) / 200;

        // Target enemy structures in range
        let targetStructure = null;
        for (const s of objectives.all) {
          if (s.team === 'dusk' && objectives.alive(s) && objectives.vulnerable(s)) {
            const gap = Math.hypot(s.x - pk.x, s.z - pk.z);
            if (gap <= 3.6 + s.radius) {
              targetStructure = s;
              break;
            }
          }
        }

        if (targetStructure) {
          pk.facing = Math.atan2(
            targetStructure.x - pk.x,
            targetStructure.z - pk.z
          );
          if (clock >= pTreantNextAtk) {
            pTreantNextAtk = clock + pk.attackCooldown;
            const applied = pk.damage * pk.structureMultiplier;
            targetStructure.health = Math.max(0, targetStructure.health - applied);
            onPushingTreantAttack?.(pk, targetStructure.x, targetStructure.z);
          }
        } else {
          // March toward Dusk base along mid lane
          pk.progress = Math.min(0.95, pk.progress + stepFrac);
          const t = pk.progress;
          // Approximate spline position along mid lane
          const ptX = -78 + t * 156;
          const ptZ = 78 - t * 156;
          pk.x = ptX;
          pk.z = ptZ;
          pk.facing = Math.atan2(1, -1);
        }
      }

      return {
        damageToPlayer: totalDamage,
        eclipseActive,
        buffGranted,
        treantSummoned,
        announcement,
        telegraphs,
      };
    },
  };
}
