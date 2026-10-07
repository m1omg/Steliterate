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
- `1a72718` **Worlds named for the heat they are in.** A flare heats an ice world to 435–1,219 K;
  its panel still said "Ice world" and "ice on the night side" with that side above boiling. The
  water line now follows the temperatures shown (steam even on the night side, or a sea left
  there; an ice shell or icy rubble only while even the warmest ground is below freezing), and an
  ice world or ice-shelled ocean with no ice left is a Steam world, Thawed ocean or Hot sea, as is
  an eyeball world boiled to steam. In 40 games the water line or the name disagreed with the
  temperatures 22,647 times; now never. (123/300: display only, all 300 games identical.)
- `7b52ab4` **Living worlds freeze when their own star dies.** In the Dusk a living world froze
  only at the Last Light, so one whose star had died kept its life and its room for Kin at
  8–19 K (about 33 a game, for about 22 turns each). Now surface life whose star is dead begins
  to freeze once even its warmest ground is below 195 K: 5% of its vitality a turn, half with
  a Core Stimulator, none under Orbital Lamps. A white dwarf just collapsed is hot, and early
  in the Dusk it keeps a close world warm for up to about 30 turns; late in the Dusk its worlds
  begin to freeze within a turn. Life under an ice shell lasts until the Last Light, as before.
  The collapse forecast and the Record name our worlds that will freeze, the Record again when
  one begins to, and the panel shows Cooling, then Freezing with the turns left. Orbital Lamps
  hold their world at 285 K, so a world they keep alive no longer reads 8–19 K; a frozen
  terrestrial world or super-Earth is a Frozen world. The autoplayer lights Lamps over a
  freezing settlement. (122/300; 900 games: 358, against 357; 85 of 900 outcomes change, both
  ways. The refactor into `vitalityLoss` alone left all 300 games identical.)
- `b950f24` **Flare pacing, young white dwarfs, cold worlds, the relic engine.** Flare turns paid by
  the pace chosen though the flare sets their length (1,696 matter at Slow ×100 against 14 at the
  Tide; the turn that stops for a flare paid 24,534 at Slow ×1000): a flare-clock turn now pays one
  Tide turn whatever the pace, and the stop turn one at most. A white dwarf's light is averaged
  over the turn (the first turn after a collapse got the newborn glow for 2.5 trillion years), and
  its temperature follows its light (12,000 K at the collapse, about 600 K a trillion years on,
  where it read 3,800 K). Living worlds generated below 195 K (about 10 a game) start as ice or
  rock, with no random draw, so seeds are otherwise unchanged; any surface life that cold freezes.
  A restarted relic engine can draw the nearest swarm (it only left a rust mark). (133/300; 900
  games: 390, against 358. Reverting the pace and light fixes together gives 123/300; either alone
  132. The autoplayer used to chase the flare bonus: 84 of 390 flare turns at a Slow pace in 40
  games, now 16.)
- `5d53356` **Look before settling.** Where to settle: a Look button turns the view to a site
  without sending the ship, and each site warns of a swarm feeding there or within its reach; a
  freezing or cooling world no longer ranks by the room it is about to lose. The Nearby list rates
  each charted star for every kind of settler (`27dae58`: Kin room, power, matter, time). Rust is explained (tooltip, manual); a boiled-dry eyeball world
  is a Scorched world; a charter book full at nine no longer says it is full "until the Assembly
  of Threads".
- `5332440` **Rust and feeding swarms on the worlds.** Rust (still permanent) spreads over a world the
  longer a swarm has fed at its star: dull pitted oxide, a haze on giants, a tint on belt rocks.
  While a swarm feeds there, each world it eats has harvesters circling low over it, sparks where
  they cut in, and a stream of motes carrying the harvest to the swarm's cloud. Rendering only.
- `1981611` **Recorded music for every age, and swarm plates** (Krea). Tracks for the title, the Black Hole
  Age and the Dark (ElevenLabs Music v2.5, made to loop by `tools/music/loop-track.py`) replace the
  synthesised fallbacks; the procedural score still covers any track that fails to load. The
  Hunger's panel shows a plate: a swarm stripping a world, or a tamed one at work (Nano Banana Pro,
  graded by `tools/process-art.mjs`). The Krea balance ran out before the plates for the other
  civilizations' six ways of life.
- `8d40caa` **Plates for the other peoples, second tracks and an ending theme** (Krea). A civilization we
  have contacted shows a plate for its way of life on its Signals card and in its star's panel:
  domed gardens under a red sun (clinging to biology), a moon cut into server spires (uploaded),
  a web of linked habitats (merged into one mind), frosted cold-sleep halls with one keeper
  awake (asleep). The Tessellate and any Fork show the generic plate until theirs are made. The
  Long Dusk, the Degenerate Age and the Black Hole Age each have a second track, and an age's
  tracks take turns: one fades out over its last 4 s, the next fades in over 3 s (a lone track
  still loops). The ending has its own theme (G minor, looped; Settings → Music track → The
  Ending). The new tracks are levelled to their age's first track by integrated loudness
  (`tools/music/loudness.py`): Dusk −12.7 and −13.3 LUFS, Degenerate −14.7 and −14.7, Black
  Hole −19.7 and −19.7, the ending −14.2 like the title. No rules change.
- `a16f928` **Event plates, ship hulls, the last two peoples, and a playlist** (images by Codex's built-in
  image tool, on the player's ChatGPT subscription). Sixteen events that showed their era's
  general painting now have their own, over it: the dynamo failing, the census of the dark,
  the last rain, the sea freezing, the mantle settling, the comet, the cryo hall, the prophet,
  the first upload, the new star, the white fire, the supernova, a system cast out, a world
  unmoored, a world falling into its dead star, and a black hole's last burst. The Tessellate
  and the Forks have their own plates. The System Lighter, Seedcore, Lattice Spore, Vault Ship,
  Aegis and Swarm Tender each show their own hull on the map and in the lists, where they
  borrowed the Ark's, the Warden's or the hauler's. Settings → Playlist: each age plays any mix
  of its recordings and the game's own synthesized score, in turn (a synthesized piece plays for
  about a recording's length, 170 s), and the Canon can be left out of the Degenerate Age's
  opening. Fixed: saved settings (volumes, graphics, interface size) were ignored on every load
  since `9ca1edc`; they now come back. No rules change.
- `30c3c7f` **Kinds of structure** (2 Oct; the player: the list "is becoming very long"). Every structure
  has a kind, worked out from what it does: energy (13 of the 44), storage (4), matter (4),
  industry (2), insight (2), accord (1), people (13: room for each kind of mind, cold sleep, the
  conversions, continuity), the world (4: shields, lamps, core heat, volatiles) and defence (1).
  The Build tab groups its list under a heading for each kind, and a row of buttons shows one
  kind at a time (the choice stays across settlements). Each kind has its own coloured icon,
  on the build rows, in the queue (ships get the fleet icon) and on the Overview's
  structures, which are now sorted by kind. Interface only: no rules change.
- `55ff2da` **Charters can be repealed** (2 Oct; the player had filled all nine places in the book during
  the Stelliferous era, so the rest stayed out of reach). In the Charters screen a law in force
  has Repeal…, and then a confirmation that says what the repeal does. A repeal costs the law's
  Accord again, turns every Thread's opinion of it around (those it pleased lose that standing,
  those it hurt get theirs back) and adds 3 dissent; the law's ongoing effects stop at once,
  and Thread demands it answered open again. What it did once stays done: enacted again, Salvage
  the Dead pays no second windfall. Repealing the Overdrive Protocols takes every Hearth off
  overdrive. The ways of the Hunger cannot be repealed (they take no room in the book). Saves are
  unchanged in shape (a repeal is remembered in `civ.flags`); the autoplayer never repeals, and
  the harness gives 133 of 300, the same games as before.
