// What the late Dark Era's noise makes (7 Nov, the player's "Implement:" of the 4 Nov brainstorm). In
// the de Sitter horizon's warmth, 2.2 × 10⁻³⁰ K, anything that can happen eventually does, the
// smaller the sooner: a thing of energy E appears out of nothing about once in e^(E/kT) of the
// horizon's own times, so its date λ = log10 η is near log10 E + 52 (E in joules; our own rough
// reckoning by the Boltzmann factor, not a published one). Whether such fluctuations happen at all
// in a vacuum that never changes is debated (Boddy, Carroll & Pollack 2014); the game says so.
// - echoes, the player's alone and words only, foreshadowing the Recurrence: a voice (λ 31: some 10⁴
//   radio photons at 100 MHz), a page of our first record (λ 43: 10⁴ bits in electron–positron
//   pairs), our first world's sky (λ 70: a few cubic metres of its air) and a settlement we lost
//   (λ 78: 10⁹ kg). Each comes once, as its date passes;
// - minds out of nothing from about 10^(10⁵⁰) years (Linde 2007; a kilogram of brain by the same
//   factor would take 10^(10⁶⁹)): the event A Mind From Nowhere, then Many Minds, and under the
//   charter The Unbidden, minds held near our Error-Correction Arrays wake as Echoes;
// - a cloud out of nothing at λ 99.4 (a Sun's mass, 1.8 × 10⁴⁷ J), big enough to collapse and light:
//   near our capital (a bend: anywhere in the horizon, and mostly black holes at that mass, on the
//   same date to this clock's precision), once, its whole life within the turn, a flash for Burst
//   Catchers (turn.ts handleNotes), its own film, and a turn that stops at its date (flare.ts).
// Nothing is drawn: every date is fixed.

import { CLOUD_LAMBDA, ERA_BY_ID } from '../eras';
import type { EvolutionNote } from '../physics';
import type { Body, GameState, LostPlace } from '../types';
import { capacity } from './economy';
import { queueEvent } from './events';
import { computeMods } from './mods';
import { capital, colonies, hasCharter, log } from './util';

/** The echoes' dates, as λ = log10 η. */
export const ECHO_DATES = { voice: 31, page: 43, sky: 70, lost: 78 } as const;
/** Minds out of nothing from here (Linde 2007), and many of them a little later. */
export const MINDS_FROM = 50;
export const MANY_MINDS_FROM = 52;
/** All the light of a Sun-like star's life (J): 3.8 × 10²⁶ W for some 10¹⁰ years. */
export const CLOUD_JOULES = 1.2e44;

const lam = (eta: number) => Math.log10(Math.max(1, eta));
/** Does a turn from η `from` to η `to` pass λ `at`? */
const passes = (from: number, to: number, at: number) => lam(from) < at && lam(to) >= at - 1e-9;

/** Our first world (its record, even if the world is long gone), if any. */
export function firstWorld(state: GameState): Body | undefined {
  const home = state.systems[state.civ.homeSystemId];
  const near = home?.bodies.map((id) => state.bodies[id]).find((b) => b?.traits.includes('homeworld'));
  return near ?? Object.values(state.bodies).find((b) => b.traits.includes('homeworld') && b.systemId === state.civ.homeSystemId);
}

/** The first line of our record, word for word as the game began it (newGame.ts). */
export function foundingLine(state: GameState): string {
  const hw = firstWorld(state)?.name ?? state.settings.homeName;
  const star = state.systems[state.civ.homeSystemId]?.name ?? 'our star';
  return state.settings.interregnum
    ? `${state.settings.civName}. ${hw}, a young world of ${star}, whose star will not last. The Twilight Interregnum begins.`
    : `${state.settings.civName}. ${hw}, the last living world of ${star}. The long dusk begins.`;
}

/** The settlement we lost that a fluctuation reassembles: our first world's, if we lost it, else the first lost. From the record, or a game saved before it from the log's lines. */
export function lostToRemember(state: GameState): LostPlace | null {
  let lost: LostPlace[] = state.civ.lostPlaces ?? [];
  if (!lost.length) {
    lost = [];
    for (const e of state.civ.log) {
      const m = /^(.+?) is lost: (.+)$/.exec(e.text);
      if (m) lost.push({ name: m[1], turn: e.turn, era: e.era, why: m[2] });
    }
  }
  if (!lost.length) return null;
  const hw = firstWorld(state)?.name;
  return lost.find((x) => x.name === hw) ?? lost[0];
}

