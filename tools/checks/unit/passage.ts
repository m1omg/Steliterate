// The Passage (the new version, part 3-2):
// - once the end of matter can be foreseen and Leptonic Computation is known, a settlement can
//   begin it: a project in its queue, 40 industry and 15 for each structure that crosses over, 5
//   energy for each structure there paid at once; while it is worked the settlement makes 70% of
//   its energy, matter, insight and accord;
// - done, the settlement is leptonic: what has a leptonic form crosses over (an Energy Vault is a
//   Field Store), the rest is taken apart with its matter back, its Kin and sleepers go into the
//   archive as insight, and the Lattice re-encodes at half; only what has a leptonic form can be
//   built there after, and nothing there flows;
// - at the end of matter it keeps all of it, and the reserve it holds; a settlement that only
//   built Leptonic Substrate keeps only that; the rest are lost, each named in the report with who
//   was in it;
// - the autoplayer begins it where it can finish it before the end with a few turns to spare, and
//   not sooner.
import { autoPlay } from '../../../src/game/auto';
import { STRUCTURE_BY_ID, structureLabel } from '../../../src/game/data/structures';
import { newGame } from '../../../src/game/newGame';
import { structureCheck } from '../../../src/game/sim/actions';
import { runCrossing } from '../../../src/game/sim/crossing';
import { PASSAGE_OUTPUT, reserveCapacity } from '../../../src/game/sim/economy';
import { createColony } from '../../../src/game/sim/fleets';
import { nextToFlow } from '../../../src/game/sim/flow';
import { computeMods } from '../../../src/game/sim/mods';
import { ARCHIVE_INSIGHT, PASSAGE_BASE, PASSAGE_ENERGY, PASSAGE_PER, beginPassage, completePassage, passageCheck, passageTerms, turnsToEndOfMatter } from '../../../src/game/sim/passage';
import { project } from '../../../src/game/sim/projection';
import { endTurn } from '../../../src/game/sim/turn';
import { colonies, formOf } from '../../../src/game/sim/util';
import type { Colony, GameState, ThreadId } from '../../../src/game/types';
import { THREADS } from '../../../src/game/types';
import { check, done } from '../lib';

const pops = (p: Partial<Record<ThreadId, number>>) => Object.fromEntries(THREADS.map((t) => [t, p[t] ?? 0])) as Record<ThreadId, number>;
const said = (s: GameState, re: RegExp) => s.civ.log.some((l) => re.test(l.text));

/** The decay foreseen, Leptonic Computation known, the Degenerate Age; our settlements only these. */
function setup(): GameState {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'decays', civsAsleep: true });
  s.era = 'degenerate';
  s.civ.techs.push('leptonic_computation', 'energy_storage', 'deep_storage', 'mind_substrate', 'mind_merging', 'cold_sleep');
  for (const c of colonies(s)) {
    s.bodies[c.bodyId].colonyId = null;
    delete s.colonies[c.id];
  }
  s.civ.energy = 2000;
  s.civ.matter = 0;
  return s;
}
/** A settlement of matter: what it houses and stores has a leptonic form; its domes, mines, arrays and berths do not. */
function town(s: GameState, b = Object.values(s.bodies).find((x) => x.kind !== 'deep' && !x.colonyId && s.systems[x.systemId].primary.kind === 'red_dwarf')!): Colony {
  const c = createColony(s, b, {});
  c.pops = pops({ kin: 6, echoes: 5, chorus: 2, lattice: 4 });
  c.cryo = 2;
  c.structures = { reserve_vault: 2, superconducting_ring: 1, substrate_core: 2, confluence_node: 1, lattice_foundry: 1, habitat_dome: 2, mine: 2, solar_array: 2, cryo_hall: 1 };
  return c;
}

// begun: a project in the queue, its energy paid
const s = setup();
const c = town(s);
s.civ.capitalId = c.id;
check(passageCheck(s, c) === null, `the end of matter foreseen and Leptonic Computation known, ${c.name} can begin the Passage`);
const t = passageTerms(s, c);
check(t.crossing === 7 && t.apart === 7 && t.industry === PASSAGE_BASE + PASSAGE_PER * 7 && t.energy === PASSAGE_ENERGY * 14, `7 structures cross over, 7 are taken apart: ${t.industry} industry, ${t.energy} energy`);
const e0 = s.civ.energy;
check(beginPassage(s, c.id) === null && c.queue.some((q) => q.kind === 'passage' && q.cost === t.industry) && s.civ.energy === e0 - t.energy, 'begun: a project in its queue, its energy paid at once');
check(/under way/.test(passageCheck(s, c) ?? ''), 'and not begun twice');
// worked: the settlement makes less
{
  c.queue = c.queue.filter((q) => q.kind === 'passage');
  const worked = project(s).perColony[c.id].y;
  const q = c.queue.pop()!;
  const idle = project(s).perColony[c.id].y;
  c.queue.push(q);
  check(Math.abs(worked.energy - idle.energy * PASSAGE_OUTPUT) < 1e-6 && Math.abs(worked.insight - idle.insight * PASSAGE_OUTPUT) < 1e-6 && worked.industry === idle.industry, `while it is worked, ${Math.round(PASSAGE_OUTPUT * 100)}% of its energy and insight (${worked.energy.toFixed(1)} of ${idle.energy.toFixed(1)}), its industry all into it`);
}
// done
{
  const research = s.civ.researching;
  const r0 = research ? (s.civ.research[research] ?? 0) : (s.civ.flags.insight_bank ?? 0);
  const m0 = s.civ.matter;
  completePassage(s, c);
  const r1 = research ? (s.civ.research[research] ?? 0) : (s.civ.flags.insight_bank ?? 0);
  check(formOf(c) === 'leptonic', 'done: it is leptonic');
  check(['reserve_vault', 'superconducting_ring', 'substrate_core', 'confluence_node', 'lattice_foundry'].every((k) => (c.structures[k] ?? 0) > 0) && !['habitat_dome', 'mine', 'solar_array', 'cryo_hall'].some((k) => c.structures[k]), `what has a leptonic form crossed over, the rest was taken apart (${Object.keys(c.structures).join(', ')})`);
  check(s.civ.matter === m0 + t.matterBack && t.matterBack > 0, `its matter back: +${t.matterBack}`);
  check(c.pops.kin === 0 && c.cryo === 0 && r1 - r0 === 8 * ARCHIVE_INSIGHT, `its 8 Kin and sleepers went into the archive: +${r1 - r0} insight`);
  check(c.pops.lattice === 2 && c.pops.echoes === 5 && c.pops.chorus === 2, `the Lattice re-encoded at half (${c.pops.lattice}); the Echoes and the Chorus came through whole`);
  check(said(s, /has made the Passage: it is leptonic now/), 'and the Record says so');
  check(structureLabel('reserve_vault', s.systems[c.systemId], formOf(c)).name === 'Field Store' && structureLabel('superconducting_ring', s.systems[c.systemId], formOf(c)).name === 'Deep Field Store', 'its Energy Vaults are Field Stores now, its Deep Storage Ring a Deep Field Store');
  check(structureCheck(s, c, STRUCTURE_BY_ID.reserve_vault) === null && /Made of matter/.test(structureCheck(s, c, STRUCTURE_BY_ID.mine) ?? '') && /Kin are made of matter/.test(structureCheck(s, c, STRUCTURE_BY_ID.habitat_dome) ?? ''), 'only what has a leptonic form can be built there');
  check(nextToFlow(c) === null, 'and nothing there will flow');
}

