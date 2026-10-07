// Browser check: living neighbours, phase 0. In Signals, Send says how long the beam takes to reach
// them; once sent, their card shows the energy on its way; Seize asks first, and Not now changes
// nothing.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('neighbours', { seed: 1000 });
  const { page } = ck;
  const sv = await page.evaluate(() => {
    window.__stel.endTurns(20);
    const s = window.__stel.state();
    const v = Object.values(s.survivors)[0];
    v.alive = true;
    delete v.fate;
    v.contact = true;
    v.health = Math.max(v.health, 0.6);
    s.civ.energy = 500;
    s.pending.length = 0;
    window.__stel.refresh();
    return { id: v.id, name: v.name };
  });
  await page.locator('button[aria-label="Signals: the other minds"]').click();
  await page.waitForTimeout(500);
  await page.locator('.modal button', { hasText: /^Survivors$/ }).click();
  await page.waitForTimeout(400);
  const card = page.locator('.modal .card', { hasText: sv.name });
  check((await card.count()) === 1, `${sv.name} has a card`);
  const send = card.locator('button', { hasText: 'Send 25 energy' });
  const tip = await send.getAttribute('data-tip');
  check(/^Beam 25 energy to them\. It crosses .* at the speed of light and reaches them in .*\./.test(tip ?? ''), `Send says how long the beam takes (${tip})`);
  await send.click();
  await page.waitForTimeout(400);
  const row = await card.evaluate((el) => {
    const dt = [...el.querySelectorAll('dt')].find((x) => x.textContent.trim() === 'On its way');
    return dt ? dt.nextElementSibling.textContent.trim() : null;
  });
  check(/^25 energy, there in .+/.test(row ?? ''), `the card shows it on its way (${row})`);
  const energy = await page.evaluate(() => window.__stel.state().civ.energy);
  check(energy === 475, `and it left our reserve at once (${energy})`);
  await card.locator('button', { hasText: /^Seize$/ }).click();
  await page.waitForTimeout(300);
  const ask = await card.locator('.confirm-heavy').textContent().catch(() => null);
  check(/^Take .* star by force\?/.test(ask ?? ''), `Seize asks first (${ask?.slice(0, 60)})`);
  await ck.shot('seize-asks.png');
  await card.locator('.confirm-heavy button', { hasText: 'Not now' }).click();
  await page.waitForTimeout(300);
  const after = await page.evaluate((id) => ({ alive: window.__stel.state().survivors[id].alive, bar: !!document.querySelector('.confirm-heavy') }), sv.id);
  check(after.alive && !after.bar, 'Not now changes nothing');
  await finish('NEIGHBOURS UI', ck);
});
