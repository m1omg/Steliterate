# Steliterate

A turn-based survival strategy game at the end of starlight. Vite 8, TypeScript 7 (strict),
Preact with signals, three.js 0.186, Web Audio; GPL-3.0. Live build:
https://m1omg.github.io/Steliterate/, rebuilt by the Pages workflow on every push to `main` or
`claude/lucid-newton-30cbpk`. The game was built on that branch; PR m1omg/Steliterate#1 merged it
into `main` on 8 Oct with a merge commit (`3e913f3`, every commit ID kept). Since 9 Oct a batch
goes live by a PR from the work branch into `main`, merged with a merge commit (PR
m1omg/Steliterate#3, `0e08054`; PR m1omg/Steliterate#4, `d9bd6e5`, the magnifier mode; PR
m1omg/Steliterate#6, `4268a82`, the phone interface; PR m1omg/Steliterate#8, `8fbfa89`, what a
Thread makes in words; PR m1omg/Steliterate#10, `7c334ec`, no "???" in the research grid once the
fate of matter is known; PR m1omg/Steliterate#12, `d2c52b4`, swarms go for ships near them, both
from `claude/lucid-newton-v2`; PR m1omg/Steliterate#13, Halo Siphons can be shut, from
`claude/epic-wozniak-lyhulf`; PR m1omg/Steliterate#16, `3538f47`, the Last Star shines when it
lights, and PR m1omg/Steliterate#22, `af0b58b`, Export all saves; PR
m1omg/Steliterate#23, `a083698`, rogue worlds leave their star behind and black holes by lifetime,
all from `claude/affectionate-johnson-qqr7p2`; then PR m1omg/Steliterate#25, `3f927a4`, a third
track for the Dusk, PR m1omg/Steliterate#26, `a16d43b`, a darker remix of it for the Dark, and the
latest game batch, PR m1omg/Steliterate#27, `4aaaa2a`, a burst reaches only what is still there
and lighter on phones, then PR m1omg/Steliterate#28, `db34424`, the backup of today's game at
`/archive/2026-10-13/` and the positronium bend in the Codex, all from `claude/epic-wozniak-lyhulf`).
The player asked me to open and merge these myself, every time, once a batch is
validated ("Always. You merge pls.", 9 Oct). The old live branch stays behind `main`: never push
an older commit to it, as Pages builds it too and would put the older build live.

**The new version** (13 Oct): the player's large request is planned in
`docs/plans/new-version.md` (approved). It is built on `claude/epic-wozniak-lyhulf` and stays off
`main` until all of it is done ("Preview address, but once all is done"); then it goes up at
`/next/`. Its saves are its own (`steliterate2.` keys), and "Saves are sacred" is suspended for it
until then. `public/archive/` holds frozen builds: never edit them.

A new session, or the player's other account (since 9 Oct), starts with `HANDOVER.md` (rewritten
12 Oct):
where things stand, what to read in which order, the player, the open threads and the traps.
Then "Picking up" in `docs/SESSION-NOTES.md`: what is live, the first steps, the last
validation's numbers, and the open threads in full.

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

Balance reference (12 Oct, rogue worlds leave their star behind, a finished Work not resumed,
positronium; the same on 13 Oct with who a burst reaches): 154 of 300 standard competent games survive, 72 victories, a Degenerate Age of 72
turns; 900 games: 456 survive, 203 victories; noise ±12 in 300 (two runs of 900 can differ by 30).
By fate in the 900: decay 42%, stable 70%, curvature 47% (`--fate=` runs one). The full history is
in DEV-NOTES (Balance reference). That is `main`'s game. The new version (on
`claude/epic-wozniak-lyhulf`) starts again with real neighbours: part 2a's reference (13 Oct,
`3678301`) is 140 of 300 surviving, 41 victories; 900 games 397 / 131, a Degenerate Age of 71
turns; by fate decay 36%, stable 57%, curvature 46%. With part 2b (the Hunger among them): 135 of
300, 64 victories; 900 games 411 / 167, a Degenerate Age of 76 turns. With part 3-2 (the Passage,
and the autoplayer through the end of matter, `24fbc18`): 175 of 300, 62 victories; 900 games
530 / 219, a Degenerate Age of 74 turns; by fate decay 49%, stable 71%, curvature 66%. With part
3-4 (drifting between black holes, the Horizon form): 217 of 300, 69 victories; 900 games 639 /
226, a Degenerate Age of 74 turns; by fate decay 73%, stable 71%, curvature 66%.
