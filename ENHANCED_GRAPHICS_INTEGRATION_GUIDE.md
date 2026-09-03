
// ============================================
// ALamat Enhanced Graphics Integration Examples
// ============================================

// EXAMPLE 1: Quick Start (5-minute integration)
// Add to Arena3D.tsx

import { setupEnhancedGraphics } from '@/game/render3d/alamatGraphicsEnhancement';

// Inside useEffect, after stage creation:
const enhancement = setupEnhancedGraphics(stage.renderer, stage.scene, stage.camera, canvas);

// Add enhanced terrain instead of or alongside existing terrain
// Option A: Replace existing terrain
// stage.scene.remove(terrain); // Remove old terrain
stage.scene.add(enhancement.getExpandedMap().terrain);

// Clean up on unmount
return () => {
  enhancement.dispose();
};


// EXAMPLE 2: Add Dragons to Existing Map
// Add to Arena3D.tsx

import { createDragon } from '@/game/render3d/dragons';

// Inside useEffect:
const dragon = createDragon({
  type: 'bakunawa',
  size: 3,
  position: { x: -50, y: 5, z: -50 },
  isBoss: true,
  name: 'Bakunawa Dragon'
});
stage.scene.add(dragon.group);

// Update in animation loop
dragon.update(deltaTime, clock, { x: px, z: pz });


// EXAMPLE 3: Add Giant Trees
// Add to Arena3D.tsx

import { createPhilippineTree, createGiantTreeLocations } from '@/game/render3d/philippineTrees';

// Inside useEffect:
const treeLocations = createGiantTreeLocations();
treeLocations.forEach(treeConfig => {
  const tree = createPhilippineTree(treeConfig);
  stage.scene.add(tree.group);
});

// Update in animation loop
trees.forEach(tree => tree.update(deltaTime, clock));


// EXAMPLE 4: Enhanced Camera for Larger Map
// Modify camera setup in Arena3D.tsx

// Change camera position for larger map
camera.position.set(0, 70, 70); // Higher for larger map
camera.lookAt(0, 0, 0);

// Or use the enhanced map's camera settings
const mapBounds = enhancement.getMapBounds();
const mapSize = Math.max(mapBounds.maxX - mapBounds.minX, mapBounds.maxZ - mapBounds.minZ);
camera.position.set(0, mapSize * 0.8, mapSize * 0.8);


// EXAMPLE 5: Add Interactive Features
// Add to Arena3D.tsx

// Check if player is near a dragon
const dragonProximity = Math.hypot(px - dragon.group.position.x, pz - dragon.group.position.z);
if (dragonProximity < 10) {
  dragon.setAnimation('attack');
  setCombatLine('Dragon nearby!');
}

// Check terrain height for player positioning
const terrainHeight = enhancement.getTerrainHeight(px, pz);
// Use this for realistic player positioning


// ============================================
// Configuration Options
// ============================================

// High performance (desktop)
enhancement.setGraphicsQuality({
  quality: 'ultra',
  shadowQuality: 'high',
  effectsEnabled: true,
  animationsEnabled: true,
  drawDistance: 250,
  windIntensity: 0.8
});

// Balanced (laptop)
enhancement.setGraphicsQuality({
  quality: 'high',
  shadowQuality: 'medium',
  effectsEnabled: true,
  animationsEnabled: true,
  drawDistance: 200,
  windIntensity: 0.5
});

// Performance (mobile)
enhancement.setGraphicsQuality({
  quality: 'medium',
  shadowQuality: 'low',
  effectsEnabled: false,
  animationsEnabled: true,
  drawDistance: 150,
  windIntensity: 0.3
});

// Minimum (low-end devices)
enhancement.setGraphicsQuality({
  quality: 'low',
  shadowQuality: 'low',
  effectsEnabled: false,
  animationsEnabled: false,
  drawDistance: 100,
  windIntensity: 0
});


// ============================================
// Debugging & Testing
// ============================================

// Log FPS
dragon.group.userData.debugName = 'Bakunawa Dragon';
console.log('Dragon created:', dragon.group.userData.debugName);

// Check if position is within map
if (!enhancement.isWithinBounds(targetX, targetZ)) {
  console.warn('Position out of bounds:', targetX, targetZ);
}

// Get map bounds
const bounds = enhancement.getMapBounds();
console.log('Map bounds:', bounds);
