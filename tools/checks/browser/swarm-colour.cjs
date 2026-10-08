// Browser check: on the galaxy map a tamed swarm's motes flash teal, an untamed one's red.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('swarm-colour');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const s = window.__stel.state();
    const home = s.systems[s.civ.homeSystemId];
    const near = Object.values(s.systems).filter((x) => x.id !== home.id).sort((a, b) => Math.hypot(a.pos.x - home.pos.x, a.pos.z - home.pos.z) - Math.hypot(b.pos.x - home.pos.x, b.pos.z - home.pos.z));
    const mk = (id, sys, tamed) => { s.swarms[id] = { id, systemId: sys.id, from: null, to: null, traveled: 0, distance: 0, size: 6, awake: true, tamed, appetite: 1 }; s.civ.known[sys.id] = 2; };
    mk('test_tamed', near[0], true);
    mk('test_wild', near[1], false);
    window.__stel.refresh();
    const g = window.__stel.engine().galaxy;
    const geo = g.swarmPts.geometry;
    const a = geo.getAttribute('aTamed').array;
    const c = geo.getAttribute('aCenter').array;
    // tamed flag of the motes around each swarm
    const at = (sys) => { const v = new Set(); for (let i = 0; i < a.length; i++) if (Math.abs(c[i * 3] - sys.pos.x) < 1e-3 && Math.abs(c[i * 3 + 2] - sys.pos.z) < 1e-3) v.add(a[i]); return [...v]; };
    return { tamed: at(near[0]), wild: at(near[1]), tamedName: near[0].name, wildName: near[1].name, col: g.swarmMat.uniforms.uTamedColor.value.getHexString() };
  });
  console.log(`  motes at ${info.tamedName} (tamed): ${info.tamed}; at ${info.wildName} (wild): ${info.wild}; tamed colour #${info.col}`);
  check(info.tamed.join() === '1' && info.wild.join() === '0' && info.col === '4fe3d1', `tamed motes are marked tamed, wild ones not`);
  // now the wild one is tamed too: the map follows
  const after = await page.evaluate(() => {
    const s = window.__stel.state();
    s.swarms.test_wild.tamed = true;
    window.__stel.refresh();
    const a = window.__stel.engine().galaxy.swarmPts.geometry.getAttribute('aTamed').array;
    return [...new Set(a)];
  });
  check(after.join() === '1', `after taming the other, every mote is tamed (${after})`);
  await page.evaluate(() => { const s = window.__stel.state(); s.swarms.test_wild.tamed = false; window.__stel.refresh(); window.__stel.select('swarm', 'test_tamed'); });
  await page.waitForTimeout(2500);
  await ck.shot('swarms-galaxy.png');
  await finish('SWARM COLOUR', ck);
});
