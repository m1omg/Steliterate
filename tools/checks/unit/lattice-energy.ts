// The Lattice after matter (the player, 13 Oct: "there should be a way to continue with Lattice
// even with just energy"):
// - while there is matter, a Lattice mends itself with matter, and without any one wears out a turn;
// - once matter is gone, its repairs are paid in energy (MATTER_AS_ENERGY for each unit of matter,
//   as building is), it grows from energy, and only an empty reserve wears one out.
import { newGame } from '../../../src/game/newGame';
import { THREAD_DEFS } from '../../../src/game/data/threads';
import { MATTER_AS_ENERGY } from '../../../src/game/sim/economy';
import { runCrossing } from '../../../src/game/sim/crossing';
import { createColony, deepFor } from '../../../src/game/sim/fleets';
import { computeMods } from '../../../src/game/sim/mods';
import { project } from '../../../src/game/sim/projection';
import { endTurn } from '../../../src/game/sim/turn';
import { colonies } from '../../../src/game/sim/util';
import type { Colony, GameState, ThreadId } from '../../../src/game/types';
import { THREADS } from '../../../src/game/types';
import { check, done } from '../lib';

const pops = (p: Partial<Record<ThreadId, number>>) => Object.fromEntries(THREADS.map((t) => [t, p[t] ?? 0])) as Record<ThreadId, number>;
const said = (s: GameState, re: RegExp) => s.civ.log.some((l) => re.test(l.text));

// while there is matter: a Lattice with none to mend itself wears out
{
  const s = newGame({ seed: 1000, survivors: 3, civsAsleep: true });
  const cap = s.colonies[s.civ.capitalId!];
  for (const c of colonies(s)) for (const k of ['mine', 'hydrogen_skimmer', 'brown_siphon', 'stellar_lifter']) delete c.structures[k];
  cap.pops.lattice = 3;
  cap.structures.lattice_foundry = 1;
  // (all its industry into one long project: nothing to spare for salvage)
  cap.queue = [{ uid: 'qlong', kind: 'structure', key: 'foundry', progress: 0, cost: 99999 }];
  s.civ.matter = 0;
  endTurn(s);
  check(cap.pops.lattice === 2 && said(s, /Without matter for repairs, a Lattice at/), `while there is matter, a Lattice with none for its repairs wears out (${cap.pops.lattice} left)`);
}

// the Great Decay, with a vault of the Lattice at a black hole
const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'decays', civsAsleep: true });
s.era = 'degenerate';
s.civ.techs.push('leptonic_computation', 'penrose_process');
for (const c of colonies(s)) {
  s.bodies[c.bodyId].colonyId = null;
  delete s.colonies[c.id];
}
const hole = Object.values(s.systems).find((x) => x.primary.kind === 'black_hole' && !x.gone && x.primary.spin > 100)!;
const vault: Colony = createColony(s, deepFor(s, hole)!, {});
vault.pops = pops({ lattice: 2 });
vault.structures = { lepton_substrate: 3 };
s.civ.capitalId = vault.id;
s.civ.energy = 400;
// (before the end, the same vault mends with matter)
const before = project(s).perColony[vault.id].y;
runCrossing(s, [s.player], { [s.player]: computeMods(s) });
check(s.flags.matter_gone !== undefined && vault.pops.lattice === 1, `the Great Decay: matter is gone, and the vault goes on with half its Lattice (${vault.pops.lattice})`);
// (a harvester on its hole's spin, built since)
vault.structures.penrose_harvester = 1;
const after = project(s).perColony[vault.id].y;
const repairs = THREAD_DEFS.lattice.matterUpkeep;
check(Math.abs(before.matterUpkeep - 2 * repairs) < 1e-9 && after.matterUpkeep === 0, `its repairs no longer ask for matter (${before.matterUpkeep.toFixed(2)} a turn for two before; ${after.matterUpkeep} after)`);
check(Math.abs(after.energyUpkeep - before.energyUpkeep / 2 - repairs * MATTER_AS_ENERGY) < 0.02, `they are paid in energy, ${MATTER_AS_ENERGY} for each unit of matter: ${(after.energyUpkeep - before.energyUpkeep / 2).toFixed(2)} more a turn for its one Lattice`);

// it grows from energy, and none wears out while the reserve holds
{
  const l0 = vault.pops.lattice;
  for (let i = 0; i < 12 && !s.civ.outcome; i++) endTurn(s);
  check(vault.pops.lattice > l0 && s.civ.matter >= 0 && !said(s, /wore out/), `after matter the Lattice grows from energy, and none wears out (${l0} → ${vault.pops.lattice}, matter ${s.civ.matter})`);
}

// only an empty reserve wears one out
{
  const l0 = vault.pops.lattice;
  delete vault.structures.penrose_harvester;
  s.civ.energy = 0;
  endTurn(s);
  check(vault.pops.lattice === l0 - 1 && said(s, /Without energy for repairs, a Lattice at/), `with the reserve empty one wears out (${l0} → ${vault.pops.lattice})`);
}
done('LATTICE ENERGY');
