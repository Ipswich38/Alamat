'use client';

// Everything drawn OVER the arena: health, abilities, camera controls, roster.
//
// ── WHY IT IS NOT IN Arena3D ────────────────────────────────────────────────
// That component owns a canvas, a frame loop and raw input, and this one owns
// buttons. They share nothing but a handful of numbers, and the moment they
// live together every HUD tweak means opening the file that runs the game. It
// is the exact split the previous project had to be pulled apart to reach, and
// Arena3D's own header says so; this is honouring it before it happened twice.
//
// ⚠ PURELY PRESENTATIONAL. It holds no game state and decides nothing: every
// value arrives as a prop and every press leaves as a callback. Combat truth
// lives in the frame loop, because a HUD that can also change the fight is a
// second place to look when the fight is wrong.

import React from 'react';
import { TEAMS } from '@/game/arena/nexus';
import type { CastSlot, CooldownState } from '@/game/combat';
import type { Hero } from '@/game/heroes';

interface HeroHudProps {
  hero: Hero;
  playable: Hero[];
  onPick: (hero: Hero) => void;
  fps: number;
  hidden: boolean;
  playerHp: number;
  foeName: string;
  foeHp: number;
  foeMaxHp: number;
  combatLine: string;
  /** One line on what is left of the enemy base. */
  objectiveLine: string;
  /** The enemy core has broken. A match ends and does not un-end. */
  won: boolean;
  cooldowns: CooldownState;
  onCast: (slot: CastSlot) => void;
  /** Camera yaw in radians, for the needle. */
  compass: number;
  zoomShown: number;
  onZoom: (factor: number) => void;
  /** -1, 0 or 1, held while a turn button is pressed. */
  onTurn: (dir: number) => void;
}

