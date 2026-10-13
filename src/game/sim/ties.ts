// Between the other civilizations (the new version, part 2a-3): how each regards each other, the
// pacts between them, and what we hear of it. Toward us a neighbour's relation is its Survivor
// record (survivors.ts, pacts.ts); between two others it is a Tie, kept by the same rules as ours.
// - Regard starts from how their ways of life see each other (AFFINITY) and a little of each
//   pair's own history, drawn from the seed and their ids, never from the dice; it drifts back
//   there slowly, and moves with what passes between them.
// - Pacts (Mutual Aid, Shared Watch, Open Archives) are proposed and answered in each one's own
//   part of a turn, at the speed of light both ways, priced in the accord of whoever binds
//   itself (pactCost's rule), and sealed when the answer is home.
// - What they do is real, through the outbox: Mutual Aid beams energy to a partner in trouble,
//   Open Archives shares a little of what each learns, Shared Watch stands each a little stronger
//   against the Hunger (hunger.ts, defenseAt).
// - We hear of a pact sealed between two others when its light reaches our capital (tidings).
import type { Civ, GameState, PactKind, Survivor, SurvivorWay, Tie } from '../types';
import { send } from '../civs';
import { hashSeed } from '../rng';
import { distLy, log } from './util';
import { ARCHIVE_SHARE } from './pacts';

export const TIE_PACTS: PactKind[] = ['archives', 'aid', 'watch'];

/** The regard each pact needs, on both sides (as ours: pacts.ts PACTS). */
const NEED: Record<PactKind, number> = { archives: 0, aid: 10, watch: 20 };

/** How one way of life regards another at first: kin to kin, minds to minds; the Chorus unsettles the rest. */
const AFFINITY: Record<string, number> = {
  'garden|garden': 10,
  'garden|upload': 0,
  'chorus|garden': -10,
  'dormant|garden': 5,
  'garden|lattice': -5,
  'upload|upload': 10,
  'chorus|upload': 10,
  'dormant|upload': 0,
  'lattice|upload': 0,
  'chorus|chorus': 5,
  'chorus|dormant': 0,
  'chorus|lattice': -10,
  'dormant|dormant': 10,
  'dormant|lattice': 0,
  'lattice|lattice': 15,
};

/** Accord a civilization's first pact costs; each pact it is bound by (or has proposed) makes the next dearer. */
const TIE_BASE = 30;
const TIE_RISE = 1.6;
/** A partner in trouble is helped at most once in this many turns, each way. */
const AID_EVERY = 6;
/** How fast regard drifts back toward where it began, a turn. */
const DRIFT = 0.02;

export function tieKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function wayOfCiv(state: GameState, id: string): SurvivorWay | null {
  return state.survivors[id]?.way ?? null;
}

/** Where a pair's regard begins: how their ways see each other, and a little of their own (−10..10, from the seed). */
export function baseRegard(state: GameState, a: string, b: string): number {
  const wa = wayOfCiv(state, a) ?? 'garden';
  const wb = wayOfCiv(state, b) ?? 'garden';
  const key = wa < wb ? `${wa}|${wb}` : `${wb}|${wa}`;
  const own = (hashSeed(`${state.settings.seed}:tie:${tieKey(a, b)}:${a}`) % 2001) / 100 - 10;
  return (AFFINITY[key] ?? 0) + own;
}

/** The tie between two other civilizations, made as they first matter to each other. */
export function tieOf(state: GameState, a: string, b: string): Tie {
  const ties = (state.ties ??= {});
  const k = tieKey(a, b);
  return (ties[k] ??= { regard: { [a]: baseRegard(state, a, b), [b]: baseRegard(state, b, a) } });
}

/** The others still playing (a civilization of its own whose game goes on), the player aside. */
export function othersPlaying(state: GameState): Civ[] {
  return Object.values(state.civs)
    .filter((c) => c.id !== state.player && !c.outcome && state.survivors[c.id]?.alive)
    .sort((x, y) => (x.id < y.id ? -1 : 1));
}

