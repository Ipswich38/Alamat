// Philippine-inspired Dragon Creatures for ALamat MOBA
//
// Features:
// - Bakunawa (Moon Eater) - Giant sea serpent/dragon for jungle boss
// - Naga (Serpent Dragon) - Guardians of sacred places
// - Tikbalang Dragon - Forest guardian with horse-like features
// - Sarimanok-inspired Dragon - Colorful peacock-inspired mythical bird-dragon hybrid
//
// All dragons have:
// - Highly detailed geometry with scales and textures
// - Animated wings, tails, and special effects
// - Dynamic lighting and shadow casting
// - Combat animations and VFX

import * as THREE from 'three';
import { surfaceMaterial } from './stage';
import { terrainHeight } from './terrain';

// Dragon scale colors based on Philippine mythology
export const DRAGON_COLORS = {
  bakunawa: {
    primary: 0x1a1a2e,      // Deep navy blue (moon eater)
    secondary: 0x16213e,    // Darker blue
    scales: 0x0f3460,      // Midnight blue scales
    eyes: 0xff0000,        // Red glowing eyes
    effects: 0x4cc9f0,     // Electric blue effects
    aura: 0x4895ef,       // Light blue aura
  },
  naga: {
    primary: 0x2f8f4f,      // Forest green
    secondary: 0x1a4d2e,    // Deep forest green
    scales: 0x3d6b38,      // Emerald scales
    eyes: 0x00ff00,        // Green glowing eyes
    effects: 0x00ff88,     // Green energy effects
    aura: 0x00cc6a,       // Lime green aura
  },
  tikbalang: {
    primary: 0x4a3525,      // Brown (horse-like)
    secondary: 0x2d1b14,    // Dark brown
    scales: 0x8b4513,      // Saddle brown scales
    eyes: 0xffa500,        // Orange glowing eyes
    effects: 0xff4500,     // Orange fire effects
    aura: 0xff6347,       // Tomato red aura
  },
  sarimanok: {
    primary: 0xff6b6b,      // Peacock red
    secondary: 0x4ecdc4,    // Turquoise
    scales: 0x96ceb4,      // Pale turquoise scales
    eyes: 0xffd700,        // Gold eyes
    effects: 0xff69b4,     // Hot pink effects
    aura: 0xffeaa7,       // Pale gold aura
  },
};

/** 
 * Create detailed dragon scales geometry
 * Uses procedural generation to create realistic scale patterns
 */
function createDragonScales(
  baseRadius: number, 
  length: number, 
  segments: number = 16,
  scaleDensity: number = 0.15
): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(
    baseRadius, 
    baseRadius * 0.6, 
    length, 
    segments, 
    segments * 2,
    true
  );
  
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  
  // Add scale displacement and detail
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    
    // Calculate radial position for scale pattern
    const radius = Math.sqrt(x * x + z * z);
    const angle = Math.atan2(z, x);
    const heightRatio = y / (length / 2);
    
    // Create scale bumps - alternating pattern
    const scaleX = Math.floor(angle / (Math.PI * 2) * segments) / segments;
    const scaleY = Math.floor((y + length/2) / (length * scaleDensity)) / (1 / scaleDensity);
    
    const scalePattern = Math.sin(scaleX * Math.PI * 10) * Math.cos(scaleY * Math.PI * 5);
    const bumpHeight = (0.05 + Math.abs(scalePattern) * 0.15) * (1 - Math.abs(heightRatio));
    
    // Apply bump to position
    const nx = normal.getX(i);
    const nz = normal.getZ(i);
    const radialFactor = 1 - Math.pow(1 - (radius / baseRadius), 2);
    
    position.setX(i, x + nx * bumpHeight * radialFactor);
    position.setZ(i, z + nz * bumpHeight * radialFactor);
  }
  
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  
  return geometry;
}

/**
 * Create dragon wing geometry with detailed membrane
 */
