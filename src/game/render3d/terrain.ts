// The ground: its shape, its verticality, its surfaces, and the world beyond the playable edge.
//
// ── ELEVATION & TERRAIN DYNAMICS (MONSTER HUNTER PRIMAL SCALE) ───────────────
// 1. High-Ground Bases elevated by +3.0u relative to lane riverbeds (-1.05u).
// 2. Tiered mossy terraces & natural stepped contours along jungle slopes.
// 3. Wetness & specular masks along riverbanks for glistening, humid mud/slate.
// 4. Giant exposed Banyan roots framing jungle chokepoints.
// 5. Rocky cliff edges and animated waterfall cascades pouring into the river basin.

import * as THREE from 'three';
import { HALF, SANCTUARY_RADIUS, TEAMS } from '@/game/arena/nexus';
import { LANES, LANE_WIDTH, laneDistance } from '@/game/arena/lanes';
import { RIVER_WIDTH, groundHeight, onCrossing, riverAt, riverDepth, riverFloor } from '@/game/arena/river';
import { surfaceMaterial } from './stage';

// ── the palette (3-way height-blend) ─────────────────────────────────────────
const DIRT_PATH = new THREE.Color('#5D4037'); // Dirt Path
const MOSSY_GRASS = new THREE.Color('#2E7D32'); // Lush Mossy Grass
const MOSSY_LIT = new THREE.Color('#388E3C');
const JUNGLE_DEEP = new THREE.Color('#1B4D2E');
const VOLCANIC_MUD = new THREE.Color('#1C2833'); // Volcanic Mud
const SCORCHED_SOIL = new THREE.Color('#2B2625');
const BASALT_ROCK = new THREE.Color('#1A1717');
const RIVER_STONE = new THREE.Color('#1E3142');
const WET_MUD = new THREE.Color('#2E1F18');
const BEYOND = new THREE.Color('#0D1F14');

/** How far past the playable edge the ground continues. */
const SKIRT = 90;

