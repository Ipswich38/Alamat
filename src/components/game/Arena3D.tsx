'use client';

// The playable arena.
//
// Deliberately thin. It owns the canvas, the frame loop and the input, and it
// asks game/ modules for everything else. The lesson behind that split is a
// concrete one: on the previous project the equivalent component reached 868
// lines holding two unrelated jobs, driving a three.js scene and drawing the
// buttons over it, and had to be pulled apart later. Starting split costs
// nothing; arriving there costs a refactor.

import React, { useEffect, useRef, useState } from 'react';
import { HEROES, heroById, type Hero } from '@/game/heroes';
import { SPAWNS, resolvePosition } from '@/game/arena/layout';
import { createStage } from '@/game/render3d/stage';
import { buildArena } from '@/game/render3d/arena';
import { ROLE_RADIUS, createFighter } from '@/game/render3d/fighter';

/**
 * How many world units tall the view is. Smaller is closer in.
 *
 * Tuned against the abilities rather than against the scenery. The longest
 * reach in the roster is 14 units, so the view has to show a comfortable margin
 * past that or a player cannot see what they are aiming at. At the first value
 * of 34 the whole arena fitted on screen and the hero was a speck, which is a
 * map view, not a fight.
 */
const VIEW_HEIGHT = 21;

export default function Arena3D({ heroId = 'tikbalang' }: { heroId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hero, setHero] = useState<Hero>(() => heroById(heroId) ?? HEROES[0]);
  const [fps, setFps] = useState(0);
  // Read inside the frame loop, which must not be torn down when the hero
  // changes: a ref is how a value crosses from React into a running loop.
  const heroRef = useRef(hero);
  heroRef.current = hero;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stage = createStage(canvas);
    stage.setViewHeight(VIEW_HEIGHT);
    stage.scene.add(buildArena());

    let fighter = createFighter(hero);
    stage.scene.add(fighter.group);
    let builtFor = hero.id;

    let px = SPAWNS.home.x;
    let pz = SPAWNS.home.z;
    let heading = Math.PI * 0.75;

    const keys = new Set<string>();
    const onDown = (e: KeyboardEvent) => keys.add(e.key.toLowerCase());
    const onUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);

    const onResize = () => stage.resize();
    window.addEventListener('resize', onResize);
    stage.resize();

    let raf = 0;
    let last = performance.now();
    let frames = 0;
    let fpsClock = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      // Clamped: a backgrounded tab returns with a huge delta, and integrating
      // that in one step teleports the body through the walls.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Rebuild the body when the hero changes, rather than tearing the whole
      // scene down: the arena and the lights are the expensive part.
      const want = heroRef.current;
      if (want.id !== builtFor) {
        stage.scene.remove(fighter.group);
        fighter.dispose();
        fighter = createFighter(want);
        stage.scene.add(fighter.group);
        builtFor = want.id;
      }

      // ── input ────────────────────────────────────────────────────────────
      // Rotated 45 degrees to match the camera's yaw, so "up" on the keyboard
      // is up on the SCREEN rather than up on the world axis. Without this the
      // controls feel diagonal to everyone who has not read the source.
      let ix = 0;
      let iz = 0;
      if (keys.has('w') || keys.has('arrowup')) iz -= 1;
      if (keys.has('s') || keys.has('arrowdown')) iz += 1;
      if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
      if (keys.has('d') || keys.has('arrowright')) ix += 1;

      const moving = ix !== 0 || iz !== 0;
      if (moving) {
        const cos = Math.cos(-Math.PI / 4);
        const sin = Math.sin(-Math.PI / 4);
        const dx = ix * cos - iz * sin;
        const dz = ix * sin + iz * cos;
        const len = Math.hypot(dx, dz) || 1;
        const step = want.speed * dt;
        const next = resolvePosition(
          px + (dx / len) * step,
          pz + (dz / len) * step,
          ROLE_RADIUS[want.role]
        );
        px = next.x;
        pz = next.z;
        heading = Math.atan2(dx, dz);
      }

      fighter.group.position.set(px, 0, pz);
      fighter.face(heading);
      fighter.update(dt, moving);
      stage.lookAtGround(px, pz);
      stage.render();

      frames++;
      fpsClock += dt;
      if (fpsClock >= 0.5) {
        setFps(Math.round(frames / fpsClock));
        frames = 0;
        fpsClock = 0;
      }
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('resize', onResize);
      fighter.dispose();
      stage.dispose();
    };
    // Built once. The hero is read through a ref so that changing it does not
    // rebuild the arena.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      <div style={panel}>
        <strong style={{ fontSize: 15 }}>
          {hero.emoji} {hero.name}
        </strong>
        <span style={{ opacity: 0.75, fontSize: 12 }}>{hero.origin}</span>
        <span style={{ opacity: 0.55, fontSize: 11 }}>{fps} fps · WASD to move</span>
      </div>

      <div style={picker}>
        {HEROES.map((h) => (
          <button
            key={h.id}
            onClick={() => setHero(h)}
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
    </div>
  );
}

const panel: React.CSSProperties = {
  position: 'absolute',
  left: 14,
  top: 14,
  display: 'grid',
  gap: 2,
  padding: '10px 14px',
  borderRadius: 12,
  background: 'rgba(6,18,20,0.6)',
  color: '#f7f5ee',
  fontFamily: 'system-ui, sans-serif',
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
