// The Horizon form (the new version, part 3-4):
// - with Horizon Writing, a leptonic settlement in a black hole's Deep can be written into the
//   hole's horizon: a project in its queue, HORIZON_BASE industry and HORIZON_PER for each mind,
//   HORIZON_ENERGY for each structure paid at once; while it is worked the settlement makes 70% of
//   its yields. Not at a failing hole, not without the tech, not for a settlement of matter;
// - written in, its minds cost a tenth of their upkeep and do a quarter of their work, with no
//   tempo strain, and each Thread that can live there has more room by the hole's mass;
// - it is bound to its hole: it cannot drift; when the hole evaporates it is written back out,
//   leptonic (the Lattice at half), and drifts to another; at the Last Horizon every horizon
//   settlement is written back out;
// - the autoplayer writes a vault in where its reserve would not last the age at its rate, at a
//   hole that will last; not where the reserve will do, nor at a hole soon to evaporate.
import { autoPlay } from '../../../src/game/auto';
import { FORMS, HORIZON_PACE, HORIZON_UPKEEP, horizonRoom } from '../../../src/game/data/forms';
import { THREAD_DEFS } from '../../../src/game/data/threads';
import { calendarEra } from '../../../src/game/fate';
import { newGame } from '../../../src/game/newGame';
import { evaporateHole } from '../../../src/game/physics';
import { LEAVE_SPIN, runCrossing } from '../../../src/game/sim/crossing';
import { PASSAGE_OUTPUT, capacity } from '../../../src/game/sim/economy';
import { createColony, deepFor } from '../../../src/game/sim/fleets';
import { HORIZON_BASE, HORIZON_ENERGY, HORIZON_PER, beginHorizon, completeHorizon, driftCheck, horizonCheck, horizonTerms } from '../../../src/game/sim/horizon';
import { computeMods } from '../../../src/game/sim/mods';
import { project } from '../../../src/game/sim/projection';
import { endTurn, handleNotes } from '../../../src/game/sim/turn';
import { colonies, formOf } from '../../../src/game/sim/util';
import type { Colony, GameState, ThreadId } from '../../../src/game/types';
import { THREADS } from '../../../src/game/types';
import { check, done } from '../lib';

const pops = (p: Partial<Record<ThreadId, number>>) => Object.fromEntries(THREADS.map((t) => [t, p[t] ?? 0])) as Record<ThreadId, number>;
const said = (s: GameState, re: RegExp) => s.civ.log.some((l) => re.test(l.text));

/** After the Great Decay, in the Black Hole Age: our only vault, leptonic, at a black hole with spin and years to last, Horizon Writing known. */
function after(): { s: GameState; v: Colony } {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'decays', civsAsleep: true });
  s.era = 'degenerate';
  s.civ.techs.push('leptonic_computation', 'penrose_process', 'horizon_cognition', 'horizon_writing');
  for (const c of colonies(s)) {
    s.bodies[c.bodyId].colonyId = null;
    delete s.colonies[c.id];
  }
  const hole = Object.values(s.systems).find((x) => x.primary.kind === 'black_hole' && !x.gone && x.primary.spin > LEAVE_SPIN && (x.primary.evaporateAt ?? Infinity) > 1e60)!;
  const v = createColony(s, deepFor(s, hole)!, {});
  v.pops = pops({ echoes: 4, coldminds: 4, lattice: 2 });
  v.structures = { lepton_substrate: 2, penrose_harvester: 2 };
  s.civ.capitalId = v.id;
  s.civ.energy = 400;
  runCrossing(s, [s.player], { [s.player]: computeMods(s) });
  s.eta = 45;
  s.years = Math.pow(10, 45);
  const w = s.colonies[v.id] ?? colonies(s)[0];
  w.structures = { lepton_substrate: 2, penrose_harvester: 2 };
  w.pops = pops({ echoes: 4, coldminds: 4, lattice: 2 });
  return { s, v: w };
}

/** Each Thread's line in a settlement's yields this turn, and its strain. */
function threadLines(s: GameState, c: Colony) {
  const t = project(s).perColony[c.id];
  const out: Partial<Record<ThreadId, { energy: number; industry: number; insight: number; upkeepMul: number; outMul: number; m: number }>> = {};
  for (const th of THREADS) {
    const n = c.pops[th];
    if (n <= 0) continue;
    const d = THREAD_DEFS[th];
    const line = t.y.lines.find((l) => l.label.startsWith(`${n} ${n === 1 ? d.one : d.name}`));
    if (line) out[th] = { energy: line.energy ?? 0, industry: line.industry ?? 0, insight: line.insight ?? 0, upkeepMul: t.strain[th].upkeepMul, outMul: t.strain[th].outMul, m: t.strain[th].m };
  }
  return { y: t.y, lines: out };
}

