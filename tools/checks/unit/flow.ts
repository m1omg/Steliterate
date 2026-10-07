// The Long Flow (stable and curvature fates, η 65). It comes once: ruins no one is digging flow
// into smooth lumps (a manned Relic Excavation keeps its ruin) and we hear of it. Then a
// settlement with no one awake loses a structure a turn, the cheapest first, Cryo Halls last and
// their sleepers with them, until it is gone; leptonic structures never flow; one awake keeper
// keeps everything. Minds that all think slower than the flow keep watchers awake at half again
// their upkeep; sleeping costs 0.3 of upkeep, not 0.1, unless The Long Watch; sleeping neighbours
// fade twice as fast. With protons decaying there is no flow: matter is gone long before.
import { autoPlay } from '../../../src/game/auto';
import { newGame } from '../../../src/game/newGame';
import { endTurn } from '../../../src/game/sim/turn';
import { createColony } from '../../../src/game/sim/fleets';
import { colonyTurn } from '../../../src/game/sim/economy';
import { computeMods } from '../../../src/game/sim/mods';
import { turnStep } from '../../../src/game/sim/flare';
import { livedShare } from '../../../src/game/sim/flare';
import { updateSurvivors } from '../../../src/game/sim/survivors';
import { FLOW_ETA, flowing, keeping } from '../../../src/game/sim/flow';
import { logTurnLength } from '../../../src/game/eras';
import type { Body, Colony, GameState } from '../../../src/game/types';
import { check, done } from '../lib';

const clone = (s: GameState) => JSON.parse(JSON.stringify(s)) as GameState;
/** This turn's tempo and mods, as the economy sees them. */
const ctxOf = (s: GameState) => {
  const step = turnStep(s, s.civ.pace);
  const mods = computeMods(s);
  return { years: s.years, L: step.turnLength, logL: logTurnLength(step), paceFactor: livedShare(s, s.civ.pace, step), mods };
};
/** Mind upkeep at a settlement, from its yield lines. */
const mindUpkeep = (s: GameState, c: Colony) =>
  -colonyTurn(s, c, ctxOf(s), 1e9)
    .y.lines.filter((l) => /^\d+ (Echo|Echoes|Coldmind|Coldminds|Kin|Lattice)\b/.test(l.label) && !/Cold Sleep/.test(l.label))
    .reduce((a, l) => a + (l.energy ?? 0), 0);

// ---------------------------------------------------------------- a stable game, to just before the flow
const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' });
for (let g = 0; g < 900 && !s.outcome && s.eta < FLOW_ETA - 2.5; g++) {
  autoPlay(s, 'competent');
  endTurn(s);
}
check(!s.outcome && s.eta < FLOW_ETA && s.civ.flags.flowed === undefined, `stable, η ${s.eta.toFixed(1)}: the flow has not come`);
s.pending.length = 0;
// with the Tide (the autoplayer may have slowed down, and a slow turn here outlasts the flow)
s.civ.pace = 0;
if (!s.civ.techs.includes('hawking_patience')) s.civ.techs.push('horizon_cognition', 'hawking_patience');
// three places of our own, on worlds no one lives on: one kept by Kin, one of slow Echoes, one with only sleepers
const free = Object.values(s.bodies).filter((b) => !b.colonyId && !b.dissolved && b.kind !== 'deep' && !b.relic && s.systems[b.systemId] && !s.systems[b.systemId].gone);
const [bKept, bSlow, bEmpty, bLepton, bRuin, bDug] = free.slice(0, 6);
const kept = createColony(s, bKept, { kin: 2 });
kept.structures = { solar_array: 1, mine: 1, habitat_dome: 1 };
const slow = createColony(s, bSlow, { echoes: 3 });
slow.structures = { substrate_core: 1 };
const empty = createColony(s, bEmpty, {});
empty.cryo = 4;
empty.structures = { cryo_hall: 1, relic_dig: 1, solar_array: 2, shipyard: 1 };
const lepton = createColony(s, bLepton, {});
lepton.structures = { lepton_substrate: 1 };
// ruins: one found and never dug, one hidden, one found and dug by Kin
bRuin.relic = { kind: 'archive', state: 'found' };
bEmpty.relic = { kind: 'tomb', state: 'hidden' };
bDug.relic = { kind: 'engine', state: 'found' };
const dig = createColony(s, bDug, { kin: 2 });
dig.structures = { relic_dig: 1, habitat_dome: 1 };
s.civ.energy = 5000;
s.civ.matter = 5000;
{
  const { logL, mods } = ctxOf(s);
  check(keeping(slow, logL, mods) === 'kept', `before it, Echoes thinking once in 10^${logL.toFixed(1)} years, faster than the flow, would keep a place`);
}

