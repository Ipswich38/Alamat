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
 *   node scripts/audit-wiring.mjs              compare against the baseline
 *   node scripts/audit-wiring.mjs --all        show every finding
 *   node scripts/audit-wiring.mjs --baseline   accept today's findings as the floor
 *
 * A legacy codebase has findings on day one. Blocking on all of them blocks
 * everything, so the default is a RATCHET: it fails only on findings that are
 * new, and on oversized files that grew. Things can get better, never worse.
 *
 * Exit 1 on a regression, so it can gate a commit or a CI step.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';

const ROOT = process.cwd();
const MAX_LINES = 800;          // matches the house code-quality rule
const ENTRY_HINTS = [/\/app\/.*\/(page|layout|route)\.tsx?$/, /\/app\/[^/]+\.tsx?$/];
const SKIP = /(^|\/)(node_modules|\.next|dist|build|out|android|ios|coverage|\.git)(\/|$)/;

/*
 * Not every project keeps code in src/. This estate has Next apps with app/ and
 * lib/ at the root and no src/ at all, so scan whichever of these exist rather
 * than assuming one layout and silently auditing nothing.
 */
const CODE_ROOTS = ['src', 'app', 'lib', 'components', 'game', 'server']
  .map((d) => join(ROOT, d))
  .filter((d) => existsSync(d));

if (!CODE_ROOTS.length) {
  console.log('no code directories found (looked for src, app, lib, components, game, server)');
  process.exit(0);
}

/*
 * "@/..." means different roots in different projects. Read it from tsconfig
 * rather than guessing, or imports silently fail to resolve and every module
 * looks dead.
 */
function aliasBase() {
  for (const f of ['tsconfig.json', 'jsconfig.json']) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    try {
      const raw = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      const cfg = JSON.parse(raw);
      const paths = cfg.compilerOptions?.paths?.['@/*'];
      if (paths?.length) return join(ROOT, cfg.compilerOptions.baseUrl || '.', paths[0].replace(/\*$/, ''));
    } catch { /* fall through to the default */ }
  }
  return existsSync(join(ROOT, 'src')) ? join(ROOT, 'src') : ROOT;
}
const ALIAS = aliasBase();

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (SKIP.test(p.replace(/\\/g, '/'))) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js|jsx)$/.test(p) && !/\.d\.ts$/.test(p)) out.push(p);
  }
  return out;
}

const files = [...new Set(CODE_ROOTS.flatMap((d) => walk(d)))];
const text = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));

// ── who imports whom ────────────────────────────────────────────────────────
const importedBy = new Map(files.map((f) => [f, new Set()]));
const resolveSpec = (from, spec) => {
  let base;
  if (spec.startsWith('@/')) base = join(ALIAS, spec.slice(2));
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

// ── findings as stable keys, so a baseline can be compared ──────────────────
const findings = new Map();
for (const f of orphans) findings.set(`dead:${rel(f)}`, 1);
for (const f of barrelOnly) findings.set(`barrel:${rel(f)}`, 1);
for (const [n] of competing) findings.set(`competing:${n}`, 1);
for (const [f, n] of oversized) findings.set(`oversized:${rel(f)}`, n);

const label = (k) => ({
  dead: 'DEAD, nothing imports it',
  barrel: 'BARREL-ONLY, re-exported but never used',
  competing: 'COMPETING, same export name in several modules',
  oversized: `OVERSIZED, past ${MAX_LINES} lines`,
}[k.split(':')[0]]);

const BASELINE = join(ROOT, '.wiring-baseline.json');
const ALL = process.argv.includes('--all');

if (process.argv.includes('--baseline')) {
  writeFileSync(BASELINE, JSON.stringify(Object.fromEntries([...findings].sort()), null, 2) + '\n');
  console.log(`baseline written: ${findings.size} finding(s) accepted as the floor`);
  console.log('they are now the ceiling too. Nothing may be added, and oversized files may not grow.');
  process.exit(0);
}

if (ALL || !existsSync(BASELINE)) {
  for (const [k, v] of [...findings].sort()) {
    console.log(`  ${label(k)}: ${k.split(':').slice(1).join(':')}${k.startsWith('oversized') ? `  (${v} lines)` : ''}`);
  }
  console.log(`\n${findings.size} finding(s).`);
  if (!existsSync(BASELINE)) console.log('no baseline yet. Run with --baseline to accept these as the floor.');
  process.exit(ALL ? 0 : findings.size ? 1 : 0);
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
const added = [...findings].filter(([k]) => !(k in base));
const grew = [...findings].filter(([k, v]) => k in base && k.startsWith('oversized') && v > base[k]);
const fixed = Object.keys(base).filter((k) => !findings.has(k));

if (fixed.length) console.log(`fixed since the baseline: ${fixed.length}. Re-run with --baseline to lock the gain in.`);

if (!added.length && !grew.length) {
  console.log(`wiring ok: no new findings (${findings.size} known, unchanged)`);
  process.exit(0);
}
for (const [k] of added) console.log(`  NEW  ${label(k)}: ${k.split(':').slice(1).join(':')}`);
for (const [k, v] of grew) console.log(`  GREW ${k.split(':').slice(1).join(':')}: ${base[k]} -> ${v} lines`);
console.log(`\n${added.length + grew.length} regression(s). This is code that ships but may not do what its author thought.`);
console.log('Fix it, or if it is genuinely intended, run --baseline and say why in the commit.');
process.exit(1);
