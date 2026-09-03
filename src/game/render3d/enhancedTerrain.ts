// Enhanced Terrain System for ALamat MOBA
//
// Features:
// - Enhanced slope generation with realistic terrain features
// - Multiple biome types (forest, volcanic, river, mountain)
// - Cliff formations and rocky outcrops
// - Cave entrances and hidden areas
// - Dynamic terrain detail based on elevation and slope
// - Mobile Legends quality terrain rendering
//
// This system provides the foundation for competing with top-tier MOBA graphics.

import * as THREE from 'three';
import { surfaceMaterial } from './stage';
import { ARENA_SIZE, OBSTACLES } from '@/game/arena/layout';
import { LANES, LANE_WIDTH, laneDistance } from '@/game/arena/lanes';
import { RIVER_WIDTH as TERRAIN_RIVER_WIDTH, riverAt, riverDepth, riverFloor, groundHeight, onCrossing } from '@/game/arena/river';
import { getPerformanceSettings, PERFORMANCE_PRESETS } from './performanceOptimizer';

// Biome color definitions
export const BIOME_COLORS = {
  // Forest biome
  forest: {
    grass: [0x2e7d32, 0x388e3c, 0x1b5e20],
    dirt: [0x5d4037, 0x6b5138, 0x4e342e],
    stone: [0xa8b0b4, 0x76807f, 0x8c9e9f],
    moss: [0x6f9b3f, 0x5d8a40, 0x4a7b3a],
    flower: [0xf2c14e, 0xef767a, 0xe8a0bf, 0xffd9a0, 0xf7f0d8],
  },
  // Volcanic biome
  volcanic: {
    rock: [0x2b2625, 0x1a1717, 0x1c2833],
    lava: [0xff4500, 0xff6347, 0xff8c69],
    ash: [0x4a4a4a, 0x3a3a3a, 0x5a5a5a],
    obsidian: [0x161312, 0x261c19, 0x0a0807],
    sulfur: [0xffd700, 0xffcc00, 0xdaa520],
  },
  // River biome
  river: {
    water: [0x1e3142, 0x2e4a66, 0x3a6b8a],
    sand: [0xf5f5dc, 0xe8dcc0, 0xd4c9a7],
    pebble: [0x8c8c8c, 0x6c6c6c, 0x7c7c7c],
    wetMud: [0x2e1f18, 0x3a261c, 0x483124],
    reed: [0x6b8e23, 0x556b2f, 0x8fbc8f],
  },
  // Mountain biome
  mountain: {
    rock: [0x8c7870, 0x7c6862, 0x9c8880],
    snow: [0xfafafa, 0xf0f8ff, 0xe6e6fa],
    alpineGrass: [0x9acd32, 0x7cb342, 0x689d6a],
    cliff: [0x6b6b6b, 0x5b5b5b, 0x7b7b7b],
  },
  // Jungle biome
  jungle: {
    deepGreen: [0x1b4d2e, 0x265d37, 0x0d3d27],
    vine: [0x3d6b38, 0x4a7b44, 0x2d5a36],
    bamboo: [0x8fbc8f, 0x6b8e23, 0x556b2f],
    fungus: [0xff6b6b, 0xffa500, 0xffd700],
  },
};

// Terrain feature types
export type TerrainFeature = {
  type: 'peak' | 'valley' | 'cliff' | 'cave' | 'ridge' | 'depression' | 'plateau';
  position: { x: number; z: number };
  radius: number;
  height: number;
  smoothness: number;
  biome?: keyof typeof BIOME_COLORS;
};

// Enhanced terrain configuration
export interface EnhancedTerrainConfig {
  size: number; // Half-width of the terrain
  skirt: number; // Distance beyond playable area
  baseElevation: number; // Base elevation of the terrain
  elevationRange: { min: number; max: number };
  slopeFactor: number; // Overall steepness
  biomeRegions: Array<{
    center: { x: number; z: number };
    radius: number;
    biome: keyof typeof BIOME_COLORS;
    transition: number; // Transition zone width
  }>;
  features: TerrainFeature[];
}

/**
 * Enhanced noise function with multiple octaves for realistic terrain
 */
function enhancedTerrainNoise(
  x: number, 
  z: number, 
  octaves: number = 4,
  persistence: number = 0.5,
  scale: number = 0.1
): number {
  let total = 0;
  let frequency = 1;
  let amplitude = 1;
  let maxValue = 0;
  
  for (let i = 0; i < octaves; i++) {
    const n = Math.sin(x * frequency * 12.9898 + z * frequency * 78.233) * 43758.5453;
    const value = (n - Math.floor(n)) * 2 - 1; // Range: -1 to 1
    total += value * amplitude;
    maxValue += amplitude;
    frequency *= 2;
    amplitude *= persistence;
  }
  
  return total / maxValue; // Normalize to -1 to 1
}

/**
 * Smooth interpolation function
 */
