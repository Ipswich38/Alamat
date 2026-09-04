// The sanctuaries and bases: culturally accurate pre-colonial ancient architecture.
//
// ── FACTION 1: ANITO SENTINELS (SOUTH-WEST BASE) ────────────────────────────
// - Raised multi-tiered stone altar surrounded by 6 carved Idol guardian pillars.
// - Ornate pre-colonial brass pedestal (Maranao Gador inspired).
// - Central Floating Artifact: Glowing Gold/Amber Sun Crystal (#FFB300) with solar corona.
// - Lighting: Warm radial point light (Radius: 15u, Intensity: 3.5, Color: #FFA000) with dynamic flickering.
// - High-ground spawner platform behind core with stone-carved Baybayin rune circle.
//
// ── FACTION 2: MALAKAS CLAN (NORTH-EAST BASE) ──────────────────────────────
// - Giant ancestral Banyan/Ironwood tree root altar bound in glowing ironwood rings.
// - Open carved volcanic stone basin cradled within the root columns.
// - Central Floating Artifact: Glowing Sapphire/Cyan Mana Crystal (#00E5FF) with orbiting shards.
// - Lighting: Cool radial point light (Radius: 15u, Intensity: 3.5, Color: #00B0FF) with pulsing emission.
// - High-ground spawner platform behind core with stone-carved Baybayin rune circle.

import * as THREE from 'three';
import { CORE_HEIGHT, HALF, SANCTUARY_RADIUS, TEAMS, type Team, type TeamId } from '@/game/arena/nexus';
import { riverDepth, riverFloor } from '@/game/arena/river';
import { loadModel } from './models';
import { terrainHeight } from './terrain';
import { surfaceMaterial } from './stage';

export interface Nexus {
  group: THREE.Group;
  /** Spin the crystals, pulse/flicker elemental lights, and animate runes. */
  update(t: number): void;
  /**
   * Break a team's core: the match ends.
   * Extinguishes lights, fractures the floating artifact, and scatters energy.
   */
  shatter(team: TeamId): void;
  dispose(): void;
}

interface BaseArtifact {
  team: TeamId;
  group: THREE.Group;
  crystal: THREE.Object3D;
  lamp: THREE.PointLight;
  runes: THREE.MeshStandardMaterial[];
  seed: number;
  broken: boolean;
}

