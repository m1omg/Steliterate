// Living neighbours. Phase 0, honesty: energy we send travels as a beam and helps when the light
// gets there; what we do to one civilization reaches the others when its light does; the Hunger in
// us caps how well anyone can think of us; those we raided into the dark leave us nothing; asking
// needs clocks in step; refugees come only as far as we have room; nothing is sent to the dead; a
// fork with no settlement of its own finds a star of its own.
import { autoPlay } from '../../../src/game/auto';
import { newGame } from '../../../src/game/newGame';
import { endTurn } from '../../../src/game/sim/turn';
import { sendAid, devour } from '../../../src/game/sim/actions';
import { askBlocked, inStep, resolveSurvivorSignal, updateSurvivors } from '../../../src/game/sim/survivors';
import { deliverSignals, sendSignal, voiceClock } from '../../../src/game/sim/signals';
import { acceptOffer, answerArrived, endPact, hasPact, pactBlocked, pactCost, pactsTurn, proposePact, theirPacts } from '../../../src/game/sim/pacts';
import { computeMods } from '../../../src/game/sim/mods';
import { capacity } from '../../../src/game/sim/economy';
import { turnStep } from '../../../src/game/sim/flare';
import { fork } from '../../../src/game/sim/society';
import { logTurnLength } from '../../../src/game/eras';
import { capital, distLy } from '../../../src/game/sim/util';
import type { GameState, Survivor } from '../../../src/game/types';
import { check, done } from '../lib';

const clone = (s: GameState) => JSON.parse(JSON.stringify(s)) as GameState;
const game = (turns: number) => {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' });
  for (let g = 0; g < turns && !s.outcome; g++) {
    autoPlay(s, 'competent');
    endTurn(s);
  }
  s.pending.length = 0;
  return s;
};
const first = (s: GameState): Survivor => {
  const sv = Object.values(s.survivors).find((x) => x.alive)!;
  sv.contact = true;
  return sv;
};
const ly = (s: GameState, sv: Survivor) => distLy(s.systems[capital(s)!.systemId], s.systems[sv.homeSystemId]);
/** One turn of their lives, with our clock as it is now. */
const theirTurn = (s: GameState) => {
  const step = turnStep(s);
  updateSurvivors(s, logTurnLength(step), computeMods(s), step.turnLength);
};
/** Move time on by `years` without playing a turn (enough for light to cross). */
const later = (s: GameState, years: number) => {
  s.years += years;
  s.eta = Math.log10(s.years);
};

// ---------------------------------------------------------------- a beam of energy
{
  const s = game(30);
  const sv = first(s);
  sv.clock = voiceClock(s, logTurnLength(turnStep(s)));
  sv.health = 0.5;
  s.civ.energy = 500;
  const d = ly(s, sv);
  check(sendAid(s, sv.id, 100) === null && s.civ.energy === 400, 'sending 100 energy takes it from our reserve at once');
  check(sv.health === 0.5 && sv.beams?.length === 1 && Math.abs(sv.beams[0].at - (s.years + d)) < 1e-6, `it crosses ${d.toFixed(0)} ly as a beam, and has not reached them`);
  later(s, d * 0.5);
  theirTurn(s);
  check(sv.beams?.length === 1 && sv.aidGiven === 0, 'halfway, they have nothing yet');
  const disp = sv.disposition;
  later(s, d * 0.6);
  theirTurn(s);
  check(sv.beams?.length === 0 && sv.aidGiven === 100 && sv.disposition > disp, `when the light gets there it helps, and they know it was us (trust ${disp.toFixed(0)} → ${sv.disposition.toFixed(0)})`);
  // out of step: the energy helps, but they cannot tell where it came from
  sv.clock += 12;
  check(!inStep(s, sv), 'with clocks twelve tenfolds apart we are out of step');
  const before = sv.disposition;
  sendAid(s, sv.id, 25);
  later(s, d * 1.1);
  theirTurn(s);
  check(sv.disposition <= before && sv.aidGiven === 100, 'out of step, the beam helps them but earns no trust');
  check(askBlocked(s, sv) === 'Our clocks are too far apart: they could not hear the question.', 'and we cannot ask them for anything');
}

// ---------------------------------------------------------------- a plea answered, and the dead
{
  const s = game(30);
  const sv = first(s);
  s.civ.energy = 300;
  const plea = () => sendSignal(s, { from: sv.id, kind: 'aid', distanceLy: 0, title: 'help', text: 'help', data: { ask: 30 }, choices: [{ id: 'give', label: 'give' }, { id: 'refuse', label: 'refuse' }] });
  const a = plea();
  check(resolveSurvivorSignal(s, a.uid, 'give') === null && s.civ.energy === 270 && !!sv.beams?.some((b) => b.plea && b.energy === 30), 'answering a plea sends a beam');
  sv.alive = false;
  sv.fate = 'faded';
  const b = plea();
  const err = resolveSurvivorSignal(s, b.uid, 'give');
  check(err === 'They are gone: there is no one left to send it to.' && s.civ.energy === 270, `nothing is sent to the dead (${err})`);
}

