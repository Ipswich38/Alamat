# ALAMAT MOBA — AGENT HANDOFF & ARCHITECTURE GUIDE

> **Project Name:** *Alamat* (Philippine Mythology 3D MOBA)  
> **Local Workspace Directory:** `/Users/zer0fx28/alamat`  
> **GitHub Repository:** [`https://github.com/Ipswich38/Alamat`](https://github.com/Ipswich38/Alamat)  
> **Active Branch:** `main`  
> **Framework:** Next.js 16.3.2 (App Router, Turbopack) + Three.js 0.185.1  

---

## 1. QUICK-START GUIDE FOR NEXT AGENT

When the user says:
> `"continue Alamat MOBA game ..."`

1. **Working Directory:** Always operate in `/Users/zer0fx28/alamat`.
2. **Local Dev Server:** `npm run dev` (Runs on `http://localhost:3000`).
   - Home / Hero Selection: `http://localhost:3000`
   - Playable 3D MOBA Arena: `http://localhost:3000/play`
3. **Verification Commands:**
   - `npm run build` (Ensures 0 TypeScript / compilation errors)
   - `npm run lint` (ESLint verification)

---

## 2. CANON & SYSTEM ARCHITECTURE

*Alamat* is a stylized PBR 3D MOBA set in Philippine mythology where **Anito Seekers** face the **Malakas Realm** across the ancient **Pasig Agimat River** beneath **Mount Mayon**.

```
                           [ MALAKAS SANCTUARY (+3.0u) ]
                                      ▲
                                     / \
                                    /   \
                             [TOP] /     \ [BOT]
                                  /       \
                        [WEST JUNGLE]   [EAST JUNGLE]
                        (Tikbalang Camp) (Aswang Camp)
                                  \       /
                      ~~~~~~~~~~~~ \     / ~~~~~~~~~~~~
                      ~ PASIG AGIMAT RIVER (-1.05u)   ~
                      ~  [BAKUNAWA WHIRLPOOL PIT]     ~
                      ~~~~~~~~~~~~ /     \ ~~~~~~~~~~~~
                                  /       \
                         [KAPRE FOREST LAIR]
                                  \       /
                                   \     /
                                    \   /
                                     \ /
                                      ▼
                            [ ANITO SANCTUARY (+3.0u) ]
```

---

## 3. IMPLEMENTED MILESTONES & CAPABILITIES

### Phase 1–4: Core MOBA Infrastructure
- **Three-Lane Arena (`lanes.ts`, `nexus.ts`)**: Top, Mid, and Bot lanes with Anito and Malakas bases, Nexuses, Tier 1/2/3 towers, and inhibitors.
- **Minion Simulation (`minions.ts`)**: Wave spawners, synchronized lane marching, aggro targeting, melee strikes, ranged projectiles, and collision avoidance.
- **Hero System (`heroes/`)**: Roster of mythic heroes (Tikbalang Warrior, Aswang Nightstalker, Mayari Moon Goddess, Urduja Warlord, Bernardo Carpio) with cooldowns, directional dashes, cone/line skillshots, health bars, and HUD abilities.
- **Camera & Controls (`controls.ts`, `stage.ts`)**: Orthographic isometric camera with rotation (yaw), mouse-wheel zoom (16u–90u), smooth hero-centering, and PBR ACES filmic post-processing with UnrealBloom.

### Phase 5: Epic Bosses & Neutral Jungle Camps
- **Bakunawa Pit (`src/game/combat/bosses.ts`)**: River boss in swirling whirlpool. Tidal Wave (cone) and Abyssal Tail Slam (circle). Defeating it grants **Lunar Eclipse buff** (+45% ability haste, +35% damage).
- **Kapre Forest Lair (`src/game/combat/bosses.ts`)**: Ancient tree titan with Ground Stomp and Tobacco Smoke debuff. Defeating it spawns the allied **Pushing Kapre Siege Unit** marching down the nearest lane to demolish enemy towers.
- **Jungle Camps (`src/game/combat/creeps.ts`)**:
  - NW/SE Camps: **Tikbalang Leader** (Emerald Aura, Spear Thrust) & **Diwata Wisps** (River Swiftness +35% Move Speed buff).
  - NE/SW Camps: **Aswang Stalker** (Blood Thirst +20% Lifesteal buff, Claw Slash).
  - River Crossings: **Bulul Guardians** (Healing aura regenerate +36 HP/sec).

### Phase 6: Monster Hunter Creature Upgrades & Lighting/Elevation Engine
- **Monster Hunter Bakunawa (`src/game/render3d/bosses.ts`)**:
  - Scaled up by **1.8x**.
  - Iridescent bioluminescent scales (`#0C3B4A` metallic PBR) and dual-row glowing spiny dorsal fins (`#00E5FF`).
  - Articulated upper skull and lower fanged jaw with an internal pulsating glowing throat core (`#00FFFF`) that expands and flares when charging breath attacks.
  - Sinuous multi-sine tail-thrashing idle animations with dynamic expanding water ripple rings.
  - Cascading water droplet particles falling from scales.
- **Monster Hunter Kapre (`src/game/render3d/bosses.ts`)**:
  - Muscular hunched ape/titan stance with rugged bark skin and draped moss/vine garlands.
  - Glowing ember eyes (`#FF3B00`), carved pipe with billowing smoke cloud puff particles, and lashed bone armor plates on knuckles, shoulders (pauldrons), and knees.
- **Monster Hunter Jungle Creeps (`src/game/render3d/creeps.ts`)**:
  - **Aswang**: Severed Manananggal torso with exposed skeletal ribcage, glowing crimson viscera (`#FF1035`), elongated arm claws, and torn leathery bat wings with bone struts.
  - **Tikbalang**: Horse-humanoid hybrid with braided horse-hair mane, lashed skull shoulder-pads, jade spear, and dynamic expanding hoof-stomp shockwave particle rings.
- **Terrain Verticality (`src/game/render3d/terrain.ts`)**:
  - Base platforms elevated by **+3.0u** tapering into lane terraces (+1.0u) and sunken riverbed (-1.05u).
  - Stepped mossy terraces, basalt cliff edges, glistening wet mud masks on riverbanks, giant exposed Balete chokepoint roots, and animated waterfall cascades with splash rings.
- **Dynamic 10-Minute Day/Night/Eclipse Cycle (`src/game/render3d/sky.ts`, `stage.ts`)**:
  - **Dawn (0:00–2:00)**: Warm rose horizon (`#F39C80`), river mist fog.
  - **Midday (2:00–5:00)**: High tropical sunlight (`#FFF4E0`), crisp shadows.
  - **Dusk (5:00–7:00)**: Deep amber-crimson sunset lighting Mount Mayon.
  - **Night (7:00–10:00)**: Cool moonlight (`#1A2B4C`), intense cyan/gold bioluminescence (`#00E5FF` / `#FFB300`), and fireflies/motes +200% density.
  - **Bakunawa Solar Eclipse Mode**: Dims sky to black-crimson void with a Blood-Moon Eclipse Ring and drifting ash/ember particle storm when Bakunawa enters combat.
- **Camera-Shake System (`src/game/render3d/stage.ts`)**:
  - Trauma-squared decay engine triggered on Kapre stomps, Bakunawa river emergence, creep slams, and tower/nexus destructions.

---

## 4. DIRECTORY & KEY CODE POINTERS

```
/Users/zer0fx28/alamat/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Lobby / Hero Selector
│   │   └── play/page.tsx               # 3D MOBA Game Route
│   ├── components/game/
│   │   ├── Arena3D.tsx                 # Master 3D Game Loop & Input Handler
│   │   └── HeroHud.tsx                 # Abilities, Health, Buffs, and Boss Bars
│   └── game/
│       ├── arena/
│       │   ├── lanes.ts                # Lane paths, midpoints, tower slots
│       │   ├── nexus.ts                # Base coords, teams, dimensions
│       │   ├── river.ts                # River channel curve, depth, crossings
│       │   └── camps.ts                # Jungle camp coordinates & spawn anchors
│       ├── combat/
│       │   ├── bosses.ts               # Bakunawa, Kapre & Pushing Kapre AI
│       │   ├── creeps.ts               # Jungle creep combat, aggro, leashing
│       │   ├── minions.ts              # Lane minion waves and combat
│       │   └── casting.ts              # Hero ability targeting & cooldowns
│       └── render3d/
│           ├── stage.ts                # Renderer, camera-shake, ACES tone mapping
│           ├── sky.ts                  # 10-Min TOD skybox, Eclipse ring, Ash storm
│           ├── terrain.ts              # +3.0u elevation, terraces, cliffs, waterfalls
│           ├── bosses.ts               # Monster Hunter Bakunawa & Kapre 3D meshes
│           ├── creeps.ts               # Monster Hunter Aswang & Tikbalang 3D meshes
│           ├── clutter.ts              # Flora, mushrooms, runes, fireflies (+200%)
│           └── towers.ts               # Anito & Malakas carved totems
└── docs/
    ├── canon.md                        # World lore, design rules, art direction
    └── HANDOFF.md                      # This file
```

---

## 5. DEVELOPER COMMANDS CHEAT-SHEET

```bash
# 1. Navigate to project
cd /Users/zer0fx28/alamat

# 2. Run dev server (default port 3000)
npm run dev

# 3. Verify TypeScript & production build
npm run build

# 4. Run linter
npm run lint

# 5. Git operations
git status
git push origin main
```
