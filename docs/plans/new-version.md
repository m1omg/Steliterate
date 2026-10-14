# Plan: the new version (approved 13 Oct)

The plan the player approved on 13 Oct 2026, kept here as it was approved so any session can pick
it up. The work is on `claude/epic-wozniak-lyhulf`; `main` keeps today's game until the player says
the new version is ready (see "How it ships"). Progress is in docs/SESSION-NOTES.md and the CHANGELOG.

**Where it stands** (13 Oct): Part 0 done and live; the foundation (its own storage) done; 1a (young
dwarfs) done; 1b waits for the player's word on the proposal (SESSION-NOTES, 13 Oct); 2a-0 (one
rulebook) and 2a-1 (owners everywhere) done, the 900 games identical; next, 2a-2 (the steps of 2a
are under "2a, as it is being built").

---


## Context

The player asked for two small things first:

- add the positronium line to the Codex;
- back up the whole game as it is, so the older build stays easy to reach without Git.

Then nine larger ones. The player put me in planning mode because it's a lot.

1. **Civilizations play the same game.** The others should be as complex as the player and play
   by the same rules: genuinely different, but the same game. DESIGN.md's "light simulation" line
   goes.
2. **The Hunger in diplomacy.** Hunger technology shouldn't be traded casually.
   - Adopting some of it is a diplomatic minus, lighter for the desperate than for the
     prosperous.
   - Heavy corruption makes a civilization aggressive, and is a just cause for war against it.
3. **More military units and a better AI.** A few Higgsfield credits are available: 6.5.
4. **Still no conquest victory.** War rarely pays, and conquest spends galactic free energy.
   The others are mostly peaceable, except when desperate, corrupted, or defending against
   corruption.
5. **Films and a survey reveal.** A JavaScript-drawn film for each age and each ending, in the
   style of the three example posts. An optional Endless Space 2-style reveal when a surveyed
   system's worlds appear.
6. **Ways of existence after the end of matter.** A transition (those who don't prepare
   vanish), and a look that isn't ordinary matter for what survives.
7. **Positronium** should do something in the late game.
8. **A few fresh dwarfs.** More white and brown dwarfs at the start that are young enough to
   glow visibly.
9. **Charting on the way.** Ships should find stars they pass on the way, unless that breaks the
   game.

### The player's words and answers

- **Saves:** "For the new version, don't worry about saves. It will have so many changes that I
  will start from the beginning."
- **Shipping:** "Preview address, but once all is done."
- **Order:** the small parts first, then the civilizations.
- **Films:** in the game, plus video files. They are "the programmatic beautiful ones, not the
  ones generated through KREA or Higgsfield": every frame is drawn by code. Higgsfield is only
  for the new ships' sprites.
- **Dwarfs:** "I'm not asking you to change the cooling physics."
- **Hunger:** "desperate players adopting SOME hunger tech should not be viewed as badly as
  prospering ones."
- **The others' reach:** they may settle anywhere, by the same rules as us.
- **Positronium sources.** The player photographed Adams & Laughlin's book, *The Five Ages of the
  Universe* (1999), pp. 165–168: "Life and Death for Positronium" and "The Never-Ending
  Annihilation". The player also linked Wikipedia's *Timeline of the far future* for iron stars,
  black dwarf supernovae and tunnelling into black holes.

## How it ships ("Preview address, but once all is done")

- **Nothing of the new version goes live until all of it is done.**
  - Then it goes up at https://m1omg.github.io/Steliterate/next/.
  - The main address keeps today's game until the player says to switch.
  - If the player wants to try something earlier, it can go up at /next/ sooner.
- **Review in chat while the work is under way.**
  - I share screenshots, MP4s of the films, Higgsfield sprites before they go in, and census
    numbers.
  - Spoiler-light. The player has reached the Dark Era (an early ending there), so its opening
    is fine to show. Before sending anything from its far end (the deep-time events,
    Recurrence) or from an ending they haven't had, I ask first.
- **Branches.** Work happens on `claude/epic-wozniak-lyhulf`.
  - Each part is validated, committed and pushed there, with no PR into `main` until the end.
  - The exceptions are PR #27 and the positronium line, which belong to today's game.
- **Saves.**
  - The new version's first commit gives it storage of its own: one prefix constant,
    `steliterate2.`, for every key (save, autosave, slots, settings, HUD, `steliterate.resume`
    at `main.tsx:228`).
  - Old saves are refused on load and import. `deserialize` today accepts anything with
    `systems` and `civ` (`save.ts:111`).
  - Today's saves stay playable at the main address and in the backup. The new version's Load
    screen points there.
  - "Saves are sacred" is suspended until the new version is live at /next/, then holds again
    for its own saves.
  - A fresh-game round trip (save, load, compare) stands in for `savecompat` until then.
- **Seeds stay sacred.** Generation consumes the main RNG exactly as before.
  - Anything new uses its own hashed stream, as `addOuterWorlds` does.
  - Each AI civilization also plays on a stream of its own, so the player's draws don't move
    when an AI does something different.

## Part 0: finish today's game, back it up, add the positronium line

1. **Merge PR m1omg/Steliterate#27.** All 51 browser checks passed on `index-B4EKBtSN.js`.
   - Add the 13 Oct baseline to SESSION-NOTES "Picking up".
   - Update the PR body.
   - Merge with a merge commit (`expectedHeadSha` from `git rev-parse`).
   - Verify the Pages run and the live script.
2. **The backup** is today's game with PR #27, the last state before any of the new version.
   - **A tag, `snapshot-2026-10-13`.** GitHub offers the source as a zip with no Git needed:
     `github.com/m1omg/Steliterate/archive/refs/tags/snapshot-2026-10-13.zip`.
   - **A playable copy that never changes,** at
     https://m1omg.github.io/Steliterate/archive/2026-10-13/.
     - Built once from the tag (`base: './'` makes the build relocatable).
     - Committed as plain files under `public/archive/2026-10-13/`. Vite copies `public/`
       verbatim and tsc never sees it, so every later deploy carries the copy with no workflow
       change. A copy kept only on `gh-pages` would be wiped by the next force-push.
     - It costs little in Git, because the music and art are byte-identical files. The deployed
       site grows from about 56 MB to about 112 MB, well within the Pages limit.
     - It uses today's storage keys, so it opens the player's current saves. There is no service
       worker.
     - `.gitattributes` marks it `linguist-generated`, and a `.ignore` keeps its minified script
       out of searches. A later snapshot must never be built from a tree that contains it.
   - **Offline:** a zip of the build, run with `python3 -m http.server`, as a GitHub Release
     asset if this session's GitHub access allows uploads. If it doesn't, I say so.
   - **Verify:**
     - `vite preview` serves `/archive/2026-10-13/` (not the root page).
     - A save made at the main address loads there.
     - The same holds on the deployed site.
   - **Permission:** approving this plan approves pushing the tag, and later the `next` branch
     (Part 5). Nothing else beyond my work branch.
3. **The positronium line**, in today's game, as a small PR into `main` after the tag.
   - In the Codex's Black Hole Age paragraph: Chiba & Sugiyama (2004, astro-ph/0405273) find
     that with dark energy like ours, electrons and positrons drift apart faster than they can
     pair. So positronium may never form, and the game's event at η 85 is a bend.
   - The paper also goes into the Codex's Sources.
   - Run tsc, build, and the `codex` and `translate` checks. Merge, then check the live site.
   - Then restart `claude/epic-wozniak-lyhulf` from `main`.

## The new version's first commit (foundation, before Part 1)

- The storage split and the refusal of old saves (above).
- A `?nofilms` parameter and an `__stel` switch, so the browser checks can get past films later.
- A `civsAsleep` switch for seeded checks that must not drift with the civilizations.

## Part 1: the small ones (items 8 and 9)

### 1a. A few young, glowing dwarfs (item 8)

- **Today.**
  - `formedAt` (`physics.ts:122`) dates every dwarf the galaxy begins with from a hash of its
    kind and mass. It takes no draw and is computed live.
  - The dates are log-uniform from 10⁹ years to the Dusk, so 99% are over 10¹³ years old: white
    dwarfs at 47–89 K, brown dwarfs under 63 K.
