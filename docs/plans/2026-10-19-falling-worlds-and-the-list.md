> **20 Oct: part A is done** (validated in both versions; live by PR m1omg/Steliterate#34,
> `e827e2f`, and on `next`; `main` merged back with `-s ours`, `11862d4`). The CHANGELOG draft and
> the REPLICATE patch beside this file are applied: don't apply them again. Parts C and B remain.

> **Saved 19 Oct, about 22:50, at the handover** (the player: "please put this plan along with
> updating the handover MD, because I will need to continue in another session"). It was written
> and approved in that session ("It sounds good"). Paths under `$SP` (the scratchpad), the
> worktrees `wt-pm`, `wt-main` and `wt-next`, the `stash`, and the uploaded `.odt` were in that
> session's container and are gone. What still matters from them is saved beside this file:
> `2026-10-19-changelog-draft.md` and `2026-10-19-replicate-wip.patch`. For the `.odt`, ask the
> player to upload it again (see HANDOVER.md, section 0). Spoiler-light: the hidden step's details
> are in `docs/spoilers/slow-ones.md` only.

# Plan (19 Oct, 22:00 Bratislava): finish "the game keeps its word", then the falling world's flashes and rubble

## Now (19 Oct, about 22:45): hand over only

The player, on this plan: "It sounds good, though not all black holes should have planets, just
a lot of them. And please put this plan along with updating the handover MD, because I will need
to continue in another session… I'll be back… 93% of usage is gone right now."

So this session does only the handover. Nothing of A, B or C is started.
1. Copy this plan into the repo as `docs/plans/2026-10-19-falling-worlds-and-the-list.md`
   (approved in substance: "It sounds good").
2. Save what lives only in this container:
   - the CHANGELOG draft (`$SP/changelog-draft.md`) as
     `docs/plans/2026-10-19-changelog-draft.md`;
   - the REPLICATE.md partial update (`stash@{0}`) as
     `docs/plans/2026-10-19-replicate-wip.patch`.

   The ODT's screenshots stay out of the repo: they are the player's, and unseen. The next
   session asks the player to upload the file again; the items' text is in the plan.
3. Update `HANDOVER.md` (where things stand, what to do first, the traps) and one line in
   `CLAUDE.md` pointing to the plan.
4. Commit and push the work branch only. `next` and `main` are untouched, since nothing is
   validated.

Item 2 changes with the player's word: not every hole gets worlds. The `:hole` stream gives each
stellar hole a 65% chance of 1 to 3 more, so with today's 30% about three holes in four have
worlds.

## Context

Three pieces of work (their order is under "Order of work"):

- **A. Finish the promises batch** (the plan below, approved earlier). It is built in both
  versions and pushed: the work branch at `9e0e44f`, today's game on `claude/promises-main` at
  `7d4c702`. Nothing is merged yet, and `next` is not pushed.
- **B. The player's new request** (19 Oct): "make the black hole flashes harvestable"; work out
  how much a world being eaten by its star heats up, and say how the mechanic works now; the
  world "should then break up into asteroids and eventually be… accreted"; "even something that
  seems like it's just a few years… can also be very energetic… So it should present an
  opportunity for the civilization."
- **C. The player's list of 16 Oct**, sent at 22:xx: seven questions, issues and requests about
  /next/, four of them with screenshots. "Please look at the pictures as well in the document
  once you're out of the planning mode."

## A. Finish the promises batch

1. Work branch: rerun the playtest and browser checks (`sh $SP/validate-next.sh`).
2. Today's game: run `sh $SP/validate-pm.sh`, which runs the harness (300 standard and 300
   harsh) and then the full checks. Its `ways.ts` may need the seed loop the work branch got.
3. Docs:
   - CHANGELOG from `$SP/changelog-draft.md`;
   - HANDOVER, CLAUDE.md, DEV-NOTES balance rows (work branch: 156 / 65 / 71 standard, harsh
     124 / 35 / 66; main: from the run);
   - REPLICATE.md: `git stash pop` and finish it.
4. Commit and push the work branch, then `git push origin claude/epic-wozniak-lyhulf:next`.
5. Open the PR from `claude/promises-main` into `main` and merge it with a merge commit
   (`expectedHeadSha`). Check the Pages run and the live site.
6. `git merge -s ours origin/main` into the work branch, after checking main has nothing the work
   branch lacks. Push the work branch and `next`.

## B. Falling worlds: the flash and the rubble

### How it works now (both versions)
- **The date.** Each world of a white dwarf, black dwarf or neutron star has a date
  (`inspiralAt`) when gravitational waves have shrunk its orbit to the star's tidal limit. In
  new games, brown dwarfs and black holes get one too (`fallsInAt`, physics.ts).
- **The fall** (`evolveUniverse`, physics.ts ~739). On that date:
  - the world's vitality drops to 0;
  - one draw decides how it falls: "rekindle" (1 in 5, 1 in 3 for a Jupiter) makes the star 8
    times brighter; otherwise it falls in a slow stream;
  - the warmth it gives is `base × k × (1 + t/τ)^-2` light units, with base = the world's mass in
    Earths (0.3 to 3; ×5 for a Jupiter) and τ = 10^14.2 to 10^15.4 years (10^13 for a Jupiter).
- **The event.** "A World Falls" offers a choice: evacuate to the capital, or stay and mine it
  (+80 matter, Resolve −3).
- **The harvest.** Disk Skimmers (in the Deep) give 14 energy a turn per light unit.
- **The end.** After 30τ the world is gone ("plunge"): three in four of anyone still there get
  off to the Deep, and +20 energy if we have a settlement in the system. Until then it is drawn
  as the world it was.
- **Black holes** (new games): the world is gone within the turn, "one flash, then nothing", and
  the flash gives nothing.
- **Heat, from `$SP/feedtemp.ts`.** A 0.83 M⊕ world at 0.014 AU around a white dwarf (falls at
  about 1.4×10^16 years):
  - slow stream: the dwarf goes from 2.6 to 69 K, light 0.83; the world from 0.1 to 2.9 K;
  - rekindled: the dwarf reaches 117 K, light 6.6; the world 4.9 K.

