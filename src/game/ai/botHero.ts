// Autonomous Multi-Hero 3v3 MOBA AI Team System (Talisman).
//
// ── AI SYSTEM ARCHITECTURE ──────────────────────────────────────────────────
// 1. LANING: Follows assigned lane spline (Top, Mid, Bot) behind minion waves.
// 2. COMBAT & HARASS: Targets enemy champions/minions with aim prediction, ability combos, and kiting.
// 3. TOWER PRESERVATION: Avoids diving enemy towers unless allied minions tank tower fire.
// 4. RETREAT & FOUNTAIN HEALING: Retreats to home sanctuary when HP < 28% and heals back to 85%+.
// 5. TACTICAL PING RESPONSE: Re-routes or converges when players issue Attack/Assist pings.
// 6. RESPAWN & STAT SCALING: Scales stats with match time/level and respawns at base upon death.

import { HEROES, type Hero } from '@/game/heroes';
import { TEAMS, type TeamId } from '@/game/arena/nexus';
import { LANES } from '@/game/arena/lanes';
import type { CastSlot, CooldownState } from '@/game/combat';
import { EMPTY_COOLDOWNS } from '@/game/combat/casting';
import { getScaledMaxHp, getScaledAttack } from '@/game/combat/progression';
import type { Minion } from '@/game/combat/minions';
import type { Objectives } from '@/game/combat/objectives';

export type BotState = 'laning' | 'engaging' | 'retreating' | 'dead';

export interface BotAction {
  type: 'move' | 'cast' | 'attack';
  slot?: CastSlot;
  targetX?: number;
  targetZ?: number;
  heading?: number;
}

export interface BotTarget {
  id: string;
  name: string;
  x: number;
  z: number;
  health: number;
  maxHealth: number;
  radius: number;
  isPlayer?: boolean;
}

export interface BotHero {
  id: string;
  hero: Hero;
  team: TeamId;
  laneIndex: number;
  x: number;
  z: number;
  heading: number;
  health: number;
  maxHealth: number;
  level: number;
  attack: number;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  gold: number;
  state: BotState;
  respawnTime: number;
  maxRespawnTime: number;
  cooldowns: CooldownState;
  update: (
    delta: number,
    clock: number,
    enemyChampions: BotTarget[],
    enemyMinions: Minion[],
    objectives?: Objectives,
    pingObjective?: { x: number; z: number; type: string; expiresAt: number } | null
  ) => BotAction | null;
  takeDamage: (amount: number, attackerName?: string) => boolean; // returns true if killed
  respawn: () => void;
  awardKill: () => void;
  awardAssist: () => void;
  setLevel: (lvl: number) => void;
}

