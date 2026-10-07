# Steliterate: Design

A turn-based survival strategy game with real-time animated 3D views, set at the end of
starlight. Think of it as a 4X in which the fourth X is **Endure**: explore, expand,
exploit, endure. You begin on one geologically dying world orbiting a red dwarf at the very
end of the Stelliferous Era, about 90 trillion years after the Big Bang. The goal is to keep
your people alive for as long as the universe allows, and to decide what "alive" means.

The antagonist is the dying universe itself (a little like Frostpunk, at cosmic scale). You
are not alone, but the other minds are part of the world's texture and drama, not rivals on a
scoreboard. There is no conquest victory.

The civilization is never shown. It could be human descendants or something else; the text
calls its original people "the Kin" and nothing more.

---

## 1. Pillars

1. **The universe is the antagonist.** Stars brighten, collapse and cool. Planets are
   stripped away or fall into their dead suns. The galaxy evaporates. Matter may decay.
   Black holes evaporate. Every age removes something you depended on.
2. **Adaptation over conquest.** You win by changing what you are faster than the universe
   changes around you: slower minds, colder substrates, new sources of energy.
3. **Many ways to persist.** Biology, uploaded minds, merged minds, non-conscious processes,
   speculative physics, and a dark path that eats everything. None is the "right" one.
4. **Honest physics, clearly labelled speculation.** Timelines follow the physical
   eschatology literature (Section 11). Where the game goes beyond known physics, it says so.

---

## 2. The Coalescence

The map is one galaxy: **the Coalescence**, a giant elliptical made from dozens of ancestral
galaxies that merged over trillions of years. This is the expected fate of our own Local
Group (whose merger product is nicknamed Milkomeda); in the game, names are invented so the
species stays ambiguous, and the Codex explains the real analogue.

* **Provinces** are the remains of the ancestral galaxies: the core (**the Heart**, with its
  supermassive black hole), three ancestral **Remnants**, two tidal **Streams**, and the
  diffuse **Halo** with its ancient globular clusters (crowded with white dwarfs and
  neutron stars, and home to intermediate-mass black holes).
* Each province holds **reaches**: local neighbourhoods of roughly 10 to 20 systems.
* **The void.** Accelerating expansion carried every other galaxy group past the cosmic
  event horizon long ago (Krauss & Scherrer 2007). Two lonely outliers drift in the dark:
  the Runaway cluster and the Wanderer, a hypervelocity black hole. Beyond them, nothing.
* Display coordinates are compressed per level; travel always uses true light-years.
  Because every turn is longer than the last, the number of turns a crossing takes grows
  only with the logarithm of its distance: around turn 40 the Heart, 60,000 light-years
  away, is three or four turns off while the nearest star is one. The travel estimate
  simulates the lengthening turns rather than assuming today's turn length.
* **Exploring.** A system is only its star until a probe surveys it. A survey charts every
  world (kind, temperature, water, habitability) and has a chance of a **discovery**, each
  grounded in real astrophysics: chemosynthetic life at hydrothermal vents, a natural fission
  reactor's fossil isotopes, a diamond mantle, an interstellar shard on a hyperbolic path, a
  gravitational lens that reveals distant systems, the imprint of an old magnetar, a rogue
  world kept warm by radiogenic heat, and more. Each is a small choice with a cost.
* **Settling.** The System Lighter needs no research: one family of Kin and a dome to
  another world of the same star, crewed from the settlement that builds it. Crossing
  between stars takes Kin Arks (Fusion Drives), Seedcores (Mind Substrate), Lattice Spores
  and Vault Ships. A ready settler lists every valid world, with the natural room for Kin.

---

## 3. Time: every turn is longer than the last

A game must span a planet dying over centuries and black holes evaporating over 10^100
years, with no faster-than-light travel.

* **The Tide.** Each age has a natural turn length that grows geometrically every turn:
  from 40 years at the start of the Dusk to about 10^12 years at its end; roughly doubling
  per turn in the Degenerate Age; about ×12 per turn in the Black Hole Age.
* **The Dark Era advances the exponent itself.** There, each turn multiplies η (the
  cosmological decade, log10 of the age in years), so the calendar runs from 10^100 years to
  about 10^(10^122) years in a few dozen turns. The state stores exact years while they fit
  in a double, and η beyond.
