// Browser check: war. Declare war asks first, then the card shows the war and the siege; Seize
// waits for the siege; held long enough, Seize asks, and with strength enough their star is ours.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('war', { seed: 1000 });
  const { page } = ck;
  const sv = await page.evaluate(() => {
    window.__stel.endTurns(30);
    const s = window.__stel.state();
    const v = Object.values(s.survivors)[0];
    Object.assign(v, { alive: true, contact: true, health: 0.8, pop: 6, disposition: -30 });
    delete v.fate;
    s.civ.accord = 200;
    s.pending.length = 0;
    window.__stel.refresh();
    return { id: v.id, name: v.name, home: v.homeSystemId };
  });
  await page.locator('button[aria-label="Signals: the other minds"]').click();
  await page.waitForTimeout(500);
  await page.locator('.modal button', { hasText: /^Survivors$/ }).click();
  await page.waitForTimeout(400);
  const card = page.locator('.modal .card', { hasText: sv.name });
  const tip = await card.locator('button', { hasText: /^Declare war$/ }).getAttribute('data-tip');
  check(/The Threads must consent \(60 accord\); resolve −5, dissent \+8, every Thread’s standing −3\. Our pacts with them end\./.test(tip ?? ''), `Declare war says what it costs (${tip?.slice(0, 80)})`);
  await card.locator('button', { hasText: /^Declare war$/ }).click();
  await page.waitForTimeout(300);
  await card.locator('.confirm-heavy button', { hasText: 'Declare war' }).click();
  await page.waitForTimeout(400);
  const row = (label) =>
    card.evaluate((el, label) => {
      const dt = [...el.querySelectorAll('dt')].find((x) => x.textContent.trim() === label);
      return dt ? dt.nextElementSibling.textContent.trim() : null;
    }, label);
  const war = await row('War');
  check(/^since turn \d+ · siege 0\/3 · their strength \d+$/.test(war ?? ''), `at war: the card shows it (${war})`);
  const seize = card.locator('button', { hasText: /^Seize$/ });
  check((await seize.getAttribute('class')).includes('disabled') && /^You need warships at their first star\./.test((await seize.getAttribute('data-tip')) ?? ''), 'Seize waits for a siege');
  await ck.shot('war-declared.png');
  // warships at their first star, held three turns
  await page.evaluate((home) => {
    const s = window.__stel.state();
    const f = Object.values(s.fleets).find((x) => x.ships.some((y) => y.cls === 'warden')) ?? Object.values(s.fleets)[0];
    f.ships = Array(8).fill(0).map(() => ({ cls: 'warden', hp: 10 }));
    f.at = home;
    f.to = null;
    f.from = null;
    f.order = 'idle';
    for (let i = 0; i < 3; i++) window.__stel.endTurns(1, false);
    window.__stel.refresh();
  }, sv.home);
  await page.waitForTimeout(500);
  const sieged = await row('War');
  check(/siege 3\/3/.test(sieged ?? ''), `three turns of siege (${sieged})`);
  check(!(await seize.getAttribute('class')).includes('disabled'), 'now Seize can be tried');
  await seize.click();
  await page.waitForTimeout(300);
  const ask = await card.locator('.confirm-heavy').textContent().catch(() => null);
  check(/^Take .* star by force\?/.test(ask ?? ''), 'Seize asks first');
  await card.locator('.confirm-heavy button', { hasText: 'Seize their star' }).click();
  await page.waitForTimeout(500);
  const after = await page.evaluate((id) => window.__stel.state().survivors[id].fate ?? null, sv.id);
  check(after === 'seized', `with strength enough, their star is ours (${after})`);
  check((await card.locator('.dim', { hasText: 'We took their star.' }).count()) === 1, 'their card: “We took their star.”');
  await ck.shot('war-seized.png');
  await finish('WAR UI', ck);
});