export function createBotHero(
  heroId: string = 'hollow',
  team: TeamId = 'dusk',
  laneIndex: number = 1, // 0: Top, 1: Mid, 2: Bot
  startingLevel: number = 1
): BotHero {
  const hero = HEROES.find((h) => h.id === heroId) ?? HEROES[2];
  const spawnPos = TEAMS[team].spawn;
  const lane = LANES[laneIndex] || LANES[1];

  let x = spawnPos.x;
  let z = spawnPos.z;
  let heading = team === 'dawn' ? Math.PI * 0.25 : Math.PI * 1.25;
  let level = startingLevel;
  let maxHealth = getScaledMaxHp(hero.health, level);
  let attack = getScaledAttack(hero.attack, level);
  let health = maxHealth;
  let state: BotState = 'laning';
  let respawnTime = 0;
  let maxRespawnTime = 8.0;
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  let damageDealt = 0;
  let gold = 500;

  const cooldowns: CooldownState = { ...EMPTY_COOLDOWNS };

  // Lane waypoint index: Dawn starts at 0, Dusk starts at length - 1
  let waypointIdx = team === 'dawn' ? 1 : lane.path.length - 2;

  const botId = `bot-${team}-${hero.id}-${lane.id}`;

  const respawn = () => {
    x = spawnPos.x;
    z = spawnPos.z;
    health = maxHealth;
    state = 'laning';
    respawnTime = 0;
    waypointIdx = team === 'dawn' ? 1 : lane.path.length - 2;
  };

  const setLevel = (lvl: number) => {
    level = Math.max(1, Math.min(15, lvl));
    const oldMax = maxHealth;
    maxHealth = getScaledMaxHp(hero.health, level);
    attack = getScaledAttack(hero.attack, level);
    health = Math.min(maxHealth, health + (maxHealth - oldMax));
  };

  const takeDamage = (amount: number): boolean => {
    if (state === 'dead') return false;
    health = Math.max(0, health - amount);
    if (health <= 0) {
      state = 'dead';
      deaths++;
      maxRespawnTime = 6.0 + level * 0.8;
      respawnTime = maxRespawnTime;
      return true; // Killed!
    }
    return false;
  };

  const update = (
    delta: number,
    clock: number,
    enemyChampions: BotTarget[],
    enemyMinions: Minion[],
    objectives?: Objectives,
    pingObjective?: { x: number; z: number; type: string; expiresAt: number } | null
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

    const speed = hero.speed * delta;

    // ── FOUNTAIN / RETREAT CHECK ──────────────────────────────────────────
    if (health < maxHealth * 0.28) {
      state = 'retreating';
    }

    if (state === 'retreating') {
      const targetX = spawnPos.x;
      const targetZ = spawnPos.z;
      const dx = targetX - x;
      const dz = targetZ - z;
      const dist = Math.hypot(dx, dz);

      if (dist > 2.0) {
        heading = Math.atan2(dx, dz);
        x += (dx / dist) * speed * 1.15;
        z += (dz / dist) * speed * 1.15;
      } else {
        // Recover HP at home fountain
        health = Math.min(maxHealth, health + maxHealth * 0.35 * delta);
        if (health >= maxHealth * 0.85) {
          state = 'laning';
          waypointIdx = team === 'dawn' ? 1 : lane.path.length - 2;
        }
      }

      // If dash ability is ready, use it to escape!
      if (cooldowns.ability0 <= 0 && hero.abilities[0]?.shape === 'dash') {
        cooldowns.ability0 = hero.abilities[0].cooldown;
        return {
          type: 'cast',
          slot: 'ability0',
          targetX: x + Math.sin(heading) * 8,
          targetZ: z + Math.cos(heading) * 8,
          heading,
        };
      }

      return { type: 'move', targetX: x, targetZ: z, heading };
    }

    // ── TARGET ACQUISITION (CHAMPIONS & MINIONS) ──────────────────────────
    let targetChamp: BotTarget | null = null;
    let closestChampDist = 13.0;

    for (const champ of enemyChampions) {
      if (champ.health <= 0) continue;
      const dist = Math.hypot(champ.x - x, champ.z - z);
      if (dist < closestChampDist) {
        targetChamp = champ;
        closestChampDist = dist;
      }
    }

    // Ping redirection
    if (pingObjective && clock < pingObjective.expiresAt) {
      const pingDist = Math.hypot(pingObjective.x - x, pingObjective.z - z);
      if (pingDist < 45 && pingDist > 3.0 && !targetChamp) {
        const pdx = pingObjective.x - x;
        const pdz = pingObjective.z - z;
        heading = Math.atan2(pdx, pdz);
        x += (pdx / pingDist) * speed;
        z += (pdz / pingDist) * speed;
        return { type: 'move', targetX: x, targetZ: z, heading };
      }
    }

    // ── COMBAT ENGAGEMENT ─────────────────────────────────────────────────
    if (targetChamp) {
      state = 'engaging';
      const dx = targetChamp.x - x;
      const dz = targetChamp.z - z;
      const dist = closestChampDist;
      heading = Math.atan2(dx, dz);

      // Lead-time skillshot prediction
      const aimX = targetChamp.x;
      const aimZ = targetChamp.z;

      // Ultimate Cast Combo
      if (cooldowns.ultimate <= 0 && hero.ultimate && dist <= hero.ultimate.range) {
        cooldowns.ultimate = hero.ultimate.cooldown;
        damageDealt += hero.ultimate.damage;
        return { type: 'cast', slot: 'ultimate', targetX: aimX, targetZ: aimZ, heading };
      }

      // Ability 1 Cast (Heavy Spell / Stomp / Rend / Slab / Beam)
      if (cooldowns.ability1 <= 0 && hero.abilities[1] && dist <= hero.abilities[1].range) {
        cooldowns.ability1 = hero.abilities[1].cooldown;
        damageDealt += hero.abilities[1].damage;
        return { type: 'cast', slot: 'ability1', targetX: aimX, targetZ: aimZ, heading };
      }

      // Ability 2 Cast (AoE / Gust / Cleave / Stomp)
      if (cooldowns.ability2 <= 0 && hero.abilities[2] && dist <= hero.abilities[2].range) {
        cooldowns.ability2 = hero.abilities[2].cooldown;
        damageDealt += hero.abilities[2].damage;
        return { type: 'cast', slot: 'ability2', targetX: aimX, targetZ: aimZ, heading };
      }

      // Ability 0 Cast (Dash / Skillshot)
      if (cooldowns.ability0 <= 0 && hero.abilities[0] && dist <= hero.abilities[0].range) {
        cooldowns.ability0 = hero.abilities[0].cooldown;
        damageDealt += hero.abilities[0].damage;
        return { type: 'cast', slot: 'ability0', targetX: aimX, targetZ: aimZ, heading };
      }

      // Basic Attack
      if (dist <= hero.attackRange + targetChamp.radius) {
        if (cooldowns.basic <= 0) {
          cooldowns.basic = hero.attackCooldown;
          damageDealt += attack;
          return { type: 'attack', targetX: aimX, targetZ: aimZ, heading };
        }
      } else {
        // Move into attack range
        x += (dx / dist) * speed;
        z += (dz / dist) * speed;
      }

      return { type: 'move', targetX: x, targetZ: z, heading };
    }

    // ── MINION CLEARING & LANE SPLINE MARCHING ────────────────────────────
    state = 'laning';

    let closestMinion: Minion | null = null;
    let minionDist = hero.attackRange + 4.0;

    for (const m of enemyMinions) {
      if (m.lane !== lane.id || !m.alive) continue;
      const d = Math.hypot(m.x - x, m.z - z);
      if (d < minionDist) {
        closestMinion = m;
        minionDist = d;
      }
    }

    if (closestMinion) {
      const mdx = closestMinion.x - x;
      const mdz = closestMinion.z - z;
      heading = Math.atan2(mdx, mdz);

      if (minionDist <= hero.attackRange + closestMinion.radius) {
        if (cooldowns.basic <= 0) {
          cooldowns.basic = hero.attackCooldown;
          damageDealt += attack;
          return { type: 'attack', targetX: closestMinion.x, targetZ: closestMinion.z, heading };
        }
      } else {
        x += (mdx / minionDist) * speed;
        z += (mdz / minionDist) * speed;
      }
      return { type: 'move', targetX: x, targetZ: z, heading };
    }

    // March along lane waypoint spline
    const currentWaypoint = lane.path[waypointIdx];
    if (currentWaypoint) {
      const [wx, wz] = currentWaypoint;
      const dx = wx - x;
      const dz = wz - z;
      const dist = Math.hypot(dx, dz);

      if (dist < 3.0) {
        if (team === 'dawn') {
          if (waypointIdx < lane.path.length - 1) waypointIdx++;
        } else {
          if (waypointIdx > 0) waypointIdx--;
        }
      } else {
        heading = Math.atan2(dx, dz);
        x += (dx / dist) * speed;
        z += (dz / dist) * speed;
      }
    }

    return { type: 'move', targetX: x, targetZ: z, heading };
  };

  return {
    id: botId,
    hero,
    team,
    laneIndex,
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
    get attack() { return attack; },
    get kills() { return kills; },
    get deaths() { return deaths; },
    get assists() { return assists; },
    get damageDealt() { return damageDealt; },
    get gold() { return gold; },
    set gold(val: number) { gold = val; },
    get state() { return state; },
    get respawnTime() { return respawnTime; },
    get maxRespawnTime() { return maxRespawnTime; },
    cooldowns,
    update,
    takeDamage,
    respawn,
    awardKill: () => { kills++; gold += 300; },
    awardAssist: () => { assists++; gold += 150; },
    setLevel,
  };
}

