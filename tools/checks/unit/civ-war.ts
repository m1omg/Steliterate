// War between any two civilizations (the new version, part 2c-2):
// - another civilization that has heard of 60 Taint in a neighbour, and is not on that path itself,
//   goes to war with it once its warships outweigh the front half again (planWarAI, auto.ts): the
//   Threads' consent and its costs, the pacts between them ended, and no infamy with the others;
// - where civilizations at war meet, they fight once a turn, all at once, each side's fire from
//   what stood at the start: the order of the fleets decides nothing;
// - warships holding an enemy settlement's star with none of its owner's there besiege it, and its
//   owner's stores run down;
// - a war it began it ends after WAR_TIRES turns;
// - a war on us: declared by one that has heard of our Hunger, with word of it crossing to us; we
//   cannot end it ourselves, and our autoplayer gathers its warships at the front.
import { autoPlay } from '../../../src/game/auto';
import { asCiv, flushOutbox } from '../../../src/game/civs';
import { newGame } from '../../../src/game/newGame';
import { copyState } from '../../../src/game/save';
import { battlesTurn, declareOn, frontOf, guardAt, warOf } from '../../../src/game/sim/conflict';
import { newFleet } from '../../../src/game/sim/fleets';
import { tieOf } from '../../../src/game/sim/ties';
import { HUNGER_CAUSE, WAR_ACCORD, makePeace } from '../../../src/game/sim/war';
import type { GameState } from '../../../src/game/types';
import { THREADS } from '../../../src/game/types';
import { check, done } from '../lib';

const fresh = () => {
  const s = newGame({ seed: 1000, survivors: 3 });
  const [a, b, c] = Object.keys(s.survivors).filter((id) => s.civs[id]).sort();
  return { s, a, b, c };
};
/** Enough Wardens at a civilization's capital to carry a front held by `guard`, half again. */
const arm = (s: GameState, id: string, guard: number) => {
  const cap = s.colonies[s.civs[id].capitalId!];
  return asCiv(s, id, () => newFleet(s, cap.systemId, Array(Math.ceil((1.6 * Math.max(1, guard)) / 3) + 1).fill('warden'), 'Host'));
};

// the decision: the Hunger heard of in a neighbour
{
  const { s, a, b, c } = fresh();
  const t = tieOf(s, a, b);
  t.taintHeard = { [a]: 70 };
  t.pacts = { archives: s.turn };
  const civ = s.civs[a];
  civ.accord = 200;
  const standing = { ...civ.standing };
  const front = frontOf(s, b, a)!;
  arm(s, a, guardAt(s, front, b));
  asCiv(s, a, () => autoPlay(s, 'competent'));
  flushOutbox(s);
  const w = warOf(s, a, b);
  check(w?.by === a && w.cause === HUNGER_CAUSE && w.at === front, `having heard of 70 Taint in ${civ.name}'s neighbour, it goes to war on it, at ${s.systems[front]?.name} (${JSON.stringify(w)})`);
  check(civ.accord <= 200 - WAR_ACCORD && THREADS.every((x) => civ.standing[x] <= standing[x]), 'the Threads consented, and it cost them');
  check(!t.pacts && (t.regard[b] ?? 0) < 0, 'the pacts between them end, and the one attacked thinks far less of it');
  const news = tieOf(s, a, c).news?.find((n) => n.to === c);
  check(!!news && news.delta === 0, `the third hears of it, and thinks no worse of it: the Hunger was in them (${news?.delta})`);
  check(!!s.tidings?.some((x) => /went to war with/.test(x.text)), 'we hear of it when its light reaches us');
  check(s.fleets[Object.keys(s.fleets).find((k) => s.fleets[k].name === 'Host')!]?.to === front, 'and its warships set out for the front');
}

// no cause, no war: one clean neighbour of another
{
  const { s, a, b } = fresh();
  s.civs[a].accord = 200;
  arm(s, a, guardAt(s, frontOf(s, b, a)!, b));
  asCiv(s, a, () => autoPlay(s, 'competent'));
  check(!warOf(s, a, b), 'with nothing heard of the Hunger in anyone, and clean itself, it makes no war');
}

