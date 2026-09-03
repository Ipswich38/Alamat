// Fighting Effects System for ALamat MOBA
//
// Provides Mobile Legends-quality visual combat effects including:
// - Melee attack effects (slashes, impacts)
// - Spell/ability effects (fireballs, lightning, healing)
// - Ultimate ability effects (dragon breath, AoE indicators)
// - Status effects (burning, frozen, poisoned, stunned)
// - Death effects (explosions, soul ascension)
//
// Integrates with performance optimizer for quality scaling

import * as THREE from 'three';
import { getPerformancePreset, PerformancePreset } from './performanceOptimizer';
import { shouldUseOfflineMode } from './offlineSupport';

// Effect quality settings based on performance
const EFFECT_QUALITY: Record<PerformancePreset, {
  maxParticles: number;
  detailLevel: 'low' | 'medium' | 'high';
  complexity: number;
  enabled: boolean;
}> = {
  ultra: { maxParticles: 2000, detailLevel: 'high', complexity: 1.0, enabled: true },
  high: { maxParticles: 1500, detailLevel: 'high', complexity: 0.8, enabled: true },
  medium: { maxParticles: 1000, detailLevel: 'medium', complexity: 0.6, enabled: true },
  low: { maxParticles: 500, detailLevel: 'low', complexity: 0.4, enabled: true },
  minimal: { maxParticles: 200, detailLevel: 'low', complexity: 0.2, enabled: false },
};

/**
 * Base interface for all fighting effects
 */
export interface FightingEffect {
  group: THREE.Group;
  name: string;
  type: EffectType;
  update: (dt: number, clock: number) => void;
  dispose: () => void;
  isComplete: boolean;
}

/**
 * Types of fighting effects
 */
export type EffectType = 
  | 'melee'
  | 'spell' 
  | 'ultimate'
  | 'status'
  | 'death'
  | 'impact'
  | 'projectile';

/**
 * Status effect types for character debuffs/buffs
 */
export type StatusEffectType = 
  | 'burning'    // Fire particles on character
  | 'frozen'     // Ice particles
  | 'poisoned'   // Green toxic particles  
  | 'stunned'    // Yellow stars above head
  | 'healing'    // Green healing particles
  | 'shielded'   // Blue shield particles
  | 'hasted'     // White/yellow speed particles
  | 'cursed';    // Purple dark particles

/**
 * Configuration for creating fighting effects
 */
export interface EffectConfig {
  position?: THREE.Vector3;
  target?: THREE.Vector3;
  color?: number;
  size?: number;
  duration?: number;
  intensity?: number;
  preset?: PerformancePreset;
}

/**
 * Projectile configuration
 */
export interface ProjectileConfig extends EffectConfig {
  start: THREE.Vector3;
  target: THREE.Vector3;
  speed: number;
  onHit?: () => void;
  onComplete?: () => void;
  homing?: boolean; // If projectile should track target
  gravity?: number; // For arched projectiles
}

/**
 * Effect manager for handling multiple simultaneous effects
 */
export class EffectManager {
  private effects: FightingEffect[] = [];
  private particlePool: THREE.Object3D[] = [];
  private maxParticles: number = 1000;
  
  constructor() {
    this.updateSettings();
  }
  
  /**
   * Update settings based on current performance preset
   */
  updateSettings(): void {
    const currentPreset = getPerformancePreset();
    const quality = EFFECT_QUALITY[currentPreset];
    this.maxParticles = quality.maxParticles;
  }
  
  /**
   * Add an effect to the manager
   */
  addEffect(effect: FightingEffect): void {
    this.effects.push(effect);
  }
  
  /**
   * Remove completed effects
   */
  cleanup(): void {
    this.effects = this.effects.filter(effect => !effect.isComplete);
  }
  
  /**
   * Update all active effects
   */
  update(dt: number, clock: number): void {
    for (const effect of this.effects) {
      effect.update(dt, clock);
    }
    this.cleanup();
  }
  
  /**
   * Dispose all effects and cleanup
   */
  dispose(): void {
    for (const effect of this.effects) {
      effect.dispose();
    }
    this.effects = [];
    this.particlePool = [];
  }
  
  /**
   * Get active effect count
   */
  getEffectCount(): number {
    return this.effects.length;
  }
  
  /**
   * Get particle count across all effects
   */
  getParticleCount(): number {
    let count = 0;
    for (const effect of this.effects) {
      // Count child objects in effect group
      effect.group.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
          count++;
        }
      });
    }
    return count;
  }
}

/**
 * Create a global effect manager instance
 */
export const globalEffectManager = new EffectManager();

// ============================================
// CORE EFFECT FUNCTIONS
// ============================================

/**
 * Create a particle system for various effects
 */
