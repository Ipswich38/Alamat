// Territory and Cultural Lore Types (Talisman).
//
// ── THE MYTHIC TERRITORIES ───────────────────────
// 1. Skyhold (The Celestial Sky Citadel & Solar Highlands - Luzon)
// 2. Kasakitan & Abyssal Depths (The Leviathan Ocean & the Fire Peak Volcano - the Middle Isles/Bicol)
// 3. Gubat ng mga Willow (The Enchanted Rainforest & Sacred Banyan Groves - Mindanao)
// 4. The Unseen City (The Phantom City & Shadow Underworld - the eastern wilds/Capiz)
// 5. The Warding Plain (The the Sacred River Heartland & Barangay Stronghold)

export interface TerritoryStoryBeat {
  chapter: number;
  title: string;
  narrative: string;
}

export interface TerritoryCulture {
  traditions: string;
  sacredArtifacts: string[];
  spiritualBeliefs: string;
  regionalInfluence: string;
  baybayinName: string;
}

export interface TerritoryAtmosphere {
  skyTheme:
    | 'solar_golden'
    | 'eclipse_abyssal'
    | 'emerald_mist'
    | 'crimson_blood_moon'
    | 'delta_dawn'
    | 'jade_karst_mist'
    | 'dragon_storm';
  primaryColor: string;
  secondaryColor: string;
  accentGlow: string;
  weatherEffect: string;
}

export interface TerritoryMedia {
  videoUrl: string;
  imageUrl: string;
  thumbnailUrl?: string;
  aspectRatio: string;
  cinematicDuration: number;
}

export interface Territory {
  id: string;
  name: string;
  title: string;
  baybayin: string;
  region: string;
  lore: string;
  quote: string;
  storyBeats: TerritoryStoryBeat[];
  culture: TerritoryCulture;
  atmosphere: TerritoryAtmosphere;
  media: TerritoryMedia;
  associatedHeroIds: string[];
  blessingName: string;
  blessingEffect: string;
}
