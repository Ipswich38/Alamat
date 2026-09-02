# ALAMAT — MASTER GAME EXPANSION PIPELINE & MULTI-AGENT ROADMAP

> **Game Title:** *Alamat* (Philippine Mythology 3D Action MOBA)  
> **Repository:** `/Users/zer0fx28/alamat`  
> **Production URL:** [https://alamat-ten.vercel.app](https://alamat-ten.vercel.app)  
> **Stack:** Next.js 16.3.2 (App Router, Turbopack) · React 19 · Three.js 0.185.1 · Tailwind CSS · Web Audio API  

---

## ⚡ CONTINUATION PROTOCOL FOR SUBSEQUENT AGENTS
When picking up execution after token limits or across sessions:
1. **Status Verification**: Check the Phase Checklist below to see the current active milestone.
2. **Compile Integrity**: Always run `npm run build` after completing each module to ensure 0 TypeScript or build errors.
3. **No External Asset Dependencies**: Keep audio procedurally generated via Web Audio API (`synth.ts`) and visuals built with Three.js procedural shaders, geometries, and canvas textures.
4. **Git Sync**: Commit with semantic commit messages (`feat(...)`, `fix(...)`) and push to `origin main` to trigger automatic Vercel deployment.

---

## 🗺️ MASTER EXPANSION PHASES OVERVIEW

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              ALAMAT MOBA PIPELINE                            │
├──────────────────────────────────────────────────────────────────────────────┤
│  [PHASE 1] MAP EXPANSION (Jungle 2.0, Alcoves, River Scuttler, Boss Pits)   │
│  [PHASE 2] COMBAT PROJECTION (Aim Reticles, Decals, Summoner Spells)        │
│  [PHASE 3] VISION & FOG OF WAR (Bulul Wards, LoS Brush System)               │
│  [PHASE 4] GAME MODES (1v1 Mid Arena & PvE Mythic Monster Raid)             │
│  [PHASE 5] ANNOUNCER & AUDIO (Epic Voicelines, Killstreak Audio)             │
│  [PHASE 6] POST-MATCH HUD & ANALYTICS (MVP Awards, Damage Charts)            │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 DETAILED PHASE BREAKDOWN & IMPLEMENTATION TASKS

### 📍 PHASE 1: Map Expansion 2.0 (Jungle, Alcoves & River Ecology)
- [x] **1.1 Side Lane Alcoves**:
  - Add geometry and pathing in `src/game/arena/lanes.ts` and `walls.ts` for Top (*Bukid*) and Bottom (*Baybayin*) outer alcoves for flank maneuvers and brush jukes.
- [x] **1.2 River Scuttler (Gintong Alimango / Gold Crab)**:
  - Create roaming river monster in `src/game/combat/creeps.ts` with patrol spline along the S-curve river.
  - Slaying grants team gold + speed shrine circle in the river basin for 60s.
- [x] **1.3 Expanded Boss Lairs**:
  - Distinct terrain hollows for *Maw of Bakunawa* (River Basin NW) and *Kapre Elder* (SE Jungle).
  - Add animated circular warning telegraphs for boss slam and whirlwind attacks.
- [x] **1.4 High-Ground Stepped Ramps & Bridges**:
  - Visual bank elevation transitions and bamboo bridge decals in `src/game/render3d/arena.ts`.

---

### 📍 PHASE 2: Aiming Trajectory Decals & Expanded Battle Spells
- [x] **2.1 Visual Aiming Decals / Projected Ground Reticles**:
  - Directional Arrow Reticle for linear skillshots (e.g. Apolaki Solar Spear, Tala Starburst).
  - Cone Arc Reticle for sweeping abilities (e.g. Bernardo Shockwave, Mayari Crescent).
  - Ground Radius Circle Reticle for targeted AoE spells (e.g. Mangkukulam Curse Pit, Bakunawa Tsunami).
  - Render dynamically in `Arena3D.tsx` during touch drag or keyboard aiming.
- [x] **2.2 Expanded Battle Spells (*Summoner Spells*)**:
  - **Flicker (⚡)**: Instant short-range blink flash.
  - **Retribution / Agimat Smite (🗡️)**: True damage execute against jungle creeps/bosses (+75g bonus).
  - **Purify / Bathala's Grace (✨)**: Instantly cleanse crowd control + 150 HP heal + 1.5s tenacity.
  - **Sprint / Amihan Gale (💨)**: +50% decaying movement speed boost for 4s.
  - **Heal / Ginhawa Potion (🍃)**: Instant restore 300 HP and +15 HP/s for 5s to self and nearby allies.
- [x] **2.3 Smart Target Locking (Portrait Lock & Priority Wheel)**:
  - Add priority toggle: Lowest HP% / Nearest Hero / Towers / Minions.

---

### 📍 PHASE 3: Line-of-Sight Fog of War & Deployable Wards
- [x] **3.1 Dynamic Fog of War & Brush Concealment**:
  - Vision raycasting through terrain obstacles in `src/game/combat/geometry.ts`.
  - True invisibility when standing inside brush unless enemy enters or attacks.
- [x] **3.2 Bulul Vision Wards (Anito Totems)**:
  - Buyable item in Agimat Item Shop (🪙 75 gold).
  - Placeable totem (`src/game/render3d/wards.ts`) revealing a 16-unit radius area in the fog of war for 90s.
  - Visible on minimap with pulse animation and 3D guardian model.

---

### 📍 PHASE 4: Multi-Mode Suite (1v1 Mid-Only & Monster Raid)
- [x] **4.1 1v1 Ancestral Duel Arena (Mid-Only)**:
  - Compact single-lane map layout with accelerated gold/XP gain.
  - Win condition: First to 3 kills or first to destroy the Mid Nexus.
- [x] **4.2 PvE Folklore Monster Raid (Survival)**:
  - Solo or co-op wave survival against escalating mythical beasts (`src/game/combat/raid.ts` and `src/game/render3d/raidMonsters.ts`):
    - Wave 1: Tikbalang Pack (fast skirmishers)
    - Wave 2: Aswang Hunters (lifesteal flankers)
    - Wave 3: Manananggal Swarm (aerial spellcasters)
    - Wave 4: Giant Ancient Kapre Titan Boss Fight.
    - Wave 5: Awakened Bakunawa Primordial Dragon.
- [x] **4.3 Mode Selection Switcher**:
  - Clean selector in `src/app/page.tsx` (5v5 Classic / 1v1 Duel / Monster Raid).

---

### 📍 PHASE 5: Epic Sound & Announcer Engine
- [x] **5.1 Procedural Filipino/English MOBA Announcer**:
  - Audio synthesis and banner broadcasts for:
    - *“Unang Dugo / First Blood!”*
    - *“Dobleng Pagpaslang / Double Kill!”*
    - *“Tatlong Paglipol / Triple Kill!”*
    - *“Maalamat / Legendary!”*
    - *“Nalipol ang Lahat / Ace!”*
- [x] **5.2 Dynamic Champion Audio Quips**:
  - Procedural sound triggers for champion spawn, ultimate cast, low health retreat, and tower kill.

---

### 📍 PHASE 6: Post-Match Analytics & Accolade Screen
- [x] **6.1 Match End Victory/Defeat Ceremony**:
  - Camera slow-motion pan onto the exploding enemy Nexus.
  - Cinematic Victory / Defeat banner with victory horns.
- [x] **6.2 Detailed Performance Breakdown**:
  - MVP designation (KDA + Objective Score formula).
  - Damage Dealt, Damage Taken, Gold Earned, and Tower Damage comparison graphs.
  - Account XP and Rank Progress bar animation.

---

## 🎯 STEP-BY-STEP EXECUTION LOG
* **2026-09-02**: Master Roadmap created. Phase 1 Map Expansion 2.0, Phase 2 Aim Reticles & Battle Spells, Phase 3 Fog of War & Bulul Wards, Phase 4 Multi-Mode Suite (1v1 Duel & PvE Raid), Phase 5 Procedural MOBA Announcer, and Phase 6 Post-Match Accolade Screen completed and verified with 0 compilation errors.
