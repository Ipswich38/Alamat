# Pre-rig hero sources

The textured but UNRIGGED output of `scripts/meshy-assets.mjs --refine`. The game
never loads these: it loads `-rigged.glb` and `-walk.glb` from
`public/models/heroes/`, which `scripts/meshy-rig.mjs` derives from them.

They live here rather than in `public/` because Next serves everything under
`public/`, and leaving them there shipped roughly 53 MB of files no page ever
requests, to every visitor and into the Android bundle.

Kept rather than deleted because regenerating one costs 30 Meshy credits, and
rigging needs the refined task, so these are the input to any future re-rig.
