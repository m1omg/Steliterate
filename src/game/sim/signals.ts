import { formatYears } from '../eras';
import type { GameState, Signal, SignalChoice, ThreadId } from '../types';
import { THREADS } from '../types';
import { computeMods, strainFor, type Mods } from './mods';
import { log, threadTotals, uid } from './util';

// Every message crosses the dark at the speed of light. A plea from 30,000 ly away is 30,000
// years old when it arrives, and its sender may be gone. Contact also needs minds to think
// at comparable speeds: a mind a thousand times slower is geology; a thousand times faster, noise.

export function sendSignal(
  state: GameState,
  s: { from: string; kind: string; title: string; text: string; distanceLy: number; data?: Record<string, number | string>; choices?: SignalChoice[] },
): Signal {
  const sig: Signal = {
    uid: uid(state, 'sg'),
    from: s.from,
    kind: s.kind,
    sentYears: state.years,
    arriveYears: isFinite(state.years) ? state.years + Math.max(0, s.distanceLy) : Infinity,
    arrivedTurn: null,
    title: s.title,
    text: s.text,
    data: s.data ?? {},
    choices: s.choices ?? [],
    resolved: s.choices && s.choices.length ? null : 'read',
  };
  if (!isFinite(state.years) || s.distanceLy <= 0) {
    sig.arriveYears = state.years;
  }
  state.signals.push(sig);
  return sig;
}

/** Mark messages whose light has reached you. Returns the newly arrived ones. */
export function deliverSignals(state: GameState): Signal[] {
  const out: Signal[] = [];
  for (const s of state.signals) {
    if (s.arrivedTurn !== null) continue;
    if (!isFinite(state.years) || state.years >= s.arriveYears) {
      s.arrivedTurn = state.turn;
      out.push(s);
      const age = isFinite(state.years) ? state.years - s.sentYears : Infinity;
      const ageText = age > 1 ? ` (sent ${formatYears(age)} ago)` : '';
      log(state, `Signal: ${s.title}${ageText}`, 'mind');
    }
  }
  // old unanswered messages lapse
  for (const s of state.signals) {
    if (s.arrivedTurn !== null && !s.resolved && state.turn - s.arrivedTurn > 8) s.resolved = 'lapsed';
  }
  if (state.signals.length > 160) state.signals.splice(0, state.signals.length - 160);
  return out;
}

export function signalAge(state: GameState, s: Signal): number {
  return isFinite(state.years) && isFinite(s.sentYears) ? Math.max(0, (s.arrivedTurn !== null ? state.years : state.years) - s.sentYears) : 0;
}

/** The civilization's dominant conscious voice: the most numerous of its Threads but the Lattice (null: none). */
export function voiceThread(state: GameState): (typeof THREADS)[number] | null {
  const totals = threadTotals(state);
  let best: (typeof THREADS)[number] | null = null;
  for (const t of THREADS) {
    if (t === 'lattice' || totals[t] <= 0) continue;
    if (!best || totals[t] > totals[best]) best = t;
  }
  return best;
}

/** The clock of the civilization's dominant conscious voice (log10 years). */
export function voiceClock(state: GameState, logL: number): number {
  const best = voiceThread(state);
  if (!best) return logL;
  return strainFor(best, logL, computeMods(state)).clock;
}

/**
 * The clocks we can hold a conversation at (log10 years): any rhythm from how fast our dominant
 * voice thinks to how long our turn is, since we can always let a turn pass between replies. So
 * slowing the pace reaches slower minds, and quickening it, past how fast our minds think, faster
 * ones; slow turns still cost fast minds their upkeep (tempo strain).
 */
export function voiceRange(state: GameState, logL: number): [number, number] {
  return rangeWith(voiceThread(state), logL, computeMods(state));
}

/**
 * The clocks we could talk at with Thread `t` as our voice (null: none): from its clock at this
 * turn's length (the turn's, held within what that kind of mind can live) to the turn's. So it is
 * [min(turn, its fastest), max(turn, its slowest)]: the turn's end is the end the pace moves.
 */
export function rangeWith(t: ThreadId | null, logL: number, mods: Mods): [number, number] {
  const v = t ? strainFor(t, logL, mods).clock : logL;
  return [Math.min(v, logL), Math.max(v, logL)];
}

/** How many orders of magnitude a clock lies outside our range: negative below it (too fast for us), positive above (too slow), 0 within. */
export function stepGap(mine: [number, number] | number, theirClock: number): number {
  const [lo, hi] = typeof mine === 'number' ? [mine, mine] : mine;
  return theirClock < lo ? theirClock - lo : theirClock > hi ? theirClock - hi : 0;
}

/** Can two minds hold a conversation? Their clock within ~3 orders of magnitude of ours (of any rhythm we can keep). */
export function canConverse(mine: [number, number] | number, theirClock: number, span = 3): boolean {
  return Math.abs(stepGap(mine, theirClock)) <= span;
}
