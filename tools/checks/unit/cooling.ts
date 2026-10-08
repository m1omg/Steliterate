// Honest cooling, one law per kind in every age, so nothing jumps at the Last Light:
// - a white dwarf by Mestel's law until its core crystallises (5 × 10^11 years), then fading as
//   t^-0.58 (about 50 K as the Dusk ends, 13 K at η 15, a hundredth of a kelvin at η 20), each from
//   its own age (a red dwarf's remnant from its collapse, no hotter than its flare's peak);
// - a brown dwarf by Burrows et al.'s fit, 1,550 K × (t / Gyr)^-0.32 × (M / 0.05 M☉)^0.83, each from
//   its own age (420 K at 59 billion years for 0.05 M☉);
// - dark matter warms them from the Dusk on while the halo lasts (embers 63 K, brown dwarfs 4 K,
//   neutron stars 900 K, no longer 30,000 K in the Dusk); a feeding world warms a dwarf to 50 to 110 K;
// - worlds that nothing warms cool as K·t^-½; decay warmth shows only once we know protons decay;
//   black holes read their Hawking temperature; a dead star shows no colder than the embers' glow it
//   sits in (10 mK while the halo lasts); nothing goes below the sky's 2.2 × 10^-30 K;
// - collectors get nothing from a cold white dwarf; a brown dwarf gives all its own light, an
//   ember's worth or more at the Last Light, next to nothing in the Dusk; the black-dwarf name
//   keeps its date. Then a real game: no unwarmed white dwarf left after η 16.7, none after η 25.
import { BACKGROUND_EMBERS_K, DWARF_COLD_AT, SKY_K, bodyClimate, brownCoolingK, dwarfCoolingK, emberShare, formedAt, ownTemperature, primaryLuminosity, primaryTemperature, sourceLight } from '../../../src/game/physics';
import { flarePeak } from '../../../src/game/gen';
import { newGame } from '../../../src/game/newGame';
import { autoPlay } from '../../../src/game/auto';
import { endTurn } from '../../../src/game/sim/turn';
import type { Primary, StarSystem } from '../../../src/game/types';
import { check, done, near } from '../lib';

const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
const at = (eta: number, era: 'degenerate' | 'blackhole' = 'degenerate') => {
  s.era = era;
  s.years = Math.pow(10, eta);
  s.eta = eta;
};
const P = (x: Partial<Primary>): Primary => ({ kind: 'white_dwarf', mass: 0.6, lum: 0.02, spin: 0, spinMax: 0, ...x }) as Primary;
const sys = (p: Primary) => ({ id: 'x', primary: p, bodies: [] }) as unknown as StarSystem;
const r = 0.0125;
// the white dwarf's law, written out again
const mestel = (t: number) => 5772 * Math.pow((0.01 * Math.pow(1 + t / 1e8, -1.3)) / (r * r), 0.25);
const wdLaw = (age: number) => (age <= 5e11 ? mestel(age) : mestel(5e11) * Math.pow(age / 5e11, -0.58));
const w4 = (...xs: number[]) => Math.pow(xs.reduce((a, x) => a + x ** 4, SKY_K ** 4), 0.25);

