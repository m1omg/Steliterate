// Browser check: a falling world breaks up (20 Oct). In a game begun since then a world of rock
// reaching its dead star's tidal limit becomes a ring of rubble: the system view draws it as a belt
// where a world was, and its panel calls it a rubble ring. A black hole's panel gives its disk's
// light in Suns (the player, 16 Oct: "find a way to quantify black hole accretion disk brightness").
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('rubble');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1000);
  // home's star made a white dwarf, and its inner world of rock brought to the tidal limit within the coming turn
  const ids = await page.evaluate(() => {
    const s = window.__stel.state();
    const home = s.systems[s.civ.homeSystemId];
    Object.assign(home.primary, { kind: 'white_dwarf', mass: 0.6, lum: 0.02, halo: false });
    delete home.primary.blueAt;
    delete home.primary.whiteAt;
    const inner = home.bodies.map((id) => s.bodies[id]).find((b) => b.kind === 'barren' && !b.colonyId);
    inner.inspiralAt = s.years + s.turnLength * 0.05;
    s.pending.length = 0;
    window.__stel.refresh();
    return { home: home.id, inner: inner.id, name: inner.name };
  });
  await page.evaluate((id) => window.__stel.engine().showSystem(id), ids.home);
  const drawn = (id) =>
    page.evaluate((id) => {
      const e = window.__stel.engine();
      const p = e.system.planets.find((x) => x.body.id === id);
      return { view: e.view, found: !!p, belt: !!p && !p.mat && (p.mesh.userData.belt ?? 0) > 0, planet: !!p?.mat };
    }, id);
  let d = { view: 'galaxy' };
  for (let i = 0; i < 40 && d.view !== 'system'; i++) {
    await page.waitForTimeout(400);
    d = await drawn(ids.inner);
  }
  check(d.view === 'system' && d.planet && !d.belt, `before: ${ids.name} is drawn as a world (${JSON.stringify(d)})`);
  await ck.shot('rubble-before.png');
  await page.locator('button.endturn').click({ timeout: 8000 });
  await page.waitForTimeout(1500);
  // (whatever the turn brought up, out of the way)
  await page.evaluate(() => {
    window.__stel.state().pending.length = 0;
    window.__stel.refresh();
  });
  await page.waitForTimeout(800);
  const after = await page.evaluate((id) => {
    const b = window.__stel.state().bodies[id];
    return { kind: b.kind, traits: b.traits, feeding: !!b.feeding };
  }, ids.inner);
  check(after.kind === 'asteroids' && after.traits.includes('rubble') && after.feeding, `the turn tore it into a ring of rubble (${JSON.stringify(after)})`);
  d = await drawn(ids.inner);
  check(d.found && d.belt && !d.planet, `after: drawn as a belt where the world was (${JSON.stringify(d)})`);
  await ck.shot('rubble-after.png');
  await page.evaluate((id) => window.__stel.select('body', id), ids.inner);
  await page.waitForTimeout(700);
  const panel = await page.evaluate(() => document.querySelector('.drawer')?.textContent ?? '');
  check(/Rubble ring/.test(panel), 'its panel calls it a rubble ring');
  await ck.shot('rubble-panel.png');
  // a black hole's panel: its disk's light in Suns
  const hole = await page.evaluate(() => {
    const s = window.__stel.state();
    const h = Object.values(s.systems).find((x) => x.primary.kind === 'black_hole' && !x.gone);
    s.civ.known[h.id] = 2;
    window.__stel.refresh();
    window.__stel.select('system', h.id);
    return h.name;
  });
  await page.waitForTimeout(700);
  const row = await page.evaluate(() => {
    const dts = [...document.querySelectorAll('.drawer dl.kv dt')];
    const dt = dts.find((x) => x.textContent.trim() === 'Disk luminosity');
    return dt ? { value: dt.nextElementSibling?.textContent.trim(), tip: dt.nextElementSibling?.dataset.tip ?? '' } : null;
  });
  check(!!row && /L☉$/.test(row.value) && /one unit of light is/.test(row.tip), `${hole}: Disk luminosity ${row?.value} (${row?.tip.split('\n').pop()})`);
  await ck.shot('disk-luminosity.png');
  await finish('RUBBLE', ck);
});
