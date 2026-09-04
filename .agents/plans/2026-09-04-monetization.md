# Alamat MOBA — Monetization Plan (MLBB / LoL / HoK F2P Model)

## Goal
Add a **Mobile Legends / Honor of Kings -grade Free-to-Play monetization layer** to Alamat that funds live-ops without selling mechanical power, leaning on the game's differentiator (Philippine mythology) — **and keep it low-cost for players, matching how Alamat itself was built lean**. Primary repeatable revenue must come from **player expression** (skins, emotes, effects) and **engagement** (Battle Pass, gacha FOMO), not stats. Prices are intentionally **mass-market / sari-sari store friendly** (PH) so a student allowance can sustain a season.

## Success Criteria
- A new player can install, play, and compete at full power without paying (all heroes viable via grind; no stat-selling skins).
- `alamat-ten.vercel.app` and `alamat-moba.netlify.app` show a shoppable economy in `/` lobby and `/play` HUD: dual currencies, skin preview, Battle Pass track, limited draw banner.
- Purchases persist in `localStorage` (no backend yet) via `profile.ts` with tamper-evident mock receipts; no real-money flow in v1.
- **Low-cost promise (per your note):** most desirable cosmetics are reachable without heavy spend. Free track of Lakbay Pass grants an Epic at Tier 30; Elite skins are Ginto-grindable in ~2-3 days. Most expensive single pull is **50 💎 (~₱25 / $0.50)**; a full season premium is **~₱75 / $1.49**.
- **Non-goal:** real payments, App Store billing, or server-authoritative entitlements — v1 is mock economy + UI ready for PayMongo/GCash later.
- Metrics we can demo: DAU retention via Pass missions, ARPDAU proxy via Diamond sinks, skin equip rate, draw pull-through — with **low ARPPU, high conversion** hypothesis.

## Context And Current Facts
- **Roster:** `src/game/heroes/catalogue.ts` (902 lines, 8+ heroes as data records, permanent `id`, palette/abilities as data). No skin system — `portrait` is single asset per hero, next to `palette`. Easy to add `skins: HeroSkin[]` per hero.
- **Items:** `src/game/items/catalogue.ts` (139 lines, 8 Talisman Agimat items, single `cost` in `gold`). In-match gold and post-match gold both use `profile.gold` (`src/game/progression/profile.ts:237: gold: 500`). No premium currency; no hero unlock gate.
- **Progression:** `src/game/progression/profile.ts` (492 lines) owns Account Level 1-50 + Rank tiers + Hero Mastery 1-10 + Daily Quests (4 fixed quests) + Match History (20) + `MobileGameSettings`, persisted at `talisman_player_profile_v2` via `localStorage`. `recordMatchOutcome` already centralizes gold/xp/loot — natural hook for Pass XP and draw tickets.
- **Combat economy:** `src/game/combat/progression.ts` grants per-kill/tower/boss gold/xp (e.g., hero 300g, boss 250g) via `getProgressionState`. Not monetized.
- **UI:** `src/app/page.tsx` lobby has hero roster + territory picker + 3D turntable; `src/components/game/HeroHud.tsx` (~4.7k lines) owns match HUD. Shop today is `Agimat` consumables only (`💰` button). No currency header in HUD top bar (recent fix made it compact).
- **Build:** `next build` via Turbopack, dual deploy targets (`vercel` prod `alamat-ten`, `netlify` `alamat-moba` via `@netlify/plugin-nextjs`). No payment SDK installed.
- **Design constraint:** Source file explicitly says palettes must stay saturated/bright for readability; skins must preserve silhouette readability.

## Constraints And Non-goals
- **Competitive integrity:** skins, emotes, recall/spawn effects, borders must never change `damage`, `range`, `cooldown`, `windup`, `lock`, `speed`, `health`, `armor`. Ship a runtime invariant `assertCosmeticOnly(skin)` in `src/game/heroes/types.ts` tests.
- **File policy:** `./.agents/plans` prompt reminds: one file ≈ 600-800 lines is split signal. New monetization must be modular: `src/game/monetization/` barrel with `currency.ts`, `skins.ts`, `passes.ts`, `gacha.ts`, `entitlements.ts`.
- **Persistence first:** v1 uses `localStorage` only; `profile.ts` is the source of truth. No Supabase/entitlement server yet.
- **Out of scope v1:** real `PayMongo`/`GCash` charge, server receipts, anti-cheat, esports prize-pool crowdfunding backend, brand IP licenses.