* **Pace.** You can quicken (×10 or ×100 shorter turns: more decisions while a short-lived
  source burns, but energy per turn falls with the time covered) or slow down (longer turns:
  more energy per turn, but the universe moves on faster between decisions). Neither is
  always right: a merger star that burns for 100 million years is a long summer to a mind at
  human speed and a flash of lightning to a Coldmind. Energy storage lets you bank a flash.
* **Travel is sublight.** A fleet advances `speed × turnLength` light-years per turn and pays
  a launch cost in energy. Early on a 10 ly hop takes several turns; later a province fits
  in one.
* **Light-speed contact.** Every message travels at the speed of light. A plea can arrive
  after its sender is already dead.

Typical standard game: 90 to 140 Dusk turns, 40 to 80 in the Degenerate Age (over a hundred if you keep time with every new star), 30 to 50 in the
Black Hole Age, about 20 in the Dark Era.

### Tempo: the clock of the mind

Each kind of mind (a **Thread**, Section 4) lives at a *clock*, log10 of the years one
subjective moment takes, within a range that research widens. The mismatch
`m = log10(turnLength) − clock` is **tempo strain**:

| mismatch | meaning | effect |
|---|---|---|
| m > 0 | the age outruns you | living through the Tide: upkeep ×(1 + 0.3m), output ×(1 + 0.05m) |
| m > 0, from slowing below the Tide | you chose longer turns than your minds can match | the unabsorbed orders of magnitude cost the full extra time: upkeep ×10 per order |
| m < 0 | you are faster than the turn | output ×(1 + 0.4m), min 0.15; upkeep ×(1 + 0.2m), min 0.3 |

* **Only minds can slow themselves down.** When you slow below the Tide, Kin (fixed clock),
  machines and sleepers pay for all of the extra time. Echoes and Coldminds that can stretch
  their clocks pay nothing extra, which is Freeman Dyson's 1979 argument in game form: a mind
  that slows can stretch a finite energy budget over enormous spans. Its limits in an
  accelerating universe (Krauss & Starkman 2000) return as the Dark Era's hard budget.
* **Dormancy** ("burst and sleep"): a dormant turn produces nothing, but upkeep falls to a
  tenth (a twentieth with *The Long Watch*) and energy still comes in. **Long Sleep** ends
  several turns automatically, pausing for any decision; waking gives +30% output.

---

## 4. Threads and society

The civilization is a braid of **Threads**, each a faction with its own yields, upkeep, clock
range, **standing** (0 to 100) and a rotating **demand**.

| Thread | What it is | Strengths | Costs and limits |
|---|---|---|---|
| **Kin** | The original biological people | Industry, insight, accord | Heavy upkeep; fixed clock; need living worlds, domes or warrens |
| **Echoes** | Uploaded minds on substrate | Insight, low upkeep, can slow | Need substrate; drift |
| **Chorus** | Many minds merged into one | Industry, insight, accord | Harder to slow; unsettles others |
| **Lattice** | Self-maintaining processes that ask for nothing; everyone assumes no one is inside, and the game only ever hints otherwise | Huge industry, strain-immune | No insight; matter upkeep; the other Threads resent it |
| **Coldminds** | Minds in vaults near 0 K | Almost free to keep, extreme clocks | Low output; need Cold Vaults |

* Conversions: Upload (Kin to Echo), Merge (two Echoes to a Chorus), Cool (Echo to Coldmind,
  free, the way a starving civilization saves itself), Cold Sleep and waking for Kin.
* **Resolve** is the will to go on; everything scales with it. At zero for six turns, the
  civilization gives up (*The Will Fails*). **Dissent** is how much the Threads disagree;
  above 40 it slows work. A Thread with very low standing and high dissent **forks** away and
  becomes one of the other minds.
