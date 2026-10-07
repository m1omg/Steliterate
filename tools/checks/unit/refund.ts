// Removing something from the queue gives back everything paid up front, at the price recorded
// when it was queued (today's price for items from older saves); the record survives a save.
import { newGame } from '../../../src/game/newGame';
import { queueBuild, removeQueued } from '../../../src/game/sim/actions';
import { deserialize } from '../../../src/game/save';
import { check, done } from '../lib';

const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
const c = Object.values(s.colonies)[0];
s.civ.matter = 500;
s.civ.energy = 90;
const before = { m: s.civ.matter, e: s.civ.energy };
check(queueBuild(s, c.id, 'structure', 'solar_array') === null || queueBuild(s, c.id, 'structure', 'mine') === null, 'something queued');
const q = c.queue[c.queue.length - 1];
console.log(`  queued ${q.key}, paid ${JSON.stringify(q.paid)}, matter ${before.m} -> ${s.civ.matter}`);
check(s.civ.matter < before.m, 'it cost matter');
removeQueued(s, c.id, q.uid);
check(s.civ.matter === before.m && s.civ.energy === before.e, `removed at once: everything back (matter ${s.civ.matter}, energy ${s.civ.energy})`);
// half-built: still everything paid up front
queueBuild(s, c.id, 'structure', q.key);
const q2 = c.queue[c.queue.length - 1];
q2.progress = q2.cost * 0.6;
removeQueued(s, c.id, q2.uid);
check(s.civ.matter === before.m, 'removed after work began: materials all back');
// the price changes after queueing: what was paid comes back, not today's price
queueBuild(s, c.id, 'structure', q.key);
const q3 = c.queue[c.queue.length - 1];
const paid = q3.paid!.matter;
q3.paid = { matter: paid + 7, energy: 3 }; // stand-in for a charter discount that came later
const m0 = s.civ.matter,
  e0 = s.civ.energy;
removeQueued(s, c.id, q3.uid);
check(s.civ.matter === m0 + paid + 7 && s.civ.energy === e0 + 3, 'the recorded price is what comes back');
// an item from an older save, with no record: today's full price
queueBuild(s, c.id, 'structure', q.key);
const q4 = c.queue[c.queue.length - 1];
delete q4.paid;
const m1 = s.civ.matter;
removeQueued(s, c.id, q4.uid);
check(s.civ.matter === m1 + paid, 'an old-save item comes back at today’s full price');
// round trip through a save
queueBuild(s, c.id, 'structure', q.key);
const t = deserialize(JSON.stringify(s))!;
const q5 = t.colonies[c.id].queue[t.colonies[c.id].queue.length - 1];
check(q5.paid?.matter === paid, 'the record survives saving and loading');
done('REFUND');
