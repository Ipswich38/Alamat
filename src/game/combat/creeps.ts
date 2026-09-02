// Neutral Jungle Creeps: Veer Tricksters, Hollow Stalkers, and Idol Guardians.
import { CAMPS, type Camp } from "@/game/arena/camps";

export type CreepKind = "tikbalang_leader" | "tikbalang_wisp" | "aswang_stalker" | "idol_guardian" | "scuttler";
export type JungleBuffType = "wind_stride" | "blood_thirst" | "idol_blessing" | "river_stride" | "amihan_haste" | "bathala_tenacity" | "ginhawa_heal";

export interface CreepUnit {
  id: string;
  campId: string;
  kind: CreepKind;
  name: string;
  anchorX: number;
  anchorZ: number;
  x: number;
  z: number;
  facing: number;
  health: number;
  maxHealth: number;
  radius: number;
  damage: number;
  range: number;
  speed: number;
  attackCooldown: number;
  defenseReduction: number;
  alive: boolean;
  state: "idle" | "chasing" | "returning";
}

export interface CreepTickResult {
  damageToPlayer: number;
  buffGranted?: {
    type: JungleBuffType;
    name: string;
    duration: number;
    description: string;
  };
  clearedCampName?: string;
  aoeSlam?: { x: number; z: number; radius: number };
}

export interface CreepStrikeReport {
  hits: CreepUnit[];
  felled: CreepUnit[];
}

export interface CreepManager {
  readonly creeps: CreepUnit[];
  update(
    dt: number,
    clock: number,
    player: { x: number; z: number; radius: number; hidden: boolean }
  ): CreepTickResult;
  strike(
    covers: (x: number, z: number, radius: number) => boolean,
    amount: number
  ): CreepStrikeReport;
  findTargetNear(x: number, z: number, maxRange: number): CreepUnit | null;
}

const LEASH_RADIUS = 8.0;
const AWARENESS_RADIUS = 7.0;
const MINOR_RESPAWN = 75.0;
const MEDIUM_RESPAWN = 90.0;

interface CampTracker {
  camp: Camp;
  units: CreepUnit[];
  cleared: boolean;
  respawnAt: number;
}