### The physics
- **The world itself.** Gravitational waves round an orbit off, and the world is locked to its
  star. A static tide does not flex it, so it warms only in the star's new glow: a few kelvin,
  as the game has it.
- **If the orbit is even slightly oval** (a sibling world tugging it), the tide flexes the world
  near the limit. At 0.006 AU it heats as Io does, many times over:
  - e = 0.001: about 1.8×10^19 W, a surface at about 890 K;
  - e = 0.01: about 1.8×10^21 W, about 2,800 K, molten.
  - Either way it lasts some 450 years, until the tide rounds the orbit again. That is the
    transient the player means.
- **The breakup.** The world is torn into a ring of rubble at the Roche limit: about 1.3 R☉ or
  0.006 AU for a 0.6 M☉ dwarf, with an orbit of about 5 hours. Today's polluted white dwarfs
  show this: WD 1145+017's disintegrating fragments, and an iron-core fragment orbiting inside
  SDSS J1228+1040's disk. The ring grinds itself down and rains onto the star. The game's rate
  (an Earth over 10^14.8 years) is about 300 kg/s; polluted dwarfs today take about 10^2 to
  10^6 kg/s. That heats the dwarf's surface to about 100 K, close to the game's figure.
- **The energy of the fall** (GM/R per kg):

  | Where an Earth falls | Energy | How fast |
  |---|---|---|
  | onto a white dwarf | 5.5×10^37 J | slowly: a stream; all at once: about 84 days at about 20,000 Suns |
  | onto a neutron star | 9×10^40 J | about a tenth of the star's final curvature burst (10^42 J) |
  | torn apart by a 10 M☉ black hole | 1.5 to 11×10^40 J (efficiency 6 to 42% by spin) | tidal radius 9.5×10^5 km, horizon 30 km; the first debris returns in 38 days; about 330,000 Suns for 4 to 28 years |

  A Jupiter torn apart by the hole gives about 8.5×10^42 J, over some 2,000 years.
- **Why only a buffer can use it.** A Degenerate Age turn around 10^22 years lasts about
  6×10^21 years. Spread over that turn, 2.7×10^40 J is about 10^-4 of a light unit: nothing.
  Caught as it happens, it is a fortune.
- **The game's own yardstick.** A Burst Catcher fills at the flux a neutron star's burst gives
  at 10 ly, about 9×10^6 J/m². A flash of energy E fills it out to 10 ly × √(E / 10^42 J):
  - an Earth torn by a hole: 1.6 ly;
  - a Jupiter: 29 ly;
  - an Earth onto a neutron star: 3 ly;
  - an Earth crashing onto a white dwarf: 0.07 ly, so its own system only.

  Anything inside the flash's own system fills a catcher.

### The player's answers (19 Oct, 22:xx)
- Rubble you can mine. "But then there should be an event about evacuation. The hunger (Only
  accessible with high taint) option should be darker… Let them be consumed or somehow utilized
  the population that's falling in, but I'm not sure."
- Both versions, new games only.
- The flashes: "please calculate the effects because I'm pretty sure that this would destroy the
  planets around the objects… So… only burst catchers in other systems would really catch it.
  If the planets aren't rogue yet… depending on [the distance] they can also make use of it and
  not be destroyed."

### What the calculation shows (`python3 -I` in this session)
- **A correction.** The "4 to 28 years at 330,000 Suns" holds for a world that plunges in on an
  oval orbit, a classic tidal disruption, with its debris coming back within weeks. A world drawn
  in by gravitational waves arrives on a round orbit and is stripped more gently. What follows
  depends on what it is made of:
  - **A rocky or icy world** becomes a ring of solid rubble. Nothing makes rubble viscous, so it
    is ground down and falls slowly: about 10^14 years, as the game has at white dwarfs.
    - At a hole it still gives 10% of its mass-energy, about 5×10^40 J for an Earth, but faintly:
      about 3 K at 1 AU. It harms nothing.
    - It is over within one turn of that time (about 10^22 years), so on the game's clock it is a
      flash that a buffer catches.
    - At a white dwarf it never flashes. Even the fastest "runaway" accretion is about a millionth
      of a Sun over a billion years.
  - **A giant** (gas or ice) becomes a ring of gas. Gas is viscous, so the ring drains in years
    to centuries, faster than the star can take it in. The star then shines at its limit
    brightness (the Eddington limit) until the gas is gone:

    | Where a Jupiter falls | Brightness | How long | Energy |
    |---|---|---|---|
    | white dwarf | 20,000 Suns | ~73 years | 1.7×10^40 J |
    | brown dwarf | 1,650 Suns | ~9 years | 1.8×10^38 J |
    | neutron star | 46,000 Suns | up to ~30,000 years | up to 1.7×10^43 J |
    | 10 M☉ black hole | 330,000 Suns | ~4,300 years | 1.7×10^43 J |

- **What a giant's flash does to its system.** Take a hole's Jupiter:
  - surfaces reach 6,700 K at 1 AU, 3,000 K at 5 AU and 1,500 K at 20 AU;
  - air and oceans boil off wherever the energy reaching the world passes about 7×10^15 J/m²;
  - a body is torn apart only past about 1.8×10^18 J/m², which means small worlds within a few
    AU of a hole's or neutron star's flash;
  - at a white dwarf, surfaces are 3,300 K at 1 AU, 1,500 K at 5 AU and 740 K at 20 AU.

  So the player is right: the worlds mostly survive as bodies, scorched, but anything on them or
  around the star near it is lost. Farther out, where rock does not melt (about 1,400 K), a
  settlement can live through it: its heat reaches only some 50 m down in 70 years, 250 m in
  2,000.
- **Rogue worlds.** A world flung loose leaves at a few km/s. In 10^14 years, the shortest turn of
  that time, that is some 1.7 billion light-years of travel: it circles the galaxy on its own, in
  practice anywhere in it. The game already counts such a world as far away (`inItsSystem`):
  untouched, and too far to catch anything.
