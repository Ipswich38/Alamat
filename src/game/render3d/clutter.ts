// Ground clutter: the small things that stop grass reading as a bedsheet.
//
// ── WHY THIS IS WORTH A FILE ────────────────────────────────────────────────
// A large flat surface of one colour is the loudest "unfinished" signal a 3D
// scene can send, and no amount of lighting fixes it, because the problem is
// that the eye has nothing to measure distance or motion against. Scattering a
// few thousand small objects gives it both, and instancing makes the whole lot
// cost four draw calls.
//
// ── AND WHY IT KEEPS OFF THE LANES ──────────────────────────────────────────
// Clutter belongs at the EDGE of a road, never on it. A lane has to stay a
// clean readable surface: it is where fights happen, where skillshots are
// aimed, and where a stray rock reads as something that might block a spell.

import * as THREE from 'three';
import { HALF } from '@/game/arena/nexus';
import { LANES, LANE_WIDTH, laneDistance } from '@/game/arena/lanes';
import { RIVER_WIDTH, riverDepth } from '@/game/arena/river';
import { terrainHeight } from './terrain';
import { surfaceMaterial } from './stage';

/** Deterministic 0..1 from an index and a salt. The scatter never reshuffles. */
function rand(i: number, salt: number): number {
  const n = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return n - Math.floor(n);
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

export function buildClutter(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'clutter';

  // Four kinds, each instanced once. Numbers tuned so the ground is busy near
  // the lanes and quiet in the open, which is where a player is looking.
  // ⚠ FEWER, DARKER, MOSSIER. At 620 pale grey rocks the ground read as
  // gravelled rather than grassy, and a uniform colour made them look like
  // debris someone dropped rather than stone that grew there.
  group.add(scatter('rock', 300, 0.4, 1.0, 0x4a5a44, 1));
  group.add(scatter('fern', 1100, 0.45, 1.0, 0x357f42, 2));
  group.add(scatter('log', 90, 0.8, 1.3, 0x4a3526, 3));
  group.add(mushrooms(340));

  return group;
}

function scatter(
  kind: 'rock' | 'fern' | 'log',
  count: number,
  minScale: number,
  maxScale: number,
  colour: number,
  salt: number
): THREE.InstancedMesh {
  const geo =
    kind === 'rock'
      ? new THREE.DodecahedronGeometry(0.6, 0)
      : kind === 'fern'
        ? new THREE.IcosahedronGeometry(0.5, 0)
        : new THREE.CylinderGeometry(0.32, 0.38, 3.2, 6);

  const mesh = new THREE.InstancedMesh(
    geo,
    surfaceMaterial(colour, { roughness: kind === 'rock' ? 0.9 : 1 }),
    count
  );
  // Clutter receives shadow and does not cast it. Hundreds of shadow casters is
  // the entire frame budget, and nobody has ever noticed a fern's shadow.
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);

  const o = new THREE.Object3D();
  const c = new THREE.Color();
  const base = new THREE.Color(colour);
  let n = 0;
  for (let i = 0; i < count * 6 && n < count; i++) {
    const x = (rand(i, salt) * 2 - 1) * (HALF - 2);
    const z = (rand(i, salt + 40) * 2 - 1) * (HALF - 2);

    // Never on a lane, and never in the water.
    const gap = laneGap(x, z);
    if (gap < LANE_WIDTH / 2 + 1.5) continue;
    if (riverDepth(x, z) > 0.15) continue;
    // Thinned out far from any lane, so the busy ground is where players are.
    if (gap > 34 && rand(i, salt + 90) > 0.35) continue;

    const s = minScale + rand(i, salt + 7) * (maxScale - minScale);
    o.position.set(x, terrainHeight(x, z) + (kind === 'log' ? 0.3 : s * 0.3), z);
    o.rotation.set(
      kind === 'log' ? Math.PI / 2 : rand(i, salt + 11) * 0.5,
      rand(i, salt + 13) * Math.PI * 2,
      kind === 'log' ? rand(i, salt + 17) * 0.3 : rand(i, salt + 19) * 0.5
    );
    o.scale.set(s, kind === 'fern' ? s * 0.6 : s, s);
    o.updateMatrix();
    mesh.setMatrixAt(n, o.matrix);
    // Per-instance colour variation. Uniform colour is the other loud tell.
    c.copy(base).offsetHSL((rand(i, salt + 29) - 0.5) * 0.06, 0, (rand(i, salt + 23) - 0.5) * 0.26);
    mesh.setColorAt(n, c);
    n++;
  }
  mesh.count = n;
  return mesh;
}

