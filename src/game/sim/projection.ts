import { logTurnLength } from '../eras';
import { livedShare, turnStep } from './flare';
import { STRUCTURE_BY_ID } from '../data/structures';
import type { Colony, GameState, ThreadId } from '../types';
import { THREADS } from '../types';
import { capacity, colonyTurn, latticeAlienation, reserveCapacity, type ColonyTurn, type TurnContext } from './economy';
import { computeMods, strainFor, type Strain } from './mods';
import { researchDraw } from './research';
import { jointIncome } from './survivors';
import { beaconUpkeep } from './beacons';
import { colonies } from './util';
import { terraformingOf } from '../physics';
import { SEED_CAP, SEED_RATE, WORKS_WATER, habitabilityOf, terraformedWarmth } from './terraform';

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
  const step = turnStep(state, pace);
  const logL = logTurnLength(step);
  const ctx: TurnContext = { years: state.years, L: step.turnLength, logL, paceFactor: livedShare(state, pace, step), mods };
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
  p.energyOut += beaconUpkeep(state) * ctx.paceFactor;
  p.accord -= latticeAlienation(state, mods);
  p.researchDraw = researchDraw(state, p.insight);
  p.energyOut += p.researchDraw;
  for (const t of THREADS) p.strain[t] = strainFor(t, logL, mods, Math.log10(ctx.paceFactor));
  return p;
}

export interface BuildEffect {
  /** Change per turn at this settlement, at the current pace (net of upkeep). */
  energy: number;
  matter: number;
  industry: number;
  insight: number;
  accord: number;
  /** Extra room for each kind of people (and cold sleep). */
  room: Partial<Record<ThreadId | 'cryo', number>>;
  /** What it does that is not a yield. */
  notes: string[];
}

/**
 * What one more of a structure would change at this settlement next turn: the economy run
 * with and without it, so the numbers include this world's light, heat, richness, focus and pace.
 */
export function structureEffect(state: GameState, c: Colony, id: string, ctx: TurnContext): BuildEffect {
  const d = STRUCTURE_BY_ID[id];
  const more: Colony = { ...c, structures: { ...c.structures, [id]: (c.structures[id] ?? 0) + 1 } };
  const a = colonyTurn(state, c, ctx, state.civ.matter).y;
  const b = colonyTurn(state, more, ctx, state.civ.matter).y;
  const capA = capacity(state, c, ctx.mods);
  const capB = capacity(state, more, ctx.mods);
  const room: BuildEffect['room'] = {};
  for (const k of [...THREADS, 'cryo'] as const) if (capB[k] !== capA[k]) room[k] = capB[k] - capA[k];
  const notes: string[] = [];
  const e = b.energy - b.energyUpkeep - (a.energy - a.energyUpkeep);
  if (d.energy && b.energy - a.energy < 0.05) notes.push(d.energy.mode === 'light' ? 'No light to collect here right now' : 'Nothing for it to draw on here right now');
  if (d.reserveCap) notes.push(`Energy reserve +${d.reserveCap}`);
  if (d.burstCap) notes.push(`Catches final bursts: reserve +${d.burstCap}`);
  if (d.defense) notes.push(`Defence +${d.defense} against swarms and raids`);
  if (d.declineMult !== undefined && d.declineMult < 1) notes.push(`The world declines ${Math.round((1 - d.declineMult) * 100)}% slower`);
  if (d.warms) notes.push('Keeps this world alive after its star goes out');
  if (d.coreHeatBonus) notes.push(`Core heat +${Math.round(d.coreHeatBonus * 100)}% when built`);
  if (d.vitalityOnce) notes.push(`Vitality +${Math.round(d.vitalityOnce * 100)}% when built`);
  if (d.resolve) notes.push(`Resolve +${d.resolve} a turn`);
  if (d.decayProof) notes.push('Survives the end of matter (the Great Decay, or the Great Evaporation)');
  if (d.continuityMult) notes.push(`Continuity fades ${Math.round((1 - d.continuityMult) * 100)}% slower`);
  if (d.enables === 'upload') notes.push('Lets Kin upload into Echoes here');
  if (d.enables === 'merge') notes.push('Lets Echoes merge into the Chorus here');
  if (d.enables === 'cool') notes.push('Lets Echoes cool into Coldminds here');
  if (d.gfeDrain) notes.push('Drains the galaxy’s free energy');
  const w = state.bodies[c.bodyId];
  if (d.terraform && w) {
    if (d.terraform === 'seeding') notes.push(`Life spreads: vitality +${Math.round(SEED_RATE * 100)}% a turn, up to ${Math.round(SEED_CAP * 100)}%`);
    else {
      const h0 = habitabilityOf(state, w, c);
      const h1 = habitabilityOf(state, w, more);
      notes.push(`Habitability ${Math.round(h0 * 100)}% → ${Math.round(h1 * 100)}% here (warmest ground ${Math.round(terraformedWarmth(state, w, terraformingOf(state, w, more)))} K)`);
      if (d.terraform === 'works' && (w.water ?? 0) < WORKS_WATER) notes.push(`Brings water in with the air: ${Math.round(WORKS_WATER * 100)}% of the surface`);
      if (w.vitality <= 0) notes.push('Room for Kin comes once life takes hold (Biosphere Seeding)');
    }
  }
  if (d.signature >= 2) notes.push('Bright: draws the Hunger');
  return { energy: e, matter: b.matter - b.matterUpkeep - (a.matter - a.matterUpkeep), industry: b.industry - a.industry, insight: b.insight - a.insight, accord: b.accord - a.accord, room, notes };
}
