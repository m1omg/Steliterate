// How the other civilizations deal with us. Each way of life asks for what it lacks (gardens and
// the Tessellate matter, minds energy; matter-wanters energy once matter is gone) and gives notes
// on what we are researching, saying exactly what it asks and gives, never more than half of
// what we hold, and nothing once there is nothing left to learn. Each keeps its own rhythm and
// waits twice as long after every refusal; a yes resets it. Shared works too. Raiders our
// defences turned away wait before trying again. They offer the pact they need most. And they
// remember why they feel as they do, whatever moved them. An offer from an older save keeps its
// old terms.
import { autoPlay } from '../../../src/game/auto';
import { newGame } from '../../../src/game/newGame';
import { endTurn } from '../../../src/game/sim/turn';
import { resolveSurvivorSignal, updateSurvivors } from '../../../src/game/sim/survivors';
import { deliverSignals, sendSignal, voiceClock } from '../../../src/game/sim/signals';
import { ASK_MIN, MEMORY, answered, feel, offerDue, offered, termsFor, tradeOffer } from '../../../src/game/sim/dealings';
import { theirPacts } from '../../../src/game/sim/pacts';
import { computeMods } from '../../../src/game/sim/mods';
import { turnStep } from '../../../src/game/sim/flare';
import { techCost } from '../../../src/game/sim/research';
import { logTurnLength } from '../../../src/game/eras';
import { capital } from '../../../src/game/sim/util';
import { TECH_BY_ID } from '../../../src/game/data/techs';
import { EVENT_BY_ID } from '../../../src/game/data/events';
import { fork } from '../../../src/game/sim/society';
import { Rng } from '../../../src/game/rng';
import type { GameState, Survivor } from '../../../src/game/types';
import { check, done } from '../lib';

const clone = (s: GameState) => JSON.parse(JSON.stringify(s)) as GameState;
const base = (() => {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' });
  for (let g = 0; g < 40 && !s.outcome; g++) {
    autoPlay(s, 'competent');
    endTurn(s);
  }
  s.pending.length = 0;
  s.signals.length = 0;
  s.swarms = {};
  s.civ.taint = 0;
  return s;
})();
const setup = (way: Survivor['way']) => {
  const s = clone(base);
  const sv = Object.values(s.survivors)[0];
  for (const o of Object.values(s.survivors)) if (o !== sv) o.alive = false;
  Object.assign(sv, { alive: true, contact: true, way, health: 0.8, pop: 24, disposition: 10, lastSent: -99 });
  delete sv.fate;
  delete sv.pacts;
  sv.clock = voiceClock(s, logTurnLength(turnStep(s)));
  s.civ.energy = 200;
  s.civ.matter = 200;
  return { s, sv };
};
const theirTurn = (s: GameState) => {
  const step = turnStep(s);
  updateSurvivors(s, logTurnLength(step), computeMods(s), step.turnLength);
};
const answer = (s: GameState, kind: string, choice: string) => {
  const sig = s.signals.find((x) => x.kind === kind && !x.resolved)!;
  s.years = Math.max(s.years, sig.arriveYears);
  deliverSignals(s);
  return resolveSurvivorSignal(s, sig.uid, choice);
};

// ---------------------------------------------------------------- what each way wants
{
  const { s, sv } = setup('upload');
  check(termsFor(sv).want === 'energy', 'the Archive (minds) asks for energy');
  sv.way = 'garden';
  check(termsFor(sv).want === 'matter', 'gardens ask for matter');
  sv.way = 'lattice';
  check(termsFor(sv).want === 'matter' && offerDue(s, sv, 'trade', () => 1), 'the Tessellate asks for matter, on its rhythm exactly (no chance about it)');
  sv.way = 'fork';
  sv.forkOf = 'kin';
  check(termsFor(sv).want === 'matter' && termsFor(sv).every > termsFor({ ...sv, way: 'garden' } as Survivor).every, 'a fork of our Kin deals as a garden, less often');
}

