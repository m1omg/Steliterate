# Steliterate

A turn-based survival strategy game at the end of starlight. Your civilization begins on a
dying, tidally locked world around one of the last red dwarfs, about 90 trillion years after
the Big Bang, and has to outlast the universe: the Last Light, the Degenerate Age of dead
stars, the Black Hole Age, and the Dark Era beyond 10^100 years.

The dying universe is the antagonist. You are not alone in the Coalescence, the one galaxy
left in reach, but the other minds are part of the world rather than rivals on a scoreboard:
the Hunger (mindless replicators that eat everything), fellow survivors, the Slow Ones,
sleepers in their vaults, and something in the dark matter.

## Playing

New to it? Leave **Guide me** on when you start a game: a short guide walks you through the
first turns. The Codex (K) opens on **How to play**, the full manual.

- **End Turn** (or Enter). Every turn covers more cosmic time than the last. The chips above
  End Turn list anything still waiting for you.
- **Pace**: quicken for more decisions while a short-lived source burns; slow down for more
  energy per turn. Slowing only pays for minds that can slow themselves (Echoes, Coldminds).
- **Sleep / Long Sleep**: dormancy cuts upkeep to a tenth while energy still comes in.
- Click a star to select it. To look inside: double-click it, tap it again on a touchscreen,
  press **Look inside**, or just zoom in on it (zooming heads toward the pointer); zoom back
  out past the edge of a system to return to the galaxy. Click a planet to select it and
  double-click it (or tap it) to fly there: it stays in focus as it orbits until you pick
  another world or double-click the star. System and planet panels list the system's worlds,
  one click each. Double-click a fleet (or tap it twice) to follow it; **Centre** in its panel
  keeps it in the middle of the map without zooming in. **V** switches the view: Natural,
  Enhanced (light amplification for the dark ages) or Thermal (false colour by temperature).
  Probes can **Auto-explore**: they keep charting the nearest unsurveyed star.
  Any ship charts the systems it reaches; probes are just cheap, far-sighted and can explore
  by themselves. A planet panel's Ruins row and its find chips reopen that survey report.
  A ship at the edge of the map spots the nearest unseen stars (probes three, other ships
  one), even across the gaps between star clusters. On the map, a pale
  ring marks a surveyed system and a green one a living world; dim italic names are stars
  not yet surveyed. **Pause** (or P)
  holds the orbits still. Unsurveyed systems show only their star until a probe charts them.
- **Settling**: a System Lighter (no research) carries a family to another world of the same
  star; Kin Arks, Seedcores and the rest cross between stars. Systems (S: your settlements and
  every surveyed world) and Fleets (F) on the left rail list everything you have. **Choose on
  map** sends a ship to any star you click. Trip times read "~26t · 2.9 Myr": turns at your pace, then the flight's cosmic time
  (nothing outruns light; the turns just keep getting longer). Forecast turn counts follow
  the pace too.
- **Other civilizations**: once you have made contact you can send aid or **Ask for help**; the
  answer (and any energy, by beam) comes back after the light-speed round trip, and depends on
  their goodwill, their fortunes and what you gave them. A warship parked at one of their stars
  can **Raid** them for part of their reserve. It costs you their trust, everyone else's
  good opinion, and some of your own people's; they may come back for it.
- **Where to settle**: the Surveyed worlds list (W) sorts by what each kind of mind needs
  (Habitable/Room for Kin, Power for Echoes, Matter for the Lattice, Lasting for Coldminds),
  and each settler ship ranks its landing sites the same way.
- **Research**: overflow and found knowledge carry into the next project. You can pause
  research to save the labs' power; only half of each turn's insight is kept while paused.
- Watch the **Forecasts** (bottom left, closable) and the **Chronometer** (top): they tell
  you what is coming and roughly when.
- Keys: Enter end turn · R research · S systems · F fleets · T threads · C charters ·
  G signals · L the Record · K Codex · W surveyed worlds · H home · P pause orbits · Esc close.
  In the magnifier mode, N goes to what needs attention next, B to a settlement's Build tab, and
  M folds the column away.
- **The keyboard**: Tab moves through the buttons and lists, and Enter or Space presses the one
  in focus. Enter ends the turn only when nothing has the focus.
- **Magnifier mode**, for low vision and screen magnifiers (Menu → Magnifier mode; before a game,
  Settings on the main menu). It puts the panels in one column beside the map, offers two larger
  interface sizes (1.6× and 2×), stronger contrast and plainer type, and draws the map's names
  and stars larger. To open the game with it on, add `?lowvision` to the address:
  https://m1omg.github.io/Steliterate/?lowvision

Settings has a **Music track** picker: any track by hand, or Automatic to follow the age.

Saves stay in your browser: as many named save slots as it will hold (Save / load on the rail), plus a quick save and the autosave. To keep a game safe or move it to another device, export it as a file and import it there; a save code does the same as pasteable text. Old saves load in newer versions.

## Development

```sh
npm install
npm run dev          # Vite dev server
npm run build        # type-check and build to dist/
npm run sim -- 12 standard competent --diff=standard   # headless balance harness
node tools/playtest.cjs http://localhost:4173/ shots  # Playwright playtest against `vite preview`
node tools/process-art.mjs                             # grade art-src/*.png into public/art/*.webp
```

- `src/game/`: the simulation, pure TypeScript and deterministic (seeded). `sim/turn.ts` runs
  a turn; `data/` holds techs, structures, charters, events and endings.
- `src/render/`: Three.js galaxy and system views and the post-processing chain. Everything
  animates on elapsed time, so the game plays the same at 30 Hz and 144 Hz (the playtest
  checks this).
- `src/ui/`: Preact interface. `src/audio/`: recorded tracks with a procedural Web Audio score
  as fallback, and synthesised interface sounds.
- `docs/DESIGN.md`: the design. `docs/CHANGELOG.md`: what changed, commit by commit.
  `docs/DEV-NOTES.md`: workflow, tests, where the systems live. `docs/SESSION-NOTES.md`:
  decisions, answered questions and open threads. `docs/spoilers/dark-matter.md`: spoilers.

## Credits

Designed and built with Claude Code, with ideas and speculation notes from the co-designer.
Painted plates generated with Krea (Nano Banana Pro) and Codex image generation; music for the
Dusk and the Degenerate Age generated with ElevenLabs Music via Krea. The Degenerate Age opens with
Pachelbel's Canon in D (public domain), arranged and synthesised for the game by
`tools/music/canon.py` in the spirit of Barry Leitch's 1991 Amiga version for Utopia. Science after Adams &
Laughlin (1997), Dyson (1979), Krauss & Starkman (2000) and Krauss & Scherrer (2007); see the
in-game Codex.

Licensed under the GNU GPL v3.
