// The base perimeter palisades, fortress walls, and gate choke points.
//
// ── FACTION 1: ANITO SENTINELS BASE PERIMETER ──────────────────────────────
// - Heavy bamboo and dark timber palisades bound with woven rattan ropes (Uway).
// - Base entry gates feature Torogan-style wood carvings with swept wing designs (Panolong).
// - Dual carved wooden totem posts (Laso style) framing all 3 lane exits.
//
// ── FACTION 2: MALAKAS CLAN BASE PERIMETER ──────────────────────────────────
// - Stone-and-log fortress walls with mossy slate foundations.
// - Decorative tribal spears (Sibat) and war drums (Gandang) along the ramparts.
// - Dual carved wooden totem posts (Laso style) framing all 3 lane exits.

import * as THREE from 'three';
import { WALL_RADIUS, buildGates, wallSpans, type Gate } from '@/game/arena/walls';
import { TEAMS, type TeamId } from '@/game/arena/nexus';
import { loadModel } from './models';
import { surfaceMaterial } from './stage';
import { terrainHeight } from './terrain';

const SECTION = 5.2;
const HEIGHT = 4.4;

export interface Walls {
  group: THREE.Group;
  dispose(): void;
}

export function createWalls(): Walls {
  const group = new THREE.Group();
  group.name = 'base-perimeter-walls';

  // 1. Build Base Perimeter Wall Sections for both teams
  for (const span of wallSpans()) {
    const team = TEAMS[span.team];
    const arc = span.to - span.from;
    const count = Math.max(1, Math.round((arc * WALL_RADIUS) / SECTION));

    for (let i = 0; i < count; i++) {
      const a = span.from + (arc * (i + 0.5)) / count;
      const x = team.x + Math.sin(a) * WALL_RADIUS;
      const z = team.z + Math.cos(a) * WALL_RADIUS;
      const y = terrainHeight(x, z);

      if (span.team === 'anito') {
        const wallSection = buildAnitoPalisadeSection();
        wallSection.position.set(x, y, z);
        wallSection.rotation.y = a;
        group.add(wallSection);
      } else {
        const wallSection = buildMalakasFortressSection(i % 3 === 0);
        wallSection.position.set(x, y, z);
        wallSection.rotation.y = a;
        group.add(wallSection);
      }
    }
  }

  // 2. Build Base Entry Gates (3 lane exits: Top, Mid, Bot) with Laso Totems & Panolong Carvings
  const gates = buildGates();
  for (const gate of gates) {
    const gateGroup = buildBaseEntryGate(gate);
    group.add(gateGroup);
  }

  // Optional external glb enhancement
  loadModel('/models/props/palisade.glb', { width: SECTION }).then((model) => {
    if (!model) return;
  });

  return {
    group,
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
// ANITO SENTINELS: BAMBOO & DARK TIMBER PALISADE
// ────────────────────────────────────────────────────────────────────────────

function buildAnitoPalisadeSection(): THREE.Group {
  const g = new THREE.Group();

  const timberMat = surfaceMaterial(0x3e2c1c, { roughness: 0.88 });
  const bambooMat = surfaceMaterial(0x6e5b32, { roughness: 0.82 });
  const rattanMat = surfaceMaterial(0xc4a36e, { roughness: 0.75, metalness: 0.05 });

  // 7 Vertical Dark Timber Stakes with sharpened tops and varied heights
  const STAKE_COUNT = 7;
  for (let i = 0; i < STAKE_COUNT; i++) {
    const frac = (i - (STAKE_COUNT - 1) / 2) / (STAKE_COUNT - 1);
    const px = frac * (SECTION * 0.92);
    const pz = Math.sin(i * 1.7) * 0.08;
    const h = HEIGHT + ((i % 3) - 1) * 0.35;

    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, h, 6), timberMat);
    stake.position.set(px, h / 2, pz);
    stake.castShadow = true;
    stake.receiveShadow = true;
    g.add(stake);

    // Sharpened cone tip
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 6), timberMat);
    tip.position.set(px, h + 0.25, pz);
    tip.castShadow = true;
    g.add(tip);
  }

  // 2 Horizontal Bamboo Stringers
  for (const y of [1.4, 3.1]) {
    const stringer = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, SECTION * 0.98, 6), bambooMat);
    stringer.rotation.z = Math.PI / 2;
    stringer.position.set(0, y, 0.2);
    stringer.castShadow = true;
    g.add(stringer);

    // Woven Rattan Rope Bindings (Uway) at stake-stringer intersections
    for (let i = 0; i < STAKE_COUNT; i += 2) {
      const frac = (i - (STAKE_COUNT - 1) / 2) / (STAKE_COUNT - 1);
      const px = frac * (SECTION * 0.92);
      const rattanRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 6, 12), rattanMat);
      rattanRing.position.set(px, y, 0.2);
      g.add(rattanRing);
    }
  }

  // Diagonal Support Timber Struts
  const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.4, 6), timberMat);
  strut.rotation.x = 0.45;
  strut.position.set(0, 1.6, -0.65);
  strut.castShadow = true;
  g.add(strut);

  return g;
}