function smoothInterp(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Create enhanced terrain with realistic slopes and features
 */
export function buildEnhancedTerrain(config?: Partial<EnhancedTerrainConfig>): {
  group: THREE.Group;
  update: (dt: number, clock: number) => void;
  dispose: () => void;
} {
  const defaultConfig: EnhancedTerrainConfig = {
    size: ARENA_SIZE + 90, // Extended size
    skirt: 90,
    baseElevation: 0,
    elevationRange: { min: -5, max: 15 },
    slopeFactor: 1.5,
    biomeRegions: [
      { center: { x: 0, z: 0 }, radius: 20, biome: 'forest', transition: 10 },
      { center: { x: -80, z: -80 }, radius: 25, biome: 'volcanic', transition: 15 },
      { center: { x: 0, z: 40 }, radius: 15, biome: 'river', transition: 8 },
      { center: { x: 70, z: -60 }, radius: 20, biome: 'jungle', transition: 12 },
      { center: { x: -70, z: 70 }, radius: 18, biome: 'mountain', transition: 10 },
    ],
    features: [
      // Central peak
      { type: 'peak', position: { x: -10, z: -10 }, radius: 8, height: 6, smoothness: 0.8, biome: 'mountain' },
      // Volcanic ridge
      { type: 'ridge', position: { x: -85, z: -85 }, radius: 15, height: 8, smoothness: 0.6, biome: 'volcanic' },
      // Forest valley
      { type: 'valley', position: { x: 50, z: -50 }, radius: 12, height: -4, smoothness: 0.9, biome: 'forest' },
      // Cliff formation
      { type: 'cliff', position: { x: -60, z: 30 }, radius: 6, height: 10, smoothness: 0.4, biome: 'mountain' },
      // Cave entrance
      { type: 'cave', position: { x: 75, z: 75 }, radius: 4, height: 2, smoothness: 0.7, biome: 'jungle' },
      // Plateau
      { type: 'plateau', position: { x: -40, z: -70 }, radius: 10, height: 5, smoothness: 0.5, biome: 'volcanic' },
    ],
  };
  
  const finalConfig = { ...defaultConfig, ...config };
  const { size, skirt, baseElevation, elevationRange, slopeFactor, biomeRegions, features } = finalConfig;
  
  const group = new THREE.Group();
  group.name = 'enhanced-terrain';
  
  const extent = size + skirt;
  const totalSize = extent * 2;
  
  // Calculate optimal segment count based on performance settings
  const perfSettings = getPerformanceSettings();
  const segmentCount = Math.floor(totalSize / (280 / perfSettings.terrain.segmentCount));
  const geometry = new THREE.PlaneGeometry(totalSize, totalSize, segmentCount, segmentCount);
  geometry.rotateX(-Math.PI / 2);
  
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  
  // Arrays for vertex data
  const colors = new Float32Array(position.count * 3);
  const aoFactor = new Float32Array(position.count); // Ambient occlusion factor
  const slopeData = new Float32Array(position.count); // Slope for material variation
  const biomeType = new Float32Array(position.count); // Biome identifier
  
  // Generate terrain height and colors
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    
    // Calculate height with enhanced noise and features
    const height = calculateEnhancedHeight(x, z, finalConfig);
    
    // Store final height
    position.setY(i, height);
    
    // Calculate biome at this position
    const currentBiome = getBiomeAt(x, z, biomeRegions);
    
    // Get color based on biome and height
    const color = getTerrainColor(x, z, height, currentBiome, finalConfig);
    
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    
    // Store biome type for shader effects
    biomeType[i] = biomeRegions.findIndex(r => r.biome === currentBiome);
    
    // Calculate AO factor (simplified)
    aoFactor[i] = 0.8 + Math.sin(x * 0.5 + z * 0.5) * 0.1;
    
    // Calculate slope factor
    slopeData[i] = calculateSlopeFactor(x, z, finalConfig);
  }
  
  // Add custom attributes
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aoFactor', new THREE.BufferAttribute(aoFactor, 1));
  geometry.setAttribute('slopeFactor', new THREE.BufferAttribute(slopeData, 1));
  geometry.setAttribute('biomeType', new THREE.BufferAttribute(biomeType, 1));
  
  geometry.computeVertexNormals();
  
  // Enhanced terrain material with PBR properties
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color(0x4a5d4a) },
      uElevationRange: { value: new THREE.Vector2(elevationRange.min, elevationRange.max) },
      uLightDirection: { value: new THREE.Vector3(0.5, 1, 0.3).normalize() },
      uWindDirection: { value: new THREE.Vector2(0.3, 0.7).normalize() },
      uWindStrength: { value: 0.1 },
      uDetailScale: { value: 10.0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform vec2 uElevationRange;
      uniform vec3 uLightDirection;
      uniform vec2 uWindDirection;
      uniform float uWindStrength;
      uniform float uDetailScale;
      
      attribute vec3 color;
      attribute float aoFactor;
      attribute float slopeFactor;
      attribute float biomeType;
      
      varying vec3 vColor;
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying float vAOFactor;
      varying float vSlopeFactor;
      varying float vBiomeType;
      varying float vElevation;
      
      void main() {
        vColor = color;
        vPosition = position;
        vNormal = normalize(normalMatrix * normal);
        vAOFactor = aoFactor;
        vSlopeFactor = slopeFactor;
        vBiomeType = biomeType;
        vElevation = (position.y - uElevationRange.x) / (uElevationRange.y - uElevationRange.x);
        
        // Add subtle wind animation to grass areas
        float windEffect = uWindStrength * 0.1;
        if (slopeFactor < 0.7) {
          float windX = sin(uTime * 2.0 + position.x * uDetailScale) * windEffect;
          float windZ = cos(uTime * 1.5 + position.z * uDetailScale) * windEffect * 0.7;
          vec3 windOffset = vec3(windX, 0.0, windZ);
          vec3 pos = position + windOffset * (1.0 - slopeFactor * 0.8);
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        } else {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      }
    `,
    fragmentShader: `
      uniform vec3 uLightDirection;
      
      varying vec3 vColor;
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying float vAOFactor;
      varying float vSlopeFactor;
      varying float vBiomeType;
      varying float vElevation;
      
      void main() {
        vec3 baseColor = vColor;
        float ao = vAOFactor;
        baseColor *= ao;
        float slopeDarkening = 1.0 - vSlopeFactor * 0.2;
        baseColor *= slopeDarkening;
        vec3 lightDir = normalize(uLightDirection);
        float diffuse = max(dot(vNormal, lightDir), 0.2) * 0.8 + 0.2;
        vec3 finalColor = baseColor * diffuse;
        float fogFactor = 1.0 - smoothstep(0.3, 0.7, vElevation);
        finalColor = mix(finalColor, baseColor * 0.7, fogFactor * 0.3);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    vertexColors: true,
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'enhanced-terrain-mesh';
  group.add(mesh);
  
  // Add additional terrain features
  const featureGroup = createTerrainFeatures(finalConfig);
  group.add(featureGroup);
  
  // Add cliff formations
  const cliffGroup = createEnhancedCliffs(finalConfig);
  group.add(cliffGroup);
  
  // Add cave entrances
  const caveGroup = createCaveEntrances(finalConfig);
  group.add(caveGroup);
  
  // Add rocky outcrops
  const rockGroup = createRockyOutcrops(finalConfig);
  group.add(rockGroup);
  
  return {
    group,
    update(dt: number, clock: number) {
      // Update wind effects
      material.uniforms.uTime.value = clock;
      material.uniforms.uWindStrength.value = 0.1 + Math.sin(clock * 0.3) * 0.05;
      
      // Update feature animations
      featureGroup.children.forEach((child: any) => {
        if (child.update) {
          child.update(dt, clock);
        }
      });
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      group.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach(m => m.dispose());
            } else {
              mesh.material.dispose();
            }
          }
        }
      });
    }
  };
}

