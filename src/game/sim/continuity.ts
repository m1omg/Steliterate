// Continuity in the Dark Era: how intact the pattern of us still is. Every turn's cycles cost it a
// little; Error-Correction Arrays keep the pattern of the minds they run beside, the Long Sleep and
// the weave keep it better; and with the reserve empty nothing is left to correct the errors at all
// (erasing a bit costs energy, kT ln 2, even at the coldest the universe will ever be).

import { STRUCTURE_BY_ID } from '../data/structures';
import type { GameState } from '../types';
import { wovenShare } from './positronium';
import { colonies, popsOf } from './util';

/** What a turn in the dark costs Continuity, before anything keeps it. */
export const DARK_DECAY = 2.2;
/** What an empty reserve adds to it, each turn the reserve stays empty. */
export const DARK_STARVE = 10;
/** What the Long Sleep leaves of the loss. */
export const DARK_SLEEP = 0.35;

/**
 * The share of the loss our Error-Correction Arrays leave: each settlement's arrays keep the pattern
 * of its own minds and sleepers, so it is the mean over ours, weighed by who is there (an array
 * elsewhere corrects nothing here). 1 with none.
 */
export function correctedShare(state: GameState): number {
  let all = 0;
  let kept = 0;
  for (const c of colonies(state)) {
    let m = 1;
    for (const [id, n] of Object.entries(c.structures)) {
      const d = STRUCTURE_BY_ID[id];
      if (d?.continuityMult && n) m *= Math.pow(d.continuityMult, n);
    }
    const w = popsOf(c) + c.cryo;
    all += w;
    kept += w * m;
  }
  return all > 0 ? kept / all : 1;
}

/** What a turn in the dark takes from Continuity now, with the reserve empty (`starving`) or not. */
export function continuityLoss(state: GameState, starving: boolean): number {
  let loss = DARK_DECAY * correctedShare(state);
  if (state.civ.dormant) loss *= DARK_SLEEP;
  // minds woven through the positronium keep their pattern better: half the loss for their share
  loss *= 1 - 0.5 * wovenShare(state);
  if (starving) loss += DARK_STARVE;
  return loss;
}
