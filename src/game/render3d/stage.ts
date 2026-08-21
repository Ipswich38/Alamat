// The renderer, the camera and the light.
//
// ── THE LOOK, AND WHY IT IS DECIDED HERE ────────────────────────────────────
// Flat-shaded Lambert, low-poly, saturated. Every material in this game is made
// the same way and the reason is hard-won: a previous project generated 3D
// assets that arrived photoreal and they had to be switched off, because a
// photoreal building beside flat-shaded ground looks broken. The fix was never
// the model, it was the MATERIAL. Replacing every imported material with a
// flat-shaded Lambert that keeps only the base-colour map puts anything, from
// anywhere, into the same world.
//
// ── WHY THE CAMERA IS ORTHOGRAPHIC ──────────────────────────────────────────
// Aimed abilities need a readable ground plane. Perspective foreshortening
// makes a skillshot at the top of the screen cover a different amount of ground
// than the same shot at the bottom, and players cannot learn a range they
// cannot see consistently. Orthographic keeps one world unit the same number of
// pixels everywhere, which is what makes aiming learnable.

import * as THREE from 'three';

const SKY = 0x8fd3d8;

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  /** Point the camera at a spot on the ground, keeping its angle. */
  lookAtGround(x: number, z: number): void;
  /** How many world units tall the view is. Smaller is closer in. */
  setViewHeight(units: number): void;
  resize(): void;
  render(): void;
  dispose(): void;
}

/** Where the camera sits relative to what it is looking at. */
const OFFSET = new THREE.Vector3(28, 34, 28);

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  // Capped at 2: beyond that a phone renders four times the pixels for a
  // difference nobody can see, and the frame rate is what players feel.
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 60, 110);

  let viewHeight = 34;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.position.copy(OFFSET);
  camera.lookAt(0, 0, 0);

  // Warm key from the same side the camera is, so faces the player can see are
  // the faces that are lit.
  const key = new THREE.DirectionalLight(0xfff2d8, 2.1);
  key.position.set(20, 34, 14);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const s = 30;
  key.shadow.camera.left = -s;
  key.shadow.camera.right = s;
  key.shadow.camera.top = s;
  key.shadow.camera.bottom = -s;
  key.shadow.camera.far = 90;
  // Without this the shadow detaches from the feet at a grazing angle and every
  // body looks like it is hovering.
  key.shadow.bias = -0.0012;
  scene.add(key);

  // Cool fill from below the horizon, so shadowed sides read as blue-grey
  // rather than as black holes.
  scene.add(new THREE.HemisphereLight(0xbfe4ff, 0x4a6b4a, 1.15));

  function resize(): void {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const halfH = viewHeight / 2;
    const halfW = halfH * aspect;
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
  }

  function lookAtGround(x: number, z: number): void {
    camera.position.set(x + OFFSET.x, OFFSET.y, z + OFFSET.z);
    camera.lookAt(x, 0, z);
    key.position.set(x + 20, 34, z + 14);
    key.target.position.set(x, 0, z);
    key.target.updateMatrixWorld();
  }
  scene.add(key.target);

  return {
    renderer,
    scene,
    camera,
    lookAtGround,
    setViewHeight: (units) => {
      viewHeight = units;
      resize();
    },
    resize,
    render: () => renderer.render(scene, camera),
    dispose: () => renderer.dispose(),
  };
}

/**
 * The one material recipe. Everything visible in this game goes through here.
 *
 * See the note at the top of the file: this is what lets a downloaded or
 * generated model sit in the same world as hand-built geometry.
 */
export function flatMaterial(colour: number | string): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: colour, flatShading: true });
}
