// Dual-currency ledger — Gold (soft, grind) + Diamonds (hard, premium)
// Low-cost tuning: 1 USD ≈ 200 gems, bundles cap at low price. First recharge +100% up to 100.

import type { CurrencyId, TopUpBundle, Transaction, FIRST_RECHARGE_MAX_BONUS } from './types';
import { TOPUP_BUNDLES } from './types';
import { loadPlayerProfile, savePlayerProfile, type PlayerProfile } from '@/game/progression/profile';

// Helpers to ensure entitlements fields exist (migration-safe)
function ensureMonetizationFields(p: PlayerProfile & Record<string, unknown>): PlayerProfile & {
  diamonds: number;
  hasFirstRecharge: boolean;
  transactions: Transaction[];
} {
  const anyP = p as unknown as Record<string, unknown>;
  if (typeof anyP['diamonds'] !== 'number') anyP['diamonds'] = 0;
  if (typeof anyP['hasFirstRecharge'] !== 'boolean') anyP['hasFirstRecharge'] = false;
  if (!Array.isArray(anyP['transactions'])) anyP['transactions'] = [];
  return p as PlayerProfile & { diamonds: number; hasFirstRecharge: boolean; transactions: Transaction[] };
}

function pushTx(profile: PlayerProfile & { transactions: Transaction[] }, currency: CurrencyId, delta: number, reason: string, balanceAfter: number) {
  const tx: Transaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    currency,
    delta,
    reason,
    balanceAfter,
  };
  profile.transactions.unshift(tx);
  // keep last 80
  if (profile.transactions.length > 80) profile.transactions = profile.transactions.slice(0, 80);
}

export function getGold(): number {
  return loadPlayerProfile().gold;
}

export function getDiamonds(): number {
  const p = loadPlayerProfile() as unknown as { diamonds?: number };
  return typeof p.diamonds === 'number' ? p.diamonds : 0;
}

export function addGold(amount: number, reason: string): PlayerProfile {
  const p = ensureMonetizationFields(loadPlayerProfile() as unknown as PlayerProfile & Record<string, unknown>);
  p.gold += amount;
  pushTx(p, 'gold', amount, reason, p.gold);
  savePlayerProfile(p);
  return p;
}

export function spendGold(amount: number, reason: string): { ok: boolean; profile: PlayerProfile } {
  const p = ensureMonetizationFields(loadPlayerProfile() as unknown as PlayerProfile & Record<string, unknown>);
  if (p.gold < amount) return { ok: false, profile: p };
  p.gold -= amount;
  pushTx(p, 'gold', -amount, reason, p.gold);
  savePlayerProfile(p);
  return { ok: true, profile: p };
}

export function addDiamonds(amount: number, reason: string): PlayerProfile {
  const p = ensureMonetizationFields(loadPlayerProfile() as unknown as PlayerProfile & Record<string, unknown>);
  // first-recharge bonus applies only via topUpWithBundle, not generic add
  p.diamonds += amount;
  pushTx(p, 'diamonds', amount, reason, p.diamonds);
  savePlayerProfile(p);
  return p;
}

export function spendDiamonds(amount: number, reason: string): { ok: boolean; profile: PlayerProfile } {
  const p = ensureMonetizationFields(loadPlayerProfile() as unknown as PlayerProfile & Record<string, unknown>);
  if (p.diamonds < amount) return { ok: false, profile: p };
  p.diamonds -= amount;
  pushTx(p, 'diamonds', -amount, reason, p.diamonds);
  savePlayerProfile(p);
  return { ok: true, profile: p };
}

// Bundle purchase — mock provider, applies first-recharge bonus once
export function topUpWithBundle(bundleId: string): { ok: boolean; added: number; bonus: number; profile: PlayerProfile; reason: string } {
  const bundle = TOPUP_BUNDLES.find((b) => b.id === bundleId);
  if (!bundle) return { ok: false, added: 0, bonus: 0, profile: loadPlayerProfile(), reason: 'unknown bundle' };
  const p = ensureMonetizationFields(loadPlayerProfile() as unknown as PlayerProfile & Record<string, unknown>);
  let bonus = bundle.bonusDiamonds;
  // first-recharge doubles base up to FIRST_RECHARGE_MAX_BONUS
  if (!p.hasFirstRecharge) {
    const firstBonus = Math.min(bundle.baseDiamonds, 100);
    bonus += firstBonus;
    p.hasFirstRecharge = true;
  }
  const total = bundle.baseDiamonds + bonus;
  p.diamonds += total;
  pushTx(p, 'diamonds', total, `topup:${bundle.id} (+${bonus} bonus)`, p.diamonds);
  savePlayerProfile(p);
  return { ok: true, added: bundle.baseDiamonds, bonus, profile: p, reason: bundle.id };
}

export function getBundles(): TopUpBundle[] {
  return TOPUP_BUNDLES;
}

export function formatPrice(bundle: TopUpBundle): string {
  return `₱${bundle.phpPrice} → ${bundle.totalDiamonds} 💎`;
}
