# Handover: picking up Steliterate

For the next Claude instance (a new session, or the player's other account). Written 11 Oct at
the end of a long session, as the player asked: "pls make a .md for handover to another claude
instance, ill be back dont worry". This is the entry point. The details stay where they are,
and every section says where.

Spoiler-light, as everything the player may read: the stranger minds and the endings are in
`docs/spoilers/`, for you only. Never repeat them to the player.

## 1. What this is

Steliterate is a turn-based survival strategy game at the end of starlight. You keep a
civilization alive from the last red dwarfs to the Dark Era. Each turn covers more time than the
last.

- **Stack:** Vite 8, TypeScript 7 (strict), Preact with signals, three.js 0.186, Web Audio.
- **Licence:** GPL-3.0.
- **Repository:** `m1omg/Steliterate`.
- **Live:** https://m1omg.github.io/Steliterate/, built by GitHub Pages from `main`.
- **Code:** `src/game` is the simulation (deterministic, seeded), `src/render` the three.js views,
  `src/ui` the interface, `tools/` the harness, the playtest and the checks.

## 2. Read in this order

1. This file.
2. `CLAUDE.md`: the rules that are easy to break, and the validation list.
3. `docs/SESSION-NOTES.md`, "Picking up":
   - what is live;
   - the first steps;
   - the open threads, with the Slovak translation plan.
   The dated entries below it record every decision, in the player's words.
4. `docs/DEV-NOTES.md`:
   - "Workflow for every batch";
   - "Test hooks and scripts", with "Helpers to recreate in a new container";
   - "Gotchas";
   - "Where the newer systems live";
   - "Balance reference".
5. `docs/CHANGELOG.md`, the last few entries (every change, with its balance figures), and
   `docs/DESIGN.md` when a rule's intent matters.

## 3. Where things stand (12 Oct)

- **`main` and the live game:**
  - `main` is at `3538f47`, PR m1omg/Steliterate#16 (12 Oct): the Last Star shines when it
    lights, and its clock is free. The live script is `index-BRmxB_Lf.js`.
  - Before it: PR m1omg/Steliterate#12 (`d2c52b4`, swarms go for ships near them) and PR
    m1omg/Steliterate#13 (Halo Siphons can be shut); PR m1omg/Steliterate#14 and #15 were this
    handover and the Last Star's plan (no code).
- **Branches:**
  - `claude/lucid-newton-v2` (the first account's sessions), `claude/epic-wozniak-lyhulf` and
    `claude/affectionate-johnson-qqr7p2` (the Last Star) are fully merged. A follow-up starts its
    branch again from `main`.
  - `claude/lucid-newton-30cbpk` is the old live branch, frozen at `fc6c59a`. Pages builds it
    too: never push to it.
- **The claude.ai artifact** has not been updated since 28 Sep. GitHub Pages is the live build.
- **The player's own saves are not in the repository.** They uploaded a turn-77 save (9 Oct) and a
  turn-134 save ("the-people", 11 Oct) to earlier sessions. Ask them to upload one again if you
  need it.

## 4. The player (m1omg)

The full picture is in SESSION-NOTES, "How the player likes to work".

- **Language and dictation.** They are Slovak, and write in English, often by dictation. Read
  through mis-heard words: "diploma's screen" meant the diplomacy screen.
- **They play while you work,** and keep playing between batches. A deploy must never break an
  open game or a save.
- **Spoiler-light answers.** Never spoil the Lattice's story or ending, or the stranger minds. Say
  nothing about the Black Hole Age or later unless asked.
- **Saves and seeds are sacred.** Use optional fields only, small counters in `civ.flags`, and
  `migrate()`. Generation consumes the RNG exactly as before.
- **Physics.** Keep it grounded, and say plainly where the game bends it: the Codex has a
  "where the game bends physics" line for each bend.
- **Discuss first** before a Lattice rework, deeper diplomacy, or other civilizations beyond what
  was asked. The Unlit's quest line stays word for word: extend it, never reduce it.
- **"Always. You merge pls."** Once a batch is validated, open the PR into `main` and merge it
  yourself, with a merge commit.
- **Asking.** For any real choice, ask with options, mark one "(Recommended)", and give each a
  one-line consequence. They answer these quickly, and often add a condition in their own words
  ("only count the emptying from point of continuing … NOT retrospective"): honour it exactly.
- **More than one session at a time.** On 11 Oct one session stopped mid-validation ("bit the
  dust mid-change") with its work pushed but not merged; the other finished it. So, before
  anything else:
  - `git fetch` every branch;
  - look for pushed commits no PR has taken in (`git log origin/main..origin/<branch>`);
  - finish or ask.

## 5. Working in a fresh container

1. Run `npm ci`.
2. Make the local copy of the game's fonts. The browser checks measure text in the real faces
   only with `STEL_FONTS`: DEV-NOTES, "The game's fonts in this container" (a curl recipe).
3. Recreate the helpers from DEV-NOTES in your scratchpad:
   - serve the build for one command;
   - 900 games in three slices, with the tally by fate;
   - compare two runs game for game.
4. **Validate** with the list in CLAUDE.md:
   - tsc and the build;
   - `vite preview` on :4173;
   - the playtest;
   - savecompat;
   - `npm run check` (unit);
   - the browser checks with `STEL_FONTS` (about half an hour under load).
5. **A rules change:** run 300 and 900 games against a `git worktree` of `main`, and compare
   game for game:
   - symlink `node_modules` into the worktree;
   - a display-only change must leave all 900 identical.
6. **Go live:**
   - push the work branch;
   - open a PR into `main` and merge it with a merge commit (never squash or rebase: the docs
     cite commit IDs);
   - check that the Pages run succeeded:
     `gh api "repos/m1omg/Steliterate/actions/runs?branch=main&per_page=3"`;
   - check that the live page loads the same `index-*.js` as your build.
7. Write it down: a CHANGELOG entry (with the balance), DEV-NOTES (systems, checks, a balance
   row), SESSION-NOTES (the decision in the player's words, and "Picking up").

## 6. The latest work (11 Oct)

**Swarms go for ships near them** (PR #12), built by the first account's session:
- An awake swarm sends part of itself after our nearest ship stopped within 25 ly.
- Ships at a settlement share its losses.
- CHANGELOG: "Swarms go for ships near them"; DEV-NOTES: "Parts sent after ships".

**Halo Siphons can be shut** (PR #13). The player asked "how do i actually stop draining the
halo?", and there was no way to.
- **Shutting:** for good, with a confirm, from under the Unlit's request or on their card
  (Signals, Other minds).
- **The halo's clock:** while the siphons run, the whole halo falls twice as fast (a stated
  bend). `civ.flags.halo_drawn` grows from the update on only, so it is not retrospective.
- **What the siphons double:** only an ember's dark-matter light (`SourceInfo.dark`).
- **The Unlit's messages** never lapse, and one that lapsed reopens on load.
- **Where to read more:** CHANGELOG, "Halo Siphons can be shut"; DEV-NOTES, "Halo Siphons and the
  halo's clock".

## 7. The baseline (12 Oct, the Last Star)

**Checks:**
- tsc and the build are clean;
- the playtest passes (30/144 Hz parity);
- all 44 unit checks pass;
- savecompat passes on the 6 saves in `tools/saves/`;
- all 48 browser checks pass, in the real fonts.

**Harness (standard competent):**

| | Survive | Victories | Degenerate Age |
|---|---|---|---|
| 300 games | 150 | 67 | 72 turns |
| 900 games | 445 | 199 | 70 turns |

- By fate, survivors in the 900: decay 177 of 450, stable 166 of 239, curvature 102 of 211.
- Before it (11 Oct): 151 / 69 / 71 in 300, 442 / 195 / 70 in 900; 721 of 900 games are
  unchanged, and every one that changed lights the Last Star.
- Noise is ±12 in 300 games; two runs of 900 can differ by 30.
- The history is in DEV-NOTES, "Balance reference".

## 8. Open threads, likeliest first

Wait for the player's word before starting any of them.

0. **Done (12 Oct): the Last Star shines when it lights.** The plan, `docs/plans/last-star.md`, was
   carried out with the player's answers (CHANGELOG, "The Last Star shines when it lights"). Not
   done, a choice to raise if it comes up: the neighbours' new-star rules (sleepers waking for a
   new star, claims) still leave the Last Star out.

1. **A Slovak translation of our own.** Planned with the player on 10 Oct and not started. The
   decisions are in SESSION-NOTES, "Picking up":
   - a glossary first;
   - side-by-side review sheets;
   - live all at once;
   - about 40,000 words.
2. **The friend's word on the magnifier mode** (`?lowvision`). Not built: read-aloud, the camera
   from the keyboard, reduced motion.
3. **Messages from gone civilizations.** Four answers misbehave (SESSION-NOTES lists them).
   Diplomacy is discuss-first.
4. **Music:** a second Dark track and a recorded Canon, waiting on Krea credit (DEV-NOTES, "Music
   tooling").
5. **The discuss-first list** in "Picking up": the Lattice, diplomacy, tidal locking and the rest.
6. **New on 11 Oct, each to raise with the player:**
   - **The autoplayer researches Halo Siphons.** Its research fallback (`pickResearch` in
     `auto.ts`, the cheapest open project) ignores `noAuto`, so it researches them in half the
     harness's games, and never shuts them. Changing that moves the harness.
   - **Ember restraint** (×0.75, the Unlit's first choice) still applies to all the light at a halo
     dwarf, a world falling in included, while the siphons now double only the dark matter.
   - **The harsher swarm version:** a part whose ship is gone goes on to our nearest settlement.
     It was offered, in case they want the game harder.
   - **Only the Unlit's messages wait.** Another mind's first message still lapses after 8 turns
     like any message, and its thread then has no way forward (`minds.ts`, `slow_first`). The same
     fix would apply (`waitsForAnswer` in `signals.ts`).

## 9. Traps that cost time

The full list is in DEV-NOTES, "Gotchas".

- **`pgrep -f` and `pkill -f` match their own shell.** On 11 Oct, `kill $(pgrep -f "vite.js
  preview --port 4174")` killed the command's own shell. Find the PID with a pattern that cannot
  match itself (`ps -eo pid,args | grep "[v]ite.js preview"`), or by its port.
- **An `rm` of a path built from variables** is blocked by a safety check. Write
  `"${VAR:?}"/…` so an empty variable stops the command.
- **The stop hook** won't let a turn end with uncommitted, untracked or unpushed changes. Keep
  scratch files outside the clone.
- **A container restart** stops background runs without a word. If an output stops short, run
  it again.
- **Under load the software renderer** can fall below 10 frames a second, and the frame time is
  capped at 0.1 s. Checks poll until things settle; they never trust one fixed wait.
- **Layout checks need the real fonts** (`STEL_FONTS`). Fallback faces measure shorter lines, and
  a panel can pass there and fail for the player.
- **`state.eta` is not always `log10(state.years)`.** Use `state.eta` itself where a test switches
  clocks.
- **Manual and Codex strings are single-quoted.** Write ’ in prose: a straight `'` breaks the
  build.
- **A seeded browser check** rides its game's course, so a rules change can move it (the
  `cooling` check moved to η 17 on 11 Oct). Set the situation up rather than hope for it.
