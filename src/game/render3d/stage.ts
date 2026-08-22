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
import { createGradePass } from './grade';

export type Quality = 'high' | 'low';

/** The dials that decide the look. Live, so they can be tuned by eye. */
export interface Mood {
  exposure: number;
  fogNear: number;
  fogFar: number;
  vignette: number;
  saturation: number;
  contrast: number;
  gradeStrength: number;
  sun: number;
  rim: number;
}

export const DEFAULT_MOOD: Mood = {
  exposure: 1.25,
  fogNear: 62,
  fogFar: 130,
  vignette: 0.34,
  saturation: 1.12,
  contrast: 1.14,
  gradeStrength: 0.22,
  sun: 3.2,
  rim: 1.8,
};

export interface Stage {
  setMood(m: Mood): void;
  /** Turn the camera about the point it is looking at. Radians. */
  setYaw(radians: number): void;
  /** The current yaw. Movement input has to be rotated by this. */
  yaw(): number;
  /** Current view height, so a zoom control can nudge it. */
  viewHeight(): number;
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

/**
 * The camera's orbit, as a height and a radius rather than a fixed offset.
 *
 * ⚠ IT USED TO BE A FIXED VECTOR, and that quietly forbade rotation: the yaw
 * was baked into the numbers 26 and 26. Splitting it means the camera can turn
 * without anything else in the scene needing to know, and the DEFAULT yaw of a
 * quarter turn reproduces the old (26, 30, 26) exactly.
 */
const ORBIT_RADIUS = Math.SQRT2 * 26;
const ORBIT_HEIGHT = 30;
const DEFAULT_YAW = Math.PI / 4;

/**
 * How far in and out the camera may go.
 *
 * The near limit is where a hero fills a useful part of the frame; the far is
 * where you can see a whole quadrant of the map. Beyond that the world is
 * unreadable in one direction and pointless in the other.
 */
export const ZOOM_MIN = 16;
export const ZOOM_MAX = 90;

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // ⚠ BOTH OF THESE OR NEITHER. Tone mapping without the correct output colour
  // space gives a washed, milky image, which reads as "the renderer is broken"
  // and is the most common way a three.js scene looks worse than its assets.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // ⚠ ACES EATS MIDTONES. It is the right curve, but it darkens and desaturates
  // everything between black and white, and at exposure 1.0 a scene that looked
  // correct un-graded comes out muddy. The exposure and the light intensities
  // below are set TOGETHER against the tone curve, not independently.
  // ⚠ THE REFERENCE LOOK IS DARK WITH BRIGHT ACCENTS, not evenly lit. Two
  // earlier passes missed by pushing exposure up until the scene was readable
  // everywhere, which produces a flat, uniformly saturated picture. Most of the
  // frame should sit in the lower half of the range so the santelmo, the rim
  // light and the key have somewhere to be bright against.
  renderer.toneMappingExposure = 1.25;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  const sky = createSky(renderer);
  scene.add(sky.dome);
  scene.environment = sky.environment;
  // Fog matched to the horizon colour so distance dissolves into the sky
  // instead of ending at a visible edge. This is the whole of "atmosphere".
  // ⚠ THE FOG IS THE ART DIRECTION, not a distance cull. Pulled in close and
  // coloured, it is what makes the treeline dissolve into atmosphere and gives
  // the picture depth. A far, pale fog only trims the horizon and changes
  // nothing about how the scene reads.
  // ⚠ LINEAR, AND IT STARTS PAST THE ARENA. Exponential fog drowned the whole
  // picture, and the reason is the camera: an orthographic view sitting 47
  // units back means the ground the player is standing on is ALREADY at depth
  // 47, so a density tuned for "distance" fogged the foreground just as hard.
  // Linear fog with a near plane beyond the far wall keeps the fight clear and
  // dissolves only the treeline, which is where atmosphere belongs.
  scene.fog = new THREE.Fog(0xbfe4e0, 62, 130);

