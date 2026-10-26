// Browser check: Our settlements sorts by the yield whose icon is clicked (26 Oct, the player: "make
// player systems sortable by the economic aspect the player clicks on, like in civilization"):
// each system by its settlements' total, shown beside its name, and its settlements by their own,
// most first; again, least first; a third time, as founded. On a phone the icons stay, over the
// rows' columns.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('settlement-sort', { seed: 1000 });
  const { page } = ck;
  const systems = await page.evaluate(() => {
    let n = 0;
    for (let i = 0; i < 12; i++) {
      const s = window.__stel.state();
      n = new Set(Object.values(s.colonies).filter((c) => (c.owner ?? s.player) === s.player).map((c) => c.systemId)).size;
      if (n >= 3) break;
      window.__stel.endTurns(10);
    }
    window.__stel.refresh();
    return n;
  });
  console.log(`  our settlements in ${systems} systems`);
  check(systems >= 2, `the autoplayer settled more than one system (${systems})`);
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await page.waitForTimeout(600);
  const num = (t) => Number((t ?? '').replace(/[^\d.−+-]/g, '').replace('−', '-')) || 0;
  const read = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.modal .section')]
        .filter((x) => x.querySelector('.settlement-row'))
        .map((x) => ({
          name: x.querySelector('h3 .grow')?.firstChild?.textContent?.trim() ?? '',
          sum: x.querySelector('h3 .sys-sum')?.textContent ?? null,
          matter: [...x.querySelectorAll('.settlement-row')].map((r) => r.querySelectorAll('.yield-cells > span')[1]?.textContent ?? ''),
        })),
    );
  const founded = await read();
  console.log(`  as founded: ${founded.map((g) => g.name).join(', ')}`);
  check(founded.length >= 2 && founded.every((g) => g.sum === null), 'as founded, with no totals');
  const sortBtn = page.locator('.modal .yield-heads button[aria-label="Sort by Matter"]');
  await sortBtn.click();
  await page.waitForTimeout(300);
  let g = await read();
  const sums = g.map((x) => num(x.sum));
  console.log(`  most first: ${g.map((x) => `${x.name} ${x.sum}`).join(', ')}`);
  check(g.every((x) => x.sum !== null) && sums.every((v, i) => i === 0 || v <= sums[i - 1] + 1e-9), 'Matter: the systems by their total, most first, each total beside its name');
  check(g.every((x) => x.matter.map(num).every((v, i, a) => i === 0 || v <= a[i - 1] + 1e-9)), 'and each system’s settlements by their own');
  const label = await page.locator('.modal .yield-heads .grow').textContent();
  check(/by matter, most first/.test(label ?? ''), `the head says so (${label})`);
  check((await sortBtn.getAttribute('aria-pressed')) === 'true', 'the Matter icon is pressed');
  await sortBtn.click();
  await page.waitForTimeout(300);
  g = await read();
  const up = g.map((x) => num(x.sum));
  check(up.every((v, i) => i === 0 || v >= up[i - 1] - 1e-9), `again: least first (${g.map((x) => x.sum).join(', ')})`);
  await sortBtn.click();
  await page.waitForTimeout(300);
  g = await read();
  check(g.map((x) => x.name).join('|') === founded.map((x) => x.name).join('|') && g.every((x) => x.sum === null), 'a third time: as founded');
  await ck.shot('settlement-sort.png');
  // a phone: the icons stay, over the rows' columns
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  const shown = await page.evaluate(() => {
    const h = document.querySelector('.modal .yield-heads');
    return !!h && h.getBoundingClientRect().height > 0 && getComputedStyle(h).display !== 'none';
  });
  check(shown, 'on a phone the icons are there');
  await page.locator('.modal .yield-heads button[aria-label="Sort by Industry"]').click();
  await page.waitForTimeout(300);
  check(/by industry, most first/.test((await page.locator('.modal .yield-heads .grow').textContent()) ?? ''), 'and sort the list');
  await ck.shot('settlement-sort-phone.png');
  await finish('SETTLEMENT SORT', ck);
});
