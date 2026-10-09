# Steliterate

A turn-based survival strategy game at the end of starlight. Vite 8, TypeScript 7 (strict),
Preact with signals, three.js 0.186, Web Audio; GPL-3.0. Live build:
https://m1omg.github.io/Steliterate/, rebuilt by the Pages workflow on every push to `main` or
`claude/lucid-newton-30cbpk`. The game was built on that branch; PR m1omg/Steliterate#1 merged it
into `main` on 8 Oct with a merge commit (`3e913f3`, every commit ID kept). Since 9 Oct a batch
goes live by a PR from the work branch into `main`, merged with a merge commit (PR
m1omg/Steliterate#3, `0e08054`; the latest game batch, PR m1omg/Steliterate#4, `d9bd6e5`, the
magnifier mode). The player asked me to open and merge these myself, every time, once a batch is
validated ("Always. You merge pls.", 9 Oct). The old live branch stays behind `main`: never push
an older commit to it, as Pages builds it too and would put the older build live.

A new session, or the player's other account (since 9 Oct), starts with "Picking up" in
`docs/SESSION-NOTES.md`: what is live, the first steps, the last validation's numbers, and the
open threads.

Read these before changing anything:

- `docs/SESSION-NOTES.md`: how the player (m1omg) likes to work, decisions, open threads.
- `docs/DEV-NOTES.md`: workflow, test hooks, gotchas, where each system lives.
- `docs/CHANGELOG.md` (every change, with balance figures) and `docs/DESIGN.md` (the design).
- `docs/spoilers/`: read for context; never repeat any of it to the player.

## Rules that are easy to break

- **Spoiler-light answers.** Never spoil the Lattice's story or ending, or the stranger minds.
- **Saves are sacred.** Only add optional fields or compute things live; small counters go in
  `civ.flags`. Every load runs `migrate()` in `src/game/save.ts`. When saved state changes
  shape, bump `SAVE_VERSION`, add a migrate step, and add a save from the old version to
  `tools/saves/`.
- **Seeds are sacred too.** Generation must consume the RNG exactly as before, or every seed's
  galaxy changes.
- **Balance:** run the harness whenever rules change and report the numbers.
- **Discuss first:** a Lattice rework, deeper diplomacy, or other civilizations beyond what was
  asked.
- **Refresh-rate independence:** animate on elapsed time only (`1 − exp(−k·dt)` smoothing).
- **Physics:** keep it grounded, and say plainly where the game bends it.
- In `src/ui/screens/Manual.tsx` prose, write ’ not `'`: a straight apostrophe ends the
  single-quoted string and breaks the build.
- **Low vision and the keyboard** (9 Oct): a clickable row is `{...pressable(fn)}` (`a11y.ts`),
  never a bare `onClick` on a div; a new HUD part needs its place in the magnifier mode's column
  (the `html.lv` block at the end of `styles.css`). Browser checks `a11y`, `lowvision`, `translate`.

## Validate every batch

```sh
npm ci                                   # fresh containers have no node_modules
npx tsc --noEmit -p .
npm run build
npx vite preview --port 4173             # in the background; leave it running
node tools/playtest.cjs http://localhost:4173/ <dir outside the repo>   # "ALL CHECKS PASSED"
npm run savecompat                       # "SAVE COMPAT OK"
npm run check                            # unit checks in tools/checks/unit: "ALL CHECKS PASSED"
npm run check:browser -- http://localhost:4173/   # browser checks in tools/checks/browser
npx tsx tools/sim.ts 300 standard competent > sim.txt   # when rules change; count in DEV-NOTES
```

A new rule or fix gets a check in `tools/checks/` (see DEV-NOTES, Test hooks and scripts).

Balance reference (8 Oct, the audits, cooling, outer worlds, the physical flare, our clock a
span): 148 of 300 standard competent games survive, 72 victories, a Degenerate Age of 71 turns;
900 games: 439 survive, 203 victories; noise ±12 in 300 (two runs of 900 can differ by 30). By
fate in the 900: decay 37%, stable 69%, curvature 51% (`--fate=` runs one). The full history is
in DEV-NOTES (Balance reference).
