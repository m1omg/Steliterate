// Every civilization plays the same game (the new version, docs/plans/new-version.md): each has a
// Civ in `state.civs`, and `state.civ` points at the one whose turn or view it is. The pointer is
// not saved (JSON leaves it out), so no civilization is ever written twice: a load points it again.
import type { Civ, GameState } from './types';

/** The player's civilization's id in `state.civs`. */
export const PLAYER_ID = 'us';

/** Point the state at `c`, the civilization whose turn or view it is: a pointer JSON leaves out. */
export function pointAt(state: Omit<GameState, 'civ'> | GameState, c: Civ): GameState {
  Object.defineProperty(state, 'civ', { value: c, writable: true, enumerable: false, configurable: true });
  return state as GameState;
}

/** A state as read from JSON: pointed at the player again. */
export function linkCivs(state: GameState): GameState {
  return pointAt(state, state.civs[state.player]);
}

/** The player's civilization, whoever's turn it is. */
export function playerCiv(state: GameState): Civ {
  return state.civs[state.player];
}
