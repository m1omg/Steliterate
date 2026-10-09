// A settled system is never gone (the player's Uluvacaluth Deep, 8 Oct). A black hole that
// evaporates with nothing of ours left around it is gone, though its Deep is kept, and our own
// people who left us may live there. Taking them back settles that Deep: the system is on the map
// again (a node, a label, something to click) and ships can reach it. A game saved with such a
// settlement in a system still marked gone is repaired as it loads; one that fell into the Heart
// stays gone.
import { newGame } from '../../../src/game/newGame';
import { evaporateHole } from '../../../src/game/physics';
import { readSave, saveFile } from '../../../src/game/save';
import { orderMove } from '../../../src/game/sim/fleets';
import { seizeSurvivor } from '../../../src/game/sim/survivors';
import type { Fleet, GameState } from '../../../src/game/types';
import { check, done } from '../lib';

const game = () => newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' }) as GameState;

/** A hole far from home whose worlds are long gone, our own people who left us living in its Deep. */
const setup = () => {
  const s = game();
  const home = s.systems[s.civ.homeSystemId];
  const sys = Object.values(s.systems).find((x) => !x.special && x.id !== home.id && !Object.values(s.colonies).some((c) => c.systemId === x.id))!;
  Object.assign(sys.primary, { kind: 'black_hole', lum: 0 });
  for (const id of sys.bodies) if (s.bodies[id].kind !== 'deep') s.bodies[id].dissolved = true;
  const sv = Object.values(s.survivors)[0];
  Object.assign(sv, { way: 'fork', forkOf: 'echoes', alive: true, contact: true, homeSystemId: sys.id, systems: [sys.id], pop: 6, health: 0.5 });
  s.civ.known[sys.id] = 2;
  return { s, sys, sv };
};

// the hole evaporates: nothing of ours there, so the system is gone, its Deep kept
{
  const { s, sys, sv } = setup();
  evaporateHole(s, sys);
  const deep = sys.bodies.map((id) => s.bodies[id]).find((b) => b.kind === 'deep')!;
  check(sys.gone === true && sys.primary.kind === 'void' && !deep.dissolved, 'a hole that evaporates with nothing of ours there is gone, its Deep kept');
  // war, a siege held, and we take our own people back
  sv.war = { since: s.turn, siege: 3 };
  const f: Fleet = { id: 'fx', name: 'Spear', ships: [{ cls: 'aegis', hp: 30 }, { cls: 'aegis', hp: 30 }], at: sys.id, from: null, to: null, traveled: 0, distance: 0, order: 'idle' } as Fleet;
  s.fleets[f.id] = f;
  const err = seizeSurvivor(s, sv.id);
  const c = Object.values(s.colonies).find((x) => x.systemId === sys.id);
  check(err === null && !!c && c.bodyId === deep.id, `taking back our own people settles its Deep (${c?.name ?? 'no settlement'})`);
  check(sys.gone === false, 'and the system is no longer gone: the galaxy map draws it and it can be clicked');
  // a ship elsewhere can be sent there
  const away: Fleet = { id: 'fy', name: 'Reach', ships: [{ cls: 'probe', hp: 2 }], at: s.civ.homeSystemId, from: null, to: null, traveled: 0, distance: 0, order: 'idle' } as Fleet;
  s.fleets[away.id] = away;
  s.civ.energy = 1e6;
  const sent = orderMove(s, away.id, sys.id);
  check(sent === null, `ships can be sent there (${sent ?? 'sent'})`);
}

// an older game, saved with such a settlement in a system marked gone, is repaired as it loads
{
  const { s, sys, sv } = setup();
  evaporateHole(s, sys);
  sv.war = { since: s.turn, siege: 3 };
  s.fleets.fx = { id: 'fx', name: 'Spear', ships: [{ cls: 'aegis', hp: 30 }, { cls: 'aegis', hp: 30 }], at: sys.id, from: null, to: null, traveled: 0, distance: 0, order: 'idle' } as Fleet;
  seizeSurvivor(s, sv.id);
  sys.gone = true; // as the bug left it
  const loaded = readSave(saveFile(s).text)!;
  check(loaded.systems[sys.id].gone === false && Object.values(loaded.colonies).some((x) => x.systemId === sys.id), 'a game saved with it marked gone loads with the system back on the map, the settlement kept');
  // a system that fell into the Heart (its star still named, not void) stays gone
  const t = setup();
  t.sys.primary.kind = 'white_dwarf';
  t.sys.gone = true;
  const deep = t.sys.bodies.map((id) => t.s.bodies[id]).find((b) => b.kind === 'deep')!;
  t.s.colonies.cz = { ...Object.values(t.s.colonies)[0], id: 'cz', bodyId: deep.id, systemId: t.sys.id, name: 'Test' };
  deep.colonyId = 'cz';
  const kept = readSave(saveFile(t.s).text)!;
  check(kept.systems[t.sys.id].gone === true, 'one that fell into the Heart stays gone');
}
done('SETTLED');