// the project: where it can be done, what it takes, and that it slows the settlement while worked
{
  const { s, v } = after();
  check(calendarEra(s) === 'blackhole' && formOf(v) === 'leptonic' && horizonCheck(s, v) === null, `a leptonic vault in a black hole’s Deep, Horizon Writing known, can be written into its horizon (${s.systems[v.systemId].name})`);
  const t = horizonTerms(v);
  check(t.minds === 10 && t.industry === HORIZON_BASE + HORIZON_PER * 10 && t.energy === HORIZON_ENERGY * 4, `for ${t.industry} industry (${HORIZON_BASE} and ${HORIZON_PER} for each of its 10 minds) and ${t.energy} energy (${HORIZON_ENERGY} for each of its 4 structures)`);
  const e0 = s.civ.energy;
  const idle = project(s).perColony[v.id].y;
  check(beginHorizon(s, v.id) === null && v.queue.some((q) => q.kind === 'horizon' && q.cost === t.industry) && s.civ.energy === e0 - t.energy, 'begun: a project in its queue, its energy paid at once');
  check(/being written/.test(horizonCheck(s, v) ?? ''), 'and not begun twice');
  v.queue = v.queue.filter((q) => q.kind === 'horizon');
  const worked = project(s).perColony[v.id].y;
  check(Math.abs(worked.energy - idle.energy * PASSAGE_OUTPUT) < 1e-6 && Math.abs(worked.insight - idle.insight * PASSAGE_OUTPUT) < 1e-6, `while it is worked, ${Math.round(PASSAGE_OUTPUT * 100)}% of its energy and insight (${worked.energy.toFixed(1)} of ${idle.energy.toFixed(1)})`);
  // where it cannot be done
  const n = after();
  n.s.civ.techs = n.s.civ.techs.filter((x) => x !== 'horizon_writing');
  check(/Needs Horizon Writing/.test(horizonCheck(n.s, n.v) ?? ''), 'not without Horizon Writing');
  const f = after();
  f.s.systems[f.v.systemId].primary.spin = 0;
  check(/failing/.test(horizonCheck(f.s, f.v) ?? ''), 'not at a hole drained of spin');
  const g = after();
  const p = g.s.systems[g.v.systemId].primary;
  p.evaporateAt = Math.pow(10, g.s.eta + 2);
  check(/failing/.test(horizonCheck(g.s, g.v) ?? ''), 'nor at one soon to evaporate');
  const m = newGame({ seed: 1000, survivors: 3, civsAsleep: true });
  m.civ.techs.push('horizon_writing');
  check(/Only a leptonic settlement/.test(horizonCheck(m, m.colonies[m.civ.capitalId!]) ?? ''), 'nor for a settlement of matter');
}

// a turn finishes it
{
  const { s, v } = after();
  beginHorizon(s, v.id);
  v.queue = v.queue.filter((q) => q.kind === 'horizon');
  v.queue[0].progress = v.queue[0].cost - 0.001;
  endTurn(s);
  check(formOf(v) === 'horizon' && !v.queue.length, 'a turn finishes it, as it does any project in the queue');
  check(said(s, /is written into the horizon of .*: its minds cost a tenth of their upkeep now/), 'and the Record says so');
}

