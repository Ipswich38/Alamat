// The jungle camps.
//
// ── WHAT A CAMP IS FOR ──────────────────────────────────────────────────────
// A reason to leave the lane. Without them the jungle is just the space between
// roads and nobody ever walks into it; with them the four quadrants become
// somewhere worth contesting, and a player who takes one has traded lane
// pressure for a buff. That trade is the whole point of a jungle.
//
// ── WHY THE POSITIONS ARE VERIFIED, NOT JUST WRITTEN ────────────────────────
// A camp placed on a lane is not a jungle camp, it is an obstacle in the road.
// A camp inside a base wall is unreachable. Both look completely fine on
// screen. So the coordinates below are asserted against the lanes, the
// sanctuaries and the perimeters at build time rather than eyeballed.

import { LANE_WIDTH, laneDistance, LANES } from './lanes';
import { SANCTUARY_RADIUS, TEAMS } from './nexus';
import { WALL_RADIUS } from './walls';

export interface Camp {
  id: string;
  name: string;
  /** What taking it gives you. Flavour for now; combat will read it later. */
  boon: string;
  x: number;
  z: number;
  /** Half-extent of the clearing. The brief asks for a 10 by 10 pocket. */
  radius: number;
  /** The colour of the light that marks it, and of the buff it grants. */
  light: number;
}

/** Half of the brief's 10x10 clearing. */
const POCKET = 5;

/**
 * Four camps, in the four jungle quadrants.
 *
 * Placed in MIRRORED PAIRS through the origin, so neither team has a shorter
 * walk to a better camp. Asymmetry in a jungle is a balance bug that takes
 * months to notice and one line to introduce.
 */
export const CAMPS: Camp[] = [
  // ── Small Camp A: Veer Tricksters (Mob Camp) ──────────────────────────
  {
    id: 'veer-nw',
    name: 'Veer Tricksters',
    boon: 'Wind Stride: +35% movement speed for 60s.',
    x: -46,
    z: -14,
    radius: POCKET,
    light: 0x50e3c2, // Emerald wind teal
  },
  {
    id: 'veer-se',
    name: 'Veer Tricksters',
    boon: 'Wind Stride: +35% movement speed for 60s.',
    x: 46,
    z: 14,
    radius: POCKET,
    light: 0x50e3c2,
  },

  // ── Small Camp B: Hollow Stalkers (Agile Camp) ─────────────────────────────
  {
    id: 'hollow-ne',
    name: 'Hollow Stalkers',
    boon: 'Blood Thirst: +20% lifesteal & +30% attack speed for 60s.',
    x: 14,
    z: -46,
    radius: POCKET,
    light: 0xff3366, // Crimson blood pink
  },
  {
    id: 'hollow-sw',
    name: 'Hollow Stalkers',
    boon: 'Blood Thirst: +20% lifesteal & +30% attack speed for 60s.',
    x: -14,
    z: 46,
    radius: POCKET,
    light: 0xff3366,
  },

  // ── Medium Camp: Idol Guardian (Buff Objective) ───────────────────────────
  {
    id: 'idol-nw',
    name: 'The Idol Guardian',
    boon: 'Idol Blessing: Rapid health regeneration & CDR for 90s.',
    x: -52,
    z: -52,
    radius: POCKET,
    light: 0xffd06f, // Solar gold
  },
  {
    id: 'idol-se',
    name: 'The Idol Guardian',
    boon: 'Idol Blessing: Rapid health regeneration & CDR for 90s.',
    x: 52,
    z: 52,
    radius: POCKET,
    light: 0xffd06f,
  },

  // ── River Scuttler / Gold Crab (River Objectives) ───────────────────────
  {
    id: 'scuttler-nw',
    name: 'Gold River Crab',
    boon: 'River Stride: +35% river speed & grants river vision shrine for 60s.',
    x: -24,
    z: -24,
    radius: POCKET,
    light: 0xffd700, // Sacred golden glow
  },
  {
    id: 'scuttler-se',
    name: 'Gold River Crab',
    boon: 'River Stride: +35% river speed & grants river vision shrine for 60s.',
    x: 24,
    z: 24,
    radius: POCKET,
    light: 0xffd700,
  },

  // ── Major Boss Camps (The Epic Objectives) ────────────────────────────────
  {
    id: 'maw-pit',
    name: 'Maw (The Moon-Eater)',
    boon: "Moon's Eclipse: +20% damage to structures & true damage for 3 mins.",
    x: 36,
    z: -14,
    radius: 6.2,
    light: 0x7852ff, // Celestial violet
  },
  {
    id: 'treant-lair',
    name: 'Treant (The Giant Tree Warden)',
    boon: 'Banyan Giant: Spawns allied pushing siege giant in nearest lane.',
    x: -36,
    z: 14,
    radius: 6.2,
    light: 0xff7a36, // Banyan ember amber
  },
];

/** Which camp a point is standing in, or null. */
export function campAt(x: number, z: number): Camp | null {
  for (const c of CAMPS) {
    if (Math.hypot(x - c.x, z - c.z) <= c.radius) return c;
  }
  return null;
}

/**
 * Check every camp is somewhere a camp can actually be.
 *
 * Returns the problems rather than throwing, so a bad coordinate is a reported
 * fact at startup instead of a white screen.
 */
export function auditCamps(): string[] {
  const problems: string[] = [];
  for (const c of CAMPS) {
    // Clear of every lane, with the camp's own radius accounted for.
    for (const lane of LANES) {
      const d = laneDistance(c.x, c.z, lane.path);
      if (d < LANE_WIDTH / 2 + c.radius) {
        problems.push(`${c.id} is ${d.toFixed(1)} from the ${lane.id} lane, too close`);
      }
    }
    for (const team of Object.values(TEAMS)) {
      const d = Math.hypot(c.x - team.x, c.z - team.z);
      if (d < SANCTUARY_RADIUS + c.radius) problems.push(`${c.id} overlaps the ${team.id} sanctuary`);
      if (d < WALL_RADIUS + c.radius) problems.push(`${c.id} is inside the ${team.id} perimeter`);
    }
  }
  // Mirrored pairs: every camp must have an opposite.
  for (const c of CAMPS) {
    if (!CAMPS.some((o) => Math.abs(o.x + c.x) < 0.01 && Math.abs(o.z + c.z) < 0.01)) {
      problems.push(`${c.id} has no mirror through the origin, so the jungle is unbalanced`);
    }
  }
  return problems;
}
