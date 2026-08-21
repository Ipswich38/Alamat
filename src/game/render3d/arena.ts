// The arena, built once.
//
// ── WHY THERE IS SO MUCH IN HERE ────────────────────────────────────────────
// Density is the difference between a game that looks like a prototype and one
// that looks finished, and it is cheaper than almost anything else you could
// spend the frame on. A bare green plane with five objects on it reads as
// placeholder no matter how good the lighting is; the same plane with two
// thousand grass tufts, scattered ferns and a treeline reads as a place.
//
// All of it is INSTANCED. Two thousand tufts of grass is one draw call and one
// geometry, so the cost is a matrix upload at load and nothing per frame.
//
// ── AND WHY IT IS ALL SEEDED ────────────────────────────────────────────────
// A hash, not Math.random. The arena must look identical every session and on
// every device, because a player learns cover by its shape and an arena that
// reshuffles is an arena nobody can learn.

import * as THREE from 'three';
import { ARENA_SIZE, OBSTACLES } from '@/game/arena/layout';
import { surfaceMaterial } from './stage';

const GRASS = 0x3f7444;
const GRASS_DEEP = 0x2b5433;
const GRASS_LIGHT = 0x5c9d55;
const EARTH = 0x6b5138;
const EARTH_DARK = 0x3d2f22;
const STONE = 0x7d868c;
const STONE_DARK = 0x4d5459;
const BARK = 0x40311f;
const LEAF = 0x235c3c;
const LEAF_LIGHT = 0x36804f;
const MOSS = 0x6f9b3f;

/**
 * Push every vertex out or in by a seeded amount, then recompute normals.
 *
 * The one function that separates "generated primitive" from "modelled thing".
 * A sphere is a sphere however many times it is subdivided; a sphere whose
 * vertices have been nudged reads as something that grew. Normals MUST be
 * recomputed afterwards or the surface still shades like the shape it was.
 */
function lumpy(geo: THREE.BufferGeometry, amount: number): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 12.9 + v.y * 4.7 + v.z * 7.3) * 43758.5453;
    const k = 1 + ((n - Math.floor(n)) * 2 - 1) * amount;
    pos.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Deterministic 0..1 from an integer and a salt. See the note above. */
function rand(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function buildArena(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'arena';

  group.add(ground());
  group.add(grass());
  group.add(ferns());
  group.add(flowers());
  group.add(treeline());

  for (const o of OBSTACLES) {
    group.add(
      o.radius > 2 ? balete(o.x, o.z, o.radius) : o.tall ? shrine(o.x, o.z, o.radius) : boulder(o.x, o.z, o.radius)
    );
  }

  return group;
}

/** The floor: an earth apron, the field, and worn patches over it. */
function ground(): THREE.Group {
  const g = new THREE.Group();

  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(ARENA_SIZE * 2 + 8, 1.2, ARENA_SIZE * 2 + 8),
    surfaceMaterial(EARTH_DARK, { roughness: 0.95 })
  );
  apron.position.y = -0.9;
  apron.receiveShadow = true;
  g.add(apron);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(ARENA_SIZE * 2, 0.6, ARENA_SIZE * 2),
    surfaceMaterial(GRASS, { roughness: 0.92 })
  );
  floor.position.y = -0.3;
  floor.receiveShadow = true;
  g.add(floor);

  // Worn dirt, thickest at the centre where the fighting happens. Wear is a
  // story the ground tells about itself and costs one instanced mesh.
  const patch = new THREE.CircleGeometry(1, 7);
  // Only a little browner than the grass. A hard brown against green reads as
  // a puddle rather than as worn ground.
  const patchMat = surfaceMaterial(0x5c5c39, { roughness: 1 });
  const worn = new THREE.InstancedMesh(patch, patchMat, 26);
  worn.receiveShadow = true;
  const m = new THREE.Object3D();
  for (let i = 0; i < 26; i++) {
    const a = rand(i, 1) * Math.PI * 2;
    // Square-rooted so the scatter clusters towards the middle rather than
    // spreading evenly, which is what wear actually does.
    const r = Math.sqrt(rand(i, 2)) * (ARENA_SIZE - 2);
    m.position.set(Math.cos(a) * r, 0.005, Math.sin(a) * r);
    m.rotation.set(-Math.PI / 2, 0, rand(i, 3) * Math.PI);
    m.scale.setScalar(0.9 + rand(i, 4) * 1.7);
    m.updateMatrix();
    worn.setMatrixAt(i, m.matrix);
  }
  g.add(worn);

  return g;
}

