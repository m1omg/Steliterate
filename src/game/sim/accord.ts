import { THREAD_DEFS } from '../data/threads';
import type { GameState, ThreadId } from '../types';
import { log, threadTotals } from './util';

// Accord is the Threads' goodwill toward one another. Beyond writing laws it can be spent to
// rally the will to go on (resolve), to calm an argument (dissent) or to hear out one Thread
// (its standing). Each use can be made once a turn; its price doubles with every use and eases
// back by a tenth of a doubling each turn, so a full purse can be spent, but not all at once.
// The use counters live in civ.flags: saves keep their shape.

export type AccordUse = 'rally' | 'calm' | 'hear';

// (tuned with the harness to leave the game as hard as before: see DEV-NOTES, 4 Oct)
export const ACCORD_USES: Record<AccordUse, { base: number; gain: number }> = {
  rally: { base: 80, gain: 3 }, // resolve
  calm: { base: 60, gain: 4 }, // dissent, lowered
  hear: { base: 50, gain: 5 }, // one Thread's standing
};

/** How much the doubling eases each turn. */
export const ACCORD_COOLING = 0.1;

const key = (use: AccordUse, t?: ThreadId) => (use === 'hear' ? `acc_hear_${t}` : `acc_${use}`);

/** Accord this use costs now. */
export function accordCost(state: GameState, use: AccordUse, t?: ThreadId): number {
  const heat = state.civ.flags[`${key(use, t)}_heat`] ?? 0;
  return Math.round(ACCORD_USES[use].base * Math.pow(2, heat));
}

/** Why this use cannot be made now, or null. */
export function accordCheck(state: GameState, use: AccordUse, t?: ThreadId): string | null {
  const civ = state.civ;
  if (use === 'hear') {
    if (!t || !THREAD_DEFS[t]?.conscious) return 'Only a Thread that can be persuaded can be heard.';
    if (threadTotals(state)[t] <= 0) return 'None of them are left among us.';
    if (civ.standing[t] >= 100) return 'They could not think better of us.';
  }
  if (use === 'rally' && civ.resolve >= 100) return 'Resolve is already full.';
  if (use === 'calm' && civ.dissent <= 0) return 'There is no dissent to calm.';
  if (civ.flags[`${key(use, t)}_turn`] === state.turn) return 'Once a turn.';
  const cost = accordCost(state, use, t);
  if (civ.accord < cost) return `Needs ${cost} accord.`;
  return null;
}

/** Spend accord on one of its uses. Returns an error string or null. */
export function spendAccord(state: GameState, use: AccordUse, t?: ThreadId): string | null {
  const err = accordCheck(state, use, t);
  if (err) return err;
  const civ = state.civ;
  const k = key(use, t);
  civ.accord -= accordCost(state, use, t);
  civ.flags[`${k}_heat`] = (civ.flags[`${k}_heat`] ?? 0) + 1;
  civ.flags[`${k}_turn`] = state.turn;
  const g = ACCORD_USES[use].gain;
  if (use === 'rally') {
    civ.resolve = Math.min(100, civ.resolve + g);
    log(state, 'The Threads gathered and reminded one another why we go on. Resolve rises.', 'good');
  } else if (use === 'calm') {
    civ.dissent = Math.max(0, civ.dissent - g);
    log(state, 'Long talks across the Threads; the argument cools. Dissent falls.', 'good');
  } else {
    civ.standing[t!] = Math.min(100, civ.standing[t!] + g);
    log(state, `The other Threads gave ${THREAD_DEFS[t!].name} a full hearing. Their standing rises.`, 'good');
  }
  return null;
}

/** Each turn the doubling eases a little; spent counters that have cooled are dropped. */
export function coolAccord(state: GameState) {
  const f = state.civ.flags;
  for (const k of Object.keys(f)) {
    if (k.startsWith('acc_') && k.endsWith('_heat')) {
      f[k] = Math.max(0, f[k] - ACCORD_COOLING);
      if (f[k] < 1e-9) {
        delete f[k];
        delete f[k.replace(/_heat$/, '_turn')];
      }
    }
  }
}
