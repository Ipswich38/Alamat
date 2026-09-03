// Expanded Map System for ALamat MOBA
//
// This system integrates all the enhanced features:
// - Dragons (Bakunawa, Naga, Tikbalang, Sarimanok)
// - Giant Philippine Trees (Akasya, Narra, Ipil-Ipil)
// - Enhanced Terrain with slopes and multiple biomes
// - Cave entrances and cliff formations
// - Dynamic lighting and effects for Mobile Legends quality
//
// The map is expanded to provide a much larger playing area with diverse
// environments and challenges to compete with top-tier MOBAs.

import * as THREE from 'three';
import { surfaceMaterial } from './stage';
import { ARENA_SIZE, OBSTACLES } from '@/game/arena/layout';
import { createPhilippineTree, TreeConfig, createGiantTreeLocations, createTreeGrove, PH_TREE_Species, Tree } from './philippineTrees';
import { createDragon, DragonConfig, Dragon, DragonType, createDragonSpawnPoints, DRAGON_BOSSES } from './dragons';
import { buildEnhancedTerrain, getEnhancedTerrainHeight, EnhancedTerrainConfig, BIOME_COLORS } from './enhancedTerrain';
import { terrainHeight } from './terrain';
import { getPerformanceSettings } from './performanceOptimizer';

export interface ExpandedMap {
  group: THREE.Group;
  terrain: THREE.Group;
  trees: Tree[];
  dragons: Dragon[];
  update: (dt: number, clock: number, playerPosition?: { x: number; z: number }) => void;
  setGraphicsQuality: (quality: 'low' | 'medium' | 'high' | 'ultra') => void;
  setWindIntensity: (intensity: number) => void;
  spawnDragon: (dragonType: DragonType, position: { x: number; z: number }, isBoss?: boolean) => Dragon;
  addTree: (config: TreeConfig) => Tree;
  dispose: () => void;
}

// Map configuration
interface MapConfig {
  size: number; // Half-width of expanded map
  biomeConfig: EnhancedTerrainConfig;
  treeDensity: number;
  dragonSpawnRate: number;
  enableAnimations: boolean;
}

const DEFAULT_MAP_CONFIG: MapConfig = {
  size: 150, // Expand from 20 to 150 (7.5x larger area)
  biomeConfig: {
    size: 150,
    skirt: 50,
    baseElevation: 0,
    elevationRange: { min: -8, max: 20 },
    slopeFactor: 2.0,
    biomeRegions: [
      // Central forest area
      { center: { x: 0, z: 0 }, radius: 40, biome: 'forest', transition: 15 },
      // Volcanic area - Northwest
      { center: { x: -100, z: -100 }, radius: 45, biome: 'volcanic', transition: 20 },
      // River delta - North
      { center: { x: 0, z: 80 }, radius: 35, biome: 'river', transition: 12 },
      // Jungle area - Southeast
      { center: { x: 80, z: -80 }, radius: 40, biome: 'jungle', transition: 18 },
      // Mountain area - Northeast
      { center: { x: -90, z: 90 }, radius: 35, biome: 'mountain', transition: 15 },
      // Second forest - South
      { center: { x: 50, z: 60 }, radius: 25, biome: 'forest', transition: 10 },
    ],
    features: [
      // Major geographic features
      { type: 'peak', position: { x: -80, z: -70 }, radius: 20, height: 15, smoothness: 0.6, biome: 'volcanic' },
      { type: 'ridge', position: { x: -120, z: -80 }, radius: 25, height: 12, smoothness: 0.5, biome: 'mountain' },
      { type: 'valley', position: { x: 40, z: -30 }, radius: 18, height: -6, smoothness: 0.8, biome: 'forest' },
      { type: 'cliff', position: { x: -60, z: 70 }, radius: 12, height: 18, smoothness: 0.3, biome: 'mountain' },
      { type: 'cliff', position: { x: 70, z: -60 }, radius: 10, height: 14, smoothness: 0.4, biome: 'jungle' },
      { type: 'cave', position: { x: 100, z: 100 }, radius: 5, height: 3, smoothness: 0.8, biome: 'jungle' },
      { type: 'cave', position: { x: -110, z: 50 }, radius: 4, height: 2, smoothness: 0.7, biome: 'mountain' },
      { type: 'plateau', position: { x: -50, z: -120 }, radius: 20, height: 8, smoothness: 0.4, biome: 'volcanic' },
      { type: 'peak', position: { x: 30, z: 90 }, radius: 15, height: 10, smoothness: 0.7, biome: 'mountain' },
      { type: 'depression', position: { x: -20, z: 50 }, radius: 12, height: -4, smoothness: 0.9, biome: 'river' },
    ],
  },
  treeDensity: 1.5, // Trees per unit area
  dragonSpawnRate: 1.0,
  enableAnimations: true,
};

