// The jungle, drawn: tree lines that stop you, canopies that hide you,
// and charred, ember-glowing trees with obsidian rock spires in the North-West Mayon volcanic zone.

import * as THREE from 'three';
import { BARRIERS, BRUSH } from '@/game/arena/jungle';
import { loadModel } from './models';
import { surfaceMaterial } from './stage';
import { terrainHeight } from './terrain';

/** Spacing between trees along a barrier, in world units. */
const TREE_STEP = 3.5;
/** How tall a balete stands. */
const TREE_HEIGHT = 13;

export interface Jungle {
  group: THREE.Group;
  update(t: number): void;
  dispose(): void;
}

export function createJungle(): Jungle {
  const group = new THREE.Group();
  group.name = 'jungle';

  const slots: { x: number; z: number; turn: number; scale: number; isVolcanic: boolean }[] = [];
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
      if (b.gap > 0 && Math.hypot(x - mid[0], z - mid[1]) < b.gap) continue;

      const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
      const j = (n - Math.floor(n)) * 2 - 1;
      const perp = [-dz / len, dx / len];
      const posX = x + perp[0] * j * 1.8;
      const posZ = z + perp[1] * j * 1.8;

      slots.push({
        x: posX,
        z: posZ,
        turn: j * Math.PI,
        scale: 0.82 + Math.abs(j) * 0.4,
        isVolcanic: posX < -10 && posZ < -10,
      });
    }
  }

  // 1. Procedural tree meshes with volcanic material distinction
  const trunkGeo = new THREE.CylinderGeometry(1.1, 1.8, TREE_HEIGHT * 0.55, 7);
  const canopyGeo = new THREE.IcosahedronGeometry(4.4, 1);

  const trunks = new THREE.InstancedMesh(
    trunkGeo,
    surfaceMaterial(0x5b4433, { roughness: 0.95 }),
    slots.length
  );
  trunks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(slots.length * 3), 3);

  const canopies = new THREE.InstancedMesh(
    canopyGeo,
    surfaceMaterial(0x2f7d4f, { roughness: 0.9 }),
    slots.length
  );
  canopies.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(slots.length * 3), 3);

  for (const m of [trunks, canopies]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'tree-placeholder';
  }

  const o = new THREE.Object3D();
  const cTrunk = new THREE.Color();
  const cCanopy = new THREE.Color();

  slots.forEach((s, i) => {
    o.position.set(s.x, terrainHeight(s.x, s.z) + (TREE_HEIGHT * 0.55) / 2, s.z);
    o.rotation.set(0, s.turn, 0);
    o.scale.setScalar(s.scale);
    o.updateMatrix();
    trunks.setMatrixAt(i, o.matrix);

    o.position.set(s.x, terrainHeight(s.x, s.z) + TREE_HEIGHT * 0.72, s.z);
    o.updateMatrix();
    canopies.setMatrixAt(i, o.matrix);

    if (s.isVolcanic) {
      cTrunk.set('#1E1715'); // Charred charcoal trunk
      cCanopy.set('#3D1F1A'); // Scorched ember foliage
    } else {
      cTrunk.set('#5b4433');
      cCanopy.set('#2f7d4f');
    }
    trunks.setColorAt(i, cTrunk);
    canopies.setColorAt(i, cCanopy);
  });
  group.add(trunks, canopies);

  // 2. Obsidian rock spires in the NW volcanic zone
  const spires = buildObsidianSpires();
  group.add(spires);

  // 3. Loaded balete model with volcanic styling
  loadModel('/models/nature/balete.glb', { height: TREE_HEIGHT }).then((model) => {
    if (!model) return;
    for (const s of slots) {
      const tree = model.clone(true);
      tree.position.set(s.x, terrainHeight(s.x, s.z) - 0.6, s.z);
      tree.rotation.y = s.turn;
      tree.scale.setScalar(s.scale);

      if (s.isVolcanic) {
        tree.traverse((n) => {
          const m = n as THREE.Mesh;
          if (!m.isMesh) return;
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mat of mats) {
            const std = mat as THREE.MeshStandardMaterial;
            if (std.color) std.color.set('#261C19');
            std.roughness = 0.96;
            std.emissive = new THREE.Color('#3A1208');
            std.emissiveIntensity = 0.45;
          }
        });
      }
      group.add(tree);
    }
    trunks.visible = false;
    canopies.visible = false;
  });

  // 4. Brush / concealment canopies
  const canopyMats: THREE.MeshStandardMaterial[] = [];
  for (const b of BRUSH) {
    const g = new THREE.Group();
    g.position.set(b.x, 0, b.z);
    const isNW = b.x < -10 && b.z < -10;

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(b.radius, b.radius + 0.6, 0.3, 24),
      surfaceMaterial(isNW ? 0x221a18 : 0x2f4a2c, { roughness: 1 })
    );
    floor.position.y = 0.1;
    floor.receiveShadow = true;
    g.add(floor);

    const mat = new THREE.MeshStandardMaterial({
      color: isNW ? 0x48241c : 0x3f8f4a,
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

/**
 * Jagged obsidian rock spires scattered throughout the NW volcanic jungle.
 */
function buildObsidianSpires(): THREE.Group {
  const g = new THREE.Group();
  const COUNT = 22;
  const geo = new THREE.ConeGeometry(1.6, 7.5, 5);
  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: 0x161312,
      roughness: 0.25,
      metalness: 0.85,
    }),
    COUNT
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const o = new THREE.Object3D();
  let n = 0;
  for (let i = 0; i < COUNT; i++) {
    const a = (i / COUNT) * Math.PI * 1.5 - Math.PI * 0.25;
    const r = 32 + (i % 5) * 10;
    const x = -85 + Math.cos(a) * r;
    const z = -85 + Math.sin(a) * r;
    if (x > -15 || z > -15) continue;

    const y = terrainHeight(x, z);
    o.position.set(x, y + 2.8, z);
    o.rotation.set(0.2 * (i % 3 - 1), i * 1.4, 0.15 * (i % 2));
    o.scale.setScalar(0.75 + (i % 4) * 0.35);
    o.updateMatrix();
    mesh.setMatrixAt(n, o.matrix);
    n++;
  }
  mesh.count = n;
  g.add(mesh);
  return g;
}
