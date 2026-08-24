// Grass and flowers: the mundane layer of the floor.
//
// ── WHY THIS IS NOT IN clutter.ts ───────────────────────────────────────────
// clutter.ts is the ENCHANTED layer: bioluminescent mushrooms, spirit motes,
// glowing runic shrines. This is the ordinary ground the magic sits on top of.
// Two jobs, two files. Merging them would push clutter past 500 lines and mix
// "things that glow on a timer" with "things that are simply there".
//
// ── WHERE THIS CAME FROM, AND WHAT HAD TO CHANGE ────────────────────────────
// The grass and flower scatterers were written for the old 20-unit duel arena
// in render3d/arena.ts, which has not been called by anything since the
// three-lane map replaced it. Three things made them unusable as they stood:
//
//   1. THEY SAT ON y = 0. The old arena floor was a flat box. This map has a
//      heightfield, so every instance is placed on terrainHeight() instead.
//   2. THEY WERE SIZED FOR A 1.75-UNIT HERO. arena.ts says so in its own
//      comment. HERO_SCALE was later raised to 2.2, so a hero now stands 3.85
//      units and that grass renders as moss. Every size here is therefore
//      derived FROM HERO_HEIGHT rather than typed in, so the next rescale
//      carries the floor with it instead of silently shrinking it.
//   3. THEY SCATTERED OVER ARENA_SIZE (20). The playable map is HALF (100),
//      twenty-five times the area, so the counts are set by density per square
//      unit rather than copied across.
//
// ── AND WHY IT IS ALL SEEDED ────────────────────────────────────────────────
// A hash, not Math.random. The floor must look identical every session and on
// every device. Same reason as everywhere else in this folder.

import * as THREE from 'three';
import { HERO_HEIGHT } from '@/game/heroes/metrics';
import { HALF, SANCTUARY_RADIUS, TEAMS } from '@/game/arena/nexus';
import { LANES, LANE_WIDTH, laneDistance } from '@/game/arena/lanes';
import { riverDepth } from '@/game/arena/river';
import { surfaceMaterial, type Quality } from './stage';
import { terrainHeight, volcanicStrength } from './terrain';

export interface GroundCover {
  group: THREE.Group;
  update(t: number): void;
  dispose(): void;
}

// ── the palette ──────────────────────────────────────────────────────────────
// ⚠ BOTH ENDS SIT ABOVE THE GROUND COLOUR, NEVER BELOW IT. Two earlier passes
// in the old arena failed the same way: tufts darker than the ground read as a
// nursery of pine seedlings scattered on a lawn. Grass tips catch the light.
// The terrain under this is MOSSY_GRASS (#2E7D32) blended toward JUNGLE_DEEP
// (#1B4D2E), so both of these are comfortably lighter than anything below.
const GRASS_DEEP = new THREE.Color(0x6cb04e);
const GRASS_LIGHT = new THREE.Color(0x93cf62);

/** The one element allowed to be a saturated non-green. */
const FLOWER_PALETTE = [0xf2c14e, 0xef767a, 0xf7f0d8, 0xe8a0bf, 0xffd9a0];

// ── sizes, all derived from the hero ─────────────────────────────────────────
/** Ankle height on a hero. Tall enough to read, short enough not to be cover. */
const BLADE_HEIGHT = HERO_HEIGHT * 0.1;
const BLADE_RADIUS = HERO_HEIGHT * 0.037;
const FLOWER_RADIUS = HERO_HEIGHT * 0.016;

// ── density, per square world unit ───────────────────────────────────────────
// Tuned against fog (fogNear 65, fogFar 145) and the orthographic view height
// range of 16 to 90 units: only a fraction of this is ever on screen at once,
// and all of it is one draw call per layer.
const GRASS_PER_UNIT2 = 0.34;
const FLOWERS_PER_UNIT2 = 0.024;

