// The 3D render layer for Epic Bosses: Bakunawa and Kapre (Monster Hunter Primal Upgrade).
//
// ── BAKUNAWA (The Moon-Eater) ──────────────────────────────────────────────
// 1.8x scaled giant sea serpent: Iridescent bioluminescent scales, exposed spiny dorsal fins,
// articulated skeletal jaw structure with pulsating glowing throat (charging breath attack),
// water-dripping particles, dynamic tail-thrashing idle animations, and expanding water ripple rings.
//
// ── KAPRE (Giant Tree Warden) ──────────────────────────────────────────────
// Primal titan with rugged bark-like musculature, draped hanging moss/vines across shoulders,
// flaming ember eyes, heavy billowing smoke trail emitting from carved wooden pipe,
// and bone armor plates lashed to knuckles, shoulders, and knees.

import * as THREE from 'three';
import { onCrossing, DECK_HEIGHT } from '@/game/arena/river';
import type { EpicBoss, PushingKapreUnit } from '@/game/combat/bosses';
import { surfaceMaterial } from './stage';
import { terrainHeight } from './terrain';

export interface BossRender {
  group: THREE.Group;
  update(bakunawa: EpicBoss, kapre: EpicBoss, pushingKapre: PushingKapreUnit | null, clock: number): void;
  dispose(): void;
}

