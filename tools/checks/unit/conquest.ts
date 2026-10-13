// Conquest, a settlement at a time (the new version, part 2c-3), by the same rules for everyone:
// - a settlement can be stormed only in a war, with warships at its star and none of its owner's,
//   after SIEGE_TURNS of siege; behind a Defence Grid or a Bastion Shell, only with a Breacher;
// - taken, FLEE of its people flee to their own nearest settlement, its structures keep SPOILS,
//   its hearth is damaged, and it changes hands; razed, it is gone; either way the galaxy's free
//   energy pays CONQUEST_GFE for each person and structure it held, and the war goes on at the
//   enemy's next settlement;
// - a conquest without a cause is a Hunger act: Taint for the conqueror;
// - a civilization that loses its last settlement is gone ('Conquered', or 'Seized' by us), and so
//   is our game ('Conquered', endings.ts);
// - our own seize of a civilization of its own is the same assault, at the settlement the war is
//   fought at;
// - a Kinetic Lance flies at nearly the speed of light, spends free energy as it goes, and strikes as
//   it arrives: a world's settlement struck down whole, one in the Deep by half; the screens of the
//   target's ships there may turn it aside; one in flight at a time.
import { asCiv, flushOutbox } from '../../../src/game/civs';
import { newGame } from '../../../src/game/newGame';
import { CONQUEST_GFE, FLEE, LANCE_DEEP, LANCE_GFE, SPOILS, TAKEN_DAMAGE, assaultBlocked, battlesTurn, declareOn, frontOf, holdOf, launchStrike, strikeBlocked, warOf } from '../../../src/game/sim/conflict';
import { checkEndings } from '../../../src/game/sim/endings';
import { LANCE_SPEED, advanceFleets, createColony, deepFor, newFleet } from '../../../src/game/sim/fleets';
import { computeMods } from '../../../src/game/sim/mods';
import { seizeSurvivor } from '../../../src/game/sim/survivors';
import { HUNGER_CAUSE, SIEGE_TURNS, declareWar, warTurn } from '../../../src/game/sim/war';
import { allColonies, popsOf } from '../../../src/game/sim/util';
import type { Colony, GameState } from '../../../src/game/types';
import { THREADS } from '../../../src/game/types';
import { check, done, near } from '../lib';

const fresh = () => {
  const s = newGame({ seed: 1000, survivors: 3 });
  const [a, b, c] = Object.keys(s.survivors).filter((id) => s.civs[id]).sort();
  // (every settlement seen at once, for the Lance's targets)
  for (const x of Object.values(s.colonies)) delete x.foundedAt;
  return { s, a, b, c };
};
const theirs = (s: GameState, id: string) => allColonies(s).filter((x) => x.owner === id);
const at = (s: GameState, id: string, sys: string) => theirs(s, id).find((x) => x.systemId === sys);
/** Nothing of a civilization's guards a star: its warships gone, its walls down. */
const unguard = (s: GameState, id: string, sys: string, walls = true) => {
  for (const f of Object.values(s.fleets)) if (f.owner === id && f.at === sys) delete s.fleets[f.id];
  if (walls) for (const x of theirs(s, id)) if (x.systemId === sys) for (const k of ['defense_grid', 'bastion']) delete x.structures[k];
};
/** A second settlement of a civilization's, at the free star nearest its first. */
const second = (s: GameState, id: string, not: string[]): Colony => {
  const home = s.systems[theirs(s, id)[0].systemId];
  const free = Object.values(s.systems)
    .filter((x) => !x.special && !not.includes(x.id) && !Object.values(s.colonies).some((c) => c.systemId === x.id))
    .map((x) => ({ x, d: Math.hypot(x.phys.x - home.phys.x, x.phys.y - home.phys.y, x.phys.z - home.phys.z) }))
    .sort((p, q) => p.d - q.d)
    .map((p) => p.x)
    .find((x) => x.bodies.some((b) => s.bodies[b].kind !== 'deep' && !s.bodies[b].colonyId))!;
  const body = free.bodies.map((b) => s.bodies[b]).find((b) => b.kind !== 'deep' && !b.colonyId)!;
  return asCiv(s, id, () => {
    const c = createColony(s, body, { kin: 4, echoes: 2 });
    c.structures.habitat_dome = 2;
    return c;
  });
};
const heldBy = (c: Colony) => popsOf(c) + Object.values(c.structures).reduce((x, y) => x + y, 0);

