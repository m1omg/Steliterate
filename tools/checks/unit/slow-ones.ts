// SPOILERS (docs/spoilers): the Slow Ones' understanding, and their gift (19 Oct).
// Their stage 3 → 4 needs understanding 45; an answer gave 22 (math) or 15 (history) and the Last
// Light 15 more: 37 at most, so their gift could never come. Their stage says "one thought per
// age": the crossing that closes the Degenerate Age, awake through it as they are, gives 15 more,
// so a civilization that spoke with them before the Last Light reaches 52 (math) or 45 (history)
// as the Black Hole Age opens, when the Aeon Seed becomes possible.
import { newGame } from '../../../src/game/newGame';
import { runCrossing } from '../../../src/game/sim/crossing';
import { updateMinds } from '../../../src/game/sim/minds';
import { computeMods } from '../../../src/game/sim/mods';
import type { GameState } from '../../../src/game/types';
import { check, done } from '../lib';

const atDegenerateEnd = (understanding: number): GameState => {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable', civsAsleep: true }) as GameState;
  s.era = 'degenerate';
  s.eta = 39.9;
  s.years = Math.pow(10, 39.9);
  s.civ.energy = 1000;
  s.minds.slow.stage = 3;
  s.minds.slow.understanding = understanding;
  return s;
};

for (const [answer, given] of [['math', 22], ['history', 15]] as const) {
  const s = atDegenerateEnd(given + 15);
  runCrossing(s, [s.player], { [s.player]: computeMods(s) });
  const u = s.minds.slow.understanding;
  check(u === given + 30, `answered with ${answer}, awake at the Last Light and now this crossing: understanding ${u}`);
  s.era = 'blackhole';
  updateMinds(s, 41, computeMods(s));
  check(s.minds.slow.stage === 4 && !!s.civ.flags.slow_gift, `so as the Black Hole Age opens they share their gift (stage ${s.minds.slow.stage})`);
}
// asleep through it, nothing passes between us
{
  const s = atDegenerateEnd(37);
  s.civ.dormant = true;
  runCrossing(s, [s.player], { [s.player]: computeMods(s) });
  check(s.minds.slow.understanding === 37, `dormant through the crossing, understanding stays ${s.minds.slow.understanding}`);
}

done('SLOW ONES');
