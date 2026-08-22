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
    const bodyColor = isAnito ? 0x247582 : 0x73203c;
    const armorColor = isAnito ? 0x8b6e3c : 0x3d1c24;
    const weaponColor = isAnito ? 0xd4af37 : 0xa62b3b;

    let weaponObj: THREE.Object3D;

    if (minion.kind === 'mandirigma') {
      // ── MANDIRIGMA: Kalasag Shield & Kampilan Sword ────────────────────────
      // Torso
      const torso = new THREE.Mesh(
        new THREE.CylinderGeometry(0.48, 0.65, 1.25, 7),
        surfaceMaterial(bodyColor, { roughness: 0.7 })
      );
      torso.position.y = 0.65;
      torso.castShadow = true;
      g.add(torso);

      // Head & Spirit Mask
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.36, 8, 6),
        surfaceMaterial(weaponColor, { roughness: 0.5 })
      );
      head.position.y = 1.45;
      head.castShadow = true;
      g.add(head);

      // Kalasag (Oval/Hexagonal Rattan Shield on Left Arm)
      const kalasag = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.95, 0.55),
        surfaceMaterial(0x8a6234, { roughness: 0.85 })
      );
      kalasag.position.set(-0.52, 0.75, 0.15);
      kalasag.rotation.y = 0.2;
      kalasag.castShadow = true;
      g.add(kalasag);

      // Kampilan (Single-edge sword in Right Hand)
      const kampilanGroup = new THREE.Group();
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.9, 0.18),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.75, roughness: 0.3 })
      );
      blade.position.y = 0.45;
      const hilt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.3, 5),
        surfaceMaterial(0x4a2a12, { roughness: 0.9 })
      );
      hilt.position.y = 0.0;
      kampilanGroup.add(blade, hilt);
      kampilanGroup.position.set(0.5, 0.65, 0.25);
      kampilanGroup.rotation.x = Math.PI / 4;
      g.add(kampilanGroup);
      weaponObj = kampilanGroup;
    } else if (minion.kind === 'mapanahong') {
      // ── MAPANAHONG: Hunter with Sumpit/Bow ─────────────────────────────────
      // Lean Body
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, 1.2, 6),
        surfaceMaterial(bodyColor, { roughness: 0.75 })
      );
      body.position.y = 0.6;
      body.castShadow = true;
      g.add(body);

      // Head with Feather Crest
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 7, 6),
        surfaceMaterial(weaponColor, { roughness: 0.6 })
      );
      head.position.y = 1.35;
      head.castShadow = true;
      g.add(head);

      const crest = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.45, 0.25),
        new THREE.MeshBasicMaterial({ color: team.light, toneMapped: false })
      );
      crest.position.set(0, 1.65, -0.05);
      g.add(crest);

      // Bamboo Bow / Sumpit Blowgun
      const bowGroup = new THREE.Group();
      const bow = new THREE.Mesh(
        new THREE.TorusGeometry(0.45, 0.04, 5, 12, Math.PI * 0.75),
        surfaceMaterial(0x5c4028, { roughness: 0.8 })
      );
      bow.rotation.z = Math.PI / 2;
      bow.position.set(0, 0.2, 0.3);

      const dartTip = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 6),
        new THREE.MeshBasicMaterial({ color: team.light, toneMapped: false })
      );
      dartTip.position.set(0, 0.2, 0.55);
      bowGroup.add(bow, dartTip);
      bowGroup.position.set(0.35, 0.65, 0.15);
      g.add(bowGroup);
      weaponObj = bowGroup;
    } else {
      // ── BAGANI: Heavy Armored Battering Ram Vanguard ───────────────────────
      // Heavy Plated Body
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.72, 0.85, 1.45, 8),
        surfaceMaterial(armorColor, { roughness: 0.8, metalness: 0.2 })
      );
      body.position.y = 0.72;
      body.castShadow = true;
      g.add(body);

      // Heavy Horned Helmet
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.5, 0.55),
        surfaceMaterial(weaponColor, { roughness: 0.5, metalness: 0.4 })
      );
      head.position.y = 1.6;
      head.castShadow = true;
      g.add(head);

      // Portable Battering Ram / Siege Log
      const ramGroup = new THREE.Group();
      const ramLog = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.34, 1.8, 7),
        surfaceMaterial(0x3e2815, { roughness: 0.9 })
      );
      ramLog.rotation.x = Math.PI / 2;
      ramLog.position.set(0, 0, 0.35);

      // Bronze Carabao Ram Head
      const ramHead = new THREE.Mesh(
        new THREE.ConeGeometry(0.36, 0.5, 6),
        new THREE.MeshStandardMaterial({ color: weaponColor, metalness: 0.8, roughness: 0.3 })
      );
      ramHead.rotation.x = Math.PI / 2;
      ramHead.position.set(0, 0, 1.35);

      const ramGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 6, 6),
        new THREE.MeshBasicMaterial({ color: team.light, toneMapped: false })
      );
      ramGlow.position.set(0, 0, 1.5);

      ramGroup.add(ramLog, ramHead, ramGlow);
      ramGroup.position.set(0, 0.75, 0.2);
      g.add(ramGroup);
      weaponObj = ramGroup;
    }

    // Mini overhead health bar
    const barWidth = minion.kind === 'bagani' ? 1.6 : minion.kind === 'mandirigma' ? 1.3 : 1.1;
    const barBg = new THREE.Mesh(
      new THREE.PlaneGeometry(barWidth, 0.16),
      new THREE.MeshBasicMaterial({
        color: 0x111111,
        transparent: true,
        opacity: 0.75,
        depthTest: false,
        side: THREE.DoubleSide,
      })
    );
    barBg.position.y = minion.kind === 'bagani' ? 2.45 : 2.15;
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

        // Weapon subtle motion
        if (pair.weapon) {
          if (m.kind === 'mandirigma') {
            pair.weapon.rotation.x = Math.PI / 4 + Math.sin(clock * 9) * 0.15;
          } else if (m.kind === 'bagani') {
            pair.weapon.position.z = 0.2 + Math.sin(clock * 7) * 0.08;
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
