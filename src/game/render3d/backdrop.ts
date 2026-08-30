// the Fire Peak Volcano 3D integration: Scaled 3.5x, towering over the North-West quadrant,
// with volcanic crater smoke/ash plume, glowing lava embers, magma fissures, basalt cliffs,
// and volumetric god-rays streaming over the crater rim.
//
// ── ARCHITECTURE & REFACTOR HIGHLIGHTS ─────────────────────────────────────────
// 1. Positioned directly at the NW jungle boundary (-95, -4, -95), physically merging with terrain.
// 2. Scaled up 3.5x (height ~200 units, base radius ~95 units), dominating the skyline.
// 3. Basalt cliff foundation framing the North-West lane (Bukid).
// 4. Crater plume: rising dark ash clouds + glowing lava sparks/embers.
// 5. Pulsing magma fissures & lava vents with emissive bright lava orange (#FF4500).
// 6. Volumetric god-rays streaming over the crater rim toward the map center.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { surfaceMaterial } from './stage';

/** World location of the Fire Peak at the North-West boundary */
export const MAYON_POS = { x: -95, y: -4, z: -95 };

/** 3.5x scaled height */
const MAYON_HEIGHT = 195;

/** Crater top height relative to base */
const CRATER_HEIGHT = MAYON_HEIGHT * 0.62;

export interface Backdrop {
  group: THREE.Group;
  attach(camera: THREE.Object3D): void;
  update(t: number): void;
  dispose(): void;
}

export function createBackdrop(): Backdrop {
  const group = new THREE.Group();
  group.name = 'mayon-volcano-environment';
  group.position.set(MAYON_POS.x, MAYON_POS.y, MAYON_POS.z);

  // 1. Basalt cliff foundation connecting volcano slopes into NW lane boundary
  const cliffBase = buildBasaltCliffs();
  group.add(cliffBase);

  // 2. Volcanic magma fissures / vents around the base
  const fissures = buildMagmaFissures();
  group.add(fissures.group);

  // 3. Crater smoke plume and glowing lava embers
  const plume = buildCraterPlume();
  group.add(plume.group);

  // 4. Volumetric God-Rays over the crater rim
  const godRays = buildVolumetricGodRays();
  group.add(godRays.group);

  // 5. Load and scale 3D the Fire Peak Volcano model
  new GLTFLoader()
    .loadAsync('/models/nature/mayon.glb')
    .then((gltf) => {
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const unit = MAYON_HEIGHT / Math.max(size.y, 0.0001);
      model.scale.setScalar(unit);
      model.position.set(0, -box.min.y * unit, 0);
      model.rotation.y = Math.PI * 0.25;

      model.traverse((n) => {
        const m = n as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;

        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          const std = mat as THREE.MeshStandardMaterial;
          std.fog = false;
          // Volcanic dark basalt tint with subtle warm glow
          if (std.color) std.color.set(0x282322).lerp(new THREE.Color('#382e2c'), 0.4);
          std.roughness = 0.94;
          std.metalness = 0.06;
        }
      });

      group.add(model);
    })
    .catch(() => {
      /* Fallback procedural volcano cone if asset fails */
      const coneGeo = new THREE.ConeGeometry(95, MAYON_HEIGHT, 36, 1, true);
      const coneMat = surfaceMaterial(0x2d2422, { roughness: 0.95 });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.y = MAYON_HEIGHT / 2;
      group.add(cone);
    });

  return {
    group,
    attach: () => {
      // Kept for interface compatibility
    },
    update: (t) => {
      fissures.update(t);
      plume.update(t);
      godRays.update(t);
    },
    dispose: () => {
      group.traverse((n) => {
        const m = n as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mat of mats) mat.dispose();
        }
      });
    },
  };
}

/**
 * Basalt cliff walls forming the transition from the volcano base into the NW lane.
 */
function buildBasaltCliffs(): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.DodecahedronGeometry(12, 1);
  geo.scale(1.6, 0.9, 1.3);
  const COUNT = 18;
  const mesh = new THREE.InstancedMesh(
    geo,
    surfaceMaterial(0x221d1c, { roughness: 0.96 }),
    COUNT
  );
  mesh.receiveShadow = true;
  mesh.castShadow = true;

  const o = new THREE.Object3D();
  for (let i = 0; i < COUNT; i++) {
    const a = (i / COUNT) * Math.PI * 1.5 - Math.PI * 0.25;
    const r = 55 + (i % 3) * 12;
    o.position.set(Math.cos(a) * r + 20, 6 + (i % 4) * 3, Math.sin(a) * r + 20);
    o.rotation.set(0.3, i * 1.2, 0.2);
    o.scale.setScalar(1.2 + (i % 3) * 0.4);
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
  }
  g.add(mesh);
  return g;
}

/**
 * Magma cracks and glowing lava vents at the base of the volcano.
 */
