import { formatYears } from '../eras';
import type { GameState, Signal, SignalChoice } from '../types';
import { THREADS } from '../types';
import { computeMods, strainFor } from './mods';
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

/** The clock of the civilization's dominant conscious voice (log10 years). */
export function voiceClock(state: GameState, logL: number): number {
  const mods = computeMods(state);
  const totals = threadTotals(state);
  let best: (typeof THREADS)[number] | null = null;
  for (const t of THREADS) {
    if (t === 'lattice' || totals[t] <= 0) continue;
    if (!best || totals[t] > totals[best]) best = t;
  }
  if (!best) return logL;
  return strainFor(best, logL, mods).clock;
}

/** Can two minds hold a conversation? Within ~3 orders of magnitude of each other's clocks. */
export function canConverse(myClock: number, theirClock: number, span = 3): boolean {
  return Math.abs(myClock - theirClock) <= span;
}
