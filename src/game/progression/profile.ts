// Master Progressive Account, Hero Mastery, Quests, Match History & Settings Engine
//
// ── PROGRESSION ARCHITECTURE ────────────────────────────────────────────────
// 1. Account Leveling (1 to 50) with Old Legend Rank Hierarchy
// 2. Individual Hero Mastery (Levels 1 to 10) with unique Hero Titles
// 3. Dynamic Daily & Archipelago Battle Quests with Gold & Account XP rewards
// 4. Match History & Performance Statistics (K/D/A, MVP ratings, Boss takedowns)
// 5. Mobile-Tailored Gameplay Settings (Haptics, Drag Sensitivity, Quality, Joystick Mode)
// 6. Resilient LocalStorage Persistence with automatic synchronization

export type RankTier = 'spear' | 'ram' | 'datu' | 'rajah' | 'bathala';

export interface RankInfo {
  tier: RankTier;
  title: string;
  baybayin: string;
  minLevel: number;
  badgeEmoji: string;
  color: string;
}

export const RANK_TIERS: RankInfo[] = [
  {
    tier: 'spear',
    title: 'Warrior of the People',
    baybayin: 'ᜋᜈ᜔ᜇᜒᜇᜒᜄ᜔ᜋ',
    minLevel: 1,
    badgeEmoji: '🗡️',
    color: '#94a3b8',
  },
  {
    tier: 'ram',
    title: 'Champion of the Wilds',
    baybayin: 'ᜊᜄᜈᜒ',
    minLevel: 6,
    badgeEmoji: '🛡️',
    color: '#38bdf8',
  },
  {
    tier: 'datu',
    title: 'Chief of the Isles',
    baybayin: 'ᜇᜆᜓ',
    minLevel: 15,
    badgeEmoji: '👑',
    color: '#a855f7',
  },
  {
    tier: 'rajah',
    title: 'Sovereign of the Skies',
    baybayin: 'ᜇᜑ᜔',
    minLevel: 30,
    badgeEmoji: '⚡',
    color: '#f59e0b',
  },
  {
    tier: 'bathala',
    title: 'Chosen of the Creator',
    baybayin: 'ᜊ8ᜎ',
    minLevel: 45,
    badgeEmoji: '☀️',
    color: '#00e5ff',
  },
];

export interface HeroMasteryData {
  heroId: string;
  masteryLevel: number; // 1 to 10
  masteryXp: number;
  matchesPlayed: number;
  wins: number;
  kills: number;
  mvpCount: number;
}

export interface MatchHistoryEntry {
  id: string;
  timestamp: number;
  heroId: string;
  territoryId: string;
  outcome: 'victory' | 'defeat';
  durationSeconds: number;
  kills: number;
  deaths: number;
  assists: number;
  goldEarned: number;
  accountXpEarned: number;
  masteryXpEarned: number;
  heroLevelReached: number;
  bossesSlain: number;
  towersDestroyed: number;
  isMvp: boolean;
}

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  progress: number;
  rewardGold: number;
  rewardXp: number;
  completed: boolean;
  claimed: boolean;
}

export interface MobileGameSettings {
  hapticsEnabled: boolean;
  vibrationIntensity: number; // 0.2 to 1.5 (default 1.0)
  aimSensitivity: number; // 0.6 to 1.8 (default 1.0)
  autoAimPriority: 'lowest_hp' | 'closest'; // Mobile quick-tap auto-targeting priority
  joystickMode: 'fixed' | 'dynamic'; // fixed anchor vs dynamic drag origin
  cameraAimLead: boolean; // pan camera slightly toward skillshot aim
  graphicsQuality: 'performance' | 'balanced' | 'ultra';
  fpsTarget: 30 | 60 | 90 | 120; // Android high-refresh rate display target
  gamepadEnabled: boolean; // Bluetooth/USB controller support
  hudScale: 'compact' | 'normal' | 'large';
  masterVolume: number; // 0.0 to 1.0
  sfxVolume: number;
  musicVolume: number;
  fullscreenPromptShown: boolean;
}

export interface PlayerProfile {
  name: string;
  accountLevel: number;
  accountXp: number;
  gold: number; // soft currency — "Ginto" (keep key for compat)
  // monetization — low-cost mass-market economy
  diamonds: number;
  hasFirstRecharge: boolean;
  transactions: { id: string; at: number; currency: 'ginto'|'diamante'; delta: number; reason: string; balanceAfter: number }[];
  ownedSkins: string[];
  equippedSkins: Record<string, string>; // heroId -> skinId
  pity: Record<string, number>; // drawId -> pulls since last high-tier
  pass: { seasonId: string; level: number; xp: number; premium: boolean };
  totalMatches: number;
  totalWins: number;
  totalKills: number;
  totalTowers: number;
  totalBosses: number;
  heroMasteries: Record<string, HeroMasteryData>;
  matchHistory: MatchHistoryEntry[];
  dailyQuests: DailyQuest[];
  unlockedCodexEntries: string[];
  settings: MobileGameSettings;
  createdAt: number;
  lastActive: number;
}