/**
 * Create the expanded map with all enhancements
 */
export function createExpandedMap(config: Partial<MapConfig> = {}): ExpandedMap {
  const finalConfig = { ...DEFAULT_MAP_CONFIG, ...config };
  
  const group = new THREE.Group();
  group.name = 'expanded-map';
  
  // Get performance settings
  const perfSettings = getPerformanceSettings();
  
  // Create enhanced terrain
  const terrain = buildEnhancedTerrain(finalConfig.biomeConfig);
  terrain.group.name = 'expanded-terrain';
  group.add(terrain.group);
  
  // Store trees and dragons
  const trees: Tree[] = [];
  const dragons: Dragon[] = [];
  
  // Current quality level
  let currentQuality: 'low' | 'medium' | 'high' | 'ultra' = 'high';
  let windIntensity = 0.3;
  
  // Get max trees from performance settings
  const maxTrees = perfSettings.trees.maxTrees;
  const leafletMultiplier = perfSettings.trees.leafletCount;
  const enableGiantTreeEffects = perfSettings.trees.giantTreeEffects;
  
  // Create giant trees at predefined locations (limited by performance)
  const giantTreeConfigs = createGiantTreeLocations()
    .slice(0, Math.max(1, Math.floor(maxTrees * 0.3))) // Use 30% of max for giant trees
    .map(treeConfig => ({
    ...treeConfig,
    position: {
      ...treeConfig.position,
      // Adjust y position based on terrain height
      y: getEnhancedTerrainHeight(treeConfig.position.x, treeConfig.position.z, finalConfig.biomeConfig)
    }
  }));
  
  for (const treeConfig of giantTreeConfigs) {
    // Apply performance-based leaflet reduction
    const optimizedConfig = {
      ...treeConfig,
      isGiant: treeConfig.isGiant && leafletMultiplier >= 0.5,
      hasFruit: treeConfig.hasFruit && leafletMultiplier >= 0.7,
    };
    const tree = createPhilippineTree(optimizedConfig);
    tree.setWindIntensity(windIntensity);
    trees.push(tree);
    group.add(tree.group);
  }
  
  // Calculate remaining tree budget for groves
  const remainingTreeBudget = Math.max(0, maxTrees - giantTreeConfigs.length);
  const treesPerGrove = Math.max(1, Math.floor(remainingTreeBudget / 3));
  
  // Create tree groves in different biomes (limited by performance)
  const groveConfigs = [
    { center: { x: 20, z: 30 }, radius: 15, species: 'akasya' as const, count: Math.min(8, treesPerGrove) },
    { center: { x: -30, z: -40 }, radius: 20, species: 'narra' as const, count: Math.min(6, treesPerGrove) },
    { center: { x: 90, z: -70 }, radius: 18, species: 'ipil_ipil' as const, count: Math.min(10, treesPerGrove) },
  ];
  
  const groves = groveConfigs
    .filter(config => config.count > 0)
    .flatMap(config => {
      const grove = createTreeGrove(
        config.center,
        config.radius,
        config.species,
        config.count,
        false
      );
      return grove.map(tree => ({
        tree,
        species: config.species
      }));
    });
  
  groves.forEach(({ tree }) => {
    tree.setWindIntensity(windIntensity);
    trees.push(tree);
    group.add(tree.group);
  });
  
  // Get dragon limits from performance settings
  const dragonComplexity = perfSettings.dragons.complexity;
  const maxDragons = Math.max(1, Math.floor(maxTrees * 0.5)); // Limit dragons relative to trees
  
  // Create dragon spawn points
  const dragonSpawns = createDragonSpawnPoints().slice(0, maxDragons);
  
  // Initial dragon spawns
  for (const spawn of dragonSpawns) {
    // Position dragons on terrain
    const terrainY = getEnhancedTerrainHeight(spawn.position.x, spawn.position.z, finalConfig.biomeConfig);
    
    const dragonConfig: DragonConfig = {
      type: spawn.type,
      size: spawn.isBoss ? 4 * dragonComplexity : 2.5 * dragonComplexity,
      position: { x: spawn.position.x, y: terrainY + 2, z: spawn.position.z },
      isBoss: spawn.isBoss && dragonComplexity >= 0.7,
      name: `${spawn.type.charAt(0).toUpperCase() + spawn.type.slice(1)} ${spawn.isBoss ? 'Boss' : 'Creature'}`
    };
    
    const dragon = createDragon(dragonConfig);
    dragon.setAnimation('idle');
    dragons.push(dragon);
    group.add(dragon.group);
  }
  
  // Create additional environmental features
  const environmentFeatures = createEnvironmentFeatures(finalConfig);
  group.add(environmentFeatures);
  
  // Create dragon lairs for boss dragons
  const dragonLairs = createDragonLairs(finalConfig);
  group.add(dragonLairs);
  
  // Create special effects for the expanded map
  const specialEffects = createMapSpecialEffects(finalConfig);
  group.add(specialEffects);
  
  return {
    group,
    terrain: terrain.group,
    trees,
    dragons,
    
    update(dt: number, clock: number, playerPosition?: { x: number; z: number }) {
      // Update terrain
      terrain.update(dt, clock);
      
      // Update all trees
      for (const tree of trees) {
        tree.update(dt, clock);
      }
      
      // Update all dragons
      for (const dragon of dragons) {
        dragon.update(dt, clock, playerPosition);
        
        // Random animations for dragons
        if (Math.random() < 0.003) { // 0.3% chance per frame
          const animations: any[] = ['idle', 'walk', 'roar'];
          if (Math.random() < 0.2) {
            animations.push('fly');
          }
          dragon.setAnimation(animations[Math.floor(Math.random() * animations.length)]);
        }
      }
      
      // Update special effects
      specialEffects.children.forEach((child: any) => {
        if (child.update) {
          child.update(dt, clock);
        }
      });
      
      // Update dragon lairs
      dragonLairs.children.forEach((child: any) => {
        if (child.update) {
          child.update(dt, clock);
        }
      });
    },
    
    setGraphicsQuality(quality: 'low' | 'medium' | 'high' | 'ultra') {
      currentQuality = quality;
      
      // Apply quality settings to dragons
      for (const dragon of dragons) {
        // In a real implementation, this would toggle detail levels
        // For now, we'll just update the animation complexity
        dragon.setAnimation('idle');
      }
      
      // Apply quality settings to trees
      for (const tree of trees) {
        tree.setWindIntensity(windIntensity * (quality === 'low' ? 0.5 : 1.0));
      }
    },
    
    setWindIntensity(intensity: number) {
      windIntensity = Math.max(0, Math.min(1, intensity));
      for (const tree of trees) {
        tree.setWindIntensity(windIntensity);
      }
    },
    
    spawnDragon(dragonType: DragonType, position: { x: number; z: number }, isBoss = false): Dragon {
      const terrainY = getEnhancedTerrainHeight(position.x, position.z, finalConfig.biomeConfig);
      
      const dragonConfig: DragonConfig = {
        type: dragonType,
        size: isBoss ? 4 : 2.5,
        position: { x: position.x, y: terrainY + 2, z: position.z },
        isBoss,
        name: `${dragonType.charAt(0).toUpperCase() + dragonType.slice(1)} ${isBoss ? 'Boss' : 'Minion'}`
      };
      
      const dragon = createDragon(dragonConfig);
      dragon.setAnimation('idle');
      dragons.push(dragon);
      group.add(dragon.group);
      
      return dragon;
    },
    
    addTree(config: TreeConfig): Tree {
      const tree = createPhilippineTree({
        ...config,
        position: {
          ...config.position,
          y: config.position.y || getEnhancedTerrainHeight(config.position.x, config.position.z, finalConfig.biomeConfig)
        }
      });
      tree.setWindIntensity(windIntensity);
      trees.push(tree);
      group.add(tree.group);
      return tree;
    },
    
    dispose() {
      terrain.dispose();
      
      for (const tree of trees) {
        tree.dispose();
      }
      
      for (const dragon of dragons) {
        dragon.dispose();
      }
      
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
 * Create environmental features for the expanded map
 */
function createEnvironmentFeatures(config: MapConfig): THREE.Group {
  const group = new THREE.Group();
  group.name = 'environment-features';
  
  // Create ancient ruins
  const ruins = createAncientRuins(config);
  group.add(ruins);
  
  // Create mystical shrines
  const shrines = createMysticalShrines(config);
  group.add(shrines);
  
  // Create crystal formations
  const crystals = createCrystalFormations(config);
  group.add(crystals);
  
  return group;
}

/**
 * Create ancient ruins scattered across the map
 */
function createAncientRuins(config: MapConfig): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ancient-ruins';
  
  const ruinLocations = [
    { x: 40, z: 20, size: 3, type: 'temple' },
    { x: -30, z: -50, size: 2.5, type: 'altar' },
    { x: 80, z: -40, size: 2, type: 'pillar' },
    { x: -60, z: 40, size: 1.8, type: 'statue' },
    { x: 20, z: -70, size: 2.2, type: 'wall' },
  ];
  
  for (const loc of ruinLocations) {
    const ruinGroup = new THREE.Group();
    ruinGroup.name = `ruin-${loc.type}-${loc.x}-${loc.z}`;
    
    const terrainY = getEnhancedTerrainHeight(loc.x, loc.z, config.biomeConfig);
    
    // Stone material for ruins
    const stoneMaterial = surfaceMaterial(0x76807f, { roughness: 0.9, metalness: 0.05 });
    
    switch (loc.type) {
      case 'temple':
        // Create temple structure
        const base = new THREE.Mesh(
          new THREE.BoxGeometry(loc.size * 2, 0.5, loc.size * 1.5),
          stoneMaterial
        );
        base.position.y = terrainY + 0.25;
        base.castShadow = true;
        ruinGroup.add(base);
        
        const pillars = new THREE.InstancedMesh(
          new THREE.CylinderGeometry(0.2, 0.2, 3, 8),
          stoneMaterial,
          4
        );
        
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          const distance = loc.size * 0.8;
          const pillar = new THREE.Object3D();
          pillar.position.set(
            Math.cos(angle) * distance,
            1.5,
            Math.sin(angle) * distance
          );
          pillar.updateMatrix();
          pillars.setMatrixAt(i, pillar.matrix);
        }
        
        pillars.position.y = terrainY + 3;
        pillars.castShadow = true;
        ruinGroup.add(pillars);
        break;
        
      case 'altar':
        // Create sacrificial altar
        const altarBase = new THREE.Mesh(
          new THREE.CylinderGeometry(loc.size, loc.size * 1.2, 1, 12),
          stoneMaterial
        );
        altarBase.position.y = terrainY + 0.5;
        altarBase.castShadow = true;
        ruinGroup.add(altarBase);
        
        const altarTop = new THREE.Mesh(
          new THREE.CylinderGeometry(loc.size * 0.8, loc.size * 1, 0.5, 12),
          surfaceMaterial(0x666666, { roughness: 0.85, metalness: 0.08 })
        );
        altarTop.position.y = terrainY + 1.25;
        altarTop.castShadow = true;
        ruinGroup.add(altarTop);
        break;
        
      case 'pillar':
        // Broken pillar
        const pillarBottom = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.4, 3, 8),
          stoneMaterial
        );
        pillarBottom.position.y = terrainY + 1.5;
        pillarBottom.rotation.set(Math.PI / 8, 0, 0);
        pillarBottom.castShadow = true;
        ruinGroup.add(pillarBottom);
        
        const pillarTop = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.3, 2, 8),
          stoneMaterial
        );
        pillarTop.position.set(loc.x + 0.5, terrainY + 3.5, loc.z - 0.3);
        pillarTop.rotation.set(-Math.PI / 4, Math.PI / 3, 0);
        pillarTop.castShadow = true;
        ruinGroup.add(pillarTop);
        break;
        
      case 'statue':
        // Ancient statue
        const statueBase = new THREE.Mesh(
          new THREE.BoxGeometry(1, 0.3, 1),
          stoneMaterial
        );
        statueBase.position.y = terrainY + 0.15;
        statueBase.castShadow = true;
        ruinGroup.add(statueBase);
        
        const statueBody = new THREE.Mesh(
          new THREE.CylinderGeometry(0.4, 0.3, 2, 10),
          stoneMaterial
        );
        statueBody.position.y = terrainY + 1.2;
        statueBody.castShadow = true;
        ruinGroup.add(statueBody);
        
        const statueHead = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 8, 8),
          stoneMaterial
        );
        statueHead.position.y = terrainY + 2.4;
        statueHead.castShadow = true;
        ruinGroup.add(statueHead);
        break;
        
      case 'wall':
        // Ruined wall
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(loc.size * 2, 2, 0.3),
          stoneMaterial
        );
        wall.position.y = terrainY + 1;
        wall.castShadow = true;
        ruinGroup.add(wall);
        
        // Add some broken sections
        const gap = new THREE.Mesh(
          new THREE.BoxGeometry(loc.size * 0.5, 0.5, 0.3),
          stoneMaterial
        );
        gap.position.set(loc.x, terrainY + 0.5, loc.z);
        gap.rotation.set(0.3, 0, 0);
        gap.castShadow = true;
        ruinGroup.add(gap);
        break;
    }
    
    // Add moss and weathering
    const mossGeometry = new THREE.PlaneGeometry(loc.size * 1.5, loc.size * 1.5);
    const mossMaterial = new THREE.MeshStandardMaterial({
      color: 0x6f9b3f,
      roughness: 1,
      metalness: 0.01,
      transparent: true,
      opacity: 0.6,
    });
    
    const moss = new THREE.Mesh(mossGeometry, mossMaterial);
    moss.rotation.set(Math.PI / 2, 0, 0);
    moss.position.y = terrainY + 0.05;
    moss.receiveShadow = true;
    ruinGroup.add(moss);
    
    ruinGroup.position.set(loc.x, 0, loc.z);
    group.add(ruinGroup);
  }
  
  return group;
}

