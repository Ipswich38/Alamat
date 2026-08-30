// RPG Active Inventory & Stat Calculation Engine
//
// ── INVENTORY ARCHITECTURE ──────────────────────────────────────────────────
// 6 inventory item slots. Calculates combined item bonuses and applies
// mathematical modifiers onto base hero stats.

import type { Hero } from '@/game/heroes';
import { type TalismanItem, type ItemAttributes, itemById } from './catalogue';
import { getScaledAttack, getScaledMaxHp, getScaledArmor } from '@/game/combat/progression';

export const MAX_INVENTORY_SLOTS = 6;

export interface EffectiveHeroStats {
  maxHp: number;
  attack: number;
  speed: number;
  armor: number;
  hpRegen: number;
  attackSpeedMultiplier: number;
  cooldownHaste: number;
  lifestealPct: number;
}

export interface InventoryManager {
  items: (TalismanItem | null)[];
  addItem: (item: TalismanItem) => boolean;
  removeItem: (slotIndex: number) => TalismanItem | null;
  getCombinedStats: () => ItemAttributes;
  getEffectiveStats: (baseHero: Hero, level: number) => EffectiveHeroStats;
  getItemList: () => TalismanItem[];
  isFull: () => boolean;
}

export function createInventoryManager(initialItemIds: string[] = []): InventoryManager {
  const slots: (TalismanItem | null)[] = new Array(MAX_INVENTORY_SLOTS).fill(null);

  initialItemIds.slice(0, MAX_INVENTORY_SLOTS).forEach((id, idx) => {
    const item = itemById(id);
    if (item) slots[idx] = item;
  });

  const addItem = (item: TalismanItem): boolean => {
    const emptyIndex = slots.findIndex((s) => s === null);
    if (emptyIndex === -1) return false;
    slots[emptyIndex] = item;
    return true;
  };

  const removeItem = (slotIndex: number): TalismanItem | null => {
    if (slotIndex < 0 || slotIndex >= MAX_INVENTORY_SLOTS) return null;
    const removed = slots[slotIndex];
    slots[slotIndex] = null;
    return removed;
  };

  const isFull = (): boolean => slots.every((s) => s !== null);

  const getCombinedStats = (): ItemAttributes => {
    const combined: ItemAttributes = {
      flatHp: 0,
      flatAttack: 0,
      flatSpeed: 0,
      flatArmor: 0,
      hpRegen: 0,
      cooldownHaste: 0,
      attackSpeedPct: 0,
      lifestealPct: 0,
    };

    for (const item of slots) {
      if (!item) continue;
      if (item.stats.flatHp) combined.flatHp! += item.stats.flatHp;
      if (item.stats.flatAttack) combined.flatAttack! += item.stats.flatAttack;
      if (item.stats.flatSpeed) combined.flatSpeed! += item.stats.flatSpeed;
      if (item.stats.flatArmor) combined.flatArmor! += item.stats.flatArmor;
      if (item.stats.hpRegen) combined.hpRegen! += item.stats.hpRegen;
      if (item.stats.cooldownHaste) combined.cooldownHaste! += item.stats.cooldownHaste;
      if (item.stats.attackSpeedPct) combined.attackSpeedPct! += item.stats.attackSpeedPct;
      if (item.stats.lifestealPct) combined.lifestealPct! += item.stats.lifestealPct;
    }

    return combined;
  };

  const getEffectiveStats = (baseHero: Hero, level: number): EffectiveHeroStats => {
    const itemStats = getCombinedStats();

    const scaledHp = getScaledMaxHp(baseHero.health, level);
    const scaledAtk = getScaledAttack(baseHero.attack, level);
    const scaledArmor = getScaledArmor(level);

    const maxHp = scaledHp + (itemStats.flatHp || 0);
    const attack = scaledAtk + (itemStats.flatAttack || 0);
    const speed = baseHero.speed + (itemStats.flatSpeed || 0);
    const armor = scaledArmor + (itemStats.flatArmor || 0);
    const hpRegen = 3.5 + level * 0.5 + (itemStats.hpRegen || 0);
    const attackSpeedMultiplier = 1 + (itemStats.attackSpeedPct || 0);
    const cooldownHaste = Math.min(0.5, itemStats.cooldownHaste || 0); // Cap CDR at 50%
    const lifestealPct = itemStats.lifestealPct || 0;

    return {
      maxHp,
      attack,
      speed,
      armor,
      hpRegen,
      attackSpeedMultiplier,
      cooldownHaste,
      lifestealPct,
    };
  };

  const getItemList = (): TalismanItem[] => slots.filter((s): s is TalismanItem => s !== null);

  return {
    items: slots,
    addItem,
    removeItem,
    getCombinedStats,
    getEffectiveStats,
    getItemList,
    isFull,
  };
}
