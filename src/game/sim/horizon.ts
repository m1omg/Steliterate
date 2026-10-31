// Life at the black holes (the new version, part 3-4). After matter the holes are the only sources
// left (what is leptonic gathers energy only there), and they do not last: they are drained of
// spin, and the small ones evaporate first. A leptonic settlement can drift to a hole, or from one
// to another, as the Black Hole Age asks: "move as small holes evaporate". Or it can write itself
// into its hole's horizon (speculative, and the Codex says so), where minds cost a tenth of their
// upkeep and think at a quarter of their pace, bound to the hole: when it evaporates they are
// written back out, leptonic, and drift on.

import type { Colony, GameState, StarSystem } from '../types';
import type { ActionResult } from './actions';
import { driftChoices, holeFailing, leaveHole, leaveTarget, protocolsMult } from './crossing';
import { distLy, formOf, hasTech, log, ownColony, popsOf, uid } from './util';

/** Energy a drift to another hole costs, for each structure the settlement takes with it (at least DRIFT_MIN). */
export const DRIFT_ENERGY = 5;
export const DRIFT_MIN = 10;

export interface DriftTerms {
  /** Where it would go, and how far that is. */
  target: StarSystem | null;
  ly: number;
  energy: number;
}

/** What drifting to another hole would take, and where it would go: `targetId` if it is one it could go to, else the game's own choice. */
export function driftTerms(state: GameState, c: Colony, targetId?: string): DriftTerms {
  const target = targetId ? (driftChoices(state, c).find((x) => x.sys.id === targetId)?.sys ?? null) : leaveTarget(state, c);
  const n = Object.values(c.structures).reduce((a, x) => a + (x ?? 0), 0);
  return { target, ly: target ? distLy(state.systems[c.systemId], target) : 0, energy: Math.max(DRIFT_MIN, DRIFT_ENERGY * n) };
}

/** Why this settlement cannot drift to another hole now, or null if it can. */
export function driftCheck(state: GameState, c: Colony, targetId?: string): string | null {
  if (formOf(c) === 'horizon') return 'Written into its hole’s horizon, it is bound to it.';
  if (formOf(c) === 'positronium') return 'Woven through the positronium, it is everywhere at once: it has no hole to leave.';
  if (formOf(c) !== 'leptonic') return 'Only a leptonic settlement can drift between the black holes.';
  if (c.flags_drifted === state.turn) return 'It has drifted once this turn.';
  const t = driftTerms(state, c, targetId);
  if (!t.target) return targetId ? 'It cannot drift there.' : 'No other black hole we could reach has spin to give and years to last.';
  if (state.civ.energy < t.energy) return `Needs ${t.energy} energy.`;
  return null;
}

/** Drift to another hole, `targetId` (the player's choice) or else the game's (`leaveTarget`): the energy paid now; it joins our vault there if there is one. */
export function driftToAnotherHole(state: GameState, colonyId: string, targetId?: string): ActionResult {
  const c = ownColony(state, colonyId);
  if (!c) return 'No such settlement.';
  const err = driftCheck(state, c, targetId);
  if (err) return err;
  const t = driftTerms(state, c, targetId);
  const from = state.systems[c.systemId].name;
  state.civ.energy -= t.energy;
  const name = c.name;
  const at = leaveHole(state, c, t.target);
  if (!at) return 'It could not leave.';
  at.flags_drifted = state.turn;
  state.civ.flags.drifts = (state.civ.flags.drifts ?? 0) + 1;
  log(state, `${name} has drifted from ${from} to ${state.systems[at.systemId].name}${at.id !== c.id ? `, joining ${at.name}` : ''}: a black hole with spin to give.`, 'info', at.systemId);
  return null;
}

/** Writing into a horizon: this much industry, and HORIZON_PER more for each mind there; HORIZON_ENERGY a structure at once. */
export const HORIZON_BASE = 40;
export const HORIZON_PER = 4;
export const HORIZON_ENERGY = 5;

