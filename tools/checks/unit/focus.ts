// The Matter focus: matter ×1.25 at the cost of a tenth of energy and insight; other focuses leave
// matter alone; the choice survives a save.
import { newGame } from '../../../src/game/newGame';
import { colonyTurn } from '../../../src/game/sim/economy';
import { computeMods } from '../../../src/game/sim/mods';
import { turnStep } from '../../../src/game/sim/flare';
import { colonies } from '../../../src/game/sim/util';
import { deserialize } from '../../../src/game/save';
import type { Focus } from '../../../src/game/types';
import { check, done } from '../lib';

const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
const c = colonies(s)[0];
c.structures.mine = Math.max(1, c.structures.mine ?? 0);
const mods = computeMods(s);
const step = turnStep(s);
const ctx = { mods, years: s.years, L: step.turnLength, logL: Math.log10(step.turnLength), paceFactor: 1 };
const at = (f: Focus) => {
  c.focus = f;
  return colonyTurn(s, c, ctx, 1e9).y;
};
const bal = at('balanced'),
  mat = at('matter'),
  en = at('energy'),
  ins = at('insight');
console.log(`  matter raised: balanced ${bal.matter.toFixed(3)}, matter ${mat.matter.toFixed(3)}, energy ${en.matter.toFixed(3)}, insight ${ins.matter.toFixed(3)}`);
check(bal.matter > 0, 'the settlement raises matter');
check(Math.abs(mat.matter / bal.matter - 1.25) < 1e-9, 'Matter focus: ×1.25');
check(en.matter === bal.matter && ins.matter === bal.matter, 'other focuses leave matter alone');
check(mat.matterUpkeep === bal.matterUpkeep, `matter upkeep unchanged (${bal.matterUpkeep})`);
check(Math.abs(mat.energy / bal.energy - 0.9) < 0.02 || mat.energy < bal.energy, `Matter focus costs energy (${bal.energy.toFixed(2)} -> ${mat.energy.toFixed(2)})`);
check(Math.abs(mat.insight / bal.insight - 0.9) < 1e-9, 'and insight ×0.9');
c.focus = 'matter';
const t = deserialize(JSON.stringify(s))!;
check(t.colonies[c.id].focus === 'matter', 'a save holding the Matter focus loads with it');
done('FOCUS');
