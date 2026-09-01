'use client';

// Master 3D Playable Arena Component (P08 Complete Architecture).
//
// ── INTEGRATED SUBSYSTEMS ───────────────────────────────────────────────────
// 1. Procedural Web Audio Engine (synth.ts)
// 2. Mouse-Cursor Aiming & Smart-Cast Ground Reticles (reticles.ts)
// 3. Floating Combat Damage Numbers & Status Alerts (damageNumbers.ts)
// 4. Dynamic XP Progression & Level 1–15 Scaling (progression.ts)
// 5. Active RPG Inventory & Mathematical Attribute Engine (inventory.ts)
// 6. Autonomous Lane AI Bot Hero Opponents (botHero.ts)
// 7. Monster Hunter Bosses, Jungle Creeps, 3-Lane Map & ACES Day/Night Lighting

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { HEROES, SELECTION_RING, heroHeight, heroRadius, type Ability, type Hero } from '@/game/heroes';
import { territoryById, DEFAULT_TERRITORY, type Territory } from '@/game/territories';
import HeroHud, {
  type ScreenCoord,
  type MinionHudData,
  type TowerHudData,
  type AimPreviewData,
} from './HeroHud';

import { createStage } from '@/game/render3d/stage';
import { createCameraControls } from '@/game/render3d/controls';
import { createNexus } from '@/game/render3d/nexus';
import { buildTerrain, terrainHeight } from '@/game/render3d/terrain';
import { buildClutter } from '@/game/render3d/clutter';
import { buildGroundCover } from '@/game/render3d/groundcover';
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
import { createWisp } from '@/game/render3d/wisp';
import { createActor, type Actor } from '@/game/render3d/actor';
import { createMinionRender } from '@/game/render3d/minions';
import { createCreepRender } from '@/game/render3d/creeps';
import { createBossRender } from '@/game/render3d/bosses';
import { createReticleController } from '@/game/render3d/reticles';
import { createDamageNumberManager, type FloatingTextHudData } from '@/game/render3d/damageNumbers';
import { sound } from '@/game/audio/synth';
import { haptics } from '@/game/audio/haptics';
import { recordMatchOutcome, type MatchRewardResult } from '@/game/progression/profile';
import {
  BOUNTIES,
  getProgressionState,
  getArmorDamageReduction,
} from '@/game/combat/progression';
import { createInventoryManager, type EffectiveHeroStats } from '@/game/items/inventory';
import { type TalismanItem } from '@/game/items/catalogue';
import { createBotTeamManager } from '@/game/ai/botHero';
import { android } from '@/game/platform/android';
import type { TeammateHudData, EnemyBotHudData, TacticalPingData } from '@/components/game/HeroHud';
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

const VIEW_HEIGHT = 15;
const FOE_RADIUS = KAPRE.model.height * 0.13;
const ENEMY: TeamId = 'dusk';