/**
 * Calculate enhanced height with realistic terrain features
 */
function calculateEnhancedHeight(
  x: number, 
  z: number, 
  config: EnhancedTerrainConfig
): number {
  const { baseElevation, elevationRange, slopeFactor, features } = config;
  
  // Base height with multi-octave noise
  const noiseScale = 0.05;
  const baseNoise = enhancedTerrainNoise(x, z, 4, 0.5, noiseScale) * 3.0;
  
  // Additional detail noise
  const detailNoise = enhancedTerrainNoise(x, z, 2, 0.7, noiseScale * 2) * 1.5;
  
  // Combine base height
  let height = baseElevation + baseNoise + detailNoise * 0.5;
  
  // Apply feature-based height modifications
  for (const feature of features) {
    const dx = x - feature.position.x;
    const dz = z - feature.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance < feature.radius) {
      const factor = Math.max(0, 1 - distance / feature.radius);
      const smoothFactor = Math.pow(factor, feature.smoothness);
      
      switch (feature.type) {
        case 'peak':
          height += smoothFactor * feature.height * slopeFactor;
          break;
        case 'valley':
          height -= smoothFactor * Math.abs(feature.height) * slopeFactor;
          break;
        case 'cliff':
          // Cliff has sharp transition
          if (factor > 0.7) {
            height += (factor - 0.7) / 0.3 * feature.height * slopeFactor;
          }
          break;
        case 'ridge':
          height += smoothFactor * feature.height * slopeFactor * 0.8;
          break;
        case 'depression':
          height -= smoothFactor * Math.abs(feature.height) * slopeFactor;
          break;
        case 'plateau':
          // Plateau has flat top
          if (factor > 0.8) {
            height += feature.height * slopeFactor;
          } else {
            height += smoothFactor * feature.height * slopeFactor;
          }
          break;
        case 'cave':
          // Cave entrance - slight depression
          height -= smoothFactor * Math.abs(feature.height) * slopeFactor * 0.5;
          break;
      }
    }
  }
  
  // Apply global slope factor
  height *= slopeFactor;
  
  // Clamp to elevation range
  height = Math.max(elevationRange.min, Math.min(elevationRange.max, height));
  
  // Smooth edges near the boundary
  const edgeDistance = Math.max(Math.abs(x), Math.abs(z));
  if (edgeDistance > config.size - config.skirt * 0.5) {
    const edgeFactor = Math.max(0, 1 - (edgeDistance - (config.size - config.skirt * 0.5)) / (config.skirt * 0.5));
    height = height * edgeFactor + baseElevation * (1 - edgeFactor);
  }
  
  return height;
}

