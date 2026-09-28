import { STRUCTURE_BY_ID, type StructureDef } from '../data/structures';
import { THREAD_DEFS } from '../data/threads';
import { hawkingLight, sourceLight } from '../physics';
import type { Colony, GameState, ThreadId, YieldBreakdown, YieldLine } from '../types';
import { THREADS } from '../types';
import { type Mods, strainFor, type Strain } from './mods';
import { clamp, colonies, eraIndex } from './util';

export interface TurnContext {
  years: number; // start of the coming turn
  L: number; // its length in years (Infinity in deep time)
  logL: number;
  paceFactor: number; // share of the Tide turn actually lived: 10^-pace
  mods: Mods;
}

export type Capacity = Record<ThreadId, number> & { cryo: number };

export function kinBaseCapacity(state: GameState, c: Colony, mods: Mods): number {
  const b = state.bodies[c.bodyId];
  if (!b || b.dissolved) return 0;
  const base = Math.round(12 * b.habitability);
  let vit = b.vitality;
  if (mods.flags.has('hardy')) vit = Math.pow(vit, 0.6);
  let cap = Math.floor(base * vit);
  if (mods.flags.has('charter:abandon_the_surface')) cap = Math.max(cap, Math.floor(base * 0.6));
  if (b.rogue || b.feeding) cap = Math.floor(cap * 0.3);
  return cap;
}

export function capacity(state: GameState, c: Colony, mods: Mods): Capacity {
  const cap: Capacity = { kin: kinBaseCapacity(state, c, mods), echoes: 0, chorus: 0, lattice: 0, coldminds: 0, cryo: 0 };
  for (const [id, n] of Object.entries(c.structures)) {
    const d = STRUCTURE_BY_ID[id];
    if (!d || !n) continue;
    for (const t of THREADS) cap[t] += (d.cap?.[t] ?? 0) * n;
    cap.cryo += (d.cryoCap ?? 0) * n;
  }
  return cap;
}

export function reserveCapacity(state: GameState, mods: Mods): number {
  let cap = 100;
  for (const c of colonies(state)) {
    for (const [id, n] of Object.entries(c.structures)) {
      const d = STRUCTURE_BY_ID[id];
      if (!d || !n) continue;
      cap += ((d.reserveCap ?? 0) + (d.burstCap ?? 0)) * n;
    }
  }
  return cap * mods.reserveMult;
}

/** Resolve and dissent scale what everyone manages to do. */
export function moraleMultiplier(state: GameState): number {
  const civ = state.civ;
  const r = 0.7 + 0.6 * (civ.resolve / 100);
  const d = 1 - Math.max(0, civ.dissent - 40) / 150;
  return clamp(r * d, 0.3, 1.3);
}

export interface ColonyTurn {
  y: YieldBreakdown;
  spinDraw: number; // spin energy drawn from the system's reservoir
  matterBurn: number; // matter fed to fusion / accretion
  strain: Record<ThreadId, Strain>;
  depletion: number; // matter extracted from the body's finite deposits
}

function focusMul(c: Colony, key: 'energy' | 'industry' | 'insight' | 'accord'): number {
  if (c.focus === 'balanced') return 1;
  if (c.focus === key) return key === 'accord' ? 1.4 : key === 'energy' ? 1.25 : 1.3;
  return 0.9;
}

