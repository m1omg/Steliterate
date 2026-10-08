// Taking structures apart. The matter it cost comes back (its energy, once matter is gone), for a
// fifth of its industry cost in energy, at least 5. Refused while it houses people or sleepers with
// nowhere else to go, while ships in the queue need the Shipyard, or without the energy. What a
// building does once (Volatile Shepherding's water, a Confluence Node for the Chorus) it does only
// the first time at a settlement. Short of matter, the autoplayer takes apart a collector that
// gathers nothing.
import { autoPlay } from '../../../src/game/auto';
import { newGame } from '../../../src/game/newGame';
import { endTurn } from '../../../src/game/sim/turn';
import { dismantle, dismantleCheck, dismantleTerms, queueBuild, rushBuild } from '../../../src/game/sim/actions';
import { STRUCTURE_BY_ID, dismantledKey } from '../../../src/game/data/structures';
import { capacity } from '../../../src/game/sim/economy';
import { computeMods } from '../../../src/game/sim/mods';
import { project } from '../../../src/game/sim/projection';
import { sourceLight } from '../../../src/game/physics';
import type { Colony, GameState } from '../../../src/game/types';
import { check, done } from '../lib';

const fresh = (turns: number) => {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' });
  for (let g = 0; g < turns && !s.outcome; g++) {
    autoPlay(s, 'competent');
    endTurn(s);
  }
  s.pending.length = 0;
  return s;
};
const capital = (s: GameState): Colony => s.colonies[s.civ.capitalId!];

// ---------------------------------------------------------------- what comes back, and the price
{
  const s = fresh(20);
  const c = capital(s);
  c.structures.solar_array = 2;
  s.civ.energy = 300;
  const m0 = s.civ.matter;
  const e0 = s.civ.energy;
  const t = dismantleTerms(s, STRUCTURE_BY_ID.solar_array);
  check(t.matter === 10 && t.energy === 0 && t.cost === 6, `Solar Arrays: 10 matter back, for 6 energy (a fifth of 30) (${JSON.stringify(t)})`);
  check(dismantle(s, c.id, 'solar_array') === null && c.structures.solar_array === 1, 'one of two taken apart');
  check(s.civ.matter === m0 + 10 && s.civ.energy === e0 - 6, `matter ${m0} → ${s.civ.matter}, energy ${e0} → ${s.civ.energy}`);
  check(dismantle(s, c.id, 'solar_array') === null && c.structures.solar_array === undefined, 'the last one too, and it is gone from the list');
  check(dismantleTerms(s, STRUCTURE_BY_ID.mine).cost === 6 && dismantleTerms(s, STRUCTURE_BY_ID.mine).matter === 0, 'a Deep Mine (no matter in it) gives nothing back');
  c.structures.geothermal_tap = 1;
  check(dismantleTerms(s, { ...STRUCTURE_BY_ID.geothermal_tap, cost: 12 }).cost === 5, 'never less than 5 energy');
  s.civ.energy = 3;
  const err = dismantle(s, c.id, 'geothermal_tap');
  check(err === 'Taking it apart needs 7 energy.' && c.structures.geothermal_tap === 1, `without the energy it stays (${err})`);
  // once matter is gone, building is paid in energy, and so is what comes back
  s.civ.energy = 300;
  s.civ.flags.matter_gone = s.turn;
  c.structures.lepton_substrate = 1;
  const lt = dismantleTerms(s, STRUCTURE_BY_ID.lepton_substrate);
  check(lt.matter === 0 && lt.energy === 105 && lt.cost === 22, `matter gone: a Leptonic Substrate gives 105 energy back for 22 (${JSON.stringify(lt)})`);
}

// ---------------------------------------------------------------- refusals
{
  const s = fresh(20);
  const c = capital(s);
  s.civ.energy = 300;
  const mods = computeMods(s);
  c.structures.substrate_core = (c.structures.substrate_core ?? 0) + 1;
  c.pops.echoes = capacity(s, c, mods).echoes;
  const why = dismantleCheck(s, c, 'substrate_core');
  check(why === 'It houses Echoes who would have nowhere else to live here.', `a full Substrate Core stays (${why})`);
  c.pops.echoes = Math.max(0, capacity(s, c, mods).echoes - 4);
  check(dismantleCheck(s, c, 'substrate_core') === null, 'with room for its Echoes elsewhere here, it can go');
  c.structures.cryo_hall = 1;
  c.cryo = capacity(s, c, mods).cryo;
  check(dismantleCheck(s, c, 'cryo_hall') === 'Its sleepers would have nowhere else to sleep here.', 'a full Cryo Hall stays');
  c.structures.shipyard = 1;
  c.queue = [];
  s.civ.matter = 500;
  const q = queueBuild(s, c.id, 'ship', 'probe');
  check(q === null && dismantleCheck(s, c, 'shipyard') === 'The ships in the queue are built in it.', `the Shipyard stays while a ship is queued (${q})`);
  c.queue = [];
  check(dismantleCheck(s, c, 'shipyard') === null, 'and can go once the queue is clear');
  check(dismantleCheck(s, c, 'bastion') === 'There is none here.', 'nothing to take apart where there is none');
}

