import { Rng } from '../game/rng';

// A generation of stars on the Hertzsprung–Russell diagram, at any moment of its history, for the
// films (most of a galaxy's stars were born early, close together in time: a generation is the
// picture's simplification). Each star is placed by its mass: on the main sequence while it burns hydrogen, the more
// massive the sooner gone; the smallest red dwarfs turning hotter and bluer as they burn out
// (Laughlin, Bodenheimer & Adams 1997, "The end of the main sequence"); what is left cooling
// down the white dwarfs' track (Mestel's law, L ∝ t^-1.4) and the brown dwarfs dimming off the
// cold edge. The relations are the textbook's, rounded: shapes and orders of magnitude are true;
// the game's own timeline sets the smallest stars' end near 10^14 years.

export interface HRStar {
  /** Mass (M☉). */
  m: number;
  /** log10 of the year it formed. */
  born: number;
  /** Its life on the main sequence (years); Infinity for a brown dwarf. */
  life: number;
  /** A number of its own (0..1), for twinkle and order. */
  k: number;
  /** Its own small offsets from the relations (metallicity, rotation, the sky's error bars). */
  dT: number;
  dL: number;
}

export interface HRPoint {
  logT: number;
  logL: number;
  /** 0..1: how present it is (forming, or gone to a neutron star or a black hole). */
  a: number;
  kind: 'ms' | 'blue' | 'giant' | 'wd' | 'bd';
}

// main-sequence temperature by mass (K): Pecaut & Mamajek's table, rounded
const T_OF_M: readonly (readonly [number, number])[] = [
  [0.075, 2300],
  [0.1, 2800],
  [0.2, 3200],
  [0.4, 3600],
  [0.6, 4100],
  [0.8, 5000],
  [1, 5800],
  [1.5, 7000],
  [2, 9000],
  [3, 12000],
  [5, 15500],
  [10, 25000],
  [20, 33000],
];

/** Main-sequence temperature (K) by mass. */
export function msT(m: number): number {
  if (m <= T_OF_M[0][0]) return T_OF_M[0][1];
  for (let i = 1; i < T_OF_M.length; i++) {
    const [m0, t0] = T_OF_M[i - 1];
    const [m1, t1] = T_OF_M[i];
    if (m <= m1) return t0 * Math.pow(t1 / t0, Math.log(m / m0) / Math.log(m1 / m0));
  }
  return T_OF_M[T_OF_M.length - 1][1];
}

/** Main-sequence luminosity (L☉) by mass: the textbook's broken power law. */
export function msL(m: number): number {
  if (m < 0.43) return 0.23 * Math.pow(m, 2.3);
  if (m < 2) return Math.pow(m, 4);
  return 1.4 * Math.pow(m, 3.5);
}

/** Main-sequence life (years): 10^10 M^-2.5, steeper for the fully convective (they burn all their hydrogen), so the smallest last about 10^14 years. */
function msLife(m: number): number {
  if (m >= 0.4) return 1e10 * Math.pow(m, -2.5);
  return 1e10 * Math.pow(0.4, -2.5) * Math.pow(m / 0.4, -4.3);
}

export class Population {
  readonly stars: HRStar[] = [];
  constructor(seed: number, n: number) {
    const rng = new Rng(seed);
    // Kroupa's initial mass function: dN/dm ∝ m^-0.3 below 0.08, m^-1.3 to 0.5, m^-2.3 above,
    // sampled piece by piece by each piece's share (brown dwarfs from 0.02 M☉, stars to 20)
    const pieces: [number, number, number][] = [
      [0.02, 0.08, 0.7],
      [0.08, 0.5, 1.3],
      [0.5, 20, 2.3],
    ];
    const share = [0.22, 0.6, 0.18];
    for (let i = 0; i < n; i++) {
      let r = rng.next();
      let p = 0;
      while (p < share.length - 1 && r > share[p]) r -= share[p++];
      const [a, b, alpha] = pieces[p];
      // inverse of the power law's cumulative
      const e = 1 - alpha;
      const u = rng.next();
      const m = Math.pow(Math.pow(a, e) + u * (Math.pow(b, e) - Math.pow(a, e)), 1 / e);
      // a generation, as most of a galaxy's stars are: born together early on (about ten million
      // years in, give or take), and a few stragglers later
      const born = rng.chance(0.93) ? rng.range(6.75, 6.95) : rng.range(8, 11.5);
      this.stars.push({ m, born, life: m < 0.075 ? Infinity : msLife(m), k: rng.next(), dT: (rng.next() + rng.next() - 1) * 0.03, dL: (rng.next() + rng.next() - 1) * 0.22 });
    }
  }

