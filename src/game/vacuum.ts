// The vacuum, a hidden fate (7 Nov; the player: "The vacuum as a hidden fate, like the fate of
// matter ... there would be a research question that tells you which vacuum you have. If it's
// unstable, each turn carries a rising chance that everything ends without warning. Physics allows
// no defence, so the game becomes a race to finish your ending's work first. It could be a setting,
// since a random ending can feel unfair.").
//
// The vacuum is the lowest-energy state of the fields that fill space, the Higgs field among them,
// whose value sets the masses of particles. Three answers:
// - stable: ours is the lowest there is (in the Standard Model, a top quark a little lighter than
//   measured, or new particles at high energies; and no string landscape below us). Nothing ends
//   by it, and the Recurrence can come.
// - higgs: the Standard Model's own vacuum, metastable with the measured Higgs and top-quark
//   masses. A bubble of the true vacuum can form anywhere by tunnelling and grows at nearly the
//   speed of light; inside it no atom holds together, and its negative energy collapses it
//   (Coleman & De Luccia 1980). Andreassen, Frost & Schwartz (2018, eq. 6.27): τ = (Γ/V)^(−1/4) =
//   10¹⁶¹ years, 68%: 10¹⁰² to 10³²¹, 95%: 10⁶⁵ to 10¹³⁸³. With dark energy only bubbles within our
//   horizon can reach us: the expected number in our past light cone grows as (Γ/V)·(4π/3)H∞⁻³·t,
//   so the wait is t* = (3/4π)·τ⁴·H∞³ ≈ 10⁶¹³ years (95%: 10²²⁹ to 10⁵⁵⁰¹; our own conversion,
//   H∞ = 56 km/s/Mpc). On the deep-time ruler λ = log10 η, and at the Tide z = √ln(λ/2) is
//   proportional to the Dark Era's turns (eras.ts stepTime), so the date is a two-piece normal in
//   z fitted to those five quantiles (least squares; within half a Tide turn of each): Dark turn
//   8 to 15 at the Tide (Standard), half of them by turn 11.
// - landscape: one of string theory's many vacua, not the lowest: it tunnels down to a sink that
//   nothing returns from (flat space where hidden dimensions open up, or a space of negative energy
//   that collapses), always before the recurrence time (Linde 2007): at the latest about then, and
//   in the KKLT model as soon as about 10^(10³⁴) years. λ is uniform in [34, 122): each step of the
//   exponent's exponent alike, always before the Recurrence (λ 122).
// Nothing is drawn: which vacuum an Unknown game holds, and its date, are hashes of the seed, so
// every seed keeps its galaxy and its dice. The chance the forecast gives is the distribution's,
// given that we have lasted so far, never the hidden date's. The whole Dark Era assumes dark energy
// is a true constant; DESI's 2025 data hint it may be weakening (the Codex says so).

import { hashSeed } from './rng';
import type { GameState, Vacuum, VacuumSetting } from './types';

const unit = (key: string) => (hashSeed(key) % 1000003) / 1000003;

/** The Higgs vacuum's fall: a two-piece normal in z = √ln(λ/2), its mode and its spread below and above. */
export const HIGGS_FALL = { mode: 0.5515, below: 0.0745, above: 0.1135 } as const;
/** A landscape vacuum falls between these λ (log10 η): 10^(10³⁴) years (KKLT) and the Recurrence. */
export const LANDSCAPE_FROM = 34;
export const LANDSCAPE_TO = 122;

/** The setting (absent: stable, as every game before 7 Nov). */
export function vacuumSetting(state: GameState): VacuumSetting {
  return state.settings.vacuum ?? 'stable';
}

/** The vacuum this game holds: chosen, or, left unknown, a third each by a hash of the seed. */
export function vacuumOf(state: GameState): Vacuum {
  const v = vacuumSetting(state);
  if (v !== 'unknown') return v;
  const u = unit(`vacuum:${state.settings.seed}`);
  return u < 1 / 3 ? 'stable' : u < 2 / 3 ? 'higgs' : 'landscape';
}

