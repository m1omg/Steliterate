// The AI's judgement in war (the new version, part 2d):
// - desperate five turns running, and bold (caution under 0.4), another civilization falls on the
//   richest neighbour it can beat with the warships it has: one with three times its stores (and
//   100), not desperate itself, not a friend, bound to it by no pact, its front within five turns
//   of its nearest warships; without a cause, and it says why; a cautious one, one desperate only
//   since this turn, one whose neighbour is a friend, or one whose warships cannot reach the front
//   in time, does not;
// - worth it, but not yet strong enough for all it would meet there (every warship of theirs, dug
//   in), it arms while it can;
// - a siege carries off what its blockade drains (plunder): the besieged's stores go to the besiegers;
// - the desperate make peace once they have taken a settlement, or their plight has eased;
// - an enemy that knows Relativistic Arks makes it keep a Picket at its capital, which stays there;
// - far down the Hunger's path, at war, it strikes the enemy's most peopled settlement with a
//   Kinetic Lance.
import { autoPlay } from '../../../src/game/auto';
import { asCiv, flushOutbox } from '../../../src/game/civs';
import { newGame } from '../../../src/game/newGame';
import { battlesTurn, declareOn, fleetFire, frontOf, guardAt, plunder, warOf } from '../../../src/game/sim/conflict';
import { FORTIFY_BONUS, newFleet } from '../../../src/game/sim/fleets';
import { isWarship } from '../../../src/game/data/ships';
import { plight } from '../../../src/game/sim/plight';
import { tieOf } from '../../../src/game/sim/ties';
import { allColonies, distLy, popsOf, temperament } from '../../../src/game/sim/util';
import type { GameState } from '../../../src/game/types';
import { check, done } from '../lib';

/** A galaxy with a bold civilization (caution under 0.4) and a cautious one among the others. */
function galaxy(): { s: GameState; bold: string; cautious: string; rich: string } {
  for (let seed = 1000; seed < 1100; seed++) {
    const s = newGame({ seed, survivors: 3 });
    const ids = Object.keys(s.survivors).filter((id) => s.civs[id]).sort();
    const bold = ids.find((id) => temperament(s, id).caution < 0.4);
    const cautious = ids.find((id) => temperament(s, id).caution >= 0.4 && id !== bold);
    const rich = ids.find((id) => id !== bold && id !== cautious);
    if (bold && cautious && rich) return { s, bold, cautious, rich };
  }
  throw new Error('no galaxy with a bold and a cautious neighbour');
}
/** Desperate since four turns ago (the fifth turn of it is this one), its stores nearly gone and falling. */
const despair = (s: GameState, id: string) => {
  const c = s.civs[id];
  c.energy = 5;
  c.flags.last_energy_net = -10;
  c.flags.desperate_since = s.turn - 4;
  c.accord = 200;
};
/** Well off: stores of 500, rising. */
const thrive = (s: GameState, id: string) => {
  const c = s.civs[id];
  c.energy = 500;
  c.flags.last_energy_net = 10;
  c.resolve = Math.max(c.resolve, 60);
};
/** Warships enough to carry half again all they would meet at the front (what stands there, and every warship of theirs, dug in), waiting at the front's star (or, `home`, at its capital). */
const arm = (s: GameState, id: string, on: string, home = false) => {
  const front = frontOf(s, on, id)!;
  const at = home ? s.colonies[s.civs[id].capitalId!].systemId : front;
  const g = guardAt(s, front, on) + Object.values(s.fleets).filter((f) => f.owner === on && f.at !== front).reduce((a, f) => a + fleetFire(f), 0) * FORTIFY_BONUS;
  return asCiv(s, id, () => newFleet(s, at, Array(Math.ceil((1.6 * Math.max(1, g)) / 3) + 1).fill('warden'), 'Host'));
};
const setup = () => {
  const g = galaxy();
  const { s, bold, cautious, rich } = g;
  for (const id of [bold, cautious]) {
    despair(s, id);
    arm(s, id, rich);
    tieOf(s, id, rich).regard[id] = 0;
    // (not us: we have not met)
    s.survivors[id].contact = false;
  }
  thrive(s, rich);
  return g;
};

