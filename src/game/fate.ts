// What time it is, and what the age is called. Two things share the name "era":
// - the calendar: the Tide that sets the turns (eras.ts) and the physics that happens on fixed
//   dates (the galaxy evaporating, embers fading, black holes evaporating);
// - the age the player sees (state.era): its intro, music, art, events, and what belongs to it.
// They are the same today. When the fate of matter moves a boundary between ages they part, so
// every rule reads the one it means: physics and the Tide the calendar, the story the age.

import { ERA_BY_ID } from './eras';
import type { EraId, GameState } from './types';

/** The calendar's age: which Tide sets the turns, and which fixed-date physics applies. */
export function calendarEra(state: GameState): EraId {
  return state.era;
}

/**
 * Has the game reached this age, by the calendar or by the age the player sees? What belongs to
 * an age (research, structures, charters) opens with either, so a boundary that moves never makes
 * anything arrive later.
 */
export function ageReached(state: GameState, era: EraId): boolean {
  const i = ERA_BY_ID[era].index;
  return i <= ERA_BY_ID[state.era].index || i <= ERA_BY_ID[calendarEra(state)].index;
}

/** Is it one of these ages, by the calendar or by the age the player sees? (Works name theirs.) */
export function inAge(state: GameState, eras: readonly EraId[]): boolean {
  return eras.includes(state.era) || eras.includes(calendarEra(state));
}
