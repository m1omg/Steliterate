// Leaving a black hole (the new version, part 3-4): a leptonic settlement can drift to another
// hole, or to one from a world, the one with the most spin to give that will not soon evaporate,
// for DRIFT_ENERGY a structure (at least DRIFT_MIN), once a turn; it joins our vault there, and has
// a harvester for the new hole's spin if we know how. A settlement still made of matter cannot.
// The autoplayer leaves a hole drained of spin or gone, and one soon to evaporate unless its Burst
// Catchers wait for the final burst.
import { autoPlay } from '../../../src/game/auto';
import { newGame } from '../../../src/game/newGame';
import { LEAVE_SPIN, driftChoices, holeFailing, runCrossing } from '../../../src/game/sim/crossing';
import { createColony, deepFor } from '../../../src/game/sim/fleets';
import { DRIFT_ENERGY, DRIFT_MIN, driftCheck, driftTerms, driftToAnotherHole } from '../../../src/game/sim/horizon';
import { computeMods } from '../../../src/game/sim/mods';
import { colonies, formOf } from '../../../src/game/sim/util';
import type { Colony, GameState, StarSystem, ThreadId } from '../../../src/game/types';
import { THREADS } from '../../../src/game/types';
import { check, done } from '../lib';

const pops = (p: Partial<Record<ThreadId, number>>) => Object.fromEntries(THREADS.map((t) => [t, p[t] ?? 0])) as Record<ThreadId, number>;
const isHole = (x: StarSystem) => x.primary.kind === 'black_hole' || x.primary.kind === 'smbh';

/** After the Great Decay: our only vault, at a black hole, with its harvesters. */
function after(): { s: GameState; v: Colony } {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'decays', civsAsleep: true });
  s.era = 'degenerate';
  s.civ.techs.push('leptonic_computation', 'penrose_process');
  for (const c of colonies(s)) {
    s.bodies[c.bodyId].colonyId = null;
    delete s.colonies[c.id];
  }
  const hole = Object.values(s.systems).find((x) => x.primary.kind === 'black_hole' && !x.gone && x.primary.spin > LEAVE_SPIN)!;
  const v = createColony(s, deepFor(s, hole)!, {});
  v.pops = pops({ echoes: 4, coldminds: 4 });
  v.structures = { lepton_substrate: 2, penrose_harvester: 2 };
  s.civ.capitalId = v.id;
  s.civ.energy = 400;
  runCrossing(s, [s.player], { [s.player]: computeMods(s) });
  s.eta = 45;
  s.years = Math.pow(10, 45);
  const w = s.colonies[v.id] ?? colonies(s)[0];
  // (what it has by then: the crossing kept its substrate and gave it a harvester; it built another)
  w.structures = { lepton_substrate: 2, penrose_harvester: 2 };
  return { s, v: w };
}

// it drifts to another hole, with spin to give and years to last
{
  const { s, v } = after();
  const from = s.systems[v.systemId];
  from.primary.spin = 0;
  check(formOf(v) === 'leptonic' && driftCheck(s, v) === null, 'a leptonic vault at a hole drained of spin can drift to another');
  const t = driftTerms(s, v);
  const best = Object.values(s.systems).filter((x) => isHole(x) && !x.gone && x.id !== from.id && x.primary.spin >= LEAVE_SPIN && !holeFailing(s, x)).sort((a, b) => b.primary.spin - a.primary.spin)[0];
  check(!!t.target && t.target.id === best?.id && !holeFailing(s, t.target), `to the one with the most spin to give and years to last (${t.target?.name}, spin ${Math.round(t.target?.primary.spin ?? 0)}, ${Math.round(t.ly)} ly)`);
  check(t.energy === Math.max(DRIFT_MIN, DRIFT_ENERGY * 4), `for ${t.energy} energy: ${DRIFT_ENERGY} for each of its 4 structures`);
  const e0 = s.civ.energy;
  check(driftToAnotherHole(s, v.id) === null && v.systemId === t.target!.id && s.civ.energy === e0 - t.energy, `it goes, the energy paid (now at ${s.systems[v.systemId].name})`);
  check((v.structures.penrose_harvester ?? 0) >= 2 && v.pops.echoes === 4, 'with all it had, its harvesters among it');
  check(/drifted from .* to .*: a black hole with spin to give/.test(s.civ.log.map((l) => l.text).join('\n')), 'and the Record says so');
  check(/once this turn/.test(driftCheck(s, v) ?? ''), 'once a turn');
}

