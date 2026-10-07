// Browser check: refuge. A dying partner asks to come to us; Signals shows the request with what
// it means; once we take them in their card says they are coming; when they arrive their fate is
// saved, and they tell us so.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('refuge', { seed: 1000 });
  const { page } = ck;
  // a partner in Mutual Aid, dying
  const sv = await page.evaluate(() => {
    window.__stel.endTurns(20);
    const s = window.__stel.state();
    const v = Object.values(s.survivors)[0];
    Object.assign(v, { alive: true, contact: true, health: 0.15, disposition: 30, pop: 24, lastSent: -99, pacts: { aid: s.turn } });
    delete v.fate;
    delete v.exodus;
    delete v.exodusAsked;
    s.pending.length = 0;
    // their request crosses to us (early in the Dusk a turn is only thousands of years, so the
    // light takes a few turns), and we play on without answering
    for (let i = 0; i < 40 && !s.signals.some((x) => x.kind === 'exodus' && x.arrivedTurn !== null); i++) {
      v.health = 0.15;
      window.__stel.endTurns(1, false);
    }
    window.__stel.refresh();
    return { id: v.id, name: v.name, asked: v.exodusAsked !== undefined };
  });
  check(sv.asked, `${sv.name}, dying, asks to come to us`);
  await page.locator('button[aria-label="Signals: the other minds"]').click();
  await page.waitForTimeout(500);
  const msg = page.locator('.modal .message.open', { hasText: 'asks to come to us' });
  check((await msg.count()) === 1, 'their request waits in Messages');
  const take = msg.locator('.btn.choice', { hasText: 'Take them in' });
  const hint = (await take.locator('.h').textContent().catch(() => '')) ?? '';
  check(/^They set out when our answer reaches them and arrive in .+: 8 of them, with their archive\. They live where we have room/.test(hint), `Take them in says when and how (${hint.slice(0, 110)})`);
  await ck.shot('refuge-asks.png');
  await take.click();
  await page.waitForTimeout(400);
  await page.locator('.modal button', { hasText: /^Survivors$/ }).click();
  await page.waitForTimeout(400);
  const card = page.locator('.modal .card', { hasText: sv.name });
  const coming = await card.evaluate((el) => {
    const dt = [...el.querySelectorAll('dt')].find((x) => x.textContent.trim() === 'Coming to us');
    return dt ? dt.nextElementSibling.textContent.trim() : null;
  });
  check(/^8 of them, (here in .+|arriving)$/.test(coming ?? ''), `their card says they are coming (${coming})`);
  await ck.shot('refuge-coming.png');
  // they arrive
  const after = await page.evaluate((id) => {
    const s = window.__stel.state();
    // our answer crosses to them, and their ships cross back at a fiftieth of the speed of light
    for (let i = 0; i < 60 && s.survivors[id].alive; i++) window.__stel.endTurns(1, false);
    window.__stel.refresh();
    const v = s.survivors[id];
    return { fate: v.fate ?? null, alive: v.alive, said: s.signals.some((x) => x.kind === 'arrived' && x.from === id) };
  }, sv.id);
  check(!after.alive && after.fate === 'saved' && after.said, `they arrive: saved, and they tell us (${JSON.stringify(after)})`);
  await page.waitForTimeout(400);
  const gone = await card.locator('.dim', { hasText: 'They made it' }).count();
  check(gone === 1, 'their card: “They made it, with our help.”');
  await ck.shot('refuge-saved.png');
  await finish('REFUGE UI', ck);
});
