// The ground: its shape, its surfaces, and the world beyond the playable edge.
//
// ── WHY ONE MESH DOES ALL THREE ─────────────────────────────────────────────
// Height, surface colour and the skirt past the boundary are the same problem
// asked three ways, and every one of them is a function of position. Splitting
// them into separate meshes gives seams exactly where a player is most likely
// to look: the lane edge, the river bank, the map border.
//
// ── WHY THE SURFACES ARE BLENDED, NOT SWITCHED ──────────────────────────────
// A lane is not a painted stripe with a hard edge, it is trodden ground that
// gives way to grass. Every surface here fades into its neighbour over a few
// units, which is the difference between terrain and a diagram.
//
// ── AND WHY IT EXTENDS PAST THE MAP ─────────────────────────────────────────
// A ground plane that stops at the playable boundary leaves the sky showing
// underneath it and the whole arena reads as a tabletop. The mesh runs well
// past the edge, falls away, and darkens into forest, so the map has a horizon
// instead of a rim.

import * as THREE from 'three';
import { HALF, SANCTUARY_RADIUS, TEAMS } from '@/game/arena/nexus';
import { LANES, LANE_WIDTH, laneDistance } from '@/game/arena/lanes';
import { RIVER_WIDTH, riverDepth, riverFloor } from '@/game/arena/river';

// ── the palette (3-way height-blend) ─────────────────────────────────────────
const DIRT_PATH = new THREE.Color('#5D4037'); // Dirt Path
const MOSSY_GRASS = new THREE.Color('#2E7D32'); // Lush Mossy Grass
const MOSSY_LIT = new THREE.Color('#388E3C');
const JUNGLE_DEEP = new THREE.Color('#1B4D2E');
const VOLCANIC_MUD = new THREE.Color('#1C2833'); // Volcanic Mud
const SCORCHED_SOIL = new THREE.Color('#2B2625');
const BASALT_ROCK = new THREE.Color('#1A1717');
const RIVER_STONE = new THREE.Color('#2C3E50');
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
  // Smoothstepped interpolation, or the terrain has visible grid creases.
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

/** Proximity factor to the North-West Mayon volcanic biome. */
function volcanicStrength(x: number, z: number): number {
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
 * Ground height at a point, before bridges.
 */
export function terrainHeight(x: number, z: number): number {
  const river = riverFloor(x, z);
  if (river < 0) return river;

  const roll = (terrainNoise(x, z) - 0.5) * 3.2;
  const flat = Math.max(laneStrength(x, z), baseStrength(x, z));
  const vStrength = volcanicStrength(x, z);
  const volcanicRidge = (smoothNoise(x * 0.05, z * 0.05) * 3.8 + smoothNoise(x * 0.12, z * 0.12) * 1.6) * vStrength;
  const inner = roll * (1 - flat) + volcanicRidge * (1 - flat * 0.8);

  const out = Math.max(Math.abs(x), Math.abs(z));
  if (out <= HALF) return inner;
  const t = Math.min(1, (out - HALF) / SKIRT);
  if (x < 0 && z < 0) {
    return inner + t * 14 * vStrength;
  }
  return inner - t * t * 26 + (terrainNoise(x * 0.6, z * 0.6) - 0.5) * 8 * t;
}

/** 3-way height-blend surface colour: Dirt Path (#5D4037) -> Lush Mossy Grass (#2E7D32) -> Volcanic Mud (#1C2833) */
function surfaceColour(x: number, z: number, out: THREE.Color): void {
  const grain = terrainNoise(x * 2.1, z * 2.1);

  // 1. Base Layer: Lush Mossy Grass (#2E7D32)
  out.copy(MOSSY_GRASS).lerp(JUNGLE_DEEP, 0.35 + grain * 0.4);
  out.lerp(MOSSY_LIT, Math.max(0, grain - 0.52) * 0.85);

  // 2. Lane Layer: Dirt Path (#5D4037)
  const lane = laneStrength(x, z);
  if (lane > 0) {
    const dirt = DIRT_PATH.clone().offsetHSL(0, -0.05, (grain - 0.5) * 0.1);
    out.lerp(dirt, Math.min(1, lane * 1.3));
  }

  // 3. Volcanic Layer: Volcanic Mud (#1C2833) & Scorched Soil (#2B2625)
  const vStrength = volcanicStrength(x, z);
  if (vStrength > 0) {
    const mud = VOLCANIC_MUD.clone().lerp(SCORCHED_SOIL, 0.45 + grain * 0.4);
    mud.lerp(BASALT_ROCK, Math.max(0, grain - 0.3) * 0.85);
    out.lerp(mud, vStrength * 0.94);
  }

  // Riverbed: Slate Blue wet stone
  const wet = riverDepth(x, z);
  if (wet > 0) out.lerp(RIVER_STONE, Math.min(1, wet * 1.6));

  // Paved base ground
  const base = baseStrength(x, z);
  if (base > 0) {
    const t = Math.hypot(x - TEAMS.anito.x, z - TEAMS.anito.z) < HALF ? 0 : 1;
    out.lerp(new THREE.Color(t === 0 ? '#c9bd97' : '#9db3bc'), base * 0.9);
  }

  // Beyond map border
  const edge = Math.max(Math.abs(x), Math.abs(z));
  if (edge > HALF - 6 && !(x < 0 && z < 0)) {
    out.lerp(BEYOND, Math.min(1, (edge - (HALF - 6)) / 26));
  }
}

export function buildTerrain(): THREE.Mesh {
  const extent = HALF + SKIRT;
  // 2.4 units a segment: fine enough that a 14-wide lane has six across it and
  // its edge reads as a curve, coarse enough to stay around 25k triangles.
  const seg = Math.round((extent * 2) / 2.4);
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

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.01 })
  );
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

/** Kept for the river renderer, which needs to know how wide to fade. */
export const TERRAIN_RIVER_WIDTH = RIVER_WIDTH;
