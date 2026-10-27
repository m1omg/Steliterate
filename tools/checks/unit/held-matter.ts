// The top bar never shows more than we hold (27 Oct, the player: "but i have 30 matter", a build of
// 30 refused with 29.6 shown rounded to 30): amounts we hold are rounded down, and a build we cannot
// pay for says what we have, to a tenth.
import { newGame } from '../../../src/game/newGame';
import { buildableStructures, buildCost, queueBuild } from '../../../src/game/sim/actions';
import { held } from '../../../src/ui/fmt';
import { check, done } from '../lib';

check(held(29.6) === '29' && held(30) === '30' && held(0.4) === '0', `held amounts are rounded down (29.6 shows ${held(29.6)})`);
const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
const c = s.colonies[s.civ.capitalId!];
// a structure the capital can build that costs matter: 0.4 short of it
const pick = buildableStructures(s, c).find((x) => !x.error && buildCost(s, x.def, false).matter >= 10)!;
const need = buildCost(s, pick.def, false).matter;
s.civ.matter = need - 0.4;
const err = queueBuild(s, c.id, 'structure', pick.def.id);
console.log(`  ${pick.def.name} (${need} matter) with ${need - 0.4}: ${err}`);
check(err === `Needs ${need} matter; we have ${need - 0.4}.`, 'refused, and it says what we have');
s.civ.matter = need;
const ok = queueBuild(s, c.id, 'structure', pick.def.id);
check(ok === null, `with ${need} it is queued (${ok})`);
done('HELD MATTER');