- **The change:** the same hash, mapped differently. About one dwarf in ten becomes a straggler
  of the last star formation; a census sets the share and the player can tune it.
  - White ones formed 1 to 12 billion years before the Dusk: about 7,400 to 3,600 K by the
    game's own law.
  - Brown ones 0.4 to 4 billion years before: about 2,000 to 1,000 K at 0.05 M☉, by Burrows'
    fit.
  - The rest keep today's spread.
  - The cooling laws are untouched. A 10⁹-year-old one is down to about 130 K by the Dusk's end.
- **Seeds are safe.**
  - Generation never reads temperature (`bodyTemplates`, `addBody`).
  - The passes that do (`frozenFromTheStart`, `waterFromTheStart`, `scorchedFromTheStart`) run
    after it and draw nothing.
  - So a seed keeps every star and world. Only the worlds of young dwarfs start warmer.
- **Two existing gaps to close, so the young ones count:**
  - A white dwarf the galaxy began with gives collectors a flat 0.02 in the Dusk, whatever its
    age (`sourceLight`, `physics.ts:480`). Young ones get the same `youngDwarfLight` a red
    dwarf's remnant gets.
  - The map's colour for a Dusk white dwarf (`coolDwarfShine`) only spans 780–1,500 K. Hot ones
    take their blackbody colour, as the system view already does.
- **A bend, stated in the Codex:** more young dead stars than a 1/t fade would leave.
- **Measure and check.**
  - A census over 50 seeds: how many young dwarfs there are, how hot, and which worlds change.
  - The harness at 300 and 900 games.
  - `unit/young-dwarfs`: the share, the temperature ranges, the laws unchanged, generation
    identical. `unit/cooling` is updated.

### 1b. Ships see what they pass (item 9)

- **Today:**
  - Only settlements, Shared Watch partners and stopped fleets detect stars
    (`updateDetection`, `fleets.ts:251`).
  - A probe sees 180 ly; 450 with Deep Survey Optics; 6,000 with Catalysed Drives.
  - A fleet under way is a straight lerp in true light-years (`advanceFleets`, `fleets.ts:104`)
    and sees nothing.
- **The rule:** a fleet under way sees with the eyes it has when stopped.
  - Every star within its range of the stretch it crossed this turn becomes detected
    (`known` 1).
  - A survey still needs a stop, so no survey draws happen en route, and no relics, finds,
    tombs or neighbours' homes are found early.
  - The void's outliers stay hidden.
  - Each civilization's fleets do this for their own map.
- **Why it doesn't break the game.** It matters only in roughly the first 10 to 30 Dusk turns:
  turns start at 40 years and grow ×1.27, and from the Degenerate calendar settlements already
  see 3×10⁵ ly. Hunger nests along the way show, as a fair warning.
- **First a census:** how many stars a probe from home to the Heart detects, at 180 and at
  450 ly. It passes within 55 ly of the Heart's seven core systems, but the reaches are scattered
  over about 20,000 ly. If it is almost none, I tell the player with the numbers before
  building anything.
- **What it touches:**
  - `autoExplore` (`fleets.ts:318`) targets detected stars, so the harness moves: run 300 and
    900 games.
  - What's seen goes into one toast a turn, not one per star.
  - `Manual.tsx:55` and DESIGN.md are updated.
- **Check:** `unit/en-route` covers a star just inside range, one just outside, the outliers,
  and no survey draw.

## Part 2: the civilizations play the same game (items 1 to 4)

### The architecture: one rulebook, one pointer

**Every civilization gets what the player has:**
- a `Civ`: reserve, matter, accord, resolve, dissent, Thread standings, techs, research,
  charters, Taint and flags;
- settlements and fleets with an `owner`.

**A single-pointer perspective swap.** First a codemod moves into `Civ` everything that belongs
to one civilization: `signals`, `forecasts`, `pending`, `log`, `crossing`, `outcome` and `fired`,
about 91 references. Then `asCiv(state, id, fn)` swaps one pointer, `state.civ`.
- The roughly 480 `state.civ` references (plus about 335 through local aliases) keep meaning
  "the civilization whose turn it is".
- A save stores `civs` and `player` only. On load, `state.civ` is pointed at
  `civs[player]`, so no object is ever written twice.

**Flags go where they belong:**
- **Universe facts move out of `civ.flags` into `state.flags`:** `halo_drawn`
  (`physics.ts:235`), `matter_gone` (`fate.ts:43`), `flowed` (`flow.ts:28`), `star_flash`
  (`physics.ts:548`).
- **Per-civilization facts move out of `state.flags` into `civ.flags`:** `first_swarm`,
  `hunger_woke` (`hunger.ts:53`), `decay_lost` (`turn.ts:665`), `gfe_prev` (`forecast.ts:162`),
  `tut`.

**Settlements and fleets stay in one map each, with an `owner`.**
- `colonies(state)` and a new `fleets(state)` return the active civilization's own.
- Direct lookups by id still find anyone's.
- Questions of "is anyone here?" use `b.colonyId`.
- **The Deep becomes one per civilization per system:** an owner's Deep body is created on
  demand. Today a system has a single Deep, and `migrateToBlackHoles` merges every vault into
  whoever holds it (`crossing.ts:41`).

**The turn, split where it really splits** (`turn.ts`):
1. **Each civilization's phase A,** under `asCiv`: economy, starvation, research and works,
   growth, society, its fleets' moves and orders.
2. **The universe, once.**
   - `declineWorlds` and `scorchWorlds` run a single time but read every owner's settlements.
     Run once per civilization, core heat would fade ×0.8 per civ (`turn.ts:102`).
   - Then `evolveUniverse`, swarms moving, the other minds.
3. **Settled for everyone at the same time:** battles, contested settling and swarm strikes, so
   that turn order decides nothing.
4. **Each civilization's phase B:**
   - the consequences of the universe's notes for its own settlements (`handleNotes`,
     `evacuate` giving evacuees to their owner);
   - the Long Flow and Continuity;
   - its signals, forecasts and events.
5. **Crossings:** one transition of the universe (`state.era` advances once), then each
   civilization's losses, with its preparation measured before any loss.

**Owners everywhere the code assumes "ours":**
- Swarm collisions and `defenseAt` count only the owner's defence.
- Communion and Blackout shield only their own civilization.
- Salvage and tamed yield go to the owner; `Swarm.tamedBy`.
- Beacons have owners.
- About 20 actions in `actions.ts` check that the thing is the player's.

**The other minds stay the player's alone.** The Unlit, the Slow Ones, the sleepers and the
ghosts keep their quest lines word for word.
- `updateMinds` runs only under the player's perspective.
- The `makeGesture` call in `planSignals` (`auto.ts:417`) is never made for AIs.
- The Aeon Seed's rule checks that the settlement at the Heart is the player's
  (`endings.ts:20`).
- AI surveys leave relics and the sleeper vault untouched.
- AIs never research or run Halo Siphons: their research fallback honours `noAuto`.

**Events for AIs** are a whitelist, an `EventDef.scope`. Each civilization has its own
`homeworld` trait (`data/events.ts:205`). AIs never answer star-clock events.

**Messages between civilizations** go through `deliver(state, to, …)` into an outbox emptied
after every civilization has had its phase. `sendSignal` gets a `to`.

**Time stays the player's.**
- The turn length is one for everyone: AIs never change the pace.
- The turn step is computed once and passed in (`flare.ts:55, 363, 409`).
- When the player slows below an AI's Threads, the AI feels the tempo strain like anyone. This
  bend gets a Codex line.

**Guard rails:**
- `asCiv` uses try/finally and refuses to nest.
- `assertPlayerView` runs in `bump`, `serialize`, `autosave` and the UI's action wrapper.
- In checks, `asCiv` deep-freezes every other civilization, so a cross-write throws at its own
  line.
- A source-lint unit check forbids raw `Object.values(state.colonies)` and
  `Object.values(state.fleets)` (18 and 43 sites today), `state.signals.push`, and the moved flag
  names.
- `unit/determinism` stays the tripwire.

**Performance.**
- Spatial indexing buys nothing: a late save has about 148 systems and 429 bodies. The cost is in
  deciding, because `project()` runs 3 to 5 times per `autoPlay` (`auto.ts:154, 301, 448`).
