// Lakbay Pass — 30 tiers, 28-30 days, 149 diamonds premium
// Free track grants Epic at tier 30; xpPerTier 320. Low-cost: ₱37 vs MLBB ~550.

import type { PassSeason } from './types';

export const LAKBAY_S1: PassSeason = {
  id: 'lakbay_s1_amarillo',
  name: 'Lakbay: Amarillo Dawn',
  days: 28,
  tiers: 30,
  xpPerTier: 320,
  premiumPrice: 149,
  // free track: every 5 tiers notable, others ginto/tickets
  freeTrack: {
    1: { ginto: 100 },
    5: { ginto: 150, ticket: 1 },
    10: { ginto: 200 },
    15: { ticket: 2 },
    20: { ginto: 250 },
    25: { ticket: 2 },
    30: { skinId: 'veer_diwata_storm', ginto: 300 }, // Epic free at end
  },
  premiumTrack: {
    1: { skinId: 'thistle_anito_hair', ginto: 300, ticket: 2 }, // instant Elite on purchase
    5: { diamonds: 30 },
    10: { skinId: 'hollow_anito_night', ticket: 2 },
    15: { ginto: 400, ticket: 3 },
    20: { diamonds: 50 },
    25: { ticket: 3 },
    30: { skinId: 'willow_diwata_bloom', recall: 'amarillo_recall', border: 'amarillo_border' },
  },
};

export function getPassProgress(xp: number, season: PassSeason = LAKBAY_S1): { level: number; xpIntoNext: number; xpNeeded: number } {
  const level = Math.min(season.tiers, Math.floor(xp / season.xpPerTier) + 1);
  const xpIntoNext = xp % season.xpPerTier;
  const xpNeeded = season.xpPerTier - xpIntoNext;
  return { level, xpIntoNext, xpNeeded };
}

export function addPassXp(currentXp: number, delta: number, season: PassSeason = LAKBAY_S1): number {
  return Math.min(season.tiers * season.xpPerTier, currentXp + delta);
}
