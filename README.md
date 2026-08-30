# Alamat

Heroes of Philippine folklore, in a duel arena where nothing locks on.

`talisman` is Filipino for *legend*, which is both what the game is about and a
name a foreign player can say out loud.

## What this is, honestly

A **playable vertical slice**. The full map is built: three lanes, twenty-two
towers, base perimeters, jungle camps, and the Pasig Agimat Stream with three
crossings. Five heroes as data, three with rigged meshes. Combat works: basic
attacks and three ability shapes, minion waves, tower fire, a Treant brute that
dies and respawns, and a win condition that ends the match when a core breaks.

What is missing is a second playable team, the Sever, the asynchronous
opponents the design is built around, and audio. The melee heroes also still
lose a straight fight with the Treant, which is a tuning problem, not a bug.

Run `smoke-run.mjs` before trusting any status written here or in
`docs/canon.md`. Both have been wrong before.

## The decisions already made, and why

**Nothing locks on.** Every ability is a shape thrown at a direction. Mobile
MOBAs auto-target because it is easier on a phone, and the price is that the
mechanical ceiling collapses. This is the whole differentiator, so it is
enforced at the type level: there is no `target` field to be tempted by.

**One arena, not three lanes.** A lane map only makes sense with ten players in
it. This is built to be playable with nobody else online.

**Asynchronous opponents, not real-time PvP.** You fight AI running other
players' actual heroes and builds, pulled from a database. Real ladder, real
opponents to counter, and no game servers, no matchmaking queue and no
anti-cheat surface. It works the same with one player online or ten thousand.
A real-time 5v5 is not solo-buildable, and the reason is never the gameplay
code: it is authoritative netcode, per-match server cost and cheating.

**Heroes are data, not classes.** Adding one is an entry in
`src/game/heroes/catalogue.ts`. The moment heroes are code, balancing becomes a
refactor and nobody balances anything.

**Flat-shaded Lambert, everywhere.** One material recipe in
`render3d/stage.ts`. This is what lets a generated or downloaded model sit in
the same world as hand-built geometry. On a previous project, generated assets
arrived photoreal and had to be switched off; the problem was never the model,
it was the material.

**Heroes are built from primitives, generated assets are for creatures.**
Evidence from the previous project: generated 3D *characters* did not survive
rigging and animation, while generated *creatures and props* did. So bodies are
geometry tinted by each hero's palette, and the asset budget is saved for
bosses and scenery.

## Layout

```
src/game/heroes/    the roster, as data
src/game/arena/     the ground, collision, line of sight
src/game/render3d/  stage, arena geometry, fighter bodies
src/components/game/Arena3D.tsx   canvas, frame loop, input, and nothing else
```

## Running it

```
npm run dev     # then open /play
npm run build
```

### Verifying it

The smoke scripts drive a real Chrome against a running dev server, walk the
hero, swing, cast, and report the HUD plus a clean/dirty console verdict. They
are the fastest honest answer to "is it still working".

```
npm run dev
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node smoke-run.mjs
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node smoke-tower.mjs
```

`playwright-core` is installed but its browsers are not, which is why `CHROME`
points at the system one.

`/play` takes two debug params that make a probe repeatable:
`?at=x,z` spawns the hero at a world position, and `?zoom=n` sets the starting
camera distance. `?at=6,6` puts you next to the Treant at the origin.
