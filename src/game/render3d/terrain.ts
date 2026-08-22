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

// ── the palette ─────────────────────────────────────────────────────────────
const GRASS = new THREE.Color('#4f8f3f');
const GRASS_LIT = new THREE.Color('#6fae52');
const JUNGLE = new THREE.Color('#2f6b34');
const DIRT = new THREE.Color('#8a6f45');
const DIRT_DARK = new THREE.Color('#6b5334');
const RIVER_STONE = new THREE.Color('#4a5c5f');
const BEYOND = new THREE.Color('#1c3320');

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

/** How strongly a point belongs to a lane: 1 on the centre line, 0 off it. */
function laneStrength(x: number, z: number): number {
  let best = 0;
  for (const lane of LANES) {
    const d = laneDistance(x, z, lane.path);
    // The blend runs past the lane's own width, so trodden ground fades into
    // grass rather than ending at a kerb.
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
 *
 * ⚠ LANES ARE FLATTENED. Terrain roll is what stops the map reading as a
 * tabletop, but a lane that undulates makes an aimed skillshot travel over a
 * hill and land somewhere the player did not choose. The noise is faded out
 * wherever a lane is, so roads are level and everything between them is not.
 */
export function terrainHeight(x: number, z: number): number {
  const river = riverFloor(x, z);
  if (river < 0) return river;

  const roll = (terrainNoise(x, z) - 0.5) * 3.2;
  const flat = Math.max(laneStrength(x, z), baseStrength(x, z));
  const inner = roll * (1 - flat);

  // Past the boundary the ground falls away into forest, which is what removes
  // the hard edge without fencing the player in with an invisible wall.
  const out = Math.max(Math.abs(x), Math.abs(z));
  if (out <= HALF) return inner;
  const t = Math.min(1, (out - HALF) / SKIRT);
  return inner - t * t * 26 + (terrainNoise(x * 0.6, z * 0.6) - 0.5) * 8 * t;
}

/** Surface colour at a point, blended between neighbours. */
function surfaceColour(x: number, z: number, out: THREE.Color): void {
  const grain = terrainNoise(x * 2.1, z * 2.1);

  // Jungle base: darker away from the lanes, lighter near them.
  out.copy(JUNGLE).lerp(GRASS, 0.35 + grain * 0.4);
  out.lerp(GRASS_LIT, Math.max(0, grain - 0.55) * 0.9);

  // Trodden ground along the lanes.
  const lane = laneStrength(x, z);
  if (lane > 0) {
    const mud = DIRT.clone().lerp(DIRT_DARK, grain);
    out.lerp(mud, Math.min(1, lane * 1.25));
  }

  // Dark wet stone along the riverbed.
  const wet = riverDepth(x, z);
  if (wet > 0) out.lerp(RIVER_STONE, Math.min(1, wet * 1.6));

  // Paved base ground.
  const base = baseStrength(x, z);
  if (base > 0) {
    // Each team's own stone, so a glance tells you whose ground you are on.
    const t = Math.hypot(x - TEAMS.anito.x, z - TEAMS.anito.z) < HALF ? 0 : 1;
    out.lerp(new THREE.Color(t === 0 ? '#c9bd97' : '#9db3bc'), base * 0.9);
  }

  // Beyond the boundary it goes dark, which is what reads as deep forest
  // rather than as the map having been cut out with scissors.
  const edge = Math.max(Math.abs(x), Math.abs(z));
  if (edge > HALF - 6) {
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
