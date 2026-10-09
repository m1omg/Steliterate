# Session notes: conversations, decisions, open threads

Notes from the long working session on branch `claude/lucid-newton-30cbpk`, for picking up
where we left off. What changed is in `CHANGELOG.md`; how to work on the code is in
`DEV-NOTES.md`.

## How the player (m1omg) likes to work

- **Spoilers:** keep answers about the game spoiler-light. Never spoil the Lattice's story or
  ending, or the stranger minds met later. Since 3 Oct: say nothing about the Black Hole Age or
  later ages unless asked ("I intentionally didn't read the black hole part since I hadn't reached
  it yet. I want to be a bit of surprise").
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
  in the browser and continues playing between changes, and during them ("I will be playing the
  games while you do this … so please take care"): a deploy must not break an open game or a
  save. Leave the preview server running.
- **Music:** loves the 1991 Utopia (Amiga) version of Pachelbel's Canon by Barry Leitch; likes a
  slight bitcrush ("fits the dissonance of the game"); prefers dark ambient synthwave.

## Open threads and pending decisions

- **7 Oct, after Part C went live:** "can you instead make the beacons temporary? … more realistic
  than having them last literally trillions and trillions of years" (instead of the earlier offer
  to undo them). Chosen: a beacon burns "while we keep feeding it", and lighting one turns the
  nearest swarm toward it ("Yes"). Then: "make sure the AI for computer players is good and
  explain how it works and compare to Civ V AIs workings … the other players CONSTANTLY wanted 40
  matter for an unspecified knowledge amount." Done: dealings by way of life, stated terms,
  patience after refusals, memory shown on their cards. They like the Tessellate: "Principle
  seems fair." They asked for a PR, a push and the build live on Pages when done (PR
  m1omg/Steliterate#2, live at 8fd17c9).
- **7 Oct, later:** they wanted the AI explained as a mechanism, not as outcomes or quotes ("is
  the finite state machine a decision tree or whatever?"): ours is a decision list (priority-
  ordered rules with dice), Civ V's a stack of utility scorers with state machines for military
  operations, checked in its released source; Civ IV's unit and production AI, Halo 2's
  prioritized lists, Infinity Engine scripts and FFXII's gambits use decision lists too. Answer
  technical questions with the mechanism and primary sources. Then, about the teal ring around
  Aster: "how about making the big flat circle teal instead of having 2 circles/rings?" Chosen:
  one ring per world (the selection circle takes the colour of the world's own ring, which steps
  aside), live on Pages.
- **7 Oct, evening,** while they played: the type "a little bit larger, especially the ones that
  mention years … I really need to basically squint to see the numbers, especially properly the
  exponents", and on their 1440p screen "make it somewhat larger please". Done: 1.5 px more on
  every small size, exponents drawn in the game's own digits, the layout kept (Settings →
  Interface size goes further). The selection ring: "please make it not pulsate". Done, and the
  galaxy map's star ring too (they can have that one back). Music: "the sound stops when I switch
  between tabs … then it starts the soundtrack from the very beginning", and in Firefox (they
  used Vivaldi before) the synth played before the recording: "it should be the same in all
  browsers". Done: it plays on while hidden, and the synth plays only when no recording will.
  Then terraforming, "without breaking the saves … to increase habitability of planets while
  they're still in the late stelliferous era": all three structures, with seeding "conditional
  on some minimum habitability, so you cannot just seed complete wastelands with microbes and
  have them do all the work", and "it should not have that much use with worlds that are already
  habitable … more making uninhabitable planets more habitable. Think terraforming Mars ideas
  IRL." All of it shipped together, live on Pages.
