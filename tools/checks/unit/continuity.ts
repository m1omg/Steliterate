// Continuity in the Dark Era (14 Oct, the player: "make it harder pls"):
// - every turn in the dark costs it 2.2, less where Error-Correction Arrays keep the pattern: a
//   settlement's arrays keep its own minds and sleepers (0.6 an array), and our loss is the mean
//   over our settlements weighed by who is where, so an array elsewhere corrects nothing here
//   (before, every array anywhere multiplied the whole civilization's loss);
// - the Long Sleep leaves 0.35 of it, and the weave halves it for its share of our minds;
// - an empty reserve adds 10 a turn (5 before): nothing is left to correct the errors with;
// - a turn in the dark takes exactly that.
import { STRUCTURE_BY_ID } from '../../../src/game/data/structures';
import { newGame } from '../../../src/game/newGame';
import { DARK_DECAY, DARK_SLEEP, DARK_STARVE, continuityLoss, correctedShare } from '../../../src/game/sim/continuity';
import { LEAVE_SPIN, runCrossing } from '../../../src/game/sim/crossing';
import { createColony, deepFor } from '../../../src/game/sim/fleets';
import { computeMods } from '../../../src/game/sim/mods';
import { endTurn } from '../../../src/game/sim/turn';
import { colonies } from '../../../src/game/sim/util';
import type { Colony, GameState, ThreadId } from '../../../src/game/types';
import { THREADS } from '../../../src/game/types';
import { check, done } from '../lib';

const pops = (p: Partial<Record<ThreadId, number>>) => Object.fromEntries(THREADS.map((t) => [t, p[t] ?? 0])) as Record<ThreadId, number>;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const ARRAY = STRUCTURE_BY_ID.preservation_array.continuityMult!;

/** The Dark Era (η 105): two of our vaults, at two black holes, leptonic, ten minds each. */
function dark(): { s: GameState; a: Colony; b: Colony } {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'decays', civsAsleep: true });
  s.era = 'degenerate';
  s.civ.techs.push('leptonic_computation', 'penrose_process', 'error_correction');
  for (const c of colonies(s)) {
    s.bodies[c.bodyId].colonyId = null;
    delete s.colonies[c.id];
  }
  const holes = Object.values(s.systems).filter((x) => (x.primary.kind === 'smbh' || x.primary.kind === 'black_hole') && !x.gone && x.primary.spin > LEAVE_SPIN);
  const a = createColony(s, deepFor(s, holes[0])!, {});
  const b = createColony(s, deepFor(s, holes[1])!, {});
  for (const c of [a, b]) {
    c.pops = pops({ echoes: 6, coldminds: 4 });
    c.structures = { lepton_substrate: 2 };
  }
  s.civ.capitalId = a.id;
  s.civ.energy = 4000;
  runCrossing(s, [s.player], { [s.player]: computeMods(s) });
  s.era = 'dark';
  s.eta = 105;
  s.years = Math.pow(10, 105);
  const [x, y] = [s.colonies[a.id], s.colonies[b.id]];
  for (const c of [x, y]) {
    c.pops = pops({ echoes: 6, coldminds: 4 });
    c.structures = { lepton_substrate: 2 };
    c.cryo = 0;
    c.queue = [];
  }
  s.civ.continuity = 80;
  return { s, a: x, b: y };
}

// a turn's cost, and what the arrays keep: each settlement's own minds, weighed by who is where
{
  const { s, a, b } = dark();
  check(!!a && !!b && a.id !== b.id && colonies(s).length === 2, 'two vaults of ours in the dark');
  check(near(correctedShare(s), 1) && near(continuityLoss(s, false), DARK_DECAY) && DARK_DECAY === 2.2, `with no arrays a turn costs ${DARK_DECAY}`);
  a.structures.preservation_array = 2;
  const one = correctedShare(s);
  check(near(one, (10 * ARRAY * ARRAY + 10) / 20), `two arrays at one of two equal vaults keep half our minds: ${one.toFixed(3)} of the loss is left (the old rule: ${(ARRAY * ARRAY).toFixed(2)})`);
  b.pops = pops({ echoes: 30 });
  check(near(correctedShare(s), (10 * ARRAY * ARRAY + 30) / 40), 'weighed by the minds in each: the larger vault without arrays loses more of the whole');
  b.pops = pops({});
  b.cryo = 10;
  check(near(correctedShare(s), (10 * ARRAY * ARRAY + 10) / 20), 'sleepers count with the minds: a pattern kept is a pattern kept');
  b.cryo = 0;
  b.pops = pops({ echoes: 6, coldminds: 4 });
  b.structures.preservation_array = 2;
  check(near(correctedShare(s), ARRAY * ARRAY), `arrays everywhere keep everyone, but do not multiply across settlements: ${correctedShare(s).toFixed(2)}, not ${Math.pow(ARRAY, 4).toFixed(2)}`);
}

// the Long Sleep, and an empty reserve
{
  const { s } = dark();
  s.civ.dormant = true;
  check(near(continuityLoss(s, false), DARK_DECAY * DARK_SLEEP) && DARK_SLEEP === 0.35, `the Long Sleep leaves ${DARK_SLEEP} of it`);
  s.civ.dormant = false;
  check(near(continuityLoss(s, true) - continuityLoss(s, false), DARK_STARVE) && DARK_STARVE === 10, `an empty reserve adds ${DARK_STARVE} a turn`);
}

// a turn in the dark takes exactly that: with the reserve in hand, and with it empty
{
  const { s } = dark();
  const before = s.civ.continuity;
  const want = continuityLoss(s, false);
  endTurn(s);
  check(near(before - s.civ.continuity, want), `a turn with the reserve in hand: Continuity ${before} → ${s.civ.continuity.toFixed(2)} (−${want.toFixed(2)})`);
  const e = dark();
  e.s.civ.energy = 0;
  const b0 = e.s.civ.continuity;
  const w0 = continuityLoss(e.s, true);
  endTurn(e.s);
  check(near(b0 - e.s.civ.continuity, w0), `a turn with the reserve empty: Continuity ${b0} → ${e.s.civ.continuity.toFixed(2)} (−${w0.toFixed(2)})`);
}

done('CONTINUITY');
