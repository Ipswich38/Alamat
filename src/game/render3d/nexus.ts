// The sanctuary, built: the ground ring, the pedestal light, and the core.
//
// ── WHY THE LIGHT IS A REAL POINT LIGHT ─────────────────────────────────────
// Almost nothing else in this scene gets one, because a shadowless light still
// costs every material in the frame. A base earns it: it is the one place a
// player returns to, the colour is how they know whose it is at a glance, and
// two of them across a 200-unit map is a price worth paying for that.
//
// ── AND WHY THE CORE IS BOTH LIT AND UNLIT ──────────────────────────────────
// The generated shrine is a normal PBR object and is lit like one. The crystal
// above it is a separate unlit shape that is brighter than white, because it is
// meant to BE light rather than to receive it, and only something above the
// bloom threshold reads that way.

import * as THREE from 'three';
import { CORE_HEIGHT, HALF, SANCTUARY_RADIUS, TEAMS, type Team } from '@/game/arena/nexus';
import { riverDepth, riverFloor } from '@/game/arena/river';
import { loadModel } from './models';
import { terrainHeight } from './terrain';
import { surfaceMaterial } from './stage';

export interface Nexus {
  group: THREE.Group;
  /** Spin the crystal and breathe the light. */
  update(t: number): void;
  dispose(): void;
}

export function createNexus(): Nexus {
  const group = new THREE.Group();
  group.name = 'nexus';
  const crystals: { mesh: THREE.Mesh; lamp: THREE.PointLight; seed: number }[] = [];

  for (const team of Object.values(TEAMS)) {
    group.add(sanctuary(team, crystals));
  }

  // The generated shrine arrives late and drops onto each pedestal. The base is
  // legible without it, which is the rule for every generated asset here.
  loadModel('/models/props/anitoCore.glb', { height: 6.5 }).then((model) => {
    if (!model) return;
    for (const team of Object.values(TEAMS)) {
      const shrine = model.clone(true);
      shrine.position.set(team.x, terrainHeight(team.x, team.z) + 0.9, team.z);
      // Turned to face the middle of the map, so both shrines present their
      // front to the fight rather than to the corner behind them.
      shrine.rotation.y = Math.atan2(-team.x, -team.z);
      group.add(shrine);
    }
  });

  return {
    group,
    update: (t) => {
      for (const c of crystals) {
        c.mesh.rotation.y = t * 0.4 + c.seed;
        c.mesh.position.y = CORE_HEIGHT + Math.sin(t * 1.1 + c.seed) * 0.28;
        // Breathing, so a base reads as alive from across the map.
        c.lamp.intensity = 90 + Math.sin(t * 1.4 + c.seed) * 26;
      }
    },
    dispose: () => {
      group.traverse((n) => {
        const m = n as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
    },
  };
}

function sanctuary(
  team: Team,
  crystals: { mesh: THREE.Mesh; lamp: THREE.PointLight; seed: number }[]
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(team.x, terrainHeight(team.x, team.z), team.z);

  // The zone itself, as a ring on the ground. Flat and unlit: it is a marker
  // telling you where safety ends, and a marker that takes the light of the
  // scene stops being readable at exactly the moment it matters.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(SANCTUARY_RADIUS - 1.2, SANCTUARY_RADIUS, 64),
    new THREE.MeshBasicMaterial({
      color: team.light,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      toneMapped: false,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  g.add(ring);

  // The paved sanctuary floor, a shade lighter than whatever it sits on.
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(SANCTUARY_RADIUS - 1.2, SANCTUARY_RADIUS - 0.6, 0.5, 48),
    surfaceMaterial(team.id === 'anito' ? 0xcfc3a0 : 0xa8bcc4, { roughness: 0.9 })
  );
  floor.position.y = 0.2;
  floor.receiveShadow = true;
  g.add(floor);

  // The pedestal the core rests on. Kept even once the generated shrine lands
  // on top of it, because the shrine is 7.6MB and may never arrive.
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 4.4, 1.8, 8),
    surfaceMaterial(team.id === 'anito' ? 0xb8a985 : 0x8fa3ad, { roughness: 0.85 })
  );
  pedestal.position.y = 1.1;
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  g.add(pedestal);

  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.5, 0),
    new THREE.MeshBasicMaterial({ color: team.light, toneMapped: false })
  );
  crystal.position.y = CORE_HEIGHT;
  crystal.name = `core:${team.id}`;
  g.add(crystal);

  const lamp = new THREE.PointLight(team.light, 100, 46, 2);
  lamp.position.y = CORE_HEIGHT;
  g.add(lamp);

  crystals.push({ mesh: crystal, lamp, seed: team.id === 'anito' ? 0 : 2.1 });
  return g;
}


/**
 * The map floor.
 *
 * ⚠ DELIBERATELY PLAIN, AND THAT IS THE PLAN THIS TIME. A previous attempt at
 * this map spent its effort on procedurally dressing the terrain and was
 * rejected as ugly, correctly: vertex-coloured ground with primitive props
 * cannot reach the concept art. So the floor stays a quiet stage and the LOOK
 * arrives as generated assets placed on it, one element at a time.
 *
 * The two realms are still readable, because the ground under each half is
 * tinted toward that team without pretending to be scenery.
 */
export function buildGround(): THREE.Mesh {
  const size = HALF * 2;
  const geo = new THREE.PlaneGeometry(size, size, 96, 96);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const anito = new THREE.Color('#5f8f4a');
  const malakas = new THREE.Color('#4a6f7f');
  const BED = new THREE.Color('#6b7a5c');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // The seam runs north-west to south-east, which is the river's line in the
    // brief, so the two halves already read correctly before the river exists.
    const t = Math.max(0, Math.min(1, (x - z) / 90 + 0.5));
    c.copy(anito).lerp(malakas, t);
    const grain = Math.sin(x * 0.7 + z * 1.3) * 0.5 + 0.5;
    c.offsetHSL(0, 0, (grain - 0.5) * 0.05);
    // The riverbed is silt, not grass, and it has to read as bed even where the
    // water above it is thin.
    const wet = riverDepth(x, z);
    if (wet > 0) c.lerp(BED, Math.min(1, wet * 1.5));
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
    // ⚠ THE TROUGH IS CARVED HERE, not drawn as a separate mesh. The river's
    // shape belongs to the ground, so anything standing near a bank sits on a
    // slope rather than hovering over a hole.
    pos.setY(i, riverFloor(x, z) + (grain - 0.5) * 0.3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();

  const floor = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.02 })
  );
  floor.receiveShadow = true;
  floor.name = 'ground';
  return floor;
}
