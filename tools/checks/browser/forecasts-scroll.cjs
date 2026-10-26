// Browser check: every forecast not closed is in its list, which scrolls (26 Oct, the player:
// "forecasts should also be scrollable"; three showed, and on a shorter screen one or two, with
// the rest out of reach). Ten forecasts: all ten are there, about three in view, and the last can be
// scrolled to; on a shorter screen too; on a phone, in the open sheet, all of them with no list's
// own limit.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('forecasts-scroll');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(800);
  const put = () =>
    page.evaluate(() => {
      const s = window.__stel.state();
      s.civ.forecasts = Array.from({ length: 10 }, (_, i) => ({ uid: `fx${i}`, kind: 'test', title: `Forecast ${i + 1}`, text: `The forecast numbered ${i + 1}.`, dueYears: s.years + (i + 1) * 1e9, severity: i % 3 ? 'warn' : 'danger' }));
      for (const k of Object.keys(s.civ.flags)) if (k.startsWith('fcd:')) delete s.civ.flags[k];
      window.__stel.refresh();
    });
  await put();
  await page.waitForTimeout(400);
  const measure = () =>
    page.evaluate(() => {
      const l = document.querySelector('.forecast-list');
      if (!l) return null;
      const r = l.getBoundingClientRect();
      const cards = [...l.querySelectorAll('.forecast')];
      const inView = cards.filter((c) => {
        const b = c.getBoundingClientRect();
        return b.top >= r.top - 1 && b.bottom <= r.bottom + 1;
      }).length;
      l.scrollTop = l.scrollHeight;
      const last = cards[cards.length - 1]?.getBoundingClientRect();
      const reached = !!last && last.bottom <= l.getBoundingClientRect().bottom + 1;
      l.scrollTop = 0;
      return { cards: cards.length, inView, scrolls: l.scrollHeight > l.clientHeight + 1, reached, overflow: getComputedStyle(l).overflowY };
    });
  let m = await measure();
  console.log(`  1400×900: ${JSON.stringify(m)}`);
  check(m?.cards === 10, `all ten forecasts are in the list (${m?.cards})`);
  check(!!m && m.inView >= 2 && m.inView <= 3 && m.scrolls && m.reached, `about three in view, and it scrolls to the last (${m?.inView} in view)`);
  await ck.shot('forecasts.png');
  await page.setViewportSize({ width: 1400, height: 760 });
  await page.waitForTimeout(500);
  m = await measure();
  console.log(`  1400×760: ${JSON.stringify(m)}`);
  check(!!m && m.cards === 10 && m.inView >= 1 && m.scrolls && m.reached, `a shorter screen: still all ten, scrolling (${m?.inView} in view)`);
  // a phone: the forecasts hang in the sheet under the top bar, opened by its turn line
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelector('.chrono-line')?.click());
  await page.waitForTimeout(500);
  m = await measure();
  console.log(`  390×844, open: ${JSON.stringify(m)}`);
  check(!!m && m.cards === 10 && m.overflow === 'visible', 'on a phone, all ten in the open sheet, which scrolls them itself');
  await finish('FORECASTS SCROLL', ck);
});
