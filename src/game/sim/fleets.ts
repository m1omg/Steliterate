import { SHIP_BY_ID, isWarship } from '../data/ships';
import { residentsOf } from './homes';
import { STRUCTURE_BY_ID } from '../data/structures';
import type { Body, Colony, Fleet, GameState, StarSystem, ThreadId, Vec3 } from '../types';
import { THREADS } from '../types';
import { formatDistance } from '../eras';
import { boilingAway, frozenHard, tooColdForOpenAir } from '../physics';
import { habitabilityOf } from './terraform';
import { THAW_ROOM, clockCiv, scorched, stepTurns, thawed } from './flare';
import { computeMods, type Mods } from './mods';
import { ANOMALIES } from '../data/events';
import { allColonies, allFleets, colonies, distLy, eraIndex, fleets, log, logTo, ownFleet, swarmSeenAt, uid, withRng } from './util';
import { calendarEra, matterGone } from '../fate';

// No faster-than-light travel. Fleets advance speed × turn length light-years per turn.
// Early on a 10 ly hop takes several turns; later a whole province fits into one.
// Distance is also paid for in energy at launch.

const ERA_LAUNCH: Record<string, number> = { dusk: 1, degenerate: 1.3, blackhole: 1.6, dark: 2.2 };

export function fleetMass(f: Fleet): number {
  return f.ships.reduce((a, s) => a + (SHIP_BY_ID[s.cls]?.mass ?? 1), 0);
}

export function launchCost(state: GameState, f: Fleet, ly: number, mods: Mods): number {
  const cheap = mods.flags.has('cheap_launch') ? 0.6 : 1;
  return Math.round(fleetMass(f) * (0.6 + 0.55 * Math.log10(1 + ly)) * cheap * ERA_LAUNCH[calendarEra(state)] * 10) / 10;
}

/**
 * How long a trip takes: in turns at the given pace (every turn is longer than the last, so this
 * walks the Tide forward instead of dividing by today's turn length), and in cosmic years of
 * flight, which no pace changes: distance ÷ speed, never faster than light.
 */
export function travelEstimate(state: GameState, ly: number, mods: Mods, pace = clockCiv(state).pace): { turns: number; years: number } {
  const years = ly > 0 ? ly / mods.speed : 0;
  if (ly <= 0) return { turns: 1, years };
  let covered = 0;
  // the turns as they will really fall: a flare's or a new star's own clock, and a flare's first moment, shorten them
  const turns = stepTurns(state, pace, 999, (len) => {
    if (!isFinite(len)) return true;
    covered += mods.speed * len;
    return covered >= ly;
  });
  return { turns: isFinite(turns) ? turns : 999, years };
}

/** How many turns a trip takes at the current pace (see travelEstimate). */
export function travelTurnsEstimate(state: GameState, ly: number, mods: Mods): number {
  return travelEstimate(state, ly, mods).turns;
}

export function newFleet(state: GameState, systemId: string, ships: string[], name?: string): Fleet {
  const f: Fleet = {
    id: uid(state, 'f'),
    owner: state.civ.id,
    name: name ?? fleetName(state, ships),
    ships: ships.map((cls) => ({ cls, hp: SHIP_BY_ID[cls]?.hp ?? 5 })),
    at: systemId,
    from: null,
    to: null,
    traveled: 0,
    distance: 0,
    order: 'idle',
  };
  // (another civilization's: we see it once the light of its making reaches us)
  if (state.player && f.owner !== state.player) f.since = state.years;
  state.fleets[f.id] = f;
  return f;
}

function fleetName(state: GameState, ships: string[]): string {
  const first = SHIP_BY_ID[ships[0]]?.name ?? 'Fleet';
  const n = fleets(state).filter((f) => f.ships[0]?.cls === ships[0]).length + 1;
  return `${first} ${n}`;
}

