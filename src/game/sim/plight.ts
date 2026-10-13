// How desperate a civilization is (the new version, part 2b), 0 to 1: what its neighbours judge a
// Hunger act by, and what can drive one that is bold enough to take one.
import type { GameState } from '../types';
import { clamp, coloniesOf } from './util';

/** The reserve it would take to live this many turns at its present loss, or more: no plight from it. */
const RESERVE_TURNS = 20;
/** Its people falling by this share within ten turns: full plight from it. */
const FALL_SHARE = 0.5;
/** Resolve at or above this: no plight from it. */
const RESOLVE_OK = 40;

/**
 * How desperate a civilization is, 0 to 1: how few turns its reserve would last at its present
 * loss, how many of its settlements starve, how fast its people are falling, and how low its will.
 * The worst of them counts most, the others a little. One whose game is over has none.
 */
export function plight(state: GameState, id: string): number {
  const civ = state.civs[id];
  if (!civ || civ.outcome) return 0;
  const net = civ.flags.last_energy_net ?? 0;
  const reserve = net < 0 ? clamp(1 - civ.energy / (-net * RESERVE_TURNS), 0, 1) : 0;
  const cs = coloniesOf(state, id);
  const starving = cs.length ? cs.filter((c) => c.starving > 0).length / cs.length : 0;
  const pops = civ.stats.pops;
  const now = pops[pops.length - 1] ?? 0;
  const then = pops[Math.max(0, pops.length - 11)] ?? now;
  const falling = then > 0 ? clamp((then - now) / then / FALL_SHARE, 0, 1) : 0;
  const will = clamp((RESOLVE_OK - civ.resolve) / RESOLVE_OK, 0, 1);
  const parts = [reserve, starving, falling, will];
  return clamp(0.7 * Math.max(...parts) + (0.3 * parts.reduce((a, b) => a + b, 0)) / parts.length, 0, 1);
}
