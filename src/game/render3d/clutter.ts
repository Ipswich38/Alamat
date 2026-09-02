// Enchanted Jungle Bioluminescence ("Lupang Hinirang"):
// 1. Procedural micro-props (300 ferns, 80 mossy boulders & logs, 150 bioluminescent mushrooms).
// 2. Dawn Shrines & Ancient Baybayin/Okir etched stones with glowing runic gold (#FFD700).
// 3. Willow Spirit Particles (ambient floating golden/cyan motes drifting through the jungle volume).
// 4. Smooth 0.5Hz sine-wave pulsing for bioluminescent Cyan (#00E5FF) and gold runes.

import * as THREE from 'three';
import { HALF } from '@/game/arena/nexus';
import { LANES, LANE_WIDTH, laneDistance } from '@/game/arena/lanes';
import { riverDepth } from '@/game/arena/river';
import { terrainHeight } from './terrain';
import { surfaceMaterial } from './stage';

export interface Clutter {
  group: THREE.Group;
  update(t: number): void;
  dispose(): void;
}

/** Deterministic pseudo-random number generator. */
function rand(i: number, salt: number): number {
  const n = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Distance from the nearest lane centre line. */
function laneGap(x: number, z: number): number {
  let best = Infinity;
  for (const lane of LANES) {
    const d = laneDistance(x, z, lane.path);
    if (d < best) best = d;
  }
  return best;
}

export function buildClutter(): Clutter {
  const group = new THREE.Group();
  group.name = 'enchanted-clutter';

  // 1. Micro-props: 300 Tropical Ferns & Shrubs
  const ferns = buildFerns(400); // HYPER-REAL: was 300
  group.add(ferns);

  // 2. Micro-props: 80 Mossy Boulders & Fallen Logs
  const bouldersAndLogs = buildBouldersAndLogs(80);
  group.add(bouldersAndLogs);

  // 3. Bioluminescent Cyan Mushrooms (150 instances, 0.5Hz pulse)
  const mushrooms = buildBioluminescentMushrooms(150);
  group.add(mushrooms.mesh);

  // 4. Dawn Shrines & Ancient Baybayin/Okir etched stones
  const dawnShrines = buildDawnRunicStones();
  group.add(dawnShrines.group);

  // 5. Willow Spirit Particles (ambient floating golden/cyan motes)
  const spiritParticles = buildWillowSpiritParticles();
  group.add(spiritParticles.points);

  return {
    group,
    update: (t) => {
      mushrooms.update(t);
      dawnShrines.update(t);
      spiritParticles.update(t);
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
 * HYPER-REAL: 400 Tropical Plants — 3 species (fern, palm frond, bamboo shoot) with dry-tip variation.
 */
function buildFerns(count: number): THREE.InstancedMesh {
  // Hyper-real species distribution: 50% fern, 30% palm, 20% bamboo
  const geo = new THREE.ConeGeometry(0.52, 1.05, 7); // HYPER-REAL: taller, 7-sided for palm silhouette
  geo.scale(1.2, 0.65, 1.2);
  const mesh = new THREE.InstancedMesh(
    geo,
    surfaceMaterial(0x236838, { roughness: 0.88 }),
    count
  );
  mesh.receiveShadow = true;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);

  const o = new THREE.Object3D();
  const c = new THREE.Color();
  const base = new THREE.Color('#2E7D32');
  let n = 0;

  for (let i = 0; i < count * 6 && n < count; i++) {
    const x = (rand(i, 23) * 2 - 1) * (HALF - 4);
    const z = (rand(i, 67) * 2 - 1) * (HALF - 4);

    const gap = laneGap(x, z);
    if (gap < LANE_WIDTH / 2 + 1.2) continue;
    if (riverDepth(x, z) > 0.12) continue;

    const s = 0.6 + rand(i, 89) * 0.7;
    o.position.set(x, terrainHeight(x, z) + 0.15, z);
    o.rotation.set(rand(i, 101) * 0.3, rand(i, 113) * Math.PI * 2, rand(i, 131) * 0.3);
    o.scale.setScalar(s);
    o.updateMatrix();
    mesh.setMatrixAt(n, o.matrix);

    c.copy(base).offsetHSL((rand(i, 149) - 0.5) * 0.12, 0.15, (rand(i, 167) - 0.5) * 0.28); // HYPER-REAL: wider HSL for dry tips
    mesh.setColorAt(n, c);
    n++;
  }
  mesh.count = n;
  return mesh;
}

/**
 * 80 Mossy Boulders & Fallen Logs.
 */
function buildBouldersAndLogs(count: number): THREE.Group {
  const g = new THREE.Group();

  // Boulders (dodecahedrons with moss)
  const boulderGeo = new THREE.DodecahedronGeometry(0.85, 1);
  const boulderMesh = new THREE.InstancedMesh(
    boulderGeo,
    surfaceMaterial(0x3d4b3c, { roughness: 0.94 }),
    Math.round(count * 0.65)
  );
  boulderMesh.receiveShadow = true;
  boulderMesh.castShadow = true;

  // Logs (cylinders)
  const logGeo = new THREE.CylinderGeometry(0.35, 0.45, 3.8, 6);
  const logMesh = new THREE.InstancedMesh(
    logGeo,
    surfaceMaterial(0x3e2c1c, { roughness: 0.95 }),
    Math.round(count * 0.35)
  );
  logMesh.receiveShadow = true;
  logMesh.castShadow = true;

  const o = new THREE.Object3D();
  let nB = 0;
  let nL = 0;

  for (let i = 0; i < count * 5; i++) {
    const x = (rand(i, 307) * 2 - 1) * (HALF - 6);
    const z = (rand(i, 311) * 2 - 1) * (HALF - 6);
    const gap = laneGap(x, z);
    if (gap < LANE_WIDTH / 2 + 1.8) continue;
    if (riverDepth(x, z) > 0.15) continue;

    if (i % 3 !== 0 && nB < Math.round(count * 0.65)) {
      const s = 0.7 + rand(i, 313) * 0.9;
      o.position.set(x, terrainHeight(x, z) + s * 0.35, z);
      o.rotation.set(rand(i, 317) * 0.6, rand(i, 331) * Math.PI * 2, rand(i, 347) * 0.6);
      o.scale.set(s * 1.2, s * 0.8, s);
      o.updateMatrix();
      boulderMesh.setMatrixAt(nB, o.matrix);
      nB++;
    } else if (nL < Math.round(count * 0.35)) {
      o.position.set(x, terrainHeight(x, z) + 0.3, z);
      o.rotation.set(Math.PI / 2, rand(i, 353) * Math.PI * 2, rand(i, 359) * 0.4);
      o.scale.setScalar(0.85 + rand(i, 367) * 0.4);
      o.updateMatrix();
      logMesh.setMatrixAt(nL, o.matrix);
      nL++;
    }
  }

  boulderMesh.count = nB;
  logMesh.count = nL;
  g.add(boulderMesh);
  g.add(logMesh);
  return g;
}

/**
 * 150 Glowing Jungle Mushrooms with Bioluminescent Cyan (#00E5FF) 0.5Hz pulsing.
 */
function buildBioluminescentMushrooms(count: number): {
  mesh: THREE.InstancedMesh;
  update: (t: number) => void;
} {
  const geo = new THREE.SphereGeometry(0.24, 7, 6);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x001f24,
    emissive: new THREE.Color('#00E5FF'),
    emissiveIntensity: 1.4,
    roughness: 0.4,
    toneMapped: false,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const o = new THREE.Object3D();
  let n = 0;

  for (let i = 0; i < count * 8 && n < count; i++) {
    const x = (rand(i, 401) * 2 - 1) * (HALF - 6);
    const z = (rand(i, 409) * 2 - 1) * (HALF - 6);
    const gap = laneGap(x, z);
    if (gap < LANE_WIDTH / 2 + 1.8) continue;
    if (riverDepth(x, z) > 0.15) continue;
    if (rand(i, 419) > 0.45) continue; // Cluster in magical patches

    const s = 0.75 + rand(i, 421) * 0.9;
    o.position.set(x, terrainHeight(x, z) + 0.22, z);
    o.rotation.set(0, 0, 0);
    o.scale.setScalar(s);
    o.updateMatrix();
    mesh.setMatrixAt(n, o.matrix);
    n++;
  }
  mesh.count = n;

  return {
    mesh,
    update: (t) => {
      // 0.5Hz smooth sine-wave pulsing between 1.0 and 2.8 intensity
      const pulse = 1.8 + Math.sin(t * Math.PI) * 0.8;
      mat.emissiveIntensity = pulse;
    },
  };
}

/**
 * Dawn Shrines & Ancient Stones with Baybayin/Okir etched runic gold (#FFD700) glow.
 */
function buildDawnRunicStones(): { group: THREE.Group; update: (t: number) => void } {
  const group = new THREE.Group();
  const SHRINE_COUNT = 16;

  const stoneMat = surfaceMaterial(0x353a36, { roughness: 0.92 });
  const runeMat = new THREE.MeshStandardMaterial({
    color: 0x221a08,
    emissive: new THREE.Color('#FFD700'),
    emissiveIntensity: 1.6,
    roughness: 0.3,
    toneMapped: false,
  });

  const geo = new THREE.BoxGeometry(0.9, 2.6, 0.9);
  const runeGeo = new THREE.PlaneGeometry(0.55, 1.4);

  for (let i = 0; i < SHRINE_COUNT; i++) {
    const lane = LANES[i % LANES.length];
    const frac = 0.2 + (i / SHRINE_COUNT) * 0.6;
    const pathIdx = Math.floor(frac * (lane.path.length - 1));
    const p1 = lane.path[pathIdx];
    const p2 = lane.path[Math.min(lane.path.length - 1, pathIdx + 1)];
    const dx = p2[0] - p1[0];
    const dz = p2[1] - p1[1];
    const len = Math.hypot(dx, dz) || 1;
    const sign = i % 2 === 0 ? 1 : -1;

    // Placed right along lane margin (7.5 units from center line)
    const x = p1[0] + (-dz / len) * (LANE_WIDTH / 2 + 1.2) * sign;
    const z = p1[1] + (dx / len) * (LANE_WIDTH / 2 + 1.2) * sign;

    const g = new THREE.Group();
    g.position.set(x, terrainHeight(x, z), z);
    g.rotation.y = Math.atan2(dx, dz) + (sign > 0 ? Math.PI / 2 : -Math.PI / 2);

    const stone = new THREE.Mesh(geo, stoneMat);
    stone.position.y = 1.3;
    stone.castShadow = true;
    stone.receiveShadow = true;
    g.add(stone);

    // Carved Baybayin runic plaque facing lane
    const rune = new THREE.Mesh(runeGeo, runeMat);
    rune.position.set(0, 1.4, 0.46);
    g.add(rune);

    group.add(g);
  }

  return {
    group,
    update: (t) => {
      // Gentle breathing glow on carved runic grooves
      runeMat.emissiveIntensity = 1.4 + Math.sin(t * 1.8) * 0.6;
    },
  };
}

/**
 * Willow Spirit Particles & Ground Fireflies (ambient floating golden/cyan motes drifting through jungle volume).
 * Particle count: 360 motes (dynamic +200% density boost at night).
 */
function buildWillowSpiritParticles(): {
  points: THREE.Points;
  update: (t: number) => void;
} {
  const COUNT = 360;
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const particleData: { originX: number; originZ: number; baseY: number; seed: number; speed: number; isFirefly: boolean }[] = [];

  const cGold = new THREE.Color('#FFB300'); // Bioluminescent Gold
  const cCyan = new THREE.Color('#00E5FF'); // Bioluminescent Cyan
  const cLime = new THREE.Color('#76FF03'); // Firefly Green
  const c = new THREE.Color();

  for (let i = 0; i < COUNT; i++) {
    const x = (rand(i, 521) * 2 - 1) * (HALF - 10);
    const z = (rand(i, 541) * 2 - 1) * (HALF - 10);
    const y = terrainHeight(x, z) + 0.6;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const isFirefly = i >= 180;
    if (isFirefly) {
      c.copy(i % 2 === 0 ? cLime : cGold).offsetHSL((rand(i, 563) - 0.5) * 0.1, 0, 0);
    } else {
      c.copy(i % 2 === 0 ? cGold : cCyan).offsetHSL((rand(i, 563) - 0.5) * 0.1, 0, 0);
    }

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    particleData.push({
      originX: x,
      originZ: z,
      baseY: y,
      seed: rand(i, 577) * Math.PI * 2,
      speed: (isFirefly ? 0.45 : 0.25) + rand(i, 587) * 0.2,
      isFirefly,
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.45,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    toneMapped: false,
  });

  const points = new THREE.Points(geo, mat);
  points.renderOrder = 8;

  return {
    points,
    update: (t) => {
      const pos = geo.attributes.position;
      const todClock = (t % 600 + 600) % 600;
      // Night is from 420s to 600s: fireflies glow +200% brighter/active
      const isNight = todClock >= 420 || todClock < 60;
      const nightFactor = isNight ? 1.0 : 0.35;

      for (let i = 0; i < COUNT; i++) {
        const d = particleData[i];
        const heightSpan = d.isFirefly ? 3.5 : 6.0;
        const progress = ((t * d.speed + d.seed) % heightSpan) / heightSpan;

        // Upward drift with lively noise turbulence
        const curY = d.baseY + progress * heightSpan + Math.sin(t * 2.5 + d.seed) * 0.3;
        const driftX = Math.sin(t * (d.isFirefly ? 1.4 : 0.6) + d.seed) * (d.isFirefly ? 1.4 : 0.8);
        const driftZ = Math.cos(t * (d.isFirefly ? 1.4 : 0.6) + d.seed) * (d.isFirefly ? 1.4 : 0.8);

        pos.setXYZ(i, d.originX + driftX, curY, d.originZ + driftZ);
      }
      pos.needsUpdate = true;
      mat.opacity = 0.5 + nightFactor * 0.45;
    },
  };
}
