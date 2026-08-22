// The towers, drawn.
//
// ── WHY THE PLACEHOLDER SURVIVES THE REAL MODEL ─────────────────────────────
// Every generated asset in this game is an UPGRADE to something already
// legible, never the only version of it. These models are seven to eight
// megabytes each and a player on a bad connection may never receive one. A
// tower that fails to load must still be a tower you can see, aim at and push.
//
// ── AND WHY THE SPIRIT MASK IS DRAWN SEPARATELY ─────────────────────────────
// The generated tower carries its own carved mask, but that mask is a normal
// lit surface: it cannot say WHOSE tower this is from across a 200-unit map. So
// a small unlit team-coloured light sits at the crown of every tower, bright
// enough to trip the bloom. Colour is the readability system; the model is the
// dressing on top of it.

import * as THREE from 'three';
import { buildTowers, type TowerNode } from '@/game/arena/lanes';
import { TEAMS } from '@/game/arena/nexus';
import { loadModel } from './models';
import { surfaceMaterial } from './stage';
import { terrainHeight } from './terrain';

/** How tall a tower stands, by tier. Deeper tiers are taller. */
const HEIGHT: Record<number, number> = { 1: 8, 2: 9, 3: 10.5 };

export interface Towers {
  group: THREE.Group;
  nodes: TowerNode[];
  update(t: number): void;
  dispose(): void;
}

export function createTowers(): Towers {
  const group = new THREE.Group();
  group.name = 'towers';
  const nodes = buildTowers();
  const eyes: THREE.Mesh[] = [];
  const placeholders: THREE.Object3D[] = [];

  for (const node of nodes) {
    const team = TEAMS[node.team];
    const g = new THREE.Group();
    // Stands on the ground it is actually on, now that the ground has shape.
    g.position.set(node.x, terrainHeight(node.x, node.z), node.z);
    // Every tower faces the middle of the map, which is where the fight comes
    // from and the only direction its front means anything.
    g.rotation.y = Math.atan2(-node.x, -node.z);

    const h = HEIGHT[node.tier];

    // The stand-in: a stone footing and a timber shaft.
    const stand = new THREE.Group();
    const foot = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 3.2, 1.6, 8),
      surfaceMaterial(0x8f8878, { roughness: 0.92 })
    );
    foot.position.y = 0.8;
    foot.castShadow = true;
    foot.receiveShadow = true;
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.9, h - 2, 8),
      surfaceMaterial(0xb99a63, { roughness: 0.88 })
    );
    shaft.position.y = 1.6 + (h - 2) / 2;
    shaft.castShadow = true;
    stand.add(foot, shaft);
    stand.name = 'tower-placeholder';
    g.add(stand);
    placeholders.push(stand);

    // The eye. Unlit and above the bloom threshold, so it reads as light.
    const eye = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.05, 0),
      new THREE.MeshBasicMaterial({ color: team.light, toneMapped: false })
    );
    eye.position.y = h + 0.4;
    g.add(eye);
    eyes.push(eye);

    // The range collider, drawn flat on the ground. A tower whose reach you
    // cannot see is a tower you die to without understanding why, and this is
    // the single most important circle in a MOBA.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(node.range - 0.35, node.range, 48),
      new THREE.MeshBasicMaterial({
        color: team.light,
        transparent: true,
        // ⚠ QUIET BY DEFAULT. Eighteen bright rings turned the map into a
        // Venn diagram; the circle has to be findable when it matters and
        // invisible when it does not.
        opacity: 0.07,
        side: THREE.DoubleSide,
        toneMapped: false,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    g.add(ring);

    group.add(g);
  }

  // The generated watchtower replaces every placeholder shaft on arrival. One
  // download, twenty-two instances.
  loadModel('/models/props/watchtower.glb', { height: 10 }).then((model) => {
    if (!model) return;
    for (const [i, node] of nodes.entries()) {
      const built = model.clone(true);
      built.scale.setScalar(HEIGHT[node.tier] / 10);
      const parent = group.children[i];
      parent.add(built);
      placeholders[i].visible = false;
    }
  });

  return {
    group,
    nodes,
    update: (t) => {
      for (const [i, eye] of eyes.entries()) {
        eye.rotation.y = t * 0.6 + i;
        // Each tower breathes on its own offset, so a lane of them does not
        // pulse in unison like a string of fairy lights.
        eye.scale.setScalar(1 + Math.sin(t * 1.6 + i * 0.9) * 0.09);
      }
    },
    dispose: () => {
      group.traverse((n) => {
        const m = n as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
    },
  };
}