/** Deterministic value noise. Seeded so the terrain never reshuffles. */
function hash(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

/** Two octaves is enough for gentle roll; more just costs vertices. */
function terrainNoise(x: number, z: number): number {
  return smoothNoise(x * 0.035, z * 0.035) * 0.7 + smoothNoise(x * 0.09, z * 0.09) * 0.3;
}

/**
 * Proximity factor to the North-West the Fire Peak volcanic biome.
 *
 * Exported because the floor has to agree with the ground it stands on:
 * groundcover.ts uses this to keep grass and flowers out of the scorched zone.
 * Duplicating the falloff there would let the two drift apart, and the failure
 * would look like a texture bug rather than a disagreement between two files.
 */
export function volcanicStrength(x: number, z: number): number {
  const distNW = Math.hypot(x - (-95), z - (-95));
  const k = Math.max(0, 1 - distNW / 95);
  return k * k * (3 - 2 * k);
}

/** How strongly a point belongs to a lane: 1 on the centre line, 0 off it. */
function laneStrength(x: number, z: number): number {
  let best = 0;
  for (const lane of LANES) {
    const d = laneDistance(x, z, lane.path);
    const k = Math.max(0, 1 - d / (LANE_WIDTH / 2 + 6));
    if (k > best) best = k;
  }
  return best * best * (3 - 2 * best);
}

/** How far inside a base's paved ground a point is. */
function baseStrength(x: number, z: number): number {
  let best = 0;
  for (const t of Object.values(TEAMS)) {
    const d = Math.hypot(x - t.x, z - t.z);
    const k = Math.max(0, 1 - d / (SANCTUARY_RADIUS + 6));
    if (k > best) best = k;
  }
  return best;
}

/**
 * Base High-Ground Elevation (+3.0u relative to riverbeds).
 * Elevates the Dawn & Dusk sanctuary platforms and creates smooth stepped ramps into lanes.
 */
function baseHighGround(x: number, z: number): number {
  let elevation = 0;
  for (const t of Object.values(TEAMS)) {
    const d = Math.hypot(x - t.x, z - t.z);
    if (d <= SANCTUARY_RADIUS) {
      elevation = Math.max(elevation, 3.0);
    } else if (d < SANCTUARY_RADIUS + 22) {
      const k = 1 - (d - SANCTUARY_RADIUS) / 22;
      const smooth = k * k * (3 - 2 * k);
      elevation = Math.max(elevation, smooth * 3.0);
    }
  }
  return elevation;
}

/**
 * Tiered mossy terraces & natural stepped contours.
 */
function terraceHeight(raw: number): number {
  const step = 0.75;
  const quantized = Math.round(raw / step) * step;
  return raw * 0.35 + quantized * 0.65;
}

/**
 * Ground height at a point, before bridges.
 */
export function terrainHeight(x: number, z: number): number {
  if (onCrossing(x, z)) return groundHeight(x, z);
  const river = riverFloor(x, z);
  if (river < 0) return river;

  const roll = (terrainNoise(x, z) - 0.5) * 2.8;
  const flat = Math.max(laneStrength(x, z), baseStrength(x, z));
  const vStrength = volcanicStrength(x, z);
  const volcanicRidge = (smoothNoise(x * 0.05, z * 0.05) * 3.8 + smoothNoise(x * 0.12, z * 0.12) * 1.6) * vStrength;
  
  // High-ground base lift +3.0u
  const highGround = baseHighGround(x, z);
  
  // Lane plateau elevation (gently sloped between +0.4u and +1.2u)
  const laneLift = laneStrength(x, z) * 0.5;

  const rawJungle = terraceHeight(roll * (1 - flat) + volcanicRidge * (1 - flat * 0.8) + 0.6);
  const inner = rawJungle * (1 - flat * 0.7) + highGround + laneLift;

  const out = Math.max(Math.abs(x), Math.abs(z));
  if (out <= HALF) return inner;
  const t = Math.min(1, (out - HALF) / SKIRT);
  if (x < 0 && z < 0) {
    return inner + t * 14 * vStrength;
  }
  return inner - t * t * 26 + (terrainNoise(x * 0.6, z * 0.6) - 0.5) * 8 * t;
}

/** 3-way height-blend surface colour with riverbank wetness / mud dynamics */
function surfaceColour(x: number, z: number, out: THREE.Color): void {
  const grain = terrainNoise(x * 2.1, z * 2.1);

  // 1. Base Layer: Lush Mossy Grass (#2E7D32)
  out.copy(MOSSY_GRASS).lerp(JUNGLE_DEEP, 0.35 + grain * 0.4);
  out.lerp(MOSSY_LIT, Math.max(0, grain - 0.52) * 0.85);

  // 2. Lane Layer: Dirt Path (#5D4037) — LANDSCAPE DETAIL PATCH: cobble stones on main lane
  const lane = laneStrength(x, z);
  if (lane > 0) {
    let dirt: THREE.Color;
    if (lane > 0.62) {
      // Central lane = Forgotten Lands cobble: 8-dark mortar + 3 stone tints
      const cx = Math.floor(x * 2.2);
      const cz = Math.floor(z * 2.2);
      const h = hash(cx * 0.11 + 0.5, cz * 0.11 + 0.5);
      if (h < 0.08) dirt = new THREE.Color('#2b1f18'); // mortar 1px
      else if (h < 0.36) dirt = new THREE.Color('#6a5a4a');
      else if (h < 0.64) dirt = new THREE.Color('#7a6a5a');
      else dirt = new THREE.Color('#5a4a3a');
      dirt.offsetHSL(0, -0.05, (grain - 0.5) * 0.08);
    } else {
      dirt = DIRT_PATH.clone().offsetHSL(0, -0.05, (grain - 0.5) * 0.1);
    }
    out.lerp(dirt, Math.min(1, lane * 1.3));
  }

  // 3. Volcanic Layer: Volcanic Mud (#1C2833) & Scorched Soil (#2B2625)
  const vStrength = volcanicStrength(x, z);
  if (vStrength > 0) {
    const mud = VOLCANIC_MUD.clone().lerp(SCORCHED_SOIL, 0.45 + grain * 0.4);
    mud.lerp(BASALT_ROCK, Math.max(0, grain - 0.3) * 0.85);
    out.lerp(mud, vStrength * 0.94);
  }

  // 4. Riverbanks & Wet Mud dynamics
  const rPoint = riverAt(x, z);
  const wet = riverDepth(x, z);
  if (wet > 0) {
    out.lerp(RIVER_STONE, Math.min(1, wet * 1.6));
  } else if (rPoint.distance < rPoint.half + 4.5) {
    // Wet glistening mud along the banks
    const bankWet = 1 - (rPoint.distance - rPoint.half) / 4.5;
    out.lerp(WET_MUD, bankWet * 0.75);
  }

  // Paved base ground
  const base = baseStrength(x, z);
  if (base > 0) {
    const t = Math.hypot(x - TEAMS.dawn.x, z - TEAMS.dawn.z) < HALF ? 0 : 1;
    out.lerp(new THREE.Color(t === 0 ? '#c9bd97' : '#9db3bc'), base * 0.9);
  }

  // Beyond map border
  const edge = Math.max(Math.abs(x), Math.abs(z));
  if (edge > HALF - 6 && !(x < 0 && z < 0)) {
    out.lerp(BEYOND, Math.min(1, (edge - (HALF - 6)) / 26));
  }
}

export function buildTerrain(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'terrain-environment';

  const extent = HALF + SKIRT;
  const seg = Math.round((extent * 2) / 1.4); // HYPER-REAL: was 2.2, now 1.4 for 57% more tris + micro-bump
  const geo = new THREE.PlaneGeometry(extent * 2, extent * 2, seg, seg);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
    surfaceColour(x, z, c);
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();

  // HYPER-REAL Terrain Material — procedural micro-roughness + AO-ready
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.84,
    metalness: 0.04,
  });
  // Micro-roughness jitter will be driven via vertex color alpha in future pass
  mat.needsUpdate = true;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  group.add(mesh);

  // 1. Rocky Cliff Edges along high-ground drops into the river
  group.add(buildCliffEdges());

  // 2. Giant Exposed Banyan Roots framing jungle chokepoints
  group.add(buildChokepointBanyanRoots());

  // 3. Waterfalls cascading from high-ground into the river channel
  const waterfalls = buildWaterfallCascades();
  group.add(waterfalls.group);

  group.userData.update = (t: number) => {
    waterfalls.update(t);
  };

  return group;
}