/** Light-years between two civilizations' capitals (their first stars, failing those). */
export function distanceBetween(state: GameState, a: string, b: string): number {
  const at = (id: string) => {
    const c = state.civs[id];
    const cap = c?.capitalId ? state.colonies[c.capitalId] : undefined;
    return state.systems[cap?.systemId ?? state.survivors[id]?.homeSystemId ?? c?.homeSystemId ?? ''];
  };
  const x = at(a);
  const y = at(b);
  return x && y ? distLy(x, y) : 0;
}

function lightIn(state: GameState, ly: number): number {
  return isFinite(state.years) ? state.years + Math.max(0, ly) : state.years;
}

function arrived(state: GameState, at: number): boolean {
  return !isFinite(state.years) || state.years >= at;
}

/** Pacts in force between two others. */
export function tiePacts(state: GameState, a: string, b: string): PactKind[] {
  const t = state.ties?.[tieKey(a, b)];
  return t?.pacts ? TIE_PACTS.filter((k) => t.pacts![k] !== undefined) : [];
}

/** Accord the next pact costs civilization `id`: dearer for every pact it is bound by or has proposed, with us or another. */
export function tieCost(state: GameState, id: string): number {
  let n = 0;
  const sv: Survivor | undefined = state.survivors[id];
  if (sv?.pacts) n += Object.keys(sv.pacts).length;
  for (const [k, t] of Object.entries(state.ties ?? {})) {
    if (!k.split('|').includes(id)) continue;
    n += Object.keys(t.pacts ?? {}).length + (t.proposal && t.proposal.from === id ? 1 : 0);
  }
  return Math.round(TIE_BASE * Math.pow(TIE_RISE, n));
}

/**
 * Another civilization's dealings with the others, in its own part of a turn (auto.ts): it answers
 * a proposal that has reached it (yes if it regards the proposer well enough and can pay its
 * accord: binding itself costs it as much as it cost them), and proposes one pact a turn at most,
 * the one the pair lacks that both are warm enough for, while its accord keeps `keep` in hand.
 */
export function planTies(state: GameState, keep: number): void {
  const me = state.civ;
  for (const o of othersPlaying(state)) {
    if (o.id === me.id) continue;
    const t = tieOf(state, me.id, o.id);
    const p = t.proposal;
    if (p && p.from !== me.id && !p.answer && arrived(state, p.arrives)) {
      const yes = (t.regard[me.id] ?? 0) >= NEED[p.kind] && me.accord >= p.cost;
      if (yes) me.accord -= p.cost;
      p.answer = { yes, arrives: lightIn(state, distanceBetween(state, me.id, o.id)) };
    }
  }
  for (const o of othersPlaying(state)) {
    if (o.id === me.id) continue;
    const t = tieOf(state, me.id, o.id);
    if (t.proposal) continue;
    const kind = TIE_PACTS.find((k) => t.pacts?.[k] === undefined && (t.regard[me.id] ?? 0) >= NEED[k] + 10 && (t.regard[o.id] ?? 0) >= NEED[k]);
    if (!kind) continue;
    const cost = tieCost(state, me.id);
    if (me.accord < cost + keep) return;
    me.accord -= cost;
    t.proposal = { kind, from: me.id, arrives: lightIn(state, distanceBetween(state, me.id, o.id)), cost };
    return;
  }
}

/**
 * The others among themselves, once a turn between their parts (turn.ts): answers come home and
 * pacts are sealed (and we hear of it when its light reaches us), a declined proposer's accord
 * comes back, regard drifts back toward where it began, and the pacts do their work.
 */
