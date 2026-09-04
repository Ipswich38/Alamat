// Battle Pass — 30 tiers, 28 days, 149 diamonds premium
// Free track grants Epic at tier 30; xpPerTier 320.

import type { PassSeason } from './types';

export const BATTLE_PASS_S1: PassSeason = {
  id: 'battle_pass_s1_amarillo',
  name: 'Battle Pass: Amarillo Dawn',
  days: 28,
  tiers: 30,
  xpPerTier: 320,
  premiumPrice: 149,
  // free track: every 5 tiers notable, others gold/tickets
  freeTrack: {
    1: { gold: 100 },
    5: { gold: 150, ticket: 1 },
    10: { gold: 200 },
    15: { ticket: 2 },
    20: { gold: 250 },
    25: { ticket: 2 },
    30: { skinId: 'veer_storm_guardian', gold: 300 }, // Epic free at end
  },
  premiumTrack: {
    1: { skinId: 'thistle_thread_veil', gold: 300, ticket: 2 }, // instant Elite on purchase
    5: { diamonds: 30 },
    10: { skinId: 'hollow_night_stalker', ticket: 2 },
    15: { gold: 400, ticket: 3 },
    20: { diamonds: 50 },
    25: { ticket: 3 },
    30: { skinId: 'willow_bloom_warden', recall: 'amarillo_recall', border: 'amarillo_border' },
  },
};

// Back-compat alias
export const LAKBAY_S1 = BATTLE_PASS_S1;

export function getPassProgress(xp: number, season: PassSeason = BATTLE_PASS_S1): { level: number; xpIntoNext: number; xpNeeded: number } {
  const level = Math.min(season.tiers, Math.floor(xp / season.xpPerTier) + 1);
  const xpIntoNext = xp % season.xpPerTier;
  const xpNeeded = season.xpPerTier - xpIntoNext;
  return { level, xpIntoNext, xpNeeded };
}

export function addPassXp(currentXp: number, delta: number, season: PassSeason = BATTLE_PASS_S1): number {
  return Math.min(season.tiers * season.xpPerTier, currentXp + delta);
}
