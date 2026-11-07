// Burning memories for warmth (7 Nov; sim/szilard.ts): a Szilard Engine lets our records go to noise
// for kT ln 2 a bit, scaled beyond reason (said in its own words):
// - in the Dark Era only: energy by how much is left to burn (Continuity), Continuity a turn for it;
// - the first one lit raises the Threads' argument, "What Shall We Forget?": the copies held twice
//   (0.6 of the energy for half the cost), the oldest memories (as rated; the Kin object), or what
//   each of us remembers alone (1.6 times both; the Echoes object);
// - taken down, it stops; its tip gives its cost and its yield as they are now;
// - its research a deliberate choice: never worked out from surplus insight, and the autoplayer
//   takes it up only when it would light one.
import { autoPlay } from '../../../src/game/auto';
import { STRUCTURE_BY_ID } from '../../../src/game/data/structures';
import { dismantle } from '../../../src/game/sim/actions';
import { DARK_DECAY, continuityLoss } from '../../../src/game/sim/continuity';
import { resolveEvent } from '../../../src/game/sim/events';
import { project, structureEffect } from '../../../src/game/sim/projection';
import { availableTechs, discoverFromSurplus } from '../../../src/game/sim/research';
import { finishQueued } from '../../../src/game/sim/queue';
import { ENGINE_CONTINUITY, FORGET, szilardYield } from '../../../src/game/sim/szilard';
import { colonies } from '../../../src/game/sim/util';
import { newGame } from '../../../src/game/newGame';
import type { QueueItem } from '../../../src/game/types';
import { darkGame } from '../darkgame';
import { check, done, near } from '../lib';

const s = darkGame();
const c = colonies(s)[0];
s.civ.techs.push('szilard_engines');
s.civ.energy = 4000;
const base = project(s).energyIn;
const loss0 = continuityLoss(s, false);
near('without an engine, the dark’s own loss', loss0, DARK_DECAY);
const item: QueueItem = { uid: 'q1', kind: 'structure', key: 'szilard_engine' } as QueueItem;
finishQueued(s, c, item);
check(s.civ.pending.some((p) => p.defId === 'what_to_forget'), 'the first engine lit: the Threads argue what to forget');
finishQueued(s, c, { ...item, uid: 'q2' });
check(s.civ.pending.filter((p) => p.defId === 'what_to_forget').length === 1, 'once');
const amount = STRUCTURE_BY_ID.szilard_engine.energy!.amount;
const gain = project(s).energyIn - base;
check(gain > 0 && szilardYield(s) === FORGET[1].yield, `until they decide, the safest: ${gain.toFixed(2)} energy from two (${amount} each as rated, ${FORGET[1].yield} of it)`);
near('and half the cost', continuityLoss(s, false), loss0 + 2 * ENGINE_CONTINUITY * FORGET[1].cost);
s.civ.continuity = 50;
near('the energy by what is left to burn: half at half', project(s).energyIn - base, gain / 2, 1e-6);
s.civ.continuity = 100;
const kin = s.civ.standing.kin;
const echoes = s.civ.standing.echoes;
const p = s.civ.pending.find((x) => x.defId === 'what_to_forget')!;
check(resolveEvent(s, p.uid, 2).ok && s.civ.flags.forget_what === 3 && s.civ.standing.echoes < echoes, `what each of us remembers alone: the Echoes object (${echoes} to ${s.civ.standing.echoes})`);
near('the most energy', project(s).energyIn - base, (gain * FORGET[3].yield) / FORGET[1].yield, 1e-6);
near('for the most Continuity', continuityLoss(s, false), loss0 + 2 * ENGINE_CONTINUITY * FORGET[3].cost);
check(s.civ.standing.kin === kin, 'the Kin unmoved by that choice');
const tip = structureEffect(s, c, 'szilard_engine', project(s).ctx).notes.join(' ');
check(/Burns 1\.3 Continuity a turn/.test(tip) && /160% of its rating now/.test(tip), `its tip, as it is now: "${tip.slice(0, 110)}…"`);
check(STRUCTURE_BY_ID.szilard_engine.desc.includes('2 × 10⁻⁵³ J') && /beyond reason/.test(STRUCTURE_BY_ID.szilard_engine.desc), 'the bend said in its own words');
dismantle(s, c.id, 'szilard_engine');
dismantle(s, c.id, 'szilard_engine');
check(!(c.structures.szilard_engine ?? 0), 'taken down');
near('it stops: the energy as before', project(s).energyIn, base, 1e-6);
near('and the Continuity', continuityLoss(s, false), loss0);
// outside the Dark Era: nothing to burn
const dusk = newGame({ seed: 1000, civsAsleep: true });
check(szilardYield(dusk) === 0, 'outside the Dark Era it gives nothing (the archive is worth keeping)');

// a deliberate choice: never worked out from surplus insight (research.ts), and the autoplayer takes
// it up only when it would light one, much left to burn and the reserve gone within six turns (it
// took it in nearly every Dark Era game and lit one in two of 300, halving a Great Work's insight)
{
  const g = darkGame();
  for (let i = 0; i < 200; i++) {
    g.civ.flags.insight_bank = 1e9;
    if (!discoverFromSurplus(g).length) break;
  }
  check(g.civ.techs.includes('horizon_siphon') && !g.civ.techs.includes('szilard_engines') && availableTechs(g).some((t) => t.id === 'szilard_engines'), 'never worked out from surplus insight, as the Halo Siphons');
  g.civ.flags.insight_bank = 0;
  g.civ.researching = null;
  g.civ.energy = 3000;
  g.civ.flags.last_energy_net = 5;
  autoPlay(g, 'competent');
  check(g.civ.researching !== 'szilard_engines' && !g.civ.techs.includes('szilard_engines'), `the autoplayer, the reserve whole: not researched (${g.civ.researching})`);
  const h = darkGame();
  for (let i = 0; i < 200; i++) {
    h.civ.flags.insight_bank = 1e9;
    if (!discoverFromSurplus(h).length) break;
  }
  h.civ.flags.insight_bank = 0;
  h.civ.researching = null;
  h.civ.energy = 300;
  h.civ.flags.last_energy_net = -80;
  autoPlay(h, 'competent');
  check(h.civ.researching === 'szilard_engines', `the reserve gone within six turns, much left to burn: researched (${h.civ.researching})`);
}

done('SZILARD');
