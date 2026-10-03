import { STRUCTURE_BY_ID } from '../data/structures';
import { eta, formatYears, stepTime, type TimeStep } from '../eras';
import { bodyClimate, primaryLuminosity } from '../physics';
import type { Body, Colony, GameState, StarSystem } from '../types';
import { colonies } from './util';

// A red dwarf's last flare. At the end of its life a red dwarf does not swell into a giant: it
// heats up and shrinks into a blue dwarf for a few billion years, a few hundred times brighter
// than before, then collapses into a white dwarf (Adams, Laughlin & Graves 2004). Late in the
// Dusk a turn lasts far longer than the whole flare, so without help it would come and go
// between two turns. So the turn stops the moment one of our stars leaves the main sequence,
// and we may choose to keep time with the flare: turns pinned to a sixth of it, lived in full.

/** Turns a flare lasts when we keep time with it. */
export const FLARE_TURNS = 6;
/** Kin one night-side shelter holds through a flare. */
export const SHELTER_CAP = 3;
export const SHELTER_MAX = 4;
/** Matter per emergency shelter dug when the flare begins. */
export const SHELTER_MATTER = 10;

/** Above this even the night side is too hot to live on (about 67 °C). */
export const SCORCH_K = 340;

/** Too hot to live on anywhere on the surface, even on the night side. */
export function scorched(state: GameState, b: Body): boolean {
  const sys = state.systems[b.systemId];
  if (!sys || sys.primary.kind !== 'blue_dwarf' || b.rogue) return false;
  const c = bodyClimate(state, b);
  return (c.night ?? c.mean) > SCORCH_K;
}

/** Kin a flare-thawed ocean holds without domes. */
export const THAW_ROOM = 5;

/**
 * A frozen world with water that a flaring star melts into open sea (273 K up to boiling). Where
 * it stays below SCORCH_K the sea is warm enough to live by, for as long as the flare lasts.
 * Computed from the climate, never stored: when the star collapses it freezes again.
 */
export function thawed(state: GameState, b: Body): 'warm' | 'hot' | null {
  const sys = state.systems[b.systemId];
  if (!sys || sys.primary.kind !== 'blue_dwarf' || b.rogue || b.dissolved) return null;
  if (!['ice', 'ocean_ice', 'super_earth', 'barren'].includes(b.kind) || (b.water ?? 0) < 0.1) return null;
  const t = bodyClimate(state, b).mean;
  if (t < 273 || t >= 373) return null;
  return t <= SCORCH_K ? 'warm' : 'hot';
}

/** The earliest of our settled stars to leave the main sequence in (from, to], if any. */
function flareDue(state: GameState, from: number, to: number): StarSystem | null {
  let best: StarSystem | null = null;
  const seen = new Set<string>();
  for (const c of colonies(state)) {
    if (seen.has(c.systemId)) continue;
    seen.add(c.systemId);
    const sys = state.systems[c.systemId];
    const p = sys?.primary;
    if (!p || p.kind !== 'red_dwarf' || !p.blueAt || p.blueAt <= from || p.blueAt > to) continue;
    if (!best || p.blueAt < best.primary.blueAt!) best = sys;
  }
  return best;
}

/**
 * Still keeping time with a flare? Within a millionth of a flare turn of its end counts as over:
 * six additions of the step can fall an ulp or two short of it, which gave a seventh turn.
 */
function keepingTime(state: GameState): boolean {
  const f = state.civ.flags;
  return !!f.flare_until && !!f.flare_step && state.years < f.flare_until - f.flare_step * 1e-6;
}

/** Are we keeping time with a flare? Returns which of its turns comes next (1-based), or 0. */
export function flareClock(state: GameState): { turn: number; of: number; system: string } | null {
  const f = state.civ.flags;
  if (!keepingTime(state)) return null;
  const sys = Object.values(state.systems).find((s) => s.primary.kind === 'blue_dwarf' && s.primary.whiteAt === f.flare_until);
  const done = Math.round((state.years - (f.flare_until - f.flare_step * FLARE_TURNS)) / f.flare_step);
  return { turn: Math.min(FLARE_TURNS, done + 1), of: FLARE_TURNS, system: sys?.name ?? 'our star' };
}

/**
 * The settled star whose last flare cuts the coming turn short at this pace, if any: the turn
 * stops the moment it leaves the main sequence, so a slower pace cannot take us past it.
 */
export function flareStop(state: GameState, pace = state.civ.pace): StarSystem | null {
  const step = stepTime(state.era, state.years, state.eta, pace, state.settings.length);
  if (state.era !== 'dusk' || !isFinite(step.years) || keepingTime(state)) return null;
  return flareDue(state, state.years, step.years);
}