export function createNexus(): Nexus {
  const group = new THREE.Group();
  group.name = 'nexus-and-sanctuaries';
  const artifacts: BaseArtifact[] = [];

  // 1. Build Faction 1: Dawn Sentinels Base (SW)
  const dawnBase = buildDawnBase(TEAMS.dawn);
  group.add(dawnBase.group);
  artifacts.push(dawnBase.artifact);

  // 2. Build Faction 2: Dusk Clan Base (NE)
  const duskBase = buildDuskBase(TEAMS.dusk);
  group.add(duskBase.group);
  artifacts.push(duskBase.artifact);

  // Optional enhancement: load external GLB asset if present
  loadModel('/models/props/wardstone.glb', { height: 4.5 }).then((model) => {
    if (!model) return;
  });

  return {
    group,
    update: (t) => {
      for (const a of artifacts) {
        if (a.broken) continue;

        if (a.team === 'dawn') {
          // HQ: flicker 4.2-5.8 range (was 98 blown out)
          const flicker = 4.8 + Math.sin(t * 8.5 + a.seed) * 0.35 + Math.sin(t * 14.3) * 0.22 + Math.cos(t * 22.1) * 0.15;
          a.lamp.intensity = flicker;
          a.crystal.rotation.y = t * 0.5 + a.seed;
          a.crystal.position.y = CORE_HEIGHT + Math.sin(t * 1.2 + a.seed) * 0.22;

          // Pulse rune glow gently
          const runePulse = 1.6 + Math.sin(t * 2.0) * 0.4;
          for (const mat of a.runes) mat.emissiveIntensity = runePulse;
        } else {
          // HQ: pulse 4.5-6.2 range
          const pulse = 5.2 + Math.sin(t * 2.5 + a.seed) * 0.85;
          a.lamp.intensity = pulse;
          a.crystal.rotation.y = -t * 0.45 + a.seed;
          a.crystal.position.y = CORE_HEIGHT + Math.sin(t * 0.9 + a.seed) * 0.25;

          const runePulse = 1.5 + Math.sin(t * 1.8 + 1.0) * 0.5;
          for (const mat of a.runes) mat.emissiveIntensity = runePulse;
        }
      }
    },
    shatter: (team) => {
      const a = artifacts.find((x) => x.team === team);
      if (!a || a.broken) return;
      a.broken = true;
      a.crystal.visible = false;
      a.lamp.intensity = 0;
      for (const mat of a.runes) mat.emissiveIntensity = 0;
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

// ────────────────────────────────────────────────────────────────────────────
// FACTION 1: ANITO SENTINELS BASE (SW)
// ────────────────────────────────────────────────────────────────────────────

function buildDawnBase(team: Team): { group: THREE.Group; artifact: BaseArtifact } {
  const g = new THREE.Group();
  g.name = 'dawn-sanctuary';
  const baseY = terrainHeight(team.x, team.z);
  g.position.set(team.x, baseY, team.z);

  const runeMaterials: THREE.MeshStandardMaterial[] = [];

  // 1. Sanctuary Base Perimeter & Paved Platform
  const floorGeo = new THREE.CylinderGeometry(SANCTUARY_RADIUS - 0.5, SANCTUARY_RADIUS + 0.5, 0.45, 48);
  const floor = new THREE.Mesh(
    floorGeo,
    surfaceMaterial(0xd6cbb0, { roughness: 0.88, metalness: 0.02 })
  );
  floor.position.y = 0.22;
  floor.receiveShadow = true;
  g.add(floor);

  // Subtle gold boundary ring
  const boundary = new THREE.Mesh(
    new THREE.RingGeometry(SANCTUARY_RADIUS - 0.8, SANCTUARY_RADIUS, 64),
    new THREE.MeshBasicMaterial({
      color: 0xffb300,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    })
  );
  boundary.rotation.x = -Math.PI / 2;
  boundary.position.y = 0.46;
  g.add(boundary);

  // 2. Raised Stone Altar (Multi-Tier Basalt & Limestone — HQ: more segments, less faceting)
  const altarGroup = new THREE.Group();
  const tier1 = new THREE.Mesh(
    new THREE.CylinderGeometry(6.2, 7.0, 0.6, 24),
    surfaceMaterial(0x5a5247, { roughness: 0.88 })
  );
  tier1.position.y = 0.5;
  tier1.castShadow = true;
  tier1.receiveShadow = true;
  altarGroup.add(tier1);

  const tier2 = new THREE.Mesh(
    new THREE.CylinderGeometry(4.6, 5.4, 0.7, 24),
    surfaceMaterial(0x73695c, { roughness: 0.84 })
  );
  tier2.position.y = 1.1;
  tier2.castShadow = true;
  tier2.receiveShadow = true;
  altarGroup.add(tier2);

  const tier3 = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.8, 0.6, 20),
    surfaceMaterial(0x8a7f70, { roughness: 0.80 })
  );
  tier3.position.y = 1.7;
  tier3.castShadow = true;
  tier3.receiveShadow = true;
  altarGroup.add(tier3);
  g.add(altarGroup);

  // 3. Carved Idol Guardian Pillars (6 Pillars surrounding Altar)
  const BULUL_COUNT = 6;
  const BULUL_RADIUS = 5.2;
  for (let i = 0; i < BULUL_COUNT; i++) {
    const angle = (i / BULUL_COUNT) * Math.PI * 2;
    const px = Math.cos(angle) * BULUL_RADIUS;
    const pz = Math.sin(angle) * BULUL_RADIUS;
    const idolPillar = buildIdolGuardianPillar(angle + Math.PI);
    idolPillar.position.set(px, 0.8, pz);
    g.add(idolPillar);
  }

  // 4. Ornate Brass Pedestal (Pre-colonial Maranao Brass Gador motif)
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc5a059,
    metalness: 0.82,
    roughness: 0.32,
  });
  const brassPedestal = new THREE.Group();

  const brassBase = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 0.4, 16), brassMat);
  brassBase.position.y = 2.15;
  brassBase.castShadow = true;
  brassPedestal.add(brassBase);

  const brassStem = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 1.2, 16), brassMat);
  brassStem.position.y = 2.85;
  brassStem.castShadow = true;
  brassPedestal.add(brassStem);

  const brassCup = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 0.9, 0.7, 16), brassMat);
  brassCup.position.y = 3.65;
  brassCup.castShadow = true;
  brassPedestal.add(brassCup);
  g.add(brassPedestal);

  // 5. Central Floating Artifact: Glowing Sun Crystal — HQ: Physical material, crisp halos
  const sunCrystal = new THREE.Group();
  sunCrystal.name = 'core:dawn';

  // Primary gem — HQ: MeshPhysical with emissive instead of flat MeshBasic (was washing out)
  const gemMat = new THREE.MeshPhysicalMaterial({
    color: 0xffb300,
    emissive: 0xff8c00,
    emissiveIntensity: 1.4,
    roughness: 0.18,
    metalness: 0.12,
    transmission: 0.18,
    thickness: 0.6,
    clearcoat: 0.6,
    clearcoatRoughness: 0.18,
  });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 1), gemMat);
  sunCrystal.add(gem);

  // Nested rotating solar halos — HQ: more segments, subtle
  const haloMat = new THREE.MeshStandardMaterial({
    color: 0xffd54f,
    emissive: 0xffb300,
    emissiveIntensity: 0.8,
    roughness: 0.35,
    metalness: 0.15,
  });
  const solarRing1 = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.06, 10, 48), haloMat);
  solarRing1.rotation.x = Math.PI / 3;
  sunCrystal.add(solarRing1);

  const solarRing2 = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.05, 10, 48), haloMat);
  solarRing2.rotation.y = Math.PI / 4;
  sunCrystal.add(solarRing2);

  // 4 Orbiting Prisms — HQ: physical too
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.32), gemMat);
    shard.position.set(Math.cos(a) * 2.5, Math.sin(a * 2) * 0.4, Math.sin(a) * 2.5);
    sunCrystal.add(shard);
  }

  sunCrystal.position.y = CORE_HEIGHT;
  g.add(sunCrystal);

  // 6. Lighting: Warm point light — HQ: much lower intensity (was 3.5*28=98 blown out)
  const lamp = new THREE.PointLight(0xffa000, 5.5, 15, 2);
  lamp.position.set(0, CORE_HEIGHT + 0.4, 0);
  g.add(lamp);

  // 7. Spawner Platform: Behind Nexus core with stone-carved Baybayin rune circle
  const spawner = buildBaybayinSpawnerPlatform(team.spawn.x - team.x, team.spawn.z - team.z, 0xffb300, runeMaterials);
  g.add(spawner);

  return {
    group: g,
    artifact: {
      team: 'dawn',
      group: g,
      crystal: sunCrystal,
      lamp,
      runes: runeMaterials,
      seed: 0.1,
      broken: false,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// FACTION 2: MALAKAS CLAN BASE (NE)
// ────────────────────────────────────────────────────────────────────────────

function buildDuskBase(team: Team): { group: THREE.Group; artifact: BaseArtifact } {
  const g = new THREE.Group();
  g.name = 'dusk-sanctuary';
  const baseY = terrainHeight(team.x, team.z);
  g.position.set(team.x, baseY, team.z);

  const runeMaterials: THREE.MeshStandardMaterial[] = [];

  // 1. Sanctuary Base Perimeter & Fortress Slate Foundation
  const floorGeo = new THREE.CylinderGeometry(SANCTUARY_RADIUS - 0.5, SANCTUARY_RADIUS + 0.5, 0.45, 48);
  const floor = new THREE.Mesh(
    floorGeo,
    surfaceMaterial(0x384a52, { roughness: 0.92, metalness: 0.04 })
  );
  floor.position.y = 0.22;
  floor.receiveShadow = true;
  g.add(floor);

  // Subtle cyan boundary ring
  const boundary = new THREE.Mesh(
    new THREE.RingGeometry(SANCTUARY_RADIUS - 0.8, SANCTUARY_RADIUS, 64),
    new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    })
  );
  boundary.rotation.x = -Math.PI / 2;
  boundary.position.y = 0.46;
  g.add(boundary);

  // 2. Giant Ancestral Tree Root Altar bound in glowing ironwood rings
  const rootAltar = buildAncestralRootAltar(runeMaterials);
  g.add(rootAltar);

  // 3. Open Stone Basin cradled in the root altar
  const basinMat = surfaceMaterial(0x232d33, { roughness: 0.85, metalness: 0.15 });
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 1.6, 0.9, 16),
    basinMat
  );
  basin.position.y = 2.4;
  basin.castShadow = true;
  basin.receiveShadow = true;
  g.add(basin);

  // Spirit fluid — HQ: lit, not flat
  const fluid = new THREE.Mesh(
    new THREE.CircleGeometry(2.35, 32),
    new THREE.MeshStandardMaterial({
      color: 0x00b0ff,
      emissive: 0x0066aa,
      emissiveIntensity: 0.6,
      roughness: 0.18,
      metalness: 0.12,
      transparent: true,
      opacity: 0.82,
    })
  );
  fluid.rotation.x = -Math.PI / 2;
  fluid.position.y = 2.82;
  g.add(fluid);

  // 4. Central Floating Artifact: Mana Crystal — HQ: Physical, not Basic
  const manaCrystal = new THREE.Group();
  manaCrystal.name = 'core:dusk';

  const manaGemMat = new THREE.MeshPhysicalMaterial({
    color: 0x00e5ff,
    emissive: 0x0088cc,
    emissiveIntensity: 1.2,
    roughness: 0.16,
    metalness: 0.1,
    transmission: 0.22,
    thickness: 0.6,
    clearcoat: 0.5,
  });

  // Central Prism — higher subdiv
  const gemCore = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 2), manaGemMat);
  gemCore.scale.set(0.9, 1.4, 0.9);
  manaCrystal.add(gemCore);

  // 4 Orbiting Shards — physical too
  const shardMat = new THREE.MeshPhysicalMaterial({
    color: 0x80d8ff,
    emissive: 0x3399ff,
    emissiveIntensity: 0.7,
    roughness: 0.2,
    transmission: 0.15,
  });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 1), shardMat);
    shard.scale.set(0.7, 1.3, 0.7);
    shard.position.set(Math.cos(a) * 2.2, Math.sin(a * 2) * 0.35, Math.sin(a) * 2.2);
    manaCrystal.add(shard);
  }

  // Halo — HQ: more segments, subtle
  const haloMat = new THREE.MeshStandardMaterial({
    color: 0x00e5ff,
    emissive: 0x00aaff,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.22,
    roughness: 0.4,
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.9, 24, 16), haloMat);
  manaCrystal.add(halo);

  manaCrystal.position.y = CORE_HEIGHT;
  g.add(manaCrystal);

  // 5. Lighting: Cool point light — HQ: lower (was 98)
  const lamp = new THREE.PointLight(0x00b0ff, 5.8, 15, 2);
  lamp.position.set(0, CORE_HEIGHT + 0.4, 0);
  g.add(lamp);

  // 6. Spawner Platform: Behind Nexus core with stone-carved Baybayin rune circle
  const spawner = buildBaybayinSpawnerPlatform(team.spawn.x - team.x, team.spawn.z - team.z, 0x00e5ff, runeMaterials);
  g.add(spawner);

  return {
    group: g,
    artifact: {
      team: 'dusk',
      group: g,
      crystal: manaCrystal,
      lamp,
      runes: runeMaterials,
      seed: 2.3,
      broken: false,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// ARCHITECTURAL DETAIL HELPERS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Carved Idol Guardian Pillar (Cordillera traditional rice granary deity motif).
 */
function buildIdolGuardianPillar(facing: number): THREE.Group {
  const g = new THREE.Group();
  g.rotation.y = facing;

  const woodMat = surfaceMaterial(0x4a3422, { roughness: 0.85 });
  const stoneBaseMat = surfaceMaterial(0x615647, { roughness: 0.92 });

  // Stone Pillar Base with Okir geometric carvings
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 1.2), stoneBaseMat);
  base.position.y = 0.7;
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  // Carved Idol Seated Figure
  const idol = new THREE.Group();

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 0.55), woodMat);
  torso.position.y = 1.9;
  torso.castShadow = true;
  idol.add(torso);

  // Crossed arms resting on knees
  const crossedArms = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.35, 0.45), woodMat);
  crossedArms.position.set(0, 1.75, 0.25);
  crossedArms.castShadow = true;
  idol.add(crossedArms);

  // Bent legs / knees
  const knees = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.6, 0.6), woodMat);
  knees.position.set(0, 1.45, 0.15);
  knees.castShadow = true;
  idol.add(knees);

  // Carved Head & Mortar/Crown
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.5), woodMat);
  head.position.set(0, 2.65, 0);
  head.castShadow = true;
  idol.add(head);

  // Carved Ear Pendants / Plumes
  const earL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.15), woodMat);
  earL.position.set(-0.35, 2.6, 0);
  const earR = earL.clone();
  earR.position.x = 0.35;
  idol.add(earL, earR);

  // Mortar Headdress
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.35, 8), woodMat);
  crown.position.y = 3.1;
  crown.castShadow = true;
  idol.add(crown);

  g.add(idol);
  return g;
}

