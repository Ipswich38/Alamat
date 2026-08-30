# Talisman: the canon

What this game is about, decided by the owner. Everything in `src/` should be
answerable against this document. Where the code and this file disagree, this
file is right and the code is behind.

⚠ TRUE, NOT IMPRESSIVE. Anything here that has not been built says so.

---

## The story: The Battle for the Agimat Heart

The **Adarna Seekers**, heroes of the Willow Realm, fight across the **Pasig
Agimat Stream** to break the **Hollow Lair** and wake the sleeping Willow.

| # | Scene | Beat |
|---|-------|------|
| 1 | Willow Realm base | Three heroes gather at the Adarna Crystal Tree. *"Our land is in darkness."* |
| 2 | Bukid, the top lane | They push through the jungle, clearing creep camps. |
| 3 | Pasig Agimat Stream | They reach the river. Volcanic mountains pulse red across it. |
| 4 | Kapatagan, mid lane | Teams collide. Gold and blue against red and purple. |
| 5 | Hollow towers | A tower carved like a grotesque beast explodes. |
| 6 | The Hollow throne | The nexus shatters and a colossal golden Willow rises, restoring the sun. |

---

## What the story fixes about the design

These are not flavour. Each one is a constraint the build has to satisfy.

**IT IS TWO TEAMS, NOT ONE ROSTER.** Panels 4 and 5 have Willow heroes fighting
Hollow heroes. The five heroes in `game/heroes/catalogue.ts` are currently one
undifferentiated list, and Hollow sits among them as a playable hero. Under the
canon, Hollow is on the OTHER side.

**THE WIN CONDITION IS THE ENEMY NEXUS.** Not a duel, not a score. Panel 6 is
the game ending, and it ends by breaking a thing in a place.

**THE MAP IS THE STORY.** Three lanes, a river between two realms, towers, two
nexuses. The arena built and reverted on 2026-08-21 was the right SHAPE and the
wrong LOOK; see that commit before rebuilding it.

**NAMED ENEMY HEROES:** a **Treant** brute and a **Sever** assassin. The
Treant mesh is already generated at `public/models/creatures/treant.glb`.

**THE COLOUR LANGUAGE IS FIXED.** Willow are gold and blue; Hollow are red and
purple. Abilities, towers, cores and UI all follow it, so a player reads whose
effect is whose before they read what it does.

---

## Where the build actually is

⚠ THIS SECTION WENT STALE ONCE AND WAS BELIEVED. It claimed combat was not
started for several sessions after combat was built and playable. If you are
about to trust it, spend five minutes with `smoke-run.mjs` first.

Last checked against a running build on 2026-08-22.

**Done:** five heroes as data, three with generated rigged meshes (Veer,
Hollow, Willow). The full map: three lanes, twenty-two towers, base perimeters
with choke points, four jungle camps with Idol idols, the Pasig Agimat Stream
with three crossings, jungle barriers and brush. Camera zoom and rotation with
a compass. Terrain, clutter, backdrop, lighting and grade.

**Combat is built and playable.** `src/game/combat/`: basic attacks and three
ability shapes on one hit-resolution path, cooldowns, projectiles, dashes and
windups, cone/line/segment geometry against a body radius, minion waves that
march and fight, tower acquisition and fire, structures with warding, and the
Treant brute with death and a 5.5s respawn. The win condition is real: break the
enemy core and the nexus shatters to a victory screen.

**Not started:** the Sever assassin. A second playable team, so Hollow
still sits in the roster as a playable hero when the canon puts it on the other
side. Asynchronous opponents from a database, which is still a design, not code.
Audio of any kind.

**Known and unfixed:** the melee/brute matchup is not balanced. Veer needs
24.7s of basic attacks to kill the Treant and dies in 20.0s; Hollow needs 15.8s
and dies in 13.5s. Both lose a straight trade before abilities are counted. A
separate bug that made this infinite (the Treant out-reaching every melee hero)
was fixed on 2026-08-22, but the tuning was deliberately left alone.

⚠ The gap between the story above and that list is what is left of the game.

---

## The asset rules, learned the expensive way

**Meshy does OBJECTS, not SCENES.** A tower asked for as one object comes back
carved and detailed. A banyan tree asked for with its curtain of aerial roots
came back a lumpy mound, because that is a scene. Every one of the nine map
location descriptions is a LIST of objects and must be fed in that way.

**Never say plinth, base, ground or pedestal** in a prop prompt. A generator
models them as geometry welded to the mesh.

**A rig needs a human skeleton to find.** The Veer was refused with "pose
estimation failed" when described with anatomically correct digitigrade legs,
and accepted when described as a biped that is a horse from the neck up.

**Rig from the REFINED task, never the preview**, or the rigged output has no
textures and there is no way to marry them afterwards.

**Characters are ~6.4MB each, props ~8MB.** Five heroes is 32MB before anything
else. Nothing ships without mesh and texture compression.
