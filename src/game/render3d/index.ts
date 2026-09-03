// Central export for all ALamat graphics enhancements
// This file provides easy access to all new graphics systems

export * from './alamatGraphicsEnhancement';
export * from './dragons';
export * from './philippineTrees';
export * from './enhancedTerrain';
export * from './expandedMap';
export * from './performanceOptimizer';
export * from './offlineSupport';
export * from './fightingEffects';
export * from './cameraController';

// Re-export existing modules for convenience
export * from './stage';
export * from './terrain';
export * from './arena';
export * from './jungle';
export * from './river';
export * from './sky';
export * from './groundcover';
export * from './clutter';
export * from './towers';
export * from './bosses';
export * from './minions';
export * from './nexus';
export * from './creeps';
export * from './camps';
export * from './walls';
export * from './actor';
export * from './grade';
export * from './ambientParticles';
export * from './reticles';
export * from './damageNumbers';
export * from './wards';
export * from './wisp';
export * from './models';
export * from './backdrop';
export * from './raidMonsters';

// Main graphics enhancement class
export { AlamatGraphicsEnhancement } from './alamatGraphicsEnhancement';

// Setup function for easy initialization
export { setupEnhancedGraphics } from './alamatGraphicsEnhancement';

// Dragon system
export { 
  createDragon,
  DRAGON_BOSSES,
  DRAGON_COLORS,
} from './dragons';

// Philippine Trees system  
export { 
  createPhilippineTree,
  createGiantTreeLocations,
  createTreeGrove,
  PH_TREE_Species,
} from './philippineTrees';

// Enhanced Terrain system
export { 
  buildEnhancedTerrain,
  getEnhancedTerrainHeight,
  BIOME_COLORS,
} from './enhancedTerrain';

// Expanded Map system
export { 
  createExpandedMap,
  createCustomExpandedMap,
  getExpandedMapBounds,
  isWithinExpandedMap,
  getExpandedMapHeight,
} from './expandedMap';

// Fighting Effects system
export type { 
  FightingEffect,
  EffectType,
  StatusEffectType,
  EffectConfig,
  ProjectileConfig,
} from './fightingEffects';

export { 
  EffectManager,
  globalEffectManager,
  createSlashEffect,
  createImpactFlash,
  createBloodSplatter,
  createScreenShake,
  createFireballEffect,
  createLightningBolt,
  createHealingEffect,
  createDragonBreath,
  createAoEIndicator,
  createExplosionEffect,
  createStatusEffect,
  createStunnedEffect,
  createDeathEffect,
  createSoulAscension,
  createDragonAttackEffect,
  FightingEffectsSystem,
  globalFightingEffects,
  initializeFightingEffects,
} from './fightingEffects';

// Camera Controller system
export type { 
  CameraPreset,
  CameraTarget,
  CombatState,
  CameraMode,
  CharacterPortrait,
  ActiveShake,
} from './cameraController';

export { 
  CameraController,
  createCameraController,
  CameraAnimation,
  smoothLookAt,
  calculateCameraDistance,
  clamp,
  lerp,
  lerpVector3,
  ZoomReactionSystem,
  createZoomReactionSystem,
} from './cameraController';

// Type exports for TypeScript support
export type {
  Dragon,
  DragonType,
  DragonConfig,
  DragonAnimation,
} from './dragons';

export type {
  Tree,
  TreeConfig,
  TreeSpecies,
} from './philippineTrees';

export type {
  EnhancedTerrainConfig,
  TerrainFeature,
} from './enhancedTerrain';

export type {
  ExpandedMap,
} from './expandedMap';

export type {
  GraphicsSettings,
} from './alamatGraphicsEnhancement';