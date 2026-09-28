import { SHIP_BY_ID } from '../data/ships';
import { STRUCTURE_BY_ID } from '../data/structures';
import type { Body, Colony, Fleet, GameState, ThreadId } from '../types';
import { THREADS } from '../types';
import { stepTime } from '../eras';
import { computeMods, type Mods } from './mods';
import { ANOMALIES } from '../data/events';
import { colonies, distLy, eraIndex, log, uid, withRng } from './util';

// No faster-than-light travel. Fleets advance speed × turn length light-years per turn.
// Early on a 10 ly hop takes several turns; later a whole province fits into one.
// Distance is also paid for in energy at launch.

const ERA_LAUNCH: Record<string, number> = { dusk: 1, degenerate: 1.3, blackhole: 1.6, dark: 2.2 };

export function fleetMass(f: Fleet): number {
  return f.ships.reduce((a, s) => a + (SHIP_BY_ID[s.cls]?.mass ?? 1), 0);
}

export function launchCost(state: GameState, f: Fleet, ly: number, mods: Mods): number {
  const cheap = mods.flags.has('cheap_launch') ? 0.6 : 1;
  return Math.round(fleetMass(f) * (0.6 + 0.55 * Math.log10(1 + ly)) * cheap * ERA_LAUNCH[state.era] * 10) / 10;
}

/**
 * How many turns a trip takes. Every turn is longer than the last, so this walks the Tide
 * forward at the current pace instead of dividing by today's turn length.
 */
export function travelTurnsEstimate(state: GameState, ly: number, mods: Mods): number {
  if (ly <= 0) return 1;
  let years = state.years;
  let eta = state.eta;
  let covered = 0;
  for (let n = 1; n <= 999; n++) {
    const step = stepTime(state.era, years, eta, state.civ.pace, state.settings.length);
    if (!isFinite(step.turnLength)) return n;
    covered += mods.speed * step.turnLength;
    if (covered >= ly) return n;
    years = step.years;
    eta = step.eta;
  }
  return 999;
}

export function newFleet(state: GameState, systemId: string, ships: string[], name?: string): Fleet {
  const f: Fleet = {
    id: uid(state, 'f'),
    name: name ?? fleetName(state, ships),
    ships: ships.map((cls) => ({ cls, hp: SHIP_BY_ID[cls]?.hp ?? 5 })),
    at: systemId,
    from: null,
    to: null,
    traveled: 0,
    distance: 0,
    order: 'idle',
  };
  state.fleets[f.id] = f;
  return f;
}

function fleetName(state: GameState, ships: string[]): string {
  const first = SHIP_BY_ID[ships[0]]?.name ?? 'Fleet';
  const n = Object.values(state.fleets).filter((f) => f.ships[0]?.cls === ships[0]).length + 1;
  return `${first} ${n}`;
}

/** Order a fleet toward a system. Returns an error string or null. */
export function orderMove(state: GameState, fleetId: string, to: string, order: Fleet['order'] = 'move', targetBody?: string): string | null {
  const f = state.fleets[fleetId];
  if (!f || !f.at) return 'That fleet is already under way.';
  if (f.at === to && order !== 'colonize' && order !== 'tame') return 'Already there.';
  if (f.at !== to && f.ships.some((x) => SHIP_BY_ID[x.cls]?.inSystem)) return 'A System Lighter cannot leave its star.';
  const mods = computeMods(state);
  const a = state.systems[f.at];
  const b = state.systems[to];
  if (!b || b.gone) return 'Nothing is left there.';
  const ly = distLy(a, b);
  const cost = f.at === to ? 0 : launchCost(state, f, ly, mods);
  if (state.civ.energy < cost) return `Launching needs ${cost.toFixed(0)} energy.`;
  state.civ.energy -= cost;
  f.from = f.at;
  f.to = to;
  f.at = f.at === to ? f.at : null;
  f.traveled = 0;
  f.distance = ly;
  f.order = order;
  f.targetBody = targetBody;
  if (f.from === to) {
    // acting in place (settling a body in the same system)
    f.at = to;
    arrive(state, f);
  }
  return null;
}

