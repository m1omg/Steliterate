// The Twilight Interregnum's clock (1 Nov, the player: "a sort of a prequel mode where you start
// earlier, from 1e12 years"). It begins at 10¹² years with 40-year turns, lasts about 86 / 114 /
// 148 turns at Brief / Standard / Vast (since 7 Nov its Tide grows as the Dusk's: "So the pacing
// matches the original start"; 45 / 60 / 82 until then), and its last turn stops at
// 9 × 10¹³ years, where The Last Gas hands over to the Dusk, whose Tide begins again at 40 years.
// A game begun in the Dusk keeps its Tide exactly as before.
import { ERA_BY_ID, INTERREGNUM, erasOf, estimateEraTurns, nextEra, stepTime, tideLength } from '../../../src/game/eras';
import { calendarEra } from '../../../src/game/fate';
import { newGame } from '../../../src/game/newGame';
import { turnStep } from '../../../src/game/sim/flare';
import { endTurn } from '../../../src/game/sim/turn';
import { check, done, near } from '../lib';

const turns = { brief: estimateEraTurns('interregnum', 'brief'), standard: estimateEraTurns('interregnum', 'standard'), vast: estimateEraTurns('interregnum', 'vast') };
check(Math.abs(turns.brief - 86) <= 2 && Math.abs(turns.standard - 114) <= 2 && Math.abs(turns.vast - 148) <= 3, `about 86 / 114 / 148 turns (${turns.brief} / ${turns.standard} / ${turns.vast})`);
// turn for turn as long as the Dusk's (the same Tide from the same 40 years)
for (const n of [10, 40, 70]) {
  let a = INTERREGNUM.startYears, b = ERA_BY_ID.dusk.startYears;
  for (let i = 0; i < n; i++) {
    a = stepTime('interregnum', a, Math.log10(a), 0, 'standard').years;
    b = stepTime('dusk', b, Math.log10(b), 0, 'standard').years;
  }
  near(`turn ${n + 1} as long as the Dusk’s`, tideLength('interregnum', a, 'standard'), tideLength('dusk', b, 'standard'), 1e-4); // (the years since each began differ in their last digits: 10¹² against 9 × 10¹³)
}
near('the first turn is 40 years', tideLength('interregnum', INTERREGNUM.startYears, 'standard'), 40);
near('as the Dusk keeps it before 9 × 10¹³ years', tideLength('dusk', INTERREGNUM.startYears, 'standard'), 40);
check(nextEra('interregnum') === 'dusk' && INTERREGNUM.index === -1 && ERA_BY_ID.dusk.index === 0, 'it stands before the Dusk, and no other age’s index moved');
check(erasOf(true)[0].id === 'interregnum' && !erasOf(false).some((e) => e.id === 'interregnum'), 'only a game begun in it lists it');

// the Dusk's own Tide, as it always was
near('the Dusk’s first turn', tideLength('dusk', ERA_BY_ID.dusk.startYears, 'standard'), 40);
const d1 = stepTime('dusk', ERA_BY_ID.dusk.startYears, Math.log10(ERA_BY_ID.dusk.startYears), 0, 'standard');
near('the Dusk’s first step', d1.turnLength, 40);
check(estimateEraTurns('dusk', 'standard') === 105, `the Dusk still about 105 turns (${estimateEraTurns('dusk', 'standard')})`);

// a game: begins at 10¹², keeps the Dusk's calendar, its last turn stops at 9 × 10¹³
const s = newGame({ seed: 1000, interregnum: true, civsAsleep: true });
check(s.era === 'interregnum' && s.years === 1e12 && s.turnLength === 40 && calendarEra(s) === 'dusk', `it begins at 10¹² years, 40-year turns, the Dusk’s calendar (${s.era}, ${s.years}, ${s.turnLength}, ${calendarEra(s)})`);
// jump to its last turn
s.years = 7.5e13;
s.eta = Math.log10(s.years);
const last = turnStep(s);
near('its last turn stops at 9 × 10¹³ years', last.years, 9e13, 1e-6);
s.civ.pending.length = 0;
const r = endTurn(s);
check(r.crossing?.title === 'The Last Gas' && r.crossing.from === 'interregnum' && r.crossing.to === 'dusk', `The Last Gas hands over to the Dusk (${r.crossing?.title})`);
check(s.era === 'dusk' && s.years === ERA_BY_ID.dusk.startYears && s.turnLength === 40, `the Dusk begins at 9 × 10¹³ years with 40-year turns (${s.era}, ${s.years}, ${s.turnLength})`);
check(/born last, from the last of the gas|The Long Dusk begins/.test(r.crossing?.intro ?? ''), 'with the Dusk’s words for a game begun before it');

done('INTERREGNUM CLOCK');
