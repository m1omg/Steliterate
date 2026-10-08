// What time it is, and what the age is called. Two things share the name "era":
// - the calendar: the Tide that sets the turns (eras.ts) and the physics that happens on fixed
//   dates (the galaxy evaporating, embers fading, black holes evaporating);
// - the age the player sees (state.era): its intro, music, art, events, and what belongs to it.
// Each age is named for the warmest thing left: the last stars, the dead stars, the black holes,
// then nothing warmer than the sky. The Degenerate Age ends when the last things warm of their
// own accord, the neutron stars, fall below the faint glow of the black holes, and when that
// happens depends on the fate of matter (DEGENERATE_END). The calendar does not move: physics and
// the Tide read it, the story reads the age.

import { ERA_BY_ID } from './eras';
import type { EraId, Fate, GameState } from './types';

/** The fate of matter (saves before version 3 follow protonsDecay). */
export function fateOf(state: GameState): Fate {
  return state.fate ?? (state.protonsDecay ? 'decay' : 'stable');
}

/**
 * Do we know the fate of matter? Chosen at the start, found by the Proton Question, shown by the
 * universe (the neutron stars tell the fates apart near η 30), or past the Degenerate Age.
 */
export function fateKnown(state: GameState): boolean {
  return state.settings.protonFate !== 'unknown' || state.civ.techs.includes('proton_question') || state.civ.flags.fate_known !== undefined || ERA_BY_ID[state.era].index >= 2;
}

/**
 * Where the Degenerate Age ends (η), by fate: when the neutron stars, the last things warm of their
 * own accord, fall below the glow of the black holes. If protons decay their warmth holds them up
 * until the matter is gone (the Great Decay, η 39); if matter is stable they cool past the holes
 * near η 30; under curvature radiation they glow faintly until they burst near η 68.
 */
export const DEGENERATE_END: Record<Fate, number> = { decay: 39, stable: 30, curvature: 68 };

/** When ordinary matter is gone (η), by fate: never, if it is stable. */
export const MATTER_END: Record<Fate, number> = { decay: 39, stable: Infinity, curvature: 89.5 };

/** Near η 30 the neutron stars show the fate of matter, if no one has found it out before. */
export const FATE_SHOWN_AT = 30;

/** Is ordinary matter gone (dissolved at the Great Decay, or evaporated at the Great Evaporation)? */
export function matterGone(state: GameState): boolean {
  if (state.civ.flags.matter_gone !== undefined) return true;
  return fateOf(state) === 'decay' && ERA_BY_ID[calendarEra(state)].index >= 2;
}

/**
 * The calendar's age: which Tide sets the turns, and which fixed-date physics applies. The Dusk
 * and the Dark are the same on both; between them the calendar turns at 10^40 years whatever the
 * fate (if protons decay, the age turns with it).
 */
export function calendarEra(state: GameState): EraId {
  if (state.era === 'dusk' || state.era === 'dark' || fateOf(state) === 'decay') return state.era;
  return state.years < ERA_BY_ID.blackhole.startYears ? 'degenerate' : 'blackhole';
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

/** Has the age the player sees run its course (the Degenerate Age ends where the fate says)? */
export function ageOver(state: GameState): boolean {
  const d = ERA_BY_ID[state.era];
  if (state.era === 'dark') return Math.log10(state.eta) >= d.endEta;
  if (state.era === 'degenerate') return state.eta >= DEGENERATE_END[fateOf(state)];
  return state.eta >= d.endEta;
}

/**
 * Where the calendar turns without the age (a fate other than decay): at η 39 it skips to 10^40
 * years and the Black Hole Age's Tide, as it always has, while the age goes on being what it is.
 */
export function calendarTurnDue(state: GameState): boolean {
  return fateOf(state) !== 'decay' && (state.era === 'degenerate' || state.era === 'blackhole') && state.years < ERA_BY_ID.blackhole.startYears && state.eta >= ERA_BY_ID.degenerate.endEta;
}
