// Positronium (the new version, part 3-5):
// - it forms from η 85 where protons decayed or space unmade matter, and decays near η 141; never
//   if matter is stable;
// - with Positronium Weaving, a leptonic settlement is woven through it as a project (40 industry
//   and 4 a mind, 5 energy a structure, 70% of its yields while worked), inside the window only;
//   woven, its minds cost a fiftieth of their upkeep and do a tenth of their work, with no tempo
//   strain and 30 more room for each Thread it houses, and in the Dark Era Continuity falls half as
//   fast for its share of our minds;
// - Leave the weave brings it back out at once, for 2 energy a mind; whoever is still woven
//   through the atoms when they decay ends with them, named in the Record;
// - a Positronium Net gathers 40 over the window whatever the pace, and 20 more after it, halving
//   each turn; only in a settlement no longer of matter, inside the window;
// - the forecast counts down to the decay; the turn before, the player is asked once more;
// - the autoplayer weaves a vault in where its reserve would not last to the decay, leaves when
//   it is within two turns, and does not research the weaving where matter is known to be stable.
import { autoPlay } from '../../../src/game/auto';
import { FORMS, WEAVE_PACE, WEAVE_ROOM, WEAVE_UPKEEP } from '../../../src/game/data/forms';
import { EVENT_BY_ID } from '../../../src/game/data/events';
import { STRUCTURE_BY_ID } from '../../../src/game/data/structures';
import { TECH_BY_ID } from '../../../src/game/data/techs';
import { THREAD_DEFS } from '../../../src/game/data/threads';
import { stepTime } from '../../../src/game/eras';
import { newGame } from '../../../src/game/newGame';
import { structureCheck } from '../../../src/game/sim/actions';
import { LEAVE_SPIN, runCrossing } from '../../../src/game/sim/crossing';
import { PASSAGE_OUTPUT, capacity } from '../../../src/game/sim/economy';
import { createColony, deepFor } from '../../../src/game/sim/fleets';
import { driftCheck } from '../../../src/game/sim/horizon';
import { updateForecasts } from '../../../src/game/sim/forecast';
import { computeMods } from '../../../src/game/sim/mods';
import {
  LEAVE_WEAVE_ENERGY,
  NET_DOLE,
  NET_TRICKLE,
  POSITRONIUM_DECAY,
  WEAVE_BASE,
  WEAVE_ENERGY,
  WEAVE_PER,
  beginWeave,
  completeWeave,
  leaveWeave,
  leaveWeaveCheck,
  netYield,
  positroniumComes,
  positroniumGone,
  positroniumHere,
  theWeaveEnds,
  turnsToDecay,
  weaveCheck,
  weaveTerms,
} from '../../../src/game/sim/positronium';
import { project } from '../../../src/game/sim/projection';
import { techVisible } from '../../../src/game/sim/research';
import { endTurn } from '../../../src/game/sim/turn';
import { colonies, formOf } from '../../../src/game/sim/util';
import type { Colony, GameState, ThreadId } from '../../../src/game/types';
import { THREADS } from '../../../src/game/types';
import { check, done } from '../lib';

const pops = (p: Partial<Record<ThreadId, number>>) => Object.fromEntries(THREADS.map((t) => [t, p[t] ?? 0])) as Record<ThreadId, number>;
const said = (s: GameState, re: RegExp) => s.civ.log.some((l) => re.test(l.text));
const at = (s: GameState, eta: number) => {
  s.eta = eta;
  s.years = Math.pow(10, eta);
};

/** After the Great Decay, in the positronium's window (η 90): our only vault, leptonic, at a black hole, Positronium Weaving known. */
function after(eta = 90): { s: GameState; v: Colony } {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'decays', civsAsleep: true });
  s.era = 'degenerate';
  s.civ.techs.push('leptonic_computation', 'penrose_process', 'horizon_cognition', 'positronium_weaving');
  for (const c of colonies(s)) {
    s.bodies[c.bodyId].colonyId = null;
    delete s.colonies[c.id];
  }
  const hole = Object.values(s.systems).find((x) => x.primary.kind === 'smbh' && !x.gone && x.primary.spin > LEAVE_SPIN)!;
  const v = createColony(s, deepFor(s, hole)!, {});
  v.pops = pops({ echoes: 4, coldminds: 4, lattice: 2 });
  v.structures = { lepton_substrate: 2, penrose_harvester: 2 };
  s.civ.capitalId = v.id;
  s.civ.energy = 4000;
  runCrossing(s, [s.player], { [s.player]: computeMods(s) });
  s.era = eta >= 100 ? 'dark' : 'blackhole';
  at(s, eta);
  const w = s.colonies[v.id] ?? colonies(s)[0];
  w.structures = { lepton_substrate: 2, penrose_harvester: 2 };
  w.pops = pops({ echoes: 4, coldminds: 4, lattice: 2 });
  w.queue = [];
  return { s, v: w };
}

