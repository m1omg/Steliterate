import { TECH_BY_ID, TECHS, type TechDef } from '../data/techs';
import type { GameState } from '../types';
import { queueEvent } from './events';
import { hasTech, log, protonFateKnown } from './util';
import { ageReached, fateOf } from '../fate';

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
  if (def.needsStable || def.needsDecay || def.needsCurvature) {
    if (!protonFateKnown(state)) return false;
    const fate = fateOf(state);
    if (def.needsStable && fate !== 'stable') return false;
    if (def.needsDecay && fate !== 'decay') return false;
    if (def.needsCurvature && fate !== 'curvature') return false;
  }
  return true;
}

export function techAvailable(state: GameState, id: string): boolean {
  const def = TECH_BY_ID[id];
  if (!def || hasTech(state, id)) return false;
  if (!ageReached(state, def.era)) return false;
  if (!techVisible(state, def)) return false;
  return def.requires.every((r) => hasTech(state, r));
}

export function availableTechs(state: GameState): TechDef[] {
  return TECHS.filter((t) => techAvailable(state, t.id));
}

/** Directed research runs labs and computation: it draws power in proportion to the insight spent. */
export const RESEARCH_DRAW = 0.02;
/** Undirected study, with nothing chosen: half of the insight is kept for later, and nothing is drawn. */
export const IDLE_STUDY = 0.5;

export function researchDraw(state: GameState, insight: number): number {
  return state.civ.researching || state.civ.work ? insight * RESEARCH_DRAW : 0;
}

/** A project is finished: it joins what we know. Whatever insight was left over is stored. */
export function completeTech(state: GameState, id: string, how: 'research' | 'stored' | 'surplus' = 'research') {
  const civ = state.civ;
  const def = TECH_BY_ID[id];
  if (!def || hasTech(state, id)) return;
  civ.techs.push(id);
  delete civ.research[id];
  if (civ.researching === id) civ.researching = null;
  if (def.taint) civ.taint = Math.min(100, civ.taint + def.taint);
  const name = def.name;
  log(state, how === 'surplus' ? `With insight to spare, the scholars worked out ${name} on their own.` : how === 'stored' ? `Research complete: ${name}, at once, from stored insight.` : `Research complete: ${name}.`, 'good');
  if (id === 'proton_question') queueEvent(state, 'proton_answer');
}

/** At most this many projects are filled in from surplus in one turn. */
export const SURPLUS_PER_TURN = 3;

/**
 * With a great deal of stored insight, the scholars do not wait to be asked. They only ever use
 * the excess: what is left after keeping enough for the dearest open project, so whatever you
 * choose next is still paid for at once. With that excess they work out the cheapest open
 * projects themselves, never the Hunger's and never a deliberate choice (noAuto).
 * Returns the ids discovered.
 */
export function discoverFromSurplus(state: GameState): string[] {
  const civ = state.civ;
  const found: string[] = [];
  for (let i = 0; i < SURPLUS_PER_TURN; i++) {
    const bank = civ.flags.insight_bank ?? 0;
    const open = availableTechs(state)
      .filter((t) => !t.taint && !t.noAuto && t.id !== civ.researching)
      .map((t) => ({ t, cost: Math.max(0, techCost(state, t.id) - (civ.research[t.id] ?? 0)) }))
      .sort((a, b) => a.cost - b.cost);
    if (!open.length) break;
    const reserve = open[open.length - 1].cost; // enough for any project you might pick next
    const next = open[0];
    if (bank - next.cost < reserve || next.cost <= 0) break;
    civ.flags.insight_bank = bank - next.cost;
    completeTech(state, next.t.id, 'surplus');
    found.push(next.t.id);
  }
  return found;
}
