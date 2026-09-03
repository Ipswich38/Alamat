// Dynamic Camera System for ALamat MOBA
//
// Provides cinematic camera angles for fighting scenes including:
// - Fight mode camera with zoom in/out
// - Camera presets for different combat situations
// - Camera shake effects on hits
// - Target tracking during combat
// - Smooth transitions between modes
//
// Integrates with performance optimizer and fighting effects

import * as THREE from 'three';
import { getPerformanceSettings, PerformancePreset } from './performanceOptimizer';
import { FightingEffectsSystem, createScreenShake } from './fightingEffects';

// Camera presets for different game situations
export interface CameraPreset {
  name: string;
  fov: number;           // Field of view in degrees
  distance: number;      // From target
  height: number;        // Above target
  angle: number;         // Viewing angle (negative for top-down)
  transitionTime: number; // Transition duration in seconds
  near?: number;         // Near clipping plane
  far?: number;          // Far clipping plane
}

// Default camera presets
const DEFAULT_PRESETS: Record<string, CameraPreset> = {
  default: { 
    name: 'default', 
    fov: 60, 
    distance: 25, 
    height: 15, 
    angle: -0.3, 
    transitionTime: 0.5 
  },
  fightClose: { 
    name: 'fightClose', 
    fov: 50, 
    distance: 15, 
    height: 8, 
    angle: -0.2, 
    transitionTime: 0.3 
  },
  fightWide: { 
    name: 'fightWide', 
    fov: 70, 
    distance: 30, 
    height: 20, 
    angle: -0.4, 
    transitionTime: 0.5 
  },
  ultimate: { 
    name: 'ultimate', 
    fov: 45, 
    distance: 10, 
    height: 5, 
    angle: -0.1, 
    transitionTime: 0.2 
  },
  death: { 
    name: 'death', 
    fov: 75, 
    distance: 20, 
    height: 25, 
    angle: -0.5, 
    transitionTime: 1.0 
  },
  ability: { 
    name: 'ability', 
    fov: 55, 
    distance: 18, 
    height: 12, 
    angle: -0.25, 
    transitionTime: 0.4 
  },
  cinematic: { 
    name: 'cinematic', 
    fov: 50, 
    distance: 20, 
    height: 10, 
    angle: -0.2, 
    transitionTime: 0.8 
  }
};

/**
 * Active camera shake effect
 */
export interface ActiveShake {
  intensity: number;
  duration: number;
  frequency: number;
  startTime: number;
  originalPosition: THREE.Vector3;
}

/**
 * Camera focus target
 */
export interface CameraTarget {
  object: THREE.Object3D;
  offset?: THREE.Vector3;
  weight?: number; // For multiple targets (0-1)
}

/**
 * Combat state information
 */
export interface CombatState {
  inCombat: boolean;
  activeCharacters: THREE.Object3D[];
  lastHitTime: number;
  criticalHit: boolean;
  killOccurred: boolean;
  ultimateUsed: boolean;
}

/**
 * Camera mode types
 */
export type CameraMode = 
  | 'default'
  | 'combat'
  | 'fightClose'
  | 'fightWide'
  | 'ultimate'
  | 'death'
  | 'ability'
  | 'cinematic'
  | 'custom';

/**
 * Main camera controller class
 */
