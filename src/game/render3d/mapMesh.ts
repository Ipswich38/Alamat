// The map, built.
//
// ── ONE GROUND MESH, VERTEX COLOURED ────────────────────────────────────────
// The whole 116 by 116 floor is a single plane with a vertex colour per point,
// sampled from arena/map. That is one draw call for terrain that blends
// smoothly between celestial stone, jungle, lava rock and river, with no
// texture to download and no seams to hide. Painting it as separate meshes per
// surface would be more draw calls AND give hard edges where they meet.
//
// ── WHY THE COLOUR IS SAMPLED, NOT PAINTED ──────────────────────────────────
// `surfaceAt` is the map's truth and the collision reads the same function. If
// the renderer had its own idea of where a lane is, the two would drift, and
// the bug would show up as a player walking at lane speed across grass.

import * as THREE from 'three';
import {
  BASES,
  HALF,
  LANES,
  LANE_WIDTH,
  buildTowers,
  heightAt,
  laneDistance,
  realmAt,
  riverDepth,
} from '@/game/arena/map';
import { surfaceMaterial } from './stage';

// ── Kaluwalhatian, the celestial side ───────────────────────────────────────
const D_GRASS = new THREE.Color('#5fa84a');
const D_GRASS_LIGHT = new THREE.Color('#87c95e');
const D_STONE = new THREE.Color('#d8cba4');
const D_GOLD = new THREE.Color('#e8bd5a');

// ── Kasamaan, the underworld side ───────────────────────────────────────────
const A_ROCK = new THREE.Color('#2f2a30');
const A_ROCK_LIGHT = new THREE.Color('#4a4048');
const A_ASH = new THREE.Color('#5c4a48');
const A_LAVA = new THREE.Color('#ff5a1e');

// ── The seam ────────────────────────────────────────────────────────────────
const RIVER = new THREE.Color('#3fd0e0');
const RIVER_DEEP = new THREE.Color('#1c7fa8');

