// Mystic draws — budget 30/270, pity 45

import type { GachaDraw } from './types';

export const MYSTIC_DRAW_S1: GachaDraw = {
  id: 'mystic_draw_s1',
  name: 'Mystic Draw: Sovereign Blessings',
  ticketsPerPull: 1,
  costDiamonds: 30,
  costDiamonds10: 270,
  pity: 45,
  odds: {
    elite: 0.25,
    epic: 0.04,
    collector: 0.012,
    legend: 0.008,
    prime: 0.002,
  },
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
