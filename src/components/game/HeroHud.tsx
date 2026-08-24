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
// 7. TOP-CENTER: Epic Boss HUD Bar (Bakunawa & Kapre) and Streamlined Combat Log.
// 8. REAL INVENTORY & STAT MODALS: Live Agimat item shop & detailed RPG stat calculations.

import React, { useState, useRef } from 'react';
import { TEAMS, type TeamId } from '@/game/arena/nexus';
import type { CastSlot, CooldownState } from '@/game/combat';
import type { Hero } from '@/game/heroes';
import { CAMPS } from '@/game/arena/camps';
import { AGIMAT_ITEMS, type AgimatItem } from '@/game/items/catalogue';
import type { EffectiveHeroStats } from '@/game/items/inventory';
import type { FloatingTextHudData } from '@/game/render3d/damageNumbers';
import { sound } from '@/game/audio/synth';
import { type Territory, DEFAULT_TERRITORY } from '@/game/territories';

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
  kind?: 'mandirigma' | 'mapanahong' | 'bagani';
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
  cooldowns: CooldownState;
  onCast: (slot: CastSlot) => void;
  onMoveVector?: (dx: number, dz: number) => void;
  keyboardMovingVector?: { x: number; z: number };
  compass: number;
  zoomShown: number;
  onZoom: (factor: number) => void;
  onTurn: (dir: number) => void;
  onPing?: (type: string) => void;
  onBuyItem?: (item: AgimatItem) => void;
  equippedItems?: AgimatItem[];
  effectiveStats?: EffectiveHeroStats;
  floatingTexts?: FloatingTextHudData[];
  activeBuffs?: ActiveBuff[];
  bossName?: string;
  bossHp?: number;
  bossMaxHp?: number;
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
  cooldowns,
  onCast,
  onMoveVector,
  keyboardMovingVector = { x: 0, z: 0 },
  compass,
  zoomShown,
  onZoom,
  onTurn,
  onPing,
  onBuyItem,
  equippedItems = [],
  effectiveStats,
  floatingTexts = [],
  activeBuffs = [],
  bossName,
  bossHp = 0,
  bossMaxHp = 1,
}: HeroHudProps) {
  // ── Modal Dialog States ──────────────────────────────────────────────────
  const [showStats, setShowStats] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showTerritoryCodex, setShowTerritoryCodex] = useState(false);
  const [activeStoryChapter, setActiveStoryChapter] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [showMinionsCodex, setShowMinionsCodex] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showBattlePings, setShowBattlePings] = useState(false);
  const [pingNotification, setPingNotification] = useState<string | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // ── Virtual Joystick State ───────────────────────────────────────────────
  const joystickContainerRef = useRef<HTMLDivElement | null>(null);
  const [thumbPos, setThumbPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const pointerIdRef = useRef<number | null>(null);

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

  const updateJoystickPos = (clientX: number, clientY: number) => {
    if (!joystickContainerRef.current) return;
    const rect = joystickContainerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
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
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    updateJoystickPos(e.clientX, e.clientY);
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
      onMoveVector?.(0, 0);
    }
  };

  // ── Quick Ping & Ancestral Warcall Trigger ────────────────────────────────
  const triggerPing = (type: string, message: string) => {
    sound.playPing(type);
    onPing?.(type);
    setPingNotification(message);
    setTimeout(() => setPingNotification(null), 3000);
  };

  const triggerWarCall = (warCallType: 'sulong' | 'iwas' | 'tabi' | 'tulong' | 'kulintang') => {
    setShowBattlePings(false);
    if (warCallType === 'sulong') {
      sound.playPing('danger');
      setPingNotification('⚔ SULONG! Sugurin ang hanay ng kalaban! [ᜐᜓᜎᜓᜅ᜔]');
      onPing?.('attack');
    } else if (warCallType === 'iwas') {
      sound.playPing('danger');
      setPingNotification('⚠️ MAG-INGAT! Mag-ingat sa gubat at tambang! [ᜋᜄ᜔-ᜁᜅᜆ᜔]');
      onPing?.('retreat');
    } else if (warCallType === 'tabi') {
      sound.playKubingTwang();
      setPingNotification('🌿 TABI-TABI PO! Magtago sa damuhan at maghanda! [ᜆᜊᜒ-ᜆᜊᜒ]');
      onPing?.('stealth');
    } else if (warCallType === 'tulong') {
      sound.playPing('gather');
      setPingNotification('🛡 TULUNGAN! Protektahan ang Moog ng Anito! [ᜆᜓᜎᜓᜅᜈ᜔]');
      onPing?.('assist');
    } else if (warCallType === 'kulintang') {
      sound.playKulintangChime();
      setPingNotification('🎶 KULINTANG NG DIGMAAN: Pinagpala ng mga Diwata ang laban!');
      onPing?.('blessing');
    }
    setTimeout(() => setPingNotification(null), 3500);
  };

  // ── Ability Configurations ───────────────────────────────────────────────
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

  // Teammates list for status indicators
  const teammates = [
    { name: 'Apolaki', emoji: '☀️', hpPct: 92, manaPct: 100, ultReady: true, level: playerLevel },
    { name: 'Mayari', emoji: '🌙', hpPct: 78, manaPct: 85, ultReady: true, level: Math.max(1, playerLevel - 1) },
    { name: 'Bernardo', emoji: '⛰', hpPct: 100, manaPct: 70, ultReady: false, ultCd: 12, level: playerLevel },
    { name: 'Diwata', emoji: '🌿', hpPct: 84, manaPct: 60, ultReady: true, level: Math.max(1, playerLevel - 1) },
  ];

  // Minion divisions breakdown
  const anitoMandirigma = minions.filter((m) => m.team === 'anito' && m.kind === 'mandirigma' && m.health > 0).length;
  const anitoMapanahong = minions.filter((m) => m.team === 'anito' && m.kind === 'mapanahong' && m.health > 0).length;
  const anitoBagani = minions.filter((m) => m.team === 'anito' && m.kind === 'bagani' && m.health > 0).length;
  const malakasMandirigma = minions.filter((m) => m.team === 'malakas' && m.kind === 'mandirigma' && m.health > 0).length;
  const malakasMapanahong = minions.filter((m) => m.team === 'malakas' && m.kind === 'mapanahong' && m.health > 0).length;
  const malakasBagani = minions.filter((m) => m.team === 'malakas' && m.kind === 'bagani' && m.health > 0).length;

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
        <svg style={minimapSvg} viewBox="0 0 180 180">
          {/* Radar Background Grids */}
          <rect width="180" height="180" fill="#0B1320" rx="8" />
          <circle cx="90" cy="90" r="80" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <circle cx="90" cy="90" r="45" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

          {/* Pasig River S-Curve Channel */}
          <path
            d="M 170,10 C 130,50 150,90 90,90 C 30,90 50,130 10,170"
            fill="none"
            stroke="rgba(0, 229, 255, 0.28)"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* 3 MOBA Lanes */}
          {/* Top Lane: Anito -> West -> North -> Malakas */}
          <path
            d="M 22,158 L 22,22 L 158,22"
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="7"
            strokeLinejoin="round"
          />
          {/* Mid Lane: Diagonal Anito -> Malakas */}
          <line
            x1="22"
            y1="158"
            x2="158"
            y2="22"
            stroke="rgba(255, 255, 255, 0.24)"
            strokeWidth="8"
          />
          {/* Bot Lane: Anito -> South -> East -> Malakas */}
          <path
            d="M 22,158 L 158,158 L 158,22"
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="7"
            strokeLinejoin="round"
          />

          {/* Base Sanctuaries */}
          {/* Anito Base (South-West / Bottom-Left) */}
          <circle cx="22" cy="158" r="14" fill="rgba(255, 179, 0, 0.25)" stroke="#FFB300" strokeWidth="2" />
          <text x="22" y="161" fill="#FFB300" fontSize="8" fontWeight="bold" textAnchor="middle">
            ANITO
          </text>

          {/* Malakas Base (North-East / Top-Right) */}
          <circle cx="158" cy="22" r="14" fill="rgba(0, 229, 255, 0.25)" stroke="#00E5FF" strokeWidth="2" />
          <text x="158" y="25" fill="#00E5FF" fontSize="7.5" fontWeight="bold" textAnchor="middle">
            MALAKAS
          </text>

          {/* Towers Radar Icons */}
          {towers.map((t) => {
            const mx = ((t.x + 100) / 200) * 180;
            const my = ((t.z + 100) / 200) * 180;
            const isAnito = t.team === 'anito';
            return (
              <circle
                key={t.id}
                cx={mx}
                cy={my}
                r={t.tier === 3 ? 3.5 : 2.8}
                fill={t.alive ? (isAnito ? '#2980B9' : '#C0392B') : '#475569'}
                stroke={t.alive ? (isAnito ? '#60A5FA' : '#F87171') : '#334155'}
                strokeWidth="1"
              />
            );
          })}

          {/* Jungle Camps & Bosses */}
          {CAMPS.map((c) => {
            const mx = ((c.x + 100) / 200) * 180;
            const my = ((c.z + 100) / 200) * 180;
            const isBakunawa = c.id.includes('bakunawa');
            const isKapre = c.id.includes('kapre');
            return (
              <g key={c.id}>
                <circle
                  cx={mx}
                  cy={my}
                  r={isBakunawa || isKapre ? 4.5 : 2.5}
                  fill={isBakunawa ? '#7852FF' : isKapre ? '#FF7A36' : '#50E3C2'}
                  stroke="#FFFFFF"
                  strokeWidth={isBakunawa || isKapre ? 1.2 : 0.6}
                />
              </g>
            );
          })}

          {/* Live Lane Minions */}
          {minions.map((m) => {
            const mx = ((m.x + 100) / 200) * 180;
            const my = ((m.z + 100) / 200) * 180;
            const isAnito = m.team === 'anito';
            return (
              <circle
                key={m.id}
                cx={mx}
                cy={my}
                r="1.8"
                fill={isAnito ? '#60A5FA' : '#F87171'}
              />
            );
          })}

          {/* Foe / Kapre Indicator */}
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
            <span style={{ color: '#FFC84A', fontSize: 10, fontWeight: 900 }}>N</span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          2. QUICK UTILITY MENU (BELOW MINI-MAP: top: 205px; left: 15px;)
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={utilityMenuStack}>
        <button
          style={{ ...utilityBtn, borderColor: territory.atmosphere.primaryColor }}
          title={`Teritoryo ng Kapuluan (${territory.name}) [🗺️]`}
          onClick={() => setShowTerritoryCodex(!showTerritoryCodex)}
          aria-label="Territory Lore"
        >
          <span style={utilityIcon}>🗺️</span>
        </button>
        <button
          style={utilityBtn}
          title="Hero Info, Lore & Passives [ℹ]"
          onClick={() => setShowStats(!showStats)}
          aria-label="Hero Stats"
        >
          <span style={utilityIcon}>ℹ</span>
        </button>
        <button
          style={{ ...utilityBtn, borderColor: 'rgba(255, 215, 0, 0.6)' }}
          title={`Agimat Shop (🪙 ${playerGold}) [Shop]`}
          onClick={() => setShowShop(!showShop)}
          aria-label="Shop"
        >
          <span style={utilityIcon}>💰</span>
        </button>
        <button
          style={{ ...utilityBtn, borderColor: 'rgba(0, 229, 255, 0.6)' }}
          title="Aklat ng mga Pangkat (Minions Division Codex & Images)"
          onClick={() => setShowMinionsCodex(!showMinionsCodex)}
          aria-label="Pangkat Minions"
        >
          <span style={utilityIcon}>🛡</span>
        </button>
        <button
          style={{ ...utilityBtn, borderColor: 'rgba(239, 68, 68, 0.6)' }}
          title="Mga Sigaw ng Pakikidigma (Ancestral Warcalls & Pings)"
          onClick={() => setShowBattlePings(!showBattlePings)}
          aria-label="Warcalls"
        >
          <span style={utilityIcon}>📢</span>
        </button>
        <button
          style={utilityBtn}
          title="Match Scoreboard & Performance [📊]"
          onClick={() => setShowScoreboard(!showScoreboard)}
          aria-label="Scoreboard"
        >
          <span style={utilityIcon}>📊</span>
        </button>
        <button
          style={utilityBtn}
          title="Game Settings [⚙]"
          onClick={() => setShowSettings(!showSettings)}
          aria-label="Settings"
        >
          <span style={utilityIcon}>⚙</span>
        </button>
      </div>

      {/* TOP-CENTER TERRITORY REALM BADGE */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(15, 23, 42, 0.88)',
          border: `1.5px solid ${territory.atmosphere.primaryColor}`,
          boxShadow: `0 0 16px ${territory.atmosphere.accentGlow}`,
          borderRadius: 999,
          padding: '5px 16px',
          cursor: 'pointer',
          zIndex: 30,
          backdropFilter: 'blur(8px)',
        }}
        onClick={() => setShowTerritoryCodex(true)}
        title="View Realm Story, Culture & Videos"
      >
        <span style={{ fontSize: 13, color: territory.atmosphere.primaryColor, letterSpacing: 2 }}>
          {territory.baybayin}
        </span>
        <strong style={{ fontSize: 12, color: '#FFF', letterSpacing: 1 }}>
          {territory.name.toUpperCase()}
        </strong>
        <span style={{ fontSize: 10.5, color: '#94A3B8' }}>• {territory.atmosphere.weatherEffect}</span>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          3. TOP-RIGHT SCOREBOARD & TEAM STATUS
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={topRightScoreboard}>
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
          <button
            style={rosterToggleBtn}
            onClick={() => setShowRoster(!showRoster)}
            title="Switch Hero / Roster"
            aria-label="Roster"
          >
            👥
          </button>
        </div>

        {/* Teammate Health Portraits (Below Scoreboard) */}
        <div style={teammatesRow}>
          {teammates.map((tm, idx) => (
            <div key={idx} style={teammatePortraitBox} title={`${tm.name} (Lvl ${tm.level})`}>
              <div style={teammateAvatarCircle}>
                <span style={{ fontSize: 18 }}>{tm.emoji}</span>
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
          4. BOTTOM-LEFT VIRTUAL TOUCH JOYSTICK (160x160)
          ══════════════════════════════════════════════════════════════════════ */}
      <div
        ref={joystickContainerRef}
        style={joystickOuterRing}
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
          5. BOTTOM-RIGHT CIRCULAR SKILL CLUSTER
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={skillClusterContainer}>
        {/* Health Potion, Battle Spells & Innate Passive (Row to the left of arc) */}
        <div style={quickSpellsRow}>
          {/* Innate Mythic Passive Badge */}
          {hero.passive && (
            <div
              style={{
                ...smallSpellBtn,
                borderColor: '#00E5FF',
                background: 'rgba(6, 78, 59, 0.8)',
                cursor: 'help',
              }}
              title={`[INNATE PASSIVE] ${hero.passive.name}: ${hero.passive.blurb} (${hero.passive.effect})`}
            >
              <span style={{ ...spellKeyBadge, background: '#0D9488', fontSize: 8 }}>PAS</span>
              <span style={{ fontSize: 18 }}>{hero.passive.emoji}</span>
            </div>
          )}

          {/* Battle Spell / Flicker */}
          <button
            style={{
              ...smallSpellBtn,
              opacity: cooldowns.spell > 0 ? 0.55 : 1,
            }}
            onClick={() => onCast('spell')}
            title="Battle Spell: Flicker (Instant 6.5u Dash) [F]"
          >
            <span style={spellKeyBadge}>F</span>
            <span style={{ fontSize: 18 }}>⚡</span>
            {cooldowns.spell > 0 ? (
              <span style={spellCooldownText}>{Math.ceil(cooldowns.spell)}</span>
            ) : null}
          </button>

          {/* Health Potion / Regen */}
          <button
            style={{
              ...smallSpellBtn,
              borderColor: '#10B981',
              opacity: cooldowns.potion > 0 ? 0.55 : 1,
            }}
            onClick={() => onCast('potion')}
            title="Health Potion / Agimat Regen (+250 HP) [D]"
          >
            <span style={spellKeyBadge}>D</span>
            <span style={{ fontSize: 18 }}>🌿</span>
            {cooldowns.potion > 0 ? (
              <span style={spellCooldownText}>{Math.ceil(cooldowns.potion)}</span>
            ) : null}
          </button>
        </div>

        {/* Skill 1 (Q / Strike) at bottom: 40px; right: 140px; */}
        <button
          style={{
            ...abilityCircleBtn,
            bottom: 40,
            right: 140,
            opacity: cooldowns.ability0 > 0.05 ? 0.55 : 1,
          }}
          onClick={() => onCast('ability0')}
          title={`[Q / 1] ${ability0.name}: ${ability0.blurb}`}
        >
          <span style={hotkeyBadge}>Q</span>
          <span style={abilityEmoji}>{ability0.emoji}</span>
          <span style={abilitySubName}>{ability0.name}</span>
          {cooldowns.ability0 > 0.05 ? (
            <div style={cooldownOverlay}>
              <span style={cooldownNumber}>
                {cooldowns.ability0 >= 10 ? Math.ceil(cooldowns.ability0) : cooldowns.ability0.toFixed(1)}
              </span>
            </div>
          ) : null}
        </button>

        {/* Skill 2 (W / Shield) at bottom: 110px; right: 120px; */}
        <button
          style={{
            ...abilityCircleBtn,
            bottom: 110,
            right: 120,
            opacity: cooldowns.ability1 > 0.05 ? 0.55 : 1,
          }}
          onClick={() => onCast('ability1')}
          title={`[W / 2] ${ability1.name}: ${ability1.blurb}`}
        >
          <span style={hotkeyBadge}>W</span>
          <span style={abilityEmoji}>{ability1.emoji}</span>
          <span style={abilitySubName}>{ability1.name}</span>
          {cooldowns.ability1 > 0.05 ? (
            <div style={cooldownOverlay}>
              <span style={cooldownNumber}>
                {cooldowns.ability1 >= 10 ? Math.ceil(cooldowns.ability1) : cooldowns.ability1.toFixed(1)}
              </span>
            </div>
          ) : null}
        </button>

        {/* Skill 3 (E / Burst) at bottom: 150px; right: 50px; */}
        <button
          style={{
            ...abilityCircleBtn,
            bottom: 150,
            right: 50,
            opacity: cooldowns.ability2 > 0.05 ? 0.55 : 1,
          }}
          onClick={() => onCast('ability2')}
          title={`[E / 3] ${ability2.name}: ${ability2.blurb}`}
        >
          <span style={hotkeyBadge}>E</span>
          <span style={abilityEmoji}>{ability2.emoji}</span>
          <span style={abilitySubName}>{ability2.name}</span>
          {cooldowns.ability2 > 0.05 ? (
            <div style={cooldownOverlay}>
              <span style={cooldownNumber}>
                {cooldowns.ability2 >= 10 ? Math.ceil(cooldowns.ability2) : cooldowns.ability2.toFixed(1)}
              </span>
            </div>
          ) : null}
        </button>

        {/* Ultimate (R / Solar Burst) at bottom: 120px; right: 190px; (65px, Gold Glow) */}
        <button
          style={{
            ...ultimateCircleBtn,
            bottom: 120,
            right: 190,
            opacity: cooldowns.ultimate > 0.05 ? 0.55 : 1,
          }}
          onClick={() => onCast('ultimate')}
          title={`[R / 4] ${hero.ultimate.name}: ${hero.ultimate.blurb}`}
        >
          <span style={hotkeyBadgeUlt}>R</span>
          <span style={ultimateEmoji}>{hero.ultimate.emoji}</span>
          <span style={ultimateSubName}>{hero.ultimate.name}</span>
          {cooldowns.ultimate > 0.05 ? (
            <div style={cooldownOverlay}>
              <span style={cooldownNumber}>
                {cooldowns.ultimate >= 10 ? Math.ceil(cooldowns.ultimate) : cooldowns.ultimate.toFixed(1)}
              </span>
            </div>
          ) : null}
        </button>

        {/* Main Attack Button (85px, Gold Frame #E5B25D) at bottom: 40px; right: 40px; */}
        <button
          style={{
            ...mainAttackBtn,
            bottom: 40,
            right: 40,
            opacity: cooldowns.basic > 0.05 ? 0.7 : 1,
          }}
          onClick={() => onCast('basic')}
          title={`[J / Space] Aimed Basic Attack (${effectiveStats?.attack ?? hero.attack} dmg)`}
        >
          <span style={mainAttackKey}>J</span>
          <span style={{ fontSize: 34 }}>⚔</span>
          <span style={mainAttackText}>ATTACK</span>
        </button>
      </div>

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

      {/* Streamlined Combat Broadcast Banner */}
      <div style={combatBroadcastBar}>
        <span style={combatLineText}>{combatLine}</span>
        {objectiveLine ? <span style={objectiveLineText}>{objectiveLine}</span> : null}
      </div>

      {/* Minion Wave Divisions Live Ribbon */}
      <div style={minionWaveRibbon}>
        <div style={minionTeamBadgeAnito}>
          <span style={{ color: '#FFD700', fontWeight: 800, fontSize: 10 }}>ANITO PANGKAT:</span>
          <span style={minionCountChip} title="Mandirigma (Frontline Kalasag & Kampilan)">⚔️ {anitoMandirigma}</span>
          <span style={minionCountChip} title="Mapanahong (Ranged Salakot Archer)">🏹 {anitoMapanahong}</span>
          <span style={minionCountChip} title="Bagani (Carabao Horned Siege Ram)">🐂 {anitoBagani}</span>
        </div>
        <div style={minionWaveDivider}>VS</div>
        <div style={minionTeamBadgeMalakas}>
          <span style={{ color: '#F87171', fontWeight: 800, fontSize: 10 }}>MALAKAS PANGKAT:</span>
          <span style={minionCountChip} title="Mandirigma (Frontline Kalasag & Kampilan)">⚔️ {malakasMandirigma}</span>
          <span style={minionCountChip} title="Mapanahong (Ranged Salakot Archer)">🏹 {malakasMapanahong}</span>
          <span style={minionCountChip} title="Bagani (Carabao Horned Siege Ram)">🐂 {malakasBagani}</span>
        </div>
      </div>

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
                  {hero.emoji} {hero.name} {hero.baybayin ? `(${hero.baybayin})` : ''}
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
                  Pre-colonial Philippine Vanguard, Ranged, and Heavy Siege Formations
                </span>
              </div>
              <button style={closeBtn} onClick={() => setShowMinionsCodex(false)}>
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gap: 12, maxHeight: '60vh', overflowY: 'auto', marginTop: 10 }}>
              {/* 1. Mandirigma Card */}
              <div style={minionCodexCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={minionCodexAvatar}>
                    <span style={{ fontSize: 32 }}>⚔️</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#F8FAFC', fontSize: 15 }}>Pangkat Mandirigma (Frontline Vanguard)</strong>
                      <span style={{ fontSize: 10.5, color: '#FFD700', background: 'rgba(255,215,0,0.15)', padding: '2px 8px', borderRadius: 4 }}>MELEE</span>
                    </div>
                    <span style={{ fontSize: 11.5, color: '#00E5FF' }}>Gear: Kalasag Rattan Shield · Kampilan Single-Edge Sword · Putong Crown</span>
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

              {/* 2. Mapanahong Card */}
              <div style={minionCodexCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ ...minionCodexAvatar, background: 'rgba(16, 185, 129, 0.2)', borderColor: '#10B981' }}>
                    <span style={{ fontSize: 32 }}>🏹</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#F8FAFC', fontSize: 15 }}>Pangkat Mapanahong (Poison Dart Hunter)</strong>
                      <span style={{ fontSize: 10.5, color: '#34D399', background: 'rgba(16,185,129,0.15)', padding: '2px 8px', borderRadius: 4 }}>RANGED</span>
                    </div>
                    <span style={{ fontSize: 11.5, color: '#34D399' }}>Gear: Woven Conical Salakot Hat · Bamboo Sumpit & Longbow · Poison Quiver</span>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: '#CBD5E1', margin: '8px 0 6px', lineHeight: 1.4 }}>
                  Agile jungle marksmen equipped with ceremonial feathered Salakot headgear. They fire venom-tipped sumpit darts over friendly frontline shields.
                </p>
                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#94A3B8' }}>
                  <span>❤️ 360 HP</span>
                  <span>🏹 36 Magic Poison DMG</span>
                  <span>📏 7.5u Reach</span>
                  <span>🎯 True Sight in Brush</span>
                </div>
              </div>

              {/* 3. Bagani Card */}
              <div style={{ ...minionCodexCard, borderColor: 'rgba(255, 215, 0, 0.4)', background: 'rgba(120, 53, 15, 0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ ...minionCodexAvatar, background: 'rgba(245, 158, 11, 0.25)', borderColor: '#F59E0B' }}>
                    <span style={{ fontSize: 32 }}>🐂</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#FFD700', fontSize: 15 }}>Pangkat Bagani (Heavy Horned Siege Ram)</strong>
                      <span style={{ fontSize: 10.5, color: '#FCD34D', background: 'rgba(245,158,11,0.2)', padding: '2px 8px', borderRadius: 4 }}>SIEGE VANGUARD</span>
                    </div>
                    <span style={{ fontSize: 11.5, color: '#FDE68A' }}>Gear: Bronze Carabao Skull Battering Ram · Hardwood Pauldrons · War Horns</span>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: '#FEF08A', margin: '8px 0 6px', lineHeight: 1.4 }}>
                  Armored elite siege vanguard carrying sacred Carabao skull battering rams. Deals massive 2.5x structural demolition damage to enemy defensive towers and the Moog Core.
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
                    {territory.baybayin}
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
          <div style={{ ...modalCard, maxWidth: 660 }} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div>
                <strong style={{ fontSize: 18, color: '#FFD700' }}>
                  📊 Talaan ng Digmaan (Match Performance Scoreboard)
                </strong>
                <span style={{ display: 'block', fontSize: 11.5, color: '#94A3B8' }}>
                  Duration: {formatTime(matchTime)} · {fps} FPS · Total Kills: {allyKills} - {enemyKills}
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
                    <th style={{ padding: '6px 8px' }}>CS (FARMS)</th>
                    <th style={{ padding: '6px 8px' }}>GOLD</th>
                    <th style={{ padding: '6px 8px' }}>AGIMAT ITEMS</th>
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
                    <td style={{ padding: '8px', color: '#FDE68A' }}>{Math.floor(matchTime / 8)} CS</td>
                    <td style={{ padding: '8px', color: '#FFD700', fontWeight: 800 }}>🪙 {playerGold}</td>
                    <td style={{ padding: '8px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {equippedItems.map((it, idx) => (
                          <span key={idx} title={it.name}>{it.emoji}</span>
                        ))}
                      </div>
                    </td>
                  </tr>

                  {/* Enemy Bot */}
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
                    <td style={{ padding: '8px', color: '#FDE68A' }}>{Math.floor(matchTime / 12)} CS</td>
                    <td style={{ padding: '8px', color: '#FFD700', fontWeight: 800 }}>🪙 {400 + enemyKills * 300}</td>
                    <td style={{ padding: '8px' }}>
                      <span title="Tabako ng Kapre">🚬 🪓</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* Mythological Agimat Shop Modal */}
      {showShop ? (
        <div style={modalOverlay} onClick={() => setShowShop(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <strong style={{ fontSize: 18, color: '#FFD700' }}>
                🪙 Agimat Armory (Gold: {playerGold})
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

      {/* Settings Modal */}
      {showSettings ? (
        <div style={modalOverlay} onClick={() => setShowSettings(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <strong style={{ fontSize: 18, color: '#F1F5F9' }}>⚙ Match Settings & Controls</strong>
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
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>
                  Controls: WASD to move · Mouse Pointer to Aim · J / Space for Basic Attack · Q/W/E/R for
                  Abilities · D/F for Potion/Flicker.
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Roster Switcher Modal */}
      {showRoster ? (
        <div style={modalOverlay} onClick={() => setShowRoster(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <strong style={{ fontSize: 18, color: '#FFD700' }}>Choose Mythic Hero</strong>
              <button style={closeBtn} onClick={() => setShowRoster(false)}>
                ✕
              </button>
            </div>
            <div style={rosterGrid}>
              {playable.map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    onPick(h);
                    setShowRoster(false);
                  }}
                  style={{
                    ...rosterPickBtn,
                    borderColor: h.id === hero.id ? '#FFD700' : 'rgba(255,255,255,0.2)',
                    background: h.id === hero.id ? 'rgba(255,215,0,0.18)' : 'rgba(15,23,42,0.6)',
                  }}
                >
                  <span style={{ fontSize: 24 }}>{h.emoji}</span>
                  <strong style={{ fontSize: 13, color: '#FFF' }}>{h.name}</strong>
                  <span style={{ fontSize: 10.5, color: '#94A3B8' }}>{h.role.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Victory Screen */}
      {won ? (
        <div style={victoryVeil}>
          <strong style={victoryTitle}>THE DIWATA WAKES — VICTORY!</strong>
          <span style={victoryBlurb}>
            The {TEAMS.malakas.name} core has been shattered and daylight returns to the ancient Pasig Agimat.
          </span>
          <button style={victoryBtn} onClick={() => window.location.reload()}>
            Play Again
          </button>
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
  top: 15,
  left: 15,
  width: 180,
  height: 180,
  borderRadius: 10,
  border: '3px solid #2C3E50',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.65)',
  overflow: 'hidden',
  background: 'rgba(11, 19, 32, 0.85)',
  backdropFilter: 'blur(8px)',
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
  top: 5,
  right: 5,
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: 'rgba(15, 23, 42, 0.75)',
  border: '1px solid rgba(255, 215, 0, 0.5)',
  display: 'grid',
  placeItems: 'center',
};

const utilityMenuStack: React.CSSProperties = {
  position: 'absolute',
  top: 205,
  left: 15,
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
  pointerEvents: 'auto',
  zIndex: 10,
};

const utilityBtn: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: '50%',
  border: '1.5px solid rgba(255, 255, 255, 0.3)',
  background: 'rgba(15, 23, 42, 0.82)',
  backdropFilter: 'blur(6px)',
  color: '#F8FAFC',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  transition: 'transform 100ms ease, background 100ms ease',
};

const utilityIcon: React.CSSProperties = {
  fontSize: 16,
};

// ── 2. Top-Right Scoreboard & Team Portraits ─────────────────────────────────
const topRightScoreboard: React.CSSProperties = {
  position: 'absolute',
  top: 15,
  right: 15,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 8,
  pointerEvents: 'auto',
  zIndex: 10,
};

const scoreBarCapsule: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '6px 14px',
  borderRadius: 999,
  background: 'rgba(15, 23, 42, 0.85)',
  border: '1px solid #334155',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
};

const scoreAllyCol: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const scoreBlueDot: React.CSSProperties = {
  color: '#00E5FF',
  fontSize: 14,
};

const scoreAllyNum: React.CSSProperties = {
  color: '#00E5FF',
  fontSize: 18,
  fontWeight: 800,
};

const scoreTimerCol: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  borderLeft: '1px solid rgba(255,255,255,0.15)',
  borderRight: '1px solid rgba(255,255,255,0.15)',
  padding: '0 12px',
};

const scoreTimerText: React.CSSProperties = {
  color: '#F8FAFC',
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: 0.5,
};

const fpsText: React.CSSProperties = {
  color: '#94A3B8',
  fontSize: 10,
  fontWeight: 600,
};

const scoreEnemyCol: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const scoreEnemyNum: React.CSSProperties = {
  color: '#FF3B30',
  fontSize: 18,
  fontWeight: 800,
};

const scoreRedDot: React.CSSProperties = {
  color: '#FF3B30',
  fontSize: 14,
};

const rosterToggleBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: '50%',
  width: 28,
  height: 28,
  color: '#FFF',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  fontSize: 13,
};

const teammatesRow: React.CSSProperties = {
  display: 'flex',
  gap: 6,
};

const teammatePortraitBox: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: 38,
  background: 'rgba(15, 23, 42, 0.75)',
  borderRadius: 6,
  padding: '3px 2px',
  border: '1px solid rgba(255,255,255,0.12)',
};

const teammateAvatarCircle: React.CSSProperties = {
  position: 'relative',
  width: 32,
  height: 32,
  borderRadius: '50%',
  background: 'rgba(30, 41, 59, 0.8)',
  display: 'grid',
  placeItems: 'center',
};

const ultIndicatorJewel: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  right: 0,
  width: 8,
  height: 8,
  borderRadius: '50%',
  border: '1.5px solid #0F172A',
};

const teammateHpTrack: React.CSSProperties = {
  width: '100%',
  height: 3.5,
  background: 'rgba(0,0,0,0.5)',
  borderRadius: 2,
  marginTop: 3,
  overflow: 'hidden',
};

const teammateHpFill: React.CSSProperties = {
  height: '100%',
  background: '#10B981',
  borderRadius: 2,
};

const teammateManaTrack: React.CSSProperties = {
  width: '100%',
  height: 2.5,
  background: 'rgba(0,0,0,0.5)',
  borderRadius: 2,
  marginTop: 1.5,
  overflow: 'hidden',
};

const teammateManaFill: React.CSSProperties = {
  height: '100%',
  background: '#00E5FF',
  borderRadius: 2,
};

// ── 3. Virtual Touch Joystick ───────────────────────────────────────────────
const joystickOuterRing: React.CSSProperties = {
  position: 'absolute',
  bottom: 30,
  left: 30,
  width: 150,
  height: 150,
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(15, 23, 42, 0.45) 0%, rgba(15, 23, 42, 0.8) 100%)',
  border: '2px solid rgba(255, 255, 255, 0.25)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
  backdropFilter: 'blur(6px)',
  pointerEvents: 'auto',
  touchAction: 'none',
  display: 'grid',
  placeItems: 'center',
  zIndex: 10,
};

const joystickThumbPad: React.CSSProperties = {
  width: 56,
  height: 56,
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
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.4)',
};

const joyNotchN: React.CSSProperties = { position: 'absolute', top: 6, color: 'rgba(255,255,255,0.3)', fontSize: 10 };
const joyNotchS: React.CSSProperties = { position: 'absolute', bottom: 6, color: 'rgba(255,255,255,0.3)', fontSize: 10 };
const joyNotchW: React.CSSProperties = { position: 'absolute', left: 6, color: 'rgba(255,255,255,0.3)', fontSize: 10 };
const joyNotchE: React.CSSProperties = { position: 'absolute', right: 6, color: 'rgba(255,255,255,0.3)', fontSize: 10 };

// ── 4. Circular Skill Cluster ───────────────────────────────────────────────
const skillClusterContainer: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  right: 0,
  width: 280,
  height: 280,
  pointerEvents: 'none',
  zIndex: 10,
};

const quickSpellsRow: React.CSSProperties = {
  position: 'absolute',
  bottom: 30,
  right: 215,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  pointerEvents: 'auto',
};

const smallSpellBtn: React.CSSProperties = {
  position: 'relative',
  width: 42,
  height: 42,
  borderRadius: '50%',
  background: 'rgba(15, 23, 42, 0.85)',
  border: '1.5px solid #00E5FF',
  color: '#FFF',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
};

const spellKeyBadge: React.CSSProperties = {
  position: 'absolute',
  top: -4,
  left: -4,
  background: '#334155',
  color: '#E2E8F0',
  borderRadius: 4,
  padding: '1px 4px',
  fontSize: 9,
  fontWeight: 800,
};

const spellCooldownText: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: '50%',
  background: 'rgba(0,0,0,0.7)',
  color: '#FFD700',
  display: 'grid',
  placeItems: 'center',
  fontSize: 13,
  fontWeight: 800,
};