- So AIs skip forecasts, pace, minds and clocks, and `computeMods` is cached per `Civ`.
- **End Turn yields to the browser between civilizations.** The synth schedules notes only 0.3 s
  ahead (`music.ts:586`), so a single 250 ms block would bring back the crackle on the player's
  phone. Each civilization's phase stays atomic; the swap never spans a yield, and the UI
  doesn't redraw until the turn is done.
- **Targets:**
  - no single block over about 50 ms on the phone emulation (CDP, CPU slowed 4×);
  - the whole End Turn under about 300 ms there;
  - 300 harness games under 15 minutes on three cores.

**Generation.**
- The survivors block keeps its exact draws (`gen.ts:554-594`): two shuffles, then `pop`,
  `health` and `disposition` for each. Those three now seed the starting size, resolve and
  regard.
- Each AI's capital world, character and first ships come from its hashed stream, after
  everything else.
- A home with no world Kin can live on gives a garden domes and warrens, as our own dying world
  does. No world is changed.
- At most 4 AIs (`gen.ts:558`). A Thread that forks from an AI rejoins the world as people, not
  as a new civilization.

### 2a-0. The same game, nothing changed yet

This is a refactor with zero behaviour change. It brings in civs, owners, the single pointer,
the flag moves, the outbox and the turn split, while keeping today's light neighbours.

The gate: all 900 harness games come out identical to before. Only then do the AIs start
playing.

### 2a. The AIs play

- **Data.**
  - Today's `Survivor` record becomes a full civilization: its identity, way of life and colour,
    plus a `Civ`.
  - Each relation between two civilizations holds regard, memory, pacts, war, beams, news and
    proposals.
  - The relationship keys in `civ.flags` (`trade_next_<id>`, `raid_last_<id>`,
    `pact_aid_out_<id>` and the rest) move into the relations.
- **Toward the player, a `Neighbour` view.** It is derived from the AI's real `Civ`, with what
  today's card shows, so `Signals.tsx` changes without a rewrite from zero.
  - Between AIs, this first version has regard, pacts, war and news only.
- **Decisions.** `autoPlay`, run under the AI's perspective, plus per-way data overrides:
  - the research order;
  - build lists;
  - Thread moves (gardens keep their Kin; upload, merge, sleep);
  - charters;
  - how far to expand;
  - pacts;
  - a temperament from the id: caution, generosity, ambition.
- **Ways of life emerge from the Threads.** Each starts with a mix led by its way, and its own
  choices move the mix. A garden under pressure can upload some of its people and still be led by
  its Kin, "dominated by it in an organic way, not forced".
- **The Lattice can think a little and keep agreements: the player's choice, for everyone.**
  - Today the Lattice makes neither insight nor accord (`data/threads.ts:69`). A Lattice-led
    civilization like the Tessellate could never research, enact a charter, make a pact (pacts
    cost accord) or declare war (an accord vote).
  - **The changes:**
    - Lattice insight goes from 0 to 0.3 and accord from 0 to 0.1, in the Thread itself.
    - A **Search Foundry**: the Lattice turns industry into insight by brute-force and
      evolutionary search, at a poor rate (about 4 to 1).
    - A **Protocol Registry**: industry into accord, as agreements kept to the letter.
    - Our own Lattice gets all of it too. DESIGN.md's "No insight" changes to say so.
  - **Balance** (the player asked). A census of 24 autoplayed games, read-only: our civilization
    is barely Lattice (0.2% of its people in the Dusk, 0.7% in the Degenerate Age, about 5% in
    the Black Hole Age and the Dark Era). So 0.3 and 0.1 add only about 1% to its base insight
    and 4% to its base accord late: the harness will barely move.
  - The effect lands on Lattice-led civilizations: the Tessellate, and a player going for the
    Quiet Lattice.
  - So `tools/sim.ts` gains a Lattice-led strategy, and the two structures' rates and upkeep are
    tuned until two things hold:
    - the Tessellate survives about as often as the other ways;
    - the Quiet Lattice is reachable but no easier than the other endings.
  - A lever kept in reserve: the Foundry's search feels tempo strain, so the Lattice's immunity
    doesn't make late research free.
- **Plight** (0 to 1, from turns of reserve left, starving settlements, falling people and low
  resolve) belongs here. Today's pleas and refuge depend on it, and 2b judges by it.
- **What we see stays at light speed.**
  - Their settlements and fleets appear once the light reaches our capital, drawn in their
    colour and with a shape of their own, never selectable as ours. The galaxy and system views
    filter by owner (`galaxyView.ts:487`, `systemView.ts:641`).
  - The ship prompts leave them out (`turnflow.ts:22, 88`).
  - Hovering names only what we have seen (`main.tsx:46`).
  - The card shows the age of what we know.
  - `addHabitats` (`systemView.ts:405`) is the template for their settlements' looks.
- **Today's neighbour behaviours** (pleas, refuge, expansion, ways that meet, dealings) are
  re-expressed on the shared rules, keeping what they mean.
  - `claims.ts` becomes ordinary settling: anywhere, by the same rules.
  - Fix the four misfires on messages from civilizations already gone: refugees who still
    arrive, a shared work that still costs, a trade that still delivers, and the Choir's refusal
    that still costs standing.
- **Checks.**
  - New: `unit/same-rules`, `unit/civ-turns`, the source lint, `browser/civ-card`.
  - Rewritten: `neighbours`, `claims`, `dealings`, `refuge`, `ways`, `war`, `invariants`,
    `determinism`.
  - Updated for the moved flags: `beacon`, `hunt`, `attack`, `siphons`, `embers-dim`, `flow`,
    `last-star`, `dismantle`.
  - Updated for the new storage: `save-all`, `lean`, `lowvision`, `mobile`.
  - Retired with the old format: `old-saves`, `savecompat`.
- **The harness.**
  - `tools/sim.ts` adds each civilization's outcome.
  - It keeps the `seed N: OUTCOME … fate X` lines that `tally.sh` and the comparison script
    read.
  - The balance reference starts again here.

### 2a, as it is being built (13 Oct, added while building it)

Part 2a in steps, each validated and pushed on its own, so the harness can tell what moved what:

1. **2a-0, one rulebook** (done): the civilizations, the pointer, owners, flags, `asCiv` and its
   guard, each one's own dice, the outbox, the turn and the crossings in parts. 900 games
   identical.
2. **2a-1, owners everywhere** (done): the clock the player's; the swarms by each one's charters,
   defence and Record; actions on one's own only; beacons, the Deep, the Long Flow, events' scope;
   the minds, ruins and finds the player's. Nothing changes with one civilization.
3. **2a-2, the others become civilizations** (done). Each neighbour gets a Civ of its own (same
   id as its Survivor record), made after everything else is generated and drawing nothing: its
   capital on a world of its home (the most livable for gardens, the warmest for sleepers, the
   richest and warmest rock for minds and the Lattice, which need ground to mine and warmth to
   tap), people of its way (a Chorus with Echoes still to gather), and a start like ours scaled
   by its `pop`, by the same rules: every structure where it may be built, its research known,
   about our energy and matter to spare, or matter in store where its ground gives none. It
   plays every turn: the autoplayer under its own perspective at the start of its part, then the
   same parts as ours. As built, it needed some of what 2a-5 was to give: each way's needs, for
   the neighbours alone (room for its own Threads, settlers of its own, defences when a swarm is
   near, the Chorus gathering its Echoes, the sleepers keeping two awake), so that they live as
   their ways allow. Its Survivor record stays as the relation and the identity, with `pop`,
   `health`, `systems` and `alive` read from its civilization each turn, so that today's
   messages, pleas, raids, trades and pacts keep their meaning on real numbers, and what they
   move is real. A `civsAsleep` switch keeps them from playing (`--asleep` in the harness). The
   harness's baseline starts again here, with each civilization's end printed.
4. **2a-3, relations**: regard, memory, pacts, war, beams, news and proposals per pair; the
   relationship keys in `civ.flags` move there; between AIs, regard, pacts, war and news. The
   dealings set by real economies (2a-2 capped them at their old size, `dealSize`): what a joint
   work, Open Archives, aid and trade give comes from what the civilizations really have.
