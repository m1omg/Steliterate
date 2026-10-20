// Browser check: the combat system (20 Oct). A fleet with a warship has a Tactic row of four
// buttons, Hold the line lit; at an enemy's star each tip forecasts what the turn would deal and
// take; picking one lights it, sets it, and shows on the fleet's chips and in the fleet list. The
// Battle section shows both sides and, after a turn, what we dealt, took and lost, and the map marks
// the star ✕; standing off, Storm says why it cannot. A probe has no Tactic row. A settlement of ours
// under siege says so.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('tactics', { seed: 1000 });
  const { page } = ck;
  const setup = await page.evaluate(() => {
    window.__stel.endTurns(20);
    const s = window.__stel.state();
    const v = Object.values(s.survivors).find((x) => x.alive && s.civs[x.id]);
    v.contact = true;
    s.civ.energy = 1e6;
    s.civ.pending.length = 0;
    const c = Object.values(s.colonies).find((x) => x.owner === v.id);
    delete c.foundedAt;
    // at war with them, our warships and a probe at their settlement, a guard of theirs there
    v.war = { since: s.turn, siege: 0, at: c.systemId };
    for (const f of Object.values(s.fleets)) if (f.owner === v.id && f.at === c.systemId) delete s.fleets[f.id];
    s.fleets.ftac = { id: 'ftac', owner: s.player, name: 'Spear', ships: [{ cls: 'warden', hp: 10 }, { cls: 'warden', hp: 10 }, { cls: 'warden', hp: 10 }, { cls: 'probe', hp: 2 }], at: c.systemId, from: null, to: null, traveled: 0, distance: 0, order: 'idle' };
    s.fleets.fguard = { id: 'fguard', owner: v.id, name: 'Guard', ships: [{ cls: 'warden', hp: 10 }], at: c.systemId, from: null, to: null, traveled: 0, distance: 0, order: 'idle' };
    s.fleets.fprobe = { id: 'fprobe', owner: s.player, name: 'Eyes', ships: [{ cls: 'probe', hp: 2 }], at: s.colonies[s.civ.capitalId].systemId, from: null, to: null, traveled: 0, distance: 0, order: 'hold' };
    window.__stel.select('fleet', 'ftac');
    window.__stel.refresh();
    return { name: v.name, colony: c.name, star: s.systems[c.systemId].name };
  });
  await page.waitForTimeout(600);
  const row = page.locator('.drawer .tactics');
  check((await row.count()) === 1, 'the fleet panel has a Tactic row');
  const btn = (name) => row.locator('button', { hasText: name });
  for (const n of ['Hold the line', 'Close in', 'Stand off', 'Escort']) check((await btn(n).count()) === 1, `with ${n}`);
  check((await btn('Hold the line').getAttribute('aria-pressed')) === 'true' && /\bon\b/.test((await btn('Hold the line').getAttribute('class')) ?? ''), 'Hold the line is lit');
  const tip = (await btn('Close in').getAttribute('data-tip')) ?? '';
  check(/Deals ×1\.5, takes ×1\.5\./.test(tip) && /Here, this turn, at an even draw: we would deal [\d.]+ and take [\d.]+/.test(tip), `Close in's tip gives its figures and the forecast here (${tip.split('\n').pop()})`);
  check(/holds no siege, and cannot storm or raid/.test((await btn('Stand off').getAttribute('data-tip')) ?? ''), 'Stand off says it holds no siege');
  const battle = page.locator('.drawer .section.battle');
  check((await battle.count()) === 1 && (await battle.textContent()).includes(setup.name) && /With us/.test(await battle.textContent()), `the Battle section shows ${setup.name} against us`);
  await ck.shot('tactics-panel.png');

  await btn('Close in').click();
  await page.waitForTimeout(300);
  const t1 = await page.evaluate(() => window.__stel.state().fleets.ftac.tactic);
  check(t1 === 'close' && (await btn('Close in').getAttribute('aria-pressed')) === 'true', 'Close in, clicked, is set and lit');
  check((await page.locator('.drawer .drawer-head .chip', { hasText: 'close in' }).count()) === 1, 'and the fleet shows it among its chips');

  // a turn of battle
  await page.evaluate(() => {
    window.__stel.endTurns(1, false);
    window.__stel.select('fleet', 'ftac');
    window.__stel.refresh();
  });
  await page.waitForTimeout(600);
  const after = (await battle.textContent().catch(() => '')) ?? '';
  check(/Last turn: we dealt [\d.]+ and took [\d.]+/.test(after), `after a turn the section says what we dealt and took (${after.match(/Last turn: we dealt [\d.]+ and took [\d.]+/)?.[0]})`);
  const logged = await page.evaluate(() => window.__stel.state().civ.log.some((l) => /^Battle at /.test(l.text)));
  check(logged, 'and the log has a line for it');
  // the galaxy map marks the star
  await page.evaluate(() => {
    const s = window.__stel.state();
    window.__stel.engine().focusGalaxyOn(s.fleets.ftac.at, 120, true);
  });
  await page.waitForTimeout(900);
  const marked = await page.evaluate(() => [...document.querySelectorAll('.map-label.battle')].filter((e) => e.style.display !== 'none').map((e) => e.textContent));
  check(marked.some((t) => t.startsWith('✕ ')), `the map marks it ✕ (${marked.join(', ')})`);

  // standing off, there is no storming
  await btn('Stand off').click();
  await page.waitForTimeout(300);
  const stormTip = (await battle.locator('button', { hasText: /^Storm/ }).first().getAttribute('data-tip').catch(() => '')) ?? '';
  check(/(standing off cannot storm|Its own warships still hold its star|Hold the siege)/.test(stormTip), `Storm says why it cannot (${stormTip.split('\n')[0]})`);

  // a probe alone has no tactic
  await page.evaluate(() => {
    window.__stel.select('fleet', 'fprobe');
    window.__stel.refresh();
  });
  await page.waitForTimeout(400);
  check((await page.locator('.drawer .tactics').count()) === 0, 'a probe alone has no Tactic row');

  // a settlement of ours under siege says so
  const mine = await page.evaluate(() => {
    const s = window.__stel.state();
    const c = s.colonies[s.civ.capitalId];
    const v = Object.values(s.survivors).find((x) => x.war);
    c.siege = { by: v.id, turns: 2 };
    window.__stel.select('body', c.bodyId);
    window.__stel.refresh();
    return c.name;
  });
  await page.waitForTimeout(500);
  check((await page.locator('.drawer .chip', { hasText: 'under siege 2/3' }).count()) === 1, `${mine} under siege shows it`);
  await finish('TACTICS UI', ck);
});
