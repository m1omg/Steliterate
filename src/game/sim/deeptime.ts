// The stable fate's late game (the new version, part 3-6). Where protons are stable, matter
// outlasts the black holes, as cold as the sky, but not for ever:
// - from 10^1100 years the heaviest dead stars explode, as pycnonuclear fusion turns their cores
//   to iron and lowers their Chandrasekhar limit: black dwarfs of 1.16 to 1.35 M☉, the heaviest
//   first, 10^1100 years at 1.35, 10^1600 at 1.24, 10^32000 at 1.16, about 1% of all stars
//   (Caplan 2020, MNRAS 497, 4357);
// - by 10^1500 years everything has fused to iron by tunnelling: nothing is left to fuse (Dyson
//   1979, "Time without end");
// - between 10^(10^26) and 10^(10^76) years matter tunnels into black holes, which evaporate at
//   once: any lump, if black holes of the Planck mass can form, or whole stars (Dyson). Which
//   holds is not known: the game takes each system at a time of its own in that span, which no
//   one can foresee (a hash), in a flash that Burst Catchers bank.
// The universe's part is here (no draws: every date is a hash or a mass); what each civilization
// makes of it is in `handleNotes` (turn.ts).

import { STRUCTURE_BY_ID } from '../data/structures';
import { ERA_BY_ID, stepTime } from '../eras';
import { fateOf } from '../fate';
import type { EvolutionNote } from '../physics';
import { hashSeed } from '../rng';
import type { GameState, Primary, StarSystem } from '../types';
import { allColonies, formOf } from './util';

/** About one white dwarf in this many begins the game heavy enough to explode one day (about 1% of the galaxy's stars, as Caplan counts them). */
export const HEAVY_ONE_IN = 30;
/** The lightest that can explode (a pure iron-56 dwarf's Chandrasekhar mass) and the heaviest Caplan follows. */
export const HEAVY_MIN = 1.16;
export const HEAVY_MAX = 1.35;
/** Caplan's three: a dwarf's mass (M☉), and log10 of the η it explodes at. */
const SN_POINTS: readonly (readonly [number, number])[] = [
  [1.16, Math.log10(32000)],
  [1.24, Math.log10(1600)],
  [1.35, Math.log10(1100)],
];
/** By this η everything has fused to iron. */
export const IRON_ETA = 1500;
/** Tunnelling collapse: from and to this log10 of η (10^(10^26) to 10^(10^76) years). */
export const COLLAPSE_FROM = 26;
export const COLLAPSE_TO = 76;

const unit = (key: string) => (hashSeed(key) % 1000003) / 1000003;

/**
 * At generation, after every draw: about one white dwarf in HEAVY_ONE_IN is born HEAVY_MIN to
 * HEAVY_MAX M☉ (by a hash of its mass draw; nothing drawn, so every seed keeps its galaxy). Run
 * before the passes that read the stars' temperatures (newGame.ts).
 */
export function heavyDwarfs(state: GameState) {
  for (const s of Object.values(state.systems)) {
    const p = s.primary;
    if (p.kind !== 'white_dwarf' || s.special) continue;
    if (hashSeed(`heavy:${p.mass}`) % HEAVY_ONE_IN !== 0) continue;
    p.mass = HEAVY_MIN + unit(`heavy-mass:${p.mass}`) * (HEAVY_MAX - HEAVY_MIN);
  }
}

/** Will this dead star explode one day, if protons are stable (heavy enough, and not done already)? */
export function willExplode(p: Primary): boolean {
  return (p.kind === 'white_dwarf' || p.kind === 'black_dwarf') && p.mass >= HEAVY_MIN && !p.exploded;
}

/** The η a black dwarf of this mass explodes at (Caplan's three points, interpolated in log η): Infinity below HEAVY_MIN. */
export function supernovaEta(mass: number): number {
  if (mass < HEAVY_MIN) return Infinity;
  const m = Math.min(HEAVY_MAX, mass);
  for (let i = 1; i < SN_POINTS.length; i++) {
    const [m0, l0] = SN_POINTS[i - 1];
    const [m1, l1] = SN_POINTS[i];
    if (m <= m1) return Math.pow(10, l0 + ((m - m0) / (m1 - m0)) * (l1 - l0));
  }
  return Math.pow(10, SN_POINTS[SN_POINTS.length - 1][1]);
}

/** Has everything fused to iron by η (matter stable)? Nothing is left to fuse. */
export function ironAge(state: GameState, eta = state.eta): boolean {
  return fateOf(state) === 'stable' && eta >= IRON_ETA;
}

/** log10 of the η at which this system's matter tunnels into black holes: its own, in COLLAPSE_FROM to COLLAPSE_TO. */
export function collapseLambda(sys: StarSystem): number {
  return COLLAPSE_FROM + unit(`collapse:${sys.id}`) * (COLLAPSE_TO - COLLAPSE_FROM);
}