/** Order a fleet toward a system. Returns an error string or null. */
export function orderMove(state: GameState, fleetId: string, to: string, order: Fleet['order'] = 'move', targetBody?: string): string | null {
  const f = ownFleet(state, fleetId);
  if (!f || !f.at) return 'That fleet is already under way.';
  if (f.at === to && order !== 'colonize' && order !== 'tame' && order !== 'strike') return 'Already there.';
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
  // (another civilization's: we see it set out once the light of its leaving reaches us)
  if (f.owner !== state.player && f.from !== to) f.departed = state.years;
  if (f.from === to) {
    // acting in place (settling a body in the same system)
    f.at = to;
    arrive(state, f);
  }
  return null;
}

/** A Kinetic Lance's speed, as a share of light's, whatever its civilization's ships can do. */
export const LANCE_SPEED = 0.99;

/** Whether a fleet is a Kinetic Lance alone, flying at LANCE_SPEED. */
export function isLance(f: Fleet): boolean {
  return f.ships.length > 0 && f.ships.every((s) => SHIP_BY_ID[s.cls]?.lance);
}

/** The stretch a fleet flew this turn, from where it was to where it is now (true light-years). */
export interface Flown {
  f: Fleet;
  a: Vec3;
  b: Vec3;
}

const along = (p: Vec3, q: Vec3, t: number): Vec3 => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, z: p.z + (q.z - p.z) * t });

/** Moves every fleet under way, and returns the stretches flown (for what they see on the way). */
export function advanceFleets(state: GameState, L: number, mods: Mods): Flown[] {
  const flown: Flown[] = [];
  for (const f of fleets(state)) {
    if (!f.to || f.at) continue;
    const step = isFinite(L) ? (isLance(f) ? Math.max(mods.speed, LANCE_SPEED) : mods.speed) * L : Infinity;
    const t0 = f.traveled;
    f.traveled = Math.min(f.distance, f.traveled + step);
    const p = f.from ? state.systems[f.from]?.phys : undefined;
    const q = state.systems[f.to]?.phys;
    if (p && q && f.distance > 0) flown.push({ f, a: along(p, q, t0 / f.distance), b: along(p, q, f.traveled / f.distance) });
    if (f.traveled >= f.distance) {
      f.at = f.to;
      arrive(state, f);
    }
  }
  return flown;
}

function arrive(state: GameState, f: Fleet) {
  const sys = state.systems[f.at!];
  if (f.owner !== state.player) {
    f.since = state.years;
    if (f.from && f.from !== f.at) f.cameFrom = f.from;
  }
  f.from = null;
  f.to = null;
  f.traveled = 0;
  f.distance = 0;
  // a Kinetic Lance does not stop: it strikes, with every other battle of the turn (conflict.ts)
  if (f.order === 'strike') return;
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
  for (const f of fleets(state)) {
    // (a Kinetic Lance does not stop where it strikes)
    if (f.at && f.order !== 'strike' && state.systems[f.at] && state.civ.known[f.at] !== 2) survey(state, f.at);
  }
}

export function survey(state: GameState, systemId: string) {
  const sys = state.systems[systemId];
  state.civ.known[systemId] = 2;
  // the ruins, the sleepers and the finds are the player's story: another's survey charts the star
  const mine = state.civ.id === state.player;
  for (const bid of mine ? sys.bodies : []) {
    const b = state.bodies[bid];
    if (b.relic && b.relic.state === 'hidden' && !b.relic.flowed && !b.dissolved) {
      b.relic.state = 'found';
      state.civ.pending.push({ uid: uid(state, 'ev'), defId: `relic_${b.relic.kind}`, data: { bodyId: b.id, systemId } });
    }
  }
  log(state, `Surveyed ${sys.name}.`, 'info', systemId);
  for (const b of livingWorlds(state, systemId)) {
    log(state, `A living world at ${sys.name}: ${b.name}, ${Math.round(b.habitability * b.vitality * 100)}% habitable, room for ${naturalKinRoom(b, state)} Kin without domes.`, 'good', systemId);
  }
  // a survey sometimes turns up something remarkable (at most one find per survey)
  if (mine) withRng(state, (rng) => {
    if (!rng.chance(0.3)) return;
    const found = new Set(ANOMALIES.map((a) => a.id));
    // (not a world already falling into its star: what was there to find is coming apart)
    const worlds = sys.bodies.map((id) => state.bodies[id]).filter((b) => b && !b.dissolved && !b.feeding && !b.traits.some((t) => found.has(t)));
    const options: { b: Body; id: string }[] = [];
    for (const b of worlds) for (const a of ANOMALIES) if ((state.civ.fired[`anom_${a.id}`] ?? 0) < 2 && a.fits(state, b)) options.push({ b, id: a.id });
    if (!options.length) return;
    const pick = rng.pick(options);
    pick.b.traits.push(pick.id);
    state.civ.fired[`anom_${pick.id}`] = (state.civ.fired[`anom_${pick.id}`] ?? 0) + 1;
    state.civ.pending.push({ uid: uid(state, 'ev'), defId: `anom_${pick.id}`, data: { bodyId: pick.b.id, systemId } });
  });
}

