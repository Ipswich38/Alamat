# Alamat: the canon

What this game is about, decided by the owner. Everything in `src/` should be
answerable against this document. Where the code and this file disagree, this
file is right and the code is behind.

⚠ TRUE, NOT IMPRESSIVE. Anything here that has not been built says so.

---

## The story: The Battle for the Agimat Heart

The **Adarna Seekers**, heroes of the Diwata Realm, fight across the **Pasig
Agimat Stream** to break the **Aswang Lair** and wake the sleeping Diwata.

| # | Scene | Beat |
|---|-------|------|
| 1 | Diwata Realm base | Three heroes gather at the Adarna Crystal Tree. *"Our land is in darkness."* |
| 2 | Bukid, the top lane | They push through the jungle, clearing creep camps. |
| 3 | Pasig Agimat Stream | They reach the river. Volcanic mountains pulse red across it. |
| 4 | Kapatagan, mid lane | Teams collide. Gold and blue against red and purple. |
| 5 | Aswang towers | A tower carved like a grotesque beast explodes. |
| 6 | The Aswang throne | The nexus shatters and a colossal golden Diwata rises, restoring the sun. |

---

## What the story fixes about the design

These are not flavour. Each one is a constraint the build has to satisfy.

**IT IS TWO TEAMS, NOT ONE ROSTER.** Panels 4 and 5 have Diwata heroes fighting
Aswang heroes. The five heroes in `game/heroes/catalogue.ts` are currently one
undifferentiated list, and Aswang sits among them as a playable hero. Under the
canon, Aswang is on the OTHER side.

**THE WIN CONDITION IS THE ENEMY NEXUS.** Not a duel, not a score. Panel 6 is
the game ending, and it ends by breaking a thing in a place.

**THE MAP IS THE STORY.** Three lanes, a river between two realms, towers, two
nexuses. The arena built and reverted on 2026-08-21 was the right SHAPE and the
wrong LOOK; see that commit before rebuilding it.

**NAMED ENEMY HEROES:** a **Kapre** brute and a **Manananggal** assassin. The
Kapre mesh is already generated at `public/models/creatures/kapre.glb`.

**THE COLOUR LANGUAGE IS FIXED.** Diwata are gold and blue; Aswang are red and
purple. Abilities, towers, cores and UI all follow it, so a player reads whose
effect is whose before they read what it does.

---

## Where the build actually is

**Done:** five heroes as data, two of them with real generated rigged meshes
(Tikbalang, Aswang), a duel arena with cover and collision, movement, the
lighting and grade, generated guardian towers.

**Not started:** combat of any kind. Nothing fires, nothing takes damage,
nothing dies. There are no minions, no lanes in the live build, no nexus, no
second team, and no opponent.

⚠ The gap between the story above and that list is the whole game.

---

## The asset rules, learned the expensive way

**Meshy does OBJECTS, not SCENES.** A tower asked for as one object comes back
carved and detailed. A balete tree asked for with its curtain of aerial roots
came back a lumpy mound, because that is a scene. Every one of the nine map
location descriptions is a LIST of objects and must be fed in that way.

**Never say plinth, base, ground or pedestal** in a prop prompt. A generator
models them as geometry welded to the mesh.

**A rig needs a human skeleton to find.** The Tikbalang was refused with "pose
estimation failed" when described with anatomically correct digitigrade legs,
and accepted when described as a biped that is a horse from the neck up.

**Rig from the REFINED task, never the preview**, or the rigged output has no
textures and there is no way to marry them afterwards.

**Characters are ~6.4MB each, props ~8MB.** Five heroes is 32MB before anything
else. Nothing ships without mesh and texture compression.
