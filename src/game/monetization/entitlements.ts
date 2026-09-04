// Entitlements — owned skins, equipped skins, draw pity, pass

import { loadPlayerProfile, savePlayerProfile, type PlayerProfile } from '@/game/progression/profile';

type EnrichedProfile = PlayerProfile & {
  diamonds: number;
  ownedSkins: string[];
  equippedSkins: Record<string, string>;
  hasFirstRecharge: boolean;
  pity: Record<string, number>;
  transactions: unknown[];
  pass?: { seasonId: string; level: number; xp: number; premium: boolean };
};

function ensure(p: PlayerProfile & Record<string, unknown>): EnrichedProfile {
  const a = p as unknown as Record<string, unknown>;
  if (typeof a['diamonds'] !== 'number') a['diamonds'] = 0;
  if (!Array.isArray(a['ownedSkins'])) a['ownedSkins'] = [];
  if (typeof a['equippedSkins'] !== 'object' || a['equippedSkins'] === null) a['equippedSkins'] = {};
  if (typeof a['hasFirstRecharge'] !== 'boolean') a['hasFirstRecharge'] = false;
  if (typeof a['pity'] !== 'object' || a['pity'] === null) a['pity'] = {};
  if (!Array.isArray(a['transactions'])) a['transactions'] = [];
  if (typeof a['pass'] !== 'object') a['pass'] = { seasonId: 'lakbay_s1_amarillo', level: 1, xp: 0, premium: false };
  return p as unknown as EnrichedProfile;
}

export function ownsSkin(skinId: string): boolean {
  const p = ensure(loadPlayerProfile() as unknown as PlayerProfile & Record<string, unknown>);
  return (p.ownedSkins as string[]).includes(skinId);
}

export function addOwnedSkin(skinId: string): EnrichedProfile {
  const p = ensure(loadPlayerProfile() as unknown as PlayerProfile & Record<string, unknown>);
  if (!p.ownedSkins.includes(skinId)) {
    p.ownedSkins.push(skinId);
    savePlayerProfile(p as unknown as PlayerProfile);
  }
  return p;
}

export function getEquippedSkin(heroId: string): string | undefined {
  const p = ensure(loadPlayerProfile() as unknown as PlayerProfile & Record<string, unknown>);
  return p.equippedSkins[heroId];
}

export function equipSkin(heroId: string, skinId: string): { ok: boolean; reason?: string } {
  const p = ensure(loadPlayerProfile() as unknown as PlayerProfile & Record<string, unknown>);
  if (!p.ownedSkins.includes(skinId)) return { ok: false, reason: 'not owned' };
  p.equippedSkins[heroId] = skinId;
  savePlayerProfile(p as unknown as PlayerProfile);
  return { ok: true };
}

export function unequipSkin(heroId: string): EnrichedProfile {
  const p = ensure(loadPlayerProfile() as unknown as PlayerProfile & Record<string, unknown>);
  delete p.equippedSkins[heroId];
  savePlayerProfile(p as unknown as PlayerProfile);
  return p;
}

export function getOwnedSkins(): string[] {
  return ensure(loadPlayerProfile() as unknown as PlayerProfile & Record<string, unknown>).ownedSkins.slice();
}

export function getPity(drawId: string): number {
  const p = ensure(loadPlayerProfile() as unknown as PlayerProfile & Record<string, unknown>);
  return (p.pity[drawId] as number) ?? 0;
}

export function incPity(drawId: string): number {
  const p = ensure(loadPlayerProfile() as unknown as PlayerProfile & Record<string, unknown>);
  const cur = (p.pity[drawId] as number) ?? 0;
  const next = cur + 1;
  (p.pity as Record<string, number>)[drawId] = next;
  savePlayerProfile(p as unknown as PlayerProfile);
  return next;
}

export function resetPity(drawId: string): void {
  const p = ensure(loadPlayerProfile() as unknown as PlayerProfile & Record<string, unknown>);
  (p.pity as Record<string, number>)[drawId] = 0;
  savePlayerProfile(p as unknown as PlayerProfile);
}

export function getPass(): EnrichedProfile['pass'] {
  return ensure(loadPlayerProfile() as unknown as PlayerProfile & Record<string, unknown>).pass!;
}

export function setPassPremium(val: boolean): EnrichedProfile['pass'] {
  const p = ensure(loadPlayerProfile() as unknown as PlayerProfile & Record<string, unknown>);
  p.pass!.premium = val;
  savePlayerProfile(p as unknown as PlayerProfile);
  return p.pass!;
}