// ---------------------------------------------------------------- white dwarfs
const formed = 1e10;
near('a white dwarf at 10 billion years: Mestel, about 4,000 K as the coolest we see', ownTemperature(P({ whiteAt: 0 }), 1e10, 'dusk'), mestel(1e10), 1e-9);
check(ownTemperature(P({ whiteAt: 0 }), 1e10, 'dusk') > 3000 && ownTemperature(P({ whiteAt: 0 }), 1e10, 'dusk') < 4500, `(${Math.round(ownTemperature(P({ whiteAt: 0 }), 1e10, 'dusk'))} K)`);
near('crystallised, it fades as t^-0.58: at the Last Light', ownTemperature(P({ whiteAt: formed }), 1e14, 'degenerate'), wdLaw(1e14 - formed), 1e-9);
check(Math.abs(dwarfCoolingK(P({}), 5e11 * (1 - 1e-9)) - dwarfCoolingK(P({}), 5e11 * (1 + 1e-9))) < 1e-3, 'the law is continuous where the core crystallises');
const dusk = primaryTemperature(P({ whiteAt: formed }), 1e14 * (1 - 1e-9), 'dusk');
const after = primaryTemperature(P({ whiteAt: formed }), 1e14 * (1 + 1e-9), 'degenerate');
check(Math.abs(dusk - after) / after < 0.01 && after > 30 && after < 80, `no jump at the Last Light: ${dusk.toFixed(1)} K in the Dusk's last moment, ${after.toFixed(1)} K after`);
near('an unwarmed white dwarf at η 15', ownTemperature(P({ whiteAt: formed }), 1e15, 'degenerate'), wdLaw(1e15 - formed), 1e-9);
near('at η 20, about a hundredth of a kelvin', ownTemperature(P({ whiteAt: formed }), 1e20, 'degenerate'), wdLaw(1e20 - formed), 1e-9);
check(ownTemperature(P({ whiteAt: Math.pow(10, 14.9) }), 1e15, 'degenerate') > ownTemperature(P({ whiteAt: formed }), 1e15, 'degenerate'), 'a white dwarf that formed late is warmer for its age');
const own = P({});
near('one the galaxy began with goes by an age of its own (formedAt, from its mass: no random draw)', ownTemperature(own, 1e15, 'degenerate'), wdLaw(1e15 - formedAt(own)), 1e-9);
check(formedAt(own) >= 1e9 && formedAt(own) <= 9e13 && formedAt(own) === formedAt(P({})), `(formed at ${formedAt(own).toExponential(2)} years, the same every time)`);
// in the embers' glow
check(primaryTemperature(P({ whiteAt: formed }), 1e20, 'degenerate') >= BACKGROUND_EMBERS_K, 'a dead star shows no colder than the embers’ glow it sits in');
near('black dwarf at η 30', primaryTemperature(P({ kind: 'black_dwarf', whiteAt: formed }), 1e30, 'degenerate'), w4(wdLaw(1e30 - formed)), 1e-9);
near('an ember at η 20: 63 K', primaryTemperature(P({ halo: true, whiteAt: formed }), 1e20, 'degenerate'), w4(63, wdLaw(1e20 - formed), BACKGROUND_EMBERS_K), 1e-9);
near('an ember at η 23.5, half its warmth (T ∝ power^¼)', primaryTemperature(P({ halo: true, whiteAt: formed }), Math.pow(10, 23.5), 'degenerate'), 63 * Math.pow(0.5, 0.25), 1e-6);
near('a spent ember at η 25.1: its own cooling', primaryTemperature(P({ halo: true, whiteAt: formed }), Math.pow(10, 25.1), 'degenerate'), w4(wdLaw(Math.pow(10, 25.1) - formed)), 1e-9);
near('an ember already in the Dusk (dark matter warms it from η 11)', primaryTemperature(P({ halo: true, whiteAt: formed }), 9e13, 'dusk'), w4(63, wdLaw(9e13 - formed), 1), 1e-9);
const rek = primaryTemperature(P({ rekindle: 0.5, whiteAt: formed }), 1e17, 'degenerate');
check(rek > 50 && rek < 110, `a dwarf a world is falling into: ${rek.toFixed(0)} K (50 to 110 K, as the Codex says), not 300 K`);
// a red dwarf's remnant
const fresh = P({ mass: 0.1, blueAt: 1e13, whiteAt: 1e13 + 4e9, ...flarePeak(0.1) });
check(primaryTemperature(fresh, 1e13 + 4e9, 'dusk') <= 5800 + 1, `a red dwarf's remnant, just collapsed: ${Math.round(primaryTemperature(fresh, 1e13 + 4e9, 'dusk'))} K, no hotter than its flare's peak`);
check(primaryTemperature({ ...fresh, blueK: undefined }, 1e13 + 4e9, 'dusk') <= 8200 + 1, 'an older game’s, no hotter than its 8,200 K flare');

