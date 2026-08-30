#!/usr/bin/env node
// Rig a generated character, and fetch its animations.
//
// ⚠ RIG FROM THE REFINED TASK, NOT THE PREVIEW. Rigging the untextured preview
// returns a rigged but untextured body, and there is no way to marry the two
// afterwards. The textured task carries its maps through the rig.
//
// ⚠ THE RIGGER NEEDS A HUMAN SKELETON TO FIND. It refused a Veer built
// with anatomically correct digitigrade legs ("pose estimation failed") and
// accepted the same character standing like a person. Anything non-humanoid
// below the neck has to be described as a biped in the prompt, not fixed here.

import { apiKey, headers } from './lib/meshy.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

const key = apiKey();
const name = process.argv[2];
const dir = process.argv[3] ?? 'public/models/heroes';
if (!key || !name) {
  console.error('usage: node scripts/meshy-rig.mjs <name> [dir]');
  process.exit(1);
}

const metaPath = `${dir}/${name}.json`;
const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
const source = meta.refineTaskId ?? meta.previewTaskId;
if (!meta.refineTaskId) console.log('⚠ no refined task; rigging the UNTEXTURED preview');

const start = await fetch('https://api.meshy.ai/openapi/v1/rigging', {
  method: 'POST',
  headers: headers(key),
  body: JSON.stringify({ input_task_id: source, character_height: 1.8 }),
});
if (!start.ok) {
  console.error('rig refused:', start.status, (await start.text()).slice(0, 200));
  process.exit(1);
}
const id = (await start.json()).result;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let task;
for (let i = 0; i < 120; i++) {
  task = await (
    await fetch(`https://api.meshy.ai/openapi/v1/rigging/${id}`, { headers: headers(key) })
  ).json();
  process.stdout.write(`\r  ${name}: ${task.status} ${task.progress ?? 0}%   `);
  if (task.status === 'SUCCEEDED' || task.status === 'FAILED') break;
  await sleep(5000);
}
console.log();
if (task.status !== 'SUCCEEDED') {
  console.error('rig failed:', JSON.stringify(task.task_error ?? {}).slice(0, 200));
  process.exit(1);
}

const out = task.result ?? task;
const save = async (url, path) => {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(path, buf);
  console.log(`  saved ${path} (${(buf.length / 1048576).toFixed(2)} MB)`);
};

await save(out.rigged_character_glb_url, `${dir}/${name}-rigged.glb`);
if (out.basic_animations?.walking_glb_url) {
  await save(out.basic_animations.walking_glb_url, `${dir}/${name}-walk.glb`);
}
writeFileSync(metaPath, JSON.stringify({ ...meta, rigTaskId: id }, null, 2));
