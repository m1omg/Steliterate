# Handover: picking up Steliterate

This is for the next Claude instance: a new session, or one on the player's other account. It is
the entry point; the details are in the other notes, and every section says where.

- Refreshed on 2 Nov at the player's word ("update the HANDOVER.md for another handover").
- Rewritten on 16 Oct ("pls also do a .MD for handover"), after the project check of 15 Oct.

Keep it spoiler-light, like everything the player may read. The stranger minds and the endings
are in `docs/spoilers/`, for you only: never repeat them to the player.

## 0. Start here (4 Nov)

### Where things stand
- **Live:** the game is at both addresses as PR m1omg/Steliterate#60 (`f85739f`, script
  `index-CgxQ4W4K.js`). The addresses are in §1.
- **Branches:** the work branch (`claude/epic-wozniak-lyhulf`) and `next` hold the same files;
  `main` lacks only the notes commit that says PR #60 is live, as after every batch.
- **Nothing is in flight:** no batch half done, no check running, nothing uncommitted.

### The last thing done (3 and 4 Nov)
- Real synthwave for the Twilight Interregnum's and the Long Dusk's films, and the Long Dusk's
  film in a game begun in the Interregnum, played at the Last Gas (§3; PR m1omg/Steliterate#60).
  The player heard and saw the previews first, then said "Please merge."
- The player then asked to brainstorm the Dark Era ("Don't implement those yet"). The ideas
  offered are in SESSION-NOTES, "Open threads and pending decisions"; none is built.
- The other 16 films keep their music of 1 Nov. Rendering them as videos was offered on 2 Nov
  (about 10 minutes each here). There is no answer yet.

### First steps
1. `git fetch` every branch and look for work no PR has taken in:
   `git log origin/main..origin/<branch>`. The player sometimes runs two sessions at once. On
   2 Nov the only such work is the Godot proposal on `claude/vibrant-edison-svhjtd` (§6).
2. Run `npm ci`.
3. Read in the order of §2.
4. Set up the container as in §7.

### How a batch goes live (since the switch, 27 Oct)
1. Validate it (CLAUDE.md, "Validate every batch").
2. Push the work branch, then open a PR into `main` and merge it yourself with a merge commit.
3. Wait for `main`'s Pages run to finish: the workflow cancels a run in progress.
4. Run `git push origin claude/epic-wozniak-lyhulf:next`.
5. Check that both addresses serve the build's `index-*.js`.

A session given a branch of its own starts it from `main`, works there, and copies it to `next`
the same way (`git push origin <branch>:next`).

### Which browser checks to run
- **A small, local fix:** only the checks it touches, by name.
- **The full suite** (about an hour in three lanes): for a batch of several changes, or for one
  that touches any of:
  - `src/render/`;
  - the turn;
  - the store;
  - `App.tsx`;
  - the HUD's frame.

The rule is in CLAUDE.md, "Which browser checks" (2 Nov).

### What to do next
Ask the player. §6 lists what is waiting on them.

### Their usage
It runs out at times (twice on 19 Oct); they pause and come back. Work in batches that end
validated and pushed, and keep messages short and plain.

## 1. What this is

Steliterate is a turn-based survival strategy game at the end of starlight. You keep a
civilization alive from the last red dwarfs to the Dark Era, each turn covering more time than the
last.

- **Stack:** Vite 8, TypeScript 7 (strict), Preact with signals, three.js 0.186, Web Audio.
- **Licence:** GPL-3.0.
- **Repository:** `m1omg/Steliterate`.
- **Code:**
  - `src/game` is the simulation, deterministic and seeded;
  - `src/render` holds the three.js views, and `src/film` the films;
  - `src/audio` the music and sounds, `src/ui` the interface;
  - `tools/` the harness (`sim.ts`), the playtest, savecompat and the checks (`tools/checks/unit`,
    `tools/checks/browser`).
- **Since the switch (27 Oct), one game, and two frozen copies of the one before** (Pages builds
  `main` and `next` on a push to either):

  | | The game (the new version) | Its mirror | The old game, frozen ("today's game" in older notes) |
  |---|---|---|---|
  | Address | https://m1omg.github.io/Steliterate/ | https://m1omg.github.io/Steliterate/next/ | https://m1omg.github.io/Steliterate/archive/2026-10-27/ (and `/archive/2026-10-13/`) |
  | Branch | `main` | `next`, a copy of `claude/epic-wozniak-lyhulf` | `public/archive/` in the build, never edited |
  | As of | PR m1omg/Steliterate#60 (real synthwave for two films, the Long Dusk's film at the Last Gas, 4 Nov), `f85739f` | the same, with the Interregnum offered | `0279db1` (PR #45), and `4aaaa2a` (13 Oct) |
  | Live script | `index-CgxQ4W4K.js` | the same | `index-D13F5Go2.js`, `index-B4EKBtSN.js` |
  | Saves | `steliterate2.` keys (their own; slots' data in IndexedDB `steliterate2` since 1 Nov) | the same | `steliterate.` keys |

## 2. Read in this order

1. This file.
2. `CLAUDE.md`, for:
   - the rules that are easy to break;
   - the validation list and which browser checks to run;
   - every PR;
   - the balance references.
3. `docs/plans/new-version.md`: the approved plan the game was built to, from 13 Oct (then "the new
   version").
4. `docs/SESSION-NOTES.md`:
   - "How the player likes to work";
   - "Picking up", which opens with dated entries from 27 Oct to 2 Nov, each decision in the
     player's words, with the older history after them;
   - "Open threads and pending decisions".
5. `docs/DEV-NOTES.md`:
   - "Workflow for every batch";
   - "Test hooks and scripts", with "Helpers to recreate in a new container";
   - "Gotchas";
   - "Where the newer systems live", and its "The films' music";
   - "Balance reference".
6. `docs/CHANGELOG.md`: the last entries (the newest are at the end). Read `docs/DESIGN.md` when a
   rule's intent matters.
7. `docs/REPLICATE.md`, only when you need the old game in full:
   - It describes the game as of PR m1omg/Steliterate#39 (`2d345e4`, 21 Oct). That game is now
     frozen at `/archive/2026-10-27/`, and PRs #40 to #45 came after the document.
   - It covers every rule, number and formula read from the code, the interface, the sound, the
     assets and the checks.
   - Its last section is sealed: the stranger minds, the Lattice's story and the endings.

## 3. What came since 16 Oct

On 19 Oct the player ran out of usage and asked for "this plan along with updating the handover
MD, because I will need to continue in another session". On 20 Oct a new session, on the other
account, picked it up. It finished that plan, `docs/plans/2026-10-19-falling-worlds-and-the-list.md`
(the player's list of 16 Oct). Each batch since 16 Oct is listed below, oldest first; the CHANGELOG
has the figures for each.

**Done since 16 Oct:**
- `docs/REPLICATE.md`: a full spec of today's game, written 16 to 17 Oct, kept up with `main`
  to PR m1omg/Steliterate#39 (`2d345e4`, 21 Oct), its notes of where text and code disagreed now
  the rules.
- **"The game keeps its word"** (19 Oct, in both versions at the player's word), live on 20 Oct:
  REPLICATE found places where the game's text promised one thing and the code did another, and
  each was made to keep its promise (the Long Record, Hunger Studies, the Communion Charter,
  Harsh's "crueller crossings", falls into brown dwarfs and black holes in new games, the
  Expansion Mandate, rules no text told of, and a hidden step made reachable: its details are in
  `docs/spoilers/slow-ones.md`, never tell the player). Today's game by PR m1omg/Steliterate#34
  (`e827e2f`). The figures are in the CHANGELOG.
- **Falling worlds** (the plan's part B, with item 2 of the list), in both versions, new games
  only, live on 20 Oct: worlds of rock and ice break into rubble rings at the tidal limit, giants
  fall in a flash (melting or boiling worlds inside its melt line, banked by Burst Catchers), the
  Flash Shelter and the Shadow Shield, the dark choice in A World Falls, more worlds at black
  holes, a hole's Disk luminosity in Suns. Today's game by PR m1omg/Steliterate#35 (`e4c77d7`;
  code `8133d7f`, from `claude/promises-main`), then `main` merged into the work branch with
  `-s ours` (`179e4ab`). One change from the plan, to be told plainly: both shelters come with
  Dusk research (the Flash Shelter with Deep Warrens, the Shadow Shield with Orbital Industry),
  not Burst Capture, since a white dwarf's close giant can fall in before the Last Light.
  CHANGELOG, "Falling worlds", has the figures:
  - the new version: 147 / 63 / 68 of 300 (156 / 65 / 71 before); a control run with the new
    worlds and the old falls puts what the rules cost at 10 games, within the noise; Harsh 145 /
    52 / 73 (124 / 35 / 66);
  - today's game: 149 / 80 / 72 of 300 (160 / 81 / 72), Harsh 154 / 58 / 68 (147 / 62 / 68).
- **The list of 16 Oct** arrived on 20 Oct (the `.odt` attached again). Its four pictures are
  described in the plan (part C, "20 Oct: the pictures, seen"), so the file is not needed again.
  Item 2 is done, with the falling worlds.
- **Items 7, 1 and 6** (one batch, both versions), live on 20 Oct: no "Life Under the Ice"
  without a star (none in the starless Drifts, where it fitted 178 worlds in forty galaxies), Kept
  Warm by Its Neighbours not counting the Deep, no find about a world that is falling, flung loose
  or gone (`pruneFinds`); and one sea for the Water row and the picture (`seaBand`: the band of the
  day side where water is liquid; the super-Earth of the player's picture shows its sea, the
  frozen eyeball is all ice). Today's game by PR m1omg/Steliterate#36 (`981e0f0`; code `b48562d`),
  merged back with `-s ours` (`f08a951`). One change from the plan: worlds flung loose stay among
  the survey's candidates, as Warm in the Dark is found only on them. CHANGELOG, "Finds where they
  can be, and one sea", has the figures (both versions within the noise; nearly every game
  re-rolled by the finds' tests).

- **Items 3 to 5, the pace** (both versions), live on 20 Oct: a turn's share is the Tide turns
  of time it covers (Quick ×10 exactly 0.1, Slow ×10 exactly 10, on the age's ladder), and it
  pays, costs and wears the worlds by it; flare clocks likewise; the pace lit is the one in use.
  Building it showed two things the plan had not: one Slow ×100 turn could cross the whole Dark
  Era, and the victories had leaned on the old slow turns' overpay. Asked, the player chose "Dark
  keeps its clock" (a pace there only halves or doubles the turn, now paid for what it covers;
  and no slow turn ends any age) and "Bring them back" (after the Last Light every source gives
  more: ×1.4 in today's game, ×1.125 in the new version, each tuned on the harness to about 77
  victories). The autoplayer now takes the Long Sleep in the dark when its reserve would not
  last (the overpay had carried it, and it never slept), so survival rose: today's game 229 / 73
  / 112 of 300 (165 / 77 / 70), Harsh 209 / 63 / 106; the new version 187 / 77 / 103 (165 / 77 /
  72), Harsh 147 / 51 / 98. Tell the player plainly, if they ask: the rules made the dark no
  cheaper; a player who sleeps through it always could. Today's game by PR
  m1omg/Steliterate#37 (`d2abd2a`; code `bd86639`), merged back with `-s ours` (`95353de`).
  CHANGELOG, "The pace: ten turns to a Tide turn", has the rest.

- **Combat** (20 Oct, the new version only, at the player's word; live at `/next/`): the player
  found that at war they could send ships into an enemy's system and nothing attacked them, and
  asked for "a combat system ... an auto resolve one" with "custom tactics choosable as modifiers
  that would modify the damage inflicted and damage received". Their answers: a set of tactics
  per fleet, the new version only, "strike back" (in a war we begin they come for our
  settlements too), tactics in every fight, swarms too. The plan is
  `docs/plans/2026-10-20-combat.md`. Built: Hold the line, Close in (×1.5 both ways), Stand off
  (×0.5 both ways, no siege), Escort; every ship at a star is a target and every settlement fires;
  ships are lost one at a time; sieges and storming at any settlement by either side; the others
  arm, hunt, pick tactics, retreat, strike back and make peace when losing; a forecast on each
  tactic's button, a Battle section, the map's ✕. Two things to tell the player plainly: Stand off
  takes ×0.5, not the ×0.35 they were offered (at ×0.35 it won every fight, four ships against
  five); and the first forced wars wiped out our settlements at one star in a single turn, so the
  blockade and the storming are once a star a turn now. CHANGELOG, "Combat", has the figures.
- **The survey reveal as a flight of the camera** (21 Oct, display only; live in both versions):
  the player sent a clip of Endless Space 2 showing a new system world by world ("this is how i
  imagine the reveal planetary system sequence...not ur version"). Now the camera flies to each
  world in turn, close and half lit, while a caption types in its facts and four bars for the four
  kinds of settler, dust streaking between worlds, the star rising over the last world's edge,
  then back out to the whole system; Space or a click goes on, Skip as before, a drag takes the
  camera. No rule changed. The new version first (`5890f97`); asked, the player wanted it in
  today's game too ("yes"), which had had no survey reveal at all: PR m1omg/Steliterate#39
  (`2d345e4`; code `2c8ab8e`, and `aa55440`, the new version's 14 Oct fix to `browser/a11y`,
  which failed on `main` as it stood), merged back with `-s ours` (`db6c7ce`). Today's game turns
  reveals off for its checks with `?noreveals` (the new version's `?nofilms` does it there).
  CHANGELOG, "The survey reveal as a flight of the camera" (and in `main`'s, "The survey reveal, a
  flight of the camera").
- **Four fixes from the player's screenshots, and a rush that finishes at once** (24 Oct, both
  versions, in saved games at once with no change of shape): all our ships in our teal (a
  warship was tinted the yellow of a neighbour's); a find's card waits while the camera flies
  through a survey; open air only above −14.9 °C, the coldest towns on Earth (the player's line),
  so a cold world needs domes, warrens or lamps; the ice worlds' look kept; and a rush finishes
  the first project now, not at the turn's end (`src/game/sim/queue.ts`, `finishQueued`). PR
  m1omg/Steliterate#40 (`0da09b3`; `claude/promises-main` `dd60b5f`), merged back with `-s ours`;
  the new version `8783e38`. CHANGELOG, "Four fixes from the player's screenshots".
- **Warships: a list to send them from, and their attack against both** (25 Oct, both versions,
  display only): Choose from list on a warship's panel opens the Systems window's new Swarms and
  civilizations tab, Asked for help first (an unanswered plea, or a promise not yet kept); every
  ship's description says its attack against swarms and other civilizations, or Unarmed
  (`attackNote`, `src/game/data/ships.ts`; `FoesList`, `pleaStars`, `src/ui/screens/Lists.tsx`;
  `browser/warship-list`). PR m1omg/Steliterate#41 (`ff8440a`), merged back with `-s ours`; the
  new version `84bbd02`. CHANGELOG, "Warships: a list to send them from".
- **Star types, helium stars listed, every star its own name, a brief star's light** (26 Oct,
  both versions, display and names only): the Systems window's Star types tab and its Black holes
  tab in every age; the Collision stars tab lists the helium stars and giants too;
  `distinctNames` (`src/game/names.ts`, at the end of generation and on every load, drawing
  nothing) gives two clusters of one name, and their two Wells, names of their own; the build
  list says why a collector gathers nothing by a star too brief for the turn (`noLight`,
  `projection.ts`). PR m1omg/Steliterate#42 (`398f1a5`), merged back with `-s ours`; the new
  version `db0ffe8`. CHANGELOG, "Two Wells of one name".
- **Our settlements sorted by a yield, Star types by measures** (26 Oct, both versions, display
  only): the yield icons over Our settlements are buttons (`yieldSort`, `Lists.tsx`: most first,
  least, as founded; each system's total beside its name; on a phone too); Star types shows each
  surveyed star's Livable, Power, Matter and Lasting (`SiteStrip`) and sorts by any. PR
  m1omg/Steliterate#43 (`f685a36`), merged back with `-s ours`; the new version `27e603c`.
  CHANGELOG, "Our settlements sorted by a yield". From now on wait for `main`'s Pages run before
  pushing `next`: the workflow cancels a run in progress (`cancel-in-progress`), which left a red
  cross on PR #42's merge though the next run built both.
- **Storage notes, brief stars caught, star states, a combat report, scrollable forecasts** (26
  Oct, both versions): the build list gives each storage building's real reserve in one line
  (Deep Storage's quarter counted: a Ring +312, a Burst Catcher +375); Burst Catchers say what they
  catch, and bank a new star whose whole life was shorter than its turn (a rule: `briefStarLight`,
  `physics.ts`, a flash by its light, not when we kept its clock; live, so saves have it); Star
  types says each star's state (`starState`); fights' Record lines carry a tone (`combatLog`,
  `util.ts`) and open a Combat window after the turn (`CombatReport.tsx`, gathered in
  `turnflow.ts`, a Long Sleep's together); every forecast not closed is in a list that scrolls.
  Harness: today's game 228 / 78 / 113, the new version 183 / 78, within the noise. PR
  m1omg/Steliterate#44 (`133b568`), merged back with `-s ours`; the new version `16df449`.
  CHANGELOG, "Storage that says what it holds".
- **Each building's real effect, and a film for a game's first supernova** (26 Oct): a built
  structure's chip says what all of that kind there give it now (`builtEffect`, `projection.ts`:
  the economy with and without them), and where they make nothing, why, dimmed (both versions, PR
  m1omg/Steliterate#45, `0279db1`, merged back with `-s ours`). The new version has a Supernova
  film (`src/film/supernova.ts`, 40 s, with a chirp, a heartbeat and a boom in its cue), played
  with a game's first supernova (`civ.flags.sn_film`; an older save's next one), the card behind
  it; `eb70648`. The player asked for a film of the Heart evaporating, then (on being sent a video
  of the Last Horizon) for the Last Horizon to open with it instead, its cut before kept in
  `src/film/saved/lasthorizon-v1.ts`. CHANGELOG, "Each building's real effect".
- **The Last Horizon opens with the Heart's going** (26 Oct, the new version, display only): three
  shots (the Heart at its own scale, its glow and long fall, its end and last second) in place of
  the old first, the film 82 beats, the title at 76 (`dark.ts`, `heartOpening`; its mass from
  the game, `FilmArgs.heartMass`). The cut before: `src/film/saved/lasthorizon-v1.ts`, its cues in
  its header. CHANGELOG, "The Last Horizon opens with the Heart's going".

- **The switch** (27 Oct, the player: "Switch main to /next/"): PR m1omg/Steliterate#46
  (`8a0d2ad`), from `next`, merged with a merge commit, put the new version at the main address.
  Today's game is frozen as it was, at `/archive/2026-10-27/` (`public/archive/2026-10-27/`, built
  from `0279db1` in a clean worktree, its own `public/archive/` removed first), with today's
  storage keys, so every game saved at the main address before the switch plays on there; the new
  version's title screen and Load point there (`OLDER_BUILD`, `src/keys.ts`). The 13 Oct copy
  stays. CHANGELOG, "The switch".
  - **How batches go live now:** a PR from the work branch into `main`, merged with a merge commit
    (open and merge it yourself, as always), and the work branch copied to `next`, which stays a
    mirror at `/next/`. No more ports to today's game, no `claude/promises-main`, no `-s ours`.
  - Wait for a running Pages run before pushing again (`cancel-in-progress`).
- **Matter shown as we hold it** (27 Oct, the first batch the new way, PR m1omg/Steliterate#48,
  `139d697`; the switch's notes were PR m1omg/Steliterate#47): the player, "but i have 30
  matter...", with 29.6 shown rounded to 30 and a build of 30 refused. The top bar rounds energy
  and matter down (`held`, `src/ui/fmt.ts`), and a refused build says what we have ("Needs 30
  matter; we have 29.6.", `queueBuild`). Display only. Check: `unit/held-matter`.
- **A star's state wherever the Systems window names its kind** (27 Oct, PR
  m1omg/Steliterate#50): the player, on Our settlements, "still no ember/cooling description etc
  or where is it?" The state in a word (cooling, nearly cold, ember…) was only in Star types; now
  one chip (`StateChip`, `Lists.tsx`) follows the star's kind in Our settlements' headers, Surveyed
  worlds (Systems) and Seen from afar too. Display only. Check: `browser/star-types`.
- **The governor** (27 Oct, PR m1omg/Steliterate#51, the plan approved): the player, "add a
  governor like in alpha centauri to set a focus on building buildings of a certain category pls",
  then "allow me to mark different worlds in system view to set the governor to". A settlement
  handed one queues, whenever its queue is empty, the structure of its kind (the build list's
  nine) worth the most there per cost, keeping 10 matter; set in its Build tab or for several at
  once from a system's Worlds list (tick boxes, Mark all, a Governor row). `sim/governor.ts`;
  DEV-NOTES says where the rest lives. The harness is unchanged game for game (183 / 78 / 104).
  Checks: `unit/governor`, `browser/governor`. With it, Our settlements say which are leptonic
  (the player: "should show which settlements are leptonic pls"), and which are making the
  Passage, as does a system's Worlds list ("Passage 33%", `FormWorkChip`; 28 Oct).
- **Fortify one or all, the black hole of our choice, Hide unavailable** (31 Oct, PR
  m1omg/Steliterate#52): a fleet of several warships has Fortify one (`fortifyOne`) and Fortify
  all; a leptonic settlement's drift section lists every hole it could go to with spin, lifetime
  and distance, the game's own choice marked recommended (`driftChoices`); the Build tab can hide
  what cannot be built there (`hudPrefs.hideUnbuildable`). The autoplayer's drift is unchanged.
  Answered the same day: no ship can be built after the end of matter (the Shipyard has no
  leptonic form, and a leptonic settlement builds only what has one); ships built before stay in
  service, which the game does not take away (they are matter too: a bend, offered to the player).
  They chose a Leptonic Shipyard, and the Leptonic Wraith the plan had promised and never built:
  both in the same PR (`lepton_shipyard`, `wraith`, `shipCheck`; the hull drawn by
  `tools/draw-wraith.cjs`). Then "check for other unimplemented things too": the audit's list is
  in SESSION-NOTES (31 Oct).
- **Answers that cannot reach the gone, stored matter in the report, the governor in the Systems
  window, events unlocked by technology** (31 Oct, PR m1omg/Steliterate#53): from the audit, the
  player chose the gone senders' answers (`goneAnswer`: what would reach them is greyed out, the
  rest closes the message and does nothing) and the crossing report's line for stored matter
  lost. "Please add a governor-setter into the Systems menu": tick boxes in Our settlements
  (`src/ui/Governor.tsx` holds the shared controls). And "The types of random Events should be
  unlocked by technology. (how does one harvest a comet without ships in-systems or an orbital
  shipyard?)": `EventDef.tech`, `EventChoice.tech`, `choiceOk`; the comet falls through any system
  of ours once Volatile Shepherding or Orbital Industry is known, more often the more systems,
  shepherded or mined only where our ships or a Shipyard can haul it (a probe meets it, hauls
  nothing), studied anywhere. The player answered four questions on it (SESSION-NOTES, 31 Oct):
  nature stays ungated; of the finds, the shard, the hole's light and the foil need technology,
  mining and quarrying not.

- **The Twilight Interregnum** (1 Nov, PR m1omg/Steliterate#54, `32a9c40`, live script `index-C2wy549U.js`; at /next/ only): "a sort of a
  prequel mode where you start earlier, from 1e12 years", "For the next and only for the next
  version, not for the main one"; the player named it, asked that it be optional, and that its
  galaxy look "livelier and brighter than the dusk one". An age before the Dusk, 10¹² to 9 × 10¹³
  years, about 60 turns; the same galaxy rewound (`src/game/interregnum.ts`): our home around a
  heavier red dwarf that dies near turn 46 to 50, the Dusk's red dwarfs nebulae born at the very
  end, young bright stars and blue giants, the gas thinning (Gas Scoops); The Last Gas hands over
  to the Dusk as ever. The code is the same at both addresses; only /next/ offers it (`PREVIEW`,
  `src/channel.ts`), and its saves are kept apart and hidden at the main address. Games begun in
  the Dusk are unchanged, all 300 of the harness's. The interview's answers are in SESSION-NOTES
  (1 Nov); DEV-NOTES has where it lives and its traps.

- **An intro for the Interregnum, and the films' music rewritten** (1 Nov, PR m1omg/Steliterate#55):
  "Make an intro for Twilight interregnum also please improve the music in the vids and dont use the
  same melody for every vid", then "a bit of Terminator 1 synth soundtrack energy … not a full style
  overwhelm, just a bit". The Interregnum's film, Reel 0 (`src/film/interregnum.ts`), plays as such
  a game begins. Every film's music is now composed in `src/film/score.ts` (its own key, mode,
  melody, chords, arpeggios, bass and instruments) and played by `cue.ts` (new instruments and a
  reverb; an analog sequencer, a metallic clank in an uneven pulse and a gliding lead in the darker
  films). No rule changed. DEV-NOTES ("The films' music") says how to write a score and measure it.
  Live at both addresses as `5b84cbc`, script `index-BdC7hWfs.js`.

- **Stars that brighten, black holes hotter as they shrink, lifetimes, a warning for a large Thread**
  (1 Nov, PR m1omg/Steliterate#56, `src/game/stellar.ts`): red dwarfs brighten toward their blue
  flare (at most 3×, from each game's start), the Interregnum's young stars brighten and swell into
  red giants that swallow the worlds inside them, the Hawking temperature rises as 1/M, each star's
  lifetime in the system panel and Star types, and a forecast when a Thread of 25% or more of our
  people falls below 25 standing. A rule change: the harness within the noise (CHANGELOG). The
  browser checks now run three at a time (`--lanes=3`), the harness in four parts: a batch's
  validation took about an hour instead of two. Live at both addresses as `4865f2e`, script
  `index-DkGIjP_M.js`.

- **Room for saves, thin gas, nebulae up close, worlds drawn apart, the reveal before the events,
  a pact's price and flare turns** (1 Nov, PR m1omg/Steliterate#57): save slots in IndexedDB
  (`slotdb.ts`) and Export and delete all saves; new Interregnum games begin with few nebulae (thin
  gas, `Primary.condenseAt`); a nebula up close is a cloud (`nebulaCloud.ts`); the research grid's
  first column is the Stelliferous Age; Burns until a precise date; drawn orbits spaced
  (`orbits.ts`); an event waits for a survey reveal, and Settings, Open charted systems; a pact
  offer's price as it is now; and in a turn a flare's clock cuts short people cost for its time too
  (`clockShare`; the player's save in `tools/saves/`). A rule change: the harness within the noise.
  Live at both addresses as `c1234ad`, script `index-CYMqytMv.js`.

- **Synthwave for the Twilight Interregnum's and the Long Dusk's films, faster browser checks**
  (2 Nov, PR m1omg/Steliterate#58): both films' music rewritten as synthwave (Aeolian, the analog
  lead, the sequencer; the Interregnum wistful with a kick and a new gated snare in its middle,
  the Dusk dark and drumless). The browser checks: a small fix runs only those it touches
  (CLAUDE.md, "Which browser checks"), and the slowest trimmed. Live at both addresses as
  `bd3eeab`, script `index-CwuzIw_v.js`.

- **Real synthwave for the two films, and the Long Dusk's film in a game begun in the Interregnum**
  (3 Nov): "redo the music once more in a more real synthwave style"; asked, a full beat in both and
  "The Midnight / Kavinsky". The score engine gained chords on the bar (`prog`), a drum machine
  (`beat`), a rolling synth bass, a sidechain pump, an echo and stabs on the cuts, used only by
  these two scores (the other 16 films compose the same events as before). And "redo the video for
  the start of the long dusk when you start the twilight interregnum" (it showed a home world round a
  red dwarf, gone by then): the Last Gas now plays the Long Dusk's film in that game's own cut (our
  first star a white dwarf, our first world frozen, both by their heat; a world we settled), where
  no film had played. `src/ui/filmArgs.ts`; checks `unit/last-gas-film`, `browser/films`.

## 4. Baselines (2 Nov)

These are from the last validation of a rule change, PR m1omg/Steliterate#57 (1 Nov). PR #58
changed only the films' music and the checks. It ran the unit checks and the browser checks it
touches.

| | The game |
|---|---|
| tsc, build | clean |
| Playtest | passes (30/144 Hz parity) |
| savecompat | 11 saves (the player's turn-52 flare save among them) |
| Unit checks | 114 (`last-gas-film`, 3 Nov) |
| Browser checks, real fonts | 81 |
| 300 games (survive / victories / Degenerate Age turns) | 181 / 69 / 102 |
| By fate | decay 109 / 148, stable 30 / 81, curvature 42 / 71 |
| 300 at Harsh | 148 / 29 / 92 |
| 300 begun in the Interregnum | 186 / 74 / 109, 297 of them reaching the Dusk |
| 900 games | 444 / 160 / 70 (15 Oct, not run since) |

- **Noise:** with real neighbours, two runs of the same rules can differ by 32 survivors and 37
  victories in 900. Measure a reshuffle before calling a change of that size a cost.
- **The old game, frozen,** is no longer validated. Its last harness run was 228 / 78 / 113 of 300
  (26 Oct).
- The full history is in CLAUDE.md and in DEV-NOTES, "Balance reference".

## 5. The player (m1omg)

The full picture is in SESSION-NOTES, "How the player likes to work".

- **Language.** They are Slovak, and write in English, often by dictation. Read through misheard
  words: "diploma's screen" meant the diplomacy screen.
- **They play while you work,** on a PC, a phone and a tablet, in Firefox, Chrome and Vivaldi.
  - A deploy must never break an open game or a save.
  - Each report from play is a bug: confirm it in the code before answering.
  - They upload their own saves when something is wrong. "Retrospectively too" means the fix must
    reach games already begun.
- **Physics questions** want the mechanism, the numbers and the dates, and every place the game
  bends physics, said plainly. Offer a fix for a bend; don't make one unasked.
- **Spoiler-light.** Never spoil the Lattice's story or ending, or the stranger minds. Say nothing
  about an age they have not reached, unless they ask.
- **Saves and seeds are sacred:**
  - optional fields only, small counters in `civ.flags`, and `migrate()`;
  - generation consumes the RNG exactly as before;
  - `tools/saves/` covers the game's saves.
- **Discuss first** before a Lattice rework, deeper diplomacy, or other civilizations beyond what
  was asked. The Unlit's quest line stays word for word: extend it, never reduce it.
- **"Always. You merge pls."** Once a batch is validated, open the PR into `main` and merge it
  yourself, with a merge commit. Since the switch, every batch comes from the work branch.
- **Asking.**
  - For a real choice, ask with options. Mark one "(Recommended)", and give each a one-line
    consequence.
  - They answer quickly, often adding a condition in their own words: honour it exactly.
  - They have also said: "please don't ask me questions unless it's something absolutely
    crucial".
- **Music and films.**
  - Their taste is dark ambient synthwave.
  - The films have "a bit of Terminator 1 synth … not a full style overwhelm".
  - On 2 Nov they found two scores "too unsynthwave, happy … like for a fantasy game". Keep major
    modes, flutes, horns and harps out of the dark films.
  - They see or hear generated music and films before these go in. Measure a recorded track with
    `tools/music/movement.py`, and a film's cue with `tools/cue-levels.mjs`.
  - Send films as videos, and the endings only when asked.
- **More than one session at a time.** Before anything else, `git fetch` every branch and look for
  pushed commits no PR has taken in: `git log origin/main..origin/<branch>`.

## 6. Waiting for the player, likeliest first

Start none of these without their word.

1. **The Dark Era brainstorm** (4 Nov): nine ideas offered, none built, the player to pick any
   (SESSION-NOTES, "Open threads": the ladder of odds and its rungs).
2. **The other 16 films as videos** (offered 2 Nov). Use `tools/film-render.mjs`, one film at a
   time. Each takes about 10 minutes at 1080p here.
3. **Firefox.**
   - The container has no Firefox; software-drawn Chromium stands in for it.
   - The player said Firefox ran the films "very slow". That was before the fixes of 15 Oct;
     how they play there now is not known.
4. **Offers with no answer** (12 and 13 Oct, and the audit of 31 Oct):
   - pulsar beams in line with real pulsars, or a stated bend;
   - Burst Catchers in neighbouring systems banking a share of a burst at η 68;
   - a rogue world's Coldminds at the dark-sky half upkeep;
   - the two rogue-world bends, stated in the Codex or changed: close passes 25 times slower, and
     evaporation casting out about half;
   - the neighbours' new-star rules and the Last Star.
5. **Planned and approved, not built** (the audit of 31 Oct):
   - the Lancer and the Penrose Corsair ("deferred, not dropped");
   - a slow-crossfade version of the films for players who ask for reduced motion.

   **Offered for later:** a battle fought by hand, focus fire on a chosen ship, and a retreat
   threshold in a tactic.
6. **Left as they are by the project check** (15 Oct), each the player's choice:
   - A slow device steps a film's resolution down and never back up. A slow first few seconds can
     leave the whole film at half resolution.
   - A build tool, `source-map-js`, has a reported flaw (a slow parse of a hostile source map). It
     is used only to build and never shipped, and nothing here reads one.
7. **A Slovak translation of our own.** Planned on 10 Oct, not started. The plan:
   - a glossary first;
   - side-by-side review sheets;
   - everything live at once;
   - about 40,000 words.

   SESSION-NOTES, "Picking up", has the rest.
8. **Krea:** a second Dark track to replace the old drone. Measure it and let them hear it before
   it goes in.
9. **The friend's word on the magnifier mode** (`?lowvision`). Not built: read-aloud, moving the
   camera from the keyboard, and reduced motion for camera flights.
10. **From 11 Oct, each to raise:**
    - the autoplayer researches Halo Siphons and never shuts them;
    - ember restraint at a halo dwarf;
    - only the Unlit's messages wait.
11. **A Godot proposal** (26 Oct, from another session): `GODOT PROPOSAL 1.MD` on
    `claude/vibrant-edison-svhjtd`.
    - It proposes the game as a desktop game in Godot, with better graphics.
    - It is not approved, nothing is built, and no PR has taken it in.
    - Read it if the player raises it.
12. **The discuss-first list** (SESSION-NOTES, "Picking up"):
    - a Lattice rework;
    - deeper diplomacy;
    - tidal locking by locking time;
    - the flare's step at `blueAt`;
    - the helium stars' single set of numbers;
    - collectors after the Stelliferous era.

Done and off this list: the switch (27 Oct), the gone civilizations' answers (PR
m1omg/Steliterate#53), and the films' second cut, which the films of 1 and 2 Nov overtook.

## 7. Working in a fresh container

1. Run `npm ci`.
2. Make the local copy of the game's fonts. The layout checks measure text in the real faces only
   with `STEL_FONTS` (DEV-NOTES, "The game's fonts in this container", a curl recipe).
3. Recreate DEV-NOTES' helpers in the scratchpad:
   - serve the build for one command;
   - 900 games in three slices, with the tally by fate;
   - compare two runs game for game.

   The harness also splits in four: four
   `npx tsx tools/sim.ts 75 standard competent --from=N` (N = 0, 75, 150, 225), run at once, give
   300 games in about 2.5 minutes.
4. **Validate** with the list in CLAUDE.md, in this order:
   1. tsc and the build.
   2. `vite preview` on :4173, in the background with the longest limit (two hours). Start it
      afresh before a full browser run.
   3. The playtest.
   4. savecompat.
   5. `npm run check`.
   6. The browser checks, with `STEL_FONTS`, as "Which browser checks" says (§0):
      - three lanes (`--lanes=3`);
      - nothing else running beside them.
5. **A rules change:** run the harness against the previous rules and compare game for game.
   - The previous rules: a `git worktree` of the old commit, with `node_modules` symlinked.
   - Runs: 300 standard, 300 at `--diff=harsh`, and 300 with `--interregnum`.
   - A display-only change must leave every game identical.
6. **Go live** as §0 says. PRs and merges go through the GitHub MCP tools, or `gh` where the
   container has it.
7. **Films and music:**
   - `node tools/film-render.mjs <film> <out.mp4> --size=1920x1080 --fps=30 --jpeg --ffmpeg=<path>`
     renders a film.
     - It runs on a fixed port (5179), so render one film at a time.
     - ffmpeg comes from `pip install imageio-ffmpeg`.
     - Give an absolute output path in the scratchpad.
   - `node tools/cue-levels.mjs [film…] [--stems]` measures each cue's peak and loudness.
   - Send the player a preview before shipping.
8. **Write it down:**
   - a CHANGELOG entry with the balance figures;
   - DEV-NOTES: the systems, the checks, a balance row;
   - SESSION-NOTES: the decision in the player's words, and "Picking up";
   - this file;
   - CLAUDE.md's PR list.

## 8. Traps that cost time

The full list is in DEV-NOTES, "Gotchas".

- **A container restart stops every background run and server without a word.** The working
  trees survive, and the scratchpad too. Check `git status`, the worktrees and the servers first,
  and run again whatever stopped short. It happened on 15 Oct, mid-suite.
- **A background command stops at 30 minutes by default, and two hours at most** (`timeout`
  7200000).
  - The preview server stopped at its two hours mid-suite twice on 1 Nov. Every check after that
    failed at once ("no server").
  - Start it afresh before a full browser run.
- **Nothing else beside the lanes.** An extra browser starves them: screenshots time out, and
  checks fail that pass alone. Before calling a failure real, rerun that check alone.
- **The software renderer (SwiftShader):**
  - It can fall below 10 frames a second under load. Checks poll until things settle; they never
    trust one fixed wait.
  - It draws the nebula cloud at Low (`cloudQuality`, `src/render/nebulaCloud.ts`).
  - A shot of a system must wait for `engine.view === 'system'` and for the camera to settle, or
    it catches the zoom on its way in.
- **A tool that starts Vite through `npx` leaves it running** after it is killed, holding its port:
  the render and levels tools start Vite itself since 3 Nov; do the same in a scratch tool (DEV-NOTES).
- **`pgrep -f` and `pkill -f` match their own shell.** Find a PID with a pattern that cannot match
  itself (`ps -eo pid,args | grep "[v]ite.js preview"`), or by its port.
- **The stop hook** won't let a turn end with uncommitted, untracked or unpushed changes.
  - Keep scratch files outside the clone.
  - A tool given a relative output path writes into the clone: give it a scratchpad path.
  - A worktree's `node_modules` symlink shows as untracked there: add files by name.
- **`main` and `next` share one Pages workflow, which builds both.**
  - A push to either rebuilds both addresses. It cancels a run in progress, so wait for one to
    finish before pushing the other.
  - `gh-pages` is the workflow's own deploy branch, and `claude/lucid-newton-30cbpk` is frozen at
    `fc6c59a`: never push to either.
  - Never edit `public/archive/`.
- **Unit checks have no Node types.** A check that reads a file uses `process.getBuiltinModule`,
  declared as `tools/savecompat.ts` does (see `unit/flare-turns`).
- **A check about the order of timers, under load:** waits between its steps stretch when the page
  is busy, and it then passes on the very bug it was written for. Make the steps that must come
  before a timer synchronous, then wait (DEV-NOTES).
- **The GitHub connector can drop mid-session,** and usually comes back within a minute. If it
  stays away, `gh` (where the container has it) does the same work through the session's proxy:
  PRs, merges, workflow runs.
- **`protonFate` is `'decays'`, not `'decay'`.** `tsx` runs a check without type-checking it, so
  run `tsc` too.
- **Worlds in a late save are often rogue already.** A check that means a bound world sets `rogue:
  false` first.
- **An `rm` of a path built from variables** is blocked by a safety check: write `"${VAR:?}"/…`.
- **Layout checks need the real fonts** (`STEL_FONTS`).
- **Manual and Codex strings are single-quoted.** Write ’ in prose: a straight `'` breaks the
  build.
- **A seeded browser check rides its game's course,** so a rules change can move it. Set the
  situation up rather than hope for it.
- **The player's own saves are not in the repository.** Ask them to upload one if you need it.
  Commit one only as a check's fixture, as was done with the turn-52 flare save (1 Nov).
