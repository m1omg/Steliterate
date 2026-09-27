import { TECH_BY_ID } from '../data/techs';
import { THREAD_DEFS } from '../data/threads';
import type { GameState, ThreadId } from '../types';
import { THREADS } from '../types';

export interface Mods {
  echoMax: number;
  speed: number; // fraction of c
  paceMax: number;
  paceMin: number;
  reserveMult: number;
  insightMult: number;
  industryMult: number;
  upkeep: Record<ThreadId, number>;
  detect: number; // ly
  crossing: number;
  flags: Set<string>;
}

export function computeMods(state: GameState): Mods {
  const m: Mods = {
    echoMax: 1.6,
    speed: 0.02,
    paceMax: 1,
    paceMin: -1,
    reserveMult: 1,
    insightMult: 1,
    industryMult: 1,
    upkeep: { kin: 1, echoes: 1, chorus: 1, lattice: 1, coldminds: 1 },
    detect: 60,
    crossing: 1,
    flags: new Set(),
  };
  for (const id of state.civ.techs) {
    const e = TECH_BY_ID[id]?.effects;
    if (!e) continue;
    if (e.echoMaxClock !== undefined) m.echoMax = Math.max(m.echoMax, e.echoMaxClock);
    if (e.speed !== undefined) m.speed = Math.max(m.speed, e.speed);
    if (e.paceMax !== undefined) m.paceMax = Math.max(m.paceMax, e.paceMax);
    if (e.paceMin !== undefined) m.paceMin = Math.min(m.paceMin, e.paceMin);
    if (e.reserveMult) m.reserveMult *= e.reserveMult;
    if (e.insightMult) m.insightMult *= e.insightMult;
    if (e.industryMult) m.industryMult *= e.industryMult;
    if (e.detect) m.detect = Math.max(m.detect, e.detect);
    if (e.crossing) m.crossing *= e.crossing;
    if (e.upkeep) for (const t of THREADS) m.upkeep[t] *= e.upkeep[t] ?? 1;
    e.flags?.forEach((f) => m.flags.add(f));
  }
  for (const c of state.civ.charters) m.flags.add(`charter:${c}`);
  if (m.flags.has('charter:open_archives')) m.insightMult *= 1.15;
  if (m.flags.has('charter:abandon_the_surface')) m.industryMult *= 1.1;
  if (m.flags.has('charter:child_quotas')) m.upkeep.kin *= 0.88;
  if (m.flags.has('charter:rationing')) for (const t of THREADS) m.upkeep[t] *= 0.85;
  if (state.era !== 'dusk') m.detect = Math.max(m.detect, state.era === 'degenerate' ? 3e5 : 1e7);
  return m;
}

/** The slowest and fastest clocks (log10 years) a Thread can run at, given research. */
export function clockRange(t: ThreadId, mods: Mods): [number, number] {
  const d = THREAD_DEFS[t];
  const lo = d.clockMin;
  let hi: number;
  if (d.clockMax.fixed !== undefined) hi = d.clockMax.fixed;
  else hi = mods.echoMax + (d.clockMax.relative ?? 0);
  return [lo, Math.max(lo, hi)];
}

export interface Strain {
  clock: number; // effective clock
  m: number; // mismatch in orders of magnitude (+ too fast for the age, - too slow)
  outMul: number;
  upkeepMul: number;
}

/** Tempo strain for a Thread living through a turn of 10^logL years. */
export function strainFor(t: ThreadId, logL: number, mods: Mods): Strain {
  const d = THREAD_DEFS[t];
  if (d.strainImmune) return { clock: logL, m: 0, outMul: 1, upkeepMul: 1 };
  const [lo, hi] = clockRange(t, mods);
  const clock = Math.max(lo, Math.min(hi, logL));
  const m = Math.max(-50, Math.min(50, logL - clock));
  if (m > 0) return { clock, m, outMul: 1 + 0.05 * Math.min(m, 10), upkeepMul: 1 + 0.3 * m };
  if (m < 0) return { clock, m, outMul: Math.max(0.15, 1 + 0.4 * m), upkeepMul: Math.max(0.3, 1 + 0.2 * m) };
  return { clock, m: 0, outMul: 1, upkeepMul: 1 };
}