- **A bend found on the way.** A neutron star's slow stream gives the light a white dwarf's
  does. Physics gives about 1,700 times more, since its surface lies that much deeper in its
  gravity. This is left as it is (it would swamp the balance) and named as a bend in the Codex.

### Design (with the player's choices)
1. **The rubble** (rocky and icy worlds at any dead star or brown dwarf). At the tidal limit:
   - the world becomes a ring of rubble: kind `asteroids`, "the rubble of <name>", drawn as a
     belt;
   - its core is laid open: richness ×2, times the share still left, 1/(1 + t/τ);
   - it is accreted as now, the star warming as now, and Disk Skimmers harvest it;
   - at the end (30τ), the last of it falls in.
2. **The evacuation event.** "A World Falls", at the breakup, for a settlement of ours on it:
   - **Evacuate**: its people go to the capital, as now.
   - **Stay and mine the rubble**: the settlement stays; Matter +80, Resolve −3, as now. At the
     end, three in four get off, as now.
   - **The dark choice**, only at Taint 60 or more (the game's own mark of a civilization gone
     to the Hunger's ways, `CORRUPT_AT`): "Take them apart", as in 4 below.
3. **A rocky world at a black hole.** It is torn into rubble that feeds the hole within the turn,
   faint and harmless:
   - Burst Catchers in the hole's system bank 250 each;
   - catchers elsewhere bank by distance, with a reach set by the energy (an Earth's fills them
     out to 2.3 ly): `burstShare(ly, reachLy)`.
   - No mining: the ring is gone by the turn's end.
4. **A giant at any dead star, brown dwarf or hole: the flash.** It shines at the star's limit
   brightness for as long as the table says. The player chose "By what falls", and for what
   survives: "if something is molten, it doesn't mean it's gone… same criteria that are with
   evolving stars… molten planets still stay molten… they won't be too habitable for kin, but
   their proximity to the source can be exploited. Perhaps some measures may need to be taken to
   shelter from the big injection of energy." So:
   - **The worlds.** The helium star rule (`boilsUnder`) holds a world above 3,000 K for some
     10^8 years. A flash lasts decades to millennia, so what decides is its energy.
     - **Boiled away** (gone as the turn ends, like under a new star): a world inside the melt
       line where 10% of the energy it takes in could drive off its whole mass,
       0.6 GM²/R ≤ 0.1 × E/(4πd²) × πR².
       - Hole or neutron star Jupiter: an Earth within 1.85 AU, a Mars within 6.7 AU, a Moon to
         the melt line.
       - White dwarf Jupiter: an Earth within 0.06 AU, a Mars within 0.21 AU.
       - Rubble boils away inside the melt line, as rubble does under a new star.
     - **Molten**: inside the melt line, where the ground passes `LAVA_K` (1,500 K): out to
       4.8 AU (white dwarf), 1.4 AU (brown dwarf), 7.4 AU (neutron star), 20 AU (10 M☉ hole;
       √M for others). The world stays. Its water goes to 0 (oceans and air boil off), its
       vitality to 0, and it gets the trait `scorched` ("melted by a flash; its air and water
       gone").
       - It is molten for some thousands to a million years and frozen again well within the
         turn. Its lasting marks are what it lost.
     - **Beyond the melt line**: warmed for the flash's span, and nothing changes.
   - **Settlements** (the player: Flash Shelter, "but maybe a distinction should be made where…
     the night s[id]e is still at a reasonable temperature to shield via technological means,
     where a standard flash shelter would be [enough], as compared to shadow shields needed if
     the whole world melts down… there may be some balancing needed there"):
     - on a world boiled away: lost, whatever it has;
     - beyond the melt line: unharmed, no shelter needed;
     - every survivor's Burst Catchers bank 250 each.
   - **Inside the melt line**, what a settlement needs depends on whether its world shades itself:

     | Where it is | Why | Needs |
     |---|---|---|
     | a tidally locked world (trait `tidally_locked`) | it keeps one face to its star, so the world is its own shield. Its night side stays cold, as on today's lava worlds (K2-141b): the rock vapour the day side boils off freezes out near the terminator | **Flash Shelter**: bunkers under a kilometre of rock on the night side (Deep Warrens count) |
     | a turning world, a giant's cloud habitats, a rubble belt | every face turns into the flash many times a day for decades, so the whole surface melts | **Shadow Shield**: a screen between it and the source (a captured rock at the inner Lagrange point; for a belt or the clouds, a parked one) |
     | the Deep, at the star itself | nothing to hide behind but what it brings | **Shadow Shield**: a hollowed rock it hides behind |

     Without what it needs, a settlement there is lost, as at a neutron star's burst. With it, it
     lives through the flash. A world's state uses `starClimate` under the flash's light, as
     `boilsUnder` does.
   - **The two new structures** (both with Burst Capture, the Degenerate Age, max 1, no upkeep).
     There were no shelters before. Proposed costs, to check with the harness and by hand:

     | Structure | Industry | Matter | Where | Compare |
     |---|---|---|---|---|
     | Flash Shelter | 50 | 20 | worlds; not the Deep, giants or belts (as the Warrens) | Deep Warrens 60 / 15 |
     | Shadow Shield | 140 | 70 | anywhere, the Deep too | Burst Catcher 90 / 40, Horizon Vault 110 / 60, Accretion Engine 160 / 60 |

     The payoff: two catchers (180 / 80) bank 500 energy from one flash, several turns of a
     settlement's energy in that age. A Flash Shelter is cheap, since a locked world does most
     of the shielding itself. A Shadow Shield costs more than a catcher, since it must stop what
     the catcher gathers.
     - Flashes are rare, one for each giant that falls in. The forecast warns ahead with the
       date, so shelters are built for a flash that is known to be coming.
     - The autoplayer does not plan for them, and the harness shows what that costs it.
   - **Other systems** bank by distance, by its reach: a white dwarf's Jupiter 1.3 ly, a hole's
     or neutron star's 41 ly.
   - **The falling giant's own settlement** gets off to the Deep, three in four, as from any
     world that falls in. Then the Deep's fate applies.
   - **The forecast** warns ahead with the date, the melt line, and what in the system lies
     inside it.
   - This replaces the giants' 10^13-year feeding at white dwarfs (one or two turns), in new
     games.
   - The dark choice (player: "Take them apart"): its people are not taken off; Matter +5 per
     person, Lattice +1 for every 3 at the capital (up to its room), Taint +8, Resolve −6,
     Kin −10.
5. **Wiring.**
   - Everything is behind a new generation flag `flags.rubble = 1`, set without a draw.
   - No new draws: the rekindle draw stays where it is, and kind, mass and orbit decide the rest.
   - The other flashes keep their 10 ly.

### Files
- `src/game/sim/crossing.ts`:
  - `burstShare(ly, reachLy = NEAR_BURST_LY)`;
  - `flashReach(E)`, 10 ly × √(E/10^42 J);
  - for each giant's flash, the melt test (`LAVA_K` under the flash's light, via `starClimate`)
    and the boil test (the energy criterion above).
- `src/game/sim/turn.ts`:
  - a "torn" note (rocky at a hole) and a "giant_flash" note go to `flashes` with their energy;
  - `catchFlashes` takes each flash's reach and the in-system rule;
  - the giant's flash:
    - boils away the worlds that go (as `boiled`);
    - marks the molten ones (water 0, vitality 0, `scorched`);
    - destroys settlements without the shelter they need, reusing the burst's `destroyColony`
      pattern.
- `src/game/physics.ts`:
  - in `evolveUniverse`, the split by kind at the tidal limit: rubble (kind, richness, label),
    a rocky world at a hole, and a giant's flash;
  - the ring's share left, for richness;
  - the flag.
- `src/game/sim/forecast.ts`: the giant's warning, with the melt line, which of our settlements
  lie inside it, and what each needs (Flash Shelter or Shadow Shield).
- `src/game/data/structures.ts`: `flash_shelter` and `shadow_shield`, behind the flag. Their
  tips say which flash and which worlds they are for.
- `src/game/data/events.ts`: "A World Falls" in rubble games, with its three choices.
- Codex (planetary fates, the neutron-star bend) and Manual.
- `src/game/gen.ts`: the flag.
- Main: the same through its own code (no `owner`/`asCiv`).

### Checks
- New unit check `tools/checks/unit/falling-flash.ts`:
  - rubble: kind, richness ×2, half of that at t = τ;
  - a rocky world at a hole: two catchers in its system bank 500; one at 2 ly banks 250; one at
    5 ly banks less;
  - a giant's flash at a white dwarf:
    - a settlement at 1 AU on a turning world is lost without a Shadow Shield and lives with one;
    - one on a locked world lives with a Flash Shelter, or with Deep Warrens;
    - the Deep is lost without a Shadow Shield;
    - one at 10 AU lives with nothing, and its catcher banks 250;
    - a catcher 1 ly away banks by distance;
    - a small world close in boils away;
  - the dark choice appears only at Taint 60;
  - an old save keeps today's rule.
- savecompat, and the harness on both versions.

### Verification
- tsc, build, playtest, savecompat, `npm run check`, the browser suite, and the harness: 300
  standard and 300 harsh, in both versions.
- A browser check that a falling world draws as a belt.
- Then commit, push, push `next`, and open and merge the PR into `main`, as in A.

## C. The player's list of 16 Oct (about /next/; sent 19 Oct, 22:xx)

The file is `/root/.claude/uploads/d2c76da4-b5f8-5e12-9bdd-b3b214132e23/c4a3ae5d-Questions_issues_requests_for_Claude_regarding_Steliterate_next_16_october_2026_0056.odt`.
"The text describing the issue/request/question is always ABOVE the image, IF an image is
present."

| # | Item (the player's words) | Screenshot |
|---|---|---|
| 1 | "Should show open terminator seas." | `Pictures/1000000100000A0000000555CEBD5B93.png` |
| 2 | "Please, add more black hole planets and find a way to quantify black hole accretion disk brightness." | none |
| 3 | "Quick 10x is not Quick 10x here:" | `Pictures/10000001000009E700000474B46628E6.png` |
| 4 | "Worlds die in same amount of turns regardless of pace." | `Pictures/10000001000009E7000004743ED1572A.png` |
| 5 | "If a given pace becomes unavailable the UI still stays with that pace highlighted instead of switching to the next possible one." | none |
| 6 | "„All frozen“ water and cold but with visible seas?" | none |
| 7 | "I think I got a sub-ice geothermally driven life event...about a planetless system, once, unsure." | `Pictures/10000001000009E70000047411F5A29B.png` |

- **Step 0, after approval:** extract the four PNGs (`python3 -I`, zipfile, into a new folder
  `$SP/odt-pics/`) and look at each with Read before changing anything. Plan mode does not allow
  writing them out now.
- The code findings for each item are below (Explore agents, read-only).

**Item 2. More black-hole worlds, and the disk's brightness as a number.**
- **Today** (`gen.ts`, the same in both versions):
  - a black hole has at most one world: a `chance(0.3)`, then a barren or ice world at 2 to 20 AU
    of 0.1 to 3 M⊕ (`bodyTemplates`, gen.ts:219-221);
  - the Heart has none;
  - about 11 holes per galaxy, so about 3.3 hole worlds; 7.7 holes have only their Deep.
- **The way to add them without moving a draw** already exists. `addOuterWorlds` (gen.ts:683-708)
  runs last, with its own `new Rng(hashSeed(`${seed}:${sys.id}:outer`))` for each system, and IDs
  from the shared counter come after everything else. So:
  - a new `addHoleWorlds` runs after it, with the salt `:hole`, in new games only
    (`flags.rubble`);
  - it gives each stellar hole (Wells and Wanderer too) a 65% chance of 1 to 3 more worlds, at 1
    to 40 AU, of kinds barren, ice, super-Earth, and a gas or ice giant at about 1 in 4 (so
    giants can fall in and flash, part B). The player: "not all black holes should have planets,
    just a lot of them". With today's 30%, about three holes in four have worlds;
  - each world's date uses the hole's true mass; a world flung loose follows the usual rule.
  - **The Heart** (3×10^8 M☉, horizon 5.9 AU): worlds only beyond 30 AU. Note: past about
    10^8 M☉ a hole swallows a world whole, inside its horizon, before its tides can tear it. So
    the Heart's worlds fall in without a flash, and the Codex says so.
  - Their own check, as `tools/checks/unit/outer.ts` guards the outer worlds: the galaxy of an
    old seed is unchanged except for the added worlds.
- **The disk's brightness** (`diskLight`, physics.ts:1509-1522):
  - stellar holes 0.05 light units in the Dusk and Degenerate Age, 0 after;
  - the Heart 1.5, falling to 0.15, then 0.08 in the Black Hole Age;
  - 0 once matter is gone.
  - The only number shown is "Light for collectors ×0.05" (Drawer.tsx:373-380), not named as
    disk light; nothing in the UI shows L☉. In L☉, `primaryLuminosity` gives a stellar hole
    5.75×10^-5 L☉ in the Dusk and 2×10^-13 L☉ after.
  - **Fix:** a "Disk luminosity" row for holes, `mult(L)` L☉ with light units in the tip,
    computed from collectors' light (`sourceLight` × `lightUnitSuns`) so the two agree. A world
    falling into a hole (part B) adds its feed to the row while it lasts.
  - The Codex gets a line on what lights a disk: gas from the hole's surroundings, scarce in the
    far future, and what part B adds.

**Item 7. "Life Under the Ice" at a system with no planet.** There is one such event,
`vent_life` (events.ts:1069-1084; the same in the old version).
- A survey queues it (sim/fleets.ts:195-205) with a 30% chance. The candidates are every
  undissolved body, including rogue and torn-apart ones.
- Its only test (events.ts:1073) is `ocean_ice` or a `subsurface_ocean`, no colony, not steam.
- Ways it fires wrongly:
  1. **Starless "Drift" systems**, the most likely. Their 1 to 3 worlds have no star (0 AU), yet
     every `ocean_ice` gets `subsurface_ocean` (gen.ts:392). On seed 7, "Drift 5167 II" the
     text says "tidal flexing keeps an ocean liquid" while its Water row says "96%: frozen
     through" at 4.9 K (`buriedOcean` is false there, physics.ts:1460). It fired 5 times across
     40 seeds' Drifts.
  2. **A world flung loose** from its star; after its star is gone, the host is "void".
  3. **A world torn apart** by its dead star, or by a brown dwarf in the new version.
  4. **A world gone the same turn**: the survey queues the event before `evolveUniverse`, which
     can boil, blast, swallow or dissolve the world, and pending events are never re-checked.
- **Fix:**
  - the event's test asks for a liquid ocean as the Water row computes it (`buriedOcean`, which
    already says no for rogue hosts), a world not feeding, dissolved or rogue, and a star
    (`primary.kind !== 'void'`);
  - the survey's candidates leave out rogue, feeding and dissolved worlds;
  - a pending event whose body is gone is dropped when shown (sim/events.ts:42-63).
- **The same way:** "Kept Warm by Its Neighbours" fires in Drifts, because its
  `bodies.length >= 4` counts the Deep (events.ts:1228). It will count real worlds only.
- Checks: a unit check for each wrong path.
- Both versions (the same code).

**Items 3 to 5. The pace** (the same in both versions).
- **How it works:**
  - `civ.pace` is a whole number. Labels run from Quick ×1000 to Slow ×1000; the range is ±1, +2
    with Quickening, −2 with Hibernation Protocols.
  - The turn length is `stepTime`, Tide × 10^-pace, with Tide = l0 + (g−1)(years − age start)
    (eras.ts:122-149). Clocks and flares override it (`turnStep`, flare.ts:376-396).
  - A turn pays `livedShare` (flare.ts:422-429), 10^-pace for an ordinary turn.
- **Item 3, "Quick 10x is not Quick 10x".** Every case where it is not:
  1. **Over any stretch of time, always.** A Quick turn is a tenth of the Tide *at its date*, and
     the Tide grows with the date, so it grows less per turn. Over whole ages, Quick ×10 gives:
     - Dusk 105 to 936 turns (8.9×);
     - Degenerate Age 68 to 417 (6.1×);
     - Black Hole Age 57 to 185 (3.3×).

     The forecasts print both ("~N at this pace (~M at the Tide)"). This is the likeliest thing
     in the screenshot. The pay gives the same imbalance:
     - the Tide pays 1 for a turn whose own Tide is g times larger by its end;
     - so over an age, fine turns are paid (g−1)/ln g less: Quick ×10 gets 0.6 of the Tide's
       energy in the Degenerate Age and 0.33 in the Black Hole Age;
     - Slow ×10 gets 3.5 times the Tide's.
  2. **The Dark Era clamp** (eras.ts:152): the pace effect is limited to between ×0.5 and ×2 of a
     Tide step, yet the pay is still a tenth and the tip still says "Energy per turn drops 10×".
  3. **The flare clock.** The turn is the shorter of the pace's turn and a sixth of the flare.
     For a flare of 0.6 to 3 Tide turns, Quick ×10 is only 1 to 5 times shorter but is paid as a
     full turn: an exploit. "Turn n of 6" repeats.
  4. **A turn cut short as a star flares**: it pays 0.1 although the turn is the Tide's.
  5. **Smaller cases.** Star clocks, splits and flashes set their own turn and are greyed, with
     their reason. One tip has the ×100 text on ×10 (Hud.tsx:258).
- **Item 4, worlds die in as many turns whatever the pace.** All of these are per turn, with no
  length or pace (`declineWorlds`, turn.ts:111-146, called at turn.ts:314):
  - vitality loss (`vitalityLoss`, physics.ts:1131-1156);
  - the Dusk's acceleration, which counts turns: min(3, 1 + 0.02 × the age's turn);
  - freezing, 0.05 a turn;
  - core heat: the homeworld −0.007 a turn, and ×0.8 a turn after the Dusk;
  - seeded life +0.04 a turn;
  - rust, and a swarm's bite on richness.

  Only flare scorch and mining depletion scale with time. So at Quick ×10 a world dies ten times
  sooner in years. The docs always said "a turn"; this was never discussed. The nearest
  precedents (flare scorch, the Passage's "decades, not turns") went toward time.
- **Item 5, a greyed pace stays lit.**
  - This was deliberate (CHANGELOG, 3 Oct): it "stays marked even when greyed, and returns when
    it can".
  - But the pay uses the stored pace while the length uses the next open one. A flare stop with
    Quick stored pays 0.1 instead of 1, and Slow ×100 in the Dark Era pays ×100 for a ×10 turn.
  - "Sleep deeper" (events.ts:908) can set a pace out of range, which lights nothing until the
    next turn clamps it.
- **Proposed, one rule for the pace.** A turn's share is the number of Tide turns' worth of time
  it covers: the Tide's turn is 1, Quick ×10 is exactly 0.1, Slow ×10 exactly 10.
  - Length: a Quick ×10 turn splits the Tide's ladder in ten, Tide × (g^(1/10) − 1)/(g − 1)
    (about 0.06 of the Tide in the Degenerate Age, 0.025 in the Black Hole Age), so ten Quick
    turns are one Tide turn in years. Slow ×10 is ten Tide turns in one.
  - Everything that happens per turn in time is scaled by that share: pay and upkeep, as now; and
    decline, freezing, core heat, seeded life, rust and swarm bites (item 4). The Dusk's
    acceleration counts Tide turns from the date, computed live with no new state.
  - Then "×10" means ×10 everywhere: turns, pay and the life of a world. Totals over an age are
    the same at any pace.
  - Clocks and flares keep their own turns and pay by the share of time they cover, which ends
    the flare-clock and flare-stop mismatches.
  - Item 5: the pace actually used is the one lit, through `effectivePace(state)` in the HUD,
    the pay, the projection and the Society screen. The stored choice shows a faint outline and
    comes back by itself when it can, as the 3 Oct change meant. "Sleep deeper" keeps to the
    range.
  - This changes the economy at every pace but the Tide. The autoplayer mostly plays the Tide,
    and the harness will show it.
  - **The player chose "Ten per Tide turn"**, and asked "why 17,000 times?". The answer: each
    Tide turn of the Degenerate Age is 2.82 times the one before, so ten of them are
    1 + 2.82 + … + 2.82⁹ ≈ 17,500 times the current one. The time since the age began grows
    31,800-fold, about 10^4.5. The same figure is about 37 in the Dusk (×1.27 a turn) and
    8.7×10^9 in the Black Hole Age (×12.6). Today's Slow ×10 covers only about 2.9 Tide turns but
    pays 10.
  - **A turn never runs past the end of its age.** With the ladder, Slow ×100 (Hibernation
    Protocols) is 100 Tide turns, more than an age holds (the Degenerate Age has about 67). A
    turn that would pass the crossing ends at it, paid for the Tide turns it covered. The Dark
    Era's λ-clock follows the same ladder (g^(10^-pace)), with the same stop at its end, in place
    of its ×0.5 to ×2 clamp.
  - Both versions (the player: "Both versions").

**Items 1 and 6. The seas drawn versus the text** (render only; the same code in both
versions).
- **The text** (`waterState`, physics.ts:1471-1502) reads liquid as 273 to 373 K, and judges a
  locked world by its day and night sides:
  - "open sea on the day side, ice beyond the terminator";
  - "…open water along the terminator, the day side boiled dry";
  - "all frozen" when day < 273.
- **The shader** (`src/render/shaders/bodies.ts`, uniforms at systemView.ts:515-520) disagrees
  in five ways:
  1. **Item 6.** An eyeball's sea is drawn by `eyeStrength`, which ramps from 150 to 240 K
     (systemView.ts:1206-1210). So a day side of 240 K shows full seas while the text says "all
     frozen". Example: an eyeball at 0.05 AU from a 0.1 M☉ star, 109 to 269 K, a full sea.
  2. **Eyeballs' and terrestrials' seas follow vitality, not temperature** (`warmZone`). Below
     vitality 0.45 (every generated one), ice always covers the terminator, so a terminator sea
     is never drawn.
  3. **Ice worlds** melt from 263 K, so a partial sea shows where the text says frozen. Their
     boiled day side stays sea under a steam veil, where the label says "baked dry". On hot
     worlds the liquid band falls on the unlit side, so it is black: the light is
     `max(0, n·l)`.
  4. **Super-Earths (and bare rock) never draw water**, though every close-in locked super-Earth
     reads "open water along the terminator". Example: 0.015 AU, 185 to 490 K, drawn as plain
     rock.
  5. **"Locked"** in the render is `eyeball || tidally_locked`. The text's is the trait and some
     light. So some eyeballs are drawn locked but described as turning, and rogue worlds keep it
     in the dark.
- **Fix: one sea for both.** A function in physics gives the band of the sunlit side where water
  is liquid. It is used by `waterState` for the text and by uniforms for the shader:
  - **The profile across the day side:** local radiative balance, T(f) = max(T_night,
    T_sub × f^¼), with f the sine of the star's height and T_sub from the same model as the day
    side. The night side is at T_night.
  - **Liquid** where 273 ≤ T(f) < 373. Ice below. Rock above, dry, under a steam veil only for
    real steam worlds (a `uSteam` uniform).
  - So a hot locked world gets a lit ring of open sea just inside the terminator. For the 490 K
    super-Earth that is f from 0.10 to 0.34, the star 6° to 20° up.
  - A world whose substellar point is above 273 K but whose day side averages below it gets a
    small sea under its star. The text will say so ("a small open sea under its star") instead
    of "all frozen".
  - The shader takes the band's edges as uniforms (`uSeaFrom`, `uSeaTo`) and draws water in every
    branch that has any (super-Earths and bare rock with water and air too). Vitality colours
    the land only.
  - Locked comes from the climate (`climate.day !== undefined`).
  - A thin twilight term lights worlds with air a little past the terminator, so the band is not
    black.
- **Checks:**
  - a unit check that the band and the text agree over a range of worlds;
  - the `lowvision`, `a11y` and render browser checks;
  - screenshots of the four cases before and after.

## Order of work (all of it)
1. **A**, the promises batch: validate, docs, push `next`, the PR into `main`, merge, check it
   live, merge back.
2. **C**, the list:
   - items 7, 1 and 6 first: bugs, rules unchanged except the event's test;
   - then items 3 to 5, the pace (a rule change, with the harness);
   - then item 2 together with B, since more hole worlds mean more falls into holes.
3. **B**, falling worlds, with item 2.
4. Each batch is validated, pushed to `next`, and for today's game merged into `main`.

## The player's choices for part C
- The pace: "Ten per Tide turn".
- Versions: "Both versions", for the list's fixes as for parts A and B.
- Item 5: the pace actually used is lit, and the stored choice keeps an outline and comes back
  when it can. This can be changed at approval if the player wants the choice itself switched.

---

# Plan A in full: the game keeps its word (19 Oct)

## Context

The REPLICATE spec turned up places where the game's text promises one thing and the code does another, plus a few rules nobody wrote down. The player's answers:
- **Where:** fix both versions: `/next/` on `claude/epic-wozniak-lyhulf`, and today's game through a PR into `main` that I merge myself.
- **Which way:** change the code to match the text.
- **The hidden step:** make it reachable, without telling the player the details.
- **Falls into brown dwarfs and black holes:** yes, in new games only.
- **Expansion Mandate:** make it a real charter.
- **The unwritten rules:** fix the ones that are bugs; put the rest in the Manual.

Research (both versions, with file:line) is in the scratchpad:
- `research-a897184a2b5b2d3bb.md`: swarm visibility, swarm paths, Communion.
- `research-a3184bc47821ad932.md`: crossings, difficulty, Accord.
- The fall-in and hidden-step report comes out of `tasks/a9d66cfd4284da0d9.output` with the same `python3 -I` extraction. Its hidden-step section is spoiler material: the player never sees it.

Every promise below is broken the same way in both versions. The code around them differs: `/next/` has many civilizations (`state.civs`, owners, `hungerAct` for Taint, a separate RNG stream per civilization), so each fix is written twice.

## Changes

### 1. The Long Record: "+1 Accord per settlement"
- `sim/economy.ts`: change `accord += dormant ? 0 : 0.25` to `1` (main line 262, next line 315), and add the yield line "The Long Record +1" so the settlement tooltip lists it.
- The projection already calls `colonyTurn`, so the HUD follows on its own.
- Risk: on 4 Oct Accord was halved because it filled to its cap. I'll report the Accord stock alongside the harness numbers.

### 2. Hunger Studies: "reveals swarms within detection range and forecasts their paths"
- **One rule for what we see.** A new helper `swarmSeen(state, sw)` in `ui/util.ts` or `sim/hunger.ts`.
  - It builds on the detection "eyes" that `updateDetection` already uses (`sim/fleets.ts`). I'll export those as `eyesOf(state)`, worked out once per turn.
  - An awake swarm at a known star is seen, as today.
  - A swarm in flight is seen only within detection range. Today every swarm in flight shows, anywhere in the galaxy.
  - With Hunger Studies, sleeping swarms within range show too: dimmed, marked "asleep" on the map and in the system panel, with a "nest asleep" chip on settling sites.
  - The galaxy map's `syncSwarms` and `nearestSwarmSeen` use the helper. `swarmSeenAt`, which the autoplayer reads, stays as it is.
- **Paths, with Hunger Studies:**
  - Each seen swarm in flight gets a dashed line from where it is to its destination, drawn like the fleet path lines (`galaxyView.ts`) in the swarm colour.
  - The swarm's panel says where it is heading and when it arrives. Arrival = now + (distance − traveled) / speed, with speed 0.05 c in the Dusk and 0.5 c after.
  - The existing `hunger` forecast ("A swarm is heading for X") gets that date, and its uid gets the swarm id, so two swarms no longer share one key.
  - Without the tech, the forecast stays as today (no date), but only for swarms we can see.
- No new state, no random draws, nothing the autoplayer reads. So this changes no numbers.

### 3. The Communion Charter: "Swarms merge into your Lattice instead of attacking you"
- A swarm (not tamed) that reaches, or sits at, a star where a civilization under Communion has a settlement merges into it the way `absorbSwarm` does:
  - Lattice `max(1, round(size/1.5))`, plus a Lattice Foundry;
  - the swarm is gone;
  - Taint +8. In `/next/` that goes through `hungerAct`, which the lint check requires.
- Where it happens:
  - just after arrival, in `updateHunger`, after `rejoin`/`loseTheScent`;
  - at the start of the branch for swarms already sitting at a star.

  Neither spot draws at random. A merge removes that swarm's later draws, but only in games where the charter is held. The autoplayer never takes it, so the harness is unaffected.
- `firstSwarm` no longer attacks a civilization under Communion.
- The forecast for a swarm heading to us reads "coming to join us" (severity info) under Communion.
- Tamed swarms stay held, as now. Taint from held swarms already matches the charter's text.

### 4. Harsh: "crueller crossings"
- A helper `crossingHarm(state, era)` = the protocols multiplier × 1.25 on Harsh. It is used only inside `crossing.ts`: in main where `crossingMult` is computed, in `/next/` at the crossing's calls to `protocolsMult`. The Passage, the Thinning and the collapse are not touched.
- What it scales:
  - the Last Light's Kin, Echo and Lattice losses;
  - the Kin over room at the Last Warmth;
  - Lattice losses and the carried share at the Great Decay;
  - Continuity and the energy cost at the Last Horizon.
- Each loss stays below what there is; the largest is the Last Light's Kin share, 0.7 × 1.25 = 0.875.
- In `/next/` the neighbours get it too: it is one setting, like Harsh research costs.
- No random draws are added.

### 5. Worlds fall into brown dwarfs and black holes (new games only)
- **Which games.** `generateWorld` sets `state.flags.all_fall = 1` without a random draw, so seeds stay as they are. Saves without the flag keep today's rule. There is no change of shape, so `SAVE_VERSION` stays.
- **One rule in one place.** A helper `fallsInAt(state, b)` (physics.ts) returns the date, or Infinity.
  - White dwarfs, black dwarfs and neutron stars use the stored `inspiralAt`, as today.
  - With the flag, brown dwarfs and black holes get a live date from `inspiralTime` with the star's true mass. Generation floored the mass at 0.1; brown dwarfs are 0.03–0.075.
  - Rogue worlds and the void never fall in. A star still burning (collision star, helium star, dark star) waits until it dies.
- **Who uses it:**
  - `evolveUniverse` (physics.ts ~737), which acts on the date;
  - the `inspiral` forecast (forecast.ts ~75);
  - `lastsUntil` (sites.ts ~104);
  - the Drawer's "Falls inward" row.

  This also fixes the false warning in old saves.
- **What happens:**
  - **Brown dwarf:** the world is torn apart outside the dwarf (Roche limit about 0.003 AU) and rains onto it. It feeds the dwarf for ×0.008 of a white dwarf's warmth, since GM/R is about 120 times smaller. The duration τ is fixed at 10^14.8 years, so it needs no random draw, and the dwarf does not rekindle.
  - **Black hole:** the world is torn apart far outside the horizon and dissolves within the turn ("a flash, then nothing"). The flare lasts years, nothing over a turn.
- **Settlements** are evacuated through the existing falling-world path: three in four people get off to the Deep.
- **Codex.** "Planetary fates" gets the physics. In old saves the Drawer still says "never", with the bend named.

### 6. The Expansion Mandate (new charter)
The ship discount is already in `buildCost`. I add the charter to `data/charters.ts`. Proposed values:
- Dusk, tech Fusion Drives (the Ark's tech), cost 20 Accord.
- Standings: Kin +6, Coldminds −6. Resolve +2.
- Description: "Every settlement owes the dark a ship. The slips run first."
- Effect: "Ships cost 20% less industry." It stacks with the Warden's Oath.
- The autoplayer's charter list is not changed.

### 7. The unwritten rules
- **Fix, in both versions:**
  - A met demand no longer pulls a standing above 80 down to 80 (`society.ts:78`).
  - A growth point is paid for only when the person is added (`turn.ts`, main ~390, next ~681).
  - The projection counts Spare work (`spareYield`) in the energy, matter and insight figures. The autoplayer reads the projection, so the harness will show it.
- **Fix in main only:** when matter is gone, its upkeep is paid in energy, as `/next/` does with `MATTER_AS_ENERGY`. Today a Lattice wears out each turn instead.
- **Manual:** starvation strikes at most three settlements a turn; without Merge Consent, merges can repeat within a turn.

### 8. Small things
- **Low energy:** `.hazard-edge` gets its style in `styles.css`, an amber edge on the energy cell, so the warning shows.
- **Unused tech flags:** `halo_siphons` and `proton_known` are removed from `techs.ts`.
- **The sleeper vault on the Deep:** its text reads "In orbit around …" rather than "Under X Deep". No random draw changes.
- **The unused painting** belongs to the hidden storyline. It goes on that storyline's message; the details are in the sealed note.
- **Left as they are:** the fate draw at setup (changing it moves seeds), main's unused `holdElements`, and the clock-drift formula (it gives the same result either way).

### 9. The hidden step
- A small change in `crossing.ts` and `minds.ts`. A later crossing does what the game's own text for that stage says, so the step can be reached.
- Details go into `docs/spoilers/` and a unit check. CHANGELOG gets one vague line.
- The autoplayer may now reach it, so the harness will show it.

## Order of work
1. **`/next/` (work branch).** Commits:
   1. promises 1–4;
   2. fall-ins;
   3. the unwritten rules and small things;
   4. the Expansion Mandate;
   5. the hidden step.

   Each fix gets a check in `tools/checks/unit`, and there are browser checks for the swarm path lines, the asleep marks and the low-energy edge.
2. **Validate:** tsc, build, playtest, savecompat, `npm run check`, the browser suite, and the harness:
   - 300 standard, and 900 if it moves;
   - 300 Harsh (`--diff=harsh`), before and after;
   - by fate.

   Then docs, and push the work branch and `next`.
3. **Today's game.** Branch `claude/promises-main` from `origin/main` and port the same fixes to main's code. Validate the same way, including the harness. Open a PR into `main` and merge it with a merge commit (`expectedHeadSha`). Check the Pages run and the live site.
4. **Then** `git merge -s ours origin/main` into the work branch, after checking that main has nothing the work branch lacks, and push it and `next`.
5. **Docs:**
   - CHANGELOG, DEV-NOTES, SESSION-NOTES (the player's words), HANDOVER and CLAUDE.md, with the new balance references and PR numbers;
   - REPLICATE.md, moved to the new main commit: its mismatch notes become the new rules, and its sealed part is updated.

## Verification
- Every new check passes, and the old ones still pass in both versions.
- savecompat: old saves load and keep the old fall-in rule.
- Every number the player reads, in a fresh game:
  - Accord income +1 per settlement with The Long Record;
  - a swarm's path and date shown only with Hunger Studies;
  - a swarm merging under Communion;
  - Harsh crossing losses at ×1.25 compared with Standard on the same state;
  - a brown dwarf world falling in at its date, and the settlement on it evacuated.
- Harness numbers reported for both versions: survivors, victories, the Degenerate Age, and by fate, against today's 154 / 72 / 72 (main) and 153 / 63 / 70 (`/next/`).
- No spoiler about the hidden storyline in any message to the player, and none outside `docs/spoilers/` and the sealed part of REPLICATE.