// ---------------------------------------------------------------- a red dwarf's last flare
const f = flarePeak(0.1);
check(Math.abs(f.blueK - 5800) < 1 && Math.abs(f.blueLum - 0.0101) < 0.0005, `a new galaxy's 0.10 M☉ star peaks at ${Math.round(f.blueK)} K and ${f.blueLum.toFixed(4)} L☉ (about 1% of the Sun)`);
check(flarePeak(0.14).blueK === 8600 && flarePeak(0.16).blueLum > 0.25 && flarePeak(0.16).blueLum < 0.28, `8,600 K at 0.14 M☉; swollen to ${flarePeak(0.16).blueLum.toFixed(3)} L☉ at 0.16`);
const blue = P({ kind: 'blue_dwarf', mass: 0.1, ...flarePeak(0.1) });
const oldBlue = P({ kind: 'blue_dwarf', mass: 0.1 });
check(primaryTemperature(blue, 9e13, 'dusk') < 5900 && Math.abs(primaryLuminosity(blue, 9e13, 'dusk') - f.blueLum) < 1e-12, 'its flare reads so');
check(Math.abs(ownTemperature(oldBlue, 9e13, 'dusk') - 8200) < 1e-9 && primaryLuminosity(oldBlue, 9e13, 'dusk') === 0.2, 'a star from an older game keeps its 8,200 K and 0.2 L☉');

// ---------------------------------------------------------------- brown dwarfs and neutron stars
const bd = P({ kind: 'brown_dwarf', mass: 0.05 });
near('Burrows et al.: a 0.05 M☉ brown dwarf at 1 billion years, 1,550 K', brownCoolingK(bd, 1e9), 1550, 1e-12);
near('and 420 K at 59 billion years', brownCoolingK(bd, 59e9), 1550 * Math.pow(59, -0.32), 1e-12);
check(Math.abs(brownCoolingK(bd, 59e9) - 420) < 2, `(${brownCoolingK(bd, 59e9).toFixed(1)} K)`);
near('one the galaxy began with, in the Dusk, by its own age', ownTemperature(bd, 9e13, 'dusk'), w4(brownCoolingK(bd, 9e13 - formedAt(bd)), 4), 1e-9);
near('a brown dwarf in the halo at η 20: about 4 K', primaryTemperature(bd, 1e20, 'degenerate'), w4(brownCoolingK(bd, 1e20 - formedAt(bd)), 4, BACKGROUND_EMBERS_K), 1e-9);
near('a brown dwarf at η 26: its own cooling', primaryTemperature(bd, 1e26, 'degenerate'), w4(brownCoolingK(bd, 1e26 - formedAt(bd))), 1e-9);
near('a neutron star in the halo: 900 K', primaryTemperature(P({ kind: 'neutron_star', mass: 1.4 }), 1e20, 'degenerate'), 900, 1e-9);
near('in the Dusk too (no longer 30,000 K)', primaryTemperature(P({ kind: 'neutron_star', mass: 1.4 }), 9e13, 'dusk'), 900, 1e-6);
near('a neutron star at η 26: 7 × 10^6 / √10^26', primaryTemperature(P({ kind: 'neutron_star', mass: 1.4 }), 1e26, 'degenerate'), 7e6 / 1e13, 1e-6);
near('a black hole of 10 Suns: its Hawking temperature', primaryTemperature(P({ kind: 'black_hole', mass: 10 }), 1e45, 'blackhole'), 6.17e-9);
near('nothing below the sky: a black dwarf at η 80', primaryTemperature(P({ kind: 'black_dwarf' }), 1e80, 'blackhole'), SKY_K, 1e-6);
const horizon = (1.0546e-34 * (56e3 / 3.0857e22)) / (2 * Math.PI * 1.380649e-23);
check(Math.abs(SKY_K / horizon - 1) < 0.01, `the sky: the horizon of a universe at 56 km/s/Mpc, ħH/2πk = ${horizon.toPrecision(3)} K`);

// decay warmth: shown only once we know
s.protonsDecay = true;
s.settings.protonFate = 'unknown';
s.civ.techs = s.civ.techs.filter((t) => t !== 'proton_question');
at(30);
const wd = sys(P({ whiteAt: formed }));
const unknown = sourceLight(s, wd, s.years, 0).temperatureK;
near('protons decay, but we do not know it: the prediction (its own cooling only)', unknown, w4(wdLaw(1e30 - formed)), 1e-6);
s.civ.techs.push('proton_question');
near('once we know: about 0.05 K of decay warmth', sourceLight(s, wd, s.years, 0).temperatureK, 0.05, 1e-3);
at(38.25);
near('half the matter gone (η 38.25): the fourth root of half', sourceLight(s, wd, s.years, 0).temperatureK, 0.05 * Math.pow(0.5, 0.25), 1e-3);
s.protonsDecay = false;
at(30);
near('stable protons, known: no decay warmth', sourceLight(s, wd, s.years, 0).temperatureK, w4(wdLaw(1e30 - formed)), 1e-6);

