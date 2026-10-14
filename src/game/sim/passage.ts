import { STRUCTURE_BY_ID, inLeptonicForm } from '../data/structures';
import { stepTime } from '../eras';
import { MATTER_END, calendarEra, fateKnown, fateOf, matterGone } from '../fate';
import type { Colony, GameState } from '../types';
import type { ActionResult } from './actions';
import { dismantleTerms } from './actions';
import { protocolsMult } from './crossing';
import { clockCiv, turnStep } from './flare';
import { formOf, hasTech, log, ownColony, uid } from './util';

// The Passage (the new version, part 3-2): a settlement rewritten, over several turns, into
// electron–positron structures held by fields, before ordinary matter ends. What has a leptonic
// form crosses over (data/structures.ts, `leptonic`); the rest is taken apart; Kin, made of matter,
// cannot go, but their patterns are kept. All of it is speculation, and the Codex says so.

/** The Passage's industry: this much, and PASSAGE_PER more for each structure that crosses over. */
export const PASSAGE_BASE = 40;
export const PASSAGE_PER = 15;
/** Energy paid up front for each structure there, crossing over or taken apart. */
export const PASSAGE_ENERGY = 5;
/** Insight from each Kin, awake or asleep, whose pattern is kept in the archive. */
export const ARCHIVE_INSIGHT = 20;

export interface PassageTerms {
  /** Structures that cross over, and those taken apart. */
  crossing: number;
  apart: number;
  /** The industry it takes, and the energy paid up front. */
  industry: number;
  energy: number;
  /** The matter back from what is taken apart, as dismantling gives it. */
  matterBack: number;
  /** Kin and sleepers whose patterns go into the archive, and the insight they are worth. */
  kin: number;
  insight: number;
  /** The Lattice lost in re-encoding it (half; a quarter under the protocols). */
  lattice: number;
}

/** What the Passage would take and do at this settlement. */
export function passageTerms(state: GameState, c: Colony): PassageTerms {
  let crossing = 0;
  let apart = 0;
  let matterBack = 0;
  for (const [id, n] of Object.entries(c.structures)) {
    const d = STRUCTURE_BY_ID[id];
    if (!d || !n) continue;
    if (inLeptonicForm(d)) crossing += n;
    else {
      apart += n;
      matterBack += dismantleTerms(state, d).matter * n;
    }
  }
  const kin = c.pops.kin + c.cryo;
  return {
    crossing,
    apart,
    industry: PASSAGE_BASE + PASSAGE_PER * crossing,
    energy: PASSAGE_ENERGY * (crossing + apart),
    matterBack,
    kin,
    insight: kin * ARCHIVE_INSIGHT,
    lattice: Math.round(c.pops.lattice * 0.5 * protocolsMult(state, 'degenerate')),
  };
}

/**
 * Can the end of matter be foreseen: its fate known, and matter not gone yet? If it is stable it
 * ends too, unimaginably late: from 10^(10^26) years it tunnels into black holes (deeptime.ts).
 */
export function endForeseen(state: GameState): boolean {
  return fateKnown(state) && !matterGone(state);
}

/** Why this settlement cannot begin the Passage now, or null if it can. */
export function passageCheck(state: GameState, c: Colony): string | null {
  if (formOf(c) !== 'baryonic') return 'It is leptonic already.';
  if (c.queue.some((q) => q.kind === 'passage')) return 'The Passage is under way here.';
  if (!hasTech(state, 'leptonic_computation')) return 'Needs Leptonic Computation.';
  if (!endForeseen(state)) return matterGone(state) ? 'Matter is gone.' : 'Not until the end of matter can be foreseen.';
  if (c.queue.length >= 6) return 'The queue is full.';
  const t = passageTerms(state, c);
  if (state.civ.energy < t.energy) return `Needs ${t.energy} energy.`;
  return null;
}

