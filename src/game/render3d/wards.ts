// Guardian Vision Ward 3D Rendering & Line-of-Sight Vision System
//
// ── PURPOSE ─────────────────────────────────────────────────────────────────
// Renders placed guardian totems on the battlefield.
// Reveals fog of war, jungle brush concealment, and minimap tracking within 16u.
// Zero external asset dependencies: Built with Three.js procedural geometry & materials.

import * as THREE from 'three';
import { terrainHeight } from './terrain';
import type { TeamId } from '@/game/arena/nexus';

export interface WardInstance {
  id: string;
  x: number;
  z: number;
  y: number;
  team: TeamId;
  createdAt: number;
  duration: number; // in seconds (default 90s)
  mesh: THREE.Group;
  visionRadius: number;
}

export interface WardManager {
  group: THREE.Group;
  addWard(id: string, x: number, z: number, team: TeamId, clock: number, duration?: number): WardInstance;
  removeWard(id: string): void;
  getActiveWards(): WardInstance[];
  isPointRevealed(x: number, z: number, team: TeamId): boolean;
  update(clock: number): void;
  dispose(): void;
}

export function createWardManager(): WardManager {
  const group = new THREE.Group();
  group.name = 'guardian-wards';

  const wards = new Map<string, WardInstance>();

  // Shared Materials
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x5c3d2e,
    roughness: 0.85,
    metalness: 0.1,
  });

  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    roughness: 0.3,
    metalness: 0.8,
    emissive: new THREE.Color(0xb48c00),
    emissiveIntensity: 0.4,
  });

  const gemMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    toneMapped: false,
  });

  const visionRingMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const addWard = (
    id: string,
    x: number,
    z: number,
    team: TeamId,
    clock: number,
    duration = 90
  ): WardInstance => {
    const wardGroup = new THREE.Group();
    const y = terrainHeight(x, z);
    wardGroup.position.set(x, y, z);

    // 1. Carved Wooden Totem Pole
    const poleGeo = new THREE.CylinderGeometry(0.22, 0.28, 1.8, 8);
    const poleMesh = new THREE.Mesh(poleGeo, woodMat);
    poleMesh.position.y = 0.9;
    poleMesh.castShadow = true;
    wardGroup.add(poleMesh);

    // 2. Guardian Mask / Head
    const headGeo = new THREE.BoxGeometry(0.48, 0.55, 0.45);
    const headMesh = new THREE.Mesh(headGeo, woodMat);
    headMesh.position.y = 1.95;
    headMesh.castShadow = true;
    wardGroup.add(headMesh);

    // Eyes
    for (const side of [-0.14, 0.14]) {
      const eyeGeo = new THREE.SphereGeometry(0.06, 6, 6);
      const eyeMesh = new THREE.Mesh(eyeGeo, gemMat);
      eyeMesh.position.set(side, 2.0, 0.24);
      wardGroup.add(eyeMesh);
    }

    // 3. Gold Trim Bands
    const bandGeo = new THREE.TorusGeometry(0.26, 0.04, 6, 12);
    bandGeo.rotateX(Math.PI / 2);
    const band1 = new THREE.Mesh(bandGeo, goldTrimMat);
    band1.position.y = 1.3;
    wardGroup.add(band1);

    const band2 = new THREE.Mesh(bandGeo, goldTrimMat);
    band2.position.y = 0.5;
    wardGroup.add(band2);

    // 4. Floating Glowing Crystal Crown
    const crystalGeo = new THREE.OctahedronGeometry(0.25, 0);
    const crystalMesh = new THREE.Mesh(crystalGeo, gemMat);
    crystalMesh.position.y = 2.45;
    crystalMesh.name = 'floating-gem';
    wardGroup.add(crystalMesh);

    // 5. Vision Ground Ring Indicator (16u radius)
    const ringGeo = new THREE.RingGeometry(15.6, 16.0, 36);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, visionRingMat);
    ringMesh.position.y = 0.05;
    wardGroup.add(ringMesh);

    group.add(wardGroup);

    const instance: WardInstance = {
      id,
      x,
      z,
      y,
      team,
      createdAt: clock,
      duration,
      mesh: wardGroup,
      visionRadius: 16.0,
    };

    wards.set(id, instance);
    return instance;
  };

  const removeWard = (id: string) => {
    const ward = wards.get(id);
    if (ward) {
      group.remove(ward.mesh);
      wards.delete(id);
    }
  };

  const getActiveWards = (): WardInstance[] => Array.from(wards.values());

  const isPointRevealed = (x: number, z: number, team: TeamId): boolean => {
    for (const ward of wards.values()) {
      if (ward.team === team) {
        const d = Math.hypot(ward.x - x, ward.z - z);
        if (d <= ward.visionRadius) {
          return true;
        }
      }
    }
    return false;
  };

  const update = (clock: number) => {
    const toRemove: string[] = [];

    for (const [id, ward] of wards.entries()) {
      const elapsed = clock - ward.createdAt;
      if (elapsed >= ward.duration) {
        toRemove.push(id);
        continue;
      }

      // Animate floating crystal
      const gem = ward.mesh.getObjectByName('floating-gem');
      if (gem) {
        gem.position.y = 2.45 + Math.sin(clock * 3.0 + ward.x) * 0.08;
        gem.rotation.y = clock * 1.5;
        gem.rotation.z = Math.sin(clock * 2.0) * 0.2;
      }
    }

    for (const id of toRemove) {
      removeWard(id);
    }
  };

  const dispose = () => {
    for (const ward of wards.values()) {
      group.remove(ward.mesh);
    }
    wards.clear();
    woodMat.dispose();
    goldTrimMat.dispose();
    gemMat.dispose();
    visionRingMat.dispose();
  };

  return {
    group,
    addWard,
    removeWard,
    getActiveWards,
    isPointRevealed,
    update,
    dispose,
  };
}
