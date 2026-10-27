// The governor (27 Oct, the player: "add a governor like in alpha centauri to set a focus on
// building buildings of a certain category pls", then "allow me to mark different worlds in system
// view to set the governor to"): a settlement handed one picks its next build itself, of the one
// kind it was set to, whenever its queue is empty; what the player queues comes first.

import { STRUCTURE_KINDS, structureKind, type StructureDef, type StructureKind } from '../data/structures';
import type { Colony, GameState } from '../types';
import { buildCost, buildableStructures, queueBuild } from './actions';
import { MATTER_AS_ENERGY, type TurnContext } from './economy';
import { project, structureEffect } from './projection';
import { governed, govNoneKey, ownColony } from './util';

/** What it leaves in store, as the autoplayer does (`tryBuild`): it never spends the last of it. */
export const GOVERNOR_KEEPS = { matter: 10, energy: 20 };

export function governorName(kind: StructureKind): string {
  return STRUCTURE_KINDS.find((k) => k.id === kind)?.name ?? kind;
}

/**
 * What one more of a structure gives this settlement, by the measure of the governor's kind: the
 * yield for a yield's kind, the room for People, the reserve for Storage; World and Defence have no
 * yield to weigh, so each counts one (the cheapest first). The economy run with and without it
 * (`structureEffect`), so this world's light, heat, richness and pace are in it.
 */
function worth(state: GameState, c: Colony, d: StructureDef, kind: StructureKind, ctx: TurnContext): number {
  if (kind === 'world' || kind === 'defence') return 1;
  if (kind === 'storage') return ((d.reserveCap ?? 0) + (d.burstCap ?? 0)) * ctx.mods.reserveMult;
  const fx = structureEffect(state, c, d.id, ctx);
  if (kind === 'people') return Object.values(fx.room).reduce((a, v) => a + Math.max(0, v ?? 0), 0);
  return kind === 'energy' ? fx.energy : kind === 'matter' ? fx.matter : kind === 'industry' ? fx.industry : kind === 'insight' ? fx.insight : fx.accord;
}

export interface GovernorChoice {
  /** The structure it queues next, or null. */
  pick: StructureDef | null;
  /** Why not, in words, where it picks none. */
  why: string;
  /** Nothing of its kind is worth building here (not merely waiting for matter): the settlement is idle. */
  none: boolean;
}

/**
 * The structure of the governor's kind that gives this settlement the most for what it costs, of
 * those we can pay for while keeping `GOVERNOR_KEEPS`; never one that would give nothing here.
 */
export function governorChoice(state: GameState, c: Colony, ctx: TurnContext): GovernorChoice {
  const kind = c.governor;
  if (!kind) return { pick: null, why: 'no governor', none: false };
  const name = governorName(kind);
  if (state.civ.dormant) return { pick: null, why: 'asleep: nothing is built while we sleep', none: false };
  const options = buildableStructures(state, c)
    .filter((x) => !x.error && structureKind(x.def) === kind)
    .map(({ def }) => {
      const cost = buildCost(state, def, false);
      return { def, cost, value: worth(state, c, def, kind, ctx) };
    })
    .filter((x) => x.value > 0.05)
    .map((x) => ({ ...x, score: x.value / Math.max(1, x.cost.industry + x.cost.matter + x.cost.energy / MATTER_AS_ENERGY) }))
    .sort((a, b) => b.score - a.score || a.def.cost - b.def.cost);
  if (!options.length) return { pick: null, why: `nothing more of ${name} worth building here`, none: true };
  const paid = options.find((x) => state.civ.matter >= x.cost.matter + (x.cost.matter > 0 ? GOVERNOR_KEEPS.matter : 0) && state.civ.energy >= x.cost.energy + (x.cost.energy > 0 ? GOVERNOR_KEEPS.energy : 0));
  if (paid) return { pick: paid.def, why: '', none: false };
  const best = options[0];
  const what = best.cost.matter > 0 ? `${best.cost.matter + GOVERNOR_KEEPS.matter} matter` : `${best.cost.energy + GOVERNOR_KEEPS.energy} energy`;
  return { pick: null, why: `waiting for ${what} for a ${best.def.name}`, none: false };
}

/**
 * Queue the governor's pick if the queue is empty, and keep what it found (`govNoneKey`: nothing
 * worth building, or waiting to pay) for the idle notices and the forecast. Returns whether it
 * queued one.
 */
export function governorQueue(state: GameState, c: Colony, ctx: TurnContext): boolean {
  const key = govNoneKey(c.id);
  if (!c.governor || c.queue.length) {
    delete state.civ.flags[key];
    return false;
  }
  const g = governorChoice(state, c, ctx);
  if (g.none) state.civ.flags[key] = 1;
  else if (!g.pick) state.civ.flags[key] = 2;
  else delete state.civ.flags[key];
  return !!g.pick && queueBuild(state, c.id, 'structure', g.pick.id) === null;
}

/** Hand these settlements to a governor of one kind, or take it back (null); one with nothing queued picks at once. */
export function setGovernor(state: GameState, colonyIds: string[], kind: StructureKind | null): string | null {
  const cs = colonyIds.map((id) => ownColony(state, id)).filter((c): c is Colony => !!c);
  if (!cs.length) return 'No such settlement.';
  const ctx = project(state).ctx;
  for (const c of cs) {
    if (kind) c.governor = kind;
    else delete c.governor;
    governorQueue(state, c, ctx);
  }
  return null;
}

/**
 * Whether a settlement is idle: nothing queued, no governor with something to build (or to wait
 * for), and no spare work chosen.
 */
export function isIdle(state: GameState, c: Colony): boolean {
  if (c.queue.length || governed(state, c)) return false;
  return !c.spare;
}
