'use client';

// Master Mobile & Desktop MOBA HUD Component (P08 Complete Overhaul).
//
// ── HUD ARCHITECTURE (CLASSIC MOBILE & PC MOBA LAYOUT) ────────────────────────────
// 1. TOP-LEFT: Fixed Mini-Map (180x180, #2C3E50 slate border, 3-lane radar with
//    blue/red icons) + Vertical Quick Utility Menu (Stats [ℹ], Shop [💰], Ping [📍], Settings [⚙]).
// 2. TOP-RIGHT: Match Score Bar (Ally vs Enemy Kills, Timer MM:SS) + Horizontal Teammate
//    Health Portraits with live segmented HP bars and glowing Ultimate indicators.
// 3. BOTTOM-LEFT: Virtual Touch Joystick (160x160 outer ring, draggable thumb pad,
//    WASD directional keyboard visual binding & touch/pointer dragging).
// 4. BOTTOM-RIGHT: Circular Skill Cluster:
//    - Primary Attack Button (85px, gold frame #E5B25D, sword/trident icon [J])
//    - Skill 1 (55px, bottom: 40px, right: 140px [Q])
//    - Skill 2 (55px, bottom: 110px, right: 120px [W])
//    - Skill 3 (55px, bottom: 150px, right: 50px [E])
//    - Ultimate (65px, bottom: 120px, right: 190px [R], gold glowing halo)
//    - Health Potion (40px [D]) & Battle Spell (40px [F])
// 5. FLOATING OVERHEAD BARS: Centered directly above character meshes with Player
//    Name (e.g. APOLAKI), Level Badge (Lvl 1-15), segmented Health/Mana bars, and Gold XP Bar.
// 6. FLOATING COMBAT NUMBERS: Projected damage, crits, heals, gold, and status badges.
// 7. TOP-CENTER: Epic Boss HUD Bar (Maw & Treant) and Streamlined Combat Log.
// 8. REAL INVENTORY & STAT MODALS: Live Talisman item shop & detailed RPG stat calculations.

import React, { useState, useRef, useEffect } from 'react';
import { TEAMS, type TeamId } from '@/game/arena/nexus';
import type { CastSlot, CooldownState } from '@/game/combat';
import { abilityForSlot, BATTLE_SPELLS, type BattleSpell, type BattleSpellId } from '@/game/combat/casting';
import type { Hero } from '@/game/heroes';
import { CAMPS } from '@/game/arena/camps';
import { AGIMAT_ITEMS, type TalismanItem } from '@/game/items/catalogue';
import type { EffectiveHeroStats } from '@/game/items/inventory';
import type { FloatingTextHudData } from '@/game/render3d/damageNumbers';
import { sound } from '@/game/audio/synth';
import { haptics } from '@/game/audio/haptics';
import {
  loadPlayerProfile,
  claimQuest,
  updateSettings,
  getRankForLevel,
  type PlayerProfile,
  type MatchRewardResult,
} from '@/game/progression/profile';
import { type Territory, DEFAULT_TERRITORY } from '@/game/territories';
import { android } from '@/game/platform/android';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface AimPreviewData {
  slot: CastSlot;
  active: boolean;
  targetX?: number;
  targetZ?: number;
  heading?: number;
  isCancelZone?: boolean;
}

export interface ActiveBuff {
  id: string;
  name: string;
  emoji: string;
  remaining: number;
}

export interface MinionHudData {
  id: string;
  x: number;
  z: number;
  team: TeamId;
  kind?: 'spear' | 'archer' | 'ram';
  health: number;
  maxHealth: number;
}

export interface TowerHudData {
  id: string;
  x: number;
  z: number;
  team: TeamId;
  alive: boolean;
  tier: number;
}

export interface TeammateHudData {
  id: string;
  name: string;
  heroId: string;
  emoji: string;
  hpPct: number;
  manaPct: number;
  ultReady: boolean;
  level: number;
  x: number;
  z: number;
  kills: number;
  deaths: number;
  assists: number;
  gold: number;
  damageDealt: number;
  role: string;
  title: string;
}

export interface EnemyBotHudData {
  id: string;
  name: string;
  heroId: string;
  emoji: string;
  hpPct: number;
  level: number;
  x: number;
  z: number;
  kills: number;
  deaths: number;
  assists: number;
  gold: number;
  damageDealt: number;
  role: string;
  title: string;
}

export interface TacticalPingData {
  id: string;
  x: number;
  z: number;
  type: string;
  label: string;
  expiresAt: number;
}

export interface ScreenCoord {
  x: number;
  y: number;
  visible: boolean;
}

export interface HeroHudProps {
  hero: Hero;
  territory?: Territory;
  playable: Hero[];
  onPick: (hero: Hero) => void;
  fps: number;
  hidden: boolean;
  playerHp: number;
  playerMaxHp?: number;
  playerLevel?: number;
  playerGold?: number;
  playerXpPercent?: number;
  playerPos?: { x: number; z: number; heading: number };
  playerScreenPos?: ScreenCoord;
  foeName: string;
  foeHp: number;
  foeMaxHp: number;
  foePos?: { x: number; z: number };
  foeScreenPos?: ScreenCoord;
  minions?: MinionHudData[];
  towers?: TowerHudData[];
  matchTime?: number;
  allyKills?: number;
  enemyKills?: number;
  combatLine: string;
  objectiveLine: string;
  won: boolean;
  defeated?: boolean;
  matchReward?: MatchRewardResult;
  cooldowns: CooldownState;
  onCast: (slot: CastSlot) => void;
  onCastTarget?: (slot: CastSlot, target?: { x?: number; z?: number; heading?: number; targetType?: 'hero' | 'minion' | 'tower' }) => void;
  onAimPreview?: (data: AimPreviewData) => void;
  onMoveVector?: (dx: number, dz: number) => void;
  keyboardMovingVector?: { x: number; z: number };
  compass: number;
  zoomShown: number;
  onZoom: (factor: number) => void;
  onTurn: (dir: number) => void;
  onPing?: (type: string) => void;
  onMapPing?: (worldX: number, worldZ: number, type: string) => void;
  onScoutMap?: (target: { x: number; z: number } | null) => void;
  onSkillUpgrade?: (slot: 'ability0' | 'ability1' | 'ability2' | 'ultimate', newLevel: number) => void;
  onQualityChange?: (quality: 'performance' | 'balanced' | 'ultra') => void;
  onBuyItem?: (item: TalismanItem) => void;
  equippedItems?: TalismanItem[];
  effectiveStats?: EffectiveHeroStats;
  floatingTexts?: FloatingTextHudData[];
  activeBuffs?: ActiveBuff[];
  bossName?: string;
  bossHp?: number;
  bossMaxHp?: number;
  teammatesData?: TeammateHudData[];
  enemyBotsData?: EnemyBotHudData[];
  activePings?: TacticalPingData[];
  gamepadConnected?: boolean;
  gamepadName?: string;
  battleSpell?: BattleSpellId;
  onSelectBattleSpell?: (id: BattleSpellId) => void;
}

