// Burning memories for warmth (7 Nov; the player: "A blank memory can be turned into work
// (Szilard's engine): fill the archive with noise and you get energy. It would be a structure or a
// charter where you forget in order to survive, and the Threads argue over what to give up. Bend: at
// the horizon's temperature the real amounts are absurdly small, so the game would scale them up and
// say so.").
//
// The physics: erasing a bit costs at least kT ln 2 (Landauer 1961), and a memory whose contents we
// know is worth as much work, let go to noise (Szilard 1929; Bennett 1982: a blank tape is fuel). At
// the de Sitter horizon's 2.2 × 10⁻³⁰ K that is about 2 × 10⁻⁵³ J a bit: an archive of 10³⁰ bits
// would give 2 × 10⁻²³ J, nothing worth having. The game scales it up beyond reason, and says so.
//
// A Szilard Engine burns what the archive holds: each takes ENGINE_CONTINUITY of Continuity a turn
// and gives its energy for it, scaled by how much is left to burn (an archive burned down to nothing
// gives nothing). What we give up first is the Threads' argument ("What Shall We Forget?",
// civ.flags.forget_what): the copies we hold twice (safest, least), the oldest memories (the Dusk and
// its stars: the Kin object), or what each of us alone remembers (the most: the Echoes object).

import type { GameState } from '../types';
import { colonies } from './util';
import { calendarEra } from '../fate';

/** Continuity an engine burns a turn, before the choice of what to forget. */
export const ENGINE_CONTINUITY = 0.8;

/** What we give up first: its share of the engines' yield, and of their Continuity cost. */
export const FORGET: Record<number, { name: string; yield: number; cost: number }> = {
  1: { name: 'only what is held twice', yield: 0.6, cost: 0.5 },
  2: { name: 'the oldest memories', yield: 1, cost: 1 },
  3: { name: 'what each of us remembers alone', yield: 1.6, cost: 1.6 },
};

/** The choice made (civ.flags.forget_what), or the safest until the Threads have argued it out. */
export function forgetting(state: GameState): (typeof FORGET)[number] {
  return FORGET[state.civ.flags.forget_what ?? 1] ?? FORGET[1];
}

/** Our Szilard Engines standing. */
export function engines(state: GameState): number {
  let n = 0;
  for (const c of colonies(state)) n += c.structures.szilard_engine ?? 0;
  return n;
}

/** An engine's yield now, as a share of its amount: what is left to burn, by the choice. Nothing outside the Dark Era (the archive is warm enough to keep). */
export function szilardYield(state: GameState): number {
  if (calendarEra(state) !== 'dark') return 0;
  return Math.max(0, Math.min(1, state.civ.continuity / 100)) * forgetting(state).yield;
}

/** What our engines take from Continuity this turn (continuity.ts). */
export function szilardContinuity(state: GameState): number {
  if (calendarEra(state) !== 'dark' || state.civ.continuity <= 0) return 0;
  return engines(state) * ENGINE_CONTINUITY * forgetting(state).cost;
}
