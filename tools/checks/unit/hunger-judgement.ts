// Judging a Hunger act (the new version, part 2b, judge.ts; the player's note: "desperate players
// adopting SOME hunger tech should not be viewed as badly as prospering ones").
// - An act's Taint is the actor's at once; its news sets out at the speed of light, and each hearer
//   thinks less of the actor by −0.6 × Taint × (1 − 0.7 × plight): the desperate at 30%.
// - The same step (Hunger Engines) by a desperate civilization and by a prospering one.
// - Our acts reach the neighbours as news carrying their Taint, which they count as heard; past 30
//   they shun us (no pact, no trade, Open Archives closed, and they say why), unless on that path
//   themselves. Their ceiling on what they think of us reads what they have heard, not our Taint.
// - A step through an event (Hear the promise) is heard as any other.
// - Among the others the same ceiling holds: what one has heard of another's Hunger lasts.
// - Another civilization at 100 becomes the Hunger: its capital buds a swarm, the next turn it is
//   gone, and it sends no last transmission: we hear its silence.
import { asCiv, flushOutbox } from '../../../src/game/civs';
import { newGame } from '../../../src/game/newGame';
import { completeTech } from '../../../src/game/sim/research';
import { judgement, heardOfUs, shuns, becomeHunger, HEARD_CEILING, SANCTION_AT } from '../../../src/game/sim/judge';
import { pactBlocked } from '../../../src/game/sim/pacts';
import { tradeOffer } from '../../../src/game/sim/dealings';
import { plight } from '../../../src/game/sim/plight';
import { baseRegard, tieOf, tiesTurn } from '../../../src/game/sim/ties';
import { queueEvent } from '../../../src/game/sim/events';
import { answerEvent } from '../../../src/game/sim/actions';
import { coloniesOf } from '../../../src/game/sim/util';
import { checkEndings } from '../../../src/game/sim/endings';
import { endTurn } from '../../../src/game/sim/turn';
import type { GameState } from '../../../src/game/types';
import { check, done } from '../lib';

check(Math.abs(judgement(12, 0) + 7.2) < 1e-9 && Math.abs(judgement(12, 1) + 7.2 * 0.3) < 1e-9, `a Hunger act of 12 Taint: −7.2 from a prospering civilization, −2.16 from a desperate one`);

/** A game whose first neighbour takes up Hunger Engines, desperate or not; what the second hears. */
function step(desperate: boolean) {
  const s = newGame({ seed: 1000, survivors: 3 });
  const [a, b] = Object.keys(s.survivors).filter((id) => s.civs[id]).sort();
  const civ = s.civs[a];
  for (const t of ['hunger_studies', 'command_language']) if (!civ.techs.includes(t)) civ.techs.push(t);
  if (desperate) {
    civ.energy = 0;
    civ.flags.last_energy_net = -10;
    civ.resolve = 5;
  } else {
    civ.energy = 500;
    civ.flags.last_energy_net = 10;
    civ.resolve = 80;
  }
  const p = plight(s, a);
  const before = civ.taint;
  asCiv(s, a, () => completeTech(s, 'hunger_engines'));
  const t = tieOf(s, a, b);
  const news = t.news?.find((n) => n.to === b);
  const tiding = s.tidings?.find((x) => x.taintOf === a);
  return { s, p, gained: civ.taint - before, delta: news?.delta ?? 0, taint: news?.taint ?? 0, tiding };
}
const low = step(false);
const high = step(true);
console.log(`  plight: prospering ${low.p.toFixed(2)}, desperate ${high.p.toFixed(2)}; judged ${low.delta.toFixed(2)} and ${high.delta.toFixed(2)}`);
check(low.gained === 12 && high.gained === 12, 'Hunger Engines: 12 Taint at once, desperate or not');
check(low.p < 0.2 && high.p > 0.8, 'one civilization prospering, the other desperate');
check(low.delta < 0 && high.delta < 0 && Math.abs(high.delta) < 0.45 * Math.abs(low.delta), `the desperate judged at about a third of the prospering (${(high.delta / low.delta * 100).toFixed(0)}%)`);
check(low.taint === 12 && !!low.tiding && low.tiding.taint === 12, 'its news carries its Taint, to the others and to us');

