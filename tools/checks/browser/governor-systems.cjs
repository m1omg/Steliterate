// Browser check: the governor from the Systems window (31 Oct, the player: "Please add a
// governor-setter into the Systems menu"). In Our settlements each settlement has a tick box, each
// system one at its name that marks all of ours there, and Mark all marks every one; a Governor row
// then sets every marked one at once, and the marks clear. A tick box does not open its
// settlement, and Space toggles it from the keyboard.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('governor-systems', { width: 1400, height: 1000 });
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1200);
  // beside the capital a second settlement, and a third at another star: all with nothing queued
  const ids = await page.evaluate(() => {
    const s = window.__stel.state();
    const cap = s.colonies[s.civ.capitalId];
    const free = (sys) => sys.bodies.map((id) => s.bodies[id]).find((b) => b && b.kind !== 'deep' && !b.colonyId && !b.dissolved);
    const home = s.systems[cap.systemId];
    const other = Object.values(s.systems).find((x) => x.id !== home.id && !x.gone && free(x));
    const add = (id, sys) => {
      const b = free(sys);
      s.colonies[id] = { ...structuredClone(cap), id, name: `${b.name} test`, bodyId: b.id, systemId: sys.id, queue: [] };
      b.colonyId = id;
      s.civ.known[sys.id] = 2;
    };
    add('gov_a', home);
    add('gov_b', other);
    cap.queue = [];
    delete cap.spare;
    s.civ.matter = 500;
    window.__stel.refresh();
    return { cap: cap.id, home: home.name, other: other.name };
  });
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await page.waitForTimeout(700);
  const read = () =>
    page.evaluate(() => ({
      rows: [...document.querySelectorAll('.modal .settlement-row .world-mark input')].map((x) => x.checked),
      heads: [...document.querySelectorAll('.modal .section h3 .world-mark input')].map((x) => x.checked),
      bar: document.querySelector('.modal .settlements-governor')?.textContent ?? '',
      kinds: document.querySelectorAll('.modal .settlements-governor .governor-picker .btn').length,
      open: !!document.querySelector('.modal'),
    }));
  const first = await read();
  check(first.rows.length === 3 && first.heads.length === 2 && first.rows.every((x) => !x) && /Mark settlements to give them a governor/.test(first.bar) && first.kinds === 0, `Our settlements: a tick box for each of 3 settlements and each of 2 systems, none marked, no Governor row yet (${first.rows.length}, ${first.heads.length})`);
  // the box at a system's name marks all of ours there
  const homeHead = page.locator('.modal .section', { hasText: ids.home }).locator('h3 .world-mark input');
  await homeHead.click();
  await page.waitForTimeout(300);
  const two = await read();
  check(two.open && two.rows.filter(Boolean).length === 2 && /2 marked/.test(two.bar) && two.kinds === 10, `the box at ${ids.home} marks both there, and the Governor row offers Off and the nine kinds (${two.bar.slice(0, 40)})`);
  // Space on a settlement's box at the other star marks it, and the window stays
  const otherBox = page.locator('.modal .section', { hasText: ids.other }).locator('.settlement-row .world-mark input');
  await otherBox.focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  const three = await read();
  check(three.open && three.rows.every(Boolean) && three.heads.every(Boolean) && /3 marked/.test(three.bar), `Space marks the one at ${ids.other}, the window still open (${three.bar.slice(0, 20)})`);
  // Unmark all and Mark all
  await page.locator('.modal .settlements-governor .mark-all').click();
  await page.waitForTimeout(300);
  const none = await read();
  await page.locator('.modal .settlements-governor .mark-all').click();
  await page.waitForTimeout(300);
  const all = await read();
  check(none.rows.every((x) => !x) && all.rows.every(Boolean), 'Unmark all clears them, Mark all marks all three');
  await ck.shot('governor-systems-marked.png');
  await page.locator('.modal .settlements-governor .governor-picker .btn', { hasText: 'Energy' }).click();
  await page.waitForTimeout(700);
  const after = await page.evaluate((cap) => {
    const s = window.__stel.state();
    return {
      gov: [cap, 'gov_a', 'gov_b'].map((id) => s.colonies[id].governor ?? null),
      queued: [cap, 'gov_a', 'gov_b'].map((id) => s.colonies[id].queue.length),
      lines: [...document.querySelectorAll('.modal .settlement-row')].map((r) => r.textContent),
    };
  }, ids.cap);
  const done = await read();
  check(after.gov.every((g) => g === 'energy'), `Energy sets all three governors (${after.gov.join(', ')})`);
  check(after.queued.every((n) => n >= 1) && after.lines.every((t) => /governor: Energy/.test(t)), `each queued an energy structure, and its row says so (${after.queued.join(', ')})`);
  check(done.rows.every((x) => !x) && done.kinds === 0, 'and the marks clear');
  // Off, from here too
  await page.locator('.modal .section', { hasText: ids.other }).locator('.settlement-row .world-mark input').click();
  await page.waitForTimeout(300);
  await page.locator('.modal .settlements-governor .governor-picker .btn', { hasText: 'Off' }).click();
  await page.waitForTimeout(500);
  const off = await page.evaluate(() => {
    const s = window.__stel.state();
    return [s.colonies.gov_a.governor ?? null, s.colonies.gov_b.governor ?? null];
  });
  check(off[0] === 'energy' && off[1] === null, `Off turns off only the one marked (${off.join(', ')})`);
  await ck.shot('governor-systems.png');
  await finish('GOVERNOR SYSTEMS', ck);
});
