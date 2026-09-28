import { SHIP_BY_ID } from '../data/ships';
import { residentsOf } from './homes';
import { STRUCTURE_BY_ID } from '../data/structures';
import type { Body, Colony, Fleet, GameState, ThreadId } from '../types';
import { THREADS } from '../types';
import { formatDistance, stepTime } from '../eras';
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
 * How long a trip takes: in turns at the given pace (every turn is longer than the last, so this
 * walks the Tide forward instead of dividing by today's turn length), and in cosmic years of
 * flight, which no pace changes: distance ÷ speed, never faster than light.
 */
export function travelEstimate(state: GameState, ly: number, mods: Mods, pace = state.civ.pace): { turns: number; years: number } {
  const years = ly > 0 ? ly / mods.speed : 0;
  if (ly <= 0) return { turns: 1, years };
  let y = state.years;
  let eta = state.eta;
  let covered = 0;
  for (let n = 1; n <= 999; n++) {
    const step = stepTime(state.era, y, eta, pace, state.settings.length);
    if (!isFinite(step.turnLength)) return { turns: n, years };
    covered += mods.speed * step.turnLength;
    if (covered >= ly) return { turns: n, years };
    y = step.years;
    eta = step.eta;
  }
  return { turns: 999, years };
}

/** How many turns a trip takes at the current pace (see travelEstimate). */
export function travelTurnsEstimate(state: GameState, ly: number, mods: Mods): number {
  return travelEstimate(state, ly, mods).turns;
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
  // any ship charts the system it reaches (probes are just cheap, fast to build and far-sighted)
  if (state.civ.known[sys.id] !== 2) survey(state, sys.id);
  if (f.order === 'colonize' && f.targetBody) {
    const err = settle(state, f, f.targetBody);
    if (err) log(state, `${f.name} could not settle: ${err}`, 'bad', sys.id);
  }
  f.order = 'idle';
  f.targetBody = undefined;
}

/**
 * Chart every unsurveyed system where one of our ships is stationed. Older versions let only
 * probes survey, so a warship could be parked at a star it never charted; this catches those up.
 */
export function surveyWhereStationed(state: GameState) {
  for (const f of Object.values(state.fleets)) {
    if (f.at && state.systems[f.at] && state.civ.known[f.at] !== 2) survey(state, f.at);
  }
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
  const others = residentsOf(state, b);
  if (others) return `${others.contact ? others.name : 'Someone'} already live${others.contact ? '' : 's'} here.`;
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
/** Past this, even a ship's long-baseline scan picks nothing out (ly). */
const SCAN_REACH = 60000;
/** A ship scans for new stars only once no known star this close is still uncharted (ly). */
const SCAN_LOCAL = 2000;

/**
 * What we can see. Settlements see as far as research allows; a ship sees from wherever it is
 * (a survey ship three times as far). And a ship at the edge of what is known (no uncharted
 * star it knows of within SCAN_LOCAL) takes a long-baseline look, once per system, and picks
 * out the nearest stars no one has seen yet (a survey ship three, any other ship one), so
 * exploring can always go on, even across the gulfs between clusters. The far outliers in the
 * void stay hidden.
 */
export function updateDetection(state: GameState, mods: Mods) {
  const eyes = [
    ...colonies(state).map((c) => ({ sys: state.systems[c.systemId], range: mods.detect })),
    ...Object.values(state.fleets)
      .filter((f) => f.at)
      .map((f) => ({ sys: state.systems[f.at!], range: mods.detect * (canSurvey(f) ? 3 : 1) })),
  ];
  for (const s of Object.values(state.systems)) {
    if (state.civ.known[s.id]) continue;
    if (eyes.some((e) => distLy(e.sys, s) <= e.range)) state.civ.known[s.id] = 1;
  }
  for (const f of Object.values(state.fleets)) {
    if (!f.at || f.scanned === f.at) continue;
    const here = state.systems[f.at];
    // only from the edge of what is known: while an uncharted star lies close by, look there first
    if (Object.values(state.systems).some((s) => state.civ.known[s.id] === 1 && !s.gone && distLy(here, s) <= SCAN_LOCAL)) continue;
    f.scanned = f.at;
    const found = Object.values(state.systems)
      .filter((s) => !state.civ.known[s.id] && !s.gone && s.special !== 'outlier')
      .map((s) => ({ s, ly: distLy(here, s) }))
      .filter((x) => x.ly <= SCAN_REACH)
      .sort((a, b) => a.ly - b.ly)
      .slice(0, canSurvey(f) ? 3 : 1);
    for (const x of found) state.civ.known[x.s.id] = 1;
    if (found.length)
      log(state, `From ${here.name}, ${f.name} picks out ${found.length === 1 ? 'a distant star' : `${found.length} distant stars`}: ${found.map((x) => `${x.s.name} (${formatDistance(x.ly)})`).join(', ')}.`, 'info', here.id);
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
  return !!f.at && f.order === 'idle' && !f.auto;
}

/** Energy an exploring ship leaves in the reserve: it waits rather than take the last of it. */
export const EXPLORE_RESERVE = 20;

/** Can this fleet chart stars (and so explore by itself)? */
export function canSurvey(f: Fleet): boolean {
  return f.ships.some((x) => SHIP_BY_ID[x.cls]?.survey);
}

/**
 * Ships set to explore head for the nearest star no one has charted yet and no other ship is
 * already bound for. When nothing is left they report back and wait for orders.
 */
export function autoExplore(state: GameState, mods: Mods) {
  const claimed = new Set(Object.values(state.fleets).map((f) => f.to).filter((x): x is string => !!x));
  for (const f of Object.values(state.fleets)) {
    if (f.auto !== 'explore' || !f.at || f.to) continue;
    if (!canSurvey(f)) {
      f.auto = undefined;
      continue;
    }
    const here = state.systems[f.at];
    const next = Object.values(state.systems)
      .filter((x) => state.civ.known[x.id] === 1 && !x.gone && !claimed.has(x.id))
      .map((x) => ({ x, ly: distLy(here, x) }))
      .sort((a, b) => a.ly - b.ly)[0];
    if (!next) {
      f.auto = undefined;
      log(state, `${f.name} has charted every star we know of and waits for orders.`, 'info', f.at);
      continue;
    }
    if (state.civ.energy - launchCost(state, f, next.ly, mods) < EXPLORE_RESERVE) continue; // wait for energy
    if (orderMove(state, f.id, next.x.id, 'survey') === null) claimed.add(next.x.id);
  }
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