export function tiesTurn(state: GameState): void {
  const ties = state.ties;
  if (!ties) return;
  const playing = new Set(othersPlaying(state).map((c) => c.id));
  for (const [k, t] of Object.entries(ties)) {
    const [a, b] = k.split('|');
    if (!playing.has(a) || !playing.has(b)) {
      // one of them is gone: its pacts with it
      delete t.pacts;
      delete t.heard;
      delete t.proposal;
      continue;
    }
    for (const id of [a, b]) t.regard[id] += (baseRegard(state, id, id === a ? b : a) - t.regard[id]) * DRIFT;
    const p = t.proposal;
    if (p?.answer && arrived(state, p.answer.arrives)) {
      delete t.proposal;
      if (p.answer.yes) {
        (t.pacts ??= {})[p.kind] = state.turn;
        t.regard[a] += 5;
        t.regard[b] += 5;
        hearOf(state, a, b, `${state.civs[a].name} and ${state.civs[b].name} have bound themselves by ${PACT_NAME[p.kind]}.`, p.kind);
      } else send(state, p.from, { accord: p.cost });
    }
    // their pacts at work
    const pacts = t.pacts ?? {};
    if (pacts.archives !== undefined) {
      for (const [x, y] of [[a, b], [b, a]]) {
        const learnt = state.civs[y].flags.last_insight ?? 0;
        if (learnt > 0) send(state, x, { insight: learnt * ARCHIVE_SHARE });
      }
    }
    if (pacts.aid !== undefined) {
      for (const [x, y] of [[a, b], [b, a]]) {
        const weak = state.civs[x];
        const strong = state.civs[y];
        const m = (t.marks ??= {});
        const trouble = weak.energy < 30 && (weak.flags.last_energy_net ?? 0) < 0;
        if (!trouble || state.turn - (m[`aid_${y}`] ?? -99) < AID_EVERY || strong.energy < 120) continue;
        const e = Math.round(Math.min(60, (strong.energy - 100) / 2));
        if (e < 5) continue;
        m[`aid_${y}`] = state.turn;
        send(state, y, { energy: -e });
        // seen in trouble when its light arrives, and the beam takes as long again
        (t.beams ??= []).push({ to: x, at: lightIn(state, 2 * distanceBetween(state, x, y)), energy: e });
      }
    }
    if (t.beams?.length) {
      for (const beam of t.beams.filter((x) => arrived(state, x.at))) {
        send(state, beam.to, { energy: beam.energy });
        t.regard[beam.to] += 10;
      }
      t.beams = t.beams.filter((x) => !arrived(state, x.at));
      if (!t.beams.length) delete t.beams;
    }
  }
  // what reaches us
  if (state.tidings?.length) {
    for (const n of state.tidings.filter((x) => arrived(state, x.at))) {
      log(state, n.text, 'info', n.systemId);
      const t = n.tie ? ties[n.tie] : undefined;
      if (t && n.kind && t.pacts?.[n.kind] !== undefined) (t.heard ??= {})[n.kind] = true;
    }
    state.tidings = state.tidings.filter((x) => !arrived(state, x.at));
    if (!state.tidings.length) delete state.tidings;
  }
}

const PACT_NAME: Record<PactKind, string> = { aid: 'Mutual Aid', watch: 'Shared Watch', archives: 'Open Archives' };

/** Something between two others that we will hear of when its light, from the nearer of them, reaches our capital. */
function hearOf(state: GameState, a: string, b: string, text: string, kind?: PactKind): void {
  const me = state.civs[state.player];
  const cap = me.capitalId ? state.colonies[me.capitalId] : undefined;
  const here = state.systems[cap?.systemId ?? me.homeSystemId];
  const near = [a, b]
    .map((id) => ({ id, ly: distanceBetween(state, id, state.player) }))
    .sort((x, y) => x.ly - y.ly)[0];
  const sys = state.civs[near.id]?.capitalId ? state.colonies[state.civs[near.id].capitalId!]?.systemId : undefined;
  (state.tidings ??= []).push({ at: lightIn(state, here ? near.ly : 0), text, tie: tieKey(a, b), ...(kind ? { kind } : {}), ...(sys ? { systemId: sys } : {}) });
}

/** Shared Watch partners of another civilization: each stands it a little stronger against the Hunger (hunger.ts). */
export function watchPartners(state: GameState, id: string): number {
  let n = 0;
  for (const [k, t] of Object.entries(state.ties ?? {})) if (t.pacts?.watch !== undefined && k.split('|').includes(id)) n++;
  return n;
}

/** Another civilization's pacts with the others that we have heard of: with whom, and which. */
export function heardTies(state: GameState, id: string): { other: string; kinds: PactKind[] }[] {
  const out: { other: string; kinds: PactKind[] }[] = [];
  for (const [k, t] of Object.entries(state.ties ?? {})) {
    const pair = k.split('|');
    if (!pair.includes(id)) continue;
    const kinds = TIE_PACTS.filter((x) => t.pacts?.[x] !== undefined && t.heard?.[x]);
    if (kinds.length) out.push({ other: pair[0] === id ? pair[1] : pair[0], kinds });
  }
  return out;
}
