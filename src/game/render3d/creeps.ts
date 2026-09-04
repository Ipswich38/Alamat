// The 3D render layer for Neutral Jungle Creeps (Monster Hunter Primal Aesthetics).
//
// ── CREEP VISUAL DESIGNS ───────────────────────────────────────────────────
// - Veer Leader: Equine-humanoid warrior with braided horse-hair mane, skull shoulder-pads,
//   carved tribal spear, and dynamic hoof-stomp shockwave particle rings.
// - Forest Spirits: Floating nature wisps with ethereal motes.
// - Hollow Stalkers: Winged feral ghoul with torn leathery bat wings, elongated claws,
//   and skeletal ribcage highlights with glowing crimson viscera.
// - Idol Guardian: Ancient stone & hardwood idol with runic engravings.

import * as THREE from 'three';
import { onCrossing, DECK_HEIGHT } from '@/game/arena/river';
import type { CreepUnit } from '@/game/combat/creeps';
import { surfaceMaterial } from './stage';
import { terrainHeight } from './terrain';

export interface CreepRender {
  group: THREE.Group;
  update(creeps: CreepUnit[], clock: number): void;
  dispose(): void;
}

interface CreepMeshPair {
  id: string;
  kind: CreepUnit['kind'];
  group: THREE.Group;
  healthBar: THREE.Mesh;
  healthFill: THREE.Mesh;
  unit: THREE.Object3D;
  shockwaveMesh?: THREE.Mesh;
}