// ---------------------------------------------------------------- it comes
const turns = (n: number) => {
  for (let i = 0; i < n && !s.outcome; i++) {
    s.pending = s.pending.filter((p) => p.defId === 'long_flow');
    endTurn(s);
  }
};
for (let i = 0; i < 12 && s.civ.flags.flowed === undefined && !s.outcome; i++) turns(1);
check(flowing(s) && s.eta >= FLOW_ETA, `the Long Flow comes at η ${s.eta.toFixed(1)} (turn ${s.civ.flags.flowed})`);
const ev = s.pending.find((p) => p.defId === 'long_flow');
check(!!ev && Number(ev.data.ruins) >= 1, `we hear of it, and of the ruins we found that flowed (${ev?.data.ruins})`);
check(bRuin.relic?.flowed === true && bEmpty.relic?.flowed === true && !bDug.relic?.flowed, `ruins no one was digging flowed, found or hidden; the dug one is kept (${bRuin.relic?.flowed}, ${bEmpty.relic?.flowed}, ${bDug.relic?.flowed})`);
{
  const { logL, mods } = ctxOf(s);
  check(keeping(kept, logL, mods) === 'kept' && keeping(slow, logL, mods) === 'watched' && keeping(s.colonies[empty.id], logL, mods) === 'unmanned', `now Kin keep a place, Echoes thinking once in 10^${logL.toFixed(1)} years keep watch, sleepers keep nothing`);
}
const slowBefore = (() => {
  const b = clone(s);
  delete b.civ.flags.flowed;
  return mindUpkeep(b, b.colonies[slow.id]);
})();
check(slow.structures.substrate_core === 1 && kept.structures.solar_array === 1, 'kept and watched places lose nothing');
check(Math.abs(mindUpkeep(s, slow) / slowBefore - 1.5) < 0.02, `slow minds keep watchers awake: upkeep ×${(mindUpkeep(s, slow) / slowBefore).toFixed(2)}`);
const first = { ...empty.structures };
check(first.solar_array === 1 && first.relic_dig === 1 && first.shipyard === 1 && first.cryo_hall === 1, `the place with only sleepers lost its cheapest first, one of two Solar Arrays (${JSON.stringify(first)})`);
turns(3);
check(!empty.structures.solar_array && !empty.structures.shipyard && empty.structures.cryo_hall === 1 && empty.cryo === 4, `a structure a turn, the Cryo Hall last (${JSON.stringify(empty.structures)}, ${empty.cryo} asleep)`);
turns(1);
check(!s.colonies[empty.id], 'with the Cryo Hall its sleepers are lost, and the place is gone');
check(s.colonies[lepton.id]?.structures.lepton_substrate === 1, 'leptonic substrate does not flow');

// ---------------------------------------------------------------- sleeping, ours and theirs
{
  const a = clone(s);
  const b = clone(s);
  delete b.civ.flags.flowed;
  for (const g of [a, b]) {
    g.civ.dormant = true;
    g.civ.charters = g.civ.charters.filter((x) => x !== 'the_long_watch');
  }
  const ca = a.colonies[s.civ.capitalId!];
  const cb = b.colonies[s.civ.capitalId!];
  const ratio = mindUpkeep(a, ca) / mindUpkeep(b, cb);
  check(Math.abs(ratio - 3) < 0.01, `asleep after the flow, upkeep is 0.3 not 0.1 (×${ratio.toFixed(2)})`);
  for (const g of [a, b]) g.civ.charters.push('the_long_watch');
  check(Math.abs(mindUpkeep(a, ca) / mindUpkeep(b, cb) - 1) < 0.01, 'with The Long Watch, as before');
}
{
  const a = clone(s);
  const b = clone(s);
  delete b.civ.flags.flowed;
  const sv = Object.values(s.survivors).find((x) => x.alive) ?? Object.values(s.survivors)[0];
  for (const g of [a, b]) {
    g.survivors[sv.id].alive = true;
    g.survivors[sv.id].way = 'dormant';
    g.survivors[sv.id].health = 0.8;
  }
  for (const g of [a, b]) {
    const { logL, mods, L } = ctxOf(g);
    updateSurvivors(g, logL, mods, L);
  }
  const da = 0.8 - a.survivors[sv.id].health;
  const db = 0.8 - b.survivors[sv.id].health;
  check(da > db + 1e-4, `a sleeping civilization fades faster after the flow (health −${da.toFixed(4)} against −${db.toFixed(4)})`);
}

// ---------------------------------------------------------------- no flow where protons decay
{
  const d = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'decays' });
  for (let g = 0; g < 900 && !d.outcome && d.eta < FLOW_ETA + 2; g++) {
    autoPlay(d, 'competent');
    endTurn(d);
  }
  check(d.civ.flags.flowed === undefined, `protons decay: no flow (η ${d.eta.toFixed(1)}, ${d.outcome ? d.outcome.ending : 'playing'})`);
}
void ({} as Body);
done('FLOW');
