// Headless balance harness: autoplay whole games and report how far each strategy gets.
declare const process: { argv: string[] };
// Usage: npm run sim -- [games=4] [length=standard] [strategy=both] [--diff=standard] [--fate=decays|stable|curvature] [--from=0] [-v]
// Game g uses seed 1000 + g·7919; --from=N starts at game N, so runs can be split and run in parallel.

import { autoPlay, type Strategy } from '../src/game/auto';
import { formatEta } from '../src/game/eras';
import { newGame } from '../src/game/newGame';
import { endTurn } from '../src/game/sim/turn';
import { colonies, threadTotals, totalPops } from '../src/game/sim/util';
import type { EpochLength, ProtonFate } from '../src/game/types';
import { fateOf } from '../src/game/fate';

// positional arguments, with the flags (-v, --diff=…) taken out wherever they stand
const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const games = Number(args[0] ?? 4);
const length = (args[1] ?? 'standard') as EpochLength;
const which = args[2] ?? 'both';
const strategies: Strategy[] = which === 'both' ? ['competent', 'passive'] : [which as Strategy];
const verbose = process.argv.includes('-v');
const from = Number(process.argv.find((a) => a.startsWith('--from='))?.slice(7) ?? 0);

for (const strategy of strategies) {
  console.log(`\n=== ${strategy} · ${length} ===`);
  for (let g = from; g < from + games; g++) {
    const seed = 1000 + g * 7919;
    const difficulty = (process.argv.find((a) => a.startsWith('--diff='))?.slice(7) ?? 'standard') as 'gentle' | 'standard' | 'harsh';
    const protonFate = (process.argv.find((a) => a.startsWith('--fate='))?.slice(7) ?? 'unknown') as ProtonFate;
    const state = newGame({ seed, length, survivors: 3, difficulty, protonFate });
    const eraTurns: Record<string, number> = {};
    let crossings = '';
    const t0 = Date.now();
    let guard = 0;
    while (!state.outcome && guard++ < 1200) {
      autoPlay(state, strategy);
      const r = endTurn(state);
      eraTurns[state.era] = (eraTurns[state.era] ?? 0) + 1;
      if (r.crossing) {
        crossings += ` [${r.crossing.from}->${r.crossing.to} pops ${r.crossing.popsBefore}->${r.crossing.popsAfter}]`;
      }
      if (verbose && state.turn % 20 === 0) {
        const t = threadTotals(state);
        console.log(
          `  t${state.turn} ${state.era} η${formatEta(state.eta, state.era)} pace ${state.civ.pace} col ${colonies(state).length} pops ${totalPops(state)} (k${t.kin} e${t.echoes} c${t.chorus} l${t.lattice} cm${t.coldminds} cryo) E ${state.civ.energy.toFixed(0)} (net ${(state.civ.flags.last_energy_net ?? 0).toFixed(1)}) M ${state.civ.matter.toFixed(0)} R ${state.civ.resolve.toFixed(0)} D ${state.civ.dissent.toFixed(0)} techs ${state.civ.techs.length} gfe ${(state.gfe * 100).toFixed(0)}% swarms ${Object.keys(state.swarms).length}`,
        );
      }
    }
    // each neighbour: alive or its fate, and +N for every star it settled beyond its first
    const sv = Object.values(state.survivors)
      .map((s) => `${s.adjective}:${s.alive ? 'alive' : s.fate}${s.systems.length > 1 ? `+${s.systems.length - 1}` : ''}`)
      .join(' ');
    console.log(
      `seed ${seed}: ${state.outcome ? `${state.outcome.kind.toUpperCase()} "${state.outcome.ending}"` : 'unfinished'} at turn ${state.turn} (${state.era}, η ${formatEta(state.eta, state.era)}) turns/era ${JSON.stringify(eraTurns)} pops ${totalPops(state)} techs ${state.civ.techs.length} taint ${state.civ.taint.toFixed(0)} halo ${state.minds.dark.stage} fate ${fateOf(state)} gfe ${(state.gfe * 100).toFixed(0)}%${crossings} | ${sv} | ${Date.now() - t0}ms`,
    );
  }
}
