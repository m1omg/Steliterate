// Two fixes from the player's screenshots (24 Oct), for saved games too:
// - Room for Kin without domes needs a warmest ground averaging at least OPEN_AIR_K, −14.9 °C, the
//   yearly mean of Oymyakon (the player: "that should be the limit"). A world between the frozen
//   hard line (195 K) and that has no room in the open; the Warrens of Abandon the Surface still
//   hold their share, and Orbital Lamps lift a world over it.
// - A rush finishes the project at once, not at the turn's end (the player: "Why is there even an
//   option to rush a building which will complete in one turn?").
import { newGame } from '../../../src/game/newGame';
import { FROZEN_K, OPEN_AIR_K, bodyClimate, tooColdForOpenAir } from '../../../src/game/physics';
import { queueBuild, rushBuild } from '../../../src/game/sim/actions';
import { kinBaseCapacity } from '../../../src/game/sim/economy';
import { naturalKinRoom } from '../../../src/game/sim/fleets';
import { computeMods } from '../../../src/game/sim/mods';
import { habitabilityOf } from '../../../src/game/sim/terraform';
import { colonies } from '../../../src/game/sim/util';
import type { Body, GameState } from '../../../src/game/types';
import { check, done } from '../lib';

const warm = (s: GameState, b: Body) => {
  const c = bodyClimate(s, b);
  return c.day ?? c.mean;
};
const fresh = (seed: number) => newGame({ seed, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable', civsAsleep: true }) as GameState;

// ---- a living world colder than Oymyakon, and one warmer
let cold: { s: GameState; b: Body } | null = null;
let mild: { s: GameState; b: Body } | null = null;
for (let seed = 1; seed < 80 && (!cold || !mild); seed++) {
  const s = fresh(seed);
  for (const b of Object.values(s.bodies)) {
    if (b.kind === 'deep' || b.colonyId || b.rogue || habitabilityOf(s, b) * b.vitality < 0.3) continue;
    const t = warm(s, b);
    if (!cold && t >= FROZEN_K && t < OPEN_AIR_K - 5) cold = { s, b };
    if (!mild && t >= OPEN_AIR_K + 5 && t < 330) mild = { s, b };
  }
}
check(!!cold && !!mild, `found a living world too cold to live outside (${cold && Math.round(warm(cold.s, cold.b))} K) and one warm enough (${mild && Math.round(warm(mild.s, mild.b))} K)`);
if (cold && mild) {
  check(tooColdForOpenAir(cold.s, cold.b) && naturalKinRoom(cold.b, cold.s) === 0, `at ${Math.round(warm(cold.s, cold.b))} K at its warmest, no room for Kin without domes (${naturalKinRoom(cold.b, cold.s)})`);
  check(!tooColdForOpenAir(mild.s, mild.b) && naturalKinRoom(mild.b, mild.s) > 0, `at ${Math.round(warm(mild.s, mild.b))} K, room for ${naturalKinRoom(mild.b, mild.s)} without domes`);
  // a settlement there: none in the open; under Abandon the Surface the Warrens' share; lamps over it, room again
  const s = cold.s;
  const c = colonies(s)[0];
  const home = c.bodyId;
  c.bodyId = cold.b.id;
  check(kinBaseCapacity(s, c, computeMods(s)) === 0, 'a settlement there has no natural room for Kin');
  s.civ.charters.push('abandon_the_surface');
  const below = kinBaseCapacity(s, c, computeMods(s));
  check(below === Math.floor(Math.round(12 * habitabilityOf(s, cold.b, c)) * 0.6), `under Abandon the Surface, its warrens hold ${below} below ground`);
  s.civ.charters.pop();
  cold.b.colonyId = c.id;
  c.structures.orbital_lamps = 1;
  const lit = warm(s, cold.b);
  check(lit >= OPEN_AIR_K && kinBaseCapacity(s, c, computeMods(s)) > 0, `Orbital Lamps over it (${Math.round(lit)} K): room in the open again (${kinBaseCapacity(s, c, computeMods(s))})`);
  delete c.structures.orbital_lamps;
  cold.b.colonyId = null;
  c.bodyId = home;
}

// ---- a rush finishes at once
{
  const s = fresh(1000);
  const c = colonies(s)[0];
  c.queue = [];
  s.civ.matter = 500;
  s.civ.energy = 500;
  const id = 'habitat_dome';
  const had = c.structures[id] ?? 0;
  const err = queueBuild(s, c.id, 'structure', id) ?? rushBuild(s, c.id);
  check(!err && (c.structures[id] ?? 0) === had + 1 && !c.queue.some((q) => q.key === id), `rushed, a Habitat Dome stands at once, before the turn ends (${err ?? 'built'})`);
  check(c.flags_rushed === s.turn, 'one rush a settlement a turn, as before');
}

done('OPEN AIR');
