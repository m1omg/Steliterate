// The Long Flow (Dyson 1979, "Time without end", §F). At the absolute zero an atom still tunnels
// out of its place now and then, in about e^S × 10⁻¹⁴ s with S ≈ 27·√A: for iron, about 10⁶⁵
// years. On longer times every solid flows like a slow liquid: whatever is not mended runs into
// smooth lumps, and every body, a world or a stone, slumps into a sphere. It is happening now,
// far too slowly to notice; what decides whether it matters is how fast a mind thinks. From
// η 65 a turn lasts some 10⁶⁶ years, so whatever no one tends flows within one of our turns, and a
// mind that thinks once in longer than the flow sees its own vaults flow between two thoughts.
// It comes only where matter lasts that long: if it is stable, or under curvature radiation
// (until the Great Evaporation). Leptonic structures are not made of atoms, and do not flow.

import { STRUCTURE_BY_ID, structureLabel } from '../data/structures';
import type { Colony, GameState, ThreadId } from '../types';
import { fateOf, matterGone } from '../fate';
import { strainFor, type Mods } from './mods';
import { destroyColony } from './fleets';
import { queueEvent } from './events';
import { colonies, log, popsOf } from './util';

/** When the Long Flow comes (η): iron's tunnelling time, 10^65 years. */
export const FLOW_ETA = 65;
/** Minds slower than the flow keep watchers awake between their thoughts: half again their upkeep. */
export const FLOW_WATCH = 1.5;
/** Asleep, the watchers must still wake to mend: dormancy costs this share of upkeep, not a tenth (unless The Long Watch). */
export const FLOW_DORMANT = 0.3;

/** Has the Long Flow come, with ordinary matter still there to flow? */
export function flowing(state: GameState): boolean {
  return state.civ.flags.flowed !== undefined && !matterGone(state);
}

/** Will the Long Flow come (matter that lasts that long), and has it not yet? */
export function flowAhead(state: GameState): boolean {
  return state.civ.flags.flowed === undefined && fateOf(state) !== 'decay' && !matterGone(state);
}

/**
 * Who keeps a settlement against the flow. Kin, the Lattice (self-maintaining) and any mind that
 * thinks faster than the flow keep it whole ('kept'); minds that all think slower must keep
 * watchers awake ('watched'); with no one awake at all, sleepers or no one, it flows ('unmanned').
 */
export type Keeping = 'kept' | 'watched' | 'unmanned';

const MINDS: ThreadId[] = ['echoes', 'chorus', 'coldminds'];

export function keeping(c: Colony, logL: number, mods: Mods, slowOrders = 0): Keeping {
  if (c.pops.kin > 0 || c.pops.lattice > 0) return 'kept';
  let awake = false;
  for (const t of MINDS) {
    if (c.pops[t] <= 0) continue;
    awake = true;
    if (strainFor(t, logL, mods, slowOrders).clock < FLOW_ETA) return 'kept';
  }
  return awake ? 'watched' : 'unmanned';
}

/** What flows first at a settlement no one keeps: the cheapest structure, Cryo Halls last; leptonic ones never. */
export function nextToFlow(c: Colony): string | null {
  const ids = Object.keys(c.structures).filter((id) => (c.structures[id] ?? 0) > 0 && STRUCTURE_BY_ID[id] && !STRUCTURE_BY_ID[id].decayProof);
  if (!ids.length) return null;
  const last = (id: string) => (id === 'cryo_hall' ? 1 : 0);
  ids.sort((a, b) => last(a) - last(b) || STRUCTURE_BY_ID[a].cost - STRUCTURE_BY_ID[b].cost || a.localeCompare(b));
  return ids[0];
}

/**
 * The Long Flow, each turn (η is where this turn ends): it comes at η 65 (relics no one is digging
 * flow away, and we hear of it), then every settlement no one keeps loses one structure a turn, its
 * sleepers with the last Cryo Hall that held them.
 */
export function theLongFlow(state: GameState, eta: number, logL: number, mods: Mods, slowOrders: number) {
  if (state.civ.flags.flowed === undefined) {
    if (!flowAhead(state) || eta < FLOW_ETA) return;
    comes(state, logL, mods, slowOrders);
  }
  if (!flowing(state)) return;
  for (const c of colonies(state)) {
    if (keeping(c, logL, mods, slowOrders) !== 'unmanned') continue;
    const id = nextToFlow(c);
    if (!id) continue;
    const sys = state.systems[c.systemId];
    c.structures[id]--;
    if (c.structures[id] <= 0) delete c.structures[id];
    let lost = 0;
    if (id === 'cryo_hall') {
      const room = Object.entries(c.structures).reduce((a, [k, n]) => a + (STRUCTURE_BY_ID[k]?.cryoCap ?? 0) * n, 0);
      if (c.cryo > room) {
        lost = c.cryo - room;
        c.cryo = room;
      }
    }
    log(state, `${c.name}: ${structureLabel(id, sys).name} has flowed away, with no one awake to mend it${lost ? `, and ${lost} sleeper${lost === 1 ? '' : 's'} in it` : ''}.`, 'bad', sys.id);
    if (popsOf(c) + c.cryo <= 0 && !Object.keys(c.structures).length) destroyColony(state, c, 'it has flowed away');
  }
}

/** The flow arrives: relics no one is digging run into smooth lumps; we hear of it. */
function comes(state: GameState, logL: number, mods: Mods, slowOrders: number) {
  state.civ.flags.flowed = state.turn;
  let found = 0;
  for (const b of Object.values(state.bodies)) {
    if (!b.relic || b.relic.flowed || b.dissolved) continue;
    // someone awake working a Relic Excavation there keeps its ruin
    const dig = b.colonyId ? state.colonies[b.colonyId] : undefined;
    if (dig && (dig.structures.relic_dig ?? 0) > 0 && keeping(dig, logL, mods, slowOrders) !== 'unmanned') continue;
    b.relic.flowed = true;
    if (b.relic.state !== 'hidden') found++;
  }
  queueEvent(state, 'long_flow', { ruins: found });
  log(state, 'The Long Flow: from now on every solid flows, slowly; whatever no one is awake to mend runs into smooth lumps.', 'era');
}