// in the horizon: a tenth of the upkeep, a quarter of the pace, no strain, room by the hole's mass
{
  const { s, v } = after();
  // late in the age, when a turn is longer than an Echo can slow to: outside the horizon they feel the strain
  s.eta = 62;
  s.years = 1e62;
  const before = threadLines(s, v);
  const mods = computeMods(s);
  const cap0 = capacity(s, v, mods);
  completeHorizon(s, v);
  const now = threadLines(s, v);
  const strained = THREADS.filter((th) => Math.abs(before.lines[th]?.m ?? 0) > 0.05);
  check(strained.length > 0 && THREADS.every((th) => !now.lines[th] || now.lines[th]!.m === 0), `no tempo strain in the horizon (outside it, now: ${strained.join(', ')})`);
  let upOk = true;
  let paceOk = true;
  for (const th of THREADS) {
    const a = before.lines[th];
    const b = now.lines[th];
    if (!a || !b) continue;
    // what it would be unstrained, a tenth of it, and a quarter of the work
    if (Math.abs(b.energy - (a.energy / a.upkeepMul) * HORIZON_UPKEEP) > 1e-6 * Math.max(1, Math.abs(a.energy))) upOk = false;
    if (Math.abs(b.industry - (a.industry / a.outMul) * HORIZON_PACE) > 1e-6 * Math.max(1, Math.abs(a.industry))) paceOk = false;
  }
  check(upOk, `its minds cost a tenth of their upkeep, the strain taken off (Echoes ${(-(before.lines.echoes?.energy ?? 0)).toFixed(2)} → ${(-(now.lines.echoes?.energy ?? 0)).toFixed(2)} energy)`);
  check(paceOk, `and do a quarter of their work (Echoes ${(before.lines.echoes?.industry ?? 0).toFixed(2)} → ${(now.lines.echoes?.industry ?? 0).toFixed(2)} industry)`);
  check(/in the horizon: a tenth of the upkeep, a quarter of the pace/.test(now.y.lines.map((l) => l.label).join('\n')), 'the yields say so');
  const p = s.systems[v.systemId].primary;
  const cap1 = capacity(s, v, mods);
  const room = horizonRoom(p);
  check(room === Math.round(6 * (1 + Math.log10(p.mass))) && FORMS.horizon.lives.every((th) => cap1[th] === cap0[th] + room) && cap1.kin === 0, `room for ${room} more of each Thread that can live there, by the hole’s mass (${p.mass.toPrecision(3)} Suns), and none for Kin`);
  check(horizonRoom({ kind: 'black_hole', mass: 10 }) === 12 && horizonRoom({ kind: 'smbh', mass: 1e6 }) === 42 && horizonRoom({ kind: 'void', mass: 10 }) === 0, 'room: 12 at a hole of 10 Suns, 42 at one of a million, none where no hole is');
  check(/bound to it/.test(driftCheck(s, v) ?? ''), 'it is bound to its hole: it cannot drift');
}

// written back out: when its hole evaporates (and it drifts on), and at the Last Horizon
{
  const { s, v } = after();
  completeHorizon(s, v);
  const from = s.systems[v.systemId];
  const lat = v.pops.lattice;
  handleNotes(s, [{ systemId: from.id, kind: 'evaporated', held: evaporateHole(s, from) }]);
  const w = s.colonies[v.id] ?? colonies(s).find((c) => c.systemId !== from.id)!;
  check(!!w && formOf(w) === 'leptonic', 'its hole evaporated, it is written back out, leptonic');
  check(w.pops.lattice === lat - Math.round(lat * 0.5) && w.pops.echoes === 4 && w.pops.coldminds === 4, `the Lattice at half (${lat} → ${w.pops.lattice}), the rest whole`);
  check(w.systemId !== from.id && ['black_hole', 'smbh'].includes(s.systems[w.systemId].primary.kind), `and it drifts to another hole (${s.systems[w.systemId].name})`);
  check(said(s, /has evaporated: what was written in its horizon at .* is written back out, leptonic \(1 of its Lattice did not come through\), and drifts to/), 'the Record says so');

  const l = after();
  completeHorizon(l.s, l.v);
  l.s.era = 'blackhole';
  l.s.eta = 100;
  l.s.years = 1e100;
  const lines = runCrossing(l.s, [l.s.player], { [l.s.player]: computeMods(l.s) })[l.s.player].lines.map((x) => x.text);
  const lv = l.s.colonies[l.v.id];
  check(!!lv && formOf(lv) === 'leptonic', 'at the Last Horizon every horizon settlement is written back out, leptonic');
  check(lines.some((x) => /written back out of the horizons, leptonic/.test(x)), `and the report says so (${lines.find((x) => /horizons/.test(x)) ?? 'no line'})`);
}

// the autoplayer: writes a vault in where its reserve would not last the age, at a hole that will last
{
  const short = after();
  short.s.civ.flags.last_energy_net = -30;
  short.s.civ.energy = 100;
  autoPlay(short.s, 'competent');
  check(short.v.queue[0]?.kind === 'horizon', 'where the reserve would not last the age at its rate, the autoplayer writes the vault into the horizon, first in its queue');
  const plenty = after();
  plenty.s.civ.flags.last_energy_net = -30;
  plenty.s.civ.energy = 1e6;
  autoPlay(plenty.s, 'competent');
  check(!plenty.v.queue.some((q) => q.kind === 'horizon'), 'not where the reserve will last');
  const soon = after();
  soon.s.civ.flags.last_energy_net = -30;
  soon.s.civ.energy = 100;
  soon.s.systems[soon.v.systemId].primary.evaporateAt = Math.pow(10, soon.s.eta + 8);
  autoPlay(soon.s, 'competent');
  check(!soon.v.queue.some((q) => q.kind === 'horizon'), 'nor at a hole that will evaporate within ten decades');
}
done('HORIZON FORM');
