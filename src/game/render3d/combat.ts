// Combat marks: telegraphs, traces, projectiles and hit bursts.
//
// ── WHY THIS IS RENDERING ONLY ─────────────────────────────────────────────
// Hit tests live in the arena loop, because they are gameplay. This file only
// draws the promise and consequence of those tests: where a shape will land,
// where a basic attack travelled, and where damage connected. Keeping the two
// apart means the renderer can get prettier without changing whether a hit is
// legal.

import * as THREE from 'three';
import { DECK_HEIGHT, onCrossing } from '@/game/arena/river';
import { terrainHeight } from './terrain';

interface TimedFx {
  object: THREE.Object3D;
  age: number;
  life: number;
  update: (t: number) => void;
}

export interface CombatFx {
  group: THREE.Group;
  addLine(x: number, z: number, heading: number, range: number, halfWidth: number, colour: number, life: number): void;
  addCircle(x: number, z: number, radius: number, colour: number, life: number): void;
  addCone(x: number, z: number, heading: number, range: number, halfAngle: number, colour: number, life: number): void;
  addBurst(x: number, z: number, colour: number): void;
  makeProjectile(colour: number): THREE.Object3D;
  removeObject(object: THREE.Object3D): void;
  update(dt: number): void;
  dispose(): void;
}

/** Height for combat effects that should sit just above whatever is under them. */
export function combatGroundY(x: number, z: number): number {
  return (onCrossing(x, z) ? DECK_HEIGHT : terrainHeight(x, z)) + 0.12;
}

function fadeObject(object: THREE.Object3D, opacity: number): void {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of list) {
      if ('opacity' in mat) mat.opacity = opacity;
    }
  });
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of list) mat.dispose();
  });
}

export function createCombatFx(): CombatFx {
  const group = new THREE.Group();
  group.name = 'combat-fx';
  const live: TimedFx[] = [];

  function track(object: THREE.Object3D, life: number, update: (t: number) => void): void {
    group.add(object);
    live.push({ object, age: 0, life, update });
  }

  function addLine(
    x: number,
    z: number,
    heading: number,
    range: number,
    halfWidth: number,
    colour: number,
    life: number
  ): void {
    const dx = Math.sin(heading);
    const dz = Math.cos(heading);
    const mat = new THREE.MeshBasicMaterial({
      color: colour,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.05, range), mat);
    mesh.position.set(x + dx * range * 0.5, combatGroundY(x, z) + 0.03, z + dz * range * 0.5);
    mesh.rotation.y = heading;
    mesh.renderOrder = 8;
    track(mesh, life, (t) => {
      const k = 1 - t;
      mesh.scale.x = 0.65 + k * 0.35;
      mat.opacity = 0.34 * k;
    });
  }

  function addCircle(x: number, z: number, radius: number, colour: number, life: number): void {
    const g = new THREE.Group();
    g.position.set(x, combatGroundY(x, z), z);

    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 44),
      new THREE.MeshBasicMaterial({
        color: colour,
        transparent: true,
        opacity: 0.13,
        depthWrite: false,
        toneMapped: false,
      })
    );
    fill.rotation.x = -Math.PI / 2;
    g.add(fill);

    const rim = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.92, radius, 52),
      new THREE.MeshBasicMaterial({
        color: colour,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      })
    );
    rim.rotation.x = -Math.PI / 2;
    g.add(rim);

    g.renderOrder = 8;
    track(g, life, (t) => {
      const pulse = 1 + Math.sin(t * Math.PI * 4) * 0.025;
      rim.scale.setScalar(pulse);
      fadeObject(g, Math.max(0, 1 - t * 0.85));
    });
  }

  function addCone(
    x: number,
    z: number,
    heading: number,
    range: number,
    halfAngle: number,
    colour: number,
    life: number
  ): void {
    const steps = 28;
    const positions: number[] = [0, 0, 0];
    const indices: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = -halfAngle + (i / steps) * halfAngle * 2;
      positions.push(Math.sin(a) * range, 0, Math.cos(a) * range);
      if (i > 0) indices.push(0, i, i + 1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshBasicMaterial({
      color: colour,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, combatGroundY(x, z) + 0.04, z);
    mesh.rotation.y = heading;
    mesh.renderOrder = 8;
    track(mesh, life, (t) => {
      mat.opacity = 0.22 * (1 - t);
      mesh.scale.setScalar(0.98 + t * 0.08);
    });
  }

  function addBurst(x: number, z: number, colour: number): void {
    const g = new THREE.Group();
    g.position.set(x, combatGroundY(x, z) + 0.25, z);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.65, 0.9, 34),
      new THREE.MeshBasicMaterial({
        color: colour,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);

    const spark = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.38, 1),
      new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.85, toneMapped: false })
    );
    spark.position.y = 0.7;
    g.add(spark);

    track(g, 0.42, (t) => {
      ring.scale.setScalar(1 + t * 2.2);
      spark.scale.setScalar(1 - t * 0.55);
      spark.position.y = 0.7 + t * 0.8;
      fadeObject(g, 1 - t);
    });
  }

  function makeProjectile(colour: number): THREE.Object3D {
    const g = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.34, 2),
      new THREE.MeshBasicMaterial({ color: colour, toneMapped: false })
    );
    g.add(core);

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 12, 8),
      new THREE.MeshBasicMaterial({
        color: colour,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        toneMapped: false,
      })
    );
    g.add(halo);
    group.add(g);
    return g;
  }

  function removeObject(object: THREE.Object3D): void {
    group.remove(object);
    disposeObject(object);
  }

  return {
    group,
    addLine,
    addCircle,
    addCone,
    addBurst,
    makeProjectile,
    removeObject,
    update: (dt) => {
      for (let i = live.length - 1; i >= 0; i--) {
        const fx = live[i];
        fx.age += dt;
        const t = Math.min(1, fx.age / fx.life);
        fx.update(t);
        if (t < 1) continue;
        group.remove(fx.object);
        disposeObject(fx.object);
        live.splice(i, 1);
      }
    },
    dispose: () => {
      for (const fx of live) disposeObject(fx.object);
      live.length = 0;
      while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        disposeObject(child);
      }
    },
  };
}
