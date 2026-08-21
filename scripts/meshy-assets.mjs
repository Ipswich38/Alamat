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
