# Steliterate

A turn-based survival strategy game at the end of starlight. Vite 8, TypeScript 7 (strict),
Preact with signals, three.js 0.186, Web Audio; GPL-3.0. Live build:
https://m1omg.github.io/Steliterate/, rebuilt by the Pages workflow on every push to `main` or
`claude/lucid-newton-30cbpk`. The game was built on that branch (PR m1omg/Steliterate#1); until
it is merged, `main` holds only the licence.

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

Balance reference (7 Oct, living neighbours): 146 of 300 standard competent games survive, 60
victories, a Degenerate Age of 67 turns; 900 games: 435 survive, 179 victories; noise ±12 in 300
(two runs of 900 can differ by 30). By fate in the 900: decay 40%, stable 68%, curvature 44%
(`--fate=` runs one). The full history is in DEV-NOTES (Balance reference).
