// Dynamic Skybox & Time-of-Day System (10-Minute Game Loop + Bakunawa Solar Eclipse).
//
// ── TIME-OF-DAY CYCLE (600s / 10-Minute Period) ──────────────────────────────
// 1. Dawn (0:00 - 2:00, 0-120s): Warm golden-rose sky, low morning mist over river (-1.5u height fog).
// 2. Midday (2:00 - 5:00, 120-300s): High-intensity tropical sunlight (#FFF4E0), crisp shadows, vibrant canopy saturation.
// 3. Dusk (5:00 - 7:00, 300-420s): Deep amber/crimson sunset lighting Mayon Volcano's plume, casting long dramatic shadows.
// 4. Night (7:00 - 10:00, 420-600s): Cool moonlight (#1A2B4C) with heavy bioluminescent emission (#00E5FF / #FFB300).
// 5. Bakunawa Solar Eclipse: Darkens sky instantly into crimson-black void with Blood-Moon ring & drifting fiery ash.

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
  exposure: number;
  gradeStrength: number;
  contrast: number;
  saturation: number;
  vignette: number;
}

export interface SkyResult {
  dome: THREE.Mesh;
  eclipseGroup: THREE.Group;
  environment: THREE.Texture;
  getLighting(clock: number, isEclipse: boolean): SkyColors;
  update(clock: number, isEclipse: boolean): void;
  dispose(): void;
}

/**
 * 10-Minute Time-of-Day keyframe definitions.
 */
