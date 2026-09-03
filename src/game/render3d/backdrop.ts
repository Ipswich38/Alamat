// the Fire Peak Volcano & LAVA SYSTEM — Scaled 3.5x, towering over NW quadrant, with ERUPTING crater lava lake,
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
  group.name = 'master-environment-backdrop';

  // 1. Mayon Volcano Environment Group (North-West)
  const mayonGroup = new THREE.Group();
  mayonGroup.name = 'mayon-volcano-environment';
  mayonGroup.position.set(MAYON_POS.x, MAYON_POS.y, MAYON_POS.z);

  // Basalt cliff foundation connecting volcano slopes into NW lane boundary
  const cliffBase = buildBasaltCliffs();
  mayonGroup.add(cliffBase);

  // Volcanic magma fissures / vents around the base
  const fissures = buildMagmaFissures();
  mayonGroup.add(fissures.group);

  // LAVA LAKE inside crater + LAVA FLOWS down slopes (real lava, not just glow)
  const lavaLake = buildLavaLake();
  mayonGroup.add(lavaLake.group);
  const lavaFlows = buildLavaFlows();
  mayonGroup.add(lavaFlows.group);
  const lavaGlow = buildVolcanoGlow();
  mayonGroup.add(lavaGlow);

  // Crater smoke plume and glowing lava embers
  const plume = buildCraterPlume();
  mayonGroup.add(plume.group);

  // Volumetric God-Rays over the crater rim
  const godRays = buildVolumetricGodRays();
  mayonGroup.add(godRays.group);

  // Load and scale 3D the Fire Peak Volcano model - ENHANCED VERSION
  // Try to load the high-quality mayon.glb model first
  let volcanoModel: THREE.Group | null = null;
  
  new GLTFLoader()
    .loadAsync('/models/nature/mayon.glb')
    .then((gltf) => {
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const unit = MAYON_HEIGHT / Math.max(size.y, 0.0001);
      model.scale.setScalar(unit * 1.1); // Slightly larger for better visibility
      model.position.set(0, -box.min.y * unit * 1.1, 0);
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
          // Enhanced volcanic material with better lighting
          if (std.color) std.color.set(0x282322).lerp(new THREE.Color('#4a3a2e'), 0.6);
          std.roughness = 0.85;
          std.metalness = 0.08;
          std.envMapIntensity = 1.5; // Better reflections
        }
      });

      volcanoModel = model;
      mayonGroup.add(model);
      
      // Add enhanced glow effect around the volcano
      const volcanoGlow = new THREE.PointLight(0xff6600, 2, 150);
      volcanoGlow.position.set(0, MAYON_HEIGHT * 0.7, 0);
      volcanoGlow.castShadow = true;
      mayonGroup.add(volcanoGlow);
      
      // Add ambient glow for the volcanic area
      const ambientGlow = new THREE.Mesh(
        new THREE.SphereGeometry(80, 16, 16),
        new THREE.MeshBasicMaterial({
          color: 0xff4400,
          transparent: true,
          opacity: 0.15,
          side: THREE.BackSide
        })
      );
      ambientGlow.position.set(0, MAYON_HEIGHT * 0.5, 0);
      mayonGroup.add(ambientGlow);
      
    })
    .catch(() => {
      /* Enhanced fallback procedural volcano if asset fails */
      const coneGeo = new THREE.ConeGeometry(95, MAYON_HEIGHT, 48, 1, true); // More segments for smoother shape
      const coneMat = new THREE.MeshStandardMaterial({
        color: 0x2d2422,
        roughness: 0.85,
        metalness: 0.1,
        flatShading: false
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.y = MAYON_HEIGHT / 2;
      cone.castShadow = true;
      cone.receiveShadow = true;
      mayonGroup.add(cone);
      
      // Add crater effect to the top
      const craterGeo = new THREE.CylinderGeometry(25, 30, 8, 32);
      const craterMat = new THREE.MeshStandardMaterial({
        color: 0x1a1210,
        roughness: 0.95,
        metalness: 0.05
      });
      const crater = new THREE.Mesh(craterGeo, craterMat);
      crater.position.y = MAYON_HEIGHT - 4;
      crater.rotation.x = Math.PI / 2;
      mayonGroup.add(crater);
      
      // Add glow even to the fallback volcano
      const fallbackGlow = new THREE.PointLight(0xff4400, 1.5, 100);
      fallbackGlow.position.set(0, MAYON_HEIGHT * 0.8, 0);
      mayonGroup.add(fallbackGlow);
    });

  group.add(mayonGroup);

  // 2. 360-Degree Surrounding Mountain Panorama & Karst Spires (Sierra Madre / Coastal Ridges)
  const surroundingMountains = buildSurroundingMountainRanges();
  group.add(surroundingMountains);

  return {
    group,
    attach: () => {
      // Kept for interface compatibility
    },
    update: (t) => {
      fissures.update(t);
      lavaLake.update(t);
      lavaFlows.update(t);
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

/**
 * 360-Degree Surrounding Mountain Panorama:
 * Sierra Madre tropical ridges, karst limestone spires, and layered misty horizon peaks.
 */
function buildSurroundingMountainRanges(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'surrounding-mountain-ranges';

  const PEAK_COUNT = 32;

  // 1. Primary Mountain Ridges (Layered Dodecahedron & Cone Geometry)
  const mountainGeo = new THREE.ConeGeometry(55, 95, 7, 2);
  mountainGeo.scale(1.4, 1.0, 1.1);

  const mountainMesh = new THREE.InstancedMesh(
    mountainGeo,
    surfaceMaterial(0x1a3b2b, { roughness: 0.94, metalness: 0.04 }),
    PEAK_COUNT
  );
  mountainMesh.receiveShadow = true;
  mountainMesh.castShadow = true;
  mountainMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PEAK_COUNT * 3), 3);

  const o = new THREE.Object3D();
  const c = new THREE.Color();
  const innerColor = new THREE.Color('#1B4D2E'); // Deep Rainforest Green
  const midColor = new THREE.Color('#173E36');   // Misty Slate Emerald
  const outerColor = new THREE.Color('#122830'); // Distant Atmospheric Haze

  for (let i = 0; i < PEAK_COUNT; i++) {
    // Distribute around 360 degrees (0 to 2*PI), omitting NW volcano sector (angle ~ 3.6 to 4.2 rad)
    let a = (i / PEAK_COUNT) * Math.PI * 2;
    if (a > 3.5 && a < 4.3) {
      a += 0.8; // Shift away from Mayon
    }

    const tier = i % 3; // 0 = Inner Ridge, 1 = Mid Ridge, 2 = Outer Ridge
    const dist = 160 + tier * 45 + ((i * 17) % 35);
    const height = 65 + tier * 25 + ((i * 23) % 40);
    const scale = 0.85 + (height / 95) * 0.5;

    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    const y = height * 0.45 - 6;

    o.position.set(x, y, z);
    o.rotation.set(0.1 * ((i % 3) - 1), a + Math.PI * 0.35, 0.08 * ((i % 2) - 0.5));
    o.scale.set(scale * (1 + ((i % 4) * 0.15)), scale, scale * (1 + ((i % 3) * 0.12)));
    o.updateMatrix();
    mountainMesh.setMatrixAt(i, o.matrix);

    if (tier === 0) {
      c.copy(innerColor).lerp(new THREE.Color('#2A6538'), (i % 5) * 0.1);
    } else if (tier === 1) {
      c.copy(midColor).lerp(new THREE.Color('#1F4F42'), (i % 4) * 0.12);
    } else {
      c.copy(outerColor).lerp(new THREE.Color('#18323E'), (i % 3) * 0.15);
    }
    mountainMesh.setColorAt(i, c);
  }
  group.add(mountainMesh);

  // 2. Karst Limestone Spires (Palawan / Coron Spires on the West/South-West flanks)
  const SPIRE_COUNT = 14;
  const spireGeo = new THREE.CylinderGeometry(4.5, 14, 85, 6, 2);
  spireGeo.scale(1.1, 1.0, 1.3);

  const spireMesh = new THREE.InstancedMesh(
    spireGeo,
    surfaceMaterial(0x283833, { roughness: 0.95 }),
    SPIRE_COUNT
  );
  spireMesh.receiveShadow = true;
  spireMesh.castShadow = true;
  spireMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SPIRE_COUNT * 3), 3);

  const cSpire = new THREE.Color('#223830');

  for (let i = 0; i < SPIRE_COUNT; i++) {
    const a = Math.PI * 0.85 + (i / SPIRE_COUNT) * Math.PI * 0.8; // West to South flank
    const dist = 145 + ((i * 29) % 55);
    const height = 55 + ((i * 19) % 35);
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;

    o.position.set(x, height * 0.48 - 4, z);
    o.rotation.set(0.08, i * 1.4, 0.05);
    o.scale.set(0.9 + ((i % 3) * 0.2), height / 85, 0.9 + ((i % 4) * 0.2));
    o.updateMatrix();
    spireMesh.setMatrixAt(i, o.matrix);

    c.copy(cSpire).lerp(new THREE.Color('#334E45'), (i % 4) * 0.2);
    spireMesh.setColorAt(i, c);
  }
  group.add(spireMesh);

  return group;
}

