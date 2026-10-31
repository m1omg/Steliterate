// The end of matter, as it is (the new version, part 3-0): the Great Decay with the protocols.
// - Only settlements on decay-proof substrate go on, keeping only what is decay-proof; a Horizon
//   Vault's charge is in its hole's spin, and stays with a settlement that goes on at its hole.
// - The protocols carry CARRIED of the Echoes, Coldminds and Chorus of a settlement still made of
//   matter onto one that goes on, as far as it has room for them: taken off where they were, and
//   counted once (before, they were counted lost as well, and a Chorus with no room for it twice).
// - Every person lost is counted once: what the report says is what went.
// - What held the reserve was matter too: what no longer fits goes at once, and the report says so.
// - The forecast promises nothing to those merely living around black holes; the protocols say
//   what they do; the Bastion Shell is built only at a black hole.
// - The Migration goes to the nearest black hole with spin left, not to one drained of it.
// - The matter in our stores goes with the rest, and the report says how much (31 Oct, the
//   player asked; before, it was emptied without a word).
import { newGame } from '../../../src/game/newGame';
import { STRUCTURE_BY_ID } from '../../../src/game/data/structures';
import { TECH_BY_ID } from '../../../src/game/data/techs';
import { CARRIED, runCrossing } from '../../../src/game/sim/crossing';
import { createColony, deepFor } from '../../../src/game/sim/fleets';
import { updateForecasts } from '../../../src/game/sim/forecast';
import { computeMods } from '../../../src/game/sim/mods';
import { reserveCapacity } from '../../../src/game/sim/storage';
import { colonies, popsOf, totalPops } from '../../../src/game/sim/util';
import type { Colony, GameState, ThreadId } from '../../../src/game/types';
import { THREADS } from '../../../src/game/types';
import { check, done } from '../lib';

const pops = (p: Partial<Record<ThreadId, number>>) => Object.fromEntries(THREADS.map((t) => [t, p[t] ?? 0])) as Record<ThreadId, number>;

const s: GameState = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'decays', civsAsleep: true });
s.era = 'degenerate';
s.civ.techs.push('great_decay_protocols', 'leptonic_computation', 'horizon_storage');
// our only settlements: a vault on leptonic substrate in a black hole's Deep, and a world still made of matter
for (const c of colonies(s)) {
  s.bodies[c.bodyId].colonyId = null;
  delete s.colonies[c.id];
}
const hole = Object.values(s.systems).find((x) => x.primary.kind === 'black_hole' && !x.gone)!;
const vault: Colony = createColony(s, deepFor(s, hole)!, {});
vault.pops = pops({ kin: 4, echoes: 2 });
vault.structures = { lepton_substrate: 2, horizon_vault: 1, fusion_plant: 1 };
const world = Object.values(s.bodies).find((b) => b.kind !== 'deep' && !b.colonyId && b.systemId !== hole.id)!;
const town: Colony = createColony(s, world, {});
town.pops = pops({ kin: 5, echoes: 10, coldminds: 4, chorus: 3 });
town.structures = { habitat_dome: 2, substrate_core: 3, confluence_node: 1 };
s.civ.capitalId = vault.id;
s.civ.energy = 5000;
s.civ.matter = 237.6;
const mods = computeMods(s);
const before = totalPops(s);
const r = runCrossing(s, [s.player], { [s.player]: mods })[s.player];
const text = r.lines.map((l) => l.text).join('\n');

