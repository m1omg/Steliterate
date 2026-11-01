// The Twilight Interregnum's stars as time passes (physics.ts interregnumStars; 1 Nov):
// - a nebula lights as its star at its birth, its worlds formed with it, frozen if cold;
// - an old red dwarf flares blue and leaves a white dwarf of 0.95 of its mass;
// - a young star leaves its white dwarf, its close worlds coming in only then;
// - a blue giant explodes: its remnant left, a settlement there lost, living worlds within 30 ly
//   stripped of some air, unless a Flash Shelter keeps life underground; it is forecast;
// - the galaxy's gas thins, and a Gas Scoop brings in matter only near a nebula, only in such a game;
// - The Last Gas destroys nothing, and tells what the age did.
import { evolveUniverse, SUPERNOVA_LY } from '../../../src/game/physics';
import { DUSK_START, GAS_SCOOP_LY, gasLeft, nebulaNear } from '../../../src/game/interregnum';
import { newGame } from '../../../src/game/newGame';
import { STRUCTURE_BY_ID } from '../../../src/game/data/structures';
import { structureCheck } from '../../../src/game/sim/actions';
import { techAvailable } from '../../../src/game/sim/research';
import { colonyTurn } from '../../../src/game/sim/economy';
import { project } from '../../../src/game/sim/projection';
import { updateForecasts } from '../../../src/game/sim/forecast';
import { runCrossing } from '../../../src/game/sim/crossing';
import { computeMods } from '../../../src/game/sim/mods';
import { copyState } from '../../../src/game/save';
import { check, done } from '../lib';

const base = newGame({ seed: 1000, interregnum: true, civsAsleep: true });
const rand = () => 0.5;
const sysOf = (s: typeof base, pred: (k: string, x: (typeof base.systems)[string]) => boolean) => Object.values(s.systems).find((x) => pred(x.primary.kind, x))!;

