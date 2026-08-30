// The defensive turrets (watchtowers): pre-colonial ancient architecture.
//
// ── ARCHITECTURE SPECIFICATION ──────────────────────────────────────────────
// - Tier 1, 2, and 3 Tower Models:
//   * Asset Base: Multi-tiered bamboo and hardwood watchtowers with woven thatched roofs (Nipa/Cogon style).
//   * Top Structure: Carved tribal spirit mask mounted at the apex. Mask eyes glow with the controlling team's color (Gold for SW Dawn, Cyan for NE Dusk).
// - Turret Attack VFX & Aggro Indicators:
//   * Subtle, low-opacity team-colored ground etch decal (Opacity: 0.12).
//   * Turret Projectile: Glowing energy orb firing from the spirit mask mouth towards target colliders.

import * as THREE from 'three';
import { buildTowers, type TowerNode } from '@/game/arena/lanes';
import { TEAMS } from '@/game/arena/nexus';
import { loadModel } from './models';
import { surfaceMaterial } from './stage';
import { terrainHeight } from './terrain';

/** Tower height by tier. */
const HEIGHT: Record<number, number> = { 1: 8.0, 2: 9.5, 3: 11.2 };

export interface Towers {
  group: THREE.Group;
  nodes: TowerNode[];
  fell(id: string): void;
  update(t: number): void;
  dispose(): void;
}

interface TowerEye {
  mesh: THREE.Mesh;
  light: THREE.PointLight | null;
  seed: number;
}

