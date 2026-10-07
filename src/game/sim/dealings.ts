// How the other civilizations deal with us. Each way of life wants what it lacks and offers what
// it has: gardens need matter to shelter their living world, minds need energy to run on, the
// Tessellate trades matter for data to the letter. An offer says exactly what it asks and gives:
// their notes on what we are researching, worth a share of it, priced at their rate, and never
// more than we could spare. Each keeps its own rhythm of offers, and waits twice as long after
// every refusal in a row. And they remember: what they have heard of us and what we did to them
// is kept in a short memory, the reasons for how they feel, which their card in Signals shows.

import { TECH_BY_ID } from '../data/techs';
import type { GameState, Survivor, SurvivorWay } from '../types';
import { matterGone } from '../fate';
import { availableTechs, techCost } from './research';
import { clamp } from './util';

export type Want = 'matter' | 'energy';

interface Terms {
  /** What they lack. */
  want: Want;
  /** Their notes on one of our projects are worth this share of it. */
  share: number;
  /** Insight they give for each unit of what they want. */
  rate: number;
  /** Turns between their offers. */
  every: number;
}

/** What each way of life lacks, what its notes are worth, its price, and its rhythm. */
const TERMS: Record<Exclude<SurvivorWay, 'fork'>, Terms> = {
  // to shelter a living world under a dying sun
  garden: { want: 'matter', share: 0.2, rate: 2, every: 22 },
  // minds run on power, and the Archive keeps everything
  upload: { want: 'energy', share: 0.3, rate: 3, every: 16 },
  chorus: { want: 'energy', share: 0.25, rate: 2.5, every: 18 },
  // asleep most of the time: rarely
  dormant: { want: 'energy', share: 0.2, rate: 2, every: 40 },
  // machines and data, to the letter, on a fixed rhythm
  lattice: { want: 'matter', share: 0.22, rate: 2.5, every: 18 },
};

/** Their terms: a fork deals as the Thread it came from, but less often (it does not forget leaving). */
export function termsFor(sv: Survivor): Terms {
  if (sv.way !== 'fork') return TERMS[sv.way];
  const base = sv.forkOf === 'kin' ? TERMS.garden : TERMS.upload;
  return { ...base, every: 24 };
}

/** Turns they wait after a refusal: twice as long for each refusal in a row, at most eight times. */
export const BACKOFF_MAX = 8;
/** Once their rhythm allows, the chance a turn they make the offer (the Tessellate keeps it exactly). */
export const OFFER_CHANCE = 0.35;
/** The least they bother to ask for (less is not worth the light it takes), and the most. */
export const ASK_MIN = 10;
export const ASK_MAX = 80;
/** How much they remember. */
export const MEMORY = 8;

export interface Offer {
  want: Want;
  ask: number;
  insight: number;
  tech: string | null;
  techName: string | null;
}

/** The project their notes would be on: ours now, or else the cheapest one open to us. */
function subject(state: GameState): { id: string; name: string; cost: number } | null {
  const r = state.civ.researching;
  if (r && TECH_BY_ID[r]) return { id: r, name: TECH_BY_ID[r].name, cost: techCost(state, r) };
  const t = availableTechs(state).sort((a, b) => techCost(state, a.id) - techCost(state, b.id))[0];
  return t ? { id: t.id, name: t.name, cost: techCost(state, t.id) } : null;
}

/**
 * What they would offer us now: what they ask, and what they give for it; null if we could not
 * spare it, or there is nothing left for us to learn.
 */
export function tradeOffer(state: GameState, sv: Survivor): Offer | null {
  const t = termsFor(sv);
  const want: Want = t.want === 'matter' && matterGone(state) ? 'energy' : t.want;
  const p = subject(state);
  if (!p) return null;
  const worth = Math.round(p.cost * t.share * (0.6 + 0.4 * sv.health));
  const have = want === 'matter' ? state.civ.matter : state.civ.energy;
  // at their rate, and never more than we could spare: half of what we hold
  const ask = Math.min(Math.round(worth / t.rate), ASK_MAX, Math.floor(have / 2));
  if (ask < ASK_MIN) return null;
  return { want, ask, insight: Math.round(Math.min(worth, ask * t.rate)), tech: p.id, techName: p.name };
}

/** Whether their rhythm (and our last answers) lets them make an offer of this kind now. */
export function offerDue(state: GameState, sv: Survivor, kind: 'trade' | 'joint', chance: () => number): boolean {
  if (sv.war || state.turn < (state.civ.flags[`${kind}_next_${sv.id}`] ?? 0)) return false;
  return sv.way === 'lattice' || chance() < OFFER_CHANCE;
}

/** They made an offer of this kind: the next waits at least their rhythm. */
export function offered(state: GameState, sv: Survivor, kind: 'trade' | 'joint') {
  state.civ.flags[`${kind}_next_${sv.id}`] = state.turn + termsFor(sv).every;
}

/** Our answer to an offer of this kind: a yes resets their patience, a no doubles it. */
export function answered(state: GameState, sv: Survivor, kind: 'trade' | 'joint', yes: boolean) {
  const f = state.civ.flags;
  const no = yes ? 0 : (f[`${kind}_no_${sv.id}`] ?? 0) + 1;
  if (no) f[`${kind}_no_${sv.id}`] = no;
  else delete f[`${kind}_no_${sv.id}`];
  f[`${kind}_next_${sv.id}`] = state.turn + termsFor(sv).every * Math.min(BACKOFF_MAX, 2 ** no);
}

/**
 * How they feel about something we did, or something they heard of us: their regard moves, and
 * they remember why (the last MEMORY things, for their card).
 */
export function feel(state: GameState, sv: Survivor, delta: number, what: string) {
  sv.disposition = clamp(sv.disposition + delta, -100, 100);
  if (Math.abs(delta) < 1) return;
  (sv.memory ??= []).push({ turn: state.turn, delta: Math.round(delta), what });
  if (sv.memory.length > MEMORY) sv.memory.splice(0, sv.memory.length - MEMORY);
}
