// Browser check: the Passage (the new version, part 3-2). Once the end of matter can be foreseen
// and Leptonic Computation is known, a settlement's Overview offers it, says what it takes and
// does, and asks once more; begun, it is a project in the queue and the section says it is under
// way; a turn that finishes it makes the settlement leptonic: its panel says so, and its Energy
// Vault is a Field Store there.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('passage');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000, protonFate: 'decays' }));
  await page.waitForTimeout(1000);
  const at = await page.evaluate(() => {
    window.__stel.endTurns(15);
    const s = window.__stel.state();
    const c = s.colonies[s.civ.capitalId];
    s.civ.techs.push('leptonic_computation');
    c.structures.reserve_vault = 1;
    c.queue = [];
    s.civ.energy = 1000;
    window.__stel.refresh();
    return { body: c.bodyId, colony: c.id };
  });
  await page.evaluate((id) => window.__stel.select('body', id), at.body);
  await page.waitForTimeout(900);
  const section = page.locator('.drawer .section.passage');
  check((await section.count()) === 1, 'the settlement’s Overview offers the Passage');
  const text = (await section.textContent()) ?? '';
  check(/\d+ industry \(about \d+ turns? here; matter ends in about \d+\) and \d+ energy now\./.test(text) && /cross(es)? over/.test(text) && /taken apart/.test(text) && /Kin cannot go: their patterns are kept/.test(text), `it says what it takes and does (${text.slice(0, 110)}…)`);
  const btn = section.locator('button', { hasText: /Begin the Passage/ });
  await btn.click();
  await page.waitForTimeout(200);
  check(/Really begin the Passage\?/.test((await btn.textContent()) ?? ''), 'it asks once more');
  await btn.click();
  await page.waitForTimeout(400);
  const q = await page.evaluate((id) => window.__stel.state().colonies[id].queue.map((x) => x.kind), at.colony);
  check(q.includes('passage'), `begun: a project in the queue (${q.join(', ')})`);
  check(/Under way: 0%/.test((await section.textContent()) ?? ''), 'and the section says it is under way');
  await ck.shot('passage-begun.png', { clip: { x: 900, y: 60, width: 500, height: 760 } });
  // a turn that finishes it
  await page.evaluate((id) => {
    const s = window.__stel.state();
    const c = s.colonies[id];
    c.queue = c.queue.filter((x) => x.kind === 'passage');
    c.queue[0].progress = c.queue[0].cost - 0.001;
    window.__stel.endTurns(1);
  }, at.colony);
  await page.waitForTimeout(900);
  const after = await page.evaluate((id) => ({ form: window.__stel.state().colonies[id].form, chips: [...document.querySelectorAll('.drawer .chip')].map((x) => x.textContent.replace(/×$/, '').trim()) }), at.colony);
  check(after.form === 'leptonic' && after.chips.includes('leptonic'), `done: the settlement is leptonic, and its panel says so (${after.form})`);
  check(after.chips.some((x) => /^Field Store/.test(x)), `its Energy Vault is a Field Store there (${after.chips.filter((x) => /Store|Vault/.test(x)).join(', ') || 'none'})`);
  await ck.shot('passage-done.png', { clip: { x: 900, y: 60, width: 500, height: 760 } });
  await finish('PASSAGE UI', ck);
});
