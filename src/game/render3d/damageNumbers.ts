// Floating Combat Damage Numbers & Status Popups
//
// ── PURPOSE ─────────────────────────────────────────────────────────────────
// Renders animated 3D-to-2D projected floating numbers for:
// - Physical damage (Red #FF3B30)
// - Magical / ability damage (Cyan #00E5FF / Purple #A855F7)
// - Critical hits (Gold #FFD700, 1.4x scale)
// - Healing (Lime #39FF14, "+120")
// - Status Alerts ("STUNNED", "WARDED", "LEVEL UP!", "BLOCKED")

import * as THREE from 'three';

export type DamageType = 'physical' | 'magic' | 'crit' | 'heal' | 'status' | 'gold';

export interface DamageNumberInstance {
  id: string;
  x: number;
  y: number;
  z: number;
  text: string;
  type: DamageType;
  color: string;
  createdAt: number;
  duration: number; // in seconds
  scale: number;
}

export interface FloatingTextHudData {
  id: string;
  screenX: number;
  screenY: number;
  text: string;
  color: string;
  opacity: number;
  scale: number;
  type: DamageType;
}

export interface DamageNumberManager {
  spawn: (x: number, y: number, z: number, amount: number | string, type?: DamageType) => void;
  update: (delta: number, camera: THREE.Camera, screenWidth: number, screenHeight: number) => FloatingTextHudData[];
  clear: () => void;
}

export function createDamageNumberManager(): DamageNumberManager {
  let instances: DamageNumberInstance[] = [];
  let nextId = 1;
  const tempVec = new THREE.Vector3();

  const spawn = (
    x: number,
    y: number,
    z: number,
    amount: number | string,
    type: DamageType = 'physical'
  ) => {
    let text = typeof amount === 'number' ? Math.round(amount).toString() : amount;
    let color = '#ff3b30';
    let scale = 1.0;
    let duration = 0.85;

    if (type === 'heal') {
      text = `+${text}`;
      color = '#39ff14';
      scale = 1.1;
    } else if (type === 'crit') {
      text = `${text}!`;
      color = '#ffd700';
      scale = 1.4;
      duration = 1.05;
    } else if (type === 'magic') {
      color = '#00e5ff';
      scale = 1.15;
    } else if (type === 'gold') {
      text = `+${text}g`;
      color = '#fbbf24';
      scale = 1.05;
    } else if (type === 'status') {
      color = '#e2e8f0';
      scale = 1.25;
      duration = 1.2;
    }

    // Add slight random horizontal jitter so overlapping numbers don't collide
    const jitterX = (Math.random() - 0.5) * 0.6;
    const jitterZ = (Math.random() - 0.5) * 0.6;

    instances.push({
      id: `dmg-${nextId++}`,
      x: x + jitterX,
      y: y + 0.8,
      z: z + jitterZ,
      text,
      type,
      color,
      createdAt: performance.now() / 1000,
      duration,
      scale,
    });
  };

  const update = (
    delta: number,
    camera: THREE.Camera,
    screenWidth: number,
    screenHeight: number
  ): FloatingTextHudData[] => {
    const now = performance.now() / 1000;
    const active: FloatingTextHudData[] = [];

    // Filter and animate instances
    instances = instances.filter((inst) => {
      const elapsed = now - inst.createdAt;
      if (elapsed >= inst.duration) return false;

      // Float upwards over time
      const currentY = inst.y + elapsed * 1.8;

      tempVec.set(inst.x, currentY, inst.z);
      tempVec.project(camera);

      // Check if within camera frustum
      if (tempVec.z > 1 || tempVec.z < -1) return true;

      const screenX = ((tempVec.x + 1) / 2) * screenWidth;
      const screenY = ((-tempVec.y + 1) / 2) * screenHeight;

      // Fade out towards the end
      const progress = elapsed / inst.duration;
      const opacity = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;

      // Initial pop scale
      const popScale = progress < 0.15 ? inst.scale * (1 + (0.15 - progress) * 2) : inst.scale;

      active.push({
        id: inst.id,
        screenX,
        screenY,
        text: inst.text,
        color: inst.color,
        opacity,
        scale: popScale,
        type: inst.type,
      });

      return true;
    });

    return active;
  };

  const clear = () => {
    instances = [];
  };

  return {
    spawn,
    update,
    clear,
  };
}
