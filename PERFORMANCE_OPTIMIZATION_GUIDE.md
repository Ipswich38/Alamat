# Performance Optimization Guide for ALamat MOBA

## Why the Game is Slow

The graphics enhancements add significant visual fidelity but also increase the rendering load:

### Primary Performance Bottlenecks:

1. **Terrain Geometry**
   - Original: 700x700 segments = 490,000 vertices
   - Each vertex has position, normal, UV, color, AO factor, slope factor, biome type attributes
   - **Impact**: High memory usage, slow GPU processing

2. **Tree Leaflets**
   - Acacia: 2000 leaflets per tree
   - Narra: 1500 leaflets per tree  
   - Ipil-Ipil: 3000 leaflets per tree
   - With 5+ giant trees and 20+ grove trees = 50,000+ mesh instances
   - **Impact**: High draw calls, fill rate bottleneck

3. **Dragons**
   - High-poly models with animated scales
   - Multiple dragons with complex shaders
   - **Impact**: CPU skinning, GPU rendering

4. **Special Effects**
   - Particle systems (ambient particles, dragon lair effects, shrine effects)
   - Emissive materials
   - **Impact**: Overdraw, blending operations

5. **Map Size**
   - 7.5x larger area = more geometry, more culling calculations
   - **Impact**: Frustum culling overhead

---

## Performance Solutions

### Option 1: Automatic Performance Adjustment (Recommended)

```typescript
import { initializePerformance, setPerformancePreset, PERFORMANCE_PRESETS } from '@/game/render3d/performanceOptimizer';

// Initialize with auto-detection
const fpsMonitor = initializePerformance();

// Or manually set based on device
setPerformancePreset('medium'); // Recommended for most mobile devices
```

The FPS monitor will automatically adjust quality settings based on actual FPS.

### Option 2: Manual Quality Settings

**For Mobile Devices (Recommended):**
```typescript
import { setPerformancePreset } from '@/game/render3d/performanceOptimizer';

setPerformancePreset('medium'); // or 'low' for older devices
```

**Preset Comparison:**

| Preset | Terrain Segments | Tree Leaflets | Max Trees | Max Dragons | Shadows | Target FPS |
|--------|-----------------|---------------|-----------|-------------|---------|------------|
| ultra | ~233/side | 100% | 100 | Unlimited | 2048px | 60 |
| high | ~140/side | 70% | 70 | 35 | 1024px | 45 |
| **medium** | **~93/side** | **50%** | **50** | **25** | **512px** | **30** |
| low | ~70/side | 30% | 30 | 15 | Disabled | 20 |
| minimal | ~47/side | 20% | 15 | 5 | Disabled | 15 |

---

## Manual Optimization Steps

### If You Still Experience Lag:

#### 1. Reduce Terrain Complexity (Biggest Impact)

In `src/game/render3d/enhancedTerrain.ts`, line 168:
```typescript
// Change from:
const segmentCount = Math.floor(totalSize / 0.8);

// To (for mobile):
const segmentCount = Math.floor(totalSize / 3.0); // 3x less vertices
```

#### 2. Reduce Tree Detail

In `src/game/render3d/philippineTrees.ts`:
- **Acacia**: Reduce from 2000 to 1000 leaflets
- **Narra**: Reduce from 1500 to 800 leaflets
- **Ipil-Ipil**: Reduce from 3000 to 1500 leaflets

Or use the performance presets which handle this automatically.

#### 3. Reduce Tree Count

In `src/game/render3d/expandedMap.ts`:
- Limit giant trees to 3-5 instead of all 5
- Limit grove trees to 10-15 per grove instead of 6-10

#### 4. Disable Heavy Effects

```typescript
// Disable ambient particles
const ambientParticles = false;

// Disable emissive materials (expensive on mobile)
const useEmissive = false;

// Disable shadows for mobile
renderer.shadowMap.enabled = false;
```

#### 5. Reduce Dragon Count

```typescript
// Only spawn boss dragons, skip regular ones
const dragonSpawns = createDragonSpawnPoints().filter(s => s.isBoss);
```

---

## Quick Fix Commands

### For Mobile Testing:
```bash
# Set medium preset before running
node -e "require('./src/game/render3d/performanceOptimizer.ts').setPerformancePreset('medium')"
npm run dev
```

### For Low-End Devices:
```bash
node -e "require('./src/game/render3d/performanceOptimizer.ts').setPerformancePreset('low')"
npm run dev
```

---

## Performance Monitoring

```typescript
import { fpsMonitor } from '@/game/render3d/performanceOptimizer';

// In your game loop:
function animate() {
  requestAnimationFrame(animate);
  
  const fps = fpsMonitor.update(dt, clock);
  console.log(`FPS: ${fps.toFixed(1)}`);
  
  if (fps < 20) {
    console.warn('Performance warning: FPS below 20!');
  }
}
```

---

## Recommended Starting Configuration

For **Mobile Legends quality** on **modern mobile devices**:

```typescript
// In your initialization code:
import { setPerformancePreset, initializePerformance } from '@/game/render3d/performanceOptimizer';

// Auto-detect or manually set
setPerformancePreset('medium');

// Initialize FPS monitoring
const monitor = initializePerformance();

// The system will auto-adjust if FPS drops
```

This gives you:
- Good visual quality (50% of maximum detail)
- ~30 FPS target on mid-range mobile
- Automatic quality adjustment
- All key features enabled (dragons, trees, terrain)

---

## Troubleshooting

### Symptom: Game stutters on mobile
**Fix**: Set preset to 'low' or 'minimal'

### Symptom: Long loading times
**Fix**: Reduce tree leaflet counts, disable giant tree effects

### Symptom: Device overheating
**Fix**: Set preset to 'low', disable particles and emissive materials

### Symptom: Graphics glitches
**Fix**: Ensure your device supports WebGL 2.0, try 'medium' preset

---

## Advanced: Custom Presets

Create your own performance preset:

```typescript
import { PERFORMANCE_PRESETS } from '@/game/render3d/performanceOptimizer';

const customPreset = {
  ...PERFORMANCE_PRESETS.medium,
  terrain: {
    ...PERFORMANCE_PRESETS.medium.terrain,
    segmentCount: Math.floor(280 / 2.5), // Custom terrain detail
  },
  trees: {
    ...PERFORMANCE_PRESETS.medium.trees,
    leafletCount: 0.4, // 40% leaf detail
    maxTrees: 40,
  }
};

// Apply your custom preset
setPerformancePreset('medium'); // Start with base
// Then manually adjust individual settings
```

---

## Performance Metrics

| Device Type | Recommended Preset | Expected FPS | Terrain Vertices | Tree Leaflets |
|-------------|-------------------|---------------|----------------|---------------|
| Desktop (High-end) | ultra | 60+ | 490,000 | Full |
| Desktop (Mid-range) | high | 50-60 | 196,000 | 70% |
| **Mobile (Flagship)** | **high** | **45-50** | **196,000** | **70%** |
| **Mobile (Mid-range)** | **medium** | **30-40** | **84,000** | **50%** |
| **Mobile (Low-end)** | **low** | **20-30** | **49,000** | **30%** |
| Mobile (Very Low-end) | minimal | 15-20 | 22,000 | 20% |
