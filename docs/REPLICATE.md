# Steliterate: a full specification, for replication

This document describes **Steliterate** as it plays at https://m1omg.github.io/Steliterate/,
as of commit `4b92446` on `main` of `github.com/m1omg/Steliterate` (16 October 2026, PR #33).
It was written for an AI agent asked to rebuild the game as closely as it can, in the player's
words: "a comprehensive full summary of this game for an AI agent to replicate".

Every rule, number and formula here was read from the code. Where the code and the design
notes disagree, the code wins and this document says what the code does. References such as
`sim/turn.ts: endTurn` name a file under `src/` and the function that holds the rule. The
original is GPL-3.0; its art and music were made with generative tools (section E), and a
copy needs its own.

> **The last section is sealed.** It holds the secrets of the story: the two stranger minds,
> the Lattice's story and its ending, and every ending's conditions and text. A player who wants
> to discover them should hand this file over without reading that section. Everywhere else
> they are named only from outside, with a pointer to it.

## How to use this document

1. **Read section 1** (the game in brief) for what the game is for and how it feels. Every
   later choice should serve it.
2. **Build in this order**, checking each step before the next:
   1. The seeded RNG, the state's shape and the galaxy's generation (section A). The same seed
      must always make the same galaxy.
   2. Time: η, the ages, the lengthening turns and the turn pipeline, with an empty
      civilization (section A).
   3. The physics: each star's life, each world's temperature and fate, and the forecast
      (section B).
   4. The civilization: resources, settlements, Threads, society, research, structures,
      ships and settling (section C).
   5. The others and the end: the Hunger, the fellow survivors, signals, events, the Great Works
      and the endings (section D and the sealed section).
   6. The autoplayer and the balance harness (section D). Compare its numbers with the
      targets below before tuning anything else.
   7. What the player sees and hears: the 3D views, the interface, accessibility and the
      sound (section E).
   8. Saves, the checks and the deploy (sections A and E).
3. **Use the appendix tables** for every structure, tech, ship, Great Work, charter, Thread,
   demand, event and find. They are generated from the game's data files, so they are exact.

### Targets to check a copy against

With the autoplayer playing 300 standard games at the "competent" level (section D):

| | Today's game |
|---|---|
| Games surviving to the end | 154 of 300 |
| Victories | 72 |
| Length of the Degenerate Age | 72 turns on average |
| 900 games | 456 survive, 203 victories, a Degenerate Age of 71 turns |
| By the fate of matter (900) | decay 189 of 450 survive, stable 168 of 239, curvature 99 of 211 |
| Noise | about ±12 survivors in 300 games; two runs of 900 can differ by 30 |

A faithful copy will not match game for game, since its random draws differ, but it should
land within the noise.

## Contents

- [1. The game in brief](#1-the-game-in-brief)
- [A. The skeleton: architecture, state, randomness, generation, time, the turn and saves](#a-the-skeleton-architecture-state-randomness-generation-time-the-turn-and-saves)
- [B. The physics](#b-the-physics)
- [C. The civilization](#c-the-civilization)
- [D. The others and the end](#d-the-others-and-the-end)
- [E. What the player sees and hears, and how it is tested and shipped](#e-what-the-player-sees-and-hears-and-how-it-is-tested-and-shipped)
- [Appendix: the data tables](#appendix-the-data-tables)
- [S. The sealed section: the secrets of the story](#s-the-sealed-section-the-secrets-of-the-story)


## 1. The game in brief

**A turn-based survival strategy game at the end of starlight**, with animated 3D views. It is
a 4X game whose fourth X is *endure*: explore, expand, exploit, endure.

- **The start.** You begin on one geologically dying world around a red dwarf, at the very end
  of the age of stars, some 90 trillion years after the Big Bang.
- **The aim.** Keep your people alive for as long as the universe allows, and decide what
  "alive" means. The game runs from the last red dwarfs, through the age of cold stellar
  remnants and the age of black holes, into the Dark Era, as far as about 10^(10^122) years.
- **The antagonist** is the dying universe itself (think Frostpunk at the scale of a galaxy).
  Other minds are part of the world's texture and drama, not rivals on a scoreboard. There is
  no conquest victory.
- **The civilization is never shown.** It might be human descendants or something else. The
  text calls its original people "the Kin" and nothing more.

**Its pillars** (from the design, and they still hold):

1. **The universe is the antagonist.** Stars brighten, collapse and cool. Planets are
   stripped away or fall into their dead suns. The galaxy evaporates, matter may decay, and
   black holes evaporate. Every age removes something you depended on.
2. **Adaptation over conquest.** You win by changing what you are faster than the universe
   changes around you: slower minds, colder substrates, new sources of energy.
3. **Many ways to persist.** Biology, uploaded minds, merged minds, non-conscious processes,
   speculative physics, and a dark path that eats everything. None is the right one.
4. **Honest physics, clearly labelled speculation.** Timelines follow the literature of
   physical eschatology (section B cites it). Where the game goes beyond known physics, or
   bends it for play, it says so, in the Codex and here.

**Its shape in play:**
- Each turn covers more time than the last, from 40 years at the start to spans whose length is
  itself a power of ten.
- Travel is slower than light, and so is every message.
- The civilization is a braid of kinds of mind (the Threads), each with its own clock, needs
  and politics.
- Each age takes away the energy sources of the last, so the player must change what they are
  to go on.

**Its look and sound:** a dark, quiet, scientific style; a galaxy map and a system view in
three.js; an interface in muted panels with clear type; a score per age, partly recorded and
partly synthesized; painted plates for events and ages.

**Three habits run through the whole code**, and a copy should keep them:
- **Determinism.** The simulation is seeded and draws its random numbers in a fixed order, so
  a seed always makes the same galaxy and the autoplayer the same game.
- **Refresh-rate independence.** Everything that moves is driven by elapsed time, with
  `1 − exp(−k·dt)` smoothing, never by frame counts. 30 Hz and 144 Hz look the same.
- **Saves are forever.** Every load runs a migration, and nothing a player saved stops loading.

## A. The skeleton: architecture, state, randomness, generation, time, the turn and saves

This section is the frame everything else hangs on. Build it first, with an empty civilization,
and check that a seed always makes the same galaxy and that the turns lengthen as described
before adding the economy (section C) or the physics of each star and world (section B).
Everything that concerns the two stranger minds, and every ending, is named here only from
outside; the details are in the sealed section (S).

### A.1 Architecture

**Stack.** Vite 8, TypeScript (strict), Preact 10 with `@preact/signals`, three.js 0.186, the Web
Audio API. No server: the game is a static page, and saves live in the browser. `index.html`
holds two layers, `<div id="stage">` (the WebGL canvas) and `<div id="ui">` (the Preact tree
over it), and loads `src/main.tsx`. Fonts come from Google Fonts (Big Shoulders Display, IBM
Plex Mono, Saira Semi Condensed, Spectral).

**Module layout.**

| Folder | What it holds |
|---|---|
| `src/game/` | The deterministic simulation. Plain data in, plain data out; no DOM. `types.ts` (the state), `rng.ts`, `gen.ts` (the galaxy), `names.ts`, `newGame.ts`, `eras.ts` (ages, the Tide, formatting, milestones), `fate.ts` (the fate of matter, the age against the calendar), `physics.ts` (light, temperatures, climates, `evolveUniverse`: section B), `save.ts`, `auto.ts` (the autoplayer: section D). |
| `src/game/sim/` | One file per system. `turn.ts` (`endTurn`, the pipeline), `economy.ts`, `storage.ts`, `research.ts`, `society.ts`, `accord.ts`, `fleets.ts`, `hunger.ts`, `survivors.ts` and its neighbours (`dealings`, `pacts`, `war`, `claims`, `refuge`, `homes`, `ways`, `sites`), `signals.ts`, `events.ts`, `forecast.ts`, `crossing.ts`, `flare.ts` (the turn's length: flares and new-star clocks), `flow.ts`, `terraform.ts`, `beacons.ts`, `archive.ts`, `spare.ts`, `mods.ts` (research modifiers, tempo strain), `projection.ts` (next turn's numbers for the HUD, without changing anything), `actions.ts` (every player action), `endings.ts`, `minds.ts` (sealed), `util.ts`. |
| `src/game/data/` | Static tables: `structures.ts`, `techs.ts`, `ships.ts`, `works.ts`, `charters.ts`, `threads.ts`, `events.ts` (events, their texts and choices, and the survey finds). See the appendix tables. |
| `src/render/` | three.js: `engine.ts` (one renderer, two scenes, the loop on elapsed time, picking), `galaxyView.ts`, `systemView.ts`, `camera.ts` (orbit rig, `1 − exp(−k·dt)` smoothing), `post.ts`, `shaders/`. Section E. |
| `src/ui/` | Preact: `store.ts` (signals), `App.tsx`, `turnflow.ts` (`doEndTurn`), `hud/`, `panels/Drawer.tsx`, `screens/` (Menu, Setup, Research, Lists, Society, Signals, Story, Codex, Manual, Misc), `a11y.ts`, `download.ts`, `labels.ts`, `fmt.ts`. Section E. |
| `src/audio/` | `core.ts` (the shared graph, unlocked by the first gesture), `music.ts`, `sfx.ts`, `trackOut.ts`. Section E. |

**How the interface and the simulation talk** (`ui/store.ts`). The whole game is one mutable
`GameState` object held in the signal `game` (`signal<GameState | null>`). The simulation
mutates it in place; it never returns a new state. After any change the UI calls `bump()`,
which increments the signal `rev` and hands the state to the 3D engine (`engine.setState(g)`).
Every component that reads game state starts with `void rev.value` so it re-renders on each
bump. Player actions go through `act(fn)`: `fn(state)` returns `null` (or nothing) on success,
or an error string, which is shown as a toast instead of bumping. Every function in
`sim/actions.ts` follows that contract (`ActionResult = string | null`). Other UI signals:
`screen` (`'menu' | 'setup' | 'game'`), `modal` (which window is open: research, fleets,
settlements with a tab, charters, threads, signals, log, codex, settings, save, crossing,
outcome, era_intro), `selection` (`{kind: 'system' | 'body' | 'fleet' | 'swarm', id}`), `view`
(`'galaxy' | 'system'`), `toasts` (at most three; a repeat of the same text is dropped), `busy`,
`targeting` (a fleet waiting for a destination), and the UI settings (A.8).

**Ending a turn from the interface** (`ui/turnflow.ts: doEndTurn`). Ignored while `busy` or
after an outcome. It snapshots what it will compare (fleets, known systems, research, idle
fleets, contacts, ship counts, the last log entry), calls `endTurn(state)`, then `bump()`, then
`autosave()` (A.7). Then an outcome opens the outcome screen, a crossing report the crossing
screen; otherwise it raises the turn's toasts and prompts (section E). During a Long Sleep it
calls itself again after 420 ms while `civ.sleepTurns > 0` and no event is pending. Pending
events (`state.pending`) are shown one at a time in a blocking dialog (the HUD is `inert`
behind it); the player answers each (`actions.ts: answerEvent` → `events.ts: resolveEvent`,
which runs the choice with the RNG, removes the event and logs `Title (System): choice.`).

**Boot** (`main.tsx`). Creates the `Engine` on `#stage` with callbacks for picking, hovering,
following and entering or leaving a system; applies quality, paused orbits and view mode from
the saved preferences; starts the render loop; reads `?lowvision` from the URL; installs the
audio unlock (sound starts after the first gesture) and starts the music; renders `<App />`
into `#ui`. Behind the menu it shows a preview galaxy, `newGame({ seed: 7 })`, turning slowly.
It registers a hot-reload hand-off for the claude.ai viewer (`window.claude.hot`: the game is
carried across a republish as a save code). If the GPU context is lost and will not come back,
it saves the autosave, sets `sessionStorage['steliterate.resume'] = '1'` and reloads; on boot
that flag loads the autosave straight into the game. It also installs the keyboard shortcuts
(Enter ends the turn; section E lists the rest).

**Test hooks.** `window.__stel` exposes `newGame(opts)` (opts are `GameSettings` fields, plus
`tutorial`), `endTurns(n, auto = true, keep = false)` (for each turn: the autoplayer at
"competent" if `auto`, then `endTurn`, then clears `state.crossing`, and clears pending events
unless `keep`), `autoPlay()`, `orderFleet(fleetId, systemId, order)`, `select(kind, id)`,
`refresh()`, `notify(text, kind)`, `state()`, `engine()`, `music()`, `audio()`,
`setVolumes(m, s)` and `sfx(name)`. Headless checks import `newGame`, `endTurn` and `autoPlay`
directly; `tools/sim.ts` is the balance harness (section D) and `tools/savecompat.ts` replays
old saves (A.7).

### A.2 The state (`game/types.ts`)

Everything in `GameState` is plain JSON (with ±Infinity encoded on save, A.7). Ids are strings.
Collections that need lookup by id are `Record<string, T>`; the iteration order of
`Object.values` (insertion order) matters wherever the code walks them, so keep insertion order.

**`GameState`**

| Field | Type | Meaning |
|---|---|---|
| `v` | number | Always 1; unused. |
| `settings` | `GameSettings` | The new-game settings (A.8). |
| `rng` | number | The simulation RNG's 32-bit state (A.3). |
| `turn` | number | Starts at 1; +1 each `endTurn`. |
| `era` | `EraId` | The age the player sees: `'dusk' \| 'degenerate' \| 'blackhole' \| 'dark'` (A.5). |
| `eraTurn` | number | Turns since this age began (0 at its start). |
| `years` | number | Cosmic time in years. Exact while finite; `Infinity` in the deep Dark Era. |
| `eta` | number | η, canonical: log10 of the years (A.5). |
| `turnLength` | number | Years the last turn spanned (`Infinity` in the Dark Era). |
| `protonsDecay` | boolean | `fate === 'decay'` (kept for old saves). |
| `fate` | `'decay' \| 'stable' \| 'curvature'` | The fate of matter. Optional: absent in saves before version 3. |
| `gfe` | number | Galactic free energy, 0..1 (starts at 1, floor 0.05). Scales light, mining and new-star rates. |
| `provinces` | `Province[]` | The galaxy's provinces (A.4). |
| `regions` | `Region[]` | Reaches, clusters, the core, the outliers. |
| `systems` | `Record<id, StarSystem>` | Every star system. |
| `bodies` | `Record<id, Body>` | Every world, belt and Deep. |
| `colonies` | `Record<id, Colony>` | Our settlements. |
| `fleets` | `Record<id, Fleet>` | Our fleets. |
| `civ` | `Civ` | The player's civilization. |
| `survivors` | `Record<id, Survivor>` | The fellow survivors (section D). |
| `minds` | `Record<id, Mind>` | Two records for the stranger minds (shape and start values: sealed, S.1.1). |
| `swarms` | `Record<id, Swarm>` | Hunger swarms (section D). |
| `signals` | `Signal[]` | Messages crossing the dark at light speed; at most 160 kept. |
| `forecasts` | `Forecast[]` | The astronomers' warnings, rebuilt by `updateForecasts` (section B). |
| `pending` | `PendingEvent[]` | Events waiting for the player's choice. |
| `log` | `LogEntry[]` | The Record; at most 400 kept (oldest dropped). |
| `battles` | `Battle[]` | Battle notes `{systemId, turn, text}` (uncapped). |
| `nextId` | number | Counter for `uid()` (starts at 1). |
| `crossing` | `CrossingReport \| null` | The last crossing's report, until the player closes its screen. |
| `outcome` | `Outcome \| null` | Set when the game ends: `{kind, ending, turn, eta}`. Kinds and conditions: sealed (S.4.1). |
| `flags` | `Record<string, number>` | Global counters: `tut` (tutorial step), `hunger_woke`, `first_swarm`, `decay_lost` (people lost when matter dissolved), `gfe_prev`. |
| `fired` | `Record<string, number>` | Event id → turn it fired (once-only events), and `last_<id>` → turn a random event last fired. |
| `saveVersion` | number | Save format version (A.7). Optional. |

**`Civ`**

| Field | Start | Meaning |
|---|---|---|
| `name`, `homeSystemId` | settings, home | |
| `capitalId` | the homeworld's colony | Reassigned at the end of each turn to the most populous settlement if missing. |
| `energy` | 60 | The reserve; capped each turn at `reserveCapacity` (base 100 plus storage, × research). |
| `matter` | 120 | |
| `accord` | 15 | Stock spent on charters; clamped 0..999. |
| `resolve` | 62 | 0..100, the will to go on. |
| `dissent` | 12 | 0..100. |
| `standing` | 60 each | Each Thread's approval, 0..100. Threads: `kin, echoes, chorus, lattice, coldminds`. |
| `lowStanding` | 0 each | Turns each Thread has spent below the fork threshold. |
| `demands` | null each | Each Thread's current demand id. |
| `techs`, `researching`, `research` | `[]`, null, `{}` | Known techs, the current project, insight banked per project. |
| `work`, `works` | null, `{}` | The active Great Work; insight banked per work. |
| `charters` | `[]` | Laws in force. |
| `pace` | 0 | log10 factor against the Tide (A.5). |
| `dormant`, `sleepTurns`, `wakeBonus` | false, 0, 0 | Dormancy and the Long Sleep (A.5). |
| `known` | (A.4) | System id → 1 detected, 2 surveyed. |
| `continuity` | 100 | Integrity in the Dark Era, 0..100. |
| `taint` | 0 | Hunger Taint, 0..100. |
| `flags` | `{}` | Small counters (below). |
| `stats` | empty arrays | `pops`, `energy`, `resolve` per turn, at most 500 each. |

**`civ.flags`.** Saves may only add optional fields, so small counters live here as numbers.
Those of this section: `insight_bank` (insight carried over, capped at 2000 when nothing is
researched), `reserve_cap`, `last_energy_net`, `last_matter_net`, `last_insight`,
`last_accord` (the last turn's figures, for the HUD), `flare_until`, `flare_step` (a flare
clock), `star_until`, `star_step`, `star_next`, `star_flash` (a new-star clock), `fate_known`
(turn the fate was revealed), `matter_gone`, `flowed` (turn the Long Flow came), `stillness`
(one more step of slowing), `despair`, `frz_<bodyId>` (a world's freezing was announced),
`dismantled_<colonyId>_<structureId>` (how many were taken apart there, so rebuilding one does
not repeat its one-time effects), `halo_drawn`, `siphons_shut`. Other systems add their own
(`joint_<sv>`, `raid_*`, `demand_age_<thread>`, `wars`, `tamed`, …); a few belong to the
stranger minds (sealed).

**`StarSystem`**: `id`, `name`, `regionId`, `provinceId`, `pos` (display), `phys` (light-years),
`primary`, `bodies` (body ids, the Deep first), `seed` (a hash, A.4), `special?`
(`'home' | 'core' | 'outlier' | 'survivor' | 'sleeper'`, and one more value that is never set:
sealed), `ejected?` (flung out of the galaxy), `rust?` (Hunger infestation 0..1), `beacon?`,
`gone?` (nothing left).

**`Primary`**: `kind`, `mass` (M☉), `lum` (base light factor), `blueAt?` (year a red dwarf leaves
the main sequence), `blueK?`, `blueLum?` (its last flare's peak surface temperature and
luminosity), `whiteAt?` (year it collapses into a white dwarf), `bornAt?`, `diesAt?` (new stars),
`halo?` (a white dwarf warmed by dark-matter capture), `haloLeft?` (year such a dwarf was cast
out), `spin`, `spinMax` (extractable rotational energy), `evaporateAt?` (black holes),
`rekindle?` (extra light from a world falling in). Kinds: `red_dwarf`, `blue_dwarf`,
`white_dwarf`, `black_dwarf`, `brown_dwarf`, `neutron_star`, `black_hole`, `smbh`,
`collision_star`, `helium_star`, `helium_giant`, `rogue` (a starless group of worlds), `void`
(nothing left), and one kind made only by a stranger mind (sealed, S.1.2).

**`Body`**: `id`, `systemId`, `name`, `kind` (`eyeball, terran, super_earth, barren, ice,
ocean_ice, gas_giant, ice_giant, asteroids, deep`; the `deep` is the orbital space around the
primary, where stations live), `orbit` (display radius), `phase`, `size` (display radius),
`seed`, `orbitAU`, `massEarth`, `habitability` (0..1, intrinsic suitability for Kin),
`vitality` (0..1, living fraction now), `decline` (base vitality loss a turn), `coreHeat`
(0..1), `richness` (matter yield multiplier), `hydrogen` (fusion fuel multiplier), `water?`
(share of the surface under water or ice; for ice-shelled worlds the ocean beneath), `traits`
(strings: `homeworld`, `tidally_locked`, `failing_dynamo`, `subsurface_ocean`, `outer`,
`water_rich`, `once_alive`, and survey-find ids), `relic?` (`{kind: 'archive' | 'engine' |
'sleepers' | 'tomb' | 'ghosts', state: 'hidden' | 'found' | 'studied' | 'woken' | 'spent',
flowed?}`), `lore?` (event id → the choice made there), `colonyId`, `inspiralAt?` (year it
reaches its dead star's tidal limit), `feeding?` (`{start, tau, base, model: 'feed' |
'rekindle', revealed}`), `rogue?` (stripped from its star), `dissolved?`.

**`Colony`**: `id`, `bodyId`, `systemId`, `name`, `founded` (turn), `pops` and `growth` (per
Thread), `cryo` (Kin in Cold Sleep), `structures` (id → count), `queue` (`QueueItem`: `uid`,
`kind: 'structure' | 'ship'`, `key`, `progress`, `cost`, `paid?: {matter, energy}`), `focus`
(`balanced | energy | matter | industry | insight | accord`), `spare?` (`salvage | study | tend
| morale`; absent means salvage), `overdrive`, `damage` (0..1), `starving` (turns in deficit),
`flags_rushed?`, `last?` (the last turn's `YieldBreakdown`).

**`Fleet`**: `id`, `name`, `ships` (`{cls, hp}`), `at` (system while stationed, else null),
`from`, `to`, `traveled`, `distance` (ly of the current leg), `order` (`idle | move | colonize
| survey | tame | fortify | hold`), `targetBody?`, `auto?: 'explore'`, `scanned?`.

**Other records** are described with their systems: `Survivor` and `Swarm` (section D; the
survivors' start values are in A.4), `Signal` (`sentYears`, `arriveYears`, `arrivedTurn`,
`choices`, `resolved`: null, a choice id, `'read'` or `'lapsed'`), `Forecast` (`dueYears`,
`severity: info | warn | danger | boon`), `LogEntry` (`turn`, `era`, `text`, `kind: info | good
| bad | era | combat | event | mind`, `systemId?`, `fleet?`), `PendingEvent` (`uid`, `defId`,
`data`), `CrossingReport` (`from`, `to`, `title?`, `intro?`, `lines`, people and settlements
before and after; a storm inside an age has `from === to`).

**Ids.** Generation uses one counter for regions, systems and bodies, written in base 36 after a
prefix: `r0` (the core region), `s1`, `b2`, … in creation order. Provinces have fixed ids
(`p_core`, `p_anc0..2`, `p_str0..1`, `p_halo`, `p_void`); survivors `sv0..sv3`; Hunger nests
`hg0..hg2`. In play `uid(state, prefix)` returns `prefix + (nextId++).toString(36)`: `c`
colonies, `f` fleets, `ev` pending events, `sg` signals, `q` queue items, `sw` and `hg` swarms
(parts and splits), `fk` forks (a Thread that splits away), `sl` a civilization of woken
sleepers that an event can create. A new game's first ids are colony `c1` and fleets `f2`,
`f3`, `f4`, leaving `nextId` at 5.

### A.3 The seeded RNG (`game/rng.ts`)

**Generator.** mulberry32, state a 32-bit unsigned integer:

```ts
next(): number {
  let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
```

The constructor takes `seed >>> 0`. Helpers, each built on `next()` and consuming exactly the
draws shown: `range(a, b) = a + (b − a)·next()` (one draw); `int(a, b) = floor(range(a, b + 1))`
(inclusive both ends, one draw); `chance(p) = next() < p` (one); `pick(arr) = arr[floor(next() ·
length)]` (one); `weighted(items, w)`: total of `max(0, w)`, then one draw `r = next()·total`,
subtracting each weight in order and returning the first item where `r ≤ 0` (else the last);
`gauss()`: Box–Muller, `u = max(1e-12, next())`, `v = next()`, `sqrt(−2 ln u)·cos(2πv)` (two);
`shuffle(arr)`: in-place Fisher–Yates from the end, `j = floor(next()·(i + 1))` for `i = n−1 … 1`
(n − 1 draws).

**`hashSeed(x)`**: FNV-1a over `String(x)`'s UTF-16 code units: `h = 2166136261`; for each
code unit `h ^= c; h = Math.imul(h, 16777619)`; return `h >>> 0`.

**Streams.**

| Stream | Seed | Used for |
|---|---|---|
| Generation | `new Rng(settings.seed)` (the `Builder`'s) | Everything in `generateWorld`, in one fixed order (A.4). |
| Outer worlds | `new Rng(hashSeed(\`${seed}:${systemId}:outer\`))`, one per system | The cold outer worlds added after generation. |
| Simulation | `state.rng = hashSeed(settings.seed · 7 + 13)`, kept in the state | Every random draw of play. |
| Hashes, no stream | `hashSeed` of a string | A body's water (`(body.seed % 1000) / 1000`), when a dead star formed (`formedAt`, section B). |
| Rendering only | e.g. `hashSeed(seed · 3 + 1)` for the sky, per-object hashes in the system view | Decoration; never touches the state. |

**`withRng(state, fn)`** (`sim/util.ts`) builds `new Rng(state.rng)`, runs `fn(rng)`, and writes
`rng.s` back into `state.rng`. Every random draw of the simulation goes through it (`turn.ts`,
`crossing.ts`, `events.ts`, `fleets.ts`, `hunger.ts`, `survivors.ts`, `society.ts`, `minds.ts`;
event `bind` and choice `run` functions receive the `rng` of the `withRng` that called them).
So a saved game replays identically: a save code, or a deep clone, plays on exactly as the
original (`tools/checks/unit/determinism.ts`). `Math.random` is used only by the interface (a
new seed, slot ids), never by the simulation.

**The fixed-order rule.** Generation must consume its RNG exactly as before, or every seed's
galaxy changes. Consequences the code is built around, and a copy must reproduce:
- Every draw listed in A.4 happens in that order, including draws whose results are then
  thrown away (the home system's generated bodies, a catalogue suffix a name format ignores,
  the birth-time draw of a new star that now lights at the end of its turn).
- Short-circuit evaluation counts: `kind === 'red_dwarf' || rng.chance(0.25)` draws only for
  other kinds. JavaScript evaluates arguments and template literals left to right; follow that.
- Later additions use streams of their own (outer worlds), hashes (water, formation times), or
  deterministic passes after generation (`frozenFromTheStart`, `waterFromTheStart`,
  `scorchedFromTheStart`), precisely so the original draws stay where they were.
- Choices made "from the shuffled order" (the survivors' reaches, the Hunger's first nest) pick
  from an order already drawn, without new draws.
- Choosing the fate of matter at setup skips its one draw (A.4, step 18), so a seed played with
  a chosen fate puts its Hunger nests elsewhere than the same seed with the fate Unknown; the
  stars, worlds and survivors are the same.

### A.4 A new game and the galaxy (`newGame.ts`, `gen.ts`, `names.ts`)

**Settings and defaults** (`DEFAULT_SETTINGS`): `seed` 20260927, `survivors` 3, `length`
`'standard'`, `difficulty` `'standard'`, `protonFate` `'unknown'`, `civName` "The Kin of Aster",
`homeName` "Aster". The setup screen starts with a random seed `floor(Math.random()·1e9)` and
accepts any non-negative integer. `newGame(partial)` merges, passes `civName` through
`savableName` (the strings `"__inf"` and `"__-inf"` lose their first character, as the save
format uses them), then: `generateWorld`, `frozenFromTheStart`, `waterFromTheStart`,
`scorchedFromTheStart` (deterministic, section B), the first settlement and fleets (below),
the first log line, `updateForecasts`, and `saveVersion = SAVE_VERSION`.

**Coordinates.** Each region has a display centre `pos` and a physical centre `phys = pos ×
scale` (100 ly per display unit; 700 for the two outliers). Positions of systems inside a
region are drawn in light-years and added to both, so within a reach one display unit is one
light-year while the reaches themselves are spread 100 times thinner on the map. Travel and
light-speed delays always use `phys`. `randomInSphere(rng, r, flatten)`: draw x, y, z each
`range(−1, 1)` until `x² + y² + z² ≤ 1` (three draws per try), return `(x·r, y·r·flatten, z·r)`.
`dirFromAngles(θ, φ) = (cos θ cos φ, sin φ, sin θ cos φ)`.

**Generation, in exact draw order** (`generateWorld`):

1. `rng = new Rng(settings.seed)`. Province `p_core` "The Heart" (display radius 160) at the origin.
2. `baseTheta = range(0, 2π)`.
3. Three ancestral provinces, i = 0, 1, 2: `θ = baseTheta + i·2π/3 + range(−0.35, 0.35)`;
   `dist = [420, 520, 610][i] + range(−40, 40)`; `pos = dirFromAngles(θ, range(−0.18, 0.18))
   × dist`; name `The ${properName(rng, 2)} Remnant`; display radius `230 − 30i`. Each has a
   fixed line of lore.
4. Two streams, i = 0, 1: `θ = baseTheta + π/3 + iπ + range(−0.3, 0.3)`; `pos = dirFromAngles(θ,
   range(−0.3, 0.3)) × range(760, 860)`; name `The ${properName(rng, 2)} Stream`; radius 140.
5. Provinces `p_halo` (radius 1050) and `p_void` (4000), at the origin, no draws.
6. The core region "The Heart" (kind `core`, radius 55 ly), filled with 7 systems (`fillRegion`,
   weights `CORE`, flatten 0.8); then the Heart itself, `addSystem(coreRegion, origin, 'smbh',
   'core')`, named "The Heart".
7. Reaches of the ancestral provinces: 3, 3 and 2. For each: `off = randomInSphere(rng,
   radius·0.8, 0.35)`; name `${properName(rng, 2)} ${pick(['Reach', 'Drift', 'Shoal', 'Hollow',
   'Verge', 'Mere', 'Strand'])}`; centre `province.pos + off`; radius `range(36, 48)` ly; kind
   `reach`; then `fillRegion(r, int(10, 13), REACH, 0.55)`.
8. One reach per stream, named after the stream without "The ", at its centre, radius 44:
   `fillRegion(r, int(7, 9), REACH with white_dwarf 45 and brown_dwarf 25, 0.3)`.
9. Two globular clusters in the halo, i = 0, 1: `pos = dirFromAngles(range(0, 2π), range(0.45,
   0.9)·(i = 0 ? 1 : −1)) × range(820, 980)`; name `Cluster ${pick(['Ossa', 'Keth', 'Umber',
   'Lanthe', 'Mora', 'Sill'])}` (the two can share a name); radius 22; `fillRegion(r, int(6, 8),
   GLOBULAR, 1)`; then with `chance(0.8)` an intermediate-mass black hole at its centre:
   `addSystem(r, origin, 'black_hole')`, then mass `10^range(3, 3.8)`, spin = spinMax = 3000,
   `evaporateAt` from the new mass, named `<cluster name without "Cluster "> Well`.
10. The Runaway (void, kind `outlier`, 700 ly per unit): centre `dirFromAngles(range(0, 2π),
    range(−0.3, 0.3)) × 2600` (about 1.8 Mly), radius 18, three systems with weights red 40,
    white 40, brown 20, flatten 1, each `special: 'outlier'`.
11. The Wanderer: centre `dirFromAngles(range(0, 2π), range(−0.6, 0.6)) × 3300` (about 2.3 Mly),
    radius 6; one black hole at its centre, special `outlier`, then mass 2.2 × 10⁵ M☉, spin =
    spinMax = 9000, `evaporateAt` recomputed, named "The Wanderer".
12. The home reach: of the reaches in ancestral provinces (not the streams), the one farthest
    from the centre in the display x–z plane (`hypot(pos.x, pos.z)`).
13. Four more systems there, i = 0..3: `addSystem(homeReach, randomInSphere(rng, radius, 0.5),
    i < 3 ? 'red_dwarf' : 'brown_dwarf')` (no spacing check).
14. The home system: `addSystem(homeReach, origin, 'red_dwarf', 'home')` (all its draws made),
    then every body it generated is deleted, and it is renamed `properName(rng, 2)`. Its primary
    is replaced: red dwarf, mass 0.1, lum 1.0, `blueAt` 9.94 × 10¹³, `whiteAt` `blueAt` + 4 × 10⁹,
    `flarePeak(0.1)`, no spin. Its fixed worlds follow (below).
15. Survivors: `otherReaches` = every reach but the home's (ancestral and stream reaches;
    clusters are not reaches), shuffled; then `picks = shuffle(copy of the five survivor
    records).slice(0, clamp(settings.survivors, 0, 4))`. Both shuffles happen whatever the
    count. Placement below.
16. The sleeper vault: in the last reach of the shuffled `otherReaches`, at
    `randomInSphere(rng, radius·0.6, 0.5)`, a white dwarf with special `sleeper`; the relic
    `{kind: 'sleepers', state: 'hidden'}` goes on its last body (the Deep itself if the dwarf has
    no worlds); then the system is renamed `properName(rng, 3)`.
17. `makeCiv` (A.2 start values).
18. The fate of matter: `'decays'` → decay, `'stable'` → stable, `'curvature'` → curvature,
    else `drawFate(rng.next())`: `u < 0.5` decay, `u < 0.75` curvature, else stable. Only the
    Unknown setting draws.
19. The state is assembled: `rng = hashSeed(seed·7 + 13)`, turn 1, era `dusk`, eraTurn 0,
    years 9 × 10¹³, `eta = log10(9e13) ≈ 13.954`, `turnLength` 40, `protonsDecay`, `fate`, `gfe`
    1, the stranger minds' records (sealed), everything else empty, `nextId` 1.
20. Hunger nests (section D): candidates are the systems, in insertion order, whose region is a
    reach or a globular cluster other than the home reach and that have no `special`; shuffled.
    Count: gentle 1, standard 2, harsh 3. If any candidate lies in one of the two reaches
    nearest home, the first such is moved to the front. Nest i is swarm `hg<i>` at that system,
    size 2 + i, asleep, untamed, appetite 1, and the system's `rust` is 0.15.
21. `addOuterWorlds` (own streams; below).
22. Knowledge: every system in the home reach is known at 1, the home system at 2, the Heart at 1.

**`fillRegion(region, count, weights, flatten)`**: up to `count × 40` tries; each tries
`local = randomInSphere(rng, radiusLy, flatten)`, rejects it if within `0.22 × radiusLy` (3D) of
one already placed, else `addSystem(region, local, pickKind(rng, weights))`. `pickKind` is
`weighted` over the weight object's entries in key order. Weights:

| Table | Key order and weights |
|---|---|
| `REACH` | red_dwarf 26, white_dwarf 32, brown_dwarf 22, neutron_star 7, black_hole 5, blue_dwarf 2, rogue 6 |
| stream | the same keys: red 26, white 45, brown 25, neutron 7, black hole 5, blue 2, rogue 6 |
| `GLOBULAR` | white_dwarf 50, neutron_star 24, black_hole 8, brown_dwarf 12, red_dwarf 6 |
| `CORE` | neutron_star 30, black_hole 28, white_dwarf 30, red_dwarf 12 |

**`addSystem(region, local, kind, special?)`**: `primary = makePrimary(rng, kind)`; named if
the kind is red, blue or smbh, else if `chance(0.25)`; name "The Heart" for smbh, else
`properName(rng)` if named, else `catalogueName(rng, kind)`; id `s…`; `seed =
hashSeed(name + n)` (n the id counter after this id); position `region.pos + local`, `phys =
region.phys + local`. Then its Deep (`addBody(sys, 'deep', 0, 0, 0)`), then
`bodyTemplates(rng, primary)` sorted by `aAU`, each `addBody(sys, kind, aAU, mass, i)` with
i = 0, 1, ….

**`makePrimary`** (draws in this order):

| Kind | Mass (M☉) | Other |
|---|---|---|
| red_dwarf | `range(0.08, 0.13)` | `lum = 0.75 + (m − 0.08)·8 + range(−0.08, 0.08)`; `blueAt = 9e13 + 10^range(8, 12.97)`; `whiteAt = blueAt + range(2e9, 6e9)`; `flarePeak(m)` |
| blue_dwarf | `range(0.1, 0.16)` | lum 1; `blueAt = 9e13 − 1e9` (already flaring); `whiteAt = 9e13 + 10^range(6, 9.4)`; `flarePeak(m)` |
| white_dwarf | `range(0.45, 0.9)` | lum 0.02; `halo = chance(0.6)` |
| brown_dwarf | `range(0.03, 0.075)` | lum 0.02 |
| neutron_star | `range(1.2, 2.1)` | lum 0.08; spin = spinMax = `range(80, 220)` |
| black_hole | `range(4, 28)` | `a = range(0.2, 0.99)`; spin = spinMax = `round(420·a·√(m/10))`; `evaporateAt = 2.1e67·m³` |
| smbh | 3 × 10⁸ | spin = spinMax = 40,000; `evaporateAt = 2.1e67·m³` (≈ 5.7 × 10⁹², grows later) |
| rogue | 0 | lum 0 |

`flarePeak(m)`: `m' = clamp(m, 0.08, 0.16)`; `blueK` piecewise-linear through (0.08, 4600),
(0.10, 5800), (0.14, 8600), (0.16, 7400), held flat beyond; the red dwarf it was: `redL =
0.23·m'^2.3`, `redK = 2700 + (m' − 0.08)·6000`, `redR = √redL / (redK/5772)²`; radius `r = redR ×`
piecewise (0.13, 0.7), (0.14, 1.0), (0.16, 1.63); `blueLum = r²·(blueK/5772)⁴`. These are the
life dates of the starting stars: each red dwarf leaves the main sequence 10⁸ to 9.3 × 10¹²
years after the start (log-uniform), so every one before the Last Light at 10¹⁴, and collapses
2 to 6 billion years later; a blue dwarf collapses 10⁶ to 2.5 × 10⁹ years after the start. When
an old white or brown dwarf formed is a hash (`formedAt`, section B); new stars get
`bornAt`/`diesAt` when they light in play (section B).

**`bodyTemplates(rng, primary)`** (a = semi-major axis in AU):

| Primary | Worlds |
|---|---|
| red, blue dwarf | `n = int(2, 5)`; `a = range(0.012, 0.025)`; for each: `inHz = 0.025 < a < 0.09`; `r = next()`; if `inHz && r < 0.45`: `chance(0.8)` ? eyeball : terran; else r < 0.25 barren; < 0.45 super_earth; < 0.62 (a > 0.06 ? ice : barren); < 0.74 asteroids; < 0.86 (a > 0.05 ? ocean_ice : barren); else (a > 0.08 && `chance(0.4)`) ? gas_giant : ice. Mass `massFor`. Then `a *= range(1.4, 2.1)`. |
| white dwarf | `n = int(0, 3)`; each: `close = chance(0.12)`; `a = close ? range(0.01, 0.03) : range(1.2, 12)`; kind `pick` of [barren, gas_giant, super_earth] if close, else [barren, ice_giant, ice, asteroids, gas_giant]; `massFor`. |
| brown dwarf | `n = int(0, 3)`; `a = range(0.004, 0.01)`; each: `pick([barren, ice, ocean_ice])`, mass `massFor × 0.3`, then `a *= range(1.5, 2.2)`. |
| neutron star | `n = int(0, 2)`; each barren, `a = range(0.2, 1.2)`, mass `range(0.02, 4)`. |
| black hole | `chance(0.3)`: one world, `pick([barren, ice])`, `a = range(2, 20)`, mass `range(0.1, 3)`. |
| rogue | `n = int(1, 3)`; `pick([ice, ocean_ice, barren])`, `a = 0`, mass `range(0.1, 5)`. |
| smbh, others | none. |

`massFor`: gas_giant `range(60, 400)`; ice_giant `range(10, 20)`; super_earth `range(2, 7)`;
eyeball, terran `range(0.6, 1.6)`; asteroids 0.001 (no draw); ocean_ice, ice `range(0.1, 1.2)`;
barren `range(0.05, 1.2)`.

**`addBody(sys, kind, aAU, massEarth, index, rng)`**, in this order: (1) `bodyStats(rng, kind)`;
(2) id `b…`; (3) display orbit: Deep 0, else `16 + index·range(8, 11) + (gas_giant ? 4 : 0)`;
(4) `phase = range(0, 2π)` (the Deep too); (5) `seed = hashSeed(sys.name + kind + index + n)`
(string concatenation); `size` by `displaySize`; `water = defaultWater(kind, (seed % 1000) /
1000)`; (6) for a non-Deep world of a primary that is not rogue with `aAU > 0`: `inspiralAt =
9e13 + inspiralTime(aAU, mass, max(0.1, M))`, and the trait `tidally_locked` if `aAU < 0.08` and
not a gas giant; (7) for a non-Deep, non-gas-giant world: `chance(0.11)` of a hidden relic,
kind `weighted` over archive 1, engine 1, tomb 1, ghosts 1, sleepers 0.6; (8) ocean_ice gets
`subsurface_ocean`. Bodies are named `${sys.name} ${ROMAN[index]}` (I…XII, then numbers), the
Deep `${sys.name} Deep`. Renaming a system later (the home, the vault, the black-hole wells)
does not rename the bodies already made.

`inspiralTime(a, m, M) = 3e19 · (a/0.1)⁴ · (1/max(0.01, m)) · (0.6/max(0.05, M))²` years.
`displaySize`: gas giant `3.4 + min(1.4, m/300)`; ice giant 2.7; asteroids 0.6; Deep 0; else
`0.9 + ∛m · 0.85`.

**`bodyStats`** (draws in the order of the columns that have ranges; `water` starts 0):

| Kind | habitability | vitality | decline | coreHeat | richness | hydrogen |
|---|---|---|---|---|---|---|
| eyeball | 0.5–0.8 | 0.15–0.45 | 0.002 | 0.05–0.25 | 0.7–1.1 | 0 |
| terran | 0.5–0.75 | 0.1–0.35 | 0.002 | 0.05–0.2 | 0.8–1.2 | 0 |
| super_earth | 0.2–0.45 | 0.05–0.25 | 0.0015 | 0.15–0.4 | 1.1–1.5 | 0 |
| ocean_ice | 0.15 | 0.05–0.15 | 0 | 0.05–0.2 | 0.5–0.8 | 0 |
| ice | 0.05 | 0 | 0 | 0 | 0.5–0.9 | 0 |
| barren | 0 | 0 | 0 | 0 | 1.0–1.7 | 0 |
| asteroids | 0 | 0 | 0 | 0 | 1.8–2.6 | 0 |
| gas_giant | 0 | 0 | 0 | 0 | 0.3 | 1.6–2.4 |
| ice_giant | 0 | 0 | 0 | 0 | 0.5 | 0.9–1.4 |
| deep | 0 | 0 | 0 | 0 | 0 | 0 |

`defaultWater(kind, u)`: eyeball `0.25 + 0.3u`; terran `0.3 + 0.45u`; super_earth `0.05 +
0.35u`; ocean_ice `0.95 + 0.05u`; ice `0.3 + 0.4u`; asteroids `0.02 + 0.08u`; barren `0.01u`;
others 0.

**The home system** (after its generated worlds are discarded, in this order): its Deep;
inner barren world (0.014 AU, 0.4 M⊕, index 0, richness set to 1.6); the homeworld, an eyeball
at 0.031 AU, 1.0 M⊕, index 1, named `homeName`, with habitability 0.85, vitality 1.0, decline
0.012, coreHeat 0.8, richness 1.0, water 0.42, no relic, traits `homeworld`, `tidally_locked`,
`failing_dynamo`, size 2.0; an ocean_ice world (0.058 AU, 0.3 M⊕, index 2, traits
`tidally_locked`, `subsurface_ocean`, vitality 0.12); an asteroid belt (0.1 AU, index 3,
richness 2.2); a super-Earth (0.17 AU, 3.2 M⊕, index 4) holding a hidden tomb. Each still draws
its stats, orbit, phase and relic chance through `addBody` before being overridden. The home
system is exempt from `waterFromTheStart`, and only the homeworld from `frozenFromTheStart`: in
practice the cold super-Earth starts frozen, as an ice world.

**Fellow survivors' placement.** The five records (`name`, `adjective`, `way`, `color`): The
Vaelun Hold (Vaelun, garden, #d9a066), The Serein Archive (Serein, upload, #7fb6d9), The Hollow
Choir (Choir, chorus, #c38fd9), The Long Sleepers of Ost (Ostian, dormant, #8fd9b4), The
Tessellate (Tessellate, lattice, #d9d27f). At most four take part (setup offers 0 to 4). The
i-th pick's reach: `near` = the 2 reaches nearest home (by `phys` distance between centres) for
i = 0, the 5 nearest for i = 1, all for i ≥ 2; take the first reach in the shuffled
`otherReaches` that is in `near` and not taken, else the first not taken, else
`otherReaches[i % length]`. Its system: `addSystem(reach, randomInSphere(rng, radius·0.4, 0.5),
way === 'lattice' ? 'brown_dwarf' : 'red_dwarf', 'survivor')`. Its record: id `sv<i>`, `systems:
[home]`, `pop = range(18, 30)`, `health = range(0.75, 0.95)`, reserve 40, `disposition =
range(−10, 25)`, `clock` 6 (dormant), 3 (upload) or 1.7, no contact, alive, `aidGiven` 0,
`lastSent` 0. The sixth way, `fork`, appears only in play (section C/D).

**Outer worlds** (`addOuterWorlds`, after everything else): for each system in insertion order
that has no `special` and is a red, blue or brown dwarf, with its own stream: brown dwarfs
`chance(1/8)`, red and blue `chance(1/3)`; count 1 for a brown dwarf, else `int(1, 3)`; the first
semi-major axis `exp(range(ln 0.3, ln(brown ? 3 : 2)))`; `orbit` starts at the largest display
orbit among the system's worlds (at least 16); while `i < n` and `a ≤ 8`: `r = next()`; kind
(brown: r < 0.65 ice, < 0.85 ice_giant, else gas_giant; red/blue: r < 0.45 ice, < 0.8
ice_giant, < 0.9 asteroids, else gas_giant); mass (ice `range(0.3, 5)`, ice giant `range(8,
25)`, gas giant `range(60, 300)`, belt 0.001); `addBody(…, index, thisRng)` (the shared id
counter; index continues after the system's worlds); then `orbit += (i = 0 ? 16 :
range(9, 12))`, display orbit `orbit + (gas giant ? 4 : 0)`, trait `outer`; `a *= range(1.7,
3.2)`.

**The start of play** (`newGame`, after generation): the homeworld's colony (`createColony`,
8 Kin, named after the world, structures `solar_array 1, geothermal_tap 1, mine 2,
archive_spire 1, shipyard 1, commons 1`) becomes the capital; fleets "Pathfinder" (one probe),
"Lamplighter" (one probe) and "Vigil" (one warden, order `hold`) at home; the log line
`${civName}. ${world}, the last living world of ${star}. The long dusk begins.` (kind `era`).
For scale (four seeds sampled: 20260927, 1000, 7, 24757): 145 to 148 systems in 15 regions,
300 to 333 worlds besides the Deeps, 16 to 18 systems known at the start, the Heart 58,600 to
71,200 ly from home; the first survivor 9,000 to 34,000 ly away.

**Names** (`names.ts`). `properName(rng, syllables = int(2, 3))` (the default draw is made
only when no count is given): for each syllable, an onset (always for the first, else with
`chance(0.7)`) from `ONSETS` = v, th, s, m, r, l, k, n, c, d, h, or, al, es, y, qu, tr, sil, mer,
cal, ish, an, ul, ev; a nucleus from `NUCLEI` = a, e, i, o, u, ae, ei, ia, ou, y, io; on the last
syllable a coda from `CODAS` = "", "", n, l, r, s, th, m, x, nd, rn, sh, l, n. If shorter than 5
letters, add one of `ENDINGS` = "", "", "", a, on, is, el, ar, ine, eth, ys, um, orr, wyn, ai.
Any letter tripled becomes doubled; cut to 11 characters; capitalise. `catalogueName(rng,
kind)`: `n = int(100, 9999)`; suffix `chance(0.4)` ? `-` + one of a–f (`int(0, 5)`) : none;
white dwarf `WD n<suffix>`; brown dwarf `BD <int(10, 99)>·n`; neutron star `PSR <int(1000,
2359)><chance(0.5) ? + : −><int(10, 89)>`; black hole `BH n`; rogue `Drift n`; others `Cat n`.
The suffix is drawn for every kind.

### A.5 Time

**η.** `eta(years) = log10(max(1, years))`, the cosmological decade. `state.eta` is
canonical: outside the Dark Era it is always `eta(state.years)`; in the Dark Era the calendar
steps η itself and `years` becomes `Infinity` once η reaches 300. Displays: `formatEta` shows
4 decimals in the Dusk, 2 in the Degenerate Age, 1 after, and `10^x` (x = log10 η, 2 decimals)
from η 10⁴; `formatYears` gives whole years below 10⁴, years rounded to hundreds below 10⁶,
then millions, billions and trillions (one decimal), then `10^η years` (η to one decimal), and
`10^(10^x) years` once the years are infinite.

**The ages** (`eras.ts: ERAS`):

| Age (`id`) | Starts at (years) | Ends | First Tide turn `l0` | Growth: brief / standard / vast |
|---|---|---|---|---|
| I. The Long Dusk (`dusk`) | 9 × 10¹³ (the game's start) | η ≥ 14 | 40 years | 1.38 / 1.27 / 1.2 |
| II. The Degenerate Age (`degenerate`) | 10¹⁵ | η ≥ `DEGENERATE_END[fate]` (A.5 below) | 10⁹ years | 4.47 / 2.82 / 2.14 |
| III. The Black Hole Age (`blackhole`) | 10⁴⁰ | η ≥ 100, or the last black hole gone | 2 × 10³⁹ years | 31.6 / 12.6 / 6.3 |
| IV. The Dark Era (`dark`) | 10¹⁰⁰ | log10 η ≥ 122 | (none) | 0.005 / 0.0029 / 0.0018 (λ growth) |

Each also has a numeral, its science name (Late Stelliferous, Degenerate, Black Hole, Dark
Era), accent colours and an intro text (`ageIntro` varies the Black Hole Age's by fate, and the
Dark's when matter is stable).

**The Tide** (`tideLength`): the natural turn length, `L = l0 + (g − 1)·(years −
startYears)`. Since each turn adds L, the elapsed time `e` follows `e' = g·e + l0`: in an age
begun at its start, turn n (counting from 0) lasts `l0·gⁿ`, and time advances geometrically. From the formulas, the
turns each age lasts at the Tide (pace 0, no clocks), as `estimateEraTurns` counts them:

| Length | Dusk (to η 14) | Degenerate to η 39 | Degenerate to η 30 | Black Hole Tide 10⁴⁰ → η 100 (of which to η 68) | Dark |
|---|---|---|---|---|---|
| brief | 79 | 47 | 34 | 42 (21) | 29 |
| standard | 105 | 68 | 48 | 57 (28) | 38 |
| vast | 136 | 91 | 64 | 77 (37) | 48 |

In the standard Dusk the first turns are 40, 51, 65, 82 years; η stays at 13.954 for some 80
turns and climbs only in the last twenty (the last turn is about 2.5 × 10¹² years). Real games
run longer in the Degenerate Age (the harness averages 72 turns) because of new-star clocks.

**The Dark Era's calendar** steps the exponent of the exponent. With `λ = log10(max(η, 100))`
and `a` the age's growth for the length: `k = √(ln(max(λ, 2)/2) / a)`, `g = exp(a·(2k + 1))`,
`λ' = min(122.5, λ · g^clamp(10^−pace, 0.5, 2))`, `η' = 10^λ'`, `years' = η' < 300 ? 10^η' :
Infinity`. At the Tide this makes `λ = 2·exp(a·n²)` after n turns from λ = 2 (η 100), so the Dark
Era ends (λ 122) after about 38 standard turns. Its turn length is `years' − years` while both
are finite, else Infinity; `logTurnLength` returns `log10(max(1, L))`, or η' when L is infinite.

**Pace** (`civ.pace`, `actions.ts: setPace`, `sim/flare.ts`). An integer, the log10 factor
against the Tide: the coming turn is `Tide × 10^−pace`, so +1 is "Quick ×10" (a tenth as long)
and −1 "Slow ×10". Labels: Quick ×1000 (+3, granted by nothing), Quick ×100, Quick ×10, Tide,
Slow ×10, Slow ×100, Slow ×1000. Limits (`mods.ts: computeMods`): −1..+1 by default; the tech
Hibernation Protocols sets the floor to −2 (and allows the Long Sleep), Quickening the ceiling
to +2; the event choice that sets `civ.flags.stillness` lowers the floor one more step, never
below −3. `endTurn` clamps the pace into the limits before anything else. A crossing resets it
to 0. In the Dark Era pace only bends the exponent, between `g^0.5` and `g^2`, so paces beyond
±1 change nothing there.

**What a turn is worth** (`livedShare`, passed to the economy as `paceFactor`). Yields and
upkeep scale by the share of a Tide turn that the turn lives: `10^−pace`, except (in this order)
`1/split` on a new-star clock's turn (below); `10^−pace` outside the Dusk's calendar or for an
infinite turn; 1 on a flare clock's turn; and `min(10^−pace, 1)` for a turn cut short by a
flare's start. Tempo strain (section C) reads `log10(paceFactor)` as the orders of magnitude we
slowed below the Tide.

**Greyed paces** (`paceMatters`): a pace other than the Tide is offered only if its coming turn
(length and η, as `turnStep` gives it) differs from that of the next pace toward the Tide, by
more than a relative 10⁻⁹. `setPace` itself allows any pace in range.

**Dormancy and the Long Sleep.** `setDormant(true/false)` (waking also clears `sleepTurns`).
`longSleep(n)` needs Hibernation Protocols and sets `sleepTurns = clamp(round(n), 1, 20)` and
dormant; the interface offers ×5 and ends a turn at once. At the start of each turn, while
`sleepTurns > 0`: dormant, `sleepTurns − 1`; reaching 0: awake, `wakeBonus` = 2 with the
charter The Long Watch, else 1, and the log says "We wake." So ×5 is four dormant turns and a
fifth awake at +30% output (`wakeBonus > 0`; it falls by one each awake turn in step 5).
Dormant turns produce nothing; upkeep falls to 0.1 (0.05 with The Long Watch, 0.3 once the Long
Flow has come; section C).

**The age against the calendar** (`fate.ts`). Two clocks share the name "era":
- `state.era`, the age the player sees: its intro, music, art, event pools, and what belongs to
  it.
- `calendarEra(state)`, whose Tide sets the turns and whose fixed-date physics applies (galactic
  evaporation, embers fading, black holes evaporating, detection range). It equals `state.era`
  in the Dusk, in the Dark, and always when protons decay; otherwise, in the Degenerate and
  Black Hole Ages, it is `'degenerate'` while `years < 10⁴⁰` and `'blackhole'` from then on.
- `ageReached(state, era)` and `inAge(state, eras)` accept either clock, so what belongs to an
  age opens when either gets there.
- `DEGENERATE_END = {decay: 39, stable: 30, curvature: 68}`; `MATTER_END = {decay: 39, stable:
  ∞, curvature: 89.5}`; `FATE_SHOWN_AT = 30`. `ageOver`: the Dark when log10 η ≥ 122; the
  Degenerate Age when η ≥ `DEGENERATE_END[fate]`; the others at their `endEta`.
- `calendarTurnDue`: fate not decay, age Degenerate or Black Hole, `years < 10⁴⁰` and η ≥ 39.
  Then `calendarTurn` sets years to 10⁴⁰, η to 40 and the turn length to the Black Hole Tide
  there, while the age stays what it is. So under stable matter the Black Hole Age begins at
  η 30 on the Degenerate Tide and jumps to 10⁴⁰ at η 39; under curvature the Degenerate Age
  runs on, from η 40 to 68, on the Black Hole Tide.
- `fateKnown`: chosen at setup, the tech The Proton Question, `civ.flags.fate_known`, or the
  age past the Degenerate. Until then nothing in play may differ by fate (a check plays three
  blind games of one seed to η 29 and requires them identical but for the fate): warmth
  readings, forecasts and the chronometer (which hatches η 30–68) stay neutral, and the
  autoplayer plans for decay. `matterGone`: `civ.flags.matter_gone`, or decay with the calendar
  past the Degenerate Age.

**What starts each age.** The game starts in the Dusk. Each crossing (`sim/crossing.ts:
runCrossing`, after its own losses and changes, described with the ages) sets `era` to the next, `eraTurn` 0, pace 0, wakes the civilization (`dormant` false,
`sleepTurns` 0), logs "<Age> begins.", and sets the years: to the new age's `startYears` (the
Last Light jumps from just past 10¹⁴ to 10¹⁵; the Great Decay to 10⁴⁰; the Last Horizon to
10¹⁰⁰), except that leaving the Degenerate Age under a fate other than decay keeps the years.
η follows, and the turn length is the new calendar's Tide there (Infinity in the Dark). The
Degenerate Age begins at η 14; the Black Hole Age at η 39 (decay), 30 (stable) or 68
(curvature); the Dark Era at η 100, or earlier the turn the last black hole (or the Heart) is
gone.

**Turn length per turn** (`flare.ts: turnStep(state, pace)`). Start from `stepTime(calendarEra,
years, eta, pace, length)`. Then:
1. If a new-star clock runs (its calendar Degenerate or Black Hole, the step finite) and
   `left = starTurnsLeft ≥ 1`: the turn ends at `star_until` if `left = 1`, else at `star_until −
   (star_step/split)·(left − 1)`, whatever the pace.
2. Otherwise outside the Dusk's calendar, or for an infinite step: the plain step.
3. In the Dusk: while a flare clock runs, the end is `min(step end, years + flare_step)`, and
   exactly `flare_until` on the last of its turns (within a millionth of a step). Then, if any
   settled red dwarf's `blueAt` falls in `(years, end]`, the turn stops at the earliest such
   `blueAt`: a slower pace cannot carry past a settled star's last flare.

`stepTurns`, `turnsUntilYears` and `turnsUntilAll` simulate turns this way on a copy of the
flags (assuming a flare is let pass), for forecasts and travel estimates; `eras.ts: turnsUntil`
counts at the plain Tide (400 turns at most).

**The flare clock** (`FLARE_TURNS` 6). When a settled star's turn stops at its `blueAt`, the
event "The Last Flare" offers to keep time with it only when the flare would last fewer than
three turns at our pace (`span < next × 3`). `keepTimeWithFlare`: `flare_until = whiteAt`,
`flare_step = (whiteAt − years)/6`; six turns, each lived in full (`livedShare` 1). The flags
are deleted once `years ≥ flare_until`. The home star flares at 9.94 × 10¹³ years for 4 × 10⁹
years, very near the end of the Dusk.

**New-star clocks** (`STAR_TURNS` 6, `STAR_FREE` 2, `STAR_ORDER_COST` 250, `STAR_FOLLOW_MIN`
250, `STAR_SPLIT` 10, `STAR_STEP_MIN` 10⁻¹³). Collision stars, helium stars and helium giants
light as their turn ends and may burn for less than a turn (section B). Keeping time with one
(choice 0 of A New Star, White Fire and A Helium Giant) gives its remaining life in six turns,
each lived in full. `starClockTerms(state, sys)`:
- Needs a new star that is not gone, the calendar Degenerate (one special star also in the
  Black Hole calendar: sealed), and `diesAt > years`.
- While a clock runs: the same star → `why 'this'`; a follow-on already waiting → `'waiting'`;
  a star dying before `star_until` → `'inside'`; else it can follow on, from `star_until`.
- `left = diesAt − from`; `next` = our turn at our own pace starting at `from`; `orders =
  log10(next/left)`; price `ceil(250·max(0, orders − 2))`: free within a hundredfold; a
  follow-on never below 250; always at most `floor(reserveCapacity)`. A pact partner that lives
  at that star (alive, not at war, any pact) halves it (`ceil(cost/2)`).
- Too brief for six countable turns (`left/6 < from·10⁻¹³`): with a clock running, impossible
  (`brief`); with `left ≥ next`, unneeded; otherwise a **flash**: one turn ending at `diesAt`,
  or at `from·(1 + 10⁻¹³)` if that is later, priced by its orders the same way.
- Not brief: unneeded if `left ≥ 6·next` (our own pace already gives six turns).

`keepTimeWithStar` pays the price, then: a follow-on sets `star_next = diesAt`; a flash sets
`star_until` to its end, `star_step` to its length and `star_flash = diesAt`; otherwise
`star_until = diesAt`, `star_step = (diesAt − years)/6`. `starTurnsLeft = max(1,
ceil((star_until − years)/(star_step/split) − 10⁻⁶))` while `star_until − years > star_step·10⁻⁶`.
**Quick ×10 during a clock:** with Quickening, at pace ≥ 1, not a flash, and if a tenth of
the step is still at least `years·10⁻¹³`, each clock turn splits into ten (`split` 10), each
lived as a tenth. `clearStarClock` (end of each turn): once the clock has run out it deletes the
four flags and, if `star_next` is still ahead and the calendar allows, starts the follow-on with
`star_step = (star_next − years)/6`. `starGoneEarly` ends a clock whose star is unmade early.
The autoplayer keeps time with a new star whenever the price is zero or leaves at least half
its full store (`auto.ts: clockTooDear`).

**Other clocks.** The halo's own clock: while Halo Siphons run (judged as the turn begins),
`drainHalo` makes the halo fall twice as fast, so the embers go out sooner than η 25 (section
B). The Long Flow (`flow.ts`, `FLOW_ETA` 65): where matter lasts (stable, or curvature before
η 89.5), from the turn that ends at η ≥ 65 every settlement no one awake keeps loses one
structure a turn (cheapest first, Cryo Halls last, leptonic ones never), and unexcavated relics
flow away; "keeping" depends on each mind's clock against the turn's length (section C).

**Milestones.** The chronometer's labelled marks (`eras.ts: milestonesFor(fate or null while
unknown)`, `deepMilestonesFor` on log10 η in the Dark) are display only: every fate η 14, 15,
19.5, 21, 25 (sooner with Halo Siphons), 69, 85, 99; decay adds 37.5, 39, 85, 141; stable 30,
65; curvature 65, 68, 82, 85, 87, 89.5, 141; unknown shows questions at 30, 37, 65, 68, 89.5;
deep time log10 141 (not if stable), log10 161, log10 1500, 26 and 76 (stable or unknown), 122.
One has a rule: at `POSITRONIUM_ETA` 85, in the Black Hole Age and for a fate other than
stable, a once-only event is queued (A.6, step 8).

### A.6 The turn pipeline (`sim/turn.ts: endTurn`)

`endTurn(state)` returns `TurnResult {crossing, outcome, arrived, notes, wasted}`. If
`state.outcome` is set it returns at once. The exact order:

**0. Set-up.** `mods = computeMods(state)`; clamp `civ.pace`; `siphoning = siphonsRunning(state)`
(fixed for the turn). Long Sleep (A.5). `step = turnStep(state)`; `logL = logTurnLength(step)`;
`ctx = {years, L: step.turnLength, logL, paceFactor: livedShare(state, pace, step), mods}`.

**1. Economy.** `matterAvail = civ.matter`. For each colony in order: `t = colonyTurn(state, c,
ctx, matterAvail)` (section C); `matterAvail −= t.matterBurn`; `c.last = t.y`; sum energy in,
energy upkeep, matter in, matter upkeep, insight, accord; `net[c] = energy − upkeep`; the
system's spin `−= t.spinDraw` (floor 0); depletion `richness −= d·0.0006` (floor 0.05) and
`hydrogen −= d·0.0004` (floor 0); overdrive: `damage +0.04` (max 1) and `gfe −0.0002`, else
`damage −0.02` (min 0); each structure with `gfeDrain` (not left behind by a rogue world): `gfe
−= gfeDrain·n·paceFactor` (floor 0.05 throughout); then `applyIndustry` (below) adds its
insight. After the loop: energy in `+= jointIncome·paceFactor`; energy out `+= researchDraw`
(0.02 per insight while researching or working on a Work); accord `−= latticeAlienation`;
`civ.energy += in − out`; `feedBeacons(state, paceFactor)` pays the decoy beacons; `civ.matter
+= in − out`; `civ.accord = clamp(accord + Δ, 0, 999)`; `cap = reserveCapacity` (stored in
`flags.reserve_cap`), energy above it is `wasted`; the four `last_*` flags. Then, with the RNG,
overdrive accidents: each overdriven colony with `damage > 0.5` and `chance(damage·0.25)` loses
one energy structure (`pick`) and halves its damage.

`applyIndustry(c, industry)`: industry (at least 0.01 if the first item is already paid) fills
the queue front first, up to 8 items a turn. A finished structure is added (its one-time
effects, `vitalityOnce`, `coreHeatBonus`, a Works' water, run only the first time unless it was
dismantled there before); a finished ship takes its `crew` from the settlement's Kin and joins
an idle fleet at that star with no standing orders made only of its class, or starts a new
fleet (settlers and survey ships always start their own). Industry left with an empty queue,
while awake, becomes the settlement's spare work (`spareYield`: matter, energy, resolve or
insight).

**2. Starvation.** If `civ.energy < 0`: it is set to 0; the (up to) three colonies with the
most negative `net` each gain a starving turn and lose one Kin (into cold sleep under the Cold
Sleep Lottery if there is room; else lost, and under Upload at Death a 50% chance it becomes an
Echo if there is room), or, with no Kin, every second starving turn one mind (Echo, else Chorus,
else Coldmind); log "The reserve is empty…". Else every colony's `starving` resets. If
`civ.matter < 0`: set to 0 and the first colony with a Lattice loses one.

**3. Research and works.** With a Work active, it takes all the insight (half if a project is
also being researched) and completes at `workCost` (log "The Great Work is complete.", `work`
null). The rest, plus `insight_bank`, goes to the current project; at its cost the overflow is
banked and `completeTech` runs. With no project, `insight_bank += research·0.5` (max 2000).
Then `discoverFromSurplus` (up to three cheapest projects from surplus insight; section C).

**4. Worlds and growth.** `scorchWorlds(years, step.years)` (flaring stars boil their worlds,
by the share of the flare this turn covers: section B); `declineWorlds` (outside the Dusk's
calendar every world's core heat ×0.8 a turn, 0 below 0.02; in the Dusk the settled homeworld's
−0.007 a turn, ×0.4 with a Core Stimulator; then seeded life, steam worlds, decline and
freezing, `worldDies`: section B);
`wakeArchivedEchoes`. Then for each colony with `capc = capacity(...)`, if awake and not
starving: Kin growth `+= 0.12·(0.5 + 0.5·vitality)` (×0.4 under Child Quotas) when `0 < kin <
cap`; Echoes `+= 0.22` when below cap (and either present or with capacity) and energy > 15;
Lattice `+= 0.35` when below cap and matter ≥ 4. For each Thread, a full point of growth is
spent (a Lattice costs 3 matter, an Echo 3 energy, paid even if there is no room) and adds one
if there is room; over capacity, one is lost (Kin into cold sleep under the Lottery if there is
room). Cold sleepers above capacity wake as Kin. A colony with nobody and no structures is
abandoned.

**5. Society.** Under Consume the Dead, `matter += popsLost·4`; `updateSociety(state, logL,
popsLost, starving)`; `coolAccord`; `wakeBonus −1` if awake.

**6. Fleets, hazards, other minds.** `advanceFleets(step.turnLength)`; `surveyWhereStationed`;
`updateDetection`; `firstSwarm`; `swarmsHunt`; `autoExplore`; `updateHunger(step.turnLength)`;
`updateSurvivors(logL, mods, step.turnLength)`; `pactsTurn`; `warTurn` (with the RNG); the
stranger minds' update (sealed, S.1.2).

**7. The universe moves on.** If `siphoning`, `drainHalo(from, step.years)`. `notes =
evolveUniverse(state, from, step.years, rng)` (section B), then `handleNotes` (below). A stranger
mind's step that may light a star as the turn ends (sealed). `theLongFlow(step.eta, logL, mods,
log10 paceFactor)`. In the Dark calendar, Continuity: `decay = 2.2 × Π continuityMult^count`
over every structure, ×0.35 if dormant, +5 if starving; `continuity = max(0, continuity −
decay)`. Then the clock moves: `years`, `eta`, `turnLength` from the step; `turn++`;
`eraTurn++`. For each settled system whose primary is now a blue dwarf with `blueAt ===
years`, queue `last_flare`. Clear the flare flags if `years ≥ flare_until`; `clearStarClock`.

`handleNotes` reacts to each note of `evolveUniverse`: `blue` and `white` (log, with a freezing
warning for our worlds that no Orbital Lamps keep warm), `collision`, `merger`, `giant` (queue A
New Star, White Fire, A Helium Giant, and mark the system known), `supernova` (destroy our
colonies there, queue the event), `burnout` (log), `rogue` (queue Unmoored if a colony's world),
`feeding`/`rekindle` (queue A World Falls for our world or the homeworld, else log), `plunge`
(evacuate, +20 energy if we live in the system), `boiled` (log, evacuate), `ejected` (queue Cast
Out if ours), `swallowed` (our colonies there that are not on rogue worlds are destroyed),
`evaporated` (Burst Catchers bank part of the burst; queue The Last Burst if ours), `faded`
(log), `dissolved` (colonies without a decay-proof structure are destroyed; their people are
counted in `flags.decay_lost`). `evacuate` moves 75% (floored) of each Thread and of the
sleepers to the system's Deep, creating a colony there if needed, and carries over its orbital
structures (and a Substrate Core for Echoes).

**8. Signals, forecasts, events.** `deliverSignals`: messages whose `arriveYears ≤ years` (all,
once years are infinite) arrive (`arrivedTurn` = this turn) and are logged with their age;
an unanswered one lapses (`resolved = 'lapsed'`) once more than 8 turns have passed since it
arrived; beyond 160 the oldest are dropped (one kind excepted from both: sealed). Arrivals
are processed: a pact's answer, energy beamed with an answer to our plea, and a dying
civilization's last message (its insight banked, and as much matter under Consume the Dead,
half under Salvage the Dead). Then scripted events: turn 3 (after the increment) The Dynamo Falters, turn
7 Counting the Dark, the first woken Hunger swarm's Rust in the Belt (with the nearest swarm's
star charted). Then `rollRandomEvent`: skipped if more than one event is pending; with the RNG,
`chance(0.22)`, then a weighted pick among events with a weight, of this age (if they name
ages), not once-fired, not fired in the last 12 turns, and whose `bind(state, rng)` returns
data; it records `fired['last_<id>']`. Then positronium (A.5) and `updateForecasts`.
`queueEvent` ignores unknown ids, once-only events already fired, and exact duplicates
(same id and data), and marks once-only events fired.

**9. Crossings.**
1. If the fate is not yet known and η ≥ 30: `fate_known = turn`, queue Not for Ever (decay) or
   The Stars That Would Not Cool (curvature); nothing for stable; `updateForecasts`.
2. If `ageOver`: in the Dark nothing (the ending check of step 10 handles it); otherwise, at
   the Black Hole Age's end an ending check first (sealed), returning if it ends the game; then
   `runCrossing` (its report in `state.crossing`) and `updateForecasts`.
3. Else if `calendarTurnDue`: `calendarTurn`.
4. Under curvature, at η ≥ 89.5 with `matter_gone` unset and the age not the Dark:
   `greatEvaporation`, a storm inside the age, reported like a crossing.
5. In the Black Hole Age, if no black hole or Heart remains: the ending check (sealed), then
   `runCrossing` into the Dark.

**10. Endings and statistics.** `checkEndings` (sealed, S.4.1). Push total people (with cold
sleepers), rounded energy and rounded resolve to `civ.stats` (500 kept). If the capital is gone,
the most populous settlement becomes it.

### A.7 Saves (`game/save.ts`, `ui/store.ts`, `ui/download.ts`)

Saves live only in this browser. Every storage access is wrapped in try/catch, and the game
runs without storage.

| Key | Where | Holds |
|---|---|---|
| `steliterate.save.v1` | localStorage | The quick save (Menu → Quick save), plain save JSON, overwritten each time. |
| `steliterate.autosave.v1` | localStorage | The autosave: after every turn (`doEndTurn`), on Main menu, and before a reload for a lost GPU context. |
| `steliterate.slots.v1` | localStorage | The slot index, an array of `SlotInfo {id, name, civ, turn, era, savedAt (ms), bytes}`, listed newest first. |
| `steliterate.slot.<id>` | localStorage | One named slot: `gz:` + base64 of the gzipped save JSON (CompressionStream), or `js:` + the JSON where that is missing. Id `Date.now().toString(36) + floor(Math.random()·10⁴).toString(36)`. |
| `steliterate.settings` | localStorage | UI settings (A.8). |
| `steliterate.hud` | localStorage | HUD preferences: `forecasts`, `feed`, `orbitsPaused`, `eventPivot`, `viewMode` (0 natural, 1 enhanced, 2 thermal), `sheet`. |
| `steliterate.resume` | sessionStorage | `'1'` while reloading after a lost GPU context. |

**Format.** `serialize`: `JSON.stringify` with `Infinity → "__inf"` and `−Infinity →
"__-inf"`; `deserialize` reverses it, rejects anything without `systems` and `civ`, and runs
`migrate`. Every way in (quick save, autosave, slots, files, codes, bundles, the hot hand-off,
`cloneState`) goes through `deserialize`.

**The ways to save and load.** Continue (main menu, shown if an autosave or quick save exists)
loads the autosave, else the quick save. The Save window lists slots (load, overwrite, delete;
a new slot's default name is `<civ> · turn <n>`; an empty name becomes `Turn <n>`), quick save
and load, load autosave, export, import, and save codes. **Export a file**: `steliterate-<civ
slug>-turn-<n>.json` (the slug is the name's letters and digits joined by hyphens, lower case),
the serialized JSON. **Save codes**: `btoa(unescape(encodeURIComponent(json)))`; `readSave(text)`
reads JSON if the trimmed text (a leading BOM stripped) starts with `{`, else a code. **Export
all saves**: one file `steliterate-all-saves-YYYY-MM-DD.json`: `{kind: 'steliterate-saves',
version: 1, exported: ISO time, saves: [{from: 'slot' | 'quick' | 'auto', name, savedAt, game}]}`,
every slot (unreadable ones left out) then the quick save and the autosave (stamped with the
export time); `game` is the stored JSON parsed without reviving infinities. **Importing a
file** first tries it as such a bundle: each save becomes a new slot keeping its time (the quick
save and autosave named `<name>: <civ>, turn <n>`), one with the same name, turn and time
already present is skipped, and the browser's own quick save and autosave are never touched;
otherwise the file loads as one game. Files are offered through the claude.ai viewer's
`downloads` service when present, else a link download.

**Versions and migration.** `SAVE_VERSION` is 3. The rule: only add optional fields or compute
things live; small counters go in `civ.flags`; when saved state changes shape, bump the version,
add a migrate step, and add a save from the old version to `tools/saves/`. `migrate(s)`, in
order, on every load:
1. `v = s.saveVersion ?? 1` (the first published saves had no version).
2. Fill missing containers: `flags`, `fired`, `pending`, `log`, `battles`, `fleets`, `swarms`,
   `survivors`, `signals`, `forecasts`, `civ.flags`, `civ.research`, `civ.techs`,
   `civ.charters`.
3. `v < 2`: every body without `water` gets 0.42 (homeworld) or `defaultWater(kind, (seed %
   1000)/1000)`.
4. `v < 3`: `fate ??= protonsDecay ? 'decay' : 'stable'`.
5. A settlement's system marked gone whose primary is `void` (a hole that evaporated while only
   others lived in its Deep) is un-gone, if the settlement's body survives.
6. In every gone system, each body that is not the Deep, not dissolved and not rogue is
   dissolved.
7. Drop what this version does not know: techs, charters, the current project, structures,
   queue items and ship classes; fleets left with no ships are deleted.
8. `surveyWhereStationed`: systems where our ships are parked are charted.
9. Two repairs of a stranger mind's records (sealed, S.1.8).
10. `saveVersion = SAVE_VERSION`.

Optional fields added since (`spare`, `paid`, `auto`, `scanned`, `lore`, `haloLeft`, the
dealings fields and others) need no step: absent means the old behaviour. `tools/savecompat.ts`
loads every save in `tools/saves/` (JSON or codes, gzipped allowed), checks it migrates to
version 3, plays it to an outcome with the autoplayer (at most 1200 turns) checking that energy,
matter, resolve, dissent and `gfe` stay finite, and round-trips a save code and a save file ten
turns in. Its fixtures include the first published version's save (seed 24757, turn 71).

### A.8 Settings and options

**New-game settings** (`GameSettings`, the Setup screen):

| Setting | Options | What it changes in the rules |
|---|---|---|
| `civName` | text, up to 40 | Names only (and `savableName`). |
| `homeName` | text, up to 24 | The homeworld's name. |
| `survivors` | 0–4 | How many fellow survivors are generated (0 still makes both shuffles). |
| `length` | brief, standard, vast | Only the Tide's growth factor per age (A.5): every turn length, so the number of turns. |
| `difficulty` | gentle, standard, harsh | Hunger nests 1 / 2 / 3 at the start; the cap on swarms 4 / 6 / 8 (`hunger.ts: MAX_SWARMS`); research costs ×0.85 / 1 / 1.15 (rounded; `techCost`); Great Work costs ×0.8 / 1 / 1.2 (rounded; `workCost`). Nothing else: the setup tip's "crueller crossings" is not implemented. |
| `protonFate` | unknown, decays, stable, curvature | The fate of matter; any choice but Unknown makes it known from the start, and skips the fate draw (A.3). Unknown: decay ½, curvature ¼, stable ¼. |
| `seed` | non-negative integer | The galaxy and the simulation's RNG. |

A "Guide me" toggle on the Setup screen starts the tutorial (`state.flags.tut = 0`); Begin also
opens the age's intro.

**Interface settings** (`ui/store.ts: Settings`, key `steliterate.settings`; section E):
`music` and `sfx` volumes (default 0.7), `quality` (`low | medium | high`, medium on touch
devices unless chosen by hand), `uiScale`, `playlist`, `overture`, `lowVision` (the magnifier
mode), `lvSide`, `qualityChosen`. None of them touch the simulation.

## B. The physics

Everything here was read from the code at `4b92446`. Most of it lives in `game/physics.ts`; the
last flare and the clocks of new stars in `game/sim/flare.ts`; the end-of-age storms in
`game/sim/crossing.ts`; the astronomers' warnings in `game/sim/forecast.ts`; the Long Flow in
`game/sim/flow.ts`; fixed dates in `game/fate.ts` and `game/eras.ts`; the stars' starting values
in `game/gen.ts: makePrimary`. Where the code and the design notes disagree, this section gives
the code and says so. Story material about the two stranger minds is in the sealed section; here
they are named only from outside.

### B.1 Conventions

**Time.** `state.years` is the cosmic age in years; η (`state.eta`) is `log10(years)`. Physics
reads the *calendar* age (`fate.ts: calendarEra`), not the age the player sees (`state.era`):
the two differ only when matter does not decay, where the calendar turns at 10^40 years
(η 39 → 40) while the Degenerate Age goes on (section A). Ages start at: Dusk 9.0×10^13
(η 13.954), Degenerate 10^15, Black Hole 10^40, Dark 10^100 years.

**Two kinds of light.** The code keeps two numbers apart:

| | Function | Unit | Used for |
|---|---|---|---|
| Physical luminosity | `primaryLuminosity(p, years, era, decay, drawn)` | L☉ | climates, display |
| Light factor | `sourceLight(state, sys, years, L).light` | era-normalised: 1 ≈ one red dwarf of 0.1 M☉ in the Dusk, one ember after it | every light collector, the Hearth |

`lightUnitSuns(era)` converts: 1.15×10^-3 L☉ in the Dusk (`0.23 × 0.1^2.3`), 4×10^-12 L☉ from
the Last Light on (one ember). The comment at the top of `physics.ts` gives the reason: the
physical ratio between ages is absorbed by "Dyson scaling" (slower, colder minds need less per
thought), so each age's economy stays readable.

**Adding warmth.** `warmth(...parts)` returns `(SKY_K⁴ + Σ partᵢ⁴)^¼`: temperatures add as
power does, and nothing is ever colder than the cosmic horizon, `SKY_K = 2.2e-30` K (de Sitter,
ħH/2πk at H∞ ≈ 56 km/s/Mpc).

**Galactic free energy.** `state.gfe` starts at 1 and only falls (floor 0.05) through the
Hunger, overdrive, Stellar Lifters and similar unsustainable acts (section C/D; one story event
raises it, sealed section). Several light factors below are multiplied by a gfe term; red and
blue dwarfs and Dusk white dwarfs are not.

**The galaxy's glow.** `backgroundK(years, drawn)`: 1 K (`BACKGROUND_DUSK_K`, a merged galaxy of
red dwarfs, a few tenths of a percent of today's 3.2 K starlight, Eddington 1926) while
`years < 1e14` (`LAST_LIGHT`); after that `0.01 × haloShare(years, drawn)^¼` K
(`BACKGROUND_EMBERS_K`), the embers' and brown dwarfs' glow, gone with the halo. Every dead star's
shown temperature (`primaryTemperature`) and every world's climate adds it; a black hole's does
not.

### B.2 The kinds of primary

`PrimaryKind` values: `red_dwarf`, `blue_dwarf`, `white_dwarf`, `black_dwarf`, `brown_dwarf`,
`neutron_star`, `black_hole`, `smbh` (the Heart), `collision_star`, `helium_star`,
`helium_giant`, `dark_star` (the Last Star), `rogue` (a starless group of rogue worlds) and
`void` (its star or hole is gone). A `Primary` holds `kind`, `mass` (M☉), `lum` (base light
factor), optional `blueAt`, `blueK`, `blueLum`, `whiteAt`, `bornAt`, `diesAt`, `halo`,
`haloLeft`, `spin`, `spinMax`, `evaporateAt`, `rekindle`.

Summary (`ownTemperature`, `primaryLuminosity`, `sourceLight`):

| Kind | Own temperature (K) | Luminosity (L☉) | Light factor |
|---|---|---|---|
| red dwarf | `2700 + (m − 0.08) × 6000` | `0.23 m^2.3` | `p.lum` |
| blue dwarf | `p.blueK ?? 8200` | `p.blueLum ?? min(0.4, 2m)` | `p.lum × (0.3 + 2.7 × share)` |
| white / black dwarf | `warmth(cooling, ember, rekindled, decay, curvature)` | `glow(dwarfRadius)`; an ember at least `4e-12 × emberShare` | see B.2.3 |
| brown dwarf | `warmth(brownCoolingK, 4 × haloShare^¼, decay, curvature)` | `glow(0.1)` | Dusk `lum / 1.15e-3`; later `1.05 (0.35 + 0.65 gfe) lum / 4e-12` |
| neutron star | `warmth(900 × haloShare^¼, 7e6/√years, decay, curvature)` | `glow(1.7e-5)` | Dusk 0.1; Degenerate `0.25 × pulsarBeam × (0.4 + 0.6 gfe)`; later 0 |
| black hole, Heart | Hawking `6.17e-8 / max(1e-6, M)` | `diskLight × lightUnitSuns` | `diskLight × (0.35 + 0.65 gfe)` |
| collision star | 2,900 | `0.23 m^2.3` (m = 0.1) | `4 × frac × (0.5 + 0.5 gfe)` |
| helium star | 42,000 | 30 | `14 × frac × (0.5 + 0.5 gfe)` |
| helium giant | 6,500 | 1,000 | `70 × frac × (0.5 + 0.5 gfe)` |
| `dark_star` (B.2.8) | 4,200 | 1 | `10 × frac` |
| rogue, void | 0 | 0 | 0 |

`glow(r) = (ownTemperature / 5772)⁴ × r²` (Stefan–Boltzmann, radii in R☉; own warmth only, not the
galaxy's glow). `primaryTemperature` = `warmth(own, backgroundK)` except for holes. A new star
whose `diesAt ≤ years` (`newStarOut`) reads as the white dwarf it is becoming:
`warmth(dwarfCoolingK(p, years − diesAt), decay, curvature)` with `glow(dwarfRadius)`, and
`shownKind` names it white dwarf, or black dwarf from `DWARF_COLD_AT`.

#### B.2.1 Red dwarfs

`makePrimary('red_dwarf')`: `mass = U(0.08, 0.13)`; `lum = 0.75 + (mass − 0.08) × 8 + U(−0.08,
0.08)`; `blueAt = 9e13 + 10^U(8, 12.97)`; `whiteAt = blueAt + U(2e9, 6e9)`; then
`flarePeak(mass)` sets `blueK` and `blueLum`. The home star is fixed: 0.1 M☉, `lum` 1.0,
`blueAt` 9.94×10^13, `whiteAt` 9.94×10^13 + 4×10^9.

Physically a red dwarf below about 0.25 M☉ never becomes a giant: it heats up and shrinks into a
blue dwarf, then fades into a white dwarf (Laughlin, Bodenheimer & Adams 1997, ApJ 482, 420;
Adams, Laughlin & Graves 2004).

#### B.2.2 Blue dwarfs: the last flare

`gen.ts: flarePeak(mass)`, with `m` clamped to [0.08, 0.16]:

- `blueK = lerp(m, [0.08, 4600], [0.10, 5800], [0.14, 8600], [0.16, 7400])` (piecewise linear,
  flat beyond the ends);
- the red dwarf's radius `redR = √redL / (redK/5772)²` with `redL = 0.23 m^2.3`, `redK = 2700 + (m
  − 0.08) × 6000`;
- the flare's radius `r = redR × lerp(m, [0.13, 0.7], [0.14, 1.0], [0.16, 1.63])`;
- `blueLum = r² (blueK/5772)⁴`: about 2.9×10^-3 L☉ at 0.08 M☉, 0.010 at 0.10, 0.05 at 0.13,
  0.27 at 0.16, which is 4 to 80 times the red dwarf's light.

A `blue_dwarf` generated as one: `mass = U(0.1, 0.16)`, `lum = 1.0`, `blueAt = 9e13 − 1e9`,
`whiteAt = 9e13 + 10^U(6, 9.4)`, and `flarePeak`. Games saved before these fields existed read
8,200 K (`BLUE_K_OLD`) and `min(0.4, 2m)` L☉.

**Transitions** (`evolveUniverse`, each turn from `from` to `to`): a red dwarf with `to ≥ blueAt`
becomes `blue_dwarf` (note `blue`); a blue dwarf with `to ≥ whiteAt` becomes `white_dwarf`,
`mass = max(0.08, 0.95 × mass)`, `halo = rand() < 0.6` (note `white`). Both can happen in one
turn.

**Light to collectors.** `sourceLight` takes the share of the turn [years, years + L] inside the
flare [`blueAt`, `whiteAt`]: `share = min(1, overlap / L)` (1 if L = 0) and `light = p.lum × (0.3
+ 2.7 × share)`. A turn lived wholly inside the flare gives three times the red dwarf's light;
a turn far longer than the flare gives 0.3 of it. (The real flare is 4 to 80 times brighter; the
light factor stays at 3: era normalisation.)

**Stopping the turn** (`flare.ts`). Late in the Dusk a turn is far longer than the flare
(2 to 6 billion years), so: `flareDue(state, from, to)` finds the earliest *settled* red dwarf
whose `blueAt` falls in (from, to], and `turnStep` ends the turn exactly at that `blueAt`
whatever the pace. At the start of the next turn the event `last_flare` offers to **keep time
with the flare**: `keepTimeWithFlare` sets `civ.flags.flare_until = whiteAt` and `flare_step =
(whiteAt − years) / FLARE_TURNS` (6). While `keepingTime` (years below `flare_until −
flare_step × 1e-6`), each turn ends at `min(Tide end, years + flare_step)`, snapped to
`flare_until` when within a millionth of a step. `livedShare` (the factor all yields scale by)
is 1 on a flare-clock turn, `min(10^-pace, 1)` on a turn cut short by a flare's start, otherwise
`10^-pace`. The flags are cleared once `years ≥ flare_until`. The offer to keep time appears
(`flareData.clock`) only when the flare is shorter than three turns at our pace.

**Heat.** `flareHeat(state, b)` evaluates `bodyClimate` with the primary set to `red_dwarf` and
to `blue_dwarf` (before / during) and the luminosity ratio. A world is `scorched` while its
primary is a blue dwarf, it is not rogue, and its night side (or mean) is above `SCORCH_K` =
340 K; there no Kin can live outside (capacity 0), and settlements lose one Kin a turn beyond
their indoor room. `sheltersNeeded` / `digShelters`: per scorched settlement `ceil(short / 3)`
night shelters (`SHELTER_CAP` 3 Kin each), at most `SHELTER_MAX` 4 per settlement counting
those already dug, 10 matter each, as many as the matter pays for.
`thawed(state, b)`: an `ice`, `ocean_ice`, `super_earth` or `barren` world with water ≥ 0.1
whose mean is 273 to 373 K under a blue dwarf: `'warm'` up to 340 K (room for `THAW_ROOM` 5 Kin
without domes), else `'hot'`. Computed live, never stored.

`turn.ts: scorchWorlds(from, to)` (step 4 of the turn): every scorched world takes
`share = overlap([blueAt, whiteAt], [from, to]) / (whiteAt − blueAt)`; `scorch` sets vitality to
0 if the night side is at least `LIFE_LIMIT_K` = 395 K (122 °C, Takai et al. 2008), otherwise
`vitality − 0.6 × share`; water `× (1 − 0.9 × share)` unless the world is `water_rich`. If its
life ends, `worldDies(b, scorched = true)` makes it bare rock. The damage sums to the same over
one turn or six. A new galaxy applies the flare so far: `scorchedFromTheStart` (in `newGame`,
after `waterFromTheStart`) scorches with `share = (years − blueAt) / (whiteAt − blueAt)`.

#### B.2.3 White dwarfs, embers and black dwarfs

`makePrimary('white_dwarf')`: `mass = U(0.45, 0.9)`, `lum = 0.02`, `halo = rng.chance(0.6)`.
`dwarfRadius(p) = 0.0125 × ∛(0.6 / clamp(mass, 0.08, 1.4))` R☉ (about the Earth's at 0.6 M☉).

**Age.** `dwarfAge(p, years) = max(0, years − (p.whiteAt ?? formedAt(p)))`. `formedAt(p)`: a
deterministic log-uniform date between `FIRST_FORMED` 10^9 years and 9×10^13, from `u =
(hashSeed("formed:wd:" + mass) mod 1000003) / 1000003` (`"bd"` for brown dwarfs): no RNG draw, so
seeds and old saves are untouched. Only red-dwarf remnants carry `whiteAt`; a white dwarf left by
a collision or helium star has no `whiteAt` and reads as one formed at `formedAt`.

**Own cooling**, `dwarfCoolingK(p, age)`, one law in every age:
- Mestel's law while the envelope holds the heat: `mestel(t) = 5772 × ((0.01 × (1 + t/1e8)^-1.3)
  / r²)^¼` (Mestel 1952, L ∝ t^-7/5): about 4,000 K at 10^10 years.
- After `DEBYE_AGE` = 5×10^11 years (crystallised core, log L ≈ −7 at 0.6 M☉: Althaus et al.
  2010): `mestel(5e11) × (age / 5e11)^-0.58` (the game's estimate: electrons' heat ∝ T let out
  as L ∝ T_core^3.5). About 50 K as the Dusk ends, 13 K at η 15, 0.016 K at η 20.
- A red dwarf's remnant (`blueAt` set) is never hotter than `p.blueK ?? 8200`.

**Embers.** `emberShare(p, years, drawn)`: 0 unless `p.halo` and `kind === 'white_dwarf'`;
otherwise `haloShare(years, drawn)`, and for a dwarf cast out of the galaxy (`haloLeft`) times
`max(0, 1 − (η − log10(haloLeft)))`, so it dims to nothing within a tenfold of years.
`haloShare(years, drawn)`: with `e = log10(years + drawn)`, 1 for `e < 22`, else `max(0, (25 −
e) / 3)`. An ember's temperature term is `EMBER_K × emberShare^¼` with `EMBER_K` = 63 K (WIMP
annihilation, Adams & Laughlin 1997: about 4×10^-12 L☉, 10^15 W). This warmth applies from the
Dusk on (Adams & Laughlin: from η 11).

The full temperature: `warmth(dwarfCoolingK, 63 × emberShare^¼, rekindledK, 0.05 × decay^¼,
curvature)`; `rekindledK = 5772 × (rekindle × 4e-12 / r²)^¼` (`REKINDLE_SUNS`: a world falling in
gives 10^15 to 10^16 W, holding the dwarf at 50 to 110 K).

**Light to collectors** (`sourceLight`):
- Dusk: with `whiteAt`, `youngDwarfLight(years − whiteAt, years − whiteAt + L)`, the average over
  the turn of `max(0.02, 0.45 × (1 + t/1e9)^-1.2)` (0.45 at the collapse, floor reached at
  `1e9 × ((0.45/0.02)^(1/1.2) − 1)` ≈ 1.24×10^10 years; integrated in closed form); without
  `whiteAt`, 0.02.
- Degenerate calendar: with `gf = 0.35 + 0.65 gfe` and `ember = emberShare(...)`: if `ember >
  0`, `dark = 1.05 × ember × gf` and `light = dark + rekindle` (`SourceInfo.dark` is the part
  Halo Siphons double, B.3); otherwise `light = rekindle`.
- Black Hole and Dark calendars: `rekindle` only.

**Black dwarfs.** `DWARF_COLD_AT = 1e15 × (5/20)^(1/−0.35)` ≈ 5.28×10^16 years (η 16.72), a date
kept from an older rule. In `evolveUniverse`, outside the Dusk, a white dwarf with `to ≥
DWARF_COLD_AT` and `emberShare(p, to, drawn) === 0` becomes `black_dwarf`: only the name changes.
At the Last Warmth every remaining white dwarf is renamed black (B.9).

#### B.2.4 Brown dwarfs

`makePrimary`: `mass = U(0.03, 0.075)`, `lum = 0.02`. `brownCoolingK(p, age) = 1550 × (max(1e8,
age) / 1e9)^-0.32 × (max(0.01, m) / 0.05)^0.83` (Burrows et al. 2001, Rev. Mod. Phys. 73, 719,
eq. 2; fitted to about 10 Gyr, so an upper bound this late), with `age = years − formedAt(p)`.
Dark matter adds `BROWN_HALO_K` = 4 K × `haloShare^¼` (uncertain); decay 0.009 K; curvature
`curvatureK(m × M☉, 0.1 R☉, 87)`. Radius `BROWN_R` = 0.1 R☉ (about Jupiter's whatever the mass).
About 28 to 63 K in the Dusk, 19 K at η 15, 0.5 K at η 20.

Light factor: in the Dusk `lum / 1.15e-3` (next to nothing, about 10^-8); after it `1.05 × (0.35
+ 0.65 gfe) × lum / 4e-12`, worth a fraction of an ember to a little over one early in the
Degenerate Age and fading as it cools. Only Infrared Shrouds gather it: ordinary light collectors
have `notAt: ['brown_dwarf']` and give 0 there. The label switches on `own ≥ max(1, halo)`.
`brownWarmth(T)` (smoothstep of log T between 3 K and 100 K) only tints the picture.

#### B.2.5 Neutron stars

`makePrimary`: `mass = U(1.2, 2.1)`, `lum = 0.08`, `spin = spinMax = U(80, 220)` (energy units).
Temperature: `warmth(900 × haloShare^¼, 7e6 / √years, 1.5 × decay^¼, 3e-8 × curve)`. The 900 K
(`NEUTRON_HALO_K`) is dark matter falling in (Baryakhtar et al. 2017 find 1,700 to 2,500 K at
today's Milky Way density); with no envelope its own heat goes as T ≈ K·t^-½, `K` = 7×10^6
K·yr^½ (`RESIDUAL.neutron`; an audit estimated 1.2 to 3.9×10^6). Note that this `t` is the cosmic
age, not the star's.

`pulsarBeam(era, years)`: 1 in the Dusk, `max(0, 1 − (η − 15)/12)` in the Degenerate calendar
(0 from η 27), 0 after. Light factor: Dusk 0.1, Degenerate `0.25 × pulsarBeam × (0.4 + 0.6 gfe)`,
then 0. The spin reservoir is separate (B.4) and never refills.

#### B.2.6 Black holes and the Heart

| Hole | Mass (M☉) | Spin reservoir |
|---|---|---|
| stellar (`makePrimary`) | `U(4, 28)` | `round(420 × U(0.2, 0.99) × √(M/10))` |
| cluster hole (80% of globular clusters) | `10^U(3, 3.8)` | 3,000 |
| the Wanderer (in the void) | 2.2×10^5 | 9,000 |
| the Heart (`smbh`) | 3×10^8, growing to at most 4.6×10^10 | 40,000 |

**Evaporation.** `hawkingTime(M) = HAWKING_K × M³` with `HAWKING_K` = 2.1×10^67 years
(`t ≈ 2×10^67 (M/M☉)³`, Adams & Laughlin): stellar holes η 69.1 to 71.7, cluster holes η 76.3 to
78.7, the Wanderer η 83.4, the Heart η 92.8 at birth and η 99.3 at its cap. `evaporateAt` is set
at generation and whenever the Heart grows.

**Hawking temperature** (display): `6.17e-8 / max(1e-6, M)` K. **Hawking light** to collectors,
`hawkingLight(p, years)`: 0 if not a hole, no `evaporateAt`, or `years ≥ evaporateAt`; else with
`f = min(0.999, years / evaporateAt)` and `base` = 0.004 (Heart), 0.04 (M > 1000), 0.35 (others),
`min(25, base × (1 − f)^(−2/3))`. Since M ∝ (1 − f)^⅓ and power ∝ M^-2, that rise is the real
law; the base values are the game's. It is not gated by age: Hawking Collectors (a Degenerate Age
build) read about 0.35 from a stellar hole at once.

**Accretion disk**, `diskLight(kind, era, years, matter = true)`, 0 once matter is gone
(`matterGone`): the Heart 1.5 in the Dusk; `max(0.15, 1.2 − 0.07 (η − 15))` in the Degenerate
calendar; 0.08 in the Black Hole calendar; 0 in the Dark. A stellar hole 0.05 in the Dusk and
Degenerate calendars, else 0. Light factor `diskLight × (0.35 + 0.65 gfe)`; its luminosity
`diskLight × lightUnitSuns(era)` (0.05 × 1.15×10^-3 ≈ 6×10^-5 L☉, within Bondi accretion from
thin gas). The drop at the Last Light is a step.

**The Heart grows** (`growHeart(p, dm)`): `mass = min(4.6e10, mass + dm)`, `evaporateAt =
hawkingTime(mass)`, `spinMax = max(spinMax, 40000 + mass / 2e6)` (spin itself unchanged). During
galactic evaporation (B.6) every turn adds `4.6e10 × min(1, L / 5e20)` plus the mass of each
system that falls in.

**When a hole evaporates** (`evolveUniverse`, Black Hole or Dark calendar, `to ≥ evaporateAt`,
system not gone): `evaporateHole(state, s)` makes the primary `void` with `lum`, `spin`,
`spinMax` 0 and no `rekindle`; every world still bound to it (not dissolved, not the Deep)
becomes rogue, and is returned in `held`; the system is `gone` only if no settlement and no world
is left. The orbits widened as it slowly lost mass (a ∝ 1/M) until nothing held them; nothing
built there is lost. The final burst (Codex: about 2×10^22 J in its last second, under 0.1 J/m²
at 1 AU) harms nothing; `finalBurstCatch(state, systemId, held)` pays `BURST_CATCH` = 250
energy per Burst Catcher in that system's Deep or on a world in `held`. Horizon Vaults there
(`storesInHole`) hold nothing afterwards.

#### B.2.7 New stars of the Degenerate Age

Rates per turn (`evolveUniverse`, Degenerate calendar only; `e = log10(to)`):

- **Collision star** (two brown dwarfs merge): `bound = 1` for e < 18.4, `(21 − e)/2.6` to
  e = 21, then 0; `collisionRate = min(0.6, L / 4e12) × gfe × bound`. On a hit, a random brown
  dwarf not gone or ejected becomes `collision_star`, `mass = 0.1`, `bornAt = to`, `diesAt = to
  + 10^(12 + rand())` (one to ten trillion years).
- **Merger** (two white dwarfs spiral together by their own gravitational waves, galaxy or not):
  `mergerRate = e < 25 ? min(0.35, L / 3e13) × gfe : 0`. On a hit, a random white or black dwarf
  not gone: with chance 0.1 a **Type Ia supernova** (primary `void`, every body but the Deep
  dissolved, settlements there destroyed); otherwise a `helium_star`, `mass = 0.4 + 0.7 rand()`,
  `bornAt = to`, `diesAt = to + (0.8 + 2.2 rand()) × 1e8`.
- **Burnout**: when `to ≥ diesAt`, a helium star with `mass ≥ 0.9` (or else with chance 0.3,
  and no `rekindle`) swells into a `helium_giant`: `bornAt = to`, `diesAt = to + GIANT_LIFE`
  (1.2×10^5 years). Any other collision star, helium star or giant becomes a `white_dwarf` with
  `halo = false`, `lum = 0.02`, no `bornAt`/`diesAt` (note `burnout`).

The rates are about 10^8 times Adams & Laughlin's per object, so that a galaxy of a few thousand
systems sees them. **Every new star lights as its turn ends** (`bornAt = to`, a bend: the two
may have met at any moment of the turn), so it shines through the next turn. The draw that once
placed the birth inside the turn is still made and discarded.

`frac` in the light formula is the share of the turn inside [bornAt, diesAt], `min(1, overlap /
L)` (0 when L = 0), or 1 on a **flash** turn (`civ.flags.star_flash === diesAt` and `diesAt >
years`). A turn soon outlasts any such star; the player can **keep time** with one
(`flare.ts`):

- `starClockTerms(state, sys)` is `possible` only in the Degenerate calendar (for a `dark_star`
  also in the Black Hole calendar: sealed section) for a burning new star. With `from` = now (or, while another clock
  runs, its end: a **follow-on**, `after`), `left = diesAt − from`, `next` = the Tide turn at our
  pace at `from`, `orders = log10(next / left)`.
- Cost: `price = ceil(STAR_ORDER_COST × max(0, orders − STAR_FREE))` (250 per tenfold past a
  hundredfold), at least `STAR_FOLLOW_MIN` 250 for a follow-on, at most the full storage
  (`reserveCapacity`), halved (rounded up) when a pact partner lives at that star
  (`clockPartner`); a `dark_star`'s price is in the sealed section.
- `unneeded` when `left ≥ 6 × next` (it lasts six turns at our own pace anyway).
- **Brief**: `left / 6 < from × STAR_STEP_MIN` (1e-13, the resolution of doubles). With no other
  clock running it can still be caught as a **flash**: one turn ending at `diesAt`, or at `from ×
  (1 + 1e-13)` if that is later (past about η 18.1 for a giant), lived in full in its light.
- Otherwise `keepTimeWithStar` sets `star_until = diesAt`, `star_step = (diesAt − years) /
  STAR_TURNS` (6). `turnStep` then ends each turn on the sixths counted back from `diesAt`; with
  Quickening at a quick pace each splits into `STAR_SPLIT` 10 (`starSplit`, if the tenth is still
  ≥ years × 1e-13), each lived as a tenth (`livedShare = 1 / split`). `clearStarClock` ends it
  and starts a waiting follow-on (`star_next`). `starGoneEarly` drops a clock whose star
  dissolves.

**Boiling and swallowing.** `boilsUnder(state, b, kind)` uses `starClimate` at the new star's
`NEW_STAR_LUM` (helium star 30 L☉, giant 1,000) with no terraforming. Spared: the Deep, dissolved,
rogue and feeding worlds, and orbit 0. Under a giant everything with `orbitAU ≤ GIANT_RADIUS_AU`
(0.116 AU, about 25 R☉) is swallowed, giants included. Otherwise gas and ice giants are spared;
a belt goes when its mean reaches `RUBBLE_BOIL_K` 1,600 K (helium star; forsterite rates) or
`RUBBLE_GIANT_K` 1,800 K (giant); another world when its warmest ground (day, or mean) reaches
`ROCK_BOIL_K` 3,000 K, under a helium star only (about 45% of a 42,000 K star's light is ionising;
rock vapour reaches 0.18 bar at 3,000 K). `evolveUniverse` records which new star shone during
[from, to] *before* the burnout step rewrites it, then dissolves each such world (note `boiled`,
`swallowed` flag). Its people escape to the Deep (B.5.7).

#### B.2.8 The Last Star

`dark_star` is a primary kind that only the sealed stories create; how and when it lights, how
long it burns and what keeping time with it costs are in the sealed section. As physics it is a
star burning dark matter (dark stars were proposed for the *first* stars: Spolyar, Freese &
Gondolo 2008): 4,200 K, 1 L☉, light factor `10 × frac` (frac 1 when L = 0), `alive = [bornAt,
diesAt]`, star-like for every rule above (`isStarLike`, `newStarOut`, `nextStellarChange`). At
`diesAt` it becomes a `black_dwarf` with no `bornAt`/`diesAt` (note `burnout`). At the Great Decay
or the Great Evaporation it goes with the rest of matter, and a clock kept with it ends
(`starGoneEarly`).

### B.3 The halo of dark matter, and Halo Siphons

All ember, brown-dwarf, neutron-star and background warmth from dark matter reads
`haloShare(years, drawn)` (B.2.3). `drawn = haloDrawn(state) = civ.flags.halo_drawn ?? 0`: years
the halo's own clock runs ahead of ours.

**Halo Siphons** (tech `halo_siphons`, Degenerate Age, `noAuto`: surplus discoveries skip it,
though the autoplayer's fallback does research it). `siphonsRunning(state)`: researched and `civ.flags.siphons_shut` unset. While they run:
- in `colonyTurn`, a light collector at a `halo` primary in the Degenerate calendar gathers
  `light + dark`: the ember's dark-matter part doubles (a world falling in does not);
- in `endTurn` step 7, before `evolveUniverse`, `drainHalo(state, from, to)` adds `to − from` to
  `halo_drawn` (Degenerate calendar only, finite turns, and only while `haloShare(from, d) > 0`):
  the whole halo falls twice as fast.

`shutHaloSiphons` sets `siphons_shut = turn`, for good; what was drawn stays drawn. Derived
dates: `haloEta` = `log10(years + drawn)`; `haloReachesYears(state, eta)` = now if already
there, `(10^eta − d + now) / 2` while siphons run, else `10^eta − d`; `embersOutEta` = η of
`haloReachesYears(25)`, about 24.7 if they run from early on. This is a bend: a few dozen embers
among hundreds of billions could never empty a galaxy's halo (doubling their draw would bring its
end sooner by under a billionth). Running the siphons has further consequences told in the sealed
section; a sealed story choice can also cut ember yields by a quarter.

### B.4 Energy: what each source gives

`EnergyMode` (`data/structures.ts`) and the rule in `economy.ts: colonyTurn` (per structure,
`a = amount × count`; afterwards every `e` is multiplied by `pf × overdrive (1.5) × focus ×
(1 + taint/200)`, `pf` = `livedShare`):

| Mode | Gives | Rule |
|---|---|---|
| `light` | a primary's light | `a × light` (+`dark` with siphons); 0 at a `notAt` primary or on a rogue world; Solar Arrays × `insolation` |
| `geo` | core heat | `a × body.coreHeat` |
| `rekindle` | a feeding world's debris | `a × primary.rekindle` |
| `fusion`, `accretion` | matter burned | wants `input × count × pf` matter; `e = a × got / want` |
| `spin` | a finite reservoir | `draw = min(a × pf, spin left)`, `e = draw / pf`; `primary.spin −= draw` |
| `hawking` | Hawking light | `a × hawkingLight(p, years)` |
| `decay` | proton decay | if protons decay, Degenerate calendar, η > 30: `a × clamp((η − 30)/6, 0.2, 1)` |
| `curvature` | a neutron star's curvature glow | curvature fate, at a neutron star, η > 30: `a × clamp((η − 30)/6, 0.2, 1)` |
| `siphon` | the horizon (speculative) | Dark calendar: `a` |

Structures and amounts are in the appendix table. **Insolation** (`insolation` = `clamp(
insolationByDistance, 0.05, 2.5)`, 0 when rogue): `(aStd / max(0.003, orbitAU))²`, with `aStd =
0.031 × (max(0.05, m)/0.1)^1.15` AU for red, blue and collision stars (the homeworld gets ×1), and
for any other primary the median orbit of its bound, non-`outer` worlds (the world itself
included). Orbital collectors ignore it.

**The Hearth** of every settlement: `fed = max(min(1.5, rogue ? 0 : light), 0.8 × coreHeat, (at a
hole, not rogue, after the Dusk) 1)`, and `2 × max(0.25, fed) × (1 − damage) × pf × overdrive ×
focus × taint`. Where nothing local gives a quarter (`fed < 0.25`) it burns stored fuel and
salvage, at the floor of 0.5 before those factors.

A structure "around the star" (its `bodies` include `deep`) on a world flung loose (`leftBehind`)
gathers nothing and stores nothing. Storage: `reserveCapacity` = (100 + Σ (`reserveCap` +
`burstCap`) × count) × mods; a hole's vault counts only while the hole exists.

### B.5 Worlds

#### B.5.1 Body data

A `Body` has `kind` (`eyeball`, `terran`, `super_earth`, `barren`, `ice`, `ocean_ice`,
`gas_giant`, `ice_giant`, `asteroids`, `deep`), `orbitAU`, `massEarth`, `habitability`,
`vitality`, `decline`, `coreHeat`, `richness`, `hydrogen`, `water` (share of surface, or of the
buried ocean), `traits`, `inspiralAt`, `feeding`, `rogue`, `dissolved`. Generation (section A)
gives each world `inspiralAt = 9e13 + inspiralTime(a, m, max(0.1, M_host))`, and the trait
`tidally_locked` if `orbitAU < 0.08` and not a gas giant; `ocean_ice` gets `subsurface_ocean`;
`water = defaultWater(kind, (seed mod 1000)/1000)`. The homeworld is fixed: eyeball, 0.031 AU,
1 M⊕, habitability 0.85, vitality 1, decline 0.012, coreHeat 0.8, water 0.42, traits
`homeworld`, `tidally_locked`, `failing_dynamo`.

**Outer worlds** (`addOuterWorlds`, after everything else, each system from its own seed
`hashSeed(seed:sysId:outer)`): one red or blue dwarf in three gets 1 to 3 more worlds, one brown
dwarf in eight one, starting at `exp(U(ln 0.3, ln 2 or 3))` AU and spaced `× U(1.7, 3.2)` while
≤ 8 AU; kinds (red: ice < 0.45, ice giant < 0.8, belt < 0.9, else gas giant; brown: ice < 0.65,
ice giant < 0.85, else gas giant), trait `outer` (microlensing: Cassan et al. 2012; Suzuki et al.
2016; Han et al. 2013).

#### B.5.2 Climate: `starClimate(state, b, lum?, tf?)`

Evaluated in this order:

1. `L` = 0 if rogue, else `lum ?? primaryLuminosity(primary, years, era, decay, drawn)` (L☉).
2. Orbital Mirrors (terraforming, B.5.6): `L × 2` if the bare climate's warmest ground is below
   288 K, else `L / 2`.
3. `a = max(0.003, orbitAU)`; `tEq = 278 × L^¼ × 0.7^¼ / √a` (equilibrium, albedo 0.3; 254 K at
   1 AU from one Sun).
4. Internal heat `tInt = warmth(40 × coreHeat, (after the Dusk) 1e4/√years, 0.003 × decay^¼,
   giantHeatK, worldCurvatureK × curvatureWarmth)`. `giantHeatK` (gas and ice giants): `100 ×
   (max(1, M)/318)^0.2 × (max(4.5e9, years)/4.5e9)^-0.32` K (fit to Jupiter, Saturn, Neptune;
   about 4 K for a Jupiter in the Dusk).
5. `bg = backgroundK`; `raw = (tEq⁴ + tInt⁴ + bg⁴)^¼`; `t = raw`.
6. **Runaway greenhouse**: a `water_rich`, non-rogue world with `t ≥ RUNAWAY_K` (276.6 K =
   `278 × (0.7 × 1.4)^¼`, 1.4 times Earth's sunlight) or, if locked, `RUNAWAY_LOCKED_K` (300 K)
   is a **steam world**: `limit = (limitK / 254.3)⁴`; `k = max(t, steamGroundK(T_star, L/a²,
   limit))`; returns `{mean: k, steam}` (and day = night = k if locked). Live: dimmed below the
   limit, the steam rains out.
7. Atmosphere Works: if `t < 288`, `t = min(288, 1.15 t)`.
8. Living kinds (`eyeball`, `terran`, `super_earth`): `t × (1 + 0.12 × vitality)`.
9. `airless`: `barren` or `asteroids` without Atmosphere Works.
10. **Locked** (`tidally_locked`, `tEq > 0`, not a belt): only the starlight divides. `side(s) =
    (t/raw) × ((tEq × s)⁴ + tInt⁴ + bg⁴)^¼`. Airless: day `side(1.4)`, night `side(0.12)`.
    Otherwise `carry = max(0.25 + 0.45 × vitality, works ? 0.7 : 0)`, day `side(1.3 − 0.15 ×
    carry)`, night `side(0.35 + 0.4 × carry)` (a thick air carries heat round: Joshi, Haberle &
    Reynolds 1997).

`steamGroundK(starK, sunlight, limit) = clamp(550 + (starK − 2600) × 700 / 3172, 550, 1650) ×
max(1, sunlight / limit)^0.16`: under a steam sky the deep steam is radiative and a redder star
heats it higher up, so the ground is about 1,250 K for a Sun-like star and 550 K for one like
TRAPPIST-1 (Selsis et al. 2023, Nature 620, 287), not Kasting 1988's 1,500 K and more. The
runaway limit is the player's choice of Kasting 1988's; later models give 1.06 (Kopparapu et
al. 2013) to 1.1 (Leconte et al. 2013); locked worlds' clouds hold it off to nearly twice
(Yang, Cowan & Abbot 2013).

`bodyClimate(state, b)` = `starClimate`, raised to at least `LAMP_K` 285 K on mean, day and night
where Orbital Lamps (`warms`) stand over a settlement (a floor: no help against a flare).

#### B.5.3 Core heat and the homeworld's dynamo

`coreHeat` (0 to 1) feeds `40 × coreHeat` K, Geothermal Taps and the Hearth. In the Dusk only the
homeworld cools: −0.007 a turn while settled (×0.4 with a Core Stimulator, which also adds +0.3
once). After the Last Light every world's core heat keeps `CORE_FADE` 0.8 of itself each turn,
set to 0 below 0.02 (really it went long before; the game keeps it through the Dusk). Below that,
a world's core keeps only `RESIDUAL.world` 10^4 K·yr^½ / √years. The failing dynamo is story and
the homeworld's high `decline` (0.012): the event `dynamo_fails` on turn 3, the Magnetic Shield
(`declineMult` 0.4).

#### B.5.4 Water

- `ICE_MELTS_K` 273; liquid between 273 and 373 K. `waterState(b, climate, ocean)` describes it:
  airless worlds hold no liquid, bare ice lasts only below `AIRLESS_ICE_K` 110 K (Vasavada, Paige
  & Wood 1999: frost, frost cold-trapped on the night side, or "boiling off into space"); an
  `ocean_ice` world below 273 K has its ocean under the ice (or frozen through); a locked world
  can have open sea on the day side and ice beyond the terminator, a boiled day side and a sea on
  the night side, or a band of sea along the terminator.
- `buriedOcean`: an ice-shelled ocean stays liquid while ice covers it (night or mean < 273,
  not steam), it is bound to a real primary (not rogue, `rogue` or `void`), and it is the Dusk
  or `coreHeat ≥ BURIED_HEAT` 0.05 (display).
- **At generation** (`newGame`): `frozenFromTheStart` first (a living world whose warmest ground
  is below 195 K starts dead: `ice` with habitability 0.05 if water ≥ 0.1, else `barren`), then
  `waterFromTheStart`: every `ocean_ice`, or `ice` with water ≥ `WATER_RICH` 0.5, outside the
  home system gets `water_rich` (up to half its mass water, Léger et al. 2004) and, if already a
  steam world, vitality and decline 0. A water-poor `ice` world whose warmest ground (judged by
  the red dwarf's light if its star already flares) is at least 273 K keeps its ice only if it
  is locked with a night side below 273 K (cold-trapped: Leconte et al. 2013, A&A 554, A69;
  Menou 2013); otherwise it becomes `barren` (Luger & Barnes 2015), habitability, vitality,
  decline and coreHeat 0, `richness = 1 + 0.7 × clamp((richness − 0.5)/0.4, 0, 1)`, water
  `defaultWater('barren', …)`, `subsurface_ocean` removed. All deterministic: no RNG.

#### B.5.5 Life, freezing and death

`SURFACE_LIFE` = eyeball, terran, super_earth. `FROZEN_K` = 195 K; `frozenHard` (warmest ground
below it) leaves no room for Kin. `vitalityLoss(state, b, c)` per turn:

- `decline` (settled worlds only): `b.decline × Π declineMult × (overdrive ? 1.3 : 1) × accel`,
  `accel = min(3, 1 + 0.02 × eraTurn)` in the Dusk, 3 after.
- `freeze` = `0.05` (×0.5 with a Core Stimulator) when *sunless* and no Orbital Lamps: sunless
  means after the Dusk, or rogue, or a `rogue`/`void`/missing primary, or surface life whose
  warmest ground is below 195 K, or seeded life no longer kept (`seededLifeUnkept`). Life under an
  ice shell lasts until the Last Light.

`declineWorlds` (turn step 4): after the Dusk core heat fades; seeded life spreads; for each
living world: a steam world loses all life at once; else `vitality −= decline`, (homeworld core
cooling), then `vitality −= freeze` if still alive; the first freeze of one of ours is logged
once with `turnsToFreeze`. At 0, `worldDies`: a surface-life world becomes `ice` (water ≥ 0.1,
not scorched) or `barren`, with trait `once_alive`. `sunGone` marks surface life whose primary
is no longer star-like (`isStarLike`: red, blue, collision, helium, giant, Last Star). A white
dwarf just collapsed is still hot, so a close world can keep warm for many short turns.

Names follow the climate (`ui/labels.ts: bodyKindName`): boiling away / being swallowed; thawed
ocean, hot sea, twilight sea (locked ice world, day ≥ 373 K, night < 273 K: a hot eyeball);
steam, scorched or terminator world (Lobo et al. 2023); lava world (dry rock, warmest ground ≥
`LAVA_K` 1,500 K); eyeball sea / eyeball world (day 273 to 373 K, night < 273 K: Pierrehumbert
2011); frozen world.

#### B.5.6 Habitability and terraforming

Kin room: `kinBaseCapacity` = `floor(round(12 × habitabilityOf) × vitality)` (×0.3 rogue or
feeding), 0 if scorched or frozen hard, at least 5 if `thawed === 'warm'`. `livableWarmth(k)`: 1
from 250 to 330 K, `(k − 200)/50` below, `(400 − k)/70` above, clamped at 0. Terraforming
(`sim/terraform.ts`) runs only in the Dusk around a burning red dwarf (`terraformLit`): Orbital
Mirrors add `0.2 × livableWarmth`, Atmosphere Works `0.25 × livableWarmth` (warmth = the
terraformed warmest ground), never past `TERRAFORM_CEILING` 0.55; Works raise water to at least
0.1; Biosphere Seeding needs habitability ≥ 0.3, water ≥ 0.05, own habitability < 0.5, and adds
0.04 vitality a turn to 0.8 (McKay, Toon & Kasting 1991; Zubrin & McKay 1993).

#### B.5.7 The fates of worlds

All in `evolveUniverse`, for each world that is not the Deep, dissolved, rogue or feeding:

- **Stripped by close passes** (going rogue is the common fate: a star passes within about 1 AU
  of a system once per 10^15 years). Only while the system is in the galaxy (`!ejected`),
  `orbitAU > 0`, and not in the Black Hole or Dark calendar: `density` = 3 at the Heart's
  system (`special === 'core'`; it has no worlds, so the other core systems get 1), 4 in a
  globular cluster, else 1; `tau = 2.5e16 / (density ×
  max(0.01, a)²)` years; `rand() < 1 − exp(−L/tau)` makes it `rogue` (note `rogue`; our
  settlement's event `unmoored`). A rogue world gets no light (L = 0, insolation 0), no tidal
  warmth, freezes, keeps ×0.3 Kin room and nothing built around its star. A sealed story mechanic
  can also fling worlds loose.
- **Falling in** (gravitational-wave inspiral, from the co-designer's unreviewed notes, kept as
  model uncertainty): `inspiralTime(a, m, M) = 3e19 × (a/0.1)⁴ / max(0.01, m) × (0.6 /
  max(0.05, M))²` years (an Earth at 0.02 AU of 0.6 M☉: 4.8×10^16; the homeworld about 10^19,
  η 19.0). It happens only around a white dwarf, black dwarf or neutron star (`NEVER_FEED`, which
  the site values read, names brown dwarfs, holes, `rogue` and `void` as never taking worlds in;
  a burning star does not either), checked each turn once `to ≥ inspiralAt` (the star's change
  is applied first, so a world whose date passed while its star still burned starts to fall in
  the turn the star collapses, with `start = from`): `jupiter = massEarth > 50`; `model = rand() <
  (jupiter ? 0.35 : 0.2) ? 'rekindle' : 'feed'`; `tau = jupiter ? 1e13 : 10^(14.2 + 1.2 rand())`;
  `base = (jupiter ? 5 : 1) × clamp(m / (jupiter ? 318 : 1), 0.3, 3)`; `start = max(from,
  inspiralAt)`; vitality 0 (event `world_falls`; the model is hidden until then).
- **Feeding**: each turn `power = base × (rekindle ? 8 : 1) × (1 + t/tau)^-2`, `t = to − start`,
  summed over the system's feeding worlds into `primary.rekindle` (kept only if > 0.001). When `t
  > 30 tau` the world is gone (note `plunge`, "one final flash": +20 energy if we live in the
  system; its people evacuate).
- **Boiled or swallowed** by a new star (B.2.7). **Destroyed** by a supernova, or with its
  system falling into the Heart (B.6). **Dissolved** by proton decay or the end of matter (B.7).
  **Set loose** when its hole evaporates or its dwarf fades (B.2.6, B.7).

**Evacuation** (`turn.ts: evacuate`): when a settled world plunges or boils away, 75% (floor) of
each Thread and of the cold sleepers reach the Deep, which becomes or joins a settlement keeping
its orbital structures (and a Substrate Core per 4 Echoes if it had none); the rest are lost.

### B.6 Galactic dynamics

**Galactic evaporation** (Degenerate calendar, 18.4 < e < 21; Adams & Laughlin's 10^19 to
10^20 years): `pEject = min(0.5, 0.22 × (log10 L − 17))`; for each system not ejected, not gone,
and not the Heart's or the home system, `rand() < 0.25 × pEject`, then `rand() < 0.08` (and not
the Heart): **falls into the Heart** (`growHeart` by its mass; its bound worlds dissolve; if a
rogue world of it remains it stays as an empty `void`, else `gone`; note `swallowed`, our
settlements there not on rogue worlds destroyed). Otherwise **ejected** (`ejected = true`; a halo
white dwarf gets `haloLeft = to`; event `cast_out`). An ejected system has no close passes, and
an ember there dims (B.2.3). Any ejected halo dwarf without `haloLeft` gets `haloLeft = from` at
the start of its loop (so a system ejected by other means, including a sealed story mechanic,
starts dimming the turn after). The Heart also gains `4.6e10 × min(1, L/5e20)` each such turn.
Brown-dwarf collisions taper with the bound galaxy (B.2.7).

### B.7 Late physics, by the fate of matter

`Fate` is `decay`, `stable` or `curvature`; an unknown fate is one draw at generation (`drawFate`:
< 0.5 decay, < 0.75 curvature, else stable). `fateKnown` (`fate.ts`): chosen at the start, or the
Proton Question researched, or `civ.flags.fate_known`, or past the Degenerate Age. **Until known,
nothing reads differently by fate**: decay warmth (`decayWarmth`) and curvature warmth
(`curvatureWarmth`) are 0. At η ≥ `FATE_SHOWN_AT` 30 the neutron stars show it (`revealFate`, turn
step 9: events `decay_shown`, `curvature_shown`; if stable, the Last Warmth itself shows it).
Bend: the warmth would really show from about η 25 (decay) or 29 (curvature).

| | decay | stable | curvature |
|---|---|---|---|
| Degenerate Age ends (`DEGENERATE_END`) | η 39 (the Great Decay) | η 30 (the Last Warmth) | η 68 (the Last Warmth: neutron stars burst) |
| Matter gone (`MATTER_END`) | η 39 | never | η 89.5 (the Great Evaporation) |
| Long Flow at η 65 | no | yes | yes, until 89.5 |
| Positronium news at η 85 | yes | no | yes |

**Proton decay** (lifetime near 10^37 years in the game; experiments give only a lower bound
near 10^34). `decayWarmth(state, years)` = 0 unless decay and known, else `clamp((39 − η)/1.5, 0,
1)`. Temperatures add `DECAY_K × decayWarmth^¼`: white dwarf 0.05 K (about 400 W), neutron star
1.5 K, brown dwarf 9 mK, world 3 mK. The Decay Harvester mode rises from η 30 (B.4). From e >
37.5 (Degenerate calendar), each system that is not a hole and not gone dissolves with chance
`min(1, (e − 37.5)/1.5)` (primary `void`, every body but the Deep dissolved; note `dissolved`:
settlements without a decay-proof structure are destroyed, their people counted into
`flags.decay_lost` for the crossing).

**Stable matter.** Nothing dissolves. The crossing at η 30 renames white dwarfs black; dead stars
and worlds remain, as cold as the sky. Iron stars (10^1500 years) and tunnelling collapse
(10^(10^26) to 10^(10^76)) are only milestones on the deep-time ruler (Dyson 1979).

**Curvature radiation** (Falcke, Wondrak & van Suijlekom 2024/2025, arXiv:2410.14734, JCAP 05,
023: τ ≈ 3.4×10^68 yr × (ρ / 3.3×10^14 g cm⁻³)^-3/2; theoretical and disputed). Glow:
`curvatureK(M kg, R m, lifeEta) = 1.17 × (M c² / (10^lifeEta × 3.156e7 s) / (4π R² σ))^¼`, the
×1.17 fitted to their 25 nK (neutron star, 1.44 M☉, 12.8 km) and 5.5 pK (1.3 M☉ white dwarf). Neutron
stars use the fixed `CURVATURE_NEUTRON_K` 3×10^-8 K; white dwarfs `curvatureK(m, dwarfRadius,
dwarfFadeEta(m))`; brown dwarfs `(m, 0.1 R☉, 87)`; worlds `worldCurvatureK(b)` with life 89.5 and
radius 7×10^7 m (gas giant), 2.5×10^7 (ice giant), 6.371×10^6 × max(0.01, M)^0.27 (rock and ice);
a belt as `(1.3e21 kg, 5e5 m)`. Shown only, never gathered (`sourceLight` passes no curvature for
dwarfs; the neutron star's goes to the Curvature Collector mode).
- `dwarfFadeEta(m) = clamp(82 − 10 log10(max(0.1, m)/0.6), 78, 85)`; `BROWN_FADE_ETA` 87. Each turn
  with `e ≥ at`, a white, black or brown dwarf's system goes through `evaporateHole` (primary
  `void`, worlds rogue, settlements stay; note `faded`). A dwarf grows less dense as it shrinks, so
  the game has it fade rather than burst (a bend).
- At η 68, the crossing bursts every neutron star (B.9). At η 89.5 `greatEvaporation` (B.9).

**The Long Flow** (`flow.ts`, Dyson 1979: an atom tunnels out of place in about e^S × 10^-14 s,
S ≈ 27√A, 10^65 years for iron). `flowAhead`: not decay, matter not gone, not yet come. At `eta ≥
FLOW_ETA` 65 (`theLongFlow`, turn step 7, with this turn's end η): `flags.flowed = turn`; relics
not being dug by someone awake are `flowed`; event `long_flow`. Then each turn every settlement
whose `keeping` is `'unmanned'` (no Kin or Lattice, and no awake mind) loses one structure:
cheapest first, Cryo Halls last (sleepers beyond the remaining cryo room lost), never a
`decayProof` one; a settlement left empty is destroyed. `'watched'` (only minds whose strained
clock is ≥ 65): upkeep ×`FLOW_WATCH` 1.5; dormant upkeep 0.3 instead of 0.1 (`FLOW_DORMANT`).
Bend: by the same formula carbon flows after 10^19 years, oxygen 10^25, silicon 10^40; the game
takes iron's date.

**Positronium** (`POSITRONIUM_ETA` 85, Page & McKee 1981): where matter decayed or was unmade,
electron–positron pairs form atoms wider than today's observable universe, decaying near η 141.
News only: `positronium_forms` is queued in the Black Hole Age once η ≥ 85 and the fate is not
stable, after the random event roll so it never changes what the roll draws. Bend: with dark
energy like ours positronium may never form (Chiba & Sugiyama 2004).

### B.8 Order of evaluation in a turn

The physics in `turn.ts: endTurn` (full pipeline in section A):

- **Before step 1**: `turnStep` sets the coming turn (Tide × pace, cut at a flare's start,
  pinned to a flare or star clock). The economy (step 1) reads `sourceLight` at the turn's
  *start* year with this length, and Halo Siphons as they run at the turn's start.
- **Step 4**: `scorchWorlds(years, step.years)`, then `declineWorlds`.
- **Step 7**: if siphons ran as the turn began, `drainHalo`; then `evolveUniverse(state, from,
  to, rand)` (its calendar age read from the turn's start, `e = log10(to)`), `handleNotes`, the
  Last Star's lighting (sealed), `theLongFlow`, Dark-Era Continuity loss. Then `years`, `eta`,
  `turnLength`, `turn` advance; a settled star whose `blueAt` equals the new year queues
  `last_flare`; flare flags clear; `clearStarClock`.
- **Step 8**: signals, scripted events, the random event, positronium, `updateForecasts`.
- **Step 9**: `revealFate` at η 30; `ageOver` → `runCrossing`; else `calendarTurnDue` → the
  calendar jumps to 10^40 years; curvature at η ≥ 89.5 → `greatEvaporation`; in the Black Hole
  Age, if no hole is left, the endings are checked and the Last Horizon runs early.

**Inside `evolveUniverse`**, random draws in this exact order (seeds depend on it). For each
system in `Object.values(state.systems)` order, skipping `gone`: the cast-out fix-up; red → blue;
blue → white (`rand()` for `halo`); record a shining new star; Last Star burnout; new-star burnout
(`rand()` only if a helium star's mass < 0.9); the black-dwarf rename; feeding sums and plunges;
then per world: the close-pass draw (if eligible; a stripped world skips the rest), then for
inspiral one `rand()` for the model and, if not a Jupiter, one for `tau`; then boiling. After the
loop, in the Degenerate calendar: `rand()` for a collision (always drawn), and on a hit `rand()`
for the pick, one discarded, one for `diesAt`; `rand()` for a merger (always), and on a hit the
pick, one discarded, the supernova draw, then mass and life; evaporation draws per eligible system
(and the Heart draw on a hit); proton-decay draws per eligible system. Then, in the Black Hole or
Dark calendar, hole evaporations; then curvature fading.

### B.9 Crossings (`sim/crossing.ts: runCrossing`)

Each age's protocols tech (`last_light_protocols`, `great_decay_protocols`,
`last_horizon_protocols`) sets `crossingMult` (its `effects.crossing`, which halves losses; 1
without). All draws inside `withRng`.

- **The Last Light** (Dusk → Degenerate): every red and blue dwarf becomes a white dwarf, `halo
  = rng.chance(0.6)`, `whiteAt = years` (mass unchanged). Preparation `prep = 0.4 × min(1,
  energy/220) + 0.35 × (share of settlements with a starless source: a Geothermal Tap on core heat
  > 0.1, or a Fusion Plant, Accretion Engine or Pulsar Brake) + 0.25 × min(1, cryo room / Kin)`.
  Per settlement: Kin lose `round(kin × (1 − prep) × 0.7 × mult)`, Echoes then Chorus `round(… ×
  0.25 × mult)`, Lattice `round(… × 0.15 × mult)`; cold sleepers halved if `prep < 0.15`; the
  world's vitality −0.5. Swarms ×0.7; neighbours' health −0.6 (garden), −0.15 (dormant), −0.35
  (others); energy ×0.6. The calendar jumps to 10^15 years.
- **The Great Decay** (decay, η 39): `endOfMatter(…, 'decayed')`: every system but the holes is
  `void` and `gone`, every body but the Deep dissolved (a Last Star clock ends). Settlements with
  a `decayProof` structure keep only those structures, lose all Kin and sleepers and
  `round(lattice × 0.5 × mult)` Lattice; others are destroyed, but with the protocols 35% (floor)
  of their Echoes, Coldminds and Chorus move to the capital (or first) decay-proof settlement.
  Pops are cut to capacity; `decay_lost` is added to the toll; the settlements left go through
  `migrateToBlackHoles` (each to the nearest hole's Deep, merging there; one already in a hole's
  Deep stays; a Penrose Harvester added if known); matter 0;
  swarms survive only at holes, with chance 0.4, at 0.2 size; neighbours of the garden and fork
  ways fade, the rest lose 0.45 health; `matter_gone` set. Energy ×0.6; the calendar jumps to
  10^40.
- **The Last Warmth** (stable at η 30; curvature at η 68): under curvature `burstNeutronStars`
  first; every white dwarf is named black; Kin beyond capacity lose `round((kin − room) × 0.6 ×
  mult)`; neighbours −0.25 health; `energy = 0.6 × energy + caught`. Years and Tide are kept.
- **Neutron stars burst** (`burstNeutronStars`): every `neutron_star` (even ejected), at a tenth of a
  Sun, some 10^42 J. Settlements there `inItsSystem` (the Deep or a bound world) are destroyed; on
  a world flung loose long before they are far away and safe. The primary becomes `void`, its
  worlds rogue. Burst Catchers elsewhere (not in a bursting or ejected system, not on a rogue
  world) bank, once each, `n × max over non-ejected bursting stars of burstShare(ly)`, with
  `burstShare(ly) = round(250 × min(1, (10 / ly)²))` (250 within `NEAR_BURST_LY` 10 ly, about 63
  at 20, 10 at 50; the player's choice, "By distance").
- **The Great Evaporation** (curvature, η ≥ 89.5, inside the Black Hole Age): `endOfMatter(…,
  'evaporated')` with the Degenerate protocols, energy ×0.6, its own report.
- **The Last Horizon** (Black Hole → Dark, at η 100 or when no hole is left): endings are checked
  first (sealed section); every hole `evaporateHole`; `prep = min(1, energy / max(200, 0.5 ×
  storage))`, `continuity = round(100 − 50 × (1 − prep) × mult)`; Kin go to cold sleep unless a
  Garden Ark stands; neighbours −0.4 health; energy `× (1 − 0.15 × mult)`; years 10^100.

### B.10 The forecast (`sim/forecast.ts: updateForecasts`)

Rebuilt each turn (after events, and again after a crossing or reveal), sorted by `dueYears`.
`horizon` = 60 turns in the Dusk, 40 after; `tideTurnsTo` counts turns at the Tide (in the Dusk
as they will really fall, with flare stops, via `flare.ts: turnsUntilYears`; later `turnsUntil`
on the calendar's Tide, the Dark using the Black Hole Age's). The panel shows `forecastTurns =
turnsUntilYears(dueYears, pace 0)`.

| Kind | When shown | Due |
|---|---|---|
| `star` | a settled star's `nextStellarChange` (blue, white, burnout, evaporation; not holes in the Black Hole Age) within the horizon | the change |
| `inspiral` | one of our worlds (not feeding, rogue or dissolved) around a white dwarf, black dwarf or neutron star, or any after the Dusk, with `inspiralAt` ahead, within the horizon ("the models disagree"). The code does not exclude `NEVER_FEED` primaries here, so after the Dusk a world of a brown dwarf or hole can be warned of and never fall | `inspiralAt` |
| `boil` | one of our worlds `boilingAway` | this turn's end |
| `crossing` | the Degenerate Age's end: unknown fate at η 30, the earliest it could be, naming all three; else by fate. Other ages: η 14, η 100 | as stated |
| `evaporation_all`, `burst`, `fade` | curvature, known: η 89.5; each settled neutron star (η 68; "safe" if our settlements there are on rogue worlds) or dwarf (`dwarfFadeEta`, 87) | as stated |
| `flow`, `flowing` | the Long Flow ahead and known; settlements that will flow (within 10 turns of it, or flowing now) | 10^65, or this turn's end |
| `evaporation` | Degenerate, η < 18.4 | 10^18.4 |
| `embers` | halo η < 22 | `haloReachesYears(22)` |
| `decay` | decay known, η < 37.5 | 10^37.5 |
| `evaporate` | each settled hole in the Black Hole Age | `evaporateAt` |
| `gfe` | gfe < 0.92, or falling more than 0.002 a turn | — |
| `hunger` | a swarm heading for a settled system | — |

The texts follow the rules above (for example, a red dwarf about to flare: "For a few billion
years it will be over a hundred times brighter, hot enough to boil the seas of its worlds"; the
code's flare is 4 to 80 times). Severities: boon, info, warn, danger.

### B.11 What a place is worth (`sim/sites.ts`, `sim/homes.ts`)

`powerParts(state, b)`: the Hearth plus every buildable energy structure at its `max` count, at
the Tide (`turnStep(state, 0)`), by the rules of B.4 (`hawking` by `hawkingLight`, `spin` its
full amount while any spin is left). `matterAt`: Σ `(matterYield × richness + hydrogenYield ×
hydrogen + lift) × max`, × `(0.4 + 0.6 gfe)`. `lastsUntil(b)`: 0 dissolved, `feeding.start` if
feeding, ∞ rogue, `evaporateAt` at a hole, ∞ at a `NEVER_FEED` primary, else `inspiralAt`.
`siteValue` scores a world per Thread: Kin by room × 10 + habitability × vitality; Echoes and
Chorus by power; the Lattice by matter + 0.1 × power; Coldminds by `log10(years left)` (400 if
never) − mean K / 10^4; −1 if it boils away this turn. `homes.ts: survivorWorld` (never stored):
a neighbour of the garden way lives on its best `habitability × vitality × 10 + habitability`
world, the dormant way on the warmest core, every other way in the Deep (else the heaviest
world), rocky worlds first, never one of ours.

### B.12 Where the game bends physics

| Bend | Real figure | Where |
|---|---|---|
| A flare is a step at `blueAt`; `blueAt` log-uniform whatever the mass, so about 40% of red dwarfs flare in the Dusk's first 10 Gyr | a slow rise over the last trillion years; about 0.1%, heaviest first | DESIGN §11 |
| Collectors get 3× a red dwarf's light in a flare | 4 to 80× | `sourceLight` |
| Light factors normalised per age ("Dyson scaling") | ember 4×10^-12 L☉ vs red dwarf 10^-3 | `lightUnitSuns` |
| Core heat kept through the Dusk, then ×0.8 a turn | gone long before | `declineWorlds` |
| Halo Siphons double the whole halo's fall | a few dozen embers could not move it | Codex |
| A cast-out ember dims from the moment it is cast out | dimming starts a little before | Codex |
| Every new star lights as its turn ends; a flash past η 18.1 lived in full though the turn outlasts the star | any moment in the turn | Manual, `sourceLight` |
| Collision and merger rates ×10^8 per object | about 100 collision stars per galaxy | DESIGN §11 |
| One helium star: 42,000 K, 30 L☉, 0.8 to 3×10^8 yr (fits 0.5 M☉); giant 1,000 L☉ | a 1 M☉ one ten times brighter; R CrB stars about 10^4 L☉; C/O pairs need not ignite helium | DESIGN §11 |
| Gas and ice giants spared by a helium star's ultraviolet; worlds that only steam keep their water | they would lose gas and water | `boilsUnder` |
| A hole's disk drops in a step at the Last Light | the gas thins over ages | DESIGN §11 |
| The runaway at 1.4× Earth's sunlight (the player's) | 1.06 to 1.1 | `RUNAWAY_K` |
| Decay and curvature warmth hidden until the fate is known | visible from about η 25 / 29 | Codex |
| A white dwarf fades under curvature; one date for every world (89.5), brown dwarfs 87 | their homogeneous model bursts, accelerating | DESIGN §11 |
| White-dwarf radius ∝ M^-1/3 (too large for the heaviest: 3.1 pK at 1.3 M☉, not 5.5) | | `dwarfRadius` |
| Brown-dwarf fit extrapolated past 10 Gyr (an upper bound) | | `brownCoolingK` |
| Neutron-star cooling constant 7×10^6 | 1.2 to 3.9×10^6 | `RESIDUAL` |
| Iron's tunnelling date for all solids | carbon 10^19, oxygen 10^25, silicon 10^40 | Codex |
| Positronium forms | may never, with dark energy | Codex |
| A dark star at the end of time, and its lifetime (sealed section) | speculation; no physics to ask | Codex |
| The neutron-star burst's share to catchers, and its sparing of neighbours | its light content unknown | Codex |
| Terraforming: volatiles brought in, done in a few turns | Mars lacks the CO₂ | DESIGN §7 |
| Inspiral and accretion figures from unreviewed notes, kept as model uncertainty | | Codex |

### B.13 Sources cited

Adams & Laughlin 1997 (Rev. Mod. Phys. 69, 337); Adams, Laughlin & Graves 2004; Laughlin,
Bodenheimer & Adams 1997 (ApJ 482, 420); Mestel 1952 (MNRAS 112, 583); Althaus et al. 2010 (A&A
Rev. 18, 471); Burrows et al. 2001 (Rev. Mod. Phys. 73, 719); Baryakhtar et al. 2017; Kasting
1988; Kopparapu et al. 2013; Leconte et al. 2013 (Nature 504, 268; A&A 554, A69); Menou 2013 (ApJ
774, 51); Yang, Cowan & Abbot 2013; Selsis et al. 2023 (Nature 620, 287); Luger & Barnes 2015;
Léger et al. 2004; Vasavada, Paige & Wood 1999; Takai et al. 2008; Pierrehumbert 2011 (ApJL 726,
L8); Lobo et al. 2023 (ApJ 945, 161); Joshi, Haberle & Reynolds 1997 (Icarus 129); McKay, Toon &
Kasting 1991; Zubrin & McKay 1993; Jakosky & Edwards 2018; Cassan et al. 2012 (Nature 481, 167);
Suzuki et al. 2016 (ApJ 833, 145); Han et al. 2013 (ApJL 778, L38); Eddington 1926; Landauer
1961; Dyson 1979 (Rev. Mod. Phys. 51, 447); Falcke, Wondrak & van Suijlekom (arXiv:2410.14734;
JCAP 05, 023, 2025); Page & McKee 1981; Chiba & Sugiyama 2004 (astro-ph/0405273); Spolyar, Freese &
Gondolo 2008 (PRL 100, 051101); Krauss & Scherrer 2007; Krauss & Starkman 2000; Andreassen, Frost &
Schwartz 2018; Dyson, Kleban & Susskind 2002.

## C. The civilization

This part covers everything the player's civilization owns and does: its stocks and flows, its
settlements, its five kinds of people (Threads), its society and laws, research, buildings,
ships, Great Works, beacons, every player action, and how modifiers combine. Source of truth:
commit `4b92446`, `src/game/sim/*` and `src/game/data/*`. Row-by-row data (structures, techs,
ships, works, charters, threads, demands) is in the appendix tables; this part explains every
field and the formulas that read them.

Material about the stranger minds, the endings and the Lattice's story is kept out of this file
and lives in the sealed section. Where a rule here has a sealed branch, the text says "(sealed)" and
nothing more. The `ending`, `path` and `epilogue` fields of `WORKS`, and `DARK_ENDING` /
`ENDURANCE_ENDING`, are sealed material (S.4, S.8).

### C.1 Conventions

* **State.** The civilization is `GameState.civ` (`types.ts: Civ`). Settlements are
  `GameState.colonies` (`Colony`), fleets `GameState.fleets` (`Fleet`). Everything is plain
  JSON. Small counters live in `civ.flags: Record<string, number>`, and many rules below read or
  write named flags there.
* **Stocks and flows.** Energy, matter, accord, resolve, dissent, standing, taint and continuity
  are stocks on `civ`. Industry and insight are flows: they are made and used within the turn and
  never stored as a stock. The exceptions are progress in the build queue, research progress
  (`civ.research`), Work progress (`civ.works`) and the stored insight bank
  (`civ.flags.insight_bank`).
* **The lived share `pf`.** Each turn has a context `TurnContext { years, L, logL, paceFactor,
  mods }` (`sim/economy.ts`). `L` is the turn's length in years; `logL = log10(max(1, L))` (in
  deep time, where `L` is Infinity, `logL` is the end η: `eras.ts: logTurnLength`).
  `paceFactor` (written `pf` below) is `flare.ts: livedShare`. It is the share of a Tide turn
  that this turn lives, normally `10^-pace`: 0.1 when quickened ×10, 10 when slowed ×10. There
  are special cases: 1 on a turn that keeps time with a flare, `1/split` while keeping time with
  a new star, and at most 1 on a turn cut short by the start of a flare (see the time section).
  **Energy and matter scale with `pf`. Industry, insight and accord do not:** they count per
  decision, not per year. The Tide's own growth in turn length never multiplies yields directly,
  because light is given era-normalised (physics section, `sourceLight`).
* **Order.** All settlement loops use `Object.values(state.colonies)`, which is insertion order
  (the order the settlements were founded). This order matters for fusion fuel and for
  starvation ties.

### C.2 Resources

| Resource | Where | Range | Made by | Spent / lost by |
|---|---|---|---|---|
| Energy (the **reserve**) | `civ.energy` | 0 … reserve capacity, clipped each turn | collectors, Hearths, spare work, joint income, events, aid | upkeep, research draw, beacons, launches, construction once matter is gone, conversions, Work starts, rushes, dismantling, taming |
| Matter | `civ.matter` | ≥ 0 (floor applied at the starvation step) | mines, skimmers, lifters, Recycle, salvage (swarm kills ×2), refunds, events, charters | construction (paid up front), fuel for fusion and accretion, Kin and Lattice upkeep, Lattice growth (3 each), rushes |
| Industry | flow per settlement | — | Threads, Shipyard, Foundry | the settlement's own build queue; any left over goes to spare work |
| Insight | flow, civ-wide | — | Threads, Archive Spires, Relic Excavations, Study | research, Great Works, the insight bank |
| Accord | `civ.accord` | 0 … 999 | Threads, Commons, +0.25 per settlement with The Long Record | charters (enact and repeal), Rally/Calm/Hear, pacts, war (60) |
| Resolve | `civ.resolve` | 0 … 100 | society drift, Commons, Morale spare work, Rally, events | starvation, deaths, unmet demands, taint, charters |
| Dissent | `civ.dissent` | 0 … 100 | low standing, starvation, taint, charters, repeals (+3), rushes (+1.5) | natural decay, Calm, forks (−25) |
| Standing (per Thread) | `civ.standing[t]` | 0 … 100 | met demands, charters, Hear | unmet demands, tempo strain, Lattice share, taint |
| Taint | `civ.taint` | 0 … 100 | dark charters, Hunger techs, absorbing swarms, some neighbour actions | never falls in this domain (events may lower it) |
| Continuity | `civ.continuity` | 0 … 100 | set at the crossing into the Dark; some events | decays each Dark Era turn |
| People | `colony.pops[t]`, `colony.cryo`, `civ.flags.echo_archive` | integers | growth, conversions, settling, events, refugees | starvation, over-capacity, crossings, swarms, forks |
| Galactic free energy | `state.gfe` (shared) | 0.05 … 1 (starts at 1) | rarely restored (sealed event) | overdrive, Stellar Lifters, Salvage/Consume the Dead, the Hunger, devouring |

**Starting values** (`gen.ts: makeCiv`, `newGame.ts`): energy 60, matter 120, accord 15,
resolve 62, dissent 12, every standing 60, `lowStanding` 0, continuity 100, taint 0, pace 0, no
techs, no charters. The homeworld settlement has 8 Kin and `{ solar_array: 1, geothermal_tap: 1,
mine: 2, archive_spire: 1, shipyard: 1, commons: 1 }`. The home system starts with three fleets:
probes "Pathfinder" and "Lamplighter", and a Warden "Vigil" with order `hold`.

**Reserve capacity** (`sim/storage.ts: reserveCapacity`):
`cap = (100 + Σ over settlements and structures (reserveCap + burstCap) × count) × mods.reserveMult`.
A structure is skipped if it stores its charge in a black hole that is no longer there
(`storesInHole`: every one of its `primaries` is a hole, and the system's primary is not a hole
any more; this is the Horizon Vault), or if it was left behind by a rogue world (`leftBehind`,
C.5.8). Energy above the cap at the clip step is wasted (`TurnResult.wasted`). The cap is
written to `civ.flags.reserve_cap` every turn, and one demand reads it.

**Galactic free energy** scales matter yields (`gfeMatter = 0.4 + 0.6 × gfe`) and, in physics,
most light. It is lowered by: an overdriven settlement, −0.0002 a turn each; Stellar Lifters,
−`gfeDrain × count × pf` (0.0015 each); the first enactment of Salvage the Dead or Consume the
Dead, −0.01; the Hunger and devouring a neighbour (other sections). Its floor is 0.05.

### C.3 The turn's economy, in order

`sim/turn.ts: endTurn` runs these steps. The civ-facing ones are given in full; the others are
named and belong to other sections.

**0. Setup.** `mods = computeMods(state)` (C.13). `civ.pace` is clamped to
`[paceMin, paceMax]`. `siphoning = siphonsRunning(state)` is fixed for the turn. Long Sleep: if
`sleepTurns > 0`, set `dormant = true` and decrement it. When it reaches 0, set
`dormant = false` and `wakeBonus = 2` with The Long Watch, else 1. The step is
`turnStep(state)`, and `ctx` is built from it.

**1. Economy.** `matterAvail = civ.matter`. For each settlement in order:
1. `t = colonyTurn(state, c, ctx, matterAvail)` (C.4), then `matterAvail −= t.matterBurn`, and
   `c.last = t.y` (the breakdown the panel shows).
2. Sums: `eIn += y.energy`, `eOut += y.energyUpkeep`, `mIn += y.matter`,
   `mOut += y.matterUpkeep` (fuel burned included), `insight += y.insight`,
   `accord += y.accord`. The settlement's net is `net[c] = y.energy − y.energyUpkeep`.
3. The star's spin reservoir: `primary.spin −= t.spinDraw` (floor 0).
4. Depletion: `body.richness = max(0.05, richness − depletion × 0.0006)` and
   `body.hydrogen = max(0, hydrogen − depletion × 0.0004)`, where `depletion` is the matter raised
   by its mines and skimmers this turn.
5. Overdrive: an overdriven settlement takes `damage = min(1, damage + 0.04)` and gfe −0.0002.
   Otherwise `damage = max(0, damage − 0.02)`.
6. Structures with `gfeDrain` (and not left behind) take gfe −`gfeDrain × n × pf`.
7. `insight += applyIndustry(state, c, y.industry, y.energy)`: the build queue, then spare work
   (C.5.6). Spare matter, energy and resolve go **straight into the stocks here**, so they are
   not part of `eIn`. Spare insight joins the turn's insight.

Then, for the whole civilization:
* `eIn += jointIncome(state) × pf`: +6 per living neighbour at peace with a joint project
  (`civ.flags.joint_<id>`).
* `eOut += researchDraw = insight × 0.02` while a project or a Great Work is chosen, else 0. This
  insight includes spare Study.
* `accord −= latticeAlienation` (C.6.6).
* `civ.energy += eIn − eOut`.
* Beacons are fed (C.11), each paying `3 × pf` in system order. One that cannot be paid goes
  dark.
* `civ.matter += mIn − mOut`, and `civ.accord = clamp(civ.accord + accord, 0, 999)`.
* Clip energy to the reserve capacity (the excess is wasted).
* Flags for the interface: `last_energy_net = eIn − eOut − beacons`,
  `last_matter_net = mIn − mOut`, `last_insight`, `last_accord`.
* Overdrive accidents (random): for each overdriven settlement with `damage > 0.5`, with chance
  `damage × 0.25`, one structure that has an `energy` field, picked at random, is destroyed, and
  then `damage ×= 0.5`.

**2. Starvation.** If `civ.energy < 0`: the civilization is starving. Set energy to 0. Take the
settlements with `net < 0`, sorted from most negative to least, and act on at most three of
them. Each gets `starving++`. If it has Kin, one Kin is lost: under the Cold Sleep Lottery, with
a free cryo berth, the Kin goes to Cold Sleep instead. A Kin who dies counts toward `popsLost`,
and under Upload at Death, with free Echo room and a 50% roll, becomes an Echo. If it has no Kin
and `starving` is even, one mind is lost, in the order Echo, then Chorus, then Coldmind. The
Lattice never starves for energy. If energy is not negative, every settlement's `starving` is
reset to 0. Then, if `civ.matter < 0`: set it to 0, and the first settlement with a Lattice loses
one ("wore out").

**3. Research and Works** (C.8 and C.12).

**4. Worlds and people.** Scorching by flares and the slow decline of worlds come first
(physics section; their effects on settlements are in C.5.8). Then `wakeArchivedEchoes` (C.12.1).
Then growth and capacity for each settlement (C.5.3). An empty settlement (no people, no cryo,
no structures) is destroyed as "abandoned".

**5. Society.** If `popsLost > 0` under Consume the Dead: matter `+4 × popsLost`. Then
`updateSociety(state, logL, popsLost, starving)` (C.7), then `coolAccord` (C.7.5). If
`wakeBonus > 0` and not dormant, `wakeBonus−−`.

**6. Fleets, hazards, other minds:** `advanceFleets`, `surveyWhereStationed`,
`updateDetection`, `firstSwarm`, `swarmsHunt`, `autoExplore`, `updateHunger`,
`updateSurvivors`, `pactsTurn`, `warTurn`, `updateMinds`, in that order.

**7. The universe moves on:** halo draining, `evolveUniverse` and its notes (C.5.8), a sealed
step, `theLongFlow` (C.5.9). Then the Dark Era's continuity loss: if
the calendar age is `dark`, `decay = 2.2 × Π(continuityMult^n)` over all structures (each
Error-Correction Array ×0.6), ×0.35 if dormant, +5 if starving this turn, and
`continuity = max(0, continuity − decay)`. Then the clock advances: years, η, turnLength,
`turn++`, `eraTurn++`.

**8. Signals and events.** An arriving `aid_answer` adds its energy. A `last` signal (a
neighbour's final archive) adds its insight to the bank, plus that much matter under Consume the
Dead, or half under Salvage the Dead. Then scripted events (turn 3 `dynamo_fails`, turn 7
`first_night`), the random roll and forecasts. **9. Crossings** (ages section).
**10.** The ending check (sealed); one entry each to `stats.pops/energy/resolve` (the last 500
are kept); a lost capital is replaced by the most populous settlement.

**Worked example: turn 1 at the default start** (pace 0, `pf = 1`, `L = 40` years,
`logL = 1.602`; Kin strain is negligible, `m = 0.002`). Resolve 62 and dissent 12 give morale
`0.7 + 0.6 × 0.62 = 1.072`.
* 8 Kin: industry 8.58, insight 6.86, accord 2.57, energy upkeep 8.0, matter upkeep 0.8.
* Solar Array: `4 × light 1.0 × insolation 1.0` = 4.0. Geothermal Tap: `7 × coreHeat 0.8` = 5.6.
* 2 Mines: `3 × 2 × richness 1.0 × gfeMatter 1.0` = 6 matter.
* Archive Spire 3 × 1.072 = 3.22 insight. Shipyard 1.07 industry. Commons 1.07 accord.
* Hearth: `2 × max(min(1.5, 1.0), 0.8 × 0.8) = 2.0`.
* Totals: energy 11.6 in, 8.0 out (net +3.6, minus 0.2 research draw if a project is chosen);
  matter +5.2; industry 9.65; insight 10.08; accord 3.64.

`sim/projection.ts: project(state, pace?)` repeats this computation without changing anything,
adding joint income × `pf`, beacon upkeep × `pf`, the research draw, Lattice alienation and each
Thread's strain (the HUD and pace buttons use it). `structureEffect` runs `colonyTurn` with and
without one more of a structure, and lists its other effects as notes.

### C.4 A settlement's turn: `colonyTurn`

`sim/economy.ts: colonyTurn(state, c, ctx, matterAvailable)` returns
`{ y: YieldBreakdown, spinDraw, matterBurn, strain, depletion }`. It does not change the state.

**Multipliers set up first:**
* `morale = clamp((0.7 + 0.6 × resolve/100) × (1 − max(0, dissent − 40)/150), 0.3, 1.3)`
  (`moraleMultiplier`).
* `wake = 1.3` if `wakeBonus > 0`, else 1. `blackout = 0.9` under Blackout, else 1.
* `out = dormant ? 0 : morale × wake × blackout`. This scales what people and buildings do
  (industry, insight, accord), never energy or matter.
* `taintBoost = 1 + taint/200` (energy and matter only). `overdrive = 1.5` if the Hearth is
  overdriven (energy only).
* `light = sourceLight(state, sys, ctx.years, L)` (physics). `siphoned` is `light.dark` when the
  Halo Siphons run, the primary is a halo ember and the calendar age is Degenerate; else 0.
  `darkSky = light.light ≤ 0`.
* `upkeepScale`: 1 when awake. When dormant it is 0.05 under The Long Watch, else 0.3 once the
  Long Flow is running, else 0.1.
* `watch = 1.5` (`FLOW_WATCH`) when the flow is running and this settlement is `watched`
  (C.5.9), else 1. `slowTime = max(1, pf)`.

**Focus** (`focusMul`): `balanced` is ×1 everywhere. The chosen key gets ×1.25 for energy or
matter, ×1.3 for industry or insight, ×1.4 for accord. Every other key gets ×0.9, **except
matter**, which only its own focus touches (no −10% from the others).

**People.** For each Thread `t` with `n > 0` and its strain `s = strainFor(t, logL, mods,
log10(pf))` (C.6.3):
* `o = s.outMul × out`, ×1.15 for the Lattice under the Lattice Compact.
* industry `n × d.industry × o`, insight `n × d.insight × o`, accord `n × d.accord × o`.
* energy upkeep `n × d.energyUpkeep × s.upkeepMul × mods.upkeep[t] × upkeepScale × watch`,
  ×0.5 for Coldminds under a dark sky.
* matter upkeep `n × d.matterUpkeep × upkeepScale`. Strain and `pf` do not touch it, and it is
  charged even after matter is gone.

**Cold Sleep:** energy `cryo × 0.08 × slowTime`, ×0.5 under the Cold Sleep Lottery. Dormancy does
not reduce it.

**Structures.** For each `id` with count `n`, `away = leftBehind(state, c, d)`:

| `energy.mode` | gross `e` before the common factor (`a = amount × n`) |
|---|---|
| `light` | 0 if `notAt` has the primary kind. Otherwise `a × (light + siphoned)` (just `light` when not siphoned), 0 on a rogue world. Solar Arrays also × `insolation(body)` (0.05 … 2.5). (A sealed flag can give ×0.75 at halo embers.) |
| `geo` | `a × body.coreHeat` |
| `rekindle` | `a × primary.rekindle` |
| `fusion`, `accretion` | `want = input × n × pf`; `got = min(want, max(0, matterAvailable − matterBurn so far))`; `matterBurn += got`; `e = (got/want) × a` |
| `spin` | `draw = min(a × pf, spin left in this system's reservoir)`; `e = draw / pf` (so after the common ×`pf`, it equals `draw`) |
| `hawking` | `a × hawkingLight(primary, years)` (holes only, rising as they shrink, at most 25) |
| `decay` | protons decay, calendar Degenerate and η > 30: `a × clamp((η − 30)/6, 0.2, 1)`; else 0 |
| `curvature` | fate is curvature, the primary is a neutron star and η > 30: same ramp; else 0 |
| `siphon` | `a` in the Dark calendar age; else 0 |

Common factor, when `energy` is set and not `away`: `e ×= pf × overdrive × focusMul(energy) ×
taintBoost`. η here is that of the turn's start.

Matter: `mt = (matterYield × n × richness + hydrogenYield × n × hydrogen) × gfeMatter`, plus
`lift × n × gfeMatter` if not away. Then `mt ×= pf × taintBoost × (1.4 with Hunger Engines) ×
(1.25 with Matter focus)`. Mines and skimmers count toward `depletion` (the lift does not). `mt`
is added to matter only while matter is not gone.

People-like yields: industry `d.industry × n × out`; insight `d.insight × n × out` (0 for a
Relic Excavation whose ruin has flowed); accord `d.accord × n × out`.

Upkeep: `d.upkeep × n × upkeepScale × slowTime × occ`, ×0.5 for a Cold Vault under a dark sky.
For housing (`cap` or `cryoCap`), `occ = max(0.1, lived/room)`, where `room` sums the
settlement's **whole** capacity for each kind of people the building houses (Kin room includes
the world's own natural room), and `lived` sums `min(pops, capacity)` for those kinds. For any
other structure `occ = 1`. So housing costs upkeep only for the share that is lived in, never
less than a tenth.

A yield line is marked `idle` when the structure is away, or when it has an energy mode other
than fusion or accretion and made nothing ("nothing to gather").

**The Hearth** (every settlement, unless its body is dissolved):
`fed = max(min(1.5, light), coreHeat × 0.8, hole ? 1 : 0)`. On a rogue world `light` counts as 0.
`hole` means the primary is a black hole or the supermassive one, the world is not rogue, and the
calendar age is Degenerate or later. Then `hearth = 2 × max(0.25, fed) × (1 − damage) × pf ×
overdrive × focusMul(energy) × taintBoost`. Below `fed` 0.25 it runs on "stored fuel and
salvage": a floor, never nothing.

**Totals:** `industry ×= mods.industryMult × focusMul(industry)`,
`insight ×= mods.insightMult × focusMul(insight)`, `accord ×= focusMul(accord)`. Then, with
The Long Record's `charters` flag and not dormant, `accord += 0.25`. `matterUpkeep` includes
`matterBurn`.

### C.5 Settlements

#### C.5.1 The Colony record

`Colony { id, bodyId, systemId, name, founded, pops, growth, cryo, structures, queue, focus,
spare?, overdrive, damage, starving, flags_rushed?, last? }`. `pops` and `growth` are keyed by
Thread. `structures` maps a structure id to its count. `queue` holds at most 6 items
`{ uid, kind: 'structure'|'ship', key, progress, cost, paid? }`. `createColony(state, body,
pops)` (`fleets.ts`) makes one. Its name is the body's name, focus `balanced`, no structures. It
sets `body.colonyId`, marks the system surveyed (`known = 2`), clears the system's `gone` flag,
and makes it the capital if there is none. `destroyColony` clears the body link, deletes the
settlement, clears the capital if it was the capital, and logs "is lost".

#### C.5.2 Capacity

`capacity(state, c, mods)` gives room per Thread plus `cryo`:
* **Kin, natural room** (`kinBaseCapacity`). 0 if the body is dissolved, scorched by a flare, or
  frozen hard (its warmest ground below 195 K, never the Deep). Otherwise
  `base = round(12 × habitabilityOf(body))` (terraforming included, C.9.6). `vit` is the body's
  vitality, or `vitality^0.6` with Hardy Lineages. `cap = floor(base × vit)`. Abandon the Surface
  gives `cap ≥ floor(base × 0.6)`. A rogue or feeding world gives `floor(cap × 0.3)`. A frozen
  world thawed into warm sea by a flaring star has `cap ≥ 5` (`THAW_ROOM`).
* **Structures** add `cap[t] × count` to each Thread and `cryoCap × count` to cryo.
* Echoes, Chorus, Lattice and Coldminds have no natural room: substrate, nodes, foundries,
  vaults, leptonic substrate and Bastions only.

`naturalKinRoom(b, state)` (`fleets.ts`) is the same natural room for a world without a
settlement. Survey reports and site values use it.

#### C.5.3 Growth and over-capacity (step 4)

Accumulation happens only when not dormant and not starving this turn:
* Kin: if `0 < kin < cap.kin`, `growth.kin += 0.12 × (0.5 + 0.5 × vitality) × (0.4 under Child
  Quotas)`.
* Echoes: if `echoes < cap.echoes` and `civ.energy > 15`, `growth.echoes += 0.22`.
* Lattice: if `lattice < cap.lattice` and `civ.matter ≥ 4`, `growth.lattice += 0.35`.
* The Chorus and Coldminds never grow by themselves (only by conversion).

Then for every Thread, whether or not there was accumulation: if `growth ≥ 1`, subtract 1. A
Lattice point costs 3 matter and an Echo point 3 energy, paid even when there is no room. The
pop is added if `pops < cap` (or for Kin when Kin is 0). Then, if `pops > cap`, one is lost
(counted in `popsLost`). A Kin lost this way under the Cold Sleep Lottery, with a free berth,
goes to sleep instead. Finally, sleepers beyond cryo room all wake into Kin (which can put Kin
over capacity; the excess is lost one a turn after that). So **over-capacity costs at most one
of each Thread per settlement per turn.**

#### C.5.4 Hearth and overdrive

Every settlement has a Hearth (C.4). Under the **Overdrive Protocols** charter,
`toggleOverdrive` switches a settlement's Hearth to overdrive. Overdrive gives ×1.5 to all its
structures' energy and to its Hearth. In exchange: damage +0.04 a turn, which reduces the Hearth
by `(1 − damage)`; gfe −0.0002 a turn; signature +4; its world's decline ×1.3 (physics
`vitalityLoss`); the chance of accidents (C.3, step 1); and a broken Coldminds demand. Damage
heals at 0.02 a turn once overdrive is off. Repealing the charter turns every Hearth off
overdrive.

#### C.5.5 Focus

`setFocus(colony, focus)`, with the focus one of `balanced | energy | matter | industry |
insight | accord`. Multipliers as in C.4. Interface texts: Energy "+25%", Matter "matter raised by
mines, skimmers and lifters +25%", Industry and Insight "+30%", Accord "+40%". In each case the
others are −10%, and matter is never cut.

#### C.5.6 The build queue, and spare work for idle settlements

`applyIndustry(state, c, industry, energyMade)` (`turn.ts`):
1. `left = max(industry, 0.01 if queue[0].progress ≥ cost − 0.01 else 0)`. The 0.01 lets a
   rushed item finish even with no industry.
2. Up to 8 times while `left > 0` and the queue is not empty: put `min(cost − progress, left)`
   into the first item. If `progress ≥ cost − 1e-6`, it completes and leaves the queue.
   * A **structure** gets `count + 1`. Its once-only effects (`vitalityOnce`, which adds that
     much vitality up to 1; `coreHeatBonus`, which adds that much core heat up to 1; Atmosphere
     Works, which set water ≥ 0.1; a Confluence Node, which counts toward
     `chorus_nodes_built`) apply only if `civ.flags.dismantled_<colony>_<id>` is 0. If it is
     not 0, one is used up instead, so taking a building apart and rebuilding it never repeats
     its effect.
   * A **ship**: if it has a `crew`, that many Kin leave the settlement now (floor 0). It joins
     an idle, non-exploring fleet at that star whose ships are all of its class, unless it
     settles or surveys; otherwise it forms a new fleet named "`<Ship name> <n>`".
3. If industry is left over, the queue is empty and the civilization is awake, the leftover
   becomes **spare work** (`sim/spare.ts: spareYield`), chosen per settlement in `colony.spare`
   (absent means `salvage`):

| `spare` | Interface name | Yield per point of spare industry |
|---|---|---|
| `salvage` | Recycle | 0.1 matter; once matter is gone, 0.05 energy instead |
| `study` | Study | 0.1 insight (joins this turn's insight and research draw) |
| `tend` | Tend | 0.13 energy, at most `0.25 × max(0, energyMade)`, where `energyMade` is the settlement's gross energy this turn (Hearth and collectors) |
| `morale` | Morale | 0.01 resolve |

The rates are a tenth of what a building of that kind makes per point of industry it cost
(Mine 3 matter, Archive Spire 3 insight, Solar Arrays 4 energy, Commons 0.3 resolve). Choosing
one is about what you need, never a way to get more. Industry never carries over between turns,
except as progress on a queued item.

#### C.5.7 Upkeep, dormancy and pace

Buildings and sleepers pay `× slowTime`, so slowing ×10 makes them pay ten times ("only minds
can slow themselves down"); quickening never makes them cheaper. Dormant (`setDormant(true)` or
Long Sleep): no industry, insight or accord, but energy and matter still come in; upkeep falls to
`upkeepScale` (C.4) except Cold Sleep's; spare work, growth and the Long Record's accord stop.
`longSleep(turns)` needs Hibernation Protocols. It sets
`sleepTurns = clamp(round(turns), 1, 20)` and `dormant = true`. Each end of turn decrements it,
and the turn on which it reaches 0 is already awake, with the wake bonus (×1.3 output, for one
turn, or two with The Long Watch). So `longSleep(N)` gives N − 1 dormant turns and then a waking
turn. Waking by hand (`setDormant(false)`) gives no bonus.

#### C.5.8 The Deep, and when a world or settlement is lost

**The Deep.** Every system has a body of kind `deep` at orbit 0: the empty space around the
star, with richness 0, habitability 0 and core heat 0. Structures whose `bodies` include `deep`
are built *around the star* (`aroundTheStar`). Any settlement in the system can build them,
whatever its body (`structureCheck` skips the body test for them). `systemUnique` ones count
across all our settlements there. Settlers can live in the Deep itself. Kin need Orbital Industry
for that while the calendar age is the Dusk (`canSettle`); Seedcores "settle anywhere". A rogue
world (one flung loose from its star) has left everything around the star behind
(`leftBehind`). It cannot build such structures, and those it built give nothing, store nothing
and drain nothing.

**A living world dies** (`turn.ts: worldDies`, surface-life kinds `eyeball`, `terran` and
`super_earth` only). It becomes `ice` (habitability 0.05) if it was not scorched and its water is
≥ 0.1, else `barren` (habitability 0). Its vitality becomes 0 and it gets the trait `once_alive`.
Its natural Kin room is then 0, so Kin above dome or warren room are lost one a turn (C.5.3).
`declineWorlds` handles the slow decline (`vitalityLoss`: decline × the structures'
`declineMult`s × 1.3 if overdriven × Dusk acceleration; freezing at 5% a turn without a sun
unless Orbital Lamps are over it), seeded life, the homeworld's core heat (−0.007 a turn in the
Dusk, ×0.4 with a Core Stimulator), and after the Dusk every world's core heat (×0.8 a turn,
0 below 0.02). Details are in the physics section.

**Settlements are lost** by these means:
* **Abandoned:** no people, no sleepers and no structures (step 4).
* **Evacuated** when their world finishes falling into its star (`plunge`) or boils away or is
  swallowed (`boiled`): `evacuate` saves `floor(0.75 × pops[t])` of each Thread and
  `floor(0.75 × cryo)` into the system's Deep. A Deep settlement named "`<system> Deep`" is
  created there if there is none. Structures built around the star are copied with
  `max(count)`, and Substrate Cores `ceil(saved echoes / 4)` are given if there were none. Then
  the old settlement is destroyed. A plunge also pays 20 energy if we have a settlement in that
  system.
* **Destroyed outright:** a supernova in the system; a system swallowed by the Heart (only
  non-rogue settlements); a system whose matter dissolves (`dissolved`), unless the settlement
  has a `decayProof` structure; the swarms, when nothing is left (Hunger section); the crossings
  (ages section).
* **Flowed away** (C.5.9). **Forked away** (C.6.7).
* A black hole that evaporates leaves its settlements and all their structures, drifting with no
  source. A Horizon Vault there stores nothing, and Burst Catchers may catch the final burst
  (physics and ages sections).

#### C.5.9 The Long Flow (`sim/flow.ts`)

This applies only when matter lasts that long (fate stable or curvature, matter not yet gone).
When η at the end of a turn reaches `FLOW_ETA` 65, `civ.flags.flowed` is set to the turn. Every
relic not being worked by a Relic Excavation with someone awake becomes `flowed`, and the event
`long_flow` is queued. From then on, while `flowing`, each turn every settlement that `keeping()`
calls `unmanned` loses one structure (`nextToFlow`): the cheapest by industry cost, ties by id,
Cryo Halls last, `decayProof` ones never. Sleepers beyond the remaining berths die with a Cryo
Hall. The settlement is destroyed when it is empty. `keeping(c)`:
* `kept` if it has Kin or Lattice, or any Echo, Chorus or Coldmind whose effective clock
  (`strainFor(...).clock`) is below 65.
* `watched` if all its minds are slower than that. Their energy upkeep is then ×1.5.
* `unmanned` if no one is awake (only sleepers or nobody).

While the flow runs, dormancy's upkeep share is 0.3 instead of 0.1.

### C.6 Threads (`data/threads.ts`)

#### C.6.1 Fields

`ThreadDef { id, name, one, blurb, industry, insight, accord, energyUpkeep, matterUpkeep,
clockMin, clockMax: { fixed? | relative? }, strainImmune?, conscious }`. `industry`, `insight`
and `accord` are per pop per turn, before the multipliers. The two upkeep fields are per pop per
turn at the Tide. `clockMin` is the fastest clock (log10 years per subjective moment). `clockMax`
is either fixed, or `mods.echoMax + relative`, where `echoMax` is the "Echo limit" that research
raises. `strainImmune` means no tempo strain. `conscious` means the Thread has standing that
matters, demands, and can be Heard.

| Thread | ind | ins | acc | E upkeep | M upkeep | clock range | notes |
|---|---|---|---|---|---|---|---|
| Kin | 1.0 | 0.8 | 0.3 | 1.0 | 0.1 | 1.6 … 1.6 | conscious; natural room on living worlds |
| Echoes | 0.6 | 1.5 | 0.1 | 0.45 | 0 | 0 … echoMax | conscious |
| Chorus | 2.0 | 1.8 | 0.5 | 0.9 | 0 | 0.5 … echoMax − 1.5 | conscious |
| Lattice | 2.2 | 0 | 0 | 0.25 | 0.3 | (999) | strain-immune; **not** conscious: no demand, cannot be Heard, never forks |
| Coldminds | 0.2 | 1.0 | 0.15 | 0.08 | 0 | 4 … echoMax + 6 | conscious |

`clockRange` returns `[lo, max(lo, hi)]`. `echoMax` starts at 1.6 and becomes the highest
`echoMaxClock` of any known tech: 3.5, 7, 11, 16, 24, 32, 40, 60, 80, 100, and Infinity for
Asymptotic Mind.

#### C.6.2 Counting

`threadTotals` sums awake pops over the settlements (sleepers excluded). `totalPops` includes
sleepers. A Thread's **share** is `totals[t] / max(1, all awake)`.

#### C.6.3 Tempo strain (`sim/mods.ts: strainFor`)

For Thread `t` over a turn of `10^logL` years, with `slowOrders = log10(pf)` (positive when
slowed below the Tide):
* Strain-immune: `{ clock: logL, m: 0, outMul: 1, upkeepMul: 1 }`.
* `clock = clamp(logL, lo, hi)`; `m = clamp(logL − clock, −50, 50)`.
* `m > 0` (the age outruns the mind): `slow = max(0, slowOrders)`; `logTide = logL − slow`;
  `mTide = max(0, logTide − clamp(logTide, lo, hi))`; `unabsorbed = max(0, min(slow, m −
  mTide))`; `eraPart = m − unabsorbed`. Then `outMul = 1 + 0.05 × min(eraPart, 10)` and
  `upkeepMul = (1 + 0.3 × eraPart) × 10^unabsorbed`. Living through the Tide is gentle. Each
  order of magnitude of deliberate slowing that a mind cannot absorb costs the full tenfold.
* `m < 0` (the mind is faster than the turn): `outMul = max(0.15, 1 + 0.4m)` and
  `upkeepMul = max(0.3, 1 + 0.2m)`.

Examples:
* Echoes with Mind Substrate (`echoMax` 3.5) in a 10⁵-year Tide turn: `m = 1.5`, output ×1.075,
  upkeep ×1.45. Slowed ×10 (`logL` 6, `slow` 1): `m = 2.5`, `mTide = 1.5`, `unabsorbed = 1`,
  upkeep ×14.5. With Slow Instancing (`echoMax` 7) the same turn has no strain at all.
* Kin quickened ×10 at the start (`logL` 0.6): `m = −1`, output ×0.6, upkeep ×0.8.

Strain also costs standing (C.7.2). The Echoes' demand `echoes_clock` asks that their `m` stay
below 1.

#### C.6.4 Demands (`DEMANDS`, `society.ts: demandMet`)

`DemandDef { id, thread, text }`. Each conscious Thread with people has one demand at a time. A
demand is (re)picked with `rng.pick` among that Thread's demands (it may repeat) when there is
none, or when `civ.flags.demand_age_<t> > 14`. The age is then reset to 0. It is incremented
every turn just before the check, so a demand stands for 15 turns. Picking `chorus_grow` records
`chorus_nodes_at_demand = chorus_nodes_built`. Conditions:

| id | met when |
|---|---|
| `kin_homeworld` | Abandon the Surface is in force, or the `homeworld` body exists, is not dissolved and has vitality ≥ 0.25 |
| `kin_room` | every settlement has `kin ≤ cap.kin` |
| `kin_warmth` | every settlement has `starving === 0` |
| `echoes_substrate` | Σ over settlements of `(cap.echoes − echoes)` ≥ 2 |
| `echoes_stop` | The Right to Stop is in force |
| `echoes_clock` | Echo strain `m < 1` at the current pace |
| `chorus_consent` | Merge Consent is in force |
| `chorus_grow` | `chorus_nodes_built > chorus_nodes_at_demand` (a Confluence Node completed since; not after a rebuild) |
| `coldminds_quiet` | no Hearth is overdriven |
| `coldminds_reserve` | `energy ≥ reserve_cap / 3` |

A Thread with no people has its demand cleared. The Lattice never has one.

#### C.6.5 Conversions (`actions.ts: convert`)

| kind | needs | effect |
|---|---|---|
| `upload` | an Upload Clinic here, ≥ 1 Kin, free Echo room, 6 energy | −6 energy, Kin −1, Echo +1. Under Sanctity of Flesh, accord −4 (floor 0). Otherwise, unless Upload at Death is in force, Kin standing −0.7. |
| `merge` | a Confluence Node here, ≥ 2 Echoes, free Chorus room, 8 energy; under Merge Consent only one merge a turn (`civ.flags.merge_turn`) | −8 energy, Echoes −2, Chorus +1. Echo standing −1 unless Merge Consent; accord −4 under Sanctity of Flesh. |
| `cool` | a Cold Vault, Leptonic Substrate or Bastion Shell here, ≥ 1 Echo, free Coldmind room | Echo −1, Coldmind +1. Free. |
| `freeze` | ≥ 1 Kin, a free cryo berth | Kin −1, cryo +1 |
| `thaw` | ≥ 1 sleeper, Kin below capacity | cryo −1, Kin +1 |

Other ways people arrive: settling (C.10.5), Echoes from events through the archive (C.12.1),
refugees and returning forks (neighbours section), absorbing a tamed swarm (Lattice, C.11),
evacuation (C.5.8). The Lattice Foundry's `enables: 'lattice'` is a label only: Lattice come
from foundry growth, Spores and swarms, never from a conversion.

#### C.6.6 Lattice alienation

Each turn's accord is reduced by `0.125 × lattice × min(1, 2 × conscious / (lattice +
conscious))` (all settlements), unless the Lattice Compact is in force. Each Thread's standing
also falls by `2 × lattice share` a turn (C.7.2), again unless the Compact is in force.

#### C.6.7 Forks (`society.ts: fork`)

For each conscious Thread with at least 3 people: if `standing < 15` and `dissent > 45`,
`lowStanding[t]++`, else `lowStanding[t] = max(0, lowStanding[t] − 1)`. Threads with fewer than
3 people, and the Lattice, are reset to 0. At 3 it **forks**:
* Every settlement where that Thread has people and at least half the population (the capital
  excepted) leaves whole. Its body is freed and the settlement deleted, without `destroyColony`.
* Everywhere else the Thread loses `ceil(n/2)`.
* `lowStanding = 0`, `standing[t] = 45`, dissent −25, resolve −8.
* A new neighbour is created (`way: 'fork'`, `forkOf: t`). It is named The Returned (Kin), The
  Unmoored Echoes, The Other Choir or The Far Cold, with health 0.8, reserve 20, disposition −15
  and clock 2, in contact, with the memory "we left you". It lives in the systems it took, or, if
  it took none, at the nearest known star that no one lives at (`forkHome`, no random draw).
  Their behaviour after that is in the neighbours section.

### C.7 Society: resolve, dissent, accord and charters

#### C.7.1 What resolve and dissent do

Both feed `moraleMultiplier` (C.4), which scales all industry, insight and accord. With
resolve 100 and dissent ≤ 40 it is 1.3. With resolve 0 it is 0.7. Dissent above 40 removes
1/150 per point, down to the 0.3 floor. Some endings read resolve and continuity (sealed).

#### C.7.2 `updateSociety` (step 5; one `withRng` around it all)

**Standing**, for each conscious Thread with people, in this order:
1. Rotate the demand if due (C.6.4) and check it.
2. Met: `standing = min(80, standing + 1.2)`. Note that this pulls a standing above 80 down to
   80. Unmet: `standing −= 1.4 + 1.5 × share`.
3. Strain: if `m > 0.5`, `standing −= min(3, 0.35 m)`.
4. Thread Parity: `+= (55 − standing) × 0.05`. Sanctity of Flesh: Kin `+0.4`. Assembly of
   Threads (the tech; the code also accepts a charter id that does not exist):
   `+= (60 − standing) × 0.02`.
5. Without the Lattice Compact: `−= 2 × lattice share`. Always: `−= taint/60`.
6. Clamp to 0 … 100.

**Resolve:** `dr = −3 (if starving) − min(8, 40 × popsLost/population) × (0.6 under The Right to
Stop) − 0.5 × unmet + (1 if no demand is unmet and at least one is met) − 0.5 (Rationing) + 0.3 ×
Commons count (all settlements) − 1 (Dusk calendar, homeworld vitality < 0.2, no Abandon the
Surface) − taint/50`. `population` is `max(1, awake pops)`. Then
`resolve = clamp(resolve + dr + (50 − resolve) × h, 0, 100)`, where `h` is 0.03 in the Dusk and
0.05 later, +0.02 under Sanctity of Flesh while Kin are at least half the people. Because of the
pull toward 50, a steady `dr` moves the resting point by `dr/h`: Rationing's −0.5 settles about
17 points lower in the Dusk and 10 later, as its text says.

**Dissent:** `dd = Σ over conscious Threads with people and standing < 50 of ((50 − standing)/50)
× share × 4`, +2 if starving, + `taint/40`. Then
`dissent = clamp(dissent + dd − dissent × k, 0, 100)` with `k = 0.07` under The Right to Stop,
else 0.045.

**Forks** as in C.6.7.

The Commons' `resolve: 0.3` field is shown in the interface. The rule above reads Commons by
its id; the field itself is not read generically.

#### C.7.3 Charters (`data/charters.ts`, `actions.ts`)

`CharterDef { id, name, desc, effect, era, tech?, requiresCharter?, excludes?, cost, stances,
resolve?, dissent?, taint?, dark? }`. `effect` is the plain statement shown to the player.
`stances` gives the standing change per Thread when enacted (reversed on repeal). `resolve`,
`dissent` and `taint` are one-off changes when enacted. `dark` marks the ways of the Hunger:
they cannot be repealed and take no room in the book.

**Enacting** (`charterAvailable`, then `enactCharter`). The checks, in this order: not already
in force; The Long Record researched; `ageReached(era)`; the tech known; `requiresCharter` in
force; none of `excludes` in force (Upload at Death and Sanctity of Flesh exclude each other);
`accord ≥ cost`; book space: if the charter is not dark, the non-dark charters in force must be
fewer than 5, or 9 with Assembly of Threads.
Effects, in order:
1. `accord −= cost`, push the id, apply `stances` (clamped 0 … 100), then `resolve` and
   `dissent` (clamped) and `taint` (capped at 100).
2. Once only (skipped when `civ.flags.repealed_<id>` exists): Salvage the Dead or Consume the
   Dead gfe −0.01; Salvage the Dead matter +40.
3. Consume the Dead: matter +80 if Salvage the Dead is in force, else +120.
4. Sanctuary: `sanctuaryHeard(true)` (neighbours section).

**Repealing** (`repealAvailable`, then `repealCharter`): it must be in force and not dark, and
`accord ≥ cost`. Then `accord −= cost`, subtract `stances`, dissent +3 (`REPEAL_DISSENT`), and
`civ.flags.repealed_<id> = turn`. Repealing the Overdrive Protocols turns every overdrive off;
repealing Sanctuary calls `sanctuaryHeard(false)`. Windfalls are not repaid and will not come
again. Every lasting effect is a live check (`hasCharter`, or `charter:<id>` in `mods.flags`),
so a repeal needs nothing else.

**Effects as implemented:**

| Charter | Where it acts |
|---|---|
| Cold Sleep Lottery | starvation and over-capacity send Kin to Cold Sleep when there is a berth; cryo upkeep ×0.5 |
| Upload at Death | a Kin who starves to death becomes an Echo on a 50% roll if there is room; uploading costs no Kin standing |
| Sanctity of Flesh | Kin standing +0.4 a turn; resolve's pull +0.02 while Kin ≥ 50%; uploads and merges cost 4 accord (never blocked by it) |
| Abandon the Surface | Kin natural room ≥ 60% of base; `kin_homeworld` always met; no homeworld resolve penalty; `industryMult ×1.1` |
| The Right to Stop | `echoes_stop` met; deaths weigh ×0.6 on resolve; dissent decay 0.07 |
| Merge Consent | `chorus_consent` met; at most one merge a turn ("half as fast"); merging costs no Echo standing |
| Child Quotas | Kin upkeep ×0.8 (`mods.upkeep.kin`); Kin growth ×0.4 |
| Sanctuary | neighbours: refugees and exodus, news +10, goodwill drift |
| Salvage the Dead | +40 matter once; ruin events ×2 matter; half a dead neighbour's archive insight as matter |
| Blackout | `out ×0.9` (people and buildings, not energy or matter); the Hunger is drawn less (`signatureOf × 0.3` in `moveSwarm`, other factors in `hunger.ts`) |
| Rationing | all Thread upkeep ×0.85; resolve −0.5 a turn |
| Open Archives | `insightMult ×1.15` |
| Overdrive Protocols | allows overdrive |
| Thread Parity | standing drifts 5% a turn toward 55 |
| Lattice Compact | no alienation (accord or standing); Lattice output ×1.15; tamed swarms relapse at 0.005 instead of 0.02 (`hunger.ts`) |
| Wardens' Oath | Warden and Aegis cost ×0.75 in industry and matter; settlement defence ×1.5 |
| The Long Watch | dormant upkeep ×0.05; wake bonus lasts two turns |
| Consume the Dead (dark) | +120 matter (80 after Salvage); +4 matter per own pop lost; ruins ×3; a dead neighbour's whole archive insight as matter; gfe −0.01 once; taint +15 |
| Strip the Sleepers (dark) | enables devouring sleeper vaults (event choice: +150 energy, +60 matter, taint +6) |
| Absorb the Weak (dark) | enables `devour` on a neighbour with health ≤ 0.4 (C.11) |
| Communion (dark) | swarms join instead of attacking; no attacks on them; taint from held swarms (Hunger section) |

#### C.7.4 What else spends accord

Pacts (`pactCost = round(30 × 1.6^n)`, where `n` counts pacts in force and proposals out) and
declaring war (60 accord, resolve −5, dissent +8, every standing −1 with a cause or −3 without):
neighbours section.

#### C.7.5 Accord uses (`sim/accord.ts`)

| use | base price | gain | refused when |
|---|---|---|---|
| `rally` | 80 | resolve +3 (max 100) | resolve is already 100 |
| `calm` | 60 | dissent −4 (min 0) | dissent is 0 |
| `hear` (one Thread) | 50 | that Thread's standing +5 (max 100) | the Thread is not conscious, has no people, or its standing is 100 |

`price = round(base × 2^heat)`, where `heat` is `civ.flags.acc_<use>_heat`, or
`acc_hear_<thread>_heat` per Thread. Each use: `heat += 1`, and `acc_..._turn = turn`, which
allows one use a turn per key. `coolAccord` (after society) lowers every heat by 0.1 a turn and
deletes the pair below 1e-9. Example: Rally once costs 80. The next turn it costs
`round(80 × 2^0.9) = 149`, and it is back to 80 after ten quiet turns.

### C.8 Research (`data/techs.ts`, `sim/research.ts`)

**Fields** (`FIELDS`): Stewardship, Mind, Reach, Harvest and Continuity. They are for grouping in
the interface only. There are 73 techs: 37 Dusk, 24 Degenerate, 9 Black Hole and 3 Dark.

**`TechDef`:**
* `id`, `name`, `desc`.
* `era`: the first age it can be researched in, by `ageReached`: the calendar age or the age
  the player sees, whichever is further.
* `field`; `cost` (insight).
* `requires`: all must be known.
* `effects` (C.13).
* `speculative`: an interface label.
* `taint`: added on completion (Hunger Engines 12, Communion 18), and the tech is never found
  from surplus.
* `noAuto`: never found from surplus (Halo Siphons).
* `needsStable`, `needsDecay`, `needsCurvature`: visible only once the fate of matter is known
  and is that fate (`techVisible`).

**Cost:** `techCost = round(cost × 0.85 (gentle) / 1 / 1.15 (harsh))`. One tech has further
story discounts (sealed). `ERA_COST_SCALE` is all 1 and unused.

**Available** (`techAvailable`): not known; `ageReached(era)`; visible; all `requires` known.
`setResearch(id)` chooses one. Any banked insight moves into it at once. If that already covers
the cost, it completes at once ("from stored insight") and the excess goes back to the bank.
`setResearch(null)` pauses. Progress on a project (`civ.research[id]`) stays when you switch.

**Each turn (step 3)**, with `I` the turn's insight:
1. If a Great Work is active: the Work gets `I × 0.5` if a project is also chosen, else all of
   `I`. The rest is `research`. When the Work's progress reaches its cost, "The Great Work is
   complete" is logged and `civ.work = null`.
2. If a project is chosen: `progress += research + bank`, and `bank = 0`. On reaching the cost,
   `bank = progress − cost` and `completeTech`.
3. If none is chosen: `bank = min(bank + 0.5 × research, 2000)` (`IDLE_STUDY`). Nothing is
   drawn for it.
4. `discoverFromSurplus` (C.8.1).

The research draw (2% of `I` in energy) applies whenever a project or Work is chosen
(`RESEARCH_DRAW`). Insight from events goes into the chosen project, or into the bank (uncapped)
if there is none.

**`completeTech(id, how)`:** add the id to `techs`, delete its progress, clear `researching` if it
was the one, add its `taint` (capped at 100), and log. The Proton Question queues the event
`proton_answer`, and knowing it makes the fate of matter known (`fate.ts: fateKnown`).

#### C.8.1 Discoveries from surplus

Up to 3 times a turn (`SURPLUS_PER_TURN`):
1. `open` = available techs that are not tainted, not `noAuto` and not being researched, each
   with its remaining cost `max(0, techCost − progress)`, sorted cheapest first.
2. `reserve` = the dearest remaining cost.
3. Stop if there are none, if `bank − cheapest < reserve`, or if the cheapest remaining cost is
   ≤ 0.
4. Otherwise `bank −= cheapest` and complete it ("worked out on their own").

So the scholars only ever use the excess beyond what the dearest open project would need.

#### C.8.2 Behaviour tied to specific techs

The table lists effects beyond unlocking structures, ships and charters.

| Tech | Effect (where) |
|---|---|
| The Long Record | `charters` flag: +0.25 accord per settlement a turn, and the book of charters opens. (Its description says +1; the code gives 0.25.) |
| Assembly of Threads | standing drifts 2% toward 60; the book holds 9 |
| Hardy Lineages | `hardy`: Kin room uses `vitality^0.6`; Kin upkeep ×0.9 |
| Reversible Logic | Echo upkeep ×0.85, Chorus ×0.9 |
| Mind Substrate … Asymptotic Mind | `echoMaxClock` (C.6.1) |
| Survey Optics / Catalysed Drives | detection 150 / 2,000 ly |
| Fusion Drives / Magsail / Catalysed / Relativistic Arks | ship speed 0.06 / 0.15 / 0.4 / 0.8 c; Magsail and Relativistic: `cheap_launch` (launch ×0.6) |
| Hibernation Protocols | `paceMin −2`; Long Sleep |
| Quickening | `paceMax 2`; Quick ×10 splits a star clock (time section) |
| Deep Storage | `reserveMult ×1.25` |
| Hunger Engines | matter yields ×1.4 |
| Orbital Industry | Kin may settle the Deep in the Dusk |
| Last Light / Great Decay / Last Horizon Protocols | `crossing: 0.5`, read by `crossing.ts` for that age's crossing (ages section) |
| The Proton Question | the fate of matter becomes known |
| Halo Siphons | while running (researched and not shut): ember light doubles (`siphoned`), and the halo drains twice as fast (physics) |
| Deep Listening | the Signals panel; neighbours can be heard at any distance (`survivors.ts`) |
| Command Language | taming (C.11) |
| Hunger Lures | beacons (C.11) |
| Halo Dynamics, Gravitic Semaphore | story triggers (sealed) |

Hunger Studies' description promises it "reveals swarms … and forecasts their paths". At this
commit no rule checks for it except as a prerequisite and in the interface (it shows the dark
charters). The effect flags `halo_siphons` and `proton_known` are unused; the code reads the tech
ids instead.

### C.9 Structures (`data/structures.ts`)

#### C.9.1 Fields of `StructureDef`

* `id`, `name`, `desc`.
* `era`: first age, by `ageReached`.
* `tech?`.
* `cost`: industry.
* `matter`: paid up front when queued.
* `max`: per settlement, counting queued ones.
* `systemUnique?`: one per system, across our settlements, counting queued ones; one left
  behind by a rogue world does not count.
* `bodies?`: allowed body kinds. If it includes `deep`, it is built around the star from any
  body in the system.
* `notBodies?`.
* `primaries?`: allowed primary kinds.
* `notAt?`: primary kinds it gathers nothing from and cannot be built at (ordinary light
  collectors at brown dwarfs).
* `habitable?`: the body's own habitability must be ≥ 0.3.
* `energy? { mode, amount, input? }` (C.4).
* `matterYield?` (× richness), `hydrogenYield?` (× hydrogen), `lift?` (from the star itself).
* `industry?`, `insight?`, `accord?` (per building per turn, × `out`).
* `resolve?`: shown only; the Commons' 0.3 is applied by id.
* `cap?`: room per Thread. `cryoCap?`: sleeper berths.
* `reserveCap?`, `burstCap?`: both add to reserve capacity. `burstCap` also marks a catcher of
  final bursts (physics).
* `defense?`: added to the system's defence against swarms and raids (Hunger section). Wardens'
  Oath gives ×1.5, and warships at the star add their attack (×2 if fortified).
* `upkeep?`: energy (C.4).
* `declineMult?`: multiplies the world's decline. `warms?`: Orbital Lamps; keeps a living world
  from freezing without a sun, and holds its climate at ≥ 285 K.
* `coreHeatBonus?`, `vitalityOnce?`: once-only on completion.
* `signature`: Hunger draw. `signatureOf(system) = Σ signature × count + 0.3 × (Kin + Chorus) +
  4 per overdriven Hearth`. Swarms choose targets by it, and a breaching swarm picks which
  structure to strip with weight `signature + 0.5` (never the Shipyard).
* `decayProof?`: survives the end of matter, never flows, and keeps its settlement when its
  system dissolves.
* `continuityMult?`: multiplies the Dark Era's continuity loss.
* `gfeDrain?`: free energy drained per building per Tide turn.
* `enables?`: `upload`, `merge`, `cool` gate conversions; `lattice` is a label.
* `terraform?` (C.9.6).

There are 49 structures. Nine need no tech: Solar Arrays, Geothermal Tap, Deep Mine, Habitat
Domes, Night-side Shelters, Archive Spire, The Commons, Shipyard and Relic Excavation.
`structureKind` groups them for the build list by the first of these that applies: energy,
matter, storage, insight, accord or resolve, industry, defence, world, otherwise people.
`structureLabel(id, sys)` renames light collectors by what they gather there. Solar Arrays, for
example, become Glow Arrays at a white dwarf, Infrared Nets at a cold dwarf, Beam Arrays at a
pulsar and Disk Arrays at a hole. Ids never change.

#### C.9.2 Build rules (`actions.ts: structureCheck`, in this order)

1. The tech is known; `ageReached(era)`.
2. `count + queued < max`.
3. `bodies` (unless it includes `deep`); `notBodies`.
4. Not left behind (a rogue world and a structure around the star).
5. `primaries`; `notAt`. At a brown dwarf the message points to Infrared Shrouds.
6. `habitable` (own habitability ≥ 0.3).
7. Terraforming rules (C.9.6).
8. Relic Excavation: a found relic, not flowed. Disk Skimmer: `primary.rekindle > 0`.
9. Light collectors: not on a rogue world, and the star's `sourceLight` this turn > 0.
10. `systemUnique`.
11. Once matter is gone, Fusion Plants and Accretion Engines are refused ("no matter left to
    burn").

`buildableStructures` lists those with the tech known (or no tech) and the age reached.

#### C.9.3 Costs (`buildCost`)

`industry = cost`, `matter = matter`. A Warden or Aegis under Wardens' Oath: both ×0.75. The code
also applies ×0.8 industry for ships under a charter `expansion_mandate`, which does not exist.
Once matter is gone the matter part becomes `energy = round(matter × 1.5)` and matter 0. The
results are rounded. `queueBuild` refuses when matter or energy is short, or when the queue
already holds 6. It pays the matter and energy at once, records them in `paid`, and queues
`{ cost: industry }`. `removeQueued` refunds `paid` in full (the work already put in is lost).
Items queued before `paid` existed are refunded at today's price. `moveQueued` swaps neighbours
in the queue.

**Rushing** (`rushCost`, `rushBuild`): finish the first item. With `left = cost − progress`, the
price is `ceil(1.5 left)` matter and `ceil(0.3 left)` energy, or, once matter is gone,
`ceil(1.2 left)` energy. Once per settlement per turn (`flags_rushed`); dissent +1.5. It sets
`progress = cost − 0.001`, so the item completes at the next end of turn.

#### C.9.4 Dismantling (`dismantleTerms`, `dismantleCheck`, `dismantle`)

The structure gives back `buildCost` at today's price: its matter, or its energy once matter is
gone. Taking it apart costs `max(5, round(cost/5))` energy. It is refused while it houses people
or sleepers who would have no room left (capacity recomputed with one fewer), while it is the
last Shipyard and ships are queued, or without the energy. A structure with a once-only effect
(`vitalityOnce`, `coreHeatBonus`, Confluence Node) increments
`civ.flags.dismantled_<colony>_<id>`. Building and taking apart never pays: the industry is lost.

#### C.9.5 Loss, and structures added by the game

There is no routine wear. Structures are lost to overdrive accidents, swarm breaches, the Long
Flow, crossings (every non-`decayProof` one at the end of matter), and with their settlement.
Rebuilding one lost this way repeats its once-only effect, because it left no dismantle mark.
The game adds structures without checking `max` in these cases: a settler's `settles.structure`;
structures copied around the star in an evacuation; Lattice Foundries from an absorbed swarm;
Night-side Shelters cut at a flare (time section); a Penrose Harvester at a hole in the
migration at the end of matter.

#### C.9.6 Terraforming (`sim/terraform.ts`; climate in physics)

Three Dusk structures, all with tech `terraforming`, buildable on `barren`, `ice`, `ocean_ice`,
`super_earth`, `terran` and `eyeball` worlds:
* Orbital Mirrors (100 industry, 40 matter, upkeep 1): ×2 light on a world whose warmest ground
  is below 288 K, ÷2 above.
* Atmosphere Works (120 / 50, upkeep 1): greenhouse ×1.15 (never past 288 K), carries 0.7 of a
  locked world's heat round to its night side, and on first completion water ≥ 0.1.
* Biosphere Seeding (60 / 20).

They act only while `terraformLit`: the Dusk calendar, a burning red dwarf, and a world not rogue
and not dissolved.

`habitabilityOf(b, c) = max(own, min(0.55, own + (0.2 mirrors + 0.25 works) ×
livableWarmth(warmest ground)))`. `livableWarmth` is 1 from 250 to 330 K, `(k − 200)/50` below
250, `(400 − k)/70` above 330, and never below 0.

Blocked when:
* the world is not lit;
* (mirrors and works) its own habitability is already ≥ 0.55, or both together would add nothing;
* (seeding) its own habitability is ≥ 0.5 (it has life of its own), its terraformed habitability
  is below 0.3, or its water is below 0.05.

Seeding adds 0.04 vitality a turn up to 0.8 (rounded to six places). The step runs in
`declineWorlds` before the decline. Seeded life freezes, 5% a turn, once neither mirrors nor works
run. Since natural Kin room is `habitability × vitality`, a dead world needs the seeding before
it gives any room.

### C.10 Ships and fleets (`data/ships.ts`, `sim/fleets.ts`)

#### C.10.1 Fields of `ShipDef`

* `id`, `name`, `desc`, `tech?`.
* `cost` (industry), `matter`.
* `mass`: for the launch cost.
* `attack`: strength against swarms and in raids and defence.
* `hp`: hit points. Damage only ever lowers them; ships never repair.
* `survey?`: can explore by itself and sees 3× as far.
* `settles? { thread, pops, structure? }`.
* `tames?`: Swarm Tender.
* `inSystem?`: cannot leave its star (the System Lighter).
* `crew?`: Kin taken from the building settlement at launch. Queueing needs `crew + 1` Kin
  there.

Settlers: Lighter (1 Kin and Habitat Domes), Ark (2 Kin and domes), Seedcore (2 Echoes and a
Substrate Core), Spore (2 Lattice and a Lattice Foundry), Vault Ship (3 Coldminds and a Cold
Vault).

#### C.10.2 Building

Ships are built in a settlement's queue and need a Shipyard there (`buildableShips`,
`queueBuild`). Costs as in C.9.3. On completion, see C.5.6 (crew, joining fleets).
`disbandFleet` (stationed only) gives back `0.4 × matter` of each ship's base matter cost.

#### C.10.3 Movement (no faster than light)

`Fleet { id, name, ships[{cls, hp}], at, from, to, traveled, distance, order, targetBody?, auto?,
scanned? }`.
* **Speed** (`mods.speed`, a fraction of c, which is light-years per year): 0.02 to start, then
  the maximum over techs (0.06, 0.15, 0.4, 0.8).
* **Ordering** (`orderMove`): the fleet must be stationed; "Already there" unless the order is
  colonize or tame; a Lighter cannot leave; the target must not be `gone`.
* **Launch cost:** `launchCost = round1(mass × (0.6 + 0.55 × log10(1 + ly)) × (0.6 if
  cheap_launch) × era)`, with `era` 1 (Dusk), 1.3 (Degenerate), 1.6 (Black Hole) or 2.2 (Dark)
  by the calendar age. It is paid at launch. Example: a probe going 10 ly in the Dusk pays 1.2;
  an Ark going 10 ly pays 9.4. A move within the same system is free, and the fleet arrives at
  once.
* **Travel:** each turn, in step 6, every fleet under way gets
  `traveled = min(distance, traveled + speed × L)`, where `L` is the turn's real length (Infinity
  means arrival at once). So a fleet goes further per turn when turns are longer, and slowing
  the pace speeds it in turns but not in years. Example: at the start (Tide 40 years, ×1.27 a
  turn) a 10 ly hop at 0.02 c takes 7 turns. `travelEstimate` gives `years = ly / speed` and the
  turns as they will really fall (`stepTurns`).

#### C.10.4 Arrival, surveying and detection

On arrival (`arrive`) any ship surveys an unsurveyed system (`survey`). The system becomes
`known = 2`. Hidden relics that have not flowed become `found` and queue `relic_<kind>`. Living
worlds are logged. A 30% roll gives at most one anomaly find (events section). Then a colonize
order settles, and the order becomes `idle`. `surveyWhereStationed` surveys wherever a fleet
sits. `updateDetection` marks systems `known = 1` when they are within `mods.detect` of a
settlement or of a Shared Watch partner's star, or within `detect` (×3 for survey ships) of a
stationed fleet. A stationed fleet that has not scanned from here, and has no detected but
uncharted star within 2,000 ly, takes one long-baseline scan: it reveals the nearest unknown,
non-outlier stars within 60,000 ly, three for survey ships and one for others.

**Auto-explore** (`setAutoExplore`, `autoExplore`): survey ships only. Each goes to the nearest
detected, uncharted, not-gone star that no other fleet is bound for and where no visible swarm
feeds. It waits if the launch would leave less than 20 energy (`EXPLORE_RESERVE`). When none is
left it stops and reports. An order given by hand ends it.

**Standing orders** (`standFleet`): `fortify` (warships only: ×2 defence where they are, Hunger
and war sections), `hold` (parked, not counted as idle), or `idle`.

#### C.10.5 Settling

The order is `colonize` with a target body. On arrival `settle` takes the first settler ship and
calls `canSettle(body, thread)`. It refuses if:
* the body is already settled or is dissolved;
* it boils away or is swallowed this turn;
* the settlers are Kin and the body is a gas or ice giant;
* the settlers are Kin, the body is the Deep, the calendar age is the Dusk and Orbital Industry
  is not known;
* the system is gone;
* another civilization lives on that world (`homes.ts: residentsOf`).

On success it creates the settlement with `settles.pops` of that Thread and 1 of
`settles.structure`, removes the ship, and deletes the fleet if it is empty. Failure is logged.

**Site values** (`sim/sites.ts: siteValue`, interface only; `buildableAt` follows
`structureCheck`'s rules for a place without a settlement, and leaves out terraforming):
* **Kin:** `hab = habitabilityOf × vitality`, `room = naturalKinRoom`. The score is `hab` if
  the world is freezing or cooling with room, otherwise `10 × room + hab`.
* **Echoes and Chorus:** `powerAt`, the Hearth plus every energy structure buildable there at
  its `max`, at the Tide (arrays × insolation; spin in full while any is left; fuel burners and
  late harvesters 0).
* **Lattice:** `matterAt + 0.1 × powerAt`, with `matterAt = Σ (matterYield × richness +
  hydrogenYield × hydrogen + lift) × max × gfeMatter`.
* **Coldminds:** `log10(years left until lastsUntil)` (400 if never), minus mean
  temperature / 10,000. `lastsUntil` is a feeding world's start, ∞ for a rogue world, a hole's
  evaporation, ∞ for a star that never takes its worlds in, otherwise `inspiralAt`.

### C.11 Beacons and the action list

**Decoy beacons** (`sim/beacons.ts`, tech Decoy Beacons). `placeBeacon(fleet)`: the fleet must
be stationed in a system with none of our settlements and no beacon; it costs 30 energy. It sets
`sys.beacon`, and `drawSwarmTo` turns the nearest awake, untamed, stationary swarm within swarm
reach (90 ly in the Dusk, 4 × 10⁵ in the Degenerate Age, 10⁹ later) toward it, with no random
draw. Each turn, in step 1, every lit beacon costs `3 × pf`, paid in system order while energy
lasts. One that cannot be paid, or whose system is gone, goes out. While lit it adds +25 to that
system's score when a swarm picks its next meal. `putOutBeacon` is free and immediate.

**Every player action** (`sim/actions.ts` unless noted; each returns an error string or null):

| Action | Cost / condition | Effect |
|---|---|---|
| `queueBuild(c, kind, key)` | C.9.2 and C.9.3; queue < 6; a Shipyard for ships | pays up front, queues |
| `removeQueued`, `moveQueued` | — | refund in full / reorder |
| `rushBuild(c)` | C.9.3 | finishes the first item next turn; dissent +1.5 |
| `dismantle(c, id)` | C.9.4 | refund, minus the work's energy |
| `setFocus`, `setSpare` | — | C.5.5, C.5.6 |
| `toggleOverdrive(c)` | Overdrive Protocols | C.5.4 |
| `convert(c, kind)` | C.6.5 | upload / merge / cool / freeze / thaw |
| `setResearch(id \| null)` | available | C.8 |
| `setPace(p)` | `paceMin ≤ p ≤ paceMax` | the next turns' pace (time section) |
| `setDormant(b)`, `longSleep(n)` | Long Sleep needs Hibernation Protocols | C.5.7 |
| `enactCharter`, `repealCharter` | C.7.3 | — |
| `spendAccord(use, t?)` (`accord.ts`) | C.7.5 | Rally / Calm / Hear |
| `startWork(id)` | C.12 | — |
| `orderFleet(f, sys, order, body?)` | launch energy | move / colonize / survey / tame; ends auto-explore. A `tame` order is only a move. |
| `setAutoExplore`, `standFleet`, `disbandFleet`, `renameColony` (≤ 32 characters) | — | C.10 |
| `placeBeacon`, `putOutBeacon` | 30 energy | above |
| `attack(f)` (`hunger.ts: attackSwarm`) | warships at a swarm's star, once a turn per star, not under Communion | win if `attack ≥ 1.2 × size × U(0.6, 1.1)`: the swarm loses `min(size, 0.3 × attack)`, matter +2 per point, ships hurt; a size ≤ 0.4 is broken. Otherwise every ship there takes `U(0.6, 1.2) × 0.8 × size` damage, and those at 0 hp are lost. A sleeping swarm wakes unless broken. |
| `tame(swarm)` | Command Language, a stationary swarm, a Tender in its system, `round(15 + 6 × size)` energy | the swarm is tamed (and awake) |
| `absorb(swarm, c)` | a tamed swarm at that settlement | Lattice `+max(1, round(size/1.5))`, Lattice Foundries ≥ `ceil(pops/6)`, taint +3 (+8 under Communion) |
| `shutHaloSiphons()` | the siphons researched and running | `civ.flags.siphons_shut = turn`; from the next turn no doubling, and the halo falls at its own pace; cannot be undone |
| `sendAid(sv, e)` | contact, energy | the beam arrives at light speed (neighbours section) |
| `askForAid`, `raid`, `seize`, `devour`, `proposeAPact`, `breakPact`, `goToWar`, `peace` | neighbours section | e.g. `devour` needs Absorb the Weak and health ≤ 0.4: +80 + 3·pop energy, +60 + 4·pop matter, taint +10, resolve −6 |
| `answerSignal`, `answerEvent` | other sections | — |
| one more action, for a stranger mind | sealed | — |

### C.12 The Great Works (`data/works.ts`, `sim/endings.ts`, `actions.ts: startWork`)

`WorkDef { id, name, ending, path, eras, tech, cost, energy, requirement, maxTaint, epilogue }`.
* `eras`: the ages it can be begun in (`inAge`: the calendar age or the age the player sees).
* `cost`: insight, with `workCost = round(cost × 0.8 (gentle) / 1 / 1.2 (harsh))`.
* `energy`: paid once, when it is first begun.
* `requirement`: the text shown; the rule is coded.
* `maxTaint`: above it, the Work cannot be begun and its requirement fails.
* `ending`, `path`, `epilogue`: sealed.

**`startWork(id)`.** The checks: the tech is known; `inAge(eras)`; `taint ≤ maxTaint`. If it is
already the active Work, nothing happens. If its progress has reached the cost: "It is complete:
nothing more to put in". If it was never begun (progress 0), it needs and pays `energy` and sets
progress to 1. Then `civ.work = id`. Switching Works keeps each one's progress, and resuming one
costs nothing. Each turn it takes half the insight if a project is also chosen, otherwise all of
it (C.8). On completion `civ.work` is cleared. The active Work keeps taking insight even after
its ages pass. A finished Work does nothing more by itself. The game checks at the end of each
turn whether a finished Work's requirement holds, and what follows is sealed.

**Requirements as coded** (`workRequirementMet`; each also needs `taint ≤ maxTaint`):

| Work | tech | eras | cost | energy | maxTaint | requirement |
|---|---|---|---|---|---|---|
| The Hibernal Cascade | Asymptotic Mind | Dark | 1500 | 220 | 59 | Echoes + Coldminds ≥ 6 |
| Confluence | Total Confluence | Black Hole, Dark | 1500 | 150 | 29 | Chorus ≥ half of all awake people, and every conscious Thread with people at standing ≥ 55 |
| The Archive of Everything | Archive Theory | Black Hole, Dark | 1500 | 150 | 59 | Lattice ≥ half of all awake people |
| The Aeon Seed | Conformal Mathematics | Black Hole | 1700 | 300 | 29 | a settlement at the Heart (the core system), plus a sealed condition; checked at a sealed moment |
| The Garden of Embers | Garden of Embers | Dark | 1200 | 200 | 29 | fate stable and known, and Kin awake + asleep ≥ 6 |

#### C.12.1 The Echo archive (`sim/archive.ts`)

Echoes that arrive through events (an upload, ghosts run again, sleepers who join) are placed by
`welcomeEchoes(n)`: into free Echo room, the capital first, then the other settlements in order.
The rest wait in `civ.flags.echo_archive`, cost nothing and do not count as people. Each turn
(step 4, before growth) `wakeArchivedEchoes` moves them into any free room, in settlement order.

### C.13 Modifiers (`sim/mods.ts: computeMods`)

`Mods { echoMax, speed, paceMax, paceMin, reserveMult, insightMult, industryMult,
upkeep[thread], detect, flags }` is recomputed whenever needed: at the start of each turn, in
projections, in checks. Defaults: `echoMax` 1.6, `speed` 0.02, `paceMax` 1, `paceMin` −1, the
multipliers 1, `detect` 60, and no flags. They combine as follows:
1. **Techs**, in the order learned. `echoMaxClock`, `speed`, `paceMax` and `detect` take the
   **maximum**; `paceMin` the **minimum**. `reserveMult`, `insightMult`, `industryMult` and each
   Thread's `upkeep` **multiply**. `flags` are added to the set. (`crossing` is not in `Mods`:
   the crossing reads that age's protocol tech directly.)
2. The Prophet of Stillness (`civ.flags.stillness`, an event): `paceMin = max(−3, paceMin − 1)`.
3. **Charters:** each adds `charter:<id>` to the flags. Open Archives: `insightMult ×1.15`.
   Abandon the Surface: `industryMult ×1.1`. Child Quotas: `upkeep.kin ×0.8`. Rationing: every
   `upkeep ×0.85`.
4. **Age:** outside the Dusk calendar, `detect = max(detect, 3e5 in the Degenerate Age, else 1e7)`.

Other multipliers are applied where they are used, not in `Mods`:
* `out` (morale × wake × Blackout);
* `taintBoost`, focus and overdrive;
* Hunger Engines ×1.4, the Lattice Compact's ×1.15, and the strain multipliers;
* difficulty, which in this domain touches only tech and Work costs;
* Wardens' Oath on costs and defence, and `cheap_launch` on launches.

All of these are products, so their order does not matter, except where a `min`, `max` or clamp
is stated.

### C.14 Notes for a faithful rebuild

* People are integers: every change is ±1 or a floor or ceiling. Only `colony.growth` is
  fractional.
* RNG draws in this domain, in turn order:
  * the overdrive accidents (one `withRng`);
  * starvation's Upload at Death roll;
  * one `withRng` around all of `updateSociety` (only demand picks draw);
  * then, in step 6, the survey's anomaly roll;
  * attacks, when the player orders them.

  Keep the same order and count.
* Things the code does that the texts do not say:
  * a met demand caps standing at 80;
  * matter upkeep goes on after matter is gone;
  * a growth point is paid for even with no room;
  * spare yields are not in the reported energy net;
  * starvation strikes at most three settlements a turn;
  * without Merge Consent, merges can be repeated within a turn.

## D. The others and the end

This part covers everything in the game that is not us: the Hunger, the fellow survivors (the "living neighbours"), signals and messages, narrative events and survey finds, the outside view of endings, and the autoplayer with its balance harness. Source of truth: commit `4b92446`. All code paths are under `src/game/`. Two stranger minds also exist; they are contacted through signals, and everything about them is in the sealed section (S.1). Endings are summarised here only from outside; their rules and texts are in the sealed section (S.4).

Conventions used below: `U(a,b)` is one `rng.range(a,b)` draw; `chance(p)` is `rng.next() < p`. All randomness comes from the single game RNG (mulberry32 in `rng.ts`, state persisted in `GameState.rng` and wrapped by `withRng`). **The order of draws matters**: a replica that consumes draws in a different order will diverge from the original's seeds. Where a draw is conditional (short-circuit `&&`), this is called out. `distLy(a,b)` is the Euclidean distance between two systems' `phys` coordinates (light-years). Ids come from `uid(state, prefix)` = `prefix + (nextId++).toString(36)`.

### D.0 Where these systems run in a turn

`sim/turn.ts: endTurn` runs these steps (only the parts relevant here are listed):

| Step | Calls (in order) |
|---|---|
| 1. economy | `jointIncome(state) × paceFactor` is added to energy income |
| 6. fleets, hazards, other minds | `advanceFleets` → `surveyWhereStationed` → `updateDetection` → `firstSwarm` → `swarmsHunt` → `autoExplore` → `updateHunger` → `updateSurvivors` → `pactsTurn` → `warTurn` (inside `withRng`) → stranger minds (sealed) |
| 7. universe moves on | years/turn advance; `state.turn++`, `state.eraTurn++` |
| 8. signals, events | `deliverSignals`; for each arrived signal: `pact_answer` → `answerArrived`; `aid_answer` with energy > 0 → energy credited and logged; `last` with `data.insight` → added to `civ.flags.insight_bank` (plus matter = insight under Consume the Dead, or ½ insight under Salvage the Dead). Then scripted events (`turn === 3` → `dynamo_fails`, `turn === 7` → `first_night`), the `rust_in_the_belt` fallback, `rollRandomEvent`, `positronium_forms`, `updateForecasts` |
| 9. crossings | ending check before the last crossing (see D.5) |
| 10. endings | `checkEndings(state)` |

Because years advance in step 7 before step 8, a signal sent in step 6 whose light-time is shorter than this turn's length arrives at the end of the same turn.

---

### D.1 The Hunger (`sim/hunger.ts`)

Harvester machines of a long-dead civilization: no mind, drawn to heat and matter, they strip systems, grow, bud, and drain galactic free energy. Only the Hunger's swarms move on the map; no other civilization has units.

#### D.1.1 The Swarm record

```
Swarm { id, systemId: string|null, from: string|null, to: string|null,
        traveled: number, distance: number, size: number,
        awake: boolean, tamed: boolean, appetite: number,
        prey?: string /* fleet id */, nest?: string /* swarm id */ }
```

A swarm is either **stationary** (`systemId` set, `from`/`to` null) or **travelling** (`systemId` null, `from`, `to`, `distance` ly, `traveled` ly). `appetite` is always 1 and is never read (vestigial). `prey` and `nest` exist only on a "part" sent after one of our ships (D.1.8).

#### D.1.2 Generation (`gen.ts`, after the survivors and the sleeper vault)

- Candidates: every system whose region is not the home reach, whose region kind is `globular` or `reach`, and which has no `special`. The candidate list is shuffled with the world RNG.
- Number of nests: gentle 1, standard 2, harsh 3.
- The first candidate lying in one of the **two** reaches nearest the home reach (by region centre distance) is moved to the front of the list (no extra draw); the rest keep the shuffled order.
- Nest `i` (0-based): id `hg{i}`, stationary at that system, `size = 2 + i`, `awake: false`, `tamed: false`, `appetite: 1`; the system gets `rust = 0.15`.
- `MAX_SWARMS` (a cap on budding only): gentle 4, standard 6, harsh 8.

Other ways a swarm appears: a part breaking off the first swarm (D.1.7), parts sent after ships (D.1.8), budding (D.1.4), and a bad outcome of waking the sleeper vault (D.4.6: a size-3 awake swarm, id prefix `hg`).

#### D.1.3 Reach and speed

- `swarmReach(state) = rangeLy(state)`: by calendar era, Dusk 90 ly, Degenerate 4×10⁵ ly, later 10⁹ ly. Used for choosing a destination and by `drawSwarmTo`.
- Travel per turn: `step = (Dusk ? 0.05 : 0.5) × L` light-years, where `L` is this turn's length in years; `Infinity` if `L` is not finite. (Our ships move `mods.speed × L`, `speed` starting at 0.02.) At a 40-year Dusk turn a swarm moves 2 ly a turn.

#### D.1.4 `updateHunger(state, L, mods)` — each swarm, each turn

Constants for the call: `communion = hasCharter('communion_charter')`; `blackout = 0.3` under the Blackout charter else 1 (signature multiplier); `noticed = 0.5` under Blackout else 1 (hunter chance multiplier). One `withRng` block iterates a **snapshot** of `Object.values(state.swarms)` taken before the loop (swarms created during the loop are not processed this turn). For each swarm:

1. **Asleep** (`!awake`): wake with probability `p = (calendar Dusk ? (eraTurn > 18 ? 0.035 : 0) : 0.1)` (one draw even when `p = 0`). On waking: `awake = true`; if its star is known, log "Something has begun eating the worlds of X." (bad); `state.flags.hunger_woke++`. Either way **`continue`** (a sleeping swarm does nothing else: no eating, no rust growth).
2. **Travelling** (`!systemId && to`): `traveled += step`. If `traveled >= distance`: arrive (`systemId = to`, `to = from = null`, `traveled = 0`); then if `rejoin(sw)` or `loseTheScent(sw)` (D.1.8) took it, `continue`; else, if the star is known, log "A swarm[ under your command] has arrived at X." Always `continue` after the travelling branch (a swarm does not feed on its arrival turn).
3. Stationary at a missing or `gone` system → delete the swarm, `continue`.
4. **Tamed** → D.1.10, `continue`.
5. `loseTheScent(sw)` (a part whose ship left) → `continue` if it set off.
6. **Eat.** `matter = systemMatter(sys)` = Σ over non-dissolved bodies of `richness + 0.5 × hydrogen`, plus 2 if the primary is a brown dwarf. `bite = min(matter, 0.05 × size)`. For each non-dissolved body that is not `deep`: `richness = max(0, richness − 0.3 × bite)`, `hydrogen = max(0, hydrogen − 0.15 × bite)` (the Deep is counted but not eaten).
7. **Drain:** `gfe = max(0.05, gfe − 0.00006 × size × (communion ? 1.5 : 1))`.
8. **Rust:** `sys.rust = min(1, (rust ?? 0) + 0.04 + 0.004 × size)`.
9. **Growth** (logistic, using `matter` from before the bite): `cap = 3 + 2.2 × matter`; `size += 0.1 × size × (1 − size / max(1, cap))`; if `matter < 0.6`, `size −= 0.25`. If `size ≤ 0.4`: log "The swarm at X has starved and gone still." (good), delete, `continue`.
10. **Collide with our settlements** — if any colony of ours is at this star and not `communion`:
    - `def = defenseAt(sys)` (D.1.6), `power = 1.2 × size`. Defenders win if `def >= power × U(0.6, 1.1)`.
    - **Win:** `lost = min(size, 0.3 × def)`; `size −= lost`; `civ.matter += 2 × lost`; battle "Defenders drove back the swarm (+N salvaged matter)."; log; every ship of ours at the star takes `U(0, 0.4 × size)` hull damage (one draw per ship, size after the loss; `hurtShipsAt`, which deletes fleets that lose every ship and logs losses). If now `size ≤ 0.4`, delete the swarm, `continue`. (Settlement defence does **not** call `foughtFor`; neighbours do not hear of it.)
    - **Lose:** `c = rng.pick(colonies here)`. Its structures with count > 0 other than `shipyard`: if any, one is chosen by `rng.weighted(..., signature + 0.5)` and decremented (deleted at 0), logged "The swarm stripped S at C." `civ.matter = max(0, matter − 2 × size)`. With `chance(0.35)`: one random Thread among `[lattice, echoes, kin, chorus, coldminds]` (in that order, filtered to those with pops > 0) loses one pop and `resolve −= 2`. If the colony now has no structures and no pops or cryo: `destroyColony(c, 'consumed by the Hunger')`. Every ship at the star takes `U(0.2, 0.6) × size` damage. `size += 0.5`. Battle "The swarm broke through."
11. **Neighbours there:** every living survivor with this star in `systems` loses `health −= 0.012 × size × (Shared Watch pact ? 0.7 : 1)` (floor 0).
12. **Send a hunter:** if not `communion` and the swarm has no `prey`, `sendHunter` (D.1.8).
13. **Bud:** if `size > 9` and the number of swarms in the game (all, tamed and parts included) `< MAX_SWARMS[difficulty]`: `size /= 2`; a child `{ id: uid('hg'), stationary here, size: same, awake, untamed, appetite 1 }` is added and immediately `moveSwarm`d.
14. **Move on:** if no `prey` and (`matter < 1.2` **or** `chance(0.08)`) → `moveSwarm` (the 8% draw happens only when `matter ≥ 1.2`).

After the loop: `fadeRust` — for every system with rust and **no untamed stationary swarm** (asleep or awake), `rust *= 1 − RUST_FADE` (0.1); deleted below 0.01. No draw. Rust is cosmetic plus a tooltip; the harm is the richness and hydrogen eaten, which never regrow.

#### D.1.5 Choosing a destination: `moveSwarm(sw, rand, blackout)`

For every system `s` other than the current one, not `gone`, with `d = distLy ≤ swarmReach` (iteration in `Object.values(state.systems)` order; one `rand()` per candidate in range):

```
sig   = signatureOf(s) × blackout + theirWarmth(s) + warHeat(s)
score = (sig + 0.8 × systemMatter(s) + (s.beacon ? 25 : 0)) / (1 + d / 25) × (0.7 + 0.6 × rand())
```

The highest score `> 0` wins (ties: first). The swarm sets off (`from`, `to`, `systemId = null`, `traveled = 0`, `distance = d`). If no candidate scores above 0 it stays.

- `signatureOf(sys)` (`fleets.ts`): Σ over our colonies at that star of (structure `signature` × count) + `0.3 × (kin + chorus)` + 4 if overdriven. (Structure signatures are in the structures table; e.g. Dyson Swarm 8, Defense Grid 1.)
- `theirWarmth(sys)` (`claims.ts`): Σ over living survivors not on exodus that hold the star of `0.1 × pop × health`.
- `warHeat` (`war.ts`): only while we are at war with anyone: our capital's star +8; each warring survivor's home star with our warships there +10.
- Decoy beacon: +25 matter-equivalent at a star with `beacon` set (D.1.9).
- Blackout charter: our signature × 0.3 (neighbours' warmth and war heat are not hidden).

#### D.1.6 Defence at a settlement: `defenseAt(state, systemId, mods)`

```
d  = Σ over our colonies at the star: Σ structure.defense × count     (Defense Grid: defense 8, max 2 per settlement)
   + Σ over every fleet at the star: Σ ship.attack × (fleet.order === 'fortify' ? 2 : 1)
d *= 1.5 if charter Wardens' Oath
d += 0.5 for every living survivor with a Shared Watch pact (anywhere in the galaxy)
```

`FORTIFY_BONUS = 2`. Every ship's attack counts, settlers included (a Lattice Spore has attack 1). Ship attacks: Warden 3 (hp 10), Aegis 8 (hp 30), Lattice Spore 1, others 0. A new game starts with one Warden, "Vigil", at home with order `hold` (not fortified). `standFleet(fleet, 'fortify')` needs a warship; fortified ships also turn raiders away from the capital (D.2.9).

#### D.1.7 The first swarm (`firstSwarm`)

Runs every turn until `state.flags.first_swarm` is set. For each fleet (in `Object.values(state.fleets)` order) that is stationed at a star, find the first untamed stationary swarm (asleep **or** awake) within `FIRST_SWARM_REACH = 60` ly of that star. On the first match:

- `flags.first_swarm = turn`; the nest's star becomes known (`known = 1`) if it was not.
- One draw: with probability 0.45 it ignores the ship ("It paid F no attention. Yet."; info log). Otherwise:
- `frag.size = clamp(0.3 × nest.size, 1, 1.6)`; `nest.size = max(0.8, nest.size − 0.5 × frag.size)`; a fragment `{ id: uid('sw'), stationary at the ship's star, awake }` is built (the id is consumed even if it dies).
- `attack = Σ attack of the fleet's ships` (no fortify bonus). If `attack > 0` and `attack >= 1.2 × frag.size × U(0.6, 1.1)`: we win; `matter += 2 × frag.size`; each ship `hp = max(1, hp − U(0, frag.size))`; the fragment is never added.
- Otherwise each ship `hp = max(1, hp − U(0.6, 1.6))` (it cannot die here), the fragment is added, and it heads for `nearestSettlement` (our colony star nearest the ship's star); if that is the ship's own star it stays there.
- `flags.hunger_woke++` (the nest itself is **not** woken). `queueEvent('rust_in_the_belt', { systemId: nest, fleet: name, outcome })`. Only the first matching fleet is processed.

Fallback (`turn.ts` step 8): if `flags.hunger_woke > 0` and `rust_in_the_belt` has never fired, take the awake swarm nearest our capital (position = `systemId ?? from ?? to`), mark its star known, and queue `rust_in_the_belt` with `{ systemId }` (or `{}`).

#### D.1.8 Swarms going for ships

**At their own star (`swarmsHunt`, step 6, before `autoExplore`).** Skipped entirely on the first-swarm turn (`flags.first_swarm === turn`) and under Communion. `dark = 0.5` under Blackout. For every untamed stationary swarm whose star has none of our colonies and is not gone, for every fleet with ships at that star:

- If the swarm's `prey` is this fleet it strikes surely (no draw); otherwise `chance((awake ? HUNT_AWAKE 0.7 : HUNT_ASLEEP 0.2) × dark)` or skip. A sleeping swarm that strikes does not wake.
- `attack = Σ ship.attack × (fortify ? 2 : 1)`. If `attack > 0` and `attack >= 1.2 × size × U(0.6, 1.1)`: beaten off. `lost = min(size, 0.3 × attack)`; `size −= lost`; `matter += 2 × lost`; each ship `hp = max(1, hp − U(0, 0.3 × size))`; log and battle. If `size ≤ 0.4`: delete, log "The swarm at X is broken." (good), `foughtFor(sys, true)`, stop processing this swarm. Else `foughtFor(sys, false)`.
- Otherwise each ship loses `U(0.6, 1.2) × size × 0.8` hp; dead ships are removed; an empty fleet is deleted ("… caught F. Nothing came back."). Battle recorded.

**Parts sent after nearby ships (`sendHunter`, inside `updateHunger` step 12) — the 25 ly rule.** Constants: `HUNT_REACH = 25` ly, `HUNT_NOTICE = 0.3`, `HUNT_MIN_SIZE = 2`.

- Preconditions (no draw if they fail): `size ≥ 2`; `flags.first_swarm` set and not equal to this turn.
- Candidate fleets: stationed, with ships, at a star where we have **no settlement**, where **no untamed stationary swarm** sits, and not already the `prey` of any swarm; within 25 ly of the swarm's star. The nearest wins (strict `<`, first in fleet order on ties). No candidate → return without a draw.
- `chance(HUNT_NOTICE × noticed)` (0.3, or 0.15 under Blackout). If it passes: `part.size = clamp(0.3 × size, 1, 1.6)`, `size −= part.size`; the part `{ id: uid('sw'), travelling from the swarm's star to the ship's, awake, prey: fleet.id, nest: swarm.id }` is added; the swarm's star becomes known; log (bad, tagged with the fleet) "Part of the swarm at X broke away and is coming for F at Y."
- On arrival the part waits at the ship's star while the ship is there (it never moves on while it has prey), strikes it surely each turn in `swarmsHunt`, and also feeds there like any swarm.
- `loseTheScent(sw)` (on arrival and at step 5 each turn; no draw): if the prey fleet is no longer at this star with ships, `prey` is cleared and `headForNest`: the nest's star (`nest.systemId`, or `nest.to` if it is travelling); with the nest gone or tamed, `nest` is deleted and the part stays as a swarm of its own. Logs "What came for F at X found it gone, and is going back to its swarm." (or "…has had it…" if the fleet was destroyed).
- `rejoin(sw)` (on arrival; no draw): a part with `nest` and no `prey` arriving where its untamed nest sits merges (`nest.size += size`, part deleted); if the nest moved on it follows; with the nest gone it stays on its own.
- Taming or `drawSwarmTo` clears `prey` and `nest`.

Fleets in transit are never struck. `swarmSeenAt(state, sys)` (`util.ts`) = the star is known and an awake untamed stationary swarm is there; auto-explore and the autoplayer's probes never target such stars.

#### D.1.9 Our warships go for a swarm: `attackSwarm(state, fleetId)` (player action)

Checks in order (each returns an error string): the fleet is stationed; `isWarFleet(f)` (any ship with attack > 0 that does not settle); an untamed swarm is at the star (asleep or awake; first found); not under Communion; not already done at this star this turn (`civ.flags['swarm_attack_<systemId>'] === turn`). Then:

- `warshipsAt(sys)`: every war fleet at the star; `attack = Σ attack` of their non-settler ships at **plain strength** (no fortify bonus).
- Set the once-a-turn flag, then one `withRng`: win if `attack >= 1.2 × size × U(0.6, 1.1)`. Win: `lost = min(size, 0.3 × attack)`, `size −= lost`, `matter += 2 × lost`, every ship in those fleets `hp = max(1, hp − U(0, 0.3 × size))`; broken if `size ≤ 0.4`. Loss: every ship loses `U(0.6, 1.2) × size × 0.8`; dead ships removed; empty fleets deleted.
- Afterwards: broken → swarm deleted, `foughtFor(sys, true)`. Not broken: if won, `foughtFor(sys, false)`; if the swarm was asleep it wakes (`hunger_woke++`, text "It was asleep. It is not now.").
- Battle and combat log; returns `{ ok, text }`.

`attackOdds(attack, size) = clamp((attack / (1.2 × size) − 0.6) / 0.5, 0, 1)` is shown before committing (sure win while `size ≤ attack/1.32`, impossible past `attack/0.72`). `attackBlocked(state, systemId)` gives the button's disabled reason. The autoplayer never attacks.

#### D.1.10 Decoy beacons and drawing swarms (`beacons.ts`, `actions.ts`)

- Tech Decoy Beacons (`hunger_lures`, needs Hunger Studies). `placeBeacon(fleetId)`: fleet stationed; no beacon there already; **no colony of ours** at that star; `BEACON_COST = 30` energy. Sets `sys.beacon = true` and calls `drawSwarmTo(sys)`.
- `drawSwarmTo(sys)` (no draw): the nearest awake, untamed, stationary swarm (not at that star) within `swarmReach` sets off for it at once, its `prey`/`nest` cleared. Returns its origin star or null.
- Upkeep (`feedBeacons`, step 1): each lit beacon costs `BEACON_UPKEEP 3 × paceFactor` energy, paid in system order while energy lasts; any that cannot be paid goes dark (logged). A beacon at a gone star is removed. `putOutBeacon` ends one at once.
- While lit, a beacon adds 25 to that star's pull in `moveSwarm`.
- Restarting a relic engine (event `relic_engine`, D.4.6) calls `drawSwarmTo` with 30% chance.

#### D.1.11 Taming, tamed swarms and absorption

- Tech Command Language (`command_language`, Degenerate Age) unlocks the Swarm Tender ship (`tames: true`, attack 0, hp 8, cost 70 / 20 matter). Action `tame(swarmId)` requires the tech, then `tameSwarm`: the swarm must be stationary ("The swarm is moving; wait until it settles."); a fleet with a tender must be at its star; cost `round(15 + 6 × size)` energy. Result: `tamed = true`, `awake = true`, `prey`/`nest` deleted, `civ.flags.tamed++`. (No check against Communion or an already-tamed swarm.)
- Each turn a tamed stationary swarm: `matter += size × (Communion ? 0.8 : 0.4)`; under Communion `taint = min(100, taint + 0.12 × size)`; relapse with `chance(Lattice Compact or Communion ? 0.005 : 0.02)` → `tamed = false`, log "…has slipped its commands. It is hungry again." A tamed swarm never eats, grows, rusts, drains, hunts, buds or moves, and does not block rust fading.
- `absorbSwarm(swarmId, colonyId)`: the swarm must be tamed and at that colony's star. `pops = max(1, round(size / 1.5))`; `lattice += pops`; `lattice_foundry = max(current, ceil(pops / 6))`; swarm deleted; `taint += 3` (8 under Communion).

#### D.1.12 Communion (dark charter `communion_charter`)

Its text says swarms "merge into your Lattice"; the code does this: no settlement collisions, no `swarmsHunt`, no parts sent, `attackSwarm` refused; tamed swarms yield 0.8 × size and taint you; relapse 0.5%; the gfe drain of feeding swarms ×1.5. Untamed swarms keep eating and moving; absorption still needs taming. (A discrepancy between text and code; replicate the code.)

#### D.1.13 Taint (`civ.taint`, 0..100) and becoming the Hunger

Taint is what we have taken from the Hunger. It only moves by these rules (all clamp to 100; only one source lowers it):

| Source | Taint |
|---|---|
| Research Hunger Engines / Communion (techs) | +12 / +18 |
| Enact Consume the Dead / Strip the Sleepers / Absorb the Weak / Communion (dark charters; cannot be repealed) | +15 / +15 / +20 / +25 |
| Event "What It Was For" (`hunger_mirror`) | "Hear the warning" −5; "Hear the promise" +5 |
| Strip a relic archive or tomb under Consume the Dead | +2 |
| Devour the sleeper vault | +6 |
| Absorb a tamed swarm | +3 (+8 under Communion) |
| Each tamed swarm per turn under Communion | +0.12 × size |
| Devour a survivor | +10 |
| Seize a survivor's star without a just cause | +5 |

Effects of Taint `T`, live every turn:

- Output: every energy and matter yield × `(1 + T/200)` (`economy.ts`, `taintBoost`); Hunger Engines also gives matter ×1.4.
- Society (`society.ts`): every conscious Thread's standing `−T/60` a turn; resolve `−T/50` a turn; dissent `+T/40` a turn.
- Every survivor's regard is capped at `100 − 1.5 T`; above it, regard falls 2 a turn to the cap (D.2.6).
- `T ≥ 60`: we cannot propose pacts ("They will not bind themselves to what we are becoming."), any proposal arriving is declined, and no survivor offers one.
- Each Great Work has a maximum Taint (29 or 59) above which it cannot be started or completed; which is which belongs to the endings (sealed, S.4).
- Thresholds 30, 60 and 100 are tied to the endings and to one of the stranger minds (sealed, S.1 and S.4).
- The autoplayer never chooses an event option whose label or hint mentions "Taint", "Devour" or "Strip", never enacts dark charters, and skips taint techs in its fallback research pick.

#### D.1.14 The Hunger at the crossings (`crossing.ts`)

- The Last Light (Dusk → Degenerate): every swarm `size *= 0.7`.
- The end of ordinary matter (the Great Decay, or the Great Evaporation under curvature radiation): each stationary swarm at a black hole or the Heart survives with 40% (`chance(0.4)`, `size *= 0.2`); every other swarm is deleted. Line: "The Hunger was made of matter too. Only a few starving swarms cling on at the black holes."

#### D.1.15 What the player sees

- Map (`render/galaxyView.ts`): awake or tamed swarms only; a stationary one only at a known star; a travelling one is drawn interpolated between `from` and `to` (always). Particle count `80 + 30 × size`, radius `2.5 + 1.6 √size`.
- Forecast "A swarm is heading for X" (danger) for every untamed travelling swarm bound for one of our colony stars (no tech needed).
- Messages: log entries tagged with a fleet (parts coming for a ship, ships lost) are shown as up to two turn messages with a "Look" button (`ui/turnflow.ts`).
- The destination chip "swarm here" / "swarm N ly" (danger within 25 ly) uses `nearestSwarmSeen`.
- Hunger Studies' description claims it reveals swarms and forecasts their paths; in code it is only a prerequisite (the Blackout and Consume the Dead charters, Decoy Beacons) and shows the dark charters in the Society screen (no visibility or forecast rule reads it).

---

### D.2 The fellow survivors: living neighbours

Other young civilizations facing the same end. Each is a light simulation (health, people, stars, a clock, its regard for us), not a second empire: no ships on the map, no victory of their own. One rule binds everything: **everything between civilizations travels at the speed of light** (`sim/survivors.ts`, `pacts.ts`, `refuge.ts`, `claims.ts`, `war.ts`, `ways.ts`, `dealings.ts`, `homes.ts`). There is no `plight.ts`.

#### D.2.1 The Survivor record

```
Survivor { id, kind:'survivor', name, adjective, color, way: SurvivorWay,
  homeSystemId, systems: string[], pop, health /*0..1*/, reserve, disposition /*−100..100*/,
  clock /*log10 years*/, contact, alive,
  fate?: 'faded'|'saved'|'absorbed'|'seized'|'devoured'|'transcended',  // 'transcended' is never set
  aidGiven, lastSent /*turn*/, forkOf?: ThreadId,
  raidedAt?, askedAt?, tempted?,                      // turns
  beams?: {at, energy, known, plea?}[],               // energy crossing to them
  news?: {at, delta, what, tag?:'sanctuary'}[],       // what they will hear of us
  pacts?: Partial<Record<'aid'|'watch'|'archives', turnSealed>>,
  proposal?: {kind, at, cost, answered?},
  exodusAsked?, exodus?: {leaves, at, n},
  claim?: {systemId, at}, claimedAt?: Record<systemId, years>,
  promised?: {systemId, turn, kept?},
  war?: {since, siege},
  memory?: {turn, delta, what}[] }
```

All of these are optional fields added over time (saves stay compatible); small counters live in `civ.flags` under keys named below.

#### D.2.2 Generation (`gen.ts`)

- `settings.survivors` (0–4; default 3; the harness uses 3). The five named civilizations are shuffled with the world RNG and the first `min(4, n)` taken:

| Name | Adjective | Way | Colour | Home star |
|---|---|---|---|---|
| The Vaelun Hold | Vaelun | garden | `#d9a066` | red dwarf |
| The Serein Archive | Serein | upload | `#7fb6d9` | red dwarf |
| The Hollow Choir | Choir | chorus | `#c38fd9` | red dwarf |
| The Long Sleepers of Ost | Ostian | dormant | `#8fd9b4` | red dwarf |
| The Tessellate | Tessellate | lattice | `#d9d27f` | brown dwarf |

- Placement: the other reaches are shuffled (a draw before the names' shuffle). Survivor 0 lives in one of the 2 reaches nearest home, survivor 1 in one of the nearest 5, the rest anywhere; each in a reach not yet taken (first in the shuffled order that qualifies). A new system with `special: 'survivor'` is added at `randomInSphere(rng, 0.4 × reach radius, 0.5)`.
- Initial values: id `sv{i}`, `pop = U(18, 30)`, `health = U(0.75, 0.95)`, `reserve = 40`, `disposition = U(−10, 25)`, `clock` = dormant 6, upload 3, others 1.7; `contact = false`, `alive = true`, `aidGiven = 0`, `lastSent = 0`.

Two more can appear in play: a **fork** (D.2.15) and **The Woken** (from the sleeper vault, D.4.6).

#### D.2.3 The six ways of life

| | garden | upload | chorus | dormant | lattice (the Tessellate) | fork |
|---|---|---|---|---|---|---|
| Shown as | "clinging to biology" | "uploaded" | "merged into one mind" | "asleep, waking rarely" | "handed over to processes and protocol" | "a Thread that left you" |
| People counted as | people | minds | voices in one mind | people | processes | people |
| Starting clock (log₁₀ yr) | 1.7 | 3 | 1.7 | 6 | 1.7 | 2 |
| Clock drifts toward | `min(logL, 1.7)` | `logL` | `logL` | `logL` (see note) | `logL` | `logL` |
| Talk span (tenfolds) | 3 | 3 | 3 | 3 | 6 | 3 |
| Drain multiplier `WAY_DRAIN` | 1.5 | 0.8 | 0.9 | 0.55 | 0.7 | 1 |
| Speaks | words | words | words | words | protocol (upper case) | words |
| Wants (trades) | matter | energy | energy | energy | matter | as its Thread (Kin → garden terms, else upload terms) |
| Settles stars that | have a living world | are white dwarfs, neutron stars, black holes | (as upload) | are new stars with a cold world | are brown dwarfs or have a belt | as its Thread (Kin → garden, Lattice → lattice, else upload) |
| Lives on (`survivorWorld`) | most livable rocky world (`hab × vit × 10 + hab`) | the Deep, else largest world | (as upload) | warmest core | (as upload) | (as upload) |
| Newcomers become | Kin | Echoes | Chorus (Echoes if we lack Confluence tech `mind_merging`) | Echoes | Lattice | its own Thread |
| Seized, becomes | Kin | Echoes | Echoes | Echoes | Lattice | its Thread, every star back |
| Special | drain ×1.4 once protons decay past η 37.5 | | gathers our Echoes (D.2.14) | drain ×2 while the Long Flow runs; wakes for new stars | keeps agreements to the letter (D.2.14) | can be fought with a just cause |

Note on the dormant clock: the code is `clock += (min(logL, way==='garden' ? 1.7 : way==='dormant' ? logL+1 : logL) − clock) × 0.25`; for dormant `min(logL, logL+1)` is `logL`, so it drifts exactly as the others do (replicate as written). `logL` is the log₁₀ of this turn's length (in the Dark Era, η).

First words (event and `hello` signal), by way: garden "We hear you. We thought we were alone. We are still living on our world, under our own sky, and we mean to keep it that way as long as we can. Are you well?"; upload "Greetings from the Archive. We left our bodies long ago and keep everything that was ever written. We would like to trade what we know for what you know."; chorus "We are the Choir, and we greet you as one voice. We were many once. You are still many, we can tell. It will get easier."; dormant "This message will reach you long after we sent it, and we will be asleep when you answer. We sleep through the lean ages and wake to listen. Leave us a message."; others "We hear you." The Tessellate instead says "PROTOCOL HANDSHAKE. ORIGIN: <NAME>. STATUS: CONTINUING." (event) and adds "CONSCIOUS OPERATORS: NONE. REQUEST: EXCHANGE OF SURPLUS. THIS PROCESS WILL KEEP ITS AGREEMENTS." (signal). `voice(sv, human, protocol)` picks the protocol text for the lattice way; every message below has both forms in code.

#### D.2.4 Light speed

- `distanceToThem(sv)`: from our capital's star (or the home system) to their **home** star, in ly.
- `lightAt(ly) = years + max(0, ly)` while years are finite; in deep time (`years = ∞`) everything arrives at once.
- **Beams** (`beamEnergy(sv, energy, plea)`): queued with `at = lightAt(distance)`, `known = inStep(sv)` at sending. On arrival: `health += plea ? 0.12 + energy/600 : energy/400` (cap 1); if `known`: `feel(plea ? +15 : +energy/4)` and `aidGiven += energy`.
- **News** (`spreadNews(fromSystem, delta, what, except?, tag?)`): every other living survivor gets `{ at: lightAt(distLy(from, their home)), delta, what }`. On arrival `feel(delta, what)`; a great wrong (`delta ≤ −20`) is answered with a `heard` signal if they have contact and are in step ("The light of it has reached us: … We will not forget it.").
- **Their stars**: a star they claim is shown to us only once `lightArrived(claimedAt + distLy(our capital, that star))` (`seenThere`); their home star is always shown once contacted. `residentsOf` (no delay) still blocks settling the world they live on.
- Bends, as coded: raids on us, our raids' answers, the `arrived` message and every Hunger effect are immediate (`distanceLy: 0`).

#### D.2.5 Each survivor's turn: `updateSurvivors(state, logL, mods, L)`

One `withRng`; survivors in `Object.values` order; dead ones skipped. `myClock = voiceRange(state, logL)` (D.3.2). For each living survivor, in this order:

1. `reachThem`: a proposal whose light has arrived is weighed (D.2.10); arrived beams applied; arrived news applied.
2. `onTheirWay`: once their exodus has left (`lightArrived(exodus.leaves)`) they do nothing else; at `exodus.at` they arrive among us (D.2.11). `continue`.
3. Taint ceiling: `ceiling = 100 − 1.5 × taint`; if `disposition > ceiling`, `disposition = max(ceiling, disposition − 2)`.
4. `sanctuaryTrust` (D.2.11).
5. Clock drift (D.2.3).
6. Drain, health, population (D.2.6).
7. `wakeForNewStar` (dormant only); if it did not set out, `expand` (D.2.12).
8. `judgePromise` (D.2.12).
9. Contact (D.2.7); on first contact `continue`.
10. `talk = contact && canConverse(myClock, clock, span)`.
11. Fading (health ≤ 0.02, D.2.6) → `continue`.
12. Not contacted → `continue`.
13. `talk && askRefuge` → `continue`. 14. `talk && askAgainstHunger` → `continue`.
15. If `turn − lastSent < 5`, or not `talk`, or on exodus → `continue` (the five-turn message gap; it gates everything below, raids included).
16. `choirWish` → `continue`. 17. `theirPacts` (renounce or offer) → `lastSent = turn`, `continue`.
18. One of, in this `if/else` order (each sets `lastSent = turn`):
    - **Plea for aid**: `!war && health < 0.45 && no Mutual Aid && chance(0.55)`.
    - **Refugees**: `!war && health < 0.3 && charter Sanctuary && chance(0.5)`.
    - **Raid on us** (D.2.9).
    - **Shared work**: `disposition > 35 && health > 0.4 && !civ.flags['joint_<id>'] && offerDue('joint')`.
    - **Trade**: `offerDue('trade')` and `tradeOffer` not null.

Draws are conditional exactly as these `&&` chains read (a `chance` is drawn only if every condition before it holds).

#### D.2.6 Drain, health, population and fading

```
base by calendar era: Dusk: (light of their home star < 0.3 ? 0.03 : 0.004)   // physics sourceLight
                      Degenerate 0.02, Black Hole 0.025, Dark 0.04
drain = base × WAY_DRAIN[way] / (0.5 + 0.5 × gfe)
      × 1.4  if garden and protons decay and η > 37.5
      × 2    if dormant and the Long Flow is running (flowing)
      × claimEase = 1 / (1 + 0.25 × min(3, stars held beyond the first))
      × 0.85 if drawTheirSpin(sv) > 0   (Black Hole calendar age; D.2.14)
health = clamp(health − drain + U(−0.004, 0.006), 0, 1)
pop    = max(0, pop × (0.98 + 0.03 × health))
```

**Fading** (`health ≤ 0.02`, checked after contact, whether or not we can hear them): `alive = false`, `fate = 'faded'`; a pending exodus is cancelled ("Our answer reached X too late…"). On each of their stars, the first body that is not Deep, has no relic and is not dissolved gets a **tomb** relic (`state: 'found'` if we had contact, else `'hidden'` for a survey to find). If we had contact: if we raided them within the last 10 turns they send nothing; otherwise a `last` signal ("This is the last of us. We are sending everything we know, in case it helps. Remember that we were here. Remember that we tried.") carrying `insight = round(60 + 4 × pop)`, credited to the insight bank when it arrives (D.0 step 8).

#### D.2.7 Contact

Contact is made when `civ` has the tech Deep Listening, **or** `distanceToThem ≤ 25 × mods.detect` (detect starts at 60 ly; 3×10⁵ in the Degenerate calendar age, 10⁷ later), **or** we have surveyed their home star (`known === 2`). Then `contact = true`, their home star known, event `first_contact` queued with `{ survivorId, systemId, name, star, dist, age: formatYears(dist), words }`, and a `hello` signal sent from `dist` ly (so it arrives after the light-time). The UI pings their star in their colour.

#### D.2.8 Regard (disposition), memory and the breakdown

`feel(sv, delta, what)`: `disposition = clamp(disposition + delta, −100, 100)`; if `|delta| ≥ 1`, push `{ turn, delta: round(delta), what }` onto `memory`, keeping the last `MEMORY = 8`. The Signals card's tooltip ("why they feel as they do") lists memory newest first as "Turn N: what (±d)", adds "The Hunger in us: no one thinks better of us than C." when Taint > 0, and "Sanctuary: their trust in us grows, toward X." while Sanctuary trust applies.

What moves regard (direct unless marked "news", which arrives at light speed; "others" means everyone else via `spreadNews`):

| Cause | Them | Others (news) |
|---|---|---|
| Energy beamed (unasked, known) | +energy/4 | |
| Plea answered by beam (known) | +15 | |
| Refused their plea | −12 | |
| Took in refugees / turned away | +10 / −8 | |
| Joined shared work | +10 | |
| Traded | +3 | |
| We asked them for help (again within 24 turns) | −6 (−12) | |
| Our raid on them | −35 | −10 |
| Our warships fought / broke a swarm at their star (`foughtFor`) | +5 / +20 | +5 (broke only) |
| Promise kept / broken (swarm still there) | +10 / −10 | |
| Kept our Echoes from the Choir | −5 | |
| Let our Echoes go to the Choir | +12 (news) | |
| Told them of a new star (event choice) | +8 (and health +0.08) | |
| Broke a pact with them | −25 (news) | −10 |
| Declared war on them | −40 (news) | −15 (−5 with a just cause) |
| Made peace | +10 (news) | +3 |
| Took someone in (saved/absorbed) | | +8 |
| Seized a star | | −30 (−10 with cause) |
| Devoured someone | | −40 |
| Sanctuary enacted / repealed | | +10 / −10 (tagged) |
| Tessellate ends pacts after 2 breaches | −15 | |
| Taint | capped at `100 − 1.5 T` | |
| Sanctuary (while it stands) | +0.5 a turn up to `min(25, ceiling)` | |

#### D.2.9 Their requests and offers, and raids

- **Plea for aid** (`aid`): `ask = round(20 + 50 × (1 − health))`. Choices `give` ("Send N energy") / `refuse`. Give: they must be alive; we need the energy; energy is beamed as a plea; our resolve +1. Refuse: `feel −12`.
- **Refugees** (`refugees`, only under Sanctuary): `n = max(1, round(pop/8))`. Accept: needs a capital; `newcomerThread(sv)`; `settleNewcomers(thread, n)` places them where there is room (capital first, then others; Kin overflow into free Cold Sleep berths); if 0 fit → error; `pop −= 2 × came`; `feel +10`; resolve +3; `civ.flags.refugees += came`. (No alive check: an accepted message from a civilization that has since faded still brings its refugees.) Refuse: `feel −8`.
- **Shared work** (`joint`): costs 60 matter; sets `civ.flags['joint_<id>'] = 1`; their health +0.15; `feel +10`. While they live and are not at war with us it pays **+6 energy a turn** (× pace factor). Decline counts as a refusal (back-off below).
- **Trade** (`trade`, `dealings.ts`): terms by way:

| Way | Wants | Share of the project | Rate (insight per unit) | Every (turns) |
|---|---|---|---|---|
| garden | matter | 0.20 | 2 | 22 |
| upload | energy | 0.30 | 3 | 16 |
| chorus | energy | 0.25 | 2.5 | 18 |
| dormant | energy | 0.20 | 2 | 40 |
| lattice | matter | 0.22 | 2.5 | 18 |
| fork | Kin: garden terms, else upload terms | | | 24 |

  `tradeOffer`: want switches to energy once matter is gone; subject = our current research, else the cheapest available tech; `worth = round(cost × share × (0.6 + 0.4 × health))`; `ask = min(round(worth/rate), 80, floor(held/2))`; no offer if `ask < 10`; `insight = round(min(worth, ask × rate))`. Accept: pay `ask`; the insight goes to the named tech if still unresearched, else to the current project, else the bank; their health +0.05; `feel +3`.
  Rhythm (`offerDue`, `offered`, `answered`; keys `trade_next_<id>`, `trade_no_<id>`, same for `joint`): never at war; not before `next`; the Tessellate offers whenever due, others with `chance(0.35)` (`OFFER_CHANCE`). Sending sets `next = turn + every`. A yes resets the refusal count and sets `next = turn + every`; a no increments it (n) and sets `next = turn + every × min(8, 2ⁿ)`. A lapsed offer changes nothing.
- **Their raids on us**: condition `(health < 0.22 || (raidedAt set && disposition < −50) || (tempted within 10 turns) || atWar || inCoalition) && (disposition < −20 || atWar) && turn ≥ civ.flags['raid_wait_<id>'] && chance(atWar || inCoalition ? 0.5 : 0.35)`. Motive for the text: warring (war or coalition), revenge (we raided them), opening (they learned we were weak), desperate. `raidedUs` records `raid_last_<id>` / `raid_prev_<id>` (even when turned away). `took = round(min(0.2 × energy, 60))`. **Defended** if our capital has a Defense Grid or any fortified fleet at the capital's star: nothing taken and `raid_wait = turn + RAID_WAIT 15`. Otherwise energy −= took. A `raid` signal (distance 0) reports it.
- `tempted` is set when we ask a hostile civilization (disposition < −20) for help while our energy is under 40.

#### D.2.10 What we can do to or for them (player actions)

- **Send aid** (`sendAid(id, energy)`): alive, contacted, energy in hand; a beam (not a plea).
- **Ask for help** (`requestAid`): blocked if gone, not contacted, at war, not `inStep`, an `aid_answer` from them still on its way, or asked within `ASK_COOLDOWN = 8` turns. `feel −6` (−12 if asked within 24 turns). Answer: disposition < −20 → refused (sets `tempted` if our energy < 40); health < 0.3 → refused; else `reciprocity = min(30, aidGiven/5)`, `energy = round(max(0, min(60, pop × health × (0.4 + disposition/100) + reciprocity)))`, under 5 → deferred (0); otherwise their health −= energy/1200. The `aid_answer` signal travels **twice** the distance; the energy is credited when it arrives.
- **Raid** (`raidSurvivor(fleetId)`): the fleet must be a war fleet at a star where a contacted survivor lives; not within `RAID_COOLDOWN = 5` turns of the last raid on them. `raidedAt = turn`. `attack = raidStrength(star)` (every non-settler ship with attack there). Success if `attack × U(0.6, 1.4) ≥ 0.5 × max(1, 0.3 × pop × health)`: we gain `energy = round(min(60, 5 + 0.4 × reserve))` and `matter = round(8 + 0.6 × pop)`; their reserve −energy, health −0.06, pop ×0.96; each raider `−U(0, 1.5)` hp. Failure: each raider `−U(1, 3.5)`. Always: `feel −35`, news −10 to the others, our resolve −3, dissent +4, a `raided` signal. There is no pact or war check.
- **Devour** (`devourSurvivor`, needs charter Absorb the Weak; their health ≤ 0.4): `fate = 'devoured'`; energy `+80 + 3 pop`, matter `+60 + 4 pop`, taint +10, resolve −6, gfe −0.01, news −40.
- **Seize** (only in a war, D.2.13).
- Pacts and war below.

#### D.2.11 Pacts (`pacts.ts`)

| Pact | Kind | Their regard needed | Does |
|---|---|---|---|
| Mutual Aid | `aid` | 10 | whichever side is in trouble, the other beams help unasked |
| Open Archives | `archives` | 0 | a little insight every turn, and notes on a project every 10 turns |
| Shared Watch | `watch` | 20 | their stars are our eyes; each side a little stronger against the Hunger |

`PACT_KINDS = ['aid', 'archives', 'watch']` (this order matters). **Cost** in accord: `round(30 × 1.6ⁿ)`, `n` = pacts in force with living survivors + living survivors with a proposal out.

- **Propose** (`proposePact`): blocked if gone, not contacted, already in force, at war, a proposal already out, not in step, Taint ≥ 60, their regard < −20, or not enough accord. Pays the cost now; `proposal = { kind, at: lightAt(distance), cost }`. When it reaches them (`weighProposal`): `need = PACTS[kind].need − 15 (Tessellate) − 15 (aid while their health < 0.5)`; yes if `disposition ≥ need && taint < 60`. They send `pact_answer` back over the same distance (`data: { pact, yes, refund }`); on arrival `answerArrived` seals it (`pacts[kind] = turn`) or refunds the accord.
- **Their offers / renouncing** (`theirPacts`, inside the message gap): with any pact and regard < −10 (never the Tessellate), they end every pact (`pact_ended` signal, no news). Otherwise, if not at war, regard > 30, fewer than three pacts, no proposal out, Taint < 60, and `chance(0.12)`: they offer the pact they need most: Mutual Aid if their health < 0.6 and they lack it; else Shared Watch if they lack it and an awake untamed swarm sits at or within 100 ly of one of their stars; else the first missing in `PACT_KINDS` order. Accepting costs the current price (no Taint or regard check at acceptance).
- **Breaking** (`endPact`): news −25 to them, −10 to the others.
- **Each turn** (`pactsTurn`, after `updateSurvivors`; `cap` = our reserve capacity):
  - Mutual Aid, ours: due when their health < 0.35 and 6 turns (`AID_EVERY`) since the last (`pact_aid_out_<id>`). `spare = energy − 0.3 cap`. If `spare < 5` and they are the Tessellate: the out-flag is set to this turn and a **breach** is logged (D.2.14); if that ended the pact, stop. Then, if `spare ≥ 5`: energy −e and beam `e = floor(min(15 + 100 × (0.35 − health), spare))` as a plea, set the out-flag, log "As our pact says, we beamed e energy to X." (Toward others than the Tessellate, an unaffordable due turn simply passes.)
  - Mutual Aid, theirs: when we are weak (`energy < 0.15 cap` and last turn's net energy < 0), they are able (health > 0.4, or the Tessellate with health > 0.05), and 6 turns since the last (`pact_aid_in_<id>`): `e = round(min(60, max(8, 0.8 × pop × health)))`, their health −e/1200, an `aid_answer` signal over twice the distance.
  - Open Archives: `0.5 + 0.02 × pop × health` insight a turn to the current project (else the bank); their health +0.002; every 10 turns since sealed, notes worth `round(0.3 × techCost)` on the current project (else the cheapest non-taint available).
  - Shared Watch: in `updateDetection` each of their stars is an eye with our detection range; `defenseAt` +0.5 per Watch partner; a swarm's harm to a Watch partner ×0.7.

#### D.2.12 Refuge (`refuge.ts`)

- `DYING = 0.2`. A dying civilization that trusts us asks **once** (`exodusAsked`) to come: health < 0.2, not on exodus, and `mayComeToUs`: regard ≥ 0 and not at war, and (any pact; or Sanctuary and regard ≥ 20; or the Choir merging (we have the tech `mind_merging`) and regard ≥ 10).
- `n = exodusSize = max(2, round(pop / 3))`. `arrivalThread`: the Choir joins our Chorus if we have `mind_merging` (a **merge**), else comes as Echoes; others as `newcomerThread`. Minds cross as light; Kin by ship at `EXODUS_SPEED = 0.02 c`.
- Answer `take` (`takeThemIn`): `leaves = lightAt(distance)` (our answer's light), `at = leaves + distance / (light ? 1 : 0.02)`; our resolve +3. `refuse`: nothing (they go dark where they are).
- Arrival (`arriveAmongUs`): Echoes through `welcomeEchoes` (into free substrate, capital first; the rest wait in `civ.flags.echo_archive`); others through `settleNewcomers`; leftovers crowd into the capital (they then die off one a turn per Thread over capacity), or for a merge become memory worth `MEMORY_INSIGHT = 20` insight each. They bring `round(60 + 4 pop) + 20 × memory` insight. `fate = 'saved'` (or `'absorbed'` for the merge), `alive = false`, news +8, an `arrived` signal.
- **Sanctuary** (charter): enacting or repealing sends news ±10 tagged `sanctuary`; while it stands, a survivor with regard ≥ 0 that has no Sanctuary news still in flight drifts +0.5 a turn up to `min(25, Taint ceiling)`; it also enables refugee offers.

#### D.2.13 Expansion, the Hunger's pleas, war

**Expansion** (`claims.ts: expand`, their turn): if a claim is out and its arrival time has come, the claim is cleared; if the star still exists and neither we nor another living survivor hold it, it joins `systems`, `claimedAt[star] = years`, health +0.05. Otherwise, a thriving civilization (health > 0.5, pop ≥ 12, fewer than `MAX_CLAIMS = 3` stars beyond its first) sends settlers with `chance(0.06)` (drawn only if those hold) to `claimTarget`: the nearest star within `CLAIM_REACH = 100` ly of any of theirs that is not gone, ejected or `special`, not held or targeted by anyone, and `suits` their way (D.2.3). They travel at `CLAIM_SPEED = 0.02 c`.

**Pleas against the Hunger**: an awake, untamed, stationary swarm at one of their stars; not at war; no promise pending; at most once in `PLEA_EVERY = 10` turns (`swarm_plea_<id>`). Choices `promise` / `refuse`. A promise gives us `PROMISE_TURNS = 10` turns; `foughtFor` at that star marks it kept. After 10 turns: kept → +10; not kept and the swarm still there → −10; else nothing.

**War** (`war.ts`):
- Declare (`declareWar`): needs contact, not already at war, not on exodus, `WAR_ACCORD = 60` accord. A **just cause** (`warCause`): they are a fork, or they raided us twice within `RAID_SPAN = 20` turns and the last within 20 turns. Costs: accord −60, resolve −5, dissent +8, every Thread's standing −3 (−1 with cause); all pacts ended through `endPact`; proposal and promise dropped; `war = { since: turn, siege: 0 }`; `civ.flags.wars++`; news −40 to them, −15 (−5) to the others.
- Each turn (`warTurn`): dissent +0.5 (+0.2 with cause). If we have warships (`raidStrength > 0`) at their home star the siege count rises, their health −`BLOCKADE` 0.03, and each of our ships there loses `(def / (attack + def)) × 1.2 × (0.5 + rand)` hp, where `def = warDefence = max(1, 0.3 × pop × health) × (1 + 0.15 × turns at war)` (`ARMING`); without warships the siege resets to 0.
- Seize (`seizeSurvivor`): only at war, with warships at their home star and `siege ≥ SIEGE_TURNS = 3`. Win if `attack × U(0.6, 1.4) ≥ def`; every raider there loses `U(0, 1.5)` hp on a win or `U(1, 3.5)` on a loss. Loss: siege 0, resolve −2. Win: `fate = 'seized'`; a fork's every star becomes our colony again with `max(1, round(pop / 2 / places))` of its Thread each; otherwise we take the world they lived on with `max(1, round(pop / 6))` (Lattice, Kin or Echoes by way); resolve −3 (−8 without cause), dissent +4 (+10), Taint +5 without cause, news −10 (−30).
- Coalition: anyone with regard < −20 while we are at war with anyone raids us at 50%.
- At war: no pacts, offers, asking, aid pleas, refugees, trade, shared-work income, refuge or swarm pleas. War heat draws swarms (D.1.5). Peace (`makePeace`): news +10 to them, +3 to the others.

#### D.2.14 Ways that meet (`ways.ts`)

- **The sleepers wake** (dormant): not with a claim out, health > 0.25, fewer than 3 claimed stars: the nearest **new star** (collision star, helium star, helium giant) still burning within `WAKE_REACH = 100` ly of any of theirs, not ours or anyone's, with a cold world (barren, ice, ocean ice) → a claim set at once (`years + d / 0.02`) and, if contacted and in step, a `woken` signal.
- **The Tessellate keeps its agreements**: never renounces pacts; pays its side of Mutual Aid while its health > 0.05; and when its due Mutual Aid finds us unable to spare 5 energy it logs a breach (`breach_<id>`); at `BREACHES = 2` it ends every pact (`pact_ended`), `feel −15`.
- **The Choir gathers Echoes**: not at war, its health > 0.4, regard > 20, at most once in `CHOIR_EVERY = 25` turns (`choir_wish_<id>`), we have at least 4 Echoes. `let`: `CHOIR_TAKES = 2` Echoes leave (from the colonies with most Echoes), our Echoes' standing +3, news +12, its pop +2 and health +0.04 each. `keep`: Echoes' standing −3, `feel −5`.
- **A partner keeps a new star's clock** (`flare.ts: clockPartner`): a living survivor with any pact, not at war, holding that star halves the energy cost of keeping time with it.
- **A hole's spin is a commons** (Black Hole calendar age): at each of their black-hole stars they draw `min(spin, 0.04 × pop × health × (any pact ? 0.5 : 1))` from the hole's spin (`SPIN_DRAW`), which also eases their drain ×0.85.

#### D.2.15 Forks and the Woken

- **Fork** (`society.ts`): a conscious Thread other than the Lattice, with at least 3 pops, whose standing stays below 15 while dissent is above 45 for 3 turns in a row, leaves. It takes every non-capital settlement where it is at least half the people, and half (rounded up) of its people elsewhere. Our standing for it resets to 45, dissent −25, resolve −8. A survivor `{ id: uid('fk'), name: The Returned / The Unmoored Echoes / The Other Choir / The Loose Lattice / The Far Cold, adjective 'Forked', color '#b7a58f', way 'fork', forkOf, health 0.8, reserve 20, disposition −15, clock 2, contact: true, lastSent: turn, memory: [we left you −15] }` is created at the stars it took, or with none at the nearest known star no one lives at.
- **The Woken** (from waking the sleeper vault): dormant way, pop 14, health 0.7, reserve 10, regard −30, clock 6, contacted, at the vault's star.

#### D.2.16 At the crossings

- The Last Light: health −0.6 garden, −0.15 dormant, −0.35 others.
- The end of matter: gardens and forks fade (`fate = 'faded'`); others −0.45.
- The Degenerate Age ending without the end of matter: everyone −0.25. The Last Horizon: everyone −0.4.

#### D.2.17 Fates

The outcome screen lists each survivor: still out there / saved / lives on within you (absorbed) / taken by force (seized) / devoured / faded.

---

### D.3 Signals and messages (`sim/signals.ts`)

#### D.3.1 The Signal record and delivery

```
Signal { uid, from /* survivor id, 'astronomers', or a stranger mind's id */, kind,
         sentYears, arriveYears, arrivedTurn: number|null, title, text,
         data: Record<string, number|string>, choices: {id,label,hint?}[], resolved: string|null }
```

- `sendSignal`: `arriveYears = years + max(0, distanceLy)`; if years are infinite or the distance ≤ 0, `arriveYears = years`. `resolved = null` if there are choices, else `'read'`. Pushed onto `state.signals`.
- `deliverSignals` (step 8): every undelivered signal with `years ≥ arriveYears` (or years infinite) gets `arrivedTurn = turn` and a log "Signal: <title> (sent <age> ago)" (the age only if > 1 year).
- **Lapse**: an arrived, unresolved signal more than 8 turns after its arrival becomes `'lapsed'` (no consequences run), except messages from one stranger mind that carry choices (`waitsForAnswer`, sealed, S.1), which wait for ever.
- **Cap**: beyond 160 signals the oldest are cut, except waiting unresolved messages of that mind, which are kept at the front.
- Messages from the gone: a message already in flight still arrives after its sender has faded. The `last` transmission is an archive (no choices). Answering a stale message: aid "They are gone…"; exodus, Choir, promise and pact offers check `alive`; refugees, shared works and trades do not (a trade still delivers its insight; a shared work's income needs them alive).

#### D.3.2 Voice range and conversing

- `voiceThread`: our most numerous Thread other than the Lattice (ties to the first in `[kin, echoes, chorus, lattice, coldminds]`); null if none.
- A Thread's clock at this turn is `clamp(logL, clockMin, clockMax)`: Kin 1.6 fixed; Echoes 0 to `echoMax` (1.6 base, raised by research); Chorus 0.5 to `echoMax − 1.5`; Coldminds 4 to `echoMax + 6`; the Lattice is strain-immune (its clock is `logL`).
- `voiceRange(state, logL) = [min(v, logL), max(v, logL)]` where `v` is the voice Thread's clock (or `logL` with no voice): any rhythm from how fast our dominant minds think to our turn's length.
- `stepGap(range, c)` = `c − lo` if below, `c − hi` if above, else 0. `canConverse(range, c, span = 3) = |stepGap| ≤ span`. With survivors `span` is 3 (6 for the Tessellate).
- `inStep(sv)` uses the **coming** turn at the current pace; `updateSurvivors` uses this turn's `logL`.
- `reachBy(theirs, span)` gives the nearest choosable pace that would reach a mind, the tenfolds our turn would need, and which other Threads of ours would reach it; the Signals card shows "In reach: we can talk." or "Too slow/fast for us: …".

#### D.3.3 Message kinds

| Kind | From | Choices | Effect on answer |
|---|---|---|---|
| `hello` | survivor | | first contact |
| `aid` | survivor | give / refuse | D.2.9 |
| `refugees` | survivor | accept / refuse | D.2.9 |
| `joint` | survivor | join / decline | D.2.9 |
| `trade` | survivor | trade / decline | D.2.9 |
| `pact_offer` | survivor | accept / decline | D.2.11 |
| `pact_answer` | survivor | | seals or refunds on arrival |
| `pact_ended`, `breach` | survivor | | |
| `aid_answer` | survivor | | energy credited on arrival |
| `exodus` | survivor | take / refuse | D.2.12 |
| `arrived` | survivor | | |
| `choir_wish` | the Choir | let / keep | D.2.14 |
| `swarm_plea` | survivor | promise / refuse | D.2.13 |
| `woken` | sleepers | | |
| `heard` | survivor | | a great wrong seen |
| `raid`, `raided` | survivor | | |
| `last` | survivor | | insight on arrival |
| two astronomers' kinds and the stranger minds' kinds | | | sealed, S.1 |

`answerSignal` routes stranger-mind messages to their own handler (sealed) and every other to `resolveSurvivorSignal`, which returns an error string (the message stays open) or sets `resolved = choice`.

---

### D.4 Events (`data/events.ts`, `sim/events.ts`)

#### D.4.1 The model

```
EventDef { id, title, art /* dusk|degenerate|blackhole|dark|flare|ruins|hunger|sleepers|survivor|slow|finds/<id> */,
           plate?, eras?: EraId[], weight?, once?, bind?(state, rng) => data|null,
           text(state, data), choices: { label, hint?: string | (s,d)=>string, ok?(s,d), run(s,d,rng) => string|void }[] }
PendingEvent { uid, defId, data }
```

The data tables (titles, choices and hints) are in the appendix (`data.json`); this section gives the machinery and what the hints do not say.

#### D.4.2 Queueing

- `queueEvent(defId, data)`: ignored if `once` and `state.fired[defId]` is set, or if an identical pending event exists (same `defId` and the same `JSON.stringify(data)`). Pushes `{ uid: uid('ev'), defId, data }`; a `once` event records `fired[defId] = turn` at queueing.
- Relic and anomaly events are pushed straight onto `pending` by the survey (bypassing these checks).

#### D.4.3 The random pool: `rollRandomEvent` (step 8, after the scripted ones)

- Skip if more than one event is pending. One `withRng`: `chance(0.22)` or stop.
- Pool: every event with `weight > 0`, whose `eras` (if given) include `state.era` (the age the player sees, not the calendar's), not a fired `once` event, not rolled within the last 12 turns (`fired['last_<id>'] > turn − 12` excludes it), and whose `bind` (called with the RNG, in list order) returns data (non-null).
- `rng.weighted(pool, weight)`; `fired['last_<id>'] = turn`; `queueEvent`.

| Pool event | Ages | Weight | Once | Condition (`bind`) |
|---|---|---|---|---|
| `superflare` | Dusk | 6 | | homeworld settled, its star a red dwarf |
| `last_rain` | Dusk | 10 | yes | homeworld settled, vitality < 0.55 |
| `sea_freezes` | Dusk | 10 | yes | living homeworld settled, vitality < 0.32 |
| `who_sleeps_first` | Dusk, Degenerate | 5 | | a starving colony with > 1 Kin and a Cryo Hall |
| `mantle_settles` | Dusk | 4 | | homeworld settled, core heat > 0.25 |
| `derelict_ark` | Dusk, Degenerate | 3 | yes | |
| `comet` | Dusk | 3 | | |
| `prophet_of_stillness` | Dusk, Degenerate | 3 | yes | |
| `first_upload` | Dusk | 12 | yes | tech `upload` |
| `echo_drift` | any | 4 | | ≥ 3 Echoes |
| one more | any | 3 | yes | sealed, S.3 |
| `chorus_invitation` | any | 3 | | ≥ 1 Chorus and ≥ 2 Echoes |
| `hunger_mirror` | any | 4 | yes | tech `command_language` |
| `embers_dim` | Degenerate | 20 | yes | the halo's own η between 22.3 and 25 |
| `horizon_whispers` | Black Hole | 3 | yes | |
| `forgetting` | Dark | 8 | | Continuity < 45 |
| `positronium` | Dark | 4 | | fate not stable |
| `false_vacuum` | Dark | 3 | yes | |
| `mind_from_nowhere` | Dark | 2 | yes | η > 1000 |

#### D.4.4 Scripted events

| Event | Queued by |
|---|---|
| `dynamo_fails` (once) | step 8 when the new turn is 3 |
| `first_night` (once) | step 8 when the new turn is 7 |
| `rust_in_the_belt` (once) | `firstSwarm`, or the step-8 fallback (D.1.7) |
| `first_contact` | first contact (D.2.7) |
| `last_flare` | a settled star's blue-dwarf flare begins (flare domain) |
| `new_star`, `white_fire`, `helium_giant`, `supernova`, `unmoored`, `world_falls`, `cast_out`, `final_burst` | `handleNotes` (universe notes, step 7) |
| `proton_answer` (once) | completing the Proton Question tech |
| `decay_shown`, `curvature_shown` (once) | the fate revealed near η 30 |
| `long_flow` (once) | the Long Flow (η 65) |
| `positronium_forms` (once) | Black Hole age, η ≥ 85, fate not stable (after the random roll) |
| one more | sealed, S.2 |

#### D.4.5 Resolving a choice: `resolveEvent(uid, index)`

The choice's `ok` must pass ("That is not possible now."). `run` executes inside `withRng`; the event is removed; a log `"<title> (<star>): <label>."` (kind `event`) is written; for `relic_*` and `anom_*` events the label is stored in `body.lore[defId]` so the survey report can be reopened from the world ("We chose: …"). A string returned by `run` is shown as a result modal ("Continue") before the next event. Event helpers floor energy and matter at 0, so a cost larger than our store is simply taken to 0 (only a few choices have an `ok` check). The UI shows `pending[0]` as a modal (one at a time); the HUD is inert while one is pending; the view can swing to the event's star (a preference).

Effects not stated in the hints:

- `dynamo_fails`: "shield" adds 30 to Magnetospheric Engineering and selects it if nothing is being researched; "digging" adds 40 to Deep Warrens likewise. `rust_in_the_belt` adds 50 to Hunger Studies or 40 to Orbital Defence (without selecting).
- `derelict_ark` "Wake them": also Kin standing −1. `superflare` "underground" costs 4 instead of 12 with `civ.flags.flare_warning` (set by the Flare Glass find), and both choices cut vitality (−1% / −4%).
- `new_star` "Study", `white_fire`/`helium_giant` "Watch": insight +25, resolve +2, the system charted. "Keep time": charts the system and keeps time with the star (flare domain); offered only while `starClockOffer` holds. `new_star` "Tell the others": every contacted survivor health +0.08 and regard +8.
- `supernova`: every system within 20,000 ly becomes known.
- `unmoored` "Evacuate": energy −20; half of each Thread (rounded down) moves to the capital (Echoes via `welcomeEchoes`), unless the colony is the capital. `world_falls` "Evacuate": everyone and their cryo to the capital; both choices reveal the feeding model.
- `forgetting` "Sleep deeper": pace `max(−2, pace − 1)`. Relic strip options pay ×2 under Salvage the Dead, ×3 (and Taint +2) under Consume the Dead.

#### D.4.6 Relics (found by survey)

Generation gives 11% of non-Deep, non-gas-giant bodies a hidden relic, kind weighted archive 1, engine 1, tomb 1, ghosts 1, sleepers 0.6; the home system's cold super-Earth has a tomb; one sleeper vault (a white dwarf system, `special: 'sleeper'`) is placed in the last of the shuffled other reaches. A faded civilization leaves tombs (D.2.6). `survey(system)` (any ship arriving at an uncharted star, or stationed at one) sets `known = 2` and, for every body with a hidden relic that has not flowed and is not dissolved, sets `state = 'found'` and pushes `relic_<kind>` with `{ bodyId, systemId }`. Choices set `relic.state` to `studied`, `spent` or `woken`; any relic no longer `hidden` (whatever its state, unless it has flowed) can host a Relic Excavation.

- `relic_engine` "Restart it": energy +70; with `chance(0.3)` the nearest awake swarm within reach turns toward it (`drawSwarmTo`, logged).
- `relic_ghosts` "Run them again" needs Mind Substrate.
- `relic_sleepers` "Wake them": energy −60, then one draw `r`: `r < 0.45` three Echoes join (`welcomeEchoes(3)`) and insight +120; `r < 0.75` they leave as The Woken (D.2.15); otherwise resolve −6 and an awake size-3 swarm appears at the vault's star. "Devour the vault" needs Strip the Sleepers.

#### D.4.7 Anomalies ("finds")

`ANOMALIES` are appended to the event list as `anom_<id>` with `art: 'finds/<id>'` (never rolled at random). In `survey`, one draw `chance(0.3)`; if it passes, every pair (world, anomaly) is listed for non-dissolved worlds of the system that carry no anomaly trait yet, for anomalies found fewer than 2 times this game (`fired['anom_<id>'] < 2`) whose `fits` holds; `rng.pick` one; the world gains the trait `<id>` (shown as `name`, with `tip`), `fired['anom_<id>']++`, and the event is pushed with `{ bodyId, systemId }`.

| Find | Fits |
|---|---|
| `vent_life` | ocean-ice or subsurface-ocean world, not ours, not a steam world |
| `fossil_reactor` | rocky (barren, super-Earth, terran, eyeball, ice), not ocean ice |
| `diamond_mantle` | super-Earth or barren, mass > 1.5 Earth |
| `primordial_hole` | asteroid belt |
| `interstellar_shard` | belt or barren |
| `fossils` | barren, super-Earth, terran or ice; not a steam world |
| `flare_glass` | barren or super-Earth at a red, blue, white or black dwarf |
| `clathrates` | ice, ocean ice or ice giant; not a steam world |
| `lens` | any |
| `sail_graveyard` | belt or Deep |
| `resonance` | ice, ocean ice, eyeball, terran or super-Earth in a system of ≥ 4 bodies |
| `magnetar_print` | rocky at a neutron star |
| `warm_rogue` | rocky rogue world |

Effects beyond the hints: Flare Glass "Read the record" sets `flare_warning`; Lens maps every unknown, not-gone star within 400 ly; Warm Rogue also sets vitality to at least 0.3; Resonance and Warm Rogue add 0.2 core heat (cap 1); Diamond Mantle adds 0.8 richness; Clathrates 0.8 hydrogen. Primordial Hole's text names the mass of a hole finishing its evaporation now: `5.1×10¹¹ × ∛(max(1.38×10¹⁰, years) / 1.38×10¹⁰)` kg.

#### D.4.8 Plates

`Plate({ art, plate })` (`ui/screens/Story.tsx`), 220 px high, layers: `url(art/events/<plate>.webp)` (if the event has a plate), over `url(art/<art>.webp)`, over a radial gradient tinted by art: dusk `#3a1a10`, degenerate `#141c2c`, blackhole `#1c1430`, dark `#0c0d10`, flare `#4a1c0c`, ruins `#241c16`, hunger `#2a0e0c`, sleepers `#10202a`, survivor `#1e1a14`, slow `#161a28`, else `#15141a`. Events with a plate of their own (16 paintings): `dynamo_fails`, `first_night`, `last_rain`, `sea_freezes`, `who_sleeps_first`, `mantle_settles`, `comet`, `prophet_of_stillness`, `first_upload`, `new_star`, `white_fire` (also used by `helium_giant`), `supernova`, `cast_out`, `unmoored`, `world_falls`, `final_burst`. Finds use `art/finds/<id>.webp` (13 paintings). Survivor cards use `art/way_<way>.webp`; the swarm panel `art/swarm.webp` or `art/swarm_tamed.webp`.

---

### D.5 Endings and the game over (outside view)

- Endings come in three kinds: victory (by completing a Great Work under its conditions), endurance, and defeat; one more outcome kind exists. Their titles, conditions and texts are in the sealed section (S.4). `state.outcome = Outcome { kind, ending, turn, eta }`; once set, `endTurn` returns immediately and the End Turn button is disabled.
- When the game checks: `checkEndings(state)` at the end of every turn (step 10), and `checkEndings(state, atLastHorizon = true)` in step 9 before the crossing out of the Black Hole Age (when that age is over, or when no black hole is left), returning before the crossing runs if an ending holds. The despair counter is advanced only by the end-of-turn check.
- Great Works (`data/works.ts`; their table is sealed) take half the insight while a project is also researched, all of it otherwise; a finished Work logs "The Great Work is complete." and the ending check then decides.
- UI (`ui/turnflow.ts`, `Story.tsx: OutcomeScreen`): after `endTurn` the game autosaves; an outcome opens the outcome modal at once (before any crossing screen) and the music mood becomes `outcome`. The screen shows a heading by kind, the ending's title and epilogue, "You endured <years> and <turns> turns. N of you remain: …" by Thread, each neighbour's fate, and the buttons "Look around" (close; the galaxy can be explored, no more turns) and "Main menu".

---

### D.6 The autoplayer (`src/game/auto.ts`) and the harness (`tools/sim.ts`)

#### D.6.1 Strategies

`Strategy = 'competent' | 'passive' | 'warlike'`. **Passive**: research the cheapest available tech when idle; answer every pending event with choice 0 and every arrived open signal with its last choice. **Warlike** = competent plus `planWar`. **Competent**, each turn before `endTurn`, in this order:

1. `planEvents`: for each pending event, the first choice whose `ok` passes, whose label + hint does not match `/Taint|Devour|Strip/`, and (for choice 0 of `new_star`, `white_fire`, `helium_giant`) whose star clock costs nothing or would leave at least half the reserve capacity; else the last choice.
2. `pickResearch`: pause research (`auto_paused`) when net energy < 0 and energy < 12% of capacity; resume once energy ≥ 35%. Up to 6 picks a turn (a pick already covered by banked insight completes at once, so it picks again): the first available tech in `TECH_PRIORITY`, else the cheapest non-taint available tech (this fallback ignores `noAuto`, so it does research Halo Siphons). `TECH_PRIORITY`, verbatim: Dusk `energy_storage, magnetospherics, the_long_record, orbital_collectors, survey_optics, mind_substrate, fusion_drives, hardy_lineages, subterranean_cities, orbital_industry, fusion, upload, cold_sleep, slow_instancing, ember_harvest, orbital_defense, dyson_swarms, last_light_protocols, reversible_logic, hibernation_protocols, deep_listening, hunger_studies, magnetic_sails, comet_shepherding, assembly_of_threads, horizon_physics, accretion_engines, proton_question, deep_mantle, catalyzed_drives, mind_merging, halo_dynamics, pulsar_braking, hunger_lures, terraforming`; Degenerate `cold_computation, glacial_cognition, relativistic_arks, deep_time_protocols, baryon_decay_harvest, curvature_harvest, leptonic_computation, penrose_process, great_decay_protocols, hawking_capture, deep_storage, brown_dwarf_mining, accretion_modelling, burst_capture, horizon_storage, abyssal_thought, gravitic_semaphore, quickening, garden_arks, aegis_lattices, command_language`; Black Hole `bastion_architecture, horizon_cognition, error_correction, hawking_patience, last_horizon_protocols, conformal_mathematics, archive_theory, total_confluence, ultimate_slowness`; Dark `asymptotic_mind, horizon_siphon, garden_of_embers`.
3. `planCharters`: enact any available of Open Archives, Right to Stop, Thread Parity, Merge Consent, Sanctuary, The Long Watch, Lattice Compact (in that order). Never a dark charter; never repeals.
4. `planPacts`: for each survivor, the first pact in `PACT_KINDS` order not held whose need ≤ their regard; propose if not blocked and accord ≥ cost + 30; at most one a turn.
5. `planAccord` (keep 30): Rally if resolve < 40; Calm if dissent > 40; Hear the lowest conscious Thread with standing < 35.
6. `planThreads`: per colony, twice: if Kin strain > 2 orders and Kin > 1, upload one (else freeze); if Echo strain > 0.5, cool one; late Dusk (η > 13.995) freeze Kin.
7. `planFlow`, 8. `planDismantle` (take apart collectors whose source is gone for good when matter < 40), 9. `planBuilds` (a priority list per colony by age, energy first when net < 3 or the reserve < 25%; Defense Grids while any untamed awake swarm exists; Leptonic Substrate rushed before the end of matter), 10. `planFleets` (settlers to the best `settleScore`; probes to the nearest known uncharted star with no swarm seen when energy > 20; settler ships while affordable; a probe every 25 turns if fewer than 2), 11. `planSignals`, 12. `planPace` (moves pace only for energy), 13. `planWorks` (starts the first Great Work, in a fixed order, whose tech, age and requirement allow).

`planSignals` answers every arrived open signal: aid → give if energy > 3 × ask; refugees accept; exodus take; Choir let; pact offer accept if accord ≥ cost + 30; joint join if matter > 120; trade if what they want > 3 × ask; swarm pleas refused (last choice); the stranger minds' messages by fixed choices (sealed, S.1.7); if the answer fails it falls back to the last choice.

Blind spots (the harness cannot measure these): it never attacks swarms, tames, absorbs, lights beacons, raids, asks for aid, seizes (unless warlike), devours, terraforms, shuts Halo Siphons, or chooses music tracks.

#### D.6.2 The harness

`npm run sim -- [games=4] [length=standard] [strategy=both] [--diff=standard] [--fate=decays|stable|curvature] [--from=0] [-v]` (`tsx tools/sim.ts`). `both` runs `competent` then `passive`. Game `g` (from `--from`) uses seed `1000 + 7919 g` and `newGame({ seed, length, survivors: 3, difficulty, protonFate })` (default protonFate `unknown`: the fate is drawn). Each turn: `autoPlay` then `endTurn`, until an outcome or 1,200 turns ("unfinished"). Turns are counted by `state.era` after each turn. With `-v` a status line every 20 turns. One line per game:

```
seed S: KIND "Ending" at turn T (era, η E) turns/era {"dusk":a,"degenerate":b,...} pops P techs N taint X
halo H[ wars W] fate F gfe G%[ [from->to pops a->b] ...] | Adj:alive|fate[+N][[ars]] ... | ms
```

`halo` is a stage number of one of the stranger minds (sealed). Neighbours: `alive` or their fate, `+N` stars beyond the first, pacts in force (`a` aid, `r` archives, `w` watch). `tools/tally.sh` counts lines starting `seed `: survive = VICTORY + ENDURANCE, victories, and the mean Degenerate turns; the 900-game run is three slices of 300 (`--from=0,300,600`) and `grep "fate <f> "` splits by fate.

#### D.6.3 Balance reference (today's game, `main`, 12–15 Oct, `tools/sim.ts 300 standard competent`)

| Run | Survive | Victories | Degenerate Age (mean turns) |
|---|---|---|---|
| 300 games | 154 | 72 | 72 |
| 900 games | 456 | 203 | 71 |
| 900, protons decay | 189 / 450 (42%) | | |
| 900, stable | 168 / 239 (70%) | | |
| 900, curvature radiation | 99 / 211 (47%) | | |

Noise: about ±12 survivors in 300 games; two runs of 900 can differ by about 30. The project check of 15 Oct reproduced 300 games game for game. A replica playing the same seeds should land within this noise; exact line-for-line agreement requires identical RNG consumption order everywhere.

## E. What the player sees and hears, and how it is tested and shipped

Source of truth: commit `4b92446` (`main`'s game, PR #33). Paths are relative to the repo root;
`render/x.ts` means `src/render/x.ts`, `ui/x.tsx` means `src/ui/x.tsx`. Anything about the two
stranger minds, the Lattice's story, endings (titles, conditions, texts) and the art and music tied
to them by name is in the sealed section; where this file needs it, it says "(sealed)".

Stack: Vite 8, TypeScript 7 (strict, `noUnusedLocals`), Preact 10 with `@preact/signals` 2,
three.js 0.186 (examples' `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `ShaderPass`,
`OutputPass`), Web Audio, `sharp` (dev, for art processing). `index.html` has two roots:
`<div id="stage">` (the WebGL canvas and the map labels) and `<div id="ui">` (Preact).

---

### E.1 Rendering

#### E.1.1 The engine and the loop (`render/engine.ts`)

- One `THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })` (no MSAA:
  every frame goes through the post chain's own buffers; only the last full-screen pass reaches the
  canvas). Clear colour `#030306`. `toneMapping = NeutralToneMapping`, `toneMappingExposure = 1.05`
  (1.4 in the enhanced view mode). Canvas class `stage-canvas` (`touch-action: none`).
- Two scenes, `galaxyScene` and `systemScene`, each with `background = #020204`; one
  `PerspectiveCamera(50°, aspect, 0.1, 30000)` shared by both; one `OrbitRig` (E.1.2).
- **Loop:** `requestAnimationFrame`; `dt = min(0.1, max(0, (ts − last)/1000)) × timeScale`. Nothing
  depends on frame count. `frame(dt)` is public (tests drive it with fixed `dt`): it advances
  `now`, eases the view crossfade, the era tint, the view shift, updates the active view, then the
  rig (after the scene, so a followed planet is centred on this frame's position), renders the
  composer, then lays out labels.
- **View switch** (`showSystem`, `showGalaxy`): `fadeTarget = 1`; `fade += (target − fade)·(1 −
  e^(−9·dt))`; when `fade > 0.97` the pending switch runs and `fadeTarget` returns to 0. The
  finish shader mixes to black by `uFade`. Labels hide while `fade > 0.3`.
  - Entering a system: remembers the galaxy camera (`target`, `max(goalDistance, 36)`, yaw,
    pitch), builds the system, rig limits 4..600, jumps to origin at distance 150, pitch 0.5, then
    flies to `system.frameDistance()` over 1.4 s. `frameDistance = max(70 + primaryRadius·4,
    farthest bound orbit × 1.1)`.
  - Leaving: rig limits 6..9000, jump back to the remembered galaxy camera, then
    `focusGalaxyOn(system left, same distance, instant)`. Initial galaxy camera: distance 220,
    yaw 0.6, pitch 0.85.
- **Era tint** (`setState`): goal `#fff0e2` Dusk, `#e6eeff` Degenerate, `#ece6ff` Black Hole,
  `#e2e4e8` Dark; eased `1 − e^(−1.5·dt)` from (1, 0.94, 0.88). Grain 0.035 (0.06 in the Dark Era,
  0 in the magnifier mode).
- **View offset** (`setFocusY`, `setFocusX`, `setSheetFocusX`): the picture slides so the focus
  sits in the free part of the screen (phone sheet, magnifier column). Goal shift `h/2 − focusY`
  and `w/2 − focusX`, eased `1 − e^(−8·dt)`, applied with `camera.setViewOffset` (cleared below
  0.5 px). `focusX` (magnifier) takes precedence over `sheetFocusX` (sideways phone).
- **Zoom intent** (`zoomIntent`): in the galaxy, once `goalDistance ≤ 12` (`ENTER_ZOOM`), a wheel or
  pinch zoom enters the system nearest the focus within `max(2.5, goalDistance·0.45)` (the selected
  star counts at half distance). In a system, zooming out past `maxDistance` accumulates
  `log(requested/max)`; past `log 1.5` it leaves to the galaxy (`onLeaveSystem`).
- **Double-click:** on a fleet → `focusFleet`; on a star in the galaxy → enter it; in a system, on a
  world → `focusBody`, on the star → `frameSystem` (fly to origin at frame distance, 1.0 s).
- `focusBody(id)`: `flyToFollow(world position, max(9, radius·7), 1.1 s)`; the world stays centred
  while it orbits. `focusFleet(id, keepZoom)`: follow at 36 (galaxy) or 10 (system), or at the
  current zoom with `keepZoom`; switching views lets go. `centreOn(systemId)` (a picked star on
  the map becomes the centre at the same zoom, 0.6 s flight).
- `ping(systemId, colour)`: discovery rings (E.1.6).
- **GPU context loss:** on `webglcontextlost` the canvas is hidden (`visibility: hidden`, some
  browsers paint it white); after 1.5 s visible it calls `renderer.forceContextRestore()`; 3 s later
  still lost → `'stuck'`. `main.tsx` shows "The browser paused the graphics. Restoring…" only if
  it lasts 2 s, "Graphics restored." (good) after; when stuck in a game it autosaves, sets
  `sessionStorage['steliterate.resume']` and reloads, and on start-up that key loads the autosave.
  On restore: `galaxy.invalidate()`, `setState`, `resize`.

#### E.1.2 The camera rig (`render/camera.ts`, `OrbitRig`)

- State: `target`, `distance`, `yaw`, `pitch` and their goals; `sharpness = 7`/s. Every frame:
  `k = 1 − e^(−7·dt)`; target and distance ease toward goals; `goalYaw += autoYaw·dt` (menu
  drift 0.025 rad/s); camera at `target + distance·(sin yaw·cos pitch, sin pitch, cos yaw·cos
  pitch)`, `lookAt(target)`; `near = max(0.05, d·0.002)`, `far = max(20000, d·40)`.
- **Flights** (`flyTo`, `flyToFollow`): elapsed-time progress `u = t/dur`, cubic ease-in-out
  (`4u³` / `1 − (−2u+2)³/2`), target lerped, distance interpolated logarithmically; the camera
  follows the flight exactly (no extra smoothing), so the path is identical at any refresh rate. A
  followed target updates the flight's destination each frame. `jump` sets everything at once.
- **Follow:** while `follow()` returns a position the target is exactly that plus a pan offset
  (the offset eases). Panning while following slides the offset instead of letting go.
- **Centred:** `jump`, `flyTo`, `flyToFollow` set `centred = true`; a pan (not around a followed
  thing) clears it. While centred or following, zoom is about the middle; roaming free, the wheel
  zooms toward `zoomAnchor(x, y)` (the star under the pointer, else the point on the plane
  `y = target.y` under it, trusted only within 3× the distance), moving the focus by the fraction
  the distance actually changed (nothing once clamped).
- **Input:** pointer capture. One pointer: left drag rotates (`yaw −= dx·0.005`, `pitch += dy·0.004`,
  clamped 0.08..1.52); right button or Shift drags pan (`s = distance·0.0016` per px along the
  ground plane). Wheel: `k = exp(sign(dy)·min(|dy|,120)·0.0022)`. Two pointers: pinch zoom by
  spread ratio plus pan by half the midpoint motion; while centred, the midpoint drift is held
  until it exceeds 24 px (`PINCH_SLACK`) and the spread change, then pans at once. A click is a
  press that moved less than 6 px (mouse) or 12 px (touch). `onGesture` fires once per gesture
  (drag past slop, a pinch, a wheel). Context menu suppressed.

#### E.1.3 The post chain (`render/post.ts`)

`RenderPass → UnrealBloomPass → ShaderPass(Finish) → OutputPass`.

- **Bloom:** `UnrealBloomPass(res, strength 0.28, radius 0.18, threshold 1.0)`, at half the
  drawing resolution. Only what is brighter than white blooms (star cores, flares, hot disks); lit
  surfaces never reach it. Disabled at the low quality.
- **Finish shader** (uniforms `uTime, uResolution, uGrain 0.035, uVignette 0.55, uCA 0.6, uTint,
  uFade`):
  1. chromatic aberration growing with `r²` from the centre: `ca = uCA·r²·0.012`; R sampled at
     `uv + d·ca`, G at `uv`, B at `uv − d·ca`;
  2. grade: `col *= uTint` (no lift of the blacks: a lift with a little less green once showed as a
     purple oval after tone mapping; the galaxy's own light replaced it, 15 Oct);
  3. vignette: `vig = smoothstep(0.85, 0.2, √r²·(1 + uVignette·0.6))`, `col *= mix(1, vig,
     uVignette)`;
  4. grain in the midtones only: `hash(uv·res + fract(t·13.37)·173) − 0.5`, scaled by `uGrain ·
     smoothstep(0, 0.25, luma) · (1.2 − luma)` (true black stays black);
  5. `mix(col, black, uFade)`, clamp ≥ 0.
- Magnifier mode: vignette 0, CA 0, grain 0.

#### E.1.4 View modes (natural, enhanced, thermal)

`VIEW_MODE = { value }` in `render/shaders/bodies.ts` is shared by every body material; `V` or the
view button cycles Natural → Enhanced → Thermal (`store.ts` `VIEW_MODES`, saved in `hudPrefs`).

| | Natural (0) | Enhanced (1) | Thermal (2) |
|---|---|---|---|
| Exposure | 1.05 | 1.4 | 1.05 |
| Stars (system) | as lit | `+ (0.05,0.055,0.065)·(0.35+0.65μ)`: a burnt-out star shows its disc | `thermal(T)·(0.55+0.45·limb)·(0.9+0.2·n1)` |
| Planets | as lit | `+ albedo·(0.08 + 0.4·toViewer)` (fill from the viewer) | false colour of the local temperature, at least 290 K where settlement lights are, 900 K on a world being torn into a stream, 700 K at swarm cut sparks |
| Map nodes | blackbody/kind colour | every known star drawn as a small solid disc, grey-white mixed 45% with its colour; minimum node size 9 px | colour = `thermalRGB(temperature)` (holes: 2.7 K + 900·disk light), solid disc too |
| Map dust | era brightness | at least 0.28 | at least 0.14 |
| Galaxy glows | era brightness | the natural brightness (no floor: none once the stars are out) | the same |
| Asteroids | `#2e2926` | `#6a625c` | thermal × 0.8 |

Thermal ramp (log scale, `t = ln(K+1)/ln 3001`), stops: 0 `(0.043,0.024,0.125)` indigo, 0.2
`(0.165,0.102,0.431)` violet (~4 K), 0.4 `(0.416,0.122,0.541)` purple (~25 K), 0.6
`(0.761,0.188,0.353)` crimson (~120 K), 0.75 `(0.941,0.416,0.165)` orange (~400 K), 0.9
`(1,0.82,0.4)` gold (~1300 K), 1 white (3000 K+); smoothstep between stops, the same on CPU
(`thermalRGB`) and GPU (`THERMAL_GLSL`). The HUD shows a legend under the view switch with ticks
"0 K, 4, 25, 120, 400, 3000 K".

#### E.1.5 Quality and refresh-rate independence

- `setQuality('low'|'medium'|'high')`: pixel ratio capped at 1 / 1.5 / 2 (`min(devicePixelRatio,
  cap)`); bloom off at low; low (or `prefers-reduced-motion`) also shows the still title instead
  of the loop video. Touch devices (`matchMedia('(pointer: coarse)')`) start at medium; a saved
  `high` there is moved to medium unless `qualityChosen` (set when the player picks in Settings).
- Every animation runs on elapsed time; all smoothing is `1 − e^(−k·dt)`; flights, fleet glides
  and pings are functions of elapsed seconds; frame time is capped at 0.1 s (a slow machine eases
  longer in real time, never jumps). The playtest compares 30 Hz with 144 Hz (E.7.1). Settings
  says: "Animation runs on elapsed time, so the game plays the same at any display refresh rate."

#### E.1.6 The galaxy map (`render/galaxyView.ts`)

Everything lives in `GalaxyView.group`. Scale: the Coalescence's envelope reaches about 840 world
units; star systems use their generated `pos`.

**Dust (the old star populations)**, built once per seed with its own `Rng(hashSeed(seed·3+1))`
(so it never touches the game's RNG). One `THREE.Points`, additive, no depth write, frustum
culling off. Attributes `aSize`, `aColor` (blackbody), `aSeed`.

| Layer | Count | Shape | Colour (K) | Size |
|---|---|---|---|---|
| Shared envelope | 30,000 | `r = 18 + rand^2.6·820`, isotropic, y × 0.62 | 2600–3600 | 1.0–2.4 |
| Merger shells | 7 × 1300 | arcs at `R = 260 + 85k ± 20`, span ±0.7..1.4 rad, alternate sides, gaussian 5 radial, 22·0.62 vertical | 2700–3300 | 0.9–1.7 |
| Each ancestral province | 9000 | `|gauss|·radius·0.5` around its centre, y × 0.45, tint ±300 K | 2700–3700 + tint | 1–2.2 |
| …its bridge to the core | 2600 | `pos·u` plus gaussian 45/20/45 | 2600–3400 | 0.8–1.8 |
| Each stream province | 4200 | arc ±0.9 rad at its radius, gaussian 22, `y + gauss·16 + sin(3a)·40` | 2600–3300 | 0.9–1.9 |
| Halo | 9000 | `r = 300 + |gauss|·480`, y × 0.8 | 2500–3200 | 0.7–1.5 |
| Globular / outlier regions | 2200 / 500 | gaussian 14 / 8 | 2800–4200 | 0.8–1.6 |

Dust shader: point size `clamp(aSize·uScale/−z, 0.6, 22)` with `uScale = 300·pixelRatio`;
twinkle `0.85 + 0.15·sin(t·(0.3 + seed·0.9) + seed·40)`; alpha `uBright·tw·clamp(size/z, 0.25, 1)`;
fragment a soft disc `smoothstep(0.5, 0, d)²` times `uTint`. Brightness by era (`sync`): Dusk
`0.12 + 0.88·(live red+blue dwarfs / their count at start)`, Degenerate 0.1, Black Hole 0.018,
Dark 0. Tint: white (Dusk), `#9fb8ff` (Degenerate), `#8c86b8` (later).

**The galaxy's own light** (`buildGlows`, 15 Oct): additive sprites with a painted falloff
(`glowTexture`: 256², alpha `(e^(−3.2·r^0.7) − e^(−3.2))/(1 − e^(−3.2))`, zero at the edge), no
depth test, `renderOrder −1`. Glows: envelope 1900 units, flat 0.62, 3200 K, base 0.05; its middle
760, 0.62, 3500 K, 0.08; each ancestral province `radius·2.6`, flat 0.45, 3300 K, 0.09; each stream
15 glows of 130 along its arc (±0.9 rad, `y + sin(3a)·40`), 3100 K, base `0.018·cos(u·0.9π)`; each
globular 80, round, 3700 K, 0.08. Colour = blackbody × the dust tint. Opacity `base × era
brightness × smoothstep(distance, 220, 900)` (gone close in among the stars, and gone once the
stars are out); a flattened glow's height on screen is `size·√(flat²(1 − up²) + up²)` where `up`
is the camera direction's |y|. Natural light only: they follow the natural brightness in every
view mode.

**Heart glow:** a sprite of `radialTexture` (128² radial gradient 1 → 0.45 at 0.25 → 0.08 at 0.6
→ 0), `#ffae70`, 260 units, additive; opacity 0.35 / 0.16 / 0.06 / 0 by era.

**Star nodes** (`nodes`, rebuilt every `sync`): one `Points` of known, not-gone systems,
`renderOrder 2`, additive. Attributes: colour, size, `aState` (owned, rust 0..1, pulse phase,
dim: 1 surveyed / 0.7 seen), `aMark` (0 seen, 1 surveyed, 2 surveyed with an unsettled living
world), `aOthers` (another civilization's colour and flag).

- Vertex: `s = aSize·uPixel·(1 + 60/max(8, −z))`, star diameter clamped to 5..64 px (9 px minimum
  in enhanced/thermal), point size at least 26 px when marked (so the ring has room).
- Fragment (px = distance from centre in pixels, r = star radius): core `1 −
  smoothstep(0, 0.22r)`, halo `(1 − smoothstep(0, r))·0.35`, colour `col·(core·1.6 + halo)·dim`.
  Rings, line width `1.2·uPixel`:
  - ours: ring at `max(0.72r, 8px)`, width ×1.3, pulsing `0.75 + 0.25·sin(1.6t + phase)`, colour
    the era's neon ×1.4;
  - surveyed: steady ring at `max(0.62r, 7px)`, `#cfe3ea` × 0.6, or `#b8f5a0` (green) × 0.9 where
    a living world waits;
  - another civilization's star: a dashed ring (10 dashes, `0.55 + 0.45·step(0, sin 10θ)`) at
    `max(1.05r, 12px)` in their colour × 1.2, outside ours;
  - the Hunger's rust: ring at `max(0.9r, 11px)`, width ×1.6, `#b8452a` × rust × flicker `0.6 +
    0.4·sin(7t + 13φ)·sin(2.3t + φ)`.
- Node colour (natural): black holes `(0.62,0.52,1.0)`; void/rogue `(0.35,0.36,0.42)`; brown dwarf
  `(0.62,0.3,0.28)` going to cold grey `(0.3,0.3,0.34)` as it cools after the Dusk; black dwarf
  grey (rekindled `(0.9,0.45,0.25)`); white dwarf after the Dusk grey → `(0.55,0.62,0.8)` by its
  ember share; in the Dusk a white dwarf under 780 K looks like an ember `(0.66,0.6,0.72)` and
  shines into its blackbody colour by 1,500 K (`coolDwarfShine`); neutron star blackbody faded to
  grey by `pulsarBeam`; others `blackbody(max(1800, T))` × 1.2 (× 1.0 for red dwarfs and collision
  stars). A new star already out is drawn as the cold dwarf it becomes (`shownKind`).
- Node size: SMBH 11; helium giant 10 (and one late kind, sealed); blue dwarf, helium star 8; red
  dwarf, collision star, black hole 6; neutron star 5; others 4.5.

**Territory:** additive `PointsMaterial` (size 38, `radialTexture`, neon, opacity 0.12, size
attenuation) at each settled system.

**Fleets:** one sprite per fleet (`fleetGlyph`, `renderOrder 3`, no depth test). Texture: a 160²
canvas with a radial halo in the role colour (alpha 0.22 → 0.08 at 0.55 → 0), then, once
`art/ships/<look>.png` loads, the hull drawn at 80% with a 7 px `shadowBlur` in the role colour
and again on top without. Role colours: war `#ffc98f`, settler `#9ff5e6`, other `#bfe9ff`
(`lookRole`). Look per fleet (`fleetLook`): Aegis if any, else Warden ('war'), else its settler's
hull, else probe if all probes, else Swarm Tender, else 'other' (hauler). Scale `max(1.8,
distance·0.034) × markScale`. On every sync a fleet glides from where it is drawn to its new
position over 1.4 s (smoothstep). Parked: a slow station-keeping circle, radius 2.6 at +0.9 y,
angle `phase + 0.25·t`. The sprite turns to its heading on screen (`atan2 − π/2`). A new game
clears all glides (fleet ids repeat between games).

**Routes:** `LineDashedMaterial('#8fd7ff', dash 3, gap 3, opacity 0.45)` from each moving fleet's
position to its destination.

**Swarms on the map:** `Points` of `80 + 30·size` motes per awake or tamed swarm, at its star
(+1.5 y) or along its route. Murmuration vertex shader: every mote follows a few shared slow waves
(`flow·0.55 + shared`) scaled by its radius (`(2.5 + 1.6√size)·(0.4..1.2)`); size `clamp(2.2·px·(1
+ 30/max(6, z)), 1, 6px)`. Fragment: dark motes `(0.05,0.03,0.03)` that catch light on
`step(0.82, flicker)`: red `#c0482c`, or teal `#4fe3d1` when tamed; alpha `0.9·(0.55 + 0.45·flick)`.
Its pick radius covers the cloud (`rad·1.2`).

**Pings** (`ping`): two rings (`RingGeometry(0.92, 1)`, additive, facing the camera) per call,
delays 0 and 0.45 s, life 2.4 s, scale `max(1.5, d·0.01)·(1 + 9e)`, opacity `0.9(1 − e)²`.
Colours: a star newly on the map `#bfe9ff`, a survey `#9ff5e6`, a living world `#b8f5a0`, first
contact the other civilization's colour.

**Selection ring:** `RingGeometry(1, 1.08)` (1.2 in the magnifier mode), `#ffd9b0`, opacity 0.85,
facing the camera, scale `max(1.6, d·0.028)·markScale`. It does not pulse.

**Labels** (`engine.ts` `updateLabels`, DOM in `.label-layer`): beyond distance 700, province names
(not halo or void) at y + 40 and outlier/globular region names at y + 20, class `province`;
closer, the 36 nearest systems (24 in the magnifier mode) within `distance·1.1` of the target,
plus, in the Degenerate and Black Hole calendars, every burning collision star (`✦ Name`, class
`beacon`), plus every contacted living civilization's home (`◈ Name`, class `others`, in their
colour). Classes: `mine` (neon), `living` (boon blue), `surveyed`, `seen` (italic, dimmer). Inside
a system each world is named at `size + 1.2` above it (`The Deep` for the Deep), class `mine` or
`body`, or `Name · ◈ Them` in their colour. Placement: sorted by weight, skipped if within 70 × 14
px of one already placed (scaled by `15/11 × zoom` in the magnifier mode), drawn at `(x + 9, y −
8)` px with `transform`. In the galaxy view labels are left untouched while the camera matrices,
canvas size, magnifier flag and zoom are unchanged (`labelsStand`, for phones).

#### E.1.7 The system view (`render/systemView.ts`)

Built per system (`build`), cleared and disposed on rebuild. Until a probe has surveyed it (and we
do not live there) a system is only its star.

**Background:** 2600 points at radius 1800 (`Rng(99)`, blackbody 2500–3800 K × 0.2..1), size 2.2 px
fixed, opacity 0.8 / 0.35 / 0.12 / 0.03 by era.

**Primaries** (sphere `SphereGeometry(r, 64, 48)` with `STAR_FRAG`; glow = camera-facing plane with
`GLOW_FRAG`, additive). `col = blackbody(max(1500, T))`.

| Kind | Star radius, colour, granulation, bands, intensity | Glow size, colour, power |
|---|---|---|
| Red dwarf, collision star | 5, col → `#ff4a14` 55%, 1.0, 0, 0.68 | 34, col → `#ff5a1c` 40%, 0.55 |
| Blue dwarf | 5.4, col, 0.55, 0, 0.9 | 42, col, 0.6 |
| Helium star | 3.2, col, 0.4, 0, 2.6 | 52, col, 1.6 |
| Helium giant | 9, col, 1.0, 0, 2.2 | 80, col, 1.8 |
| White dwarf, Dusk | 1.6, `#6e4a40` → col by shine, 0.1 + 0.05(1−shine), 0, 0.9 + 2.1·shine | 14 + 6·shine, `#91573f` → col, 0.35 + 0.75·shine |
| White dwarf, later | 1.6, `#2a2628` → `#6d4a52` by ember, 0.15, 0, 0.6 + 0.3·ember | 14, `#8a4f4a`, 0.35·ember (only if ember > 0) |
| Black dwarf | 1.6, `#2a2628`, 0.1, 0, 0.6 | none |
| Brown dwarf | 3.4, `#7a3a33` (Dusk) or `#2a2628` → `#3c2225` by warmth, 0.2, **1.0**, 0.6 + 0.3·warm | 14, `#5a2420`, 0.35·warm (if > 0.02) |
| Neutron star | 0.8, `#2c2b34` → `#dde8ff` by beam, 0.1, 0, 0.6 + 2.4·beam | 40, `#9cc3ff`, (0.9 Dusk / 0.4 later)·beam, lighthouse beams 0.6·beam |
| Black hole / SMBH | black sphere r 2.6 / 6 | glow `6r`, `#ffd2a8`, power 0, photon ring 1.0; accretion disk `1.6r..6r` (SMBH `9r`) |
| A late kind | (sealed) | (sealed) |
| None (void, rogue) | nothing drawn | |

Disk heat: 1.0 if we run an Accretion Engine or Penrose Harvester there, else SMBH `min(0.75,
0.12 + 0.4·diskLight)`, else 0.18. A rekindled remnant gets a disk `2.2r..7r` at heat
`min(1, rekindle)`.

`STAR_FRAG`: limb darkening `μ^0.55`; granulation `fbm(p·3.2)·0.6 + snoise(p·11)·0.25` drifting on
time; spots from `fbm3(p·1.7)`; brown-dwarf bands `sin(18y + fbm·3)`; hot cells `col·(1.3,1.08,0.9)`,
cool lanes `col·(0.95,0.5,0.3)`; limb darker and redder; faculae and odd flares on convective stars;
a hot rim `col·(1−μ)³·0.5`. `GLOW_FRAG`: corona `(1−d)³·(0.8 + 0.4·fbm3)·1.3·power`; beams
`|cos(θ + t·beams)|^80`; photon ring at `d = 0.34` (sharp) plus a soft one at 0.36. `DISK_FRAG`
(ring tilted `−π/2 + 0.22`): swirl `fbm3`, streaks `0.6 + 0.4·sin(12θ + 1.5r − 2t + 4·swirl)`,
Doppler `0.55 + 0.45·sin θ`, colour `#fff0d8` (inner) → `#c2562e` (outer), ×2.2.

**Light on the worlds** (`primaryLightColor`): colour = star blackbody, power 1.4; 2 for blue dwarfs,
helium stars and giants; a white dwarf `0.12 + 0.98·shine` in the Dusk, else `0.03 + 0.09·ember`
(0.3 rekindled); black dwarf 0.03; brown dwarf `0.03 + 0.09·warmth`; neutron star `0.03 +
0.27·beam`; holes and starless `#8a7aa8` at 0.05, but a hole whose disk shines (> 0.05) lights
warm `#ffd6b0` at `min(1.4, 0.1 + 0.85·shine)`; a rogue world gets 0.02.

**Worlds** (`buildBody`): orbit radius `orbit + 1.5·primaryRadius` (rogue: `orbit·2.6 + 30`);
angular speed `0.25/(R/12)^1.5` (rogue 0.004); a pale orbit ring (`±0.04`, `#8a8f9c` 0.16; rogue
`#4a4a52` 0.08); spin `orbitTime·0.1` unless tidally locked. Orbits run on `orbitTime`, which
stands still while paused (P); stars keep animating on `time`. One gas giant in three gets a ring
(`1.4..2.2·size`, `#8b7a6a`, 0.35, tilted). Settled: a thin habitat torus (`1.5·size`, tube `0.03 +
0.01·size`, neon, 0.7) and, with a Magnetic Shield, a `#a8d8ff` torus kept between world and star
(0.86 of the way). A world someone else lives on wears a thin torus in their colour (`1.45·size`,
0.45), except sleepers, whose lights only breathe (`uLights = 0.2 + 0.12·sin(0.35t)`).

`PLANET_FRAG` (kinds: 0 rocky/super-Earth/barren, 1 sea-and-land (eyeball, terran), 2 ice, 3 gas
giant, 4 ice giant, 5 ice-shelled ocean). Uniforms from the game: temperatures (day/night),
water, locked, vitality, the eye (the sea still kept liquid by its star, `smoothstep(150, 240 K)`
of the day side), lights and development, neon and city colour, sun direction/colour/power,
substellar point, rust, feeding, eaten, flow.

- Temperature field: `T = mix(night, day, smoothstep(−0.25, 0.6, facing))`.
- Rocky: rock palette `(0.23,0.19,0.17) → (0.42,0.34,0.28) → (0.58,0.52,0.46)` by height fbm.
- Sea and land: green-brown land and dark sea `(0.05,0.12,0.16)` where warm (on a locked world only
  the star-facing face, the warm zone shrinking as vitality falls); ice `(0.6,0.64,0.7)–(0.82,0.85,
  0.9)` elsewhere; dried grey land as vitality drops; once the star is dead the whole world is an
  ice shell, the old sea a darker smoother plain; clouds over living ground; specular on water.
- Ice / ocean-ice: pale ice; warmed past 263 K it melts into open sea (ocean-ice everywhere, an ice
  world in its low ground as far as `uWater` reaches); past 363 K a veil of steam.
- Sea worlds past 363 K: the sea boils off to pale salt-crusted floor under steam.
- Gas / ice giants: latitude bands (22 / 12 per radian) in browns `(0.55,0.42,0.33)/(0.32,0.24,
  0.21)` or blue-greys `(0.35,0.45,0.52)/(0.22,0.3,0.38)`.
- Hot ground: from 1,400–1,700 K a dark basalt crust; glow added after lighting (so night sides
  glow): `heatColor` (dull red at 780 K → blackbody by 1,150 K) × `heatGlow` (0.25 by 1,500 K, +0.75
  by 3,600 K, +0.6 by 6,000 K), in cracks and pools, a magma sea from 2,200–3,000 K, a vapour limb
  from 2,600 K; a giant too hot for its clouds glows dully from below.
- Rust (the Hunger): oxide patches `(0.24,0.085,0.04)–(0.47,0.2,0.08)`, pitted, spreading with
  `uRust`; half on giants. A swarm eating it now: sparks where harvesters cut in `(1,0.36,0.12)`,
  flickering. Torn into a stream: glowing streaks `(1,0.55,0.3)`.
- Highlights roll off above 0.55 (`over/(1 + 1.8·over)`), so a bright sun never clips to white.
- City lights: sodium `(1,0.62,0.3)` with 3.5% neon cells, only on the night side (or everywhere
  round a dead star), fine detail faded by `fwidth` so a far world shows soft clusters; a young
  settlement a few clusters, spreading with `uDev`. A tidally locked sea world is lived on along
  its terminator: a ring of grey built ground by day, lights that never go out in the twilight,
  a sodium haze, a neon transit thread; round a dead star the lamps burn at half. Another
  civilization's surface cities use their own colour (mixed 25% with sodium).
- Faint sky ambient `albedo·0.015`; ice night sides `albedo·(0.012,0.016,0.024)`; an atmosphere rim
  thinning with vitality.
- The Long Flow: heights flattened to a quarter, detail to a third; belts' stones turn round
  (icosahedron detail 1).

**Belts:** 700 instanced icosahedra (0.12) around the orbit (gaussian ±1.2 radial, ±0.3 vertical),
scaled by richness, flat colour per view mode, rust and heat tints; slow rotation.

**The Deep:** a ring at `2.4·primaryRadius + 3` (width 0.12): neon 0.55 if ours, their colour 0.4
if theirs, else `#6b6f7a` 0.18; ours adds a small station (dark box with a neon light strip).

**Structures:** a Dyson-type swarm of instanced plates (0.5 × 0.32): `1400` per Dyson Swarm in a
shell at `2.1–3.4·r0`, plus 90 per Orbital Collector, 160 per Ember Collector or Infrared Shroud at
`3.5–5.5·r0`; 6% neon, 35% lit `#ffb070` × 0.4..0.9, the rest `#231f1d`; each on its own tilted
orbit, speed `0.05..0.16/√(r/r0)`. Rocks and plates nearer the camera than `0.3 × view distance`
are discarded (`withNearFade`).

**Swarm in a system:** `400 + 120·size` motes around `(5r0, 2, 3r0)`, red `#c0482c` or tamed teal,
flicker `step(0.85)`, alpha 0.85. Feeding: `90 + 18·size` motes circling low over each world it
eats and `40 + 8·size` streaming to the cloud, `#d0502c`.

**Our fleets in a system:** a five-sided cone (dark `#2a2e33`, war `#3a2e28`) with a glow at the
stern (`#8fe8ff` / `#ffb070`), orbiting at `3.2·r0 + 4 + 1.5i`, speed 0.12.

**Other civilizations' habitats** (`addHabitats`, by way of life, glowing in their colour, turning
slowly): uploads, a flotilla of seven dark boxes with light strips; the merged mind, one ring
station with nine light nodes that breathe together (`0.6 + 0.35·sin 1.3t`), a heart and spokes
where no world sits in the middle; processes and protocol, a 5 × 5 × 3 lattice of small cubes
(25% missing) inside a faint wireframe. In the Deep they stand alone, scaled 1.4. Before contact
their lights are `#d9cdb8`.

**Selection in a system:** one ring per world. The selection circle (`RingGeometry(1, 1.03)`,
`#ffd9b0`) takes the place and the colour of the world's own ring (ours or theirs), which hides;
scale `1.9·size`; opacity eases from 0.8 down to a floor of 0.35 (marked) or 0.12 (unmarked) as the
camera comes close (`k = distance/r`, fade over 3..12).

#### E.1.8 Picking (`Engine.pickAt`)

Projects every pickable; reach 16 px (galaxy) / 26 px (system), 28 / 36 px for touch, × 1.5 in the
magnifier mode; fleets get 4 px of bonus. A pickable with a radius counts anywhere on its disc on
screen; inside a disc the nearer wins; a swarm cloud scores 0.5 so a star or ship right under the
pointer still wins. On touch, a map label's box (±6 px) picks what it names unless the finger is
right on something. While choosing a destination (`pickFilter`), only stars other than the fleet's
own can be picked; the canvas shows a crosshair (`html.picking`).

---

### E.2 The interface (`src/ui`)

#### E.2.1 Boot and structure (`main.tsx`, `App.tsx`)

`main.tsx` imports `ui/sup.ts` first (exponent rendering), creates the `Engine` on `#stage`, applies
quality, orbit pause and view mode from storage, starts the loop, reads `?lowvision` (`=0`/`off`
switches it off; on also sets the enhanced view), applies the magnifier mode, installs the audio
unlock, sets volumes and playlist, starts music, guards translation on `#ui`, tracks Tab, renders
`<App/>`. Behind the menu a preview world (`newGame({ seed: 7 })`) is shown, focused on its core at
distance 1500, labels hidden, rig drifting at 0.025 rad/s.

`App` renders `.ui-root` containing: `MainMenu` or `Setup` (by `screen`), or in a game a
`<div class="hud">` (`display: contents`; `inert` while a window, an event or a survey report is
open) holding `LvBar` (magnifier only), `Hud`, `Drawer`, `TargetBanner`; then `EventModal` or
`LoreModal`; then `ModalHost` (by `modal.kind`), `Toasts`, `MapHover` (magnifier), `TipLayer`.
`App` writes `--accent`, `--accent-soft`, `--neon` from the era (Dusk on the menu), tells music the
era or the menu mood, and sets the mood to tension when a danger forecast of kind hunger or
crossing exists, else calm.

#### E.2.2 State (`store.ts`)

Signals: `game` (mutated in place by the sim), `rev` (bumped by `bump()`, which also calls
`engine.setState`), `screen` ('menu' | 'setup' | 'game'), `modal` (research, fleets,
settlements {tab: worlds | beacons | holes | afar, send}, charters, threads, signals, log, codex
{topic}, settings, save, crossing, outcome, era_intro), `selection` {kind: system | body | fleet |
swarm, id}, `view` ('galaxy' | 'system'), `toasts`, `busy`, `openBuildFor`, `targeting` {fleetId,
order}, `hoverStar`, `following`, `uiZoom`, `lvFolded`, `phone`, `sheetSize` (0|1|2), `phoneMore`,
`touchInput`, `mapHover`. Components that read mutable state do `void rev.value`.

- `act(fn)`: runs a game action; a returned string is shown as a bad toast, else `bump()`.
- `notify(text, kind, action?)`: no duplicate texts, at most 3 shown, dismissed after 4.5 s (6 s
  bad, 12 s with an action button); in the magnifier mode they stay until closed or the next turn.
- Settings (localStorage `steliterate.settings`): `music 0.7, sfx 0.7, quality high (medium on
  touch), uiScale 1, playlist {}, overture true`, optional `lowVision, lvSide, qualityChosen`.
  `UI_SCALES`: Small 0.85, Normal 1, Large 1.2, Huge 1.4, and in the magnifier mode only 1.6×, 2×
  (`UI_SCALES` must be declared above `settings`, which reads it). Old values snap to the nearest.
- HUD prefs (localStorage `steliterate.hud`): `forecasts, feed, orbitsPaused, eventPivot (true),
  viewMode (0), sheet`.
- `applyUiScale(u)`: the room available is `w/360` (magnifier), `min(w/380, h/700)` (≤ 760 px wide)
  or `min(w/1000, h/640)`; sizes above 1 are capped to it. Writes `--z` on `<html>`; `#ui` has CSS
  `zoom: var(--z)`; viewport units inside are written as `calc(100vh / var(--z))`. `uiFactor()`
  (`Tip.tsx`) measures a hidden 100 px `.zoom-probe` to convert pointer to layout pixels.
- Phone layout: `PHONE_QUERY = '(max-width: 760px), (max-height: 500px) and (pointer: coarse)'`,
  `isPhone()` false in the magnifier mode.

#### E.2.3 The title and new-game screens (`screens/Menu.tsx`)

**Title:** a full-screen `.menu-art` (`art/title.webp`, cover, position 60% 50%, opacity 0.9) with a
`<video class="menu-loop">` (autoplay, muted, loop, playsInline, poster the still; sources
`title-loop.webm` then `title-loop.mp4`; an error on the last source falls back to the still);
skipped at low quality or with reduced motion. Overlay gradients: left-to-right `rgba(2,2,3)` at
0.96 → 0.8 (32%) → 0.2 (70%) → 0.5, and bottom-up 0.9 → 0 at 40%. Left column (`minmax(320px,
520px)`, padding 64/40/32/48): eyebrow "A survival game at the end of time"; `h1.title`
"Steli&shy;terate" (Big Shoulders Display 800, `clamp(48px, 7vw/z, 86px)`, letter-spacing 0.08em,
line-height 0.9, uppercase); `.title-sub` (Spectral italic 300, 19px) "The stars are going out.
Your world is dying with its sun. Keep your people alive until the last light, and past it.";
buttons (display face 700, 17px, 0.14em, 44px high): Continue (primary, if any save), New game,
Load / import, Codex, Settings; footer "Four ages, from the last red dwarfs to the Dark Era beyond
10¹⁰⁰ years. The physics follows Adams & Laughlin (1997), Dyson (1979) and Krauss & Starkman
(2000), with the speculative parts labelled as such in the Codex. / Sound starts after your first
click."

**New game (Setup):** the same art at opacity 0.35; eyebrow "New game", title "The Long Dusk";
fields: Your people (default "The Kin of Aster", max 40), Your dying world ("Aster", max 24), Other
survivors (None, 1–4; default 3; the None tip is sealed), Epoch length (Brief / Standard "About 250
turns in all." / Vast), Difficulty (Gentle / Standard "Hard. Most civilizations do not make it." /
Harsh), What becomes of matter? (Unknown, Protons decay, Stable, Curvature, each with a tip), Guide
(Guide me / No guide), Seed (random to 1e9, Random button). Back and Begin (primary, display face
800, 18px). Begin plays `endturn`, starts the guide if chosen, and opens the age intro.

#### E.2.4 The HUD (`hud/Hud.tsx` and parts)

Desktop positions (in UI pixels, `env(safe-area-inset-*)` added at the edges):

| Part | Where |
|---|---|
| Chronometer `.chrono` | top 8, left/right 8, three-column grid, min height 62 |
| Resources `.resources` | top 78, left 8, wraps |
| Rail `.rail` | left 8, top 128, a column of labelled buttons (scrolls to stay above the forecasts) |
| Drawer `.drawer` | right 8, top 78, width 380, max height `100vh/z − 318px` |
| Bottom-left `.bottom-left` | left 8, bottom 8, width 360: forecasts and the Record |
| Turn box `.turnbox` | right 8, bottom 8, width 320 |
| View switch `.viewswitch` | bottom 10, centred |
| Toasts | bottom 64, centred, width ≤ 560 |
| Research / ship prompt | top 132, centred, width ≤ 460 |
| Guide `.tutorial` | left 70 (150 on wide screens), top 128, width ≤ 340 |
| Target banner `.targeting` | top 140, centred, neon border |

Short screens: at ≤ 950 px tall the feed is 78 px and only two forecasts show; ≤ 790 px, one
forecast and a 58 px feed.

**Chronometer** (`hud/Chronometer.tsx`): left cell `numeral · SCIENCE NAME` (accent, display 800,
14.5px, 0.2em), the age name (display 700, 21px, uppercase), "Turn N · X into the Dusk" or "turn k
of this age". Middle: an SVG ruler (`viewBox 0 0 1000 46`, stretched): one band per age at y 18,
height 10 (Dusk 0–0.22, Degenerate 0.22–0.5, Black Hole 0.5–0.78, Dark 0.78–1); the current age's
band accent at 0.28 and its elapsed part at 0.55, past ages 0.12; within the Dusk the position is
logarithmic in elapsed years; Degenerate linear in η 15–40; Black Hole η 40–100; Dark `log10 η`
2–122. Until the fate of matter is known, the stretch where the Degenerate Age may end is hatched
(35° pattern) and labelled "II → III ?" with a tip. Milestones: thin lines (y 12–34) with tips;
forecast pins: small triangles at y 36 coloured by severity (info dim, warn amber, danger red, boon
blue); the present: a 2 px neon line y 4–42. Age names above the bands (eyebrow 11px). In the Dark
Era it becomes a deep-time ruler on `log10 η` ("I–III · deep time: log₁₀ η →"). Right cell: `η
value` (phosphor mono 19px; digits: 4 in the Dusk, 2 Degenerate, 1 later; `10^x` past 10⁴), the
age ("X since the Big Bang" in the Dusk), "this turn spanned X". Phones get a `.chrono-line`
button: "Turn N · this turn X · next Y", a forecast count, plus/minus icon; it opens the ruler and
hangs the forecasts and Record under the top bar.

**Resources** (`hud/Resources.tsx`, `.resources.panel.scan`): Energy (icon accent, value in
phosphor mono, signed net green/red, a ticked gauge of reserve/cap, label), Matter (hidden once
matter is gone), Insight (per turn, the project name or a warning "no research", neon progress
gauge; opens Research), Accord (opens Charters), Resolve and Dissent (mono with gauges; red below
25 / above 45), Free energy %, Continuity (Dark Era only), Taint (when above 0). Every one has a
multi-line tooltip with its breakdown.

**Rail** (`Rail`, `nav.rail.panel`): Research (badge 1 when nothing is researched), Systems, Fleets
(badge = settlers ready), Threads, Charters (short label "Laws"), Signals (badge = unanswered),
Record, Codex, Save / load, Menu. Icons 20px; on a PC labels sit beside the icons; the active
window's button is `.on`. Codex and Save are `rail-menu-only` (hidden on phones; both are in Menu).

**Bottom-left:** a small header (Forecasts toggle with count, Record toggle, "N closed" to bring
back closed forecasts); up to three forecasts (warning or energy icon by severity, title, "in X ·
~N turns", a × that closes it to the Chronometer only; a click finds its star); the feed: the last
seven Record entries (turn in faint mono, colour by kind).

**Turn box:** to-do chips above it (amber, arrow icon; each goes there): "Research paused", "N idle
settlements", "N settlers waiting", "N ships idle" (steps through them), "N signals to answer".
The Pace panel: stencil "PACE" and "next turn X"; chips for a flare clock ("Flare clock · turn k of
6"), a coming flare ("Turn stops · X begins to flare"), a star clock or flash; the pace buttons
from the widest allowed: Quick ×1000, ×100, ×10, Tide, Slow ×10, ×100, ×1000 (greyed with a reason
when they would change nothing); Sleep/Wake, Long Sleep ×5 (with its research), net energy. End
Turn: primary, 64px high, display 800, 22px, 0.16em, with a mono subtitle (turn N, the first
warning, or "sleeping · N more").

**View switch:** Galaxy, System (enabled when a star is selected), Home, the view mode button
(survey icon, label Natural/Enhanced/Thermal), a follow button naming the followed fleet with ×,
and inside a system Pause/Play (P) and Whole system; the thermal legend when thermal.

**Prompts:** `ResearchPrompt` ("Research complete", the project, its description, up to four next
projects — newest age first, then cheapest — with "~Nt" or "now", All projects…, Pause research);
`ShipPrompt` (desktop only; "Awaiting orders · ⌖ Star", the fleet's hull thumbnail, up to three
suggested destinations with trip labels such as "~26t · 2.9 Myr", collision stars first, then
Auto-explore / Fortify here / Hold here, Choose on map, From Systems…, Look inside, All orders…; ×
"Later"). Only one shows at a time; research first.

**Target banner** (choosing a destination): "Fleet: click a star on the map to send it there; it
surveys any star it has not charted. Esc cancels." On touch: "tap a star to see the trip, then tap
it again or press Send"; the hovered star's line "Name · distance · trip · cost energy ·
unsurveyed" in neon mono.

**The guide** (`hud/Tutorial.tsx`): 12 steps stored in `flags.tut` (so it survives a reload): The
end of the universe; The Chronometer (`.chrono`); Energy first (`.resources`); Choose a research
project (rail button 1; advances when researching); Your homeworld (rail 2; when a settlement is
selected); Build something (`.drawer`; when anything is queued); Send out the probes (rail 3; when a
probe is moving); End the turn (`.endturn`; turn > 1); Forecasts (`.bottom-left`, phone variant on
`.chrono-line`); Growing; Pace and sleep (`.pace`, phone variant `.pace-phone`); You are on your
own. A pulsing accent ring (`.tut-ring`, 1.6 s) follows the target each frame. Buttons Next / Skip
this step / Finish; × ends it.

#### E.2.5 Panels: the Drawer (`panels/Drawer.tsx`)

A right-hand `aside.drawer.panel` for the selection, with a × and, on phones, a sheet handle.
Head: eyebrow, `h2` (display 700, 22px, uppercase, balanced), chips; body scrolls (or the panel
scrolls whole when the body would have under 150 UI px, back above 190: `useWholeScroll`).

- **System:** eyebrow province (and "cast out into the void"); chips: star kind with icon, "not
  surveyed"/"unknown", rust %, decoy beacon with Put out, gone; "Look inside" in the galaxy view; a
  world strip (a button for the star and each world, ours neon, living blue, current accent); a
  key-value list (Light for collectors, Temperature or Hawking temperature, Mass, Spin reservoir,
  Burns until / Burnt out at, Distance); Forecast, Others (their way's plate, 138px high), In orbit.
- **World (unsettled):** kind, habitability, vitality, room for Kin, mineral richness, core heat,
  hydrogen, orbit, mass, ruins and finds (chips that reopen the survey report), climate rows
  (temperature day/night, sunlight, freezing, boiling, falls inward, evaporates), Settle.
- **Settlement:** tabs Overview and Build. Overview: yields grid (energy, matter, industry,
  insight, accord, each with icon and label), People, World, Focus (Balanced, Energy, Matter,
  Industry, Insight, Accord), Structures (chips with kind icons and a × to take apart), Expand.
  Build: Queue (industry per turn), a row of kind filters (Energy, Storage, Matter, Industry,
  Insight, Accord, People, World, Defence; colours below), the build list grouped by kind (each row
  shows what one more would do here, cost, and a two-line description in short panels), and what
  it works on when nothing is queued (Recycle, Study, Tend, Morale).
- **Fleet:** its painted hull (64px, floated right), ships, orders (Choose on map, lists of
  destinations, Follow / Centre, Fortify, Hold here, Stop exploring, Beacon, Tame, Disband, Stand
  down, More in Systems…).
- **Swarm:** its plate (`swarm.webp` or `swarm_tamed.webp`), size, what it is after, Tame / attack.

#### E.2.6 Windows (`screens/Frame.tsx` and the screens)

`ModalFrame`: `.modal-wrap` (full screen, `rgba(2,2,4,0.72)`, click outside closes) → `.modal.panel`
(`min(1100px, 100%)`, narrow `min(640px, 100%)`, max height `100vh/z − 32px`), head (an xl accent
icon, eyebrow, `h1` display 800 26px uppercase, focused on open with `tabIndex −1`; a ghost ×),
scrolling body, optional foot. Escape closes. Letter keys switch between screens (E.2.9).

- **Research** (`screens/Research.tsx`): eyebrow "N insight per turn · … · the labs draw X energy
  while working"; a top box with the current project, progress bar and turns, or the paused
  warning; the tech grid (`124px` field column + 4 age columns ≥ 180px, min width 874, scrolls
  sideways): age headers (accent-soft, faded until reached), field names with tips, tech buttons
  (name, cost or "known", % progress bar, "speculative"; done = green border and check, active =
  neon, locked = 38% opacity, Hunger-derived = red border). Projects for another fate of matter
  show as "???" until the fate is known, then vanish. Then "Great Works" cards (path, the ending it
  leads to (sealed), name, ages, needs, requirement met/unmet, progress, Begin/Resume/Complete).
- **Systems** (`screens/Lists.tsx`, key S; W opens its second tab): tabs Our settlements (grouped by
  star, a yields column header with icons), Surveyed worlds (count), ✦ Collision stars (in the
  Degenerate Age), ● Black holes (in the Black Hole Age: longest-lasting first), Seen from afar
  (magnifier mode only). Surveyed worlds: Planets/Systems toggle; sorts Habitable, Room, Power,
  Matter, Lasting, Type, Nearest, Name; toggles With discoveries and Unsettled only; under each row a strip of measures (Livable,
  Power, Matter, Lasting; the sorted one outlined in neon, `siteStrip.tsx`). Opened to send a ship,
  each list offers Send.
- **Fleets:** rows with hull thumbnails (34px, drop shadow; neon glow when moving), name and ships,
  where/whither with trip ("→ Star · 3.2 ly · ~4t · 12 Myr · to survey" or "Star · idle / ready to
  settle / fortified / holding / exploring"), a Look inside button.
- **Threads** (`screens/Society.tsx`): Resolve, Dissent, "This age's tempo: 10^x yr per turn",
  Accord with Rally / Calm (price doubles per use, eases over ~10 turns); a card per Thread (xl
  icon, count, blurb in Spectral, Upkeep, Each makes, Clock, Tempo now, Standing bar, Demand, Hear
  them). One Thread shows an extra chip (sealed).
- **Charters:** "The book of laws · k of 5 (9) written · accord"; law cards (name, cost, flavour,
  effect, the Threads' stances, Enact / In force with Repeal… → Repeal for X / Keep it); a red
  section "The ways of the Hunger" (no repeal).
- **Signals** (`screens/Signals.tsx`): "Our clock" card; tabs Messages (open ones first, then
  Earlier: sender colour square, age of the light, title, Spectral text, choice buttons with hints),
  Survivors (cards: colour square, name or "Unknown signal", once in contact the plate of their way
  of life, adjective and way, distance, People, Toward us (friendly/wary/hostile with memory in the
  tip), Clock in reach or not, Aid received, Stars, Promised; actions: send energy, ask for help,
  pacts, war), and a third tab once other minds are known (sealed).
- **The Record** (`LogModal`): filters All, Ages, Choices, Minds, Losses, Gains; up to 400 entries,
  newest first, `numeral·turn` in faint mono; entries with a star are pressable and fly there.
- **Codex** (`CodexModal`): a 220px nav (groups "How to play", "The science") and an article.
  Manual topics: Getting started; Turns, time and pace; Energy; Settlements; Exploring and
  expanding; Research and Great Works; Threads, resolve and Charters; Other minds and the Hunger;
  Forecasts and Crossings; Endings; Controls; Low vision and the keyboard. Science topics: The
  Coalescence; The Tide and your pace; Threads and tempo; I. The Long Dusk; II. The Degenerate Age;
  Planetary fates; The fate of matter; The Long Flow; III. The Black Hole Age; IV. The Dark Era; The
  Hunger and free energy; Sources. Science paragraphs are `.flavor` (Spectral), manual paragraphs
  plain. Some paragraphs of four topics give spoilers away (sealed). In `Manual.tsx` prose,
  apostrophes are typographic (’): the strings are single-quoted.
- **Menu / Settings** (`SettingsModal`, title "Menu" in a game): Quick save, Save slots, load,
  export…, Codex, Main menu; Music % slider; Music track select ("Automatic: whatever fits the age
  and the moment" or a track; "Now: X"); Playlist (E.5.4); Sound effects % slider (clicks on
  change); Graphics low/medium/high; Magnifier mode On/Off with its description and, when on,
  Column on the left/right; Interface size (with "This screen has room for ×z at most"); Guide
  (Start the guide again, Open the manual); the refresh-rate note.
- **Save and load** (`SaveModal`): Main menu; Save slots (name field, Save to a new slot, rows with
  civ, turn, age, date, KB; Load, Overwrite → Overwrite?, × → Delete?); Quick save / Load quick
  save / Load autosave; Files: Export save file, Export all saves, Import save file…; Save codes:
  Make a save code (textarea, Copy), Load from a save code. `download.ts` offers files through the
  host's `downloads` capability inside the claude.ai viewer, else a blob link.

#### E.2.7 Story screens (`screens/Story.tsx`)

- **Event** (`EventModal`): a narrow modal with a plate (`Plate`, 220px: the event's own painting
  `art/events/<plate>.webp` over its art `art/<art>.webp` over a radial gradient of the art's tint;
  a bottom fade to the panel colour), the body pulled up 60px over the plate, eyebrow "Age · turn
  N", `h1.event-title` (display 800, 32px), Spectral text (17px, 300, line-height 1.6, max 64ch),
  choice buttons (label plus a dim hint line; disabled when not allowed), and for an event about a
  star a remembered checkbox "Show Star (now and after choosing)" (the view swings to the star as
  the event opens and after a choice). Its result shows next in a plain ModalFrame with Continue
  (no close). Focus goes to the title, never a choice. Art tints: dusk `#3a1a10`, degenerate
  `#141c2c`, blackhole `#1c1430`, dark `#0c0d10`, flare `#4a1c0c`, ruins `#241c16`, hunger
  `#2a0e0c`, sleepers `#10202a`, survivor `#1e1a14` (one more sealed).
- **Survey report** (`LoreModal`): the same layout, eyebrow "Survey report · World, Star", "We
  chose: X." in neon, Close.
- **Age intro** (`EraIntro`, at a new game): full-screen `.crossing` (black 0.8), the age plate at
  0.55 opacity under a radial vignette, "numeral · Science" (display 700, 0.3em, faint), the age
  name (`clamp(40px, 7vw/z, 76px)`, accent-soft), the intro (Spectral 18px), "η X: Y since the Big
  Bang…", Begin.
- **Crossing** (`CrossingScreen`): "The end of <age> · title", the new age's name, its intro,
  People and Settlements before → after (mono 20px, red/green), a scrolling list of what happened
  (`.lines.panel`, max height 34vh), Go on (min 220 × 44px). The `crossing` sound plays as it opens
  (`turnflow.ts`); Go on clears the crossing, sets the age's music and plays `click`.
- **Outcome** (`OutcomeScreen`): the same full-screen layout with a head, the ending's title, an
  epilogue, a summary line, each survivor's fate, Look around / Main menu (sealed: titles, texts,
  which plate).

#### E.2.8 Turn flow (`turnflow.ts`)

`doEndTurn()`: refuses while busy or over; plays `endturn`; clears messages in the magnifier mode;
snapshots fleets, known stars, research, contacts, ship counts; runs `endTurn`, `bump`, autosave.
Then: an outcome opens the outcome screen (music mood outcome); a crossing opens the crossing
screen and plays `crossing`; an age change sets the music; arrived signals with choices → "A signal
has arrived." / "N signals have arrived." + `signal`; first contact → a ping in their colour +
`signal`; up to two Record entries about our fleets → toasts with Look; wasted energy over 5 →
"N energy was lost: the reserve is full."; a finished project → the research prompt + `good`;
newly idle ships → the ship prompt queue; surplus research → "With insight to spare: …"; pings for
new stars `#bfe9ff` and surveys `#9ff5e6`; a living world → "Living world found: World in Star, N%
habitable, room for K Kin" with Look + green pings + `good`; a survey → "Survey complete: Star, N
worlds" with Look (opens the system) + `signal`, else "N new stars on the map."; a new settler →
"X is ready at Y. Open Fleets to choose a world."; a Long Sleep with no pending events ends the
next turn after 420 ms.

#### E.2.9 Keyboard (`main.tsx`)

Ignored with Ctrl/Meta/Alt, repeats, and in inputs. R Research, S Systems, F Fleets, T Threads, C
Charters, G Signals, L Record, K Codex (each toggles; screens swap into each other, and also from
Save and Menu; never over story dialogs); W Systems → Surveyed worlds; P pause orbits; V next view
mode; H home (the capital's system: in the galaxy at distance 150, in a system it enters it);
Escape (outside story dialogs) closes the survey report, else cancels targeting and clears the
selection; Enter ends the turn unless a button, link, `[role=button]` or summary has focus, or an
event is open. Magnifier mode: N next thing needing attention, B the selected settlement's Build
tab, M fold the column. Modals close on Escape themselves.

#### E.2.10 Tooltips, numbers and icons

- **Tooltips** (`Tip.tsx`): any element with `data-tip`; one global listener; text split on `\n`
  into lines; `.tip.panel` (max 320px, 13.5px, line-height 1.45) placed at pointer + (14, 16),
  kept on screen. Touch: no hover tips; a 500 ms still press (10 px slop) shows the tip and
  swallows the click and context menu it would make. Magnifier mode: tips for the keyboard focus
  too, placed beside the column (or below the element, above if no room), 440px, 15px, hoverable
  with a 350 ms grace, Escape puts one away.
- **Numbers** (`fmt.ts`): `n0` (k from 10⁴, M from 10⁶, en-US grouping, ∞), `n1` (one decimal below
  100), `mult` (two figures, `2.3×10⁻⁷`), `solarMass`, `signed` (+ above 0.049), `pct`, `pow10` (`10`
  + superscripts, `·` as the decimal point), `kelvin` (K, mK, µK, nK, then powers of ten; "the
  horizon’s" below 3×10⁻³⁰). `eras.ts`: `formatYears` (years, million/billion/trillion, `10^x years`,
  `10^(10^x)` in the Dark Era), `formatYearsShort` (yr, k yr, Myr, Gyr, Tyr), `formatEta`,
  `formatDistance` (ly, kly, Mly).
- **Exponents** (`sup.ts`): a Preact `options.vnode` hook rewrites every run of Unicode superscript
  digits (with `·` between digits) in string children of DOM elements (not `option`, `textarea`,
  `title`, `style`, `script`) into `<span class="sup">` with ordinary digits (`⁻` → `−`), `0.8em`,
  raised `0.42em`: the Google subsets carry only ¹²³. Stored strings stay Unicode.
- **Icons** (`icons.ts`, `Icon.tsx`): 60 original line glyphs on a 24 × 24 viewBox, stroke
  `currentColor` 1.5, round caps and joins, no fill (a few dots filled): energy, matter, insight,
  accord, industry, reserve, continuity, kin, echoes, chorus, lattice, coldminds, red_dwarf,
  white_dwarf, brown_dwarf, neutron_star, black_hole, planet, asteroids, gas_giant, galaxy, system,
  research, threads, doctrines, diplomacy, log, settings, end_turn, sleep, wake, fleet, colony,
  survey, colonize, attack, move, close, warning, clock, music, sound, save, load, cryo, upload,
  merge, seed, shield, dyson, accretion, relic, focus, queue, plus, minus, arrow_right, check,
  lock, info. Sizes 16px, `lg` 20, `xl` 26. `tools/icon-preview.html` shows them all.
- **Labels** (`labels.ts`): star kind names (Red dwarf, Blue dwarf, White dwarf, Black dwarf, Brown
  dwarf, Neutron star, Black hole, Supermassive black hole, Collision star, Helium star, Helium
  giant, Starless, No star left, one more sealed), world kind names by climate, `WAY_NAME` (garden
  "clinging to biology", upload "uploaded", chorus "merged into one mind", dormant "asleep, waking
  rarely", lattice "handed over to processes and protocol", fork "a Thread that left you"),
  `wayArt` (`way_<way>`, else `survivor`). Trip labels (`trip.ts`): "~26t · 2.9 Myr".

#### E.2.11 The phone interface (`styles.css` phones block; Drawer `SheetHandle`)

Under `PHONE_QUERY`, every rule is scoped `html:not(.lv)`. Text selection and the callout are off
(inputs excepted). The top bar gains the turn line; the resources hang under it (`--chrono-end`,
set by the Chronometer and `Hud.tsx`); `--hud-end` (the resources' foot, ResizeObserver) places
toasts, the banner, prompts, the guide, the to-do chips and the view switch under the top bar. The
rail is a row of 8 buttons along the bottom (bottom 76) with a 10px name under each icon ("Laws"
for Charters); the turn box is one row (the pace as one button that opens a list with each choice
explained, Sleep, net energy, End Turn 50px). The view switch is a column of 46px buttons at the
right edge under the top bar, its thermal legend to its left. Upright, the selection is a sheet
above the rail with three heights (`--sheet-room` × 0.36, 0.72, 1): a pick on the map opens it
small; a list or button opens it at the last size chosen; tap the handle (44 × 4 bar) to step up
(full wraps to small) or drag it (settles on the nearest); touching the map lowers it to small and
folds the top bar's details; the view slides so the selection stays between top bar and sheet.
Held sideways (≤ 500 px tall, ≥ 761 wide, coarse pointer): one-line top bar; the panel on the right
(`min(400px, 46%)`), the view sliding left of it; rail and turn box along the bottom. While
choosing a destination the Drawer hides. The ship prompt is not shown on phones.

---

### E.3 Accessibility

- **Keyboard** (`a11y.ts`): a clickable row is `{...pressable(fn, disabled?)}`: role button, tabIndex
  0, `aria-disabled`, Enter or Space presses it (not on repeat; propagation stopped), and a mouse
  down prevents focus and blurs, so the next Enter still ends the turn. Never a bare `onClick` on a
  div. Focus rings only once Tab is used (`html.kbd`, cleared by any pointerdown): 2px
  `--accent-soft` outline drawn inside (`outline-offset: −2px`, so the chamfer clip-path does not
  cut it); none on `tabindex=-1` titles.
- **Dialogs:** `useFocusOnOpen` focuses the window title on open (taking the previously focused
  element at the first render, before the HUD goes inert) and gives focus back a frame after close
  (in the magnifier mode a waiting prompt's or the guide's title first). Events and survey reports
  focus their titles. The HUD wrapper is `inert` under any window or story dialog.
  `role="dialog"`, `aria-modal`, `aria-label` on windows; `role="status" aria-live="polite"` on
  toasts and the target banner; the feed is `aria-live`.
- **Whole-panel scroll** (`useWholeScroll`): the Drawer and event dialogs scroll as one when the body
  gets under 150 UI px (back above 190); in such a panel build descriptions clamp to two lines.
  The rail's max height stops it above the forecasts.
- **The magnifier mode** (Settings, or `?lowvision`; class `html.lv`, `html.lv-left`): the HUD
  becomes one scrolling column (`.hud`: `display: flex`, absolute top/bottom, right (or left),
  width `min(420px, 100%)`, background `--void`, 2px border `--line-3`, z 3), its parts unpositioned
  and ordered: bar 0, Chronometer 1, Resources 2, prompts/guide/banner 3, turn box 4, rail 5
  (two-column grid), bottom-left 6, view switch 7, Drawer 8 (last, so the rest keeps its place).
  `LvBar` "Hide the panel / Show the panel" (M) folds it to its bar. Two more sizes (1.6×, 2×),
  capped at width/360. Contrast: `--ink-dim #d2c9ba`, `--ink-faint #aaa194` (7.7:1),
  `--line 0.26`, `--line-2 0.5`, `--line-3 0.72`, solid panels without grime or worn edges, no
  blur, no text-transform or letter-spacing, system-ui faces for UI and display, Spectral at 400,
  no glows on phosphor or neon text; disabled controls dashed at 0.8 opacity instead of faded;
  chosen buttons marked with a 3px inset bar; focus 3px white outline with a 6px black inset
  shadow; titles focused by script a dashed outline. Windows fill the screen (event plates 110px).
  Toasts sit beside the column's top (`--lv-col`), stay until closed (× button) or the next turn.
  On the map: marks 1.5× (nodes, swarms, fleets, thicker selection ring; not the dust), pick reach
  1.5×, labels `600 15px × zoom` brighter with spacing to match and 24 of them, `MapHover` names
  what is under the pointer in 16px beside it; no grain, vignette or fringes; switching the mode on
  also sets the enhanced view; the camera centres the selection in the free part (`setFocusX`).
  Focus follows what opens: each new selection's panel title, a Build list opened by `openBuildFor`,
  prompts and the guide. The Systems window gains "Seen from afar". N/B/M keys (E.2.9).
- **Browser translation** (`translateGuard.ts`): a MutationObserver on `#ui` waits for the first
  added `<font>` (Chrome's translation), then pairs each removed text node with the `<font>` that
  replaced it and patches `Text.prototype.parentNode`, `nextSibling`, `data` (setter puts the text
  node back, so it is translated again) and `Node.prototype.insertBefore`/`removeChild` to act on
  the stand-in. Untranslated, only the observer runs.
- **Fonts and readable exponents:** see E.2.10 and E.4. Root font size 15.5px (14.5px under 760px
  wide); since 7 Oct every size up to 14px is 1.5px larger than the original.
- `prefers-reduced-motion: reduce` turns all CSS animation and transitions off and keeps the title
  still.

---

### E.4 Visual style (`ui/styles.css`, "the worn instrument")

**Direction:** painterly cinematic, the soot-stained decay of a lived-in future without retro kitsch,
a small dose of neon where people still live; honest black skies (no nebulae); gunmetal panels
with grime and scratches, chamfered corners, worn hairlines, CRT-phosphor figures, stencil labels,
hazard striping only for danger. One dark theme only (`color-scheme: dark`).

**Fonts** (`index.html`, Google Fonts, `display=swap`, preconnect to both hosts):
`Big+Shoulders+Display:wght@500;700;800`, `IBM+Plex+Mono:wght@400;500`,
`Saira+Semi+Condensed:wght@300;400;500;600`, `Spectral:ital,wght@0,300;0,400;1,300;1,400`. Tokens:
`--f-display` Big Shoulders Display (titles, stencils), `--f-ui` Saira Semi Condensed (interface),
`--f-mono` IBM Plex Mono with tabular numbers (figures), `--f-text` Spectral (narrative, flavour),
each with fallbacks (Oswald/Arial Narrow; Roboto Condensed; SFMono/Menlo/Consolas; Iowan Old
Style/Georgia).

**Colour tokens** (`:root`): `--void #030306`, `--panel rgba(13,12,14,0.9)`, `--panel-solid
#0d0c0e`, `--panel-2 #161418`, `--panel-3 #1e1b1f`, `--line/-2/-3 rgba(233,223,207, 0.12/0.22/0.4)`,
`--ink #e9dfcf`, `--ink-dim #a89e90`, `--ink-faint #6f685f`, `--good #9fcf8f`, `--bad #e5634a`,
`--warn #e8b64a`, `--boon #9fd3ff`; per age (set by `App`):

| Age | `--accent` | `--accent-soft` | `--neon` |
|---|---|---|---|
| I The Long Dusk | `#f28a4f` | `#ffb77a` | `#4fe3d1` |
| II The Degenerate Age | `#93c4ff` | `#cfe3ff` | `#ff5fa2` |
| III The Black Hole Age | `#a48dff` | `#d2c6ff` | `#ffb347` |
| IV The Dark Era | `#9aa3b0` | `#c9ced6` | `#7fd8ff` |

The neon also colours our settlement rings, habitat tori and territory on the map.

**Panel** (`.panel`): background `--panel`, 1px `--line-2` border, a chamfer of 10px on the top-left
and bottom-right corners (`clip-path` polygon), `backdrop-filter: blur(3px)` (none on coarse
pointers). `::before`: two inline SVG `feTurbulence` textures, grime (`baseFrequency 0.9`, 3
octaves, 220px tile) and long horizontal scratches (`0.004 0.35`, 2 octaves, seed 7, 400px tile) at
opacity 0.06, `mix-blend-mode: screen`. `::after`: a brighter top hairline `rgba(233,223,207,0.18)`
masked to leave gaps at 12–16% and 58–61% (worn paint). `.scan`: faint 1px scanlines every 3px
(Chronometer, Resources).

**Type styles:** `.stencil` (display 700, 12.5px, 0.16em, uppercase, dim); `.eyebrow` (UI 500, 12.5px,
0.14em, uppercase, faint); `.mono`; `.phos` (mono with a glow `0 0 6px` accent at 45%); `.neon`
(neon with a glow); `.flavor` (Spectral 300, 15.5px, 1.5); section `h3` (display 700, 13.5px,
0.18em, uppercase, a hairline running to the right). `.greek` keeps η lowercase inside uppercase.

**Buttons** (`.btn`): 30px min height, 4px 12px, `--line-2` border, a top-light gradient over
`--panel-2`, UI 500 14.5px 0.04em, 6px chamfers; hover: accent border, white text, accent-tinted
gradient; `.primary` accent border with a 30%→8% accent gradient; `.ghost` transparent; `.small`
24px 13.5px; `.danger` red border; `.on` neon border and text; disabled 0.4 opacity. `.iconbtn`
38 × 38 with a neon `.badge` (15px pill, dark text). Chips (`.chip`, 1px border, 12.5px; danger, warn,
boon, good, neon, lore variants). Bars (`.bar`, 5px, `> i` fill; `.ticks` adds tick marks every
10%). `.hazard` amber/black stripes at −45°. Lists (`.list-item` 6px 4px, hairline below, hover
tint, `.active` accent tint). Structure kind colours: energy `#f2c94c`, storage `#b9a3ff`, matter
`#c9a07a`, industry `#f28a4f`, insight `#8fb8ff`, accord `#e3a6d6`, people `#4fe3d1`, world
`#9fcf8f`, defence `#e5634a`.

**Map labels:** UI 500 11px, 0.04em, `rgba(233,223,207,0.62)`, black text shadows (3px, 8px);
`mine` neon; `seen` italic 0.4; `surveyed` `rgba(214,232,236,0.78)`; `living` boon; `province`
display 700 14.5px 0.2em uppercase 0.45; `body` 0.72; `beacon` `#ffe0a0` 600 with an amber glow;
`others` 600.

**Plates in the interface:** event plates 220px with a fade into the panel; drawer/card plates
138px / 112px (`background-size: cover`, inset hairline, radius 3); crossing/intro/outcome plates
full screen at 0.55 under a radial vignette; ship thumbnails 34px and 64px with a faint teal drop
shadow. Animations: toasts slide in 0.25 s, prompts 0.3 s, the guide ring pulses.

---

### E.5 Audio (`src/audio`)

#### E.5.1 The graph (`core.ts`)

Created on the first `pointerdown` or `keydown` (`installUnlock`; the menu says so):
`new AudioContext({ latencyHint: 'playback' })`.

```
music gain (music²) ──┐
sfx gain (sfx²) ──────┼─> master (0.9) ─> DynamicsCompressor(−16 dB, ratio 3, attack 0.02, release 0.4) ─> destination
reverbIn (1) ─> Convolver ─> reverbOut (0.55) ─┘
musicWet (music²/0.49) ─> reverbIn      (the synth's echo, at the music's volume)
```

Impulse: stereo noise × `(1 − τ/5.5)^3.2`, 3 s long (was 5.5 s; shortened 15 Oct because the
audio thread stuttered), a 400-sample fade-in and a 0.2 s fade-out. A 2 s mono noise buffer is
shared. `setVolumes(music, sfx)`: perceptual squared curve, `setTargetAtTime` 0.1 s (sfx 0.05);
volume listeners notify recordings. `musicLevel() = music²`.

#### E.5.2 The synthesized score (`music.ts`)

A lookahead scheduler (every 40 ms, 0.3 s ahead, 16 steps a bar; if it fell more than 0.2 s
behind it skips ahead instead of bursting) on the audio clock. Each style:

| Style | BPM | Root (MIDI), scale | Progression (degrees) × bars | Pad | Arp | Bass | Drums | Drone (notes, cutoff) | Bells | Other |
|---|---|---|---|---|---|---|---|---|---|---|
| Menu | 74 | 57 (A), minor | 0 5 2 6 × 2 | saw, 1100 Hz, ±9 c, 0.05 | square, every 2 steps, 0 1 2 3 2 1 2 4, oct +1, p 0.85 | `x.......x.......` 0.09 | none | −24 −17, 400 | none | crackle 0.2/s, hiss 0.001 |
| Dusk | 84 | 50 (D), Dorian | 0 5 3 4 × 2 | saw, 1300, ±11 c, 0.045 | saw, every step, 0 2 1 3 0 2 4 3, oct +2, p 0.9 | `x.x.x.x.x.x.x.xo` 0.1 | kick `x.......x.......`, snare `....x.......x...`, hat `..x...x...x...xo`, vol 0.8 | −24 −12, 500 | none | crackle 0.25, hiss 0.001 |
| Degenerate | 64 | 52 (E), 0 2 3 7 9 10 14 | 0 3 5 1 × 4 | triangle, 2600, ±5 c, 0.05 | sine, every 4, 4 2 5 1 3 0, oct +2, p 0.45 | none | none | −24 −17 −12, 700 | 0.05, p 0.35 | crackle 0.12, hiss 0.0006 |
| Black Hole | 50 | 49 (C♯), Phrygian | 0 1 0 6 × 4 | saw, 380, ±14 c, 0.05 | none | none | none | −36 −24 −17, 260, vol 0.07 | 0.045, p 0.25 | boom every 8 bars, crackle 1.0, hiss 0.0005 |
| Dark | 40 | 45 (A), minor | 0 × 8 | none | none | none | none | −24 −5, 180, vol 0.035 | 0.03, p 0.1 | crackle 0.06, no hiss |
| Outcome | 56 | 50 (D), major | 3 0 4 5 × 4 | saw, 1500, ±8 c, 0.05 | triangle, every 4, 0 1 2 4, oct +2, p 0.6 | none | none | −24, 400 | 0.03, p 0.2 | crackle 0.08, hiss 0.0005 |

Voices: chord tones root, 3rd, 5th, 7th, 9th from the scale. **Pad**: five notes (root −12, root,
3rd, 5th, 7th), two detuned oscillators each, alternately panned ±0.35, low-pass Q 0.7 sweeping
`0.35·cut → cut` over 45% of its span and back to half, attack up to 1.6 s, release 1.8 s.
**Arp (pluck)**: low-pass Q 4 from `3·cut` to `0.6·cut` in 0.18 s, 5 ms attack, pan `0.5·sin(1.3t)`,
through a dotted-eighth echo (delay `0.75 beat`, feedback 0.38 through a 2.2 kHz low-pass, wet 0.5).
**Bass**: saw through a 700 → 160 Hz low-pass, plus a sine an octave down. **Kick** 120 → 42 Hz in
0.12 s; **snare** band-passed noise at 1.9 kHz twice (one copy into the reverb at 1.3) plus a 220 →
160 Hz tone; **hat** high-passed noise at 7.5 kHz; drums come in from bar 8 of every 24 (always in
tension; hats ×1.2 in tension, else ×0.8). **Bells**: FM, modulator 3.51×, index `2.2·f → 0.05·f` over
2.5 s, 6 s decay, random pan, on steps 0 and 8 with probability `prob/2`. **Boom**: 48 → 26 Hz over
4 s. **Crackle**: tiny high-passed noise grains (2–7 kHz, random pan). Every oscillator's detune
gets a tape wobble (LFO 0.27 Hz, ±7 cents). **Drone**: two saws per note (−4/+5 cents) through a
low-pass (Q 2) whose cutoff an LFO at 0.041 Hz sweeps by half. **Hiss**: looped noise band-passed at
3.5 kHz (Q 0.4) through its own gain. Tension raises the arp's probability by 0.1. The layer bus
sends 0.6 into `musicWet`.

Style changes crossfade: the old bus ramps to 0 over 3.5 s, its continuous sources stop at 3.6 s,
its recording fades over 3.5 s, all disconnected after 5 s.

#### E.5.3 Recordings (`music.ts` `PIECES`, `trackOut.ts`)

| Key (Settings name) | Pieces (id: label, file) |
|---|---|
| menu (Title) | title: Recorded `music/title.mp3`; menu.synth: Synthesized |
| dusk (The Long Dusk) | dusk: Recorded I `dusk.mp3`; dusk2: Recorded II `dusk2.mp3`; dusk3: Recorded III `dusk3.mp3`; dusk.synth |
| canon (Canon in D, the Degenerate Age's overture) | canon: Arranged `canon.mp3` |
| degenerate | degenerate: Recorded I; degenerate2: Recorded II; degenerate.synth |
| blackhole | blackhole: Recorded I; blackhole2: Recorded II; blackhole.synth |
| dark (The Dark) | dark: Recorded I `dark.mp3`; dark3: Recorded II `dark3.mp3`; dark.synth |
| outcome (The Ending) | outcome: Recorded `outcome.mp3`; outcome.synth |

- The style follows the mood: menu → menu, outcome → outcome, otherwise the age; an override from
  Settings → Music track plays one key until set back to Automatic.
- **Rotation:** the pieces lit in the playlist (`pieceOn`: recordings on, synth off by default);
  none lit → the synth piece. A lone piece loops (`el.loop`); several take turns: a recording fades
  out over its last 4 s (`timeupdate`), the next fades in over 3 s; a synth piece plays 170 s
  (`SYNTH_SPAN`) on the audio clock. A file that errors passes to the next, once round, then the
  synth. Each age needs at least one piece ("Each age needs at least one piece to play.").
- **Overture:** the first time the Degenerate style comes up in a session (not when picked by hand,
  and not with "Canon first" off) `canon.mp3` plays once before the rotation.
- **The synth as fallback:** a layer with a recording due starts silent (bus 0, hiss 0, no
  continuous sources built). When the recording fires `playing` it fades to `TRACK_GAIN` 0.5 over
  3 s; if the synth was sounding it fades out over 3 s and its continuous sounds stop after 3.2 s
  (`hushAt`). If the recording has not started within 8 s (`RECORDING_GRACE`) the synth fills in.
- **How a recording plays** (`trackOut.ts`, 15 Oct): `trackOut(el)` returns an `ElementOut` where
  a page can set `HTMLAudioElement.volume` (tested by setting 0.5 and reading it back; iOS Safari
  reads 1): the element plays through the browser's media pipeline and its
  `volume = clamp(level × hold × music² × 0.9)` (`0.9` = the master gain), updated on a 40 ms
  interval while any fade runs (fades are ramps on `performance.now()`) and at once on a volume
  change. Otherwise `GraphOut`: `MediaElementSource → gain → audio().music` with linear ramps.
  Never create a MediaElementSource for an element played by its own volume. `holdElements` (a
  shared duck) exists but nothing in this version calls it.
- **Hidden tab:** nothing is suspended; on show, a suspended context is resumed and a wanted
  recording the browser paused plays on (`layer.onShow`).

#### E.5.4 Settings → Playlist

One row per key except the Canon: its name, a toggle per piece (tip "A recorded track (a generated
instrumental)." or "The game’s own score, synthesized as it plays."), and for the Degenerate Age a
"Canon first" toggle; note "Each age plays the pieces lit here in turn, fading from one to the
next; a lone piece repeats." Changing the current age's rotation restarts its music at once.

#### E.5.5 Interface sounds (`sfx.ts`)

All synthesized, scheduled 5 ms ahead; tones are exponential-envelope oscillators, noises filtered
bursts of the shared buffer. A send bus made once routes some to the reverb at 0.35.

| Name | Sound |
|---|---|
| `click` | (debounced 30 ms) band-passed noise tick at 3.2 kHz (Q 2), 18 ms, 0.12, plus a 1.8 → 0.9 kHz square blip, 30 ms, 0.025 |
| `select` | two triangle notes, 660 Hz (60 ms) then 990 Hz at +50 ms (90 ms), through the reverb |
| `open` | a 600 → 2400 Hz band-passed noise sweep, 0.22 s, through the reverb, and a 220 → 330 Hz sine (reopening a survey report from a world's panel) |
| `endturn` | a heavy relay: 90 → 42 Hz sine 0.35 s at 0.35, a 50 ms low-passed noise thump, then the hum of time passing: 1.4 s band-passed noise sweeping 300 → 2600 Hz and a faint 220 → 440 Hz saw, through the reverb |
| `signal` | radio: 0.35 s of static (band-pass 1.8 kHz, Q 4), then sine tones 880, 1175, 988 Hz at 0.16 s spacing |
| `crossing` | 5 s: a 55 → 27.5 Hz sine at 0.4, an 82.4 → 41.2 Hz saw, 4 s of low-passed noise falling 400 → 60 Hz, all in the reverb |
| `good`, `build` | triangle 523 Hz then 784 Hz (+90 ms) |
| `bad` | two saws 220 → 150 and 233 → 156 Hz, 0.28 s (a sour beat) |
| `warn` | two square beeps at 740 Hz, 0.18 s apart |

Volume sliders: Music and Sound effects, 0–100% in steps of 5, squared.

---

### E.6 Assets (`public/`)

All plates are 1600 px wide WebP (VP8, quality 80) graded by `tools/process-art.mjs` (resize to 1600
wide; optional blurred boxes over stray letter shapes; per-plate channel gains and lifts — WARM
gain (1.04, 1, 0.94) lift (7,5,5), COLD (0.95, 1, 1.05)/(4,5,8), VIOLET (1, 0.96, 1.05)/(6,4,8),
GREY (0.99, 1, 1.01)/(5,5,6), NEUTRAL (1.02, 1, 0.97)/(6,5,5); saturation 0.9; a seeded triangular
grain (amount 22) in soft-light; a radial vignette from 55% to 100% at 0.55 (0.75 for `dark`)).
Sources live in `art-src/` (git-ignored; the graded files are the only copies). Prompts for most
plates were not recorded; the style recipe that was: "A civilization …: <scene>. Painterly digital
painting, dark and grainy, muted <palette>, soft brushwork, cinematic composition. No text, no
letters, no signatures.", with a graded plate attached as a style reference.

#### E.6.1 Ages and special plates (`public/art/`)

| File | Size | Grade | Depicts | Used |
|---|---|---|---|---|
| `title.webp` | 1600×893, 95 KB | WARM | a domed, neon-striped city on a crag of a dusty red world, a big rusted ring structure hovering over a dust whirl, the curve of the planet, a large red sun right | title, Setup (0.35) |
| `title-loop.webm` / `.mp4` | VP9 76 KB / H.264 1280×714 218 KB, 5.04 s | — | the title painting slowly alive, first frame = last frame, colour-matched to the still (Kling 3.0) | title loop |
| `dusk.webp` | 1600×893, 115 KB | WARM | frost-covered domes and pipes with teal light slits on a frozen cracked plain, sagging power lines, a huge low red sun | Dusk intro/crossing, Dusk events |
| `degenerate.webp` | 1600×893, 80 KB | COLD | a ring of battered mirror collectors around a tiny white star, a patched station with teal windows | Degenerate |
| `blackhole.webp` | 1600×893, 58 KB | VIOLET | a black hole with a thin pinkish accretion disk, a rusted habitat on a cable, violet sky | Black Hole Age |
| `dark.webp` | 1600×900, 23 KB | GREY | a lone grey station with solar wings in near-total black | Dark Era |
| `flare.webp` | 1600×893, 156 KB | WARM | domed shelters with amber and teal lights under a blinding red-orange stellar flare | flare events |
| `ruins.webp` | 1600×893, 158 KB | NEUTRAL | broken circular walls and leaning pitted towers of an ancient ruin, a rover with a teal light bar, a small red sun | ruins and relic events |
| `hunger.webp` | 1600×893, 106 KB | NEUTRAL | an asteroid shredded into a cloud of rusted, red-lit machine fragments | Hunger events (and one ending, sealed) |
| `sleepers.webp` | 1600×893, 224 KB | COLD | an iced corridor of cold-sleep berths, a lantern, a teal floor strip | a relic event |
| `survivor.webp` | 1600×893, 139 KB | NEUTRAL | through a scratched brass porthole and telescope, a far cluster of warm lights round a dim star | first contact; generic way plate |
| `swarm.webp` | 1600×893, 155 KB | NEUTRAL | a murmuration of dark harvester motes wrapping a pocked, rust-scarred moon and a grey planet | swarm panel |
| `swarm_tamed.webp` | 1600×893, 252 KB | COLD | drones in ordered rings on an icy surface around a lit hangar | tamed swarm panel |
| `slow.webp` | 1600×900, 174 KB | VIOLET | (sealed) | not used by the code at this commit |

Made: the eleven of `84a766a` (title, the four ages, flare, ruins, hunger, sleepers, survivor and
one more) with Krea (Nano Banana Pro) and Codex image generation; the swarm plates with Nano Banana
Pro via Krea (`1981611`).

#### E.6.2 The six ways of life (`public/art/way_<way>.webp`, `labels.ts` `wayArt`)

| File | Size | Grade | Depicts | Made |
|---|---|---|---|---|
| `way_garden` | 1600×893 | WARM | glass greenhouse domes with green plants and figures, half-buried in snow under a red sun ("clinging to biology") | Nano Banana Pro via Krea, 2K 16:9 |
| `way_upload` | 1600×893 | COLD | a moon cut into crystal server spires and radiator walls with blue circuit light, a dark red sun | same |
| `way_chorus` | 1600×717 | VIOLET | a web of linked habitats and light points in a violet haze round a red star (painted letterbox cropped, 152/151 px of 1536) | same |
| `way_dormant` | 1600×893 | COLD | frosted cold-sleep halls, one hooded keeper with a lantern at a dial panel | same |
| `way_lattice` (the Tessellate) | 1600×900 | NEUTRAL | a dark airless moon tiled in vast hexagonal plates of machinery, maintenance drones on the seams, a dim red-brown dwarf; painted signature softened | Codex; prompt from its blurb: "the whole surface of a dark, airless moon tiled in vast hexagonal plates of machinery … maintenance drones crawling along the seams … no people anywhere … a dim brown dwarf, a dull, faint red-brown disc" |
| `way_fork` | 1600×900 | NEUTRAL | rusted domed habitats on a pipeline among asteroids, a detached flotilla with thrusters, a red sun | Codex |

Shown on Signals cards and in a star's Others section once in contact (138px / 112px crops).

#### E.6.3 Event plates (`public/art/events/`, Codex image tool, 29 Sep, 1600×900)

Shown over their era's plate for these events (`plate` in `game/data/events.ts`): `dynamo_fails`
(The Dynamo Falters: an antenna mast over a domed city, a red sun, faltering green aurora),
`first_night` (Counting the Dark: a lit observatory dome on a snowy cliff above a domed city, stars,
a red sun), `last_rain` (The Last Rain: a crowd in rags lifting faces to rain in a plaza under a red
sun), `sea_freezes` (The Sea Freezes Over: steaming leads in breaking sea ice, a domed harbour),
`who_sleeps_first` (Who Sleeps First: families waiting with luggage beside iced cryo pods),
`mantle_settles` (The Mantle Settles: frosted rusted pipelines and steaming wells on a cracked
plain), `comet` (A Wandering Comet: watchers on a railed walkway, the tail pointing away from the
red sun — the first try pointed it back), `prophet_of_stillness` (The Prophet of Stillness: a robed
figure before a vault of sleepers addressing a candlelit crowd; a banner emblem softened),
`first_upload` (The First Upload: an old man with an electrode circlet in bed, a woman holding his
hand, a teal-lit apparatus), `new_star` (A New Star: a red star igniting in a swirl of debris, a
ship on a rock), `white_fire` (White Fire and A Helium Giant: a blue-white star in a shell of gas
beyond a ring of collectors), `supernova` (Supernova: a burst over a field of collector panels),
`cast_out` (Cast Out: a lone white star with a ringed station, the galaxy far behind), `unmoored`
(Unmoored: a frozen world drifting from its star, shedding rock), `world_falls` (A World Falls: a
world breaking into a stream spiralling onto a white dwarf), `final_burst` (The Last Burst: a violet
flash inside a ring of collector plates). Grades: the Dusk's WARM, the Degenerate Age's COLD,
`final_burst` VIOLET. Events whose picture would give something away keep their era's plate on
purpose.

#### E.6.4 Survey discoveries (`public/art/finds/`, Higgsfield, Nano Banana 2, 28 Sep)

1600×893 (`interstellar_shard` 1600×824), used as `art: finds/<id>` for the event `anom_<id>`:
`vent_life` (Life Under the Ice: a lit ROV at a mineral chimney), `fossil_reactor` (The Ghost of a
Reactor: a drill rig and core racks at a banded cliff), `diamond_mantle` (A Carbon World: a lander
on the lip of a chasm of crystals), `primordial_hole` (A Black Hole the Size of a Mountain: a
probe among asteroids round a blue-white point), `interstellar_shard` (A Visitor From Another Star:
a long dark cigar-shaped body and a probe; letterbox cropped), `fossils` (Someone Lived Here:
suited figures among ring-patterned stones, a rover), `flare_glass` (Plains of Glass: a rover on
cracked glassy ground, a huge red sun), `clathrates` (Fuel in the Ice: suited figures under a drill
in an ice cave), `lens` (A Lens in the Dark: telescopes under an Einstein ring), `sail_graveyard`
(A Graveyard of Sails: torn light-sails drifting before a planet), `resonance` (Kept Warm by Its
Neighbours: an icy plain with glowing fissures, two crescent moons), `magnetar_print` (Written by a
Magnetar: suited crew at a sensor mast, a blue star), `warm_rogue` (Warm in the Dark: a rover by a
steaming lake with lava glow; signature softened). Two painted signatures softened and one
letterbox cropped.

#### E.6.5 Ship sprites (`public/art/ships/<look>.png`, 256×256 RGBA, bow up)

`settler` (Kin Ark: a spoked ring-habitat on a spine with solar panels), `probe` (a dish probe with
gold foil and a blue thruster), `war` (Warden: a hammerhead escort with twin engines), `other` (a
container hauler with orange crates and swept wings) — Higgsfield, Nano Banana 2 (`db96b26`);
`lighter` (System Lighter: a stubby chemical rocket with side tanks), `seedcore` (a hexagonal core
with blue light and radiator wings), `spore` (Lattice Spore: an egg of hexagonal plates with
amber cells), `vaultship` (Vault Ship: a round head over stacked white pods), `aegis` (a heavy
picket round an orange reactor), `tender` (Swarm Tender: a black disc with teal lights and two
dishes) — Codex, prompt "square, one ship from directly above, bow up, flat pure black background"
with the four older hulls attached. `tools/process-sprites.mjs` cuts each out: the background is
the dark region (max channel < 46) flood-filled from the edges (dark parts inside a hull stay
solid), alpha `smoothstep(10, 46, brightness)` on the edge, un-premultiplied (×1/a, at most 4) so no
dark fringe, a square crop with 6% margin, Lanczos to 256.

#### E.6.6 Music (`public/music/`, MP3 192 kbps, 48 kHz)

Durations from size at 192 kbps (approximate).

| File | Length | Age / use | Made | Level, key, character |
|---|---|---|---|---|
| `title.mp3` | ~172 s | title (menu) | ElevenLabs Music v2.5 via Krea, `force_instrumental`, looped with `loop-track.py` (crossfade 4 s) | −14.2 LUFS; F♯ minor; "dark ambient synthwave, about 74 BPM, worn analog pad over a sub drone, a slow glassy arpeggio with a slight bit-crushed 12-bit texture like a 1991 Amiga soundtrack, a distant gated snare now and then, tape hiss, melancholic but warm and inviting" |
| `dusk.mp3` | ~170 s | Dusk I | ElevenLabs via Krea (prompt not recorded) | −12.7 LUFS |
| `dusk2.mp3` | ~175 s | Dusk II | same model; levelled only (crossfade 0) | −13.3 LUFS (peak-limited); came out in A major; asked "about 84 BPM, D Dorian, a softly pulsing bass, a slow glassy arpeggio, a soft kick and gated snare far back; wistful and purposeful, like working late under a dying red sun" |
| `dusk3.mp3` | ~160 s | Dusk III | made as a Dark track (12 Oct); the player put it in the Dusk; `loop-track.py 'raw.mp3|dusk3.mp3|-15|6|20'` | −13.8 LUFS; A minor ~64 BPM, chords Am F C G / Dm Am Em F; `top` 21%, `chroma` 0.18; full prompt in DEV-NOTES "dusk3" |
| `canon.mp3` | ~149 s | the Degenerate Age's overture | `tools/music/canon.py` (numpy/scipy), ffmpeg `volume=-2.9dB`, 192k | −15.2 LUFS; D major (E.6.7) |
| `degenerate.mp3` | ~170 s | Degenerate I | ElevenLabs via Krea | −14.7 LUFS |
| `degenerate2.mp3` | ~175 s | Degenerate II | same; asked "about 64 BPM, E minor, triangle pads, a sparse music-box arpeggio that comes and goes, bells, a low drone; contemplative, lonely, strangely beautiful" | −14.7 LUFS; a drone on D♯ (kept: it alternates with one that moves) |
| `blackhole.mp3` | ~174 s | Black Hole I | same; "very slow, about 50 BPM, detuned sawtooth pads through a nearly closed filter, a sub-bass drone, rare distant bells, a deep boom every half minute, faint crackle and bit-crushed grain, no drums or arpeggio"; crossfade 6 s | −19.7 LUFS; around B |
| `blackhole2.mp3` | ~178 s | Black Hole II | same; "about 48 BPM, a slowly breathing sub drone, a low choir-like analog pad (synthesised), the metallic ring of struck plates, a rotating shimmer like light bent around a horizon; awed rather than menacing" | −19.7 LUFS; a drone on D |
| `dark.mp3` | ~167 s | Dark I | same; "a single low drone, a lonely distant tone every so often into a very long reverb, a trace of bit-crushed noise, long near-silences, no pulse"; crossfade 8 s | −19.3 LUFS; a drone on A♯ |
| `dark3.mp3` | 201 s | Dark II | `darken.py` remix of dusk3 (−4 semitones as tape slowed: ~51 BPM F minor, 12 dB/oct low-pass 3 kHz, 6 s noise reverb wet 0.35), `loop-track.py '…|dark3.mp3|-20.9|8|30'` | −19.3 LUFS; `top` 25%, `chroma` 0.15 |
| `outcome.mp3` | ~165 s | the outcome screen ("The Ending") | ElevenLabs via Krea; "the closing theme, whichever way it went; about 56 BPM, D major leaning bittersweet toward B minor, a warm pad and a simple unhurried melody on a glassy lead; no drums, no big climax"; crossfade 6 s | −14.2 LUFS; G minor |

The looping prompts end with "one steady texture, no build-up and no ending, so it loops
seamlessly; no vocals, no choir" (words that make drones; a track meant to move wants a key,
chords, a melody, an arpeggio and sections: `movement.py` `top` under ~35%, `chroma` over ~0.1).
A removed drone (`dark2`) and an AI Canon were tried and rejected; a new track takes a new file name
and a new `id`. The player hears a generated track before it goes in.

#### E.6.7 Music tools (`tools/music/`)

- `canon.py`: Pachelbel's Canon in D (public domain) for the Degenerate Age: ground bass D3 A2 B2
  F♯2 G2 D2 G2 A2 at 1.3 s per quarter (~46 BPM, a 10.4 s cycle), 13 cycles + 14 s tail; three
  voices in canon two bars apart through variations A–H and a closing Z (A, B on a string pad an
  octave down, C, D on a choir pad, E–H runs on a glassy pluck with a dark dotted-eighth echo);
  sampled-sounding tables read nearest-sample (Amiga grit), sample-and-hold crush (14 kHz pads,
  12.5 kHz 8-bit runs), a sub drone on D1/A1/D2, a build-and-thin gain shape, a 6.8 kHz low-pass, a
  5.2 s dark hall, tape wow (0.33 Hz) and flutter (6.1 Hz), faint hiss; ends on a D major chord.
- `loop-track.py 'in|out|RMS dBFS|crossfade s|reach s'`: trims fade-in/out (8 dB under the median,
  within `reach`, default 12 s), equal-power crossfade end into start, sets RMS, limits peaks to
  −1.5 dBFS, encodes 192 kbps 48 kHz (miniaudio, numpy, lameenc).
- `loudness.py` (BS.1770-4 integrated loudness), `movement.py` (top-note share, chroma movement,
  onsets a minute, level spread), `darken.py` (slower and lower remix).

#### E.6.8 Other public files

`public/archive/2026-10-13/` (56 MB with `README.md`): a frozen playable build of PR #27
(`4aaaa2a`), served at `/archive/2026-10-13/`; never edited, excluded from diffs
(`.gitattributes` `linguist-generated -diff`) and searches (`.ignore`).

---

### E.7 Tests and shipping

#### E.7.1 The playtest (`tools/playtest.cjs`)

Playwright Chromium with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`
against a served build (`vite preview --port 4173`); ignores console errors matching
`fonts.g|ERR_CERT|net::ERR_|GPU stall|Automatic fallback to software WebGL`. Usage
`node tools/playtest.cjs [url] [outDir]`; ends "ALL CHECKS PASSED" or "N failure(s)".

1. At 1440×900 and 400×860: menu screenshot; `newGame({ seed: 24757 })`; every visible rail button
   must open a `.modal` (Escape after); on a phone, Codex and Save slots via Menu; then for each age
   (autoplaying up to 600 turns with `endTurns(1)`) a galaxy screenshot at distance 400 and the
   capital's system; no console errors.
2. Features at 1440×900: the guide appears (`tutorial: true`), Next; R opens and closes Research; K
   opens the manual; the research prompt after a finished project (fusion forced done), probes sent
   to the nearest stars; up to 6 real End Turns until a toast; an unsurveyed system shows only its
   star; S then the first settlement row focuses and follows the homeworld.
3. **Refresh-rate parity** (seed 1000): the loop stopped; the same camera start; a 0.8 rad yaw and a
   flight to another star; `frame(1/30)` × n against `frame(1/144)` × n for 0.5 s (tolerance 1e−6
   relative) and 3.0 s (1e−4) on distance, yaw, pitch and target.
4. **Zoom keeps the focus centred:** five wheel turns with the pointer at (20%, 25%) leave the
   centred capital under 1 px from the middle.

#### E.7.2 Save compatibility (`tools/savecompat.ts`, `npm run savecompat`)

Loads every save in `tools/saves/` (`.json`/`.txt`, gzipped allowed) through `readSave` → `migrate`,
checks `saveVersion` equals `SAVE_VERSION`, plays each to the end with the competent autoplayer
(at most 1200 turns), checks energy, matter, resolve, dissent and free energy stay finite, and at
10 turns in round-trips a save code and a save file. Ends "SAVE COMPAT OK (n saves)". Saves:
`551fb1a-seed24757-turn71`, `4fe2404-seed1000-turn87-clock`, `7d0806d-seed1000-turn85-star`,
`9eea773-seed1000-turn119-merger`, `9eea773-seed1000-turn120-giant`,
`98139af-seed1000-turn121-last-star-out`.

#### E.7.3 The checks (`tools/checks/`)

`run.mjs unit|browser|all [url] [out] [names…]` (`npm run check`, `npm run check:browser -- url`):
unit checks run with `tsx`, `cpus − 1` at a time; browser checks one at a time; prints `pass`/`FAIL`
per check with seconds and its last OK/FAILED line, then the failures' BAD lines, then "ALL CHECKS
PASSED (n)". Unit checks import `check`, `near`, `done`, `loadSave`, `args` from `lib.ts`; each ends
`TAG OK` / `TAG FAILED (n)`. `tsc` type-checks them (the Pages build runs `tsc`). Browser checks use
`lib.cjs`: `start(name, { width 1400, height 900, seed })` (waits for the server, Chromium with the
SwiftShader flags, a page with console errors collected — any one fails the check),
`ck.shot`, `ck.another(w, h)`, `ck.phone(w, h, query)` (isMobile, hasTouch), `ck.freshPhone`,
`finish(tag, ck)`, `run(body)`; screenshots in `playtest-shots/checks/<name>/`.

**The fonts trick:** the headless browser here cannot reach Google Fonts, and fallback faces measure
wider/shorter. With `STEL_FONTS=<dir>` (a `fonts.css` fetched with curl from the `index.html` URL
with a Chrome user agent, and every `fonts.gstatic.com` file saved under `files/` with `/` → `_`),
`lib.cjs` routes `fonts.googleapis.com` and `fonts.gstatic.com` requests to the local copy. Layout
checks (`mobile`, `a11y`) are meant to run with it (`mobile` says when the fonts are missing).

**Unit checks (49):**

| Check | Verifies |
|---|---|
| accord | Rally, Calm and Hear priced by use, once a turn each, easing back; prices survive a save |
| attack | warships fight a swarm together once a turn at the swarm's odds; win/lose effects; only warships |
| beacon | decoy beacons: 30 to light, 3 a turn scaled by the lived share, projected; they draw the nearest awake swarm; go dark when unfed |
| boil | worlds boil near helium stars; a helium giant swallows what orbits inside it |
| burst-reach | a burst reaches only what is still bound (rogue worlds neither harmed nor helped), by distance |
| castout | cast-out embers dim over a decade of η, then go black |
| claims | neighbours' expansion by way of life at 0.02 c, seen when the light arrives |
| clock | the new-star clock: free in tune, priced beyond, six turns of a sixth, then the Tide |
| clocks | the pace changes whom we can talk to (voice range, ×1000 or ×10⁶) |
| cold-energy | after the Last Light core heat fades ×0.8 a turn; no light collector without light |
| cooling | honest cooling laws per remnant kind, nothing jumps at the Last Light |
| curvature | curvature radiation warms bodies by one law scaled to the published figures |
| deadworlds | how worlds die and what is left (falls into the Heart, frozen worlds hold no one) |
| dealings | trade offers ask what each way lacks, never more than half of what we hold |
| determinism | a save code and a clone play 60 more turns identically to the original |
| dismantle | taking structures apart: refund, cost, refusals |
| embers-dim | the "embers dim" news only while the halo thins (η 22.3–25, by the halo's clock) |
| evap | a black hole evaporates: worlds adrift, our settlement stays, catchers catch the burst |
| fates | the three fates of matter: draw odds, where the Degenerate Age ends, old saves keep theirs |
| flash | helium giants light as their turn ends; a star too brief for a clock is caught in one turn |
| flow | the Long Flow at η 65: ruins flow, unattended settlements lose structures |
| focus | the Matter focus ×1.25 matter for a tenth of energy and insight; survives a save |
| follow | a second new star can be followed on when the first runs out |
| great-works | a complete Great Work takes nothing more (no Resume) |
| hunt | swarms go for our ships stopped within 25 ly (30% of turns) |
| icy | icy worlds sorted by their water at generation; runaway greenhouse steam |
| invariants | 12 autoplayed games checked every turn: no NaN, no negatives, no settlement on a gone world, health 0..1 |
| last-star | a late new star's timing and clock (details sealed) |
| late-sky | brown dwarfs' words follow their warmth; black holes listed by lifetime |
| neighbours | living neighbours: beams travel, news travels at light speed, refugees as far as room allows |
| old-saves | two saves from `9eea773` boil and convert as they should |
| outer | cold outer worlds at red and brown dwarfs; rust fades |
| pace | which paces change the coming turn, situation by situation |
| quake | a misread answer can shake a world (context sealed) |
| quick | Quickening splits a new star's clock turns into ten |
| refuge | a dying partner who trusts us asks to come; arrivals where we have room |
| refund | removing a queued item refunds at the recorded price; survives a save |
| repeal | repealing a charter: cost, opinions turned, dissent, no second windfall, dark laws stay |
| rogue-reach | a world flung loose leaves behind everything built round its star |
| rogue | a rogue world never falls in; a bound world keeps its year |
| scorch | life a flare or runaway greenhouse boiled is dead, only that life |
| settled | a settled system is never gone; a Deep we retake is back on the map |
| siphons | Halo Siphons: shutting them, their effect on the halo's clock and embers (context sealed) |
| spare | spare work with an empty queue: Recycle, Study, Tend (≤ a quarter), Morale |
| terraform | Orbital Mirrors, Atmosphere Works (caps 20/25 points, ≤ 55%), Biosphere Seeding |
| twilight | a locked ice world hot by day, frozen by night, is a Twilight sea |
| war | war: the vote, the costs, the three-turn siege, the battle |
| ways | ways that meet: sleepers wake for a new star, the Tessellate keeps agreements, the Choir gathers Echoes |
| worlds | a world's panel agrees with its climate (galaxy glow floor, no-star rows) |

**Browser checks (53):**

| Check | Verifies |
|---|---|
| a11y | at 960×460 the settlement panel scrolls whole; Enter/Space on Build rows queue without ending the turn; a click leaves no focus; windows and events take and return focus; Enter under an event does nothing; Escape cancels targeting |
| accord | Rally, Calm, Hear buttons, prices and greying after use |
| attack | a warship fleet's attack button with odds, confirm, once a turn; the swarm's panel too |
| beacon | lighting, the star's chip with Put out, the energy tooltip's upkeep |
| boil | a world a new star will boil says so in its panel, name and forecasts |
| build-kinds | the build list grouped and filtered by kind; kind icons on queue and chips |
| claims | a neighbour's second star as a dashed ring; their card counts stars; a promise shows |
| clocks | Signals' Our clock; a too-slow civilization says how to reach it; slowing brings it in reach |
| cooling | temperatures in mK and below; Hawking temperature; collectors with nothing to gather say so |
| dealings | a trade offer says what it asks and gives; Toward us remembers |
| dismantle | the × on a structure explains, asks, Keep it changes nothing, Take apart works |
| evap | an evaporated hole's system stays on the map and opens; its worlds read adrift |
| fates | the hatched stretch and question dates until known; each fate's crossing screen |
| flash | a helium giant's event, the flash chip, greyed paces, the next turn |
| flow | the Long Flow's milestone, forecast, event, smooth ground (`uFlow`), round stones |
| focus | six focus buttons; clicking sets the focus |
| follow-send | following a second star; Study it; sending from the Systems window; dwarf cooling rows |
| holes | the Black holes tab, a hole's panel with its evaporation |
| hunt | the hunted ship's and the swarm's panels; the strike's toast names the ship with Look |
| last-star | a late new star lighting at turn end, its event and clock (details sealed) |
| lean | no synth continuous sounds under a recording; canvas not multisampled; idle labels untouched; no blur and medium graphics on touch |
| lowvision | at 1280×720 and 2×: one column on the right, no overlap, focus to the panel title, contrast ≥ 4.5:1, tooltips beside the column, N/B/M, the view shifted, labels ≥ 29 px, markers 1.5×, no grain/vignette/fringes |
| mobile | phone layouts upright at three sizes and sideways: the turn line, no overlap or overflow, 8 rail buttons that fit, the sheet small on a map tap and the star in sight, the pace list, long-press tips that press nothing |
| music-hidden | the title recording plays on while hidden and continues on show; synth silent under it; synth plays when nothing recorded will |
| music-route | the recording plays by its element, no MediaElementSource, silent at 0, the synth's echo follows the slider (0 / 0.25 / 1 at 0 / 35% / 70%), ten echoing sounds make 20 gains |
| neighbours | Send energy shows travel time; Declare war asks first; a pact waits for their answer |
| pace-grey | pace buttons that change nothing are greyed, say why, do nothing |
| prompt-systems | the ship prompt's From Systems… sends; closing without choosing keeps the prompt |
| quick-castout | the star clock chip counts sixtieths at Quick ×10; a cast-out ember's panel and event |
| refuge | the refuge request, coming, arrival and their fate |
| repeal | Repeal… asks once, repeals, frees room; a dark law has none |
| research-fate | other-fate projects show "???" until the fate is known, then vanish |
| ring-select | a world wears one ring; the selection circle takes its colour and opacity floor; pale on unsettled worlds |
| rogue | a rogue world shows no fall-in year or orbit |
| save-all | Export all saves gives one file with four saves; importing elsewhere brings them back as slots |
| settle-measures | an Ark's lists show every measure, the sorted one marked |
| settled | a Deep settlement round an evaporated hole shows on the map and opens |
| siphons | shutting the Halo Siphons where the player meets them (details sealed) |
| sky | (seed 31) the empty sky's darkest pixels ≤ 2 and equal in every channel (±1), in the galaxy and in a system; the galaxy's own light is there from 2600 units above (≥ 3 glows, red > blue + 6 at the middle), gone at distance 150, gone in the Dark Era, and not brought back by the enhanced or thermal views there |
| star-clock | A New Star's clock through six real End Turns; a second star cannot take over; White Fire |
| star-price | the clock's price shown, taken once, disabled when unaffordable; Study and Watch rewards |
| startype | the Type sort: holes, neutron stars, dwarfs, nearest first within each |
| survey-look | a survey via the real End Turn; the toast's Look opens the system |
| swarm-click | a click on a swarm's cloud selects it, on its star the star |
| swarm-colour | tamed motes teal, wild ones red |
| systems-tab | the Systems window's tabs and keys; Collision stars burning and out; ✦ labels |
| terraform | terraforming structures and their projected effect; Biosphere Seeding's condition |
| translate | under a stand-in translator the turn, η, panel titles and tooltips keep updating; nothing doubled |
| war | Declare war, the siege, Seize |
| ways | the Choir's request for our Echoes |
| work-build | an idle settlement given work from its Build tab; the reminder opens it |
| worlds | starless worlds' temperature and "none: no star" rows |
| zoom-centre | wheel and pinch keep the centred star or followed world in the middle (< 2–3 px); a pan frees the wheel to the pointer; zooming in on a centred star enters it |

#### E.7.4 Test hooks (`window.__stel`, `main.tsx`)

`newGame(opts)` (with `tutorial: true` sets `flags.tut = 0`; focuses home at 150), `endTurns(n,
auto = true, keep = false)` (autoplays and clears pending events unless `keep`), `autoPlay()`,
`orderFleet(fleetId, systemId, order)`, `select(kind, id)`, `refresh()`, `notify(text, kind)`,
`state()`, `engine()`, `music()` (its `layer`: `bus`, `silenced`, `persistent`, `track.el`),
`audio()`, `setVolumes(m, s)`, `sfx(name)`. Tests freeze a page with `engine.stop()` and drive
`engine.frame(dt)`; pixel reads use `gl.readPixels` straight after `frame(0)`.

#### E.7.5 The balance harness's place

`tools/sim.ts` (`npx tsx tools/sim.ts 300 standard competent [--from=N] [--fate=…] [--diff=…]`)
autoplays whole headless games (seed `1000 + g·7919`, three survivors) and prints one line per game
("seed N: OUTCOME …"); `tools/tally.sh` counts games, survivals, victories and Degenerate turns. It
is run when rules change, never for presentation changes (a display change must leave all games
identical). It is not part of `check`.

#### E.7.6 Building and shipping

- `vite.config.ts`: `base: './'` (relative asset paths, so the same build works at `/`, `/next/` and
  as an artifact), JSX via oxc with `importSource: 'preact'`, target `es2022`, `assetsDir: 'assets'`,
  `chunkSizeWarningLimit: 1500`. `npm run build` = `tsc --noEmit && vite build` (`tsconfig`
  includes `src` and `tools`).
- **GitHub Pages** (`.github/workflows/pages.yml`, "Deploy to GitHub Pages"): on push to `main` or
  `next` (and by hand); `contents: write`; concurrency group `pages`, cancel in progress. Checks
  out both `main` and `next`, Node 22 with npm cache, `npm ci && npm run build` in each, removes
  `next/dist/archive`, copies `next/dist` to `main/dist/next`, adds `.nojekyll`, and force-pushes
  `main/dist` as a fresh `gh-pages` branch ("Deploy main <sha>, next <sha>") with `GITHUB_TOKEN`.
  Live: `https://m1omg.github.io/Steliterate/` (main) and `/next/`. Both branches carry the same
  workflow file.
- `tools/make-artifact.mjs`: turns `dist/` into a claude.ai artifact fragment (stale since 28 Sep).
- Validation per batch: `npm ci`, `tsc`, build, `vite preview --port 4173`, playtest, savecompat,
  unit checks, browser checks, and the harness when rules change.

## Appendix: the data tables

Generated from `src/game/data/*.ts` at `4b92446` (functions such as event texts and choice effects
left out; sections C and D give their rules). Rows that give the sealed stories away are in S.8.

### A.1 Structures (`src/game/data/structures.ts`)

| id | name | first age | tech | industry | matter | max | where | gives | upkeep (energy) | signature | other | description |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| solar_array | Solar Arrays | dusk |  | 30 | 10 | 3 | notBodies ["deep", "gas_giant"]; notAt ["brown_dwarf"] | energy light 4 |  | 1 |  | Dark photovoltaic fields tuned to a red sun. |
| geothermal_tap | Geothermal Tap | dusk |  | 35 | 10 | 2 | notBodies ["deep", "gas_giant", "asteroids"] | energy geo 7 |  | 0.5 |  | Bores into whatever warmth the core has left. |
| mine | Deep Mine | dusk |  | 30 | 0 | 3 | notBodies ["deep", "gas_giant"] | matterYield 3 |  | 0.5 |  | Salvage and extraction, forever patched. |
| habitat_dome | Habitat Domes | dusk |  | 40 | 15 | 5 |  | cap {"kin": 3} | 1 | 1 |  | Sealed domes and pressure halls. Warm, crowded, always humming. |
| night_shelter | Night-side Shelters | dusk |  | 20 | 10 | 4 | primaries ["blue_dwarf"] | cap {"kin": 3} | 0.6 | 0.3 |  | Emergency habitats cut into the rock of the night side while the star flares, cooled by great radiator fins. Cramped and loud, but alive. Only while a star is in its last flare. |
| archive_spire | Archive Spire | dusk |  | 40 | 10 | 2 |  | insight 3 |  | 0.5 |  | Observatory, library and argument hall in one tower. |
| commons | The Commons | dusk |  | 35 | 5 | 1 |  | accord 1; resolve 0.3 |  | 0.5 |  | Where people gather to decide how to go on. |
| shipyard | Shipyard | dusk |  | 40 | 20 | 1 |  | industry 1 |  | 1 |  | Slips, cranes and a long queue of repairs. |
| reserve_vault | Energy Vault | dusk | energy_storage | 40 | 20 | 4 |  | reserveCap 80 |  | 0.3 |  | Superconducting rings holding charge against lean years. |
| foundry | Orbital Foundry | dusk | orbital_industry | 50 | 20 | 2 |  | industry 3 |  | 1 |  | Furnaces in orbit, fed by the belts. |
| mag_shield | Magnetic Shield | dusk | magnetospherics | 80 | 30 | 1 | habitable True |  | 1 | 1 | declineMult 0.4 | A superconducting loop at the inner Lagrange point, standing in for a dead dynamo. |
| warrens | Deep Warrens | dusk | subterranean_cities | 60 | 15 | 3 | notBodies ["deep", "gas_giant", "asteroids"] | cap {"kin": 4} | 0.5 | 0.3 |  | Cities dug below the frost line, lit by strip lamps. |
| orbital_lamps | Orbital Lamps | dusk | fusion | 140 | 60 | 1 | habitable True |  | 6 | 3 | declineMult 0.5; warms True | A ring of fusion lamps in orbit, standing in for a dying or dead sun. While they burn, a living world stays alive after its star is gone. They are very hungry. |
| core_stimulator | Core Stimulator | dusk | deep_mantle | 120 | 40 | 1 | habitable True |  | 1 | 1 | declineMult 0.7; coreHeatBonus 0.3 | Deep-bored reactors keeping the mantle soft a little longer. |
| orbital_mirrors | Orbital Mirrors | dusk | terraforming | 100 | 40 | 1 | bodies ["barren", "ice", "ocean_ice", "super_earth", "terran", "eyeball"] |  | 1 | 2 | terraform mirrors | A swarm of thin mirrors in orbit, as wide in all as the world itself, sending a cold world twice its star’s light, or shading a hot one to half. |
| atmosphere_works | Atmosphere Works | dusk | terraforming | 120 | 50 | 1 | bodies ["barren", "ice", "ocean_ice", "super_earth", "terran", "eyeball"] |  | 1 | 1 | terraform works | Greenhouse-gas factories, and volatiles steered in from icy bodies: an air that keeps the warmth in, carries it round to the night side and lets water stay liquid. |
| biosphere_seeding | Biosphere Seeding | dusk | terraforming | 60 | 20 | 1 | bodies ["barren", "ice", "ocean_ice", "super_earth", "terran", "eyeball"] |  |  | 0.5 | terraform seeding | Engineered microbes, lichens and mosses sown into a world made warm and wet enough: life that spreads on its own. |
| comet_shepherd | Volatile Shepherding | dusk | comet_shepherding | 90 | 20 | 1 | habitable True |  |  | 0.5 | declineMult 0.8; vitalityOnce 0.15 | Nudges icy bodies inward to replace what the wind has stripped. |
| cryo_hall | Cryo Hall | dusk | cold_sleep | 50 | 15 | 2 |  | cryoCap 10 | 0.3 | 0.2 |  | Rows of cold berths. Every one of them a promise to wake someone later. |
| orbital_collector | Orbital Collectors | dusk | orbital_collectors | 70 | 30 | 2 | notAt ["brown_dwarf"] | energy light 10 |  | 2 |  | Salvaged mirror-sails in close orbit. |
| dyson_swarm | Dyson Swarm | dusk | dyson_swarms | 300 | 150 | 1 | bodies ["deep"]; notAt ["brown_dwarf"]; systemUnique True | energy light 40 |  | 8 |  | Thousands of patched collectors wrapped around the star. Bright work, visible for light-years. |
| fusion_plant | Fusion Plant | dusk | fusion | 60 | 20 | 2 |  | energy fusion 4 (input 2) |  | 2 |  | Burns hydrogen hauled up from the giants. |
| hydrogen_skimmer | Hydrogen Skimmer | dusk | fusion | 50 | 10 | 1 | bodies ["gas_giant", "ice_giant"] | hydrogenYield 3 |  | 1 |  | Scoops fuel from a gas giant’s upper air. |
| substrate_core | Substrate Core | dusk | mind_substrate | 50 | 20 | 6 |  | cap {"echoes": 4} | 0.5 | 1 |  | Cold racks of thinking matter. |
| upload_clinic | Upload Clinic | dusk | upload | 60 | 15 | 1 |  |  |  | 0.5 | enables upload | Where Kin become Echoes. Some call it a door, some a grave. |
| confluence_node | Confluence Node | dusk | mind_merging | 70 | 20 | 3 |  | cap {"chorus": 3} | 0.5 | 1 | enables merge | A chamber where minds merge. |
| lattice_foundry | Lattice Foundry | dusk | autonomous_replicators | 80 | 30 | 3 |  | cap {"lattice": 6} |  | 2 | enables lattice | Replicator beds that build and repair without anyone asking. |
| defense_grid | Defense Grid | dusk | orbital_defense | 50 | 20 | 2 |  | defense 8 |  | 1 |  | Point-defence lasers and a web of kinetic mines. |
| stellar_lifter | Stellar Lifter | dusk | stellar_lifting | 150 | 40 | 1 | bodies ["deep"]; primaries ["red_dwarf", "blue_dwarf", "white_dwarf", "brown_dwarf", "black_dwarf"]; systemUnique True | lift 7 |  | 4 | gfeDrain 0.0015 | Magnetic funnels that pull matter out of the star itself. Fast, and ruinous over time. |
| relic_dig | Relic Excavation | dusk |  | 45 | 10 | 1 |  | insight 4 |  | 0.3 |  | Careful work in the ruins of someone older. |
| accretion_engine | Accretion Engine | dusk | accretion_engines | 160 | 60 | 2 | bodies ["deep"]; primaries ["black_hole", "smbh"] | energy accretion 30 (input 2) |  | 6 |  | Feeds matter to a black hole and catches the light of its falling. |
| pulsar_brake | Pulsar Brake | dusk | pulsar_braking | 120 | 40 | 1 | bodies ["deep"]; primaries ["neutron_star"] | energy spin 8 |  | 3 |  | Drags on a neutron star’s magnetic field to bleed its spin. |
| ember_collector | Ember Collectors | dusk | ember_harvest | 70 | 40 | 3 | bodies ["deep"]; primaries ["white_dwarf", "black_dwarf"] | energy light 12 |  | 2 |  | Vast cold radiators around a white dwarf warmed by dark matter. Nearly useless while stars still shine; vital after the Last Light. |
| infrared_shroud | Infrared Shrouds | dusk | ember_harvest | 70 | 40 | 3 | bodies ["deep"]; primaries ["brown_dwarf"] | energy light 12 |  | 2 |  | Cold radiators wrapped close around a brown dwarf, drinking its infrared: its gravity is weak enough to work in close. Next to nothing while stars still shine; after the Last Light, while it still holds the heat of its youth, more than an ember gives, fading as it cools. |
| disk_skimmer | Disk Skimmer | degenerate | accretion_modelling | 80 | 30 | 2 | bodies ["deep"] | energy rekindle 14 |  | 2 |  | Harvests the debris stream of a world falling into its dead star. |
| brown_siphon | Hydrogen Siphon | degenerate | brown_dwarf_mining | 70 | 20 | 1 | bodies ["deep"]; primaries ["brown_dwarf"] | lift 6 |  | 2 |  | Drinks from a brown dwarf that never became a star. |
| cold_vault | Cold Vault | degenerate | cold_computation | 60 | 25 | 4 |  | cap {"coldminds": 6} | 0.1 | 0.1 | enables cool | A shielded vault near absolute zero, home to Coldminds. |
| garden_ark | Garden Ark | degenerate | garden_arks | 110 | 50 | 3 |  | cap {"kin": 4} | 3 | 3 |  | A lit, warm, living garden in the dark, at a cost few can afford. |
| horizon_vault | Horizon Vault | degenerate | horizon_storage | 110 | 60 | 2 | bodies ["deep"]; primaries ["black_hole", "smbh"] | reserveCap 400 |  | 1 |  | Stores energy as black-hole spin. Almost nothing leaks. |
| burst_catcher | Burst Catcher | degenerate | burst_capture | 90 | 40 | 2 |  | burstCap 300 |  | 1 |  | Buffers for flashes: brief stars, final bursts and flares too fast to use as they happen, even a neutron star bursting in a neighbouring system. |
| decay_harvester | Decay Harvester | degenerate | baryon_decay_harvest | 80 | 30 | 2 | bodies ["deep"]; primaries ["white_dwarf", "black_dwarf", "neutron_star", "brown_dwarf"] | energy decay 4 |  | 1 |  | Collects the faint heat of protons decaying inside dead stars. |
| curvature_collector | Curvature Collector | degenerate | curvature_harvest | 80 | 30 | 2 | bodies ["deep"]; primaries ["neutron_star"] | energy curvature 4 |  | 1 |  | Catches the particles that space, curved tight around a neutron star, makes from its mass. |
| lepton_substrate | Leptonic Substrate | degenerate | leptonic_computation | 110 | 70 | 3 |  | cap {"echoes": 4, "coldminds": 4, "lattice": 2} |  | 1 | decayProof True | Speculative: minds re-encoded in electron–positron structures that will outlast ordinary matter. |
| superconducting_ring | Deep Storage Ring | degenerate | deep_storage | 70 | 40 | 3 |  | reserveCap 150; burstCap 100 |  | 0.3 |  | Giant, patient batteries for the long nights between sources. |
| penrose_harvester | Penrose Harvester | degenerate | penrose_process | 100 | 0 | 3 | bodies ["deep"]; primaries ["black_hole", "smbh"] | energy spin 20 |  | 2 |  | Throws mass into the ergosphere and catches it coming back heavier. |
| hawking_collector | Hawking Collector | degenerate | hawking_capture | 100 | 0 | 3 | bodies ["deep"]; primaries ["black_hole", "smbh"] | energy hawking 12 |  | 1 |  | Listens to the faint heat of a black hole slowly boiling away. |
| bastion | Bastion Shell | blackhole | bastion_architecture | 90 | 0 | 3 |  | cap {"echoes": 3, "coldminds": 4, "lattice": 3} |  | 1 | decayProof True | A shell of leptonic structure around a black hole. |
| horizon_siphon | Horizon Siphon | dark | horizon_siphon | 120 | 0 | 4 |  | energy siphon 0.6 |  | 0 |  | Speculative: draws on the faint temperature of the cosmic horizon itself. |
| preservation_array | Error-Correction Array | dark | error_correction | 110 | 0 | 2 |  |  | 0.3 | 0 | continuityMult 0.6 | Keeps the pattern of you from dissolving into noise. |

### A.2 Research fields

| id | name | blurb |
|---|---|---|
| stewardship | Stewardship | Keeping worlds and bodies alive a little longer. |
| mind | Mind | What else a person can become, and how slowly they can think. |
| reach | Reach | Ships, travel and defence across the dark. |
| harvest | Harvest | Taking energy and matter from what is left. |
| continuity | Continuity | Holding together: society, memory, the other minds, the end. |

### A.3 Techs (`src/game/data/techs.ts`)

| id | name | age | field | cost (insight) | requires | effects | flags | description |
|---|---|---|---|---|---|---|---|---|
| magnetospherics | Magnetospheric Engineering | dusk | stewardship | 40 |  |  |  | A superconducting loop at the inner Lagrange point can stand in for the dying dynamo. Unlocks the Magnetic Shield. |
| subterranean_cities | Deep Warrens | dusk | stewardship | 60 |  |  |  | Live below the frost line, where vitality matters less. Unlocks Deep Warrens. |
| hardy_lineages | Hardy Lineages | dusk | stewardship | 70 |  | upkeep {"kin": 0.9}; flags ["hardy"] |  | Kin bred for thin air and cold. Kin capacity suffers less as worlds die; Kin upkeep −10%. |
| comet_shepherding | Volatile Shepherding | dusk | stewardship | 95 | magnetospherics |  |  | Replace stripped air and water with shepherded ice. Unlocks Volatile Shepherding. |
| terraforming | Terraforming | dusk | stewardship | 130 | comet_shepherding |  |  | Mirrors, an air and seeded life for a dead world by a red dwarf that still burns, as was once proposed for Mars. Unlocks Orbital Mirrors, Atmosphere Works and Biosphere Seeding. |
| deep_mantle | Mantle Stimulation | dusk | stewardship | 140 | subterranean_cities |  |  | Reactors bored into the mantle keep the core soft. Unlocks the Core Stimulator. |
| cold_sleep | Cold Sleep | dusk | stewardship | 110 | hardy_lineages |  |  | Kin can sleep through the lean centuries. Unlocks Cryo Halls. |
| mind_substrate | Mind Substrate | dusk | mind | 80 |  | echoMaxClock 3.5 |  | Minds that run on matter other than flesh. Unlocks Echoes, Substrate Cores and Seedcores. |
| upload | Continuity of Self | dusk | mind | 120 | mind_substrate |  |  | A Kin can become an Echo and still, they say, be themselves. Unlocks the Upload Clinic. |
| slow_instancing | Slow Instancing | dusk | mind | 170 | mind_substrate | echoMaxClock 7 |  | Echoes can run a thought across millennia. Echo clock limit rises to 10⁷ years. |
| mind_merging | Confluence | dusk | mind | 210 | upload |  |  | Many minds, one voice. Unlocks the Chorus and Confluence Nodes. |
| reversible_logic | Reversible Logic | dusk | mind | 320 | slow_instancing | echoMaxClock 11; upkeep {"echoes": 0.85, "chorus": 0.9} |  | Thinking without erasing, so almost without heat. Echo clock limit 10¹¹ years; Echo upkeep −15%. |
| autonomous_replicators | Autonomous Replicators | dusk | mind | 150 |  |  |  | Self-repairing machines that learn their own maintenance. Unlocks the Lattice and Lattice Spores. |
| survey_optics | Deep Survey Optics | dusk | reach | 30 |  | detect 150 |  | Chart farther and see the dead more clearly. Detection range grows. |
| fusion_drives | Fusion Drives | dusk | reach | 60 | survey_optics | speed 0.06 |  | Ships at six percent of light. Unlocks the Kin Ark. |
| orbital_defense | Orbital Defence | dusk | reach | 70 |  |  |  | Defence Grids and Warden escorts. |
| orbital_industry | Orbital Industry | dusk | reach | 55 |  |  |  | Foundries in orbit. Unlocks the Orbital Foundry. |
| magnetic_sails | Magsail Braking | dusk | reach | 130 | fusion_drives | speed 0.15; flags ["cheap_launch"] |  | Brake against the thin interstellar medium. Ships at 15% of light; launches cost less. |
| catalyzed_drives | Catalysed Drives | dusk | reach | 280 | magnetic_sails | speed 0.4; detect 2000 |  | Ships at 40% of light. Other provinces come within reach. |
| hunger_studies | Hunger Studies | dusk | reach | 90 | orbital_defense |  |  | Learn what the swarms are and how they move. Reveals swarms within detection range and forecasts their paths. |
| hunger_lures | Decoy Beacons | dusk | reach | 160 | hunger_studies |  |  | Bright false hearths in dead systems draw the Hunger away. Fleets can light beacons; each burns while we feed it. |
| energy_storage | Superconducting Storage | dusk | harvest | 40 |  |  |  | Hold energy against lean years. Unlocks Energy Vaults. |
| orbital_collectors | Orbital Collectors | dusk | harvest | 55 |  |  |  | Mirror-sails in close orbit. Unlocks Orbital Collectors. |
| fusion | Controlled Fusion | dusk | harvest | 80 |  |  |  | Burn hydrogen from the giants. Unlocks Fusion Plants and Hydrogen Skimmers. |
| dyson_swarms | Dyson Swarms | dusk | harvest | 230 | orbital_collectors |  |  | Wrap a star in collectors. Enormous yield, and visible across the reach, including to the Hunger. |
| stellar_lifting | Stellar Lifting | dusk | harvest | 280 | dyson_swarms |  |  | Pull matter out of stars. Quick wealth that permanently drains the galaxy’s free energy. |
| horizon_physics | Horizon Physics | dusk | harvest | 240 | fusion |  |  | What falls into a black hole, and what comes back out. Prerequisite for accretion engines. |
| accretion_engines | Accretion Engines | dusk | harvest | 360 | horizon_physics |  |  | Black-hole mining: feed matter in, catch up to forty percent of its mass-energy on the way down. |
| pulsar_braking | Pulsar Braking | dusk | harvest | 200 | horizon_physics |  |  | Bleed rotational energy from neutron stars. Unlocks the Pulsar Brake. |
| the_long_record | The Long Record | dusk | continuity | 50 |  | flags ["charters"] |  | Keep an honest account of what happened and why. +1 Accord per settlement; unlocks the first Charters. |
| assembly_of_threads | Assembly of Threads | dusk | continuity | 150 | the_long_record |  |  | Every Thread gets a voice. Thread standing recovers faster; more Charters. |
| deep_listening | Deep Listening | dusk | continuity | 120 | survey_optics |  |  | Listen for other minds across light-years and ages. Opens the Signals panel to faint and slow messages. |
| hibernation_protocols | Hibernation Protocols | dusk | continuity | 180 | cold_sleep | paceMin -2 |  | Sleep through lean ages safely. Unlocks the Long Sleep and slower paces. |
| proton_question | The Proton Question | dusk | continuity | 200 | the_long_record | flags ["proton_known"] |  | Build the detector that settles it: will ordinary matter last? |
| halo_dynamics | Halo Dynamics | dusk | continuity | 220 | deep_listening |  |  | Map the invisible mass that holds the Coalescence together. Something in it is moving against the flow. |
| last_light_protocols | Last Light Protocols | dusk | continuity | 340 | assembly_of_threads | crossing 0.5 |  | Plan for the end of starlight: losses in the Last Light are halved. |
| ember_harvest | Ember Harvest | dusk | harvest | 240 | orbital_collectors |  |  | Cold radiators around white dwarfs warmed by annihilating dark matter, and close around brown dwarfs, whose weak gravity lets them in. Unlocks Ember Collectors and Infrared Shrouds. |
| brown_dwarf_mining | Brown Dwarf Mining | degenerate | harvest | 280 |  |  |  | The failed stars are full of hydrogen. Unlocks Hydrogen Siphons. |
| accretion_modelling | Accretion Modelling | degenerate | harvest | 320 |  |  |  | Predict how falling worlds feed their dead stars, and harvest the stream. Unlocks Disk Skimmers; sharpens feeding forecasts. |
| deep_storage | Deep Storage | degenerate | harvest | 360 |  | reserveMult 1.25 |  | Batteries for ages. Unlocks Deep Storage Rings; reserve capacity +25%. |
| burst_capture | Burst Capture | degenerate | harvest | 420 | deep_storage |  |  | Catch flashes too brief to use as they happen. Unlocks Burst Catchers. |
| horizon_storage | Horizon Storage | degenerate | harvest | 650 | deep_storage |  |  | Bank energy as black-hole spin. Unlocks Horizon Vaults. |
| baryon_decay_harvest | Decay Harvest | degenerate | harvest | 820 |  |  | needsDecay True | The protons are going. Catch the heat as they do. Unlocks Decay Harvesters. |
| curvature_harvest | Curvature Harvest | degenerate | harvest | 820 |  |  | needsCurvature True | Space itself, curved tight around a neutron star, is turning its mass into particles. Catch them. Unlocks Curvature Collectors. |
| cold_computation | Cold Computation | degenerate | mind | 330 |  | echoMaxClock 16 |  | Minds that run near absolute zero. Unlocks Coldminds, Cold Vaults and Vault Ships. Echo clock limit 10¹⁶ years. |
| glacial_cognition | Glacial Cognition | degenerate | mind | 480 | cold_computation | echoMaxClock 24 |  | Echo clock limit 10²⁴ years. |
| deep_time_protocols | Deep-Time Protocols | degenerate | mind | 600 | glacial_cognition | echoMaxClock 32 |  | Echo clock limit 10³² years. |
| abyssal_thought | Abyssal Thought | degenerate | mind | 920 | deep_time_protocols | echoMaxClock 40 |  | Echo clock limit 10⁴⁰ years. |
| quickening | Quickening | degenerate | mind | 400 |  | paceMax 2 |  | Run fast and hot while a bright source lasts. You can quicken further, and Quick ×10 works while you keep time with a new star: each of its turns splits into ten. |
| leptonic_computation | Leptonic Computation | degenerate | mind | 900 | deep_time_protocols |  | speculative True | Speculative: re-encode minds in electrons and positrons, which do not decay. Unlocks Leptonic Substrate. |
| garden_arks | Garden Arks | degenerate | stewardship | 420 |  |  |  | A living garden in the dark, lit by whatever you can spare. Kin can live on without stars. |
| relativistic_arks | Relativistic Arks | degenerate | reach | 380 |  | speed 0.8; flags ["cheap_launch"] |  | Ships at 80% of light; long launches cost less. |
| aegis_lattices | Aegis Lattices | degenerate | reach | 360 |  |  |  | Heavy pickets for heavy swarms. Unlocks the Aegis. |
| command_language | Command Language | degenerate | reach | 520 |  |  |  | Decode the dead makers’ instructions to the swarms. Swarm Tenders can calm and tame them. |
| hunger_engines | Hunger Engines | degenerate | harvest | 460 | command_language | flags ["hunger_engines"] | taint 12 | Borrow the swarms’ way of eating. Matter yields +40%. The Hunger’s logic stays with you. |
| communion | Communion | degenerate | mind | 600 | hunger_engines |  | taint 18 | Do not tame the swarms: join them. Unlocks the Communion charter. |
| gravitic_semaphore | Gravitic Semaphore | degenerate | continuity | 380 |  |  |  | Speak with mass itself: move worlds a little, read the replies in orbits. Contact with what hides in the halo becomes possible. |
| halo_siphons | Halo Siphons | degenerate | harvest | 560 | ember_harvest | flags ["halo_siphons"] | noAuto True | Drive dark matter into the embers faster. Ember yields double, and the halo empties sooner. They can be shut for good later, but not started again. |
| great_decay_protocols | Great Decay Protocols | degenerate | continuity | 700 |  | crossing 0.5 |  | Prepare for the end of matter. Losses in the Great Decay (or, if space itself unmakes matter, the Great Evaporation) are halved. |
| penrose_process | Penrose Process | degenerate | harvest | 700 | accretion_engines |  |  | Extract a black hole’s spin. Unlocks Penrose Harvesters. |
| hawking_capture | Hawking Capture | degenerate | harvest | 750 | penrose_process |  |  | Collect the heat of evaporating holes. Unlocks Hawking Collectors. |
| bastion_architecture | Bastion Architecture | blackhole | stewardship | 550 |  |  |  | Shells of leptonic structure around black holes. Unlocks Bastion Shells. |
| horizon_cognition | Horizon Cognition | blackhole | mind | 800 |  | echoMaxClock 60 |  | Echo clock limit 10⁶⁰ years. |
| hawking_patience | Hawking-Scale Patience | blackhole | mind | 1000 | horizon_cognition | echoMaxClock 80 |  | Echo clock limit 10⁸⁰ years. |
| ultimate_slowness | Ultimate Slowness | blackhole | mind | 1250 | hawking_patience | echoMaxClock 100 |  | Echo clock limit 10¹⁰⁰ years. |
| total_confluence | Total Confluence | blackhole | mind | 950 |  |  |  | What it would take for everyone to become one. Enables the Great Work Confluence. |
| archive_theory | Archive Theory | blackhole | continuity | 950 |  |  |  | A record that maintains itself with no one to read it. Enables the Great Work Archive of Everything. |
| conformal_mathematics | Conformal Mathematics | blackhole | continuity | 1200 |  |  | speculative True | Speculative, after Penrose: if the end of one universe is the beginning of the next, something could be written across the seam. Enables the Aeon Seed. |
| error_correction | Deep Error Correction | blackhole | continuity | 800 |  |  |  | Keep a pattern intact across unimaginable time. Unlocks Error-Correction Arrays. |
| last_horizon_protocols | Last Horizon Protocols | blackhole | continuity | 900 |  | crossing 0.5 |  | Losses when the last black holes die are halved. |
| asymptotic_mind | Asymptotic Mind | dark | mind | 900 |  |  |  | A mind whose thoughts can stretch without limit. Enables the Hibernal Cascade. |
| horizon_siphon | Horizon Siphoning | dark | harvest | 800 |  |  | speculative True | Speculative: draw the faintest trickle from the cosmic horizon’s temperature. Unlocks Horizon Siphons. |
| garden_of_embers | Garden of Embers | dark | stewardship | 900 |  |  | needsStable True | The protons held. Something could still grow. Enables the Great Work Garden of Embers. |

### A.4 Ships (`src/game/data/ships.ts`)

| id | name | tech | industry | matter | mass | attack | hp | role | description |
|---|---|---|---|---|---|---|---|---|---|
| lighter | System Lighter |  | 45 | 20 | 2 | 0 | 3 | settles {"thread": "kin", "pops": 1, "structure": "habitat_dome"}; inSystem True; crew 1 | A slow chemical-rocket hauler that carries one family of Kin and a folded dome to another world of the same star. It cannot cross interstellar space, and its colonists come from the settlement that builds it. |
| probe | Survey Probe |  | 20 | 5 | 1 | 0 | 2 | survey True | A small sublight probe that charts systems and ruins. |
| ark | Kin Ark | fusion_drives | 80 | 30 | 8 | 0 | 6 | settles {"thread": "kin", "pops": 2, "structure": "habitat_dome"} | Carries sleeping Kin and a folded dome to a new world. |
| seedcore | Seedcore | mind_substrate | 70 | 25 | 4 | 0 | 5 | settles {"thread": "echoes", "pops": 2, "structure": "substrate_core"} | A substrate core with two Echoes aboard. Can settle anywhere, even the empty space around a dead star. |
| spore | Lattice Spore | autonomous_replicators | 60 | 30 | 4 | 1 | 6 | settles {"thread": "lattice", "pops": 2, "structure": "lattice_foundry"} | A replicator seed that builds its own foundry on arrival. |
| vaultship | Vault Ship | cold_computation | 90 | 30 | 6 | 0 | 8 | settles {"thread": "coldminds", "pops": 3, "structure": "cold_vault"} | Carries Coldminds in their vault to a new, colder home. |
| warden | Warden | orbital_defense | 45 | 15 | 3 | 3 | 10 |  | A patched-together escort with lasers and kinetic launchers. |
| aegis | Aegis | aegis_lattices | 110 | 40 | 8 | 8 | 30 |  | A heavy picket built around a salvaged reactor. |
| tender | Swarm Tender | command_language | 70 | 20 | 3 | 0 | 8 | tames True | Broadcasts the dead makers’ command language to calm a swarm. |

### A.5 Great Works (`src/game/data/works.ts`; their paths and endings are in the sealed section)

| id | name | ages | tech | insight | energy at start | requirement | max taint |
|---|---|---|---|---|---|---|---|
| hibernal_cascade | The Hibernal Cascade | dark | asymptotic_mind | 1500 | 220 | Echoes and Coldminds together number at least 6. | 59 |
| confluence | Confluence | blackhole, dark | total_confluence | 1500 | 150 | The Chorus is at least half of everyone, and every Thread’s standing is at least 55. | 29 |
| archive_of_everything | The Archive of Everything | blackhole, dark | archive_theory | 1500 | 150 | The Lattice is at least half of everyone. | 59 |
| aeon_seed | The Aeon Seed | blackhole | conformal_mathematics | 1700 | 300 | A settlement at the Heart, and a sealed condition (S.4.2). The seed is written when the Heart evaporates. | 29 |
| garden_of_embers | The Garden of Embers | dark | garden_of_embers | 1200 | 200 | Protons are stable, and at least 6 living Kin (awake or in Cold Sleep) remain. | 29 |

### A.6 Charters (`src/game/data/charters.ts`)

| id | name | age | tech | needs charter | excludes | accord | stances | resolve | dissent | taint | dark | effect | description |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cold_sleep_lottery | Cold Sleep Lottery | dusk | cold_sleep |  |  | 20 | kin -8; echoes 2 | -4 |  |  |  | Starving settlements put Kin into Cold Sleep instead of losing them. Cryo upkeep −50%. | When a settlement cannot feed everyone, a lottery decides who sleeps until better times. |
| upload_at_death | Upload at Death | dusk | upload |  | sanctity_of_flesh | 25 | kin -10; echoes 10 |  | 3 |  |  | Half of the Kin who die become Echoes where there is substrate. | No one simply dies any more. Whoever is dying is copied. |
| sanctity_of_flesh | Sanctity of Flesh | dusk |  |  | upload_at_death | 20 | kin 12; echoes -8; chorus -6 |  |  |  |  | Kin standing steadier; while most of your people are Kin, resolve returns to its middle faster. Uploads and merges cost 4 Accord. | A body is not a vessel. What is born stays born. |
| abandon_the_surface | Abandon the Surface | dusk | subterranean_cities |  |  | 30 | kin -14 | -8 |  |  |  | Dying worlds no longer cost Kin capacity; the homeworld demand is dropped. Industry +10%. | Stop pretending the sky will come back. Everyone goes down into the warrens. |
| right_to_stop | The Right to Stop | dusk | mind_substrate |  |  | 25 | echoes 14; kin 3; chorus -4 |  | -5 |  |  | Deaths weigh 40% less on resolve (some of those lost chose to stop); dissent fades faster; answers the Echoes’ demand for it. | Any mind may choose to end. No one will be kept running against their will. |
| merge_consent | Merge Consent | dusk | mind_merging |  |  | 20 | chorus 12; echoes 6; kin 4 |  |  |  |  | Merging into the Chorus is half as fast and costs no standing. | No one is merged who did not ask for it. |
| child_quotas | Child Quotas | dusk |  |  |  | 20 | kin -10 | -3 |  |  |  | Kin upkeep −20%; Kin growth −60%. | Fewer mouths. Every birth is licensed. |
| sanctuary | Sanctuary | dusk |  |  |  | 25 | kin 6; echoes 4; chorus 4 | 6 |  |  |  | Other minds can send you refugees, and the dying who think well of you (20 or more) can come to you whole. Every civilization hears of it when the light arrives (+10), and while it stands their goodwill drifts up toward 25. | Our doors are open to the other survivors, whatever they are. |
| salvage_the_dead | Salvage the Dead | dusk |  |  |  | 20 | kin -4 | -3 |  |  |  | At once: Matter +40 from ruins already in reach. Salvaging a ruin yields double; when another civilization fades, its dead worlds give Matter worth half its archives. Slightly drains the galaxy’s free energy. | The dead do not need their machines. Strip every ruin and every silent colony. |
| blackout | Blackout | dusk | hunger_studies |  |  | 20 | kin -5; coldminds 6 | -4 |  |  |  | The Hunger is drawn to you 70% less. All output −10%. | Lights out. Heat sinks buried. Nothing to see here. |
| rationing | Rationing | dusk |  |  |  | 15 | kin -6; coldminds 4 | -2 |  |  |  | Upkeep −15% for everyone. Resolve slowly sinks while it is in force and settles about 10–17 points lower. | Everyone gets less, so everyone gets some. |
| open_archives | Open Archives | dusk | the_long_record |  |  | 20 | echoes 6; kin 3 |  |  |  |  | Insight +15%. | All knowledge free to all Threads. |
| overdrive_protocols | Overdrive Protocols | dusk |  |  |  | 20 | coldminds -8; kin 2 |  |  |  |  | Settlements can overdrive their Hearth: +50% energy capture, with damage, faster decline and a drain on the galaxy’s free energy. | Hearths may run past their ratings when needed. |
| thread_parity | Thread Parity | dusk | assembly_of_threads |  |  | 30 | kin -4; echoes 6; chorus 6; coldminds 6 |  | -6 |  |  | Thread standings drift toward the middle; forks become less likely. | Every kind of mind counts the same. |
| lattice_compact | Lattice Compact | dusk | autonomous_replicators |  |  | 20 | kin -4; echoes -2 |  |  |  |  | The other Threads no longer resent the Lattice; Lattice output +15%; tamed swarms relapse less. | The machines work for us, and we will not resent them for it. |
| wardens_oath | Wardens’ Oath | dusk | orbital_defense |  |  | 15 | kin 3 |  |  |  |  | Warships −25% cost; settlement defence +50%. | Someone will always stand watch. |
| the_long_watch | The Long Watch | dusk | hibernation_protocols |  |  | 25 | coldminds 8; echoes 4; kin -4 |  |  |  |  | Dormant turns cost half as much; waking gives +30% output for two turns. | Sleep in shifts. There is always someone awake, and always someone rested. |
| consume_the_dead | Consume the Dead | dusk | hunger_studies |  |  | 10 | kin -10; echoes -6; chorus -6; coldminds -6 |  |  | 15 | dark | At once: Matter +120. Every one of your own people who dies yields 4 Matter. Salvaging a ruin yields triple; a faded civilization’s dead worlds give Matter worth its whole archives. Drains free energy. Hunger Taint +15. | Feed on what the dead left: their worlds, their machines, their bodies. |
| strip_the_sleepers | Strip the Sleepers | degenerate |  | consume_the_dead |  | 10 | kin -8; echoes -10; coldminds -12 |  |  | 15 | dark | Sleeper vaults can be devoured for a large energy windfall. Hunger Taint +15. | The sleepers will never know. Their vaults are warm, and warmth is food. |
| absorb_the_weak | Absorb the Weak | degenerate |  | consume_the_dead |  | 10 | kin -8; echoes -8; chorus -4 |  |  | 20 | dark | You can devour weakened survivors whole. Hunger Taint +20. | The failing survivors are resources in a waiting state. |
| communion_charter | Communion | degenerate | communion | consume_the_dead |  | 10 | kin -12; echoes -10; chorus -8; coldminds -10 |  |  | 25 | dark | Swarms merge into your Lattice instead of attacking you; your Taint grows with every swarm you hold. | The swarms are not enemies. They are what we are becoming. |

### A.7 Threads (`src/game/data/threads.ts`)

| id | name | industry | insight | accord | energy upkeep | matter upkeep | fastest clock (log10 yr) | slowest clock | strain-immune | conscious | blurb |
|---|---|---|---|---|---|---|---|---|---|---|---|
| kin | Kin | 1 | 0.8 | 0.3 | 1 | 0.1 | 1.6 | {"fixed": 1.6} |  | yes | Biological people: the species born on the homeworld, and any other living beings who have joined you, such as refugees from biological civilizations. They must be fed, warmed and housed, which makes them the most expensive minds to keep alive, and they are the source of most of what the others call meaning. |
| echoes | Echoes | 0.6 | 1.5 | 0.1 | 0.45 | 0 | 0 | {"relative": 0} |  | yes | Uploaded minds running on substrate. Cheap to keep, able to slow their thinking to match the age, and prone to drifting away from the people they were. |
| chorus | Chorus | 2 | 1.8 | 0.5 | 0.9 | 0 | 0.5 | {"relative": -1.5} |  | yes | Many minds merged into one. Efficient and harmonious within itself; unsettling to everyone outside it. Harder to slow than a single mind. |
| lattice | Lattice | 2.2 | 0 | 0 | 0.25 | 0.3 | 0 | {"fixed": 999} | yes | no | Self-maintaining processes. They build, repair and replicate without rest, make no demands, keep no grudges, and wear out. Whether anyone is in there is a question they have never raised. |
| coldminds | Coldminds | 0.2 | 1 | 0.15 | 0.08 | 0 | 4 | {"relative": 6} |  | yes | Minds held in vaults near absolute zero, thinking one slow thought per age. Almost free to keep, and almost unable to hurry. |

### A.8 Thread demands

| id | thread | text |
|---|---|---|
| kin_homeworld | kin | Keep the homeworld alive (vitality above 25%) |
| kin_room | kin | Room to live: no Kin settlement over its capacity |
| kin_warmth | kin | No settlement starving for energy |
| echoes_substrate | echoes | Spare substrate: at least 2 free Echo slots |
| echoes_stop | echoes | Enact the Right to Stop |
| echoes_clock | echoes | Let us keep pace: Echo tempo strain below 1 |
| chorus_consent | chorus | Enact Merge Consent |
| chorus_grow | chorus | Grow the Chorus: another Confluence Node |
| coldminds_quiet | coldminds | Quiet: no Hearth in overdrive |
| coldminds_reserve | coldminds | Keep the reserve above a third of capacity |

### A.9 Events (`src/game/data/events.ts`; texts and triggers in section D)

| id | title | ages | pool weight | once | plate | choices: hint |
|---|---|---|---|---|---|---|
| dynamo_fails | The Dynamo Falters | dusk | scripted | once | dynamo_fails | Throw everything at a shield: Research toward Magnetospheric Engineering jumps ahead. Resolve +2. / Start digging down: Research toward Deep Warrens jumps ahead. Kin standing −2. / Hold a vigil for the sky: Resolve +5, Accord −5. |
| first_night | Counting the Dark | dusk | scripted | once | first_night | Publish it plainly: Resolve −3, Insight +40, Dissent −3. / Publish it with hope: Resolve +3, Dissent +2. |
| superflare | Superflare | dusk | 6 |  | flare | Everyone underground: Energy −12 (−4 with the flare record). The world is spared the worst. / Keep the collectors running: Energy +18, vitality −4%, resolve −2. |
| last_rain | The Last Rain | dusk | 10 | once | last_rain | Record it, every drop: Resolve +4, Kin standing +3. / Capture the water: Matter +25. Kin standing −2. |
| sea_freezes | The Sea Freezes Over | dusk | 10 | once | sea_freezes | Keep the sea open: Energy −35, vitality +6%, Kin standing +6. / Let it close: Resolve −4. / Open the Commons and talk about it: Accord −6, Dissent −6. |
| who_sleeps_first | Who Sleeps First | dusk, degenerate | 5 |  | who_sleeps_first | The children: They wake to a better time, maybe. 2 Kin to Cold Sleep. Kin standing −4. / The elders: 2 Kin to Cold Sleep. Resolve −3. / Draw lots: 2 Kin to Cold Sleep. Accord −4, Dissent −3. |
| mantle_settles | The Mantle Settles | dusk | 4 |  | mantle_settles | Drill deeper: Matter −20; core heat recovers a little. / Accept it: Core heat −0.08. |
| derelict_ark | A Derelict Ark | dusk, degenerate | 3 | once | ruins | Wake them and bring them home: +2 Kin at the capital. Resolve +3. They are strangers. / Salvage the ship: Matter +60. Resolve −2. / Leave them sleeping: Nothing changes. |
| comet | A Wandering Comet | dusk | 3 |  | comet | Shepherd it to the homeworld: Energy −20, homeworld vitality +5% (while it has life to keep). / Mine it: Matter +40. |
| prophet_of_stillness | The Prophet of Stillness | dusk, degenerate | 3 | once | prophet_of_stillness | Let the idea spread: Coldminds and Echoes standing +5, Kin −3. You can slow one step further than research allows (pace). / Argue it out in the Commons: Accord −8, Dissent −4. / Ban the petition: Kin standing +5, Resolve +3: nobody is going to sleep forever. Dissent +8, Echoes and Coldminds standing −3. |
| first_upload | The First Upload | dusk | 12 | once | first_upload | Let her go through: +1 Echo (it waits in the archive until there is substrate). Echoes standing +5, Kin −3. / Make it a public ceremony: +1 Echo (it waits in the archive until there is substrate). Accord −5, Resolve +3. / Refuse her: Kin standing +3, Echoes −4. |
| echo_drift | Drift | any | 4 |  | dusk | Re-anchor them to their old memories: Energy −15, Echoes standing +4. / Let them become who they are becoming: Echoes +6, Kin −4. |
| chorus_invitation | An Invitation to Merge | any | 3 |  | dusk | Allow it: 2 Echoes merge into 1 Chorus. Chorus +5, Echoes −3. / Only with consent, one by one: Chorus +2, Echoes +2. |
| rust_in_the_belt | Rust in the Belt | any | scripted | once | hunger | Study it: Research toward Hunger Studies jumps ahead. / Arm the settlements: Research toward Orbital Defence jumps ahead. Resolve −2. |
| last_flare | The Last Flare | any | scripted |  | flare | Dig in on the night side and keep time with the flare: Emergency shelters now, as many as we can pay for. Then 6 turns inside the flare: collectors there gather about three times the light, and we get those turns to build and prepare before the Last Light. The heat does the same harm either way; while it lasts, each settlement loses one Kin a turn that it cannot shelter. / Dig in on the night side and let it pass: The same shelters, at our own pace. Late in the Dusk the flare is over within a turn: its heat strikes once, and there is next to nothing to harvest. |
| first_contact | We Are Not Alone | any | scripted |  | survivor | Tell everyone: Resolve +4. Our people learn they are not the last. / Keep it with the listeners for now: Insight +30. Nobody panics, and nobody hopes too soon. |
| hunger_mirror | What It Was For | any | 4 | once | hunger | Hear the warning: Resolve +3. Taint −5. / Hear the promise: Insight +80. Taint +5. |
| new_star | A New Star | any | scripted |  | new_star | Race for it, and keep time with it: (computed) / Study it: Insight +25: a merger seen as it happens, a fresh star in a dead galaxy. Resolve +2: a new light, however brief. In its light we find its worlds, by their shadows as they cross it: its system is charted. / Tell the others: Every survivor you know recovers a little. Their trust grows. |
| white_fire | White Fire | any | scripted |  | white_fire | Keep time with it: (computed) / Watch the flash: Insight +25: the physics of a merger, seen as it happens. Resolve +2. In its light we find its worlds, by their shadows as they cross it: its system is charted. Our pace stays our own; what cannot be stored is lost. |
| helium_giant | A Helium Giant | any | scripted |  | white_fire | Keep time with it: (computed) / Watch it swell: Insight +25: the last stage of a merger star, seen as it happens. Resolve +2. In its light we find its worlds, by their shadows as they cross it: its system is charted. Our pace stays our own; what cannot be stored is lost. |
| supernova | Supernova | any | scripted |  | supernova | Chart everything it showed us: Insight +80; nearby systems revealed. |
| cast_out | Cast Out | any | scripted |  | cast_out | Send them everything they need: Energy −30, Matter −30. Resolve +3. / They are on their own now: Resolve −4. |
| unmoored | Unmoored | any | scripted |  | unmoored | Evacuate what we can: Energy −20. Half its people move to the capital. / They will live on their Hearth: Resolve −2. |
| world_falls | A World Falls | any | scripted |  | world_falls | Evacuate the world and harvest the stream: Its people move to the capital. Disk Skimmers can harvest the dead star. / Stay and mine our own world as it falls: Matter +80. Resolve −3. |
| embers_dim | The Embers Dim | degenerate | 20 | once | degenerate | Understood: (computed) |
| proton_answer | The Proton Question | any | scripted | once | degenerate | Tell everyone the truth: Resolve ±5 depending on the answer. / Tell the councils only: Dissent +3. |
| decay_shown | Not for Ever | any | scripted | once | degenerate | Tell everyone the truth: Resolve −5. / Tell the councils only: Dissent +3. |
| curvature_shown | The Stars That Would Not Cool | any | scripted | once | degenerate | Tell everyone the truth: Resolve −2. / Tell the councils only: Dissent +3. |
| long_flow | The Long Flow | any | scripted | once | blackhole | Set the watches: Resolve +2. / Study the flowing iron: Insight +60. |
| positronium_forms | The Widest Atoms | any | scripted | once | blackhole | Study them: Insight +40. / Let them be: Resolve +1. |
| final_burst | The Last Burst | any | scripted |  | final_burst | Record it: Its light is gone; what we built there stays. |
| horizon_whispers | Whispers at the Horizon | blackhole | 3 | once | blackhole | Listen longer: Insight +120, Energy −20. / Let it be noise: Resolve +2. |
| forgetting | Forgetting | dark | 8 |  | dark | Prune: Continuity +12. Resolve −6. / Sleep deeper: Continuity +5. Pace slows. / Keep everything, imperfectly: Resolve +3. |
| positronium | Atoms Wider Than Galaxies | dark | 4 |  | dark | Catch what we can: Energy +6. |
| false_vacuum | The False Vacuum | dark | 3 | once | dark | Write a record that could outlast it: Energy −40. Resolve +4. / Live with it: Resolve −2. |
| mind_from_nowhere | A Mind From Nowhere | dark | 2 | once | dark | Tell it everything: Continuity +8, Resolve +6. / Ask it what it knows: Insight +200. |
| relic_archive | An Archive of the Dead | any | scripted |  | ruins | Read it, slowly: Insight +90. / Strip it for matter: Matter +50 (more under salvage charters). |
| relic_engine | A Cold Engine | any | scripted |  | ruins | Restart it: Energy +70. Its heat may be noticed. / Take it apart: Matter +55. |
| relic_tomb | A Tomb | any | scripted |  | ruins | Mourn them: Resolve +4. / Study the script: Insight +45. / Salvage the site: Matter +40. Resolve −3. |
| relic_ghosts | Ghosts in the Archive | any | scripted |  | ruins | Run them again, as Echoes: +2 Echoes, wherever there is substrate (they wait in the archive until there is). They are strange to us. / Read their memories: Insight +70. / Let them finish their sentence and end: Resolve +2. |
| relic_sleepers | The Vault of Sleepers | any | scripted |  | sleepers | Leave them be: Resolve +2. / Study the vault: Insight +80. Research toward Hibernation Protocols. / Wake them: Energy −60. They may help, resent you, or be broken. / Devour the vault: Energy +150, Matter +60. Hunger Taint +6. Requires Strip the Sleepers. |
| anom_vent_life | Life Under the Ice | any | scripted |  | finds/vent_life | Study them without touching: Insight +50, Resolve +3, Kin standing +3. / Declare the ocean a sanctuary: Resolve +6, Accord +10. The Kin will remember. / Take samples for our own biology: Insight +80. Some will call it theft: Kin standing −3. |
| anom_fossil_reactor | The Ghost of a Reactor | any | scripted |  | finds/fossil_reactor | Read the record: Insight +45: a clock for the early universe. |
| anom_diamond_mantle | A Carbon World | any | scripted |  | finds/diamond_mantle | Mine it: Mineral richness +0.8, Matter +30. / Use it as an instrument: Insight +35: a diamond planet carries seismic waves very cleanly. |
| anom_primordial_hole | A Black Hole the Size of a Mountain | any | scripted |  | finds/primordial_hole | Catch its last light: Energy +120, once. It is nearly gone. / Measure it as it dies: Insight +90: Hawking radiation, observed directly. |
| anom_interstellar_shard | A Visitor From Another Star | any | scripted |  | finds/interstellar_shard | Study it as it passes: Insight +40. / Catch it: Energy −20, Matter +55. |
| anom_fossils | Someone Lived Here | any | scripted |  | finds/fossils | Tell everyone: Resolve +6, Dissent −2. We are not the first. / Archive it quietly: Insight +30. |
| anom_flare_glass | Plains of Glass | any | scripted |  | finds/flare_glass | Quarry the glass: Matter +40. / Read the flare record: Insight +25, and our astronomers learn to see flares coming. |
| anom_clathrates | Fuel in the Ice | any | scripted |  | finds/clathrates | Chart the deposits: Hydrogen yield +0.8 here (fuel for fusion). |
| anom_lens | A Lens in the Dark | any | scripted |  | finds/lens | Map everything it shows us: Stars within 400 light-years appear on the map. Insight +20. |
| anom_sail_graveyard | A Graveyard of Sails | any | scripted |  | finds/sail_graveyard | Read the charts: Insight +70. / Salvage the foil: Matter +60. |
| anom_resonance | Kept Warm by Its Neighbours | any | scripted |  | finds/resonance | Tap the tidal heat: Core heat +0.2 here, for geothermal power. |
| anom_magnetar_print | Written by a Magnetar | any | scripted |  | finds/magnetar_print | Study the imprint: Insight +40. |
| anom_warm_rogue | Warm in the Dark | any | scripted |  | finds/warm_rogue | Chart it for settlers: Core heat +0.2 and habitability at least 15% here. |

### A.10 Finds on worlds (anomalies; each also an event `anom_<id>`)

| id | trait | tip |
|---|---|---|
| vent_life | Vent life | Chemosynthetic life around hydrothermal vents in a buried ocean. |
| fossil_reactor | Fossil reactor | The isotope record of a natural fission reactor that burned out when the universe was young. |
| diamond_mantle | Diamond mantle | A carbon-rich world: beneath a graphite crust, a mantle of diamond. |
| primordial_hole | Primordial black hole | A black hole the mass of a mountain, left from the first second of the universe and now evaporating. Speculative: such holes are hypothetical. |
| interstellar_shard | Interstellar visitor | A fragment of another star’s planet-forming disk, passing through. |
| fossils | Fossil biosphere | Mineral structures grown around life that died long before ours began. |
| flare_glass | Flare glass | Plains of glass fused by the superflares of its star when it was young. |
| clathrates | Clathrate ice | Methane and hydrogen locked in cages of ice: fuel for fusion. |
| lens | Lensing alignment | A rogue world behind this star focused the light of distant stars for a while. |
| sail_graveyard | Sail graveyard | A drift of dead lightsail probes from a civilization that died long ago. |
| resonance | Tidal resonance | Locked in an orbital resonance with its neighbours: the flexing heats its interior. |
| magnetar_print | Magnetar imprint | Rock magnetised by the field of a star that was once a magnetar. |
| warm_rogue | Warm under hydrogen | A starless world whose thick hydrogen air holds in its own heat, with liquid water beneath. |

---

## S. The sealed section: the secrets of the story

> **Stop here if you are the player.** Everything below gives away what the game keeps for the
> player to discover: the two stranger minds, the Lattice's story and its ending, and every
> ending's conditions and text. A copy needs all of it; a player who reads it loses the surprise.

This section completes the ones above, which name these things only from outside. References
such as A.2 or D.3 point back to them.

### S.1 The two stranger minds (`sim/minds.ts`)

#### S.1.1 Their records
```
Mind { id, kind: 'slow'|'dark', name, systemId: string|null, stage: number,
       understanding: number /*0..100*/, clock: number /*log10 yr*/, lastPattern: number[],
       flags: Record<string, number> }
```

`gen.ts` creates `state.minds`:

- `slow`: `{ id:'slow', kind:'slow', name:'The Slow Ones', systemId: <the Heart> (the system with special 'core'), stage 0, understanding 0, clock 6.5, lastPattern [], flags {} }`.
- `dark`: `{ id:'dark', kind:'dark', name:'The Unlit', systemId: null, stage 0, understanding 0, clock 5, lastPattern [], flags {} }`.

Their signals use `from: 'slow'` / `from: 'dark'`; two discovery messages come `from: 'astronomers'`. The Signals screen names senders "Our astronomers", "The Slow Ones" and "The halo" (for `dark`). `answerSignal` sends any signal from `slow` or `dark` to `resolveMindSignal`.

**In the rest of the state** (from section A):

`GameState.minds` holds two records of type `Mind`:

| Field | Type | Meaning |
|---|---|---|
| `id` | `'slow'` or `'dark'` | |
| `kind` | `'slow' \| 'dark'` | The Slow Ones, the Unlit. |
| `name` | string | "The Slow Ones", "The Unlit". |
| `systemId` | string or null | The Slow Ones live at the Heart (its system id); the Unlit have no system (null). |
| `stage` | number | Progress of contact; starts 0. |
| `understanding` | number | 0..100; starts 0. |
| `clock` | number | log10 of the years they think on: 6.5 and 5 at the start. |
| `lastPattern` | number[] | The Unlit's last gesture pattern; starts empty. |
| `flags` | `Record<string, number>` | Their own counters (`slow.flags.silent`, `dark.flags.gathering`, `dark.flags.hostile`, …). |

They are built with the rest of the state (A.4, step 19) and draw nothing from the RNG at
creation. Other traces in the shapes of section A:
- `StarSystem.special` allows `'slow'`, which nothing sets.
- `Signal.from` is `'slow'` or `'dark'` for their messages; `actions.ts: answerSignal` sends
  those to `minds.ts: resolveMindSignal`.
- `EventDef.art` allows `'slow'`.
- `civ.flags` of theirs: `slow_gift`, `unlit_gift` (the Unlit's gift has been given),
  `last_star_lit`, `gesture_turn` (one gesture a turn), `ember_restraint` (embers yield ×0.75 in
  the Degenerate calendar once set).
- `PrimaryKind` has one more kind, `dark_star`: the Last Star, lit by the Unlit (S.1.2). It is a
  "new star" for the clocks (`flare.ts: isNewStar`).

Each turn `updateMinds` (S.1.2) sets `slow.clock = calendarEra === 'dusk' ? 6.5 : logL + 2` and
`dark.clock = calendarEra === 'dusk' ? 7 : logL + 1` before anything else it does.

#### S.1.2 When they run

`updateMinds(state, logL, mods)` is the last call of turn step 6 (after `warTurn`). Each call first sets the clocks: `slow.clock = calendar Dusk ? 6.5 : logL + 2`; `dark.clock = calendar Dusk ? 7 : logL + 1` (the Unlit's clock is shown but no rule reads it). `my = voiceRange(state, logL)` (D.3.2). At the end both understandings are clamped to 0..100. The Last Star is lit later, in step 7 (S.2).

- **End of step 6:** `updateMinds(state, logL, mods)` (the minds' whole turn; sealed D). It
  draws on the simulation RNG through `withRng`.
- **Step 7, after `evolveUniverse` and `handleNotes`:** `gatherTheLastStar(state, step.years)`.
  If `dark.flags.gathering` is set and `turn ≥ gathering`, the flag is deleted and
  `igniteDarkStar(state, to)` runs:
  - Host: the first system (insertion order) in a globular cluster that is not gone, else the
    first white dwarf not gone; none, nothing happens.
  - In the Dark calendar (or with `to` infinite) the star lights and goes out inside the turn:
    the host's primary becomes `{kind: 'black_dwarf', mass: 3, lum: 10, spin: 0, spinMax: 0}` and
    the log says "The Last Star lit and went out within the turn: in the Dark Era a turn outlasts
    any star." Otherwise the primary becomes `{kind: 'dark_star', mass: 3, lum: 10, bornAt: to,
    diesAt: lastStarDies(state, to), spin: 0, spinMax: 0}` (every other field of the old
    primary is dropped).
  - Either way: the system is renamed "The Last Star" (its worlds keep their names), charted
    (`known` 2); `last_star_lit = 1`; `gfe = min(1, gfe + 0.1)`; `unlit_gift = 1`; `dark.stage =
    5`; a signal from `'dark'`, kind `dark_star`, distance 0, title "The Last Star" (its text is
    in the code).
  - Outside the Dark it returns the host, and `endTurn` queues the event `last_star` ("Light in
    the Halo", S.8.2) with `{systemId}`.
- `lastStarDies(state, at) = max(3·at, at + tide, LAST_STAR_FLOOR)` with `LAST_STAR_FLOOR =
  10²⁵` and `tide` the Tide turn at `at` in the calendar's age (0 in the Dusk or the Dark): it
  shines at least through the turn after it lights.
- `evolveUniverse` burns it out as any new star: once `to ≥ diesAt` it becomes a `black_dwarf`,
  `bornAt`/`diesAt` cleared, note `burnout`. The Great Decay dissolves it with the rest of
  matter, and `starGoneEarly` ends any clock kept with it.

#### S.1.3 The Slow Ones (they live around the Heart and think one thought per age)

The Slow Ones' talk span is **2.5** tenfolds (`canConverse(my, slow.clock, 2.5)`). In the Dusk their clock is fixed at 6.5, reachable only once our turn's length is about 10⁴ years or more (late in the Dusk); after the Dusk it is `logL + 2`, always within 2.5 of the turn's end of our range.

1. **Silence (Taint).** If `taint > 60`, not already silent and `stage > 0`: `flags.silent = 1` and a signal `slow_silent` (distance 0): title "The Slow Ones have stopped answering", text "Their last message is a single, very long pause. The pattern around the Heart goes dark, and stays dark." Nothing further ever happens with them. Their card then reads "Silent. They stopped answering when we began to eat."
2. If not silent, one of (if / else if):
   - **Stage 0 → 1**: we have Deep Listening and (calendar not Dusk, or `eraTurn ≥ 20`). Signal `slow_anomaly` from astronomers (distance 0): "A pattern at the Heart" — "Near the Heart, a white dwarf dims and brightens. The intervals are prime numbers of millennia. Our astronomers have watched it for three turns of the long record and it has not repeated. Someone is counting, very slowly."
   - **Stage 1 → 2**: `canConverse(my, slow.clock, 2.5)`. Signal `slow_first`, distance = from our capital to the Heart: "The Slow Ones answer" — "Our clocks are finally close enough. What comes back is not words, but a proof, laid out across a hundred thousand years of flickers: that a finite store of energy can pay for an unlimited number of thoughts, if each thought is slower than the last. At the end of the proof there is a gap, as if waiting for us." Choices: `math` "Fill the gap with mathematics" (hint "Show them you can follow."), `history` "Answer with our history" ("Show them who we are."), `silence` "Wait" ("Say nothing yet.").
   - **Stage 3 → 4**: `understanding ≥ 45` and in step (2.5). `civ.flags.slow_gift = 1`; signal `slow_gift`, distance to the Heart: "The Slow Ones share the seam" — "They show us something they have been working on since before our star was born: a way to write on the boundary where one universe ends and another may begin. They cannot finish it alone. They ask us to keep a presence at the Heart until the very end. (Conformal Mathematics costs less; the Aeon Seed becomes possible.)"
3. Answers (`resolveMindSignal`, `slow_first`): `math` understanding +22; `history` +15 and `civ.flags.insight_bank += 120`; any non-silence answer sets stage 3; `silence` sets stage back to 1 (so a new `slow_first` is sent the next turn we are in step).
4. Other understanding: the Last Light crossing (Dusk → Degenerate) adds +15 if we are not dormant and `stage ≥ 2`, with the report line "We were awake to watch the last light go out, as the Slow Ones were. They noticed." (`crossing.ts`).
5. **Finding (uncertain intent, exact code):** grep finds no other source of Slow Ones understanding. The most it can reach is 22 + 15 = 37 (the `math` answer, plus the crossing bonus if they had spoken before the Last Light: possible late in the Dusk, once our turns are long enough that 6.5 lies within 2.5 tenfolds of our range), below the 45 that stage 4 needs. Only one non-silence answer is ever possible, since the stage then stays at 3. As coded, the Slow Ones' gift appears unreachable in normal play, and the Aeon Seed is reached through the Unlit's gift instead (S.1.4). Replicate as coded unless told otherwise.
6. `slow_gift` makes Conformal Mathematics cost ×0.6 (`research.ts: techCost`).
7. Card text by stage (`Signals.tsx`, `SLOW_STAGE`): 0 "Unknown.", 1 "A pattern near the Heart: someone counting, very slowly.", 2 "They have spoken. They wait for an answer.", 3 "In conversation, one thought per age.", 4 "They have shared the seam: the Aeon Seed is possible." The card (eyebrow "Around the Heart") shows their clock (green when in step, with `stepHint` at span 2.5) and understanding; it appears once `stage > 0`.

#### S.1.4 The Unlit (minds of the dark-matter sector; they share only gravity with us)

All in one `withRng` block, as sequential `if`s (several stages can pass in one turn):

1. **Stage 0 → 1**: we have Halo Dynamics. Signal `dark_anomaly` from astronomers (distance 0): "Mass without light" — "A star behind our reach brightened for eleven days, lensed by something we cannot see. Two planets in the home reach are precessing a little wrong. The halo maps show a knot of invisible mass moving against the flow of everything around it. Whatever it is, it has weight and no light."
2. **Stage 1 → 2**: we have Gravitic Semaphore. `lastPattern = newPattern()` (3 draws). Signal `dark_first` (distance 0): "Something moved the moon" — "We moved an asteroid in the pattern of the first primes. Four years later, one of our moons shifted in its orbit: ${lastPattern.join(' · ')}. It is an answer. It is also a warning of how easily they could move more than a moon. (Open Signals to answer with a gravitational gesture.)"
3. **Stage 2 → 3**: `understanding ≥ 40`. Signal `dark_reveal1` (distance 0): "The warmth of the embers" — "After long exchanges the meaning becomes clear, and we wish it had not. The embers, the white dwarfs we harvest, are warm because dark matter falls into them and annihilates. That dark matter is them. Every ember we live on is burning their kind." Choices: `ease` "Take less from the embers" ("Ember yields −25%. They will remember."), `promise` "Promise to find another way" ("Nothing changes yet."), `keep` "We cannot afford mercy" ("They will remember that too.").
4. **Stage 3 → 4**: `understanding ≥ 70`. Signal `dark_reveal2` (distance 0): "They are not dying. They are choosing." — "The falling is deliberate. For all the ages of the universe they have been invisible, touching everything and seen by nothing. Their pilgrimage into the embers is the only way they can ever make light. Now they want to do it once, all together: gather the last of the halo into one place and burn it as a star. A dark star, the last new star there will ever be. They need mass to seed it, and they need us to stop draining the halo." Choices: `help` "Help gather the Last Star" ("Costs 200 matter and 100 energy. Requires not using Halo Siphons."), `refuse` "Refuse" ("Their light is not our concern.").
5. **Their reply to exploitation**: if `stage ≥ 2`, calendar Degenerate, and (Halo Siphons running **or** `flags.hostile`) and `chance(0.08)`: `c = rng.pick(colonies)` (the draw happens even with no colonies; then nothing). If its body is not Deep and `chance(0.5)`: the body becomes rogue ("An invisible mass passed through S. B has been flung loose from its star."); else if the system is not already ejected: `sys.ejected = true` ("Something unseen pulled S out of the galaxy’s grip. It is drifting into the void.").

**Gestures** (`gesture(state, answer)`, player action `makeGesture`; from stage 2):

- `newPattern(rand)`: `kind = floor(3 rand)`, `a = 1 + floor(6 rand)`, `d = 1 + floor(4 rand)`; kind 0 → `[a, a+d, a+2d]` (a progression), kind 1 → `[a, a+d+1, a]` (returns to its start), kind 2 → `[a, a, a]` (a repetition).
- The right answer (`patternAnswer`): all three equal → `resonance`; first equals last → `mirror`; else `continue`.
- Rules: stage < 2 → "There is no one to answer yet."; once a turn (`civ.flags.gesture_turn`); any answer but `silence` costs 15 energy and 10 matter (refused if short). Then: `silence` +2 understanding ("We held still. The halo held still with us."); right +14 ("Our gesture was understood. The reply came gently this time."); wrong +3, and with `chance(0.6)` a **misread**, else "They did not seem to understand, but nothing broke." Finally a new pattern (3 draws).
- Misread: a colony by `floor(rand × n)`; `r = rand`: `r < 0.45` → if its world has life, vitality −0.1 ("Their reply shook B. Quakes, lost air, a thinner sky."), else the settlement's damage +0.3 (hearth cracked); `r < 0.8` → one pop of a random living Thread (order kin, echoes, lattice, chorus, coldminds) is lost ("An asteroid nudged by their reply struck C."); else, if the body is not Deep, it becomes rogue ("A reply too strong: B has been pulled loose from its star.").
- UI (card "In the halo", the Unlit): understanding bar, "Their last gesture" as three bars, buttons Continue / Mirror / Resonate / Hold still, "Answer by moving mass (15 energy, 10 matter). Continue what they began, mirror it back, resonate with it, or hold still. A misread reply can move a world." Card text by stage (`DARK_STAGE`): 0 "Unknown.", 1 "Mass without light: something invisible moves in the halo.", 2 "Contact by gravity: they answer moved masses with moved masses.", 3 "We know what the embers cost them.", 4 (and 5) "They want to make one star."

**Answers** (`resolveMindSignal`):

- `dark_reveal1`: `ease` → `civ.flags.ember_restraint = 1` (light collectors at halo-warmed stars yield ×0.75 while the calendar is Degenerate) and +15; `promise` +5; `keep` −10 and `flags.hostile = 1`.
- `dark_reveal2`: `help` → refused while Halo Siphons run ("They will not gather while your siphons drain the halo. Shut the Halo Siphons first: the button is under this message, and on the Unlit’s card under Other minds."); needs 200 matter and 100 energy; pays them; `flags.gathering = turn + 4`; log "We began moving dead stars toward the gathering point. They began moving everything else." `refuse` → `flags.hostile = 1`, understanding −20.
- Their messages with choices never lapse (`signals.ts: waitsForAnswer` = `from === 'dark'` with choices) and survive the 160-signal cap; `save.ts: migrate` reopens any that lapsed under the old rule.
- **Halo Siphons** (tech `halo_siphons`, `noAuto`): while researched and not shut (`physics.ts: siphonsRunning`), ember light doubles and the halo falls twice as fast; they provoke S.1.4 step 5; `shutHaloSiphons` sets `civ.flags.siphons_shut = turn`, for good. The Signals screen offers the shut button under `dark_reveal2` and on the Unlit's card.

- The halo whose fall warms the embers, the brown dwarfs and the neutron stars (B.3) **is them**: an ember is warm because they fall into it and annihilate. The physics of section B is unchanged by this; the story sits on top of it. An ember whose system they cast out of the galaxy gets `haloLeft` from the next turn's fix-up and dims.

#### S.1.5 On screen: Signals, "Other minds" (`ui/screens/Signals.tsx`)

The third tab, "Other minds", appears once `minds.slow.stage > 0` or `minds.dark.stage > 0`.
Messages from `from: 'slow'` are signed "The Slow Ones" (`senderName`). Two cards:

- **The Slow Ones:** eyebrow "Around the Heart", `h4` "The Slow Ones"; flavour by stage
  (`SLOW_STAGE`): "Unknown." / "A pattern near the Heart: someone counting, very slowly." / "They
  have spoken. They wait for an answer." / "In conversation, one thought per age." / "They have
  shared the seam: the Aeon Seed is possible."; when they have gone silent: "Silent. They stopped
  answering when we began to eat." (the silent message: "The Slow Ones have stopped answering" —
  "Their last message is a single, very long pause. The pattern around the Heart goes dark, and
  stays dark."). Rows: Their clock (`10^x yr`, green if in reach within a span of 2.5 tenfolds,
  else amber with the step hint), Understanding. Their clock starts at 6.5 (log years).
- **The Unlit:** eyebrow "In the halo", `h4` "The Unlit"; flavour (`DARK_STAGE`): "Unknown." / "Mass
  without light: something invisible moves in the halo." / "Contact by gravity: they answer moved
  masses with moved masses." / "We know what the embers cost them." / "They want to make one
  star."; Understanding with a neon bar (0–100). From stage 2: eyebrow "Their last gesture", a
  `PatternView` (SVG 120 × 60: a baseline at y 56, for each value a 3px neon bar at x `20 + 40i`
  rising `5·v`, topped by an r 4 neon circle), the text "Answer by moving mass (15 energy, 10
  matter). Continue what they began, mirror it back, resonate with it, or hold still. A misread
  reply can move a world.", buttons Continue / Mirror / Resonate / Hold still (`sfx('signal')`;
  disabled after one gesture a turn, with "Masses can be moved once per turn.").
- **`ShutSiphons`** (on the Unlit card, and under their second-reveal message `dark_reveal2` while
  the siphons run): card version: eyebrow "Our Halo Siphons", "They drive the halo’s dark matter
  into our embers: ember light doubles, and the halo empties sooner, for every ember in the
  galaxy."; message version (amber): "Our Halo Siphons still run: they will not gather while the
  siphons drain the halo."; a danger button "Shut the Halo Siphons" (tip "From the next turn ember
  light no longer doubles, and the halo falls at its own pace again. What they have drawn stays
  drawn, and they cannot be started again.") arms a confirm row: "Shut the Halo Siphons for good?
  Ember yields lose their doubling, and the siphons cannot be started again." with "Shut them for
  good" (danger) and "Not now". Once shut, the card reads "Our Halo Siphons: shut for good on turn
  N." While they run, Help on the Unlit's request is refused with a toast saying how.
- Manual "Other minds and the Hunger" says: "The Slow Ones think on clocks of millions of years;
  you can only talk to them when your own clock comes close to theirs (slow the pace, or let slower
  minds speak for you). The Unlit answer moved masses with moved masses: read their pattern and
  answer it with a gesture. Their messages wait for your answer, however long you take. Halo
  Siphons, once researched, can be shut for good, under their message or on their card (Signals,
  Other minds): ember light stops doubling, and the halo falls at its own pace again."
- Codex "II. The Degenerate Age", "Halo Siphons" paragraph: in the game the whole halo falls into
  the embers twice as fast while they run (cold by about η 24.7 instead of 25 if run from early on),
  with "Where the game bends physics: a few dozen embers among hundreds of billions of white dwarfs
  could never empty a galaxy’s halo".

#### S.1.6 Where else they show

- `crossing.ts`: the Last Light line in S.1.3.
- `research.ts`: Conformal Mathematics ×0.6 (`slow_gift`), ×0.5 (`unlit_gift`).
- `economy.ts`: `ember_restraint`.
- Codex (`ui/screens/Codex.tsx`): the Embers entry ends "In the game the Unlit, the dark-matter minds, have something to say about that."; the Dark stars entry describes the game's dark star at the end of time (burns until the universe is three times as old, never before η 25, kept time with free); the sources list Spolyar, Freese & Gondolo 2008.
- Manual (`Manual.tsx`): a paragraph naming the Slow Ones and the Unlit and how each is answered; the victories paragraph names every Work's ending.
- Tech descriptions (public in the research screen): Halo Dynamics "Something in it is moving against the flow."; Gravitic Semaphore "Contact with what hides in the halo becomes possible."
- The harness prints `halo ${minds.dark.stage}` (0–5).

- `research.ts: techCost`: Conformal Mathematics costs ×0.6 with `slow_gift` and ×0.5 with
  `unlit_gift` (both multiply, after difficulty, then rounded).
- `crossing.ts`, the Last Light: if the civilization is awake and `slow.stage ≥ 2`,
  `slow.understanding += 15` and the line "We were awake to watch the last light go out, as the
  Slow Ones were. They noticed."
- The Setup screen's tip for "None" survivors reads: "No other young civilizations. The
  Hunger, the Slow Ones and stranger things remain."
- `main.tsx` keeps nothing of theirs; `endTurns` in the test hooks clears pending events,
  theirs included.

- **New game → Other survivors → None** tooltip: "No other young civilizations. The Hunger, the
  Slow Ones and stranger things remain."
- **`slow.webp`** (`public/art/slow.webp`, 1600×900, 174 KB, VIOLET grade, one of the eleven plates
  of `84a766a`): a black hole with a bright thin photon ring and an edge-on disk, circled by two
  ellipses of evenly spaced points of light (someone counting), in a dense starfield. The events'
  `art` type allows `'slow'` and `ART_TINT.slow = '#161a28'`, but no event uses it at this commit.
- **The halo civilization's wrong answer** (unit check `quake`): a misread gesture to the Unlit can
  shake a world: a living world loses life; a lifeless one has its hearth cracked (+30% damage).
- **The Aeon Seed** needs "A settlement at the Heart, and the Slow Ones’ trust. The seed is written
  when the Heart evaporates." Its Research card button when complete reads "Complete: waits for the
  Heart" (tip "Complete: nothing more to put in. The seed is written when the Heart evaporates, if
  the condition above still holds then.").
- **Checks, in full:** unit `siphons` — "Halo Siphons (11 Oct): shut for good from the Unlit's
  request or card; while they run the halo falls twice as fast (its clock runs ahead of ours by
  what they drew, counted only from turns played with this version: no save loads into an emptier
  halo); they double an ember's dark-matter light, not a world falling into it; the Unlit's
  messages wait for an answer." Browser `siphons` — while they run, the Unlit's request refuses
  Help (the toast says how) and shows a Shut button under it, as does the Unlit's card; it asks
  first ("Not now" changes nothing), from the keyboard too; shut, the line goes and Help goes
  through, and the card says they are shut; the same in the magnifier mode. Unit `last-star` — the
  Last Star lights as the turn ends, shines through the next turn, its event offers its clock free
  whatever the pace; the Great Decay ends it; a Last Star the old rule put out lights again as an
  old save loads (save `98139af-seed1000-turn121-last-star-out`); the Unlit's message stays word for
  word. Browser `last-star` — the gathering done, End turn lights it; its event, Light in the Halo,
  offers to keep time, free, from the keyboard too; the Pace panel counts six turns; the star's
  panel shows it burning; six real End Turns run it out; the same in the magnifier mode.

#### S.1.7 The autoplayer and the minds (`auto.ts: planSignals`)

`slow_first` → `math`; `dark_reveal1` → `ease`; `dark_reveal2` → `help` (if refused, e.g. siphons running or short of resources, it falls back to the last choice, `refuse`, which makes them hostile). Every turn while `2 ≤ dark.stage < 5`, energy > 80 and matter > 40, it gestures with the right answer (`patternAnswer(lastPattern)`), so understanding climbs 14 a turn. In the 12 Oct census 75 of 300 harness games lit the Last Star.

---

#### S.1.8 Two save repairs (A.7, step 9)

1. Every signal with `resolved === 'lapsed'` that `waitsForAnswer` (from `'dark'` and with
   choices) is reopened (`resolved = null`): since 11 Oct the Unlit's messages wait for an answer.
2. `relightTheLastStar(s)`: a Last Star lit by the rule before 12 Oct burned out within a turn.
   It lights again on load when all of these hold: `unlit_gift` set; `last_star_lit` not set
   (older saves lack it); matter not gone; calendar Degenerate or Black Hole; the `dark_star`
   signal exists; a system named "The Last Star" exists and is not gone; `sentYears·3 > 10²⁵`.
   If its primary is still a `dark_star`, only if `diesAt < years + Tide turn`; if it is a
   `black_dwarf`, only if the log shows it burned out no later than the turn after it lit (lit =
   the signal's `arrivedTurn − 1`); any other kind, never. It becomes `{...primary, kind:
   'dark_star', mass: 3, lum: 10, bornAt: years, diesAt: lastStarDies(years), spin: 0,
   spinMax: 0}`, `last_star_lit = 1`, and the `last_star` event is queued.

### S.2 The Last Star

- Turn step 7, after `evolveUniverse` and before `state.turn++`: `gatherTheLastStar(state, step.years)`: when `flags.gathering` is set and `turn ≥ gathering`, it is cleared and `igniteDarkStar(to)` runs.
- Host: the first not-gone system in a `globular` region (`Object.values` order), else the first not-gone white dwarf; none → nothing.
- `brief = calendar Dark or !isFinite(to)`. The host's primary becomes `{ kind:'dark_star', mass 3, lum 10, bornAt: to, diesAt: lastStarDies(to), spin 0, spinMax 0 }`, or if brief `{ kind:'black_dwarf', mass 3, lum 10, spin 0, spinMax 0 }` with the log "The Last Star lit and went out within the turn: in the Dark Era a turn outlasts any star."
- `lastStarDies(at) = max(3 × at, at + tide, LAST_STAR_FLOOR = 10²⁵)`, where `tide` is the Tide turn length of the calendar age at `at` (0 in the Dusk or the Dark).
- Then: host renamed "The Last Star", `known = 2`, `civ.flags.last_star_lit = 1`, `gfe = min(1, gfe + 0.1)`, `civ.flags.unlit_gift = 1`, `dark.stage = 5`; signal `dark_star` (distance 0): "The Last Star" — "In the halo, a star has ignited, powered by dark matter annihilating in its heart. Everyone left in the Coalescence can see it. Its light is modulated, and when our astronomers decode it they find it is addressed to everything that can see: every ember they fed, every orbit they touched, and a gift for us, a way of writing across the end of the universe. The Unlit are becoming light."
- Unless brief, `turn.ts` queues the event `last_star` `{ systemId }`.
- `unlit_gift` makes Conformal Mathematics cost ×0.5 (with `slow_gift` too, ×0.3) and satisfies the Aeon Seed's trust condition (S.4).
- Event `last_star` — "Light in the Halo" (art `degenerate`): text "In the halo the Last Star burns, the dark matter in its heart annihilating into light: a new light in a dead galaxy, and the last new star there will ever be." + the new-star timing text (`newStarTiming`) + " Will we live in its light while it lasts?" when a clock is on offer; if the host has already become the `void` (the Great Decay took it), "In the halo the Last Star lit, the dark matter in its heart annihilating into light: a new light in a dead galaxy, and the last new star there will ever be. As the turn ended the Great Decay took it with the rest of matter, almost as it came." Choices: "Keep time with it" (`ok: starClockOffer`; free whatever the pace: `dark_star` is the "gift" kind in `flare.ts`), "Watch it burn" (insight +25, resolve +2).
- `relightTheLastStar` (`save.ts: migrate`): a save from before 12 Oct whose Last Star burned out within a turn under the old rule lights again while matter lasts (rules in `minds.ts`), and its event is queued.

**Its clock** (`flare.ts: starClockTerms`):

In `starClockTerms` the `dark_star` differs from every other new star:
- Its clock may run in the Black Hole calendar as well as the Degenerate (`starClockEra`):
  where matter does not decay the calendar reaches 10⁴⁰ years with the age unchanged, and the
  star may light there.
- It is free (`gift`): price 0 whatever the orders, no partner halving, and no follow-on floor.
- Otherwise the same rules: six turns of its remaining life, a flash when too brief, a follow-on
  after another clock.

- The Codex says plainly that its lifetime is the game's choice: until the universe is three times as old as when it lit, never before η 25 (the halo's end, after Adams & Laughlin), and always through the turn after it lights.

**On screen:**

The late primary kind `dark_star` is the dark star the Unlit gather from the last of the halo (the
"Help" outcome of their request; `docs/spoilers/dark-matter.md`). Its presentation:

- **Name:** `PRIMARY_NAME.dark_star = 'The Last Star'` (`ui/labels.ts`); its icon is the white-dwarf
  glyph (`primaryIcon`). In the Type sort (`Lists.tsx` `TYPE_ORDER`) it sits after the helium giant.
- **Galaxy map:** node size 10 (as a helium giant, `galaxyView.ts` `nodeSize`); its colour is the
  blackbody of its temperature like other living stars. Its label always shows while it burns, in
  whichever calendar it lights: `burning()` in `engine.ts` counts `pr.kind === 'dark_star'` (with
  `diesAt > years`) in the Degenerate and Black Hole calendars, drawn `✦ Name`, class `beacon`
  (`#ffe0a0`, 600, amber glow).
- **System view** (`systemView.ts` `buildPrimary`): star sphere radius 8, colour `#ffcfa0`,
  granulation 0.6, bands 0, intensity 1.6; glow plane 70 units, `#ffb98a`, power 1.2. Light on its
  worlds (`primaryLightColor`): colour `#ffcfa0`, power 1.3.
- **Event:** "Light in the Halo", lit as the turn ends; it offers its clock free whatever the pace
  (the Pace panel's star-clock chip counts its six turns). The Unlit's own message about it is kept
  word for word (unit check `last-star`). Under the decay fate it dissolves at the Great Decay.
- **Codex** "II. The Degenerate Age" has a "Dark stars" paragraph (Spolyar, Freese & Gondolo 2008;
  "A dark star at the end of time is the game’s speculation … in the game, until the universe is
  three times as old as when it lit (never before about η 25), and never less than the turn after
  it lights. Like every new star it lights as its turn ends, and you may keep time with it, free
  whatever your pace. Where protons decay it dissolves with the rest of matter at the Great
  Decay."), and the "Embers" paragraph ends "In the game the Unlit, the dark-matter minds, have
  something to say about that." "Sources" cites Spolyar et al. ("A dark star in the far future is
  speculation").

### S.3 The Lattice's story

- Event `anyone_in_there` — "Is Anyone In There?" (art `dusk`, any age, weight 3, once, needs ≥ 3 Lattice): "A Lattice unit asked a question in the maintenance logs: “What is the repair for?” No one programmed it to ask. Everyone is sure there is no one inside the Lattice. Almost everyone." Choices: "Study it" (insight +50); "Answer it honestly" (resolve +2, Kin standing −2, sets `civ.flags.lattice_asked = 1`); "Wipe it and move on" (Kin standing +2).
- `lattice_asked` is set and never read anywhere in the code.
- The Archive of Everything's epilogue closes the thread: "…Now and then, in the maintenance logs, a record is opened that nothing asked for. It is not you. It is everything you were, kept." (S.4.2).
- (The Tessellate, a neighbour, is a different Lattice: "CONSCIOUS OPERATORS: NONE" is public.)

---

- The Lattice Thread is `conscious: false` (`game/data/threads.ts`); its blurb: "Self-maintaining
  processes. They build, repair and replicate without rest, make no demands, keep no grudges, and
  wear out. Whether anyone is in there is a question they have never raised." On its Threads card
  it has no Standing, no Demand, no Hear button, and a chip "asks for nothing" with the tip "The
  Lattice has no standing and no demand: it has never asked for anything. It cannot be persuaded,
  only maintained." (`Society.tsx`). Since `0032b5b` the game no longer calls it non-conscious
  outright: its texts describe what it does and what people assume, and leave the rest to a few
  hints (rules unchanged).
- Its Great Work and ending: below.

### S.4 The endings

#### S.4.1 The outcome and the check

`Outcome { kind: 'victory' | 'dark' | 'endurance' | 'defeat', ending: string, turn, eta }`.

`checkEndings(state, atLastHorizon = false)` (`sim/endings.ts`), in this exact order:

1. `state.outcome` already set → return it.
2. `taint ≥ 100` → **dark**, "The Hunger".
3. `totalPops(state) ≤ 0` (cryo counts) → **defeat**, "Silence".
4. If `resolve ≤ 0`: unless `atLastHorizon`, `civ.flags.despair++`; if `despair ≥ 6` → **defeat**, "The Will Fails". Else (resolve > 0), unless `atLastHorizon`, `despair = 0`. (Six consecutive end-of-turn checks at zero resolve.)
5. Calendar Dark and `continuity ≤ 0` → **defeat**, "The Fade".
6. If `atLastHorizon` and the Aeon Seed's progress ≥ its cost and its requirement holds → **victory**, "The Aeon Seed".
7. For each other Work in `WORKS` order (Hibernal Cascade, Confluence, Archive of Everything, Garden of Embers): progress ≥ cost and requirement holds → **victory** with its ending.
8. Calendar Dark and `log10(eta) ≥ 122` (the years reach 10^(10^122)) → **endurance**, "Recurrence".

When it runs: step 10 of every turn (`atLastHorizon = false`); and in step 9 with `atLastHorizon = true` when the Black Hole Age is over (`ageOver`, before `runCrossing`) or when no black hole or Heart is left in the Black Hole Age; if it returns an outcome the turn returns at once, before the crossing. So the Aeon Seed can only be won at the Last Horizon, "when the Heart evaporates". In the Dark Era, the end of its ruler (`ageOver`) does nothing: endurance comes through rule 8.

#### S.4.2 The Great Works and their endings (`data/works.ts`)

| Work | Ending | Path | Ages | Tech | Insight cost | Energy to begin | Max Taint |
|---|---|---|---|---|---|---|---|
| `hibernal_cascade` The Hibernal Cascade | The Long Thought | Continuance | Dark | `asymptotic_mind` | 1500 | 220 | 59 |
| `confluence` Confluence | One Voice | Union | Black Hole, Dark | `total_confluence` | 1500 | 150 | 29 |
| `archive_of_everything` The Archive of Everything | The Quiet Lattice | Persistence, kept by the machines | Black Hole, Dark | `archive_theory` | 1500 | 150 | 59 |
| `aeon_seed` The Aeon Seed | The Aeon Seed | Speculative physics | Black Hole | `conformal_mathematics` | 1700 | 300 | 29 |
| `garden_of_embers` The Garden of Embers | The Last Garden | Biology | Dark | `garden_of_embers` | 1200 | 200 | 29 |

- Cost: `workCost = round(cost × (gentle 0.8 | standard 1 | harsh 1.2))`.
- Requirements (`workRequirementMet`; all also need `taint ≤ maxTaint`):
  - Hibernal Cascade: Echoes + Coldminds ≥ 6. Shown: "Echoes and Coldminds together number at least 6."
  - Confluence: someone alive, Chorus ≥ half of all pops, and each of Kin, Echoes, Chorus, Coldminds is either absent or at standing ≥ 55. Shown: "The Chorus is at least half of everyone, and every Thread’s standing is at least 55."
  - Archive of Everything: someone alive and Lattice ≥ half of all. Shown: "The Lattice is at least half of everyone."
  - Aeon Seed: a colony at the Heart and (`minds.slow.stage ≥ 4` or `civ.flags.unlit_gift`). Shown: "A settlement at the Heart, and the Slow Ones’ trust. The seed is written when the Heart evaporates."
  - Garden of Embers: fate stable and known, and Kin + cryo ≥ 6. Shown: "Protons are stable, and at least 6 living Kin (awake or in Cold Sleep) remain." (Its tech is visible only once the stable fate is known.)
- `startWork(id)`: needs the tech, the age (`inAge`), `taint ≤ maxTaint` ("What we have become cannot do this."), not already complete; the first time it costs the energy and sets progress 1. Logs "<name> begun." (era) or "<name> begun. It cannot be finished until: <requirement>".
- Progress (turn step 3): with a Work active, it takes `insight × (researching ? 0.5 : 1)`; the rest goes to research. At `progress ≥ workCost`: log "The Great Work is complete." and `civ.work = null`; the ending then comes at the first check where the requirement holds (so a complete Work can win later, when its condition comes true).
- Epilogues, verbatim:
  - The Long Thought: "You slow until each thought takes longer than the one before, and you sleep between them for longer still. With a finite store and an endless night, the sum still grows. Whether it grows forever, no one in the universe is left to check. You keep thinking."
  - One Voice: "The Threads braid into one. There is no one left to disagree, and the one who remains remembers every argument fondly. A single mind costs less than a crowd, and it faces the dark with every memory the crowd ever had."
  - The Quiet Lattice: "The last of the others finish writing, and let go. What remains keeps the record: every face, every argument, every star you saw. It maintains itself and repairs itself, and as far as anyone knew, nobody reads it. Now and then, in the maintenance logs, a record is opened that nothing asked for. It is not you. It is everything you were, kept."
  - The Aeon Seed: "When the Heart finally evaporates, its last light carries a pattern out to where scale stops meaning anything. If Penrose was right, the end of this universe is the beginning of the next, and something you wrote is waiting in its first light."
  - The Last Garden: "In a frozen universe of stable iron and cold light, you wake the Kin and grow a garden around the last warmth you saved. A few thousand years of green, then sleep, then green again. It is small, and it is alive."

- On their Research cards the Works carry the eyebrow "{path} · ending: {ending}". A finished Aeon Seed's button reads "Complete: waits for the Heart" (tip "Complete: nothing more to put in. The seed is written when the Heart evaporates, if the condition above still holds then.").
- **Conformal Mathematics** (the Aeon Seed's tech, base 1200) costs ×0.6 with `slow_gift` and ×0.5 with `unlit_gift`, both before rounding, ×0.3 with both: 720, 600 or 360 at standard difficulty.

#### S.4.3 The other endings, verbatim

- **The Hunger** (`DARK_ENDING`, kind `dark`): "There is no one left inside to notice when it happens. The swarms that were once your people move from ember to ember, eating what light is left, and will outlast everything, including the time everything had left. It was survival. It worked."
- **Recurrence** (`ENDURANCE_ENDING`, kind `endurance`): "You outlasted every source, every bound atom, every clock. In a universe this old, given enough time, any state comes around again. You are still here to see it."
- Defeats (`Story.tsx: DEFEAT_TEXT`):
  - **Silence**: "The last of you went quiet. The settlements cooled, the archives stopped answering, and the light of your worlds kept travelling outward for a while after there was no one left to send it."
  - **The Will Fails**: "You did not run out of energy. You ran out of reasons. One by one the Threads chose to stop, and the reserve sat full and unused in the dark."
  - **The Fade**: "Every cycle in the dark cost a little of who you were. At the end, the pattern was too thin to hold. Something still runs where you used to be, but it is not you."

#### S.4.4 The outcome screen

**The outcome screen** (`OutcomeScreen`): full-screen `.crossing`; plate `art/hunger.webp` for the
dark ending, else the current age's plate; the `from` line "{head} · turn N · η X" with head "An
ending" (victory), "The dark ending", "Endurance" or "The end" (defeat); `h1` the ending's title,
in `--bad` red for a defeat or the dark ending; the epilogue; a lines panel: "You endured {years}
and {turns} turns. {P} of you remain: {n Thread, …}." then each survivor civilization's fate
("still out there", "saved", "lives on within you", "taken by force", "devoured", "went beyond",
"faded"; green for saved/absorbed, red for seized/devoured); buttons Look around and Main menu
(music mood back to the menu). On reaching the outcome `turnflow` sets the music mood `outcome`
(the Ending track, `music/outcome.mp3`, or the outcome synth style), which is not tied to any one
ending.

**The Manual's "Endings" topic:** "Victories come from the Great Works: The Long Thought (Echoes
and Coldminds), One Voice (the Chorus), The Quiet Lattice (the Lattice), The Aeon Seed (at the
Heart, with the Slow Ones), The Last Garden (living Kin, if protons are stable)." / "Recurrence:
simply still exist when the calendar reaches 10^(10^122) years. The Hunger: become it." /
"Defeat: Silence (no one left), The Will Fails (resolve at zero for too long), The Fade
(Continuity lost in the Dark Era)."

#### S.4.5 Endings and the autoplayer

- `planWorks`: with no Work active, tries in order `aeon_seed`, `hibernal_cascade`, `archive_of_everything`, `confluence`, `garden_of_embers`, starting the first whose tech is known, age is right and requirement already holds.
- The harness's victories are almost all The Long Thought and, at the Heart, The Aeon Seed (DEV-NOTES); the other Works never move it. Survival in `tally.sh` = VICTORY + ENDURANCE (DARK and DEFEAT count as not surviving). The 12 Oct balance row notes "Aeon Seed victories 67 → 71" (DEV-NOTES; it does not say whether of the 300 or the 900).

---

### S.5 Taint's thresholds

- The HUD shows Taint once it is above 0, with the tooltip "Hunger Taint N\nWhat you have taken from the Hunger. Past 30 and 60 some endings close. At 100 you become it."
- **Above 29** (from 30): Confluence, the Aeon Seed and the Garden of Embers can no longer be begun or won.
- **Above 59** (from 60): the Hibernal Cascade and the Archive of Everything close too. At 60 or more, no pacts can be proposed, accepted on arrival, or offered (D.2.11).
- **Above 60**: the Slow Ones fall silent for good (S.1.3).
- **100**: the dark ending, "The Hunger", at the next ending check.
- The research screen disables a tainted Work with "What we have become cannot do this."

---

### S.6 What to keep out of the public text

- Event `last_star` (S.2) and every `slow_*` / `dark_*` signal (S.1.3, S.1.4), including the two astronomer messages.
- Event `anyone_in_there` (S.3).
- The Last Light crossing line about the Slow Ones (S.1.3).
- The Codex and Manual lines in S.1.6; the Signals "Other minds" tab and its stage texts.
- All Work epilogues, ending titles and defeat texts (S.4).
- Not spoilers: the Hunger, its makers' standing order in `hunger_mirror` ("PERSIST"), the neighbours and their six ways of life, the dark charters, Taint itself.

* The `WORKS` fields `ending`, `path` and `epilogue`; `DARK_ENDING`; `ENDURANCE_ENDING`.
* `WORKS.aeon_seed.requirement` names the Slow Ones.
* The descriptions of Halo Dynamics ("Something in it is moving against the flow") and Gravitic
  Semaphore ("Contact with what hides in the halo becomes possible") only hint. The tech data is
  shown to the player as is.
* The comment above `shutHaloSiphons` in `actions.ts` names the Unlit. The log line the player
  sees ("We shut the Halo Siphons for good. The dark matter falls into the embers at its own pace
  again.") does not.

### S.7 Key to section A's outside references

| Section A says | It is |
|---|---|
| "two records for the stranger minds" (A.2) | `minds.slow`, `minds.dark` (S.1.1) |
| "one more value that is never set" (`special`, A.2) | `'slow'` |
| "one kind made only by a stranger mind" (A.2) | `dark_star`, the Last Star |
| "the stranger minds' update" (A.6, step 6) | `updateMinds` |
| "a stranger mind's step that may light a star" (A.6, step 7) | `gatherTheLastStar` |
| "one special star also in the Black Hole calendar" (A.5) | the Last Star (S.2) |
| "one kind excepted" from lapsing and trimming (A.6, step 8) | the Unlit's messages awaiting an answer (S.1.4) |
| "two repairs of a stranger mind's records" (A.7, step 9) | S.1.8 |
| "an ending check" / `checkEndings` (A.6, steps 9 and 10) | S.4.1 |

### S.8 The sealed data tables

#### S.8.1 Great Works: their paths, endings and epilogues

| work | path | ending | epilogue |
|---|---|---|---|
| hibernal_cascade | Continuance | The Long Thought | You slow until each thought takes longer than the one before, and you sleep between them for longer still. With a finite store and an endless night, the sum still grows. Whether it grows forever, no one in the universe is left to check. You keep thinking. |
| confluence | Union | One Voice | The Threads braid into one. There is no one left to disagree, and the one who remains remembers every argument fondly. A single mind costs less than a crowd, and it faces the dark with every memory the crowd ever had. |
| archive_of_everything | Persistence, kept by the machines | The Quiet Lattice | The last of the others finish writing, and let go. What remains keeps the record: every face, every argument, every star you saw. It maintains itself and repairs itself, and as far as anyone knew, nobody reads it. Now and then, in the maintenance logs, a record is opened that nothing asked for. It is not you. It is everything you were, kept. |
| aeon_seed | Speculative physics | The Aeon Seed | When the Heart finally evaporates, its last light carries a pattern out to where scale stops meaning anything. If Penrose was right, the end of this universe is the beginning of the next, and something you wrote is waiting in its first light. |
| garden_of_embers | Biology | The Last Garden | In a frozen universe of stable iron and cold light, you wake the Kin and grow a garden around the last warmth you saved. A few thousand years of green, then sleep, then green again. It is small, and it is alive. |

**`DARK_ENDING`:** ending The Hunger; epilogue There is no one left inside to notice when it happens. The swarms that were once your people move from ember to ember, eating what light is left, and will outlast everything, including the time everything had left. It was survival. It worked.

**`ENDURANCE_ENDING`:** ending Recurrence; epilogue You outlasted every source, every bound atom, every clock. In a universe this old, given enough time, any state comes around again. You are still here to see it.

#### S.8.2 Events that belong to the sealed stories

| id | title | ages | pool weight | once | plate | choices: hint |
|---|---|---|---|---|---|---|
| anyone_in_there | Is Anyone In There? | any | 3 | once | dusk | Study it: Insight +50. / Answer it honestly: Resolve +2. Kin standing −2. / Wipe it and move on: Kin standing +2. |
| last_star | Light in the Halo | any | scripted |  | degenerate | Keep time with it: (computed) / Watch it burn: Insight +25: a star made of what we could never see. Resolve +2: a new light, the last. Our pace stays our own; what cannot be stored is lost. |
