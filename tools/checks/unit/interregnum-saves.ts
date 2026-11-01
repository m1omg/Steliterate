// A game begun in the Twilight Interregnum is played at /next/ only (1 Nov, the player: "For the
// next and only for the next version, not for the main one"; and "Hide them at main"). Both
// addresses share the browser's storage, so (save.ts):
// - its quick save and autosave are kept apart, and never take the place of the main address's;
// - Continue at /next/ takes whichever was saved last, at the main address only its own;
// - its slots are listed at /next/ only, and deleting or adding another slot keeps them;
// - Export all saves keeps every one.
import { newGame } from '../../../src/game/newGame';
import { deleteSlot, exportAllSaves, hasSave, listSlots, loadGame, saveGame, saveToSlot } from '../../../src/game/save';
import { check, done } from '../lib';

// a browser's storage, in memory
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

const dusk = newGame({ seed: 1000, civsAsleep: true, civName: 'Dusk folk' });
const inter = newGame({ seed: 1000, civsAsleep: true, interregnum: true, civName: 'Twilight folk' });
const MAIN = false;
const NEXT = true;

saveGame(inter, true);
check(!hasSave(true, MAIN) && hasSave(true, NEXT), 'an Interregnum autosave: none at the main address, there at /next/');
saveGame(dusk, true);
check(loadGame(true, MAIN)?.settings.civName === 'Dusk folk' && loadGame(true, NEXT)?.settings.civName === 'Dusk folk', 'a Dusk game saved after it: Continue takes it at both');
saveGame(inter, true);
check(loadGame(true, MAIN)?.settings.civName === 'Dusk folk', 'the Interregnum one saved again: the main address still has its own');
check(loadGame(true, NEXT)?.settings.civName === 'Twilight folk', 'and /next/ the one saved last');
saveGame(inter, false);
check(!hasSave(false, MAIN) && loadGame(false, NEXT)?.settings.interregnum === true, 'the quick save the same way');

const run = async () => {
  const a = await saveToSlot(dusk, 'a dusk slot');
  const b = await saveToSlot(inter, 'a twilight slot');
  check(typeof a !== 'string' && typeof b !== 'string' && !!b.interregnum && !a.interregnum, 'a slot knows a game begun in the Interregnum');
  check(listSlots(MAIN).map((x) => x.name).join() === 'a dusk slot' && listSlots(NEXT).length === 2, `the main address lists only its own (${listSlots(MAIN).map((x) => x.name).join(', ')})`);
  const c = await saveToSlot(dusk, 'another');
  if (typeof c !== 'string') deleteSlot(c.id);
  check(listSlots(NEXT).some((x) => x.name === 'a twilight slot'), 'adding and deleting a slot at the main address keeps the hidden one');
  const all = await exportAllSaves();
  check(!!all && all.count === 5, `Export all saves keeps every one: 2 slots, the Interregnum's quick save, both autosaves (${all?.count})`);
  done('INTERREGNUM SAVES');
};
void run();
