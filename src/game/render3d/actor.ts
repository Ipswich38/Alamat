// A body on the field: rigged, textured, animated.
//
// ── WHAT THIS REPLACED, AND WHY ─────────────────────────────────────────────
// One shared adventurer model tinted per hero from an 8x4 palette atlas. It was
// efficient and it was wrong: five palette swaps of one body read as one person
// in five shirts, which is the first thing anyone notices in a game whose
// heroes ARE the product. That whole path is gone, along with the atlas, the
// swatch map and the gear-reveal system that tried to rescue it.
//
// Now every actor is its own generated model. A hero without one is not shown.
//
// ── WHY HEROES AND CREATURES SHARE THIS ─────────────────────────────────────
// They arrive identically: a rigged GLB from the same pipeline, 24 joints, its
// own textures, and a walk cycle in a second file. Nothing about a Kapre needs
// different loading code from an Aswang, and giving them separate paths would
// mean two places to fix the next thing the generator does oddly.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type Motion = 'idle' | 'walk' | 'run';

/** Where an actor's model lives and how big it should stand. */
export interface ActorModel {
  rigged: string;
  /** A second file whose only job is to carry the walk clip for that rig. */
  walk?: string;
  /** Height in world units. A hero is about 1.75; a Kapre is a giant. */
  height: number;
}

export interface Actor {
  object: THREE.Object3D;
  update(dt: number): void;
  play(motion: Motion, fade?: number): void;
  setPosition(x: number, y: number, z: number): void;
  setFacing(radians: number): void;
  dispose(): void;
}

const loader = new GLTFLoader();

export async function createActor(spec: ActorModel): Promise<Actor> {
  const gltf = await loader.loadAsync(spec.rigged);
  const object = gltf.scene;

  object.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    // A skinned mesh is bounded by its bind pose, so three.js culls it the
    // moment an animation moves it out of one. Nothing here is ever off-screen.
    m.frustumCulled = false;
  });

  // Generated models arrive at an arbitrary scale and are not necessarily
  // standing on their own origin. Measured and fitted, so the arena's numbers
  // stay the truth.
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  const unit = spec.height / Math.max(size.y, 0.0001);
  object.scale.setScalar(unit);
  object.position.y = -box.min.y * unit;

  // ⚠ SCALE THE WRAPPER, NOT THE SKINNED OBJECT. Scaling a skinned mesh
  // directly fights its bind pose.
  const rig = new THREE.Group();
  rig.add(object);

  const mixer = new THREE.AnimationMixer(object);
  const clips = [...gltf.animations];
  if (spec.walk) {
    try {
      const walkGltf = await loader.loadAsync(spec.walk);
      // ⚠ THE WALK ARRIVES AS A WHOLE SECOND SKINNED GLB. Only its
      // AnimationClip is used and the duplicate mesh is discarded, which is why
      // the file is loaded and then almost entirely thrown away.
      for (const c of walkGltf.animations) clips.push(Object.assign(c.clone(), { name: 'walk' }));
    } catch {
      /* no walk file: the actor stands still, not worth failing over */
    }
  }

  const idle = clips[0];
  const walk = clips.find((c) => c.name === 'walk') ?? idle;
  const actions = new Map<Motion, THREE.AnimationAction>();
  if (idle) actions.set('idle', mixer.clipAction(idle));
  if (walk) {
    actions.set('walk', mixer.clipAction(walk));
    // No run clip exists yet, so running is the walk played faster. An honest
    // placeholder, and it reads better than a T-pose sliding along the ground.
    const running = mixer.clipAction(walk.clone());
    running.timeScale = 1.55;
    actions.set('run', running);
  }

  let current: Motion | null = null;
  function play(motion: Motion, fade = 0.18): void {
    if (motion === current) return;
    const next = actions.get(motion) ?? actions.get('idle');
    if (!next) return;
    const prev = current ? actions.get(current) : undefined;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (prev && prev !== next) prev.fadeOut(fade);
    current = motion;
  }
  play('idle', 0);

  return {
    object: rig,
    update: (dt) => mixer.update(dt),
    play,
    setPosition: (x, y, z) => rig.position.set(x, y, z),
    setFacing: (radians) => {
      rig.rotation.y = radians;
    },
    dispose: () => mixer.stopAllAction(),
  };
}
