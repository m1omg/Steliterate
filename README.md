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

- **End Turn** (or Enter). Every turn covers more cosmic time than the last.
- **Pace**: quicken for more decisions while a short-lived source burns; slow down for more
  energy per turn. Slowing only pays for minds that can slow themselves (Echoes, Coldminds).
- **Sleep / Long Sleep**: dormancy cuts upkeep to a tenth while energy still comes in.
- Click a star to select it, double-click (or **System**) to look inside, click a settlement
  to manage it. The left rail opens Research, Threads, Charters, Signals, the Record, the
  Codex (the science behind it all), Save and Settings.
- Watch the **Forecasts** (bottom left) and the **Chronometer** (top): they tell you what is
  coming and roughly when.

Saves stay in your browser; a save code lets you move a game elsewhere.

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
- `docs/DESIGN.md`: the design. `docs/spoilers/dark-matter.md`: spoilers.

## Credits

Designed and built with Claude Code, with ideas and speculation notes from the co-designer.
Painted plates generated with Krea (Nano Banana Pro) and Codex image generation; music for the
Dusk and the Degenerate Age generated with ElevenLabs Music via Krea. Science after Adams &
Laughlin (1997), Dyson (1979), Krauss & Starkman (2000) and Krauss & Scherrer (2007); see the
in-game Codex.

Licensed under the GNU GPL v3.
