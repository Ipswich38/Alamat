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
// A humid forest at dusk. One dominant hue with warm light cutting through it,
// which is how every stylised game worth copying handles atmosphere: a bright
// neutral daylight makes a scene accurate and dull, because nothing in it is
// pulled toward anything.
//
// It is also the right choice for the subject. This is folklore, and every
// creature in it is one you meet at twilight.
const HORIZON = new THREE.Color('#7fbfa8');
const MID = new THREE.Color('#2f7f86');
const ZENITH = new THREE.Color('#123f52');
/** What the ground bounces back up: damp, dark, green. */
const GROUND_BOUNCE = new THREE.Color('#22402f');

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
  const geo = new THREE.SphereGeometry(160, 24, 16);

  // Vertex-coloured rather than textured: three stops up the dome is all the
  // gradient anyone can see, and it needs no image to download.
  const colours = new Float32Array(geo.attributes.position.count * 3);
  const pos = geo.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    // -1 at the bottom of the dome, 1 at the top.
    const t = pos.getY(i) / 160;
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
