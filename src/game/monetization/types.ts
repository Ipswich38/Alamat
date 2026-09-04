// Monetization shared types — low-cost mass-market economy
// Single source for currencies, transactions, entitlements, pass, gacha.

export type CurrencyId = 'gold' | 'diamonds';

export interface Transaction {
  id: string;
  at: number; // epoch ms
  currency: CurrencyId;
  delta: number; // +earn / -spend
  reason: string;
  balanceAfter: number;
}

export interface TopUpBundle {
  id: string;
  phpPrice: number;
  baseDiamonds: number;
  bonusDiamonds: number;
  totalDiamonds: number;
  tag?: string; // e.g., 'Best Value', 'First Bonus'
}

// Low-cost bundles — cap at ₱149 (~$2.50) per plan. Leaves small leftovers.
export const TOPUP_BUNDLES: TopUpBundle[] = [
  { id: 'topup_49', phpPrice: 49, baseDiamonds: 50, bonusDiamonds: 5, totalDiamonds: 55, tag: 'Starter' },
  { id: 'topup_99', phpPrice: 99, baseDiamonds: 100, bonusDiamonds: 15, totalDiamonds: 115, tag: 'Popular' },
  { id: 'topup_149', phpPrice: 149, baseDiamonds: 300, bonusDiamonds: 30, totalDiamonds: 330, tag: 'Best Value' },
];

// First-recharge bonus: +100% up to 100 diamonds (small welcome, not whale)
export const FIRST_RECHARGE_MAX_BONUS = 100;

export type SkinTier = 'elite' | 'epic' | 'collector' | 'legend' | 'prime';
export const SKIN_TIER_LABEL: Record<SkinTier, { en: string; color: string }> = {
  elite: { en: 'Elite', color: '#38bdf8' },
  epic: { en: 'Epic', color: '#a855f7' },
  collector: { en: 'Collector', color: '#f59e0b' },
  legend: { en: 'Legend', color: '#f43f5e' },
  prime: { en: 'Prime', color: '#00e5ff' },
};

export interface SkinCost {
  gold?: number;
  diamonds?: number;
}

export interface HeroSkin {
  id: string;
  heroId: string;
  tier: SkinTier;
  name: string;
  blurb: string;
  cost: SkinCost;
  // Cosmetic-only assets; must not carry stats
  assets?: {
    portrait?: string;
    // future: rigged, walk, vfxTheme, recall, sfx
  };
  drawId?: string; // if gated behind gacha
}

export interface PassTierReward {
  gold?: number;
  diamonds?: number;
  skinId?: string;
  ticket?: number; // draw ticket
  border?: string;
  recall?: string;
}

export interface PassSeason {
  id: string;
  name: string;
  days: number;
  tiers: number;
  xpPerTier: number;
  freeTrack: Record<number, PassTierReward>;
  premiumTrack: Record<number, PassTierReward>;
  premiumPrice: number; // diamonds
}

export interface GachaPoolItem {
  id: string; // skinId or consolation item
  weight: number;
  tier: SkinTier;
}

export interface GachaDraw {
  id: string;
  name: string;
  ticketsPerPull: number;
  costDiamonds: number;
  costDiamonds10: number;
  pity: number; // pulls to guarantee high tier
  /*
   * No `odds` field on purpose. It used to be typed by hand here and
   * contradicted the pool on every line, including advertising a tier that had
   * no items in it. Real odds come from `tierOdds(draw)` in ./gacha, worked out
   * from the same pool rollGacha draws from, so the two cannot disagree.
   */
  pool: GachaPoolItem[];
}
