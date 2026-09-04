// Skins catalog — low-cost mass-market tiers
// Elite 400-600 Gold or 49-69 diamonds, Epic 99-149, Legend 249, Prime 399
// Cosmetic-only: must never mutate HEROES stats. See types.SKIN_TIER_LABEL.

import type { HeroSkin } from './types';

export const SKINS: HeroSkin[] = [
  // Veer — vanguard horse trickster
  {
    id: 'veer_spirit_woods',
    heroId: 'veer',
    tier: 'elite',
    name: 'Spirit Woods Veer',
    blurb: 'Moss-stitched trailbreaker. Palette swap, same silhouette.',
    cost: { gold: 450 },
    assets: { portrait: '/models/heroes/veer.png' },
  },
  {
    id: 'veer_storm_guardian',
    heroId: 'veer',
    tier: 'epic',
    name: 'Storm Guardian Veer',
    blurb: 'Wind-swept mane, new hoof VFX, thunder recall.',
    cost: { diamonds: 119 },
    assets: { portrait: '/models/heroes/veer.png' },
  },
  // Thistle — hex weaver
  {
    id: 'thistle_thread_veil',
    heroId: 'thistle',
    tier: 'elite',
    name: 'Thread Veil Thistle',
    blurb: 'Ash-thread cloak, needle glint.',
    cost: { diamonds: 49 },
    assets: { portrait: '/models/heroes/thistle.png' },
  },
  {
    id: 'thistle_hex_sorceress',
    heroId: 'thistle',
    tier: 'epic',
    name: 'Hex Sorceress Thistle',
    blurb: 'Violet ash cone, hex sigil spawn.',
    cost: { diamonds: 129 },
    assets: { portrait: '/models/heroes/thistle.png' },
  },
  // Hollow — night hunter
  {
    id: 'hollow_night_stalker',
    heroId: 'hollow',
    tier: 'elite',
    name: 'Night Stalker Hollow',
    blurb: 'Midnight leather, quieter dash trail.',
    cost: { gold: 600 },
    assets: { portrait: '/models/heroes/hollow.png' },
  },
  {
    id: 'hollow_blood_hunter',
    heroId: 'hollow',
    tier: 'epic',
    name: 'Blood Hunter Hollow',
    blurb: 'Crimson arc recolor, blood-mist recall.',
    cost: { diamonds: 99 },
    assets: { portrait: '/models/heroes/hollow.png' },
  },
  // Willow — grove warden
  {
    id: 'willow_grove_keeper',
    heroId: 'willow',
    tier: 'elite',
    name: 'Grove Keeper Willow',
    blurb: 'Bamboo-hemmed warden, leaf wisp.',
    cost: { gold: 500 },
    assets: { portrait: '/models/heroes/willow.png' },
  },
  {
    id: 'willow_bloom_warden',
    heroId: 'willow',
    tier: 'epic',
    name: 'Bloom Warden Willow',
    blurb: 'Petal wisp trail, blossom border.',
    cost: { diamonds: 119 },
    assets: { portrait: '/models/heroes/willow.png' },
  },
  // Bedrock — mountain giant
  {
    id: 'bedrock_slab_guardian',
    heroId: 'bedrock',
    tier: 'elite',
    name: 'Slab Guardian Bedrock',
    blurb: 'Basalt slab, dustier fault line.',
    cost: { gold: 550 },
    assets: { portrait: '/models/heroes/bedrock.png' },
  },
  {
    id: 'bedrock_quake_titan',
    heroId: 'bedrock',
    tier: 'epic',
    name: 'Quake Titan Bedrock',
    blurb: 'Golden fissure, quake SFX swap.',
    cost: { diamonds: 149 },
    assets: { portrait: '/models/heroes/bedrock.png' },
  },
  // Legend / Prime — gated behind draws but purchasable cheap
  {
    id: 'veer_solar_sovereign',
    heroId: 'veer',
    tier: 'legend',
    name: 'Solar Sovereign Veer',
    blurb: 'Sun-gilded stampede, solar recall.',
    cost: { diamonds: 249 },
    drawId: 'mystic_draw_s1',
    assets: { portrait: '/models/heroes/veer.png' },
  },
  {
    id: 'willow_dawn_prime',
    heroId: 'willow',
    tier: 'prime',
    name: 'Dawn Prime Willow',
    blurb: 'Dawn-branch grove, prime voice tagline.',
    cost: { diamonds: 399 },
    drawId: 'mystic_draw_s1',
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
