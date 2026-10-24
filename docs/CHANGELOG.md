# Changelog

The game was built on branch `claude/lucid-newton-30cbpk` (PR m1omg/Steliterate#1, merged into
`main` on 8 Oct as `3e913f3`). From 28 Sep the work continued on `claude/epic-wozniak-lyhulf`,
and the live branch was fast-forwarded to it. Since 9 Oct each batch goes live by a PR into
`main` (PR m1omg/Steliterate#3 as `0e08054`, PR m1omg/Steliterate#4 as `d9bd6e5`). Every batch
was typechecked, built, playtested
(`tools/playtest.cjs`), balance-checked when rules changed (`tools/sim.ts`) and pushed (GitHub
Pages redeploys). Until 28 Sep each was also republished to the artifact
https://claude.ai/artifact/BWqtVocJezc4XXmnNgWZzc, which has not been updated since: it belongs to
the organization the game was first built in, and GitHub Pages is the live build. Balance figures
are "games that survive (Endurance + Victory) out of 300 standard competent autoplayed games";
noise is about ±12.

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


## Readable type, steady music, terraforming (7 Oct)

- **Larger type.** The player: "make some of the fonts a little bit larger, especially the ones
  that mention years … I really need to basically squint to see the numbers, especially properly
  the exponents", and on a 1440p screen "make it somewhat larger please".
  - Every font size up to 14 px is 1.5 px larger (the root 14 → 15.5 px), in the stylesheet and
    in the components' own sizes.
  - Exponents (10¹⁵·³ years) are drawn as the font's own digits, raised and a little smaller
    (`src/ui/sup.ts`). The game's fonts carry only ¹ ² ³, so ⁰ and ⁴–⁹ had come from a system
    fallback font, smaller and unlike the digits around them. Only the drawing changed: saves,
    the Record and tooltips keep the text as it was.
  - The layout keeps its shape at 1400×900 and 2560×1440: the bottom-left stack's height queries
    move to 950 and 790 px, the turn box widens to 320 px, the research grid's field column to
    124 px, the drawer leaves 318 px, and the chronometer's lines sit at the top.
  - Settings → Interface size (Large ×1.2, Huge ×1.4) goes further on big screens.
- **Selection rings hold still.** "please make it not pulsate": the selection circle around a
  world, and the galaxy map's ring around a selected star. Display only.
- **Music.** "the sound stops when I switch between tabs … then it starts the soundtrack from
  the very beginning", and, in Firefox, the synthesized score played before the recording: "it
  should be the same in all browsers".
  - A hidden tab no longer suspends the sound: the recording plays on, and is the same one at a
    later point when the tab comes back.
  - While a recording is due, the synth stays silent. It plays only if no recording will: one
    that fails, or one that has not started within 8 s.
  - Check `browser/music-hidden`.
- **Terraforming.** "please add some terraforming structures to increase habitability of
  planets while they're still in the late stelliferous era", with seeding "conditional on some
  minimum habitability, so you cannot just seed complete wastelands with microbes", and of little
  use "with worlds that are already habitable … Think terraforming Mars ideas IRL."
  - The research is Terraforming (Stewardship, 130, after Volatile Shepherding). It unlocks three
    structures, on rock and ice worlds:

    | Structure | Cost | Upkeep | What it does |
    |---|---|---|---|
    | Orbital Mirrors | 100 industry, 40 matter | 1 | twice the light for a cold world, half for a hot one; habitability up to +20 points |
    | Atmosphere Works | 120, 50 | 1 | greenhouse air (×1.15 warmth up to 288 K), carries a locked world's heat round, water to 10%; up to +25 |
    | Biosphere Seeding | 60, 20 | none | needs 30% habitability, 5% water and no life of its own; vitality +4% a turn, to 80% |

  - Each lift counts in full where the warmest ground ends up between 250 and 330 K, falling to
    nothing at 200 K and at 400 K. Terraforming stops at 55%: a world already that habitable gains
    nothing, and where even both would leave it frozen hard or too hot, neither can be built.
  - Room for Kin follows as on any world, 12 × habitability × vitality, so a bare rock made 45%
    habitable and seeded holds 4 Kin without domes, and Kin grow faster there.
  - It runs only by a red dwarf's steady light, in the Dusk. When the star flares or dies, or at
    the Last Light, the world is as it was and the seeded life freezes, 5% a turn; it freezes
    too if both the mirrors and the works are taken apart. A new star boils what it would have
    boiled anyway.
  - In four galaxies, of 383 dead and marginal worlds around red dwarfs (ice, bare rock, ice
    shells, super-Earths), 240 can be brought to life (at 80% vitality, room for 3 to 5 Kin), 92
    can't be helped (frozen hard or too hot), and the rest can be raised but not above 30%. Of 128
    living eyeball and terran worlds, 109 are already past 55%.
  - Grounded in McKay, Toon & Kasting 1991, Zubrin & McKay 1993 and Joshi, Haberle & Reynolds 1997.
    Bent: Mars has too little carbon dioxide to thicken its air (Jakosky & Edwards 2018), so the
    volatiles are brought in; and the work keeps the game's turns, far longer than it would take.
  - Saves: no new fields. Old saves have none of the structures and play on exactly as before
    (checked on the saves in `tools/saves/`), and generation is untouched.
  - Balance, 300 games: 147 survive, 59 victories, a Degenerate Age of 71 turns (was 154 / 59 /
    69); 900 games 434 / 183 / 70 (was 437 / 183 / 69): within the noise. By fate: decay
    173 / 450, stable 162 / 239, curvature 99 / 211. The autoplayer researches it last among the
    Dusk's projects and never builds it: its Kin live on living worlds. Researched early it costs
    the autoplayer victories (900: 424 / 166), from the delay to the projects that win.
  - Checks `unit/terraform` and `browser/terraform`.

## Every measure in the settle lists; settlements' yields; twilight seas (8 Oct)

- **Where to settle shows everything.** The player: show "not just livability or matter, but …
  all of them, but sorted by the highlighted most important property … And add those things also
  into the Nearest Worlds."
  - Under each world in a settler's Where to settle list: livable ground (habitability ×
    vitality, room without domes), power, matter and lasting, with the trip on its first line.
  - The list is sorted by the measure picked (Best for them is the settler's own), and that
    measure is outlined in every row, like its button. Nearest outlines the trip.
  - A settler's Nearby list follows the same sort: charted stars by their best world for the
    measure, the unsurveyed after them, the same measure outlined. A probe in the fleet keeps the
    unsurveyed first until a measure is picked.
  - Surveyed worlds (Systems, W) shows the same line under each world, or each star's best
    world for each measure, with its sort outlined (the distance for Nearest). Its Systems view
    also gives each star's room for Kin in all.
  - Icons: people for livable, energy for power, matter, a clock for lasting.
- **Our settlements shows each one's yields**, as in Civilization's city list. Energy and matter
  net of what it uses, industry, insight and accord, each turn, in columns under their icons. These
  are the same figures, and the same breakdown on hover, as the settlement's own panel. On a phone
  the columns take a line of their own.
- **Twilight seas.** The player found an "Ice world" with a sea along its terminator and a boiling
  day side.
  - The generator picks a world's kind from its orbit, by fixed distances that do not follow the
    star's light, and one branch for red dwarfs makes ice worlds at any orbit. Of 217 ice worlds
    around red dwarfs in six galaxies, 91 lie inside 0.06 AU, and 92 are not frozen at their warmest:
    46 boil on the day side and freeze on the night side, and 36 have an open sea on the day side.
  - The temperatures, water and look were already right, from the star's real light. Only the
    name was wrong.
  - Such a world (an ice world or ice-shelled ocean, day side past boiling, night side below
    freezing) is now named a Twilight sea. Its note says what astronomers call it, a hot eyeball,
    with water cold-trapped on the night side (Leconte et al. 2013).
  - Its water reads "ice on the night side, open water along the terminator, the day side boiled
    dry", where it said "boiled off the day side, ice on the night side".
  - Generation is unchanged, so every seed's galaxy stays as it was; the climate names the world.
- **Display only.** Saves are untouched, and 300 games play out identically, line for line.
- Checks `unit/twilight` and `browser/settle-measures`.

## Ice worlds by starlight (8 Oct)

- Asked whether new galaxies should place ice worlds by each star's light, the player chose: "Fix
  it for new games".
- **The pass.** A new galaxy's ice worlds and ice-shelled oceans that are not frozen even on their
  warmest ground (at or above 273 K) now start as bare rock, about 15 a galaxy. Inside a star's
  snow line ice never gathers, and a close world's water is lost in its red dwarf's long, bright
  youth (Luger & Barnes 2015).
- **What they become.** They take bare rock's figures: richness from 1.0 to 1.7 (from where their
  own lay), a trace of water, no habitability, life or buried ocean.
- **Exceptions.** A star already in its last flare is judged by its light before it, so its
  frozen worlds still thaw in the flare. The home system keeps its fixed layout.
- **Seeds and saves.** The pass runs after generation and takes no random draw. Every other world,
  every star and every name in a seed's galaxy stay as they were. Saves are untouched: games
  begun before keep their ice worlds (named twilight seas where they are).
- **Balance.** 300 games: 135 survive, 60 victories, a Degenerate Age of 70 turns (was 147 / 59 /
  71). 900 games: 426 / 184 / 68 (was 434 / 183 / 70), within the noise. 108 of 900 games play
  out as before. The outcomes that change go both ways: 116 endurance → defeat and 104 back, 50
  defeat → victory and 46 back. By fate: decay 168 / 450, stable 170 / 239, curvature 88 / 211.
- **Checks.** New: `unit/icy`. `unit/twilight` now builds its own twilight sea, and checks that new
  galaxies start without any and that old saves name theirs rightly.

## Water-rich worlds and steam worlds (8 Oct)

- **Request.** The player, on the ice-world fix: "I don't think it's realistic for all planets that
  are closer than the early snowline to be water-free. I think there should be steam worlds as well
  … as well as worlds that were boiling at that time but didn't lose all the water and then they
  froze … some planets can be up to 50% water." Chosen: the version with steam worlds. On the
  report: "Runaway limit should be 1.4x insolation not the ones quoted but yes put it live"; keep
  1.9× for locked worlds; a flare makes steam worlds as any light does; life under boiled ice:
  "Make that life die", and "If the world is dry on the dayside, a nightside under ice ocean
  should survive actually."
- **Water-rich worlds keep their water.** A new galaxy's icy worlds are sorted by the water they
  formed with.
  - Ice-shelled oceans, and ice worlds with half their surface or more under water (the wetter
    half), keep it, marked Water-rich. They may be up to half water by mass, like the ocean
    planets of Léger et al. 2004, more than their star's bright youth could boil away.
  - Only the warm water-poor ones dry to bare rock, as before.
  - Cold ice worlds stay as they were: they are the ones that boiled young, kept their water and
    froze.
