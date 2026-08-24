// The Master Territory & Cultural Lore Catalogue (Alamat MOBA).
//
// ── PRE-COLONIAL PHILIPPINE MYTHOLOGICAL REALMS ──────────────────────────────
// Each of the 5 territories represents a distinct cultural geographic region
// of the Philippine archipelago, complete with its own oral traditions,
// deities, sacred artifacts, atmospheric identity, and cinematic lore.

import type { Territory } from './types';

export const TERRITORIES: Territory[] = [
  {
    id: 'kaluwalhatian',
    name: 'Kaluwalhatian',
    title: 'Ang Kaharian sa Kalangitan at Kataasan',
    baybayin: 'ᜃᜎᜓᜏᜎ᜔ᜑᜆᜒᜀᜈ᜔',
    region: 'Luzon Highlands & Celestial Sky Realm (Montalban Peaks)',
    lore:
      'The sacred celestial citadel floating beyond the highest peaks of the Sierra Madre. Governed by the supreme deity Bathala and guarded by Apolaki with his blazing Kalasag brass shield, Kaluwalhatian is where the sun never sets and where Bernardo Carpio holds the colliding mountain gates apart.',
    quote:
      'Sa kaitaasan kung saan ang liwanag ng araw ay hindi lumulubog, doon nagtitipon ang mga banal na anito.',
    storyBeats: [
      {
        chapter: 1,
        title: 'The Great War for the Cosmic Crown',
        narrative:
          'When Bathala fell into eternal slumber, Apolaki and Mayari clashed in a celestial duel for supremacy over the sky. Apolaki struck out Mayari’s eye with his flaming spear, but overcome with remorse, agreed to rule the world by day while Mayari illuminated the tranquil night.',
      },
      {
        chapter: 2,
        title: 'The Colossus of the Mountain Pass',
        narrative:
          'Deep within the Montalban gorge beneath the floating sky terraces, the demigod Bernardo Carpio wedges his shoulders between two enchanted cliffs. Each tremor felt across Luzon is his breath as he keeps the realm from collapsing into the abyss.',
      },
      {
        chapter: 3,
        title: 'Descent of the Solar Host',
        narrative:
          'When darkness crept across the Pasig riverlands, the gates of Kaluwalhatian swung open. Apolaki hurled down his sunburst spear, blessing the Anito champions with celestial fortitude to reclaim the Agimat Heart.',
      },
    ],
    culture: {
      traditions:
        'Solar invocations at dawn (*Pagsikat ng Araw*), brass shield forging ceremonies, mountain pilgrimages to Montalban caves, and choral chants to the celestial pantheon.',
      sacredArtifacts: [
        'Gintong Kalasag ni Apolaki (Golden Brass Shield)',
        'Sibat ng Kidlat (Spear of Celestial Thunderbolt)',
        'Agimat ng Montalban (Seismic Mountain Talisman)',
      ],
      spiritualBeliefs:
        'Belief in Bathala as the prime architect of the cosmos, with Apolaki as patron of noble warriors and Mayari as protector of night travelers and healers.',
      regionalInfluence: 'Ancient Tagalog, Kapampangan, and Cordilleran Mountain Mythos',
      baybayinName: 'ᜃᜎᜓᜏᜎ᜔ᜑᜆᜒᜀᜈ᜔',
    },
    atmosphere: {
      skyTheme: 'solar_golden',
      primaryColor: '#FFD700',
      secondaryColor: '#0284C7',
      accentGlow: 'rgba(255, 215, 0, 0.45)',
      weatherEffect: 'Golden Solar Flares & Floating Cloud Mist',
    },
    media: {
      imageUrl:
        'https://d8j0ntlcm91z4.cloudfront.net/user_3ILVCAYaU4uvRdp5SZEupsFE3pz/hf_20260824_051649_ee742c76-6ed3-4d85-a0cc-9a191cc0652e.png',
      videoUrl:
        'https://d8j0ntlcm91z4.cloudfront.net/user_3ILVCAYaU4uvRdp5SZEupsFE3pz/hf_20260824_051728_900db133-ed59-4dee-80fe-868029b7846b.mp4',
      aspectRatio: '16:9',
      cinematicDuration: 5,
    },
    associatedHeroIds: ['apolaki', 'mayari', 'bernardo'],
    blessingName: 'Biyaya ng Haring Araw',
    blessingEffect: '+10% Movement Speed in daylight lanes & +15% Skillshot Projectile Speed',
  },
  {
    id: 'van_long_uyen',
    name: 'Vạn Long Uyên',
    title: 'Ang Kaharian ng Sampung Libong Dragon at Banal na Pagong',
    baybayin: '萬龍淵',
    region: 'Red River Delta & Ha Long Karst Archipelago (Ancient Đại Lạc Kingdom - Vietnam)',
    lore:
      'The legendary emerald realm where ten thousand celestial dragons descended from the skies, scattering jade gems across the mist-shrouded gulf to form soaring limestone spires and sacred water labyrinths. Guarded by the Golden Turtle God Kim Quy and resonating with the cosmic thunder of Dong Son bronze sunburst drums, Vạn Long Uyên is the ancestral sanctum of dragon-blooded champions and sacred water spirits.',
    quote:
      'Mula sa libu-libong isla ng esmeralda at banal na lawa, sumisibol ang lakas ng mga anak ng dragon.',
    storyBeats: [
      {
        chapter: 1,
        title: 'The Descent of the Ten Thousand Jade Dragons',
        narrative:
          'When ancient primordial invaders threatened the fertile delta, the celestial Dragon King Lạc Long Quân and his dragon host descended in a blaze of jade thunder. Their celestial breath crystallized across the waters, creating an impassable labyrinth of thousands of limestone karst peaks that shield the realm to this day.',
      },
      {
        chapter: 2,
        title: 'The Covenant of the Golden Turtle (Kim Quy)',
        narrative:
          'From the glowing depths of the sacred Lake of the Returned Sword, the ancient Golden Turtle deity Kim Quy emerged with the divine broadsword Thuận Thiên (*Heaven’s Will*), forged from celestial bronze to empower righteous champions to cleave through the darkest corruption.',
      },
      {
        chapter: 3,
        title: 'Resonating Thunder of the Dong Son Drums',
        narrative:
          'Along the emerald riverbanks, high shamans beat the colossal Dong Son bronze drums etched with radiant sunbursts and flying Chim Lạc cranes. The sonic resonance awakens the dormant dragon ley-lines, blessing champions with swift river currents and impenetrable jade aegis shields.',
      },
    ],
    culture: {
      traditions:
        'Water puppetry (*Múa rối nước*) performed on sacred lotus ponds, solstice Dong Son bronze drumming rituals, floating lotus lantern ceremonies (*Lễ hội hoa đăng*), and ceremonial dragon-headed boat races.',
      sacredArtifacts: [
        'Bảo Kiếm Thuận Thiên (Heaven-Will Dragon Broadsword)',
        'Trống Đồng Đông Sơn (Ancient Bronze Sunburst Drum)',
        'Mai Rùa Thần Kim Quy (Aegis Shell of the Golden Turtle God)',
      ],
      spiritualBeliefs:
        'Veneration of the Dragon Father and Fairy Mother (*Con Rồng Cháu Tiên*), deep devotion to the Four Immortals (*Tứ Bất Tử*), and eternal reverence for water dragon lords (*Long Vương*) and mountain spirits (*Sơn Tinh*).',
      regionalInfluence:
        'Ancient Northern Vietnamese Lac Viet, Dong Son Bronze Culture, Red River Delta & Ha Long Karst Mythology',
      baybayinName: '萬龍淵',
    },
    atmosphere: {
      skyTheme: 'jade_karst_mist',
      primaryColor: '#10B981',
      secondaryColor: '#F59E0B',
      accentGlow: 'rgba(16, 185, 129, 0.55)',
      weatherEffect: 'Jade Karst Mist, Floating Lotus Lanterns & Dragon Thunder',
    },
    media: {
      imageUrl:
        'https://d8j0ntlcm91z4.cloudfront.net/user_3ILVCAYaU4uvRdp5SZEupsFE3pz/hf_20260824_051812_5e087abb-bfbf-41b3-a64c-bcb4796432c9.png',
      videoUrl:
        'https://d8j0ntlcm91z4.cloudfront.net/user_3ILVCAYaU4uvRdp5SZEupsFE3pz/hf_20260824_051926_290f3f05-b757-4d40-bbf1-120466e8de7d.mp4',
      aspectRatio: '16:9',
      cinematicDuration: 5,
    },
    associatedHeroIds: ['apolaki', 'bernardo', 'diwata', 'bakunawa', 'tikbalang'],
    blessingName: 'Lạc Long Hộ Thể',
    blessingEffect:
      '+15% Movement speed in river & water crossings; grants a 200 HP Jade Dragon Shield when entering combat',
  },
  {
    id: 'kasakitan',
    name: 'Kasakitan & Kalaliman',
    title: 'Ang Abyssal na Karagatan at Bunganga ng Mayon',
    baybayin: 'ᜃᜐᜃᜒᜆᜈ᜔',
    region: 'Visayan & Sibuyan Seas / Bicol Volcanic Caldera',
    lore:
      'The stormy primordial ocean abyss of the Visayas where the colossal leviathan serpent Bakunawa sleeps in deep hydrothermal trenches. Above the waves, the volcanic fury of Mount Mayon pulses blood-red against celestial eclipses, revered by Pintados seafarers and volcanic spirit-callers.',
    quote:
      'Kapag ang buwan ay nilamon ng dragon, ang buong karagatan ay magiging dugo.',
    storyBeats: [
      {
        chapter: 1,
        title: 'The Hunger of Seven Moons',
        narrative:
          'In the dawn of time, seven luminous sister moons graced the Philippine night sky. Mesmerized by their celestial beauty, the giant sea dragon Bakunawa leaped from the Sibuyan depths and swallowed six of them whole, plunging the archipelago into terror.',
      },
      {
        chapter: 2,
        title: 'The Gong of the Pintados',
        narrative:
          'To save the last remaining moon (Mayari), ancient Visayan coastal villages beat bronze gongs, sounded hornshells, and brandished tattooed spears into the stormy surf, shocking the dragon into spitting back the seventh moon.',
      },
      {
        chapter: 3,
        title: 'Volcanic Awakening of Gugurang',
        narrative:
          'Deep beneath the ocean floor, the serpent’s thrashes awaken Mount Mayon. Molten basalt surges into the sea trenches, forging black volcanic glass obsidian blades charged with primordial seismic power.',
      },
    ],
    culture: {
      traditions:
        'Pintados warrior tattooing rituals before sea voyages, moon-drumming festivals (*Kalinaw sa Bulan*), pearl offerings cast into whirlpools, and volcanic ash blessings.',
      sacredArtifacts: [
        'Kaliskis ni Bakunawa (Primordial Dragon Scale Armor)',
        'Gong ng Pitong Buwan (Sacred Bronze Eclipse Gong)',
        'Obsidian Kampilan ng Mayon (Volcanic Basalt Cleaver)',
      ],
      spiritualBeliefs:
        'Veneration of Magwayen (goddess of the ocean and ferry of souls) and Gugurang (fire deity of Mayon), accompanied by constant vigilance against Bakunawa’s cosmic hunger.',
      regionalInfluence: 'Visayan Seafaring Lore, Bicolano Volcanic Legends, Pintados Heritage',
      baybayinName: 'ᜃᜐᜃᜒᜆᜈ᜔',
    },
    atmosphere: {
      skyTheme: 'eclipse_abyssal',
      primaryColor: '#7C3AED',
      secondaryColor: '#EF4444',
      accentGlow: 'rgba(124, 58, 237, 0.5)',
      weatherEffect: 'Blood Moon Eclipse & Volcanic Ash Embers',
    },
    media: {
      imageUrl:
        'https://d8j0ntlcm91z4.cloudfront.net/user_3ILVCAYaU4uvRdp5SZEupsFE3pz/hf_20260824_051810_4aaec5be-dcee-413b-8302-16649cecc59f.png',
      videoUrl:
        'https://d8j0ntlcm91z4.cloudfront.net/user_3ILVCAYaU4uvRdp5SZEupsFE3pz/hf_20260824_051814_28c66c43-83f9-42d8-a1be-011d11c740f7.mp4',
      aspectRatio: '16:9',
      cinematicDuration: 5,
    },
    associatedHeroIds: ['bakunawa', 'mayari'],
    blessingName: 'Haplit ng Karagatan',
    blessingEffect: 'Water crossings apply zero movement penalty; +12% Lifesteal during Eclipses',
  },
  {
    id: 'diwata',
    name: 'Gubat ng mga Diwata',
    title: 'Ang Sagradong Kagubatan at Matatandang Balete',
    baybayin: 'ᜇᜒᜏᜆ',
    region: 'Mindanao Rainforests, Mount Apo & Bukidnon Canopies',
    lore:
      'The primordial, mist-veiled rainforest untouched by steel axes. Towering thousand-year-old Balete trees with winding aerial roots form living cathedrals lit by glowing blue Santelmo wisps. Here, Diwata guardians, the towering Kapre giant, and the elusive Tikbalang protect the ancient roots of the world.',
    quote:
      'Magbigay-galang sa bawat dahon at ugat, sapagkat ang gubat ay may sariling alaala.',
    storyBeats: [
      {
        chapter: 1,
        title: 'The Sanctuary of Maria Makiling',
        narrative:
          'Hidden within the lush canopies of Mount Makiling and Mount Apo lies the throne of the Diwata. Streams of pure dew run through glowing moss beds, healing all wounded creatures that seek asylum under the sacred Balete branches.',
      },
      {
        chapter: 2,
        title: 'The Trickster of the Crossroads',
        narrative:
          'At the forest borders, the tall horse-headed Tikbalang misleads greedy hunters in endless winding circles. Only those who wear their garments inside out and whisper the ancient prayer *"Tabi-tabi po"* are granted safe passage.',
      },
      {
        chapter: 3,
        title: 'The Guardian of the Canopy',
        narrative:
          'High above in the giant acacia branches sits the Kapre, smoking his enchanted cigar. His glowing embers light the way for weary seekers while crushing corrupt invaders who dare fell the sacred groves.',
      },
    ],
    culture: {
      traditions:
        'Uttering *"Tabi-tabi po"* before crossing mounds or stepping on roots, hanging woven brass bells (*Kulintang*) from trees, and placing rice offerings before carved wooden Bulul altars.',
      sacredArtifacts: [
        'Batingaw ng Amihan (Enchanted Diwata Brass Bell)',
        'Sinulid ng Santelmo (Blue Cold-Fire Agimat Stone)',
        'Ugat ng Balete (Sacred Root Binding Charm)',
      ],
      spiritualBeliefs:
        'Deep animism rooted in reverence for nature spirits (*Anito* and *Diwata*). Every tree, river, and stone holds a living spirit requiring respect and reciprocity.',
      regionalInfluence: 'Lumad (Talaandig/Manobo) Traditions, Southern Luzon Forest Folklore',
      baybayinName: 'ᜇᜒᜏᜆ',
    },
    atmosphere: {
      skyTheme: 'emerald_mist',
      primaryColor: '#10B981',
      secondaryColor: '#0D9488',
      accentGlow: 'rgba(16, 185, 129, 0.45)',
      weatherEffect: 'Ethereal Forest Mist & Santelmo Blue Wisps',
    },
    media: {
      imageUrl:
        'https://d8j0ntlcm91z4.cloudfront.net/user_3ILVCAYaU4uvRdp5SZEupsFE3pz/hf_20260824_052502_99c7c4d2-eae1-4bfb-a833-d8117b150e8f.png',
      videoUrl:
        'https://d8j0ntlcm91z4.cloudfront.net/user_3ILVCAYaU4uvRdp5SZEupsFE3pz/hf_20260824_051815_92f85020-fd5e-4664-8143-5b5db2392311.mp4',
      aspectRatio: '16:9',
      cinematicDuration: 5,
    },
    associatedHeroIds: ['diwata', 'tikbalang'],
    blessingName: 'Yakap ng Kalikasan',
    blessingEffect: '+18 HP/sec passive health regeneration in jungle brush & +20% Shield strength',
  },
  {
    id: 'biringan',
    name: 'Biringan & Kasamaan',
    title: 'Ang Lungsod ng Anino at Maninila sa Dilim',
    baybayin: 'ᜊᜒᜇᜒᜅᜈ᜔',
    region: 'Phantom Mists of Samar, Leyte & Capiz Nocturnal Groves',
    lore:
      'The legendary invisible city of Philippine folklore that materializes only between twilight and midnight. A gothic realm of purple mist and crimson blood moons, Biringan is inhabited by shape-shifting Aswang, the bat-winged Manananggal, and dark Mangkukulam witches weaving fate through pins and dolls.',
    quote:
      'Huwag kang sasabay sa mga taong walang anino, baka hindi ka na muling makabalik.',
    storyBeats: [
      {
        chapter: 1,
        title: 'The City of the Unseen',
        narrative:
          'Travelers in the Samar wilderness often see radiant crystal spires and grand stone arches gleaming through the midnight mist. Those who enter partake in feasts of nocturnal illusions, only to wake trapped within the shadow court of Biringan.',
      },
      {
        chapter: 2,
        title: 'The Severing of the Wings',
        narrative:
          'Under the crimson harvest moon, the Manananggal applies secret herbal oils (*lana*) behind banana groves, severing her winged torso to stalk the night skies while leaving her lower half guarded by thorns and salt wards.',
      },
      {
        chapter: 3,
        title: 'The Hex of the Mangkukulam',
        narrative:
          'In hidden bamboo huts veiled in incense smoke, ancient sorcerers pierce wax effigies with enchanted bone needles. A single whisper across the wind seals the doom of distant warlords.',
      },
    ],
    culture: {
      traditions:
        'Spreading rock salt and garlic (*bawang*) along window sills at dusk, carrying bamboo stingray tails (*buntot pagi*), and brewing secret herbal balms (*lana ng niyog*).',
      sacredArtifacts: [
        'Lana ng Manananggal (Enchanted Severing Oil)',
        'Manika at Karayom ng Kulam (Voodoo Doll & Bone Pin)',
        'Buntot Pagi Warding Whip (Stingray Tail of True Form)',
      ],
      spiritualBeliefs:
        'Fear and appeasement of nocturnal predators (*Aswang*, *Wakwak*, *Tiyanak*) and belief in curses (*Gaway*) that operate across infinite distance.',
      regionalInfluence: 'Samar-Leyte Invisible City Folklore, Western Visayan Aswang Lore',
      baybayinName: 'ᜊᜒᜇᜒᜅᜈ᜔',
    },
    atmosphere: {
      skyTheme: 'crimson_blood_moon',
      primaryColor: '#8B5CF6',
      secondaryColor: '#DC2626',
      accentGlow: 'rgba(220, 38, 38, 0.5)',
      weatherEffect: 'Nocturnal Purple Fog & Blood Moon Aura',
    },
    media: {
      imageUrl:
        'https://d8j0ntlcm91z4.cloudfront.net/user_3ILVCAYaU4uvRdp5SZEupsFE3pz/hf_20260824_051812_e46af02d-b6ba-4273-b7ce-974b0a03db1b.png',
      videoUrl:
        'https://d8j0ntlcm91z4.cloudfront.net/user_3ILVCAYaU4uvRdp5SZEupsFE3pz/hf_20260824_051816_b62c848f-3206-463e-a346-899cc1769aaf.mp4',
      aspectRatio: '16:9',
      cinematicDuration: 5,
    },
    associatedHeroIds: ['manananggal', 'aswang', 'mangkukulam'],
    blessingName: 'Hiwaga ng Hatinggabi',
    blessingEffect: '+25% Critical strike chance when attacking from behind or exiting brush',
  },
  {
    id: 'kapatagan',
    name: 'Kapatagan ng Agimat',
    title: 'Ang Banal na Ilog Pasig at Kuta ng mga Barangay',
    baybayin: 'ᜃᜉᜆᜄᜈ᜔',
    region: 'Pasig River Delta & Ancient Central Barangay Battlefield',
    lore:
      'The contested heartland where the ancient Pasig Agimat River divides the archipelago into three strategic battle lanes. Fortified with wooden palisades, stone totem towers, and Balangay war vessels, this is where the Anito Seekers and Malakas Warlords wage total war for the sleeping Diwata’s Agimat Heart.',
    quote:
      'Dito sa gitna ng agos, susubukin ang tapang ng bawat mandirigma.',
    storyBeats: [
      {
        chapter: 1,
        title: 'The Channel of Agimat Energy',
        narrative:
          'Flowing from Laguna de Bay through the heart of the battlefield, the Pasig Agimat Stream pulses with concentrated ancestral mana. Its three river crossings are the key chokepoints where legendary duels are fought.',
      },
      {
        chapter: 2,
        title: 'The Totem Towers of the Ancestors',
        narrative:
          'Lining the Top, Mid, and Bot lanes are twenty-two carved stone totem towers holding glowing agimat crystals. When enemy minions or champions breach their perimeters, the towers channel ancestral lightning into devastating energy beams.',
      },
      {
        chapter: 3,
        title: 'The Shattering of the Nexus',
        narrative:
          'When the final enemy core shatters, the colossal golden Diwata awakens in a radiant pillar of light, lifting the eclipse from the archipelago and restoring the primordial balance.',
      },
    ],
    culture: {
      traditions:
        'Rajah battle council gatherings (*Pulong ng mga Datu*), war gong invocations before marches, Balangay boat races, and ceremonial Kampilan sword dances (*Kalasag at Kampilan*).',
      sacredArtifacts: [
        'Puso ng Agimat (Heart of the Sleeping Diwata)',
        'Kampilan ng Datu (Master Rajah Broadsword)',
        'Bandila ng Anito (War Banner of the Ancestral Legion)',
      ],
      spiritualBeliefs:
        'Veneration of the ancestral spirits (*Umagod*) and belief that true heroism (*Bagani*) is proven through self-sacrifice and mastery of aimed skillshots.',
      regionalInfluence: 'Pre-Colonial Tagalog, Kapampangan, and Central Visayan Barangays',
      baybayinName: 'ᜃᜉᜆᜄᜈ᜔',
    },
    atmosphere: {
      skyTheme: 'delta_dawn',
      primaryColor: '#D97706',
      secondaryColor: '#2563EB',
      accentGlow: 'rgba(217, 119, 6, 0.45)',
      weatherEffect: 'Golden Hour Sunlight & Flowing River Spray',
    },
    media: {
      imageUrl:
        'https://d8j0ntlcm91z4.cloudfront.net/user_3ILVCAYaU4uvRdp5SZEupsFE3pz/hf_20260824_051812_5e087abb-bfbf-41b3-a64c-bcb4796432c9.png',
      videoUrl:
        'https://d8j0ntlcm91z4.cloudfront.net/user_3ILVCAYaU4uvRdp5SZEupsFE3pz/hf_20260824_051926_290f3f05-b757-4d40-bbf1-120466e8de7d.mp4',
      aspectRatio: '16:9',
      cinematicDuration: 5,
    },
    associatedHeroIds: ['apolaki', 'bernardo', 'diwata', 'tikbalang', 'aswang', 'manananggal', 'mangkukulam', 'bakunawa', 'mayari'],
    blessingName: 'Diwa ng Mandirigma',
    blessingEffect: '+10% Bonus damage against structures and +25 Gold on minion last-hits',
  },
];

export const territoryById = (id: string): Territory | undefined =>
  TERRITORIES.find((t) => t.id.toLowerCase() === id.toLowerCase());

export const DEFAULT_TERRITORY = TERRITORIES[4]; // Kapatagan ng Agimat (the central 3-lane battlefield)