export function canSettle(state: GameState, b: Body, thread: ThreadId): string | null {
  if (b.colonyId && !othersDeep(state, b)) return 'Already settled.';
  if (b.dissolved) return 'Nothing is left of it.';
  const boil = boilingAway(state, b);
  if (boil) return boil === 'swallowed' ? 'Its star is swelling over it: it will be swallowed as this turn ends.' : 'Its new star will boil it away as this turn ends.';
  if ((b.kind === 'gas_giant' || b.kind === 'ice_giant') && thread === 'kin') return `Kin cannot live on ${b.kind === 'gas_giant' ? 'a gas' : 'an ice'} giant: it has no ground to build on.`;
  if (b.kind === 'deep' && thread === 'kin' && eraIndex(calendarEra(state)) === 0 && !state.civ.techs.includes('orbital_industry')) return 'Kin need Orbital Industry to live in the Deep.';
  const sys = state.systems[b.systemId];
  if (sys.gone) return 'The system is gone.';
  const others = residentsOf(state, b);
  if (others) return `${others.contact ? others.name : 'Someone'} already live${others.contact ? '' : 's'} here.`;
  return null;
}

function settle(state: GameState, f: Fleet, bodyId: string): string | null {
  let b = state.bodies[bodyId];
  if (!b || b.systemId !== f.at) return 'The target is not here.';
  // another's Deep: our own habitats beside theirs
  if (othersDeep(state, b)) b = deepFor(state, state.systems[b.systemId]) ?? b;
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

/**
 * A civilization's own Deep in a system (its orbital habitats, or a vault at a hole): the one it
 * holds, else a free one, else a new one beside the others', since each builds its own. Null if
 * the system has none. (13 Oct: before the new version a system had one Deep, and whoever came
 * there joined whoever held it.)
 */
export function deepFor(state: GameState, sys: StarSystem, owner = state.civ.id): Body | null {
  const deeps = sys.bodies.map((id) => state.bodies[id]).filter((b): b is Body => !!b && b.kind === 'deep' && !b.dissolved);
  if (!deeps.length) return null;
  const own = deeps.find((b) => b.colonyId && state.colonies[b.colonyId]?.owner === owner);
  if (own) return own;
  const free = deeps.find((b) => !b.colonyId || !state.colonies[b.colonyId]);
  if (free) return free;
  const base = deeps[0];
  const b: Body = { ...structuredClone(base), id: `${base.id}.${owner}`, colonyId: null };
  delete b.relic;
  delete b.lore;
  state.bodies[b.id] = b;
  sys.bodies.push(b.id);
  return b;
}

/** A Deep held by another civilization: settling there builds our own beside it (deepFor). */
function othersDeep(state: GameState, b: Body): boolean {
  return b.kind === 'deep' && !!b.colonyId && !!state.colonies[b.colonyId] && state.colonies[b.colonyId].owner !== state.civ.id;
}

export function createColony(state: GameState, b: Body, pops: Partial<Record<ThreadId, number>>): Colony {
  const c: Colony = {
    id: uid(state, 'c'),
    owner: state.civ.id,
    bodyId: b.id,
    systemId: b.systemId,
    name: b.name,
    founded: state.turn,
    foundedAt: state.years,
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
  // (after the end of matter there is nothing else to be)
  if (matterGone(state)) c.form = 'leptonic';
  state.colonies[c.id] = c;
  b.colonyId = c.id;
  state.civ.known[b.systemId] = 2;
  if (!state.civ.capitalId) state.civ.capitalId = c.id;
  // a settlement is something left there: a system marked gone (a hole that evaporated while only
  // others lived in its Deep, until we took them back) is on the map again, and ships can reach it
  const sys = state.systems[b.systemId];
  if (sys?.gone) sys.gone = false;
  return c;
}

/** A settlement is gone: its civilization loses its capital if it was that, and hears why. */
export function destroyColony(state: GameState, c: Colony, reason: string) {
  const b = state.bodies[c.bodyId];
  if (b) b.colonyId = null;
  delete state.colonies[c.id];
  const owner = state.civs[c.owner] ?? state.civ;
  if (owner.capitalId === c.id) owner.capitalId = null;
  logTo(state, owner, `${c.name} is lost: ${reason}`, 'bad', c.systemId);
}

/** Past this, even a ship's long-baseline scan picks nothing out (ly). */
const SCAN_REACH = 60000;
/** A ship scans for new stars only once no known star this close is still uncharted (ly). */
const SCAN_LOCAL = 2000;

/** How far a fleet sees, stopped or under way: as far as a settlement, a survey ship three times as far, a Picket twice. */
function eyesOf(f: Fleet, mods: Mods): number {
  return mods.detect * Math.max(canSurvey(f) ? 3 : 1, ...f.ships.map((s) => SHIP_BY_ID[s.cls]?.eyes ?? 1));
}

/** How far a point lies from the stretch from a to b (ly). */
function fromStretch(s: Vec3, a: Vec3, b: Vec3): number {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const len2 = dx * dx + dy * dy + dz * dz;
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((s.x - a.x) * dx + (s.y - a.y) * dy + (s.z - a.z) * dz) / len2)) : 0;
  return Math.hypot(s.x - (a.x + dx * t), s.y - (a.y + dy * t), s.z - (a.z + dz * t));
}

