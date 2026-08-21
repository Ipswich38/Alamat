// Shared Meshy plumbing: auth, task creation, polling, download.
//
// Extracted when a second generator (props) needed the same API. The catalogues
// differ — monsters come from the bestiary, props from the world's prop kinds —
// but the calls, the polling and the credit accounting are identical, and two
// copies would drift the moment the API changed under one of them.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const API = 'https://api.meshy.ai/openapi';

export function apiKey() {
  if (process.env.MESHY_API_KEY) return process.env.MESHY_API_KEY.trim();
  try {
    const line = readFileSync('.env.local', 'utf8')
      .split('\n')
      .find((l) => l.startsWith('MESHY_API_KEY='));
    if (line) return line.slice('MESHY_API_KEY='.length).trim();
  } catch {
    /* no env file — the caller reports it */
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function headers(key) {
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

export async function balance(key) {
  const res = await fetch(`${API}/v1/balance`, { headers: headers(key) });
  if (!res.ok) return null;
  return (await res.json())?.balance ?? null;
}

/**
 * Start a text-to-3D task.
 *
 * `art_style` must be 'realistic'; the v2 API rejects every other value
 * ("ArtStyle must be one of [realistic]"), so stylisation has to come from the
 * prompt itself. Only the refine stage produces textures — a preview returns
 * untextured geometry.
 */
export async function createTask(key, { mode, prompt, texture, previewTaskId, polycount = 12000 }) {
  const body =
    mode === 'refine'
      ? { mode: 'refine', preview_task_id: previewTaskId, enable_pbr: true, texture_prompt: texture }
      : {
          mode: 'preview',
          prompt,
          art_style: 'realistic',
          should_remesh: true,
          target_polycount: polycount,
        };
  const res = await fetch(`${API}/v2/text-to-3d`, {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`create failed ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json.result;
}

export async function pollTask(key, taskId, label) {
  let last = -1;
  for (let i = 0; i < 240; i++) {
    const res = await fetch(`${API}/v2/text-to-3d/${taskId}`, { headers: headers(key) });
    const t = await res.json();
    if (t.progress !== last) {
      process.stdout.write(`\r  ${label}: ${t.status} ${t.progress ?? 0}%   `);
      last = t.progress;
    }
    if (t.status === 'SUCCEEDED') {
      process.stdout.write('\n');
      return t;
    }
    if (t.status === 'FAILED' || t.status === 'CANCELED') {
      process.stdout.write('\n');
      throw new Error(`task ${t.status}: ${JSON.stringify(t.task_error ?? {}).slice(0, 200)}`);
    }
    await sleep(5000);
  }
  throw new Error('timed out waiting for the task');
}

export async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return buf.length;
}

/** One generation, saved as <dir>/<id>.glb with its metadata and thumbnail. */
export async function generate(key, { id, dir, mode, art, polycount }) {
  mkdirSync(dir, { recursive: true });
  const metaPath = join(dir, `${id}.json`);
  let meta = null;
  try {
    meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  } catch {
    /* first run for this subject */
  }
  if (mode === 'refine' && !meta?.previewTaskId) {
    throw new Error(`no preview task recorded for ${id} — generate the preview first`);
  }

  console.log(`\n${id} — ${mode}`);
  const taskId = await createTask(key, {
    mode,
    prompt: art.prompt,
    texture: art.texture,
    previewTaskId: meta?.previewTaskId,
    polycount,
  });
  const task = await pollTask(key, taskId, id);
  const url = task.model_urls?.glb;
  if (!url) throw new Error('no glb in the finished task');

  const bytes = await download(url, join(dir, `${id}.glb`));
  if (task.thumbnail_url) {
    try {
      await download(task.thumbnail_url, join(dir, `${id}.png`));
    } catch {
      /* a missing thumbnail is not worth failing a paid generation over */
    }
  }
  writeFileSync(
    metaPath,
    JSON.stringify(
      {
        id,
        mode,
        previewTaskId: mode === 'preview' ? taskId : meta?.previewTaskId,
        refineTaskId: mode === 'refine' ? taskId : meta?.refineTaskId,
        thumbnail: task.thumbnail_url ?? null,
        prompt: art.prompt,
        bytes,
      },
      null,
      2
    ) + '\n'
  );
  console.log(`  saved ${join(dir, `${id}.glb`)} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
}
