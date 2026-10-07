// Browser check: a settlement's structures can be taken apart from its Overview. The × on one says
// what comes back and what it costs; it asks first, and Keep it changes nothing; Take apart gives
// the matter back and spends the energy, one at a time. A Substrate Core whose Echoes would have
// nowhere to go cannot be taken apart, and says why.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('dismantle', { seed: 1000 });
  const { page } = ck;
  const at = await page.evaluate(() => {
    window.__stel.endTurns(15);
    const s = window.__stel.state();
    const c = s.colonies[s.civ.capitalId];
    c.structures.solar_array = 2;
    c.structures.substrate_core = 1;
    c.pops.echoes = 99;
    s.civ.energy = 300;
    s.civ.matter = 50;
    window.__stel.refresh();
    return { body: c.bodyId, colony: c.id };
  });
  await page.evaluate((id) => window.__stel.select('body', id), at.body);
  await page.waitForTimeout(900);
  const solar = page.locator('.drawer button.dismantle[aria-label="Take apart Solar Arrays"]');
  check((await solar.count()) === 1, 'Solar Arrays have a × in the settlement’s structures');
  const tip = await solar.getAttribute('data-tip');
  check(tip === 'Take one apart: +10 matter back, for 6 energy.', `it says what comes back and what it costs (${tip})`);
  await solar.click();
  await page.waitForTimeout(300);
  const ask = await page.evaluate(() => document.querySelector('.drawer .dismantle-confirm')?.textContent.trim() ?? null);
  check(ask === 'Take apart one Solar Arrays? +10 matter back, for 6 energy. The work that built it is lost.Take apartKeep it', `it asks first (${ask})`);
  await ck.shot('dismantle-ask.png', { clip: { x: 900, y: 60, width: 500, height: 760 } });
  await page.locator('.drawer .dismantle-confirm button', { hasText: 'Keep it' }).click();
  await page.waitForTimeout(300);
  const kept = await page.evaluate((id) => ({ bar: !!document.querySelector('.drawer .dismantle-confirm'), n: window.__stel.state().colonies[id].structures.solar_array }), at.colony);
  check(!kept.bar && kept.n === 2, 'Keep it changes nothing');
  await solar.click();
  await page.waitForTimeout(300);
  await page.locator('.drawer .dismantle-confirm button', { hasText: 'Take apart' }).click();
  await page.waitForTimeout(500);
  const after = await page.evaluate((id) => {
    const s = window.__stel.state();
    const chip = [...document.querySelectorAll('.drawer .chip')].find((x) => x.querySelector('button.dismantle[aria-label="Take apart Solar Arrays"]'));
    return { n: s.colonies[id].structures.solar_array, matter: s.civ.matter, energy: s.civ.energy, chip: chip?.textContent.replace(/×$/, '').trim(), bar: !!document.querySelector('.drawer .dismantle-confirm') };
  }, at.colony);
  check(after.n === 1 && after.matter === 60 && after.energy === 294 && !after.bar, `Take apart: one gone, 10 matter back, 6 energy spent (${after.n} left, matter ${after.matter}, energy ${after.energy})`);
  check(after.chip === 'Solar Arrays', `the chip counts what is left (${after.chip})`);
  const core = page.locator('.drawer button.dismantle[aria-label="Take apart Substrate Core"]');
  const ctip = await core.getAttribute('data-tip');
  check((await core.getAttribute('class')).includes('off') && ctip === 'Cannot take it apart: It houses Echoes who would have nowhere else to live here.', `a full Substrate Core says why it stays (${ctip})`);
  await core.click();
  await page.waitForTimeout(300);
  const none = await page.evaluate((id) => ({ bar: !!document.querySelector('.drawer .dismantle-confirm'), n: window.__stel.state().colonies[id].structures.substrate_core }), at.colony);
  check(!none.bar && none.n === 1, 'and clicking it does nothing');
  await ck.shot('dismantle-after.png', { clip: { x: 900, y: 60, width: 500, height: 760 } });
  await finish('DISMANTLE UI', ck);
});
