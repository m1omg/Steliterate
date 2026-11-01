// Worlds drawn apart (1 Nov, the player: "Some gas giant planets look like they will collide with
// each other in the system view. Please correct that. Retrospectively too"; orbits.ts). For every
// system of a few galaxies, begun in the Dusk and in the Twilight Interregnum:
// - each world's drawing (its rings, a belt's scatter, the marks round a world) clears its
//   neighbours' and the star's;
// - a world whose drawing met nothing keeps its orbit where it was drawn before;
// - nothing stored: the same for a game begun before.
import { newGame } from '../../../src/game/newGame';
import { ORBIT_GAP, drawnOrbits, drawnReach } from '../../../src/render/orbits';
import type { Body } from '../../../src/game/types';
import { check, done } from '../lib';

let systems = 0;
let moved = 0;
let worldsMoved = 0;
let bad = '';
for (const interregnum of [false, true]) {
  for (let seed = 1000; seed < 1004; seed++) {
    const s = newGame({ seed, interregnum, civsAsleep: true });
    for (const sys of Object.values(s.systems)) {
      const bodies = sys.bodies.map((id) => s.bodies[id]).filter((b): b is Body => !!b && !b.dissolved);
      const list = bodies.filter((b) => b.kind !== 'deep' && !b.rogue).sort((a, b) => a.orbit - b.orbit);
      if (!list.length) continue;
      systems++;
      const pr = 5;
      const at = drawnOrbits(bodies, pr);
      let prevR = 0;
      let prevReach = pr * 1.2;
      let any = false;
      // where it was drawn before, and whether its drawing met its neighbour's there
      let overlapBefore = false;
      for (const [i, b] of list.entries()) {
        const r = at.get(b.id)!;
        const reach = drawnReach(b);
        if (r - prevR < prevReach + reach + ORBIT_GAP - 1e-9) bad ||= `${sys.name}: ${b.name} meets its neighbour`;
        const was = b.orbit + pr * 1.5;
        if (i > 0) {
          const wasPrev = list[i - 1].orbit + pr * 1.5;
          if (was - wasPrev < drawnReach(list[i - 1]) + reach + ORBIT_GAP) overlapBefore = true;
        } else if (was < pr * 1.2 + reach + ORBIT_GAP) overlapBefore = true;
        if (Math.abs(r - was) > 1e-9) {
          any = true;
          worldsMoved++;
          if (!overlapBefore) bad ||= `${sys.name}: ${b.name} moved though nothing within met`;
        }
        prevR = r;
        prevReach = reach;
      }
      if (any) moved++;
    }
  }
}
check(!bad, bad || `every world's drawing clears its neighbours' and the star's (${systems} systems, eight galaxies)`);
check(moved > 0 && moved < systems, `only where they met: ${moved} systems of ${systems} drawn wider (${worldsMoved} worlds moved out)`);
done('ORBITS DRAWN');
