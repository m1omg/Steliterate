import { DARK_ENDING, ENDURANCE_ENDING, WORK_BY_ID } from '../data/works';
import type { GameState, Outcome } from '../types';
import { colonies, protonFateKnown, threadTotals, totalPops } from './util';
import { calendarEra, fateOf } from '../fate';

export function workRequirementMet(state: GameState, id: string): boolean {
  const civ = state.civ;
  const t = threadTotals(state);
  const all = t.kin + t.echoes + t.chorus + t.lattice + t.coldminds;
  const def = WORK_BY_ID[id];
  if (!def) return false;
  if (civ.taint > def.maxTaint) return false;
  switch (id) {
    case 'hibernal_cascade':
      return t.echoes + t.coldminds >= 6;
    case 'confluence':
      return all > 0 && t.chorus >= all / 2 && (['kin', 'echoes', 'chorus', 'coldminds'] as const).every((k) => t[k] === 0 || civ.standing[k] >= 55);
    case 'archive_of_everything':
      return all > 0 && t.lattice >= all / 2;
    case 'aeon_seed': {
      const heart = Object.values(state.systems).find((s) => s.special === 'core');
      return !!heart && colonies(state).some((c) => c.systemId === heart.id) && (state.minds.slow.stage >= 4 || !!civ.flags.unlit_gift);
    }
    case 'garden_of_embers': {
      let kin = 0;
      for (const c of colonies(state)) kin += c.pops.kin + c.cryo;
      return fateOf(state) === 'stable' && protonFateKnown(state) && kin >= 6;
    }
    default:
      return false;
  }
}

export function workCost(state: GameState, id: string): number {
  const def = WORK_BY_ID[id];
  const d = state.settings.difficulty === 'gentle' ? 0.8 : state.settings.difficulty === 'harsh' ? 1.2 : 1;
  return Math.round(def.cost * d);
}

function end(state: GameState, kind: Outcome['kind'], ending: string): Outcome {
  state.outcome = { kind, ending, turn: state.turn, eta: state.eta };
  return state.outcome;
}

/**
 * Check for any ending. `atLastHorizon` is set while crossing into the Dark Era, a check before
 * the turn's own at its end: despair is counted only in that one, so once a turn.
 */
export function checkEndings(state: GameState, atLastHorizon = false): Outcome | null {
  if (state.outcome) return state.outcome;
  const civ = state.civ;
  if (civ.taint >= 100) return end(state, 'dark', DARK_ENDING.ending);
  if (totalPops(state) <= 0) return end(state, 'defeat', 'Silence');
  if (civ.resolve <= 0) {
    if (!atLastHorizon) civ.flags.despair = (civ.flags.despair ?? 0) + 1;
    if ((civ.flags.despair ?? 0) >= 6) return end(state, 'defeat', 'The Will Fails');
  } else if (!atLastHorizon) civ.flags.despair = 0;
  if (calendarEra(state) === 'dark' && civ.continuity <= 0) return end(state, 'defeat', 'The Fade');
  if (atLastHorizon && (civ.works.aeon_seed ?? 0) >= workCost(state, 'aeon_seed') && workRequirementMet(state, 'aeon_seed')) return end(state, 'victory', WORK_BY_ID.aeon_seed.ending);
  for (const id of Object.keys(WORK_BY_ID)) {
    if (id === 'aeon_seed') continue;
    if ((civ.works[id] ?? 0) >= workCost(state, id) && workRequirementMet(state, id)) return end(state, 'victory', WORK_BY_ID[id].ending);
  }
  if (calendarEra(state) === 'dark' && Math.log10(state.eta) >= 122) return end(state, 'endurance', ENDURANCE_ENDING.ending);
  return null;
}
