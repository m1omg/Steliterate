// A game in the Dark Era for the unit checks (7 Nov): one settlement of ours at a black hole, leptonic, six Echoes and four Coldminds, at η 10^100.5 (λ 2), its Continuity whole.
import { newGame } from '../../src/game/newGame';
import { LEAVE_SPIN, runCrossing } from '../../src/game/sim/crossing';
import { createColony, deepFor } from '../../src/game/sim/fleets';
import { computeMods } from '../../src/game/sim/mods';
import { colonies } from '../../src/game/sim/util';
import type { GameSettings, GameState, ThreadId } from '../../src/game/types';
import { THREADS } from '../../src/game/types';
const pops = (p: Partial<Record<ThreadId, number>>) => Object.fromEntries(THREADS.map((t) => [t, p[t] ?? 0])) as Record<ThreadId, number>;
export function darkGame(extra: Partial<GameSettings> = {}, seed = 1000): GameState {
  const s = newGame({ seed, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'decays', civsAsleep: true, ...extra });
  s.era = 'degenerate';
  s.civ.techs.push('leptonic_computation', 'penrose_process', 'error_correction');
  for (const c of colonies(s)) { s.bodies[c.bodyId].colonyId = null; delete s.colonies[c.id]; }
  const holes = Object.values(s.systems).filter((x) => (x.primary.kind === 'smbh' || x.primary.kind === 'black_hole') && !x.gone && x.primary.spin > LEAVE_SPIN);
  const a = createColony(s, deepFor(s, holes[0])!, {});
  a.pops = pops({ echoes: 6, coldminds: 4 });
  a.structures = { lepton_substrate: 2 };
  s.civ.capitalId = a.id;
  s.civ.energy = 40000;
  runCrossing(s, [s.player], { [s.player]: computeMods(s) });
  s.era = 'dark';
  s.eta = 100.5;
  s.years = Math.pow(10, 100.5);
  s.civ.continuity = 100;
  return s;
}
