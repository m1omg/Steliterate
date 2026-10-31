// Browser check: leaving for a black hole, and the Horizon form (the new version, part 3-4). A
// leptonic settlement on a world is offered a black hole on its Overview: it says why, where, how
// far and for how much, and asks once more; it goes, into the hole's Deep. There, with Horizon
// Writing known, the Overview offers to write it into the horizon, says what it takes and means,
// and asks once more; begun, it is a project in the queue; a turn that finishes it makes the
// settlement a horizon one: its panel says so, and the section says it is bound to its hole.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('horizon');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000, protonFate: 'decays' }));
  await page.waitForTimeout(1000);
  const at = await page.evaluate(() => {
    window.__stel.endTurns(15);
    const s = window.__stel.state();
    const c = s.colonies[s.civ.capitalId];
    s.civ.techs.push('leptonic_computation', 'penrose_process', 'horizon_cognition', 'horizon_writing');
    // as if it had made the Passage
    c.form = 'leptonic';
    for (const k of Object.keys(c.pops)) c.pops[k] = 0;
    c.pops.echoes = 4;
    c.cryo = 0;
    c.structures = { reserve_vault: 1 };
    c.queue = [];
    s.civ.energy = 1000;
    window.__stel.refresh();
    return { body: c.bodyId, colony: c.id, system: c.systemId };
  });
  await page.evaluate((id) => window.__stel.select('body', id), at.body);
  await page.waitForTimeout(900);
  const drift = page.locator('.drawer .section.drift');
  check((await drift.count()) === 1, 'a leptonic settlement on a world is offered a black hole');
  const dt = (await drift.textContent()) ?? '';
  check(/To a black hole/.test(dt) && /Away from the black holes nothing it is made of gathers energy\./.test(dt) && /Choose a hole to drift to, taking all it has, for \d+ energy\./.test(dt) && /spin [\d,.k]+ · lasts .+? · [\d,.]+ [kM]?ly/.test(dt), `it says why, where, how far and for how much (${dt.slice(0, 400)}…)`);
  const db = drift.locator('button').first();
  check(/^Drift to /.test(((await db.textContent()) ?? '').trim()), 'with a button to drift');
  await db.click();
  await page.waitForTimeout(200);
  check(/Really drift to .+\?/.test((await db.textContent()) ?? ''), 'it asks once more');
  await db.click();
  await page.waitForTimeout(500);
  const moved = await page.evaluate((id) => {
    const s = window.__stel.state();
    const c = s.colonies[id];
    return c && { system: c.systemId, kind: s.systems[c.systemId].primary.kind, body: c.bodyId, deep: s.bodies[c.bodyId].kind };
  }, at.colony);
  check(!!moved && moved.system !== at.system && ['black_hole', 'smbh'].includes(moved.kind) && moved.deep === 'deep', `it drifts into a black hole’s Deep (${moved?.kind}, ${moved?.deep})`);
  // in the hole's Deep: the horizon
  await page.evaluate((id) => window.__stel.select('body', id), moved.body);
  await page.waitForTimeout(900);
  check((await drift.count()) === 0, 'at a hole with spin and years to give, no drift is offered');
  const hz = page.locator('.drawer .section.horizon');
  check((await hz.count()) === 1, 'in a black hole’s Deep, with Horizon Writing known, it is offered the horizon');
  const ht = (await hz.textContent()) ?? '';
  check(/Write this settlement into the horizon of .+: \d+ industry and \d+ energy now\./.test(ht) && /a tenth of their upkeep/.test(ht) && /a quarter of their pace/.test(ht) && /bound to the hole/.test(ht), `it says what it takes and means (${ht.slice(0, 150)}…)`);
  const hb = hz.locator('button').first();
  check(/^Write into the horizon$/.test(((await hb.textContent()) ?? '').trim()), 'with a button to begin it');
  await hb.click();
  await page.waitForTimeout(200);
  check(/Really write it into the horizon\?/.test((await hb.textContent()) ?? ''), 'it asks once more');
  await hb.click();
  await page.waitForTimeout(400);
  const q = await page.evaluate((id) => window.__stel.state().colonies[id].queue.map((x) => x.kind), at.colony);
  check(q.includes('horizon'), `begun: a project in the queue (${q.join(', ')})`);
  check(/Under way: 0%/.test((await hz.textContent()) ?? ''), 'and the section says it is under way');
  await ck.shot('horizon-begun.png', { clip: { x: 900, y: 60, width: 500, height: 760 } });
  // a turn that finishes it
  await page.evaluate((id) => {
    const s = window.__stel.state();
    const c = s.colonies[id];
    c.queue = c.queue.filter((x) => x.kind === 'horizon');
    c.queue[0].progress = c.queue[0].cost - 0.001;
    window.__stel.endTurns(1, false);
  }, at.colony);
  await page.waitForTimeout(900);
  const after = await page.evaluate((id) => ({ form: window.__stel.state().colonies[id].form, chips: [...document.querySelectorAll('.drawer .chip')].map((x) => x.textContent.replace(/×$/, '').trim()) }), at.colony);
  check(after.form === 'horizon' && after.chips.includes('horizon'), `done: it is written into the horizon, and its panel says so (${after.form})`);
  const done = (await hz.textContent()) ?? '';
  check(/In the horizon/.test(done) && /Written into the horizon of .+: its minds cost a tenth of their upkeep/.test(done) && /Bound to it/.test(done), `the section says what that means, and that it is bound to its hole (${done.slice(0, 120)}…)`);
  check((await drift.count()) === 0, 'and no drift is offered');
  await ck.shot('horizon-done.png', { clip: { x: 900, y: 60, width: 500, height: 760 } });
  await finish('HORIZON UI', ck);
});
