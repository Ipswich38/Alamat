// The horizon: what you see past the edge of the world.
//
// ⚠⚠ NOT WORKING. The asset loads (HTTP 200), the material is correct, there
// are no console errors, and the mountain does not draw. Four causes were ruled
// out and each is documented below where it was fixed: the scene fog erasing
// it, the camera's far plane clipping it, frustum culling on a camera-parented
// object, and the sky dome painting over anything beyond 160 units.
//
// What is left to check, in order of likelihood:
//   1. Whether adding the camera to the scene graph is double-transforming its
//      children, since `lookAtGround` rewrites the camera's matrix every frame.
//   2. Whether the model's own materials survive the traverse: it may carry
//      transmission or an alpha mode that renders to nothing at this scale.
//   3. Rendering the backdrop in a SECOND PASS with its own camera, which is
//      how engines normally solve a skybox element and sidesteps all of this.
//
// It is left in place rather than deleted because the asset is generated and
// the placement reasoning is sound. It costs one failed fetch and nothing else.
//
// ── WHY A BACKDROP IS NOT JUST A BIG PROP ───────────────────────────────────
// Everything else in this scene obeys the fog, which is linear from 62 to 130
// units and exists to dissolve the treeline. A mountain placed where a mountain
// belongs is several hundred units away and would be erased completely before
// it ever drew a pixel.
//
// So the backdrop opts OUT of fog and fakes the distance itself: the mesh is
// tinted toward the horizon colour, which is what atmospheric haze actually
// does to a far-off silhouette. That way it reads as distant rather than as
// absent, and it stays put while everything nearer to the camera fades.
//
// ── AND WHY IT NEVER COLLIDES ───────────────────────────────────────────────
// It is outside the playable bounds, and nothing here registers it with any
// collision system. It exists only to be looked at, which is the whole
// definition of a backdrop.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * ⚠ THE CAMERA IS ORTHOGRAPHIC, WHICH CHANGES WHAT A BACKDROP IS.
 *
 * Orthographic projection has no size falloff with distance: a 150-unit
 * mountain placed 400 units away is drawn exactly as large as a 150-unit
 * mountain standing next to you. So the two obvious approaches both fail. Put
 * it where a mountain belongs and it either dwarfs the entire map or is clipped
 * by the far plane. Shrink it to fit and it stops being a mountain and becomes
 * a rock beside the arena.
 *
 * A backdrop in an orthographic scene therefore has to behave like a SKYBOX,
 * and merely following the camera's FOCUS is not enough either. That was the
 * second failure: the camera looks down at a shallow angle, so an object 210
 * units "behind" the focus projects far off the top of the screen instead of
 * onto a horizon. There is no horizon line at a fixed screen height to place
 * things on.
 *
 * So it is PARENTED TO THE CAMERA and positioned in camera space, which is the
 * only way to guarantee a fixed place in the frame. Local -z is forward, so it
 * sits down that axis, lifted and pushed left to land in the north-west corner
 * where the brief wants it.
 *
 * ⚠ AND IT MUST SIT INSIDE THE SKY DOME. That was the third failure and the
 * real one. The dome in sky.ts is a solid 160-unit sphere drawn on its inside
 * face and following the camera; anything further away than that is BEHIND it
 * and is painted over completely. The model loaded, the material was correct,
 * culling was off, and nothing appeared, because the sky was in front of it.
 * 138 is comfortably inside.
 */
const LOCAL = { x: -16, y: 6, z: -330 };

/**
 * How tall it stands in camera space.
 *
 * ⚠ RAISED FROM 15. In an orthographic view apparent size is actual size, so
 * this number IS how much of the frame it occupies, and at 15 it was a hill.
 * Paired with a much greater distance so it sits behind everything, which is
 * what buys the depth: near things move past it, it does not move at all.
 */
const HEIGHT = 52;

/** The horizon colour the scene's fog fades to. See stage.ts. */
const HAZE = new THREE.Color(0xbfe4e0);

export interface Backdrop {
  group: THREE.Group;
  /** Parent the backdrop to the camera so it holds a fixed place in frame. */
  attach(camera: THREE.Object3D): void;
  dispose(): void;
}

export function createBackdrop(): Backdrop {
  const group = new THREE.Group();
  group.name = 'backdrop';


  new GLTFLoader()
    .loadAsync('/models/nature/mayon.glb')
    .then((gltf) => {
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const unit = HEIGHT / Math.max(size.y, 0.0001);
      model.scale.setScalar(unit);
      // Centred on the group; the group is what gets placed in camera space.
      model.position.set(0, -box.min.y * unit, 0);
      // Turned to present a face to the camera rather than an edge.
      model.rotation.y = Math.PI * 0.25;

      model.traverse((n) => {
        const m = n as THREE.Mesh;
        if (!m.isMesh) return;
        // ⚠ NEVER CASTS OR RECEIVES. The sun's shadow camera covers the arena;
        // a 150-unit mountain outside it would either be clipped out or force
        // the shadow frustum wide enough to make every shadow in the game
        // coarse. It is scenery, and scenery does not get to cost that.
        m.castShadow = false;
        m.receiveShadow = false;
        // ⚠ CULLING MUST BE OFF FOR A CAMERA-PARENTED OBJECT. three.js tests a
        // mesh's world-space bounding sphere against the frustum, and for a
        // child of the camera that sphere is computed somewhere the frustum
        // test does not expect. The model loads, the material is fine, and it
        // simply never draws: no error, no warning, nothing in the console.
        m.frustumCulled = false;
        // Drawn last and without depth testing, so it sits behind the world no
        // matter what its computed depth says at 520 units down the camera axis.
        // After the dome, which is what makes it visible against the sky.
        m.renderOrder = 1;
        const mats0 = Array.isArray(m.material) ? m.material : [m.material];
        for (const mm of mats0) (mm as THREE.Material).depthWrite = false;

        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          const std = mat as THREE.MeshStandardMaterial;
          // Out of the fog, and hazed by hand instead. See the note above.
          std.fog = false;
          if (std.color) std.color.lerp(HAZE, 0.42);
          // Flattened so it reads as a silhouette at distance rather than as a
          // lit object that happens to be far away.
          std.roughness = 1;
          std.metalness = 0;
          if (std.emissive) std.emissive.multiplyScalar(0.6);
        }
      });

      group.add(model);
    })
    .catch(() => {
      /* absent: the horizon is empty, which is worse but not broken */
    });

  return {
    group,
    /**
     * Attach to the camera. Called once, with the camera itself.
     *
     * ⚠ THE CAMERA MUST BE IN THE SCENE GRAPH for a child of it to render.
     * three.js does not walk detached hierarchies, and a backdrop parented to a
     * camera that was never added simply never appears, silently.
     */
    attach: (camera: THREE.Object3D) => {
      camera.add(group);
      group.position.set(LOCAL.x, LOCAL.y, LOCAL.z);
    },
    dispose: () => {
      group.traverse((n) => {
        const m = n as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
    },
  };
}
