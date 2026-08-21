// A real character: rigged, skinned, animated, and recoloured per hero.
//
// ── WHY ONE MODEL SERVES FIVE HEROES ────────────────────────────────────────
// The model's UVs map into a small grid of flat colour swatches rather than a
// painted texture. So a hero's look is produced by PAINTING AN 8x4 CANVAS at
// runtime and handing it over as the albedo map. One 3.4MB download, five
// distinct characters, and adding a sixth costs nothing but a palette.
//
// ⚠ NEAREST FILTERING, NOT LINEAR. Linear blends neighbouring swatches along
// every UV seam and fringes the whole character with colours that belong to a
// different body part.
//
// ⚠ flipY = false. glTF's UV origin is the opposite of a canvas's, and getting
// this wrong maps every part of the body to the wrong swatch.
//
// ── WHY CLONING NEEDS SkeletonUtils ─────────────────────────────────────────
// A plain Object3D.clone() copies the meshes and shares the skeleton, so every
// character animates in lockstep with the first one. SkeletonUtils.clone gives
// each copy its own bones while still sharing the geometry on the GPU.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Hero } from '@/game/heroes';

/** What the game asks for; the clip that plays is chosen below. */
export type Motion = 'idle' | 'walk' | 'run' | 'attack' | 'cast' | 'dodge' | 'hit' | 'death';

/**
 * Which of the model's 76 clips each motion uses.
 *
 * Named explicitly rather than matched by substring, because the pack contains
 * several near-identical variants and picking a different one per session makes
 * the game feel inconsistent for no reason.
 */
const CLIP: Record<Motion, string> = {
  idle: 'Idle',
  walk: 'Walking_A',
  run: 'Running_A',
  attack: '1H_Melee_Attack_Slice_Diagonal',
  cast: 'Spellcast_Shoot',
  dodge: 'Dodge_Forward',
  hit: 'Hit_A',
  death: 'Death_A',
};

/** Motions that must finish rather than loop. */
const ONCE: ReadonlySet<Motion> = new Set(['attack', 'cast', 'dodge', 'hit', 'death']);

type Swatch =
  | 'skin'
  | 'skinShade'
  | 'hair'
  | 'cap'
  | 'cloth'
  | 'clothShade'
  | 'trousers'
  | 'trousersLight'
  | 'metal'
  | 'dark'
  | 'neutral';

/**
 * Which swatch each cell of the atlas holds.
 *
 * ⚠ THIS MAP IS THE MODEL'S, NOT OURS. It was recovered by reading the UV
 * histogram of this exact file; a different character pack would need it done
 * again. Cell (1,0) is the hood and nothing else uses it, which is worth
 * knowing because mapping it to trousers puts a blue-grey helmet on everyone.
 */
const CELL_SWATCH: Record<string, Swatch> = {
  '0,0': 'skin',
  '6,3': 'skin',
  '7,3': 'skin',
  '0,2': 'skinShade',
  '2,0': 'hair',
  '1,0': 'cap',
  '1,1': 'cloth',
  '0,1': 'clothShade',
  '6,0': 'trousers',
  '6,1': 'trousers',
  '7,1': 'trousers',
  '5,2': 'trousers',
  '4,2': 'trousers',
  '5,0': 'trousersLight',
  '5,1': 'trousersLight',
  '3,2': 'trousersLight',
  '3,0': 'metal',
  '2,1': 'metal',
  '3,1': 'metal',
  '4,0': 'metal',
  '4,1': 'metal',
  '7,0': 'neutral',
  '6,2': 'neutral',
  '7,2': 'neutral',
};

const COLS = 8;
const ROWS = 4;
/** Flat colour per cell, so the atlas can stay tiny. */
const CELL = 64;

/**
 * Sub-meshes that are the adventurer's KIT rather than the person.
 *
 * ⚠ THESE ARE NODE NAMES, which is what three.js puts on `mesh.name`. Using the
 * glTF MESH names instead ("Cylinder.002") matches nothing at runtime and every
 * hero keeps carrying two daggers and a crossbow.
 */
const DRESSING: ReadonlySet<string> = new Set([
  'Knife',
  'Knife_Offhand',
  '1H_Crossbow',
  '2H_Crossbow',
  'Throwable',
  'Rogue_Cape',
]);