// the siege, the walls, and the taking
{
  const { s, a, b } = fresh();
  s.civs[a].accord = 200;
  const front = frontOf(s, b, a)!;
  const far = second(s, b, [front]);
  check(declareOn(s, a, b, HUNGER_CAUSE, front) === null, `${s.civs[a].name} goes to war on ${s.civs[b].name}, at ${s.systems[front].name}`);
  unguard(s, b, front, false);
  const c = at(s, b, front)!;
  c.structures.defense_grid = Math.max(1, c.structures.defense_grid ?? 0);
  asCiv(s, a, () => newFleet(s, front, Array(4).fill('warden'), 'Host'));
  check(/Hold the siege/.test(assaultBlocked(s, a, c) ?? ''), 'it cannot storm the settlement before the siege has held');
  for (let i = 0; i < SIEGE_TURNS; i++) battlesTurn(s);
  check(at(s, b, front) === c && /only a Breacher/.test(assaultBlocked(s, a, c) ?? ''), `the siege held ${SIEGE_TURNS} turns, it still cannot break through the Defence Grid without a Breacher`);
  // a Breacher comes, and the siege holds again
  asCiv(s, a, () => newFleet(s, front, Array(6).fill('breacher'), 'Breach'));
  check(assaultBlocked(s, a, c) === null, 'with a Breacher, it can storm it');
  const pops = { ...c.pops };
  const structures = { ...c.structures };
  const refuge0 = popsOf(far);
  const gfe0 = s.gfe;
  const held = heldBy(c);
  const damage0 = c.damage;
  const taint0 = s.civs[a].taint;
  const dissent0 = s.civs[a].dissent;
  // (the next turn's battles find the siege already held)
  battlesTurn(s);
  flushOutbox(s);
  check(c.owner === a, `stormed: ${c.name} is ${s.civs[a].name}'s now`);
  const fled = THREADS.reduce((x, t) => x + Math.floor(pops[t] * FLEE), 0);
  check(THREADS.every((t) => c.pops[t] === pops[t] - Math.floor(pops[t] * FLEE)) && popsOf(far) === refuge0 + fled, `${Math.round(FLEE * 100)}% of its people fled to ${far.name} (${fled}); the rest stay`);
  check(Object.entries(structures).every(([k, n]) => (c.structures[k] ?? 0) === Math.floor(n * SPOILS)), `its structures keep ${Math.round(SPOILS * 100)}% (${JSON.stringify(structures)} → ${JSON.stringify(c.structures)})`);
  near(`its hearth damaged by ${TAKEN_DAMAGE}`, c.damage, Math.min(1, damage0 + TAKEN_DAMAGE));
  near(`the galaxy's free energy pays for the ${held} people and structures it held`, s.gfe, gfe0 - CONQUEST_GFE * held);
  check(s.civs[a].taint === taint0 && s.civs[a].dissent > dissent0, 'a war on the Hunger in them carries no Taint, though it weighs on its own people');
  const w = warOf(s, a, b);
  check(!!w && w.at === far.systemId && w.siege === 0, `the war goes on, at ${s.systems[far.systemId].name}`);
  check(!s.civs[b].outcome, 'and they play on');
  // the last of them
  unguard(s, b, far.systemId);
  for (const f of Object.values(s.fleets)) if (f.owner === a) f.at = far.systemId;
  for (let i = 0; i <= SIEGE_TURNS; i++) battlesTurn(s);
  flushOutbox(s);
  check(far.owner === a && !theirs(s, b).length && s.civs[b].outcome?.ending === 'Conquered' && s.survivors[b].fate === 'conquered', `its last settlement taken, ${s.civs[b].name} is gone: conquered (${s.civs[b].outcome?.ending}, ${s.survivors[b].fate})`);
  check(!warOf(s, a, b), 'and the war with it');
}

// without a cause: razed, and a Hunger act
{
  const { s, a, b } = fresh();
  s.civs[a].accord = 200;
  s.civs[a].taint = 65;
  const front = frontOf(s, b, a)!;
  second(s, b, [front]);
  declareOn(s, a, b, undefined, front);
  unguard(s, b, front);
  asCiv(s, a, () => newFleet(s, front, Array(6).fill('breacher'), 'Host'));
  const c = at(s, b, front)!;
  const id = c.id;
  const held = heldBy(c);
  const gfe0 = s.gfe;
  for (let i = 0; i < SIEGE_TURNS; i++) battlesTurn(s);
  check(!s.colonies[id] && !at(s, b, front), `far down the Hunger's path itself, it razed ${c.name}`);
  near('the galaxy paid for what it held', s.gfe, gfe0 - CONQUEST_GFE * held);
  check(s.civs[a].taint === 65 + 8, `with no cause, razing is a Hunger act: Taint 65 → ${s.civs[a].taint}`);
  check(!!s.tidings?.some((x) => /razed/.test(x.text) && x.taintOf === a), 'and we hear of it as one');
}

