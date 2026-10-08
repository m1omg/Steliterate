import { STRUCTURE_BY_ID, type StructureDef } from '../data/structures';
import { THREAD_DEFS } from '../data/threads';
import { hawkingLight, insolation, sourceLight } from '../physics';
import type { Colony, GameState, ThreadId, YieldBreakdown, YieldLine } from '../types';
import { THREADS } from '../types';
import { THAW_ROOM, scorched, thawed } from './flare';
import { habitabilityOf } from './terraform';
import { type Mods, strainFor, type Strain } from './mods';
import { clamp, colonies, eraIndex } from './util';
import { calendarEra, fateOf, matterGone } from '../fate';
import { FLOW_DORMANT, FLOW_WATCH, flowing, keeping } from './flow';

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
  // a flaring star: nowhere on the surface is livable, not even the night side
  if (scorched(state, b)) return 0;
  const base = Math.round(12 * habitabilityOf(state, b, c));
  let vit = b.vitality;
  if (mods.flags.has('hardy')) vit = Math.pow(vit, 0.6);
  let cap = Math.floor(base * vit);
  if (mods.flags.has('charter:abandon_the_surface')) cap = Math.max(cap, Math.floor(base * 0.6));
  if (b.rogue || b.feeding) cap = Math.floor(cap * 0.3);
  // a frozen world melted into warm sea by a flaring star: room to live by the water, for now
  if (thawed(state, b) === 'warm') cap = Math.max(cap, THAW_ROOM);
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

export { reserveCapacity } from './storage';

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