export function createCreepManager(): CreepManager {
  const campTrackers: CampTracker[] = [];
  const attackTimers = new Map<string, number>();
  const slamTimers = new Map<string, number>();

  const creepCamps = CAMPS.filter((c) => !c.id.includes("pit") && !c.id.includes("lair"));

  function spawnCamp(camp: Camp): CreepUnit[] {
    const units: CreepUnit[] = [];

    if (camp.id.startsWith("veer")) {
      units.push({
        id: camp.id + "-leader",
        campId: camp.id,
        kind: "tikbalang_leader",
        name: "Veer Trickster",
        anchorX: camp.x,
        anchorZ: camp.z,
        x: camp.x,
        z: camp.z,
        facing: Math.atan2(-camp.x, -camp.z),
        health: 750,
        maxHealth: 750,
        radius: 1.25,
        damage: 36,
        range: 2.3,
        speed: 4.2,
        attackCooldown: 1.15,
        defenseReduction: 0,
        alive: true,
        state: "idle",
      });

      const offsets = [
        { dx: -1.6, dz: 1.4 },
        { dx: 1.6, dz: 1.4 },
      ];
      for (let i = 0; i < 2; i++) {
        units.push({
          id: camp.id + "-wisp-" + i,
          campId: camp.id,
          kind: "tikbalang_wisp",
          name: "Forest Spirit",
          anchorX: camp.x + offsets[i].dx,
          anchorZ: camp.z + offsets[i].dz,
          x: camp.x + offsets[i].dx,
          z: camp.z + offsets[i].dz,
          facing: Math.atan2(-camp.x, -camp.z),
          health: 320,
          maxHealth: 320,
          radius: 0.8,
          damage: 18,
          range: 2.0,
          speed: 4.4,
          attackCooldown: 1.0,
          defenseReduction: 0,
          alive: true,
          state: "idle",
        });
      }
    } else if (camp.id.startsWith("hollow")) {
      const offsets = [
        { dx: -1.4, dz: -0.8 },
        { dx: 1.4, dz: 0.8 },
      ];
      for (let i = 0; i < 2; i++) {
        units.push({
          id: camp.id + "-stalker-" + i,
          campId: camp.id,
          kind: "aswang_stalker",
          name: "Hollow Stalker",
          anchorX: camp.x + offsets[i].dx,
          anchorZ: camp.z + offsets[i].dz,
          x: camp.x + offsets[i].dx,
          z: camp.z + offsets[i].dz,
          facing: Math.atan2(-camp.x, -camp.z),
          health: 620,
          maxHealth: 620,
          radius: 1.05,
          damage: 32,
          range: 2.2,
          speed: 4.8,
          attackCooldown: 0.75,
          defenseReduction: 0,
          alive: true,
          state: "idle",
        });
      }
    } else if (camp.id.startsWith("idol")) {
      units.push({
        id: camp.id + "-guardian",
        campId: camp.id,
        kind: "idol_guardian",
        name: "Idol Guardian",
        anchorX: camp.x,
        anchorZ: camp.z,
        x: camp.x,
        z: camp.z,
        facing: Math.atan2(-camp.x, -camp.z),
        health: 1400,
        maxHealth: 1400,
        radius: 1.5,
        damage: 65,
        range: 3.2,
        speed: 3.2,
        attackCooldown: 1.6,
        defenseReduction: 0.25,
        alive: true,
        state: "idle",
      });
    } else if (camp.id.startsWith("scuttler")) {
      units.push({
        id: camp.id + "-crab",
        campId: camp.id,
        kind: "scuttler",
        name: "Gintong Alimango",
        anchorX: camp.x,
        anchorZ: camp.z,
        x: camp.x,
        z: camp.z,
        facing: Math.atan2(-camp.x, -camp.z),
        health: 1100,
        maxHealth: 1100,
        radius: 1.1,
        damage: 8,
        range: 1.8,
        speed: 5.2,
        attackCooldown: 2.0,
        defenseReduction: 0.1,
        alive: true,
        state: "idle",
      });
    }
    return units;
  }

  for (const camp of creepCamps) {
    campTrackers.push({
      camp,
      units: spawnCamp(camp),
      cleared: false,
      respawnAt: 0,
    });
  }

  return {
    get creeps() {
      const all: CreepUnit[] = [];
      for (const t of campTrackers) {
        for (const u of t.units) {
          if (u.alive) all.push(u);
        }
      }
      return all;
    },

    findTargetNear(x, z, maxRange) {
      let best: CreepUnit | null = null;
      let bestD = maxRange;
      for (const t of campTrackers) {
        for (const u of t.units) {
          if (!u.alive) continue;
          const d = Math.hypot(u.x - x, u.z - z);
          if (d < bestD) {
            bestD = d;
            best = u;
          }
        }
      }
      return best;
    },

    strike(covers, amount) {
      const report: CreepStrikeReport = { hits: [], felled: [] };
      if (amount <= 0) return report;

      for (const t of campTrackers) {
        for (const u of t.units) {
          if (!u.alive) continue;
          if (!covers(u.x, u.z, u.radius)) continue;
          const actualDamage = amount * (1 - u.defenseReduction);
          u.health = Math.max(0, u.health - actualDamage);
          if (u.state === "idle") u.state = "chasing";
          report.hits.push(u);
          if (u.health <= 0) {
            u.alive = false;
            report.felled.push(u);
          }
        }
      }
      return report;
    },

    update(dt, clock, player) {
      let totalDamage = 0;
      let buffGranted: CreepTickResult["buffGranted"] = undefined;
      let clearedCampName: string | undefined = undefined;
      let aoeSlam: CreepTickResult["aoeSlam"] = undefined;

      for (const tracker of campTrackers) {
        if (tracker.cleared) {
          if (clock >= tracker.respawnAt) {
            tracker.units = spawnCamp(tracker.camp);
            tracker.cleared = false;
          }
          continue;
        }

        const aliveCount = tracker.units.filter((u) => u.alive).length;
        if (aliveCount === 0 && !tracker.cleared) {
          tracker.cleared = true;
          const isMedium = tracker.camp.id.startsWith("idol");
          const isScuttler = tracker.camp.id.startsWith("scuttler");
          tracker.respawnAt = clock + (isMedium ? MEDIUM_RESPAWN : isScuttler ? 60.0 : MINOR_RESPAWN);
          clearedCampName = tracker.camp.name;

          if (tracker.camp.id.startsWith("veer")) {
            buffGranted = {
              type: "wind_stride",
              name: "Wind Stride",
              duration: 60,
              description: "+35% Movement Speed for 60s",
            };
          } else if (tracker.camp.id.startsWith("hollow")) {
            buffGranted = {
              type: "blood_thirst",
              name: "Blood Thirst",
              duration: 60,
              description: "+20% Lifesteal & +30% Attack Speed for 60s",
            };
          } else if (tracker.camp.id.startsWith("idol")) {
            buffGranted = {
              type: "idol_blessing",
              name: "Idol Blessing",
              duration: 90,
              description: "+35 HP/s Regen & 20% CDR for 90s",
            };
          } else if (tracker.camp.id.startsWith("scuttler")) {
            buffGranted = {
              type: "river_stride",
              name: "River Stride",
              duration: 60,
              description: "+35% River Movement Speed & Vision Shrine for 60s",
            };
          }
          continue;
        }

        for (const u of tracker.units) {
          if (!u.alive) continue;
          const distToAnchor = Math.hypot(u.x - u.anchorX, u.z - u.anchorZ);
          const distToPlayer = Math.hypot(u.x - player.x, u.z - player.z);
          const anchorToPlayer = Math.hypot(player.x - u.anchorX, player.z - u.anchorZ);

          if (anchorToPlayer > LEASH_RADIUS || distToAnchor > LEASH_RADIUS + 1.5) {
            u.state = "returning";
          } else if (!player.hidden && distToPlayer < AWARENESS_RADIUS) {
            u.state = "chasing";
          }

          if (u.state === "returning") {
            const toAnchorX = u.anchorX - u.x;
            const toAnchorZ = u.anchorZ - u.z;
            const d = Math.hypot(toAnchorX, toAnchorZ);
            if (d > 0.3) {
              const step = (u.speed * 1.35 * dt) / d;
              u.x += toAnchorX * step;
              u.z += toAnchorZ * step;
              u.facing = Math.atan2(toAnchorX, toAnchorZ);
              u.health = Math.min(u.maxHealth, u.health + u.maxHealth * 0.25 * dt);
            } else {
              u.x = u.anchorX;
              u.z = u.anchorZ;
              u.health = u.maxHealth;
              u.state = "idle";
            }
          } else if (u.state === "chasing") {
            if (u.kind === "scuttler") {
              // Scuttler flees away from player along the river channel
              const fx = u.x - player.x;
              const fz = u.z - player.z;
              const d = Math.hypot(fx, fz) || 1;
              u.facing = Math.atan2(fx, fz);
              const step = u.speed * dt;
              u.x += (fx / d) * step;
              u.z += (fz / d) * step;
              continue;
            }

            const dx = player.x - u.x;
            const dz = player.z - u.z;
            const gap = Math.hypot(dx, dz);
            u.facing = Math.atan2(dx, dz);

            if (gap > u.range + player.radius) {
              const step = (u.speed * dt) / (gap || 1);
              u.x += dx * step;
              u.z += dz * step;
            } else {
              const nextAtk = attackTimers.get(u.id) ?? 0;
              if (clock >= nextAtk) {
                attackTimers.set(u.id, clock + u.attackCooldown);
                totalDamage += u.damage;
              }

              if (u.kind === "idol_guardian") {
                const nextSlam = slamTimers.get(u.id) ?? (clock + 3.0);
                if (clock >= nextSlam) {
                  slamTimers.set(u.id, clock + 4.8);
                  aoeSlam = { x: u.x, z: u.z, radius: 4.8 };
                  if (distToPlayer <= 4.8 + player.radius) {
                    totalDamage += 45;
                  }
                }
              }
            }
          }
        }
      }

      return {
        damageToPlayer: totalDamage,
        buffGranted,
        clearedCampName,
        aoeSlam,
      };
    },
  };
}