export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private canvas: HTMLCanvasElement;
  
  // Camera state
  private currentPreset: CameraPreset;
  private targetPreset: CameraPreset | null = null;
  private transitionStartTime: number = 0;
  private transitionDuration: number = 0;
  
  // Camera targets
  private primaryTarget: THREE.Object3D | null = null;
  private secondaryTargets: CameraTarget[] = [];
  private focusPoint: THREE.Vector3 = new THREE.Vector3();
  
  // Camera position and rotation
  private currentPosition: THREE.Vector3 = new THREE.Vector3();
  private targetPosition: THREE.Vector3 = new THREE.Vector3();
  private currentLookAt: THREE.Vector3 = new THREE.Vector3();
  private targetLookAt: THREE.Vector3 = new THREE.Vector3();
  
  // Camera shake
  private activeShakes: ActiveShake[] = [];
  private basePosition: THREE.Vector3 = new THREE.Vector3();
  
  // Combat state
  private combatState: CombatState = {
    inCombat: false,
    activeCharacters: [],
    lastHitTime: 0,
    criticalHit: false,
    killOccurred: false,
    ultimateUsed: false,
  };
  
  // Camera settings
  private settings: {
    fov: number;
    near: number;
    far: number;
    aspect: number;
    minDistance: number;
    maxDistance: number;
    smoothFactor: number;
    zoomSensitivity: number;
    rotationSensitivity: number;
    edgeBuffer: number; // How close to edge before camera moves
  };
  
  // Mode settings
  private mode: CameraMode = 'default';
  private previousMode: CameraMode = 'default';
  
  // Fighting effects integration
  private fightingEffects: FightingEffectsSystem | null = null;
  
  // Performance settings
  private performancePreset: PerformancePreset = 'medium';
  
  constructor(
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    canvas: HTMLCanvasElement,
    initialTarget?: THREE.Object3D
  ) {
    this.camera = camera;
    this.scene = scene;
    this.canvas = canvas;
    
    // Store original camera settings
    this.currentPreset = {
      name: 'current',
      fov: camera.fov,
      distance: 25,
      height: 15,
      angle: -0.3,
      transitionTime: 0.5,
      near: camera.near,
      far: camera.far
    };
    
    this.settings = {
      fov: camera.fov,
      near: camera.near,
      far: camera.far,
      aspect: camera.aspect,
      minDistance: 5,
      maxDistance: 50,
      smoothFactor: 0.1,
      zoomSensitivity: 0.01,
      rotationSensitivity: 0.005,
      edgeBuffer: 0.1
    };
    
    // Set initial target
    if (initialTarget) {
      this.setPrimaryTarget(initialTarget);
    }
    
    // Initialize camera position
    this.updateCameraPosition(0);
    
    // Add mouse wheel listener for manual zoom
    this.setupMouseControls();
    
    // Store reference to this for event handlers
    const self = this;
    window.addEventListener('resize', () => {
      self.onResize();
    });
  }
  
  /**
   * Set up mouse controls for manual zoom and rotation
   */
  private setupMouseControls(): void {
    // Mouse wheel for zooming
    this.canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -1 : 1;
      this.manualZoom(delta * 0.1);
    });
    
    // Right mouse button for camera rotation
    let isRotating = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    
    this.canvas.addEventListener('mousedown', (event) => {
      if (event.button === 2) { // Right mouse button
        isRotating = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        event.preventDefault();
      }
    });
    
    window.addEventListener('mousemove', (event) => {
      if (isRotating) {
        const dx = event.clientX - lastMouseX;
        const dy = event.clientY - lastMouseY;
        this.manualRotate(dx, dy);
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
      }
    });
    
    window.addEventListener('mouseup', (event) => {
      if (event.button === 2) {
        isRotating = false;
      }
    });
  }
  
  /**
   * Handle window resize
   */
  private onResize(): void {
    this.camera.aspect = this.canvas.width / this.canvas.height;
    this.camera.updateProjectionMatrix();
  }
  
  /**
   * Set the fighting effects system for integration
   */
  setFightingEffects(effects: FightingEffectsSystem): void {
    this.fightingEffects = effects;
  }
  
  /**
   * Update camera based on current performance preset
   */
  updatePerformanceSettings(preset: PerformancePreset): void {
    this.performancePreset = preset;
    
    // Adjust camera settings based on performance
    const settingsMap: Record<PerformancePreset, Partial<typeof this.settings>> = {
      ultra: { smoothFactor: 0.08, edgeBuffer: 0.05 },
      high: { smoothFactor: 0.08, edgeBuffer: 0.08 },
      medium: { smoothFactor: 0.1, edgeBuffer: 0.1 },
      low: { smoothFactor: 0.15, edgeBuffer: 0.15 },
      minimal: { smoothFactor: 0.2, edgeBuffer: 0.2 },
    };
    
    const newSettings = settingsMap[preset];
    if (newSettings) {
      this.settings = { ...this.settings, ...newSettings };
    }
  }
  
  /**
   * Set the primary camera target
   */
  setPrimaryTarget(target: THREE.Object3D, offset?: THREE.Vector3): void {
    this.primaryTarget = target;
    if (offset) {
      target.userData.cameraOffset = offset;
    }
    this.updateFocusPoint();
  }
  
  /**
   * Add a secondary camera target (for focusing on multiple characters)
   */
  addSecondaryTarget(target: THREE.Object3D, weight: number = 0.5, offset?: THREE.Vector3): void {
    this.secondaryTargets.push({ object: target, weight, offset });
    if (offset) {
      target.userData.cameraOffset = offset;
    }
    this.updateFocusPoint();
  }
  
  /**
   * Remove a secondary camera target
   */
  removeSecondaryTarget(target: THREE.Object3D): void {
    this.secondaryTargets = this.secondaryTargets.filter(
      t => t.object !== target
    );
    this.updateFocusPoint();
  }
  
  /**
   * Clear all secondary targets
   */
  clearSecondaryTargets(): void {
    this.secondaryTargets = [];
    this.updateFocusPoint();
  }
  
  /**
   * Update the focus point based on current targets
   */
  private updateFocusPoint(): void {
    if (!this.primaryTarget) {
      this.focusPoint.set(0, 0, 0);
      return;
    }
    
    // Start with primary target
    const primaryPos = this.getTargetPosition(this.primaryTarget);
    this.focusPoint.copy(primaryPos);
    
    // Add secondary targets with weights
    if (this.secondaryTargets.length > 0) {
      let totalWeight = 1; // Primary target has weight 1
      const weightedPosition = new THREE.Vector3().copy(primaryPos);
      
      for (const target of this.secondaryTargets) {
        const targetPos = this.getTargetPosition(target.object);
        const weight = target.weight || 0.5;
        weightedPosition.add(targetPos.multiplyScalar(weight));
        totalWeight += weight;
      }
      
      this.focusPoint.copy(weightedPosition).divideScalar(totalWeight);
    }
  }
  
  /**
   * Get the position of a target including any offset
   */
  private getTargetPosition(target: THREE.Object3D): THREE.Vector3 {
    const position = target.position.clone();
    const offset = target.userData.cameraOffset as THREE.Vector3 | undefined;
    if (offset) {
      position.add(offset);
    }
    return position;
  }
  
  /**
   * Set the camera mode
   */
  setMode(mode: CameraMode, transitionTime?: number): void {
    if (mode === this.mode && !transitionTime) return;
    
    this.previousMode = this.mode;
    this.mode = mode;
    
    const preset = DEFAULT_PRESETS[mode] || DEFAULT_PRESETS.default;
    this.setPreset(preset, transitionTime || preset.transitionTime);
  }
  
  /**
   * Set camera to a specific preset
   */
  setPreset(preset: CameraPreset, transitionTime?: number): void {
    this.targetPreset = { ...preset };
    if (transitionTime !== undefined) {
      this.targetPreset.transitionTime = transitionTime;
    }
    this.transitionStartTime = Date.now();
    this.transitionDuration = this.targetPreset.transitionTime * 1000; // Convert to ms
    
    // If no current transition, set current preset immediately
    if (this.transitionDuration <= 0) {
      this.currentPreset = this.targetPreset;
      this.updateCameraPosition(0);
    }
  }
  
  /**
   * Set custom camera parameters
   */
  setCustomParameters(params: Partial<CameraPreset>): void {
    this.currentPreset = { ...this.currentPreset, ...params };
    this.mode = 'custom';
    this.updateCameraPosition(0);
  }
  
  /**
   * Set field of view
   */
  setFOV(fov: number): void {
    this.currentPreset.fov = fov;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }
  
  /**
   * Set camera distance
   */
  setDistance(distance: number): void {
    this.currentPreset.distance = distance;
    this.updateCameraPosition(0);
  }
  
  /**
   * Set camera height
   */
  setHeight(height: number): void {
    this.currentPreset.height = height;
    this.updateCameraPosition(0);
  }
  
  /**
   * Set camera angle
   */
  setAngle(angle: number): void {
    this.currentPreset.angle = angle;
    this.updateCameraPosition(0);
  }
  
  /**
   * Manual zoom (mouse wheel)
   */
  manualZoom(amount: number): void {
    const newDistance = this.currentPreset.distance + amount * this.settings.zoomSensitivity;
    this.currentPreset.distance = THREE.MathUtils.clamp(
      newDistance,
      this.settings.minDistance,
      this.settings.maxDistance
    );
    this.mode = 'custom';
    this.updateCameraPosition(0);
  }
  
  /**
   * Manual camera rotation
   */
  manualRotate(dx: number, dy: number): void {
    // Rotate around focus point
    const rotationSpeed = this.settings.rotationSensitivity;
    
    // Calculate current direction from camera to focus point
    const direction = new THREE.Vector3().subVectors(
      this.camera.position, 
      this.focusPoint
    ).normalize();
    
    // Calculate right and up vectors
    const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, direction).normalize();
    
    // Rotate horizontally (around up axis)
    if (Math.abs(dx) > 0.1) {
      const rotationMatrix = new THREE.Matrix4().makeRotationAxis(up, dx * rotationSpeed);
      direction.applyMatrix4(rotationMatrix);
    }
    
    // Rotate vertically (around right axis)
    if (Math.abs(dy) > 0.1) {
      const rotationMatrix = new THREE.Matrix4().makeRotationAxis(right, dy * rotationSpeed);
      direction.applyMatrix4(rotationMatrix);
    }
    
    // Update camera position
    const distance = this.currentPreset.distance;
    this.camera.position.copy(this.focusPoint).add(direction.multiplyScalar(-distance));
    this.camera.lookAt(this.focusPoint);
    this.camera.updateMatrixWorld();
    
    this.mode = 'custom';
  }
  
  /**
   * Add camera shake effect
   */
  addCameraShake(
    intensity: number = 0.1,
    duration: number = 0.3,
    frequency: number = 30
  ): void {
    const shake = createScreenShake(intensity, duration, frequency);
    
    this.activeShakes.push({
      intensity: shake.intensity,
      duration: shake.duration,
      frequency: shake.frequency,
      startTime: shake.startTime,
      originalPosition: this.camera.position.clone()
    });
    
    // Also trigger fighting effects if available
    if (this.fightingEffects && intensity > 0.2) {
      // Camera shake is already handled here, but fighting effects can add visual shake
    }
  }
  
  /**
   * Add camera shake based on hit intensity
   */
  shakeOnHit(intensity: 'light' | 'medium' | 'heavy' | 'critical' = 'medium'): void {
    const shakeMap = {
      light: { intensity: 0.05, duration: 0.1, frequency: 20 },
      medium: { intensity: 0.1, duration: 0.2, frequency: 30 },
      heavy: { intensity: 0.15, duration: 0.3, frequency: 40 },
      critical: { intensity: 0.25, duration: 0.4, frequency: 50 }
    };
    
    const shake = shakeMap[intensity];
    this.addCameraShake(shake.intensity, shake.duration, shake.frequency);
  }
  
  /**
   * Zoom in on a specific character or position
   */
  zoomIn(target: THREE.Object3D | THREE.Vector3, duration: number = 0.3): void {
    let position: THREE.Vector3;
    if (target instanceof THREE.Vector3) {
      position = target.clone();
    } else {
      position = this.getTargetPosition(target);
    }
    
    // Set a temporary close-up preset
    const closePreset: CameraPreset = {
      name: 'zoom_in',
      fov: 45,
      distance: 10,
      height: 5,
      angle: -0.1,
      transitionTime: duration
    };
    
    this.setPreset(closePreset, duration);
    
    // Temporarily set this as primary target
    if (target instanceof THREE.Object3D) {
      const oldPrimary = this.primaryTarget;
      this.setPrimaryTarget(target);
      
      // Restore primary target after zoom
      setTimeout(() => {
        if (oldPrimary) {
          this.setPrimaryTarget(oldPrimary);
        }
      }, duration * 1000);
    }
  }
  
  /**
   * Zoom out to show more of the battlefield
   */
  zoomOut(duration: number = 0.5): void {
    const widePreset: CameraPreset = {
      name: 'zoom_out',
      fov: 70,
      distance: 35,
      height: 20,
      angle: -0.4,
      transitionTime: duration
    };
    
    this.setPreset(widePreset, duration);
  }
  
  /**
   * Focus on combat - automatically adjusts based on combat state
   */
  focusOnCombat(characters: THREE.Object3D[]): void {
    this.combatState.inCombat = true;
    this.combatState.activeCharacters = characters;
    this.combatState.lastHitTime = Date.now();
    
    // Set multiple targets based on combatants
    this.clearSecondaryTargets();
    
    if (characters.length === 1 && this.primaryTarget) {
      // Single combatant focus
      this.setPrimaryTarget(characters[0]);
      this.setMode('fightClose', 0.3);
    } else if (characters.length <= 3) {
      // Focus on multiple combatants
      const primary = characters[0];
      this.setPrimaryTarget(primary);
      
      for (let i = 1; i < Math.min(characters.length, 3); i++) {
        this.addSecondaryTarget(characters[i], 0.7);
      }
      this.setMode('fightWide', 0.4);
    } else {
      // Many combatants - wide view
      const primary = characters[0];
      this.setPrimaryTarget(primary);
      this.setMode('fightWide', 0.5);
    }
  }
  
  /**
   * End combat focus
   */
  endCombatFocus(): void {
    this.combatState.inCombat = false;
    this.combatState.activeCharacters = [];
    this.clearSecondaryTargets();
    
    // Return to default mode
    this.setMode('default', 0.8);
  }
  
  /**
   * Focus on character death
   */
  focusOnDeath(character: THREE.Object3D): void {
    this.combatState.killOccurred = true;
    this.combatState.lastHitTime = Date.now();
    
    this.setPrimaryTarget(character);
    this.clearSecondaryTargets();
    this.setMode('death', 0.5);
    
    // Add a slight zoom and shake
    this.addCameraShake(0.15, 0.4, 30);
    
    // Auto-return to default after a few seconds
    setTimeout(() => {
      if (this.mode === 'death') {
        this.setMode('default', 1.0);
      }
    }, 3000);
  }
  
  /**
   * Focus on ultimate ability
   */
  focusOnUltimate(character: THREE.Object3D): void {
    this.combatState.ultimateUsed = true;
    this.combatState.lastHitTime = Date.now();
    
    this.setPrimaryTarget(character);
    this.clearSecondaryTargets();
    this.setMode('ultimate', 0.2);
    
    // Add camera shake for dramatic effect
    this.addCameraShake(0.2, 0.5, 40);
    
    // Auto-return to combat view
    setTimeout(() => {
      if (this.mode === 'ultimate') {
        this.focusOnCombat([character]);
      }
    }, 2000);
  }
  
  /**
   * Focus on special ability
   */
  focusOnAbility(character: THREE.Object3D): void {
    this.setPrimaryTarget(character);
    this.setMode('ability', 0.3);
    
    // Auto-return to previous mode
    const previousMode = this.previousMode !== 'ability' ? this.previousMode : 'default';
    setTimeout(() => {
      if (this.mode === 'ability') {
        this.setMode(previousMode as CameraMode, 0.4);
      }
    }, 1500);
  }
  
  /**
   * Detect if a character is near the edge of the screen
   */
  isCharacterAtEdge(character: THREE.Object3D, threshold: number = 0.1): boolean {
    if (!this.primaryTarget) return false;
    
    const characterPos = this.getTargetPosition(character);
    const cameraPos = this.camera.position;
    const cameraDir = new THREE.Vector3().subVectors(cameraPos, this.focusPoint).normalize();
    
    // Project character position to camera space
    const viewMatrix = new THREE.Matrix4().copy(this.camera.matrixWorldInverse);
    const projMatrix = new THREE.Matrix4().copy(this.camera.projectionMatrix);
    const viewProjMatrix = new THREE.Matrix4().multiplyMatrices(projMatrix, viewMatrix);
    
    const clipSpacePos = new THREE.Vector4(
      characterPos.x,
      characterPos.y,
      characterPos.z,
      1
    ).applyMatrix4(viewProjMatrix);
    
    // Convert to NDC and then to screen space
    const ndcX = clipSpacePos.x / clipSpacePos.w;
    const ndcY = clipSpacePos.y / clipSpacePos.w;
    
    // Check if near edges
    return (
      Math.abs(ndcX) > 1 - threshold || 
      Math.abs(ndcY) > 1 - threshold
    );
  }
  
  /**
   * Check if camera should adjust to keep targets in view
   */
  shouldAdjustForTargets(): boolean {
    if (!this.primaryTarget) return false;
    
    // Check primary target
    if (this.isCharacterAtEdge(this.primaryTarget, this.settings.edgeBuffer)) {
      return true;
    }
    
    // Check secondary targets
    for (const target of this.secondaryTargets) {
      if (this.isCharacterAtEdge(target.object, this.settings.edgeBuffer * 1.5)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Update camera position based on current preset and targets
   */
  private updateCameraPosition(dt: number): void {
    // Calculate target position based on current preset
    if (!this.primaryTarget && !this.focusPoint.length()) {
      this.targetPosition.set(0, this.currentPreset.height, this.currentPreset.distance);
      this.targetLookAt.set(0, 0, 0);
    } else {
      const focusPoint = this.focusPoint.length() ? this.focusPoint : this.getTargetPosition(this.primaryTarget!);
      
      // Calculate camera position based on preset
      const distance = this.currentPreset.distance;
      const height = this.currentPreset.height;
      const angle = this.currentPreset.angle;
      
      // Position camera at distance, height, and angle from focus point
      this.targetPosition.set(
        focusPoint.x + Math.cos(angle) * distance,
        focusPoint.y + height,
        focusPoint.z + Math.sin(angle) * distance
      );
      
      this.targetLookAt.copy(focusPoint);
      
      // Adjust lookAt height based on angle
      this.targetLookAt.y = focusPoint.y + height * 0.3;
    }
    
    // Smoothly interpolate camera position
    const alpha = this.settings.smoothFactor * (60 * dt); // dt is in seconds, so multiply by 60 for frame rate independence
    this.currentPosition.lerpVectors(this.currentPosition, this.targetPosition, alpha);
    this.currentLookAt.lerpVectors(this.currentLookAt, this.targetLookAt, alpha);
    
    // Apply camera shake
    this.applyCameraShake();
    
    // Interpolate lookAt position
    this.currentLookAt.lerpVectors(this.currentLookAt, this.targetLookAt, alpha);
    
    // Set final camera position and look at
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
    
    // Update camera FOV if it changed
    if (Math.abs(this.camera.fov - this.currentPreset.fov) > 0.1) {
      this.camera.fov = this.currentPreset.fov;
      this.camera.updateProjectionMatrix();
    }
    
    // Update near/far if they changed
    if (this.currentPreset.near && this.currentPreset.near !== this.camera.near) {
      this.camera.near = this.currentPreset.near;
    }
    if (this.currentPreset.far && this.currentPreset.far !== this.camera.far) {
      this.camera.far = this.currentPreset.far;
    }
    
    if (this.camera.near !== this.settings.near || this.camera.far !== this.settings.far) {
      this.camera.updateProjectionMatrix();
    }
    
    // Store base position for shake effects
    this.basePosition.copy(this.currentPosition);
    
    // Update camera matrix
    this.camera.updateMatrixWorld();
  }
  
  /**
   * Apply camera shake effects
   */
  private applyCameraShake(): void {
    if (this.activeShakes.length === 0) {
      this.camera.position.copy(this.basePosition);
      return;
    }
    
    const now = Date.now();
    let shakeOffset = new THREE.Vector3();
    
    // Combine all active shakes
    for (let i = 0; i < this.activeShakes.length; i++) {
      const shake = this.activeShakes[i];
      const elapsed = (now - shake.startTime) / 1000;
      const progress = elapsed / shake.duration;
      
      if (progress >= 1) {
        // Remove completed shake
        this.activeShakes.splice(i, 1);
        i--;
        continue;
      }
      
      // Calculate shake intensity (fades out)
      const intensity = shake.intensity * (1 - progress);
      
      // Apply noise-based shake
      const noiseX = this.getNoise(elapsed * shake.frequency) * 2 - 1;
      const noiseY = this.getNoise(elapsed * shake.frequency * 1.3) * 2 - 1;
      const noiseZ = this.getNoise(elapsed * shake.frequency * 0.7) * 2 - 1;
      
      shakeOffset.add(new THREE.Vector3(
        noiseX * intensity,
        noiseY * intensity * 0.5, // Less vertical shake
        noiseZ * intensity
      ));
    }
    
    // Apply shake offset
    this.camera.position.copy(this.basePosition).add(shakeOffset);
  }
  
  /**
   * Simple noise function for camera shake
   */
  private getNoise(t: number): number {
    // Simple pseudo-random noise using trigonometric functions
    const noise = (
      Math.sin(t * 123.456) * 0.4 + 
      Math.sin(t * 234.567) * 0.3 + 
      Math.sin(t * 345.678) * 0.2 + 
      Math.sin(t * 456.789) * 0.1
    );
    return (noise + 2) / 4; // Normalize to 0-1
  }
  
  /**
   * Update camera state (call this every frame)
   */
  update(dt: number, clock: number): void {
    // Check if we're transitioning between presets
    if (this.targetPreset && this.transitionDuration > 0) {
      const elapsed = Date.now() - this.transitionStartTime;
      const progress = Math.min(1, elapsed / this.transitionDuration);
      
      // Interpolate between current and target preset
      if (progress >= 1) {
        this.currentPreset = this.targetPreset;
        this.targetPreset = null;
      } else {
        const alpha = progress;
        this.currentPreset = {
          name: this.targetPreset.name,
          fov: THREE.MathUtils.lerp(this.currentPreset.fov, this.targetPreset.fov, alpha),
          distance: THREE.MathUtils.lerp(this.currentPreset.distance, this.targetPreset.distance, alpha),
          height: THREE.MathUtils.lerp(this.currentPreset.height, this.targetPreset.height, alpha),
          angle: THREE.MathUtils.lerp(this.currentPreset.angle, this.targetPreset.angle, alpha),
          transitionTime: this.targetPreset.transitionTime,
          near: this.targetPreset.near !== undefined ? 
            THREE.MathUtils.lerp(this.currentPreset.near || 0.1, this.targetPreset.near, alpha) : 
            this.currentPreset.near,
          far: this.targetPreset.far !== undefined ? 
            THREE.MathUtils.lerp(this.currentPreset.far || 1000, this.targetPreset.far, alpha) : 
            this.currentPreset.far
        };
      }
    }
    
    // Update focus point based on current targets
    this.updateFocusPoint();
    
    // Update camera position
    this.updateCameraPosition(dt);
    
    // Clean up old shakes
    const now = Date.now();
    this.activeShakes = this.activeShakes.filter(shake => 
      (now - shake.startTime) / 1000 < shake.duration
    );
    
    // Auto-adjust for targets at screen edges
    if (this.shouldAdjustForTargets() && this.mode !== 'ultimate' && this.mode !== 'death') {
      // Slightly adjust camera to keep targets in view
      const newDistance = Math.min(
        this.currentPreset.distance + 1,
        this.settings.maxDistance
      );
      this.currentPreset.distance = newDistance;
      this.updateCameraPosition(0);
    }
    
    // Reset combat state flags after a delay
    if (this.combatState.criticalHit && now - this.combatState.lastHitTime > 1000) {
      this.combatState.criticalHit = false;
    }
    if (this.combatState.killOccurred && now - this.combatState.lastHitTime > 5000) {
      this.combatState.killOccurred = false;
    }
    if (this.combatState.ultimateUsed && now - this.combatState.lastHitTime > 3000) {
      this.combatState.ultimateUsed = false;
    }
  }
  
  /**
   * Get current camera preset
   */
  getCurrentPreset(): CameraPreset {
    return { ...this.currentPreset };
  }
  
  /**
   * Get current camera mode
   */
  getMode(): CameraMode {
    return this.mode;
  }
  
  /**
   * Get current combat state
   */
  getCombatState(): CombatState {
    return { ...this.combatState };
  }
  
  /**
   * Get camera's focus point
   */
  getFocusPoint(): THREE.Vector3 {
    return this.focusPoint.clone();
  }
  
  /**
   * Get camera's current position
   */
  getCameraPosition(): THREE.Vector3 {
    return this.camera.position.clone();
  }
  
  /**
   * Get all camera presets
   */
  static getDefaultPresets(): Record<string, CameraPreset> {
    return { ...DEFAULT_PRESETS };
  }
  
  /**
   * Create a camera controller with custom presets
   */
  static createWithCustomPresets(
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    canvas: HTMLCanvasElement,
    customPresets: Record<string, CameraPreset> = {}
  ): CameraController {
    // Merge custom presets with defaults
    const allPresets = { ...DEFAULT_PRESETS, ...customPresets };
    
    // Override the default presets in the constructor
    const controller = new CameraController(camera, scene, canvas);
    
    // Note: Since DEFAULT_PRESETS is const, we can't modify it directly.
    // The presets will be used when setMode is called.
    
    return controller;
  }
}

/**
 * Camera utility functions
 */

/**
 * Create a camera controller for the game
 */
export function createCameraController(
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  canvas: HTMLCanvasElement,
  initialTarget?: THREE.Object3D
): CameraController {
  return new CameraController(camera, scene, canvas, initialTarget);
}

/**
 * Smoothly move camera to look at a position
 */
export function smoothLookAt(
  camera: THREE.Camera,
  targetPosition: THREE.Vector3,
  speed: number = 0.1
): void {
  const target = new THREE.Vector3();
  camera.getWorldDirection(target);
  target.multiplyScalar(100).add(camera.position);
  
  const newPosition = camera.position.clone().lerp(target, speed);
  camera.position.copy(newPosition);
  camera.lookAt(targetPosition);
}

/**
 * Calculate camera distance to keep objects in frame
 */
export function calculateCameraDistance(
  objects: THREE.Object3D[],
  fov: number = 60,
  aspect: number = 16/9,
  padding: number = 1.2
): number {
  if (objects.length === 0) return 10;
  
  // Calculate bounding box of all objects
  const boundingBox = new THREE.Box3();
  const tempBox = new THREE.Box3();
  
  for (const obj of objects) {
    tempBox.setFromObject(obj);
    boundingBox.expandByPoint(tempBox.min);
    boundingBox.expandByPoint(tempBox.max);
  }
  
  const center = boundingBox.getCenter(new THREE.Vector3());
  const size = boundingBox.getSize(new THREE.Vector3());
  
  // Calculate distance needed to fit the bounding box in frame
  const maxDim = Math.max(size.x, size.y, size.z);
  const fovRad = (fov * Math.PI) / 180;
  const distance = (maxDim / 2) / Math.tan(fovRad / 2) * padding;
  
  return distance;
}

/**
 * Create a cinematic camera animation
 */
export class CameraAnimation {
  private camera: THREE.Camera;
  private startTime: number;
  private duration: number;
  private startPosition: THREE.Vector3;
  private endPosition: THREE.Vector3;
  private startLookAt: THREE.Vector3;
  private endLookAt: THREE.Vector3;
  private startFov: number;
  private endFov: number;
  private onComplete?: () => void;
  private isComplete: boolean = false;
  
  constructor(
    camera: THREE.Camera,
    endPosition: THREE.Vector3,
    endLookAt: THREE.Vector3,
    duration: number = 1.0,
    endFov?: number,
    onComplete?: () => void
  ) {
    this.camera = camera;
    this.startTime = Date.now();
    this.duration = duration * 1000; // Convert to ms
    this.startPosition = camera.position.clone();
    this.endPosition = endPosition.clone();
    this.startLookAt = camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(-100).add(camera.position);
    this.endLookAt = endLookAt.clone();
    this.startFov = (camera as THREE.PerspectiveCamera).fov;
    this.endFov = endFov !== undefined ? endFov : this.startFov;
    this.onComplete = onComplete;
  }
  
  update(): boolean {
    if (this.isComplete) return true;
    
    const elapsed = Date.now() - this.startTime;
    const progress = Math.min(1, elapsed / this.duration);
    
    // Use ease-out for smoother camera movement
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    
    // Interpolate position
    this.camera.position.lerpVectors(this.startPosition, this.endPosition, easedProgress);
    
    // Interpolate look at
    const lookAt = new THREE.Vector3().lerpVectors(this.startLookAt, this.endLookAt, easedProgress);
    this.camera.lookAt(lookAt);
    
    // Interpolate FOV
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.fov = THREE.MathUtils.lerp(this.startFov, this.endFov, easedProgress);
      this.camera.updateProjectionMatrix();
    }
    
    if (progress >= 1) {
      this.isComplete = true;
      if (this.onComplete) {
        this.onComplete();
      }
      return true;
    }
    
    return false;
  }
  
  isCompleteFunc(): boolean {
    return this.isComplete;
  }
}

// ============================================
// ZOOM REACTIONS (Character Close-up System)
// ============================================

/**
 * Character portrait for zoom reactions
 */
export interface CharacterPortrait {
  character: THREE.Object3D;
  portrait: THREE.Group;
  healthBar: THREE.Mesh;
  abilityIcons: THREE.Mesh[];
  namePlate: THREE.Mesh;
}

/**
 * Zoom reaction system for character close-ups
 */
export class ZoomReactionSystem {
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private portraits: Map<THREE.Object3D, CharacterPortrait> = new Map();
  private activePortrait: CharacterPortrait | null = null;
  private zoomLevel: number = 0; // 0 = no zoom, 1 = fully zoomed
  private targetZoomLevel: number = 0;
  
  constructor(camera: THREE.Camera, scene: THREE.Scene) {
    this.camera = camera;
    this.scene = scene;
  }
  
  /**
   * Create a portrait for a character
   */
  createPortrait(character: THREE.Object3D, size: number = 5): CharacterPortrait {
    const group = new THREE.Group();
    
    // Create portrait frame
    const frameGeometry = new THREE.TorusGeometry(size * 0.6, 0.1, 16, 64);
    const frameMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.rotation.x = Math.PI / 2;
    group.add(frame);
    
    // Create name plate
    const nameGeometry = new THREE.BoxGeometry(size * 0.4, 0.3, 0.1);
    const nameMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.7,
    });
    const namePlate = new THREE.Mesh(nameGeometry, nameMaterial);
    namePlate.position.set(0, size * 0.4, 0);
    group.add(namePlate);
    
    // Create health bar background
    const healthBgGeometry = new THREE.BoxGeometry(size * 0.35, 0.15, 0.05);
    const healthBgMaterial = new THREE.MeshBasicMaterial({
      color: 0x333333,
      transparent: true,
      opacity: 0.8,
    });
    const healthBg = new THREE.Mesh(healthBgGeometry, healthBgMaterial);
    healthBg.position.set(0, size * 0.3, 0.1);
    group.add(healthBg);
    
    // Create health bar
    const healthGeometry = new THREE.BoxGeometry(size * 0.3, 0.1, 0.1);
    const healthMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.9,
    });
    const healthBar = new THREE.Mesh(healthGeometry, healthMaterial);
    healthBar.position.set(0, size * 0.3, 0.2);
    group.add(healthBar);
    
    // Create ability icons
    const abilityIcons: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const iconGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.05);
      const iconMaterial = new THREE.MeshBasicMaterial({
        color: i === 0 ? 0xff0000 : i === 1 ? 0x0000ff : i === 2 ? 0x00ff00 : 0xffff00,
        transparent: true,
        opacity: 0.8,
      });
      const icon = new THREE.Mesh(iconGeometry, iconMaterial);
      icon.position.set(
        (i - 1.5) * 0.7,
        size * 0.2,
        0
      );
      group.add(icon);
      abilityIcons.push(icon);
    }
    
    const portrait: CharacterPortrait = {
      character,
      portrait: group,
      healthBar,
      abilityIcons,
      namePlate
    };
    
    this.portraits.set(character, portrait);
    return portrait;
  }
  
  /**
   * Show portrait for a character
   */
  showPortrait(character: THREE.Object3D): void {
    const portrait = this.portraits.get(character);
    if (!portrait) return;
    
    this.activePortrait = portrait;
    this.scene.add(portrait.portrait);
    
    // Position portrait in world space
    const characterPos = character.position.clone();
    characterPos.y += 3; // Position above character
    portrait.portrait.position.copy(characterPos);
    
    // Animate portrait in
    this.targetZoomLevel = 1;
  }
  
  /**
   * Hide the active portrait
   */
  hidePortrait(): void {
    if (!this.activePortrait) return;
    
    this.scene.remove(this.activePortrait.portrait);
    this.activePortrait = null;
    this.targetZoomLevel = 0;
  }
  
  /**
   * Update portrait based on camera zoom level
   */
  update(dt: number): void {
    // Smoothly interpolate zoom level
    this.zoomLevel = THREE.MathUtils.lerp(this.zoomLevel, this.targetZoomLevel, dt * 5);
    
    // Update active portrait
    if (this.activePortrait) {
      const portrait = this.activePortrait;
      
      // Position portrait based on character
      const characterPos = portrait.character.position.clone();
      characterPos.y += 3;
      portrait.portrait.position.copy(characterPos);
      
      // Scale portrait based on zoom level
      portrait.portrait.scale.setScalar(0.5 + this.zoomLevel * 0.5);
      
      // Make portrait face camera
      portrait.portrait.lookAt(this.camera.position);
      
      // Animate health bar (simulated)
      const healthProgress = 0.7; // Would be based on actual health
      portrait.healthBar.scale.x = healthProgress;
      const healthMaterial = portrait.healthBar.material as THREE.MeshBasicMaterial;
      healthMaterial.color.setHex(healthProgress > 0.5 ? 0x00ff00 : healthProgress > 0.25 ? 0xffff00 : 0xff0000);
    }
  }
  
  /**
   * Set health bar value (0-1)
   */
  setPortraitHealth(character: THREE.Object3D, health: number): void {
    const portrait = this.portraits.get(character);
    if (!portrait) return;
    
    health = THREE.MathUtils.clamp(health, 0, 1);
    portrait.healthBar.scale.x = health;
    
    // Change color based on health
    const healthMaterial = portrait.healthBar.material as THREE.MeshBasicMaterial;
    if (health > 0.6) {
      healthMaterial.color.setHex(0x00ff00);
    } else if (health > 0.3) {
      healthMaterial.color.setHex(0xffff00);
    } else {
      healthMaterial.color.setHex(0xff0000);
    }
  }
  
  /**
   * Update ability cooldown (0-1)
   */
  setAbilityCooldown(character: THREE.Object3D, abilityIndex: number, cooldown: number): void {
    const portrait = this.portraits.get(character);
    if (!portrait || abilityIndex >= portrait.abilityIcons.length) return;
    
    const icon = portrait.abilityIcons[abilityIndex];
    cooldown = THREE.MathUtils.clamp(cooldown, 0, 1);
    
    const iconMaterial = icon.material as THREE.MeshBasicMaterial;
    iconMaterial.opacity = 0.8 * (1 - cooldown);
    iconMaterial.color.setHex(0x666666); // Gray out when on cooldown
  }
  
  /**
   * Clean up all portraits
   */
  dispose(): void {
    for (const portrait of this.portraits.values()) {
      this.scene.remove(portrait.portrait);
      // Dispose geometries and materials
      portrait.portrait.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
    }
    this.portraits.clear();
    this.activePortrait = null;
  }
  
  /**
   * Get current zoom level (0-1)
   */
  getZoomLevel(): number {
    return this.zoomLevel;
  }
}

/**
 * Create a zoom reaction system
 */
export function createZoomReactionSystem(
  camera: THREE.Camera,
  scene: THREE.Scene
): ZoomReactionSystem {
  return new ZoomReactionSystem(camera, scene);
}

// ============================================
// CAMERA UTILITY FUNCTIONS
// ============================================

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
export function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

/**
 * Vector3 interpolation
 */
export function lerpVector3(start: THREE.Vector3, end: THREE.Vector3, alpha: number): THREE.Vector3 {
  return new THREE.Vector3(
    lerp(start.x, end.x, alpha),
    lerp(start.y, end.y, alpha),
    lerp(start.z, end.z, alpha)
  );
}