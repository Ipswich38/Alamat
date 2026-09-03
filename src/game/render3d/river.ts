// The the Sacred River Talisman: Sunken, organic S-curve channel with depth, natural geometry,
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
import { type Crossing, DECK_HEIGHT, RIVER_DEPTH, findCrossings, riverCentre } from '@/game/arena/river';
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

  // ── Bakunawa Whirlpool Pit (Center River Swirl) ───────────────────────────
  const whirlpool = buildBakunawaWhirlpool();
  group.add(whirlpool.group);

  // ── Bridges & Crossings ───────────────────────────────────────────────────
  const crossings = findCrossings();
  for (const c of crossings) {
    group.add(buildBridgeStructure(c));
  }

  return {
    group,
    update: (t) => {
      water.setTime(t);
      whirlpool.update(t);
    },
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

      // Add vertical variation for more realistic water surface
      // Center of river is deeper, edges are shallower with gentle slopes
      const baseDepth = -RIVER_DEPTH * 0.18;
      const depthVariation = Math.abs(uAcross) * RIVER_DEPTH * 0.08; // Shallower at edges
      const waveOffset = Math.sin(centre[i].s * 0.3 + uAcross * 2.0) * 0.05; // Subtle wave pattern
      
      positions[idx * 3] = x;
      // Water plane with depth variation: deeper in center, shallower at banks
      positions[idx * 3 + 1] = baseDepth + depthVariation + waveOffset;
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
    roughness: 0.08, // Smoother water surface
    metalness: 0.12, // Slightly more metallic for better reflections
    transparent: true,
    opacity: 0.85, // More opaque for better depth perception
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 1.2, // Stronger environment reflections
    // reflectivity and refractionRatio are not standard MeshStandardMaterial props
    // but we achieve similar effects through the shader
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
  // ==== ENHANCED RIVER SHADER ====
  
  // Depth-based color variation - deeper areas are darker and more blue-green
  float depthFactor = smoothstep(-0.1, 0.1, vAcross);
  vec3 baseColor = gl_FragColor.rgb;
  
  // Subsurface scattering - light penetrates water, creating depth
  float subsurface = smoothstep(0.0, 0.6, depthFactor) * 0.3;
  baseColor += vec3(0.1, 0.2, 0.4) * subsurface * gl_FragColor.a;
  
  // Enhanced dual-scrolling downstream ripple waves
  float w1 = sin(vAlong * 0.48 - uTime * 2.4 + vAcross * 3.6);
  float w2 = sin(vAlong * 0.95 - uTime * 3.8 - vAcross * 2.8);
  float w3 = cos(vAlong * 0.26 - uTime * 1.5 + vAcross * 1.6);
  float ripple = (w1 * 0.5 + w2 * 0.35 + w3 * 0.15) * 0.5 + 0.5;

  // More pronounced caustics (light patterns on water bottom)
  float causticIntensity = 0.18;
  baseColor += vec3(0.8, 0.9, 1.0) * ripple * causticIntensity * (1.0 - depthFactor);

  // Fresnel effect - edges appear more reflective like real water
  float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 2.0);
  baseColor += vec3(0.6, 0.8, 1.0) * fresnel * 0.25 * gl_FragColor.a;

  // Foam lines where the water meets riverbanks and crossings
  float bankEdge = smoothstep(0.72, 0.99, abs(vAcross));
  float foamPulse = 0.78 + 0.22 * sin(vAlong * 1.6 - uTime * 4.2);
  vec3 foamColor = vec3(0.92, 0.99, 0.98);

  baseColor = mix(baseColor, foamColor, bankEdge * foamPulse * 0.65);
  
  gl_FragColor.rgb = baseColor;
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

/**
 * Procedural authentic pre-colonial timber & bamboo bridge, perfectly level with bank terrain.
 */
