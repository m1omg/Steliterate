// What the structures standing at a settlement give it now, as their chips' tips say (26 Oct, the
// player: "the buildings should show what their current real effect/benefit or lack thereof is"):
// the economy run with and without them. A Protocol Registry run by the Lattice turns a tenth of
// the industry it takes into accord; with no Lattice it makes nothing and says why, and its chip
// is dimmed; a collector's figure is its line in the settlement's yield; storage counts all of
// them with Deep Storage's quarter; a Shipyard, whose work is not a yield, says nothing of it.
import { newGame } from '../../../src/game/newGame';
import { colonyTurn } from '../../../src/game/sim/economy';
import { builtEffect, builtEffectText, project } from '../../../src/game/sim/projection';
import { STRUCTURE_BY_ID } from '../../../src/game/data/structures';
import { check, done } from '../lib';

const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
const c = s.colonies[s.civ.capitalId!];
const fx = (id: string) => builtEffect(s, c, id, project(s).ctx);

// the Registry, run by the Lattice: industry in, a tenth of it out as accord
c.structures.protocol_registry = 1;
c.pops.lattice = Math.max(2, c.pops.lattice);
let r = fx('protocol_registry');
let text = builtEffectText(r, 1);
console.log(`  Registry, Lattice here: ${text}`);
check(r.industry < -0.5 && Math.abs(r.accord / r.industry + 0.1) < 1e-9 && r.energy < 0 && !r.idle, `it takes industry and gives a tenth as accord (${r.industry.toFixed(2)} industry, +${r.accord.toFixed(2)} accord)`);
check(/^Now: −\d.*industry, \+.*accord/.test(text) || /^Now: .*industry.*accord/.test(text), 'its tip says so');

// no Lattice: nothing made, and why; its chip dimmed
c.pops.lattice = 0;
r = fx('protocol_registry');
text = builtEffectText(r, 1);
console.log(`  Registry, no Lattice: ${text}`);
check(r.idle && r.why === 'no Lattice here to run it' && r.industry === 0 && r.accord === 0, 'with no Lattice it makes nothing, and the economy’s reason is given');
check(/nothing made \(no Lattice here to run it\)/.test(text) && /energy/.test(text), 'its tip: its upkeep, and nothing made, and why');
delete c.structures.protocol_registry;

// a collector: its figure is its line in the yield
const ctx = project(s).ctx;
const y = colonyTurn(s, c, ctx, s.civ.matter).y;
const coll = Object.keys(c.structures).find((id) => STRUCTURE_BY_ID[id]?.energy && (c.structures[id] ?? 0) > 0);
if (coll) {
  const d = STRUCTURE_BY_ID[coll];
  const n = c.structures[coll]!;
  const line = y.lines.find((l) => l.label === `${n > 1 ? `${n}× ` : ''}${d.name}` || l.label.startsWith(`${n > 1 ? `${n}× ` : ''}${d.name}:`));
  r = fx(coll);
  console.log(`  ${d.name} ×${n}: ${builtEffectText(r, n)} (its line: ${line?.energy?.toFixed(2)})`);
  check(!!line && Math.abs((line.energy ?? 0) - r.energy) < 0.01, `${d.name}: the tip's energy is its line in the yield`);
} else check(false, 'the capital has a collector to compare');

// storage: all of them, a quarter more with Deep Storage
s.civ.techs = s.civ.techs.filter((t) => t !== 'deep_storage');
s.civ.techs.push('deep_storage');
c.structures.superconducting_ring = 2;
r = fx('superconducting_ring');
text = builtEffectText(r, 2);
console.log(`  2 Rings: ${text}`);
check(text.startsWith('Now, all 2:') && /Energy reserve \+625/.test(text), 'two Rings with Deep Storage: reserve +625');
delete c.structures.superconducting_ring;

// a Shipyard: its work is ships, not a yield; it is not called idle
if (STRUCTURE_BY_ID.shipyard) {
  c.structures.shipyard = 1;
  r = fx('shipyard');
  console.log(`  Shipyard: "${builtEffectText(r, 1)}"`);
  check(!r.idle, 'a Shipyard is not dimmed as idle');
}
done('BUILT EFFECT');
