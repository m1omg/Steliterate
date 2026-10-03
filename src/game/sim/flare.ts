import { STRUCTURE_BY_ID } from '../data/structures';
import { eta, formatYears, stepTime, type TimeStep } from '../eras';
import { bodyClimate, primaryLuminosity } from '../physics';
import type { Body, Colony, GameState, StarSystem } from '../types';
import { computeMods } from './mods';
import { reserveCapacity } from './storage';
import { colonies, hasTech } from './util';

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
// its life in STAR_TURNS turns, whatever the pace, each lived in full. That is free while our
// next turn is within a hundredfold of its life (we are in tune with it); beyond, our minds must
// quicken that far, which costs energy, once, for every further tenfold, but never more than a
// full store: whoever has filled theirs can keep time with anything. So a slow civilization pays
// more, a quick one less, and a White Fire costs everyone something. One clock at a time, but a
// star that outlasts the one we keep time with may be followed on, its clock beginning as ours
// runs out. That is priced as a fresh clock would be then, from our own pace, and never below
// STAR_FOLLOW_MIN: a new star lights about as often as one goes out, so a clock passed cheaply
// from star to star would hold the age still (freely chained, 300 autoplayed games won 72 times
// against 54, the Degenerate Age lasting 87 turns against 67; with the floor, 59 and 77).

/** Turns a new star burns when we keep time with it (as many as a flare). */
export const STAR_TURNS = 6;
/** Within this many tenfolds of our next turn (a hundredfold) a new star is in tune: free. */
export const STAR_FREE = 2;
/** Energy, once, for each further tenfold our minds must quicken to keep time with a new star. */
export const STAR_ORDER_COST = 250;
/** The least it costs to carry the clock on from one new star to the next (still capped at a full store). */
export const STAR_FOLLOW_MIN = 250;

/** With Quickening, Quick ×10 also works while we keep time: each of the clock's turns splits into this many. */
export const STAR_SPLIT = 10;

/**
 * How many turns each of the new star's clock turns splits into at this pace: STAR_SPLIT with
 * Quickening at a quick pace (each lived as that share of a Tide turn, so the star gives the same
 * light over more turns, each paying its upkeep), else 1. Never finer than the calendar can count.
 */
function starSplit(state: GameState, pace: number): number {
  const f = state.civ.flags;
  if (pace < 1 || !f.star_step || !hasTech(state, 'quickening')) return 1;
  return f.star_step / STAR_SPLIT >= state.years * STAR_STEP_MIN ? STAR_SPLIT : 1;
}

/**
 * Turns left on the new star's clock at this pace, this one included (0: none running). Counted
 * back from its end rather than added up from its start, so that rounding can neither add a turn
 * nor stall one (a few hundred million years is a sliver of 10^20); a turn that starts between
 * two of its steps (the pace changed under Quickening) runs to the next one.
 */
function starTurnsLeft(state: GameState, pace = state.civ.pace): number {
  const f = state.civ.flags;
  if (!keepingStarTime(state)) return 0;
  return Math.max(1, Math.ceil((f.star_until - state.years) / (f.star_step / starSplit(state, pace)) - 1e-6));
}

/** A clock runs until the year its star burns out (every turn of it ends exactly on a sixth, or a sixtieth, counted back from there). */
function keepingStarTime(state: GameState): boolean {
  const f = state.civ.flags;
  return !!f.star_until && !!f.star_step && f.star_until - state.years > f.star_step * 1e-6;
}

/**
 * The clock has run out (or its numbers no longer make sense): forget it, and begin the clock of
 * a star we chose to follow on (`star_next`, the year it burns out), if it still burns.
 */
export function clearStarClock(state: GameState) {
  const f = state.civ.flags;
  if (keepingStarTime(state) || !(f.star_until || f.star_step || f.star_next)) return;
  const next = f.star_next;
  delete f.star_until;
  delete f.star_step;
  delete f.star_next;
  if (next && next > state.years && state.era === 'degenerate') {
    f.star_until = next;
    f.star_step = (next - state.years) / STAR_TURNS;
  }
}