/**
 * The nearest stars no one has seen yet from a point, for a long-baseline look: the far outliers
 * in the void stay hidden, and past SCAN_REACH nothing is picked out.
 */
function nearestUnseen(state: GameState, here: Vec3, n: number): { s: StarSystem; ly: number }[] {
  return Object.values(state.systems)
    .filter((s) => !state.civ.known[s.id] && !s.gone && s.special !== 'outlier')
    .map((s) => ({ s, ly: Math.hypot(s.phys.x - here.x, s.phys.y - here.y, s.phys.z - here.z) }))
    .filter((x) => x.ly <= SCAN_REACH)
    .sort((a, b) => a.ly - b.ly)
    .slice(0, n);
}

/** Whether a star we know of but have not charted lies within SCAN_LOCAL of a point. */
function unchartedNear(state: GameState, here: Vec3): boolean {
  return Object.values(state.systems).some((s) => state.civ.known[s.id] === 1 && !s.gone && Math.hypot(s.phys.x - here.x, s.phys.y - here.y, s.phys.z - here.z) <= SCAN_LOCAL);
}

/**
 * The eyes we chart stars with (updateDetection) and watch the Hunger with (sight.ts): our
 * settlements, the stars our Shared Watch partners watch, and our ships stopped at a star.
 */
export function watchEyes(state: GameState, mods: Mods): { sys: StarSystem; range: number }[] {
  return [
    ...colonies(state).map((c) => ({ sys: state.systems[c.systemId], range: mods.detect })),
    // Shared Watch: the stars our partners watch, we see too
    ...Object.values(state.survivors)
      .filter((sv) => sv.alive && sv.pacts?.watch !== undefined)
      .flatMap((sv) => sv.systems.map((id) => ({ sys: state.systems[id], range: mods.detect })))
      .filter((e) => !!e.sys),
    ...fleets(state)
      .filter((f) => f.at)
      .map((f) => ({ sys: state.systems[f.at!], range: eyesOf(f, mods) })),
  ];
}

