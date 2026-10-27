# Developer notes

How to work on Steliterate. The stack is Vite 8, TypeScript 7, Preact with signals, and
three.js 0.186. Design is in `DESIGN.md`, history in `CHANGELOG.md`, and decisions in
`SESSION-NOTES.md`.

## Workflow for every batch

1. **Develop** on the session's work branch. Going live (since 9 Oct): a PR from it into `main`,
   merged with a merge commit, which I open and merge myself once the batch is validated (the
   player: "Always. You merge pls."), so the commit IDs cited here stay valid (PR
   m1omg/Steliterate#1 merged the game as `3e913f3`, PR m1omg/Steliterate#3 the next batch as
   `0e08054`, PR m1omg/Steliterate#4 the magnifier mode as `d9bd6e5`). Pages builds `main` and
   `claude/lucid-newton-30cbpk` alike, and the last push wins: the old live branch now lags
   `main`, so never push an older commit to it. A direct push to a live branch can be refused as
   a production deploy; the PR merge, asked for, is the way. Step 3 has the details.
2. **Validate:**
   - `npx tsc --noEmit -p .`
   - `npm run build`
   - `node tools/playtest.cjs http://localhost:4173/ <shots dir>`, which needs `vite preview`
     on :4173. It must end with "ALL CHECKS PASSED", including the 30/144 Hz parity check.
   - If rules changed: `npx tsx tools/sim.ts 300 standard competent`. Count outcomes with
     `grep -oE "^seed [0-9]+: [A-Z]+" | awk '{print $3}' | sort | uniq -c`. Survival is
     ENDURANCE + VICTORY; noise is about ±12 per 300 games. For a closer call, compare 900 games
     against a `git worktree` of HEAD (symlink `node_modules` into it). `--asleep` plays the
     neighbours as they were before the new version (`civsAsleep`): with it, a change that should
     leave our own play alone must leave the games line for line as they were. `tools/sim.ts 300
     standard lattice` plays us led by the Lattice, as the Tessellate plays (`ourWay` in `auto.ts`).
     With real neighbours the noise is larger (14 Oct): the same rules with only the neighbours'
     streams reshuffled (`foundCiv`'s `civ.rng` seeded under another key, in a worktree) move
     900 games by up to 32 survivors and 37 victories, and only about a third end the same way.
     Before calling a change of that size a cost, run such a reshuffle of the rules before it.
   - End Turn as a phone feels it: `node tools/turn-timing.cjs http://localhost:4173/ [turns=40]
     [slowdown=4] [seed=8919]` (Chromium with the CPU slowed, the End Turn button itself, the
     longest task of each turn as `PerformanceObserver` reports it).
   - Save compatibility: `npm run savecompat` loads every save in `tools/saves/` through
     `readSave` → `migrate`, checks the round trip, and plays each to the end. It must end with
     "SAVE COMPAT OK". The saves: the 71-turn save from `551fb1a`, and four from the week of
     2 Oct (seed 1000, all in the Degenerate Age): `4fe2404` turn 87 with a star clock running,
     `7d0806d` turn 85, `9eea773` turn 119 just after a white-dwarf merger and turn 120 with a
     helium giant lingering; and since 12 Oct `98139af` turn 121 (seed 1000 moved to η 26, made with
     that commit's code: the Last Star lit and out within its turn, which a load lights again). To
     try one in the browser, gunzip it and paste the JSON into Load / import → "Load from a save
     code".
   - Checks: `npm run check` (unit checks, about 15 s) and, with `vite preview` running,
     `npm run check:browser -- http://localhost:4173/` (browser checks, about 10 min). Both must
     end with "ALL CHECKS PASSED". See Test hooks and scripts.
3. **Commit and go live:**
   - Commit with the attribution lines and `git push -u origin <the session's work branch>`.
   - Open a PR from that branch into `main` and merge it with a merge commit (never squash or
     rebase).
   - The Pages workflow (`.github/workflows/pages.yml`) builds and force-pushes `dist/` to
     `gh-pages`. It runs on every push to `main` or `claude/lucid-newton-30cbpk`.
   - Leave `claude/lucid-newton-30cbpk` alone. It stays at `fc6c59a`, behind `main`, and pushing
     anything older than `main` to it would put that older build live.
   - Then check that the Pages run succeeded, and that the live page loads the new script (a
     minute or two after the run). The second command must print the same name as
     `ls dist/assets`:
     ```sh
     gh api "repos/m1omg/Steliterate/actions/runs?branch=main&per_page=3"
     curl -s https://m1omg.github.io/Steliterate/ | grep -o 'index-[^"]*\.js'
     ```
   - Once merged, a follow-up batch starts again from `main` on the work branch
     (`git fetch origin main && git checkout -B <branch> origin/main`): a merged PR is finished,
     and takes no new commits.
4. **The artifact is stale** (not updated since 28 Sep): GitHub Pages is the live build. The
   artifact (https://claude.ai/artifact/BWqtVocJezc4XXmnNgWZzc) belongs to the organization the game was
   built in, and a session in another organization can read it but not update it (seen 28 Sep).
   To publish one again, run `node tools/make-artifact.mjs` (it writes `dist/artifact.html` and
   prints its files), then:
   - publish a new artifact, with the new `assets/index-*.js` (and the CSS, if its hash changed)
     and any new public files such as `music/canon.mp3`, and record its URL here;
   - when updating one, set the old hashes to `null`, and omit `capabilities` so the stored
     `downloads` capability carries forward.

## Test hooks and scripts

- **`window.__stel`** (in `src/main.tsx`):
  - `newGame(opts)`
  - `endTurns(n, auto, keep)`, which autoplays and **clears pending events** (to test events, click
    `.endturn` instead); with `keep` they wait for the autoplayer to answer next turn, as in the
    harness, so a game plays out as `tools/sim.ts` plays it
  - `autoPlay()`: the autoplayer's choices for one turn (it answers waiting events too), without
    ending it, so a check can then press `.endturn` on a game played as the harness plays it
  - `orderFleet`
  - `select(kind, id)`
  - `refresh()`, which calls `bump()`
  - `state()`
  - `engine()`
  - `music()`: the music player (its `layer`: the synth `bus`, `silenced`, and the `track`
    element playing), for `browser/music-hidden`
  - `notify(text, kind)`: a message as the game shows them (`browser/lowvision`: how long one
    stays)
  - `films(on)` (null: as the settings say), `filmList()`, `filmFrames(id, times, w, h)`: the
    films, for `browser/films`; `filmTimes()`: the last frames played, as [film time (s), the
    frame's time (ms)]; `filmOverlays()`: the last trial of where the vignette and grain go;
    `filmChange(id, t1, t2, args)`: how much a frame changes between two moments (the mean
    difference of its pixels' channels), and `askPainter(job)`: the painter thread's first answer
    to a job (the project check, 15 Oct)
  - `setVolumes(music, sfx)` (0..1, as the sliders, for this page only), `sfx(name)` and
    `audio()` (the sound's graph): for `browser/music-route` (and `browser/films`, the music's
    gain under a film)
  - `slowSlices(ms)`: every slice of End Turn's turn made to take at least that long, a slow phone
    on any machine (`browser/turn-slices`; a CPU slowed through CDP is paused in windows, so one
    turn's length there is anyone's guess)
  - `lastTurn()`: the last End Turn's own work, its longest run without a breath, and its length
- **Playwright:** `require('/opt/node22/lib/node_modules/playwright')`. Launch with
  `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`, and add
  `--autoplay-policy=no-user-gesture-required` for music tests. Watch `request` events for
  `music/…` to see which track loads.
- **Headless sim checks:** `npx tsx script.ts`, importing from `src/game/...` (`newGame`,
  `endTurn`, `autoPlay`). `autoPlay` answers events itself: it takes the first allowed choice
  that isn't tainted.
- **Checks** (`tools/checks/`, since 7 Oct; before then they lived in the ephemeral scratchpad):
  - `unit/*.ts`: rules checks run with tsx, one per change (accord, boil, castout, clock,
    cold-energy, cooling, dismantle, evap, fates, flash, flow, focus, follow, neighbours,
    old-saves, pace, quake, quick, refuge, refund, repeal, rogue, spare, claims, war, ways,
    beacon, dealings, terraform, twilight, icy, scorch, worlds, deadworlds, outer, attack, clocks, settled, curvature, hunt, siphons, last-star, embers-dim, rogue-reach, great-works, late-sky, burst-reach, young-dwarfs, civs, civ-turns, rulebook-lint, others, ties, lattice-search, minds, slices, hunger-judgement, hunger-trade, just-cause, battle-roles, civ-war, conquest, desperate-war, end-of-matter, forms, lattice-energy, passage, starving-cool, thinning, leave-hole, horizon-form, positronium, continuity, stable-dark, promises, fall-in, unwritten, slow-ones, falling-flash, hole-worlds), plus `invariants` (12 whole games checked every turn: no NaN, no negative stocks or
    people, no settlement on a vanished world unless decay-proof, survivors' health within
    0..1; `npx tsx tools/checks/unit/invariants.ts 100` for more) and `determinism` (a save code
    and a clone play on identically to the original). They import `check`, `near`, `done` and
    `loadSave` (a save from `tools/saves/`) from `tools/checks/lib.ts`, and copy a state with
    `copyState` (`save.ts`), never a plain JSON copy (it loses `state.civ`, see Gotchas). `tsc` checks them, so
    they must type-check cleanly: the Pages build runs `tsc`.
  - `browser/*.cjs`: interface checks against a served build, each opening its own page through
    `start()` in `tools/checks/lib.cjs` (which waits for the server; any console error fails the
    check) and ending with `finish()`. Screenshots go to `playtest-shots/checks/<name>/`, or the
    folder given as the second argument. `ck.phone(w, h, query)` opens a page with a touchscreen
    (`mobile` uses it; CDP `Input.dispatchTouchEvent` for long presses and drags).
  - **The game's fonts in this container:** the headless browser cannot reach Google Fonts
    (the proxy's certificate), so text is measured in fallback faces, which are wider. With
    `STEL_FONTS=<dir>`, `lib.cjs` serves them from a local copy. Make one with curl, which checks
    the certificate properly (never turn off TLS checks in the browser instead):
    ```sh
    D=$SP/fonts; mkdir -p $D/files
    URL=$(grep -o 'https://fonts.googleapis.com/css2[^"]*' index.html | sed 's/&amp;/\&/g')
    curl -sS -A "Mozilla/5.0 Chrome/130.0" "$URL" -o $D/fonts.css
    grep -o 'https://fonts.gstatic.com/[^)]*' $D/fonts.css | sort -u | while read u; do
      curl -sS "$u" -o "$D/files/$(echo "$u" | sed 's#https://fonts.gstatic.com/##; s#/#_#g')"; done
    ```
    `mobile` measures the rail's names only when the fonts are there (it says so otherwise).
  - `run.mjs unit|browser|all [url] [out] [names…]` runs them (unit checks several at a time,
    browser checks one at a time) and prints a summary; `npm run check` and
    `npm run check:browser` call it. Name some to run only those:
    `node tools/checks/run.mjs unit clock evap`.
  - **Profiling as a phone** (13 Oct): Playwright with `viewport` 390×844, `deviceScaleFactor` 3,
    `isMobile` and `hasTouch`, and CDP `Emulation.setCPUThrottlingRate` 4. At that size the
    software GPU here draws 2 to 3 frames a second, so frame rates measure SwiftShader, not the game:
    swap `engine.post.composer.render` for a no-op to see the main thread's own work (CDP
    `Performance.getMetrics`: `ScriptDuration`, `RecalcStyleDuration`, `LayoutDuration`, per
    frame), and count draw calls with `renderer.info.autoReset = false` around one `engine.frame`.
    Several builds compare side by side: one `git worktree`, `npx vite build --outDir <dir>` per
    commit, `vite preview --outDir <dir>` on a port of its own. To compare pixels, freeze one page
    (`engine.stop()`, then `engine.now`, `galaxy.time`, `system.time`, `system.orbitTime`) and read
    back with `gl.readPixels` straight after `engine.frame(0)`; two loads never match (the sky and
    the fleets' timings differ per load), so compare within one page. The figures of 13 Oct are in
    the CHANGELOG ("Lighter on phones and tablets").
  - A new rule or fix gets a check here. One-off investigations (traces, censuses) stay in the
    scratchpad.
- **A background command stops after 30 minutes** unless it is given a longer limit (14 Oct): start
  `vite preview` in the background with the longest one (two hours), or the browser suite, about
  45 minutes now, loses its server partway and every check after that fails at once ("no server").
  Stop it with `pkill -f "vite prev[i]ew"`: the bracket keeps the pattern from matching the shell
  running the command, which a plain `pkill -f "vite preview"` kills along with it.
- **The container is ephemeral.** Anything installed with pip is gone next session: numpy,
  scipy, matplotlib, imageio-ffmpeg (ffmpeg binary at
  `/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2`).
  So is `art-src/` (ignored by git): the graded files in `public/art/` are the only copies of
  the plates and sprites, so new art needs new source images.
- **Helpers to recreate in a new container** (9 Oct). They lived in the session's scratchpad,
  which a new session or account does not have. Write them to the new scratchpad (`$SP` below
  stands for its path) and run them from the clone.
  - **Serve the build for one command** (`sh $SP/withserver.sh <command…>`): it serves `dist/` on
    :4175, runs the command, and stops the server by its PID.
    ```sh
    #!/bin/sh
    node node_modules/vite/bin/vite.js preview --port 4175 --strictPort > "$(dirname "$0")/preview.log" 2>&1 &
    PID=$!
    for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:4175/ && break; sleep 0.5; done
    "$@"; CODE=$?
    kill $PID 2>/dev/null; wait $PID 2>/dev/null
    exit $CODE
    ```
    For example: `sh $SP/withserver.sh node tools/checks/run.mjs browser http://localhost:4175/ $SP/shots`.
  - **900 games in three slices at once**, then the tally overall and by fate
    (`sh $SP/harness900.sh <tree> <absolute out dir>`). The tree is the clone, or a `git worktree`
    of the commit to compare with (symlink `node_modules` into it). `m0.txt` holds the first 300,
    the same games as `tools/sim.ts 300 standard competent`. The tally is the clone's, as a commit
    from before 7 Oct has no `tools/tally.sh`.
    ```sh
    #!/bin/sh
    TALLY=$(pwd)/tools/tally.sh; TREE=$1; OUT=$2
    mkdir -p "$OUT"; cd "$TREE" || exit 1
    for i in 0 1 2; do npx tsx tools/sim.ts 300 standard competent --from=$((i*300)) > "$OUT/m$i.txt" 2>&1 & done
    wait
    cat "$OUT/m0.txt" "$OUT/m1.txt" "$OUT/m2.txt" > "$OUT/m900.txt"
    for f in decay stable curvature; do grep "fate $f " "$OUT/m900.txt" > "$OUT/m900-$f.txt"; done
    sh "$TALLY" "$OUT/m0.txt" "$OUT/m900.txt" "$OUT/m900-decay.txt" "$OUT/m900-stable.txt" "$OUT/m900-curvature.txt"
    ```
  - **Compare two runs game for game** (`python3 $SP/cmp.py <before.txt> <after.txt>`): how many
    games ended exactly alike (the time each took left out), and which outcomes moved. A display
    change must leave all 900 alike; a rules change shows what it moved.
    ```python
    import re, sys
    def load(p):
        d = {}
        for line in open(p):
            m = re.match(r'seed (\d+): (\w+) ', line)
            if m:
                d[m.group(1)] = (m.group(2), re.sub(r'\| \d+ms\s*$', '', line.strip()))
        return d
    a, b = load(sys.argv[1]), load(sys.argv[2])
    same = sum(1 for k in a if k in b and a[k][1] == b[k][1])
    moves = {}
    for k in a:
        if k in b and a[k][0] != b[k][0]:
            key = f'{a[k][0]} -> {b[k][0]}'
            moves[key] = moves.get(key, 0) + 1
    print(f'{len(a)} games, {same} identical')
    for k, v in sorted(moves.items(), key=lambda x: -x[1]):
        print(f'  {k}: {v}')
    ```
  - **A second build on its own port**, to compare two versions in the browser:
    `npx vite build --outDir $SP/dist-b`, then `npx vite preview --outDir $SP/dist-b --port 4176`.
- **Plates for the ways of life** (`public/art/way_<way>.webp`): garden, upload, chorus and
  dormant (29 Sep, Nano Banana Pro via Krea at 2K, 16:9, about 111 units each); lattice (the
  Tessellate) and fork (Codex, below). `wayArt` in `src/ui/labels.ts` picks the plate (the
  generic `survivor` for any way added without one); shown in `Signals.tsx` cards and the system
  panel's Others section, once in contact. The chorus came with painted letterbox bars, cropped
  (152 and 151 px of 1536) before grading; the Tessellate's painted signature is softened
  (`SOFTEN` in `tools/process-art.mjs`). Prompts in the style of the others: "A civilization …:
  <scene>. Painterly digital painting, dark and grainy, muted <palette>, soft brushwork,
  cinematic composition. No text, no letters, no signatures." The Tessellate's came from the
  Lattice's public blurb only: "the whole surface of a dark, airless moon tiled in vast
  hexagonal plates of machinery … maintenance drones crawling along the seams … no people
  anywhere … a dim brown dwarf, a dull, faint red-brown disc".
- **Event plates** (`public/art/events/<plate>.webp`, 29 Sep, Codex): an event with `plate` in
  `src/game/data/events.ts` shows its own painting over its era's (`Plate` in `Story.tsx`; the
  era's stays underneath as the fallback). 16 so far: the Dusk's dynamo_fails, first_night,
  last_rain, sea_freezes, mantle_settles, comet, who_sleeps_first, prophet_of_stillness,
  first_upload; the Degenerate Age's new_star, white_fire, supernova, cast_out, unmoored,
  world_falls; the Black Hole Age's final_burst. `node tools/process-art.mjs events` grades
  `art-src/events/*.png`. Left on their era's art on purpose: events whose picture would give
  something away (the Lattice's, the stranger minds', the Dark's), and abstract ones. Checked by
  eye: the comet's tail must point away from its sun (the first try pointed it back toward it);
  the Prophet's banner emblem looked like a known game logo and is softened.
- **Ship hulls** (`public/art/ships/<look>.png`): `fleetLook` in `src/game/data/ships.ts` picks
  one per fleet (its heaviest warship, else its first settler, else its tender); `lookRole`
  keeps the map glow by role. The Ark ('settler'), Probe, Warden ('war') and hauler ('other')
  are from Higgsfield; the System Lighter, Seedcore, Lattice Spore, Vault Ship, Aegis and Swarm
  Tender from Codex (29 Sep). `tools/process-sprites.mjs` cuts them from flat black: only the
  dark region connected to the edges is background, so dark parts inside a hull stay solid.
- **Codex for images** (29 Sep; the player has a ChatGPT subscription, so it needs no credit):
  `npm install -g @openai/codex` (if the platform binary is missing, reinstall with
  `--include=optional`), then `codex login --device-auth` and the player enters the code at
  auth.openai.com/codex/device (the login lives in `~/.codex/`, so a new container needs it
  again). Run each batch as one plain command, which the player's permission rule
  `Bash(codex exec *)` covers:
  `codex exec --skip-git-repo-check -s workspace-write -C <scratch dir> -i <style ref> -o <last.txt> - < prompt.txt`
  (the prompt comes from stdin: `-`; put `-i` before `-o`, or `-i` takes the `-` as a second
  image). The prompt asks for one built-in image call per file and a file name for each; Codex
  saves to `~/.codex/generated_images/…` and copies them over. About a minute an image, two
  batches at a time. A graded plate of ours attached as a style reference (`-i`) keeps the
  painted look (without one the result looks like a 3D render); the era's plate for its events.
  Sprites: "square, one ship from directly above, bow up, flat pure black background", with the
  four old hulls attached.

## Gotchas

- `src/ui/screens/Manual.tsx` strings are single-quoted: use typographic apostrophes (’) in
  prose. A straight `'` breaks the build; it has happened twice.
- Components that read mutable game state need `void rev.value`. Above all one with state of its
  own (`useState`) whose props are the game's objects: `@preact/signals` skips re-rendering a
  component with hooks state when its props are the same objects, and the game's state changes in
  place, so without it the component shows what was (13 Oct: the Passage section still said
  "Under way: 0%" after the Passage was done; the Kinetic Lance's strike section, a warship's
  attack button and the Halo Siphons' shut button had the same gap).
- Hooks must come before any early return. `FleetPanel` has several `useState` calls.
- The date is kept in years, a double: at the Dusk's 9×10^13 years that is to a sixty-fourth of a
  year, while its first Tide turns are 40 years and a Quick ×100 turn there a third of one. So a
  check comparing spans of years there allows for rounding (`unit/ladder`, `slack`), and η does
  not move at all over such a turn (to 16 digits): watch the years to see a turn advance.
- Stopping a background harness: find its processes by their working directory (`readlink
  /proc/PID/cwd`) and kill those PIDs. `pkill -f` with a pattern from the harness's command line
  matches the shell running `pkill` too, and kills it (exit 144) with the rest.
- A breath that is only a message to ourselves (`MessageChannel`) can run ahead of the timers that
  are due: under load `browser/turn-slices` once saw no timer tick in a whole throttled turn, and
  the synth's lookahead timer runs every 40 ms. End Turn's breaths wait for the timers at least
  every `TIMER_MS` (40 ms, `turnflow.ts`); the timers' longest wait is bounded by the longest
  slice that cannot be split (a civilization's part of a step), some 100 ms at a sixfold slowdown.
- A screenshot of a world close up (20 Oct, the sea pictures): `engine().showSystem(sys, bodyId)`
  fades out, rebuilds the system and then flies to the world, which takes several seconds in the
  software renderer the checks run on. Set `engine().orbitsPaused = true` right after the new game
  (the world then stands at its `phase`), call `engine().unfollow()` before each `showSystem` (or a
  wait for `followed` returns at once, still following the last one), and wait until
  `rig.distance` is near `rig.goalDistance` and `rig.target` at `rig.goalTarget`. With the system
  view's default camera, `phase` 0 shows a world's terminator side on, 2.4 and 3.9 its day side
  three-quarters on.
- Frames a check steps by hand (`engine().frame(dt)`, as the frame-rate checks do) are drawn later
  by the browser's GPU process, in software here, and no animation frame comes until they are: a
  few hundred held the next one up for 8 s to over 20 s on 20 Oct (`browser/survey-reveal`, on the
  build before as well). Wait for a few `requestAnimationFrame` callbacks before timing anything
  that runs on the engine's own loop.
- `pkill -f 'tools/sim.ts'` (or `pgrep -f 'node.*tools/sim.ts'` fed to `kill`) run from a shell
  whose own command line holds that pattern kills the shell too (exit 144, three times on 13 Oct).
  The bracket trick (`'[n]ode.*tools/sim[.]ts'`) fails as soon as the same command also holds the
  text unbracketed (starting the next run, say). Anchor it instead: `pgrep -f '^node '` matches a
  process started as `node …`, never the `bash -c …` around it.
- **Save compatibility:** only add optional fields, or compute things live. Put small counters
  in `civ.flags` (a `Record<string, number>`), or `state.flags` for a fact about the universe.
  `SAVE_VERSION` is 4, the new version's first (`FIRST_OF_THIS_LINE`): until the new version is
  live at `/next/` its format may still change (the player starts afresh with it), and from then
  the rule holds again. Every load goes through `migrate()`, which also runs
  `surveyWhereStationed` (ships parked at unsurveyed stars chart them).
- **`state.civ` is a pointer, not data** (13 Oct, `civs.ts`): a non-enumerable property set by
  `pointAt`, so JSON leaves it out and every civilization is saved once, in `state.civs`. A plain
  `JSON.parse(JSON.stringify(s))` copy, a `structuredClone` or a spread `{ ...s }` loses it, and
  the first `s.civ.…` throws. The checks copy with `copyState` (`save.ts`), and a shallow copy
  keeps the pointer with `pointAt({ ...s, years }, s.civ)`.
- **`colonies(state)` and `fleets(state)` are the active civilization's**, `allColonies` and
  `allFleets` everyone's (`sim/util.ts`). A raw `Object.values(state.colonies)` fails
  `unit/rulebook-lint`, as do flags kept with the wrong owner, a push into a civilization's
  `signals` past `deliver`, and an assignment to `state.civ`.
- **The browser checks are read from the tree as the suite reaches them**: editing one while the
  suite runs against an older build fails it for nothing (13 Oct, `save-all` against the
  foundation build). Edit them before building, or after the suite.
- **A check that sets a neighbour's record by hand** (its health, way or people) needs
  `civsAsleep: true` (13 Oct, 2a-2): a civilization's record is read from it each turn
  (`syncSurvivor`), so what was set is gone after the first turn.
- **tsc does not read the JavaScript checks** (`tools/checks/browser/*.cjs`, `tools/playtest.cjs`):
  a change to the state's shape must be made there by hand. 13 Oct: the one-rulebook codemod
  followed tsc's errors, and 74 references in 34 browser checks still read `s.pending` and the
  rest; most browser checks failed at once against the new build. Grep them after any such change.
- **Generation changes** must keep RNG consumption the same (pick from the already-shuffled
  order), or every seed's galaxy changes.
- **Harness blind spots:** the autoplayer never raids, asks for aid or picks tracks, so those
  never move the harness. Nor does it terraform: its Kin live on living worlds, and terraforming
  is for dead ones. The victories it reaches are The Long Thought and, at the Heart, The
  Aeon Seed: the other Great Works never move it. It does answer the flare event with choice 0 (keep time with the
  flare), and keeps time with every new star it can (choice 0 of A New Star and White Fire).
  It never shuts the Halo Siphons, but it does research them: its fallback (`pickResearch`,
  `auto.ts`, the cheapest open project once its priority list is done) ignores `noAuto`, which only
  `discoverFromSurplus` honours. 151 of 300 games research them, 109 before η 25, mostly as the
  Degenerate Age opens (census, 11 Oct), so the siphons' rules move the harness.
- **The Dark Era's years are Infinity** (the calendar counts η there). Anything that sets a year
  from `to` in the Dark Era (a star's `bornAt`, `diesAt`) gets Infinity, and an overlap of
  `Infinity − Infinity` is NaN: the Last Star lights and goes out within the turn there
  (`unit/last-star` fails without that guard).
- **A game moved forward by hand dies of it:** a turn-1 Dusk game set to η 26 (`browser/last-star`'s
  first try) had no way to live there and ended in Silence within six turns. Play into the age with
  the autoplayer first (`endTurns(1, true)`), then move the clock within it.
- **The outliers in the void** (the Runaway: three dwarfs, about 1.8 Mly out; the Wanderer: a
  2.2 × 10⁵ M☉ black hole, about 2.3 Mly) stay hidden from ships' long-baseline scans
  (`updateDetection`) and are seen from the Black Hole Age's calendar on, when settlements see
  10 Mly (`mods.ts`). Galactic evaporation (`evolveUniverse`, η 18.4 to 21) and close passes do not
  skip them: a Runaway star can be "cast out" or, rarely, fall into the Heart. Known, and left as it
  is by the player's choice (12 Oct).
- **Browser checks that play a seeded game** ride that game's course, and any rules change can
  move it: the dealings turned seed 2360862's game into a defeat before the Black Hole Age, and
  moved where seed 1000 stands after 120 turns. Set the situation up instead of hoping for it.
  `evap` tries a few seeds until one is in the Black Hole Age by its age and by the calendar
  (from 10⁴⁰ years, when holes evaporate in every fate), with the game still going. `star-clock`
  goes one turn at a time at our own pace once in the Degenerate Age (turns there grow
  twentyfold in three). `dealings` (unit and browser) sets a dear project, because the first
  techs are too cheap for any deal. `flow` judges its Echoes by a turn of 10^64 years: the
  Terraforming research moved seed 1000 to η 64.2 before the flow, where a Tide turn already
  outlasts it. Its sleeping-upkeep part gives the capital one awake Kin: after the ice worlds
  changed (8 Oct), seed 1000's capital held only slow minds, whose ×1.5 keeping watch stacked
  on the ×3. `clock` compares resolve with a tolerance (2.000000000000007 is +2). `ways` clears
  the Tessellate's last aid and breaches before its breach test (the steam worlds' course had
  beamed it aid a few turns before).
- **The HUD sits in one wrapper**, `<div class="hud">` in `App.tsx` (9 Oct): `display: contents`,
  so its parts are still positioned against `.ui-root`, but a selector like `.ui-root > .rail` no
  longer reaches them. It is `inert` while a window, an event or the survey report is open (Tab
  stays in the window; a Playwright click on a HUD part behind one fails, as it did on the
  backdrop). In the magnifier mode it is the column.
- **A clickable row is `{...pressable(fn)}`** (`a11y.ts`), never a bare `onClick` on a div: role
  button, Tab, Enter and Space, and no focus from a mouse click (with focus, the next Enter would
  press the row again instead of ending the turn). A disabled one: `pressable(fn, true)`.
- **Focus** (9 Oct): `ModalFrame` focuses its `h1` (tabIndex −1) as it opens and gives focus back
  as it closes (`useFocusOnOpen`); the event and survey-report dialogs focus their titles. What
  had focus is taken at the first render: by the effect, the HUD is already inert and Chrome has
  taken focus from it. The main key handler ignores Enter on any control and under an event.
- **A translated page** (`translateGuard.ts`, 9 Oct): once a `<font>` appears in `#ui` (Chrome's
  translation), `Text.prototype` `parentNode`, `nextSibling` and `data` and `Node.prototype`
  `insertBefore` and `removeChild` are patched to pair each text node with the `<font>` standing
  in for it. `browser/translate` plays turns under a stand-in translator (both ways of swapping);
  without the guard the turn count, η, panel titles and tooltips froze.
- **`state.eta` is not always `log10(state.years)`** (`stepTime` returns its own `eta`): a test
  that switches between our clock and another (the halo's, `haloEta`) uses `state.eta` itself when
  the two agree, or a boundary can flip and shift a seeded game.
- `pgrep -f "tools/sim.ts 300"` matches its own command line. Don't use it to wait for the
  harness.
- `pkill -f "vite.js preview --outDir"` matches its own shell too, and killed it (exit 144, 9 Oct).
  Stop a server by its PID (as `withserver.sh` does) or by its port.
- **A container restart stops background runs** (a harness run or the browser checks; seen 9 Oct)
  without a word: if their output stops short, run them again.
- **The stop hook** of the cloud sessions (`~/.claude/stop-hook-git-check.sh`) won't let a turn
  end with uncommitted changes, untracked files or unpushed commits. Commit and push before
  ending, and keep scratch files out of the clone.
- **A slow renderer delays redraws too** (10 Oct): a component's re-render waits for the next
  frame, and under the software renderer a frame can take a second or more, so a camera slide
  that follows a redraw (the Drawer's `place()`) can start seconds after the click that caused it.
  A check that taps the map waits for the view to stop moving first (`mobile`: `settled`,
  `unshifted`).
- **Hidden by CSS is not re-measured:** a panel hidden only by a class elsewhere (`html.picking
  .drawer`) does not re-run its own layout effect; read the signal behind the class in the
  component (`void targeting.value` in the Drawer) so it redraws and measures again.
- **Fallback fonts measure differently** (10 Oct): without `STEL_FONTS` the browser checks lay out
  text in fallback faces, with shorter lines than the game's own (Saira's line box is about 19 px
  where the fallback's was 14). Sizes that only just fit can pass there and fail for players: at
  960×460 one Build row was 130 px in fallback faces and 145 px in the real ones, in a 142 px panel
  (`a11y`; fixed by the two-line descriptions in short panels). Run layout checks with the fonts.
- **Frame-rate bound checks:** under load, the software renderer can fall below 10 frames a
  second. The frame time is capped at 0.1 s (`engine.ts`), so easing takes longer in real time,
  as it would on a slow machine. A check that waits on something eased (a camera move, a fade)
  polls in a bounded loop until it has settled, as `browser/lowvision` does, rather than trust
  one fixed wait.
- **A check about timers' order, under load** (15 Oct, `browser/music-route`'s hold): waits
  between steps (`setTimeout`) stretch when the page is busy, and a timer that should have come
  between them comes after; the check then passes on the bug it was written for. Make the steps
  that must come before a timer synchronous (a short busy wait on `performance.now()`), then
  wait: timers fire in the order they are due, however late.
- **`protonFate` is `'decays'`, not `'decay'`** (12 Oct): `newGame({ protonFate: 'decay' })` gets
  the seed's drawn fate without a word (a check thought it was testing decay on a stable game).
  `tsx` runs a check without type-checking it; `tsc` catches it, so run `tsc` before trusting one.
- **Worlds in a late save are often rogue already** (12 Oct): close passes fling most loose by the
  Degenerate Age (both worlds of the turn-119 save's holes). A rogue world builds nothing around its
  star and gets no light, so a check meaning a world still bound to its star sets `rogue: false`
  (`cold-energy`, `evap`, `rogue-reach`).
- The user dislikes long blocking waits. Prefer background runs and report when done.
- **`public/archive/` holds frozen builds** (13 Oct: `2026-10-13/`, the game before the new
  version; 27 Oct: `2026-10-27/`, today's game as it was at the switch, built from `0279db1`, to
  which `OLDER_BUILD` in `src/keys.ts` points; `public/archive/README.md`). Vite copies them into every build as they are, so Pages
  serves them beside the live game, on the same origin and so with the same saves. Never edit
  them. A later copy is built from a clean worktree of its own commit (`git worktree add --detach
  <dir> <sha>`, a symlink to this `node_modules`, `npm run build`), never from a tree that
  already holds `public/archive/`, which would nest. This session's GitHub access refuses tags
  and releases (HTTP 403): a commit's own zip, `github.com/<owner>/<repo>/archive/<sha>.zip`,
  stands in.

## Where the newer systems live

- **The pace: ten turns to a Tide turn** (20 Oct, both versions; CHANGELOG, "The pace: ten turns
  to a Tide turn"):
  - `tideTurnsAt(era, years, eta, length)` (`eras.ts`): the Tide turns since the calendar's age
    began, not a whole number between them. `stepTime` at pace p covers `paceShare(era, p)` of
    them: `10^−p` (`Tide × (g^s − 1)/(g − 1)`; the Tide's own formula untouched at s = 1), but in
    the Dark Era, which keeps its own clock (the player's word, 20 Oct), `clamp(10^−p, ½, 2)`,
    its λ-clock `2·exp(a·(k + s)²)`.
  - `turnStep` (`flare.ts`) = `stopAtTheEnd(clockedStep)`: `turnEndEta` (the age's end,
    `ageEndEta`; η 39 under a fate other than decay on the Degenerate calendar; η 89.5 under
    curvature until matter is gone), `turnEndWhy` in words for the greyed paces. A flare's clock
    keeps its own sixths whatever the pace.
  - No slow turn ends an age (the player's word, 20 Oct): `slowPastTheEnd(state, pace)` (a slow
    pace whose `turnStep` reaches `ageEndEta`; never in the Dark Era) makes `paceMatters` false;
    `effectivePace` then lights the nearest open pace toward the Tide, and the turn is lived at it:
    `turnStep`, `livedShare`, `upkeepShare` and `project` take `effectivePace` by default, and
    `endTurn` passes it. Multi-turn estimates (`stepTurns`) keep our stored pace and step each
    simulated turn at `slowestAllowed` (our own comes back once a clock ends).
  - `livedShare`: exactly `paceShare` when the step is the plain `stepTime`; `1/split` on a new
    star's clock; otherwise the `tideTurnsAt` difference. `upkeepShare` (in `TurnContext`, read by
    `upkeepOf(ctx)`): `max(1, share)` on a plain or star-clock turn, else the share. The checks
    that build a `TurnContext` by hand may leave it out (then `max(1, paceFactor)`).
  - The declines take the share: `declineWorlds(state, share)` (exported for `unit/ladder`),
    `seededVitality(…, share)`, `turnsToFreeze(…, share)`, `updateHunger(…, share)` (bite, gfe,
    rust, a tamed swarm's matter and Taint) and `fadeRust`. The Dark Era's Continuity stays a
    turn at a time (its own clock keeps the turns). `vitalityLoss`'s Dusk acceleration reads
    `tideTurnsAt('dusk', …)`, not `eraTurn`.
  - `LATE_YIELD` (`economy.ts`, `lateYield(state)`): after the Dusk's calendar every source gives
    that much more energy and matter (structures, the Hearth), carrying what the old slow turns'
    overpay had given the late game (the player, asked whether to bring the victories back: "Bring
    them back"). 1.125 here, 1.4 in today's game, each tuned on the harness to about 77 victories
    of 300. `powerParts` and `matterAt` (`sites.ts`, where to settle) count it too.
  - `effectivePace(state)`: the pace lit in the HUD; ours gets `.btn.stored` (dashed) while greyed.
  - The autoplayer (`planPace`) weighs only the paces open now, from the lit one, each by its net
    per Tide turn covered, and in trouble goes no slower than the Tide before the Dark Era (new
    version: unless nothing pays once matter is gone, its drain fallback). `planDarkSleep` takes
    the Long Sleep in the dark under any fate where the reserve would not last the age (before,
    only once matter stable was iron; today's game never slept): the overpay had carried it
    through the dark. `unit/ladder` checks the rules and the dark sleep; `browser/pace-grey` the
    lit pace.
- **One sea for the Water row and the picture; finds only where they can be** (20 Oct, both
  versions; CHANGELOG, "Finds where they can be, and one sea"):
  - `seaBand(climate)` (`physics.ts`): where a world's water is liquid by f, the sine of its
    star's height (`T(f) = max(night, day·f^¼)`; `{from, to}`, ±2 meaning all or none). The Water
    row (`waterState`) and the planet shader (`uSeaFrom`, `uSeaTo` in `systemView.ts`; the
    shader's `T` is the same profile) both read it, and `unit/seas` checks the two agree. No
    vitality in the sea any more (`eyeStrength` is gone): life colours the land only. `uSteam` is
    a veil only where all of a world's water has boiled; `uAir` lights a world with air a little
    past the terminator.
  - Finds: `vent_life` asks `buriedOcean` and not `feeding`; `resonance` counts the worlds bound
    to a star (`boundWorlds`, not the Deep); the survey skips worlds that are `feeding` (but not
    rogue ones: `warm_rogue` needs them). `pruneFinds` (`sim/events.ts`), at the start of the
    turn's step 8, drops a waiting find whose world no longer `fits` (trait off, `fired` down by
    one). `unit/finds` checks each wrong path.
- **Falling worlds break up, giants fall in a flash** (20 Oct, both versions, new games;
  CHANGELOG, "Falling worlds"): `state.flags.rubble` (set by `generateWorld`, no draw), read
  through `rubbleGame` (`physics.ts`).
  - In `evolveUniverse`, at a world's date, by what it is made of: `breakUp(b, to)` (rock and ice:
    kind `asteroids`, trait `rubble`, richness ×2 times the share left by `to`; it feeds as
    before, with the same draws), thinned each turn in the feeding loop by
    (1 + t₀/τ)/(1 + t₁/τ); `flashSystem` for a giant (`giantWorld`) at a dead star, brown dwarf
    or hole (`giantFlash`: `fallEfficiency` × m c² at `EDDINGTON_SUNS` × M) and for a rocky world
    at a hole (`rubbleFlash`, harmless). A giant's flash boils away what `flashBoils` says (gone,
    `dissolved`) and melts what `flashMelts` says (`starClimate` under the flash at `LAVA_K`):
    water 0 (not a `water_rich` world's), vitality 0, kind `barren`, trait `flash_melted`; a
    Shadow Shield over a world (`shadowShielded`) spares it, and a belt behind one. A degenerate
    star's giant still makes both draws (rekindle, τ) before it flashes, so later draws stay put.
  - Notes: `plunge` with `inFlash` (the turn evacuates, no log, no +20), then `flash` with a
    `FlashNote` (`energy`, `lum`, `years`, `inside`, `boiled`). `handleNotes` (`turn.ts`): each
    civilization's settlements inside the melt line live only if `flashSheltered`
    (`flashShelterFor`: a locked rock or ice world takes a Flash Shelter, Deep Warrens or
    Night-side Shelters; anything else a Shadow Shield; nothing on a boiled world), and every
    flash goes to `catchFlashes` with `flashReach(E)` (`crossing.ts`: 10 ly × √(E/10^42 J)),
    through `burstShare(ly, reach)`; in the new version a falling world's flash (`own`) reaches
    its own system's catchers even when the system is cast out.
  - `flash_shelter` and `shadow_shield` (`structures.ts`, `rubble: true`: `structureCheck` says
    "Not in this game." elsewhere, and `buildableStructures` leaves them out); the Flash Shelter
    only on a locked world; from the Dusk, with `subterranean_cities` and `orbital_industry`
    (whose texts say so in such a game: `rubbleDesc`, through `techDesc`), as a white dwarf's
    close giant can fall in before the Last Light.
  - "A World Falls": the rubble text, and "Take them apart" (`shown` only at Taint 60:
    `CORRUPT_AT` in the new version, `HUNGER_WAYS` in today's game; `takenApart`). `EventChoice`
    gained `shown` (`choiceShown`): the story screen leaves such a choice out, `resolveEvent`
    refuses it, the autoplayer skips it.
  - `addHoleWorlds` (`gen.ts`, after `addOuterWorlds`, stream `:hole`), trait `hole_world` (a
    mark, hidden like `outer`; `insolationByDistance` leaves them out of the standard orbit for
    the world a hole had). The forecast's `flash` row; `FallsInwardRow` says what becomes of a
    world; the Drawer's Disk luminosity (`sourceLight` × `lightUnitSuns`); `TRAIT_NAME` rubble
    and flash_melted, "Rubble ring" (`bodyKindName`); a giant's flash pings the map.
  - Checks: `unit/falling-flash`, `unit/hole-worlds`, `browser/rubble` (new version);
    `unit/young-dwarfs` leaves the hole worlds and the holes' display orbits out of its
    fingerprint (taken again on `7c0c763`, whose galaxies are `75efadc`'s); `unit/outer` lets
    the hole worlds come last; `unit/dealings` keeps the raiders' clock in step.
- **The game keeps its word** (19 Oct, both versions; CHANGELOG, "The game keeps its word"):
  where a text promised what the code did not do, the code now does it.
  - The Long Record: `LONG_RECORD_ACCORD` (`economy.ts`, `colonyTurn`, its own yield line).
  - What we see of the Hunger: `src/game/sim/sight.ts`. `swarmSight(state)` (a test for one
    swarm, the eyes worked out once): an awake swarm at a star we know; one under way within
    `watchEyes` (`fleets.ts`: settlements, Shared Watch stars, ships stopped, as
    `updateDetection` charts with); with Hunger Studies (`readsSwarms`) a sleeping one in range;
    always one under our command. `swarmArrives` (years: the rest of its leg at `swarmSpeed`,
    0.05 c in the Dusk, 0.5 c after, the same `updateHunger` steps with); `nearestSwarmSeen`
    (moved here from `util.ts`) and `nestSeenAt` (the "nest asleep" chip). The map
    (`galaxyView.ts`, `syncSwarms`): `aSleep` dims and slows a sleeping swarm's motes;
    `swarmLines` (public, for the checks) the ways, with the tech. The `hunger` forecast is keyed
    `hunger:<swarm id>`, dated with the tech. `swarmSeenAt`, which the autoplayer reads, is as it
    was: nothing here moves a game.
  - Communion: `commune` in `updateHunger` (on arrival, and for one already sitting there), and
    `foldIn` (shared with `absorbSwarm`); `COMMUNION_TAINT` 8; `firstSwarm` spares a ship under
    it. No draw: only games under the charter change, and the autoplayer never takes it.
  - Harsh: `HARSH_CROSSING` 1.25. The new version: `crossingHarm(state, era)` (`crossing.ts`) at
    each crossing's losses, and `CARRIED` divided by it; `protocolsMult` alone stays for the
    Passage, the Thinning and the collapse. Today's game: `harshness(state)` in `runCrossing`'s
    and `greatEvaporation`'s `crossingMult`, and the carried share.
  - Falls into brown dwarfs and black holes: `state.flags.all_fall` (set by `generateWorld`, no
    draw), `allFall`, `takesWorldsIn`, `fallsInAt` (`physics.ts`), read by `evolveUniverse`, the
    `inspiral` forecast, `lastsUntil` and `FallsInwardRow`. A brown dwarf's world feeds it
    (`BROWN_FEED_SHARE` 0.008 of a white dwarf's warmth, `BROWN_FEED_TAU` 10^14.8 years, model
    `feed`, no draw; `rekindledK` at `BROWN_R` in its temperature, `rek` in its light); a black
    hole's is `dissolved` at once with a `plunge` note (the turn evacuates it). `NEVER_FEED` is
    the old rule, for games without the flag.
  - Spare work in the figures: `applyIndustry` (`turn.ts`) returns the `SpareYield`, counted into
    the turn's `eIn`/`mIn`; `spareLeft(c, industry)` (`projection.ts`) for the coming turn.
  - Growth paid only with room (`growth`, exported for `unit/unwritten`, in the new version; inline
    in `endTurn` in today's game); a met demand never lowers a standing above 80 (`society.ts`).
  - Today's game only: once matter is gone, matter upkeep is paid in energy (`MATTER_AS_ENERGY`
    1.5 in its `economy.ts`), as the new version had done since part 3.
  - The Expansion Mandate (`charters.ts`; its effect was always in `buildCost`). The energy
    reading's `.hazard-edge` (`styles.css`). The vault's text in a Deep. The hidden step:
    `docs/spoilers/slow-ones.md` (spoilers).
  - Checks: `unit/promises`, `unit/fall-in`, `unit/unwritten`, `unit/slow-ones`,
    `browser/hunger-sight`; `unit/late-sky` and `unit/evap` for both fall-in rules; `unit/evap`
    and (new version) `unit/ways` find the first of a few seeds the autoplayer takes to the Black
    Hole Age, as the rules move which one does.
- **One rulebook** (13 Oct, the new version's part 2a-0; CHANGELOG, "One rulebook"): every
  civilization plays the same game, each its part of every step of the turn under its own
  perspective. Nothing changes in play with one civilization; part 2a gives the others a Civ.
  - `src/game/civs.ts`: `PLAYER_ID` ('us'); `pointAt` and `linkCivs` (the pointer);
    `playerCiv`, `isPlayerView`; `asCiv(state, id, fn)` (the pointer at `id` for `fn`, back
    afterwards whatever happens, never nested); `setCivGuard` (checks only: during another's part
    every other civilization is a deep read-only proxy, so a write that crosses over throws where
    it is made); `assertPlayerView(state, where)` (in `bump`, `act`, `autosave` and every save:
    throws under the guard, else says so in the console and points back); `deliver` and
    `flushOutbox` (`state.outbox`, transient: what one civilization sends another, delivered after
    each step, never saved).
  - `GameState.civs`, `player`; `Civ.id`, `Civ.rng` (another civilization's own random stream,
    from `hashSeed('<seed>:civ:<id>')`: `withRng` and `rngOf` draw from it under that
    civilization's perspective, so the player's draws never move); `Colony.owner`, `Fleet.owner`
    (set by `createColony` and `newFleet` to the active civilization).
  - The turn (`turn.ts`): `turnOrder` (the player first, then the others still playing);
    `endTurn`'s `each(part)` runs a part for every civilization under `asCiv` and then flushes
    the outbox; between the parts the universe moves once (`scorchWorlds`, `declineWorlds`,
    `swarmsHunt`, `updateHunger`, `drainHalo` if anyone's siphons run, `evolveUniverse`, the
    time). The time is the player's: `turnStep` and `livedShare` once, from the player. A
    civilization's parts: `beginTurn` (mods, pace, siphons, sleep), `economy`,
    `overdriveAccidents`, `starvation`, `researchAndWorks`, `growth`, society, its fleets, the
    notes, the Long Flow, `continuity`, `signalsAndEvents`, the fate shown, endings and stats.
    The player's alone: the neighbours (`updateSurvivors`, `pactsTurn`, `warTurn`), the other
    minds (`updateMinds`, `gatherTheLastStar`) and the Slow Ones' notice at the Last Light.
  - **Forms** (part 3-1): `Colony.form` (`data/forms.ts`, `formOf` in `sim/util.ts`), absent for
    matter. `capacity` gives no room to a Thread the form does not house (a leptonic settlement:
    no Kin, no sleepers), and `structureCheck` refuses what only houses Kin there.
    `goLeptonic(state, c, mult)` (`crossing.ts`) is a settlement going on past the end of matter:
    it keeps the decay-proof (and, at a hole, `keptAtHole`) structures and queue items, loses Kin
    and sleepers, and halves the Lattice once. `enabledAt(structures,
    'merge')` (`data/structures.ts`): a Confluence Node or a Leptonic Confluence; either counts
    toward `chorus_nodes_built`. After matter the Lattice mends and grows with energy
    (`MATTER_AS_ENERGY`, `economy.ts`, construction's rate too), and only an empty reserve wears
    one out (`starvation`, `turn.ts`).
  - **The Passage** (part 3-2, `sim/passage.ts`): a queue item of kind `'passage'` (key
    `'passage'`; `applyIndustry` calls `completePassage`); `passageTerms`, `passageCheck`,
    `beginPassage`, `endForeseen`, `etaToEndOfMatter`, `passageEta` (decades of η a settlement's
    own industry would take at a pace) and `turnsToEndOfMatter` (the panel's turns, from
    `turnStep`'s length). While it is `queue[0]`, `colonyTurn` cuts energy, matter, insight and
    accord to `PASSAGE_OUTPUT`. A turn's industry from minds does not grow with the turn's length
    (only machines' energy and matter scale with the lived share; minds feel tempo strain), so a
    slower pace puts less work into it a decade: the autoplayer counts decades, not turns.
    `StructureDef.leptonic` (with a name of its own: `structureLabel(id, sys, form)`) and
    `inLeptonicForm(d)` decide what crosses over and what a leptonic settlement may build;
    `decayProof(c)` (`crossing.ts`, exported) is true for a leptonic settlement too, and
    `goLeptonic` keeps all of a passed settlement's structures. The autoplayer's `passageDue`
    (`auto.ts`) times it: done about `PASSAGE_SPARE` (2) decades before the end at the Tide, or at
    our pace if quicker; `passageLate` rushes it only in the last three decades, and the general
    rush (matter over 600) skips a Passage, which once finished one the turn after it began, 15
    decades early. `migrateToBlackHoles` goes to the nearest hole with spin left (`SPENT_SPIN`);
    `planThreads` cools Echoes when the reserve would last fewer than `COOL_BELOW` turns (in the
    Dark Era, fewer than `darkTurnsLeft`); and when no pace pays after matter or in the Dark Era,
    `planPace` takes the one that drains the reserve least a decade (`turnReach`: decades of η, of
    log η in the Dark Era), not the least a turn: quicker turns cost about as much a turn once
    nothing comes in. Not before then: in the Dusk the rule took long turns and lost the turns a
    civilization grows by.
  - **The Thinning** (part 3-3, `sim/thinning.ts`): `thinningFrom`, `thinShare(state, η)` (the
    share of matter gone, evenly from η 37.5 to 39 under decay, 87 to 89.5 under curvature),
    `ofMatter(c)` and `theThinning(state, from, to)`, run in each civilization's part of the turn
    after the Long Flow (the turn's η before and after). `colonyTurn` scales matter yields by
    `1 − thinShare` at the turn's start. A decay-proof settlement in a system dissolving before
    the end goes on through `goOnAlone` (`crossing.ts`, from `handleNotes`, which is exported for
    the checks), with `driftToHole` and `harvesterFor`, which the Migration uses too.
  - **Leaving a hole, and the Horizon form** (part 3-4, `sim/horizon.ts`): `driftTerms`,
    `driftCheck` and `driftToAnotherHole` (once a turn: `Colony.flags_drifted`), through
    `leaveTarget` and `leaveHole` (`crossing.ts`): `holeFor(…, leaving)` picks the hole with the
    most spin (at least `LEAVE_SPIN`, 100) that is not `holeFailing` (drained below `SPENT_SPIN`,
    or within `LEAVE_MARGIN`, 5 decades, of evaporating), the nearest of equals; the forced moves
    (the Migration, `goOnAlone`) keep the nearest with spin left. The form `'horizon'`
    (`data/forms.ts`: `HORIZON_UPKEEP`, `HORIZON_PACE`, `horizonRoom(primary)`, added in
    `capacity` to each Thread the form houses) is a queue item of kind `'horizon'`
    (`horizonTerms`, `horizonCheck`, `beginHorizon`; `applyIndustry` calls `completeHorizon`;
    `PASSAGE_OUTPUT` while it is `queue[0]`); in `colonyTurn` its Threads take no strain, a quarter
    of the output and a tenth of the upkeep. `writeOut` (half the Lattice, times the Black Hole
    Age's protocols) runs from `horizonGone` when the hole's `'evaporated'` note is handled
    (`handleNotes`, then `leaveHole`) and from the Last Horizon crossing for everyone left.
    `decayProof`, `ofMatter`, `nextToFlow`, `structureCheck` and the leptonic names treat every
    form but `'baryonic'` alike; `goLeptonic` leaves a horizon settlement as it is. The autoplayer:
    `planDrift` and `planHorizon` (`auto.ts`, before `planBuilds`); the harness line counts
    `horizon N` (settlements written in) and `drift N` (chosen drifts) from `civ.flags`.
  - **Positronium** (part 3-5, `sim/positronium.ts`): `positroniumComes` (not under stable
    matter), `positroniumHere(state, η)` (η 85 to `POSITRONIUM_DECAY`, 141), `positroniumGone`,
    `turnsToDecay` (at our pace, `turnsUntilYears`: one slow turn can jump past it). The form
    `'positronium'` (`data/forms.ts`: `WEAVE_UPKEEP` 0.02, `WEAVE_PACE` 0.1, `WEAVE_ROOM` 30) is a
    queue item of kind `'weave'` (`weaveTerms`, `weaveCheck`, `beginWeave`; `applyIndustry` calls
    `completeWeave`, which refuses once the atoms have decayed); `leaveWeave` is immediate (2 energy
    a mind). `theWeaveEnds(state, from, to)` runs in each civilization's part after the Thinning;
    the universe marks the turn they decayed in (`state.flags.positronium_end`), from which the
    nets' dole counts. Positronium Nets: energy mode `'positronium'`, `netYield(state, years, L)`
    (the window's 40 shared by `trickleShare`, a cube, so the sum does not depend on the pace; then
    20 halving each turn), divided by the lived share in `colonyTurn` since it is already a turn's
    worth; `structureCheck` lets them stand only in a settlement no longer of matter, inside the
    window. Continuity in the Dark Era loses half as much for `wovenShare`. The forecast `kind`
    `'positronium'` is the one the HUD counts turns for in the Dark Era. The event
    `positronium_ends` is queued the turn before the decay for whoever has woven anything or strung
    nets. The autoplayer: `planWeave` (`auto.ts`), nets in `planBuilds` before η 130
    (`WEAVE_WORTH`) from spare energy, the research by two tests in `pickResearch`: `never` (of no
    use for the rest of the game: never taken, and put down if it was) and `useless` (of no use
    now: the list waits; the cheapest-left fallback may still take Horizon Writing, as idle insight
    is banked at half, but not the weaving, which is seldom used). `WEAVE_TURNS` (6): fewer turns
    to the decay, the weaving is not worth researching. The tech has `needsUnstable` (`techVisible`,
    `sim/research.ts`): any fate but stable matter.
  - **The stable fate's late game** (part 3-6, `sim/deeptime.ts`): `heavyDwarfs(state)` runs in
    `newGame` straight after `generateWorld`, before the passes that read temperatures: about one
    white dwarf in `HEAVY_ONE_IN` (30) gets `HEAVY_MIN`–`HEAVY_MAX` (1.16–1.35 M☉), by a hash of its
    mass draw (no draw taken). `deepTime(state, fromEta, toEta)` is the universe's part, called in
    `endTurn` right after `evolveUniverse`, its notes pushed onto the same list; stable only: a heavy
    dwarf (`willExplode`) explodes at `supernovaEta(mass)` (Caplan's three points, interpolated in
    log η; `Primary.exploded`, mass to 1.0, its non-rogue worlds dissolved; note
    `'blackdwarf_sn'`); `state.flags.iron` is set as η passes `IRON_ETA` (1500); each system with
    matter (`hasMatter`) collapses at `collapseLambda(sys)` (a hash in `COLLAPSE_FROM`–`COLLAPSE_TO`,
    λ = log10 η 26–76): primary to `'void'`, every non-Deep body dissolved, `gone` unless something
    leptonic is there (note `'collapse'`); past λ 76 `state.flags.matter_gone`. `handleNotes` takes
    each civilization's losses (`blackdwarf_sn`: everything in its system, in its system;
    `collapse`: baryonic lost, a leptonic settlement on a world moved into the Deep with
    `moveToHole`) and `catchFlashes` banks the turn's flashes (each catcher from the nearest, once,
    `burstShare`). `ironAge(state)`: Fusion Plants make nothing (`colonyTurn`, labelled), cannot
    be built (`structureCheck`), and the Hearth loses its 0.25 floor. Events `black_dwarf_supernova`,
    `iron_stars`, `tunnelling_collapse` (once each). Forecasts `blackdwarf`, `iron`, `collapse`
    carry `Forecast.dueEta`: the HUD counts their turns with `turnsToEta` (stepping `stepTime` in
    the Dark Era) and writes the date with `formatDeepYears`. `endForeseen` is true for the stable
    fate too once the fate is known (the Passage opens). The autoplayer: in the stable Dark Era the
    Passage is begun `IRON_LEAD` (2) turns before iron and rushed the turn before (`passageDue`,
    `passageLate`; its decades rule cannot work where a turn spans so many), substrate from
    `COLLAPSE_PREPARE` (12) turns before the collapse, and Burst Catchers.
  - **Continuity in the Dark Era** (14 Oct, harder; `sim/continuity.ts`): `continuityLoss(state,
    starving)` is what a turn takes, `DARK_DECAY` (2.2) times `correctedShare` (each settlement's
    Error-Correction Arrays, `continuityMult` 0.6 each, keep its own minds and sleepers; the mean
    over ours weighed by `popsOf + cryo`: arrays no longer multiply across settlements), times
    `DARK_SLEEP` (0.35) while dormant and `1 − 0.5 × wovenShare`, plus `DARK_STARVE` (10) when the
    reserve ran out this turn. `continuity()` in `turn.ts` applies it; the HUD's Continuity tip
    shows `continuityLoss(s, false)`.
  - The crossings (`crossing.ts`): `runCrossing(state, ids, mods)` and `greatEvaporation` return a
    report per civilization; the universe's part runs once (`toAll` puts its lines in every
    report where they fall), each civilization's under `eachCiv`; `leftOnSubstrate` is one
    civilization at the end of matter. `burstNeutronStars(state, lines, ids)` returns what each
    one's catchers bank.
  - `tellOfWorld` (`turn.ts`): a world's steam, freezing and death are told to whoever lives there
    as its loss, and as news to whoever surveyed it (`logTo`, `sim/util.ts`).
  - **Owners everywhere** (part 2a-1): the clock is the player's (`clockCiv`, `flare.ts`, read
    whoever's part it is); the swarms take each civilization's mods (`swarmsHunt` and
    `updateHunger` take `ModsBy`: one `Mods`, or a function of the civilization's id), go for
    anyone's ships and strike each one's settlements by its own defence (`defenseAt(…, owner)`),
    spare a civilization under Communion (`communes`), and tell each of its own (`logTo`,
    `tellKnown`); `Swarm.tamedBy`, `Swarm.preyOwner`; `destroyColony` takes the owner's capital
    and Record; `ownColony` and `ownFleet` (`sim/util.ts`) in every action; `StarSystem.beaconBy`
    (`beaconOwner`, `beacons.ts`); `deepFor(state, sys, owner)` (`fleets.ts`): a civilization's
    own Deep, a new one built beside another's; `flowComes` (`flow.ts`): the Long Flow comes once
    for the universe, `theLongFlow` tells each; `EventDef.scope` ('everyone', else the player's
    alone; `forThisCiv` in `sim/events.ts`). The player's alone: the Aeon Seed, a survey's ruins,
    sleepers and finds, the Unlit's gestures, the Forks, and research's fallback onto `noAuto`.
  - **The others become civilizations** (part 2a-2): `sim/others.ts`. `foundCiv` (from
    `newGame`, after everything else is made, drawing nothing; not with `settings.civsAsleep`): a
    Civ under the neighbour's Survivor id; its capital (`capitalWorld`: the most livable world for
    gardens and forks and the warmest for sleepers, as `survivorWorld` picks; the richest and
    warmest rock for minds and the Lattice; else the Deep); its people (`startPeople`, for the size
    of `8 × clamp(pop / 24, 0.75, 1.25)` of our Kin); its structures placed by `structureCheck`, each
    one's research known with it (`put`), room for its people (`roomFor`), then sources of energy
    (`START_SOURCES`) until it has about what we begin with to spare (`START_NET`, 3.5 energy and 4
    matter a turn), and a home with nothing to mine brings `STORE_TURNS` of the shortfall in
    store. `syncSurvivor` (each turn, in `updateSurvivors`): the record reads its civilization
    (`pop` three to a person, a Chorus two; `health` from its reserve, its starving settlements and
    its resolve; `systems`, its capital's first; `claimedAt` for a new star). `civOf`; `endCiv`
    (through the outbox: `send(… {end})`, and `endNow` in `civs.ts` empties its settlements and
    ships, or gives them to `to`). The dealings move real energy, matter, resolve and people
    through `send`: beams (`reachThem`), aid, trades, refugees, joint works (`JOINT_ENERGY` to both
    builders), their raids and ours, sieges, seizing, devouring, refuge, the Choir's Echoes.
    `dealSize(state, sv)` (`survivors.ts`): the size a dealing weighs, a civilization of its own up
    to `DEAL_SIZE_MAX` (40); `spareOf`: what it gives, never more than half its reserve.
    `lightly()` (`survivors.ts`) is the old simulation, for `civsAsleep` and the Forks.
  - The turn plays each one: `autoPlay(state, 'competent')` at the start of its part (round 0 of
    `endTurn`). It is our autoplayer, `wayOf(state)` null for us so that our play and the
    harness's numbers stay what they were, plus, for another civilization only: no domes, warrens
    or lamps where no Kin live; room for its own (Confluence Nodes, Lattice Foundries; the
    Tessellate builds no substrate, which would fill with Echoes); with a swarm near
    (`swarmThreat`: on its way, awake within 90 ly in the Dusk, or asleep at a star it has
    surveyed), Defense Grids first and Orbital Defence researched first; settlers of its own
    Threads (`WAY_SETTLERS`); the Chorus merges its Echoes down to three; the sleepers keep two
    awake. Pacts, war and pace are the player's (`planPacts`, `planWar`, `planPace`); the turn's
    time too (`project`, `travelEstimate` and `planFlow` read `clockCiv`).
  - The interface takes a settlement for ours only if it is (`ownColony`: the Drawer, the world
    strip and list, the lists' chips, the magnifier's build key, the labels, hover); the views
    already walked ours only.
  - **Relations** (part 2a-3): `Survivor.marks` (`marks(sv)` to write, `sv.marks?.key` to read, so
    that a read never adds anything to a save); the neighbours' records are our relations, so
    `jointIncome` counts for us alone. `jointYield` (`survivors.ts`): a shared work's field
    gathers its star's light. `ARCHIVE_SHARE` (`pacts.ts`): Open Archives with a real neighbour.
    `sim/ties.ts`: a `Tie` (`state.ties`, by `a|b`) holds each one's regard (`baseRegard`:
    `AFFINITY` and the seed; drifting back by `DRIFT`), pacts, a proposal and its answer, beams
    and marks; `planTies` (another civilization's part, from `planPacts`), `tiesTurn` (between
    the parts, after the neighbours', then the outbox), `tieCost`, `watchPartners`
    (`defenseAt`), `heardTies` (the card), `state.tidings` (what we hear, at light speed). The
    outbox carries `accord` and `insight`; `civ.flags.last_insight` is what another civilization
    learned last turn.
  - **Seen at light speed** (part 2a-4): `Colony.foundedAt`; `settlementSeen`, `asSeen` and
    `Survivor.seen` (`others.ts`); the system view, `residentsSeen` and the card read them.
    `fleetSeen` (`others.ts`) places another civilization's fleet by the times of its leg
    (`Fleet.departed`, `since`, `cameFrom`, set for theirs only in `newFleet`, `orderMove` and
    `arrive`); `syncFleets` (`galaxyView.ts`) and `buildFleets` (`systemView.ts`) draw them, never
    as pickables.
  - **The turn in slices** (part 2a-6): `turnSlices` (`sim/turn.ts`) yields after each
    civilization's part of a step (`each`; `eachNow` where a step must not be cut), never inside
    `asCiv`; `endTurn` runs it at once. `playTurn` (`turnflow.ts`) breathes (a `MessageChannel`
    message) whenever 12 ms have run; `act` refuses while `busy`. Between two slices the state is
    a turn half done: anything new that acts on the game from the interface goes through `act`,
    or checks `busy` itself.
  - **Minds of their own** (part 2a-5): `WAY_RESEARCH` and `WAY_WORK` (`auto.ts`, exported for
    `unit/minds`); `EventDef.scope: 'everyone'` on the events of ordinary life (nine, `data/events.ts`); `planSleep` and `raceFor` (the sleepers); `temperament` (`util.ts`, from the
    seed, read live, never saved); `heardWaking` (`ways.ts`, our side: their Ark under way to a
    new star); `fork` from another civilization makes no neighbour. The Lattice's insight and
    accord (`data/threads.ts`), `StructureDef.search` (`economy.ts`, after the multipliers). The
    harness's `lattice` strategy sets `ourWay`, so that `wayOf` gives our autoplayer the
    Tessellate's rules for that call; every other strategy leaves it null.
  - **The Hunger among the civilizations** (part 2b): `sim/plight.ts` (`plight(state, id)`, 0 to
    1: reserve, starving, falling, will; the worst counts most). `sim/judge.ts`: every Taint rise
    goes through `hungerAct(state, actor, taint, systemId, act, delta?)`, never `civ.taint +=`
    (research, charters, `absorbSwarm`, communing a point at a time through
    `civ.flags.taint_fed`, seizing without cause, devouring, tainted notes, and the events' own
    `taint` helper; a fall is the actor's alone, `easeTaint`; `unit/rulebook-lint` forbids any
    other write to Taint). Ours goes out as `spreadNews(...,
    taint)`; a neighbour counts it in `heardOfUs` when it arrives (`Survivor.heardTaint`), and
    everything the others decide by our Taint reads that: the ceiling (`HEARD_CEILING`),
    `shuns` (`SANCTION_AT`), pacts, trade, joint works, the card. Another's goes into each tie's
    `news` (the hearer's regard, `Tie.taintHeard`, `shunsOther`) and into a tiding for us
    (`taintOf`, `Survivor.taintSeen`, the just cause in `warCause`: `HUNGER_CAUSE`, news delta
    0). `CORRUPT_AT` (its own Taint): it raids anyone not its friend (`corrupted`,
    `survivors.ts`). `becomeHunger` at 100 (step 10 of `turnSlices`); the fate `'hungered'`
    sends no last transmission, only a tiding of the silence. The autoplayer's `hungerSteps`
    (`auto.ts`, AIs only: plight from 0.6 and caution under 0.5) opens Hunger research
    (`HUNGER_FIRST`), Consume the Dead and the events' Taint choices.
  - **War, units, conquest** (part 2c), as far as built: every fleet strength goes through
    `strength(cls, against)` (`data/ships.ts`: against `'ships'`, `'settlements'` or `'swarms'`,
    a class's `vs` figure or its `attack`), and what can fight is `isWarship`; never sum
    `.attack` (2c-0, 30 games identical). `ShipDef.upkeep` (energy a turn, `fleetUpkeep` in
    `fleets.ts`, charged in the turn and the projection like a structure's, a tenth asleep),
    `screen` (`screenAt`: each ship's own chance to turn a raid away, read in the raids on us),
    `eyes` (`updateDetection`), `dugIn` (fortified, instead of `FORTIFY_BONUS`); `repairFleets`
    (a tenth of a hull a turn at a Shipyard). `shipNote` writes a class's figures for the build
    list. The Picket and the Hunter wear the Warden's hull until they have their own.
    `sim/conflict.ts` (2c-2): a war between us and another is still `sv.war`, between two others
    `Tie.war` (`War`: `since`, `siege`, `by`, `cause`, `at`); `warOf`, `atWarWith`, `enemiesOf`;
    `declareOn` (another's declaration, by our rules; `war_on_us` signal), `peaceBetween`;
    `battlesTurn` (after `updateHunger`, once a turn): every battle at once from what stood at the
    start, each side's `luck` hashed from seed, turn, star and side (never the dice, so no order
    decides), then every settlement's siege, everyone's (`siegesTurn`, since the combat system; see
    below). `planWarAI` (the others: the Hunger heard of in one, or the corrupted on the weakest;
    arm, go at `WAR_ODDS`, tire at `WAR_TIRES`; at war, `fightWar`), `planDefence` (ours, any
    strategy: `fightWar` too). We cannot make peace in a war they began (`makePeace`).
    Conquest (2c-3, the end of `conflict.ts`): `assaultBlocked` (a war; warships at its star and
    none of its owner's; `siegeAt` at least `SIEGE_TURNS`, in a war the stormer began; `walled`, a
    Defence Grid or a Bastion Shell, needs a `breaches` ship), `assault` (`assaultForce`, the
    warships' strength against settlements, × the hashed `luck` against `holdOf`; hulls pay either
    way; won, `conquer` and the war's `at` moves to `frontOf` the enemy's next settlement), and
    `conquer(state, by, c, how: Fall, cause)` for every way a settlement falls ('take', 'raze',
    'lance'): `CONQUEST_GFE` a person or structure from `state.gfe`; taken, `FLEE` to their own
    nearest settlement, structures × `SPOILS`, `TAKEN_DAMAGE` to the hearth, queue cleared,
    overdrive off, the owner changed (a Deep beside the winner's own merges into it); the winner's
    resolve and dissent by cause, `flags.conquests`, the loser's `flags.lost`; `heardEverywhere`
    (`infamyOf`; without a cause a Hunger act of `FALL_TAINT`); the last settlement ends the
    civilization through the outbox (`endCiv`: 'Seized' by us, fate 'seized' or 'destroyed'; by
    another, 'Conquered', fate 'conquered', set at once on the record since `updateSurvivors`
    keeps a fate it finds) and ours sets `flags.conquered`, a defeat of its own (`checkEndings`).
    Our `seizeSurvivor(state, id, raze, colonyId?)` on a civilization of its own is `assault` at
    the settlement asked for, else `stormTarget` (the one of theirs we hold the longest siege on,
    else the front; in a war they began, theirs nearest us) (the light neighbours' and forks' path
    is unchanged); our `declareWar` now keeps its cause on
    the war. The others storm in `battlesTurn` when nothing blocks it, razing from `CORRUPT_AT`.
    `warOf` gives no war once either side's game is over. The Kinetic Lance: `strikeBlocked`,
    `launchStrike` (the Lance alone in a fleet of its own, `orderMove(..., 'strike')`,
    `Fleet.targetColony`, `LANCE_GFE` at launch), flown at `LANCE_SPEED` (`advanceFleets`,
    `isLance`) and kept on its order at arrival (`arrive` returns early), struck in `strikesTurn`
    at the start of `battlesTurn`: the target owner's `screenAt(state, sys, owner)` against a
    hashed draw; a world's settlement `conquer(..., 'lance')`, one in the Deep loses `LANCE_DEEP`.
    A Lance on its order is neither surveyed from (`surveyWhereStationed`) nor hunted by a swarm
    (`swarmsHunt`): it does not stop. The AI builds a Breacher (`needsBreacher`, `arm` in
    `auto.ts`) when the front is walled; it does not use the Lance yet (2d). Until the combat
    system (20 Oct) the defender in a war the other side began could not storm (`siegeAt` counted
    only the declarer's siege); now either side can. A war whose settlement is gone (taken, razed,
    abandoned) moves on to the enemy's next (`battlesTurn`, for every war).
    The interface (2c-4): `assaultOdds` (the draw is uniform from 0.6 to 1.4), `warFront` (the
    settlement our war with a civilization of its own is fought at), `screensSeen` (their screens at
    a star as `fleetSeen` shows their ships). The card (`Signals.tsx`): the War row for one of its
    own (where, the siege, what it holds), Storm and Raze (armed keys `storm:`/`raze:`, the
    confirm row's texts, `seize(g, id, raze)`); the light neighbours keep Seize. The fleet panel
    (`Drawer.tsx`, `StrikeSection`): every settlement of those we are at war with that we see,
    nearest first, eight at most, Strike armed per row; the chip `striking` and "To strike ..."
    while it flies, its trip at `LANCE_SPEED` (also in the Fleets list). `browser/war` is the
    whole of it in a browser.
  - **The AI's judgement in war** (part 2d, `auto.ts`): `planWarAI` keeps
    `civ.flags.desperate_since` (plight from `DESPERATE`, turn by turn); `warTarget` returns a
    `motive` (`War.motive`: 'hunger', 'corrupted', 'desperate'; `declareOn` keeps it and counts it in
    `civ.flags.war_<motive>`): the desperate one `DESPERATE_FOR` turns running with caution under
    `DESPERATE_BOLD` picks the richest that `worthWar` does not rule out ('no' once `state.gfe` is
    under `GFE_SPARE`, and unless stores
    `RICHER` times its own and `RICH_MIN`, plight under `CONTENT`, regard under `FRIEND`, no pact,
    us only once in contact, the front within `REACH_TURNS` of its capital or a fleet of its
    warships; 'go' once its line carries `WAR_ODDS` times what stands at the front plus every
    warship of theirs elsewhere, counted dug in (`FORTIFY_BONUS`), and one of its fleets can pay the
    launch there; 'arm' until then, building Wardens while `arm` allows). It takes (never razes:
    razing is only from `CORRUPT_AT`), and makes peace once `War.took` (counted in `assault` for
    the side that began it) or its plight is under `EASED`. `plunder` (`conflict.ts`): a siege's blockade energy goes
    to the besiegers, ours (`warTurn`) and the others' (`battlesTurn`). `lineOfBattle`: warships
    but not a fleet of Pickets alone, which keeps its watch; `keepWatch` builds a Picket at the
    capital while an enemy knows Relativistic Arks (ours too, in `planDefence`); `lanceAt` (from
    `CORRUPT_AT`, at war): a Lance built, then struck at the enemy's most peopled settlement
    (`civ.flags.lances`). Harness marks: `*hcd`, a letter per war begun by motive; `^N` Lances.
    Census before the rule (40 games, scratch scripts not kept): desperate (plight from 0.6) in
    15% of the others' turns, about 4.5 spells a civilization a game; with the first conditions and
    caution under 0.4, a war in 8 of 40 games. Followed turn by turn (60 games), those wars were
    empty: 12 of 15 attackers could not pay their fleet's launch to the front, and those that came
    brought one warship against a defender that dug in at home; hence the reach, the launch, the
    odds against all the defender has, and the arming.
  - **The combat system** (20 Oct, `docs/plans/2026-10-20-combat.md`, the new version only):
    - `data/tactics.ts`: `TACTICS` (`line` ×1/×1, `close` ×1.5/×1.5, `standoff` ×0.5/×0.5 and
      `holds: false`, `escort` ×0.75/×1 and `escorts`), `Fleet.tactic` (absent: `line`, as every
      fleet before), `tacticOf` (a fleet without a warship holds the line), `shareHurt` (a fleet's
      ships' hurt by its tactic, an Escort's unarmed ships' moved onto its warships, the same
      draws whatever the tactic), `fleetDug` (fortified and not standing off). `setTactic` and
      `storm(colonyId, raze)` in `actions.ts`.
    - Battles (`conflict.ts`): `sidesAt` (every ship stopped at a star, armed or not, but a Lance
      on its order; each settlement's `settlementFire`: `SETTLEMENT_FIRE` 0.5 + `SETTLEMENT_FIRE_PER`
      0.075 a person, at most `SETTLEMENT_FIRE_MAX` 6, and its Defence Grids'), `foesAmong` (a battle
      where one side can fire on another's ships), `exchange` (each side's `sideFire` × `FIRE` ×
      luck, `allot`ted in `fireOrder`: an Escort's unarmed ships last, then the least hull left,
      then a hashed draw; what destroys a ship goes on to the next, a ship taking its fleet's
      `taken` share). Every list is sorted by id first, so no order decides. `battleForecast` is
      the same at an even draw with one fleet's tactic swapped (the buttons' tips). Each battle
      is a `Battle` with `sides` (`BattleSide`: fleets and tactics, ships, settlement fire, dealt,
      taken, lost by class) and, for us, one log line; `state.battles` keeps `BATTLE_MEMORY` (20)
      turns (it grew for ever; `migrate` trims it with `<=`, as a turn leaves it).
    - Sieges: `Colony.siege` (`{ by, turns }`), counted for every settlement in `siegesTurn`
      (`besieger`: at war with its owner, a fleet that `holdsSiege` there, none of the owner's
      warships; the most fire, then the id). Its blockade (`plunder`) and the resolve, for everyone;
      then the others storm at `STORM_ODDS` (0.5). `siegeAt`, `assaultBlocked` (`stormers`: not
      standing off; any war, either side), `assaultForce` (by tactics), `assault` (hulls by
      `taken`; `War.lost` counts the declarer's settlements lost to the other's counter-attack),
      `besieged(by, owner)`. `warTurn` keeps only dissent and a light neighbour's siege
      (`siegeStrength`, those holding); `warHeat` reads the sieges. Format 5 (`SAVE_VERSION`) moves
      a war's `siege` onto its `at` settlement (`tools/saves/70c2d07-seed1000-turn43-siege-next.json.gz`,
      a war of ours under way, made with the build before).
    - The AI (`auto.ts`): `planWarAI` makes peace in a war it began also once `War.lost` or a siege
      of ours it cannot break; at war, `fightWar(foes, line, strikeBack)`: `armWarship` while its
      line is under `WAR_ODDS` times what threatens it (`threatened`: enemy fire stopped at its
      stars, and on its way to them) or stands at its target; the line to the first threat
      (capital first) once it and the guard there are `HOLD_OUT` (0.5) of it, else to the capital;
      with none, to the front of its own war or, `strikeBack`, the enemy's settlement nearest it
      (`frontOf(foe, me)`) at `WAR_ODDS`; else it waits at its settlement they come for, or at its
      capital; dug in at its own stars (`idle` or `hold` to `fortify`); `tacticFor` each fleet
      (escort with unarmed aboard; close at `WAR_ODDS`; else line where it must hold a siege or is
      dug in at home, stand off elsewhere); a fleet outmatched `WITHDRAW_AT` (2) away from its
      capital goes home. `pickResearch`: another civilization at war learns Orbital Defense first.
      `planDefence` (ours): `fightWar` for a war on us, striking back only `warlike`, which also
      storms; `planWar` (warlike) uses `fightWar` against a civilization of its own.
    - The interface: `TacticRow` and `BattleSection` (Storm and Raze per settlement, asking
      first) in the fleet panel, `WarHere` in a star's, the siege chip on a settlement, the
      tactic chip and the Fleets list's word, the war card's sieges and `stormTarget`. Checks:
      `unit/combat`, `browser/tactics`; `unit/civ-war`, `unit/conquest`, `browser/war` updated.
      Harness: `--war=N` in `tools/sim.ts` (at turn N we go to war on our nearest neighbour that
      plays a game of its own; `warlike` fights it).
  - Still for part 2a: relations per pair (2a-3), light speed (2a-4), each way's strategy and
    temperament, plight, the Lattice's thinking, an `EventDef.scope` whitelist, each
    civilization's homeworld (the `homeworld` trait is the player's: an AI's capital world must not
    carry it, or `handleNotes` tells the player of its fall), an AI's Fork rejoining the world as
    people (2a-5); End Turn yielding between civilizations (2a-6).
  - Checks: `unit/civs` (the pointer, the save format, owners, `asCiv`, the guard, the streams,
    the outbox), `unit/civ-turns` (a second civilization, played by the autoplayer under its own
    perspective, lives a whole Dusk and the Last Light beside ours under the guard),
    `unit/rulebook-lint`, `unit/others` (the neighbours as civilizations: their starts by the
    rules, generation untouched, every turn played at our pace, the record read from them, what
    passes between us, the end). `civs`, `civ-turns` and the checks that set a neighbour's
    record by hand (`claims`, `dealings`, `flow`, `neighbours`, `refuge`, `settled`, `war`,
    `ways`) run with `civsAsleep: true`.

- **Lighter on phones** (13 Oct; CHANGELOG, "Lighter on phones and tablets"):
  - The synth's continuous sounds: `voice(layer, t)` and `hush(layer)` in `src/audio/music.ts`.
    `apply` builds a layer without them when a recording is due; `wakeSynth` and the slow-recording
    grace start them; `tick` stops them as `hushAt` passes (the synth then faded to 0).
  - The canvas: `antialias: false` (`engine.ts`); the post chain's targets were never multisampled.
  - The labels: `labelsStand()` (`engine.ts`) compares the camera's matrices, the canvas size, the
    magnifier mode and the interface's zoom with the last layout (`labelCam`); `labelsDirty` is set
    by `setState` (every `bump`) and while they are hidden. The galaxy view only: a system's worlds
    move every frame.
  - Touchscreens: `@media (pointer: coarse) { .panel { backdrop-filter: none } }` (`styles.css`);
    `loadSettings` (`store.ts`) starts at medium there, and moves a saved high to medium unless
    `qualityChosen` (set by the Graphics buttons in Settings, `Misc.tsx`).
  - Check `browser/lean`.
- **Who a burst reaches** (12 Oct; CHANGELOG, "A burst reaches only what is still there"):
  `inItsSystem(state, c, held?)` (`sim/util.ts`): a settlement in its Deep, on a world its star
  holds, or on one in `held` (a burst has just set it loose); one on a world flung loose before is
  far away. In `crossing.ts`: `burstNeutronStars` destroys only settlements `inItsSystem` at a
  bursting neutron star, and returns what Burst Catchers elsewhere bank, `burstShare(ly)` each from
  the nearest burst, once, not on a rogue world or in an ejected system (`BURST_CATCH` 250 within
  `NEAR_BURST_LY` 10, then by the inverse square); the crossing adds it after its own ×0.6 cost.
  `finalBurstCatch(state, systemId, held)` pays a black hole's final burst; `evaporateHole`
  returns the worlds it held until then, carried in the `evaporated` note's `held`. The burst
  forecast says when our settlements there are safe. Check `unit/burst-reach`.
- **Rogue worlds, black holes by lifetime, the late sky** (12 Oct; CHANGELOG, "Rogue worlds leave
  their star behind"):
  - Rogue worlds: `aroundTheStar(d)` (`data/structures.ts`: a Deep structure, `bodies` holds
    `'deep'`) and `leftBehind(state, c, d)` (`sim/util.ts`: the settlement's world is rogue and the
    structure is around the star). `structureCheck` refuses them ("Out of reach") and any light
    collector on a rogue world, and skips one left behind for `systemUnique`; `colonyTurn` skips
    their energy (so no spin drawn and no matter burned) and lift, marks the line `idle` with "out
    of reach", and the Hearth's hole term needs `!body.rogue`; `reserveCapacity` (`storage.ts`)
    skips a Horizon Vault left behind; `turn.ts` drains no `gfeDrain` for one; `buildableAt` and
    `powerParts` in `sites.ts` the same; `planDismantle` (`auto.ts`) counts them gone for good; the
    structure chips in `ColonyPanel` say so. Check `unit/rogue-reach`.
  - Black holes by lifetime: `HolesList` and `holesOnMap` (`Lists.tsx`), the tab `'holes'`
    (`SystemsTab`), shown while `inAge(s, ['blackhole'])` and a hole is on our map;
    `sendFromSystems` opens it in that age. `turnsUntilAll(state, targets)` (`flare.ts`) counts
    turns to many dates in one stepping. `EvaporatesRow` in the star panel. `lastsUntil(state, b)`
    (`sites.ts`, now with the state): a hole's Deep and bound worlds until `evaporateAt`;
    `NEVER_FEED` (moved to `physics.ts`) never. Check `browser/holes`, `unit/late-sky`.
  - Brown dwarfs and pulsars: `sourceLight`'s brown dwarf label by `brownCoolingK` against the
    halo's `BROWN_HALO_K` share (no longer `light >= 0.05`); `brownWarmth(T)` and
    `pulsarBeam(era, years)` (`physics.ts`; the neutron star's light uses `pulsarBeam`, the same
    numbers) shade `nodeColor` (`galaxyView.ts`) and `buildPrimary` and `primaryLightColor`
    (`systemView.ts`) after the Dusk. `solarMass(m)` (`ui/fmt.ts`) for masses.
  - Great Works: `startWork` refuses a finished one ("It is complete"), which also stops the
    autoplayer's `planWorks` resuming it each turn; the Research card's `complete` state.
    Positronium: `POSITRONIUM_ETA` (`eras.ts`, 85, also the milestones), the event
    `positronium_forms` (once), queued in `endTurn` right after `rollRandomEvent`, so the roll draws
    as before. Check `unit/great-works`.

- **Every save at once** (12 Oct; CHANGELOG, "Export all saves"): `save.ts` `exportAllSaves` (each
  slot unpacked, the quick save and the autosave, as `{ kind: 'steliterate-saves', version: 1,
  exported, saves: [{ from, name, savedAt, game }] }`; `game` is the save's JSON as parsed, its
  ±Infinity still the strings "__inf" and "__-inf"), `readSaveBundle` and `importSaveBundle` (each
  through `deserialize`, so `migrate` runs, into `saveToSlot`, which takes a `savedAt` for this;
  skips one with the same name, turn and time). `Misc.tsx`: `exportAll`, and `importSave` taking
  either kind of file; `SaveModal` remounts `SaveSlots` with a new key after an import. Check
  `browser/save-all`, the first to catch a download (`page.waitForEvent('download')`) and drive a
  file picker (`'filechooser'`, `setFiles`).

- **The Last Star** (12 Oct; CHANGELOG, "The Last Star shines when it lights"; the plan,
  `docs/plans/last-star.md`; the quest itself, `docs/spoilers/dark-matter.md`):
  - `minds.ts`: `gatherTheLastStar(state, to)` (step 7 of `endTurn`, after `evolveUniverse` and
    `handleNotes`; `turn.ts` queues `last_star` with the system it returns) replaces the ignition
    that ran in `updateMinds`; `igniteDarkStar(state, to)` sets `bornAt = to`, `diesAt =
    lastStarDies(state, to)` (max of 3 × `to`, `to` + the Tide's next turn, `LAST_STAR_FLOOR`
    10^25) and `civ.flags.last_star_lit`; in the Dark Era (or with `to` infinite) it lights as a
    black dwarf at once, logs it and queues nothing. The `dark_star` signal is unchanged.
  - `relightTheLastStar` (called by `migrate`, which queues the event): a save from before, with
    `unlit_gift`, no `last_star_lit`, matter not gone, the calendar Degenerate or Black Hole, the
    signal's `sentYears` × 3 past the floor, and the star out by the end of the turn after it lit
    (its burnout line in the Record at most `arrivedTurn`; no line counts as yes) or burning but
    out within the coming Tide turn.
  - `flare.ts`: `isNewStar` includes `dark_star`; `starClockEra` (Degenerate or Black Hole
    calendar) gates `turnStep`, `livedShare` and `clearStarClock`'s follow-on, and `starClockTerms`
    for the Last Star only (collision and helium stars keep the Degenerate calendar); `gift`: cost
    0, no follow-on floor, no partner. `starGoneEarly` (from `endOfMatter`, `crossing.ts`) ends a
    clock kept with, or waiting for, a star the Great Decay dissolves.
  - `physics.ts`: `newStarOut` and `nextStellarChange` include `dark_star`. `engine.ts`: its ✦ name
    on the map while it burns, in either calendar.
  - `events.ts`: `last_star` (Light in the Halo): `newStarTiming` and `keepTimeHint` say "costs
    nothing, whatever our pace" / "Free, whatever our pace." for it; a dissolved one (`void`) has
    its own text. The autoplayer answers it like any new star (Keep time when it can, else Watch).
  - Not touched: `NEW_STARS` in `claims.ts` and `ways.ts` (the neighbours').

- **Halo Siphons and the halo's clock** (11 Oct; CHANGELOG, "Halo Siphons can be shut"):
  - `physics.ts`: `siphonsRunning` (researched, and `civ.flags.siphons_shut` unset), `haloDrawn`
    (`civ.flags.halo_drawn`: the years the halo's clock runs ahead of ours), `drainHalo` (each
    turn they run, in the Degenerate calendar age, until the halo is spent; called in `endTurn`
    step 7, before `evolveUniverse`, for siphons running as the turn began), `haloEta`,
    `haloReachesYears`, `embersOutEta`, `haloMoved` (gates every text and date that changes).
  - `haloShare(years, drawn)` and a trailing `drawn = 0` on `emberShare`, `backgroundK`,
    `ownTemperature`, `primaryTemperature`, `primaryLuminosity`; `sourceLight`, `starClimate`,
    `evolveUniverse`, `auto.ts` and the views pass `haloDrawn(state)`. With nothing drawn every one
    is bit-identical to before. A cast-out ember's dimming (`haloLeft`) keeps our own years.
  - `SourceInfo.dark`: the dark-matter part of an ember's light, all that the siphons double
    (`economy.ts`, `siphoned`).
  - `shutHaloSiphons` (`actions.ts`); `ShutSiphons` in `Signals.tsx`, under an open `dark_reveal2`
    while they run and on the Unlit's card. `minds.ts`: the Help gate and the 8% hostility test read
    `siphonsRunning`.
  - `waitsForAnswer` (`signals.ts`): the Unlit's messages with choices never lapse and survive the
    160-message cap; `migrate()` reopens one marked 'lapsed'.
  - The embers forecast (`forecast.ts`), `milestonesFor(fate, embersOut)` (`eras.ts`; the
    Chronometer passes it) and `embers_dim` read the halo's clock.

- **The audits of 8 Oct** (planet and star; their scripts were in the scratchpad):
  - Dead stars, one law per kind in every age (`physics.ts`): `dwarfCoolingK` (Mestel, then
    t^-0.58 from `DEBYE_AGE` 5×10¹¹; capped at a red dwarf's flare peak), `brownCoolingK` (Burrows
    et al. 2001), `formedAt` (a hash of the mass: no random draw, so old saves get it too; since 13 Oct one
    in ten young, `YOUNG_SHARE`: white 1 to 12 billion years, brown 0.4 to 2 billion),
    `giantHeatK`, `rekindledK` (`REKINDLE_SUNS`). `ownTemperature` no longer reads the era; dark
    matter warms from the Dusk on (`emberShare`, `haloShare`). Luminosities are `glow(R)` of the
    temperature. Neutron stars 900 K in the Dusk too. `SKY_K` 2.2×10⁻³⁰.
  - The galaxy's glow `backgroundK` (1 K in the Dusk, 10 mK from the embers, then the horizon);
    `primaryTemperature` adds it to every dead star, `starClimate` to every world.
  - `lightUnitSuns(era)`: one unit of collector light in L☉ (1.15×10⁻³ in the Dusk, an ember's
    4×10⁻¹² after). A black hole's `primaryLuminosity` is its `diskLight` in those units, so its
    worlds are warmed by it; `diskLight` is 0 once matter is gone. Brown dwarfs give collectors
    all their own light in those units (ember scale after the Last Light).
  - The flare by mass for new games: `flarePeak` (gen.ts) sets `blueK` / `blueLum` on red and
    blue dwarfs and the home star; without them (older games) 8,200 K and min(0.4, 2M).
  - `starClimate`: only the starlight divides into day and night (the world's own heat and the
    glow warm both); belts are never locked; the steam ground is `steamGroundK` (Selsis et al.
    2023). `BodyClimate.airless` (bare rock and rubble without Atmosphere Works): `waterState`
    gives no liquid there. `buriedOcean` (tides of a star, core heat after the Last Light) for the
    chip and the water text. `frozenHard` (warmest ground below 195 K): no Kin room, in
    `kinBaseCapacity` and `naturalKinRoom` (now with `scorched` and `thawed` as well).
  - Names (labels.ts): `eyeballFace` (Eyeball sea / Eyeball world), `waterChanged`'s
    'terminator' (Terminator world) and 'scorched' (night side thawed); `onceWas(b)` from its past.
  - Display: `shownTraits` hides what is no longer so; `SunlightRow` ("none: its star gives
    none", "(most)" / "(least)" against `insolationByDistance`); `FallsInwardRow` only for stars
    that take worlds in; `mult` (fmt.ts) for small multipliers; cold white dwarfs drawn as embers
    (`coolDwarfShine`, galaxyView.ts, below 780 K).
  - The Heart takes its worlds when it swallows a system (one adrift drifts on, and the system
    stays, void, for it); `migrate` clears the leftovers of older games (no version bump: a repair).
  - Generation: `addOuterWorlds` (gen.ts, its own `Rng` per system from a hash, after everything
    else; trait `outer`, hidden, kept out of the sunlight standard); `waterFromTheStart` keeps a
    locked water-poor world's water when its night side is frozen; the home ice moon is locked.
  - Infrared Shrouds (`infrared_shroud`, Ember Harvest) for brown dwarfs; `notAt` on a structure
    stops it being built at, and gathering from, those primaries (solar arrays, orbital
    collectors and Dyson swarms at brown dwarfs).
  - Attack (hunger.ts): `attackSwarm` (click time, one `withRng`, all checks before the draw),
    `attackOdds`, `warshipsAt`, `attackBlocked`; once a turn per star (`civ.flags.swarm_attack_<id>`).
    The autoplayer never attacks, so the harness's games are untouched by it. Map picks on a swarm
    mean its star (main.tsx `starOf`). Rust fades in `fadeRust` (`RUST_FADE` 0.1).

- **`src/game/sim/flare.ts`:** the last flare.
  - `turnStep(state, pace)`: the calendar step, stopping at a settled star's `blueAt` and pinned
    to `flare_step` while `civ.flags.flare_until` is set. Used by turns, projection, the
    autoplayer and the UI.
  - `scorched` (night side > `SCORCH_K` = 340 K at a blue dwarf); `thawed` ('warm' 273–340 K,
    'hot' < 373 K; frozen wet worlds only); `THAW_ROOM` 5.
  - `scorchWorlds` (in `turn.ts`) takes 0.6 vitality and 90% of the water over a whole flare
    from every scorched world, any kind, by the share each turn lives through (`scorch`, one
    share); since 8 Oct dead worlds lose their water too, water-rich ones keep theirs, and life
    dies at once where even the night side is past `LIFE_LIMIT_K` (395 K). A world whose life runs
    out dies (`worldDies`: surface life to bare rock; one dead of its decline under a burning star
    keeps its kind's rule, ice if wet, and the Record says its sea is still open).
    `scorchedFromTheStart` (8 Oct, called by `newGame` after `waterFromTheStart`, no random
    draw) gives a new galaxy's scorched worlds the share already lived through before turn 1, so
    a flare well on has killed what it scorches (check `unit/scorch`).
  - `flareHeat`, `flareData` (event numbers), `sheltersNeeded`, `digShelters`,
    `keepTimeWithFlare`, `flareClock`.
  - Constants: `FLARE_TURNS` 6; shelters 3 Kin, 10 matter, max 4.
  - The event is `last_flare` in `data/events.ts`; the structure is `night_shelter`.
  - **The new-star clock** (3 Oct), the same file: `keepTimeWithStar` sets `civ.flags.star_until`
    (the star's `diesAt`) and `star_step` (what was left of its life ÷ `STAR_TURNS`, 6). While
    `starTurnsLeft` ≥ 1, `turnStep` (Degenerate Age) ends each turn at `star_until − step × (left −
    1)`, counted back from the end so rounding can neither add a turn nor stall one, whatever the
    pace, and `livedShare` is 1. `starClockTerms` (what it would take, at the current pace):
    `possible` needs a burning collision or helium star, no clock running (one at a time, or
    clocks would pass from star to star and hold the age still), a step of at least
    `STAR_STEP_MIN` (1e-13) of the age (doubles; `brief` when not: helium stars after about
    η 20.5), and fewer than six turns of life at our pace; `orders` = log10(next turn ÷ life
    left); `cost` = 0 within `STAR_FREE` (2) tenfolds, then `STAR_ORDER_COST` (250) a tenfold,
    at most the full storage (`reserveCapacity`, now in `sim/storage.ts` so flare.ts can read it
    without a cycle through economy.ts, which re-exports it). `starClockOffer` = possible and
    affordable; `keepTimeWithStar` takes the price and returns it (or null). `clearStarClock`
    runs in `stepTurns` and after each turn; `starClock` feeds the Pace panel chip and the
    Collision stars tab. New stars light at the end of their turn (`physics.ts`: `born = to`,
    the old draw still made). Brown-dwarf collisions need a bound galaxy: `bound` in
    `evolveUniverse` tapers their rate from 1 at η 18.4 to 0 at 21 (helium-star mergers go on to
    η 25). Events (`data/events.ts`): `newStarTiming`, `newStarClose`,
    `keepTimeHint`, `keepTimeNote`, `studyStar` (Study it / Watch the flash: insight +25,
    resolve +2). A choice's `hint` may be a function of the moment: read it with `choiceHint`
    (the event window and the autoplayer do). The autoplayer (`clockTooDear` in `auto.ts`) pays
    for a clock only while half its store would remain.
  - **Following on** (3 Oct): while a clock runs, `starClockTerms` prices a star that outlasts it
    as a fresh clock at `from` = `star_until`, at our own pace, never below `STAR_FOLLOW_MIN`
    (250; `floor` says the floor set it) and still capped at a full store; `after` names the star
    it follows. `keepTimeWithStar` then sets `civ.flags.star_next` (the queued star's `diesAt`)
    instead of the clock; `clearStarClock`, when the clock has run out, starts the queued one
    (`stepTurns` calls it too, so forecasts follow). One waits at a time. `why` says why there is
    no clock (`this`, `waiting`, `inside`, `unneeded`, `brief`, `gone`), for the event texts.
    `starClock` also gives `left`, `next` and `nextId` (Pace chip "then …", tab chip "next").
    Study it / Watch the flash chart the system (`studyStar(s, d)`); keeping time charts it.
  - **Helium giants and the flash** (3 Oct): a giant is born at `to` (`bornAt = to`, `diesAt = to +
    GIANT_LIFE`), so it shines through the next turn and converts as that ends; the `'giant'`
    note queues the event `helium_giant` (Keep time with it / Watch it swell). `isNewStar`
    includes giants. When six turns would be too brief and no clock runs, `starClockTerms`
    offers a flash (`flash`, `flashUntil`): one turn ending at `diesAt`, or at `years · (1 +
    STAR_STEP_MIN)` once that is later (past about η 18.1), priced like a clock. `keepTimeWithStar`
    sets `star_until`/`star_step` for that one turn and `civ.flags.star_flash` = the star's
    `diesAt`; `sourceLight` then counts the star's light in full for the turn (a bend where the
    turn outlasts it), `starSplit` returns 1, `starClock` finds the star by `star_flash` and
    reads turn 1 of 1 with `flash`, and `clearStarClock` deletes `star_flash`. The Pace chip says
    "Star flash · X · one turn"; the system panel's light row says "burns X of a Y turn" for a
    new star that will burn out inside the coming turn (unless it is the flash).
  - **White dwarf cooling** (3 Oct, `physics.ts`): `coldDwarfK(years)` (20 K at 1e15, Mestel
    T ∝ t^-0.35, clamped 5–20 K), `DWARF_COLD_AT` (5.2e16, where it reaches 5 K), `dwarfGlow`
    (light share by T⁴, 1 → 0), `emberShare(p, years)` (1 to η 22, linear to 0 at 25; 0 off the
    halo or not a white dwarf), `dwarfRadius`. Unwarmed Degenerate white dwarfs: T =
    `coldDwarfK`, light 0.01 + (0.05·gf − 0.01)·glow + rek, L = (T/5772)⁴ r²; embers T = max(cold,
    63·share^¼), L = max(cold, 4e-12·share), light unchanged. `evolveUniverse` turns a non-Dusk
    white dwarf black once `to ≥ DWARF_COLD_AT` and `emberShare` is 0 (replaces the η 25.5 rule).
    Rekindled white dwarfs read 300 K. `galaxyView` `nodeColor` and `systemView` blend by glow
    and share. Tested and not shipped: cast-out embers losing `halo` (see CHANGELOG).
  - **Record and Systems window** (3 Oct): `resolveEvent` logs `Title (System): choice.` with the
    system id. The Systems window takes `send` (a stationed fleet's id): `sendFromSystems(s, f)`
    opens it (collision stars first while any burn), `SendButton` orders a move and shows the
    fleet. Opened from the fleet panel's More in Systems… (`.more-dests`) and the ship prompt.
  - **Cast-out embers** (3 Oct): `Primary.haloLeft` (optional) is the year a halo white dwarf
    left the galaxy: set when evaporation ejects it, and at the start of any turn for an ejected
    one without it (older saves; other ways out). `emberShare` multiplies by `1 − (η − η_left)`,
    so the warmth is gone a decade on and the dwarf turns black. `settleScore` uses `emberShare`.
  - **Quickening during a star clock** (3 Oct): `starSplit(state, pace)` is `STAR_SPLIT` (10) with
    `quickening` at pace ≥ 1 (if a tenth of the step is still at least `STAR_STEP_MIN` of the age),
    else 1. `starTurnsLeft` counts in those steps, `ceil(x − 1e-6)` (a turn that starts between
    steps runs to the next one), `turnStep` ends turns on them, `livedShare` is `1/split`.
    `keepingStarTime` is now "the clock's end is still ahead" (by more than a millionth of a
    step), so a split clock is not cleared early. `starClock` gives `split`; `of` is 6 × split.
  - **Greyed paces** (3 Oct): `paceMatters(state, pace)` in `flare.ts` compares the coming turn
    (`turnStep`: length and η) with the next pace toward the Tide; the Pace panel greys a pace
    that changes nothing (class `disabled`, `aria-disabled`, so its tooltip still shows; clicks
    ignored) and `paceWhy` says why. `setPace` itself still allows any pace in range.
- **`src/game/sim/hunger.ts`, `swarmsHunt`:** swarms catch ships stopped at their star where we have
  no settlement (`HUNT_AWAKE` 0.7, `HUNT_ASLEEP` 0.2 a turn, ×0.5 under Blackout; skipped on the
  first-swarm turn and under Communion). It runs after `firstSwarm` and before `autoExplore`, so
  arriving probes are at risk before they set off again. `swarmSeenAt` (util.ts) is what the map
  shows: `autoExplore`, the autoplayer and the destination list's "swarm" chip use it.
  - **Parts sent after ships** (11 Oct, `updateHunger`): `sendHunter` lets an awake, untamed swarm
    of size `HUNT_MIN_SIZE` (2) or more notice the nearest of our ships stopped within
    `HUNT_REACH` (25 ly) at a star with no settlement of ours, no untamed swarm and no part already
    after it, on `HUNT_NOTICE` (0.3) of turns (×0.5 under Blackout; not before `first_swarm`, nor
    on its turn, nor under Communion). The part (1 to 1.6, taken from the swarm) carries
    `Swarm.prey` (the fleet) and `Swarm.nest` (its swarm). In `swarmsHunt` it strikes its prey
    with no draw (`sw.prey === f.id`); while the prey is there it does not move on. Once the prey
    is not where it is (`loseTheScent`, on arrival and each turn) it goes on to the nearest
    settlement of the prey's civilization (`nearestOf`; 14 Oct, harder), dropping `nest`: a swarm
    of its own from then on, which feeds there and strikes the settlement as any swarm. Only if
    that civilization has none (or lives in Communion) does it head for its swarm's star or
    destination (`headForNest`) and on arrival merge into it (`rejoin`), following it if it moved
    on; with its swarm gone or tamed it is a swarm of its own. None of these take a draw. Taming
    and `drawSwarmTo` clear both fields. Swarms travel at 0.05 × the turn length in light-years
    in the Dusk (2 ly a turn at a 40-year turn), so a part can take several turns to arrive.
  - **Ships at a settlement** (11 Oct): `hurtShipsAt` — scratched (0 to 0.4 × size, as before)
    when the defenders win, and 0.2 to 0.6 × the swarm's size each when it breaks through (before,
    untouched). A fleet that loses ships says so in the log.
  - **Messages:** `log(..., fleet)` sets `LogEntry.fleet`; `turnflow.ts` shows the turn's entries
    that carry one as messages (two at most), with Look going to the fleet. The ship's panel says
    when a part is coming for it or is there; the swarm's panel says whom it is after.
- **`src/game/sim/sites.ts`:** `powerParts`/`powerAt` (Hearth plus every buildable collector,
  arrays × insolation), `matterAt`, `lastsUntil`, `siteValue(state, body, thread)` →
  `{score, label, tip}`. Used by the settler lists and the Surveyed worlds sorts.
- **`src/game/sim/homes.ts`:** `survivorWorld` (by way of life; never a world we settled),
  `residentsOf`, `survivorPeople`. `canSettle` refuses their world; Seize takes it.
- **`src/game/sim/archive.ts`:** `welcomeEchoes` (event Echoes into free substrate, else
  `civ.flags.echo_archive`) and `wakeArchivedEchoes` (each turn, before growth).
- **`src/game/sim/survivors.ts`:**
  - Raid: `RAID_COOLDOWN` 5, `raidTarget`, `raidStrength`, `raidSurvivor`.
  - Ask: `ASK_COOLDOWN` 8, `askBlocked`, `requestAid`. The answer is an `aid_answer` signal at
    distance × 2; `turn.ts` credits its energy on arrival.
  - Their own raid branch has three motives: desperate, revenge (`raidedAt`), and opening
    (`tempted`).
- **`src/game/physics.ts`:** `insolation(state, body)` (inverse square vs the standard orbit;
  burning stars 0.031 AU × (M/0.1)^1.15, remnants the system's middle orbit; 0.05–2.5). Blue
  dwarf `sourceLight` follows the flare's share of the turn.
  - `vitalityLoss(state, body, colony)`: what `declineWorlds` (`turn.ts`) takes each turn,
    `decline` (settled worlds) and `freeze` (5%, half with a Core Stimulator, none under
    Orbital Lamps): after the Dusk, when rogue, or `sunGone` (surface life, star not
    `isStarLike`) and the warmest ground below `FROZEN_K` (195 K). `turnsToFreeze` steps it
    as the turn does, in floating point, for the panel and the Record.
  - `frozenFromTheStart` (called by `newGame`, after generation, no random draw): living worlds
    already below `FROZEN_K` start as ice or rock.
  - `waterFromTheStart` (after it, 8 Oct, no random draw; it replaced the same day's
    `dryFromTheStart`):
    - Water-rich icy worlds are ice-shelled oceans, and ice worlds with water at least
      `WATER_RICH` (0.5, the wetter half). They keep their water and get the trait `water_rich`.
    - Water-poor ones whose warmest ground is at or above `ICE_MELTS_K` (273 K) start as bare
      rock: richness mapped into 1.0 to 1.7, water re-derived from their seed (`defaultWater`),
      the buried ocean dropped.
    - A star in its last flare is judged by its red-dwarf light, and the home system is left
      alone. Every other world and star stays as generated (check `unit/icy`).
    - A water-rich world that is a steam world starts lifeless (vitality and decline 0).
  - The runaway greenhouse, in `starClimate`: a `water_rich` world whose mean from starlight
    (`t`, before the Atmosphere Works step) is at least `RUNAWAY_LOCKED_K` (300 K, tidally
    locked: nearly twice Earth's sunlight) or `RUNAWAY_K` (276.6 K, otherwise: 1.4 times
    Earth's sunlight, the player's figure, Kasting 1988) gets a steam sky, day = night = mean =
    max(`STEAM_K` 1,500 K, t). It is live: shading or dimming below the limit gives the plain
    climate back. Orbital Mirrors judge by the bare climate (1,500 K), so they shade a steam
    world, and `terraformBlocked` lets them build where half the light is below the limit (14 of
    30 steam worlds in six galaxies, all tidally locked to red dwarfs). A flare counts like any
    light: a water-rich world it takes past the limit is a steam world, never `thawed` (an
    unlocked one thaws only between 273 and 276.6 K), while the water-poor still thaw.
    `steamWorld(state, b)` tells the labels, and `declineWorlds` (`turn.ts`): life on a steam
    world dies with the turn, logged for ours and surveyed worlds. Only new games have `water_rich`, so
    old saves' climates are unchanged. `youngDwarfLight(a, b)`: a Dusk white dwarf's
    collector light averaged over ages a..b (the power law integrated, then the 0.02 floor); since
    13 Oct one the galaxy began with gets it too, from `formedAt` (an old one: the floor).
  - `bodyClimate` holds a world under Orbital Lamps at `LAMP_K` (285 K) at least
    (`starClimate` is the star's part); a floor, so it never adds to a flare.
- **`src/game/sim/flare.ts`:** `livedShare(state, pace, step)` is the pace factor everything
  scales by (yields, projection, tempo strain): 10^-pace, `1/split` on a new star's clock, and
  since 20 Oct the Tide turns covered on any other turn a clock, a flare or the age's end sets
  (until then 1 on a flare-clock turn and at most 1 on a turn cut short by a flare's start).
  Upkeep reads `upkeepShare`.
- **`src/game/sim/economy.ts`:** Kin surface room is 0 when scorched and ≥5 when warm-thawed;
  Solar Arrays × insolation. Focus: Matter (+25%) touches only matter raised by mines, skimmers
  and lifters; no other focus touches matter (the −10% applies to energy, industry, insight and
  accord).
- **The fate of matter (`src/game/fate.ts`, 7 Oct):** `state.fate` is 'decay', 'stable' or
  'curvature' (saves before version 3 follow `protonsDecay`, which still means decay). An Unknown
  fate is the old single draw (`drawFate` in `gen.ts`: below 0.5 decay, below 0.75 curvature).
  - Two clocks. `calendarEra()` is the Tide's and the fixed-date physics' (outside decay games,
    years below 10^40 are the Degenerate Age's); `state.era` is the age the player sees (intro,
    music, art, event pools). `ageReached`/`inAge` open what belongs to an age when either gets
    there. `DEGENERATE_END` (decay 39, stable 30, curvature 68) is where `ageOver` ends the
    Degenerate Age; without decay the calendar turns on its own at η 39 (`calendarTurnDue`,
    `calendarTurn` in `turn.ts`: the years jump to 10^40).
  - `fateKnown`: chosen, The Proton Question, `civ.flags.fate_known` (set by `revealFate` in
    `turn.ts` at `FATE_SHOWN_AT` 30, which queues `decay_shown` or `curvature_shown`), or past the
    Degenerate Age. Until then nothing may differ by fate: decay and curvature warmth show only once
    known (`decayWarmth`, `curvatureWarmth`), `forecast.ts` asks "The end of the Degenerate Age?",
    the Chronometer hatches η 30 to 68 (`milestonesFor(null)`), and the autoplayer plans for decay
    (`plannedFate` in `auto.ts`). `unit/fates.ts` plays three blind games to η 29 and requires them
    identical but for the fate; anything new that reads `fateOf` must keep it so.
  - `matterGone`: `civ.flags.matter_gone` (set by `endOfMatter` in `crossing.ts`, at the Great
    Decay or the Great Evaporation), or decay with the calendar past the Degenerate Age. It drives
    matter-as-energy, salvage and mining.
  - Curvature: `evolveUniverse` fades white and black dwarfs at `dwarfFadeEta(mass)` (78 to 85) and
    brown dwarfs at `BROWN_FADE_ETA` 87 through `evaporateHole` (note `faded`); `burstNeutronStars`
    at the Last Warmth; `greatEvaporation` at `MATTER_END.curvature` 89.5 is a crossing report with
    `from === to` and a `title`, which the crossing screen shows as a storm inside the age.
    Curvature Collector: `curvature_collector`, tech `curvature_harvest` (`needsCurvature`).
    Curvature warmth (8 Oct): `curvatureK(massKg, radiusM, lifeEta)` (×1.17, fitted to Falcke et al.'s
    25 nK and 5.5 pK) for white and black dwarfs (`dwarfRadius`, `dwarfFadeEta`), brown dwarfs
    (`BROWN_R` 0.1 R☉, `BROWN_FADE_ETA`) and worlds (`worldCurvatureK`, `MATTER_END.curvature`), in
    `ownTemperature` and `starClimate` only when `curve` / `curvatureWarmth` is on. Light from a
    dwarf's glow (`sourceLight`) never passes `curve`, so collectors gather the same; neutron stars
    keep `CURVATURE_NEUTRON_K` 30 nK. `unit/curvature`.
  - Texts by fate: `ageIntro`, `crossingName`, `milestonesFor`, `deepMilestonesFor` (`eras.ts`);
    `proton_answer` has three answers.
- **Taking structures apart (`src/game/sim/actions.ts`, 7 Oct):** `dismantleTerms` (the matter back
  at today's `buildCost`, so energy once matter is gone; the work a fifth of `d.cost` in energy,
  at least 5), `dismantleCheck` (people or sleepers left without room by `capacity` on the colony
  with one fewer, the last Shipyard while ships are queued, energy) and `dismantle`. Once-only
  effects (`hasOnceEffect` in `data/structures.ts`: `vitalityOnce`, `coreHeatBonus`, a Confluence
  Node's count) are skipped on completion while `civ.flags[dismantledKey(colony, id)]` counts one
  taken apart there (`applyIndustry` in `turn.ts` uses one up). A swarm or an overdrive accident
  that wrecks a building leaves no mark, so rebuilding it repeats its effect, as before. The
  economy marks a collector with nothing to gather on its yield line (`YieldLine.idle`); the
  autoplayer's `planDismantle` takes one of those apart a turn when matter is under 40, only
  where the source is gone for good (`GONE_FOR_GOOD`: light, geo, spin, hawking, rekindle). The
  panel's × (Overview, Structures) arms a confirm line.
- **The Long Flow (`src/game/sim/flow.ts`, 7 Oct):** `FLOW_ETA` 65. `theLongFlow` runs in step 7
  of the turn, after `evolveUniverse`, with the η the turn ends at: the first time (`flowAhead`:
  not decay, matter not gone) it sets `civ.flags.flowed`, marks `relic.flowed` on every relic not
  kept by a Relic Excavation with someone awake (a hidden one stays hidden, and a survey no longer
  finds it), and queues `long_flow` with the count of found ruins lost. Then, while `flowing`
  (flowed and matter not gone), each settlement `keeping()` calls 'unmanned' loses `nextToFlow`
  (cheapest by industry cost, Cryo Halls last, never `decayProof`), the sleepers beyond the
  remaining berths with a Cryo Hall, and is destroyed once empty. `keeping`: Kin or Lattice →
  'kept'; any Echo, Chorus or Coldmind whose `strainFor(...).clock` is under 65 → 'kept'; minds
  all slower → 'watched' (`FLOW_WATCH` 1.5 on their upkeep in `colonyTurn`); no one awake →
  'unmanned'. `FLOW_DORMANT` 0.3 replaces dormancy's 0.1 (The Long Watch's 0.05 stays). Survivors
  of the `dormant` way drain ×2 while flowing. `relic_dig` gives no insight on a flowed ruin and
  cannot be built on one. Display: `uFlow` in `PLANET_FRAG` (relief and detail settle; city
  patterns keep `cityDetail`), `asteroidBelt(..., round)` (icosahedron detail 1); the panel's
  "flowing away" / "keeping watch" chips. Autoplayer: `planFlow`.
- **Living neighbours (Part C, `src/game/sim/survivors.ts`, 7 Oct on):** everything between us and
  another civilization moves at the speed of light. `beamEnergy` queues energy on
  `Survivor.beams` (arrival in cosmic years; `known` if our clocks were in step, `plea` if they
  asked); `spreadNews` queues a change of heart on every other civilization's `news`, timed by
  the light from the star where it happened; `reachThem` (start of each survivor's turn in
  `updateSurvivors`) applies what has arrived, and answers a great wrong (≤ −20) with a `heard`
  signal. The Taint ceiling (100 − 1.5 × Taint) and `inStep` are checked there too: their clock within
  3 tenfolds (6 for the Lattice) of `voiceRange` in `signals.ts`, any rhythm from our voice clock
  to our turn's (since 8 Oct; before, the voice clock alone). `stepGap` says how far outside it a
  clock lies and which way (the cards' "in reach / too slow for us / too fast for us"); `reachBy`
  finds the nearest pace that reaches a mind (each pace's own `turnStep`), the tenfolds the turn
  would need, and which of our other Threads would reach it (`rangeWith`), for `stepHint` in
  `Signals.tsx`; the Slow Ones (`minds.ts`) use the same span, at 2.5. `settleNewcomers(state, thread, n)` places
  newcomers where there is room (capital first; Kin overflow into berths) and returns how many came.
  `forkHome` in `society.ts`: the nearest known star no one lives at. Signals keeps a heavy
  choice (Seize, Devour) armed until confirmed.
  Pacts (`src/game/sim/pacts.ts`): `Survivor.pacts` (kind → turn sealed) and
  `Survivor.proposal` (`{ kind, at, cost, answered? }`). `proposePact` spends `pactCost` accord
  (`PACT_BASE` 30 × `PACT_RISE` 1.6ⁿ, n = pacts in force or proposed) and times the proposal with
  `lightAt`; `reachThem` calls `weighProposal` when it arrives, which answers with a
  `pact_answer` signal (it takes the distance back) and marks the proposal `answered`; at the
  signal's arrival `turn.ts` calls `answerArrived`, which seals it or refunds. `theirPacts` (their
  turn in `updateSurvivors`): renounce all below −10 (`pact_ended`), offer one above 30
  (`pact_offer`, 12% a turn). `pactsTurn` (after `updateSurvivors`): Mutual Aid both ways
  (`pact_aid_out_<id>` / `pact_aid_in_<id>` in `civ.flags`, `AID_EVERY` 6; theirs is an
  `aid_answer` signal over twice the distance) and Open Archives (`NOTES_EVERY` 10). Shared
  Watch: `updateDetection` eyes, `defenseAt` +0.5 a partner, a swarm's harm to a partner ×0.7.
  Autoplayer: `planPacts`, and `pact_offer` in `planSignals`, both keeping `ACCORD_KEEP`.
  Refuge (`src/game/sim/refuge.ts`): `askRefuge` (their turn, before the five-turn message gap):
  health under `DYING` 0.2, in step with us, `mayComeToUs` (a pact; Sanctuary and goodwill 20;
  the Choir and our Confluence at 10), once (`Survivor.exodusAsked`); an `exodus` signal.
  `takeThemIn` sets `Survivor.exodus` (`leaves` when our answer's light arrives, `at` after
  their crossing: light for minds, `EXODUS_SPEED` 0.02 c for Kin); `onTheirWay` (right after
  `reachThem`) skips the rest of their turn once they have left and calls `arriveAmongUs` at
  `at`: Echoes through `welcomeEchoes`, others through `settleNewcomers`, the rest crowded into
  the capital (the growth step loses one a turn per Thread over capacity), or for the Choir
  merging into our Chorus, the rest as `MEMORY_INSIGHT` each; fate 'saved' or 'absorbed', an
  `arrived` signal, news +8. Sanctuary: `sanctuaryHeard` on enact and repeal (news tagged
  `sanctuary`, ±10), `sanctuaryTrust` after the Taint ceiling (+0.5 a turn to
  `SANCTUARY_TRUST` 25, not below 0 and not while the news is on its way). Autoplayer: takes
  every exodus.
  Expansion (`src/game/sim/claims.ts`): `expand` (their turn, after the drain) sends settlers
  (`Survivor.claim`, `CLAIM_CHANCE` 0.06 a turn, health over 0.5, pop 12, at most `MAX_CLAIMS` 3)
  to `claimTarget`: the nearest star within `CLAIM_REACH` 100 ly that `suits` their way and is
  not `taken` (ours, another's, or another's target); on arrival at `CLAIM_SPEED` 0.02 c it joins
  `sv.systems` with `claimedAt` (cosmic years), unless taken meanwhile. `claimEase` divides their
  drain. `seenThere` / `starsSeen` / `residentsSeen` show a star of theirs only once the light of
  their arrival reaches our capital (the map's `aOthers` attribute in `galaxyView.ts`, a dashed
  ring; the panels; the card's Stars row), while `residentsOf` (no delay) still blocks settling
  their world. `theirWarmth` adds 0.1 × pop × health to a star's pull in `moveSwarm`.
  `askAgainstHunger` (`swarm_plea`, `PLEA_EVERY` 10 via `swarm_plea_<id>` in `civ.flags`),
  `promiseHelp` (`Survivor.promised`), `judgePromise` after `PROMISE_TURNS` 10, and `foughtFor`
  (called by `swarmsHunt` when our ships beat off or break a swarm). Autoplayer: refuses pleas.
  War (`src/game/sim/war.ts`): `Survivor.war` (`since`, `siege`). `declareWar` (`WAR_ACCORD` 60,
  resolve −5, dissent +8, standing −3 or −1 with a `warCause`: a fork, or two raids on us within
  `RAID_SPAN` 20 turns, remembered by `raidedUs` as `raid_last_<id>` / `raid_prev_<id>`), ends
  pacts through `endPact`, news −40 to them and −15 (−5) to the others, `civ.flags.wars` counts.
  `warTurn` (after `pactsTurn`): dissent +0.5 a turn (+0.2 with a cause); warships at their first
  star hold the siege (`BLOCKADE` 0.03 of their health, their fire on our ships), else it resets.
  `warDefence` grows `ARMING` 15% a turn of war. `seizeSurvivor` needs `seizeBlocked` null (war,
  warships, `SIEGE_TURNS` 3) and wins a roll (attack × 0.6–1.4 against their defence); a fork
  comes back whole without Taint. `warHeat` (capital +8, a siege +10) and `inCoalition` (hostile
  below −20 while we fight anyone: raids at 0.5). At war: no pacts, offers, asking, aid pleas,
  refugees, trade, joint income, exodus or swarm pleas. Strategy 'warlike' (`planWar`) wages the
  wars with a cause, for the harness only.
  Ways that meet (`src/game/sim/ways.ts`): `wakeForNewStar` (the dormant way, before `expand`:
  a new star within `WAKE_REACH` 100 ly with a cold world, health over 0.25, sets `claim` at once
  and sends `woken`); the Tessellate in `pacts.ts` (`theirPacts` never renounces for it;
  `pactsTurn` lets it pay while failing, and calls `breach` when its Mutual Aid falls due and we
  cannot spare 5: `breach_<id>` in `civ.flags`, at `BREACHES` 2 `pact_ended`); `choirWish` (after
  the message gap; `CHOIR_EVERY` 25 via `choir_wish_<id>`, `CHOIR_TAKES` 2 Echoes) and
  `answerChoirWish`; `clockPartner` in `flare.ts` (a partner with any pact living at the star:
  `StarTerms.shared`, half the cost); `drawTheirSpin` (their turn, Black Hole Age, `SPIN_DRAW`
  0.04 × pop × health a hole, half for a partner; their drain ×0.85 when they draw) and
  `spinSharers` (the system panel's Spin row). Autoplayer: lets the Choir have the Echoes who
  wish it.
  Dealings (`src/game/sim/dealings.ts`): `termsFor` (what each way wants, `share` of a project
  its notes are worth, `rate` of insight per unit, `every` turns between offers; a fork as its
  Thread), `tradeOffer` (notes on our project, or the cheapest open one; ask at their rate, at most
  `ASK_MAX` and half of what we hold, none under `ASK_MIN` or with nothing left to learn),
  `offerDue` / `offered` / `answered` (`trade_next_<id>`, `trade_no_<id>`, and the same for
  `joint`, in `civ.flags`: the rhythm doubles after each refusal, up to `BACKOFF_MAX`), and `feel`
  (regard, clamped to ±100, and `Survivor.memory`, the last `MEMORY` reasons, shown by
  `regardTip` in `Signals.tsx`). Every event that moves a neighbour's regard goes through `feel`
  except the standing drifts (the Taint ceiling, Sanctuary). A `trade` signal carries
  `{ ask, want, insight, tech }`; one without them (older saves) keeps the old 40-matter terms.
  Raids: `raid_wait_<id>` (`RAID_WAIT` 15) after our defences turned them away. `theirPacts`
  offers Shared Watch first when the Hunger is within 100 ly of their stars.
- **Decoy beacons (`src/game/sim/beacons.ts`):** `placeBeacon` (`actions.ts`, `BEACON_COST` 30,
  then `drawSwarmTo`, no random draw), `putOutBeacon`, `feedBeacons` (in `turn.ts` right after
  the economy is applied: `BEACON_UPKEEP` 3 × lived share each, in system order, dark when short),
  `beaconUpkeep` in `project()` and the HUD's energy tooltip. The pull itself is unchanged (+25 in
  `moveSwarm` while `sys.beacon`). Unrelated: `isBeacon` and the Systems "Collision stars" tab.
- **Terraforming (`src/game/sim/terraform.ts`, 7 Oct):** three Dusk structures, tech `terraforming`
  (Stewardship, after `comet_shepherding`): `orbital_mirrors`, `atmosphere_works`,
  `biosphere_seeding`, each with `terraform` set on its `StructureDef`, buildable on the
  `TERRAFORMABLE` kinds (`structureKind` puts them with the world's structures).
  - Climate, in `physics.ts`: `terraformingOf(state, b, c)` reads what the settlement keeps, and
    is none unless `terraformLit` (the Dusk, a red dwarf primary, not rogue or dissolved).
    `starClimate`'s fourth argument takes it (by default the world's own). Mirrors multiply the
    light by `MIRROR_GAIN` (2) where the warmest ground without them is below
    `TERRAFORM_TARGET_K` (288 K), and divide it above. The works warm a cold world ×
    `WORKS_GREENHOUSE` (1.15, never past 288 K) and give a locked world an air that carries
    `WORKS_CARRY` (0.7) of its heat round. `NO_TERRAFORMING` is a world as it is: `boilsUnder`
    passes it, so a new star boils what it boiled before.
  - Rules: `habitabilityOf(state, b, c)` is the world's own plus (0.2 for mirrors + 0.25 for the
    works) × `livableWarmth` of its warmest ground (1 from 250 to 330 K, 0 below 200 or above
    400), at most `TERRAFORM_CEILING` (0.55) and never below its own. `kinBaseCapacity`,
    `naturalKinRoom(b, state)` and the Worlds list read it.
  - Seeding: `seedingBlocked` (own habitability at least `OWN_LIFE` 0.5, below `SEED_MIN` 0.3,
    or water below `SEED_WATER` 0.05). `seededVitality` adds `SEED_RATE` (0.04) up to
    `SEED_CAP` (0.8), rounded to six places so it lands on the cap; `declineWorlds` applies it
    before the decline. The works' first completion sets water to at least `WORKS_WATER` (0.1).
  - `seededLifeUnkept` (`physics.ts`): seeded life on a world without surface life of its own
    freezes, 5% a turn through `vitalityLoss`, once neither mirrors nor works run (its star flared
    or died, the Dusk ended, or both were taken apart). The freeze message says so.
  - Interface: `terraformBlocked` in `structureCheck`; `buildableAt` in `sites.ts` skips them;
    `structureEffect` notes (habitability before and after, the warmth, the water, room waiting
    on life); `TerraformedRow` and `seededTip` in the settlement's World section (`Drawer.tsx`).
  - The autoplayer researches it after Volatile Shepherding and builds them after Warrens and
    Domes, where Kin are at capacity and `terraformSummary(...).full` reaches `SEED_MIN`.
  - Checks: `unit/terraform`, `browser/terraform`. No random draws, and old saves (no such
    structures) are unchanged; the check confirms both.
- **Every measure for a place (`src/ui/siteStrip.tsx`, 8 Oct):** `NEEDS` (the four measures, in
  the order of the sort buttons: livable for Kin, power for Echoes and the Chorus, matter for the
  Lattice, lasting for Coldminds; `needOf` maps the Chorus to power), `worldSites` (one world by
  every measure), `starSites` (a star's best world by each, among worlds that kind could settle),
  `bestOf` and `SiteStrip` (`active` outlines the measure the list is sorted by: `.mark.sorted`
  in `styles.css`, on the trip or distance for Nearest). Used by a fleet's Where to settle and
  Nearby lists (`FleetPanel`: a settler's Nearby follows its sort, `byMeasure`, the unsurveyed
  last) and by Surveyed worlds (`WorldsList`). All from `siteValue` (`sim/sites.ts`, interface
  only: the autoplayer never calls it), whose Kin figure is as terraformed.
- **A settlement's yields (`src/ui/yields.ts`, 8 Oct):** `YIELDS`, `yieldOf` (energy and matter net
  of upkeep), `yieldText` and `yieldTip` (its lines), shared by the settlement panel's yields and
  the Systems window's Our settlements columns (`.yield-cells`, `.yield-heads`; under 560 px each
  settlement's figures take a line of their own, with icons).
- **World kinds and climate:** `bodyTemplates` in `gen.ts` picks a kind by orbit at fixed AU,
  whatever the star's light, and for red dwarfs its last branch makes ice worlds at any orbit (91
  of 217 in six galaxies sit inside 0.06 AU). Its draws are left as they are, so every seed keeps
  its galaxy. Since 8 Oct `waterFromTheStart` sorts them, per galaxy: about 5 steam worlds, 3 with a
  sea on the day side, a rare twilight sea, and 7.5 water-poor ones dried to bare rock. The rest
  stay frozen. Games begun before keep their ice worlds, and a brightening star can warm one
  later. The climate names what they are in `bodyKindName` (`labels.ts`):
  - a steam world (`waterChanged` 'steam', with `bodyKindNote`'s runaway note when `steamWorld`);
  - `twilightSea` (an ice world or ice-shelled ocean with its day side past 373 K and its night
    side below 273 K: a hot eyeball), before the kind's own name, with `waterState` giving its
    terminator sea.
  The panel shows the buried-ocean chip only while ice is left over it (`shownTraits`: the
  coldest ground below `ICE_MELTS_K`), so not on a steam world or a flare's open sea; a twilight
  sea keeps it. The survey finds of ice, of a buried ocean or of dried seas (`clathrates`,
  `vent_life`, `fossils` in `events.ts`) do not fit a steam world. Checks `unit/twilight`,
  `unit/icy` and `unit/scorch`.
- **Evaporation (`evaporateHole`, `src/game/physics.ts`):** one rule for a hole that evaporates in
  the Black Hole Age and for every hole left at the Last Horizon (`crossing.ts`): the primary
  becomes `void` with no spin, glow or light, its worlds go rogue, settlements stay with all their
  structures, and the system is `gone` only if nothing is left in it (a Deep counts only with our
  settlement in it). A settlement keeps its system: `createColony` clears `gone` (taking back our
  own people who left us from the Deep of a hole gone since; 8 Oct), and `migrate` repairs a game
  saved with a settlement in a `void` system marked gone (`unit/settled`, `browser/settled`). A
  `void` system reads "No star left", and what was around it "drifts on". `hawkingLight` is 0 for
  anything that is not a hole, and storage that keeps its charge in a hole (Horizon Vault:
  `storesInHole` in `storage.ts`) holds nothing once it is gone. Before 4 Oct a hole's settlements
  were destroyed unless decay-proof, and the decay-proof ones (and every settlement at a hole the
  Last Horizon removed) went on drawing its spin and Hawking light from nothing.
- **Picking (`Engine.pickAt`, `src/render/engine.ts`):** a pickable with `radius` counts anywhere
  on its disc; a body's disc wins outright (score −1), but a swarm's cloud (`radius` 1.2× its
  drawn spread, in both views) only scores `SWARM_HAZE` (0.5), so a star, ship or world within half
  the reach of the pointer (8 px on the galaxy map, 13 px in a system) still wins over the haze.
- **`src/game/sim/accord.ts`:** accord's uses beyond charters, in the Threads window: Rally
  (resolve +3, 80 accord), Calm (dissent −4, 60), Hear them (one Thread's standing +5, 50). Each
  once a turn; the price doubles per use (`acc_<use>_heat` in `civ.flags`, `acc_hear_<thread>`
  per Thread) and eases by 0.1 of a doubling a turn (`coolAccord`, after `updateSociety`). Accord
  income was halved at its sources to pay for them (Thread rates 0.3 / 0.1 / 0.5 / 0 / 0.15,
  Commons 1, charters 0.25 a turn, Lattice resentment 0.125 a Lattice), so it is something to
  choose how to spend. The autoplayer (`planAccord`) keeps 30 for the next law and rallies under
  40 resolve, calms over 40 dissent, hears the lowest Thread under 35.
- **`src/game/sim/spare.ts`:** what a settlement with an empty queue does with leftover industry,
  `Colony.spare` (absent = Recycle, the old salvage, unchanged to the bit; chosen in the Build tab,
  under When nothing is queued; only a settlement with an empty queue and no choice is "idle" in
  the HUD reminder, which opens its Build tab via `openBuildFor` in `store.ts`). `SPARE_RATE`: Recycle
  0.1 matter (0.05 energy once the protons are gone), Study 0.1 insight, Tend 0.13 energy capped
  at `TEND_SHARE` (a quarter) of what the settlement makes, Morale 0.01 resolve; each a tenth of
  a building of that kind per point of industry (Foundry 3 industry, Archive Spire 3 insight,
  Mine 3 matter, Solar Arrays 4 energy, Commons 0.3 resolve). Applied in `applyIndustry`
  (`turn.ts`); Study's insight joins the turn's research.
- **`src/game/sim/governor.ts`** (27 Oct): `Colony.governor?: StructureKind` (optional, no save
  bump; `migrate` drops a kind it does not know; cleared when a settlement changes hands).
  - `governorChoice(state, c, ctx)`: of `buildableStructures` of its kind (`structureKind`), the
    most by `worth` (yield via `structureEffect`; People the room; Storage the reserve × Deep
    Storage; World and Defence 1 each, so the cheapest) per cost (industry + matter + energy ÷
    `MATTER_AS_ENERGY`), above 0.05; the first we can pay for keeping `GOVERNOR_KEEPS` (10 matter,
    20 energy); else `why` ("waiting for 20 matter for a Geothermal Tap", or "nothing more of X
    worth building here", `none`). Not while `civ.dormant`.
  - `governorQueue` queues it (`queueBuild`) and keeps `civ.flags[govNoneKey(id)]`: 1 nothing
    worth building, 2 waiting to pay, absent queued. `governed` (util.ts: not idle) and
    `governorBuilds` (the forecast leaves out spare work) read it; `isIdle` is the one idle test
    (the HUD's to-do chip, Our settlements).
  - Called in `applyIndustry` (`turn.ts`) before the turn's industry and after each build finishes
    in it, and at the end of the economy step for one still empty (income in); `setGovernor`
    (the UI) queues at once.
  - UI (`Drawer.tsx`): `GovernorPicker` (class `governor-picker`, not `kind-chips`, which the
    build-list checks look for), `GovernorSection` in the Build tab, the tick boxes (`.world-mark`)
    and `.governor-bar` under `SystemPanel`'s Worlds list (marks kept per star in component
    state), `.governor-chip` on a governed row. Checks: `unit/governor`, `browser/governor`.
- **Charters (`src/game/sim/actions.ts`):** `charterAvailable` (the book holds 5 light laws, 9
  with the Assembly of Threads; dark ones take no room), `enactCharter`, and since 2 Oct
  `repealAvailable` / `repealCharter`: a repeal costs the law's Accord again, subtracts its
  `stances`, adds `REPEAL_DISSENT` (3) and records `civ.flags.repealed_<id>` = turn, so
  enacting it again skips what it does once (Salvage the Dead's 40 matter and free-energy drain);
  repealing the Overdrive Protocols takes every Hearth off overdrive. Dark charters cannot be
  repealed. Every charter effect is a live `hasCharter` / `charter:<id>` check, so a repeal
  needs nothing else; Thread demands that ask for a law (Right to Stop, Merge Consent) open
  again. The autoplayer never repeals, so the harness is unchanged by it. UI: `ChartersModal`
  in `Society.tsx` (Repeal…, then Repeal for N accord / Keep it).
- **`src/audio/music.ts`:**
  - `PIECES`: what each age can play, in order: its recordings in `public/music` (title, dusk +
    dusk2, canon, degenerate + degenerate2, blackhole + blackhole2, dark, outcome) and its
    synthesized score (a piece with no `url`). The player's playlist (Settings → Playlist,
    `settings.playlist`: piece id → on; `pieceOn` gives the default, recordings on and the synth
    off) picks the `rotation`; `music.setPlaylist` is called at start-up and on every change,
    and restarts the music at once if the current age's rotation changed. A lone piece loops;
    several take turns: a recording fades out over its last `TRACK_CHANGE` (4 s, on
    `timeupdate`) and in over 3 s, hushing the synth under it (`layer.hushAt`); a synthesized
    piece brings the synth back for `SYNTH_SPAN` (170 s, on the audio clock: `layer.synthUntil`,
    checked in `tick`). A file that fails to load passes to the next piece, once round, then to
    the synth. `INTROS` (degenerate → canon, once per session, not when picked by hand, and not
    with Canon first off: `settings.overture`) plays before the rotation.
  - The tab hidden (7 Oct): nothing is suspended. The old `visibilitychange` handler suspended the
    context, and Firefox then started the recording over, with the synth in between. On show it
    resumes the context if the browser suspended it, and `layer.onShow` plays on a wanted
    recording the browser paused.
  - A layer whose age has a recording due (`recordingDue`: an intro or a recorded piece in its
    rotation) starts with the synth silent (`silenced`, the hiss at 0). It wakes the synth only
    if the recording has not started within `RECORDING_GRACE` (8 s), or fails, so the synth is the
    fallback, not a stopgap while a slow browser loads the file. Check `browser/music-hidden`.
  - How a recording reaches the speakers (15 Oct, `src/audio/trackOut.ts`): `trackOut(el)` gives
    an `ElementOut` where the browser lets a page set an element's volume (`elementVolumeWorks`:
    set 0.5, read it back; iOS Safari reads 1), else a `GraphOut` (the old route: a
    `MediaElementSource` into a gain into `audio().music`). `ElementOut` sets `el.volume` = its
    level × the films' hold × `musicLevel()` (the slider squared) × `MASTER` (0.9, the master's
    gain), on a 40 ms timer while anything fades, and at once when `setVolumes` runs
    (`onVolumes`). `fade(to, secs)` is a ramp on `performance.now()`; `holdElements(on)` fades
    every element out over 0.6 s and in over 1.2 s, as `duckMusic` does the graph (`music.hold`
    calls both). Do not make a `MediaElementSource` for an element that plays this way: once
    made, the element's sound goes only through the graph. Check `browser/music-route`.
  - The synth's echo (the layer's `send`, the snare's `wet`) goes into `audio().musicWet` (at the
    music's volume, `music² / 0.49`, so as loud as before at the slider's 70%), then `wetDuck`
    (ramped with `duck` by `duckMusic`), then the reverb. It went into `reverbIn` directly before
    the project check (15 Oct), so the slider at 0, or a film, left it heard. `music.hold` keeps
    its pause's timer (`holdTimer`) and clears it on every hold: a hold taken again within 0.7 s
    of one let go was paused by the first one's timer, part-way through its fade.
  - The reverb (`core.ts`): `impulse(ctx, 3, 3.2, 5.5)`, 3 s of noise decaying as
    (1 − τ/5.5)^3.2 with a 0.2 s fade at its end (it was the full 5.5 s). The interface's sounds
    send into it through one `bus` made once in `sfx.ts`.
  - `TRACK_CHOICES`, `setTrack`/`current`/`chosen` (Settings → Music track).
  - The synth hiss runs through `layer.hiss`, which fades when a recording plays.
  - `src/ui/store.ts`: `UI_SCALES` must stay above `settings`, because `loadSettings` reads it
    when `settings` is created. From `9ca1edc` to 29 Sep it sat below: the read threw, the
    `catch` returned the defaults, and saved settings were silently ignored on every load.
  - `startLoaded` calls `music.setEra`.
- **`src/render/camera.ts`:** `OrbitRig.centred` is set by `jump`, `flyTo` and `flyToFollow`
  (every caller puts the view on something on purpose) and cleared by a pan that is not sliding
  around a followed thing. While it or `follow` holds, `userZoom` ignores `zoomAnchor` and zooms
  about the middle, and `pinchPan` holds a pinch's midpoint drift back until it is clearly a
  drag (`PINCH_SLACK` 24 px, and more than the pinch's spread has changed). A new caller that
  moves the camera without meaning to centre on anything should clear `centred` afterwards. The
  playtest checks that a centred star stays in the middle under the wheel.
- **`src/render/shaders/bodies.ts` (`PLANET_FRAG`):** a world's look follows the local
  temperature `T` (night to day by `facing`), hoisted to the top of `main`: seas and steam for
  kinds 1, 2 and 5, `heatColor`/`heatGlow` for hot rock (added after the highlight roll-off, so
  night sides glow), lava from 1,400 K, magma and a vapour limb from about 2,600 K. `uWater` and
  `uLocked` come from `systemView.ts` (eyeballs count as locked). Every new block is gated on
  `uTempDay`, so ordinary worlds render exactly as before: check with a pixel comparison of the
  homeworld when touching it. Hot belts glow in `applyViewMode`, on the same curves.
- **Boiling (`physics.ts`):** `boilsUnder(state, b, kind)` judges a world by `starClimate` under
  `NEW_STAR_LUM[kind]`; `boilingAway` asks whether its star burns now. `evolveUniverse` notes the
  new star that shone during the turn (`shoneDuring`) before its death rewrites the primary, and
  after the per-body draws dissolves what it boils, with a `'boiled'` note (`swallowed` for a
  giant's inside). No draws of its own, so that turn's sequence stands; later turns shift.
  `turn.ts` evacuates a colony there (`evacuate(state, c, reason)`), `canSettle` refuses a doomed
  world (so the autoplayer never settles one), and `siteValue`, the forecasts, the labels and
  White Fire's text all read `boilingAway`.
- **`shownKind` / `newStarOut` (`physics.ts`):** a new star whose `diesAt` has passed is drawn,
  and its temperature and luminosity read, as the cold dwarf it becomes when the turn ends. Use
  `shownKind` wherever a kind picks a look.
- **`src/render/systemView.ts`:** other civilizations: `residents` from `survivorWorld`;
  surface civs set the planet shader's `uLights`/`uDev`/`uNeon` and the new `uCityCol` (sodium
  for ours); `addHabitats` builds flotilla / ring-station / lattice by way, `habitats` and
  `sleepLights` animate on elapsed time; labels in `engine.ts` use `residentsOf`. Whose world
  it is: our habitat ring (`hab`) and a surface neighbour's ring (`theirs`) carry
  `userData.mark`; in `update` the selected world's mark hides and the selection circle
  (`selRing`) takes its colour, with an opacity floor of 0.35 (0.12 and the pale `SELECT` on a
  world no one lives on). It holds still: since 7 Oct neither it nor the galaxy map's selected
  star ring (`galaxyView.ts`) pulses.
- **The films (part 4, `src/film/`):** `films.ts` defines each film as a `reel()` (shots cut on
  a beat grid, corners, labels, timecode, narration, title card) whose `setup(w, h, quality,
  args)` lays it out once and returns `draw(c, t)` and `text(t)`: pure in `t`, so never keep state
  between frames (`browser/films` compares a frame reached at 30 and at 144 frames a second).
  `FilmArgs` carries the fate and η. `cue.ts` schedules each film's sound from `SPECS` on any
  `BaseAudioContext` (`renderCue` for the videos). `player.ts` (`FilmPlayer`) draws on one canvas
  and keeps the words as DOM (`.film-line`, styles at the end of `styles.css`, larger under
  `html.lv`). `ui/screens/Film.tsx` mounts it on `document.body` (outside `#ui`'s zoom), stops
  the engine, ducks the music (`duckMusic`, the `duck` gain in `core.ts`) and plays the cue on
  `audio().film`. `playFilm(id, then, args)` (`store.ts`) honours `filmsOn()`: Settings, reduced
  motion, `?nofilms` and `__stel.films(on)`. `crossingFilm` and `endingFilmFor` map a crossing's
  title and an ending's name to films (`turnflow.ts`). Checks: `lib.cjs` adds `?nofilms` unless
  `start(name, { films: true })`; `__stel.filmFrames(id, times)` hashes frames, `__stel.filmList()`
  lists them. Videos: `tools/film-render.mjs` (needs an ffmpeg path, e.g. imageio-ffmpeg in a
  scratch venv; it starts `vite` on port 5179 for `film.html`; `--fate=` for the films that
  differ by fate, `--jpeg` for lighter frames; it waits out a page reload by the dev server).
- **The films' second cut (14 Oct):** every film is now a `reel2(def, make)` (`reel.ts`), whose
  `make(w, h, S, k, args, quality)` returns a `ReelSpec`: numeral, title, sub, `titleAt`, `eta`
  (the timecode's span), narration, an optional `card` under the title, and `scenes`, each
  `{from, to, enter ('fade' | 'zoom' | 'cut'), fade, draw(c, m), notes(m), assets}`. A `Moment`
  is `{b, t, p, w, h, S, k, q}`: the beat, the seconds, the scene's progress, the frame and the
  quality. `note(id, text, x, y, opacity, {align, tone, size})` places a label anywhere (x and y
  as fractions of the frame); ids must be unique within a film. Heavy paintings are `Lazy` jobs
  (`paint.ts`): list them in the scene's `assets` and the reel paints them a slice a frame ahead
  of their scene, or at once when a moment is drawn on demand, so a frame is the same however it
  is reached. Where things live: `dusk.ts` (the Long Dusk), `lastlight.ts` (the Last Light),
  `blackhole.ts` (`blackHoleAge2`, the Black Hole Age in three versions by `args.fate`), `dark.ts`
  (the Great Evaporation; the Last Horizon, its stable version by fate), `endings.ts` (the ten
  endings, `ENDINGS2`, through its `ending()` helper: 36 beats at 84, the title at 31), `holes.ts`
  (the holes' kit: the point lens, `drawRing`, `plainHole`, `quanta`, `lattice` for settlements of
  fields, `pairs`, `figure` and `axes` for charts, `paintDark` for the late skies), `paint.ts`
  (stars, worlds, skies, galaxies, `heatOf` and `HEAT_LUT` for what is seen by its heat, and
  `World`'s `heat` option), `hr.ts` (the H–R diagram's stars), `kit.ts` (layout, layers, the
  camera, a ship, `falseColour`). A film's cue is `SPECS[id]`, or `FATE_SPECS['id:fate']` where a
  fate's version cuts on other beats (`cueOf`); keep its cuts on its scenes' `from`.
  `src/film/saved/` keeps earlier versions the player may want back (not imported, so not in the
  game): to restore one, import it in `films.ts` in place of the current one (and, where its cuts
  differ, put back the cues its header gives: `lasthorizon-v1.ts`, the Last Horizon before the
  Heart's going opened it, 26 Oct). `supernova.ts` (26 Oct) is the film of a game's first
  supernova (`turnflow.ts`, `civ.flags.sn_film`); `FilmArgs.heartMass` (`heartMassOf`) gives the
  Last Horizon the Heart's own mass. `CueSpec` has three optional parts, `chirp`, `thumps` and
  `boom`, used by those two. A film that shows
  a body's temperature reads it from the game's own laws (`dwarfCoolingK`, `brownCoolingK` in
  `physics.ts`), as the Degenerate Age's specimens do.
- **The films on a tablet (15 Oct):** played in the game (`FilmPlayer` with `painter: true`, from
  `ui/screens/Film.tsx`), a film is laid out with `setup(w, h, q, args, false)` (its first scene not
  painted then) and its pictures are painted by `src/film/paintWorker.ts`, a module worker (Vite
  builds it as `assets/paintWorker-*.js`), which lays out the same film at the same size and
  quality and paints `scene.assets` (the reel's paintings in the order the film needs them, each
  once; the first `scene.first` of them are the first scene's) one by one, sending each through
  `transfer.ts`: `pack` turns an `OffscreenCanvas` into an `ImageBitmap`, a `World` into its
  `save()` (its tables and its picture), typed arrays into copies handed over whole, lists and
  plain records into their parts, and anything else into `local` (the page paints that one). The
  page `unpack`s each into a canvas of its own and `Lazy.fulfil`s the job; `player.ready` resolves
  once the first scene's are there, and Film.tsx starts the cue and the clock on the next frame
  (the screen dark meanwhile, "PREPARING THE REEL" fading in after half a second, `.film-wait`).
  Where there is no `Worker`, `OffscreenCanvas` or `createImageBitmap`, or the worker fails, the
  page paints as before (`warm`, a slice a frame). `canvas()` (`paint.ts`) makes an
  `OffscreenCanvas` where there is no document, so a painting job must not touch the page (none
  does; text is drawn in the frame, not in a job). `browser/films` checks that frames drawn from
  the worker's pictures hash the same as from the page's (`__stel.filmFramesApart`). `World`
  keeps only its disc's pixels with their light (`WorldPixels`) and each map point's colours
  (`texels`, nine numbers a point), and writes each pixel as one 32-bit word (`HEAT_WORD` for the
  thermal palette). `player.play` steps the frame's resolution down by a fifth (to 0.75 a CSS
  pixel at least) after a second of frames more than 45 ms apart (`resize`; the reel's crossfade
  layer follows the canvas's size). The music under a film: `music.hold(true/false)` (core's
  `duckMusic` to 0; the recording paused 0.7 s later; `tick` schedules nothing; a recording due
  waits in `start()`; the slow-start grace timer waits for the hold to end; `music.holding` for
  the checks). A cue is a sorted list of `CueNote`s (`reelCue`): `playCue` makes each `AHEAD` (3 s)
  before it sounds from a 250 ms timer, `renderCue` makes them all at once. Hooks:
  `__stel.playFilm(id, args)`, `__stel.filmFramesApart(id, times, w, h, q)`, `__stel.audio()`.
  Measuring (scripts in a scratch folder, not kept): a tablet's screen (1280×800 at 2× with
  touch), CDP `Emulation.setCPUThrottlingRate` 4, rAF gaps over a film and a DevTools trace
  (`Tracing.start` with `devtools.timeline`, tasks over 150 ms and what ran in them); frame rates
  here measure the software rasteriser, so compare the main thread's own stops.
- **Films smooth in every browser (15 Oct):**
  - **The clock** (`audioClock`, `player.ts`): film time is `getOutputTimestamp()`'s
    `contextTime` carried on by `performance.now()` from its `performanceTime`, at the frame's own
    time (the rAF timestamp, passed to `clock.now(at)`), never backwards, less the cue's start.
    Without a timestamp (or with `performanceTime` 0, or one ahead of `currentTime` or more than
    a second behind it), `currentTime` carried on between its steps, for 250 ms at most and only
    while the context runs (the project check: carried on without end, a stopped sound left the
    film running on in silence, then frozen; `unit/film-clock`);
    without sound, `elapsedClock`. Do not read `currentTime` straight: it steps by the output's
    buffer (23 ms with `latencyHint: 'playback'`), and frames repeat.
  - **The overlays:** with `pageOverlays` (the game's `Film.tsx`), `FilmPlayer` lays
    `.film-vignette` (a CSS radial gradient, as `vignette` in `draw.ts`) and `.film-grain` (the
    256-pixel tile from `grainTile256()` as a data URL, `mix-blend-mode: overlay`, its
    `backgroundPosition` from `grainOffset(t)`) between the canvas and `.film-text`; the reel
    skips its own `vignette` and `grain` while `args.pageOverlays` is set (read as each frame is
    drawn). The trial: at the first half-second judgement with frames more than 45 ms apart, the
    player sets `args.pageOverlays` false and hides the layers; at the next, it keeps the canvas
    if its median gap is under 0.9 of the layers', else it shows the layers again
    (`FilmPlayer.overlayTrial`). Only then does it step the resolution down: every half second,
    by `clamp(√(30/median gap), 0.6, 0.85)`, to 0.5 a CSS pixel at least. Export and the checks'
    `filmFrames` leave `pageOverlays` unset, so their frames keep both in the canvas. Under
    reduced motion the game's films set `args.stillGrain`, and the canvas's grain holds still too
    (drawn at time 0), as the page's layer does.
  - **The painter thread's failures:** `paintWorker.ts`'s handler is async, so an error in it
    rejects a promise inside the thread and reaches the page as no error at all. Its whole body
    is in a `try`: a film it cannot lay out or send it answers `{ job, failed: true }`, and the
    page paints that film itself (`fallBack`).
  - **Measuring:** a frame's drawing in software at 1920×1080, with and without the two passes
    (`setup(..., { pr: 1, pageOverlays })` on the dev server's `film.html`, each frame flushed by
    `getImageData(0, 0, 1, 1)`); a whole film in the game in Chromium with
    `--disable-accelerated-2d-canvas` (and swiftshader's GL) at 1920×1080: rAF gaps and the
    canvas's width. Without the graphics chip for compositing too, as here, each page layer over a
    changing canvas costs more than its canvas pass.
- **The galaxy's own light (15 Oct, `galaxyView.ts`):** `buildGlows` (from `buildDust`, once per
  world) adds soft additive sprites over the dust: the envelope (1900 across, flattened 0.62) and
  its middle (760), each ancestral province (2.6 × its radius), 15 along each stream, each
  globular cluster, with `glowTexture()` (brightness as e^(−3.2 r^0.7), zero at the edge) and a
  blackbody colour. `sync` tints them with the dust's era tint; `update` sets each one's height
  on the screen from the camera's elevation (√(flat² cos² + sin²)) and its opacity as base ×
  the era's natural brightness (not the enhanced and thermal views' floors, which keep the dust
  faintly visible: the glow showed in the Dark there until the project check, 15 Oct) × a fade in
  with distance (`smoothstep(distance, 220, 900)`). The
  grade in `post.ts` has no lift: with the neutral tone mapping a lift with unequal channels shows
  as a tinted cast (the purple oval), and one with equal channels is taken away anyway.
- **`/next/` (part 5):** the `next` branch (a copy of the work branch: `git push origin
  claude/epic-wozniak-lyhulf:next`) carries a Pages workflow that checks out `main` and `next`
  into folders of those names, builds each (`npm ci && npm run build`), drops `next/dist/archive`
  and copies `next/dist` to `main/dist/next` before publishing `main/dist` to `gh-pages`. The build
  is relocatable (`base: './'`), so the new version runs under `/next/` unchanged, and its storage
  keys (`steliterate2.`) keep its saves apart from today's game on the same origin. A push runs
  the workflow file of the branch pushed: `main`'s still builds `main` alone (HANDOVER, Traps).
- **The survey reveal (part 4; a flight of the camera since 21 Oct):** `SystemView` keeps it
  (`reveal`: its system, its start, its look at the star (`intro`, Next cuts it), its `shots` (each
  world's flight, its while there as planned and as it is (`plan`, `hold`: Next cuts `hold`, and
  what the camera does there is timed by `plan`), whether its star rises over it), the orbits'
  order out from the star, the yaw it began at, the world the view was entered for, the dust's
  cell; `REVEAL` is the pace) outside `build()`, which reruns on every `bump()`. `schedule()` gives
  each flight's start, each arrival, the way out and the end. `build()` tags whatever it draws for
  each body (`userData.reveal`; `orbit` holds an orbit line's opacity, `deep` the Deep's ring's,
  `belt` a belt's instance count, `world` marks a world's pivot), and `applyReveal()`, every frame
  in `update()`, sets what shows (a world from its flight on, its scan `uReveal` from 0.25 s
  before its arrival to 0.7 s after, what is round it once scanned, the orbits on the way out),
  tells the caption where it has come to (`RevealStep.phase`: intro, fly, hold, outro), and sets
  `cinema`, the camera's pose, from `cinePose(r, schedule, t, orbitTime)` alone: `introPose`,
  `shotPose` (a world, the Deep, a belt; `framed()` puts a point at a place on the screen, seen
  from a distance at an angle round from its star), `blendPose` (round the star, midway keeping
  out of its glare), `endPose`. `Engine.frame` puts the rig there (`OrbitRig.setPose`) after
  `system.update` and before `rig.update`. `flightDust` draws the streaks from two poses 1/30 s
  apart (not in the magnifier mode). `endReveal(how)` puts everything back and tells the engine
  (`onRevealEnd`): played out, the camera stays (on the world the view was entered for, followed);
  skipped, it flies back out; let go of (`drop`: a gesture, `select` of a world, another system or
  game), it stays. `hidden(id)` is a world whose scan is not over (`Engine.pickAt` leaves it out);
  `labelsHeld` holds every world's name and the selection ring until the way out.
  `Engine.markForReveal(state, ids)` (turnflow: the systems charted this turn, kept for that
  `GameState` only), `showSystem` starts it on entering one (`focusBodyId` first, and the flight
  ends on it), `skipReveal(all)`, `nextReveal()`; in the flight a click is Next (`Engine.click`)
  and a double-click nothing. `EngineEvents.onReveal` feeds `revealing` (`ui/hud/RevealCard.tsx`,
  which sets `html.cine`: styles.css hides the rest of the HUD, the messages and the map's hover
  card, not in the magnifier mode); main.tsx plays its sounds (`whoosh`, `scan`). `revealsOn` asks
  `store.ts` (Settings, reduced motion, `?nofilms`, `__stel.reveals(on)`). The caption's Enter,
  Escape and Space are a capture listener on `window`, as the films' keys are, so main.tsx's
  handler never sees them (it would end the turn or clear the selection).
- **What is not matter, drawn (part 3-7, `src/render/fields.ts`):** `fieldLattice` (a dipole's
  lines r = L sin²θ, a standing-wave torus whose `userData.markColor` the selection circle takes,
  motes bouncing between the mirror points in `MOTE_VERT`, loops for Field Stores, a
  `fieldCage` for Burst Catchers), `fieldCage` (a Bastion Shell round its hole too) and
  `positroniumVeil` (ellipses about a centre far out along their long axis, so the middle ones
  cross the system). `systemView.ts` `addField` puts one in the Deep (`buildDeep`, in place of
  the box hull) or round a world (`buildBody`, in place of the habitat torus, and the planet's
  city lights off), for ours and the others' (`theirForms`, `styleOf`); `horizonWriters` sets
  `GLOW_FRAG`'s `uWrit`/`uWritColor` on a hole's photon ring; `buildVeil` while
  `positroniumHere`. Every field material sits in `fieldMats` (its `uTime` set from elapsed time
  in `update`), what turns slowly in `fieldSpin`. The Thinning: `THIN` (the share gone, set on
  each build) feeds `withDissolve`, which patches a `MeshBasicMaterial` (composes with
  `withNearFade`; its own `customProgramCacheKey`; an instance's holes keyed by `gl_InstanceID`
  so they stay put as it orbits), and `thinMotes` drift off worlds (through `eatMotes`, which
  moves `uFrom`) and off a Dyson shell. Iron (`ironAge`, or a dwarf `exploded`): `IRON_STAR` and
  `PLANET_FRAG`'s `uIron`. `SystemView.quality` (from `Engine.setQuality`, which rebuilds an open
  system view) sets the counts and `fieldGain` (colour past white only where bloom runs).
  `SystemView.look` counts what the last build drew, for `browser/leptonic-look`. The map:
  `aForm` (`FORM_RING`, the highest form of ours at a star) styles `NODE_FRAG`'s settlement
  ring. `turnflow.ts` pings the turn's `blackdwarf_sn` and `collapse` notes (`MAX_FLASH_PINGS`).
- **UI:**
  - `Story.tsx`: `LoreModal`, `loreView`, `worldFinds`.
  - `Drawer.tsx`: Raid button, settler list sorts, Sunlight row, resident lines, Ruins "Read
    again", find chips.
  - Kinds of structure: `structureKind` in `src/game/data/structures.ts` derives one from
    what a structure does (the first of energy, matter, storage, insight, accord, industry,
    defence, world; anything else is people: room, cold sleep, conversions, continuity), so a
    new structure needs no list; `STRUCTURE_KINDS` gives the order, names and tips. In
    `Drawer.tsx`, `BuildTab` groups the build list under kind headings, with a filter row
    (`buildKind`, a signal, so the choice holds across settlements; hidden when only one kind
    is on offer); `KindIcon` (icons in `KIND_ICON`, colours in `.kind-<kind>` in
    `styles.css`) marks build rows, the queue and the built-structure chips, which sort by
    kind. Ships in the queue get the fleet icon.
  - Toasts: `notify(text, kind, action?)` in `store.ts`; an `action` ({ label, tip, run }) puts
    a button on the toast (`App.tsx`, `.toast-act`) and keeps it up 12 s. `turnflow.ts` gives
    "Survey complete" a Look (selects the system, `pivotToSystem(id, true)`) and "Living world
    found" a Look (`goToBody`).
  - `Signals.tsx`: Ask for help.
  - `Misc.tsx`: `MusicTrackField`, `startLoaded` music.
  - `Lists.tsx`: Surveyed worlds sorts. `SystemsModal` (the rail's Systems, key S; the modal kind
    is still `'settlements'`): Our settlements, Surveyed worlds (`tab: 'worlds'`, key W) and in
    the Degenerate Age Collision stars (`tab: 'beacons'`, `BeaconsList`: light this turn from
    `sourceLight`, turns left from `turnsUntilYears`, the longest-burning first, the ones
    already out apart). The tab lives in `modal.value`, not in component state, so W can switch
    an open window (it did nothing before 3 Oct).
  - Collision stars: a Degenerate Age turn often outlasts a whole collision star (1–10 trillion
    years). Until 3 Oct a new star's birth fell anywhere in its turn, so most lit and went out
    inside it (20 autoplayed games: 228 lit, 203 already out when first seen); since the
    new-star clock they light as the turn ends. A star from before that can still sit with
    `kind: 'collision_star'` and `diesAt` in the past until the next turn's `evolveUniverse`:
    `isBeacon` (labels.ts) and the map's ✦ (`burning` in `engine.ts`) count only those with
    `diesAt > years`; `sourceLight`'s label, the panel's "Burnt out at" and the tab's Already out
    say so.
  - `Hud.tsx`: flare clock chip.
  - `Society.tsx`: archive chip.
  - Exponents (`src/ui/sup.ts`, 7 Oct): the Google subsets of IBM Plex Mono, Saira and Spectral
    carry only ¹ ² ³ of the superscript digits, so ⁰ and ⁴–⁹ came from a system fallback font
    (smaller, and unlike the digits around them). A Preact `options.vnode` hook redraws every
    superscript run in an element's text children as `<span class="sup">` with ordinary digits
    (`⁻` as −), raised and at 0.8em. Strings stay Unicode everywhere they are kept (saves, the
    Record, `data-tip` attributes); `<option>`, `<textarea>` and `<title>` are left alone.
  - Type sizes (7 Oct): every size up to 14 px is 1.5 px larger, the root 15.5 px. Layout kept
    with it: the bottom-left stack's height queries at 950 and 790 px, the turn box 320 px wide,
    the tech grid's first column 124 px, the drawer's reserve 318 px, and the chronometer's
    lines top-aligned. Settings → Interface size scales all of it for large screens.
- **Low vision and the keyboard (9 Oct; the player's friend plays through a screen magnifier):**
  - For everyone (`a11y.ts`): `useWholeScroll(ref, head, body)` scrolls a panel whole when its
    body would get under 150 px of the interface (back above 190), measured with
    getBoundingClientRect ÷ `uiFactor()`; on the Drawer and the event and survey-report dialogs.
    The rail's height is set where the forecasts begin (`Rail` in `Hud.tsx`). The focus ring shows
    only under `html.kbd` (set by Tab, cleared by the pointer: `trackKeyboard`), drawn inside the
    edge (`outline-offset: -2px`), where the chamfers' clip-path does not cut it.
  - The magnifier mode: `settings.lowVision` and `lvSide` (localStorage, not the save);
    `applyLowVision()` sets `html.lv` (`lv-left`), the size and the engine's helpers; at start,
    from the settings or a link (`?lowvision`, `?lowvision=0`, in `main.tsx`). Its CSS is the last
    block of `styles.css`: the column is `.hud` (420 px, scrolling), its parts unpositioned and
    ordered by `order` (the Drawer last), whatever the phone layout says; `.lv-bar` (Hide the
    panel) and `lvFolded` (M). Sizes 1.6× and 2× are in `UI_SCALES` with `lv: true`
    (`PLAIN_MAX_SCALE` 1.4 outside it); `applyUiScale` caps them at width/360.
  - The camera: `engine.setFocusX(x)` beside `setFocusY` (one `setViewOffset`, eased by
    1 − exp(−8·dt)); `App.tsx` sets it from the column and writes `--lv-col` for the messages.
    `engine.setLowVision(on)`: `galaxy.setMarkScale(1.5)` (node and swarm `uPixel`, fleets and the
    selection ring; not the dust, and kept through `setPixelRatio` on resize), the pick reach
    ×1.5, label spacing ×(15/11 × zoom) and 24 labels, no grain (`grain()`, also in `setState`),
    vignette or colour fringes. `engine.setUiZoom` comes from `applyUiScale`.
  - Focus that follows (mode only): `focusTitle(el)` gives a title tabIndex −1 and focuses it;
    the Drawer on each new selection (`.drawer-head h2`), `ColonyPanel` on its Build list
    (`.list-head`) when opened by `openBuildFor`, prompts and the guide on their titles
    (`useFocusPrompt`), and a closing window hands focus to a waiting prompt first.
  - `Tip.tsx`: in the mode, tips for the focus too, placed beside the column (or below what they
    explain), hoverable (a 350 ms grace), Escape (capture phase) puts one away and nothing else.
  - Keys N and B: `nextTodo` and `buildSelected` in `Hud.tsx` (the to-do chips' list is
    `todoItems`). Messages stay in the mode (`notify` sets no timeout; `doEndTurn` clears them).
  - `mapHover` (main.tsx `onHover` → `MapHover` in `App.tsx`): the name under the pointer.
    `AfarList` (`Lists.tsx`, tab `'afar'`): the stars seen from afar; `sendFromSystems` opens a
    probe's window on it in the mode.

- **Phones (10 Oct; the player plays on a phone too):**
  - Which layout: `PHONE_QUERY` in `store.ts`, `(max-width: 760px), (max-height: 500px) and
    (pointer: coarse)`, the same as the stylesheet's (a short window on a PC, such as 960×460 at
    200% zoom, keeps the PC layout: the `a11y` check); `phone` (a signal) and `isPhone()` (never in
    the magnifier mode). The CSS is the "phones" block of `styles.css`, before the magnifier's: one
    part for both, one upright (`max-width: 760px`), one held sideways (`max-height: 500px and
    min-width: 761px and pointer: coarse`), every rule under `html:not(.lv)`. The older
    phone-width rules above it still apply where it does not override them.
  - The top bar: `.chrono-line` (`Chronometer.tsx`, a button, hidden on a PC and in the magnifier
    mode) toggles `phoneMore`: `.chrono.more` shows the ruler (without its age names) and
    `.bottom-left.open` hangs under the top bar. `--chrono-end` (the top bar's foot, set by the
    Chronometer on each render and by `Hud.tsx` on resize) places the resources; `--hud-end` (the
    resources' foot, `Hud.tsx`, watched with a ResizeObserver) places the messages, the map banner,
    the prompts, the guide, the to-do chips, the view switch and the details.
  - The sheet: `Drawer.tsx` gives `.drawer` the class `s0`/`s1`/`s2` from `sheetSize`; the
    max-heights are shares of `--sheet-room` (0.36, 0.72, 1; the half is about the old panel's 46vh at 390×844, so a settlement's Build tab keeps its head). `SheetHandle`: a tap steps up (full
    → small), a drag sets `max-height` live and settles on the nearest size; `setHudPrefs({ sheet })`
    keeps it. A pick on the map sets `sheetHint.mapKey` (`main.tsx` `onPick`), and the Drawer's
    effect on a new selection opens it small for that key, else at `hudPrefs.sheet` (default half).
    `onGesture` (the camera rig: once per drag, pinch or wheel) lowers it to small and folds the
    details. The Drawer's `place()` sets `setFocusY` upright and `setSheetFocusX` sideways (the
    engine uses the magnifier's `focusX` first).
  - Touch: `Tip.tsx` ignores a touch `pointermove`; a 500 ms press shows the tip and swallows the
    one click (and context menu) it would make, until the next pointerdown. `engine.pickAt(x, y,
    pointerType)`: touch reach 28 / 36 px, and `labelAt` (a map name's box, from `Label.pick`).
    `engine.pickFilter` (set in `main.tsx` while `targeting`): only stars other than the fleet's.
    The camera's tap slop is 12 px for a finger (`tapSlop`). `touchInput` (the last pointerdown)
    picks the map banner's words; on touch the first tap sets `hoverStar` and the banner offers
    Send (`sendPicked` in `Lists.tsx`, also the mouse's click).
  - Elsewhere: `ShipPrompt` returns nothing on a phone; the rail's `rail-menu-only` buttons (Codex,
    Save) hide there (Menu has both); the pace's `.pace-phone` row and `.pace-menu` list (outside the
    `.pace` panel: a panel's chamfered clip-path cuts off whatever pokes out of it); the guide's
    steps can carry `phone: { target, text }`.

## Music tooling

- **The Canon:** `tools/music/canon.py` renders the arrangement to WAV with numpy and scipy.
  Encode with ffmpeg:
  `ffmpeg -i canon.wav -af volume=-2.9dB -ar 48000 -c:a libmp3lame -b:a 192k public/music/canon.mp3`
  Target about −15 LUFS; check with `-af ebur128=peak=true`.
- **Checks without listening:** per-beat chroma against the chord progression
  D A Bm F#m G D G A, out-of-key energy, per-cycle RMS, and a spectrogram PNG.
- **Existing tracks** (ElevenLabs Music v2.5 via Krea, `force_instrumental`): Dusk −12.7 LUFS,
  Degenerate −14.7 LUFS, 48 kHz, 192 kbps.
- **Title, Black Hole Age and Dark** (29 Sep; same model, 180 s asked, `force_instrumental`), made
  to loop with `tools/music/loop-track.py` (`pip install miniaudio numpy lameenc`; no ffmpeg
  needed): it trims the fade-in and fade-out, crossfades the end into the start (equal power; 4, 6
  and 8 s), sets the level (RMS −15, −18.7, −20.4 dBFS) and encodes 192 kbps, 48 kHz. Their joins
  match to 0.85–0.91 (spectral similarity of the last and first two seconds). They came out in
  F♯ minor, around B, and on a drone on A♯ (the synth score's keys are A minor, C♯ Phrygian and
  A minor; it is silent while a track plays). The prompts, in short: title, "dark ambient
  synthwave, about 74 BPM, worn analog pad over a sub drone, a slow glassy arpeggio with a slight
  bit-crushed 12-bit texture like a 1991 Amiga soundtrack, a distant gated snare now and then,
  tape hiss, melancholic but warm and inviting"; Black Hole Age, "very slow, about 50 BPM,
  detuned sawtooth pads through a nearly closed filter, a sub-bass drone, rare distant bells, a
  deep boom every half minute, faint crackle and bit-crushed grain, no drums or arpeggio"; Dark,
  "a single low drone, a lonely distant tone every so often into a very long reverb, a trace of
  bit-crushed noise, long near-silences, no pulse". Each ends: "one steady texture, no build-up
  and no ending, so it loops seamlessly; no vocals, no choir".
- **Second tracks and the ending** (29 Sep, the same model and settings). `loop-track.py` with
  a crossfade of 0 only trims and levels, for tracks that take turns (the game fades between
  them); the ending is looped with a 6 s crossfade (join 0.79, G minor). Levels are matched by
  integrated loudness: `python3 tools/music/loudness.py public/music/*.mp3` (BS.1770-4; needs
  scipy too). Dusk −12.7 (dusk2 −13.3, held back by the −1.5 dBFS peak limit), Degenerate
  −14.7 (both), Black Hole −19.7 (both), Dark −19.3, title −14.2, ending −14.2, Canon −15.2.
  The prompts, in short: dusk2, "about 84 BPM, D Dorian, a softly pulsing bass, a slow glassy
  arpeggio, a soft kick and gated snare far back; wistful and purposeful, like working late
  under a dying red sun" (it came out in A major); degenerate2, "about 64 BPM, E minor, triangle
  pads, a sparse music-box arpeggio that comes and goes, bells, a low drone; contemplative,
  lonely, strangely beautiful" (a drone on D♯); blackhole2, "about 48 BPM, a slowly breathing
  sub drone, a low choir-like analog pad (synthesised), the metallic ring of struck plates, a
  rotating shimmer like light bent around a horizon; awed rather than menacing" (a drone on D);
  the ending, "the closing theme, whichever way it went; about 56 BPM, D major leaning
  bittersweet toward B minor, a warm pad and a simple unhurried melody on a glassy lead; no
  drums, no big climax".
- **dark2** (12 Oct, the same model, 180 s asked, `force_instrumental`): "Instrumental dark ambient
  for the very end of time … Almost silence: a faint, warm analog drone that slowly changes colour
  over minutes … every so often a single soft sine tone, like a lighthouse very far away, answered
  long afterwards by another … still, lonely, gently hopeful", ending as the others. It came out a
  steady low drone on E, went live as Recorded II (PR m1omg/Steliterate#18) and came out again the
  same day: the player, "monotonous AF". The lesson is in "How much a track moves", below.
- **How much a track moves** (12 Oct): `python3 tools/music/movement.py public/music/*.mp3` gives,
  for each track, the share of its pitch energy on its one strongest note (`top`), how much its
  harmony moves between 2 s windows (`chroma`), its onsets a minute and the spread of its level.
  The tracks the player likes: Dusk I and II and the title 20–25% / 0.10–0.14 / 113–201 a minute;
  Black Hole I, the ending and the arranged Canon 20–23% / 0.27–0.33 / 11–31. The drones: Dark
  78% / 0.001 / 4, Degenerate II 70% / 0.001 / 40, Black Hole II 56% / 0.005 / 5 (the player:
  leave the last two, each takes turns with one that moves). A track meant to move wants a `top`
  under about 35% and a `chroma` over about 0.1. Words that made drones, in every Dark, Black
  Hole II and Degenerate II prompt: "drone", "almost silence", "long near-silences", "no pulse",
  "no melody", "one steady texture, no build-up and no ending". What moves (the title's, Dusk
  II's): a tempo, a key, chords, a melody, an arpeggio, sections. **The player hears a generated
  track before it goes in** (12 Oct): send them the file or its link, never merge on numbers alone.
- **dusk3, made as the next Dark track** (12 Oct, evening; the player had asked to remake both Dark
  tracks with movement, one first, then the plates, then the other). The prompt:
  "Instrumental dark ambient synthwave for the last era of the universe, after the last black holes
  have evaporated: vast, lonely and quietly hopeful. About 64 BPM, A minor. A slow chord
  progression that keeps moving and never sits on one chord: Am, F, C, G, then Dm, Am, Em, F, round
  again with small changes. Warm, worn analog pads carrying the chords; a simple, memorable melody
  on a soft glassy lead that comes and goes, answered by a distant echo of itself; a gently
  pulsing arpeggio on a detuned synth in the middle section; a soft bass following the chord roots;
  sparse, distant percussion (a soft kick and a brushed, gated snare far back) in the second half.
  Tape hiss and a slight 12-bit bit-crushed texture like a 1991 Amiga soundtrack; long dark reverb.
  Structure: 0:00 pads and the melody alone; 0:40 the arpeggio and bass enter; 1:30 the fullest
  part, with the soft percussion and the melody an octave higher; 2:20 thinning back to pads and
  the melody, ending softly on A minor. No vocals, no choir." (180 s, `force_instrumental`.) It
  came out in A minor at about 64 BPM, its chords coming round about every 30 s (the strongest
  notes of each 10 s window), at almost its full level from the start, a little fuller from 0:30,
  the music over at 2:45 and 12 s of reverb after it: `top` 21%, `chroma` 0.18, 104 notes a minute.
  The player heard it first: "that track sounds good but tbh belongs in Dusk, add it as a Dusk
  track once you are done - for Dark a darker remix of it may be good". In as the Dusk's Recorded
  III: `python3 tools/music/loop-track.py 'raw.mp3|public/music/dusk3.mp3|-15|6|20'` (14.5 s of
  the tail trimmed, a 6 s crossfade, 160 s, −13.8 LUFS, held back by the peak limit). Kept at
  Krea: https://app-uploads.krea.ai/audio/6920478a-0649-4e23-aaab-cb1fbd413acf.mp3. A new track
  goes into `PIECES` (`src/audio/music.ts`) under a file name never served before (a file once
  served may sit in browsers' caches), and a new `id` (a player's choices in the Playlist are kept
  by `id`).
- **A darker remix** (12 Oct): Krea's music models take words only, so a remix of a track we have
  is made here, `python3 tools/music/darken.py in.mp3 out.wav [semitones] [low-pass Hz] [reverb s]
  [wet]` (defaults 4, 3000, 6, 0.35): slower and lower together, as a tape run slow
  (`resample_poly` by 2^(semitones/12); 4 turns 64 BPM in A minor into about 51 BPM in F minor), a
  12 dB-an-octave low-pass, and a reverb of decaying noise (itself low-passed at 2.5 kHz, a fixed
  seed, 30 ms before it) mixed under the dry sound. Then loop and level it with `loop-track.py`
  (its tail is longer: reach 30 s). Of dusk3, with the defaults, looped with an 8 s crossfade:
  201 s, `top` 25%, `chroma` 0.15, 35 notes a minute (the reverb blurs its onsets), and the
  spectral centroid 267 Hz against dusk3's 317 (most of both is in the bass; the Dark's drone sits
  at 95 Hz, Black Hole I at 61). Sent to the player at dusk3's loudness to compare: "add em yes
  pls". In as the Dark's Recorded II (`dark3`, a new `id`, since `dark2` was the drone taken out):
  `python3 tools/music/loop-track.py 'dark-remix.wav|public/music/dark3.mp3|-20.9|8|30'`, −19.3
  LUFS as the first Dark track. `loop-track.py` sets the RMS of both channels together but prints
  the RMS of their mix, so a wide reverb reads 2 to 3 dB lower in what it prints: check the level
  with `loudness.py`, not its line.
- **Krea from a cloud session** (12 Oct): through the Krea connector (claude.ai → Connectors;
  its tools are `mcp__Krea__*`, read when a session starts), with `app-uploads.krea.ai` (where
  results are stored) and `api.krea.ai` (uploads) allowed in the environment's network access.
  Pass a style reference as a public URL (the live site's plates, such as
  `https://m1omg.github.io/Steliterate/art/events/comet.webp`). The API spends its own balance
  ("units"): on 12 Oct the two tracks went through and then an image was refused with 0 units
  left (111 needed for Nano Banana Pro at 2K), as on 29 Sep; a track tried later the same day was
  refused too. The player had counted 1,504 credits: if the two tracks took them, a 3-minute track
  costs about seven plates. That evening the player bought credits, and the API's balance had them
  at once: a 3-minute track went through in 19 s. No tool shows the balance; a generation refused
  for it says so (402).
- **A recorded Canon: tried, not shipped, and not to be tried again** (12 Oct, 150 s, the prompt
  below; the player: "Recorded Canon isnt canon but a monotonous drone", and chose to keep the
  arranged one, `tools/music/canon.py`, as it is). Krea's music models take words only, no audio to
  follow, so a real Canon can only come from our own arrangement. It came out a D–G
  vamp over an E♭ drone a semitone against it, with no ground bass and no voices in canon (bass
  per 1.3 s: E♭ throughout; middle register: D and G only; 83% of its pitch energy in D major
  against the arranged one's 98%). Kept at Krea, not in the game:
  https://app-uploads.krea.ai/audio/afed7c2f-b894-486e-848b-21b167cc6c00.mp3. A second try
  might name the chords as well as the bass, and ask for no drone.
- **The AI Canon prompt** (tried 12 Oct, above) starts from: "Instrumental. A slow, dark
  ambient synthwave arrangement of Johann Pachelbel's Canon in D (public domain) in the spirit of
  a 1991 Amiga tracker module: lo-fi sampled string pads and choir swells, notes swelling in and
  fading out, gentle portamento, slightly bit-crushed 8-bit texture; the ground bass D A B F# G D
  G A about every 1.3 s (~47 BPM); voices entering in canon; later eighth and sixteenth-note
  figures on a glassy pluck; sub drone, tape hiss, long dark reverb; no drums, no vocals; fades
  out on D major."

## Balance reference (300 standard competent games surviving)

| Commit | Survived of 300 | Note |
|---|---|---|
| `1b1b9e2` | 120 | |
| `4bf5c30` | 121 | |
| `c6fb6da` | 124 | |
| `8aa21ed` | 121 | |
| `226abaf` | 112 | |
| `3dca9ed` | 119 | |
| `044b5e2` | 116 | |
| `4108d98` | 116 | victories 18, up from 6 |
| `a43816b` | 115 | |
| `c6edc66` | 126 | |
| `aff6571` | 114 | 900 games: 341 vs 347 without the change |
| `09cdd8c` | 114 | |
| `1e8a321` | 114 | re-run in a fresh container (28 Sep): identical, 94 Endurance + 20 Victory |
| `0815fe4` | 114 | rendering only: all 300 games identical to `1e8a321` |
| `f8a2cd6` | 122 | the flare clock's seventh turn gone |
| `a5debf5` | 121 | each crossing's protocols for that crossing only |
| `fa5737d` | 121 | despair once a turn |
| `eebeefa` | 107 | other civilizations fade on time; 900 games: 325, against 358 without it and 341 at `0815fe4` |
| `dde4e58` | 111 | last transmissions always reach us; 900 games: 327 |
| `3c56967` | 123 | swarms catch ships; 900 games: 357 (blind to swarms: 116/300) |
| `a26c428` | 123 | estimates only: all 300 games identical to `3c56967` |
| `1a72718` | 123 | display only: all 300 games identical |
| `7b52ab4` | 122 | living worlds freeze when their own star dies; 900 games: 358, against 357; 85 of 900 outcomes change, both ways |
| `b950f24` | 133 | flare turns pay by the time lived, young white dwarfs averaged, cold worlds start frozen, relic draws swarms; 900 games: 390 (358); pace and light fixes reverted: 123 |
| `55ff2da` | 133 | charters can be repealed; the autoplayer never repeals: all 300 games identical to `30c3c7f` |
| `7d0806d` | 133 | Systems window: interface and labels only, all 300 games identical to `55ff2da` |
| `4fe2404` | 167 | keep time with new stars, like a flare, free; the autoplayer keeps time with every one it can (about 12 a game): Degenerate Age 127 turns on average (44), games 276 (183), victories 117 (18); 74 games now survive, 40 no longer |
| `d005b05` | 147 | free within 100× of the next turn, then 250 energy a tenfold, at most a full store; Study/Watch +25 insight, +2 resolve; the autoplayer pays only while half its store would remain (2.3 free and 1.9 paid clocks a game, mean price 541): Degenerate Age 68 turns, victories 52. Variants, 300 games each (survive, victories, Degenerate turns): Study/Watch only 130/26/45; free in-tune clocks only 146/44/55; 100 a tenfold 165/79/88; 150 160/67/79; 400 154/55/61; uncapped 20, 40, 60: 161/106/114, 171/98/104, 163/81/99 |
| collisions end with the galaxy | 140 | brown-dwarf collisions taper over the evaporation (η 18.4–21) and stop after; 52 victories, Degenerate Age 67 turns; 241 games end as at `d005b05` |
| white dwarfs cool | 135 | unwarmed white dwarfs cool to 5 K by η 16.7 and turn black; 900 games 425 / 159 victories / 68 Degenerate turns, against 432 / 159 / 68 at `6d734aa`; cast-out embers going cold (not shipped) 430 / 145 / 64 |
| follow a new star on | 153 | a second star's clock after the first, never below 250 energy; Study charts; 59 victories, Degenerate Age 77 turns; 900 games 453 / 166 / 77. Variants (300): no follow-on 146 / 54 / 67; free chaining at the fresh price 152 / 72 / 87 (900: 461 / 214 / 88); one follow-on per chain 149 / 68 / 80; floor and one per chain 150 / 55 / 73 |
| cast-out embers dim; Quickening splits clocks | 144 | 44 victories, Degenerate Age 68 turns; 900 games 447 / 136 / 68 (the dimming alone 448 / 144 / 71) |
| worlds boil away near helium stars | 146 | rock past 3,000 K and rubble past 1,600 K boil under a helium star, a giant swallows inside 0.116 AU; 54 victories, Degenerate Age 69 turns; 900 games 430 / 145 / 68 (614 of 900 end as before); per 150 games about 458 worlds boiled, 72 belts, 41 swallowed, 20 of ours lost |
| holes evaporate gently (4 Oct) | 150 | settlements outlive their hole, and nothing draws on a hole once it is gone; 54 victories, Degenerate Age 68 turns; 900 games 431 / 146 / 68 against 452 / 152 / 68 (Recurrence 285, The Fade 39, against 300 and 21: the decay-proof vaults at the Heart had drawn 60 a turn of phantom spin through the Dark); keeping the phantom spin and Hawking light 461 / 156 / 68 |
| accord uses; accord income halved (4 Oct) | 151 | 58 victories, Degenerate Age 68 turns, The Will Fails 63 (70 before); 900 games 452 / 152 / 68 against 444 / 152 / 68. Tuning (300; survive, Will Fails): uses at the first prices (Rally +5 for 40, Calm −6 for 30, Hear +8 for 25) 170 / 46; prices ×2 164 / 53, ×4 159 / 61; Rally alone 161 / 46, Calm alone 154, Hear alone 157; bank capped at 200 169; income halved 162 (prices ×2 158); gains ×0.4 157–158; income halved and no uses 146 (neutral) |
| spare work; Matter focus (4 Oct) | 148 | identical to the bit with Recycle as everyone's default. Variants (300, every settlement on one choice): Study 152 / 57 / 68, Tend 147 / 58 / 69, Morale 150 / 59 / 68; mining settlements on the Matter focus 133 / 47 / 69 (on Industry 153 / 54 / 71). The autoplayer is rarely idle (0.1 to 0.6 idle settlements a turn), so this mostly checks nothing breaks |
| giants light at turn end; catch the flash | 148 | a giant shines through the turn after its birth (its event offers a flash: one turn in its light), swallowing then; 58 victories, Degenerate Age 68 turns; 900 games 444 / 152 / 68 against 447 / 136 / 68 before the boiling (620 of 900 end as then); per 150 games 407 giant events, 10 flashes taken by the autoplayer (about 690 energy each) |
| survivors' health stops at zero; checks in the repo (7 Oct) | 149 | 55 victories, Degenerate Age 68 turns; 5 of 300 games play out differently: help sent right after a crossing or a swarm (Tell the others, aid) no longer first fills a negative |
| honest cooling; core heat fades; the dark keeps cold minds for half (7 Oct) | 128 | 40 victories, Degenerate Age 68 turns; 900 games 397 / 119 / 67. Steps: no light floors 137 / 55; core heat ×0.5 a turn 106 / 31, with the dark-sky discount 126 / 36; ×0.8 (kept) 128 / 40; ×0.9 134 / 39. The Fade 9 → 28 per 300: core heat had lasted into the Dark |
| three fates of matter; ages by warmth (7 Oct) | 124 | 52 victories, Degenerate Age 70 turns; 900 games 386 / 142 / 69 (397 / 119 / 67 before); decay games identical line for line. By fate in the 900: decay 163 / 450 (4 victories), stable 143 / 239 (89), curvature 80 / 211 (49). Chosen, 300 each: decay 110 / 7 / 68, stable 184 / 114 / 55, curvature 113 / 65 / 89 (98 / 56 with the autoplayer preparing for the Great Evaporation from η 78 rather than 62) |
| taking structures apart (7 Oct) | 135 | 48 victories, Degenerate Age 69 turns; 900 games 406 / 143 / 69 (386 / 142 / 69 before). By fate: decay 179 / 450, stable 144 / 239, curvature 83 / 211. The autoplayer takes apart a collector whose source is gone for good when matter is under 40: 5.6 a game, 170 matter (30 games). Letting it take apart idle Decay Harvesters too: 404 / 143 |
| the Long Flow (7 Oct) | 129 | 47 victories, Degenerate Age 69 turns; 900 games 400 / 142 / 69 (406 / 143 / 69 before); decay games identical. By fate: stable 140 / 239, curvature 81 / 211. Chosen, 300 each: stable 184 / 119 / 56, curvature 106 / 57 / 88. The autoplayer taking apart the dearest things at unmanned places, collectors included: 399 / 142 |
| neighbours, phase 0: honesty (work branch) | 136 | 52 victories, Degenerate Age 71 turns; 900 games 406 / 146 / 69 (400 / 142 / 69 before); by fate decay 175 / 450, stable 154 / 239, curvature 77 / 211; 430 of 900 games as before |
| neighbours, phase 1: pacts (work branch) | 138 | 50 victories, Degenerate Age 69 turns; 900 games 440 / 150 / 69 (406 / 146 / 69 before); by fate decay 190 / 450, stable 145 / 239, curvature 105 / 211; fewer end in the Black Hole Age or fade in the Dark. 792 of 900 games sign a pact (a game: 1.2 Mutual Aid, 1.4 Open Archives, 0.9 Shared Watch) |
| neighbours, phase 2: refuge (work branch) | 147 | 57 victories, Degenerate Age 68 turns; 900 games 426 / 162 / 70 (440 / 150 / 69 before); by fate decay 177 / 450, stable 156 / 239, curvature 93 / 211. Of 2,906 neighbours 714 were saved and 326 absorbed, in 710 of 900 games |
| neighbours, phases 3 and 4: expansion, war (work branch) | 144 | 55 victories, Degenerate Age 68 turns; 900 games 396 / 158 / 68 (426 / 162 / 70 before); by fate decay 169 / 450, stable 145 / 239, curvature 82 / 211. Without the Hunger smelling them 410 / 167, without expansion 409 / 150. War does not change the autoplayer's games (identical); the 'warlike' strategy: 21 wars, 397 / 158 / 68, its war games 14 survive against 13 in peace |
| neighbours, phase 5: ways that meet; Part C live (7 Oct) | 146 | 60 victories, Degenerate Age 67 turns; 900 games 435 / 179 / 68 (396 / 158 / 68 before); by fate decay 179 / 450, stable 163 / 239, curvature 93 / 211. The autoplayer keeping its Echoes from the Choir: 439 / 163 / 71. Part C in all: 400 / 142 → 435 / 179 |
| beacons fed; neighbours' dealings (7 Oct) | 154 | 59 victories, Degenerate Age 69 turns; 900 games 437 / 183 / 69 (435 / 179 / 68 before); by fate decay 173 / 450, stable 162 / 239, curvature 102 / 211. Beacons alone: 300 games identical (the autoplayer lights none). In 30 games trade offers 17 → 5.3 a game, shared works 3.0 → 1.7 |
| runaway at 1.4×; steam worlds lifeless; the flare before turn 1 (8 Oct) | 143 | the runaway limit at 1.4 times Earth's sunlight (276.6 K, locked 300 K kept); life on steam worlds dies; a new galaxy's flares under way have done their damage (14 of 15 such living worlds in six galaxies start dead); 60 victories, Degenerate Age 73 turns; 900 games 429 / 185 / 69 (423 / 188 / 69 before), within the noise: 784 of 900 games play out as before, and the changes go both ways (16 defeat → endurance, 10 back; 8 victory → defeat, 8 back). By fate: decay 171 / 450, stable 157 / 239, curvature 101 / 211 |
| the audits; outer worlds; cooling; the gentle flare; attack (8 Oct) | 143 | the planet and star audits' fixes (no Kin room on a world frozen hard, day and night only from starlight, the Heart takes its worlds, dead worlds' seas boil in a flare, life dies at once past 395 K, two events need a living homeworld, no Kin on ice giants), one cooling law per dead star (white dwarfs Mestel then Debye, brown dwarfs Burrows; brown dwarfs give collectors all their light, Infrared Shrouds), and for new games outer worlds, cold-trapped water, a locked home moon and the physical flare (Aster's night side 323 K, not 681 K); the autoplayer never attacks. 56 victories, Degenerate Age 69 turns; 900 games 435 / 184 / 71 (429 / 185 / 69 live), within the noise; no game plays out as before (new galaxies differ). By fate: decay 166 / 450, stable 165 / 239, curvature 104 / 211. The audit's rule fixes alone (before cooling, outer worlds and the flare): 900 games 455 / 194 / 69 |
| a settlement where a star was; curvature warmth; stars by type (8 Oct) | 148 | 900 games identical to the clock run, line for line (the autoplayer never takes a star by force; no rule reads the new warmth) |
| a magnifier mode; the game at any size and translated (9 Oct) | 148 | interface only: 900 games identical to the clock run, game for game |
| a phone interface that leaves the map usable (10 Oct) | 148 | interface only (no change under `src/game`): 300 games identical to `main`, game for game; 72 victories |
| swarms go for ships near them; ships share a settlement's losses (11 Oct) | 154 | 69 victories, Degenerate Age 72 turns; 900 games 443 / 191 / 70 (439 / 203 / 71 before), within the noise. By fate: decay 180 / 450, stable 166 / 239, curvature 97 / 211. A part whose ship was gone going on to our nearest settlement (as offered) instead of back to its swarm: 118 / 61; with the autoplayer bringing idle probes home 130 / 57. Sharing losses alone 146 / 72. Per game (30): 1.07 parts sent, all after idle probes; ships lost to swarms 0.57 (0.20) |
| Halo Siphons can be shut; the halo empties sooner while they run; the Unlit's messages wait (11 Oct) | 151 | 69 victories, Degenerate Age 71 turns; 900 games 442 / 195 / 70 (443 / 191 / 70 before, the swarm batch), within the noise: 802 of 900 games play out as before, the changes both ways. By fate: decay 178 / 450, stable 167 / 239, curvature 97 / 211. Alone, against `main` before the swarms: 146 / 67 / 71 in 300 (148 / 72 / 71), 900 games 441 / 202 (439 / 203), 807 of 900 as before. The autoplayer researches the siphons in 151 of 300 games, 109 before η 25 (its fallback ignores `noAuto`), and never shuts them |
| the Last Star shines when it lights; its clock free (12 Oct) | 150 | 67 victories, Degenerate Age 72 turns; 900 games 445 / 199 / 70 (442 / 195 / 70 on `main`), within the noise: 721 of 900 play out as on `main`, and all 179 that changed light the Last Star, outcomes moving both ways. By fate: decay 177 / 450, stable 166 / 239, curvature 102 / 211. In the first 300, 75 games light it (η 15.0 to 2,370, median 23.1; 40 before η 24.5; 19 in the Black Hole Age's calendar, 1 in the Dark Era); the autoplayer keeps time with it in 32 |
| The Embers Dim only while the halo thins (12 Oct) | 157 | 69 victories, Degenerate Age 72 turns; 900 games 449 / 202 / 70 (445 / 199 / 70 with the Last Star), within the noise: 534 of 900 play out as before, the rest moved by the changed pool of chance events, both ways (35 defeat → endurance, 31 back). By fate: decay 181 / 450, stable 169 / 239, curvature 99 / 211 |
| rogue worlds leave their star behind; a finished Work not resumed; positronium (12 Oct) | 154 | 72 victories, Degenerate Age 72 turns; 900 games 456 / 203 / 71 (449 / 202 / 70 before), within the noise: 406 of 900 play out as before, the outcomes that moved going both ways (43 defeat → endurance, 38 back; 8 defeat → victory, 6 back). By fate: decay 189 / 450, stable 168 / 239, curvature 99 / 211; Aeon Seed victories 67 → 71 |
| a few young, glowing dwarfs (13 Oct; the new version, on its work branch) | 155 | 72 victories, Degenerate Age 72 turns; 900 games 455 / 202 / 70 (456 / 203 / 71 before), within the noise: 860 of 900 play out as before. By fate: decay 189 / 450, stable 168 / 239, curvature 98 / 211 |
| the others become civilizations (13 Oct; part 2a-2, `d216742`) | 204 | 81 victories, Degenerate Age 73 turns; the balance reference starts again: real neighbours that live on keep sharing (joint works, Open Archives, trades). 900 games 618 / 266 / 73 (455 / 202 / 70 with the light neighbours, which `--asleep` still plays line for line). By fate: decay 255 / 450, stable 219 / 239, curvature 144 / 211 |
| relations and light speed (13 Oct; parts 2a-3 and 2a-4, `a6cb1a5`) | 135 | 54 victories, Degenerate Age 75 turns; 900 games 364 / 142 / 74 (618 / 266 / 73 after 2a-2): a shared work gathers its star's light instead of a flat 6 a turn, Open Archives and the dealings by what each really has. By fate: decay 132 / 450, stable 137 / 239, curvature 95 / 211. Alive at our end: Lattice 46%, uploaded 29%, Chorus 26%, gardens 18%, sleepers 9% |
| the Lattice thinks a little (13 Oct; part 2a-5, `6b6c04e`) | 140 | 54 victories, Degenerate Age 73 turns; 900 games 376 / 147 / 73 (364 / 142 / 74 before), within the noise. By fate: decay 144 / 450, stable 131 / 239, curvature 101 / 211. The Tessellate builds the Archive of Everything itself in 53 of 558 games (12 before) |
| minds of their own (13 Oct; part 2a-5, `b299f6a`) | 136 | 45 victories, Degenerate Age 71 turns; 900 games 410 / 143 / 72 (376 / 147 / 73 before). By fate: decay 178 / 450, stable 147 / 239, curvature 85 / 211. Alive at our end: Chorus 30%, uploaded 27%, sleepers 21% (11%), gardens 17%, Tessellate 20% with the Archive of Everything its own in 196 of 558. A Lattice-led player wins the Quiet Lattice in about 9 of 10 games where matter lasts, as before the Lattice thought (`lattice` strategy) |
| the events of ordinary life for everyone; End Turn in slices: part 2a's reference (13 Oct; `3678301`) | 140 | 41 victories, Degenerate Age 71 turns; 900 games 397 / 131 / 71 (410 / 143 / 72 before), within the noise; the slices change nothing (24 games identical). By fate: decay 164 / 450, stable 136 / 239, curvature 97 / 211. Alive at our end: uploaded 30%, Chorus 28%, Tessellate 20% with the Archive of Everything its own in 198 of 558, sleepers 19%, gardens 17% |
| the Hunger among the civilizations (13 Oct; part 2b) | 135 | 64 victories, Degenerate Age 78 turns; 900 games 411 / 167 / 76 (397 / 131 / 71 at 2a's reference): survival within the noise, victories up as a neighbour offers notes only on what it knows (in 40 games 159 offers against 355, 1,260 energy paid against 5,927), so our autoplayer keeps its energy and quickens. By fate: decay 163 / 450, stable 148 / 239 (102 victories), curvature 100 / 211 (59). Of 2,700 others, 895 took a Hunger step (673 to Taint 15, 158 to 27, 64 to 45), none past 45; 6 of the first 300 games as before |
| ships by role: upkeep, screens, mending, the Picket and the Hunter (13 Oct; parts 2c-0, 2c-1) | 149 | 47 victories, Degenerate Age 75 turns; 900 games 409 / 152 / 75 (411 / 167 / 76 after 2b), within the noise. By fate: decay 175 / 450, stable 140 / 239, curvature 94 / 211. Without the autoplayer standing idle warships down after the Dusk: 361 / 146 (Vigil's upkeep in the Dark Era as much as the whole net) |
| war between civilizations, conquest, the Breacher and the Kinetic Lance (13 Oct; parts 2c-2, 2c-3) | 149 | 47 victories, Degenerate Age 75 turns; 900 games 409 / 152 / 75, identical to 2c-1 game for game: no war starts in any of the 900 (no one hears of 60 Taint in a neighbour, or reaches it); the war is checked by `unit/civ-war` and `unit/conquest` |
| the AI's judgement in war: the desperate's war, plunder, the Picket at home, the corrupted's Lance (13 Oct; part 2d) | 148 | 47 victories, Degenerate Age 75 turns; 900 games 407 / 151 / 75 (409 / 152 / 75 after 2c), within the noise: 863 of 900 as before. A war in 6 games of 900, all begun by the desperate; settlements taken in 3, one civilization conquered. By fate: decay 175 / 450, stable 138 / 239, curvature 94 / 211 |
| the end of matter fixed: each loss counted once, the protocols as far as there is room, a Horizon Vault kept at its hole, the reserve's home, the Bastion Shell at black holes only, the autoplayer re-encoding from η 27 under curvature (13 Oct; part 3-0) | 149 | 37 victories, Degenerate Age 73 turns; 900 games 416 / 124 / 75 (407 / 151 / 75 after 2d). By fate: decay 175 / 450 (11 wins, as before), stable 141 / 239 (95), curvature 100 / 211 (18 wins, 45 before: the Bastion Shells built everywhere had carried whole populations through the Great Evaporation). 533 of 900 as before |
| what a settlement is made of: forms, the Leptonic Confluence (13 Oct; part 3-1) | 145 | 36 victories, Degenerate Age 73 turns; 900 games 421 / 124 / 75 (416 / 124 / 75 after 3-0); by fate decay 179 / 450, stable 141 / 239, curvature 101 / 211. 745 of 900 as before. With what was re-encoded in a system dissolving before the Great Decay made leptonic at once (left to 3-3): 402 / 123, decay 160 |
| the Lattice lives on energy after matter (13 Oct; the player's word) | 144 | 39 victories, Degenerate Age 73 turns; 900 games 431 / 133 / 75 (421 / 124 / 75 before): decay 190 / 450 (14 wins), curvature 100 / 211 (24), stable as before; the wins the Long Thought's |
| the Passage; the autoplayer through the end of matter (13 Oct; part 3-2, `24fbc18`) | 175 | 62 victories, Degenerate Age 73 turns; 900 games 530 / 219 / 74 (431 / 133 / 75 before): decay 221 / 450 (65 wins), stable 169 / 239 (112), curvature 140 / 211 (42); 456 of 900 end as before. The Long Thought 174 (98), Silence 164 (211). The Passage as first built, by turns and rushed: 372 / 172, decay 138; with the timing, the Migration and cooling but not the pace: 428 / 210, decay 160; the pace rule at every age: Silence 107 of 295 where 60 had been |
| the Thinning (13 Oct; part 3-3, `a0352ef`) | 173 | 58 victories, Degenerate Age 73 turns; 900 games 522 / 205 / 74 (530 / 219 / 74 before): decay 210 / 450 (53 wins), stable as before game for game, curvature 143 / 211 (40); 760 of 900 end as before. First built, the early drift merged a passed settlement into one of ours still of matter: 531 / 192, decay wins 40 |
| the widest atoms: the weave, the nets, the countdown (13 Oct; part 3-5) | 217 | 69 victories, Degenerate Age 73 turns; 900 games 636 / 226 / 74 (639 / 226 / 74 at 3-4): decay and stable end exactly as before, game for game; curvature 136 / 211 (139), its 36 wins as before; 893 of 900 as before. The weave in 2 games. First built: 632 / 217 (the weaving researched into the Dark Era after the decay, and from the cheapest-left fallback in 100 stable games), then 637 / 218, 634 / 218, 635 / 226 (nets before the Last Horizon from what Continuity counts; a vault that could not afford to leave the weave, lost at the decay) |
| leaving a hole, and the Horizon form (13 Oct; part 3-4) | 217 | 69 victories, Degenerate Age 73 turns; 900 games 639 / 226 / 74 (522 / 205 / 74 before): decay 330 / 450 (210; 77 wins, 53), stable 170 / 239 (169; 235 of 239 end as before), curvature 139 / 211 (143; 36 wins, 40), within the noise. Drifts in 384 games, the Horizon form in 4. Under decay the vaults now drift to a hole with spin, the Heart above all, where before they starved at the small hole the Migration found, slowed the pace to stretch the reserve, and entered the Dark Era short: of the 450, 125 saved (72 had faded, 41 lost their will), 5 lost. The first drift rule, the nearest hole with spin: 638 / 227 with Horizon Writing researched everywhere |
| harder: the dark's Continuity (an empty reserve 10 a turn, arrays for their own settlement), swarms on to our settlements (14 Oct; the player: "make it harder pls") | 167 | 67 victories, Degenerate Age 71 turns; 900 games 520 / 218 / 72 (636 / 226 / 74 at 3-5): decay 251 / 450 (73 wins), stable 164 / 239 (107), curvature 105 / 211 (38); victories as before. The Fade 126 (78), Silence 224 (159), The Will Fails 30 (27); 466 of 900 end the same way (88 line for line). The dark alone (300): 186 / 68, The Fade 23 → 56; the swarms on top: 167 / 67, Silence in the Degenerate Age 12 → 23. The Harsh setting before both: 198 / 58 of 300. A part turning on a settlement founded where it waits (an ark come down) changes none of the 900 |
| the stable fate's late game: a few heavy dwarfs, black dwarf supernovae, iron stars, tunnelling collapse; the Passage where matter is stable (14 Oct; part 3-6) | 144 | 61 victories, Degenerate Age 71 turns; 900 games 460 / 209 / 72 (520 / 218 / 72 at "Harder"): decay 251 / 450 (449 line for line, every outcome the same), curvature 106 / 211 (105; the heavy dwarfs are in every fate), stable 103 / 239 (164): The Long Thought 80 (89), Recurrence 5 (57), The Fade 79 (37), Silence in the Dark Era 21 (2). The stable dark is a finite budget now; the autoplayer never sleeps. 748 of 900 line for line |
| the Archive of Everything dearer, 6,000 insight (14 Oct; `9516abc`) | 146 | 63 victories, Degenerate Age 71 turns; 900 games 461 / 214 / 72 (460 / 209 / 72 at 3-6), within the noise. By fate: decay 248 / 450 (73 wins), stable 107 / 239 (101), curvature 106 / 211 (40). The Lattice-led strategy wins the Quiet Lattice in 74 of 300 (214 at 1,500) |
| ships see what they pass (14 Oct; part 1b, `dd34cc4`) | 147 | 64 victories, Degenerate Age 72 turns; 900 games 420 / 164 / 70 (461 / 214 / 72 before), within the noise: the same rules with the neighbours' streams reshuffled (seeded under `civX`) give 429 / 179 / 71, and only 333 of 900 end as before (this change: 371). By fate: decay 237 / 450 (65 wins), stable 86 / 239 (78), curvature 97 / 211 (21). The sight for our own ships only: 439 / 195 / 71 |
| the stable fate, a little softer: substrate outlasts the collapse, earlier warnings, the autoplayer's Long Sleep; a Work finished as Continuity runs out stands (14 Oct; `d92849a`) | 153 | 63 victories, Degenerate Age 72 turns; 900 games 444 / 160 / 70 (420 / 164 / 70 before): stable 110 / 239 (86; 74 wins, 78), decay and curvature identical game for game. With the neighbours reshuffled: 440 / 177 / 69 (decay 237, stable 105, curvature 98; 313 of 900 as with the usual streams). Survival over two runs each: 445 before the sight under way, 442 now |
| the game keeps its word (19 Oct; the new version, `ea5ec7b`) | 156 | 65 victories, Degenerate Age 71 turns (153 / 63 / 70 before), within the noise; by fate decay 82 / 148, stable 44 / 81, curvature 30 / 71. Harsh, 300 games: 124 / 35 / 66 (114 / 29 / 66 before). Run again on 19 Oct at `3073232` (no code changed since `ea5ec7b`): the same figures, standard, Harsh and by fate |
| the game keeps its word (19 Oct; today's game, `claude/promises-main` `7d4c702`, PR m1omg/Steliterate#34, `e827e2f`) | 160 | 81 victories, Degenerate Age 72 turns; 900 games 476 / 244 / 71 (456 / 203 / 71 before): survival within the noise, the victories from the hidden step alone (without it the same 300 games give 160 / 72 / 72; `docs/spoilers/slow-ones.md`). By fate: decay 193 / 450 (19 wins), stable 165 / 239 (127), curvature 118 / 211 (98). Harsh, 300 games: 147 / 62 / 68 (140 / 52 / 70 before). 204 of 300 play out as without the step |
| falling worlds break up and giants flash; more worlds at black holes; in new games (20 Oct; the new version) | 147 | 63 victories, Degenerate Age 68 turns (156 / 65 / 71 before). The new worlds re-roll every game (0 of 300 the same), so a control with the new worlds and the old falls measures the rules: 157 / 65 / 69, against which they cost 10 games (44 lost, 34 won; the autoplayer builds no shelters), within the noise. By fate decay 74 / 148, stable 39 / 81, curvature 34 / 71. Harsh, 300 games: 145 / 52 / 73 (124 / 35 / 66 before; the control 135 / 56 / 71, so there the rules gave 10). Moving the shelters to Dusk research afterwards changed no game: 10 replayed, all the same |
| falling worlds, the same (20 Oct; today's game, `claude/promises-main` `8133d7f`, PR m1omg/Steliterate#35, `e4c77d7`) | 149 | 80 victories, Degenerate Age 72 turns (160 / 81 / 72 before), every game re-rolled, within the noise. By fate decay 57 / 148, stable 51 / 81, curvature 41 / 71. Harsh, 300 games: 154 / 58 / 68 (147 / 62 / 68 before). 12 replayed after the shelters moved: all the same |
| finds only where they can be; one sea for the Water row and the picture (20 Oct; the new version) | 165 | 77 victories, Degenerate Age 72 turns (147 / 63 / 68 before); 30 of 300 the same, the finds' tests changing which find a survey turns up. By fate decay 80 / 148, stable 43 / 81, curvature 42 / 71. Harsh, 300 games: 136 / 38 / 68 (145 / 52 / 73 before; 32 the same). Within the noise |
| the same (20 Oct; today's game, `claude/promises-main` `b48562d`, PR m1omg/Steliterate#36, `981e0f0`) | 165 | 77 victories, Degenerate Age 70 turns (149 / 80 / 72 before); 36 of 300 the same. By fate decay 67 / 148, stable 63 / 81, curvature 35 / 71. Harsh, 300 games: 150 / 59 / 71 (154 / 58 / 68 before; 43 the same). Within the noise |
| the pace: ten turns to a Tide turn, the Dark Era's own clock, no slow turn ending an age; the late ages an eighth richer (`LATE_YIELD` 1.125); the autoplayer sleeps through the dark (20 Oct; the new version) | 187 | 77 victories, Degenerate Age 103 turns (165 / 77 / 72 before). By fate decay 107 / 148, stable 39 / 81, curvature 41 / 71. Harsh, 300 games: 147 / 51 / 98 (136 / 38 / 68 before). The Fade 26 (50). On the way: the honest turns alone 113 / 49 / 99; the late yield ×1.13 138 / 84, ×1.2 150 / 91, ×1.4 180 / 122, without the dark sleep. The Degenerate Age is longer in turns as the autoplayer no longer takes slow turns there in trouble |
| the same, the late ages two fifths richer (`LATE_YIELD` 1.4) (20 Oct; today's game, `claude/promises-main` `bd86639`, PR m1omg/Steliterate#37, `d2abd2a`) | 229 | 73 victories, Degenerate Age 112 turns (165 / 77 / 70 before). By fate decay 87 / 148, stable 79 / 81, curvature 63 / 71. Harsh, 300 games: 209 / 63 / 106 (150 / 59 / 71 before). The Fade 8 (38), The Will Fails 4 (31). Without the dark sleep ×1.2 gave 93 / 49 / 110, ×1.6 141 / 105 / 119. Survival rose with the sleep: the overpay had carried the autoplayer through the dark, and it never slept |
| combat: battles fought out a round a turn, tactics, every settlement firing, sieges by either side, the others fighting back (20 Oct; the new version) | 187 | 77 victories, Degenerate Age 103 turns, as before: our outcome the same in all 300 games, 299 the same in every detail (in the other a neighbour no longer begins a war it could not win). Harsh, 300 games: 147 / 51 / 98, all 300 the same. Wars are rare here (a neighbour's in 4 of 300, ours never), so a forced war measures it: `tools/sim.ts 300 standard warlike --war=40` gives 160 / 56 / 97 (121 / 47 / 90 under the old rules, where 76 games died in the Dusk); we took 66 settlements in 40 games and lost 3 in 3 (4 and 2), none conquered. Its first run, before one blockade and one storm a star a turn, ended 4 games in 12 with every settlement of ours taken |
| open air only above −14.9 °C (the coldest towns on Earth, Oymyakon and Verkhoyansk), domes or warrens below; a rush finishes its project at once (24 Oct; the new version, `8783e38`) | 184 | 79 victories, Degenerate Age 104 turns (187 / 77 / 103 before), within the noise: the autoplayer settles warm worlds first, and builds domes. By fate decay 108 / 148, stable 33 / 81, curvature 43 / 71. Harsh, 300 games: 141 / 51 / 97 (147 / 51 / 98 before). About 401 of 1,915 living worlds in 60 galaxies are too cold for open air at the start; no homeworld is |
| the same (24 Oct; today's game, `claude/promises-main` `dd60b5f`, PR m1omg/Steliterate#40, `0da09b3`) | 227 | 79 victories, Degenerate Age 113 turns (229 / 73 / 112 before), within the noise. By fate decay 87 / 148, stable 79 / 81, curvature 61 / 71. Harsh, 300 games: 204 / 57 / 105 (209 / 63 / 106 before) |
| our clock a span: the pace reaches other minds (8 Oct) | 148 | any rhythm from our dominant minds' clock to our turn's can talk (before, the minds' clock alone); 72 victories, Degenerate Age 71 turns; 900 games 439 / 203 / 71 (435 / 184 / 71 before): survival within the noise, victories up 19 as more neighbours are saved (775 of 2,894 against 688 of 2,899); 426 of 900 games play out as before. By fate: decay 167 / 450, stable 165 / 239, curvature 107 / 211. The autoplayer changes pace only for energy |
| water-rich worlds and steam worlds (8 Oct) | 139 | water-rich icy worlds keep their water; past the runaway limit, steam worlds (about 5 a galaxy); only the warm water-poor dry out; 62 victories, Degenerate Age 72 turns; 900 games 423 / 188 / 69 (426 / 184 / 68 with the dry pass), within the noise: 232 of 900 games play out as with it, and the changes go both ways (81 endurance → defeat, 79 back). By fate: decay 169 / 450, stable 157 / 239, curvature 97 / 211 |
| ice worlds by starlight (8 Oct) | 135 | new galaxies turn ice worlds that are not frozen into bare rock (about 15 a galaxy); 60 victories, Degenerate Age 70 turns; 900 games 426 / 184 / 68 (434 / 183 / 70 before), within the noise: 108 of 900 games play out as before, and the outcomes that change go both ways (116 endurance → defeat, 104 back; 50 defeat → victory, 46 back). By fate: decay 168 / 450, stable 170 / 239, curvature 88 / 211 |
| every measure in the settle lists; yields; twilight seas (8 Oct) | 147 | display only: all 300 games identical to the terraforming run, line for line |
| terraforming; type, music, rings (7 Oct) | 147 | 59 victories, Degenerate Age 71 turns; 900 games 434 / 183 / 70 (437 / 183 / 69 before); by fate decay 173 / 450, stable 162 / 239, curvature 99 / 211. The autoplayer researches Terraforming last among the Dusk's projects and builds none (its Kin live on living worlds, which gain nothing; in 60 games it researched it in 59, median turn 84, and built it in 0). Variants, 900: the tech there but never chosen 436 / 180 / 70 (a new project moves games through the cheapest-project picks); researched right after Volatile Shepherding 424 / 166 / 69 (the detour delays the projects that win); terraforming every Kin world it can, as early as it can, 423 / 166 / 68, still none built |
