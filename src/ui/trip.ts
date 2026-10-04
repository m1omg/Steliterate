import { formatYearsShort } from '../game/eras';
import { travelEstimate } from '../game/sim/fleets';
import type { Mods } from '../game/sim/mods';
import type { GameState } from '../game/types';

// Trip times, said the same way everywhere: turns at the current pace, then the cosmic time
// the flight takes (which no pace changes).

export const TRIP_TIP =
  'Turns at your current pace, then the cosmic time the flight takes. Every turn is longer than the last, so a far trip needs fewer turns than distance ÷ today’s turn length suggests; the ship itself never outruns light.';

/** "~26t · 2.9 Myr" (or "~26 turns · 2.9 Myr" in full). */
export function tripLabel(s: GameState, ly: number, mods: Mods, full = false): string {
  const t = travelEstimate(s, ly, mods);
  return `~${t.turns}${full ? (t.turns === 1 ? ' turn' : ' turns') : 't'} · ${formatYearsShort(t.years)}`;
}
