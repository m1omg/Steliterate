// Energy in the cold: after the Last Light every world's core heat fades (×0.8 a turn), so
// Geothermal Taps wind down; a light collector cannot be built where its star gives no light, and
// one already there says it has nothing to gather; under a dark sky Coldminds and Cold Vaults keep
// for half. In the Dusk core heat is as it was.
import { newGame } from '../../../src/game/newGame';
import { autoPlay } from '../../../src/game/auto';
import { CORE_FADE, endTurn } from '../../../src/game/sim/turn';
import { structureCheck } from '../../../src/game/sim/actions';
import { colonyTurn } from '../../../src/game/sim/economy';
import { createColony } from '../../../src/game/sim/fleets';
import { computeMods } from '../../../src/game/sim/mods';
import { turnStep } from '../../../src/game/sim/flare';
import { STRUCTURE_BY_ID } from '../../../src/game/data/structures';
import type { GameState, StarSystem } from '../../../src/game/types';
import { check, done, near } from '../lib';

// ---------------------------------------------------------------- core heat: the Dusk as it was, then fading
const d = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
const other = Object.values(d.bodies).find((b) => b.coreHeat > 0.3 && !b.colonyId && b.kind !== 'deep')!;
const h0 = other.coreHeat;
d.pending.length = 0;
endTurn(d);
check(other.coreHeat === h0, `in the Dusk an unsettled world keeps its core heat (${h0.toFixed(2)})`);
const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
for (let g = 0; g < 400 && !s.outcome && s.era !== 'degenerate'; g++) {
  autoPlay(s, 'competent');
  endTurn(s);
}
check(s.era === 'degenerate', `the Degenerate Age reached (turn ${s.turn})`);
const world = Object.values(s.bodies).find((b) => b.coreHeat > 0.3 && b.kind !== 'deep' && !b.dissolved)!;
const before = world.coreHeat;
s.pending.length = 0;
endTurn(s);
near('after the Last Light: core heat ×0.8 a turn', world.coreHeat, before * CORE_FADE);
for (let i = 0; i < 25; i++) {
  s.pending.length = 0;
  endTurn(s);
}
check(world.coreHeat === 0, `gone some 25 turns later (${world.coreHeat})`);

// ---------------------------------------------------------------- light collectors where there is no light
const ctxFor = (g: GameState) => {
  const st = turnStep(g);
  return { mods: computeMods(g), years: g.years, L: st.turnLength, logL: Math.log10(st.turnLength), paceFactor: 1 };
};
const find = (pred: (x: StarSystem) => boolean) => Object.values(s.systems).find((x) => !x.gone && pred(x) && !Object.values(s.colonies).some((c) => c.systemId === x.id) && x.bodies.some((id) => s.bodies[id] && s.bodies[id].kind !== 'deep' && !s.bodies[id].dissolved));
const cold = find((x) => (x.primary.kind === 'white_dwarf' && !x.primary.halo) || x.primary.kind === 'black_dwarf');
const ember = find((x) => x.primary.kind === 'white_dwarf' && !!x.primary.halo && x.primary.haloLeft === undefined);
check(!!cold && !!ember, `a cold dwarf (${cold?.name}) and an ember (${ember?.name}) to settle`);
if (cold && ember) {
  for (const x of [cold, ember]) x.primary.rekindle = 0;
  const worldOf = (x: StarSystem) => s.bodies[x.bodies.find((id) => s.bodies[id] && s.bodies[id].kind !== 'deep' && !s.bodies[id].dissolved)!];
  const cc = createColony(s, worldOf(cold), { coldminds: 6 });
  const ce = createColony(s, worldOf(ember), { coldminds: 6 });
  const why = structureCheck(s, cc, STRUCTURE_BY_ID.orbital_collector);
  check(why === 'Nothing to gather: its star gives no light.', `an orbital collector at the cold dwarf is refused (${why})`);
  check(structureCheck(s, ce, STRUCTURE_BY_ID.orbital_collector) !== 'Nothing to gather: its star gives no light.', 'at the ember it is not');
  cc.structures.orbital_collector = 1;
  const lines = colonyTurn(s, cc, ctxFor(s), 1e9).y.lines;
  check(lines.some((l) => l.label === 'Orbital Collectors: nothing to gather' && (l.energy ?? 0) === 0), 'one already there says it has nothing to gather');
  // Coldminds under a dark sky keep for half
  const cmUp = (c: typeof cc) => {
    const l = colonyTurn(s, c, ctxFor(s), 1e9).y.lines.find((x) => /Coldminds/.test(x.label))!;
    return { up: -(l.energy ?? 0), label: l.label };
  };
  const a = cmUp(cc),
    b = cmUp(ce);
  near(`Coldminds under the dark sky of a cold dwarf ("${a.label}") cost half what they do at an ember`, a.up, b.up / 2);
  cc.structures.cold_vault = 1;
  ce.structures.cold_vault = 1;
  const vault = (c: typeof cc) => -(colonyTurn(s, c, ctxFor(s), 1e9).y.lines.find((x) => /Cold Vault/.test(x.label))!.energy ?? 0);
  near('and so does a Cold Vault', vault(cc), vault(ce) / 2);
}
done('COLD ENERGY');
