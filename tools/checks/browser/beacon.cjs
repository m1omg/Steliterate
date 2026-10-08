// Browser check: decoy beacons burn while we feed them. The fleet's Beacon button says what it
// costs to light and to keep burning; once lit, the star's panel shows it with Put out, and the
// energy tooltip counts its upkeep; Put out darkens it.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('beacon', { seed: 1000 });
  const { page } = ck;
  const at = await page.evaluate(() => {
    window.__stel.endTurns(30);
    const s = window.__stel.state();
    if (!s.civ.techs.includes('hunger_lures')) s.civ.techs.push('hunger_lures');
    const cap = s.systems[s.colonies[s.civ.capitalId].systemId];
    const d = (a, b) => Math.hypot(a.phys.x - b.phys.x, a.phys.y - b.phys.y, a.phys.z - b.phys.z);
    const sys = Object.values(s.systems)
      .filter((x) => !x.gone && !x.special && !x.beacon && !Object.values(s.colonies).some((c) => c.systemId === x.id))
      .sort((a, b) => d(a, cap) - d(b, cap))[0];
    s.civ.known[sys.id] = 2;
    const f = Object.values(s.fleets)[0];
    Object.assign(f, { at: sys.id, to: null, from: null, traveled: 0, distance: 0, order: 'idle', auto: undefined });
    s.civ.energy = 200;
    s.pending.length = 0;
    window.__stel.refresh();
    window.__stel.select('fleet', f.id);
    return { sys: sys.id, name: sys.name, fleet: f.id };
  });
  await page.waitForTimeout(700);
  const btn = page.locator('.drawer button', { hasText: /^Beacon$/ });
  const tip = await btn.getAttribute('data-tip').catch(() => null);
  check(/^Light a decoy beacon here: 30 energy, then 3 a turn at the Tide to keep it burning/.test(tip ?? ''), `Beacon says what it costs (${tip?.slice(0, 90)})`);
  await btn.click();
  await page.waitForTimeout(400);
  const lit = await page.evaluate((id) => ({ beacon: !!window.__stel.state().systems[id].beacon, energy: window.__stel.state().civ.energy }), at.sys);
  check(lit.beacon && lit.energy === 170, `lit, for 30 energy (${lit.energy})`);
  await page.evaluate((id) => window.__stel.select('system', id), at.sys);
  await page.waitForTimeout(700);
  const chip = await page.locator('.drawer .chip', { hasText: 'decoy beacon' }).count();
  const putOut = page.locator('.drawer button', { hasText: /^Put out$/ });
  check(chip === 1 && (await putOut.count()) === 1, 'its star’s panel shows it, with Put out');
  const eTip = await page.evaluate(() => [...document.querySelectorAll('.resources .res')].map((x) => x.dataset.tip ?? '').find((t) => t.startsWith('Energy reserve')) ?? '');
  check(/Decoy beacons \(1\): [−-]3/.test(eTip), `the energy tooltip counts its upkeep (${eTip.split('\n').find((l) => l.startsWith('Decoy')) ?? 'none'})`);
  await ck.shot('beacon-lit.png');
  await putOut.click();
  await page.waitForTimeout(400);
  const dark = await page.evaluate((id) => !window.__stel.state().systems[id].beacon, at.sys);
  check(dark && (await page.locator('.drawer .chip', { hasText: 'decoy beacon' }).count()) === 0, 'Put out: it goes dark');
  await finish('BEACON UI', ck);
});
