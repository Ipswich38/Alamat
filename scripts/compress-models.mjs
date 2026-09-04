#!/usr/bin/env node
/*
 * Shrink the shipped models. Nothing here changes how the game looks.
 *
 * Two findings drove this:
 *
 *   1. A hero is 6.5 MB and 5.89 MB of that is ONE 2048x2048 PNG. At this
 *      camera distance 2048 is invisible; 1024 as WebP is not.
 *
 *   2. A `-walk.glb` exists only to carry its animation clip. `actor.ts` reads
 *      `walkGltf.animations` and nothing else, so its mesh, material and full
 *      size texture were shipped to every player and never drawn.
 *
 *   3. Textures were already handled by an earlier run, so the remaining bulk
 *      is GEOMETRY: 16.8 MB of the 21 MB. --meshopt compresses vertex and
 *      animation data, which nothing else here touched.
 *
 * Meshopt rather than Draco because three.js already ships the decoder module,
 * so it bundles with the app. Draco needs its decoder files hosted and fetched,
 * which is one more thing to break in an offline Android build.
 *
 * ⚠ Meshopt output only loads through a loader with the decoder installed. That
 * is src/game/render3d/gltf.ts, and every loader in the app goes through it.
 * Compressing without that wiring makes every model fail to load.
 *
 * Run: node scripts/compress-models.mjs [--meshopt] [--write]
 * Without --write it reports what it would save and touches nothing.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { readdirSync, statSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const WRITE = process.argv.includes('--write');
const MESHOPT = process.argv.includes('--meshopt');
const ROOT = 'public/models';
const BACKUP = 'assets-src/uncompressed';

await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const mb = (b) => (b / 1048576).toFixed(2);

function walkDir(d) {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walkDir(join(d, e.name)) : e.name.endsWith('.glb') ? [join(d, e.name)] : [],
  );
}

let before = 0, after = 0;
for (const file of walkDir(ROOT)) {
  const size = statSync(file).size;
  before += size;
  const doc = await io.read(file);
  const isWalk = file.endsWith('-walk.glb');

  if (isWalk) {
    // Keep the animation, drop everything it does not need. The nodes must
    // survive because the clips target them by name.
    for (const node of doc.getRoot().listNodes()) node.setMesh(null);
    for (const mesh of doc.getRoot().listMeshes()) mesh.dispose();
    for (const mat of doc.getRoot().listMaterials()) mat.dispose();
    for (const tex of doc.getRoot().listTextures()) tex.dispose();
    await doc.transform(prune(), dedup());
    if (MESHOPT) await doc.transform(meshopt({ encoder: MeshoptEncoder }));
  } else {
    await doc.transform(
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 88 }),
      prune(),
      dedup(),
    );
    if (MESHOPT) await doc.transform(meshopt({ encoder: MeshoptEncoder }));
  }

  const out = await io.writeBinary(doc);
  after += out.byteLength;
  const pct = ((1 - out.byteLength / size) * 100).toFixed(0);
  console.log(`  ${mb(size).padStart(6)} -> ${mb(out.byteLength).padStart(6)} MB  (-${pct.padStart(2)}%)  ${file}`);

  if (WRITE) {
    const bdir = join(BACKUP, file.split('/').slice(2, -1).join('/'));
    mkdirSync(bdir, { recursive: true });
    const bpath = join(bdir, file.split('/').pop());
    if (!existsSync(bpath)) copyFileSync(file, bpath);
    const { writeFileSync } = await import('node:fs');
    writeFileSync(file, out);
  }
}
console.log(`\n  TOTAL  ${mb(before)} MB -> ${mb(after)} MB  (-${((1 - after / before) * 100).toFixed(0)}%)`);
console.log(WRITE ? '  written; originals copied to ' + BACKUP : '  dry run, nothing written. Pass --write to apply.');