// our own acts, heard by the neighbours
{
  const s = newGame({ seed: 1000, survivors: 3, civsAsleep: true });
  const sv = Object.values(s.survivors)[0];
  for (const t of ['hunger_studies', 'command_language']) if (!s.civ.techs.includes(t)) s.civ.techs.push(t);
  completeTech(s, 'hunger_engines');
  const n = sv.news?.find((x) => x.taint === 12);
  check(s.civ.taint === 12 && !!n && n.delta < 0 && n.at >= s.years, 'our Hunger Engines: Taint 12, and the news of it sets out to every neighbour');
  check(!shuns(s, sv) && (sv.heardTaint ?? 0) === 0, 'until it arrives they have heard nothing');
  heardOfUs(s, sv, 12);
  check(sv.heardTaint === 12 && !shuns(s, sv), 'when it arrives they count it: 12 heard, not enough to shun us');
  Object.assign(sv, { alive: true, contact: true, disposition: 40, pacts: { archives: s.turn } });
  s.civ.signals.length = 0;
  heardOfUs(s, sv, 20);
  check(shuns(s, sv) && sv.pacts?.archives === undefined, `past ${SANCTION_AT} heard, they shun us and close their archives`);
  check(!!pactBlocked(s, sv, 'aid') && /heard what we are becoming/.test(pactBlocked(s, sv, 'aid') ?? ''), 'no new pact');
  check(tradeOffer(s, sv) === null, 'no trade');
}

// a step through an event is heard too: Hear the promise (What It Was For)
{
  const s = newGame({ seed: 1000, survivors: 3, civsAsleep: true });
  if (!s.civ.techs.includes('command_language')) s.civ.techs.push('command_language');
  queueEvent(s, 'hunger_mirror');
  const ev = s.civ.pending.find((p) => p.defId === 'hunger_mirror')!;
  const before = s.civ.taint;
  answerEvent(s, ev.uid, 1);
  const n = Object.values(s.survivors)[0].news?.find((x) => /heard the Hunger’s promise/.test(x.what));
  check(s.civ.taint === before + 5 && n?.taint === 5, `Hear the promise: Taint +5, and the news of it sets out (${s.civ.taint - before}, ${n?.taint})`);
}

// among the others, what one has heard of another's Hunger lasts, as with us: regard drifts back
// toward where it began, never above 100 − 1.5 × the Taint heard of
{
  const s = newGame({ seed: 1000, survivors: 3 });
  const [a, b] = Object.keys(s.survivors).filter((id) => s.civs[id]).sort();
  const t = tieOf(s, a, b);
  t.taintHeard = { [b]: 80 };
  t.regard[a] = 50;
  t.regard[b] = 50;
  for (let i = 0; i < 300; i++) tiesTurn(s);
  check(Math.abs(t.regard[b] - (100 - 80 * HEARD_CEILING)) < 0.5, `heard of 80 Taint in the other: its regard settles at ${100 - 80 * HEARD_CEILING} (${t.regard[b].toFixed(1)})`);
  check(Math.abs(t.regard[a] - baseRegard(s, a, b)) < 0.5, `the other, having heard nothing, settles where it began (${t.regard[a].toFixed(1)}, base ${baseRegard(s, a, b).toFixed(1)})`);
}

// one on that path itself does not shun us
{
  const s = newGame({ seed: 1000, survivors: 3 });
  const sv = Object.values(s.survivors).find((v) => s.civs[v.id])!;
  sv.heardTaint = 50;
  s.civs[sv.id].taint = 40;
  check(!shuns(s, sv), 'a civilization on the Hunger’s path itself does not shun us for it');
}

// another civilization at 100 becomes the Hunger
{
  const s: GameState = newGame({ seed: 1000, survivors: 3 });
  const id = Object.keys(s.survivors).find((x) => s.civs[x])!;
  const cap = s.colonies[s.civs[id].capitalId!];
  const before = Object.keys(s.swarms).length;
  s.civs[id].taint = 100;
  asCiv(s, id, () => {
    const o = checkEndings(s);
    if (o?.kind === 'dark') becomeHunger(s, id);
  });
  flushOutbox(s);
  check(s.civs[id].outcome?.kind === 'dark', 'at 100 Taint another civilization’s game ends as ours would: the Hunger');
  check(Object.keys(s.swarms).length === before + 1 && Object.values(s.swarms).some((w) => w.systemId === cap.systemId && w.awake), 'its capital buds a swarm');
  // the next turn it is gone, as one whose game ended; and it sends nothing
  const sv = s.survivors[id];
  sv.contact = true;
  endTurn(s);
  check(!sv.alive && sv.fate === 'hungered' && coloniesOf(s, id).length === 0, `the next turn its settlements go dark: it became the Hunger (${sv.fate}, ${coloniesOf(s, id).length} left)`);
  const last = s.civ.signals.some((g) => g.from === id && g.kind === 'last');
  const silence = s.tidings?.find((t) => /has fallen silent/.test(t.text));
  check(!last && !!silence && silence.at > s.years, 'no last transmission and no archive: we hear its silence when its light reaches us');
}
done('HUNGER JUDGEMENT');
