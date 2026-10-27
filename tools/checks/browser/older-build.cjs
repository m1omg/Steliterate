// Browser check: the new version keeps its own storage (13 Oct, docs/plans/new-version.md; the
// player: "For the new version, don't worry about saves"). With games and settings of the older
// build in this browser:
// - the title screen says where they play on and links to the older build, and offers no Continue;
// - the older build's settings are its starting point (here the magnifier mode);
// - importing one of those games refuses it, says so, and offers to open the older build;
// - a game played here autosaves under its own keys and leaves the older build's untouched.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { check, start, finish, run } = require('../lib.cjs');

const OLDER_BUILD = 'https://m1omg.github.io/Steliterate/archive/2026-10-27/';

run(async () => {
  const ck = await start('older-build');
  const { page } = ck;
  const oldGame = zlib.gunzipSync(fs.readFileSync(path.join(__dirname, '../../saves/4fe2404-seed1000-turn87-clock.json.gz'))).toString('utf8');
  const file = path.join(ck.out, 'older-game.json');
  fs.writeFileSync(file, oldGame);
  // the older build's games and settings, as a player's browser keeps them
  await page.evaluate((g) => {
    localStorage.clear();
    localStorage.setItem('steliterate.autosave.v1', g);
    localStorage.setItem('steliterate.settings', JSON.stringify({ music: 0.7, sfx: 0.7, quality: 'high', uiScale: 1, lowVision: true }));
  }, oldGame);
  await page.reload();
  await page.waitForFunction(() => !!window.__stel?.engine(), null, { timeout: 90000 });
  await page.waitForTimeout(800);
  const before = await page.evaluate(() => ({ a: localStorage.getItem('steliterate.autosave.v1'), s: localStorage.getItem('steliterate.settings') }));
  // the title screen
  const older = page.locator('.menu-older');
  check((await older.count()) === 1, 'the title screen says the older games play on in the older build');
  const href = (await older.count()) ? await older.locator('a').getAttribute('href') : null;
  check(href === OLDER_BUILD, `and links to it (${href})`);
  check((await page.getByRole('button', { name: /^Continue$/ }).count()) === 0, 'and offers no Continue: this version has no game of its own yet');
  const lv = await page.evaluate(() => document.documentElement.classList.contains('lv'));
  check(lv, 'the older build’s settings are the starting point (the magnifier mode is on)');
  // importing one of those games
  await page.getByRole('button', { name: /Load \/ import/ }).click();
  await page.waitForTimeout(500);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 30000 }), page.locator('.modal button', { hasText: 'Import save file' }).click()]);
  await chooser.setFiles(file);
  let toast = '';
  for (let i = 0; i < 40 && !/older build/.test(toast); i++) {
    await page.waitForTimeout(250);
    toast = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '));
  }
  check(/That game is from the older build/.test(toast), `importing it is refused, and says why (${toast.slice(0, 110)})`);
  check((await page.locator('.toast button', { hasText: 'Open it' }).count()) === 1, 'with a button to open the older build');
  check(await page.evaluate(() => !window.__stel.state()), 'and no game was loaded');
  await page.keyboard.press('Escape');
  // a game of this version
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.__stel.state().civ.pending.length = 0;
    window.__stel.refresh();
  });
  await page.locator('button.endturn').click();
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({ a: localStorage.getItem('steliterate.autosave.v1'), s: localStorage.getItem('steliterate.settings'), mine: localStorage.getItem('steliterate2.autosave'), keys: Object.keys(localStorage).sort() }));
  console.log('keys', after.keys.join(', '));
  check(!!after.mine && JSON.parse(after.mine).saveVersion >= 4, 'a game played here autosaves under its own key');
  check(after.a === before.a && after.s === before.s, 'and the older build’s game and settings are untouched');
  check(after.keys.every((k) => k.startsWith('steliterate2.') || k === 'steliterate.autosave.v1' || k === 'steliterate.settings'), 'this version writes only its own keys');
  await finish('OLDER BUILD', ck);
});
