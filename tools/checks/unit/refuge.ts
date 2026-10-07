// Refuge (living neighbours, phase 2). A dying civilization that trusts us (a pact, or Sanctuary
// and goodwill of 20) asks once to come to us. Our answer crosses at the speed of light and they
// set out when it arrives, flesh by ship (0.02 c), minds as light; on the way nothing drains them.
// They arrive where we have room (Kin also asleep in free berths, Echoes in the archive, the rest
// crowded in at the capital), with their archive, and their fate is 'saved'; everyone else hears
// of it. The Choir, if we merge minds too, joins our Chorus and is 'absorbed', the rest of it as
// memory. Sanctuary is heard of when its light arrives, and then trusted, up to 25.
import { autoPlay } from '../../../src/game/auto';
import { newGame } from '../../../src/game/newGame';
import { endTurn } from '../../../src/game/sim/turn';
import { enactCharter, repealCharter } from '../../../src/game/sim/actions';
import { resolveSurvivorSignal, updateSurvivors } from '../../../src/game/sim/survivors';
import { deliverSignals, voiceClock } from '../../../src/game/sim/signals';
import { EXODUS_SPEED, SANCTUARY_TRUST, askRefuge, exodusSize, roomFor } from '../../../src/game/sim/refuge';
import { computeMods } from '../../../src/game/sim/mods';
import { turnStep } from '../../../src/game/sim/flare';
import { logTurnLength } from '../../../src/game/eras';
import { capital, colonies, distLy } from '../../../src/game/sim/util';
import type { GameState, Survivor, ThreadId } from '../../../src/game/types';
import { check, done } from '../lib';

const clone = (s: GameState) => JSON.parse(JSON.stringify(s)) as GameState;
const base = (() => {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' });
  for (let g = 0; g < 30 && !s.outcome; g++) {
    autoPlay(s, 'competent');
    endTurn(s);
  }
  s.pending.length = 0;
  s.signals.length = 0;
  s.civ.taint = 0;
  return s;
})();
/** A copy of the game, with one civilization in contact, in step with us, dying and well disposed. */
const setup = (way: Survivor['way']) => {
  const s = clone(base);
  const sv = Object.values(s.survivors)[0];
  for (const o of Object.values(s.survivors)) if (o !== sv) o.alive = false;
  Object.assign(sv, { alive: true, contact: true, way, health: 0.15, pop: 24, disposition: 30, lastSent: -99 });
  delete sv.fate;
  delete sv.pacts;
  s.civ.charters = s.civ.charters.filter((x) => x !== 'sanctuary');
  sv.clock = voiceClock(s, logTurnLength(turnStep(s)));
  return { s, sv };
};
const ly = (s: GameState, sv: Survivor) => distLy(s.systems[capital(s)!.systemId], s.systems[sv.homeSystemId]);
/** One turn of their lives, with our clock as it is now. */
const theirTurn = (s: GameState) => {
  const step = turnStep(s);
  updateSurvivors(s, logTurnLength(step), computeMods(s), step.turnLength);
};
/** Move time on by `years` without playing a turn (enough for light, or ships, to cross). */
const later = (s: GameState, years: number) => {
  s.years += years;
  s.eta = Math.log10(s.years);
};
const people = (s: GameState, t: ThreadId) => colonies(s).reduce((a, c) => a + c.pops[t] + (t === 'kin' ? c.cryo : 0), 0);
const insight = (s: GameState) => (s.civ.researching ? (s.civ.research[s.civ.researching] ?? 0) : 0) + (s.civ.flags.insight_bank ?? 0);
/** Their request reaches us, and we answer it. */
const answer = (s: GameState, choice: string) => {
  const sig = s.signals.find((x) => x.kind === 'exodus' && !x.resolved)!;
  s.years = Math.max(s.years, sig.arriveYears);
  deliverSignals(s);
  return resolveSurvivorSignal(s, sig.uid, choice);
};