// our own seize of a civilization of its own: the same assault, a settlement at a time
{
  const { s, b } = fresh();
  const sv = s.survivors[b];
  sv.contact = true;
  s.civ.accord = 200;
  sv.taintSeen = 70;
  check(declareWar(s, b) === null, `we go to war on ${sv.name}`);
  const front = sv.war!.at!;
  check(front === frontOf(s, b, s.player) && sv.war!.cause === HUNGER_CAUSE, `at their settlement nearest us, ${s.systems[front].name}, for the Hunger in them`);
  const far = second(s, b, [front]);
  unguard(s, b, front);
  newFleet(s, front, Array(6).fill('breacher'), 'Spear');
  check(/Hold the siege/.test(seizeSurvivor(s, b) ?? ''), 'we must hold the siege first');
  for (let i = 0; i < SIEGE_TURNS; i++) warTurn(s, () => 0.5);
  flushOutbox(s);
  const c = at(s, b, front)!;
  const taint0 = s.civ.taint;
  check(seizeSurvivor(s, b) === null && c.owner === s.player, `held ${SIEGE_TURNS} turns, we took ${c.name}`);
  check(sv.alive && sv.war?.at === far.systemId && s.civ.taint === taint0, `they live on, the war goes on at ${s.systems[far.systemId].name}, and the Hunger in them was our cause: no Taint`);
  unguard(s, b, far.systemId);
  for (const f of Object.values(s.fleets)) if (f.owner === s.player && f.name === 'Spear') f.at = far.systemId;
  for (let i = 0; i < SIEGE_TURNS; i++) warTurn(s, () => 0.5);
  flushOutbox(s);
  check(seizeSurvivor(s, b, true) === null && !s.colonies[far.id], `we razed ${far.name}, their last`);
  flushOutbox(s);
  check(!sv.alive && sv.fate === 'destroyed' && !sv.war && s.civs[b].outcome?.ending === 'Seized', `and they are gone: ${sv.fate}`);
}

// a war they began: we fight where they come; a front that is gone moves on
{
  const { s, a, b } = fresh();
  s.civs[a].accord = 200;
  const front = frontOf(s, s.player, a)!;
  declareOn(s, a, s.player, HUNGER_CAUSE, front);
  const sv = s.survivors[a];
  sv.contact = true;
  const theirFront = frontOf(s, a, s.player)!;
  unguard(s, a, theirFront);
  newFleet(s, theirFront, Array(6).fill('breacher'), 'Spear');
  check(/They began this war/.test(seizeSurvivor(s, a) ?? ''), 'in a war they began, we cannot storm theirs');
  // the settlement the war is fought at is lost to something else: the war goes on at our next
  const mine = theirs(s, s.player);
  const next = second(s, s.player, [front]);
  for (const x of mine) if (x.systemId === front) {
    s.bodies[x.bodyId].colonyId = null;
    delete s.colonies[x.id];
  }
  asCiv(s, a, () => newFleet(s, next.systemId, ['warden'], 'Raiders'));
  battlesTurn(s);
  check(warOf(s, a, s.player)?.at === next.systemId, `with ${s.systems[front].name} gone, the war goes on at ${s.systems[next.systemId].name}`);
  void b;
}

// our last settlement taken: a defeat of its own
{
  const { s, a } = fresh();
  const mine = theirs(s, s.player);
  for (const x of mine.slice(1)) {
    s.bodies[x.bodyId].colonyId = null;
    delete s.colonies[x.id];
  }
  s.civ.capitalId = mine[0].id;
  s.civs[a].accord = 200;
  const front = mine[0].systemId;
  check(declareOn(s, a, s.player, HUNGER_CAUSE, front) === null, 'war on us, at our only settlement');
  unguard(s, s.player, front);
  asCiv(s, a, () => newFleet(s, front, Array(8).fill('breacher'), 'Host'));
  for (let i = 0; i < SIEGE_TURNS; i++) battlesTurn(s);
  flushOutbox(s);
  check(mine[0].owner === a, `${s.civs[a].name} took ${mine[0].name}`);
  check(checkEndings(s)?.ending === 'Conquered', `our game ends: ${s.civ.outcome?.ending}`);
}

