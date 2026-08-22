'use client';

// The playable arena.
//
// Deliberately thin. It owns the canvas, the frame loop and the input, and it
// asks game/ modules for everything else. The lesson behind that split is a
// concrete one: on the previous project the equivalent component reached 868
// lines holding two unrelated jobs, driving a three.js scene and drawing the
// buttons over it, and had to be pulled apart later. Starting split costs
// nothing; arriving there costs a refactor.

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { HEROES, SELECTION_RING, heroHeight, heroRadius, type Ability, type Hero } from '@/game/heroes';
import HeroHud from './HeroHud';

import { createStage } from '@/game/render3d/stage';
import { createCameraControls } from '@/game/render3d/controls';
import { createNexus } from '@/game/render3d/nexus';
import { buildTerrain, terrainHeight } from '@/game/render3d/terrain';
import { buildClutter } from '@/game/render3d/clutter';
import { HALF, TEAMS, type TeamId } from '@/game/arena/nexus';
import { createTowers } from '@/game/render3d/towers';
import { createWalls } from '@/game/render3d/walls';
import { createCamps } from '@/game/render3d/camps';
import { createJungle } from '@/game/render3d/jungle';
import { brushAt, resolveJungle } from '@/game/arena/jungle';
import { campAt } from '@/game/arena/camps';
import { createRiver } from '@/game/render3d/river';
import { createBackdrop } from '@/game/render3d/backdrop';
import { DECK_HEIGHT, onCrossing, riverSpeed } from '@/game/arena/river';
import { resolveWalls } from '@/game/arena/walls';
import { createSantelmo } from '@/game/render3d/santelmo';
import { createActor, type Actor } from '@/game/render3d/actor';
import { createMinionRender } from '@/game/render3d/minions';
import { createCreepRender } from '@/game/render3d/creeps';
import { createBossRender } from '@/game/render3d/bosses';
import {
  BASIC_WIDTH,
  createBossManager,
  createBrute,
  createCreepManager,
  createMinionManager,
  createObjectives,
  createTowerFire,
  CAST_KEYS,
  checkContent,
  EMPTY_COOLDOWNS,
  KAPRE,
  PROJECTILE_SPEED,
  abilityForSlot,
  coneHitsPoint,
  direction,
  lineHitsPoint,
  segmentHitsPoint,
  strikeLine,
  type CastSlot,
  type FoeOutcome,
  type CooldownState,
  type DashCast,
  type ProjectileCast,
  type WindupCast,
  type JungleBuffType,
} from '@/game/combat';
import { combatGroundY, createCombatFx } from '@/game/render3d/combat';

/**
 * How many world units tall the view is. Smaller is closer in.
 *
 * Two forces pull against each other. Abilities reach up to 14 units, so the
 * view has to show enough ground to aim across. But a character is 1.8 units
 * tall, and at 34 the whole arena fitted on screen and the hero was a speck:
 * that is a map view, not a fight. The character wins the argument, because a
 * game whose characters cannot be seen has no reason to have good ones.
 */
const VIEW_HEIGHT = 15;

const FOE_RADIUS = KAPRE.model.height * 0.13;

/** The side the player breaks. They fight for the Anito, so this is the other. */
const ENEMY: TeamId = 'malakas';