const abilityCircleBtn: React.CSSProperties = {
  position: 'absolute',
  width: 58,
  height: 58,
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
  border: '2px solid rgba(255, 255, 255, 0.35)',
  boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  pointerEvents: 'auto',
  overflow: 'hidden',
};

const ultimateCircleBtn: React.CSSProperties = {
  position: 'absolute',
  width: 68,
  height: 68,
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(120, 53, 15, 0.9) 0%, rgba(69, 26, 3, 0.95) 100%)',
  border: '2.5px solid #FFD700',
  boxShadow: '0 0 20px rgba(255, 215, 0, 0.55)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  pointerEvents: 'auto',
  overflow: 'hidden',
};

const mainAttackBtn: React.CSSProperties = {
  position: 'absolute',
  width: 82,
  height: 82,
  borderRadius: '50%',
  background: 'radial-gradient(circle, #D97706 0%, #78350F 100%)',
  border: '3px solid #FDE68A',
  boxShadow: '0 8px 24px rgba(217, 119, 6, 0.65)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  pointerEvents: 'auto',
};

const mainAttackKey: React.CSSProperties = {
  position: 'absolute',
  top: 4,
  right: 12,
  fontSize: 10,
  fontWeight: 800,
  color: '#FEF08A',
};

const mainAttackText: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  color: '#FFF',
  letterSpacing: 1,
  marginTop: 2,
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
  fontSize: 20,
};

const ultimateEmoji: React.CSSProperties = {
  fontSize: 26,
};

const abilitySubName: React.CSSProperties = {
  fontSize: 8.5,
  fontWeight: 700,
  color: '#E2E8F0',
  marginTop: 1,
  maxWidth: 50,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const ultimateSubName: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  color: '#FDE68A',
  marginTop: 1,
  maxWidth: 58,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
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
  fontSize: 15,
  fontWeight: 900,
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

const minionTeamBadgeAnito: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const minionTeamBadgeMalakas: React.CSSProperties = {
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