## Key Decisions
1. **Dual currency — `Ginto` (soft, grind) + `Diamante` (hard, premium) — low-cost tuning**
   - *Why:* MLBB `Battle Points` vs `Diamonds`, LoL `Blue Essence` vs `RP`, HoK `Gold` vs `Vouchers`. Keep existing `gold` as `Ginto` (rename alias, keep storage key `gold` for compatibility); add `diamonds: number` to `PlayerProfile` with conversion-rate **1 USD ≈ 200 💎** (cheaper than MLBB's 100/1 USD, so ₱25 buys 50 💎).
   - *Low-price twist (your ask):* bundles intentionally leave small leftovers but **totals stay low** — e.g., `50→55 💎`, `100→115 💎`, `200→240 💎`. No $9.99+ bundles in v1; cap at **₱149 (~$2.50) → 300 💎 + 30 bonus (330)**. Keeps the "repeat top-up" psychology without punishing low spenders.
   - *Rejected:* single currency (no whale obfuscation) and crypto token (regulatory + Play policy risk).

2. **Cosmetics tiering — Filipino folklore residuals, but compressed pricing**
   - Tiers: `Elite (Anito) → Epic (Diwata) → Collector (Datu) → Legend (Bathala) → Prime (Apolaki)` mirroring MLBB Elite/Epic/Collector/Legend/Prime. Each tier maps to scope of change: palette < model swap < new VFX/SFX < full rig + custom recall/voice tagline.
   - **Low-price ladder (your ask):** Elite `400-600 🪙` **or** `49-69 💎` (~₱12-18), Epic `99-149 💎` (~₱25-37), Collector `199 💎`, Legend `249 💎`, Prime `399 💎` max. MLBB Legend is often 899-1500 💎 — Alamat is ~3-4× cheaper. Most players can own an Epic after one weekend of quests + one ₱49 top-up.
   - *Rejected:* flat pricing (no aspiration ladder) and loot-box-only skins (player backlash; keep direct purchase for Elite/Epic).

3. **Gacha via prize-pool draws, not flat shop, for collabs/Prime — kept but cheap**
   - *Why:* prompt #2 — limited collabs (e.g., `Alamat x Darna`, anime) still gate Prime behind draws, but at low stakes. Use pity at **45 pulls** (tighter than HoK 60-80) so a free player can reach pity in ~2 weeks via tickets.
   - *Low-price:* 1-pull `30 💎` (~₱7.50), 10-pull `270 💎` (~₱67, 10% off). No 300-500 💎 single pulls. Prime pity cost capped ~₱340 worst case vs MLBB often ₱1500+.
   - *Guardrail:* publish odds, keep Elite/Epic direct-purchase to avoid gambling-only perception (PH regulatory).

4. **Battle Pass = `Lakbay Pass` (seasonal, 30 tiers, 28-30 days) — budget pricing**
   - Free track = Ginto, draw tickets, one Epic at tier 30; Premium track **149 💎 (~₱37 / $0.75)** = instant Elite skin + 300 Ginto + exclusive recall/border + 5 draw tickets. MLBB Starlight is ~550-600 💎; Wild Pass ~990 WC — Alamat is 50-70% cheaper. An extra **Lakbay+ 249 💎 (~₱62)** adds 10 tier skips for late starters, not extra power.
   - Missions are Daily Quests extended (`profile.ts:162` pattern). Retention hook at masa price.
   - *Rejected:* Starlight monthly subscription variant for v1 (adds churn accounting).

5. **Hero roster soft gate — grindable, cheap convenience**
   - Default 3 free rotation + Veer unlocked; remaining heroes unlock via **`2,800 Ginto`** (~4-5 days of quests) **or** **`79 💎` (~₱20 / $0.40)** instant. New hero launch bundle: hero + Elite skin `99 💎` (~₱25, 30% off vs separate). No 199-399 💎 hero paywalls — everyone can roster-complete in 3 weeks free.
   - Maintains F2P promise while adding convenience sink at low friction.

6. **Where UI lives**
   - Lobby header gets `💎 {diamonds} · 🪙 {ginto}` pill (reuses recent top-bar compact style). New `Tindahan` tab alongside Champions/Realms with sub-tabs: `Skins | Lakbay Pass | Draw | Heroes`. HUD shows tiny Ginto/Diamante on shop open only — no mid-match hard sell.

## Recommended Approach
- Treat monetization as **client-simulated economy + cosmetic entitlements** first, Stripe/PayMongo later behind `src/game/monetization/payments.ts` adapter with `mock` vs `paymongo` vs `gcash` providers.
- Skins are **data + asset references**, not code branches: `HeroSkin { id, heroId, tier, name, tagalogName, blurb, cost: { ginto?, diamonds? }, assets: { portrait?, rigged?, walk?, vfxTheme?, recall?, sfx? }, season?, drawId? }`. Equip is `profile.equippedSkins: Record<heroId, skinId>`. Renderer picks skin if equipped else base.
- Economy is **dual-ledger**: `earnGinto(reason, amount)` / `spendGinto` / `earnDiamonds` / `spendDiamonds` with `Transaction` log for debug and future reconciliation. First-recharge bonus **`+100% up to 100 💎 (~₱25)`** flagged `profile.hasFirstRecharge` — small welcome bonus, not 500-600 whale bonus.
- Pass progress is **XP-linked**: each match/profile quest tick calls `addPassXp(amount)` at `src/game/progression/profile.ts:324` hook. No separate XP source.
- Draws are **pity-tracked**: `profile.pity[drawId]` increments per pull, resets on high-tier drop. Odds table versioned `draws_v1`.

## Work Plan
**Order is dependency order; each unit is one commit/PR (do not collapse).**

### PR-1 — Currency & Entitlement Foundation (`src/game/monetization/`)
- Files: `currency.ts` (Ginto/Diamante ledger, converters, first-recharge), `entitlements.ts` (owns `diamonds`, `equippedSkins`, `ownedSkins: Set<string>`, `inventoryTickets`), `types.ts`, `index.ts` barrel; patch `profile.ts` to extend `PlayerProfile` with `diamonds`, `ownedSkins`, `equippedSkins`, `pass`, `pity`, `transactions[]`, migration from `gold` key (keep read compat).
- Reuse: `loadPlayerProfile`/`savePlayerProfile` pattern; add `addGinto`/`spendDiamonds` validators.
- PR size: ~400 lines (split if >600).
- Depends: none.

### PR-2 — Cosmetics Catalog & Equip Pipeline (low prices)
- Files: `skins.ts` (catalog of 12 launch skins across Veer/Thistle/Hollow/Willow/Bedrock — 2 per hero: 1 Elite `450 🪙 / 49 💎` + 1 Epic `119 💎`; plus 2 Legend `249 💎` / Prime `399 💎` in Draw), `heroSkins` augmentation to `HEROES` (no ID renames), `actor.ts` skin picker hook.
- Lobby: `src/app/page.tsx` skin carousel in roster card (tier badge, price pill `49 💎 ~₱12`, `Preview` uses existing turntable with `ring` + `portrait` swap).
- HUD: equip indicator `👑 Bathala` badge above hero name.
- Validation: `npm run build` + `src/game/heroes/__tests__/skins.test.ts` asserting no stat leak (palette/VFX only).
- Depends: PR-1.

### PR-3 — Lakbay Pass (30-tier season) + Quest Bridge — 149 💎
- Files: `passes.ts` (season `lakbay_s1_amarillo`, 30 tiers, `xpPerTier: 320`, free/premium rewards table — free track grants Epic at tier 30 without pay), `season.ts`.
- Wiring: call `addPassXp` from `recordMatchOutcome` (+120 win / +60 loss) and `claimQuest`.
- UI: `src/app/page.tsx` third tab `Lakbay` with premium upsell `149 💎 (~₱37)` (`hasFirstRecharge` bonus shown), claim-all button, HUD post-match `MatchReward` adds `passXpEarned`. Copy stresses "₱37 for a month — less than a jeepney week".
- Depends: PR-1.

### PR-4 — Hero Unlock Gate & Convenience Bundles — 79 💎
- Files: `catalogue.ts` patch — all heroes gain `unlockCost: { ginto: 2800 } | { diamonds: 79 }`; `src/app/page.tsx` roster shows `🔒 2,800 🪙 / 79 💎 (~₱20) Unlock` vs `Play`. Rotate free 3 via `src/game/progression/profile.ts:241` seed.
- Bundles: `bundles.ts` (new-hero launch `Veer + Elite 99 💎 (~₱25)` — was 249).
- Depends: PR-1, PR-2 (skin bundle needs skins).

### PR-5 — Gacha Draws & Limited-Time Events (FOMO) — budget draws
- Files: `gacha.ts` (draw `anito_draw_s1`: 10-pool, odds `Elite 25%, Epic 4%, Legend 0.8%, Prime 0.2%`, pity **45**, 10-pull `270 💎` (10% off) vs single `30 💎`), `events.ts` (countdown banner, `FOMO` tag).
- UI: `Tindahan > Draw` with 1-pull `30 💎 (~₱7.50)` / 10-pull `270 💎 (~₱67)` buttons, history log, odds disclosure drawer. Copy: "45 pulls max to Prime — ~₱340 worst case, not ₱1500".
- Depends: PR-1, PR-2.

### PR-6 — Mock Storefront & Telemetry (no real money) — lean top-ups
- Files: `shop.ts` (tab router), `storefront.tsx` (lobby `Tindahan` component), `telemetry.ts` (local `transactions` + funnel events flushed to `console`/`localStorage`, ready for PostHog).
- Payment adapter stub: `payments.ts` with `provider: 'mock'` returning `{ success, receiptId: 'mock_...' }`. UI `Buy 💎` shows top-up bundles capped low: `₱49 → 55 💎`, `₱99 → 115 💎 (+15)`, `₱149 → 330 💎 (+30)` max. Intentional small leftovers (e.g., need 49, have 47 → nudges one more ₱49) per prompt #4 but never > ₱149 bundle in v1.
- Depends: PR-1..PR-5.

## Validation Plan
- `npm run build` after each PR (Hobby tier uses `next build` + `@netlify/plugin-nextjs`; verify `.next` publish).
- Unit: `skins.test.ts` (assert `skin.cost` never mutates `HEROES[*].health/speed/attack/range/cooldown/windup/lock`); `currency.test.ts` (first-recharge doubles only once, leftover bundle math).
- Manual smoke per PR:
  - PR-1: open lobby → header shows `💎 0 · 🪙 500`; add via devtools `addDiamonds(50)` persists after reload.
  - PR-2: select Veer → cycle Elite (`450 🪙 / 49 💎`) vs Epic (`119 💎`), `Equip` → turntable palette changes, `/play?hero=veer` shows equipped border, damage numbers unchanged.
  - PR-3: play a Classic match, `Won +120 Pass XP` appears on victory veil, tier 1 claims `50 🪙`; Premium `149 💎` copy visible.
  - PR-4: new profile sees 3 free heroes + 5 locked; `Unlock 79 💎 (~₱20)` with mock diamonds succeeds.
  - PR-5: Draw 10-pull `270 💎` shows pity counter, 45th guarantees Epic+.
  - PR-6: `Top-up ₱49 → 55 💎` mock receipt appears in `localStorage.transactions`; leftover `6 💎` intentional.

## Risks / Rollback
- **Play policy:** loot-box odds must be disclosed; keep 60-pity transparent and direct-purchase Elite path to reduce gambling complaint. Rollback: disable `Draw` tab via feature flag `ENABLE_GACHA=false`.
- **Pay-to-win creep:** any skin that accidentally ships stat (e.g., `flatHp`) breaks trust. Mitigate with invariant test; rollback is `ownedSkins` wipe not needed — just gate equip.
- **localStorage cap:** entitlements fit (~2KB); if bloated, migrate to IndexedDB. No data loss — current `gold` key kept as alias.
- **Netlify/Vercel drift:** `netlify.toml` publish is `.next` while Vercel uses `.vercel` output — keep single `next build` command; add `postbuild` check that `skins.ts` asset refs resolve (404s silent).

## Open Questions
- None — **low-price direction confirmed** per your note ("keep prices low, I built this less costs, in return I want players spend less"). All tiers now compressed 3-4× cheaper than MLBB: Epic 119 vs 899, Pass 149 vs 550, pity 45 vs 60, hero 79 vs 199. If you want even lower (e.g., Epic 79 💎 / Pass 99 💎), say so and PR-2/PR-3 update without code rewrites (price is data).
- Currency names: proposal `Ginto` + `Diamante` to keep Filipino flavor; if marketing prefers English, alias to `Gold`/`Diamonds` without code change (display string only).

---
**Approval ask:** Reply `Approve`, `Request changes`, or `Cancel`. On approve, implementation starts at PR-1 in that order; each PR is a separate commit (do not squash).