/** Each Thread's line in a settlement's yields this turn, and its strain. */
function threadLines(s: GameState, c: Colony) {
  const t = project(s).perColony[c.id];
  const out: Partial<Record<ThreadId, { energy: number; industry: number; upkeepMul: number; outMul: number; m: number }>> = {};
  for (const th of THREADS) {
    const n = c.pops[th];
    if (n <= 0) continue;
    const d = THREAD_DEFS[th];
    const line = t.y.lines.find((l) => l.label.startsWith(`${n} ${n === 1 ? d.one : d.name}`));
    if (line) out[th] = { energy: line.energy ?? 0, industry: line.industry ?? 0, upkeepMul: t.strain[th].upkeepMul, outMul: t.strain[th].outMul, m: t.strain[th].m };
  }
  return { y: t.y, lines: out };
}

// the window: from η 85 to 141, where protons decayed or space unmade matter
{
  const { s } = after();
  check(positroniumComes(s) && !positroniumHere(s, 84.9) && positroniumHere(s, 85) && positroniumHere(s, 140.9) && !positroniumHere(s, 141) && positroniumGone(s, 141), 'positronium is there from η 85 to 141 where protons decayed');
  const st = newGame({ seed: 1000, survivors: 3, protonFate: 'stable', civsAsleep: true });
  check(!positroniumComes(st) && !positroniumHere(st, 100), 'and never where matter is stable');
  // (the research is not there at all where matter is known to be stable; the fate is chosen here, so known)
  check(techVisible(s, TECH_BY_ID.positronium_weaving) && !techVisible(st, TECH_BY_ID.positronium_weaving), 'Positronium Weaving is researched only where matter does not last');
}

// the weaving: where it can be done, what it takes, and that it slows the settlement while worked
{
  const { s, v } = after();
  check(weaveCheck(s, v) === null, `a leptonic vault, the tech known, in the window, can be woven (${s.systems[v.systemId].name})`);
  const t = weaveTerms(v);
  check(t.minds === 10 && t.industry === WEAVE_BASE + WEAVE_PER * 10 && t.energy === WEAVE_ENERGY * 4, `for ${t.industry} industry (${WEAVE_BASE} and ${WEAVE_PER} for each of its 10 minds) and ${t.energy} energy (${WEAVE_ENERGY} for each of its 4 structures)`);
  const e0 = s.civ.energy;
  const idle = project(s).perColony[v.id].y;
  check(beginWeave(s, v.id) === null && v.queue.some((q) => q.kind === 'weave' && q.cost === t.industry) && s.civ.energy === e0 - t.energy, 'begun: a project in its queue, its energy paid at once');
  check(/being woven/.test(weaveCheck(s, v) ?? ''), 'and not begun twice');
  const worked = project(s).perColony[v.id].y;
  check(Math.abs(worked.energy - idle.energy * PASSAGE_OUTPUT) < 1e-6 && Math.abs(worked.insight - idle.insight * PASSAGE_OUTPUT) < 1e-6, `while it is worked, ${Math.round(PASSAGE_OUTPUT * 100)}% of its energy and insight (${worked.energy.toFixed(1)} of ${idle.energy.toFixed(1)})`);
  const n = after();
  n.s.civ.techs = n.s.civ.techs.filter((x) => x !== 'positronium_weaving');
  check(/Needs Positronium Weaving/.test(weaveCheck(n.s, n.v) ?? ''), 'not without Positronium Weaving');
  const early = after(80);
  check(/No positronium has formed yet/.test(weaveCheck(early.s, early.v) ?? ''), 'not before η 85');
  const late = after(150);
  check(/decayed/.test(weaveCheck(late.s, late.v) ?? ''), 'nor after the decay');
  const hz = after();
  hz.v.form = 'horizon';
  check(/bound to it/.test(weaveCheck(hz.s, hz.v) ?? ''), 'nor a settlement written into a horizon');
  const m = newGame({ seed: 1000, survivors: 3, civsAsleep: true });
  m.civ.techs.push('positronium_weaving');
  check(/Only a leptonic settlement/.test(weaveCheck(m, m.colonies[m.civ.capitalId!]) ?? ''), 'nor one of matter');
}

// a turn finishes it
{
  const { s, v } = after();
  beginWeave(s, v.id);
  v.queue[0].progress = v.queue[0].cost - 0.001;
  endTurn(s);
  check(formOf(v) === 'positronium' && !v.queue.length && (s.civ.flags.woven ?? 0) === 1, 'a turn finishes it, as it does any project in the queue');
  check(said(s, /is woven through the positronium: its minds cost a fiftieth of their upkeep now/), 'and the Record says so');
}

