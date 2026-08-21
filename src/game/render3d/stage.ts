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
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  camera.position.copy(OFFSET);
  camera.lookAt(0, 0, 0);

  // The sun. Warm, and the only shadow caster: a second casting light doubles
  // the most expensive thing in the frame and looks worse, not better.
  // Low and warm, cutting across the arena rather than shining down it. A key
  // light straight overhead flattens every form it touches.
  const sun = new THREE.DirectionalLight(0xfff0d4, 3.2);
  sun.position.set(24, 20, 10);
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

  // ⚠ THE RIM IS WHY CHARACTERS POP, and it was missing for three passes of
  // look-tuning because an edit silently failed to match. It comes from BEHIND
  // and opposite the key, so it catches the far edge of every body and
  // separates it from whatever it is standing in front of. Every reference this
  // game is aiming at does this. Without it a character sinks into the
  // background however well it is modelled, and no amount of exposure or
  // saturation fixes that, because the problem is that nothing separates them.
  const rim = new THREE.DirectionalLight(0xbfe9ff, 1.8);
  rim.position.set(-20, 13, -18);
  scene.add(rim);
  scene.add(rim.target);

  // A dim fill so the shaded side is not dead black.
  const fill = new THREE.DirectionalLight(0x9fd0e0, 0.85);
  fill.position.set(-6, 6, 16);
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
  // ⚠ AFTER OutputPass. The grade works on the tone-mapped, display-referred
  // image; running it earlier fights the tone curve and muddies the corners.
  const grade = createGradePass({
    shadowTint: new THREE.Color(0x9fd8e8),
    highlightTint: new THREE.Color(0xffe0b0),
    strength: 0.22,
    vignette: 0.62,
    contrast: 1.18,
    saturation: 1.12,
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
    camera.position.set(x + OFFSET.x, OFFSET.y, z + OFFSET.z);
    camera.lookAt(x, 0, z);
    sun.position.set(x + 24, 20, z + 10);
    sun.target.position.set(x, 0, z);
    sun.target.updateMatrixWorld();
    // The dome travels with the camera, so its far side never clips into view.
    rim.position.set(x - 20, 13, z - 18);
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
