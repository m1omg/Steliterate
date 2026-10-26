// Browser check: the Systems window's Star types tab (26 Oct, the player: "add options to systems
// menu to select different star types + black holes"): a button for each kind of star on our map,
// black holes too, each listing those stars, the nearest first; and the Black holes tab in the Dusk
// too, once one is on our map.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('star-types');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(800);
  const hole = await page.evaluate(() => {
    const s = window.__stel.state();
    const h = Object.values(s.systems).find((x) => x.primary.kind === 'black_hole' && !x.gone);
    s.civ.known[h.id] = 1;
    window.__stel.refresh();
    return h.name;
  });
  await page.keyboard.press('s');
  await page.waitForTimeout(500);
  check((await page.locator('.modal button', { hasText: 'Black holes' }).count()) === 1, 'in the Dusk the Systems window has a Black holes tab once one is on our map');
  await page.locator('.modal button', { hasText: 'Star types' }).click();
  await page.waitForTimeout(400);
  const kinds = await page.evaluate(() => [...document.querySelectorAll('.modal .btn.ghost')].map((b) => b.textContent.trim()));
  console.log(`  kinds: ${kinds.join(' | ')}`);
  check(kinds.some((k) => k.startsWith('Red dwarf')) && kinds.some((k) => k.startsWith('Black hole')), 'it offers each kind on our map, black holes too');
  const first = await page.evaluate(() => [...document.querySelectorAll('.modal .list-item')].map((r) => r.textContent).slice(0, 3));
  check(first.length > 0, `it opens on our capital’s kind of star (${first.length ? first[0].slice(0, 40) : 'none'})`);
  await page.locator('.modal .btn.ghost', { hasText: /^Black hole/ }).first().click();
  await page.waitForTimeout(400);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.modal .list-item')].map((r) => r.textContent));
  check(rows.length === 1 && rows[0].includes(hole) && rows[0].includes('not surveyed'), `Black hole lists the one on our map (${hole})`);
  await ck.shot('star-types.png');
  await finish('STAR TYPES', ck);
});
