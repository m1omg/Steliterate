// Positronium (the new version, part 3-5). Where protons decayed or space unmade matter, the
// electrons and positrons left over pair, from η 85, into atoms wider than today's observable
// universe, and decay near η 141 (Page & McKee 1981, the reference case; Chiba & Sugiyama 2004
// find that with dark energy like ours they may never form, and the Codex says so). Minds can be
// woven through them (speculative): the slowest and cheapest thinking there will ever be, until
// the atoms decay; whatever is still woven through them then is lost. Positronium Nets gather the
// radiation of their shrinking orbits, a trickle that grows toward the decay, and after it the
// never-ending annihilation, a dole that halves every turn and so adds up to a fixed amount.

import { POSITRONIUM_ETA } from '../eras';
import { fateOf } from '../fate';
import type { Colony, GameState } from '../types';
import type { ActionResult } from './actions';
import { turnsUntilYears } from './flare';
import { destroyColony } from './fleets';
import { colonies, formOf, hasTech, log, ownColony, popsOf, uid } from './util';

/** Where the positronium atoms decay (η). */
export const POSITRONIUM_DECAY = 141;

/** Will positronium form in this universe at all? Only from decayed protons or unmade matter. */
export function positroniumComes(state: GameState): boolean {
  return fateOf(state) !== 'stable';
}

/** Has it formed by η (and not yet decayed)? */
export function positroniumHere(state: GameState, eta = state.eta): boolean {
  return positroniumComes(state) && eta >= POSITRONIUM_ETA && eta < POSITRONIUM_DECAY;
}

/** Has it decayed by η? */
export function positroniumGone(state: GameState, eta = state.eta): boolean {
  return positroniumComes(state) && eta >= POSITRONIUM_DECAY;
}

/** Turns until the atoms decay, at our pace (counted as the turns will fall: one can jump past it). */
export function turnsToDecay(state: GameState): number {
  return turnsUntilYears(state, Math.pow(10, POSITRONIUM_DECAY));
}

/** Weaving a settlement through it: this much industry, and WEAVE_PER more for each mind there; WEAVE_ENERGY a structure at once. */
export const WEAVE_BASE = 40;
export const WEAVE_PER = 4;
export const WEAVE_ENERGY = 5;
/** Leaving the weave: this much energy for each mind, or what is left of the reserve if less (it is never refused for want of it). */
export const LEAVE_WEAVE_ENERGY = 2;

export interface WeaveTerms {
  industry: number;
  energy: number;
  minds: number;
}

/** What weaving this settlement through the positronium would take. */
export function weaveTerms(c: Colony): WeaveTerms {
  const minds = popsOf(c);
  const n = Object.values(c.structures).reduce((a, x) => a + (x ?? 0), 0);
  return { industry: WEAVE_BASE + WEAVE_PER * minds, energy: WEAVE_ENERGY * n, minds };
}

/** Why this settlement cannot be woven through the positronium now, or null if it can. */
export function weaveCheck(state: GameState, c: Colony): string | null {
  if (formOf(c) === 'positronium') return 'It is woven through the positronium already.';
  if (formOf(c) === 'horizon') return 'Written into its hole’s horizon, it is bound to it.';
  if (formOf(c) !== 'leptonic') return 'Only a leptonic settlement can be woven through the positronium.';
  if (c.queue.some((q) => q.kind === 'weave')) return 'It is being woven.';
  if (!hasTech(state, 'positronium_weaving')) return 'Needs Positronium Weaving.';
  if (!positroniumComes(state)) return 'Matter is stable: no positronium will form.';
  if (positroniumGone(state)) return 'The positronium has decayed.';
  if (!positroniumHere(state)) return `No positronium has formed yet: it pairs from η ${POSITRONIUM_ETA}.`;
  if (c.queue.length >= 6) return 'The queue is full.';
  const t = weaveTerms(c);
  if (state.civ.energy < t.energy) return `Needs ${t.energy} energy.`;
  return null;
}

/** Begin weaving it through the positronium: a project in its queue, the energy paid now. */
export function beginWeave(state: GameState, colonyId: string): ActionResult {
  const c = ownColony(state, colonyId);
  if (!c) return 'No such settlement.';
  const err = weaveCheck(state, c);
  if (err) return err;
  const t = weaveTerms(c);
  state.civ.energy -= t.energy;
  c.queue.push({ uid: uid(state, 'q'), kind: 'weave', key: 'weave', progress: 0, cost: t.industry, paid: { matter: 0, energy: t.energy } });
  log(state, `${c.name}: the weaving through the positronium begins.`, 'info', c.systemId);
  return null;
}

