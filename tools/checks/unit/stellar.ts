// Stars brightening as they age, black holes as they shrink, a star's lifetime shown, and a warning
// when a large Thread thinks poorly of us (1 Nov, the player; stellar.ts, physics.ts, forecast.ts):
// - a red dwarf's light at a game's start is as it was; it rises toward its blue flare, at most 3×,
//   its surface hotter, its worlds warmer, its light to collectors up by the square root;
// - a young star of the Twilight Interregnum begins as its class, brightens on the main sequence,
//   then swells into a red giant thousands of times brighter, its next change named so: the
//   worlds inside it are swallowed, those beyond warmed;
// - a black hole's Hawking temperature rises as it shrinks;
// - each star's next stage and when (starLife);
// - a Thread of a quarter of our people or more below 25 standing is forecast; a small one or an
//   absent one never is.
import { newGame } from '../../../src/game/newGame';
import { bodyClimate, evolveUniverse, nextStellarChange, primaryLuminosity, primaryTemperature, sourceLight } from '../../../src/game/physics';
import { GIANT, MS_RISE, RED_RISE_MAX, giantReach, hawkingK, redBrightening, redRise, youngLife, youngStage } from '../../../src/game/stellar';
import { YOUNG_CLASSES } from '../../../src/game/interregnum';
import { updateForecasts } from '../../../src/game/sim/forecast';
import { copyState } from '../../../src/game/save';
import { starLife } from '../../../src/ui/labels';
import type { Body, GameState } from '../../../src/game/types';
import { check, done } from '../lib';

const rand = () => 0.5;

// ---------------------------------------------------------------- red dwarfs (a game begun in the Dusk)
{
  const s = newGame({ seed: 1000, civsAsleep: true });
  const home = s.systems[s.civ.homeSystemId];
  const p = home.primary;
  const hw = home.bodies.map((id) => s.bodies[id]).find((b) => b.traits.includes('homeworld'))!;
  const L0 = primaryLuminosity(p, s.years, 'dusk');
  check(redBrightening(p, s.years) === 1 && Math.abs(L0 - 0.23 * Math.pow(p.mass, 2.3)) < 1e-15, `our red dwarf at the start: as it was (${L0.toExponential(3)} L☉)`);
  const mid = (s.years + p.blueAt!) / 2;
  const end = p.blueAt! - 1;
  const rise = redRise(p);
  check(rise > 1 && rise <= RED_RISE_MAX && Math.abs(redBrightening(p, end) - rise) < 1e-6 && redBrightening(p, mid) > 1 && redBrightening(p, mid) < redBrightening(p, end), `it brightens toward its flare: ×${redBrightening(p, mid).toFixed(2)} halfway, ×${rise.toFixed(2)} at it (at most ${RED_RISE_MAX})`);
  const T0 = primaryTemperature(p, s.years, 'dusk');
  const T1 = primaryTemperature(p, end, 'dusk');
  check(T1 > T0 * 1.05, `and hotter: ${Math.round(T0)} K → ${Math.round(T1)} K`);
  const c0 = bodyClimate(s, hw).mean;
  const later = copyState(s);
  later.years = end;
  const c1 = bodyClimate(later, later.bodies[hw.id]).mean;
  check(c1 > c0 + 5, `our world warms with it: ${c0.toFixed(0)} K → ${c1.toFixed(0)} K (as the fourth root of its light)`);
  const l0 = sourceLight(s, home, s.years, 0).light;
  const l1 = sourceLight(later, later.systems[home.id], end, 0).light;
  check(Math.abs(l1 / l0 - Math.sqrt(rise)) < 0.02 && /brightening toward its blue flare/.test(sourceLight(later, later.systems[home.id], end, 0).label), `its light to collectors rises by the square root (×${(l1 / l0).toFixed(2)}), and says so`);
}