/**
 * Glowing mushrooms. The one piece of clutter that is unlit and bright.
 *
 * They are the only warm-cool break in a field of green, and being above the
 * bloom threshold is what makes them read as light rather than as pale dots.
 */
function mushrooms(count: number): THREE.InstancedMesh {
  const geo = new THREE.SphereGeometry(0.19, 6, 5);
  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.MeshBasicMaterial({ color: 0x9ffff0, toneMapped: false }),
    count
  );
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);

  const o = new THREE.Object3D();
  const c = new THREE.Color();
  let n = 0;
  for (let i = 0; i < count * 8 && n < count; i++) {
    const x = (rand(i, 71) * 2 - 1) * (HALF - 2);
    const z = (rand(i, 97) * 2 - 1) * (HALF - 2);
    const gap = laneGap(x, z);
    if (gap < LANE_WIDTH / 2 + 2) continue;
    if (riverDepth(x, z) > 0.2) continue;
    // Clustered: mushrooms grow in patches, and evenly spread glowing dots read
    // as a starfield lying on the grass.
    if (rand(i, 113) > 0.42) continue;

    const s = 0.7 + rand(i, 131) * 0.9;
    o.position.set(x, terrainHeight(x, z) + 0.2, z);
    o.rotation.set(0, 0, 0);
    o.scale.setScalar(s);
    o.updateMatrix();
    mesh.setMatrixAt(n, o.matrix);
    c.setHSL(0.45 + rand(i, 149) * 0.12, 0.9, 0.72);
    mesh.setColorAt(n, c);
    n++;
  }
  mesh.count = n;
  return mesh;
}

/**
 * A low mist that hugs the ground, thickest over the river.
 *
 * ⚠ NOT REAL HEIGHT FOG. three.js fog is distance-based, and a true height fog
 * means patching the fog chunk of every material in the scene. This is two
 * translucent planes lying just above the ground, which from a camera looking
 * down gives the same reading for a fraction of the work and none of the risk.
 */
export function buildGroundMist(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'mist';

  // ⚠ IT MUST FADE AT ITS OWN EDGES. Three attempts, three different wrongs.
  // Two full-map planes greyed the whole arena. Confining them to the river
  // fixed the wash and produced a translucent RECTANGLE lying across the scene
  // with visible hard borders, which is worse, because a hard edge on fog is
  // the one thing fog can never have.
  //
  // So the alpha is per-vertex: full in the middle of the band, zero at every
  // edge. Same technique the water uses, and the only way a finite plane can
  // pretend to be atmosphere.
  const length = HALF * 2.6;
  for (const [y, peak, width] of [
    // ⚠ FAINT. At 0.20 the mist bleached the river it was meant to soften, so
    // the water read as a white strip rather than as water under haze. Mist is
    // supposed to be noticed only when you look for it.
    [1.0, 0.085, RIVER_WIDTH * 2.6],
    [2.4, 0.05, RIVER_WIDTH * 4.2],
  ] as [number, number, number][]) {
    const geo = new THREE.PlaneGeometry(length, width, 40, 12);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const alpha = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      // Normalised distance from the centre on each axis, then eased, so the
      // sheet has no boundary anywhere.
      const u = Math.abs(pos.getX(i)) / (length / 2);
      const v = Math.abs(pos.getZ(i)) / (width / 2);
      const fade = (1 - u * u) * (1 - v * v);
      alpha[i] = Math.max(0, fade);
    }
    geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));

    const mat = new THREE.MeshBasicMaterial({
      color: 0xdff2ee,
      transparent: true,
      opacity: peak,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'attribute float alpha;\nvarying float vA;\nvoid main() {')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vA = alpha;');
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'varying float vA;\nvoid main() {')
        .replace(
          '#include <dithering_fragment>',
          '#include <dithering_fragment>\n  gl_FragColor.a *= vA;'
        );
    };

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = y;
    // Turned onto the river's own diagonal, which runs along x = z.
    mesh.rotation.y = -Math.PI / 4;
    mesh.renderOrder = 2;
    g.add(mesh);
  }

  return g;
}
