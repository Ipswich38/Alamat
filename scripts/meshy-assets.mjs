#!/usr/bin/env node
// Generate the models worth paying for.
//
// SAFE BY DEFAULT: a bare run spends nothing and reports the balance. Credits
// leave only when an asset is named.
//
// ⚠ NOT EVERYTHING EARNS A MODEL. A rock, a tuft of grass and a flower are
// already fine as primitives, and 30 credits to replace a rock with a slightly
// better rock is waste. What earns a model is anything that carries the SETTING
// or the CHARACTER: the balete, the anito shrine, the creatures. Those are what
// make the arena read as Philippine folklore rather than as generic fantasy,
// and no amount of tuning primitives will get there.
//
// ⚠ art_style must be 'realistic'. The API rejects every other value, so all
// stylisation has to come from the prompt itself.
//
// ⚠ Only the refine stage produces textures. A preview is untextured geometry.

import { apiKey, balance, generate } from './lib/meshy.mjs';

const OUT_DIR = 'public/models';

const COMMON =
  'Stylised game asset, chunky readable forms, clean silhouette, bright saturated colours, ' +
  'no text, no lettering, seen from above at a shallow angle. ';

export const ASSETS = {
  balete: {
    dir: `${OUT_DIR}/nature`,
    prompt:
      COMMON +
      'An ancient Philippine balete tree: a wide gnarled trunk formed from many fused woody strands, ' +
      'a curtain of thin aerial roots hanging from the lower branches down towards the ground, ' +
      'a broad rounded canopy of dense dark green leaves, mossy bark, standing alone.',
    texture:
      'Weathered grey-brown bark with green moss in the crevices, deep green foliage with lighter ' +
      'sunlit leaves on top, damp and old.',
  },
  anito: {
    dir: `${OUT_DIR}/nature`,
    prompt:
      COMMON +
      'A carved Philippine anito ancestor figure: a standing wooden post totem with a simplified ' +
      'human face and folded arms, weathered and cracked, set into a low ring of stacked river ' +
      'stones, small offerings at its base.',
    texture:
      'Dark weathered hardwood with pale cracks, grey river stone, patches of green moss, ' +
      'faded red ochre pigment worn into the carved lines.',
  },
  // ⚠ CHARACTER PROMPTS ARE DIFFERENT FROM PROP PROMPTS. A rig needs limbs it
  // can find, so the pose is stated explicitly and the silhouette is kept clear
  // of the body. Anything clutched to the chest or wrapped around the legs
  // gives an auto-rigger nothing to work with.
  tikbalang: {
    dir: `${OUT_DIR}/heroes`,
    // ⚠ NOTE WHAT IS ABSENT: no digitigrade legs, no backward-bent hocks. The
    // first attempt asked for anatomically correct Tikbalang legs and got a
    // long-bodied figure 0.42 wide by 1.63 deep that the rigger refused with
    // "pose estimation failed". An auto-rigger looks for a HUMAN skeleton, so
    // the character has to stand like a person and be a horse from the neck up.
    // The A-pose is stated twice for the same reason.
    prompt:
      'Stylised 3D MOBA character model, cute friendly male Tikbalang, anthropomorphic ' +
      'horse-human hybrid, heroic stylised proportions like a League of Legends champion. ' +
      'Expressive big brown eyes, soft friendly facial features, fluffy mane, small horse ears, ' +
      'slightly oversized hooves. Wearing rustic fantasy armour made of carved oak wood, woven ' +
      'leaves and bronze accents. Carrying a glowing jade spear. Standing upright on two legs in ' +
      'a neutral A-pose, arms held away from the body, legs straight and slightly apart, facing ' +
      'forward. Clean readable silhouette, game-ready character mesh, A-pose.',
    texture:
      'Vibrant hand-painted stylised texturing, warm chestnut brown horse coat, darker brown mane, ' +
      'carved oak wood armour with bronze trim, green woven leaves, glowing jade green spear blade, ' +
      'clean saturated colours, no photoreal grain.',
  },
  aswang: {
    dir: `${OUT_DIR}/heroes`,
    // ⚠ NO PEDESTAL. The reference prompt asked for "a simple flat pedestal",
    // which a generator models as GEOMETRY welded to the feet: a hero who
    // stands on a disc forever. Portfolio-render wording has to be stripped out
    // of anything destined for a game engine.
    //
    // ⚠ WINGS ARE A RIGGING RISK for the same reason horse legs were. Anything
    // large held away from the torso can confuse pose estimation, so the biped
    // stance is stated twice and the wings are described as FOLDED BACK.
    prompt:
      'Stylised 3D MOBA character model, cute friendly Aswang, bat-like anthropomorphic creature ' +
      'with soft feline facial features and expressive big amber eyes, large pointed bat ears. ' +
      'Standing upright on two legs like a person, neutral A-pose, arms held away from the body, ' +
      'legs straight and slightly apart, facing forward. Bat wings folded back close against the ' +
      'shoulders, long tufted tail. Agile athletic assassin build. Wearing ornate tribal-fantasy ' +
      'leather and purple scaled armour with glowing arcane filigree and gem accents. Dual-wielding ' +
      'curved daggers. Clean readable silhouette, game-ready character mesh, A-pose, no base, ' +
      'no pedestal, no stand.',
    texture:
      'Vibrant hand-painted stylised texturing, dusky grey-brown fur, deep purple scaled armour with ' +
      'gold trim, glowing violet runic filigree, magenta gem accents, glowing purple dagger blades, ' +
      'saturated and clean, no photoreal grain.',
  },
  // ── MAP SET PIECES ────────────────────────────────────────────────────────
  // ⚠ EXTRACTED FROM SCENE DESCRIPTIONS, NEVER FED ONE. "A wide circular plaza
  // with balete trees and ruins" is a SCENE, and a generator returns a lumpy
  // mound for a scene: that is what happened to the first balete. Each entry
  // below is ONE OBJECT lifted out of a location description, which is the form
  // this tool actually succeeds at.
  //
  // Towers first because there are eighteen of them on a map and they are the
  // single highest-leverage thing on it.
  towerDiwata: {
    dir: `${OUT_DIR}/props`,
    prompt:
      'Stylised 3D game prop, single object, a celestial guardian tower. A tall carved column of ' +
      'pale white stone and warm natural wood, wrapped in intricate geometric sun motifs, topped ' +
      'with a small glowing spirit totem carved as a serene face. Gold banding, a ring of floating ' +
      'stone shards near the crown. Standing upright, clean readable silhouette, seen from above at ' +
      'a shallow angle. No ground, no base plinth, no terrain, no background.',
    texture:
      'Hand-painted stylised texturing, warm cream limestone with gold inlay, honey-toned carved ' +
      'wood, glowing pale blue spirit light at the crown, clean saturated colours.',
  },
  towerAswang: {
    dir: `${OUT_DIR}/props`,
    prompt:
      'Stylised 3D game prop, single object, a menacing volcanic guardian tower. A jagged spire of ' +
      'razor-sharp black obsidian and charred dark wood, bound with rusted iron, topped with a ' +
      'glowing red rune-carved crystal eye. Cracks of molten lava run up the shaft. Standing ' +
      'upright, clean readable silhouette, seen from above at a shallow angle. No ground, no base ' +
      'plinth, no terrain, no background.',
    texture:
      'Hand-painted stylised texturing, glossy black obsidian with sharp facets, charred wood, ' +
      'rusted iron bands, glowing molten orange cracks, intense red crystal at the crown.',
  },
  diwata: {
    dir: `${OUT_DIR}/heroes`,
    // ⚠ "FLOATING POSE" WAS REMOVED FROM THE REFERENCE PROMPT. The auto-rigger
    // works by finding a human skeleton, and it already refused one character
    // this week for having non-human legs. A figure with its feet off the
    // ground and its weight nowhere is the same class of risk, and losing the
    // rig would cost more than losing the pose.
    //
    // The ethereal reading is kept by the WINGS and the glow rather than by the
    // stance, and a floating idle can be animated later by lifting the whole
    // rig, which is a transform rather than a mesh problem.
    prompt:
      'Stylised 3D MOBA character model of a Diwata, Philippine forest fairy goddess, League of ' +
      'Legends character design, semi-realistic stylised art style. Standing upright on two legs, ' +
      'neutral A-pose, arms held away from the body, legs straight and slightly apart, facing ' +
      'forward. Vibrant nature armour of woven leaves with gold trim, glowing ethereal flora, ' +
      'translucent iridescent butterfly wings held back from the shoulders, holding a wooden staff ' +
      'entwined with glowing vines and sampaguita flowers. Clean geometry, clean readable ' +
      'silhouette, game-ready character mesh, A-pose, no base, no pedestal, no stand.',
    texture:
      'Hand-painted stylised texturing, warm golden-brown skin, emerald woven leaf armour with gold ' +
      'trim, translucent iridescent wings shading violet to teal, glowing pale green vines, white ' +
      'sampaguita blossoms, saturated and clean, not photorealistic.',
  },
  anitoCore: {
    dir: `${OUT_DIR}/props`,
    prompt:
      'Stylised MOBA core base structure, low-poly 3D game asset, SINGLE OBJECT. An ancient ' +
      'pre-colonial Philippine stone shrine with carved wooden ancestor faces and tribal baybayin ' +
      'etchings, an elevated stone altar, and a glowing amber-yellow crystal resting above its ' +
      'centre. Standing upright, clean readable silhouette from above at a shallow angle, clean ' +
      'topology, game-ready. No ground, no terrain, no base plinth, no background.',
    texture:
      'Hand-painted stylised texturing, warm grey weathered stone with carved shadow lines, ' +
      'honey-toned hardwood faces, ochre and white baybayin pigment, intense glowing amber crystal, ' +
      'clean saturated colours, not photorealistic.',
  },
  watchtower: {
    dir: `${OUT_DIR}/props`,
    prompt:
      'Stylised MOBA defensive tower, low-poly 3D game asset, SINGLE OBJECT. An ancient Filipino ' +
      'tribal watchtower of lashed bamboo logs on a sturdy stone foundation, topped with a carved ' +
      'glowing spirit mask, intricate okir scrollwork carved along the timber. Tall and upright, ' +
      'clean readable silhouette seen from above at a shallow angle, clean topology, game-ready. ' +
      'No ground, no terrain, no base plinth, no background.',
    texture:
      'Hand-painted stylised texturing, pale golden bamboo bound with dark rattan lashings, grey ' +
      'weathered stone footing, carved okir shadow lines, a glowing pale spirit mask at the top, ' +
      'clean saturated colours, not photorealistic.',
  },
  palisade: {
    dir: `${OUT_DIR}/props`,
    // ⚠ A SECTION, NOT A WALL. Asked for as "a palisade wall" a generator
    // returns one long bespoke run that cannot be repeated without the joins
    // showing. A SECTION with flat ends tiles along an arc, which is what a
    // base perimeter actually needs.
    prompt:
      'Stylised wooden palisade fence SECTION, low-poly 3D game prop, single straight run with ' +
      'flat ends so it can be repeated end to end. Sharpened bamboo and dark timber stakes bound ' +
      'with natural rope, reinforced by a carved wooden totem post at one end. Pre-colonial ' +
      'Philippine tribal aesthetic, upright, clean readable silhouette from above at a shallow ' +
      'angle. No ground, no terrain, no base plinth, no background.',
    texture:
      'Hand-painted stylised texturing, pale golden bamboo and dark weathered hardwood, natural ' +
      'fibre rope lashings, carved totem with ochre pigment, clean saturated colours.',
  },
  bakunawa: {
    dir: `${OUT_DIR}/creatures`,
    prompt:
      COMMON +
      'The Bakunawa, a Philippine moon-eating sea serpent: an enormous coiled dragon-serpent with ' +
      'a whiskered fish-like head, a wide fanged mouth, large round eyes, a fin crest running down ' +
      'its spine and two small clawed forelimbs, body covered in overlapping scales.',
    texture:
      'Iridescent deep blue-green scales shading to pale silver on the belly, dark fins with a faint ' +
      'moonlit sheen, wet and reflective.',
  },
  kapre: {
    dir: `${OUT_DIR}/creatures`,
    prompt:
      COMMON +
      'The Kapre, a Philippine tree giant: a huge broad-shouldered hairy humanoid sitting cross-legged, ' +
      'dark skin, thick shaggy black hair and beard, wearing only a loincloth, holding a long lit ' +
      'cigar, heavy brows and calm eyes.',
    texture:
      'Very dark brown skin with a rough matte finish, coarse black hair, faded woven loincloth, ' +
      'glowing orange cigar ember.',
  },
};

const key = apiKey();
if (!key) {
  console.error('No MESHY_API_KEY in the environment or .env.local.');
  process.exit(1);
}

const args = process.argv.slice(2);
const mode = args.includes('--refine') ? 'refine' : args.includes('--generate') ? 'preview' : null;
const name = args[args.indexOf(mode === 'refine' ? '--refine' : '--generate') + 1];

const credits = await balance(key);
console.log(`Balance: ${credits} credits (~${Math.floor(credits / 30)} full models)\n`);

if (!mode || !ASSETS[name]) {
  console.log('Assets:', Object.keys(ASSETS).join(', '));
  console.log('\n  Preview (20cr, untextured):  node scripts/meshy-assets.mjs --generate balete');
  console.log('  Refine  (10cr, textures):    node scripts/meshy-assets.mjs --refine balete');
  process.exit(0);
}

const art = ASSETS[name];
await generate(key, { id: name, dir: art.dir, mode, art, polycount: 12000 });
console.log(`\nRemaining: ${await balance(key)} credits`);