function createParticleSystem(
  texture: THREE.Texture | null = null,
  particleCount: number = 100,
  size: number = 0.1,
  color: number = 0xffff00
): THREE.Points {
  // Fallback texture for offline mode or when texture loading fails
  if (!texture && shouldUseOfflineMode()) {
    texture = createFallbackParticleTexture();
  }
  
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  
  // Initialize particles
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 2;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 2;
    
    colors[i * 3] = ((color >> 16) & 0xFF) / 255;
    colors[i * 3 + 1] = ((color >> 8) & 0xFF) / 255;
    colors[i * 3 + 2] = (color & 0xFF) / 255;
    
    sizes[i] = size;
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  
  const material = new THREE.PointsMaterial({
    size: size,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    map: texture,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  
  return new THREE.Points(geometry, material);
}

/**
 * Create a fallback particle texture for offline mode
 */
function createFallbackParticleTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  
  // Create a simple white circle
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// ============================================
// MELEE ATTACK EFFECTS
// ============================================

/**
 * Create a sword slash effect with particle trails
 */
export function createSlashEffect(
  start: THREE.Vector3,
  end: THREE.Vector3,
  color: number = 0xffff00,
  duration: number = 0.3,
  width: number = 0.1
): FightingEffect {
  const group = new THREE.Group();
  const startTime = Date.now();
  
  // Create the slash line
  const points = [];
  const segments = 20;
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = THREE.MathUtils.lerp(start.x, end.x, t);
    const y = THREE.MathUtils.lerp(start.y, end.y, t) + Math.sin(t * Math.PI) * 0.1;
    const z = THREE.MathUtils.lerp(start.z, end.z, t);
    points.push(new THREE.Vector3(x, y, z));
  }
  
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  
  // Create a tapered line material
  const material = new THREE.LineBasicMaterial({
    color: color,
    transparent: true,
    opacity: 1.0,
    linewidth: 10,
  });
  
  const line = new THREE.Line(geometry, material);
  group.add(line);
  
  // Add glow effect using sprite
  const spriteGeometry = new THREE.BufferGeometry();
  const spriteMaterial = new THREE.SpriteMaterial({
    color: color,
    transparent: true,
    opacity: 0.6,
  });
  
  const midPoint = new THREE.Vector3(
    (start.x + end.x) / 2,
    (start.y + end.y) / 2 + 0.1,
    (start.z + end.z) / 2
  );
  
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.position.copy(midPoint);
  group.add(sprite);
  
  let isComplete = false;
  
  return {
    group,
    name: 'slash_effect',
    type: 'melee',
    update(dt: number, clock: number) {
      if (isComplete) return;
      
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = elapsed / duration;
      
      if (progress >= 1) {
        isComplete = true;
        return;
      }
      
      // Fade out effect
      const fadeProgress = Math.min(1, progress * 2);
      material.opacity = 1 - fadeProgress;
      spriteMaterial.opacity = 0.6 * (1 - progress);
      sprite.scale.setScalar(width * 2 * (1 - progress));
      
      // Animate sprite along the slash path
      const spriteProgress = Math.sin(progress * Math.PI);
      sprite.position.set(
        THREE.MathUtils.lerp(start.x, end.x, progress),
        THREE.MathUtils.lerp(start.y, end.y, progress) + spriteProgress * 0.1,
        THREE.MathUtils.lerp(start.z, end.z, progress)
      );
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      spriteGeometry.dispose();
      spriteMaterial.dispose();
      group.remove(line);
      group.remove(sprite);
      isComplete = true;
    },
    isComplete: false,
  };
}

/**
 * Create an impact spark/flash effect
 */
export function createImpactFlash(
  position: THREE.Vector3,
  color: number = 0xffff00,
  radius: number = 2,
  duration: number = 0.2,
  sparkCount: number = 15
): FightingEffect {
  const group = new THREE.Group();
  const startTime = Date.now();
  
  // Create main flash sphere
  const flashGeometry = new THREE.SphereGeometry(radius * 0.5, 16, 16);
  const flashMaterial = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });
  const flashSphere = new THREE.Mesh(flashGeometry, flashMaterial);
  flashSphere.position.copy(position);
  group.add(flashSphere);
  
  // Create spark particles
  const sparks: THREE.Mesh[] = [];
  const sparkGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  
  for (let i = 0; i < sparkCount; i++) {
    const sparkMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 1.0,
    });
    const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
    
    // Random direction from center
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius * 0.8;
    const velocity = new THREE.Vector3(
      Math.cos(angle) * distance,
      Math.random() * radius * 0.3,
      Math.sin(angle) * distance
    );
    
    spark.position.copy(position);
    spark.userData = { velocity, startTime: Date.now(), lifetime: duration * 0.8 };
    group.add(spark);
    sparks.push(spark);
  }
  
  let isComplete = false;
  
  return {
    group,
    name: 'impact_flash',
    type: 'impact',
    update(dt: number, clock: number) {
      if (isComplete) return;
      
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = elapsed / duration;
      
      if (progress >= 1) {
        isComplete = true;
        return;
      }
      
      // Update flash sphere
      flashMaterial.opacity = 0.8 * (1 - progress * 2);
      flashSphere.scale.setScalar(1 - progress);
      
      // Update spark particles
      const sparkDuration = duration * 0.8;
      for (const spark of sparks) {
        const sparkElapsed = (Date.now() - spark.userData.startTime) / 1000;
        const sparkProgress = sparkElapsed / sparkDuration;
        
        if (sparkProgress >= 1) {
          (spark.material as THREE.Material).opacity = 0;
        } else {
          (spark.material as THREE.Material).opacity = 1 - sparkProgress;
          spark.position.add(spark.userData.velocity.clone().multiplyScalar(dt));
          spark.position.y -= 9.8 * dt * 0.1; // Simple gravity
        }
      }
    },
    dispose() {
      flashGeometry.dispose();
      flashMaterial.dispose();
      sparkGeometry.dispose();
      for (const spark of sparks) {
        (spark.material as THREE.Material).dispose();
      }
      isComplete = true;
    },
    isComplete: false,
  };
}

/**
 * Create a blood splatter effect (optional, can be disabled)
 */
export function createBloodSplatter(
  position: THREE.Vector3,
  direction: THREE.Vector3 = new THREE.Vector3(0, 1, 0),
  count: number = 8,
  color: number = 0x8b0000,
  duration: number = 1.0
): FightingEffect {
  const group = new THREE.Group();
  const startTime = Date.now();
  
  const bloodDrops: THREE.Mesh[] = [];
  const bloodGeometry = new THREE.BoxGeometry(0.1, 0.05, 0.1);
  
  for (let i = 0; i < count; i++) {
    const bloodMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9,
    });
    const drop = new THREE.Mesh(bloodGeometry, bloodMaterial);
    
    // Random direction with some spread
    const spread = 0.3;
    const dropDirection = direction.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread
    )).normalize();
    
    drop.userData = {
      velocity: dropDirection.multiplyScalar(Math.random() * 5 + 2),
      rotationSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      ),
      startTime: Date.now(),
      lifetime: duration
    };
    
    drop.position.copy(position);
    drop.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    group.add(drop);
    bloodDrops.push(drop);
  }
  
  let isComplete = false;
  
  return {
    group,
    name: 'blood_splatter',
    type: 'melee',
    update(dt: number, clock: number) {
      if (isComplete) return;
      
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = elapsed / duration;
      
      if (progress >= 1) {
        isComplete = true;
        return;
      }
      
      for (const drop of bloodDrops) {
        const dropElapsed = (Date.now() - drop.userData.startTime) / 1000;
        const dropProgress = dropElapsed / drop.userData.lifetime;
        
        if (dropProgress >= 1) {
          (drop.material as THREE.Material).opacity = 0;
        } else {
          (drop.material as THREE.Material).opacity = 0.9 * (1 - dropProgress * 2);
          drop.position.add(drop.userData.velocity.clone().multiplyScalar(dt));
          drop.position.y -= 9.8 * dt * 0.2; // Gravity
          drop.rotation.x += drop.userData.rotationSpeed.x * dt;
          drop.rotation.y += drop.userData.rotationSpeed.y * dt;
          drop.rotation.z += drop.userData.rotationSpeed.z * dt;
        }
      }
    },
    dispose() {
      bloodGeometry.dispose();
      for (const drop of bloodDrops) {
        (drop.material as THREE.Material).dispose();
      }
      isComplete = true;
    },
    isComplete: false,
  };
}

