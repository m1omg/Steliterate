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

Typical standard game: 90 to 140 Dusk turns, 40 to 70 in the Degenerate Age, 30 to 50 in the
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
* **Charters** are permanent, morally loaded laws (about 20): *Cold Sleep Lottery*, *Upload at
  Death*, *Sanctity of Flesh*, *Abandon the Surface*, *The Right to Stop*, *Merge Consent*,
  *Child Quotas*, *Sanctuary*, *Salvage the Dead*, *Blackout*, *Rationing*, *Overdrive
  Protocols* and more. Each Thread approves or opposes each one.

---

## 5. Economy

* **Energy** is the master resource. Surplus fills a **reserve** with a capacity limit;
  deficits drain it and then starve settlements.
* **The Hearth.** Every settlement has its own small power core fed by what is local:
  starlight, core heat, or a black hole's spin. It can be **overdriven** under the Overdrive
  Protocols charter for more energy, at the cost of damage and a brighter signature.
* **Matter** is mined from finite deposits and used for construction, fusion and accretion.
  After the Great Decay (if protons decay) construction is paid in energy.
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
| Dusk | Red-dwarf light (arrays, orbital collectors, a Dyson swarm); blue dwarfs, a dying red dwarf's last bright phase at about 3× light; geothermal (declining); fusion |
| Degenerate | **Embers**: white dwarfs warmed by annihilating dark matter (about 10^15 W, 63 K) until η ≈ 22 to 25. **Collision stars** from brown dwarfs (η 15 to 23). **Merger stars**: white-dwarf pairs igniting as short, very bright helium stars (sometimes a type Ia supernova). Neutron-star spin-down. **Feeding worlds** (Section 7). Black-hole **accretion**. Fusion. The **Penrose process** and **Hawking collectors** can be learned here. Late, if protons decay: **decay harvesting** |
| Black Hole | Penrose (finite spin), Hawking collectors (rising as holes shrink), final bursts, accretion only if protons are stable |
| Dark | The reserve; a trickle of speculative horizon siphoning |

---

## 6. Ages and Crossings

| Age | η | Core tension |
|---|---|---|
| **I. The Long Dusk** (late Stelliferous) | 13.95 to 14 | Keep the homeworld alive or adapt; expand; prepare starless power before the Last Light |
| **II. The Degenerate Age** | 15 to 39 | Live on embers, feeding worlds and black holes; survive galactic evaporation; prepare for the decay |
| **III. The Black Hole Age** | 40 to 100 | Spin and Hawking energy; move as small holes evaporate |
| **IV. The Dark Era** | 100 to 10^122 | A finite budget; hold **Continuity** and complete an ending |

**Crossings** are the great storms between ages. Preparation decides what survives:

* **The Last Light:** every remaining star becomes a white dwarf. Settlements without
  starless power, reserves or cold sleep lose people.
* **The Great Decay:** if protons decay, every planet and baryonic structure dissolves.
  Settlements with leptonic substrate survive, and migrate to the black holes (bringing a
  Penrose harvester if they know how to build one). If protons are stable, matter persists.
* **The Last Horizon:** the last supermassive black holes evaporate.

**Proton fate** is a setting: *decays*, *stable*, or *unknown* (revealed by research). The
proton's lifetime really is unknown; experiments only give a lower limit around 10^34 years.

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
  locked worlds have a day and a night value). After the Last Light, or once a world goes
  rogue, an unwarmed living world freezes within a few turns and becomes an ice world
  (enough water) or bare rock, and the game says so. Orbital Lamps (fusion lamps in orbit)
  keep one alive; a Core Stimulator slows the cooling.
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
  works and raids; you can help, trade, take them in, seize their star, or devour them.
  You watch other lights go out.
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
| **The Last Garden** | Biology | Protons stable; 6+ living Kin reach the Dark Era; complete the *Garden of Embers* |
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
  murmurations) and a post chain: halation bloom, a procedural dirty lens, midtone grain,
  vignette, edge chromatic aberration.
* **Plates:** eleven painterly images (Krea and Codex image generation), one grade for all
  (`tools/process-art.mjs`).
* **Refresh-rate independence:** one rAF loop with clamped real-time deltas; all smoothing is
  `1 − exp(−k·dt)`; camera flights and fleet moves follow elapsed time exactly. The playtest
  checks 30 Hz against 144 Hz.
* **Audio:** recorded instrumentals for the Dusk and the Degenerate Age, and a procedural
  Web Audio score for every age (worn synthwave thinning to drones and near-silence), plus
  synthesised interface sounds. Sound starts after the first click.

---

## 11. Science notes and sources

* Adams & Laughlin (1997), *A dying universe*, Rev. Mod. Phys. 69, 337
  ([arXiv:astro-ph/9701131](https://arxiv.org/abs/astro-ph/9701131)): end of star formation
  at η ≈ 14; blue dwarfs; brown-dwarf collision stars (about 100 per galaxy, η 15 to 23);
  galactic evaporation at 10^19 to 10^20 years; WIMP-heated white dwarfs (about 4×10^-12 L☉,
  63 K); proton decay for 30 < η < 40 (about 400 W per white dwarf); Hawking evaporation
  `t ≈ 2×10^67 (M/M☉)^3` years; positronium forms near η 85 and decays near η 141.
* Adams, Laughlin & Graves (2004), *Red dwarfs and the end of the main sequence*.
* Dyson (1979), *Time without end*, Rev. Mod. Phys. 51, 447: slowing minds; iron stars by
  about 10^1500 years; tunnelling collapse at 10^(10^26) to 10^(10^76) years.
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

At the time of writing (60 games for the standard figure; 12 to 24 games are too noisy to
compare changes):
* **Standard, competent:** about 38% make it to the end of time (22 of 60 endure, 1 Great
  Work victory); the rest fall at the Great Decay or in the Black Hole Age, a few when their
  resolve gives out.
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
dormancy; society (resolve, dissent, demands, forks, Charters); research (about 65 techs) and
Great Works; construction (about 45 structures), settlement and sublight fleets; the Hunger
and the dark path; fellow survivors, the Slow Ones, sleepers and ghosts, the Unlit; about 40
events; forecasts; save, autosave and save codes; the score and plates.

Candidates for later: deeper survivor diplomacy, ship design, more events and relics, an
in-game advisor built on the autoplayer, a multi-scale camera without a view switch,
localisation.