export function createBossRender(): BossRender {
  const group = new THREE.Group();
  group.name = 'epic-bosses';

  // ═════════════════════════════════════════════════════════════════════════
  // 1. BAKUNAWA (1.8x Scale Primal Sea Serpent)
  // ═════════════════════════════════════════════════════════════════════════
  const bGroup = new THREE.Group();
  bGroup.name = 'bakunawa-monster-hunter';
  bGroup.scale.setScalar(1.8); // 1.8x Size & Presence Upgrade

  // Whirlpool Base
  const poolGeo = new THREE.RingGeometry(1.6, 6.4, 36);
  poolGeo.rotateX(-Math.PI / 2);
  const poolMat = new THREE.MeshBasicMaterial({
    color: 0x06202c,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
  });
  const whirlpool = new THREE.Mesh(poolGeo, poolMat);
  whirlpool.position.y = -0.15;
  bGroup.add(whirlpool);

  // Dynamic Expanding Water Ripple Rings (tail-thrashing ripples)
  const RIPPLE_COUNT = 3;
  const ripples: { mesh: THREE.Mesh; scale: number; speed: number; phase: number }[] = [];
  const ripGeo = new THREE.RingGeometry(1.8, 2.4, 32);
  ripGeo.rotateX(-Math.PI / 2);

  for (let r = 0; r < RIPPLE_COUNT; r++) {
    const ripMat = new THREE.MeshBasicMaterial({
      color: 0x5ce1e6,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const ripMesh = new THREE.Mesh(ripGeo, ripMat);
    ripMesh.position.y = -0.1;
    bGroup.add(ripMesh);
    ripples.push({ mesh: ripMesh, scale: 1.0, speed: 0.8 + r * 0.2, phase: r * (Math.PI / 1.5) });
  }

  // Iridescent Bioluminescent Scales & Spiny Dorsal Fins
  const SEGMENTS = 8;
  const segments: THREE.Group[] = [];
  const scaleMat = new THREE.MeshStandardMaterial({
    color: 0x0c3b4a,
    emissive: new THREE.Color('#003847'),
    emissiveIntensity: 0.6,
    roughness: 0.24,
    metalness: 0.75,
  });

  const finMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    transparent: true,
    opacity: 0.82,
    toneMapped: false,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < SEGMENTS; i++) {
    const segGroup = new THREE.Group();
    const radius = 1.25 - i * 0.11;

    // Body segment sphere
    const segMesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), scaleMat);
    segMesh.castShadow = true;
    segGroup.add(segMesh);

    // Lateral Armored Flank Scutes (Iridescent dragon scales)
    for (const side of [-1, 1]) {
      const scuteGeo = new THREE.ConeGeometry(radius * 0.45, radius * 0.9, 4);
      const scute = new THREE.Mesh(scuteGeo, scaleMat);
      scute.position.set(side * radius * 0.85, 0, 0);
      scute.rotation.set(0, 0, -side * Math.PI / 3);
      scute.castShadow = true;
      segGroup.add(scute);
    }

    // Exposed Spiny Dorsal Fin Crest with glowing membrane
    const spineGeo = new THREE.ConeGeometry(0.18, radius * 1.6, 4);
    const spine = new THREE.Mesh(spineGeo, finMat);
    spine.position.set(0, radius + radius * 0.5, -radius * 0.2);
    spine.rotation.x = -Math.PI / 5;
    segGroup.add(spine);

    segGroup.position.set(0, 0.8 + i * 0.85, -i * 0.5);
    bGroup.add(segGroup);
    segments.push(segGroup);
  }

  // Serpentine Dragon Head & Skeletal Jaw Structure
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 6.2, -0.8);

  // Upper Skull & Brow
  const upperSkull = new THREE.Mesh(
    new THREE.ConeGeometry(1.3, 2.6, 7),
    new THREE.MeshStandardMaterial({
      color: 0x082b36,
      emissive: new THREE.Color('#00242e'),
      roughness: 0.3,
      metalness: 0.6,
    })
  );
  upperSkull.rotation.x = Math.PI / 2.6;
  upperSkull.castShadow = true;
  headGroup.add(upperSkull);

  // Upper Fangs
  const fangMat = new THREE.MeshStandardMaterial({ color: 0xedeae1, roughness: 0.2, metalness: 0.1 });
  for (const side of [-1, 1]) {
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.75, 4), fangMat);
    fang.position.set(side * 0.65, -0.4, 1.2);
    fang.rotation.x = Math.PI / 1.8;
    headGroup.add(fang);
  }

  // Articulated Lower Jaw
  const lowerJaw = new THREE.Group();
  const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 2.0), scaleMat);
  jawMesh.position.set(0, -0.15, 0.9);
  jawMesh.castShadow = true;
  lowerJaw.add(jawMesh);

  // Lower needle teeth
  for (let t = 0; t < 4; t++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 4), fangMat);
    tooth.position.set((t % 2 === 0 ? 0.35 : -0.35), 0.1, 0.4 + t * 0.4);
    lowerJaw.add(tooth);
  }
  lowerJaw.position.set(0, -0.3, 0.2);
  headGroup.add(lowerJaw);

  // Pulsating Glowing Throat (Charging breath attack effect)
  const throatCoreGeo = new THREE.SphereGeometry(0.55, 8, 8);
  const throatCoreMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.95,
    toneMapped: false,
  });
  const throatCore = new THREE.Mesh(throatCoreGeo, throatCoreMat);
  throatCore.position.set(0, -0.1, 0.5);
  headGroup.add(throatCore);

  // Glowing Dragon Eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd700, toneMapped: false });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.24, 7, 7), eyeMat);
  eyeL.position.set(0.75, 0.8, 0.5);
  const eyeR = eyeL.clone();
  eyeR.position.x = -0.75;
  headGroup.add(eyeL, eyeR);

  // Sweeping Dragon Horns (Monster Hunter Elder Dragon aesthetic)
  const hornMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.25 });
  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.24, 2.2, 6), hornMat);
    horn.position.set(side * 0.95, 1.1, -0.8);
    horn.rotation.set(-0.6, 0, side * 0.5);
    horn.castShadow = true;
    headGroup.add(horn);
  }

  // Whisker Antennae
  for (const side of [-1, 1]) {
    const whisker = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 2.4, 4), finMat);
    whisker.position.set(side * 0.95, -0.35, 1.1);
    whisker.rotation.set(0.4, 0, side * 0.7);
    headGroup.add(whisker);
  }

  bGroup.add(headGroup);

  // Water-Dripping Droplets Particle Mesh
  const DROP_COUNT = 16;
  const dropGeo = new THREE.ConeGeometry(0.06, 0.35, 4);
  dropGeo.rotateX(Math.PI);
  const dropMat = new THREE.MeshBasicMaterial({
    color: 0x88e2ff,
    transparent: true,
    opacity: 0.75,
    toneMapped: false,
  });
  const dropMesh = new THREE.InstancedMesh(dropGeo, dropMat, DROP_COUNT);
  const dropData: { seed: number; speed: number; segmentIdx: number }[] = [];
  const oDrop = new THREE.Object3D();

  for (let d = 0; d < DROP_COUNT; d++) {
    dropData.push({
      seed: d * 1.618,
      speed: 3.2 + (d % 4) * 1.2,
      segmentIdx: d % SEGMENTS,
    });
  }
  bGroup.add(dropMesh);

  group.add(bGroup);

  // ═════════════════════════════════════════════════════════════════════════
  // 2. KAPRE (Primal Ape/Titan Stance & Silhouette)
  // ═════════════════════════════════════════════════════════════════════════
  const kGroup = new THREE.Group();
  kGroup.name = 'kapre-monster-hunter';

  // Muscular Rugged Bark Ape Torso
  const barkMat = surfaceMaterial(0x2d1c10, { roughness: 0.98 });
  const mossMat = surfaceMaterial(0x3a5e2d, { roughness: 0.92 });
  const boneMat = surfaceMaterial(0xdcd5c5, { roughness: 0.65, metalness: 0.1 });

  const kTorso = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 3.2, 8), barkMat);
  kTorso.position.y = 1.8;
  kTorso.castShadow = true;
  kGroup.add(kTorso);

  // Muscular Hunched Shoulders & Back Crest
  const hunchedBack = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), barkMat);
  hunchedBack.position.set(0, 2.6, -0.4);
  hunchedBack.scale.set(1.4, 0.9, 1.1);
  hunchedBack.castShadow = true;
  kGroup.add(hunchedBack);

  // Hanging Moss & Leafy Vine Garlands across shoulders
  for (let m = 0; m < 5; m++) {
    const vine = new THREE.Mesh(new THREE.TorusGeometry(1.2 + m * 0.15, 0.22, 5, 8, Math.PI), mossMat);
    vine.position.set(0, 2.7 - m * 0.25, 0.1);
    vine.rotation.set(Math.PI / 2.5, (m - 2) * 0.2, 0);
    vine.castShadow = true;
    kGroup.add(vine);
  }

  // Head with Heavy Primal Brow
  const kHead = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.2), barkMat);
  kHead.position.set(0, 3.6, 0.3);
  kHead.castShadow = true;

  // Emissive Flaming Ember Eyes
  const kEyes = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.18, 0.18),
    new THREE.MeshBasicMaterial({ color: 0xff3b00, toneMapped: false })
  );
  kEyes.position.set(0, 3.75, 0.9);
  kGroup.add(kHead, kEyes);

  // Oversized Carved Wooden Pipe (Tabako)
  const pipe = new THREE.Group();
  const pipeStem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.6, 6), surfaceMaterial(0x422815, { roughness: 0.85 }));
  pipeStem.rotation.x = Math.PI / 2.3;
  const pipeBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.5, 6), surfaceMaterial(0x351f0f, { roughness: 0.9 }));
  pipeBowl.position.set(0, 0.28, 0.9);
  const pipeCherry = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2600, toneMapped: false }));
  pipeCherry.position.set(0, 0.45, 0.9);
  pipe.add(pipeStem, pipeBowl, pipeCherry);
  pipe.position.set(0.45, 3.2, 0.6);
  kGroup.add(pipe);

  // Billowing Smoke Trail Particles (Heavy smoke emitting from pipe)
  const SMOKE_COUNT = 16;
  const smokeGeo = new THREE.IcosahedronGeometry(0.38, 1);
  const smokeMat = new THREE.MeshBasicMaterial({
    color: 0x6e6259,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const smokeMesh = new THREE.InstancedMesh(smokeGeo, smokeMat, SMOKE_COUNT);
  const smokeData: { seed: number; speed: number; rise: number }[] = [];
  const oSmoke = new THREE.Object3D();

  for (let s = 0; s < SMOKE_COUNT; s++) {
    smokeData.push({
      seed: s * 2.13,
      speed: 1.6 + (s % 3) * 0.8,
      rise: 0.8 + (s % 4) * 0.4,
    });
  }
  kGroup.add(smokeMesh);

  // Bone Armor Plates Lashed to Knuckles, Shoulders, and Knees
  // 1. Shoulder Bone Pauldrons
  for (const side of [-1, 1]) {
    const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 1.1), boneMat);
    pauldron.position.set(side * 1.85, 2.7, 0);
    pauldron.rotation.set(0, 0, -side * 0.4);
    pauldron.castShadow = true;
    kGroup.add(pauldron);
  }

  // 2. Knuckle Armor Plates (Heavy Primal Fist Guards)
  for (const side of [-1, 1]) {
    const knuckleBone = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.35, 0.75), boneMat);
    knuckleBone.position.set(side * 1.9, 0.6, 0.6);
    knuckleBone.castShadow = true;
    kGroup.add(knuckleBone);
  }

  // 3. Knee Bone Plates
  for (const side of [-1, 1]) {
    const kneeBone = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.35), boneMat);
    kneeBone.position.set(side * 0.75, 0.8, 0.95);
    kneeBone.castShadow = true;
    kGroup.add(kneeBone);
  }

  // Massive Primal Balete Root Club with stone studs
  const club = new THREE.Group();
  const clubShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.75, 4.2, 7), barkMat);
  clubShaft.position.y = 1.9;
  clubShaft.castShadow = true;
  club.add(clubShaft);

  // Stone/Bone spikes on club head
  for (let sp = 0; sp < 4; sp++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.65, 4), boneMat);
    const ang = (sp / 4) * Math.PI * 2;
    spike.position.set(Math.cos(ang) * 0.7, 3.2, Math.sin(ang) * 0.7);
    spike.rotation.set(Math.PI / 2, 0, ang);
    club.add(spike);
  }
  club.position.set(2.0, 1.4, 0.7);
  club.rotation.set(Math.PI / 4, 0, -0.2);
  kGroup.add(club);

  group.add(kGroup);

  // ═════════════════════════════════════════════════════════════════════════
  // 3. PUSHING ALLIED KAPRE SIEGE UNIT
  // ═════════════════════════════════════════════════════════════════════════
  const pGroup = new THREE.Group();
  pGroup.name = 'pushing-kapre-siege';
  pGroup.visible = false;

  const pTorso = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 2.9, 8), surfaceMaterial(0x244237, { roughness: 0.88 }));
  pTorso.position.y = 1.6;
  pTorso.castShadow = true;

  const pHead = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.1), surfaceMaterial(0x1a332a, { roughness: 0.85 }));
  pHead.position.set(0, 3.4, 0.2);

  // Bone Plates on Siege Kapre
  const pPauldronL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 1.0), boneMat);
  pPauldronL.position.set(1.6, 2.5, 0);
  const pPauldronR = pPauldronL.clone();
  pPauldronR.position.x = -1.6;

  // Radiant Golden Spirit Halo
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(1.4, 1.9, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd06f, side: THREE.DoubleSide, toneMapped: false })
  );
  halo.position.set(0, 4.6, 0);

  const pClub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.65, 3.8, 7), barkMat);
  pClub.position.set(1.7, 1.6, 0.6);
  pClub.rotation.set(Math.PI / 4, 0, -0.2);

  pGroup.add(pTorso, pHead, pPauldronL, pPauldronR, halo, pClub);
  group.add(pGroup);

  return {
    group,
    update(bakunawa, kapre, pushingKapre, clock) {
      // ── 1. Update Bakunawa ───────────────────────────────────────────────
      bGroup.visible = bakunawa.alive;
      if (bakunawa.alive) {
        const y = onCrossing(bakunawa.x, bakunawa.z) ? DECK_HEIGHT : terrainHeight(bakunawa.x, bakunawa.z);
        bGroup.position.set(bakunawa.x, y - 0.25, bakunawa.z);
        bGroup.rotation.y = bakunawa.facing;

        // Multi-frequency tail thrashing wave
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          const waveAmp = (i / segments.length) * 0.85 + 0.25;
          seg.position.x = Math.sin(clock * 3.8 + i * 0.75) * waveAmp;
          seg.position.z = -i * 0.5 + Math.cos(clock * 2.9 + i * 0.6) * (waveAmp * 0.6);
          seg.rotation.y = Math.sin(clock * 3.8 + i * 0.75) * 0.25;
        }

        // Head and jaw articulation
        headGroup.position.x = Math.sin(clock * 3.8) * 0.55;
        headGroup.rotation.z = Math.sin(clock * 2.8) * 0.16;

        // Throat glow pulses when in combat (charging breath attack)
        const throatPulse = bakunawa.inCombat ? 1.6 + Math.sin(clock * 9.0) * 0.8 : 0.8 + Math.sin(clock * 3.0) * 0.3;
        throatCore.scale.setScalar(throatPulse);

        // Jaw opening during combat
        lowerJaw.rotation.x = bakunawa.inCombat ? Math.sin(clock * 4.0) * 0.35 + 0.2 : 0.05;

        // Whirlpool rotation & expanding ripple rings
        whirlpool.rotation.z = clock * 2.2;
        for (let r = 0; r < ripples.length; r++) {
          const rip = ripples[r];
          const progress = ((clock * rip.speed + rip.phase) % Math.PI) / Math.PI;
          rip.mesh.scale.setScalar(1.0 + progress * 2.4);
          (rip.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.65;
        }

        // Water droplet particle physics
        for (let d = 0; d < DROP_COUNT; d++) {
          const data = dropData[d];
          const seg = segments[data.segmentIdx];
          const age = (clock * data.speed + data.seed) % 1.5;
          const dropY = Math.max(-0.2, (seg.position.y + 0.6) - age * 3.5);
          oDrop.position.set(seg.position.x + Math.sin(data.seed) * 0.8, dropY, seg.position.z);
          oDrop.scale.setScalar(Math.max(0.1, 1 - age / 1.5));
          oDrop.updateMatrix();
          dropMesh.setMatrixAt(d, oDrop.matrix);
        }
        dropMesh.instanceMatrix.needsUpdate = true;
      }

      // ── 2. Update Kapre ──────────────────────────────────────────────────
      kGroup.visible = kapre.alive;
      if (kapre.alive) {
        const y = onCrossing(kapre.x, kapre.z) ? DECK_HEIGHT : terrainHeight(kapre.x, kapre.z);
        const bob = Math.sin(clock * 2.6) * 0.1;
        kGroup.position.set(kapre.x, y + bob, kapre.z);
        kGroup.rotation.y = kapre.facing;

        // Pipe cherry pulse
        pipeCherry.scale.setScalar(0.9 + Math.sin(clock * 6.5) * 0.3);
        club.rotation.x = Math.PI / 4 + Math.sin(clock * 2.6) * 0.12;

        // Heavy smoke trail puff physics
        for (let s = 0; s < SMOKE_COUNT; s++) {
          const d = smokeData[s];
          const age = (clock * d.speed + d.seed) % 2.5;
          const prog = age / 2.5;

          const px = 0.45 + Math.sin(clock * 0.8 + d.seed) * (prog * 1.8);
          const py = 3.6 + age * d.rise;
          const pz = 1.0 + Math.cos(clock * 0.8 + d.seed) * (prog * 1.8);

          oSmoke.position.set(px, py, pz);
          oSmoke.scale.setScalar(0.4 + prog * 1.8);
          oSmoke.updateMatrix();
          smokeMesh.setMatrixAt(s, oSmoke.matrix);
        }
        smokeMesh.instanceMatrix.needsUpdate = true;
      }

      // ── 3. Update Pushing Kapre ──────────────────────────────────────────
      if (pushingKapre && pushingKapre.alive) {
        pGroup.visible = true;
        const y = onCrossing(pushingKapre.x, pushingKapre.z) ? DECK_HEIGHT : terrainHeight(pushingKapre.x, pushingKapre.z);
        const marchBob = Math.sin(clock * 6.5) * 0.16;
        pGroup.position.set(pushingKapre.x, y + Math.max(0, marchBob), pushingKapre.z);
        pGroup.rotation.y = pushingKapre.facing;
        halo.rotation.z = clock * 1.4;
        pClub.rotation.x = Math.PI / 4 + Math.sin(clock * 6.5) * 0.28;
      } else {
        pGroup.visible = false;
      }
    },
    dispose() {
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