/**
 * What we can see. Settlements see as far as research allows; a ship sees from wherever it is
 * (a survey ship three times as far), and under way it sees, with the same eyes, every star near
 * the stretch it flew this turn (`flown`, from advanceFleets). A ship at the edge of what is known
 * (no uncharted star it knows of within SCAN_LOCAL) takes a long-baseline look, once per system,
 * and picks out the nearest stars no one has seen yet (a survey ship three, any other ship one),
 * so exploring can always go on, even across the gulfs between clusters; a survey ship under way
 * takes one a turn. Seen is only seen: charting still needs a stop. The far outliers in the void
 * stay hidden.
 */
export function updateDetection(state: GameState, mods: Mods, flown: Flown[] = []) {
  const eyes = watchEyes(state, mods);
  for (const s of Object.values(state.systems)) {
    if (state.civ.known[s.id]) continue;
    if (eyes.some((e) => distLy(e.sys, s) <= e.range)) state.civ.known[s.id] = 1;
  }
  // under way (part 1b): what lay near the way, and a survey ship's look from where it is now
  // (a Kinetic Lance has no eyes; a ship that has stopped this turn looked from its star, above)
  const seen: StarSystem[] = [];
  for (const { f, a, b } of flown) {
    if (isLance(f)) continue;
    const range = eyesOf(f, mods);
    for (const s of Object.values(state.systems)) {
      if (state.civ.known[s.id] || s.gone || s.special === 'outlier') continue;
      if (fromStretch(s.phys, a, b) <= range) {
        state.civ.known[s.id] = 1;
        seen.push(s);
      }
    }
    if (f.at || !canSurvey(f) || unchartedNear(state, b)) continue;
    for (const x of nearestUnseen(state, b, 3)) {
      state.civ.known[x.s.id] = 1;
      seen.push(x.s);
    }
  }
  if (seen.length)
    log(state, `Under way, our ships pick out ${seen.length === 1 ? 'a star' : `${seen.length} stars`} no one had seen: ${seen.slice(0, 4).map((s) => s.name).join(', ')}${seen.length > 4 ? ` and ${seen.length - 4} more` : ''}.`, 'info', seen[0].id);
  for (const f of fleets(state)) {
    if (!f.at || f.scanned === f.at) continue;
    const here = state.systems[f.at];
    // only from the edge of what is known: while an uncharted star lies close by, look there first
    if (unchartedNear(state, here.phys)) continue;
    f.scanned = f.at;
    const found = nearestUnseen(state, here.phys, canSurvey(f) ? 3 : 1);
    for (const x of found) state.civ.known[x.s.id] = 1;
    if (found.length)
      log(state, `From ${here.name}, ${f.name} picks out ${found.length === 1 ? 'a distant star' : `${found.length} distant stars`}: ${found.map((x) => `${x.s.name} (${formatDistance(x.ly)})`).join(', ')}.`, 'info', here.id);
  }
}

/**
 * What the active civilization's warships cost it a turn (part 2c): each class its own upkeep, by
 * `upkeepShare`, the Tide turns the turn is charged for (upkeepShare, flare.ts: like a structure's,
 * a turn slower than the Tide costs as much more as it is longer, a quicker one a whole turn's),
 * and asleep a tenth.
 */
export function fleetUpkeep(state: GameState, upkeepShare: number): number {
  let u = 0;
  for (const f of fleets(state)) for (const s of f.ships) u += SHIP_BY_ID[s.cls]?.upkeep ?? 0;
  return u * upkeepShare * (state.civ.dormant ? 0.1 : 1);
}

/** How many warships the active civilization keeps, for the upkeep's line. */
export function warshipCount(state: GameState): number {
  let n = 0;
  for (const f of fleets(state)) for (const s of f.ships) if (SHIP_BY_ID[s.cls]?.upkeep) n++;
  return n;
}

