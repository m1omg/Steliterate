// Browser check: Signals shows our clock at the top (the span from our minds' rhythm to our turn's),
// and a civilization too slow for us says so, and how to reach it; slowing the pace brings it in
// reach, and the card says so. (The hint's arithmetic is checked in unit/clocks.)
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('clocks', { seed: 1000 });
  const { page } = ck;
  const sv = await page.evaluate(() => {
    // (on turn 1 a turn is 40 years, as long as a Kin thought: a few turns on, it is longer)
    window.__stel.endTurns(8);
    const s = window.__stel.state();
    const v = Object.values(s.survivors)[0];
    v.alive = true;
    delete v.fate;
    v.contact = true;
    v.health = Math.max(v.health, 0.6);
    // four tenfolds slower than our turns at the Tide
    v.clock = Math.log10(s.turnLength) + 4;
    s.civ.pace = 0;
    s.pending.length = 0;
    window.__stel.refresh();
    return { id: v.id, name: v.name };
  });
  const open = async () => {
    await page.locator('button[aria-label="Signals: the other minds"]').click();
    await page.waitForTimeout(500);
    await page.locator('.modal button', { hasText: /^Survivors$/ }).click();
    await page.waitForTimeout(400);
  };
  await open();
  const ours = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.modal .card')].find((x) => x.textContent.includes('Our clock'));
    return c ? c.textContent.replace(/\s+/g, ' ').trim() : null;
  });
  console.log(`  ${ours}`);
  check(!!ours && /Our clock/.test(ours) && /Kin think at/.test(ours) && / to /.test(ours), 'Signals shows our clock: from how fast our Kin think to how long a turn is');
  const clockRow = async () =>
    page.evaluate((name) => {
      const card = [...document.querySelectorAll('.modal .card')].find((x) => x.textContent.includes(name));
      const dt = card && [...card.querySelectorAll('dt')].find((x) => x.textContent.trim() === 'Clock');
      return dt ? { text: dt.nextElementSibling.textContent.trim(), tip: dt.nextElementSibling.getAttribute('data-tip') } : null;
    }, sv.name);
  const r0 = await clockRow();
  console.log(`  at the Tide: "${r0?.text}" (${r0?.tip})`);
  check(/too slow for us/.test(r0?.text ?? '') && /at Slow ×10 we could talk with them/.test(r0?.tip ?? ''), 'a civilization four tenfolds slower: too slow for us, and the tip names the pace that reaches it, Slow ×10');
  await ck.shot('clocks-tide.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__stel.state().civ.pace = -1;
    window.__stel.refresh();
  });
  await open();
  const r1 = await clockRow();
  console.log(`  at Slow ×10: "${r1?.text}"`);
  check(/in reach/.test(r1?.text ?? ''), 'at Slow ×10 it is in reach');
  await finish('CLOCKS UI', ck);
});
