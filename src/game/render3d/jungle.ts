// The jungle, drawn: tree lines that stop you and canopies that hide you.
//
// ── WHY BRUSH IS DRAWN AS A CANOPY YOU SEE THROUGH ──────────────────────────
// Brush has to read as "somewhere I could be hidden" from outside, and as
// "I am hidden" from inside, and those are opposite requirements for one
// object. Solved the way every MOBA solves it: a translucent canopy that is
// dense enough to say "you cannot see in" and transparent enough that a player
// standing in it can still see out and play.
//
// ── AND WHY THE TREE LINES ARE INSTANCED WITH JITTER ────────────────────────
// A barrier is a straight segment because collision against a straight segment
// is cheap. Drawing it as evenly spaced trees on that exact line would read as
// a fence, so each tree is nudged off the line and turned. The COLLISION stays
// straight; only the picture is crooked.

import * as THREE from 'three';
import { BARRIERS, BRUSH } from '@/game/arena/jungle';
import { loadModel } from './models';
import { surfaceMaterial } from './stage';

/** Spacing between trees along a barrier, in world units. */
const TREE_STEP = 6;
/** How tall a balete stands. Well above sight line: these block vision. */
const TREE_HEIGHT = 13;

export interface Jungle {
  group: THREE.Group;
  update(t: number): void;
  dispose(): void;
}

export function createJungle(): Jungle {
  const group = new THREE.Group();
  group.name = 'jungle';

  const slots: { x: number; z: number; turn: number; scale: number }[] = [];
  for (const b of BARRIERS) {
    const dx = b.to[0] - b.from[0];
    const dz = b.to[1] - b.from[1];
    const len = Math.hypot(dx, dz);
    const count = Math.max(2, Math.round(len / TREE_STEP));
    const mid: [number, number] = [(b.from[0] + b.to[0]) / 2, (b.from[1] + b.to[1]) / 2];

    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const x = b.from[0] + dx * t;
      const z = b.from[1] + dz * t;
      // No trees in the doorway, or the door is only open to the collision
      // system and not to the player's eye.
      if (b.gap > 0 && Math.hypot(x - mid[0], z - mid[1]) < b.gap) continue;

      // Seeded jitter off the line. The collision stays straight; this is only
      // what stops a barrier reading as a picket fence.
      const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
      const j = (n - Math.floor(n)) * 2 - 1;
      const perp = [-dz / len, dx / len];
      slots.push({
        x: x + perp[0] * j * 1.8,
        z: z + perp[1] * j * 1.8,
        turn: j * Math.PI,
        scale: 0.82 + Math.abs(j) * 0.4,
      });
    }
  }

  // Stand-ins: a trunk and a canopy blob each, one instanced pair for all of
  // them. Hidden when the generated balete lands.
  const trunkGeo = new THREE.CylinderGeometry(1.1, 1.8, TREE_HEIGHT * 0.55, 7);
  const canopyGeo = new THREE.IcosahedronGeometry(4.4, 1);
  const trunks = new THREE.InstancedMesh(
    trunkGeo,
    surfaceMaterial(0x5b4433, { roughness: 0.95 }),
    slots.length
  );
  const canopies = new THREE.InstancedMesh(
    canopyGeo,
    surfaceMaterial(0x2f7d4f, { roughness: 0.9 }),
    slots.length
  );
  for (const m of [trunks, canopies]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'tree-placeholder';
  }
  const o = new THREE.Object3D();
  slots.forEach((s, i) => {
    o.position.set(s.x, (TREE_HEIGHT * 0.55) / 2, s.z);
    o.rotation.set(0, s.turn, 0);
    o.scale.setScalar(s.scale);
    o.updateMatrix();
    trunks.setMatrixAt(i, o.matrix);
    o.position.set(s.x, TREE_HEIGHT * 0.72, s.z);
    o.updateMatrix();
    canopies.setMatrixAt(i, o.matrix);
  });
  group.add(trunks, canopies);

  loadModel('/models/nature/balete.glb', { height: TREE_HEIGHT }).then((model) => {
    if (!model) return;
    for (const s of slots) {
      const tree = model.clone(true);
      // ⚠ SUNK 0.6 INTO THE GROUND. The prompt said "no ground, no base plinth"
      // and the generator gave it a flat grey disc anyway, which reads as every
      // tree standing on a dinner plate. Burying the disc is cheaper and safer
      // than editing the mesh, and a tree whose roots are slightly below the
      // surface is what a tree looks like.
      tree.position.set(s.x, -0.6, s.z);
      tree.rotation.y = s.turn;
      tree.scale.setScalar(s.scale);
      group.add(tree);
    }
    trunks.visible = false;
    canopies.visible = false;
  });

  // ── the brush ───────────────────────────────────────────────────────────
  const canopyMats: THREE.MeshStandardMaterial[] = [];
  for (const b of BRUSH) {
    const g = new THREE.Group();
    g.position.set(b.x, 0, b.z);

    // The ground inside a brush is darker, so it reads as somewhere shaded even
    // when the canopy above it is faded out.
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(b.radius, b.radius + 0.6, 0.3, 24),
      surfaceMaterial(0x2f4a2c, { roughness: 1 })
    );
    floor.position.y = 0.1;
    floor.receiveShadow = true;
    g.add(floor);

    const mat = new THREE.MeshStandardMaterial({
      color: 0x3f8f4a,
      roughness: 0.9,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    canopyMats.push(mat);
    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(b.radius * 1.05, 1), mat);
    canopy.scale.y = 0.42;
    canopy.position.y = 3.1;
    g.add(canopy);

    group.add(g);
  }

  return {
    group,
    update: (t) => {
      // A slow breathing opacity, so brush reads as foliage rather than as a
      // dome someone placed on the ground.
      for (const [i, m] of canopyMats.entries()) {
        m.opacity = 0.68 + Math.sin(t * 0.6 + i) * 0.06;
      }
    },
    dispose: () => {
      trunkGeo.dispose();
      canopyGeo.dispose();
      group.traverse((n) => {
        const m = n as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
    },
  };
}
