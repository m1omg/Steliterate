// One rulebook (the new version, docs/plans/new-version.md, part 2a-0): every civilization has a
// Civ in state.civs and state.civ points at the one whose turn or view it is. This checks the
// pointer and the save format:
// - a new game has one civilization, the player's, and the pointer at it;
// - a save holds each civilization once: `civs` and `player`, never the pointer;
// - a load, a copy for the checks (copyState) and a save of the build before all point it again,
//   at the very object in `civs`;
// - a plain JSON copy loses the pointer (and so fails loudly, never quietly writing to a copy);
// - settlements and fleets have owners, and each civilization's walks over them see its own.
import { PLAYER_ID, playerCiv, pointAt } from '../../../src/game/civs';
import { newGame } from '../../../src/game/newGame';
import { copyState, exportCode, importCode, saveFile } from '../../../src/game/save';
import { createColony, newFleet } from '../../../src/game/sim/fleets';
import { endTurn } from '../../../src/game/sim/turn';
import { allColonies, allFleets, colonies, fleets } from '../../../src/game/sim/util';
import type { Civ, GameState } from '../../../src/game/types';
import { check, done, loadSave } from '../lib';

const s = newGame({ seed: 1000, survivors: 3 });
check(Object.keys(s.civs).length === 1 && s.player === PLAYER_ID && s.civ.id === PLAYER_ID, `a new game has one civilization, the player’s (${Object.keys(s.civs).join(', ')})`);
check(s.civ === s.civs[s.player] && playerCiv(s) === s.civ, 'and the pointer is at it, the very object');
check(!Object.keys(s).includes('civ'), 'the pointer is not one of the state’s own keys');

const text = saveFile(s).text;
const raw = JSON.parse(text) as Record<string, unknown>;
check(!('civ' in raw) && typeof raw.civs === 'object' && raw.player === PLAYER_ID, 'a save holds `civs` and `player`, never the pointer');
check(text.split(`"homeSystemId":"${s.civ.homeSystemId}"`).length - 1 === 1, 'the player’s civilization is written once');

const back = importCode(exportCode(s));
check(!!back && back.civ === back.civs[back.player] && back.civ.name === s.civ.name, 'a load points it again, at the object in `civs`');
const copy = copyState(s);
check(copy.civ === copy.civs[copy.player] && copy.civ !== s.civ, 'a copy for the checks points it at its own copy');
copy.civ.energy = 12345;
check(copy.civs[copy.player].energy === 12345 && s.civ.energy !== 12345, 'and what is written through the pointer is written to the civilization');
const plain = JSON.parse(JSON.stringify(s)) as GameState;
check(plain.civ === undefined, 'a plain JSON copy has no pointer, so it fails at once rather than quietly');

// settlements and fleets have owners: each civilization's own walks see only its own
{
  const g = copyState(s);
  const mine = colonies(g).length;
  check(mine > 0 && allColonies(g).length === mine && fleets(g).length === allFleets(g).length && allColonies(g).every((c) => c.owner === PLAYER_ID) && allFleets(g).every((f) => f.owner === PLAYER_ID), `a new game’s settlements and fleets are all the player’s (${mine} and ${fleets(g).length})`);
  const other: Civ = { ...structuredClone(g.civ), id: 'sv0', name: 'Others', capitalId: null, known: {} };
  g.civs.sv0 = other;
  pointAt(g, other);
  const free = Object.values(g.bodies).find((b) => !b.colonyId && b.kind !== 'deep' && !b.dissolved && b.systemId !== g.civs.us.homeSystemId)!;
  const c = createColony(g, free, { kin: 2 });
  const f = newFleet(g, free.systemId, ['probe']);
  check(c.owner === 'sv0' && f.owner === 'sv0' && other.capitalId === c.id && other.known[free.systemId] === 2, 'a settlement and a fleet made in another’s turn are its own, its capital, on its map');
  check(colonies(g).length === 1 && fleets(g).length === 1 && allColonies(g).length === mine + 1, 'its walks see only its own; every settlement is still there for what the universe does');
  pointAt(g, g.civs.us);
  check(colonies(g).length === mine && !colonies(g).includes(c) && !fleets(g).includes(f) && g.civs.us.known[free.systemId] !== 2, 'and the player’s see only the player’s, its map untouched');
}

// a save of the build before the new version (a check's fixture): its one civilization is the player's
const old = loadSave('551fb1a-seed24757-turn71.json.gz');
check(old.civ === old.civs[PLAYER_ID] && old.player === PLAYER_ID && old.civ.id === PLAYER_ID && !Object.keys(old).includes('civ'), 'a save from before: its civilization becomes the player’s, pointed at');
const turn = old.turn;
endTurn(old);
check(old.turn === turn + 1 && old.civ === old.civs[PLAYER_ID], 'and a turn plays on it with the pointer where it was');

done('CIVS');
