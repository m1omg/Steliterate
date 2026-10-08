// Browser check: on the galaxy map and in a system, a click on a swarm's cloud selects the swarm; on its star, the star.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('swarm-click');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(800);
  const sysId = await page.evaluate(() => {
    const s = window.__stel.state();
    const home = s.systems[s.civ.homeSystemId];
    const near = Object.values(s.systems).filter((x) => x.id !== home.id).sort((a, b) => Math.hypot(a.pos.x - home.pos.x, a.pos.z - home.pos.z) - Math.hypot(b.pos.x - home.pos.x, b.pos.z - home.pos.z))[0];
    s.swarms.test_sw = { id: 'test_sw', systemId: near.id, from: null, to: null, traveled: 0, distance: 0, size: 6, awake: true, tamed: false, appetite: 1 };
    s.civ.known[near.id] = 2;
    window.__stel.refresh();
    return near.id;
  });
  // centre the galaxy view on that star, then go in a little
  await page.evaluate((id) => { window.__stel.select('system', id); }, sysId);
  await page.waitForTimeout(2500);
  const probe = async (label) => page.evaluate((label) => {
    const e = window.__stel.engine();
    const list = e.view === 'galaxy' ? e.galaxy.pickables : e.system.pickables;
    const sw = list.find((p) => p.kind === 'swarm');
    const star = e.view === 'galaxy' ? list.find((p) => p.kind === 'system' && p.id === window.__stel.state().swarms.test_sw.systemId) : null;
    const c = e.screenOf(sw.pos);
    const st = star ? e.screenOf(star.pos) : null;
    // the cloud's size on screen: project a point one radius to the side
    const edge = sw.pos.clone(); edge.x += sw.radius;
    const ce = e.screenOf(edge);
    const rpx = Math.hypot(ce.x - c.x, ce.y - c.y);
    const res = [];
    // pixels per world unit at distance 1, as the picker sizes a body's disc
    const rect = e.renderer.domElement.getBoundingClientRect();
    const pxPerUnit = rect.height / 2 / Math.tan(((e.camera.fov / 2) * Math.PI) / 180);
    for (const [dx, dy] of [[0, 0], [rpx * 0.5, 0], [-rpx * 0.6, rpx * 0.3], [0, -rpx * 0.7], [rpx * 0.8, rpx * 0.4]]) {
      const x = c.x + dx;
      const y = c.y + dy;
      const p = e.pickAt(x, y);
      if (!p || p.kind === 'swarm') {
        res.push(p ? 'swarm' : 'none');
        continue;
      }
      // something else won: how far it is from the pointer (as the picker measures), and its disc
      const o = e.screenOf(p.pos);
      const d = Math.hypot(o.x - x, o.y - y) - (p.kind === 'fleet' ? 4 : 0);
      const disc = p.radius ? (p.radius * pxPerUnit) / Math.max(1e-3, e.camera.position.distanceTo(p.pos)) : 0;
      res.push(`${p.id} [${d.toFixed(2)}px off, disc ${disc.toFixed(2)}px]`);
    }
    const onStar = st ? e.pickAt(st.x, st.y) : null;
    return { label, rpx: Math.round(rpx), res, onStar: onStar ? onStar.kind : null, view: e.view, c };
  }, label);
  const g = await probe('galaxy');
  console.log(`  galaxy: cloud ${g.rpx} px across its radius; clicks on it pick ${g.res.join(', ')}; right on the star picks ${g.onStar}`);
  // on the cloud, the swarm is picked unless something solid is right under the pointer: within half
  // the picker's reach (8 px on the map, 13 in a system) or on its own disc (4 px of slack)
  const fair = (r, half) =>
    r.every((k) => {
      if (k === 'swarm') return true;
      const m = /\[([\d.]+)px off, disc ([\d.]+)px\]/.exec(k);
      return !!m && (Number(m[1]) <= half || Number(m[1]) <= Number(m[2]) + 4);
    });
check(fair(g.res, 8) && g.res.filter((k) => k === 'swarm').length >= 3 && g.onStar === 'system', `galaxy map: the cloud picks the swarm (but a star right under the pointer wins), the star still picks the star`);
  // a real click on the cloud, away from the star
  await page.mouse.click(g.c.x + g.rpx * 0.6, g.c.y - g.rpx * 0.3);
  await page.waitForTimeout(700);
  const sel = await page.evaluate(() => [...document.querySelectorAll('.drawer h2')].map((h) => h.textContent.trim()).join(' | '));
  check(/The Hunger/.test(sel), `a real click on the cloud opens the swarm (${sel})`);
  await ck.shot('swarm-click-galaxy.png');
  // inside the system
  await page.evaluate((id) => { const e = window.__stel.engine(); e.showSystem(id); }, sysId);
  await page.waitForTimeout(3000);
  const sv = await probe('system');
  console.log(`  system: cloud ${sv.rpx} px across its radius; clicks on it pick ${sv.res.join(', ')}`);
  check(sv.view === 'system' && fair(sv.res, 13) && sv.res.filter((k) => k === 'swarm').length >= 3, `system view: the cloud picks the swarm (a world right under the pointer wins)`);
  await finish('SWARM CLICK', ck);
});
