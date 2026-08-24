// Territory and Cultural Lore Types (Alamat MOBA).
//
// ── THE 5 MYTHOLOGICAL TERRITORIES OF THE PHILIPPINES ───────────────────────
// 1. Kaluwalhatian (The Celestial Sky Citadel & Solar Highlands - Luzon)
// 2. Kasakitan & Abyssal Depths (The Leviathan Ocean & Mayon Volcano - Visayas/Bicol)
// 3. Gubat ng mga Diwata (The Enchanted Rainforest & Sacred Balete Groves - Mindanao)
// 4. Biringan & Kasamaan (The Phantom City & Shadow Underworld - Samar/Capiz)
// 5. Kapatagan ng Agimat (The Pasig River Heartland & Barangay Stronghold)

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