/**
 * Create screen shake effect (to be applied to camera)
 */
export function createScreenShake(
  intensity: number = 0.1,
  duration: number = 0.3,
  frequency: number = 30
): { shake: boolean; intensity: number; duration: number; frequency: number; startTime: number } {
  return {
    shake: true,
    intensity,
    duration,
    frequency,
    startTime: Date.now()
  };
}

// ============================================
// SPELL/ABILITY EFFECTS
// ============================================

/**
 * Create a fireball with smoke trail
 */
export function createFireballEffect(
  start: THREE.Vector3,
  target: THREE.Vector3,
  speed: number = 20,
  color: number = 0xff4500,
  size: number = 1.0,
  onHit: (() => void) | null = null
): FightingEffect {
  const group = new THREE.Group();
  const startTime = Date.now();
  
  // Main fireball sphere
  const fireballGeometry = new THREE.SphereGeometry(size * 0.4, 16, 16);
  const fireballMaterial = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.9,
  });
  const fireball = new THREE.Mesh(fireballGeometry, fireballMaterial);
  fireball.position.copy(start);
  group.add(fireball);
  
  // Trail particles
  const trailPositions: THREE.Vector3[] = [];
  const maxTrailLength = 15;
  const trailObjects: THREE.Mesh[] = [];
  
  const trailGeometry = new THREE.SphereGeometry(size * 0.2, 8, 8);
  
  // Initial direction
  const direction = new THREE.Vector3().subVectors(target, start).normalize();
  const distance = start.distanceTo(target);
  const travelTime = distance / speed;
  
  // Add initial trail
  addTrailParticle(start.clone(), 0.8);
  
  let hitTarget = false;
  let isComplete = false;
  
  function addTrailParticle(position: THREE.Vector3, opacity: number) {
    if (trailPositions.length >= maxTrailLength) {
      // Remove oldest particle
      const oldParticle = trailObjects.shift();
      if (oldParticle) {
        group.remove(oldParticle);
        oldParticle.geometry.dispose();
        (oldParticle.material as THREE.Material).dispose();
      }
      trailPositions.shift();
    }
    
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: opacity * 0.6,
    });
    const trailParticle = new THREE.Mesh(trailGeometry, trailMaterial);
    trailParticle.position.copy(position);
    trailParticle.scale.setScalar(opacity * 0.8 + 0.2);
    group.add(trailParticle);
    trailObjects.push(trailParticle);
    trailPositions.push(position.clone());
  }
  
  return {
    group,
    name: 'fireball',
    type: 'spell',
    update(dt: number, clock: number) {
      if (isComplete) return;
      
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = elapsed / travelTime;
      
      if (progress >= 1) {
        // Hit target
        if (!hitTarget && onHit) {
          onHit();
        }
        hitTarget = true;
        fireballMaterial.opacity = 0.9 * (1 - (progress - 1) * 5);
        fireball.scale.setScalar(1 + (progress - 1) * 2);
        
        if ((progress - 1) > 0.1) {
          isComplete = true;
        }
        return;
      }
      
      // Move fireball
      const currentPos = new THREE.Vector3().lerpVectors(start, target, progress);
      fireball.position.copy(currentPos);
      
      // Add trail particle every few frames
      if (Math.random() < dt * 10) {
        addTrailParticle(currentPos.clone(), 1 - progress);
      }
      
      // Animate fireball (pulsing)
      const pulse = Math.sin(clock * 10) * 0.1 + 1;
      fireball.scale.setScalar(size * pulse);
      
      // Update trail particles
      for (let i = 0; i < trailObjects.length; i++) {
        const particle = trailObjects[i];
        const age = i / trailObjects.length;
        (particle.material as THREE.Material).opacity = 0.6 * (1 - age);
        particle.scale.setScalar(0.8 * (1 - age) + 0.2);
      }
    },
    dispose() {
      fireballGeometry.dispose();
      fireballMaterial.dispose();
      trailGeometry.dispose();
      for (const particle of trailObjects) {
        (particle.material as THREE.Material).dispose();
      }
      isComplete = true;
    },
    isComplete: false,
  };
}

/**
 * Create a lightning bolt with chain effects
 */
export function createLightningBolt(
  start: THREE.Vector3,
  end: THREE.Vector3,
  color: number = 0x00bfff,
  duration: number = 0.5,
  segments: number = 8,
  spread: number = 0.5
): FightingEffect {
  const group = new THREE.Group();
  const startTime = Date.now();
  
  // Create lightning path with random offsets
  const points: THREE.Vector3[] = [];
  const totalSegments = segments;
  
  for (let i = 0; i <= totalSegments; i++) {
    const t = i / totalSegments;
    const baseX = THREE.MathUtils.lerp(start.x, end.x, t);
    const baseY = THREE.MathUtils.lerp(start.y, end.y, t);
    const baseZ = THREE.MathUtils.lerp(start.z, end.z, t);
    
    // Add random offset for lightning effect
    const offsetX = (Math.random() - 0.5) * spread * (1 - Math.abs(t - 0.5));
    const offsetY = (Math.random() - 0.5) * spread * (1 - Math.abs(t - 0.5));
    const offsetZ = (Math.random() - 0.5) * spread * (1 - Math.abs(t - 0.5));
    
    points.push(new THREE.Vector3(baseX + offsetX, baseY + offsetY, baseZ + offsetZ));
  }
  
  // Create main lightning line
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.9,
    linewidth: 8,
  });
  const line = new THREE.Line(geometry, material);
  group.add(line);
  
  // Create glow around lightning
  const glowGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const glowMaterial = new THREE.LineBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.3,
    linewidth: 15,
  });
  const glowLine = new THREE.Line(glowGeometry, glowMaterial);
  group.add(glowLine);
  
  let isComplete = false;
  
  return {
    group,
    name: 'lightning_bolt',
    type: 'spell',
    update(dt: number, clock: number) {
      if (isComplete) return;
      
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = elapsed / duration;
      
      if (progress >= 1) {
        isComplete = true;
        return;
      }
      
      // Fade out lightning
      const fadeProgress = Math.min(1, progress * 2);
      material.opacity = 0.9 * (1 - fadeProgress);
      glowMaterial.opacity = 0.3 * (1 - fadeProgress);
      
      // Animate glow size
      glowMaterial.linewidth = 15 * (1 - progress);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      isComplete = true;
    },
    isComplete: false,
  };
}