function createDragonWing(
  wingSpan: number = 8,
  wingWidth: number = 3,
  segments: number = 12
): { geometry: THREE.BufferGeometry, bonePositions: THREE.Vector3[] } {
  const geometry = new THREE.PlaneGeometry(wingSpan, wingWidth, segments, segments);
  
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  
  const bonePositions: THREE.Vector3[] = [];
  
  // Create wing curvature and membrane detail
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    
    const u = uv.getX(i);
    const v = uv.getY(i);
    
    // Wing curvature - more pronounced at the tips
    const curvature = (1 - u) * (1 - u) * 2;
    const wingCurve = Math.sin(v * Math.PI) * curvature * 1.5;
    
    // Add wing membrane waves
    const membraneWave = Math.sin(u * Math.PI * 4) * Math.cos(v * Math.PI * 2) * 0.1;
    
    position.setY(i, y + wingCurve + membraneWave);
    
    // Store bone positions for animation
    if (i % (segments + 1) === 0) {
      bonePositions.push(new THREE.Vector3(x, y + wingCurve, z));
    }
  }
  
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  
  return { geometry, bonePositions };
}

/**
 * Create dragon head with detailed features
 */
function createDragonHead(
  size: number = 1.5,
  dragonType: keyof typeof DRAGON_COLORS = 'bakunawa'
): THREE.Group {
  const group = new THREE.Group();
  const colors = DRAGON_COLORS[dragonType];
  
  // Main head
  const headGeo = new THREE.BoxGeometry(size * 1.2, size * 0.8, size * 1);
  const headMat = surfaceMaterial(colors.primary, { roughness: 0.7, metalness: 0.1 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);
  
  // Jaw
  const jawGeo = new THREE.BoxGeometry(size * 1.1, size * 0.4, size * 0.7);
  const jawMat = surfaceMaterial(colors.secondary, { roughness: 0.8, metalness: 0.05 });
  const jaw = new THREE.Mesh(jawGeo, jawMat);
  jaw.position.set(0, -size * 0.2, size * 0.4);
  jaw.castShadow = true;
  group.add(jaw);
  
  // Horns
  const hornGeo = new THREE.ConeGeometry(size * 0.15, size * 0.6, 6);
  const hornMat = surfaceMaterial(colors.scales, { roughness: 0.4, metalness: 0.2 });
  
  const leftHorn = new THREE.Mesh(hornGeo, hornMat);
  leftHorn.position.set(-size * 0.3, size * 0.4, 0);
  leftHorn.rotation.set(0.3, 0, -0.2);
  leftHorn.castShadow = true;
  group.add(leftHorn);
  
  const rightHorn = new THREE.Mesh(hornGeo, hornMat);
  rightHorn.position.set(size * 0.3, size * 0.4, 0);
  rightHorn.rotation.set(0.3, 0, 0.2);
  rightHorn.castShadow = true;
  group.add(rightHorn);
  
  // Eyes
  const eyeGeo = new THREE.SphereGeometry(size * 0.12, 8, 8);
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: colors.eyes,
    emissiveIntensity: 0.8,
    roughness: 0.1,
    metalness: 0.3,
  });
  
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-size * 0.2, size * 0.1, size * 0.3);
  group.add(leftEye);
  
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(size * 0.2, size * 0.1, size * 0.3);
  group.add(rightEye);
  
  // Pupils
  const pupilGeo = new THREE.SphereGeometry(size * 0.06, 6, 6);
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  
  const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
  leftPupil.position.set(-size * 0.2, size * 0.1, size * 0.35);
  group.add(leftPupil);
  
  const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
  rightPupil.position.set(size * 0.2, size * 0.1, size * 0.35);
  group.add(rightPupil);
  
  // Crest (for Bakunawa and Sarimanok)
  if (dragonType === 'bakunawa' || dragonType === 'sarimanok') {
    const crestGeo = new THREE.BoxGeometry(size * 0.15, size * 0.4, size * 0.8);
    const crestMat = surfaceMaterial(colors.effects, { roughness: 0.6, metalness: 0.2 });
    const crest = new THREE.Mesh(crestGeo, crestMat);
    crest.position.set(0, size * 0.5, 0);
    crest.castShadow = true;
    group.add(crest);
    
    // Crest spikes
    for (let i = 0; i < 5; i++) {
      const spikeGeo = new THREE.ConeGeometry(size * 0.08, size * 0.3, 4);
      const spike = new THREE.Mesh(spikeGeo, crestMat);
      spike.position.set(
        (i - 2) * size * 0.15, 
        size * 0.6, 
        0
      );
      spike.rotation.set(0.4, 0, 0);
      spike.castShadow = true;
      group.add(spike);
    }
  }
  
  // Nostrils with smoke/breath effects
  const nostrilGeo = new THREE.CylinderGeometry(size * 0.04, size * 0.06, size * 0.2, 6);
  const nostrilMat = surfaceMaterial(0x000000, { roughness: 1 });
  
  const leftNostril = new THREE.Mesh(nostrilGeo, nostrilMat);
  leftNostril.position.set(-size * 0.1, -size * 0.1, size * 0.5);
  leftNostril.rotation.set(0, 0, Math.PI / 4);
  group.add(leftNostril);
  
  const rightNostril = new THREE.Mesh(nostrilGeo, nostrilMat);
  rightNostril.position.set(size * 0.1, -size * 0.1, size * 0.5);
  rightNostril.rotation.set(0, 0, -Math.PI / 4);
  group.add(rightNostril);
  
  return group;
}

