// Generated models, dropped into the scene.
//
// ── WHY THEY NEED NORMALISING ───────────────────────────────────────────────
// A generated model arrives at an arbitrary scale, arbitrarily centred, and
// often not sitting on its own origin. Dropping one into a scene built in world
// units gives you a tree the size of a coin or the size of the sky. Every model
// is therefore measured on load and fitted to a stated width with its base put
// on the ground, so the arena's layout numbers stay the truth.
//
// ── WHY THE MATERIALS ARE KEPT ──────────────────────────────────────────────
// This is the payoff for committing to PBR. A previous project used flat-shaded
// Lambert and had to REPLACE every imported material, discarding the textures
// it had paid for. Here the base colour, roughness and normal maps are exactly
// what the scene's lighting expects, so they are left alone.
//
// ⚠ THEY ARE OPTIONAL. Every one of these is a several-megabyte download that
// may not be present. A missing model must leave the procedural version in
// place rather than leaving a hole in the arena.

import * as THREE from 'three';
import { gltfLoader as loader } from './gltf';


/**
 * Fit a loaded model to a size in world units, standing on y = 0.
 *
 * ⚠ A CANOPY MAY OVERHANG ITS COLLISION and should. The arena's collision is a
 * radius on the trunk; a tree whose leaves reach past it is a tree you can
 * stand under, which is the point of having one.
 */
function fit(root: THREE.Object3D, target: { width?: number; height?: number }): THREE.Group {
  // ⚠ MATRICES FIRST. Box3.setFromObject reads world matrices, and a freshly
  // loaded glTF has not had its updated. Measuring without this returns a box
  // for the wrong transform, which put the tree several units off centre.
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const centre = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(centre);

  // Fit by HEIGHT for anything upright and by WIDTH for anything spread out.
  // A banyan measured 1.89 by 1.61 by 1.68, so fitting its width to the trunk's
  // collision radius produced a tree shorter than it was wide: a bush.
  const scale = target.height
    ? target.height / Math.max(size.y, 0.0001)
    : (target.width ?? 1) / Math.max(size.x, size.z, 0.0001);
  root.scale.setScalar(scale);
  // Centred on x and z, and lifted so the lowest point rests on the ground.
  root.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale);

  const group = new THREE.Group();
  group.add(root);
  return group;
}

export async function loadModel(
  url: string,
  target: { width?: number; height?: number }
): Promise<THREE.Group | null> {
  try {
    const gltf = await loader.loadAsync(url);
    gltf.scene.traverse((n) => {
      const m = n as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
    });
    return fit(gltf.scene, target);
  } catch {
    // Absent or unreadable. The caller keeps whatever it already had.
    return null;
  }
}