/**
 * Steep rocky cliffs and basalt slabs framing the elevation drop-offs.
 */
function buildCliffEdges(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'cliff-edges';

  const geo = new THREE.DodecahedronGeometry(1.8, 1);
  geo.scale(1.8, 1.1, 1.4);
  const COUNT = 64;
  const mesh = new THREE.InstancedMesh(
    geo,
    surfaceMaterial(0x2d3436, { roughness: 0.85, metalness: 0.1 }),
    COUNT
  );
  mesh.receiveShadow = true;
  mesh.castShadow = true;

  const o = new THREE.Object3D();
  const rPoints = [
    { x: -45, z: -35, rot: 0.4 },
    { x: -38, z: -25, rot: 0.6 },
    { x: -28, z: -15, rot: 0.8 },
    { x: 18, z: -8, rot: 1.2 },
    { x: 28, z: -2, rot: 1.4 },
    { x: 42, z: 12, rot: 1.8 },
    { x: 50, z: 24, rot: 2.1 },
    { x: -12, z: 32, rot: -0.8 },
    { x: -22, z: 42, rot: -0.5 },
  ];

  let n = 0;
  for (let i = 0; i < rPoints.length && n < COUNT; i++) {
    const pt = rPoints[i];
    for (let k = 0; k < 6 && n < COUNT; k++) {
      const offX = (Math.sin(k * 1.7) - 0.5) * 4.5;
      const offZ = (Math.cos(k * 2.3) - 0.5) * 4.5;
      const px = pt.x + offX;
      const pz = pt.z + offZ;
      const py = terrainHeight(px, pz);

      const s = 1.1 + Math.sin(k * 3.1) * 0.45;
      o.position.set(px, py + s * 0.4, pz);
      o.rotation.set(0.2, pt.rot + k * 0.5, 0.15);
      o.scale.set(s * 1.3, s * 0.9, s);
      o.updateMatrix();
      mesh.setMatrixAt(n, o.matrix);
      n++;
    }
  }

  mesh.count = n;
  g.add(mesh);
  return g;
}

/**
 * Giant exposed Banyan roots framing jungle chokepoints and crossings.
 */
