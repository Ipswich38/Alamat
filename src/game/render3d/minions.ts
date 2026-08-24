// The 3D render layer for minion waves.
//
// ── THE THREE PANGKAT (DIVISIONS) ───────────────────────────────────────────
// - Mandirigma: Kalasag rattan shield + Kampilan short sword
// - Mapanahong: Bamboo bow / Sumpit blowgun + poison dart
// - Bagani: Heavy armor + portable carved battering ram

import * as THREE from 'three';
import { TEAMS } from '@/game/arena/nexus';
import { DECK_HEIGHT, onCrossing } from '@/game/arena/river';
import type { Minion } from '@/game/combat/minions';
import { surfaceMaterial } from './stage';
import { terrainHeight } from './terrain';

export interface MinionRender {
  group: THREE.Group;
  update(minions: Minion[], clock: number): void;
  dispose(): void;
}

interface MinionMeshPair {
  id: string;
  group: THREE.Group;
  healthBar: THREE.Mesh;
  healthFill: THREE.Mesh;
  weapon: THREE.Object3D;
}

export function createMinionRender(): MinionRender {
  const group = new THREE.Group();
  group.name = 'minions';
  const liveMeshes = new Map<string, MinionMeshPair>();

  function makeMinionMesh(minion: Minion): MinionMeshPair {
    const g = new THREE.Group();
    const isAnito = minion.team === 'anito';
    const team = isAnito ? TEAMS.anito : TEAMS.malakas;
    const bodyColor = isAnito ? 0x1f5c66 : 0x6e1b32;
    const armorColor = isAnito ? 0x7c5e2d : 0x3d1720;
    const weaponColor = isAnito ? 0xd4af37 : 0xa62b3b;
    const clothAccent = isAnito ? 0xe5c158 : 0xd63031;

    let weaponObj: THREE.Object3D;

    if (minion.kind === 'mandirigma') {
      // ── MANDIRIGMA: Pre-colonial Warrior with Putong, Kalasag & Kampilan ────
      const unitGroup = new THREE.Group();

      // Torso with Bahag Cloth Wrap
      const torso = new THREE.Mesh(
        new THREE.CylinderGeometry(0.46, 0.62, 1.25, 8),
        surfaceMaterial(bodyColor, { roughness: 0.72 })
      );
      torso.position.y = 0.65;
      torso.castShadow = true;
      unitGroup.add(torso);

      // Pintados Tattoo Band / Bahag Sash
      const sash = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.08, 4, 8),
        surfaceMaterial(clothAccent, { roughness: 0.8 })
      );
      sash.position.y = 0.55;
      sash.rotation.x = Math.PI / 2;
      unitGroup.add(sash);

      // Head & Pre-colonial Woven Putong Headband
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 8, 6),
        surfaceMaterial(0x8a5a3c, { roughness: 0.6 })
      );
      head.position.y = 1.45;
      head.castShadow = true;
      unitGroup.add(head);

      // Putong Crown / Headband
      const putong = new THREE.Mesh(
        new THREE.TorusGeometry(0.36, 0.07, 4, 12),
        new THREE.MeshBasicMaterial({ color: clothAccent, toneMapped: false })
      );
      putong.position.set(0, 1.55, 0);
      putong.rotation.x = Math.PI / 2;
      unitGroup.add(putong);

      // Spirit Mask Eyes
      const eyeMat = new THREE.MeshBasicMaterial({ color: team.light, toneMapped: false });
      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.08), eyeMat);
      eyeL.position.set(0.12, 1.48, 0.32);
      const eyeR = eyeL.clone();
      eyeR.position.x = -0.12;
      unitGroup.add(eyeL, eyeR);

      // Kalasag (Hexagonal Carved Rattan Shield on Left Arm with Team Sunburst)
      const kalasagGroup = new THREE.Group();
      const kalasag = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 1.05, 0.58),
        surfaceMaterial(0x6b4a24, { roughness: 0.88 })
      );
      kalasag.castShadow = true;

      // Embossed Sunburst Boss on Shield
      const boss = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.14, 0),
        new THREE.MeshBasicMaterial({ color: team.light, toneMapped: false })
      );
      boss.position.set(-0.08, 0, 0);
      boss.rotation.y = Math.PI / 4;
      kalasagGroup.add(kalasag, boss);
      kalasagGroup.position.set(-0.54, 0.78, 0.15);
      kalasagGroup.rotation.y = 0.25;
      unitGroup.add(kalasagGroup);

      // Kampilan (Traditional Single-Edge Sword with Forked Tip & Crocodile Hilt)
      const kampilanGroup = new THREE.Group();
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 1.05, 0.18),
        new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.85, roughness: 0.2 })
      );
      blade.position.y = 0.52;

      // Forked tip at sword apex
      const tipFork = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.22, 4),
        new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.85, roughness: 0.2 })
      );
      tipFork.position.set(0, 1.1, 0.05);
      tipFork.rotation.x = Math.PI / 6;

      // Glowing edge rune
      const edgeGlow = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.95, 0.04),
        new THREE.MeshBasicMaterial({ color: team.light, toneMapped: false })
      );
      edgeGlow.position.set(0, 0.52, 0.1);

      // Carved Hardwood Hilt & Pommel
      const hilt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.07, 0.32, 5),
        surfaceMaterial(0x381f0d, { roughness: 0.9 })
      );
      hilt.position.y = -0.05;

      kampilanGroup.add(blade, tipFork, edgeGlow, hilt);
      kampilanGroup.position.set(0.52, 0.68, 0.22);
      kampilanGroup.rotation.x = Math.PI / 4;
      unitGroup.add(kampilanGroup);

      g.add(unitGroup);
      weaponObj = kampilanGroup;
    } else if (minion.kind === 'mapanahong') {
      // ── MAPANAHONG: Village Hunter with Conical Salakot & Bamboo Sumpit/Bow ──
      const unitGroup = new THREE.Group();

      // Agile Body
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, 1.25, 7),
        surfaceMaterial(bodyColor, { roughness: 0.75 })
      );
      body.position.y = 0.62;
      body.castShadow = true;
      unitGroup.add(body);

      // Head
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 7, 6),
        surfaceMaterial(0x8a5a3c, { roughness: 0.6 })
      );
      head.position.y = 1.35;
      head.castShadow = true;
      unitGroup.add(head);

      // Conical Woven Salakot Hat
      const salakot = new THREE.Mesh(
        new THREE.ConeGeometry(0.65, 0.35, 10),
        surfaceMaterial(0x8f764a, { roughness: 0.92 })
      );
      salakot.position.set(0, 1.62, 0);
      salakot.castShadow = true;
      unitGroup.add(salakot);

      // Feathered Spirit Crest Plume on Salakot
      const feather = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.45, 0.22),
        new THREE.MeshBasicMaterial({ color: team.light, toneMapped: false })
      );
      feather.position.set(0, 1.85, -0.15);
      feather.rotation.x = -Math.PI / 6;
      unitGroup.add(feather);

      // Quiver with Darts on Back
      const quiver = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.1, 0.75, 5),
        surfaceMaterial(0x4a321a, { roughness: 0.85 })
      );
      quiver.position.set(0, 0.85, -0.32);
      quiver.rotation.x = -Math.PI / 4;
      unitGroup.add(quiver);

      // Bamboo Longbow & Glowing Poison Dart
      const bowGroup = new THREE.Group();
      const bow = new THREE.Mesh(
        new THREE.TorusGeometry(0.48, 0.04, 5, 14, Math.PI * 0.8),
        surfaceMaterial(0x5c4028, { roughness: 0.8 })
      );
      bow.rotation.z = Math.PI / 2;
      bow.position.set(0, 0.2, 0.3);

      // Bowstring
      const stringMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.85, 3),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
      );
      stringMesh.position.set(0, 0.2, 0.15);
      stringMesh.rotation.x = Math.PI / 2;

      // Poison Dart Tip with Glowing Trail
      const dartTip = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 6),
        new THREE.MeshBasicMaterial({ color: team.light, toneMapped: false })
      );
      dartTip.position.set(0, 0.2, 0.58);
      bowGroup.add(bow, stringMesh, dartTip);
      bowGroup.position.set(0.38, 0.65, 0.18);
      unitGroup.add(bowGroup);

      g.add(unitGroup);
      weaponObj = bowGroup;
    } else {
      // ── BAGANI: Heavy Armored Carabao Skull Siege Ram Vanguard ─────────────
      const unitGroup = new THREE.Group();

      // Heavy Armored Bulwark Body
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.88, 1.48, 8),
        surfaceMaterial(armorColor, { roughness: 0.82, metalness: 0.25 })
      );
      body.position.y = 0.74;
      body.castShadow = true;
      unitGroup.add(body);

      // Layered Shoulder Pauldrons
      for (const side of [-1, 1]) {
        const pauldron = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 0.25, 0.6),
          surfaceMaterial(weaponColor, { roughness: 0.6, metalness: 0.4 })
        );
        pauldron.position.set(side * 0.82, 1.35, 0);
        pauldron.rotation.z = -side * 0.3;
        pauldron.castShadow = true;
        unitGroup.add(pauldron);
      }

      // Heavy Horned War Helmet
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.52, 0.58),
        surfaceMaterial(weaponColor, { roughness: 0.5, metalness: 0.45 })
      );
      head.position.y = 1.62;
      head.castShadow = true;
      unitGroup.add(head);

      // Glowing Helmet Visor Slit
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.08, 0.1),
        new THREE.MeshBasicMaterial({ color: team.light, toneMapped: false })
      );
      visor.position.set(0, 1.64, 0.32);
      unitGroup.add(visor);

      // Portable Carved Carabao Skull Battering Ram
      const ramGroup = new THREE.Group();
      const ramLog = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.36, 2.0, 7),
        surfaceMaterial(0x3e2815, { roughness: 0.92 })
      );
      ramLog.rotation.x = Math.PI / 2;
      ramLog.position.set(0, 0, 0.45);
      ramLog.castShadow = true;

      // Bronze Carabao Ram Head
      const ramHead = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, 0.6, 6),
        new THREE.MeshStandardMaterial({ color: weaponColor, metalness: 0.85, roughness: 0.25 })
      );
      ramHead.rotation.x = Math.PI / 2;
      ramHead.position.set(0, 0, 1.55);
      ramHead.castShadow = true;

      // Curved Horns on Ram Head
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(
          new THREE.TorusGeometry(0.32, 0.08, 5, 8, Math.PI * 0.6),
          surfaceMaterial(0x1a1a1a, { roughness: 0.7 })
        );
        horn.position.set(side * 0.42, 0.15, 1.45);
        horn.rotation.set(Math.PI / 4, 0, side * Math.PI / 3);
        ramHead.add(horn);
      }

      const ramGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 6, 6),
        new THREE.MeshBasicMaterial({ color: team.light, toneMapped: false })
      );
      ramGlow.position.set(0, 0, 1.85);

      ramGroup.add(ramLog, ramHead, ramGlow);
      ramGroup.position.set(0, 0.78, 0.25);
      unitGroup.add(ramGroup);
      weaponObj = ramGroup;

      g.add(unitGroup);
    }

    // Mini overhead health bar with clean team accent
    const barWidth = minion.kind === 'bagani' ? 1.6 : minion.kind === 'mandirigma' ? 1.3 : 1.1;
    const barBg = new THREE.Mesh(
      new THREE.PlaneGeometry(barWidth, 0.16),
      new THREE.MeshBasicMaterial({
        color: 0x0f172a,
        transparent: true,
        opacity: 0.8,
        depthTest: false,
        side: THREE.DoubleSide,
      })
    );
    barBg.position.y = minion.kind === 'bagani' ? 2.55 : 2.25;
    barBg.renderOrder = 9;

    const fillMat = new THREE.MeshBasicMaterial({
      color: team.light,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const healthFill = new THREE.Mesh(new THREE.PlaneGeometry(barWidth * 0.96, 0.12), fillMat);
    healthFill.position.set(0, 0, 0.01);
    barBg.add(healthFill);
    g.add(barBg);

    group.add(g);
    return { id: minion.id, group: g, healthBar: barBg, healthFill, weapon: weaponObj };
  }

  function disposeMesh(p: MinionMeshPair) {
    group.remove(p.group);
    p.group.traverse((n) => {
      const m = n as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) mat.dispose();
      }
    });
  }

  return {
    group,
    update(minions, clock) {
      const seen = new Set<string>();

      for (const m of minions) {
        seen.add(m.id);
        let pair = liveMeshes.get(m.id);
        if (!pair) {
          pair = makeMinionMesh(m);
          liveMeshes.set(m.id, pair);
        }

        const y = onCrossing(m.x, m.z) ? DECK_HEIGHT : terrainHeight(m.x, m.z);
        // Marching bob animation
        const bob = Math.sin(clock * 9 + m.progress * 40) * (m.kind === 'bagani' ? 0.05 : 0.08);
        pair.group.position.set(m.x, y + Math.max(0, bob), m.z);
        pair.group.rotation.y = m.facing;

        // Weapon dynamic motion during movement & attack
        if (pair.weapon) {
          if (m.kind === 'mandirigma') {
            pair.weapon.rotation.x = Math.PI / 4 + Math.sin(clock * 9) * 0.18;
          } else if (m.kind === 'bagani') {
            pair.weapon.position.z = 0.25 + Math.sin(clock * 7) * 0.12;
          } else if (m.kind === 'mapanahong') {
            pair.weapon.rotation.y = Math.sin(clock * 5) * 0.1;
          }
        }

        // Update health bar scale
        const pct = Math.max(0, Math.min(1, m.health / m.maxHealth));
        pair.healthFill.scale.x = pct;
        const barWidth = m.kind === 'bagani' ? 1.6 : m.kind === 'mandirigma' ? 1.3 : 1.1;
        pair.healthFill.position.x = ((pct - 1) * barWidth * 0.96) / 2;
        pair.healthBar.visible = pct < 0.99;
      }

      // Remove meshes for dead minions
      for (const [id, pair] of liveMeshes.entries()) {
        if (!seen.has(id)) {
          disposeMesh(pair);
          liveMeshes.delete(id);
        }
      }
    },
    dispose() {
      for (const pair of liveMeshes.values()) {
        disposeMesh(pair);
      }
      liveMeshes.clear();
    },
  };
}