// the desperate and bold fall on the rich; the cautious do not
{
  const { s, bold, cautious, rich } = setup();
  check(plight(s, bold) >= 0.6 && plight(s, rich) < 0.3, `${s.civs[bold].name} is desperate (${plight(s, bold).toFixed(2)}), ${s.civs[rich].name} is not (${plight(s, rich).toFixed(2)})`);
  asCiv(s, cautious, () => autoPlay(s, 'competent'));
  check(!warOf(s, cautious, rich), `${s.civs[cautious].name}, desperate but cautious (${temperament(s, cautious).caution.toFixed(2)}), makes no war`);
  asCiv(s, bold, () => autoPlay(s, 'competent'));
  flushOutbox(s);
  const w = warOf(s, bold, rich);
  check(w?.by === bold && w.motive === 'desperate' && !w.cause, `${s.civs[bold].name}, desperate and bold (${temperament(s, bold).caution.toFixed(2)}), goes to war on ${s.civs[rich].name}, with no cause (${JSON.stringify(w)})`);
  check(s.civs[bold].flags.war_desperate === 1, 'counted as a desperate war');
  check(!!s.tidings?.some((x) => /went to war with/.test(x.text)), 'and we hear of it');
}

// not five turns yet; or the rich one a friend
{
  const { s, bold, rich } = setup();
  s.civs[bold].flags.desperate_since = s.turn;
  // (its plight holds, so the first turn of it is this one)
  asCiv(s, bold, () => autoPlay(s, 'competent'));
  check(!warOf(s, bold, rich) && s.civs[bold].flags.desperate_since === s.turn, 'desperate only since this turn: no war yet');
  const t = setup();
  tieOf(t.s, t.bold, t.rich).regard[t.bold] = 30;
  asCiv(t.s, t.bold, () => autoPlay(t.s, 'competent'));
  check(!warOf(t.s, t.bold, t.rich), 'nor on a friend');
  const g = setup();
  g.s.gfe = 0.15;
  asCiv(g.s, g.bold, () => autoPlay(g.s, 'competent'));
  check(!warOf(g.s, g.bold, g.rich), 'nor once the galaxy’s free energy is down to a fifth');
  // its warships far from the front, at the Dusk's speeds
  const u = setup();
  for (const f of Object.values(u.s.fleets)) if (f.owner === u.bold && f.name === 'Host') delete u.s.fleets[f.id];
  arm(u.s, u.bold, u.rich, true);
  const ly = distLy(u.s.systems[u.s.colonies[u.s.civs[u.bold].capitalId!].systemId], u.s.systems[frontOf(u.s, u.rich, u.bold)!]);
  asCiv(u.s, u.bold, () => autoPlay(u.s, 'competent'));
  check(!warOf(u.s, u.bold, u.rich), `nor when its warships are ${ly.toFixed(0)} ly from the front: more than five turns away`);
}

// worth it, but too weak yet: it arms
{
  const { s, bold, rich } = setup();
  for (const f of Object.values(s.fleets)) if (f.owner === bold && f.ships.some((x) => isWarship(x.cls))) delete s.fleets[f.id];
  // (one Warden at the front, its only warship: it is within reach, but far too weak)
  asCiv(s, bold, () => newFleet(s, frontOf(s, rich, bold)!, ['warden'], 'Scout'));
  const c = s.civs[bold];
  c.energy = 300;
  c.flags.last_energy_net = -100;
  // (it can build Wardens)
  if (!c.techs.includes('orbital_defense')) c.techs.push('orbital_defense');
  s.civs[rich].energy = 1000;
  const cap = s.colonies[c.capitalId!];
  cap.structures.shipyard = Math.max(1, cap.structures.shipyard ?? 0);
  cap.queue = [];
  asCiv(s, bold, () => autoPlay(s, 'competent'));
  check(!warOf(s, bold, rich) && cap.queue.some((q) => q.key === 'warden'), `no war yet, but it arms: ${cap.queue.map((q) => q.key).join(', ')}`);
}