/**
 * Create a healing aura effect
 */
export function createHealingEffect(
  position: THREE.Vector3,
  target: THREE.Object3D | null = null,
  color: number = 0x00ff00,
  radius: number = 3,
  duration: number = 1.5
): FightingEffect {
  const group = new THREE.Group();
  const startTime = Date.now();
  
  // Create healing ring that expands
  const ringGeometry = new THREE.TorusGeometry(radius * 0.5, 0.1, 8, 32);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.position.copy(position);
  ring.rotation.x = Math.PI / 2; // Make it horizontal
  group.add(ring);
  
  // Create healing particles that float upward
  const particles: THREE.Sprite[] = [];
  const particleCount = 20;
  const particleTexture = shouldUseOfflineMode() ? createFallbackParticleTexture() : null;
  
  const particleGeometry = new THREE.BufferGeometry();
  
  for (let i = 0; i < particleCount; i++) {
    const particleMaterial = new THREE.SpriteMaterial({
      color: color,
      transparent: true,
      opacity: 0.8,
      map: particleTexture,
    });
    const sprite = new THREE.Sprite(particleMaterial);
    
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius * 0.4;
    sprite.position.set(
      position.x + Math.cos(angle) * distance,
      position.y,
      position.z + Math.sin(angle) * distance
    );
    
    sprite.userData = {
      velocity: new THREE.Vector3(
        Math.cos(angle) * 0.1,
        Math.random() * 0.5 + 0.2,
        Math.sin(angle) * 0.1
      ),
      lifetime: duration,
      startTime: Date.now()
    };
    
    group.add(sprite);
    particles.push(sprite);
  }
  
  let isComplete = false;
  
  return {
    group,
    name: 'healing_aura',
    type: 'spell',
    update(dt: number, clock: number) {
      if (isComplete) return;
      
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = elapsed / duration;
      
      if (progress >= 1) {
        isComplete = true;
        return;
      }
      
      // Expand ring
      ring.scale.setScalar(0.5 + progress * 0.5);
      ringMaterial.opacity = 0.6 * (1 - progress);
      
      // Update particles
      for (const particle of particles) {
        const particleElapsed = (Date.now() - particle.userData.startTime) / 1000;
        const particleProgress = particleElapsed / particle.userData.lifetime;
        
        if (particleProgress >= 1) {
          particle.material.opacity = 0;
        } else {
          particle.material.opacity = 0.8 * (1 - particleProgress);
          particle.position.add(particle.userData.velocity.clone().multiplyScalar(dt));
          particle.position.y += Math.sin(clock * 2 + particle.position.x * 0.1) * dt * 0.1; // Gentle float
        }
      }
    },
    dispose() {
      ringGeometry.dispose();
      ringMaterial.dispose();
      for (const particle of particles) {
        particle.material.dispose();
      }
      isComplete = true;
    },
    isComplete: false,
  };
}

// ============================================
// ULTIMATE ABILITY EFFECTS
// ============================================

/**
 * Create dragon breath effect (fire, ice, lightning, etc.)
 */
export function createDragonBreath(
  dragonPosition: THREE.Vector3,
  direction: THREE.Vector3,
  dragonType: 'bakunawa' | 'naga' | 'tikbalang' | 'sarimanok' = 'tikbalang',
  duration: number = 2.0,
  range: number = 20
): FightingEffect {
  const group = new THREE.Group();
  const startTime = Date.now();
  
  // Get colors based on dragon type
  const colors = {
    bakunawa: { primary: 0x4cc9f0, secondary: 0x4895ef },
    naga: { primary: 0x00ff88, secondary: 0x00cc6a },
    tikbalang: { primary: 0xff4500, secondary: 0xff6347 },
    sarimanok: { primary: 0xff69b4, secondary: 0xffeaa7 },
  };
  
  const color = colors[dragonType].primary;
  const secondaryColor = colors[dragonType].secondary;
  
  // Create breath cone
  const coneGeometry = new THREE.ConeGeometry(range * 0.1, range * 0.3, 16, 8, false, Math.PI / 4);
  coneGeometry.rotateX(Math.PI / 2); // Point cone forward
  coneGeometry.translate(0, 0, range * 0.15); // Move cone origin
  
  const coneMaterial = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(coneGeometry, coneMaterial);
  cone.position.copy(dragonPosition);
  cone.lookAt(dragonPosition.clone().add(direction));
  group.add(cone);
  
  // Create breath particles that stream forward
  const particles: THREE.Sprite[] = [];
  const particleCount = 50;
  const particleTexture = shouldUseOfflineMode() ? createFallbackParticleTexture() : null;
  
  for (let i = 0; i < particleCount; i++) {
    const particleMaterial = new THREE.SpriteMaterial({
      color: Math.random() > 0.5 ? color : secondaryColor,
      transparent: true,
      opacity: 0.8,
      map: particleTexture,
    });
    const sprite = new THREE.Sprite(particleMaterial);
    
    const spread = 0.5;
    sprite.userData = {
      position: new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread * 0.5,
        (Math.random() - 0.5) * spread
      ),
      velocity: new THREE.Vector3(
        direction.x * (Math.random() * 10 + 5),
        direction.y * (Math.random() * 10 + 5) + (Math.random() - 0.5) * 2,
        direction.z * (Math.random() * 10 + 5)
      ),
      lifetime: duration * 0.8,
      startTime: Date.now(),
      size: Math.random() * 0.5 + 0.2
    };
    
    sprite.position.copy(dragonPosition);
    sprite.position.add(sprite.userData.position);
    sprite.scale.setScalar(sprite.userData.size);
    group.add(sprite);
    particles.push(sprite);
  }
  
  let isComplete = false;
  
  return {
    group,
    name: 'dragon_breath',
    type: 'ultimate',
    update(dt: number, clock: number) {
      if (isComplete) return;
      
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = elapsed / duration;
      
      if (progress >= 1) {
        isComplete = true;
        return;
      }
      
      // Cone expands and fades
      cone.scale.setScalar(0.5 + progress * 0.5);
      coneMaterial.opacity = 0.4 * (1 - progress * 2);
      
      // Update particles
      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        const particleElapsed = (Date.now() - particle.userData.startTime) / 1000;
        const particleProgress = particleElapsed / particle.userData.lifetime;
        
        if (particleProgress >= 1) {
          particle.material.opacity = 0;
        } else {
          particle.material.opacity = 0.8 * (1 - particleProgress * 2);
          particle.position.add(particle.userData.velocity.clone().multiplyScalar(dt));
          
          // Particles slow down over time
          const slowFactor = 1 - particleProgress * 0.8;
          particle.userData.velocity.multiplyScalar(slowFactor);
          
          // Particles grow and shrink
          particle.scale.setScalar(particle.userData.size * (1 + Math.sin(clock * 5 + i) * 0.1));
        }
      }
    },
    dispose() {
      coneGeometry.dispose();
      coneMaterial.dispose();
      for (const particle of particles) {
        particle.material.dispose();
      }
      isComplete = true;
    },
    isComplete: false,
  };
}

