// The Pasig Agimat: an S-curve channel with a real bed, banks and shallows.
//
// ── WHY IT IS A SAMPLED POLYLINE AND NOT A FORMULA ──────────────────────────
// The straight version was one subtraction: distance from the line x = z. A
// curve has no such closed form, so the centre line is sampled once into a
// dense polyline and every query is a scan for the nearest sample. That sounds
// expensive and is not: the scan runs 240 comparisons, the terrain asks 25,000
// times at load and never again, and the two moving bodies ask twice a frame.
//
// ── WHY THE ANSWER IS A RECORD, NOT A NUMBER ────────────────────────────────
// Four systems want four different things from this river, and they all fall
// out of one lookup: how far along it you are, how far from its centre, how
// wide it is there, and how deep. Returning them together means a caller never
// recomputes what another caller already found.
//
// ── AND WHY THE BED RISES AT THE CROSSINGS ──────────────────────────────────
// A ford is a place the river is shallow, and that is what makes a crossing a
// crossing rather than a hole in the map. Heroes wade at the three lane
// crossings and swim nowhere, because nothing in this game swims.

import { LANES, type LaneId } from './lanes';

/** Half the map, matching arena/nexus. Kept local so this file imports nothing. */
const HALF = 100;

/** Extent of the channel along its own axis, past the map edge at both ends. */
const REACH = 178;

/** How far the S-curve swings off the north-west to south-east diagonal. */
const MEANDER = 24;

/** How deep the trough is cut at its deepest. */
export const RIVER_DEPTH = 2.5;

/** Width at the central basin, and at the tightest choke. */
const WIDTH_BASIN = 22;
const WIDTH_CHOKE = 12;

/** Kept for callers that only want a representative number. */
export const RIVER_WIDTH = WIDTH_BASIN;

/**
 * How high a bridge deck sits.
 *
 * ⚠ NOT ZERO. Crossings once held the ground at 0, the level of the bank, while
 * the deck sits above it, so a player mid-crossing was drawn inside the planks.
 */
export const DECK_HEIGHT = 0.95;

/** The centre line, sampled once at module load. */
interface Sample {
  x: number;
  z: number;
  /** Distance travelled along the curve, from one end. */
  s: number;
  /** Half-width of the channel here. */
  half: number;
}

const CENTRE: Sample[] = buildCentre();

function buildCentre(): Sample[] {
  const out: Sample[] = [];
  const STEPS = 240;
  let run = 0;
  let prev: { x: number; z: number } | null = null;

  for (let i = 0; i <= STEPS; i++) {
    // u runs the north-west to south-east diagonal; o swings perpendicular to
    // it. One full sine over the length is exactly one S.
    const u = -REACH + (i / STEPS) * REACH * 2;
    const o = MEANDER * Math.sin((Math.PI * u) / REACH);
    const x = (u + o) / Math.SQRT2;
    const z = (u - o) / Math.SQRT2;

    if (prev) run += Math.hypot(x - prev.x, z - prev.z);
    prev = { x, z };

    // Widest in the middle, tightest at the ends: the basin is where the map's
    // most contested ground is, and a choke should be somewhere you can be
    // caught.
    const k = Math.cos((Math.PI * u) / (REACH * 2));
    const half = (WIDTH_CHOKE + (WIDTH_BASIN - WIDTH_CHOKE) * Math.abs(k)) / 2;

    out.push({ x, z, s: run, half });
  }
  return out;
}

export interface RiverPoint {
  /** 0 at one end of the channel, 1 at the other. */
  t: number;
  /** Perpendicular distance from the centre line. */
  distance: number;
  /** Half-width of the channel at this point. */
  half: number;
  /** 1 at the centre line, 0 at the bank, negative meaning outside. */
  depth: number;
}