// the siege carries off what it drains; peace once it has taken, or its plight has eased
{
  const { s, bold, rich } = setup();
  const front = frontOf(s, rich, bold)!;
  declareOn(s, bold, rich, undefined, front, 'desperate');
  for (const f of Object.values(s.fleets)) if (f.owner === rich && f.at === front) delete s.fleets[f.id];
  // (behind a grid, with no Breacher: the siege holds and no one storms it)
  for (const c of allColonies(s)) if (c.owner === rich && c.systemId === front) c.structures.defense_grid = 1;
  asCiv(s, bold, () => newFleet(s, front, ['warden', 'warden', 'warden', 'warden'], 'Siege'));
  const e0 = s.civs[bold].energy;
  const r0 = s.civs[rich].energy;
  const take = plunder(s, rich);
  battlesTurn(s);
  flushOutbox(s);
  check(take > 0 && s.civs[bold].energy === e0 + take && s.civs[rich].energy === r0 - take, `a turn of siege: ${take} energy of the besieged’s stores carried off (${r0} → ${s.civs[rich].energy}; ${e0} → ${s.civs[bold].energy})`);
  warOf(s, bold, rich)!.took = 1;
  asCiv(s, bold, () => autoPlay(s, 'competent'));
  check(!warOf(s, bold, rich), 'it has taken a settlement: it makes peace');
  const t = setup();
  declareOn(t.s, t.bold, t.rich, undefined, frontOf(t.s, t.rich, t.bold), 'desperate');
  thrive(t.s, t.bold);
  asCiv(t.s, t.bold, () => autoPlay(t.s, 'competent'));
  check(!warOf(t.s, t.bold, t.rich), 'its plight eased: it makes peace');
}

// a Picket at home against a Kinetic Lance; the corrupted strike with one
{
  const { s, bold, rich } = setup();
  thrive(s, bold);
  s.civs[bold].techs.push('orbital_defense', 'relativistic_arks');
  s.civs[rich].techs.push('relativistic_arks');
  s.civs[bold].taint = 70;
  const front = frontOf(s, rich, bold)!;
  declareOn(s, bold, rich, undefined, front, 'corrupted');
  const cap = s.colonies[s.civs[bold].capitalId!];
  cap.structures.shipyard = Math.max(1, cap.structures.shipyard ?? 0);
  cap.queue = [];
  const watch = asCiv(s, bold, () => newFleet(s, cap.systemId, ['picket'], 'Watch'));
  asCiv(s, bold, () => newFleet(s, cap.systemId, ['lance'], 'Lance'));
  asCiv(s, bold, () => autoPlay(s, 'competent'));
  check(s.fleets[watch.id]?.at === cap.systemId && !s.fleets[watch.id]?.to, 'its Picket keeps its watch at the capital while the line goes to the front');
  const lance = Object.values(s.fleets).find((f) => f.owner === bold && f.order === 'strike');
  const most = allColonies(s).filter((c) => c.owner === rich).sort((a, b) => popsOf(b) - popsOf(a))[0];
  check(!!lance && lance.targetColony === most.id, `far down the Hunger’s path, it strikes ${most.name}, the most peopled settlement of its enemy, with a Kinetic Lance`);
  check(s.civs[bold].flags.lances === 1, 'counted');
  // the other side: an enemy that knows Relativistic Arks, and no Picket at home: it builds one
  const homeCap = s.colonies[s.civs[rich].capitalId!];
  homeCap.structures.shipyard = Math.max(1, homeCap.structures.shipyard ?? 0);
  homeCap.queue = [];
  s.civs[rich].techs.push('orbital_defense');
  for (const f of Object.values(s.fleets)) if (f.owner === rich && f.ships.some((x) => x.cls === 'picket')) delete s.fleets[f.id];
  asCiv(s, rich, () => autoPlay(s, 'competent'));
  check(homeCap.queue.some((q) => q.key === 'picket'), `${s.civs[rich].name}, its enemy able to strike with a Lance, builds a Picket at its capital`);
}
done('DESPERATE WAR');