// ---------------------------------------------------------------- who may come
{
  const { s, sv } = setup('garden');
  check(!askRefuge(s, sv), 'a dying civilization with no pact and no Sanctuary does not ask');
  sv.pacts = { archives: s.turn };
  sv.disposition = -5;
  check(!askRefuge(s, sv), 'nor one that does not think well of us, pact or not');
  sv.disposition = 30;
  sv.health = 0.3;
  check(!askRefuge(s, sv), 'nor one that is not yet dying');
  sv.health = 0.15;
  check(askRefuge(s, sv), 'a dying partner asks to come to us');
  const sig = s.signals.find((x) => x.kind === 'exodus');
  check(!!sig && Number(sig.data.n) === exodusSize(sv) && exodusSize(sv) === 8 && sv.exodusAsked === s.turn, `their request: ${exodusSize(sv)} of their ${sv.pop} people, "${sig?.choices[0].hint}"`);
  check(!askRefuge(s, sv), 'they ask once');
  const t = clone(s);
  t.survivors[sv.id].exodusAsked = undefined;
  delete t.survivors[sv.id].pacts;
  t.civ.charters.push('sanctuary');
  check(askRefuge(t, t.survivors[sv.id]), 'with Sanctuary, anyone who thinks well of us (20 or more) asks too');
  t.survivors[sv.id].exodusAsked = undefined;
  t.survivors[sv.id].disposition = 15;
  check(!askRefuge(t, t.survivors[sv.id]), 'but not below 20');
}

// ---------------------------------------------------------------- flesh, by ship
{
  const { s, sv } = setup('garden');
  sv.pacts = { aid: s.turn };
  askRefuge(s, sv);
  const d = ly(s, sv);
  const kin = people(s, 'kin');
  const room = roomFor(s, 'kin');
  const known = insight(s);
  check(answer(s, 'take') === null && !!sv.exodus, 'we take them in');
  const ex = sv.exodus!;
  check(Math.abs(ex.leaves - (s.years + d)) < 1e-6 && Math.abs(ex.at - (ex.leaves + d / EXODUS_SPEED)) < 1e-3 * d, `they set out when our answer reaches them (${d.toFixed(0)} ly) and cross by ship at ${EXODUS_SPEED} c`);
  later(s, d * 0.5);
  const h = sv.health;
  theirTurn(s);
  check(sv.alive && !!sv.exodus && sv.health !== h, 'until our answer reaches them, they are at home, and the age goes on draining them');
  later(s, d);
  const h2 = sv.health;
  theirTurn(s);
  check(sv.alive && sv.health === h2 && !!sv.exodus, 'on their way, nothing drains them');
  const pop = sv.pop;
  later(s, d / EXODUS_SPEED);
  const n = s.signals.length;
  theirTurn(s);
  check(!sv.alive && sv.fate === 'saved' && !sv.exodus, 'they arrive: their fate is saved');
  const came = people(s, 'kin') - kin;
  check(came === 8, `all 8 live among us (room for ${room} awake or asleep; the rest crowd in at the capital)`);
  check(Math.round(insight(s) - known) === Math.round(60 + pop * 4), `their archive is ours (${Math.round(insight(s) - known)} insight)`);
  check(s.signals.slice(n).some((x) => x.kind === 'arrived'), 'they tell us they have arrived');
  check(s.log.slice(-3).some((l) => /has come to us: /.test(l.text)), `the Record says so: "${s.log[s.log.length - 1].text}"`);
}

// ---------------------------------------------------------------- the others hear of it
{
  const { s, sv } = setup('garden');
  const other = Object.values(s.survivors).find((o) => o !== sv)!;
  Object.assign(other, { alive: true, contact: true, disposition: 0, health: 0.9 });
  delete other.fate;
  sv.pacts = { aid: s.turn };
  askRefuge(s, sv);
  answer(s, 'take');
  later(s, sv.exodus!.at - s.years);
  theirTurn(s);
  const news = (other.news ?? []).find((x) => /took in/.test(x.what));
  check(sv.fate === 'saved' && !!news && news.delta === 8, `every other civilization hears of it when the light arrives (+${news?.delta})`);
}

// ---------------------------------------------------------------- minds, as light
{
  const { s, sv } = setup('upload');
  sv.pacts = { archives: s.turn };
  askRefuge(s, sv);
  const d = ly(s, sv);
  const echoes = people(s, 'echoes') + (s.civ.flags.echo_archive ?? 0);
  answer(s, 'take');
  check(Math.abs(sv.exodus!.at - (sv.exodus!.leaves + d)) < 1e-6 * d, 'uploaded minds cross as light');
  later(s, 2 * d);
  theirTurn(s);
  const now = people(s, 'echoes') + (s.civ.flags.echo_archive ?? 0);
  check(sv.fate === 'saved' && now - echoes === 8, `8 Echoes among us, any without substrate waiting in the archive (${s.civ.flags.echo_archive ?? 0})`);
}

