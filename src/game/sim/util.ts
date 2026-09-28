import { ERA_BY_ID } from '../eras';
import { Rng } from '../rng';
import type { Body, Colony, EraId, GameState, LogEntry, StarSystem, ThreadId } from '../types';
import { THREADS } from '../types';

export function uid(state: GameState, prefix = 'u'): string {
  return `${prefix}${(state.nextId++).toString(36)}`;
}

/** Run `fn` with an RNG whose state is persisted back into the game state. */
export function withRng<T>(state: GameState, fn: (rng: Rng) => T): T {
  const rng = new Rng(state.rng);
  const out = fn(rng);
  state.rng = rng.s;
  return out;
}

export function rngOf(state: GameState): Rng {
  return new Rng(state.rng);
}

/** A name the save format can keep: "__inf" and "__-inf" stand for ±Infinity there (save.ts). */
export function savableName(name: string): string {
  return name === '__inf' || name === '__-inf' ? name.slice(1) : name;
}

export function log(state: GameState, text: string, kind: LogEntry['kind'] = 'info', systemId?: string) {
  state.log.push({ turn: state.turn, era: state.era, text, kind, systemId });
  if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
}

export function eraIndex(era: EraId): number {
  return ERA_BY_ID[era].index;
}

export function colonies(state: GameState): Colony[] {
  return Object.values(state.colonies);
}

export function popsOf(c: Colony): number {
  let n = 0;
  for (const t of THREADS) n += c.pops[t];
  return n;
}

export function totalPops(state: GameState, includeCryo = true): number {
  let n = 0;
  for (const c of colonies(state)) n += popsOf(c) + (includeCryo ? c.cryo : 0);
  return n;
}

export function threadTotals(state: GameState): Record<ThreadId, number> {
  const out = { kin: 0, echoes: 0, chorus: 0, lattice: 0, coldminds: 0 } as Record<ThreadId, number>;
  for (const c of colonies(state)) for (const t of THREADS) out[t] += c.pops[t];
  return out;
}

export function bodyOf(state: GameState, c: Colony): Body {
  return state.bodies[c.bodyId];
}

export function systemOf(state: GameState, c: Colony): StarSystem {
  return state.systems[c.systemId];
}

export function structureCount(c: Colony, id: string): number {
  return c.structures[id] ?? 0;
}

export function systemHasStructure(state: GameState, systemId: string, id: string): boolean {
  return colonies(state).some((c) => c.systemId === systemId && (c.structures[id] ?? 0) > 0);
}

export function distLy(a: StarSystem, b: StarSystem): number {
  return Math.hypot(a.phys.x - b.phys.x, a.phys.y - b.phys.y, a.phys.z - b.phys.z);
}

export function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}

export function hasTech(state: GameState, id: string): boolean {
  return state.civ.techs.includes(id);
}

export function hasCharter(state: GameState, id: string): boolean {
  return state.civ.charters.includes(id);
}

export function capital(state: GameState): Colony | null {
  const id = state.civ.capitalId;
  if (id && state.colonies[id]) return state.colonies[id];
  const all = colonies(state).sort((a, b) => popsOf(b) - popsOf(a));
  return all[0] ?? null;
}

export function protonFateKnown(state: GameState): boolean {
  return state.settings.protonFate !== 'unknown' || hasTech(state, 'proton_question') || eraIndex(state.era) >= 2;
}