/** Deterministic 0..1 from an integer and a salt. */
function rand(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Distance from the nearest lane centre line. */
function laneGap(x: number, z: number): number {
  let best = Infinity;
  for (const lane of LANES) {
    const d = laneDistance(x, z, lane.path);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Can anything grow here?
 *
 * ⚠ ORDERED CHEAPEST TEST FIRST. This runs tens of thousands of times at load
 * and laneGap walks three lane paths, so the flat arithmetic rejections come
 * before it and terrainHeight is only paid for a point that survives.
 */
function plantable(x: number, z: number, clearance: number): boolean {
  // Nothing lush grows in the scorched North-West. The terrain there is
  // volcanic mud and basalt; grass on it would read as a texture error.
  if (volcanicStrength(x, z) > 0.22) return false;

  // Not on the paved sanctuary floors.
  for (const t of Object.values(TEAMS)) {
    if (Math.hypot(x - t.x, z - t.z) < SANCTUARY_RADIUS + 2) return false;
  }

  // Not in the river.
  if (riverDepth(x, z) > 0.1) return false;

  // Not on the worn dirt of a lane. The margin is what makes the lane read as
  // a PATH: grass stopping short of it is the thing that says people walk here.
  if (laneGap(x, z) < LANE_WIDTH / 2 + clearance) return false;

  return true;
}

export function buildGroundCover(quality: Quality = 'high'): GroundCover {
  const group = new THREE.Group();
  group.name = 'groundcover';

  // Low quality halves the scatter. Both layers are single draw calls, so this
  // is about vertex count and matrix upload on weak hardware, not draw calls.
  const density = quality === 'low' ? 0.5 : 1;
  const area = (HALF * 2) ** 2;

  const grass = buildGrass(Math.round(area * GRASS_PER_UNIT2 * density));
  const flowers = buildFlowers(Math.round(area * FLOWERS_PER_UNIT2 * density));

  group.add(grass.mesh, flowers);

  return {
    group,
    update: (t) => grass.update(t),
    dispose: () => {
      group.traverse((n) => {
        const m = n as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) mat.dispose();
      });
    },
  };
}

/**
 * The field. One geometry, one draw call, however many blades.
 *
 * ⚠ A THREE-BLADED SPRIG, NOT A CROSS-QUAD. A cut-out texture would need an
 * alpha edge, and at this camera angle a hard alpha edge on tens of thousands
 * of instances is the single most obvious tell that a floor was generated.
 */
function buildGrass(count: number): { mesh: THREE.InstancedMesh; update: (t: number) => void } {
  const blade = new THREE.ConeGeometry(BLADE_RADIUS, BLADE_HEIGHT, 3);
  // Base at y = 0 so the sway below can key off local height, and so an
  // instance sits ON the ground rather than half inside it.
  blade.translate(0, BLADE_HEIGHT / 2, 0);

  const mat = surfaceMaterial(GRASS_LIGHT.getHex(), { roughness: 1 });

  // ── the sway ───────────────────────────────────────────────────────────────
  // Phase comes from the instance's own world position, so the field ripples
  // across the map instead of every blade leaning in unison. Amplitude is keyed
  // to local height, which pins the base and moves only the tip.
  const uTime = { value: 0 };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'uniform float uTime;\nvoid main() {')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float gcPhase = instanceMatrix[3].x * 0.22 + instanceMatrix[3].z * 0.17;
        float gcTip = transformed.y / ${BLADE_HEIGHT.toFixed(4)};
        float gcSway = sin(uTime * 1.5 + gcPhase) * ${(BLADE_HEIGHT * 0.42).toFixed(4)} * gcTip;
        transformed.x += gcSway;
        transformed.z += gcSway * 0.55;`
      );
  };

  const mesh = new THREE.InstancedMesh(blade, mat, count);
  // Tens of thousands of shadow casters is the entire frame budget. The blades
  // are ankle high; nothing reads their shadow anyway.
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  mesh.name = 'grass';

  const o = new THREE.Object3D();
  const c = new THREE.Color();
  let n = 0;

  for (let i = 0; i < count * 4 && n < count; i++) {
    const x = (rand(i, 11) * 2 - 1) * (HALF - 2);
    const z = (rand(i, 12) * 2 - 1) * (HALF - 2);
    if (!plantable(x, z, 1)) continue;

    o.position.set(x, terrainHeight(x, z), z);
    o.rotation.set(rand(i, 13) * 0.22 - 0.11, rand(i, 14) * Math.PI * 2, rand(i, 15) * 0.22 - 0.11);
    o.scale.set(1, 0.7 + rand(i, 16) * 0.9, 1);
    o.updateMatrix();
    mesh.setMatrixAt(n, o.matrix);

    // Per-blade colour. Uniform green is the loudest tell that something was
    // generated rather than grown.
    c.copy(GRASS_DEEP).lerp(GRASS_LIGHT, rand(i, 17));
    mesh.setColorAt(n, c);
    n++;
  }

  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  return {
    mesh,
    update: (t) => {
      uTime.value = t;
    },
  };
}

/**
 * Small bright flowers.
 *
 * A field of nothing but greens reads as flat however well it is lit. A few
 * hundred warm specks give the eye something to catch on, and are most of what
 * makes a palette feel chosen rather than defaulted.
 */
function buildFlowers(count: number): THREE.InstancedMesh {
  const petal = new THREE.IcosahedronGeometry(FLOWER_RADIUS, 1);
  const mesh = new THREE.InstancedMesh(petal, surfaceMaterial(0xffffff, { roughness: 0.6 }), count);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.name = 'flowers';

  const o = new THREE.Object3D();
  const c = new THREE.Color();
  let n = 0;

  for (let i = 0; i < count * 4 && n < count; i++) {
    const x = (rand(i, 31) * 2 - 1) * (HALF - 2);
    const z = (rand(i, 32) * 2 - 1) * (HALF - 2);
    // Wider clearance than grass: a flower ON a path reads as litter.
    if (!plantable(x, z, 2.4)) continue;

    // Lifted to sit among the grass tips rather than down in the roots.
    o.position.set(x, terrainHeight(x, z) + BLADE_HEIGHT * (0.55 + rand(i, 33) * 0.5), z);
    o.rotation.set(rand(i, 34) * 3, rand(i, 35) * 3, 0);
    o.scale.setScalar(0.75 + rand(i, 36) * 0.6);
    o.updateMatrix();
    mesh.setMatrixAt(n, o.matrix);

    c.setHex(FLOWER_PALETTE[Math.floor(rand(i, 37) * FLOWER_PALETTE.length) % FLOWER_PALETTE.length]);
    mesh.setColorAt(n, c);
    n++;
  }

  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}