/** The chance a civilization's ships stopped at a star (the active one's, unless another is named) turn a raid or a Kinetic Lance away from it: each screen a chance of its own. */
export function screenAt(state: GameState, systemId: string, owner = state.civ.id): number {
  let through = 1;
  for (const f of allFleets(state)) if (f.owner === owner && f.at === systemId) for (const s of f.ships) through *= 1 - (SHIP_BY_ID[s.cls]?.screen ?? 0);
  return 1 - through;
}

/** The share of a ship's hull a Shipyard mends in a turn, at a star where its owner has one. */
export const REPAIR_SHARE = 0.1;

/** Ships stopped where their civilization has a Shipyard are mended, a little each turn (part 2c). */
export function repairFleets(state: GameState) {
  const yards = new Set(colonies(state).filter((c) => (c.structures.shipyard ?? 0) > 0).map((c) => c.systemId));
  if (!yards.size) return;
  for (const f of fleets(state)) {
    if (!f.at || !yards.has(f.at)) continue;
    for (const s of f.ships) {
      const max = SHIP_BY_ID[s.cls]?.hp ?? s.hp;
      if (s.hp < max) s.hp = Math.min(max, s.hp + max * REPAIR_SHARE);
    }
  }
}

/** How warm a civilization's settlements at this star look to the Hunger (the active one's, unless `civId`). */
export function signatureOf(state: GameState, systemId: string, civId = state.civ.id): number {
  let sig = 0;
  for (const c of allColonies(state)) {
    if (c.systemId !== systemId || c.owner !== civId) continue;
    for (const [id, n] of Object.entries(c.structures)) sig += (STRUCTURE_BY_ID[id]?.signature ?? 0) * n;
    sig += (c.pops.kin + c.pops.chorus) * 0.3;
    if (c.overdrive) sig += 4;
  }
  return sig;
}

/** Warships: anything that can fight. */
export function isWarFleet(f: Fleet): boolean {
  return f.ships.some((x) => isWarship(x.cls));
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
  const claimed = new Set(fleets(state).map((f) => f.to).filter((x): x is string => !!x));
  for (const f of fleets(state)) {
    if (f.auto !== 'explore' || !f.at || f.to) continue;
    if (!canSurvey(f)) {
      f.auto = undefined;
      continue;
    }
    const here = state.systems[f.at];
    const next = Object.values(state.systems)
      // never into a swarm we can see feeding there
      .filter((x) => state.civ.known[x.id] === 1 && !x.gone && !claimed.has(x.id) && !swarmSeenAt(state, x.id))
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

/** Room for Kin a world offers on its own, before any domes or warrens (with `state`, as terraformed). */
export function naturalKinRoom(b: Body, state: GameState): number {
  if (b.dissolved) return 0;
  // as kinBaseCapacity: a flaring star leaves nowhere on the surface livable, nor does a world
  // frozen hard; a frozen world melted into warm sea has room by the water
  if (scorched(state, b) || frozenHard(state, b)) return 0;
  // too cold to live in the open (OPEN_AIR_K): domes needed, unless warmed into a sea (below)
  let cap = tooColdForOpenAir(state, b) ? 0 : Math.floor(Math.round(12 * habitabilityOf(state, b)) * b.vitality);
  if (b.rogue || b.feeding) cap = Math.floor(cap * 0.3);
  if (thawed(state, b) === 'warm') cap = Math.max(cap, THAW_ROOM);
  return cap;
}

/** Habitable enough to be news: at least half as good as a living world can be, right now. */
export const LIVING_WORLD = 0.5;

/** Unsettled worlds in a system that are at least LIVING_WORLD habitable. */
export function livingWorlds(state: GameState, systemId: string): Body[] {
  return state.systems[systemId].bodies
    .map((id) => state.bodies[id])
    .filter((b) => b && !b.dissolved && !b.colonyId && b.kind !== 'gas_giant' && b.habitability * b.vitality >= LIVING_WORLD);
}
