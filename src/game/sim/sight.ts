import { calendarEra } from '../fate';
import type { GameState, StarSystem, Swarm, Vec3 } from '../types';
import { watchEyes } from './fleets';
import { computeMods, type Mods } from './mods';
import { hasTech } from './util';

// What we can see of the Hunger. An awake swarm at a star we know is seen there, as ever; one
// between stars only within the range our eyes chart stars at (watchEyes). Hunger Studies
// ("Reveals swarms within detection range and forecasts their paths") shows the sleeping ones
// within that range too, and where each one we see is going, and when it will get there.

/** How fast a swarm crosses between stars, in ly a year: a twentieth of light in the Dusk, half of it after. */
export function swarmSpeed(state: GameState): number {
  return calendarEra(state) === 'dusk' ? 0.05 : 0.5;
}

/** Where a swarm is now (ly, as the stars' `phys`): at its star, or along its way; null if nowhere. */
export function swarmPlace(state: GameState, sw: Swarm): Vec3 | null {
  if (sw.systemId) return state.systems[sw.systemId]?.phys ?? null;
  if (!sw.from || !sw.to || !state.systems[sw.from] || !state.systems[sw.to]) return null;
  const a = state.systems[sw.from].phys;
  const b = state.systems[sw.to].phys;
  const u = sw.distance > 0 ? Math.min(1, sw.traveled / sw.distance) : 0;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u };
}

/** Whether we know the swarms' ways: Hunger Studies. */
export function readsSwarms(state: GameState): boolean {
  return hasTech(state, 'hunger_studies');
}

/** When a swarm on its way reaches the star it is heading for (years), at the speed it crosses at now; Infinity if it is not on its way. */
export function swarmArrives(state: GameState, sw: Swarm): number {
  if (sw.systemId || !sw.to) return Infinity;
  return state.years + Math.max(0, sw.distance - sw.traveled) / swarmSpeed(state);
}

/** Whether a swarm answers to us: tamed. */
function ours(sw: Swarm): boolean {
  return sw.tamed;
}

/**
 * What we see of the swarms now, as a test of one swarm (the eyes worked out once): an awake one
 * at a star we know; one under way within our eyes' range; with Hunger Studies a sleeping one in
 * range too; and always one under our command.
 */
export function swarmSight(state: GameState, mods: Mods = computeMods(state)): (sw: Swarm) => boolean {
  const eyes = watchEyes(state, mods);
  const reads = readsSwarms(state);
  const inRange = (p: Vec3) => eyes.some((e) => Math.hypot(e.sys.phys.x - p.x, e.sys.phys.y - p.y, e.sys.phys.z - p.z) <= e.range);
  return (sw) => {
    if (ours(sw)) return true;
    const p = swarmPlace(state, sw);
    if (!p) return false;
    if (!sw.awake && !sw.tamed) return reads && inRange(p);
    if (sw.systemId) return !!state.civ.known[sw.systemId];
    return inRange(p);
  };
}

/**
 * The nearest awake, untamed swarm we can see from a star, as the map shows them (at a star we
 * know, or under way within our eyes' range), and how far it is; null if we see none.
 */
export function nearestSwarmSeen(state: GameState, systemId: string): { ly: number; at: StarSystem | null; size: number } | null {
  const here = state.systems[systemId];
  if (!here) return null;
  const seen = swarmSight(state);
  let best: { ly: number; at: StarSystem | null; size: number } | null = null;
  for (const w of Object.values(state.swarms)) {
    if (!w.awake || w.tamed || !seen(w)) continue;
    const p = swarmPlace(state, w);
    if (!p) continue;
    const ly = Math.hypot(here.phys.x - p.x, here.phys.y - p.y, here.phys.z - p.z);
    if (!best || ly < best.ly) best = { ly, at: w.systemId ? (state.systems[w.systemId] ?? null) : null, size: w.size };
  }
  return best;
}

/** A sleeping swarm Hunger Studies shows us at this star: a nest that may yet wake. */
export function nestSeenAt(state: GameState, systemId: string): boolean {
  if (!readsSwarms(state)) return false;
  const seen = swarmSight(state);
  return Object.values(state.swarms).some((w) => w.systemId === systemId && asleep(w) && seen(w));
}

/** A swarm asleep, seen only with Hunger Studies (drawn dim, marked "asleep"). */
export function asleep(sw: Swarm): boolean {
  return !sw.awake && !sw.tamed;
}