/**
 * Calculate slope factor at a position
 */
function calculateSlopeFactor(
  x: number, 
  z: number, 
  config: EnhancedTerrainConfig
): number {
  // Sample height at multiple points around the position
  const delta = 0.1;
  const centerHeight = calculateEnhancedHeight(x, z, config);
  
  const heights = [
    calculateEnhancedHeight(x + delta, z, config),
    calculateEnhancedHeight(x - delta, z, config),
    calculateEnhancedHeight(x, z + delta, config),
    calculateEnhancedHeight(x, z - delta, config),
  ];
  
  // Calculate maximum slope
  let maxSlope = 0;
  for (const h of heights) {
    const slope = Math.abs(h - centerHeight) / delta;
    if (slope > maxSlope) maxSlope = slope;
  }
  
  // Normalize and clamp slope factor
  return Math.min(1, maxSlope * 0.5);
}

/**
 * Determine biome at a specific position
 */
function getBiomeAt(
  x: number, 
  z: number, 
  biomeRegions: EnhancedTerrainConfig['biomeRegions']
): keyof typeof BIOME_COLORS {
  let currentBiome: keyof typeof BIOME_COLORS = 'forest';
  let maxInfluence = 0;
  
  for (const region of biomeRegions) {
    const dx = x - region.center.x;
    const dz = z - region.center.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance < region.radius + region.transition) {
      const influence = Math.max(0, 1 - distance / (region.radius + region.transition));
      if (influence > maxInfluence) {
        maxInfluence = influence;
        currentBiome = region.biome;
      }
    }
  }
  
  return currentBiome;
}

/**
 * Get terrain color based on biome and elevation
 */
function getTerrainColor(
  x: number, 
  z: number, 
  height: number, 
  biome: keyof typeof BIOME_COLORS, 
  config: EnhancedTerrainConfig
): THREE.Color {
  const biomeData = BIOME_COLORS[biome as keyof typeof BIOME_COLORS];
  const elevationRange = config.elevationRange;
  const elevationT = Math.max(0, Math.min(1, (height - elevationRange.min) / (elevationRange.max - elevationRange.min)));
  
  // Add position-based variation
  const hash = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  const noise = (hash - Math.floor(hash)) * 2 - 1; // Range: -1 to 1
  
  let color: THREE.Color;
  
  // Type-safe biome color access
  const forestColors = biomeData as typeof BIOME_COLORS.forest;
  const volcanicColors = biomeData as typeof BIOME_COLORS.volcanic;
  const riverColors = biomeData as typeof BIOME_COLORS.river;
  const mountainColors = biomeData as typeof BIOME_COLORS.mountain;
  const jungleColors = biomeData as typeof BIOME_COLORS.jungle;
  
  switch (biome) {
    case 'forest':
      // Forest biome - green grass with variations
      if (elevationT > 0.7) {
        // Higher elevation - alpine meadow
        color = new THREE.Color(forestColors.grass[0]).lerp(
          new THREE.Color(forestColors.grass[1]),
          (elevationT - 0.7) / 0.3
        );
      } else if (elevationT < 0.3) {
        // Lower elevation - darker, more fertile soil
        color = new THREE.Color(forestColors.dirt[2]).lerp(
          new THREE.Color(forestColors.grass[2]),
          elevationT * 2
        );
      } else {
        // Normal forest floor
        color = new THREE.Color(forestColors.grass[1]);
      }
      
      // Add noise variation
      color.offsetHSL(noise * 0.05, noise * 0.1, noise * 0.05);
      break;
    
    case 'volcanic':
      // Volcanic biome - dark, rocky terrain
      if (elevationT > 0.8) {
        color = new THREE.Color(volcanicColors.obsidian[1]);
      } else if (elevationT > 0.5) {
        color = new THREE.Color(volcanicColors.rock[1]);
      } else if (elevationT > 0.2) {
        color = new THREE.Color(volcanicColors.ash[1]);
      } else {
        color = new THREE.Color(volcanicColors.ash[0]);
      }
      
      // Add more variation for volcanic terrain
      color.offsetHSL(0, noise * 0.2 + 0.1, noise * 0.1);
      break;
    
    case 'river':
      // River biome - sandy, wet terrain
      if (elevationT > 0.7) {
        color = new THREE.Color(riverColors.sand[0]);
      } else if (elevationT > 0.4) {
        color = new THREE.Color(riverColors.pebble[1]);
      } else if (elevationT > 0.1) {
        color = new THREE.Color(riverColors.wetMud[1]);
      } else {
        // This would be underwater, but terrain handles that separately
        color = new THREE.Color(riverColors.wetMud[2]);
      }
      
      color.offsetHSL(noise * 0.05, noise * 0.15, noise * 0.08);
      break;
    
    case 'mountain':
      // Mountain biome - rocky with snow at peaks
      if (elevationT > 0.9) {
        color = new THREE.Color(mountainColors.snow[1]);
      } else if (elevationT > 0.7) {
        color = new THREE.Color(mountainColors.snow[0]);
      } else if (elevationT > 0.5) {
        color = new THREE.Color(mountainColors.alpineGrass[1]);
      } else if (elevationT > 0.2) {
        color = new THREE.Color(mountainColors.rock[1]);
      } else {
        color = new THREE.Color(mountainColors.rock[0]);
      }
      
      color.offsetHSL(0, noise * 0.1, noise * 0.15);
      break;
    
    case 'jungle':
      // Jungle biome - very dense, dark green
      if (elevationT > 0.6) {
        color = new THREE.Color(jungleColors.bamboo[1]);
      } else if (elevationT > 0.3) {
        color = new THREE.Color(jungleColors.deepGreen[1]);
      } else {
        color = new THREE.Color(jungleColors.vine[1]);
      }
      
      color.offsetHSL(noise * 0.05, noise * 0.1, noise * 0.05);
      break;
    
    default:
      color = new THREE.Color(0x4a5d4a); // Default green
  }
  
  // Add additional variation based on features
  for (const feature of config.features) {
    const dx = x - feature.position.x;
    const dz = z - feature.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance < feature.radius) {
      const factor = Math.max(0, 1 - distance / feature.radius);
      
      if (feature.type === 'cliff' || feature.type === 'peak') {
        color.offsetHSL(0, -0.05, -0.1 * factor);
      } else if (feature.type === 'valley' || feature.type === 'depression') {
        color.offsetHSL(0, 0.05, 0.05 * factor);
      } else if (feature.biome === 'volcanic') {
        color.offsetHSL(0, 0.1, -0.05 * factor);
      }
    }
  }
  
  return color;
}

