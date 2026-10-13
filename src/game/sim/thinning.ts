// The Thinning (the new version, part 3-3): the last decades of ordinary matter. If protons decay,
// from η 37.5 matter dissolves in earnest, system by system (physics.ts), until the Great Decay at
// η 39; under curvature radiation the worlds evaporate after the brown dwarfs have faded (η 87),
// until the Great Evaporation at η 89.5. Meanwhile whatever is still made of matter thins with it:
// its structures fail one by one, the share still standing following the share of matter left,
// and what mines and skimmers bring in falls as well. Decay-proof structures do not fail, nor
// anything at a settlement that made the Passage (it is not made of matter any more).

import { STRUCTURE_BY_ID, structureLabel } from '../data/structures';
import { BROWN_FADE_ETA } from '../physics';
import { MATTER_DISSOLVES, MATTER_END, fateOf, matterGone } from '../fate';
import type { Colony, GameState } from '../types';
import { colonies, formOf, log, withRng } from './util';

/** Where the Thinning begins (η), by fate: as matter dissolves in earnest, or as the worlds evaporate after the brown dwarfs. */
export function thinningFrom(state: GameState): number {
  const fate = fateOf(state);
  return fate === 'decay' ? MATTER_DISSOLVES : fate === 'curvature' ? BROWN_FADE_ETA : Infinity;
}

/** The share of ordinary matter gone by η: none before the Thinning, all of it at the end of matter. */
export function thinShare(state: GameState, eta = state.eta): number {
  const from = thinningFrom(state);
  if (!isFinite(from) || matterGone(state)) return 0;
  const end = MATTER_END[fateOf(state)];
  return Math.max(0, Math.min(1, (eta - from) / (end - from)));
}

/** Is it thinning now? */
export function thinning(state: GameState): boolean {
  return thinShare(state) > 0;
}

/** What at this settlement is still made of matter, and can fail: all but its decay-proof structures, and nothing once it has made the Passage. */
export function ofMatter(c: Colony): string[] {
  if (formOf(c) !== 'baryonic') return [];
  return Object.keys(c.structures).filter((id) => (c.structures[id] ?? 0) > 0 && STRUCTURE_BY_ID[id] && !STRUCTURE_BY_ID[id].decayProof);
}

/**
 * The Thinning, each turn, for the civilization whose part it is (the turn runs from η `from` to
 * `to`): each structure still made of matter fails with the chance that keeps the share standing at
 * the share of matter left, and the Record names what went, a line for each settlement.
 */
export function theThinning(state: GameState, from: number, to: number) {
  const before = thinShare(state, from);
  const after = thinShare(state, to);
  if (after <= before || before >= 1) return;
  const fail = 1 - (1 - after) / (1 - before);
  const how = fateOf(state) === 'decay' ? 'decayed' : 'evaporated';
  for (const c of colonies(state)) {
    const ids = ofMatter(c);
    if (!ids.length) continue;
    const sys = state.systems[c.systemId];
    const gone: string[] = [];
    withRng(state, (rng) => {
      for (const id of ids) {
        let n = 0;
        for (let i = 0; i < (c.structures[id] ?? 0); i++) if (rng.chance(fail)) n++;
        if (!n) continue;
        c.structures[id] -= n;
        if (c.structures[id] <= 0) delete c.structures[id];
        const name = structureLabel(id, sys).name;
        gone.push(n === 1 ? name : `${n} × ${name}`);
      }
    });
    if (gone.length) log(state, `${c.name}: the matter is thinning. ${listed(gone)} ${gone.length === 1 && !/^\d/.test(gone[0]) ? 'has' : 'have'} ${how} away.`, 'bad', c.systemId);
  }
}

/** "A", "A and B", "A, B and C". */
function listed(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}
