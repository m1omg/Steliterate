# Handover: picking up Steliterate

For the next Claude instance (a new session, or the player's other account). First written 11 Oct
("pls make a .md for handover to another claude instance, ill be back dont worry"), rewritten on
the evening of 12 Oct at the end of the next long session ("do an .md for a session handover again
pls"), and brought up to date by the session after it: that evening (a third Dusk track, and a
darker remix of it for the Dark) and on 13 Oct (who a burst reaches; lighter on phones).
This is the entry point. The details stay where they are, and every section says where.

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

## 3. Where things stand (14 Oct)

- **The new version is done, and up** at https://m1omg.github.io/Steliterate/next/ (14 Oct, live
  script `index-B9snKdTy.js`; the
  player's nine-part request of 13 Oct: the other civilizations playing the same game, the Hunger
  in diplomacy, war and new units, life after matter, positronium, films, young dwarfs, charting
  on the way). The approved plan is `docs/plans/new-version.md`; read it before anything else.
  - It is built on `claude/epic-wozniak-lyhulf`. The `next` branch is a copy of it, which the
    Pages workflow builds at `/next/` beside `main` (`.github/workflows/pages.yml`, its copy on
    `next`). After each validated batch: `git push origin claude/epic-wozniak-lyhulf:next`.
  - `main` keeps today's game, and switches only when the player says: a PR from `next`, merged
    with a merge commit.
  - Its saves are its own (`steliterate2.` keys), and since it went up "Saves are sacred" holds
    for them too: `tools/saves/*-next.json.gz`, which `savecompat` loads and plays to the end.
  - Done: its own storage; young glowing dwarfs (1a); the civilizations playing the same game
    (2a-0 to 2a-6); the Hunger among them (2b); war, units and conquest (2c); the AI's judgement
    (2d); life after matter and positronium (3-0 to 3-5); harder ("make it harder pls", 14 Oct:
    an empty reserve costs the dark's Continuity twice as much, Error-Correction Arrays keep only
    their own settlement, a swarm's part whose ship is gone goes on to the ship's nearest
    settlement); the stable fate's late game (3-6) and the look of what is not matter (3-7); the
    films and the survey reveal (Part 4); `/next/` (Part 5).
  - Done since, at the player's word (14 Oct): ships see what they pass (1b; its seeming cost
    is the harness's noise, CHANGELOG), the Archive of Everything dearer (the Quiet Lattice),
    the new hulls in their own paint, all fifteen event plates, the stable fate a little softer
    (46% of its games survive), all sixteen films rebuilt ("the films, second cut"), and `main`'s
    Pages workflow building `/next/` too (PR m1omg/Steliterate#30, `3a3f4c2`).
  - Waiting for the player: their word on the films' second cut (sent as videos: the Long Dusk,
    the Black Hole Age under decay; the endings only when asked), switching `main` to the new
    version ("Not yet", 14 Oct), and the open threads (section 8).
- **The backup** (13 Oct, PR m1omg/Steliterate#28, `db34424`): today's game, frozen and playable,
  at https://m1omg.github.io/Steliterate/archive/2026-10-13/ (`public/archive/`, with its own
  README), on the same origin and so with the player's current saves. Its source is
  `github.com/m1omg/Steliterate/archive/4aaaa2a996b5d4bd62587931737858d76b7f8706.zip`. The same
  PR put the positronium bend in the Codex (Chiba & Sugiyama 2004); the live script is
  `index-DZiWCpcP.js`.
- **`main` and the live game:** as of PR m1omg/Steliterate#27 (13 Oct): a burst reaches only what
  is still there (a rule), and lighter on phones and tablets (section 6). The live script is
  `index-B4EKBtSN.js` (check it on the live page after the Pages run). Before it, PR
  m1omg/Steliterate#26 (`a16d43b`), a darker remix of the Dusk's third track for the Dark, and PR
  m1omg/Steliterate#25 (`3f927a4`), the third Dusk track, changed no rule; PR m1omg/Steliterate#23
  (`a083698`) was the batch of rogue worlds, black holes by lifetime and the late sky.