// the Kinetic Lance
{
  const { s, b } = fresh();
  const sv = s.survivors[b];
  sv.contact = true;
  s.civ.accord = 200;
  s.civ.energy = 1e5;
  const target = theirs(s, b)[0];
  const lone = newFleet(s, s.civ.homeSystemId, ['lance', 'warden'], 'Strike Group');
  check(/Only in a war/.test(strikeBlocked(s, lone.id, target.id) ?? ''), 'only in a war');
  declareWar(s, b);
  const gfe0 = s.gfe;
  check(launchStrike(s, lone.id, target.id) === null, `launched at ${target.name}`);
  const lance = Object.values(s.fleets).find((f) => f.order === 'strike')!;
  check(!!lance && lance.id !== lone.id && lone.ships.length === 1 && lone.ships[0].cls === 'warden', 'the Lance leaves its fleet and goes alone');
  near('driving it to nearly the speed of light spends free energy', s.gfe, gfe0 - LANCE_GFE);
  const pair = newFleet(s, s.civ.homeSystemId, ['lance', 'lance'], 'Spare Lances');
  check(/One Kinetic Lance in flight/.test(strikeBlocked(s, pair.id, target.id) ?? ''), 'one in flight at a time');
  const ly = lance.distance;
  advanceFleets(s, 1, computeMods(s));
  near(`it flies at ${LANCE_SPEED} of light, whatever our ships can do`, lance.traveled, Math.min(ly, Math.max(computeMods(s).speed, LANCE_SPEED)));
  advanceFleets(s, 1e9, computeMods(s));
  check(lance.at === target.systemId && lance.order === 'strike', 'it arrives, and does not stop');
  const held = heldBy(target);
  const g1 = s.gfe;
  unguard(s, b, target.systemId, false);
  battlesTurn(s);
  flushOutbox(s);
  check(!s.colonies[target.id] && !s.fleets[lance.id], `a settlement on a world is struck down whole (${target.name}), and the Lance is spent`);
  near('the galaxy pays for what it held', s.gfe, g1 - CONQUEST_GFE * held);
  // of a fleet of two Lances, one goes
  const next = theirs(s, b)[0];
  if (next) {
    check(launchStrike(s, pair.id, next.id) === null && pair.ships.length === 1 && s.fleets[pair.id]?.order !== 'strike', 'of two Lances in one fleet, one goes and one waits');
  }
}

// screens turn it aside; the Deep loses only a part
{
  const { s, b } = fresh();
  const sv = s.survivors[b];
  sv.contact = true;
  s.civ.accord = 200;
  s.civ.energy = 1e5;
  declareWar(s, b);
  const target = theirs(s, b)[0];
  asCiv(s, b, () => newFleet(s, target.systemId, Array(20).fill('picket'), 'Screen'));
  const pops = popsOf(target);
  const lance = newFleet(s, s.civ.homeSystemId, ['lance'], 'Lance');
  launchStrike(s, lance.id, target.id);
  advanceFleets(s, 1e9, computeMods(s));
  battlesTurn(s);
  check(!!s.colonies[target.id] && popsOf(target) === pops && !s.fleets[lance.id], 'twenty Pickets waiting there turn it aside, and it is spent');
  // in the Deep
  const sys = s.systems[target.systemId];
  const deep = deepFor(s, sys, b)!;
  const d = asCiv(s, b, () => {
    const c = createColony(s, deep, { echoes: 4 });
    c.structures.substrate_core = 2;
    return c;
  });
  // (we see a new settlement once its light reaches us: this one, at once)
  delete d.foundedAt;
  for (const f of Object.values(s.fleets)) if (f.owner === b && f.name === 'Screen') delete s.fleets[f.id];
  const l2 = newFleet(s, s.civ.homeSystemId, ['lance'], 'Lance II');
  check(launchStrike(s, l2.id, d.id) === null, `launched at ${d.name}, in the Deep`);
  advanceFleets(s, 1e9, computeMods(s));
  battlesTurn(s);
  check(!!s.colonies[d.id] && d.pops.echoes === 4 - Math.ceil(4 * LANCE_DEEP) && (d.structures.substrate_core ?? 0) === 2 - Math.ceil(2 * LANCE_DEEP), `scattered through the Deep, it loses ${LANCE_DEEP * 100}% (echoes 4 → ${d.pops.echoes}, cores 2 → ${d.structures.substrate_core ?? 0})`);
  check(holdOf(d) > 0, 'and lives on');
}
done('CONQUEST');
