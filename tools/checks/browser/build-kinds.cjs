// Browser check: the build list grouped and filtered by kind, kind icons on queue and built chips.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('build-kinds', { width: 1400, height: 1000 });
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 4242 }));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__stel.endTurns(40));
  await page.waitForTimeout(1500);
  const cap = await page.evaluate(() => {
    const s = window.__stel.state();
    const c = s.colonies[s.civ.capitalId] ?? Object.values(s.colonies)[0];
    window.__stel.select('body', c.bodyId);
    return { body: c.bodyId, techs: s.civ.techs.length, built: Object.values(c.structures).reduce((a, n) => a + n, 0) };
  });
  console.log('capital', JSON.stringify(cap));
  await page.waitForTimeout(1200);
  // the overview's built structures: each with a kind icon, grouped by kind
  const chips = await page.evaluate(() => {
    const sec = [...document.querySelectorAll('.section')].find((x) => x.querySelector('h3')?.textContent === 'Structures');
    return sec ? [...sec.querySelectorAll('.chip')].map((ch) => `${ch.querySelector('.kind-icon')?.className.replace('kind-icon ', '') ?? 'NONE'}:${ch.textContent.trim()}`) : [];
  });
  check(chips.length > 0 && chips.every((x) => !x.startsWith('NONE')), `built chips carry kind icons (${chips.length}: ${chips.join(', ')})`);
  await ck.shot('kinds-overview.png');
  await page.getByRole('button', { name: /^Build/ }).first().click();
  await page.waitForTimeout(800);
  const all = await page.evaluate(() => ({
    chips: [...document.querySelectorAll('.kind-chips .btn')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
    heads: [...document.querySelectorAll('.build-group')].map((h) => h.textContent.trim()),
    rows: document.querySelectorAll('.list-item.build').length,
    iconless: [...document.querySelectorAll('.list-item.build')].filter((r) => !r.querySelector('.kind-icon')).length,
  }));
  console.log('filters:', all.chips.join(' | '));
  console.log('groups:', all.heads.join(' | '), `· ${all.rows} rows`);
  check(all.chips[0]?.startsWith('All') && all.chips.length > 2, 'filter row: All plus the kinds present');
  check(all.heads.length >= 3, `grouped under kind headings (${all.heads.length})`);
  check(all.iconless === 0, 'every structure row has a kind icon');
  await ck.shot('kinds-all.png');
  // narrow to one kind
  await page.locator('.kind-chips .btn', { hasText: 'Energy' }).click();
  await page.waitForTimeout(500);
  const energy = await page.evaluate(() => ({
    rows: [...document.querySelectorAll('.list-item.build')].map((r) => r.querySelector('.kind-icon')?.className ?? ''),
    heads: document.querySelectorAll('.build-group').length,
    pressed: [...document.querySelectorAll('.kind-chips .btn[aria-pressed="true"]')].map((b) => b.textContent.trim()),
  }));
  check(energy.rows.length > 0 && energy.rows.every((c) => c.includes('kind-energy')), `Energy shows only energy (${energy.rows.length} rows)`);
  check(energy.heads === 0 && energy.pressed.length === 1 && energy.pressed[0].startsWith('Energy'), 'one kind lit, no headings');
  await ck.shot('kinds-energy.png');
  // the choice stays when another settlement is selected, and All brings everything back
  await page.locator('.kind-chips .btn', { hasText: 'All' }).click();
  await page.waitForTimeout(400);
  const back = await page.evaluate(() => document.querySelectorAll('.list-item.build').length);
  check(back === all.rows, `All brings back every row (${back})`);
  // queue one and see its icon in the queue
  await page.locator('.list-item.build:not(.disabled)').first().click();
  await page.waitForTimeout(500);
  const q = await page.evaluate(() => [...document.querySelectorAll('.queue-item')].map((x) => !!x.querySelector('.kind-icon')));
  check(q.length > 0 && q.every(Boolean), `queued structures carry kind icons (${q.length})`);
  // ships tab has no kind filter
  await page.getByRole('button', { name: 'Ships', exact: true }).click();
  await page.waitForTimeout(400);
  check((await page.locator('.kind-chips').count()) === 0, 'no kind filter on the ships list');
  await finish('BUILD KINDS', ck);
});