// ---------------------------------------------------------------- what we do is heard when the light arrives
{
  const s = game(30);
  // two of them, alive and in touch (whatever this seed has done to them by now)
  for (const x of Object.values(s.survivors).slice(0, 2)) {
    x.alive = true;
    delete x.fate;
    x.health = Math.max(x.health, 0.5);
  }
  const alive = Object.values(s.survivors).filter((x) => x.alive);
  if (alive.length < 2) {
    check(false, `this check needs two neighbours alive (${alive.length})`);
  } else {
    const [victim, witness] = alive;
    victim.contact = witness.contact = true;
    victim.health = 0.3;
    s.civ.charters.push('absorb_the_weak');
    witness.disposition = 30;
    const far = distLy(s.systems[victim.homeSystemId], s.systems[witness.homeSystemId]);
    check(devour(s, victim.id) === null && !victim.alive, `we devour ${victim.name}`);
    check(witness.disposition === 30 && witness.news?.length === 1, `${witness.name}, ${far.toFixed(0)} ly from it, has not seen it yet`);
    later(s, far * 1.01);
    theirTurn(s);
    check(witness.disposition <= -10 && !witness.news?.length, `its light arrives, and they think less of us (${witness.disposition.toFixed(0)})`);
  }
}

// ---------------------------------------------------------------- the Hunger in us
{
  const s = game(30);
  const sv = first(s);
  sv.disposition = 50;
  s.civ.taint = 60;
  theirTurn(s);
  check(Math.abs(sv.disposition - 48) < 1e-9, `with Taint 60 their regard sinks toward 10, two a turn (${sv.disposition})`);
  for (let i = 0; i < 40; i++) theirTurn(s);
  check(Math.abs(sv.disposition - 10) < 1e-9, `and stays there (${sv.disposition.toFixed(1)})`);
}

// ---------------------------------------------------------------- raided into the dark
{
  const s = game(30);
  const sv = first(s);
  sv.health = 0.01;
  sv.raidedAt = s.turn - 2;
  const n = s.signals.length;
  theirTurn(s);
  check(!sv.alive && !s.signals.slice(n).some((x) => x.kind === 'last'), 'a civilization we raided into the dark sends us no last transmission');
}

// ---------------------------------------------------------------- refugees, only as many as we have room for
{
  const s = game(30);
  const sv = first(s);
  sv.way = 'upload';
  sv.pop = 200;
  const capC = capital(s)!;
  capC.structures.substrate_core = (capC.structures.substrate_core ?? 0) + 1;
  const mods = computeMods(s);
  let room = 0;
  for (const c of Object.values(s.colonies)) room += Math.max(0, capacity(s, c, mods).echoes - c.pops.echoes);
  const ask = room + 7;
  const sig = sendSignal(s, { from: sv.id, kind: 'refugees', distanceLy: 0, title: 'refugees', text: '', data: { n: ask }, choices: [{ id: 'accept', label: 'accept' }, { id: 'refuse', label: 'refuse' }] });
  const before = Object.values(s.colonies).reduce((a, c) => a + c.pops.echoes, 0);
  const err = resolveSurvivorSignal(s, sig.uid, 'accept');
  const after = Object.values(s.colonies).reduce((a, c) => a + c.pops.echoes, 0);
  if (room === 0) check(err === 'We have no room for them.', `with no room for Echoes they cannot come (${err})`);
  else check(err === null && after - before === room && Math.abs(sv.pop - (200 - room * 2)) < 1e-9, `${ask} want to come, ${room} find room (${before} → ${after} Echoes)`);
}

