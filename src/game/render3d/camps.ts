// The jungle camps, drawn.
//
// ── WHY A CAMP IS MOSTLY LIGHT ──────────────────────────────────────────────
// A camp has to be findable from outside the jungle it hides in, or nobody goes
// looking for it. The idol is the reward for arriving; the GLOW is what tells a
// player there is something worth arriving at. So the light anchor is the load
// bearing part of this file and the statue is the payoff.
//
// One real point light per camp, which is four across the map. That is a
// deliberate expense on top of the two base lights, and it is the last of them:
// everything else that glows in this game is unlit geometry above the bloom
// threshold, which costs nothing per material.

import * as THREE from 'three';
import { CAMPS, type Camp } from '@/game/arena/camps';
import { loadModel } from './models';
import { surfaceMaterial } from './stage';
import { terrainHeight } from './terrain';

export interface Camps {
  group: THREE.Group;
  update(t: number): void;
  dispose(): void;
}

export function createCamps(): Camps {
  const group = new THREE.Group();
  group.name = 'camps';
  const anchors: { lamp: THREE.PointLight; motes: THREE.Points; seed: number }[] = [];

  for (const [i, camp] of CAMPS.entries()) {
    group.add(clearing(camp, i, anchors));
  }

  // Distinct 3D cultural props for each jungle camp category:
  // 1. Bulul Idols for Bulul Guardian camps (NW & SE)
  loadModel('/models/props/bulul.glb', { height: 3.4 }).then((model) => {
    if (!model) return;
    for (const camp of CAMPS.filter((c) => c.id.startsWith('bulul'))) {
      const idol = model.clone(true);
      idol.position.set(camp.x, terrainHeight(camp.x, camp.z), camp.z);
      idol.rotation.y = Math.atan2(-camp.x, -camp.z);
      group.add(idol);
    }
  });

  // 2. Ancient Dong Son Sunburst Drums for Tikbalang Trickster camps (NW & SE)
  loadModel('/models/props/dongSonDrum.glb', { height: 2.6 }).then((model) => {
    if (!model) return;
    for (const camp of CAMPS.filter((c) => c.id.startsWith('tikbalang'))) {
      const drum = model.clone(true);
      drum.position.set(camp.x, terrainHeight(camp.x, camp.z), camp.z);
      drum.rotation.y = Math.atan2(-camp.x, -camp.z);
      group.add(drum);
    }
  });

  // 3. Sacred Kim Quy Turtle Altars for Aswang Stalker camps (NE & SW)
  loadModel('/models/props/kimQuyAltar.glb', { height: 3.0 }).then((model) => {
    if (!model) return;
    for (const camp of CAMPS.filter((c) => c.id.startsWith('aswang'))) {
      const altar = model.clone(true);
      altar.position.set(camp.x, terrainHeight(camp.x, camp.z), camp.z);
      altar.rotation.y = Math.atan2(-camp.x, -camp.z);
      group.add(altar);
    }
  });

  // Hide placeholder stubs for all decorated camps
  group.traverse((n) => {
    if (n.name === 'idol-placeholder') n.visible = false;
  });

  return {
    group,
    update: (t) => {
      for (const a of anchors) {
        // Breathing on its own offset, so four camps do not pulse together.
        a.lamp.intensity = 34 + Math.sin(t * 1.3 + a.seed) * 12;
        a.motes.rotation.y = t * 0.16 + a.seed;
        a.motes.position.y = 1.4 + Math.sin(t * 0.7 + a.seed) * 0.3;
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

function clearing(
  camp: Camp,
  i: number,
  anchors: { lamp: THREE.PointLight; motes: THREE.Points; seed: number }[]
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(camp.x, terrainHeight(camp.x, camp.z), camp.z);

  // The pocket floor: trodden ground, a shade lighter than the jungle. This is
  // what makes a clearing read as a clearing rather than as a statue in grass.
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(camp.radius, camp.radius + 0.8, 0.34, 24),
    surfaceMaterial(0x7a6a44, { roughness: 0.98 })
  );
  floor.position.y = 0.12;
  floor.receiveShadow = true;
  g.add(floor);

  // The ring, in the camp's own colour, so which buff this is can be read
  // before the idol resolves.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(camp.radius - 0.6, camp.radius, 40),
    new THREE.MeshBasicMaterial({
      color: camp.light,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      toneMapped: false,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.3;
  g.add(ring);

  // A stand-in idol, kept until the generated one lands and then hidden. Every
  // generated asset here upgrades something already legible.
  const stub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 1.0, 2.6, 6),
    surfaceMaterial(0x4a3826, { roughness: 0.95 })
  );
  stub.position.y = 1.3;
  stub.castShadow = true;
  stub.name = 'idol-placeholder';
  g.add(stub);

  // Motes drifting over the clearing. Cheap, and they are what stops a camp
  // reading as scenery when nothing is standing in it.
  const COUNT = 26;
  const pos = new Float32Array(COUNT * 3);
  for (let n = 0; n < COUNT; n++) {
    const a = (n / COUNT) * Math.PI * 2;
    const r = 1 + (n % 5) * 0.7;
    pos[n * 3] = Math.cos(a) * r;
    pos[n * 3 + 1] = ((n * 37) % 100) / 100 * 1.6;
    pos[n * 3 + 2] = Math.sin(a) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: camp.light,
      size: 0.34,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      toneMapped: false,
    })
  );
  motes.position.y = 1.4;
  g.add(motes);

  const lamp = new THREE.PointLight(camp.light, 34, 26, 2);
  lamp.position.y = 2.4;
  g.add(lamp);

  anchors.push({ lamp, motes, seed: i * 1.7 });
  return g;
}
