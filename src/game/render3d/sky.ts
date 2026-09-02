// Dynamic Skybox & Time-of-Day System (10-Minute Game Loop + Maw Solar Eclipse).
//
// ── TIME-OF-DAY CYCLE (600s / 10-Minute Period) ──────────────────────────────
// 1. Dawn (0:00 - 2:00, 0-120s): Warm golden-rose sky, low morning mist over river (-1.5u height fog).
// 2. Midday (2:00 - 5:00, 120-300s): High-intensity tropical sunlight (#FFF4E0), crisp shadows, vibrant canopy saturation.
// 3. Dusk (5:00 - 7:00, 300-420s): Deep amber/crimson sunset lighting the Fire Peak Volcano's plume, casting long dramatic shadows.
// 4. Night (7:00 - 10:00, 420-600s): Cool moonlight (#1A2B4C) with heavy bioluminescent emission (#00E5FF / #FFB300).
// 5. Maw Solar Eclipse: Darkens sky instantly into crimson-black void with Blood-Moon ring & drifting fiery ash.

import * as THREE from 'three';

export interface SkyColors {
  zenith: THREE.Color;
  mid: THREE.Color;
  horizon: THREE.Color;
  ground: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
  sunPos: THREE.Vector3;
  ambientColor: THREE.Color;
  ambientGround: THREE.Color;
  ambientIntensity: number;
  rimColor: THREE.Color;
  rimIntensity: number;
  fogColor: THREE.Color;
  fogNear: number;
  fogFar: number;
  /*
   * Drives renderer.toneMappingExposure directly (stage.ts eases toward it every
   * frame), so this OVERRIDES Mood.exposure. Scaled down from the 1.25-1.5 band
   * on 2026-08-29: combined with ACES it was pushing most of the frame past the
   * bloom threshold and washing the arena out. Raise these and the bloom
   * threshold in stage.ts together, never one alone.
   */
  exposure: number;
  gradeStrength: number;
  contrast: number;
  saturation: number;
  vignette: number;
}

export interface SkyResult {
  dome: THREE.Mesh;
  eclipseGroup: THREE.Group;
  celestialGroup: THREE.Group;
  environment: THREE.Texture;
  getLighting(clock: number, isEclipse: boolean): SkyColors;
  update(clock: number, isEclipse: boolean): void;
  dispose(): void;
}

/**
 * 10-Minute Time-of-Day keyframe definitions with Regional Territory Atmospheric Theming.
 */