/**
 * Ancestral Banyan / Ironwood Tree Root Altar with glowing ironwood rings.
 */
function buildAncestralRootAltar(runeMats: THREE.MeshStandardMaterial[]): THREE.Group {
  const g = new THREE.Group();
  const barkMat = surfaceMaterial(0x352317, { roughness: 0.94 });
  const slateMat = surfaceMaterial(0x283339, { roughness: 0.88 });

  // Mossy slate stepped foundation
  const baseStep = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 6.6, 0.6, 8), slateMat);
  baseStep.position.y = 0.4;
  baseStep.receiveShadow = true;
  baseStep.castShadow = true;
  g.add(baseStep);

  // 8 Arching Root Pillars curling upward to form a cradle
  const ROOT_COUNT = 8;
  const ROOT_RADIUS = 3.6;
  for (let i = 0; i < ROOT_COUNT; i++) {
    const a = (i / ROOT_COUNT) * Math.PI * 2;
    const rootPillar = new THREE.Group();
    rootPillar.position.set(Math.cos(a) * ROOT_RADIUS, 0.5, Math.sin(a) * ROOT_RADIUS);
    rootPillar.rotation.y = a + Math.PI / 2;

    const lowerRoot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.75, 1.8, 6), barkMat);
    lowerRoot.position.set(0, 0.9, 0);
    lowerRoot.rotation.z = -0.22;
    lowerRoot.castShadow = true;
    rootPillar.add(lowerRoot);

    const upperRoot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.48, 1.6, 6), barkMat);
    upperRoot.position.set(-0.25, 2.2, 0);
    upperRoot.rotation.z = 0.35;
    upperRoot.castShadow = true;
    rootPillar.add(upperRoot);

    g.add(rootPillar);
  }

  // Glowing Ironwood Rings binding the root altar together
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x1a2e36,
    emissive: new THREE.Color(0x00e5ff),
    emissiveIntensity: 1.5,
    metalness: 0.6,
    roughness: 0.3,
    toneMapped: false,
  });
  runeMats.push(ringMat);

  const ironwoodRing1 = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.15, 8, 32), ringMat);
  ironwoodRing1.rotation.x = Math.PI / 2;
  ironwoodRing1.position.y = 1.6;
  g.add(ironwoodRing1);

  const ironwoodRing2 = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.14, 8, 32), ringMat);
  ironwoodRing2.rotation.x = Math.PI / 2;
  ironwoodRing2.position.y = 2.7;
  g.add(ironwoodRing2);

  return g;
}

