// The renderer, the camera, the light and the grade.
//
// ── WHY THIS IS STYLISED PBR AND NOT FLAT SHADING ───────────────────────────
// A previous project committed to flat-shaded Lambert and therefore had to
// THROW AWAY the PBR textures that came with its generated assets, because
// photoreal next to flat-shaded looks broken. That was the right call there.
//
// It is the wrong call here, because the target look is soft, rounded and lit
// from every direction. Committing to stylised PBR means a generated asset's
// own textures are an asset rather than a mismatch, and it is what buys the
// weight that flat shading cannot produce at any polygon count.
//
// ── THE FOUR THINGS DOING THE WORK ──────────────────────────────────────────
// 1. ENVIRONMENT LIGHTING. Every material samples the whole sky, not one lamp.
//    See sky.ts. This is most of the difference on its own.
// 2. FILMIC TONE MAPPING. Raw linear output clips bright areas to flat white.
//    ACES rolls highlights off the way film does, so a lit edge stays coloured.
// 3. BLOOM. Only things brighter than the scene bleed, which is what makes
//    sunlit rims and effects read as light rather than as pale paint.
// 4. CONTACT SHADOW. A soft dark patch under every body. Without it, objects
//    float no matter how good the lighting is.
//
// ── AND WHY THERE IS A QUALITY TIER ─────────────────────────────────────────
// This has to run on a cheap Android phone in a browser. Bloom is a second
// full-screen pass and shadow maps are the most expensive thing in the frame,
// so both are switchable, and the switch exists from the first version rather
// than being retrofitted after the first bad review.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createSky } from './sky';

export type Quality = 'high' | 'low';

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  lookAtGround(x: number, z: number): void;
  setViewHeight(units: number): void;
  setQuality(q: Quality): void;
  resize(): void;
  render(): void;
  dispose(): void;
}

/** Where the camera sits relative to what it looks at. */
const OFFSET = new THREE.Vector3(26, 30, 26);

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // ⚠ BOTH OF THESE OR NEITHER. Tone mapping without the correct output colour
  // space gives a washed, milky image, which reads as "the renderer is broken"
  // and is the most common way a three.js scene looks worse than its assets.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // ⚠ ACES EATS MIDTONES. It is the right curve, but it darkens and desaturates
  // everything between black and white, and at exposure 1.0 a scene that looked
  // correct un-graded comes out muddy. The exposure and the light intensities
  // below are set TOGETHER against the tone curve, not independently.
  renderer.toneMappingExposure = 1.45;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  const sky = createSky(renderer);
  scene.add(sky.dome);
  scene.environment = sky.environment;
  // Fog matched to the horizon colour so distance dissolves into the sky
  // instead of ending at a visible edge. This is the whole of "atmosphere".
  // Starts beyond the far wall, so it softens the treeline and NOT the arena.
  scene.fog = new THREE.Fog(0xcfe9ea, 72, 150);

  let viewHeight = 21;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  camera.position.copy(OFFSET);
  camera.lookAt(0, 0, 0);

  // The sun. Warm, and the only shadow caster: a second casting light doubles
  // the most expensive thing in the frame and looks worse, not better.
  const sun = new THREE.DirectionalLight(0xfff1d0, 3.3);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = 26;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.far = 90;
  // Stops the shadow detaching from the feet at a grazing angle, which makes
  // every body look like it is hovering.
  sun.shadow.bias = -0.0009;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  // A dim cool fill from the opposite side. Not a shadow caster: it exists only
  // so the shaded side of a body is blue-grey rather than dead.
  const fill = new THREE.DirectionalLight(0xa8cfe8, 0.75);
  fill.position.set(-16, 10, -14);
  scene.add(fill);

  // ── post ──────────────────────────────────────────────────────────────────
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(1, 1),
    // Strength, radius, threshold. The threshold is the important one: at 0
    // everything glows and the image turns to soup. At 0.85 only genuinely
    // bright things bleed, which is what makes them read as light.
    0.42,
    0.7,
    0.85
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let quality: Quality = 'high';

  function resize(): void {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(w, h);
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
    sun.position.set(x + 18, 30, z + 12);
    sun.target.position.set(x, 0, z);
    sun.target.updateMatrixWorld();
    // The dome travels with the camera, so its far side never clips into view.
    sky.dome.position.set(x, 0, z);
  }

  function setQuality(q: Quality): void {
    quality = q;
    renderer.shadowMap.enabled = q === 'high';
    bloom.enabled = q === 'high';
    renderer.setPixelRatio(q === 'high' ? Math.min(2, window.devicePixelRatio || 1) : 1);
    // Shadow materials are compiled with the map on or off, so every material
    // in the scene has to be told to recompile.
    scene.traverse((n) => {
      const m = n as THREE.Mesh;
      if (m.isMesh && m.material) {
        const list = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of list) mat.needsUpdate = true;
      }
    });
    resize();
  }

  return {
    renderer,
    scene,
    camera,
    lookAtGround,
    setViewHeight: (units) => {
      viewHeight = units;
      resize();
    },
    setQuality,
    resize,
    // Composer when there is something to compose, plain render when there is
    // not: on the low tier the extra full-screen pass would be pure cost.
    render: () => (quality === 'high' ? composer.render() : renderer.render(scene, camera)),
    dispose: () => {
      composer.dispose();
      sky.dispose();
      renderer.dispose();
    },
  };
}

/**
 * The one material recipe. Everything visible goes through here.
 *
 * Standard rather than Lambert, so it takes the environment light from sky.ts.
 * `roughness` is the dial that matters: 1 is chalk, 0 is a mirror, and stylised
 * work lives around 0.7 where a surface has a soft sheen without looking wet.
 */
export function surfaceMaterial(
  colour: number | string,
  opts: { roughness?: number; metalness?: number } = {}
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: colour,
    roughness: opts.roughness ?? 0.78,
    metalness: opts.metalness ?? 0.03,
  });
}

/** Kept so existing callers compile. Everything is Standard now. */
export const flatMaterial = surfaceMaterial;
