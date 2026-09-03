// ALamat Graphics Enhancement System
//
// This is the MAIN integration file for all the graphics enhancements.
// It provides a simple API to upgrade ALamat's graphics to compete with Mobile Legends.
//
// FEATURES IMPLEMENTED:
// ✅ Dragon creatures (Bakunawa, Naga, Tikbalang, Sarimanok) with animations
// ✅ Giant Philippine Trees (Akasya, Narra, Ipil-Ipil) with realistic foliage
// ✅ Enhanced terrain with slopes, cliffs, caves, and multiple biomes
// ✅ Expanded map size (7.5x larger than original)
// ✅ Mobile Legends quality rendering with PBR materials
// ✅ Dynamic lighting and special effects
// ✅ Wind animations for trees
// ✅ Dragon AI with animations and special effects

import * as THREE from 'three';
import { createExpandedMap, ExpandedMap, getExpandedMapBounds, isWithinExpandedMap, getExpandedMapHeight } from './expandedMap';
import { createDragon, DragonType, Dragon, DragonConfig, DRAGON_BOSSES, DRAGON_COLORS } from './dragons';
import { createPhilippineTree, TreeConfig, Tree, PH_TREE_Species, createGiantTreeLocations, createTreeGrove } from './philippineTrees';
import { buildEnhancedTerrain, EnhancedTerrainConfig, BIOME_COLORS, getEnhancedTerrainHeight } from './enhancedTerrain';
import { setPerformancePreset, getPerformanceSettings, PerformancePreset, PerformanceSettings, initializePerformance, fpsMonitor } from './performanceOptimizer';
import { shouldUseOfflineMode, initOfflineSupport, preloadCriticalAssets } from './offlineSupport';

// Graphics quality settings
export interface GraphicsSettings {
  quality: 'low' | 'medium' | 'high' | 'ultra';
  shadowQuality: 'low' | 'medium' | 'high';
  textureQuality: 'low' | 'medium' | 'high' | 'ultra';
  effectsEnabled: boolean;
  animationsEnabled: boolean;
  drawDistance: number;
  windIntensity: number;
}

const DEFAULT_GRAPHICS_SETTINGS: GraphicsSettings = {
  quality: 'high',
  shadowQuality: 'high',
  textureQuality: 'high',
  effectsEnabled: true,
  animationsEnabled: true,
  drawDistance: 200,
  windIntensity: 0.5,
};

/**
 * Main graphics enhancement controller
 */
export class AlamatGraphicsEnhancement {
  private expandedMap: ExpandedMap;
  private settings: GraphicsSettings;
  private clock: number = 0;
  private lastFrameTime: number = 0;
  private animationFrameId: number = 0;
  
  constructor(private scene: THREE.Scene, private canvas: HTMLCanvasElement) {
    this.settings = { ...DEFAULT_GRAPHICS_SETTINGS };
    this.expandedMap = createExpandedMap();
    this.scene.add(this.expandedMap.group);
    this.startAnimationLoop();
  }
  
  /**
   * Start the animation loop
   */
  private startAnimationLoop(): void {
    const animate = (timestamp: number) => {
      const dt = Math.min(0.1, (timestamp - this.lastFrameTime) / 1000);
      this.lastFrameTime = timestamp;
      this.clock += dt;
      
      this.update(dt, this.clock);
      this.animationFrameId = requestAnimationFrame(animate);
    };
    
    this.lastFrameTime = performance.now();
    this.animationFrameId = requestAnimationFrame(animate);
  }
  
  /**
   * Update all graphics systems
   */
  private update(dt: number, clock: number): void {
    if (!this.settings.animationsEnabled) return;
    
    // Update expanded map
    this.expandedMap.update(dt, clock, this.getPlayerPosition());
  }
  
  /**
   * Get current player position (to be integrated with game camera)
   */
  private getPlayerPosition(): { x: number; z: number } | undefined {
    // This should be connected to the actual player camera
    // For now, return a fixed position
    return { x: 0, z: 0 };
  }
  
  /**
   * Set performance preset for automatic optimization
   */
  setPerformancePreset(preset: PerformancePreset): void {
    setPerformancePreset(preset);
    // Update internal quality setting to match
    const presetToQuality: Record<PerformancePreset, 'low' | 'medium' | 'high' | 'ultra'> = {
      ultra: 'ultra',
      high: 'high',
      medium: 'medium',
      low: 'low',
      minimal: 'low'
    };
    this.settings.quality = presetToQuality[preset] || 'medium';
    this.expandedMap.setGraphicsQuality(this.settings.quality);
  }

  /**
   * Set graphics quality settings
   */
  setGraphicsQuality(settings: Partial<GraphicsSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.expandedMap.setGraphicsQuality(this.settings.quality);
    this.expandedMap.setWindIntensity(this.settings.windIntensity);
    
    // Map graphics quality to performance preset
    const qualityToPreset: Record<'low' | 'medium' | 'high' | 'ultra', PerformancePreset> = {
      low: 'low',
      medium: 'medium',
      high: 'high',
      ultra: 'ultra'
    };
    if (this.settings.quality && qualityToPreset[this.settings.quality]) {
      setPerformancePreset(qualityToPreset[this.settings.quality]);
    }
  }
  