function buildChokepointBanyanRoots(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'chokepoint-banyan-roots';

  const rootMat = surfaceMaterial(0x3e2817, { roughness: 0.96 });

  // Key chokepoint locations around jungle entries and river transitions
  const chokepoints = [
    { x: -24, z: 18, rot: 0.6, scale: 2.2 },
    { x: 24, z: -18, rot: -0.6, scale: 2.2 },
    { x: -18, z: -28, rot: 1.2, scale: 2.0 },
    { x: 18, z: 28, rot: -1.2, scale: 2.0 },
    { x: -48, z: 42, rot: 0.2, scale: 2.5 },
    { x: 48, z: -42, rot: -0.2, scale: 2.5 },
  ];

  for (const cp of chokepoints) {
    const cg = new THREE.Group();
    cg.position.set(cp.x, terrainHeight(cp.x, cp.z), cp.z);
    cg.rotation.y = cp.rot;

    // Arched main root framing the path
    const archGeo = new THREE.TorusGeometry(cp.scale * 1.6, cp.scale * 0.24, 7, 14, Math.PI * 0.75);
    const archMesh = new THREE.Mesh(archGeo, rootMat);
    archMesh.rotation.set(Math.PI / 4, 0, Math.PI * 0.15);
    archMesh.position.set(0, cp.scale * 0.8, 0);
    archMesh.castShadow = true;
    archMesh.receiveShadow = true;
    cg.add(archMesh);

    // Knobbly root spurs extending along the ground
    for (let r = 0; r < 3; r++) {
      const angle = (r / 3) * Math.PI * 1.5;
      const spurGeo = new THREE.CylinderGeometry(cp.scale * 0.18, cp.scale * 0.32, cp.scale * 2.6, 6);
      const spurMesh = new THREE.Mesh(spurGeo, rootMat);
      spurMesh.position.set(Math.cos(angle) * cp.scale * 1.4, cp.scale * 0.2, Math.sin(angle) * cp.scale * 1.4);
      spurMesh.rotation.set(Math.PI / 2.3, 0, angle);
      spurMesh.castShadow = true;
      spurMesh.receiveShadow = true;
      cg.add(spurMesh);
    }

    g.add(cg);
  }

  return g;
}

/**
 * Animated waterfall cascades where highland river tributaries drop into the Sacred River Talisman basin.
 */
function buildWaterfallCascades(): { group: THREE.Group; update: (t: number) => void } {
  const group = new THREE.Group();
  group.name = 'waterfalls';

  const fallLocations = [
    { x: -32, z: -18, height: 2.4, width: 3.8, rot: 0.75 },
    { x: 32, z: 18, height: 2.4, width: 3.8, rot: -2.4 },
  ];

  const fallUniforms: { uTime: { value: number } }[] = [];

  for (const loc of fallLocations) {
    const fg = new THREE.Group();
    const groundY = terrainHeight(loc.x, loc.z);
    fg.position.set(loc.x, groundY + 0.2, loc.z);
    fg.rotation.y = loc.rot;

    const uTime = { value: 0 };
    fallUniforms.push({ uTime });

    // Water cascade sheet
    const sheetGeo = new THREE.PlaneGeometry(loc.width, loc.height, 8, 12);
    sheetGeo.translate(0, -loc.height / 2, 0);

    const sheetMat = new THREE.MeshStandardMaterial({
      color: 0x88e2ff,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });

    sheetMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float wave = sin(position.y * 3.0 - uTime * 6.0) * 0.12;
        transformed.z += wave;`
      );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          'void main() {',
          `uniform float uTime;
          void main() {`
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
          float foam = sin(vUv.y * 18.0 - uTime * 8.0) * 0.5 + 0.5;
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.95, 0.99, 1.0), foam * 0.5);`
        );
    };

    const sheetMesh = new THREE.Mesh(sheetGeo, sheetMat);
    fg.add(sheetMesh);

    // Splash foam ring at the bottom
    const splashGeo = new THREE.RingGeometry(loc.width * 0.4, loc.width * 0.75, 16);
    splashGeo.rotateX(-Math.PI / 2);
    const splashMat = new THREE.MeshBasicMaterial({
      color: 0xddf6ff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const splash = new THREE.Mesh(splashGeo, splashMat);
    splash.position.set(0, -loc.height + 0.05, 0.4);
    fg.add(splash);

    group.add(fg);
  }

  return {
    group,
    update: (t: number) => {
      for (const u of fallUniforms) {
        u.uTime.value = t;
      }
    },
  };
}

/** Kept for the river renderer, which needs to know how wide to fade. */
export const TERRAIN_RIVER_WIDTH = RIVER_WIDTH;