// ---------------------------------------------------------------- the Choir
{
  const { s, sv } = setup('chorus');
  sv.disposition = 12;
  const noMerge = clone(s);
  noMerge.civ.techs = noMerge.civ.techs.filter((x) => x !== 'mind_merging');
  check(!askRefuge(noMerge, noMerge.survivors[sv.id]), 'the Choir with no pact asks nothing of a civilization that does not merge minds');
  if (!s.civ.techs.includes('mind_merging')) s.civ.techs.push('mind_merging');
  const cap = capital(s)!;
  cap.structures.confluence_node = 1;
  cap.pops.chorus = 0;
  check(askRefuge(s, sv), 'one that does, it asks to join');
  const sig = s.signals.find((x) => x.kind === 'exodus')!;
  check(/join our Chorus/.test(sig.title) && sig.choices[0].label === 'Open the Confluence', `"${sig.title}"`);
  const room = roomFor(s, 'chorus');
  const chorus = people(s, 'chorus');
  const known = insight(s);
  const pop = sv.pop;
  answer(s, 'take');
  later(s, 2 * ly(s, sv));
  theirTurn(s);
  const joined = people(s, 'chorus') - chorus;
  check(sv.fate === 'absorbed' && joined === Math.min(8, room), `absorbed: ${joined} join our Chorus (room for ${room})`);
  check(Math.round(insight(s) - known) === Math.round(60 + pop * 4 + (8 - joined) * 20), `the rest join us as memory (${Math.round(insight(s) - known)} insight)`);
}

// ---------------------------------------------------------------- declined, and too late
{
  const { s, sv } = setup('garden');
  sv.pacts = { aid: s.turn };
  askRefuge(s, sv);
  check(answer(s, 'refuse') === null && !sv.exodus && !askRefuge(s, sv), 'turned away, they do not ask again');
}
{
  const { s, sv } = setup('garden');
  sv.pacts = { aid: s.turn };
  askRefuge(s, sv);
  answer(s, 'take');
  sv.health = 0.01;
  theirTurn(s);
  check(!sv.alive && sv.fate === 'faded' && !sv.exodus && s.log.some((l) => /too late/.test(l.text)), 'if they go dark before our answer reaches them, it was too late');
  const t = setup('garden');
  t.sv.pacts = { aid: t.s.turn };
  askRefuge(t.s, t.sv);
  t.sv.alive = false;
  check(answer(t.s, 'take') === 'They are gone: they went dark before our answer could reach them.', 'and we cannot take in the dead');
}

// ---------------------------------------------------------------- Sanctuary is heard of, and trusted
{
  const { s, sv } = setup('garden');
  Object.assign(sv, { health: 0.9, disposition: 0 });
  if (!s.civ.techs.includes('the_long_record')) s.civ.techs.push('the_long_record');
  s.civ.charters = []; // an empty book, with room for it
  s.civ.accord = 500;
  const d = ly(s, sv);
  check(enactCharter(s, 'sanctuary') === null, 'Sanctuary enacted');
  const news = (sv.news ?? []).find((x) => x.tag === 'sanctuary');
  check(!!news && news.delta === 10 && Math.abs(news.at - (s.years + d)) < 1e-6, 'every civilization will hear of it when the light arrives');
  later(s, d * 0.5);
  theirTurn(s);
  check(sv.disposition === 0, 'before then, nothing changes');
  later(s, d);
  theirTurn(s);
  check(sv.disposition === 10.5, `then they think better of us (+10), and the open door is trusted (${sv.disposition})`);
  for (let i = 0; i < 60; i++) {
    sv.health = 0.9;
    theirTurn(s);
  }
  check(sv.disposition === SANCTUARY_TRUST, `up to ${SANCTUARY_TRUST} (${sv.disposition})`);
  sv.disposition = -20;
  for (let i = 0; i < 5; i++) {
    sv.health = 0.9;
    theirTurn(s);
  }
  check(sv.disposition === -20, 'an open door does not move an enemy');
  check(repealCharter(s, 'sanctuary') === null && (sv.news ?? []).some((x) => x.tag === 'sanctuary' && x.delta === -10), 'closing the door is heard of too (−10)');
}

done('REFUGE');