export function advanceFleets(state: GameState, L: number, mods: Mods) {
  for (const f of Object.values(state.fleets)) {
    if (!f.to || f.at) continue;
    const step = isFinite(L) ? mods.speed * L : Infinity;
    f.traveled = Math.min(f.distance, f.traveled + step);
    if (f.traveled >= f.distance) {
      f.at = f.to;
      arrive(state, f);
    }
  }
}

function arrive(state: GameState, f: Fleet) {
  const sys = state.systems[f.at!];
  f.from = null;
  f.to = null;
  f.traveled = 0;
  f.distance = 0;
  if (state.civ.known[sys.id] !== 2 && f.ships.some((s) => SHIP_BY_ID[s.cls]?.survey)) {
    survey(state, sys.id);
  } else if (!state.civ.known[sys.id]) state.civ.known[sys.id] = 1;
  if (f.order === 'colonize' && f.targetBody) {
    const err = settle(state, f, f.targetBody);
    if (err) log(state, `${f.name} could not settle: ${err}`, 'bad', sys.id);
  }
  f.order = 'idle';
  f.targetBody = undefined;
}

export function survey(state: GameState, systemId: string) {
  const sys = state.systems[systemId];
  state.civ.known[systemId] = 2;
  for (const bid of sys.bodies) {
    const b = state.bodies[bid];
    if (b.relic && b.relic.state === 'hidden') {
      b.relic.state = 'found';
      state.pending.push({ uid: uid(state, 'ev'), defId: `relic_${b.relic.kind}`, data: { bodyId: b.id, systemId } });
    }
  }
  log(state, `Surveyed ${sys.name}.`, 'info', systemId);
  for (const b of livingWorlds(state, systemId)) {
    log(state, `A living world at ${sys.name}: ${b.name}, ${Math.round(b.habitability * b.vitality * 100)}% habitable, room for ${naturalKinRoom(b)} Kin without domes.`, 'good', systemId);
  }
  // a survey sometimes turns up something remarkable (at most one find per survey)
  withRng(state, (rng) => {
    if (!rng.chance(0.3)) return;
    const found = new Set(ANOMALIES.map((a) => a.id));
    const worlds = sys.bodies.map((id) => state.bodies[id]).filter((b) => b && !b.dissolved && !b.traits.some((t) => found.has(t)));
    const options: { b: Body; id: string }[] = [];
    for (const b of worlds) for (const a of ANOMALIES) if ((state.fired[`anom_${a.id}`] ?? 0) < 2 && a.fits(state, b)) options.push({ b, id: a.id });
    if (!options.length) return;
    const pick = rng.pick(options);
    pick.b.traits.push(pick.id);
    state.fired[`anom_${pick.id}`] = (state.fired[`anom_${pick.id}`] ?? 0) + 1;
    state.pending.push({ uid: uid(state, 'ev'), defId: `anom_${pick.id}`, data: { bodyId: pick.b.id, systemId } });
  });
}

export function canSettle(state: GameState, b: Body, thread: ThreadId): string | null {
  if (b.colonyId) return 'Already settled.';
  if (b.dissolved) return 'Nothing is left of it.';
  if (b.kind === 'gas_giant' && thread === 'kin') return 'Kin cannot live on a gas giant.';
  if (b.kind === 'deep' && thread === 'kin' && eraIndex(state.era) === 0 && !state.civ.techs.includes('orbital_industry')) return 'Kin need Orbital Industry to live in the Deep.';
  const sys = state.systems[b.systemId];
  if (sys.gone) return 'The system is gone.';
  return null;
}

function settle(state: GameState, f: Fleet, bodyId: string): string | null {
  const b = state.bodies[bodyId];
  if (!b || b.systemId !== f.at) return 'The target is not here.';
  const idx = f.ships.findIndex((s) => SHIP_BY_ID[s.cls]?.settles);
  if (idx < 0) return 'No settlers aboard.';
  const def = SHIP_BY_ID[f.ships[idx].cls];
  const err = canSettle(state, b, def.settles!.thread);
  if (err) return err;
  const c = createColony(state, b, { [def.settles!.thread]: def.settles!.pops });
  if (def.settles!.structure) c.structures[def.settles!.structure] = 1;
  f.ships.splice(idx, 1);
  if (f.ships.length === 0) delete state.fleets[f.id];
  log(state, `A new settlement: ${c.name}.`, 'good', b.systemId);
  return null;
}

