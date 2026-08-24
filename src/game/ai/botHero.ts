// Autonomous Lane AI Bot Hero (Opponent Controller)
//
// ── AI STATE MACHINE ────────────────────────────────────────────────────────
// 1. LANING: Follows lane waypoint spline to push towers alongside minions.
// 2. HARASS: If player is within attack radius (10u), faces player and casts abilities.
// 3. RETREAT: If health drops below 28%, dashes/runs towards nearest allied tower.
// 4. RESPAWN: If killed, waits 8.0s before respawning at Malakas sanctuary.

import { HEROES, type Hero } from '@/game/heroes';
import { TEAMS, type TeamId } from '@/game/arena/nexus';
import { LANES } from '@/game/arena/lanes';
import type { CastSlot, CooldownState } from '@/game/combat';
import { EMPTY_COOLDOWNS } from '@/game/combat/casting';
import { getScaledMaxHp } from '@/game/combat/progression';

export type BotState = 'laning' | 'engaging' | 'retreating' | 'dead';

export interface BotAction {
  type: 'move' | 'cast' | 'attack';
  slot?: CastSlot;
  targetX?: number;
  targetZ?: number;
  heading?: number;
}

export interface BotHero {
  hero: Hero;
  team: TeamId;
  x: number;
  z: number;
  heading: number;
  health: number;
  maxHealth: number;
  level: number;
  state: BotState;
  respawnTime: number;
  cooldowns: CooldownState;
  update: (
    delta: number,
    playerX: number,
    playerZ: number,
    playerHp: number
  ) => BotAction | null;
  takeDamage: (amount: number) => boolean; // returns true if killed
  respawn: () => void;
}

