import type { Body, GameState, Survivor } from '../types';

// Where another civilization actually lives within one of its systems. It is worked out from how
// they survive, never stored: those still in their bodies keep to the most livable world, the
// sleepers to a vault under the warmest core, and minds on substrate to orbital habitats in the
// Deep (or failing that the largest world). A world we have settled is never theirs.

const ROCKY = ['eyeball', 'terran', 'super_earth', 'barren', 'ice', 'ocean_ice'];

function best(list: Body[], score: (b: Body) => number): Body | null {
  let top: Body | null = null;
  for (const b of list) if (!top || score(b) > score(top)) top = b;
  return top;
}

/** The world another civilization lives on in one of its systems. */
export function survivorWorld(state: GameState, sv: Survivor, systemId = sv.homeSystemId): Body | null {
  const sys = state.systems[systemId];
  if (!sys) return null;
  const free = sys.bodies.map((id) => state.bodies[id]).filter((b): b is Body => !!b && !b.dissolved && !b.colonyId);
  if (!free.length) return null;
  const rocky = free.filter((b) => ROCKY.includes(b.kind));
  const ground = rocky.length ? rocky : free;
  switch (sv.way) {
    case 'garden':
      return best(ground, (b) => b.habitability * b.vitality * 10 + b.habitability);
    case 'dormant':
      return best(ground, (b) => b.coreHeat);
    default:
      return free.find((b) => b.kind === 'deep') ?? best(ground, (b) => b.massEarth);
  }
}

/** The civilization living on this world, if one does. */
export function residentsOf(state: GameState, b: Body): Survivor | null {
  for (const sv of Object.values(state.survivors)) {
    if (!sv.alive || !sv.systems.includes(b.systemId)) continue;
    if (survivorWorld(state, sv, b.systemId)?.id === b.id) return sv;
  }
  return null;
}

/** How to count them: bodies, minds, one mind of many voices, or processes. */
export function survivorPeople(sv: Survivor): string {
  const n = Math.round(sv.pop);
  switch (sv.way) {
    case 'upload':
      return `${n} minds`;
    case 'chorus':
      return `${n} voices in one mind`;
    case 'lattice':
      return `${n} processes`;
    default:
      return `${n} people`;
  }
}