export function createColony(state: GameState, b: Body, pops: Partial<Record<ThreadId, number>>): Colony {
  const c: Colony = {
    id: uid(state, 'c'),
    bodyId: b.id,
    systemId: b.systemId,
    name: b.name,
    founded: state.turn,
    pops: Object.fromEntries(THREADS.map((t) => [t, pops[t] ?? 0])) as Record<ThreadId, number>,
    growth: Object.fromEntries(THREADS.map((t) => [t, 0])) as Record<ThreadId, number>,
    cryo: 0,
    structures: {},
    queue: [],
    focus: 'balanced',
    overdrive: false,
    damage: 0,
    starving: 0,
  };
  state.colonies[c.id] = c;
  b.colonyId = c.id;
  state.civ.known[b.systemId] = 2;
  if (!state.civ.capitalId) state.civ.capitalId = c.id;
  return c;
}

export function destroyColony(state: GameState, c: Colony, reason: string) {
  const b = state.bodies[c.bodyId];
  if (b) b.colonyId = null;
  delete state.colonies[c.id];
  if (state.civ.capitalId === c.id) state.civ.capitalId = null;
  log(state, `${c.name} is lost: ${reason}`, 'bad', c.systemId);
}

/** Systems within detection range of any settlement or fleet become known. */
export function updateDetection(state: GameState, mods: Mods) {
  const eyes: string[] = [...colonies(state).map((c) => c.systemId), ...Object.values(state.fleets).filter((f) => f.at).map((f) => f.at!)];
  const uniq = [...new Set(eyes)].map((id) => state.systems[id]);
  for (const s of Object.values(state.systems)) {
    if (state.civ.known[s.id]) continue;
    if (uniq.some((e) => distLy(e, s) <= mods.detect)) state.civ.known[s.id] = 1;
  }
}

export function signatureOf(state: GameState, systemId: string): number {
  let sig = 0;
  for (const c of colonies(state)) {
    if (c.systemId !== systemId) continue;
    for (const [id, n] of Object.entries(c.structures)) sig += (STRUCTURE_BY_ID[id]?.signature ?? 0) * n;
    sig += (c.pops.kin + c.pops.chorus) * 0.3;
    if (c.overdrive) sig += 4;
  }
  return sig;
}

/** Warships: anything that can fight. */
export function isWarFleet(f: Fleet): boolean {
  return f.ships.some((x) => (SHIP_BY_ID[x.cls]?.attack ?? 0) > 0 && !SHIP_BY_ID[x.cls]?.settles);
}

/** Stationed with nothing to do: the fleets the game should ask about. */
export function isIdleFleet(f: Fleet): boolean {
  return !!f.at && f.order === 'idle';
}

/** Fortified warships count double when they defend the system they hold. */
export const FORTIFY_BONUS = 2;

/** Room for Kin a world offers on its own, before any domes or warrens. */
export function naturalKinRoom(b: Body): number {
  if (b.dissolved) return 0;
  const cap = Math.floor(Math.round(12 * b.habitability) * b.vitality);
  return b.rogue || b.feeding ? Math.floor(cap * 0.3) : cap;
}

/** Habitable enough to be news: at least half as good as a living world can be, right now. */
export const LIVING_WORLD = 0.5;

/** Unsettled worlds in a system that are at least LIVING_WORLD habitable. */
export function livingWorlds(state: GameState, systemId: string): Body[] {
  return state.systems[systemId].bodies
    .map((id) => state.bodies[id])
    .filter((b) => b && !b.dissolved && !b.colonyId && b.kind !== 'gas_giant' && b.habitability * b.vitality >= LIVING_WORLD);
}
