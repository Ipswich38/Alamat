// The 3D render layer for minion waves.
//
// ── WHY BUILT FROM STYLIZED PRIMITIVES ─────────────────────────────────────────
// Minions exist in large numbers (up to 36 on the map at peak), so they must be
// lightweight, distinct from afar, and carry team colours instantly:
// - Anito minions: Gold and sky-blue spirits of the Diwata realm.
// - Malakas minions: Crimson and obsidian beasts of the Aswang lair.

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
}

export function createMinionRender(): MinionRender {
  const group = new THREE.Group();
  group.name = 'minions';
  const liveMeshes = new Map<string, MinionMeshPair>();

  function makeMinionMesh(minion: Minion): MinionMeshPair {
    const g = new THREE.Group();
    const isAnito = minion.team === 'anito';
    const team = isAnito ? TEAMS.anito : TEAMS.malakas;

    // Body
    const bodyGeo = minion.kind === 'vanguard'
      ? new THREE.CylinderGeometry(0.55, 0.75, 1.4, 7)
      : new THREE.ConeGeometry(0.5, 1.3, 6);
    const bodyMat = surfaceMaterial(isAnito ? 0x2e8b9a : 0x6e2448, { roughness: 0.7 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.7;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    // Head / Mask
    const headGeo = new THREE.SphereGeometry(0.38, 8, 6);
    const headMat = surfaceMaterial(isAnito ? 0xffd25a : 0xb52b3d, { roughness: 0.5 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.5;
    head.castShadow = true;
    g.add(head);

    // Glowing weapon / emblem
    const accentGeo = minion.kind === 'vanguard'
      ? new THREE.BoxGeometry(0.2, 0.8, 0.45)
      : new THREE.SphereGeometry(0.22, 6, 6);
    const accentMat = new THREE.MeshBasicMaterial({
      color: team.light,
      toneMapped: false,
    });
    const accent = new THREE.Mesh(accentGeo, accentMat);
    accent.position.set(0.48, 0.85, 0.25);
    g.add(accent);

    // Mini overhead health bar
    const barBgGeo = new THREE.PlaneGeometry(1.2, 0.16);
    const barBgMat = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.75,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const healthBar = new THREE.Mesh(barBgGeo, barBgMat);
    healthBar.position.y = 2.15;
    healthBar.renderOrder = 9;

    const fillGeo = new THREE.PlaneGeometry(1.16, 0.12);
    const fillMat = new THREE.MeshBasicMaterial({
      color: team.light,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const healthFill = new THREE.Mesh(fillGeo, fillMat);
    healthFill.position.set(0, 0, 0.01);
    healthBar.add(healthFill);
    g.add(healthBar);

    group.add(g);
    return { id: minion.id, group: g, healthBar, healthFill };
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
        // Slight bobbing while marching
        const bob = Math.sin(clock * 9 + m.progress * 40) * 0.08;
        pair.group.position.set(m.x, y + Math.max(0, bob), m.z);
        pair.group.rotation.y = m.facing;

        // Update health bar scale
        const pct = Math.max(0, Math.min(1, m.health / m.maxHealth));
        pair.healthFill.scale.x = pct;
        pair.healthFill.position.x = (pct - 1) * 0.58;
        pair.healthBar.visible = pct < 0.99; // Show only when damaged or engaged
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