/**
 * Create dragon tail with segmented, flexible design
 */
function createDragonTail(
  length: number = 6,
  baseRadius: number = 0.4,
  segments: number = 10,
  dragonType: keyof typeof DRAGON_COLORS = 'bakunawa'
): THREE.Group {
  const group = new THREE.Group();
  const colors = DRAGON_COLORS[dragonType];
  
  const tailMat = surfaceMaterial(colors.secondary, { roughness: 0.8, metalness: 0.05 });
  
  // Create segmented tail
  for (let i = 0; i < segments; i++) {
    const segmentLength = length / segments;
    const segmentRadius = baseRadius * (1 - i / segments * 0.5);
    
    const segmentGeo = createDragonScales(segmentRadius, segmentLength, 8, 0.2);
    const segment = new THREE.Mesh(segmentGeo, tailMat);
    
    segment.position.set(0, 0, -i * segmentLength);
    segment.rotation.set(
      Math.sin(i * 0.3) * 0.2, 
      Math.cos(i * 0.5) * 0.3,
      0
    );
    
    segment.castShadow = true;
    segment.receiveShadow = true;
    group.add(segment);
  }
  
  // Tail spike
  const spikeGeo = new THREE.ConeGeometry(baseRadius * 0.8, baseRadius * 2, 6);
  const spikeMat = surfaceMaterial(colors.scales, { roughness: 0.4, metalness: 0.2 });
  const spike = new THREE.Mesh(spikeGeo, spikeMat);
  spike.position.set(0, 0, -length - baseRadius);
  spike.rotation.set(Math.PI / 2, 0, 0);
  spike.castShadow = true;
  group.add(spike);
  
  return group;
}

/**
 * Create dragon legs with claws
 */
function createDragonLeg(
  size: number = 1,
  dragonType: keyof typeof DRAGON_COLORS = 'bakunawa'
): THREE.Group {
  const group = new THREE.Group();
  const colors = DRAGON_COLORS[dragonType];
  
  // Upper leg
  const upperLegGeo = new THREE.CylinderGeometry(size * 0.2, size * 0.25, size * 0.8, 6);
  const upperLegMat = surfaceMaterial(colors.primary, { roughness: 0.7, metalness: 0.1 });
  const upperLeg = new THREE.Mesh(upperLegGeo, upperLegMat);
  upperLeg.position.y = size * 0.4;
  upperLeg.rotation.set(0.3, 0, 0);
  upperLeg.castShadow = true;
  group.add(upperLeg);
  
  // Lower leg
  const lowerLegGeo = new THREE.CylinderGeometry(size * 0.18, size * 0.15, size * 0.7, 6);
  const lowerLegMat = surfaceMaterial(colors.secondary, { roughness: 0.8, metalness: 0.05 });
  const lowerLeg = new THREE.Mesh(lowerLegGeo, lowerLegMat);
  lowerLeg.position.y = -size * 0.1;
  lowerLeg.castShadow = true;
  group.add(lowerLeg);
  
  // Foot and claws
  const footGeo = new THREE.BoxGeometry(size * 0.3, size * 0.15, size * 0.25);
  const footMat = surfaceMaterial(colors.scales, { roughness: 0.9, metalness: 0.05 });
  const foot = new THREE.Mesh(footGeo, footMat);
  foot.position.y = -size * 0.45;
  foot.castShadow = true;
  group.add(foot);
  
  // Claws
  for (let i = 0; i < 3; i++) {
    const clawGeo = new THREE.ConeGeometry(size * 0.03, size * 0.2, 4);
    const clawMat = surfaceMaterial(0xffffff, { roughness: 0.3, metalness: 0.3 });
    const claw = new THREE.Mesh(clawGeo, clawMat);
    claw.position.set(
      (i - 1) * size * 0.1,
      -size * 0.55,
      size * 0.15
    );
    claw.rotation.set(0.8, 0, 0);
    claw.castShadow = true;
    group.add(claw);
  }
  
  return group;
}

