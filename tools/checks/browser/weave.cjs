// Browser check: the widest atoms (the new version, part 3-5). In the positronium's window, with
// Positronium Weaving known, a leptonic settlement's Overview offers to weave it through the
// positronium: it says what it takes and means, counts down to the decay, and asks once more;
// begun, it is a project in the queue. Woven, the section says so with the countdown and offers
// to leave the weave, asking once more; left, it is leptonic again, for its energy.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('weave');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000, protonFate: 'decays' }));
  await page.waitForTimeout(1000);
  const at = await page.evaluate(() => {
    window.__stel.endTurns(15);
    const s = window.__stel.state();
    const c = s.colonies[s.civ.capitalId];
    s.civ.techs.push('leptonic_computation', 'horizon_cognition', 'positronium_weaving');
    // in the window, as if it had made the Passage
    s.era = 'blackhole';
    s.eta = 90;
    s.years = 1e90;
    c.form = 'leptonic';
    for (const k of Object.keys(c.pops)) c.pops[k] = 0;
    c.pops.echoes = 4;
    c.cryo = 0;
    c.structures = { reserve_vault: 1 };
    c.queue = [];
    s.civ.energy = 1000;
    window.__stel.refresh();
    return { body: c.bodyId, colony: c.id };
  });
  await page.evaluate((id) => window.__stel.select('body', id), at.body);
  await page.waitForTimeout(900);
  const sec = page.locator('.drawer .section.weave');
  check((await sec.count()) === 1, 'in the window, with Positronium Weaving known, a leptonic settlement is offered the weave');
  const t = (await sec.textContent()) ?? '';
  check(/The positronium/.test(t) && /Weave this settlement through the positronium: \d+ industry and \d+ energy now\./.test(t) && /a fiftieth of their upkeep/.test(t) && /a tenth of their pace/.test(t) && /until the atoms decay in about \d+ turns at this pace \(η\s141\)/.test(t), `it says what it takes and means, and when the atoms decay (${t.slice(0, 160)}…)`);
  const b = sec.locator('button').first();
  check(/^Weave through the positronium$/.test(((await b.textContent()) ?? '').trim()), 'with a button to begin it');
  await b.click();
  await page.waitForTimeout(200);
  check(/Really weave it through the positronium\?/.test((await b.textContent()) ?? ''), 'it asks once more');
  await b.click();
  await page.waitForTimeout(400);
  const q = await page.evaluate((id) => window.__stel.state().colonies[id].queue.map((x) => x.kind), at.colony);
  check(q.includes('weave'), `begun: a project in the queue (${q.join(', ')})`);
  check(/Under way: 0%/.test((await sec.textContent()) ?? ''), 'and the section says it is under way');
  await ck.shot('weave-begun.png', { clip: { x: 900, y: 60, width: 500, height: 760 } });
  // woven (a turn finishing it is unit/positronium's)
  await page.evaluate((id) => {
    const s = window.__stel.state();
    const c = s.colonies[id];
    c.queue = [];
    c.form = 'positronium';
    window.__stel.refresh();
  }, at.colony);
  await page.waitForTimeout(600);
  const chips = await page.evaluate(() => [...document.querySelectorAll('.drawer .chip')].map((x) => x.textContent.replace(/×$/, '').trim()));
  check(chips.includes('positronium'), `woven, its panel says so (${chips.slice(0, 4).join(', ')})`);
  const w = (await sec.textContent()) ?? '';
  check(/In the weave/.test(w) && /Woven through the positronium: its minds cost a fiftieth of their upkeep/.test(w) && /The atoms decay in about \d+ turns at this pace \(η\s141\): whoever is still woven through them then ends with them\./.test(w), `the section counts down to the decay (${w.slice(0, 150)}…)`);
  const lb = sec.locator('button').first();
  check(/^Leave the weave$/.test(((await lb.textContent()) ?? '').trim()), 'with a button to leave the weave');
  const e0 = await page.evaluate(() => window.__stel.state().civ.energy);
  await lb.click();
  await page.waitForTimeout(200);
  check(/Really leave the weave\?/.test((await lb.textContent()) ?? ''), 'it asks once more');
  await ck.shot('weave-woven.png', { clip: { x: 900, y: 60, width: 500, height: 760 } });
  await lb.click();
  await page.waitForTimeout(400);
  const after = await page.evaluate((id) => ({ form: window.__stel.state().colonies[id].form, energy: window.__stel.state().civ.energy }), at.colony);
  check(after.form === 'leptonic' && Math.abs(e0 - after.energy - 8) < 1e-9, `left: leptonic again, for 8 energy (2 for each of its 4 minds; ${e0 - after.energy})`);
  await finish('WEAVE UI', ck);
});