/** Do we know which vacuum we have? Chosen at the start, or found by the Vacuum Question. Nothing in the sky shows it before it falls. */
export function vacuumKnown(state: GameState): boolean {
  return vacuumSetting(state) !== 'unknown' || state.civ.techs.includes('vacuum_question');
}

// ------------------------------------------------------------------ the normal distribution
/** The standard normal's cumulative distribution (Abramowitz & Stegun 7.1.26, |error| < 1.5 × 10⁻⁷). */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(x) / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Its inverse (Acklam's rational approximation, relative error < 1.2 × 10⁻⁹). */
export function normInv(p: number): number {
  const q0 = Math.min(1 - 1e-12, Math.max(1e-12, p));
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (q0 < lo) {
    const q = Math.sqrt(-2 * Math.log(q0));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (q0 > 1 - lo) {
    const q = Math.sqrt(-2 * Math.log(1 - q0));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = q0 - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** z = √ln(λ/2): proportional to the Dark Era's Tide turns (0 as it begins, at λ 2). */
export function zOf(lambda: number): number {
  return Math.sqrt(Math.max(0, Math.log(Math.max(lambda, 2) / 2)));
}

/** The share of Higgs vacua fallen by λ (the two-piece normal's distribution in z). */
function higgsCdf(lambda: number): number {
  const { mode: m, below: sl, above: sr } = HIGGS_FALL;
  const z = zOf(lambda);
  if (z <= m) return ((2 * sl) / (sl + sr)) * normCdf((z - m) / sl);
  return 1 - ((2 * sr) / (sl + sr)) * (1 - normCdf((z - m) / sr));
}

/** Its quantile: the z by which a share `u` of Higgs vacua have fallen. */
function higgsQuantile(u: number): number {
  const { mode: m, below: sl, above: sr } = HIGGS_FALL;
  const p = sl / (sl + sr);
  if (u <= p) return m + sl * normInv((u * (sl + sr)) / (2 * sl));
  return m + sr * normInv(1 - ((1 - u) * (sl + sr)) / (2 * sr));
}

/** The share of vacua of this kind fallen by λ (log10 η). */
export function fallenBy(v: Vacuum, lambda: number): number {
  if (v === 'stable') return 0;
  if (v === 'higgs') return higgsCdf(lambda);
  return Math.min(1, Math.max(0, (lambda - LANDSCAPE_FROM) / (LANDSCAPE_TO - LANDSCAPE_FROM)));
}

/** The λ by which a share `u` of vacua of this kind have fallen. */
export function fallQuantile(v: Vacuum, u: number): number {
  if (v === 'stable') return Infinity;
  if (v === 'higgs') {
    const z = Math.max(0, higgsQuantile(u));
    return 2 * Math.exp(z * z);
  }
  return LANDSCAPE_FROM + u * (LANDSCAPE_TO - LANDSCAPE_FROM);
}

/** Where this game's vacuum falls, as λ = log10 η (a hash of the seed): Infinity if it is stable. */
export function vacuumFallsAt(state: GameState): number {
  const v = vacuumOf(state);
  if (v === 'stable') return Infinity;
  return fallQuantile(v, unit(`vacuum-fall:${state.settings.seed}`));
}

/** Has it fallen by now? */
export function vacuumFallen(state: GameState): boolean {
  return Math.log10(Math.max(1, state.eta)) >= vacuumFallsAt(state);
}

/**
 * The chance a vacuum of this kind falls between λ `from` and `to`, given that it has not by
 * `from`: what anyone can know, never the hidden date. It rises turn by turn at a steady pace.
 */
export function fallChance(v: Vacuum, from: number, to: number): number {
  if (v === 'stable' || !(to > from)) return 0;
  const a = fallenBy(v, from);
  if (a >= 1) return 1;
  return Math.min(1, Math.max(0, (fallenBy(v, to) - a) / (1 - a)));
}

/** The ending a fallen vacuum brings. */
export const VACUUM_ENDING: Record<Exclude<Vacuum, 'stable'>, string> = { higgs: 'The True Vacuum', landscape: 'The Final State' };

/** Is this the ending of a fallen vacuum? */
export function isVacuumEnding(ending: string): boolean {
  return ending === VACUUM_ENDING.higgs || ending === VACUUM_ENDING.landscape;
}
