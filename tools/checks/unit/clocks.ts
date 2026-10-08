// The pace changes whom we can talk to (the player's ask, 8 Oct; their choice, "Any rhythm from
// mind to turn"): we can keep any rhythm from how fast our dominant minds think to how long our
// turn is (voiceRange), and talk with any mind within a thousandfold of it (a millionfold for a
// civilization of processes and protocol). The pace moves the turn's end of that span: slowing
// reaches slower minds; quickening, once the turn is shorter than our minds' thought, faster ones.
// A card's hint (reachBy) names the nearest pace we can choose that would do it, else how many
// tenfolds the turn would have to go, and which other Thread of ours would reach them as our voice.
import { newGame } from '../../../src/game/newGame';
import { logTurnLength } from '../../../src/game/eras';
import { turnStep } from '../../../src/game/sim/flare';
import { computeMods } from '../../../src/game/sim/mods';
import { canConverse, rangeWith, stepGap, voiceClock, voiceRange, voiceThread } from '../../../src/game/sim/signals';
import { inStep, reachBy } from '../../../src/game/sim/survivors';
import { capital } from '../../../src/game/sim/util';
import type { GameState } from '../../../src/game/types';
import { check, done } from '../lib';

const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' }) as GameState;
const v = voiceClock(s, 10);
check(Math.abs(v - 1.6) < 1e-9, `Kin speak for us at the start: 10^${v.toFixed(1)} years a thought`);
const r = voiceRange(s, 10);
check(r[0] === v && r[1] === 10, `with turns of 10^10 years we can keep any rhythm from 10^${r[0].toFixed(1)} to 10^${r[1]}`);
check(canConverse(r, 12.5) && !canConverse(r, 13.5) && canConverse(r, 0) && !canConverse([3, 10], -0.5), 'we reach a thousandfold beyond either end, and no further');
check(stepGap(r, 15) === 5 && stepGap([3, 10], -1) === -4 && stepGap(r, 5) === 0, 'how far out of step: above our span, below it, within');
const m = computeMods(s);
const same = (a: [number, number], b: [number, number]) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
check(same(rangeWith('kin', 5, m), [1.6, 5]) && same(rangeWith('coldminds', 2, m), [2, 4]) && same(rangeWith('coldminds', 5, m), [5, 5]) && same(rangeWith(null, 5, m), [5, 5]), 'the span with each voice: Kin fixed at 10^1.6; Coldminds no faster than 10^4, keeping the turn within their range');

// a civilization too slow for us: the pace brings it in, and the hint says which pace
const sv = Object.values(s.survivors)[0];
sv.contact = true;
const L0 = logTurnLength(turnStep(s));
sv.clock = L0 + 3.9;
const before = inStep(s, sv);
const hint = reachBy(s, sv.clock);
s.civ.pace = -1;
const after = inStep(s, sv);
s.civ.pace = 0;
check(!before && after && hint.pace === -1 && Math.abs(hint.tenfolds - 0.9) < 1e-9, `a civilization 3.9 tenfolds slower than our turns: out of step at the Tide, in step at Slow ×10, which the hint names (${hint.pace}; the turn ${hint.tenfolds.toFixed(2)} tenfolds longer)`);
const far = reachBy(s, L0 + 5.5);
check(far.pace === null && Math.ceil(far.tenfolds) === 3, `5.5 tenfolds slower: beyond any pace we can choose now; the turns would have to be ${far.tenfolds.toFixed(1)} tenfolds longer`);

// a mind too fast for Kin: quickening reaches it only once our turns are shorter than Kin think
s.civ.pace = -1; // turns of 10^2.6 years, Kin at 10^1.6
const fastHint = reachBy(s, -1.6);
const outNow = !canConverse(voiceRange(s, logTurnLength(turnStep(s))), -1.6);
s.civ.pace = 0;
check(outNow && fastHint.pace === 1 && fastHint.tenfolds < -1.1 && fastHint.tenfolds > -1.3, `at Slow ×10 a mind at 10^-1.6 years is too fast for us; Quick ×10 reaches it, two steps on, as the turn must first come down to Kin's 40 years (${fastHint.tenfolds.toFixed(2)} tenfolds)`);

// other voices: Coldminds reach slower minds at any pace, Echoes do not; Kin and Echoes reach faster ones
const cap = capital(s)!;
cap.pops.coldminds = 1;
cap.pops.echoes = 1;
const slowMind = reachBy(s, 6.4, 2.5);
check(voiceThread(s) === 'kin' && slowMind.voices.join() === 'coldminds', `a mind at 10^6.4 years (the Slow Ones' span, 2.5): Coldminds would reach it as our voice, Echoes would not (${slowMind.voices.join(', ')})`);
cap.pops.coldminds = 10_000;
s.civ.pace = -1;
const fastMind = reachBy(s, -1);
s.civ.pace = 0;
check(voiceThread(s) === 'coldminds' && fastMind.voices.join() === 'kin,echoes', `with Coldminds the most of us, a mind at 10^-1 years is out of reach at Slow ×10; Kin or Echoes would reach it (${fastMind.voices.join(', ')})`);
done('CLOCKS');
