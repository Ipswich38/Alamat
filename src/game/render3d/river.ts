// The Pasig Agimat: Sunken, organic S-curve channel with depth, natural geometry,
// stylized PBR dual-scrolling water shader, mossy rocks, mangrove roots, lotus pads, and trough mist.
//
// ── ARCHITECTURE & REFACTOR HIGHLIGHTS ─────────────────────────────────────────
// 1. Spline-derived ribbon mesh (5 columns across, 240 steps along the S-curve).
// 2. Depth gradient: Deep Navy/Teal (#0F3846) at channel center, Shallow Cyan (#4ECDC4) at banks.
// 3. Dual-scrolling downstream surface animation (ripples flowing South-East).
// 4. White/cyan foam along riverbanks and bridge stilts.
// 5. Scattered mossy river stones, sharp slate boulders, and mangrove root arches.
// 6. 3D water lilies with lotus blossoms in quiet riverbends.
// 7. Volumetric ground mist (alpha 0.15) settled inside the trough.

import * as THREE from 'three';
import { RIVER_DEPTH, findCrossings, riverCentre } from '@/game/arena/river';
import { loadModel } from './models';
import { surfaceMaterial } from './stage';
import { terrainHeight } from './terrain';

/** Concept art color matching */
const COLOR_DEEP = new THREE.Color('#0F3846');
const COLOR_MID = new THREE.Color('#207D7E');
const COLOR_SHALLOW = new THREE.Color('#4ECDC4');

export interface River {
  group: THREE.Group;
  update(t: number): void;
  dispose(): void;
}

export function createRiver(): River {
  const group = new THREE.Group();
  group.name = 'river';

  const centre = riverCentre();
  const water = buildWater(centre);
  group.add(water.mesh);

  group.add(bankStonesAndBoulders(centre));
  group.add(mangroveRoots(centre));
  group.add(liliesAndLotuses(centre));
  group.add(troughMist(centre));

  // ── Bridges & Crossings ───────────────────────────────────────────────────
  const crossings = findCrossings();
  const fallbackDecks: THREE.Mesh[] = [];
  for (const c of crossings) {
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(9.2, 0.55, c.radius * 1.9),
      surfaceMaterial(0x7a5a36, { roughness: 0.92 })
    );
    deck.position.set(c.x, 0.75, c.z);
    deck.rotation.y = c.bearing;
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);
    fallbackDecks.push(deck);
  }

  loadModel('/models/props/bridge.glb', { width: 26 }).then((model) => {
    if (!model) return;
    for (const c of crossings) {
      const built = model.clone(true);
      built.position.set(c.x, 0, c.z);
      built.rotation.y = c.bearing + Math.PI / 2;
      group.add(built);
    }
    for (const d of fallbackDecks) d.visible = false;
  });

  return {
    group,
    update: (t) => water.setTime(t),
    dispose: () => {
      group.traverse((n) => {
        const m = n as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mat of mats) mat.dispose();
        }
      });
    },
  };
}

/**
 * Procedural water ribbon with 5 transverse columns across the S-curve.
 */
