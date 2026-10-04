import type { Colony, GameState } from '../types';

// What a settlement does with industry it has nothing to build with. Every choice turns it into
// about as much as recycling does (a tenth of what a building of that kind makes per point of
// industry it took to build), so the choice is about what we need, not a way to get more. None
// makes something from nothing: recycling reuses matter we already have (matter is conserved, and
// far easier to reuse than energy), study needs no new matter, tending only squeezes more out of
// collectors and a hearth that are already there, and morale is people.

export const SPARE_RATE = {
  salvage: 0.1, // matter per point of spare industry
  salvageLate: 0.05, // energy, once the protons are gone and there is no matter left to reuse
  study: 0.1, // insight
  tend: 0.13, // energy, up to TEND_SHARE of what the settlement makes
  morale: 0.01, // resolve
} as const;

/** Tending gets at most this share more out of the settlement's own collectors and hearth. */
export const TEND_SHARE = 0.25;

export interface SpareYield {
  matter: number;
  energy: number;
  insight: number;
  resolve: number;
}

/** Recycling runs on matter only while there is matter to reuse. */
export function salvageIsMatter(state: GameState): boolean {
  return !state.protonsDecay || state.era === 'dusk' || state.era === 'degenerate';
}

/** What `spare` points of idle industry make at this settlement, which made `energyMade` this turn. */
export function spareYield(state: GameState, c: Colony, spare: number, energyMade: number): SpareYield {
  const y: SpareYield = { matter: 0, energy: 0, insight: 0, resolve: 0 };
  if (!(spare > 0)) return y;
  switch (c.spare ?? 'salvage') {
    case 'salvage':
      if (salvageIsMatter(state)) y.matter = spare * SPARE_RATE.salvage;
      else y.energy = spare * SPARE_RATE.salvageLate;
      break;
    case 'study':
      y.insight = spare * SPARE_RATE.study;
      break;
    case 'tend':
      y.energy = Math.min(spare * SPARE_RATE.tend, Math.max(0, energyMade) * TEND_SHARE);
      break;
    case 'morale':
      y.resolve = spare * SPARE_RATE.morale;
      break;
  }
  return y;
}
