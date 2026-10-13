// What a settlement is made of (the new version, part 3-1):
// - every settlement is of matter until the end of matter, with the room it always had;
// - at the Great Decay, what goes on is leptonic: Echoes, Coldminds, the Lattice and the Chorus can
//   live there, Kin cannot, awake or asleep, and nothing that only houses Kin can be built there;
// - a Leptonic Confluence gives the Chorus room after matter (decay-proof itself), the protocols
//   carry a Chorus onto it as far as it has room, Echoes merge there, and building one counts as a
//   node for the Chorus's demand;
// - a settlement whose own system dissolves before the end goes on as leptonic at once: its Kin
//   are lost then, and counted once, in the crossing's report;
// - before the end, the autoplayer builds a Leptonic Confluence where its Chorus lives.
import { autoPlay } from '../../../src/game/auto';
import { asCiv } from '../../../src/game/civs';
import { FORMS } from '../../../src/game/data/forms';
import { STRUCTURE_BY_ID, hasOnceEffect } from '../../../src/game/data/structures';
import { newGame } from '../../../src/game/newGame';
import { convert, structureCheck } from '../../../src/game/sim/actions';
import { CARRIED, runCrossing } from '../../../src/game/sim/crossing';
import { capacity } from '../../../src/game/sim/economy';
import { createColony, deepFor } from '../../../src/game/sim/fleets';
import { computeMods } from '../../../src/game/sim/mods';
import { endTurn, handleNotes } from '../../../src/game/sim/turn';
import { allColonies, colonies, formOf } from '../../../src/game/sim/util';
import type { Colony, GameState, ThreadId } from '../../../src/game/types';
import { THREADS } from '../../../src/game/types';
import { check, done } from '../lib';

const pops = (p: Partial<Record<ThreadId, number>>) => Object.fromEntries(THREADS.map((t) => [t, p[t] ?? 0])) as Record<ThreadId, number>;
/** Only these settlements of ours: everything else we had is gone. */
const only = (s: GameState) => {
  for (const c of colonies(s)) {
    s.bodies[c.bodyId].colonyId = null;
    delete s.colonies[c.id];
  }
};

// matter until the end of matter
{
  const s = newGame({ seed: 1000, survivors: 3 });
  const all = allColonies(s);
  check(all.length > 1 && all.every((c) => formOf(c) === 'baryonic'), `every settlement of every civilization begins as matter (${all.length})`);
  const cap = s.colonies[s.civ.capitalId!];
  check(capacity(s, cap, computeMods(s)).kin > 0 && FORMS.baryonic.lives.length === THREADS.length, 'with room for everyone, Kin included');
}

// the Great Decay: what goes on is leptonic
const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'decays', civsAsleep: true });
s.era = 'degenerate';
s.civ.techs.push('great_decay_protocols', 'leptonic_computation', 'mind_merging', 'mind_substrate', 'garden_arks', 'cold_sleep', 'upload');
only(s);
const hole = Object.values(s.systems).find((x) => x.primary.kind === 'black_hole' && !x.gone)!;
const vault: Colony = createColony(s, deepFor(s, hole)!, {});
vault.pops = pops({ kin: 3, echoes: 4, chorus: 3 });
vault.cryo = 2;
vault.structures = { lepton_substrate: 2, lepton_confluence: 2, habitat_dome: 1, cryo_hall: 1 };
const world = Object.values(s.bodies).find((b) => b.kind !== 'deep' && !b.colonyId && b.systemId !== hole.id)!;
const town: Colony = createColony(s, world, {});
town.pops = pops({ kin: 4, echoes: 6, chorus: 3 });
town.structures = { habitat_dome: 2, substrate_core: 2, confluence_node: 1 };
s.civ.capitalId = vault.id;
s.civ.energy = 400;
runCrossing(s, [s.player], { [s.player]: computeMods(s) });
const mods = computeMods(s);
const capv = capacity(s, vault, mods);
check(formOf(vault) === 'leptonic' && !s.colonies[town.id], `what was re-encoded goes on as leptonic; the town of matter is gone (${formOf(vault)})`);
check(vault.pops.kin === 0 && vault.cryo === 0 && capv.kin === 0 && capv.cryo === 0, 'no Kin live there, awake or asleep, and there is no room for them');
const chorus = 3 + Math.min(Math.floor(3 * CARRIED), 2 * 3 - 3);
check(capv.chorus === 6 && vault.pops.chorus === chorus, `its Leptonic Confluences keep its Chorus, and the protocols carried one more onto them (${vault.pops.chorus} of room ${capv.chorus})`);
for (const id of ['habitat_dome', 'garden_ark', 'cryo_hall', 'upload_clinic']) {
  const why = structureCheck(s, vault, STRUCTURE_BY_ID[id]) ?? '';
  check(/Kin are made of matter/.test(why), `${STRUCTURE_BY_ID[id].name} cannot be built there: ${why}`);
}
check(structureCheck(s, vault, STRUCTURE_BY_ID.substrate_core) === null, `room for Echoes can (${structureCheck(s, vault, STRUCTURE_BY_ID.substrate_core) ?? 'yes'})`);
const e0 = vault.pops.echoes;
const c0 = vault.pops.chorus;
check(convert(s, vault.id, 'merge') === null && vault.pops.echoes === e0 - 2 && vault.pops.chorus === c0 + 1, 'two Echoes merge into the Chorus at a Leptonic Confluence, with no Confluence Node');

