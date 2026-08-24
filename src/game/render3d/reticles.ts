// Smart-Cast Ground Reticle Telegraphs
//
// ── PURPOSE ─────────────────────────────────────────────────────────────────
// Visual ground projections for aiming skillshots before or during cast.
// Supports Line Arrows, Arc Cones, Ground AoE Circles, and Dash Trajectories.
//
// All reticles hover slightly above the terrain elevation (y + 0.08u) to
// prevent z-fighting and blend additively with the environment.

import * as THREE from 'three';
import type { Ability } from '@/game/heroes';
import { terrainHeight } from './terrain';

export interface ReticleController {
  group: THREE.Group;
  show: (ability: Ability, originX: number, originZ: number, targetX: number, targetZ: number, color?: number) => void;
  hide: () => void;
  update: (originX: number, originZ: number, targetX: number, targetZ: number) => void;
  dispose: () => void;
}

export function createReticleController(): ReticleController {
  const group = new THREE.Group();
  group.name = 'smartcast-reticles';

  // ── Materials ─────────────────────────────────────────────────────────────
  const lineMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const arrowHeadMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const coneMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const circleRingMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const circleFillMat = new THREE.MeshBasicMaterial({
    color: 0x00b4d8,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  // ── Line / Arrow Meshes ───────────────────────────────────────────────────
  const lineGroup = new THREE.Group();
  const lineBodyGeom = new THREE.PlaneGeometry(1, 1);
  const lineBody = new THREE.Mesh(lineBodyGeom, lineMat);
  lineBody.rotation.x = -Math.PI / 2;
  lineGroup.add(lineBody);

  const arrowGeom = new THREE.ConeGeometry(0.8, 1.2, 3);
  arrowGeom.rotateX(-Math.PI / 2);
  arrowGeom.rotateZ(Math.PI);
  const arrowHead = new THREE.Mesh(arrowGeom, arrowHeadMat);
  lineGroup.add(arrowHead);
  lineGroup.visible = false;
  group.add(lineGroup);

  // ── Cone Mesh ─────────────────────────────────────────────────────────────
  const coneGroup = new THREE.Group();
  let coneMesh: THREE.Mesh | null = null;
  coneGroup.visible = false;
  group.add(coneGroup);

  // ── Ground Circle AoE Meshes ──────────────────────────────────────────────
  const circleGroup = new THREE.Group();
  const ringGeom = new THREE.RingGeometry(0.9, 1.0, 36);
  ringGeom.rotateX(-Math.PI / 2);
  const ringMesh = new THREE.Mesh(ringGeom, circleRingMat);
  circleGroup.add(ringMesh);

  const fillGeom = new THREE.CircleGeometry(0.9, 36);
  fillGeom.rotateX(-Math.PI / 2);
  const fillMesh = new THREE.Mesh(fillGeom, circleFillMat);
  circleGroup.add(fillMesh);

  // Center indicator ring
  const centerRingGeom = new THREE.RingGeometry(0.18, 0.25, 16);
  centerRingGeom.rotateX(-Math.PI / 2);
  const centerRing = new THREE.Mesh(centerRingGeom, arrowHeadMat);
  circleGroup.add(centerRing);

  circleGroup.visible = false;
  group.add(circleGroup);

  // ── Active State ──────────────────────────────────────────────────────────
  let activeAbility: Ability | null = null;

  const setColor = (hex: number) => {
    lineMat.color.setHex(hex);
    arrowHeadMat.color.setHex(hex);
    coneMat.color.setHex(hex);
    circleRingMat.color.setHex(hex);
    circleFillMat.color.setHex(hex);
  };

  const update = (originX: number, originZ: number, targetX: number, targetZ: number) => {
    if (!activeAbility) return;

    const dx = targetX - originX;
    const dz = targetZ - originZ;
    const dist = Math.hypot(dx, dz);
    const heading = Math.atan2(dx, dz);
    const range = activeAbility.range;
    const width = activeAbility.width || 1;

    if (activeAbility.shape === 'projectile' || activeAbility.shape === 'dash') {
      lineGroup.visible = true;
      coneGroup.visible = false;
      circleGroup.visible = false;

      const length = Math.min(dist > 0.1 ? dist : range, range);
      const halfLen = length / 2;
      const midX = originX + Math.sin(heading) * halfLen;
      const midZ = originZ + Math.cos(heading) * halfLen;
      const groundY = terrainHeight(midX, midZ) + 0.08;

      lineGroup.position.set(midX, groundY, midZ);
      lineGroup.rotation.y = heading;

      lineBody.scale.set(width * 0.8, length, 1);
      lineBody.position.set(0, 0, 0);

      arrowHead.position.set(0, 0.01, halfLen);
      arrowHead.scale.set(width * 0.9, 1, width * 0.9);
    } else if (activeAbility.shape === 'cone') {
      lineGroup.visible = false;
      circleGroup.visible = false;
      coneGroup.visible = true;

      const coneAngle = Math.min(Math.PI * 0.8, Math.max(Math.PI * 0.2, width * Math.PI * 0.5));
      if (coneMesh) {
        coneGroup.remove(coneMesh);
        coneMesh.geometry.dispose();
      }

      const coneGeom = new THREE.RingGeometry(0.2, range, 24, 1, -coneAngle / 2, coneAngle);
      coneGeom.rotateX(-Math.PI / 2);
      coneMesh = new THREE.Mesh(coneGeom, coneMat);
      coneGroup.add(coneMesh);

      const groundY = terrainHeight(originX, originZ) + 0.08;
      coneGroup.position.set(originX, groundY, originZ);
      coneGroup.rotation.y = heading - Math.PI / 2;
    } else if (activeAbility.shape === 'ground') {
      lineGroup.visible = false;
      coneGroup.visible = false;
      circleGroup.visible = true;

      let targetClampX = targetX;
      let targetClampZ = targetZ;
      if (dist > range) {
        targetClampX = originX + (dx / dist) * range;
        targetClampZ = originZ + (dz / dist) * range;
      }

      const groundY = terrainHeight(targetClampX, targetClampZ) + 0.08;
      circleGroup.position.set(targetClampX, groundY, targetClampZ);

      const radius = Math.max(0.5, width / 2);
      ringMesh.scale.set(radius, 1, radius);
      fillMesh.scale.set(radius, 1, radius);
    }
  };

  const show = (
    ability: Ability,
    originX: number,
    originZ: number,
    targetX: number,
    targetZ: number,
    color = 0x00e5ff
  ) => {
    activeAbility = ability;
    setColor(color);
    update(originX, originZ, targetX, targetZ);
  };

  const hide = () => {
    activeAbility = null;
    lineGroup.visible = false;
    coneGroup.visible = false;
    circleGroup.visible = false;
  };

  const dispose = () => {
    hide();
    lineBodyGeom.dispose();
    arrowGeom.dispose();
    ringGeom.dispose();
    fillGeom.dispose();
    centerRingGeom.dispose();
    lineMat.dispose();
    arrowHeadMat.dispose();
    coneMat.dispose();
    circleRingMat.dispose();
    circleFillMat.dispose();
    if (coneMesh) coneMesh.geometry.dispose();
  };

  return {
    group,
    show,
    hide,
    update,
    dispose,
  };
}