/**
 * High-Ground Hero Spawner Platform with circular stone-carved Baybayin rune circle.
 */
function buildBaybayinSpawnerPlatform(
  offsetX: number,
  offsetZ: number,
  glowColor: number,
  runeMats: THREE.MeshStandardMaterial[]
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(offsetX, 0, offsetZ);

  const stoneMat = surfaceMaterial(glowColor === 0xffb300 ? 0x8a7f70 : 0x33444c, { roughness: 0.9 });
  const radius = 4.8;

  // Raised stone daïs
  const dais = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius + 0.6, 0.55, 32),
    stoneMat
  );
  dais.position.y = 0.28;
  dais.receiveShadow = true;
  dais.castShadow = true;
  g.add(dais);

  // Outer stone curb ring
  const curb = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.5, radius, 36),
    stoneMat
  );
  curb.rotation.x = -Math.PI / 2;
  curb.position.y = 0.57;
  g.add(curb);

  // Glowing Baybayin Runic Ring Decal
  const runeMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: new THREE.Color(glowColor),
    emissiveIntensity: 1.6,
    roughness: 0.4,
    toneMapped: false,
  });
  runeMats.push(runeMat);

  const runeRing = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.55, radius * 0.88, 32),
    runeMat
  );
  runeRing.rotation.x = -Math.PI / 2;
  runeRing.position.y = 0.58;
  g.add(runeRing);

  // Center Baybayin Glyph Emblem (the Maker / Talisman emblem)
  const centerEmblem = new THREE.Mesh(
    new THREE.CircleGeometry(1.3, 16),
    runeMat
  );
  centerEmblem.rotation.x = -Math.PI / 2;
  centerEmblem.position.y = 0.585;
  g.add(centerEmblem);

  // 4 Corner Boundary Totem Markers
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 1.8, 0.55),
      stoneMat
    );
    post.position.set(Math.cos(a) * (radius + 0.3), 0.9, Math.sin(a) * (radius + 0.3));
    post.castShadow = true;
    post.receiveShadow = true;
    g.add(post);

    const cap = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      runeMat
    );
    cap.position.set(Math.cos(a) * (radius + 0.3), 1.9, Math.sin(a) * (radius + 0.3));
    g.add(cap);
  }

  return g;
}

/**
 * The map floor (preserved).
 */
export function buildGround(): THREE.Mesh {
  const size = HALF * 2;
  const geo = new THREE.PlaneGeometry(size, size, 96, 96);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const dawn = new THREE.Color('#5f8f4a');
  const dusk = new THREE.Color('#4a6f7f');
  const BED = new THREE.Color('#6b7a5c');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const t = Math.max(0, Math.min(1, (x - z) / 90 + 0.5));
    c.copy(dawn).lerp(dusk, t);
    const grain = Math.sin(x * 0.7 + z * 1.3) * 0.5 + 0.5;
    c.offsetHSL(0, 0, (grain - 0.5) * 0.05);
    const wet = riverDepth(x, z);
    if (wet > 0) c.lerp(BED, Math.min(1, wet * 1.5));
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
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

