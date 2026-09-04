#!/usr/bin/env node
/*
 * Does the code you wrote actually reach the running program?
 *
 * This repo was built by several different AI models across many sessions. The
 * expensive failures were never bad code, they were code that did not connect:
 *
 *   - THREE separate device/quality systems, none wired to the renderer, so
 *     quality sat pinned at 'high' on every phone.
 *   - A "HQ graphics" commit that carefully rewrote shadow tiers in a file no
 *     module imports, so it changed nothing.
 *   - Movement derived twice in two places that disagreed, so D walked you left.
 *
 * A build passing proves none of that is absent. This does.
 *
 *   node scripts/audit-wiring.mjs
 *
 * Exit 1 if anything is reported, so it can gate a commit or a CI step.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const MAX_LINES = 800;          // matches the house code-quality rule
const ENTRY_HINTS = [/\/app\/.*\/(page|layout|route)\.tsx?$/, /\/app\/[^/]+\.tsx?$/];

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(p) && !/\.d\.ts$/.test(p)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const text = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));

// ── who imports whom ────────────────────────────────────────────────────────
const importedBy = new Map(files.map((f) => [f, new Set()]));
const resolveSpec = (from, spec) => {
  let base;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
  else return null;
  for (const c of ['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx']) {
    const p = base + c;
    if (text.has(p)) return p;
  }
  return text.has(base) ? base : null;
};

for (const f of files) {
  for (const m of text.get(f).matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const t = resolveSpec(f, m[1]);
    if (t && t !== f) importedBy.get(t).add(f);
  }
}

const rel = (f) => relative(ROOT, f);
const isEntry = (f) => ENTRY_HINTS.some((r) => r.test(f.replace(/\\/g, '/')));

// ── 1. modules nothing imports ──────────────────────────────────────────────
const orphans = files.filter((f) => !isEntry(f) && importedBy.get(f).size === 0);

// ── 2. modules reachable ONLY through a barrel that nothing else pulls from ─
// A file re-exported by index.ts but never actually used still ships and still
// reads as live to the next agent. Flag when every importer is a barrel.
const barrelOnly = files.filter((f) => {
  const imps = [...importedBy.get(f)];
  return imps.length > 0 && imps.every((i) => /\/index\.tsx?$/.test(i));
});

// ── 3. the same exported name defined in more than one module ───────────────
const exportsByName = new Map();
for (const f of files) {
  for (const m of text.get(f).matchAll(/export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/g)) {
    if (!exportsByName.has(m[1])) exportsByName.set(m[1], new Set());
    exportsByName.get(m[1]).add(f);
  }
}
const competing = [...exportsByName.entries()].filter(([, s]) => s.size > 1);

// ── 4. files past the house size rule ───────────────────────────────────────
const oversized = files
  .map((f) => [f, text.get(f).split('\n').length])
  .filter(([, n]) => n > MAX_LINES)
  .sort((a, b) => b[1] - a[1]);

// ── report ──────────────────────────────────────────────────────────────────
let found = 0;
const section = (title, rows, fmt) => {
  if (!rows.length) return;
  found += rows.length;
  console.log(`\n${title}  (${rows.length})`);
  for (const r of rows.slice(0, 25)) console.log('  ' + fmt(r));
  if (rows.length > 25) console.log(`  ... and ${rows.length - 25} more`);
};

section('DEAD: nothing imports these', orphans, rel);
section('BARREL-ONLY: re-exported but never actually used', barrelOnly, rel);
section('COMPETING: same export name in several modules', competing,
  ([n, s]) => `${n}  <-  ${[...s].map(rel).join('  |  ')}`);
section(`OVERSIZED: past ${MAX_LINES} lines`, oversized, ([f, n]) => `${n.toString().padStart(5)}  ${rel(f)}`);

if (!found) {
  console.log('wiring clean: every module is reached, no competing exports, no oversized files');
  process.exit(0);
}
console.log(`\n${found} finding(s). Each one is code that ships but may not do what its author thought.`);
process.exit(1);
