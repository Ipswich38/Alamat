#!/usr/bin/env node
// Generate the models worth paying for.
//
// SAFE BY DEFAULT: a bare run spends nothing and reports the balance. Credits
// leave only when an asset is named.
//
// ⚠ NOT EVERYTHING EARNS A MODEL. A rock, a tuft of grass and a flower are
// already fine as primitives, and 30 credits to replace a rock with a slightly
// better rock is waste. What earns a model is anything that carries the SETTING
// or the CHARACTER: the banyan, the dawn shrine, the creatures. Those are what
// make the arena read as Philippine folklore rather than as generic fantasy,
// and no amount of tuning primitives will get there.
//
// ⚠ art_style must be 'realistic'. The API rejects every other value, so all
// stylisation has to come from the prompt itself.
//
// ⚠ Only the refine stage produces textures. A preview is untextured geometry.
//
// ⚠ THE AUTO-RIGGER NEEDS TO SEE TWO LEGS. Thistle was first described in
// "layered robes" and the rig came back 422 "Pose estimation failed" after the
// 30 credits for preview and refine were already spent. A floor-length garment
// is one silhouette with no limbs in it. Any character that must rig wears a
// KNEE LENGTH garment over trousers or leggings, states that BOTH LEGS ARE
// FULLY VISIBLE AND CLEARLY SEPARATE, and carries nothing in its hands.

import { apiKey, balance, generate } from './lib/meshy.mjs';

const OUT_DIR = 'public/models';

const COMMON =
  'Stylised game asset, chunky readable forms, clean silhouette, bright saturated colours, ' +
  'no text, no lettering, seen from above at a shallow angle. ';

