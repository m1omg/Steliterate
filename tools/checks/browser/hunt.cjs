// Browser check: part of a swarm sent after one of our ships (11 Oct, "swarm never really attacks my
// ship"). The ship's panel says it is coming and what it will do, the swarm's panel says whom it is
// after, and when it strikes, End turn shows a message naming the ship, with Look, not only a line
// in the Record.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('hunt');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1000);
  // a swarm, and a probe stopped at a star near it, with part of the swarm on its way
  const ids = await page.evaluate(() => {
    const s = window.__stel.state();
    const settled = new Set(Object.values(s.colonies).map((c) => c.systemId));
    const free = Object.values(s.systems).filter((x) => !x.gone && !x.special && !settled.has(x.id));
    const ly = (a, b) => Math.hypot(a.phys.x - b.phys.x, a.phys.y - b.phys.y, a.phys.z - b.phys.z);
    for (const a of free) {
      const b = free.find((x) => x.id !== a.id && ly(a, x) <= 25);
      if (!b) continue;
      s.swarms = {};
      s.swarms.nest = { id: 'nest', systemId: a.id, from: null, to: null, traveled: 0, distance: 0, size: 1.5, awake: true, tamed: false, appetite: 1 };
      s.swarms.part = { id: 'part', systemId: null, from: a.id, to: b.id, traveled: 0, distance: ly(a, b), size: 1.6, awake: true, tamed: false, appetite: 1, prey: 'lamp' };
      s.fleets.lamp = { id: 'lamp', name: 'Lamp', ships: [{ cls: 'probe', hp: 2 }], at: b.id, from: null, to: null, traveled: 0, distance: 0, order: 'hold' };
      s.civ.known[a.id] = 2;
      s.civ.known[b.id] = 2;
      s.flags.first_swarm = -1;
      window.__stel.refresh();
      return { a: a.id, b: b.id, aName: a.name };
    }
    return null;
  });
  check(!!ids, 'a swarm, and a star near it for our probe');
  if (!ids) return finish('HUNT', ck);
  await page.evaluate(() => window.__stel.select('fleet', 'lamp'));
  await page.waitForTimeout(600);
  const coming = await page.evaluate(() => document.querySelector('.drawer .drawer-body .warn')?.textContent ?? '');
  check(coming.includes(`Part of the swarm at ${ids.aName} is coming for this ship`) && /under way is safe/.test(coming), `the ship's panel: "${coming.trim()}"`);
  await ck.shot('hunt-coming.png');
  await page.evaluate(() => window.__stel.select('swarm', 'part'));
  await page.waitForTimeout(600);
  const chip = await page.evaluate(() => [...document.querySelectorAll('.drawer .chip')].map((c) => c.textContent.trim()));
  check(chip.includes('after Lamp'), `the swarm's panel says whom it is after (${chip.join(', ')})`);
  // it has arrived: End turn, and it strikes
  await page.evaluate((b) => {
    const s = window.__stel.state();
    Object.assign(s.swarms.part, { systemId: b, from: null, to: null, traveled: 0, distance: 0 });
    window.__stel.select('fleet', 'lamp');
    window.__stel.refresh();
  }, ids.b);
  await page.waitForTimeout(600);
  const here = await page.evaluate(() => document.querySelector('.drawer .drawer-body .warn')?.textContent ?? '');
  check(/came here for this ship\. It strikes each turn the ship stays/.test(here), `there: "${here.trim()}"`);
  await page.evaluate(() => {
    window.__stel.state().pending.length = 0;
    window.__stel.refresh();
  });
  await page.waitForTimeout(300);
  await page.locator('button.endturn').click({ timeout: 8000 });
  await page.waitForTimeout(1200);
  const toasts = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => ({ text: t.textContent, look: !!t.querySelector('button') })));
  const told = toasts.find((t) => /Lamp/.test(t.text) && /(caught|came for)/.test(t.text));
  const alive = await page.evaluate(() => !!window.__stel.state().fleets.lamp);
  check(!!told, `End turn says it struck, naming the ship: "${told?.text ?? toasts.map((t) => t.text).join(' | ')}"`);
  check(!told || told.look === alive, alive ? 'with Look, to go to the ship' : 'with no Look, the ship being gone');
  await ck.shot('hunt-struck.png');
  await finish('HUNT', ck);
});
