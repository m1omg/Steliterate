// Spare work for a settlement with nothing queued: Recycle (the default, as before), Study, Tend
// the collectors (never more than a quarter of what they make) or Morale; nothing changes while
// something is queued; the choice survives a save.
import { newGame } from '../../../src/game/newGame';
import { endTurn } from '../../../src/game/sim/turn';
import { setSpare } from '../../../src/game/sim/actions';
import { colonies } from '../../../src/game/sim/util';
import { deserialize } from '../../../src/game/save';
import type { GameState, SpareWork } from '../../../src/game/types';
import { check, done } from '../lib';

// one turn with an empty queue, under each choice; everything else the same
function turn(spare: SpareWork | null, tweak?: (s: GameState) => void) {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
  const c = colonies(s)[0];
  c.queue = [];
  s.civ.resolve = 50;
  if (spare) setSpare(s, c.id, spare);
  tweak?.(s);
  s.pending.length = 0;
  const before = { m: s.civ.matter, e: s.civ.energy };
  endTurn(s);
  const cc = s.colonies[c.id];
  return { s, c: cc, ind: cc.last!.industry, eMade: cc.last!.energy, dm: s.civ.matter - before.m, de: s.civ.energy - before.e, dr: s.civ.resolve, ins: s.civ.flags.last_insight ?? 0 };
}
const bare = (s: GameState) => {
  const c = colonies(s)[0];
  for (const k of Object.keys(c.structures)) if (k !== 'shipyard') delete c.structures[k];
};
const busyQueue = (s: GameState) => {
  colonies(s)[0].queue = [{ uid: 'q1', kind: 'structure', key: 'archive_spire', progress: 0, cost: 9999 }];
};

const base = turn(null);
const rec = turn('salvage');
const study = turn('study');
const tend = turn('tend');
const mor = turn('morale');
console.log(`  spare industry ${base.ind.toFixed(2)}, energy made ${base.eMade.toFixed(2)}`);
check(rec.dm === base.dm && rec.de === base.de && rec.ins === base.ins, 'Recycle is exactly what an idle settlement did before (the default)');
check(Math.abs(study.dm - (base.dm - base.ind * 0.1)) < 1e-9, `Study: no recycled matter (${base.dm.toFixed(2)} -> ${study.dm.toFixed(2)})`);
check(Math.abs(study.ins - base.ins - base.ind * 0.1) < 1e-9, `Study: insight +${(study.ins - base.ins).toFixed(2)} (0.1 per point)`);
const tendWant = Math.min(base.ind * 0.13, base.eMade * 0.25);
check(Math.abs(tend.de - (base.de + tendWant)) < 1e-6 || tend.s.civ.energy === tend.s.civ.flags.reserve_cap, `Tend: energy +${(tend.de - base.de).toFixed(2)} (want ${tendWant.toFixed(2)})`);
check(Math.abs(mor.dr - base.dr - base.ind * 0.01 * 0.97) < 1e-9, `Morale: resolve ${base.dr.toFixed(3)} -> ${mor.dr.toFixed(3)} (0.01 per point, less the 3% drift toward 50)`);
// tending needs something to tend: at most a quarter of what it makes
const poor = turn('tend', bare);
const poorBase = turn(null, bare);
console.log(`  bare settlement: spare ${poor.ind.toFixed(2)}, makes ${poor.eMade.toFixed(2)} energy`);
check(poor.de - poorBase.de <= poor.eMade * 0.25 + 1e-9, `Tend never adds more than a quarter of what it makes (+${(poor.de - poorBase.de).toFixed(2)} of ${poor.eMade.toFixed(2)})`);
// a queue in progress: no spare work at all
const busy = turn('study', busyQueue);
const busyBase = turn(null, busyQueue);
check(busy.ins === busyBase.ins && busy.dm === busyBase.dm, 'with something queued, the choice changes nothing');
// saves
const t = deserialize(JSON.stringify(study.s))!;
check(t.colonies[study.c.id].spare === 'study', 'the choice survives saving and loading');
check(rec.c.spare === 'salvage' && base.c.spare === undefined, 'choosing Recycle is remembered; a settlement never given work (and every old save) still recycles');
done('SPARE');
