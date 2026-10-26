// Browser check: each built structure's chip says what it gives here now (26 Oct, the player: "the
// buildings should show what their current real effect/benefit or lack thereof is"). On the
// capital's Overview, a collector's tip has a "Now" line with its energy; with its star's light gone
// it says it makes nothing, and why, and its chip is dimmed.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('structure-tips', { width: 1400, height: 1000 });
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1200);
  const tips = (dark) =>
    page.evaluate((dark) => {
      const s = window.__stel.state();
      const c = s.colonies[s.civ.capitalId];
      const p = s.systems[c.systemId].primary;
      window.__lum = window.__lum ?? p.lum;
      p.lum = dark ? 0 : window.__lum;
      window.__stel.select('body', c.bodyId);
      window.__stel.refresh();
      return new Promise((done) =>
        setTimeout(() => {
          const sec = [...document.querySelectorAll('.section')].find((x) => x.querySelector('h3')?.textContent === 'Structures');
          done(sec ? [...sec.querySelectorAll('.chip')].map((ch) => ({ name: ch.textContent.replace('×', '').trim(), tip: ch.getAttribute('data-tip') ?? '', faint: ch.classList.contains('faint') })) : []);
        }, 900),
      );
    }, dark);
  let chips = await tips(false);
  for (const ch of chips) console.log(`  ${ch.faint ? '(dim) ' : ''}${ch.name}: ${ch.tip.split('\n').slice(1).join(' / ')}`);
  let solar = chips.find((ch) => /Solar/.test(ch.name));
  check(!!solar && /Now: \+[\d.]+ energy/.test(solar.tip) && !solar.faint, `a collector's tip says what it gives now (${solar?.tip.split('\n')[1]})`);
  check(chips.filter((ch) => /\nNow/.test(ch.tip)).length >= 3, 'the others say theirs too');
  chips = await tips(true);
  solar = chips.find((ch) => /Solar/.test(ch.name));
  check(!!solar && /nothing made \(/.test(solar.tip) && solar.faint, `with no light: nothing made, why, and dimmed (${solar?.tip.split('\n')[1]})`);
  await ck.shot('structure-tips.png');
  await finish('STRUCTURE TIPS', ck);
});