/**
 * Dragon creature types
 */
export type DragonType = keyof typeof DRAGON_COLORS;

export interface Dragon {
  group: THREE.Group;
  head: THREE.Group;
  body: THREE.Mesh;
  wings: { left: THREE.Mesh; right: THREE.Mesh };
  tail: THREE.Group;
  legs: THREE.Group[];
  update: (dt: number, clock: number, target?: { x: number; z: number }) => void;
  setAnimation: (animation: DragonAnimation) => void;
  dispose: () => void;
}

export type DragonAnimation = 'idle' | 'walk' | 'fly' | 'attack' | 'roar' | 'breath' | 'death';

export interface DragonConfig {
  type: DragonType;
  size: number;
  position: { x: number; y: number; z: number };
  isBoss?: boolean;
  name?: string;
}

/**
 * Create a complete dragon creature
 */
export function createDragon(config: DragonConfig): Dragon {
  const { type, size, position, isBoss = false, name = 'Dragon' } = config;
  const colors = DRAGON_COLORS[type];
  
  const group = new THREE.Group();
  group.name = name.toLowerCase().replace(/\s/g, '-') + '-dragon';
  group.position.set(position.x, position.y, position.z);
  
  // Body
  const bodyGeo = createDragonScales(size * 1.2, size * 2.5, 16, 0.1);
  const bodyMat = surfaceMaterial(colors.primary, { roughness: 0.7, metalness: 0.1 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = size * 0.8;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  
  // Head
  const head = createDragonHead(size * (isBoss ? 1.5 : 1), type);
  head.position.set(0, size * 1.2, size * 1.3);
  head.rotation.set(-0.2, 0, 0);
  group.add(head);
  
  // Wings
  const wingSize = size * (isBoss ? 2.5 : 1.8);
  const { geometry: leftWingGeo } = createDragonWing(wingSize, wingSize * 0.4);
  const leftWingMat = new THREE.MeshStandardMaterial({
    color: colors.effects,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    roughness: 0.9,
    metalness: 0.1,
  });
  const leftWing = new THREE.Mesh(leftWingGeo, leftWingMat);
  leftWing.position.set(-size * 0.6, size * 1.1, size * 0.8);
  leftWing.rotation.set(0, 0, Math.PI / 2);
  leftWing.castShadow = true;
  group.add(leftWing);
  
  const { geometry: rightWingGeo } = createDragonWing(wingSize, wingSize * 0.4);
  const rightWingMat = new THREE.MeshStandardMaterial({
    color: colors.effects,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    roughness: 0.9,
    metalness: 0.1,
  });
  const rightWing = new THREE.Mesh(rightWingGeo, rightWingMat);
  rightWing.position.set(size * 0.6, size * 1.1, size * 0.8);
  rightWing.rotation.set(0, 0, -Math.PI / 2);
  rightWing.castShadow = true;
  group.add(rightWing);
  
  // Tail
  const tail = createDragonTail(size * (isBoss ? 3 : 2), size * 0.5, 8, type);
  tail.position.set(0, size * 0.3, -size * 2.2);
  tail.rotation.set(0.2, 0, 0);
  group.add(tail);
  
  // Legs
  const legs: THREE.Group[] = [];
  const legPositions = [
    { x: -size * 0.5, z: size * 0.3 },
    { x: size * 0.5, z: size * 0.3 },
    { x: -size * 0.4, z: -size * 0.5 },
    { x: size * 0.4, z: -size * 0.5 },
  ];
  
  for (const pos of legPositions) {
    const leg = createDragonLeg(size * (isBoss ? 1.2 : 0.8), type);
    leg.position.set(pos.x, -size * 0.3, pos.z);
    leg.castShadow = true;
    group.add(leg);
    legs.push(leg);
  }
  
  // Animation state
  let currentAnimation: DragonAnimation = 'idle';
  let animationTime = 0;
  let animationSpeed = 1;
  
  // Wing animation
  let wingFlapTime = 0;
  let wingFlapSpeed = 1;
  let wingFlapAmplitude = 0.5;
  
  // Head animation
  let headBobTime = 0;
  let headBobAmplitude = 0.1;
  
  // Tail animation
  let tailSwayTime = 0;
  let tailSwayAmplitude = 0.3;
  
  // Special effects for boss dragons
  let effectGroup: THREE.Group | null = null;
  if (isBoss) {
    effectGroup = createBossDragonEffects(type);
    group.add(effectGroup);
  }
  
  return {
    group,
    head,
    body,
    wings: { left: leftWing, right: rightWing },
    tail,
    legs,
    
    update(dt: number, clock: number, target?: { x: number; z: number }) {
      animationTime += dt * animationSpeed;
      wingFlapTime += dt * wingFlapSpeed;
      headBobTime += dt;
      tailSwayTime += dt * 0.7;
      
      // Apply animations based on current state
      switch (currentAnimation) {
        case 'idle':
          wingFlapSpeed = 0.8;
          wingFlapAmplitude = 0.15;
          headBobAmplitude = 0.05;
          tailSwayAmplitude = 0.2;
          break;
        case 'walk':
          wingFlapSpeed = 1.2;
          wingFlapAmplitude = 0.25;
          headBobAmplitude = 0.15;
          tailSwayAmplitude = 0.4;
          break;
        case 'fly':
          wingFlapSpeed = 2.5;
          wingFlapAmplitude = 1.2;
          headBobAmplitude = 0.1;
          tailSwayAmplitude = 0.3;
          break;
        case 'attack':
          wingFlapSpeed = 3;
          wingFlapAmplitude = 0.8;
          headBobAmplitude = 0.3;
          tailSwayAmplitude = 0.5;
          break;
        case 'roar':
          wingFlapSpeed = 0.5;
          wingFlapAmplitude = 0.05;
          headBobAmplitude = 0.4;
          tailSwayAmplitude = 0.1;
          break;
        case 'breath':
          wingFlapSpeed = 1;
          wingFlapAmplitude = 0.4;
          headBobAmplitude = 0.2;
          tailSwayAmplitude = 0.2;
          break;
        case 'death':
          wingFlapSpeed = 0.3;
          wingFlapAmplitude = 0.05;
          headBobAmplitude = 0.02;
          tailSwayAmplitude = 0.1;
          break;
      }
      
      // Wing flapping animation
      const wingFlap = Math.sin(wingFlapTime * 2) * wingFlapAmplitude;
      leftWing.rotation.set(0, wingFlap, Math.PI / 2 + Math.sin(wingFlapTime) * 0.1);
      rightWing.rotation.set(0, -wingFlap, -Math.PI / 2 - Math.sin(wingFlapTime) * 0.1);
      
      // Head bobbing
      head.rotation.set(
        -0.2 + Math.sin(headBobTime * 3) * headBobAmplitude,
        Math.sin(headBobTime * 2) * headBobAmplitude * 0.5,
        0
      );
      
      // Tail sway
      tail.rotation.set(
        0.2 + Math.sin(tailSwayTime) * tailSwayAmplitude,
        Math.cos(tailSwayTime * 0.7) * tailSwayAmplitude * 0.3,
        0
      );
      
      // Body slight movement
      body.rotation.set(
        Math.sin(wingFlapTime * 0.5) * 0.05,
        0,
        0
      );
      
      // Update effects
      if (effectGroup) {
        (effectGroup as any).update(dt, clock);
      }
      
      // Leg animations for walking
      if (currentAnimation === 'walk' || currentAnimation === 'attack') {
        const legTime = animationTime * 2;
        for (let i = 0; i < legs.length; i++) {
          const phase = legTime + (i % 2 === 0 ? 0 : Math.PI);
          legs[i].position.y = -size * 0.3 + Math.sin(phase) * size * 0.2;
          legs[i].rotation.set(
            Math.sin(phase) * 0.4,
            0,
            0
          );
        }
      }
      
      // Special boss AI movement
      if (isBoss && target) {
        // Face towards target
        const dx = target.x - group.position.x;
        const dz = target.z - group.position.z;
        const angle = Math.atan2(dx, dz);
        group.rotation.y = angle;
      }
    },
    
    setAnimation(animation: DragonAnimation) {
      if (currentAnimation === animation) return;
      currentAnimation = animation;
      animationTime = 0;
      
      // Reset animation parameters
      switch (animation) {
        case 'fly':
          wingFlapTime = 0;
          wingFlapAmplitude = 1.2;
          break;
        case 'roar':
          // Play roar sound effect would go here
          break;
        case 'breath':
          // Start breath weapon effect
          break;
      }
    },
    
    dispose() {
      // Dispose geometries and materials
      group.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach(mat => mat.dispose());
            } else {
              mesh.material.dispose();
            }
          }
        }
      });
      
      if (effectGroup) {
        (effectGroup as any).dispose?.();
      }
    }
  };
}