/**
 * Create AoE indicator circle
 */
export function createAoEIndicator(
  position: THREE.Vector3,
  radius: number = 8,
  color: number = 0xff0000,
  duration: number = 2.0,
  pulseSpeed: number = 1.0
): FightingEffect {
  const group = new THREE.Group();
  const startTime = Date.now();
  
  // Create outer circle
  const outerGeometry = new THREE.TorusGeometry(radius, 0.1, 8, 64);
  const outerMaterial = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const outerCircle = new THREE.Mesh(outerGeometry, outerMaterial);
  outerCircle.position.copy(position);
  outerCircle.rotation.x = Math.PI / 2;
  group.add(outerCircle);
  
  // Create inner circle for pulsing effect
  const innerGeometry = new THREE.TorusGeometry(radius * 0.8, 0.05, 8, 32);
  const innerMaterial = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });
  const innerCircle = new THREE.Mesh(innerGeometry, innerMaterial);
  innerCircle.position.copy(position);
  innerCircle.rotation.x = Math.PI / 2;
  group.add(innerCircle);
  
  let isComplete = false;
  
  return {
    group,
    name: 'aoe_indicator',
    type: 'ultimate',
    update(dt: number, clock: number) {
      if (isComplete) return;
      
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = elapsed / duration;
      
      if (progress >= 1) {
        isComplete = true;
        return;
      }
      
      // Outer circle fades in then out
      const outerProgress = Math.min(1, progress * 2);
      outerMaterial.opacity = 0.3 * (1 - outerProgress);
      
      // Inner circle pulses
      const pulse = Math.sin(clock * pulseSpeed) * 0.3 + 0.7;
      innerCircle.scale.setScalar(pulse);
      innerMaterial.opacity = 0.6 * (1 - progress);
    },
    dispose() {
      outerGeometry.dispose();
      outerMaterial.dispose();
      innerGeometry.dispose();
      innerMaterial.dispose();
      isComplete = true;
    },
    isComplete: false,
  };
}

/**
 * Create massive impact explosion
 */
export function createExplosionEffect(
  position: THREE.Vector3,
  radius: number = 5,
  color: number = 0xff4500,
  duration: number = 1.0,
  particleCount: number = 30
): FightingEffect {
  const group = new THREE.Group();
  const startTime = Date.now();
  
  // Create explosion sphere that quickly expands
  const sphereGeometry = new THREE.SphereGeometry(radius * 0.5, 16, 16);
  const sphereMaterial = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  sphere.position.copy(position);
  group.add(sphere);
  
  // Create explosion particles
  const particles: THREE.Sprite[] = [];
  const particleTexture = shouldUseOfflineMode() ? createFallbackParticleTexture() : null;
  
  for (let i = 0; i < particleCount; i++) {
    const particleMaterial = new THREE.SpriteMaterial({
      color: color,
      transparent: true,
      opacity: 0.8,
      map: particleTexture,
    });
    const sprite = new THREE.Sprite(particleMaterial);
    
    // Random direction from explosion center
    const angleX = Math.random() * Math.PI * 2;
    const angleY = Math.acos(Math.random() * 2 - 1);
    const distance = Math.random() * radius * 0.8 + radius * 0.2;
    
    const direction = new THREE.Vector3(
      Math.sin(angleY) * Math.cos(angleX),
      Math.cos(angleY),
      Math.sin(angleY) * Math.sin(angleX)
    );
    
    sprite.userData = {
      velocity: direction.multiplyScalar(distance * 2),
      lifetime: duration,
      startTime: Date.now(),
      rotationSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20
      ),
      startSize: Math.random() * 0.8 + 0.2
    };
    
    sprite.position.copy(position);
    sprite.scale.setScalar(sprite.userData.startSize);
    group.add(sprite);
    particles.push(sprite);
  }
  
  let isComplete = false;
  
  return {
    group,
    name: 'explosion',
    type: 'ultimate',
    update(dt: number, clock: number) {
      if (isComplete) return;
      
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = elapsed / duration;
      
      if (progress >= 1) {
        isComplete = true;
        return;
      }
      
      // Expand and fade sphere
      sphere.scale.setScalar(progress * 2);
      sphereMaterial.opacity = 0.6 * (1 - progress);
      
      // Update particles
      for (const particle of particles) {
        const particleElapsed = (Date.now() - particle.userData.startTime) / 1000;
        const particleProgress = particleElapsed / particle.userData.lifetime;
        
        if (particleProgress >= 1) {
          particle.material.opacity = 0;
        } else {
          particle.material.opacity = 0.8 * (1 - particleProgress * 2);
          particle.position.add(particle.userData.velocity.clone().multiplyScalar(dt));
          particle.position.y -= 9.8 * dt * 0.1; // Gravity
          
          // Particle spins
          particle.rotation.x += particle.userData.rotationSpeed.x * dt;
          particle.rotation.y += particle.userData.rotationSpeed.y * dt;
          particle.rotation.z += particle.userData.rotationSpeed.z * dt;
          
          // Particle shrinks
          particle.scale.setScalar(particle.userData.startSize * (1 - particleProgress));
        }
      }
    },
    dispose() {
      sphereGeometry.dispose();
      sphereMaterial.dispose();
      for (const particle of particles) {
        particle.material.dispose();
      }
      isComplete = true;
    },
    isComplete: false,
  };
}

// ============================================
// STATUS EFFECTS
// ============================================

/**
 * Create a status effect on a character
 */
