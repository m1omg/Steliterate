// The Leptonic Shipyard and the Leptonic Wraith (31 Oct, the player: "add a leptonic shipyard pls
// also i think there was a wraith/phantom ship for leptonic era already? apply it so it applies for
// existing saves too but doesnt break em"). The Wraith was in the new version's plan, the only
// warship once matter is gone, and was never built. A leptonic settlement with Leptonic
// Computation can build a Leptonic Shipyard, and there Wraiths; a settlement of matter cannot,
// and a leptonic one builds no ship of matter. Wraiths are mended there, and ships of matter are
// not. A save from before it, in the Black Hole Age, can build it at once.
import { newGame } from '../../../src/game/newGame';
import { queueBuild, shipCheck, structureCheck } from '../../../src/game/sim/actions';
import { finishQueued } from '../../../src/game/sim/queue';
import { repairFleets } from '../../../src/game/sim/fleets';
import { STRUCTURE_BY_ID, structureKind } from '../../../src/game/data/structures';
import { SHIP_BY_ID, fleetLook, isWarship } from '../../../src/game/data/ships';
import { formOf } from '../../../src/game/sim/util';
import { check, done, loadSave } from '../lib';

const yard = STRUCTURE_BY_ID.lepton_shipyard;
const wraith = SHIP_BY_ID.wraith;
check(!!yard && !!wraith && structureKind(yard) === 'industry' && isWarship('wraith') && fleetLook(['wraith']) === 'wraith' && fleetLook(['warden', 'wraith']) === 'wraith', 'a Leptonic Shipyard (under Industry) and the Leptonic Wraith, a warship with a hull of its own');

const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'decays', civsAsleep: true });
s.era = 'degenerate';
s.eta = 36;
s.years = 1e36;
s.civ.techs.push('leptonic_computation');
s.civ.matter = 500;
s.civ.energy = 500;
const c = s.colonies[s.civ.capitalId!];
c.structures.shipyard = 1;
check(/only a leptonic settlement/.test(structureCheck(s, c, yard) ?? ''), `a settlement of matter cannot build one (${structureCheck(s, c, yard)})`);
check(/only a leptonic settlement/.test(shipCheck(c, wraith) ?? '') && shipCheck(c, SHIP_BY_ID.warden) === null, 'nor a Wraith; it builds its Wardens at its Shipyard as before');
c.form = 'leptonic';
delete c.structures.shipyard;
c.pops.kin = 0;
check(structureCheck(s, c, yard) === null, 'a leptonic settlement can build a Leptonic Shipyard');
check(shipCheck(c, wraith) === 'Needs a Leptonic Shipyard.' && /Made of matter/.test(shipCheck(c, SHIP_BY_ID.warden) ?? ''), `without one it cannot build a Wraith, and never a ship of matter (${shipCheck(c, SHIP_BY_ID.warden)})`);
check(queueBuild(s, c.id, 'structure', 'lepton_shipyard') === null, 'it queues one');
finishQueued(s, c, c.queue.shift()!);
check((c.structures.lepton_shipyard ?? 0) === 1 && shipCheck(c, wraith) === null, 'with it, a Wraith can be built');
const before = new Set(Object.keys(s.fleets));
check(queueBuild(s, c.id, 'ship', 'wraith') === null, 'it queues one');
finishQueued(s, c, c.queue.shift()!);
const f = Object.values(s.fleets).find((x) => !before.has(x.id));
check(!!f && f.ships.length === 1 && f.ships[0].cls === 'wraith' && f.at === c.systemId, `the Wraith is launched (${f?.name})`);
// mended at its yard; a ship of matter there is not
f!.ships[0].hp = 4;
f!.ships.push({ cls: 'warden', hp: 3 });
repairFleets(s);
check(f!.ships[0].hp > 4 && f!.ships[1].hp === 3, `a Leptonic Shipyard mends the Wraith (${f!.ships[0].hp.toFixed(1)}), not a ship of matter`);

// a save from before it: its leptonic settlement can build the yard, then Wraiths
{
  const old = loadSave('b1fc6a7-seed8919-turn161-next.json.gz');
  const lc = Object.values(old.colonies).find((x) => x.owner === old.player && formOf(x) === 'leptonic')!;
  const err = structureCheck(old, lc, yard);
  console.log(`  ${lc.name} (η ${old.eta.toFixed(1)}): ${err ?? 'can build a Leptonic Shipyard'}`);
  check(!!lc && err === null, 'an older save’s leptonic settlement can build a Leptonic Shipyard at once');
  lc.structures.lepton_shipyard = 1;
  check(shipCheck(lc, wraith) === null, 'and then Wraiths');
}
done('LEPTONIC YARD');
