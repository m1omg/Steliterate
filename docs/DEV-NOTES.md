# Developer notes

How to work on Steliterate. The stack is Vite 8, TypeScript 7, Preact with signals, and
three.js 0.186. Design is in `DESIGN.md`, history in `CHANGELOG.md`, and decisions in
`SESSION-NOTES.md`.

## Workflow for every batch

1. **Develop** on the session's work branch. Going live (since 9 Oct): a PR from it into `main`,
   merged with a merge commit, which I open and merge myself once the batch is validated (the
   player: "Always. You merge pls."), so the commit IDs cited here stay valid (PR
   m1omg/Steliterate#1 merged the game as `3e913f3`, PR m1omg/Steliterate#3 the next batch as
   `0e08054`, PR m1omg/Steliterate#4 the magnifier mode as `d9bd6e5`). Pages builds `main` and `claude/lucid-newton-30cbpk` alike, and the last push wins:
   the old live branch now lags `main`, so never push an older commit to it. A direct push to a
   live branch can be refused as a production deploy; the PR merge, asked for, is the way.
2. **Validate:**
   - `npx tsc --noEmit -p .`
   - `npm run build`
   - `node tools/playtest.cjs http://localhost:4173/ <shots dir>`, which needs `vite preview`
     on :4173. It must end with "ALL CHECKS PASSED", including the 30/144 Hz parity check.
   - If rules changed: `npx tsx tools/sim.ts 300 standard competent`. Count outcomes with
     `grep -oE "^seed [0-9]+: [A-Z]+" | awk '{print $3}' | sort | uniq -c`. Survival is
     ENDURANCE + VICTORY; noise is about ±12 per 300 games. For a closer call, compare 900 games
     against a `git worktree` of HEAD (symlink `node_modules` into it).
   - Save compatibility: `npm run savecompat` loads every save in `tools/saves/` through
     `readSave` → `migrate`, checks the round trip, and plays each to the end. It must end with
     "SAVE COMPAT OK". The saves: the 71-turn save from `551fb1a`, and four from the week of
     2 Oct (seed 1000, all in the Degenerate Age): `4fe2404` turn 87 with a star clock running,
     `7d0806d` turn 85, `9eea773` turn 119 just after a white-dwarf merger and turn 120 with a
     helium giant lingering. To try one in the browser, gunzip it and paste the JSON into
     Load / import → "Load from a save code".
   - Checks: `npm run check` (unit checks, about 15 s) and, with `vite preview` running,
     `npm run check:browser -- http://localhost:4173/` (browser checks, about 10 min). Both must
     end with "ALL CHECKS PASSED". See Test hooks and scripts.
3. **Commit** with the attribution lines, then `git push -u origin claude/lucid-newton-30cbpk`.
   The Pages workflow builds and force-pushes `dist/` to `gh-pages` on every push to that
   branch or `main`.
4. **Republish the artifact:**
   - Run `node tools/make-artifact.mjs`, which writes `dist/artifact.html` and prints its files.
   - Publish to https://claude.ai/artifact/BWqtVocJezc4XXmnNgWZzc. Include the new
     `assets/index-*.js` (and CSS if its hash changed), plus any new public files such as
     `music/canon.mp3`.
   - Set the old hashes to `null`.
   - Omit `capabilities` so the stored `downloads` capability carries forward.
   - That artifact belongs to the organization the game was built in. A session in another
     organization can read it but not update it (seen 28 Sep). There, rely on GitHub Pages,
     or publish a new artifact and record its URL here.

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
    beacon, dealings, terraform, twilight, icy, scorch, worlds, deadworlds, outer, attack, clocks, settled, curvature), plus `invariants` (12 whole games checked every turn: no NaN, no negative stocks or
    people, no settlement on a vanished world unless decay-proof, survivors' health within
    0..1; `npx tsx tools/checks/unit/invariants.ts 100` for more) and `determinism` (a save code
    and a clone play on identically to the original). They import `check`, `near`, `done` and
    `loadSave` (a save from `tools/saves/`) from `tools/checks/lib.ts`. `tsc` checks them, so
    they must type-check cleanly: the Pages build runs `tsc`.
  - `browser/*.cjs`: interface checks against a served build, each opening its own page through
    `start()` in `tools/checks/lib.cjs` (which waits for the server; any console error fails the
    check) and ending with `finish()`. Screenshots go to `playtest-shots/checks/<name>/`, or the
    folder given as the second argument.
  - `run.mjs unit|browser|all [url] [out] [names…]` runs them (unit checks several at a time,
    browser checks one at a time) and prints a summary; `npm run check` and
    `npm run check:browser` call it. Name some to run only those:
    `node tools/checks/run.mjs unit clock evap`.
  - A new rule or fix gets a check here. One-off investigations (traces, censuses) stay in the
    scratchpad.
