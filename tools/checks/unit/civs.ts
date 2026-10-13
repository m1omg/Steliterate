// One rulebook (the new version, docs/plans/new-version.md, part 2a-0): every civilization has a
// Civ in state.civs and state.civ points at the one whose turn or view it is. This checks the
// pointer and the save format (in a game whose neighbours sleep, civsAsleep: unit/others checks
// them as civilizations):
// - a new game has one civilization, the player's, and the pointer at it;
// - a save holds each civilization once: `civs` and `player`, never the pointer;
// - a load, a copy for the checks (copyState) and a save of the build before all point it again,
//   at the very object in `civs`;
// - a plain JSON copy loses the pointer (and so fails loudly, never quietly writing to a copy);
// - settlements and fleets have owners, and each civilization's walks over them see its own;
// - asCiv: one civilization's part of a turn, never nested, the pointer back at the player after
//   whatever happens; under the checks' guard every other civilization is read-only meanwhile;
// - each civilization but the player draws from a stream of its own, so the player's draws stay;
// - what one sends another waits in the outbox until every civilization has played.
import { PLAYER_ID, asCiv, assertPlayerView, flushOutbox, isPlayerView, playerCiv, pointAt, setCivGuard } from '../../../src/game/civs';
import { newGame } from '../../../src/game/newGame';
import { copyState, exportCode, importCode, saveFile } from '../../../src/game/save';
import { createColony, newFleet } from '../../../src/game/sim/fleets';
import { endTurn } from '../../../src/game/sim/turn';
import { sendSignal } from '../../../src/game/sim/signals';
import { allColonies, allFleets, colonies, fleets, log, withRng } from '../../../src/game/sim/util';
import type { Civ, GameState } from '../../../src/game/types';
import { check, done, loadSave } from '../lib';

const s = newGame({ seed: 1000, survivors: 3, civsAsleep: true });
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

// one civilization's part of a turn (asCiv): the pointer at it, and back at the player whatever happens
{
  const g = copyState(s);
  const other: Civ = { ...structuredClone(g.civ), id: 'sv0', name: 'Others', capitalId: null, known: {}, signals: [], log: [] };
  g.civs.sv0 = other;
  const seen = asCiv(g, 'sv0', () => [g.civ.id, isPlayerView(g)] as const);
  check(seen[0] === 'sv0' && seen[1] === false && g.civ === g.civs.us && isPlayerView(g), 'asCiv points at the civilization for its part, and back at the player after');
  let threw = false;
  try {
    asCiv(g, 'sv0', () => {
      throw new Error('boom');
    });
  } catch {
    threw = true;
  }
  check(threw && g.civ === g.civs.us && isPlayerView(g), 'and back even when its part throws');
  let nested = '';
  asCiv(g, 'sv0', () => {
    try {
      asCiv(g, 'us', () => 0);
    } catch (e) {
      nested = String(e);
    }
  });
  check(/cannot play inside/.test(nested) && g.civ === g.civs.us, 'one civilization plays at a time: asCiv never nests');
  // the checks' guard: every other civilization is read-only while one plays
  setCivGuard(true);
  const us = g.civs.us;
  let crossed = '';
  asCiv(g, 'sv0', () => {
    g.civ.energy += 1;
    log(g, 'their own record');
    try {
      g.civs.us.energy = 0;
    } catch (e) {
      crossed = String(e);
    }
    try {
      g.civs.us.log.push({ turn: 0, era: 'dusk', text: 'x', kind: 'info' });
    } catch (e) {
      crossed += String(e);
    }
  });
  check(/civs\.us\.energy: written/.test(crossed) && /civs\.us\.log\.\d+: written|civs\.us\.log\.length/.test(crossed), `under the guard a write to another civilization throws where it is made (${crossed.split('\n')[0].slice(7, 70)}…)`);
  check(g.civs.us === us && us.energy === s.civ.energy && !us.log.some((x) => x.text === 'x') && other.log.some((x) => x.text === 'their own record'), 'its own writes land, the other’s civilization is untouched and itself again after');
  let caught = '';
  pointAt(g, other);
  try {
    assertPlayerView(g, 'test');
  } catch (e) {
    caught = String(e);
  }
  check(/pointed at sv0, not the player/.test(caught), 'a pointer left elsewhere is a bug: under the guard it throws');
  setCivGuard(false);
  const err = console.error;
  console.error = () => {};
  assertPlayerView(g, 'test');
  console.error = err;
  check(g.civ === g.civs.us, 'for a player it is put back, so the game goes on');
  // its own random stream: what it draws never moves the player's draws
  const r0 = g.rng;
  const theirs = asCiv(g, 'sv0', () => withRng(g, (r) => [r.next(), r.next()]));
  check(g.rng === r0 && typeof other.rng === 'number', 'another civilization draws from its own stream: the state’s, the player’s, is as it was');
  const again = copyState(g);
  delete again.civs.sv0.rng;
  const theirsAgain = asCiv(again, 'sv0', () => withRng(again, (r) => [r.next(), r.next()]));
  check(theirs[0] === theirsAgain[0] && theirs[1] === theirsAgain[1], 'its stream starts from the seed and its id, the same in every game of that seed');
  const mine = withRng(g, (r) => r.next());
  const plain = copyState(s);
  check(mine === withRng(plain, (r) => r.next()), 'and the player’s next draw is the one it would have been');
  // between civilizations: the outbox
  asCiv(g, 'sv0', () => {
    sendSignal(g, { from: 'sv0', to: 'us', kind: 'test', title: 'Hello', text: 'From afar.', distanceLy: 10 });
    sendSignal(g, { from: 'sv0', kind: 'test', title: 'To ourselves', text: 'A note.', distanceLy: 0 });
  });
  check(!g.civs.us.signals.some((x) => x.title === 'Hello') && g.outbox?.length === 1 && other.signals.some((x) => x.title === 'To ourselves'), 'a message to another waits in the outbox; one to itself is its own at once');
  flushOutbox(g);
  check(g.civs.us.signals.some((x) => x.title === 'Hello' && x.arriveYears === g.years + 10) && g.outbox === undefined, 'delivered when every civilization has played, crossing the dark at light speed as ever');
  check(!('outbox' in JSON.parse(saveFile(g).text)), 'and a save between turns holds no outbox');
}

// a save of the build before the new version (a check's fixture): its one civilization is the player's
const old = loadSave('551fb1a-seed24757-turn71.json.gz');
check(old.civ === old.civs[PLAYER_ID] && old.player === PLAYER_ID && old.civ.id === PLAYER_ID && !Object.keys(old).includes('civ'), 'a save from before: its civilization becomes the player’s, pointed at');
const turn = old.turn;
endTurn(old);
check(old.turn === turn + 1 && old.civ === old.civs[PLAYER_ID], 'and a turn plays on it with the pointer where it was');

done('CIVS');
