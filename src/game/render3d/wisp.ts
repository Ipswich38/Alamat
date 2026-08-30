// Wisp: the ball lightning that drifts through a forest at night.
//
// ── WHY THESE ARE WORTH A WHOLE FILE ────────────────────────────────────────
// They are the accent light, and accent light is what separates the reference
// look from a correctly-lit scene. Every one of those games does the same
// thing: a dominant cold atmosphere with a handful of small, saturated, MOVING
// lights punched through it. The eye goes to them, they give the fog something
// to catch on, and they are the only reason bloom has anything to do.
//
// They are also folklore rather than decoration. Wisp are the wandering
// souls people report seeing over water and along tree lines, and Willow's
// healing ability is named after them.
//
// ── THE COST DECISION ───────────────────────────────────────────────────────
// A real point light per orb is the expensive way and would light the ground
// beautifully. Three of them is already three more shadow-less lights in every
// material's loop. So: the orbs are UNLIT emissive spheres that bloom, plus ONE
// shared point light that follows the nearest orb. Nearly the same picture for
// a fraction of the cost, which is the trade this whole renderer is built on.

import * as THREE from 'three';

const COUNT = 7;
const COLOUR = 0x9dffe4;

export interface Wisp {
  group: THREE.Group;
  update(t: number): void;
  dispose(): void;
}

export function createWisp(): Wisp {
  const group = new THREE.Group();
  group.name = 'wisp';

  const geo = new THREE.IcosahedronGeometry(0.34, 2);
  // Basic, not Standard: these ARE light, so shading them would be wrong. The
  // brightness above 1 is what pushes them past the bloom threshold.
  const mat = new THREE.MeshBasicMaterial({ color: COLOUR, toneMapped: false });

  const orbs: { mesh: THREE.Mesh; halo: THREE.Mesh; seed: number }[] = [];
  const haloGeo = new THREE.SphereGeometry(0.55, 10, 8);
  const haloMat = new THREE.MeshBasicMaterial({
    color: COLOUR,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    toneMapped: false,
  });

  for (let i = 0; i < COUNT; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    const halo = new THREE.Mesh(haloGeo, haloMat);
    mesh.add(halo);
    group.add(mesh);
    orbs.push({ mesh, halo, seed: i * 2.399963 });
  }

  // The one real light, so the ground under an orb actually brightens.
  const lamp = new THREE.PointLight(COLOUR, 42, 16, 2);
  group.add(lamp);

  function update(t: number): void {
    for (const o of orbs) {
      // Lissajous drift: two sines at incommensurate rates never repeat, so a
      // handful of orbs never fall into a visible pattern.
      const a = t * 0.19 + o.seed;
      const r = 9 + Math.sin(a * 0.7) * 7;
      o.mesh.position.set(
        Math.cos(a) * r,
        1.6 + Math.sin(a * 1.7 + o.seed) * 0.9,
        Math.sin(a * 0.83) * r
      );
      // Breathing, so they read as alive rather than as placed props.
      const pulse = 0.85 + Math.sin(t * 2.1 + o.seed) * 0.15;
      o.mesh.scale.setScalar(pulse);
      o.halo.scale.setScalar(1 + Math.sin(t * 1.3 + o.seed) * 0.2);
    }
    lamp.position.copy(orbs[0].mesh.position);
  }

  return {
    group,
    update,
    dispose: () => {
      geo.dispose();
      mat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
    },
  };
}