function focusMul(c: Colony, key: 'energy' | 'matter' | 'industry' | 'insight' | 'accord'): number {
  if (c.focus === 'balanced') return 1;
  if (c.focus === key) return key === 'accord' ? 1.4 : key === 'energy' || key === 'matter' ? 1.25 : 1.3;
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

  const light = sourceLight(state, sys, ctx.years, isFinite(ctx.L) ? ctx.L : 0);
  // under a dark sky (a star with no light left to give) cold computing is cheaper: erasing a bit
  // costs kT ln 2, and nothing is colder than the dark, so Coldminds and Cold Vaults keep for half
  const darkSky = light.light <= 0;

  // ---- populations
  const strain = {} as Record<ThreadId, Strain>;
  // after the Long Flow even a sleeping civilization must wake its watchers to mend (unless someone is always awake)
  const flowNow = flowing(state);
  const upkeepScale = dormant ? (flags.has('charter:the_long_watch') ? 0.05 : flowNow ? FLOW_DORMANT : 0.1) : 1;
  // minds that all think slower than the flow keep watchers awake between their thoughts
  const watch = flowNow && keeping(c, ctx.logL, ctx.mods, Math.log10(ctx.paceFactor)) === 'watched' ? FLOW_WATCH : 1;
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
    const eUp = n * d.energyUpkeep * s.upkeepMul * ctx.mods.upkeep[t] * upkeepScale * watch * (t === 'coldminds' && darkSky ? 0.5 : 1);
    const mUp = n * d.matterUpkeep * upkeepScale;
    industry += ind;
    insight += ins;
    accord += acc;
    energyUpkeep += eUp;
    matterUpkeep += mUp;
    lines.push({ label: `${n} ${n === 1 ? d.one : d.name}${Math.abs(s.m) > 0.05 ? ` (strain ${s.m > 0 ? '+' : ''}${s.m.toFixed(1)})` : ''}${t === 'coldminds' && darkSky ? ' (dark sky: half upkeep)' : ''}${watch > 1 ? ' (watchers against the flow: half again)' : ''}`, industry: ind, insight: ins, accord: acc, energy: -eUp, matter: -mUp });
  }
  if (c.cryo > 0) {
    const cu = c.cryo * 0.08 * (flags.has('charter:cold_sleep_lottery') ? 0.5 : 1) * slowTime;
    energyUpkeep += cu;
    lines.push({ label: `${c.cryo} Kin in Cold Sleep`, energy: -cu });
  }

  // ---- structures
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
          // arrays on the surface get the light where the world is (inverse square); orbital collectors do not care
          if (d.id === 'solar_array') e *= insolation(state, body);
          if (flags.has('halo_siphons') && sys.primary.halo && calendarEra(state) === 'degenerate') e *= 2;
          if (civ.flags.ember_restraint && sys.primary.halo && calendarEra(state) === 'degenerate') e *= 0.75;
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
          e = state.protonsDecay && calendarEra(state) === 'degenerate' && eta > 30 ? a * clamp((eta - 30) / 6, 0.2, 1) : 0;
          break;
        }
        case 'curvature': {
          // the glow of a neutron star's mass turning to particles, worth gathering once all else is colder
          const eta = Math.log10(Math.max(1, ctx.years));
          e = fateOf(state) === 'curvature' && sys.primary.kind === 'neutron_star' && eta > 30 ? a * clamp((eta - 30) / 6, 0.2, 1) : 0;
          break;
        }
        case 'siphon':
          e = calendarEra(state) === 'dark' ? a : 0;
          break;
      }
      e *= pf * overdrive * focusMul(c, 'energy') * taintBoost;
    }
    let mt = 0;
    if (d.matterYield) mt += d.matterYield * n * body.richness * gfeMatter;
    if (d.hydrogenYield) mt += d.hydrogenYield * n * body.hydrogen * gfeMatter;
    if (d.lift) mt += d.lift * n * gfeMatter;
    if (mt) {
      // only its own focus touches matter: the others leave it as it was
      mt *= pf * taintBoost * (flags.has('hunger_engines') ? 1.4 : 1) * (c.focus === 'matter' ? focusMul(c, 'matter') : 1);
      depletion += (d.matterYield || d.hydrogenYield ? mt : 0);
      if (!matterGone(state)) matter += mt;
    }
    const ind = (d.industry ?? 0) * n * out;
    // a Relic Excavation has nothing to work once its ruin has flowed into smooth lumps
    const ins = d.id === 'relic_dig' && body.relic?.flowed ? 0 : (d.insight ?? 0) * n * out;
    const acc = (d.accord ?? 0) * n * out;
    const up = (d.upkeep ?? 0) * n * upkeepScale * slowTime * (d.cap || d.cryoCap ? occupancy(d) : 1) * (id === 'cold_vault' && darkSky ? 0.5 : 1);
    energy += e;
    industry += ind;
    insight += ins;
    accord += acc;
    energyUpkeep += up;
    // a collector with nothing to collect says so, rather than vanishing from the list
    const idle = !!d.energy && e <= 0 && d.energy.mode !== 'fusion' && d.energy.mode !== 'accretion';
    if (e || mt || ind || ins || acc || up || idle) lines.push({ label: `${n > 1 ? `${n}× ` : ''}${d.name}${idle ? ': nothing to gather' : ''}`, energy: e - up, matter: mt, industry: ind, insight: ins, accord: acc, ...(idle ? { idle: d.id } : {}) });
  }
  if (matterBurn > 0) lines.push({ label: 'Fuel burned', matter: -matterBurn });

  // ---- the Hearth: every settlement's own power core, fed by whatever is local
  if (!body.dissolved) {
    const hole = sys.primary.kind === 'black_hole' || sys.primary.kind === 'smbh';
    // at a black hole the Hearth draws on its spin and the thin gas still falling in
    const fed = Math.max(Math.min(1.5, body.rogue ? 0 : light.light), body.coreHeat * 0.8, hole && eraIndex(calendarEra(state)) >= 1 ? 1 : 0);
    // where nothing local is left to draw on, it burns what was stored and salvaged, a little
    const local = Math.max(0.25, fed);
    const hearth = 2 * local * (1 - c.damage) * pf * overdrive * focusMul(c, 'energy') * taintBoost;
    energy += hearth;
    lines.push({ label: `Hearth${c.overdrive ? ' (overdriven)' : ''}${fed < 0.25 ? ': stored fuel and salvage' : ''}`, energy: hearth });
  }

  industry *= ctx.mods.industryMult * focusMul(c, 'industry');
  insight *= ctx.mods.insightMult * focusMul(c, 'insight');
  accord *= focusMul(c, 'accord');
  if (flags.has('charters')) accord += dormant ? 0 : 0.25;

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
  return 0.125 * lattice * Math.min(1, conscious / Math.max(1, lattice + conscious) * 2);
}