/** A civilization we knew that is gone, for the voice (by name), or none. */
function goneWeKnew(state: GameState): string | null {
  const v = Object.values(state.survivors).find((x) => x.contact && !x.alive && x.fate !== 'absorbed');
  return v?.name ?? null;
}

/** The player's echoes this turn passes the dates of (queued as events, once each; they change nothing). */
export function echoesOfThePast(state: GameState, from: number, to: number) {
  if (state.civ.id !== state.player || state.era !== 'dark') return;
  if (passes(from, to, ECHO_DATES.voice)) {
    const who = goneWeKnew(state);
    queueEvent(state, 'echo_voice', who ? { who } : {});
  }
  if (passes(from, to, ECHO_DATES.page)) queueEvent(state, 'echo_page');
  if (passes(from, to, ECHO_DATES.sky)) queueEvent(state, 'echo_sky');
  if (passes(from, to, ECHO_DATES.lost)) {
    const l = lostToRemember(state);
    if (l) queueEvent(state, 'echo_lost', { name: l.name, why: l.why, era: ERA_BY_ID[l.era]?.name ?? '' });
  }
}

/**
 * Minds out of nothing (the player's): the first as the turn passes 10^(10⁵⁰) years (A Mind From
 * Nowhere), then, a turn or more later, many (Many Minds). Scripted, so neither is left to chance.
 */
export function mindsOutOfNothing(state: GameState, from: number, to: number) {
  if (state.civ.id !== state.player || state.era !== 'dark') return;
  if (passes(from, to, MINDS_FROM)) queueEvent(state, 'mind_from_nowhere');
  const first = state.civ.fired.mind_from_nowhere;
  if (lam(to) >= MANY_MINDS_FROM && first !== undefined && first < state.turn) queueEvent(state, 'many_minds');
}

/** Where the cloud lights: our capital's system (or our first star's), a bend the Codex states. */
export function cloudSystem(state: GameState): string | null {
  const cap = capital(state);
  return cap?.systemId ?? state.civ.homeSystemId ?? null;
}

/** Has the cloud lit (the player's flag)? */
export function cloudLit(state: GameState): boolean {
  const civ = state.civs?.[state.player] ?? state.civ;
  return civ.flags.cloud_lit !== undefined;
}

/** The cloud, once, as the turn passes its date: a note for every civilization (turn.ts handleNotes). */
export function cloudNotes(state: GameState, from: number, to: number): EvolutionNote[] {
  if (cloudLit(state) || !passes(from, to, CLOUD_LAMBDA)) return [];
  const where = cloudSystem(state);
  if (!where) return [];
  const civ = state.civs?.[state.player] ?? state.civ;
  civ.flags.cloud_lit = state.turn;
  return [{ systemId: where, kind: 'cloud' }];
}

/**
 * The Unbidden (data/charters.ts): from about 10^(10⁵⁰) years, minds out of nothing are held near
 * our Error-Correction Arrays and wake as Echoes, up to one a turn for each array, where its
 * settlement has Echo room free. Returns how many were held.
 */
export function holdTheUnbidden(state: GameState, eta: number): number {
  if (!hasCharter(state, 'the_unbidden') || lam(eta) < MINDS_FROM) return 0;
  const mods = computeMods(state);
  let held = 0;
  const where: string[] = [];
  for (const c of colonies(state)) {
    const arrays = c.structures.preservation_array ?? 0;
    if (!arrays) continue;
    const k = Math.min(arrays, Math.max(0, capacity(state, c, mods).echoes - c.pops.echoes));
    if (k <= 0) continue;
    c.pops.echoes += k;
    held += k;
    where.push(c.name);
  }
  if (held > 0) {
    state.civ.flags.unbidden = (state.civ.flags.unbidden ?? 0) + held;
    log(state, `${held === 1 ? 'A mind' : `${held} minds`} out of nothing ${held === 1 ? 'was' : 'were'} held at ${where.length > 2 ? `${where.slice(0, 2).join(', ')} and ${where.length - 2} more` : where.join(' and ')}, and woke as ${held === 1 ? 'one of our Echoes' : 'Echoes of ours'} (The Unbidden).`, 'good');
  }
  return held;
}

/** Arrays of ours standing (for holding a mind out of nothing). */
export function arraysStanding(state: GameState): number {
  let n = 0;
  for (const c of colonies(state)) n += c.structures.preservation_array ?? 0;
  return n;
}