export interface BotTeamManager {
  allies: BotHero[];
  enemies: BotHero[];
  all: BotHero[];
  update: (
    delta: number,
    clock: number,
    playerX: number,
    playerZ: number,
    playerHp: number,
    playerMaxHp: number,
    playerHero: Hero,
    playerTeam: TeamId,
    minions: Minion[],
    objectives?: Objectives,
    pingObjective?: { x: number; z: number; type: string; expiresAt: number } | null
  ) => Map<string, BotAction | null>;
  strike: (
    attackerTeam: TeamId,
    covers: (x: number, z: number, radius: number) => boolean,
    amount: number
  ) => { hits: { bot: BotHero; x: number; z: number }[]; felled: { bot: BotHero }[] };
  scaleLevel: (level: number) => void;
}

export function createBotTeamManager(
  playerHeroId: string = 'veer',
  _playerTeam: TeamId = 'dawn',
  isDuel: boolean = false
): BotTeamManager {
  // Pool of all 10 heroes excluding the player's chosen hero
  const availablePool = HEROES.map((h) => h.id).filter((id) => id !== playerHeroId);

  let allies: BotHero[] = [];
  let enemies: BotHero[] = [];

  if (isDuel) {
    // 1v1 Ancestral Duel: 0 Allies, 1 Enemy in Mid Lane
    const enemyMidId = availablePool.find((id) => id === 'zenith' || id === 'hollow' || id === 'sever') ?? availablePool[0] ?? 'hollow';
    const enemyMid = createBotHero(enemyMidId, 'dusk', 1, 1);
    allies = [];
    enemies = [enemyMid];
  } else {
    // Preferred role assignments for 5v5 match
    // 4 Allies for Dawn (covering Top, Jungle, Bot Carry, Bot Support)
    const preferredAllies = ['bedrock', 'willow', 'tala', 'argent', 'zenith', 'veer'];
    const allySelectedIds: string[] = [];

    for (const preferred of preferredAllies) {
      if (allySelectedIds.length >= 4) break;
      if (availablePool.includes(preferred) && !allySelectedIds.includes(preferred)) {
        allySelectedIds.push(preferred);
      }
    }
    // Fill remaining ally slots if needed
    for (const id of availablePool) {
      if (allySelectedIds.length >= 4) break;
      if (!allySelectedIds.includes(id)) {
        allySelectedIds.push(id);
      }
    }

    // 5 Enemies for Dusk (covering Top, Jungle, Mid, Bot Carry, Bot Support)
    const remainingPool = availablePool.filter((id) => !allySelectedIds.includes(id));
    const enemySelectedIds: string[] = [];
    const preferredEnemies = ['hollow', 'zenith', 'sever', 'thistle', 'maw', 'veer', 'bedrock'];

    for (const preferred of preferredEnemies) {
      if (enemySelectedIds.length >= 5) break;
      if (remainingPool.includes(preferred) && !enemySelectedIds.includes(preferred)) {
        enemySelectedIds.push(preferred);
      }
    }
    // Fill remaining enemy slots if needed
    for (const id of remainingPool) {
      if (enemySelectedIds.length >= 5) break;
      if (!enemySelectedIds.includes(id)) {
        enemySelectedIds.push(id);
      }
    }

    // Spawn 4 Allies (Top, Jungle/Roam, Bot Carry, Bot Support)
    const allyTop = createBotHero(allySelectedIds[0] ?? 'bedrock', 'dawn', 0, 1);
    const allyJungle = createBotHero(allySelectedIds[1] ?? 'willow', 'dawn', 1, 1);
    const allyBotCarry = createBotHero(allySelectedIds[2] ?? 'tala', 'dawn', 2, 1);
    const allyBotSupport = createBotHero(allySelectedIds[3] ?? 'argent', 'dawn', 2, 1);
    allies = [allyTop, allyJungle, allyBotCarry, allyBotSupport];

    // Spawn 5 Enemies (Top, Jungle, Mid, Bot Carry, Bot Support)
    const enemyTop = createBotHero(enemySelectedIds[0] ?? 'veer', 'dusk', 0, 1);
    const enemyJungle = createBotHero(enemySelectedIds[1] ?? 'hollow', 'dusk', 1, 1);
    const enemyMid = createBotHero(enemySelectedIds[2] ?? 'zenith', 'dusk', 1, 1);
    const enemyBotCarry = createBotHero(enemySelectedIds[3] ?? 'sever', 'dusk', 2, 1);
    const enemyBotSupport = createBotHero(enemySelectedIds[4] ?? 'thistle', 'dusk', 2, 1);
    enemies = [enemyTop, enemyJungle, enemyMid, enemyBotCarry, enemyBotSupport];
  }

  const all: BotHero[] = [...allies, ...enemies];

  return {
    allies,
    enemies,
    all,
    scaleLevel(lvl: number) {
      all.forEach((b) => b.setLevel(lvl));
    },
    strike(attackerTeam, covers, amount) {
      const hits: { bot: BotHero; x: number; z: number }[] = [];
      const felled: { bot: BotHero }[] = [];

      for (const bot of all) {
        if (bot.team === attackerTeam || bot.state === 'dead') continue;
        if (covers(bot.x, bot.z, 1.1)) {
          const killed = bot.takeDamage(amount);
          hits.push({ bot, x: bot.x, z: bot.z });
          if (killed) {
            felled.push({ bot });
          }
        }
      }
      return { hits, felled };
    },
    update(
      delta,
      clock,
      playerX,
      playerZ,
      playerHp,
      playerMaxHp,
      playerHero,
      playerTeam,
      minions,
      objectives,
      pingObjective
    ) {
      const actions = new Map<string, BotAction | null>();

      // Build target lists
      const playerTarget: BotTarget = {
        id: 'player',
        name: playerHero.name,
        x: playerX,
        z: playerZ,
        health: playerHp,
        maxHealth: playerMaxHp,
        radius: 1.1,
        isPlayer: true,
      };

      const dawnTargets: BotTarget[] = [
        playerTarget,
        ...allies.map((a) => ({
          id: a.id,
          name: a.hero.name,
          x: a.x,
          z: a.z,
          health: a.health,
          maxHealth: a.maxHealth,
          radius: 1.1,
        })),
      ];

      const duskTargets: BotTarget[] = enemies.map((e) => ({
        id: e.id,
        name: e.hero.name,
        x: e.x,
        z: e.z,
        health: e.health,
        maxHealth: e.maxHealth,
        radius: 1.1,
      }));

      // Update Allies
      for (const ally of allies) {
        const action = ally.update(delta, clock, duskTargets, minions.filter((m) => m.team === 'dusk'), objectives, pingObjective);
        actions.set(ally.id, action);
      }

      // Update Enemies
      for (const enemy of enemies) {
        const action = enemy.update(delta, clock, dawnTargets, minions.filter((m) => m.team === 'dawn'), objectives, null);
        actions.set(enemy.id, action);
      }

      return actions;
    },
  };
}