// it joins our vault at that hole; one still of matter cannot drift
{
  const { s, v } = after();
  const t = driftTerms(s, v);
  s.systems[v.systemId].primary.spin = 0;
  const there = createColony(s, deepFor(s, t.target!)!, {});
  there.form = 'leptonic';
  there.pops = pops({ echoes: 2 });
  there.structures = { lepton_substrate: 1 };
  driftToAnotherHole(s, v.id);
  check(!s.colonies[v.id] && there.pops.echoes === 6 && (there.structures.lepton_substrate ?? 0) === 3, `it joins our vault there (${there.pops.echoes} Echoes, ${there.structures.lepton_substrate} Leptonic Substrate)`);
  const m = newGame({ seed: 1000, survivors: 3, civsAsleep: true });
  check(/Only a leptonic settlement/.test(driftCheck(m, m.colonies[m.civ.capitalId!]) ?? ''), 'a settlement of matter cannot drift');
}

// one that made the Passage on a world, before the end of matter, can drift to a hole
{
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'decays', civsAsleep: true });
  s.era = 'degenerate';
  s.eta = 36;
  s.years = 1e36;
  s.civ.techs.push('leptonic_computation', 'penrose_process');
  s.civ.energy = 400;
  const c = s.colonies[s.civ.capitalId!];
  c.form = 'leptonic';
  c.pops = pops({ echoes: 3 });
  c.structures = { reserve_vault: 1 };
  const t = driftTerms(s, c);
  check(driftCheck(s, c) === null && !!t.target && isHole(t.target), `a leptonic settlement on a world can drift to a hole (to ${t.target?.name})`);
  driftToAnotherHole(s, c.id);
  check(isHole(s.systems[c.systemId]) && s.bodies[c.bodyId]?.kind === 'deep' && (c.structures.reserve_vault ?? 0) === 1 && (c.structures.penrose_harvester ?? 0) === 1, 'into its Deep, with what it had and a harvester for the hole');
}

// the player chooses the hole (31 Oct, the player: "let me choose the hole but with recommendations
// and spin/lifetime statistics"): every other hole it fits, the game's own choice first and marked,
// each with its spin and years left; it drifts to the one chosen, not only the recommended one
{
  const { s, v } = after();
  const from = s.systems[v.systemId];
  from.primary.spin = 0;
  const choices = driftChoices(s, v);
  const holes = Object.values(s.systems).filter((x) => isHole(x) && !x.gone && x.id !== from.id);
  console.log(`  choices: ${choices.map((x) => `${x.sys.name}${x.recommended ? '*' : ''} spin ${Math.round(x.spin)}${x.poor ? ` (${x.poor})` : ''}`).join('; ')}`);
  check(choices.length === holes.length && choices[0].recommended && choices[0].sys.id === driftTerms(s, v).target?.id && choices.filter((x) => x.recommended).length === 1, `every other hole is offered (${choices.length}), the game's own choice first and the only one marked`);
  check(choices.slice(1).every((x, i, a) => i === 0 || a[i - 1].spin >= x.spin) && choices.every((x) => x.lasts > 0), 'the rest by spin to give, each with the years it has left');
  const other = choices.find((x) => !x.recommended);
  if (other) {
    check(driftCheck(s, v, 'nowhere') === 'It cannot drift there.', 'a hole it cannot go to is refused');
    check(driftToAnotherHole(s, v.id, other.sys.id) === null && v.systemId === other.sys.id, `it drifts to the one chosen (${other.sys.name}), not the recommended one`);
  } else check(false, 'a second hole to choose');
}

// the autoplayer leaves a hole drained or gone; it stays for a final burst its catchers will bank
{
  const drained = after();
  drained.s.systems[drained.v.systemId].primary.spin = 0;
  const at0 = drained.v.systemId;
  autoPlay(drained.s, 'competent');
  check(drained.v.systemId !== at0 || !drained.s.colonies[drained.v.id], 'the autoplayer leaves a hole drained of spin');
  const burst = after();
  const hole = burst.s.systems[burst.v.systemId].primary;
  hole.evaporateAt = Math.pow(10, burst.s.eta + 1);
  burst.v.structures.burst_catcher = 1;
  const at1 = burst.v.systemId;
  autoPlay(burst.s, 'competent');
  check(burst.v.systemId === at1, 'but with Burst Catchers stays at one soon to evaporate, for its final burst');
  delete burst.v.structures.burst_catcher;
  autoPlay(burst.s, 'competent');
  check(burst.v.systemId !== at1 || !burst.s.colonies[burst.v.id], 'without them it leaves it');
}
done('LEAVE HOLE');
