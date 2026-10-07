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
import { sendSignal, voiceClock } from '../../../src/game/sim/signals';
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
void clone;
done('NEIGHBOURS');
