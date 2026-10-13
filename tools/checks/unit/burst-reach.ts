// Who a burst reaches (the player, 12 Oct: "rogue planets are no longer bound so should not get
// destroyed OR any benefit from a BH/stellar remnant evaporation flash, so only Deep settlements
// would benefit or be destroyed (or bound planets…)", and "By distance" for catching a neutron
// star's burst from another system).
// - A neutron star's burst destroys what is in its Deep or on a world it still holds; a settlement
//   on a world flung loose long before is far away, and stays.
// - Burst Catchers in other systems bank a share by the distance to the nearest burst, once each:
//   250 within 10 ly, less with the square of the distance beyond; nothing on a rogue world, and
//   nothing in a system cast out of the galaxy.
// - A black hole's final burst pays Burst Catchers in its Deep and on worlds it held until then,
//   not on worlds flung loose before.
import { createColony } from '../../../src/game/sim/fleets';
import { burstNeutronStars, burstShare, finalBurstCatch } from '../../../src/game/sim/crossing';
import { evaporateHole } from '../../../src/game/physics';
import { inItsSystem } from '../../../src/game/sim/util';
import { deserialize } from '../../../src/game/save';
import type { Body, CrossingReport, GameState, StarSystem } from '../../../src/game/types';
import { check, done, loadSave } from '../lib';

check(burstShare(5) === 250 && burstShare(10) === 250, `within 10 ly a catcher banks all 250 (${burstShare(5)}, ${burstShare(10)})`);
check(burstShare(20) === 63 && burstShare(50) === 10, `beyond, less with the square of the distance: 20 ly ${burstShare(20)}, 50 ly ${burstShare(50)}`);
check(burstShare(1e6) === 0, 'a burst across the galaxy gives nothing');

const s: GameState = loadSave('98139af-seed1000-turn121-last-star-out.json.gz');
const sys = Object.values(s.systems);
const worlds = (x: StarSystem) => x.bodies.map((id) => s.bodies[id]).filter((b): b is Body => !!b && !b.dissolved && b.kind !== 'deep' && !b.colonyId);
const deepOf = (x: StarSystem) => s.bodies[x.bodies.find((id) => s.bodies[id]?.kind === 'deep')!];
const settled = (x: StarSystem) => Object.values(s.colonies).some((c) => c.systemId === x.id);
const star = sys.find((x) => x.primary.kind === 'neutron_star' && !x.ejected && !x.gone && worlds(x).length >= 2 && !deepOf(x).colonyId && !settled(x))!;
check(!!star, `a neutron star to burst, with two worlds: ${star?.name}`);
const others = sys.filter((x) => x !== star && x.primary.kind !== 'neutron_star' && !x.gone && !x.ejected && worlds(x).length >= 1 && !deepOf(x).colonyId && !settled(x));
const [near, far, cast] = others;
const near2 = others.find((x) => x !== near && x !== far && x !== cast && worlds(x).length >= 1)!;
check(!!near && !!far && !!cast && !!near2, `four systems around it: ${near?.name}, ${near2?.name}, ${far?.name}, ${cast?.name}`);
// far out of the galaxy's way, so no other neutron star is near: the burst at 0, the rest at their distances
const at = (x: StarSystem, ly: number) => Object.assign(x.phys, { x: 5e6 + ly, y: 0, z: 0 });
at(star, 0);
at(near, 5);
at(near2, 6);
at(far, 20);
at(cast, 5);
cast.ejected = true;
const place = (b: Body, catchers: number, rogue?: boolean) => {
  if (rogue !== undefined) b.rogue = rogue;
  const c = createColony(s, b, { kin: 2 });
  c.structures = { ...c.structures, burst_catcher: catchers };
  return c;
};
const [w1, w2] = worlds(star);
const inDeep = place(deepOf(star), 1);
const onBound = place(w1, 0, false);
const onLoose = place(w2, 2, true);
const nearDeep = place(deepOf(near), 2);
const nearLoose = place(worlds(near2)[0], 2, true);
const farBound = place(worlds(far)[0], 1, false);
const castDeep = place(deepOf(cast), 2);
check(inItsSystem(s, inDeep) && inItsSystem(s, onBound) && !inItsSystem(s, onLoose), 'in its Deep or on a world it holds a settlement is in its system; on a world flung loose it is not');

const lines: CrossingReport['lines'] = [];
const caught = burstNeutronStars(s, lines);
const text = lines.map((l) => l.text).join(' ');
console.log(`  ${text}`);
check(!s.colonies[inDeep.id] && !s.colonies[onBound.id], 'the settlements in its Deep and on the world it held are lost');
check(!!s.colonies[onLoose.id], 'the one on a world flung loose long before stays');
check(caught === 2 * 250 + 63, `catchers bank 250 each at 5 ly and 63 at 20 ly, nothing on a rogue world or in a system cast out of the galaxy: ${caught} (want ${2 * 250 + 63})`);
check(/Burst Catchers at 2 of our settlements caught the flash from afar: \+563 energy/.test(text), 'the report says what was caught');
check(/One of our settlements was on a world flung loose from its neutron star long before/.test(text), 'and that one settlement was far away');
check(/2 of our settlements at neutron stars went with them/.test(text), 'and that two were lost');
check(star.primary.kind === 'void' && !star.gone, `the star is gone, its system left with the world flung loose (${star.primary.kind})`);
check(!!s.colonies[nearDeep.id] && !!s.colonies[nearLoose.id] && !!s.colonies[farBound.id] && !!s.colonies[castDeep.id], 'the settlements around it all stay');

// a black hole's final burst: what it held until then catches, a world flung loose before does not
const hole = others.find((x) => ![near, far, cast, near2].includes(x) && worlds(x).length >= 2)!;
check(!!hole, `a black hole to evaporate: ${hole?.name}`);
hole.primary.kind = 'black_hole';
const [h1, h2] = worlds(hole);
place(deepOf(hole), 1);
const held = place(h1, 2, false);
const loose = place(h2, 2, true);
const heldIds = evaporateHole(s, hole);
check(heldIds.includes(held.bodyId) && !heldIds.includes(loose.bodyId), `the evaporation says which worlds it held until then (${heldIds.length})`);
check(s.bodies[held.bodyId].rogue === true, 'and sets them loose');
check(finalBurstCatch(s, hole.id, heldIds) === 250 * (1 + 2), `its Deep and the world it held bank 250 a catcher: ${finalBurstCatch(s, hole.id, heldIds)}`);
check(inItsSystem(s, held, heldIds) && !inItsSystem(s, loose, heldIds), 'the world flung loose before banks nothing');

const t = deserialize(JSON.stringify(s))!;
check(!!t.colonies[onLoose.id] && t.systems[star.id].primary.kind === 'void', 'it all saves and loads');
done('BURST REACH');
