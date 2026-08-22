// The sky, and the light that comes off it.
//
// ── WHY THE SKY IS A LIGHT SOURCE AND NOT A BACKDROP ────────────────────────
// This is the single biggest difference between a scene that looks cheap and
// one that looks expensive, and it costs almost nothing.
//
// A directional light alone gives you a lit side and a black side. Real objects
// outdoors are lit from every direction at once: blue from the sky above, warm
// bounce from the ground below. Rendering that properly is global illumination
// and is far out of budget. Approximating it is one texture: the sky is drawn
// once into a cube map, prefiltered by roughness, and handed to every material
// as `envMap`. Every surface then samples the whole sky instead of one lamp.
//
// The result is the soft, rounded, weighty look that stylised games are after.
// It is generated at load, never updated, and costs nothing per frame.

import * as THREE from 'three';

/** Colours of the dome, ground up. Saturated on purpose: this sets the palette. */
// ── THE COLOUR STORY ────────────────────────────────────────────────────────
// ⚠ BRIGHT DAYLIGHT, and this reversed a previous decision. A twilight scene
// was built first, on a dark atmospheric reference, and it failed for a reason
// that outranks mood: THE CHARACTERS DISAPPEARED. In a game where you must read
// five bodies and a thrown skillshot at a glance, a dark scene with dark heroes
// is unplayable however good it looks in a still.
//
// The look still comes from a chosen palette rather than neutral daylight, it
// is simply chosen at the bright end: warm sun, cool sky, saturated ground.
const HORIZON = new THREE.Color('#F39C12'); // Warm Amber Golden-Hour
const MID = new THREE.Color('#3A5A60'); // Twilight Teal
const ZENITH = new THREE.Color('#112D29'); // Deep Emerald Night
/** What the ground bounces back up: Deep Emerald Teal (#112D29) */
const GROUND_BOUNCE = new THREE.Color('#112D29');

export interface SkyResult {
  dome: THREE.Mesh;
  /** Prefiltered environment, to be assigned to `scene.environment`. */
  environment: THREE.Texture;
  dispose(): void;
}

/**
 * Build the dome and bake it into an environment map.
 *
 * `renderer` is required because prefiltering runs on the GPU. It happens once.
 */
export function createSky(renderer: THREE.WebGLRenderer): SkyResult {
  // ⚠ 520, NOT 160. The dome is drawn on its inside face and writes depth, so
  // it paints over anything further away than its radius. At 160 it was hiding
  // the horizon backdrop entirely: the model loaded, the material was right,
  // and the sky was simply in front of it.
  const geo = new THREE.SphereGeometry(520, 24, 16);

  // Vertex-coloured rather than textured: three stops up the dome is all the
  // gradient anyone can see, and it needs no image to download.
  const colours = new Float32Array(geo.attributes.position.count * 3);
  const pos = geo.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    // -1 at the bottom of the dome, 1 at the top.
    const t = pos.getY(i) / 520;
    if (t < 0) {
      c.copy(GROUND_BOUNCE).lerp(HORIZON, Math.min(1, (t + 1) * 1.6));
    } else {
      c.copy(HORIZON)
        .lerp(MID, Math.min(1, t * 2.2))
        .lerp(ZENITH, Math.max(0, t * 1.4 - 0.35));
    }
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    // Seen from the inside.
    side: THREE.BackSide,
    // The dome must never be shaded, fogged or tone-mapped down: it IS the
    // reference white the rest of the scene is graded against.
    fog: false,
    toneMapped: false,
  });

  const dome = new THREE.Mesh(geo, mat);
  dome.name = 'sky';
  // Follows the camera in the frame loop; without this the dome's far side
  // clips as the camera moves across a large arena.
  dome.frustumCulled = false;

  // Bake. PMREM prefilters the cube by roughness, which is what lets a rough
  // surface sample a blurred sky and a smooth one sample a sharp sky.
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const scene = new THREE.Scene();
  scene.add(dome.clone());
  const environment = pmrem.fromScene(scene, 0.04).texture;
  pmrem.dispose();

  return {
    dome,
    environment,
    dispose: () => {
      geo.dispose();
      mat.dispose();
      environment.dispose();
    },
  };
}