// a Leptonic Confluence built counts as a node for the Chorus (its demand to grow)
{
  check(hasOnceEffect(STRUCTURE_BY_ID.lepton_confluence) && !!STRUCTURE_BY_ID.lepton_confluence.decayProof, 'the Leptonic Confluence is decay-proof, and does once what a Confluence Node does');
  const g = newGame({ seed: 1000, survivors: 3, civsAsleep: true });
  g.civ.techs.push('leptonic_computation');
  const c = g.colonies[g.civ.capitalId!];
  const n0 = g.civ.flags.chorus_nodes_built ?? 0;
  c.queue = [{ uid: 'qlc', kind: 'structure', key: 'lepton_confluence', progress: 109.999, cost: 110 }];
  endTurn(g);
  check((c.structures.lepton_confluence ?? 0) === 1 && (g.civ.flags.chorus_nodes_built ?? 0) === n0 + 1, `built, it counts as a node built (${g.civ.flags.chorus_nodes_built ?? 0})`);
}

// a system that dissolves before the end: what was re-encoded there goes on as leptonic at once
{
  const g = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'decays', civsAsleep: true });
  g.era = 'degenerate';
  g.civ.techs.push('leptonic_computation');
  only(g);
  const b = Object.values(g.bodies).find((x) => x.kind !== 'deep' && !x.colonyId && g.systems[x.systemId].primary.kind !== 'black_hole' && g.systems[x.systemId].primary.kind !== 'smbh')!;
  const sys = g.systems[b.systemId];
  const keep: Colony = createColony(g, b, {});
  keep.pops = pops({ kin: 5, echoes: 4, lattice: 2 });
  keep.cryo = 3;
  keep.structures = { lepton_substrate: 1, habitat_dome: 2, cryo_hall: 1, mine: 1 };
  const other = Object.values(g.bodies).find((x) => x.systemId === sys.id && x.id !== b.id && x.kind !== 'deep' && !x.colonyId);
  const lost: Colony | undefined = other ? createColony(g, other, { kin: 2 }) : undefined;
  if (lost) lost.structures = { habitat_dome: 1 };
  g.civ.capitalId = keep.id;
  // the decay takes the system (physics.ts): its star and every world in it
  sys.primary.kind = 'void';
  for (const id of sys.bodies) if (g.bodies[id] && g.bodies[id].kind !== 'deep') g.bodies[id].dissolved = true;
  const d0 = g.civ.flags.decay_lost ?? 0;
  asCiv(g, g.player, () => handleNotes(g, [{ systemId: sys.id, kind: 'dissolved' }]));
  const lat = Math.round(2 * 0.5);
  check(formOf(keep) === 'leptonic' && keep.pops.kin === 0 && keep.cryo === 0 && keep.pops.echoes === 4 && keep.pops.lattice === 2 - lat, `${keep.name} goes on as leptonic at once, its Echoes and half its Lattice with it (${JSON.stringify(keep.pops)})`);
  check(!!keep.structures.lepton_substrate && !keep.structures.habitat_dome && !keep.structures.cryo_hall && !keep.structures.mine, `keeping only its Leptonic Substrate (${Object.keys(keep.structures).join(', ')})`);
  check((g.civ.flags.decay_lost ?? 0) - d0 === 5 + 3 + lat + (lost ? 2 : 0) && (!lost || !g.colonies[lost.id]), `its Kin, its sleepers and half its Lattice${lost ? ', and the settlement beside it with no substrate,' : ''} counted lost once, for the crossing’s report (${(g.civ.flags.decay_lost ?? 0) - d0})`);
}

// before the end, a Leptonic Confluence where the Chorus lives
{
  const g = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'decays', civsAsleep: true });
  g.era = 'degenerate';
  g.eta = 30;
  g.civ.techs.push('leptonic_computation', 'mind_merging');
  g.civ.matter = 2000;
  g.civ.energy = 2000;
  const c = g.colonies[g.civ.capitalId!];
  c.pops.chorus = 4;
  c.queue = [];
  autoPlay(g, 'competent');
  check(c.queue.some((q) => q.key === 'lepton_confluence') || (c.structures.lepton_confluence ?? 0) > 0, `the autoplayer, its Chorus living there, re-encodes a Confluence for it before the end (${c.queue.map((q) => q.key).join(', ')})`);
}
done('FORMS');