/**
 * A clock turn must be long enough for the calendar to tell it apart: years are doubles, good
 * to about 16 digits, so a step under a ten-trillionth of the age (a few hundred units in the
 * last place) would blur, and a little finer it would round away. Past about η 20 a helium star
 * is that brief: it can only be watched.
 */
const STAR_STEP_MIN = 1e-13;

function isNewStar(sys: StarSystem): boolean {
  return sys.primary.kind === 'collision_star' || sys.primary.kind === 'helium_star';
}

export interface StarTerms {
  /** A clock can be kept with it (price aside). */
  possible: boolean;
  /** Too brief for the calendar to count its turns. */
  brief: boolean;
  /** How many tenfolds our turn (at our own pace, when its clock would begin) exceeds what is left of its life. */
  orders: number;
  /** The energy, once. */
  cost: number;
  /** The star whose clock this one would follow on, if we keep time with another now. */
  after: string | null;
  /** When there is no clock to keep: why. */
  why: 'gone' | 'this' | 'waiting' | 'inside' | 'unneeded' | 'brief' | null;
  /** When its clock would begin, if kept. */
  from: number;
  /** A follow-on priced at its floor, STAR_FOLLOW_MIN, rather than by its tenfolds. */
  floor: boolean;
}

/**
 * What keeping time with this new star would ask of us at our pace. `possible`: it burns, the
 * calendar can count its turns (`brief` when it cannot), and at our own pace it would burn for
 * fewer turns than keeping time gives. While we keep time with another star it can only follow
 * that one on (`after`), if it outlasts it and no other star waits. `orders`: how many tenfolds
 * our turn at our own pace, as its clock would begin, exceeds what is left of its life then.
 * `cost`: the energy that takes, once: nothing within STAR_FREE tenfolds, STAR_ORDER_COST for
 * each further one (a follow-on never less than STAR_FOLLOW_MIN), and at most our whole storage.
 */
export function starClockTerms(state: GameState, sys: StarSystem | undefined): StarTerms {
  const none: StarTerms = { possible: false, brief: false, orders: 0, cost: 0, after: null, why: 'gone', from: state.years, floor: false };
  const p = sys?.primary;
  if (!sys || !p || state.era !== 'degenerate' || sys.gone || !isNewStar(sys)) return none;
  if (!p.diesAt || p.diesAt <= state.years) return none;
  const f = state.civ.flags;
  let from = state.years;
  let after: string | null = null;
  if (keepingStarTime(state)) {
    const kept = starClock(state);
    if (kept?.systemId === sys.id) return { ...none, why: 'this' };
    if (f.star_next) return { ...none, why: 'waiting' };
    if (p.diesAt <= f.star_until) return { ...none, why: 'inside' };
    from = f.star_until;
    after = kept?.system ?? 'the star we keep time with';
  }
  const left = p.diesAt - from;
  if (left / STAR_TURNS < from * STAR_STEP_MIN) return { ...none, brief: true, why: 'brief', after, from };
  const next = stepTime(state.era, from, eta(from), state.civ.pace, state.settings.length).turnLength;
  if (left >= next * STAR_TURNS) return { ...none, why: 'unneeded', after, from };
  const orders = Math.log10(next / left);
  const full = Math.floor(reserveCapacity(state, computeMods(state)));
  const byOrders = Math.ceil(STAR_ORDER_COST * Math.max(0, orders - STAR_FREE));
  const floor = !!after && byOrders < STAR_FOLLOW_MIN;
  return { possible: true, brief: false, orders, cost: Math.min(full, floor ? STAR_FOLLOW_MIN : byOrders), after, why: null, from, floor };
}

/** Could we keep time with this new star now: possible, and its price within our reserve? */
export function starClockOffer(state: GameState, sys: StarSystem | undefined): boolean {
  const t = starClockTerms(state, sys);
  return t.possible && state.civ.energy >= t.cost;
}

/**
 * Keep time with a new star until it burns out: its remaining life in STAR_TURNS turns, the price
 * paid now. While we keep time with another, its clock begins as that one runs out. Returns the
 * energy paid, or null if it cannot be done.
 */