  /** Where a star is at η (log10 of years), with its own small scatter. */
  at(s: HRStar, eta: number): HRPoint {
    const p = this.place(s, eta);
    p.logT += s.dT;
    p.logL += s.dL;
    return p;
  }

  private place(s: HRStar, eta: number): HRPoint {
    const forming = Math.min(1, Math.max(0, (eta - s.born) * 6));
    const age = Math.pow(10, eta) - Math.pow(10, s.born);
    if (age <= 0) return { logT: Math.log10(msT(s.m)), logL: Math.log10(msL(s.m)), a: 0, kind: 'ms' };
    if (s.m < 0.075) {
      // a brown dwarf: never lit, dimming as it shrinks (L ∝ t^-1.3, M^2.64, from a hundred million
      // years on), its radius about a tenth of the Sun's; younger, larger and no hotter than about 2,800 K
      const L = 1e-4 * Math.pow(Math.max(age, 1e8) / 1e9, -1.3) * Math.pow(s.m / 0.05, 2.64);
      return { logT: Math.log10(Math.min(2800, 5778 * Math.pow(L / 0.01, 0.25))), logL: Math.log10(L), a: forming, kind: 'bd' };
    }
    const life = s.life;
    if (age < life) {
      const f = age / life;
      let T = msT(s.m);
      let L = msL(s.m);
      if (s.m < 0.25 && f > 0.82) {
        // the smallest burn out hotter and brighter: blue dwarfs, toward 6,000 K or more
        const g = (f - 0.82) / 0.18;
        T *= 1 + g * (s.m < 0.12 ? 1.1 : 1.6);
        L *= 1 + g * 9;
        return { logT: Math.log10(T), logL: Math.log10(L), a: forming, kind: 'blue' };
      }
      // a little brighter as it ages on the sequence
      L *= 1 + 0.6 * f;
      return { logT: Math.log10(T), logL: Math.log10(L), a: forming, kind: 'ms' };
    }
    if (s.m >= 8) {
      // a neutron star or a black hole: gone from the diagram, in a moment
      const gone = Math.min(1, (age - life) / (life * 0.02));
      return { logT: Math.log10(msT(s.m)), logL: Math.log10(msL(s.m)) + 0.5, a: forming * (1 - gone), kind: 'giant' };
    }
    const after = age - life;
    const giant = life * 0.1;
    if (s.m >= 0.5 && after < giant) {
      // a giant, briefly: up and to the right, then down to the white dwarfs
      const g = after / giant;
      const up = Math.sin(Math.min(1, g) * Math.PI);
      return { logT: Math.log10(msT(s.m)) - 0.25 * up, logL: Math.log10(msL(s.m)) + 2.2 * up, a: forming, kind: 'giant' };
    }
    // a white dwarf, cooling: Mestel's law, a radius about 1.2% of the Sun's
    const cool = Math.max(1e6, after - (s.m >= 0.5 ? giant : 0));
    const L = 1e-2 * Math.pow(cool / 1e8, -1.4);
    return { logT: Math.log10(5778 * Math.pow(L / 1.44e-4, 0.25)), logL: Math.log10(L), a: forming, kind: 'wd' };
  }
}
