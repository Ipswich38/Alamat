// Mobile Platform Detection & Performance Optimization
//
// Provides automatic performance tuning for mobile devices
// and detection utilities for responsive behavior

import { android } from './android';

export interface MobileConfig {
  isMobile: boolean;
  isTablet: boolean;
  isLowEnd: boolean;
  isHighEnd: boolean;
  reducedMotion: boolean;
  touchOptimized: boolean;
  batterySaver: boolean;
}

export interface PerformanceSettings {
  quality: 'ultra' | 'high' | 'balanced' | 'performance' | 'low';
  shadowQuality: 'high' | 'medium' | 'low' | 'off';
  particleCount: number;
  drawDistance: number;
  textureQuality: 'full' | 'half' | 'quarter';
  usePostProcessing: boolean;
}

/**
 * Default performance settings based on device capabilities
 */
const DEFAULT_SETTINGS: Record<string, PerformanceSettings> = {
  ultra: {
    quality: 'ultra',
    shadowQuality: 'high',
    particleCount: 1000,
    drawDistance: 200,
    textureQuality: 'full',
    usePostProcessing: true
  },
  high: {
    quality: 'high',
    shadowQuality: 'high',
    particleCount: 750,
    drawDistance: 150,
    textureQuality: 'full',
    usePostProcessing: true
  },
  balanced: {
    quality: 'balanced',
    shadowQuality: 'medium',
    particleCount: 500,
    drawDistance: 120,
    textureQuality: 'half',
    usePostProcessing: true
  },
  performance: {
    quality: 'performance',
    shadowQuality: 'low',
    particleCount: 250,
    drawDistance: 80,
    textureQuality: 'half',
    usePostProcessing: false
  },
  low: {
    quality: 'low',
    shadowQuality: 'off',
    particleCount: 100,
    drawDistance: 60,
    textureQuality: 'quarter',
    usePostProcessing: false
  }
};

/**
 * Detect device capabilities and return appropriate configuration
 */
export function detectMobileConfig(): MobileConfig {
  if (typeof navigator === 'undefined') {
    return {
      isMobile: false,
      isTablet: false,
      isLowEnd: false,
      isHighEnd: false,
      reducedMotion: false,
      touchOptimized: false,
      batterySaver: false
    };
  }

  const userAgent = navigator.userAgent || '';
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const deviceMemory = navigator.deviceMemory || 0;
  const hardwareConcurrency = navigator.hardwareConcurrency || 0;
  const connection = navigator.connection || {} as any;

  // Check if reduced motion is preferred
  const mediaQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reducedMotion = mediaQuery?.matches || false;

  // Check battery status if available
  const battery = navigator.getBattery ? navigator.getBattery() : Promise.resolve(null);

  // Check if this is a mobile device
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const hasTouch = maxTouchPoints > 0;
  const isMobileScreen = typeof window !== 'undefined' ? window.innerWidth <= 1024 : false;
  const isMobile = isMobileUA || (hasTouch && isMobileScreen);

  // Check if this is a tablet
  const isTabletUA = /iPad|Android(?!.*Mobile)|Tablet|Silk/i.test(userAgent);
  const isTablet = isTabletUA || (isMobile && typeof window !== 'undefined' && window.innerWidth > 768);

  // Detect low-end devices
  const lowMemory = deviceMemory && deviceMemory <= 2;
  const lowCores = hardwareConcurrency <= 2;
  const slowConnection = connection.effectiveType && ['slow-2g', '2g'].includes(connection.effectiveType);
  const saveData = connection.saveData || false;
  const isLowEnd = lowMemory || lowCores || slowConnection || saveData;

  // Detect high-end devices
  const highMemory = deviceMemory && deviceMemory >= 6;
  const highCores = hardwareConcurrency >= 8;
  const fastConnection = connection.effectiveType && ['4g', '3g'].includes(connection.effectiveType);
  const isHighEnd = highMemory || highCores || fastConnection;

  return {
    isMobile,
    isTablet,
    isLowEnd,
    isHighEnd,
    reducedMotion,
    touchOptimized: isMobile || hasTouch,
    batterySaver: reducedMotion // Will be enhanced with actual battery check below
  };
}

/**
 * Get optimal performance settings based on device configuration
 */
export function getPerformanceSettings(config: MobileConfig): PerformanceSettings {
  if (config.isLowEnd || config.batterySaver) {
    return DEFAULT_SETTINGS.low;
  }
  
  if (config.isMobile) {
    if (config.isHighEnd) {
      return DEFAULT_SETTINGS.high;
    }
    return DEFAULT_SETTINGS.performance;
  }
  
  // Desktop/laptop defaults
  if (config.isHighEnd) {
    return DEFAULT_SETTINGS.ultra;
  }
  
  return DEFAULT_SETTINGS.balanced;
}

/**
 * Get simplified quality setting for the renderer
 */
export function getQualitySetting(config: MobileConfig): 'ultra' | 'high' | 'balanced' | 'performance' | 'low' {
  const settings = getPerformanceSettings(config);
  return settings.quality;
}

/**
 * Apply mobile-specific optimizations to the renderer
 */
export function applyMobileOptimizations(renderer: any, config: MobileConfig): void {
  const settings = getPerformanceSettings(config);
  
  // Adjust pixel ratio for mobile devices to improve performance
  if (config.isMobile && typeof window !== 'undefined') {
    const mobilePixelRatio = Math.min(1.5, window.devicePixelRatio || 1);
    renderer.setPixelRatio(mobilePixelRatio);
  }
  
  // Adjust shadow map quality
  if (settings.shadowQuality === 'off') {
    renderer.shadowMap.enabled = false;
  } else if (settings.shadowQuality === 'low') {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = 0; // THREE.BasicShadowMap
  } else if (settings.shadowQuality === 'medium') {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = 1; // THREE.PCFShadowMap
  } else {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = 2; // THREE.PCFSoftShadowMap
  }
}

/**
 * Initialize mobile detection and optimization
 */
export function initMobileOptimizations(): MobileConfig {
  const config = detectMobileConfig();
  
  // Log configuration for debugging
  if (typeof console !== 'undefined') {
    console.log('[Mobile] Configuration:', config);
    console.log('[Mobile] Performance Settings:', getPerformanceSettings(config));
  }
  
  return config;
}

/**
 * Check if the current device should use touch controls
 */
export function shouldUseTouchControls(): boolean {
  return android.isTouchDevice();
}

/**
 * Check if the current device supports gamepad
 */
export function supportsGamepad(): boolean {
  return typeof navigator !== 'undefined' && 
         navigator.getGamepads !== undefined &&
         android.isMobile();
}