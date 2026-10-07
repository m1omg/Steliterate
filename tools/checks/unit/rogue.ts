// A rogue world never falls in: Coldminds read "never falls in"; a bound world keeps its year.
import { newGame } from '../../../src/game/newGame';
import { lastsUntil, siteValue } from '../../../src/game/sim/sites';
import { check, done } from '../lib';

const s = newGame({ seed: 1000 });
const worlds = s.systems[s.civ.homeSystemId].bodies.map((id) => s.bodies[id]).filter((b) => b.kind !== 'deep' && b.inspiralAt && !b.traits.includes('homeworld'));
const [r, kept] = worlds;
r.rogue = true;
const vr = siteValue(s, r, 'coldminds');
const vk = siteValue(s, kept, 'coldminds');
console.log(`  rogue ${r.name}: inspiralAt ${r.inspiralAt?.toExponential(2)} → "${vr.label}"; bound ${kept.name}: "${vk.label}"`);
check(lastsUntil(r) === Infinity && vr.label === 'never falls in', 'a rogue world never falls in');
check(lastsUntil(kept) === kept.inspiralAt && /^lasts /.test(vk.label), 'a bound world keeps its fall-in year');
check(vr.score > vk.score, 'Coldminds rank the rogue world first (it lasts longest)');
done('ROGUE');