export function createStatusEffect(
  target: THREE.Object3D,
  statusType: StatusEffectType,
  duration: number = 3.0,
  size: number = 1.5
): FightingEffect {
  const group = new THREE.Group();
  const startTime = Date.now();
  
  // Status effect colors
  const statusColors: Record<StatusEffectType, { color: number; particleColor: number }> = {
    burning: { color: 0xff4500, particleColor: 0xff6600 },
    frozen: { color: 0x00bfff, particleColor: 0x0099ff },
    poisoned: { color: 0x008000, particleColor: 0x006600 },
    stunned: { color: 0xffff00, particleColor: 0xffcc00 },
    healing: { color: 0x00ff00, particleColor: 0x00cc00 },
    shielded: { color: 0x00bfff, particleColor: 0x0099ff },
    hasted: { color: 0xffff00, particleColor: 0xffcc00 },
    cursed: { color: 0x800080, particleColor: 0x660066 },
  };
  
  const colors = statusColors[statusType];
  
  // Create aura ring around character
  const ringGeometry = new THREE.TorusGeometry(size, 0.05, 8, 32);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: colors.color,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.position.copy(target.position);
  ring.position.y += 1; // Position above character
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  
  // Create status particles that float around character
  const particles: THREE.Sprite[] = [];
  const particleCount = 10;
  const particleTexture = shouldUseOfflineMode() ? createFallbackParticleTexture() : null;
  
  for (let i = 0; i < particleCount; i++) {
    const particleMaterial = new THREE.SpriteMaterial({
      color: colors.particleColor,
      transparent: true,
      opacity: 0.8,
      map: particleTexture,
    });
    const sprite = new THREE.Sprite(particleMaterial);
    
    const angle = Math.random() * Math.PI * 2;
    const distance = size * 0.7;
    sprite.userData = {
      basePosition: new THREE.Vector3(
        target.position.x + Math.cos(angle) * distance,
        target.position.y + Math.random() * 1.5,
        target.position.z + Math.sin(angle) * distance
      ),
      offset: new THREE.Vector3(0, Math.random() * 0.3, 0),
      rotationSpeed: Math.random() * 0.5 + 0.2,
      floatSpeed: Math.random() * 0.3 + 0.1,
      lifetime: duration,
      startTime: Date.now()
    };
    
    sprite.position.copy(sprite.userData.basePosition);
    sprite.scale.setScalar(0.2);
    group.add(sprite);
    particles.push(sprite);
  }
  
  // Create status indicator above head
  const indicatorGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.3);
  const indicatorMaterial = new THREE.MeshBasicMaterial({
    color: colors.color,
    transparent: true,
    opacity: 0.8,
  });
  const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
  indicator.position.copy(target.position);
  indicator.position.y += 2.5; // Above head
  group.add(indicator);
  
  let isComplete = false;
  
  return {
    group,
    name: `status_${statusType}`,
    type: 'status',
    update(dt: number, clock: number) {
      if (isComplete) return;
      
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = elapsed / duration;
      
      if (progress >= 1) {
        isComplete = true;
        return;
      }
      
      // Update ring position and rotation
      ring.position.copy(target.position);
      ring.position.y += 1;
      ring.rotation.y += dt * 0.5;
      ringMaterial.opacity = 0.3 * (1 - progress * 0.5);
      
      // Update particles
      for (const particle of particles) {
        const particleElapsed = (Date.now() - particle.userData.startTime) / 1000;
        const particleProgress = particleElapsed / particle.userData.lifetime;
        
        if (particleProgress >= 1) {
          particle.material.opacity = 0;
        } else {
          particle.material.opacity = 0.8 * (1 - particleProgress);
          
          // Orbit around character
          const angle = particle.userData.rotationSpeed * particleElapsed;
          particle.position.x = target.position.x + 
            Math.cos(angle) * particle.userData.basePosition.distanceTo(target.position) * 0.7;
          particle.position.z = target.position.z + 
            Math.sin(angle) * particle.userData.basePosition.distanceTo(target.position) * 0.7;
          particle.position.y = target.position.y + 
            particle.userData.basePosition.y - target.position.y + 
            Math.sin(angle * 2) * particle.userData.floatSpeed;
          
          // Rotate particle
          particle.rotation.y += dt * 2;
        }
      }
      
      // Update indicator
      indicator.position.copy(target.position);
      indicator.position.y += 2.5;
      indicatorMaterial.opacity = 0.8 * (1 - progress * 0.5);
      
      // Bounce indicator
      indicator.position.y += Math.sin(clock * 10) * dt * 0.05;
    },
    dispose() {
      ringGeometry.dispose();
      ringMaterial.dispose();
      for (const particle of particles) {
        particle.material.dispose();
      }
      indicatorGeometry.dispose();
      indicatorMaterial.dispose();
      isComplete = true;
    },
    isComplete: false,
  };
}

/**
 * Create stunned effect with yellow stars
 */
export function createStunnedEffect(
  target: THREE.Object3D,
  duration: number = 2.0,
  starCount: number = 5
): FightingEffect {
  const group = new THREE.Group();
  const startTime = Date.now();
  
  // Create stars above head
  const stars: THREE.Mesh[] = [];
  const starGeometry = new THREE.ConeGeometry(0.2, 0.4, 8, 4);
  
  for (let i = 0; i < starCount; i++) {
    const starMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.9,
    });
    const star = new THREE.Mesh(starGeometry, starMaterial);
    
    const angle = (i / starCount) * Math.PI * 2;
    const distance = 0.8;
    star.position.set(
      target.position.x + Math.cos(angle) * distance,
      target.position.y + 2.5,
      target.position.z + Math.sin(angle) * distance
    );
    
    star.userData = {
      rotationSpeed: Math.random() * 2 + 1,
      floatSpeed: Math.random() * 0.5 + 0.1,
      lifetime: duration,
      startTime: Date.now()
    };
    
    star.rotation.x = Math.PI / 4;
    group.add(star);
    stars.push(star);
  }
  
  let isComplete = false;
  
  return {
    group,
    name: 'stunned_effect',
    type: 'status',
    update(dt: number, clock: number) {
      if (isComplete) return;
      
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = elapsed / duration;
      
      if (progress >= 1) {
        isComplete = true;
        return;
      }
      
      for (const star of stars) {
        const starElapsed = (Date.now() - star.userData.startTime) / 1000;
        const starProgress = starElapsed / star.userData.lifetime;
        
        if (starProgress >= 1) {
          (star.material as THREE.Material).opacity = 0;
        } else {
          (star.material as THREE.Material).opacity = 0.9 * (1 - starProgress);
          
          // Rotate and float
          star.rotation.y += dt * star.userData.rotationSpeed;
          star.rotation.z += dt * star.userData.rotationSpeed * 0.5;
          star.position.y = target.position.y + 2.5 + Math.sin(clock * star.userData.floatSpeed) * 0.1;
          
          // Update position relative to target
          const baseAngle = (stars.indexOf(star) / starCount) * Math.PI * 2;
          star.position.x = target.position.x + Math.cos(baseAngle + starElapsed) * 0.8;
          star.position.z = target.position.z + Math.sin(baseAngle + starElapsed) * 0.8;
        }
      }
    },
    dispose() {
      starGeometry.dispose();
      for (const star of stars) {
        (star.material as THREE.Material).dispose();
      }
      isComplete = true;
    },
    isComplete: false,
  };
}

