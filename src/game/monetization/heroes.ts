// Hero unlock costs — low friction: 2,800 Ginto or 79 diamonds; bundle 99

export const HERO_UNLOCK_GINTO = 2800;
export const HERO_UNLOCK_DIAMONDS = 79;
export const HERO_BUNDLE_DIAMONDS = 99; // hero + elite

export const FREE_ROTATION_IDS = ['veer', 'willow', 'hollow'] as const;

export function isHeroUnlocked(heroId: string, ownedSkinsOrUnlocks: string[], level?: number): boolean {
  // For now ownedSkins doubles as hero unlock tracking if you own any skin for hero? Better use separate key.
  // Simple: if hero in FREE_ROTATION or Veer default unlocked, or in unlock list
  if (FREE_ROTATION_IDS.includes(heroId as typeof FREE_ROTATION_IDS[number])) return true;
  return ownedSkinsOrUnlocks.includes(`hero:${heroId}`);
}

export function heroUnlockKey(heroId: string): string {
  return `hero:${heroId}`;
}