export const ASSETS = {
  banyan: {
    dir: `${OUT_DIR}/nature`,
    // ⚠ SECOND ATTEMPT. The first asked for "a curtain of thin aerial roots
    // hanging down towards the ground", which describes a SCENE, and it came
    // back a lumpy mound with no trunk and no silhouette. This version asks for
    // a trunk that the roots FORM, which is one object with structure.
    prompt:
      'Stylised giant Banyan tree, low-poly 3D environment prop, SINGLE OBJECT. Massive twisted ' +
      'banyan roots fused into one hollow trunk, a broad rounded canopy above, bioluminescent blue ' +
      'mushrooms growing on mossy bark. Tall and upright, clean readable silhouette seen from above ' +
      'at a shallow angle, fantasy jungle. No ground, no terrain, no base plinth, no background.',
    texture:
      'Hand-painted stylised texturing, grey-brown twisted bark with deep shadow lines, green moss ' +
      'in the crevices, deep green canopy with lighter sunlit leaves, glowing cyan mushrooms, ' +
      'clean saturated colours, not photorealistic.',
  },
  dawn: {
    dir: `${OUT_DIR}/nature`,
    prompt:
      COMMON +
      'A carved Philippine dawn ancestor figure: a standing wooden post totem with a simplified ' +
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
  veer: {
    dir: `${OUT_DIR}/heroes`,
    // ⚠ NOTE WHAT IS ABSENT: no digitigrade legs, no backward-bent hocks. The
    // first attempt asked for anatomically correct Veer legs and got a
    // long-bodied figure 0.42 wide by 1.63 deep that the rigger refused with
    // "pose estimation failed". An auto-rigger looks for a HUMAN skeleton, so
    // the character has to stand like a person and be a horse from the neck up.
    // The A-pose is stated twice for the same reason.
    prompt:
      'Stylised 3D MOBA character model, cute friendly male Veer, anthropomorphic ' +
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
  // ── Heroes that were sharing another hero's model ────────────────────────
  //
  // Nine heroes shipped against three rigged models: Veer stood in for
  // Bedrock and Zenith, Willow for Thistle and Argent, Hollow for
  // Sever. The Willow and Hollow groups at least share a silhouette. The
  // Veer one does not: it is a horse from the neck up, and putting that
  // head on a human strongman and a sun god is the mismatch you actually see.
  // These two come first for that reason.
  //
  // Every constraint below was learned on the heroes above and is not optional:
  // stand like a person or the auto-rigger refuses, state the A-pose twice, and
  // never mention a pedestal or it gets modelled onto the feet.
  bedrock: {
    dir: `${OUT_DIR}/heroes`,
    prompt:
      'Stylised 3D MOBA character model, heroic young Filipino folk strongman, human male, ' +
      'heroic stylised proportions like a League of Legends champion. Broad powerful shoulders and ' +
      'thick arms, determined friendly face, short dark hair tied back with a woven headband. ' +
      'Bare chested with a woven abaca sash across the torso, simple dark trousers, wide leather ' +
      'belt with a carved stone buckle. Heavy stone shackles broken open around both wrists, short ' +
      'lengths of chain still hanging. Standing upright on two legs in a neutral A-pose, arms held ' +
      'away from the body, legs straight and slightly apart, facing forward. Clean readable ' +
      'silhouette, game-ready character mesh, A-pose. No base, no plinth, no ground, no background.',
    texture:
      'Vibrant hand-painted stylised texturing, warm brown skin, black hair, natural cream abaca ' +
      'sash, deep indigo trousers, weathered grey granite shackles with pale fracture lines, ' +
      'aged bronze chain, clean saturated colours, no photoreal grain.',
  },

  zenith: {
    dir: `${OUT_DIR}/heroes`,
    prompt:
      'Stylised 3D MOBA character model, heroic FILIPINO sun god warrior, SOUTHEAST ASIAN man with warm brown skin and jet BLACK hair, ' +
      'stylised proportions like a League of Legends champion. Confident noble Filipino face, strong ' +
      'jaw, black topknot. NOT european, NOT blond, NOT pale skinned. Wearing burnished gold scale armour over one shoulder, an ornate sun disc ' +
      'breastplate with radiating rays, a red woven cape falling behind, gold arm bands. Holding a ' +
      'short curved blade sword at his side. Standing upright on two legs in a neutral A-pose, ' +
      'arms held away from the body, legs straight and slightly apart, facing forward. Clean ' +
      'readable silhouette, game-ready character mesh, A-pose. No base, no plinth, no background.',
    texture:
      'Vibrant hand-painted stylised texturing, DEEP WARM BROWN Filipino skin, JET BLACK hair, ' +
      'polished gold armour with deep ' +
      'shadow lines, glowing amber sun disc, deep crimson cape, dark steel blade with a gold hilt, ' +
      'clean saturated colours, no photoreal grain.',
  },

  thistle: {
    dir: `${OUT_DIR}/heroes`,
    prompt:
      'Stylised 3D MOBA character model, Filipino village witch, older human woman, heroic ' +
      'stylised proportions like a League of Legends champion. Sharp knowing face, long grey ' +
      'streaked black hair, a woven bamboo hat pushed back on her shoulders. Wearing layered dark ' +
      'earth-toned KNEE LENGTH tunic over narrow dark trousers so BOTH LEGS ARE FULLY VISIBLE AND ' +
      'CLEARLY SEPARATE, a beaded neckpiece, a pouch belt of small bottles and bone ' +
      'needles at her waist. Arms empty, hands open. Standing upright on ' +
      'two legs in a neutral A-pose, arms held away from the body, legs straight and slightly ' +
      'apart, facing forward. Clean readable silhouette, game-ready character mesh, A-pose. ' +
      'No base, no plinth, no ground, no background.',
    texture:
      'Vibrant hand-painted stylised texturing, warm brown skin, grey and black hair, deep maroon ' +
      'and umber robes, pale straw hat, bone-white needles, dull red thread, clean saturated ' +
      'colours, no photoreal grain.',
  },

  argent: {
    dir: `${OUT_DIR}/heroes`,
    prompt:
      'Stylised 3D MOBA character model, Filipino moon goddess, young human woman, heroic stylised ' +
      'proportions like a League of Legends champion. Serene face, one eye closed by an old scar, ' +
      'long flowing dark hair. Wearing pale silver-white flowing robes with a crescent moon ' +
      'headpiece over a KNEE LENGTH tunic and fitted leggings so BOTH LEGS ARE FULLY VISIBLE AND ' +
      'CLEARLY SEPARATE, silver arm bands, a short shoulder cape NOT trailing to the ground. ' +
      'Arms empty, hands open. Standing upright on two legs in a neutral A-pose, arms held away ' +
      'from the body, legs straight and slightly apart, facing forward. Clean readable ' +
      'silhouette, game-ready character mesh, A-pose. No base, no plinth, no background.',
    texture:
      'Vibrant hand-painted stylised texturing, cool pale skin, black hair with silver sheen, ' +
      'moonlight white and pale blue robes, polished silver headpiece and staff, soft cyan glow on ' +
      'the crescent blade, clean saturated colours, no photoreal grain.',
  },

  // ⚠ REJECTED ONCE, 2026-08-29. The first attempt returned a generic horned
  // winged demon, bare chested, which Google Play would not accept. Two things
  // were wrong with the prompt: it never said what a sever actually IS,
  // and it never insisted on clothing.
  //
  // THE CREATURE: a woman who SEVERS AT THE WAIST after dark. The upper half
  // flies on huge bat wings, trailing entrails; the lower half is left standing
  // where she split. She is not a demon and has no horns.
  //
  // ⚠ THE CONFLICT THAT HAS NO CLEAN ANSWER YET: the auto-rigger needs two
  // legs, and the defining feature of this creature is that it has none. So
  // this prompt asks for the WHOLE woman, pre-transformation, wings furled, and
  // the severing is left to the game to portray rather than the model. Asking
  // Meshy for a half body will fail pose estimation exactly as the robes did.
  sever: {
    dir: `${OUT_DIR}/heroes`,
    prompt:
      'Stylised 3D MOBA character model, Filipino folklore woman before her night transformation, ' +
      'SOUTHEAST ASIAN woman with warm brown skin and long black hair, heroic stylised proportions ' +
      'like a League of Legends champion. Calm unsettling face, NO horns, NOT a demon, NOT ' +
      'devilish. Large leathery bat wings furled close behind her back. FULLY CLOTHED in a modest ' +
      'high necked dark red KNEE LENGTH dress over dark leggings, chest and shoulders completely ' +
      'covered, so BOTH LEGS ARE FULLY VISIBLE AND CLEARLY SEPARATE. Arms empty, hands open. ' +
      'Standing upright on two legs in a neutral A-pose, arms held away from the body, legs ' +
      'straight and slightly apart, facing forward. Clean readable silhouette, game-ready ' +
      'character mesh, A-pose. No base, no plinth, no background.',
    texture:
      'Vibrant hand-painted stylised texturing, warm brown Filipino skin, long black hair, deep ' +
      'blood red dress, dark charcoal wing membrane with lighter veining, clean saturated colours, ' +
      'no photoreal grain.',
  },

  // ⚠ Maw is a moon-eating SERPENT in the folklore, and an auto-rigger
  // needs a human skeleton, so this is deliberately a humanoid naga warrior
  // rather than a snake. A true serpent would fail pose estimation exactly the
  // way the first Veer did.
  maw: {
    dir: `${OUT_DIR}/heroes`,
    prompt:
      'Stylised 3D MOBA character model, Filipino serpent deity warrior, humanoid male figure with ' +
      'blue-green dragon scales, a horned serpent head with a long jaw and whiskers, heroic ' +
      'stylised proportions like a League of Legends champion. Broad scaled shoulders, clawed ' +
      'hands, a finned crest running back from the skull, a thick tapering tail behind. Wearing ' +
      'dark lacquered plate over the chest with pearl inlays. Standing upright on two human legs ' +
      'in a neutral A-pose, arms held away from the body, legs straight and slightly apart, facing ' +
      'forward. Clean readable silhouette, game-ready character mesh, A-pose. ' +
      'No base, no plinth, no background.',
    texture:
      'Vibrant hand-painted stylised texturing, deep teal and blue-green iridescent scales, pale ' +
      'cream underbelly, black lacquered armour with pearl white inlay, amber eyes, clean ' +
      'saturated colours, no photoreal grain.',
  },

  hollow: {
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
      'Stylised 3D MOBA character model, cute friendly Hollow, bat-like anthropomorphic creature ' +
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
  // with banyan trees and ruins" is a SCENE, and a generator returns a lumpy
  // mound for a scene: that is what happened to the first banyan. Each entry
  // below is ONE OBJECT lifted out of a location description, which is the form
  // this tool actually succeeds at.
  //
  // Towers first because there are eighteen of them on a map and they are the
  // single highest-leverage thing on it.
  towerWillow: {
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
  towerHollow: {
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
  willow: {
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
      'Stylised 3D MOBA character model of a Willow, Philippine forest fairy goddess, League of ' +
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
  wardstone: {
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
  idol: {
    dir: `${OUT_DIR}/props`,
    prompt:
      'Stylised Philippine Idol rice god statue, low-poly 3D game prop, SINGLE OBJECT. An ancient ' +
      'carved dark oak seated figure with arms resting on its knees, tribal markings across the ' +
      'body, glowing blue runic accents around the eyes and chest, weathered wood grain. Upright ' +
      'and seated, clean readable silhouette from above at a shallow angle, game-ready. No ground, ' +
      'no terrain, no base plinth, no background.',
    texture:
      'Hand-painted stylised texturing, dark weathered oak with deep grain and pale cracks, ochre ' +
      'tribal markings, intense glowing cyan runes at the eyes and chest, not photorealistic.',
  },
  bridge: {
    dir: `${OUT_DIR}/props`,
    prompt:
      'Stylised wooden bridge, low-poly 3D game model, SINGLE OBJECT. A straight span built from ' +
      'thick jungle logs and woven bamboo planks, with low railings carved in okir relief along ' +
      'both sides, pre-colonial Southeast Asian design. Flat deck, flat ends so both ends meet the ' +
      'bank, seen from above at a shallow angle, game-ready topology. No ground, no terrain, no ' +
      'water, no riverbank, no base plinth, no background.',
    texture:
      'Hand-painted stylised texturing, weathered brown jungle logs, pale golden bamboo decking, ' +
      'dark rattan lashings, carved okir shadow lines on the railings, clean saturated colours.',
  },
  mayon: {
    dir: `${OUT_DIR}/nature`,
    prompt:
      'Stylised volcano mountain, low-poly 3D environment asset, SINGLE OBJECT. An iconic perfectly ' +
      'symmetrical stratovolcano cone with a wide flared base rising to a small crater, glowing ' +
      'lava veins along the crater rim, dark volcanic rock, tropical vegetation around the foot. ' +
      'Seen from a distance at eye level, clean readable silhouette. No ground plane, no terrain ' +
      'base, no plinth, no sky, no background.',
    texture:
      'Hand-painted stylised texturing, deep blue-grey volcanic rock with soft ash gradients, ' +
      'glowing orange lava at the rim, dark green vegetation at the foot, hazy and atmospheric, ' +
      'not photorealistic.',
  },
  maw: {
    dir: `${OUT_DIR}/creatures`,
    prompt:
      COMMON +
      'The Maw, a Philippine moon-eating sea serpent: an enormous coiled dragon-serpent with ' +
      'a whiskered fish-like head, a wide fanged mouth, large round eyes, a fin crest running down ' +
      'its spine and two small clawed forelimbs, body covered in overlapping scales.',
    texture:
      'Iridescent deep blue-green scales shading to pale silver on the belly, dark fins with a faint ' +
      'moonlit sheen, wet and reflective.',
  },
  treant: {
    dir: `${OUT_DIR}/creatures`,
    prompt:
      COMMON +
      'The Treant, a Philippine tree giant: a huge broad-shouldered hairy humanoid sitting cross-legged, ' +
      'dark skin, thick shaggy black hair and beard, wearing only a loincloth, holding a long lit ' +
      'cigar, heavy brows and calm eyes.',
    texture:
      'Very dark brown skin with a rough matte finish, coarse black hair, faded woven loincloth, ' +
      'glowing orange cigar ember.',
  },
  // ── VIETNAMESE MYTHIC TERRITORY: VẠN LONG UYÊN ────────────────────────────
  dongSonDrum: {
    dir: `${OUT_DIR}/props`,
    prompt:
      'Stylised Dong Son bronze drum altar monument, low-poly 3D game prop, SINGLE OBJECT. An ancient ' +
      'flared Southeast Asian bronze ceremonial drum with an iconic starburst sun medallion carved on ' +
      'the top face, geometric bird and warrior reliefs circling the bronze mantle, resting on a carved ' +
      'stone lotus base. Standing upright, clean readable silhouette from above at a shallow angle, ' +
      'game-ready topology. No ground, no terrain, no base plinth, no background.',
    texture:
      'Hand-painted stylised texturing, aged bronze with warm golden-amber highlights, emerald green ' +
      'patina in the carved grooves, deep engraved shadow lines, subtle glowing golden runes on the ' +
      'central sunburst, clean saturated colours, not photorealistic.',
  },
  kimQuyAltar: {
    dir: `${OUT_DIR}/props`,
    prompt:
      'Stylised sacred Vietnamese Golden Turtle god statue (Thần Kim Quy), low-poly 3D game prop, ' +
      'SINGLE OBJECT. A majestic ancient carved stone and bronze river turtle carrying a glowing dragon ' +
      'broadsword across its shell, adorned with sacred lotus patterns, resting with head raised calmly. ' +
      'Upright, clean readable silhouette from above at a shallow angle, game-ready. No ground, no ' +
      'terrain, no base plinth, no background.',
    texture:
      'Hand-painted stylised texturing, ancient mossy green and slate stone shell with gold filigree, ' +
      'warm bronze limbs with jade highlights, glowing cyan blade on the sword, clean saturated colours, ' +
      'not photorealistic.',
  },
  dragonSpire: {
    dir: `${OUT_DIR}/props`,
    prompt:
      'Stylised Vietnamese imperial dragon guardian pillar, low-poly 3D game prop, SINGLE OBJECT. ' +
      'A tall ornate carved wooden and stone tower column with a coiled dragon ascending towards a ' +
      'multi-tiered pagoda roof crown with sweeping curved eaves, holding a glowing jade pearl at ' +
      'the peak. Standing upright, clean readable silhouette from above at a shallow angle, game-ready. ' +
      'No ground, no terrain, no base plinth, no background.',
    texture:
      'Hand-painted stylised texturing, dark lacquered vermilion wood, gold leaf dragon scales, ' +
      'jade green glazed roof tiles, glowing emerald pearl, clean saturated colours, not photorealistic.',
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
  console.log('\n  Preview (20cr, untextured):  node scripts/meshy-assets.mjs --generate banyan');
  console.log('  Refine  (10cr, textures):    node scripts/meshy-assets.mjs --refine banyan');
  process.exit(0);
}

const art = ASSETS[name];
await generate(key, { id: name, dir: art.dir, mode, art, polycount: 12000 });
console.log(`\nRemaining: ${await balance(key)} credits`);
