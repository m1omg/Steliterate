// Browser check: expansion. A neighbour's second star shows on the map as a dashed ring in its
// colour (once its light has reached us), their card counts their stars, and a promise of
// warships we made shows there with the turns left to keep it.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('claims', { seed: 1000 });
  const { page } = ck;
  const sv = await page.evaluate(() => {
    window.__stel.endTurns(30);
    const s = window.__stel.state();
    const v = Object.values(s.survivors)[0];
    Object.assign(v, { alive: true, contact: true, health: 0.8, disposition: 20 });
    delete v.fate;
    // a second star of theirs, settled long ago, and one whose light has not reached us
    const home = s.systems[v.homeSystemId];
    const near = Object.values(s.systems)
      .filter((x) => x.id !== home.id && !x.special && !x.gone && !Object.values(s.colonies).some((c) => c.systemId === x.id))
      .map((x) => ({ x, d: Math.hypot(x.phys.x - home.phys.x, x.phys.y - home.phys.y, x.phys.z - home.phys.z) }))
      .sort((a, b) => a.d - b.d);
    const [a, b] = [near[0].x, near[1].x];
    v.systems = [home.id, a.id, b.id];
    v.claimedAt = { [a.id]: 0, [b.id]: s.years };
    s.civ.known[home.id] = 2;
    s.civ.known[a.id] = 2;
    s.civ.known[b.id] = 2;
    v.promised = { systemId: a.id, turn: s.turn };
    s.pending.length = 0;
    window.__stel.refresh();
    return { id: v.id, name: v.name, home: home.id, a: a.id, b: b.id, aName: a.name };
  });
  await page.waitForTimeout(600);
  // the map: rings where we can see them
  const rings = await page.evaluate((ids) => {
    const g = window.__stel.engine().galaxy;
    const attr = g.nodes.geometry.getAttribute('aOthers');
    const at = (id) => {
      const i = g.pickables.findIndex((p) => p.kind === 'system' && p.id === id);
      return i < 0 ? null : attr.getW(i);
    };
    return { home: at(ids.home), a: at(ids.a), b: at(ids.b) };
  }, sv);
  check(rings.home === 1 && rings.a === 1, `their stars carry their ring on the map (${JSON.stringify(rings)})`);
  check(rings.b === 0, 'but not one whose light has not reached us yet');
  await page.evaluate((id) => window.__stel.engine().focusGalaxyOn(id, 90, true), sv.home);
  await page.waitForTimeout(800);
  await ck.shot('claims-map.png');
  // their card
  await page.locator('button[aria-label="Signals: the other minds"]').click();
  await page.waitForTimeout(500);
  await page.locator('.modal button', { hasText: /^Survivors$/ }).click();
  await page.waitForTimeout(400);
  const card = page.locator('.modal .card', { hasText: sv.name });
  const row = (label) =>
    card.evaluate((el, label) => {
      const dt = [...el.querySelectorAll('dt')].find((x) => x.textContent.trim() === label);
      return dt ? dt.nextElementSibling.textContent.trim() : null;
    }, label);
  const stars = await row('Stars');
  check(stars === '2', `their card counts the stars we can see (${stars})`);
  const promised = await row('Promised');
  check(promised === `warships to ${sv.aName}, 10 turns left`, `and our promise (${promised})`);
  await ck.shot('claims-card.png');
  await finish('CLAIMS UI', ck);
});