// ---------------------------------------------------------------- young stars (the Twilight Interregnum)
const base = newGame({ seed: 1000, interregnum: true, civsAsleep: true });
{
  const s = copyState(base);
  const sys = Object.values(s.systems).find((x) => x.primary.kind === 'young_star' && x.primary.cls === 'G' && x.bodies.some((id) => s.bodies[id]?.kind !== 'deep')) ?? Object.values(s.systems).find((x) => x.primary.kind === 'young_star' && x.primary.cls !== 'B' && x.bodies.length > 1)!;
  const p = sys.primary;
  const cls = p.cls ?? 'G';
  const c = YOUNG_CLASSES[cls];
  const { msEnd, dies } = youngLife(p);
  const born = p.bornAt ?? s.years;
  check(Math.abs(youngStage(p, Math.max(born, s.years)).L - c.suns) < 1e-12 && Math.abs(primaryTemperature(p, s.years, 'interregnum') - c.k) < 1e-6, `${sys.name}, a young ${cls} star: at the start (or its birth) its class's ${c.suns} L☉ at ${c.k} K, as before`);
  const atEnd = youngStage(p, msEnd - 1);
  check(atEnd.giant === 0 && atEnd.L > c.suns && atEnd.L <= c.suns * MS_RISE + 1e-9, `brighter by the end of its main sequence: ${atEnd.L.toFixed(2)} L☉`);
  check(nextStellarChange(sys, Math.max(born, s.years))?.what.includes('red giant') === true && nextStellarChange(sys, msEnd + 1)?.what.includes('white dwarf') === true, 'its next change: the red giant, then the white dwarf');
  const late = youngStage(p, dies - (dies - msEnd) * 0.01);
  check(late.giant > 0.9 && late.L > c.suns * 100 && late.T < c.k && late.rAU > 0.3, `a red giant near its end: ${Math.round(late.L)} L☉ at ${Math.round(late.T)} K, ${late.rAU.toFixed(2)} AU across (its tip ${GIANT[cls].tip} L☉)`);
  // the worlds inside it swallowed, those beyond warmed
  const reach = giantReach(p, dies);
  const worlds = sys.bodies.map((id) => s.bodies[id]).filter((b): b is Body => !!b && b.kind !== 'deep' && !b.dissolved);
  // (bring one world inside its reach and keep one beyond, for the check)
  const inner = worlds[0];
  inner.orbitAU = reach * 0.5;
  const outer = worlds.find((b) => b !== inner) ?? null;
  if (outer) outer.orbitAU = Math.max(outer.orbitAU, reach * 3);
  const warmBefore = outer ? bodyClimate(s, outer).mean : 0;
  const mid = copyState(s);
  mid.years = dies - (dies - msEnd) * 0.05;
  const warmGiant = outer ? bodyClimate(mid, mid.bodies[outer.id]).mean : 0;
  const notes = evolveUniverse(s, Math.max(s.years, msEnd), dies - 1, rand);
  check(inner.dissolved === true && notes.some((n) => n.kind === 'boiled' && n.bodyId === inner.id && n.swallowed), `a world at ${inner.orbitAU.toFixed(2)} AU, inside its reach (${reach.toFixed(2)} AU), is swallowed`);
  if (outer) check(!outer.dissolved && warmGiant > warmBefore + 20, `one beyond it lasts, warmed: ${warmBefore.toFixed(0)} K → ${warmGiant.toFixed(0)} K`);
  check(starLife(mid, mid.systems[sys.id])?.now === 'red giant' && starLife(copyState(base), base.systems[sys.id])?.next === 'red giant', `its lifetime shown: "${starLife(copyState(base), base.systems[sys.id])?.now}", then "${starLife(copyState(base), base.systems[sys.id])?.next}"`);
}

// ---------------------------------------------------------------- black holes
{
  const s = newGame({ seed: 1000, civsAsleep: true });
  const hole = Object.values(s.systems).find((x) => x.primary.kind === 'black_hole' && x.primary.evaporateAt)!;
  const p = hole.primary;
  const t0 = hawkingK(p, 0);
  const t9 = hawkingK(p, p.evaporateAt! * 0.999);
  check(Math.abs(t0 - 6.17e-8 / p.mass) < 1e-20 && Math.abs(t9 / t0 - 10) < 0.01 && primaryTemperature(p, p.evaporateAt! * 0.999, 'blackhole') === t9, `${hole.name}: its Hawking temperature rises as it shrinks, ${t0.toExponential(2)} K → ${t9.toExponential(2)} K by 99.9% of its life (×10, as 1/M)`);
  check(starLife(s, hole)?.next === 'final burst', 'and its lifetime: its final burst');
}

// ---------------------------------------------------------------- the standing warning
{
  const s = newGame({ seed: 1000, civsAsleep: true });
  const cap = s.colonies[s.civ.capitalId!];
  const warned = (g: GameState) => {
    updateForecasts(g);
    return g.civ.forecasts.filter((f) => f.kind === 'fork').map((f) => f.title);
  };
  // the Kin: most of our people
  s.civ.standing.kin = 20;
  check(warned(s).some((t) => /Kin think poorly of us/.test(t)), `the Kin, ${cap.pops.kin} of our people, at 20 standing: warned (${warned(s).join('; ')})`);
  s.civ.lowStanding.kin = 1;
  check(warned(s).some((t) => /Kin are talking of leaving/.test(t)), 'talking of leaving: warned, with the turns left');
  s.civ.standing.kin = 60;
  s.civ.lowStanding.kin = 0;
  check(warned(s).length === 0, 'at 60: no warning');
  // a small Thread: Echoes under a quarter of our people
  cap.pops.echoes = Math.max(1, Math.floor(cap.pops.kin / 4) - 1);
  s.civ.standing.echoes = 5;
  check(!warned(s).some((t) => /Echoes/.test(t)), `Echoes, ${cap.pops.echoes} of ${cap.pops.kin + cap.pops.echoes}, at 5 standing: under a quarter, no warning`);
  cap.pops.echoes = cap.pops.kin;
  check(warned(s).some((t) => /Echoes/.test(t)), 'half of our people: warned');
  // an absent one: no one awake
  cap.pops.echoes = 0;
  check(!warned(s).some((t) => /Echoes/.test(t)), 'none of them awake: no warning');
}

done('STELLAR');