- `c622a14` **Look from the survey message** (2 Oct, as asked). "Survey complete" now has a Look button that
  goes into the surveyed system with its panel open (the first one, when several finish in one
  turn), and "Living world found" one that goes to that world. A message with a button stays up
  12 s instead of 4.5. Interface only.
- `7d0806d` **Systems, and a tab for the collision stars** (3 Oct; the player asked for Settlements to become
  Systems, with "a separate category in the menu for collision stars in the degenerate era
  because they're precious"). Settlements on the rail is now Systems (S still opens it): Our
  settlements and Surveyed worlds as before, and in the Degenerate Age a third tab, Collision
  stars, with every one on our map, the longest-burning first: the light a collector there gets
  this turn, the turns it has left at this pace and the years, and whether it is settled,
  unsurveyed, has a swarm feeding or people living there; a click goes to it. W now also
  switches an open Systems window to Surveyed worlds (it did nothing while the window was open).
  Found on the way: a Degenerate Age turn often outlasts a collision star's whole life (one to
  ten trillion years). In 20 autoplayed games 228 lit, and 203 had already gone out, inside
  the turn they lit in, before anyone could see them; 25 were seen burning, 20 of them for one
  turn only. Such a star kept its name until the next turn, so the map gave it a ✦, every list
  put it first, and its panel showed "Burns until" with a date already past. Now the ✦, the
  lists and the tab count only stars that still burn; the tab lists the others apart, without
  light, and their panel says they are out. The tip no longer calls brown dwarfs dead stars
  "burning again": they never burned hydrogen until they merged. The A New Star and White Fire
  events still describe such stars as burning (left for the player to decide). Interface and
  labels only: the harness gives the same 300 games (133).