export function getTodLighting(clock: number, isEclipse: boolean): SkyColors {
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
    sunColor: new THREE.Color(),
    sunIntensity: 2.2,
    sunPos: new THREE.Vector3(-65, 55, -65),
    ambientColor: new THREE.Color(),
    ambientGround: new THREE.Color(),
    ambientIntensity: 0.6,
    rimColor: new THREE.Color(),
    rimIntensity: 1.4,
    fogColor: new THREE.Color(),
    fogNear: 55,
    fogFar: 130,
    exposure: 1.25,
    gradeStrength: 0.28,
    contrast: 1.22,
    saturation: 1.18,
    vignette: 0.38,
  };

  if (isEclipse) {
    // ── BAKUNAWA SOLAR ECLIPSE OVERRIDE ────────────────────────────────────
    colors.zenith.set('#0A0207');
    colors.mid.set('#26050F');
    colors.horizon.set('#590A18');
    colors.ground.set('#140206');
    colors.sunColor.set('#B31010');
    colors.sunIntensity = 0.95;
    colors.sunPos.set(-75, 45, -75);
    colors.ambientColor.set('#24060C');
    colors.ambientGround.set('#100205');
    colors.ambientIntensity = 0.45;
    colors.rimColor.set('#FF204E');
    colors.rimIntensity = 2.4;
    colors.fogColor.set('#2E060F');
    colors.fogNear = 35;
    colors.fogFar = 98;
    colors.exposure = 1.15;
    colors.gradeStrength = 0.48;
    colors.contrast = 1.42;
    colors.saturation = 1.35;
    colors.vignette = 0.55;
    return colors;
  }

  if (t < 120) {
    // ── DAWN (0:00 - 2:00) ──────────────────────────────────────────────────
    const p = t / 120;
    // Golden-rose morning sky
    colors.zenith.set('#1E1630').lerp(new THREE.Color('#2C3E60'), p);
    colors.mid.set('#7D4A68').lerp(new THREE.Color('#E56B6F'), p);
    colors.horizon.set('#F39C80').lerp(new THREE.Color('#FFC38B'), p);
    colors.ground.set('#1A1424');
    colors.sunColor.set('#FFA768');
    colors.sunIntensity = 1.6 + p * 0.5;
    colors.sunPos.set(-75 + p * 10, 35 + p * 15, -75 + p * 10);
    colors.ambientColor.set('#2A2035');
    colors.ambientGround.set('#121620');
    colors.ambientIntensity = 0.52;
    colors.rimColor.set('#FF9A76');
    colors.rimIntensity = 1.3;
    colors.fogColor.set('#7A5F70').lerp(new THREE.Color('#9DC8C8'), p);
    // Low morning mist over river (-1.5u height fog effect)
    colors.fogNear = 45;
    colors.fogFar = 115;
    colors.exposure = 1.18;
    colors.gradeStrength = 0.32;
    colors.contrast = 1.16;
    colors.saturation = 1.12;
    colors.vignette = 0.42;
  } else if (t < 300) {
    // ── MIDDAY (2:00 - 5:00) ────────────────────────────────────────────────
    const p = (t - 120) / 180;
    // High-intensity tropical sunlight (#FFF4E0), crisp shadows, vibrant green canopy
    colors.zenith.set('#15528A').lerp(new THREE.Color('#1B74BA'), p);
    colors.mid.set('#4FA3CE').lerp(new THREE.Color('#5DB7CD'), p);
    colors.horizon.set('#FFF2D6').lerp(new THREE.Color('#F7E3B5'), p);
    colors.ground.set('#112D29');
    colors.sunColor.set('#FFF4E0');
    colors.sunIntensity = 2.6 + Math.sin(p * Math.PI) * 0.4;
    colors.sunPos.set(-60, 68, -60);
    colors.ambientColor.set('#1C3D36');
    colors.ambientGround.set('#0E1D19');
    colors.ambientIntensity = 0.68;
    colors.rimColor.set('#00E5FF');
    colors.rimIntensity = 1.45;
    colors.fogColor.set('#B2E0DC');
    colors.fogNear = 68;
    colors.fogFar = 145;
    colors.exposure = 1.32;
    colors.gradeStrength = 0.22;
    colors.contrast = 1.25;
    colors.saturation = 1.28;
    colors.vignette = 0.32;
  } else if (t < 420) {
    // ── DUSK (5:00 - 7:00) ──────────────────────────────────────────────────
    const p = (t - 300) / 120;
    // Deep amber/crimson sunset lighting up Mayon Volcano's plume
    colors.zenith.set('#1D102A').lerp(new THREE.Color('#120B20'), p);
    colors.mid.set('#C0392B').lerp(new THREE.Color('#E67E22'), 1 - p);
    colors.horizon.set('#D35400').lerp(new THREE.Color('#A93226'), p);
    colors.ground.set('#1C1014');
    colors.sunColor.set('#FF4500');
    colors.sunIntensity = 2.2 - p * 0.7;
    colors.sunPos.set(-82, 28 - p * 12, -82); // Long dramatic low-angle shadows
    colors.ambientColor.set('#361C18');
    colors.ambientGround.set('#180E10');
    colors.ambientIntensity = 0.55;
    colors.rimColor.set('#FF5722');
    colors.rimIntensity = 1.75;
    colors.fogColor.set('#6E2B24').lerp(new THREE.Color('#3A1828'), p);
    colors.fogNear = 52;
    colors.fogFar = 122;
    colors.exposure = 1.22;
    colors.gradeStrength = 0.38;
    colors.contrast = 1.34;
    colors.saturation = 1.32;
    colors.vignette = 0.46;
  } else {
    // ── NIGHT (7:00 - 10:00) ────────────────────────────────────────────────
    const p = (t - 420) / 180;
    // Cool moonlight (#1A2B4C) with heavy bioluminescent plant emission
    colors.zenith.set('#040812');
    colors.mid.set('#0B182B').lerp(new THREE.Color('#10223A'), p);
    colors.horizon.set('#1A2B4C').lerp(new THREE.Color('#0D323A'), p);
    colors.ground.set('#05101A');
    colors.sunColor.set('#6B95D6'); // Moonlight
    colors.sunIntensity = 0.95;
    colors.sunPos.set(45, 55, 45); // Moon from opposite side
    colors.ambientColor.set('#0C1C2E');
    colors.ambientGround.set('#040A12');
    colors.ambientIntensity = 0.42;
    colors.rimColor.set('#00E5FF'); // Intense bioluminescent cyan rim
    colors.rimIntensity = 1.95;
    colors.fogColor.set('#0A1422');
    colors.fogNear = 42;
    colors.fogFar = 108;
    colors.exposure = 1.14;
    colors.gradeStrength = 0.42;
    colors.contrast = 1.36;
    colors.saturation = 1.15;
    colors.vignette = 0.52;
  }

  return colors;
}

export function createSky(renderer: THREE.WebGLRenderer): SkyResult {
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

  // ── Blood-Moon Solar Eclipse Ring (Framing Mayon Volcano) ─────────────────
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
    environment,
    getLighting: (clock, isEclipse) => getTodLighting(clock, isEclipse),
    update: (clock, isEclipse) => {
      const targetEclipse = isEclipse ? 1.0 : 0.0;
      curEclipseLerp += (targetEclipse - curEclipseLerp) * 0.08;

      const lighting = getTodLighting(clock, curEclipseLerp > 0.5);

      uniforms.uZenith.value.lerp(lighting.zenith, 0.1);
      uniforms.uMid.value.lerp(lighting.mid, 0.1);
      uniforms.uHorizon.value.lerp(lighting.horizon, 0.1);
      uniforms.uGround.value.lerp(lighting.ground, 0.1);

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
      environment.dispose();
    },
  };
}

