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
`/archive/2026-10-13/` and the positronium bend in the Codex, all from `claude/epic-wozniak-lyhulf`;
PR m1omg/Steliterate#29, `75efadc`, put the new version's plan in `main`, and PR
m1omg/Steliterate#30, `3a3f4c2`, has a push to `main` or `next` build both; PR
m1omg/Steliterate#31, `f9be053`, the map's purple oval gone and the galaxy's own light in its
place, from `claude/sky-glow-main`, a branch from `main` made at the player's word, 15 Oct; PR
m1omg/Steliterate#32, `4435f3f`, sound that does not stutter, from `claude/sound-main`, the same
way; PR m1omg/Steliterate#33, `4b92446`, the project check's three fixes for today's game, from
`claude/check-main`, the same way, then merged into the work branch with `-s ours`, `9e5907b`, so
that the switch merges cleanly; PR m1omg/Steliterate#34, `e827e2f`, the game keeps its word,
and PR m1omg/Steliterate#35, `e4c77d7`, falling worlds, both from `claude/promises-main`, the same
way, each then merged into the work branch with `-s ours`).
The player asked me to open and merge these myself, every time, once a batch is
validated ("Always. You merge pls.", 9 Oct). The old live branch stays behind `main`: never push
an older commit to it, as Pages builds it too and would put the older build live.

**The new version** (13 and 14 Oct): the player's large request, planned in
`docs/plans/new-version.md` (approved) and built on `claude/epic-wozniak-lyhulf`. All of it is done,
and since 14 Oct it is up at https://m1omg.github.io/Steliterate/next/ ("Preview address, but once
all is done"): the `next` branch, a copy of the work branch (`git push origin
claude/epic-wozniak-lyhulf:next` after each validated batch), built beside `main` by the Pages
workflow (`.github/workflows/pages.yml`). `main` keeps today's game until the player says to
switch, by a PR from `next` merged with a merge commit. Its saves are its own (`steliterate2.`
keys), and now that it is up, "Saves are sacred" holds for them too: `tools/saves/` has its first
saves, which `savecompat` plays. `public/archive/` holds frozen builds: never edit them.

A new session, or the player's other account (since 9 Oct), starts with `HANDOVER.md` (rewritten
16 Oct):
where things stand, what to read in which order, the player, the open threads and the traps.
**Its section 0 (19 and 20 Oct) comes first.** It covers what came after: the batches "the game
keeps its word" and "falling worlds", live in both versions since 20 Oct; and what is left of the
approved plan, `docs/plans/2026-10-19-falling-worlds-and-the-list.md` (the player's list of 16
Oct: items 7, 1 and 6, then the pace).
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

Balance reference (20 Oct, falling worlds, new games only): 149 of 300 standard competent games
survive, 80 victories, a Degenerate Age of 72 turns; 300 at Harsh (`--diff=harsh`): 154 / 58 / 68;
every game re-rolled by the new worlds, so within the noise of the game keeps its word's 160 / 81 /
72; 900 games then: 476 survive, 244 victories; noise ±12 in 300 (two runs of 900 can differ by
30). By fate in
the 900: decay 43%, stable 69%, curvature 56% (`--fate=` runs one). The victories beside 12 Oct's
(154 / 72, 900 games 456 / 203) are a hidden step's (`docs/spoilers/slow-ones.md`). The full history is
in DEV-NOTES (Balance reference). That is `main`'s game. The new version (on
`claude/epic-wozniak-lyhulf`) starts again with real neighbours: part 2a's reference (13 Oct,
`3678301`) is 140 of 300 surviving, 41 victories; 900 games 397 / 131, a Degenerate Age of 71
turns; by fate decay 36%, stable 57%, curvature 46%. With part 2b (the Hunger among them): 135 of
300, 64 victories; 900 games 411 / 167, a Degenerate Age of 76 turns. With part 3-2 (the Passage,
and the autoplayer through the end of matter, `24fbc18`): 175 of 300, 62 victories; 900 games
530 / 219, a Degenerate Age of 74 turns; by fate decay 49%, stable 71%, curvature 66%. With part
3-4 (drifting between black holes, the Horizon form): 217 of 300, 69 victories; 900 games 639 /
226, a Degenerate Age of 74 turns; by fate decay 73%, stable 71%, curvature 66%. With part 3-5
(positronium): 900 games 636 / 226 / 74, decay and stable as before game for game. Harder (14 Oct,
the player's word): 520 / 218 / 72; by fate decay 251 / 450, stable 164 / 239, curvature 105 / 211.
With part 3-6 (the stable fate's late game): 460 / 209 / 72, stable 103 / 239, the others as
before. Part 3-7 and Part 4 change no rule. Harder (14 Oct,
the player: "make it harder pls"; the dark's Continuity, swarms on to our settlements): 167 of
300, 67 victories; 900 games 520 / 218 / 72; by fate decay 56%, stable 69%, curvature 50%.
With part 3-6 (the stable fate's late game: black dwarf supernovae, iron stars, tunnelling
collapse): 144 of 300, 61 victories; 900 games 460 / 209 / 72; by fate decay 56%, stable 43%,
curvature 50%. With the dearer Archive, ships seeing what they pass and the softer stable fate (14
Oct, `d92849a`; the films change no rule): 153 of 300, 63 victories; 900 games 444 / 160 / 70; by
fate decay 53%, stable 46%, curvature 46%. With real neighbours the noise is larger: the same rules
with only the neighbours' dice reshuffled give 440 / 177 / 69, and two such runs of 900 can differ
by 32 survivors and 37 victories. The project check (15 Oct, no rule changed): 300 games on each
version game for game as before (153 / 63 / 70 here, 154 / 72 / 72 in `main`). The game keeps
its word (20 Oct): 156 of 300, 65 victories, a Degenerate Age of 71 turns; by fate decay 82 / 148,
stable 44 / 81, curvature 30 / 71; Harsh 124 / 35 / 66 (114 / 29 / 66 before). Falling worlds
(20 Oct, new games): 147 / 63 / 68; by fate decay 74 / 148, stable 39 / 81, curvature 34 / 71;
Harsh 145 / 52 / 73; a control run with the new worlds and the old falls gives 157 / 65 / 69.