- **The container is ephemeral.** Anything installed with pip is gone next session: numpy,
  scipy, matplotlib, imageio-ffmpeg (ffmpeg binary at
  `/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2`).
  So is `art-src/` (ignored by git): the graded files in `public/art/` are the only copies of
  the plates and sprites, so new art needs new source images.
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
- Components that read mutable game state need `void rev.value`.
- Hooks must come before any early return. `FleetPanel` has several `useState` calls.
- **Save compatibility:** only add optional fields, or compute things live. Put small counters
  in `civ.flags` (a `Record<string, number>`). `SAVE_VERSION` is 3. Every load goes through
  `migrate()`, which also runs `surveyWhereStationed` (ships parked at unsurveyed stars chart
  them).
- **Generation changes** must keep RNG consumption the same (pick from the already-shuffled
  order), or every seed's galaxy changes.
- **Harness blind spots:** the autoplayer never raids, asks for aid or picks tracks, so those
  never move the harness. Nor does it terraform: its Kin live on living worlds, and terraforming
  is for dead ones. The victories it reaches are The Long Thought and, at the Heart, The
  Aeon Seed: the other Great Works never move it. It does answer the flare event with choice 0 (keep time with the
  flare), and keeps time with every new star it can (choice 0 of A New Star and White Fire).
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
- `pgrep -f "tools/sim.ts 300"` matches its own command line. Don't use it to wait for the
  harness.
- The user dislikes long blocking waits. Prefer background runs and report when done.

## Where the newer systems live

- **The audits of 8 Oct** (planet and star; their scripts were in the scratchpad):
  - Dead stars, one law per kind in every age (`physics.ts`): `dwarfCoolingK` (Mestel, then
    t^-0.58 from `DEBYE_AGE` 5×10¹¹; capped at a red dwarf's flare peak), `brownCoolingK` (Burrows
    et al. 2001), `formedAt` (a hash of the mass: no random draw, so old saves get it too),
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
    collector light averaged over ages a..b (the power law integrated, then the 0.02 floor).
  - `bodyClimate` holds a world under Orbital Lamps at `LAMP_K` (285 K) at least
    (`starClimate` is the star's part); a floor, so it never adds to a flare.
- **`src/game/sim/flare.ts`:** `livedShare(state, pace, step)` is the pace factor everything
  scales by (yields, projection, tempo strain): 10^-pace, except 1 on a flare-clock turn and at
  most 1 on a turn cut short by a flare's start.
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
  drums, no big climax". Not made (the balance ran out): dark2, "almost silence: a faint warm
  drone that slowly changes colour, a single soft sine tone every so often like a lighthouse
  very far away, answered long afterwards by another; still, lonely, gently hopeful".
- **If Krea is topped up,** an AI Canon prompt could start from: "Instrumental. A slow, dark
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
| our clock a span: the pace reaches other minds (8 Oct) | 148 | any rhythm from our dominant minds' clock to our turn's can talk (before, the minds' clock alone); 72 victories, Degenerate Age 71 turns; 900 games 439 / 203 / 71 (435 / 184 / 71 before): survival within the noise, victories up 19 as more neighbours are saved (775 of 2,894 against 688 of 2,899); 426 of 900 games play out as before. By fate: decay 167 / 450, stable 165 / 239, curvature 107 / 211. The autoplayer changes pace only for energy |
| water-rich worlds and steam worlds (8 Oct) | 139 | water-rich icy worlds keep their water; past the runaway limit, steam worlds (about 5 a galaxy); only the warm water-poor dry out; 62 victories, Degenerate Age 72 turns; 900 games 423 / 188 / 69 (426 / 184 / 68 with the dry pass), within the noise: 232 of 900 games play out as with it, and the changes go both ways (81 endurance → defeat, 79 back). By fate: decay 169 / 450, stable 157 / 239, curvature 97 / 211 |
| ice worlds by starlight (8 Oct) | 135 | new galaxies turn ice worlds that are not frozen into bare rock (about 15 a galaxy); 60 victories, Degenerate Age 70 turns; 900 games 426 / 184 / 68 (434 / 183 / 70 before), within the noise: 108 of 900 games play out as before, and the outcomes that change go both ways (116 endurance → defeat, 104 back; 50 defeat → victory, 46 back). By fate: decay 168 / 450, stable 170 / 239, curvature 88 / 211 |
| every measure in the settle lists; yields; twilight seas (8 Oct) | 147 | display only: all 300 games identical to the terraforming run, line for line |
| terraforming; type, music, rings (7 Oct) | 147 | 59 victories, Degenerate Age 71 turns; 900 games 434 / 183 / 70 (437 / 183 / 69 before); by fate decay 173 / 450, stable 162 / 239, curvature 99 / 211. The autoplayer researches Terraforming last among the Dusk's projects and builds none (its Kin live on living worlds, which gain nothing; in 60 games it researched it in 59, median turn 84, and built it in 0). Variants, 900: the tech there but never chosen 436 / 180 / 70 (a new project moves games through the cheapest-project picks); researched right after Volatile Shepherding 424 / 166 / 69 (the detour delays the projects that win); terraforming every Kin world it can, as early as it can, 423 / 166 / 68, still none built |