/**
 * Create terrain features like cliffs, caves, and rocky outcrops
 */
function createTerrainFeatures(config: EnhancedTerrainConfig): THREE.Group {
  const group = new THREE.Group();
  group.name = 'terrain-features';
  
  // Add cliffs and rocky formations
  for (const feature of config.features) {
    if (feature.type === 'cliff') {
      const cliff = createCliffFeature(feature as TerrainFeature & { type: 'cliff' }, config);
      group.add(cliff);
    } else if (feature.type === 'cave') {
      // Cave entrances are handled separately
    } else if (feature.type === 'peak') {
      const peak = createPeakFeature(feature as TerrainFeature & { type: 'peak' }, config);
      group.add(peak);
    }
  }
  
  return group;
}

/**
 * Create cliff feature
 */
function createCliffFeature(
  feature: TerrainFeature & { type: 'cliff' },
  config: EnhancedTerrainConfig
): THREE.Group {
  const group = new THREE.Group();
  group.name = `cliff-${feature.position.x}-${feature.position.z}`;
  
  // Create cliff face
  const cliffHeight = feature.height;
  const cliffWidth = feature.radius * 2;
  const cliffDepth = feature.radius * 0.5;
  
  // Cliff geometry - irregular shape
  const cliffGeometry = new THREE.BoxGeometry(cliffWidth, cliffHeight, cliffDepth);
  
  // Apply noise to cliff face for natural look
  const position = cliffGeometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    
    // Only apply to front face (z > 0)
    if (z > -cliffDepth / 2) {
      const noise = Math.sin(x * 3 + y * 2 + i * 0.5) * 0.1;
      position.setX(i, x + noise * cliffWidth * 0.1);
      position.setY(i, y + noise * cliffHeight * 0.1);
    }
  }
  
  position.needsUpdate = true;
  cliffGeometry.computeVertexNormals();
  
  // Cliff material
  const biome = feature.biome || 'mountain';
  const biomeData = BIOME_COLORS[biome as keyof typeof BIOME_COLORS];
  const mountainData = BIOME_COLORS.mountain;
  const forestData = BIOME_COLORS.forest;
  const volcanicData = BIOME_COLORS.volcanic;
  
  let cliffColor = 0x6b6b6b; // Default gray
  if (biome === 'mountain') {
    cliffColor = mountainData.cliff?.[1] || mountainData.rock[1];
  } else if (biome === 'forest') {
    cliffColor = forestData.stone?.[1] || 0x8c9e9f;
  } else if (biome === 'volcanic') {
    cliffColor = volcanicData.obsidian?.[1] || volcanicData.rock[1];
  } else if (biome === 'river') {
    cliffColor = 0x6b6b6b; // River cliffs
  } else if (biome === 'jungle') {
    cliffColor = 0x3d6b38; // Jungle cliffs
  }
  
  const cliffMaterial = surfaceMaterial(cliffColor, {
    roughness: 0.85,
    metalness: 0.05,
  });
  
  const cliff = new THREE.Mesh(cliffGeometry, cliffMaterial);
  cliff.position.set(feature.position.x, feature.height / 2, feature.position.z);
  cliff.castShadow = true;
  cliff.receiveShadow = true;
  group.add(cliff);
  
  // Add cliff top
  const topGeometry = new THREE.BoxGeometry(cliffWidth * 1.2, 0.5, cliffDepth * 1.5);
  let topColor = 0x5b5b5b; // Default dark gray
  if (biome === 'mountain') {
    topColor = mountainData.cliff?.[0] || mountainData.rock[0];
  } else if (biome === 'forest') {
    topColor = forestData.stone?.[0] || 0x76807f;
  } else if (biome === 'volcanic') {
    topColor = volcanicData.obsidian?.[0] || volcanicData.rock[0];
  } else if (biome === 'river') {
    topColor = 0x5b5b5b;
  } else if (biome === 'jungle') {
    topColor = 0x2d5a36;
  }
  
  const topMaterial = surfaceMaterial(topColor, {
    roughness: 0.9,
    metalness: 0.02,
  });
  
  const top = new THREE.Mesh(topGeometry, topMaterial);
  top.position.set(feature.position.x, feature.height + 0.25, feature.position.z);
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);
  
  return group;
}

