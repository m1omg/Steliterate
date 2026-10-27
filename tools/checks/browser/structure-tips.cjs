// Browser check: each built structure's chip says what it gives here now (26 Oct, the player: "the
// buildings should show what their current real effect/benefit or lack thereof is"). On the
// capital's Overview, a collector's tip has a "Now" line with its energy; a Protocol Registry with
// no Lattice to run it says it makes nothing, and why, and its chip is dimmed; with the Lattice it
// says the industry it takes and the accord it gives.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('structure-tips', { width: 1400, height: 1000 });
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1200);
  const tips = (lattice) =>
    page.evaluate((lattice) => {
      const s = window.__stel.state();
      const c = s.colonies[s.civ.capitalId];
      c.structures.protocol_registry = 1;
      c.pops.lattice = lattice;
      window.__stel.select('body', c.bodyId);
      window.__stel.refresh();
      return new Promise((done) =>
        setTimeout(() => {
          const sec = [...document.querySelectorAll('.section')].find((x) => x.querySelector('h3')?.textContent === 'Structures');
          done(sec ? [...sec.querySelectorAll('.chip')].map((ch) => ({ name: ch.textContent.replace('×', '').trim(), tip: ch.getAttribute('data-tip') ?? '', faint: ch.classList.contains('faint') })) : []);
        }, 900),
      );
    }, lattice);
  let chips = await tips(0);
  for (const ch of chips) console.log(`  ${ch.faint ? '(dim) ' : ''}${ch.name}: ${ch.tip.split('\n').slice(1).join(' / ')}`);
  const collector = chips.find((ch) => /Now.*energy/.test(ch.tip) && !/Registry/.test(ch.name));
  check(!!collector, `a collector's tip says what it gives now (${collector?.name})`);
  let reg = chips.find((ch) => /Registry/.test(ch.name));
  check(!!reg && /nothing made \(no Lattice here to run it\)/.test(reg.tip) && reg.faint, 'a Registry with no Lattice: nothing made, why, and dimmed');
  chips = await tips(3);
  reg = chips.find((ch) => /Registry/.test(ch.name));
  check(!!reg && /Now: .*industry, \+[\d.]+ accord/.test(reg.tip) && !reg.faint, `with the Lattice: the industry it takes and the accord it gives (${reg?.tip.split('\n')[1]})`);
  await ck.shot('structure-tips.png');
  await finish('STRUCTURE TIPS', ck);
});