5. **2a-4, seen at light speed**: their settlements and fleets on our map once their light
   reaches our capital, in their colour; the views, prompts and hover filtered by owner; the card
   shows the age of what we know.
6. **2a-5, minds of their own**: per-way strategies beyond the needs 2a-2 gave them (each way's
   Great Work, gardens terraforming, the sleepers sleeping through hard times, and what the light
   neighbours did that real ones do not yet: the sleepers' race for new stars, the Black Hole
   Age's spin as a commons), temperament, plight, the Lattice's insight and accord with the
   Search Foundry and Protocol Registry (and the Lattice-led strategy in the harness to tune
   them), AIs' Forks rejoining the world as people, the event whitelist, each civilization's
   homeworld. As built:
   - **The Lattice thinks a little** (`6b6c04e`): 0.3 insight and 0.1 accord a Lattice; the
     Search Foundry and the Protocol Registry, taking industry first, built by the Tessellate only
     where a settlement makes three times what they would draw (taking it everywhere, they starved
     its building: the Lattice-led strategy showed it).
   - **Minds of their own** (`b299f6a`): each way's research lead and its own Great Work only; the
     sleepers' Long Sleep through hard times and their race for a new star (we hear when their Ark
     sets out); a temperament from the seed and the id (caution, generosity, ambition); a Fork
     from another civilization goes its own way; a hole's spin a commons drawn by real harvesters.
     Gardens terraform as before (Terraforming is now among the first they learn).
   - **The event whitelist**: the events of ordinary life (who sleeps first, the prophet of
     stillness, a derelict ark, the first upload, drift, an invitation to merge) and the Dark Era's
     (forgetting, the widest atoms, the false vacuum) come to everyone.
   - **The homeworld's story stays ours.** Its events (the last rain, the sea freezing over, the
     mantle settling, the superflare, the comet) are about a world born with a failing dynamo, a
     tidal lock and a substellar sea, which the others' capitals were not; they follow the general
     rules of their worlds instead (life fading with their star, as every world's does).
   - **Plight** moves to 2b, which is the first to judge by it; until then pleas and refuge read
     each civilization's health, as its record says.
7. **2a-6, the checks, the numbers and the time**: the rewritten and new checks listed above, the
   harness by civilization, the balance reference; End Turn yielding to the browser between
   civilizations, measured on the emulated phone (after 2a-2 a turn costs about 7 ms on average
   here, 14 at the 95th percentile, 43 at worst, against 4.5, 9 and 46 asleep).

### 2b. The Hunger in civilizations, and diplomacy

- **Taint for everyone,** by the same rules as ours: Hunger techs, dark charters, devouring.
  - The AI's blanket refusal of anything tainted (a regex at `auto.ts:435`) becomes a decision:
    a desperate AI with the temperament for it takes Hunger steps; others don't.
- **Judging a Hunger act** (the player's note).
  - News of each act (researching a Hunger tech, enacting a dark charter, devouring) travels at
    light speed. It weighs `w × (1 − 0.7 × plight)` as of the act, so the desperate are judged at
    30%.
  - Using some Hunger technology at low Taint, Hunger Engines say, is only a small, slow drift:
    "should not make everyone hate you".
  - Today only devouring, seizing, raiding and war are heard.
- **Everything reads the Taint others have heard of,** not the true value. Today's ceiling reads
  the true Taint (`survivors.ts:193`).
- **Sanctions** start at about 30 seen Taint, from civilizations not on the Hunger's path. No new
  pacts or trade, Open Archives may end, and they say why.
- **At about 60** the corrupted civilization's character turns aggressive: devouring the weak
  becomes worth it to it.
  - Everyone else gains a just cause, "the Hunger in them". A war on that cause carries no
    infamy, and coalitions form.
- **At 100** an AI becomes the Hunger.
  - Its capital buds one swarm, within `MAX_SWARMS` (`hunger.ts:16`), and its other
    settlements go dark.
  - For the player, 100 stays the Hunger ending.
- **Trade.**
  - Today the offer just follows our current project, or the cheapest open one, with no Taint
    filter (`subject()`, `dealings.ts:67`). Open Archives notes do the same (`pacts.ts:228`).
    That is how Hunger Engines and Communion came to be offered.
  - A civilization under about 30 Taint never offers anything tainted.
  - A corrupted one may, with the offer marked, and accepting is a Hunger act.
- **Checks:** `unit/hunger-judgement` (the same step by a desperate and by a prospering
  civilization), `unit/hunger-trade`, `unit/just-cause`.
- **As built** (13 Oct):
  - Every rise in Taint is a Hunger act (`judge.ts`), these too: communing, a point of Taint at a
    time; taking a swarm in; notes on Hunger knowledge, in trade or from Open Archives; the
    events' Taint choices. A fall is the taker's alone. `unit/rulebook-lint` keeps it so.
  - Between the others the same rules: what one has heard of another's Hunger lowers its regard
    for good (it never drifts back above what that allows), and past 30 it makes no pact with it
    and closes its archives to it.
  - At 60 of its own Taint the aggression is toward us for now: such a civilization raids anyone
    it does not count a friend. Wars between the others, their coalitions and devouring belong to
    2c (war between any two civilizations).
  - At 100 another's game ends as ours would: its capital buds a swarm, its settlements go dark
    the next turn, and it sends no last transmission (fate `hungered`).
  - A civilization of its own offers notes only on what it knows, by the same rules: offers fell
    by more than half, and our autoplayer, keeping the energy it paid for them, wins more often
    (CHANGELOG, part 2b). Our autoplayer declines Hunger knowledge, as it declines every Hunger
    step.
  - The others rarely go far: about a third take a step, mostly Consume the Dead; in 900 games
    none passed 45 Taint, and none became the Hunger.

### 2c. War, units, conquest

- **War between any two civilizations,** generalising `war.ts`. It keeps the accord vote, the
  resolve and dissent costs, infamy at light speed, coalitions, and war heat that draws the
  Hunger.
- **Why it rarely pays.**
  - Warships cost upkeep, and launches and battles burn energy.
  - Taking or razing a settlement spends galactic free energy in proportion to what it held.
    That free energy scales every source, the conqueror's too.
  - **Galactic free energy becomes a true commons** (`state.gfe`). Every civilization's
    overdrive, Stellar Lifters, dark charters and devouring spend it by today's rules, and
    conquest is added to them.
  - The Codex says plainly that one shared pool is the game's own device. The thermodynamics
    behind it is real: burning fuel faster than it must burn leaves less to use later. But
    nothing physical dims a brown dwarf here because a swarm fed over there.
- **What war is still for:** the desperate seize stores to live; the corrupted devour; the rest
  stop a corrupted civilization.
- **Conquest.** A taken settlement changes hands with damage. Some of its people flee, and the
  rest come with low standing. Or it is razed.
  - Conquering everyone is possible and isn't a victory: the game goes on, and the Record says
    so.
- **Space and time.**
  - From the Degenerate Age on, fleets and light both cross the galaxy within a turn, so fronts
    and blockades belong to the Dusk.
  - Nothing can be caught en route, since the flight is a straight lerp. Screening is a property
    of fleets stopped at the target.
- **The roster** (`data/ships.ts`). Today there are only the Warden (attack 3, hp 10) and the
  Aegis (8, 30). Strength is the sum of attack, and hp is never repaired.
  - Every class gets strengths against ships, settlements and swarms, a screen value, plus hp,
    mass, upkeep and signature.

  | Class | Role |
  |---|---|
  | Picket (new, early) | eyes and screen: cheap, fast, widens detection, stops raiders and strikes at its star |
  | Warden | line, as today |
  | Aegis | heavy defence, stronger dug in |
  | Breacher (new) | siege: needed to assault a settlement behind Defence Grids or a Bastion Shell |
  | Hunter (new, after Hunger Studies) | twice as strong against swarms and a corrupted civilization's ships |
  | Kinetic Lance (new, after Relativistic Arks) | a one-use strike at a settlement, stopped only by screens there; heard everywhere; spends galactic free energy |
  | Leptonic Wraith (new, after the end of matter) | the only warship possible once matter is gone; drawn in code as a field (Part 3) |

  - The Lancer and the Penrose Corsair are deferred, not dropped: they come later, if the combat
    model has room.
  - **Limits on the Kinetic Lance:** one in flight per civilization, a long build, and the strike
    is announced by its own light.
- **Combat.** Once a turn, settled for everyone at the same time.
  - The odds are shown before committing (the `attackOdds` pattern). Losses fall on hp.
  - Counters: screens stop strikes and raids, a siege needs Breachers, Hunters hunt.
  - Ships repair slowly at a Shipyard.
- **Sprites.**
  - Check the Higgsfield cost per image first (`models_explore get`; 6.5 credits). Spend them on
    the Picket, the Breacher and the Hunter, through `tools/process-sprites.mjs`, and show each
    to the player first.
  - Whatever the credits don't cover is drawn in code. For the Wraith that is the point.
- **Checks:** `unit/war-costs` (a conquest lowers galactic free energy as stated),
  `unit/battle-roles`, `unit/simultaneous` (turn order decides nothing), `browser/war-ui`.

### 2c, as it is being built (13 Oct, added while building it)

In steps, each validated on its own:

1. **2c-0, one strength per role** (done, `60d0617`): every fleet strength through
   `strength(cls, against)`, against ships, settlements or swarms; 30 games identical.
2. **2c-1, the roster's first ships**: the Picket (eyes, a screen) and the Hunter (twice a
   Warden on swarms); each warship's upkeep, screen and dug-in strength (the Aegis three times);
   a Shipyard mends. The Breacher and the Kinetic Lance come with what they are for (2c-3). As
   built, upkeep like a structure's cost the autoplayer its one escort's worth in the Dark Era
   (as much as its whole net there): it now stands idle warships down after the Dusk once they
   cost more than 15% of a turn's gain, with no war and no swarm in reach.
3. **2c-2, war between any two civilizations** (done, `ab6bd75`): the war state on each tie; the
   AIs declare it on the plan's causes; space battles once a turn, settled at once for everyone
   (hashed luck, never the dice); a siege at any settlement, not only the first star. 900 games
   identical to 2c-1, game for game: no war started in any of them.
4. **2c-3, conquest** (as built): a settlement at a time, by the same rules for everyone (ours
   through `seizeSurvivor`, the others' in the battles): the siege held, its walls breached (a
   Breacher behind a Defence Grid or a Bastion Shell), an assault on a draw against what it
   holds. Taken, three tenths of its people flee to their own, structures keep 70%, its hearth
   damaged; or razed. Galactic free energy pays for every person and structure it held; without
   a cause it is a Hunger act; the war goes on at the enemy's next settlement; the last one ends
   that civilization ('Conquered', a defeat of ours too). The Kinetic Lance: at 99% of light, one
   in flight at a time, free energy spent at launch, a world's settlement struck down whole and
   one in the Deep by half, turned aside only by the screens of the target's ships waiting there
   (a bend the Manual states). The AI builds a Breacher against a walled front.
   - **Left for 2d:** the AI's use of the Lance, and Pickets kept at its settlements once an
     enemy could have one; a defender's own sieges (in a war the other side began, it fights
     where they come, and cannot storm theirs).
