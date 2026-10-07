// The follow-on clock: while we keep time with one new star, a second that outlasts it can be
// followed on, priced as a fresh clock from our own pace when the first runs out.
import { EVENT_BY_ID, choiceHint } from '../../../src/game/data/events';
import { starClock, starClockTerms, keepTimeWithStar, turnStep, STAR_TURNS, STAR_ORDER_COST, STAR_FREE, STAR_FOLLOW_MIN } from '../../../src/game/sim/flare';
import { endTurn } from '../../../src/game/sim/turn';
import { stepTime, eta, formatYears } from '../../../src/game/eras';
import { reserveCapacity } from '../../../src/game/sim/storage';
import { computeMods } from '../../../src/game/sim/mods';
import { check as ck, done, loadSave } from '../lib';
const check = (what: string, ok: boolean, more = '') => ck(ok, `${what}${more ? `: ${more}` : ''}`);

const s = loadSave('4fe2404-seed1000-turn87-clock.json.gz');
s.pending = [];
const c0 = starClock(s)!;
check('a clock runs in the old save', !!c0, c0 ? `${c0.system}, turn ${c0.turn} of ${c0.of}, ${c0.left} left` : '');
const f = s.civ.flags;
// light a second collision star that outlasts the first by eight trillion years
const bd = Object.values(s.systems).find((x) => x.primary.kind === 'brown_dwarf' && !x.gone && !x.ejected)!;
bd.primary.kind = 'collision_star';
bd.primary.mass = 0.1;
bd.primary.bornAt = s.years;
bd.primary.diesAt = f.star_until + 8e12;
s.civ.known[bd.id] = 1;
const d = { systemId: bd.id };
const def = EVENT_BY_ID.new_star;
console.log('TEXT:', def.text(s, d));
def.choices.forEach((ch, i) => console.log(`  [${i}] ${ch.label}${ch.ok && !ch.ok(s, d) ? ' (shut)' : ''}: ${choiceHint(ch, s, d)}`));
const t = starClockTerms(s, bd);
const from = f.star_until;
const next = stepTime(s.era, from, eta(from), s.civ.pace, s.settings.length).turnLength;
const left = bd.primary.diesAt - from;
const want = left >= next * STAR_TURNS ? -1 : Math.min(Math.floor(reserveCapacity(s, computeMods(s))), Math.max(STAR_FOLLOW_MIN, Math.ceil(STAR_ORDER_COST * Math.max(0, Math.log10(next / left) - STAR_FREE))));
check('follow-on terms: after the running star', t.after === c0.system, `after ${t.after}, possible ${t.possible}, why ${t.why}`);
check('priced from our own pace as the first clock ends', want < 0 ? !t.possible && t.why === 'unneeded' : t.possible && t.cost === want, `cost ${t.cost}, want ${want}; own turn then ${formatYears(next)}, star left then ${formatYears(left)}`);
// a second offer while one waits is refused
s.civ.energy = Math.max(s.civ.energy, t.cost + 10);
const paid = keepTimeWithStar(s, bd.id);
check('keeping time with it queues it', paid === t.cost && f.star_next === bd.primary.diesAt, `paid ${paid}`);
const c1 = starClock(s)!;
check('the running clock is unchanged and names the next', c1.system === c0.system && c1.left === c0.left && c1.next === bd.name, `${c1.system} ${c1.turn}/${c1.of}, next ${c1.next}`);
const bd2 = Object.values(s.systems).find((x) => x.primary.kind === 'brown_dwarf' && !x.gone && !x.ejected && x.id !== bd.id)!;
bd2.primary.kind = 'collision_star'; bd2.primary.mass = 0.1; bd2.primary.bornAt = s.years; bd2.primary.diesAt = bd.primary.diesAt + 5e12;
check('a third star cannot queue while one waits', starClockTerms(s, bd2).why === 'waiting');
console.log('  third star hint:', choiceHint(def.choices[0], s, { systemId: bd2.id }));
bd2.primary.kind = 'brown_dwarf'; bd2.primary.bornAt = undefined; bd2.primary.diesAt = undefined;
// play the clocks out
const dies2 = bd.primary.diesAt;
let turns = 0;
let firstEnd = -1;
let second = 0;
while (turns < 20) {
  const before = s.years;
  const step = turnStep(s);
  s.pending = [];
  endTurn(s);
  turns++;
  const c = starClock(s);
  console.log(`  turn ${s.turn - 1}: spanned ${formatYears(s.years - before)} (planned ${formatYears(step.turnLength)}); clock ${c ? `${c.system} ${c.turn}/${c.of}${c.next ? `, then ${c.next}` : ''}` : 'none'}`);
  if (c && c.system === bd.name && firstEnd < 0) firstEnd = turns;
  if (c && c.system === bd.name) second++;
  if (!c && firstEnd > 0) break;
}
check('the first clock ran out on time', firstEnd === c0.left, `second clock from turn ${firstEnd} (first had ${c0.left} left)`);
check('the second clock ran six turns', second === STAR_TURNS, `${second}`);
check('it ended as the second star burned out', s.years === dies2 + (s.years - dies2) && Math.abs(s.years - dies2) < 2e12, `${s.years.toExponential(8)} vs ${dies2.toExponential(8)}`);
check('no flags left behind', !f.star_until && !f.star_step && !f.star_next, JSON.stringify({ u: f.star_until, s: f.star_step, n: f.star_next }));
done('FOLLOW');
