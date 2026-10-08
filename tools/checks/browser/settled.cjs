// Browser check: a settlement in the Deep of a black hole that has evaporated (no star left) shows
// on the galaxy map: a node with our ring, its name, and a click on it opens the system, whose
// panel says no star is left and what was around it drifts on. (Why such a system is no longer
// marked gone is checked in unit/settled.)
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('settled');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(800);
  const sys = await page.evaluate(() => {
    const s = window.__stel.state();
    const home = s.systems[s.civ.homeSystemId];
    const near = Object.values(s.systems)
      .filter((x) => !x.special && x.id !== home.id && !Object.values(s.colonies).some((c) => c.systemId === x.id))
      .sort((a, b) => Math.hypot(a.pos.x - home.pos.x, a.pos.z - home.pos.z) - Math.hypot(b.pos.x - home.pos.x, b.pos.z - home.pos.z))[0];
    // the hole has evaporated: no star, its worlds long gone, our people in its Deep
    Object.assign(near.primary, { kind: 'void', lum: 0, spin: 0, spinMax: 0 });
    let deep = null;
    for (const id of near.bodies) {
      const b = s.bodies[id];
      if (b.kind === 'deep') deep = b;
      else b.dissolved = true;
    }
    const cap = s.colonies[s.civ.capitalId];
    s.colonies.cz = { ...cap, id: 'cz', bodyId: deep.id, systemId: near.id, name: `${near.name} Deep`, pops: { kin: 0, echoes: 2, chorus: 0, lattice: 0, coldminds: 0 }, structures: {}, queue: [] };
    deep.colonyId = 'cz';
    s.civ.known[near.id] = 2;
    window.__stel.refresh();
    return { id: near.id, name: near.name };
  });
  await page.evaluate((id) => window.__stel.select('system', id), sys.id);
  await page.waitForTimeout(2500);
  const seen = await page.evaluate((sys) => {
    const e = window.__stel.engine();
    const p = e.galaxy.pickables.find((q) => q.kind === 'system' && q.id === sys.id);
    const label = [...document.querySelectorAll('.map-label')].find((l) => l.textContent.trim() === sys.name && l.style.display !== 'none');
    return { pick: !!p, at: p ? e.screenOf(p.pos) : null, label: label ? label.className : null };
  }, sys);
  console.log(`  ${sys.name}: on the map ${seen.pick}, label ${seen.label}`);
  check(seen.pick, 'the system of an evaporated hole we live in has a node on the galaxy map');
  check(/\bmine\b/.test(seen.label ?? ''), 'and its name, marked as ours');
  // a real click on it, after selecting something else
  await page.evaluate(() => window.__stel.select('system', window.__stel.state().civ.homeSystemId));
  await page.waitForTimeout(400);
  await page.mouse.click(seen.at.x, seen.at.y);
  await page.waitForTimeout(700);
  const opened = await page.evaluate(() => [...document.querySelectorAll('.drawer h2')].map((h) => h.textContent.trim()).join(' | '));
  console.log(`  clicked: ${opened}`);
  check(opened.includes(sys.name), 'a click on it opens the system');
  const panel = await page.evaluate(() => document.querySelector('.drawer')?.textContent.replace(/\s+/g, ' ') ?? '');
  check(/No star left/.test(panel) && /what was around it drifts on/.test(panel) && !/Nothing remains/.test(panel) && !/\bMass\b/.test(panel), 'its panel: no star left, what was around it drifts on (not "Nothing remains"), and no mass for a star that is gone');
  await ck.shot('settled-map.png');
  await finish('SETTLED UI', ck);
});
