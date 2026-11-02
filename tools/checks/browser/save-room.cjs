// Browser check: room for saves, and Export and delete all saves (1 Nov, the player: "why is there
// maximum capacity for browser saves? And can you please make a button to delete and export all
// saves?"; asked: one button, export then delete; slots into IndexedDB; "Only what this address
// lists").
// - A slot's data is kept in IndexedDB, not in localStorage (about 5 MB for the whole site).
// - A slot kept the old way, in localStorage, is moved into IndexedDB as the page loads, and loads.
// - The Save window says how much room the slots use.
// - Export and delete all saves: the file of every save first; then "Keep them" keeps them, and
//   "Delete them" deletes what this address lists: no slots, no quick save, no autosave.
// - At the main address (here `?main`) a game begun in the Twilight Interregnum, which only /next/
//   lists, is kept; /next/ (here the local server) still lists it after.
const fs = require('fs');
const { check, start, finish, run } = require('../lib.cjs');

run(async () => {
  const ck = await start('save-room', { seed: 1000 });
  const { page } = ck;
  const openSaves = async () => {
    await page.locator('button[aria-label="Save and load"]').click();
    await page.waitForTimeout(600);
  };
  const close = async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  };
  const slotNames = () => page.evaluate(() => [...document.querySelectorAll('.modal .save-slots .list-item')].map((x) => (x.querySelector('.grow')?.firstChild?.textContent ?? '').trim()));
  /** What IndexedDB and localStorage hold of the slots. */
  const stores = () =>
    page.evaluate(
      () =>
        new Promise((done) => {
          const req = indexedDB.open('steliterate2');
          req.onsuccess = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('slots')) return done({ db: [], ls: Object.keys(localStorage).filter((k) => k.startsWith('steliterate2.slot.')) });
            const all = db.transaction('slots').objectStore('slots').getAllKeys();
            all.onsuccess = () => done({ db: all.result.map(String), ls: Object.keys(localStorage).filter((k) => k.startsWith('steliterate2.slot.')) });
          };
          req.onerror = () => done({ db: null, ls: [] });
        }),
    );
  await page.evaluate(() => (window.__stel.state().civ.pending.length = 0));
  // two slots and a quick save, at /next/ (the local server)
  await openSaves();
  for (const name of ['Room one', 'Room two']) {
    await page.locator('input[aria-label="Name of the new save"]').fill(name);
    await page.locator('.modal button', { hasText: 'Save to a new slot' }).click();
    await page.waitForTimeout(900);
  }
  await page.locator('.modal button', { hasText: /^Quick save$/ }).click();
  await page.waitForTimeout(400);
  const kept = await stores();
  const index = await page.evaluate(() => JSON.parse(localStorage.getItem('steliterate2.slots') ?? '[]').map((x) => x.id));
  check(kept.db && index.length === 2 && index.every((id) => kept.db.includes(id)) && kept.ls.length === 0, `the slots' data in IndexedDB (${kept.db?.length}), none in localStorage (${kept.ls.length})`);
  const room = await page.evaluate(() => document.querySelector('.modal .save-room')?.textContent ?? '');
  check(/2 slots, \d+ KB\. Room: a share of this device’s free space/.test(room), `the room line: "${room}"`);
  await ck.shot('save-room.png');
  await close();
  // a slot kept the old way (as before 1 Nov): its data put back in localStorage, gone from IndexedDB
  const old = index[1];
  await page.evaluate(
    (id) =>
      new Promise((done) => {
        const req = indexedDB.open('steliterate2');
        req.onsuccess = () => {
          const tx = req.result.transaction('slots', 'readwrite');
          const st = tx.objectStore('slots');
          const g = st.get(id);
          g.onsuccess = () => {
            localStorage.setItem(`steliterate2.slot.${id}`, g.result);
            st.delete(id);
          };
          tx.oncomplete = () => done(true);
        };
      }),
    old,
  );
  const planted = await stores();
  check(planted.ls.length === 1 && !planted.db.includes(old), 'a slot kept the old way, in localStorage');
  await page.reload();
  await page.waitForTimeout(2000);
  const moved = await stores();
  check(moved.ls.length === 0 && moved.db.includes(old), 'moved into IndexedDB as the page loads');
  // it loads (from the menu: the page reloaded to it)
  await page.locator('.menu .btn', { hasText: /Save|Load/ }).first().click();
  await page.waitForTimeout(600);
  const names = await slotNames();
  check(names.length === 2, `both slots still listed (${names.join(', ')})`);
  const oldName = await page.evaluate((id) => JSON.parse(localStorage.getItem('steliterate2.slots')).find((x) => x.id === id).name, old);
  await page.locator('.modal .save-slots .list-item', { hasText: oldName }).locator('button', { hasText: /^Load$/ }).click();
  await page.waitForTimeout(1500);
  const loaded = await page.evaluate(() => window.__stel.state()?.settings.civName ?? null);
  check(!!loaded, `the moved slot loads (${loaded})`);
  // a game begun in the Twilight Interregnum, saved to a slot here at /next/
  await page.evaluate(() => window.__stel.newGame({ seed: 1000, interregnum: true }));
  await page.waitForTimeout(1200);
  await page.evaluate(() => (window.__stel.state().civ.pending.length = 0));
  await openSaves();
  await page.locator('input[aria-label="Name of the new save"]').fill('Twilight kept');
  await page.locator('.modal button', { hasText: 'Save to a new slot' }).click();
  await page.waitForTimeout(900);
  await close();
  // the main address, as it were: Export and delete all saves
  await page.goto(page.url().replace(/\?.*$/, '') + '?main&nofilms', { timeout: 90000 });
  await page.waitForTimeout(1800);
  await page.locator('.menu .btn', { hasText: /Save|Load/ }).first().click();
  await page.waitForTimeout(600);
  const atMain = await slotNames();
  check(atMain.length === 2 && !atMain.some((x) => /Twilight kept/.test(x)), `at the main address: its two slots, not the Interregnum's (${atMain.join(', ')})`);
  const btn = page.locator('.modal button', { hasText: 'Export and delete all saves' });
  // first "Keep them"
  const [dl1] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), btn.click()]);
  const bundle = JSON.parse(fs.readFileSync(await dl1.path(), 'utf8'));
  const ask = await page.evaluate(() => document.querySelector('.modal .save-clear')?.textContent ?? '');
  check(bundle.kind === 'steliterate-saves' && bundle.saves.length >= 4 && bundle.saves.some((x) => x.name === 'Twilight kept'), `the file first: ${bundle.saves.length} saves, every one this browser keeps (${dl1.suggestedFilename()})`);
  check(/Once it is safe, delete the \d+ saves listed here\?/.test(ask) && /stay: the preview address lists them/.test(ask), `then the question: "${ask.slice(0, 160)}"`);
  await page.locator('.modal .save-clear button', { hasText: 'Keep them' }).click();
  await page.waitForTimeout(400);
  check((await slotNames()).length === 2 && (await page.locator('.modal .save-clear').count()) === 0, 'Keep them: nothing deleted');
  // then "Delete them"
  await Promise.all([page.waitForEvent('download', { timeout: 30000 }), btn.click()]);
  await page.waitForTimeout(300);
  await ck.shot('save-room-ask.png');
  await page.locator('.modal .save-clear button', { hasText: 'Delete them' }).click();
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({
    slots: document.querySelectorAll('.modal .save-slots .list-item').length,
    empty: /No saved slots yet/.test(document.querySelector('.modal')?.textContent ?? ''),
    quick: [...document.querySelectorAll('.modal button')].find((b) => /^Load quick save$/.test(b.textContent))?.disabled ?? null,
    auto: [...document.querySelectorAll('.modal button')].find((b) => /^Load autosave$/.test(b.textContent))?.disabled ?? null,
    toast: [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '),
  }));
  check(after.slots === 0 && after.empty && after.quick === true && after.auto === true && /Deleted \d+ saves; the file has them all/.test(after.toast), `Delete them: no slots, no quick save, no autosave (${after.toast.slice(0, 80)})`);
  await ck.shot('save-room-deleted.png');
  // back at /next/: the Interregnum's slot is still there
  await page.goto(page.url().replace(/\?.*$/, '') + '?nofilms', { timeout: 90000 });
  await page.waitForTimeout(1800);
  await page.locator('.menu .btn', { hasText: /Save|Load/ }).first().click();
  await page.waitForTimeout(600);
  const atNext = await slotNames();
  check(atNext.length === 1 && /Twilight kept/.test(atNext[0]), `at /next/ the game begun in the Twilight Interregnum is still there (${atNext.join(', ')})`);
  await finish('SAVE ROOM', ck);
});