export function createTowers(): Towers {
  const group = new THREE.Group();
  group.name = 'defensive-watchtowers';
  const nodes = buildTowers();
  const towerEyes: TowerEye[] = [];
  const bodies: THREE.Group[] = [];

  for (const [i, node] of nodes.entries()) {
    const team = TEAMS[node.team];
    const g = new THREE.Group();
    g.name = `tower:${node.id}`;
    const groundY = terrainHeight(node.x, node.z);
    g.position.set(node.x, groundY, node.z);

    // Towers face inward toward the center of the arena
    const facing = Math.atan2(-node.x, -node.z);
    g.rotation.y = facing;

    // 1. Build Multi-Tiered Bamboo & Hardwood Watchtower Model (Tier 1, 2, or 3)
    const towerMesh = buildWatchtowerModel(node.tier, node.team, (eyeMesh) => {
      towerEyes.push({
        mesh: eyeMesh,
        light: null,
        seed: i * 1.3,
      });
    });
    g.add(towerMesh);

    // 2. Turret Range Aggro Indicator: Subtle low-opacity team-colored ground etch decal (Opacity: 0.12)
    const decalGroup = buildRangeEtchDecal(node.range, team.light);
    g.add(decalGroup);

    group.add(g);
    bodies.push(g);
  }

  // Optional external glb asset support
  loadModel('/models/props/watchtower.glb', { height: 10 }).then((model) => {
    if (!model) return;
  });

  return {
    group,
    nodes,
    fell: (id) => {
      const i = nodes.findIndex((n) => n.id === id);
      if (i < 0) return;
      const g = bodies[i];
      for (const child of [...g.children]) child.visible = false;

      // Construct detailed fallen ruin
      const ruin = buildTowerRuin();
      g.add(ruin);
    },
    update: (t) => {
      for (const eye of towerEyes) {
        if (!eye.mesh.visible) continue;
        // Breathing pulse on the spirit mask glowing eyes
        const pulse = 1.0 + Math.sin(t * 2.2 + eye.seed) * 0.15;
        eye.mesh.scale.setScalar(pulse);
      }
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
// WATCHTOWER ARCHITECTURE BUILDER (TIERS 1, 2, 3)
// ────────────────────────────────────────────────────────────────────────────

function buildWatchtowerModel(
  tier: number,
  teamId: 'dawn' | 'dusk',
  onEyeCreated: (eye: THREE.Mesh) => void
): THREE.Group {
  const g = new THREE.Group();

  const woodMat = surfaceMaterial(0x3e2b1c, { roughness: 0.88 });
  const bambooMat = surfaceMaterial(0x6e5a32, { roughness: 0.82 });
  const thatchMat = surfaceMaterial(0x8f784b, { roughness: 0.96 });
  const stoneMat = surfaceMaterial(0x50483c, { roughness: 0.94 });

  const teamColor = teamId === 'dawn' ? 0xffb300 : 0x00e5ff;
  const eyeMat = new THREE.MeshBasicMaterial({
    color: teamColor,
    toneMapped: false,
  });

  const totalHeight = HEIGHT[tier] || 8.0;

  // 1. Stone Foundation Footings
  for (const [fx, fz] of [
    [-1.3, -1.3],
    [1.3, -1.3],
    [-1.3, 1.3],
    [1.3, 1.3],
  ]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.7, 6), stoneMat);
    foot.position.set(fx, 0.35, fz);
    foot.castShadow = true;
    foot.receiveShadow = true;
    g.add(foot);
  }

  // 2. Corner Hardwood Stilt Pillars with angled taper
  const stiltHeight = totalHeight * 0.65;
  for (const [fx, fz] of [
    [-1.3, -1.3],
    [1.3, -1.3],
    [-1.3, 1.3],
    [1.3, 1.3],
  ]) {
    const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, stiltHeight, 6), woodMat);
    stilt.position.set(fx * 0.85, stiltHeight / 2 + 0.35, fz * 0.85);
    stilt.rotation.x = fz > 0 ? -0.06 : 0.06;
    stilt.rotation.z = fx > 0 ? 0.06 : -0.06;
    stilt.castShadow = true;
    stilt.receiveShadow = true;
    g.add(stilt);
  }

  // 3. Bamboo Cross-Bracing Struts & Ties
  for (const y of [stiltHeight * 0.35, stiltHeight * 0.7]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 2.4), bambooMat);
    brace.position.y = y;
    brace.castShadow = true;
    g.add(brace);
  }

  // 4. Elevated Guard Deck Platform
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.25, 2.8), woodMat);
  deck.position.y = stiltHeight + 0.35;
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);

  // Deck Bamboo Perimeter Railing
  const rail = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.7, 2.7), bambooMat);
  rail.position.y = stiltHeight + 0.75;
  g.add(rail);

  // Tier 2 & 3: Additional Sawali siding and middle observation tier
  if (tier >= 2) {
    const sawali = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, stiltHeight * 0.35, 2.3),
      surfaceMaterial(0x5c4a28, { roughness: 0.9 })
    );
    sawali.position.y = stiltHeight * 0.5;
    sawali.castShadow = true;
    g.add(sawali);

    // Lower Thatched Eave Skirt
    const lowerThatched = new THREE.Mesh(
      new THREE.ConeGeometry(2.5, 0.9, 4),
      thatchMat
    );
    lowerThatched.rotation.y = Math.PI / 4;
    lowerThatched.position.y = stiltHeight * 0.72;
    lowerThatched.castShadow = true;
    g.add(lowerThatched);
  }

  // Tier 3: Fortified Torogan Top Gable & Carved Ridge Finials
  if (tier >= 3) {
    const midDeck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 3.2), woodMat);
    midDeck.position.y = stiltHeight + 1.8;
    g.add(midDeck);
  }

  // 5. Main Woven Thatched Roof (Nipa / Cogon style pyramid roof)
  const roofHeight = 1.8 + tier * 0.4;
  const roofRadius = 2.4 + tier * 0.35;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(roofRadius, roofHeight, 4),
    thatchMat
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = totalHeight - roofHeight * 0.35;
  roof.castShadow = true;
  g.add(roof);

  // Roof Ridge Cap (Nipa crest)
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, roofRadius * 1.3), thatchMat);
  ridge.position.y = totalHeight + 0.4;
  ridge.rotation.y = Math.PI / 4;
  g.add(ridge);

  // 6. Carved Tribal Spirit Mask (Mounted at Apex / Front)
  const maskGroup = buildTribalSpiritMask(eyeMat, onEyeCreated);
  maskGroup.position.set(0, totalHeight - 0.4, 1.25);
  g.add(maskGroup);

  return g;
}

