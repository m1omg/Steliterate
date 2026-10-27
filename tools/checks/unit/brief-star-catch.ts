// Burst Catchers bank a new star that lights and goes out within a turn (26 Oct, the player: "they
// should also be able to capture events like a helium star and helium giant whose life is shorter
// than 1 turn"): a helium giant of 120,000 years ending inside a turn of a million gives two
// catchers at its own star all of it (+500); catchers farther than its reach get less; nothing from
// a star that outlived the turn, or from one whose clock we kept (its light was lived in full).
import { newGame } from '../../../src/game/newGame';
import { GIANT_LIFE, evolveUniverse } from '../../../src/game/physics';
import { handleNotes } from '../../../src/game/sim/turn';
import { burstShare, flashReach } from '../../../src/game/sim/crossing';
import { distLy } from '../../../src/game/sim/util';
import type { GameState } from '../../../src/game/types';
import { check, done } from '../lib';

const fresh = () => newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
/** A helium giant lit at year `born`, at the star `id`; the turn runs from `from` to `to`. */
function giantAt(s: GameState, id: string, born: number) {
  Object.assign(s.systems[id].primary, { kind: 'helium_giant', bornAt: born, diesAt: born + GIANT_LIFE, mass: 1 });
}
function turn(s: GameState, from: number, to: number): { gain: number; caught: string | null; brief: number | undefined } {
  const before = s.civ.energy;
  const notes = evolveUniverse(s, from, to, () => 0.5);
  handleNotes(s, notes);
  const n = notes.find((x) => x.kind === 'burnout' && x.briefJ);
  return { gain: s.civ.energy - before, caught: s.civ.log.slice(-3).find((l) => l.text.startsWith('Burst Catchers'))?.text ?? null, brief: n?.briefJ };
}

// in its own system: two catchers, all of it each (a collision star of a trillion years in a turn
// of ten: it boils nothing, as a helium star's ultraviolet or a giant would our world)
let s = fresh();
let c = s.colonies[s.civ.capitalId!];
c.structures.burst_catcher = 2;
const Y = s.years;
Object.assign(s.systems[c.systemId].primary, { kind: 'collision_star', bornAt: Y, diesAt: Y + 1e12, mass: 0.1 });
let r = turn(s, Y, Y + 1e13);
console.log(`  a collision star of 10¹² years in a turn of 10¹³: ${r.brief?.toExponential(2)} J; +${r.gain} (${r.caught})`);
check(!!r.brief && Math.abs(Math.log10(r.brief) - 43.08) < 0.05, 'its light: a thousandth of the Sun for a trillion years, about 1.2×10⁴³ J');
check(r.gain === 500 && !!r.caught, 'two Burst Catchers at its own star bank all of it: +500, logged');

// a giant at a neighbouring star, beyond its reach: less, by the square of the distance
s = fresh();
c = s.colonies[s.civ.capitalId!];
c.structures.burst_catcher = 2;
const home = s.systems[c.systemId];
const far = Object.values(s.systems)
  .filter((x) => x.id !== home.id && !x.gone)
  .map((x) => ({ x, ly: distLy(home, x) }))
  .filter((d) => d.ly > 15)
  .sort((a, b) => a.ly - b.ly)[0];
giantAt(s, far.x.id, s.years);
r = turn(s, s.years, s.years + 1e6);
const share = burstShare(far.ly, flashReach(r.brief ?? 0));
console.log(`  a giant of ${GIANT_LIFE} years in a turn of 10⁶: ${r.brief?.toExponential(2)} J, reach ${flashReach(r.brief ?? 0).toFixed(1)} ly; from ${far.ly.toFixed(1)} ly: +${r.gain} (each ${share})`);
check(!!r.brief && Math.abs(Math.log10(r.brief) - 42.16) < 0.05, 'a giant’s light: 1,000 Suns for 120,000 years, about 1.45×10⁴² J');
check(r.gain === 2 * share && r.gain > 0 && r.gain < 500, `from ${far.ly.toFixed(0)} ly, a share by the distance: +${r.gain}`);

// a star that outlived the turn: its light was there to collect, nothing to bank
s = fresh();
c = s.colonies[s.civ.capitalId!];
c.structures.burst_catcher = 2;
giantAt(s, c.systemId, s.years - GIANT_LIFE + 10);
r = turn(s, s.years, s.years + 1000);
check(r.gain === 0 && r.brief === undefined, `a star that outlived its last turn is not a flash (+${r.gain})`);

// the star whose clock we kept: lived in full, nothing more
s = fresh();
c = s.colonies[s.civ.capitalId!];
c.structures.burst_catcher = 2;
giantAt(s, c.systemId, s.years);
s.civ.flags.star_flash = s.years + GIANT_LIFE;
r = turn(s, s.years, s.years + 1e6);
check(r.gain === 0, `the star whose clock we kept gives no flash (+${r.gain})`);
done('BRIEF STAR CATCH');