/** Everything a settlement produces and consumes in the coming turn. Does not mutate state. */
export function colonyTurn(state: GameState, c: Colony, ctx: TurnContext, matterAvailable: number): ColonyTurn {
  const civ = state.civ;
  const body = state.bodies[c.bodyId];
  const sys = state.systems[c.systemId];
  const lines: YieldLine[] = [];
  const dormant = civ.dormant;
  const flags = ctx.mods.flags;
  const morale = moraleMultiplier(state);
  const wake = civ.wakeBonus > 0 ? 1.3 : 1;
  const blackout = flags.has('charter:blackout') ? 0.9 : 1;
  const out = dormant ? 0 : morale * wake * blackout;
  const taintBoost = 1 + civ.taint / 200;
  const overdrive = c.overdrive ? 1.5 : 1;
  const pf = ctx.paceFactor;

  let energy = 0;
  let energyUpkeep = 0;
  let matter = 0;
  let matterUpkeep = 0;
  let industry = 0;
  let insight = 0;
  let accord = 0;
  let spinDraw = 0;
  let matterBurn = 0;
  let depletion = 0;

  // ---- populations
  const strain = {} as Record<ThreadId, Strain>;
  const upkeepScale = dormant ? (flags.has('charter:the_long_watch') ? 0.05 : 0.1) : 1;
  // machines and sleepers run for the whole of a slowed turn; only minds can slow themselves down
  const slowTime = Math.max(1, pf);
  for (const t of THREADS) {
    const n = c.pops[t];
    const s = strainFor(t, ctx.logL, ctx.mods, Math.log10(ctx.paceFactor));
    strain[t] = s;
    if (n <= 0) continue;
    const d = THREAD_DEFS[t];
    let o = s.outMul * out;
    if (t === 'lattice' && flags.has('charter:lattice_compact')) o *= 1.15;
    const ind = n * d.industry * o;
    const ins = n * d.insight * o;
    const acc = n * d.accord * o;
    const eUp = n * d.energyUpkeep * s.upkeepMul * ctx.mods.upkeep[t] * upkeepScale;
    const mUp = n * d.matterUpkeep * upkeepScale;
    industry += ind;
    insight += ins;
    accord += acc;
    energyUpkeep += eUp;
    matterUpkeep += mUp;
    lines.push({ label: `${n} ${n === 1 ? d.one : d.name}${Math.abs(s.m) > 0.05 ? ` (strain ${s.m > 0 ? '+' : ''}${s.m.toFixed(1)})` : ''}`, industry: ind, insight: ins, accord: acc, energy: -eUp, matter: -mUp });
  }
  if (c.cryo > 0) {
    const cu = c.cryo * 0.08 * (flags.has('charter:cold_sleep_lottery') ? 0.5 : 1) * slowTime;
    energyUpkeep += cu;
    lines.push({ label: `${c.cryo} Kin in Cold Sleep`, energy: -cu });
  }

  // ---- structures
  const light = sourceLight(state, sys, ctx.years, isFinite(ctx.L) ? ctx.L : 0);
  // housing costs upkeep only for the share of it that is lived in
  const capAll = capacity(state, c, ctx.mods);
  const occupancy = (d: StructureDef): number => {
    let have = 0;
    let room = 0;
    for (const t of THREADS) {
      const k = d.cap?.[t] ?? 0;
      if (!k) continue;
      room += capAll[t];
      have += Math.min(c.pops[t], capAll[t]);
    }
    if (d.cryoCap) {
      room += capAll.cryo;
      have += Math.min(c.cryo, capAll.cryo);
    }
    return room > 0 ? Math.max(0.1, have / room) : 1;
  };
  const gfeMatter = 0.4 + 0.6 * state.gfe;
  let spinLeft = sys.primary.spin;
  for (const [id, n] of Object.entries(c.structures)) {
    const d: StructureDef | undefined = STRUCTURE_BY_ID[id];
    if (!d || !n) continue;
    let e = 0;
    if (d.energy) {
      const a = d.energy.amount * n;
      switch (d.energy.mode) {
        case 'light':
          e = a * light.light * (body.rogue ? 0 : 1);
          if (flags.has('halo_siphons') && sys.primary.halo && state.era === 'degenerate') e *= 2;
          if (civ.flags.ember_restraint && sys.primary.halo && state.era === 'degenerate') e *= 0.75;
          break;
        case 'geo':
          e = a * body.coreHeat;
          break;
        case 'rekindle':
          e = a * (sys.primary.rekindle ?? 0);
          break;
        case 'fusion':
        case 'accretion': {
          const want = (d.energy.input ?? 1) * n * pf;
          const got = Math.min(want, Math.max(0, matterAvailable - matterBurn));
          matterBurn += got;
          e = (want > 0 ? got / want : 0) * a;
          break;
        }
        case 'spin': {
          const draw = Math.min(a * pf, Math.max(0, spinLeft));
          spinLeft -= draw;
          spinDraw += draw;
          e = pf > 0 ? draw / pf : 0;
          break;
        }
        case 'hawking':
          e = a * hawkingLight(sys.primary, ctx.years);
          break;
        case 'decay': {
          const eta = Math.log10(Math.max(1, ctx.years));
          e = state.protonsDecay && state.era === 'degenerate' && eta > 30 ? a * clamp((eta - 30) / 6, 0.2, 1) : 0;
          break;
        }
        case 'siphon':
          e = state.era === 'dark' ? a : 0;
          break;
      }
      e *= pf * overdrive * focusMul(c, 'energy') * taintBoost;
    }
    let mt = 0;
    if (d.matterYield) mt += d.matterYield * n * body.richness * gfeMatter;
    if (d.hydrogenYield) mt += d.hydrogenYield * n * body.hydrogen * gfeMatter;
    if (d.lift) mt += d.lift * n * gfeMatter;
    if (mt) {
      mt *= pf * taintBoost * (flags.has('hunger_engines') ? 1.4 : 1);
      depletion += (d.matterYield || d.hydrogenYield ? mt : 0);
      if (!state.protonsDecay || eraIndex(state.era) < 2) matter += mt;
    }
    const ind = (d.industry ?? 0) * n * out;
    const ins = (d.insight ?? 0) * n * out;
    const acc = (d.accord ?? 0) * n * out;
    const up = (d.upkeep ?? 0) * n * upkeepScale * slowTime * (d.cap || d.cryoCap ? occupancy(d) : 1);
    energy += e;
    industry += ind;
    insight += ins;
    accord += acc;
    energyUpkeep += up;
    if (e || mt || ind || ins || acc || up) lines.push({ label: `${n > 1 ? `${n}× ` : ''}${d.name}`, energy: e - up, matter: mt, industry: ind, insight: ins, accord: acc });
  }
  if (matterBurn > 0) lines.push({ label: 'Fuel burned', matter: -matterBurn });

  // ---- the Hearth: every settlement's own power core, fed by whatever is local
  if (!body.dissolved) {
    const hole = sys.primary.kind === 'black_hole' || sys.primary.kind === 'smbh';
    // at a black hole the Hearth draws on its spin and the thin gas still falling in
    const local = Math.max(0.25, Math.min(1.5, body.rogue ? 0 : light.light), body.coreHeat * 0.8, hole && eraIndex(state.era) >= 1 ? 1 : 0);
    const hearth = 2 * local * (1 - c.damage) * pf * overdrive * focusMul(c, 'energy') * taintBoost;
    energy += hearth;
    lines.push({ label: c.overdrive ? 'Hearth (overdriven)' : 'Hearth', energy: hearth });
  }

  industry *= ctx.mods.industryMult * focusMul(c, 'industry');
  insight *= ctx.mods.insightMult * focusMul(c, 'insight');
  accord *= focusMul(c, 'accord');
  if (flags.has('charters')) accord += dormant ? 0 : 0.5;

  const y: YieldBreakdown = {
    energy,
    energyUpkeep,
    matter,
    matterUpkeep: matterUpkeep + matterBurn,
    industry,
    insight,
    accord,
    lines,
  };
  return { y, spinDraw, matterBurn, strain, depletion };
}

/** Civilization-wide Lattice resentment (the other Threads dislike being outnumbered by machines). */
export function latticeAlienation(state: GameState, mods: Mods): number {
  if (mods.flags.has('charter:lattice_compact')) return 0;
  let lattice = 0;
  let conscious = 0;
  for (const c of colonies(state)) {
    lattice += c.pops.lattice;
    conscious += c.pops.kin + c.pops.echoes + c.pops.chorus + c.pops.coldminds;
  }
  if (lattice + conscious === 0) return 0;
  return 0.25 * lattice * Math.min(1, conscious / Math.max(1, lattice + conscious) * 2);
}
