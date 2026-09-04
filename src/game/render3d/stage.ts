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
import { SAOPass } from 'three/examples/jsm/postprocessing/SAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createSky, getTodLighting } from './sky';
import { createGradePass } from './grade';

export type Quality = 'performance' | 'balanced' | 'ultra' | 'high' | 'low';

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

// Premium Polish Pack — tuned for hero readability + bloom punch
// Ambient particles + volumetric fog tuned here. Do not raise bloom strength without threshold.
export const DEFAULT_MOOD: Mood = {
  // HQ: neutral exposure so bloom doesn't wash out the Nexus in screenshot;
  // ACESFilmic handles highlights, stage now owns physically correct lights.
  exposure: 1.18,
  fogNear: 62,
  fogFar: 210,
  vignette: 0.12,
  saturation: 1.08,
  contrast: 1.06,
  gradeStrength: 0.18,
  sun: 2.6,
  rim: 1.6,
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

export const ZOOM_MIN = 14;
export const ZOOM_MAX = 90;

/*
 * Is this a phone or tablet?
 *
 * Deliberately a few lines here rather than an import. The repo already had
 * THREE separate device/quality systems (platform/mobile.ts, performanceOptimizer,
 * alamatGraphicsEnhancement) and not one of them was wired to this renderer, so
 * quality sat pinned at 'high' on every device. Adding a fourth abstraction was
 * not the fix; asking the question where the answer is used is.
 */
function isHandheld(): boolean {
  if (typeof navigator === 'undefined') return false;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const ua = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  return coarse || ua;
}

export function createStage(canvas: HTMLCanvasElement, territoryTheme?: string): Stage {
  const handheld = isHandheld();

  const renderer = new THREE.WebGLRenderer({
    canvas,
    // MSAA is pointless once everything goes through EffectComposer, and on a
    // phone the multisampled buffer is pure cost. Desktop keeps it.
    antialias: !handheld,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true,
  });
  /*
   * 2.2 on a DPR-3 phone is 4.8x the fragments of DPR 1, before five post
   * passes run over the same pixels. Desktop keeps the sharp setting.
   */
  renderer.setPixelRatio(Math.min(handheld ? 1.5 : 2.2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  (renderer as unknown as { physicallyCorrectLights?: boolean }).physicallyCorrectLights = true;
  renderer.sortObjects = true;

  const scene = new THREE.Scene();

  const sky = createSky(renderer, territoryTheme);
  scene.add(sky.dome);
  scene.add(sky.eclipseGroup);
  scene.add(sky.celestialGroup);
  scene.environment = sky.environment;
  
  const weather = createAtmosphereWeather(territoryTheme);
  scene.add(weather.group);
  
  const fog = new THREE.Fog(0xbfe4e0, 65, 145);
  scene.fog = fog;

  let viewHeight = 22;
  let yaw = DEFAULT_YAW;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 900);
  camera.position.set(
    Math.sin(yaw) * ORBIT_RADIUS,
    ORBIT_HEIGHT,
    Math.cos(yaw) * ORBIT_RADIUS
  );
  camera.lookAt(0, 0, 0);

  // ── Directional Key Light — HQ: tighter frustum, stable shadows
  const sun = new THREE.DirectionalLight(0xfff6e8, 2.6);
  sun.position.set(-58, 62, -58);
  sun.castShadow = true;
  // 2k is still a lot of depth rendering for 177 shadow casters on a phone.
  sun.shadow.mapSize.set(handheld ? 1024 : 2048, handheld ? 1024 : 2048);
  const s = 32;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 150;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.015;
  scene.add(sun);
  scene.add(sun.target);

  // ── Ambient / Sky Light — softer, less wash
  const ambientSky = new THREE.HemisphereLight(0x87ceeb, 0x4a6b66, 1.25);
  scene.add(ambientSky);

  // ── Rim Light — subtle separation, not lantern
  const rim = new THREE.DirectionalLight(0x00e5ff, 1.35);
  rim.position.set(35, 22, 35);
  scene.add(rim);
  scene.add(rim.target);

  // ── Fill Light — HQ: lifts dark crevices without bloom
  const fill = new THREE.DirectionalLight(0xffe8c8, 0.55);
  fill.position.set(-18, 20, 28);
  scene.add(fill);
  scene.add(fill.target);

  // ── Post-processing Pipeline ──────────────────────────────────────────────
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  /*
   * strength 0.45, radius 0.60, threshold 0.86.
   *
   * Was 1.1 / 0.85 / 0.80, which is about double the usual working range for
   * UnrealBloom and smeared the whole scene rather than picking out the things
   * that should glow. The higher threshold means only genuinely bright pixels
   * (ability effects, lanterns, the talisman stream) bloom at all; the tighter
   * radius keeps the glow near its source instead of hazing the terrain.
   *
   * If this ever needs to go back up, raise the threshold with it. Strength and
   * threshold move together or the frame washes out again.
   */
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(1, 1),
    0.28,
    0.55,
    0.90
  );
  composer.addPass(bloom);
  /*
   * SSAO deepens crevices, and costs a second pass over the whole scene to do
   * it: SAO renders depth and normals for all 177 shadow casters again, then
   * blurs. On a phone that is the most expensive pass in the frame for the
   * least visible gain at this camera distance, so handhelds skip it entirely.
   * Desktop keeps the look unchanged.
   */
  if (!handheld) try {
    const sao = new SAOPass(scene, camera);
    // @ts-ignore — SAO params vary by three version
    sao.params = sao.params || {};
    if ((sao as any).params) {
      (sao as any).params.saoIntensity = 0.065;
      (sao as any).params.saoScale = 28;
      (sao as any).params.saoKernelRadius = 0.85;
    }
    composer.addPass(sao as any);
  } catch {}
  composer.addPass(new OutputPass());
  const grade = createGradePass({
    shadowTint: new THREE.Color('#334A54'),
    highlightTint: new THREE.Color('#FFF8E8'),
    strength: 0.14,
    vignette: 0.14,
    contrast: 1.06,
    saturation: 1.05,
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

    // Follow player with lights and sky dome — HQ: lights follow tightly
    sun.position.set(x - 58, 62, z - 58);
    sun.target.position.set(x, 0, z);
    sun.target.updateMatrixWorld();

    rim.position.set(x + 35, 22, z + 35);
    rim.target.position.set(x, 0, z);
    rim.target.updateMatrixWorld();

    fill.position.set(x - 18, 20, z + 28);
    fill.target.position.set(x, 0, z);
    fill.target.updateMatrixWorld();

    sky.dome.position.set(x, 0, z);
  }

  function setQuality(q: Quality): void {
    quality = q;
    const isUltra = q === 'ultra' || q === 'high';
    const isBalanced = q === 'balanced';
    const isPerf = q === 'performance' || q === 'low';

    // HQ: keep shadows + bloom even on balanced; only low/perf drops them
    renderer.shadowMap.enabled = !isPerf;
    bloom.enabled = !isPerf;
    grade.enabled = !isPerf;

    const maxDpr = isUltra ? 2.2 : isBalanced ? 1.8 : 1.2;
    renderer.setPixelRatio(Math.min(maxDpr, window.devicePixelRatio || 1));

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

  let lastGroundX = 0;
  let lastGroundZ = 0;

  function update(dt: number, clock: number, isEclipse: boolean): void {
    updateCameraShake(dt, clock);
    sky.update(clock, isEclipse);
    weather.update(dt, clock, lastGroundX, lastGroundZ, isEclipse);

    // Smooth dynamic lighting transitions
    const tod = getTodLighting(clock, isEclipse, territoryTheme);
    sun.position.lerp(tod.sunPos, 0.05);
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
    lookAtGround: (x, z) => {
      lastGroundX = x;
      lastGroundZ = z;
      lookAtGround(x, z);
    },
    setViewHeight: (units) => {
      viewHeight = units;
      resize();
    },
    setQuality,
    addCameraShake,
    update,
    resize,
    render: () => (quality === 'performance' || quality === 'low' ? renderer.render(scene, camera) : composer.render()),
    dispose: () => {
      composer.dispose();
      weather.dispose();
      sky.dispose();
      renderer.dispose();
    },
  };
}

/**
 * Dynamic Atmospheric Particle System:
 * - Mayon / Volcanic Hearth: Floating ember sparks & ash flakes
 * - Pasig River / Monsoon: Drifting tropical rain streaks & mist
 * - Kapre Grove: Luminous bio-green fireflies
 * - Eclipse / Night: Cosmic starlight dust
 */
function createAtmosphereWeather(territoryTheme?: string): {
  group: THREE.Group;
  update: (dt: number, clock: number, targetX: number, targetZ: number, isEclipse: boolean) => void;
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = 'atmospheric-weather-vfx';

  const isVolcano = territoryTheme === 'mayon' || territoryTheme === 'volcano';
  const isRiver = territoryTheme === 'pasig' || territoryTheme === 'river';

  // 1. Ash / Ember / Starlight Particles (240 count)
  const PARTICLE_COUNT = 240;
  const partGeo = new THREE.BufferGeometry();
  const partPos = new Float32Array(PARTICLE_COUNT * 3);
  const partData: { x: number; y: number; z: number; speedY: number; driftX: number; phase: number }[] = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const rx = (Math.random() - 0.5) * 70;
    const ry = 0.5 + Math.random() * 22;
    const rz = (Math.random() - 0.5) * 70;
    partPos[i * 3] = rx;
    partPos[i * 3 + 1] = ry;
    partPos[i * 3 + 2] = rz;

    partData.push({
      x: rx,
      y: ry,
      z: rz,
      speedY: isRiver ? 28.0 + Math.random() * 12 : isVolcano ? 1.4 + Math.random() * 2.2 : 0.8 + Math.random() * 1.5,
      driftX: (Math.random() - 0.5) * 2.5,
      phase: Math.random() * Math.PI * 2,
    });
  }
  partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));

  const partColor = isVolcano ? 0xff7722 : isRiver ? 0x93c5fd : 0x86efac;
  const partMat = new THREE.PointsMaterial({
    color: partColor,
    size: isRiver ? 0.75 : 0.85,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    toneMapped: false,
  });
  const particles = new THREE.Points(partGeo, partMat);
  group.add(particles);

  // 2. Bioluminescent Forest Fireflies (60 count)
  const FIREFLY_COUNT = 60;
  const flyGeo = new THREE.BufferGeometry();
  const flyPos = new Float32Array(FIREFLY_COUNT * 3);
  const flyData: { angle: number; radius: number; speed: number; y: number; baseY: number }[] = [];

  for (let i = 0; i < FIREFLY_COUNT; i++) {
    const a = (i / FIREFLY_COUNT) * Math.PI * 2;
    const r = 8 + Math.random() * 32;
    const by = 0.8 + Math.random() * 4.5;
    flyPos[i * 3] = Math.cos(a) * r;
    flyPos[i * 3 + 1] = by;
    flyPos[i * 3 + 2] = Math.sin(a) * r;
    flyData.push({
      angle: a,
      radius: r,
      speed: 0.2 + (i % 5) * 0.08,
      y: by,
      baseY: by,
    });
  }
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));

  const flyMat = new THREE.PointsMaterial({
    color: 0xfde047,
    size: 1.1,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    toneMapped: false,
  });
  const fireflies = new THREE.Points(flyGeo, flyMat);
  group.add(fireflies);

  return {
    group,
    update: (dt, clock, targetX, targetZ, isEclipse) => {
      group.position.set(targetX, 0, targetZ);

      // Animate weather particles
      const pAttr = partGeo.attributes.position;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const d = partData[i];
        d.y -= d.speedY * dt;
        if (d.y < 0.2) {
          d.y = 22.0 + Math.random() * 4;
          d.x = (Math.random() - 0.5) * 70;
          d.z = (Math.random() - 0.5) * 70;
        }
        const curX = d.x + Math.sin(clock * 1.5 + d.phase) * (isRiver ? 0.3 : 1.2);
        const curZ = d.z + Math.cos(clock * 1.2 + d.phase) * (isRiver ? 0.3 : 1.2);
        pAttr.setXYZ(i, curX, d.y, curZ);
      }
      pAttr.needsUpdate = true;

      // Animate fireflies
      const fAttr = flyGeo.attributes.position;
      for (let i = 0; i < FIREFLY_COUNT; i++) {
        const fd = flyData[i];
        fd.angle += fd.speed * dt;
        const fy = fd.baseY + Math.sin(clock * 2.2 + i * 1.3) * 0.6;
        fAttr.setXYZ(i, Math.cos(fd.angle) * fd.radius, fy, Math.sin(fd.angle) * fd.radius);
      }
      fAttr.needsUpdate = true;

      flyMat.opacity = (0.5 + Math.sin(clock * 3.0) * 0.35) * (isEclipse ? 1.2 : 0.85);
    },
    dispose: () => {
      partGeo.dispose();
      partMat.dispose();
      flyGeo.dispose();
      flyMat.dispose();
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
  const m = new THREE.MeshStandardMaterial({
    color: colour,
    roughness: opts.roughness ?? 0.72,
    metalness: opts.metalness ?? 0.02,
  });
  // HQ: enable anisotropy where available, keep textures crisp at angle
  return m;
}

export const flatMaterial = surfaceMaterial;

