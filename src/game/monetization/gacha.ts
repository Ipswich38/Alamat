// Gacha draws — budget 30/270, pity 45, low-cost Prime cap ~₱340

import type { GachaDraw } from './types';

export const ANITO_DRAW_S1: GachaDraw = {
  id: 'anito_draw_s1',
  name: 'Anito Draw: Bathala Blessings',
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
    { id: 'veer_anito_woods', weight: 25, tier: 'elite' },
    { id: 'thistle_anito_hair', weight: 25, tier: 'elite' },
    { id: 'hollow_anito_night', weight: 25, tier: 'elite' },
    { id: 'willow_anito_grove', weight: 25, tier: 'elite' },
    { id: 'veer_diwata_storm', weight: 4, tier: 'epic' },
    { id: 'thistle_diwata_hex', weight: 4, tier: 'epic' },
    { id: 'veer_bathala_apolaki', weight: 8, tier: 'legend' },
    { id: 'willow_apolaki_dawn', weight: 2, tier: 'prime' },
  ],
};

export function rollGacha(draw: GachaDraw = ANITO_DRAW_S1, pityCount: number = 0, rng: () => number = Math.random): string {
  // pity guarantee: on pity-1 next pull forces epic+ (lowest epic)
  if (pityCount >= draw.pity - 1) {
    return 'veer_diwata_storm';
  }
  const totalWeight = draw.pool.reduce((s, p) => s + p.weight, 0);
  let r = rng() * totalWeight;
  for (const item of draw.pool) {
    r -= item.weight;
    if (r <= 0) return item.id;
  }
  return draw.pool[0].id;
}
