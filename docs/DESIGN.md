# Steliterate: Design

A turn-based 4X strategy game with real-time animated 3D views, set at the end of
starlight. You begin on one geologically dying world orbiting a red dwarf at the
very end of the Stelliferous Era, roughly 90 trillion years after the Big Bang.
The goal is to survive for as long as the universe allows, and to choose what
"surviving" means.

The civilization is never shown directly. It could be human descendants or
something else entirely; the text calls them "the Kin" and nothing more.

---

## 1. Pillars

1. **The universe is the antagonist.** The map is not a static board. Stars
   brighten, collapse and cool. Galaxies evaporate. Matter decays. Black holes
   evaporate. Every era removes something you depended on.
2. **Adaptation over conquest.** Rivals exist and war is possible, but the
   pressure that shapes every decision is entropy. You win by changing what
   you are faster than the universe changes around you.
3. **Many ways to persist.** Biology, uploaded minds, merged minds,
   non-conscious processes and speculative physics each lead to a different
   ending. None of them is the "right" one.
4. **Honest physics, clearly labelled speculation.** Timelines follow the
   physical-eschatology literature (Section 9). Where the game goes beyond
   known physics, the text says so.

---

## 2. Time and scale: "scale follows time"

The core problem: a single game has to span from a planet dying over thousands of years to
black holes evaporating over 10^100 years, with no faster-than-light travel.

**Solution: the length of a turn grows as the game goes on, and the map zooms
out with it.**

* Cosmic time is stored in years (a double; 10^141 still fits) and shown as
  the *cosmological decade* η = log10(years), the unit used by Adams & Laughlin.
* Each era has its own turn-length schedule. Turn length grows geometrically
  inside an era:
  * **Dusk** starts at about 40 years per turn and ends above 10^11.
  * **Degenerate** runs from about 10^9 to 10^39.
  * **Black Hole** runs from 10^40 to 10^100.
  * **Dark** runs from 10^100 to about 10^141.
* **Travel is sublight and physical.** Each turn a fleet advances
  `speed × turnLength` light-years. Early on, a 10 ly trip takes several turns.
  Later a crossing of the galaxy fits into one turn, and distance is paid for
  in energy instead of time.
* **The strategic map is hierarchical.** Star systems sit inside *reaches*,
  which are local stellar neighbourhoods tens of light-years across. Reaches sit
  inside galaxies: one merged host galaxy plus a few bound dwarf satellites.
  Display coordinates are compressed per level so all three scales stay
  readable. Travel always uses the true distances.
* **Why only these galaxies:** by 10^13 years every galaxy outside the bound
  Local Group remnant has receded past the cosmic event horizon. Your
  astronomers see one merged elliptical galaxy and a handful of satellites,
  and the rest of the sky is empty (Krauss & Scherrer 2007). The map is
  literally everything that can still be reached.

### Tempo: the clock of the mind

Each Thread (Section 3) thinks at a *clock*: roughly how many years one of its
subjective cycles takes, expressed as log10 years. The **mismatch**
`m = log10(turnLength) - clock` drives **Tempo Strain**:

| mismatch | meaning | effect |
|---|---|---|
| m > 0 | the age outruns you; each turn spans many of your cycles | upkeep x(1 + 0.3m), output x(1 + 0.05m) |
| m < 0 | you are slower than the age | output x(1 + 0.4m), min 0.15; upkeep x(1 + 0.2m), min 0.3 |

* **Kin** (biological) have a fixed clock of about one generation, so they
  grow steadily more expensive as turns lengthen. This is the in-game form of
  "biology is high maintenance".
* Other Threads can **slow down**, up to a maximum clock unlocked by research.
  With *auto-clock* on they track the age. Keeping that maximum ahead of the
  calendar is a research race against cosmic time.
* **Dormancy** ("burst and sleep") is the alternative to slowing down. A
  dormant turn produces no Industry, Insight or Accord, but upkeep drops to a
  few percent and energy still flows into the reserves. The *Long Sleep*
  command skips several turns at once. Doctrines make waking cycles stronger.

This implements Freeman Dyson's scaling argument (1979): a mind that slows
down and hibernates can stretch a finite energy budget over enormous spans.
Its limits in an accelerating universe (Krauss & Starkman 2000) come back as
the Dark Era's hard budget.

---

## 3. Threads (lineages of the civilization)

The civilization is a braid of *Threads*: populations of different substrates
and kinds of mind. Each Thread has its own yields, upkeep, clock range and
**Accord** (loyalty to the whole). A Thread whose Accord collapses can **fork**
and break away as a new independent civilization.

| Thread | What it is | Strengths | Costs and limits |
|---|---|---|---|
| **Kin** | The original biological species | Insight, Accord, natural growth | Needs living worlds or domes; heavy energy upkeep; fixed clock; dies with the stars unless kept in Cold Sleep |
| **Echoes** | Uploaded minds on substrate | Insight, low upkeep, can slow down | Need Substrate cores; drift lowers Accord |
| **Chorus** | Many minds merged into one | Industry, Accord, efficient | Harder to slow; unsettles the other Threads |
| **Lattice** | Self-maintaining processes with no consciousness | Huge Industry, grows on its own, immune to strain | Produces no Insight; wears out (Matter upkeep); alienates conscious Threads |
| **Coldminds** | Minds in cryogenic vaults near 0 K | Tiny upkeep, extreme clocks | Low output; need Cold Vaults; unlocked in the Degenerate Age |