/** Done: the settlement is woven through the positronium. Too late, it is not (the atoms have decayed). */
export function completeWeave(state: GameState, c: Colony) {
  if (!positroniumHere(state)) {
    log(state, `${c.name}: the positronium has decayed before the weaving was done.`, 'bad', c.systemId);
    return;
  }
  c.form = 'positronium';
  state.civ.flags.woven = (state.civ.flags.woven ?? 0) + 1;
  log(state, `${c.name} is woven through the positronium: its minds cost a fiftieth of their upkeep now, and think at a tenth of their pace, until the atoms decay near η ${POSITRONIUM_DECAY}.`, 'good', c.systemId);
}

/** What leaving the weave costs now: LEAVE_WEAVE_ENERGY a mind, or all the reserve has if less. */
export function leaveWeaveCost(state: GameState, c: Colony): number {
  return Math.min(LEAVE_WEAVE_ENERGY * popsOf(c), Math.max(0, Math.floor(state.civ.energy)));
}

/** Why it cannot leave the weave now, or null if it can (never for want of energy: a settlement woven in for want of it must still be able to come out). */
export function leaveWeaveCheck(_state: GameState, c: Colony): string | null {
  if (formOf(c) !== 'positronium') return 'It is not woven through the positronium.';
  return null;
}

/** Leave the weave: leptonic again at once, for LEAVE_WEAVE_ENERGY a mind (or what is left). No research, no event. */
export function leaveWeave(state: GameState, colonyId: string): ActionResult {
  const c = ownColony(state, colonyId);
  if (!c) return 'No such settlement.';
  const err = leaveWeaveCheck(state, c);
  if (err) return err;
  state.civ.energy = Math.max(0, state.civ.energy - leaveWeaveCost(state, c));
  c.form = 'leptonic';
  log(state, `${c.name} has left the weave: leptonic again, ${popsOf(c)} minds drawn back out of the positronium.`, 'info', c.systemId);
  return null;
}

/** The share of our minds woven through the positronium (in the Dark Era it halves Continuity's loss for them). */
export function wovenShare(state: GameState): number {
  let all = 0;
  let woven = 0;
  for (const c of colonies(state)) {
    const n = popsOf(c);
    all += n;
    if (formOf(c) === 'positronium') woven += n;
  }
  return all > 0 ? woven / all : 0;
}

/**
 * The atoms decay as the turn passes η POSITRONIUM_DECAY (from η `from` to `to`): whatever of ours
 * is still woven through them is lost, the Record naming each settlement, and one with no one left
 * goes. Returns how many minds were lost.
 */
export function theWeaveEnds(state: GameState, from: number, to: number): number {
  if (!positroniumComes(state) || from >= POSITRONIUM_DECAY || to < POSITRONIUM_DECAY) return 0;
  let lost = 0;
  for (const c of colonies(state)) {
    if (formOf(c) !== 'positronium') continue;
    const n = popsOf(c);
    lost += n;
    for (const k of Object.keys(c.pops) as (keyof Colony['pops'])[]) c.pops[k] = 0;
    c.form = 'leptonic';
    c.queue = [];
    log(state, `The positronium has decayed. ${c.name} was still woven through it: ${n} minds ended with the atoms, in a last flash of light.`, 'bad', c.systemId);
    if (c.cryo <= 0) destroyColony(state, c, 'its minds ended with the positronium');
  }
  return lost;
}

/** A Positronium Net gathers this much over the window, from the shrinking orbits; and after the decay this much more, from the never-ending annihilation. */
export const NET_TRICKLE = 40;
export const NET_DOLE = 20;

/** The share of the window's radiation given off by η: little at first, most of it near the decay. */
export function trickleShare(eta: number): number {
  const x = Math.max(0, Math.min(1, (eta - POSITRONIUM_ETA) / (POSITRONIUM_DECAY - POSITRONIUM_ETA)));
  return x * x * x;
}

/**
 * What one Positronium Net gathers in a turn from `years` lasting `L` years: its share of the
 * window's trickle (so the total does not depend on the pace), or after the decay its share of the
 * dole, half the turn before's each turn (`state.flags.positronium_end`, the turn it decayed in).
 */
export function netYield(state: GameState, years: number, L: number): number {
  if (!positroniumComes(state)) return 0;
  const eta0 = Math.log10(Math.max(1, years));
  const eta1 = isFinite(L) ? Math.log10(Math.max(1, years + L)) : Infinity;
  if (eta0 < POSITRONIUM_DECAY) return NET_TRICKLE * (trickleShare(eta1) - trickleShare(eta0));
  const end = state.flags.positronium_end;
  if (end === undefined) return 0;
  const k = Math.max(1, state.turn - end);
  return NET_DOLE * Math.pow(0.5, k);
}
