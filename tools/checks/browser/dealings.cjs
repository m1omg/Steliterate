// Browser check: a trade offer says what it asks and what it gives; taking it, they remember it,
// and their card's Toward us says so.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('dealings', { seed: 1000 });
  const { page } = ck;
  const sv = await page.evaluate(() => {
    window.__stel.endTurns(30);
    const s = window.__stel.state();
    const v = Object.values(s.survivors)[0];
    Object.assign(v, { alive: true, contact: true, way: 'upload', health: 0.8, disposition: 10, lastSent: -99 });
    delete v.fate;
    delete v.pacts;
    s.civ.flags[`trade_next_${v.id}`] = 0;
    s.civ.energy = 200;
    s.pending.length = 0;
    // their offer crosses to us at the speed of light
    for (let i = 0; i < 60 && !s.signals.some((x) => x.kind === 'trade' && x.from === v.id && x.arrivedTurn !== null); i++) {
      v.health = 0.8;
      v.disposition = 10;
      window.__stel.endTurns(1, false);
      s.civ.energy = Math.max(s.civ.energy, 200);
    }
    window.__stel.refresh();
    return { id: v.id, name: v.name };
  });
  await page.locator('button[aria-label="Signals: the other minds"]').click();
  await page.waitForTimeout(500);
  const msg = page.locator('.modal .message.open', { hasText: 'offers a trade' });
  check((await msg.count()) >= 1, 'their offer waits in Messages');
  const text = (await msg.first().locator('.flavor').textContent()) ?? '';
  check(/^We have notes on .+ we cannot use, and we need energy\. \d+ energy for \d+ insight\?$/.test(text), `it says what it asks and gives: "${text}"`);
  const take = msg.first().locator('.btn.choice').first();
  const label = (await take.locator('span').first().textContent()) ?? '';
  const hint = (await take.locator('.h').textContent()) ?? '';
  check(/^Trade \d+ energy$/.test(label) && /^\d+ insight: their notes on .+\.$/.test(hint), `and so does the choice (${label}: ${hint})`);
  await ck.shot('trade-offer.png');
  await take.click();
  await page.waitForTimeout(400);
  await page.locator('.modal button', { hasText: /^Survivors$/ }).click();
  await page.waitForTimeout(400);
  const card = page.locator('.modal .card', { hasText: sv.name });
  const why = await card.evaluate((el) => {
    const dt = [...el.querySelectorAll('dt')].find((x) => x.textContent.trim() === 'Toward us');
    return dt ? dt.nextElementSibling.dataset.tip ?? '' : '';
  });
  check(/you traded with us \(\+3\)/.test(why), `Toward us says why they feel as they do (${why.split('\n')[0]})`);
  await finish('DEALINGS UI', ck);
});