// in the weave: a fiftieth of the upkeep, a tenth of the pace, no strain, room to spare; not bound to a hole
{
  const { s, v } = after(97);
  // a turn longer than an Echo can slow to: outside the weave they feel the strain
  const before = threadLines(s, v);
  const mods = computeMods(s);
  const cap0 = capacity(s, v, mods);
  completeWeave(s, v);
  const now = threadLines(s, v);
  const strained = THREADS.filter((th) => Math.abs(before.lines[th]?.m ?? 0) > 0.05);
  check(strained.length > 0 && THREADS.every((th) => !now.lines[th] || now.lines[th]!.m === 0), `no tempo strain in the weave (outside it, now: ${strained.join(', ')})`);
  let upOk = true;
  let paceOk = true;
  for (const th of THREADS) {
    const a = before.lines[th];
    const b = now.lines[th];
    if (!a || !b) continue;
    if (Math.abs(b.energy - (a.energy / a.upkeepMul) * WEAVE_UPKEEP) > 1e-6 * Math.max(1, Math.abs(a.energy))) upOk = false;
    if (Math.abs(b.industry - (a.industry / a.outMul) * WEAVE_PACE) > 1e-6 * Math.max(1, Math.abs(a.industry))) paceOk = false;
  }
  check(upOk, `its minds cost a fiftieth of their upkeep, the strain taken off (Echoes ${(-(before.lines.echoes?.energy ?? 0)).toFixed(2)} → ${(-(now.lines.echoes?.energy ?? 0)).toFixed(3)} energy)`);
  check(paceOk, `and do a tenth of their work (Echoes ${(before.lines.echoes?.industry ?? 0).toFixed(2)} → ${(now.lines.echoes?.industry ?? 0).toFixed(2)} industry)`);
  check(/in the weave: a fiftieth of the upkeep, a tenth of the pace/.test(now.y.lines.map((l) => l.label).join('\n')), 'the yields say so');
  const cap1 = capacity(s, v, mods);
  check(FORMS.positronium.lives.every((th) => cap1[th] === cap0[th] + WEAVE_ROOM) && cap1.kin === 0, `room for ${WEAVE_ROOM} more of each Thread it houses, and none for Kin`);
  check(/no hole to leave/.test(driftCheck(s, v) ?? ''), 'bound to no hole: it has none to drift from');
}

// leaving the weave, and the decay: whoever is still woven through the atoms ends with them
{
  const { s, v } = after(100);
  completeWeave(s, v);
  const e0 = s.civ.energy;
  check(leaveWeaveCheck(s, v) === null && leaveWeave(s, v.id) === null && formOf(v) === 'leptonic' && s.civ.energy === e0 - LEAVE_WEAVE_ENERGY * 10, `Leave the weave: leptonic again at once, for ${LEAVE_WEAVE_ENERGY * 10} energy (${LEAVE_WEAVE_ENERGY} for each of its 10 minds)`);
  check(said(s, /has left the weave: leptonic again/), 'and the Record says so');
  // never refused for want of energy: a settlement woven in for want of it must still come out
  const poor = after(130);
  completeWeave(poor.s, poor.v);
  poor.s.civ.energy = 5;
  check(leaveWeaveCheck(poor.s, poor.v) === null && leaveWeave(poor.s, poor.v.id) === null && formOf(poor.v) === 'leptonic' && poor.s.civ.energy === 0, 'never refused for want of energy: with 5 left it comes out, for the 5');
  // two settlements: one woven, one not; the turn passes η 141
  const d = after(139);
  completeWeave(d.s, d.v);
  const other = Object.values(d.s.systems).find((x) => x.primary.kind === 'black_hole' && !x.gone && x.id !== d.v.systemId)!;
  const free = createColony(d.s, deepFor(d.s, other)!, {});
  free.form = 'leptonic';
  free.pops = pops({ echoes: 2 });
  free.structures = { lepton_substrate: 1 };
  const lost = theWeaveEnds(d.s, 139, 142);
  check(lost === 10 && !d.s.colonies[d.v.id] && !!d.s.colonies[free.id] && free.pops.echoes === 2, `as it decays, the woven settlement ends with it (${lost} minds), the other goes on`);
  check(said(d.s, /The positronium has decayed\. .* was still woven through it: 10 minds ended with the atoms/), 'named in the Record');
  check(theWeaveEnds(d.s, 142, 150) === 0, 'once');
  // and through a whole turn: the universe marks the turn the atoms decayed in
  const e = after(139.5);
  e.s.era = 'dark';
  completeWeave(e.s, e.v);
  const turn = e.s.turn;
  endTurn(e.s);
  check(e.s.eta >= POSITRONIUM_DECAY && e.s.flags.positronium_end === turn && !e.s.colonies[e.v.id], `a turn that passes η ${POSITRONIUM_DECAY} (to η ${e.s.eta.toFixed(1)}) ends what is woven, and marks the turn the atoms decayed in`);
}