/**
 * Create mystical shrines
 */
function createMysticalShrines(config: MapConfig): THREE.Group {
  const group = new THREE.Group();
  group.name = 'mystical-shrines';
  
  const shrineLocations = [
    { x: -20, z: 0, type: 'healing', color: 0x00ff88 },
    { x: 0, z: -30, type: 'power', color: 0xff0088 },
    { x: -40, z: 20, type: 'wisdom', color: 0x8800ff },
    { x: 30, z: 40, type: 'defense', color: 0xff8800 },
  ];
  
  for (const loc of shrineLocations) {
    const shrineGroup = new THREE.Group();
    shrineGroup.name = `shrine-${loc.type}-${loc.x}-${loc.z}`;
    
    const terrainY = getEnhancedTerrainHeight(loc.x, loc.z, config.biomeConfig);
    
    // Pedestal
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1.2, 1.5, 10),
      surfaceMaterial(0x4a4a4a, { roughness: 0.8, metalness: 0.1 })
    );
    pedestal.position.y = terrainY + 0.75;
    pedestal.castShadow = true;
    shrineGroup.add(pedestal);
    
    // Main structure
    const structure = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.5, 1),
      new THREE.MeshStandardMaterial({
        color: loc.color,
        roughness: 0.2,
        metalness: 0.6,
        emissive: loc.color,
        emissiveIntensity: 0.3,
      })
    );
    structure.position.y = terrainY + 2;
    structure.castShadow = true;
    shrineGroup.add(structure);
    
    // Floating particles for mystical effect
    const particleCount = 10;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 2 + Math.random() * 3;
      const height = Math.random() * 4;
      
      particlePositions[i * 3] = Math.cos(angle) * radius;
      particlePositions[i * 3 + 1] = height;
      particlePositions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      color: loc.color,
      size: 0.2,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.position.y = terrainY + 2;
    shrineGroup.add(particles);
    
    // Animation for particles
    const particlePositionsAttr = particleGeometry.attributes.position as THREE.BufferAttribute;
    
    shrineGroup.userData.update = (dt: number, clock: number) => {
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + clock * 0.5;
        const radius = 2 + Math.sin(clock + i) * 1;
        const height = Math.sin(clock * 0.5 + i * 0.3) * 2 + 1;
        
        particlePositionsAttr.setXYZ(i, Math.cos(angle) * radius, height, Math.sin(angle) * radius);
      }
      particlePositionsAttr.needsUpdate = true;
      
      // Rotate structure
      structure.rotation.y = clock * 0.1;
    };
    
    shrineGroup.position.set(loc.x, 0, loc.z);
    group.add(shrineGroup);
  }
  
  return group;
}

