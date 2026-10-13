// Between the other civilizations (the new version, part 2a-3, sim/ties.ts):
// - each pair's regard begins from how their ways see each other and the seed, never the dice;
// - a pact one proposes crosses to the other at the speed of light, is answered in the other's
//   own part of a turn once it has arrived, and is sealed only when the answer is home; binding
//   itself costs each its own accord, and a refusal gives the proposer's back;
// - its work is real: Open Archives shares a part of what each learns, Mutual Aid beams energy
//   to a partner in trouble (seen at light speed, and the beam as long again), Shared Watch stands
//   each a little stronger against the Hunger;
// - we hear of a pact between two others when its light reaches our capital;
// - one whose game is over takes its pacts with it.
import { asCiv, flushOutbox } from '../../../src/game/civs';
import { newGame } from '../../../src/game/newGame';
import { baseRegard, distanceBetween, planTies, tieOf, tiePacts, tiesTurn, watchPartners } from '../../../src/game/sim/ties';
import type { GameState } from '../../../src/game/types';
import { check, done } from '../lib';

const fresh = () => newGame({ seed: 1000, survivors: 3 });
const s = fresh();
const [a, b, c] = Object.keys(s.survivors).sort();
const rng0 = s.rng;
check(baseRegard(s, a, b) === baseRegard(fresh(), a, b) && Math.abs(baseRegard(s, a, b)) <= 25 && s.rng === rng0, `regard begins from their ways and the seed, never the dice (${baseRegard(s, a, b).toFixed(1)} and ${baseRegard(s, b, a).toFixed(1)})`);

/** A turn of theirs: a's and b's dealings in their own parts, then the ties' turn, and the outbox delivered. */
const turn = (g: GameState) => {
  for (const id of [a, b, c]) asCiv(g, id, () => planTies(g, 30));
  tiesTurn(g);
  flushOutbox(g);
};
const warm = (g: GameState) => {
  const t = tieOf(g, a, b);
  t.regard[a] = t.regard[b] = 60;
  const t2 = tieOf(g, a, c);
  t2.regard[a] = t2.regard[c] = -60;
  const t3 = tieOf(g, b, c);
  t3.regard[b] = t3.regard[c] = -60;
  for (const id of [a, b, c]) g.civs[id].accord = 200;
  return t;
};

// a proposal at the speed of light, both ways
{
  const g = fresh();
  const t = warm(g);
  const ly = distanceBetween(g, a, b);
  turn(g);
  const p = t.proposal!;
  check(!!p && p.from === a && p.kind === 'archives' && Math.abs(p.arrives - (g.years + ly)) < 1e-6 * g.years && g.civs[a].accord === 200 - p.cost, `the warmer of them proposes Open Archives, paying ${p?.cost} accord; it reaches the other in ${Math.round(ly)} years`);
  turn(g);
  check(!p.answer && tiePacts(g, a, b).length === 0, 'before it arrives, nothing is answered');
  g.years = p.arrives;
  turn(g);
  check(!!p.answer?.yes && g.civs[b].accord === 200 - p.cost && tiePacts(g, a, b).length === 0, `once it has arrived, the other agrees in its own part of a turn, paying as much, and the answer sets out back (${Math.round(p.answer ? p.answer.arrives - g.years : 0)} years)`);
  g.years = p.answer!.arrives;
  turn(g);
  check(tiePacts(g, a, b).join() === 'archives' && !t.proposal, 'when the answer is home, the pact is in force');
  // its work: a part of what each learns
  g.civs[a].flags.last_insight = 100;
  g.civs[b].flags.last_insight = 0;
  const bank = g.civs[b].flags.insight_bank ?? 0;
  tiesTurn(g);
  flushOutbox(g);
  check(Math.abs((g.civs[b].flags.insight_bank ?? 0) - bank - 3) < 1e-9, `Open Archives: each reads 3% of what the other learns (${((g.civs[b].flags.insight_bank ?? 0) - bank).toFixed(2)} of 100)`);
  // we hear of it when its light reaches us
  const heard = () => g.civs[g.player].log.some((l) => /have bound themselves by Open Archives/.test(l.text));
  const due = g.tidings?.[0]?.at ?? Infinity;
  check(!!g.tidings?.length || heard(), 'its news sets out toward us');
  if (!heard()) {
    g.years = due;
    tiesTurn(g);
  }
  check(heard() && t.heard?.archives === true, 'and we hear of it when its light reaches our capital');
}

// a refusal gives the proposer's accord back
{
  const g = fresh();
  const t = warm(g);
  turn(g);
  const p = t.proposal!;
  t.regard[b] = -40;
  g.years = p.arrives;
  turn(g);
  check(p.answer?.yes === false && g.civs[b].accord === 200, 'one that does not think well enough of the other declines, paying nothing');
  const before = g.civs[a].accord;
  g.years = p.answer!.arrives;
  turn(g);
  check(tiePacts(g, a, b).length === 0 && g.civs[a].accord >= before + p.cost - 1e-9, `the refusal comes home, and the proposer's accord with it (+${p.cost})`);
}

// Mutual Aid: a partner in trouble is helped, the beam crossing the dark; Shared Watch; one gone
{
  const g = fresh();
  const t = tieOf(g, a, b);
  t.pacts = { aid: g.turn, watch: g.turn };
  g.civs[a].energy = 10;
  g.civs[a].flags.last_energy_net = -3;
  g.civs[b].energy = 400;
  const e0 = g.civs[b].energy;
  tiesTurn(g);
  flushOutbox(g);
  const beam = t.beams?.[0];
  check(!!beam && beam.to === a && g.civs[b].energy === e0 - beam.energy && g.civs[a].energy === 10, `Mutual Aid: the strong one beams ${beam?.energy} energy to the one in trouble, still crossing the dark`);
  g.years = beam!.at;
  tiesTurn(g);
  flushOutbox(g);
  check(g.civs[a].energy === 10 + beam!.energy && !t.beams, 'and it arrives');
  check(watchPartners(g, a) === 1 && watchPartners(g, c) === 0, 'Shared Watch: each stands a little stronger against the Hunger');
  g.civs[b].outcome = { kind: 'defeat', ending: 'test', turn: g.turn, eta: g.eta };
  tiesTurn(g);
  check(tiePacts(g, a, b).length === 0, 'one whose game is over takes its pacts with it');
}

done('TIES');
