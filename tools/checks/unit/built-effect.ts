// What the structures standing at a settlement give it now, as their chips' tips say (26 Oct, the
// player: "the buildings should show what their current real effect/benefit or lack thereof is"):
// the economy run with and without them. A collector's figure is its line in the settlement's
// yield; one with nothing to gather says so, and its chip is dimmed; storage counts all of them
// with Deep Storage's quarter; a Shipyard, whose work is not a yield, is not called idle.
import { newGame } from '../../../src/game/newGame';
import { colonyTurn } from '../../../src/game/sim/economy';
import { builtEffect, builtEffectText, project } from '../../../src/game/sim/projection';
import { STRUCTURE_BY_ID } from '../../../src/game/data/structures';
import { check, done } from '../lib';

const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
const c = s.colonies[s.civ.capitalId!];
const fx = (id: string) => builtEffect(s, c, id, project(s).ctx);

// a collector: its figure is its line in the yield
const y = colonyTurn(s, c, project(s).ctx, s.civ.matter).y;
const coll = Object.keys(c.structures).find((id) => STRUCTURE_BY_ID[id]?.energy?.mode === 'light' && (c.structures[id] ?? 0) > 0);
if (coll) {
  const d = STRUCTURE_BY_ID[coll];
  const n = c.structures[coll]!;
  const line = y.lines.find((l) => l.label === `${n > 1 ? `${n}× ` : ''}${d.name}` || l.label.startsWith(`${n > 1 ? `${n}× ` : ''}${d.name}:`));
  let r = fx(coll);
  console.log(`  ${d.name} ×${n}: ${builtEffectText(r, n)} (its line: ${line?.energy?.toFixed(2)})`);
  check(!!line && Math.abs((line.energy ?? 0) - r.energy) < 0.01 && !r.idle, `${d.name}: the tip's energy is its line in the yield`);
  // with its star's light gone: nothing to gather, and why
  const p = s.systems[c.systemId].primary;
  const lum = p.lum;
  p.lum = 0;
  r = fx(coll);
  const text = builtEffectText(r, n);
  console.log(`  ${d.name}, no light: ${text}`);
  check(r.idle && /nothing made \(/.test(text), 'with no light it makes nothing, says why, and is dimmed');
  p.lum = lum;
} else check(false, 'the capital has a light collector to compare');

// storage: all of them, a quarter more with Deep Storage
s.civ.techs = s.civ.techs.filter((t) => t !== 'deep_storage');
s.civ.techs.push('deep_storage');
c.structures.superconducting_ring = 2;
const rings = builtEffectText(fx('superconducting_ring'), 2);
console.log(`  2 Rings: ${rings}`);
check(rings.startsWith('Now, all 2:') && /Energy reserve \+625/.test(rings), 'two Rings with Deep Storage: reserve +625');
delete c.structures.superconducting_ring;

// a Shipyard: not called idle
if (STRUCTURE_BY_ID.shipyard) {
  c.structures.shipyard = 1;
  const r = fx('shipyard');
  console.log(`  Shipyard: "${builtEffectText(r, 1)}"`);
  check(!r.idle, 'a Shipyard is not dimmed as idle');
}
done('BUILT EFFECT');
