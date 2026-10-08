// Cold worlds far out, and rust that fades.
// - New galaxies give one red dwarf in three (flaring or not) one to three cold worlds at 0.3 to
//   8 AU, and one brown dwarf in eight one: ice worlds and ice giants, the odd gas giant or belt.
//   Never at a system of note. They come after everything else is generated, each system from a
//   draw of its own: every other world keeps its place, and the same seed gives the same worlds.
//   They are frozen (unless a star's last flare warms them), not locked, named on from the close
//   worlds, drawn beyond them, and leave the
//   close worlds' sunlight as it was. Older saves have none.
// - Rust fades by a tenth a turn where no untamed swarm is, and is gone below 1%; a nest keeps its mark.
import { newGame } from '../../../src/game/newGame';
import { bodyClimate, insolation } from '../../../src/game/physics';
import { RUST_FADE } from '../../../src/game/sim/hunger';
import { endTurn } from '../../../src/game/sim/turn';
import type { GameState } from '../../../src/game/types';
import { check, done, loadSave } from '../lib';

const game = (seed: number) => newGame({ seed, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' });
let reds = 0;
let redsWith = 0;
let browns = 0;
let brownsWith = 0;
let worlds = 0;
const kinds: Record<string, number> = {};
let bad = 0;
let order = 0;
let sun = 0;
for (const seed of [1000, 2000, 3000, 4000, 5000, 6000]) {
  const s = game(seed);
  const ids = Object.keys(s.bodies);
  const firstOuter = ids.findIndex((id) => s.bodies[id].traits.includes('outer'));
  if (firstOuter >= 0 && ids.slice(firstOuter).some((id) => !s.bodies[id].traits.includes('outer'))) order++;
  for (const sys of Object.values(s.systems)) {
    const k = sys.primary.kind;
    const outer = sys.bodies.map((id) => s.bodies[id]).filter((b) => b.traits.includes('outer'));
    if (sys.special) {
      if (outer.length) bad++;
      continue;
    }
    if (k === 'red_dwarf' || k === 'blue_dwarf') {
      reds++;
      if (outer.length) redsWith++;
      if (outer.length > 3) bad++;
    } else if (k === 'brown_dwarf') {
      browns++;
      if (outer.length) brownsWith++;
      if (outer.length > 1) bad++;
    } else if (outer.length) bad++;
    const close = sys.bodies.map((id) => s.bodies[id]).filter((b) => b.kind !== 'deep' && !b.traits.includes('outer'));
    // after the close worlds in the list, beyond them on the screen, named on from them
    if (outer.length && sys.bodies.indexOf(outer[0].id) < Math.max(...close.map((b) => sys.bodies.indexOf(b.id)))) order++;
    for (const [i, b] of outer.entries()) {
      worlds++;
      kinds[b.kind] = (kinds[b.kind] ?? 0) + 1;
      const c = bodyClimate(s, b);
      const name = `${sys.name} ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][close.length + i]}`;
      // (frozen, unless their star's last flare warms even them)
      if (b.orbitAU < 0.3 || b.orbitAU > 8 || b.traits.includes('tidally_locked') || (k !== 'blue_dwarf' && (c.day ?? c.mean) >= 195) || b.name !== name) bad++;
      if (close.some((x) => x.orbit >= b.orbit) || close.some((x) => x.orbitAU >= b.orbitAU)) order++;
    }
    // the close worlds' sunlight is as it would be without the cold ones
    for (const b of close) {
      const before = insolation(s, b);
      const keep = sys.bodies;
      sys.bodies = sys.bodies.filter((id) => !s.bodies[id].traits.includes('outer'));
      if (Math.abs(insolation(s, b) - before) > 1e-12) sun++;
      sys.bodies = keep;
    }
  }
}
check(redsWith / reds > 0.28 && redsWith / reds < 0.38, `six galaxies: ${redsWith} of ${reds} red dwarfs have cold worlds far out (one in three)`);
check(brownsWith / browns > 0.07 && brownsWith / browns < 0.18, `${brownsWith} of ${browns} brown dwarfs have one (one in eight)`);
check(worlds > 60 && (kinds.ice ?? 0) > (kinds.gas_giant ?? 0) && (kinds.ice_giant ?? 0) > (kinds.gas_giant ?? 0), `${worlds} cold worlds: ${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(', ')}`);
check(bad === 0, `all at 0.3 to 8 AU, frozen, not locked, named on from the close worlds, never at a system of note (${bad})`);
check(order === 0, `generated last, listed and drawn beyond the close worlds (${order})`);
check(sun === 0, `the close worlds' sunlight is as it was (${sun})`);
const a = game(4000);
const b = game(4000);
check(JSON.stringify(a.bodies) === JSON.stringify(b.bodies), 'the same seed gives the same cold worlds');
const old = loadSave('551fb1a-seed24757-turn71.json.gz');
check(!Object.values(old.bodies).some((x) => x.traits.includes('outer')), 'an older save has none');

// rust
{
  const s = game(1000) as GameState;
  const nest = Object.values(s.swarms)[0];
  const quiet = Object.values(s.systems).find((x) => !Object.values(s.swarms).some((w) => w.systemId === x.id))!;
  quiet.rust = 0.5;
  const nestRust = s.systems[nest.systemId!].rust;
  endTurn(s);
  const held = s.swarms[nest.id]?.systemId === nest.systemId && !s.swarms[nest.id]?.tamed;
  check(Math.abs(quiet.rust! - 0.5 * (1 - RUST_FADE)) < 1e-12, `rust where no swarm is fades a tenth a turn: 50% → ${(quiet.rust! * 100).toFixed(0)}%`);
  check(!held || s.systems[nest.systemId!].rust === nestRust, `a nest keeps its mark while its swarm sleeps there (${Math.round((nestRust ?? 0) * 100)}%)`);
  quiet.rust = 0.0105;
  endTurn(s);
  check(quiet.rust === undefined, 'and it is gone below 1%');
}
done('OUTER');
