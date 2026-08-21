// The arena, built once.
//
// Nothing here moves, so it is built at load and never touched again. That is
// the whole reason it can afford real geometry: the cost is paid on the first
// frame and never on any subsequent one.

import * as THREE from 'three';
import { ARENA_SIZE, OBSTACLES } from '@/game/arena/layout';
import { flatMaterial } from './stage';

const GRASS = 0x5f9e4a;
const GRASS_DARK = 0x4a7f3b;
const STONE = 0x9aa0a6;
const STONE_DARK = 0x6f757a;
const BARK = 0x5b4433;
const LEAF = 0x2f7d4f;
const EARTH = 0x7a5c3e;

export function buildArena(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'arena';

  // The floor, as two plates rather than one: a darker apron under a lighter
  // field, so the edge of the playable area is visible without a painted line.
  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(ARENA_SIZE * 2 + 4, 0.6, ARENA_SIZE * 2 + 4),
    flatMaterial(EARTH)
  );
  apron.position.y = -0.5;
  apron.receiveShadow = true;
  group.add(apron);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(ARENA_SIZE * 2, 0.4, ARENA_SIZE * 2),
    flatMaterial(GRASS)
  );
  floor.position.y = -0.2;
  floor.receiveShadow = true;
  group.add(floor);

  // A grid of slightly darker patches. Cheap, and it is what stops a 40 by 40
  // plane reading as a flat green void: it gives the eye something to measure
  // distance and movement against.
  const patch = new THREE.BoxGeometry(3.6, 0.42, 3.6);
  const patchMat = flatMaterial(GRASS_DARK);
  for (let i = 0; i < 26; i++) {
    // Deterministic placement: the arena must look the same every session, and
    // a seeded pattern costs nothing next to storing 26 coordinates by hand.
    const a = Math.sin(i * 12.9898) * 43758.5453;
    const b = Math.sin(i * 78.233) * 43758.5453;
    const x = ((a - Math.floor(a)) * 2 - 1) * (ARENA_SIZE - 3);
    const z = ((b - Math.floor(b)) * 2 - 1) * (ARENA_SIZE - 3);
    const m = new THREE.Mesh(patch, patchMat);
    m.position.set(x, -0.19, z);
    m.rotation.y = (a % 1) * Math.PI;
    m.receiveShadow = true;
    group.add(m);
  }

  for (const o of OBSTACLES) {
    group.add(o.radius > 2 ? balete(o.x, o.z, o.radius) : o.tall ? shrine(o.x, o.z, o.radius) : stone(o.x, o.z, o.radius));
  }

  return group;
}

/** The tree at the centre. The only thing in the arena taller than a hero. */
function balete(x: number, z: number, radius: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.7, radius, 5.5, 7),
    flatMaterial(BARK)
  );
  trunk.position.y = 2.75;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  g.add(trunk);

  // Three offset canopy blobs rather than one sphere: a single ball reads as a
  // lollipop, and the offsets are what make it read as foliage.
  const canopy = new THREE.IcosahedronGeometry(radius * 1.5, 0);
  const canopyMat = flatMaterial(LEAF);
  for (const [ox, oy, oz, s] of [
    [0, 6.4, 0, 1],
    [radius * 0.8, 5.6, radius * 0.4, 0.72],
    [-radius * 0.6, 5.9, -radius * 0.7, 0.64],
  ]) {
    const m = new THREE.Mesh(canopy, canopyMat);
    m.position.set(ox, oy, oz);
    m.scale.setScalar(s);
    m.castShadow = true;
    g.add(m);
  }

  return g;
}

/** A carved anito post. Tall enough to break line of sight. */
function shrine(x: number, z: number, radius: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.15, radius * 1.3, 0.5, 6),
    flatMaterial(STONE_DARK)
  );
  base.position.y = 0.25;
  base.receiveShadow = true;
  g.add(base);

  const post = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 1.2, 3.4, radius * 1.2),
    flatMaterial(STONE)
  );
  post.position.y = 2.1;
  post.castShadow = true;
  post.receiveShadow = true;
  g.add(post);

  // The head. It is what makes a grey box read as a carved figure watching the
  // fight rather than as a pillar.
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 1.5, 0.9, radius * 1.5),
    flatMaterial(STONE_DARK)
  );
  head.position.y = 4.2;
  head.castShadow = true;
  g.add(head);

  return g;
}

/** A low boulder. Stops a body, does not stop an eye. */
function stone(x: number, z: number, radius: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), flatMaterial(STONE));
  m.position.set(x, radius * 0.42, z);
  m.rotation.set(0.3, radius, 0.2);
  m.scale.y = 0.7;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
