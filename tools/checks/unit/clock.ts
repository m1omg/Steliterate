// The new-star clock, step by step: free in tune, priced beyond (once, per tenfold, cheaper when
// quick, dearer when slow, refused when the reserve is short); six turns, each a sixth of what was
// left, paid in full, at full light, out at the end of the sixth; then the Tide again. Helium
// stars past the calendar's limit cannot be kept. Study and Watch give insight and resolve.
import { autoPlay } from '../../../src/game/auto';
import { newGame } from '../../../src/game/newGame';
import { endTurn } from '../../../src/game/sim/turn';
import { STAR_ORDER_COST, keepTimeWithStar, livedShare, starClock, starClockOffer, starClockTerms, turnStep, turnsUntilYears } from '../../../src/game/sim/flare';
import { sourceLight } from '../../../src/game/physics';
import { stepTime } from '../../../src/game/eras';
import { EVENT_BY_ID } from '../../../src/game/data/events';
import type { GameState, StarSystem } from '../../../src/game/types';
import { reserveCapacity } from '../../../src/game/sim/storage';
import { computeMods } from '../../../src/game/sim/mods';
import { check, done } from '../lib';

const state = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
let guard = 0;
while (state.era !== 'degenerate' && guard++ < 400) {
  autoPlay(state, 'competent');
  endTurn(state);
}
while (stepTime(state.era, state.years, state.eta, state.civ.pace, state.settings.length).turnLength < 2e13 && guard++ < 500) {
  autoPlay(state, 'competent');
  endTurn(state);
}
state.pending.length = 0;
delete state.civ.flags.star_until;
delete state.civ.flags.star_step;
state.civ.pace = 0;
const next = (s: GameState, pace = s.civ.pace) => stepTime(s.era, s.years, s.eta, pace, s.settings.length).turnLength;
const tide = next(state);
console.log(`turn ${state.turn}, η ${state.eta.toFixed(2)}, next turn at the Tide ${tide.toExponential(2)} years, energy ${state.civ.energy.toFixed(0)}`);
const bds = Object.values(state.systems).filter((s) => s.primary.kind === 'brown_dwarf' && !s.gone && !s.ejected);
const light = (sys: StarSystem, life: number) => {
  sys.primary.kind = 'collision_star';
  sys.primary.mass = 0.1;
  sys.primary.bornAt = state.years;
  sys.primary.diesAt = state.years + life;
  state.civ.known[sys.id] = 2;
};
const full = () => Math.floor(reserveCapacity(state, computeMods(state)));
const expected = (life: number, pace = 0) => Math.min(full(), Math.ceil(STAR_ORDER_COST * Math.max(0, Math.log10(next(state, pace) / life) - 2)));

// in tune: free
const inTune = bds[0];
const life = tide / 20; // the next turn is 20x its life: within the free hundredfold
light(inTune, life);
let t = starClockTerms(state, inTune);
check(t.possible && t.cost === 0, `a star whose life is a twentieth of the next turn is in tune: free (orders ${t.orders.toFixed(2)}, cost ${t.cost})`);