export interface HorizonTerms {
  industry: number;
  energy: number;
  minds: number;
}

/** What writing this settlement into its hole's horizon would take. */
export function horizonTerms(c: Colony): HorizonTerms {
  const minds = popsOf(c);
  const n = Object.values(c.structures).reduce((a, x) => a + (x ?? 0), 0);
  return { industry: HORIZON_BASE + HORIZON_PER * minds, energy: HORIZON_ENERGY * n, minds };
}

/** Why this settlement cannot be written into a horizon now, or null if it can. */
export function horizonCheck(state: GameState, c: Colony): string | null {
  if (formOf(c) === 'horizon') return 'It is written into the horizon already.';
  if (formOf(c) !== 'leptonic') return 'Only a leptonic settlement can be written into a horizon.';
  if (c.queue.some((q) => q.kind === 'horizon')) return 'It is being written into the horizon.';
  if (!hasTech(state, 'horizon_writing')) return 'Needs Horizon Writing.';
  const sys = state.systems[c.systemId];
  if ((sys.primary.kind !== 'black_hole' && sys.primary.kind !== 'smbh') || state.bodies[c.bodyId]?.kind !== 'deep') return 'Only in a black hole’s Deep.';
  if (holeFailing(state, sys)) return 'Its black hole is failing: drained of spin, or soon to evaporate.';
  if (c.queue.length >= 6) return 'The queue is full.';
  const t = horizonTerms(c);
  if (state.civ.energy < t.energy) return `Needs ${t.energy} energy.`;
  return null;
}

/** Begin writing it into the horizon: a project in its queue, the energy paid now. */
export function beginHorizon(state: GameState, colonyId: string): ActionResult {
  const c = ownColony(state, colonyId);
  if (!c) return 'No such settlement.';
  const err = horizonCheck(state, c);
  if (err) return err;
  const t = horizonTerms(c);
  state.civ.energy -= t.energy;
  c.queue.push({ uid: uid(state, 'q'), kind: 'horizon', key: 'horizon', progress: 0, cost: t.industry, paid: { matter: 0, energy: t.energy } });
  log(state, `${c.name}: the writing into the horizon begins.`, 'info', c.systemId);
  return null;
}

/** Done: the settlement is written into its hole's horizon. */
export function completeHorizon(state: GameState, c: Colony) {
  c.form = 'horizon';
  state.civ.flags.horizons = (state.civ.flags.horizons ?? 0) + 1;
  log(state, `${c.name} is written into the horizon of ${state.systems[c.systemId].name}: its minds cost a tenth of their upkeep now, and think at a quarter of their pace, bound to the hole.`, 'good', c.systemId);
}

/**
 * Written back out of the horizon, leptonic (its hole evaporating, or the last of them gone): the
 * Lattice re-encodes at half again (a quarter under the Last Horizon Protocols). Returns how many
 * of its Lattice did not come through.
 */
export function writeOut(state: GameState, c: Colony): number {
  const lost = Math.round(c.pops.lattice * 0.5 * protocolsMult(state, 'blackhole'));
  c.pops.lattice -= lost;
  c.form = 'leptonic';
  c.queue = c.queue.filter((q) => q.kind !== 'horizon');
  return lost;
}

/** Its hole has evaporated: what was written in its horizon is written back out, and drifts to another hole if there is one to go to. */
export function horizonGone(state: GameState, c: Colony) {
  const from = state.systems[c.systemId].name;
  const name = c.name;
  const lost = writeOut(state, c);
  const at = leaveHole(state, c);
  log(state, `${from} has evaporated: what was written in its horizon at ${name} is written back out, leptonic${lost ? ` (${lost} of its Lattice did not come through)` : ''}${at ? `, and drifts to ${state.systems[at.systemId].name}` : ', with no black hole left to go to'}.`, 'bad', (at ?? c).systemId);
}