const left = colonies(s);
check(left.length === 1 && left[0].id === vault.id, `only the settlement on leptonic substrate goes on (${left.map((c) => c.name).join(', ')})`);
check(!!vault.structures.lepton_substrate && !vault.structures.fusion_plant, 'keeping only what is decay-proof');
check(vault.structures.horizon_vault === 1, 'and its Horizon Vault, whose charge is in its hole’s spin');
const carried = { echoes: Math.min(Math.floor(10 * CARRIED), 8 - 2), coldminds: Math.min(Math.floor(4 * CARRIED), 8), chorus: 0 };
check(vault.pops.echoes === 2 + carried.echoes && vault.pops.coldminds === carried.coldminds && vault.pops.chorus === 0, `the protocols carried ${carried.echoes} Echoes and ${carried.coldminds} Coldminds, as far as there was room; no Chorus (no room for one) (${JSON.stringify(vault.pops)})`);
const lost = before - totalPops(s);
const said = Number(text.match(/(\d+) of our people dissolved/)?.[1] ?? NaN);
check(said === lost && lost === 4 + (5 + 10 - carried.echoes + 4 - carried.coldminds + 3), `every loss counted once: the report says ${said}, and ${before} − ${totalPops(s)} = ${lost}`);
check(new RegExp(`${carried.echoes + carried.coldminds} minds were carried onto leptonic substrate`).test(text), 'and says how many were carried');
check(s.civ.matter === 0 && /The 237 matter in our stores dissolved with the rest: none of it could be kept/.test(text), `the matter in our stores goes with it, and the report says how much (${text.split('\n').find((l) => /in our stores/.test(l)) ?? 'no line'})`);
const keep = reserveCapacity(s, computeMods(s));
check(s.civ.energy <= keep + 1e-9 && /What held our reserve was matter too: it can hold \d+ energy now, and \d+ had nowhere to go\./.test(text), `the reserve: what no longer fits is gone at once, and said (${Math.round(s.civ.energy)} of ${Math.round(keep)})`);
check(popsOf(vault) > 0, 'and the vault lives on');

// the texts and the placement
const f = newGame({ seed: 1000, protonFate: 'unknown', civsAsleep: true });
f.era = 'degenerate';
updateForecasts(f);
const forecasts = f.civ.forecasts.map((x) => x.text).join(' ');
check(!/living around black holes/.test(forecasts) && /only minds moved onto leptonic substrates will continue/.test(forecasts), 'the forecast promises nothing to those merely living around black holes');
check(/carried onto one of ours already on leptonic substrate, as far as it has room/.test(TECH_BY_ID.great_decay_protocols.desc), 'the protocols say what they do');
check(!!STRUCTURE_BY_ID.bastion.primaries?.includes('black_hole') && !STRUCTURE_BY_ID.bastion.primaries.includes('white_dwarf'), 'the Bastion Shell is built only at a black hole');
// the Migration: to the nearest hole with spin left to give, not one drained of it
{
  const g = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'decays', civsAsleep: true });
  g.era = 'degenerate';
  g.civ.techs.push('leptonic_computation', 'penrose_process');
  for (const c of colonies(g)) {
    g.bodies[c.bodyId].colonyId = null;
    delete g.colonies[c.id];
  }
  const holes = Object.values(g.systems).filter((x) => (x.primary.kind === 'black_hole' || x.primary.kind === 'smbh') && !x.gone);
  const b = Object.values(g.bodies).find((x) => x.kind !== 'deep' && !x.colonyId && !holes.some((h) => h.id === x.systemId))!;
  const here = g.systems[b.systemId];
  const far = (h: (typeof holes)[number]) => Math.hypot(h.phys.x - here.phys.x, h.phys.y - here.phys.y, h.phys.z - here.phys.z);
  const near = holes.slice().sort((x, y) => far(x) - far(y));
  // the nearest is drained; the next has spin left
  near[0].primary.spin = 0;
  near[1].primary.spin = Math.max(near[1].primary.spin, 300);
  const town = createColony(g, b, {});
  town.pops = pops({ echoes: 4 });
  town.structures = { lepton_substrate: 1 };
  g.civ.capitalId = town.id;
  g.civ.energy = 300;
  runCrossing(g, [g.player], { [g.player]: computeMods(g) });
  const moved = colonies(g)[0];
  check(!!moved && moved.systemId === near[1].id, `a vault drifts to the nearest black hole with spin left (${g.systems[moved?.systemId ?? '']?.name}), past one drained of it (${near[0].name})`);
  check(!!moved && (moved.structures.penrose_harvester ?? 0) > 0, 'and its harvester has spin to draw on there');
}
done('END OF MATTER');
