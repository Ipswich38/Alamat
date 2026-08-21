// A body on the field.
//
// ── WHY THESE ARE BUILT AND NOT LOADED ──────────────────────────────────────
// Deliberately geometry, not a model, and that is a decision rather than a
// placeholder-for-now. The evidence from the previous project is specific:
// generated 3D CHARACTERS did not survive contact with rigging and animation,
// while generated CREATURES and PROPS did. So heroes are built from primitives
// tinted by the hero's own palette, which gives five distinct silhouettes today
// and costs nothing, and generated assets are saved for the bosses and the
// scenery where they actually work.
//
// The shapes differ per ROLE, not per hero, so a player reads what something
// does before they read who it is. That is the same reason a chess knight does
// not look like a bishop.

import * as THREE from 'three';
import type { Hero, HeroRole } from '@/game/heroes';
import { flatMaterial } from './stage';

export interface Fighter {
  group: THREE.Group;
  /** Point the body along a heading in radians. */
  face(heading: number): void;
  /** Advance the walk bob and any wind-up tell. `moving` drives the bob. */
  update(dt: number, moving: boolean): void;
  /** Flash on damage, which is the only hit feedback until VFX exist. */
  flash(): void;
  dispose(): void;
}

/** Body radius per role, used for collision as well as for drawing. */
export const ROLE_RADIUS: Record<HeroRole, number> = {
  vanguard: 0.85,
  mystic: 0.62,
  stalker: 0.6,
  warden: 0.68,
  ranger: 0.68,
};

export function createFighter(hero: Hero): Fighter {
  const group = new THREE.Group();
  group.name = `fighter:${hero.id}`;

  const r = ROLE_RADIUS[hero.role];
  const clothMat = flatMaterial(hero.palette.cloth);
  const skinMat = flatMaterial(hero.palette.skin);
  const accentMat = flatMaterial(hero.palette.accent);
  const hairMat = flatMaterial(hero.palette.hair);
  const materials = [clothMat, skinMat, accentMat, hairMat];

  // The body. A tapered prism rather than a capsule: flat faces catch the light
  // in distinct planes, which is what makes a low-poly figure legible at this
  // camera distance.
  const bodyH = hero.role === 'vanguard' ? 2.0 : 1.7;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.8, r, bodyH, 6),
    clothMat
  );
  body.position.y = bodyH / 2;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.62, 0), skinMat);
  head.position.y = bodyH + r * 0.5;
  head.castShadow = true;
  group.add(head);

  const hair = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.66, 0), hairMat);
  hair.position.y = bodyH + r * 0.66;
  hair.scale.y = 0.6;
  group.add(hair);

  // The role tell, sitting above and behind the shoulders. This is the shape a
  // player actually recognises at a glance in a fight.
  const mark = roleMark(hero.role, r, accentMat);
  mark.position.y = bodyH * 0.72;
  group.add(mark);

  // A facing wedge at the front. Every ability is aimed, so which way a body
  // points is information the player needs constantly.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(r * 0.3, r * 0.9, 4), accentMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, bodyH * 0.55, r * 0.95);
  group.add(nose);

  // The ground ring. Reads team, and stays visible when the body is behind
  // cover, which is what stops a fighter being lost against the tree.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r * 1.15, r * 1.45, 20),
    new THREE.MeshBasicMaterial({
      color: hero.palette.accent,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  group.add(ring);

  let bob = 0;
  let flashT = 0;
  const baseCloth = new THREE.Color(hero.palette.cloth);

  return {
    group,
    face: (heading) => {
      group.rotation.y = heading;
    },
    update: (dt, moving) => {
      if (moving) {
        bob += dt * 9;
        body.position.y = bodyH / 2 + Math.sin(bob) * 0.06;
        group.rotation.z = Math.sin(bob) * 0.03;
      } else {
        // Eased back rather than snapped, or stopping looks like a glitch.
        body.position.y += (bodyH / 2 - body.position.y) * Math.min(1, dt * 10);
        group.rotation.z += (0 - group.rotation.z) * Math.min(1, dt * 10);
      }

      if (flashT > 0) {
        flashT -= dt;
        const k = Math.max(0, flashT / 0.18);
        clothMat.color.copy(baseCloth).lerp(new THREE.Color(0xffffff), k);
      }
    },
    flash: () => {
      flashT = 0.18;
    },
    dispose: () => {
      group.traverse((n) => {
        const m = n as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
      for (const m of materials) m.dispose();
    },
  };
}

/** The silhouette that says what a hero DOES before it says who they are. */
function roleMark(role: HeroRole, r: number, mat: THREE.Material): THREE.Mesh {
  switch (role) {
    case 'vanguard': {
      // Broad shoulders. Reads as the thing that goes first.
      const m = new THREE.Mesh(new THREE.BoxGeometry(r * 2.4, 0.3, r * 0.9), mat);
      return m;
    }
    case 'mystic': {
      // A floating ring above the shoulders.
      const m = new THREE.Mesh(new THREE.TorusGeometry(r * 0.9, 0.09, 4, 10), mat);
      m.rotation.x = Math.PI / 2;
      return m;
    }
    case 'stalker': {
      // Swept back, like something mid-lunge.
      const m = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, r * 1.8, 4), mat);
      m.rotation.x = -0.9;
      return m;
    }
    case 'warden': {
      // A canopy over the head: the shape of something sheltering.
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.3, r * 0.2, 0.5, 6), mat);
      return m;
    }
    case 'ranger': {
      // A long bar across the back, the reach made visible.
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, r * 3.2), mat);
      return m;
    }
  }
}