// ────────────────────────────────────────────────────────────────────────────
// MALAKAS CLAN: STONE & LOG FORTRESS WALL
// ────────────────────────────────────────────────────────────────────────────

function buildMalakasFortressSection(hasDecor: boolean): THREE.Group {
  const g = new THREE.Group();

  const slateMat = surfaceMaterial(0x2d3b42, { roughness: 0.92 });
  const logMat = surfaceMaterial(0x231a14, { roughness: 0.88 });

  // 1. Mossy Slate Masonry Foundation
  const stoneBase = new THREE.Mesh(new THREE.BoxGeometry(SECTION * 0.98, 1.6, 1.2), slateMat);
  stoneBase.position.y = 0.8;
  stoneBase.castShadow = true;
  stoneBase.receiveShadow = true;
  g.add(stoneBase);

  // Slate coping ledge
  const stoneLedge = new THREE.Mesh(new THREE.BoxGeometry(SECTION * 1.02, 0.25, 1.35), slateMat);
  stoneLedge.position.y = 1.7;
  stoneLedge.castShadow = true;
  stoneLedge.receiveShadow = true;
  g.add(stoneLedge);

  // 2. Heavy Dark Ironwood Log Courses
  const LOG_COURSES = 4;
  for (let k = 0; k < LOG_COURSES; k++) {
    const y = 2.05 + k * 0.65;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, SECTION * 0.96, 8), logMat);
    log.rotation.z = Math.PI / 2;
    log.position.set(0, y, 0);
    log.castShadow = true;
    log.receiveShadow = true;
    g.add(log);
  }

  // 3. Stone Crenellations / Battlements
  for (let b = -1; b <= 1; b++) {
    const merlon = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.6), slateMat);
    merlon.position.set(b * 1.6, HEIGHT + 0.35, 0.3);
    merlon.castShadow = true;
    g.add(merlon);
  }

  // 4. Decorative Rampart War Drum (Gandang) or Crossed Sibat Spears
  if (hasDecor) {
    const decor = buildRampartDecor();
    decor.position.set(0, 1.8, -0.75);
    g.add(decor);
  }

  return g;
}

/**
 * Decorative War Drum (Gandang) and Sibat tribal spears along Malakas ramparts.
 */
function buildRampartDecor(): THREE.Group {
  const g = new THREE.Group();

  const woodMat = surfaceMaterial(0x4a2a18, { roughness: 0.8 });
  const skinMat = surfaceMaterial(0xd8c8aa, { roughness: 0.95 });
  const ironMat = surfaceMaterial(0x607d8b, { metalness: 0.85, roughness: 0.25 });

  // War Drum (Gandang) on wooden cross-frame
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.95, 12), woodMat);
  drum.rotation.x = Math.PI / 2;
  drum.position.y = 0.75;
  drum.castShadow = true;
  g.add(drum);

  // Drum membrane faces
  const headF = new THREE.Mesh(new THREE.CircleGeometry(0.44, 12), skinMat);
  headF.position.set(0, 0.75, 0.48);
  const headB = headF.clone();
  headB.rotation.y = Math.PI;
  headB.position.z = -0.48;
  g.add(headF, headB);

  // Crossed Sibat spears behind drum
  for (const rotZ of [-0.45, 0.45]) {
    const spearShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.8, 6), woodMat);
    spearShaft.position.set(0, 1.4, -0.15);
    spearShaft.rotation.z = rotZ;
    spearShaft.castShadow = true;
    g.add(spearShaft);

    const spearBlade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.65, 4), ironMat);
    spearBlade.position.set(-Math.sin(rotZ) * 1.4, 1.4 + Math.cos(rotZ) * 1.4, -0.15);
    spearBlade.rotation.z = rotZ;
    spearBlade.castShadow = true;
    g.add(spearBlade);
  }

  return g;
}

// ────────────────────────────────────────────────────────────────────────────
// BASE ENTRY GATES: TOROGAN PANOLONG CARVINGS & DUAL LASO TOTEMS
// ────────────────────────────────────────────────────────────────────────────

function buildBaseEntryGate(gate: Gate): THREE.Group {
  const g = new THREE.Group();
  const team = TEAMS[gate.team];

  const gateAngle = gate.bearing;
  const gateX = team.x + Math.sin(gateAngle) * WALL_RADIUS;
  const gateZ = team.z + Math.cos(gateAngle) * WALL_RADIUS;
  const gateY = terrainHeight(gateX, gateZ);

  g.position.set(gateX, gateY, gateZ);
  g.rotation.y = gateAngle;

  const halfWidth = (gate.arc * WALL_RADIUS) / 2;

  // 1. Dual Carved Wooden Totem Posts (Laso style) flanking the gate exit
  const leftTotem = buildLasoTotemPost(gate.team);
  leftTotem.position.set(-halfWidth, 0, 0);
  const rightTotem = buildLasoTotemPost(gate.team);
  rightTotem.position.set(halfWidth, 0, 0);
  g.add(leftTotem, rightTotem);

  // 2. Gate Header Architecture
  if (gate.team === 'anito') {
    // Torogan-style Panolong swept wing carved beam
    const panolongBeam = buildToroganPanolongHeader(halfWidth * 2);
    panolongBeam.position.set(0, 5.2, 0);
    g.add(panolongBeam);
  } else {
    // Fortified Log Header with Sibat spears and war drums
    const fortressHeader = buildFortressGateHeader(halfWidth * 2);
    fortressHeader.position.set(0, 5.2, 0);
    g.add(fortressHeader);
  }

  return g;
}

