// Performance Optimizer for ALamat MOBA Graphics
//
// This module provides performance optimization features to ensure
// the enhanced graphics run smoothly on mobile devices.
//
// Use this to balance visual quality with performance.

import * as THREE from 'three';

// Performance presets
export const PERFORMANCE_PRESETS = {
  // For high-end devices (desktop, flagships)
  ultra: {
    terrain: {
      segmentCount: Math.floor(280 / 1.2), // ~233 segments per side
      detailScale: 2.0,
      featureCount: 1.0,
    },
    trees: {
      leafletCount: 1.0, // Full detail
      maxTrees: 100,
      giantTreeEffects: true,
    },
    dragons: {
      complexity: 1.0,
      animationQuality: 'high',
    },
    particles: {
      count: 1.0,
      enabled: true,
    },
    shadows: {
      enabled: true,
      resolution: 2048,
    },
    targetFPS: 60,
  },
  
  // For modern mobile devices
  high: {
    terrain: {
      segmentCount: Math.floor(280 / 2.0), // ~140 segments per side
      detailScale: 1.5,
      featureCount: 0.8,
    },
    trees: {
      leafletCount: 0.7,
      maxTrees: 70,
      giantTreeEffects: true,
    },
    dragons: {
      complexity: 0.8,
      animationQuality: 'medium',
    },
    particles: {
      count: 0.8,
      enabled: true,
    },
    shadows: {
      enabled: true,
      resolution: 1024,
    },
    targetFPS: 45,
  },
  
  // For mid-range mobile devices (RECOMMENDED for most users)
  medium: {
    terrain: {
      segmentCount: Math.floor(280 / 3.0), // ~93 segments per side
      detailScale: 1.0,
      featureCount: 0.6,
    },
    trees: {
      leafletCount: 0.5,
      maxTrees: 50,
      giantTreeEffects: false,
    },
    dragons: {
      complexity: 0.6,
      animationQuality: 'medium',
    },
    particles: {
      count: 0.5,
      enabled: true,
    },
    shadows: {
      enabled: true,
      resolution: 512,
    },
    targetFPS: 30,
  },
  
  // For low-end mobile devices
  low: {
    terrain: {
      segmentCount: Math.floor(280 / 4.0), // ~70 segments per side
      detailScale: 0.5,
      featureCount: 0.4,
    },
    trees: {
      leafletCount: 0.3,
      maxTrees: 30,
      giantTreeEffects: false,
    },
    dragons: {
      complexity: 0.4,
      animationQuality: 'low',
    },
    particles: {
      count: 0.2,
      enabled: false,
    },
    shadows: {
      enabled: false,
      resolution: 256,
    },
    targetFPS: 20,
  },
  
  // For very low-end devices or testing
  minimal: {
    terrain: {
      segmentCount: Math.floor(280 / 6.0), // ~47 segments per side
      detailScale: 0.3,
      featureCount: 0.2,
    },
    trees: {
      leafletCount: 0.2,
      maxTrees: 15,
      giantTreeEffects: false,
    },
    dragons: {
      complexity: 0.2,
      animationQuality: 'low',
    },
    particles: {
      count: 0.0,
      enabled: false,
    },
    shadows: {
      enabled: false,
      resolution: 128,
    },
    targetFPS: 15,
  },
};

export type PerformancePreset = keyof typeof PERFORMANCE_PRESETS;
export type PerformanceSettings = typeof PERFORMANCE_PRESETS.ultra;

// Current performance settings
let currentPreset: PerformancePreset = 'medium';
let currentSettings: PerformanceSettings = { ...PERFORMANCE_PRESETS.medium };

// FPS monitoring
export class FPSMonitor {
  private frames: number = 0;
  private lastTime: number = 0;
  private fps: number = 0;
  private history: number[] = [];
  private maxHistory: number = 10;
  private lastFpsUpdate: number = 0;
  private autoAdjust: boolean = true;
  private targetFPS: number = 30;
  
  constructor(targetFPS: number = 30) {
    this.targetFPS = targetFPS;
  }
  
  update(dt: number, clock: number): number {
    this.frames++;
    
    if (clock - this.lastFpsUpdate >= 1.0) {
      this.fps = this.frames / (clock - this.lastFpsUpdate);
      this.history.push(this.fps);
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }
      this.frames = 0;
      this.lastFpsUpdate = clock;
      
      // Auto-adjust quality based on FPS
      if (this.autoAdjust) {
        this.adjustQuality();
      }
    }
    
