import { TECH_BY_ID, TECHS, type TechDef } from '../data/techs';
import type { GameState } from '../types';
import { eraIndex, hasTech, protonFateKnown } from './util';

export function techCost(state: GameState, id: string): number {
  const def = TECH_BY_ID[id];
  if (!def) return Infinity;
  let c = def.cost;
  const d = state.settings.difficulty;
  c *= d === 'gentle' ? 0.85 : d === 'harsh' ? 1.15 : 1;
  if (id === 'conformal_mathematics') {
    if (state.civ.flags.slow_gift) c *= 0.6;
    if (state.civ.flags.unlit_gift) c *= 0.5;
  }
  return Math.round(c);
}

export function techVisible(state: GameState, def: TechDef): boolean {
  if (def.needsStable || def.needsDecay) {
    if (!protonFateKnown(state)) return false;
    if (def.needsStable && state.protonsDecay) return false;
    if (def.needsDecay && !state.protonsDecay) return false;
  }
  return true;
}

export function techAvailable(state: GameState, id: string): boolean {
  const def = TECH_BY_ID[id];
  if (!def || hasTech(state, id)) return false;
  if (eraIndex(def.era) > eraIndex(state.era)) return false;
  if (!techVisible(state, def)) return false;
  return def.requires.every((r) => hasTech(state, r));
}

export function availableTechs(state: GameState): TechDef[] {
  return TECHS.filter((t) => techAvailable(state, t.id));
}