// ---------------------------------------------------------------- an offer says what it asks and gives
{
  const { s, sv } = setup('upload');
  const r = s.civ.researching!;
  const o = tradeOffer(s, sv)!;
  check(!!o && o.want === 'energy' && o.tech === r && o.ask >= ASK_MIN && o.insight > 0, `an offer: ${o?.ask} ${o?.want} for ${o?.insight} insight, their notes on ${o?.techName}`);
  check(o.insight <= Math.round(techCost(s, r) * 0.3), 'worth a share of our project, no more');
  let fair = true;
  for (const way of ['upload', 'garden', 'chorus', 'lattice', 'dormant'] as const) {
    for (const h of [0.2, 0.5, 0.9]) {
      const x = tradeOffer(s, { ...sv, way, health: h });
      if (x && Math.abs(x.insight / x.ask - termsFor({ ...sv, way }).rate) > termsFor({ ...sv, way }).rate * 0.1) fair = false;
    }
  }
  check(fair, 'every way, every state: always at their own rate, never a lopsided deal');
  s.civ.energy = 2 * ASK_MIN + 1;
  const poor = tradeOffer(s, sv);
  check(!!poor && poor.ask <= Math.floor(s.civ.energy / 2), `never more than half of what we hold (${poor?.ask} of ${s.civ.energy})`);
  s.civ.energy = 2 * ASK_MIN - 1;
  check(tradeOffer(s, sv) === null, 'and nothing at all when we could not spare even that');
  s.civ.energy = 200;
  // their turn, with their rhythm allowing it
  s.civ.flags[`trade_next_${sv.id}`] = 0;
  let sent = false;
  for (let i = 0; i < 40 && !sent; i++) {
    sv.lastSent = -99;
    theirTurn(s);
    sent = s.signals.some((x) => x.kind === 'trade');
  }
  const sig = s.signals.find((x) => x.kind === 'trade')!;
  check(sent && new RegExp(`^We have notes on ${TECH_BY_ID[r].name} we cannot use, and we need energy\\. \\d+ energy for \\d+ insight\\?$`).test(sig.text), `the message says it all: "${sig?.text}"`);
  const insight = Number(sig.data.insight);
  const ask = Number(sig.data.ask);
  const before = s.civ.research[r] ?? 0;
  check(answer(s, 'trade', 'trade') === null && s.civ.energy === 200 - ask && Math.abs((s.civ.research[r] ?? 0) - before - insight) < 1e-9, `accepted: ${ask} energy for exactly ${insight} insight toward ${TECH_BY_ID[r].name}`);
  check((sv.memory ?? []).some((m) => m.what === 'you traded with us'), 'and they remember it');
}

// ---------------------------------------------------------------- patience
{
  const { s, sv } = setup('upload');
  const every = termsFor(sv).every;
  offered(s, sv, 'trade');
  check(!offerDue(s, sv, 'trade', () => 0), 'after an offer, nothing until their rhythm comes round');
  answered(s, sv, 'trade', false);
  check(s.civ.flags[`trade_next_${sv.id}`] === s.turn + every * 2, `a refusal: they wait twice as long (${every * 2} turns)`);
  answered(s, sv, 'trade', false);
  check(s.civ.flags[`trade_next_${sv.id}`] === s.turn + every * 4, `two in a row: four times (${every * 4})`);
  answered(s, sv, 'trade', true);
  check(s.civ.flags[`trade_next_${sv.id}`] === s.turn + every && s.civ.flags[`trade_no_${sv.id}`] === undefined, 'a yes, and they are back to their own rhythm');
  for (let i = 0; i < 6; i++) answered(s, sv, 'joint', false);
  check(s.civ.flags[`joint_next_${sv.id}`] === s.turn + every * 8, 'shared works too, and never longer than eight times');
}

