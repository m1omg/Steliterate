
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('focus');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(800);
  const bid = await page.evaluate(() => { const s = window.__stel.state(); return s.colonies[s.civ.capitalId].bodyId; });
  await page.evaluate((id) => window.__stel.select('body', id), bid);
  await page.waitForTimeout(800);
  const btns = await page.evaluate(() => {
    const h = [...document.querySelectorAll('.drawer h3')].find((x) => x.textContent.trim() === 'Focus');
    return [...h.nextElementSibling.querySelectorAll('button')].map((b) => ({ t: b.textContent.trim(), tip: b.dataset.tip }));
  });
  console.log(`  buttons: ${btns.map((b) => b.t).join(', ')}`);
  const m = btns.find((b) => b.t === 'Matter');
  check(btns.length === 6 && m, `six focus buttons, Matter tip: ${m?.tip}`);
  await page.evaluate(() => { const h = [...document.querySelectorAll('.drawer h3')].find((x) => x.textContent.trim() === 'Focus'); [...h.nextElementSibling.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Matter').click(); });
  await page.waitForTimeout(400);
  const f = await page.evaluate(() => { const s = window.__stel.state(); return s.colonies[s.civ.capitalId].focus; });
  check(f === 'matter', `clicking it sets the focus (${f})`);
  await page.evaluate(() => { const h = [...document.querySelectorAll('.drawer h3')].find((x) => x.textContent.trim() === 'Focus'); h.scrollIntoView(); });
  await page.waitForTimeout(300);
  await ck.shot('focus.png', { clip: { x: 900, y: 60, width: 500, height: 760 } });
  await finish('FOCUS UI', ck);
});