- **12 Oct, in order** (all from `claude/affectionate-johnson-qqr7p2`, each merged with a merge
  commit):
  - PR m1omg/Steliterate#16 (`3538f47`): the Last Star shines when it lights; its clock is free.
  - PR m1omg/Steliterate#18 (`1c1b77e`): a second Dark track; PR m1omg/Steliterate#20 (`779803d`)
    took it out again ("monotonous AF") and added `tools/music/movement.py`.
  - PR m1omg/Steliterate#21 (`84bc90b`): The Embers Dim only while the halo thins.
  - PR m1omg/Steliterate#22 (`af0b58b`): Export all saves.
  - PR m1omg/Steliterate#23 (`a083698`): the batch in section 6.
  - PRs #17 and #19 were notes only, and PR #24 this handover; PR #14 and #15 (11 Oct) were the
    first handover and the Last Star's plan.
  - That evening, from `claude/epic-wozniak-lyhulf`: PR m1omg/Steliterate#25 (`3f927a4`), a third
    track for the Dusk, and PR m1omg/Steliterate#26 (`a16d43b`), a darker remix of it for the Dark;
    then, 13 Oct, PR m1omg/Steliterate#27 (section 6).
- **Branches:**
  - `claude/epic-wozniak-lyhulf` carries the new version, pushed and not merged (above): never
    restart it from `main`.
  - `claude/lucid-newton-v2` and `claude/affectionate-johnson-qqr7p2` are fully merged. A
    follow-up on one of them starts it again from `main` (`git checkout -B <branch> origin/main`).
  - `claude/lucid-newton-30cbpk` is the old live branch, frozen at `fc6c59a`. Pages builds it
    too: never push to it.
- **The claude.ai artifact** has not been updated since 28 Sep. GitHub Pages is the live build.
- **The player's game** (12 Oct): turn 204, η 90.9, the Black Hole Age, a fate other than stable
  matter. The Aeon Seed is complete (2,122 of 1,700) and waits for the Heart to evaporate, about
  five turns on; its card now says so. Their next turn after the deploy brings The Widest Atoms
  (positronium). Their main game's turn-151 save is the old timeline of the Last Star (it lit and
  went out in turn 139); they chose to replay from their turn-137 save instead.
- **The player's own saves are not in the repository,** and must not be committed. They uploaded
  a turn-77 save (9 Oct), a turn-134 save (11 Oct), and turn-137 and turn-151 saves (12 Oct) to
  earlier sessions. Ask them to upload one again if you need it.

## 4. The player (m1omg)

The full picture is in SESSION-NOTES, "How the player likes to work".

- **Language and dictation.** They are Slovak, and write in English, often by dictation. Read
  through mis-heard words: "diploma's screen" meant the diplomacy screen.
- **They play while you work,** and keep playing between batches, on a PC and a phone. A deploy
  must never break an open game or a save. They report from live play, often with screenshots;
  each report is a bug to confirm in the code before answering.
- **Questions about the game's physics** ("how do neutron stars currently evolve?", "can the
  burst be captured?") want the mechanism, the numbers and the dates, and every place the game
  bends physics, said plainly. Offer a fix for a bend; don't make one unasked.
- **Spoiler-light answers.** Never spoil the Lattice's story or ending, or the stranger minds. Say
  nothing about an age they have not reached unless asked. (They are in the Black Hole Age now.)
- **Saves and seeds are sacred.** Use optional fields only, small counters in `civ.flags`, and
  `migrate()`. Generation consumes the RNG exactly as before.
- **Discuss first** before a Lattice rework, deeper diplomacy, or other civilizations beyond what
  was asked. The Unlit's quest line stays word for word: extend it, never reduce it.
- **"Always. You merge pls."** Once a batch is validated, open the PR into `main` and merge it
  yourself, with a merge commit. "go ahead, ship it" (12 Oct) is that, for the batch in hand.
