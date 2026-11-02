// Room for saves, and Export and delete all saves (1 Nov, the player: "why is there maximum capacity
// for browser saves? And can you please make a button to delete and export all saves?"; asked,
// export then delete, slots into IndexedDB, and "Only what this address lists"). Here, in Node,
// there is no IndexedDB, so the slots take the way they take where a browser will not give it:
// localStorage, as before (browser/save-room checks IndexedDB). Both addresses share the storage:
// - slots save, load, list and export as ever;
// - an old slot left in localStorage stays where it is when it cannot be moved, and loads;
// - deleteAllSaves at the main address deletes its slots, quick save and autosave, and keeps a
//   game begun in the Twilight Interregnum (only /next/ lists it), which it counts as kept;
// - at /next/ it deletes everything listed there, both kinds;
// - the file of all saves made before holds every one.
import { newGame } from '../../../src/game/newGame';
import { deleteAllSaves, exportAllSaves, hasSave, listSlots, loadSlot, moveSlotsToDb, saveGame, saveToSlot, savesKeptElsewhere, savesListed } from '../../../src/game/save';
import { check, done } from '../lib';

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size;
  },
} as Storage;

const MAIN = false;
const NEXT = true;
const dusk = newGame({ seed: 1000, civsAsleep: true, civName: 'Dusk folk' });
const inter = newGame({ seed: 1000, civsAsleep: true, interregnum: true, civName: 'Twilight folk' });

const run = async () => {
  // a few of each, at both addresses
  for (const n of ['one', 'two', 'three']) await saveToSlot(dusk, `dusk ${n}`);
  await saveToSlot(inter, 'twilight one');
  saveGame(dusk, false);
  saveGame(dusk, true);
  saveGame(inter, false);
  saveGame(inter, true);
  const first = listSlots(MAIN)[0];
  const g = await loadSlot(first.id);
  check(listSlots(MAIN).length === 3 && listSlots(NEXT).length === 4 && g?.settings.civName === 'Dusk folk', `slots save, list and load as ever (${listSlots(MAIN).length} here, ${listSlots(NEXT).length} at /next/)`);
  check([...mem.keys()].some((k) => k.startsWith('steliterate2.slot.')), 'with no IndexedDB, in localStorage as before');
  check((await moveSlotsToDb()) === 0 && (await loadSlot(first.id))?.turn === dusk.turn, 'where they cannot be moved they stay, and load');
  check(savesListed(MAIN) === 5 && savesListed(NEXT) === 8 && savesKeptElsewhere(MAIN) === 3 && savesKeptElsewhere(NEXT) === 0, `listed: 5 at the main address (3 slots, quick, auto), 8 at /next/; kept elsewhere at the main address: 3 (the Interregnum's slot, quick save and autosave)`);
  const file = await exportAllSaves();
  check(!!file && file.count === 8, `the file of all saves first: ${file?.count} saves`);
  // delete at the main address (with the settings and an archived build's game in storage too)
  mem.set('steliterate2.settings', '{"music":0.5}');
  mem.set('steliterate.save.v1', '{"old":true}');
  const n = deleteAllSaves(MAIN);
  check(n === 5 && listSlots(MAIN).length === 0 && !hasSave(false, MAIN) && !hasSave(true, MAIN), `at the main address: ${n} deleted, none listed, no quick save or autosave`);
  check(listSlots(NEXT).map((x) => x.name).join() === 'twilight one' && hasSave(false, NEXT) && hasSave(true, NEXT) && savesKeptElsewhere(MAIN) === 3, 'and the game begun in the Twilight Interregnum is kept, for /next/');
  check(mem.get('steliterate2.settings') === '{"music":0.5}' && mem.get('steliterate.save.v1') === '{"old":true}', 'the settings and the archived build’s game are never touched');
  // and at /next/
  saveGame(dusk, true);
  const m = deleteAllSaves(NEXT);
  check(m === 4 && listSlots(NEXT).length === 0 && !hasSave(false, NEXT) && !hasSave(true, NEXT) && ![...mem.keys()].some((k) => /steliterate2\.(save|autosave|slot\.)/.test(k)) && mem.has('steliterate2.settings') && mem.has('steliterate.save.v1'), `at /next/: ${m} deleted, everything it listed, both kinds; the settings and the archive's game still there`);
  done('SAVE ROOM');
};
void run();
