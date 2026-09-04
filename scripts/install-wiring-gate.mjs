#!/usr/bin/env node
/*
 * Install the wiring gate into a project.
 *
 *   node scripts/install-wiring-gate.mjs [target-dir]
 *
 * Why a git hook and not just a rule in AGENTS.md: a rule is advisory and only
 * works on a model that reads it, remembers it, and chooses to follow it. These
 * projects are built by whichever model has free tokens that day, and no
 * instruction file reaches all of them. A pre-commit hook does not care who or
 * what made the commit.
 *
 * The gate is a RATCHET, not a wall. Existing findings are recorded in
 * .wiring-baseline.json and allowed; only new ones fail. A legacy project can
 * adopt it the same afternoon.
 *
 * Escape hatch, on purpose: `git commit --no-verify` still works. A gate nobody
 * can bypass gets deleted the first time it is wrong at 2am. The point is that
 * bypassing has to be a decision, not an accident.
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const target = resolve(process.argv[2] || process.cwd());

if (!existsSync(join(target, '.git'))) {
  console.error(`not a git repo: ${target}`);
  process.exit(1);
}

// 1. the checker itself
mkdirSync(join(target, 'scripts'), { recursive: true });
const checker = join(target, 'scripts', 'audit-wiring.mjs');
if (resolve(checker) !== resolve(join(HERE, 'audit-wiring.mjs'))) {
  copyFileSync(join(HERE, 'audit-wiring.mjs'), checker);
  console.log('  scripts/audit-wiring.mjs');
}

// 2. the hook
const hookDir = join(target, '.git', 'hooks');
mkdirSync(hookDir, { recursive: true });
const hook = join(hookDir, 'pre-commit');
writeFileSync(hook, `#!/bin/sh
# Wiring gate. Installed by scripts/install-wiring-gate.mjs.
# Fails only on NEW findings, never on the recorded baseline.
# Bypass deliberately with: git commit --no-verify
[ -f scripts/audit-wiring.mjs ] || exit 0
command -v node >/dev/null 2>&1 || exit 0
node scripts/audit-wiring.mjs || {
  echo ""
  echo "Commit blocked by the wiring gate."
  echo "Fix the finding, or if it is genuinely intended:"
  echo "  node scripts/audit-wiring.mjs --baseline   and say why in the commit message"
  exit 1
}
`);
chmodSync(hook, 0o755);
console.log('  .git/hooks/pre-commit');

// 3. the baseline, if this project has none yet
if (!existsSync(join(target, '.wiring-baseline.json'))) {
  try {
    execFileSync('node', [checker, '--baseline'], { cwd: target, stdio: 'inherit' });
  } catch {
    console.log('  (could not write a baseline; run it yourself with --baseline)');
  }
}

console.log(`\nwiring gate installed in ${target}`);
console.log('Every commit from here, by any model or any human, is checked.');
