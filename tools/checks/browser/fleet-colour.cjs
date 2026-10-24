// Browser check: our ships are drawn in our own colour, the teal of our systems, whatever kind
// they are, on the galaxy map and in a system's view (24 Oct, the player: "why is my warship
// yellow?": warships had an amber rim, a neighbour's colour). What kind a ship is shows in its
// hull.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('fleet-colour');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(800);
  const map = await page.evaluate(() => {
    const s = window.__stel.state();
    const g = window.__stel.engine().galaxy;
    const ours = Object.values(s.fleets).map((f) => f.id);
    const cols = ours.map((id) => g.fleetAnim.get(id)?.mesh.userData.color ?? 'none');
    const kinds = ours.map((id) => g.fleetAnim.get(id)?.kind ?? 'none');
    return { cols: [...new Set(cols)], kinds: [...new Set(kinds)], n: ours.length, home: s.civ.homeSystemId };
  });
  check(map.n > 0 && map.cols.length === 1 && map.cols[0] === '#4fe3d1', `on the map our ${map.n} fleets (${map.kinds.join(', ')}) are all teal (${map.cols.join(', ')})`);
  await page.evaluate((id) => window.__stel.engine().showSystem(id), map.home);
  await page.waitForFunction((x) => {
    const e = window.__stel.engine();
    return !e.pendingSwitch && e.view === 'system' && e.system.systemId === x;
  }, map.home, { timeout: 20000, polling: 50 });
  const sys = await page.evaluate(() => [...new Set(window.__stel.engine().system.fleets.children.map((o) => o.userData.color))]);
  check(sys.length >= 1 && sys.every((c) => c === '#4fe3d1'), `and in the home system's view their drives glow teal (${sys.join(', ')})`);
  await finish('FLEET COLOUR', ck);
});