function buildBridgeStructure(c: Crossing): THREE.Group {
  const g = new THREE.Group();
  g.name = `bridge-${c.lane}`;
  g.position.set(c.x, 0, c.z);
  g.rotation.y = c.bearing;

  const woodMat = surfaceMaterial(0x6b4a28, { roughness: 0.88 });
  const darkWoodMat = surfaceMaterial(0x3e2815, { roughness: 0.94 });
  const bambooMat = surfaceMaterial(0x8a7243, { roughness: 0.72 });
  const okirGoldMat = surfaceMaterial(0xb58b38, { roughness: 0.55, metalness: 0.2 });

  const deckWidth = c.halfWidth * 2 - 0.4;
  const deckSpan = c.span * 0.72;
  const rampSpan = c.span * 0.16;

  // 1. Central Flat Deck (top exactly at DECK_HEIGHT)
  const deckGeo = new THREE.BoxGeometry(deckWidth, 0.22, deckSpan);
  const deck = new THREE.Mesh(deckGeo, woodMat);
  deck.position.set(0, DECK_HEIGHT - 0.11, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);

  // Planks
  const PLANK_COUNT = 18;
  for (let i = 0; i < PLANK_COUNT; i++) {
    const pz = -deckSpan / 2 + (i / (PLANK_COUNT - 1)) * deckSpan;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(deckWidth, 0.04, 0.12), darkWoodMat);
    plank.position.set(0, DECK_HEIGHT + 0.01, pz);
    plank.receiveShadow = true;
    g.add(plank);
  }

  // 2. Approach Ramps (Tapering from DECK_HEIGHT down to 0 at the bank edges)
  for (const sign of [-1, 1]) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(deckWidth, 0.18, rampSpan), woodMat);
    ramp.position.set(0, (DECK_HEIGHT - 0.09) * 0.5, sign * (deckSpan / 2 + rampSpan / 2));
    ramp.rotation.x = -sign * 0.07;
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    g.add(ramp);
  }

  // 3. Side Railings (along left and right edges, leaving the center corridor completely open)
  const railX = deckWidth / 2 - 0.22;
  const railHeight = 0.95;
  const POSTS = 7;
  for (const side of [-1, 1]) {
    const x = side * railX;

    // Top Handrail
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, c.span * 0.96), bambooMat);
    topRail.position.set(x, DECK_HEIGHT + railHeight, 0);
    topRail.castShadow = true;
    g.add(topRail);

    // Mid Rail
    const midRail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, c.span * 0.92), darkWoodMat);
    midRail.position.set(x, DECK_HEIGHT + railHeight * 0.48, 0);
    g.add(midRail);

    // Carved Okir Balustrade Panel
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.08, railHeight * 0.36, c.span * 0.88), okirGoldMat);
    panel.position.set(x, DECK_HEIGHT + railHeight * 0.48, 0);
    g.add(panel);

    // Posts along the rail
    for (let p = 0; p < POSTS; p++) {
      const pz = -c.span * 0.46 + (p / (POSTS - 1)) * c.span * 0.92;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, railHeight + 0.3, 6), darkWoodMat);
      post.position.set(x, DECK_HEIGHT + railHeight * 0.5, pz);
      post.castShadow = true;
      g.add(post);

      // Corner Lanterns
      if (p === 0 || p === POSTS - 1) {
        const lantern = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xffb84d, toneMapped: false })
        );
        lantern.position.set(x, DECK_HEIGHT + railHeight + 0.32, pz);
        g.add(lantern);
      }
    }
  }

  // 4. Stilt Support Pylons (into riverbed)
  const STILT_PAIRS = 4;
  for (let s = 0; s < STILT_PAIRS; s++) {
    const sz = -c.span * 0.32 + (s / (STILT_PAIRS - 1)) * c.span * 0.64;
    for (const side of [-1, 1]) {
      const sx = side * (deckWidth * 0.4);
      const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 2.4, 7), darkWoodMat);
      stilt.position.set(sx, -0.85, sz);
      stilt.castShadow = true;
      stilt.receiveShadow = true;
      g.add(stilt);
    }
    const brace = new THREE.Mesh(new THREE.BoxGeometry(deckWidth * 0.85, 0.18, 0.18), darkWoodMat);
    brace.position.set(0, -0.45, sz);
    g.add(brace);
  }

  return g;
}

/**
 * Bakunawa Whirlpool Pit:
 * Swirling animated vortex in the central river basin with foam spray particles.
 */
function buildBakunawaWhirlpool(): { group: THREE.Group; update: (t: number) => void } {
  const group = new THREE.Group();
  group.name = 'bakunawa-whirlpool';
  group.position.set(0, -0.42, 0);

  // 1. Swirling Water Rings
  const ringGeo1 = new THREE.RingGeometry(3.5, 9.5, 32);
  ringGeo1.rotateX(-Math.PI / 2);
  const ringMat1 = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
  group.add(ring1);

  const ringGeo2 = new THREE.RingGeometry(1.2, 5.2, 28);
  ringGeo2.rotateX(-Math.PI / 2);
  const ringMat2 = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
  ring2.position.y = -0.06;
  group.add(ring2);

  const coreGeo = new THREE.CircleGeometry(1.4, 24);
  coreGeo.rotateX(-Math.PI / 2);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x071e28,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.y = -0.12;
  group.add(core);

  // 2. Whirlpool Water Foam Spray Particles
  const FOAM_COUNT = 32;
  const foamGeo = new THREE.BufferGeometry();
  const foamPos = new Float32Array(FOAM_COUNT * 3);
  const foamData: { angle: number; radius: number; speed: number; y: number }[] = [];

  for (let i = 0; i < FOAM_COUNT; i++) {
    const a = (i / FOAM_COUNT) * Math.PI * 2;
    const r = 2.5 + ((i * 13) % 6);
    foamPos[i * 3] = Math.cos(a) * r;
    foamPos[i * 3 + 1] = 0.1 + (i % 3) * 0.12;
    foamPos[i * 3 + 2] = Math.sin(a) * r;
    foamData.push({ angle: a, radius: r, speed: 1.8 + (i % 3) * 0.8, y: foamPos[i * 3 + 1] });
  }
  foamGeo.setAttribute('position', new THREE.BufferAttribute(foamPos, 3));

  const foamParticles = new THREE.Points(
    foamGeo,
    new THREE.PointsMaterial({
      color: 0xccfbf1,
      size: 0.55,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      toneMapped: false,
    })
  );
  group.add(foamParticles);

  return {
    group,
    update: (t) => {
      ring1.rotation.y = t * 1.6;
      ring2.rotation.y = -t * 2.4;
      ringMat1.opacity = 0.45 + Math.sin(t * 2.8) * 0.15;
      ringMat2.opacity = 0.55 + Math.cos(t * 3.2) * 0.15;

      const pAttr = foamGeo.attributes.position;
      for (let i = 0; i < FOAM_COUNT; i++) {
        const d = foamData[i];
        d.angle += d.speed * 0.04;
        d.radius -= 0.025;
        if (d.radius < 1.2) {
          d.radius = 7.5 + (i % 3);
        }
        pAttr.setXYZ(i, Math.cos(d.angle) * d.radius, d.y + Math.sin(t * 4 + i) * 0.08, Math.sin(d.angle) * d.radius);
      }
      pAttr.needsUpdate = true;
    },
  };
}
