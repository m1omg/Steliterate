import { formatYears, logTurnLength } from '../eras';
import { effectivePace, livedShare, turnStep, upkeepShare } from './flare';
import { STRUCTURE_BY_ID } from '../data/structures';
import type { Colony, GameState, ThreadId } from '../types';
import { THREADS } from '../types';
import { capacity, colonyTurn, latticeAlienation, reserveCapacity, type ColonyTurn, type TurnContext } from './economy';
import { BURST_CATCH } from './crossing';
import { computeMods, strainFor, type Strain } from './mods';
import { researchDraw } from './research';
import { jointIncome } from './survivors';
import { beaconUpkeep } from './beacons';
import { colonies } from './util';
import { spareYield } from './spare';
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

/** What a settlement's industry leaves over for its spare work this turn: all of it with nothing queued, else what finishing its queue does not take (as the turn spends it, eight items at most). */
export function spareLeft(c: Colony, industry: number): number {
  if (c.queue.length > 8) return 0;
  let left = industry;
  for (const q of c.queue) left -= Math.max(0, q.cost - q.progress);
  return Math.max(0, left);
}

/** What the coming turn will look like at the current pace, without changing anything. */
export function project(state: GameState, paceOverride?: number): Projection {
  const mods = computeMods(state);
  const pace = paceOverride ?? effectivePace(state);
  const step = turnStep(state, pace);
  const logL = logTurnLength(step);
  const ctx: TurnContext = { years: state.years, L: step.turnLength, logL, paceFactor: livedShare(state, pace, step), upkeepShare: upkeepShare(state, pace, step), mods };
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
    // and what its spare work will make of the industry its queue leaves over (turn.ts: applyIndustry)
    if (!state.civ.dormant) {
      const sp = spareYield(state, c, spareLeft(c, t.y.industry), t.y.energy);
      p.energyIn += sp.energy;
      p.matterIn += sp.matter;
      p.insight += sp.insight;
    }
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
 * Why a light collector would gather nothing here. Most often a new star too brief for the turn:
 * a collector gathers the turn's average, and a helium giant's 120,000 years are next to nothing
 * of a turn of billions of years, however it blazes, unless we keep time with it (26 Oct, the
 * player: "no light to collect, really ninja xD?").
 */
function noLight(state: GameState, c: Colony, ctx: TurnContext): string {
  const p = state.systems[c.systemId]?.primary;
  const left = p?.diesAt !== undefined ? p.diesAt - ctx.years : 0;
  if (p && (p.kind === 'collision_star' || p.kind === 'helium_star' || p.kind === 'helium_giant') && left > 0 && left < ctx.L)
    return `Its star shines only ${formatYears(left)} of this turn’s ${formatYears(ctx.L)}: too brief to gather, unless we keep time with it`;
  return 'No light to collect here right now';
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
  if (d.energy && b.energy - a.energy < 0.05) notes.push(d.energy.mode === 'light' ? noLight(state, c, ctx) : 'Nothing for it to draw on here right now');
  notes.push(...standingNotes(state, c, more, id, ctx, 1, false));
  return { energy: e, matter: b.matter - b.matterUpkeep - (a.matter - a.matterUpkeep), industry: b.industry - a.industry, insight: b.insight - a.insight, accord: b.accord - a.accord, room, notes };
}

/**
 * What `n` of a structure do that is not a yield, as the build list and a built one's tip say it.
 * `withIt` is the settlement with them, `c` without (for a terraformer's habitability); `built`:
 * they stand already, so what they did once, when built, is not said again.
 */
function standingNotes(state: GameState, c: Colony, withIt: Colony, id: string, ctx: TurnContext, n: number, built: boolean): string[] {
  const d = STRUCTURE_BY_ID[id];
  const notes: string[] = [];
  // one reserve, whatever fills it (storage.ts): a burst caught lands in it too, and Deep Storage's
  // quarter more counts (26 Oct, the player: "how much these actually increase my storage")
  if (d.reserveCap || d.burstCap) notes.push(`Energy reserve +${Math.floor(((d.reserveCap ?? 0) + (d.burstCap ?? 0)) * n * ctx.mods.reserveMult)}`);
  if (id === 'burst_catcher') notes.push(`Catches bursts: up to +${BURST_CATCH * n} energy each into the reserve, even past its limit until the next turn ends (a black hole’s final burst here; a neutron star’s burst, a star that lights and goes out within a turn, or another flash nearby)`);
  if (d.defense) notes.push(`Defence +${d.defense * n} against swarms and raids`);
  if (d.declineMult !== undefined && d.declineMult < 1) notes.push(`The world declines ${Math.round((1 - d.declineMult) * 100)}% slower`);
  if (d.warms) notes.push('Keeps this world alive after its star goes out');
  if (d.coreHeatBonus && !built) notes.push(`Core heat +${Math.round(d.coreHeatBonus * 100)}% when built`);
  if (d.vitalityOnce && !built) notes.push(`Vitality +${Math.round(d.vitalityOnce * 100)}% when built`);
  if (d.resolve) notes.push(`Resolve +${Math.round(d.resolve * n * 10) / 10} a turn`);
  if (d.decayProof) notes.push('Survives the end of matter (the Great Decay, or the Great Evaporation)');
  if (d.continuityMult) notes.push(`Continuity fades ${Math.round((1 - Math.pow(d.continuityMult, n)) * 100)}% slower`);
  if (d.enables === 'upload') notes.push('Lets Kin upload into Echoes here');
  if (d.enables === 'merge') notes.push('Lets Echoes merge into the Chorus here');
  if (d.enables === 'cool') notes.push('Lets Echoes cool into Coldminds here');
  if (d.gfeDrain) notes.push('Drains the galaxy’s free energy');
  const w = state.bodies[c.bodyId];
  if (d.terraform && w) {
    if (d.terraform === 'seeding') notes.push(`Life spreads: vitality +${Math.round(SEED_RATE * 100)}% a turn at the Tide, up to ${Math.round(SEED_CAP * 100)}%`);
    else {
      const h0 = habitabilityOf(state, w, c);
      const h1 = habitabilityOf(state, w, withIt);
      const warm = `warmest ground ${Math.round(terraformedWarmth(state, w, terraformingOf(state, w, withIt)))} K`;
      notes.push(built ? `Habitability ${Math.round(h1 * 100)}% here, ${Math.round(h0 * 100)}% without ${n > 1 ? 'them' : 'it'} (${warm})` : `Habitability ${Math.round(h0 * 100)}% → ${Math.round(h1 * 100)}% here (${warm})`);
      if (d.terraform === 'works' && (w.water ?? 0) < WORKS_WATER && !built) notes.push(`Brings water in with the air: ${Math.round(WORKS_WATER * 100)}% of the surface`);
      if (w.vitality <= 0) notes.push('Room for Kin comes once life takes hold (Biosphere Seeding)');
    }
  }
  if (d.signature >= 2) notes.push('Bright: draws the Hunger');
  return notes;
}

/** What the structures of a kind standing at a settlement do for it now, and why they give nothing if they do not. */
export interface BuiltEffect extends BuildEffect {
  /** Why they make nothing (the economy's own words for it), where they make nothing. */
  why?: string;
  /** They make nothing here now, and the economy says why (`why`): nothing to gather, no Lattice to run them, out of reach. */
  idle: boolean;
}

/**
 * What every structure of a kind standing at this settlement gives it now, per turn: the economy
 * run with them and without them, so the figures are what they really give here, this turn
 * (26 Oct, the player: "the buildings should show what their current real effect/benefit or lack
 * thereof is").
 */
export function builtEffect(state: GameState, c: Colony, id: string, ctx: TurnContext): BuiltEffect {
  const d = STRUCTURE_BY_ID[id];
  const n = c.structures[id] ?? 0;
  const less: Colony = { ...c, structures: { ...c.structures, [id]: 0 } };
  const a = colonyTurn(state, less, ctx, state.civ.matter).y;
  const b = colonyTurn(state, c, ctx, state.civ.matter).y;
  const capA = capacity(state, less, ctx.mods);
  const capB = capacity(state, c, ctx.mods);
  const room: BuildEffect['room'] = {};
  for (const k of [...THREADS, 'cryo'] as const) if (capB[k] !== capA[k]) room[k] = capB[k] - capA[k];
  const fx = { energy: b.energy - b.energyUpkeep - (a.energy - a.energyUpkeep), matter: b.matter - b.matterUpkeep - (a.matter - a.matterUpkeep), industry: b.industry - a.industry, insight: b.insight - a.insight, accord: b.accord - a.accord };
  const notes = standingNotes(state, less, c, id, ctx, n, true);
  // the economy's own line for them says why they make nothing, where they do not ("2× Glow Array: nothing to gather")
  const head = `${n > 1 ? `${n}× ` : ''}${d.name}: `;
  let why = b.lines.find((l) => l.label.startsWith(head))?.label.slice(head.length);
  const made = fx.matter > 0.05 || fx.industry > 0.05 || fx.insight > 0.05 || fx.accord > 0.05 || b.energy - a.energy > 0.05;
  if (!why && d.energy && b.energy - a.energy < 0.05) why = d.energy.mode === 'light' ? noLight(state, c, ctx) : 'nothing for it to draw on here right now';
  const idle = !!why && !made && !Object.keys(room).length;
  return { ...fx, room, notes, ...(idle ? { why: why!.charAt(0).toLowerCase() + why!.slice(1) } : {}), idle };
}

/**
 * A built structure's effect in words, for its tip: "Now, all 3: +18.6 energy, +2 industry; …".
 * Empty for one whose work is not a yield or a note here (a Shipyard builds ships; its own text says so).
 */
export function builtEffectText(fx: BuiltEffect, n: number): string {
  const num = (v: number) => `${v > 0 ? '+' : '−'}${Math.abs(v) >= 10 ? Math.round(Math.abs(v)) : Math.abs(v).toFixed(1)}`;
  const parts: string[] = [];
  for (const [k, v] of [['energy', fx.energy], ['matter', fx.matter], ['industry', fx.industry], ['insight', fx.insight], ['accord', fx.accord]] as const) if (Math.abs(v) >= 0.05) parts.push(`${num(v)} ${k}`);
  for (const [k, v] of Object.entries(fx.room)) if (v) parts.push(`room for ${v > 0 ? '' : '−'}${Math.abs(v)} ${k === 'cryo' ? 'in cold sleep' : k === 'kin' ? 'Kin' : k === 'echoes' ? 'Echoes' : k === 'chorus' ? 'of the Chorus' : k === 'lattice' ? 'Lattice' : 'Coldminds'}`);
  const head = n > 1 ? `Now, all ${n}` : 'Now';
  const yields = parts.join(', ');
  const rest = fx.notes.join('; ');
  if (fx.why) return `${head}: ${yields ? `${yields}, and ` : ''}nothing made (${fx.why})${rest ? `; ${rest}` : ''}`;
  if (!yields && !rest) return '';
  return `${head}: ${[yields, rest].filter(Boolean).join('; ')}`;
}
