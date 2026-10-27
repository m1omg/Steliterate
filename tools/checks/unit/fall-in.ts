// Worlds fall into brown dwarfs and black holes too (19 Oct; the player, asked whether worlds
// should merge with black holes and brown dwarfs as physics says: "Yes, new games only").
// Gravitational waves drain every orbit, whatever it circles. In a game begun since then
// (`flags.all_fall`):
// - a brown dwarf's world reaches its tidal limit on the date its orbit's decay gives with the
//   dwarf's true mass, and is torn apart and rains onto it, a faint warmth (×0.008 of a white
//   dwarf's), with no draw;
// - a black hole's is torn apart far outside its horizon and gone within the turn, and a
//   settlement on it gets off to the Deep as from any world that falls in;
// - the forecast warns of both, and a place lasts only until then.
// A game begun before keeps the bend: those worlds never fall, and (the fix for everyone) the
// forecast no longer warns that they will.
import { newGame } from '../../../src/game/newGame';
import { ERA_BY_ID } from '../../../src/game/eras';
import { inspiralTime } from '../../../src/game/gen';
import { BROWN_FEED_SHARE, allFall, evolveUniverse, fallsInAt, sourceLight } from '../../../src/game/physics';
import { createColony } from '../../../src/game/sim/fleets';
import { updateForecasts } from '../../../src/game/sim/forecast';
import { lastsUntil } from '../../../src/game/sim/sites';
import { endTurn } from '../../../src/game/sim/turn';
import { colonies } from '../../../src/game/sim/util';
import type { Body, GameState, PrimaryKind } from '../../../src/game/types';
import { check, done } from '../lib';

const START = ERA_BY_ID.dusk.startYears;
const fresh = () => newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable', civsAsleep: true }) as GameState;
/** A world of this kind of star with an orbit (not the Deep), unsettled. */
const worldOf = (s: GameState, kind: PrimaryKind): Body =>
  Object.values(s.bodies).find((b) => b.kind !== 'deep' && b.orbitAU > 0 && !b.colonyId && !b.rogue && s.systems[b.systemId].primary.kind === kind && !s.systems[b.systemId].special)!;
/** Into the Degenerate Age, at these years. */
const at = (s: GameState, years: number) => {
  s.era = 'degenerate';
  s.years = years;
  s.eta = Math.log10(years);
};

{
  const s = fresh();
  check(allFall(s), 'a new game has brown dwarfs and black holes take their worlds in');
  const b = worldOf(s, 'brown_dwarf');
  const p = s.systems[b.systemId].primary;
  const date = fallsInAt(s, b);
  const want = START + inspiralTime(b.orbitAU, b.massEarth, p.mass);
  check(Math.abs(date - want) <= 1e-9 * want && date !== b.inspiralAt, `${b.name} (a brown dwarf of ${p.mass.toFixed(3)} Suns, ${b.orbitAU.toFixed(4)} AU) falls in at 10^${Math.log10(date).toFixed(2)} years by its true mass (the start's date, floored at 0.1, said 10^${Math.log10(b.inspiralAt!).toFixed(2)})`);
  check(lastsUntil(s, b) === date, 'a place on it lasts until then');
  at(s, date * 0.999);
  let draws = 0;
  const notes = evolveUniverse(s, date * 0.999, date * 1.001, () => (draws++, 0.999));
  check(!!b.feeding && b.feeding.model === 'feed' && b.vitality === 0, `at its date it is torn apart and feeds the dwarf (${b.feeding?.model})`);
  check(Math.abs((b.feeding?.base ?? 0) - BROWN_FEED_SHARE * Math.min(3, Math.max(0.3, b.massEarth))) < 1e-12, `a faint warmth: ×${BROWN_FEED_SHARE} of what it would give a white dwarf`);
  check(notes.some((n) => n.kind === 'feeding' && n.bodyId === b.id), 'and the turn hears of it');
  // (its warmth counts from the next step, as a white dwarf's does, and fades as (1 + t/τ)^-2:
  // read it just after it began)
  evolveUniverse(s, b.feeding!.start, b.feeding!.start + 1e10, () => 0.999);
  const light = sourceLight(s, s.systems[b.systemId], s.years, 1e10);
  check(/raining onto it/.test(light.label), `the dwarf reads "${light.label}"`);
  // a game begun before: the bend kept
  const old = fresh();
  delete old.flags.all_fall;
  const ob = old.bodies[b.id];
  check(!isFinite(fallsInAt(old, ob)), 'in a game begun before, it never falls in');
  at(old, date * 0.999);
  evolveUniverse(old, date * 0.999, date * 1.001, () => 0.999);
  check(!ob.feeding && !ob.dissolved, 'and at that date nothing happens to it');
}

// a black hole's world, settled: torn apart within the turn, its people off to the Deep
{
  const s = fresh();
  const b = worldOf(s, 'black_hole');
  const sys = s.systems[b.systemId];
  at(s, 3e20);
  s.civ.known[sys.id] = 2;
  // (cast out of the galaxy, so no close pass strips it first on a turn this long)
  sys.ejected = true;
  const c = createColony(s, b, { kin: 0, echoes: 8 });
  // its orbit brought in so it reaches the hole's tides within the coming turn
  const t = s.years * 1.0000001 - START;
  b.orbitAU = 0.1 * Math.pow(t / (3e19 * (1 / Math.max(0.01, b.massEarth)) * Math.pow(0.6 / Math.max(0.05, sys.primary.mass), 2)), 0.25);
  check(fallsInAt(s, b) > s.years && fallsInAt(s, b) < s.years * 1.001, `${b.name}, at ${b.orbitAU.toFixed(3)} AU from a ${sys.primary.mass.toFixed(0)}-Sun hole, falls in just after now`);
  updateForecasts(s);
  const fc = s.civ.forecasts.find((f) => f.kind === 'inspiral' && f.bodyId === b.id);
  check(!!fc && /torn apart by its black hole/.test(fc.title), `the forecast warns: "${fc?.title}"`);
  endTurn(s);
  const deep = colonies(s).find((x) => x.systemId === sys.id && s.bodies[x.bodyId].kind === 'deep');
  check(b.dissolved === true && !s.colonies[c.id], `${b.name} is gone within the turn, and the settlement on it`);
  // (three in four of those left when it fell: the turn's own losses come first)
  check(!!deep && deep.pops.echoes >= 5, `three in four of its people got off to the Deep (${deep?.pops.echoes ?? 0} of 8 Echoes)`);
}

// the false warning, gone in a game begun before
{
  const s = fresh();
  delete s.flags.all_fall;
  const b = worldOf(s, 'brown_dwarf');
  at(s, b.inspiralAt! * 0.5);
  createColony(s, b, { kin: 2 });
  updateForecasts(s);
  check(!s.civ.forecasts.some((f) => f.kind === 'inspiral' && f.bodyId === b.id), `in a game begun before, no warning that ${b.name} will fall into its brown dwarf (it never does)`);
}

done('FALL IN');