// ============================================
// DEATH EFFECTS
// ============================================

/**
 * Create a death explosion effect
 */
export function createDeathEffect(
  position: THREE.Vector3,
  color: number = 0xff4500,
  radius: number = 3,
  duration: number = 1.5,
  particleCount: number = 40
): FightingEffect {
  const group = new THREE.Group();
  const startTime = Date.now();
  
  // Create initial explosion flash
  const flashGeometry = new THREE.SphereGeometry(radius, 16, 16);
  const flashMaterial = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });
  const flash = new THREE.Mesh(flashGeometry, flashMaterial);
  flash.position.copy(position);
  group.add(flash);
  
  // Create explosion particles
  const particles: THREE.Sprite[] = [];
  const particleTexture = shouldUseOfflineMode() ? createFallbackParticleTexture() : null;
  
  for (let i = 0; i < particleCount; i++) {
    const particleMaterial = new THREE.SpriteMaterial({
      color: Math.random() > 0.5 ? color : 0xffffff,
      transparent: true,
      opacity: 0.8,
      map: particleTexture,
    });
    const sprite = new THREE.Sprite(particleMaterial);
    
    // Random spherical direction
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const distance = Math.random() * radius * 0.8 + radius * 0.2;
    
    const direction = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta)
    );
    
    sprite.userData = {
      velocity: direction.multiplyScalar(distance * 2 + Math.random() * 5),
      lifetime: duration,
      startTime: Date.now(),
      rotationSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30
      ),
      startSize: Math.random() * 0.5 + 0.1
    };
    
    sprite.position.copy(position);
    sprite.scale.setScalar(sprite.userData.startSize);
    group.add(sprite);
    particles.push(sprite);
  }
  
  // Create soul ascension particles
  const soulParticles: THREE.Sprite[] = [];
  for (let i = 0; i < 15; i++) {
    const particleMaterial = new THREE.SpriteMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      map: particleTexture,
    });
    const sprite = new THREE.Sprite(particleMaterial);
    
    sprite.userData = {
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 3 + 1,
        (Math.random() - 0.5) * 2
      ),
      lifetime: duration * 0.8,
      startTime: Date.now() + Math.random() * 200,
      rotationSpeed: new THREE.Vector3(0, Math.random() * 10, 0)
    };
    
    sprite.position.copy(position);
    sprite.scale.setScalar(0.3);
    group.add(sprite);
    soulParticles.push(sprite);
  }
  
  let isComplete = false;
  
  return {
    group,
    name: 'death_explosion',
    type: 'death',
    update(dt: number, clock: number) {
      if (isComplete) return;
      
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = elapsed / duration;
      
      if (progress >= 1) {
        isComplete = true;
        return;
      }
      
      // Flash expands and fades quickly
      flash.scale.setScalar(progress * 3);
      flashMaterial.opacity = 0.8 * (1 - progress * 3);
      
      // Explosion particles
      for (const particle of particles) {
        const particleElapsed = (Date.now() - particle.userData.startTime) / 1000;
        const particleProgress = particleElapsed / particle.userData.lifetime;
        
        if (particleProgress >= 1) {
          particle.material.opacity = 0;
        } else {
          particle.material.opacity = 0.8 * (1 - particleProgress * 2);
          particle.position.add(particle.userData.velocity.clone().multiplyScalar(dt));
          particle.position.y -= 9.8 * dt * 0.1; // Gravity
          
          particle.rotation.x += particle.userData.rotationSpeed.x * dt;
          particle.rotation.y += particle.userData.rotationSpeed.y * dt;
          particle.rotation.z += particle.userData.rotationSpeed.z * dt;
          
          particle.scale.setScalar(particle.userData.startSize * (1 - particleProgress * 0.5));
        }
      }
      
      // Soul ascension particles
      for (const particle of soulParticles) {
        const particleElapsed = (Date.now() - particle.userData.startTime) / 1000;
        const particleProgress = particleElapsed / particle.userData.lifetime;
        
        if (particleProgress >= 1) {
          particle.material.opacity = 0;
        } else {
          particle.material.opacity = 0.6 * (1 - particleProgress);
          particle.position.add(particle.userData.velocity.clone().multiplyScalar(dt));
          particle.position.y += dt * 0.5; // Extra upward movement
          
          particle.rotation.y += particle.userData.rotationSpeed.y * dt;
          particle.scale.setScalar(0.3 * (1 + particleProgress * 0.5));
        }
      }
    },
    dispose() {
      flashGeometry.dispose();
      flashMaterial.dispose();
      for (const particle of particles) {
        particle.material.dispose();
      }
      for (const particle of soulParticles) {
        particle.material.dispose();
      }
      isComplete = true;
    },
    isComplete: false,
  };
}

/**
 * Create soul ascension effect
 */
export function createSoulAscension(
  position: THREE.Vector3,
  color: number = 0xffffff,
  duration: number = 2.0,
  height: number = 10
): FightingEffect {
  const group = new THREE.Group();
  const startTime = Date.now();
  
  const particleTexture = shouldUseOfflineMode() ? createFallbackParticleTexture() : null;
  const particles: THREE.Sprite[] = [];
  const particleCount = 20;
  
  for (let i = 0; i < particleCount; i++) {
    const particleMaterial = new THREE.SpriteMaterial({
      color: color,
      transparent: true,
      opacity: 0.8,
      map: particleTexture,
    });
    const sprite = new THREE.Sprite(particleMaterial);
    
    const delay = Math.random() * 500;
    const startTime = Date.now() + delay;
    
    sprite.userData = {
      startTime,
      lifetime: duration,
      baseY: position.y,
      amplitude: Math.random() * 0.5 + 0.3,
      frequency: Math.random() * 2 + 1,
      rotationSpeed: Math.random() * 10
    };
    
    sprite.position.copy(position);
    sprite.scale.setScalar(Math.random() * 0.3 + 0.1);
    group.add(sprite);
    particles.push(sprite);
  }
  
  let isComplete = false;
  
  return {
    group,
    name: 'soul_ascension',
    type: 'death',
    update(dt: number, clock: number) {
      if (isComplete) return;
      
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = elapsed / duration;
      
      if (progress >= 1) {
        isComplete = true;
        return;
      }
      
      for (const particle of particles) {
        const particleElapsed = (Date.now() - particle.userData.startTime) / 1000;
        const particleProgress = particleElapsed / particle.userData.lifetime;
        
        if (particleProgress >= 1) {
          particle.material.opacity = 0;
        } else {
          particle.material.opacity = 0.8 * (1 - particleProgress * 2);
          
          // Soul ascends with sinusoidal movement
          const heightProgress = Math.min(1, particleElapsed / (duration * 0.8));
          particle.position.y = particle.userData.baseY + 
            height * heightProgress * 0.8 + 
            Math.sin(clock * particle.userData.frequency) * particle.userData.amplitude * (1 - heightProgress);
          
          particle.position.x += Math.sin(clock * 0.5 + particle.position.y * 0.1) * dt * 0.2;
          particle.position.z += Math.cos(clock * 0.5 + particle.position.y * 0.1) * dt * 0.2;
          
          particle.rotation.y += particle.userData.rotationSpeed * dt;
          particle.scale.setScalar(particle.userData.startScale * (1 + Math.sin(clock * 3) * 0.05));
        }
      }
    },
    dispose() {
      for (const particle of particles) {
        particle.material.dispose();
      }
      isComplete = true;
    },
    isComplete: false,
  };
}

