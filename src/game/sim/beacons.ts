// Decoy beacons: bright false hearths that draw the Hunger away from us. A beacon is a machine
// burning to look like a settlement, so it burns only while we feed it: BEACON_COST to light, then
// BEACON_UPKEEP a turn (scaled, as all upkeep is, by the share of a Tide turn the turn lives). When
// we stop feeding it, or cannot, it goes dark. Lighting one turns the nearest awake swarm toward
// it at once (hunger.ts, drawSwarmTo); while it burns, a swarm choosing its next meal is drawn to it
// (moveSwarm). Bend: our orders reach it within the turn, as all our orders do.

import type { GameState, StarSystem } from '../types';
import { log } from './util';

/** Energy to light a beacon. */
export const BEACON_COST = 30;
/** Energy a turn to keep one burning, at the Tide. */
export const BEACON_UPKEEP = 3;

/** Whose a beacon is (older saves: the player's). */
export function beaconOwner(state: GameState, sys: StarSystem): string | null {
  return sys.beacon ? (sys.beaconBy ?? state.player) : null;
}

/** The civilization's beacons burning now (the one whose turn or view it is), in a fixed order (the order they are fed in). */
export function litBeacons(state: GameState): StarSystem[] {
  return Object.values(state.systems).filter((s) => s.beacon && !s.gone && beaconOwner(state, s) === state.civ.id);
}

/** Energy the coming turn takes to keep every beacon burning, before the turn's lived share. */
export function beaconUpkeep(state: GameState): number {
  return litBeacons(state).length * BEACON_UPKEEP;
}

/**
 * Feed the beacons as a turn ends, each in turn while the energy lasts; any we cannot feed go
 * dark. A beacon at a star that is gone is gone with it. Returns the energy paid.
 */
export function feedBeacons(state: GameState, livedShare: number): number {
  const civ = state.civ;
  const each = BEACON_UPKEEP * livedShare;
  let paid = 0;
  for (const sys of Object.values(state.systems)) {
    if (!sys.beacon || beaconOwner(state, sys) !== civ.id) continue;
    if (sys.gone) {
      delete sys.beacon;
      delete sys.beaconBy;
      continue;
    }
    if (civ.energy >= each) {
      civ.energy -= each;
      paid += each;
    } else {
      delete sys.beacon;
      delete sys.beaconBy;
      log(state, `We could not feed the beacon at ${sys.name}; it has gone dark.`, 'bad', sys.id);
    }
  }
  return paid;
}
