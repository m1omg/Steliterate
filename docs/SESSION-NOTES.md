# Session notes: conversations, decisions, open threads

Notes from the long working session on branch `claude/lucid-newton-30cbpk`, for picking up
where we left off. What changed is in `CHANGELOG.md`; how to work on the code is in
`DEV-NOTES.md`.

## How the player (m1omg) likes to work

- **Spoilers:** keep answers about the game spoiler-light. Never spoil the Lattice's story or
  ending, or the stranger minds met later.
- **Design taste:** likes surprises and non-standard 4X design. The fourth X is **Endure**
  (explore, expand, exploit, endure). Predetermined events every game are not wanted; variety
  and chance are.
- **Saves and balance are sacred.** Never break save compatibility. Check balance with the
  harness whenever rules change, and say the numbers.
- **Discuss before redesigning** the Lattice and diplomacy. Other civilizations: no changes
  beyond what was asked.
- **Physics:** likes physically grounded mechanics (inverse-square light, flare temperatures, a
  light-speed round trip), and wants to be told honestly where the game bends physics.
- **Standing instructions:** use rules of decimal-point arithmetic for signed and decimal
  numbers; keep everything independent of display refresh rate; prefer simple Linux solutions;
  answer factual questions truthfully, using web search for up-to-date or uncertain facts;
  remind the user of the truth if asked to present incorrect information; double-check
  corrections.
- **Environment:** plays mostly on PC (mouse), sometimes touch. Has a live playthrough with saves
  in the browser and continues playing between changes. Leave the preview server running.
- **Music:** loves the 1991 Utopia (Amiga) version of Pachelbel's Canon by Barry Leitch; likes a
  slight bitcrush ("fits the dissonance of the game"); prefers dark ambient synthwave.

## Open threads and pending decisions

- **Next steps:** the player said they may have more changes in mind; wait for them.
- **Living worlds around dead stars (29 Sep): done** at the player's word ("yes, make them
  freeze"), `7b52ab4`; cold-generated living worlds fixed too (`b950f24`, "fix all the things").
- **29 Sep, "fix all the things but rust stays":** rust stays permanent (a scar where the Hunger
  fed). Stage 1 done (`b950f24`, `5d53356`: flare pacing, white dwarfs, cold worlds, relic engine,
  rust explained, look before settling, nearby site ratings, the charter-book message). Next, as
  asked: rust and swarm feeding visible on the planets themselves (done, `07be759`); then Krea
  (the player topped it up: "use it for everything"): recorded tracks for the title, Black Hole
  Age and Dark, and two swarm plates (done).
- **29 Sep, "Go to town" (the player topped Krea up again: alien graphics, event plates, ship
  sprites, more music):** done, plates for four ways of life (garden, upload, chorus, dormant),
  second tracks for the Dusk, Degenerate and Black Hole ages (taking turns) and an ending theme.
  The balance then read 0 again (INSUFFICIENT_BALANCE, 0 units available, 111 needed) though the
  player said they topped up plentifully; they were told. **Pending, when Krea has credit:**
  plates for the Tessellate (lattice; prompt in `DEV-NOTES.md`) and for a Fork; event plates for
  the events that share era art; ship sprites for the classes that share the generic ones; a
  second Dark track (prompt in `DEV-NOTES.md`); a recorded Canon as an option beside the
  arranged one (prompt in `DEV-NOTES.md`).
- **Two sessions (28–29 Sep):** a second session reviewed the game on `claude/epic-wozniak-lyhulf`
  (stacked on `0815fe4`) and, at the player's word, fast-forwarded `claude/lucid-newton-30cbpk`
  to it. Pull before pushing; whichever session works next continues on that branch.
- **Checked in a fresh container (28 Sep, new session)** at `1e8a321` and again at `0815fe4`:
  typecheck; build (the same hashes as the live site); the full playtest (ALL CHECKS PASSED,
  30/144 Hz parity within 2e-15); the harness (114/300 both times, game for game identical);
  and the `551fb1a` save, which loads through Load / import and plays to the end (now
  `npm run savecompat`). The system view draws all five ways of life without console errors.
- **Lattice rework:** not to be implemented until discussed. The player's idea: Greg Egan's
  "jewel" / p-zombie horror. Do not spoil the intended ending.
- **Diplomacy:** the player asked not to change it beyond Ask for help (done) until discussed.
  Deepening talks with other civilizations would need a design talk first.
- **Aid by beam (offered, not built):** sending aid is still instant, which contradicts the
  light-speed rule for messages. The offer: aid travels as a power beam and arrives after the
  light delay, perhaps losing a little on the way.
