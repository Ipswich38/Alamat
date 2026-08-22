// Major Boss Camps (Epic Objectives): Bakunawa and Kapre.
//
// ── EPIC BOSS 1: BAKUNAWA (The Moon-Eater) ──────────────────────────────────
// Sunken river basin pit (East river bend). Giant aquatic dragon/sea serpent emerging
// from a deep dark whirlpool.
// Attacks: AoE Tail Sweep, Water Jet Cone, Eclipse Aura (darkens skybox during combat).
// Reward: "Moon's Eclipse" Team Buff (+20% damage to structures & true damage for 3 mins).
//
// ── EPIC BOSS 2: KAPRE (The Giant Tree Warden) ──────────────────────────────
// Ancient Balete Tree lair (West jungle pit). Massive dark-furred giant holding
// a glowing tobacco pipe (Tabako).
// Attacks: Heavy Ground Stomp (Stun/Slow), Smoke Ring Debuff (blinds & slows attack).
// Reward: Spawns an allied Pushing Kapre Siege Giant in the nearest lane to smash turrets.

import { type LaneId } from '@/game/arena/lanes';
import type { Objectives } from './objectives';

export type BossKind = 'bakunawa' | 'kapre';

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

export interface PushingKapreUnit {
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
  kapreSummoned?: boolean;
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
  hits: (EpicBoss | PushingKapreUnit)[];
  felled: (EpicBoss | PushingKapreUnit)[];
}