export function createCreepRender(): CreepRender {
  const group = new THREE.Group();
  group.name = 'neutral-creeps';
  const liveMeshes = new Map<string, CreepMeshPair>();

  const boneMat = surfaceMaterial(0xd8d2c4, { roughness: 0.6, metalness: 0.1 });

  function makeCreepMesh(creep: CreepUnit): CreepMeshPair {
    const g = new THREE.Group();

    let unitObj: THREE.Object3D;
    let shockwave: THREE.Mesh | undefined;
    let barY = 2.4;
    let barWidth = 1.3;
    let barColor = 0x50e3c2;

    if (creep.kind === 'tikbalang_leader') {
      barColor = 0x50e3c2; // Emerald
      barWidth = 1.6;
      barY = 3.0;

      const unitG = new THREE.Group();
      // Muscular Horse-man Biped Body
      const torso = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.78, 1.6, 8),
        surfaceMaterial(0x322214, { roughness: 0.85 })
      );
      torso.position.y = 0.95;
      torso.castShadow = true;
      unitG.add(torso);

      // Skull Shoulder-Pads (Lashed Beast Skull Pauldrons)
      for (const side of [-1, 1]) {
        const skullPad = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 4), boneMat);
        skullPad.position.set(side * 0.78, 1.65, 0);
        skullPad.rotation.set(0, 0, -side * Math.PI / 3);
        skullPad.castShadow = true;
        unitG.add(skullPad);
      }

      // Horse Head / Muzzle
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.55, 0.85),
        surfaceMaterial(0x22160d, { roughness: 0.8 })
      );
      head.position.set(0, 2.05, 0.25);
      head.castShadow = true;

      // Braided Horse-Hair Mane (Flowing down back of neck)
      const maneMat = surfaceMaterial(0x110c08, { roughness: 0.95 });
      for (let m = 0; m < 4; m++) {
        const braid = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.65, 5), maneMat);
        braid.position.set(0, 2.2 - m * 0.2, -0.35 - m * 0.1);
        braid.rotation.set(-Math.PI / 4, 0, 0);
        unitG.add(braid);
      }

      // Glowing Eyes
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x50e3c2, toneMapped: false });
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), eyeMat);
      eyeL.position.set(0.19, 2.15, 0.52);
      const eyeR = eyeL.clone();
      eyeR.position.x = -0.19;
      unitG.add(head, eyeL, eyeR);

      // Tribal Wooden Spear with Bone/Jade Spearhead
      const spear = new THREE.Group();
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.07, 2.5, 6),
        surfaceMaterial(0x4a321a, { roughness: 0.9 })
      );
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.6, 5),
        new THREE.MeshStandardMaterial({ color: 0x50e3c2, roughness: 0.25, metalness: 0.8 })
      );
      tip.position.y = 1.45;
      spear.add(shaft, tip);
      spear.position.set(0.72, 1.0, 0.25);
      spear.rotation.x = Math.PI / 6;
      spear.castShadow = true;
      unitG.add(spear);

      // Hoof-stomp Shockwave Ring
      const shockGeo = new THREE.RingGeometry(0.6, 1.8, 24);
      shockGeo.rotateX(-Math.PI / 2);
      const shockMat = new THREE.MeshBasicMaterial({
        color: 0x50e3c2,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      shockwave = new THREE.Mesh(shockGeo, shockMat);
      shockwave.position.y = 0.05;
      unitG.add(shockwave);

      g.add(unitG);
      unitObj = unitG;
    } else if (creep.kind === 'tikbalang_wisp') {
      barColor = 0x50e3c2;
      barWidth = 0.9;
      barY = 1.7;

      const unitG = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x70ffda, toneMapped: false })
      );
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.58, 8, 6),
        new THREE.MeshBasicMaterial({
          color: 0x50e3c2,
          transparent: true,
          opacity: 0.4,
          toneMapped: false,
        })
      );
      core.position.y = 0.85;
      halo.position.y = 0.85;
      unitG.add(core, halo);

      g.add(unitG);
      unitObj = unitG;
    } else if (creep.kind === 'aswang_stalker') {
      barColor = 0xff3366; // Crimson
      barWidth = 1.4;
      barY = 2.6;

      const unitG = new THREE.Group();
      // Severed Ghoul Upper Torso (Sever)
      const torsoMat = surfaceMaterial(0x42121d, { roughness: 0.75 });
      const torso = new THREE.Mesh(new THREE.ConeGeometry(0.52, 1.3, 7), torsoMat);
      torso.position.y = 1.0;
      torso.rotation.x = 0.25;
      torso.castShadow = true;
      unitG.add(torso);

      // Skeletal Ribcage Highlights
      for (let rib = 0; rib < 4; rib++) {
        const ribMesh = new THREE.Mesh(
          new THREE.TorusGeometry(0.42 - rib * 0.04, 0.05, 4, 8, Math.PI * 0.9),
          boneMat
        );
        ribMesh.position.set(0, 1.15 - rib * 0.18, 0.12);
        ribMesh.rotation.set(Math.PI / 2.2, 0, Math.PI * 0.05);
        unitG.add(ribMesh);
      }

      // Internal Glowing Viscera Core
      const viscera = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xff1035, toneMapped: false })
      );
      viscera.position.set(0, 0.9, 0.05);
      unitG.add(viscera);

      // Feral Ghoul Head with Fangs
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.36, 8, 7),
        surfaceMaterial(0x280b12, { roughness: 0.6 })
      );
      head.position.set(0, 1.75, 0.2);
      head.castShadow = true;

      // Crimson eyes & fangs
      const eyes = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.09, 0.1),
        new THREE.MeshBasicMaterial({ color: 0xff0033, toneMapped: false })
      );
      eyes.position.set(0, 1.82, 0.46);

      const fangs = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 4), boneMat);
      fangs.position.set(0.12, 1.62, 0.48);
      fangs.rotation.x = Math.PI;
      const fangR = fangs.clone();
      fangR.position.x = -0.12;
      unitG.add(head, eyes, fangs, fangR);

      // Elongated Claws / Talons
      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.8, 5), torsoMat);
        arm.position.set(side * 0.65, 1.2, 0.2);
        arm.rotation.set(Math.PI / 4, 0, side * Math.PI / 5);
        unitG.add(arm);

        for (let c = 0; c < 3; c++) {
          const claw = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.35, 4), boneMat);
          claw.position.set(side * 0.8 + (c - 1) * 0.08, 0.85, 0.45);
          claw.rotation.set(Math.PI / 1.8, 0, side * 0.3);
          unitG.add(claw);
        }
      }

      // Leathery Bat Wings with Torn Webbing & Bone Struts
      const wingMat = surfaceMaterial(0x2a0610, { roughness: 0.9 });
      for (const side of [-1, 1]) {
        const wingGroup = new THREE.Group();
        wingGroup.position.set(side * 0.45, 1.45, -0.15);

        // Bone strut
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 5), boneMat);
        strut.position.set(side * 0.65, 0.35, 0);
        strut.rotation.set(0, 0, -side * 0.6);
        wingGroup.add(strut);

        // Torn wing membrane plane
        const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9, 3, 3), wingMat);
        wing.position.set(side * 0.6, 0.15, -0.05);
        wing.rotation.set(0, side * 0.35, -side * 0.25);
        wing.castShadow = true;
        wingGroup.add(wing);

        unitG.add(wingGroup);
      }

      g.add(unitG);
      unitObj = unitG;
    } else if (creep.kind === 'scuttler') {
      // Gold River Crab (Golden River Scuttler)
      barColor = 0xffd700; // Bright Gold
      barWidth = 1.4;
      barY = 1.6;

      const unitG = new THREE.Group();
      const crabMat = surfaceMaterial(0xc99318, { roughness: 0.35, metalness: 0.65 });
      const shellTopMat = surfaceMaterial(0xefb82c, { roughness: 0.25, metalness: 0.75 });

      // Flattened Golden Carapace Shell
      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.95, 0.42, 8),
        shellTopMat
      );
      shell.scale.set(1.2, 0.7, 0.9);
      shell.position.y = 0.32;
      shell.castShadow = true;
      unitG.add(shell);

      // Shell Dome / Crest
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.72, 8, 6),
        crabMat
      );
      dome.scale.set(1.1, 0.45, 0.85);
      dome.position.y = 0.45;
      dome.castShadow = true;
      unitG.add(dome);

      // Glowing Cyan Eye Stalks
      const eyeGlowMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, toneMapped: false });
      for (const side of [-1, 1]) {
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 4), crabMat);
        stalk.position.set(side * 0.24, 0.65, 0.55);
        stalk.rotation.x = Math.PI / 6;
        const eyeOrb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), eyeGlowMat);
        eyeOrb.position.set(side * 0.24, 0.8, 0.62);
        unitG.add(stalk, eyeOrb);
      }

      // Front Pincer Claws
      for (const side of [-1, 1]) {
        const pincerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.6, 5), crabMat);
        pincerArm.position.set(side * 0.75, 0.32, 0.55);
        pincerArm.rotation.set(0, side * Math.PI / 4, side * Math.PI / 3);
        const clawMain = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 4), shellTopMat);
        clawMain.position.set(side * 1.05, 0.35, 0.85);
        clawMain.rotation.set(Math.PI / 2, 0, side * Math.PI / 6);
        clawMain.castShadow = true;
        unitG.add(pincerArm, clawMain);
      }

      // 6 Articulated Walking Legs
      for (let leg = 0; leg < 3; leg++) {
        for (const side of [-1, 1]) {
          const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.75, 4), crabMat);
          legMesh.position.set(side * (0.85 + leg * 0.12), 0.22, (leg - 1) * 0.38);
          legMesh.rotation.set(0, 0, -side * (Math.PI / 3 - leg * 0.1));
          legMesh.castShadow = true;
          unitG.add(legMesh);
        }
      }

      g.add(unitG);
      unitObj = unitG;
    } else {
      // Idol Guardian (Ancient Stone / Wood Idol)
      barColor = 0xffd06f; // Gold
      barWidth = 1.9;
      barY = 3.5;

      const unitG = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 1.9, 1.1),
        surfaceMaterial(0x543b22, { roughness: 0.95 })
      );
      body.position.y = 1.15;
      body.castShadow = true;
      body.receiveShadow = true;
      unitG.add(body);

      const head = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 1.0, 0.95),
        surfaceMaterial(0x422e1a, { roughness: 0.9 })
      );
      head.position.y = 2.45;
      head.castShadow = true;

      const runeEyes = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.18, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xffd06f, toneMapped: false })
      );
      runeEyes.position.set(0, 2.5, 0.55);
      unitG.add(head, runeEyes);

      const scepter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.32, 2.1, 6),
        surfaceMaterial(0x2f261f, { roughness: 0.95 })
      );
      scepter.position.set(0.95, 1.25, 0.45);
      scepter.rotation.x = Math.PI / 5;
      scepter.castShadow = true;
      unitG.add(scepter);

      g.add(unitG);
      unitObj = unitG;
    }

    // Overhead health bar
    const barBg = new THREE.Mesh(
      new THREE.PlaneGeometry(barWidth, 0.18),
      new THREE.MeshBasicMaterial({
        color: 0x111111,
        transparent: true,
        opacity: 0.8,
        depthTest: false,
        side: THREE.DoubleSide,
      })
    );
    barBg.position.y = barY;
    barBg.renderOrder = 9;

    const fillMat = new THREE.MeshBasicMaterial({
      color: barColor,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const healthFill = new THREE.Mesh(new THREE.PlaneGeometry(barWidth * 0.96, 0.14), fillMat);
    healthFill.position.set(0, 0, 0.01);
    barBg.add(healthFill);
    g.add(barBg);

    group.add(g);
    return { id: creep.id, kind: creep.kind, group: g, healthBar: barBg, healthFill, unit: unitObj, shockwaveMesh: shockwave };
  }

  function disposeMesh(p: CreepMeshPair) {
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
    update(creeps, clock) {
      const seen = new Set<string>();

      for (const c of creeps) {
        seen.add(c.id);
        let pair = liveMeshes.get(c.id);
        if (!pair) {
          pair = makeCreepMesh(c);
          liveMeshes.set(c.id, pair);
        }

        const y = onCrossing(c.x, c.z) ? DECK_HEIGHT : terrainHeight(c.x, c.z);
        const isMoving = c.state === 'chasing' || c.state === 'returning';
        const bob = Math.sin(clock * (isMoving ? 8 : 2.5) + c.anchorX) * (c.kind === 'tikbalang_wisp' ? 0.22 : 0.06);
        pair.group.position.set(c.x, y + Math.max(0, bob), c.z);
        pair.group.rotation.y = c.facing;

        // Veer hoof-stomp shockwave animation
        if (pair.shockwaveMesh) {
          const stompRate = isMoving ? 3.0 : 1.0;
          const prog = (clock * stompRate) % 1.0;
          pair.shockwaveMesh.scale.setScalar(1.0 + prog * 1.8);
          (pair.shockwaveMesh.material as THREE.MeshBasicMaterial).opacity = (1 - prog) * (isMoving ? 0.7 : 0.25);
        }

        // Health bar update
        const pct = Math.max(0, Math.min(1, c.health / c.maxHealth));
        pair.healthFill.scale.x = pct;
        const barWidth = c.kind === 'idol_guardian' ? 1.9 : c.kind === 'tikbalang_leader' ? 1.6 : c.kind === 'aswang_stalker' ? 1.4 : 0.9;
        pair.healthFill.position.x = ((pct - 1) * barWidth * 0.96) / 2;
        pair.healthBar.visible = pct < 0.99 || c.state === 'chasing';
      }

      // Remove dead creeps
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