// out of tune: priced by the tenfold, cheaper quick, dearer slow
const far = bds[1];
const farLife = tide / Math.pow(10, 2.37); // 10^2.37: 0.37 of a tenfold beyond the free two
light(far, farLife);
t = starClockTerms(state, far);
check(t.possible && t.cost === expected(farLife) && t.cost === Math.min(full(), Math.ceil(0.37 * STAR_ORDER_COST)), `10^2.37 out of tune at the Tide costs ${t.cost} of a ${full()} store`);
state.civ.pace = 1;
const quick = starClockTerms(state, far).cost;
state.civ.pace = -1;
const slow = starClockTerms(state, far).cost;
state.civ.pace = 0;
check(quick === 0 && slow === expected(farLife, -1) && slow > t.cost, `Quick x10 brings it in tune (${quick}); Slow x10 pays ${slow}`);
const far2 = bds[2];
light(far2, tide / 1e9);
check(starClockTerms(state, far2).cost === full(), `far out of tune it costs no more than a full store (${starClockTerms(state, far2).cost} of ${full()})`);
far2.primary.kind = 'brown_dwarf';
delete far2.primary.bornAt;
delete far2.primary.diesAt;
// refused when short
const had = state.civ.energy;
state.civ.energy = t.cost - 1;
check(!starClockOffer(state, far) && keepTimeWithStar(state, far.id) === null && !state.civ.flags.star_until && state.civ.energy === t.cost - 1, 'refused, and nothing taken, when the reserve is one short');
// paid once, then the clock runs
state.civ.energy = t.cost + 100;
const paid = keepTimeWithStar(state, far.id);
check(paid === t.cost && state.civ.energy === 100, `paid ${paid} once (energy now ${state.civ.energy})`);
const follow = starClockTerms(state, inTune);
check(follow.possible && follow.after === far.name && follow.from === far.primary.diesAt, `while it runs, a star that outlasts it can only follow it on (after ${follow.after}, from its end)`);
const brief = bds[3];
light(brief, farLife / 2);
check(starClockTerms(state, brief).why === 'inside' && !starClockOffer(state, brief), 'a star that burns out inside the running clock is not offered');
brief.primary.kind = 'brown_dwarf';
delete brief.primary.bornAt;
delete brief.primary.diesAt;
inTune.primary.kind = 'brown_dwarf';
delete inTune.primary.bornAt;
delete inTune.primary.diesAt;
check(turnsUntilYears(state, far.primary.diesAt!) === 6, 'it now burns for 6 turns');
const start = state.years;
for (let k = 1; k <= 6; k++) {
  const c = starClock(state);
  const st = turnStep(state);
  const lt = sourceLight(state, far, state.years, st.turnLength).light;
  check(c?.turn === k && c.systemId === far.id && Math.abs(st.turnLength - farLife / 6) < farLife * 1e-9 && livedShare(state) === 1 && lt > 3.9 * (0.5 + 0.5 * state.gfe), `turn ${k} of 6: a sixth of its life, lived in full, light x${lt.toFixed(2)}`);
  const e = state.civ.energy;
  state.civ.pace = k % 2 ? 2 : -2;
  endTurn(state);
  state.pending.length = 0;
  if (k === 1) check(state.civ.energy >= e - 400, 'no further charge while it runs');
}
state.civ.pace = 0;
check(state.years === start + farLife && !starClock(state) && far.primary.kind === 'white_dwarf', 'six turns end exactly as it burns out; the clock is gone');
check(livedShare(state) === 1 && Math.abs(turnStep(state).turnLength - next(state)) < 1, 'the next turn is the Tide again');

// helium stars: possible while the calendar can count their turns, then too brief
const wd = Object.values(state.systems).find((s) => s.primary.kind === 'white_dwarf' && s.id !== far.id && !s.gone)!;
const asHelium = (years: number) => {
  const s = { ...state, years, eta: Math.log10(years) } as GameState;
  wd.primary.kind = 'helium_star';
  wd.primary.bornAt = years;
  wd.primary.diesAt = years + 2e8;
  return s;
};
let h = asHelium(3e19);
let ht = starClockTerms(h, wd);
check(ht.possible && ht.cost > 0 && ht.cost <= full(), `a White Fire at η 19.5 can be kept time with, for ${ht.cost} energy at the Tide (a ${full()} store)`);
h = asHelium(1e22);
ht = starClockTerms(h, wd);
check(ht.possible && ht.brief && ht.flash, 'a White Fire at η 22 is too brief for six turns: it can be caught in one (a flash)');
wd.primary.kind = 'white_dwarf';
delete wd.primary.bornAt;
delete wd.primary.diesAt;

// study and watch: insight and resolve, for anyone
for (const [id, i] of [['new_star', 1], ['white_fire', 1]] as [string, number][]) {
  const ch = EVENT_BY_ID[id].choices[i];
  const r0 = state.civ.resolve;
  const res = state.civ.researching;
  const i0 = res ? state.civ.research[res] ?? 0 : state.civ.flags.insight_bank ?? 0;
  ch.run(state, { systemId: inTune.id }, null as never);
  const i1 = res ? state.civ.research[res] ?? 0 : state.civ.flags.insight_bank ?? 0;
  check(i1 - i0 === 25 && state.civ.resolve - r0 === Math.min(2, 100 - r0), `${id} "${ch.label}": insight +${i1 - i0}, resolve +${state.civ.resolve - r0}`);
}
void had;
done('CLOCK');