export default function HeroHud({
  hero,
  playable,
  onPick,
  fps,
  hidden,
  playerHp,
  foeName,
  foeHp,
  foeMaxHp,
  combatLine,
  objectiveLine,
  won,
  cooldowns,
  onCast,
  compass,
  zoomShown,
  onZoom,
  onTurn,
}: HeroHudProps) {
  const combatControls = [
    {
      slot: 'basic' as CastSlot,
      key: 'J',
      emoji: '⚔',
      name: 'Strike',
      blurb: `Aimed basic attack for ${hero.attack} damage.`,
      cooldown: cooldowns.basic,
    },
    {
      slot: 'ability0' as CastSlot,
      key: '1',
      emoji: hero.abilities[0].emoji,
      name: hero.abilities[0].name,
      blurb: hero.abilities[0].blurb,
      cooldown: cooldowns.ability0,
    },
    {
      slot: 'ability1' as CastSlot,
      key: '2',
      emoji: hero.abilities[1].emoji,
      name: hero.abilities[1].name,
      blurb: hero.abilities[1].blurb,
      cooldown: cooldowns.ability1,
    },
    {
      slot: 'ultimate' as CastSlot,
      key: 'R',
      emoji: hero.ultimate.emoji,
      name: hero.ultimate.name,
      blurb: hero.ultimate.blurb,
      cooldown: cooldowns.ultimate,
    },
  ];

  const playerPct = Math.max(0, Math.min(100, (playerHp / hero.health) * 100));
  const foePct = Math.max(0, Math.min(100, (foeHp / foeMaxHp) * 100));

  return (
    <>
      <div style={panel}>
        <strong style={{ fontSize: 15 }}>
          {hero.emoji} {hero.name}
        </strong>
        <span style={{ opacity: 0.75, fontSize: 12 }}>{hero.origin}</span>
        <span style={{ opacity: 0.55, fontSize: 11 }}>
          {fps} fps · WASD to move{hidden ? ' · 🌿 hidden' : ''}
        </span>
        <div style={healthRow}>
          <span>Hero</span>
          <div style={barShell}>
            <span style={{ ...barFill, width: `${playerPct}%`, background: TEAMS.anito.css }} />
          </div>
          <span>{Math.ceil(playerHp)}</span>
        </div>
        <div style={healthRow}>
          <span>{foeName}</span>
          <div style={barShell}>
            <span style={{ ...barFill, width: `${foePct}%`, background: TEAMS.malakas.css }} />
          </div>
          <span>{Math.ceil(foeHp)}</span>
        </div>
        <span style={combatLineStyle}>{combatLine}</span>
        <span style={objectiveLineStyle}>{objectiveLine}</span>
      </div>

      {/* The end of a match. Deliberately the only thing on screen that covers
          the arena: everything else here is a corner overlay, and a result that
          can be missed is not a result. */}
      {won ? (
        <div style={victoryVeil}>
          <strong style={victoryTitle}>The Diwata wakes</strong>
          <span style={victoryBlurb}>
            The {TEAMS.malakas.name} core is broken and the sun comes back over the Pasig Agimat.
          </span>
          <button style={victoryBtn} onClick={() => window.location.reload()}>
            Fight again
          </button>
        </div>
      ) : null}

      {/* ── camera controls ──────────────────────────────────────────────
          Kept together in one corner, because zoom and rotation are the same
          question asked two ways: what am I looking at. Splitting them across
          the screen makes a player hunt for half of one control. */}
      <div style={cameraBox}>
        <button
          aria-label="Turn view left"
          style={roundBtn}
          onPointerDown={() => onTurn(1)}
          onPointerUp={() => onTurn(0)}
          onPointerLeave={() => onTurn(0)}
        >
          ↺
        </button>

        {/* The compass. The needle points to world north whichever way the
            camera is facing, which is the one thing a rotating view takes away
            and has to give back. */}
        <div style={compassRing} aria-label={`Compass, facing ${Math.round((-compass * 180) / Math.PI)} degrees`}>
          <div
            style={{
              ...needle,
              transform: `rotate(${-compass}rad)`,
            }}
          >
            <span style={needleN}>N</span>
          </div>
        </div>

        <button
          aria-label="Turn view right"
          style={roundBtn}
          onPointerDown={() => onTurn(-1)}
          onPointerUp={() => onTurn(0)}
          onPointerLeave={() => onTurn(0)}
        >
          ↻
        </button>
      </div>

      <div style={zoomBox}>
        <button aria-label="Zoom in" style={roundBtn} onClick={() => onZoom(0.82)}>
          +
        </button>
        <span style={zoomLabel}>{zoomShown}</span>
        <button aria-label="Zoom out" style={roundBtn} onClick={() => onZoom(1.22)}>
          −
        </button>
      </div>

      <div style={combatHud}>
        {combatControls.map((control) => {
          const cooling = control.cooldown > 0.05;
          return (
            <button
              key={control.slot}
              onClick={() => onCast(control.slot)}
              title={`${control.key}: ${control.name}. ${control.blurb}`}
              style={{
                ...combatBtn,
                opacity: cooling ? 0.58 : 1,
                borderColor: control.slot === 'ultimate' ? 'rgba(255,200,74,0.95)' : 'rgba(255,255,255,0.5)',
              }}
            >
              <span style={abilityKey}>{control.key}</span>
              <span style={abilityIcon}>{control.emoji}</span>
              <span style={abilityName}>{control.name}</span>
              {cooling ? (
                <span style={cooldownPill}>
                  {control.cooldown >= 10 ? Math.ceil(control.cooldown) : control.cooldown.toFixed(1)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div style={picker}>
        {playable.map((h) => (
          <button
            key={h.id}
            onClick={() => onPick(h)}
            style={{
              ...pick,
              background: h.id === hero.id ? '#f7f5ee' : 'rgba(6,18,20,0.6)',
              color: h.id === hero.id ? '#0d1b1e' : '#f7f5ee',
            }}
          >
            {h.emoji} {h.name}
          </button>
        ))}
      </div>
    </>
  );
}

const panel: React.CSSProperties = {
  position: 'absolute',
  left: 14,
  top: 14,
  display: 'grid',
  gap: 5,
  padding: '10px 14px',
  borderRadius: 12,
  background: 'rgba(6,18,20,0.6)',
  color: '#f7f5ee',
  fontFamily: 'system-ui, sans-serif',
  width: 282,
  maxWidth: 'calc(100vw - 28px)',
};

const healthRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '54px 1fr 42px',
  alignItems: 'center',
  gap: 7,
  fontSize: 11,
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
};

const barShell: React.CSSProperties = {
  height: 7,
  borderRadius: 999,
  overflow: 'hidden',
  background: 'rgba(255,255,255,0.16)',
};

const barFill: React.CSSProperties = {
  display: 'block',
  height: '100%',
  borderRadius: 999,
  transition: 'width 140ms linear',
};

const objectiveLineStyle: React.CSSProperties = {
  marginTop: 2,
  fontSize: 11.5,
  fontFamily: 'system-ui, sans-serif',
  color: '#4ad8ff',
  opacity: 0.9,
};

const victoryVeil: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeContent: 'center',
  justifyItems: 'center',
  gap: 14,
  padding: 24,
  textAlign: 'center',
  background: 'radial-gradient(circle at 50% 45%, rgba(6,18,20,0.55), rgba(6,18,20,0.9))',
};

const victoryTitle: React.CSSProperties = {
  color: '#ffc84a',
  fontSize: 34,
  fontWeight: 800,
  letterSpacing: 0.6,
  fontFamily: 'system-ui, sans-serif',
};

const victoryBlurb: React.CSSProperties = {
  color: '#f7f5ee',
  fontSize: 14,
  maxWidth: 420,
  lineHeight: 1.5,
  fontFamily: 'system-ui, sans-serif',
};

const victoryBtn: React.CSSProperties = {
  minHeight: 46,
  padding: '0 22px',
  borderRadius: 999,
  border: 'none',
  background: '#ffc84a',
  color: '#0d1b1e',
  fontWeight: 800,
  fontSize: 14.5,
  cursor: 'pointer',
  fontFamily: 'system-ui, sans-serif',
};

const combatLineStyle: React.CSSProperties = {
  minHeight: 30,
  color: 'rgba(247,245,238,0.72)',
  fontSize: 11,
  lineHeight: 1.25,
};

const picker: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: 18,
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  justifyContent: 'center',
  padding: '0 12px',
};

const cameraBox: React.CSSProperties = {
  position: 'absolute',
  right: 16,
  bottom: 92,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const zoomBox: React.CSSProperties = {
  position: 'absolute',
  right: 16,
  bottom: 22,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const combatHud: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: 78,
  transform: 'translateX(-50%)',
  display: 'flex',
  justifyContent: 'center',
  gap: 8,
  flexWrap: 'wrap',
  width: 'min(584px, calc(100vw - 112px))',
  pointerEvents: 'auto',
};

const combatBtn: React.CSSProperties = {
  position: 'relative',
  width: 132,
  height: 56,
  display: 'grid',
  gridTemplateColumns: '22px 24px 1fr',
  alignItems: 'center',
  columnGap: 6,
  padding: '0 10px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.5)',
  background: 'rgba(6,18,20,0.68)',
  color: '#f7f5ee',
  cursor: 'pointer',
  fontFamily: 'system-ui, sans-serif',
  boxShadow: '0 10px 24px rgba(0,0,0,0.22)',
};

const abilityKey: React.CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 22,
  height: 22,
  borderRadius: 5,
  background: 'rgba(255,255,255,0.16)',
  color: '#ffc84a',
  fontSize: 11,
  fontWeight: 900,
};

const abilityIcon: React.CSSProperties = {
  fontSize: 18,
  lineHeight: 1,
};

const abilityName: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 12,
  fontWeight: 800,
  textAlign: 'left',
};

const cooldownPill: React.CSSProperties = {
  position: 'absolute',
  right: 7,
  top: 6,
  minWidth: 28,
  height: 20,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 999,
  background: 'rgba(0,0,0,0.48)',
  color: '#f7f5ee',
  fontSize: 11,
  fontWeight: 900,
  fontVariantNumeric: 'tabular-nums',
};

const roundBtn: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: '50%',
  border: '2px solid rgba(255,255,255,0.7)',
  background: 'rgba(6,18,20,0.55)',
  color: '#f7f5ee',
  fontSize: 19,
  cursor: 'pointer',
  touchAction: 'none',
  fontFamily: 'system-ui, sans-serif',
};

const compassRing: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: '50%',
  border: '2px solid rgba(255,255,255,0.55)',
  background: 'rgba(6,18,20,0.55)',
  display: 'grid',
  placeItems: 'center',
};

const needle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'grid',
  placeItems: 'start center',
  paddingTop: 3,
  // Snaps to the yaw each frame; no transition, or the needle lags the world.
};

const needleN: React.CSSProperties = {
  color: '#ffc84a',
  fontWeight: 800,
  fontSize: 13,
  fontFamily: 'system-ui, sans-serif',
  lineHeight: 1,
};

const zoomLabel: React.CSSProperties = {
  minWidth: 34,
  textAlign: 'center',
  color: '#f7f5ee',
  fontSize: 12.5,
  fontWeight: 700,
  fontFamily: 'system-ui, sans-serif',
  fontVariantNumeric: 'tabular-nums',
};

const pick: React.CSSProperties = {
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 999,
  border: 'none',
  fontWeight: 700,
  fontSize: 13.5,
  cursor: 'pointer',
  fontFamily: 'system-ui, sans-serif',
};
