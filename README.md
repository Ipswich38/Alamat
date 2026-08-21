# Alamat

Heroes of Philippine folklore, in a duel arena where nothing locks on.

`alamat` is Filipino for *legend*, which is both what the game is about and a
name a foreign player can say out loud.

## What this is, honestly

A **walking prototype**. There is an arena, five heroes with full stat and
ability data, working movement and collision, and a hero picker. There is **no
combat yet**: no abilities fire, there is no opponent, and nothing can die.

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
