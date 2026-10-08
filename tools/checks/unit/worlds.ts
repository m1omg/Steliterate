// What a world's panel says agrees with its climate (display rules, live: they apply to games in
// progress too).
// - Nothing in the galaxy is colder than its glow: about 1 K from its red dwarfs in the Dusk, a
//   hundredth of a kelvin from the embers after the Last Light, the horizon's only once the halo
//   is spent. A world with no star sits at it, plus its own heat.
// - A black hole's accretion disk warms its worlds with the light it gives its collectors.
// - An airless world holds no liquid water: frost where its ground is below 110 K, else none.
// - A world locked to its star is named by where its water is: an eyeball (a sea facing the star,
//   ice beyond), a twilight sea (the day side dry, ice on the night side, sea between), a
//   terminator world (the same with life), a scorched world (a sea only on the night side).
import { newGame } from '../../../src/game/newGame';
import { BACKGROUND_DUSK_K, BACKGROUND_EMBERS_K, backgroundK, bodyClimate, decayWarmth, diskLight, lightUnitSuns, primaryLuminosity, primaryTemperature, waterState } from '../../../src/game/physics';
import { calendarEra } from '../../../src/game/fate';
import type { Body, BodyKind, GameState, StarSystem } from '../../../src/game/types';
import { bodyKindName } from '../../../src/ui/labels';
import { check, done } from '../lib';

const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' });
const free = (id: string) => !s.bodies[id].colonyId && s.bodies[id].kind !== 'deep';
const red = Object.values(s.systems).find((x) => x.special !== 'home' && x.primary.kind === 'red_dwarf' && x.bodies.some(free))!;
const proto = s.bodies[red.bodies.find(free)!];
const L = primaryLuminosity(red.primary, s.years, calendarEra(s), decayWarmth(s));
/** A world of this kind locked to the red dwarf where its light alone gives it a mean of k kelvin. */
const locked = (kind: BodyKind, k: number, vitality = 0, water = 0.4): Body => ({
  ...proto,
  kind,
  water,
  vitality,
  habitability: vitality > 0 ? 0.6 : 0.05,
  coreHeat: 0,
  rogue: false,
  dissolved: false,
  colonyId: null,
  traits: ['tidally_locked'],
  orbitAU: Math.pow((278 * Math.pow(L, 0.25) * Math.pow(0.7, 0.25)) / k, 2),
});
const show = (b: Body) => {
  const c = bodyClimate(s, b);
  return `${bodyKindName(s, b)}, ${Math.round(c.night ?? c.mean)}–${Math.round(c.day ?? c.mean)} K, water "${waterState(b, c)}"`;
};

// the galaxy's glow
{
  const starless = Object.values(s.systems).find((x) => x.primary.kind === 'rogue' && x.bodies.some(free)) as StarSystem | undefined;
  if (starless) {
    const b = s.bodies[starless.bodies.find(free)!];
    const c = bodyClimate(s, b);
    check(c.mean >= BACKGROUND_DUSK_K && c.mean < 30, `${b.name}, a world with no star, in the Dusk: ${c.mean.toFixed(2)} K (the galaxy's glow and its own heat), not the horizon's`);
  } else check(false, 'a starless system to look at');
  const cold = { ...proto, coreHeat: 0, rogue: true, traits: [] } as Body;
  check(Math.abs(bodyClimate(s, cold).mean - BACKGROUND_DUSK_K) < 0.01, `a rogue world with no heat of its own sits at the glow: ${bodyClimate(s, cold).mean.toFixed(3)} K`);
  check(backgroundK(1e15) === BACKGROUND_EMBERS_K && backgroundK(1e26) === 0, `after the Last Light ${BACKGROUND_EMBERS_K * 1000} mK from the embers, nothing once the halo is spent (η 25)`);
  const wd = Object.values(s.systems).find((x) => x.primary.kind === 'white_dwarf')!;
  check(primaryTemperature(wd.primary, 1e16, 'degenerate') >= BACKGROUND_EMBERS_K, `a dead star is never colder than the glow it sits in (${primaryTemperature(wd.primary, 1e16, 'degenerate').toExponential(2)} K at η 16)`);
}

// a black hole's disk warms its worlds as it feeds its collectors: well above the glow
{
  const bh = Object.values(s.systems).find((x) => x.primary.kind === 'black_hole' && x.bodies.some(free))!;
  const b = s.bodies[bh.bodies.find(free)!];
  const L = primaryLuminosity(bh.primary, s.years, calendarEra(s));
  const want = 278 * Math.pow(diskLight('black_hole', 'dusk', s.years) * lightUnitSuns('dusk'), 0.25) * Math.pow(0.7, 0.25) / Math.sqrt(b.orbitAU);
  const c = bodyClimate(s, b);
  check(Math.abs(L - 0.05 * 1.15e-3) < 1e-9 && c.mean >= want && c.mean > 4, `${b.name}, ${b.orbitAU.toFixed(1)} AU from a hole with a faint disk (${L.toExponential(2)} L☉): ${c.mean.toFixed(1)} K in the Dusk`);
  const late = { ...s, era: 'degenerate', years: 1e16 } as GameState;
  const c2 = bodyClimate(late, b);
  check(c2.mean > 3 * BACKGROUND_EMBERS_K, `and ${(c2.mean * 1000).toFixed(0)} mK at η 16, above the embers' glow`);
  const gone = { ...s, era: 'blackhole', years: 1e45 } as GameState;
  check(primaryLuminosity(bh.primary, gone.years, 'blackhole') === 0, 'no disk in the Black Hole Age, no light from it');
}

// airless ground
{
  const rock = locked('barren', 400, 0, 0.01);
  const c = bodyClimate(s, rock);
  const w = waterState(rock, c);
  check(!!c.airless && !/open|sea|terminator/.test(w) && /frost cold-trapped on the night side/.test(w), `bare rock, ${Math.round(c.night!)}–${Math.round(c.day!)} K: "${w}"`);
  const warm = { ...rock, traits: [] };
  check(/boiling off into space/.test(waterState(warm, bodyClimate(s, warm))), `bare rock warm all round: "${waterState(warm, bodyClimate(s, warm))}"`);
}

// names by where the water is, on a locked world
{
  const cases: [Body, string][] = [
    [locked('ice', 250), 'Eyeball sea'],
    [locked('ocean_ice', 250, 0.1, 0.97), 'Eyeball sea'],
    [locked('ice', 320), 'Twilight sea'],
    [locked('terran', 240, 0.3), 'Eyeball world'],
    [locked('terran', 290, 0.3), 'Terminator world'],
    [locked('ice', 150), 'Ice world'],
  ];
  for (const [b, want] of cases) check(bodyKindName(s, b) === want, `${b.kind}, ${show(b)}: want ${want}`);
  // with its night side thawed too, a living world keeps a sea only there: scorched
  const hot = { ...locked('terran', 600, 0.3), traits: ['tidally_locked'] };
  const c = bodyClimate(s, hot);
  if (c.night! >= 273 && c.night! < 373 && c.day! >= 373) check(bodyKindName(s, hot) === 'Scorched world', `terran, ${show(hot)}: want Scorched world`);
  else check(c.night! >= 373 && bodyKindName(s, hot) === 'Steam world', `terran, ${show(hot)}: want Steam world`);
}

done('WORLDS');