export function getTodLighting(clock: number, isEclipse: boolean, territoryTheme?: string): SkyColors {
  const PERIOD = 600.0; // 10 minutes
  const t = (clock % PERIOD + PERIOD) % PERIOD;

  // 1. Dawn (0s to 120s)
  // 2. Midday (120s to 300s)
  // 3. Dusk (300s to 420s)
  // 4. Night (420s to 600s)

  const colors: SkyColors = {
    zenith: new THREE.Color(),
    mid: new THREE.Color(),
    horizon: new THREE.Color(),
    ground: new THREE.Color(),
    sunColor: new THREE.Color('#FFF4E0'),
    sunIntensity: 3.2,
    sunPos: new THREE.Vector3(-65, 55, -65),
    ambientColor: new THREE.Color('#87CEEB'),
    ambientGround: new THREE.Color('#4A6B66'),
    ambientIntensity: 1.8,
    rimColor: new THREE.Color('#00E5FF'),
    rimIntensity: 1.8,
    fogColor: new THREE.Color('#B2E0DC'),
    fogNear: 65,
    fogFar: 145,
    exposure: 1.12,
    gradeStrength: 0.20,
    contrast: 1.14,
    saturation: 1.20,
    vignette: 0.22,
  };

  if (isEclipse) {
    // ── BAKUNAWA SOLAR ECLIPSE OVERRIDE ────────────────────────────────────
    colors.zenith.set('#0A0207');
    colors.mid.set('#26050F');
    colors.horizon.set('#590A18');
    colors.ground.set('#140206');
    colors.sunColor.set('#E62020');
    colors.sunIntensity = 1.8;
    colors.sunPos.set(-75, 45, -75);
    colors.ambientColor.set('#5A1828');
    colors.ambientGround.set('#2A0810');
    colors.ambientIntensity = 1.1;
    colors.rimColor.set('#FF204E');
    colors.rimIntensity = 2.6;
    colors.fogColor.set('#2E060F');
    colors.fogNear = 45;
    colors.fogFar = 115;
    colors.exposure = 0.95;
    colors.gradeStrength = 0.35;
    colors.contrast = 1.25;
    colors.saturation = 1.30;
    colors.vignette = 0.38;
    return colors;
  }

  if (t < 120) {
    // ── DAWN (0:00 - 2:00) ──────────────────────────────────────────────────
    const p = t / 120;
    colors.zenith.set('#1E1630').lerp(new THREE.Color('#2C3E60'), p);
    colors.mid.set('#7D4A68').lerp(new THREE.Color('#E56B6F'), p);
    colors.horizon.set('#F39C80').lerp(new THREE.Color('#FFC38B'), p);
    colors.ground.set('#2A2434');
    colors.sunColor.set('#FFA768');
    colors.sunIntensity = 2.4 + p * 0.8;
    colors.sunPos.set(-75 + p * 10, 35 + p * 15, -75 + p * 10);
    colors.ambientColor.set('#87CEEB');
    colors.ambientGround.set('#303848');
    colors.ambientIntensity = 1.4 + p * 0.4;
    colors.rimColor.set('#FF9A76');
    colors.rimIntensity = 1.6;
    colors.fogColor.set('#7A5F70').lerp(new THREE.Color('#9DC8C8'), p);
    colors.fogNear = 55;
    colors.fogFar = 135;
    colors.exposure = 1.02 + p * 0.11;
    colors.gradeStrength = 0.24;
    colors.contrast = 1.14;
    colors.saturation = 1.16;
    colors.vignette = 0.28;
  } else if (t < 300) {
    // ── MIDDAY (2:00 - 5:00) ────────────────────────────────────────────────
    const p = (t - 120) / 180;
    colors.zenith.set('#15528A').lerp(new THREE.Color('#1B74BA'), p);
    colors.mid.set('#4FA3CE').lerp(new THREE.Color('#5DB7CD'), p);
    colors.horizon.set('#FFF2D6').lerp(new THREE.Color('#FFF4E0'), p);
    colors.ground.set('#244A42');
    colors.sunColor.set('#FFF4E0');
    colors.sunIntensity = 3.2;
    colors.sunPos.set(-60, 68, -60);
    colors.ambientColor.set('#87CEEB');
    colors.ambientGround.set('#4A6B66');
    colors.ambientIntensity = 1.8;
    colors.rimColor.set('#00E5FF');
    colors.rimIntensity = 1.8;
    colors.fogColor.set('#B2E0DC');
    colors.fogNear = 70;
    colors.fogFar = 155;
    colors.exposure = 1.12;
    colors.gradeStrength = 0.18;
    colors.contrast = 1.14;
    colors.saturation = 1.20;
    colors.vignette = 0.22;
  } else if (t < 420) {
    // ── DUSK (5:00 - 7:00) ──────────────────────────────────────────────────
    const p = (t - 300) / 120;
    colors.zenith.set('#1D102A').lerp(new THREE.Color('#120B20'), p);
    colors.mid.set('#C0392B').lerp(new THREE.Color('#E67E22'), 1 - p);
    colors.horizon.set('#D35400').lerp(new THREE.Color('#A93226'), p);
    colors.ground.set('#2C1C24');
    colors.sunColor.set('#FF5722');
    colors.sunIntensity = 3.0 - p * 0.8;
    colors.sunPos.set(-82, 28 - p * 12, -82);
    colors.ambientColor.set('#A85A48');
    colors.ambientGround.set('#3D2628');
    colors.ambientIntensity = 1.5 - p * 0.2;
    colors.rimColor.set('#FF7043');
    colors.rimIntensity = 1.8;
    colors.fogColor.set('#6E2B24').lerp(new THREE.Color('#3A1828'), p);
    colors.fogNear = 60;
    colors.fogFar = 135;
    colors.exposure = 1.04;
    colors.gradeStrength = 0.26;
    colors.contrast = 1.20;
    colors.saturation = 1.25;
    colors.vignette = 0.30;
  } else {
    // ── NIGHT (7:00 - 10:00) ────────────────────────────────────────────────
    const p = (t - 420) / 180;
    colors.zenith.set('#081224');
    colors.mid.set('#12243D').lerp(new THREE.Color('#162D4A'), p);
    colors.horizon.set('#20395E').lerp(new THREE.Color('#15424D'), p);
    colors.ground.set('#0E1D2A');
    colors.sunColor.set('#88B2F0'); // Moonlight
    colors.sunIntensity = 1.6;
    colors.sunPos.set(45, 55, 45);
    colors.ambientColor.set('#305278');
    colors.ambientGround.set('#142232');
    colors.ambientIntensity = 1.2;
    colors.rimColor.set('#00E5FF'); // Bioluminescent cyan rim
    colors.rimIntensity = 2.2;
    colors.fogColor.set('#122238');
    colors.fogNear = 50;
    colors.fogFar = 125;
    colors.exposure = 0.97;
    colors.gradeStrength = 0.30;
    colors.contrast = 1.22;
    colors.saturation = 1.18;
    colors.vignette = 0.35;
  }

  // ── REGIONAL TERRITORY ATMOSPHERIC BLEND ──────────────────────────────────
  if (territoryTheme === 'solar_golden' || territoryTheme === 'skyhold') {
    colors.sunColor.lerp(new THREE.Color('#FFE17D'), 0.35);
    colors.rimColor.lerp(new THREE.Color('#FFD700'), 0.45);
    colors.fogColor.lerp(new THREE.Color('#FDE68A'), 0.25);
    colors.exposure = Math.min(1.24, colors.exposure * 1.06);
  } else if (territoryTheme === 'jade_karst_mist' || territoryTheme === 'van_long_uyen') {
    colors.ambientColor.lerp(new THREE.Color('#6EE7B7'), 0.35);
    colors.rimColor.lerp(new THREE.Color('#10B981'), 0.4);
    colors.fogColor.lerp(new THREE.Color('#A7F3D0'), 0.3);
  } else if (territoryTheme === 'volcanic_caldera' || territoryTheme === 'abyss') {
    colors.sunColor.lerp(new THREE.Color('#FF6B6B'), 0.3);
    colors.rimColor.lerp(new THREE.Color('#EF4444'), 0.4);
    colors.fogColor.lerp(new THREE.Color('#7F1D1D'), 0.25);
  } else if (territoryTheme === 'golden_harvest' || territoryTheme === 'warding') {
    colors.sunColor.lerp(new THREE.Color('#FBBF24'), 0.3);
    colors.ambientColor.lerp(new THREE.Color('#FEF08A'), 0.25);
    colors.rimColor.lerp(new THREE.Color('#F59E0B'), 0.35);
  } else if (territoryTheme === 'ancient_rainforest' || territoryTheme === 'gubat_dawn') {
    colors.ambientColor.lerp(new THREE.Color('#34D399'), 0.35);
    colors.rimColor.lerp(new THREE.Color('#00E5FF'), 0.4);
    colors.fogColor.lerp(new THREE.Color('#6EE7B7'), 0.25);
  }

  return colors;
}