/**
 * Carved Wooden Totem Post (Laso style) anchored into the ground.
 */
function buildLasoTotemPost(teamId: TeamId): THREE.Group {
  const g = new THREE.Group();
  const woodMat = surfaceMaterial(teamId === 'anito' ? 0x4a321f : 0x2b221a, { roughness: 0.85 });
  const runeMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: new THREE.Color(teamId === 'anito' ? 0xffb300 : 0x00e5ff),
    emissiveIntensity: 1.6,
    roughness: 0.3,
    toneMapped: false,
  });

  // Base Foundation Anchor Post
  const baseAnchor = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.2, 1.1), woodMat);
  baseAnchor.position.y = 0.6;
  baseAnchor.castShadow = true;
  baseAnchor.receiveShadow = true;
  g.add(baseAnchor);

  // Main Carved Totem Shaft with tribal tiers
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 4.4, 8), woodMat);
  shaft.position.y = 2.8;
  shaft.castShadow = true;
  g.add(shaft);

  // Carved Spirit Mask / Guardian Face on totem post
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.1, 0.65), woodMat);
  mask.position.set(0, 3.8, 0.15);
  mask.castShadow = true;
  g.add(mask);

  // Glowing Spirit Eye Glyphs
  for (const ex of [-0.22, 0.22]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.1), runeMat);
    eye.position.set(ex, 3.95, 0.5);
    g.add(eye);
  }

  // Apex Ceremonial Finial
  const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), runeMat);
  finial.position.y = 5.4;
  g.add(finial);

  return g;
}

/**
 * Torogan-style Wood Carved Header with swept wing designs (Panolong motif).
 */
function buildToroganPanolongHeader(spanWidth: number): THREE.Group {
  const g = new THREE.Group();
  const woodMat = surfaceMaterial(0x5c3c22, { roughness: 0.82 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffb300,
    metalness: 0.75,
    roughness: 0.28,
  });

  // Main Horizontal Torogan Ridge Beam
  const beam = new THREE.Mesh(new THREE.BoxGeometry(spanWidth + 1.2, 0.6, 0.6), woodMat);
  beam.castShadow = true;
  g.add(beam);

  // Left Swept Wing (Panolong)
  const leftWing = buildPanolongWing(false);
  leftWing.position.set(-(spanWidth / 2 + 0.6), 0, 0);
  leftWing.rotation.y = Math.PI;
  g.add(leftWing);

  // Right Swept Wing (Panolong)
  const rightWing = buildPanolongWing(true);
  rightWing.position.set(spanWidth / 2 + 0.6, 0, 0);
  g.add(rightWing);

  // Center Carved Sun Medallion (Araw motif)
  const medallion = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.2, 12), goldMat);
  medallion.rotation.x = Math.PI / 2;
  medallion.position.z = 0.32;
  g.add(medallion);

  return g;
}

/**
 * Single Swept Wing Panolong Carving (Naga serpent / Pako rabong fern motif).
 */
function buildPanolongWing(isRight: boolean): THREE.Group {
  const wing = new THREE.Group();
  const woodMat = surfaceMaterial(0x6b4426, { roughness: 0.8 });

  // 3 Tiered Swept Tapered Planks curving upward and outward
  for (let k = 0; k < 3; k++) {
    const len = 1.6 + k * 0.45;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(len, 0.2, 0.15), woodMat);
    plank.position.set((len / 2) * (isRight ? 1 : 1), (k - 1) * 0.24, 0);
    plank.rotation.z = (k + 1) * 0.18;
    plank.castShadow = true;
    wing.add(plank);
  }

  return wing;
}

/**
 * Malakas Fortified Log Gate Header with Sibat spears and war drums.
 */
function buildFortressGateHeader(spanWidth: number): THREE.Group {
  const g = new THREE.Group();
  const logMat = surfaceMaterial(0x281e17, { roughness: 0.88 });
  const slateMat = surfaceMaterial(0x33444c, { roughness: 0.9 });

  const mainLog = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, spanWidth + 1.4, 8), logMat);
  mainLog.rotation.z = Math.PI / 2;
  mainLog.castShadow = true;
  g.add(mainLog);

  const topSlate = new THREE.Mesh(new THREE.BoxGeometry(spanWidth + 1.2, 0.35, 0.8), slateMat);
  topSlate.position.y = 0.45;
  topSlate.castShadow = true;
  g.add(topSlate);

  // Center War Drum (Gandang) on gate crown
  const drum = buildRampartDecor();
  drum.position.set(0, 0.7, 0);
  g.add(drum);

  return g;
}