/** Deterministic 0..1, so the map is identical every session. */
function noise(x: number, z: number, salt: number): number {
  const n = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * The colour of the ground at a point.
 *
 * Layered rather than switched: the realm colour is laid down first, then the
 * lane paved over it, then the river over that. Each layer blends at its edge,
 * which is what stops the map looking like a diagram.
 */
function groundColour(x: number, z: number, out: THREE.Color): void {
  const realm = realmAt(x, z);
  const grain = noise(x * 0.35, z * 0.35, 1);

  if (realm === 'diwata') {
    out.copy(D_GRASS).lerp(D_GRASS_LIGHT, grain);
  } else {
    out.copy(A_ROCK).lerp(A_ROCK_LIGHT, grain);
    // ⚠ SEAMS, NOT SPOTS. A per-point hash above a threshold scatters isolated
    // dots, and the first version gave the whole underworld a rash of orange
    // freckles. A ridged function of position produces continuous CRACKS, which
    // is what lava in cooled rock actually looks like.
    const ridge = Math.abs(Math.sin(x * 0.16 + Math.cos(z * 0.11) * 2.2));
    if (ridge < 0.06) out.lerp(A_LAVA, (1 - ridge / 0.06) * 0.9);
  }

  // The lane, paved. Its own material on each side: worked stone on the
  // celestial half, packed ash on the volcanic one.
  let laneK = 0;
  for (const lane of LANES) {
    const d = laneDistance(x, z, lane.path);
    // Smoothstepped so the pavement has a soft shoulder rather than a kerb.
    const k = Math.max(0, 1 - d / (LANE_WIDTH / 2 + 1.5));
    if (k > laneK) laneK = k;
  }
  if (laneK > 0) {
    const paving = realm === 'diwata' ? D_STONE : A_ASH;
    out.lerp(paving, Math.min(1, laneK * 1.4) * 0.92);
  }

  // The river last, because it cuts everything.
  const river = riverDepth(x, z);
  if (river > 0) {
    out.lerp(RIVER_DEEP, Math.min(1, river * 1.6));
    out.lerp(RIVER, river * river * 0.7);
  }

  // The bases, gold or ember.
  for (const b of Object.values(BASES)) {
    const d = Math.hypot(x - b.x, z - b.z);
    if (d < b.radius + 2) {
      const k = Math.max(0, 1 - d / (b.radius + 2));
      out.lerp(b.realm === 'diwata' ? D_GOLD : A_LAVA, k * 0.85);
    }
  }
}

export interface GameMap {
  group: THREE.Group;
  dispose(): void;
}

export function buildMap(): GameMap {
  const group = new THREE.Group();
  group.name = 'map';

  // ── the floor ─────────────────────────────────────────────────────────────
  // 2 units per segment: fine enough that a 7-wide lane has three segments
  // across it and its edge reads as a curve, coarse enough that the whole map
  // is 13,000 triangles.
  const SEG = Math.round((HALF * 2) / 2);
  const geo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, SEG, SEG);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    groundColour(x, z, c);
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;

    // Real elevation, from the map's own heightfield. This is what separates a
    // place from a painted board.
    pos.setY(i, heightAt(x, z) + noise(x, z, 3) * 0.16);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();

  const floor = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0.02 })
  );
  floor.receiveShadow = true;
  group.add(floor);

  group.add(towers());
  group.add(fountains());

  return {
    group,
    dispose: () => {
      geo.dispose();
      group.traverse((n) => {
        const m = n as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
    },
  };
}

/**
 * The towers, as instanced stacks.
 *
 * Two instanced meshes for eighteen towers rather than eighteen groups: they
 * are identical apart from colour and height, which is exactly what instancing
 * is for.
 */
function towers(): THREE.Group {
  const g = new THREE.Group();
  const list = buildTowers();

  const baseGeo = new THREE.CylinderGeometry(2.1, 2.6, 1.4, 8);
  const shaftGeo = new THREE.CylinderGeometry(1.15, 1.55, 6, 8);
  const crownGeo = new THREE.IcosahedronGeometry(1.5, 1);

  const bases = new THREE.InstancedMesh(baseGeo, surfaceMaterial(0xffffff, { roughness: 0.9 }), list.length);
  const shafts = new THREE.InstancedMesh(shaftGeo, surfaceMaterial(0xffffff, { roughness: 0.85 }), list.length);
  const crowns = new THREE.InstancedMesh(
    crownGeo,
    // Unlit and bright: the crown is the tower's eye and has to trip the bloom.
    new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    list.length
  );
  for (const m of [bases, shafts, crowns]) {
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
    m.castShadow = true;
    m.receiveShadow = true;
  }

  const o = new THREE.Object3D();
  const col = new THREE.Color();
  list.forEach((t, i) => {
    // Later tiers stand taller, so how deep you are in enemy ground is legible
    // from the skyline.
    const h = 0.85 + t.tier * 0.18;
    const g0 = heightAt(t.x, t.z);
    o.position.set(t.x, g0 + 0.7, t.z);
    o.scale.set(1, 1, 1);
    o.updateMatrix();
    bases.setMatrixAt(i, o.matrix);
    o.position.set(t.x, g0 + 1.4 + 3 * h, t.z);
    o.scale.set(1, h, 1);
    o.updateMatrix();
    shafts.setMatrixAt(i, o.matrix);
    o.position.set(t.x, g0 + 1.4 + 6 * h + 1.1, t.z);
    o.scale.set(1, 1, 1);
    o.updateMatrix();
    crowns.setMatrixAt(i, o.matrix);

    const stone = t.realm === 'diwata' ? 0xd8cba4 : 0x342e36;
    const eye = t.realm === 'diwata' ? 0x9fe8ff : 0xff5a1e;
    bases.setColorAt(i, col.setHex(stone));
    shafts.setColorAt(i, col.setHex(stone));
    crowns.setColorAt(i, col.setHex(eye));
  });

  g.add(bases, shafts, crowns);
  return g;
}

/** The two cores. The thing you are trying to break. */
function fountains(): THREE.Group {
  const g = new THREE.Group();
  for (const b of Object.values(BASES)) {
    const dais = new THREE.Mesh(
      new THREE.CylinderGeometry(b.radius * 0.55, b.radius * 0.7, 1.6, 12),
      surfaceMaterial(b.realm === 'diwata' ? 0xe8dcb4 : 0x2a252c, { roughness: 0.8 })
    );
    const gb = heightAt(b.x, b.z);
    dais.position.set(b.x, gb + 0.8, b.z);
    dais.castShadow = true;
    dais.receiveShadow = true;
    g.add(dais);

    // The core itself: a floating shard, unlit so it blooms.
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.2, 0),
      new THREE.MeshBasicMaterial({
        color: b.realm === 'diwata' ? 0x9fe8ff : 0xff6a2a,
        toneMapped: false,
      })
    );
    core.position.set(b.x, gb + 4.4, b.z);
    core.name = `core:${b.realm}`;
    g.add(core);
  }
  return g;
}