// ============================================
// INTEGRATION FUNCTIONS
// ============================================

/**
 * Create a fighting effect based on dragon type and attack
 */
export function createDragonAttackEffect(
  dragonType: 'bakunawa' | 'naga' | 'tikbalang' | 'sarimanok',
  attackType: 'basic' | 'special' | 'ultimate',
  start: THREE.Vector3,
  target: THREE.Vector3
): FightingEffect {
  const DRAGON_ATTACK_EFFECTS: Record<'bakunawa' | 'naga' | 'tikbalang' | 'sarimanok', {
    basic: () => FightingEffect;
    special: () => FightingEffect; 
    ultimate: () => FightingEffect;
  }> = {
    bakunawa: {
      basic: () => createSlashEffect(start, target, 0x4cc9f0, 0.4, 0.2),
      special: () => createLightningBolt(start, target, 0x4cc9f0, 0.8, 12, 0.8),
      ultimate: () => createDragonBreath(start, target, 'bakunawa', 2.5, 25)
    },
    naga: {
      basic: () => createSlashEffect(start, target, 0x00ff88, 0.4, 0.2),
      special: () => createHealingEffect(start, null, 0x00cc6a, 4, 2.0),
      ultimate: () => createDragonBreath(start, target, 'naga', 2.5, 25)
    },
    tikbalang: {
      basic: () => createSlashEffect(start, target, 0xff4500, 0.4, 0.2),
      special: () => createFireballEffect(start, target, 25, 0xff4500, 1.2),
      ultimate: () => createDragonBreath(start, target, 'tikbalang', 2.5, 25)
    },
    sarimanok: {
      basic: () => createSlashEffect(start, target, 0xff69b4, 0.4, 0.2),
      special: () => createExplosionEffect(target, 4, 0xffeaa7, 1.2, 20),
      ultimate: () => createDragonBreath(start, target, 'sarimanok', 2.5, 25)
    }
  };
  
  return DRAGON_ATTACK_EFFECTS[dragonType][attackType]();
}

/**
 * Create a comprehensive fighting effect manager for the game
 */
export class FightingEffectsSystem {
  private effectManager: EffectManager;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  
  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;
    this.effectManager = new EffectManager();
  }
  
  /**
   * Create and add a fighting effect to the scene
   */
  createEffect(effect: FightingEffect): FightingEffect {
    this.scene.add(effect.group);
    this.effectManager.addEffect(effect);
    return effect;
  }
  
  /**
   * Create and add a slash effect
   */
  createSlash(start: THREE.Vector3, end: THREE.Vector3, color?: number, duration?: number): FightingEffect {
    const effect = createSlashEffect(start, end, color, duration);
    return this.createEffect(effect);
  }
  
  /**
   * Create and add an impact flash
   */
  createImpact(position: THREE.Vector3, color?: number, radius?: number): FightingEffect {
    const effect = createImpactFlash(position, color, radius);
    return this.createEffect(effect);
  }
  
  /**
   * Create and add a fireball
   */
  createFireball(start: THREE.Vector3, target: THREE.Vector3, speed?: number, onHit?: () => void): FightingEffect {
    const effect = createFireballEffect(start, target, speed, 0xff4500, 1.0, onHit);
    return this.createEffect(effect);
  }
  
  /**
   * Create and add a dragon breath effect
   */
  createDragonBreath(dragonPosition: THREE.Vector3, direction: THREE.Vector3, dragonType?: 'bakunawa' | 'naga' | 'tikbalang' | 'sarimanok'): FightingEffect {
    const effect = createDragonBreath(dragonPosition, direction, dragonType || 'tikbalang');
    return this.createEffect(effect);
  }
  
  /**
   * Create and add an explosion
   */
  createExplosion(position: THREE.Vector3, radius?: number, color?: number): FightingEffect {
    const effect = createExplosionEffect(position, radius, color);
    return this.createEffect(effect);
  }
  
  /**
   * Create and add a status effect to a target
   */
  createStatusEffect(target: THREE.Object3D, statusType: StatusEffectType, duration?: number): FightingEffect {
    const effect = createStatusEffect(target, statusType, duration);
    return this.createEffect(effect);
  }
  
  /**
   * Create and add a death effect
   */
  createDeathEffect(position: THREE.Vector3, color?: number, radius?: number): FightingEffect {
    const effect = createDeathEffect(position, color, radius);
    return this.createEffect(effect);
  }
  
  /**
   * Update all effects
   */
  update(dt: number, clock: number): void {
    this.effectManager.update(dt, clock);
  }
  
  /**
   * Clean up all effects
   */
  dispose(): void {
    this.effectManager.dispose();
  }
  
  /**
   * Get effect count for performance monitoring
   */
  getEffectCount(): number {
    return this.effectManager.getEffectCount();
  }
  
  /**
   * Get particle count for performance monitoring
   */
  getParticleCount(): number {
    return this.effectManager.getParticleCount();
  }
}

// Create a global fighting effects system (can be initialized later)
export let globalFightingEffects: FightingEffectsSystem | null = null;

export function initializeFightingEffects(scene: THREE.Scene, camera: THREE.Camera): FightingEffectsSystem {
  globalFightingEffects = new FightingEffectsSystem(scene, camera);
  return globalFightingEffects;
}