import { ERA_BY_ID, INTERREGNUM } from './eras';
import { YOUNG_CLASSES } from './interregnum';
import type { Primary, StarClass } from './types';

// Stars brightening as they age, and black holes as they shrink (1 Nov, the player: "Both stars and
// black holes should brighten during their evolution. Red dwarfs towards blue dwarfs, and in the
// interregnum, the higher mass stars should also behave according to physics … brightening red
// giants … this should increase their energy yields but also, of course, habitability"; asked,
// a red giant swallows the worlds inside it, and the stars brighten "according to theory").
//
// - A red dwarf brightens on the main sequence toward its blue flare: the smallest grow several
//   times brighter and hotter before they turn blue (Laughlin, Bodenheimer & Adams 1997, ApJ 482,
//   420). Here: from each game's start (or the star's birth, if the game saw it born) its light
//   rises as the square of the time gone toward the flare, to the geometric middle of its
//   main-sequence light and its flare's peak, at most 3×. Counting from the game's start keeps
//   every game's beginning as it was (a bend: the star was already brightening before).
// - A young star of the Twilight Interregnum (K to B) brightens on the main sequence, 2.5 times
//   from birth to its end (the Sun: about 0.7 to 1.8 L☉), then swells: a subgiant cooling at
//   nearly the same light, then a red giant rising to its tip, a few thousand Suns at 3,400 K
//   (the Sun's tip: about 2,500 L☉ and 170 R☉, some 0.8 AU), in its last tenth or so of its life;
//   a blue giant swells into a red supergiant before it explodes. A simplification: the helium
//   flash's dip, the horizontal branch and the asymptotic giant branch are folded into one rise.
//   Worlds inside the giant's radius are swallowed (physics.ts).
// - A black hole's Hawking temperature rises as its mass falls (T ∝ 1/M), its mass going as
//   (1 − t/t_evap)^⅓; it glows visibly only in about the last 10⁻³³ of its life: in the game, the
//   turn of its final burst.
//
// Pure functions of a primary and the year: nothing stored, no random draw (saves and seeds as
// they were).

const DUSK_START = ERA_BY_ID.dusk.startYears;
const INTERREGNUM_START = INTERREGNUM.startYears;
/** Solar radii in an astronomical unit. */
const RSUN_PER_AU = 215.03;
/** A red dwarf brightens at most this much before its blue flare. */
export const RED_RISE_MAX = 3;
/** A young star is this much brighter at the end of its main sequence than at its birth. */
export const MS_RISE = 2.5;
/** Light to collectors goes as luminosity to this power for a red dwarf (as its blue flare's ×3 does for about ×9 the light). */
const RED_LIGHT_POWER = 0.5;
/** And for a young star, compressed as the young stars' classes are (light ∝ L^0.25 between them). */
const YOUNG_LIGHT_POWER = 0.25;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** The mean of f over [a, b], by the midpoints of `n` slices (deterministic). */
function meanOver(f: (t: number) => number, a: number, b: number, n = 16): number {
  if (!(b > a)) return f(a);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += f(a + ((i + 0.5) / n) * (b - a));
  return sum / n;
}

// ------------------------------------------------------------ red dwarfs

/** A red dwarf's main-sequence luminosity (Suns), as physics.ts has it: 0.23 M^2.3. */
const redSuns = (m: number) => 0.23 * Math.pow(Math.max(0.01, m), 2.3);

/** How much brighter a red dwarf grows before its blue flare: the geometric middle of its main-sequence light and its flare's peak, at most 3×. */
export function redRise(p: Primary): number {
  const m = Math.max(0.08, p.mass);
  const peak = p.blueLum ?? Math.min(0.4, 2 * m);
  return Math.max(1, Math.min(RED_RISE_MAX, Math.sqrt(peak / redSuns(m))));
}

/** When a red dwarf's brightening counts from: its birth if the game saw it born (a nebula's), else the start of the game it is in. */
function redFrom(p: Primary): number {
  if (p.bornAt !== undefined) return p.bornAt;
  // (one that leaves the main sequence before the Dusk can only be in a game begun in the Interregnum)
  return (p.blueAt ?? Infinity) <= DUSK_START ? INTERREGNUM_START : DUSK_START;
}

/** How far through its brightening a red dwarf is (0 at its start, 1 at its blue flare). */
export function redProgress(p: Primary, years: number): number {
  if (p.kind !== 'red_dwarf' || p.blueAt === undefined) return 0;
  const t0 = redFrom(p);
  const span = p.blueAt - t0;
  return span > 0 ? clamp01((years - t0) / span) : 0;
}

/** A red dwarf's luminosity now, as a multiple of its main-sequence luminosity (1 at the game's start). */
export function redBrightening(p: Primary, years: number): number {
  const u = redProgress(p, years);
  return u > 0 ? 1 + (redRise(p) - 1) * u * u : 1;
}

/** Its light to collectors over a turn [a, b], as a multiple of its light at the start. */
export function redLightOver(p: Primary, a: number, b: number): number {
  if (p.kind !== 'red_dwarf' || p.blueAt === undefined) return 1;
  return meanOver((t) => Math.pow(redBrightening(p, t), RED_LIGHT_POWER), a, Math.min(b, p.blueAt));
}

// ------------------------------------------------------------ young stars (the Twilight Interregnum)

