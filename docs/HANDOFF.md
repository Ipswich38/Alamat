# ALAMAT MOBA — MASTER ARCHITECTURE & UPGRADE HANDOFF GUIDE

> **Project Name:** *Alamat* (Philippine Mythology 3D Action MOBA)  
> **Workspace Directory:** `/Users/zer0fx28/alamat`  
> **GitHub Repository:** [`https://github.com/Ipswich38/Alamat`](https://github.com/Ipswich38/Alamat)  
> **Active Branch:** `main`  
> **Tech Stack:** Next.js 16.3.2 (App Router, Turbopack) · React 19 · Three.js 0.185.1 · TailwindCSS · Web Audio API  
> **Core Gameplay Philosophy:** *"Nothing locks on"* — Every basic attack, spell, dash, cone, and projectile is an aimed directional skillshot.

---

## 1. INSTANT CONTINUATION PROTOCOL (FOR THE NEXT AGENT)

When picking up this task or continuing after a token/context boundary:
1. **Never reset or rewrite existing working modules** — extend them cleanly following the invariants below.
2. **Verify build before and after each phase**:
   ```bash
   cd /Users/zer0fx28/alamat
   npm run build   # Must compile cleanly with 0 TypeScript errors
   npm run lint    # ESLint verification
   ```
3. **Check the Upgrade Checklist** in Section 4 to identify the exact current phase, pick up the next task, and update the status checkboxes when completed.
4. **Zero External Asset Requirement**: All audio is procedurally synthesized via Web Audio API; all VFX, reticles, damage numbers, and UI use Three.js geometry/canvas/HTML overlays.

---

## 2. CANON & SYSTEM ARCHITECTURE SUMMARY

### Realm Geography & 3-Lane Topology
*Alamat* pits **Anito Seekers** against the **Malakas Realm** across the ancient **Pasig Agimat River** beneath the volcanic haze of **Mount Mayon**.

```
                           [ MALAKAS SANCTUARY (+3.0u) ]
                                       ▲
                                      / \
                                     /   \
                             [TOP]  /     \  [BOT]
                                   /       \
                        [WEST JUNGLE]     [EAST JUNGLE]
                       (Tikbalang Camp)   (Aswang Camp)
                                   \       /
                      ~~~~~~~~~~~~~ \     / ~~~~~~~~~~~~~
                      ~  PASIG AGIMAT RIVER (-1.05u)    ~
                      ~   [BAKUNAWA WHIRLPOOL PIT]      ~
                      ~~~~~~~~~~~~~ /     \ ~~~~~~~~~~~~~
                                   /       \
                         [KAPRE FOREST LAIR]
                                   \       /
                                    \     /
                                     \   /
                                      \ /
                                       ▼
                            [ ANITO SANCTUARY (+3.0u) ]
```

### Complete Codebase Map
```
/Users/zer0fx28/alamat/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout, fonts, metadata
│   │   ├── page.tsx                    # Route / (Hero Selection Lobby)
│   │   └── play/page.tsx               # Route /play (3D MOBA Arena)
│   ├── components/game/
│   │   ├── Arena3D.tsx                 # Master 3D Game Loop, Scene, Input & State Hub
│   │   └── HeroHud.tsx                 # Mobile/Desktop HUD: Minimap, Spells, Joystick, Buffs
│   ├── game/
│   │   ├── ai/                         # Bot opponent logic (Phase 13)
│   │   │   └── botHero.ts
│   │   ├── arena/                      # Arena layout, geometry & topology
│   │   │   ├── camps.ts                # Jungle camp coordinates & spawn anchors
│   │   │   ├── jungle.ts               # Brush bounds & jungle obstacle definitions
│   │   │   ├── lanes.ts                # Lane paths (top/mid/bot), waypoints, tower slots
│   │   │   ├── layout.ts               # World bounds, quadrant logic
│   │   │   ├── nexus.ts                # Core base anchors, team spawn positions
│   │   │   ├── river.ts                # Pasig river channel spline, crossings, water level
│   │   │   └── walls.ts                # Physical collision barrier geometry
│   │   ├── audio/                      # Zero-asset procedural Web Audio SFX (Phase 7)
│   │   │   └── synth.ts
│   │   ├── combat/                     # Hit resolution, casting & combat simulation
│   │   │   ├── bosses.ts               # Bakunawa, Kapre & Pushing Kapre AI
│   │   │   ├── brute.ts                # Kapre brute duel combat
│   │   │   ├── casting.ts              # Ability slots, projectile/dash/windup records
│   │   │   ├── creeps.ts               # Jungle creep combat, aggro, leashing
│   │   │   ├── foes.ts                 # Foe entity state management
│   │   │   ├── geometry.ts             # Line, cone, ground circle & segment hit math
│   │   │   ├── index.ts                # Combat subsystem entry point
│   │   │   ├── invariants.ts           # Balance and runtime invariant tests
│   │   │   ├── minions.ts              # Lane minion wave spawning, marching, aggro
│   │   │   ├── objectives.ts           # Tower & nexus structures, warding, destruction
│   │   │   ├── progression.ts          # XP curve, level 1-15 scaling, bounties (Phase 10)
│   │   │   ├── report.ts               # Combat event logging
│   │   │   └── towerfire.ts            # Tower target acquisition & beam projectiles
│   │   ├── heroes/                     # Hero definitions, metrics & catalog
│   │   │   ├── catalogue.ts            # Roster: Tikbalang, Aswang, Diwata, Bernardo, etc.
│   │   │   ├── metrics.ts              # Hero stat calculations & modifiers
│   │   │   └── types.ts                # Ability, Hero, Build, Role type declarations
│   │   ├── items/                      # RPG Itemization & Inventory Engine (Phase 11)
│   │   │   ├── catalogue.ts            # Agimat shop items (weapons, armor, charms)
│   │   │   └── inventory.ts            # 6-slot inventory & stat calculation engine
│   │   └── render3d/                   # Three.js 3D Rendering Subsystems
│   │       ├── actor.ts                # Skinned mesh GLTF loader & animation controller
│   │       ├── arena.ts                # High-level arena composition
│   │       ├── backdrop.ts             # Distant volcanic scenery (Mount Mayon)
│   │       ├── bosses.ts               # Bakunawa & Kapre 3D Monster Hunter models
│   │       ├── camps.ts                # Jungle camp props & Bulul altars
│   │       ├── clutter.ts              # Flora, mushrooms, runes, fireflies
│   │       ├── combat.ts               # Ground indicators, hit bursts, projectile meshes
│   │       ├── controls.ts             # Isometric camera orbit, pan, zoom & tracking
│   │       ├── creeps.ts               # Jungle creep 3D meshes (Aswang, Tikbalang)
│   │       ├── damageNumbers.ts        # Floating 3D/2D Combat Damage Popups (Phase 9)
│   │       ├── grade.ts                # Post-processing color grade & tone mapping
│   │       ├── jungle.ts               # Jungle foliage & brush instances
│   │       ├── minions.ts              # Minion 3D rendering & combat animations
│   │       ├── models.ts               # GLTF mesh cache & preloader
│   │       ├── nexus.ts                # Anito & Malakas Nexus core structures
│   │       ├── reticles.ts             # Smart-Cast Ground Telegraph Reticles (Phase 8)
│   │       ├── river.ts                # Animated water shader & crossing bridges
│   │       ├── santelmo.ts             # Ambient wisp particles
│   │       ├── sky.ts                  # Dynamic 10-min TOD skybox & Eclipse FX
│   │       ├── stage.ts                # Three.js WebGLRenderer, Camera Shake Engine
│   │       ├── terrain.ts              # Elevated terrain mesh (+3.0u base terraces)
│   │       ├── towers.ts               # Totem tower 3D meshes & attack crystals
│   │       └── walls.ts                # Jungle stone barriers & canyon walls
│   └── docs/
│       ├── canon.md                    # Lore bible & world design rules
│       └── HANDOFF.md                  # This file
```

---

## 3. COMPREHENSIVE SYSTEM-BY-SYSTEM UPGRADE BLUEPRINT

### Phase 7: Zero-Asset Procedural Web Audio Engine
- **Target File:** `src/game/audio/synth.ts`
- **Objective:** Pure Web Audio API procedural sound engine with zero external MP3/WAV assets.
- **Audio Catalog:**
  1. `playMeleeHit()`: Metallic blade clashing with white noise burst and resonant decay (Kampilan).
  2. `playPunchHit()`: Low-frequency sub thump with quick pitch drop (Tikbalang stomp / Kapre fist).
  3. `playSpellCast(type)`: High harmonic sine sweeps (Lunar beam, Santelmo cold fire, Viscera lash).
  4. `playTowerShot()`: Dual-tone electric buzz transitioning into acoustic blast.
  5. `playTowerImpact()`: Deep resonant explosion with filtered noise rumble.
  6. `playMinionHit()`: Crisp, short impact click.
  7. `playPing(type)`: High crystal chime (Danger: high octave pulse, OnMyWay: rising arpeggio).
  8. `playLevelUp()`: Radiant major chord fanfare arpeggio (C-E-G-C-E).
  9. `playKillAnnouncement()`: Mythic gong hit with thunderous sub-bass.
  10. `playVictory()`: Majestic triumphal brass synth chord progression.
- **Implementation Strategy:** Single AudioContext initialized on first user click/touch gesture; polyphonic voice pool with envelope shaping (`linearRampToValueAtTime`).

---

### Phase 8: Mouse-Cursor Aiming & Ground Smart-Cast Telegraphs
- **Target Files:** `src/game/render3d/reticles.ts`, `src/components/game/Arena3D.tsx`, `src/components/game/HeroHud.tsx`
- **Objective:** True PC MOBA control scheme where keyboard (WASD) moves the hero while mouse pointer dynamically targets skillshots on the terrain ground plane.
- **Components:**
  1. **Ground Plane Raycaster:** In `Arena3D.tsx`, raycast mouse screen coords against Three.js terrain/plane `y = terrainHeight(x, z)` to obtain exact `(targetX, targetZ)` and `targetHeading = Math.atan2(dx, dz)`.
  2. **Telegraph Meshes (`reticles.ts`):**
     - **Line / Arrow Reticle:** Rectangular ground projector with forward chevron for skillshots (`Bernardo Slab`, `Mayari Beam`, `Santelmo`).
     - **Cone Sector Reticle:** Dynamic arc sector mesh showing exact angle and reach for cone abilities (`Tikbalang Stomp`, `Aswang Blood Arc`, `Bakunawa Wave`).
     - **Ground Target Circle:** Glowing circular rune disk with inner pulsing radius for ground AoE spells (`Tikbalang Maze`, `Diwata Ward`, `Bakunawa Vortex`).
     - **Dash Vector:** Elongated dash indicator showing hero destination path.
  3. **Aim Mode Switcher:** Supports both Mouse-Cursor Aiming (PC mode) and Directional Aiming (Touch/Joystick mode).

---

### Phase 9: Floating Combat Damage Numbers & Status Popups
- **Target File:** `src/game/render3d/damageNumbers.ts` (or screen-projected HTML overlay in `Arena3D.tsx`)
- **Objective:** Visceral combat feedback displaying floating damage, crits, heals, and status banners.
- **Color Palette & Styling:**
  - **Physical / Auto-Attack Damage:** Vibrant Red (`#FF3B30`) / Deep Crimson.
  - **Magical / Ability Damage:** Electric Cyan (`#00E5FF`) / Amethyst Purple (`#A855F7`).
  - **Critical Strike Damage:** Bright Amber Gold (`#FFD700`) with enlarged scale + bouncy easing.
  - **Healing Received:** Brilliant Lime Green (`#39FF14`) with upward floating plus signs (`+120`).
  - **Status Alerts:** Overhead banner badges (`STUNNED`, `SILENCED`, `WARDED`, `LEVEL UP!`).
- **Lifecycle:** 0.8s duration with vertical drift (+Y), scale pop (1.4x → 1.0x), and quadratic opacity fade-out.

---

### Phase 10: Dynamic XP Progression & Level 1–15 Stat Scaling
- **Target Files:** `src/game/combat/progression.ts`, `src/game/heroes/metrics.ts`, `src/components/game/HeroHud.tsx`
- **Objective:** Dynamic MOBA leveling curve from Level 1 to 15 with minion/monster bounties and stat growth.
- **XP Curve Table:**
  - Level 1 → 2: 280 XP
  - Level 2 → 3: 380 XP
  - Level 3 → 4: 500 XP
  - Level 4 → 5: 640 XP
  - ...
  - Level 14 → 15: 2200 XP
- **Bounty Values:**
  - Melee Minion: 45 XP / 22 Gold
  - Ranged Minion: 35 XP / 16 Gold
  - Siege Minion: 75 XP / 45 Gold
  - Jungle Creep (Aswang / Tikbalang camp): 140 XP / 75 Gold
  - Epic Boss (Kapre / Bakunawa): 500 XP / 250 Gold
  - Enemy Hero Takedown: 350 XP / 300 Gold
- **Stat Growth per Level:**
  - Max HP: `+ (BaseHP * 0.08)` per level
  - Attack Damage: `+ (BaseATK * 0.06)` per level
  - Armor / Damage Reduction: `+ 2%` per level
  - Passive Health Regen: `+ 0.5 HP/s` per level

---

### Phase 11: Real RPG Itemization & Stat Scaling Engine
- **Target Files:** `src/game/items/catalogue.ts`, `src/game/items/inventory.ts`, `src/components/game/HeroHud.tsx`
- **Objective:** Full active 6-slot inventory system where purchased Agimat items apply real mathematical attribute bonuses to hero runtime stats.
- **Agimat Shop Catalogue:**
  1. **Kampilan of Searing Flame (1200g):** +45 ATK, +15% Attack Speed, Burns target for 15 dmg/sec.
  2. **Agimat of Bathala (1600g):** +350 HP, +15 Armor, Regenerates 12 HP/sec.
  3. **Amihan Wind Boots (800g):** +1.2 Movement Speed, +15% Ability Cooldown Haste.
  4. **Mayari's Crescent Relic (1400g):** +50 Ability Power, +20% Mana/Energy Regen.
  5. **Talon of the Wakwak (1300g):** +35 ATK, +18% Lifesteal on physical strikes.
  6. **Bulul Heart Ward (1500g):** +400 HP, Grants 200 HP shield when falling below 30% health.
- **Effective Stat Formula:**
  $$\text{Effective ATK} = (\text{Base ATK} + \text{Level Bonus}) \times (1 + \text{Item ATK\%}) + \text{Item Flat ATK}$$
  $$\text{Effective HP} = (\text{Base HP} + \text{Level Bonus}) + \text{Item Flat HP}$$
  $$\text{Effective Speed} = \text{Base Speed} + \text{Item Speed Bonus}$$

---

### Phase 12: Mythic Hero Selection Lobby Route
- **Target File:** `src/app/page.tsx` (with supporting components)
- **Objective:** Dedicated, immersive Hero Selection Screen before entering the arena.
- **Features:**
  - 3D interactive hero model preview with rotating turntable and idle stance animation.
  - Lore dossier card with Baybayin calligraphy glyphs and role badge (Vanguard, Mystic, Stalker, Warden, Ranger).
  - Ability showcase cards with animated video/icon previews and cooldown/damage metrics.
  - Role filter tabs: All, Vanguard, Mystic, Stalker, Warden, Ranger.
  - "Enter the Arena" launch button routing directly to `/play?hero=[heroId]`.

---

### Phase 13: Lane AI Bot Heroes (Aswang / Manananggal Opponents)
- **Target File:** `src/game/ai/botHero.ts`
- **Objective:** Autonomous lane-patrolling bot opponents in Mid and Side lanes.
- **AI State Machine:**
  1. **Laning State:** Marches along lane waypoint spline behind allied minions, targeting enemy minions when in attack range.
  2. **Harass / Trade State:** When player enters ability range, casts skillshot aiming at player's predicted position.
  3. **Retreat / Recall State:** If HP drops below 25%, retreats under nearest allied tower to recover.
  4. **Jungle Objective State:** Joins team to contest Kapre or Bakunawa when pit combat is initiated.

---

## 4. MASTER IMPLEMENTATION CHECKLIST

Use this checklist to track progress across sessions:

- [x] **Phase 7: Procedural Web Audio Engine**
  - [x] Create `src/game/audio/synth.ts` with complete sound synthesis library.
  - [x] Hook audio triggers into `Arena3D.tsx` (basic attacks, abilities, tower shots, hits, pings).
  - [x] Add sound triggers for level-up, kill announcements, and victory screen.
- [x] **Phase 8: Mouse-Cursor Aiming & Ground Smart-Cast Telegraphs**
  - [x] Create `src/game/render3d/reticles.ts` with Arrow, Cone, and Circle ground meshes.
  - [x] Implement mouse pointer ground raycaster in `Arena3D.tsx`.
  - [x] Wire spell preview on keydown / button hover and cast on release.
- [x] **Phase 9: Floating Combat Damage Numbers & Status Popups**
  - [x] Implement floating text manager with 3D-to-2D screen projection in `Arena3D.tsx` / `damageNumbers.ts`.
  - [x] Wire hit events from `casting.ts`, `towerfire.ts`, and `minions.ts` to spawn damage numbers.
- [x] **Phase 10: Dynamic XP Progression & Level 1–15 Stat Scaling**
  - [x] Build `src/game/combat/progression.ts` with XP curve, level calculation, and bounty awards.
  - [x] Wire minion, creep, boss, and tower deaths to award XP and gold to nearby heroes.
  - [x] Update `HeroHud.tsx` with live XP bar, Level badge, and LEVEL UP fanfare.
- [x] **Phase 11: Real RPG Itemization & Stat Scaling Engine**
  - [x] Build `src/game/items/catalogue.ts` and `src/game/items/inventory.ts`.
  - [x] Wire Agimat Shop purchases in `HeroHud.tsx` and `Arena3D.tsx` to apply real stat multipliers.
  - [x] Add Stats Inspector modal showing breakdown of Base + Level + Item stats.
- [x] **Phase 12: Mythic Hero Selection Lobby Route**
  - [x] Rebuild `src/app/page.tsx` into full Hero Selection Lobby with 3D Turntable.
  - [x] Connect selected hero to `/play?hero=[id]`.
- [x] **Phase 13: Lane AI Bot Heroes**
  - [x] Build `src/game/ai/botHero.ts` with state machine and pathing.
  - [x] Spawn enemy AI hero in mid lane against player with full combat routines.
- [x] **Phase 14: 5 Mythological Territories & Cultural Lore (Higgsfield AI 4K Media Integration)**
  - [x] Create `src/game/territories/` (`types.ts`, `catalogue.ts`, `index.ts`) with all 5 Philippine realms, rich cultural lore, story beats chapters 1-3, sacred artifacts, and blessings.
  - [x] Leverage Higgsfield AI free trial via MCP to generate 5 high-resolution 16:9 environment images and 5 cinematic 4K video trailers.
  - [x] Upgrade Hero Selection Lobby (`src/app/page.tsx`) with dual-navigation tabs for Champions and 5 Territories of the Archipelago with live video playback.
  - [x] Enhance In-Game UI (`HeroHud.tsx` & `Arena3D.tsx`) with Top-Center Territory Realm indicator badge and full Territory Codex modal [🗺️].
- [x] **Phase 15: 3D Cultural Props Integration (Bulul, Dong Son Drum, Kim Quy Altar)**
  - [x] Integrate 3D prop assets (`bulul.glb`, `dongSonDrum.glb`, `kimQuyAltar.glb`) into distinct jungle camp quadrants in `src/game/render3d/camps.ts`.
  - [x] Verify production build (`npm run build`) and live gameplay smoke tests (`smoke-run.mjs` & `smoke-tower.mjs`) with 0 errors.

---

## 5. HARD INVARIANTS & LESSONS LEARNED

1. **"Nothing Locks On":** Never implement point-and-click homing spells. Everything must project along a trajectory, cone, line, or ground radius.
2. **Pure Web Audio API:** Do NOT attempt to load external audio files (`.mp3`, `.wav`) that do not exist in the repo. Synthesize every sound procedurally.
3. **Stat Calculation Hierarchy:** Always compute effective stats through the formula `(Base + Growth) * (1 + ItemPct) + ItemFlat` so buffs and items stack cleanly.
4. **Frame Loop Integrity:** Keep state mutations out of high-frequency Three.js render loops; use refs (`heroRef`, `joyRef`, `turnRef`) for 60fps loop access and React state only for HUD synchronization.
5. **Camera & Elevation Coordinates:** The Pasig River channel sits at `y = -1.05u`, lane terraces at `y = +1.0u`, and bases at `y = +3.0u`. All ground raycasting must use `terrainHeight(x, z)`.
