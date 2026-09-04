// Skins catalog — low-cost mass-market tiers
// Elite 400-600 Ginto or 49-69 diamonds, Epic 99-149, Legend 249, Prime 399
// Cosmetic-only: must never mutate HEROES stats. See types.SKIN_TIER_LABEL.

import type { HeroSkin } from './types';

export const SKINS: HeroSkin[] = [
  // Veer — vanguard horse trickster
  {
    id: 'veer_anito_woods',
    heroId: 'veer',
    tier: 'elite',
    name: 'Anito Woods Veer',
    tagalogName: 'Veer ng Kagubatan',
    blurb: 'Moss-stitched trailbreaker. Palette swap, same silhouette.',
    cost: { ginto: 450 },
    assets: { portrait: '/models/heroes/veer.png' },
  },
  {
    id: 'veer_diwata_storm',
    heroId: 'veer',
    tier: 'epic',
    name: 'Diwata Storm Veer',
    tagalogName: 'Veer ng Bagyo',
    blurb: 'Wind-swept mane, new hoof VFX, thunder recall.',
    cost: { diamonds: 119 },
    assets: { portrait: '/models/heroes/veer.png' },
  },
  // Thistle — mangkukulam
  {
    id: 'thistle_anito_hair',
    heroId: 'thistle',
    tier: 'elite',
    name: 'Anito Hair Thistle',
    tagalogName: 'Thistle ng Hibla',
    blurb: 'Ash-thread cloak, needle glint.',
    cost: { diamonds: 49 },
    assets: { portrait: '/models/heroes/thistle.png' },
  },
  {
    id: 'thistle_diwata_hex',
    heroId: 'thistle',
    tier: 'epic',
    name: 'Diwata Hex Thistle',
    tagalogName: 'Thistle ng Kulam',
    blurb: 'Violet ash cone, hex sigil spawn.',
    cost: { diamonds: 129 },
    assets: { portrait: '/models/heroes/thistle.png' },
  },
  // Hollow — aswang hunter
  {
    id: 'hollow_anito_night',
    heroId: 'hollow',
    tier: 'elite',
    name: 'Anito Night Hollow',
    tagalogName: 'Hollow ng Gabi',
    blurb: 'Midnight leather, quieter dash trail.',
    cost: { ginto: 600 },
    assets: { portrait: '/models/heroes/hollow.png' },
  },
  {
    id: 'hollow_diwata_blood',
    heroId: 'hollow',
    tier: 'epic',
    name: 'Diwata Blood Hollow',
    tagalogName: 'Hollow ng Dugo',
    blurb: 'Crimson arc recolor, blood-mist recall.',
    cost: { diamonds: 99 },
    assets: { portrait: '/models/heroes/hollow.png' },
  },
  // Willow — diwata warden
  {
    id: 'willow_anito_grove',
    heroId: 'willow',
    tier: 'elite',
    name: 'Anito Grove Willow',
    tagalogName: 'Willow ng Punong',
    blurb: 'Bamboo-hemmed warden, leaf wisp.',
    cost: { ginto: 500 },
    assets: { portrait: '/models/heroes/willow.png' },
  },
  {
    id: 'willow_diwata_bloom',
    heroId: 'willow',
    tier: 'epic',
    name: 'Diwata Bloom Willow',
    tagalogName: 'Willow ng Bulaklak',
    blurb: 'Petal wisp trail, blossom border.',
    cost: { diamonds: 119 },
    assets: { portrait: '/models/heroes/willow.png' },
  },
  // Bedrock — mountain giant
  {
    id: 'bedrock_anito_slab',
    heroId: 'bedrock',
    tier: 'elite',
    name: 'Anito Slab Bedrock',
    tagalogName: 'Bedrock ng Bato',
    blurb: 'Basalt slab, dustier fault line.',
    cost: { ginto: 550 },
    assets: { portrait: '/models/heroes/bedrock.png' },
  },
  {
    id: 'bedrock_diwata_quake',
    heroId: 'bedrock',
    tier: 'epic',
    name: 'Diwata Quake Bedrock',
    tagalogName: 'Bedrock ng Lindol',
    blurb: 'Golden fissure, quake SFX swap.',
    cost: { diamonds: 149 },
    assets: { portrait: '/models/heroes/bedrock.png' },
  },
  // Legend / Prime — gated behind draws but purchasable cheap
  {
    id: 'veer_bathala_apolaki',
    heroId: 'veer',
    tier: 'legend',
    name: 'Bathala Apolaki Veer',
    tagalogName: 'Veer ng Araw',
    blurb: 'Sun-gilded stampede, solar recall.',
    cost: { diamonds: 249 },
    drawId: 'anito_draw_s1',
    assets: { portrait: '/models/heroes/veer.png' },
  },
  {
    id: 'willow_apolaki_dawn',
    heroId: 'willow',
    tier: 'prime',
    name: 'Apolaki Dawn Willow',
    tagalogName: 'Willow ng Bukang-Liwayway',
    blurb: 'Dawn-branch grove, prime voice tagline.',
    cost: { diamonds: 399 },
    drawId: 'anito_draw_s1',
    assets: { portrait: '/models/heroes/willow.png' },
  },
];

export function skinsForHero(heroId: string): HeroSkin[] {
  return SKINS.filter((s) => s.heroId === heroId);
}

export function skinById(id: string): HeroSkin | undefined {
  return SKINS.find((s) => s.id === id);
}

// Invariant: skins must not carry stats — call in tests
export function assertCosmeticOnly(skin: HeroSkin): void {
  const forbidden = ['health', 'speed', 'attack', 'attackRange', 'attackCooldown', 'damage', 'range', 'cooldown', 'windup', 'lock'];
  const asUnknown = skin as unknown as Record<string, unknown>;
  for (const key of forbidden) {
    if (key in asUnknown) throw new Error(`Skin ${skin.id} must not define ${key}`);
  }
}
