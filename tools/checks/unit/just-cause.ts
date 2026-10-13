// The Hunger in another civilization as a just cause (the new version, part 2b): we hear of its
// Hunger acts when their light reaches our capital, and count their Taint as seen; at 60 seen, the
// Hunger in it is cause for war, and a war on that cause carries no infamy with the others. And one
// far down that path itself (its own Taint from 60) turns on the weak.
import { asCiv } from '../../../src/game/civs';
import { newGame } from '../../../src/game/newGame';
import { CORRUPT_AT, hungerAct, JUST_CAUSE_AT } from '../../../src/game/sim/judge';
import { tiesTurn } from '../../../src/game/sim/ties';
import { endTurn } from '../../../src/game/sim/turn';
import { declareWar, HUNGER_CAUSE, warCause } from '../../../src/game/sim/war';
import { check, done } from '../lib';

const s = newGame({ seed: 1000, survivors: 3 });
const ids = Object.keys(s.survivors).filter((id) => s.civs[id]).sort();
const sv = s.survivors[ids[0]];
const home = sv.homeSystemId;
check(warCause(s, sv) === null, 'no cause for war with a neighbour we have heard nothing of');
asCiv(s, sv.id, () => hungerAct(s, sv.id, 70, home, 'enacted Absorb the Weak'));
check(s.civs[sv.id].taint === 70 && (sv.taintSeen ?? 0) === 0, 'its Hunger act: its Taint at once, but we have not heard of it yet');
const tiding = s.tidings?.find((t) => t.taintOf === sv.id)!;
check(!!tiding && tiding.at > s.years, `we will hear of it when its light reaches our capital (${Math.round(tiding.at - s.years).toLocaleString('en-US')} years)`);
s.years = tiding.at;
tiesTurn(s);
check(sv.taintSeen === 70 && s.civ.log.some((l) => /enacted Absorb the Weak/.test(l.text)), 'when it arrives we read it, and count its Taint as seen');
check((sv.taintSeen ?? 0) >= JUST_CAUSE_AT && warCause(s, sv) === HUNGER_CAUSE, `at ${JUST_CAUSE_AT} seen, the Hunger in them is cause for war`);
// a war on it: the others hear of it, and think no worse of us
Object.assign(sv, { contact: true, alive: true });
s.civ.accord = 200;
const other = s.survivors[ids[1]];
const before = other.news?.length ?? 0;
const err = declareWar(s, sv.id);
const n = other.news?.slice(before).find((x) => /went to war/.test(x.what));
check(!err && !!n && n.delta === 0 && /for the Hunger in them/.test(n.what), `a war on that cause carries no infamy (${err ?? `heard as “${n?.what}”, ${n?.delta}`})`);

// one far down the Hunger's path (its own Taint from CORRUPT_AT) turns on the weak: it raids us
// though it does not hate us, as the others do only when desperate, wronged or at war
{
  const s2 = newGame({ seed: 1000, survivors: 3 });
  const id = Object.keys(s2.survivors).filter((x) => s2.civs[x]).sort()[0];
  const v = s2.survivors[id];
  v.contact = true;
  s2.civs[id].taint = CORRUPT_AT + 10;
  let turns = 0;
  let raid: string | undefined;
  for (; turns < 40 && !raid; turns++) {
    v.disposition = 0;
    endTurn(s2);
    raid = s2.civ.signals.find((g) => g.from === id && g.kind === 'raid')?.text;
  }
  check(!!raid && /The Hunger is in them now/.test(raid), `at ${CORRUPT_AT + 10} Taint of its own it raids us, wary of us but no enemy (turn ${turns}: “${raid ?? 'no raid'}”)`);
}
done('JUST CAUSE');