Conversions (all require a structure or tech):
* Kin to Echoes: *Upload Clinic*.
* Echoes to Chorus: *Confluence Node*.
* Echoes to Coldminds: *Cold Vault*.
* Seeding a Lattice from Matter: *Lattice Foundry*.
* Kin can be moved into or out of Cold Sleep at any colony with a Cryo
  Hall.

---

## 4. Economy

* **Energy** is the master resource. Its flow per turn comes from each
  system's primary via the capture structures you build. Surplus goes into a
  **Reserve** with a capacity limit; deficits drain the Reserve and then
  starve populations.
* **Matter** is a stock. It comes from mining and is used for construction.
  It is also fuel for fusion and black-hole accretion.
* **Insight** goes into research.
* **Accord** is civilization-wide cohesion. It is a stock spent on Doctrines,
  and it also backs each Thread's loyalty.
* **Industry** is produced per colony and drives that colony's build queue.
  Unused Industry is salvaged into a little Matter.

### Energy sources by era

| Era | Sources |
|---|---|
| Dusk | Red-dwarf light (solar arrays, orbital collectors, Dyson swarms). Planetary geothermal, which declines. Blue dwarfs: a dying red dwarf's last bright phase, about 3x light. Fusion (Matter to Energy). |
| Degenerate | Dark-matter-heated white dwarfs (about 10^15 W, 63 K, until η ≈ 25). Rare collision stars made by brown dwarfs colliding. Neutron-star spin-down. Black-hole **accretion engines** (Matter to Energy at very high efficiency). Brown-dwarf hydrogen. Late in the era: **proton-decay harvesting**. |
| Black Hole | The **Penrose process**, which draws on a black hole's finite spin energy. **Hawking collectors**, whose output rises as a hole shrinks. The final bursts of evaporating holes. Accretion, but only if protons turn out to be stable. |
| Dark | Your Reserve. A trickle of **horizon siphoning** (speculative). Positronium harvests. |

Each era's sources are finite, fading or both, so over time the economy
shrinks from abundance to careful rationing.

---

## 5. Eras and Crossings

| Era | η range | Turn length | Map | Core tension |
|---|---|---|---|---|
| **I. The Long Dusk** (late Stelliferous) | 13.95 to 14 | 40 yr to 10^11 yr | Your reach, then the galaxy | Keep the homeworld alive or adapt. Expand to the last red dwarfs. Prepare for the Last Light. |
| **II. The Degenerate Age** | 15 to 39 | 10^9 to 10^39 yr | Galaxy and satellites, then scattered remnants | Harvest the ember white dwarfs and feed black holes before the galaxy evaporates and protons decay |
| **III. The Black Hole Age** | 40 to 100 | 10^40 to 10^100 yr | Black holes only | Spin and Hawking energy. Relocate as small holes evaporate. |
| **IV. The Dark Era** | 100 to about 141 | 10^100 yr and up | Nearly empty | A finite budget. Preserve continuity and complete an ending. |

Between eras comes a **Crossing**, a narrative checkpoint. The world state
changes, and your preparations decide what survives:

* **The Last Light (I to II):** every remaining star becomes a white dwarf.
  Colonies that depend on starlight without backup power lose populations.
  Stellar encounters strip some planets from their stars.
* **The Great Decay (II to III):** if protons decay, every planet, remnant
  and baryonic structure dissolves. Only Threads moved to *leptonic* or
  *horizon* substrates survive. If protons are stable, matter persists but is
  frozen.
* **The Last Horizon (III to IV):** the last supermassive black holes
  evaporate.

**Proton fate** is a setting at game start: *Decays* (canonical), *Stable*, or
*Unknown* (randomised, and revealed when researched). The proton's lifetime
really is unknown; experiments only put a lower limit of about 10^34 years on
it.

---

## 6. Rivals, hazards and events

* **Rival remnants:** 0 to 4 AI civilizations, each with a persona
  (Bio-conservative, Upload, Chorus, Lattice). They play by the same rules,
  and they can go extinct in a Crossing. Their dead colonies become salvageable
  ruins.
* **Diplomacy** is kept light: war, peace, non-aggression and knowledge
  exchange.
* **Combat** is resolved automatically by fleet strength, with animated
  engagements.
* **The Hunger:** leftover self-replicating swarms from a long-dead
  civilization that consume Matter. They are a roaming hazard.
* **Relics:** ruins from the trillions of years of civilizations that came
  before. Surveying them yields insight, technology and story.
* **Events:** era-specific narrative choices with consequences. Examples:
  red-dwarf flares, the homeworld's dynamo failing, a brown-dwarf collision
  igniting a new star, systems thrown out of the galaxy, ancient sleepers,
  schisms between Threads.

---

## 7. Endings (multiple paths to success)

