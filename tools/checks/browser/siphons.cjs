// Browser check: the Halo Siphons are shut where the player meets them (11 Oct: "where do i actually
// shut the siphons? … i just can't agree due to the siphons"). While they run, the Unlit's request
// refuses Help (the toast says how) and shows a Shut button under it, as does the Unlit's card. It
// asks first ("Not now" changes nothing), from the keyboard too; shut, the line goes and Help goes
// through, and the card says they are shut. In the magnifier mode the button is there as well.
const { check, start, finish, run } = require('../lib.cjs');

// their request, open, with the siphons researched (the page's own game)
function setUp() {
  const s = window.__stel.state();
  s.civ.techs.push('halo_siphons');
  s.minds.dark.stage = 3;
  s.minds.dark.understanding = 75;
  const arrived = () => s.signals.find((x) => x.kind === 'dark_reveal2' && x.arrivedTurn !== null);
  for (let i = 0; i < 3 && !arrived(); i++) window.__stel.endTurns(1, false);
  s.civ.matter = 1000;
  s.civ.energy = 1000;
  s.pending.length = 0;
  window.__stel.refresh();
  return arrived()?.uid ?? null;
}

run(async () => {
  const ck = await start('siphons', { seed: 1000 });
  const { page } = ck;
  const uid = await page.evaluate(setUp);
  check(!!uid, 'their request has arrived');
  const resolved = () => page.evaluate((u) => window.__stel.state().signals.find((x) => x.uid === u).resolved, uid);
  await page.locator('button[aria-label="Signals: the other minds"]').click();
  await page.waitForTimeout(500);
  const msg = page.locator('.modal .message.open', { hasText: 'They are not dying' });
  check((await msg.count()) === 1, 'it is open under Messages');
  await msg.locator('.btn.choice', { hasText: 'Help gather the Last Star' }).click();
  await page.waitForTimeout(400);
  const toast = await page.locator('.toast', { hasText: 'Shut the Halo Siphons first' }).count();
  check(toast > 0 && (await resolved()) === null, 'Help is refused while the siphons run, the request stays open, and the message says how');
  const line = await msg.locator('.siphons .warn').textContent().catch(() => '');
  const btn = msg.locator('.siphons-shut');
  check(/Our Halo Siphons still run/.test(line) && (await btn.count()) === 1, `under the request: “${line}” and a Shut button`);
  // the card has the same, while they run
  await page.locator('.modal button', { hasText: /^Other minds$/ }).click();
  await page.waitForTimeout(400);
  const card = page.locator('.modal .card', { hasText: 'The Unlit' });
  check((await card.locator('.siphons-shut').count()) === 1 && (await card.locator('.siphons .dim', { hasText: 'the halo empties sooner' }).count()) === 1, 'the Unlit’s card: what the siphons do, and the same button');
  await ck.shot('siphons-card.png');
  await page.locator('.modal button', { hasText: /^Messages/ }).click();
  await page.waitForTimeout(400);
  // it asks first; Not now changes nothing
  await btn.click();
  await page.waitForTimeout(300);
  const ask = await msg.locator('.confirm-heavy').textContent().catch(() => '');
  check(/^Shut the Halo Siphons for good\?/.test(ask), `it asks first (“${ask.slice(0, 60)}…”)`);
  await msg.locator('.siphons-no').click();
  await page.waitForTimeout(300);
  const notYet = await page.evaluate(() => window.__stel.state().civ.flags.siphons_shut === undefined);
  check((await msg.locator('.confirm-heavy').count()) === 0 && notYet, 'Not now: nothing changes');
  // from the keyboard
  await page.keyboard.press('Tab');
  await btn.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  check((await msg.locator('.confirm-heavy').count()) === 1, 'Enter on the button asks too');
  await ck.shot('siphons-ask.png');
  await msg.locator('.siphons-yes').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const shut = await page.evaluate(() => {
    const s = window.__stel.state();
    return s.civ.flags.siphons_shut === s.turn;
  });
  check(shut && (await msg.locator('.siphons').count()) === 0, 'shut for good: the line and the button go');
  await msg.locator('.btn.choice', { hasText: 'Help gather the Last Star' }).click();
  await page.waitForTimeout(400);
  check((await resolved()) === 'help', 'now Help goes through');
  await page.locator('.modal button', { hasText: /^Other minds$/ }).click();
  await page.waitForTimeout(400);
  check((await card.locator('.siphons', { hasText: /shut for good on turn \d+/ }).count()) === 1, 'the card: “Our Halo Siphons: shut for good on turn N.”');
  await ck.shot('siphons-shut.png');
  // the magnifier mode
  const lv = await ck.another(1280, 720);
  await lv.goto(`${process.argv[2] || 'http://localhost:4173/'}?lowvision`, { timeout: 90000, waitUntil: 'domcontentloaded' });
  await lv.waitForFunction(() => !!window.__stel, null, { timeout: 90000 });
  await lv.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await lv.waitForTimeout(1500);
  await lv.evaluate(setUp);
  await lv.locator('button[aria-label="Signals: the other minds"]').click();
  await lv.waitForTimeout(600);
  const lvBtn = lv.locator('.modal .message.open', { hasText: 'They are not dying' }).locator('.siphons-shut');
  check((await lvBtn.count()) === 1 && (await lvBtn.isVisible()), 'in the magnifier mode the Shut button is under the request');
  await lv.screenshot({ path: require('path').join(ck.out, 'siphons-lowvision.png') });
  await finish('SIPHONS UI', ck);
});