function buildMagmaFissures(): { group: THREE.Group; update: (t: number) => void } {
  const group = new THREE.Group();
  const FISSURE_COUNT = 14;

  const fissureMats: THREE.MeshBasicMaterial[] = [];

  for (let i = 0; i < FISSURE_COUNT; i++) {
    const a = (i / FISSURE_COUNT) * Math.PI * 1.6 - Math.PI * 0.3;
    const r = 42 + (i % 4) * 14;
    const x = Math.cos(a) * r + 22;
    const z = Math.sin(a) * r + 22;

    const length = 8 + (i % 3) * 6;
    const width = 1.2 + (i % 2) * 0.8;

    const geo = new THREE.PlaneGeometry(length, width, 8, 2);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      color: 0xff4500,
      transparent: true,
      opacity: 0.9,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    fissureMats.push(mat);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.45, z);
    mesh.rotation.y = a + Math.PI / 2 + (i % 3) * 0.4;
    mesh.renderOrder = 4;
    group.add(mesh);

    // Glowing core ribbon
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffa500,
      transparent: true,
      opacity: 0.95,
      toneMapped: false,
    });
    const coreGeo = new THREE.PlaneGeometry(length * 0.85, width * 0.35);
    coreGeo.rotateX(-Math.PI / 2);
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.set(x, 0.48, z);
    coreMesh.rotation.y = mesh.rotation.y;
    group.add(coreMesh);
  }

  return {
    group,
    update: (t) => {
      const pulse = 0.75 + Math.sin(t * 3.2) * 0.25;
      for (const m of fissureMats) {
        m.opacity = pulse * 0.92;
      }
    },
  };
}

/**
 * Crater ash plume and rising glowing lava spark particles.
 */
function buildCraterPlume(): { group: THREE.Group; update: (t: number) => void } {
  const group = new THREE.Group();
  const ASH_COUNT = 45;
  const EMBER_COUNT = 35;

  // 1. Ash clouds
  const ashGeo = new THREE.IcosahedronGeometry(6.5, 1);
  const ashMesh = new THREE.InstancedMesh(
    ashGeo,
    new THREE.MeshStandardMaterial({
      color: 0x221f1e,
      roughness: 0.98,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      fog: false,
    }),
    ASH_COUNT
  );
  ashMesh.renderOrder = 5;

  const ashData: { seed: number; speed: number; rotSpeed: number; drift: number }[] = [];
  for (let i = 0; i < ASH_COUNT; i++) {
    ashData.push({
      seed: i * 2.37,
      speed: 4.5 + (i % 5) * 1.8,
      rotSpeed: 0.2 + (i % 4) * 0.15,
      drift: ((i % 7) - 3) * 2.2,
    });
  }
  group.add(ashMesh);

  // 2. Glowing lava embers
  const emberGeo = new THREE.SphereGeometry(0.75, 6, 6);
  const emberMesh = new THREE.InstancedMesh(
    emberGeo,
    new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.95,
      toneMapped: false,
    }),
    EMBER_COUNT
  );
  emberMesh.renderOrder = 6;

  const emberData: { seed: number; speed: number; radius: number }[] = [];
  for (let i = 0; i < EMBER_COUNT; i++) {
    emberData.push({
      seed: i * 3.14,
      speed: 7.5 + (i % 4) * 3.2,
      radius: 4 + (i % 6) * 2.5,
    });
  }
  group.add(emberMesh);

  const o = new THREE.Object3D();

  return {
    group,
    update: (t) => {
      // Update ash particles
      for (let i = 0; i < ASH_COUNT; i++) {
        const d = ashData[i];
        const age = (t * d.speed + d.seed * 30) % 80;
        const progress = age / 80;

        const y = CRATER_HEIGHT + age * 1.2;
        const spread = progress * 24;
        const x = Math.sin(t * 0.4 + d.seed) * spread + d.drift;
        const z = Math.cos(t * 0.4 + d.seed) * spread + d.drift;

        o.position.set(x, y, z);
        o.rotation.set(t * d.rotSpeed, t * d.rotSpeed * 0.8, 0);
        o.scale.setScalar(1 + progress * 3.2);
        o.updateMatrix();
        ashMesh.setMatrixAt(i, o.matrix);
      }
      ashMesh.instanceMatrix.needsUpdate = true;

      // Update lava embers
      for (let i = 0; i < EMBER_COUNT; i++) {
        const d = emberData[i];
        const age = (t * d.speed + d.seed * 20) % 50;
        const progress = age / 50;

        const a = t * 1.4 + d.seed;
        const r = d.radius + progress * 8;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const y = CRATER_HEIGHT + age * 1.8;

        o.position.set(x, y, z);
        o.scale.setScalar((1 - progress * 0.6) * 1.2);
        o.updateMatrix();
        emberMesh.setMatrixAt(i, o.matrix);
      }
      emberMesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/**
 * Volumetric god-rays streaming over the crater rim toward the map center.
 */
function buildVolumetricGodRays(): { group: THREE.Group; update: (t: number) => void } {
  const group = new THREE.Group();
  const RAY_COUNT = 6;
  const rayMats: THREE.MeshBasicMaterial[] = [];

  for (let i = 0; i < RAY_COUNT; i++) {
    const angleOffset = (i / RAY_COUNT) * 0.5 - 0.25;
    // Ray cylinder/cone stretching from crater down toward center map (SE direction)
    const rayGeo = new THREE.CylinderGeometry(4.5, 26, 160, 12, 1, true);
    rayGeo.rotateX(Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd98a,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    rayMats.push(mat);

    const ray = new THREE.Mesh(rayGeo, mat);
    ray.position.set(20 + i * 5, CRATER_HEIGHT - 35, 20 + i * 5);
    // Angle pointing down and towards arena center
    ray.rotation.set(0.65, Math.PI * 0.25 + angleOffset, 0);
    ray.renderOrder = 7;
    group.add(ray);
  }

  return {
    group,
    update: (t) => {
      for (let i = 0; i < rayMats.length; i++) {
        rayMats[i].opacity = 0.12 + Math.sin(t * 0.9 + i * 1.3) * 0.05;
      }
    },
  };
}