/**
 * Create peak feature
 */
function createPeakFeature(
  feature: TerrainFeature & { type: 'peak' },
  config: EnhancedTerrainConfig
): THREE.Group {
  const group = new THREE.Group();
  group.name = `peak-${feature.position.x}-${feature.position.z}`;
  
  // Create rock formations at peak
  const rockCount = 5 + Math.floor(Math.random() * 5);
  const biome = feature.biome || 'mountain';
  
  for (let i = 0; i < rockCount; i++) {
    const angle = (i / rockCount) * Math.PI * 2;
    const radius = feature.radius * (0.6 + Math.random() * 0.4);
    const height = feature.height * (0.8 + Math.random() * 0.4);
    
    const rockGeometry = new THREE.DodecahedronGeometry(0.8 + Math.random() * 1.2, 1);
    let rockColor = 0x8c7870; // Default mountain rock
    
    if (biome === 'mountain') {
      rockColor = BIOME_COLORS.mountain.rock[Math.floor(Math.random() * BIOME_COLORS.mountain.rock.length)];
    } else if (biome === 'volcanic') {
      rockColor = BIOME_COLORS.volcanic.rock[Math.floor(Math.random() * BIOME_COLORS.volcanic.rock.length)];
    } else if (biome === 'forest') {
      rockColor = BIOME_COLORS.forest.stone[Math.floor(Math.random() * BIOME_COLORS.forest.stone.length)];
    } else if (biome === 'river') {
      rockColor = BIOME_COLORS.river.pebble[Math.floor(Math.random() * BIOME_COLORS.river.pebble.length)];
    } else if (biome === 'jungle') {
      rockColor = BIOME_COLORS.jungle.vine[Math.floor(Math.random() * BIOME_COLORS.jungle.vine.length)];
    }
    
    const rockMaterial = surfaceMaterial(rockColor, { roughness: 0.8, metalness: 0.05 });
    
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.position.set(
      feature.position.x + Math.cos(angle) * radius,
      calculateEnhancedHeight(feature.position.x + Math.cos(angle) * radius, 
                              feature.position.z + Math.sin(angle) * radius, 
                              config) + height * 0.5,
      feature.position.z + Math.sin(angle) * radius
    );
    
    rock.rotation.set(
      Math.random() * 0.3,
      Math.random() * Math.PI * 2,
      Math.random() * 0.3
    );
    
    rock.scale.setScalar(0.8 + Math.random() * 1.5);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }
  
  return group;
}

/**
 * Create enhanced cliffs with better detail
 */