/**
 * Which node each gear slot turns on.
 *
 * Everything in DRESSING is hidden by default and a hero reveals only what
 * belongs to them. It is a small amount of silhouette from a shared body, and
 * small is not nothing: a robe, a pair of blades or a slung weapon is what the
 * eye reads before it reads a colour.
 */
const GEAR_NODES: Record<string, string[]> = {
  cape: ['Rogue_Cape'],
  knives: ['Knife', 'Knife_Offhand'],
  crossbow: ['2H_Crossbow'],
  pouch: ['Throwable'],
};

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
}

/** Paint the atlas from a hero's palette. */
export function paletteTexture(hero: Hero): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * CELL;
  canvas.height = ROWS * CELL;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context for the character palette');

  const colours: Record<Swatch, string> = {
    skin: hero.palette.skin,
    skinShade: shade(hero.palette.skin, -0.07),
    hair: hero.palette.hair,
    // ⚠ THE HOOD IS THE HERO'S OUTFIT, NOT THEIR HAIR. From a camera looking
    // down at the field, the hood is the single largest area of a character on
    // screen: it is most of what a player actually sees. Mapping it to hair
    // made every hero a black blob from above no matter what palette they had,
    // which is why five distinctly coloured heroes still read as one person.
    cap: hero.palette.cloth,
    cloth: hero.palette.cloth,
    clothShade: shade(hero.palette.cloth, -0.1),
    trousers: shade(hero.palette.cloth, -0.16),
    trousersLight: shade(hero.palette.cloth, -0.06),
    // Hardware is NOT hero-coloured. Buckles and straps that follow the outfit
    // make a character read as a costume rather than as a person wearing things.
    metal: '#8b949a',
    dark: '#191d1f',
    // Straps, belts and trim. The accent goes here so each hero carries a
    // second identifying colour that reads at distance.
    neutral: hero.palette.accent,
  };

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = colours[CELL_SWATCH[`${c},${r}`] ?? 'neutral'];
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  return tex;
}

export interface Character {
  object: THREE.Object3D;
  update(dt: number): void;
  play(motion: Motion, fade?: number): void;
  setPosition(x: number, y: number, z: number): void;
  setFacing(radians: number): void;
  dispose(): void;
}

/** Loaded once and cloned per character. */
let template: Promise<{ scene: THREE.Group; clips: THREE.AnimationClip[] }> | null = null;

function loadTemplate(url: string) {
  template ??= new GLTFLoader().loadAsync(url).then((g) => ({
    scene: g.scene,
    clips: g.animations,
  }));
  return template;
}

/**
 * A hero that has its own generated, rigged model.
 *
 * ── WHY THIS IS A SEPARATE PATH ─────────────────────────────────────────────
 * Nothing about it matches the shared adventurer. Different skeleton, 24 joints
 * instead of 41, no palette atlas because it arrives textured, and its own clip
 * names. Forcing both through one function would mean a body of conditionals
 * where every branch is "unless it is the other kind".
 *
 * ⚠ THE WALK ARRIVES IN A SECOND FILE. The rig ships a single pose clip, and
 * the animation comes back as a whole separate skinned GLB. Only its
 * AnimationClip is used; the duplicate mesh inside it is discarded, which is
 * why the file is loaded and then mostly thrown away.
 */
