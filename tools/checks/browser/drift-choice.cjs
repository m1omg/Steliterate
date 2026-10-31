// Browser check: the black hole a leptonic settlement drifts to is the player's choice (31 Oct, the
// player: "let me choose the hole but with recommendations and spin/lifetime statistics"). Its panel
// lists every hole it could go to, the game's own choice first and marked, each with its spin, how
// long it lasts and how far; another is chosen by a click or by the keyboard, and the settlement
// drifts there once asked twice.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('drift-choice', { width: 1400, height: 1000 });
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const s = window.__stel.state();
    const c = s.colonies[s.civ.capitalId];
    c.form = 'leptonic';
    s.civ.energy = 400;
    window.__stel.select('body', c.bodyId);
    window.__stel.refresh();
  });
  await page.waitForTimeout(1000);
  const rows = () =>
    page.evaluate(() => {
      const sec = document.querySelector('.drawer .section.drift');
      return {
        rows: [...(sec?.querySelectorAll('.drift-choices .list-item') ?? [])].map((r) => ({ name: r.querySelector('.grow')?.firstChild?.textContent?.trim(), on: r.getAttribute('aria-pressed') === 'true', chips: [...r.querySelectorAll('.chip')].map((x) => x.textContent.trim()), stats: r.querySelector('.mono')?.textContent ?? '' })),
        button: sec?.querySelector('.btn')?.textContent.trim() ?? null,
      };
    });
  const a = await rows();
  console.log(`  ${a.rows.length} holes: ${a.rows.slice(0, 4).map((r) => `${r.name} [${r.chips.join(', ')}] ${r.stats}`).join(' | ')}`);
  check(a.rows.length > 1 && a.rows[0].chips.includes('recommended') && a.rows.filter((r) => r.chips.includes('recommended')).length === 1, `every hole it could go to, the game's own choice first and marked (${a.rows.length})`);
  check(a.rows.every((r) => /^spin [\d.,]+k? · lasts \S.* · \S/.test(r.stats) && !/Infinity|NaN/.test(r.stats)), `each with its spin, how long it lasts and how far (${a.rows[0].stats})`);
  check(a.rows[0].on && a.button === `Drift to ${a.rows[0].name}`, `the recommended one is chosen to begin with (${a.button})`);
  await page.locator('.drawer .section.drift').scrollIntoViewIfNeeded();
  await ck.shot('drift-choice.png');
  // another, by a click
  await page.locator('.drawer .drift-choices .list-item').nth(1).click();
  await page.waitForTimeout(300);
  const b = await rows();
  check(b.rows[1].on && !b.rows[0].on && b.button === `Drift to ${b.rows[1].name}`, `a click chooses another (${b.button})`);
  // and back to the first by the keyboard
  await page.locator('.drawer .drift-choices .list-item').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const k = await rows();
  check(k.rows[0].on && k.button === `Drift to ${k.rows[0].name}`, 'Enter chooses one too');
  // the second, then drift: asked twice
  await page.locator('.drawer .drift-choices .list-item').nth(1).click();
  await page.waitForTimeout(300);
  const btn = page.locator('.drawer .section.drift .btn');
  await btn.click();
  await page.waitForTimeout(200);
  const asked = (await btn.textContent()).trim();
  await btn.click();
  await page.waitForTimeout(600);
  const at = await page.evaluate(() => {
    const s = window.__stel.state();
    return s.systems[s.colonies[s.civ.capitalId].systemId].name;
  });
  check(/^Really drift to /.test(asked) && at === b.rows[1].name, `asked once more, it drifts to the one chosen (${at})`);
  await finish('DRIFT CHOICE', ck);
});
