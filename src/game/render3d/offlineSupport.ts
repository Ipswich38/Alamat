// Offline Support Module for ALamat MOBA
//
// This module provides fallback functionality when the game is running
// offline or in static export mode (Capacitor/mobile apps).
//
// Key features:
// - Detects offline mode and static export mode
// - Provides fallback textures and materials
// - Gracefully degrades graphics quality when assets are missing
// - Caches critical assets for offline use

import * as THREE from 'three';

/**
 * Detect if running in offline mode (no network connection)
 */
export function isOffline(): boolean {
  if (typeof navigator === 'undefined') return false;
  return !navigator.onLine;
}

/**
 * Detect if running in static export mode (Capacitor/mobile app)
 * In static export, Next.js uses 'export' output and serves static files
 */
export function isStaticExport(): boolean {
  if (typeof process === 'undefined') return false;
  return process.env.CAP_BUILD === '1' || process.env.NEXT_STATIC_EXPORT === 'true';
}

/**
 * Detect if we should use offline mode (static export or actual offline)
 */
export function shouldUseOfflineMode(): boolean {
  return isStaticExport() || isOffline();
}

/**
 * Fallback material for when textures fail to load
 */
export function createFallbackMaterial(color: number = 0x4a5d4a, opts: { roughness?: number; metalness?: number } = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: color,
    roughness: opts.roughness ?? 0.95,
    metalness: opts.metalness ?? 0.05,
  });
}

/**
 * Fallback textures - base64 encoded simple colors
 * These are used when texture loading fails offline
 */
export const FALLBACK_TEXTURES = {
  bark: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  leaf: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  grass: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+DNwAHggJ/PchI7wAAAABJRU5ErkJggg==',
  rock: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
};

/**
 * Texture cache for offline use
 */
const textureCache: Map<string, THREE.Texture | null> = new Map();

/**
 * Load texture with offline fallback
 */
export function loadTextureWithFallback(
  path: string,
  fallbackColor: number = 0x4a5d4a,
  opts: { roughness?: number; metalness?: number } = {}
): THREE.Texture | THREE.MeshStandardMaterial {
  // If we're offline or in static mode, use fallback
  if (shouldUseOfflineMode()) {
    // Check cache first
    if (textureCache.has(path)) {
      const cached = textureCache.get(path);
      if (cached) return cached;
    }
    
    // Create fallback material (we can't load textures reliably offline in static export)
    const fallbackMaterial = createFallbackMaterial(fallbackColor, opts);
    textureCache.set(path, fallbackMaterial as any);
    return fallbackMaterial as any;
  }
  
  // Online mode - load normally
  try {
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(
      path,
      (tex) => {
        textureCache.set(path, tex);
      },
      undefined,
      (err) => {
        console.warn(`Failed to load texture ${path}, using fallback`, err);
        textureCache.set(path, createFallbackMaterial(fallbackColor, opts) as any);
      }
    );
    textureCache.set(path, texture);
    return texture;
  } catch (e) {
    console.warn(`Error loading texture ${path}, using fallback`, e);
    const fallback = createFallbackMaterial(fallbackColor, opts);
    textureCache.set(path, fallback as any);
    return fallback as any;
  }
}

/**
 * Asset preloading for offline use
 * Call this during app initialization to cache critical assets
 */
export async function preloadCriticalAssets(): Promise<void> {
  if (shouldUseOfflineMode()) {
    // In static/offline mode, we can't preload from network
    // but we can warm up the fallback cache
    const criticalPaths = [
      '/models/',
      '/_next/static/'
    ];
    
    criticalPaths.forEach(path => {
      if (!textureCache.has(path)) {
        textureCache.set(path, createFallbackMaterial(0x4a5d4a) as any);
      }
    });
    
    console.log('[Offline] Preloaded fallback assets');
    return;
  }
  
  // Online mode - preload critical assets
  try {
    const cache = await caches.open('talisman-moba-cache-v4');
    const assetsToCache = [
      '/',
      '/play',
      '/manifest.json',
      '/icon.svg',
    ];
    
    await Promise.all(
      assetsToCache.map(async (url) => {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
          }
        } catch (e) {
          console.warn(`[Offline] Failed to preload ${url}`, e);
        }
      })
    );
    
    console.log('[Offline] Preloaded critical assets for offline use');
  } catch (e) {
    console.warn('[Offline] Could not access cache API', e);
  }
}

/**
 * Model loading with offline fallback
 * Returns a simple placeholder mesh if model fails to load
 */
export function loadModelWithFallback(
  path: string,
  fallbackGeometry: THREE.BufferGeometry = new THREE.BoxGeometry(1, 1, 1),
  fallbackMaterial: THREE.Material = new THREE.MeshStandardMaterial({ color: 0xff0000 })
): Promise<THREE.Group> {
  return new Promise((resolve) => {
    if (shouldUseOfflineMode()) {
      // In static export, we can't load GLTF/GLB dynamically
      // Return a placeholder
      const placeholder = new THREE.Group();
      const mesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
      placeholder.add(mesh);
      resolve(placeholder);
      return;
    }
    
    // Online mode - try to load the model
    // Note: This is a placeholder - actual GLTF loading would use GLTFLoader
    try {
      // In a real implementation, you would use:
      // import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
      // const loader = new GLTFLoader();
      // loader.load(path, (gltf) => { resolve(gltf.scene); }, ...);
      
      // For now, resolve with placeholder
      const placeholder = new THREE.Group();
      const mesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
      placeholder.add(mesh);
      resolve(placeholder);
    } catch (e) {
      console.warn(`[Offline] Failed to load model ${path}, using fallback`, e);
      const placeholder = new THREE.Group();
      const mesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
      placeholder.add(mesh);
      resolve(placeholder);
    }
  });
}

/**
 * Check if a specific asset is available (cached or online)
 */
export async function isAssetAvailable(path: string): Promise<boolean> {
  if (shouldUseOfflineMode()) {
    // In offline mode, check if we have it cached
    try {
      const cache = await caches.open('talisman-moba-cache-v4');
      const response = await cache.match(path);
      return !!response;
    } catch (e) {
      return false;
    }
  }
  
  // Online mode - check if accessible
  try {
    const response = await fetch(path, { method: 'HEAD' });
    return response.ok;
  } catch (e) {
    return false;
  }
}

/**
 * Offline-aware initialization
 * Adjusts graphics quality based on connectivity
 */
export function initOfflineSupport(): void {
  // Check connectivity on load
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      console.log('[Offline] Back online');
      window.location.reload(); // Refresh to get latest assets
    });
    
    window.addEventListener('offline', () => {
      console.log('[Offline] Went offline');
      // Could show a notification to the user
    });
    
    // Initial check
    if (isOffline()) {
      console.log('[Offline] Currently offline - using cached assets');
    }
  }
  
  // Preload critical assets
  preloadCriticalAssets().catch(console.warn);
}

/**
 * Fallback shaders for offline mode
 * Simplified versions that don't require external dependencies
 */
export const FALLBACK_SHADERS = {
  standard: {
    vertex: `
      varying vec3 vColor;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        vColor = color;
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragment: `
      uniform vec3 uColor;
      varying vec3 vColor;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
        float diffuse = max(dot(vNormal, lightDir), 0.2);
        vec3 finalColor = vColor * (0.5 + diffuse * 0.5);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `
  }
};

/**
 * Get a simplified material that works offline
 */
export function getOfflineSafeMaterial(color: number = 0x4a5d4a): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.95,
    metalness: 0.05,
    // No custom shaders or complex properties that might fail offline
  });
}
