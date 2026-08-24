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
  addEnergyOrb(fromX: number, fromY: number, fromZ: number, toX: number, toY: number, toZ: number, colour: number, life?: number): void;
  addCastRune(x: number, z: number, radius: number, colour: number, life: number): void;
  addSlashArc(x: number, z: number, heading: number, radius: number, colour: number, life?: number): void;
  addBlessingBurst(x: number, z: number, colour: number): void;
  addStepRipple(x: number, z: number, isWater?: boolean): void;
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

  function addEnergyOrb(
    fromX: number,
    fromY: number,
    fromZ: number,
    toX: number,
    toY: number,
    toZ: number,
    colour: number,
    life = 0.28
  ): void {
    const g = new THREE.Group();
    const orbMat = new THREE.MeshBasicMaterial({ color: colour, toneMapped: false });
    const haloMat = new THREE.MeshBasicMaterial({
      color: colour,
      transparent: true,
      opacity: 0.35,
      toneMapped: false,
    });

    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 2), orbMat);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.78, 12, 8), haloMat);
    g.add(core, halo);

    // Initial position at spirit mask mouth height
    g.position.set(fromX, fromY, fromZ);

    track(g, life, (t) => {
      // Direct ballistic trajectory towards target
      g.position.x = fromX + (toX - fromX) * t;
      g.position.y = fromY + (toY - fromY) * t;
      g.position.z = fromZ + (toZ - fromZ) * t;
      g.scale.setScalar(0.8 + Math.sin(t * Math.PI) * 0.45);
      if (t >= 0.95) {
        fadeObject(g, (1 - t) * 20);
      }
    });
  }

  function addCastRune(x: number, z: number, radius: number, colour: number, life: number): void {
    const g = new THREE.Group();
    g.position.set(x, combatGroundY(x, z) + 0.02, z);

    // Outer Baybayin/Runic Ring
    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.88, radius, 36),
      new THREE.MeshBasicMaterial({
        color: colour,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      })
    );
    outerRing.rotation.x = -Math.PI / 2;

    // Inner 8-ray Sunburst / Agimat Star
    const star = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.45, radius * 0.55, 8),
      new THREE.MeshBasicMaterial({
        color: colour,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      })
    );
    star.rotation.x = -Math.PI / 2;

    // Glowing core disc
    const core = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.35, 16),
      new THREE.MeshBasicMaterial({
        color: colour,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        toneMapped: false,
      })
    );
    core.rotation.x = -Math.PI / 2;

    g.add(outerRing, star, core);
    g.renderOrder = 8;

    track(g, life, (t) => {
      outerRing.rotation.z = t * Math.PI * 2;
      star.rotation.z = -t * Math.PI * 1.5;
      const pulse = 1.0 + Math.sin(t * Math.PI * 6) * 0.08;
      g.scale.setScalar(pulse);
      fadeObject(g, Math.max(0, 1 - t * 0.5));
    });
  }

  function addSlashArc(x: number, z: number, heading: number, radius: number, colour: number, life = 0.22): void {
    const g = new THREE.Group();
    g.position.set(x, combatGroundY(x, z) + 0.35, z);
    g.rotation.y = heading;

    // Crescent Arc Slash
    const arcGeo = new THREE.TorusGeometry(radius, 0.12, 6, 20, Math.PI * 0.65);
    const arcMat = new THREE.MeshBasicMaterial({
      color: colour,
      transparent: true,
      opacity: 0.85,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const arc = new THREE.Mesh(arcGeo, arcMat);
    arc.rotation.set(Math.PI / 2, 0, -Math.PI * 0.32);
    g.add(arc);

    track(g, life, (t) => {
      arc.scale.setScalar(0.7 + t * 0.6);
      fadeObject(g, 1 - t);
    });
  }

  function addBlessingBurst(x: number, z: number, colour: number): void {
    const g = new THREE.Group();
    g.position.set(x, combatGroundY(x, z), z);

    // Upward spiraling pillar beam
    const pillarGeo = new THREE.CylinderGeometry(0.8, 1.4, 6.0, 16, 1, true);
    const pillarMat = new THREE.MeshBasicMaterial({
      color: colour,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.y = 3.0;
    g.add(pillar);

    // Ground Rune Halo
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 2.2, 32),
      new THREE.MeshBasicMaterial({
        color: colour,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.05;
    g.add(halo);

    track(g, 0.65, (t) => {
      pillar.scale.set(1 - t * 0.3, 1 + t * 0.5, 1 - t * 0.3);
      pillar.position.y = 3.0 + t * 2.0;
      halo.scale.setScalar(1 + t * 1.5);
      fadeObject(g, 1 - t);
    });
  }

  function addStepRipple(x: number, z: number, isWater = false): void {
    const g = new THREE.Group();
    g.position.set(x, combatGroundY(x, z) + 0.02, z);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.38, 16),
      new THREE.MeshBasicMaterial({
        color: isWater ? 0x88e2ff : 0xa89078,
        transparent: true,
        opacity: isWater ? 0.65 : 0.35,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);

    track(g, 0.35, (t) => {
      ring.scale.setScalar(1 + t * 2.0);
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
    addEnergyOrb,
    addCastRune,
    addSlashArc,
    addBlessingBurst,
    addStepRipple,
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
