// Every civilization plays the same game (the new version, docs/plans/new-version.md): each has a
// Civ in `state.civs`, and `state.civ` points at the one whose turn or view it is. The pointer is
// not saved (JSON leaves it out), so no civilization is ever written twice: a load points it again.
//
// Each civilization plays its part of a turn under its own perspective (asCiv): its settlements
// and fleets (colonies, fleets), its flags, its log, its random stream (withRng). Between those
// parts, and whenever the interface looks, the pointer is at the player. What one civilization
// sends another goes through the outbox (deliver), so that none writes to another's own.
import type { Civ, GameState, Outgoing, Signal } from './types';
import { THREADS } from './types';
import { allFleets, coloniesOf } from './sim/util';

/** The player's civilization's id in `state.civs`. */
export const PLAYER_ID = 'us';

/** Point the state at `c`, the civilization whose turn or view it is: a pointer JSON leaves out. */
export function pointAt(state: Omit<GameState, 'civ'> | GameState, c: Civ): GameState {
  Object.defineProperty(state, 'civ', { value: c, writable: true, enumerable: false, configurable: true });
  return state as GameState;
}

/** A state as read from JSON: pointed at the player again. */
export function linkCivs(state: GameState): GameState {
  return pointAt(state, state.civs[state.player]);
}

/** The player's civilization, whoever's turn it is. */
export function playerCiv(state: GameState): Civ {
  return state.civs[state.player];
}

/** Whether the state is looked at as the player (and not in another civilization's part of a turn). */
export function isPlayerView(state: GameState): boolean {
  return state.civ === state.civs[state.player] && !playing.has(state);
}

// ---------------------------------------------------------------- one civilization's part of a turn

/** The states some civilization is playing its part on right now (asCiv never nests). */
const playing = new WeakSet<GameState>();

/**
 * The checks' guard (setCivGuard): while it is on, in another civilization's part of a turn every
 * other civilization is read-only, so a write that crosses over throws where it is made.
 */
let guard = false;

/** Turn the checks' guard on or off (see `guard`). */
export function setCivGuard(on: boolean): void {
  guard = on;
}

/**
 * Play `fn` as civilization `id`: `state.civ` points at it, and back where it was afterwards,
 * whatever happens. Never nested: one civilization plays at a time.
 */
export function asCiv<T>(state: GameState, id: string, fn: () => T): T {
  const c = state.civs[id];
  if (!c) throw new Error(`asCiv: there is no civilization "${id}"`);
  if (playing.has(state)) throw new Error(`asCiv: "${id}" cannot play inside ${state.civ.id}'s part of a turn`);
  const was = state.civ;
  const others = guard ? Object.keys(state.civs).filter((k) => k !== id) : [];
  const kept = others.map((k) => state.civs[k]);
  playing.add(state);
  pointAt(state, c);
  others.forEach((k, i) => (state.civs[k] = readOnly(kept[i], `civs.${k}`)));
  try {
    return fn();
  } finally {
    others.forEach((k, i) => (state.civs[k] = kept[i]));
    pointAt(state, was);
    playing.delete(state);
  }
}

/** A deep read-only view of `o`: any write through it throws, naming what was written. */
function readOnly<T extends object>(o: T, path: string): T {
  const refuse = (k: string | symbol): never => {
    throw new Error(`${path}.${String(k)}: written in another civilization's part of a turn`);
  };
  return new Proxy(o, {
    get(t, k, r) {
      const v = Reflect.get(t, k, r);
      return v && typeof v === 'object' ? readOnly(v as object, `${path}.${String(k)}`) : v;
    },
    set: (_t, k) => refuse(k),
    deleteProperty: (_t, k) => refuse(k),
    defineProperty: (_t, k) => refuse(k),
  });
}

/**
 * The interface, a save and an action by the player must see the player's view. If something left
 * the pointer elsewhere, it is a bug: under the checks' guard it throws; for a player it is said in
 * the console and the pointer put back, so that the game goes on.
 */