export interface BossManager {
  readonly bakunawa: EpicBoss;
  readonly kapre: EpicBoss;
  readonly pushingKapre: PushingKapreUnit | null;
  update(
    dt: number,
    clock: number,
    player: { x: number; z: number; radius: number; hidden: boolean },
    objectives: Objectives,
    onPushingKapreAttack?: (k: PushingKapreUnit, tx: number, tz: number) => void
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
  const bakunawa: EpicBoss = {
    id: 'boss-bakunawa',
    kind: 'bakunawa',
    name: 'Bakunawa',
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

  const kapre: EpicBoss = {
    id: 'boss-kapre',
    kind: 'kapre',
    name: 'Kapre',
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

  let pushingKapre: PushingKapreUnit | null = null;

  // Attack timers
  let bNextStrike = 0;
  let bNextSweep = 0;
  let bNextWaterJet = 0;

  let kNextStrike = 0;
  let kNextStomp = 0;
  let kNextSmoke = 0;
  let pKapreNextAtk = 0;

  function summonPushingKapre(laneId: LaneId = 'mid') {
    pushingKapre = {
      id: 'allied-kapre-siege',
      name: 'Pushing Kapre',
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
    get bakunawa() {
      return bakunawa;
    },
    get kapre() {
      return kapre;
    },
    get pushingKapre() {
      return pushingKapre && pushingKapre.alive ? pushingKapre : null;
    },

    findTargetNear(x, z, maxRange) {
      if (bakunawa.alive && Math.hypot(bakunawa.x - x, bakunawa.z - z) <= maxRange) return bakunawa;
      if (kapre.alive && Math.hypot(kapre.x - x, kapre.z - z) <= maxRange) return kapre;
      return null;
    },

    strike(covers, amount, clock) {
      const report: BossStrikeReport = { hits: [], felled: [] };
      if (amount <= 0) return report;

      // Bakunawa
      if (bakunawa.alive && covers(bakunawa.x, bakunawa.z, bakunawa.radius)) {
        bakunawa.health = Math.max(0, bakunawa.health - amount);
        bakunawa.inCombat = true;
        report.hits.push(bakunawa);
        if (bakunawa.health <= 0) {
          bakunawa.alive = false;
          bakunawa.inCombat = false;
          bakunawa.respawnAt = clock + BOSS_RESPAWN;
          report.felled.push(bakunawa);
        }
      }

      // Kapre Boss
      if (kapre.alive && covers(kapre.x, kapre.z, kapre.radius)) {
        kapre.health = Math.max(0, kapre.health - amount);
        kapre.inCombat = true;
        report.hits.push(kapre);
        if (kapre.health <= 0) {
          kapre.alive = false;
          kapre.inCombat = false;
          kapre.respawnAt = clock + BOSS_RESPAWN;
          report.felled.push(kapre);
        }
      }

      return report;
    },

    update(dt, clock, player, objectives, onPushingKapreAttack) {
      let totalDamage = 0;
      let eclipseActive = false;
      let buffGranted: BossTickResult['buffGranted'] = undefined;
      let kapreSummoned = false;
      let announcement: string | undefined = undefined;
      const telegraphs: BossTickResult['telegraphs'] = [];

      // ── 1. BAKUNAWA AI ───────────────────────────────────────────────────
      if (!bakunawa.alive) {
        if (clock >= bakunawa.respawnAt) {
          bakunawa.health = bakunawa.maxHealth;
          bakunawa.alive = true;
          bakunawa.inCombat = false;
          announcement = 'Bakunawa has risen from the river whirlpool!';
        }
      } else {
        const distToPlayer = Math.hypot(bakunawa.x - player.x, bakunawa.z - player.z);
        const distToAnchor = Math.hypot(bakunawa.x - bakunawa.spawnX, bakunawa.z - bakunawa.spawnZ);

        if (distToPlayer <= AWARENESS_RADIUS || bakunawa.inCombat) {
          if (distToPlayer > LEASH_RADIUS || distToAnchor > LEASH_RADIUS) {
            // Leash return & regenerate
            bakunawa.inCombat = false;
            bakunawa.health = Math.min(bakunawa.maxHealth, bakunawa.health + bakunawa.maxHealth * 0.2 * dt);
          } else {
            bakunawa.inCombat = true;
            eclipseActive = true; // Darkens skybox during battle
            const dx = player.x - bakunawa.x;
            const dz = player.z - bakunawa.z;
            bakunawa.facing = Math.atan2(dx, dz);

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
                x: bakunawa.x,
                z: bakunawa.z,
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
                x: bakunawa.x,
                z: bakunawa.z,
                heading: bakunawa.facing,
                range: 9.0,
                halfAngle: Math.PI / 6,
                colour: 0x2e8b9a,
              });
              if (distToPlayer <= 9.0 + player.radius) {
                const angleToPlayer = Math.atan2(dx, dz);
                let diff = Math.abs(angleToPlayer - bakunawa.facing);
                if (diff > Math.PI) diff = Math.PI * 2 - diff;
                if (diff <= Math.PI / 6) {
                  totalDamage += 220;
                }
              }
            }
          }
        }
      }

      // Check if Bakunawa died this frame for reward
      if (!bakunawa.alive && bakunawa.respawnAt === clock + BOSS_RESPAWN) {
        buffGranted = {
          type: 'moons_eclipse',
          name: "Moon's Eclipse",
          duration: 180,
          description: '+20% Damage to Structures & True Damage for 3 mins',
        };
        announcement = "Bakunawa slain! The Moon's Eclipse empowers the seekers!";
      }

      // ── 2. KAPRE AI ──────────────────────────────────────────────────────
      if (!kapre.alive) {
        if (clock >= kapre.respawnAt) {
          kapre.health = kapre.maxHealth;
          kapre.alive = true;
          kapre.inCombat = false;
          announcement = 'Kapre has reawakened in the Balete tree!';
        }
      } else {
        const distToPlayer = Math.hypot(kapre.x - player.x, kapre.z - player.z);
        const distToAnchor = Math.hypot(kapre.x - kapre.spawnX, kapre.z - kapre.spawnZ);

        if (distToPlayer <= AWARENESS_RADIUS || kapre.inCombat) {
          if (distToPlayer > LEASH_RADIUS || distToAnchor > LEASH_RADIUS) {
            kapre.inCombat = false;
            kapre.health = Math.min(kapre.maxHealth, kapre.health + kapre.maxHealth * 0.2 * dt);
          } else {
            kapre.inCombat = true;
            const dx = player.x - kapre.x;
            const dz = player.z - kapre.z;
            kapre.facing = Math.atan2(dx, dz);

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
                x: kapre.x,
                z: kapre.z,
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
                x: kapre.x,
                z: kapre.z,
                heading: kapre.facing,
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

      // Check if Kapre died this frame for reward
      if (!kapre.alive && kapre.respawnAt === clock + BOSS_RESPAWN) {
        summonPushingKapre('mid');
        kapreSummoned = true;
        announcement = 'Kapre tamed! The Balete Giant marches to crush enemy towers!';
      }

      // ── 3. PUSHING KAPRE SIEGE MARCH ─────────────────────────────────────
      const pk = pushingKapre;
      if (pk && pk.alive) {
        const stepFrac = (3.6 * dt) / 200;

        // Target enemy structures in range
        let targetStructure = null;
        for (const s of objectives.all) {
          if (s.team === 'malakas' && objectives.alive(s) && objectives.vulnerable(s)) {
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
          if (clock >= pKapreNextAtk) {
            pKapreNextAtk = clock + pk.attackCooldown;
            const applied = pk.damage * pk.structureMultiplier;
            targetStructure.health = Math.max(0, targetStructure.health - applied);
            onPushingKapreAttack?.(pk, targetStructure.x, targetStructure.z);
          }
        } else {
          // March toward Malakas base along mid lane
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
        kapreSummoned,
        announcement,
        telegraphs,
      };
    },
  };
}