/** Two thousand tufts, one draw call. */
function grass(): THREE.InstancedMesh {
  const COUNT = 1800;
  // A three-bladed sprig. Cheaper than a cross-quad and it never shows the
  // hard alpha edge a cut-out texture would need.
  // ⚠ GRASS IS TEXTURE, NOT OBJECTS. Two earlier passes failed the same way:
  // tufts that are darker than the ground and tall enough to see individually
  // read as a nursery of pine seedlings scattered on a lawn. Grass tips catch
  // the light, so they must be LIGHTER than what they stand in, and small
  // enough that the eye resolves a field instead of counting plants.
  const blade = new THREE.ConeGeometry(0.13, 0.18, 3);
  blade.translate(0, 0.09, 0);

  const mesh = new THREE.InstancedMesh(blade, surfaceMaterial(GRASS_LIGHT, { roughness: 1 }), COUNT);
  mesh.castShadow = false; // 2,200 shadow casters is the whole frame budget
  mesh.receiveShadow = true;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);

  const m = new THREE.Object3D();
  const c = new THREE.Color();
  // Both ends of the range sit ABOVE the ground colour, never below it.
  const deep = new THREE.Color(GRASS_LIGHT);
  const light = new THREE.Color(0x8fcf6a);
  let n = 0;
  for (let i = 0; i < COUNT * 2 && n < COUNT; i++) {
    const x = (rand(i, 11) * 2 - 1) * (ARENA_SIZE - 0.5);
    const z = (rand(i, 12) * 2 - 1) * (ARENA_SIZE - 0.5);
    // Nothing grows where something is standing.
    if (OBSTACLES.some((o) => (x - o.x) ** 2 + (z - o.z) ** 2 < (o.radius + 0.6) ** 2)) continue;
    m.position.set(x, 0, z);
    m.rotation.set(rand(i, 13) * 0.22 - 0.11, rand(i, 14) * Math.PI * 2, rand(i, 15) * 0.22 - 0.11);
    m.scale.set(1, 0.7 + rand(i, 16) * 0.9, 1);
    m.updateMatrix();
    mesh.setMatrixAt(n, m.matrix);
    // Per-blade colour variation. Uniform green is the single loudest tell
    // that something was generated rather than grown.
    c.copy(deep).lerp(light, rand(i, 17));
    mesh.setColorAt(n, c);
    n++;
  }
  mesh.count = n;
  return mesh;
}

/** Bigger leafy clumps, scattered more sparsely than the grass. */
function ferns(): THREE.InstancedMesh {
  const COUNT = 150;
  // Subdivided once and smooth-shaded. At detail 0 an icosahedron reads as a
  // cut gem; at 1 with smooth normals it reads as a leafy clump.
  const frond = lumpy(new THREE.IcosahedronGeometry(0.55, 1), 0.34);
  const mesh = new THREE.InstancedMesh(frond, surfaceMaterial(LEAF, { roughness: 0.88 }), COUNT);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);

  const m = new THREE.Object3D();
  const c = new THREE.Color();
  const a = new THREE.Color(LEAF);
  const b = new THREE.Color(LEAF_LIGHT);
  let n = 0;
  for (let i = 0; i < COUNT * 3 && n < COUNT; i++) {
    const x = (rand(i, 21) * 2 - 1) * (ARENA_SIZE - 1.2);
    const z = (rand(i, 22) * 2 - 1) * (ARENA_SIZE - 1.2);
    if (OBSTACLES.some((o) => (x - o.x) ** 2 + (z - o.z) ** 2 < (o.radius + 1.4) ** 2)) continue;
    m.position.set(x, 0.28, z);
    m.rotation.set(rand(i, 23) * 0.6, rand(i, 24) * Math.PI * 2, rand(i, 25) * 0.6);
    m.scale.set(1 + rand(i, 26) * 0.7, 0.62 + rand(i, 27) * 0.4, 1 + rand(i, 28) * 0.7);
    m.updateMatrix();
    mesh.setMatrixAt(n, m.matrix);
    c.copy(a).lerp(b, rand(i, 29));
    mesh.setColorAt(n, c);
    n++;
  }
  mesh.count = n;
  return mesh;
}

