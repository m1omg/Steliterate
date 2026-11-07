// The galaxy at 10¹² years (interregnum.ts; 1 Nov, the player's "prequel mode"). A game begun in
// the Dusk is generated exactly as before (seeds are sacred: the hashes below are of the build
// before the Interregnum). One begun in the Interregnum is the same galaxy rewound, with draws of
// its own:
// - our home, and each neighbour's, keeps its worlds and their names around a heavier, older red
//   dwarf (0.19 to 0.22 M☉) that flares blue a little over three-quarters of the way through the
//   age, its worlds widened to keep their light, our world young (no failing dynamo);
// - the Dusk's red dwarfs are nebulae, their worlds not yet formed (out of state.bodies);
// - most of the Dusk's white dwarfs were old red dwarfs then, going out heaviest first; a few young
//   stars, the brighter ones rare; one or two blue giants; every shining star by a name of its own.
import { INTERREGNUM_START, YOUNG_CLASSES, redDwarfLife } from '../../../src/game/interregnum';
import { estimateEraTurns, turnsUntil } from '../../../src/game/eras';
import { newGame } from '../../../src/game/newGame';
import { hashSeed } from '../../../src/game/rng';
import type { GameState } from '../../../src/game/types';
import { check, done } from '../lib';

const hashOf = (g: GameState) =>
  hashSeed(JSON.stringify({ s: g.systems, b: g.bodies, v: g.survivors, c: g.colonies, f: g.fleets, civs: g.civs, sw: g.swarms }, (_k, v) => (v === Infinity ? '__inf' : v)));
check(hashOf(newGame({ seed: 1000 })) === 2871165249 && hashOf(newGame({ seed: 20260927 })) === 201712825, 'a game begun in the Dusk is generated exactly as before (seeds 1000 and 20260927)');

const dusk = newGame({ seed: 1000 });
const s = newGame({ seed: 1000, interregnum: true });
const again = newGame({ seed: 1000, interregnum: true });
check(hashOf(s) === hashOf(again), 'the same seed gives the same Interregnum');
check(Object.keys(s.systems).join() === Object.keys(dusk.systems).join(), 'the same systems, where they were');

// the home
const home = s.systems[s.civ.homeSystemId];
const p = home.primary;
const turnsToFlare = turnsUntil('dusk', s.years, p.blueAt!, 'standard', 0, 200);
// (turn 88 to 94 of 114 since 7 Nov, the Tide grown as the Dusk's; 46 to 50 of 60 until then)
check(p.kind === 'red_dwarf' && p.mass >= 0.19 && p.mass <= 0.22 && turnsToFlare >= 86 && turnsToFlare <= 96, `our star: a red dwarf of ${p.mass.toFixed(3)} M☉, flaring at turn ${turnsToFlare} of ${estimateEraTurns('interregnum', 'standard')}`);
const hw = home.bodies.map((id) => s.bodies[id]).find((b) => b.traits.includes('homeworld'))!;
const hw0 = dusk.systems[dusk.civ.homeSystemId].bodies.map((id) => dusk.bodies[id]).find((b) => b.traits.includes('homeworld'))!;
const widen = Math.sqrt((0.23 * Math.pow(p.mass, 2.3)) / (0.23 * Math.pow(0.1, 2.3)));
check(hw.name === hw0.name && Math.abs(hw.orbitAU / hw0.orbitAU - widen) < 1e-9 && hw.vitality === 1 && hw.coreHeat === 1 && !hw.traits.includes('failing_dynamo') && hw.traits.includes('tidally_locked'), `our world keeps its name, widened ${widen.toFixed(2)}×, young: no failing dynamo (${hw.name} at ${hw.orbitAU.toFixed(3)} AU)`);
for (const sv of Object.values(s.survivors)) {
  const q = s.systems[sv.homeSystemId].primary;
  check(sv.way === 'lattice' ? q.kind === 'brown_dwarf' : q.kind === 'red_dwarf' && q.mass >= 0.19 && q.mass <= 0.22, `${sv.name}: ${q.kind} ${q.mass.toFixed(3)}`);
}
check(Object.keys(s.colonies).length === Object.keys(dusk.colonies).length && Object.keys(s.civs).length === 4, 'we and the three neighbours are settled at our homes');

