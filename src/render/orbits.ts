import { hashSeed } from '../game/rng';
import type { Body } from '../game/types';

// Where the system view draws each world's orbit (1 Nov, the player: "Some gas giant planets look
// like they will collide with each other in the system view. Please correct that. Retrospectively
// too"). A world's drawn orbit is its generated one (`Body.orbit`, in the view's units, out from the
// star's edge), pushed out only as far as it must be for its drawing (a gas giant up to 4.8 across,
// its rings to 2.2 times that) to clear its neighbour's and the star's. Display only: nothing
// stored, so every game, begun before or after, is drawn so.

/** Room left between two worlds' drawings (view units). */
export const ORBIT_GAP = 1.5;

/** Whether a gas giant is drawn with rings (systemView: one in three, by its id). */
export function ringed(b: Pick<Body, 'kind' | 'id'>): boolean {
  return b.kind === 'gas_giant' && hashSeed(b.id) % 3 === 0;
}

/** How far a world's drawing reaches from its centre: its rings, a belt's scatter, else the marks drawn round a world (1.5 times its size). */
export function drawnReach(b: Pick<Body, 'kind' | 'id' | 'size'>): number {
  if (b.kind === 'asteroids') return 3;
  return b.size * (ringed(b) ? 2.2 : 1.5);
}

/** Each world's drawn orbit radius, by id: the deep and rogue worlds are drawn their own ways and left out. */
export function drawnOrbits(bodies: Body[], primaryRadius: number): Map<string, number> {
  const out = new Map<string, number>();
  const list = bodies.filter((b) => b.kind !== 'deep' && !b.rogue).sort((a, b) => a.orbit - b.orbit);
  let prevR = 0;
  // (the star and the first of its glow)
  let prevReach = primaryRadius * 1.2;
  for (const b of list) {
    const reach = drawnReach(b);
    const r = Math.max(b.orbit + primaryRadius * 1.5, prevR + prevReach + reach + ORBIT_GAP);
    out.set(b.id, r);
    prevR = r;
    prevReach = reach;
  }
  return out;
}