// a nebula lights, with its worlds
{
  const s = copyState(base);
  const neb = sysOf(s, (k, x) => k === 'nebula' && x.primary.future?.kind === 'red_dwarf');
  const n = neb.unformed!.length;
  const at = neb.primary.bornAt!;
  // (everything due by then happens too: every star born or gone by then, counted for The Last Gas)
  const notes = evolveUniverse(s, at - 1, at + 1, rand);
  check(neb.primary.kind === 'red_dwarf' && !neb.unformed && neb.bodies.length === n && neb.bodies.every((id) => !!s.bodies[id]), `${neb.name}: a nebula lights as a red dwarf, its ${n} worlds formed`);
  const born = notes.filter((x) => x.kind === 'born' && s.systems[x.systemId].primary.kind !== 'brown_dwarf').length;
  const gone = notes.filter((x) => x.kind === 'white' || x.kind === 'young_death' || x.kind === 'core_collapse').length;
  check(s.flags.ir_born === born && s.flags.ir_died === gone && born > 0 && gone > 0, `the stars born and gone are counted for The Last Gas (${born} born, ${gone} gone)`);
}
// an old red dwarf: blue, then a white dwarf of 0.95 of its mass
{
  const s = copyState(base);
  const red = sysOf(s, (k, x) => k === 'red_dwarf' && !x.special);
  const m = red.primary.mass;
  evolveUniverse(s, red.primary.blueAt! - 1, red.primary.blueAt! + 1, rand);
  const blue = red.primary.kind === 'blue_dwarf';
  evolveUniverse(s, red.primary.whiteAt! - 1, red.primary.whiteAt! + 1, rand);
  check(blue && red.primary.kind === 'white_dwarf' && Math.abs(red.primary.mass - Math.max(0.08, m * 0.95)) < 1e-12, `${red.name}: flares blue, then a white dwarf of ${red.primary.mass.toFixed(3)} M☉ (0.95 of ${m.toFixed(3)})`);
}
// a young star (K to A) leaves its white dwarf, and its close worlds come in
{
  const s = copyState(base);
  const young = Object.values(s.systems).find((x) => x.primary.kind === 'young_star' && x.primary.cls !== 'B') ?? Object.values(s.systems).find((x) => x.primary.kind === 'nebula' && x.primary.future?.kind === 'young_star' && x.primary.future.cls !== 'B')!;
  const born = young.primary.kind === 'nebula' ? young.primary.bornAt! : s.years;
  const star = young.primary.kind === 'nebula' ? young.primary.future! : young.primary;
  if (young.primary.kind === 'nebula') evolveUniverse(s, born - 1, born + 1, rand);
  const close = (young.unformed ?? []).filter((b) => b.kind !== 'deep');
  check(young.primary.kind === 'young_star' && close.every((b) => b.orbitAU < 0.1), `${young.name}: a young ${star.cls} star, its close worlds not yet in (${close.length})`);
  const notes = evolveUniverse(s, star.diesAt! - 1, star.diesAt! + 1, rand);
  check(young.primary.kind === 'white_dwarf' && young.primary.whiteAt === star.diesAt && !young.unformed && notes.some((n) => n.kind === 'young_death'), `it leaves a white dwarf of ${young.primary.mass.toFixed(2)} M☉, its close worlds in`);
}
// a blue giant explodes: a settlement there lost, nearby life wounded but where sheltered, forecast first
{
  const s = copyState(base);
  const giant = sysOf(s, (k, x) => k === 'young_star' && x.primary.cls === 'B');
  const cap = s.colonies[s.civ.capitalId!];
  const hw = s.bodies[cap.bodyId];
  // bring it beside us, for the check
  giant.phys = { x: s.systems[cap.systemId].phys.x + SUPERNOVA_LY / 2, y: s.systems[cap.systemId].phys.y, z: s.systems[cap.systemId].phys.z };
  updateForecasts(s);
  check(s.civ.forecasts.some((f) => f.systemId === giant.id && /explode/.test(f.title)), `forecast: ${giant.name} will explode`);
  const remnant = giant.primary.future!.kind;
  const v0 = hw.vitality;
  const sheltered = copyState(s);
  sheltered.colonies[sheltered.civ.capitalId!].structures.shadow_shield = 1;
  const notes = evolveUniverse(s, giant.primary.diesAt! - 1, giant.primary.diesAt! + 1, rand);
  check(giant.primary.kind === remnant && notes.some((n) => n.kind === 'core_collapse' && n.hurt?.includes(hw.id)), `${giant.name} explodes, leaving its ${remnant.replace('_', ' ')}`);
  check(Math.abs(hw.vitality - Math.max(0.02, v0 - 0.3)) < 1e-12, `our world within ${SUPERNOVA_LY} ly loses some of its air (${v0.toFixed(2)} → ${hw.vitality.toFixed(2)})`);
  const g2 = sheltered.systems[giant.id];
  evolveUniverse(sheltered, g2.primary.diesAt! - 1, g2.primary.diesAt! + 1, rand);
  check(sheltered.bodies[hw.id].vitality === v0, 'but not one whose life a shelter keeps');
}
// the gas, and the Gas Scoop
{
  check(gasLeft(1e12) === 1 && gasLeft(DUSK_START) === 0 && Math.abs(gasLeft(Math.sqrt(1e12 * DUSK_START)) - 0.5) < 1e-9, 'the gas thins from all of it to none, by the logarithm of time');
  const s = copyState(base);
  const d = STRUCTURE_BY_ID.gas_scoop;
  s.civ.techs.push('interstellar_scooping');
  const cap = s.colonies[s.civ.capitalId!];
  const near = nebulaNear(s, s.systems[cap.systemId]);
  check(techAvailable(base, 'interstellar_scooping'), 'Interstellar Scooping can be researched from the start of such a game');
  check(near ? structureCheck(s, cap, d) === null : /nebula within/.test(structureCheck(s, cap, d) ?? ''), `a Gas Scoop at the capital: ${near ? `${near.name} is within ${GAS_SCOOP_LY} ly` : 'no nebula near'}`);
  if (near) {
    const ctx = project(s).ctx;
    const without = colonyTurn(s, cap, ctx, 1e9).y.matter;
    cap.structures.gas_scoop = 1;
    const withIt = colonyTurn(s, cap, ctx, 1e9).y.matter;
    check(withIt > without, `it brings in matter (${without.toFixed(2)} → ${withIt.toFixed(2)})`);
  }
  const dusk = newGame({ seed: 1000, civsAsleep: true });
  dusk.civ.techs.push('interstellar_scooping');
  check(structureCheck(dusk, dusk.colonies[dusk.civ.capitalId!], d) === 'Not in this game.' && !techAvailable(newGame({ seed: 1000, civsAsleep: true }), 'interstellar_scooping'), 'and in a game begun in the Dusk neither exists');
}
// The Last Gas
{
  const s = copyState(base);
  s.flags.ir_born = 40;
  s.flags.ir_died = 30;
  s.years = 9e13;
  s.eta = Math.log10(9e13);
  const before = JSON.stringify(Object.values(s.colonies).map((c) => [c.id, c.pops]));
  const r = runCrossing(s, Object.keys(s.civs), Object.fromEntries(Object.keys(s.civs).map((id) => [id, computeMods(s)])))[s.player];
  check(r.title === 'The Last Gas' && r.popsBefore === r.popsAfter && r.coloniesBefore === r.coloniesAfter && JSON.stringify(Object.values(s.colonies).map((c) => [c.id, c.pops])) === before, 'The Last Gas destroys nothing');
  check(r.lines.some((l) => /30 stars we could see went out.*40 were born/.test(l.text)) && r.lines.some((l) => /We live in/.test(l.text)), `its report: ${r.lines.map((l) => l.text).join(' / ').slice(0, 160)}…`);
}

done('INTERREGNUM EVOLUTION');