const STORAGE_KEY = 'talisman_player_profile_v2';

export const DEFAULT_SETTINGS: MobileGameSettings = {
  hapticsEnabled: true,
  vibrationIntensity: 1.0,
  aimSensitivity: 1.0,
  autoAimPriority: 'lowest_hp',
  joystickMode: 'fixed',
  cameraAimLead: true,
  graphicsQuality: 'balanced',
  fpsTarget: 60,
  gamepadEnabled: true,
  hudScale: 'normal',
  masterVolume: 1.0,
  sfxVolume: 1.0,
  musicVolume: 0.8,
  fullscreenPromptShown: false,
};

const DEFAULT_QUESTS: DailyQuest[] = [
  {
    id: 'quest_first_blood',
    title: 'First Blood at the River',
    description: 'Score 3 takedowns against enemy invaders in the arena.',
    icon: '⚔️',
    target: 3,
    progress: 0,
    rewardGold: 150,
    rewardXp: 120,
    completed: false,
    claimed: false,
  },
  {
    id: 'quest_slay_boss',
    title: 'Monster Subdued',
    description: 'Defeat the Treant in the jungle or the Maw in the river pit.',
    icon: '🐉',
    target: 1,
    progress: 0,
    rewardGold: 250,
    rewardXp: 200,
    completed: false,
    claimed: false,
  },
  {
    id: 'quest_destroy_towers',
    title: 'Tower Fallen',
    description: 'Destroy 2 enemy totem towers or defenses with your squad.',
    icon: '🛡️',
    target: 2,
    progress: 0,
    rewardGold: 200,
    rewardXp: 180,
    completed: false,
    claimed: false,
  },
  {
    id: 'quest_archipelago_victory',
    title: 'Victory in the Isles',
    description: 'Achieve victory in any territory of the ancient Archipelago.',
    icon: '👑',
    target: 1,
    progress: 0,
    rewardGold: 300,
    rewardXp: 250,
    completed: false,
    claimed: false,
  },
];

export function getAccountXpForLevel(level: number): number {
  // Base 300 XP + 150 per level growth
  return 300 + (level - 1) * 150;
}

export function getMasteryXpForLevel(level: number): number {
  return 200 + (level - 1) * 120;
}

export function getRankForLevel(level: number): RankInfo {
  let highest = RANK_TIERS[0];
  for (const rank of RANK_TIERS) {
    if (level >= rank.minLevel) {
      highest = rank;
    }
  }
  return highest;
}

export function getDefaultProfile(): PlayerProfile {
  return {
    name: 'Hero of Legend',
    accountLevel: 1,
    accountXp: 0,
    gold: 500,
    diamonds: 0,
    hasFirstRecharge: false,
    transactions: [],
    ownedSkins: [],
    equippedSkins: {},
    pity: {},
    pass: { seasonId: 'lakbay_s1_amarillo', level: 1, xp: 0, premium: false },
    totalMatches: 0,
    totalWins: 0,
    totalKills: 0,
    totalTowers: 0,
    totalBosses: 0,
    heroMasteries: {
      veer: { heroId: 'veer', masteryLevel: 1, masteryXp: 0, matchesPlayed: 0, wins: 0, kills: 0, mvpCount: 0 },
      thistle: { heroId: 'thistle', masteryLevel: 1, masteryXp: 0, matchesPlayed: 0, wins: 0, kills: 0, mvpCount: 0 },
      hollow: { heroId: 'hollow', masteryLevel: 1, masteryXp: 0, matchesPlayed: 0, wins: 0, kills: 0, mvpCount: 0 },
      willow: { heroId: 'willow', masteryLevel: 1, masteryXp: 0, matchesPlayed: 0, wins: 0, kills: 0, mvpCount: 0 },
      bedrock: { heroId: 'bedrock', masteryLevel: 1, masteryXp: 0, matchesPlayed: 0, wins: 0, kills: 0, mvpCount: 0 },
      sever: { heroId: 'sever', masteryLevel: 1, masteryXp: 0, matchesPlayed: 0, wins: 0, kills: 0, mvpCount: 0 },
      argent: { heroId: 'argent', masteryLevel: 1, masteryXp: 0, matchesPlayed: 0, wins: 0, kills: 0, mvpCount: 0 },
      zenith: { heroId: 'zenith', masteryLevel: 1, masteryXp: 0, matchesPlayed: 0, wins: 0, kills: 0, mvpCount: 0 },
      maw: { heroId: 'maw', masteryLevel: 1, masteryXp: 0, matchesPlayed: 0, wins: 0, kills: 0, mvpCount: 0 },
      tala: { heroId: 'tala', masteryLevel: 1, masteryXp: 0, matchesPlayed: 0, wins: 0, kills: 0, mvpCount: 0 },
    },
    matchHistory: [],
    dailyQuests: DEFAULT_QUESTS,
    unlockedCodexEntries: ['warding', 'veer', 'blade'],
    settings: DEFAULT_SETTINGS,
    createdAt: Date.now(),
    lastActive: Date.now(),
  };
}

