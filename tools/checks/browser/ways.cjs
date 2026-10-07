// Browser check: ways that meet. The Choir asks, in Signals, for those of our Echoes who wish to
// join it; letting them go sends them, and the message says what was answered.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('ways', { seed: 1000 });
  const { page } = ck;
  const sv = await page.evaluate(() => {
    window.__stel.endTurns(20);
    const s = window.__stel.state();
    const v = Object.values(s.survivors)[0];
    Object.assign(v, { alive: true, contact: true, way: 'chorus', health: 0.8, disposition: 30, lastSent: -99 });
    delete v.fate;
    delete v.pacts;
    // Echoes enough, with substrate to run on
    const cap = s.colonies[s.civ.capitalId];
    cap.structures.substrate_core = (cap.structures.substrate_core ?? 0) + 2;
    cap.pops.echoes = Math.max(cap.pops.echoes, 6);
    s.pending.length = 0;
    // their wish crosses to us at the speed of light
    for (let i = 0; i < 40 && !s.signals.some((x) => x.kind === 'choir_wish' && x.arrivedTurn !== null); i++) {
      v.health = 0.8;
      v.disposition = 30;
      window.__stel.endTurns(1, false);
    }
    window.__stel.refresh();
    const echoes = Object.values(s.colonies).reduce((a, c) => a + c.pops.echoes, 0);
    return { id: v.id, name: v.name, echoes, asked: s.signals.some((x) => x.kind === 'choir_wish' && x.arrivedTurn !== null) };
  });
  check(sv.asked, `${sv.name} asks for those of our Echoes who wish to come`);
  await page.locator('button[aria-label="Signals: the other minds"]').click();
  await page.waitForTimeout(500);
  const msg = page.locator('.modal .message.open', { hasText: 'would gather some of our Echoes' });
  check((await msg.count()) === 1, 'the message waits in Messages');
  const labels = await msg.locator('.btn.choice > span:first-child').allTextContents();
  check(labels.join(' / ') === 'Let those who wish go / Ask them to stay', `with two answers (${labels.join(' / ')})`);
  await ck.shot('choir-wish.png');
  await msg.locator('.btn.choice', { hasText: 'Let those who wish go' }).click();
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => Object.values(window.__stel.state().colonies).reduce((a, c) => a + c.pops.echoes, 0));
  check(after === sv.echoes - 2, `two Echoes left us for the Choir (${sv.echoes} → ${after})`);
  const answered = await page.locator('.modal .message', { hasText: 'would gather some of our Echoes' }).locator('.faint', { hasText: 'Answered:' }).textContent().catch(() => null);
  check(/Answered: Let those who wish go/.test(answered ?? ''), 'the message says what we answered');
  await finish('WAYS UI', ck);
});
