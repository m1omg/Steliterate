import { aroundTheStar, type StructureDef } from '../data/structures';
import { ERA_BY_ID } from '../eras';
import { fateKnown } from '../fate';
import { Rng, hashSeed } from '../rng';
import type { Body, Civ, Colony, ColonyForm, EraId, Fleet, GameState, LogEntry, StarSystem, Survivor, ThreadId } from '../types';
import { THREADS } from '../types';

export function uid(state: GameState, prefix = 'u'): string {
  return `${prefix}${(state.nextId++).toString(36)}`;
}

/**
 * Run `fn` with an RNG whose state is persisted back into the game state: the player's draws (and
 * the universe's) from the state's own stream, as ever; another civilization's from its own, so
 * that what it does never moves the player's draws.
 */
export function withRng<T>(state: GameState, fn: (rng: Rng) => T): T {
  const own = ownStream(state);
  const rng = new Rng(own ? civStream(state) : state.rng);
  const out = fn(rng);
  if (own) state.civ.rng = rng.s;
  else state.rng = rng.s;
  return out;
}

export function rngOf(state: GameState): Rng {
  return new Rng(ownStream(state) ? civStream(state) : state.rng);
}

/** Whether the civilization whose turn it is draws from a stream of its own: anyone but the player. */
function ownStream(state: GameState): boolean {
  return !!state.civ && !!state.player && state.civ.id !== state.player;
}

/** Its stream: where it left it, or from the start, a hash of the seed and its id. */
function civStream(state: GameState): number {
  return state.civ.rng ?? hashSeed(`${state.settings.seed}:civ:${state.civ.id}`);
}

/** A swarm we can see feeding at this star (as the map shows it): ships sent there are at risk. */
export function swarmSeenAt(state: GameState, systemId: string): boolean {
  return !!state.civ.known[systemId] && Object.values(state.swarms).some((w) => w.systemId === systemId && w.awake && !w.tamed);
}

/**
 * The nearest awake, untamed swarm we can see from a star, as the map shows them (at a star we
 * know, or on its way between stars), and how far it is; null if we see none.
 */
export function nearestSwarmSeen(state: GameState, systemId: string): { ly: number; at: StarSystem | null; size: number } | null {
  const here = state.systems[systemId];
  if (!here) return null;
  let best: { ly: number; at: StarSystem | null; size: number } | null = null;
  for (const w of Object.values(state.swarms)) {
    if (!w.awake || w.tamed) continue;
    let p: { x: number; y: number; z: number } | null = null;
    let at: StarSystem | null = null;
    if (w.systemId) {
      at = state.systems[w.systemId] ?? null;
      if (!at || !state.civ.known[at.id]) continue;
      p = at.phys;
    } else if (w.from && w.to && state.systems[w.from] && state.systems[w.to]) {
      const a = state.systems[w.from].phys;
      const b = state.systems[w.to].phys;
      const u = w.distance > 0 ? Math.min(1, w.traveled / w.distance) : 0;
      p = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u };
    }
    if (!p) continue;
    const ly = Math.hypot(here.phys.x - p.x, here.phys.y - p.y, here.phys.z - p.z);
    if (!best || ly < best.ly) best = { ly, at, size: w.size };
  }
  return best;
}

/** A name the save format can keep: "__inf" and "__-inf" stand for ±Infinity there (save.ts). */
export function savableName(name: string): string {
  return name === '__inf' || name === '__-inf' ? name.slice(1) : name;
}

/** A line in the Record of the civilization whose turn or view it is. */
export function log(state: GameState, text: string, kind: LogEntry['kind'] = 'info', systemId?: string, fleet?: string) {
  logTo(state, state.civ, text, kind, systemId, fleet);
}

/** A line for every civilization that knows of this star (its Record), as `kind`. */
export function tellKnown(state: GameState, systemId: string, text: string, kind: LogEntry['kind'] = 'info') {
  for (const v of Object.values(state.civs)) if (v.known[systemId]) logTo(state, v, text, kind, systemId);
}

/** The settlements of one civilization, whoever's turn it is. */
export function coloniesOf(state: GameState, civId: string): Colony[] {
  return Object.values(state.colonies).filter((c) => c.owner === civId);
}