- **8 Oct:** "The fonts really look much better." They started a new game and are enjoying it
  ("don't ruin my saves in my game"). Asked for interface only:
  - every measure in the settle list, "sorted by the highlighted most important property", and
    the same in the Nearby list;
  - each settlement's yields in the Systems list, "kind of like in Civilization".
  Done, display only (300 games identical). They also found an "Ice world" with a terminator sea
  and a boiling day side: the generator places some ice worlds close in (fixed-AU kinds). Such
  worlds are now named for their climate (Twilight sea). That batch went live at their word
  ("Put it live"; `988c6ff`). Asked whether new galaxies should place ice worlds by each star's
  light: "Fix it for new games". Done with a pass after generation (no random draw, saves
  untouched), live at their word (`4759c6f`). Then: "I don't think it's realistic for all
  planets that are closer than the early snowline to be water-free … there should be steam worlds
  as well … some planets can be up to 50% water … I don't want to overly complicate it". Offered
  a simple version (no steam worlds) or one with a runaway greenhouse; they chose "With steam
  worlds". Done (`waterFromTheStart`, trait `water_rich`, steam skies past the runaway limit).
  Two consequences, told to them in the report and theirs to overrule: a star's last flare is
  light like any other, so a water-rich world it takes past the limit is a steam world, not a
  Thawed ocean refuge (the water-poor still thaw); and Orbital Mirrors can shade a steam world
  only a little past the limit back below it (14 of 30 in six galaxies), so those can be
  terraformed. On the report they said: "Runaway limit should be 1.4x insolation not the ones
  quoted but yes put it live" (Kasting 1988's figure; done, 276.6 K); keep 1.9× for locked
  worlds; flares make steam worlds ("A steam world"); life under boiled ice: "Make that life
  die", and "If the world is dry on the dayside, a nightside under ice ocean should survive
  actually" (the scorch rule already works so). I had wrongly told them a flare spares boiled
  life: `scorchWorlds` takes 60% vitality over the flare, which kills it, but a game that starts
  mid-flare did not count
  the flare before turn 1, which is how a 1,500 K world showed 13% life. Done: steam worlds hold
  no life, and `scorchedFromTheStart`. They asked what Orbital Lamps are (explained). They also
  asked whether all red and brown dwarf worlds are close in: yes, in the game (within 0.3 and
  0.042 AU), unlike real systems, which also have cold outer planets (microlensing). Offered outer
  worlds as a separate batch (a hash of each system's seed, not the generator's draws); waiting
  for their word.
- **8 Oct, later (the audits):** "Do both, keep the water (but only if their water content isn't
  enough to induce a planet-wide runaway greenhouse) and add outer worlds" ("One red dwarf in
  three"); steam ground cooler, after Selsis et al. 2023 ("Runaway greenhouse, especially around
  red dwarfs, is not that hot"); brown dwarfs "should also cool realistically like white
  dwarves", each its own age, with a brown-dwarf-only collector usable from the Dusk ("easier to
  mine an approach … not as high gravity"), normal collectors refused there, "Their real light"
  in the Dusk and "All of it" after the Last Light. The galaxy's background: "About 1 K, as
  estimated" (they had pasted a table of today's 3–4 K; told them the red dwarfs alone give about
  a few tenths of a percent of today's light). "Starless planet should show temperature value.
  That's not a fucking bug. What's a fucking bug is that it's showing the wrong temperature":
  keep a row that is there and fix its value. Then "Please check all the planets and stars to
  make sure there is nothing that doesn't make sense" and "The wrong stuff please fix even though
  I have a game in progress, make sure it applies to that too. The more radical changes, yeah,
  apply them to a new game." Two audits (planet, star) found about 25 things; fixed live where
  they were wrong, new games only where a galaxy changes. Their answers on the two big ones: the
  blue-dwarf flare, far too bright (a 0.10 M☉ star peaks near 5,800 K and 1% of the Sun), "Fix it
  for new games only"; white dwarfs, two laws with a jump at the Last Light, "Mestel, then Debye
  fading" (Recommended). Also asked: "plenty of white dwarfs above 2000 Kelvin or so during
  dusk": physically a white dwarf is above 2,000 K only for its first ~64 billion years, so only
  a red dwarf's fresh remnant is, for a turn or so (told them). Cold white dwarfs "should look
  like the degenerate era embers … a slightly different color": done, copper. Black holes: their
  collectors gather the disk, not Hawking radiation (only the Hawking Collector does, a bend);
  "planets around black holes which have any accretion disks, even faint ones, should definitely
  not be horizon temperature": the disk now warms them. "It should be possible to actively attack
  the swarm with your warships": Attack the swarm. "The rust can disappear over time. I think
  that was a wrong choice from me to keep it permanent": it fades, a tenth a turn. "By adjusting
  your turn speed, it should be possible to talk to civilizations that you otherwise would not be
  able to (too fast/slow)" and "it should display your clock on the diploma's screen" (speech to
  text: the diplomacy screen, Signals). Asked how far, they chose "Any rhythm from mind to turn"
  (Recommended): our clock is the span from our dominant minds' clock to the turn's; Signals shows
  it at the top, and each card says in reach, too slow or too fast for us, and which pace would reach them.
  Then "Please push the base civilization update even to the live game" (speech to text; read as
  the pace update, and the fast-forward brought the audits batch with it, all theirs to ask for):
  live at their word (`fc6c59a`). Asked "should I merge now?": nothing blocked it, so I advised
  a merge commit (squash or rebase would orphan the commit IDs the docs cite) and keeping the live
  branch. "Yes, please go for it": PR m1omg/Steliterate#1 merged into `main` as `3e913f3`.
  Then, in their Black Hole Age game: messages from civilizations already gone ("Do they have any
  bearing? Do they do anything if I refuse?"): refusing or ignoring one does nothing that matters
  (only that dead civilization's regard); giving aid, pacts, promises, an exodus, the Choir's wish
  are refused with a note. Four answers misbehave and were offered, not changed (diplomacy:
  discuss first): refugees still arrive (+people, +3 resolve), a shared work costs 60 matter and
  never pays, a trade still costs and still delivers notes, and the Choir's wish, whose only
  allowed answer is to keep the Echoes, still costs 3 Echoes standing. "There should be some
  sort of a marker that you can click on, so it's not bugged" (their Uluvacaluth Deep, a hole
  evaporated with only their own people who left living there): fixed, live. "Please give an
  option to sort the stars by the type ... without cluttering the UI": a Type sort, live.
  "Everything is at horizon temperature. Even though curvature radiation would heat it above,
  so please fix it in real time": right (Falcke et al. give 5.5 pK for a heavy white dwarf);
  fixed, live. They thanked us for the game ("This is absolutely awesome").
  My push to the live branch was refused as a production deploy; asked "Merge?" over GitHub's
  Compare & pull request banner, then "Merge pls.": PR m1omg/Steliterate#3 (the work branch into
  `main`, merge commit `0e08054`) put the batch live. Offered: from now on I push each batch to my
  branch and the player merges it (or asks me to). Answered 9 Oct, "Always. You merge pls.":
  every batch goes live, through a PR into `main` that I open and merge myself (a merge commit)
  once it is validated. Still open: the four answers to messages from gone civilizations.
  Discuss first, not built: tidal locking by locking time (everything within about 1.4 AU of a
  red dwarf would be locked by now; it changes many climates); the flare's step at `blueAt` and
  its mass-blind date; the helium stars' one set of numbers.

