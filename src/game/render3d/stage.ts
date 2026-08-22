// The renderer, the camera, the light, dynamic Time-of-Day, camera-shake, and the grade.
//
// ── WHY THIS IS STYLISED PBR AND NOT FLAT SHADING ───────────────────────────
// Committing to stylised PBR means a generated asset's own textures are an asset
// rather than a mismatch, and it buys the weight flat shading cannot produce.
//
// ── THE DYNAMIC LIGHTING & TIME-OF-DAY ENGINE ─────────────────────────────────
// 1. Dynamic 10-Minute Day/Night/Eclipse skybox and directional sun/moon illumination.
// 2. Cascaded/tuned shadow maps with PCF soft filtering for top-down isometric perspectives.
// 3. Camera-shake engine with trauma-squared decay for heavy primal monster impacts.
// 4. Filmic tone mapping and Unreal bloom for bioluminescent accents.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createSky, getTodLighting } from './sky';
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
  /** Add trauma for camera shake (0 to 1). Decays smoothly. */
  addCameraShake(trauma: number): void;
  /** Update dynamic skybox, lighting, and camera shake */
  update(dt: number, clock: number, isEclipse: boolean): void;
  resize(): void;
  render(): void;
  dispose(): void;
}

const ORBIT_RADIUS = Math.SQRT2 * 26;
const ORBIT_HEIGHT = 30;
const DEFAULT_YAW = Math.PI / 4;

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
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  const sky = createSky(renderer);
  scene.add(sky.dome);
  scene.add(sky.eclipseGroup);
  scene.environment = sky.environment;
  
  const fog = new THREE.Fog(0xbfe4e0, 62, 130);
  scene.fog = fog;

  let viewHeight = 21;
  let yaw = DEFAULT_YAW;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 900);
  camera.position.set(
    Math.sin(yaw) * ORBIT_RADIUS,
    ORBIT_HEIGHT,
    Math.cos(yaw) * ORBIT_RADIUS
  );
  camera.lookAt(0, 0, 0);

  // ── Directional Key Light (Sun / Moon) ──────────────────────────────────
  const sun = new THREE.DirectionalLight(0xf39c12, 2.2);
  sun.position.set(-65, 55, -65);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = 32;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 190;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);

  // Ambient / Sky Light
  const ambientSky = new THREE.HemisphereLight(0x112d29, 0x0a1c19, 0.65);
  scene.add(ambientSky);

  // Rim Light (Bioluminescent / Moon Separation)
  const rim = new THREE.DirectionalLight(0x00e5ff, 1.45);
  rim.position.set(35, 22, 35);
  scene.add(rim);
  scene.add(rim.target);

  // ── Post-processing Pipeline ──────────────────────────────────────────────
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(1, 1),
    1.2,
    0.85,
    0.80
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = createGradePass({
    shadowTint: new THREE.Color('#0A221C'),
    highlightTint: new THREE.Color('#FFE0B0'),
    strength: 0.28,
    vignette: 0.38,
    contrast: 1.24,
    saturation: 1.20,
  });
  composer.addPass(grade);

  let quality: Quality = 'high';

  // ── Camera Shake Engine ───────────────────────────────────────────────────
  let shakeTrauma = 0.0;
  let shakeX = 0.0;
  let shakeY = 0.0;
  let shakeZ = 0.0;

  function addCameraShake(trauma: number): void {
    shakeTrauma = Math.min(1.0, shakeTrauma + trauma);
  }

  function updateCameraShake(dt: number, clock: number): void {
    if (shakeTrauma > 0.001) {
      shakeTrauma = Math.max(0, shakeTrauma - dt * 1.8);
      const intensity = shakeTrauma * shakeTrauma;
      const maxOffset = 1.4;
      shakeX = (Math.sin(clock * 48.0) * 0.7 + Math.cos(clock * 31.0) * 0.3) * maxOffset * intensity;
      shakeY = (Math.cos(clock * 54.0) * 0.6 + Math.sin(clock * 37.0) * 0.4) * maxOffset * intensity * 0.6;
      shakeZ = (Math.sin(clock * 42.0) * 0.6 + Math.cos(clock * 29.0) * 0.4) * maxOffset * intensity;
    } else {
      shakeX = 0;
      shakeY = 0;
      shakeZ = 0;
    }
  }

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
      x + Math.sin(yaw) * ORBIT_RADIUS + shakeX,
      ORBIT_HEIGHT + shakeY,
      z + Math.cos(yaw) * ORBIT_RADIUS + shakeZ
    );
    camera.lookAt(x + shakeX * 0.5, shakeY * 0.5, z + shakeZ * 0.5);

    // Follow player with lights and sky dome
    sun.position.set(x - 65, 55, z - 65);
    sun.target.position.set(x, 0, z);
    sun.target.updateMatrixWorld();

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
    fog.near = m.fogNear;
    fog.far = m.fogFar;
    sun.intensity = m.sun;
    rim.intensity = m.rim;
    grade.uniforms.uVignette.value = m.vignette;
    grade.uniforms.uSaturation.value = m.saturation;
    grade.uniforms.uContrast.value = m.contrast;
    grade.uniforms.uStrength.value = m.gradeStrength;
  }

  function update(dt: number, clock: number, isEclipse: boolean): void {
    updateCameraShake(dt, clock);
    sky.update(clock, isEclipse);

    // Smooth dynamic lighting transitions
    const tod = getTodLighting(clock, isEclipse);
    sun.color.lerp(tod.sunColor, 0.05);
    sun.intensity += (tod.sunIntensity - sun.intensity) * 0.05;

    ambientSky.color.lerp(tod.ambientColor, 0.05);
    ambientSky.groundColor.lerp(tod.ambientGround, 0.05);
    ambientSky.intensity += (tod.ambientIntensity - ambientSky.intensity) * 0.05;

    rim.color.lerp(tod.rimColor, 0.05);
    rim.intensity += (tod.rimIntensity - rim.intensity) * 0.05;

    fog.color.lerp(tod.fogColor, 0.05);
    fog.near += (tod.fogNear - fog.near) * 0.05;
    fog.far += (tod.fogFar - fog.far) * 0.05;

    renderer.toneMappingExposure += (tod.exposure - renderer.toneMappingExposure) * 0.05;
    grade.uniforms.uVignette.value += (tod.vignette - grade.uniforms.uVignette.value) * 0.05;
    grade.uniforms.uSaturation.value += (tod.saturation - grade.uniforms.uSaturation.value) * 0.05;
    grade.uniforms.uContrast.value += (tod.contrast - grade.uniforms.uContrast.value) * 0.05;
    grade.uniforms.uStrength.value += (tod.gradeStrength - grade.uniforms.uStrength.value) * 0.05;
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
    addCameraShake,
    update,
    resize,
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

export const flatMaterial = surfaceMaterial;

