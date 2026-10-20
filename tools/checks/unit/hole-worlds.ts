// More worlds at black holes (20 Oct; the player, 16 Oct: "add more black hole planets"; 19 Oct:
// "not all black holes should have planets, just a lot of them").
// - In a new galaxy two holes in three get one to three more worlds, two in three of them close in
//   (0.05 to 1 AU, as the pulsar PSR B1257+12's), the rest at 1 to 40 AU, a giant in four; around
//   a hole heavier than 10 Suns the orbits widen by √(M/10). With the one world in three holes had,
//   about three holes in four have worlds. Never at the Heart, the Wanderer or any system of note.
// - They come after everything else, each hole from a draw of its own: listed last, the same seed
//   gives the same worlds, and every other world keeps its place and its sunlight (unit/young-
//   dwarfs fingerprints the rest of the galaxy). Named on from the world the hole had, no two
//   within a factor of 1.4 of each other, and all of a hole's worlds drawn out by distance.
// - Older saves have none.
import { newGame } from '../../../src/game/newGame';
import { insolation } from '../../../src/game/physics';
import type { GameState } from '../../../src/game/types';
import { check, done, loadSave } from '../lib';

const game = (seed: number) => newGame({ seed, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable', civsAsleep: true }) as GameState;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
let holes = 0;
let given = 0;
let withWorlds = 0;
let added = 0;
let close = 0;
let giants = 0;
let bad = 0;
let order = 0;
let crowd = 0;
let drawn = 0;
let sun = 0;
for (const seed of [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000]) {
  const s = game(seed);
  const ids = Object.keys(s.bodies);
  const first = ids.findIndex((id) => s.bodies[id].traits.includes('hole_world'));
  if (first >= 0 && ids.slice(first).some((id) => !s.bodies[id].traits.includes('hole_world'))) order++;
  for (const sys of Object.values(s.systems)) {
    const all = sys.bodies.map((id) => s.bodies[id]).filter((b) => b.kind !== 'deep');
    const neu = all.filter((b) => b.traits.includes('hole_world'));
    const old = all.filter((b) => !b.traits.includes('hole_world'));
    if (sys.primary.kind !== 'black_hole' || sys.special) {
      if (neu.length) bad++;
      continue;
    }
    holes++;
    if (neu.length) given++;
    if (all.length) withWorlds++;
    if (neu.length > 3) bad++;
    const widen = Math.max(1, Math.sqrt(sys.primary.mass / 10));
    for (const [i, b] of neu.entries()) {
      added++;
      if (b.orbitAU / widen < 1) close++;
      if (b.kind === 'gas_giant' || b.kind === 'ice_giant') giants++;
      // at 0.05 AU or more (by the hole's mass), named on from the world it had
      if (b.orbitAU / widen < 0.05 - 1e-9 || b.name !== `${sys.name} ${ROMAN[old.length + i]}`) bad++;
    }
    // no two crowded together; drawn out by distance
    const byAU = [...all].sort((a, b) => a.orbitAU - b.orbitAU);
    for (let i = 1; i < byAU.length; i++) {
      if (byAU[i].orbitAU / byAU[i - 1].orbitAU < 1.4 - 1e-9) crowd++;
      if (byAU[i].orbit <= byAU[i - 1].orbit) drawn++;
    }
    // the world it had keeps its sunlight
    for (const b of old) {
      const before = insolation(s, b);
      const keep = sys.bodies;
      sys.bodies = sys.bodies.filter((id) => !s.bodies[id].traits.includes('hole_world'));
      if (Math.abs(insolation(s, b) - before) > 1e-12) sun++;
      sys.bodies = keep;
    }
  }
}
check(given / holes > 0.55 && given / holes < 0.75, `ten galaxies: ${given} of ${holes} black holes were given worlds (two in three)`);
check(withWorlds / holes > 0.68 && withWorlds / holes < 0.85, `${withWorlds} of ${holes} have worlds (about three in four)`);
check(added / given > 1.6 && added / given < 2.4 && close / added > 0.55 && close / added < 0.78, `${added} worlds, ${(added / given).toFixed(1)} a hole; ${close} close in (two in three)`);
check(giants / added > 0.15 && giants / added < 0.35, `${giants} giants (one in four)`);
check(bad === 0, `only at black holes not of note, one to three each, at 0.05 AU and more, named on from the world each had (${bad})`);
check(order === 0, `generated last of all (${order})`);
check(crowd === 0, `no two within a factor of 1.4 (${crowd})`);
check(drawn === 0, `drawn out by distance, the world each had among them (${drawn})`);
check(sun === 0, `the world each had keeps its sunlight (${sun})`);
const heart = game(1000);
check(!Object.values(heart.systems).some((x) => (x.primary.kind === 'smbh' || x.special) && x.bodies.some((id) => heart.bodies[id].traits.includes('hole_world'))), 'none at the Heart or the Wanderer');
check(JSON.stringify(game(4000).bodies) === JSON.stringify(game(4000).bodies), 'the same seed gives the same worlds');
const older = loadSave('b1fc6a7-seed1000-turn61-next.json.gz');
check(!Object.values(older.bodies).some((x) => x.traits.includes('hole_world')), 'an older save has none');

done('HOLE WORLDS');
