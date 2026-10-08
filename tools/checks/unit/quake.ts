// A wrong answer to the halo civilization can shake a world: a living world loses life; a lifeless
// one has its hearth cracked instead (+30% damage), and loses no life.
import { newGame } from '../../../src/game/newGame';
import { gesture, patternAnswer } from '../../../src/game/sim/minds';
import { colonies } from '../../../src/game/sim/util';
import { check, done } from '../lib';

let wrongEffects = 0;
function run(alive: boolean) {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
  const c = colonies(s)[0];
  const b = s.bodies[c.bodyId];
  b.rogue = false;
  b.vitality = alive ? 0.8 : 0;
  s.minds.dark.stage = 2;
  s.minds.dark.lastPattern = [1, 2, 3];
  let shook = 0,
    cracked = 0;
  for (let i = 0; i < 400; i++) {
    s.civ.energy = 999;
    s.civ.matter = 999;
    s.civ.flags.gesture_turn = -1;
    const right = patternAnswer(s.minds.dark.lastPattern);
    const wrong = (['continue', 'mirror', 'resonance'] as const).find((x) => x !== right)!;
    const v0 = b.vitality,
      d0 = c.damage,
      lastBefore = s.log.length ? s.log[s.log.length - 1] : null;
    b.rogue = false;
    gesture(s, wrong);
    const last = s.log[s.log.length - 1];
    if (last === lastBefore) continue;
    if (/thinner sky/.test(last.text)) {
      shook++;
      if (!(b.vitality < v0 && c.damage === d0)) wrongEffects++;
    }
    if (/cracked the hearth|hearth is cracked/.test(last.text)) {
      cracked++;
      if (!(Math.abs(c.damage - Math.min(1, d0 + 0.3)) < 1e-12 && b.vitality === v0)) wrongEffects++;
    }
    c.damage = 0;
    b.vitality = alive ? 0.8 : 0;
  }
  return { shook, cracked };
}
const a = run(true);
check(a.shook > 0 && a.cracked === 0, `a living world: ${a.shook} shakes cost it life, no cracked hearths`);
const d = run(false);
check(d.cracked > 0 && d.shook === 0, `a dead world: ${d.cracked} cracked hearths (+30% each), no lost life`);
check(wrongEffects === 0, `every shake did exactly what it said (${wrongEffects} did not)`);
done('QUAKE');
