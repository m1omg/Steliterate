// The other civilizations (the new version, docs/plans/new-version.md, part 2a-2): each neighbour
// plays the same game as ours, with a Civ of its own under the id of its Survivor record. That
// record stays as who it is to us and how we stand (today's messages, pleas, raids, trades and
// pacts), its size, health and stars read from its real civilization each turn (syncSurvivor).
// A game with `civsAsleep` keeps the neighbours as they were, simulated lightly.
import { STRUCTURE_BY_ID } from '../data/structures';
import { blankCiv } from '../gen';
import { hashSeed } from '../rng';
import { asCiv, send } from '../civs';
import type { Body, Civ, Colony, Fleet, GameState, Survivor, SurvivorWay, ThreadId } from '../types';
import { structureCheck } from './actions';
import { capacity } from './economy';
import { createColony, newFleet } from './fleets';
import { ROCKY, survivorWorld } from './homes';
import { computeMods } from './mods';
import { project } from './projection';
import { clamp, coloniesOf, distLy } from './util';

/** What a way of life already knows how to do (and whatever its first structures need, foundCiv). */
const WAY_TECHS: Record<SurvivorWay, string[]> = {
  garden: [],
  upload: ['mind_substrate', 'upload'],
  chorus: ['mind_substrate', 'upload', 'mind_merging'],
  dormant: ['hardy_lineages', 'cold_sleep'],
  lattice: ['autonomous_replicators'],
  fork: [],
};

/**
 * Who a way of life begins with, for a civilization the size of `n` of our Kin (we begin with 8):
 * a Chorus is many minds already merged, two Echoes to each, with Echoes still to gather; the
 * sleepers keep two awake.
 */
function startPeople(way: SurvivorWay, n: number): { pops: Partial<Record<ThreadId, number>>; cryo: number } {
  switch (way) {
    case 'upload':
      return { pops: { echoes: n }, cryo: 0 };
    case 'chorus': {
      const chorus = Math.max(2, Math.round((n * 3) / 8));
      return { pops: { chorus, echoes: Math.max(2, n - 2 * chorus) }, cryo: 0 };
    }
    case 'dormant':
      return { pops: { kin: 2 }, cryo: n - 2 };
    case 'lattice':
      return { pops: { lattice: n }, cryo: 0 };
    default:
      return { pops: { kin: n }, cryo: 0 };
  }
}

/** Whether a neighbour is a civilization of its own, playing the same game (not one simulated lightly). */
export function civOf(state: GameState, sv: Survivor): Civ | null {
  return state.civs[sv.id] ?? null;
}

/**
 * The world a neighbour's civilization begins on. Those still in their bodies keep to the most
 * livable world and the sleepers to the warmest core, as before (survivorWorld); minds on
 * substrate and the Lattice need no air, but by the same rules as ours they need ground to mine
 * and warmth to tap: the richest and warmest rock, or failing any, the Deep.
 */
function capitalWorld(state: GameState, sv: Survivor): Body | null {
  if (sv.way === 'garden' || sv.way === 'dormant' || sv.way === 'fork') return survivorWorld(state, sv);
  const sys = state.systems[sv.homeSystemId];
  const free = sys.bodies.map((id) => state.bodies[id]).filter((b): b is Body => !!b && !b.dissolved && !b.colonyId);
  let top: Body | null = null;
  for (const b of free) if (ROCKY.includes(b.kind) && (!top || b.richness + b.coreHeat > top.richness + top.coreHeat)) top = b;
  return top ?? free.find((b) => b.kind === 'deep') ?? free[0] ?? null;
}

/** What we begin with to spare each turn (for 8 Kin): energy and matter. */
const START_NET = { energy: 3.5, matter: 4 };

/** The sources of energy a new civilization may begin with, where its world and star allow them. */
const START_SOURCES = ['geothermal_tap', 'solar_array', 'orbital_collector', 'fusion_plant'];

/** Turns of matter a civilization whose ground cannot give it what ours gives us brings in store. */
const STORE_TURNS = 25;

