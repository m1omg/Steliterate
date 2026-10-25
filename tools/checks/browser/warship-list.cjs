// Browser check: a warship's panel offers Choose from list, which opens the Systems window on its
// swarms and civilizations, the nearest first, with the fleet's attack against each; Send there
// gives it the order. Its ships' tips give their attack against swarms and other civilizations. A
// star where a civilization asked us for warships heads the list, under Asked for help.
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
    // a civilization at peace with us asks for warships against a swarm at its first star
    const sv = Object.values(s.survivors).find((x) => x.alive && !x.war && x.homeSystemId !== sys.id);
    sv.contact = true;
    const plea = s.systems[sv.homeSystemId];
    s.civ.signals.push({ uid: 'sgx', from: sv.id, kind: 'swarm_plea', sentYears: s.years, arriveYears: s.years, arrivedTurn: s.turn, title: `${sv.name} asks for help against the Hunger`, text: '', data: { systemId: plea.id }, choices: [{ id: 'promise', label: 'We will send warships' }, { id: 'refuse', label: 'We cannot' }], resolved: null });
    window.__stel.refresh();
    return { sys: sys.id, name: sys.name, plea: plea.name, civ: sv.name };
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
  const asked = await page.evaluate(() => {
    const sec = [...document.querySelectorAll('.modal .section')].find((x) => x.querySelector('h3')?.textContent === 'Asked for help');
    return sec ? [...sec.querySelectorAll('.list-item')].map((r) => r.textContent) : null;
  });
  console.log(`  asked for help: ${JSON.stringify(asked)}`);
  check(!!asked && asked.length === 1 && asked[0].includes(ids.plea) && asked[0].includes('asks for help') && asked[0].includes(ids.civ), `the star where ${ids.civ} asked for help heads the list (${ids.plea})`);
  // we promise warships: it stays at the head, with the turns we have to keep our word
  await page.evaluate(() => {
    const s = window.__stel.state();
    const sig = s.civ.signals.find((x) => x.uid === 'sgx');
    sig.resolved = 'promise';
    s.survivors[sig.from].promised = { systemId: String(sig.data.systemId), turn: s.turn - 3 };
    window.__stel.refresh();
  });
  await page.waitForTimeout(300);
  const promised = await page.evaluate(() => [...document.querySelectorAll('.modal .section')].find((x) => x.querySelector('h3')?.textContent === 'Asked for help')?.textContent ?? '');
  check(promised.includes(ids.plea) && promised.includes('help promised · 7 turns left'), 'a promise keeps it there, with the turns left to keep it');
  await ck.shot('warship-list.png');
  await page.locator('.modal .list-item', { hasText: ids.name }).locator('.send-here').click();
  await page.waitForTimeout(600);
  const to = await page.evaluate(() => window.__stel.state().fleets.fx?.to ?? null);
  check(to === ids.sys, 'Send gave it the order');
  await finish('WARSHIP LIST', ck);
});