function createEnhancedCliffs(config: EnhancedTerrainConfig): THREE.Group {
  const group = new THREE.Group();
  group.name = 'enhanced-cliffs';
  
  // Additional cliff formations at strategic locations
  const cliffLocations = [
    { x: -55, z: -25, height: 12, width: 15, depth: 4, biome: 'volcanic' },
    { x: 45, z: 35, height: 8, width: 20, depth: 6, biome: 'mountain' },
    { x: -30, z: 55, height: 10, width: 18, depth: 5, biome: 'forest' },
    { x: 65, z: -40, height: 14, width: 12, depth: 4, biome: 'jungle' },
  ];
  
  for (const loc of cliffLocations) {
    const cliffGroup = new THREE.Group();
    cliffGroup.name = `enhanced-cliff-${loc.x}-${loc.z}`;
    
    // Create multiple rock layers
    const layerCount = 3 + Math.floor(Math.random() * 3);
    const biomeColors = BIOME_COLORS[loc.biome as keyof typeof BIOME_COLORS];
    
    for (let i = 0; i < layerCount; i++) {
      const layerHeight = loc.height * (i + 1) / layerCount;
      const layerWidth = loc.width * (0.8 + Math.random() * 0.4);
      const layerDepth = loc.depth * (0.8 + Math.random() * 0.4);
      
      const layerGeometry = new THREE.BoxGeometry(layerWidth, 1.5, layerDepth);
      
      // Apply noise
      const position = layerGeometry.attributes.position;
      for (let j = 0; j < position.count; j++) {
        const x = position.getX(j);
        const y = position.getY(j);
        const z = position.getZ(j);
        
        const noise = Math.sin(x * 2 + y * 1.5 + j * 0.3 + i * 10) * 0.15;
        position.setX(j, x * (1 + noise));
        position.setZ(j, z * (1 + noise * 0.7));
      }
      
      position.needsUpdate = true;
      layerGeometry.computeVertexNormals();
      
        let layerColor = 0x8c9e9f; // Default stone
      if (loc.biome === 'mountain') {
        layerColor = BIOME_COLORS.mountain.rock[Math.floor(Math.random() * BIOME_COLORS.mountain.rock.length)];
      } else if (loc.biome === 'volcanic') {
        layerColor = BIOME_COLORS.volcanic.rock[Math.floor(Math.random() * BIOME_COLORS.volcanic.rock.length)];
      } else if (loc.biome === 'forest') {
        layerColor = BIOME_COLORS.forest.stone[Math.floor(Math.random() * BIOME_COLORS.forest.stone.length)];
      } else if (loc.biome === 'river') {
        layerColor = BIOME_COLORS.river.pebble[Math.floor(Math.random() * BIOME_COLORS.river.pebble.length)];
      } else if (loc.biome === 'jungle') {
        layerColor = BIOME_COLORS.jungle.vine[Math.floor(Math.random() * BIOME_COLORS.jungle.vine.length)];
      }
      
      const layerMaterial = surfaceMaterial(layerColor, { roughness: 0.9, metalness: 0.02 });
      
      const layer = new THREE.Mesh(layerGeometry, layerMaterial);
      layer.position.set(
        loc.x + (Math.random() - 0.5) * 2,
        layerHeight + 0.75,
        loc.z + (Math.random() - 0.5) * 2
      );
      
      layer.rotation.set(
        Math.random() * 0.1,
        Math.random() * 0.1,
        Math.random() * 0.1
      );
      
      layer.castShadow = true;
      layer.receiveShadow = true;
      cliffGroup.add(layer);
    }
    
    group.add(cliffGroup);
  }
  
  return group;
}

/**
 * Create cave entrances
 */
function createCaveEntrances(config: EnhancedTerrainConfig): THREE.Group {
  const group = new THREE.Group();
  group.name = 'cave-entrances';
  
  const caveLocations = [
    { x: 85, z: 85, radius: 3, depth: 8, biome: 'jungle' },
    { x: -80, z: 40, radius: 2.5, depth: 6, biome: 'volcanic' },
    { x: 30, z: -80, radius: 3.5, depth: 10, biome: 'mountain' },
  ];
  
  for (const loc of caveLocations) {
    const caveGroup = new THREE.Group();
    caveGroup.name = `cave-${loc.x}-${loc.z}`;
    
    const terrainHeightAtCave = calculateEnhancedHeight(loc.x, loc.z, config);
    
    // Cave entrance - semi-spherical
    const entranceGeometry = new THREE.SphereGeometry(loc.radius * 1.2, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const biomeColors = BIOME_COLORS[loc.biome as keyof typeof BIOME_COLORS];
    let entranceColor = 0x333333;
    if (loc.biome === 'mountain') {
      entranceColor = BIOME_COLORS.mountain.cliff?.[2] || BIOME_COLORS.mountain.rock[2] || 0x333333;
    } else if (loc.biome === 'volcanic') {
      entranceColor = BIOME_COLORS.volcanic.obsidian?.[2] || BIOME_COLORS.volcanic.rock[2] || 0x333333;
    } else if (loc.biome === 'forest') {
      entranceColor = BIOME_COLORS.forest.stone?.[2] || 0x333333;
    } else if (loc.biome === 'river') {
      entranceColor = BIOME_COLORS.river.pebble?.[2] || 0x333333;
    } else if (loc.biome === 'jungle') {
      entranceColor = BIOME_COLORS.jungle.bamboo?.[2] || 0x333333;
    }
    
    const entranceMaterial = surfaceMaterial(entranceColor, { roughness: 0.95, metalness: 0.01 });
    
    const entrance = new THREE.Mesh(entranceGeometry, entranceMaterial);
    entrance.position.set(loc.x, terrainHeightAtCave + loc.radius * 0.5, loc.z);
    entrance.rotation.set(Math.PI / 2, 0, Math.random() * Math.PI * 2);
    entrance.castShadow = false;
    entrance.receiveShadow = true;
    caveGroup.add(entrance);
    
    // Cave interior darkness
    const interiorGeometry = new THREE.SphereGeometry(loc.radius * 0.9, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const interiorMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.DoubleSide,
    });
    
    const interior = new THREE.Mesh(interiorGeometry, interiorMaterial);
    interior.position.set(
      loc.x + Math.cos(Math.random() * Math.PI * 2) * loc.depth * 0.3,
      terrainHeightAtCave + loc.radius * 0.3,
      loc.z + Math.sin(Math.random() * Math.PI * 2) * loc.depth * 0.3
    );
    interior.rotation.set(Math.PI / 2, 0, Math.random() * Math.PI * 2);
    caveGroup.add(interior);
    
    group.add(caveGroup);
  }
  
  return group;
}

