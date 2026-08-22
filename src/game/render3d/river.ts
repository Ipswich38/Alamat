// The river, drawn: the water surface and the three bridges over it.
//
// ── WHY THE WATER IS ITS OWN SURFACE ────────────────────────────────────────
// The trough is carved into the ground mesh, so the river already has a shape
// before anything is drawn on top. This adds only the WATER: a translucent
// plane sitting a little above the trough floor, so the bank slopes disappear
// under it and the river has a visible surface you can see the bed through.
//
// Drawn as one plane for the whole map and clipped by opacity rather than by
// geometry, because a plane is one draw call and cutting the river's outline
// into a mesh is a lot of triangles to solve a problem alpha already solves.

import * as THREE from 'three';
import { RIVER_DEPTH, RIVER_WIDTH, findCrossings, riverDepth } from '@/game/arena/river';
import { HALF } from '@/game/arena/nexus';
import { loadModel } from './models';
import { surfaceMaterial } from './stage';

export interface River {
  group: THREE.Group;
  update(t: number): void;
  dispose(): void;
}

export function createRiver(): River {
  const group = new THREE.Group();
  group.name = 'river';

  // ── the water ─────────────────────────────────────────────────────────────
  const size = HALF * 2;
  const geo = new THREE.PlaneGeometry(size, size, 128, 128);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const alpha = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    // Fades out at the banks, so there is no hard edge where water meets land.
    alpha[i] = Math.min(1, riverDepth(pos.getX(i), pos.getZ(i)) * 2.2);
  }
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));

  const mat = new THREE.MeshStandardMaterial({
    color: 0x4fd8e8,
    roughness: 0.18,
    metalness: 0.1,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  // The per-vertex fade is patched into the shader: three.js has no built-in
  // vertex-alpha channel on a Standard material, and this is three lines
  // against building a custom material and losing the lighting with it.
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'attribute float alpha;\nvarying float vAlpha;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vAlpha = alpha;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'varying float vAlpha;\nvoid main() {')
      .replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\n  gl_FragColor.a *= vAlpha;'
      );
  };

  const water = new THREE.Mesh(geo, mat);
  // Sits below the bank but above the trough floor, so the slopes vanish under
  // it and the river reads as having depth.
  water.position.y = -RIVER_DEPTH * 0.45;
  group.add(water);

  // Glow along the centre line. The Pasig Agimat is a charm, and per the canon
  // it is the one water in this world that shines.
  const glowGeo = new THREE.PlaneGeometry(size * 1.5, RIVER_WIDTH * 0.32);
  glowGeo.rotateX(-Math.PI / 2);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x9ffff0,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    toneMapped: false,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.y = -RIVER_DEPTH * 0.4;
  glow.rotation.y = Math.PI / 4;
  group.add(glow);

  // ── the bridges ───────────────────────────────────────────────────────────
  const crossings = findCrossings();
  const decks: THREE.Mesh[] = [];
  for (const c of crossings) {
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.5, RIVER_WIDTH + 8),
      surfaceMaterial(0x8a6a42, { roughness: 0.9 })
    );
    deck.position.set(c.x, 0.1, c.z);
    deck.rotation.y = c.bearing;
    deck.castShadow = true;
    deck.receiveShadow = true;
    deck.name = 'bridge-placeholder';
    group.add(deck);
    decks.push(deck);
  }

  // ⚠ SIZED TO THE CHANNEL, NOT PAST IT. At the river's width plus eight the
  // bridge overwhelmed the water it crossed; a crossing should read as a
  // structure ON the river rather than as a structure the river runs under.
  loadModel('/models/props/bridge.glb', { width: RIVER_WIDTH * 0.66 }).then((model) => {
    if (!model) return;
    for (const c of crossings) {
      const built = model.clone(true);
      built.position.set(c.x, 0, c.z);
      // Turned a quarter so the span lies ALONG the lane rather than across it.
      built.rotation.y = c.bearing + Math.PI / 2;
      group.add(built);
    }
    for (const d of decks) d.visible = false;
  });

  return {
    group,
    update: (t) => {
      // The water drifts. One texture-free way to say "this is moving".
      water.position.x = Math.sin(t * 0.18) * 0.6;
      water.position.z = Math.cos(t * 0.14) * 0.6;
      glowMat.opacity = 0.24 + Math.sin(t * 0.9) * 0.08;
    },
    dispose: () => {
      geo.dispose();
      mat.dispose();
      glowGeo.dispose();
      glowMat.dispose();
    },
  };
}
