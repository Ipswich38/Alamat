// Dynamic Leveling Progression, XP Curve & Bounties (Level 1–15)
//
// ── PROGRESSION ARCHITECTURE ────────────────────────────────────────────────
// Level cap is 15. Kills on minions, jungle creeps, bosses, and towers grant
// both XP and Gold bounties. Leveling up increases max health, attack power,
// health regeneration, and armor.

export const MAX_LEVEL = 15;

/** Total cumulative XP required to reach each level (1-indexed, index 0 unused) */
export const XP_TABLE: number[] = [
  0,     // Level 0
  0,     // Level 1 (Starting)
  280,   // Level 2
  660,   // Level 3 (+380)
  1170,  // Level 4 (+510)
  1840,  // Level 5 (+670)
  2700,  // Level 6 (+860)
  3780,  // Level 7 (+1080)
  5110,  // Level 8 (+1330)
  6730,  // Level 9 (+1620)
  8680,  // Level 10 (+1950)
  11000, // Level 11 (+2320)
  13740, // Level 12 (+2740)
  16950, // Level 13 (+3210)
  20690, // Level 14 (+3740)
  25030, // Level 15 (+4340)
];

export interface Bounty {
  xp: number;
  gold: number;
}

export const BOUNTIES = {
  meleeMinion: { xp: 45, gold: 22 },
  rangedMinion: { xp: 35, gold: 16 },
  siegeMinion: { xp: 75, gold: 45 },
  jungleCreep: { xp: 140, gold: 75 },
  boss: { xp: 500, gold: 250 },
  tower: { xp: 250, gold: 200 },
  hero: { xp: 350, gold: 300 },
} as const;

export interface PlayerProgression {
  level: number;
  currentXp: number;
  xpToNextLevel: number;
  xpProgressPercent: number;
  gold: number;
}

export function calculateLevelFromXp(xp: number): number {
  let lvl = 1;
  for (let i = 1; i <= MAX_LEVEL; i++) {
    if (xp >= XP_TABLE[i]) {
      lvl = i;
    } else {
      break;
    }
  }
  return Math.min(MAX_LEVEL, lvl);
}

export function getProgressionState(xp: number, gold: number): PlayerProgression {
  const level = calculateLevelFromXp(xp);
  if (level >= MAX_LEVEL) {
    return {
      level: MAX_LEVEL,
      currentXp: xp,
      xpToNextLevel: 0,
      xpProgressPercent: 100,
      gold,
    };
  }

  const levelBaseXp = XP_TABLE[level];
  const nextLevelXp = XP_TABLE[level + 1];
  const span = nextLevelXp - levelBaseXp;
  const currentInLevel = Math.max(0, xp - levelBaseXp);
  const percent = Math.min(100, Math.max(0, (currentInLevel / span) * 100));

  return {
    level,
    currentXp: xp,
    xpToNextLevel: nextLevelXp - xp,
    xpProgressPercent: percent,
    gold,
  };
}

/** Scaled Max HP at level L */
export function getScaledMaxHp(baseHp: number, level: number): number {
  // +7.5% base HP per level gained
  const bonusPct = (level - 1) * 0.075;
  return Math.round(baseHp * (1 + bonusPct));
}

/** Scaled Attack Damage at level L */
export function getScaledAttack(baseAtk: number, level: number): number {
  // +6.0% base ATK per level gained
  const bonusPct = (level - 1) * 0.06;
  return Math.round(baseAtk * (1 + bonusPct));
}

/** Scaled Armor / Damage Mitigation at level L */
export function getScaledArmor(level: number): number {
  // 12 base armor + 2.5 per level
  return Math.round(12 + (level - 1) * 2.5);
}

/** Calculate percentage damage reduction from armor */
export function getArmorDamageReduction(armor: number): number {
  // Standard MOBA armor formula: reduction = armor / (armor + 100)
  return armor / (armor + 100);
}