| Ending | Path | Requirements (summary) |
|---|---|---|
| **The Long Thought** | Continuance | Echoes or Coldminds reach the Dark Era; research *Asymptotic Mind*; complete the *Hibernal Cascade*; hold Continuity for the final cycles |
| **One Voice** | Union | Chorus majority, high Accord across all Threads, complete *Confluence* |
| **The Quiet Lattice** | Non-conscious persistence | Lattice majority, complete the *Archive of Everything*; consciousness ends but the pattern survives |
| **The Aeon Seed** | Speculative physics (Penrose's conformal cyclic cosmology) | Hold a bastion at one of the last black holes, then imprint the *Seed* on the final evaporation |
| **The Last Garden** | Biology | Protons stable; living Kin (awake or in Cold Sleep) reach the Dark Era; complete the *Garden of Embers* |
| *Endurance* (lesser) | Any | Still exist when the Dark Era's clock runs out |
| **Defeat** | | Every Thread is gone, or Continuity reaches 0 |

---

## 8. Presentation

* **Visual identity:** "light sources of the ages". The accent colour of the
  UI follows the dominant light of each era, drawn from real blackbody
  temperatures: M-dwarf ember (about 3,000 K) in the Dusk, white-dwarf pale
  blue in the Degenerate Age, horizon violet around black holes, and near-grey
  in the Dark Era. The palette drains as the universe dies.
* **The Chronometer** is the signature UI element. It is a log-scale ruler
  across the top of the screen spanning η 13.9 to 150, with era bands and the
  milestones (last stars, galactic evaporation, proton decay, black-hole
  evaporation, positronium decay) marked on it. It shows where you are on the
  universe's whole remaining lifetime.
* **Type:** Cormorant Garamond for era titles and lore (elegiac), Saira Semi
  Condensed for the interface, IBM Plex Mono for figures.
* **Rendering:** Three.js with custom shaders for red and blue dwarfs, white,
  black and brown dwarfs, pulsars, black holes with accretion disks and
  photon rings, dying planets that freeze as their vitality falls, and Dyson
  swarms. Bloom, grain and vignette are added in post-processing.
* **Frame-rate independence:** every animation, camera damping and fleet
  interpolation uses real elapsed time
  (`1 - exp(-k·dt)` smoothing, clamped dt). The simulation is turn-based and
  deterministic (seeded RNG), so nothing depends on the display refresh rate.
* **Audio:** a procedural Web Audio score that changes with each era. Dusk is
  slow synthwave: detuned saw pads, arpeggios, gated drums. The Degenerate Age
  is glassy and cold. The Black Hole Age is drones and sub-bass. The Dark Era
  is near-silence. Generated instrumental tracks provide the main themes.

---

## 9. Science notes and sources

* Adams, F. C. & Laughlin, G. (1997), *A dying universe: the long-term fate
  and evolution of astrophysical objects*, Rev. Mod. Phys. 69, 337
  ([arXiv:astro-ph/9701131](https://arxiv.org/abs/astro-ph/9701131)).
  * Conventional star formation and stellar evolution end at η ≈ 14.
  * Stars of about 0.1 solar masses never become red giants. They grow
    brighter and bluer (blue dwarfs), then fade as helium white dwarfs.
  * Brown-dwarf collisions keep about 100 hydrogen-burning stars alive in a
    galaxy during 15 < η < 23. The galaxy-wide rate is about 10^-11 per year.
  * Galactic evaporation takes about 10^19 to 10^20 years. Most remnants are
    ejected, and a minority falls into the central black hole.
  * White dwarfs that capture halo WIMPs (dark matter) stay at about
    4×10^-12 L☉ (about 10^15 W, 63 K) for η ≈ 11 to 25.
  * Proton decay governs 30 < η < 40. A white dwarf powered by it gives off
    about 400 W.
  * Hawking evaporation governs 60 < η < 100. A black hole of 10^6 solar
    masses evaporates at η ≈ 83; galaxy-sized holes at about 98 to 100.
  * Positronium forms at η ≈ 85 (flat universe) and decays at η ≈ 141.
* Blue dwarfs: a 0.16 solar-mass red dwarf spends about 2.5 trillion years on
  the main sequence, then about 5 billion years as a blue dwarf at about 1/3 of
  the Sun's luminosity (Adams, Laughlin & Graves 2004).
* Krauss & Scherrer (2007), *The Return of a Static Universe*: galaxies outside
  the local bound group disappear from view.
* Dyson, F. (1979), *Time without end*; Krauss & Starkman (2000), *Life, the
  Universe, and Nothing*.
* Speculative, and labelled as such in the game: leptonic substrates, horizon
  computation, horizon siphoning, and the Aeon Seed (inspired by Penrose's
  conformal cyclic cosmology).

---

## 10. Scope of this first version

This version includes all four eras and all three Crossings, the five
Threads, the tempo and dormancy systems, research, construction,
colonization, sublight fleets, simple combat and diplomacy, AI rivals,
narrative events, the endings, save and load, the procedural score, and key
art.

Candidates for later: deeper diplomacy and trade, ship design, more events and
relics, a multi-scale camera that flies from galaxy to system without a view
switch, balance passes, localisation.
