// The palisade, drawn along each base perimeter.
//
// ── WHY THE SECTIONS ARE INSTANCED AROUND AN ARC ────────────────────────────
// One generated fence section, repeated. It is 7MB and there are roughly eighty
// places it needs to be, so anything other than instancing would be eighty
// downloads or eighty copies in memory.
//
// Each section is turned to face OUT from the base and stepped by its own
// width, so the run closes without gaps and without overlap. Spacing by angle
// instead would leave a fence that fits at one radius and nowhere else.

import * as THREE from 'three';
import { WALL_RADIUS, wallSpans } from '@/game/arena/walls';
import { TEAMS } from '@/game/arena/nexus';
import { loadModel } from './models';
import { surfaceMaterial } from './stage';
import { terrainHeight } from './terrain';

/**
 * How wide one fence section is placed, in world units.
 *
 * ⚠ DELIBERATELY NARROWER THAN THE MODEL IS FITTED TO. The generated section
 * has a carved totem at one end, so its BOUNDING BOX is wider than the run of
 * stakes inside it. Stepping by the box width left a visible gap between every
 * pair, and a palisade you can see daylight through does not read as a wall.
 * Sections overlap slightly instead.
 */
const SECTION = 5;
const STEP = 4.1;
/** How tall the palisade stands. Above head height: it is a wall, not a rail. */
const HEIGHT = 4.2;

export interface Walls {
  group: THREE.Group;
  dispose(): void;
}

export function createWalls(): Walls {
  const group = new THREE.Group();
  group.name = 'walls';

  // Where every section goes, worked out once from the spans.
  const slots: { x: number; z: number; facing: number; team: string }[] = [];
  for (const span of wallSpans()) {
    const team = TEAMS[span.team];
    const arc = span.to - span.from;
    // How many whole sections fit, then spread evenly so the run ends flush
    // against the gate rather than stopping short of it.
    const count = Math.max(1, Math.round((arc * WALL_RADIUS) / SECTION));
    for (let i = 0; i < count; i++) {
      const a = span.from + (arc * (i + 0.5)) / count;
      slots.push({
        x: team.x + Math.sin(a) * WALL_RADIUS,
        z: team.z + Math.cos(a) * WALL_RADIUS,
        // Facing outward, away from the base it protects.
        facing: a,
        team: span.team,
      });
    }
  }

  // The stand-in: a plain timber panel per slot, one instanced mesh for all of
  // them. Kept until the generated fence arrives, and hidden rather than
  // deleted, because a base with no visible wall is a base with no rules.
  const panelGeo = new THREE.BoxGeometry(SECTION * 0.96, HEIGHT, 0.6);
  const panels = new THREE.InstancedMesh(
    panelGeo,
    surfaceMaterial(0x8a6a42, { roughness: 0.92 }),
    slots.length
  );
  panels.castShadow = true;
  panels.receiveShadow = true;
  panels.name = 'wall-placeholder';
  const o = new THREE.Object3D();
  slots.forEach((s, i) => {
    o.position.set(s.x, terrainHeight(s.x, s.z) + HEIGHT / 2, s.z);
    o.rotation.set(0, s.facing, 0);
    o.updateMatrix();
    panels.setMatrixAt(i, o.matrix);
  });
  group.add(panels);

  loadModel('/models/props/palisade.glb', { width: SECTION }).then((model) => {
    if (!model) return;
    for (const s of slots) {
      const built = model.clone(true);
      built.position.set(s.x, terrainHeight(s.x, s.z) - 0.3, s.z);
      built.rotation.y = s.facing;
      group.add(built);
    }
    panels.visible = false;
  });

  return {
    group,
    dispose: () => {
      panelGeo.dispose();
      group.traverse((n) => {
        const m = n as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
    },
  };
}