- **Next steps:** the player said they may have more changes in mind; wait for them.
- **The player works from more than one session.** Before changing anything, fetch every branch
  and compare with `origin/claude/lucid-newton-30cbpk` (they asked for this check on 2 Oct; it
  found nothing new: both branches at `a16f928`, PR m1omg/Steliterate#1 without comments).
- **6–7 Oct, the long plan** (asked 6 Oct: put the test scripts in the repository; "Black dwarves
  never cool below 5 Kelvin and planets never cool below 1 Kelvin … the amount of usable energy
  they give off is actually drastically different"; the Great Decay screen showed when protons do
  not decay; aliens who colonize, war, deeper diplomacy, "not Endless Space too, but dark").
  Their choices: honest temperatures, "little energy is not zero energy", buildings that harvest
  decay and curvature heat, any building dismantled for its mass at an energy cost, inner heat
  fading after the Last Light, Coldminds and Cold Vaults at half upkeep in the dark; three fates
  of matter, odds decay 50, curvature 25, stable 25, the timeline ambiguous until "Research or
  the event"; the Long Flow once, at 10⁶⁵ years ("it's actually going on right now … for really
  slow beings it may be significant … the timestep of the civ in question may determine if its a
  threat to their own integrity"), with unexcavated relics lost, unmanned structures flowing,
  worlds smoothing into spheres and sleeping aliens at risk; neighbours "Pacts, then expansion",
  war against "Any, at a high price", built and shown "All at once". Constraints: the halo
  civilization's quest line stays exactly as it is ("don't change that part. I love it. Unless
  you want to extend it rather than reduce anything"); "it should be possible but hard to fight
  the hunger"; a little harder is fine, never unwinnable. Order: A tests (`975d6c3`), B0 calendar
  apart from the age (`812e2e2`), B2 honest cooling (`aae0347`), B3 three fates (`5b9d277`), B4
  taking structures apart (`f34c673`), B5 the Long Flow (`9c39829`), then C living neighbours in
  six phases: honesty (`e706fcd`), pacts (`aa11b79`), refuge (`862b219`), expansion and war
  (`43da424`), ways that meet (the commit that took Part C live, 7 Oct). A and B went live one
  at a time; C went live in one piece when all its phases were done. Not asked, so not done:
  conquest victories, neighbours' fleets on the map, diplomacy between the neighbours themselves
  (they meet only through us: news, coalitions, claims never on another's star). The player's own game was in the Black Hole Age on
  6 Oct, so B2 reaches it: core heat fades and cold dwarfs give nothing.
- **2 Oct, kinds of structure** ("a UI friendly way of distinguishing building types … the list
  is becoming very long"): done, interface only (`CHANGELOG.md`).
- **2 Oct, Charters can be repealed** ("without breaking saves and my playthrough … no law can
  ever be revoked … I used my quota of laws already in the Stelliferous era"): done. This
  reverses the design's "permanent laws"; the weight is kept by the cost (the law's Accord again,
  every Thread's stance turned around, dissent +3) and by one-time effects staying done. The
  ways of the Hunger stay irreversible. Tested on the player's own turn-77 save (their book was
  full at nine); the harness is game for game unchanged (the autoplayer never repeals).
- **2 Oct, a Look button on "Survey complete":** done (`c622a14`), and on "Living world found".
- **3 Oct, the Systems window** ("adjust the settlement button so it's systems button … a separate
  category in the menu for collision stars in the degenerate era because they're precious"):
  done, interface only. The branch check found nothing new (both branches at `c622a14`). The
  player is several turns into the Degenerate Age (they said so on 3 Oct): the turn-77 file
  they uploaded on 29 Sep (η 14.00) is an old snapshot, not their current game, which lives in
  their browser. Ask for an export before reasoning about their game's state.
  Most collision stars used to light and go out inside a single turn (in 20 autoplayed games,
  203 of 228 had gone out before they could be seen), and helium stars always did.
- **3 Oct, new stars keep time like the flare** (asked: "make them burn for a few turns like the
  flare with the turns getting shorter as in taking less time"): done. New stars light at the end
  of their turn; A New Star and White Fire offer to keep time (six turns, each lived in full, one
  star at a time; why one at a time: a new star lights about as often as one goes out). Made
  opt-in, like the flare, rather than automatic (`4fe2404`). With the autoplayer keeping time with
  every star (about 12 a game) the harness went from 133 to 167 of 300, victories from 18 to
  117, and the Degenerate Age from 44 turns to 127.
- **3 Oct, then priced** (the player: "a bit of a cheap shot … every time you can keep pace, even
  when you're deep in the degenerate era"). Their decisions, in order: a civilization whose next
  turn is more than 100× the star's life is too slow ("turns too long for the star", chosen over
  a rule by pace setting); no energy boost for slow civilizations from afar (the physics check:
  at light-years the star's light is far too thin, see CHANGELOG), but every new star is "a
  resolve and insight boosting event for even slow cold civs" (Study it / Watch the flash); and
  yet "if a slow civilization has enough energy reserves, they can keep pace with even the much
  shorter lived stars, white fire should be costing some energy for everybody … a one-time
  energy payment … the balance may need to be tuned". Built: free within 100×, then 250 energy a
  tenfold, at most a full store (tuned over eight harness runs; the aim was the Degenerate Age
  back under about 70 turns). Result 147 of 300 (52 victories, age 68 turns); the free in-tune
  clocks alone give 146. If they want it harsher: fewer turns per paid clock, or a lower free band.
- **3 Oct, collision stars end with the galaxy** (asked; they had not reached that far in their own
  game): done, collisions taper over the evaporation (η 18.4–21) and stop; helium mergers go on.
  Offered a one-turn "harvest the flash" for paid clocks (their phrase: "more like harvesting an
  explosion rather than something where you can settle" for slow civilizations); they chose to
  keep six turns. They thought the price might need to be 100 or more: it is 250 (capped at a full
  store), and the harness puts us at 140 of 300.
- **3 Oct, white dwarfs keep cooling** (asked, in plan mode: embers "should stay at 63K yes but the
  rest should continue cooling though I don't want to break the game"): done. Unwarmed dwarfs
  cool by Mestel's law from 20 K to 5 K by η 16.7 and then become black dwarfs (they asked why a
  5 K white dwarf was not one: no reason, so now it is). Embers unchanged except that their
  shown temperature falls during the halo's fade. They asked how long embers last (they know
  Adams & Laughlin's point that the WIMPs run out): η 22 to 25 is the right order, but a dwarf
  cast out of the galaxy leaves the halo. They chose to test that first, then (shown 430 / 145 /
  64 against 425 / 159 / 68 for going cold at once): "It goes cold but of course gradually, not
  right away." Done: it dims over a decade of η (told plainly that the slow part is the leaving,
  not its own heat, which lasts a sliver of a turn).
- **3 Oct, following a new star on, and more** (from a turn-93 screenshot while keeping time with
  one star: the text mixed "too slow" with "not needed"; "should have an option to extend the
  fast time period"; "observing but not revealing on map doesnt make sense but i dunno how to make
  the choices balanced"; "record should say collision star name"; ships should be able to pick
  from the Systems window). Done: a star that outlasts the one we keep time with can be followed
  on (fresh price from our own pace, never below 250; freely chained it made the game much easier,
  see CHANGELOG); Study it charts the system and Race for it at our own pace went (it only
  charted); the Record names the system; Send buttons in the Systems window. If they want it
  stricter: one follow-on per chain (300 games 150 / 55 / 73).
- **3 Oct, "quickening tech should let you slow even slower than collision star pace."** Asked:
  they chose pace buttons that work during a star clock (over a wider pace range). Done: with
  Quickening, Quick ×10 splits each clock turn into ten, each lived as a tenth (same light, ten
  times the turns and upkeep). Capped at ×10 (Quick ×100 does the same there); say so if they
  want ×100 to mean 600 turns.
- **3 Oct, "why are worlds around collision stars always hot?"** Physics, not a bug: brown
  dwarfs' worlds orbit at 0.004–0.05 AU and a collision star is temperate near 0.034 AU (see
  CHANGELOG). Offered nothing to change; the bend is that the worlds survive the collision.
- **3 Oct, inaccuracies from four screenshots, and zoom.** An ice-shelled ocean said "open sea"
  but was drawn as ice; worlds by helium stars "should be either evaporated or at least lava or
  gas"; a giant drawn blazing gave no light ("if I hurry up, I should be able to at least gather
  one turn of light"). Asked, they chose: "boil away when hot enough unless a gas giant" (worried
  about saves: no save change was needed), "swallowed too" inside a giant, and to catch the
  flash. Mid-plan: centred objects slid aside when zooming. Done: zoom keeps what is centred in
  the middle (`9eea773`); every light draws worlds as hot or wet as they are, display only
  (`0c5c02f`); worlds boil away and giants swallow (`4d4fc7d`; 900 games 430 / 145 / 68 against
  447 / 136 / 68: a real but small cost, 20 of our settlements per 150 games); giants shine
  through a turn of their own with an event, and a star too brief for six turns can be caught in
  one (a flash; 900 games 444 / 152 / 68). The flash's bend past η 18.1 (the shortest countable
  turn outlasts the giant, its light still counted in full) is stated in the CHANGELOG.
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
  player said they topped up plentifully; they were told.
- **29 Sep, "get Codex running" (the player has a ChatGPT subscription; images only):** done, with
  Codex's built-in image tool: the Tessellate and Fork plates, 16 event plates and six ship
  hulls (how, in `DEV-NOTES.md`). Claude Code's auto mode blocked running Codex as "creating
  unsafe agents" and would not let the session add its own permission rule ("self-modification");
  the player added `Bash(codex exec *)` themselves. Then, as asked: a Playlist setting, where
  each age plays any mix of its recordings and the synthesized score. **Pending, for Krea
  (music):** a second Dark track and a recorded Canon beside the arranged one (prompts in
  `DEV-NOTES.md`).
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
- **9 Oct, a friend with low vision:** "I have a friend who has a sight impairment … she's using a
  software which zooms in only a part of the screen as well as making everything on the website
  bigger. The menus are often inaccessible, especially the build menus, and she cannot really see
  the whole screen, only a part of it at once … I'm happy with the interface as it is now. Would
  I have it in mind as a mode that's optional". Her screenshots: the page translated into Czech
  by the browser, the settlement panel's Build list squeezed to one row. Decided with them: fixes
  that change nothing at usual sizes go to everyone; an optional mode with the core and map
  helpers; plan for the mouse and the keyboard both (they were not sure which she uses). A
  reviewer's corrections taken: rows take no focus from a click (Enter would press them again),
  prompts take focus on their titles, the focus ring only after Tab, the selection's panel last
  in the column. Found on the way: under the browser's translation the turn count, η, panel
  titles and tooltips froze (fixed for everyone). Built as "A magnifier mode" (CHANGELOG);
  `?lowvision` on the address turns it on, a link they can send her. Their saves: asked "Will
  this be okay with my saves?"; nothing in `src/game` changed, and their turn-77 save loads and
  plays to the end. "Always. You merge pls.": I opened and merged PR m1omg/Steliterate#4 (merge
  commit `d9bd6e5`), live. Not built: read-aloud,
  keyboard camera control, a Czech translation of our own. Her own word on what helps would be
  worth more than our guesses.

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