/**
 * Create special effects for boss dragons
 */
function createBossDragonEffects(type: DragonType): THREE.Group {
  const group = new THREE.Group();
  group.name = 'dragon-effects';
  
  const colors = DRAGON_COLORS[type];
  
  // Aura effect
  const auraGeometry = new THREE.SphereGeometry(8, 16, 16);
  const auraMaterial = new THREE.MeshStandardMaterial({
    color: colors.aura,
    transparent: true,
    opacity: 0.2,
    emissive: colors.aura,
    emissiveIntensity: 0.3,
    side: THREE.DoubleSide,
  });
  const aura = new THREE.Mesh(auraGeometry, auraMaterial);
  group.add(aura);
  
  // Floating particles
  const particleCount = 30;
  const particleGeometry = new THREE.BufferGeometry();
  const particlePositions = new Float32Array(particleCount * 3);
  const particleColors = new Float32Array(particleCount * 3);
  
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2;
    const radius = 3 + Math.random() * 5;
    const height = Math.random() * 6;
    
    particlePositions[i * 3] = Math.cos(angle) * radius;
    particlePositions[i * 3 + 1] = height;
    particlePositions[i * 3 + 2] = Math.sin(angle) * radius;
    
    const color = new THREE.Color(colors.effects);
    particleColors[i * 3] = color.r;
    particleColors[i * 3 + 1] = color.g;
    particleColors[i * 3 + 2] = color.b;
  }
  
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
  
  const particleMaterial = new THREE.PointsMaterial({
    size: 0.3,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  group.add(particles);
  
  // Ground effects
  const groundEffectGeometry = new THREE.PlaneGeometry(10, 10, 8, 8);
  const groundEffectMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(colors.effects) },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      
      void main() {
        vUv = uv;
        vec3 pos = position;
        pos.y += sin(pos.x * 2.0 + uTime) * cos(pos.z * 2.0 + uTime) * 0.1;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying vec2 vUv;
      
      void main() {
        float alpha = smoothstep(0.5, 0.8, length(vUv - vec2(0.5)));
        gl_FragColor = vec4(uColor, alpha * 0.3);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  
  groundEffectGeometry.rotateX(-Math.PI / 2);
  const groundEffect = new THREE.Mesh(groundEffectGeometry, groundEffectMaterial);
  groundEffect.position.y = -0.1;
  group.add(groundEffect);
  
  const particlePositionsAttr = particleGeometry.attributes.position as THREE.BufferAttribute;
  
  return Object.assign(group, {
    update(dt: number, clock: number) {
      // Update aura
      aura.scale.setScalar(8 + Math.sin(clock * 0.5) * 0.5);
      auraMaterial.opacity = 0.2 + Math.sin(clock * 0.3) * 0.1;
      
      // Update particles
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + clock * 0.2;
        const radius = 3 + Math.sin(clock + i) * 2;
        const height = Math.sin(clock * 0.5 + i * 0.3) * 3 + 2;
        
        particlePositionsAttr.setXYZ(
          i,
          Math.cos(angle) * radius,
          height,
          Math.sin(angle) * radius
        );
      }
      particlePositionsAttr.needsUpdate = true;
      
      // Update ground effect
      groundEffectMaterial.uniforms.uTime.value = clock;
      groundEffect.rotation.x = clock * 0.1;
    },
    
    dispose() {
      auraGeometry.dispose();
      auraMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      groundEffectGeometry.dispose();
      groundEffectMaterial.dispose();
    }
  });
}

/**
 * Dragon boss configurations for different Philippine mythological dragons
 */
export const DRAGON_BOSSES = {
  bakunawa: {
    type: 'bakunawa' as DragonType,
    size: 4,
    position: { x: 0, y: 0, z: 0 },
    isBoss: true,
    name: 'Bakunawa - Moon Eater',
    health: 5000,
    damage: 150,
    abilities: ['moon_beam', 'tidal_wave', 'eclipse_breath'],
    description: 'The legendary dragon that devours the moon, bringing darkness to the world. Guardian of the celestial realm.',
  },
  naga_king: {
    type: 'naga' as DragonType,
    size: 3.5,
    position: { x: 0, y: 0, z: 0 },
    isBoss: true,
    name: 'Naga King - Forest Guardian',
    health: 4000,
    damage: 120,
    abilities: ['venom_spit', 'forest_grasping', 'nature_wrath'],
    description: 'Ancient serpent dragon that protects the sacred forests. Its venom can petrify even the bravest warriors.',
  },
  tikbalang_lord: {
    type: 'tikbalang' as DragonType,
    size: 3.8,
    position: { x: 0, y: 0, z: 0 },
    isBoss: true,
    name: 'Tikbalang Lord - Mountain Guardian',
    health: 4500,
    damage: 135,
    abilities: ['fire_breath', 'stomp_attack', 'illusion_mirage'],
    description: 'Mystical forest dragon with the power of fire and illusion. Known to lead travelers astray in the mountains.',
  },
  sarimanok_queen: {
    type: 'sarimanok' as DragonType,
    size: 3.2,
    position: { x: 0, y: 0, z: 0 },
    isBoss: true,
    name: 'Sarimanok Queen - Bird of Fortune',
    health: 3500,
    damage: 100,
    abilities: ['rainbow_beam', 'healing_aura', 'fortune_blessing'],
    description: 'The legendary bird-dragon hybrid that brings fortune and good luck. Its colorful plumage shines with mystical energy.',
  },
};

/**
 * Create dragon spawn locations for the map
 */
export function createDragonSpawnPoints(): Array<{
  position: { x: number; z: number };
  type: DragonType;
  spawnTime: number;
  isBoss: boolean;
}> {
  return [
    // Bakunawa spawn point - near river/volcanic area
    {
      position: { x: -85, z: -85 },
      type: 'bakunawa',
      spawnTime: 300, // 5 minutes
      isBoss: true,
    },
    // Naga spawn points - forest areas
    {
      position: { x: 70, z: -60 },
      type: 'naga',
      spawnTime: 180, // 3 minutes
      isBoss: false,
    },
    {
      position: { x: -60, z: 70 },
      type: 'naga',
      spawnTime: 180,
      isBoss: false,
    },
    // Tikbalang spawn points - jungle/mountain areas
    {
      position: { x: 80, z: 80 },
      type: 'tikbalang',
      spawnTime: 240, // 4 minutes
      isBoss: false,
    },
    {
      position: { x: -70, z: -70 },
      type: 'tikbalang',
      spawnTime: 240,
      isBoss: false,
    },
    // Sarimanok spawn point - special location
    {
      position: { x: 0, z: 90 },
      type: 'sarimanok',
      spawnTime: 420, // 7 minutes
      isBoss: true,
    },
  ];
}