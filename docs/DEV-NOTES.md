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
   - Save compatibility: `npm run savecompat` loads every save in `tools/saves/` (so far the
     71-turn save from `551fb1a`) through `readSave` → `migrate`, checks the round trip, and
     plays each to the end. It must end with "SAVE COMPAT OK". To try one in the browser, gunzip
     it and paste the JSON into Load / import → "Load from a save code".
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
  - `endTurns(n, auto)`, which autoplays and **clears pending events** (to test events, click
    `.endturn` instead)
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
- **Scratch scripts** live in the session scratchpad, which is ephemeral. The first session's
  (`raid.cjs`, `flare.ts`, `flareui.cjs`, `lore.cjs`, `ask.ts`, `thaw*.ts`, `loadold.ts` +
  `oldsave.txt` and others) are gone; its old save was regenerated from `551fb1a` into
  `tools/saves/`. Anything worth keeping belongs in `tools/`.
- **The container is ephemeral.** Anything installed with pip is gone next session: numpy,
  scipy, matplotlib, imageio-ffmpeg (ffmpeg binary at
  `/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2`).
  So is `art-src/` (ignored by git): the graded files in `public/art/` are the only copies of
  the plates and sprites, so new art needs new source images.
- **Plates for the ways of life** (`public/art/way_<way>.webp`, 29 Sep, Nano Banana Pro at 2K,
  16:9, about 111 Krea units each): garden, upload, chorus, dormant. `wayArt` in
  `src/ui/labels.ts` picks the plate (the generic `survivor` where a way has none: lattice and
  fork so far); shown in `Signals.tsx` cards and the system panel's Others section, once in
  contact. The chorus came with painted letterbox bars, cropped (152 and 151 px of 1536) before
  grading. Prompts in the style of the others: "A civilization …: <scene>. Painterly digital
  painting, dark and grainy, muted <palette>, soft brushwork, cinematic composition. No text,
  no letters, no signatures." Waiting for credit, the Tessellate's (from the Lattice's public
  blurb only): "the whole surface of a dark, airless moon tiled in vast hexagonal plates of
  machinery, an endless tessellation to the horizon, small tireless maintenance drones crawling
  along the seams, repairing and rebuilding, pale yellow work-lights in regular rows, no people
  anywhere, a dim dead star low in the black sky; orderly, patient, faintly uncanny; muted greys
  and ochres with pale yellow accents".

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
  never move the harness. Every victory it reaches is The Long Thought: the other Great Works
  never move it either. It does answer the flare event with choice 0 (keep time with the
  flare).
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
  Solar Arrays × insolation.
- **`src/audio/music.ts`:**
  - `TRACKS`: a list of files in `public/music` per age (title, dusk + dusk2, canon,
    degenerate + degenerate2, blackhole + blackhole2, dark, outcome). A lone track loops;
    several take turns, each fading out over its last `TRACK_CHANGE` (4 s, on `timeupdate`)
    and in over 3 s; a file that fails to load passes to the next, once round the list. The
    synth covers an age none of whose files load. `INTROS` (degenerate → canon, once per
    session, not when picked by hand) plays before the list and flows into it without a fade.
  - `TRACK_CHOICES`, `setTrack`/`current`/`chosen` (Settings → Music track).
  - The synth hiss runs through `layer.hiss`, which fades when a recording plays.
  - `startLoaded` calls `music.setEra`.
- **`src/render/systemView.ts`:** other civilizations: `residents` from `survivorWorld`;
  surface civs set the planet shader's `uLights`/`uDev`/`uNeon` and the new `uCityCol` (sodium
  for ours); `addHabitats` builds flotilla / ring-station / lattice by way, `habitats` and
  `sleepLights` animate on elapsed time; labels in `engine.ts` use `residentsOf`.
- **UI:**
  - `Story.tsx`: `LoreModal`, `loreView`, `worldFinds`.
  - `Drawer.tsx`: Raid button, settler list sorts, Sunlight row, resident lines, Ruins "Read
    again", find chips.
  - `Signals.tsx`: Ask for help.
  - `Misc.tsx`: `MusicTrackField`, `startLoaded` music.
  - `Lists.tsx`: Surveyed worlds sorts.
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
