// A black hole evaporates: its worlds drift loose, our settlement there stays with its structures,
// its Burst Catchers catch the final burst, and nothing more is drawn from the hole.
import { newGame } from '../../../src/game/newGame';
import { autoPlay } from '../../../src/game/auto';
import { endTurn } from '../../../src/game/sim/turn';
import { createColony } from '../../../src/game/sim/fleets';
import { colonyTurn, reserveCapacity } from '../../../src/game/sim/economy';
import { computeMods } from '../../../src/game/sim/mods';
import { turnStep } from '../../../src/game/sim/flare';
import { deserialize } from '../../../src/game/save';
import { check, done } from '../lib';

const s = newGame({ seed: 2360862, length: 'standard', survivors: 3, difficulty: 'standard' });
for (let g = 0; g < 900 && !s.outcome && !(s.era === 'blackhole' && s.eraTurn >= 3); g++) {
  autoPlay(s, 'competent');
  endTurn(s);
}
console.log(`  turn ${s.turn}, ${s.era}, η ${s.eta.toFixed(1)}, protons ${s.protonsDecay ? 'decay' : 'stable'}`);
const holes = Object.values(s.systems).filter((x) => x.primary.kind === 'black_hole' && !x.gone);
const settledAt = (id: string) => Object.values(s.colonies).some((c) => c.systemId === id);
const withWorld = holes.find((x) => x.bodies.some((id) => { const b = s.bodies[id]; return b && !b.dissolved && b.kind !== 'deep' && !b.colonyId; }) && !settledAt(x.id))!;
const empty = holes.find((x) => x !== withWorld && !settledAt(x.id))!;
check(!!withWorld && !!empty, `two black holes to watch: ${withWorld?.name} (with worlds) and ${empty?.name}`);
const world = s.bodies[withWorld.bodies.find((id) => { const b = s.bodies[id]; return b && !b.dissolved && b.kind !== 'deep'; })!];
const c = createColony(s, world, { lattice: 4 });
c.structures = { superconducting_ring: 3, burst_catcher: 2, horizon_vault: 1, penrose_harvester: 1, hawking_collector: 1 };
for (const id of empty.bodies) {
  const b = s.bodies[id];
  if (b && b.kind !== 'deep') b.dissolved = true;
}
const mods = computeMods(s);
const cap0 = reserveCapacity(s, mods);
const ctx = () => {
  const st = turnStep(s);
  return { mods: computeMods(s), years: s.years, L: st.turnLength, logL: Math.log10(st.turnLength), paceFactor: 1 };
};
const before = colonyTurn(s, c, ctx(), 1e9).y.lines.map((l) => `${l.label} ${(l.energy ?? 0).toFixed(1)}`);
console.log(`  before: ${before.join(', ')}`);
withWorld.primary.evaporateAt = s.years * (1 + 1e-12);
empty.primary.evaporateAt = s.years * (1 + 1e-12);
s.pending.length = 0;
s.civ.energy = 10;
const structs = JSON.stringify(c.structures);
endTurn(s);
const cc = s.colonies[c.id];
check(!!cc, 'our settlement is still there');
check(!!cc && JSON.stringify(cc.structures) === structs, `with every structure (${Object.keys(c.structures).join(', ')})`);
check(withWorld.primary.kind === 'void' && !withWorld.gone, `its system stays, its hole gone (${withWorld.primary.kind}, gone ${withWorld.gone})`);
check(world.rogue === true && withWorld.bodies.every((id) => { const b = s.bodies[id]; return !b || b.dissolved || b.kind === 'deep' || b.rogue; }), 'its worlds drift loose (rogue)');
check(withWorld.primary.spin === 0 && !withWorld.primary.rekindle, 'no spin and no glow are left there');
check(!!empty.gone, `a hole with nothing left around it is simply gone (${empty.name})`);
check(s.log.some((l) => /Burst Catchers at .* caught/.test(l.text)), 'its Burst Catchers caught the final burst');
check(s.pending.some((e) => e.defId === 'final_burst'), 'the Last Burst event is waiting');
const cap1 = reserveCapacity(s, computeMods(s));
check(Math.abs(cap0 - cap1 - 400 * mods.reserveMult) < 1e-9, `storage: ${cap0} -> ${cap1} (the Horizon Vault's spin is gone; the rings hold)`);
const after = colonyTurn(s, cc, ctx(), 1e9).y.lines;
const pen = after.find((l) => /Penrose/.test(l.label));
const haw = after.find((l) => /Hawking/.test(l.label));
console.log(`  after: ${after.map((l) => `${l.label} ${(l.energy ?? 0).toFixed(1)}`).join(', ')}`);
check((!pen || (pen.energy ?? 0) <= 0) && (!haw || (haw.energy ?? 0) <= 0), 'the Penrose Harvester and Hawking Collector have nothing left to draw on');
const t = deserialize(JSON.stringify(s))!;
check(!!t.colonies[c.id] && t.systems[withWorld.id].primary.kind === 'void' && t.bodies[world.id].rogue === true, 'it all saves and loads');
// play on to the end: nothing breaks
for (let g = 0; g < 900 && !s.outcome; g++) {
  autoPlay(s, 'competent');
  endTurn(s);
}
check(!!s.outcome, `the game plays on to its end: ${s.outcome?.kind} "${s.outcome?.ending}" at turn ${s.turn}`);
done('EVAP');