// New stars of the Degenerate Age. A collision star (two brown dwarfs merged) burns for one to ten
// trillion years and a helium star (two white dwarfs merged) for a few hundred million, while a
// turn here soon spans trillions of years: such a star would light and go out between two turns.
// So each lights as its turn ends (physics.ts), and we may keep time with one, as with a flare:
// its life in STAR_TURNS turns, whatever the pace, each lived in full. One star at a time: a new
// star lights about as often as one goes out, so a clock that passed from star to star would
// hold the age still.

/** Turns a new star burns when we keep time with it (as many as a flare). */
export const STAR_TURNS = 6;

/**
 * Turns left on the new star's clock, this one included (0: none running). Counted back from its
 * end rather than added up from its start, so that rounding can neither add a turn nor stall one:
 * a few hundred million years is a sliver of 10^20.
 */
function starTurnsLeft(state: GameState): number {
  const f = state.civ.flags;
  if (!f.star_until || !f.star_step) return 0;
  return Math.max(0, Math.round((f.star_until - state.years) / f.star_step));
}

function keepingStarTime(state: GameState): boolean {
  return starTurnsLeft(state) >= 1;
}

/** The clock has run out (or its numbers no longer make sense): forget it. */
export function clearStarClock(state: GameState) {
  const f = state.civ.flags;
  if ((f.star_until || f.star_step) && !keepingStarTime(state)) {
    delete f.star_until;
    delete f.star_step;
  }
}

/**
 * A clock turn must be long enough for the calendar to tell it apart: years are doubles, good
 * to about 16 digits, so a step shorter than a trillionth of the age would round away.
 */
const STAR_STEP_MIN = 1e-12;

function isNewStar(sys: StarSystem): boolean {
  return sys.primary.kind === 'collision_star' || sys.primary.kind === 'helium_star';
}

/**
 * Could we keep time with this new star? While it burns, and no other clock runs, and only where
 * it would do something: at our pace it would burn for fewer turns than keeping time gives.
 */
export function starClockOffer(state: GameState, sys: StarSystem | undefined): boolean {
  const p = sys?.primary;
  if (!sys || !p || state.era !== 'degenerate' || sys.gone || !isNewStar(sys) || keepingStarTime(state)) return false;
  if (!p.diesAt || p.diesAt <= state.years) return false;
  const left = p.diesAt - state.years;
  if (left / STAR_TURNS < state.years * STAR_STEP_MIN) return false;
  const next = stepTime(state.era, state.years, state.eta, state.civ.pace, state.settings.length).turnLength;
  return left < next * STAR_TURNS;
}

/** Keep time with a new star until it burns out: its remaining life in STAR_TURNS turns. */
export function keepTimeWithStar(state: GameState, systemId: string): boolean {
  const sys = state.systems[systemId];
  if (!starClockOffer(state, sys)) return false;
  state.civ.flags.star_until = sys.primary.diesAt!;
  state.civ.flags.star_step = (sys.primary.diesAt! - state.years) / STAR_TURNS;
  return true;
}

/** Are we keeping time with a new star? Which of its turns comes next (1-based), and whose. */
export function starClock(state: GameState): { turn: number; of: number; system: string; systemId: string | null } | null {
  const f = state.civ.flags;
  const left = starTurnsLeft(state);
  if (left < 1) return null;
  const sys = Object.values(state.systems).find((s) => isNewStar(s) && s.primary.diesAt === f.star_until);
  return { turn: Math.max(1, STAR_TURNS - left + 1), of: STAR_TURNS, system: sys?.name ?? 'the new star', systemId: sys?.id ?? null };
}

/**
 * The coming turn's time step. As the calendar's, except that a turn stops at the moment one of
 * our stars leaves the main sequence, and while we keep time with a flare its turns are pinned
 * to a sixth of it. While we keep time with a new star (Degenerate Age) its turns are a sixth of
 * what was left of its life, whatever the pace, the last ending as it burns out.
 */
