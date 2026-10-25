// Browser check: a warship's panel offers Choose from list, which opens the Systems window on its
// swarms and civilizations, the nearest first, with the fleet's attack against each; Send there
// gives it the order. Its ships' tips give their attack against swarms and other civilizations.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('warship-list');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(800);
  const ids = await page.evaluate(() => {
    const s = window.__stel.state();
    const home = s.systems[s.civ.homeSystemId];
    const sys = Object.values(s.systems)
      .filter((x) => x.id !== home.id && !Object.values(s.swarms).some((w) => w.systemId === x.id) && !Object.values(s.colonies).some((c) => c.systemId === x.id))
      .sort((a, b) => Math.hypot(a.pos.x - home.pos.x, a.pos.y - home.pos.y, a.pos.z - home.pos.z) - Math.hypot(b.pos.x - home.pos.x, b.pos.y - home.pos.y, b.pos.z - home.pos.z))[0];
    s.swarms.hgx = { id: 'hgx', systemId: sys.id, from: null, to: null, traveled: 0, distance: 0, size: 2, awake: true, tamed: false, appetite: 1 };
    s.fleets.fx = { id: 'fx', owner: s.player, name: 'Spear', ships: [{ cls: 'warden', hp: 10 }, { cls: 'hunter', hp: 12 }], at: home.id, from: null, to: null, traveled: 0, distance: 0, order: 'idle' };
    s.civ.known[sys.id] = 2;
    window.__stel.refresh();
    return { sys: sys.id, name: sys.name };
  });
  await page.evaluate(() => window.__stel.select('fleet', 'fx'));
  await page.waitForTimeout(500);
  const tips = await page.evaluate(() => [...document.querySelectorAll('.drawer .chip')].map((x) => x.getAttribute('data-tip') ?? '').filter((t) => t.includes('Attack')));
  console.log(`  tips: ${tips.map((t) => t.split('\n')[1]).join(' / ')}`);
  check(tips.some((t) => t.includes('Attack 3 against swarms and other civilizations')), 'the Warden’s tip gives its attack against both');
  check(tips.some((t) => t.includes('Attack 6 against swarms, 3 against other civilizations')), 'the Hunter’s tip gives its attack against both');
  const btn = page.locator('.drawer button', { hasText: 'Choose from list' });
  check((await btn.count()) === 1, 'the warship’s panel offers Choose from list');
  await btn.first().click();
  await page.waitForTimeout(600);
  const win = await page.evaluate((name) => {
    const m = document.querySelector('.modal');
    const rows = [...(m?.querySelectorAll('.list-item') ?? [])];
    const row = rows.find((r) => r.textContent.includes(name));
    return { text: m?.textContent ?? '', row: row?.textContent ?? '', send: !!row?.querySelector('.send-here') };
  }, ids.name);
  console.log(`  row: ${win.row}`);
  check(win.text.includes('Swarms and civilizations') && win.text.includes('Where should Spear go?'), 'the Systems window opens on the swarms and civilizations, to send it');
  check(win.text.includes('Spear: attack 9 against swarms, 6 against other civilizations’ ships, 6 against their settlements'), 'it gives the fleet’s attack against each');
  check(win.row.includes('swarm, size 2') && win.send, `the swarm’s star is listed with its size and a Send button (${ids.name})`);
  await ck.shot('warship-list.png');
  await page.locator('.modal .list-item', { hasText: ids.name }).locator('.send-here').click();
  await page.waitForTimeout(600);
  const to = await page.evaluate(() => window.__stel.state().fleets.fx?.to ?? null);
  check(to === ids.sys, 'Send gave it the order');
  await finish('WARSHIP LIST', ck);
});
