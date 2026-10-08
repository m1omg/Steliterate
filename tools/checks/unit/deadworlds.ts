// How worlds die and what is left of them (the planet audit of 8 Oct).
// - A system that falls into the Heart takes its worlds with it (a world already adrift drifts
//   on), and an older game's leftovers are cleared as it loads.
// - Nothing lives on a world frozen hard, Kin without domes included: no room there, unless
//   Orbital Lamps keep it warm.
// - A world whose slow decline kills it while its star still burns keeps its open sea, and we
//   hear that, not that it froze; a flare still boils a dead world's seas away (a water-rich world
//   keeps its own); nothing brings a dead homeworld back to life.
// - A world alone in the dark, with no star and no tides, freezes as a world flung loose does.
// - Kin cannot settle an ice giant; the home system's ice moon is locked, as Aster is.
// - Only starlight divides a locked world into day and night; its own heat warms both sides.
import { newGame } from '../../../src/game/newGame';
import { BURIED_HEAT, FROZEN_K, bodyClimate, buriedOcean, primaryLuminosity, vitalityLoss, waterState } from '../../../src/game/physics';
import { calendarEra } from '../../../src/game/fate';
import { migrate } from '../../../src/game/save';
import { canSettle, naturalKinRoom } from '../../../src/game/sim/fleets';
import { kinBaseCapacity } from '../../../src/game/sim/economy';
import { computeMods } from '../../../src/game/sim/mods';
import { endTurn } from '../../../src/game/sim/turn';
import { EVENT_BY_ID } from '../../../src/game/data/events';
import type { Body, GameState } from '../../../src/game/types';
import { check, done } from '../lib';

const fresh = () => newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' });
const free = (s: GameState) => (id: string) => !s.bodies[id].colonyId && s.bodies[id].kind !== 'deep';

// a system gone into the Heart, as an older game left it
{
  const s = fresh();
  const sys = Object.values(s.systems).find((x) => x.special !== 'home' && x.bodies.filter(free(s)).length >= 2)!;
  const [a, b] = sys.bodies.filter(free(s)).map((id) => s.bodies[id]);
  sys.gone = true;
  b.rogue = true;
  migrate(s);
  check(a.dissolved === true && !b.dissolved, `${sys.name}, fallen into the Heart: ${a.name} went with it, ${b.name} (adrift) drifts on`);
}

// a living world frozen hard
{
  const s = fresh();
  const home = Object.values(s.bodies).find((b) => b.traits.includes('homeworld'))!;
  const c = s.colonies[home.colonyId!];
  const room0 = kinBaseCapacity(s, c, computeMods(s));
  // its star long since a white dwarf, and the Last Light behind it
  const star = s.systems[home.systemId].primary;
  star.kind = 'white_dwarf';
  s.era = 'degenerate';
  s.years = 1e16;
  const cl = bodyClimate(s, home);
  const room1 = kinBaseCapacity(s, c, computeMods(s));
  check(room0 > 0 && (cl.day ?? cl.mean) < FROZEN_K && room1 === 0 && naturalKinRoom(home, s) === 0, `${home.name} frozen hard at η 16 (${(cl.day ?? cl.mean).toPrecision(2)} K): room for Kin ${room0} → ${room1}, and its panel says none`);
  c.structures.orbital_lamps = 1;
  const lit = kinBaseCapacity(s, c, computeMods(s));
  check(lit > 0, `with Orbital Lamps over it, room for ${lit} again`);
}

// dead of its decline, its star still burning
{
  const s = fresh();
  const home = Object.values(s.bodies).find((b) => b.traits.includes('homeworld'))!;
  home.vitality = 0.001;
  const n = s.log.length;
  endTurn(s);
  const said = s.log.slice(n).map((e) => e.text).find((t) => t.startsWith(`${home.name} has died.`)) ?? '';
  const cl = bodyClimate(s, home);
  check(home.vitality === 0 && home.kind === 'ice' && /star still keeps a sea open on its day side/.test(said) && !/frozen/.test(said), `${home.name} dies of its decline under a burning star: "${said}"`);
  check(/open sea on the day side/.test(waterState(home, cl)), `its water: "${waterState(home, cl)}" (${Math.round(cl.night!)}–${Math.round(cl.day!)} K)`);
  // nothing brings it back
  const bind = EVENT_BY_ID.sea_freezes.bind!(s, s.rng as never);
  const comet = EVENT_BY_ID.comet.choices[0];
  check(!bind && comet.ok !== undefined && !comet.ok(s, {}), 'no sea-freezes event binds to it, and no comet can be shepherded to it');
}

