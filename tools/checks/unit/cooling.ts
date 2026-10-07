// Honest cooling: dead stars and worlds that nothing warms cool as K·t^-½ (millikelvins as the
// Degenerate Age opens), embers hold 63 K while the halo lasts, decay warmth shows only once we know
// protons decay, black holes read their Hawking temperature, nothing goes below the sky's
// 2.4 × 10^-30 K; collectors get nothing from a cold dwarf; the Dusk is as it was; the black-dwarf
// name keeps its date. Then a real game: no unwarmed white dwarf left after η 16.7, none after η 25.
import { DWARF_COLD_AT, SKY_K, bodyClimate, emberShare, primaryLuminosity, primaryTemperature, sourceLight } from '../../../src/game/physics';
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

// ---------------------------------------------------------------- temperatures
near('unwarmed white dwarf at η 15: 10^5 / √10^15 K (3.2 mK)', primaryTemperature(P({}), 1e15, 'degenerate'), 1e5 / Math.sqrt(1e15), 1e-6);
near('at η 20: 10 µK', primaryTemperature(P({}), 1e20, 'degenerate'), 1e-5, 1e-6);
near('a white dwarf that formed late is warmer for its age (η 15, formed 10^14.9)', primaryTemperature(P({ whiteAt: Math.pow(10, 14.9) }), 1e15, 'degenerate'), 1e5 / Math.sqrt(1e15 - Math.pow(10, 14.9)), 1e-6);
near('black dwarf at η 30', primaryTemperature(P({ kind: 'black_dwarf' }), 1e30, 'degenerate'), 1e-10, 1e-6);
near('an ember at η 20: 63 K', primaryTemperature(P({ halo: true }), 1e20, 'degenerate'), 63, 1e-9);
near('an ember at η 23.5, half its warmth (T ∝ power^¼)', primaryTemperature(P({ halo: true }), Math.pow(10, 23.5), 'degenerate'), 63 * Math.pow(0.5, 0.25), 1e-9);
near('a spent ember at η 25.1: residual heat', primaryTemperature(P({ halo: true }), Math.pow(10, 25.1), 'degenerate'), 1e5 / Math.sqrt(Math.pow(10, 25.1)), 1e-6);
near('a rekindled dwarf: 300 K', primaryTemperature(P({ rekindle: 0.5 }), 1e17, 'degenerate'), 300);
near('a neutron star in the halo: 900 K', primaryTemperature(P({ kind: 'neutron_star', mass: 1.4 }), 1e20, 'degenerate'), 900, 1e-9);
near('a neutron star at η 26: 7 × 10^6 / √10^26', primaryTemperature(P({ kind: 'neutron_star', mass: 1.4 }), 1e26, 'degenerate'), 7e6 / 1e13, 1e-6);
near('a brown dwarf in the halo: about 4 K', primaryTemperature(P({ kind: 'brown_dwarf', mass: 0.05 }), 1e20, 'degenerate'), 4, 1e-6);
near('a brown dwarf at η 26', primaryTemperature(P({ kind: 'brown_dwarf', mass: 0.05 }), 1e26, 'degenerate'), 3e4 / 1e13, 1e-6);
near('a black hole of 10 Suns: its Hawking temperature', primaryTemperature(P({ kind: 'black_hole', mass: 10 }), 1e45, 'blackhole'), 6.17e-9);
near('nothing below the sky: a black dwarf at η 80', primaryTemperature(P({ kind: 'black_dwarf' }), 1e80, 'blackhole'), SKY_K, 1e-6);
// decay warmth: shown only once we know
s.protonsDecay = true;
s.settings.protonFate = 'unknown';
s.civ.techs = s.civ.techs.filter((t) => t !== 'proton_question');
at(30);
const wd = sys(P({}));
const unknown = sourceLight(s, wd, s.years, 0).temperatureK;
near('protons decay, but we do not know it: the prediction (residual only)', unknown, 1e5 / 1e15, 1e-6);
s.civ.techs.push('proton_question');
near('once we know: about 0.05 K of decay warmth', sourceLight(s, wd, s.years, 0).temperatureK, 0.05, 1e-3);
at(38.25);
near('half the matter gone (η 38.25): the fourth root of half', sourceLight(s, wd, s.years, 0).temperatureK, 0.05 * Math.pow(0.5, 0.25), 1e-3);
s.protonsDecay = false;
at(30);
near('stable protons, known: no decay warmth', sourceLight(s, wd, s.years, 0).temperatureK, 1e5 / 1e15, 1e-6);

// ---------------------------------------------------------------- light for collectors
s.gfe = 1;
at(16);
check(sourceLight(s, wd, s.years, 0).light === 0, 'an unwarmed white dwarf gives collectors nothing (no floor)');
check(sourceLight(s, sys(P({ kind: 'black_dwarf' })), s.years, 0).light === 0, 'nor does a black dwarf');
near('unless a world falls in: its rekindled glow', sourceLight(s, sys(P({ rekindle: 0.4 })), s.years, 0).light, 0.4);
near('an ember at η 20: ×1.05', (at(20), sourceLight(s, sys(P({ halo: true })), s.years, 0).light), 1.05);
near('an ember at η 23.5: half of it', (at(23.5), sourceLight(s, sys(P({ halo: true })), s.years, 0).light), 0.525);
near('a brown dwarf while the halo lasts: ×0.02', (at(20), sourceLight(s, sys(P({ kind: 'brown_dwarf', mass: 0.05 })), s.years, 0).light), 0.02);
check((at(25.2), sourceLight(s, sys(P({ kind: 'brown_dwarf', mass: 0.05 })), s.years, 0).light) === 0, 'and nothing once the halo is spent');

// ---------------------------------------------------------------- the Dusk is as it was; the name keeps its date
const r = 0.0125;
for (const age of [0, 1e9, 1e12, 1e13]) {
  const p = P({ halo: true, whiteAt: 1e13 });
  const L = 0.01 * Math.pow(1 + age / 1e8, -1.3);
  near(`Dusk white dwarf at age ${age}`, primaryTemperature(p, 1e13 + age, 'dusk'), 5772 * Math.pow(L / (r * r), 0.25));
}
near('the black-dwarf name keeps its date (η 16.7)', DWARF_COLD_AT, 1e15 * Math.pow(4, 1 / 0.35));
near('a cold dwarf’s light (display) follows its temperature', primaryLuminosity(P({}), 1e16, 'degenerate'), Math.pow(primaryTemperature(P({}), 1e16, 'degenerate') / 5772, 4) * r * r);

// ---------------------------------------------------------------- worlds: no 1 K floor
const g = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
const world = Object.values(g.bodies).find((b) => b.kind === 'barren' && !b.colonyId)!;
g.era = 'degenerate';
g.years = 1e20;
world.rogue = true;
world.coreHeat = 0;
const cl = bodyClimate(g, world);
check(cl.mean < 1e-3 && cl.mean > 0, `a rogue world at η 20 with its core spent: ${cl.mean.toExponential(2)} K (no 1 K floor)`);

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
