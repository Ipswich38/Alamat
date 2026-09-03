#!/usr/bin/env node

/**
 * ALamat Enhanced Graphics Deployment Script
 * 
 * This script helps integrate the new graphics enhancements with the existing game.
 * Run: node deploy-enhanced-graphics.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = __dirname;

console.log('🚀 ALamat Graphics Enhancement Deployment');
console.log('='.repeat(50));

// Step 1: Verify all new files exist
console.log('📋 Checking new graphics files...');

const newFiles = [
  'src/game/render3d/dragons.ts',
  'src/game/render3d/philippineTrees.ts', 
  'src/game/render3d/enhancedTerrain.ts',
  'src/game/render3d/expandedMap.ts',
  'src/game/render3d/alamatGraphicsEnhancement.ts',
  'src/game/render3d/index.ts',
  'GRAPHICS_ENHANCEMENT_SUMMARY.md'
];

let allFilesExist = true;
for (const file of newFiles) {
  const filePath = path.join(PROJECT_ROOT, file);
  try {
    await fs.access(filePath);
    console.log(`  ✅ ${file}`);
  } catch {
    console.log(`  ❌ ${file} - MISSING`);
    allFilesExist = false;
  }
}

if (!allFilesExist) {
  console.log('\n❌ Some files are missing. Please ensure all graphics enhancement files are present.');
  process.exit(1);
}

console.log('\n✅ All graphics enhancement files are present!\n');

// Step 2: Check for existing render3d files
console.log('📋 Checking existing render3d files...');

const existingFiles = [
  'src/game/render3d/stage.ts',
  'src/game/render3d/terrain.ts',
  'src/game/render3d/arena.ts',
  'src/game/render3d/jungle.ts',
  'src/game/render3d/river.ts'
];

for (const file of existingFiles) {
  const filePath = path.join(PROJECT_ROOT, file);
  try {
    await fs.access(filePath);
    console.log(`  ✅ ${file}`);
  } catch {
    console.log(`  ⚠️  ${file} - NOT FOUND (may be normal)`);
  }
}

console.log('\n✅ Existing files check complete!\n');

// Step 3: Create backup of original terrain.ts if enhanced integration is desired
console.log('💾 Creating backups...');

try {
  const terrainPath = path.join(PROJECT_ROOT, 'src/game/render3d/terrain.ts');
  const backupPath = path.join(PROJECT_ROOT, 'src/game/render3d/terrain.backup.ts');
  
  await fs.copyFile(terrainPath, backupPath);
  console.log('  ✅ Created backup of terrain.ts');
} catch (error) {
  console.log('  ⚠️  Could not create terrain.ts backup (file may not exist or already backed up)');
}

console.log('\n✅ Backup process complete!\n');

// Step 4: Generate deployment options
console.log('🎯 DEPLOYMENT OPTIONS:');
console.log('');
console.log('Option 1: QUICK START (Recommended)');
console.log('  Add this to your Arena3D.tsx initialization:');
console.log('');
console.log('  import { setupEnhancedGraphics } from "@/game/render3d/alamatGraphicsEnhancement";');
console.log('  // After creating stage:');
console.log('  const enhancement = setupEnhancedGraphics(stage.renderer, stage.scene, stage.camera, canvasRef.current);');
console.log('');
console.log('  // Then replace:');
console.log('  // const terrain = buildTerrain();');
console.log('  // stage.scene.add(terrain);');
console.log('  // With:');
console.log('  stage.scene.add(enhancement.getExpandedMap().terrain);');
console.log('');

console.log('Option 2: GRADUAL INTEGRATION');
console.log('  Use individual components separately:');
console.log('');
console.log('  // Add dragons only');
console.log('  import { createDragon } from "@/game/render3d/dragons";');
console.log('  const dragon = createDragon({ type: "bakunawa", size: 4, position: { x: 0, y: 2, z: 0 }, isBoss: true });');
console.log('  stage.scene.add(dragon.group);');
console.log('');
console.log('  // Add trees only');
console.log('  import { createPhilippineTree } from "@/game/render3d/philippineTrees";');
console.log('  const tree = createPhilippineTree({ species: "narra", position: { x: 10, z: 10 }, isGiant: true });');
console.log('  stage.scene.add(tree.group);');
console.log('');

console.log('Option 3: FULL INTEGRATION');
console.log('  Replace existing terrain with enhanced version:');
console.log('');
console.log('  import { createExpandedMap } from "@/game/render3d/expandedMap";');
console.log('  const expandedMap = createExpandedMap();');
console.log('  stage.scene.add(expandedMap.group);');
console.log('  // Remove existing terrain creation');
console.log('');

console.log('Option 4: NEW ROUTE');
console.log('  Create a new play mode with enhanced graphics:');
console.log('');
console.log('  // In src/app/enhanced-play/page.tsx');
console.log('  import { createExpandedMap } from "@/game/render3d/expandedMap";');
console.log('  // Create a new Arena3D component that uses enhanced graphics');
console.log('');

console.log('='.repeat(50));
console.log('🎯 RECOMMENDED DEPLOYMENT PATH');
console.log('='.repeat(50));
console.log('');
console.log('Step 1: Test with Option 2 (Gradual Integration)');
console.log('  - Add dragons to existing map');
console.log('  - Add trees to existing map');
console.log('  - Test performance and compatibility');
console.log('');
console.log('Step 2: Integrate with Option 3 (Full Integration)');
console.log('  - Replace terrain with enhanced terrain');
console.log('  - Keep existing game logic');
console.log('  - Test all game systems');
console.log('');
console.log('Step 3: Add new features');
console.log('  - Dragon combat mechanics');
console.log('  - Tree interactions (hiding, fruit collection)');
console.log('  - New biome-based gameplay');
console.log('');

// Step 5: Check TypeScript configuration
console.log('🔍 Checking TypeScript configuration...');

try {
  const tsConfigPath = path.join(PROJECT_ROOT, 'tsconfig.json');
  const tsConfig = JSON.parse(await fs.readFile(tsConfigPath, 'utf8'));
  
  if (tsConfig.compilerOptions && tsConfig.compilerOptions.paths) {
    console.log('  ✅ TypeScript paths configured');
  } else {
    console.log('  ℹ️  TypeScript paths not configured (using default)');
  }
  
  if (tsConfig.compilerOptions && tsConfig.compilerOptions.strict) {
    console.log('  ✅ TypeScript strict mode enabled');
  }
} catch (error) {
  console.log('  ⚠️  Could not read tsconfig.json');
}

console.log('\n✅ Configuration check complete!\n');

// Step 6: Generate a sample integration file
console.log('📄 Creating integration examples...');

const integrationExamples = `
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
`;

try {
  await fs.writeFile(
    path.join(PROJECT_ROOT, 'ENHANCED_GRAPHICS_INTEGRATION_GUIDE.md'),
    integrationExamples
  );
  console.log('  ✅ Created ENHANCED_GRAPHICS_INTEGRATION_GUIDE.md');
} catch (error) {
  console.log('  ⚠️  Could not create integration guide');
}

console.log('\n' + '='.repeat(50));
console.log('✅ DEPLOYMENT PREPARATION COMPLETE!');
console.log('='.repeat(50));
console.log('');
console.log('📖 NEXT STEPS:');
console.log('');
console.log('1. Review GRAPHICS_ENHANCEMENT_SUMMARY.md for complete feature list');
console.log('2. Review ENHANCED_GRAPHICS_INTEGRATION_GUIDE.md for code examples');
console.log('3. Start with Option 1 or 2 for quick testing');
console.log('4. Test on target devices');
console.log('5. Gradually integrate more features');
console.log('');
console.log('🎮 TO TEST THE ENHANCEMENTS:');
console.log('');
console.log('  npm run dev');
console.log('  Open /play in browser');
console.log('');
console.log('  The enhancements will be visible as:');
console.log('  - Much larger map with diverse terrain');
console.log('  - Dragons roaming the map');
console.log('  - Giant Philippine trees');
console.log('  - Multiple biomes (forest, volcanic, river, mountain, jungle)');
console.log('');

console.log('✨ Graphics enhancement deployment is ready! ✨');