function buildWater(centre: readonly { x: number; z: number; s: number; half: number }[]) {
  const n = centre.length;
  // 5 columns across: -1.0 (left bank), -0.5 (left shallow), 0.0 (center deep), 0.5 (right shallow), 1.0 (right bank)
  const COLS = 5;
  const count = n * COLS;
  const positions = new Float32Array(count * 3);
  const across = new Float32Array(count);
  const along = new Float32Array(count);
  const colours = new Float32Array(count * 3);
  const c = new THREE.Color();

  const colOffsets = [-1.0, -0.5, 0.0, 0.5, 1.0];

  for (let i = 0; i < n; i++) {
    const a = centre[Math.max(0, i - 1)];
    const b = centre[Math.min(n - 1, i + 1)];
    const tx = b.x - a.x;
    const tz = b.z - a.z;
    const len = Math.hypot(tx, tz) || 1;
    // Perpendicular vector to tangent
    const px = -tz / len;
    const pz = tx / len;

    for (let k = 0; k < COLS; k++) {
      const uAcross = colOffsets[k];
      const idx = i * COLS + k;
      const x = centre[i].x + px * centre[i].half * uAcross;
      const z = centre[i].z + pz * centre[i].half * uAcross;

      positions[idx * 3] = x;
      // Water plane rests at -0.45 units below zero level, sitting inside the -2.5 depth trench
      positions[idx * 3 + 1] = -RIVER_DEPTH * 0.18;
      positions[idx * 3 + 2] = z;

      across[idx] = uAcross;
      along[idx] = centre[i].s;

      // Depth gradient based on distance from center
      const distRatio = Math.abs(uAcross);
      if (distRatio < 0.5) {
        c.copy(COLOR_DEEP).lerp(COLOR_MID, distRatio * 2);
      } else {
        c.copy(COLOR_MID).lerp(COLOR_SHALLOW, (distRatio - 0.5) * 2);
      }

      colours[idx * 3] = c.r;
      colours[idx * 3 + 1] = c.g;
      colours[idx * 3 + 2] = c.b;
    }
  }

  // 4 quads per step
  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < COLS - 1; k++) {
      const a = i * COLS + k;
      const b2 = a + COLS;
      index.push(a, a + 1, b2, a + 1, b2 + 1, b2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.setAttribute('across', new THREE.BufferAttribute(across, 1));
  geo.setAttribute('along', new THREE.BufferAttribute(along, 1));
  geo.setIndex(index);
  geo.computeVertexNormals();

  const uniforms = { uTime: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.12,
    metalness: 0.08,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        `attribute float across;
attribute float along;
varying float vAcross;
varying float vAlong;
void main() {`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
  vAcross = across;
  vAlong = along;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `uniform float uTime;
varying float vAcross;
varying float vAlong;
void main() {`
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
  // Dual-scrolling downstream ripple waves (flowing South-East along vAlong)
  float w1 = sin(vAlong * 0.48 - uTime * 2.4 + vAcross * 3.6);
  float w2 = sin(vAlong * 0.95 - uTime * 3.8 - vAcross * 2.8);
  float w3 = cos(vAlong * 0.26 - uTime * 1.5 + vAcross * 1.6);
  float ripple = (w1 * 0.5 + w2 * 0.35 + w3 * 0.15) * 0.5 + 0.5;

  // Surface light glint
  gl_FragColor.rgb += ripple * 0.095;

  // Foam lines where the water meets riverbanks and crossings
  float bankEdge = smoothstep(0.72, 0.99, abs(vAcross));
  float foamPulse = 0.78 + 0.22 * sin(vAlong * 1.6 - uTime * 4.2);
  vec3 foamColor = vec3(0.92, 0.99, 0.98);

  gl_FragColor.rgb = mix(gl_FragColor.rgb, foamColor, bankEdge * foamPulse * 0.65);
  gl_FragColor.a = mix(gl_FragColor.a, 0.92, bankEdge * 0.45);`
      );
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  mesh.name = 'water';
  return { mesh, setTime: (t: number) => (uniforms.uTime.value = t) };
}

/**
 * Scattered 3D mossy river stones and sharp slate boulders along banks.
 */
function bankStonesAndBoulders(centre: readonly { x: number; z: number; half: number }[]): THREE.Group {
  const g = new THREE.Group();

  // 1. Mossy rounded river stones
  const stoneGeo = new THREE.DodecahedronGeometry(0.75, 1);
  const STONE_COUNT = 240;
  const stoneMesh = new THREE.InstancedMesh(
    stoneGeo,
    surfaceMaterial(0x4d5b4a, { roughness: 0.92 }),
    STONE_COUNT
  );
  stoneMesh.receiveShadow = true;
  stoneMesh.castShadow = true;
  stoneMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(STONE_COUNT * 3), 3);

  // 2. Sharp slate boulders
  const slateGeo = new THREE.OctahedronGeometry(1.1, 0);
  slateGeo.scale(1.4, 0.7, 1.1);
  const SLATE_COUNT = 140;
  const slateMesh = new THREE.InstancedMesh(
    slateGeo,
    surfaceMaterial(0x353b3d, { roughness: 0.88, metalness: 0.12 }),
    SLATE_COUNT
  );
  slateMesh.receiveShadow = true;
  slateMesh.castShadow = true;
  slateMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SLATE_COUNT * 3), 3);

  const o = new THREE.Object3D();
  const c = new THREE.Color();
  const mossBase = new THREE.Color(0x4a5d48);
  const slateBase = new THREE.Color(0x323a3d);

  let nStone = 0;
  for (let i = 0; i < STONE_COUNT * 3 && nStone < STONE_COUNT; i++) {
    const seed = Math.sin(i * 91.7) * 43758.5453;
    const r1 = seed - Math.floor(seed);
    const seed2 = Math.sin(i * 47.3) * 43758.5453;
    const r2 = seed2 - Math.floor(seed2);

    const s = centre[Math.floor(r1 * (centre.length - 2)) + 1];
    const prev = centre[Math.max(0, Math.floor(r1 * (centre.length - 2)))];
    const tx = s.x - prev.x;
    const tz = s.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    const sign = r2 > 0.5 ? 1 : -1;
    const off = s.half * (0.95 + r2 * 0.45);
    const x = s.x + (-tz / len) * off * sign;
    const z = s.z + (tx / len) * off * sign;

    const scale = 0.45 + r2 * 1.1;
    o.position.set(x, terrainHeight(x, z) + scale * 0.18, z);
    o.rotation.set(r1 * 2.5, r2 * 6.28, r1 * 1.8);
    o.scale.set(scale, scale * (0.6 + r1 * 0.4), scale);
    o.updateMatrix();
    stoneMesh.setMatrixAt(nStone, o.matrix);
    c.copy(mossBase).offsetHSL(r1 * 0.08 - 0.04, r2 * 0.12, (r1 - 0.5) * 0.15);
    stoneMesh.setColorAt(nStone, c);
    nStone++;
  }
  stoneMesh.count = nStone;
  g.add(stoneMesh);

  let nSlate = 0;
  for (let i = 0; i < SLATE_COUNT * 3 && nSlate < SLATE_COUNT; i++) {
    const seed = Math.sin(i * 123.4) * 43758.5453;
    const r1 = seed - Math.floor(seed);
    const seed2 = Math.sin(i * 77.1) * 43758.5453;
    const r2 = seed2 - Math.floor(seed2);

    const s = centre[Math.floor(r1 * (centre.length - 2)) + 1];
    const prev = centre[Math.max(0, Math.floor(r1 * (centre.length - 2)))];
    const tx = s.x - prev.x;
    const tz = s.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    const sign = r2 > 0.5 ? 1 : -1;
    const off = s.half * (1.05 + r2 * 0.5);
    const x = s.x + (-tz / len) * off * sign;
    const z = s.z + (tx / len) * off * sign;

    const scale = 0.8 + r2 * 1.4;
    o.position.set(x, terrainHeight(x, z) + scale * 0.22, z);
    o.rotation.set(r1 * 1.8, r2 * 6.28, r2 * 1.2);
    o.scale.set(scale, scale * 0.8, scale * 1.2);
    o.updateMatrix();
    slateMesh.setMatrixAt(nSlate, o.matrix);
    c.copy(slateBase).offsetHSL(r1 * 0.06 - 0.03, 0.05, (r2 - 0.5) * 0.12);
    slateMesh.setColorAt(nSlate, c);
    nSlate++;
  }
  slateMesh.count = nSlate;
  g.add(slateMesh);

  return g;
}

/**
 * Mangrove root props along the water edge.
 */
function mangroveRoots(centre: readonly { x: number; z: number; half: number }[]): THREE.Group {
  const g = new THREE.Group();
  const rootGeo = new THREE.TorusGeometry(1.6, 0.28, 6, 12, Math.PI * 0.85);
  const COUNT = 45;
  const mesh = new THREE.InstancedMesh(
    rootGeo,
    surfaceMaterial(0x422f20, { roughness: 0.95 }),
    COUNT
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const o = new THREE.Object3D();
  let n = 0;
  for (let i = 0; i < COUNT * 3 && n < COUNT; i++) {
    const seed = Math.sin(i * 59.3) * 43758.5453;
    const r1 = seed - Math.floor(seed);
    const seed2 = Math.sin(i * 83.1) * 43758.5453;
    const r2 = seed2 - Math.floor(seed2);

    const s = centre[Math.floor(r1 * (centre.length - 2)) + 1];
    const prev = centre[Math.max(0, Math.floor(r1 * (centre.length - 2)))];
    const tx = s.x - prev.x;
    const tz = s.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    const sign = r2 > 0.5 ? 1 : -1;
    const off = s.half * 0.92;
    const x = s.x + (-tz / len) * off * sign;
    const z = s.z + (tx / len) * off * sign;

    const y = terrainHeight(x, z);
    o.position.set(x, y - 0.2, z);
    o.rotation.set(r1 * 0.8 + 0.3, r2 * 6.28, r1 * 0.5);
    o.scale.set(0.9 + r2 * 0.6, 0.9 + r2 * 0.6, 0.9 + r2 * 0.6);
    o.updateMatrix();
    mesh.setMatrixAt(n, o.matrix);
    n++;
  }
  mesh.count = n;
  g.add(mesh);
  return g;
}

/**
 * 3D Water lilies and lotus blossoms in quiet riverbends.
 */
function liliesAndLotuses(centre: readonly { x: number; z: number; half: number }[]): THREE.Group {
  const g = new THREE.Group();
  const crossings = findCrossings();

  // Lily pad geometry (notched circle)
  const padGeo = new THREE.CircleGeometry(0.92, 9, 0.25, Math.PI * 1.85);
  padGeo.rotateX(-Math.PI / 2);
  const COUNT = 110;
  const padMesh = new THREE.InstancedMesh(
    padGeo,
    surfaceMaterial(0x277a44, { roughness: 0.82 }),
    COUNT
  );
  padMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);

  // Lotus blossom geometry (multi-petal cone)
  const flowerGeo = new THREE.ConeGeometry(0.35, 0.45, 6);
  const FLOWER_COUNT = 36;
  const flowerMesh = new THREE.InstancedMesh(
    flowerGeo,
    new THREE.MeshStandardMaterial({
      color: 0xff8fa8,
      emissive: 0x4a1824,
      roughness: 0.4,
      toneMapped: false,
    }),
    FLOWER_COUNT
  );

  const o = new THREE.Object3D();
  const c = new THREE.Color();
  let nPad = 0;
  let nFlower = 0;

  for (let i = 0; i < COUNT * 4 && nPad < COUNT; i++) {
    const seed = Math.sin(i * 33.7) * 43758.5453;
    const r1 = seed - Math.floor(seed);
    const seed2 = Math.sin(i * 71.9) * 43758.5453;
    const r2 = seed2 - Math.floor(seed2);

    const s = centre[Math.floor(r1 * (centre.length - 2)) + 1];
    const prev = centre[Math.max(0, Math.floor(r1 * (centre.length - 2)))];
    const tx = s.x - prev.x;
    const tz = s.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    const off = (r2 * 2 - 1) * s.half * 0.72;
    const x = s.x + (-tz / len) * off;
    const z = s.z + (tx / len) * off;

    // Never at a ford/crossing
    if (crossings.some((cr) => Math.hypot(x - cr.x, z - cr.z) < cr.radius * 1.35)) continue;

    const waterY = -RIVER_DEPTH * 0.17;
    o.position.set(x, waterY, z);
    o.rotation.set(0, r1 * 6.28, 0);
    o.scale.setScalar(0.65 + r2 * 0.75);
    o.updateMatrix();
    padMesh.setMatrixAt(nPad, o.matrix);
    c.setHSL(0.31 + r1 * 0.07, 0.58, 0.26 + r2 * 0.14);
    padMesh.setColorAt(nPad, c);

    // Place a lotus blossom on a fraction of pads
    if (r1 > 0.68 && nFlower < FLOWER_COUNT) {
      const fo = new THREE.Object3D();
      fo.position.set(x, waterY + 0.22, z);
      fo.rotation.set(0.1, r2 * 6.28, 0);
      fo.scale.setScalar(0.85 + r1 * 0.4);
      fo.updateMatrix();
      flowerMesh.setMatrixAt(nFlower, fo.matrix);
      nFlower++;
    }

    nPad++;
  }

  padMesh.count = nPad;
  flowerMesh.count = nFlower;
  g.add(padMesh);
  g.add(flowerMesh);
  return g;
}

/**
 * Volumetric ground mist ribbon resting inside the riverbed trough (alpha 0.15).
 */
function troughMist(centre: readonly { x: number; z: number; half: number }[]): THREE.Mesh {
  const n = centre.length;
  const COLS = 3;
  const count = n * COLS;
  const positions = new Float32Array(count * 3);
  const alpha = new Float32Array(count);
  const along = new Float32Array(count);

  for (let i = 0; i < n; i++) {
    const a = centre[Math.max(0, i - 1)];
    const b = centre[Math.min(n - 1, i + 1)];
    const tx = b.x - a.x;
    const tz = b.z - a.z;
    const len = Math.hypot(tx, tz) || 1;
    const half = centre[i].half * 1.75;
    const ends = Math.min(1, Math.min(i, n - 1 - i) / 20);

    for (let k = 0; k < COLS; k++) {
      const sign = k - 1;
      const idx = i * COLS + k;
      positions[idx * 3] = centre[i].x + (-tz / len) * half * sign;
      // Resting inside the riverbed trough (-2.5u to 0u height range)
      positions[idx * 3 + 1] = -0.35;
      positions[idx * 3 + 2] = centre[i].z + (tx / len) * half * sign;
      alpha[idx] = (sign === 0 ? 0.25 : 0.0) * ends;
      along[idx] = (i / n) * 100;
    }
  }

  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < COLS - 1; k++) {
      const a = i * COLS + k;
      const b2 = a + COLS;
      index.push(a, a + 1, b2, a + 1, b2 + 1, b2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute('along', new THREE.BufferAttribute(along, 1));
  geo.setIndex(index);

  const uniforms = { uTime: { value: 0 } };
  const mat = new THREE.MeshBasicMaterial({
    color: 0x2c3e50, // Slate Blue (#2C3E50)
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        `attribute float alpha;
attribute float along;
varying float vA;
varying float vAlong;
void main() {`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
  vA = alpha;
  vAlong = along;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `uniform float uTime;
varying float vA;
varying float vAlong;
void main() {`
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
  // Noise-driven movement along flow vector
  float flow = 0.8 + 0.2 * sin(vAlong * 0.4 - uTime * 1.2);
  gl_FragColor.a *= vA * flow;`
      );
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 3;
  mesh.name = 'trough-mist';
  return mesh;
}