/** Is there still matter here to collapse: a star that is not nothing, or a world not yet gone? */
export function hasMatter(state: GameState, sys: StarSystem): boolean {
  if (sys.gone) return false;
  if (sys.primary.kind !== 'void') return true;
  return sys.bodies.some((id) => {
    const b = state.bodies[id];
    return !!b && b.kind !== 'deep' && !b.dissolved;
  });
}

/** Has tunnelling collapse begun (matter stable, η past 10^(10^COLLAPSE_FROM))? */
export function collapsing(state: GameState, eta = state.eta): boolean {
  return fateOf(state) === 'stable' && Math.log10(Math.max(1, eta)) >= COLLAPSE_FROM;
}

/**
 * The universe's part of the stable fate's late game, as a turn passes from η `from` to `to`:
 * heavy dwarfs explode (their worlds blown away; an iron-cored dwarf left, as Caplan thinks
 * likelier than a neutron star), everything turns to iron, and systems tunnel into black holes
 * that evaporate at once (star and worlds gone; the Deep stays, for whatever leptonic is there).
 * Returns the notes each civilization's part reads (`handleNotes`); takes no draw.
 */
export function deepTime(state: GameState, from: number, to: number): EvolutionNote[] {
  const notes: EvolutionNote[] = [];
  if (fateOf(state) !== 'stable' || !(to > from)) return notes;
  if (from < IRON_ETA && to >= IRON_ETA && state.flags.iron === undefined) state.flags.iron = state.turn;
  const l0 = Math.log10(Math.max(1, from));
  const l1 = Math.log10(Math.max(1, to));
  for (const sys of Object.values(state.systems)) {
    if (sys.gone) continue;
    const p = sys.primary;
    // black dwarf supernovae
    if (willExplode(p)) {
      const at = supernovaEta(p.mass);
      if (from < at && to >= at) {
        p.exploded = true;
        p.mass = Math.min(p.mass, 1.0);
        p.lum = 0;
        // (a world flung loose from it long before is far away by now)
        for (const id of sys.bodies) {
          const b = state.bodies[id];
          if (b && b.kind !== 'deep' && !b.rogue) b.dissolved = true;
        }
        notes.push({ systemId: sys.id, kind: 'blackdwarf_sn' });
      }
    }
    // tunnelling collapse
    if (l1 >= COLLAPSE_FROM && hasMatter(state, sys)) {
      const at = collapseLambda(sys);
      if (l0 < at && l1 >= at) {
        p.kind = 'void';
        p.lum = 0;
        p.mass = 0;
        p.spin = 0;
        p.spinMax = 0;
        for (const id of sys.bodies) {
          const b = state.bodies[id];
          if (b && b.kind !== 'deep') b.dissolved = true;
        }
        // nothing of matter is left: the system goes, unless something leptonic stays in it (a
        // settlement that made the Passage, or minds on decay-proof substrate, which go on: turn.ts)
        const leptonic = allColonies(state).some((c) => c.systemId === sys.id && (formOf(c) !== 'baryonic' || Object.entries(c.structures).some(([id, n]) => n > 0 && STRUCTURE_BY_ID[id]?.decayProof)));
        if (!leptonic) sys.gone = true;
        notes.push({ systemId: sys.id, kind: 'collapse' });
      }
    }
  }
  if (l1 >= COLLAPSE_TO && state.flags.matter_gone === undefined) state.flags.matter_gone = state.turn;
  return notes;
}

/**
 * Turns until η reaches `eta` in the Dark Era at this pace (stepping the deep-time calendar), up
 * to `max`; Infinity if it will not come within them. Before the Dark Era: Infinity (it is the
 * Dark Era's to count).
 */
export function turnsToEta(state: GameState, eta: number, pace: number, max = 200): number {
  if (state.eta >= eta) return 0;
  if (state.era !== 'dark') return Infinity;
  let years = state.years;
  let now = state.eta;
  for (let n = 1; n <= max; n++) {
    const step = stepTime('dark', years, now, pace, state.settings.length);
    if (step.eta >= eta) return n;
    if (!(step.eta > now)) return Infinity;
    years = step.years;
    now = step.eta;
    if (Math.log10(now) >= ERA_BY_ID.dark.endEta + 0.5) return Infinity;
  }
  return Infinity;
}

/**
 * Turns from the Dark Era's start (η 100) to η `eta` at the Tide, up to `max` (Infinity past
 * them): for a forecast made before the age begins, when `turnsToEta` cannot count yet.
 */
export function darkTurnsAtTide(state: GameState, eta: number, max = 200): number {
  let years = ERA_BY_ID.dark.startYears;
  let now = Math.log10(years);
  for (let n = 1; n <= max; n++) {
    const step = stepTime('dark', years, now, 0, state.settings.length);
    if (step.eta >= eta) return n;
    if (!(step.eta > now)) return Infinity;
    years = step.years;
    now = step.eta;
  }
  return Infinity;
}

/** Turns until tunnelling collapse can begin (λ COLLAPSE_FROM), at this pace. */
export function turnsToCollapse(state: GameState, pace: number): number {
  return turnsToEta(state, Math.pow(10, COLLAPSE_FROM), pace);
}