/**
 * Small bright flowers.
 *
 * The one element allowed to be a saturated non-green. A field of nothing but
 * greens reads as flat however well it is lit; a few hundred warm specks give
 * the eye something to catch on and are what makes a palette feel chosen.
 */
function flowers(): THREE.InstancedMesh {
  const COUNT = 90;
  const petal = new THREE.IcosahedronGeometry(0.11, 1);
  const mesh = new THREE.InstancedMesh(petal, surfaceMaterial(0xffffff, { roughness: 0.6 }), COUNT);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);

  const palette = [0xf2c14e, 0xef767a, 0xf7f0d8, 0xe8a0bf, 0xffd9a0];
  const m = new THREE.Object3D();
  const c = new THREE.Color();
  let n = 0;
  for (let i = 0; i < COUNT * 3 && n < COUNT; i++) {
    const x = (rand(i, 31) * 2 - 1) * (ARENA_SIZE - 1);
    const z = (rand(i, 32) * 2 - 1) * (ARENA_SIZE - 1);
    if (OBSTACLES.some((o) => (x - o.x) ** 2 + (z - o.z) ** 2 < (o.radius + 0.9) ** 2)) continue;
    m.position.set(x, 0.34 + rand(i, 33) * 0.16, z);
    m.rotation.set(rand(i, 34) * 3, rand(i, 35) * 3, 0);
    m.scale.setScalar(0.75 + rand(i, 36) * 0.6);
    m.updateMatrix();
    mesh.setMatrixAt(n, m.matrix);
    c.setHex(palette[Math.floor(rand(i, 37) * palette.length) % palette.length]);
    mesh.setColorAt(n, c);
    n++;
  }
  mesh.count = n;
  return mesh;
}

/**
 * A ring of trees outside the walls.
 *
 * Purely scenery, and load-bearing scenery: without it the arena floor ends at
 * a hard edge against the sky and the whole thing reads as a diorama on a
 * table. With it, the arena is a clearing in a forest.
 */
function treeline(): THREE.Group {
  const g = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.45, 0.7, 7, 10);
    // ⚠ NOT A SPHERE. Subdividing to detail 1 fixed the cut-gem look and created a
  // worse one: perfect balls on sticks, which read as clay or broccoli. Foliage
  // needs an irregular MASS, so the geometry is deformed per vertex once at
  // build time and every instance is then scaled unevenly on top.
  const canopyGeo = lumpy(new THREE.IcosahedronGeometry(2.6, 1), 0.3);
  const trunkMat = surfaceMaterial(BARK, { roughness: 0.95 });
  const canopyMat = surfaceMaterial(LEAF, { roughness: 0.9 });

  const COUNT = 76;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, COUNT);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, COUNT);
  canopies.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);
  trunks.castShadow = true;
  canopies.castShadow = true;

  const m = new THREE.Object3D();
  const c = new THREE.Color();
  const a = new THREE.Color(LEAF);
  const b = new THREE.Color(LEAF_LIGHT);
  for (let i = 0; i < COUNT; i++) {
    const angle = (i / COUNT) * Math.PI * 2 + rand(i, 41) * 0.08;
    const r = ARENA_SIZE + 4.5 + rand(i, 42) * 9;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const h = 0.8 + rand(i, 43) * 0.7;

    m.position.set(x, 3.5 * h - 1, z);
    m.rotation.set(0, rand(i, 44) * Math.PI, 0);
    m.scale.set(h, h, h);
    m.updateMatrix();
    trunks.setMatrixAt(i, m.matrix);

    m.position.set(x, 6.6 * h - 1, z);
    m.rotation.set(rand(i, 45) * 0.5, rand(i, 46) * Math.PI, rand(i, 47) * 0.5);
    m.scale.set(
      h * (0.9 + rand(i, 48) * 0.5),
      h * (0.7 + rand(i, 61) * 0.45),
      h * (0.9 + rand(i, 62) * 0.5)
    );
    m.updateMatrix();
    canopies.setMatrixAt(i, m.matrix);
    c.copy(a).lerp(b, rand(i, 49));
    canopies.setColorAt(i, c);
  }

  g.add(trunks, canopies);
  return g;
}

