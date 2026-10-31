// Browser check: the build list can leave out what cannot be built at a settlement now (31 Oct, the
// player: "pls let the player hide buildings that are unavailable to build"). Off at first, every
// structure listed, the unavailable greyed with why; Hide unavailable leaves them out and says how
// many; it is remembered for the next settlement and the next visit; Show brings them back.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('hide-unbuildable', { width: 1400, height: 1000 });
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1200);
  const open = async () => {
    await page.evaluate(() => {
      const s = window.__stel.state();
      window.__stel.select('body', s.colonies[s.civ.capitalId].bodyId);
    });
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: /^Build/ }).first().click();
    await page.waitForTimeout(600);
  };
  const look = () =>
    page.evaluate(() => ({
      rows: document.querySelectorAll('.list-item.build').length,
      greyed: document.querySelectorAll('.list-item.build.disabled').length,
      toggle: document.querySelector('.hide-unbuildable')?.textContent.trim() ?? null,
      pressed: document.querySelector('.hide-unbuildable')?.getAttribute('aria-pressed'),
    }));
  await open();
  const a = await look();
  console.log(`  shown: ${JSON.stringify(a)}`);
  check(a.greyed > 0 && a.pressed === 'false' && a.toggle === `Hide unavailable (${a.greyed})`, `at first everything is listed, ${a.greyed} greyed (${a.toggle})`);
  await page.locator('.hide-unbuildable').click();
  await page.waitForTimeout(400);
  const b = await look();
  console.log(`  hidden: ${JSON.stringify(b)}`);
  check(b.greyed === 0 && b.rows === a.rows - a.greyed && b.pressed === 'true' && b.toggle === `Show unavailable (${a.greyed})`, `Hide unavailable leaves them out (${b.rows} of ${a.rows} rows)`);
  await ck.shot('hide-unbuildable.png');
  // remembered: after a reload, in the same game
  const saved = await page.evaluate(() => Object.entries(localStorage).find(([k]) => /hud$/.test(k))?.[1] ?? '');
  check(/"hideUnbuildable":true/.test(saved), 'it is remembered between sessions');
  await page.locator('.hide-unbuildable').click();
  await page.waitForTimeout(400);
  const c = await look();
  check(c.greyed === a.greyed && c.rows === a.rows && c.pressed === 'false', 'Show unavailable brings them back');
  await finish('HIDE UNBUILDABLE', ck);
});