export default function HeroHud({
  hero,
  territory = DEFAULT_TERRITORY,
  playable,
  onPick,
  fps,
  hidden,
  playerHp,
  playerMaxHp = hero.health,
  playerLevel = 1,
  playerGold = 500,
  playerXpPercent = 0,
  playerPos = { x: -84.5, z: 84.5, heading: Math.PI * 0.25 },
  playerScreenPos,
  foeName,
  foeHp,
  foeMaxHp,
  foePos = { x: 0, z: 0 },
  foeScreenPos,
  minions = [],
  towers = [],
  matchTime = 0,
  allyKills = 0,
  enemyKills = 0,
  combatLine,
  objectiveLine,
  won,
  defeated = false,
  matchReward,
  cooldowns,
  onCast,
  onCastTarget,
  onAimPreview,
  onMoveVector,
  keyboardMovingVector = { x: 0, z: 0 },
  compass,
  zoomShown,
  onZoom,
  onTurn,
  onPing,
  onMapPing,
  onScoutMap,
  onSkillUpgrade,
  onQualityChange,
  onBuyItem,
  equippedItems = [],
  effectiveStats,
  floatingTexts = [],
  activeBuffs = [],
  bossName,
  bossHp = 0,
  bossMaxHp = 1,
  teammatesData,
  enemyBotsData,
  activePings = [],
  gamepadConnected = false,
  gamepadName = '',
  battleSpell = 'flicker',
  onSelectBattleSpell,
}: HeroHudProps) {
  // ── Modal Dialog States ──────────────────────────────────────────────────
  const [showStats, setShowStats] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showMinionsCodex, setShowMinionsCodex] = useState(false);
  const [showTerritoryCodex, setShowTerritoryCodex] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBattleSpells, setShowBattleSpells] = useState(false);
  const [showBattlePings, setShowBattlePings] = useState(false);
  const [activeStoryChapter, setActiveStoryChapter] = useState<number>(1);
  const [showProfile, setShowProfile] = useState(false);
  const [profileTab, setProfileTab] = useState<'dossier' | 'quests' | 'mastery'>('dossier');
  const [pingNotification, setPingNotification] = useState<string | null>(null);
  const [quickBuyAlert, setQuickBuyAlert] = useState<string | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isHapticsOn, setIsHapticsOn] = useState(true);
  const [joystickMode, setJoystickMode] = useState<'fixed' | 'dynamic'>('fixed');
  const [graphicsQuality, setGraphicsQuality] = useState<'performance' | 'balanced' | 'ultra'>('balanced');
  const [hudScale, setHudScale] = useState<'compact' | 'normal' | 'large'>('normal');
  const [isPortrait, setIsPortrait] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoAimPriority, setAutoAimPriority] = useState<'lowest_hp' | 'closest'>('lowest_hp');
  const [fpsTarget, setFpsTarget] = useState<number>(60);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile>(() => loadPlayerProfile());
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosInstallGuide, setShowIosInstallGuide] = useState(false);
  const [dynamicOrigin, setDynamicOrigin] = useState<{ x: number; y: number } | null>(null);

  // HUD Premium Polish — tactile cooldown sweep + gold halo on ult ready
  // Skills animate via CSS pulseGold; this hook ensures haptics fire once per ready state.
  // Progressive Skill Levels State
  const [skillLevels, setSkillLevels] = useState<{
    ability0: number;
    ability1: number;
    ability2: number;
    ultimate: number;
  }>({
    ability0: 1,
    ability1: 1,
    ability2: 1,
    ultimate: 0,
  });

  // Calculate unspent skill upgrade points
  const pointsSpent = (skillLevels.ability0 - 1) + (skillLevels.ability1 - 1) + (skillLevels.ability2 - 1) + skillLevels.ultimate;
  const availableSkillPoints = Math.max(0, (playerLevel - 1) - pointsSpent);

  // Capture PWA beforeinstallprompt event
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Track Fullscreen State
  useEffect(() => {
    const updateFs = () => {
      setIsFullscreen(android.isFullscreen());
    };
    document.addEventListener('fullscreenchange', updateFs);
    document.addEventListener('webkitfullscreenchange', updateFs);
    return () => {
      document.removeEventListener('fullscreenchange', updateFs);
      document.removeEventListener('webkitfullscreenchange', updateFs);
    };
  }, []);

  const handleToggleFullscreen = async () => {
    if (android.isFullscreen()) {
      await android.exitFullscreen();
      setIsFullscreen(false);
    } else {
      await android.enterImmersiveLandscape();
      setIsFullscreen(true);
    }
    haptics.tick();
  };

  // Detect orientation changes for mobile guide
  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window !== 'undefined') {
        const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 800;
        setIsPortrait(portrait);
      }
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // ── Global Desktop Keyboard Navigation & Shortcuts ───────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid intercepting input if typing in text inputs
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        setShowScoreboard((prev) => !prev);
        sound.playPing('select');
      } else if (e.key === 'Escape') {
        setShowScoreboard(false);
        setShowStats(false);
        setShowShop(false);
        setShowMinionsCodex(false);
        setShowSettings(false);
        setShowRoster(false);
        setShowTerritoryCodex(false);
        setShowProfile(false);
        setShowBattlePings(false);
      } else if (e.key === 'b' || e.key === 'B') {
        onCast('recall');
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'o' || e.key === 'O') {
        setShowShop((prev) => !prev);
        sound.playPing('select');
      } else if (e.key === 'c' || e.key === 'C' || e.key === 'i' || e.key === 'I') {
        setShowStats((prev) => !prev);
        sound.playPing('select');
      } else if (e.key === 'm' || e.key === 'M') {
        setShowTerritoryCodex((prev) => !prev);
        sound.playPing('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCast]);

  // ── Virtual Joystick State ───────────────────────────────────────────────
  const joystickContainerRef = useRef<HTMLDivElement | null>(null);
  const [thumbPos, setThumbPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const pointerIdRef = useRef<number | null>(null);

  // ── Skill Drag-Aiming & Smart-Cast States ─────────────────────────────────
  const [aimSlot, setAimSlot] = useState<CastSlot | null>(null);
  const [aimDragOffset, setAimDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isInCancelZone, setIsInCancelZone] = useState<boolean>(false);
  const aimPointerIdRef = useRef<number | null>(null);
  const aimStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Derive active thumbpad position (dragging vs keyboard WASD tactile feedback)
  const isKeyboardMoving = keyboardMovingVector.x !== 0 || keyboardMovingVector.z !== 0;
  const keyboardLen = Math.hypot(keyboardMovingVector.x, keyboardMovingVector.z) || 1;
  const activeThumbX = isDragging
    ? thumbPos.x
    : isKeyboardMoving
    ? (keyboardMovingVector.x / keyboardLen) * 36
    : 0;
  const activeThumbY = isDragging
    ? thumbPos.y
    : isKeyboardMoving
    ? (keyboardMovingVector.z / keyboardLen) * 36
    : 0;

  const updateJoystickPos = (clientX: number, clientY: number, originOverride?: { x: number; y: number } | null) => {
    const origin = originOverride !== undefined ? originOverride : dynamicOrigin;
    let centerX: number;
    let centerY: number;

    if (joystickMode === 'dynamic' && origin) {
      centerX = origin.x;
      centerY = origin.y;
    } else if (joystickContainerRef.current) {
      const rect = joystickContainerRef.current.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
    } else {
      return;
    }

    const rawDx = clientX - centerX;
    const rawDy = clientY - centerY;
    const dist = Math.hypot(rawDx, rawDy);
    const maxRadius = 48;

    let clampedX = rawDx;
    let clampedY = rawDy;
    if (dist > maxRadius) {
      clampedX = (rawDx / dist) * maxRadius;
      clampedY = (rawDy / dist) * maxRadius;
    }

    setThumbPos({ x: clampedX, y: clampedY });

    if (onMoveVector) {
      if (dist > 4) {
        onMoveVector(clampedX / maxRadius, clampedY / maxRadius);
      } else {
        onMoveVector(0, 0);
      }
    }
  };

  const handleJoystickPointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    pointerIdRef.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    haptics.tick();
    updateJoystickPos(e.clientX, e.clientY);
  };

  const handleDynamicZonePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    pointerIdRef.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    haptics.tick();

    if (joystickMode === 'dynamic') {
      const origin = { x: e.clientX, y: e.clientY };
      setDynamicOrigin(origin);
      setThumbPos({ x: 0, y: 0 });
      onMoveVector?.(0, 0);
    } else {
      updateJoystickPos(e.clientX, e.clientY);
    }
  };

  const handleJoystickPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || e.pointerId !== pointerIdRef.current) return;
    updateJoystickPos(e.clientX, e.clientY);
  };

  const handleJoystickPointerUp = (e: React.PointerEvent) => {
    if (e.pointerId === pointerIdRef.current) {
      setIsDragging(false);
      pointerIdRef.current = null;
      setThumbPos({ x: 0, y: 0 });
      setDynamicOrigin(null);
      onMoveVector?.(0, 0);
    }
  };

  // ── Skill Upgrade Handler ─────────────────────────────────────────────────
  const handleSkillUpgrade = (slot: 'ability0' | 'ability1' | 'ability2' | 'ultimate') => {
    if (availableSkillPoints <= 0) return;
    const currentRank = skillLevels[slot];
    const maxRank = slot === 'ultimate' ? 3 : 5;
    if (currentRank >= maxRank) return;
    if (slot === 'ultimate' && playerLevel < 4) return;

    const nextRank = currentRank + 1;
    const nextSkillLevels = { ...skillLevels, [slot]: nextRank };
    setSkillLevels(nextSkillLevels);
    onSkillUpgrade?.(slot, nextRank);
    sound.playPing('select');
    haptics.levelUp();

    const abilityName = slot === 'ultimate' ? hero.ultimate.name : hero.abilities[slot === 'ability0' ? 0 : slot === 'ability1' ? 1 : 2]?.name ?? 'Skill';
    setPingNotification(`✨ I-tinakda: ${abilityName} Rank ${nextRank}! (+18% Dmg, -6% CD)`);
    setTimeout(() => setPingNotification(null), 3200);
  };

  // ── Minimap Touch Scouting Handlers ───────────────────────────────────────
  const isMapScoutingRef = useRef(false);
  const mapScoutStartRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });

  const handleMinimapPointerDown = (e: React.PointerEvent) => {
    isMapScoutingRef.current = true;
    mapScoutStartRef.current = { x: e.clientX, y: e.clientY, time: performance.now() };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const worldX = (clickX / rect.width) * 200 - 100;
    const worldZ = (clickY / rect.height) * 200 - 100;
    onScoutMap?.({ x: worldX, z: worldZ });
  };

  const handleMinimapPointerMove = (e: React.PointerEvent) => {
    if (!isMapScoutingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const worldX = (clickX / rect.width) * 200 - 100;
    const worldZ = (clickY / rect.height) * 200 - 100;
    onScoutMap?.({ x: worldX, z: worldZ });
  };

  const handleMinimapPointerUp = (e: React.PointerEvent) => {
    if (!isMapScoutingRef.current) return;
    isMapScoutingRef.current = false;
    const duration = performance.now() - mapScoutStartRef.current.time;
    const dist = Math.hypot(e.clientX - mapScoutStartRef.current.x, e.clientY - mapScoutStartRef.current.y);

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const worldX = (clickX / rect.width) * 200 - 100;
    const worldZ = (clickY / rect.height) * 200 - 100;

    if (duration < 300 && dist < 12) {
      // Quick tap without significant drag: Trigger tactical map attack ping
      onMapPing?.(worldX, worldZ, 'attack');
      sound.playPing('attack');
      haptics.tick();
    }

    // Snap camera smoothly back to hero
    onScoutMap?.(null);
  };

  // ── PWA Native Install Trigger ────────────────────────────────────────────
  const handleInstallApp = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
        }
      } catch {
        setShowIosInstallGuide(true);
      }
    } else {
      setShowIosInstallGuide(true);
    }
  };

  // ── Skill Drag-Aiming Pointer Handlers ────────────────────────────────────
  const handleAbilityPointerDown = (e: React.PointerEvent, slot: CastSlot) => {
    e.stopPropagation();
    const cooldown = cooldowns[slot];
    if (cooldown > 0.05) return;
    setAimSlot(slot);
    setAimDragOffset({ x: 0, y: 0 });
    setIsInCancelZone(false);
    aimPointerIdRef.current = e.pointerId;
    aimStartPosRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    haptics.tick();
  };

  const handleAbilityPointerMove = (e: React.PointerEvent) => {
    if (!aimSlot || e.pointerId !== aimPointerIdRef.current) return;
    const dx = e.clientX - aimStartPosRef.current.x;
    const dy = e.clientY - aimStartPosRef.current.y;
    const dist = Math.hypot(dx, dy);

    // Cancel zone check (top 20% of screen height)
    const inCancel = e.clientY < Math.max(120, window.innerHeight * 0.22);
    if (inCancel !== isInCancelZone) {
      setIsInCancelZone(inCancel);
      haptics.tick();
    }

    const maxDragRadius = 45;
    const clampedOffset = dist > maxDragRadius
      ? { x: (dx / dist) * maxDragRadius, y: (dy / dist) * maxDragRadius }
      : { x: dx, y: dy };
    setAimDragOffset(clampedOffset);

    const currentHero = hero;
    const ability = abilityForSlot(currentHero, aimSlot);
    if (!ability) return;

    if (dist > 12) {
      // Calculate world aiming angle
      const dragScreenAngle = Math.atan2(dx, dy);
      const worldHeading = dragScreenAngle + compass;
      const targetDist = Math.min(ability.range, ability.range * Math.min(1.0, dist / 38));
      const targetX = playerPos.x + Math.sin(worldHeading) * targetDist;
      const targetZ = playerPos.z + Math.cos(worldHeading) * targetDist;

      onAimPreview?.({
        slot: aimSlot,
        active: true,
        targetX,
        targetZ,
        heading: worldHeading,
        isCancelZone: inCancel,
      });
    } else {
      onAimPreview?.({
        slot: aimSlot,
        active: false,
      });
    }
  };

  const handleAbilityPointerUp = (e: React.PointerEvent) => {
    if (e.pointerId !== aimPointerIdRef.current || !aimSlot) return;
    const slotToCast = aimSlot;
    const currentHero = hero;
    const ability = abilityForSlot(currentHero, slotToCast);
    const dx = e.clientX - aimStartPosRef.current.x;
    const dy = e.clientY - aimStartPosRef.current.y;
    const dist = Math.hypot(dx, dy);
    const inCancel = isInCancelZone;

    setAimSlot(null);
    setAimDragOffset({ x: 0, y: 0 });
    setIsInCancelZone(false);
    aimPointerIdRef.current = null;
    onAimPreview?.({ slot: slotToCast, active: false });

    if (inCancel) {
      haptics.tick();
      return;
    }

    if (dist > 12 && ability) {
      const dragScreenAngle = Math.atan2(dx, dy);
      const worldHeading = dragScreenAngle + compass;
      const targetDist = Math.min(ability.range, ability.range * Math.min(1.0, dist / 38));
      const targetX = playerPos.x + Math.sin(worldHeading) * targetDist;
      const targetZ = playerPos.z + Math.cos(worldHeading) * targetDist;

      haptics.cast();
      if (onCastTarget) {
        onCastTarget(slotToCast, { x: targetX, z: targetZ, heading: worldHeading });
      } else {
        onCast(slotToCast);
      }
    } else {
      // Quick-tap
      haptics.cast();
      onCast(slotToCast);
    }
  };

  // ── 1-Tap Mobile Quick-Buy Item Calculator ────────────────────────────────
  const recommendedItem = AGIMAT_ITEMS.find(
    (item) => !equippedItems.some((eq) => eq.id === item.id) && playerGold >= item.cost
  );

  // ── Quick Ping & Ancestral Warcall Trigger ────────────────────────────────
  const triggerPing = (type: string, message: string) => {
    sound.playPing(type);
    onPing?.(type);
    setPingNotification(message);
    setTimeout(() => setPingNotification(null), 3000);
  };

  const triggerWarCall = (warCallType: 'sulong' | 'iwas' | 'tabi' | 'tulong' | 'chime') => {
    setShowBattlePings(false);
    if (warCallType === 'sulong') {
      sound.playPing('danger');
      setPingNotification('⚔ ATTACK! Push the enemy line');
      onPing?.('attack');
    } else if (warCallType === 'iwas') {
      sound.playPing('danger');
      setPingNotification('⚠️ DANGER! Watch the jungle');
      onPing?.('retreat');
    } else if (warCallType === 'tabi') {
      sound.playReedTwang();
      setPingNotification('🌿 FALL BACK! Hide and regroup');
      onPing?.('stealth');
    } else if (warCallType === 'tulong') {
      sound.playPing('gather');
      setPingNotification('🛡 HELP! Defend the tower');
      onPing?.('assist');
    } else if (warCallType === 'chime') {
      sound.playChimeChime();
      setPingNotification('🎶 KULINTANG: the Willow bless this fight');
      onPing?.('blessing');
    }
    setTimeout(() => setPingNotification(null), 3500);
  };


  // ── Battle Spell & Ability Configurations ─────────────────────────────────
  const activeSpell = BATTLE_SPELLS.find((s) => s.id === battleSpell) ?? BATTLE_SPELLS[0];

  const ability0 = hero.abilities[0] || {
    id: 'ab0',
    name: 'Strike',
    blurb: 'Primary ability strike.',
    emoji: '⚔',
    cooldown: 8,
  };
  const ability1 = hero.abilities[1] || {
    id: 'ab1',
    name: 'Shield',
    blurb: 'Protective ward barrier.',
    emoji: '🛡',
    cooldown: 10,
  };
  const ability2 = hero.abilities[2] || {
    id: 'ab2',
    name: 'Burst',
    blurb: 'Agile empower burst.',
    emoji: '✨',
    cooldown: 7,
  };

  // Teammates list for status indicators (supports live 3v3 bot data)
  const defaultTeammates: TeammateHudData[] = [
    { id: 'tm-1', name: 'Bernardo', heroId: 'bedrock', emoji: '⛰', hpPct: 100, manaPct: 100, ultReady: true, level: playerLevel, x: -70, z: 20, kills: 0, deaths: 0, assists: 0, gold: 500, damageDealt: 0, role: 'vanguard', title: 'The Mountain Giant' },
    { id: 'tm-2', name: 'Willow', heroId: 'willow', emoji: '🌿', hpPct: 90, manaPct: 90, ultReady: true, level: playerLevel, x: -20, z: 70, kills: 0, deaths: 0, assists: 0, gold: 500, damageDealt: 0, role: 'warden', title: 'Warden of the Grove' },
  ];
  const teammates = teammatesData && teammatesData.length > 0 ? teammatesData : defaultTeammates;

  // Minion divisions breakdown
  const dawnSpear = minions.filter((m) => m.team === 'dawn' && m.kind === 'spear' && m.health > 0).length;
  const dawnArcher = minions.filter((m) => m.team === 'dawn' && m.kind === 'archer' && m.health > 0).length;
  const dawnRam = minions.filter((m) => m.team === 'dawn' && m.kind === 'ram' && m.health > 0).length;
  const duskSpear = minions.filter((m) => m.team === 'dusk' && m.kind === 'spear' && m.health > 0).length;
  const duskArcher = minions.filter((m) => m.team === 'dusk' && m.kind === 'archer' && m.health > 0).length;
  const duskRam = minions.filter((m) => m.team === 'dusk' && m.kind === 'ram' && m.health > 0).length;

  // Match time formatted
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const playerPct = Math.max(0, Math.min(100, (playerHp / playerMaxHp) * 100));

  return (
    <div style={hudRoot}>
      {/* ══════════════════════════════════════════════════════════════════════
          1. MINI-MAP (TOP-LEFT ANCHOR: 15px, 15px, 180x180, #2C3E50 BORDER)
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={minimapContainer}>
        <svg
          style={{ ...minimapSvg, cursor: 'crosshair', touchAction: 'none' }}
          viewBox="0 0 180 180"
          onPointerDown={handleMinimapPointerDown}
          onPointerMove={handleMinimapPointerMove}
          onPointerUp={handleMinimapPointerUp}
          onPointerCancel={handleMinimapPointerUp}
        >
          {/* Radar Background Grids */}
          <rect width="180" height="180" fill="#0B1320" rx="8" />
          <circle cx="90" cy="90" r="80" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <circle cx="90" cy="90" r="45" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

          {/* the Sacred River S-Curve Channel */}
          <path
            d="M 170,10 C 130,50 150,90 90,90 C 30,90 50,130 10,170"
            fill="none"
            stroke="rgba(0, 229, 255, 0.28)"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* 3 MOBA Lanes */}
          {/* Top Lane: Dawn -> West -> North -> Dusk */}
          <path
            d="M 22,158 L 22,22 L 158,22"
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="7"
            strokeLinejoin="round"
          />
          {/* Mid Lane: Diagonal Dawn -> Dusk */}
          <line
            x1="22"
            y1="158"
            x2="158"
            y2="22"
            stroke="rgba(255, 255, 255, 0.24)"
            strokeWidth="8"
          />
          {/* Bot Lane: Dawn -> South -> East -> Dusk */}
          <path
            d="M 22,158 L 158,158 L 158,22"
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="7"
            strokeLinejoin="round"
          />

          {/* Base Sanctuaries */}
          {/* Dawn Base (South-West / Bottom-Left) */}
          <circle cx="22" cy="158" r="14" fill="rgba(255, 179, 0, 0.25)" stroke="#FFB300" strokeWidth="2" />
          <text x="22" y="161" fill="#FFB300" fontSize="8" fontWeight="bold" textAnchor="middle">
            ANITO
          </text>

          {/* Dusk Base (North-East / Top-Right) */}
          <circle cx="158" cy="22" r="14" fill="rgba(0, 229, 255, 0.25)" stroke="#00E5FF" strokeWidth="2" />
          <text x="158" y="25" fill="#00E5FF" fontSize="7.5" fontWeight="bold" textAnchor="middle">
            MALAKAS
          </text>

          {/* Towers Radar Icons */}
          {towers.map((t) => {
            const mx = ((t.x + 100) / 200) * 180;
            const my = ((t.z + 100) / 200) * 180;
            const isDawn = t.team === 'dawn';
            return (
              <circle
                key={t.id}
                cx={mx}
                cy={my}
                r={t.tier === 3 ? 3.5 : 2.8}
                fill={t.alive ? (isDawn ? '#2980B9' : '#C0392B') : '#475569'}
                stroke={t.alive ? (isDawn ? '#60A5FA' : '#F87171') : '#334155'}
                strokeWidth="1"
              />
            );
          })}

          {/* Jungle Camps & Bosses */}
          {CAMPS.map((c) => {
            const mx = ((c.x + 100) / 200) * 180;
            const my = ((c.z + 100) / 200) * 180;
            const isMaw = c.id.includes('maw');
            const isTreant = c.id.includes('treant');
            return (
              <g key={c.id}>
                <circle
                  cx={mx}
                  cy={my}
                  r={isMaw || isTreant ? 4.5 : 2.5}
                  fill={isMaw ? '#7852FF' : isTreant ? '#FF7A36' : '#50E3C2'}
                  stroke="#FFFFFF"
                  strokeWidth={isMaw || isTreant ? 1.2 : 0.6}
                />
              </g>
            );
          })}

          {/* Live Lane Minions */}
          {minions.map((m) => {
            const mx = ((m.x + 100) / 200) * 180;
            const my = ((m.z + 100) / 200) * 180;
            const isDawn = m.team === 'dawn';
            return (
              <circle
                key={m.id}
                cx={mx}
                cy={my}
                r="1.8"
                fill={isDawn ? '#60A5FA' : '#F87171'}
              />
            );
          })}

          {/* Active Tactical Pings (Pulsing Rings) */}
          {activePings.map((p) => {
            const px = ((p.x + 100) / 200) * 180;
            const py = ((p.z + 100) / 200) * 180;
            return (
              <g key={p.id}>
                <circle cx={px} cy={py} r="9" fill="rgba(255, 215, 0, 0.25)" stroke="#FFD700" strokeWidth="1.5" />
                <circle cx={px} cy={py} r="3" fill="#FFD700" />
                <text x={px} y={py - 6} fill="#FFD700" fontSize="7" fontWeight="bold" textAnchor="middle">
                  {p.label}
                </text>
              </g>
            );
          })}

          {/* Allied Bot Heroes (Cyan Rings + Name Letter) */}
          {teammates.map((tm) => {
            if (tm.hpPct <= 0) return null;
            const mx = ((tm.x + 100) / 200) * 180;
            const my = ((tm.z + 100) / 200) * 180;
            return (
              <g key={tm.id || tm.name}>
                <circle cx={mx} cy={my} r="5.5" fill="rgba(0, 229, 255, 0.35)" />
                <circle cx={mx} cy={my} r="3.6" fill="#0284C7" stroke="#38BDF8" strokeWidth="1.2" />
                <text x={mx} y={my + 2.5} fill="#FFF" fontSize="6.5" fontWeight="bold" textAnchor="middle">
                  {tm.name.charAt(0)}
                </text>
              </g>
            );
          })}

          {/* Enemy Bot Heroes (Red Rings + Name Letter) */}
          {enemyBotsData?.map((eb) => {
            if (eb.hpPct <= 0) return null;
            const mx = ((eb.x + 100) / 200) * 180;
            const my = ((eb.z + 100) / 200) * 180;
            return (
              <g key={eb.id || eb.name}>
                <circle cx={mx} cy={my} r="5.5" fill="rgba(239, 68, 68, 0.35)" />
                <circle cx={mx} cy={my} r="3.6" fill="#DC2626" stroke="#FCA5A5" strokeWidth="1.2" />
                <text x={mx} y={my + 2.5} fill="#FFF" fontSize="6.5" fontWeight="bold" textAnchor="middle">
                  {eb.name.charAt(0)}
                </text>
              </g>
            );
          })}

          {/* Foe / Treant Indicator */}
          {foeHp > 0 ? (
            <circle
              cx={((foePos.x + 100) / 200) * 180}
              cy={((foePos.z + 100) / 200) * 180}
              r="4.5"
              fill="#EF4444"
              stroke="#FCA5A5"
              strokeWidth="1.5"
            />
          ) : null}

          {/* Player Hero Marker (Glowing Cyan/Gold with Facing Pointer) */}
          {(() => {
            const hx = ((playerPos.x + 100) / 200) * 180;
            const hy = ((playerPos.z + 100) / 200) * 180;
            const dirX = Math.sin(playerPos.heading) * 7;
            const dirY = Math.cos(playerPos.heading) * 7;
            return (
              <g>
                <circle cx={hx} cy={hy} r="7" fill="rgba(0, 229, 255, 0.35)" />
                <circle cx={hx} cy={hy} r="4.2" fill="#00E5FF" stroke="#FFFFFF" strokeWidth="1.5" />
                <line
                  x1={hx}
                  y1={hy}
                  x2={hx + dirX}
                  y2={hy + dirY}
                  stroke="#FFD700"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </g>
            );
          })()}
        </svg>

        {/* Mini Compass Needle Overlay */}
        <div style={minimapCompass} title={`Facing ${Math.round((-compass * 180) / Math.PI)}°`}>
          <div style={{ transform: `rotate(${-compass}rad)`, width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
            <span style={{ color: '#FFC84A', fontSize: 9, fontWeight: 900 }}>N</span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          2. QUICK UTILITY DOCK (HORIZONTAL PILL ROW DIRECTLY UNDER MINIMAP)
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={utilityMenuStack}>
        {/* Direct Hero Roster Switcher */}
        <button
          style={{ ...utilityBtn, borderColor: '#FFD700', background: 'rgba(255, 215, 0, 0.22)' }}
          title="Open Character List & Hero Switcher [👥]"
          onClick={() => setShowRoster(true)}
          aria-label="Roster and Heroes"
        >
          <span style={utilityIcon}>👥</span>
        </button>
        {/* Direct Exit to Lobby */}
        <a
          href="/"
          style={{ ...utilityBtn, borderColor: '#38BDF8', background: 'rgba(56, 189, 248, 0.2)', textDecoration: 'none' }}
          title="Exit to Main Champion Selection Lobby [🏠]"
          aria-label="Lobby"
        >
          <span style={utilityIcon}>🏠</span>
        </a>
        <button
          style={{ ...utilityBtn, borderColor: 'rgba(255, 215, 0, 0.4)', background: 'rgba(255, 215, 0, 0.12)' }}
          title="Account Profile & Quests"
          onClick={() => setShowProfile(!showProfile)}
          aria-label="Profile and Quests"
        >
          <span style={utilityIcon}>📜</span>
        </button>
        <button
          style={{ ...utilityBtn, borderColor: 'rgba(255, 215, 0, 0.6)' }}
          title={`Talisman Item Shop (🪙 ${playerGold})`}
          onClick={() => setShowShop(!showShop)}
          aria-label="Shop"
        >
          <span style={utilityIcon}>💰</span>
        </button>
        <button
          style={{ ...utilityBtn, borderColor: 'rgba(239, 68, 68, 0.6)' }}
          title="Ancestral Warcalls & Tactical Pings"
          onClick={() => setShowBattlePings(!showBattlePings)}
          aria-label="Warcalls"
        >
          <span style={utilityIcon}>📢</span>
        </button>
        <button
          style={utilityBtn}
          title="Match Scoreboard"
          onClick={() => setShowScoreboard(!showScoreboard)}
          aria-label="Scoreboard"
        >
          <span style={utilityIcon}>📊</span>
        </button>
        <button
          style={utilityBtn}
          title="Hero Info & Passives"
          onClick={() => setShowStats(!showStats)}
          aria-label="Hero Stats"
        >
          <span style={utilityIcon}>ℹ</span>
        </button>
        <button
          style={utilityBtn}
          title="Game Settings"
          onClick={() => setShowSettings(!showSettings)}
          aria-label="Settings"
        >
          <span style={utilityIcon}>⚙</span>
        </button>
        <button
          style={{
            ...utilityBtn,
            borderColor: isFullscreen ? '#38BDF8' : 'rgba(56, 189, 248, 0.6)',
            background: isFullscreen ? 'rgba(14, 165, 233, 0.3)' : 'rgba(15, 23, 42, 0.85)',
          }}
          title="Toggle Fullscreen Mode"
          onClick={handleToggleFullscreen}
          aria-label="Fullscreen"
        >
          <span style={utilityIcon}>⛶</span>
        </button>
      </div>

      {/* ── 1-Tap Floating Quick-Buy Pill ────── */}
      {recommendedItem ? (
        <div
          style={quickBuyFloatingPill}
          onClick={() => {
            onBuyItem?.(recommendedItem);
            sound.playPing('select');
            haptics.tick();
            setQuickBuyAlert(`Equipped: ${recommendedItem.name} (${recommendedItem.cost}g)`);
            setTimeout(() => setQuickBuyAlert(null), 2500);
          }}
          title={`Quick-Buy: ${recommendedItem.name} (${recommendedItem.cost}g)`}
        >
          <span style={{ fontSize: 18 }}>{recommendedItem.emoji}</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#FFD700' }}>
              🪙 {recommendedItem.cost}
            </div>
            <div style={{ fontSize: 9, color: '#F1F5F9', fontWeight: 600, maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {recommendedItem.name}
            </div>
          </div>
          <span style={quickBuyTag}>BUY</span>
        </div>
      ) : null}

      {/* Quick Buy Notification Toast */}
      {quickBuyAlert ? (
        <div style={quickBuyToast}>
          ✅ {quickBuyAlert}
        </div>
      ) : null}

      {/* ── Top-Center Drag-Aiming Red Cancel Zone Banner ──────────────────── */}
      {aimSlot ? (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 20px',
            borderRadius: 999,
            background: isInCancelZone ? 'rgba(239, 68, 68, 0.95)' : 'rgba(15, 23, 42, 0.85)',
            border: isInCancelZone ? '2px solid #FCA5A5' : '1.5px dashed rgba(239, 68, 68, 0.7)',
            boxShadow: isInCancelZone ? '0 0 30px rgba(239, 68, 68, 0.9)' : '0 4px 20px rgba(0,0,0,0.5)',
            color: '#FFF',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            pointerEvents: 'none',
            zIndex: 100,
            animation: isInCancelZone ? 'pulseCancel 0.8s infinite' : 'none',
            transition: 'all 150ms ease',
          }}
        >
          <span style={{ fontSize: 16 }}>✕</span>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8 }}>
            {isInCancelZone ? 'RELEASE TO CANCEL' : 'DRAG HERE TO CANCEL'}
          </span>
        </div>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════════════
          3. TOP-CENTER ULTRA-SLIM MATCH BAR & CHARACTER ROSTER / LOBBY PILL
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={topCenterMatchHeader}>
        <div style={scoreBarCapsule}>
          <div style={scoreAllyCol}>
            <span style={scoreBlueDot}>●</span>
            <strong style={scoreAllyNum}>{allyKills}</strong>
          </div>
          <div style={scoreTimerCol}>
            <span style={scoreTimerText}>{formatTime(matchTime)}</span>
            <span style={fpsText}>{fps} FPS</span>
          </div>
          <div style={scoreEnemyCol}>
            <strong style={scoreEnemyNum}>{enemyKills}</strong>
            <span style={scoreRedDot}>●</span>
          </div>

          <div style={scoreDivider} />

          {/* Prominent Roster / Heroes Button */}
          <button
            style={rosterHeaderBtn}
            onClick={() => setShowRoster(true)}
            title="Open Character List & Switch Hero"
            aria-label="Character List and Roster"
          >
            <span style={{ fontSize: 12 }}>👥</span>
            <span style={{ fontSize: 9.5, fontWeight: 900, color: '#FFD700', letterSpacing: 0.5 }}>HEROES</span>
          </button>

          {/* Prominent Exit to Lobby Button */}
          <a
            href="/"
            style={lobbyHeaderBtn}
            title="Return to Champion Selection Lobby"
            aria-label="Exit to Lobby"
          >
            <span style={{ fontSize: 11 }}>🏠</span>
            <span style={{ fontSize: 9.5, fontWeight: 900, color: '#38BDF8', letterSpacing: 0.5 }}>LOBBY</span>
          </a>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          4. TOP-RIGHT TEAMMATES ROW
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={topRightScoreboard}>
        <div style={teammatesRow}>
          {teammates.map((tm, idx) => (
            <div key={idx} style={teammatePortraitBox} title={`${tm.name} (Lvl ${tm.level})`}>
              <div style={teammateAvatarCircle}>
                <span style={{ fontSize: 16 }}>{tm.emoji}</span>
                {/* Glowing Green Ultimate Jewel */}
                <div
                  style={{
                    ...ultIndicatorJewel,
                    background: tm.ultReady ? '#10B981' : '#64748B',
                    boxShadow: tm.ultReady ? '0 0 8px #10B981' : 'none',
                  }}
                />
              </div>
              {/* Teammate Live Mini Health Bar */}
              <div style={teammateHpTrack}>
                <div style={{ ...teammateHpFill, width: `${tm.hpPct}%` }} />
              </div>
              <div style={teammateManaTrack}>
                <div style={{ ...teammateManaFill, width: `${tm.manaPct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          5. BOTTOM-LEFT VIRTUAL TOUCH JOYSTICK
          ══════════════════════════════════════════════════════════════════════ */}
      {joystickMode === 'dynamic' && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '45vw',
            height: '75vh',
            zIndex: 9,
            pointerEvents: 'auto',
            touchAction: 'none',
          }}
          onPointerDown={handleDynamicZonePointerDown}
          onPointerMove={handleJoystickPointerMove}
          onPointerUp={handleJoystickPointerUp}
          onPointerCancel={handleJoystickPointerUp}
        />
      )}

      {/* Render Virtual Joystick Ring */}
      <div
        ref={joystickContainerRef}
        style={{
          ...joystickOuterRing,
          ...(joystickMode === 'dynamic'
            ? dynamicOrigin
              ? {
                  position: 'fixed',
                  left: dynamicOrigin.x - 55,
                  top: dynamicOrigin.y - 55,
                  bottom: 'auto',
                  opacity: 1,
                  transform: 'none',
                }
              : {
                  opacity: 0.35,
                }
            : {}),
        }}
        onPointerDown={handleJoystickPointerDown}
        onPointerMove={handleJoystickPointerMove}
        onPointerUp={handleJoystickPointerUp}
        onPointerCancel={handleJoystickPointerUp}
      >
        {/* Cardinal Direction Notches */}
        <span style={joyNotchN}>▲</span>
        <span style={joyNotchS}>▼</span>
        <span style={joyNotchW}>◀</span>
        <span style={joyNotchE}>▶</span>

        {/* Central Draggable Thumb Pad */}
        <div
          style={{
            ...joystickThumbPad,
            transform: `translate(${activeThumbX}px, ${activeThumbY}px)`,
          }}
        >
          <div style={thumbPadInnerGlow} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          6. BOTTOM-CENTER HERO VITALS & QUICK SUMMONER SPELLS
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={bottomCenterVitalsContainer}>
        <div style={thumbVitals}>
          <div style={thumbVitalsHead}>
            <span style={thumbLevelBadge}>{playerLevel}</span>
            <span style={thumbHeroName}>{hero.name.toUpperCase()}</span>
            <span style={thumbHpNumbers}>
              {Math.ceil(playerHp)} / {effectiveStats?.maxHp ?? playerMaxHp}
            </span>
          </div>
          <div style={thumbHpTrack}>
            <div
              style={{
                ...thumbHpFill,
                width: `${playerPct}%`,
                background:
                  playerPct > 50
                    ? 'linear-gradient(90deg, #22C55E, #4ADE80)'
                    : playerPct > 25
                      ? 'linear-gradient(90deg, #F59E0B, #FBBF24)'
                      : 'linear-gradient(90deg, #DC2626, #F87171)',
              }}
            />
          </div>
        </div>

        {/* Summoner Spells / Quick Action Row */}
        <div style={quickSpellsRow}>
          {hero.passive && (
            <div
              style={{
                ...smallSpellBtn,
                borderColor: '#00E5FF',
                background: 'rgba(6, 78, 59, 0.85)',
                cursor: 'help',
              }}
              title={`[PASSIVE] ${hero.passive.name}: ${hero.passive.blurb}`}
            >
              <span style={{ fontSize: 16 }}>{hero.passive.emoji}</span>
            </div>
          )}

          {/* Battle Spell / Selected Summoner Spell (F) */}
          <div style={{ position: 'relative' }}>
            <button
              style={{
                ...smallSpellBtn,
                opacity: cooldowns.spell > 0 ? 0.55 : 1,
                transform: aimSlot === 'spell' ? `translate(${aimDragOffset.x * 0.4}px, ${aimDragOffset.y * 0.4}px) scale(1.15)` : 'none',
                boxShadow: aimSlot === 'spell' ? '0 0 20px #00E5FF' : 'none',
              }}
              onPointerDown={(e) => handleAbilityPointerDown(e, 'spell')}
              onPointerMove={handleAbilityPointerMove}
              onPointerUp={handleAbilityPointerUp}
              onPointerCancel={handleAbilityPointerUp}
              title={`Battle Spell: ${activeSpell.name} (${activeSpell.tagalogName}) [F]`}
            >
              <span style={{ fontSize: 16 }}>{activeSpell.emoji}</span>
              {cooldowns.spell > 0 ? (
                <span style={spellCooldownText}>{Math.ceil(cooldowns.spell)}</span>
              ) : null}
            </button>
            <button
              onClick={() => setShowBattleSpells(true)}
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: 'rgba(56, 189, 248, 0.95)',
                border: '1px solid #FFF',
                color: '#FFF',
                fontSize: 8,
                fontWeight: 900,
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                zIndex: 10,
              }}
              title="Change Battle Spell"
            >
              ⚙
            </button>
          </div>

          {/* Health Potion (D) */}
          <button
            style={{
              ...smallSpellBtn,
              borderColor: '#10B981',
              opacity: cooldowns.potion > 0 ? 0.55 : 1,
            }}
            onClick={() => onCast('potion')}
            title="Health Potion (+250 HP)"
          >
            <span style={{ fontSize: 16 }}>🌿</span>
            {cooldowns.potion > 0 ? (
              <span style={spellCooldownText}>{Math.ceil(cooldowns.potion)}</span>
            ) : null}
          </button>

          {/* Recall to Base (B) */}
          <button
            style={{
              ...smallSpellBtn,
              borderColor: '#38BDF8',
              opacity: cooldowns.recall > 0 ? 0.55 : 1,
            }}
            onClick={() => onCast('recall')}
            title="Recall to Sanctuary Base"
          >
            <span style={{ fontSize: 16 }}>🏠</span>
            {cooldowns.recall > 0 ? (
              <span style={spellCooldownText}>{Math.ceil(cooldowns.recall)}</span>
            ) : null}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          7. BOTTOM-RIGHT MASTER THUMB ACTION & ABILITY ARC (iOS MOBA STANDARD)
          ══════════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          ...skillClusterContainer,
          transform: hudScale === 'compact' ? 'scale(0.9)' : hudScale === 'large' ? 'scale(1.1)' : 'none',
          transformOrigin: 'bottom right',
        }}
      >
        {/* Available Skill Points Indicator Toast */}
        {availableSkillPoints > 0 && (
          <div style={skillPointsAvailableToast}>
            ⚡ {availableSkillPoints} POINTS
          </div>
        )}

        {/* Skill 1 (Strike) */}
        <div style={skill1Slot}>
          {availableSkillPoints > 0 && skillLevels.ability0 < 5 && (
            <button
              style={skillUpgradePlusBtn}
              onClick={(e) => {
                e.stopPropagation();
                handleSkillUpgrade('ability0');
              }}
              title="Upgrade Skill 1"
            >
              +
            </button>
          )}
          <button
            style={{
              ...abilityCircleBtn,
              opacity: cooldowns.ability0 > 0.05 ? 0.55 : 1,
              transform: aimSlot === 'ability0' ? `translate(${aimDragOffset.x * 0.4}px, ${aimDragOffset.y * 0.4}px) scale(1.15)` : 'none',
              boxShadow: aimSlot === 'ability0' ? '0 0 24px #00E5FF' : undefined,
            }}
            onPointerDown={(e) => handleAbilityPointerDown(e, 'ability0')}
            onPointerMove={handleAbilityPointerMove}
            onPointerUp={handleAbilityPointerUp}
            onPointerCancel={handleAbilityPointerUp}
            title={`${ability0.name}: ${ability0.blurb} (Rank ${skillLevels.ability0}/5)`}
          >
            {gamepadConnected && <span style={hotkeyBadge}>Q</span>}
            <span style={abilityEmoji}>{ability0.emoji}</span>
            {cooldowns.ability0 > 0.05 ? (
              <div style={cooldownOverlay}>
                <span style={cooldownNumber}>
                  {cooldowns.ability0 >= 10 ? Math.ceil(cooldowns.ability0) : cooldowns.ability0.toFixed(1)}
                </span>
              </div>
            ) : null}
          </button>
          <div style={rankPipsRow}>
            {[1, 2, 3, 4, 5].map((lvl) => (
              <div
                key={lvl}
                style={{
                  ...rankPip,
                  background: lvl <= skillLevels.ability0 ? '#FFD700' : 'rgba(255,255,255,0.25)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Skill 2 (Shield) */}
        <div style={skill2Slot}>
          {availableSkillPoints > 0 && skillLevels.ability1 < 5 && (
            <button
              style={skillUpgradePlusBtn}
              onClick={(e) => {
                e.stopPropagation();
                handleSkillUpgrade('ability1');
              }}
              title="Upgrade Skill 2"
            >
              +
            </button>
          )}
          <button
            style={{
              ...abilityCircleBtn,
              opacity: cooldowns.ability1 > 0.05 ? 0.55 : 1,
              transform: aimSlot === 'ability1' ? `translate(${aimDragOffset.x * 0.4}px, ${aimDragOffset.y * 0.4}px) scale(1.15)` : 'none',
              boxShadow: aimSlot === 'ability1' ? '0 0 24px #00E5FF' : undefined,
            }}
            onPointerDown={(e) => handleAbilityPointerDown(e, 'ability1')}
            onPointerMove={handleAbilityPointerMove}
            onPointerUp={handleAbilityPointerUp}
            onPointerCancel={handleAbilityPointerUp}
            title={`${ability1.name}: ${ability1.blurb} (Rank ${skillLevels.ability1}/5)`}
          >
            {gamepadConnected && <span style={hotkeyBadge}>W</span>}
            <span style={abilityEmoji}>{ability1.emoji}</span>
            {cooldowns.ability1 > 0.05 ? (
              <div style={cooldownOverlay}>
                <span style={cooldownNumber}>
                  {cooldowns.ability1 >= 10 ? Math.ceil(cooldowns.ability1) : cooldowns.ability1.toFixed(1)}
                </span>
              </div>
            ) : null}
          </button>
          <div style={rankPipsRow}>
            {[1, 2, 3, 4, 5].map((lvl) => (
              <div
                key={lvl}
                style={{
                  ...rankPip,
                  background: lvl <= skillLevels.ability1 ? '#FFD700' : 'rgba(255,255,255,0.25)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Skill 3 (Burst) */}
        <div style={skill3Slot}>
          {availableSkillPoints > 0 && skillLevels.ability2 < 5 && (
            <button
              style={skillUpgradePlusBtn}
              onClick={(e) => {
                e.stopPropagation();
                handleSkillUpgrade('ability2');
              }}
              title="Upgrade Skill 3"
            >
              +
            </button>
          )}
          <button
            style={{
              ...abilityCircleBtn,
              opacity: cooldowns.ability2 > 0.05 ? 0.55 : 1,
              transform: aimSlot === 'ability2' ? `translate(${aimDragOffset.x * 0.4}px, ${aimDragOffset.y * 0.4}px) scale(1.15)` : 'none',
              boxShadow: aimSlot === 'ability2' ? '0 0 24px #00E5FF' : undefined,
            }}
            onPointerDown={(e) => handleAbilityPointerDown(e, 'ability2')}
            onPointerMove={handleAbilityPointerMove}
            onPointerUp={handleAbilityPointerUp}
            onPointerCancel={handleAbilityPointerUp}
            title={`${ability2.name}: ${ability2.blurb} (Rank ${skillLevels.ability2}/5)`}
          >
            {gamepadConnected && <span style={hotkeyBadge}>E</span>}
            <span style={abilityEmoji}>{ability2.emoji}</span>
            {cooldowns.ability2 > 0.05 ? (
              <div style={cooldownOverlay}>
                <span style={cooldownNumber}>
                  {cooldowns.ability2 >= 10 ? Math.ceil(cooldowns.ability2) : cooldowns.ability2.toFixed(1)}
                </span>
              </div>
            ) : null}
          </button>
          <div style={rankPipsRow}>
            {[1, 2, 3, 4, 5].map((lvl) => (
              <div
                key={lvl}
                style={{
                  ...rankPip,
                  background: lvl <= skillLevels.ability2 ? '#FFD700' : 'rgba(255,255,255,0.25)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Ultimate (R / Solar Burst) */}
        <div style={ultimateSlot}>
          {availableSkillPoints > 0 && playerLevel >= 4 && skillLevels.ultimate < 3 && (
            <button
              style={{ ...skillUpgradePlusBtn, top: -10, right: 12, background: '#FFD700', color: '#000' }}
              onClick={(e) => {
                e.stopPropagation();
                handleSkillUpgrade('ultimate');
              }}
              title="Upgrade Ultimate"
            >
              +
            </button>
          )}
          <button
            style={{
              ...ultimateCircleBtn,
              opacity: cooldowns.ultimate > 0.05 ? 0.55 : 1,
              transform: aimSlot === 'ultimate' ? `translate(${aimDragOffset.x * 0.4}px, ${aimDragOffset.y * 0.4}px) scale(1.18)` : 'none',
              boxShadow: aimSlot === 'ultimate' ? '0 0 30px #FFD700' : undefined,
            }}
            onPointerDown={(e) => handleAbilityPointerDown(e, 'ultimate')}
            onPointerMove={handleAbilityPointerMove}
            onPointerUp={handleAbilityPointerUp}
            onPointerCancel={handleAbilityPointerUp}
            title={`${hero.ultimate.name}: ${hero.ultimate.blurb} (Rank ${skillLevels.ultimate}/3)`}
          >
            {gamepadConnected && <span style={hotkeyBadgeUlt}>R</span>}
            <span style={ultimateEmoji}>{hero.ultimate.emoji}</span>
            {cooldowns.ultimate > 0.05 ? (
              <div style={cooldownOverlay}>
                <span style={cooldownNumber}>
                  {cooldowns.ultimate >= 10 ? Math.ceil(cooldowns.ultimate) : cooldowns.ultimate.toFixed(1)}
                </span>
              </div>
            ) : null}
          </button>
          <div style={rankPipsRow}>
            {[1, 2, 3].map((lvl) => (
              <div
                key={lvl}
                style={{
                  ...rankPip,
                  width: 8,
                  height: 3,
                  background: lvl <= skillLevels.ultimate ? '#FFD700' : 'rgba(255,255,255,0.25)',
                }}
              />
            ))}
          </div>
        </div>

        {/* ── Mobile Target Priority Satellite Buttons ── */}
        {/* Tower Siege Priority Button */}
        <button
          style={towerTargetBtn}
          onClick={() => {
            if (onCastTarget) onCastTarget('basic_tower', { targetType: 'tower' });
            else onCast('basic');
          }}
          title="Tower Siege Attack (Target Enemy Turrets / Core)"
        >
          <span style={{ fontSize: 16 }}>🏰</span>
          <span style={{ fontSize: 7.5, fontWeight: 900, letterSpacing: 0.5 }}>TOWER</span>
        </button>

        {/* Minion / Creep Priority Button */}
        <button
          style={creepTargetBtn}
          onClick={() => {
            if (onCastTarget) onCastTarget('basic_minion', { targetType: 'minion' });
            else onCast('basic');
          }}
          title="Minion / Monster Farm Attack"
        >
          <span style={{ fontSize: 16 }}>🌾</span>
          <span style={{ fontSize: 7.5, fontWeight: 900, letterSpacing: 0.5 }}>CREEP</span>
        </button>

        {/* Master Primary Attack Button */}
        <button
          style={{
            ...mainAttackBtn,
            opacity: cooldowns.basic > 0.05 ? 0.7 : 1,
          }}
          onClick={() => {
            if (onCastTarget) onCastTarget('basic', { targetType: 'hero' });
            else onCast('basic');
          }}
          title={`Basic Attack (${effectiveStats?.attack ?? hero.attack} dmg)`}
        >
          {gamepadConnected && <span style={mainAttackKey}>J</span>}
          <span style={{ fontSize: 30 }}>⚔</span>
          <span style={mainAttackText}>ATTACK</span>
        </button>
      </div>

      {/* ── Mobile Landscape Guide Prompt (When Held in Portrait) ────────── */}
      {isPortrait ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.96)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            textAlign: 'center',
            zIndex: 9999,
            color: '#F8FAFC',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ fontSize: 64, marginBottom: 16 }}>📱 ↻</div>
          <strong style={{ fontSize: 22, color: '#FFD700', letterSpacing: 1.5, marginBottom: 8 }}>
            I-IKOT ANG TELEPONO SA LANDSCAPE
          </strong>
          <p style={{ fontSize: 14, color: '#94A3B8', maxWidth: 360, lineHeight: 1.6 }}>
            Ang Alamat ay idinisenyo para sa <strong style={{ color: '#00E5FF' }}>Pahiga (Landscape)</strong> na kontrol ng dalawang kamay. I-rotate ang iyong device para magpatuloy sa labanan!
          </p>
          <button
            style={{
              marginTop: 24,
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              border: '1px solid #38bdf8',
              color: '#FFF',
              padding: '12px 24px',
              borderRadius: 24,
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(56, 189, 248, 0.5)',
            }}
            onClick={handleToggleFullscreen}
          >
            ⛶ I-Fullscreen & I-Lock ang Screen
          </button>
        </div>
      ) : null}


      {/* ══════════════════════════════════════════════════════════════════════
          6. FLOATING OVERHEAD HEALTHBAR & XP (ANCHORED ABOVE HERO MESH)
          ══════════════════════════════════════════════════════════════════════ */}
      {playerScreenPos && playerScreenPos.visible ? (
        <div
          style={{
            ...overheadContainer,
            left: playerScreenPos.x,
            top: playerScreenPos.y - 28,
          }}
        >
          {/* Level Badge + Player Name Header */}
          <div style={overheadHeader}>
            <div style={overheadLevelBadge}>
              <span>{playerLevel}</span>
            </div>
            <span style={overheadHeroName}>{hero.name.toUpperCase()}</span>
            {hidden ? <span style={overheadHiddenTag}>🌿 HIDDEN</span> : null}
          </div>

          {/* Segmented Green Health Bar */}
          <div style={overheadHpTrack}>
            <div style={{ ...overheadHpFill, width: `${playerPct}%` }} />
            {/* Segment Dividers every 200 HP */}
            <div style={overheadSegmentsOverlay} />
          </div>

          {/* XP Progress Bar (Glowing Gold / Cyan) */}
          <div style={overheadXpTrack}>
            <div style={{ ...overheadXpFill, width: `${playerXpPercent}%` }} />
          </div>
        </div>
      ) : null}

      {/* Foe Overhead Health Bar */}
      {foeScreenPos && foeScreenPos.visible && foeHp > 0 ? (
        <div
          style={{
            ...overheadContainer,
            left: foeScreenPos.x,
            top: foeScreenPos.y - 32,
          }}
        >
          <div style={overheadHeader}>
            <div style={{ ...overheadLevelBadge, background: '#991B1B', borderColor: '#EF4444' }}>
              <span>☠</span>
            </div>
            <span style={{ ...overheadHeroName, color: '#FCA5A5' }}>{foeName.toUpperCase()}</span>
          </div>
          <div style={overheadHpTrack}>
            <div
              style={{
                ...overheadHpFill,
                background: 'linear-gradient(90deg, #DC2626, #EF4444)',
                width: `${Math.max(0, Math.min(100, (foeHp / foeMaxHp) * 100))}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════════════
          7. FLOATING COMBAT DAMAGE NUMBERS & POPUPS
          ══════════════════════════════════════════════════════════════════════ */}
      {floatingTexts.map((ft) => (
        <div
          key={ft.id}
          style={{
            position: 'absolute',
            left: ft.screenX,
            top: ft.screenY,
            transform: `translate(-50%, -50%) scale(${ft.scale})`,
            color: ft.color,
            opacity: ft.opacity,
            fontWeight: 900,
            fontSize: ft.type === 'crit' ? 24 : ft.type === 'status' ? 18 : 16,
            textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.6)',
            pointerEvents: 'none',
            zIndex: 30,
            letterSpacing: ft.type === 'status' ? 1.5 : 0.5,
          }}
        >
          {ft.text}
        </div>
      ))}

      {/* ══════════════════════════════════════════════════════════════════════
          8. TOP-CENTER EPIC BOSS HEALTH BAR & COMBAT ANNOUNCEMENTS
          ══════════════════════════════════════════════════════════════════════ */}
      {bossName && bossHp > 0 ? (
        <div style={bossBarContainer}>
          <div style={bossTitleRow}>
            <span style={bossCrown}>⚔ EPIC BOSS OBJECTIVE</span>
            <strong style={bossNameStyle}>{bossName}</strong>
            <span style={bossHpNums}>
              {Math.ceil(bossHp)} / {bossMaxHp}
            </span>
          </div>
          <div style={bossBarShell}>
            <div
              style={{
                ...bossBarFill,
                width: `${Math.max(0, Math.min(100, (bossHp / bossMaxHp) * 100))}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {/* Transient Combat Event Toast (Auto-dismissed, non-blocking) */}
      {combatLine && !combatLine.includes('Q/W/E/R') && !combatLine.includes('abilities') ? (
        <div style={combatEventToast}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#FFD700' }}>⚡ {combatLine}</span>
        </div>
      ) : null}

      {/* Ping Notification Toast */}
      {pingNotification ? (
        <div style={pingToastContainer}>
          <span>{pingNotification}</span>
        </div>
      ) : null}

      {/* Active Buffs Floating Bar (Bottom-Center above joystick/skills) */}
      {activeBuffs.length > 0 ? (
        <div style={activeBuffsBar}>
          {activeBuffs.map((b) => (
            <div key={b.id} style={buffBadgePill} title={b.name}>
              <span>{b.emoji}</span>
              <span style={{ fontWeight: 800 }}>{Math.ceil(b.remaining)}s</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════════════
          9. MODAL DIALOGS (STATS, SHOP, MINIONS CODEX, SCOREBOARD, SETTINGS, ROSTER)
          ══════════════════════════════════════════════════════════════════════ */}

      {/* Stats & Lore Dossier Modal */}
      {showStats ? (
        <div style={modalOverlay} onClick={() => setShowStats(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div>
                <strong style={{ fontSize: 18, color: '#FFD700' }}>
                </strong>
                <span style={{ display: 'block', fontSize: 12, color: '#00E5FF' }}>
                  {hero.title || hero.origin}
                </span>
              </div>
              <button style={closeBtn} onClick={() => setShowStats(false)}>
                ✕
              </button>
            </div>

            {hero.quote && (
              <div style={{ padding: '8px 12px', background: 'rgba(255, 215, 0, 0.08)', borderRadius: 6, borderLeft: '3px solid #FFD700', margin: '8px 0', fontSize: 12, color: '#FEF08A', fontStyle: 'italic' }}>
                &ldquo;{hero.quote}&rdquo;
              </div>
            )}

            {/* Innate Mythic Passive Showcase */}
            {hero.passive && (
              <div style={{ padding: '8px 12px', background: 'rgba(6, 78, 59, 0.35)', borderRadius: 8, border: '1px solid rgba(0, 229, 255, 0.4)', margin: '8px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#5EEAD4' }}>
                    {hero.passive.emoji} [INNATE PASSIVE] {hero.passive.name}
                  </span>
                  <span style={{ fontSize: 10, background: '#0D9488', color: '#FFF', padding: '2px 6px', borderRadius: 4 }}>
                    PASSIVE
                  </span>
                </div>
                <p style={{ fontSize: 11.5, color: '#CCFBF1', margin: '3px 0 0' }}>{hero.passive.blurb}</p>
                <div style={{ fontSize: 10.5, color: '#99F6E4', marginTop: 3, fontWeight: 700 }}>
                  ⚡ Effect: {hero.passive.effect}
                </div>
              </div>
            )}

            <div style={statsGrid}>
              <div style={statItem}>
                <span style={statLabel}>Role</span>
                <strong style={statVal}>{hero.role.toUpperCase()}</strong>
              </div>
              <div style={statItem}>
                <span style={statLabel}>Level & XP</span>
                <strong style={statVal}>
                  Lvl {playerLevel} ({Math.round(playerXpPercent)}%)
                </strong>
              </div>
              <div style={statItem}>
                <span style={statLabel}>Max Health</span>
                <strong style={statVal}>
                  {Math.ceil(playerHp)} / {effectiveStats?.maxHp ?? playerMaxHp} HP
                </strong>
              </div>
              <div style={statItem}>
                <span style={statLabel}>Attack Power</span>
                <strong style={statVal}>
                  {effectiveStats?.attack ?? hero.attack} ATK
                </strong>
              </div>
              <div style={statItem}>
                <span style={statLabel}>Movement Speed</span>
                <strong style={statVal}>
                  {(effectiveStats?.speed ?? hero.speed).toFixed(1)} m/s
                </strong>
              </div>
              <div style={statItem}>
                <span style={statLabel}>Armor & Mitigation</span>
                <strong style={statVal}>
                  {effectiveStats?.armor ?? 15} Armor
                </strong>
              </div>
              <div style={statItem}>
                <span style={statLabel}>Cooldown Haste</span>
                <strong style={statVal}>
                  {Math.round((effectiveStats?.cooldownHaste ?? 0) * 100)}% CDR
                </strong>
              </div>
              <div style={statItem}>
                <span style={statLabel}>Lifesteal</span>
                <strong style={statVal}>
                  {Math.round((effectiveStats?.lifestealPct ?? 0) * 100)}%
                </strong>
              </div>
            </div>

            {/* Equipped Items Row */}
            <div style={{ marginTop: 14 }}>
              <span style={{ fontSize: 12, color: '#CBD5E1', fontWeight: 700 }}>
                EQUIPPED AGIMAT ARTIFACTS ({equippedItems.length}/6):
              </span>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                {Array.from({ length: 6 }).map((_, i) => {
                  const item = equippedItems[i];
                  return (
                    <div
                      key={i}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: item ? '1.5px solid #FFD700' : '1px dashed rgba(255,255,255,0.2)',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 20,
                      }}
                      title={item ? `${item.name} (${item.blurb})` : 'Empty Item Slot'}
                    >
                      {item ? item.emoji : ''}
                    </div>
                  );
                })}
              </div>
            </div>

            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 12, lineHeight: 1.4 }}>
              {hero.lore}
            </p>
          </div>
        </div>
      ) : null}

      {/* Pangkat Division Codex Modal (Aklat ng mga Pangkat) */}
      {showMinionsCodex ? (
        <div style={modalOverlay} onClick={() => setShowMinionsCodex(false)}>
          <div style={{ ...modalCard, maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div>
                <strong style={{ fontSize: 18, color: '#FFD700' }}>
                  🛡 Aklat ng mga Pangkat (Minions Division Codex)
                </strong>
                <span style={{ display: 'block', fontSize: 11.5, color: '#94A3B8' }}>
                  Pre-colonial ancient Vanguard, Ranged, and Heavy Siege Formations
                </span>
              </div>
              <button style={closeBtn} onClick={() => setShowMinionsCodex(false)}>
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gap: 12, maxHeight: '60vh', overflowY: 'auto', marginTop: 10 }}>
              {/* 1. Spear Card */}
              <div style={minionCodexCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={minionCodexAvatar}>
                    <span style={{ fontSize: 32 }}>⚔️</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#F8FAFC', fontSize: 15 }}>Pangkat Spear (Frontline Vanguard)</strong>
                      <span style={{ fontSize: 10.5, color: '#FFD700', background: 'rgba(255,215,0,0.15)', padding: '2px 8px', borderRadius: 4 }}>MELEE</span>
                    </div>
                    <span style={{ fontSize: 11.5, color: '#00E5FF' }}>Gear: Kalasag Rattan Shield · Blade Single-Edge Sword · Putong Crown</span>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: '#CBD5E1', margin: '8px 0 6px', lineHeight: 1.4 }}>
                  Tough pre-colonial vanguard warriors who charge headfirst into combat. Their curved Kalasag shield deflects 20% of incoming ranged dart projectiles.
                </p>
                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#94A3B8' }}>
                  <span>❤️ 540 HP</span>
                  <span>⚔️ 28 Physical DMG</span>
                  <span>📏 1.5u Reach</span>
                  <span>🛡 18 Armor</span>
                </div>
              </div>

              {/* 2. Archer Card */}
              <div style={minionCodexCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ ...minionCodexAvatar, background: 'rgba(16, 185, 129, 0.2)', borderColor: '#10B981' }}>
                    <span style={{ fontSize: 32 }}>🏹</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#F8FAFC', fontSize: 15 }}>Pangkat Archer (Poison Dart Hunter)</strong>
                      <span style={{ fontSize: 10.5, color: '#34D399', background: 'rgba(16,185,129,0.15)', padding: '2px 8px', borderRadius: 4 }}>RANGED</span>
                    </div>
                    <span style={{ fontSize: 11.5, color: '#34D399' }}>Gear: Woven Conical Wicker Hat Hat · Bamboo Dart & Longbow · Poison Quiver</span>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: '#CBD5E1', margin: '8px 0 6px', lineHeight: 1.4 }}>
                  Agile jungle marksmen equipped with ceremonial feathered Wicker Hat headgear. They fire venom-tipped dart darts over friendly frontline shields.
                </p>
                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#94A3B8' }}>
                  <span>❤️ 360 HP</span>
                  <span>🏹 36 Magic Poison DMG</span>
                  <span>📏 7.5u Reach</span>
                  <span>🎯 True Sight in Brush</span>
                </div>
              </div>

              {/* 3. Ram Card */}
              <div style={{ ...minionCodexCard, borderColor: 'rgba(255, 215, 0, 0.4)', background: 'rgba(120, 53, 15, 0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ ...minionCodexAvatar, background: 'rgba(245, 158, 11, 0.25)', borderColor: '#F59E0B' }}>
                    <span style={{ fontSize: 32 }}>🐂</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#FFD700', fontSize: 15 }}>Pangkat Ram (Heavy Horned Siege Ram)</strong>
                      <span style={{ fontSize: 10.5, color: '#FCD34D', background: 'rgba(245,158,11,0.2)', padding: '2px 8px', borderRadius: 4 }}>SIEGE VANGUARD</span>
                    </div>
                    <span style={{ fontSize: 11.5, color: '#FDE68A' }}>Gear: Bronze Carabao Skull Battering Ram · Hardwood Pauldrons · War Horns</span>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: '#FEF08A', margin: '8px 0 6px', lineHeight: 1.4 }}>
                  Armored elite siege vanguard carrying sacred Carabao skull battering rams. Deals massive 2.5x structural demolition damage to enemy defensive towers and the Tower Core.
                </p>
                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#FDE68A' }}>
                  <span>❤️ 1,100 HP</span>
                  <span>💥 55 Base DMG (137.5 vs Towers)</span>
                  <span>📏 2.2u Reach</span>
                  <span>🏰 2.5x Siege Mult</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Territory Codex & Realm Video Modal */}
      {showTerritoryCodex ? (
        <div style={modalOverlay} onClick={() => setShowTerritoryCodex(false)}>
          <div
            style={{
              ...modalCard,
              maxWidth: 720,
              border: `1.5px solid ${territory.atmosphere.primaryColor}`,
              boxShadow: `0 0 32px ${territory.atmosphere.accentGlow}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={modalHeader}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, color: territory.atmosphere.primaryColor, letterSpacing: 4 }}>
                  </span>
                  <strong style={{ fontSize: 18, color: '#FFD700' }}>
                    {territory.name.toUpperCase()}
                  </strong>
                </div>
                <span style={{ display: 'block', fontSize: 11.5, color: '#00E5FF' }}>
                  {territory.title} · {territory.region}
                </span>
              </div>
              <button style={closeBtn} onClick={() => setShowTerritoryCodex(false)}>
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gap: 12, maxHeight: '68vh', overflowY: 'auto', marginTop: 10 }}>
              {/* 16:9 Looping Cinematic Video Trailer */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16 / 9',
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  background: '#000',
                }}
              >
                <video
                  src={territory.media.videoUrl}
                  poster={territory.media.imageUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 12,
                    background: 'rgba(15, 23, 42, 0.8)',
                    borderRadius: 6,
                    padding: '2px 8px',
                    fontSize: 10,
                    color: '#FFD700',
                    fontWeight: 700,
                  }}
                >
                  ✨ HIGGSFIELD CINEMA 4K TRAILER
                </div>
              </div>

              {/* Territory Blessing */}
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.65)',
                  border: `1.5px solid ${territory.atmosphere.primaryColor}`,
                  borderRadius: 10,
                  padding: '10px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>🌟</span>
                  <strong style={{ color: territory.atmosphere.primaryColor, fontSize: 13 }}>
                    ACTIVE REALM BLESSING: {territory.blessingName.toUpperCase()}
                  </strong>
                </div>
                <p style={{ fontSize: 11.5, color: '#F1F5F9', margin: '4px 0 0' }}>
                  {territory.blessingEffect}
                </p>
              </div>

              {/* Story Chapters */}
              <div style={{ background: 'rgba(15, 23, 42, 0.8)', borderRadius: 10, padding: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                <strong style={{ color: '#FFD700', fontSize: 12.5, letterSpacing: 1 }}>
                  📜 MYTHOLOGICAL STORY CHAPTERS
                </strong>
                <div style={{ display: 'flex', gap: 6, margin: '8px 0' }}>
                  {territory.storyBeats.map((beat) => (
                    <button
                      key={beat.chapter}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid',
                        background: activeStoryChapter === beat.chapter ? 'rgba(255,215,0,0.25)' : 'rgba(30,41,59,0.5)',
                        borderColor: activeStoryChapter === beat.chapter ? '#FFD700' : 'rgba(255,255,255,0.1)',
                        color: activeStoryChapter === beat.chapter ? '#FFD700' : '#94A3B8',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                      onClick={() => setActiveStoryChapter(beat.chapter)}
                    >
                      CH. {beat.chapter}
                    </button>
                  ))}
                </div>

                {territory.storyBeats.find((b) => b.chapter === activeStoryChapter) && (
                  <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: 10, borderRadius: 8 }}>
                    <strong style={{ color: '#F8FAFC', fontSize: 13 }}>
                      {territory.storyBeats.find((b) => b.chapter === activeStoryChapter)?.title}
                    </strong>
                    <p style={{ fontSize: 11.5, color: '#CBD5E1', margin: '4px 0 0', lineHeight: 1.5 }}>
                      {territory.storyBeats.find((b) => b.chapter === activeStoryChapter)?.narrative}
                    </p>
                  </div>
                )}
              </div>

              {/* Cultural Heritage & Artifacts */}
              <div style={{ background: 'rgba(15, 23, 42, 0.8)', borderRadius: 10, padding: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                <strong style={{ color: '#00E5FF', fontSize: 12.5, letterSpacing: 1 }}>
                  🏛️ PRE-COLONIAL CULTURAL HERITAGE
                </strong>
                <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                  <div style={{ fontSize: 11.5, color: '#CBD5E1' }}>
                    <strong style={{ color: '#5EEAD4' }}>Traditions:</strong> {territory.culture.traditions}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#CBD5E1' }}>
                    <strong style={{ color: '#FDE68A' }}>Spiritual Beliefs:</strong> {territory.culture.spiritualBeliefs}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#CBD5E1' }}>
                    <strong style={{ color: '#FFD700' }}>Sacred Artifacts:</strong> {territory.culture.sacredArtifacts.join(' · ')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Match Scoreboard Modal (Talaan ng Digmaan) */}
      {showScoreboard ? (
        <div style={modalOverlay} onClick={() => setShowScoreboard(false)}>
          <div style={{ ...modalCard, maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div>
                <strong style={{ fontSize: 18, color: '#FFD700' }}>
                  📊 Talaan ng Digmaan (Match Performance Scoreboard)
                </strong>
                <span style={{ display: 'block', fontSize: 11.5, color: '#94A3B8' }}>
                  Realm: {territory.name.toUpperCase()} · Duration: {formatTime(matchTime)} · Total Kills: {allyKills} - {enemyKills}
                </span>
              </div>
              <button style={closeBtn} onClick={() => setShowScoreboard(false)}>
                ✕
              </button>
            </div>

            {/* Scoreboard Table */}
            <div style={{ marginTop: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid rgba(255,255,255,0.15)', color: '#94A3B8' }}>
                    <th style={{ padding: '6px 8px' }}>CHAMPION</th>
                    <th style={{ padding: '6px 8px' }}>TEAM</th>
                    <th style={{ padding: '6px 8px' }}>LVL</th>
                    <th style={{ padding: '6px 8px' }}>K / D / A</th>
                    <th style={{ padding: '6px 8px' }}>DAMAGE</th>
                    <th style={{ padding: '6px 8px' }}>GOLD</th>
                    <th style={{ padding: '6px 8px' }}>ITEMS</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Player Hero */}
                  <tr style={{ background: 'rgba(0, 229, 255, 0.12)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <td style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 20 }}>{hero.emoji}</span>
                      <div>
                        <strong style={{ color: '#00E5FF' }}>{hero.name} (YOU)</strong>
                        <span style={{ display: 'block', fontSize: 10, color: '#CBD5E1' }}>{hero.title || hero.role}</span>
                      </div>
                    </td>
                    <td style={{ padding: '8px', color: '#FFD700', fontWeight: 700 }}>ANITO</td>
                    <td style={{ padding: '8px', color: '#F1F5F9' }}>{playerLevel}</td>
                    <td style={{ padding: '8px', color: '#34D399', fontWeight: 800 }}>{allyKills} / 0 / 2</td>
                    <td style={{ padding: '8px', color: '#F87171', fontWeight: 700 }}>{allyKills * 850 + 1200}</td>
                    <td style={{ padding: '8px', color: '#FFD700', fontWeight: 800 }}>🪙 {playerGold}</td>
                    <td style={{ padding: '8px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {equippedItems.map((it, idx) => (
                          <span key={idx} title={it.name}>{it.emoji}</span>
                        ))}
                      </div>
                    </td>
                  </tr>

                  {/* Allied Bots */}
                  {teammates.map((tm) => (
                    <tr key={tm.id || tm.name} style={{ background: 'rgba(2, 132, 199, 0.08)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 20 }}>{tm.emoji}</span>
                        <div>
                          <strong style={{ color: '#38BDF8' }}>{tm.name} (AI Ally)</strong>
                          <span style={{ display: 'block', fontSize: 10, color: '#94A3B8' }}>{tm.title || tm.role}</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px', color: '#38BDF8', fontWeight: 700 }}>ANITO</td>
                      <td style={{ padding: '8px', color: '#F1F5F9' }}>{tm.level}</td>
                      <td style={{ padding: '8px', color: '#38BDF8', fontWeight: 700 }}>{tm.kills} / {tm.deaths} / {tm.assists}</td>
                      <td style={{ padding: '8px', color: '#F87171' }}>{tm.damageDealt || (tm.kills * 700 + 800)}</td>
                      <td style={{ padding: '8px', color: '#FFD700', fontWeight: 700 }}>🪙 {tm.gold || 600}</td>
                      <td style={{ padding: '8px' }}>
                        <span title="Talisman Shield">🛡️ 🌾</span>
                      </td>
                    </tr>
                  ))}

                  {/* Enemy Bots */}
                  {enemyBotsData && enemyBotsData.length > 0 ? (
                    enemyBotsData.map((eb) => (
                      <tr key={eb.id || eb.name} style={{ background: 'rgba(239, 68, 68, 0.08)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 20 }}>{eb.emoji}</span>
                          <div>
                            <strong style={{ color: '#F87171' }}>{eb.name} (AI Foe)</strong>
                            <span style={{ display: 'block', fontSize: 10, color: '#94A3B8' }}>{eb.title || eb.role}</span>
                          </div>
                        </td>
                        <td style={{ padding: '8px', color: '#F87171', fontWeight: 700 }}>MALAKAS</td>
                        <td style={{ padding: '8px', color: '#F1F5F9' }}>{eb.level}</td>
                        <td style={{ padding: '8px', color: '#F87171', fontWeight: 700 }}>{eb.kills} / {eb.deaths} / {eb.assists}</td>
                        <td style={{ padding: '8px', color: '#F87171' }}>{eb.damageDealt || (eb.kills * 650 + 750)}</td>
                        <td style={{ padding: '8px', color: '#FFD700', fontWeight: 700 }}>🪙 {eb.gold || 550}</td>
                        <td style={{ padding: '8px' }}>
                          <span title="Talisman Charm">🩸 🪓</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr style={{ background: 'rgba(239, 68, 68, 0.1)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <td style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 20 }}>🌲</span>
                        <div>
                          <strong style={{ color: '#F87171' }}>{foeName} (AI)</strong>
                          <span style={{ display: 'block', fontSize: 10, color: '#CBD5E1' }}>Jungle Behemoth</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px', color: '#F87171', fontWeight: 700 }}>MALAKAS</td>
                      <td style={{ padding: '8px', color: '#F1F5F9' }}>{Math.max(1, playerLevel - 1)}</td>
                      <td style={{ padding: '8px', color: '#F87171', fontWeight: 800 }}>{enemyKills} / {allyKills} / 0</td>
                      <td style={{ padding: '8px', color: '#F87171' }}>{enemyKills * 800 + 500}</td>
                      <td style={{ padding: '8px', color: '#FFD700', fontWeight: 800 }}>🪙 {400 + enemyKills * 300}</td>
                      <td style={{ padding: '8px' }}>
                        <span title="Tabako ng Treant">🚬 🪓</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* Mythological Talisman Shop Modal */}
      {showShop ? (
        <div style={modalOverlay} onClick={() => setShowShop(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <strong style={{ fontSize: 18, color: '#FFD700' }}>
                🪙 Talisman Armory (Gold: {playerGold})
              </strong>
              <button style={closeBtn} onClick={() => setShowShop(false)}>
                ✕
              </button>
            </div>

            {/* Equipped Items Bar in Shop */}
            <div style={{ display: 'flex', gap: 6, margin: '8px 0', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: 11, color: '#94A3B8', alignSelf: 'center', marginRight: 4 }}>Equipped:</span>
              {Array.from({ length: 6 }).map((_, i) => {
                const item = equippedItems[i];
                return (
                  <div
                    key={i}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: 'rgba(15, 23, 42, 0.9)',
                      border: item ? '1px solid #FFD700' : '1px dashed rgba(255,255,255,0.2)',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 16,
                    }}
                    title={item ? item.name : 'Empty Slot'}
                  >
                    {item?.emoji}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'grid', gap: 8, maxHeight: '55vh', overflowY: 'auto' }}>
              {AGIMAT_ITEMS.map((item) => (
                <div key={item.id} style={shopItemRow}>
                  <span style={{ fontSize: 22 }}>{item.emoji}</span>
                  <div style={{ flex: 1, marginLeft: 8 }}>
                    <strong style={{ color: '#F1F5F9', fontSize: 13.5 }}>{item.name}</strong>
                    <div style={{ fontSize: 11.5, color: '#94A3B8' }}>{item.blurb}</div>
                  </div>
                  <button
                    style={{
                      ...buyBtn,
                      opacity: playerGold >= item.cost ? 1 : 0.5,
                    }}
                    onClick={() => {
                      if (playerGold >= item.cost) {
                        onBuyItem?.(item);
                      }
                    }}
                  >
                    🪙 {item.cost}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Progressive Player Profile & Daily Quests Modal (📜) ──────────── */}
      {showProfile ? (
        <div style={modalOverlay} onClick={() => setShowProfile(false)}>
          <div
            style={{
              ...modalCard,
              maxWidth: 720,
              border: '1.5px solid #FFD700',
              boxShadow: '0 0 32px rgba(255, 215, 0, 0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Profile Header */}
            <div style={modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #FFD700, #F59E0B)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 24,
                    boxShadow: '0 0 16px rgba(255, 215, 0, 0.5)',
                  }}
                >
                  {getRankForLevel(playerProfile.accountLevel).badgeEmoji}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 18, color: '#FFD700' }}>
                      {playerProfile.name}
                    </strong>
                    <span style={{ fontSize: 11, background: '#1E293B', color: '#38BDF8', padding: '2px 8px', borderRadius: 12, border: '1px solid #0284C7', fontWeight: 800 }}>
                      LVL {playerProfile.accountLevel}
                    </span>
                  </div>
                  <span style={{ fontSize: 11.5, color: '#94A3B8' }}>
                  </span>
                </div>
              </div>
              <button style={closeBtn} onClick={() => setShowProfile(false)}>
                ✕
              </button>
            </div>

            {/* Account XP Bar */}
            <div style={{ margin: '12px 0 16px', background: 'rgba(15, 23, 42, 0.8)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>
                <span>Account Rank Progression</span>
                <strong style={{ color: '#FFD700' }}>{playerProfile.accountXp} / {playerProfile.accountLevel * 250} XP</strong>
              </div>
              <div style={{ width: '100%', height: 8, background: '#1E293B', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, (playerProfile.accountXp / (playerProfile.accountLevel * 250)) * 100)}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #FFD700, #F59E0B)',
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, borderBottom: '1.5px solid rgba(255,255,255,0.1)', paddingBottom: 8, marginBottom: 12 }}>
              <button
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: profileTab === 'dossier' ? '1px solid #FFD700' : '1px solid transparent',
                  background: profileTab === 'dossier' ? 'rgba(255, 215, 0, 0.15)' : 'transparent',
                  color: profileTab === 'dossier' ? '#FFD700' : '#94A3B8',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
                onClick={() => setProfileTab('dossier')}
              >
                📜 Talaan / Dossier
              </button>
              <button
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: profileTab === 'quests' ? '1px solid #FFD700' : '1px solid transparent',
                  background: profileTab === 'quests' ? 'rgba(255, 215, 0, 0.15)' : 'transparent',
                  color: profileTab === 'quests' ? '#FFD700' : '#94A3B8',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                onClick={() => setProfileTab('quests')}
              >
                🎯 Mga Misyon / Quests
                {playerProfile.dailyQuests.filter((q) => q.progress >= q.target && !q.claimed).length > 0 ? (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} />
                ) : null}
              </button>
              <button
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: profileTab === 'mastery' ? '1px solid #FFD700' : '1px solid transparent',
                  background: profileTab === 'mastery' ? 'rgba(255, 215, 0, 0.15)' : 'transparent',
                  color: profileTab === 'mastery' ? '#FFD700' : '#94A3B8',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
                onClick={() => setProfileTab('mastery')}
              >
                ⚡ Kasanayan / Mastery
              </button>
            </div>

            {/* Tab 1: Dossier */}
            {profileTab === 'dossier' ? (
              <div style={{ display: 'grid', gap: 12, maxHeight: '52vh', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>TOTAL MATCHES</div>
                    <strong style={{ fontSize: 16, color: '#F1F5F9' }}>{playerProfile.totalMatches}</strong>
                  </div>
                  <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>WIN RATE</div>
                    <strong style={{ fontSize: 16, color: '#34D399' }}>
                      {playerProfile.totalMatches > 0 ? Math.round((playerProfile.totalWins / playerProfile.totalMatches) * 100) : 0}%
                    </strong>
                  </div>
                  <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>TOTAL KILLS</div>
                    <strong style={{ fontSize: 16, color: '#F87171' }}>{playerProfile.totalKills}</strong>
                  </div>
                  <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>MVP MEDALS</div>
                    <strong style={{ fontSize: 16, color: '#FFD700' }}>
                      {Object.values(playerProfile.heroMasteries).reduce((acc, m) => acc + (m.mvpCount || 0), 0)}
                    </strong>
                  </div>
                </div>

                {/* Match History */}
                <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <strong style={{ fontSize: 12, color: '#00E5FF', letterSpacing: 1 }}>
                    ⚔ RECENT MATCH HISTORY (KASAYSAYAN NG DIGMAAN)
                  </strong>
                  {playerProfile.matchHistory.length === 0 ? (
                    <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 8, textAlign: 'center', padding: '16px 0' }}>
                      Wala pang naitalang laban. Tapusin ang iyong unang laban upang maitala ang kasaysayan!
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                      {playerProfile.matchHistory.slice(0, 5).map((m) => (
                        <div
                          key={m.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            borderRadius: 6,
                            background: m.outcome === 'victory' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            borderLeft: m.outcome === 'victory' ? '3px solid #10B981' : '3px solid #EF4444',
                            fontSize: 11.5,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong style={{ color: m.outcome === 'victory' ? '#34D399' : '#F87171' }}>
                              {m.outcome === 'victory' ? 'VICTORY' : 'DEFEAT'}
                            </strong>
                            <span style={{ color: '#CBD5E1' }}>{m.heroId.toUpperCase()}</span>
                          </div>
                          <div style={{ color: '#94A3B8' }}>
                            {m.kills}/{m.deaths}/{m.assists} · {Math.round(m.durationSeconds)}s
                          </div>
                          <div style={{ color: '#FFD700', fontWeight: 700 }}>
                            +{m.goldEarned}g · +{m.accountXpEarned}xp
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Tab 2: Quests */}
            {profileTab === 'quests' ? (
              <div style={{ display: 'grid', gap: 8, maxHeight: '52vh', overflowY: 'auto' }}>
                {playerProfile.dailyQuests.map((quest) => {
                  const isReady = quest.progress >= quest.target && !quest.claimed;
                  return (
                    <div
                      key={quest.id}
                      style={{
                        background: 'rgba(30, 41, 59, 0.65)',
                        border: isReady ? '1.5px solid #FFD700' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10,
                        padding: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{quest.icon || '🎯'}</span>
                          <strong style={{ fontSize: 13, color: '#F8FAFC' }}>{quest.title}</strong>
                        </div>
                        <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 6px' }}>{quest.description}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: '#1E293B', borderRadius: 3, overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, (quest.progress / quest.target) * 100)}%`,
                                height: '100%',
                                background: isReady ? '#10B981' : '#00E5FF',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 10.5, color: '#CBD5E1', fontWeight: 700 }}>
                            {quest.progress}/{quest.target}
                          </span>
                        </div>
                      </div>

                      <div>
                        {quest.claimed ? (
                          <span style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>✓ NATANGGAP</span>
                        ) : (
                          <button
                            style={{
                              padding: '6px 14px',
                              borderRadius: 8,
                              background: isReady ? 'linear-gradient(135deg, #FFD700, #F59E0B)' : '#334155',
                              color: isReady ? '#0F172A' : '#94A3B8',
                              fontWeight: 800,
                              fontSize: 11,
                              border: 'none',
                              cursor: isReady ? 'pointer' : 'default',
                              boxShadow: isReady ? '0 0 12px rgba(255, 215, 0, 0.4)' : 'none',
                            }}
                            disabled={!isReady}
                            onClick={() => {
                              if (isReady) {
                                const res = claimQuest(quest.id);
                                if (res.success) {
                                  setPlayerProfile({ ...res.profile });
                                  sound.playPing('select');
                                  haptics.tick();
                                }
                              }
                            }}
                          >
                            🪙 +{quest.rewardGold} | XP +{quest.rewardXp}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* Tab 3: Mastery */}
            {profileTab === 'mastery' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, maxHeight: '52vh', overflowY: 'auto' }}>
                {Object.values(playerProfile.heroMasteries).map((mastery) => (
                  <div
                    key={mastery.heroId}
                    style={{
                      background: 'rgba(30, 41, 59, 0.65)',
                      border: mastery.masteryLevel >= 5 ? '1.5px solid #FFD700' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: 13, color: '#F1F5F9' }}>{mastery.heroId.toUpperCase()}</strong>
                      <span style={{ fontSize: 10, background: '#0284C7', color: '#FFF', padding: '1px 6px', borderRadius: 8, fontWeight: 800 }}>
                        Lvl {mastery.masteryLevel}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: '#FFD700', margin: '2px 0 6px' }}>
                      {mastery.masteryLevel >= 7 ? 'Legend of the Isles' : mastery.masteryLevel >= 4 ? 'Veteran' : 'Baguhan'}
                    </div>
                    <div style={{ width: '100%', height: 5, background: '#1E293B', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, (mastery.masteryXp / (mastery.masteryLevel * 500)) * 100)}%`,
                          height: '100%',
                          background: '#FFD700',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#94A3B8', marginTop: 4 }}>
                      <span>{mastery.matchesPlayed} matches · {mastery.wins} wins</span>
                      <span>{mastery.masteryXp}/{mastery.masteryLevel * 500} XP</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}


      {/* Settings Modal */}
      {showSettings ? (
        <div style={modalOverlay} onClick={() => setShowSettings(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <strong style={{ fontSize: 18, color: '#F1F5F9' }}>⚙ Mobile & Match Settings</strong>
              <button style={closeBtn} onClick={() => setShowSettings(false)}>
                ✕
              </button>
            </div>
            <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
              <div style={settingRow}>
                <span>Procedural Audio SFX</span>
                <button
                  style={{
                    ...zoomBtn,
                    width: 'auto',
                    padding: '4px 12px',
                    background: isAudioMuted ? '#991B1B' : '#10B981',
                  }}
                  onClick={() => {
                    const next = !isAudioMuted;
                    setIsAudioMuted(next);
                    sound.setMuted(next);
                    if (!next) sound.playPing('test');
                  }}
                >
                  {isAudioMuted ? '🔇 Muted' : '🔊 Sound ON'}
                </button>
              </div>
              <div style={settingRow}>
                <span>Haptic Feedback (Vibration)</span>
                <button
                  style={{
                    ...zoomBtn,
                    width: 'auto',
                    padding: '4px 12px',
                    background: isHapticsOn ? '#10B981' : '#991B1B',
                  }}
                  onClick={() => {
                    const next = !isHapticsOn;
                    setIsHapticsOn(next);
                    haptics.setEnabled(next);
                    if (next) haptics.tick();
                    updateSettings({ hapticsEnabled: next });
                  }}
                >
                  {isHapticsOn ? '📳 Haptics ON' : '📴 Haptics OFF'}
                </button>
              </div>
              <div style={settingRow}>
                <span>Graphics & Battery Quality</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['performance', 'balanced', 'ultra'] as const).map((q) => (
                    <button
                      key={q}
                      style={{
                        ...zoomBtn,
                        width: 'auto',
                        padding: '4px 10px',
                        background: graphicsQuality === q ? '#0284C7' : 'rgba(255,255,255,0.1)',
                        borderColor: graphicsQuality === q ? '#38BDF8' : 'rgba(255,255,255,0.2)',
                        color: graphicsQuality === q ? '#FFF' : '#94A3B8',
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                      onClick={() => {
                        setGraphicsQuality(q);
                        onQualityChange?.(q);
                        updateSettings({ graphicsQuality: q });
                        sound.playPing('select');
                      }}
                    >
                      {q === 'performance' ? '⚡ 60fps' : q === 'balanced' ? '⚖ Balanced' : '✨ Ultra'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={settingRow}>
                <span>Mobile HUD Scale</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['compact', 'normal', 'large'] as const).map((s) => (
                    <button
                      key={s}
                      style={{
                        ...zoomBtn,
                        width: 'auto',
                        padding: '4px 10px',
                        background: hudScale === s ? '#D97706' : 'rgba(255,255,255,0.1)',
                        borderColor: hudScale === s ? '#FDE68A' : 'rgba(255,255,255,0.2)',
                        color: hudScale === s ? '#FFF' : '#94A3B8',
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                      onClick={() => {
                        setHudScale(s);
                        updateSettings({ hudScale: s });
                        sound.playPing('select');
                      }}
                    >
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div style={settingRow}>
                <span>Auto-Aim Priority (Quick-Tap)</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['lowest_hp', 'closest'] as const).map((p) => (
                    <button
                      key={p}
                      style={{
                        ...zoomBtn,
                        width: 'auto',
                        padding: '4px 10px',
                        background: autoAimPriority === p ? '#0284C7' : 'rgba(255,255,255,0.1)',
                        borderColor: autoAimPriority === p ? '#38BDF8' : 'rgba(255,255,255,0.2)',
                        color: autoAimPriority === p ? '#FFF' : '#94A3B8',
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                      onClick={() => {
                        setAutoAimPriority(p);
                        updateSettings({ autoAimPriority: p });
                        sound.playPing('select');
                      }}
                    >
                      {p === 'lowest_hp' ? '🎯 Lowest HP %' : '📍 Closest Enemy'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={settingRow}>
                <span>Display Refresh Rate (FPS)</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([60, 90, 120, 30] as const).map((target) => (
                    <button
                      key={target}
                      style={{
                        ...zoomBtn,
                        width: 'auto',
                        padding: '4px 8px',
                        background: fpsTarget === target ? '#10B981' : 'rgba(255,255,255,0.1)',
                        borderColor: fpsTarget === target ? '#6EE7B7' : 'rgba(255,255,255,0.2)',
                        color: fpsTarget === target ? '#FFF' : '#94A3B8',
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                      onClick={() => {
                        setFpsTarget(target);
                        updateSettings({ fpsTarget: target });
                        sound.playPing('select');
                      }}
                    >
                      {target === 30 ? '🔋 30 (Saver)' : `${target} Hz`}
                    </button>
                  ))}
                </div>
              </div>
              <div style={settingRow}>
                <span>Gamepad Controller</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: gamepadConnected ? '#10B981' : '#94A3B8', fontWeight: 700 }}>
                    {gamepadConnected ? `🎮 ${gamepadName || 'Connected'}` : '🎮 No Controller'}
                  </span>
                </div>
              </div>
              <div style={settingRow}>
                <span>Immersive Fullscreen</span>
                <button
                  style={{
                    ...zoomBtn,
                    width: 'auto',
                    padding: '4px 12px',
                    background: isFullscreen ? '#0284C7' : '#334155',
                  }}
                  onClick={handleToggleFullscreen}
                >
                  {isFullscreen ? '⛶ Fullscreen ON' : '⛶ Enter Fullscreen'}
                </button>
              </div>
              <div style={settingRow}>
                <span>Virtual Joystick Mode</span>
                <button
                  style={{
                    ...zoomBtn,
                    width: 'auto',
                    padding: '4px 12px',
                    background: joystickMode === 'dynamic' ? '#0284C7' : '#334155',
                  }}
                  onClick={() => {
                    const next = joystickMode === 'fixed' ? 'dynamic' : 'fixed';
                    setJoystickMode(next);
                    updateSettings({ joystickMode: next });
                    sound.playPing('select');
                  }}
                >
                  {joystickMode === 'fixed' ? '🕹 Fixed Anchor' : '🕹 Dynamic Touch'}
                </button>
              </div>
              <div style={settingRow}>
                <span>Progressive Web App (PWA)</span>
                <button
                  style={{
                    ...zoomBtn,
                    width: 'auto',
                    padding: '6px 14px',
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    border: '1.5px solid #6EE7B7',
                    color: '#FFF',
                    fontWeight: 800,
                  }}
                  onClick={handleInstallApp}
                >
                  📱 I-install sa Android
                </button>
              </div>
              <div style={settingRow}>
                <span>Camera Zoom ({zoomShown})</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={zoomBtn} onClick={() => onZoom(0.82)}>
                    +
                  </button>
                  <button style={zoomBtn} onClick={() => onZoom(1.22)}>
                    −
                  </button>
                </div>
              </div>
              <div style={settingRow}>
                <span>Camera Yaw Rotation</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={zoomBtn} onPointerDown={() => onTurn(1)} onPointerUp={() => onTurn(0)}>
                    ↺ Left
                  </button>
                  <button style={zoomBtn} onPointerDown={() => onTurn(-1)} onPointerUp={() => onTurn(0)}>
                    ↻ Right
                  </button>
                </div>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10, display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 11.5, color: '#00E5FF', fontWeight: 700 }}>
                  🎮 Controller / Touch Layout:
                </span>
                <span style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.5 }}>
                  Kaliwang Analog/Thumb: Galaw · Kanang Analog/Touch Drag: Aim Skillshot · [A/J]: Attack · [B/M]: Creep · [X/Q]: Skill 1 · [Y/W]: Skill 2 · [L1/E]: Skill 3 · [R1/R]: Ultimate · [L2/D]: Potion · [R2/F]: Flicker.
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* iOS Safari / Web Install Guide Modal */}
      {showIosInstallGuide ? (
        <div style={modalOverlay} onClick={() => setShowIosInstallGuide(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <strong style={{ fontSize: 18, color: '#FFD700' }}>📱 I-install ang Talisman</strong>
              <button style={closeBtn} onClick={() => setShowIosInstallGuide(false)}>
                ✕
              </button>
            </div>
            <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
              <div style={{ background: 'rgba(30, 41, 59, 0.7)', borderRadius: 10, padding: 14, border: '1px solid rgba(255, 215, 0, 0.3)' }}>
                <strong style={{ color: '#00E5FF', fontSize: 14 }}>Para sa iOS (Safari):</strong>
                <ol style={{ fontSize: 12.5, color: '#CBD5E1', paddingLeft: 20, marginTop: 6, lineHeight: 1.6 }}>
                  <li>Pindutin ang <strong>Share button (⎋ / 🔲⬆)</strong> sa ibaba ng browser.</li>
                  <li>Mag-scroll pababa at piliin ang <strong>&ldquo;Add to Home Screen&rdquo; (➕ Idagdag sa Home Screen)</strong>.</li>
                  <li>Pindutin ang <strong>&ldquo;Add&rdquo;</strong> para magkaroon ng standalone fullscreen App icon!</li>
                </ol>
              </div>
              <div style={{ background: 'rgba(30, 41, 59, 0.7)', borderRadius: 10, padding: 14, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <strong style={{ color: '#10B981', fontSize: 14 }}>Para sa Android (Chrome) / PC:</strong>
                <p style={{ fontSize: 12.5, color: '#CBD5E1', marginTop: 4, lineHeight: 1.5 }}>
                  Pindutin ang <strong>&ldquo;Install App&rdquo;</strong> banner o ang tatlong tuldok (⋮) sa browser menu at piliin ang <strong>Install Talisman</strong> para sa offline 60fps gaming!
                </p>
              </div>
              <button
                style={{
                  background: 'linear-gradient(135deg, #D97706, #B45309)',
                  border: '1.5px solid #FDE68A',
                  color: '#FFF',
                  padding: '10px',
                  borderRadius: 10,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
                onClick={() => setShowIosInstallGuide(false)}
              >
                Naiintindihan ko! Maglaro na ⚔️
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Roster Switcher Modal */}
      {showRoster ? (
        <div style={modalOverlay} onClick={() => setShowRoster(false)}>
          <div style={{ ...modalCard, maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div>
                <strong style={{ fontSize: 18, color: '#FFD700', letterSpacing: 0.5 }}>
                  ⚔️ Mythic Hero Roster
                </strong>
                <span style={{ display: 'block', fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>
                  Switch champion in practice match or return to the main lobby.
                </span>
              </div>
              <button style={closeBtn} onClick={() => setShowRoster(false)}>
                ✕
              </button>
            </div>

            {/* Prominent Return to Lobby Button */}
            <a
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.4), rgba(3, 105, 161, 0.5))',
                border: '1.5px solid #38BDF8',
                borderRadius: 12,
                padding: '10px 16px',
                color: '#FFF',
                fontWeight: 800,
                fontSize: 13,
                textDecoration: 'none',
                marginBottom: 14,
                boxShadow: '0 4px 14px rgba(56, 189, 248, 0.3)',
                transition: 'transform 100ms ease',
              }}
            >
              <span style={{ fontSize: 16 }}>🏠</span>
              <span>Exit Match to Champion Selection Lobby</span>
            </a>

            {/* Hero Selection Grid */}
            <div style={rosterGrid}>
              {playable.map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    onPick(h);
                    setShowRoster(false);
                    sound.playPing('select');
                    haptics.tick();
                  }}
                  style={{
                    ...rosterPickBtn,
                    borderColor: h.id === hero.id ? '#FFD700' : 'rgba(255,255,255,0.18)',
                    background: h.id === hero.id ? 'rgba(255,215,0,0.22)' : 'rgba(15,23,42,0.65)',
                    boxShadow: h.id === hero.id ? '0 0 16px rgba(255, 215, 0, 0.4)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    padding: '8px 4px',
                  }}
                >
                  <span style={{ fontSize: 26 }}>{h.emoji}</span>
                  <strong style={{ fontSize: 12.5, color: '#FFF' }}>{h.name}</strong>
                  <span style={{ fontSize: 9.5, color: '#38BDF8', fontWeight: 700 }}>
                    {h.role.toUpperCase()}
                  </span>
                  {h.id === hero.id ? (
                    <span style={{ fontSize: 8.5, background: '#FFD700', color: '#0F172A', fontWeight: 900, padding: '1px 5px', borderRadius: 4, marginTop: 2 }}>
                      ACTIVE
                    </span>
                  ) : (
                    <span style={{ fontSize: 8.5, background: 'rgba(255,255,255,0.1)', color: '#CBD5E1', fontWeight: 700, padding: '1px 5px', borderRadius: 4, marginTop: 2 }}>
                      PICK
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Battle Spell Switcher Modal */}
      {showBattleSpells ? (
        <div style={modalOverlay} onClick={() => setShowBattleSpells(false)}>
          <div style={{ ...modalCard, maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div>
                <strong style={{ fontSize: 18, color: '#FFD700', letterSpacing: 0.5 }}>
                  ⚡ Mga Orasyon ng Pakikipaglaban (Battle Spells)
                </strong>
                <span style={{ display: 'block', fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>
                  Equip ancestral summoner spell to turn the tide of combat.
                </span>
              </div>
              <button style={closeBtn} onClick={() => setShowBattleSpells(false)}>
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {BATTLE_SPELLS.map((spell) => {
                const isActive = spell.id === battleSpell;
                return (
                  <div
                    key={spell.id}
                    onClick={() => {
                      onSelectBattleSpell?.(spell.id);
                      setShowBattleSpells(false);
                      sound.playPing('select');
                      haptics.tick();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: isActive ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.65)',
                      border: isActive ? '1.5px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.12)',
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: isActive ? 'rgba(56, 189, 248, 0.3)' : 'rgba(30, 41, 59, 0.8)',
                        border: isActive ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.1)',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 22,
                        flexShrink: 0,
                      }}
                    >
                      {spell.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: 13.5, color: '#F8FAFC' }}>
                          {spell.name} ({spell.tagalogName})
                        </strong>
                        <span style={{ fontSize: 10, color: '#FFD700', fontWeight: 800 }}>
                          ⏱ {spell.cooldown}s CD
                        </span>
                      </div>
                      <p style={{ margin: '3px 0 0', fontSize: 11, color: '#94A3B8', lineHeight: 1.35 }}>
                        {spell.description}
                      </p>
                    </div>
                    <div>
                      {isActive ? (
                        <span style={{ fontSize: 10, fontWeight: 900, color: '#38BDF8', background: 'rgba(56, 189, 248, 0.2)', padding: '4px 10px', borderRadius: 999, border: '1px solid #38BDF8' }}>
                          EQUIPPED
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#CBD5E1', background: 'rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: 999 }}>
                          EQUIP
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* Ancestral Warcalls & Tactical Pings Modal */}
      {showBattlePings ? (
        <div style={modalOverlay} onClick={() => setShowBattlePings(false)}>
          <div style={{ ...modalCard, maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div>
                <strong style={{ fontSize: 18, color: '#EF4444', letterSpacing: 0.5 }}>
                  📢 Mga Panawagan sa Labanan (Ancestral Warcalls)
                </strong>
                <span style={{ display: 'block', fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>
                  Broadcast strategic commands to all allied heroes on the battlefield.
                </span>
              </div>
              <button style={closeBtn} onClick={() => setShowBattlePings(false)}>
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                onClick={() => triggerWarCall('sulong')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1.5px solid rgba(239, 68, 68, 0.6)',
                  color: '#F8FAFC',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 24 }}>⚔️</span>
                <div>
                  <strong style={{ display: 'block', fontSize: 13, color: '#EF4444' }}>SULONG! (Attack)</strong>
                  <span style={{ fontSize: 10.5, color: '#94A3B8' }}>Push the lane & strike enemy</span>
                </div>
              </button>

              <button
                onClick={() => triggerWarCall('iwas')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1.5px solid rgba(245, 158, 11, 0.6)',
                  color: '#F8FAFC',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 24 }}>⚠️</span>
                <div>
                  <strong style={{ display: 'block', fontSize: 13, color: '#F59E0B' }}>IWAS! (Danger)</strong>
                  <span style={{ fontSize: 10.5, color: '#94A3B8' }}>Watch out for ambush</span>
                </div>
              </button>

              <button
                onClick={() => triggerWarCall('tabi')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1.5px solid rgba(16, 185, 129, 0.6)',
                  color: '#F8FAFC',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 24 }}>🌿</span>
                <div>
                  <strong style={{ display: 'block', fontSize: 13, color: '#10B981' }}>TABI! (Stealth)</strong>
                  <span style={{ fontSize: 10.5, color: '#94A3B8' }}>Hide in brush & regroup</span>
                </div>
              </button>

              <button
                onClick={() => triggerWarCall('tulong')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1.5px solid rgba(56, 189, 248, 0.6)',
                  color: '#F8FAFC',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 24 }}>🛡️</span>
                <div>
                  <strong style={{ display: 'block', fontSize: 13, color: '#38BDF8' }}>TULONG! (Defend)</strong>
                  <span style={{ fontSize: 10.5, color: '#94A3B8' }}>Protect tower & allies</span>
                </div>
              </button>

              <button
                onClick={() => triggerWarCall('chime')}
                style={{
                  gridColumn: '1 / -1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(168, 85, 247, 0.15)',
                  border: '1.5px solid rgba(168, 85, 247, 0.6)',
                  color: '#F8FAFC',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 24 }}>🎶</span>
                <div>
                  <strong style={{ display: 'block', fontSize: 13, color: '#C084FC' }}>KULINTANG (Blessing)</strong>
                  <span style={{ fontSize: 10.5, color: '#94A3B8' }}>Rouse spirit and inspire ancient bravery</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Enhanced Progressive Victory & Defeat End-of-Match Screen ─────── */}
      {won || defeated ? (
        <div style={victoryVeil}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.95)',
              border: won ? '2px solid #FFD700' : '2px solid #EF4444',
              boxShadow: won ? '0 0 50px rgba(255, 215, 0, 0.5)' : '0 0 50px rgba(239, 68, 68, 0.5)',
              borderRadius: 16,
              padding: '24px 32px',
              maxWidth: 620,
              width: '92%',
              textAlign: 'center',
              backdropFilter: 'blur(16px)',
              pointerEvents: 'auto',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 4 }}>
              {won ? '🏆' : '💀'}
            </div>
            <strong
              style={{
                display: 'block',
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: 2,
                color: won ? '#FFD700' : '#EF4444',
                textShadow: won ? '0 0 20px rgba(255, 215, 0, 0.6)' : '0 0 20px rgba(239, 68, 68, 0.6)',
              }}
            >
              {won ? 'VICTORY' : 'DEFEAT'}
            </strong>
            <span
              style={{
                display: 'block',
                fontSize: 13,
                color: '#CBD5E1',
                marginTop: 6,
                lineHeight: 1.5,
              }}
            >
              {won
                ? `The ${TEAMS.dusk.name} core has been shattered in ${territory.name}. Light returns to the archipelago!`
                : `The ${TEAMS.dawn.name} sanctuary has fallen. Reorganize your forces and rise again!`}
            </span>

            {/* MVP Champion Badge */}
            <div
              style={{
                margin: '14px 0',
                padding: '10px 16px',
                background: won ? 'rgba(255, 215, 0, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                borderRadius: 10,
                border: won ? '1px solid #FFD700' : '1px solid #EF4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 24 }}>🎖️</span>
              <div style={{ textAlign: 'left' }}>
                <strong style={{ fontSize: 13, color: won ? '#FFD700' : '#FCA5A5' }}>
                  MVP: {hero.name.toUpperCase()} (Pinakamahusay na Spear)
                </strong>
                <span style={{ display: 'block', fontSize: 11, color: '#CBD5E1' }}>
                  Score: {allyKills} Kills · Level {playerLevel} · {formatTime(matchTime)} Match Duration
                </span>
              </div>
            </div>

            {/* Progressive Rewards Breakdown */}
            {matchReward ? (
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.7)',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 16,
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  textAlign: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>ACCOUNT XP</div>
                  <strong style={{ fontSize: 15, color: '#38BDF8' }}>+{matchReward.accountXpEarned} XP</strong>
                  {matchReward.leveledUpAccount ? (
                    <div style={{ fontSize: 9.5, color: '#FFD700', fontWeight: 800 }}>⚡ LEVEL UP! (Lvl {matchReward.newAccountLevel})</div>
                  ) : null}
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>HERO MASTERY</div>
                  <strong style={{ fontSize: 15, color: '#A855F7' }}>+{matchReward.masteryXpEarned} XP</strong>
                  {matchReward.leveledUpHero ? (
                    <div style={{ fontSize: 9.5, color: '#FFD700', fontWeight: 800 }}>⚡ MASTERY UP! (Lvl {matchReward.newHeroMasteryLevel})</div>
                  ) : null}
                </div>

                <div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>GOLD EARNED</div>
                  <strong style={{ fontSize: 15, color: '#FFD700' }}>+{matchReward.goldEarned} 🪙</strong>
                </div>
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 14 }}>
              <button
                style={victoryBtn}
                onClick={() => window.location.reload()}
              >
                ⚔️ LUMABAN MULI / PLAY AGAIN
              </button>
              <button
                style={{
                  ...victoryBtn,
                  background: 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#F1F5F9',
                }}
                onClick={() => {
                  window.location.href = '/';
                }}
              >
                🏛️ LOBBY / HERO SELECTION
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// CSS IN JS STYLING (GLASSMORPHISM & P08 MOBILE/PC MOBA CONTROLS)
// ══════════════════════════════════════════════════════════════════════════════

const hudRoot: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  userSelect: 'none',
  overflow: 'hidden',
};

// ── 1. Mini-Map & Utility Menu ───────────────────────────────────────────────
const minimapContainer: React.CSSProperties = {
  position: 'absolute',
  top: 'max(8px, env(safe-area-inset-top))',
  left: 'max(10px, env(safe-area-inset-left))',
  width: 'clamp(95px, 14vw, 115px)',
  height: 'clamp(95px, 14vw, 115px)',
  borderRadius: 12,
  border: '2px solid rgba(255, 255, 255, 0.2)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.65)',
  overflow: 'hidden',
  background: 'rgba(11, 19, 32, 0.88)',
  backdropFilter: 'blur(12px)',
  pointerEvents: 'auto',
  zIndex: 10,
};

const minimapSvg: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'block',
};

const minimapCompass: React.CSSProperties = {
  position: 'absolute',
  top: 4,
  right: 4,
  width: 18,
  height: 18,
  borderRadius: '50%',
  background: 'rgba(15, 23, 42, 0.85)',
  border: '1px solid rgba(255, 215, 0, 0.5)',
  display: 'grid',
  placeItems: 'center',
};

const utilityMenuStack: React.CSSProperties = {
  position: 'absolute',
  top: 'clamp(108px, 15vw, 128px)',
  left: 'max(10px, env(safe-area-inset-left))',
  display: 'flex',
  gap: 4,
  pointerEvents: 'auto',
  zIndex: 10,
};

const utilityBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: '50%',
  border: '1px solid rgba(255, 255, 255, 0.25)',
  background: 'rgba(15, 23, 42, 0.85)',
  backdropFilter: 'blur(8px)',
  color: '#F8FAFC',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  transition: 'transform 100ms ease, background 100ms ease',
};

const utilityIcon: React.CSSProperties = {
  fontSize: 12,
};

const quickBuyFloatingPill: React.CSSProperties = {
  position: 'absolute',
  top: 'max(8px, env(safe-area-inset-top))',
  left: 'clamp(115px, 16vw, 135px)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))',
  border: '1.5px solid #FFD700',
  boxShadow: '0 0 16px rgba(255, 215, 0, 0.45)',
  borderRadius: 20,
  padding: '4px 10px 4px 6px',
  cursor: 'pointer',
  pointerEvents: 'auto',
  zIndex: 15,
  animation: 'pulseGold 2.5s infinite',
};

const quickBuyTag: React.CSSProperties = {
  fontSize: 8.5,
  background: '#FFD700',
  color: '#0F172A',
  fontWeight: 900,
  padding: '2px 5px',
  borderRadius: 6,
};

const quickBuyToast: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(max(8px, env(safe-area-inset-top)) + 38px)',
  left: 'clamp(115px, 16vw, 135px)',
  padding: '4px 10px',
  borderRadius: 6,
  background: 'rgba(16, 185, 129, 0.92)',
  color: '#FFF',
  fontWeight: 700,
  fontSize: 11,
  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
  zIndex: 20,
  pointerEvents: 'none',
};

// ── 2. Top-Center Match Header & Territory Chip ──────────────────────────────
const topCenterMatchHeader: React.CSSProperties = {
  position: 'absolute',
  top: 'max(6px, env(safe-area-inset-top))',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 3,
  pointerEvents: 'auto',
  zIndex: 20,
};

const scoreBarCapsule: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '4px 12px',
  borderRadius: 999,
  background: 'rgba(15, 23, 42, 0.88)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
};

const scoreAllyCol: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const scoreBlueDot: React.CSSProperties = {
  color: '#00E5FF',
  fontSize: 12,
};

const scoreAllyNum: React.CSSProperties = {
  color: '#00E5FF',
  fontSize: 16,
  fontWeight: 800,
};

const scoreTimerCol: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  borderLeft: '1px solid rgba(255,255,255,0.15)',
  borderRight: '1px solid rgba(255,255,255,0.15)',
  padding: '0 10px',
};

const scoreTimerText: React.CSSProperties = {
  color: '#F8FAFC',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0.5,
};

const fpsText: React.CSSProperties = {
  color: '#94A3B8',
  fontSize: 9,
  fontWeight: 600,
};

const scoreEnemyCol: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const scoreEnemyNum: React.CSSProperties = {
  color: '#FF3B30',
  fontSize: 16,
  fontWeight: 800,
};

const scoreRedDot: React.CSSProperties = {
  color: '#FF3B30',
  fontSize: 12,
};

const scoreDivider: React.CSSProperties = {
  width: 1,
  height: 14,
  background: 'rgba(255, 255, 255, 0.2)',
};

const rosterHeaderBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  background: 'rgba(255, 215, 0, 0.15)',
  border: '1px solid rgba(255, 215, 0, 0.5)',
  borderRadius: 999,
  padding: '3px 8px',
  cursor: 'pointer',
  transition: 'transform 100ms ease, background 100ms ease',
};

const lobbyHeaderBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  background: 'rgba(56, 189, 248, 0.15)',
  border: '1px solid rgba(56, 189, 248, 0.5)',
  borderRadius: 999,
  padding: '3px 8px',
  cursor: 'pointer',
  textDecoration: 'none',
  transition: 'transform 100ms ease, background 100ms ease',
};

const combatEventToast: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(max(6px, env(safe-area-inset-top)) + 38px)',
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(15, 23, 42, 0.88)',
  border: '1px solid rgba(255, 215, 0, 0.4)',
  borderRadius: 999,
  padding: '3px 14px',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
  zIndex: 15,
  pointerEvents: 'none',
};

// ── 3. Top-Right Teammates ──────────────────────────────────────────────────
const topRightScoreboard: React.CSSProperties = {
  position: 'absolute',
  top: 'max(6px, env(safe-area-inset-top))',
  right: 'max(10px, env(safe-area-inset-right))',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 6,
  pointerEvents: 'auto',
  zIndex: 10,
};

const teammatesRow: React.CSSProperties = {
  display: 'flex',
  gap: 4,
};

const teammatePortraitBox: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: 32,
  background: 'rgba(15, 23, 42, 0.75)',
  borderRadius: 6,
  padding: '2px 1px',
  border: '1px solid rgba(255,255,255,0.12)',
};

const teammateAvatarCircle: React.CSSProperties = {
  position: 'relative',
  width: 28,
  height: 28,
  borderRadius: '50%',
  background: 'rgba(30, 41, 59, 0.8)',
  display: 'grid',
  placeItems: 'center',
};

const ultIndicatorJewel: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  right: 0,
  width: 7,
  height: 7,
  borderRadius: '50%',
  border: '1.5px solid #0F172A',
};

const teammateHpTrack: React.CSSProperties = {
  width: '100%',
  height: 3,
  background: 'rgba(0,0,0,0.5)',
  borderRadius: 2,
  marginTop: 2,
  overflow: 'hidden',
};

const teammateHpFill: React.CSSProperties = {
  height: '100%',
  background: '#10B981',
  borderRadius: 2,
};

const teammateManaTrack: React.CSSProperties = {
  width: '100%',
  height: 2,
  background: 'rgba(0,0,0,0.5)',
  borderRadius: 2,
  marginTop: 1,
  overflow: 'hidden',
};

const teammateManaFill: React.CSSProperties = {
  height: '100%',
  background: '#00E5FF',
  borderRadius: 2,
};

// ── 4. Virtual Touch Joystick ───────────────────────────────────────────────
const joystickOuterRing: React.CSSProperties = {
  position: 'absolute',
  bottom: 'max(14px, env(safe-area-inset-bottom))',
  left: 'max(14px, env(safe-area-inset-left))',
  width: 110,
  height: 110,
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(15, 23, 42, 0.45) 0%, rgba(15, 23, 42, 0.85) 100%)',
  border: '2px solid rgba(255, 255, 255, 0.25)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(8px)',
  pointerEvents: 'auto',
  touchAction: 'none',
  display: 'grid',
  placeItems: 'center',
  zIndex: 10,
};

const joystickThumbPad: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: '50%',
  background: 'radial-gradient(circle, #38BDF8 0%, #0284C7 100%)',
  border: '2px solid #E0F2FE',
  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.6)',
  display: 'grid',
  placeItems: 'center',
  pointerEvents: 'none',
  transition: 'transform 40ms ease-out',
};

const thumbPadInnerGlow: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.4)',
};

const joyNotchN: React.CSSProperties = { position: 'absolute', top: 4, color: 'rgba(255,255,255,0.3)', fontSize: 8 };
const joyNotchS: React.CSSProperties = { position: 'absolute', bottom: 4, color: 'rgba(255,255,255,0.3)', fontSize: 8 };
const joyNotchW: React.CSSProperties = { position: 'absolute', left: 4, color: 'rgba(255,255,255,0.3)', fontSize: 8 };
const joyNotchE: React.CSSProperties = { position: 'absolute', right: 4, color: 'rgba(255,255,255,0.3)', fontSize: 8 };

// ── 5. Bottom Center Hero Vitals & Quick Spells ─────────────────────────────
const bottomCenterVitalsContainer: React.CSSProperties = {
  position: 'absolute',
  bottom: 'max(10px, env(safe-area-inset-bottom))',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  pointerEvents: 'none',
  zIndex: 12,
};

const thumbVitals: React.CSSProperties = {
  width: 190,
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  padding: '4px 8px 5px',
  borderRadius: 8,
  background: 'rgba(8, 15, 26, 0.8)',
  border: '1px solid rgba(148, 178, 209, 0.3)',
  backdropFilter: 'blur(6px)',
  pointerEvents: 'none',
};

const thumbVitalsHead: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const thumbLevelBadge: React.CSSProperties = {
  minWidth: 16,
  height: 16,
  padding: '0 3px',
  borderRadius: 4,
  background: '#FFD700',
  color: '#111827',
  fontSize: 10,
  fontWeight: 900,
  display: 'grid',
  placeItems: 'center',
};

const thumbHeroName: React.CSSProperties = {
  flex: 1,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.05em',
  color: '#DDE8F3',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const thumbHpNumbers: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#9FB6CB',
  fontVariantNumeric: 'tabular-nums',
};

const thumbHpTrack: React.CSSProperties = {
  height: 7,
  borderRadius: 4,
  background: 'rgba(2, 8, 16, 0.85)',
  border: '1px solid rgba(120, 150, 180, 0.3)',
  overflow: 'hidden',
};

const thumbHpFill: React.CSSProperties = {
  height: '100%',
  borderRadius: 3,
  transition: 'width 0.18s linear',
};

const quickSpellsRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  pointerEvents: 'auto',
};

const smallSpellBtn: React.CSSProperties = {
  position: 'relative',
  width: 36,
  height: 36,
  borderRadius: '50%',
  background: 'rgba(15, 23, 42, 0.88)',
  border: '1.5px solid #00E5FF',
  color: '#FFF',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
};

const spellCooldownText: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: '50%',
  background: 'rgba(0,0,0,0.75)',
  color: '#FFD700',
  display: 'grid',
  placeItems: 'center',
  fontSize: 11,
  fontWeight: 800,
};

// ── 6. Bottom-Right Action & Ability Arc (iOS MOBA Ergonomic Layout) ────────
const skillClusterContainer: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  right: 0,
  width: 280,
  height: 280,
  pointerEvents: 'none',
  zIndex: 10,
};

const skillPointsAvailableToast: React.CSSProperties = {
  position: 'absolute',
  top: -28,
  right: 30,
  background: 'linear-gradient(135deg, #FFD700, #F59E0B)',
  color: '#0F172A',
  padding: '2px 10px',
  borderRadius: 999,
  fontSize: 9.5,
  fontWeight: 900,
  boxShadow: '0 0 14px rgba(255, 215, 0, 0.7)',
  zIndex: 30,
  animation: 'pulseGold 1.5s infinite',
  pointerEvents: 'none',
};

const skill1Slot: React.CSSProperties = {
  position: 'absolute',
  bottom: 'calc(max(18px, env(safe-area-inset-bottom)) + 44px)',
  right: 'calc(max(20px, env(safe-area-inset-right)) + 135px)',
  width: 48,
  height: 48,
  pointerEvents: 'auto',
};

const skill2Slot: React.CSSProperties = {
  position: 'absolute',
  bottom: 'calc(max(18px, env(safe-area-inset-bottom)) + 94px)',
  right: 'calc(max(20px, env(safe-area-inset-right)) + 115px)',
  width: 48,
  height: 48,
  pointerEvents: 'auto',
};

const skill3Slot: React.CSSProperties = {
  position: 'absolute',
  bottom: 'calc(max(18px, env(safe-area-inset-bottom)) + 130px)',
  right: 'calc(max(20px, env(safe-area-inset-right)) + 65px)',
  width: 48,
  height: 48,
  pointerEvents: 'auto',
};

const ultimateSlot: React.CSSProperties = {
  position: 'absolute',
  bottom: 'calc(max(18px, env(safe-area-inset-bottom)) + 136px)',
  right: 'calc(max(20px, env(safe-area-inset-right)) + 6px)',
  width: 58,
  height: 58,
  pointerEvents: 'auto',
};

const towerTargetBtn: React.CSSProperties = {
  position: 'absolute',
  bottom: 'calc(max(18px, env(safe-area-inset-bottom)) + 78px)',
  right: 'calc(max(20px, env(safe-area-inset-right)) + 8px)',
  width: 36,
  height: 36,
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #1E293B, #0F172A)',
  border: '1.5px solid #38BDF8',
  color: '#38BDF8',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(56, 189, 248, 0.4)',
  zIndex: 10,
  pointerEvents: 'auto',
};

const creepTargetBtn: React.CSSProperties = {
  position: 'absolute',
  bottom: 'calc(max(18px, env(safe-area-inset-bottom)) + 6px)',
  right: 'calc(max(20px, env(safe-area-inset-right)) + 78px)',
  width: 36,
  height: 36,
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #1E293B, #0F172A)',
  border: '1.5px solid #10B981',
  color: '#10B981',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
  zIndex: 10,
  pointerEvents: 'auto',
};

const mainAttackBtn: React.CSSProperties = {
  position: 'absolute',
  bottom: 'max(18px, env(safe-area-inset-bottom))',
  right: 'max(20px, env(safe-area-inset-right))',
  width: 78,
  height: 78,
  borderRadius: '50%',
  background: 'radial-gradient(circle, #D97706 0%, #78350F 100%)',
  border: '2.5px solid #FDE68A',
  boxShadow: '0 8px 24px rgba(217, 119, 6, 0.65)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  pointerEvents: 'auto',
  zIndex: 10,
};

const abilityCircleBtn: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
  border: '1.5px solid rgba(255, 255, 255, 0.35)',
  boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  pointerEvents: 'auto',
  overflow: 'hidden',
};

const ultimateCircleBtn: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(120, 53, 15, 0.9) 0%, rgba(69, 26, 3, 0.95) 100%)',
  border: '2px solid #FFD700',
  boxShadow: '0 0 20px rgba(255, 215, 0, 0.55)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  pointerEvents: 'auto',
  overflow: 'hidden',
};

const mainAttackKey: React.CSSProperties = {
  position: 'absolute',
  top: 4,
  right: 10,
  fontSize: 9,
  fontWeight: 800,
  color: '#FEF08A',
};

const mainAttackText: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 900,
  color: '#FFF',
  letterSpacing: 0.8,
  marginTop: 1,
};

const hotkeyBadge: React.CSSProperties = {
  position: 'absolute',
  top: 3,
  left: 6,
  fontSize: 9,
  fontWeight: 800,
  color: '#94A3B8',
};

const hotkeyBadgeUlt: React.CSSProperties = {
  position: 'absolute',
  top: 4,
  left: 8,
  fontSize: 10,
  fontWeight: 900,
  color: '#FDE68A',
};

const abilityEmoji: React.CSSProperties = {
  fontSize: 18,
};

const ultimateEmoji: React.CSSProperties = {
  fontSize: 22,
};

const cooldownOverlay: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.75)',
  display: 'grid',
  placeItems: 'center',
  borderRadius: '50%',
};

const cooldownNumber: React.CSSProperties = {
  color: '#FFD700',
  fontSize: 13,
  fontWeight: 900,
};

const skillUpgradePlusBtn: React.CSSProperties = {
  position: 'absolute',
  top: -8,
  right: 6,
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #FFD700, #F59E0B)',
  border: '1.5px solid #FFF',
  color: '#0F172A',
  fontSize: 15,
  fontWeight: 900,
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  boxShadow: '0 0 14px rgba(255, 215, 0, 0.9)',
  zIndex: 35,
  animation: 'pulseGold 1.2s infinite',
  lineHeight: 1,
};

const rankPipsRow: React.CSSProperties = {
  position: 'absolute',
  bottom: -5,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: 2.5,
  zIndex: 25,
};

const rankPip: React.CSSProperties = {
  width: 5,
  height: 2.5,
  borderRadius: 1,
  boxShadow: '0 1px 3px rgba(0,0,0,0.6)',
};

// ── 5. Overhead Floating Health Bars ─────────────────────────────────────────
const overheadContainer: React.CSSProperties = {
  position: 'absolute',
  transform: 'translate(-50%, -100%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: 90,
  pointerEvents: 'none',
  zIndex: 15,
};

const overheadHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  marginBottom: 2,
};

const overheadLevelBadge: React.CSSProperties = {
  width: 15,
  height: 15,
  borderRadius: '50%',
  background: '#D97706',
  border: '1px solid #FDE68A',
  display: 'grid',
  placeItems: 'center',
  fontSize: 9,
  fontWeight: 900,
  color: '#FFF',
};

const overheadHeroName: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: '#F8FAFC',
  textShadow: '0 1px 4px rgba(0,0,0,0.9)',
};

const overheadHiddenTag: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: '#34D399',
  background: 'rgba(0,0,0,0.6)',
  padding: '1px 3px',
  borderRadius: 3,
};

const overheadHpTrack: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: 6.5,
  borderRadius: 3,
  background: 'rgba(15, 23, 42, 0.85)',
  border: '1px solid rgba(0,0,0,0.7)',
  overflow: 'hidden',
};

const overheadHpFill: React.CSSProperties = {
  height: '100%',
  background: 'linear-gradient(90deg, #10B981 0%, #34D399 100%)',
  borderRadius: 2,
  transition: 'width 60ms linear',
};

const overheadSegmentsOverlay: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(0,0,0,0.45) 18px, rgba(0,0,0,0.45) 20px)',
};

const overheadXpTrack: React.CSSProperties = {
  width: '100%',
  height: 3,
  borderRadius: 2,
  background: 'rgba(15, 23, 42, 0.85)',
  border: '1px solid rgba(0,0,0,0.5)',
  marginTop: 1.5,
  overflow: 'hidden',
};

const overheadXpFill: React.CSSProperties = {
  height: '100%',
  background: 'linear-gradient(90deg, #F59E0B 0%, #FBBF24 100%)',
  borderRadius: 2,
  transition: 'width 100ms ease-out',
};

// ── 6. Boss Health Bar & Broadcasts ──────────────────────────────────────────
const bossBarContainer: React.CSSProperties = {
  position: 'absolute',
  top: 15,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 380,
  maxWidth: '90vw',
  background: 'rgba(15, 23, 42, 0.85)',
  border: '1.5px solid #DC2626',
  borderRadius: 8,
  padding: '6px 12px',
  boxShadow: '0 8px 32px rgba(220, 38, 38, 0.4)',
  backdropFilter: 'blur(8px)',
  zIndex: 10,
};

const bossTitleRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 12,
  marginBottom: 4,
};

const bossCrown: React.CSSProperties = {
  color: '#F87171',
  fontWeight: 800,
  fontSize: 10,
};

const bossNameStyle: React.CSSProperties = {
  color: '#FFF',
  fontSize: 13,
};

const bossHpNums: React.CSSProperties = {
  color: '#FCA5A5',
  fontSize: 11,
  fontWeight: 700,
};

const bossBarShell: React.CSSProperties = {
  width: '100%',
  height: 8,
  background: '#450A0A',
  borderRadius: 4,
  overflow: 'hidden',
};

const bossBarFill: React.CSSProperties = {
  height: '100%',
  background: 'linear-gradient(90deg, #DC2626 0%, #EF4444 100%)',
  borderRadius: 4,
  transition: 'width 80ms ease-out',
};

const combatBroadcastBar: React.CSSProperties = {
  position: 'absolute',
  top: 75,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  background: 'rgba(15, 23, 42, 0.65)',
  padding: '4px 16px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.1)',
  backdropFilter: 'blur(6px)',
  zIndex: 10,
  pointerEvents: 'none',
};

const combatLineText: React.CSSProperties = {
  color: '#F8FAFC',
  fontSize: 12,
  fontWeight: 600,
};

const objectiveLineText: React.CSSProperties = {
  color: '#94A3B8',
  fontSize: 10.5,
  fontWeight: 500,
};

const pingToastContainer: React.CSSProperties = {
  position: 'absolute',
  top: 115,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(2, 132, 199, 0.9)',
  color: '#FFF',
  padding: '6px 18px',
  borderRadius: 999,
  fontSize: 12.5,
  fontWeight: 700,
  boxShadow: '0 4px 16px rgba(2, 132, 199, 0.5)',
  zIndex: 20,
};

const activeBuffsBar: React.CSSProperties = {
  position: 'absolute',
  bottom: 120,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: 8,
  zIndex: 10,
};

const buffBadgePill: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 8px',
  borderRadius: 999,
  background: 'rgba(15, 23, 42, 0.85)',
  border: '1px solid #FFD700',
  color: '#FEF08A',
  fontSize: 11,
};

// ── 7. Modals & Popups ──────────────────────────────────────────────────────
const modalOverlay: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.65)',
  backdropFilter: 'blur(6px)',
  display: 'grid',
  placeItems: 'center',
  pointerEvents: 'auto',
  zIndex: 50,
};

const modalCard: React.CSSProperties = {
  width: 440,
  maxWidth: '92vw',
  background: 'rgba(15, 23, 42, 0.95)',
  border: '1.5px solid rgba(255, 215, 0, 0.4)',
  borderRadius: 12,
  padding: 18,
  boxShadow: '0 12px 48px rgba(0,0,0,0.8)',
};

const modalHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  paddingBottom: 10,
};

const closeBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#94A3B8',
  fontSize: 18,
  cursor: 'pointer',
};

const statsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
  marginTop: 12,
};

const statItem: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  background: 'rgba(30, 41, 59, 0.6)',
  padding: '6px 10px',
  borderRadius: 6,
};

const statLabel: React.CSSProperties = {
  fontSize: 10,
  color: '#94A3B8',
};

const statVal: React.CSSProperties = {
  fontSize: 13,
  color: '#F8FAFC',
  fontWeight: 700,
  marginTop: 2,
};

const shopItemRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  background: 'rgba(30, 41, 59, 0.6)',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.06)',
};

const buyBtn: React.CSSProperties = {
  background: '#D97706',
  border: '1px solid #FDE68A',
  color: '#FFF',
  padding: '6px 12px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
};

const settingRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 13,
  color: '#E2E8F0',
};

const zoomBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  background: 'rgba(30, 41, 59, 0.8)',
  border: '1px solid rgba(255,255,255,0.2)',
  color: '#FFF',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 700,
};

const rosterGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
  gap: 10,
  marginTop: 14,
};

const rosterPickBtn: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: 10,
  borderRadius: 8,
  border: '1.5px solid',
  cursor: 'pointer',
  gap: 4,
};

const victoryVeil: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(circle, rgba(15, 23, 42, 0.9) 0%, rgba(0, 0, 0, 0.96) 100%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  zIndex: 100,
  pointerEvents: 'auto',
  padding: 20,
  textAlign: 'center',
};

const victoryTitle: React.CSSProperties = {
  color: '#FFD700',
  fontSize: 32,
  fontWeight: 900,
  letterSpacing: 2,
  textShadow: '0 0 24px rgba(255, 215, 0, 0.8)',
};

const victoryBlurb: React.CSSProperties = {
  color: '#E2E8F0',
  fontSize: 15,
  maxWidth: 500,
  lineHeight: 1.6,
};

const victoryBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
  border: '2px solid #FDE68A',
  color: '#FFF',
  padding: '12px 28px',
  borderRadius: 999,
  fontSize: 16,
  fontWeight: 800,
  cursor: 'pointer',
  boxShadow: '0 8px 24px rgba(217, 119, 6, 0.6)',
};

// ── 8. Minion Wave Ribbon & Warcalls Styling ────────────────────────────────
const minionWaveRibbon: React.CSSProperties = {
  position: 'absolute',
  top: 52,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: 'rgba(15, 23, 42, 0.85)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: 999,
  padding: '4px 14px',
  backdropFilter: 'blur(8px)',
  zIndex: 10,
  pointerEvents: 'none',
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
};

const minionTeamBadgeDawn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const minionTeamBadgeDusk: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const minionCountChip: React.CSSProperties = {
  fontSize: 11,
  color: '#F8FAFC',
  background: 'rgba(255, 255, 255, 0.08)',
  padding: '2px 6px',
  borderRadius: 4,
  fontWeight: 700,
};

const minionWaveDivider: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  color: '#94A3B8',
  padding: '0 4px',
};

const warcallMenuPopup: React.CSSProperties = {
  position: 'absolute',
  top: 205,
  left: 64,
  width: 290,
  background: 'rgba(15, 23, 42, 0.96)',
  border: '1.5px solid rgba(255, 215, 0, 0.5)',
  borderRadius: 12,
  padding: 12,
  backdropFilter: 'blur(12px)',
  boxShadow: '0 12px 36px rgba(0,0,0,0.85)',
  zIndex: 40,
  pointerEvents: 'auto',
};

const warcallHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  paddingBottom: 6,
  marginBottom: 8,
};

const warcallCloseBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#94A3B8',
  fontSize: 14,
  cursor: 'pointer',
};

const warcallActionBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: 'rgba(30, 41, 59, 0.7)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 8,
  padding: '7px 10px',
  color: '#F8FAFC',
  cursor: 'pointer',
  transition: 'background 120ms ease, border-color 120ms ease',
};

const minionCodexCard: React.CSSProperties = {
  background: 'rgba(30, 41, 59, 0.65)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 10,
  padding: 12,
};

const minionCodexAvatar: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 10,
  background: 'rgba(0, 229, 255, 0.15)',
  border: '1.5px solid #00E5FF',
  display: 'grid',
  placeItems: 'center',
};