- **Collectors after the Stelliferous era:** collectors are already renamed for what they gather
  and yield only what their source gives. Ideas not built: dark collectors not counting toward
  signature; dismantling or repurposing collectors.
- **Music via AI:** Krea (ElevenLabs Music v2.5) made every recorded track since the first
  session; Higgsfield's audio tool is speech-only (it forbids general music). An ElevenLabs
  version of the Canon is still to be made; the prompt is in `DEV-NOTES.md`.
- **Blue-dwarf visibility (offered, not built):** a distinct map marker for blue dwarfs.

## Found in the review of 28 Sep (verified)

Decided (29 Sep): a fading civilization's last transmission always reaches us, as an archive that
needs no conversation (the player chose it over losing it when we cannot follow their clock).

All fixed, a commit each (see the CHANGELOG, "The review of 28 Sep"): the flare clock's seventh
turn; the crossing protocols (Last Horizon Protocols did nothing, the others stacked); leptonic
vaults on a black hole's planet; despair counted twice at the Last Horizon; the Long Sleep
tooltip; other civilizations lingering with no health left; loading another game's save from
inside a system; η in capitalised text; "__inf" names; the harness's flags.

Still open:

- **Balance after the fixes:** 327/900 survive, against 341 at `0815fe4` (within noise); the
  fading fix alone measured −33 in 900 games against the other fixes, cause not found.
- **Harness blind spots** (also in DEV-NOTES): every victory is The Long Thought, and the
  autoplayer never tries the other Great Works, raids, asks for help, seizes or devours.

## Questions answered in this session (short versions)

- **Why never a blue dwarf?**
  - The phase is short: about 5 Gyr out of trillions. Adams, Laughlin & Graves (2004): a
    0.16 M☉ star spends ~5 Gyr as a blue dwarf at ~⅓ L☉ and 6,500–8,500 K.
  - At the Tide a turn lasts ≈0.27 × the time elapsed in the Dusk. Blue dwarfs show only around
    turns 58–85 (peak 7–9 in the galaxy, 3–6 charted). Later ones go red → blue → white between
    two turns.
  - The home star (blueAt 9.94e13) used to skip its blue phase inside a single turn; the Last
    Flare event now stops the turn for it.
  - Playing on Slow skips the window.
  - At 8,200 K they look white-blue, not blue.
- **"Physically accurate scaling would make it worthless":**
  - Energy per turn scales with the share of a Tide turn lived.
  - A 4 Gyr flare is ~0.16% of a 2.5 Tyr late-Dusk turn. Even at 174× brightness it totals
    ≈28% of one ordinary turn's starlight.
  - So flare-clock turns count as full turns lived at the flare's pace: a deliberate bend.
- **Flare physics numbers:**
  - The game gives a 0.1 M☉ red dwarf 0.00115 L☉, and 0.2 L☉ as a blue dwarf (174×). The
    0.1 M☉ peak is probably lower in reality; treat it as an estimate.
  - Temperatures scale with L^¼ (≈3.6×).
  - Frozen worlds at ≈75–103 K land in the liquid range. Livable "thawed oceans" (273–340 K)
    are rare in compact red-dwarf systems: about one per five galaxies.
- **Do Echoes need habitable worlds?**
  - No. They live on substrate: a Substrate Core holds 4, up to 6 cores per settlement; later
    Leptonic Substrate and Bastion Shells.
  - A Seedcore unfolds into the first core, so a new Echo settlement starts with 1 core and 2
    Echoes.
  - Energy is one shared reserve. Upkeep is 0.45 per Echo and 0.5 per core.
  - Event Echoes with no room used to fade; now they wait in the archive.
- **What sets a settlement's energy?**
  - The Hearth: 2 × max(0.25, min(1.5, star light), 0.8 × core heat, 1 at a black hole from
    the Degenerate Age on).
  - Collectors:
    - Solar Arrays: 4 each, max 3, × light × Sunlight.
    - Orbital Collectors: 10 each, max 2.
    - Dyson Swarm: 40, one per system.
    - Ember Collectors: 12, at white or black dwarfs.
  - Geothermal Taps: 7 × core heat, max 2.
  - Fuel: Fusion Plants (4, burning matter) and Accretion Engines (30, at black holes).
  - Spin: Pulsar Brake (8) and Penrose Harvester (20).
  - Late ages add Hawking, decay, disk and horizon harvesters.
  - Multipliers: pace (Quick ×10 → ÷10), energy focus ×1.25, overdrive ×1.5, taint +0.5% per
    point.
  - Upkeep: Kin 1.0, Chorus 0.9, Echoes 0.45, Lattice 0.25, Coldminds 0.08, each × strain.