// a dead world in a flare loses its water; a water-rich one keeps its own
{
  const s = fresh();
  const red = Object.values(s.systems).find((x) => x.special !== 'home' && x.primary.kind === 'red_dwarf' && x.bodies.filter(free(s)).length >= 2)!;
  const [dry, rich] = red.bodies.filter(free(s)).map((id) => s.bodies[id]);
  // placed by the flare's light: where it gives them k kelvin
  const L = primaryLuminosity({ ...red.primary, kind: 'blue_dwarf' }, s.years, calendarEra(s));
  const at = (k: number) => Math.pow((278 * Math.pow(L, 0.25) * Math.pow(0.7, 0.25)) / k, 2);
  Object.assign(dry, { kind: 'ice', water: 0.4, vitality: 0, traits: ['tidally_locked'], orbitAU: at(900), rogue: false, dissolved: false });
  Object.assign(rich, { kind: 'ocean_ice', water: 0.97, vitality: 0, traits: ['tidally_locked', 'water_rich'], orbitAU: at(400), rogue: false, dissolved: false });
  red.primary.kind = 'blue_dwarf';
  red.primary.blueAt = s.years - 1e8;
  red.primary.whiteAt = s.years + 1e12;
  endTurn(s);
  check(dry.water! < 0.4 && rich.water === 0.97, `a flare boils the seas of a dead world (${dry.name}: 40% → ${Math.round(dry.water! * 100)}%) but not a water-rich one (${Math.round(rich.water! * 100)}%)`);
}

// alone in the dark
{
  const s = fresh();
  const dark = Object.values(s.systems).find((x) => x.primary.kind === 'rogue' && x.bodies.some(free(s)))!;
  const b: Body = { ...s.bodies[dark.bodies.find(free(s))!], kind: 'ocean_ice', vitality: 0.1, habitability: 0.15, traits: ['subsurface_ocean'], coreHeat: 0.15 };
  s.bodies[b.id] = b;
  const c = bodyClimate(s, b);
  check(vitalityLoss(s, b).freeze > 0 && !buriedOcean(s, b, c) && /frozen through/.test(waterState(b, c, buriedOcean(s, b, c))), `${b.name}, with no star and no tides: its vent life freezes, its water "${waterState(b, c, false)}"`);
  // and around a star the buried ocean lasts until its core heat runs out after the Last Light
  const home = Object.values(s.bodies).find((x) => x.systemId === s.civ.homeSystemId && x.kind === 'ocean_ice')!;
  const ok0 = buriedOcean(s, home);
  s.era = 'degenerate';
  s.years = 1e15;
  home.coreHeat = BURIED_HEAT * 1.5;
  const ok1 = buriedOcean(s, home);
  home.coreHeat = BURIED_HEAT / 2;
  const ok2 = buriedOcean(s, home);
  check(ok0 && ok1 && !ok2, `${home.name}'s buried ocean: liquid in the Dusk, and after the Last Light while its core heat lasts (${ok0}, ${ok1}, ${ok2})`);
}

// ice giants, and the home moon
{
  const s = fresh();
  const giant = Object.values(s.bodies).find((b) => b.kind === 'ice_giant' && !b.colonyId)!;
  check(!!canSettle(s, giant, 'kin') && !canSettle(s, giant, 'echoes'), `Kin cannot settle ${giant.name}, an ice giant ("${canSettle(s, giant, 'kin')}"); Echoes can`);
  const moon = Object.values(s.bodies).find((b) => b.systemId === s.civ.homeSystemId && b.kind === 'ocean_ice')!;
  check(moon.traits.includes('tidally_locked'), `${moon.name}, ${moon.orbitAU} AU from the home star, is locked as Aster is`);
}

// day and night divide only the starlight
{
  const s = fresh();
  const red = Object.values(s.systems).find((x) => x.special !== 'home' && x.primary.kind === 'red_dwarf' && x.bodies.some(free(s)))!;
  const b: Body = { ...s.bodies[red.bodies.find(free(s))!], kind: 'barren', vitality: 0, traits: ['tidally_locked'], coreHeat: 0.5, orbitAU: 400 };
  const c = bodyClimate(s, b);
  check(c.day! / c.night! < 1.05 && c.night! > 19, `a locked rock far out, warm from inside (${c.night!.toFixed(1)}–${c.day!.toFixed(1)} K): no day side to speak of`);
}

done('DEAD WORLDS');