/** The balete at the centre, with the hanging roots that make it a balete. */
function balete(x: number, z: number, radius: number): THREE.Group {
  const g = new THREE.Group();
  // Named so a generated model can find and remove it on arrival.
  g.name = 'balete-placeholder';
  g.position.set(x, 0, z);

  // Tall enough that the canopy clears the fight. The first version put a
  // 3.4-wide canopy at head height over the centre of the arena, which hid the
  // one piece of ground both players are meant to contest.
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.62, radius * 1.0, 9, 14),
    surfaceMaterial(BARK, { roughness: 0.95 })
  );
  trunk.position.y = 4.5;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  g.add(trunk);

  // Aerial roots. The signature of the species, and the thing that makes this
  // read as somewhere a spirit lives rather than as a big tree.
  const rootGeo = new THREE.CylinderGeometry(0.07, 0.11, 1, 6);
  const rootMat = surfaceMaterial(BARK, { roughness: 1 });
  const roots = new THREE.InstancedMesh(rootGeo, rootMat, 26);
  roots.castShadow = true;
  const m = new THREE.Object3D();
  for (let i = 0; i < 26; i++) {
    const a = rand(i, 51) * Math.PI * 2;
    const rr = radius * (0.75 + rand(i, 52) * 0.7);
    const len = 2.2 + rand(i, 53) * 2.6;
    m.position.set(Math.cos(a) * rr, 8.2 - len / 2, Math.sin(a) * rr);
    m.rotation.set(rand(i, 54) * 0.18, 0, rand(i, 55) * 0.18);
    m.scale.set(1, len, 1);
    m.updateMatrix();
    roots.setMatrixAt(i, m.matrix);
  }
  g.add(roots);

  const canopy = lumpy(new THREE.IcosahedronGeometry(radius * 0.95, 2), 0.22);
  const canopyMat = surfaceMaterial(LEAF, { roughness: 0.88 });
  // Seven smaller blobs rather than four big ones: more silhouette, and no
  // single face large enough to read as a flat sheet.
  for (const [ox, oy, oz, s] of [
    [0, 10.4, 0, 1.25],
    [radius * 1.5, 9.4, radius * 0.7, 0.95],
    [-radius * 1.3, 9.7, -radius * 1.2, 0.9],
    [radius * 0.4, 11.4, -radius * 1.1, 0.8],
    [-radius * 0.9, 10.9, radius * 1.3, 0.85],
    [radius * 1.1, 11.0, -radius * 0.3, 0.7],
    [-radius * 0.2, 8.9, -radius * 0.2, 1.0],
  ]) {
    const mesh = new THREE.Mesh(canopy, canopyMat);
    mesh.position.set(ox, oy, oz);
    mesh.scale.setScalar(s);
    mesh.castShadow = true;
    g.add(mesh);
  }

  return g;
}

/** A carved anito post. Tall enough to break line of sight. */
function shrine(x: number, z: number, radius: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.2, radius * 1.4, 0.6, 12),
    surfaceMaterial(STONE_DARK, { roughness: 0.95 })
  );
  base.position.y = 0.3;
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  const post = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 1.15, 3.2, radius * 1.15),
    surfaceMaterial(STONE, { roughness: 0.8 })
  );
  post.position.y = 2.1;
  post.castShadow = true;
  post.receiveShadow = true;
  g.add(post);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 1.5, 1.0, radius * 1.45),
    surfaceMaterial(STONE_DARK, { roughness: 0.75 })
  );
  head.position.y = 4.2;
  head.castShadow = true;
  g.add(head);

  // Moss on the north face. One small asymmetry is what stops carved stone
  // looking like it was extruded five minutes ago.
  const moss = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 1.18, 1.1, 0.08),
    surfaceMaterial(MOSS, { roughness: 1 })
  );
  moss.position.set(0, 1.2, radius * 0.6);
  g.add(moss);

  return g;
}

/** A low boulder. Stops a body, does not stop an eye. */
function boulder(x: number, z: number, radius: number): THREE.Mesh {
  const m = new THREE.Mesh(
    // Subdivided so it is not a cut crystal, then deformed so it is not a
    // billiard ball. Both are wrong in opposite directions.
    lumpy(new THREE.DodecahedronGeometry(radius, 1), 0.16),
    surfaceMaterial(STONE, { roughness: 0.85 })
  );
  m.position.set(x, radius * 0.4, z);
  m.rotation.set(0.3, radius * 2, 0.2);
  m.scale.set(1.1, 0.68, 1);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