* **Charters** are morally loaded laws (about 20): *Cold Sleep Lottery*, *Upload at
  Death*, *Sanctity of Flesh*, *Abandon the Surface*, *The Right to Stop*, *Merge Consent*,
  *Child Quotas*, *Sanctuary*, *Salvage the Dead*, *Blackout*, *Rationing*, *Overdrive
  Protocols* and more. Each Thread approves or opposes each one. The book holds five (nine with
  the Assembly of Threads). A law stays in force until it is **repealed** (since 2 Oct, at the
  player's request: a full book left later laws out of reach for good): a repeal costs the law's
  Accord again, turns every Thread's stance around and adds a little dissent; what a law did
  once stays done, and a windfall does not come twice. The ways of the Hunger cannot be undone.

---

## 5. Economy

* **Energy** is the master resource. Surplus fills a **reserve** with a capacity limit;
  deficits drain it and then starve settlements.
* **The Hearth.** Every settlement has its own small power core fed by what is local:
  starlight, core heat, or a black hole's spin. It can be **overdriven** under the Overdrive
  Protocols charter for more energy, at the cost of damage and a brighter signature.
* **The Hearth** runs on stored fuel and salvage where nothing local is left: a little, never
  nothing (a floor; the panel says so).
* **Matter** is mined from finite deposits and used for construction, fusion and accretion.
  Once matter is gone (the Great Decay, or the Great Evaporation) construction is paid in energy.
* **Taking structures apart.** Any structure gives back the matter it cost (its energy, once
  matter is gone), for a fifth of its industry cost in energy (at least 5); the work that built
  it is lost, so building and taking apart never pays. Refused while it houses people or sleepers
  with nowhere else to go there, or while ships in the queue need the Shipyard. What a building
  does once when finished (Volatile Shepherding's water, a Core Stimulator's heat, a new
  Confluence Node for the Chorus's wish) it does only the first time at a settlement. Matter is
  conserved; dead collectors are a mine of it.
* **Insight** drives research and the Great Works; **Accord** buys Charters; **Industry**
  drives each settlement's build queue.
* Housing costs upkeep only for the share of it that is lived in.
* **Research draws power.** While a project or Great Work runs, the labs cost 2% of insight
  in energy each turn. Research can be paused: the draw stops, and half of each turn's
  insight is banked and carried into the next project, as is any overflow or found knowledge.
  Pausing is how a starving civilization buys a few turns; it is never free.
* **Galactic free energy** (100% at the start) scales every source and deposit for everyone.
  The Hunger spends it, and so do your unsustainable acts: stellar lifting, long overdrive,
  consuming the dead. It never moves the cosmic clock; what disappears early is what anyone
  can do with the time.

### Energy sources by age

| Age | Sources |
|---|---|
| Dusk | Red-dwarf light (arrays, orbital collectors, a Dyson swarm); blue dwarfs, a dying red dwarf's last bright phase (about 174× as luminous; about 3× the light per turn for collectors while you keep time with it); geothermal (declining); fusion |
| Degenerate | **Embers**: white dwarfs warmed by annihilating dark matter (about 10^15 W, 63 K) until η ≈ 22 to 25. The others are cold already (they cool as T ≈ K·t^-½, a few millikelvin as the age opens) and give collectors nothing; the game calls them black dwarfs from η 16.7. An ember cast out of the galaxy dims over a decade of η as it leaves the halo behind. Worlds' core heat runs out after the Last Light (×0.8 a turn). **Collision stars** from brown dwarfs (η 15 until the galaxy evaporates: rarer from η 18.4, none after 21). **Merger stars**: white-dwarf pairs igniting as short, very bright helium stars (sometimes a type Ia supernova); their ultraviolet boils away the closest worlds (warmest ground past 3,000 K, rubble past 1,600 K; gas and ice giants spared), and a heavier one swells into a helium giant (1,000 L☉, 120,000 years) that swallows whatever orbits inside its 0.116 AU. A turn soon outlasts every kind of new star, so each lights as its turn ends (a bend) and can be kept time with, as a flare can: six short turns while it burns, each lived in full, or, for one too brief for six (a giant, a late helium star), a single flash turn; one clock at a time, though a star that outlasts it can be followed on (priced from our own pace, never below 250 energy); with Quickening, Quick ×10 splits each clock turn into ten, each lived as a tenth; free while the next turn is within a hundredfold of its life, then a one-time energy price per tenfold, at most a full store. Any civilization can study one for insight and resolve, which charts its system. Neutron-star spin-down. **Feeding worlds** (Section 7). Black-hole **accretion**. Fusion. The **Penrose process** and **Hawking collectors** can be learned here. Late, if protons decay: **decay harvesting**; under curvature radiation, **curvature collectors** at neutron stars (η 30 to 68) |
| Black Hole | Penrose (finite spin), Hawking collectors (rising as holes shrink), final bursts, accretion only if protons are stable |
| Dark | The reserve; a trickle of speculative horizon siphoning |

---

## 6. Ages and Crossings

| Age | η | Core tension |
|---|---|---|
| **I. The Long Dusk** (late Stelliferous) | 13.95 to 14 | Keep the homeworld alive or adapt; expand; prepare starless power before the Last Light |
| **II. The Degenerate Age** | 15 to 30, 39 or 68, by the fate of matter | Live on embers, feeding worlds and black holes; survive galactic evaporation; prepare for the end of matter |
| **III. The Black Hole Age** | from there to 100 | Spin and Hawking energy; move as small holes evaporate |

Each age is named for the warmest thing in it: the last stars, the dead stars, the black holes,
then nothing warmer than the sky. The Degenerate Age ends when the neutron stars, the last things
warm of their own accord, fall below the glow of the black holes: near η 30 if matter is stable,
at the Great Decay (η 39) if protons decay, when they burst (η 68) under curvature radiation. The
calendar does not move with it: the Tide and every fixed-date event follow the years, which turn
to the Black Hole Age's Tide at 10^40 years (η 39) whatever the fate (`calendarEra()` in
`src/game/fate.ts`); the intro, music, art and event pools follow the age.
| **IV. The Dark Era** | 100 to 10^122 | A finite budget; hold **Continuity** and complete an ending |

**Crossings** are the great storms between ages. Preparation decides what survives:

* **The Last Light:** every remaining star becomes a white dwarf. Settlements without
  starless power, reserves or cold sleep lose people.
* **The Great Decay** (η 39): if protons decay, every planet and baryonic structure dissolves.
  Settlements with leptonic substrate survive, and migrate to the black holes (bringing a
  Penrose harvester if they know how to build one).
* **The Last Warmth:** if matter is stable (η 30), nothing dissolves: the neutron stars cool
  below the black holes, the white dwarfs are named black, and Kin with no warmth suffer. Under
  curvature radiation (η 68) the neutron stars burst, and whatever is settled at one is lost.
* **The Great Evaporation** (curvature only, η 89.5): a storm inside the Black Hole Age. Every
  world and every scrap of ordinary matter is gone, as at the Great Decay; the dwarfs have faded
  before it (white dwarfs η 78.5 to 85 by mass, brown dwarfs η 87), their worlds drifting loose.
* **The Last Horizon:** the last supermassive black holes evaporate.

**The Long Flow** (η 65, stable and curvature fates, until the Great Evaporation; `sim/flow.ts`).
Not a crossing but a change in the world: from 10^65 years even iron flows (Dyson 1979), so a
solid is a slow liquid. Whether it matters depends on how fast a mind thinks, the player's idea:
Kin, the Lattice (self-maintaining) and any mind thinking faster than once in 10^65 years keep a
settlement whole; minds that all think more slowly keep watchers awake (half again their upkeep);
a settlement where no one is awake loses a structure a turn, cheapest first, Cryo Halls last with
their sleepers; leptonic structures never flow. Sleeping costs 0.3 of upkeep instead of 0.1 unless
The Long Watch; ruins no one is digging run into smooth lumps; sleeping neighbours fade twice as
fast; worlds and the stones of the belts run into smooth spheres on screen.

**The fate of matter** is a setting: *protons decay*, *stable*, *curvature radiation*, or
*unknown*. Unknown is one draw (the same single draw as ever, so no galaxy changes): decay half
the time, curvature and stable a quarter each. It is learned from The Proton Question or, near
η 30, from the neutron stars (`revealFate`): decay holds them near 1.5 K, curvature at 30 nK,
and if neither they cool below the holes, which is the Last Warmth itself. Until then nothing in
the game differs by fate: temperatures leave out decay and curvature warmth, the forecast asks
"The end of the Degenerate Age?" at the earliest date, the Chronometer hatches η 30 to 68 with
its dates as questions, and the autoplayer plans for decay. The proton's lifetime really is
unknown; experiments only give a lower limit around 10^34 years.

**Forecasts** telegraph the catastrophes with countdowns: the star leaving the main
sequence, a world reaching its dead star's tidal limit, galactic evaporation, the embers
fading, proton decay, black holes evaporating, a swarm on its way, the free-energy trend.

---

## 7. Planetary fates

Built on the co-designer's speculation notes, which disagree with each other; the game keeps
the disagreement as real model uncertainty.

* **Going rogue is the common fate.** A star passes within about 1 AU of a given system
  roughly once per 10^15 years; close passes strip planets. A rogue settlement loses its
  starlight and keeps only its own heat.
* **Feeding worlds are rare.** A close-in planet spirals into its dead star through
  gravitational-wave orbital decay (an Earth mass: about 5×10^16 years from 0.02 AU, 3×10^19
  from 0.1 AU; a Jupiter mass far faster) and is peeled into a debris disk at the tidal limit.
* **The aftermath is uncertain.** The forecast gives two models and the truth is revealed
  when it happens: a **slow feed** (likely; an Earth mass holds the dwarf at about 50 to
  110 K for 10^14 to 10^15 years) or a **rekindling** (rare; a Jupiter mass can make the corpse
  glow again for billions of years). Disk Skimmers harvest it.
* **The final plunge** ends a feeding world. Its people evacuate to the system's Deep.
* **Living worlds die without a sun.** Every body has water coverage and a temperature
  (equilibrium from its primary's luminosity, internal heat, a greenhouse term; tidally
  locked worlds have a day and a night value). After the Last Light, once a world goes rogue,
  or once even its warmest ground is below 195 K (its own star dead and faded: a white dwarf
  just collapsed is hot, and early in the Dusk it keeps a close world warm for many short
  turns; no world is generated alive that cold), an unwarmed living world freezes within a few
  turns and becomes an ice world
  (enough water) or bare rock, and the game says so. Life under an ice shell, warmed by tides,
  lasts until the Last Light. Orbital Lamps (fusion lamps in orbit) keep one alive and hold it
  at about 285 K; a Core Stimulator slows the cooling.
* The homeworld, bound tightly to its dead star, eventually becomes the fuel that keeps its
  own dead sun faintly warm.

---

## 8. Other minds

* **The Hunger.** Self-replicating harvesters of a civilization that died long ago. No mind,
  no malice: they follow heat and matter like weather, strip systems and bud new swarms, and
  they draw down galactic free energy. They are desperate survivors too, in a cancer-like
  way, and they do not consume every run. You can fight them, hide (*Blackout*), lure them
  with decoy beacons, or decode their makers' command language and **tame** them. Tamed
  swarms can be absorbed as Lattice.
* **Becoming the Hunger.** The dark path: consumption Charters (*Consume the Dead*, *Strip
  the Sleepers*, *Absorb the Weak*, *Communion*), Hunger-derived technology, devouring
  failing survivors. **Taint** brings plenty now, closes endings past 30 and 60, turns the
  other minds against you, and at 100 you become it.
* **Fellow survivors** (0 to 4): other young civilizations with their own way of coping
  (clinging to biology, uploading, merging, sleeping, or the Tessellate, which is not
  conscious at all and speaks only in protocol). They send pleas, trades, refugees, joint
  works and raids; you can help, trade, take them in, go to war, or devour them. You watch
  other lights go out, and some you keep lit. Since 7 Oct they are **living neighbours**
  (`sim/survivors.ts`, `pacts.ts`, `refuge.ts`, `claims.ts`, `war.ts`, `ways.ts`), built on one
  rule: everything between civilizations moves at the speed of light. Not rivals on a
  scoreboard (there is no conquest victory); cooperation pays in people, energy, eyes on the
  Hunger and lights still on beside ours; taking pays once and is heard everywhere.
  * *Honesty.* Help is a beam that arrives when it arrives; what we do at one star changes how
    the others feel when its light reaches them; the Hunger in us (Taint) caps how well anyone
    can think of us.
  * *Pacts* (Mutual Aid, Shared Watch, Open Archives), proposed and answered at light speed,
    priced in accord, dearer with every pact; breaking one is heard everywhere.
  * *Refuge.* A dying civilization that trusts us comes to us, minds as light and flesh by
    ship, and lives on among us (fate *saved*); the Choir joins our Chorus (*absorbed*).
    Sanctuary is heard of, and trusted.
  * *Expansion.* They settle the stars of their own cluster that suit their way of life, slowly,
    never ours; we see it when the light arrives. The Hunger hunts them too, and they ask for
    warships.
  * *War,* narrow and costly: an accord vote, resolve, calm and standing; a siege while they
    arm; an assault we can lose; infamy at light speed and coalitions of those who hate us; its
    heat draws the Hunger; no pacts, trade or refuge while it lasts. It pays only against our
    own people who left us or a neighbour who keeps raiding us, and then only a little.
  * *Ways that meet.* The sleepers wake for new stars and race for them; the Tessellate keeps
    its agreements to the letter and holds us to ours; the Choir gathers the Echoes who wish it;
    a partner at a new star shares its clock; in the Black Hole Age a hole's spin is a commons.
  * *The Hunger* stays possible but hard to fight: allies add eyes and a little strength, never
    a shield.
  * *How they decide.* Each civilization is a light simulation, not a second empire: health,
    people, stars, a clock, and its regard for us. Every turn it lives by its way of life's needs
    (pleas when failing, refuge when dying, warships against the Hunger, settlers when thriving)
    and deals by its own terms and rhythm (`dealings.ts`): it asks for what it lacks, says
    exactly what it gives, and waits longer after every refusal. Its regard moves only by what it
    sees us do or hears of us, at light speed, and it remembers why, which its card shows. Closer
    to Civilization V's city-states (requests and rewards, a relationship) than to its rival
    empires: no one is playing to win against us.
* **The Slow Ones** think around the Heart on clocks of millions of years. You can only
  converse when your own clock comes close to theirs. They matter for the *Aeon Seed*.
* **Sleepers and ghosts:** vault civilizations and archived dead in ruins. Waking them is
  costly and risky.
* **The Unlit:** minds of the dark-matter sector, reachable only through gravity: moved
  masses answered by moved masses. A misread reply can move a world. Their full design is in
  `docs/spoilers/dark-matter.md`.

Not every other intelligence is conscious in the way the protagonists are, and that does not
stop them from talking.

---

## 9. Endings

| Ending | Path | Requirement (summary) |
|---|---|---|
| **The Long Thought** | Continuance | Echoes and Coldminds (6+) reach the Dark Era; complete the *Hibernal Cascade* |
| **One Voice** | Union | Chorus at least half of everyone, all standings high; complete *Confluence* |
| **The Quiet Lattice** | Persistence, kept by the machines | Lattice at least half of everyone; complete the *Archive of Everything* |
| **The Aeon Seed** | Speculative physics (Penrose's conformal cyclic cosmology) | A settlement at the Heart and the Slow Ones' trust; the seed is written as the Heart evaporates |
| **The Last Garden** | Biology | Matter stable (no decay, no curvature radiation); 6+ living Kin reach the Dark Era; complete the *Garden of Embers* |
| **The Hunger** | The dark path | Taint reaches 100 |
| **Recurrence** | Endurance | Still exist at 10^(10^122) years, when the horizon's state recurs |
| Defeat | | *Silence* (everyone gone), *The Will Fails*, *The Fade* (Continuity lost in the dark) |

---

## 10. Presentation

* **Art direction:** painterly cinematic, with the lived-in, soot-stained decay of Fallout
  but none of its 1950s kitsch, and a small dose of cyberpunk neon: thin strips of light
  where people still live. Honest black skies (by η ≈ 14 there is no gas, so no nebulae).
* **"Worn instrument" UI:** gunmetal panels with procedural grime and scratches, chamfered
  corners, worn hairlines, CRT-phosphor figures, stencil labels, hazard striping only for
  danger. The accent follows each age's dominant light (#f28a4f, #93c4ff, #a48dff, #9aa3b0)
  with one neon per age for what is powered and inhabited.
* **Type:** Big Shoulders Display (titles), Saira Semi Condensed (interface), IBM Plex Mono
  (figures), Spectral (narrative).
* **The Chronometer** spans the whole remaining life of the universe, one segment per age,
  with milestones and forecast pins; in the Dark Era it folds into a deep-time ruler on
  log10 η.
* **Rendering:** Three.js with custom shaders (granulating dwarfs, cooling remnants, black
  holes with disks and photon rings, dying eyeball worlds that freeze, Dyson swarms, swarm
  murmurations) and a restrained post chain: a faint, tight bloom only on what is brighter
  than white (light sources carry their own coronae, as in ra-system-alpha), fine midtone
  grain, vignette, edge chromatic aberration. No full-screen haze and no lens dirt.
* **Plates:** eleven painterly images for the ages and events and thirteen for the survey
  discoveries (Krea and Codex image generation), one grade for all (`tools/process-art.mjs`);
  four painted ship sprites (Higgsfield, `tools/process-sprites.mjs`).
* **Refresh-rate independence:** one rAF loop with clamped real-time deltas; all smoothing is
  `1 − exp(−k·dt)`; camera flights and fleet moves follow elapsed time exactly. The playtest
  checks 30 Hz against 144 Hz.
* **Audio:** recorded instrumentals for the Dusk and the Degenerate Age, Pachelbel's Canon in D
  synthesised as the Degenerate Age's overture (`tools/music/canon.py`), and a procedural
  Web Audio score for every age (worn synthwave thinning to drones and near-silence), plus
  synthesised interface sounds. Sound starts after the first click.

---

## 11. Science notes and sources

* Adams & Laughlin (1997), *A dying universe*, Rev. Mod. Phys. 69, 337
  ([arXiv:astro-ph/9701131](https://arxiv.org/abs/astro-ph/9701131)): end of star formation
  at η ≈ 14; blue dwarfs; brown-dwarf collision stars (about 100 per galaxy, η 15 until the galaxy evaporates, about 21);
  galactic evaporation at 10^19 to 10^20 years; WIMP-heated white dwarfs (about 4×10^-12 L☉,
  63 K, fading from η 22 as the halo runs out); proton decay for 30 < η < 40 (about 400 W per white dwarf); Hawking evaporation
  `t ≈ 2×10^67 (M/M☉)^3` years; positronium forms near η 85 and decays near η 141.
* Adams, Laughlin & Graves (2004), *Red dwarfs and the end of the main sequence*.
* Mestel (1952), *On the theory of white dwarf stars*, MNRAS 112, 583: the cooling law
  L ∝ t^-7/5, which the game follows for white dwarfs in the Dusk. Later it is not apt: with no
  insulating envelope left, a degenerate body holds its heat in its electrons (C ∝ T), is
  isothermal, and radiates ∝ T⁴, so it cools as T ≈ K·t^-½ (K ≈ 10⁵ K·yr^½ for a white dwarf,
  7×10⁶ a neutron star, 3×10⁴ a brown dwarf, 10⁴ a world's core): about 3 mK at η 15 (consults of
  6 Oct, checked twice). Dark-matter heating holds neutron stars near 900 K and brown dwarfs near
  4 K (uncertain) while the halo lasts; proton decay, if protons decay, a white dwarf near 0.05 K
  and a neutron star near 1.5 K. The floor is the de Sitter horizon's temperature, 2.4×10^-30 K.
* Landauer (1961): erasing a bit costs at least kT ln 2, so computing is cheaper in the cold (the
  game halves Coldminds' and Cold Vaults' upkeep under a dark sky).
* Dyson (1979), *Time without end*, Rev. Mod. Phys. 51, 447: slowing minds; iron stars by
  about 10^1500 years; tunnelling collapse at 10^(10^26) to 10^(10^76) years; solids are liquid on
  long enough times even at zero temperature, an atom tunnelling out of place in about
  e^S × 10^-14 s with S ≈ 27·√A, about 10^65 years for iron (the Long Flow). Bend: by the same crude
  formula lighter atoms go far sooner (carbon about 10^19 years, oxygen 10^25, silicon 10^40), so
  most rock would flow before iron; the game takes iron's one date.
* Falcke, Wondrak & van Suijlekom (2024), *An upper limit to the lifetime of stellar remnants
  from gravitational pair production* ([arXiv:2410.14734](https://arxiv.org/abs/2410.14734)):
  curvature radiation from bodies without a horizon, τ ≈ 3.4×10^68 yr × (ρ / 3.3×10^14 g cm^-3)^-3/2.
  A neutron star lasts about 10^68 years and bursts at its minimum mass (about 0.1 M☉); a
  1.3 M☉ white dwarf about 3×10^78, a 0.6 M☉ one about 10^82; the Moon about 3×10^89. Bends:
  their homogeneous model evaporates as a black hole does, accelerating; a white dwarf grows less
  dense as it shrinks, so the game has it fade (η 78.5 to 85 by mass) rather than burst; brown
  dwarfs go at η 87 and all ordinary matter at η 89.5, one date for every world. A neutron star's
  glow, some 10^-29 W (30 nK), feeds the Curvature Collector like the comparable Hawking glow of a
  stellar hole feeds a Hawking Collector: worth it only to minds as slow as the age. The effect is
  theoretical and disputed; the Codex says so. Decay or curvature warmth would show in cold enough
  dead stars before η 30 (decay from about η 25); the game keeps the question open until then.
* Krauss & Starkman (2000), *Life, the universe, and nothing*, ApJ 531, 22.
* Krauss & Scherrer (2007), *The return of a static universe*, GRG 39, 1545.
* Page & McKee (1981), positronium in the far future.
* Andreassen, Frost & Schwartz (2018): Standard Model vacuum lifetime around 10^161 years,
  uncertain by more than a thousand orders of magnitude.
* Poincaré recurrence of a de Sitter horizon, about 10^(10^122) years (Dyson, Kleban &
  Susskind 2002).
* Penrose (2010), *Cycles of Time*: conformal cyclic cosmology (speculative).
* Planet inspiral and accretion: estimates from the co-designer's speculation notes. They
  are not peer-reviewed and disagree with each other; the game presents them as model
  uncertainty.
* Speculative and labelled as such: leptonic substrates, horizon computation and siphoning,
  the Aeon Seed, the Unlit.

---

## 12. Balance

`npm run sim -- [games] [length] [strategy] [--diff=gentle|standard|harsh]` autoplays whole
games headlessly. The autoplayer paces from the same projection the HUD shows, expands only
what its energy can carry, cools Echoes as the ages lengthen, and prepares for the decay.

At the time of writing (7 Oct, 900 games; 300 are the least that tell a change from noise):
* **Standard, competent:** about 48% make it to the end of time (435 of 900, 179 of them in
  victory); by fate of matter 40% where protons decay, 68% where they are stable, 44% under
  curvature radiation. The rest fall in the Black Hole Age, fade in the Dark, or, a few, when
  their resolve gives out.
* **Vast:** Great Work victories appear (The Long Thought).
* **Brief:** harder; fewer turns to prepare.
* **Passive** (research only, first choice everywhere): dies in the Dusk.

A thoughtful player should beat the autoplayer; the harness is a floor, not a target.

---

## 13. Scope of this version

A guide for the first turns and a gameplay manual in the Codex; survey discoveries (about a
dozen hard-science finds); climate and water for every world; the System Lighter for settling
within a star; settlement and fleet lists; keyboard shortcuts. All four ages and the three
Crossings; the Coalescence; five Threads with tempo, pace and
dormancy; society (resolve, dissent, demands, forks, Charters); research (about 70 techs) and
Great Works; construction (about 45 structures), settlement and sublight fleets; the Hunger
and the dark path; fellow survivors, the Slow Ones, sleepers and ghosts, the Unlit; about 40
events; forecasts; save, autosave and save codes; the score and plates.

Since 7 Oct, living neighbours: pacts, refuge, expansion, war and the wants of each way of life
(Section 8).

Candidates for later: ship design, more events and relics, an in-game advisor built on the
autoplayer, a multi-scale camera without a view switch, localisation.
