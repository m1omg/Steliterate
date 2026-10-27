// The turn in slices (the new version, part 2a-6): turnSlices plays the same turn endTurn does,
// yielding between each civilization's part of a step and never inside one, so that the interface
// can let the browser breathe between them.
// - The same game, slice by slice or at once: state for state, turn after turn.
// - Between two slices the game looks from the player's side (state.civ is ours: the swap never
//   spans a yield), and nothing of a civilization's part is left half done.
// - Each slice is a small part of the whole turn.
import { autoPlay } from '../../../src/game/auto';
import { newGame } from '../../../src/game/newGame';
import { copyState } from '../../../src/game/save';
import { endTurn, turnSlices } from '../../../src/game/sim/turn';
import type { GameState } from '../../../src/game/types';
import { check, done } from '../lib';

const plain = (s: GameState) => JSON.stringify(s, (_k, v) => (v === Infinity ? '__inf' : v === -Infinity ? '__-inf' : v));

const a = newGame({ seed: 8919, survivors: 3 });
const b = copyState(a);
let same = true;
let outside = true;
let slices = 0;
let turns = 0;
let most = 0;
for (let i = 0; i < 160 && !a.civ.outcome; i++) {
  autoPlay(a, 'competent');
  autoPlay(b, 'competent');
  endTurn(a);
  const g = turnSlices(b);
  let n = 0;
  for (;;) {
    const r = g.next();
    if (r.done) break;
    n++;
    if (b.civ.id !== b.player) outside = false;
  }
  slices += n;
  most = Math.max(most, n);
  turns++;
  if (plain(a) !== plain(b)) {
    same = false;
    console.log(`  first difference at turn ${a.turn}`);
    break;
  }
}
check(same, `slice by slice or at once, the same game (${turns} turns of seed 8919)`);
check(outside, 'between two slices the game is seen from our side: the swap to another civilization never spans a yield');
check(slices / turns >= 20, `a turn comes in many slices (${(slices / turns).toFixed(1)} on average, at most ${most})`);
done('SLICES');