export function createSky(renderer: THREE.WebGLRenderer, territoryTheme?: string): SkyResult {
  const geo = new THREE.SphereGeometry(520, 32, 20);

  const uniforms = {
    uZenith: { value: new THREE.Color('#15528A') },
    uMid: { value: new THREE.Color('#4FA3CE') },
    uHorizon: { value: new THREE.Color('#FFF2D6') },
    uGround: { value: new THREE.Color('#112D29') },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    fog: false,
    toneMapped: false,
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uZenith;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      uniform vec3 uGround;
      varying vec3 vWorldPosition;

      void main() {
        float h = normalize(vWorldPosition).y;
        vec3 col;
        if (h < 0.0) {
          col = mix(uGround, uHorizon, clamp((h + 1.0) * 1.5, 0.0, 1.0));
        } else {
          float t1 = clamp(h * 2.5, 0.0, 1.0);
          float t2 = clamp(h * 1.5 - 0.25, 0.0, 1.0);
          vec3 lower = mix(uHorizon, uMid, t1);
          col = mix(lower, uZenith, t2);
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const dome = new THREE.Mesh(geo, mat);
  dome.name = 'dynamic-sky-dome';
  dome.frustumCulled = false;

  // ── Blood-Moon Solar Eclipse Ring (Framing the Fire Peak Volcano) ─────────────────
  const eclipseGroup = new THREE.Group();
  eclipseGroup.name = 'eclipse-sky-phenomena';
  eclipseGroup.position.set(-145, 115, -145);
  eclipseGroup.lookAt(0, 0, 0);

  // 1. Black Moon Core
  const moonCoreGeo = new THREE.CircleGeometry(16, 32);
  const moonCoreMat = new THREE.MeshBasicMaterial({
    color: 0x050103,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
  });
  const moonCore = new THREE.Mesh(moonCoreGeo, moonCoreMat);
  eclipseGroup.add(moonCore);

  // 2. Red Blood-Moon Glowing Corona Ring
  const coronaGeo = new THREE.RingGeometry(15.5, 26, 40);
  const coronaMat = new THREE.MeshBasicMaterial({
    color: 0xff1a35,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
  });
  const corona = new THREE.Mesh(coronaGeo, coronaMat);
  corona.position.z = -0.1;
  eclipseGroup.add(corona);

  // 3. Outer Crimson Flare
  const flareGeo = new THREE.RingGeometry(22, 48, 36);
  const flareMat = new THREE.MeshBasicMaterial({
    color: 0x8a0515,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
  });
  const flare = new THREE.Mesh(flareGeo, flareMat);
  flare.position.z = -0.2;
  eclipseGroup.add(flare);

  // ── Fiery Ash & Ember Storm Particle System ───────────────────────────────
  const ASH_COUNT = 90;
  const ashGeo = new THREE.BufferGeometry();
  const ashPos = new Float32Array(ASH_COUNT * 3);
  const ashColors = new Float32Array(ASH_COUNT * 3);
  const ashData: { x: number; y: number; z: number; speedY: number; driftX: number; driftZ: number; seed: number }[] = [];

  const cEmber = new THREE.Color('#FF4500');
  const cAsh = new THREE.Color('#4A2226');
  const cTemp = new THREE.Color();

  for (let i = 0; i < ASH_COUNT; i++) {
    const x = (Math.sin(i * 12.3) * 0.5) * 160;
    const y = 2 + ((i * 7.1) % 30);
    const z = (Math.cos(i * 17.7) * 0.5) * 160;
    ashPos[i * 3] = x;
    ashPos[i * 3 + 1] = y;
    ashPos[i * 3 + 2] = z;

    cTemp.copy(i % 3 === 0 ? cEmber : cAsh);
    ashColors[i * 3] = cTemp.r;
    ashColors[i * 3 + 1] = cTemp.g;
    ashColors[i * 3 + 2] = cTemp.b;

    ashData.push({
      x,
      y,
      z,
      speedY: 0.8 + (i % 4) * 0.6,
      driftX: 1.2 + (i % 3) * 0.8,
      driftZ: 1.2 + (i % 3) * 0.8,
      seed: i * 1.77,
    });
  }
  ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3));
  ashGeo.setAttribute('color', new THREE.BufferAttribute(ashColors, 3));

  const ashMat = new THREE.PointsMaterial({
    size: 0.65,
    vertexColors: true,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    toneMapped: false,
  });

  const ashParticles = new THREE.Points(ashGeo, ashMat);
  ashParticles.name = 'map-wide-ash-storm';
  ashParticles.renderOrder = 9;

  eclipseGroup.add(ashParticles);

  // ── Dynamic Celestial Bodies (Sun, Moon, Starfield, Clouds) ──────────────
  const celestialGroup = new THREE.Group();
  celestialGroup.name = 'celestial-sky-bodies';

  // 1. Radiant Solar Group (Sun Disc + Solar Corona + Rays)
  const sunGroup = new THREE.Group();
  sunGroup.name = 'celestial-sun';

  const sunDiscGeo = new THREE.CircleGeometry(22, 32);
  const sunDiscMat = new THREE.MeshBasicMaterial({
    color: 0xfffaed,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
  });
  const sunDisc = new THREE.Mesh(sunDiscGeo, sunDiscMat);
  sunGroup.add(sunDisc);

  const sunCoronaGeo = new THREE.RingGeometry(21.5, 42, 32);
  const sunCoronaMat = new THREE.MeshBasicMaterial({
    color: 0xffd27d,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
  });
  const sunCorona = new THREE.Mesh(sunCoronaGeo, sunCoronaMat);
  sunCorona.position.z = -0.1;
  sunGroup.add(sunCorona);

  const sunRaysGeo = new THREE.RingGeometry(38, 76, 24);
  const sunRaysMat = new THREE.MeshBasicMaterial({
    color: 0xffa500,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
  });
  const sunRays = new THREE.Mesh(sunRaysGeo, sunRaysMat);
  sunRays.position.z = -0.2;
  sunGroup.add(sunRays);

  celestialGroup.add(sunGroup);

  // 2. Luminous Lunar Group (Bulan Moon Disc + Silver Halo)
  const moonGroup = new THREE.Group();
  moonGroup.name = 'celestial-moon';

  const moonDiscGeo = new THREE.CircleGeometry(17, 32);
  const moonDiscMat = new THREE.MeshBasicMaterial({
    color: 0xecf8ff,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
  });
  const moonDisc = new THREE.Mesh(moonDiscGeo, moonDiscMat);
  moonGroup.add(moonDisc);

  const moonHaloGeo = new THREE.RingGeometry(16.5, 34, 32);
  const moonHaloMat = new THREE.MeshBasicMaterial({
    color: 0x6ee7b7,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
  });
  const moonHalo = new THREE.Mesh(moonHaloGeo, moonHaloMat);
  moonHalo.position.z = -0.1;
  moonGroup.add(moonHalo);

  celestialGroup.add(moonGroup);

  // 3. Twinkling Starfield Constellations (480 stars)
  const STAR_COUNT = 480;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(STAR_COUNT * 3);
  const starColors = new Float32Array(STAR_COUNT * 3);
  const starSeeds = new Float32Array(STAR_COUNT);

  for (let i = 0; i < STAR_COUNT; i++) {
    // Upper hemisphere distribution
    const u = Math.sin(i * 12.7 + 1.2) * 0.5 + 0.5;
    const v = Math.cos(i * 7.9 + 3.4) * 0.5 + 0.5;
    const theta = u * Math.PI * 2;
    const phi = 0.15 + v * (Math.PI * 0.42); // Avoid near horizon
    const rad = 490;

    starPos[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = rad * Math.cos(phi);
    starPos[i * 3 + 2] = rad * Math.sin(phi) * Math.sin(theta);

    const isCyan = i % 5 === 0;
    const isGold = i % 7 === 0;
    starColors[i * 3] = isGold ? 1.0 : isCyan ? 0.4 : 0.95;
    starColors[i * 3 + 1] = isGold ? 0.85 : isCyan ? 0.9 : 0.98;
    starColors[i * 3 + 2] = isGold ? 0.4 : isCyan ? 1.0 : 1.0;

    starSeeds[i] = i * 2.31;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

  const starMat = new THREE.PointsMaterial({
    size: 1.8,
    vertexColors: true,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    toneMapped: false,
  });
  const starParticles = new THREE.Points(starGeo, starMat);
  starParticles.name = 'celestial-starfield';
  celestialGroup.add(starParticles);

  // 4. Drifting Volumetric Cloud Layers (16 clouds)
  const cloudsGroup = new THREE.Group();
  cloudsGroup.name = 'celestial-clouds';
  const CLOUD_COUNT = 16;
  const cloudPuffsGeo = new THREE.IcosahedronGeometry(28, 1);
  cloudPuffsGeo.scale(2.2, 0.45, 1.2);
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    fog: false,
  });
  const cloudsMesh = new THREE.InstancedMesh(cloudPuffsGeo, cloudMat, CLOUD_COUNT);
  const cloudObj = new THREE.Object3D();

  for (let i = 0; i < CLOUD_COUNT; i++) {
    const a = (i / CLOUD_COUNT) * Math.PI * 2;
    const r = 320 + ((i * 37) % 80);
    const y = 140 + ((i * 19) % 60);
    cloudObj.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    cloudObj.rotation.set(0, a + Math.PI / 2, 0);
    cloudObj.scale.setScalar(0.7 + ((i * 13) % 5) * 0.15);
    cloudObj.updateMatrix();
    cloudsMesh.setMatrixAt(i, cloudObj.matrix);
  }
  cloudsGroup.add(cloudsMesh);
  celestialGroup.add(cloudsGroup);

  // PMREM Environment texture
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const bakeScene = new THREE.Scene();
  bakeScene.add(dome.clone());
  const environment = pmrem.fromScene(bakeScene, 0.04).texture;
  pmrem.dispose();

  let curEclipseLerp = 0.0;

  return {
    dome,
    eclipseGroup,
    celestialGroup,
    environment,
    getLighting: (clock, isEclipse) => getTodLighting(clock, isEclipse, territoryTheme),
    update: (clock, isEclipse) => {
      const targetEclipse = isEclipse ? 1.0 : 0.0;
      curEclipseLerp += (targetEclipse - curEclipseLerp) * 0.08;

      const lighting = getTodLighting(clock, curEclipseLerp > 0.5, territoryTheme);

      uniforms.uZenith.value.lerp(lighting.zenith, 0.1);
      uniforms.uMid.value.lerp(lighting.mid, 0.1);
      uniforms.uHorizon.value.lerp(lighting.horizon, 0.1);
      uniforms.uGround.value.lerp(lighting.ground, 0.1);

      // Day / Night Sun & Moon Solar Orbit (600s period)
      const PERIOD = 600.0;
      const t = (clock % PERIOD + PERIOD) % PERIOD;
      const tod = t / PERIOD;
      const sunAngle = tod * Math.PI * 2 - Math.PI * 0.5; // 0s Dawn = rising, 200s Midday = high, 360s Dusk = setting, 480s Night = low

      // Position Sun
      const sunDist = 440;
      const sunHeight = Math.sin(sunAngle);
      const sunX = Math.cos(sunAngle) * sunDist * 0.8;
      const sunY = sunHeight * 360;
      const sunZ = Math.sin(sunAngle * 0.8) * 220 - 40;
      sunGroup.position.set(sunX, sunY, sunZ);
      sunGroup.lookAt(0, 0, 0);

      const sunVisible = Math.max(0, Math.min(1, (sunHeight + 0.15) * 3));
      sunDiscMat.opacity = sunVisible * (1 - curEclipseLerp);
      sunCoronaMat.opacity = sunVisible * 0.85 * (1 - curEclipseLerp);
      sunRaysMat.opacity = sunVisible * 0.42 * (1 - curEclipseLerp);
      sunCorona.rotation.z = clock * 0.08;
      sunRays.rotation.z = -clock * 0.04;

      // Position Moon (opposite to Sun)
      const moonHeight = -sunHeight;
      const moonX = -sunX;
      const moonY = moonHeight * 360;
      const moonZ = -sunZ;
      moonGroup.position.set(moonX, moonY, moonZ);
      moonGroup.lookAt(0, 0, 0);

      const moonVisible = Math.max(0, Math.min(1, (moonHeight + 0.1) * 3));
      moonDiscMat.opacity = moonVisible * (1 - curEclipseLerp * 0.5);
      moonHaloMat.opacity = moonVisible * 0.65 * (1 - curEclipseLerp * 0.5);
      moonHalo.rotation.z = clock * 0.03;

      // Starfield twinkle and night opacity
      const nightFactor = Math.max(0, Math.min(1, (moonHeight + 0.05) * 2.5));
      starMat.opacity = nightFactor * (0.85 + Math.sin(clock * 1.5) * 0.15) * (1 - curEclipseLerp);

      // Cloud drift
      cloudsGroup.rotation.y = clock * 0.004;
      cloudMat.color.copy(lighting.horizon);
      cloudMat.opacity = 0.18 + sunVisible * 0.15;

      // Fade Blood-Moon Eclipse ring
      coronaMat.opacity = curEclipseLerp * 0.95;
      flareMat.opacity = curEclipseLerp * 0.65;
      moonCoreMat.opacity = curEclipseLerp;
      ashMat.opacity = curEclipseLerp * 0.85;

      // Spin corona rays
      corona.rotation.z = clock * 0.15;
      flare.rotation.z = -clock * 0.08;

      // Update map-wide drifting fiery ash particles
      if (curEclipseLerp > 0.05) {
        const pAttr = ashGeo.attributes.position;
        for (let i = 0; i < ASH_COUNT; i++) {
          const d = ashData[i];
          d.y -= d.speedY * 0.06;
          d.x += Math.sin(clock * 0.8 + d.seed) * 0.15 + d.driftX * 0.04;
          d.z += Math.cos(clock * 0.8 + d.seed) * 0.15 + d.driftZ * 0.04;

          if (d.y < 0) {
            d.y = 28 + (i % 8) * 2;
            d.x = (Math.sin(clock * 0.2 + d.seed) * 0.5) * 140;
            d.z = (Math.cos(clock * 0.2 + d.seed) * 0.5) * 140;
          }

          pAttr.setXYZ(i, d.x, d.y, d.z);
        }
        pAttr.needsUpdate = true;
      }
    },
    dispose: () => {
      geo.dispose();
      mat.dispose();
      coronaGeo.dispose();
      coronaMat.dispose();
      flareGeo.dispose();
      flareMat.dispose();
      moonCoreGeo.dispose();
      moonCoreMat.dispose();
      ashGeo.dispose();
      ashMat.dispose();
      sunDiscGeo.dispose();
      sunDiscMat.dispose();
      sunCoronaGeo.dispose();
      sunCoronaMat.dispose();
      sunRaysGeo.dispose();
      sunRaysMat.dispose();
      moonDiscGeo.dispose();
      moonDiscMat.dispose();
      moonHaloGeo.dispose();
      moonHaloMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      cloudPuffsGeo.dispose();
      cloudMat.dispose();
      environment.dispose();
    },
  };
}

