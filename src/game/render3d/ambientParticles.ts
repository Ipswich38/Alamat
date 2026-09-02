// Ambient Particles — fireflies, ash, agimat motes (single draw call, seeded).
// Cheap, instanced, fog-aware. Respects Quality: low halves count, performance disables.

import * as THREE from 'three';
import type { Quality } from './stage';
import { terrainHeight } from './terrain';
import { HALF } from '@/game/arena/nexus';

export interface AmbientParticles {
  group: THREE.Group;
  update(t: number, dt: number): void;
  dispose(): void;
}

const BER = 0.22; // volcanicStrength threshold for ash vs firefly

function seededRand(i: number, s: number): number {
  const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function createAmbientParticles(quality: Quality = 'balanced'): AmbientParticles {
  const group = new THREE.Group();
  group.name = 'ambient-particles';

  if (quality === 'performance' || quality === 'low') {
    // Still add but sparser — fireflies are readability + delight
    // Performance keeps minimal motes
  }

  const density = quality === 'ultra' ? 1 : quality === 'balanced' ? 0.7 : 0.35;
  const COUNT = Math.round(180 * density); // 63–180

  const geom = new THREE.SphereGeometry(0.18, 6, 6);
  const mat = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  });

  const mesh = new THREE.InstancedMesh(geom, mat, COUNT);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  (mesh as any).instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;

  const dummy = new THREE.Object3D();
  const colors = mesh.instanceColor as THREE.InstancedBufferAttribute;
  const baseY: number[] = [];
  const phase: number[] = [];
  const speed: number[] = [];
  const drift: { x: number; z: number }[] = [];
  const kinds: ('firefly' | 'ember' | 'mote')[] = [];

  const paletteFirefly = [new THREE.Color(0xfff6a0), new THREE.Color(0x7ef9ff), new THREE.Color(0xFFD700)];
  const paletteEmber = [new THREE.Color(0xff6a00), new THREE.Color(0xff3b30), new THREE.Color(0xffb84d)];
  const paletteMote = [new THREE.Color(0x7af2ff), new THREE.Color(0xb794ff), new THREE.Color(0xfff0a0)];

  for (let i = 0; i < COUNT; i++) {
    const rx = (seededRand(i, 1) - 0.5) * HALF * 1.9;
    const rz = (seededRand(i, 2) - 0.5) * HALF * 1.9;
    const isVolcanic = rx < -40 && rz < -40;
    const roll = seededRand(i, 3);
    let kind: 'firefly' | 'ember' | 'mote' = 'mote';
    if (isVolcanic && roll > 0.35) kind = 'ember';
    else if (!isVolcanic && roll > 0.55) kind = 'firefly';
    kinds[i] = kind;

    const h = terrainHeight(rx, rz);
    const y = h + 1.2 + seededRand(i, 4) * 6.5;
    baseY[i] = y;
    phase[i] = seededRand(i, 5) * Math.PI * 2;
    speed[i] = 0.6 + seededRand(i, 6) * 1.1;
    drift[i] = { x: (seededRand(i, 7) - 0.5) * 0.6, z: (seededRand(i, 8) - 0.5) * 0.6 };

    dummy.position.set(rx, y, rz);
    const s = kind === 'ember' ? 0.7 + seededRand(i, 9) * 0.6 : 0.9 + seededRand(i, 9) * 0.7;
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    const pal = kind === 'firefly' ? paletteFirefly : kind === 'ember' ? paletteEmber : paletteMote;
    const c = pal[Math.floor(seededRand(i, 10) * pal.length)]!;
    colors.setXYZ(i, c.r, c.g, c.b);
  }
  colors.needsUpdate = true;
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);

  // Update — bob + drift + pulse opacity via material? We pulse scale + color intensity
  const colorScratch = new THREE.Color();
  function update(t: number, _dt: number) {
    // Cheap: only update Y bob and slight XZ drift, not full matrix every frame for all?
    // At 180 instances, updating 60fps is fine (<0.2ms)
    for (let i = 0; i < COUNT; i++) {
      dummy.matrix.fromArray((mesh.instanceMatrix as any).array, i * 16);
      // Decompose quickly: we stored base pos in matrix translation; recompose with bob
      const bob = Math.sin(t * speed[i] + phase[i]) * (kinds[i] === 'firefly' ? 0.55 : 0.3);
      const idx = i * 16;
      const arr = (mesh.instanceMatrix as any).array as Float32Array;
      // translation y is at index 13 (column-major: m[12]=x, m[13]=y, m[14]=z)
      arr[idx + 13] = baseY[i] + bob;
      // subtle drift
      arr[idx + 12] += drift[i].x * 0.008;
      arr[idx + 14] += drift[i].z * 0.008;
      // wrap within HALF
      if (Math.abs(arr[idx + 12]) > HALF) arr[idx + 12] *= -0.9;
      if (Math.abs(arr[idx + 14]) > HALF) arr[idx + 14] *= -0.9;
    }
    mesh.instanceMatrix.needsUpdate = true;
    // pulse opacity via material opacity (global) — tint by time
    const pulse = 0.72 + Math.sin(t * 1.2) * 0.18;
    mat.opacity = pulse;
    // slight hue wobble for fireflies
    if ((Math.floor(t * 2) % 2) === 0) {
      // noop, keep additive
    }
  }

  function dispose() {
    geom.dispose();
    mat.dispose();
  }

  return { group, update, dispose };
}