    return this.fps;
  }
  
  getFPS(): number {
    return this.fps;
  }
  
  getAverageFPS(): number {
    if (this.history.length === 0) return this.fps;
    const sum = this.history.reduce((a, b) => a + b, 0);
    return sum / this.history.length;
  }
  
  setAutoAdjust(enabled: boolean): void {
    this.autoAdjust = enabled;
  }
  
  private adjustQuality(): void {
    const avgFPS = this.getAverageFPS();
    const currentPresetIndex = Object.keys(PERFORMANCE_PRESETS).indexOf(currentPreset);
    const presets = Object.keys(PERFORMANCE_PRESETS) as PerformancePreset[];
    
    // If FPS is too low, downgrade quality
    if (avgFPS < this.targetFPS * 0.7 && currentPresetIndex > 0) {
      const newPreset = presets[Math.max(0, currentPresetIndex - 1)];
      console.log(`FPS too low (${avgFPS.toFixed(1)} < ${this.targetFPS * 0.7}), downgrading to ${newPreset}`);
      setPerformancePreset(newPreset);
      this.targetFPS = PERFORMANCE_PRESETS[newPreset].targetFPS;
    }
    
    // If FPS is good and we're not at highest, upgrade quality
    if (avgFPS > this.targetFPS * 1.2 && currentPresetIndex < presets.length - 1) {
      const newPreset = presets[Math.min(presets.length - 1, currentPresetIndex + 1)];
      console.log(`FPS good (${avgFPS.toFixed(1)} > ${this.targetFPS * 1.2}), upgrading to ${newPreset}`);
      setPerformancePreset(newPreset);
      this.targetFPS = PERFORMANCE_PRESETS[newPreset].targetFPS;
    }
  }
  
  reset(): void {
    this.frames = 0;
    this.lastTime = 0;
    this.fps = 0;
    this.history = [];
    this.lastFpsUpdate = 0;
  }
}

// Initialize FPS monitor
export const fpsMonitor = new FPSMonitor();

// Performance optimization functions
export function setPerformancePreset(preset: PerformancePreset): void {
  currentPreset = preset;
  currentSettings = { ...PERFORMANCE_PRESETS[preset] };
  console.log(`Performance preset set to: ${preset}`);
  console.log(`Settings:`, currentSettings);
}

export function getPerformancePreset(): PerformancePreset {
  return currentPreset;
}

export function getPerformanceSettings(): PerformanceSettings {
  return currentSettings;
}

// Auto-detect device capability
export function detectDeviceCapability(): PerformancePreset {
  // Check if running on mobile
  const isMobile = typeof window !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  
  // Check device memory (if available)
  const deviceMemory = typeof navigator !== 'undefined' ? (navigator as any).deviceMemory : null;
  
  // Check hardware concurrency
  const hardwareConcurrency = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  
  if (!isMobile) {
    return 'high'; // Desktop can usually handle high
  }
  
  // Mobile device detection
  if (deviceMemory && deviceMemory >= 6) {
    return 'high'; // 6GB+ RAM
  }
  
  if (deviceMemory && deviceMemory >= 4) {
    return 'medium'; // 4GB RAM
  }
  
  if (hardwareConcurrency >= 4) {
    return 'medium';
  }
  
  return 'low'; // Default for low-end mobile
}

// Initialize with auto-detection
export function initializePerformance() {
  const detectedPreset = detectDeviceCapability();
  setPerformancePreset(detectedPreset);
  console.log(`Auto-detected performance preset: ${detectedPreset}`);
  return fpsMonitor;
}

// Quick optimization guide for manual adjustments
export const PERFORMANCE_TIPS = {
  'terrain-too-heavy': 'Reduce segmentCount in enhancedTerrain.ts (line 168). Change from /0.8 to /2.0 or /3.0',
  'trees-too-heavy': 'Reduce leafletCount in tree canopies. Acacia: 2000 -> 1000, Narra: 1500 -> 800',
  'dragons-too-heavy': 'Reduce dragon complexity or count. Use smaller models for non-boss dragons',
  'particles-too-heavy': 'Disable ambient particles or reduce count. Set enabled: false in particle systems',
  'shadows-too-heavy': 'Reduce shadow map resolution or disable shadows for mobile',
  
  'recommended-start': 'Start with medium preset, then adjust based on device testing',
  'mobile-default': 'For most mobile devices, use medium or low preset',
  'desktop-default': 'For desktop, use high or ultra preset',
};

export function getOptimizationTips(fps: number): string[] {
  const tips: string[] = [];
  
  if (fps < 15) {
    tips.push('CRITICAL: FPS very low. Try minimal preset');
    tips.push(PERFORMANCE_TIPS['terrain-too-heavy']);
    tips.push(PERFORMANCE_TIPS['trees-too-heavy']);
  } else if (fps < 25) {
    tips.push('LOW: FPS below 25. Try low preset');
    tips.push(PERFORMANCE_TIPS['trees-too-heavy']);
    tips.push(PERFORMANCE_TIPS['dragons-too-heavy']);
  } else if (fps < 35) {
    tips.push('MEDIUM: FPS below 35. Try medium preset');
    tips.push(PERFORMANCE_TIPS['particles-too-heavy']);
  } else if (fps < 45) {
    tips.push('GOOD: FPS acceptable. Current preset is working');
  } else {
    tips.push('EXCELLENT: FPS > 45. You can try higher preset');
  }
  
  return tips;
}
