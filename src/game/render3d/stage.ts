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
  /*
   * 1.40 for better color visibility - adjusted to make the game less dark
   * while still maintaining good visual quality. The original 1.10 was too dark
   * for color appreciation. ACES tone mapping handles the highlights well.
   */
  exposure: 1.40,
  fogNear: 85,
  fogFar: 185,
  vignette: 0.08, // Reduced from 0.22 to avoid dark corners
  saturation: 1.20, // Increased for more vibrant colors
  contrast: 1.02, // Reduced from 1.14 to avoid deep shadows
  gradeStrength: 0.15, // Reduced for more natural colors
  sun: 3.8, // Brighter sunlight
  rim: 2.0,
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

export function createStage(canvas: HTMLCanvasElement, territoryTheme?: string): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // HYPER-REAL: was PCFShadowMap, softer penumbra
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

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

  // ── Directional Key Light (Warm Bright Sun / Moon) ──────────────────────
  const sun = new THREE.DirectionalLight(0xfff4e0, 3.2);
  sun.position.set(-65, 55, -65);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096); // HYPER-REAL: was 2048, hyper shadow detail
  const s = 36;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 190;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  // ── Ambient / Sky Light (Daylight Sky Blue Fill #87CEEB) ─────────────────
  const ambientSky = new THREE.HemisphereLight(0x87ceeb, 0x4a6b66, 1.8);
  scene.add(ambientSky);

  // ── Rim Light (Bioluminescent / Moon Separation) ─────────────────────────
  const rim = new THREE.DirectionalLight(0x00e5ff, 1.8);
  rim.position.set(35, 22, 35);
  scene.add(rim);
  scene.add(rim.target);

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
    0.45,
    0.60,
    0.86
  );
  composer.addPass(bloom);
  // LANDSCAPE DETAIL PATCH: SSAO for cobble crevices (subtle)
  try {
    const sao = new SAOPass(scene, camera);
    // @ts-ignore — SAO params vary by three version
    sao.params = sao.params || {};
    // keep subtle so MOBA readability stays
    if ((sao as any).params) {
      (sao as any).params.saoIntensity = 0.04;
      (sao as any).params.saoScale = 12;
    }
    composer.addPass(sao as any);
  } catch {}
  composer.addPass(new OutputPass());
  const grade = createGradePass({
    shadowTint: new THREE.Color('#35505C'),
    highlightTint: new THREE.Color('#FFF4E0'),
    strength: 0.20,
    vignette: 0.22,
    contrast: 1.14,
    saturation: 1.08, // HYPER-REAL: was 1.20, more natural
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
    const isUltra = q === 'ultra' || q === 'high';
    const isBalanced = q === 'balanced';
    const isPerf = q === 'performance' || q === 'low';

    renderer.shadowMap.enabled = !isPerf;
    bloom.enabled = isUltra;
    grade.enabled = isUltra || isBalanced;

    const maxDpr = isUltra ? 2.0 : isBalanced ? 1.5 : 1.0;
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
  return new THREE.MeshStandardMaterial({
    color: colour,
    roughness: opts.roughness ?? 0.78,
    metalness: opts.metalness ?? 0.03,
  });
}

export const flatMaterial = surfaceMaterial;