export function loadPlayerProfile(): PlayerProfile {
  if (typeof window === 'undefined') return getDefaultProfile();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const defaultProf = getDefaultProfile();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultProf));
      return defaultProf;
    }
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    const base = getDefaultProfile();
    return {
      ...base,
      ...parsed,
      gold: typeof parsed.gold === 'number' ? parsed.gold : base.gold,
      diamonds: typeof parsed.diamonds === 'number' ? parsed.diamonds : base.diamonds,
      hasFirstRecharge: typeof parsed.hasFirstRecharge === 'boolean' ? parsed.hasFirstRecharge : base.hasFirstRecharge,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : base.transactions,
      ownedSkins: Array.isArray(parsed.ownedSkins) ? parsed.ownedSkins : base.ownedSkins,
      equippedSkins: parsed.equippedSkins && typeof parsed.equippedSkins === 'object' ? parsed.equippedSkins : base.equippedSkins,
      pity: parsed.pity && typeof parsed.pity === 'object' ? parsed.pity : base.pity,
      pass: parsed.pass && typeof parsed.pass === 'object' ? parsed.pass as PlayerProfile['pass'] : base.pass,
      settings: { ...base.settings, ...(parsed.settings || {}) },
      heroMasteries: { ...base.heroMasteries, ...(parsed.heroMasteries || {}) },
      dailyQuests: parsed.dailyQuests && parsed.dailyQuests.length > 0 ? parsed.dailyQuests : DEFAULT_QUESTS,
      matchHistory: parsed.matchHistory || [],
    };
  } catch (err) {
    console.error('[talisman] Error loading player profile:', err);
    return getDefaultProfile();
  }
}

export function savePlayerProfile(profile: PlayerProfile): void {
  if (typeof window === 'undefined') return;
  try {
    profile.lastActive = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error('[talisman] Error saving player profile:', err);
  }
}

export interface MatchOutcomeParams {
  heroId: string;
  territoryId: string;
  won: boolean;
  matchDuration: number;
  playerKills: number;
  playerDeaths: number;
  playerAssists: number;
  heroLevel: number;
  towersDestroyed: number;
  bossesSlain: number;
}

export interface MatchRewardResult {
  goldEarned: number;
  accountXpEarned: number;
  masteryXpEarned: number;
  leveledUpAccount: boolean;
  newAccountLevel: number;
  leveledUpHero: boolean;
  newHeroMasteryLevel: number;
  questsCompleted: DailyQuest[];
  isMvp: boolean;
}