/**
 * Create crystal formations
 */
function createCrystalFormations(config: MapConfig): THREE.Group {
  const group = new THREE.Group();
  group.name = 'crystal-formations';
  
  const crystalLocations = [
    { x: -80, z: -90, count: 5, color: 0x4cc9f0, size: 0.8 },
    { x: 90, z: 80, count: 3, color: 0x4895ef, size: 1.2 },
    { x: -100, z: 60, count: 4, color: 0x00e5ff, size: 1 },
    { x: 60, z: -90, count: 6, color: 0x88e2ff, size: 0.6 },
  ];
  
  for (const loc of crystalLocations) {
    const crystalGroup = new THREE.Group();
    crystalGroup.name = `crystals-${loc.x}-${loc.z}`;
    
    const terrainY = getEnhancedTerrainHeight(loc.x, loc.z, config.biomeConfig);
    
    for (let i = 0; i < loc.count; i++) {
      const angle = (i / loc.count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const radius = loc.size * 2 * (0.7 + Math.random() * 0.6);
      
      const crystalGeometry = new THREE.ConeGeometry(
        loc.size * (0.8 + Math.random() * 0.4), 
        loc.size * (1.5 + Math.random()), 
        6
      );
      
      const crystalMaterial = new THREE.MeshPhysicalMaterial({
        color: loc.color,
        transparent: true,
        opacity: 0.8,
        transmission: 0.3,
        roughness: 0.1,
        metalness: 0.2,
        ior: 1.5,
        thickness: 0.5,
      });
      
      const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
      crystal.position.set(
        Math.cos(angle) * radius,
        terrainY + loc.size * (0.5 + Math.random()),
        Math.sin(angle) * radius
      );
      crystal.rotation.set(
        Math.random() * 0.3,
        Math.random() * Math.PI * 2,
        Math.random() * 0.3
      );
      
      crystal.castShadow = true;
      crystalGroup.add(crystal);
    }
    
    crystalGroup.position.set(loc.x, 0, loc.z);
    group.add(crystalGroup);
  }
  
  return group;
}

/**
 * Create dragon lairs for boss dragons
 */
function createDragonLairs(config: MapConfig): THREE.Group {
  const group = new THREE.Group();
  group.name = 'dragon-lairs';
  
  // Dragon lairs at spawn points
  const lairLocations = [
    { x: -85, z: -85, dragonType: 'bakunawa' as DragonType, size: 6 },
    { x: 0, z: 90, dragonType: 'sarimanok' as DragonType, size: 5 },
    { x: 70, z: -60, dragonType: 'naga' as DragonType, size: 4 },
    { x: -70, z: 70, dragonType: 'tikbalang' as DragonType, size: 5 },
  ];
  
  for (const loc of lairLocations) {
    const lairGroup = new THREE.Group();
    lairGroup.name = `lair-${loc.dragonType}`;
    
    const terrainY = getEnhancedTerrainHeight(loc.x, loc.z, config.biomeConfig);
    
    // Lair platform
    const platformGeometry = new THREE.CircleGeometry(loc.size, 16);
    const biome = loc.dragonType === 'bakunawa' ? 'volcanic' : 
                  loc.dragonType === 'tikbalang' ? 'mountain' : 
                  loc.dragonType === 'naga' ? 'jungle' : 'forest';
    const biomeColors = BIOME_COLORS[biome];
    
    // Type-safe biome color access
    const rockColor = (biomeColors as any).rock?.[0] || (biomeColors as any).stone?.[0] || 0x333333;
    const platformMaterial = surfaceMaterial(
      rockColor,
      { roughness: 0.9, metalness: 0.05 }
    );
    
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.rotation.set(Math.PI / 2, 0, 0);
    platform.position.y = terrainY + 0.1;
    platform.receiveShadow = true;
    lairGroup.add(platform);
    
    // Lair decorations based on dragon type
    switch (loc.dragonType) {
      case 'bakunawa':
        // Water/celestial theme
        const waterGeometry = new THREE.CircleGeometry(loc.size * 0.7, 12);
        const waterMaterial = new THREE.MeshStandardMaterial({
          color: 0x1e3142,
          transparent: true,
          opacity: 0.8,
          roughness: 0.1,
          metalness: 0.1,
        });
        
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        water.rotation.set(Math.PI / 2, 0, 0);
        water.position.y = terrainY + 0.15;
        lairGroup.add(water);
        break;
        
      case 'naga':
        // Forest theme with vines
        for (let i = 0; i < 8; i++) {
          const vineGeometry = new THREE.CylinderGeometry(0.05, 0.08, 2 + Math.random() * 3, 6);
          const vineMaterial = surfaceMaterial(0x2e7d32, { roughness: 0.9, metalness: 0.02 });
          
          const vine = new THREE.Mesh(vineGeometry, vineMaterial);
          vine.position.set(
            Math.cos(i * Math.PI / 4) * loc.size * 0.8,
            terrainY + 1 + Math.random() * 2,
            Math.sin(i * Math.PI / 4) * loc.size * 0.8
          );
          vine.rotation.set(
            Math.PI / 2 + (Math.random() - 0.5) * 0.3,
            0,
            (Math.random() - 0.5) * 0.3
          );
          vine.castShadow = true;
          lairGroup.add(vine);
        }
        break;
        
      case 'tikbalang':
        // Fire/mountain theme
        const firePitGeometry = new THREE.CylinderGeometry(1, 1.2, 0.5, 8);
        const firePitMaterial = surfaceMaterial(0x333333, { roughness: 0.95, metalness: 0.01 });
        
        const firePit = new THREE.Mesh(firePitGeometry, firePitMaterial);
        firePit.position.y = terrainY + 0.25;
        firePit.castShadow = true;
        lairGroup.add(firePit);
        break;
        
      case 'sarimanok':
        // Gold/peacock theme
        const pedestalGeometry = new THREE.CylinderGeometry(0.5, 0.8, 1.5, 8);
        const pedestalMaterial = new THREE.MeshStandardMaterial({
          color: 0xffd700,
          roughness: 0.3,
          metalness: 0.8,
          emissive: 0xffd700,
          emissiveIntensity: 0.2,
        });
        
        const pedestal = new THREE.Mesh(pedestalGeometry, pedestalMaterial);
        pedestal.position.y = terrainY + 0.75;
        pedestal.castShadow = true;
        lairGroup.add(pedestal);
        break;
    }
    
    // Add mystical particles
    const particleCount = 15;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    
    const colors = {
      bakunawa: 0x4cc9f0,
      naga: 0x00ff88,
      tikbalang: 0xff4500,
      sarimanok: 0xff69b4,
    };
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = loc.size * (0.3 + Math.random() * 0.7);
      const height = Math.random() * loc.size;
      
      particlePositions[i * 3] = Math.cos(angle) * radius;
      particlePositions[i * 3 + 1] = height;
      particlePositions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      color: colors[loc.dragonType],
      size: 0.4,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.position.y = terrainY + 0.5;
    lairGroup.add(particles);
    
    // Animation
    const particlePositionsAttr = particleGeometry.attributes.position as THREE.BufferAttribute;
    
    lairGroup.userData.update = (dt: number, clock: number) => {
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + clock * 0.3;
        const radius = loc.size * (0.3 + Math.sin(clock + i * 0.5) * 0.1);
        const height = Math.sin(clock * 0.5 + i * 0.7) * loc.size * 0.5 + loc.size * 0.5;
        
        particlePositionsAttr.setXYZ(i, Math.cos(angle) * radius, height, Math.sin(angle) * radius);
      }
      particlePositionsAttr.needsUpdate = true;
    };
    
    lairGroup.position.set(loc.x, 0, loc.z);
    group.add(lairGroup);
  }
  
  return group;
}

