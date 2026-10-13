// Ships by role (the new version, part 2c): each class has a strength against ships, settlements and
// swarms, a screen, eyes, a dug-in bonus and an upkeep, and a Shipyard mends what is stopped at it.
// - strength(): a ship's own figure for a foe, else its attack; the Hunter twice a Warden on swarms.
// - defence against a swarm: a Hunter counts 6 where a Warden counts 3; an Aegis dug in counts three
//   times its attack, a Warden twice.
// - upkeep: what the warships cost a turn, more at a pace slower than the Tide, a tenth asleep.
// - a Shipyard mends a tenth of a hull a turn, and nothing without one.
// - screens combine: a Picket 50%, a Picket and a Warden 60%.
// - a Picket stopped sees twice as far; the Wardens' Oath takes a quarter off every warship.
import { SHIP_BY_ID, isWarship, strength } from '../../../src/game/data/ships';
import { newGame } from '../../../src/game/newGame';
import { buildCost } from '../../../src/game/sim/actions';
import { fleetUpkeep, newFleet, repairFleets, screenAt, updateDetection } from '../../../src/game/sim/fleets';
import { defenseAt } from '../../../src/game/sim/hunger';
import { computeMods } from '../../../src/game/sim/mods';
import { capital, distLy, fleets } from '../../../src/game/sim/util';
import { check, done } from '../lib';

const eq = (a: number, b: number) => Math.abs(a - b) < 1e-9;

check(strength('hunter', 'swarms') === 6 && strength('hunter', 'ships') === 3 && strength('warden', 'swarms') === 3, 'a Hunter is twice a Warden against swarms, and a Warden against anything else');
check(strength('picket', 'settlements') === 0.5 && strength('aegis', 'settlements') === 8 && strength('probe', 'ships') === 0, 'a Picket barely raids, an Aegis at its attack, a probe not at all');
check(isWarship('picket') && isWarship('hunter') && !isWarship('probe') && !isWarship('spore'), 'Pickets and Hunters are warships; a probe and a Lattice Spore are not');

const fresh = () => {
  const s = newGame({ seed: 1000, survivors: 3, civsAsleep: true });
  for (const f of fleets(s)) delete s.fleets[f.id];
  return s;
};

// defence against a swarm at our capital, warships alone (no grid there at the start)
{
  const s = fresh();
  const cap = capital(s)!;
  const mods = computeMods(s);
  const base = defenseAt(s, cap.systemId, mods);
  const w = newFleet(s, cap.systemId, ['warden']);
  const withWarden = defenseAt(s, cap.systemId, mods) - base;
  w.order = 'fortify';
  const wardenDug = defenseAt(s, cap.systemId, mods) - base;
  delete s.fleets[w.id];
  newFleet(s, cap.systemId, ['hunter']);
  const withHunter = defenseAt(s, cap.systemId, mods) - base;
  for (const f of fleets(s)) delete s.fleets[f.id];
  const a = newFleet(s, cap.systemId, ['aegis']);
  a.order = 'fortify';
  const aegisDug = defenseAt(s, cap.systemId, mods) - base;
  check(eq(withWarden, 3) && eq(withHunter, 6), `against a swarm a Warden adds ${withWarden}, a Hunter ${withHunter}`);
  check(eq(wardenDug, 6) && eq(aegisDug, 24), `dug in, a Warden twice its attack (${wardenDug}), an Aegis three times (${aegisDug})`);
}

// upkeep
{
  const s = fresh();
  const cap = capital(s)!;
  check(fleetUpkeep(s, 1) === 0, 'no warships, no upkeep');
  newFleet(s, cap.systemId, ['warden', 'picket']);
  newFleet(s, cap.systemId, ['probe']);
  check(eq(fleetUpkeep(s, 1), 0.4), `a Warden and a Picket: 0.4 energy a turn at the Tide (${fleetUpkeep(s, 1)}); a probe costs nothing`);
  check(eq(fleetUpkeep(s, 0.1), 0.4) && eq(fleetUpkeep(s, 10), 4), `a quicker pace no cheaper (${fleetUpkeep(s, 0.1)}), a tenfold slower one ten times dearer (${fleetUpkeep(s, 10)})`);
  s.civ.dormant = true;
  check(eq(fleetUpkeep(s, 1), 0.04), `asleep, a tenth (${fleetUpkeep(s, 1)})`);
}

// a Shipyard mends
{
  const s = fresh();
  const cap = capital(s)!;
  const f = newFleet(s, cap.systemId, ['warden']);
  f.ships[0].hp = 4;
  delete cap.structures.shipyard;
  repairFleets(s);
  check(f.ships[0].hp === 4, 'with no Shipyard, nothing is mended');
  cap.structures.shipyard = 1;
  repairFleets(s);
  check(eq(f.ships[0].hp, 5), `at a Shipyard, a tenth of the hull a turn (4 → ${f.ships[0].hp})`);
  for (let i = 0; i < 20; i++) repairFleets(s);
  check(f.ships[0].hp === SHIP_BY_ID.warden.hp, 'and never past a whole hull');
}

// screens, eyes, the Oath
{
  const s = fresh();
  const cap = capital(s)!;
  newFleet(s, cap.systemId, ['picket']);
  check(eq(screenAt(s, cap.systemId), 0.5), `a Picket turns half the raids away (${screenAt(s, cap.systemId)})`);
  newFleet(s, cap.systemId, ['warden']);
  check(eq(screenAt(s, cap.systemId), 0.6), `with a Warden, 60% (${screenAt(s, cap.systemId)})`);
  // eyes: far from home, a star between one and two plain ranges from where the ship waits
  const D = computeMods(s).detect;
  const home = s.systems[cap.systemId];
  const all = Object.values(s.systems);
  const spot = all
    .filter((x) => distLy(home, x) > D * 8)
    .map((x) => ({ x, mid: all.find((y) => y !== x && distLy(x, y) > D * 1.1 && distLy(x, y) <= D * 1.9 && distLy(home, y) > D * 8) }))
    .find((p) => p.mid)!;
  const sees = (cls: string) => {
    const t = fresh();
    for (const id of Object.keys(t.civ.known)) delete t.civ.known[id];
    const f = newFleet(t, spot.x.id, [cls]);
    f.scanned = spot.x.id; // (no long-baseline look: only its eyes)
    updateDetection(t, computeMods(t));
    return !!t.civ.known[spot.mid!.id];
  };
  check(!!spot && sees('picket') && !sees('warden'), `a Picket waiting at ${spot?.x.name} sees ${spot?.mid?.name}, ${Math.round(distLy(spot.x, spot.mid!))} ly off; a Warden there does not (plain eyes: ${Math.round(D)} ly)`);
  s.civ.charters.push('wardens_oath');
  check(buildCost(s, SHIP_BY_ID.hunter, true).industry === Math.round(SHIP_BY_ID.hunter.cost * 0.75) && buildCost(s, SHIP_BY_ID.probe, true).industry === SHIP_BY_ID.probe.cost, 'the Wardens’ Oath takes a quarter off every warship, not a probe');
}
done('BATTLE ROLES');