/** Everything about the river at a point, from one scan. */
export function riverAt(x: number, z: number): RiverPoint {
  let best = CENTRE[0];
  let bestD = Infinity;
  for (const c of CENTRE) {
    const d = (x - c.x) ** 2 + (z - c.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  const distance = Math.sqrt(bestD);
  const total = CENTRE[CENTRE.length - 1].s;
  return {
    t: best.s / total,
    distance,
    half: best.half,
    depth: 1 - distance / best.half,
  };
}

/** 1 at the centre line, 0 at the bank. Zero outside the channel. */
export function riverDepth(x: number, z: number): number {
  return Math.max(0, riverAt(x, z).depth);
}

/** Which side of the channel a point is on. The two halves of the map. */
export function riverSide(x: number, z: number): 'anito' | 'malakas' {
  // The curve wanders, so "which side" is decided against the nearest sample's
  // own tangent rather than against a fixed line.
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < CENTRE.length; i++) {
    const d = (x - CENTRE[i].x) ** 2 + (z - CENTRE[i].z) ** 2;
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  const a = CENTRE[Math.max(0, bestI - 1)];
  const b = CENTRE[Math.min(CENTRE.length - 1, bestI + 1)];
  const cross = (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x);
  return cross < 0 ? 'anito' : 'malakas';
}

export interface Crossing {
  lane: LaneId;
  x: number;
  z: number;
  bearing: number;
  radius: number;
}

/**
 * Where each lane meets the channel.
 *
 * ⚠ FOUND BY WALKING THE LANE, never typed in. Three hand coordinates would be
 * wrong the first time either a lane OR the river's curve moved, and wrong
 * invisibly: the bridge still draws, just no longer over water.
 */
export function findCrossings(): Crossing[] {
  const out: Crossing[] = [];

  for (const lane of LANES) {
    const pts: [number, number][] = [];
    for (let i = 0; i < lane.path.length - 1; i++) {
      const a = lane.path[i];
      const b = lane.path[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const steps = Math.max(2, Math.ceil(len / 0.6));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    pts.push(lane.path[lane.path.length - 1]);

    // The deepest point of the lane's passage through the channel, which is the
    // middle of the ford however the curve happens to run there.
    let bestI = -1;
    let bestDepth = 0;
    for (let i = 0; i < pts.length; i++) {
      const d = riverAt(pts[i][0], pts[i][1]).depth;
      if (d > bestDepth) {
        bestDepth = d;
        bestI = i;
      }
    }
    if (bestI < 0) continue;

    const [x, z] = pts[bestI];
    const back = pts[Math.max(0, bestI - 6)];
    const fwd = pts[Math.min(pts.length - 1, bestI + 6)];
    out.push({
      lane: lane.id,
      x,
      z,
      bearing: Math.atan2(fwd[0] - back[0], fwd[1] - back[1]),
      radius: riverAt(x, z).half + 5,
    });
  }

  return out;
}

const CROSSINGS = findCrossings();

/** Is this point on a crossing? */
export function onCrossing(x: number, z: number): Crossing | null {
  for (const c of CROSSINGS) {
    if (Math.hypot(x - c.x, z - c.z) <= c.radius) return c;
  }
  return null;
}

/**
 * How much a crossing lifts the riverbed here: 1 at its centre, 0 at its edge.
 *
 * This is the ford. The bed rises so the water is ankle-deep and a hero WADES
 * across visibly rather than dropping into a trench and climbing out.
 */
export function fordLift(x: number, z: number): number {
  let best = 0;
  for (const c of CROSSINGS) {
    const k = Math.max(0, 1 - Math.hypot(x - c.x, z - c.z) / c.radius);
    if (k > best) best = k;
  }
  return best * best * (3 - 2 * best);
}

/**
 * The riverbed's own height. Zero outside the channel.
 *
 * ⚠ THE BANKS ARE A SLOPE, NOT A STEP. Cubed rather than linear, which gives a
 * shallow shoulder at the top and a steeper fall near the middle: that is the
 * shape of a real bank, and a linear drop reads as a trench someone dug.
 */
export function riverFloor(x: number, z: number): number {
  const r = riverAt(x, z);
  if (r.depth <= 0) return 0;
  const eased = r.depth * r.depth * (3 - 2 * r.depth);
  const cut = -RIVER_DEPTH * eased;
  // A ford fills the trough back in, leaving a shallow that still reads as
  // water rather than as dry road.
  return cut * (1 - fordLift(x, z) * 0.82);
}

/** Ground height including bridge decks. */
export function groundHeight(x: number, z: number): number {
  if (onCrossing(x, z)) return DECK_HEIGHT;
  return riverFloor(x, z);
}

/** Movement multiplier. Wading is slow; a bridge is not. */
export function riverSpeed(x: number, z: number): number {
  if (onCrossing(x, z)) return 1;
  const d = riverDepth(x, z);
  return d > 0 ? 1 - 0.32 * d : 1;
}

/** The sampled centre line, for anything that needs to build along it. */
export function riverCentre(): readonly Sample[] {
  return CENTRE;
}

export { HALF as RIVER_MAP_HALF };
