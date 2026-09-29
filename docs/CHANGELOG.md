# Changelog

All work on branch `claude/lucid-newton-30cbpk` (PR m1omg/Steliterate#1). Every batch was
typechecked, built, playtested (`tools/playtest.cjs`), balance-checked when rules changed
(`tools/sim.ts`), pushed (GitHub Pages redeploys) and republished to the artifact
https://claude.ai/artifact/BWqtVocJezc4XXmnNgWZzc. Balance figures are "games that survive
(Endurance + Victory) out of 300 standard competent autoplayed games"; noise is about ±12.

## Foundations (27 Sep)

- `3d34cda` Scaffold: design doc, Vite/TS/Preact/Three, core types, cosmic calendar, icons.
- `8852694` Simulation core: the Coalescence, tempo and pace, society, other minds, crossings,
  endings.
- `489a6a8` Rendering, interface and procedural audio.
- `84a766a` Painted plates and recorded music (Dusk and Degenerate tracks, ElevenLabs via Krea).
- `2daa00d` Rebalance tempo and energy; smarter autoplayer.
- `551fb1a` Playtest with exact 30/144 Hz parity, README, design doc, artifact packaging. The
  71-turn save from this version is the save-compatibility test save.

## Play, map and systems (28 Sep, early)

- `7e4aa5b` Guide for the first turns; gameplay manual in the Codex; keyboard shortcuts;
  Settlements and Fleets lists; research-complete prompt; closable forecasts, toasts, to-do chips;
  compact HUD. Fleet sprites; click a planet to fly to it; discovery pings; unsurveyed systems
  show only their star; eyeball homeworld cities and night-side ice. System Lighter (settle
  another world of the same star, no research); survey discoveries grounded in astrophysics;
  water and temperature for every world; living worlds die without a sun unless warmed; research
  draws power, paused research banks half; trip estimates simulate lengthening turns.
- `db96b26` Painted ship sprites (Higgsfield) instead of the arrow glyph.
- `0032b5b` Painted plates for the 13 survey discoveries; a looping living title painting;
  the Lattice no longer called non-conscious outright (rules unchanged).
- `4b4f164` GitHub Pages deploy on every push (gh-pages branch).
- `9bd94dc` Honest laws (Rationing, Consume/Salvage the Dead, Child Quotas, Sanctity of Flesh,
  Right to Stop, Stillness petition fixed or given the effects their text promised). Touch: tap
  the selected star to look inside; zoom toward the pointer; zoom in/out to enter/leave a system.
- `3211f43` Mobile: recover from WebGL context loss; labelled rail; real Menu; build list shows
  what one more of each structure does here.
- `ddd2f55` Save format version + `migrate()` on every load; pausable orbits (P); focused
  worlds stay in focus.
- `1b1b9e2` Research: no negative turn counts; stored insight finishes projects; scholars spend
  surplus on cheap projects. (120/300)
- `4bf5c30` Idle-ship prompts; Fortify (warships count double vs swarms, fortified over the
  capital turn raiders away) and Hold; black-hole accretion disks light collectors; softer
  highlights; Echo growth hints. (121/300)
- `126f6aa` Living-world notices; Surveyed worlds list (W); manual rules for room.
- `9ca1edc` Save file export/import; interface size really zooms the UI; planet lists in
  panels; one click selects, double-click flies.
- `1c38c60` Restrained bloom (threshold 1.0, strength 0.28, radius 0.18; no lens dirt); AA city
  lights; view modes Natural / Enhanced / Thermal (V); surveyed/living rings on the map;
  Auto-explore; Choose on map; follow a fleet; trip times "~26t · 2.9 Myr"; forecast turns follow
  pace; galaxy view centring fixes; event pivot checkbox. (121/300)
- `c6fb6da` Kin settle lists by habitability; worlds by system; Stillness pace fix. (124/300)
- `2c5afc8` Edge-of-map long-baseline scans (probe 3 stars, other ships 1, up to 60 kly);
  probes see 3× range; honest "Nearby" heading. (600 games: 232 vs 251 without)
- `8aa21ed` Save slots (gzipped, ~74 KB); events carry their place; disc-aware clicking of
  focused worlds; collectors named for what they gather (Solar Arrays / Glow Arrays / Infrared
  Nets / Beam Arrays / Disk Arrays); a dead-star eyeball shown as a frozen world. (121/300)
- `e4817d6` Collision stars head every chart in the Degenerate Age (✦ on the map).
- `226abaf` Other civilizations a little closer (first within the 2 nearest clusters, second
  within 5); heard from 25× star range or on survey; first contact announced; ◈ names in their
  colour. (112/300)
- `3dca9ed` First contact is its own event ("We Are Not Alone"); start with Vigil (a Warden on
  Hold); the first swarm near one of our ships (60 ly) can come for it; one nest moved into the
  2 nearest clusters. (119/300)
- `044b5e2` The first swarm only attacks 55% of the time ("It paid X no attention. Yet.").
  (116/300)

## This stretch of the session (28 Sep, late)

- `278f529` **Raid order.** A warship parked at a contacted civilization's star can Raid it
  (click twice). All warships there join; success takes part of their reserve (≈5 + 40% of it,
  max 60 energy) and matter; failure hurts our ships. Always: their disposition −35, every other
  contacted civilization −10, Resolve −3, Dissent +4; once per 5 turns per civilization. A
  civilization raided into deep hostility may come back for it.
- `4108d98` **The Last Flare + Canon.**
  - When a settled red dwarf leaves the main sequence the turn stops there (`turnStep` clamps to
    `blueAt`) and an event gives the numbers: ≈174× brighter for ≈4 Gyr; homeworld mean
    298 → ≈1,080 K, day ≈1,290 K, night 187 → ≈680 K.
  - Nobody can live on the surface while even the night side is above 340 K. Kin retreat into
    Night-side Shelters (3 Kin each, 10 matter, max 4, dug as matter allows; buildable only at a
    blue dwarf); unsheltered Kin are lost one a turn per settlement.
  - Choice: keep time with the flare (6 turns at ⅙ of it each, lived in full; collectors there
    ≈3×) or let it pass within the next turn. Seas boil away either way (vitality −0.6, water
    −90% over the flare); scorched worlds die as bare rock.
  - Blue-dwarf light now follows the share of a turn the flare covers. Pace panel shows
    "Flare clock · turn N of 6"; forecasts warn of the heat.
  - Music: Pachelbel's Canon in D (public domain), arranged and synthesised by
    `tools/music/canon.py` in a dark, slightly bit-crushed tracker style after Barry Leitch's 1991
    Utopia Amiga module; plays once as the Degenerate Age's overture. (116/300)
- `07cb1ba` **Hiss fix.** The procedural score's tape hiss bypassed the synth fader and kept
  playing under recorded tracks; it now fades out with the synth.
- `a43816b` **Any ship surveys**; Ruins "Read again" and clickable find chips reopen survey
  reports (choices kept in `Body.lore`, else looked up in the Record); **thawed oceans** (a frozen
  wet world melted to 273–340 K by a flare has room for 5 Kin without domes; 340–373 K is a hot
  sea). Loading a save surveys systems where our ships already sit. (115/300)
- `a666f37` Flare event names every settled world it heats (and airless locked worlds' cold
  night sides); shelters only where the surface becomes unlivable.
- `c6edc66` **Settle by what each mind needs.** Sorts Habitable/Room/Power/Matter/Lasting in
  Surveyed worlds; settler lists rank by their kind (Kin livable ground, Echoes/Chorus power,
  Lattice matter, Coldminds how long a world lasts). **Echo archive:** Echoes from events go to
  free substrate (capital first), the rest wait at no cost until a core has room. (126/300)
- `384e5ca` Settler list sort buttons (Best for them / Livable / Power / Matter / Lasting /
  Nearest); power tooltip lists its parts.
- `aff6571` **Inverse-square sunlight for surface Solar Arrays** (×(a_std/a)², 0.05–2.5; the
  homeworld at 0.031 AU is ×1; remnants use the system's middle orbit; orbital collectors
  unaffected); Sunlight row on planet panels; "Best for Echoes: Power" label. (900 games: 341
  vs 347 without)
- `e123522` Loading a save switches the music to its age (the Canon never started otherwise).
- `8ea231b` **Ask for help** (Signals): request and answer travel at light speed (round trip);
  gift ≈ pop × health × (0.4 + disposition/100) + reciprocity (≤60), costs them health;
  failing civilizations have nothing; hostile ones refuse and, if our reserve is under 40, may
  raid (`tempted`); goodwill −6 per ask (−12 if asking again soon); one in flight; once per 8
  turns. **Music track picker** in Settings (any track, or Automatic).
- `09cdd8c` **Other civilizations live on a world of their own** (worked out from their way:
  biological → most livable world; sleepers → warmest core; minds on substrate → the Deep or the
  largest world). Shown in the system and planet panels; cannot be settled over; Seize takes it.
  (114/300; the full playtest was run later, on `1e8a321`, and passed.)
- `d9848dd` **Quieter noise.** The synthesised score's tape hiss is 12 dB lower and its vinyl
  crackle sparser and softer (about 60% fewer grains, half the level). The Canon was re-rendered
  with its tape hiss 13 dB lower (quiet passages −71.8 → −84.5 dB in the 3–9 kHz band), with the
  music and bitcrush unchanged (still −15 LUFS).
- `1e8a321` **A little more Amiga crunch in the Canon.** Glass plucks held at 12.5 kHz (was
  16.6) with 75% crushed mix (was 65%), pads at 14 kHz with 55% (was 45%), bass 35% (was 30%),
  final low-pass 6.8 kHz (was 6.2). Aliasing shimmer (8–14 kHz) in the runs +11 dB, slow lines
  +2.5 dB; still below the old hiss level; key purity, loudness (−15 LUFS) and the quiet hiss
  unchanged.
- `0815fe4` **Other civilizations are drawn in the system view.** Those living on a planet
  (still biological, or a Thread that left us) light its night side with cities in their colour,
  with a thin ring in their colour; sleepers show only a few faint lights that breathe slowly.
  Minds on substrate live in the Deep (or orbit their world where there is no Deep): uploaded
  minds as a flotilla of archive stations, a merged Chorus as one ring-station whose lights
  pulse together, the Lattice as a glowing lattice of identical cells; each with a soft glow in
  their colour. Their world's label reads "‹world› · ◈ ‹name›" in their colour. Rendering only.

## The review of 28 Sep (new session)

On branch `claude/epic-wozniak-lyhulf`, stacked on `0815fe4`. Live since the player had
`claude/lucid-newton-30cbpk` (which Pages builds, with `main`) fast-forwarded to it; the artifact
belongs to another organization.

- `231b7fb` **Handoff.** `npm run savecompat` with a 71-turn save regenerated from `551fb1a` in
  `tools/saves/`; `CLAUDE.md`; notes and design brought up to date. No game code.
- `0b49601` **Interface fixes.** Loading another game's save while looking inside a system no longer
  throws and leaves the view black: a system the loaded game lacks sends the view back to the
  galaxy, and the music follows the loaded age. η stays lowercase in capitalised text (the Dark
  Era chronometer, the ending screen), where uppercase made it Η. The Long Sleep tooltip says
  what it does: four dormant turns, then waking on the fifth with +30% output.
- `f8a2cd6` **Flare clock: six turns, never a seventh.** Six additions of a sixth of the flare
  could land an ulp short of its end, and a seventh micro-turn followed that counted as a full
  flare turn (24 of 163 flares in 100 games). Now every flare takes six. (122/300)
- `a5debf5` **Crossing protocols; black-hole vaults.** Each protocol halves its own crossing only:
  they multiplied across all three, and Last Horizon Protocols did nothing. At the Last Horizon it
  halves the Continuity shortfall and the energy drain. A leptonic vault on a planet of a black
  hole moves into the hole's Deep at the Great Decay instead of losing its Hearth for good.
  (121/300)
- `fa5737d` **Despair counts once a turn;** the Last Horizon's turn counted it twice. (121/300)
- `07459f0` **Small fixes.** A civilization or settlement named "__inf" or "__-inf" is kept as
  "_inf" / "_-inf" (the save format reads those as ±Infinity); `tools/sim.ts` takes its flags
  anywhere.
- `eebeefa` **Other civilizations with no health left fade** at once, not only on a turn we can
  converse with them (some lingered 155 turns, still paying joint income). Their last
  transmission comes only if we can follow their clock; otherwise the Record says their lights
  have gone out. A civilization we never met leaves a hidden tomb. (107/300; 900 games: 325,
  against 358 without this change and 341 at `0815fe4`. Not the lost last transmissions:
  sending them always still gives 327.)
- `b583dff` **Centre on a ship.** A fleet's panel has Centre beside Follow: it puts the fleet in the middle
  of the view and keeps it there as it moves, at the zoom you have (Follow flies in close).
  Clicking the lit button lets go, as the manual already said.
- `b583dff` **Why pace stops mattering at a flare.** When a settled star is about to begin its last flare,
  the Pace panel says the turn stops then, whatever the pace (a slower one cannot take you past
  it); the manual says so too, and that the flare, not the pace, sets the length of its turns.
- `dde4e58` **Last transmissions always reach us.** A fading civilization we know sends its last
  transmission even if we cannot follow its clock: it is an archive, not a conversation (the
  player's choice). About 150 more insight a game in the harness. (111/300; 900 games: 327.)
- `b591f50` **What the Deep is for.** Its panel read as empty (0% habitable, no room, no matter). It now
  says what it holds: orbit (collectors, and the Dyson Swarm, Stellar Lifter and later power
  sources that only live there, buildable by any settlement in the system), and minds on
  substrate; Kin in domes (in the Dusk after Orbital Industry). The manual explains it too.
- `3c56967` **Swarms catch ships.** A ship stopped at a star where a swarm is feeding, with no settlement
  of ours there, is attacked on 70% of turns (20% by a swarm still asleep, half that under
  Blackout). A warship may beat off a small swarm and salvage it; a probe caught by a grown one is
  lost, though its survey gets out first. Exploring probes and the autoplayer steer around the
  swarms we can see, and a ship's list of destinations marks them. (123/300; 900 games: 357,
  against 327. Blind to swarms, the autoplayer gets 116/300 and loses 0.31 ships a game; steering
  around them, 0.15.)
- `a26c428` **Forecasts count the flare clock's turns.** Under a flare clock a forecast counted
  turns at the pace as if the clock were not there ("in 4.5 billion years · ~1 turns" while each
  turn lasted 753 million years). Forecasts, trip estimates and a message's round trip now count
  the turns as they will fall: the flare's six, and the stop when a settled star begins to flare.
  "~1 turn" in the singular. (123/300: estimates only, all 300 games identical.)