/**
 * Create rocky outcrops
 */
function createRockyOutcrops(config: EnhancedTerrainConfig): THREE.Group {
  const group = new THREE.Group();
  group.name = 'rocky-outcrops';
  
  const outcropCount = 40;
  
  for (let i = 0; i < outcropCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = config.size * (0.4 + Math.random() * 0.6);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    
    // Determine biome at this location
    const biome = getBiomeAt(x, z, config.biomeRegions);
    const biomeColors = BIOME_COLORS[biome];
    
    // Only place in appropriate biomes
    if (biome === 'volcanic' || biome === 'mountain' || (biome === 'forest' && Math.random() > 0.7)) {
      const outcropSize = 0.6 + Math.random() * 1.4;
      const outcropGeometry = new THREE.DodecahedronGeometry(outcropSize, 1);
      
      // Apply deformation for natural look
      const position = outcropGeometry.attributes.position;
      for (let j = 0; j < position.count; j++) {
        const noise = Math.sin(j * 1.7 + i * 2.3) * 0.2 + Math.cos(j * 1.3 + i * 1.9) * 0.15;
        const xPos = position.getX(j);
        const yPos = position.getY(j);
        const zPos = position.getZ(j);
        
        position.setX(j, xPos * (1 + noise));
        position.setY(j, yPos * (1 + noise * 0.5));
        position.setZ(j, zPos * (1 + noise * 0.7));
      }
      
      position.needsUpdate = true;
      outcropGeometry.computeVertexNormals();
      
      // Get appropriate rock/stone color for biome (type-safe)
      const biomeAny = biomeColors as any;
      const rockColors = biomeAny.rock || biomeAny.stone || biomeAny.pebble || [0x8c7870];
      const rockColor = rockColors[Math.floor(Math.random() * rockColors.length)];
      const outcropMaterial = surfaceMaterial(rockColor, { roughness: 0.85, metalness: 0.05 });
      
      const outcrop = new THREE.Mesh(outcropGeometry, outcropMaterial);
      
      const terrainHeightAtOutcrop = calculateEnhancedHeight(x, z, config);
      outcrop.position.set(
        x + (Math.random() - 0.5) * 1,
        terrainHeightAtOutcrop + outcropSize * 0.5,
        z + (Math.random() - 0.5) * 1
      );
      
      outcrop.rotation.set(
        Math.random() * Math.PI * 0.5,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 0.5
      );
      
      outcrop.castShadow = true;
      outcrop.receiveShadow = true;
      group.add(outcrop);
    }
  }
  
  return group;
}

/**
 * Calculate terrain height at specific position (for compatibility)
 */
export function getEnhancedTerrainHeight(x: number, z: number, config?: Partial<EnhancedTerrainConfig>): number {
  const defaultConfig: EnhancedTerrainConfig = {
    size: ARENA_SIZE + 90,
    skirt: 90,
    baseElevation: 0,
    elevationRange: { min: -5, max: 15 },
    slopeFactor: 1.5,
    biomeRegions: [
      { center: { x: 0, z: 0 }, radius: 20, biome: 'forest', transition: 10 },
      { center: { x: -80, z: -80 }, radius: 25, biome: 'volcanic', transition: 15 },
      { center: { x: 0, z: 40 }, radius: 15, biome: 'river', transition: 8 },
      { center: { x: 70, z: -60 }, radius: 20, biome: 'jungle', transition: 12 },
      { center: { x: -70, z: 70 }, radius: 18, biome: 'mountain', transition: 10 },
    ],
    features: [
      { type: 'peak', position: { x: -10, z: -10 }, radius: 8, height: 6, smoothness: 0.8, biome: 'mountain' },
      { type: 'ridge', position: { x: -85, z: -85 }, radius: 15, height: 8, smoothness: 0.6, biome: 'volcanic' },
      { type: 'valley', position: { x: 50, z: -50 }, radius: 12, height: -4, smoothness: 0.9, biome: 'forest' },
      { type: 'cliff', position: { x: -60, z: 30 }, radius: 6, height: 10, smoothness: 0.4, biome: 'mountain' },
      { type: 'cave', position: { x: 75, z: 75 }, radius: 4, height: 2, smoothness: 0.7, biome: 'jungle' },
      { type: 'plateau', position: { x: -40, z: -70 }, radius: 10, height: 5, smoothness: 0.5, biome: 'volcanic' },
    ],
  };
  
  const finalConfig = { ...defaultConfig, ...config };
  return calculateEnhancedHeight(x, z, finalConfig);
}

/**
 * Create default enhanced terrain for the game
 */
export function createDefaultEnhancedTerrain(): {
  group: THREE.Group;
  update: (dt: number, clock: number) => void;
  dispose: () => void;
} {
  return buildEnhancedTerrain();
}