export function recordMatchOutcome(params: MatchOutcomeParams): MatchRewardResult {
  const profile = loadPlayerProfile();

  const baseGold = params.won ? 200 : 80;
  const killGold = params.playerKills * 25;
  const towerGold = params.towersDestroyed * 30;
  const bossGold = params.bossesSlain * 50;
  const totalGold = baseGold + killGold + towerGold + bossGold;

  const baseXp = params.won ? 250 : 100;
  const killXp = params.playerKills * 35;
  const totalAccountXp = baseXp + killXp + params.towersDestroyed * 40 + params.bossesSlain * 60;
  const totalMasteryXp = Math.round(totalAccountXp * 0.85);

  const isMvp = params.won && (params.playerKills >= 3 || params.playerKills + params.playerAssists >= 5);

  // Update Account XP and Level
  let currentLevel = profile.accountLevel;
  let currentXp = profile.accountXp + totalAccountXp;
  let leveledUpAccount = false;

  while (currentLevel < 50) {
    const needed = getAccountXpForLevel(currentLevel);
    if (currentXp >= needed) {
      currentXp -= needed;
      currentLevel += 1;
      leveledUpAccount = true;
    } else {
      break;
    }
  }

  // Update Hero Mastery
  const mastery = profile.heroMasteries[params.heroId] || {
    heroId: params.heroId,
    masteryLevel: 1,
    masteryXp: 0,
    matchesPlayed: 0,
    wins: 0,
    kills: 0,
    mvpCount: 0,
  };

  mastery.matchesPlayed += 1;
  if (params.won) mastery.wins += 1;
  mastery.kills += params.playerKills;
  if (isMvp) mastery.mvpCount += 1;

  let heroLevel = mastery.masteryLevel;
  let heroXp = mastery.masteryXp + totalMasteryXp;
  let leveledUpHero = false;

  while (heroLevel < 10) {
    const needed = getMasteryXpForLevel(heroLevel);
    if (heroXp >= needed) {
      heroXp -= needed;
      heroLevel += 1;
      leveledUpHero = true;
    } else {
      break;
    }
  }

  mastery.masteryLevel = heroLevel;
  mastery.masteryXp = heroXp;
  profile.heroMasteries[params.heroId] = mastery;

  // Update Daily Quests Progress
  const newlyCompletedQuests: DailyQuest[] = [];
  for (const quest of profile.dailyQuests) {
    if (quest.completed) continue;
    let increment = 0;
    if (quest.id === 'quest_first_blood') increment = params.playerKills;
    else if (quest.id === 'quest_slay_boss') increment = params.bossesSlain;
    else if (quest.id === 'quest_destroy_towers') increment = params.towersDestroyed;
    else if (quest.id === 'quest_archipelago_victory' && params.won) increment = 1;

    if (increment > 0) {
      quest.progress = Math.min(quest.target, quest.progress + increment);
      if (quest.progress >= quest.target && !quest.completed) {
        quest.completed = true;
        newlyCompletedQuests.push(quest);
      }
    }
  }

  // Update Lifetime Stats
  profile.accountLevel = currentLevel;
  profile.accountXp = currentXp;
  profile.gold += totalGold;
  profile.totalMatches += 1;
  if (params.won) profile.totalWins += 1;
  profile.totalKills += params.playerKills;
  profile.totalTowers += params.towersDestroyed;
  profile.totalBosses += params.bossesSlain;

  // Record to History (limit 20 matches)
  const historyEntry: MatchHistoryEntry = {
    id: `match_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    heroId: params.heroId,
    territoryId: params.territoryId,
    outcome: params.won ? 'victory' : 'defeat',
    durationSeconds: params.matchDuration,
    kills: params.playerKills,
    deaths: params.playerDeaths,
    assists: params.playerAssists,
    goldEarned: totalGold,
    accountXpEarned: totalAccountXp,
    masteryXpEarned: totalMasteryXp,
    heroLevelReached: params.heroLevel,
    bossesSlain: params.bossesSlain,
    towersDestroyed: params.towersDestroyed,
    isMvp,
  };

  profile.matchHistory.unshift(historyEntry);
  if (profile.matchHistory.length > 20) {
    profile.matchHistory = profile.matchHistory.slice(0, 20);
  }

  savePlayerProfile(profile);

  return {
    goldEarned: totalGold,
    accountXpEarned: totalAccountXp,
    masteryXpEarned: totalMasteryXp,
    leveledUpAccount,
    newAccountLevel: currentLevel,
    leveledUpHero,
    newHeroMasteryLevel: heroLevel,
    questsCompleted: newlyCompletedQuests,
    isMvp,
  };
}

export function claimQuest(questId: string): { success: boolean; gold: number; xp: number; profile: PlayerProfile } {
  const profile = loadPlayerProfile();
  const quest = profile.dailyQuests.find((q) => q.id === questId);
  if (!quest || !quest.completed || quest.claimed) {
    return { success: false, gold: 0, xp: 0, profile };
  }

  quest.claimed = true;
  profile.gold += quest.rewardGold;
  profile.accountXp += quest.rewardXp;

  // Check level up from quest XP
  while (profile.accountLevel < 50) {
    const needed = getAccountXpForLevel(profile.accountLevel);
    if (profile.accountXp >= needed) {
      profile.accountXp -= needed;
      profile.accountLevel += 1;
    } else {
      break;
    }
  }

  savePlayerProfile(profile);
  return { success: true, gold: quest.rewardGold, xp: quest.rewardXp, profile };
}


export function updateSettings(settings: Partial<MobileGameSettings>): MobileGameSettings {
  const profile = loadPlayerProfile();
  profile.settings = { ...profile.settings, ...settings };
  savePlayerProfile(profile);
  return profile.settings;
}