/**
 * Create special effects for the entire map
 */
function createMapSpecialEffects(config: MapConfig): THREE.Group {
  const group = new THREE.Group();
  group.name = 'map-special-effects';
  
  // Sky dome with gradient
  const skyGeometry = new THREE.SphereGeometry(config.size * 2, 32, 32);
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSunDirection: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() },
      uHorizonColor: { value: new THREE.Color(0x87ceeb) },
      uZenithColor: { value: new THREE.Color(0x1e3a8a) },
      uNightColor: { value: new THREE.Color(0x0a0e23) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDirection;
      uniform vec3 uHorizonColor;
      uniform vec3 uZenithColor;
      uniform vec3 uNightColor;
      uniform float uTime;
      varying vec3 vWorldPosition;
      
      void main() {
        vec3 viewDir = normalize(vWorldPosition);
        
        // Calculate sky gradient
        float heightFactor = smoothstep(-1.0, 1.0, viewDir.y);
        vec3 skyColor = mix(uHorizonColor, uZenithColor, heightFactor);
        
        // Day/night cycle
        float dayFactor = smoothstep(0.0, 0.3, dot(viewDir, uSunDirection));
        vec3 finalColor = mix(uNightColor, skyColor, dayFactor);
        
        // Add some stars at night
        float starFactor = 1.0 - dayFactor;
        float starPattern = sin(vWorldPosition.x * 100.0 + uTime) * cos(vWorldPosition.z * 80.0 + uTime * 1.5);
        float starIntensity = smoothstep(0.95, 0.98, starPattern) * starFactor * 0.8;
        finalColor = mix(finalColor, vec3(1.0), starIntensity);
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    side: THREE.BackSide,
  });
  
  const skyDome = new THREE.Mesh(skyGeometry, skyMaterial);
  skyDome.position.y = config.size * 0.5;
  group.add(skyDome);
  
  // Ambient particles for atmosphere
  const ambientParticleCount = 50;
  const ambientParticleGeometry = new THREE.BufferGeometry();
  const ambientParticlePositions = new Float32Array(ambientParticleCount * 3);
  const ambientParticleColors = new Float32Array(ambientParticleCount * 3);
  
  for (let i = 0; i < ambientParticleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = config.size * (0.5 + Math.random() * 0.5);
    const height = config.size * (0.1 + Math.random() * 0.8);
    
    ambientParticlePositions[i * 3] = Math.cos(angle) * radius;
    ambientParticlePositions[i * 3 + 1] = height;
    ambientParticlePositions[i * 3 + 2] = Math.sin(angle) * radius;
    
    const color = new THREE.Color().setHSL(
      Math.random() * 0.1 + 0.6,
      0.5 + Math.random() * 0.3,
      0.7 + Math.random() * 0.2
    );
    ambientParticleColors[i * 3] = color.r;
    ambientParticleColors[i * 3 + 1] = color.g;
    ambientParticleColors[i * 3 + 2] = color.b;
  }
  
  ambientParticleGeometry.setAttribute('position', new THREE.BufferAttribute(ambientParticlePositions, 3));
  ambientParticleGeometry.setAttribute('color', new THREE.BufferAttribute(ambientParticleColors, 3));
  
  const ambientParticleMaterial = new THREE.PointsMaterial({
    size: 2,
    vertexColors: true,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  
  const ambientParticles = new THREE.Points(ambientParticleGeometry, ambientParticleMaterial);
  group.add(ambientParticles);
  
  // Animation for ambient particles
  const ambientParticlePositionsAttr = ambientParticleGeometry.attributes.position as THREE.BufferAttribute;
  
  group.userData.update = (dt: number, clock: number) => {
    skyMaterial.uniforms.uTime.value = clock;
    
    // Animate sky dome
    skyDome.rotation.y = clock * 0.001;
    
    // Animate ambient particles
    for (let i = 0; i < ambientParticleCount; i++) {
      const angle = (i / ambientParticleCount) * Math.PI * 2 + clock * 0.01;
      const radius = config.size * (0.5 + Math.sin(clock * 0.05 + i * 0.3) * 0.05);
      const height = config.size * (0.1 + Math.sin(clock * 0.03 + i * 0.2) * 0.03 + Math.random() * 0.02);
      
      ambientParticlePositionsAttr.setXYZ(i, Math.cos(angle) * radius, height, Math.sin(angle) * radius);
    }
    ambientParticlePositionsAttr.needsUpdate = true;
  };
  
  return group;
}

/**
 * Get the bounds of the expanded map
 */
export function getExpandedMapBounds(): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  const size = DEFAULT_MAP_CONFIG.size;
  return {
    minX: -size,
    maxX: size,
    minZ: -size,
    maxZ: size,
  };
}

/**
 * Check if a position is within the expanded map bounds
 */
export function isWithinExpandedMap(x: number, z: number): boolean {
  const bounds = getExpandedMapBounds();
  return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
}

/**
 * Get terrain height at position in the expanded map
 */
export function getExpandedMapHeight(x: number, z: number): number {
  return getEnhancedTerrainHeight(x, z, DEFAULT_MAP_CONFIG.biomeConfig);
}

/**
 * Create a completely new expanded map with custom configuration
 */
export function createCustomExpandedMap(config: Partial<MapConfig>): ExpandedMap {
  // Custom biome configuration
  const customBiomeConfig: EnhancedTerrainConfig = {
    ...DEFAULT_MAP_CONFIG.biomeConfig,
    ...config.biomeConfig,
    size: config.size || DEFAULT_MAP_CONFIG.size,
  };
  
  const customConfig: MapConfig = {
    ...DEFAULT_MAP_CONFIG,
    ...config,
    biomeConfig: customBiomeConfig,
  };
  
  return createExpandedMap(customConfig);
}