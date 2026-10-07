// Browser check: a world wears one ring. Selected, one of our worlds shows only the selection
// circle, in the colour of its own ring (ours: teal in the Dusk), which steps aside; a world no one
// lives on gets the pale circle, and our world, no longer selected, wears its ring again.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('ring-select', { seed: 1000 });
  const { page } = ck;
  const home = await page.evaluate(() => {
    const s = window.__stel.state();
    const col = Object.values(s.colonies).find((c) => c.systemId === s.civ.homeSystemId);
    const sys = s.systems[s.civ.homeSystemId];
    const settled = new Set(Object.values(s.colonies).map((c) => c.bodyId));
    const empty = sys.bodies.map((id) => s.bodies[id]).find((b) => b && !b.dissolved && b.kind !== 'deep' && b.kind !== 'asteroids' && !settled.has(b.id));
    window.__stel.select('system', sys.id);
    return { sys: sys.id, world: col.bodyId, empty: empty?.id ?? null };
  });
  // into the home system, the way a player goes
  await page.waitForTimeout(400);
  await page.locator('.drawer button', { hasText: /Look inside/ }).first().click();
  let view = 'galaxy';
  for (let i = 0; i < 40 && view !== 'system'; i++) {
    await page.waitForTimeout(250);
    view = await page.evaluate(() => window.__stel.engine().view);
  }
  check(view === 'system', `the home system opens (${view})`);
  const look = (id) =>
    page.evaluate((w) => {
      const sv = window.__stel.engine().system;
      const ring = (bodyId) => sv.planets.find((p) => p.body.id === bodyId)?.extra.find((e) => e.userData.mark) ?? null;
      const mine = ring(w.world);
      return {
        sel: sv.selRing.visible,
        selColor: sv.selRing.material.color.getHexString(),
        opacity: sv.selRing.material.opacity,
        ours: mine ? mine.material.color.getHexString() : null,
        oursShown: mine ? mine.visible : null,
        neon: sv.neon.getHexString(),
      };
    }, id);
  const pickBody = async (bodyId) => {
    await page.evaluate((b) => {
      window.__stel.select('body', b);
      window.__stel.engine().select(`body:${b}`);
    }, bodyId);
    await page.waitForTimeout(900);
  };
  await pickBody(home.world);
  const a = await look(home);
  check(a.ours === a.neon, `our world wears a ring in our colour (#${a.ours})`);
  check(a.sel && a.selColor === a.ours && a.oursShown === false, `selected, it shows one ring: the selection circle, in our colour (#${a.selColor}), its own ring stepping aside`);
  check(a.opacity >= 0.35 - 1e-9, `close up it stays clear enough to read (opacity ${a.opacity.toFixed(2)})`);
  await ck.shot('ring-ours.png');
  check(!!home.empty, 'the home system has a world no one lives on');
  if (home.empty) {
    await pickBody(home.empty);
    const b = await look(home);
    check(b.sel && b.selColor === 'ffd9b0', `a world no one lives on gets the pale circle (#${b.selColor})`);
    check(b.oursShown === true, 'and our world, no longer selected, wears its ring again');
  }
  await finish('RING SELECT', ck);
});
