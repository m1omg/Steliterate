# Handover: picking up Steliterate

For the next Claude instance (a new session, or the player's other account). Rewritten on 16 Oct
at the player's word ("pls also do a .MD for handover"), after the project check of 15 Oct. It
replaces the text of 12 Oct, which had been patched many times since. This is the entry point:
the details stay in the other notes, and every section says where.

Spoiler-light, like everything the player may read. The stranger minds and the endings are in
`docs/spoilers/`, for you only: never repeat them to the player.

## 0. Start here: the handover of 19 Oct, and what came after (20 Oct)

The player ran out of usage late on 19 Oct ("93% of usage is gone right now… I'll be back, don't
worry") and asked for this: "please put this plan along with updating the handover MD, because I
will need to continue in another session". Sections 1 to 8 below are from 16 Oct and still hold.
On 20 Oct a new session (on the other account) picked it up: "Continue my game Steliterate … from
where the previous session stopped", with three steps in this order: finish "the game keeps its
word", then the player's list of 16 Oct, then the falling worlds.

**Done since 16 Oct:**
- `docs/REPLICATE.md`: a full spec of today's game, written 16 to 17 Oct, kept up with `main`
  since (now at PR m1omg/Steliterate#35, `e4c77d7`), its notes of where text and code disagreed
  now the rules.
- **"The game keeps its word"** (19 Oct, in both versions at the player's word), live on 20 Oct:
  REPLICATE found places where the game's text promised one thing and the code did another, and
  each was made to keep its promise (the Long Record, Hunger Studies, the Communion Charter,
  Harsh's "crueller crossings", falls into brown dwarfs and black holes in new games, the
  Expansion Mandate, rules no text told of, and a hidden step made reachable: its details are in
  `docs/spoilers/slow-ones.md`, never tell the player). Today's game by PR m1omg/Steliterate#34
  (`e827e2f`). The figures are in the CHANGELOG.
- **Falling worlds** (the plan's part B, with item 2 of the list), in both versions, new games
  only, live on 20 Oct: worlds of rock and ice break into rubble rings at the tidal limit, giants
  fall in a flash (melting or boiling worlds inside its melt line, banked by Burst Catchers), the
  Flash Shelter and the Shadow Shield, the dark choice in A World Falls, more worlds at black
  holes, a hole's Disk luminosity in Suns. Today's game by PR m1omg/Steliterate#35 (`e4c77d7`;
  code `8133d7f`, from `claude/promises-main`), then `main` merged into the work branch with
  `-s ours` (`179e4ab`). One change from the plan, to be told plainly: both shelters come with
  Dusk research (the Flash Shelter with Deep Warrens, the Shadow Shield with Orbital Industry),
  not Burst Capture, since a white dwarf's close giant can fall in before the Last Light.
  CHANGELOG, "Falling worlds", has the figures:
  - the new version: 147 / 63 / 68 of 300 (156 / 65 / 71 before); a control run with the new
    worlds and the old falls puts what the rules cost at 10 games, within the noise; Harsh 145 /
    52 / 73 (124 / 35 / 66);
  - today's game: 149 / 80 / 72 of 300 (160 / 81 / 72), Harsh 154 / 58 / 68 (147 / 62 / 68).
- **The list of 16 Oct** arrived on 20 Oct (the `.odt` attached again). Its four pictures are
  described in the plan (part C, "20 Oct: the pictures, seen"), so the file is not needed again.
  Item 2 is done, with the falling worlds.

**What to do, in order** (the plan's part C, each batch in both versions, validated, pushed to
`next` and merged into `main`):
1. **Items 7, 1 and 6**, one batch (bugs; no rule changes but the finds' tests):
   - item 7: no "Life Under the Ice" without a star, and no find about a world that is falling,
     flung loose or gone;
   - items 1 and 6: one sea for the Water row and the picture (`seaBand`).
2. **Items 3 to 5**, the pace ("Ten per Tide turn"), with the harness.

**The player's usage** ran out twice on 19 Oct (the weekly limit, then the five-hour one). They
pause and come back. Work in batches that end validated and pushed, and keep messages short.

## 1. What this is

Steliterate is a turn-based survival strategy game at the end of starlight. You keep a
civilization alive from the last red dwarfs to the Dark Era, each turn covering more time than the
last.

- **Stack:** Vite 8, TypeScript 7 (strict), Preact with signals, three.js 0.186, Web Audio.
- **Licence:** GPL-3.0.
- **Repository:** `m1omg/Steliterate`.
- **Code:**
  - `src/game` is the simulation, deterministic and seeded;
  - `src/render` holds the three.js views, and `src/film` the films;
  - `src/audio` the music and sounds, `src/ui` the interface;
  - `tools/` the harness (`sim.ts`), the playtest, savecompat and the checks (`tools/checks/unit`,
    `tools/checks/browser`).
- **Two versions, both live** (Pages builds both on a push to `main` or `next`):

  | | Today's game | The new version |
  |---|---|---|
  | Address | https://m1omg.github.io/Steliterate/ | https://m1omg.github.io/Steliterate/next/ |
  | Branch | `main` | `next`, a copy of `claude/epic-wozniak-lyhulf` |
  | As of | PR m1omg/Steliterate#35 (`e4c77d7`) | `179e4ab` and its notes |
  | Live script | `index-CnbCeqhO.js` | `index-BForJQDi.js` |
  | Saves | `steliterate.` keys | `steliterate2.` keys (their own) |

- **The backup:** today's game as of 13 Oct, frozen and playable, at
  https://m1omg.github.io/Steliterate/archive/2026-10-13/ (`public/archive/`, never edit it).

## 2. Read in this order

1. This file.
2. `CLAUDE.md`: the rules that are easy to break, the validation list, every PR, and the balance
   references of both versions.
3. `docs/plans/new-version.md`: the approved plan the new version was built to.
4. `docs/SESSION-NOTES.md`:
   - "How the player likes to work";
   - "Picking up";
   - the dated entries, which record every decision in the player's words (the newest are at the
     end of "Picking up", 15 Oct).
5. `docs/DEV-NOTES.md`:
   - "Workflow for every batch";
   - "Test hooks and scripts", with "Helpers to recreate in a new container";
   - "Gotchas";
   - "Where the newer systems live";
   - "Balance reference".
6. `docs/CHANGELOG.md`, the last entries (the newest at the end), and `docs/DESIGN.md` when a
   rule's intent matters.
7. `docs/REPLICATE.md` (19 Oct), when you need today's game (`main` at `4b92446`) in full: every
   rule, number and formula read from its code, the interface, the sound, the assets and the
   checks, written for another agent to rebuild it. Its last section is sealed: the stranger
   minds, the Lattice's story and the endings.

## 3. Where things stand (16 Oct)

- **The new version is done** and up at `/next/` since 14 Oct. It covers the player's nine-part
  request of 13 Oct:
  - the other civilizations playing the same game;
  - the Hunger in diplomacy;
  - war and new units;
  - life after matter, and positronium;
  - films, and the survey reveal;
  - young dwarfs, and charting on the way.

  Since then, at the player's word:
  - harder ("make it harder pls");
  - the stable fate's late game, made a little softer after;
  - ships see what they pass;
  - the dearer Archive;
  - the hulls and all fifteen event plates;
  - the films' second cut;
  - the Degenerate Age's film redone, its first version kept in `src/film/saved/`.
- **15 Oct, four batches** (CHANGELOG, in order):
  - **"The films on a tablet"**: pictures painted in a thread of their own, the music silent
    under the films, a lighter sound.
  - **"The purple oval"**: the grade's lift of the blacks, gone, and the galaxy's own light in its
    place. In both versions (`main` by PR m1omg/Steliterate#31).
  - **"Smoother films in every browser"**: a film keeps time with the sound being heard; its
    vignette and grain are page layers or drawn in the canvas, whichever the device draws quicker;
    the recordings play by their own audio element (no `MediaElementSource`); a lighter reverb. The
    sound went to `main` too, by PR m1omg/Steliterate#32.
  - **"The project check"** (the player: "compacted twice, please, do a comprehensive project
    check to compensate"):
    - everything checked again: the branches, the live builds, every check, and 300 games on each
      version, all game for game as before;
    - today's code read again by two reviewers, every finding confirmed in the code first;
    - six faults fixed, each with a check: a film's clock running on without its sound; the
      canvas's grain moving under reduced motion; a film the painter thread cannot lay out
      waiting for ever; a film's sound able to begin after its screen was gone; the synth's echo
      deaf to the music slider, and a hold cut short; the galaxy's glow in the Dark in the
      enhanced and thermal views;
    - three of them in `main` too, by PR m1omg/Steliterate#33.
- **The switch.** `main` keeps today's game until the player says otherwise ("Not yet", 14 Oct).
  The switch is a PR from `next` into `main`, merged with a merge commit.
  - `main` was merged into the work branch after PR #33 (`9e5907b`, `-s ours`: the work branch's
    tree kept, since `main`'s fixes since the fork were ports of its own).
  - That PR now merges cleanly.
- **Not run in Firefox.** There is none in the container; software-drawn Chromium stood in for it.
  The player said Firefox ran the films "very slow"; their word on it now is the first thing to ask.

## 4. Baselines (20 Oct, after "the game keeps its word")

| | The new version | Today's game (`main`) |
|---|---|---|
| tsc, build | clean | clean |
| Playtest | passes (30/144 Hz parity) | passes |
| savecompat | 8 saves | 6 saves |
| Unit checks | 84 | 53 |
| Browser checks, real fonts | 62 | 54 |
| 300 games (survive / victories / Degenerate turns) | 156 / 65 / 71 | 160 / 81 / 72 |
| 300 games at Harsh | 124 / 35 / 66 | 147 / 62 / 68 |
| 900 games | 444 / 160 / 70 (15 Oct) | 476 / 244 / 71 |

- The new version's 900 by fate (15 Oct): decay 53%, stable 46%, curvature 46%; its 300 on 20
  Oct: decay 82 / 148, stable 44 / 81, curvature 30 / 71. Today's game's 900 by fate: decay 43%,
  stable 69%, curvature 56%.
- With real neighbours, two runs of the same rules can differ by 32 survivors and 37 victories in
  900. Measure a reshuffle before calling a change of that size a cost.
- The full history is in CLAUDE.md and DEV-NOTES, "Balance reference".

## 5. The player (m1omg)

The full picture is in SESSION-NOTES, "How the player likes to work".

- **Language.** They are Slovak, and write in English, often by dictation. Read through misheard
  words ("diploma's screen" meant the diplomacy screen).
- **They play while you work**, on a PC, a phone and a tablet, in Firefox, Chrome and Vivaldi. A deploy must never break an open game or a save. Each report from play is a bug to
  confirm in the code before answering.
- **Physics questions** want the mechanism, the numbers and the dates, and every place the game
  bends physics, said plainly. Offer a fix for a bend; don't make one unasked.
- **Spoiler-light.** Never spoil the Lattice's story or ending, or the stranger minds. Say nothing
  about an age they have not reached unless asked.
- **Saves and seeds are sacred.**
  - Use optional fields only, small counters in `civ.flags`, and `migrate()`.
  - Generation consumes the RNG exactly as before.
  - Both versions' saves are covered by `tools/saves/`.
- **Discuss first** before a Lattice rework, deeper diplomacy, or other civilizations beyond what
  was asked. The Unlit's quest line stays word for word: extend it, never reduce it.
- **"Always. You merge pls."** Once a batch is validated, open the PR into `main` and merge it
  yourself, with a merge commit. A fix for `main` goes on a branch of its own from `main`
  (`claude/<topic>-main`), at their word.
- **Asking.** For a real choice, ask with options, mark one "(Recommended)", and give each a
  one-line consequence. They answer quickly, often adding a condition in their own words: honour
  it exactly. They have also said: "please don't ask me questions unless it's something absolutely
  crucial".
- **Generated music and films are seen or heard before they go in.** Measure music with
  `tools/music/movement.py`, then let them listen. Send films as videos, and the endings only when
  asked.
- **More than one session at a time.** Before anything else, `git fetch` every branch and look
  for pushed commits no PR has taken in: `git log origin/main..origin/<branch>`.

## 6. Waiting for the player, likeliest first

Start none of these without their word.

1. **Firefox now.** How the films and the sound play there after 15 Oct.
2. **The films' second cut.** Sent as videos: the Long Dusk, the Black Hole Age under decay, and
   the Degenerate Age twice.
3. **The switch** from `next` into `main` ("Not yet", 14 Oct).
4. **Left as they are by the project check**, each the player's choice:
   - a slow device steps a film's resolution down and never back up, so a slow first few seconds
     can leave the whole film at half resolution;
   - a build tool, `source-map-js`, has a reported flaw (a slow parse of a hostile source map). It
     is used only to build, never shipped, and nothing here reads one.
5. **Offers of 12 and 13 Oct, no answer yet:**
   - pulsar beams that last far too long, in line with real pulsars or as a stated bend;
   - a rogue world's Coldminds at the dark-sky half upkeep;
   - two rogue-world bends, stated in the Codex or changed (close passes 25 times slower, and
     evaporation casting out about half);
   - the neighbours' new-star rules and the Last Star.
6. **A Slovak translation of our own.** Planned on 10 Oct, not started: a glossary first,
   side-by-side review sheets, all live at once, about 40,000 words (SESSION-NOTES, "Picking up").
7. **Krea, in the player's order:** a second Dark track to replace the old drone (the plates are
   all painted). Measure it and let them hear it before it goes in.
8. **The friend's word on the magnifier mode** (`?lowvision`). Not built: read-aloud, the camera
   from the keyboard, reduced motion for camera flights.
9. **Messages from gone civilizations:** four answers misbehave (SESSION-NOTES). Diplomacy is
   discuss-first.
10. **From 11 Oct, each to raise:**
    - the autoplayer researches Halo Siphons and never shuts them;
    - ember restraint at a halo dwarf;
    - only the Unlit's messages wait.
11. **The discuss-first list** in "Picking up": the Lattice, diplomacy, tidal locking and the
    rest.

## 7. Working in a fresh container

1. Run `npm ci`.
2. Make the local copy of the game's fonts: the layout checks measure text in the real faces only
   with `STEL_FONTS` (DEV-NOTES, "The game's fonts in this container", a curl recipe).
3. Recreate the helpers from DEV-NOTES in the scratchpad: serve the build for one command, 900
   games in three slices with the tally by fate, and compare two runs game for game.
4. **Validate** with the list in CLAUDE.md, in this order:
   1. tsc and the build;
   2. `vite preview` on :4173;
   3. the playtest;
   4. savecompat;
   5. `npm run check` (about two minutes);
   6. `npm run check:browser` with `STEL_FONTS`, about 45 minutes for the 61, with nothing heavy
      beside it.

   For `main`, use a `git worktree` of `origin/main` with `node_modules` symlinked, served on
   :4174.
5. **A rules change:** run 300 and 900 games against the previous rules (a worktree of the old
   commit) and compare game for game. A display-only change must leave all of them identical.
6. **Go live:**
   - the new version: push the work branch, then `git push origin claude/epic-wozniak-lyhulf:next`;
   - `main`: a PR, merged with a merge commit (never squash or rebase: the notes cite commit IDs);
   - then check that the Pages run succeeded, and that each address serves the `index-*.js` of its
     build.
7. **Write it down:** a CHANGELOG entry with the balance figures; DEV-NOTES (systems, checks, a
   balance row); SESSION-NOTES (the decision in the player's words, and "Picking up"); this file;
   CLAUDE.md's PR list.

## 8. Traps that cost time

The full list is in DEV-NOTES, "Gotchas".

- **A container restart stops every background run and server without a word.** The working
  trees survive, the scratchpad too. Check `git status`, the worktrees and the servers first, and
  run again whatever stopped short. It happened on 15 Oct, mid-suite.
- **Long runs need a long background limit** (`timeout` 7200000): the browser suite and the
  preview servers it needs. A background command stops at 30 minutes by default.
- **`pgrep -f` and `pkill -f` match their own shell.** Find a PID with a pattern that cannot
  match itself (`ps -eo pid,args | grep "[v]ite.js preview"`), or by its port.
- **The stop hook** won't let a turn end with uncommitted, untracked or unpushed changes. Keep
  scratch files outside the clone (a worktree's `node_modules` symlink shows as untracked there:
  add files by name).
- **`main` and `next` share one Pages workflow, which builds both.** A push to either rebuilds
  both addresses: keep the two copies of `.github/workflows/pages.yml` the same. `gh-pages` is the
  workflow's own deploy branch, and `claude/lucid-newton-30cbpk` is frozen at `fc6c59a`: never push
  to either.
- **A fix for `main` lands on the work branch as a merge with `-s ours`** once its PR is in,
  after checking that `main`'s side holds nothing the work branch lacks. Then the switch keeps
  merging cleanly.
- **`main` has fewer test hooks than the new version** (`window.__stel`). A check ported to
  `main` may need one added there; its `audio()` was added on 15 Oct.
- **A check about the order of timers, under load:** waits between its steps stretch when the
  page is busy, and it passes on the very bug it was written for. Make the steps that must come
  before a timer synchronous, then wait (DEV-NOTES).
- **The GitHub connector can drop mid-session.** `gh api` through the session's proxy does the
  same work: PRs, merges, workflow runs.
- **`protonFate` is `'decays'`, not `'decay'`.** `tsx` runs a check without type-checking it, so
  run `tsc` too.
- **Worlds in a late save are often rogue already:** a check that means a bound world sets
  `rogue: false` first.
- **An `rm` of a path built from variables** is blocked by a safety check: write `"${VAR:?}"/…`.
- **The software renderer can fall below 10 frames a second under load.** Checks poll until things
  settle; they never trust one fixed wait.
- **Layout checks need the real fonts** (`STEL_FONTS`).
- **Manual and Codex strings are single-quoted:** write ’ in prose, as a straight `'` breaks the
  build.
- **A seeded browser check rides its game's course,** so a rules change can move it. Set the
  situation up rather than hope for it.
- **The player's own saves are not in the repository** and must not be committed. Ask them to
  upload one if you need it.
