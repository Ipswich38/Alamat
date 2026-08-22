// What a landed shape is called, and what the player gets told about it.
//
// ── WHY THE WORDS ARE A PURE FUNCTION ───────────────────────────────────────
// The combat line is the only feedback in the game that says WHY nothing
// happened, which makes it the difference between a warded tower and a bug.
// Composed inside the frame loop it was four branches tangled with three side
// effects; here the priority order can be read in one screen and checked
// without running the game.
//
// ⚠ LOUDEST NEWS WINS. A structure falling outranks a hit, a hit outranks a
// ward, and the ward line exists precisely because "my ultimate did nothing"
// is otherwise indistinguishable from a broken ability.

import { TEAMS } from '@/game/arena/nexus';
import type { HitReport, Structure } from './objectives';
import type { MinionStrikeReport } from './minions';

export function structureName(s: Structure): string {
  if (s.kind === 'core') return `${TEAMS[s.team].name} core`;
  return s.lane === 'nexus' ? 'base tower' : `${s.lane} lane tower`;
}

/** What happened to the living body a shape covered, if it covered one. */
export interface FoeOutcome {
  name: string;
  amount: number;
  downed: boolean;
}

/**
 * The line for one resolved shape, or null when there is nothing to report and
 * the caller should say its own "this hit nothing" message.
 */
export function strikeLine(
  label: string,
  foe: FoeOutcome | null,
  report: HitReport,
  minions?: MinionStrikeReport | null
): string | null {
  const felled = report.felled[0];
  if (felled) {
    return felled.kind === 'core'
      ? 'The core shatters. The Diwata wakes and the sun comes back.'
      : `The ${structureName(felled)} falls.`;
  }

  const hit = report.hits[0];
  if (hit) return `${label} strikes the ${structureName(hit)}: ${Math.ceil(hit.health)} left.`;

  if (foe) {
    return foe.downed
      ? `${label} banishes the ${foe.name}.`
      : `${label} hits the ${foe.name} for ${foe.amount}.`;
  }

  if (minions && minions.felled.length > 0) {
    return `${label} cuts down ${minions.felled.length} enemy minion${minions.felled.length > 1 ? 's' : ''}.`;
  }
  if (minions && minions.hits.length > 0) {
    return `${label} strikes ${minions.hits.length} enemy minion${minions.hits.length > 1 ? 's' : ''}.`;
  }

  const warded = report.shielded[0];
  if (warded) {
    return warded.kind === 'core'
      ? 'The core is warded while its base towers stand.'
      : `The ${structureName(warded)} is warded while the tower before it stands.`;
  }

  return null;
}
