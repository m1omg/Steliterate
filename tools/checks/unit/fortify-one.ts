// Fortify one warship, or the whole fleet (31 Oct, the player: "selecting (1) ship to fortify,
// currently fortifies ALL ships in system. perhaps separate buttons for singular versus total
// fortification"). Ships built at a star join an idle fleet of their class there, so three builds
// make one fleet; Fortify one takes the warship in the best repair out of it as a fleet of its own,
// with its damage and the fleet's tactic, and digs it in; the rest wait for orders. A fleet of one
// is fortified as it was.
import { newGame } from '../../../src/game/newGame';
import { fortifyOne, standFleet } from '../../../src/game/sim/actions';
import { finishQueued } from '../../../src/game/sim/queue';
import { check, done } from '../lib';

const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
const c = s.colonies[s.civ.capitalId!];
const before = new Set(Object.keys(s.fleets));
for (let i = 0; i < 3; i++) finishQueued(s, c, { uid: `q-check-${i}`, kind: 'ship', key: 'picket', progress: 1, cost: 1 });
const made = Object.values(s.fleets).filter((f) => !before.has(f.id));
check(made.length === 1 && made[0].ships.length === 3, `three Pickets built at one star make one fleet (${made.map((f) => f.ships.length).join(', ')})`);
const f = made[0];
f.tactic = 'close';
f.ships[1].hp = 1; // one damaged
f.ships[2].hp = 4;
const hp = f.ships.map((x) => x.hp);
const err = fortifyOne(s, f.id);
const one = Object.values(s.fleets).find((x) => !before.has(x.id) && x.id !== f.id);
console.log(`  fleet ${hp.join('/')} hp: left ${f.ships.map((x) => x.hp).join('/')} (${f.order}); fortified ${one?.ships.map((x) => x.hp).join('/')} (${one?.order}, ${one?.tactic}, ${one?.name})`);
check(!err && !!one && one.ships.length === 1 && one.order === 'fortify' && one.at === f.at && one.tactic === 'close', 'Fortify one: one warship leaves as a fleet of its own, dug in where it was, with the fleet’s tactic');
check(one!.ships[0].hp === Math.max(...hp), 'it is the one in the best repair, its damage kept');
check(f.ships.length === 2 && f.order === 'idle' && f.ships.some((x) => x.hp === 1), 'the other two stay together, waiting for orders');
check(standFleet(s, f.id, 'fortify') === null && f.order === 'fortify' && f.ships.length === 2, 'Fortify all digs in the whole fleet');
// a fleet of one: Fortify one fortifies it, as Fortify did
const before2 = new Set(Object.keys(s.fleets));
finishQueued(s, c, { uid: 'q-check-solo', kind: 'ship', key: 'warden', progress: 1, cost: 1 });
const solo = Object.values(s.fleets).find((x) => !before2.has(x.id))!;
check(fortifyOne(s, solo.id) === null && solo.order === 'fortify' && Object.keys(s.fleets).length === before2.size + 1, 'a fleet of one is fortified as it was');
done('FORTIFY ONE');
