
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('accord');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(800);
  await page.evaluate(() => { const s = window.__stel.state(); s.civ.accord = 200; s.civ.resolve = 40; s.civ.dissent = 20; window.__stel.refresh(); });
  await page.getByRole('button', { name: /^Threads/ }).first().click();
  await page.waitForTimeout(800);
  const btns = () => page.evaluate(() => [...document.querySelectorAll('.modal button.btn.small')].map((b) => ({ t: b.textContent.trim(), dis: b.disabled })).filter((b) => /Rally|Calm|Hear/.test(b.t)));
  const a = await btns();
  console.log(`  ${a.map((b) => b.t + (b.dis ? ' (off)' : '')).join(' | ')}`);
  check(a.some((b) => /^Rally.*· 80$/.test(b.t)) && a.some((b) => /^Calm.*· 60$/.test(b.t)) && a.filter((b) => /^Hear/.test(b.t)).length >= 1, `Rally 40, Calm 30, and Hear on the Threads present`);
  await page.locator('.modal button', { hasText: /^Rally/ }).click();
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => { const s = window.__stel.state(); return { r: s.civ.resolve, a: s.civ.accord }; });
  const b = await btns();
  const rally = b.find((x) => /^Rally/.test(x.t));
  check(st.r === 43 && st.a === 120 && rally.dis && /· 160$/.test(rally.t), `after a Rally: resolve ${st.r}, accord ${st.a}, button "${rally.t}" ${rally.dis ? 'greyed' : 'open'}`);
  await ck.shot('threads.png');
  await finish('ACCORD UI', ck);
});