- **Asking.** For any real choice, ask with options, mark one "(Recommended)", and give each a
  one-line consequence. They answer these quickly, and often add a condition in their own words:
  honour it exactly.
- **Generated music is heard before it goes in.** On 12 Oct a Dark track went live that my own
  measure had called a drone, and they found it "monotonous AF". Measure with
  `tools/music/movement.py`, then let them listen first (DEV-NOTES, "Music tooling").
- **More than one session at a time.** On 11 Oct one session stopped mid-validation with its work
  pushed but not merged; the other finished it. So, before anything else:
  - `git fetch` every branch;
  - look for pushed commits no PR has taken in (`git log origin/main..origin/<branch>`);
  - finish or ask.
- **They test other AI models** with open briefs of this kind of game (12 Oct: "a detailed but
  open summary … leave many things open to the model"). One was written in that conversation; it
  is not in the repository.

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
   - `vite preview` on :4173 (a background command stops at its time limit, two hours at most:
     start it again if a long run still needs it);
   - the playtest;
   - savecompat;
   - `npm run check` (unit, about two minutes);
   - the browser checks with `STEL_FONTS` (about 45 minutes for the 50; run nothing heavy
     beside them).
5. **A rules change:** run 300 and 900 games against the previous rules (a `git worktree` of
   `main`, or a snapshot of the tree), and compare game for game:
   - symlink `node_modules` into it;
   - a display-only change must leave all 900 identical.
6. **Go live:**
   - push the work branch;
   - open a PR into `main` and merge it with a merge commit (never squash or rebase: the docs
     cite commit IDs);
   - check that the Pages run succeeded (the GitHub tools' workflow runs for `main`);
   - check that the live page loads the same `index-*.js` as your build.
7. Write it down: a CHANGELOG entry (with the balance), DEV-NOTES (systems, checks, a balance
   row), SESSION-NOTES (the decision in the player's words, and "Picking up"), and this file.

## 6. The latest work (12 and 13 Oct)

- **A burst reaches only what is still there** (PR #27, 13 Oct; CHANGELOG under that name). The
  player: rogue planets "are no longer bound so should not get destroyed OR any benefit from a
  BH/stellar remnant evaporation flash, so only Deep settlements would benefit or be destroyed (or
  bound planets…)", and "By distance". A neutron star's burst (curvature, η 68) destroys only what
  is in its Deep or on a world it still holds; Burst Catchers elsewhere bank 250 within 10 ly of the
  nearest burst, then by the inverse square, once each, never on a rogue world; a black hole's final
  burst pays its Deep and the worlds it held until then (`inItsSystem`, `burstShare`,
  `finalBurstCatch`). Harness: 154 / 72 / 72 in 300, all 300 as before; 896 of 900 as before.
- **Lighter on phones and tablets** (PR #27; CHANGELOG under that name). "Everything" felt slower
  on their phone and tablet, "even the audio stuttered and had crackles". Seven builds since 29 Sep
  measured on an emulated phone: nothing in the code grew heavier (DEV-NOTES, "Profiling as a
  phone"). Gone, unseen and unheard: the synth's drone running under every recording (the likeliest
  cause of the crackles), the unused multisampled canvas, the idle labels' layout. Chosen: no panel
  blur on a touchscreen, and touch devices start at medium graphics (a saved high moves once,
  unless picked by hand). A 60 fps cap on 120 Hz screens was offered and not taken.
- **Answered on 13 Oct** (no change made): the Slovak glossary does not exist yet (the plan's first
  step); reading on life and computation after the protons (the list is in SESSION-NOTES); why the
  dwarfs are cold at the start (`formedAt`: as many formed in each tenfold of time, so 99% are older
  than 10^13 years; the fresh ones are the red dwarfs dying during the Dusk).

- **The Last Star** (PR #16): it lights as its turn ends and burns through the next; its event,
  Light in the Halo, offers keeping time with it, free at any pace. Old saves relight it where it
  went out too soon. CHANGELOG, "The Last Star shines when it lights".
- **The Embers Dim** (PR #21) comes only while the halo thins (η 22.3 to 25, by the halo's clock);
  it had told a game at η 35.9 that the long-spent halo was running thin.
- **Export all saves** (PR #22): one file with every slot, the quick save and the autosave;
  Import save file reads it back, each save as a slot.
- **The Black Hole Age batch** (PR #23), from the player's game (CHANGELOG, "Rogue worlds leave
  their star behind"):
  - a world flung loose from its star builds nothing in the Deep, gets nothing from what it built
    there, and its Hearth no longer feeds on a hole it has left (Stellar Lifters did work there);
  - a ● Black holes tab (Systems, Black Hole Age), the longest-lasting first, and an Evaporates
    row in a hole's panel; Lasting at a hole counts to its evaporation (it read ∞);
  - brown dwarfs described by what warms them; cold brown dwarfs and spun-down neutron stars grey
    after the Dusk (they glowed the same in every age); masses in figures;
  - a finished Great Work cannot be resumed (the autoplayer resumed one every turn);
  - positronium (η 85) is news, once, where matter decays or is unmade.
- **Answered after it** (no change made): how neutron stars evolve in the game, by age and fate;
  whether a neutron star's burst can be caught (no: everything at the star is lost, about 10⁴² J).
- **A third track for the Dusk** (PR #25, that evening). The player bought Krea credits; the Dark
  track that moves, made from the prompt in DEV-NOTES, went to the Dusk at their word, as Recorded
  III ("that track sounds good but tbh belongs in Dusk … for Dark a darker remix of it may be
  good"). The remix was made here, `tools/music/darken.py` (Krea takes words only), and went to
  the Dark as its Recorded II once they had heard it ("add em yes pls", PR #26); `loop-track.py`
  reaches further into a long tail on request. CHANGELOG, "A third track for the Dusk" and "A
  darker remix of it for the Dark".

## 7. The baseline (12 Oct, rogue worlds leave their star behind)

**Checks** (13 Oct, PR #27):
- tsc and the build are clean;
- the playtest passes (30/144 Hz parity);
- all 49 unit checks pass;
- savecompat passes on the 6 saves in `tools/saves/`;
- all 51 browser checks pass, in the real fonts.

PR #27's burst rule left the totals as they were: 300 games all as before, 896 of 900 (the 4 that
moved are curvature games with the same outcomes).

**Harness (standard competent):**

| | Survive | Victories | Degenerate Age |
|---|---|---|---|
| 300 games | 154 | 72 | 72 turns |
| 900 games | 456 | 203 | 71 turns |

- By fate, survivors in the 900: decay 189 of 450, stable 168 of 239, curvature 99 of 211.
- 406 of the 900 play out as with The Embers Dim only while the halo thins (157 / 69 / 72 and
  449 / 202 / 70); the outcomes that moved went both ways.
- Noise is ±12 in 300 games; two runs of 900 can differ by 30.
- The history is in DEV-NOTES, "Balance reference".

## 8. Open threads, likeliest first

Wait for the player's word before starting any of them.

0. **Offers put to the player on 12 and 13 Oct, no answer yet** (each a rules or text change: the
   harness, and a check):
   - **Pulsar beams last far too long.** Neutron stars beam (×0.1 to collectors, Beam Arrays) all
     through the Dusk and fade only by η 27; real pulsars stop within 10⁷ to 10¹⁰ years of forming.
     Asked whether to bring them in line (it takes that light out of the Dusk) or keep it as a
     stated bend.
   - **A rogue world's Coldminds** pay full upkeep, though it has no sun at all (the dark-sky half
     applies only where the star gives no light).
   - **Two rogue-world bends** to state in the Codex, or to change: close passes strip worlds 25
     times more slowly than the physics says, and galactic evaporation casts out about half of the
     remnants where the Codex says "most". (The outliers' own evaporation: "Leave it".)
   - **The neighbours' new-star rules** (sleepers waking for a new star, claims) leave the Last
     Star out.
   - **The positronium bend** (13 Oct): the game has positronium form at η 85; with a cosmological
     constant like ours it may never form (Chiba & Sugiyama 2004, astro-ph/0405273). A Codex line
     saying so was offered.
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
4. **Krea, in the player's order:** a Dark track that moves, then the event plates
   (`docs/plans/plates.md`: all fifteen painted, 14 Oct), then a second Dark track to replace the
   old drone (next, at the player's word). Each
   track measured and heard by the player before it goes in. The arranged Canon stays; Krea cannot
   make a real one. The player bought credits on the evening of 12 Oct: the first track went to the
   Dusk (PR #25), and a darker remix of it to the Dark (PR #26, made locally with
   `tools/music/darken.py`). Next: the plates.
5. **The discuss-first list** in "Picking up": the Lattice, diplomacy, tidal locking and the rest.
6. **From 11 Oct, each to raise with the player:**
   - **The autoplayer researches Halo Siphons** (its fallback ignores `noAuto`) in half the
     harness's games, and never shuts them. Changing that moves the harness.
   - **Ember restraint** (×0.75) still applies to all the light at a halo dwarf, a world falling
     in included, while the siphons double only the dark matter.
   - **The harsher swarm version:** a part whose ship is gone goes on to our nearest settlement.
     Done in the new version (14 Oct, "make it harder pls"); `main`'s game keeps the gentler one.
   - **Only the Unlit's messages wait.** Another mind's first message still lapses after 8 turns
     (`minds.ts`, `slow_first`); the same fix would apply (`waitsForAnswer` in `signals.ts`).

## 9. Traps that cost time

The full list is in DEV-NOTES, "Gotchas".

- **`protonFate` is `'decays'`, not `'decay'`.** `newGame({ protonFate: 'decay' })` silently gets
  the seed's own fate. `tsx` runs a check without type-checking it: run `tsc` too.
- **Worlds in a late save are often rogue already** (close passes): a check that means a world
  still bound to its star sets `rogue: false` first.
- **`pgrep -f` and `pkill -f` match their own shell.** Find a PID with a pattern that cannot
  match itself (`ps -eo pid,args | grep "[v]ite.js preview"`), or by its port. A wait loop on
  `pgrep -f` never ends (13 Oct): wait for the run's output file instead.
- **An `rm` of a path built from variables** is blocked by a safety check. Write
  `"${VAR:?}"/…` so an empty variable stops the command.
- **The stop hook** won't let a turn end with uncommitted, untracked or unpushed changes. Keep
  scratch files outside the clone.
- **A push runs the Pages workflow of the branch pushed.** Since PR m1omg/Steliterate#30 (14 Oct)
  `main` and `next` carry the same one, which builds both: a push to either rebuilds the root and
  `/next/`. Keep the two copies the same; check `/next/` after any merge into `main`.
- **The harness's noise is larger with real neighbours.** Two runs of the same rules (the
  neighbours' streams reshuffled) differ by up to 32 survivors and 37 victories in 900. Measure
  a reshuffle before calling a change of that size a cost (DEV-NOTES, "Workflow for every
  batch").
- **A container restart** stops background runs without a word, and the session can resume in a
  new one with the working tree kept: check `git status` and the servers first. If an output
  stops short, run it again.
- **Under load the software renderer** can fall below 10 frames a second, and the frame time is
  capped at 0.1 s. Checks poll until things settle; they never trust one fixed wait.
- **Layout checks need the real fonts** (`STEL_FONTS`). Fallback faces measure shorter lines, and
  a panel can pass there and fail for the player.
- **`state.eta` is not always `log10(state.years)`.** Use `state.eta` itself where a test switches
  clocks.
- **Manual and Codex strings are single-quoted.** Write ’ in prose: a straight `'` breaks the
  build.
- **A seeded browser check** rides its game's course, so a rules change can move it. Set the
  situation up rather than hope for it.