/**
 * LAVA LAKE — bubbling molten core inside the crater (emissive, bloom-friendly).
 */
function buildLavaLake(): { group: THREE.Group; update: (t: number) => void } {
  const group = new THREE.Group();
  // Crater floor lava disc
  const lakeGeo = new THREE.CircleGeometry(38, 32);
  lakeGeo.rotateX(-Math.PI / 2);
  const lakeMat = new THREE.MeshBasicMaterial({
    color: 0xff4d00,
    transparent: true,
    opacity: 0.92,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const lake = new THREE.Mesh(lakeGeo, lakeMat);
  lake.position.set(0, CRATER_HEIGHT - 6, 0);
  lake.renderOrder = 3;
  group.add(lake);

  // Brighter inner core
  const coreGeo = new THREE.CircleGeometry(22, 24);
  coreGeo.rotateX(-Math.PI / 2);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xff8c00,
    transparent: true,
    opacity: 0.95,
    toneMapped: false,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.set(0, CRATER_HEIGHT - 5.6, 0);
  core.renderOrder = 3;
  group.add(core);

  // Point light for lava glow
  const glow = new THREE.PointLight(0xff4500, 8, 140);
  glow.position.set(0, CRATER_HEIGHT + 8, 0);
  group.add(glow);

  return {
    group,
    update: (t) => {
      const pulse = 0.85 + Math.sin(t * 2.4) * 0.15;
      lakeMat.opacity = 0.88 * pulse;
      coreMat.opacity = 0.95 * pulse;
      glow.intensity = 7 + Math.sin(t * 3.0) * 2.5;
      // subtle bubbling scale
      const s = 1 + Math.sin(t * 1.8) * 0.04;
      lake.scale.set(s, 1, s);
      core.scale.set(1 + Math.sin(t * 2.2 + 1.1) * 0.06, 1, 1 + Math.sin(t * 2.2 + 1.1) * 0.06);
    },
  };
}

/**
 * LAVA FLOWS — 3 molten rivers pouring down the volcano slopes toward the jungle.
 * Each is a plane with emissive orange + inner bright core, pulsing downstream.
 */
function buildLavaFlows(): { group: THREE.Group; update: (t: number) => void } {
  const group = new THREE.Group();
  const mats: THREE.MeshBasicMaterial[] = [];
  const coreMats: THREE.MeshBasicMaterial[] = [];

  const FLOW_COUNT = 3;
  for (let i = 0; i < FLOW_COUNT; i++) {
    const angle = -Math.PI * 0.18 + (i / FLOW_COUNT) * Math.PI * 0.9; // SE-facing flows
    const length = 85 + (i % 2) * 28;
    const width = 6.5 + (i % 2) * 2.5;

    // Main lava flow plane draped on slope
    const geo = new THREE.PlaneGeometry(width, length, 4, 12);
    geo.rotateX(-Math.PI / 2);
    // Bend to follow slope: raise crater end, lower jungle end
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < pos.count; v++) {
      const vz = pos.getZ(v);
      const t = (vz + length / 2) / length; // 0 at jungle, 1 at crater
      const slopeY = t * 42 - (1 - t) * 8; // high at crater
      pos.setY(v, pos.getY(v) + slopeY);
      // taper width toward bottom
      const taper = 0.7 + t * 0.5;
      pos.setX(v, pos.getX(v) * taper);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshBasicMaterial({
      color: 0xff3b00,
      transparent: true,
      opacity: 0.88,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    mats.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    // Position so top touches crater rim
    const dist = 42;
    mesh.position.set(Math.cos(angle) * dist, CRATER_HEIGHT - 18, Math.sin(angle) * dist);
    mesh.rotation.y = angle;
    mesh.renderOrder = 4;
    group.add(mesh);

    // Brighter inner flow
    const coreGeo = new THREE.PlaneGeometry(width * 0.42, length * 0.92, 2, 8);
    coreGeo.rotateX(-Math.PI / 2);
    const cpos = coreGeo.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < cpos.count; v++) {
      const vz = cpos.getZ(v);
      const t = (vz + length * 0.46) / (length * 0.92);
      const slopeY = t * 42 - (1 - t) * 8;
      cpos.setY(v, cpos.getY(v) + slopeY + 0.15);
    }
    coreGeo.computeVertexNormals();
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffa500,
      transparent: true,
      opacity: 0.92,
      toneMapped: false,
    });
    coreMats.push(coreMat);
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.copy(mesh.position);
    core.position.y += 0.08;
    core.rotation.y = angle;
    core.renderOrder = 4;
    group.add(core);
  }

  return {
    group,
    update: (t) => {
      const pulse = 0.82 + Math.sin(t * 2.0) * 0.18;
      for (let i = 0; i < mats.length; i++) {
        mats[i].opacity = 0.88 * (pulse + (i % 2) * 0.08);
        coreMats[i].opacity = 0.92 * pulse;
      }
    },
  };
}

/**
 * Volcano ambient glow — large soft hemisphere light + fog tint near volcano.
 */
function buildVolcanoGlow(): THREE.Group {
  const g = new THREE.Group();
  const light = new THREE.PointLight(0xff4400, 12, 180);
  light.position.set(15, 22, 15);
  g.add(light);
  // Soft glow sprite
  const spriteGeo = new THREE.SphereGeometry(28, 12, 12);
  const spriteMat = new THREE.MeshBasicMaterial({
    color: 0xff4500,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Mesh(spriteGeo, spriteMat);
  sprite.position.set(0, 12, 0);
  sprite.scale.set(1.8, 0.7, 1.8);
  g.add(sprite);
  return g;
}
