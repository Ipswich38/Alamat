// 3D Procedural Raid Monsters Renderer (Tikbalang, Aswang, Manananggal)
//
// ── PURPOSE ─────────────────────────────────────────────────────────────────
// Renders dynamic 3D mythological creatures for PvE Folklore Monster Raid.
// Zero external asset dependencies: Fully synthesized Three.js geometry & materials.

import * as THREE from 'three';
import type { RaidMonster } from '@/game/combat/raid';

export interface RaidMonsterRender {
  group: THREE.Group;
  update(monsters: RaidMonster[], clock: number): void;
  dispose(): void;
}

export function createRaidMonsterRender(): RaidMonsterRender {
  const group = new THREE.Group();
  group.name = 'raid-monsters-layer';

  const monsterMeshes = new Map<string, THREE.Group>();

  // Shared Materials
  const tikbalangMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a29,
    roughness: 0.7,
    metalness: 0.2,
    emissive: new THREE.Color(0x064e3b),
    emissiveIntensity: 0.3,
  });

  const aswangMat = new THREE.MeshStandardMaterial({
    color: 0x450a0a,
    roughness: 0.4,
    metalness: 0.6,
    emissive: new THREE.Color(0x991b1b),
    emissiveIntensity: 0.4,
  });

  const manananggalMat = new THREE.MeshStandardMaterial({
    color: 0x3b0764,
    roughness: 0.5,
    metalness: 0.3,
    emissive: new THREE.Color(0x7e22ce),
    emissiveIntensity: 0.5,
  });

  const eyeGlowMat = new THREE.MeshBasicMaterial({
    color: 0xff0055,
    toneMapped: false,
  });

  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x1f1635,
    roughness: 0.6,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });

  const hpBarBgMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const hpBarFillMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  const createMonsterMesh = (m: RaidMonster): THREE.Group => {
    const mg = new THREE.Group();
    mg.scale.setScalar(m.scale);

    if (m.kind === 'tikbalang') {
      // Bipedal Equine demon
      // Torso
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.4, 8), tikbalangMat);
      body.position.y = 1.2;
      mg.add(body);

      // Horse Head / Snout
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.5, 0.8), tikbalangMat);
      head.position.set(0, 2.1, 0.35);
      head.rotation.x = 0.2;
      mg.add(head);

      // Equine ears
      for (const side of [-0.2, 0.2]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 4), tikbalangMat);
        ear.position.set(side, 2.5, 0.1);
        ear.rotation.z = side > 0 ? -0.3 : 0.3;
        mg.add(ear);
      }

      // Glowing Eyes
      for (const side of [-0.14, 0.14]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeGlowMat);
        eye.position.set(side, 2.15, 0.7);
        mg.add(eye);
      }
    } else if (m.kind === 'aswang') {
      // Quadruped / crouching feral predator
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.65, 8, 8), aswangMat);
      body.scale.set(0.8, 0.7, 1.3);
      body.position.y = 0.8;
      mg.add(body);

      // Head with razor fangs
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), aswangMat);
      head.position.set(0, 1.1, 0.75);
      mg.add(head);

      // Crimson eyes
      for (const side of [-0.16, 0.16]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), eyeGlowMat);
        eye.position.set(side, 1.2, 1.1);
        mg.add(eye);
      }
    } else if (m.kind === 'manananggal') {
      // Floating severed torso with bat wings
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.2, 1.1, 8), manananggalMat);
      torso.position.y = 2.0;
      mg.add(torso);

      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), manananggalMat);
      head.position.set(0, 2.8, 0);
      mg.add(head);

      // Bat Wings
      for (const side of [-1, 1]) {
        const wingGeo = new THREE.PlaneGeometry(1.2, 0.8);
        const wing = new THREE.Mesh(wingGeo, wingMat);
        wing.position.set(side * 0.8, 2.2, -0.1);
        wing.rotation.y = side * 0.4;
        wing.name = `wing-${side}`;
        mg.add(wing);
      }
    }

    // Overhead Health Bar
    const hpGroup = new THREE.Group();
    hpGroup.name = 'hp-bar';
    hpGroup.position.set(0, 3.2, 0);

    const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.16), hpBarBgMat);
    hpBg.rotation.x = -Math.PI / 4;
    hpGroup.add(hpBg);

    const hpFill = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 0.12), hpBarFillMat);
    hpFill.position.z = 0.01;
    hpFill.rotation.x = -Math.PI / 4;
    hpFill.name = 'hp-fill';
    hpGroup.add(hpFill);

    mg.add(hpGroup);
    group.add(mg);

    return mg;
  };

  const update = (monsters: RaidMonster[], clock: number) => {
    const activeIds = new Set<string>();

    for (const m of monsters) {
      if (!m.alive) continue;
      activeIds.add(m.id);

      let mg = monsterMeshes.get(m.id);
      if (!mg) {
        mg = createMonsterMesh(m);
        monsterMeshes.set(m.id, mg);
      }

      mg.visible = true;
      mg.position.set(m.x, m.y, m.z);
      mg.rotation.y = m.heading;

      // Bobbing / wing flapping animation
      if (m.kind === 'manananggal') {
        mg.position.y += Math.sin(clock * 5.0 + m.x) * 0.25;
        const leftWing = mg.getObjectByName('wing--1');
        const rightWing = mg.getObjectByName('wing-1');
        if (leftWing) leftWing.rotation.y = -0.4 + Math.sin(clock * 8.0) * 0.4;
        if (rightWing) rightWing.rotation.y = 0.4 - Math.sin(clock * 8.0) * 0.4;
      }

      // Update HP bar fill
      const hpFill = mg.getObjectByName('hp-fill') as THREE.Mesh | null;
      if (hpFill) {
        const pct = Math.max(0, Math.min(1, m.hp / m.maxHp));
        hpFill.scale.set(pct, 1, 1);
        hpFill.position.x = ((pct - 1) * 1.16) / 2;
      }
    }

    // Hide or remove dead monster meshes
    for (const [id, mg] of monsterMeshes.entries()) {
      if (!activeIds.has(id)) {
        mg.visible = false;
      }
    }
  };

  const dispose = () => {
    for (const mg of monsterMeshes.values()) {
      group.remove(mg);
    }
    monsterMeshes.clear();
    tikbalangMat.dispose();
    aswangMat.dispose();
    manananggalMat.dispose();
    eyeGlowMat.dispose();
    wingMat.dispose();
    hpBarBgMat.dispose();
    hpBarFillMat.dispose();
  };

  return {
    group,
    update,
    dispose,
  };
}