- **Best worlds for matter (Lattice):**
  - Deep Mines give 3 × mineral richness (max 3).
  - Richness by kind: asteroid belts 1.8–2.6, barren rock 1.0–1.7, super-Earths 1.1–1.5,
    terran 0.8–1.2, eyeball 0.7–1.1, ice 0.5–0.9.
  - Hydrogen Skimmers on gas/ice giants: 3 × hydrogen (gas 1.6–2.4, ice 0.9–1.4).
  - A Stellar Lifter gives 7 per system.
  - All matter is × (0.4 + 0.6 × free energy). Mines deplete richness slowly.
- **Thread tempo:**
  - Each thread's clock is log10 years per subjective moment, over a range:
    - Kin: fixed 10^1.6 (~40 yr).
    - Echoes: 1 yr up to the Echo limit, which research raises: Mind Substrate 3.5, Slow
      Instancing 7, Reversible Logic 11, Cold Computation 16, Glacial Cognition 24, Deep-Time 32,
      Abyssal Thought 40.
    - Chorus: 10^0.5 up to the Echo limit − 1.5.
    - Lattice: any (strain-immune).
    - Coldminds: 10^4 up to the Echo limit + 6.
  - Strain is the orders-of-magnitude gap between the turn length and the clock:
    - Turns too long: upkeep +30% and output +5% per order (output capped at +50%); the part
      caused by a slower pace ×10 upkeep per order.
    - Turns too short: output −40% per order (floor 15%), upkeep −20% per order (floor 30%).
- **Diplomacy (spoiler-light):**
  - What there is: signals (requests, trades, shared works, refugees, raids, last messages),
    send aid, Ask for help, raid, seize, and devour (with a dark charter).
  - Everything is shaped by trust and by how each civilization survives. There are no treaty
    screens.
  - Stranger conversations come later with other kinds of minds; not spoiled.
- **Do the aliens have units?** No. Other civilizations have no ships or fleets on the map;
  raids, aid and trades are abstract. Only the Hunger's swarms move on the map.
- **How could energy cross 20,000 ly?**
  - A power beam: spot ≈ 2.44 λ L / D. With 1 µm light and a 10,000 km transmitter the spot is
    ≈46,000 km at 20 kly.
  - The late galaxy has little dust left.
  - A beam arrives at light speed; freight at 0.02c would take ~1 Myr.
- **Request aid, would it ruin diplomacy?** Not with limits; built with them (see the
  changelog).
- **Why did a cold, far super-Earth top the Power list?**
  - Collectors caught the same starlight anywhere in a system, so only core heat set worlds
    apart.
  - Fixed by inverse-square sunlight for surface Solar Arrays, at the player's request.
- **Where are the Hollow Choir?** Civilizations used to be placed only per system. They now
  live on a world chosen by their way of life (a Chorus lives in the Deep).
- **Where do Echoes live before substrate?** Nowhere. Every settler ship brings its people's
  first home; only event Echoes lacked room (fixed with the archive).
- **The preview-server background task:** it's the local `vite preview` on :4173 used by the
  automated browser tests. Leave it running.
- **Are saves compatible?** Yes. Everything since the first published version is optional
  fields or computed live, and the 71-turn test save loads and plays on.
- **Answers from before this stretch (recorded briefly):**
  - Domes are needed when natural room rounds to zero: room ≈ ⌊12 × habitability × vitality⌋,
    so below about 8% habitable (habitability × vitality); a third of that on rogue or feeding
    worlds.
  - Conquest: Seize (warships at their home star) and later Raid.
  - The 4 X: explore, expand, exploit, endure.
  - Nearest civilizations: in one of the nearest clusters (now typically 9–38 kly).
  - Collectors after the Stelliferous era: they are renamed for their source, and yield only
    what that source gives.

## Things tried and learned

- **The Utopia module** (`utopia_-_utopia.mod`, ProTracker M.K.) can be parsed directly:
  - 4 channels and 3 long sampled pads.
  - Speed 8 at 125 BPM, so one row is 0.16 s and a ground-bass note lasts 1.28 s (~47 BPM).
  - 15 patterns, about 2:34.
  - Heavy A01 volume slides and 3xx glides.
  - Voices enter in canon; there are 32nd-note scale runs in patterns 9–12.
- **The rendered Canon** (1.3 s per quarter note, 13 cycles, 2:29):
  - 98.7% of its pitch energy is in D-major notes.
  - It is mastered to about −15 LUFS like the other tracks, peaking at −4 dBFS.
  - It builds from −21 dB to −14 dB and fades.
  - Its voices: a dark string pad for the slow lines, choir for the eighth notes, glassy FM
    plucks for the runs, an 8-bit sample-and-hold crunch, a sub drone, a 5 s dark reverb and
    tape wow.