export function assertPlayerView(state: GameState, where: string): void {
  if (isPlayerView(state)) return;
  const msg = `${where}: the state is pointed at ${state.civ?.id ?? 'nothing'}, not the player`;
  if (guard) throw new Error(msg);
  console.error(msg);
  if (!playing.has(state)) linkCivs(state);
}

// ---------------------------------------------------------------- between civilizations

/**
 * Send `signal` to civilization `to`: into the outbox, delivered when every civilization has had
 * its part of the turn (flushOutbox), or at once into the active civilization's own list when it
 * is for itself.
 */
export function deliver(state: GameState, to: string, signal: Signal): void {
  if (to === state.civ.id) {
    state.civ.signals.push(signal);
    return;
  }
  (state.outbox ??= []).push({ to, signal });
}

/**
 * Send civilization `to` what moves between civilizations (energy, matter, resolve, people; a
 * negative amount is taken from it): delivered as messages are (flushOutbox), never written
 * into another's own during a part of a turn.
 */
export function send(state: GameState, to: string, what: Omit<Outgoing, 'to' | 'signal'>): void {
  (state.outbox ??= []).push({ to, ...what });
}

/** Hand everything in the outbox to whom it is for (a civilization gone meanwhile gets nothing). */
export function flushOutbox(state: GameState): void {
  const out = state.outbox;
  if (!out) return;
  delete state.outbox;
  for (const m of out) {
    const civ = state.civs[m.to];
    if (!civ) continue;
    if (m.signal) civ.signals.push(m.signal);
    if (m.energy) civ.energy = Math.max(0, civ.energy + m.energy);
    if (m.matter) civ.matter = Math.max(0, civ.matter + m.matter);
    if (m.resolve) civ.resolve = Math.max(0, Math.min(100, civ.resolve + m.resolve));
    if (m.accord) civ.accord = Math.max(0, civ.accord + m.accord);
    if (m.insight) civ.flags.insight_bank = (civ.flags.insight_bank ?? 0) + m.insight;
    if (m.people?.n) movePeople(state, civ, m.people.thread, m.people.n);
    if (m.end) endNow(state, civ, m.end.ending, m.end.to);
  }
}

/** A civilization's game ends: it plays no more, and what is left of it is empty, or another's (`to`). */
function endNow(state: GameState, civ: Civ, ending: string, to?: string) {
  civ.outcome ??= { kind: 'defeat', ending, turn: state.turn, eta: state.eta };
  for (const c of coloniesOf(state, civ.id)) {
    if (to && state.civs[to]) {
      c.owner = to;
      delete c.governor;
    } else {
      const b = state.bodies[c.bodyId];
      if (b) b.colonyId = null;
      delete state.colonies[c.id];
    }
  }
  for (const f of allFleets(state)) {
    if (f.owner !== civ.id) continue;
    if (to && state.civs[to]) f.owner = to;
    else delete state.fleets[f.id];
  }
  civ.capitalId = null;
}

/**
 * People joining a civilization (n > 0, at its capital) or leaving it (n < 0: that Thread first,
 * then any, from its largest settlements).
 */
function movePeople(state: GameState, civ: Civ, thread: (typeof THREADS)[number], n: number) {
  const mine = coloniesOf(state, civ.id);
  if (n > 0) {
    const at = mine.find((c) => c.id === civ.capitalId) ?? mine[0];
    if (at) at.pops[thread] += n;
    return;
  }
  let left = -n;
  const order = [thread, ...THREADS.filter((t) => t !== thread)];
  for (const t of order) {
    for (const c of mine.sort((a, b) => b.pops[t] - a.pops[t])) {
      const k = Math.min(left, c.pops[t]);
      c.pops[t] -= k;
      left -= k;
      if (left <= 0) return;
    }
  }
}
