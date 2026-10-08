// Accord's uses: Rally, Calm and Hear a Thread, priced by how often they are used, once a turn
// each, easing back by a tenth of a doubling a turn; and the prices survive a save.
import { newGame } from '../../../src/game/newGame';
import { accordCheck, accordCost, coolAccord, spendAccord } from '../../../src/game/sim/accord';
import { deserialize } from '../../../src/game/save';
import { check, done } from '../lib';

const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
s.civ.accord = 999;
s.civ.resolve = 40;
s.civ.dissent = 30;
s.civ.standing.kin = 30;
check(accordCost(s, 'rally') === 80 && accordCost(s, 'calm') === 60 && accordCost(s, 'hear', 'kin') === 50, 'fresh prices 80 / 60 / 50');
check(spendAccord(s, 'rally') === null && s.civ.resolve === 43 && s.civ.accord === 919, `Rally: resolve 40 -> ${s.civ.resolve}, accord 999 -> ${s.civ.accord}`);
check(spendAccord(s, 'rally') === 'Once a turn.', 'only once a turn');
check(accordCost(s, 'rally') === 160, `then it costs ${accordCost(s, 'rally')} (doubled)`);
check(spendAccord(s, 'calm') === null && s.civ.dissent === 26, `Calm: dissent 30 -> ${s.civ.dissent}`);
check(spendAccord(s, 'hear', 'kin') === null && s.civ.standing.kin === 35, `Hear the Kin: standing 30 -> ${s.civ.standing.kin}`);
check(accordCost(s, 'hear', 'echoes') === 50, 'hearing one Thread does not raise the price for another');
check(!!accordCheck(s, 'hear', 'lattice'), `the Lattice cannot be heard (${accordCheck(s, 'hear', 'lattice')})`);
s.turn++;
coolAccord(s);
check(accordCost(s, 'rally') === Math.round(80 * Math.pow(2, 0.9)), `a turn later: ${accordCost(s, 'rally')} (eased by a tenth of a doubling)`);
for (let i = 0; i < 9; i++) {
  s.turn++;
  coolAccord(s);
}
check(accordCost(s, 'rally') === 80 && s.civ.flags.acc_rally_heat === undefined && s.civ.flags.acc_rally_turn === undefined, 'ten turns on, back to 80, the counters gone');
s.civ.accord = 10;
check(accordCheck(s, 'rally') === 'Needs 80 accord.', 'not enough accord: refused');
s.civ.accord = 999;
s.civ.resolve = 100;
check(!!accordCheck(s, 'rally'), 'full resolve: nothing to rally');
spendAccord(s, 'calm');
const t = deserialize(JSON.stringify(s))!;
check(accordCost(t, 'calm') === accordCost(s, 'calm') && accordCheck(t, 'calm') === 'Once a turn.', 'prices and the once-a-turn rule survive saving and loading');
done('ACCORD');
