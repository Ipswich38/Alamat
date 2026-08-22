// Rules about the numbers that no single file can check on its own.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// Hero stats live in heroes/catalogue.ts and foe stats live in combat/foes.ts,
// which is correct: a foe is not a hero and must not become one. The cost of
// that separation is that a relationship BETWEEN the two files has no home, so
// nobody notices when one side drifts out from under the other.
//
// It already happened once. The Kapre's reach was 3.2 while the longest melee
// attackRange in the roster was 2.2, which meant the brute stood outside every
// melee hero's guard and hit them with impunity. Nothing threw, nothing logged,
// and the strike simply reported empty air, so the game looked like it worked.
//
// These run in development only. They are assertions about content, not code,
// and content is edited by whoever is balancing, not by whoever is compiling.

import { HEROES } from '@/game/heroes';
import type { Foe } from './foes';

/**
 * Every melee hero must be able to reach a foe that has closed to its stopping
 * distance. A foe whose reach exceeds the shortest melee attackRange cannot be
 * basic-attacked by that hero at all.
 *
 * `melee` is a range short enough that the hero has to be in the foe's face.
 * Anything longer kites and is not covered by this rule.
 */
const MELEE_CEILING = 3;

export function checkFoeReach(foes: Foe[]): string[] {
  const melee = HEROES.filter((h) => h.attackRange <= MELEE_CEILING);
  if (melee.length === 0) return [];

  const shortest = melee.reduce((a, b) => (a.attackRange <= b.attackRange ? a : b));

  return foes
    .filter((foe) => foe.reach >= shortest.attackRange)
    .map(
      (foe) =>
        `${foe.name} stops at reach ${foe.reach}, which is outside ${shortest.name}'s ` +
        `attackRange of ${shortest.attackRange}. ${shortest.name} cannot land a basic ` +
        `attack on it. Lower the foe's reach or raise the hero's range.`
    );
}

/** Everything above, run together. Returns one line per broken rule. */
export function checkContent(foes: Foe[]): string[] {
  return [...checkFoeReach(foes)];
}
