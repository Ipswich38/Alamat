// Mystic draws — budget 30/270, pity 45

import type { GachaDraw, SkinTier } from './types';

export const MYSTIC_DRAW_S1: GachaDraw = {
  id: 'mystic_draw_s1',
  name: 'Mystic Draw: Sovereign Blessings',
  ticketsPerPull: 1,
  costDiamonds: 30,
  costDiamonds10: 270,
  pity: 45,
  pool: [
    { id: 'veer_spirit_woods', weight: 25, tier: 'elite' },
    { id: 'thistle_thread_veil', weight: 25, tier: 'elite' },
    { id: 'hollow_night_stalker', weight: 25, tier: 'elite' },
    { id: 'willow_grove_keeper', weight: 25, tier: 'elite' },
    { id: 'veer_storm_guardian', weight: 4, tier: 'epic' },
    { id: 'thistle_hex_sorceress', weight: 4, tier: 'epic' },
    { id: 'veer_solar_sovereign', weight: 8, tier: 'legend' },
    { id: 'willow_dawn_prime', weight: 2, tier: 'prime' },
  ],
};

// Back-compat alias
export const ANITO_DRAW_S1 = MYSTIC_DRAW_S1;

/*
 * The real chance of each tier, worked out from the pool that rollGacha
 * actually draws from.
 *
 * This replaces a hand-written `odds` field on the draw, which nothing read and
 * which disagreed with the pool on every single line. It declared elite 25%
 * against a real 84.75%, legend 0.8% against 6.78%, summed to 31.2% rather than
 * 100%, and advertised `collector` at 1.2% when the pool holds no collector
 * item at all, so it could never be drawn.
 *
 * If this is ever shown to a player, or filed on a store listing, it has to be
 * derived and not typed. Two sources drift, and here the drift meant
 * advertising a chance at something unobtainable.
 *
 * Note this is the per-pull chance and ignores pity: a pull made at
 * `pity - 1` is forced to epic, so epic over a long run is higher than shown.
 */
export function tierOdds(draw: GachaDraw = MYSTIC_DRAW_S1): Record<string, number> {
  const total = draw.pool.reduce((sum, item) => sum + item.weight, 0);
  const byTier: Record<string, number> = {};
  for (const item of draw.pool) {
    byTier[item.tier] = (byTier[item.tier] ?? 0) + item.weight;
  }
  for (const tier of Object.keys(byTier)) byTier[tier] /= total;
  return byTier;
}

/** Every tier a player can actually draw, best first. For a disclosure table. */
export function tierOddsTable(draw: GachaDraw = MYSTIC_DRAW_S1): { tier: SkinTier; chance: number }[] {
  const order: SkinTier[] = ['prime', 'legend', 'collector', 'epic', 'elite'];
  const odds = tierOdds(draw);
  return order
    .filter((t) => (odds[t] ?? 0) > 0)
    .map((t) => ({ tier: t, chance: odds[t] }));
}

export function rollGacha(draw: GachaDraw = MYSTIC_DRAW_S1, pityCount: number = 0, rng: () => number = Math.random): string {
  // pity guarantee: on pity-1 next pull forces epic+ (lowest epic)
  if (pityCount >= draw.pity - 1) {
    return 'veer_storm_guardian';
  }
  const totalWeight = draw.pool.reduce((s, p) => s + p.weight, 0);
  let r = rng() * totalWeight;
  for (const item of draw.pool) {
    r -= item.weight;
    if (r <= 0) return item.id;
  }
  return draw.pool[0].id;
}