export default function Arena3D({
  heroId = 'veer',
  territoryId = 'warding',
}: {
  heroId?: string;
  territoryId?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playable = HEROES.filter((h) => h.model);
  const territory: Territory = territoryById(territoryId) ?? DEFAULT_TERRITORY;
  const [hero, setHero] = useState<Hero>(
    () => playable.find((h) => h.id === heroId) ?? playable[0]
  );
  const [fps, setFps] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [compass, setCompass] = useState(Math.PI / 4);
  const [zoomShown, setZoomShown] = useState(VIEW_HEIGHT);
  const [cooldowns, setCooldowns] = useState<CooldownState>(EMPTY_COOLDOWNS);
  const [playerHp, setPlayerHp] = useState(hero.health);
  const [playerMaxHp, setPlayerMaxHp] = useState(hero.health);
  const [treantHp, setTreantHp] = useState(KAPRE.health);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [playerGold, setPlayerGold] = useState(500);
  const [playerXpPercent, setPlayerXpPercent] = useState(0);
  const [playerPos, setPlayerPos] = useState({ x: -84.5, z: 84.5, heading: Math.PI * 0.25 });
  const [playerScreenPos, setPlayerScreenPos] = useState<ScreenCoord | undefined>(undefined);
  const [foePos, setFoePos] = useState({ x: 0, z: 0 });
  const [foeScreenPos, setFoeScreenPos] = useState<ScreenCoord | undefined>(undefined);
  const [minionsData, setMinionsData] = useState<MinionHudData[]>([]);
  const [towersData, setTowersData] = useState<TowerHudData[]>([]);
  const [keyboardVector, setKeyboardVector] = useState({ x: 0, z: 0 });
  const [matchTime, setMatchTime] = useState(0);
  const [allyKills, setAllyKills] = useState(0);
  const [enemyKills, setEnemyKills] = useState(0);
  const [activeBuffs, setActiveBuffs] = useState<{ id: string; name: string; emoji: string; remaining: number }[]>([]);
  const [bossName, setBossName] = useState<string | undefined>(undefined);
  const [bossHp, setBossHp] = useState<number>(0);
  const [bossMaxHp, setBossMaxHp] = useState<number>(1);
  const [combatLine, setCombatLine] = useState('WASD to move · Mouse/Touch Aim · J/Space attack · Q/W/E/R abilities');
  const [objectiveLine, setObjectiveLine] = useState('');
  const [won, setWon] = useState(false);
  const [defeated, setDefeated] = useState(false);
  const [matchReward, setMatchReward] = useState<MatchRewardResult | undefined>(undefined);
  const [equippedItems, setEquippedItems] = useState<TalismanItem[]>([]);
  const [effectiveStats, setEffectiveStats] = useState<EffectiveHeroStats | undefined>(undefined);
  const [floatingTexts, setFloatingTexts] = useState<FloatingTextHudData[]>([]);
  const [teammatesData, setTeammatesData] = useState<TeammateHudData[]>([]);
  const [enemyBotsData, setEnemyBotsData] = useState<EnemyBotHudData[]>([]);
  const [activePings, setActivePings] = useState<TacticalPingData[]>([]);
  const [gamepadConnected, setGamepadConnected] = useState<boolean>(false);
  const [gamepadName, setGamepadName] = useState<string>('');

  const turnRef = useRef(0);
  const joyRef = useRef({ x: 0, z: 0 });
  const pingFn = useRef<((type: string) => void) | null>(null);
  const mapPingFn = useRef<((worldX: number, worldZ: number, type: string) => void) | null>(null);
  const scoutMapFn = useRef<((target: { x: number; z: number } | null) => void) | null>(null);
  const qualityFn = useRef<((q: 'performance' | 'balanced' | 'ultra') => void) | null>(null);
  const skillLevelsRef = useRef<{ ability0: number; ability1: number; ability2: number; ultimate: number }>({
    ability0: 1,
    ability1: 1,
    ability2: 1,
    ultimate: 0,
  });
  const scoutMapTargetRef = useRef<{ x: number; z: number } | null>(null);
  const zoomFn = useRef<((factor: number) => void) | null>(null);
  const castFn = useRef<((slot: CastSlot) => void) | null>(null);
  const castTargetFn = useRef<((slot: CastSlot, target?: { x?: number; z?: number; heading?: number; targetType?: 'hero' | 'minion' | 'tower' }) => void) | null>(null);
  const aimPreviewFn = useRef<((data: AimPreviewData) => void) | null>(null);
  const buyFn = useRef<((item: TalismanItem) => void) | null>(null);
  const activePingRef = useRef<{ x: number; z: number; type: string; expiresAt: number } | undefined>(undefined);
  const aimPreviewRef = useRef<AimPreviewData | undefined>(undefined);

  const zoomBy = (factor: number) => zoomFn.current?.(factor);
  const cast = (slot: CastSlot) => castFn.current?.(slot);
  const handleCastTarget = (slot: CastSlot, target?: { x?: number; z?: number; heading?: number; targetType?: 'hero' | 'minion' | 'tower' }) =>
    castTargetFn.current?.(slot, target);
  const handleAimPreview = (data: AimPreviewData) => aimPreviewFn.current?.(data);
  const handlePing = (type: string) => pingFn.current?.(type);
  const handleMapPing = (worldX: number, worldZ: number, type: string) => mapPingFn.current?.(worldX, worldZ, type);
  const handleScoutMap = (target: { x: number; z: number } | null) => {
    scoutMapTargetRef.current = target;
  };
  const handleSkillUpgrade = (slot: 'ability0' | 'ability1' | 'ability2' | 'ultimate', newLevel: number) => {
    skillLevelsRef.current[slot] = newLevel;
  };
  const handleQualityChange = (q: 'performance' | 'balanced' | 'ultra') => qualityFn.current?.(q);
  const handleBuyItem = (item: TalismanItem) => buyFn.current?.(item);

  const heroRef = useRef(hero);
  useEffect(() => {
    heroRef.current = hero;
  }, [hero]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Android Mobile & Gamepad Initializers ────────────────────────────────
    android.requestWakeLock().catch(() => {});
    const removeBackGuard = android.setupBackGestureGuard();

    const unsubGpConnect = android.onGamepadConnected((id) => {
      setGamepadConnected(true);
      setGamepadName(id);
      sound.playPing('select');
      setCombatLine(`🎮 Controller Connected: ${id.slice(0, 24)}`);
    });

    const unsubGpDisconnect = android.onGamepadDisconnected(() => {
      setGamepadConnected(false);
      setGamepadName('');
    });

    if (process.env.NODE_ENV !== 'production') {
      for (const problem of checkContent([KAPRE])) console.warn('[talisman content]', problem);
    }

    const stage = createStage(canvas, territory.atmosphere.skyTheme || territory.id);
    const zoomParam = Number(new URLSearchParams(window.location.search).get('zoom'));
    const startZoom = Number.isFinite(zoomParam) && zoomParam > 0 ? zoomParam : VIEW_HEIGHT;
    const terrain = buildTerrain();
    stage.scene.add(terrain);
    const clutter = buildClutter();
    stage.scene.add(clutter.group);
    // The mundane floor under the enchanted layer. Added straight after terrain
    // and clutter because it reads terrainHeight() and must not outlive them.
    const groundCover = buildGroundCover();
    stage.scene.add(groundCover.group);
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
    stage.scene.add(stage.camera);
    backdrop.attach(stage.camera);

    const wisp = createWisp();
    stage.scene.add(wisp.group);
    const combatFx = createCombatFx();
    stage.scene.add(combatFx.group);
    const reticles = createReticleController();
    stage.scene.add(reticles.group);
    const damageNumbers = createDamageNumberManager();

    const minionManager = createMinionManager();
    const minionRender = createMinionRender();
    stage.scene.add(minionRender.group);
    const creepManager = createCreepManager();
    const creepRender = createCreepRender();
    stage.scene.add(creepRender.group);
    const bossManager = createBossManager();
    const bossRender = createBossRender();
    stage.scene.add(bossRender.group);

    // ── Inventory & RPG Item Engine ─────────────────────────────────────────
    const inventory = createInventoryManager(['amihan-boots']);
    let currentLevel = 1;
    let currentXp = 0;
    let currentGold = 500;

    const refreshStats = () => {
      const stats = inventory.getEffectiveStats(heroRef.current, currentLevel);
      setEffectiveStats(stats);
      setPlayerMaxHp(stats.maxHp);
      setEquippedItems(inventory.getItemList());
      return stats;
    };
    let activeStats = refreshStats();

    buyFn.current = (item: TalismanItem) => {
      if (currentGold >= item.cost && !inventory.isFull()) {
        currentGold -= item.cost;
        inventory.addItem(item);
        setPlayerGold(currentGold);
        sound.playBuyItem();
        activeStats = refreshStats();
        setCombatLine(`Equipped ${item.name}! Stats enhanced.`);
      } else if (inventory.isFull()) {
        setCombatLine('Inventory is full! (6/6 items equipped)');
      }
    };

    // ── Objectives & Structure System ───────────────────────────────────────
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

    // ── Player & Spawn Anchor ───────────────────────────────────────────────
    const atParam = new URLSearchParams(window.location.search).get('at');
    const at = atParam?.split(',').map(Number);
    const spawnX = at && at.length === 2 && at.every(Number.isFinite) ? at[0] : TEAMS.dawn.spawn.x;
    const spawnZ = at && at.length === 2 && at.every(Number.isFinite) ? at[1] : TEAMS.dawn.spawn.z;
    let px = spawnX;
    let pz = spawnZ;
    let heading = Math.PI * 0.25;
    let hiddenSeen = false;

    let player: Actor | null = null;
    let builtFor = hero.id;
    let disposed = false;

    const swapTo = (h: Hero) => {
      if (!h.model) return;
      builtFor = h.id;
      createActor({
        ...h.model,
        height: heroHeight(h.build.scale),
        ring: { radius: SELECTION_RING, colour: TEAMS.dawn.light },
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

    // ── Neutral Brute Treant ─────────────────────────────────────────────────
    let foe: Actor | null = null;
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

    // ── 3v3 MOBA AI Champion Team System ────────────────────────────────────
    const botTeamManager = createBotTeamManager(hero.id, 'dawn');
    const botActors = new Map<string, Actor>();

    for (const bot of botTeamManager.all) {
      const modelConfig = bot.hero.model ?? {
        rigged: '/models/heroes/veer-rigged.glb',
        walk: '/models/heroes/veer-walk.glb',
      };
      createActor({
        ...modelConfig,
        height: heroHeight(bot.hero.build.scale),
        ring: { radius: SELECTION_RING, colour: TEAMS[bot.team].light },
      }).then((a) => {
        if (disposed) {
          a.dispose();
          return;
        }
        botActors.set(bot.id, a);
        a.setPosition(bot.x, terrainHeight(bot.x, bot.z), bot.z);
        stage.scene.add(a.object);
      });
    }

    // ── Map Tactical Ping Dispatcher ────────────────────────────────────────
    mapPingFn.current = (worldX: number, worldZ: number, type: string) => {
      const pingLabels: Record<string, string> = {
        attack: '⚔️ ATTACK',
        defend: '🛡️ DEFEND',
        danger: '⚠️ DANGER',
        omw: '🏃 ON MY WAY',
      };
      const label = pingLabels[type] ?? '📍 PING';
      const newPing: TacticalPingData = {
        id: `ping-${Date.now()}-${Math.random()}`,
        x: worldX,
        z: worldZ,
        type,
        label,
        expiresAt: clock + 5.0,
      };
      setActivePings((prev) => [...prev.filter((p) => p.expiresAt > clock), newPing]);
      activePingRef.current = { x: worldX, z: worldZ, type, expiresAt: clock + 5.0 };

      combatFx.addBlessingBurst(worldX, worldZ, type === 'danger' ? 0xef4444 : type === 'defend' ? 0x3b82f6 : 0xf59e0b);
      sound.playPing(type);
      setCombatLine(`📢 Ancestral Warcall: ${label} at [${Math.round(worldX)}, ${Math.round(worldZ)}]`);
    };

    // ── Camera & Mouse Pointer Raycasting ───────────────────────────────────
    const camera = createCameraControls(
      canvas,
      stage,
      startZoom,
      (z) => setZoomShown(Math.round(z))
    );
    zoomFn.current = camera.zoomBy;

    const raycaster = new THREE.Raycaster();
    const mouseNdc = new THREE.Vector2();
    let mouseGroundX = 0;
    let mouseGroundZ = 0;
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const planeIntersect = new THREE.Vector3();

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouseNdc, stage.camera);
      if (raycaster.ray.intersectPlane(groundPlane, planeIntersect)) {
        mouseGroundX = planeIntersect.x;
        mouseGroundZ = planeIntersect.z;
      }
    };
    window.addEventListener('pointermove', onPointerMove);

    const keys = new Set<string>();
    const castQueue: { slot: CastSlot; target?: { x?: number; z?: number; heading?: number; targetType?: 'hero' | 'minion' | 'tower' } }[] = [];
    castFn.current = (slot: CastSlot) => castQueue.push({ slot });
    castTargetFn.current = (slot: CastSlot, target?: { x?: number; z?: number; heading?: number; targetType?: 'hero' | 'minion' | 'tower' }) =>
      castQueue.push({ slot, target });
    aimPreviewFn.current = (data: AimPreviewData) => {
      aimPreviewRef.current = data;
      if (!data.active) {
        reticles.hide();
      } else {
        const currentHero = heroRef.current;
        const ability = abilityForSlot(currentHero, data.slot);
        if (ability) {
          const color = data.isCancelZone ? 0xef4444 : TEAMS.dawn.light;
          reticles.show(ability, px, pz, data.targetX ?? mouseGroundX, data.targetZ ?? mouseGroundZ, color);
        }
      }
    };

    const onDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keys.add(key);
      const slot = CAST_KEYS[key];
      if (!slot || e.repeat) return;
      e.preventDefault();
      castQueue.push({ slot });
    };
    const onUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    qualityFn.current = (q) => stage.setQuality(q);

    // Multi-touch pinch-to-zoom for mobile devices
    let initialPinchDist: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        initialPinchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDist) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const ratio = currentDist / initialPinchDist;
        if (Math.abs(ratio - 1) > 0.04) {
          camera.zoomBy(ratio > 1 ? 0.96 : 1.04);
          initialPinchDist = currentDist;
        }
      }
    };
    const onTouchEnd = () => {
      initialPinchDist = null;
    };
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });

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

    let playerHealth = activeStats.maxHp;
    let castLockUntil = 0;
    let dash: DashCast | null = null;
    const ready: CooldownState = { ...EMPTY_COOLDOWNS };
    const windups: WindupCast[] = [];
    const projectiles: ProjectileCast[] = [];

    const syncCooldowns = () => {
      setCooldowns({
        basic: Math.max(0, ready.basic - clock),
        basic_minion: Math.max(0, ready.basic_minion - clock),
        basic_tower: Math.max(0, ready.basic_tower - clock),
        ability0: Math.max(0, ready.ability0 - clock),
        ability1: Math.max(0, ready.ability1 - clock),
        ability2: Math.max(0, ready.ability2 - clock),
        ultimate: Math.max(0, ready.ultimate - clock),
        potion: Math.max(0, ready.potion - clock),
        spell: Math.max(0, ready.spell - clock),
      });
    };

    const resetReady = () => {
      ready.basic = 0;
      ready.basic_minion = 0;
      ready.basic_tower = 0;
      ready.ability0 = 0;
      ready.ability1 = 0;
      ready.ability2 = 0;
      ready.ultimate = 0;
      ready.potion = 0;
      ready.spell = 0;
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

    let lastKillTime = -999;
    let killStreakCount = 0;
    let jadeShieldCooldown = 0;

    const awardXpAndGold = (xp: number, gold: number, entityName: string) => {
      const goldMult = territory.id === 'warding' && entityName.toLowerCase().includes('minion') ? 1.25 : 1.0;
      const xpMult = territory.id === 'warding' && entityName.toLowerCase().includes('minion') ? 1.25 : 1.0;
      currentXp += Math.round(xp * xpMult);
      currentGold += Math.round(gold * goldMult);
      setPlayerGold(currentGold);

      const oldLevel = currentLevel;
      const prog = getProgressionState(currentXp, currentGold);
      currentLevel = prog.level;
      setPlayerLevel(currentLevel);
      setPlayerXpPercent(prog.xpProgressPercent);

      damageNumbers.spawn(px, terrainHeight(px, pz) + 1.2, pz, Math.round(gold * goldMult), 'gold');

      if (currentLevel > oldLevel) {
        sound.playLevelUp();
        stage.addCameraShake(0.4);
        damageNumbers.spawn(px, terrainHeight(px, pz) + 1.8, pz, 'LEVEL UP!', 'status');
        setCombatLine(`LEVEL UP! Defeated ${entityName}. Reached Level ${currentLevel}.`);
        activeStats = refreshStats();
        playerHealth = Math.min(activeStats.maxHp, playerHealth + activeStats.maxHp * 0.35);
        setPlayerHp(playerHealth);
      }
    };

    const resetPlayer = (message: string) => {
      px = spawnX;
      pz = spawnZ;
      heading = Math.PI * 0.25;
      playerHealth = activeStats.maxHp;
      setPlayerHp(playerHealth);
      setCombatLine(message);
      castLockUntil = clock + 0.4;
    };

    const hurtPlayer = (amount: number, source: string) => {
      const mitigation = getArmorDamageReduction(activeStats.armor);
      const actualDmg = Math.max(1, amount * (1 - mitigation));
      playerHealth = Math.max(0, playerHealth - actualDmg);
      combatFx.addBurst(px, pz, TEAMS.dusk.light);
      damageNumbers.spawn(px, terrainHeight(px, pz) + 1.0, pz, actualDmg, 'physical');

      if (playerHealth <= 0) {
        setPlayerHp(0);
        setEnemyKills((k) => k + 1);
        resetPlayer(`${source} drops you. You wake at the Dawn gate.`);
      } else {
        setPlayerHp(playerHealth);
        setCombatLine(`${source} hits you for ${Math.round(actualDmg)}.`);
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
        idol_blessing: '🌾',
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

    const resolveHit = (
      label: string,
      amount: number,
      covers: (x: number, z: number, radius: number) => boolean,
      isCrit = false
    ): boolean => {
      let foeOutcome: FoeOutcome | null = null;
      let damageDealtToFoes = 0;

      const hasEclipse = liveBuffs.some((b) => b.type === 'moons_eclipse' && clock < b.expiresAt);
      const appliedDamage = hasEclipse ? amount * 1.2 : amount;

      // ── Treant Duel Strike ─────────────────────────────────────────────────
      if (covers(brute.x, brute.z, FOE_RADIUS) && brute.hurt(appliedDamage, clock)) {
        foeOutcome = { name: KAPRE.name, amount: appliedDamage, downed: !brute.alive };
        setTreantHp(brute.health);
        combatFx.addBurst(brute.x, brute.z, TEAMS.dawn.light);
        sound.playSpellImpact();
        damageNumbers.spawn(brute.x, terrainHeight(brute.x, brute.z) + 1.2, brute.z, appliedDamage, isCrit ? 'crit' : 'physical');

        if (!brute.alive && foe) {
          foe.object.visible = false;
          sound.playKillAnnouncement();
          stage.addCameraShake(0.6);
          setAllyKills((k) => k + 1);
          awardXpAndGold(BOUNTIES.hero.xp, BOUNTIES.hero.gold, KAPRE.name);
        }
        damageDealtToFoes += appliedDamage;
      }

      // ── 3v3 MOBA AI Team Strike ───────────────────────────────────────────
      const botReport = botTeamManager.strike('dawn', (x, z, r) => covers(x, z, r), appliedDamage);
      for (const hit of botReport.hits) {
        combatFx.addBurst(hit.x, hit.z, TEAMS.dawn.light);
        sound.playMeleeHit();
        damageNumbers.spawn(hit.x, terrainHeight(hit.x, hit.z) + 1.2, hit.z, appliedDamage, isCrit ? 'crit' : 'physical');
        damageDealtToFoes += appliedDamage;
      }
      for (const felled of botReport.felled) {
        stage.addCameraShake(0.65);
        setAllyKills((k) => k + 1);
        awardXpAndGold(BOUNTIES.hero.xp, BOUNTIES.hero.gold, felled.bot.hero.name);

        const now = clock;
        if (now - lastKillTime > 12.0) {
          killStreakCount = 0;
        }
        killStreakCount++;
        lastKillTime = now;

        if (killStreakCount === 1) {
          sound.playFirstBlood();
          damageNumbers.spawn(felled.bot.x, terrainHeight(felled.bot.x, felled.bot.z) + 2.0, felled.bot.z, 'ENEMY SLAIN!', 'status');
          setCombatLine(`⚔️ Defeated enemy champion ${felled.bot.hero.name}! (Unang Dugo!)`);
        } else if (killStreakCount === 2) {
          sound.playDoubleKill();
          damageNumbers.spawn(felled.bot.x, terrainHeight(felled.bot.x, felled.bot.z) + 2.0, felled.bot.z, 'DOUBLE KILL!', 'status');
          setCombatLine(`🔥 DOUBLE KILL! (Dalawahang Pagpaslang) — Defeated ${felled.bot.hero.name}!`);
        } else if (killStreakCount === 3) {
          sound.playTripleKill();
          damageNumbers.spawn(felled.bot.x, terrainHeight(felled.bot.x, felled.bot.z) + 2.0, felled.bot.z, 'TRIPLE KILL!', 'status');
          setCombatLine(`⚡ TRIPLE KILL! (Tatlong Pagpaslang) — Defeated ${felled.bot.hero.name}!`);
        } else {
          sound.playMegaKill();
          damageNumbers.spawn(felled.bot.x, terrainHeight(felled.bot.x, felled.bot.z) + 2.0, felled.bot.z, 'MEGA KILL / RAMPAGE!', 'status');
          setCombatLine(`👑 MEGA KILL! WALANG KAPANTAY! — Defeated ${felled.bot.hero.name}!`);
        }
      }

      // ── Neutral Jungle Creeps Strike ──────────────────────────────────────
      const creepReport = creepManager.strike(covers, appliedDamage);
      for (const hit of creepReport.hits) {
        combatFx.addBurst(hit.x, hit.z, TEAMS.dawn.light);
        sound.playMeleeHit();
        damageNumbers.spawn(hit.x, terrainHeight(hit.x, hit.z) + 1.0, hit.z, appliedDamage, 'magic');
        damageDealtToFoes += appliedDamage;
      }
      for (const down of creepReport.felled) {
        awardXpAndGold(BOUNTIES.jungleCreep.xp, BOUNTIES.jungleCreep.gold, down.name);
      }

      // ── Major Epic Boss Strike (Maw & Treant) ─────────────────────────
      const bossReport = bossManager.strike(covers, appliedDamage, clock);
      for (const hit of bossReport.hits) {
        combatFx.addBurst(hit.x, hit.z, TEAMS.dawn.light);
        sound.playSpellImpact();
        damageNumbers.spawn(hit.x, terrainHeight(hit.x, hit.z) + 1.5, hit.z, appliedDamage, 'crit');
        damageDealtToFoes += appliedDamage;
      }
      for (const down of bossReport.felled) {
        sound.playKillAnnouncement();
        stage.addCameraShake(0.85);
        setAllyKills((k) => k + 1);
        awardXpAndGold(BOUNTIES.boss.xp, BOUNTIES.boss.gold, down.name);
      }

      // ── Minion Waves Strike ───────────────────────────────────────────────
      const minionReport = minionManager.strike(ENEMY, covers, appliedDamage);
      for (const hit of minionReport.hits) {
        combatFx.addBurst(hit.x, hit.z, TEAMS.dawn.light);
        sound.playMinionHit();
        damageNumbers.spawn(hit.x, terrainHeight(hit.x, hit.z) + 0.8, hit.z, appliedDamage, 'physical');
        damageDealtToFoes += appliedDamage;
      }
      for (const down of minionReport.felled) {
        const bounty = down.kind === 'ram' ? BOUNTIES.siegeMinion : down.kind === 'archer' ? BOUNTIES.rangedMinion : BOUNTIES.meleeMinion;
        awardXpAndGold(bounty.xp, bounty.gold, 'Minion');
      }

      // ── Objectives / Structure Strike ─────────────────────────────────────
      const report = objectives.strike(ENEMY, covers, appliedDamage);
      for (const hit of report.hits) {
        combatFx.addBurst(hit.x, hit.z, TEAMS.dawn.light);
        damageNumbers.spawn(hit.x, terrainHeight(hit.x, hit.z) + 2.0, hit.z, appliedDamage, 'magic');
      }
      for (const down of report.felled) {
        if (down.kind === 'core') {
          nexus.shatter(down.team);
          stage.addCameraShake(0.95);
          sound.playVictory();
          setWon(true);
        } else {
          towers.fell(down.id);
          stage.addCameraShake(0.65);
          sound.playKillAnnouncement();
          setAllyKills((k) => k + 1);
          awardXpAndGold(BOUNTIES.tower.xp, BOUNTIES.tower.gold, 'Tower');
        }
      }
      if (report.hits.length > 0) reportObjectives();

      // Lifesteal calculation (from Blood Thirst buff and items)
      const hasBloodThirst = liveBuffs.some((b) => b.type === 'blood_thirst' && clock < b.expiresAt);
      const totalLifesteal = (hasBloodThirst ? 0.2 : 0) + activeStats.lifestealPct;
      if (totalLifesteal > 0 && damageDealtToFoes > 0 && playerHealth > 0) {
        const heal = damageDealtToFoes * totalLifesteal;
        playerHealth = Math.min(activeStats.maxHp, playerHealth + heal);
        setPlayerHp(playerHealth);
        damageNumbers.spawn(px, terrainHeight(px, pz) + 1.2, pz, heal, 'heal');
      }

      const line = strikeLine(label, foeOutcome, report, minionReport);
      if (line) setCombatLine(line);
      else if (creepReport.hits.length > 0) setCombatLine(`Struck ${creepReport.hits[0].name}.`);
      else if (bossReport.hits.length > 0) setCombatLine(`Struck ${bossReport.hits[0].name}!`);

      return !!(line || creepReport.hits.length > 0 || bossReport.hits.length > 0);
    };

    const startWindup = (
      slot: CastSlot,
      ability: Ability,
      targetOverride?: { x?: number; z?: number; heading?: number }
    ) => {
      const startX = px;
      const startZ = pz;
      let castHeading = heading;
      let targetX = mouseGroundX;
      let targetZ = mouseGroundZ;

      if (targetOverride?.heading !== undefined) {
        castHeading = targetOverride.heading;
        const dir = direction(castHeading);
        targetX = startX + dir.x * ability.range;
        targetZ = startZ + dir.z * ability.range;
      } else if (targetOverride?.x !== undefined && targetOverride?.z !== undefined) {
        targetX = targetOverride.x;
        targetZ = targetOverride.z;
        castHeading = Math.atan2(targetX - startX, targetZ - startZ);
      } else {
        // ── Mobile Smart Auto-Aim Targeting Engine ────────────────────────
        const searchRange = ability.range * 1.35;
        let foundTarget: { x: number; z: number } | null = null;
        let lowestHp = Infinity;
        let nearestDist = Infinity;

        // 1. Enemy bot heroes (prioritize lowest HP, then closest)
        for (const bot of botTeamManager.enemies) {
          if (bot.health > 0) {
            const dist = Math.hypot(bot.x - startX, bot.z - startZ);
            if (dist <= searchRange) {
              if (bot.health < lowestHp || (bot.health === lowestHp && dist < nearestDist)) {
                lowestHp = bot.health;
                nearestDist = dist;
                foundTarget = { x: bot.x, z: bot.z };
              }
            }
          }
        }

        // 2. Jungle Boss (Kapre Treant / Maw)
        if (!foundTarget && brute.alive) {
          const dist = Math.hypot(brute.x - startX, brute.z - startZ);
          if (dist <= searchRange) {
            foundTarget = { x: brute.x, z: brute.z };
          }
        }

        // 3. Jungle Creeps
        if (!foundTarget) {
          for (const c of creepManager.creeps) {
            if (c.alive) {
              const dist = Math.hypot(c.x - startX, c.z - startZ);
              if (dist <= searchRange && dist < nearestDist) {
                nearestDist = dist;
                foundTarget = { x: c.x, z: c.z };
              }
            }
          }
        }

        // 4. Enemy Minions
        if (!foundTarget) {
          for (const m of minionManager.minions) {
            if (m.team === ENEMY && m.alive) {
              const dist = Math.hypot(m.x - startX, m.z - startZ);
              if (dist <= searchRange && dist < nearestDist) {
                nearestDist = dist;
                foundTarget = { x: m.x, z: m.z };
              }
            }
          }
        }

        if (foundTarget) {
          targetX = foundTarget.x;
          targetZ = foundTarget.z;
          castHeading = Math.atan2(targetX - startX, targetZ - startZ);
        } else if (joyRef.current.x !== 0 || joyRef.current.z !== 0) {
          // Aim towards joystick movement heading
          const cos = Math.cos(camera.yaw);
          const sin = Math.sin(camera.yaw);
          const joyX = joyRef.current.x * cos + joyRef.current.z * sin;
          const joyZ = -joyRef.current.x * sin + joyRef.current.z * cos;
          castHeading = Math.atan2(joyX, joyZ);
          const dir = direction(castHeading);
          targetX = startX + dir.x * ability.range;
          targetZ = startZ + dir.z * ability.range;
        } else {
          // Fall back to hero facing
          castHeading = heading;
          const dir = direction(castHeading);
          targetX = startX + dir.x * ability.range;
          targetZ = startZ + dir.z * ability.range;
        }
      }

      heading = castHeading;
      const dir = direction(castHeading);
      const life = Math.max(0.12, ability.windup);

      sound.playSpellCast(ability.shape);
      haptics.cast();
      combatFx.addCastRune(startX, startZ, 2.4, TEAMS.dawn.light, life + 0.1);

      if (ability.shape === 'ground') {
        const targetDist = Math.min(ability.range, Math.hypot(targetX - startX, targetZ - startZ));
        const tx = startX + dir.x * targetDist;
        const tz = startZ + dir.z * targetDist;
        combatFx.addCircle(tx, tz, ability.width, TEAMS.dawn.light, life);
        reticles.show(ability, startX, startZ, tx, tz, TEAMS.dawn.light);
      } else if (ability.shape === 'cone') {
        combatFx.addCone(startX, startZ, castHeading, ability.range, ability.width, TEAMS.dawn.light, life);
        reticles.show(ability, startX, startZ, targetX, targetZ, TEAMS.dawn.light);
      } else {
        combatFx.addLine(startX, startZ, castHeading, ability.range, ability.width, TEAMS.dawn.light, life);
        reticles.show(ability, startX, startZ, targetX, targetZ, TEAMS.dawn.light);
      }

      windups.push({
        ability,
        slot,
        x: startX,
        z: startZ,
        heading: castHeading,
        triggerAt: clock + ability.windup,
      });
      const skillRank = skillLevelsRef.current[slot as keyof typeof skillLevelsRef.current] ?? 1;
      const rankCdMult = Math.pow(0.94, Math.max(0, skillRank - 1));
      ready[slot] = clock + ability.cooldown * rankCdMult * (1 - activeStats.cooldownHaste);
      castLockUntil = Math.max(castLockUntil, clock + ability.lock);
      setCombatLine(`${ability.name} (Rank ${skillRank}) aimed.`);
    };

    const tryCast = (
      slot: CastSlot,
      targetOverride?: { x?: number; z?: number; heading?: number; targetType?: 'hero' | 'minion' | 'tower' }
    ) => {
      if (clock < castLockUntil || dash) return;
      const currentHero = heroRef.current;
      const cooldown = ready[slot] - clock;
      const ability = abilityForSlot(currentHero, slot);
      const label = slot === 'potion' ? 'Health Potion' : slot === 'spell' ? 'Flicker Spell' : ability?.name ?? 'Strike';
      if (cooldown > 0) {
        setCombatLine(`${label} ready in ${cooldown.toFixed(1)}s.`);
        return;
      }

      if (slot === 'potion') {
        ready.potion = clock + 35;
        sound.playPotion();
        haptics.tick();
        grantBuff('idol_blessing', 'Talisman Potion Regen', 5.0);
        playerHealth = Math.min(activeStats.maxHp, playerHealth + 250);
        setPlayerHp(playerHealth);
        damageNumbers.spawn(px, terrainHeight(px, pz) + 1.2, pz, 250, 'heal');
        combatFx.addBlessingBurst(px, pz, 0x10b981);
        setCombatLine('Used Health Potion (+250 HP recovered).');
        syncCooldowns();
        return;
      }

      if (slot === 'spell') {
        ready.spell = clock + 45;
        sound.playDash();
        haptics.cast();
        let castHeading = heading;
        if (targetOverride?.heading !== undefined) {
          castHeading = targetOverride.heading;
        } else if (targetOverride?.x !== undefined && targetOverride?.z !== undefined) {
          castHeading = Math.atan2(targetOverride.x - px, targetOverride.z - pz);
        } else if (joyRef.current.x !== 0 || joyRef.current.z !== 0) {
          const cos = Math.cos(camera.yaw);
          const sin = Math.sin(camera.yaw);
          const dx = joyRef.current.x * cos + joyRef.current.z * sin;
          const dz = -joyRef.current.x * sin + joyRef.current.z * cos;
          castHeading = Math.atan2(dx, dz);
        } else {
          castHeading = heading;
        }
        const dir = direction(castHeading);
        const blinkDist = 6.5;
        const next = resolveBody(px + dir.x * blinkDist, pz + dir.z * blinkDist, heroRadius(currentHero.build.scale));
        combatFx.addBurst(px, pz, 0x00e5ff);
        px = next.x;
        pz = next.z;
        heading = castHeading;
        combatFx.addBurst(px, pz, 0x00e5ff);
        stage.addCameraShake(0.25);
        setCombatLine('Cast Flicker Spell (Instant Flash Dash)!');
        syncCooldowns();
        return;
      }

      if (slot === 'basic' || slot === 'basic_minion' || slot === 'basic_tower') {
        ready.basic = clock + currentHero.attackCooldown / activeStats.attackSpeedMultiplier;
        ready.basic_minion = ready.basic;
        ready.basic_tower = ready.basic;
        castLockUntil = Math.max(castLockUntil, clock + Math.min(0.18, currentHero.attackCooldown * 0.3));

        let castHeading = heading;
        const searchRange = currentHero.attackRange * 2.2;

        if (slot === 'basic_minion') {
          // Prioritize nearest enemy minion or jungle creep
          let nearestDist = Infinity;
          let targetX = px;
          let targetZ = pz;
          let found = false;

          for (const m of minionManager.minions) {
            if (m.team === ENEMY && m.alive) {
              const d = Math.hypot(m.x - px, m.z - pz);
              if (d < searchRange && d < nearestDist) {
                nearestDist = d;
                targetX = m.x;
                targetZ = m.z;
                found = true;
              }
            }
          }
          if (!found) {
            for (const c of creepManager.creeps) {
              if (c.alive) {
                const d = Math.hypot(c.x - px, c.z - pz);
                if (d < searchRange && d < nearestDist) {
                  nearestDist = d;
                  targetX = c.x;
                  targetZ = c.z;
                  found = true;
                }
              }
            }
          }
          if (found) {
            castHeading = Math.atan2(targetX - px, targetZ - pz);
          }
        } else if (slot === 'basic_tower') {
          // Prioritize nearest enemy tower or core
          let nearestDist = Infinity;
          let targetX = px;
          let targetZ = pz;
          let found = false;
          for (const s of objectives.all) {
            if (s.team === ENEMY && objectives.alive(s)) {
              const d = Math.hypot(s.x - px, s.z - pz);
              if (d < searchRange + 2.0 && d < nearestDist) {
                nearestDist = d;
                targetX = s.x;
                targetZ = s.z;
                found = true;
              }
            }
          }
          if (found) {
            castHeading = Math.atan2(targetX - px, targetZ - pz);
          }
        } else {
          // Hero / Boss / General Priority
          if (targetOverride?.heading !== undefined) {
            castHeading = targetOverride.heading;
          } else if (targetOverride?.x !== undefined && targetOverride?.z !== undefined) {
            castHeading = Math.atan2(targetOverride.x - px, targetOverride.z - pz);
          } else {
            // Auto-lock onto nearest enemy bot hero or Treant if in range
            let nearestDist = Infinity;
            let targetX = px;
            let targetZ = pz;
            let found = false;

            for (const bot of botTeamManager.enemies) {
              if (bot.health > 0) {
                const d = Math.hypot(bot.x - px, bot.z - pz);

                if (d < searchRange && d < nearestDist) {
                  nearestDist = d;
                  targetX = bot.x;
                  targetZ = bot.z;
                  found = true;
                }
              }
            }

            if (!found && brute.alive) {
              const d = Math.hypot(brute.x - px, brute.z - pz);
              if (d < searchRange) {
                targetX = brute.x;
                targetZ = brute.z;
                found = true;
              }
            }
            if (found) {
              castHeading = Math.atan2(targetX - px, targetZ - pz);
            } else {
              const aimHeading = Math.atan2(mouseGroundX - px, mouseGroundZ - pz);
              castHeading = Number.isFinite(aimHeading) ? aimHeading : heading;
            }
          }
        }

        heading = castHeading;
        sound.playMeleeHit();
        haptics.tick();
        combatFx.addLine(px, pz, castHeading, currentHero.attackRange, BASIC_WIDTH, TEAMS.dawn.light, 0.16);
        combatFx.addSlashArc(px, pz, castHeading, Math.max(1.8, currentHero.attackRange * 0.85), TEAMS.dawn.light, 0.22);
        const landed = resolveHit('Strike', activeStats.attack, (tx, tz, r) =>
          lineHitsPoint(px, pz, castHeading, currentHero.attackRange, BASIC_WIDTH, tx, tz, r)
        );
        if (landed) haptics.hit();
        if (!landed) setCombatLine('Strike cuts empty air.');
        return;
      }

      if (ability) startWindup(slot, ability, targetOverride);
    };

    const resolveWindup = (cast: WindupCast) => {
      reticles.hide();
      const dir = direction(cast.heading);
      const targetX = cast.x + dir.x * cast.ability.range;
      const targetZ = cast.z + dir.z * cast.ability.range;

      if (cast.ability.shape === 'projectile') {
        const object = combatFx.makeProjectile(TEAMS.dawn.light);
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

      const skillRank = skillLevelsRef.current[cast.slot as keyof typeof skillLevelsRef.current] ?? 1;
      const rankDmgMult = 1.0 + (skillRank - 1) * 0.18;
      const effectiveDmg = Math.round(cast.ability.damage * rankDmgMult);

      if (cast.ability.shape === 'ground') {
        if (cast.ability.damage <= 0) {
          setCombatLine(`${cast.ability.name} takes hold.`);
          return;
        }
        const landed = resolveHit(cast.ability.name, effectiveDmg, (tx, tz, r) =>
          Math.hypot(tx - targetX, tz - targetZ) <= cast.ability.width + r
        );
        if (landed) haptics.hit();
        if (!landed) setCombatLine(`${cast.ability.name} lands empty.`);
        return;
      }

      if (cast.ability.shape === 'cone') {
        combatFx.addCone(cast.x, cast.z, cast.heading, cast.ability.range, cast.ability.width, TEAMS.dawn.light, 0.18);
        const landed = resolveHit(cast.ability.name, effectiveDmg, (tx, tz, r) =>
          coneHitsPoint(cast.x, cast.z, cast.heading, cast.ability.range, cast.ability.width, tx, tz, r)
        );
        if (landed) haptics.hit();
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

    let cameraTargetX = px;
    let cameraTargetZ = pz;
    let matchOutcomeProcessed = false;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = last === 0 ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;

      const want = heroRef.current;
      if (want.id !== activeHeroId) {
        activeHeroId = want.id;
        activeStats = refreshStats();
        playerHealth = activeStats.maxHp;
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
        tryCast(queuedCast.slot, queuedCast.target);
        syncCooldowns();
      }


      // ── Movement & Controls ───────────────────────────────────────────────
      // Android & Bluetooth Gamepad Polling
      const gp = android.pollGamepad();
      if (gp.connected) {
        if (!gamepadConnected) {
          setGamepadConnected(true);
          setGamepadName(gp.id);
        }
        if (gp.moveX !== 0 || gp.moveZ !== 0) {
          joyRef.current = { x: gp.moveX, z: gp.moveZ };
        }
        if (gp.aimActive) {
          const cos = Math.cos(camera.yaw);
          const sin = Math.sin(camera.yaw);
          const worldAimX = gp.aimX * cos + gp.aimZ * sin;
          const worldAimZ = -gp.aimX * sin + gp.aimZ * cos;
          heading = Math.atan2(worldAimX, worldAimZ);
        }
        if (gp.attack) tryCast('basic');
        if (gp.minionAttack) tryCast('basic_minion');
        if (gp.ability0) tryCast('ability0');
        if (gp.ability1) tryCast('ability1');
        if (gp.ability2) tryCast('ability2');
        if (gp.ultimate) tryCast('ultimate');
        if (gp.potion) tryCast('potion');
        if (gp.spell) tryCast('spell');
        if (gp.pingAttack) pingFn.current?.('attack');
        if (gp.pingDefend) pingFn.current?.('defend');
        if (gp.pingRetreat) pingFn.current?.('retreat');
        if (gp.pingOmw) pingFn.current?.('gather');
      }

      const turnKey = (keys.has('q') ? 1 : 0) - (keys.has('e') ? 1 : 0);
      camera.update(dt, turnKey + turnRef.current);
      if (Math.abs(camera.yaw - yawShown) > 0.02) {
        yawShown = camera.yaw;
        setCompass(camera.yaw);
      }

      let ix = joyRef.current.x;
      let iz = joyRef.current.z;
      if (keys.has('w') || keys.has('arrowup')) iz -= 1;
      if (keys.has('s') || keys.has('arrowdown')) iz += 1;
      if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
      if (keys.has('d') || keys.has('arrowright')) ix -= 1;

      const kx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      const kz = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
      if (kx !== 0 || kz !== 0) {
        setKeyboardVector({ x: kx, z: kz });
      } else if (joyRef.current.x === 0 && joyRef.current.z === 0) {
        setKeyboardVector({ x: 0, z: 0 });
      }

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
        const cos = Math.cos(camera.yaw);
        const sin = Math.sin(camera.yaw);
        const dx = ix * cos + iz * sin;
        const dz = -ix * sin + iz * cos;
        const len = Math.hypot(dx, dz) || 1;
        const hasWindStride = liveBuffs.some((b) => b.type === 'wind_stride' && clock < b.expiresAt);
        const inRiver = onCrossing(px, pz);
        const isDaylight = clock % 600 < 420;
        let territorySpeedMult = 1.0;
        if (territory.id === 'skyhold' && isDaylight && !hiddenSeen) {
          territorySpeedMult *= 1.10;
        } else if (territory.id === 'van_long_uyen' && inRiver) {
          territorySpeedMult *= 1.15;
        } else if (territory.id === 'gubat_dawn' && hiddenSeen) {
          territorySpeedMult *= 1.20;
        }
        const speedMult = (hasWindStride ? 1.35 : 1.0) * riverSpeed(px, pz) * territorySpeedMult;
        const step = activeStats.speed * speedMult * dt;
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

      // Passive health regeneration & Territory blessings
      let extraRegen = 0;
      if (territory.id === 'gubat_dawn' && inBrush) {
        extraRegen += 2.5;
      }
      if (playerHealth > 0 && playerHealth < activeStats.maxHp) {
        playerHealth = Math.min(activeStats.maxHp, playerHealth + (activeStats.hpRegen + extraRegen) * dt);
        setPlayerHp(playerHealth);
      }

      // Van Long Uyen: Jade Dragon Ward (+200 HP shield when entering combat)
      if (territory.id === 'van_long_uyen' && clock >= jadeShieldCooldown && playerHealth > 0) {
        jadeShieldCooldown = clock + 40;
        grantBuff('idol_blessing', 'Jade Dragon Ward (+200 HP)', 8.0);
        playerHealth = Math.min(activeStats.maxHp + 200, playerHealth + 200);
        combatFx.addBlessingBurst(px, pz, 0x10b981);
        damageNumbers.spawn(px, terrainHeight(px, pz) + 1.4, pz, 200, 'heal');
      }

      // Expired buffs cleanup & Idol Blessing health regeneration
      for (let i = liveBuffs.length - 1; i >= 0; i--) {
        if (clock >= liveBuffs[i].expiresAt) liveBuffs.splice(i, 1);
      }
      const hasIdolBlessing = liveBuffs.some((b) => b.type === 'idol_blessing' && clock < b.expiresAt);
      if (hasIdolBlessing && playerHealth < activeStats.maxHp && playerHealth > 0) {
        playerHealth = Math.min(activeStats.maxHp, playerHealth + 35 * dt);
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

      // ── Brute Simulation ──────────────────────────────────────────────────
      if (foe) {
        const tick = brute.update(dt, {
          clock,
          playerX: px,
          playerZ: pz,
          playerRadius: heroRadius(want.build.scale),
          playerHidden: hiddenSeen,
        });
        if (tick.returned) {
          setTreantHp(brute.health);
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

      // ── 3v3 MOBA AI Champion Team Simulation ──────────────────────────────
      const botActions = botTeamManager.update(
        dt,
        clock,
        px,
        pz,
        playerHealth,
        activeStats.maxHp,
        heroRef.current,
        'dawn',
        minionManager.minions,
        objectives,
        activePingRef.current
      );

      for (const bot of botTeamManager.all) {
        const actor = botActors.get(bot.id);
        const action = botActions.get(bot.id);
        if (!actor) continue;

        if (bot.state === 'dead') {
          actor.object.visible = false;
        } else {
          actor.object.visible = true;
          actor.setPosition(bot.x, terrainHeight(bot.x, bot.z), bot.z);
          actor.setFacing(bot.heading);
          actor.play(action?.type === 'move' ? 'walk' : 'idle');
          actor.update(dt);

          if (action?.type === 'attack') {
            const teamColor = TEAMS[bot.team].light;
            combatFx.addLine(bot.x, bot.z, bot.heading, bot.hero.attackRange, BASIC_WIDTH, teamColor, 0.16);
            if (bot.team === 'dusk') {
              if (Math.hypot(px - bot.x, pz - bot.z) <= bot.hero.attackRange + 1.1) {
                hurtPlayer(bot.attack, bot.hero.name);
                sound.playMeleeHit();
              }
            }
          } else if (action?.type === 'cast' && action.slot) {
            const botAbility = abilityForSlot(bot.hero, action.slot);
            if (botAbility) {
              const teamColor = TEAMS[bot.team].light;
              combatFx.addCastRune(bot.x, bot.z, 2.0, teamColor, 0.35);
              if (botAbility.shape === 'cone') {
                combatFx.addCone(bot.x, bot.z, bot.heading, botAbility.range, botAbility.width, teamColor, 0.25);
              } else if (botAbility.shape === 'ground') {
                const tX = bot.x + Math.sin(bot.heading) * Math.min(botAbility.range, 6);
                const tZ = bot.z + Math.cos(bot.heading) * Math.min(botAbility.range, 6);
                combatFx.addCircle(tX, tZ, botAbility.width, teamColor, 0.35);
              } else {
                combatFx.addLine(bot.x, bot.z, bot.heading, botAbility.range, botAbility.width, teamColor, 0.22);
              }
              if (bot.team === 'dusk') {
                if (Math.hypot(px - bot.x, pz - bot.z) <= botAbility.range) {
                  hurtPlayer(botAbility.damage, `${bot.hero.name}'s ${botAbility.name}`);
                  sound.playSpellImpact();
                }
              }
            }
          }
        }
      }

      // ── Jungle Creeps Simulation ──────────────────────────────────────────
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

      // ── Epic Bosses (Maw & Treant) Simulation ─────────────────────────
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
        if (bossTick.announcement.includes('Maw') || bossTick.announcement.includes('Treant')) {
          stage.addCameraShake(0.75);
        }
      }
      for (const tel of bossTick.telegraphs) {
        if (tel.type === 'circle') {
          combatFx.addCircle(tel.x, tel.z, tel.radius ?? 5.5, tel.colour, 0.6);
          stage.addCameraShake(0.55);
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
      bossRender.update(bossManager.maw, bossManager.treant, bossManager.pushingTreant, clock);

      const distMaw = Math.hypot(px - bossManager.maw.x, pz - bossManager.maw.z);
      const distTreant = Math.hypot(px - bossManager.treant.x, pz - bossManager.treant.z);
      if (bossManager.maw.alive && (distMaw <= 32 || bossManager.maw.inCombat)) {
        setBossName('Maw — The Moon-Eater');
        setBossHp(bossManager.maw.health);
        setBossMaxHp(bossManager.maw.maxHealth);
      } else if (bossManager.treant.alive && (distTreant <= 32 || bossManager.treant.inCombat)) {
        setBossName('Treant — Giant Tree Warden');
        setBossHp(bossManager.treant.health);
        setBossMaxHp(bossManager.treant.maxHealth);
      } else {
        setBossName(undefined);
        setBossHp(0);
      }

      // Minion simulation and combat
      minionManager.update(dt, clock, objectives, (from, tx, tz, isRanged) => {
        const teamColour = from.team === 'dawn' ? TEAMS.dawn.light : TEAMS.dusk.light;
        if (isRanged) {
          const gap = Math.hypot(tx - from.x, tz - from.z);
          const angle = Math.atan2(tx - from.x, tz - from.z);
          combatFx.addLine(from.x, from.z, angle, gap, 0.12, teamColour, 0.16);
        } else {
          combatFx.addBurst(tx, tz, teamColour);
        }
      });
      minionRender.update(minionManager.minions, clock);

      // Idol jungle camp boons
      const camp = campAt(px, pz);
      if (camp) {
        if (camp.id.startsWith('idol-nw') || camp.id.startsWith('idol-se')) {
          if (playerHealth < activeStats.maxHp && playerHealth > 0) {
            playerHealth = Math.min(activeStats.maxHp, playerHealth + 36 * dt);
            setPlayerHp(playerHealth);
          }
        }
      }

      // Tower acquisition & fire
      if (playerHealth > 0) {
        const shot = towerFire.update(clock, px, pz, minionManager);
        if (shot.from) {
          const maskY = terrainHeight(shot.from.x, shot.from.z) + (shot.from.tier === 1 ? 7.6 : shot.from.tier === 2 ? 9.1 : 10.8);
          const targetY = combatGroundY(shot.targetX, shot.targetZ) + 1.2;
          const shotColour = TEAMS[shot.from.team as TeamId]?.light ?? TEAMS[ENEMY].light;
          sound.playTowerShot();
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
            sound.playTowerImpact();
            hurtPlayer(shot.damage, 'A tower');
          } else if (shot.minionHit) {
            sound.playTowerImpact();
            combatFx.addBurst(shot.targetX, shot.targetZ, shotColour);
          }
        }
      }

      if (player) {
        player.setPosition(px, onCrossing(px, pz) ? DECK_HEIGHT : terrainHeight(px, pz), pz);
        player.setFacing(heading);
        player.play(moving ? 'run' : 'idle');
        player.update(dt);
      }
      terrain.userData.update?.(clock);
      clutter.update(clock);
      groundCover.update(clock);
      nexus.update(clock);
      towers.update(clock);
      camps.update(clock);
      jungle.update(clock);
      river.update(clock);
      backdrop.update(clock);
      wisp.update(clock);
      combatFx.update(dt);
      stage.update(dt, clock, bossManager.maw.inCombat);
      
      // Smooth dynamic camera aim lead and minimap drag scouting for mobile
      const scoutTarget = scoutMapTargetRef.current;
      if (scoutTarget) {
        cameraTargetX += (scoutTarget.x - cameraTargetX) * 0.25;
        cameraTargetZ += (scoutTarget.z - cameraTargetZ) * 0.25;
      } else {
        const aimPreview = aimPreviewRef.current;
        if (aimPreview && aimPreview.active && !aimPreview.isCancelZone && aimPreview.targetX !== undefined && aimPreview.targetZ !== undefined) {
          const dx = aimPreview.targetX - px;
          const dz = aimPreview.targetZ - pz;
          const dist = Math.hypot(dx, dz);
          const maxLead = 4.2;
          const leadDist = Math.min(dist * 0.35, maxLead);
          const leadX = px + (dist > 0.1 ? (dx / dist) * leadDist : 0);
          const leadZ = pz + (dist > 0.1 ? (dz / dist) * leadDist : 0);
          cameraTargetX += (leadX - cameraTargetX) * 0.15;
          cameraTargetZ += (leadZ - cameraTargetZ) * 0.15;
        } else {
          cameraTargetX += (px - cameraTargetX) * 0.2;
          cameraTargetZ += (pz - cameraTargetZ) * 0.2;
        }
      }
      stage.lookAtGround(cameraTargetX, cameraTargetZ);
      stage.render();

      // Screen Projections & Floating Numbers
      const cW = canvas.clientWidth || 1;
      const cH = canvas.clientHeight || 1;
      const activeFloatingTexts = damageNumbers.update(dt, stage.camera, cW, cH);
      setFloatingTexts(activeFloatingTexts);

      const tempV = new THREE.Vector3();
      const hH = heroHeight(want.build.scale);
      const py = onCrossing(px, pz) ? DECK_HEIGHT : terrainHeight(px, pz);
      tempV.set(px, py + hH + 0.35, pz).project(stage.camera);
      setPlayerScreenPos({
        x: (tempV.x * 0.5 + 0.5) * cW,
        y: (-tempV.y * 0.5 + 0.5) * cH,
        visible: tempV.z < 1,
      });
      setPlayerPos({ x: px, z: pz, heading });

      if (foe && brute.alive) {
        const fy = onCrossing(brute.x, brute.z) ? DECK_HEIGHT : terrainHeight(brute.x, brute.z);
        tempV.set(brute.x, fy + KAPRE.model.height * 0.9, brute.z).project(stage.camera);
        setFoeScreenPos({
          x: (tempV.x * 0.5 + 0.5) * cW,
          y: (-tempV.y * 0.5 + 0.5) * cH,
          visible: tempV.z < 1,
        });
        setFoePos({ x: brute.x, z: brute.z });
      } else {
        setFoeScreenPos(undefined);
      }

      // Check Victory & Defeat Conditions
      const wardstone = objectives.core('dawn');
      if (wardstone && wardstone.health <= 0 && !won && !defeated) {
        setDefeated(true);
        sound.playDefeat();
        haptics.damage();
        stage.addCameraShake(1.2);
        setCombatLine('💀 The Dawn Sanctuary Core has fallen! Defeat.');
        if (!matchOutcomeProcessed) {
          matchOutcomeProcessed = true;
          const reward = recordMatchOutcome({
            heroId: activeHeroId,
            territoryId: territory.id,
            won: false,
            matchDuration: clock,
            playerKills: allyKills,
            playerDeaths: 1,
            playerAssists: 0,
            heroLevel: currentLevel,
            towersDestroyed: 0,
            bossesSlain: 0,
          });
          setMatchReward(reward);
        }
      }
      const duskCore = objectives.core('dusk');
      if (duskCore && duskCore.health <= 0 && !won && !defeated) {
        setWon(true);
        sound.playVictory();
        haptics.victory();
        stage.addCameraShake(1.5);
        setCombatLine('🏆 The Dusk Core has been shattered! VICTORY!');
        if (!matchOutcomeProcessed) {
          matchOutcomeProcessed = true;
          const reward = recordMatchOutcome({
            heroId: activeHeroId,
            territoryId: territory.id,
            won: true,
            matchDuration: clock,
            playerKills: allyKills,
            playerDeaths: 0,
            playerAssists: 2,
            heroLevel: currentLevel,
            towersDestroyed: 3,
            bossesSlain: 1,
          });
          setMatchReward(reward);
        }
      }

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
        setMatchTime(clock);
        currentGold += 1; // +1 gold/sec passive income
        setPlayerGold(currentGold);
        setMinionsData(
          minionManager.minions.map((m) => ({
            id: m.id,
            x: m.x,
            z: m.z,
            team: m.team,
            kind: m.kind,
            health: m.health,
            maxHealth: m.maxHealth,
          }))
        );
        setTowersData(
          objectives.all
            .filter((s) => s.kind === 'tower')
            .map((t) => ({
              id: t.id,
              x: t.x,
              z: t.z,
              team: t.team,
              alive: objectives.alive(t),
              tier: t.tier,
            }))
        );
        setActiveBuffs(
          liveBuffs.map((b) => ({
            id: b.type,
            name: b.name,
            emoji: b.emoji,
            remaining: Math.max(0, b.expiresAt - clock),
          }))
        );
        setTeammatesData(
          botTeamManager.allies.map((b) => ({
            id: b.id,
            name: b.hero.name,
            heroId: b.hero.id,
            emoji: b.hero.emoji,
            hpPct: Math.max(0, Math.min(100, (b.health / b.maxHealth) * 100)),
            manaPct: 100,
            ultReady: (b.cooldowns.ultimate ?? 0) <= 0,
            level: b.level,
            x: b.x,
            z: b.z,
            kills: b.kills,
            deaths: b.deaths,
            assists: b.assists,
            gold: b.gold,
            damageDealt: b.damageDealt,
            role: b.hero.role,
            title: b.hero.title || b.hero.role,
          }))
        );
        setEnemyBotsData(
          botTeamManager.enemies.map((b) => ({
            id: b.id,
            name: b.hero.name,
            heroId: b.hero.id,
            emoji: b.hero.emoji,
            hpPct: Math.max(0, Math.min(100, (b.health / b.maxHealth) * 100)),
            level: b.level,
            x: b.x,
            z: b.z,
            kills: b.kills,
            deaths: b.deaths,
            assists: b.assists,
            gold: b.gold,
            damageDealt: b.damageDealt,
            role: b.hero.role,
            title: b.hero.title || b.hero.role,
          }))
        );
        combatUiClock = 0;
      }
    };

    pingFn.current = (type: string) => {
      stage.addCameraShake(0.2);
      if (type === 'gather') {
        mapPingFn.current?.(36, -14, 'omw');
      } else if (type === 'attack') {
        mapPingFn.current?.(0, 0, 'attack');
      } else {
        mapPingFn.current?.(px, pz, 'defend');
      }
    };

    loop();

    return () => {
      disposed = true;
      zoomFn.current = null;
      castFn.current = null;
      pingFn.current = null;
      mapPingFn.current = null;
      buyFn.current = null;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
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
      groundCover.dispose();
      nexus.dispose();
      towers.dispose();
      walls.dispose();
      camps.dispose();
      jungle.dispose();
      river.dispose();
      backdrop.dispose();
      wisp.dispose();
      combatFx.dispose();
      reticles.dispose();
      damageNumbers.clear();
      minionRender.dispose();
      creepRender.dispose();
      bossRender.dispose();
      player?.dispose();
      foe?.dispose();
      botActors.forEach((a) => {
        stage.scene.remove(a.object);
        a.dispose();
      });
      botActors.clear();
      removeBackGuard();
      unsubGpConnect();
      unsubGpDisconnect();
      android.releaseWakeLock();
      stage.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      <HeroHud
        hero={hero}
        territory={territory}
        playable={playable}
        onPick={setHero}
        fps={fps}
        hidden={hidden}
        playerHp={playerHp}
        playerMaxHp={playerMaxHp}
        playerLevel={playerLevel}
        playerGold={playerGold}
        playerXpPercent={playerXpPercent}
        playerPos={playerPos}
        playerScreenPos={playerScreenPos}
        foeName={KAPRE.name}
        foeHp={treantHp}
        foeMaxHp={KAPRE.health}
        foePos={foePos}
        foeScreenPos={foeScreenPos}
        minions={minionsData}
        towers={towersData}
        matchTime={matchTime}
        allyKills={allyKills}
        enemyKills={enemyKills}
        combatLine={combatLine}
        objectiveLine={objectiveLine}
        won={won}
        defeated={defeated}
        matchReward={matchReward}
        cooldowns={cooldowns}
        onCast={cast}
        onCastTarget={handleCastTarget}
        onAimPreview={handleAimPreview}
        onMoveVector={(dx, dz) => {
          joyRef.current = { x: dx, z: dz };
        }}
        keyboardMovingVector={keyboardVector}
        compass={compass}
        zoomShown={zoomShown}
        onZoom={zoomBy}
        onTurn={(dir) => {
          turnRef.current = dir;
        }}
        onPing={handlePing}
        onMapPing={handleMapPing}
        onScoutMap={handleScoutMap}
        onSkillUpgrade={handleSkillUpgrade}
        onQualityChange={handleQualityChange}
        onBuyItem={handleBuyItem}
        equippedItems={equippedItems}
        effectiveStats={effectiveStats}
        floatingTexts={floatingTexts}
        activeBuffs={activeBuffs}
        bossName={bossName}
        bossHp={bossHp}
        bossMaxHp={bossMaxHp}
        teammatesData={teammatesData}
        enemyBotsData={enemyBotsData}
        activePings={activePings}
        gamepadConnected={gamepadConnected}
        gamepadName={gamepadName}
      />
    </div>
  );
}