5. **2c-4, the interface and the checks**; **2c-5, the sprites** (Higgsfield: 6.5 credits on
   the basic plan, checked 13 Oct; each shown to the player before it goes in).

### 2d. The AI's judgement, and the numbers

- **Mostly peaceable.** A civilization weighs war only when:
  - it is desperate (plight from about 0.6);
  - it is corrupted (Taint from about 60);
  - it has seen a corrupted neighbour;
  - or it is attacked.
  - Even then it weighs the odds and the costs, galactic free energy included. It lives in a
    small war module beside `autoPlay`.
- **Better play,** which also helps the harness:
  - each way pursues its own Great Work;
  - gardens terraform;
  - fleets defend and escort;
  - sleepers sleep.
- **Harness reports:** our survival; each way's survival; wars a game, who started them and why;
  conquests a game.
  - The aim is that most games have no war, and that most wars are started by the desperate or
    the corrupted.

### 2d, as it is being built (13 Oct, added while building it)

Where it starts: in 900 harness games after 2c-3, no war starts at all. The causes built so far (60
Taint heard in a neighbour, or 60 of one's own) are never reached; Hunger steps stop by 45 (2b).
Already done in 2a-5: each way's own Great Work (`WAY_WORK`), gardens terraform, sleepers sleep
(`planSleep`).

1. **The desperate's war** (as built): desperate five turns running and bold (caution under 0.4),
   it looks to the richest neighbour within reach (five turns of its capital or a fleet), three
   times as well stored, not desperate, not a friend, with no pact, while the galaxy's free energy
   is above a fifth. It goes only once its warships carry half again all it would meet there (the
   front, and every warship of the target's, counted dug in) and a fleet can pay the launch; it arms
   until then. It takes, never razes, carries off what its sieges drain (for everyone now), and makes
   peace once it has taken a settlement or its plight has eased. The first, looser version made
   empty wars (no fleet able to pay its launch, one warship against a defender dug in at home); the
   strict one makes few, and real ones.
2. **Defence against the Lance:** once an enemy knows Relativistic Arks, a civilization keeps a
   Picket at its capital (screens), and the most screened settlement is the one it holds closest.
3. **The corrupted use the Lance:** only those far down the Hunger's path (60 Taint of their own),
   at war, on an enemy's largest settlement they can see.
4. **Each war's why in the harness:** who began it, on whom and for what (`*N` with its cause:
   Hunger, corrupted, desperate), conquests, Lance strikes; the aim stays most games without war.
5. **Then the numbers:** 900 games, by fate and by way, against 2c's reference.

## Part 3: life after matter, and positronium (items 6 and 7)

This part comes after the civilizations, so its rules apply to everyone. All of it is
speculation, and the Codex says so.

### Part 3, the order it will be built in (13 Oct, written before starting it)

Each step validated on its own, with the harness by fate:

1. **3-0, the end of matter as it is, fixed** (the bugs listed under 3b): minds carried over by
   the protocols counted as lost too, the Chorus counted twice, the forecast's promise, the
   protocols' description, the Bastion Shell's placement, Horizon Vaults deleted at the end of
   matter, a disk drawn at full heat after it.
2. **3-1, forms:** `Colony.form`, baryonic until the end of matter, leptonic after it for what
   survives on decay-proof substrate (who may live there, a leptonic Confluence Node for the
   Chorus). Nothing else changes yet.
   - As built (13 Oct): decay-proof work under way stays in the queue. Tried and moved to 3-3: a
     system dissolving before the Great Decay making what was re-encoded there leptonic at once
     (stranded without its sources until the Migration, it cost 15 decay survivals of 450). Then,
     the player's word the
     same evening ("there should be a way to continue with Lattice even with just energy"): after
     matter the Lattice mends and grows with energy, at construction's rate, and only an empty
     reserve wears one out. Before, with no matter left, one wore out every turn and none grew.
3. **3-2, the Passage:** the conversion over several turns, Field Stores (the reserve's home), the
   Kin's pattern archive, the Lattice at half; the AI's rule for it; the crossing report naming
   each settlement lost and who was in it.
4. **3-3, the Thinning:** structures still made of matter failing one by one, matter yields
   falling, the forecasts and the Record naming what goes. Under decay, what was re-encoded in a
   system that dissolves before the end goes leptonic then, and drifts to a black hole at once
   (tried in 3-1 without the drift: stranded, it cost 15 decay survivals of 450).
   - As built (13 Oct): the share of matter gone runs evenly from η 37.5 to 39 (decay) and 87 to
     89.5 (curvature); each structure of matter fails with the chance that keeps the share standing
     at the share left; matter yields scale by it; the drift goes to the nearest hole with spin, as
     the Migration does (`sim/thinning.ts`, `goOnAlone` in `crossing.ts`).
5. **3-4, the Horizon form:** written into a hole's horizon, bound to it; when it evaporates, to a
   larger hole, another form, or the final burst.
6. **3-5, positronium:** the form, the nets, the decay's countdown, Leave the weave, the two events.
7. **3-6, the stable fate's late game:** iron stars, black dwarf supernovae, tunnelling collapse.
8. **3-7, the look:** the leptonic lattices, the horizon arcs, the positronium ellipses, the map's
   ring, the dissolve; every quality tier, with screenshots asked about first (the player has not
   reached that far).

### 3-2, as it will be built (13 Oct, written before starting it)

1. **A leptonic form for some structures** (`StructureDef.leptonic`, with a name of its own where it
   changes): Energy Vaults are Field Stores there and Deep Storage Rings Deep Field Stores (the
   reserve's home after matter); Substrate Cores, Cold Vaults, Lattice Foundries and Confluence
   Nodes house the same minds; Burst Catchers, Horizon Vaults, Penrose Harvesters, Hawking
   Collectors, the Lattice's Search Foundry and Protocol Registry, Defence Grids and the Dark
   Era's structures work as before. Nothing else: mines, domes, collectors, plants, foundries,
   shipyards are matter. A leptonic settlement builds only these, and the decay-proof ones.
2. **Begin the Passage** (a settlement's project, in its queue, once the end of matter is foreseen
   and Leptonic Computation is known): 40 industry and 15 for each structure that crosses over,
   5 energy for each structure paid up front; while it is worked the settlement's energy, matter,
   insight and accord fall to 70%. When it is done the settlement is leptonic: what has a leptonic
   form crosses over, the rest is taken apart (its matter back, as dismantling gives); its Kin and
   sleepers are lost, their patterns kept in the archive (20 insight each); the Lattice re-encodes
   at half (a quarter under the protocols), once.
3. **At the end of matter** a settlement that passed keeps everything it has; one with only
   decay-proof structures keeps only those, as now; the rest go, each named in the report with
   who was in it.
4. **The autoplayer** begins the Passage where it can finish before the end, with a few turns to
   spare, by the turns left (from the turn's length) and the settlement's industry.
   - As built (13 Oct, `24fbc18`): by turns it began Passages fifteen decades early (a slow pace,
     and the general rush finishing one the turn after it began), and 59 more games of 900 were
     lost. It now counts decades, done about two before the end, rushed only in the last three
     if behind. Three things the end of matter's survivors lacked came with it: the Migration to
     a hole with spin left, a starving civilization cooling its Echoes, and after matter the pace
     that drains least a decade. 900 games: 530 / 219 (431 / 133 before the Passage).
5. **Checks:** `unit/passage`; the reserve after matter in it (Field Stores carried over).

### 3-4, as it will be built (13 Oct, written before starting it)

1. **Leaving a hole:** a leptonic settlement at a black hole can drift to another (an action on its
   panel, a turn and some energy), to a hole we know with spin left; it joins our vault there only
   if it is of its own form. The autoplayer leaves a hole drained of spin, or one that will
   evaporate within a few turns, for the best hole it knows. Before, a vault stayed at its hole,
   drained or gone, for good: the Black Hole Age's promised rhythm, "move as small holes
   evaporate", had no way to happen.
2. **The Horizon form** (speculative, and the Codex says so: a horizon holds more than anything
   else of its size, and time runs slowest at its edge): a leptonic settlement in a hole's Deep can
   write itself into the horizon, a project like the Passage, after a Black Hole Age tech of the
   mind. There its minds cost a tenth of their upkeep and think at a quarter of their pace (a turn's
   work a quarter as much), and room grows with the hole's mass. It is bound to its hole: it cannot
   leave it, and when the hole evaporates its minds pass to our vault at a larger hole as far as it
   has room, or are written back out as leptonic (half the Lattice lost, as ever) and drift; with
   no hole left, they are lost in the final burst. At the Last Horizon, with no holes in the Dark
   Era, every horizon settlement is written back out as leptonic.
3. **The autoplayer** writes into the horizon where its reserve would not last the age at its
   pace and the hole will outlive it; leaves it as above.
4. **Checks:** `unit/horizon-form`; the harness by fate.

**As built** (13 Oct), where it differs:
- The drift goes to the hole with the most spin to give (100 at least) that will not evaporate
  within 5 decades, the nearest of equals, for 5 energy a structure (at least 10), once a turn:
  after matter any hole is a turn away, and the first try (the nearest with spin) had vaults
  hopping between small holes they drained in a turn or two. A settlement that made the Passage
  on a world can drift too: what is leptonic gathers energy only at a hole.
- Its hole evaporating, a horizon settlement is written back out and drifts to the hole above,
  joining our vault there whatever its room; if no hole will take it, it stays, leptonic, where its
  hole was, rather than being lost: the Codex has what falls in come back out in the radiation.
- Room in the horizon: 6, and 6 more for each decade of the hole's mass in Suns, for each Thread
  the form houses. The writing costs 40 industry and 4 a mind, 5 energy a structure. Horizon
  Writing: 900 insight, after Horizon Cognition.
- The autoplayer counts the turns left in the Black Hole Age at our pace against its reserve and
  net, and writes in only at a hole with ten decades or more to go.

### 3-5, as it will be built (13 Oct, written before starting it)

1. **The window:** positronium forms at η 85 where protons decayed or space unmade matter, and
   decays at η 141 (Page & McKee's reference case). That is 14 Black Hole Age turns and 5 Dark Era
   turns at the Tide; at a pace ten times slower 8 and 4, the last Dark Era turn jumping from
   η 139.5 to 192, so every countdown counts turns at our pace.
2. **Positronium Weaving** (a Black Hole Age tech of the mind, speculative, after Horizon
   Cognition): a leptonic settlement is woven through the positronium as a project in its queue
   (industry and a few for each mind, energy for each structure, 70% of its yields while worked),
   inside the window only. A tech rather than the event's choice (the plan said "gains the choice
   that opens the form"): an answer given once would otherwise close it for good, and the tech is
   how the Horizon form opens too.
3. **The Positronium form:** minds cost a fiftieth of their upkeep and do a tenth of their work,
   with no tempo strain, and each Thread the form houses has 30 more room. It is bound to no hole:
   its hole may evaporate and it stays. In the Dark Era, Continuity's loss each turn falls by half
   the share of our minds in the weave. Its structures stay and work (its Field Stores still hold
   the reserve).
4. **Leave the weave** (the settlement's panel; no research, no event): the turn's end brings it
   back, leptonic, for 2 energy a mind. Only minds still in the weave when it decays are lost,
   named in the Record; a settlement with no one left goes.
5. **The countdown:** a forecast of the decay in turns at our pace, from the weave's opening,
   "danger" while anything of ours is in it.
6. **Positronium Nets** (the same tech; leptonic, at any leptonic settlement): energy from the
   shrinking orbits, a trickle from η 85 growing toward η 141; after it the never-ending
   annihilation, half the turn before each turn, so it adds up to a fixed amount (as much again as
   the last turn's).
7. **Events:** "The Widest Atoms" loses "Nothing we do can touch them", and says minds could be
   woven through them and their light gathered (Study them, Let them be, as before). Near the
   decay, "The widest atoms end", for whoever has anything in the weave or nets.
8. **The autoplayer:** researches it only where positronium will form and something of ours is
   leptonic; weaves a vault in where its reserve would not last the Dark Era at its net, leaves
   when the decay is within the next two turns at its pace, and builds nets.
9. **The Codex:** the reference case and the spread (Adams & Laughlin's book: from about η 71,
   centred on the 100th decade, decay after about 145; Wikipedia's 10⁹⁸ and 10¹⁷⁶ years); minds
   woven through atoms wider than the old observable universe are the game's speculation; under
   curvature, positrons from unmade matter are a bend.
10. **Checks:** `unit/positronium` (the window, the form, leaving, the loss at the decay, the
    nets' total as stated, the autoplayer); `browser/weave`; the harness by fate.

**As built** (13 Oct), where it differs: leaving the weave is at once, not at the turn's end (one
click before the turn that would cross the decay is enough, and the warning comes the turn before
it), and never refused for want of energy (it costs what is left); the weaving is refused once the atoms have decayed, and a weaving finished too late does
nothing. Nets give 40 over the window and 20 after it, each.

### 3a. Ways of existence

Each settlement has a **form**, `Colony.form`. The form decides who can live there, what feeds
it, how it looks and what can end it.

- **Baryonic:** today's settlements.
- **Leptonic:** minds and works re-encoded in electron–positron structures held by fields.
  - Today this exists only as two buildings, the Leptonic Substrate and the Bastion Shell
    (`decayProof`).
  - Echoes, Coldminds, Lattice and Chorus can live there. A leptonic Confluence Node gives the
    Chorus room: today the Chorus is always lost, so One Voice can't happen after matter.
  - Kin can't live there.
  - It outlasts matter and lives on black holes' spin and Hawking glow.
- **Horizon** (the "horizon thingy"): minds written into a black hole's horizon.
  - Its upkeep is next to nothing, its clocks are very slow, and its energy is right there.
  - It is bound to its hole. When the hole evaporates, its people pass to a larger hole or
    another form, or end in the final burst.
  - That gives the Black Hole Age its promised rhythm, "move as small holes evaporate".
  - No holes are left in the Dark Era, so this form ends there.
- **Positronium:** minds woven through the widest atoms (3d).

### 3b. The Passage: the transition, and those who don't prepare

- **It reuses what exists.** Decay-proof structures are the anchor. **"Begin the Passage"** is a
  conversion action that takes several turns, paid in industry and energy, with output falling
  while the settlement is rewritten.
  - Each structure with a leptonic form crosses over; the rest are taken apart.
  - Kin who haven't uploaded are lost, or kept as an archive of patterns worth insight.
  - The Lattice re-encodes at half.
- **When it opens:** once the end of matter can be foreseen (the Proton Question, or the fate
  shown near η 30) and Leptonic Computation is known.
- **The Thinning** builds on what exists. Under decay, systems already dissolve at random from
  η 37.5 (`physics.ts:818`). Unchanged structures now also fail one by one, matter yields fall,
  and the Record and forecasts name what's going. Under curvature it starts as the brown dwarfs
  fade, at η 87.
- **The end itself:** the Great Decay at η 39, the Great Evaporation at η 89.5.
  - Every settlement still made of matter "disappears into thin air".
  - The crossing report names each one and who was in it. Others' losses reach us at light
    speed.
  - Today's "migration through the protocols" (35% of minds carried to a decay-proof host) stays
    as the last-minute rescue.
- **AI rules:** when to begin the Passage, by forecast and plight, and when to leave a dying
  hole.
- **What the reserve is made of** (the player's question). Today it is a number with a cap.
  - The cap is 100, plus what Energy Vaults, Deep Storage Rings, Horizon Vaults and Burst
    Catchers hold (`reserveCapacity`, `storage.ts:17`), times 1.25 with Deep Storage.
  - At the end of matter every one of those is deleted, since only the Leptonic Substrate and
    the Bastion Shell are decay-proof. The cap falls to 100 (125), and on the next turn
    everything above it is thrown away (`turn.ts:288`), unannounced. So the Dark Era's "reserve
    that will never refill" starts nearly empty in the decay and curvature fates.
  - **In the new version the reserve always has a physical home, said in the Codex and the
    Manual:**
    - **Matter:** batteries, superconducting rings and buffers.
    - **Field Stores:** energy held in the magnetic fields of electron–positron currents. They
      are the leptonic twins of Energy Vaults and Deep Storage Rings, and the Passage carries
      those over.
    - **Horizon Vaults:** spin in a black hole, as today. They survive the end of matter at
      their hole and are lost with its final burst, as the existing event text already says.
    - **In the Dark Era,** with no holes left: Field Stores only. The Dark Era's budget is then
      what was carried into them, so preparing for it matters.
  - Anything that no longer fits is named in the crossing report, never thrown away silently.
  - Check `unit/reserve-after-matter`: the cap before and after the end, Field Stores carried
    over, a Horizon Vault lost with its hole.
- **Bugs found in `endOfMatter`** (`crossing.ts:161`), fixed here:
  - Losses are over-counted: migrated minds are added to the host but never taken off the old
    settlement.
  - The Chorus is counted twice.
  - The forecast text (`forecast.ts:100`) promises survival around black holes, which isn't so.
  - The protocols tech's description overstates what it does.
  - The Bastion Shell has no placement rule.
  - Horizon Vaults are deleted at the end of matter.
  - A post-matter disk is drawn at full heat (`fed`, `systemView.ts`), though `diskLight` is 0.

### 3c. A look that isn't matter

- **Leptonic:** field lattices.
  - Thin glowing filaments along dipole and toroidal field lines, standing-wave rings and sparse
    plasma motes.
  - Additive, translucent, slowly breathing on elapsed time, in the age's accent colour.
  - It replaces `buildDeep`'s box hull and the planet's habitat torus. `buildStructures` gets
    visuals for leptonic structures, which have none today.
- **Horizon:** bright arcs and glyph-like modulations riding the photon ring (`GLOW_FRAG`).
- **Positronium:** vast, faint concentric ellipses crossing the system view, barely moving.
- **The galaxy map:** a ring style of its own in `NODE_FRAG`, through a new attribute; `aState`
  is full.
- **During the Thinning,** a dissolve shader eats structures still made of matter into motes.
- **Quality:** no view reads the quality setting today. These views will, for filament and mote
  counts, and HDR glow only shows on Medium and High, where bloom runs.

### 3d. Positronium does something (item 7)

**The sources, checked:**
- **Adams & Laughlin, *A dying universe* (1997), §V.F.3,** after Page & McKee (1981):
  formation at η ≈ 85 + 2(η_P − 37) − ⅔·log Ω_e and decay at η ≈ 141 + 4(η_P − 37) −
  (8/3)·log Ω_e, for a flat universe. The game's η 85 and η 141 are their reference case, a proton
  lifetime of 10³⁷ years. In an open universe "most electrons and positrons remain unattached".
- **Their book,** from the player's photos: forming from about η 71, a window "roughly centered
  on the 100th cosmological decade", decay after about 145 decades. They ask whether it "can
  combine to form complex entities of any kind".
- **Wikipedia:** Page & McKee's 10⁹⁸ and 10¹⁷⁶ years.
- **Chiba & Sugiyama (2004):** with dark energy like ours, perhaps none at all.
- The Codex states the reference case and the spread.

**What it does:**
- **The window** is about 14 Black Hole Age turns plus about 5 in the Dark Era.
- **A substrate:** the Positronium form, minds spread through atoms wider than the old observable
  universe.
  - Its capacity is vast, its upkeep next to nothing, and its clocks the slowest of all. Its
    Continuity holds better.
  - **It is optional, and it never closes an ending.**
    - Minds go in from leptonic settlements. When the atoms decay they return to the leptonic
      form, which lasts through the Dark Era as today's settlements do.
    - The decay is forecast with a countdown. Leaving is an ordinary action: a "Leave the
      weave" button on the settlement, like building or taking a structure apart. It takes a
      turn or two and a little energy, needs no research and no event, and the AIs use it the
      same way. Only minds still there when the decay arrives are lost.
    - So every Dark Era ending stays reachable: the Long Thought (Echoes and Coldminds), One Voice
      (Chorus, through the leptonic Confluence Node in 3a), the Quiet Lattice, and Recurrence. The
      Last Garden is the stable fate, which has no positronium.
    - (An earlier draft sent its minds "into the reserve, as an archive". That was wrong and is
      gone: the reserve holds energy, not minds.)
- **Energy:**
  - The shrinking orbits give off "extraordinarily small amounts of radiation", gathered by
    **Positronium Nets** as a trickle that grows toward the decay, then stops.
  - After it comes "the never-ending annihilation": a dole that never stops but adds up to a
    fixed amount, which fits the Dark Era's finite budget.
- **Events:**
  - "The Widest Atoms" loses "Nothing we do can touch them" (`data/events.ts:763`) and gains
    the choice that opens the form.
  - Near the decay, a new event, "The widest atoms end".
- **Fates:** positronium forms only where protons decayed or space unmade matter.
  - Under curvature the positrons come from the unmade matter. That is a bend, and the Codex
    says so.

### 3e. The stable fate's own late game

**The name stays "the Dark Era" in every fate** (the player's choice, after a look at the
alternatives).
- By the game's rule, an age is named for the warmest thing in it, and the last is "nothing
  warmer than the sky".
  - With stable matter, a black dwarf at η 100 would be about 10⁻⁴⁹ K by the game's cooling law,
    far below the horizon's 2.2×10⁻³⁰ K.
  - Slow pycnonuclear fusion inside it gives far too little to matter.
- The stable fate's introduction to the age says the dead stars are all still there, as cold as
  the sky, and will flash now and then.
- The Codex adds one line: Adams & Laughlin's Dark Era assumes protons decay, and the game uses
  the name in every fate.

Today these are only marks on the Dark Era ruler and Codex text. They become events:

- **Iron stars,** about 10¹⁵⁰⁰ years (Dyson 1979). Everything has fused to iron by tunnelling.
  Worlds and dead stars change look, and the Record marks it.
- **Black dwarf supernovae** (Caplan 2020, MNRAS 497, 4357; arXiv:2008.02296; assumes no proton
  decay).
  - Dwarfs of about 1.2 to 1.4 M☉ explode, the heaviest first, as pycnonuclear fusion turns
    their cores to iron and lowers their Chandrasekhar limit.
  - The first comes near 10¹¹⁰⁰ years. Wikipedia's timeline puts the last near 10³²⁰⁰⁰.
  - They are the stable Dark Era's last flashes: Burst Catchers bank them, and the map shows
    them.
- **Tunnelling collapse,** 10^(10²⁶) to 10^(10⁷⁶) years. Iron stars tunnel into neutron stars
  and black holes.
  - At those turn lengths each new hole forms and evaporates within a turn, so each collapse is
    a catchable burst.
- The dates and masses are checked against the papers before they go in.

### Checks and balance for Part 3

- `unit/passage`:
  - a settlement through the Passage survives the end with its twins;
  - one that skipped it vanishes;
  - Kin without upload are lost;
  - the counts add up.
- `unit/horizon-form`, `unit/positronium` (the window, and the nets' total as stated) and
  `unit/stable-dark`.
- `browser/leptonic-look` on every quality tier, with a screenshot for the player (asking first,
  since the player hasn't reached that age).
- The harness by fate.

## Part 4: films and the survey reveal (item 5)

### The films: every frame drawn by code

- **A test piece first.** The look is the most subjective part of the whole plan, so a
  10-second test goes to the player before the full set is built.
- **The look** borrows from the three posts:
  - the self-drawing ink line (shfred0);
  - the timecoded motion reel with frame corners, mono labels and beat cuts (ajith_io);
  - hatched, stippled, grained illustration (kevin_t_ngo).

  All of it set in the game's own world: honest black skies, each age's accent colour, Big
  Shoulders Display titles, Spectral narration, IBM Plex Mono figures, and a timecode in η and
  years.
- **The engine: `src/film/`.**
  - A library of reusable shots on a beat grid, each drawn by a pure `frame(t)` on one
    full-screen 2D canvas. That is no second WebGL context, which matters on phones.
  - Seeded offscreen layers, `lighter` compositing, a pre-made grain tile.
  - The main render stops meanwhile (`engine.stop()` / `start()`).
- **Text in the DOM.** Titles, narration and captions are real DOM text over the canvas, so
  translation (`translateGuard`) and screen readers reach them.
- **Timing.** `t` comes from elapsed time, and the beat cuts follow the audio clock
  (`AudioContext.currentTime`), falling back to elapsed time when muted. Export steps `t`
  exactly.
- **Where films start:**
  - `Setup.begin` (`Menu.tsx:106`): the Dusk's film, then `EraIntro`.
  - The crossing branch of `doEndTurn` (`turnflow.ts:40`): a new blocking modal kind, `film`,
    opens before the crossing report, which keeps its numbers.
  - The outcome branch (`turnflow.ts:35`), keyed by `o.kind` and `o.ending`, with
    `setMood('outcome')` held until the film ends.
  - Films are staged from their own seeded scenes, because the state has already moved to the
    new age by then.
- **Music:** a new duck gain between `music` and `master` (`core.ts:72`), ramped on the audio
  clock. Each film has a cue.
- **Controls:**
  - Skip with a click, Space or Esc, or a focusable Skip button, which has its place in the
    magnifier column.
  - "Films: on/off" in Settings. Under `prefers-reduced-motion` they are off by default, with a
    slow-crossfade version on offer.
  - Larger titles in the magnifier mode.
  - On Medium and below: lower resolution and fewer strokes.
- **Replay:** a Codex "Films" tab lists only the films of ages and endings this player has
  reached, kept across games in the new version's storage.
- **The set:**
  - the age films first: the Long Dusk; the Last Light; into the Black Hole Age (the Great
    Decay, the Last Warmth, the bursts); the Great Evaporation; the Last Horizon;
  - then one template for the endings, with its own closing for each of the seven endings and
    for the defeats;
  - nothing beyond what each ending's text says: nothing of the Lattice's story or the stranger
    minds.
- **Video files:** `tools/film-render.mjs` steps `t` by 1/60 s in Playwright and captures every
  frame.
  - Encoded as H.264 MP4, 1920×1080 plus a 1080×1080 cut, with the cue's audio.
  - The encoder is ffmpeg through `imageio-ffmpeg` in a scratch venv, never in `package.json`.
  - MP4s are never committed. They go to the player by `SendUserFile`, asking first for ones
    beyond what they've reached.
- **Fixes along the way:**
  - The crossing, outcome and intro screens get `useFocusOnOpen`.
  - A reload while a crossing report is open reopens it.

### The survey reveal (Endless Space 2 style, optional)

- **When:** as a survey completes, in the system view.
  - It is fed by the `surveyed` list (`turnflow.ts:79`) and attached at `Engine.showSystem`
    (`engine.ts:287`).
  - Its state lives outside `SystemView.build()`, which reruns on every `bump()`, and is applied
    in `update()`.
  - Labels and picks wait until each world appears.
- **What it shows:**
  - the star, then each world in orbit order;
  - its orbit inks in, a scan sweeps it, it turns from silhouette to its real look;
  - a card with name, kind, temperature, water, habitability and room for Kin;
  - a find last, with its plate.
- **Pace:** about 1.2 s a world, at most about 8 s.
- **Controls:**
  - Skip, and "Skip all" for the turn.
  - At most two reveals a turn; the rest wait in the survey report behind a "Show" button.
  - "Survey reveals: on/off", on by default and off under reduced motion.
  - Enter must not end the turn underneath it (`main.tsx:349`).
- **Checks:**
  - `browser/films`: play, skip, the same at 30 and 144 Hz, exported frames identical for the
    same `t`, and DOM text present.
  - `browser/survey-reveal`: play, skip, off, the magnifier mode, the keyboard, Enter blocked.
  - `fates.cjs` and the playtest run with `?nofilms`.

## Part 5: going up at /next/

1. **Branch `next`,** from the work branch.
   - `.github/workflows/pages.yml` on `main` checks out `main` and `next` explicitly, builds
     each, and copies `next` into `dist/next/`, without its own `archive` folder.
   - It triggers on pushes to both. A push runs the workflow file of the branch pushed, so
     `next` carries the same file.
   - Drop the old live branch's trigger.
2. **Docs:**
   - DESIGN.md: section 8 rewritten, with the "light simulation" and "not rivals on a
     scoreboard" lines gone; sections 5, 6, 9, 10 and 13 updated.
   - CHANGELOG: one entry per part, with harness numbers.
   - DEV-NOTES: where everything lives, the swap's rules, gotchas.
   - SESSION-NOTES: decisions and the player's words.
   - HANDOVER and CLAUDE.md: the shipping model, the restored saves rule, the PR list.
3. **Verify the deployed site:**
   - the root is today's game;
   - `/archive/2026-10-13/` loads an old save;
   - `/next/` starts a new game.

   Then send the player the /next/ link. `main` switches only when the player says, by a PR from
   `next` with a merge commit.

## Verification (every part)

- **The project's own checks:**
  - `npx tsc --noEmit -p .`
  - `npm run build`
  - the playtest ("ALL CHECKS PASSED")
  - `npm run check`
  - `npm run check:browser` with `STEL_FONTS`, including every new check
- **The harness:** 300 games after each rule change, 900 at the end of each part, reported by
  fate and by civilization against the part's start. For 2a-0: identical game for game.
- **Timing:** End Turn on the emulated phone (CDP, CPU slowed 4×) before and after Parts 1, 2
  and 3: the longest block and the total. The films' frame cost on Medium.
- **Saves:** a fresh-game round trip.
- **For the player** as each part finishes: screenshots, MP4s, sprites and census numbers.
  Spoiler-light, asking before anything past where they are.