export function createBotHero(
  heroId: string = 'aswang',
  team: TeamId = 'malakas',
  laneIndex: number = 1 // 0: Top, 1: Mid, 2: Bot
): BotHero {
  const hero = HEROES.find((h) => h.id === heroId) ?? HEROES[2]; // Default Aswang
  const spawnPos = TEAMS[team].spawn;
  const lane = LANES[laneIndex] || LANES[1];

  let x = spawnPos.x;
  let z = spawnPos.z;
  let heading = Math.PI * 1.25;
  const level = 7;
  const maxHealth = getScaledMaxHp(hero.health, level);
  let health = maxHealth;
  let state: BotState = 'laning';
  let respawnTime = 0;
  const cooldowns: CooldownState = { ...EMPTY_COOLDOWNS };

  // Lane waypoint index (0 to length - 1)
  // For Malakas (starts at lane end, moves towards index 0)
  let waypointIdx = lane.path.length - 2;

  const respawn = () => {
    x = spawnPos.x;
    z = spawnPos.z;
    health = maxHealth;
    state = 'laning';
    respawnTime = 0;
    waypointIdx = lane.path.length - 2;
  };

  const takeDamage = (amount: number): boolean => {
    if (state === 'dead') return false;
    health = Math.max(0, health - amount);
    if (health <= 0) {
      state = 'dead';
      respawnTime = 8.0;
      return true; // Killed!
    }
    return false;
  };

  const update = (
    delta: number,
    playerX: number,
    playerZ: number,
    playerHp: number
  ): BotAction | null => {
    // Tick cooldowns
    (Object.keys(cooldowns) as CastSlot[]).forEach((slot) => {
      if (cooldowns[slot] > 0) {
        cooldowns[slot] = Math.max(0, cooldowns[slot] - delta);
      }
    });

    // Dead state handling
    if (state === 'dead') {
      respawnTime -= delta;
      if (respawnTime <= 0) {
        respawn();
      }
      return null;
    }

    const distToPlayer = Math.hypot(playerX - x, playerZ - z);
    const speed = hero.speed * delta;

    // State Transitions
    if (health < maxHealth * 0.28) {
      state = 'retreating';
    } else if (distToPlayer < 11.0 && playerHp > 0) {
      state = 'engaging';
    } else {
      state = 'laning';
    }

    // ── STATE EXECUTION ───────────────────────────────────────────────────

    if (state === 'retreating') {
      // Run back towards Malakas base
      const targetX = spawnPos.x;
      const targetZ = spawnPos.z;
      const dx = targetX - x;
      const dz = targetZ - z;
      const dist = Math.hypot(dx, dz);

      if (dist > 1.0) {
        heading = Math.atan2(dx, dz);
        x += (dx / dist) * speed * 1.15;
        z += (dz / dist) * speed * 1.15;
      } else {
        // Recover HP at fountain
        health = Math.min(maxHealth, health + maxHealth * 0.25 * delta);
        if (health >= maxHealth * 0.85) {
          state = 'laning';
        }
      }

      // If dash ability is ready, use it to escape!
      if (cooldowns.ability0 <= 0 && hero.abilities[0]?.shape === 'dash') {
        cooldowns.ability0 = hero.abilities[0].cooldown;
        return { type: 'cast', slot: 'ability0', targetX: x + Math.sin(heading) * 8, targetZ: z + Math.cos(heading) * 8, heading };
      }

      return { type: 'move', targetX: x, targetZ: z, heading };
    }

    if (state === 'engaging') {
      // Turn towards player
      const dx = playerX - x;
      const dz = playerZ - z;
      heading = Math.atan2(dx, dz);

      // Check ability casts
      if (cooldowns.ultimate <= 0 && hero.ultimate && distToPlayer <= hero.ultimate.range) {
        cooldowns.ultimate = hero.ultimate.cooldown;
        return { type: 'cast', slot: 'ultimate', targetX: playerX, targetZ: playerZ, heading };
      }

      if (cooldowns.ability1 <= 0 && hero.abilities[1] && distToPlayer <= hero.abilities[1].range) {
        cooldowns.ability1 = hero.abilities[1].cooldown;
        return { type: 'cast', slot: 'ability1', targetX: playerX, targetZ: playerZ, heading };
      }

      if (cooldowns.ability2 <= 0 && hero.abilities[2] && distToPlayer <= hero.abilities[2].range) {
        cooldowns.ability2 = hero.abilities[2].cooldown;
        return { type: 'cast', slot: 'ability2', targetX: playerX, targetZ: playerZ, heading };
      }

      if (cooldowns.ability0 <= 0 && hero.abilities[0] && distToPlayer <= hero.abilities[0].range) {
        cooldowns.ability0 = hero.abilities[0].cooldown;
        return { type: 'cast', slot: 'ability0', targetX: playerX, targetZ: playerZ, heading };
      }

      // Basic Attack if in attack range
      if (distToPlayer <= hero.attackRange) {
        if (cooldowns.basic <= 0) {
          cooldowns.basic = hero.attackCooldown;
          return { type: 'attack', targetX: playerX, targetZ: playerZ, heading };
        }
      } else {
        // Move into attack range
        x += (dx / distToPlayer) * speed;
        z += (dz / distToPlayer) * speed;
      }

      return { type: 'move', targetX: x, targetZ: z, heading };
    }

    // Laning state: march along waypoints towards enemy base
    const currentWaypoint = lane.path[waypointIdx];
    if (currentWaypoint) {
      const [wx, wz] = currentWaypoint;
      const dx = wx - x;
      const dz = wz - z;
      const dist = Math.hypot(dx, dz);

      if (dist < 2.5) {
        if (waypointIdx > 0) waypointIdx--;
      } else {
        heading = Math.atan2(dx, dz);
        x += (dx / dist) * speed;
        z += (dz / dist) * speed;
      }
    }

    return { type: 'move', targetX: x, targetZ: z, heading };
  };

  return {
    hero,
    team,
    get x() { return x; },
    set x(val: number) { x = val; },
    get z() { return z; },
    set z(val: number) { z = val; },
    get heading() { return heading; },
    set heading(val: number) { heading = val; },
    get health() { return health; },
    set health(val: number) { health = val; },
    get maxHealth() { return maxHealth; },
    get level() { return level; },
    get state() { return state; },
    get respawnTime() { return respawnTime; },
    cooldowns,
    update,
    takeDamage,
    respawn,
  };
}