// the systems
const kinds: Record<string, number> = {};
for (const x of Object.values(s.systems)) kinds[x.primary.kind] = (kinds[x.primary.kind] ?? 0) + 1;
const duskRed = Object.values(dusk.systems).filter((x) => (x.primary.kind === 'red_dwarf' || x.primary.kind === 'blue_dwarf') && !x.special);
check(duskRed.every((x) => s.systems[x.id].primary.kind === 'nebula' && s.systems[x.id].primary.future?.kind === x.primary.kind && s.systems[x.id].bodies.length === 0), `every red dwarf of the Dusk is a nebula, its star its future, its worlds unformed (${duskRed.length})`);
const unformed = Object.values(s.systems).flatMap((x) => x.unformed ?? []);
check(unformed.length > 0 && unformed.every((b) => !s.bodies[b.id]), `unformed worlds are kept out of state.bodies (${unformed.length})`);
const neb = Object.values(s.systems).filter((x) => x.primary.kind === 'nebula');
check(neb.every((x) => x.primary.bornAt! > INTERREGNUM_START && x.primary.bornAt! < 9e13), 'every nebula lights within the age');
const reds = Object.values(s.systems).filter((x) => x.primary.kind === 'red_dwarf' && !x.special);
check(reds.length >= 15 && reds.every((x) => x.primary.blueAt! < 1.4e13), `the old red dwarfs (${reds.length}) all go out within the age`);
// heaviest first: the heavier, the sooner
const byMass = [...reds].sort((a, b) => b.primary.mass - a.primary.mass);
check(byMass[0].primary.blueAt! <= byMass[byMass.length - 1].primary.blueAt!, 'the heaviest first');
check(reds.every((x) => !/^(WD|PSR|BH) /.test(x.name)), 'each by a name of its own, not the Dusk’s catalogue');
near0();

// across 40 galaxies: young stars few, the brighter ones rare, one or two blue giants alive
let kg = 0,
  fa = 0,
  bAlive = 0,
  games = 0;
for (let g = 0; g < 40; g++) {
  const x = newGame({ seed: 5000 + g * 31, interregnum: true, civsAsleep: true });
  games++;
  for (const sys of Object.values(x.systems)) {
    const q = sys.primary.kind === 'nebula' ? sys.primary.future! : sys.primary;
    if (q.kind !== 'young_star') continue;
    if (q.cls === 'K' || q.cls === 'G') kg++;
    else if (q.cls === 'F' || q.cls === 'A') fa++;
    else if (sys.primary.kind === 'young_star') bAlive++;
  }
}
check(kg / games >= 1 && kg / games <= 6, `orange and yellow dwarfs: ${(kg / games).toFixed(1)} a galaxy`);
check(fa / games > 0.2 && fa / games < 3 && fa < kg, `white stars, rarer: ${(fa / games).toFixed(1)} a galaxy`);
check(bAlive / games >= 1 && bAlive / games <= 2, `blue giants burning at the start: ${(bAlive / games).toFixed(1)} a galaxy`);
check(Math.abs(redDwarfLife(0.25) - 1e12) < 1 && Math.abs(redDwarfLife(0.08) / 1.2e13 - 1) < 0.05, 'a red dwarf lives 10¹² years at 0.25 M☉, about 1.2 × 10¹³ at 0.08');
check(YOUNG_CLASSES.A.light > YOUNG_CLASSES.G.light && YOUNG_CLASSES.G.light > YOUNG_CLASSES.K.light && YOUNG_CLASSES.K.light > 2.1, 'brighter by class, every one brighter than any red dwarf');

function near0() {
  check(kinds.nebula > 0 && kinds.young_star > 0, `kinds at 10¹² years: ${JSON.stringify(kinds)}`);
}

done('INTERREGNUM GALAXY');
