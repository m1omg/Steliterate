// Browser check: the governor (27 Oct, the player: "add a governor like in alpha centauri to set a
// focus on building buildings of a certain category pls", "allow me to mark different worlds in
// system view to set the governor to"). In a system's panel our settlements can be marked (a tick
// box each, and Mark all), and a Governor row sets every marked one at once: each queues an energy
// structure, shows its chip, and no longer counts as idle. A settlement's Build tab has the same
// choice, by the keyboard too; a tick box toggles by Space without opening its world.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('governor', { width: 1400, height: 1000 });
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1200);
  // a second settlement beside the capital, both with nothing queued and nothing chosen: idle
  const sys = await page.evaluate(() => {
    const s = window.__stel.state();
    const cap = s.colonies[s.civ.capitalId];
    const sys = s.systems[cap.systemId];
    const body = sys.bodies.map((id) => s.bodies[id]).find((b) => b && b.kind !== 'deep' && !b.colonyId && !b.dissolved);
    s.colonies.check_gov = { ...structuredClone(cap), id: 'check_gov', name: `${body.name} test`, bodyId: body.id, queue: [] };
    body.colonyId = 'check_gov';
    cap.queue = [];
    delete cap.spare;
    s.civ.matter = 500;
    window.__stel.select('system', sys.id);
    window.__stel.refresh();
    return { id: sys.id, name: sys.name, cap: cap.id };
  });
  await page.waitForTimeout(800);
  const idleChip = () => page.evaluate(() => [...document.querySelectorAll('.todo-chip')].map((x) => x.textContent.trim()).find((t) => /idle settlement/.test(t)) ?? null);
  const idleBefore = await idleChip();
  check(/^2 idle settlements/.test(idleBefore ?? ''), `before: both idle (${idleBefore})`);
  const boxes = page.locator('.drawer .world-mark input');
  check((await boxes.count()) === 2, `the system's Worlds list has a tick box for each of our 2 settlements there (${await boxes.count()})`);
  // Space on a tick box marks it, and leaves the panel on the system
  await boxes.first().focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  const one = await page.evaluate(() => ({ checked: [...document.querySelectorAll('.drawer .world-mark input')].map((x) => x.checked), head: document.querySelector('.drawer .drawer-head h2')?.textContent, bar: document.querySelector('.governor-bar')?.textContent ?? '' }));
  check(one.checked[0] && !one.checked[1] && one.head === sys.name, `Space marks one, the panel still on ${one.head}`);
  check(/1 marked/.test(one.bar) && (await page.locator('.governor-bar .governor-picker .btn').count()) === 10, 'with one marked, the Governor row offers Off and the nine kinds');
  // a click on a tick box does not open its world either; with both marked, Unmark all, then Mark all
  await boxes.nth(1).click();
  await page.waitForTimeout(300);
  const two = await page.evaluate(() => ({ checked: [...document.querySelectorAll('.drawer .world-mark input')].map((x) => x.checked), head: document.querySelector('.drawer .drawer-head h2')?.textContent }));
  check(two.checked.every(Boolean) && two.head === sys.name, `a click marks the other, the panel still on ${two.head}`);
  await page.locator('.governor-bar .btn', { hasText: 'Unmark all' }).click();
  await page.waitForTimeout(300);
  const none = await page.evaluate(() => [...document.querySelectorAll('.drawer .world-mark input')].filter((x) => x.checked).length);
  await page.locator('.governor-bar .btn', { hasText: 'Mark all' }).click();
  await page.waitForTimeout(300);
  const all = await page.evaluate(() => [...document.querySelectorAll('.drawer .world-mark input')].map((x) => x.checked));
  check(none === 0 && all.every(Boolean), 'Unmark all clears them, Mark all marks both');
  await ck.shot('governor-marked.png');
  await page.locator('.governor-bar .governor-picker .btn', { hasText: 'Energy' }).click();
  await page.waitForTimeout(600);
  const after = await page.evaluate((capId) => {
    const s = window.__stel.state();
    return {
      gov: [s.colonies[capId].governor, s.colonies.check_gov.governor],
      queued: [s.colonies[capId].queue[0]?.key ?? null, s.colonies.check_gov.queue[0]?.key ?? null],
      chips: [...document.querySelectorAll('.drawer .governor-chip')].map((x) => x.textContent.trim()),
      marks: [...document.querySelectorAll('.drawer .world-mark input')].filter((x) => x.checked).length,
    };
  }, sys.cap);
  console.log(`  after: ${JSON.stringify(after)}`);
  check(after.gov.every((g) => g === 'energy') && after.queued.every(Boolean), `Energy set on both, and each queued a build at once (${after.queued.join(', ')})`);
  check(after.chips.length === 2 && after.chips.every((t) => /Energy/.test(t)), `each row shows its governor (${after.chips.join(' | ')})`);
  check(after.marks === 0, 'and the marks clear');
  const idleAfter = await idleChip();
  check(!idleAfter, `no longer idle (${idleAfter ?? 'no idle chip'})`);
  await ck.shot('governor-set.png');
  // the settlement's Build tab: the same choice, Energy pressed, a line on what it does; Off by the keyboard
  await page.evaluate((capId) => {
    const s = window.__stel.state();
    window.__stel.select('body', s.colonies[capId].bodyId);
  }, sys.cap);
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^Build/ }).first().click();
  await page.waitForTimeout(600);
  const tab = await page.evaluate(() => {
    const sec = [...document.querySelectorAll('.section')].find((x) => x.querySelector('h3')?.textContent === 'Governor');
    return sec ? { pressed: [...sec.querySelectorAll('.btn[aria-pressed="true"]')].map((b) => b.textContent.trim()), line: sec.querySelector('.governor-line')?.textContent ?? '' } : null;
  });
  console.log(`  Build tab: ${JSON.stringify(tab)}`);
  check(!!tab && tab.pressed.length === 1 && /Energy/.test(tab.pressed[0]) && /governor builds Energy/.test(tab.line), `its Build tab shows the governor, Energy chosen (${tab?.line})`);
  await ck.shot('governor-build-tab.png');
  const off = page.locator('.section .governor-picker .btn', { hasText: /^Off$/ });
  await off.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const gone = await page.evaluate((capId) => window.__stel.state().colonies[capId].governor ?? null, sys.cap);
  check(gone === null, 'Off, by the keyboard, takes the governor back');
  await finish('GOVERNOR', ck);
});
