// Talisman Shop Item Catalogue
//
// ── ITEMS & MYTHIC ARTIFACTS ────────────────────────────────────────────────
// Weapons, armor, boots, and charms derived from old legend.

export interface ItemAttributes {
  flatHp?: number;
  flatAttack?: number;
  flatSpeed?: number;
  flatArmor?: number;
  hpRegen?: number;
  cooldownHaste?: number; // e.g. 0.15 for 15% CDR
  attackSpeedPct?: number;
  lifestealPct?: number;
}

export interface TalismanItem {
  id: string;
  name: string;
  category: 'weapon' | 'armor' | 'boots' | 'charm';
  cost: number;
  emoji: string;
  blurb: string;
  lore: string;
  stats: ItemAttributes;
}

export const AGIMAT_ITEMS: TalismanItem[] = [
  {
    id: 'blade-fire',
    name: 'Blade of Searing Fire',
    category: 'weapon',
    cost: 1200,
    emoji: '🗡️',
    blurb: '+45 ATK · +15% Attack Speed · Searing Edge',
    lore: 'Forged in the volcanic embers of the Fire Peak. Its single-edged blade leaves a burning wound that never stops smoking.',
    stats: {
      flatAttack: 45,
      attackSpeedPct: 0.15,
      flatSpeed: 0.2,
    },
  },
  {
    id: 'talisman-bathala',
    name: 'Talisman of the Maker',
    category: 'armor',
    cost: 1600,
    emoji: '🧿',
    blurb: '+380 Max HP · +20 Armor · +10 HP/s Regen',
    lore: 'An ancient brass pendant inscribed with sacred Baybayin protective prayers. Shields the wearer from fatal blows.',
    stats: {
      flatHp: 380,
      flatArmor: 20,
      hpRegen: 10,
    },
  },
  {
    id: 'amihan-boots',
    name: 'Amihan Wind Boots',
    category: 'boots',
    cost: 750,
    emoji: '🥾',
    blurb: '+1.2 Move Speed · +15% Cooldown Haste',
    lore: 'Lightweight abaca sandals blessed by the northeast monsoon. Grants swift passage across mud, rivers, and jungle brush.',
    stats: {
      flatSpeed: 1.2,
      cooldownHaste: 0.15,
    },
  },
  {
    id: 'argent-relic',
    name: "Argent's Lunar Crescent",
    category: 'weapon',
    cost: 1400,
    emoji: '🌙',
    blurb: '+55 ATK · +20% Cooldown Haste · Lunar Radiance',
    lore: 'A fragment of silver moonlight shaped into an ethereal edge. Pierces supernatural armor and shortens ability windups.',
    stats: {
      flatAttack: 55,
      cooldownHaste: 0.2,
    },
  },
  {
    id: 'wakwak-talon',
    name: 'Talon of the Wakwak',
    category: 'weapon',
    cost: 1350,
    emoji: '🦅',
    blurb: '+38 ATK · +18% Lifesteal',
    lore: 'The razor claw of the nocturnal predator bird. Siphons vitality directly from the flesh of struck enemies.',
    stats: {
      flatAttack: 38,
      lifestealPct: 0.18,
    },
  },
  {
    id: 'idol-heart',
    name: 'Idol Heart Totem',
    category: 'charm',
    cost: 1500,
    emoji: '🗿',
    blurb: '+420 Max HP · +15 Armor · +12 HP/s Regen',
    lore: 'A carved granary guardian idol pulsating with primordial earth spirit. Bestows mountain fortitude upon its bearer.',
    stats: {
      flatHp: 420,
      flatArmor: 15,
      hpRegen: 12,
    },
  },
  {
    id: 'mutya-pearl',
    name: 'Pearl of the Sacred River',
    category: 'charm',
    cost: 950,
    emoji: '🔮',
    blurb: '+220 HP · +25 ATK · +0.6 Move Speed',
    lore: 'A glowing pearl harvested from the sacred depths of the Sacred River riverbed before the age of iron.',
    stats: {
      flatHp: 220,
      flatAttack: 25,
      flatSpeed: 0.6,
    },
  },
];

export const itemById = (id: string): TalismanItem | undefined =>
  AGIMAT_ITEMS.find((item) => item.id === id);