export function turnStep(state: GameState, pace = state.civ.pace): TimeStep {
  const step = stepTime(state.era, state.years, state.eta, pace, state.settings.length);
  const left = state.era === 'degenerate' && isFinite(step.years) ? starTurnsLeft(state) : 0;
  if (left >= 1) {
    const f = state.civ.flags;
    const end = left === 1 ? f.star_until : f.star_until - f.star_step * (left - 1);
    if (end > state.years) return { years: end, eta: eta(end), turnLength: end - state.years };
  }
  if (state.era !== 'dusk' || !isFinite(step.years)) return step;
  let end = step.years;
  const f = state.civ.flags;
  if (keepingTime(state)) {
    // the last of its turns ends exactly when the flare does, not an ulp or two short of it
    const next = state.years + f.flare_step;
    end = Math.min(end, next >= f.flare_until - f.flare_step * 1e-6 ? f.flare_until : next);
  }
  const due = flareDue(state, state.years, end);
  if (due) end = due.primary.blueAt!;
  if (end === step.years) return step;
  return { years: end, eta: eta(end), turnLength: end - state.years };
}

/**
 * The share of a Tide turn the coming turn lives, which its yields scale by: 10^-pace, as the
 * calendar has it, except at a flare, which sets the length of the turn whatever the pace (so a
 * slower pace would buy more without more time passing). While we keep time with a flare each of
 * its turns is lived in full: one Tide turn. A turn cut short when a star begins to flare pays as
 * one Tide turn at most. (Paying it only for the time it covers would still charge a whole turn's
 * upkeep, which does not shrink with a short turn, for a fraction of its income.) A turn kept
 * with a new star is lived in full in the same way.
 */
export function livedShare(state: GameState, pace = state.civ.pace, step: TimeStep = turnStep(state, pace)): number {
  const share = Math.pow(10, -pace);
  if (state.era === 'degenerate' && keepingStarTime(state)) return 1;
  if (state.era !== 'dusk' || !isFinite(step.turnLength)) return share;
  if (keepingTime(state)) return 1;
  const planned = stepTime(state.era, state.years, state.eta, pace, state.settings.length).turnLength;
  return planned > 0 && step.turnLength < planned ? Math.min(share, 1) : share;
}

/**
 * The coming turns as they will really fall at this pace (turnStep, one after another): pinned
 * to a flare or a new star while we keep time with one, and stopping when a settled star begins
 * its own flare (which this assumes is let pass). `each` sees every turn and returns true once it
 * has seen enough; the result is that turn's number, or Infinity. Estimates only: the state is
 * not changed.
 */
export function stepTurns(state: GameState, pace: number, maxTurns: number, each: (turnLength: number, endYears: number) => boolean): number {
  const sim: GameState = { ...state, civ: { ...state.civ, flags: { ...state.civ.flags } } };
  for (let n = 1; n <= maxTurns; n++) {
    const step = turnStep(sim, pace);
    if (each(step.turnLength, step.years)) return n;
    if (!isFinite(step.years)) return Infinity;
    sim.years = step.years;
    sim.eta = step.eta;
    const f = sim.civ.flags;
    if (f.flare_until && sim.years >= f.flare_until) {
      delete f.flare_until;
      delete f.flare_step;
    }
    clearStarClock(sim);
  }
  return Infinity;
}

/** Turns until `target` years at this pace, counted as they will really fall (see stepTurns). */
export function turnsUntilYears(state: GameState, target: number, pace = state.civ.pace, maxTurns = 400): number {
  if (!isFinite(target)) return Infinity;
  if (target <= state.years) return 0;
  return stepTurns(state, pace, maxTurns, (_len, end) => end >= target);
}

/** What a flare does to one world: its temperatures before and during. */
export function flareHeat(state: GameState, b: Body): { before: ReturnType<typeof bodyClimate>; during: ReturnType<typeof bodyClimate>; ratio: number } {
  const p = state.systems[b.systemId].primary;
  const kind = p.kind;
  p.kind = 'red_dwarf';
  const before = bodyClimate(state, b);
  const lr = primaryLuminosity(p, state.years, state.era);
  p.kind = 'blue_dwarf';
  const during = bodyClimate(state, b);
  const lb = primaryLuminosity(p, state.years, state.era);
  p.kind = kind;
  return { before, during, ratio: lr > 0 ? lb / lr : Infinity };
}

/** Kin a settlement can hold indoors (domes, shelters, warrens), when nobody can live outside. */
export function kinRoomIndoors(c: Colony): number {
  let r = 0;
  for (const [id, n] of Object.entries(c.structures)) r += (STRUCTURE_BY_ID[id]?.cap?.kin ?? 0) * n;
  return r;
}