/**
 * A neighbour's civilization, as it begins: its capital on its world (capitalWorld), its people
 * (startPeople), and a start like ours scaled by its size, by the same rules as ours: the
 * structures its people need room in, a shipyard, an Archive Spire and a Commons, mines, and as
 * many sources of energy as its world and star allow until it has about what we begin with to
 * spare (START_NET), each one where it may be built (structureCheck), its research known; a
 * probe and an escort. After everything else is made, so that no galaxy changes, and drawing
 * nothing: a seed's neighbours begin the same every time. A garden whose world cannot hold its
 * Kin gets domes and warrens, as our own dying world would.
 */
export function foundCiv(state: GameState, sv: Survivor): Civ {
  const sys = state.systems[sv.homeSystemId];
  const civ = blankCiv(sv.id, sv.name, sv.homeSystemId);
  const scale = clamp(sv.pop / 24, 0.75, 1.25);
  civ.energy = Math.round(60 * scale);
  civ.matter = Math.round(120 * scale);
  civ.resolve = Math.round(40 + 30 * sv.health);
  civ.techs = [...WAY_TECHS[sv.way]];
  civ.rng = hashSeed(`${state.settings.seed}:civ:${sv.id}`);
  // its own reach charted, as ours is; the Heart is seen from anywhere
  for (const s of Object.values(state.systems)) if (s.regionId === sys.regionId) civ.known[s.id] = 1;
  civ.known[sys.id] = 2;
  const heart = Object.values(state.systems).find((s) => s.special === 'core');
  if (heart) civ.known[heart.id] = 1;
  state.civs[sv.id] = civ;
  asCiv(state, sv.id, () => {
    const b = capitalWorld(state, sv);
    if (!b) return;
    const n = Math.round(8 * scale);
    const who = startPeople(sv.way, n);
    const c = createColony(state, b, who.pops);
    c.cryo = who.cryo;
    c.name = b.kind === 'deep' ? `${sys.name} Deep` : b.name;
    civ.capitalId = c.id;
    // as many of a structure as may be built here (up to `upTo`), its research known with it
    const put = (id: string, upTo = 1) => {
      const d = STRUCTURE_BY_ID[id];
      while ((c.structures[id] ?? 0) < upTo) {
        const learn = !!d.tech && !civ.techs.includes(d.tech);
        if (learn) civ.techs.push(d.tech!);
        if (structureCheck(state, c, d)) {
          if (learn) civ.techs.pop();
          return false;
        }
        c.structures[id] = (c.structures[id] ?? 0) + 1;
      }
      return true;
    };
    put('shipyard');
    put('archive_spire');
    put('commons');
    roomFor(state, c, put);
    put('mine', 2);
    const spare = () => {
      const p = project(state);
      return { energy: p.energyIn - p.energyOut, matter: p.matterIn - p.matterOut };
    };
    // energy to spare, from what this world and star give (its core's warmth, its sun's light, or
    // fusion): each time the source that brings it nearest what we begin with, until it is near
    const want = START_NET.energy * scale;
    for (let i = 0; i < 8; i++) {
      const now = spare().energy;
      if (now >= 0.85 * want) break;
      let pick: { id: string; e: number } | null = null;
      for (const s of START_SOURCES) {
        const had = c.structures[s] ?? 0;
        const knew = civ.techs.length;
        if (!put(s, had + 1)) continue;
        const e = spare().energy;
        if (had) c.structures[s] = had;
        else delete c.structures[s];
        civ.techs.length = knew;
        if (e > now + 0.05 && (!pick || Math.abs(e - want) < Math.abs(pick.e - want))) pick = { id: s, e };
      }
      if (!pick) break;
      put(pick.id, (c.structures[pick.id] ?? 0) + 1);
    }
    for (let i = 0; i < 3 && spare().matter < START_NET.matter * scale; i++) if (!put('mine', (c.structures.mine ?? 0) + 1)) break;
    // what its ground cannot give it brought with it: matter for the turns it would have mined
    const short = START_NET.matter * scale - spare().matter;
    if (short > 0) civ.matter += Math.round(short * STORE_TURNS);
    newFleet(state, sys.id, ['probe']);
    newFleet(state, sys.id, ['warden']).order = 'hold';
  });
  return civ;
}