  /**
   * Get current graphics settings
   */
  getGraphicsSettings(): GraphicsSettings {
    return { ...this.settings };
  }
  
  /**
   * Spawn a new dragon at the specified position
   */
  spawnDragon(dragonType: DragonType, position: { x: number; z: number }, isBoss = false): Dragon {
    return this.expandedMap.spawnDragon(dragonType, position, isBoss);
  }
  
  /**
   * Add a tree to the map
   */
  addTree(config: TreeConfig): Tree {
    return this.expandedMap.addTree(config);
  }
  
  /**
   * Get the expanded map instance
   */
  getExpandedMap(): ExpandedMap {
    return this.expandedMap;
  }
  
  /**
   * Check if position is within map bounds
   */
  isWithinBounds(x: number, z: number): boolean {
    return isWithinExpandedMap(x, z);
  }
  
  /**
   * Get terrain height at position
   */
  getTerrainHeight(x: number, z: number): number {
    return getExpandedMapHeight(x, z);
  }
  
  /**
   * Get map bounds
   */
  getMapBounds() {
    return getExpandedMapBounds();
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.expandedMap.dispose();
  }
  
  /**
   * Add custom terrain features
   */
  addCustomTerrainFeatures(config?: Partial<EnhancedTerrainConfig>): THREE.Group {
    const terrain = buildEnhancedTerrain(config);
    this.scene.add(terrain.group);
    return terrain.group;
  }
  
  /**
   * Add standalone dragon (not part of expanded map)
   */
  addStandaloneDragon(dragonConfig: DragonConfig): Dragon {
    const dragon = createDragon(dragonConfig);
    this.scene.add(dragon.group);
    return dragon;
  }
  
  /**
   * Add standalone tree (not part of expanded map)
   */
  addStandaloneTree(treeConfig: TreeConfig): Tree {
    const tree = createPhilippineTree({
      ...treeConfig,
      position: {
        ...treeConfig.position,
        y: treeConfig.position.y || this.getTerrainHeight(treeConfig.position.x, treeConfig.position.z)
      }
    });
    this.scene.add(tree.group);
    return tree;
  }
  
  /**
   * Update wind intensity
   */
  setWindIntensity(intensity: number): void {
    this.settings.windIntensity = Math.max(0, Math.min(1, intensity));
    this.expandedMap.setWindIntensity(this.settings.windIntensity);
  }
  
  /**
   * Toggle animations on/off
   */
  setAnimationsEnabled(enabled: boolean): void {
    this.settings.animationsEnabled = enabled;
  }
  
  /**
   * Toggle effects on/off
   */
  setEffectsEnabled(enabled: boolean): void {
    this.settings.effectsEnabled = enabled;
  }
}

/**
 * Create the enhanced graphics system and integrate with existing scene
 * Automatically initializes offline support for PWA and static export modes
 */
export function createEnhancedGraphicsSystem(
  scene: THREE.Scene, 
  canvas: HTMLCanvasElement
): AlamatGraphicsEnhancement {
  // Initialize offline support
  if (typeof window !== 'undefined') {
    initOfflineSupport();
    preloadCriticalAssets().catch(console.warn);
    
    // Auto-adjust performance for offline mode
    if (shouldUseOfflineMode()) {
      console.log('[Alamat] Offline mode detected - adjusting performance');
      setPerformancePreset('medium');
    }
  }
  
  return new AlamatGraphicsEnhancement(scene, canvas);
}

// Export all individual components for advanced usage
export {
  // Expanded Map
  createExpandedMap,
  getExpandedMapBounds,
  isWithinExpandedMap,
  getExpandedMapHeight,
  
  // Dragons
  createDragon,
  DRAGON_BOSSES,
  DRAGON_COLORS,
  
  // Trees
  createPhilippineTree,
  createGiantTreeLocations,
  createTreeGrove,
  PH_TREE_Species,
  
  // Terrain
  buildEnhancedTerrain,
  getEnhancedTerrainHeight,
  BIOME_COLORS,
  
  // Types
  type DragonType,
  type Dragon,
  type DragonConfig,
  type Tree,
  type TreeConfig,
  type EnhancedTerrainConfig,
};

// Quick setup function for easy integration
export function setupEnhancedGraphics(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement
): AlamatGraphicsEnhancement {
  // Set up renderer for enhanced graphics
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  
  // Create the enhancement system
  const enhancement = createEnhancedGraphicsSystem(scene, canvas);
  
  // Adjust camera for larger map
  if ('position' in camera) {
    camera.position.set(0, 50, 50);
    camera.lookAt(0, 0, 0);
  }
  
  // Set graphics quality based on device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  enhancement.setGraphicsQuality({
    quality: isMobile ? 'medium' : 'high',
    shadowQuality: isMobile ? 'medium' : 'high',
    drawDistance: isMobile ? 150 : 200,
  });
  
  return enhancement;
}