- `4fe2404` **New stars burn for six short turns, like the flare** (3 Oct; the player: "make them burn for a
  few turns like the flare with the turns getting shorter as in taking less time"). A collision
  star or a helium star now lights as the turn it forms in ends, so it is always seen alight (a
  bend: the two may have met at any moment of that turn; the draw that placed its birth inside the
  turn is still made, so every later draw is unchanged). Its event offers to keep time with it, as
  the Last Flare does: what is left of its life in six turns, whatever the pace, each lived in full
  and paying as one turn at the Tide. The Pace panel counts them ("Star clock · name · turn 2 of
  6"), the Collision stars tab marks the star, and the forecasts and trip estimates count the
  short turns. A New Star: Race for it, and keep time with it (the system is charted too); Race
  for it at our own pace; Tell the others. White Fire: Keep time with it, or Let it pass (its
  "Quicken while it burns", pace +1, could not catch a star already gone). One star at a time: a
  new star lights about as often as one goes out, so a clock passed from star to star would hold
  the age still. A clock turn must be at least a trillionth of the age, or the calendar's
  doubles round it away (a first version stalled games at 10^23 years for exactly that): late in
  the age a helium star is too brief to keep time with. Saves: two optional `civ.flags`. Balance:
  the autoplayer keeps time with every new star it can, about 12 a game, so the Degenerate Age runs
  127 turns on average instead of 44 and a game 276 instead of 183; 167 of 300 survive instead of
  133, with 117 victories instead of 18 (74 games now survive, 40 no longer do). In 20 games every
  collision star was seen burning, 217 of 352 for the full six turns.
- `d005b05` **Keeping time with a new star has a price, unless we are in tune with it** (3 Oct; the player
  found the free clock "a bit of a cheap shot … every time you can keep pace, even when you're
  deep in the degenerate era", and wanted a civilization that is too slow unable to catch the
  moment, yet able to "keep pace with even the much shorter lived stars" with enough energy
  reserves, for "a one-time energy payment"; White Fire "should be costing some energy for
  everybody"). Measured first: collision stars light through the first two thirds of the age
  (turns 3–31 of about 45), and the typical one lives a fifty-thousandth of a Tide turn; helium
  stars live about a ten-billionth. Keeping time is now free while our next turn is within a
  hundredfold of what is left of the star's life (2.3 stars a game at the Tide, all in the first
  13 turns); beyond, our minds must quicken to it: 250 energy, once, for each further tenfold,
  never more than a full store. A quicker pace pays less, a slower one more, and a White Fire
  usually costs all the energy we hold. The price shows in the event and on its button, and the
  choice is shut when we cannot pay. New choices for anyone, however slow: A New Star's Study it
  and White Fire's Watch the flash (which replaces Let it pass), each Insight +25 and Resolve +2.
  Asked whether a new star's light from light-years away could feed a slow civilization instead:
  no. At 10 ly it is 4×10⁻¹² W/m², against 6×10⁻³ for collectors 100,000 km from a 60 K black
  dwarf, and over a 10¹⁷-year turn a star 5 ly away adds a twenty-millionth of that dwarf's
  output; only in the star's own system would its light outweigh an ember's. The calendar's limit
  for a clock turn is now a ten-trillionth of the age (it was a trillionth), so helium stars can be
  kept up to about η 20.5. The storage cap moved to `sim/storage.ts`. The autoplayer pays only
  while half its store would remain. Balance (300 games): 147 survive, 52 victories, a Degenerate
  Age of 68 turns, against 167 / 117 / 127 with free clocks and 133 / 18 / 44 before any clock.
  Of the rise, Study and Watch alone give none (130 / 26 / 45) and the free in-tune clocks most
  (146 / 44 / 55); at 100, 150 and 400 a tenfold it was 165, 160 and 154 (ages 88, 79, 61), and
  at 20, 40 and 60 without the cap 161, 171 and 163 (114, 104 and 99 turns).
- **Collision stars end with the galaxy** (3 Oct; the player: "collision stars should stop
  happening after the death (gravitational relaxation) of the galaxy"). Brown dwarfs meet only in a
  bound galaxy: their collisions now grow rarer as it evaporates (η 18.4 to 21) and stop once it
  has. They used to go on at the full rate until η 23 among the brown dwarfs not yet thrown out:
  37% of collision stars lit during or after the evaporation, 15% after it. Helium stars come from
  white-dwarf pairs that spiral together by their own gravitational waves, galaxy or not, and still
  light until η 25. The chronometer's Last collision stars moves from η 23 to 21, and the Codex and
  the Collision stars tab say why. In 30 games: 10.7 collision stars a game, none after η 21, and
  5.7 helium stars. Asked whether a slow civilization that pays should only harvest the flash (one
  turn) rather than get time to settle, the player kept the six turns; the price stays 250 energy a
  tenfold, capped at a full store (they suggested 100 or more). Balance: 140 of 300 survive (52
  victories), a Degenerate Age of 67 turns; 241 of the 300 games end as before.
- **White dwarfs keep cooling** (3 Oct; the player: "the ones that capture the WIMP particles …
  should stay at 63K yes but the rest should continue cooling though I don't want to break the
  game"). In the Degenerate Age a white dwarf no dark matter warms sat at 20 K and ×0.05 for the
  whole age. It now cools by Mestel's law (L ∝ t^-1.4, so T ∝ t^-0.35): 20 K at η 15, about 9 K
  at η 16, 5 K at η 16.7 (5.2 × 10^16 years), when it becomes a black dwarf. The player asked why
  a 5 K white dwarf was not simply a black dwarf: no reason, only the name changes, so now it is.
  Its light to collectors falls with T⁴ from ×0.05 (times the galaxy's free energy, as before) to
  the black dwarf's ×0.01; its luminosity for planet climates follows its temperature and size
  (2.3 × 10^-14 L☉ at 20 K, 8.8 × 10^-17 at 5 K, against a flat 10^-15; worlds there move by at
  most about a kelvin). Embers keep 63 K and exactly their light. While the halo thins (η 22 to
  25) their shown temperature now falls with their warmth (T ∝ share^¼: 53 K at half, 35 K at a
  tenth) where it read 63 K to the end, and a spent ember turns black at η 25 (was 25.5). A
  rekindled white dwarf reads 300 K and shows orange on the map, as a rekindled black dwarf does.
  Unwarmed dwarfs grey toward the black-dwarf look as they cool (map colour; surface, glow and
  light in the system view). Plains of Glass can be found at black dwarfs too (the glass stays
  whatever the star becomes). The Codex gains a Black dwarfs entry. Bends, plainly: the 20 K start
  (a real dwarf this old is probably colder already); Mestel's law is gentler than real cooling
  once the core crystallises; 5 K and ×0.01 are floors the game keeps (a real one would go on
  cooling); and the light falls fivefold where the physics says 256-fold. Asked how long the embers
  last: the game's η 22 to 25 is the right order (at about 10^15 W an ember eats some 350 tonnes of
  dark matter a year, and a galaxy's white dwarfs would need around 10^25 years to eat its halo),
  but a white dwarf flung out of the galaxy leaves the halo, and the game keeps it warm. Tested,
  not shipped: cast-out embers losing their warmth, 900 games 430 survive, 145 victories, a
  Degenerate Age of 64 turns, against 425 / 159 / 68 without; the player decides. Balance of the
  cooling itself, 900 games: 425 / 159 / 68 against 432 / 159 / 68 at `6d734aa` (300 games: 135 /
  53 / 67 against 140 / 52 / 67).
- **Following a new star on; Study charts it; the Record names it; ships from the Systems
  window** (3 Oct, from the player's screenshot of turn 93, keeping time with one star when
  another lit: "the text half reflects a civ too slow, half it not being necessary to keep pace,
  should have an option to extend the fast time period"; "observing but not revealing on map
  doesnt make sense but i dunno how to make the choices balanced"; "record should say collision
  star name"; "the selection of stars to go with spaceships should offer the systems menu if one
  wants to see more not just nearby stars"). While we keep time with one new star, another that
  outlasts it can be followed on: its six turns begin as the first clock runs out, priced as a
  fresh clock would be then, from our own pace, and never below 250 energy (still at most a full
  store). One may wait at a time; the Pace panel's chip says "then …" and the Collision stars tab
  marks it "next". The event says plainly why there is no clock: we keep time with it already,
  another star waits, it burns out within our clock (or inside one of its turns: one clock at a
  time), our turns are short enough to see it burn, or it is too brief to count; "Faster minds
  would feast on it" only when it will burn for less than two of our turns and we cannot keep
  time. Study it and Watch the flash now chart the system ("in its light we find its worlds, by
  their shadows as they cross it"), so Race for it at our own pace, which only charted it, is
  gone; keeping time with a White Fire charts it too. The Record names the system of every event
  about one ("A New Star (BD 26·347): Study it.") and links to it. A ship's Nearby list has More
  in Systems…, and the ship prompt From Systems…: the Systems window opens with a Send button and
  the trip on every star in it, any tab. Balance, 900 games: 453 survive, 166 victories, a
  Degenerate Age of 77 turns (the cooling alone: 425 / 159 / 68). Chained freely at the fresh
  price the follow-on gave 461 / 214 / 88 (2.8 follow-ons a game, chains of up to six stars,
  41 of 91 Degenerate turns on a clock); with the floor, 1.7 a game at 311 energy on average, 34
  of 82 turns on a clock; adding one follow-on per chain, 300 games, 150 / 55 / 73; without any
  follow-on 146 / 54 / 67. The Study change alone moves nothing measurable.
- **Cast-out embers dim; Quickening works during a star clock** (3 Oct, the player's decisions:
  an ember flung out of the galaxy "goes cold but of course gradually, not right away"; and
  Quickening should let the pace buttons work while keeping time). An ember cast out by the
  evaporation (or any other way) records the year (`haloLeft`) and dims over the next tenfold of
  years, one decade of η (about two turns at the Tide), then turns black. The bend, plainly: its
  own stored heat would last only some 10^11 to 10^13 years, a sliver of one of these turns; what
  is slow is the leaving, a climb through the thinning outer halo over about a relaxation time
  (10^19 to 10^20 years), and the game starts the dimming at the Cast Out event where really it
  would begin a little before. Its panel says "Ember, dimming"; the Cast Out event and the Codex
  say why. The autoplayer now scores a system +2 only while its ember is warm (it valued spent
  ones). With Quickening, Quick ×10 also works while we keep time with a new star: each of the
  clock's six turns splits into ten, each lived as a tenth of a Tide turn, so the star gives the
  same light over sixty turns and every turn pays its upkeep (never finer than the calendar can
  count; the Pace chip counts "of 60"). A turn that begins between two clock steps (the pace
  changed) now runs to the next step rather than to the nearest. Balance, 900 games: 447 survive,
  136 victories, a Degenerate Age of 68 turns (300 games: 144 / 44 / 68), against 453 / 166 / 77
  before; the dimming alone gives 448 / 144 / 71. Asked why worlds around collision stars are
  always hot: brown dwarfs' worlds orbit very close (0.004 to about 0.05 AU; in one galaxy 29
  worlds, median 0.009 AU), and a collision star (about 0.1 M☉, 1.2 × 10^-3 L☉) is temperate only
  near 0.034 AU, so most of them (23 of the 29) end up above boiling, a few temperate, the
  outermost frozen. That is the inverse-square law; the bend is that they keep their orbits
  through the collision, which would really scatter or swallow such close worlds.
- **Impossible paces greyed out** (3 Oct; the player: "make the 100x, hell, every impossible
  speed, greyed out in situation when its not possible"). A pace button is greyed (and its
  tooltip says why) when it would give the same turn as the next pace toward the Tide: during a
  new star's clock (all but the Tide, or the Tide and Quick ×10 with Quickening), slower than a
  flare's sixth while we keep time with it, slower than a flare that will cut the turn short,
  and beyond tenfold in the Dark Era (where Quick ×100 used to give Quick ×10's turn at a
  hundredth of the yield). The Tide is always open; the pace you are on stays marked even when
  greyed, and returns when it can. Interface only: all 300 harness games identical.
- **Zoom keeps what is in focus in the middle** (3 Oct; the player: zooming in and out of
  objects in focus, "they don't zoom out centered in the screen, but they instead go to the
  side"). On the galaxy map a clicked star is centred, but the wheel and the pinch still zoomed
  toward the pointer, which usually rests where the star was clicked, so the star slid toward it
  or away; a wheel turn during the short centring flight bent where it ended. On touch, every
  pinch also panned by the drift of the two fingers' midpoint, which nudged a followed world
  aside. Now, while the view is centred on something (a clicked or listed star, a system's star,
  a followed world or fleet), zooming keeps it in the middle, and a pinch pans only when it is
  clearly a two-finger drag (its midpoint has moved more than 24 px and more than the pinch has
  opened or closed). Once you pan the map yourself, the wheel heads for the pointer again, as
  before. While a star is centred, the wheel no longer heads for a different star under the
  pointer: click that star (it becomes the centre, and zooming in enters it), double-click it,
  or pan first. Camera only: no rules, saves or seeds touched.
- **Worlds look as hot or wet as they are** (3 Oct; from the player's screenshots: an
  ice-shelled ocean whose text says "open sea on the day side" drawn as a plain ice ball, a world
  reading 476 to 5,550 K beside a helium star drawn as grey rock, and a helium giant drawn blazing
  while "already out" with no light to give). The planet shader picked a world's look from its
  kind alone; temperature reached it only in Thermal view. Now every light follows the climate,
  ground by ground (day side to night side on a locked world): ice melts into open sea from about
  270 K (everywhere on an ice-shelled ocean; on an ice world in its low ground, as far as its
  water reaches), seas go up as a veil of steam past boiling and leave pale, salt-crusted floor,
  rock glows dull red from about 800 K (the Draper point), turns to a dark basalt crust cracked
  with glowing lava from 1,400 to 1,700 K (basalt erupts at 1,370 to 1,520 K), becomes a sea of
  magma past about 3,000 K and hazes its limb with boiling rock from 2,600 K; a giant too hot for
  its clouds glows dully, and hot rubble glows like hot rock. Terrestrial worlds had been drawn
  frozen whatever their warmth since `8aa21ed`; they are seas and continents again, all round
  when they turn (their cities spread over them rather than along a terminator ring). Labels
  follow: "Lava world" for a dry world whose warmest ground is past 1,500 K, and terrestrial
  worlds can now be "Scorched" or "Steam" worlds as eyeballs could. A new star whose life a turn
  outlasted (a helium giant, which lights and burns out inside one long turn) is drawn, and its
  temperature and light read, as the cold dwarf it is becoming until it converts as the turn
  ends. Display only: the 300 harness games are identical (144 / 44 / 68), and a pixel comparison
  shows the opening map and the homeworld unchanged in all three lights. The Dusk flare's day side
  (about 1,290 K) now glows faint orange under its steam, as the flare's own text ("hot enough to
  soften rock") says it should.
- **Worlds boil away near helium stars; a giant swallows what orbits inside it** (3 Oct; the
  player: worlds around helium stars "should be either evaporated or at least lava or gas", and,
  asked, "boil away when hot enough unless a gas giant" and "swallowed too"). About 45% of a
  42,000 K helium star's light is ionising ultraviolet: it strips the rock vapour off a molten
  world long before the star dies. So as each turn a helium star shines in ends, every world
  whose warmest ground passes 3,000 K under it boils away (rock vapour reaches 0.18 bar at
  3,000 K and 1 bar near 3,350 K), and rubble goes from a mean of 1,600 K (laboratory rates for
  forsterite). A helium giant (1,000 L☉ at 6,500 K) is about 25 times the Sun's size, 0.116 AU:
  everything orbiting inside it is swallowed, gas giants too; outside it only rubble evaporates
  (from 1,800 K under its softer light), and the rest outlast its 120,000 years as lava worlds.
  A settlement on a world that goes is evacuated as for a world that falls into its star: three
  in four of its people get off to the Deep. White Fire names the worlds the star will boil, a
  forecast warns of ours, a doomed world's panel and name say "Boiling away" (or "Being
  swallowed", "Vaporising rubble"), and nobody can settle it. Relics are no longer found on
  worlds that are gone. Bends, plainly: gas and ice giants are spared outside a giant (real ones
  would lose much of their gas to the ultraviolet); worlds that only steam keep their water; and
  a world boils within the turn its star first shines on it, however short that turn. Collision
  stars never come near (at most about 850 K on their worlds). Old saves: worlds round a burning
  helium star boil on the next turn; a giant already out (from before this change) boils nothing
  and converts. Over 150 harness games: 811 helium stars and 400 giants, 458 worlds boiled, 72
  belts evaporated and 41 worlds swallowed; 20 of our settlements lost so, in 7 games. Balance,
  900 games: 430 survive, 145 victories, a Degenerate Age of 68 turns (300 games: 146 / 54 / 69),
  against 447 / 136 / 68; 614 of the 900 games end exactly as before.
- **Helium giants shine through a turn of their own, and can be caught in a flash** (3 Oct; the
  player, of a giant drawn blazing that gave no light: "if I hurry up, I should be able to at
  least gather one turn of light"; asked, they chose to catch the flash). A helium star that
  swelled into a giant had it lit inside the same turn, so its whole 120,000-year life was over
  before anyone could look (it then lingered a turn, already out). Now a giant lights as its turn
  ends, as every new star does, shines through the next one and burns out as that ends; it comes
  with an event, A Helium Giant, which names the worlds it will swallow. A star too brief for a
  clock of six turns (every giant from about η 17.3, and late in the age a helium star) can now
  be caught in one turn: keep time with it and that turn ends as it burns out, lived in full in
  its light, for the clock's price (usually most of a full store); the Pace panel says "Star flash
  · X · one turn", and every pace but the Tide is greyed. Past about η 18.1 even that one turn
  cannot end with the star, since the calendar counts no shorter turn than a ten-trillionth of
  the age: the flash turn is then that long, and the star's light still counts in full (a bend).
  A new star that burns out inside the coming turn says so in its panel: "burns 120,000 years of
  a 10^18.4-year turn". Over 150 harness games: 407 giants, each with its event; the autoplayer
  caught 10 flashes (about 690 energy each). Balance, 900 games: 444 survive, 152 victories, a
  Degenerate Age of 68 turns (300 games: 148 / 58 / 68), against 447 / 136 / 68 before the
  boiling and 430 / 145 / 68 with it alone; 620 of the 900 games end as they did before the
  boiling.
- **Rogue worlds never fall in** (3 Oct; the player: "It still displays spiral in time even for
  rogue planets. I don't think that's correct."). A world flung loose from its star kept the
  gravitational-wave fall-in date it had while it orbited, but that inspiral needs a bound orbit:
  a rogue world has no star to fall into (the rules already knew it; only the display did not).
  Its panel now says "Falls inward: never: adrift", its Coldminds "Lasting" reads "never falls
  in" (they rank it first), and, of the same mistake, its Orbit reads "none: adrift" and it no
  longer wears a "Tidally locked" chip. Display only: all 300 harness games identical (148 / 58 /
  68).
- **Tamed swarms look tamed on the galaxy map** (4 Oct; the player: "are the swarms supposed to
  stay red on the galactic map because in the solar system they're blue"). The map drew every
  swarm's motes with one red; each mote now carries whether its swarm answers to us, and a
  tamed swarm's flash the system view's teal. The rust ring a swarm leaves where it fed stays
  red, as before. Display only.
- **Removing a queued build hands back everything paid** (4 Oct; the player: "even when you queue
  a building and then you cancel your selection, you don't get the upfront cost back"). Removing
  an item from a build queue returned half the materials, at that day's price. It now returns all
  of what was paid when it was queued, recorded on the item (`QueueItem.paid`, optional: an item
  from an older save comes back at today's full price); the industry already put into it is still
  lost. The autoplayer removes queued items only to make room for re-encoding before the protons
  go. Balance, 300 games: 148 survive, 58 victories, a Degenerate Age of 68 turns (unchanged).
- **A halo quake on a lifeless world cracks the hearth** (4 Oct; the player: "when it happens in
  the Black Hole era, there is nothing to lose really"). A misread answer to the Unlit can shake a
  settlement's world, costing it 10% of its life; but every settled world is lifeless by the time
  they answer, so it did nothing. A world with life left still loses it; on one without, the
  quakes crack the settlement's hearth instead (hearth damage +30%, healing 2% a turn out of
  overdrive). Being pulled loose is unchanged. Balance, 300 games: 148 / 58 / 68 (unchanged: the
  autoplayer never answers them).
- **Spare work and a Matter focus** (4 Oct; the player: "instead of producing a building … you
  could … produce matter instead of energy. But it should be also tailored to the realities").
  A settlement with nothing queued has always turned its spare industry into matter (0.1 a point;
  a little energy once the protons are gone), unannounced. Its panel now has **Spare work**:
  Recycle (that, unchanged: matter is conserved, and reusing it needs nothing new), Study
  (insight), Tend (energy from its own collectors and hearth, at most a quarter more than they
  make: nothing to tend, nothing gained) or Morale (resolve). Each turns spare industry into
  about as much as the others, a tenth of what a building of that kind makes, so the choice is
  what you need, not more of it; the panel shows what it is making. Focus gains **Matter** (+25%
  matter from mines, skimmers and lifters; energy, industry, insight and accord −10%); the other
  focuses leave matter alone, as before. Balance, 300 games: 148 survive, 58 victories, a
  Degenerate Age of 68 turns (identical). Variants with every settlement on one choice: Study 152,
  Tend 147, Morale 150 (all within noise); mining settlements on Matter 133.
- **Accord holds the Threads together** (4 Oct; the player: "I never had even a hint of a shortage
  of Accord, but resolve is constantly going down … Accord can both have more uses and be a way to
  support resolve"). Accord only bought laws, so it filled to its 999 cap. The Threads window now
  spends it: **Rally** (resolve +3, 80 accord), **Calm** (dissent −4, 60) and **Hear them** (one
  Thread's standing +5, 50). Each once a turn; its price doubles with every use and eases back over
  about ten turns, so a full purse lasts but cannot be spent at once. Making accord useful made the
  game easier (first prices: 170 of 300 survive), and no price alone undid it while accord was so
  plentiful, so its income is halved at every source; it is now something to choose how to spend.
  Saves keep their shape (the counters live in `civ.flags`); a game in progress keeps its banked
  accord. Balance, 300 games: 151 survive, 58 victories, a Degenerate Age of 68 turns, The Will
  Fails 63 (was 148 / 58 / 68, 70); 900 games 452 / 152 / 68 (was 444 / 152 / 68).
- **Choose what to work on instead of building, in the Build tab** (4 Oct; the player: "it still
  doesn't let me focus on a given thing instead of producing a building or a ship"). The choice
  of spare work sat in the Overview tab, while the Build tab still said "Idle. Choose something
  below." and the reminder still counted such settlements as idle. It now lives in the Build tab,
  under the queue, as **When nothing is queued** (Recycle, Study, Tend, Morale, each with what it
  would make here); with nothing queued the queue reads "Working on: Study · +1 insight a turn".
  Only a settlement with nothing queued and nothing chosen is called idle, and the reminder opens
  its Build tab; the Systems list says what each is working on. Interface only: the rules and the
  harness are unchanged.
- **A swarm can be clicked anywhere on its cloud** (4 Oct; the player: "It shows me it on the map,
  but I cannot really click it"). A swarm was picked only at one point just above its star, so on
  the galaxy map the star nearly always won. Now a click anywhere on its cloud picks it, on the map
  and inside a system; a star, ship or world right under the pointer still wins. (A star's panel
  also lists its swarms under In orbit.) Interface only.
- **Settlements outlive their black hole** (4 Oct; the player: "when a black hole evaporates,
  suddenly everything around it disappears, even when I had storage rings and everything on it.
  That's a mistake"). An evaporating hole wiped its system off the map and destroyed every
  settlement there that was not decay-proof. A hole loses its mass so slowly that the orbits
  around it widen until nothing holds them, and its final burst, huge by that age's standards
  (about 2×10²² J in the last second), is under a tenth of a joule a square metre 1 AU out. Now its
  worlds drift on as rogue worlds, settlements keep every structure (Burst Catchers still bank the
  burst), and only an empty system is gone. What lived on the hole goes with it: its spin, Hawking
  light and glow, and Horizon Vaults (which keep their charge in its spin) hold nothing. The
  Last Horizon now does the same to the holes it removes, which also ends a phantom: settlements
  there, and decay-proof vaults at any evaporated hole, had gone on drawing its spin and Hawking
  light. The forecast and the Last Burst event say what happens; the Codex gives the numbers.
  Balance, 300 games: 150 survive, 54 victories, a Degenerate Age of 68 turns (was 151 / 58 / 68);
  900 games 431 / 146 / 68 (was 452 / 152 / 68). Keeping the phantom energy would have made it
  461 / 156 / 68: the game is a little harder for losing it, which the player accepted.

## Tests in the repository, honest cooling, the fates of matter (7 Oct)

The player (6 Oct) asked for the scratch test scripts to go into the repository, then for honest
cooling, an honest crossing screen, three fates of matter, dismantling, the Long Flow and living
neighbours. Plan agreed 7 Oct; parts land one at a time.

- **The checks live in `tools/checks/`** (the player: "add the test scripts to the repository").
  The rules and interface checks written for each change since 28 Sep sat in the session
  scratchpad, which a new container loses. Now `npm run check` runs 19 unit checks (about 15 s):
  one for each change (accord, boil, castout, clock, cooling, evap, flash, focus, follow,
  old-saves, pace, quake, quick, refund, repeal, rogue, spare), plus 12 whole games checked every
  turn (`invariants`: no NaN, no negative stocks or people, no settlement on a vanished world
  unless decay-proof, survivors' health within 0..1) and a save round trip that must play on
  identically (`determinism`). `npm run check:browser` runs 20 interface checks against a served
  build (about 10 min); any console error fails a check. Three that had gone stale were brought
  up to date: a second new star can now follow the first one's clock on, a White Fire too brief
  for six turns can be caught as a flash, and "Race for it at our own pace" is gone. Four saves
  from this week join `tools/saves/` (seed 1000, Degenerate Age, turns 85 to 120, one with a star
  clock running and two around a white-dwarf merger), so `npm run savecompat` plays five saves to
  their end. `tools/sim.ts` takes `--from=N` (to split a run) and prints the halo civilization's
  stage; `tools/tally.sh` counts a run.
- **Survivors' health never reads below zero.** The invariants check found it: a crossing or a
  swarm could leave a civilization at negative health for a turn, so help sent right then (Tell
  the others, aid) first had to fill the hole before it counted. Now it stops at zero and the
  civilization fades as before unless help reaches it. Balance, 300 games: 149 survive, 55
  victories, a Degenerate Age of 68 turns (was 150 / 54 / 68); 5 of 300 games play out
  differently.
- **The calendar and the age part ways in the code** (no change in play). Physics, the Tide and
  everything physical read `calendarEra()` (`src/game/fate.ts`); what belongs to an age opens with
  `ageReached()`, when either the calendar or the age reaches it. The same today; it is what lets
  the fate of matter move a boundary between ages. 300 harness games identical, line for line.
- **Dead stars and worlds cool honestly, and the cold gives nothing** (the player: "Black dwarves
  never cool below 5 Kelvin and planets never cool below 1 Kelvin … at those low energy scales,
  the amount of usable energy they give off is actually drastically different").
  - Temperatures: a body nothing warms keeps its last heat in its electrons and cools as
    T ≈ K·t^-½, so a white dwarf with no dark matter is about 3 mK as the Degenerate Age opens
    (the game had it at 20 K, falling to a 5 K floor); embers hold 63 K while the halo lasts,
    neutron stars about 900 K and brown dwarfs about 4 K; worlds lose the 1 K floor; black holes
    show their Hawking temperature; nothing goes below the horizon's 2.4×10⁻³⁰ K. If protons decay,
    their warmth shows (a white dwarf near 0.05 K, a neutron star near 1.5 K) once we know they
    do. Every temperature reads at its scale: 63 K, 4.0 K, 3.2 mK, 225 µK, 2.2 nK, 2×10⁻³⁰ K. No
    rule reads a temperature below 195 K, so this alone changes no game.
  - Energy: usable energy goes as T⁴. Cold white and black dwarfs give collectors nothing (no
    ×0.01 floor, no early ×0.05 glow), unless a world falls in; a brown dwarf's faint light fades
    with the halo; an ember's light follows its warmth (×1.05 at full, fading to nothing). A
    light collector cannot be built where its star gives no light, and one already there says
    "nothing to gather". Worlds' core heat runs out after the Last Light, a fifth a turn
    (Geothermal Taps wind down with it): it used to last for ever, into the Dark. One honest gift
    of the cold: erasing a bit costs kT ln 2 (Landauer), so under a dark sky Coldminds and Cold
    Vaults keep for half. The black-dwarf name keeps its date, η 16.7.
  - Balance: 300 games 128 survive, 40 victories, a Degenerate Age of 68 turns (was 149 / 55 /
    68); 900 games 397 / 119 / 67 (about 430 / 147 before). By step, 300 games: honest
    temperatures and no light floors 137 / 55; core heat gone within seven turns 106 / 31; with
    the dark-sky discount 126 / 36; the gentler fade it has now (×0.8 a turn) 128 / 40 (×0.9:
    134 / 39). Most of the cost is the core heat that had lasted into the Dark Era: The Fade
    (continuity lost in the dark) rises from 9 to 28 games in 300.
- **Three fates of matter, and ages named for their warmest thing** (the player: three paths,
  "decay 50, curvature 25, stable 25"; "the timeline stays ambiguous" until research or the
  universe shows it). Matter's fate is now one of three, chosen at the start or drawn (the same
  single draw as before, so no galaxy changes; seeds whose draw falls in 0.5–0.75 now get
  curvature radiation, which were decay below 0.7 and stable above). Saves go to version 3 and
  keep their fate.
  - The Degenerate Age ends when the neutron stars, the last things warm of their own accord,
    fall below the faint glow of the black holes: at the Great Decay (η 39) if protons decay, as
    before; near η 30 if matter is stable (the Last Warmth: nothing dissolves, no "Great Decay"
    screen any more); near η 68 under curvature radiation (Falcke, Wondrak & van Suijlekom,
    arXiv:2410.14734), when the neutron stars burst and whatever is settled at one is lost. The
    calendar does not move: the Tide still turns at 10⁴⁰ years (η 39) in every fate.
  - Curvature radiation goes on unmaking matter: white dwarfs fade at η 78.5 to 85 by mass,
    brown dwarfs at η 87, their worlds drifting loose; at η 89.5 the Great Evaporation, a storm
    inside the Black Hole Age, takes every world as the Great Decay does. A Curvature Collector
    (Curvature Harvest) gathers a neutron star's faint glow from η 30 until it bursts.
  - With the fate unknown nothing gives it away: the forecast asks "The end of the Degenerate
    Age?" at the earliest date, the Chronometer hatches η 30 to 68 with its dates as questions,
    temperatures leave out decay and curvature warmth, and the autoplayer plans for decay. Near
    η 30 the neutron stars show it (Not for Ever; The Stars That Would Not Cool; or, if matter is
    stable, the Last Warmth itself, which then says so). The check plays three such games to
    η 29 and finds them identical in every field but the fate.
  - Texts by fate: the Black Hole Age's intro (and the Dark Era's, if matter is stable), the
    crossing names and screens, The Proton Question's three answers, forecasts, milestones, the
    Manual and a Codex entry, The fate of matter. A garden civilization declines faster only once
    proton decay takes hold (η 37.5; it was from η 15, a tell before anyone knew). Events: the
    halo-thin news no longer arrives after η 39, and atoms of positronium need positrons, which
    stable matter does not make.
  - Also: the Hearth says "stored fuel and salvage" where nothing local is left to draw on (the
    same small floor as before); a hole we live on no longer has two forecasts in the Black Hole
    Age.
  - Balance, 300 games: 124 survive, 52 victories, a Degenerate Age of 70 turns (was 128 / 40 /
    68); 900 games 386 / 142 / 69 (was 397 / 119 / 67). Decay games are as before, line for line
    (148 of 300). By fate in the 900: decay 163 of 450 survive (4 victories), stable 143 of 239
    (89), curvature 80 of 211 (49). With the fate chosen, 300 games each: decay 110 / 7 / 68,
    stable 184 / 114 / 55, curvature 113 / 65 / 89 (98 / 56 before the autoplayer prepared for
    the Great Evaporation as many turns ahead as for the Great Decay). Stable matter is the
    kindest fate; curvature games trade endurance for victories (more time with matter), and
    lose most at the Great Evaporation and in the Dark that follows soon after.
- **Any structure can be taken apart** (the player: "dismantle for mass … at an energy cost").
  The × on a structure in a settlement's Overview says what comes back and what it costs, asks,
  and takes one apart: the matter it cost comes back (its energy, once matter is gone), for a
  fifth of its industry cost in energy, at least 5; the work that built it is lost. Not while it
  houses people or sleepers with nowhere else to go there, or while ships in the queue need the
  Shipyard. What a building does once when finished (Volatile Shepherding's water, a Core
  Stimulator's heat, a new Confluence Node for the Chorus's wish) it does the first time only at
  a settlement, so taking apart and rebuilding farms nothing. The autoplayer, short of matter
  (under 40), takes apart one collector a turn whose source is gone for good (a star gone cold, a
  spent core, a hole gone): in 30 games 5.6 a game, 170 matter back (Geothermal Taps most,
  then infrared and glow collectors at cold stars and ember collectors after the halo).
  Balance, 300 games: 135 survive, 48 victories, a Degenerate Age of 69 turns (was 124 / 52 / 70);
  900 games 406 / 143 / 69 (was 386 / 142 / 69). By fate in the 900: decay 179 of 450 (163
  before), stable 144 of 239 (143), curvature 83 of 211 (80). Matter given back helps most where
  it runs out soonest, before the Great Decay. (Taking Decay Harvesters apart before they started
  gathering, then building them again, was a waste the autoplayer no longer makes.)
- **The Long Flow** (the player: "it's actually going on right now. It's just so slow that we
  never notice it … the timestep of the civ in question may determine if its a threat to their
  own integrity vs just something affecting the environment very slowly"; chosen: once, at 10⁶⁵,
  with unexcavated relics lost, unmanned structures flowing, worlds smoothing into spheres and
  sleeping aliens at risk). If matter lasts that long (stable, or curvature radiation until the
  Great Evaporation), at η 65 even iron flows, its atoms tunnelling out of place (Dyson 1979).
  - Who keeps a settlement: Kin, the Lattice, or any mind thinking faster than once in 10⁶⁵
    years. Minds that all think more slowly keep watchers awake between their thoughts, at half
    again their upkeep (still cheaper than the tempo strain of thinking faster than they can). A
    settlement where no one is awake, only sleepers or no one, loses a structure a turn, the
    cheapest first and Cryo Halls last, their sleepers with them, until it is gone; the panel
    says "flowing away" and a forecast names it. Leptonic structures are not atoms and never flow.
  - Sleeping costs 0.3 of upkeep instead of 0.1, unless The Long Watch keeps someone awake (0.05
    as before). Ruins no one is digging run into smooth lumps, found or not (a manned Relic
    Excavation keeps its ruin). Neighbours who sleep through the ages fade twice as fast.
  - An event, The Long Flow; a forecast from the moment the fate is known; a milestone at η 65 on
    the timeline ("Long Flow?" while the fate is unknown); a Codex entry with the physics and the
    bend (by the same crude formula lighter atoms go far sooner; the game takes iron's date). On
    screen every world's ground runs smooth and the stones of the belts turn round.
  - The autoplayer, from three turns before, wakes a sleeper where no one is awake and takes
    apart what would flow and gives no power, never with energy it needs.
  - Balance, 300 games: 129 survive, 47 victories, a Degenerate Age of 69 turns (was 135 / 48 /
    69); 900 games 400 / 142 / 69 (was 406 / 143 / 69). Decay games are as before, line for line.
    By fate in the 900: stable 140 of 239 (144 before), curvature 81 of 211 (83). Chosen, 300
    each: stable 184 / 119 / 56, curvature 106 / 57 / 88. The cost is outposts nobody keeps, whose
    collectors fed a dwindling civilization, and watchers' upkeep at settlements of slow minds;
    with the autoplayer taking apart the dearest things first, power collectors included, it was
    399 / 142.

## Living neighbours (Part C, built on the work branch; it goes live all at once)

The player chose "Pacts, then expansion", war against "Any, at a high price", and to see it "All
at once". Built in phases, each with its checks and harness numbers.

- **Phase 0, honesty.** Energy we send to another civilization now travels as a beam at the speed
  of light and helps them when it arrives (Send says how long; their card shows what is on its
  way); a plea we answer goes the same way, and nothing is sent to the dead. What we do to one
  civilization (a raid, a seizure, devouring) changes how the others feel when its light reaches
  each of them, not at once, and a great wrong is answered. The Hunger in us shows: with Taint T no
  one thinks better of us than 100 − 1.5 T, sinking toward it two a turn. A civilization we raided
  into the dark leaves us no last transmission. Asking for help needs our clocks within reach of
  theirs; a beam sent out of step helps them but earns no trust. Seize and Devour ask first.
  Refugees come only as far as we have room (the capital first, Kin into free berths). A Thread
  that forks away with no settlement of its own goes to the nearest star no one lives at, not to
  ours. Also: every neutron star bursts under curvature radiation, even one flung out of the
  galaxy (a lingering neutron star could be left in a system with nothing left in it). The harness
  prints, for each neighbour, the stars it settled beyond its first.
  Balance, 300 games: 136 survive, 52 victories, a Degenerate Age of 71 turns (was 129 / 47 / 69);
  900 games 406 / 146 / 69 (was 400 / 142 / 69); by fate decay 175 of 450, stable 154 of 239,
  curvature 77 of 211. 430 of 900 games play as before.
- **Phase 1, pacts.** Three pacts, proposed from a civilization's card in Signals (a new Pacts
  row) or offered by them when they think well of us (over 30):
  - **Mutual Aid:** whichever of us is in trouble, the other beams help unasked, at most once in
    six turns each way. We send 15 to 50 energy when their health is under 0.35 and we hold more
    than 30% of our reserve; they send up to 60 when our reserve is under 15% and falling, and it
    reaches us after the light of our trouble has reached them and their beam has come back. A
    partner in Mutual Aid no longer needs to ask.
  - **Shared Watch:** we see what they see (their stars are eyes on the Hunger for us), we stand
    half a point stronger against a swarm for each partner, and a swarm at their stars hurts them
    30% less. Eyes and a little strength, never a shield.
  - **Open Archives:** 0.5 + 0.02 × their people × health insight a turn, and every ten turns their
    notes on what we are researching, worth 30% of it.

  A proposal crosses at the speed of light and they weigh it when it arrives: Mutual Aid needs
  their goodwill at 10, Shared Watch 20, Open Archives 0 (the Tessellate enters any agreement
  15 sooner; a civilization in trouble takes Mutual Aid 15 sooner; no one binds itself to us
  with Taint 60 or more). Their answer takes as long again to come back. A pact costs accord, the
  Threads' consent to bind us: 30 for the first, and every pact in force or proposed makes the
  next 1.6 times dearer; a refusal gives it back. Ending a pact is heard: −25 with them and −10
  with everyone else, each when the light reaches them; a civilization whose goodwill falls
  below −10 renounces every pact with us. The autoplayer proposes and accepts pacts while it
  keeps 30 accord in hand.
  Balance, 300 games: 138 survive, 50 victories, a Degenerate Age of 69 turns (was 136 / 52 / 71);
  900 games 440 / 150 / 69 (was 406 / 146 / 69); by fate decay 190 of 450, stable 145 of 239,
  curvature 105 of 211. Fewer games end in the Black Hole Age or fade in the Dark. 792 of 900
  games sign at least one pact: a game averages 1.2 Mutual Aid, 1.4 Open Archives and 0.9 Shared
  Watch. Also: a proposal is weighed once, even in deep time, where every light has arrived.
- **Phase 2, refuge.** A dying civilization (health under 0.2) that trusts us asks, once, to
  come to us: a partner in any pact, or, while Sanctuary stands, any that think well of us (20
  or more). If we take them in, they set out when our answer reaches them, minds as light and
  flesh by ship at a fiftieth of the speed of light; on the way nothing drains them, and if they
  go dark before our answer arrives it was too late. A third of their people come (8 of 24),
  with their archive (60 + 4 × their people in insight): where we have room, Kin also asleep in
  free Cold Sleep berths, Echoes in the archive until there is substrate; the rest crowd in at
  the capital, where without more room not all of them last. Their fate is saved, and every other
  civilization hears of it (+8). The Choir asks to join our Chorus instead, if we merge minds
  too (even without a pact, at goodwill 10): its minds join where a Confluence Node has room, the
  rest as memory (20 insight each), and its fate is absorbed. Sanctuary keeps its promise of
  trust: every civilization hears of it when the light arrives (+10, a repeal −10), and while it
  stands those who are not against us trust us more, half a point a turn up to 25. Their card in
  Signals says when they will arrive; the Manual's Other minds section now covers pacts and
  refuge. The autoplayer takes the dying in.
  Balance, 300 games: 147 survive, 57 victories, a Degenerate Age of 68 turns (was 138 / 50 /
  69); 900 games 426 / 162 / 70 (was 440 / 150 / 69); by fate decay 177 of 450, stable 156 of
  239, curvature 93 of 211. Of 2,906 neighbours 714 were saved and 326 absorbed, in 710 of the
  900 games. Also: the fates checks stop short of a boundary with room for a turn twice as long
  as the last (the autoplayer may slow down just before it).
- **Phase 3, expansion.** A thriving civilization (health over 0.5, 12 people or more) sends
  settlers, about one turn in seventeen, to the nearest free star of its own cluster (within 100
  ly) that suits its way of life: gardens to a living world, uploads and the Choir to a white
  dwarf, neutron star or black hole, the sleepers to a cold world by a new star, the Tessellate to
  a brown dwarf or a belt. Never to a star we live at, or another civilization's; if we settle it
  before their ships arrive (at 0.02 c), they look again. Up to three stars beyond their first,
  each easing the universe's drain on them (÷ 1 + 0.25 each) and lifting them a little (+0.05)
  when they arrive. We see a star is theirs when the light of their arrival reaches us: a dashed
  ring in their colour on the map, the system panel's Others section, their card's Stars row.
  The Hunger smells them as it smells us (their people and health warm their stars), and when a
  swarm feeds at one of their stars they ask us for warships, at most once in ten turns. We can
  promise: if our warships fight it there within ten turns they think better of us (+10), and if
  none come while the swarm still feeds, worse (−10). Every fight our warships win at their star
  is worth +5 with them, breaking the swarm +20, and everyone hears of it (+5). The autoplayer
  makes no promises. Also: Mutual Aid beams only what we can spare, keeping 30% of our reserve
  (it could drive our energy below zero).
  Balance, 300 games: 144 survive, 55 victories, a Degenerate Age of 68 turns (was 147 / 57 / 68);
  900 games 396 / 158 / 68 (was 426 / 162 / 70); by fate decay 169 of 450, stable 145 of 239,
  curvature 82 of 211. Without the Hunger smelling them, 410 / 167; without expansion (the rest
  as it is), 409 / 150: each part costs a little, and together the drop is within about 1.5
  times the noise between two runs of 900. Serein and the Choir hold 2.7 stars beyond their first
  by a game's end, the Tessellate 1.0, gardens none (no living world near them), the sleepers
  almost none (a new star must burn near them). 313 of 2,906 neighbours are alive at the end
  (244 before).
- **Phase 4, war, narrow and costly.** Seize is no longer one warship and no fight. Declaring
  war needs the Threads' consent (60 accord) and costs resolve (−5), calm (dissent +8) and every
  Thread's standing (−3); our pacts with them end, as broken pacts; they hear it when the light
  arrives (−40), and so does everyone else (−15). While we fight anyone, a civilization that
  hates us (below −20) joins against us and raids us half the time it can, and the one we fight
  strikes back the same way. Dissent rises half a point a turn of war. A siege is warships held at
  their first star turn after turn (each turn costs them 0.03 of their prospects, and their guns
  answer ours), while they arm (+15% strength a turn of war); after three turns we can try to
  take the star, a battle (our attack × 0.6 to 1.4 against their strength) we can lose, which
  sends the siege back to the start. Its heat draws the Hunger, to the siege and to our capital.
  No pacts, offers, asking, aid, refugees, trade, shared works or refuge with them while it
  lasts; Make peace stops it (heard, +10). Against our own people who left us (a fork), or a
  neighbour who has raided us twice within twenty turns, the Threads mind less (−1), others
  hardly blame us (−5, and −10 rather than −30 for the taking), and taking it carries no Taint:
  a fork comes back with every settlement it took. Signals: Declare war (asks first), a War row
  with the siege, Make peace, and Seize waiting for the siege; the Manual's Other minds section
  covers expansion and war.
  Balance: the autoplayer never goes to war, and its 900 games are the same as phase 3's, game
  for game. A test strategy that wages the wars with a cause (building Wardens, declaring at
  twice their strength, holding the siege, seizing; peace after 30 turns) fought 21 wars in 900
  games, 8 ending with a fork retaken: 397 / 158 / 68 against 396 / 158 / 68, and in those 21
  games 14 survived against 13 in peace. Worth it only in the narrow case, and not by much.
- **Phase 5, ways that meet.** Each way of life wants its own things.
  - The sleepers wake when a new star lights within 100 ly of their stars with a cold world by it,
    and set out for it at once (health over 0.25 is enough), telling us so: a race, for if we
    settle there first it is not theirs.
  - The Tessellate keeps agreements to the letter: it never renounces a pact, whatever it thinks
    of us; it pays its side of Mutual Aid even while failing; and it holds us to ours: each time
    its Mutual Aid falls due and we cannot spare 5 energy, a breach is logged, and at the second
    every agreement ends (−15).
  - The Choir, healthy and thinking well of us (over 20), asks at most every 25 turns for those of
    our Echoes who wish to join it. Letting two go raises the Echoes' standing (+3), and the
    Choir grows and hears of it (+12); asking them to stay costs the Echoes' standing (−3) and
    the Choir's goodwill (−5). The autoplayer lets them go.
  - A partner (any pact) living at a new star keeps its clock with us: half the price.
  - In the Black Hole Age a hole's spin is a commons: a civilization living at a hole draws
    0.04 × its people × health a turn from it (a partner half), which slows its own decline;
    the system panel's Spin row names who shares it.
  - Our own people who left us are retaken without Taint (phase 4).

  Balance, 300 games: 146 survive, 60 victories, a Degenerate Age of 67 turns (was 144 / 55 /
  68); 900 games 435 / 179 / 68 (was 396 / 158 / 68); by fate decay 179 of 450, stable 163 of
  239, curvature 93 of 211. With the autoplayer asking its Echoes to stay rather than letting
  them go: 439 / 163 / 71. Of 2,906 neighbours 684 were saved, 186 absorbed and 307 alive at
  the end; Serein and the Choir hold 2.7 stars beyond their first, the Tessellate 1.0, the
  sleepers 0.6 (none before).

  Part C as a whole, against the Long Flow's 900 games: 435 survive (400), 179 victories (142);
  the steps between phases moved by up to 30 either way, about the noise between two runs of
  900, but the rise from cooperation (pacts above all) holds. A player who keeps to themselves
  plays much as before; one who binds neighbours to them, takes in the dying and stands with
  them against the Hunger does better.
  Also: the evaporation, Long Flow and survey checks no longer depend on what one seed's game
  happens to hold, or on how fast the camera flies.

## Beacons that need feeding, and neighbours who deal sensibly (7 Oct)

- **Decoy beacons burn only while we feed them.** The player: "can you instead make the beacons
  temporary? I think that would be more realistic than having them last literally trillions and
  trillions of years." Chosen: a beacon burns while we keep feeding it, and lighting one turns the
  nearest swarm toward it.
  - Lighting one still costs 30 energy, from a ship at a star where none of our people live. The
    nearest awake swarm within reach (90 ly in the Dusk) turns toward it at once.
  - Keeping it burning costs 3 energy a turn at the Tide, scaled by the turn's lived share as all
    upkeep is.
  - It goes dark when we put it out (Put out, on its star's panel) or cannot feed it; energy never
    drops below zero, and the Record says which went dark.
  - The coming turn's projection and the HUD's energy tooltip count the upkeep.
  - A beacon from an older save is fed like any other, and can be put out.
  - Balance: the autoplayer never lights a beacon; 300 games identical to before, game for game.
- **Neighbours deal sensibly.** The player: "the other players CONSTANTLY wanted 40 matter for an
  unspecified knowledge amount." In 30 autoplayed games trade offers were 17 a game (about one
  every 13 turns), the same 40 matter each time, and shared works were asked for again after
  every refusal (67 of 91 refused).
  - Each way of life deals in what it lacks, at its own rate and rhythm:

    | Way | Asks for | Insight per unit | Offers every |
    |---|---|---|---|
    | Gardens | matter | 2 | 22 turns |
    | The Archive (uploads) | energy | 3 | 16 |
    | The Choir | energy | 2.5 | 18 |
    | The sleepers | energy | 2 | 40 |
    | The Tessellate | matter | 2.5 | 18, exactly |
    | A fork | as its Thread | | 24 |

    Matter-wanters ask for energy once matter is gone.
  - An offer says exactly what it asks and gives: their notes on what we are researching, worth a
    share of it (a fifth to three tenths), for its price at their rate, never more than half of
    what we hold, and none at all when there is nothing left to learn or the deal would be too
    small to bother with. The insight goes to that project while it is open.
  - After a refusal they wait twice as long before offering again (up to eight times); a yes
    brings them back to their rhythm. Shared works too.
  - Raiders our defences turned away wait 15 turns before trying again.
  - They offer the pact they need most: Mutual Aid while failing, a Shared Watch while the Hunger
    feeds near them, else Open Archives.
  - They remember why they feel as they do: the last 8 things they heard of us or saw us do, with
    what each did to their regard, shown on their card (hold the pointer over Toward us), with
    the standing reasons (our Taint's ceiling, Sanctuary). Everything that moves their regard is
    remembered, telling them of a new star included; a Thread that leaves us remembers that it
    left, and sleepers we woke against their will remember that too.
  - Offers from older saves keep their old terms.
  - In the same 30 games: trade offers 5.3 a game (127 of 158 taken by the autoplayer), at 1.9
    to 3 insight for each unit asked; shared works 1.7 (25 of 50 taken).
  - Balance, 300 games: 154 survive, 59 victories, a Degenerate Age of 69 turns (was 146 / 60 /
    67); 900 games 437 / 183 / 69 (was 435 / 179 / 68): as before, within the noise. By fate:
    decay 173 of 450, stable 162 of 239, curvature 102 of 211.
- **Checks:** `evap`, `star-clock` and `dealings` set up their own situation instead of riding
  a seeded game's course, which the dealings had moved (DEV-NOTES, Gotchas).

## One ring per world (7 Oct)

- The player, looking at Aster in the system view with two rings around it (the flat selection
  circle and the tilted ring that marks a settled world): "how about making the big flat circle
  teal instead of having 2 circles/rings?" Chosen: one ring per world.
  - Selected, a world someone lives on shows only the selection circle, in the colour of its own
    ring: ours (the age's colour for us, teal in the Dusk) or a neighbour's. Its tilted ring
    steps aside while it is selected and comes back when it is not.
  - A world no one lives on (and a belt, the Deep, or a world whose minds live in stations around
    it) keeps the pale selection circle.
  - Close up the circle still dims so it does not glare over the planet, but on a lived-on world
    only to an opacity of 0.35 (0.12 elsewhere; 0.8 from afar), so its colour still reads.
  - Display only; check `browser/ring-select`.