/**
 * Room for a new civilization's people: substrate for its Echoes, Confluence Nodes for its Chorus,
 * foundries for its Lattice, berths for its sleepers; and for Kin whose world cannot hold them,
 * domes, then warrens, as many as they need.
 */
function roomFor(state: GameState, c: Colony, put: (id: string, upTo?: number) => boolean) {
  const mods = computeMods(state);
  const cap = () => capacity(state, c, mods);
  for (let i = 0; i < 6 && cap().echoes < c.pops.echoes + (c.pops.chorus ? 2 : 0); i++) put('substrate_core', (c.structures.substrate_core ?? 0) + 1);
  if (c.pops.chorus) put('confluence_node', Math.min(3, Math.ceil((c.pops.chorus + 1) / 3)));
  if (c.pops.lattice) put('lattice_foundry', Math.min(3, Math.ceil(c.pops.lattice / 6)));
  if (c.cryo) put('cryo_hall', Math.ceil(c.cryo / 10));
  if (c.pops.kin) {
    for (let i = 0; i < 5 && cap().kin < c.pops.kin; i++) put('habitat_dome', (c.structures.habitat_dome ?? 0) + 1);
    for (let i = 0; i < 3 && cap().kin < c.pops.kin; i++) if (!put('warrens', (c.structures.warrens ?? 0) + 1)) break;
  }
}

/**
 * A neighbour as we know it, read from its civilization (each turn, before it speaks): how many
 * it is (on the old scale, three to a person, as `pop` always was; a Chorus counts the two minds
 * merged in each), its health (1 thriving, 0 gone: what its reserve, its starving settlements
 * and its will come to), its stars (its capital's first) and whether it lives. A civilization
 * whose game is over is gone.
 */
export function syncSurvivor(state: GameState, sv: Survivor): void {
  const civ = civOf(state, sv);
  if (!civ) return;
  const cs = coloniesOf(state, civ.id);
  let people = 0;
  let starving = 0;
  for (const c of cs) {
    people += c.pops.kin + c.pops.echoes + 2 * c.pops.chorus + c.pops.lattice + c.pops.coldminds + c.cryo;
    if (c.starving > 0) starving++;
  }
  sv.pop = people * 3;
  const reserve = clamp(civ.energy / 80, 0, 1);
  const fed = cs.length ? 1 - starving / cs.length : 0;
  sv.health = civ.outcome || people <= 0 ? 0 : clamp(0.15 + 0.35 * fed + 0.25 * reserve + 0.25 * (civ.resolve / 100), 0, 1);
  const capSys = cs.find((c) => c.id === civ.capitalId)?.systemId;
  const stars = [...new Set(cs.map((c) => c.systemId))];
  if (capSys) stars.sort((a, b) => Number(b === capSys) - Number(a === capSys));
  // when it settles a new star we see it as its light reaches us (seenThere, claimedAt)
  for (const id of stars) if (!sv.systems.includes(id)) (sv.claimedAt ??= {})[id] = state.years;
  if (stars.length) {
    sv.systems = stars;
    sv.homeSystemId = capSys ?? stars[0];
  }
  // what its light shows us, a turn at a time, each kept until a later one has reached us
  const seen = (sv.seen ??= []);
  seen.push({ at: state.years, pop: sv.pop, health: sv.health });
  const ly = lightYearsToUs(state, sv.homeSystemId);
  while (seen.length > 1 && (!isFinite(state.years) || state.years >= seen[1].at + ly)) seen.shift();
}

/** Where we see another civilization's fleet: at a star, or a share `u` of the way along a leg between two. */
export type FleetSeen = { at: string } | { from: string; to: string; u: number };