// the nets: 40 over the window whatever the pace, 20 more after it, halving each turn
{
  const { s } = after(85);
  for (const pace of [0, -1, 1]) {
    let years = Math.pow(10, 85);
    let eta = 85;
    let sum = 0;
    for (let n = 0; n < 200 && eta < POSITRONIUM_DECAY; n++) {
      const era = eta >= 100 ? 'dark' : 'blackhole';
      const st = stepTime(era, years, eta, pace, s.settings.length);
      sum += netYield(s, years, st.turnLength);
      years = st.years;
      eta = st.eta;
    }
    check(Math.abs(sum - NET_TRICKLE) < 1e-6, `a net gathers ${sum.toFixed(3)} over the window at pace ${pace} (${NET_TRICKLE})`);
  }
  check(netYield(s, Math.pow(10, 88), Math.pow(10, 89)) < netYield(s, Math.pow(10, 130), Math.pow(10, 131)), 'little at first, most near the end');
  const d = after(150);
  d.s.flags.positronium_end = d.s.turn - 1;
  let dole = 0;
  for (let k = 0; k < 60; k++) {
    dole += netYield(d.s, d.s.years, Math.pow(10, 160));
    d.s.turn++;
  }
  check(Math.abs(dole - NET_DOLE) < 1e-6, `after the decay, the never-ending annihilation: ${dole.toFixed(3)} more (${NET_DOLE}), half the turn before each turn`);
  // where they can be built
  const net = STRUCTURE_BY_ID.positronium_net;
  const w = after(90);
  check(structureCheck(w.s, w.v, net) === null, 'a net can be built in a leptonic settlement in the window');
  w.v.structures.positronium_net = 1;
  const with1 = project(w.s).perColony[w.v.id].y.energy;
  w.v.structures.positronium_net = 0;
  const with0 = project(w.s).perColony[w.v.id].y.energy;
  const ctx = project(w.s).ctx;
  check(Math.abs(with1 - with0 - netYield(w.s, ctx.years, ctx.L)) < 1e-6, `and gathers its share this turn (${(with1 - with0).toFixed(3)} energy)`);
  check(/No positronium has formed yet/.test(structureCheck(after(80).s, after(80).v, net) ?? '') && /decayed/.test(structureCheck(after(150).s, after(150).v, net) ?? ''), 'not before the atoms form, nor after they decay');
  const m = newGame({ seed: 1000, survivors: 3, protonFate: 'decays', civsAsleep: true });
  m.civ.techs.push('positronium_weaving');
  at(m, 90);
  m.era = 'blackhole';
  check(/Strung of fields/.test(structureCheck(m, m.colonies[m.civ.capitalId!], net) ?? ''), 'nor in a settlement still made of matter');
}

// the countdown, and the last word before the decay
{
  const { s, v } = after(110);
  completeWeave(s, v);
  updateForecasts(s);
  const f = s.civ.forecasts.find((x) => x.kind === 'positronium');
  check(!!f && f.severity === 'danger' && /Still woven through them: .*leave the weave in time/.test(f.text) && turnsToDecay(s) > 0 && isFinite(turnsToDecay(s)), `the forecast counts down to the decay (${turnsToDecay(s)} turns at our pace), a danger while anything is woven`);
  const e = EVENT_BY_ID.positronium_ends;
  const before = s.civ.energy;
  check(!!e && e.choices[0].ok?.(s, {}) === true, 'the turn before, the player is asked: Leave the weave, all of it');
  e.choices[0].run(s, {}, { next: () => 0.5 } as never);
  check(formOf(v) === 'leptonic' && s.civ.energy === before - LEAVE_WEAVE_ENERGY * 10, 'and that brings everything woven back out, for its energy');
}

// the autoplayer
{
  const short = after(95);
  short.s.civ.flags.last_energy_net = -40;
  short.s.civ.energy = 200;
  autoPlay(short.s, 'competent');
  check(short.v.queue[0]?.kind === 'weave', 'where its reserve would not last to the decay, the autoplayer weaves the vault through the positronium, first in its queue');
  const plenty = after(95);
  plenty.s.civ.flags.last_energy_net = -40;
  plenty.s.civ.energy = 1e6;
  autoPlay(plenty.s, 'competent');
  check(!plenty.v.queue.some((q) => q.kind === 'weave'), 'not where the reserve will last');
  const end = after(139.5);
  end.s.era = 'dark';
  completeWeave(end.s, end.v);
  // (with too little energy for 2 a mind: it leaves all the same)
  end.s.civ.energy = 10;
  autoPlay(end.s, 'competent');
  check(formOf(end.v) === 'leptonic', `it leaves the weave when the decay is within two turns (${turnsToDecay(end.s)} now), even short of energy`);
}
done('POSITRONIUM');