// the end of matter: it keeps all of it; one with only substrate keeps that; the rest are lost, named
{
  const keep = reserveCapacity(s, computeMods(s));
  const sub = town(s, Object.values(s.bodies).find((x) => x.kind !== 'deep' && !x.colonyId && x.systemId !== c.systemId)!);
  sub.structures.lepton_substrate = 1;
  const gone = town(s, Object.values(s.bodies).find((x) => x.kind !== 'deep' && !x.colonyId && x.systemId !== c.systemId && x.systemId !== sub.systemId)!);
  gone.pops = pops({ kin: 3, echoes: 1 });
  gone.cryo = 0;
  const lines = runCrossing(s, [s.player], { [s.player]: computeMods(s) })[s.player].lines.map((l) => l.text);
  const passed = s.colonies[c.id] ?? colonies(s).find((x) => x.structures.confluence_node);
  check(!!passed && (passed.structures.reserve_vault ?? 0) >= 2 && (passed.structures.superconducting_ring ?? 0) >= 1 && (passed.structures.substrate_core ?? 0) >= 2, 'at the end of matter the settlement that made the Passage keeps all it had');
  check(reserveCapacity(s, computeMods(s)) >= keep - 1e-6, `and the reserve its Field Stores hold (${Math.round(reserveCapacity(s, computeMods(s)))} of ${Math.round(keep)})`);
  const subAfter = s.colonies[sub.id] ?? colonies(s).find((x) => x.structures.lepton_substrate && x.id !== passed?.id);
  check(!subAfter || (!subAfter.structures.reserve_vault && !subAfter.structures.substrate_core), 'one that only built Leptonic Substrate keeps only that');
  check(!s.colonies[gone.id] && lines.some((l) => l.startsWith('Lost with the matter they were made of:') && l.includes(`${gone.name} (3 Kin, 1 Echo)`)), `the rest are lost, each named with who was in it (${lines.find((l) => l.startsWith('Lost with')) ?? 'no line'})`);
}

// a turn finishes it, as it does any project
{
  const w = setup();
  const wc = town(w);
  w.civ.capitalId = wc.id;
  beginPassage(w, wc.id);
  wc.queue = wc.queue.filter((q) => q.kind === 'passage');
  wc.queue[0].progress = wc.queue[0].cost - 0.001;
  endTurn(w);
  check(formOf(wc) === 'leptonic' && !wc.queue.length && !wc.structures.mine, 'a turn finishes it, as it does any project in the queue');
}

// the autoplayer: due where it can finish before the end with a few turns to spare, and not sooner
{
  const a = setup();
  a.eta = 35;
  a.years = Math.pow(10, 35);
  const ac = town(a);
  a.civ.capitalId = ac.id;
  const left = turnsToEndOfMatter(a);
  const need = passageTerms(a, ac).industry;
  ac.last = { energy: 0, energyUpkeep: 0, matter: 0, matterUpkeep: 0, industry: need / (left - 2), insight: 0, accord: 0, lines: [] };
  autoPlay(a, 'competent');
  check(ac.queue[0]?.kind === 'passage', `with about ${left.toFixed(0)} turns before the end and ${(left - 2).toFixed(0)} needed, it begins the Passage, at the front of the queue`);
  const b = setup();
  b.eta = 35;
  b.years = Math.pow(10, 35);
  const bc = town(b);
  b.civ.capitalId = bc.id;
  bc.last = { energy: 0, energyUpkeep: 0, matter: 0, matterUpkeep: 0, industry: need / Math.max(1, left - 10), insight: 0, accord: 0, lines: [] };
  autoPlay(b, 'competent');
  check(!bc.queue.some((q) => q.kind === 'passage'), 'and with ten turns to spare, not yet');
}
done('PASSAGE');