export default function Arena3D({ heroId = 'tikbalang' }: { heroId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // ⚠ ONLY HEROES WITH A REAL MODEL ARE PLAYABLE. The shared adventurer that
  // stood in for the rest is gone, along with its palette atlas: five recolours
  // of one body read as one person, and a placeholder that lies about the
  // roster is worse than a shorter roster.
  const playable = HEROES.filter((h) => h.model);
  const [hero, setHero] = useState<Hero>(
    () => playable.find((h) => h.id === heroId) ?? playable[0]
  );
  const [fps, setFps] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [compass, setCompass] = useState(Math.PI / 4);
  const [zoomShown, setZoomShown] = useState(VIEW_HEIGHT);
  const [cooldowns, setCooldowns] = useState<CooldownState>(EMPTY_COOLDOWNS);
  const [playerHp, setPlayerHp] = useState(hero.health);
  const [kapreHp, setKapreHp] = useState(KAPRE.health);
  const [activeBuffs, setActiveBuffs] = useState<{ id: string; name: string; emoji: string; remaining: number }[]>([]);
  const [bossName, setBossName] = useState<string | undefined>(undefined);
  const [bossHp, setBossHp] = useState<number>(0);
  const [bossMaxHp, setBossMaxHp] = useState<number>(1);
  const [combatLine, setCombatLine] = useState('J basic · 1/2/R abilities · aim by facing');
  const [objectiveLine, setObjectiveLine] = useState('');
  /** Set once, when the enemy core breaks. A match ends and does not un-end. */
  const [won, setWon] = useState(false);
  /** Held while a turn button is pressed: -1, 0 or 1. */
  const turnRef = useRef(0);
  /** Set once the stage exists, so the zoom buttons can reach it. */
  const zoomFn = useRef<((factor: number) => void) | null>(null);
  const castFn = useRef<((slot: CastSlot) => void) | null>(null);
  const zoomBy = (factor: number) => zoomFn.current?.(factor);
  const cast = (slot: CastSlot) => castFn.current?.(slot);
  // Read inside the frame loop, which must not be torn down when the hero
  // changes: a ref is how a value crosses from React into a running loop.
  const heroRef = useRef(hero);
  useEffect(() => {
    heroRef.current = hero;
  }, [hero]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Content rules that span heroes/ and combat/, so neither file can hold
    // them. Development only: these describe balance data, not code.
    if (process.env.NODE_ENV !== 'production') {
      for (const problem of checkContent([KAPRE])) console.warn('[alamat content]', problem);
    }

    const stage = createStage(canvas);
    // ?zoom= sets the starting distance, which is the only way to judge a body
    // thirty pixels tall in normal play. The wheel takes over from there.
    const zoomParam = Number(new URLSearchParams(window.location.search).get('zoom'));
    const startZoom = Number.isFinite(zoomParam) && zoomParam > 0 ? zoomParam : VIEW_HEIGHT;
    const terrain = buildTerrain();
    stage.scene.add(terrain);
    const clutter = buildClutter();
    stage.scene.add(clutter.group);
    const nexus = createNexus();
    stage.scene.add(nexus.group);
    const towers = createTowers();
    stage.scene.add(towers.group);
    const walls = createWalls();
    stage.scene.add(walls.group);
    const camps = createCamps();
    stage.scene.add(camps.group);
    const jungle = createJungle();
    stage.scene.add(jungle.group);
    const river = createRiver();
    stage.scene.add(river.group);
    const backdrop = createBackdrop();
    // The camera itself has to be in the scene for its children to draw.
    stage.scene.add(stage.camera);
    backdrop.attach(stage.camera);

    const santelmo = createSantelmo();
    stage.scene.add(santelmo.group);
    const combatFx = createCombatFx();
    stage.scene.add(combatFx.group);
    const minionManager = createMinionManager();
    const minionRender = createMinionRender();
    stage.scene.add(minionRender.group);
    const creepManager = createCreepManager();
    const creepRender = createCreepRender();
    stage.scene.add(creepRender.group);
    const bossManager = createBossManager();
    const bossRender = createBossRender();
    stage.scene.add(bossRender.group);

    // What the match is about. The towers and cores were already drawn; this is
    // the layer that makes them mean something.
    const objectives = createObjectives();
    const towerFire = createTowerFire(objectives, ENEMY);
    const standing = () =>
      objectives.all.filter((s) => s.team === ENEMY && s.kind === 'tower' && objectives.alive(s)).length;
    const reportObjectives = () => {
      const core = objectives.core(ENEMY);
      setObjectiveLine(
        objectives.vulnerable(core)
          ? `${TEAMS[ENEMY].name}: core exposed, ${Math.ceil(core.health)} left`
          : `${TEAMS[ENEMY].name}: ${standing()} towers standing, core warded`
      );
    };
    reportObjectives();

    // ⚠ THE GENERATED BALETE IS DELIBERATELY NOT LOADED. It exists at
    // /models/nature/balete.glb and it is WORSE than the procedural tree it was
    // meant to replace: text-to-3D returned a lumpy mound with no trunk, no
    // hanging roots and no readable silhouette. Kept on disk as evidence for
    // the decision rather than deleted.
    //
    // The pattern it confirms, which matches the previous project exactly:
    // generated CREATURES work and generated SCENERY does not. The credits
    // belong to the Bakunawa and the Kapre, not to trees.

    // Spawner Platforms: Set hero spawn points inside circular stone-carved Baybayin rune circle
    // on high-ground platform behind the Nexus core.
    const atParam = new URLSearchParams(window.location.search).get('at');
    const at = atParam?.split(',').map(Number);
    const spawnX = at && at.length === 2 && at.every(Number.isFinite) ? at[0] : TEAMS.anito.spawn.x;
    const spawnZ = at && at.length === 2 && at.every(Number.isFinite) ? at[1] : TEAMS.anito.spawn.z;
    let px = spawnX;
    let pz = spawnZ;
    let heading = Math.PI * 0.25;
    let hiddenSeen = false;

    // Loaded asynchronously, so the frame loop has to cope with there being no
    // body yet. It starts immediately and the arena is already on screen.
    let player: Actor | null = null;
    let builtFor = hero.id;
    let disposed = false;

    const swapTo = (h: Hero) => {
      if (!h.model) return;
      builtFor = h.id;
      createActor({
        ...h.model,
        height: heroHeight(h.build.scale),
        // The ring takes the team's colour, so it is the same language the
        // towers and the cores speak.
        ring: { radius: SELECTION_RING, colour: TEAMS.anito.light },
      }).then((next) => {
        if (disposed || builtFor !== h.id) {
          next.dispose();
          return;
        }
        const inBrush = !!brushAt(px, pz);
        if (inBrush !== hiddenSeen) {
          hiddenSeen = inBrush;
          setHidden(inBrush);
        }

        if (player) {
          stage.scene.remove(player.object);
          player.dispose();
        }
        player = next;
        stage.scene.add(next.object);
      });
    };
    swapTo(hero);

    // ── the Kapre ─────────────────────────────────────────────────────────
    // The first thing in this game that is not the player. It stands in the
    // arena, notices you inside its awareness, and closes until it is within
    // reach. It can finally swing, which makes the arena a fight rather than a
    // walking diorama.
    let foe: Actor | null = null;
    // The body is the renderer's; where it stands and what it wants is the
    // brain's. Only the two of them together are the Kapre.
    const brute = createBrute(KAPRE, 0, 0);
    createActor(KAPRE.model).then((a) => {
      if (disposed) {
        a.dispose();
        return;
      }
      foe = a;
      a.setPosition(brute.x, 0, brute.z);
      stage.scene.add(a.object);
    });

    // ── camera controls ──────────────────────────────────────────────────
    const camera = createCameraControls(
      canvas,
      stage,
      startZoom,
      (z) => setZoomShown(Math.round(z))
    );
    zoomFn.current = camera.zoomBy;

    const keys = new Set<string>();
    const castQueue: CastSlot[] = [];
    castFn.current = (slot: CastSlot) => castQueue.push(slot);
    const onDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keys.add(key);
      const slot = CAST_KEYS[key];
      if (!slot || e.repeat) return;
      e.preventDefault();
      castQueue.push(slot);
    };
    const onUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);

    const onResize = () => stage.resize();
    window.addEventListener('resize', onResize);
    stage.resize();

    let raf = 0;
    let last = 0;
    let clock = 0;
    let yawShown = Math.PI / 4;
    let frames = 0;
    let fpsClock = 0;
    let combatUiClock = 0;
    let activeHeroId = hero.id;

    let playerHealth = hero.health;
    let castLockUntil = 0;
    let dash: DashCast | null = null;
    const ready: CooldownState = { ...EMPTY_COOLDOWNS };
    const windups: WindupCast[] = [];
    const projectiles: ProjectileCast[] = [];

    const syncCooldowns = () => {
      setCooldowns({
        basic: Math.max(0, ready.basic - clock),
        ability0: Math.max(0, ready.ability0 - clock),
        ability1: Math.max(0, ready.ability1 - clock),
        ultimate: Math.max(0, ready.ultimate - clock),
      });
    };

    const resetReady = () => {
      ready.basic = 0;
      ready.ability0 = 0;
      ready.ability1 = 0;
      ready.ultimate = 0;
      syncCooldowns();
    };

    const resolveBody = (x: number, z: number, radius: number) => {
      const stepped = resolveJungle(x, z, radius);
      const pushed = resolveWalls(stepped.x, stepped.z, radius);
      return {
        x: Math.max(-HALF + 1, Math.min(HALF - 1, pushed.x)),
        z: Math.max(-HALF + 1, Math.min(HALF - 1, pushed.z)),
      };
    };

    const resetPlayer = (message: string) => {
      px = spawnX;
      pz = spawnZ;
      heading = Math.PI * 0.25;
      playerHealth = heroRef.current.health;
      setPlayerHp(playerHealth);
      setCombatLine(message);
      castLockUntil = clock + 0.4;
    };

    /** Every source of damage to the player goes through here. */
    const hurtPlayer = (amount: number, source: string) => {
      playerHealth = Math.max(0, playerHealth - amount);
      combatFx.addBurst(px, pz, TEAMS.malakas.light);
      if (playerHealth <= 0) {
        setPlayerHp(0);
        resetPlayer(`${source} drops you. You wake at the Anito gate.`);
      } else {
        setPlayerHp(playerHealth);
        setCombatLine(`${source} hits you for ${amount}.`);
      }
    };

    interface BuffInstance {
      type: JungleBuffType | 'moons_eclipse';
      name: string;
      emoji: string;
      expiresAt: number;
    }
    const liveBuffs: BuffInstance[] = [];

    const grantBuff = (type: JungleBuffType | 'moons_eclipse', name: string, duration: number) => {
      const emojis: Record<string, string> = {
        wind_stride: '💨',
        blood_thirst: '🩸',
        bulul_blessing: '🌾',
        moons_eclipse: '🌙',
      };
      const emoji = emojis[type] ?? '✨';
      const existing = liveBuffs.find((b) => b.type === type);
      if (existing) {
        existing.expiresAt = clock + duration;
      } else {
        liveBuffs.push({ type, name, emoji, expiresAt: clock + duration });
      }
    };

    /**
     * Everything an aimed shape does when it lands.
     *
     * ⚠ ONE PATH FOR EVERY SHAPE. The basic attack, the three ability shapes
     * and a projectile all arrive here as a coverage predicate.
     */
    const resolveHit = (
      label: string,
      amount: number,
      covers: (x: number, z: number, radius: number) => boolean
    ): boolean => {
      let foeOutcome: FoeOutcome | null = null;
      let damageDealtToFoes = 0;

      // Has Moon's Eclipse buff: +20% bonus damage to structures & true damage
      const hasEclipse = liveBuffs.some((b) => b.type === 'moons_eclipse' && clock < b.expiresAt);
      const appliedDamage = hasEclipse ? amount * 1.2 : amount;

      if (covers(brute.x, brute.z, FOE_RADIUS) && brute.hurt(amount, clock)) {
        foeOutcome = { name: KAPRE.name, amount, downed: !brute.alive };
        setKapreHp(brute.health);
        combatFx.addBurst(brute.x, brute.z, TEAMS.anito.light);
        if (!brute.alive && foe) foe.object.visible = false;
        damageDealtToFoes += amount;
      }

      // ── Neutral Jungle Creeps Strike ──────────────────────────────────────
      const creepReport = creepManager.strike(covers, amount);
      for (const hit of creepReport.hits) {
        combatFx.addBurst(hit.x, hit.z, TEAMS.anito.light);
        damageDealtToFoes += amount;
      }

      // ── Major Epic Boss Strike (Bakunawa & Kapre) ─────────────────────────
      const bossReport = bossManager.strike(covers, amount, clock);
      for (const hit of bossReport.hits) {
        combatFx.addBurst(hit.x, hit.z, TEAMS.anito.light);
        damageDealtToFoes += amount;
      }

      // ── Minion Waves Strike ───────────────────────────────────────────────
      const minionReport = minionManager.strike(ENEMY, covers, amount);
      for (const hit of minionReport.hits) {
        combatFx.addBurst(hit.x, hit.z, TEAMS.anito.light);
        damageDealtToFoes += amount;
      }

      // ── Objectives / Structure Strike ─────────────────────────────────────
      const report = objectives.strike(ENEMY, covers, appliedDamage);
      for (const hit of report.hits) combatFx.addBurst(hit.x, hit.z, TEAMS.anito.light);
      for (const down of report.felled) {
        if (down.kind === 'core') {
          nexus.shatter(down.team);
          stage.addCameraShake(0.95);
          setWon(true);
        } else {
          towers.fell(down.id);
          stage.addCameraShake(0.65);
        }
      }
      if (report.hits.length > 0) reportObjectives();

      // Blood Thirst Buff: Lifesteal on all damage dealt
      const hasBloodThirst = liveBuffs.some((b) => b.type === 'blood_thirst' && clock < b.expiresAt);
      if (hasBloodThirst && damageDealtToFoes > 0 && playerHealth > 0) {
        const heal = damageDealtToFoes * 0.2;
        playerHealth = Math.min(heroRef.current.health, playerHealth + heal);
        setPlayerHp(playerHealth);
      }

      const line = strikeLine(label, foeOutcome, report, minionReport);
      if (line) setCombatLine(line);
      else if (creepReport.hits.length > 0) setCombatLine(`Struck ${creepReport.hits[0].name}.`);
      else if (bossReport.hits.length > 0) setCombatLine(`Struck ${bossReport.hits[0].name}!`);

      return !!(line || creepReport.hits.length > 0 || bossReport.hits.length > 0);
    };

    const startWindup = (slot: CastSlot, ability: Ability) => {
      const startX = px;
      const startZ = pz;
      const startHeading = heading;
      const dir = direction(startHeading);
      const life = Math.max(0.12, ability.windup);

      if (ability.shape === 'ground') {
        combatFx.addCircle(
          startX + dir.x * ability.range,
          startZ + dir.z * ability.range,
          ability.width,
          TEAMS.anito.light,
          life
        );
      } else if (ability.shape === 'cone') {
        combatFx.addCone(startX, startZ, startHeading, ability.range, ability.width, TEAMS.anito.light, life);
      } else {
        combatFx.addLine(startX, startZ, startHeading, ability.range, ability.width, TEAMS.anito.light, life);
      }

      windups.push({
        ability,
        slot,
        x: startX,
        z: startZ,
        heading: startHeading,
        triggerAt: clock + ability.windup,
      });
      ready[slot] = clock + ability.cooldown;
      castLockUntil = Math.max(castLockUntil, clock + ability.lock);
      setCombatLine(`${ability.name} aimed.`);
    };

    const tryCast = (slot: CastSlot) => {
      if (clock < castLockUntil || dash) return;
      const currentHero = heroRef.current;
      const cooldown = ready[slot] - clock;
      const ability = abilityForSlot(currentHero, slot);
      const label = ability?.name ?? 'Strike';
      if (cooldown > 0) {
        setCombatLine(`${label} ready in ${cooldown.toFixed(1)}s.`);
        return;
      }

      if (slot === 'basic') {
        ready.basic = clock + currentHero.attackCooldown;
        castLockUntil = Math.max(castLockUntil, clock + Math.min(0.18, currentHero.attackCooldown * 0.3));
        combatFx.addLine(px, pz, heading, currentHero.attackRange, BASIC_WIDTH, TEAMS.anito.light, 0.16);
        const landed = resolveHit('Strike', currentHero.attack, (tx, tz, r) =>
          lineHitsPoint(px, pz, heading, currentHero.attackRange, BASIC_WIDTH, tx, tz, r)
        );
        if (!landed) setCombatLine('Strike cuts empty air.');
        return;
      }

      if (ability) startWindup(slot, ability);
    };

    const resolveWindup = (cast: WindupCast) => {
      const dir = direction(cast.heading);
      const targetX = cast.x + dir.x * cast.ability.range;
      const targetZ = cast.z + dir.z * cast.ability.range;

      if (cast.ability.shape === 'projectile') {
        const object = combatFx.makeProjectile(TEAMS.anito.light);
        object.position.set(cast.x + dir.x * 1.2, combatGroundY(cast.x, cast.z) + 1.1, cast.z + dir.z * 1.2);
        projectiles.push({
          ability: cast.ability,
          object,
          x: cast.x + dir.x * 1.2,
          z: cast.z + dir.z * 1.2,
          heading: cast.heading,
          travelled: 0,
        });
        return;
      }

      if (cast.ability.shape === 'ground') {
        if (cast.ability.damage <= 0) {
          setCombatLine(`${cast.ability.name} takes hold.`);
          return;
        }
        const landed = resolveHit(cast.ability.name, cast.ability.damage, (tx, tz, r) =>
          Math.hypot(tx - targetX, tz - targetZ) <= cast.ability.width + r
        );
        if (!landed) setCombatLine(`${cast.ability.name} lands empty.`);
        return;
      }

      if (cast.ability.shape === 'cone') {
        combatFx.addCone(cast.x, cast.z, cast.heading, cast.ability.range, cast.ability.width, TEAMS.anito.light, 0.18);
        const landed = resolveHit(cast.ability.name, cast.ability.damage, (tx, tz, r) =>
          coneHitsPoint(cast.x, cast.z, cast.heading, cast.ability.range, cast.ability.width, tx, tz, r)
        );
        if (!landed) setCombatLine(`${cast.ability.name} finds no body.`);
        return;
      }

      dash = {
        ability: cast.ability,
        heading: cast.heading,
        remaining: cast.ability.range,
        speed: Math.max(18, cast.ability.range / 0.32),
        hit: false,
      };
      if (cast.ability.damage <= 0) setCombatLine(`${cast.ability.name} carries you forward.`);
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      // Clamped: a backgrounded tab returns with a huge delta, and integrating
      // that in one step teleports the body through the walls.
      const dt = last === 0 ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;

      // Rebuild the body when the hero changes, rather than tearing the whole
      // scene down: the arena and the lights are the expensive part.
      const want = heroRef.current;
      if (want.id !== activeHeroId) {
        activeHeroId = want.id;
        playerHealth = want.health;
        setPlayerHp(playerHealth);
        windups.length = 0;
        for (const p of projectiles.splice(0)) combatFx.removeObject(p.object);
        dash = null;
        castLockUntil = 0;
        resetReady();
        setCombatLine(`${want.name} enters. J basic · 1/2/R abilities.`);
      }
      if (want.id !== builtFor) swapTo(want);

      const queuedCast = castQueue.shift();
      castQueue.length = 0;
      if (queuedCast) {
        tryCast(queuedCast);
        syncCooldowns();
      }

      // ── input ────────────────────────────────────────────────────────────
      // Rotated 45 degrees to match the camera's yaw, so "up" on the keyboard
      // is up on the SCREEN rather than up on the world axis. Without this the
      // controls feel diagonal to everyone who has not read the source.
      // Q and E turn, as do the on-screen buttons and a right-drag. All three
      // write the same yaw, so no control has its own idea of where the camera
      // is pointing.
      const turnKey = (keys.has('q') ? 1 : 0) - (keys.has('e') ? 1 : 0);
      camera.update(dt, turnKey + turnRef.current);
      if (Math.abs(camera.yaw - yawShown) > 0.02) {
        yawShown = camera.yaw;
        setCompass(camera.yaw);
      }

      let ix = 0;
      let iz = 0;
      if (keys.has('w') || keys.has('arrowup')) iz -= 1;
      if (keys.has('s') || keys.has('arrowdown')) iz += 1;
      if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
      if (keys.has('d') || keys.has('arrowright')) ix += 1;

      let moving = false;
      if (dash) {
        const dir = direction(dash.heading);
        const oldX = px;
        const oldZ = pz;
        const step = Math.min(dash.remaining, dash.speed * dt);
        const bodyR = heroRadius(want.build.scale);
        const next = resolveBody(px + dir.x * step, pz + dir.z * step, bodyR);
        px = next.x;
        pz = next.z;
        heading = dash.heading;
        moving = true;

        const actual = Math.hypot(px - oldX, pz - oldZ);
        if (dash.ability.damage > 0 && !dash.hit) {
          const ability = dash.ability;
          dash.hit = resolveHit(ability.name, ability.damage, (tx, tz, r) =>
            segmentHitsPoint(oldX, oldZ, px, pz, tx, tz, ability.width + r)
          );
        }
        dash.remaining -= actual;
        if (actual < step * 0.25 || dash.remaining <= 0) dash = null;
      } else if ((ix !== 0 || iz !== 0) && clock >= castLockUntil && playerHealth > 0) {
        moving = true;
        // ⚠ MOVEMENT IS ROTATED BY THE LIVE YAW, not by a baked 45 degrees.
        // This was a constant, which was correct only while the camera could
        // not turn; leaving it would mean that the moment a player rotated the
        // view, "forward" stopped being up the screen and the controls became
        // unusable at every angle except the original one.
        const cos = Math.cos(camera.yaw);
        const sin = Math.sin(camera.yaw);
        const dx = ix * cos + iz * sin;
        const dz = -ix * sin + iz * cos;
        const len = Math.hypot(dx, dz) || 1;
        // The river slows you; a bridge does not. That difference is the whole
        // reason the three crossings are worth contesting.
        const hasWindStride = liveBuffs.some((b) => b.type === 'wind_stride' && clock < b.expiresAt);
        const speedMult = (hasWindStride ? 1.35 : 1.0) * riverSpeed(px, pz);
        const step = want.speed * speedMult * dt;
        // Clamped to the map for now. Pathing blockades arrive with the jungle
        // assets; until they exist there is nothing to collide with.
        // Walls first, then the map edge. A body pushed out of a wall must not
        // then be clamped back into it.
        // Barriers first, then base walls. Both slide rather than stop.
        // ⚠ ONE RADIUS, DERIVED FROM THE HERO'S HEIGHT. It was hard-coded at
        // 0.7 in both calls, which was correct only while heroes were 1.75 tall;
        // scaling the model without this leaves a giant rattling around inside
        // a collider built for someone a third its size.
        const bodyR = heroRadius(want.build.scale);
        const next = resolveBody(px + (dx / len) * step, pz + (dz / len) * step, bodyR);
        px = next.x;
        pz = next.z;
        heading = Math.atan2(dx, dz);
      }

      const inBrush = !!brushAt(px, pz);
      if (inBrush !== hiddenSeen) {
        hiddenSeen = inBrush;
        setHidden(inBrush);
      }

      // Expired buffs cleanup & Bulul Blessing health regeneration
      for (let i = liveBuffs.length - 1; i >= 0; i--) {
        if (clock >= liveBuffs[i].expiresAt) liveBuffs.splice(i, 1);
      }
      const hasBululBlessing = liveBuffs.some((b) => b.type === 'bulul_blessing' && clock < b.expiresAt);
      if (hasBululBlessing && playerHealth < want.health && playerHealth > 0) {
        playerHealth = Math.min(want.health, playerHealth + 35 * dt);
        setPlayerHp(playerHealth);
      }

      for (let i = windups.length - 1; i >= 0; i--) {
        if (clock < windups[i].triggerAt) continue;
        const [cast] = windups.splice(i, 1);
        resolveWindup(cast);
      }

      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        const dir = direction(p.heading);
        const oldX = p.x;
        const oldZ = p.z;
        const step = PROJECTILE_SPEED * dt;
        p.x += dir.x * step;
        p.z += dir.z * step;
        p.travelled += step;
        p.object.position.set(p.x, combatGroundY(p.x, p.z) + 1.1, p.z);
        p.object.rotation.y += dt * 5;

        // ⚠ TESTED AGAINST THE FOE ONLY WHILE IT IS ALIVE, so a shot cannot
        // stop in mid-air on a corpse; structures are handled by the same
        // predicate, which is why the whole test goes through resolveHit.
        const consumed = resolveHit(p.ability.name, p.ability.damage, (tx, tz, r) =>
          segmentHitsPoint(oldX, oldZ, p.x, p.z, tx, tz, p.ability.width + r)
        );
        if (consumed) {
          combatFx.removeObject(p.object);
          projectiles.splice(i, 1);
          continue;
        }
        if (p.travelled >= p.ability.range) {
          combatFx.removeObject(p.object);
          projectiles.splice(i, 1);
        }
      }

      // ⚠ ONLY WHILE THE BODY EXISTS. The mesh loads asynchronously, and a
      // brain ticking before it arrives means a Kapre that crosses half the map
      // invisibly and pops into existence already swinging.
      if (foe) {
        const tick = brute.update(dt, {
          clock,
          playerX: px,
          playerZ: pz,
          playerRadius: heroRadius(want.build.scale),
          playerHidden: hiddenSeen,
        });
        if (tick.returned) {
          setKapreHp(brute.health);
          foe.object.visible = true;
          setCombatLine(`The ${KAPRE.name} gathers itself again at the river bend.`);
        }
        if (tick.damage > 0) hurtPlayer(tick.damage, `The ${KAPRE.name}`);
        foe.play(tick.walking ? 'walk' : 'idle');
        foe.setPosition(
          brute.x,
          onCrossing(brute.x, brute.z) ? DECK_HEIGHT : terrainHeight(brute.x, brute.z),
          brute.z
        );
        foe.setFacing(brute.facing);
        foe.update(dt);
      }

      // ── Neutral Jungle Creeps Simulation ──────────────────────────────────
      const bodyRadius = heroRadius(want.build.scale);
      const creepTick = creepManager.update(dt, clock, {
        x: px,
        z: pz,
        radius: bodyRadius,
        hidden: hiddenSeen,
      });
      if (creepTick.damageToPlayer > 0) hurtPlayer(creepTick.damageToPlayer, 'Forest Creep');
      if (creepTick.buffGranted) {
        grantBuff(creepTick.buffGranted.type, creepTick.buffGranted.name, creepTick.buffGranted.duration);
        setCombatLine(`${creepTick.buffGranted.name} acquired! ${creepTick.buffGranted.description}`);
      }
      if (creepTick.aoeSlam) {
        combatFx.addCircle(creepTick.aoeSlam.x, creepTick.aoeSlam.z, creepTick.aoeSlam.radius, 0xffd06f, 0.45);
        stage.addCameraShake(0.35);
      }
      creepRender.update(creepManager.creeps, clock);

      // ── Major Epic Bosses (Bakunawa & Kapre) & Pushing Kapre Simulation ─────
      const bossTick = bossManager.update(
        dt,
        clock,
        { x: px, z: pz, radius: bodyRadius, hidden: hiddenSeen },
        objectives,
        (_k, tx, tz) => {
          combatFx.addBurst(tx, tz, 0xffd06f);
        }
      );
      if (bossTick.damageToPlayer > 0) hurtPlayer(bossTick.damageToPlayer, 'Epic Boss');
      if (bossTick.buffGranted) {
        grantBuff(bossTick.buffGranted.type, bossTick.buffGranted.name, bossTick.buffGranted.duration);
        setCombatLine(`${bossTick.buffGranted.name} granted! ${bossTick.buffGranted.description}`);
      }
      if (bossTick.announcement) {
        setCombatLine(bossTick.announcement);
        if (bossTick.announcement.includes('Bakunawa') || bossTick.announcement.includes('Kapre')) {
          stage.addCameraShake(0.75);
        }
      }
      for (const tel of bossTick.telegraphs) {
        if (tel.type === 'circle') {
          combatFx.addCircle(tel.x, tel.z, tel.radius ?? 5.5, tel.colour, 0.6);
          stage.addCameraShake(0.55); // Ground stomp / tail sweep rumble
        } else if (tel.type === 'cone') {
          combatFx.addCone(
            tel.x,
            tel.z,
            tel.heading ?? 0,
            tel.range ?? 8.5,
            tel.halfAngle ?? Math.PI / 6,
            tel.colour,
            0.6
          );
          stage.addCameraShake(0.4);
        }
      }
      bossRender.update(bossManager.bakunawa, bossManager.kapre, bossManager.pushingKapre, clock);

      // Closest boss distance for Epic Boss HUD bar
      const distBakunawa = Math.hypot(px - bossManager.bakunawa.x, pz - bossManager.bakunawa.z);
      const distKapre = Math.hypot(px - bossManager.kapre.x, pz - bossManager.kapre.z);
      if (bossManager.bakunawa.alive && (distBakunawa <= 32 || bossManager.bakunawa.inCombat)) {
        setBossName('Bakunawa — The Moon-Eater');
        setBossHp(bossManager.bakunawa.health);
        setBossMaxHp(bossManager.bakunawa.maxHealth);
      } else if (bossManager.kapre.alive && (distKapre <= 32 || bossManager.kapre.inCombat)) {
        setBossName('Kapre — Giant Tree Warden');
        setBossHp(bossManager.kapre.health);
        setBossMaxHp(bossManager.kapre.maxHealth);
      } else {
        setBossName(undefined);
        setBossHp(0);
      }

      // Minion simulation and combat
      minionManager.update(dt, clock, objectives, (from, tx, tz, isRanged) => {
        const teamColour = from.team === 'anito' ? TEAMS.anito.light : TEAMS.malakas.light;
        if (isRanged) {
          const gap = Math.hypot(tx - from.x, tz - from.z);
          const angle = Math.atan2(tx - from.x, tz - from.z);
          combatFx.addLine(from.x, from.z, angle, gap, 0.12, teamColour, 0.16);
        } else {
          combatFx.addBurst(tx, tz, teamColour);
        }
      });
      minionRender.update(minionManager.minions, clock);

      // Bulul jungle camp boons
      const camp = campAt(px, pz);
      if (camp) {
        if (camp.id.startsWith('bulul-nw') || camp.id.startsWith('bulul-se')) {
          // Elder Bulul: health regeneration tick
          if (playerHealth < want.health && playerHealth > 0) {
            playerHealth = Math.min(want.health, playerHealth + 36 * dt);
            setPlayerHp(playerHealth);
          }
        }
      }

      // ⚠ ONLY WHILE THE PLAYER IS UP. A corpse waiting to respawn standing in
      // a tower's range would be shot back down the instant it stood.
      if (playerHealth > 0) {
        const shot = towerFire.update(clock, px, pz, minionManager);
        if (shot.from) {
          const maskY = terrainHeight(shot.from.x, shot.from.z) + (shot.from.tier === 1 ? 7.6 : shot.from.tier === 2 ? 9.1 : 10.8);
          const targetY = combatGroundY(shot.targetX, shot.targetZ) + 1.2;
          const shotColour = TEAMS[shot.from.team as TeamId]?.light ?? TEAMS[ENEMY].light;
          combatFx.addEnergyOrb(
            shot.from.x,
            maskY,
            shot.from.z,
            shot.targetX,
            targetY,
            shot.targetZ,
            shotColour,
            0.26
          );
          if (shot.damage > 0) {
            hurtPlayer(shot.damage, 'A tower');
          } else if (shot.minionHit) {
            combatFx.addBurst(shot.targetX, shot.targetZ, shotColour);
          }
        }
      }

      if (player) {
        // A bridge holds the ground level; everything else follows the terrain.
        player.setPosition(px, onCrossing(px, pz) ? DECK_HEIGHT : terrainHeight(px, pz), pz);
        player.setFacing(heading);
        player.play(moving ? 'run' : 'idle');
        player.update(dt);
      }
      terrain.userData.update?.(clock);
      clutter.update(clock);
      nexus.update(clock);
      towers.update(clock);
      camps.update(clock);
      jungle.update(clock);
      river.update(clock);
      backdrop.update(clock);
      santelmo.update(clock);
      combatFx.update(dt);
      stage.update(dt, clock, bossManager.bakunawa.inCombat);
      stage.lookAtGround(px, pz);
      stage.render();

      frames++;
      fpsClock += dt;
      if (fpsClock >= 0.5) {
        setFps(Math.round(frames / fpsClock));
        frames = 0;
        fpsClock = 0;
      }
      combatUiClock += dt;
      if (combatUiClock >= 0.12) {
        syncCooldowns();
        setActiveBuffs(
          liveBuffs.map((b) => ({
            id: b.type,
            name: b.name,
            emoji: b.emoji,
            remaining: Math.max(0, b.expiresAt - clock),
          }))
        );
        combatUiClock = 0;
      }
    };
    loop();

    return () => {
      disposed = true;
      zoomFn.current = null;
      castFn.current = null;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('resize', onResize);
      camera.dispose();
      terrain.traverse((n) => {
        const m = n as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mat of mats) mat.dispose();
        }
      });
      clutter.dispose();
      nexus.dispose();
      towers.dispose();
      walls.dispose();
      camps.dispose();
      jungle.dispose();
      river.dispose();
      backdrop.dispose();
      santelmo.dispose();
      combatFx.dispose();
      minionRender.dispose();
      creepRender.dispose();
      bossRender.dispose();
      player?.dispose();
      foe?.dispose();
      stage.dispose();
    };
    // Built once. The hero is read through a ref so that changing it does not
    // rebuild the arena.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      <HeroHud
        hero={hero}
        playable={playable}
        onPick={setHero}
        fps={fps}
        hidden={hidden}
        playerHp={playerHp}
        foeName={KAPRE.name}
        foeHp={kapreHp}
        foeMaxHp={KAPRE.health}
        combatLine={combatLine}
        objectiveLine={objectiveLine}
        won={won}
        cooldowns={cooldowns}
        onCast={cast}
        compass={compass}
        zoomShown={zoomShown}
        onZoom={zoomBy}
        onTurn={(dir) => {
          turnRef.current = dir;
        }}
        activeBuffs={activeBuffs}
        bossName={bossName}
        bossHp={bossHp}
        bossMaxHp={bossMaxHp}
      />
    </div>
  );
}