// ---------------------------------------------------------------- a fork's home
{
  const s = game(60);
  const cap = capital(s)!;
  // Echoes, a minority everywhere, so no settlement leaves with them
  for (const c of Object.values(s.colonies)) {
    c.pops.echoes = 1;
    c.pops.kin = Math.max(c.pops.kin, 4);
  }
  const ids = new Set(Object.keys(s.survivors));
  fork(s, 'echoes');
  const fk = Object.values(s.survivors).find((x) => !ids.has(x.id));
  check(!!fk && fk.homeSystemId !== s.civ.homeSystemId && fk.homeSystemId !== cap.systemId && !Object.values(s.colonies).some((c) => c.systemId === fk.homeSystemId), `a fork with no settlement goes to a star of its own (${fk ? s.systems[fk.homeSystemId].name : 'none'})`);
}
// ================================================================ phase 1: pacts
{
  const s = game(30);
  const sv = first(s);
  sv.clock = voiceClock(s, logTurnLength(turnStep(s)));
  sv.disposition = 40;
  sv.health = 0.8;
  s.civ.accord = 500;
  const d = ly(s, sv);
  check(pactCost(s) === 30, `the first pact costs 30 accord (${pactCost(s)})`);
  check(proposePact(s, sv.id, 'aid') === null && s.civ.accord === 470 && !!sv.proposal && Math.abs(sv.proposal.at - (s.years + d)) < 1e-6, 'proposing Mutual Aid spends it, and the proposal sets out at light speed');
  check(pactCost(s) === 48 && pactBlocked(s, sv, 'archives') === 'Our proposal of Mutual Aid is still crossing to them, or their answer is.', `the next is dearer (${pactCost(s)}), and one proposal at a time`);
  later(s, d * 1.01);
  const n = s.signals.length;
  theirTurn(s);
  const answer = s.signals.slice(n).find((x) => x.kind === 'pact_answer');
  check(!!answer && Number(answer.data.yes) === 1 && Math.abs(answer.arriveYears - (s.years + d)) < 1e-6, 'it reaches them, they agree, and their answer sets out back');
  check(!hasPact(sv, 'aid'), 'not yet in force: the answer is still on its way');
  const n2 = s.signals.length;
  theirTurn(s);
  check(!s.signals.slice(n2).some((x) => x.kind === 'pact_answer'), 'they answer once, not every turn the answer is on its way');
  later(s, d * 1.01);
  for (const x of deliverSignals(s)) if (x.kind === 'pact_answer') answerArrived(s, x.from, x.data);
  check(hasPact(sv, 'aid') && !sv.proposal, 'when their answer arrives, Mutual Aid is in force');
  // a refusal gives the accord back
  sv.disposition = -5;
  const acc = s.civ.accord;
  proposePact(s, sv.id, 'watch');
  later(s, d * 1.01);
  theirTurn(s);
  later(s, d * 1.01);
  for (const x of deliverSignals(s)) if (x.kind === 'pact_answer') answerArrived(s, x.from, x.data);
  check(!hasPact(sv, 'watch') && s.civ.accord === acc, `wary of us, they decline Shared Watch, and the accord comes back (${s.civ.accord})`);
  // Mutual Aid, both ways
  sv.disposition = 40;
  sv.health = 0.2;
  s.civ.energy = 1000;
  pactsTurn(s);
  check(s.civ.energy < 1000 && !!sv.beams?.some((b) => b.plea), `they are failing: help goes to them unasked (${1000 - s.civ.energy} energy)`);
  sv.health = 0.8;
  s.civ.energy = 1;
  s.civ.flags.last_energy_net = -5;
  const m = s.signals.length;
  pactsTurn(s);
  const help = s.signals.slice(m).find((x) => x.kind === 'aid_answer');
  check(!!help && Number(help.data.energy) > 0 && Math.abs(help.arriveYears - (s.years + 2 * d)) < 1e-6, `we are failing: their help comes, after they see it and their beam crosses back (${help?.data.energy})`);
  // Open Archives
  acceptOffer(s, sv, 'archives');
  check(hasPact(sv, 'archives'), 'an offered pact accepted is in force at once');
  const r = s.civ.researching;
  const before = r ? s.civ.research[r] ?? 0 : s.civ.flags.insight_bank ?? 0;
  pactsTurn(s);
  const after = r ? s.civ.research[r] ?? 0 : s.civ.flags.insight_bank ?? 0;
  check(after > before, `Open Archives: a little insight every turn (+${(after - before).toFixed(2)})`);
  // breaking one is heard
  const others = Object.values(s.survivors).filter((x) => x.alive && x.id !== sv.id);
  check(endPact(s, sv.id, 'archives') === null && !hasPact(sv, 'archives') && sv.news?.some((x) => x.delta === -25) === true && others.every((o) => o.news?.some((x) => x.delta === -10)), 'breaking a pact: they hear it first and worst, everyone else when the light arrives');
  // they renounce what they no longer believe in
  sv.disposition = -15;
  sv.lastSent = -99;
  const k = s.signals.length;
  check(theirPacts(s, sv, () => 0.5) && !hasPact(sv, 'aid') && s.signals.slice(k).some((x) => x.kind === 'pact_ended'), 'turned against us, they renounce every pact');
}
void clone;
done('NEIGHBOURS');