// ---------------------------------------------------------------- once-only effects, once per settlement
{
  /** Build `id` at the capital this turn; returns the world's vitality change and the nodes counted. */
  const build = (s: GameState, id: string) => {
    const c = capital(s);
    const b = s.bodies[c.bodyId];
    if (!s.civ.techs.includes('comet_shepherding')) s.civ.techs.push('comet_shepherding');
    if (!s.civ.techs.includes('mind_merging')) s.civ.techs.push('mind_merging');
    c.queue = [];
    s.civ.matter = 500;
    s.civ.energy = 500;
    b.vitality = 0.5;
    const nodes = s.civ.flags.chorus_nodes_built ?? 0;
    const err = queueBuild(s, c.id, 'structure', id) ?? rushBuild(s, c.id);
    endTurn(s);
    return { err, built: (c.structures[id] ?? 0) > 0, vitality: b.vitality - 0.5, nodes: (s.civ.flags.chorus_nodes_built ?? 0) - nodes };
  };
  const base = fresh(20);
  const again = JSON.parse(JSON.stringify(base)) as GameState;
  // taking one apart marks it: the next built here does not do again what the first did once
  const ca = capital(again);
  ca.structures.comet_shepherd = 1;
  again.civ.energy = 300;
  check(dismantle(again, ca.id, 'comet_shepherd') === null && again.civ.flags[dismantledKey(ca.id, 'comet_shepherd')] === 1, 'taking Volatile Shepherding apart marks the settlement');
  const first = build(base, 'comet_shepherd');
  const second = build(again, 'comet_shepherd');
  check(first.built && second.built && !first.err && !second.err, `built both times (${first.err ?? ''}${second.err ?? ''})`);
  check(Math.abs(first.vitality - second.vitality - 0.15) < 1e-9, `the first time it brings water (vitality ${first.vitality.toFixed(3)}), built again it does not (${second.vitality.toFixed(3)})`);
  check(again.civ.flags[dismantledKey(ca.id, 'comet_shepherd')] === undefined, 'and the mark is used up');
  const n1 = build(base, 'confluence_node');
  ca.structures.confluence_node = (ca.structures.confluence_node ?? 0) + 1;
  check(dismantle(again, ca.id, 'confluence_node') === null, 'a Confluence Node taken apart');
  const n2 = build(again, 'confluence_node');
  check(n1.nodes === 1 && n2.nodes === 0, `a new Confluence Node counts for the Chorus (${n1.nodes}), one rebuilt does not (${n2.nodes})`);
}

// ---------------------------------------------------------------- the autoplayer, short of matter
{
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' });
  for (let g = 0; g < 600 && !s.outcome && s.eta < 20; g++) {
    autoPlay(s, 'competent');
    endTurn(s);
  }
  s.pending.length = 0;
  /** How many collectors gather nothing (and have matter in them to give back). */
  const idleCount = (g: GameState) => {
    const pr = project(g);
    let n = 0;
    for (const c of Object.values(g.colonies)) for (const l of pr.perColony[c.id]?.y.lines ?? []) if (l.idle && STRUCTURE_BY_ID[l.idle].matter > 0) n += c.structures[l.idle] ?? 0;
    return n;
  };
  // a settlement under a star that gives no light (the capital's may be an ember, which does)
  const dark = (x: Colony) => sourceLight(s, s.systems[x.systemId], s.years, 1).light <= 0;
  const c = Object.values(s.colonies).find(dark) ?? capital(s);
  if (!dark(c)) s.systems[c.systemId].primary.halo = false;
  c.structures.solar_array = Math.max(1, c.structures.solar_array ?? 0);
  const lines = project(s).perColony[c.id]?.y.lines ?? [];
  check(lines.some((l) => l.idle === 'solar_array' && /nothing to gather/.test(l.label)), `η ${s.eta.toFixed(1)}: Solar Arrays under ${s.systems[c.systemId].name}’s cold star gather nothing, and say so`);
  s.civ.matter = 0;
  s.civ.energy = 400;
  const before = idleCount(s);
  autoPlay(s, 'competent');
  const after = idleCount(s);
  check(after === before - 1 && s.civ.matter > 0, `short of matter, the autoplayer takes one apart (${before} → ${after}, matter 0 → ${s.civ.matter})`);
  s.civ.matter = 100;
  autoPlay(s, 'competent');
  check(idleCount(s) === after, 'with matter enough, it leaves them');
}
done('DISMANTLE');