/** Their giant phases: what share of a young star's life they take, the light at their tip (Suns), and their coolest surface (K). */
export const GIANT: Record<StarClass, { share: number; tip: number; k: number; name: string }> = {
  K: { share: 0.1, tip: 1500, k: 3700, name: 'Red giant' },
  G: { share: 0.12, tip: 2500, k: 3400, name: 'Red giant' },
  F: { share: 0.12, tip: 2600, k: 3500, name: 'Red giant' },
  A: { share: 0.14, tip: 3000, k: 3600, name: 'Red giant' },
  // a red supergiant: its light only a few times its blue youth's, its radius hundreds of Suns
  B: { share: 0.1, tip: 12000, k: 3600, name: 'Red supergiant' },
};

/** Where a young star is in its life: its birth, the end of its main sequence, its death (years). */
export function youngLife(p: Primary): { born: number; msEnd: number; dies: number; from: number } {
  const c = YOUNG_CLASSES[p.cls ?? 'G'];
  const dies = p.diesAt ?? Infinity;
  // one the galaxy began with: its life by its class (it is partway through it at the start)
  const life = p.bornAt !== undefined && isFinite(dies) ? dies - p.bornAt : Math.sqrt(c.life[0] * c.life[1]);
  const born = dies - life;
  const from = p.bornAt ?? INTERREGNUM_START;
  // (one already in its giant share at the game's start begins to swell then: every game begins as before)
  return { born, msEnd: Math.max(dies - GIANT[p.cls ?? 'G'].share * life, from), dies, from };
}

export interface YoungStage {
  /** Luminosity (Suns), surface temperature (K) and radius (AU). */
  L: number;
  T: number;
  rAU: number;
  /** Swelling into a giant: how far (0 on the main sequence, 1 at its death). */
  giant: number;
}

/** A young star's luminosity, temperature and radius at `years` (as it was at the game's start, or its birth, its class's own). */
export function youngStage(p: Primary, years: number): YoungStage {
  const cls = p.cls ?? 'G';
  const c = YOUNG_CLASSES[cls];
  const g = GIANT[cls];
  const { born, msEnd, dies, from } = youngLife(p);
  const phi = (t: number) => clamp01((t - born) / (msEnd - born));
  // (normalised so its light at the game's start, or at its birth, is its class's: every game begins as before)
  const norm = 1 + (MS_RISE - 1) * phi(from);
  const msL = (t: number) => (c.suns * (1 + (MS_RISE - 1) * phi(t))) / norm;
  const radius = (L: number, T: number) => Math.sqrt(L) / Math.pow(T / 5772, 2) / RSUN_PER_AU;
  if (years < msEnd || !isFinite(dies)) {
    const L = msL(years);
    return { L, T: c.k, rAU: radius(L, c.k), giant: 0 };
  }
  const v = clamp01((years - msEnd) / (dies - msEnd));
  const L0 = msL(msEnd);
  // a subgiant cools at nearly its light, then the red giant climbs to its tip
  const L = L0 * Math.pow(g.tip / L0, v * v);
  const T = c.k * Math.pow(g.k / c.k, Math.min(1, v * 2.5));
  return { L, T, rAU: radius(L, T), giant: v };
}

/** Its light to collectors over [a, b] (where it shines), as a multiple of its class's light. */
export function youngLightOver(p: Primary, a: number, b: number): number {
  const c = YOUNG_CLASSES[p.cls ?? 'G'];
  const { msEnd, dies } = youngLife(p);
  const hi = Math.min(b, dies);
  if (!(hi > a)) return Math.pow(youngStage(p, a).L / c.suns, YOUNG_LIGHT_POWER);
  const f = (t: number) => Math.pow(youngStage(p, t).L / c.suns, YOUNG_LIGHT_POWER);
  // (its main sequence and its giant phase each averaged on their own: a long turn's few samples would miss a short giant)
  const cut = Math.min(Math.max(msEnd, a), hi);
  const ms = cut > a ? meanOver(f, a, cut, 8) * (cut - a) : 0;
  const gi = hi > cut ? meanOver(f, cut, hi, 24) * (hi - cut) : 0;
  return (ms + gi) / (hi - a);
}

/** The largest a young star's giant swells by `years` (AU): 0 while it is on the main sequence. */
export function giantReach(p: Primary, years: number): number {
  if (p.kind !== 'young_star') return 0;
  const { msEnd, dies } = youngLife(p);
  if (years <= msEnd) return 0;
  // (it grows all the way to its death)
  return youngStage(p, Math.min(years, dies)).rAU;
}

/** When a young star leaves the main sequence (years). */
export function youngGiantAt(p: Primary): number {
  return youngLife(p).msEnd;
}

// ------------------------------------------------------------ black holes

/** A black hole's mass now (Suns): its mass at its making falls as (1 − t/t_evap)^⅓. */
export function holeMassNow(p: Primary, years: number): number {
  if (!p.evaporateAt || !(p.evaporateAt > 0)) return p.mass;
  const left = 1 - years / p.evaporateAt;
  return left > 0 ? p.mass * Math.cbrt(left) : 0;
}

/** Its Hawking temperature now (K): 6.17 × 10⁻⁸ K for a hole of one Sun, hotter as it shrinks. */
export function hawkingK(p: Primary, years: number): number {
  // (a hole whose last moment has come is a burst, and gone as the turn ends: its last mass, held a moment)
  return 6.17e-8 / Math.max(p.mass * 1e-4, holeMassNow(p, years), 1e-30);
}
