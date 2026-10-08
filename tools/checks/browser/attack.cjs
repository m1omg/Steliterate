// Browser check: warships at a swarm's star can go for it from the fleet's panel, the odds on the
// button, a second click to confirm; once a turn; the swarm's panel offers the same.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('attack');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(800);
  const ids = await page.evaluate(() => {
    const s = window.__stel.state();
    const sys = Object.values(s.systems).find((x) => x.special !== 'home' && !Object.values(s.swarms).some((w) => w.systemId === x.id) && !Object.values(s.colonies).some((c) => c.systemId === x.id));
    s.swarms.hgx = { id: 'hgx', systemId: sys.id, from: null, to: null, traveled: 0, distance: 0, size: 1, awake: true, tamed: false, appetite: 1 };
    s.fleets.fx = { id: 'fx', name: 'Spear', ships: [{ cls: 'warden', hp: 10 }], at: sys.id, from: null, to: null, traveled: 0, distance: 0, order: 'idle' };
    s.civ.known[sys.id] = 2;
    window.__stel.refresh();
    return { sys: sys.id, name: sys.name };
  });
  const button = () => page.locator('.drawer button', { hasText: /Attack the swarm|Really attack/ }).first();
  // the swarm's panel offers it too
  await page.evaluate(() => window.__stel.select('swarm', 'hgx'));
  await page.waitForTimeout(500);
  const onSwarm = await page.locator('.drawer button', { hasText: /Attack the swarm/ }).count();
  check(onSwarm === 1, `the swarm's panel offers the attack (${onSwarm})`);
  await page.evaluate(() => window.__stel.select('fleet', 'fx'));
  await page.waitForTimeout(500);
  const label = (await button().textContent())?.trim();
  console.log(`  fleet panel: "${label}"`);
  check(/Attack the swarm \(100%\)/.test(label ?? ''), 'the fleet panel shows the attack and its odds');
  await button().click();
  await page.waitForTimeout(200);
  const armed = (await button().textContent())?.trim();
  check(/Really attack\? 100% to win/.test(armed ?? ''), `one click arms it: "${armed}"`);
  await ck.shot('attack-armed.png', { clip: { x: 900, y: 60, width: 500, height: 760 } });
  await button().click();
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => {
    const s = window.__stel.state();
    return { swarm: !!s.swarms.hgx, log: s.log.slice(-3).map((l) => l.text) };
  });
  console.log(`  the Record: ${after.log.join(' / ')}`);
  check(!after.swarm && after.log.some((t) => /broke it/.test(t)), 'the second click sends them: the swarm is broken, and the Record says so');
  await finish('ATTACK UI', ck);
});
