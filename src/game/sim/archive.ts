import type { GameState } from '../types';
import { capacity } from './economy';
import { computeMods } from './mods';
import { capital, colonies, log } from './util';

// Echoes that come to us through an event (an upload, ghosts run again, sleepers who join us)
// go wherever there is free substrate, the capital first. The rest wait in the archive, stored
// and costing nothing, and move in as soon as a Substrate Core has room for them.

/** Echoes waiting in the archive for free substrate. */
export function archivedEchoes(state: GameState): number {
  return state.civ.flags.echo_archive ?? 0;
}

/** Place `n` newly arrived Echoes; returns how many had to wait in the archive. */
export function welcomeEchoes(state: GameState, n: number): number {
  const mods = computeMods(state);
  const cap = capital(state);
  const order = [...(cap ? [cap] : []), ...colonies(state).filter((c) => c !== cap)];
  let left = n;
  for (const c of order) {
    if (left <= 0) break;
    const k = Math.min(left, capacity(state, c, mods).echoes - c.pops.echoes);
    if (k > 0) {
      c.pops.echoes += k;
      left -= k;
    }
  }
  if (left > 0) {
    state.civ.flags.echo_archive = archivedEchoes(state) + left;
    log(state, `${left} Echo${left === 1 ? '' : 'es'} wait${left === 1 ? 's' : ''} in the archive until there is substrate to run on.`, 'info');
  }
  return left;
}

/** Each turn: archived Echoes move into any free substrate. */
export function wakeArchivedEchoes(state: GameState) {
  let left = archivedEchoes(state);
  if (left <= 0) return;
  const mods = computeMods(state);
  for (const c of colonies(state)) {
    if (left <= 0) break;
    const k = Math.min(left, capacity(state, c, mods).echoes - c.pops.echoes);
    if (k > 0) {
      c.pops.echoes += k;
      left -= k;
      log(state, `${k} Echo${k === 1 ? '' : 'es'} left the archive for new substrate at ${c.name}.`, 'good', c.systemId);
    }
  }
  if (left > 0) state.civ.flags.echo_archive = left;
  else delete state.civ.flags.echo_archive;
}
