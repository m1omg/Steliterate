// Browser check: every save at once (12 Oct, the player: "let me export all the saves from the
// browser, not just one"). Two slots, a quick save and the autosave; Export all saves hands over
// one file with all four; on a browser with no saves, importing it brings each back as a slot
// (names and times kept; the quick save and the autosave as slots of their own), a second import
// adds nothing, and an imported slot loads.
const fs = require('fs');
const { check, start, finish, run } = require('../lib.cjs');

run(async () => {
  const ck = await start('save-all', { seed: 1000 });
  const { page } = ck;
  const openSaves = async () => {
    await page.locator('button[aria-label="Save and load"]').click();
    await page.waitForTimeout(500);
  };
  const close = async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  };
  // a turn played for real writes the autosave
  await page.evaluate(() => {
    window.__stel.state().pending.length = 0;
    window.__stel.refresh();
  });
  await page.locator('button.endturn').click();
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.__stel.state().pending.length = 0;
    window.__stel.refresh();
  });
  await page.waitForTimeout(300);
  const turn = await page.evaluate(() => window.__stel.state().turn);
  // two slots and a quick save
  await openSaves();
  for (const name of ['First of two', 'Second of two']) {
    await page.locator('input[aria-label="Name of the new save"]').fill(name);
    await page.locator('.modal button', { hasText: 'Save to a new slot' }).click();
    await page.waitForTimeout(800);
  }
  await page.locator('.modal button', { hasText: /^Quick save$/ }).click();
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => [...document.querySelectorAll('.modal .save-slots .list-item')].map((x) => x.textContent));
  check(before.length === 2, `two slots saved (${before.length})`);
  // export them all
  const exportBtn = page.locator('.modal button', { hasText: 'Export all saves' });
  check((await exportBtn.count()) === 1 && (await exportBtn.isEnabled()), 'Export all saves is there');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), exportBtn.click()]);
  const file = await dl.path();
  const bundle = JSON.parse(fs.readFileSync(file, 'utf8'));
  const names = bundle.saves.map((x) => `${x.from}:${x.name}`);
  console.log('file', dl.suggestedFilename(), 'saves', names.join(' | '), `${Math.round(fs.statSync(file).size / 1024)} KB`);
  check(/^steliterate-all-saves-\d{4}-\d\d-\d\d\.json$/.test(dl.suggestedFilename()), `named by the day (${dl.suggestedFilename()})`);
  check(bundle.kind === 'steliterate-saves' && bundle.saves.length === 4, `one file, four saves (${bundle.saves.length})`);
  check(names.includes('slot:First of two') && names.includes('slot:Second of two') && names.includes('quick:Quick save') && names.includes('auto:Autosave'), 'both slots, the quick save and the autosave');
  check(bundle.saves.every((x) => x.game && x.game.turn === turn && x.game.civs), `each a whole game at turn ${turn}`);
  const toast = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '));
  check(/Exported 4 saves in steliterate-all-saves-/.test(toast), `the message says so (${toast.slice(0, 120)})`);
  await close();
  // another browser, as it were: no saves at all
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('steliterate2.slot') || k.startsWith('steliterate2.save') || k.startsWith('steliterate2.autosave')) localStorage.removeItem(k);
  });
  await openSaves();
  check((await page.locator('.modal .save-slots .list-item').count()) === 0, 'emptied: no slots');
  const importIt = async () => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 30000 }), page.locator('.modal button', { hasText: 'Import save file' }).click()]);
    await chooser.setFiles(file);
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(250);
      const t = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((x) => x.textContent).join(' | '));
      if (/added as slots|already here/.test(t)) return t;
    }
    return '';
  };
  const t1 = await importIt();
  check(/4 saves added as slots/.test(t1), `imported: ${t1.slice(0, 140)}`);
  const after = await page.evaluate(() => [...document.querySelectorAll('.modal .save-slots .list-item')].map((x) => x.textContent));
  console.log('slots', after.map((x) => x.slice(0, 60)).join(' | '));
  check(after.length === 4, `four slots in the list, refreshed (${after.length})`);
  check(after.some((x) => x.startsWith('First of two')) && after.some((x) => x.startsWith('Second of two')), 'the slots keep their names');
  check(after.some((x) => x.startsWith('Quick save:')) && after.some((x) => x.startsWith('Autosave:')), 'the quick save and the autosave come in as slots of their own');
  const own = await page.evaluate(() => [localStorage.getItem('steliterate2.save'), localStorage.getItem('steliterate2.autosave')]);
  check(own[0] === null, 'the quick save itself is not written by an import');
  const t2 = await importIt();
  check(/No new saves, 4 already here/.test(t2) && (await page.locator('.modal .save-slots .list-item').count()) === 4, `imported again: nothing added (${t2.slice(0, 80)})`);
  // an imported slot loads
  await page.locator('.modal .save-slots .list-item', { hasText: 'Second of two' }).locator('button', { hasText: 'Load' }).click();
  await page.waitForTimeout(1500);
  const loaded = await page.evaluate(() => window.__stel.state().turn);
  check(loaded === turn, `an imported slot loads (turn ${loaded})`);
  await ck.shot('save-all.png');
  await finish('SAVE ALL', ck);
});