/**
 * Where we see another civilization's fleet now, as its light shows it: where it was when the
 * light that reaches our capital this turn left it (its leg's times, Fleet.departed and since).
 * A fleet built or come since that light left is not yet seen where it is: we see it still on its
 * way, or not yet. Only at or between stars we know of; null if we see it nowhere.
 */
export function fleetSeen(state: GameState, f: Fleet): FleetSeen | null {
  const known = state.civs[state.player]?.known ?? {};
  const now = state.years;
  const cur: FleetSeen | null = f.at ? { at: f.at } : f.from && f.to ? { from: f.from, to: f.to, u: f.distance > 0 ? Math.min(1, f.traveled / f.distance) : 1 } : null;
  if (!cur) return null;
  let seen: FleetSeen | null = cur;
  if (f.owner !== state.player && isFinite(now)) {
    const t = now - lightYearsFrom(state, cur);
    if ('at' in cur) {
      if (f.since !== undefined && t < f.since) {
        // the light of its coming has not reached us: still on its last leg, or not yet made
        if (f.cameFrom && f.departed !== undefined && f.departed < f.since) seen = t < f.departed ? { at: f.cameFrom } : { from: f.cameFrom, to: cur.at, u: (t - f.departed) / (f.since - f.departed) };
        else seen = null;
      }
    } else if (f.departed !== undefined) {
      if (t < f.departed) seen = { at: cur.from };
      else seen = { ...cur, u: now > f.departed ? Math.max(0, Math.min(cur.u, (cur.u * (t - f.departed)) / (now - f.departed))) : 0 };
    }
  }
  if (!seen) return null;
  if ('at' in seen) return known[seen.at] ? seen : null;
  return known[seen.from] || known[seen.to] ? seen : null;
}

/** Light-years from where a fleet is (at a star, or along a leg) to our capital. */
function lightYearsFrom(state: GameState, p: FleetSeen): number {
  if ('at' in p) return lightYearsToUs(state, p.at);
  const a = state.systems[p.from]?.phys;
  const b = state.systems[p.to]?.phys;
  const me = state.civs[state.player];
  const cap = me.capitalId ? state.colonies[me.capitalId] : undefined;
  const here = state.systems[cap?.systemId ?? me.homeSystemId]?.phys;
  if (!a || !b || !here) return 0;
  return Math.hypot(a.x + (b.x - a.x) * p.u - here.x, a.y + (b.y - a.y) * p.u - here.y, a.z + (b.z - a.z) * p.u - here.z);
}

/** Light-years from a star to our capital (or our first star). */
function lightYearsToUs(state: GameState, systemId: string): number {
  const me = state.civs[state.player];
  const cap = me.capitalId ? state.colonies[me.capitalId] : undefined;
  const here = state.systems[cap?.systemId ?? me.homeSystemId];
  const there = state.systems[systemId];
  return here && there ? distLy(here, there) : 0;
}

/** A neighbour as we see it: a civilization of its own as its light left it (syncSurvivor), one simulated lightly as it is. */
export function asSeen(state: GameState, sv: Survivor): { pop: number; health: number } {
  const first = civOf(state, sv) ? sv.seen?.[0] : undefined;
  return first ?? { pop: sv.pop, health: sv.health };
}

/** Whether we see another civilization's settlement: its founding's light has reached our capital. */
export function settlementSeen(state: GameState, c: Colony): boolean {
  if (c.owner === state.player) return true;
  return c.foundedAt === undefined || !isFinite(state.years) || state.years >= c.foundedAt + lightYearsToUs(state, c.systemId);
}

/**
 * A neighbour's civilization ends with its story (its people faded, came to us, were taken or
 * devoured): it plays no more, and whatever of it is left is empty, unless it was taken (`to`:
 * its settlements and ships become that civilization's). Through the outbox (civs.ts), so that
 * it holds even when decided in another's part of a turn.
 */
export function endCiv(state: GameState, sv: Survivor, ending: string, to?: string): void {
  if (civOf(state, sv)) send(state, sv.id, { end: { ending, ...(to ? { to } : {}) } });
}