- **Steam worlds.** A water-rich world past the runaway greenhouse has a sky of steam hundreds of
  bars deep. It holds the ground at 1,500 K or more by night as by day (Kasting 1988).
  - The limit is 1.4 times Earth's sunlight, the player's figure: Kasting 1988's runaway, where
    the oceans evaporate entirely, from the paper that gives the 1,500 K. Later models start the
    runaway sooner, at 1.06 (Kopparapu et al. 2013) to 1.1 (Leconte et al. 2013, Nature). As a
    mean from starlight it is 276.6 K.
  - For a tidally locked world it is 300 K, nearly twice Earth's sunlight, because clouds over the
    star-facing side shade it. Yang, Cowan & Abbot 2013 kept such worlds habitable to 1.6 times
    Earth's sunlight around a red dwarf and 1.9 around a K star, where their runs stopped.
  - It is live: with less light (the star's remnant cooled, or mirrors shading it) the steam rains
    out into seas.
  - Nothing lives on a steam world. Life on one dies with the turn, and the Record says so for a
    world we know ("Nothing lives on X now: its seas have boiled into a sky of steam."). A new
    galaxy's steam worlds start lifeless.
  - The world is named Steam world, with a note and a Water-rich chip. Survey finds of ice, of an
    ocean under ice or of dried seas do not fit it.
  - On the map it is a veil of steam: the shader never draws lava under an icy world's sky.
  - A flare can do it too. A water-rich world that its star's last flare takes past the limit is
    a steam world, not a Thawed ocean refuge, until the light falls back below the limit after
    the star collapses. Water-poor icy worlds still thaw into refuges, and so does a water-rich
    one the flare leaves between freezing and its limit (277 K, or 300 K if it is locked).
  - Mirrors can undo it. In six galaxies 14 of the 30 steam worlds are only a little past the
    limit, and Orbital Mirrors would shade them back below it and let them be terraformed (to 34
    to 41% habitability, the warmest ground at 344 to 356 K).
- **The flare before turn 1 counts.** The scorch rule already took 60% vitality over a whole flare
  from any world it heats past 340 K even on the night side, by the share each turn lives
  through, which kills most. But it counted only from turn 1.
  - Before, in six galaxies, 15 living worlds in flaring systems started with all their life,
    though their flares were 29 to 100% through.
  - Now a new galaxy starts with the flare so far behind it (`scorchedFromTheStart`, by the same
    rule in one share). Of the 15, 14 start dead: 11 with surface life as bare rock, and 3
    ice-shelled oceans. One keeps 13% of its life.
  - A world dry on its day side that keeps ice, and an ocean under it, on its night side is not
    scorched, and keeps its life, as the player said.
- **The buried-ocean chip** shows only while ice is left over the ocean, not on a flare's open sea
  or a steam world. A twilight sea keeps it.
- **Per galaxy** (six seeds): about 5 steam worlds, 3 with a sea on the day side and ice beyond, a
  rare twilight sea, 7.5 dried to bare rock; the rest stay frozen. Twilight seas are now mostly a
  water-poor world's state, as in Leconte et al. 2013 (A&A), and the water-poor warm ones dry out.
- **Saves and seeds.** No random draw: every seed keeps its stars and orbits. Saves are untouched:
  old games have no water-rich worlds, their climates are as they were, and the start passes run
  only in a new game. The steam rule acts in any game, but an old game has no steam world.
- **Balance.** 300 games: 143 survive, 60 victories, a Degenerate Age of 73 turns. 900 games: 429
  / 185 / 69, against 423 / 188 / 69 at the first limit (1.09 times Earth's sunlight, no boiled
  life rules), within the noise: 784 of 900 games play out exactly as before, and the outcomes
  that change go both ways (16 defeat → endurance, 10 back; 8 victory → defeat, 8 back). By fate:
  decay 171 / 450, stable 157 / 239, curvature 101 / 211. Against the dry pass that is live (426
  / 184 / 68) the whole batch is within the noise too.
- **Checks.**
  - `unit/icy` is rewritten: water-rich worlds kept and marked; steam worlds, and only they, past
    the limit, and lifeless; rain-out with less light; no icy finds on them; mirrors and flares
    against the limits; old saves.
  - New `unit/scorch`: the flare before turn 1 in six galaxies, world by world; a steam world's
    life dying at the turn, with its line in the Record; a twilight sea keeping its life in a flare.
  - `unit/twilight` audits naming without assuming none at the start.
  - `unit/clock` compares the insight from Study and Watch with a tolerance: the new course gave
    25.000000000000057.

## The audits of every world and star; outer worlds; dwarfs that cool; attacking swarms (8 Oct)

Two audits went through every kind of world and star, in six new galaxies, two autoplayed games
to their end, the saves in `tools/saves` and the player's turn-77 save. What was wrong is fixed
live, so games in progress get it; what changes a galaxy is for new games only, as the player
asked ("the wrong stuff please fix even though I have a game in progress … the more radical
changes … apply them to a new game").

- **Live: temperatures.**
  - Nothing sits at the horizon's 2.2 × 10^-30 K while the galaxy glows: about 1 K in the Dusk
    (its red dwarfs' light; today's starlight gives 3.2 K) and 10 mK from the embers after the
    Last Light, to η 25. A world with no star shows it, and Sunlight and Orbit read "none: no
    star".
  - A black hole's disk warms its worlds with what it gives collectors: 5 to 14 K in the Dusk
    (a disk of about 6 × 10^-5 L☉), 0.04 to 0.1 K at η 16.
  - Giants show a temperature, and keep their own heat (Jupiter's 100 K today, by Burrows et
    al.'s slope): 2 to 5 K in the Dusk.
  - Steam worlds stand on ground by their star's colour (Selsis et al. 2023): about 600 K by a red
    dwarf, 550 K by a TRAPPIST-1 and 1,250 K by a Sun-like star at the limit, warming slowly past
    it, not 1,500 K everywhere.
  - Only the starlight divides a locked world into day and night; its own heat and the glow warm
    both sides (a world warm from inside had a day side 40% warmer for no reason).
  - Dead stars, one law per kind, the same in every age, each from its own age (a hash of its
    mass for one the galaxy began with), so nothing jumps at the Last Light. White dwarfs by
    Mestel's law, then faster once crystallised (the player's choice): 48 to 89 K in the Dusk,
    13 K at η 15. Brown dwarfs by Burrows et al. (2001): 28 to 63 K in the Dusk, 420 K at 59
    billion years. Dark matter warms them from the Dusk on: embers 63 K, neutron stars 900 K (no
    longer 30,000 K in the Dusk), brown dwarfs 4 K. A dwarf a world falls into reads 50 to 110 K,
    not 300 K; a red dwarf's remnant is never hotter than its flare's peak. No white dwarf the
    galaxy began with is above 2,000 K: one is, physically, only for its first 64 billion years.
  - A neutron star's panel shows curvature warmth once known; the Heart's disk goes dark once
    matter is gone.
- **Live: what the panels say.**
  - Airless bare rock and rubble hold no liquid water: frost below 110 K (Vasavada et al. 1999),
    cold-trapped on a night side, boiling off where warm.
  - Names by where the water is: Eyeball sea and Eyeball world (Pierrehumbert 2011), Terminator
    world for a living world with a dry day side and a frozen night side (Lobo et al. 2023), a
    Scorched world only with its night side thawed, a Twilight sea for a locked icy world in a
    flare whose night side is still frozen; "Once …" only for a world that changed, from its past.
  - Room for Kin is the real rule (none where a flare scorches, five by a thawed sea).
  - Chips only while true: a buried ocean only with tides (and core heat after the Last Light),
    water-rich only with the water, vent life and warm-under-hydrogen only while alive, clathrates
    not on a steam world, resonance and locking not for a world alone; belts are never locked.
  - Sunlight "none: its star gives none", "(most)" or "(least)" where surface arrays are capped;
    Falls inward only where worlds fall in; masses and small lights to two figures (×0.05, not
    ×0.1); a feeding world's orbit; truer tips and finds (a primordial hole's mass by the age,
    fossils and flare glass).
  - Cold white dwarfs (below 780 K) are drawn as embers are, a little more copper.
  - Rust fades, a tenth a turn where no swarm is, and is gone below 1% (the player's call).
- **Live: rules.**
  - No Kin room on a world frozen hard (warmest ground below 195 K), unless Orbital Lamps warm it.
  - A system that falls into the Heart takes its worlds (they had stayed behind as phantoms, some
    feeding a star that was gone); older saves are cleared as they load.
  - A flare boils a dead world's seas as a living one's; a water-rich world keeps its own; life
    dies at once where even the night side is past 395 K. A world dead of its decline under a
    burning star is said to keep its open sea (Aster's message had it frozen at 336 K).
  - The sea-freezes event and the comet bring nothing back to a dead homeworld; vent life on a
    world with no star freezes as a rogue's does; Kin cannot settle ice giants.
  - Brown dwarfs give collectors all their own light: next to nothing in the Dusk, worth one to
    thirty embers at the Last Light, fading as they cool. Ordinary collectors gather nothing there;
    **Infrared Shrouds** (Ember Harvest, the Deep, three) do.
  - **Attack the swarm** (the player's ask): every warship at its star together, once a turn, at
    plain strength, by the odds it has when it comes for them, shown on the button; a win tears
    0.3 × the attack out of it and salvages twice that, a loss tears into the ships, a sleeper
    that survives wakes. Choose on map takes a swarm for its star.
- **New games only.**
  - Outer worlds: one red dwarf in three has one to three cold worlds at 0.3 to 8 AU, one brown
    dwarf in eight one (18 to 34 a galaxy: 47% ice worlds, 37% ice giants, 10% gas giants, 6%
    belts), each system from a draw of its own after generation: every other world as before.
  - A locked water-poor world with a frozen night side keeps its water there (35 in four
    galaxies: eyeball and twilight seas) instead of starting as bare rock.
  - The home ice moon is locked, as everything inside 0.08 AU is.
  - The physical flare (the player's choice, new games only): a 0.10 M☉ star peaks at 5,800 K and
    1% of the Sun, about 9 times its light (4 to 80 times by mass), not 174. Aster's night side
    reaches 323 K, not 681 K. Older games keep 8,200 K.
- **Balance.** 300 games: 143 survive, 56 victories, a Degenerate Age of 69 turns. 900 games:
  435 / 184 / 71, against 429 / 185 / 69 live, within the noise (no game plays out as before, as
  the galaxies differ). By fate: decay 166 / 450, stable 165 / 239, curvature 104 / 211. The
  audit's rule fixes on their own gave 455 / 194 / 69.
- **Checks.** New `unit/worlds`, `unit/deadworlds`, `unit/outer`, `unit/attack`, `browser/worlds`
  and `browser/attack`; `unit/cooling` rewritten for the laws; `unit/scorch`, `unit/icy`,
  `unit/evap` and `unit/dismantle` updated.

## Our clock on the Signals screen; the pace reaches other minds (8 Oct)

- **Talk at any rhythm we can keep** (the player's ask: "by adjusting your turn speed, it should
  be possible to talk to civilizations that you otherwise would not be able to"; their choice,
  "Any rhythm from mind to turn"). Our clock is now a span, from how fast our dominant minds think
  to how long a turn is, since a reply can always wait for the next turn. A mind can talk with us
  if its clock lies within a thousandfold of any point of the span (a millionfold for a
  civilization of processes and protocol, such as the Tessellate; 2.5 tenfolds for the Slow
  Ones). Before, only our dominant minds' clock counted. So slowing the pace reaches slower
  minds, and quickening it, past how fast our minds think, reaches faster ones. Slow turns still
  cost minds that cannot slow themselves (tempo strain, unchanged). Live: games in progress too.
- **Our clock on the Signals screen:** a card at the top, "Our clock 10^1.6 to 10^2.4 yr", saying
  what sets each end; each civilization's Clock row says in reach, too slow for us or too fast for
  us, and its tip the nearest pace we can choose that would reach them (each pace tried with its
  own coming turn, as flares and new stars set some), or how many tenfolds longer or shorter our
  turns would have to be, and which other Thread of ours would reach them were it the most of us
  (Coldminds for the slow, Kin or Echoes for the fast); the Slow Ones' card the same. The Manual
  explains it.
- **Balance.** 300 games: 148 survive, 72 victories, a Degenerate Age of 71 turns (143 / 56 / 69
  before). 900 games: 439 / 203 / 71 (435 / 184 / 71): survival within the noise; victories up
  19, as more neighbours are saved (775 of 2,894, against 688 of 2,899; The Long Thought 133
  against 118, The Aeon Seed 70 against 66). 426 of 900 games play out as before. By fate: decay
  167 / 450, stable 165 / 239, curvature 107 / 211. The autoplayer changes its pace only for
  energy, never to reach anyone: the gain is the wider span alone.
- **Checks.** New `unit/clocks` and `browser/clocks`. `browser/swarm-click` measures a winning
  pick as the picker does (its distance and drawn disc): it had listed what was near each point
  only up to 12 px, while a world wins over a swarm's haze within 13 px in a system, so a world
  orbiting 12.6 px from the cloud's centre, rightly picked, failed it one run in three.

## A settlement where a star was; curvature warmth; stars sorted by type (8 Oct)

- **Live: a settlement where a star has gone shows on the map** (the player's Uluvacaluth Deep).
  A black hole that evaporated while only others lived in its Deep (our own people who left us)
  was marked gone, as nothing of ours was there; taking them back settled that Deep, in a system
  still marked gone: no node or name on the galaxy map, nothing to click, ships refused ("Nothing
  is left there."), a "gone" chip. A settlement now keeps its system (`createColony`), and a game
  in progress is repaired as it loads (a starless system holding a settlement of ours; one that
  fell into the Heart stays gone). Its panel reads "No star left" (was "Empty"), "No star is left;
  what was around it drifts on" (was "Nothing remains"), and no longer gives the mass of a star
  that is gone.
- **Live: curvature radiation warms everything a little** (the player's catch: "everything is at
  horizon temperature. Even though curvature radiation would heat it above"). Under that fate,
  known by the Black Hole Age, the particles made inside a body are absorbed and warm it (Falcke,
  Wondrak & van Suijlekom 2025, JCAP 05, 023: 25 nK for a neutron star, 5.5 pK for a 1.3 M☉
  white dwarf). One law, T ∝ (Mc²/τ ÷ 4πR²σ)^¼ scaled to those two figures, with the game's own
  lifetimes: white dwarfs 0.3 to 3 pK, brown dwarfs about 3.5 fK, worlds 0.1 to 0.3 fK, where
  they read the horizon's 2 × 10^-30 K (only neutron stars glowed before, at 30 nK). Shown, never
  gathered: no rule reads a temperature this low, and collectors gather the same at every star.
  The game's white-dwarf radius (R ∝ M^-1/3) is too large for the heaviest: a 1.3 M☉ one reads
  3.1 pK.
- **Live: stars sorted by type** (the player's ask, "without cluttering the UI"): one more sort in
  the Surveyed worlds list, Type: the Heart and the black holes, neutron stars, white, black and
  brown dwarfs, the living stars, the starless, nearest first within each. Its Systems view now
  lists every surveyed star, those with no worlds too, "no worlds, only its Deep" (10 of the 12
  black holes in seed 1000, and the Heart); in Planets view each world names its star's kind
  while sorted by it.
- **Balance.** 900 games identical to the last run, line for line: the autoplayer never takes a
  star by force, and no rule reads the new warmth.
- **Checks.** New `unit/settled` (fails without the fix: the system stays gone, ships are refused,
  an old save is not repaired), `unit/curvature`, `browser/settled` and `browser/startype`;
  `browser/evap` reads "No star left".

## A magnifier mode, and the game for everyone at any size (9 Oct)

Live: PR m1omg/Steliterate#4, merge commit `d9bd6e5`.

For the player's friend, who has low vision and plays through a screen magnifier with the page made
bigger and translated by the browser (into Czech, the tool at hand: she and the player are Slovak):
"the menus are often inaccessible, especially the build menus".
No rule changes; saves are untouched (the mode is a setting, kept in the browser).

- **For everyone, unseen at usual sizes.**
  - *The panel scrolls whole when short.* Made bigger by the system or the browser (1080p at
    200% leaves the page about 960×460), a settlement's head alone (206 px) filled its panel
    (142 px): the Build list had no room at all. Below 150 px for its body the panel now scrolls
    as a whole, head and all, and keeps its head again above 190 (a11y.ts `useWholeScroll`); the
    event and survey-report windows do the same with their plates. At 1400×900 and on a phone
    (390×844) nothing changes.
  - *The rail stops above the forecasts and scrolls*: on a short screen they covered its last
    buttons, Save and Menu. The research and ship prompts and the guide keep within the screen.
  - *Every clickable row works from the keyboard*: Build rows, destinations, In-orbit rows, list
    rows, forecast cards, the Insight and Accord figures, Record entries (Tab, then Enter or
    Space). A mouse click leaves no focus on them, so Enter still ends the turn and never queues
    a second structure.
  - *A focus ring once Tab is used* (inside the edge, where the chamfers no longer cut it); none
    for the mouse.
  - *Windows take the focus on their title and give it back*, the HUD behind them out of Tab's
    reach (inert). An event takes it on its title, never a choice.
  - *Keys.* Enter no longer ends the turn under an event, its result or the survey report, nor
    while a button or row has the focus (Enter on a focused world row used to select it and end
    the turn). Escape cancels choosing a destination, or clears the selection, whatever has the
    focus (with a button focused it did nothing, though the banner says "Esc cancels"); under an
    event it does nothing; it closes the survey report.
  - *A page translated by the browser stays live.* Chrome's translation swaps each text node for
    `<font>` elements; Preact went on updating its own text nodes, out of the page, so under
    translation the turn count, η, every panel's title (each star chosen kept the first one's
    name) and every tooltip froze at their first value. Once a translation shows, each text node
    and its stand-in are kept paired: an update puts the text node back, for the translator to
    translate again (translateGuard.ts). Untranslated, nothing runs but one observer.
- **The magnifier mode** (Menu, or Settings on the main menu; or a link, `?lowvision`):
  - the HUD in one scrolling column beside the map, on the right or the left: the age and time,
    resources, prompts and the guide, End Turn with the pace and the to-do chips, the menu with
    its words, every forecast and the Record, the view buttons, and last the selection's panel
    at its full height, so nothing else moves when it changes; Hide the panel (M) folds it away;
  - the camera keeps what is selected in the middle of the free part of the screen (a sideways
    view offset, eased on elapsed time like the phone's);
  - two more sizes, 1.6× and 2× (capped only by the column's 360 px); turning the mode off brings
    a larger size back to 1.4×;
  - faint text 7.7:1 on the panels (was about 3.5:1), dim text 11.9:1, the edges of controls
    over 3:1, solid panels without grime, scanlines or glow, a plainer and wider sans in place
    of the condensed faces, no all-caps; what cannot be used now dashed, not faded; a chosen tab
    marked by a bar as well as colour; a heavier two-tone focus ring;
  - the focus, which a magnifier can follow, goes to what opens: a window's title, the panel of
    whatever is chosen, the Build list (from N, B or the idle-settlement chip), a prompt or the
    guide (their titles: a stray Enter presses nothing);
  - tooltips for the focus as well as the pointer, beside the column and level with what they
    explain, readable with the pointer on them, put away with Esc;
  - messages kept until closed (a button on each) or the turn ends;
  - N: what needs attention, one thing at a time (research, each idle settlement's Build tab, each
    settler, each idle ship, the signals); B: the chosen settlement's Build tab;
  - windows over the whole screen, scrolling in one piece where they have a plate;
  - the map: names at 15 px times the interface size, kept further apart and fewer (24 nearest,
    not 36), in stronger colours; stars, rings and fleets drawn 1.5×, the selection ring thicker,
    the pointer's reach 1.5×; no film grain, vignette or colour fringes; the Enhanced view when
    the mode is turned on; whatever is under the pointer named beside it in large type;
  - the Systems window gains "Seen from afar": every star on our map not yet surveyed, nearest
    first, to look at or send a ship to without finding it on the map; a probe's More in Systems…
    opens on it.
- **Manual.** A part on low vision and the keyboard; the keys line names N, B and M.
- **Balance.** No rule changes: 900 games identical to the last run, game for game (148 of 300
  survive, 72 victories, a Degenerate Age of 71 turns; 439 and 203 of 900; decay 167 / 450,
  stable 165 / 239, curvature 107 / 211).
- **Checks.** New browser checks `a11y` (at 960×460: the panel scrolls whole and every Build row
  can be reached; rows from the keyboard, no focus from a click; windows and events take focus
  and give it back; Enter and Escape; nothing changes at 1400×900 or on a phone), `translate`
  (turns played under a stand-in translator: it fails without the guard, on the turn count, η, the
  panel titles and the tooltips) and `lowvision` (the mode at 1280×720 and 2×, 25 checks).
- **Not in this batch.** Read-aloud, moving the camera from the keyboard, a translation of our own.

## A phone interface that leaves the map usable (10 Oct)

The player, on a phone: "No year turn info on mobile + selecting stars on map is frustrating AF
as the whole screen is covered by windows which need to be closed first." The phone width hid the
turn, its span and the forecasts; the selection's panel covered half the screen, the idle-ship
card popped up over the map, and a tap left tooltips standing. Held sideways, a phone got the PC
layout, which overlapped everything (the sideways layout is for touchscreens only: a short window
on a PC keeps the PC layout). Interface only: no rules, saves or seeds touched.

- **The turn on the top bar.** A line under the era's name: "Turn 63 · this turn 2.5 Tyr · next
  3.1 Tyr", with the number of forecasts. A tap opens the timeline across the ages, the forecasts
  (closable, as on a PC) and the latest of the Record under the top bar. The era's numeral line
  wraps instead of being cut.
- **The selection in a sheet.** Upright, the panel is a sheet over the bottom of the screen with a
  handle and three sizes (about a third of the room; about three quarters, as tall as the old panel;
  all of it). What is tapped on the map opens it small, so the map stays in view; anything chosen
  from a list or a button opens it at the size last set with its handle (kept between sessions).
  Touching the map (turning, panning, zooming) lowers it to small; tapping empty map closes it, as
  before. The map's centre slides into what the sheet leaves, as before, now for every size. Held
  sideways, the panel is a column on the right and the map's centre moves into the space to its
  left.
- **No card over the map.** The idle-ship card does not pop up on a phone: the "ships idle" chip
  opens the ship's panel, with the same orders. The to-do chips sit at the top left of the map,
  under the top bar, where the sheet does not reach (only the chips take touches), and step aside
  while a destination is being chosen.
- **Touch.** A tap no longer opens a hover tooltip (it stayed over the screen); a press held half a
  second shows it until the next touch, and presses nothing. A finger reaches 28 px on the galaxy
  map and 36 in a system (the mouse 16 and 26), a press may wander 12 px and still be a tap (the
  mouse 6), and a star's or world's name on the map counts as the star.
- **Choose on map, by touch.** The panel folds away; the first tap on a star shows the trip in the
  banner (distance, turns, cosmic time, energy) with a Send button; a second tap on it, or Send,
  sends. While a destination is chosen, the fleet's own star (and the fleets parked there) cannot
  be picked, so a finger's reach no longer takes the ship itself. The mouse keeps hover and click.
- **A compact HUD.** Resources in two rows (Resolve, Dissent and Free energy as a small name over
  the value); the rail with a name under each of its 8 buttons, all fitting at 360 px (Codex and
  Save are under Menu, which gains a Codex button everywhere); the pace as one button whose list
  explains each choice (Long Sleep in it too), beside Sleep; the view switch a small column at
  the map's right edge (a row held sideways), with the thermal key beside it; messages, the map
  banner, prompts and the guide hang from the top bar.
- **Fewer messages.** "The browser paused the graphics" (and "restored") only when the graphics
  stay away more than two seconds: a phone drops them at every switch to another app.
- **The guide** points at the turn line and the pace button on a phone, with words for them.
- **Manual.** A paragraph on phones under Controls.
- **Short panels: a Build row's description shows two lines** (its tooltip, or a long press, has
  all of it), where the panel is too short and scrolls whole. Measured in the game's real fonts,
  the friend's 960×460 screen had one row (Night-side Shelters, four lines of description) 145 px
  tall in a 142 px panel, so it could never be seen whole; `main` was the same. The checks had
  measured in fallback faces, where it was 130 px.
- **Unchanged:** the PC layout and the magnifier mode (its own column, also on a phone).
- **Checks.** New browser check `mobile` (upright at 390×844, 360×740 and 625×1000, and sideways at
  844×390, with a touchscreen; the magnifier mode on a phone; a PC screen). Browser checks can open
  touch pages (`ck.phone`), and with `STEL_FONTS` serve the game's fonts from a local copy, so text
  is measured in the real faces where the browser cannot reach Google (DEV-NOTES). The playtest
  clicks the rail's buttons shown (on a phone Codex and Save through Menu).
- **Balance.** No rule changes (nothing under `src/game` changed): 300 games identical to `main`,
  game for game (148 of 300 survive, 72 victories).

## What a Thread makes, in words (11 Oct)

- The Threads window's "Works: 1 ind · 0.8 ins · 0.3 acc" now reads "Each makes: 1 industry, 0.8
  insight, 0.3 accord", like the Upkeep row above it ("Works" could be taken for the Great Works).
  The words are in the narrow face and only the numbers in mono, and a line breaks only between
  items, so the row takes no more room than before (two lines in a PC card, one on a phone). Its
  tooltip says what each is for: industry builds, insight drives research, accord goes to the
  Charters and the Threads.

## Research: no "???" once the fate of matter is known (11 Oct)

- A few research projects exist only under one fate of matter. Until the fate is known they show
  as "???", with the hint that the Proton Question would tell. After it was answered, a project of
  another fate still showed as "???" with that same hint, as if more research would reveal it (the
  player, with the Proton Question done). Now, once the fate is known, the other fates' projects
  are left out of the grid: they will never exist in this universe. Interface only.
- New browser check `research-fate`.

## Swarms go for ships near them; ships share a settlement's losses (11 Oct)

The player: "swarm never really attacks my ship", with their ship at a star near a swarm. By the
rules a swarm struck only ships stopped at the very star it was eating, where we had no
settlement (70% of turns awake, 20% asleep), so a ship one star away was never touched; nor
were ships at a settlement it broke into. Chosen with them: both changes below.

- **Swarms hunt ships stopped nearby.** An awake swarm of size 2 or more notices the nearest of
  our ships stopped at a star within 25 ly of it, where we have no settlement and no swarm sits,
  and on 30% of turns (15% under the Blackout) sends part of itself after it (size 1 to 1.6,
  taken from the swarm). We are told, naming the ship; the ship's panel says it is coming and what
  it will do, the swarm's panel whom it is after, and the map shows it on its way (swarms cross
  space at a twentieth of light speed, so it can take a few turns). Where it finds the ship
  stopped it strikes, every turn the ship stays, by the same fight as any swarm (a Warden beats
  it off; a probe rarely survives two strikes). A ship under way is safe from it. Once the ship
  has moved on or is lost, the part goes back to its swarm and rejoins it, following it if it has
  moved on. Not before the first swarm's own moment, nor under the Communion Charter. The reach
  is 25 ly rather than the "about 20" offered: neighbouring stars are about 17 ly apart, and at 20
  a quarter of swarms had no star in reach (5 of 60 at 25).
- **Not on to our settlements.** As offered, a part whose ship was gone would have gone on to our
  nearest settlement, as the first swarm's part does. That cost 18 to 30 of 300 harness games
  (118 of 300 survived; 130 with the autoplayer bringing its idle probes home, where none is
  hunted): a part of size 1 to 1.6 at an undefended outlying settlement strips a structure every
  turn. Going back to its swarm keeps the threat to the ship.
- **Ships share a settlement's losses.** When a swarm breaks through a settlement's defences, the
  ships there are hurt too, 0.2 to 0.6 of the swarm's size each (before, they came through a lost
  fight untouched, while a won fight scratched them). A fleet that loses ships, there or anywhere
  a swarm fights it, says so.
- **Messages.** A swarm going for one of our ships (coming for it, striking it, losing it) shows
  as a message at End turn, with Look to go to the ship, not only as a line in the Record.
- **Saves.** Three optional fields (a part’s ship and its swarm, a log line’s fleet): saves load as
  before.
- **Checks.** New unit check `hunt` and browser check `hunt`. The browser check `cooling` now
  plays its game to η 17 rather than 16: with these rules seed 1000's game stopped at η 16.4, where
  the first cold dwarf it found, a white dwarf born late from a red dwarf (0.09 M☉), honestly read
  1.4 K, not the millikelvins the check expects (`main` reached η 17.3 and the same 578 mK star).
- **Balance.** 154 of 300 survive (148 before), 69 victories, Degenerate Age 72 turns; 900 games
  443 / 191 / 70 (439 / 203 / 71 before), within the noise. By fate: decay 180 / 450, stable
  166 / 239, curvature 97 / 211. In 30 games a part goes after one of our ships 1.07 times a game,
  every time an idle survey probe (the autoplayer leaves its probes where they stop once nothing is
  left to chart); ships lost to swarms 0.57 a game (0.20 before); structures stripped from
  settlements 1.80 a game (1.67), settlements lost to the Hunger 0.17 (0.17). Sharing a
  settlement's losses alone: 146 of 300.

## Halo Siphons can be shut; the halo empties sooner while they run; the Unlit's messages wait (11 Oct)

The player: "how do i actually stop draining the halo?" They couldn't. Halo Siphons is a research,
and research is never undone, so the Unlit's request ("Requires not using Halo Siphons") was refused
for good once it was researched. Their request also lapsed 8 turns after it came, like any message,
and the research's "the halo empties sooner" was not true: the halo's end never moved. Chosen:
shut for good, messages that wait, and "make it true", with "only count the emptying from point of
continuing, so, for existing saves NOT retrospective … so i won't load into an empty halo". Then:
"where do i actually shut the siphons? … i just can't agree due to the siphons", so the button is
under their request.

- **Shut the Halo Siphons** (`shutHaloSiphons`, `civ.flags.siphons_shut`, the turn), under the
  Unlit's request while the siphons run and on their card (Signals, Other minds), with a yes
  first ("Shut them for good" / "Not now"). For good: they cannot be started again. From the next
  turn ember light no longer doubles; their request can be answered with Help (the refusal names
  the button); and the siphons no longer move the Unlit to fling worlds loose (being refused still
  does, `dark.flags.hostile`). The quest's own texts and choices are unchanged.
- **The halo empties sooner while the siphons run** (`physics.ts`: `haloDrawn`, `drainHalo`).
  The game lets the whole halo fall twice as fast while they run: its clock runs ahead of ours by
  the years they have drawn (`civ.flags.halo_drawn`, each turn's length while they run, until the
  halo is spent), and every ember, brown dwarf, neutron star and the galaxy's glow reads it
  (`drawn`, a trailing parameter of `emberShare`, `backgroundK`, `ownTemperature`,
  `primaryTemperature`, `primaryLuminosity`). Running from early on, the embers go out by about
  η 24.7 instead of 25 (doubling the fall halves the time: log₁₀ 2 ≈ 0.3), about a turn sooner at
  the standard length. Shut, they draw no more; what was drawn stays drawn. **Not retrospective:**
  the counter starts at none in every save, whatever it had researched, so each save loads into
  the halo it had. (Each Degenerate turn is longer than all the years before it, so a save before
  η 25 that keeps them running catches up within a turn or two.) Where the game bends physics, in
  the Codex: a few dozen embers among hundreds of billions of white dwarfs could never empty a
  galaxy's halo.
- **The siphons double what an ember burns, not a world falling into it.** `SourceInfo.dark` is
  the dark-matter part of an ember's light; a rekindled dwarf's light from an infalling world (and
  a collision star at a halo dwarf's place) is no longer doubled. Ember restraint (×0.75) is as it
  was.
- **The moved date shows:** the embers forecast, the Chronometer's "Embers fade" ("Our Halo
  Siphons are bringing it sooner."), and The Embers Dim (when it can come, and its hint). With no
  siphons, all as before.
- **The Unlit's messages wait for an answer** (`waitsForAnswer` in `signals.ts`): they never
  lapse, and the 160-message cap keeps an open one. One that lapsed in an older save opens again
  as it loads (`migrate`). Other messages keep their 8 turns. An unanswered one keeps its "signal
  to answer" chip.
- **Texts:** the Codex (Degenerate Age: Halo Siphons, and the bend), the Manual (the Unlit), the
  research's description ("They can be shut for good later, but not started again.").
- **The player's save** (turn 134, η 32): it loads with nothing drawn and the same light (its
  halo has been spent since η 25, as in every game; the siphons give it nothing there: +215.3
  energy a turn with or without them); its request, open since turn 133, is still open after turn
  141; shut, then Help takes 200 matter and 100 energy, and the quest goes on.
- **Checks.** New unit check `siphons` and browser check `siphons` (the button under the request
  and on the card, Not now, the keyboard, Help after; the magnifier mode).
- **Balance.** The autoplayer researches Halo Siphons in 151 of 300 games, 109 of them before η 25
  (its fallback, the cheapest open project, ignores `noAuto`), and never shuts them, so the drain
  and the undoubled rekindled light reach the harness. Against the swarm batch: 151 of 300 survive
  (154 before), 69 victories (69), Degenerate Age 71 turns (72); 900 games 442 / 195 / 70 (443 /
  191 / 70), within the noise: 802 of 900 games play out as before, and the changes go both ways.
  By fate: decay 178 / 450, stable 167 / 239, curvature 97 / 211. Alone, against `main` before the
  swarms: 146 / 67 / 71 in 300 (148 / 72 / 71), 900 games 441 / 202 (439 / 203), 807 of 900 as
  before.

## The Last Star shines when it lights, and can be kept time with, free (12 Oct)

The player: "when will i see the new star?" In their game (turn 149, a save uploaded to the session
that wrote the plan) they shut the Halo Siphons on turn 134 and pressed Help on 135; on turn 139 the
Last Star lit and burned out inside that same turn, and the Unlit's message about it came on turn
140. They never saw it shine, and no turn drew on its light. It lit in step 6 of the turn (as the
turn began) and lived until the universe was three times as old: a Degenerate turn at the Tide is
1.82 times the universe's age, ten times that for each slower pace, so at pace −1 or slower it died
in the turn it lit, and at the Tide the next turn got about 3% of its light. Only a quest finished
before about η 24.5 got turns of it, from its floor of 10^25 years. Reproduced with `main`'s code:
lit at η 26 at pace −1, out the same turn (the save is now in `tools/saves/`). The plan, written by
the other session, is `docs/plans/last-star.md`. Asked, the player chose "Like other new stars",
"Free", "Relight it on load", and, for where the clock is offered: "there should be an event about
it, also keeping time with this particular one should be free for the player regardless of his
timescale".

- **It lights as the turn ends**, as every new star does (`gatherTheLastStar` in `minds.ts`, called
  in step 7 after the universe moves on), and burns until the universe is three times as old as
  then, never before 10^25 years and never less than the turn after it at the Tide
  (`lastStarDies`). So it shines through the whole next turn at the Tide (×10 light where anyone
  lives by it), and at a slower pace through part of it. The Unlit's message, its gift and
  everything the quest says are word for word as before; the check compares the message with the
  one `main` wrote.
- **Its own event, Light in the Halo:** how long it burns and what keeping time with it gives, with
  Keep time with it (six turns of its light, each lived in full as one Tide turn) or Watch it burn
  (insight +25, resolve +2, as for every new star).
- **Free, whatever our pace:** the Last Star is the Unlit's gift to everyone who can see it, so its
  clock costs nothing at any pace, following on from another clock too (no floor), and no partner
  halves it. It is a new star for the clocks (`isNewStar`), and may be kept time with in the Black
  Hole Age's calendar too, where it can light in the stable and curvature fates (the calendar turns
  at 10^40 years without the age); collision and helium stars are unchanged.
- **Where protons decay** the Great Decay dissolves it with the rest of matter, and a clock kept with
  it ends there (`starGoneEarly` in `endOfMatter`). Lit in the very turn the Great Decay comes, its
  event says what took it.
- **In the Dark Era** (one harness game in 300 finishes the quest there, at η 2,370) the calendar no
  longer counts years: it lights and goes out within the turn, as it always did there, and the
  Record says so. (Lit as the turn ends with infinite years, its light would have read NaN.)
- **Old saves:** a Last Star the old rule lit too late to shine (after about η 24.5), out within the
  turn after it lit (or burning but going out within the coming turn), lights again as the save
  loads, while matter lasts, as this turn begins, and its event waits. Marked once
  (`civ.flags.last_star_lit`), so it never lights twice. The player's own game is past the Great
  Decay (η 40.6): there it cannot shine, so it will show in a future game.
- **On the map** its name keeps its ✦ while it burns, as a collision star's does; its panel says
  "Burns until", and the forecasts say when it burns out.
- **Texts:** the Codex (Degenerate Age: dark stars, Spolyar, Freese & Gondolo 2008, and the bend: a
  dark star in the far future, and how long it burns, are the game's choice), a source, and a line
  in the Manual's paragraph on new stars.
- **Not changed:** the neighbours' rules for new stars (sleepers waking for one, claims), which stay
  as they were for other civilizations.
- **Checks.** New unit check `last-star` (paces 0, −1, −2; free at every pace where a collision star
  would cost 240; six turns kept, each in full; Watch; the Great Decay; the Black Hole Age's
  calendar; the Dark Era, which fails without its guard; an old save made with `main` relit once and
  played on; four cases not relit) and browser check `last-star` (End turn lights it, its event,
  Keep time from the keyboard at no cost, the Pace chip through six real turns, its panel, the
  magnifier mode). A sixth save in `tools/saves/`: `98139af-seed1000-turn121-last-star-out`.
- **Balance.** 300 games: 150 survive, 67 victories, a Degenerate Age of 72 turns (151 / 69 / 71 on
  `main`). 900 games: 445 / 199 / 70 (442 / 195 / 70), within the noise; 721 of 900 play out as on
  `main`, and all 179 that changed light the Last Star, the outcomes moving both ways. By fate:
  decay 177 / 450, stable 166 / 239, curvature 102 / 211. In the first 300: 75 games light it, from
  η 15.0 to 2,370 (median 23.1); 40 before η 24.5, where the old floor already held it for turns;
  19 in the Black Hole Age's calendar and 1 in the Dark Era; the autoplayer keeps time with it in 32.

## A second track for the Dark (12 Oct)

The player, with Krea topped up (1,504 credits) and connected to this session: "do the music and
the event plates too", then "go to town".

- **The Dark Era has two recordings** taking turns, as every other age does: "Recorded II" (Settings
  → Playlist), a steady low drone on E, from the prompt that waited in DEV-NOTES (ElevenLabs Music
  v2.5 via Krea, levelled to the first Dark track, −19.3 LUFS). The first is now "Recorded I".
- **A recorded Canon was tried and not shipped.** It came out a D–G vamp over an E♭ drone a semitone
  against it, without Pachelbel's ground bass or voices in canon (measured: DEV-NOTES, Music
  tooling). The arranged Canon stays the overture.
- **Event plates: not yet.** Krea's API had no units left for images after the two tracks (0 of
  the 111 one plate needs), as on 29 Sep. Fifteen plates are planned, prompts written, in
  `docs/plans/plates.md`.
- No rules changed.

## The second Dark track out again; a measure for generated music (12 Oct)

The player: "Recorded Canon isnt canon but a monotonous drone" and "The dark era track is monotonous
AF too...". Right on both: the new Dark track was a steady drone, as my own measurement had said,
and it went live without them hearing it first.

- **The Dark Era plays its first recording alone again,** as before PR m1omg/Steliterate#18 (the
  build is the one that was live before it, byte for byte). Asked, the player chose to remake both
  Dark tracks with movement: chords, a melody, sections. One comes first when Krea has units again,
  then the event plates, then the other.
- **How much a track moves:** `tools/music/movement.py` measures the share of a track's pitch
  energy on one note, how much its harmony moves, its notes a minute and the spread of its level.
  The tracks the player likes sit at 20–25% on one note, with harmony that moves; both Dark tracks,
  Degenerate II and Black Hole II are drones, at 56–78% (the player: leave those two, each takes
  turns with one that moves). From now on a generated track is measured, and heard by the player,
  before it goes in.
- **The Canon:** the arranged one stays as it is. Krea's music models take words only, so they
  cannot follow Pachelbel; no more recorded Canons.
- No rules changed.

## The Embers Dim only while the halo thins (12 Oct)

The player, reloading their turn-137 save, with the Record's "137 The Embers Dim: Understood.": "what
happened here?" The Embers Dim ("The dark-matter halo is running thin … Whatever we are going to
live on next, we need to find it now", resolve −2) is a chance event, and could come any time from
η 22.3 to 39. It came to them at η 35.9, eleven tenfolds after the halo was spent (η 25), and its
hint said ember yields "keep falling until η 25".

- **Now it comes only while the halo thins:** from η 22.3 until the embers go out at η 25, both by
  the halo's own clock (Halo Siphons run it ahead, so the news comes sooner where they drew). A
  chance event, it may not come at all.
- **Their save** keeps the event it already had. In it, Help was answered on turn 135, so the
  gathering is under way, and the Last Star lights as turn 139 ends; turn 140 brings Light in the
  Halo and the Unlit's message (checked by playing the save on).
- **Check:** new unit check `embers-dim` (fails four times on the old rule).
- **Balance.** 300 games: 157 survive, 69 victories, a Degenerate Age of 72 turns (150 / 67 / 72 on
  the live rules). 900 games: 449 / 202 / 70 (445 / 199 / 70), within the noise: 534 of 900 play
  out as before, and the others move because the pool of chance events changed, outcomes going both
  ways (35 defeat → endurance, 31 back). By fate: decay 181 / 450, stable 169 / 239, curvature
  99 / 211.

## Export all saves (12 Oct)

The player: "Also, please let me export all the saves from the browser, not just one."

- **Export all saves** (Save and load, under Files; also from the title screen's Save and load): one
  file, `steliterate-all-saves-<day>.json`, holding every save slot, the quick save and the
  autosave, each the same JSON a single save file holds.
- **Import save file…** reads such a file too: each save comes in as a slot of its own, keeping its
  name and the time it was saved; the quick save and the autosave arrive as slots named for them
  ("Quick save: The People, turn 151"), so this browser's own quick save and autosave are never
  overwritten. A save already here (the same name, turn and time) is skipped, so importing a file
  twice adds nothing. The message says how many came in, were already here, or could not be read or
  did not fit in the browser's storage. A single save file loads, as before.
- **Manual and README** say so.
- **Check:** new browser check `save-all` (two slots, a quick save and the autosave; the file and
  what it holds; a browser emptied of saves; the import, then a second one; an imported slot loads).
- No rules changed; saves unchanged.

## Rogue worlds leave their star behind; black holes by lifetime; the late sky as it is (12 Oct)

The player, in the Black Hole Age: "There should be an option to see black holes by their lifetime.
It may come in handy during the late black hole era, for instance. Also, please check if Stellar
lifters work on Rogue Planets too, because they should not. … does matter harvesting take away from
the mass of the planets or other objects? and stars in enhanced mode in bh era isnt accurate,
describing brown dwarfs at 13". Then, at turn 204 (η 90.9), with the Aeon Seed at 2,122 of 1,700:
"resume? i invested more energy than needed already", and "also positronium forming did NOTHING …
no event etc".

- **A world flung loose from its star has left behind everything built around that star.**
  Stellar Lifters did work there: a settlement on a rogue world could build one at the star it had
  left and draw its matter, and at a black hole draw its spin and Hawking light and store energy in
  a Horizon Vault, while its Hearth fed on the hole. Now a rogue world can build none of the Deep's
  structures (Stellar Lifter, Hydrogen Siphon, Dyson Swarm, Ember Collectors, Infrared Shrouds, Disk
  Skimmer, Pulsar Brake, Decay Harvester, Curvature Collector, Accretion Engine, Penrose Harvester,
  Hawking Collector, Horizon Vault: "Out of reach: this world has drifted loose from its star"), nor
  any light collector (Orbital Collectors too, as Solar Arrays before; their light was already
  nothing there). What it built there before gives it nothing: its line says it is out of reach,
  and so does its chip in the settlement's panel. Its Hearth no longer feeds on a hole it has left.
  A lifter left behind drains no free energy, and does not stop a settlement still at the star from
  building its own. The settle lists' Power and Matter count none of it for a rogue world, and the
  autoplayer takes apart what it left behind when short of matter.
- **Black holes by their lifetime.** In the Black Hole Age the Systems window has a ● Black holes
  tab: every black hole on our map, the longest-lasting first, with its years left and its turns
  left at this pace ("goes this turn" for one evaporating in the turn), its mass, its spin, what a
  Hawking Collector gathers there and who lives there. Choosing a ship's destination from the
  Systems window opens on it in that age. A hole's panel has an Evaporates row, in years and in
  turns at this pace.
- **Lasting at a black hole** (the Coldminds' measure, and so a Vault Ship's Best for them) read "∞"
  at every hole. A place at a hole now lasts until the hole evaporates (what is settled there drifts
  on after it, with nothing there to draw on), so the longest-lived hole comes first. A world of a
  brown dwarf read its gravitational-wave date, which never comes there (only a dead star of
  ordinary matter takes its worlds in): it never falls in.
- **Brown dwarfs.** At 13 K one read "still glowing with the heat of its youth": its light to
  collectors, counted in the age's tiny units, decided the words. Now they follow what warms it:
  "long cold by any star's measure, still giving off the last of the heat it formed with" while
  that is most of its warmth (some tens of kelvin early in the Degenerate Age, a few by η 17), then
  "nearly cold, faintly warmed by dark matter", then "gone cold". Its mass reads in figures (0.07
  M☉; it read "0"), and masses from ten thousand Suns in powers of ten (3×10⁸ M☉, not 3.0e+8).
- **The pictures after the Dusk.** Brown dwarfs kept their warm red, and neutron stars their
  blue-white blaze and beams, in every age, in the natural view and the enhanced alike, though by
  the Black Hole Age both are far colder than anything a picture can show. Now a brown dwarf greys
  as it cools (at a few kelvin, as dark as a black dwarf), on the map and inside its system, and a
  neutron star dims with its spin, as its collectors' light always did: beams in the Dusk, half at
  η 21, none from η 27. The Dusk looks as before; the thermal view always showed their temperature.
- **A finished Great Work cannot be resumed.** A Work stops taking insight once its progress
  reaches its cost, but its card still offered Resume, its bar running past its end, and resuming
  poured a turn's insight (and the labs' energy) into it again. The autoplayer did that every turn
  after finishing one, and never began another. Now a finished Work says Complete ("Complete: waits
  for the Heart" for the Aeon Seed, which is written when the Heart evaporates, if its condition
  still holds then), and cannot be resumed.
- **Positronium.** The chronometer marks "Positronium forms" at η 85, and nothing came of it. Now,
  where protons decayed or space unmade matter, the turn that passes it brings The Widest Atoms,
  once, as news (Study them: Insight +40; Let them be: Resolve +1). A game already past η 85 in the
  Black Hole Age hears it at its next turn. Stable matter leaves no positrons, and none forms.
- **Asked:** harvesting never changes a mass. Mines and skimmers lower a world's richness and
  hydrogen; a Stellar Lifter drains the galaxy's free energy, not its star; the Heart grows only
  from what falls into it.
- **Checks:** new unit checks `rogue-reach`, `great-works` and `late-sky`, and browser check
  `holes`; `cold-energy` and `evap` take a world still bound to its star (close passes had flung
  theirs loose, which they now meet as rogue worlds).
- **Balance.** 300 games: 154 survive, 72 victories, a Degenerate Age of 72 turns (157 / 69 / 72
  before). 900 games: 456 / 203 / 71 (449 / 202 / 70), within the noise: 406 of 900 play out as
  before, and the outcomes that moved went both ways (43 defeat → endurance, 38 back; 8 defeat →
  victory, 6 back). By fate: decay 189 / 450, stable 168 / 239, curvature 99 / 211. Aeon Seed
  victories 67 → 71.

## A third track for the Dusk (12 Oct)

The player, that evening: "i bought krea credits, you got access?" The connector answered, and the
API's balance had them. Asked what to make first, they chose the Dark track that moves, from the
prompt that waited in DEV-NOTES. It came out in A minor at about 64 BPM, its chords coming round
about every 30 s, with a melody (21% of its pitch energy on one note, its harmony moving 0.18, 104
notes a minute; the Dark's drone 78%, 0.001 and 4). Sent to them before anything went in: "that
track sounds good but tbh belongs in Dusk, add it as a Dusk track once you are done - for Dark a
darker remix of it may be good".

- **The Long Dusk has three recordings** taking turns: "Recorded III" (Settings → Playlist), after
  the other two (ElevenLabs Music v2.5 via Krea, `force_instrumental`, 180 s asked). Made to loop
  with a 6 s crossfade, so it also loops cleanly when it is the only one picked; 160 s long;
  −13.8 LUFS, held back by the −1.5 dBFS peak limit as Recorded II is (−13.3; Recorded I −12.7).
  A file never served before, `music/dusk3.mp3`.
- **`tools/music/loop-track.py`** takes an optional fifth field, how far in from each end it may
  trim (12 s by default, as before): this track ends in 15 s of reverb dying away, beyond the old
  reach.
- **A darker remix for the Dark:** `tools/music/darken.py` plays a track slower and lower together,
  as a tape run slow (4 semitones: about 51 BPM in F minor), takes its brightness off (a low-pass
  at 3 kHz) and lays a long dark reverb under it (6 s). Krea's music models take words only, so a
  remix of the same music is made here. Sent to the player to hear; it goes in only once they like
  it.
- No rules changed.

## A darker remix of it for the Dark (12 Oct)

The player heard the remix (the entry above): "add em yes pls".

- **The Dark Era has two recordings** taking turns, as every other age does: "Recorded II"
  (Settings → Playlist), the darker remix of the Dusk's Recorded III, made with
  `tools/music/darken.py` (4 semitones lower and slower, about 51 BPM in F minor; a low-pass at
  3 kHz; a 6 s reverb at 0.35). Looped with an 8 s crossfade, 201 s, and levelled to the first
  Dark track (−19.3 LUFS). It moves: 25% of its pitch energy on one note, its harmony moving 0.15
  (the first Dark track 78% and 0.001). The first is now "Recorded I". A file never served before,
  `music/dark3.mp3`.
- No rules changed.

## A burst reaches only what is still there (12 Oct)

The player, of the neutron stars' burst at the Last Warmth (curvature radiation, η 68) and the offer
to catch it from other systems: "yes please but regarding destruction of planet around it or
capturing BH evaporation flashes, consider rogue planets are no longer bound so should not get
destroyed OR any benefit from a BH/stellar remnant evaporation flash, so only Deep settlements
would benefit or be destroyed (or bound planets but by that point i don't know how likely THAT
is)". Asked how far the flash reaches: "By distance".

- **A neutron star's burst** destroys only what is in its Deep or on a world it still holds. A
  settlement on a world flung loose from it long before is far away by then, and stays; the
  crossing report says so. (Every settlement in its system was lost, rogue worlds too. By η 68
  most worlds are rogue: in the turn-121 test save 7 of our 9 settlements already were.)
- **Burst Catchers in other systems** bank a share of the flash: 250 each within 10 ly of the
  nearest burst, then less with the square of the distance (63 at 20 ly, 10 at 50), once each
  however many burst in reach; nothing on a rogue world, and nothing in a system cast out of the
  galaxy. It comes after the crossing's cost to saved energy (×0.6), and the report says how much.
- **A black hole's final burst** pays Burst Catchers in its Deep and on the worlds it held until
  then, 250 each as before, and no longer on worlds flung loose before. The Record says how much.
- **Texts:** "‹System› will burst" says our settlements there are safe when they are all on worlds
  flung loose, and is no longer a danger then; the Last Warmth's forecast, the Burst Catcher, the
  Manual and the Codex say who is lost and who catches the flash. The Codex states the bend: how
  much a catcher banks, and that the flash spares the systems around it, are the game's choice.
- **Check:** `unit/burst-reach`.
- **Balance.** 300 games: 154 survive, 72 victories, a Degenerate Age of 72 turns, all 300 as
  before. 900 games: 456 / 203 / 71, and 896 of 900 as before; the 4 that moved are curvature
  games with the same outcomes, three of them ending with more people (settlements on rogue worlds
  spared: 92 → 106, 174 → 195, 180 → 188) and one with fewer (78 → 74). By fate: decay 189 / 450,
  stable 168 / 239, curvature 99 / 211.

## Lighter on phones and tablets (13 Oct)

The player: "The game definitely needs performance optimization. Preferably something at no visual
cost. I know it's possible, because it worked better before." Asked what feels slower: "Everything
to the point that on my phone, when I had some things running in the background, even the audio
stuttered and had crackles. This does not happen on computers", on "Phone and Tablet".

- **What was measured** (an emulated phone, 390×844 at 3×, its CPU slowed 4×, seven builds from
  29 Sep to now, the same seed): nothing in the code grew heavier. Each frame's own work on the
  galaxy map stayed at 0.6 to 0.9 ms of script (0.2 ms of it the engine's frame), with 20 draw calls
  and about 97,000 points, and as little at turn 200 as at turn 40; an End Turn costs 40 to 50 ms
  of the main thread in every build. Only the system view's style work grew, 0.17 to about 0.4 ms
  a frame, with the phone interface (10 Oct). What weighs on a phone is what the game always asked
  of it.
- **Nothing runs unseen or unheard** (no change to what is seen or heard):
  - Under a recording, the synthesized score's drone (six sawtooth oscillators through filters
    swept by a low-frequency oscillator), its tape wobble and its hiss kept running at zero volume,
    every sample, since 7 Oct. Now they run only while the synth can be heard: started when it wakes,
    stopped once a recording has faded it out. On a busy phone that unheard work was the likeliest
    cause of the crackles.
  - The canvas is no longer multisampled. Every frame is drawn into the post chain's own buffers,
    and only its last full-screen pass reaches the canvas, where multisampling changed no pixel (the
    same frozen frame drawn to the multisampled canvas and to a plain buffer: 0 pixels differ, on
    the map and in a system) but cost memory and a resolve each frame.
  - On the galaxy map the labels are laid out again only when the camera, the state, the page or
    the interface's size changes; idle, they are left as they stand, exactly as a fresh layout would
    place them (their own work each frame 0.22 → 0.10 ms).
- **Phones and tablets, as the player chose** (each with a small cost, said when asked):
  - "No panel blur on touch": on a touchscreen the panels no longer blur the map behind them. They
    are 90% opaque, so the blur showed only in the last tenth: stars behind a panel there are sharp
    now instead of soft. Re-blurring the moving map under every panel each frame weighs on a phone's
    GPU. With a mouse the panels keep it.
  - "Touch devices start at Medium": graphics at medium on a touchscreen, 1.5 pixels to the point
    instead of 2 (about 44% fewer pixels drawn); bloom stays. Settings saved before at high move to
    medium once, unless the graphics are then picked by hand (`qualityChosen`); High is one tap away.
  - Offered and not taken: a 60 fps cap on 120 Hz screens.
- **Check:** `browser/lean`.
- No rules changed: the harness imports none of it (`tools/sim.ts` runs `src/game` alone).

## A backup of the game as it is, and the positronium bend (13 Oct)

The player, before the new version: "please backup the entire game as it is, because even though
yes we have Git, I may want an easy way to get to the older build even without it." And, from the
reading list: "yes add the positronium line to the codex pls".

- **A playable copy that never changes,** at https://m1omg.github.io/Steliterate/archive/2026-10-13/:
  the build of PR m1omg/Steliterate#27's merge commit `4aaaa2a` (`npm run build`, nothing changed;
  its script is the live one's, `index-B4EKBtSN.js`), committed as plain files under
  `public/archive/2026-10-13/`, which Vite copies into every build as they are. It keeps the
  storage keys of its time, so it opens the saves made on the main address: checked locally, a
  game autosaved at the root continues there at the same turn. Its source, without Git:
  https://github.com/m1omg/Steliterate/archive/4aaaa2a996b5d4bd62587931737858d76b7f8706.zip
  (`public/archive/README.md`). `.gitattributes` marks the copy generated and out of diffs;
  `.ignore` keeps its minified script out of searches.
- **Not done, and why:** the planned tag `snapshot-2026-10-13` and a GitHub Release with a zip of
  the build. This session's GitHub access refuses tags and releases (HTTP 403), so the commit's
  own zip stands in for the tag.
- **The Codex,** the Black Hole Age: the dates of positronium are for a universe whose expansion
  slows down; with dark energy like ours, the cosmological constant included, Chiba & Sugiyama
  (2004, arXiv:astro-ph/0405273) find that electrons and positrons drift apart faster than they
  can pair, so it may never form. The game lets it form: a bend. The paper is in the Sources.
- No rules changed.

## The purple oval: its source, and the galaxy's own light (15 Oct, the player's word)

The player, with a screenshot of the map: "why this weird purplish blob around most of the
playfield?", then "oh it doesnt dispay in firefox and its in orig version too, i get it was
supposed to be for ambient light likely? implement something but...prettier pls" and "pls do
track down the source". Built for the new version and brought here at the player's word ("Yes,
fix main too"), from a branch of its own.

- **The source:** the post chain's grade (`post.ts`) added a lift to every pixel, `(0.004,
  0.0035, 0.004)`, a little less green than red and blue. The renderer's neutral tone mapping
  takes the darkest channel of a dark colour off all three (a dark grey becomes black), so what
  was left of the lift was red and blue only: a dark magenta, and the vignette made it an oval
  over the middle of the screen (the empty sky read 2,0,3 in the middle and 1,0,2 at the edge;
  without the lift 0,0,1 everywhere). It had been there since the first rendering (28 Sep), in the
  galaxy and in every system; Firefox likely loses the small difference between the channels on
  its way to the screen (not checked here).
- **Gone:** no lift. The empty sky is black, in the galaxy and in a system.
- **The galaxy's own light:** the glow of its billions of red dwarfs too faint to be seen one by
  one, warm, lying where its stars are: the shared envelope and its brighter middle, each
  ancestral galaxy's remnant, the streams as faint arcs, the globular clusters; flattened as the
  stars are, flatter as the view tilts toward edge-on. Seen from close by, among the stars, there
  is no glow: it fades in as the view draws back. It dims as the stars go out, as the stars drawn
  above it do, in their tint, and is gone in the Dark. A few dozen soft sprites (`galaxyView.ts`,
  `buildGlows`), made from the world's own layout without a random draw.
- **Check:** `browser/sky`.

## Sound that does not stutter (15 Oct, the player's word)

The player heard the sound crackle: "Irregular pops or stutter", in the new version's films and
outside them, worst in Firefox. Built for the new version and brought here at the player's word
("Yes, fix main too"), from a branch of its own.

- **The music played by the audio element itself.** The recordings went through the sound's
  graph (a `MediaElementSource`). Their samples crossed into it on the sound's own thread,
  resampled, and gave out when the browser was busy; this is known to be worst in Firefox. Now the
  element plays them through the browser's media pipeline, with buffers and decoding threads of
  its own (`src/audio/trackOut.ts`). Its loudness is its volume: the piece's level, fading in and
  out on a timer, times the music's volume (the slider, on the same curve), times the master's
  gain, so they play about as loud as before. The master's compressor no longer touches them
  (they are mastered already). Where a page cannot set an element's volume (iOS Safari reads it
  back as 1), the graph's route stays. The synthesized score stays in the graph, as before.
- **A lighter reverb.** The room's impulse was 5.5 s of stereo noise that every interface sound
  with an echo fed, heavy work for the sound's thread. It is now 3 s, with the same decay; past
  3 s the tail was 22 dB down and more, and it now fades out over its last fifth of a second.
  The interface's sounds share one way into it, made once, instead of two new nodes for every
  sound.
- **The stutter itself was not measured:** a sound card's buffer running dry cannot be heard or
  counted in this container, and there is no Firefox here. What was measured is the work taken
  off the sound's thread.
- **Check:** `browser/music-route` (new): the recording plays by its element, and no sound makes
  a `MediaElementSource`; its volume follows the music's slider (70%, 35%, 0); ten sounds with an
  echo make only their tones' own nodes.

## The project check: the synth's echo, and the glow in every view (15 Oct, the player's word)

The player asked for a comprehensive check of the whole project ("please, do a comprehensive
project check to compensate"). Today's two batches here (the purple oval and the sound) were read
again from their code; three faults were found and confirmed, and are fixed here as in the new
version. No rule changed: 300 standard competent games play out game for game as before, all 300
(154 / 72 / 72).

- **The synth's echo went into the reverb at full whatever the music's slider.** It now follows
  the slider, as loud as before at 70% (the default), so the mix is the same at every volume.
  Only heard where the synth plays: chosen in Settings, or where a recording fails or is slow to
  start.
- **The galaxy's own light showed in the Dark in the enhanced and thermal views** (the magnifier
  mode uses the enhanced one): a lavender haze at those views' floor for the stars drawn, and
  fifteen times its natural level in the Black Hole Age. It follows the natural light in every
  view now.
- The graph's route for a recording (iOS) left its element's source connected when done.
- **Checks:** `browser/music-route`: the synth's echo follows the slider (0, 35%, 70%).
  `browser/sky`: no glow in the Dark in the enhanced and thermal views (it fails on the build
  before the fix: 37 and 33 glows).
- **Validated:** tsc and the build clean; the playtest passes; savecompat on the 6 saves; all 49
  unit checks; all 53 browser checks (in the game's real fonts). The checks' `audio()` hook
  (the sound's graph) is new here, for `browser/music-route`.

## The game keeps its word (19 Oct, the player's word)

A full specification of this game (`docs/REPLICATE.md`, on the new version's branch) noted every
place where the game's text promised one thing and its code did another, and a few rules no text
told of. The player: "what are those things? In regular version or /next?" All were in both.
Asked, they chose to fix them in both, the code made to keep each promise ("Code matches the
text"); worlds to fall into brown dwarfs and black holes as physics says, in new games ("Yes, new
games only"); the ship discount's missing charter made ("Make the charter"); for the unwritten
rules, "Fix the bugs, document the rest"; and one step of a hidden storyline that could not be
reached made reachable, without being told how.

- **The Long Record gives +1 Accord at each settlement**, as its description has said since the
  first version (it gave 0.5, then 0.25 from 4 Oct, when every source of Accord was halved). Its
  own line in the settlement's yields.
- **Hunger Studies reveals swarms within detection range and forecasts their paths**, as it says
  (it did neither: it only opened two dark charters and Decoy Beacons).
  - What we see, in every game: an awake swarm at a star we know, as ever; one under way only
    within the range our eyes chart stars at (settlements, Shared Watch stars, ships stopped).
    Until now every swarm under way showed, anywhere in the galaxy.
  - With Hunger Studies a sleeping swarm in range shows too: faint and slow on the map, "asleep"
    in its star's panel, a "nest asleep" chip on settling sites. Each swarm we see under way has
    its way drawn to where it is going, its panel says where and when it arrives (at 0.05 c in
    the Dusk, 0.5 c after), and the forecast of one coming for us has its date. Without it the
    forecast still warns, undated, of a swarm we see coming for us.
- **The Communion Charter: swarms merge into our Lattice instead of attacking us.** A swarm that
  comes to a settlement of ours under it, or sits at one when it is enacted, merges in as an
  absorbed swarm does, with no taming (Lattice as its size over 1.5, a Lattice Foundry), and
  Taint +8; the first swarm lets a ship under it be. (They already spared our ships and
  settlements; they never merged.)
- **Harsh: crueller crossings.** Each crossing takes a quarter more at Harsh: the Last Light's
  Kin, Echoes and Lattice, the Last Warmth's Kin beyond room, the Great Decay's Lattice and the
  minds the protocols carry over, the Last Horizon's Continuity and energy. The protocols still
  halve it.
- **Worlds fall into brown dwarfs and black holes too, in new games.** Gravitational waves drain
  every orbit, whatever it circles; the game had only dead stars of ordinary matter take their
  worlds in, a bend.
  - A new game carries a flag (set without a draw: every seed makes the same galaxy). In it a
    brown dwarf's world reaches the dwarf's tidal limit on the date its orbit's decay gives with
    the dwarf's true mass (about 10^16 to 10^20 years for its close, small worlds, in the
    Degenerate Age), is torn apart outside it (the Roche limit, some 0.003 AU) and rains onto it:
    a warmth a 120th of a white dwarf's (GM/R), over 10^14.8 years. A black hole's world (2 to 20
    AU; about 10^22 to 10^27 years) is torn apart far outside the horizon and gone within the
    turn ("one flash, then nothing"). A settlement on either gets off to the Deep, three in four,
    as from any world that falls in; the forecast warns ahead, a place lasts until then, and the
    Codex says so.
  - Saved games keep the bend: there such worlds never fall. The forecast no longer warns in them
    that one will (it did, after the Dusk, and nothing came), nor of a world around a star still
    burning (a collision star's falls when it dies).
- **Rules no text told of:**
  - a met demand lifts a Thread toward 80, and no longer pulls one above it down to 80;
  - a grown point is paid for only when it becomes a person (it was paid for and lost where
    there was no room);
  - what spare work makes counts in the coming turn's figures and in the energy net the turn
    reports (it went into the stores unreported);
  - once matter is gone, its upkeep is paid in energy, 1.5 a unit, as building is (a Lattice wore
    out each turn for want of it; the new version has done so since its part 3);
  - written into the Manual: starvation strikes three settlements a turn at most, those with the
    deepest deficit; without Merge Consent merges can repeat within a turn.
- **The Expansion Mandate**, a charter the code named (ships 20% less industry) and the book never
  had: Fusion Drives, 20 Accord, Kin +6, Coldminds −6, resolve +2. The autoplayer does not take
  it.
- **Small things:** the energy reading's low-reserve edge (energy under 15% of the reserve and
  falling) has its style, an amber edge; two tech flags nothing read are gone; the sleeper vault
  of a white dwarf with no worlds, in its Deep, reads "In orbit around …".
- **A hidden storyline:** one of its steps could not be reached as coded, since the first
  version; now it can (docs/spoilers). Its painting, unused since the first plates, is on its card.
- **Left as they are:** choosing the fate of matter at setup skips one draw, so the Hunger's nests
  of a seed differ from its "Unknown" game (changing it would move them in every such seed);
  the unused `holdElements`; one way of life's clock drift, which comes to the same formula
  either way.
- **Checks:** `unit/promises` (the Long Record's accord; what is seen of the swarms, with and
  without Hunger Studies, and the dated forecast; a swarm merging under Communion; Harsh's
  crossings), `unit/fall-in` (a brown dwarf's world at its date, a black hole's within the turn
  and its settlement evacuated, the old rule in old saves), `unit/unwritten` (standings, growth,
  spare work in the figures, the Expansion Mandate), `unit/slow-ones`, `browser/hunger-sight`
  (the ways drawn and the "asleep" marks with the tech). `unit/late-sky` and `unit/evap` check both
  fall-in rules, and `unit/evap` takes the first of a few seeds the autoplayer brings to the Black
  Hole Age, as the rules move which one does.
- **Balance:** 160 of 300 survive (154 before), 81 victories (72), a Degenerate Age of 72 turns;
  900 games 476 / 244 / 71 (456 / 203 / 71). By fate: decay 193 / 450 (189), stable 165 / 239
  (168), curvature 118 / 211 (99). At Harsh, 300 games: 147 / 62 / 68 (140 / 52 / 70). Survival
  is within the noise. The victories come from the hidden storyline's step alone: without it the
  same 300 games give 160 / 72 / 72, victories as before (details in `docs/spoilers`).
- **Validated:** tsc and the build clean; the playtest passes; savecompat on the 6 saves; all 53
  unit checks; all 54 browser checks (in the game's real fonts).

## Falling worlds: rubble, flashes, shelters, and more worlds at black holes (20 Oct, the player's word)

The player, 19 Oct: "make the black hole flashes harvestable"; a world falling into its star
"should then break up into asteroids and eventually be… accreted"; "even something that seems
like it's just a few years… can also be very energetic… So it should present an opportunity for
the civilization." And on what a giant's flash would do: "please calculate the effects because
I'm pretty sure that this would destroy the planets around the objects", with "molten planets
still stay molten" and "perhaps some measures may need to be taken to shelter from the big
injection of energy". From the list of 16 Oct: "Please, add more black hole planets and find a
way to quantify black hole accretion disk brightness." In both versions, new games only, as the
player answered (the plan is on the new version's branch,
`docs/plans/2026-10-19-falling-worlds-and-the-list.md`, part B).

- **A world of rock or ice breaks up.** At its dead star's or brown dwarf's tidal limit it
  becomes a ring of rubble (as the fragments around WD 1145+017 are today): an asteroid belt,
  drawn as one, named as it was, its core laid open (richness ×2), thinning as it rains in
  (1/(1 + t/τ) of it left: half at t = τ). It feeds its star exactly as before (the same draws,
  the same warmth for Disk Skimmers), and at 30τ the last of it falls in. Its panel calls it a
  rubble ring.
- **A World Falls** tells of the rubble. A third choice, **Take them apart**, is offered only to a
  civilization far down the Hunger's path, at Taint 60 and more (where the others will no longer
  bind themselves to it): its people are not taken off; Matter +5 for each, Lattice +1 for every
  3 at the capital (as it has room), Taint +8, Resolve −6, Kin standing −10. Not for the capital.
  (A choice can now be not offered at all, rather than greyed: the story screen leaves it out,
  the turn refuses it, the autoplayer skips it.)
- **A rocky world torn apart by a black hole** feeds the hole within the turn, a tenth of its
  mass-energy (5 × 10^40 J for an Earth), far too faintly to harm anything; Burst Catchers bank
  it: 250 each in its own system and out to about 2 light-years, less with the square of the
  distance beyond (`flashReach`: 10 ly × √(E / 10^42 J), a neutron star's burst being the
  yardstick).
- **A giant falls in a flash.** Its gas pours onto the star at the star's limit, the Eddington
  luminosity (32,000 Suns for each Sun of mass), until it is gone: a Jupiter onto a 0.6-Sun white
  dwarf 1.7 × 10^40 J, 19,000 Suns for 75 years; into a 10-Sun hole 1.7 × 10^43 J, 320,000 Suns
  for 4,400 years.
  - Worlds where a tenth of the energy they take in could drive off their whole mass boil away
    (an Earth within 1.9 AU of that hole's flash, 0.06 AU of the white dwarf's; rubble anywhere
    inside the melt line). The rest inside the melt line (where the ground passes 1,500 K under
    the flash, as `boilsUnder` judges a new star's light: about 4 AU at the white dwarf, 16 at
    the hole) melt: their air and seas boil off (a water-rich world's rain back), nothing lives on
    them after, and they freeze again as bare rock ("Flash-melted").
  - Settlements inside the melt line live only if sheltered. A tidally locked world shades its own
    night side: a **Flash Shelter** (50 industry, 20 matter; Deep Warrens or Night-side Shelters
    do as well). A turning world, a giant's clouds, a belt or the Deep: a **Shadow Shield** (140,
    70), a hollowed rock between it and the star, which also spares the world it stands over.
    Nothing on a world the flash boils away lives. One per settlement, no upkeep, only in such a
    game. They come from the Dusk, the Flash Shelter with the Deep Warrens research, the Shadow
    Shield with Orbital Industry: the plan had them with Burst Capture, in the Degenerate Age, but
    a white dwarf's close giant can fall in before the Last Light, when that cannot be researched
    yet. The giant's own settlement gets off to the Deep, three in four, into the flash.
  - Beyond the melt line nothing is harmed. Burst Catchers bank the flash: 250 each in its system,
    others out to its reach (a white dwarf's Jupiter about 1.3 ly, a hole's 41).
  - The forecast warns ahead: the date, how far out the ground melts, and what each settlement of
    ours there needs (with the research it comes with, if not yet done). A giant's flash pings
    the map.
- **More worlds at black holes.** In a new galaxy two holes in three get one to three more
  worlds, after everything else is generated, each hole from a draw of its own: every seed's
  galaxy is as it was with these added (10 seeds compared, 0 differences). Two in three close in
  (0.05 to 1 AU, as the pulsar PSR B1257+12's), the rest at 1 to 40 AU, widened by √(M/10) around
  a heavier hole; rock and ice, now and then a super-Earth (frozen from the start), a giant in
  four. With the world in three holes had before, about three holes in four have worlds. The
  Heart gets none (its crowded core flings worlds loose, and it would swallow one whole), the
  Wanderer keeps its own. A hole's worlds are drawn out by distance.
- **Disk luminosity**: a black hole's panel gives its disk's light in Suns, from what its
  collectors gather (a stellar hole about 6 × 10^-5 L☉ in the Dusk, 2 × 10^-13 after).
- **Texts:** the Codex on how a world comes apart, what a flash does, what lights a disk, and the
  bend: a neutron star's slow stream warms it only as a white dwarf's would (physics gives some
  1,700 times more). The Manual; the descriptions of the Deep Warrens research and Orbital
  Industry in such a game; the falling row of a world's panel says what becomes of it.
- **Checks:** `unit/falling-flash` (rubble, half at t = τ; a hole's rocky flash banked by
  distance; a giant's flash at a white dwarf: the boiled, the melted, every shelter and its lack,
  the Deep, the catchers near and far; a hole's giant's figures; the dark choice only at Taint
  60; the shelters' build rules; an older save keeps today's rule), `unit/hole-worlds` (two holes
  in three, one to three each, two in three close, a giant in four, generated last, named on,
  drawn by distance, the old world's sunlight kept, none at the Heart or the Wanderer, none in an
  older save), `browser/rubble` (a world torn apart is drawn as a belt; its panel; a hole's Disk
  luminosity). `unit/outer` lets the hole worlds come last; `unit/dealings` keeps the raiders'
  clock in step, as the check's first game now plays out differently.
- **Balance:** 149 of 300 survive (160 before), 80 victories (81), a Degenerate Age of 72 turns
  (72). The new worlds re-roll every game from its first turn (0 of 300 the same): within the
  noise. In the new version a control run (the same new worlds, the old falls) puts what the
  rules cost an autoplayer that builds no shelters at about 10 games in 300 at standard, and
  nothing at Harsh. By fate: decay 57 / 148, stable 51 / 81, curvature 41 / 71. At Harsh, 300
  games: 154 / 58 / 68 (147 / 62 / 68 before). The shelters were moved to Dusk research after the
  run; 12 games replayed after it: all the same (the autoplayer does not build them).
- **Validated:** tsc and the build clean; the playtest passes; savecompat on the 6 saves; all 55
  unit checks; all 55 browser checks, in the game's real fonts (`browser/rubble` counts the belt's
  rocks: this game has no survey reveal to keep the count for it).

## Finds where they can be, and one sea for the text and the picture (20 Oct, both versions)

From the player's list of 16 Oct, items 7, 1 and 6: "I think I got a sub-ice geothermally driven
life event...about a planetless system, once, unsure."; "Should show open terminator seas."; and
"„All frozen“ water and cold but with visible seas?" The plan of 19 Oct (part C) had the causes.
Both versions, the same code.

- **Life Under the Ice only under real ice.** Every ice-shelled ocean is made with a buried ocean,
  the starless Drifts' too, and the find asked no more: in forty galaxies it fitted 178 worlds in
  Drifts whose Water row says "frozen through" at a few kelvin (seed 7's Drift 5167 II among
  them). It now asks for a buried ocean the Water row calls liquid (`buriedOcean`: around a star,
  not in a Drift, not on a world flung loose, not frozen through), on a world not falling into its
  star: none in the Drifts, 794 worlds around stars as before.
- **A find about a world that changed is dropped.** The survey finds things as ships arrive,
  before the universe moves on in that same turn, which can tear the world apart, swallow it,
  fling it loose or boil it, and a waiting find was never looked at again. Now, once the universe
  has moved, a waiting find whose world no longer fits it is dropped: the world loses its mark,
  and the find can still be made elsewhere. The survey offers nothing about a world already
  falling into its star. Worlds flung loose stay among its candidates (the plan left them out, but
  Warm in the Dark is found only on them).
- **Kept Warm by Its Neighbours** counted the Deep as a neighbour, so three worlds drifting in a
  Drift would do (181 in forty galaxies). It counts the worlds bound to a star: none in the
  Drifts, and a world needs three real neighbours (2,704 worlds still fit; 1,469 with only two no
  longer do).
- **One sea for the Water row and the picture.** The picture drew seas by rules of its own: an
  eyeball's by a ramp from 150 to 240 K and by its vitality, an ice world's from 263 K, a
  super-Earth's never. So a world the row called all frozen showed open seas (item 6: an eyeball
  at 95 to 224 K around a star just dead), and a hot locked super-Earth whose row read "open water
  along the terminator" was bare rock (item 1). Now one band, `seaBand`, gives both:
  - Under its star a locked world's ground is at its day side's figure, its warmest; away from it,
    as warm as the starlight falling there keeps it, T_day·f^¼, f the sine of the star's height
    (local radiative balance), and never colder than its night side. Water is liquid from 273 to
    373 K: ice where colder, boiled off where hotter.
  - The Water row reads it as before, and says when a sea under the star covers less than half of
    the day side: "a small open sea under its star, ice all round it" (240 of the 446 such seas in
    twenty galaxies). Our homeworld reads as it did: its sea reaches out to where its star stands
    20° up.
  - The picture draws it: open sea where liquid (in the low ground, as far as the water reaches,
    on a super-Earth and on rock given an atmosphere too), ice where colder, a pale crust of salt
    where boiled. Life colours the land only: a world that has died keeps its sea while it is warm,
    its land grey. A veil of steam only where all of a world's water has boiled (thinner the less
    there was); where part of the world is cooler, the water has gone there, and the hot ground
    lies bare. A world with air is lit a little past its terminator, so the seas of its twilight
    are not black. The thermal view and the lava follow the same profile.
  - The worlds of the two pictures: the super-Earth at 178 to 480 K shows ice on its night side,
    open sea where its star stands 6° to 21° up and salt flats beyond; the eyeball at 95 to 224 K
    is all ice. A hot eyeball (an ice world at 150 to 420 K) shows its ring of sea round a bare,
    boiled day side, no longer under steam.
  - Where it bends physics: a world's air and seas carry heat from under its star toward the
    terminator and flatten that profile; the game takes the day side's figure as the warmest
    ground and lets the starlight alone shape the rest.
- **Checks:** `unit/finds` (each wrong path: the Drifts, a world flung loose, one falling, the
  survey, a find whose world changed, and the same in a whole turn; on the code before it fails 12
  of its 14 steps, the other two being the controls), `unit/seas` (over 8,878 climates the band is
  where the ground is 273 to 373 K, its edges where it crosses them, and the row names it; the
  pictures' two worlds; the homeworld; every world with water in twenty galaxies). `unit/fates`
  now plays the next seed when the autoplayer's game ends before the moment it checks, or crosses
  it in a turn too long to show it, as the new version's does: its seed-1000 games now end early.
- **Balance** (300 standard competent games: survive / victories / Degenerate Age turns): 165 / 77
  / 70 (149 / 80 / 72 before). The finds' tests change which find a survey turns up, and so nearly
  every game from its first finds on (36 of 300 play out as before); at Harsh 150 / 59 / 71 (154 /
  58 / 68 before; 43 the same). Within the noise. By fate: decay 67 / 148, stable 63 / 81,
  curvature 35 / 71.
- **Validated:** tsc and the build clean; the playtest passes; savecompat on the 6 saves; all 57
  unit checks; all 55 browser checks in the real fonts (`a11y` failed once with two suites running
  at once and passes alone). `browser/fates` now plays the harness's seeds in turn for every fate,
  as the new version's does, and takes up to twenty turns at the Tide to reach a crossing.


## The pace: ten turns to a Tide turn (20 Oct, the player's word)

From the player's list of 16 Oct, items 3 to 5: "Quick 10x is not Quick 10x here:" (two
screenshots of a flare clock, where Quick ×10's turn was a fifth shorter than the Tide's and paid
as much), "Worlds die in same amount of turns regardless of pace.", and "If a given pace becomes
unavailable the UI still stays with that pace highlighted instead of switching to the next possible
one." The plan of 19 Oct (part C) had the causes, and the player chose "Ten per Tide turn". Built
so, it showed what the plan had not: one Slow ×100 turn could cross the whole Dark Era, and the
victories had leaned on the old slow turns' overpay. Asked, the player chose "Dark keeps its
clock" ("one slow x 100 turn should not cross the entire dark era") and, for the victories, "Bring
them back". The new version got the same, with a smaller late yield (×1.125).

- **One rule: a turn's share is the Tide turns of time it covers.**
  - The Tide's turn is 1, Quick ×10's exactly 0.1, Slow ×10's exactly 10 (`stepTime`,
    `tideTurnsAt`, `paceShare`). Each Tide turn is g times the one before (1.27 in the Dusk, 2.82
    in the Degenerate Age, 12.6 in the Black Hole Age), so a Quick ×10 turn splits the Tide's
    ladder in ten, `Tide × (g^0.1 − 1)/(g − 1)` (0.09 of the Tide's length in the Dusk, 0.06 in
    the Degenerate Age, 0.025 in the Black Hole Age), ten of them one Tide turn in years; and a
    Slow ×10 turn is ten Tide turns (in the Degenerate Age some 17,500 times the current one).
  - Until now a Quick turn was a tenth of the Tide at its date and a Slow one ten times, so the
    paces were never ten to one over any stretch: over the Degenerate Age Quick ×10 gave 6.1 times
    the turns, and Slow ×10 paid 10 for a turn covering 2.9 Tide turns of time (Slow ×100 paid 100
    for 5, Slow ×1000 1,000 for 7).
  - Over a whole age the shares add up to the Tide turns it holds, at every pace: 104.3 in the
    Dusk (105 turns at the Tide, 1,044 at Quick ×10, 15 at Slow ×10), 67.2 in the Degenerate Age
    when protons decay, 56.1 in the Black Hole Age, 37.7 in the Dark Era.
- **The Dark Era keeps its own clock** (the player's word). There a pace only halves or doubles
  the turn, as it always did, so the dark takes 76 turns at Quick, 38 at the Tide, 19 at Slow; but
  a turn now pays and costs the half or the two Tide turns it covers, where Slow ×10 paid ten and
  Slow ×100 a hundred (item 3's mismatch in the dark). Continuity is lost a turn at a time, as
  before.
- **No slow turn ends an age** (the player's word). On the ladder Slow ×100 is a hundred Tide
  turns, more than any age after the Dusk holds, so one turn could have ended it. A slow pace whose
  turn would reach the end of the age is now greyed out, and our turn is lived at the nearest pace
  toward the Tide that would not: Slow ×100 at most early in the Dusk, Slow ×10 until ten Tide
  turns are left. The forecasts count the turns the same way.
- **No turn runs past the end of its age** (the Dusk at η 14, the Degenerate Age where its fate
  ends it, the Black Hole Age at η 100, the Dark Era where its ruler reads 122), the calendar's
  turn at η 39 under a fate other than decay, or the Great Evaporation: it stops there, paid for
  the Tide turns it covered. So the Tide's own last turn of an age is a short one now.
- **Clocks and flares pay for the time they cover.** A flare's clock keeps its own sixths whatever
  the pace, each paying and costing the Tide turns it covers (a quicker pace cut them shorter,
  "turn n of 6" came round again, and each was paid as a whole Tide turn: the player's
  screenshots). So does a turn cut short as one of our stars begins its last flare (it paid 0.1
  with Quick ×10 chosen, 1 at the Tide). A new star's clock stays as it was, each turn lived in
  full, or a tenth of one when Quickening splits it: that clock is bought.
- **Upkeep:** a turn at our pace costs its machines and sleepers a whole Tide turn at least, and a slower one as much more as it is longer, as before;
  a turn a clock, a flare or the age's end sets costs the Tide turns it covers, as it pays.
- **The worlds wear by time (item 4).** Decline, freezing, core heat (the homeworld's in the Dusk,
  every world's after), seeded life, a swarm's bite, its rust and the rust's fading, the galaxy's
  free energy it drains, and what a tamed swarm brings (and its Taint under Communion) are each
  taken by the turn's share. So a world dies in ten times the turns at Quick ×10, in the same
  years; until now in the same turns at any pace. The Dusk wears worlds faster by its Tide turns,
  not its turns (at Quick ×10 that counted ten times as fast), and the freezing forecast counts
  turns at our pace.
- **The pace lit is the one the turn is lived at (item 5).** While ours is greyed (a clock, a
  flare or the end of the age sets the turn, or a slow turn would reach the end of the age) the
  nearest pace toward the Tide that is not is lit, and the turn is lived at it; ours keeps a dashed
  outline and is lit again by itself when it can, and the phone's pace button names the one in
  use. Every greyed pace says why. "Sleep deeper" no longer slows past what research allows.
- **The late ages richer** (the player: "Bring them back"). The autoplayer's victories had leaned on
  the old slow turns' overpay: in trouble it took the pace that paid most a turn, the slowest. With
  honest turns it won 49 of 300 at ×1.2 (77 before); and in the new version, where 62 games no
  longer won, it had the Slow Ones’ trust, but most lacked the 300 energy that begins the Aeon Seed,
  a settlement at the Heart, or Conformal Mathematics in time. So after the Last Light every source
  gives two fifths more energy and matter (`LATE_YIELD` 1.4: structures and the Hearth, and where to
  settle counts it), at every pace. Tuned on the harness: ×1.2 gave 49 victories of 300, ×1.6 105,
  and ×1.4 73 with the autoplayer's sleep below. The new version, which leaned on the overpay less,
  takes an eighth more (×1.125). A player at the Tide never had the overpay, so for one the late
  ages are now that much richer than before.
- **The autoplayer sleeps through the dark.** A Slow ×100 turn in the dark had paid a hundred
  Tide turns' trickle (in seed 8919, 51 energy a turn from Halo Siphons giving 0.5), so the
  autoplayer never needed to sleep; on honest turns it faded: at ×1.2, 104 of 300 games faded,
  where 38 had (8 now). Now, where the reserve would not last the age and no Great Work would be done
  first, it takes the Long Sleep (a tenth of the upkeep, about a third of the Continuity lost)
  (`planDarkSleep`, as the new version did only with matter stable once all of it was iron, now
  under every fate there too). An autoplayer change, not a rule: the Long Sleep was always there
  for a player, and slept through, the dark costs a reserve a tenth as much.
- **Texts:** the pace tips ("10 turns for each turn at the Tide … each gathers and wears the worlds
  10× less, but its machines and sleepers still cost a whole turn’s upkeep"; in the Dark Era "a turn
  can only be halved … doubled"), the Manual's pace and flare paragraphs and the late yield in its
  Income paragraph, the flare chips, and every "a turn" of decline, freezing, seeded life, core heat
  and rust that means a Tide turn now says so.
- **The autoplayer.** In trouble it now weighs only the paces open, by what each nets for the Tide
  turns it covers, and goes no slower than the Tide before the Dark Era: a slow turn now covers ten Tide turns with one turn's
  research and industry, and the first harness run of the batch, before this, had 139 of 300
  surviving and not one victory.
- **Checks:** `unit/ladder` (the ladder in every age and length; the Dark Era's own clock; shares
  and their upkeep; every age's shares adding up to its Tide turns at five paces, no slow turn
  ending one; the stops and the greyed paces at the end of each age, the calendar's turn and the
  Great Evaporation; the Tide's last turn; the forecasts' turns; the flare clock and the flare stop;
  the declines, the Dusk's acceleration, the Hunger; the dark's 76, 38 and 19 turns with Continuity
  a turn at a time; the late yield, and where to settle counting it; the autoplayer's Long Sleep in
  the dark under each fate, and none with a reserve that lasts; Sleep deeper); `browser/pace-grey`
  (the lit pace, the dashed outline, ours coming back, and Slow ×100 greyed where its turn would end
  the age, the check now setting the fate of matter so that it knows). Updated: `unit/pace` (a flare
  clock now `--o--`; in the Degenerate Age Slow ×100 greyed, `oooo-`), `unit/clocks` (Slow ×10's
  first turn is 10^3.17 years), `unit/follow` (the follow-on star sized by our own turn),
  `unit/terraform` (seeded life at Quick ×10, 200 turns to 80%), `browser/terraform` (its tip now
  "+4% a turn at the Tide"). `unit/fates`, `unit/boil`, `unit/cooling` and `unit/flow` failed while
  the autoplayer's slow turns could skip whole ages, and pass with its new pace.
- **Balance** (300 standard competent games): 229 of 300 survive, 73 victories, a Degenerate Age
  of 112 turns (165 / 77 / 70 before); by fate decay 87 / 148 (2 victories), stable 79 / 81 (51),
  curvature 63 / 71 (20), where 67, 63 and 35 survived, with 7, 40 and 30 victories; Harsh 209 /
  63 / 106 (150 / 59 / 71). The Fade ends 8 games (38 before), The Will Fails 4 (31): survival
  rose with the autoplayer's sleep in the dark, and with the richer late ages. Without the sleep,
  ×1.2 gave 93 / 49 / 110 and ×1.6 141 / 105 / 119. The Degenerate Age is longer in turns because
  the autoplayer no longer takes slow turns in trouble there: it lives the age at the Tide (67
  Tide turns of time where protons decay, 47 where matter is stable, 131 where space unmakes it)
  and keeps time with new stars; a player at the Tide lives the same turns as before.

## The survey reveal, a flight of the camera (21 Oct, the player's word)

The player, 21 Oct, with a clip of Endless Space 2 showing a newly explored system world by world
("this is how i imagine the reveal planetary system sequence"), first for the new version at
`/next/`; then, asked whether they wanted it here too: "yes". Today's game had no survey reveal
until now (the new version's had come with its films, 14 Oct): looking into a system just charted
showed its worlds at once. Display only: no rule changed, and nothing saved changes.

- **The flight** (`SystemView.startReveal`, `REVEAL`): looking into a system our ships have just
  charted, by any way in (the survey's Look, the map, a list), once each: a look at the star while
  a ring of light goes out from it (1.5 s); a flight down to the first world (1.35 s), then from
  world to world (1 s, 0.8 s with more than six), dust streaking past; and a while at each (10 s
  shared among them, 1.6 to 2.3 s each, 1.1 s more where the survey found something). There the
  world is close and three parts lit, its star off to the left, as big on the screen as it is big,
  beside the caption (low in the middle on a phone held upright; in the middle of what the
  magnifier mode's column leaves), the camera turning and closing in a little while a line of
  light sweeps it from a silhouette to its look. At the last world, where the star shines, the
  camera comes round its night side until the star rises over its right edge (1.8 s more; where a
  belt or the Deep is outermost, the outermost world comes last). Then back out to the whole
  system (1.7 s), its orbits drawn in from the star outward, the worlds' names back. The Deep is
  the star with its ring, from above; a belt a stretch of its ring with the star beyond (its rocks
  are drawn unlit: specks, not to be seen close up). About 12 s for two worlds, 19 for four, 25
  for eight. The world the view was entered for (a living world's Look) comes first, and the flight
  ends on it.
- **Grounded, and where it bends:** each world is lit as it would be by its star (the sunrise from
  its night side is how it would look). The dust streaking past is for the sense of speed: real
  interplanetary dust is far too thin to see. The camera crosses a system in a second; it is a
  camera, not a ship.
- **The same at any frame rate:** where the camera is comes from the time into the reveal and the
  worlds' places alone (`cinePose`), and the rig is put exactly there every frame
  (`OrbitRig.setPose`). A flight goes round the star, never through it, and midway keeps out of
  its glare. The dust is motes fixed in space, each drawn back along the camera's way between two
  poses a thirtieth of a second apart.
- **The caption** (`RevealCard.tsx`): top left over the view, like a film's titles, the rest of the
  interface stepping aside until the flight is over (in the magnifier mode it stays, and the
  caption has its place in the column, with the prompts). At the star its name, its kind and how
  many worlds; at each world its name, then its kind, how it is to live on (room for Kin, or
  domes), its temperature, its water and what the survey found there, typed in line by line, then
  four bars filling for what each kind of settler would make of it (Livable, Power, Matter,
  Lasting, the lists' measures: Power and Matter against the best world charted, Lasting against
  the universe's age now), and a find's picture; on the way out how many were charted. A whoosh for
  each flight and for the way out, two soft tones as a world is charted.
- **Controls:** Next (the caption's button, Space, or a click or tap on the view) goes on to the
  next world (in a flight, the world it flies to is left as soon as it is scanned). Skip, Enter or
  Escape shows every world at once, the camera flying back out to the whole system (or to the
  world the view was entered for), and neither key ends the turn underneath it; Skip all, the other
  systems just charted too. A drag, a pinch or the wheel takes the camera from it where it is;
  picking a world from a list goes to it. Settings: Survey reveals on or off (off to begin with
  where the system asks for less motion). The Manual's survey paragraph and its keys.
- **A backlit world's air** (`PLANET_FRAG`): seen from its night side with its star behind it, a
  world with air shows a bright ring round its edge, its air scattering the light forward (as
  Titan's and Pluto's hazes did, seen from behind by Cassini and New Horizons); none on airless
  rock. It shows in the sunrise, and wherever the view is turned toward the star past a world.
- **Checks:** `?noreveals` turns the reveals off for a page; the checks open the game with it
  unless they ask for reveals (`start(name, { reveals: true })`), and so does the playtest
  (`last-star`, `lowvision`, `siphons` and `zoom-centre` open pages of their own and add it). New
  `browser/survey-reveal`: Look plays it, the worlds and their names wait, the camera is the
  reveal's and the interface steps aside; the camera close to the world being charted, its caption
  and four bars; Space and a click go on; Enter skips, ending no turn, the interface back; at 30
  and at 144 frames a second the same 2 s and 6 s in, the camera's place too; Escape, Skip all,
  reveals off; a drag takes the camera where it is; in the magnifier mode the caption in the
  column and the interface staying.
- **A check made sure of what it measures** (the new version's of 14 Oct, brought here):
  `browser/a11y` gave a window a fixed 400 ms to give focus back to the button that opened it; focus
  comes back a frame after it closes, and a frame drawn in software here can take over half a
  second, so it failed on `main` as it stood (and with this batch). It now waits for the focus,
  three seconds at most.
- **Validated:** tsc and the build clean (`index-Zc5orquV.js`); the playtest passes (30/144 Hz
  parity 2e-15); savecompat on its 6 saves; all 58 unit checks; all 56 browser checks in the real
  fonts (`survey-reveal` new; `a11y` with the wait above).

## Four fixes from the player's screenshots, and a rush that finishes at once (24 Oct, both versions)

The player sent three screenshots named for what was wrong ("why is my warship yellow?", "the
planet exploration popup occurs while it's showing all the planets", "The world looks barren, but
it says two without domes even though its max temperature is less than freezing"), then a fourth
("Why is there even an option to rush a building which will complete in one turn?"), and asked
for all of it "to apply to existing saves without breaking them". It does: nothing saved changes
shape, so every change is in saved games the moment they load.

- **Our ships in our own teal** (`galaxyView.ts`, `systemView.ts`): on the galaxy map and in a
  system's view every ship of ours is drawn in the teal our systems are marked in, whatever its
  kind; what kind it is shows in its hull. Warships had an amber rim and an amber drive (settlers
  teal, the rest pale blue), and amber is a neighbour's colour (the Vaelun Hold's). The player:
  "All ours in our teal".
- **A find's card waits for the flight** (`Story.tsx`, the reveal signal now in `store.ts`): while
  a survey reveal flies through a system, an event's card does not open over it, nor swing the
  view away; it comes as the flight ends or is skipped. The flight's caption already names what
  was found on each world. (The card's own "Show <system>" had been opening the system and so
  starting the flight under it.) Space, Enter and Escape now always reach the flight while it
  plays.
- **Room for Kin without domes needs warmth** (`OPEN_AIR_K`, `tooColdForOpenAir`, physics.ts):
  only where even the warmest ground (the day side of a locked world, the mean of one that turns)
  averages at least −14.9 °C, 258.25 K, the yearly mean of Oymyakon and Verkhoyansk, the coldest
  towns people live in the year round. The player: "Oymyakon and Verkhoyansk … with yearly
  average temperatures around -14.9°C … So that should be the limit." It was 195 K, the line
  where a world is frozen hard, so a world of 97 to 235 K, every sea ice, offered "2 without
  domes".
  - Colder, nothing grows outside: Kin live there under domes, in the Warrens (Abandon the
    Surface keeps its six tenths of the world's room below ground), or under Orbital Lamps and the
    warming works, which lift a world over the line as they warm it.
  - The panel says "none: too cold outside, domes needed", its tip and the Manual give the line
    and where it comes from.
  - In a saved game a settlement whose room this takes loses Kin as from any shrinking of room,
    one at a time, or into cold sleep under the Lottery; no homeworld is under the line (60
    galaxies: the warmest ground of every one 356 K). At the start about one living world in five
    is (401 of 1,915 in 60 galaxies).
  - The look: the player's world is ice all over, lit by a 2,820 K red dwarf, so its ice is the
    colour of rock; "Keep the true light", so the ice now glints a little (a third of open
    water's), to read as ice.
- **A rush finishes at once** (`finishQueued`, `sim/queue.ts`, used by the turn's industry and by
  `rushBuild`): Emergency shifts said they "finish the first project now", but left it a breath
  short of done, to finish at the turn's end like anything else, so rushing a project due that
  turn bought only the industry it freed for the next. Now the building stands, or the ship
  leaves the slips, the moment it is rushed, and this turn's industry goes on to the next in the
  queue. The price is the same (the work left, in matter and a little energy).
- **Checks:** `unit/open-air` (no room in the open at 236 K, room at 307 K; the warrens' share;
  lamps over it; a rush done at once, one a turn); `browser/fleet-colour` (every fleet of ours
  teal on the map and in the home system); `browser/survey-reveal` (a find's card waits while the
  camera flies, Enter still skips, the card then).
- **Balance** (300 standard competent games, and 300 at Harsh): 227 survive, 79 victories, a
  Degenerate Age of 113 turns (229 / 73 / 112 before); by fate decay 87 / 148, stable 79 / 81,
  curvature 61 / 71; Harsh 204 / 57 / 105 (209 / 63 / 106). Within the noise.
- **Validated:** tsc and the build clean (`index-yrDLdqsE.js`); the playtest passes; savecompat on
  its 6 saves; all 59 unit checks; all 57 browser checks in the real fonts.