/** Emergency shelters the Kin of a flaring system still need, beyond the room they have indoors. */
export function sheltersNeeded(state: GameState, systemId: string): { colonyId: string; n: number; short: number }[] {
  const out: { colonyId: string; n: number; short: number }[] = [];
  for (const c of colonies(state)) {
    if (c.systemId !== systemId || c.pops.kin <= 0) continue;
    // only where the flare makes the surface unlivable (a far, cold world may stay bearable)
    const b = state.bodies[c.bodyId];
    if (!b || !scorched(state, b)) continue;
    const short = Math.max(0, c.pops.kin - kinRoomIndoors(c));
    const n = Math.min(SHELTER_MAX - (c.structures.night_shelter ?? 0), Math.ceil(short / SHELTER_CAP));
    if (n > 0) out.push({ colonyId: c.id, n, short });
  }
  return out;
}

/** Dig emergency shelters on the night side, as many as we can pay for. */
export function digShelters(state: GameState, systemId: string): { built: number; missing: number } {
  let built = 0;
  let missing = 0;
  for (const { colonyId, n } of sheltersNeeded(state, systemId)) {
    const c = state.colonies[colonyId];
    const k = Math.min(n, Math.floor(state.civ.matter / SHELTER_MATTER));
    if (k > 0) {
      c.structures.night_shelter = (c.structures.night_shelter ?? 0) + k;
      state.civ.matter -= k * SHELTER_MATTER;
      built += k;
    }
    missing += n - k;
  }
  return { built, missing };
}

/** Quicken to the flare's own clock until its star collapses. */
export function keepTimeWithFlare(state: GameState, systemId: string) {
  const p = state.systems[systemId]?.primary;
  if (!p || p.kind !== 'blue_dwarf' || !p.whiteAt || p.whiteAt <= state.years) return;
  state.civ.flags.flare_until = p.whiteAt;
  state.civ.flags.flare_step = (p.whiteAt - state.years) / FLARE_TURNS;
}

/** The event's numbers for a star that has just begun to flare. */
export function flareData(state: GameState, sys: StarSystem): Record<string, string | number> {
  const p = sys.primary;
  const mine = colonies(state).filter((c) => c.systemId === sys.id);
  const living = ['eyeball', 'terran', 'super_earth', 'ocean_ice'];
  const world =
    mine.map((c) => state.bodies[c.bodyId]).filter((b) => b && living.includes(b.kind)).sort((a, b) => b.vitality - a.vitality)[0] ??
    state.bodies[mine.sort((a, b) => b.pops.kin - a.pops.kin)[0]?.bodyId ?? ''];
  const span = (p.whiteAt ?? state.years) - state.years;
  const next = stepTime(state.era, state.years, state.eta, state.civ.pace, state.settings.length).turnLength;
  const d: Record<string, string | number> = {
    systemId: sys.id,
    star: sys.name,
    span: formatYears(span),
    next: formatYears(next),
    turns: Math.max(1, Math.round(span / next)),
    clock: span < next * 3 ? 1 : 0,
  };
  // the warmth reaches farther out: frozen worlds that melt into open sea while it lasts
  const seas = sys.bodies.map((id) => state.bodies[id]).filter((b) => b && thawed(state, b));
  if (seas.length) {
    const k = (b: Body) => {
      const h = flareHeat(state, b);
      return `${b.name} (${Math.round(h.before.mean)} K until now, about ${Math.round(h.during.mean)} K while it burns)`;
    };
    const warm = seas.filter((b) => thawed(state, b) === 'warm');
    const hot = seas.filter((b) => thawed(state, b) === 'hot');
    if (warm.length) d.warm = warm.map(k).join(' and ');
    if (hot.length) d.hot = hot.map(k).join(' and ');
  }
  // every other world we live on in this system, and what the flare does to it
  const others = [...new Set(mine.map((c) => c.bodyId))]
    .map((id) => state.bodies[id])
    .filter((b) => b && b !== world && b.kind !== 'deep' && !thawed(state, b));
  if (others.length) {
    d.others = others
      .map((b) => {
        const h = flareHeat(state, b);
        const t = `${b.name}, ${Math.round(h.before.mean)} K to about ${Math.round(h.during.mean)} K`;
        if (scorched(state, b)) return t;
        // an airless world locked to its star: nothing carries the heat round to the night side
        return h.during.night !== undefined ? `${t}, though its night side stays at about ${Math.round(h.during.night)} K` : `${t} (still bearable)`;
      })
      .join('; ');
  }
  if (world) {
    const h = flareHeat(state, world);
    const k = (t: number | undefined) => Math.round(t ?? 0);
    Object.assign(d, {
      world: world.name,
      bodyId: world.id,
      ratio: Math.round(h.ratio),
      mean0: k(h.before.mean),
      mean1: k(h.during.mean),
      day1: k(h.during.day ?? h.during.mean),
      night0: k(h.before.night ?? h.before.mean),
      night1: k(h.during.night ?? h.during.mean),
    });
  }
  return d;
}