// ---------------------------------------------------------------- an offer from an older save
{
  const { s, sv } = setup('upload');
  sendSignal(s, { from: sv.id, kind: 'trade', distanceLy: 0, title: 'old', text: 'old', choices: [{ id: 'trade', label: 'Trade 40 matter' }, { id: 'decline', label: 'Decline' }] });
  const m = s.civ.matter;
  const r = s.civ.researching!;
  const before = s.civ.research[r] ?? 0;
  check(answer(s, 'trade', 'trade') === null && s.civ.matter === m - 40 && Math.abs((s.civ.research[r] ?? 0) - before - (60 + s.turn * 0.5)) < 1e-9, 'an offer from an older save keeps its old terms (40 matter)');
}

// ---------------------------------------------------------------- raiders learn
{
  const { s, sv } = setup('garden');
  Object.assign(sv, { disposition: -60, health: 0.1, lastSent: -99 });
  const cap = capital(s)!;
  cap.structures.defense_grid = 1;
  let tried = false;
  for (let i = 0; i < 40 && !tried; i++) {
    sv.lastSent = -99;
    sv.health = 0.1;
    theirTurn(s);
    tried = s.signals.some((x) => x.kind === 'raid');
  }
  check(tried && s.signals.some((x) => x.title.includes('tried to raid')), 'desperate and hostile, they try to raid us, and our defences turn them away');
  const wait = s.civ.flags[`raid_wait_${sv.id}`];
  check(wait === s.turn + 15, 'then they wait fifteen turns before they try again');
  const n = s.signals.filter((x) => x.kind === 'raid').length;
  for (let i = 0; i < 5; i++) {
    sv.lastSent = -99;
    sv.health = 0.1;
    theirTurn(s);
  }
  check(s.signals.filter((x) => x.kind === 'raid').length === n, 'and do not, meanwhile');
}

// ---------------------------------------------------------------- the pact they need
{
  const { s, sv } = setup('garden');
  Object.assign(sv, { disposition: 50, health: 0.9 });
  const home = s.systems[sv.homeSystemId];
  s.swarms.hgx = { id: 'hgx', systemId: home.id, from: null, to: null, traveled: 0, distance: 0, size: 2, awake: true, tamed: false, appetite: 1 };
  theirPacts(s, sv, () => 0);
  const offer = s.signals.find((x) => x.kind === 'pact_offer');
  check(String(offer?.data.pact) === 'watch', `with the Hunger at their star, they offer a Shared Watch first (${offer?.data.pact})`);
}

// ---------------------------------------------------------------- memory
{
  const { s, sv } = setup('garden');
  for (let i = 0; i < MEMORY + 3; i++) feel(s, sv, i % 2 ? 5 : -5, `thing ${i}`);
  check(sv.memory?.length === MEMORY && sv.memory[MEMORY - 1].what === `thing ${MEMORY + 2}`, `they remember the last ${MEMORY} things, newest last`);
  feel(s, sv, 0.5, 'a trifle');
  check(sv.memory?.[MEMORY - 1].what !== 'a trifle', 'trifles move them but are not remembered');
  feel(s, sv, -500, 'everything');
  check(sv.disposition === -100, 'and their regard stays within −100 and 100');
}

// ---------------------------------------------------------------- every reason is remembered
{
  const { s, sv } = setup('garden');
  const sys = s.systems[sv.homeSystemId];
  const d = sv.disposition;
  EVENT_BY_ID.new_star.choices.find((c) => c.label === 'Tell the others')!.run(s, { systemId: sys.id }, new Rng(1));
  check(sv.disposition === d + 8 && sv.memory?.at(-1)?.what === `you told us of the new star at ${sys.name}`, 'we tell them of a new star: they think better of us, and remember why');
  fork(s, 'echoes');
  const fk = Object.values(s.survivors).find((x) => x.way === 'fork')!;
  check(fk.disposition === -15 && fk.memory?.[0].what === 'we left you', 'a Thread that leaves us remembers why it starts cold');
}
done('DEALINGS');