  let viewHeight = 21;
  let yaw = DEFAULT_YAW;
  // ⚠ FAR PLANE REACHES THE BACKDROP. At 400 the horizon volcano sat just
  // beyond it and was clipped away entirely, with no error and no warning.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 900);
  camera.position.set(
    Math.sin(yaw) * ORBIT_RADIUS,
    ORBIT_HEIGHT,
    Math.cos(yaw) * ORBIT_RADIUS
  );
  camera.lookAt(0, 0, 0);

  // The sun. Warm, and the only shadow caster: a second casting light doubles
  // the most expensive thing in the frame and looks worse, not better.
  // Low and warm, cutting across the arena rather than shining down it. A key
  // light straight overhead flattens every form it touches.
  // Golden rather than neutral. A warm key against the cool sky is what makes
  // the two read as sunlight and shade rather than as two lamps.
  // Primary Directional Light (Sun): Warm Amber/Golden-Hour (#F39C12), intensity 1.8
  const sun = new THREE.DirectionalLight(0xf39c12, 1.8);
  sun.position.set(-65, 55, -65);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = 26;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);

  // Ambient / Sky Light: Deep Emerald Teal (#112D29) at 0.6 intensity
  // Creates high-contrast, moody deep-green shadows under tree canopies.
  const ambientSky = new THREE.HemisphereLight(0x112d29, 0x0a1c19, 0.6);
  scene.add(ambientSky);

  // Rim light: Bioluminescent rim separation
  const rim = new THREE.DirectionalLight(0x00e5ff, 1.35);
  rim.position.set(35, 22, 35);
  scene.add(rim);
  scene.add(rim.target);

  // ── post ──────────────────────────────────────────────────────────────────
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(1, 1),
    // Threshold 0.8 | Intensity 1.2 | Diffusion 0.85 (softly blooms bioluminescent cyan and gold)
    1.2,
    0.85,
    0.80
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = createGradePass({
    shadowTint: new THREE.Color('#0A221C'),
    highlightTint: new THREE.Color('#FFE0B0'),
    strength: 0.35,
    vignette: 0.45,
    contrast: 1.28,
    saturation: 1.22,
  });
  composer.addPass(grade);

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
    camera.position.set(
      x + Math.sin(yaw) * ORBIT_RADIUS,
      ORBIT_HEIGHT,
      z + Math.cos(yaw) * ORBIT_RADIUS
    );
    camera.lookAt(x, 0, z);
    // ⚠ THE LIGHTS DO NOT ORBIT. Positioned behind and above the NW Mayon peak
    // at a 45-degree angle to cast dramatic backlighting and long cinematic shadows
    // toward the center of the arena.
    sun.position.set(x - 65, 55, z - 65);
    sun.target.position.set(x, 0, z);
    sun.target.updateMatrixWorld();
    // Rim light from the opposite side (SE) to separate characters from background
    rim.position.set(x + 35, 22, z + 35);
    rim.target.position.set(x, 0, z);
    rim.target.updateMatrixWorld();
    sky.dome.position.set(x, 0, z);
  }

  function setQuality(q: Quality): void {
    quality = q;
    renderer.shadowMap.enabled = q === 'high';
    bloom.enabled = q === 'high';
    grade.enabled = q === 'high';
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

  function setMood(m: Mood): void {
    renderer.toneMappingExposure = m.exposure;
    (scene.fog as THREE.Fog).near = m.fogNear;
    (scene.fog as THREE.Fog).far = m.fogFar;
    sun.intensity = m.sun;
    rim.intensity = m.rim;
    grade.uniforms.uVignette.value = m.vignette;
    grade.uniforms.uSaturation.value = m.saturation;
    grade.uniforms.uContrast.value = m.contrast;
    grade.uniforms.uStrength.value = m.gradeStrength;
  }

  return {
    setMood,
    setYaw: (r) => {
      yaw = r;
    },
    yaw: () => yaw,
    viewHeight: () => viewHeight,
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
