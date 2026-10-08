// Curvature radiation keeps everything a little warm (the player's catch, 8 Oct). Under that fate,
// once known, space turns a body's mass into particles over its lifetime, and those made inside it
// warm it (Falcke, Wondrak & van Suijlekom 2025, JCAP 05, 023). One law, T ∝ (Mc²/τ ÷ 4πR²σ)^¼,
// scaled to their two figures (25 nK, 5.5 pK), with the game's own lifetimes: white dwarfs, brown
// dwarfs and worlds read far above the horizon's 2 × 10^-30 K. Under the other fates as before, and
// no rule reads it: what collectors gather is the same.
import { newGame } from '../../../src/game/newGame';
import { SKY_K, bodyClimate, curvatureK, curvatureWarmth, primaryTemperature, sourceLight } from '../../../src/game/physics';
import type { Body, GameState } from '../../../src/game/types';
import { check, done } from '../lib';

const SUN = 1.989e30;
const ns = curvatureK(1.44 * SUN, 12760, Math.log10(3.4e68));
const wd = curvatureK(1.3 * SUN, 2.55e6, Math.log10(3.3e78));
check(Math.abs(ns / 25e-9 - 1) < 0.02 && Math.abs(wd / 5.5e-12 - 1) < 0.02, `the law gives their figures: a neutron star ${(ns * 1e9).toFixed(1)} nK (25), a 1.3 M☉ white dwarf ${(wd * 1e12).toFixed(2)} pK (5.5)`);

/** A game in the Black Hole Age at η 78, under a fate. */
const late = (fate: 'curvature' | 'stable') => {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: fate }) as GameState;
  s.years = 1e78;
  s.era = 'blackhole';
  return s;
};
const c = late('curvature');
const st = late('stable');
check(curvatureWarmth(c) === 1 && curvatureWarmth(st) === 0, 'the glow counts under curvature radiation (known by the Black Hole Age), not under stable matter');
const temp = (s: GameState, kind: string, mass: number) => primaryTemperature({ kind, mass, lum: 0 } as never, s.years, 'blackhole', 0, curvatureWarmth(s));
const wd6 = temp(c, 'white_dwarf', 0.6);
const bd = temp(c, 'brown_dwarf', 0.05);
check(wd6 > 2e-13 && wd6 < 5e-13 && bd > 2e-15 && bd < 6e-15, `a 0.6 M☉ white dwarf ${(wd6 * 1e12).toFixed(2)} pK, a brown dwarf ${(bd * 1e15).toFixed(1)} fK`);
check(temp(st, 'white_dwarf', 0.6) < 3 * SKY_K && temp(st, 'brown_dwarf', 0.05) < 1e-18, `under stable matter as before: the white dwarf at the horizon’s temperature, the brown dwarf at ${temp(st, 'brown_dwarf', 0.05).toExponential(1)} K from its own slow cooling`);

// a world adrift, its core long cold
const world = (s: GameState): Body => {
  const b = Object.values(s.bodies).find((x) => x.kind === 'terran' || x.kind === 'barren')!;
  b.rogue = true;
  b.coreHeat = 0;
  return b;
};
const wc = bodyClimate(c, world(c)).mean;
const ws = bodyClimate(st, world(st)).mean;
check(wc > 5e-17 && wc < 1e-15 && ws < 3 * SKY_K, `a rogue world: ${wc.toExponential(1)} K under curvature radiation, ${ws.toExponential(1)} K (the horizon’s) under stable matter`);

// what collectors gather is the same under both fates
let differ = 0;
for (const sys of Object.values(c.systems)) {
  const o = st.systems[sys.id];
  if (sourceLight(c, sys, c.years, 1).light !== sourceLight(st, o, st.years, 1).light) differ++;
}
check(differ === 0, `the light collectors gather is the same at every star (${differ} differ)`);
done('CURVATURE');