export function keepTimeWithStar(state: GameState, systemId: string): number | null {
  const sys = state.systems[systemId];
  const t = starClockTerms(state, sys);
  if (!t.possible || state.civ.energy < t.cost) return null;
  state.civ.energy -= t.cost;
  if (t.after) {
    state.civ.flags.star_next = sys.primary.diesAt!;
    return t.cost;
  }
  state.civ.flags.star_until = sys.primary.diesAt!;
  state.civ.flags.star_step = (sys.primary.diesAt! - state.years) / STAR_TURNS;
  return t.cost;
}

/**
 * Are we keeping time with a new star? Which of its turns comes next (1-based), how many are left
 * (this one included), whose, and which star we follow on to after it, if any.
 */
export function starClock(state: GameState): { turn: number; of: number; split: number; left: number; system: string; systemId: string | null; next: string | null; nextId: string | null } | null {
  const f = state.civ.flags;
  const left = starTurnsLeft(state);
  if (left < 1) return null;
  const split = starSplit(state, state.civ.pace);
  const sys = Object.values(state.systems).find((s) => isNewStar(s) && s.primary.diesAt === f.star_until);
  const after = f.star_next ? Object.values(state.systems).find((s) => isNewStar(s) && s.primary.diesAt === f.star_next) : undefined;
  return {
    turn: Math.max(1, STAR_TURNS * split - left + 1),
    of: STAR_TURNS * split,
    split,
    left,
    system: sys?.name ?? 'the new star',
    systemId: sys?.id ?? null,
    next: f.star_next ? (after?.name ?? 'another new star') : null,
    nextId: after?.id ?? null,
  };
}

/**
 * The coming turn's time step. As the calendar's, except that a turn stops at the moment one of
 * our stars leaves the main sequence, and while we keep time with a flare its turns are pinned
 * to a sixth of it. While we keep time with a new star (Degenerate Age) its turns are a sixth of
 * what was left of its life, whatever the pace, the last ending as it burns out; with Quickening
 * at a quick pace each of those splits into STAR_SPLIT.
 */
export function turnStep(state: GameState, pace = state.civ.pace): TimeStep {
  const step = stepTime(state.era, state.years, state.eta, pace, state.settings.length);
  const left = state.era === 'degenerate' && isFinite(step.years) ? starTurnsLeft(state, pace) : 0;
  if (left >= 1) {
    const f = state.civ.flags;
    const end = left === 1 ? f.star_until : f.star_until - (f.star_step / starSplit(state, pace)) * (left - 1);
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
 * Would this pace change the coming turn, against the next pace toward the Tide? Not when a new
 * star's clock or a flare sets the turn, a flare cuts it short whatever the pace, or the age's
 * calendar will stretch or shrink it no further (the Dark Era's, beyond tenfold): then choosing
 * it changes nothing now but, at most, how little of the turn is booked as lived, so its button
 * is greyed out. The Tide always can.
 */
export function paceMatters(state: GameState, pace: number): boolean {
  if (pace === 0) return true;
  const a = turnStep(state, pace);
  const b = turnStep(state, pace > 0 ? pace - 1 : pace + 1);
  const close = (x: number, y: number) => x === y || Math.abs(x - y) <= 1e-9 * Math.max(Math.abs(x), Math.abs(y));
  return !(close(a.turnLength, b.turnLength) && close(a.eta, b.eta));
}

/**
 * The share of a Tide turn the coming turn lives, which its yields scale by: 10^-pace, as the
 * calendar has it, except at a flare, which sets the length of the turn whatever the pace (so a
 * slower pace would buy more without more time passing). While we keep time with a flare each of
 * its turns is lived in full: one Tide turn. A turn cut short when a star begins to flare pays as
 * one Tide turn at most. (Paying it only for the time it covers would still charge a whole turn's
 * upkeep, which does not shrink with a short turn, for a fraction of its income.) A turn kept
 * with a new star is lived in full in the same way, or as a tenth of one when Quickening splits it.
 */
export function livedShare(state: GameState, pace = state.civ.pace, step: TimeStep = turnStep(state, pace)): number {
  const share = Math.pow(10, -pace);
  if (state.era === 'degenerate' && keepingStarTime(state)) return 1 / starSplit(state, pace);
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
