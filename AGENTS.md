<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules (all agents, all models)

This game has been built by several different AI models across many sessions.
The expensive failures were never bad code. They were code that did not
connect, because each author added a system without reading the one already
there. Concretely, and all three shipped:

- Three separate device/quality systems, none wired to the renderer, so quality
  sat pinned at `high` on every phone.
- A "HQ graphics" commit that rewrote shadow tiers in `platform/mobile.ts`,
  which no module imports, so it changed nothing.
- Movement derived twice in two places that disagreed, so pressing D walked
  you left while the HUD arrow pointed right.

A passing build proves none of that is absent. So:

1. **Before adding a system, search for the existing one.**
   `grep -rn "quality\|performance\|<the concept>" src` first. If something is
   already there, extend it or delete it. Never park a second one beside it.
2. **Prove your change reaches the running program.** Trace the import chain to
   an entry point, or it does not count as done. "The build passed" is not that
   proof.
3. **Run `node scripts/audit-wiring.mjs` before you hand work back.** It reports
   dead modules, barrel-only modules, competing exports and oversized files. Do
   not add findings. Fixing existing ones is welcome.
4. **One source per behaviour.** If a value is computed in two places, delete
   one. Two implementations always drift, and the drift is silent.
5. **No `*.backup.ts` in `src/`.** Git is the backup. A backup file beside the
   real one is a trap for whoever edits next.
6. **Files stay under 800 lines.** Past that, split behind a barrel.