// ---------------------------------------------------------------- light for collectors
s.gfe = 1;
at(16);
check(sourceLight(s, wd, s.years, 0).light === 0, 'an unwarmed white dwarf gives collectors nothing (no floor)');
check(sourceLight(s, sys(P({ kind: 'black_dwarf' })), s.years, 0).light === 0, 'nor does a black dwarf');
near('unless a world falls in: its rekindled glow', sourceLight(s, sys(P({ rekindle: 0.4 })), s.years, 0).light, 0.4);
near('an ember at η 20: ×1.05', (at(20), sourceLight(s, sys(P({ halo: true })), s.years, 0).light), 1.05);
near('an ember at η 23.5: half of it', (at(23.5), sourceLight(s, sys(P({ halo: true })), s.years, 0).light), 0.525);
const bdLight = (eta: number, era: 'dusk' | 'degenerate') => {
  s.era = era;
  s.years = Math.pow(10, eta);
  s.eta = eta;
  return sourceLight(s, sys(bd), s.years, 0).light;
};
const lastLight = bdLight(14.0001, 'degenerate');
check(lastLight > 1, `a brown dwarf at the Last Light gives all its own light: worth ${lastLight.toFixed(1)} embers`);
near('all of it: 1.05 × its light / an ember’s', lastLight, (1.05 * primaryLuminosity(bd, s.years, 'degenerate')) / 4e-12, 1e-9);
check(bdLight(15, 'degenerate') < lastLight && bdLight(20, 'degenerate') < 0.001, `fading as it cools: ${bdLight(15, 'degenerate').toFixed(2)} at η 15, ${bdLight(20, 'degenerate').toExponential(1)} at η 20`);
check(bdLight(13.98, 'dusk') < 1e-6, `next to nothing beside a red dwarf in the Dusk (${bdLight(13.98, 'dusk').toExponential(1)})`);
check(primaryTemperature(bd, Math.pow(10, 13.98), 'dusk') < 100, `(a middling brown dwarf the galaxy began with: ${primaryTemperature(bd, Math.pow(10, 13.98), 'dusk').toFixed(0)} K in the Dusk)`);

// ---------------------------------------------------------------- the name keeps its date; light follows warmth
near('the black-dwarf name keeps its date (η 16.7)', DWARF_COLD_AT, 1e15 * Math.pow(4, 1 / 0.35));
near('a cold dwarf’s light (display) follows its temperature', primaryLuminosity(P({}), 1e16, 'degenerate'), Math.pow(ownTemperature(P({}), 1e16, 'degenerate') / 5772, 4) * r * r);

// ---------------------------------------------------------------- worlds: no 1 K floor
const g = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
const world = Object.values(g.bodies).find((b) => b.kind === 'barren' && !b.colonyId)!;
g.era = 'degenerate';
g.years = 1e20;
world.rogue = true;
world.coreHeat = 0;
const cl = bodyClimate(g, world);
check(Math.abs(cl.mean - BACKGROUND_EMBERS_K) < 1e-6, `a rogue world at η 20 with its core spent: ${cl.mean.toExponential(2)} K, the embers’ glow (no 1 K floor)`);

// ---------------------------------------------------------------- a real game
let checked = 0;
for (const seed of [1000, 8919]) {
  const game = newGame({ seed, length: 'standard', survivors: 3, difficulty: 'standard' });
  for (let guard = 0; guard < 700 && !game.outcome && game.eta < 26; guard++) {
    autoPlay(game, 'competent');
    endTurn(game);
    if (game.era !== 'degenerate') continue;
    const wds = Object.values(game.systems).filter((x) => !x.gone && x.primary.kind === 'white_dwarf');
    const unwarmed = wds.filter((x) => emberShare(x.primary, game.years) === 0);
    if (game.years >= DWARF_COLD_AT && unwarmed.length) check(false, `seed ${seed} turn ${game.turn} η ${game.eta.toFixed(2)}: ${unwarmed.length} unwarmed white dwarfs left`);
    if (game.eta >= 25 && wds.length) check(false, `seed ${seed} η ${game.eta.toFixed(2)}: ${wds.length} white dwarfs left after the embers`);
    checked++;
  }
}
check(checked > 50, `${checked} Degenerate turns checked: every white dwarf turns black on time`);
done('COOL');