async function createGeneratedHero(hero: Hero): Promise<Character> {
  const spec = hero.model!;
  const gltf = await new GLTFLoader().loadAsync(spec.rigged);
  const object = gltf.scene;

  object.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    // A skinned mesh is bounded by its bind pose, so three.js culls it as soon
    // as an animation moves it out of one. It is never off-screen here.
    m.frustumCulled = false;
  });

  // Generated models arrive at an arbitrary scale. Measured and fitted so the
  // arena's numbers stay the truth, exactly as the props are.
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  const unit = (1.75 * hero.build.scale) / Math.max(size.y, 0.0001);
  object.scale.setScalar(unit);
  object.position.y = -box.min.y * unit;

  const rig = new THREE.Group();
  rig.add(object);

  const mixer = new THREE.AnimationMixer(object);
  const clips = [...gltf.animations];
  if (spec.walk) {
    try {
      const walkGltf = await new GLTFLoader().loadAsync(spec.walk);
      // Renamed so the motion map below can find it regardless of what the
      // generator called it.
      for (const c of walkGltf.animations) clips.push(Object.assign(c.clone(), { name: 'walk' }));
    } catch {
      /* no walk file: the hero stands still, which is not worth failing over */
    }
  }

  const idle = clips[0];
  const walk = clips.find((c) => c.name === 'walk') ?? idle;
  const actions = new Map<Motion, THREE.AnimationAction>();
  if (idle) actions.set('idle', mixer.clipAction(idle));
  if (walk) {
    actions.set('walk', mixer.clipAction(walk));
    // No run clip exists yet, so running plays the walk faster rather than
    // freezing. Honest placeholder, and it reads better than a T-pose.
    const running = mixer.clipAction(walk.clone());
    running.timeScale = 1.55;
    actions.set('run', running);
  }

  let current: Motion | null = null;
  function play(motion: Motion, fade = 0.18): void {
    if (motion === current) return;
    const next = actions.get(motion) ?? actions.get('idle');
    if (!next) return;
    const prev = current ? actions.get(current) : undefined;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (prev && prev !== next) prev.fadeOut(fade);
    current = motion;
  }
  play('idle', 0);

  return {
    object: rig,
    update: (dt) => mixer.update(dt),
    play,
    setPosition: (x, y, z) => rig.position.set(x, y, z),
    setFacing: (radians) => {
      rig.rotation.y = radians;
    },
    dispose: () => mixer.stopAllAction(),
  };
}

export async function createCharacter(url: string, hero: Hero): Promise<Character> {
  // A hero with its own model never touches the shared body or its palette.
  if (hero.model) return createGeneratedHero(hero);

  const { scene, clips } = await loadTemplate(url);

  const object = cloneSkinned(scene);
  const texture = paletteTexture(hero);

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    // ⚠ NOT flatShading. Smooth normals are the whole difference between a
    // character that reads as modelled and one that reads as faceted, and the
    // model already ships with the normals to do it.
    roughness: 0.72,
    metalness: 0.02,
  });

  const worn = new Set(hero.build.gear.flatMap((g) => GEAR_NODES[g] ?? []));

  object.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    // The adventurer's own kit: hidden unless this hero is carrying it.
    if (DRESSING.has(m.name)) {
      m.visible = worn.has(m.name);
      if (!m.visible) return;
    }
    m.material = material;
    m.castShadow = true;
    m.receiveShadow = true;
    // Skinned meshes are bounded by their bind pose, so three.js culls them the
    // moment an animation moves them out of it. They are never off-screen here.
    m.frustumCulled = false;
  });

  // ⚠ SCALE THE WRAPPER, NOT THE MODEL. Scaling the skinned object itself
  // fights the skeleton and the bind pose, and bulk is applied on X and Z only
  // so a heavy hero gets wider rather than taller.
  const rig = new THREE.Group();
  rig.add(object);
  object.scale.set(
    hero.build.scale * hero.build.bulk,
    hero.build.scale,
    hero.build.scale * hero.build.bulk
  );

  const mixer = new THREE.AnimationMixer(object);
  const actions = new Map<Motion, THREE.AnimationAction>();
  for (const [motion, name] of Object.entries(CLIP) as [Motion, string][]) {
    const clip = clips.find((c) => c.name === name);
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    if (ONCE.has(motion)) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    actions.set(motion, action);
  }

  let current: Motion | null = null;

  function play(motion: Motion, fade = 0.18): void {
    if (motion === current) return;
    const next = actions.get(motion);
    if (!next) return;
    const prev = current ? actions.get(current) : undefined;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    prev?.fadeOut(fade);
    current = motion;
  }

  play('idle', 0);

  return {
    object: rig,
    update: (dt) => mixer.update(dt),
    play,
    setPosition: (x, y, z) => rig.position.set(x, y, z),
    setFacing: (radians) => {
      rig.rotation.y = radians;
    },
    dispose: () => {
      mixer.stopAllAction();
      texture.dispose();
      material.dispose();
    },
  };
}
