# Developer notes

How to work on Steliterate. The stack is Vite 8, TypeScript 7, Preact with signals, and
three.js 0.186. Design is in `DESIGN.md`, history in `CHANGELOG.md`, and decisions in
`SESSION-NOTES.md`.

## Workflow for every batch

1. **Develop** on branch `claude/lucid-newton-30cbpk` (PR m1omg/Steliterate#1).
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
- **Playwright:** `require('/opt/node22/lib/node_modules/playwright')`. Launch with
  `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`, and add
  `--autoplay-policy=no-user-gesture-required` for music tests. Watch `request` events for
  `music/…` to see which track loads.
- **Headless sim checks:** `npx tsx script.ts`, importing from `src/game/...` (`newGame`,
  `endTurn`, `autoPlay`). `autoPlay` answers events itself: it takes the first allowed choice
  that isn't tainted.
- **Checks** (`tools/checks/`, since 7 Oct; before then they lived in the ephemeral scratchpad):
  - `unit/*.ts`: rules checks run with tsx, one per change (accord, boil, castout, clock,
    cold-energy, cooling, dismantle, evap, fates, flash, focus, follow, old-saves, pace, quake,
    quick, refund, repeal, rogue, spare), plus `invariants` (12 whole games checked every turn: no NaN, no negative stocks or
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
  in `civ.flags` (a `Record<string, number>`). `SAVE_VERSION` is 2. Every load goes through
  `migrate()`, which also runs `surveyWhereStationed` (ships parked at unsurveyed stars chart
  them).
- **Generation changes** must keep RNG consumption the same (pick from the already-shuffled
  order), or every seed's galaxy changes.
- **Harness blind spots:** the autoplayer never raids, asks for aid or picks tracks, so those
  never move the harness. The victories it reaches are The Long Thought and, at the Heart, The
  Aeon Seed: the other Great Works never move it. It does answer the flare event with choice 0 (keep time with the
  flare), and keeps time with every new star it can (choice 0 of A New Star and White Fire).
- `pgrep -f "tools/sim.ts 300"` matches its own command line. Don't use it to wait for the
  harness.
- The user dislikes long blocking waits. Prefer background runs and report when done.

## Where the newer systems live

- **`src/game/sim/flare.ts`:** the last flare.
  - `turnStep(state, pace)`: the calendar step, stopping at a settled star's `blueAt` and pinned
    to `flare_step` while `civ.flags.flare_until` is set. Used by turns, projection, the
    autoplayer and the UI.
  - `scorched` (night side > `SCORCH_K` = 340 K at a blue dwarf); `thawed` ('warm' 273–340 K,
    'hot' < 373 K; frozen wet worlds only); `THAW_ROOM` 5.
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
    already below `FROZEN_K` start as ice or rock. `youngDwarfLight(a, b)`: a Dusk white dwarf's
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
- **Evaporation (`evaporateHole`, `src/game/physics.ts`):** one rule for a hole that evaporates in
  the Black Hole Age and for every hole left at the Last Horizon (`crossing.ts`): the primary
  becomes `void` with no spin, glow or light, its worlds go rogue, settlements stay with all their
  structures, and the system is `gone` only if nothing is left in it. `hawkingLight` is 0 for
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
  `sleepLights` animate on elapsed time; labels in `engine.ts` use `residentsOf`.
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
