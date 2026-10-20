// Browser check: Hunger Studies on the map (19 Oct, "Reveals swarms within detection range and
// forecasts their paths"). Without it a sleeping swarm is not drawn and no swarm's way is; with it
// the sleeping one shows, faint, and the way of one under way is drawn to where it is going, and
// its panel says when it arrives. And the energy reading's low-reserve edge has its style.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('hunger-sight');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(800);
  const setup = await page.evaluate(() => {
    const s = window.__stel.state();
    s.swarms = {};
    s.civ.techs = s.civ.techs.filter((t) => t !== 'hunger_studies');
    const home = s.systems[s.civ.homeSystemId];
    const d = (a, b) => Math.hypot(a.phys.x - b.phys.x, a.phys.y - b.phys.y, a.phys.z - b.phys.z);
    const near = Object.values(s.systems).filter((x) => x.id !== home.id && !x.gone).sort((a, b) => d(home, a) - d(home, b));
    const [a, b] = [near[0], near[1]];
    s.civ.known[a.id] = 2;
    s.civ.known[b.id] = 2;
    s.swarms.coming = { id: 'coming', systemId: null, from: a.id, to: home.id, traveled: d(a, home) * 0.3, distance: d(a, home), size: 4, awake: true, tamed: false, appetite: 1 };
    s.swarms.nest = { id: 'nest', systemId: b.id, from: null, to: null, traveled: 0, distance: 0, size: 5, awake: false, tamed: false, appetite: 1 };
    window.__stel.refresh();
    const g = window.__stel.engine().galaxy;
    const sleep = g.swarmPts ? [...new Set(g.swarmPts.geometry.getAttribute('aSleep').array)] : [];
    return { lines: g.swarmLines ? g.swarmLines.geometry.getAttribute('position').count : 0, sleep, home: home.name };
  });
  check(setup.lines === 0, `without Hunger Studies no swarm's way is drawn (${setup.lines} points)`);
  check(!setup.sleep.includes(1), `and the sleeping swarm is not drawn (sleep marks ${setup.sleep})`);
  const withIt = await page.evaluate(() => {
    const s = window.__stel.state();
    s.civ.techs.push('hunger_studies');
    window.__stel.refresh();
    const g = window.__stel.engine().galaxy;
    return { lines: g.swarmLines ? g.swarmLines.geometry.getAttribute('position').count : 0, sleep: [...new Set(g.swarmPts.geometry.getAttribute('aSleep').array)].sort() };
  });
  check(withIt.lines === 2, `with it the way of the swarm under way is drawn (${withIt.lines} points: one segment)`);
  check(withIt.sleep.join() === '0,1', `and the sleeping one shows, marked asleep (${withIt.sleep})`);
  await page.evaluate(() => window.__stel.select('swarm', 'coming'));
  await page.waitForTimeout(600);
  const panel = await page.evaluate(() => document.querySelector('.drawer')?.innerText ?? '');
  check(/moving toward/i.test(panel) && /arrives/i.test(panel), `its panel says where it is going and when it arrives ("${(panel.match(/Arrives[^\n]*\n?[^\n]*/) || [''])[0].replace(/\n/g, ' ')}")`);
  await ck.shot('hunger-sight.png');
  const edge = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'res hazard-edge';
    document.body.appendChild(el);
    const shadow = getComputedStyle(el).boxShadow;
    el.remove();
    return shadow;
  });
  check(!!edge && edge !== 'none', `the low-reserve edge on the energy reading has its style (${edge})`);
  await finish('HUNGER SIGHT', ck);
});
