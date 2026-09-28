import { logTurnLength, stepTime } from '../eras';
import type { GameState, ThreadId } from '../types';
import { THREADS } from '../types';
import { colonyTurn, latticeAlienation, reserveCapacity, type ColonyTurn, type TurnContext } from './economy';
import { computeMods, strainFor, type Strain } from './mods';
import { researchDraw } from './research';
import { jointIncome } from './survivors';
import { colonies } from './util';

export interface Projection {
  ctx: TurnContext;
  turnYears: number;
  energyIn: number;
  energyOut: number;
  matterIn: number;
  matterOut: number;
  industry: number;
  insight: number;
  accord: number;
  reserveCap: number;
  researchDraw: number;
  perColony: Record<string, ColonyTurn>;
  strain: Record<ThreadId, Strain>;
}

/** What the coming turn will look like at the current pace, without changing anything. */
export function project(state: GameState, paceOverride?: number): Projection {
  const mods = computeMods(state);
  const pace = paceOverride ?? state.civ.pace;
  const step = stepTime(state.era, state.years, state.eta, pace, state.settings.length);
  const logL = logTurnLength(step);
  const ctx: TurnContext = { years: state.years, L: step.turnLength, logL, paceFactor: Math.pow(10, -pace), mods };
  const p: Projection = {
    ctx,
    turnYears: step.turnLength,
    energyIn: 0,
    energyOut: 0,
    matterIn: 0,
    matterOut: 0,
    industry: 0,
    insight: 0,
    accord: 0,
    reserveCap: reserveCapacity(state, mods),
    researchDraw: 0,
    perColony: {},
    strain: {} as Record<ThreadId, Strain>,
  };
  let matterAvail = state.civ.matter;
  for (const c of colonies(state)) {
    const t = colonyTurn(state, c, ctx, matterAvail);
    matterAvail -= t.matterBurn;
    p.perColony[c.id] = t;
    p.energyIn += t.y.energy;
    p.energyOut += t.y.energyUpkeep;
    p.matterIn += t.y.matter;
    p.matterOut += t.y.matterUpkeep;
    p.industry += t.y.industry;
    p.insight += t.y.insight;
    p.accord += t.y.accord;
  }
  p.energyIn += jointIncome(state) * ctx.paceFactor;
  p.accord -= latticeAlienation(state, mods);
  p.researchDraw = researchDraw(state, p.insight);
  p.energyOut += p.researchDraw;
  for (const t of THREADS) p.strain[t] = strainFor(t, logL, mods, -pace);
  return p;
}
