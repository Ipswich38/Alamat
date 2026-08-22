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
import { HEROES, type Hero } from '@/game/heroes';

import { createStage } from '@/game/render3d/stage';
import { buildGround, createNexus } from '@/game/render3d/nexus';
import { HALF, TEAMS } from '@/game/arena/nexus';
import { createTowers } from '@/game/render3d/towers';
import { createWalls } from '@/game/render3d/walls';
import { createCamps } from '@/game/render3d/camps';
import { resolveWalls } from '@/game/arena/walls';
import { loadModel } from '@/game/render3d/models';
import { createSantelmo } from '@/game/render3d/santelmo';
import { createActor, type Actor } from '@/game/render3d/actor';
import { KAPRE } from '@/game/combat/foes';

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
  // Read inside the frame loop, which must not be torn down when the hero
  // changes: a ref is how a value crosses from React into a running loop.
  const heroRef = useRef(hero);
  heroRef.current = hero;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stage = createStage(canvas);
    // ?zoom=6 fills the frame with the character, which is the only way to
    // judge a body that is thirty pixels tall in normal play.
    const zoomParam = Number(new URLSearchParams(window.location.search).get('zoom'));
    stage.setViewHeight(Number.isFinite(zoomParam) && zoomParam > 0 ? zoomParam : VIEW_HEIGHT);
    stage.scene.add(buildGround());
    const nexus = createNexus();
    stage.scene.add(nexus.group);
    const towers = createTowers();
    stage.scene.add(towers.group);
    const walls = createWalls();
    stage.scene.add(walls.group);
    const camps = createCamps();
    stage.scene.add(camps.group);

    const santelmo = createSantelmo();
    stage.scene.add(santelmo.group);

    // ⚠ THE GENERATED BALETE IS DELIBERATELY NOT LOADED. It exists at
    // /models/nature/balete.glb and it is WORSE than the procedural tree it was
    // meant to replace: text-to-3D returned a lumpy mound with no trunk, no
    // hanging roots and no readable silhouette. Kept on disk as evidence for
    // the decision rather than deleted.
    //
    // The pattern it confirms, which matches the previous project exactly:
    // generated CREATURES work and generated SCENERY does not. The credits
    // belong to the Bakunawa and the Kapre, not to trees.

    // Loaded asynchronously, so the frame loop has to cope with there being no
    // body yet. It starts immediately and the arena is already on screen.
    let player: Actor | null = null;
    let builtFor = hero.id;
    let disposed = false;

    const swapTo = (h: Hero) => {
      if (!h.model) return;
      builtFor = h.id;
      createActor({ ...h.model, height: 1.75 * h.build.scale }).then((next) => {
        if (disposed || builtFor !== h.id) {
          next.dispose();
          return;
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
    // reach. It cannot hurt you yet, because nothing can hurt anything yet.
    let foe: Actor | null = null;
    let fx = 0;
    let fz = 0;
    let fFacing = 0;
    createActor(KAPRE.model).then((a) => {
      if (disposed) {
        a.dispose();
        return;
      }
      foe = a;
      a.setPosition(fx, 0, fz);
      stage.scene.add(a.object);
    });

    // ?at=8,-4 drops the player on a chosen tile, for looking at a hero
    // somewhere that is not behind a bush.
    const atParam = new URLSearchParams(window.location.search).get('at');
    const at = atParam?.split(',').map(Number);
    // Spawn just outside the Anito sanctuary, facing the map.
    let px = at && at.length === 2 && at.every(Number.isFinite) ? at[0] : TEAMS.anito.x + 14;
    let pz = at && at.length === 2 && at.every(Number.isFinite) ? at[1] : TEAMS.anito.z - 14;
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
    let clock = 0;
    let frames = 0;
    let fpsClock = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      // Clamped: a backgrounded tab returns with a huge delta, and integrating
      // that in one step teleports the body through the walls.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;

      // Rebuild the body when the hero changes, rather than tearing the whole
      // scene down: the arena and the lights are the expensive part.
      const want = heroRef.current;
      if (want.id !== builtFor) swapTo(want);

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
        // Clamped to the map for now. Pathing blockades arrive with the jungle
        // assets; until they exist there is nothing to collide with.
        // Walls first, then the map edge. A body pushed out of a wall must not
        // then be clamped back into it.
        const pushed = resolveWalls(
          px + (dx / len) * step,
          pz + (dz / len) * step,
          0.7
        );
        px = Math.max(-HALF + 1, Math.min(HALF - 1, pushed.x));
        pz = Math.max(-HALF + 1, Math.min(HALF - 1, pushed.z));
        heading = Math.atan2(dx, dz);
      }

      if (foe) {
        const dx = px - fx;
        const dz = pz - fz;
        const gap = Math.hypot(dx, dz);
        // Notices you, closes, stops at reach. Three numbers and it already
        // reads as a creature deciding something.
        const closing = gap < KAPRE.awareness && gap > KAPRE.reach;
        if (closing) {
          const step = (KAPRE.speed * dt) / gap;
          fx += dx * step;
          fz += dz * step;
        }
        // Always turns to face you, even when standing still, which is what
        // makes a thing feel aware rather than idle.
        if (gap > 0.1) fFacing = Math.atan2(dx, dz);
        foe.setPosition(fx, 0, fz);
        foe.setFacing(fFacing);
        foe.play(closing ? 'walk' : 'idle');
        foe.update(dt);
      }

      if (player) {
        player.setPosition(px, 0, pz);
        player.setFacing(heading);
        player.play(moving ? 'run' : 'idle');
        player.update(dt);
      }
      nexus.update(clock);
      towers.update(clock);
      camps.update(clock);
      santelmo.update(clock);
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
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('resize', onResize);
      nexus.dispose();
      towers.dispose();
      walls.dispose();
      camps.dispose();
      santelmo.dispose();
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

      <div style={panel}>
        <strong style={{ fontSize: 15 }}>
          {hero.emoji} {hero.name}
        </strong>
        <span style={{ opacity: 0.75, fontSize: 12 }}>{hero.origin}</span>
        <span style={{ opacity: 0.55, fontSize: 11 }}>{fps} fps · WASD to move</span>
      </div>

      <div style={picker}>
        {playable.map((h) => (
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