// battles: at once, whatever the order
{
  const { s, a, b } = fresh();
  s.civs[a].accord = 200;
  const front = frontOf(s, b, a)!;
  check(declareOn(s, a, b, HUNGER_CAUSE, front) === null, 'war declared');
  const host = asCiv(s, a, () => newFleet(s, front, ['warden', 'warden'], 'Host'));
  const guard = asCiv(s, b, () => newFleet(s, front, ['warden'], 'Guard'));
  const twin = copyState(s);
  // the same fleets in the other order
  const ids = Object.keys(twin.fleets);
  const re: GameState['fleets'] = {};
  for (const id of ids.reverse()) re[id] = twin.fleets[id];
  twin.fleets = re;
  const hp0 = host.ships.reduce((x, y) => x + y.hp, 0);
  battlesTurn(s);
  battlesTurn(twin);
  const hp = (g: GameState, id: string) => g.fleets[id]?.ships.reduce((x, y) => x + y.hp, 0) ?? 0;
  check(hp(s, host.id) < hp0 && hp(s, guard.id) < 10, `both sides take fire (${hp0} → ${hp(s, host.id).toFixed(2)}; 10 → ${hp(s, guard.id).toFixed(2)})`);
  check(hp(s, host.id) === hp(twin, host.id) && hp(s, guard.id) === hp(twin, guard.id), 'and the order of the fleets decides nothing');
  check(s.battles.some((x) => x.systemId === front), 'the map marks the battle');
}

// a siege, and its blockade
{
  const { s, a, b } = fresh();
  s.civs[a].accord = 200;
  const front = frontOf(s, b, a)!;
  for (const f of Object.values(s.fleets)) if (f.owner === b) delete s.fleets[f.id];
  for (const c of Object.values(s.colonies)) if (c.owner === b) delete c.structures.defense_grid;
  declareOn(s, a, b, HUNGER_CAUSE, front);
  asCiv(s, a, () => newFleet(s, front, ['warden', 'warden'], 'Host'));
  const e0 = s.civs[b].energy;
  for (let i = 0; i < 3; i++) battlesTurn(s);
  flushOutbox(s);
  check(warOf(s, a, b)!.siege === 3, `three turns at ${s.systems[front]?.name} with none of theirs there: a siege of three turns`);
  check(s.civs[b].energy < e0, `and the besieged's stores run down (${Math.round(e0)} → ${Math.round(s.civs[b].energy)})`);
  // it tires
  warOf(s, a, b)!.since = s.turn - 31;
  asCiv(s, a, () => autoPlay(s, 'competent'));
  check(!warOf(s, a, b), 'thirty turns on, it makes peace');
}

// a war on us
{
  const { s, a } = fresh();
  const sv = s.survivors[a];
  sv.heardTaint = 70;
  s.civs[a].accord = 200;
  const front = frontOf(s, s.player, a)!;
  arm(s, a, guardAt(s, front, s.player));
  asCiv(s, a, () => autoPlay(s, 'competent'));
  flushOutbox(s);
  check(sv.war?.by === a && sv.war.cause === HUNGER_CAUSE && sv.war.at === front, `having heard of our Hunger, ${sv.name} goes to war on us, at ${s.systems[front]?.name}`);
  check(s.civ.signals.some((g) => g.kind === 'war_on_us' && g.from === a), 'its word of it crosses to us as light');
  check(/They began this war/.test(makePeace(s, a) ?? ''), 'we cannot end a war they began');
  autoPlay(s, 'competent');
  const ours = Object.values(s.fleets).filter((f) => f.owner === s.player && f.ships.some((x) => x.cls === 'warden'));
  check(ours.length > 0 && ours.every((f) => f.to === front || (f.at === front && f.order === 'fortify')), 'our autoplayer gathers its warships at the front');
}
done('CIV WAR');
