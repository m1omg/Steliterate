// Rules no text told of (19 Oct; the player: "Fix the bugs, document the rest"):
// - a met demand lifts a Thread toward 80, and no longer pulls one above it down to 80;
// - a grown point is paid for only when it becomes a person (it was paid for even with no room,
//   and lost);
// - the energy, matter and insight a settlement's spare work makes are in the coming turn's
//   figures, and in the energy net the turn reports (they went into the stores unreported);
// - the Expansion Mandate, a charter the code named and the book did not have: ships 20% less
//   industry.
// (The other two, written into the Manual: starvation strikes three settlements a turn at most;
// without Merge Consent merges can repeat within a turn.)
import { CHARTER_BY_ID } from '../../../src/game/data/charters';
import { SHIP_BY_ID } from '../../../src/game/data/ships';
import { newGame } from '../../../src/game/newGame';
import { buildCost } from '../../../src/game/sim/actions';
import { capacity } from '../../../src/game/sim/economy';
import { computeMods } from '../../../src/game/sim/mods';
import { project, spareLeft } from '../../../src/game/sim/projection';
import { updateSociety } from '../../../src/game/sim/society';
import { spareYield } from '../../../src/game/sim/spare';
import { growth, type CivTurn } from '../../../src/game/sim/turn';
import { colonies } from '../../../src/game/sim/util';
import type { GameState } from '../../../src/game/types';
import { check, done } from '../lib';

const fresh = () => newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable', civsAsleep: true }) as GameState;

// ---- a met demand above 80
{
  const s = fresh();
  s.civ.standing.kin = 90;
  // a demand the book does not know is met by default (society.ts: demandMet)
  s.civ.demands.kin = 'always_met';
  s.civ.flags.demand_age_kin = 0;
  updateSociety(s, 1.6, 0, false);
  check(s.civ.standing.kin > 88, `Kin at 90 whose demand is met stay there (${s.civ.standing.kin.toFixed(2)}; they were pulled down to 80)`);
  const t = fresh();
  t.civ.standing.kin = 70;
  t.civ.demands.kin = 'always_met';
  t.civ.flags.demand_age_kin = 0;
  updateSociety(t, 1.6, 0, false);
  check(t.civ.standing.kin > 70.5 && t.civ.standing.kin <= 71.2 + 1e-9, `below 80 it still rises by up to 1.2 (70 → ${t.civ.standing.kin.toFixed(2)})`);
}

// ---- growth paid for only with room
{
  const s = fresh();
  const c = colonies(s)[0];
  // a Lattice Foundry, so there is Lattice room to have or not
  c.structures.lattice_foundry = 1;
  const mods = computeMods(s);
  const cap = capacity(s, c, mods);
  const turn = { mods, starving: true, popsLost: 0 } as unknown as CivTurn;
  c.pops.lattice = cap.lattice;
  c.growth.lattice = 1;
  s.civ.matter = 50;
  growth(s, turn);
  check(s.civ.matter === 50 && c.pops.lattice === cap.lattice && c.growth.lattice === 1, `with no room the grown Lattice point waits, unpaid (matter ${s.civ.matter}, Lattice ${c.pops.lattice} of ${cap.lattice})`);
  c.pops.lattice = Math.max(0, cap.lattice - 1);
  growth(s, turn);
  check(s.civ.matter === 47 && c.pops.lattice === cap.lattice && c.growth.lattice === 0, `with room it becomes a Lattice, for its 3 matter (matter ${s.civ.matter})`);
}

// ---- spare work in the figures
{
  const s = fresh();
  for (const c of colonies(s)) c.queue = [];
  const c = colonies(s)[0];
  c.spare = 'salvage';
  const p = project(s);
  const t = p.perColony[c.id];
  const sp = spareYield(s, c, spareLeft(c, t.y.industry), t.y.energy);
  const bare = colonies(s).reduce((a, x) => a + p.perColony[x.id].y.matter, 0);
  check(sp.matter + sp.energy > 0 && Math.abs(p.matterIn - bare - colonies(s).reduce((a, x) => a + spareYield(s, x, spareLeft(x, p.perColony[x.id].y.industry), p.perColony[x.id].y.energy).matter, 0)) < 1e-9, `the coming turn's matter counts what spare work salvages (${sp.matter.toFixed(2)} at ${c.name})`);
  c.queue = [{ kind: 'structure', key: 'commons', cost: 1e9, progress: 0 }] as typeof c.queue;
  check(spareLeft(c, t.y.industry) === 0, 'a settlement busy with its queue has nothing left over for spare work');
}

// ---- the Expansion Mandate
{
  const s = fresh();
  const def = CHARTER_BY_ID.expansion_mandate;
  check(!!def && def.tech === 'fusion_drives' && def.cost === 20, `the Expansion Mandate is in the book (${def?.name}: ${def?.effect})`);
  const ark = SHIP_BY_ID.ark;
  const before = buildCost(s, ark, true).industry;
  s.civ.charters.push('expansion_mandate');
  const after = buildCost(s, ark, true).industry;
  check(after === Math.round(ark.cost * 0.8) && after < before, `under it a Kin Ark costs ${after} industry, not ${before}`);
}

done('UNWRITTEN');