/** A line in one civilization's Record (the universe's part of a turn tells each its own). */
export function logTo(state: GameState, civ: Civ, text: string, kind: LogEntry['kind'] = 'info', systemId?: string, fleet?: string) {
  civ.log.push({ turn: state.turn, era: state.era, text, kind, systemId, ...(fleet ? { fleet } : {}) });
  if (civ.log.length > 400) civ.log.splice(0, civ.log.length - 400);
}

export function eraIndex(era: EraId): number {
  return ERA_BY_ID[era].index;
}

/** The settlements of the civilization whose turn or view it is. */
export function colonies(state: GameState): Colony[] {
  const me = state.civ.id;
  return Object.values(state.colonies).filter((c) => c.owner === me);
}

/** Every civilization's settlements: for what the universe does to them, and what a star holds. */
export function allColonies(state: GameState): Colony[] {
  return Object.values(state.colonies);
}

/** The fleets of the civilization whose turn or view it is. */
export function fleets(state: GameState): Fleet[] {
  const me = state.civ.id;
  return Object.values(state.fleets).filter((f) => f.owner === me);
}

/** Every civilization's fleets. */
export function allFleets(state: GameState): Fleet[] {
  return Object.values(state.fleets);
}

/** A settlement of the civilization whose turn or view it is, by id: its actions never touch another's. */
export function ownColony(state: GameState, id: string): Colony | undefined {
  const c = state.colonies[id];
  return c && c.owner === state.civ.id ? c : undefined;
}

/** A fleet of the civilization whose turn or view it is, by id: its orders never move another's. */
export function ownFleet(state: GameState, id: string): Fleet | undefined {
  const f = state.fleets[id];
  return f && f.owner === state.civ.id ? f : undefined;
}

/** What a settlement is made of (data/forms.ts): matter, unless it went on past the end of matter. */
export function formOf(c: Colony): ColonyForm {
  return c.form ?? 'baryonic';
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

/**
 * Has this settlement left it behind? A world flung loose from its star (a rogue world) has
 * drifted away from everything in orbit around that star, which works on the star itself: it can
 * build none of it there, and what it built there before gives it nothing.
 */
export function leftBehind(state: GameState, c: Colony, d: StructureDef): boolean {
  return !!state.bodies[c.bodyId]?.rogue && aroundTheStar(d);
}

/**
 * Whether a settlement is still where its system is: in its Deep, or on a world its star holds, or
 * held until this very moment (`held`, the worlds a burst has just set loose). A world flung loose
 * long before has drifted far away: a burst there neither destroys it nor pays its Burst Catchers
 * (the player, 12 Oct).
 */
export function inItsSystem(state: GameState, c: Colony, held?: readonly string[]): boolean {
  const b = state.bodies[c.bodyId];
  return !!b && (b.kind === 'deep' || !b.rogue || !!held?.includes(b.id));
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
  if (id && state.colonies[id]?.owner === state.civ.id) return state.colonies[id];
  const all = colonies(state).sort((a, b) => popsOf(b) - popsOf(a));
  return all[0] ?? null;
}

/** Do we know the fate of matter? (See fateKnown in fate.ts.) */
export function protonFateKnown(state: GameState): boolean {
  return fateKnown(state);
}

/**
 * Each civilization's temperament, 0 to 1 on each axis, from the seed and its id, never the dice
 * (the new version, part 2a-5): how cautious it is (energy kept in hand before it builds), how
 * generous (how readily it helps a partner, how much it sends, how warmly it proposes) and how
 * ambitious (how far it spreads). Ours is the player's own, and the autoplayer plays it as ever.
 */
export interface Temperament {
  caution: number;
  generosity: number;
  ambition: number;
}

export function temperament(state: GameState, id: string): Temperament {
  const h = (k: string) => (hashSeed(`${state.settings.seed}:temper:${k}:${id}`) % 1001) / 1000;
  return { caution: h('caution'), generosity: h('generosity'), ambition: h('ambition') };
}

/** What we keep of our dealings with a neighbour (Survivor.marks): turns and counts, by name. */
export function marks(sv: Survivor): Record<string, number> {
  return (sv.marks ??= {});
}