/**
 * Carved Tribal Spirit Mask mounted at the tower apex with glowing eyes.
 */
function buildTribalSpiritMask(
  eyeMat: THREE.MeshBasicMaterial,
  onEyeCreated: (eye: THREE.Mesh) => void
): THREE.Group {
  const g = new THREE.Group();
  const woodMat = surfaceMaterial(0x3a2517, { roughness: 0.82 });

  // Mask Wooden Head Structure
  const maskBody = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.55), woodMat);
  maskBody.castShadow = true;
  g.add(maskBody);

  // Carved Horns / Spirit Plumes
  for (const hx of [-0.48, 0.48]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.85, 5), woodMat);
    horn.position.set(hx, 0.95, 0);
    horn.rotation.z = hx > 0 ? -0.35 : 0.35;
    horn.castShadow = true;
    g.add(horn);
  }

  // Carved Grimace Mouth / Fire Nozzle (Origin point of turret orb)
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.25, 0.3), surfaceMaterial(0x1a0f08, { roughness: 0.9 }));
  mouth.position.set(0, -0.35, 0.22);
  g.add(mouth);

  // Glowing Spirit Eyes
  const eyeL = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), eyeMat);
  eyeL.position.set(-0.25, 0.18, 0.28);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.25;
  g.add(eyeL, eyeR);

  onEyeCreated(eyeL);
  onEyeCreated(eyeR);

  return g;
}

/**
 * Turret Range Ground Etch Decal (Subtle low-opacity team-colored ground etch, Opacity: 0.12).
 */
function buildRangeEtchDecal(range: number, teamLight: number): THREE.Group {
  const g = new THREE.Group();

  // 1. Outer Team Range Perimeter Decal Ring (Opacity: 0.12)
  const ringGeo = new THREE.RingGeometry(range - 0.45, range, 54);
  const ringMat = new THREE.MeshBasicMaterial({
    color: teamLight,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    toneMapped: false,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  g.add(ring);

  // 2. Subtle Inner Concentric Etch Ring
  const innerRingGeo = new THREE.RingGeometry(range * 0.65 - 0.15, range * 0.65, 48);
  const innerRingMat = new THREE.MeshBasicMaterial({
    color: teamLight,
    transparent: true,
    opacity: 0.07,
    side: THREE.DoubleSide,
    toneMapped: false,
    depthWrite: false,
  });
  const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.045;
  g.add(innerRing);

  return g;
}

/**
 * Collapsed Thatched Tower Ruin.
 */
function buildTowerRuin(): THREE.Group {
  const g = new THREE.Group();
  const rubbleMat = surfaceMaterial(0x4a4035, { roughness: 0.98 });
  const timberMat = surfaceMaterial(0x5c4832, { roughness: 0.95 });
  const thatchMat = surfaceMaterial(0x6e5c38, { roughness: 0.96 });

  // Stone & timber debris pile
  const rubble = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.4, 1.4, 8), rubbleMat);
  rubble.position.y = 0.7;
  rubble.receiveShadow = true;
  g.add(rubble);

  // Leaning shattered timber stilt shard
  const shard = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 3.6, 6), timberMat);
  shard.position.set(0.9, 1.8, -0.4);
  shard.rotation.z = 0.48;
  shard.castShadow = true;
  g.add(shard);

  // Collapsed thatched roof fragment
  const thatchChunk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 1.8), thatchMat);
  thatchChunk.position.set(-0.8, 0.9, 0.6);
  thatchChunk.rotation.set(0.3, 0.4, -0.2);
  thatchChunk.castShadow = true;
  g.add(thatchChunk);

  return g;
}