/** Begin the Passage: a project in the settlement's queue, its energy paid now (and given back if it is taken off). */
export function beginPassage(state: GameState, colonyId: string): ActionResult {
  const c = ownColony(state, colonyId);
  if (!c) return 'No such settlement.';
  const err = passageCheck(state, c);
  if (err) return err;
  const t = passageTerms(state, c);
  state.civ.energy -= t.energy;
  c.queue.push({ uid: uid(state, 'q'), kind: 'passage', key: 'passage', progress: 0, cost: t.industry, paid: { matter: 0, energy: t.energy } });
  log(state, `${c.name}: the Passage begins.`, 'info', c.systemId);
  return null;
}

/**
 * The Passage done: the settlement is leptonic. What has a leptonic form crosses over and the rest
 * is taken apart, its matter back; work under way without one is taken off, what was paid for it
 * back; its Kin and sleepers go, their patterns into the archive as insight; the Lattice
 * re-encodes at half (a quarter under the protocols).
 */
export function completePassage(state: GameState, c: Colony): void {
  const civ = state.civ;
  const t = passageTerms(state, c);
  for (const id of Object.keys(c.structures)) {
    const d = STRUCTURE_BY_ID[id];
    if (!d || !inLeptonicForm(d)) delete c.structures[id];
  }
  civ.matter += t.matterBack;
  c.queue = c.queue.filter((q) => {
    const d = q.kind === 'structure' ? STRUCTURE_BY_ID[q.key] : undefined;
    if (d && inLeptonicForm(d)) return true;
    if (q.paid) {
      civ.matter += q.paid.matter;
      civ.energy += q.paid.energy;
    }
    return false;
  });
  c.pops.kin = 0;
  c.cryo = 0;
  if (t.insight) {
    if (civ.researching) civ.research[civ.researching] = (civ.research[civ.researching] ?? 0) + t.insight;
    else civ.flags.insight_bank = (civ.flags.insight_bank ?? 0) + t.insight;
  }
  c.pops.lattice -= t.lattice;
  c.overdrive = false;
  c.form = 'leptonic';
  const kin = t.kin ? ` Its ${t.kin} Kin were made of matter, and could not go; their patterns are kept in the archive (+${t.insight} insight).` : '';
  const lattice = t.lattice ? ` ${t.lattice} of its Lattice did not survive the re-encoding.` : '';
  log(state, `${c.name} has made the Passage: it is leptonic now. ${t.crossing} structure${t.crossing === 1 ? '' : 's'} crossed over; ${t.apart} ${t.apart === 1 ? 'was' : 'were'} taken apart${t.matterBack ? ` (+${t.matterBack} matter)` : ''}.${kin}${lattice}`, 'good', c.systemId);
}

/** Decades of η until ordinary matter ends (Infinity if it will not, or already has). */
export function etaToEndOfMatter(state: GameState): number {
  const end = MATTER_END[fateOf(state)];
  return !isFinite(end) || matterGone(state) ? Infinity : Math.max(0, end - state.eta);
}

/**
 * About how many decades of η this settlement's own industry would take to put `industry` into
 * the Passage: turns of its industry (the last turn's: minds work a turn's worth whatever its
 * length), each as long as the calendar's turn at this pace (`pace`, the player's by default: time
 * is the player's; no star's clock).
 */
export function passageEta(state: GameState, c: Colony, industry: number, pace = clockCiv(state).pace): number {
  const per = c.last?.industry ?? 0;
  if (per <= 0) return Infinity;
  const step = stepTime(calendarEra(state), state.years, state.eta, pace, state.settings.length);
  return isFinite(step.eta) ? (industry / per) * Math.max(0, step.eta - state.eta) : Infinity;
}

/**
 * About how many turns are left before ordinary matter ends (or before η `at`), from the coming
 * turn's length (Infinity if it will not).
 */
export function turnsToEndOfMatter(state: GameState, at = MATTER_END[fateOf(state)]): number {
  const end = at;
  if (!isFinite(end) || matterGone(state)) return Infinity;
  const step = turnStep(state);
  const per = isFinite(step.turnLength) && step.turnLength > 0 ? Math.log10(1 + step.turnLength / state.years) : 0;
  return per > 0 ? Math.max(0, (end - state.eta) / per) : Infinity;
}
