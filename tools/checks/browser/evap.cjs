// Browser check: after a black hole evaporates, its system stays on the map, opens, and its worlds read adrift.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('evap');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 2360862 }));
  await page.waitForTimeout(800);
  // play into the Black Hole Age
  for (let i = 0; i < 40; i++) {
    const era = await page.evaluate(() => { window.__stel.endTurns(5); const s = window.__stel.state(); s.pending.length = 0; return s.era; });
    if (era === 'blackhole') break;
  }
  const info = await page.evaluate(() => {
    const s = window.__stel.state();
    const worlds = (x) => x.bodies.some((id) => { const b = s.bodies[id]; return b && !b.dissolved && b.kind !== 'deep'; });
    let sys = Object.values(s.systems).find((x) => x.primary.kind === 'black_hole' && !x.gone && worlds(x));
    // no hole with worlds left in this game: make one of a star nobody lives at
    if (!sys) {
      sys = Object.values(s.systems).find((x) => !x.gone && !x.special && worlds(x) && !Object.values(s.colonies).some((c) => c.systemId === x.id));
      Object.assign(sys.primary, { kind: 'black_hole', mass: 10, spin: 100, spinMax: 100 });
    }
    sys.primary.evaporateAt = s.years * (1 + 1e-12);
    s.civ.known[sys.id] = 2;
    window.__stel.endTurns(1, false);
    s.pending.length = 0;
    window.__stel.refresh();
    const w = sys.bodies.map((id) => s.bodies[id]).find((b) => b && !b.dissolved && b.kind !== 'deep');
    return { era: s.era, sys: sys.id, name: sys.name, kind: sys.primary.kind, gone: sys.gone, world: w.id, rogue: w.rogue };
  });
  console.log(`  ${info.era}: ${info.name} is now ${info.kind}, gone ${info.gone}; world rogue ${info.rogue}`);
  check(info.kind === 'void' && !info.gone && info.rogue, `its system stays, its world adrift`);
  await page.evaluate((id) => window.__stel.select('system', id), info.sys);
  await page.waitForTimeout(1200);
  const head = await page.evaluate(() => document.querySelector('.drawer .drawer-head')?.textContent.replace(/\s+/g, ' ').trim());
  console.log(`  star panel: ${head?.slice(0, 120)}`);
  check(/Empty/.test(head ?? '') && !/gone/.test(head ?? ''), `its panel reads Empty, not gone`);
  // open it the way a player does: the star panel's Look inside
  await page.locator('.drawer button', { hasText: /Look inside/ }).first().click();
  let v = 'galaxy';
  for (let i = 0; i < 40 && v !== 'system'; i++) { await page.waitForTimeout(500); v = await page.evaluate(() => window.__stel.engine().view); }
  const built = await page.evaluate(() => { const e = window.__stel.engine(); return { bodies: e.system.pickables.filter((p) => p.id.startsWith('body:')).length }; });
  console.log(`  system view: ${built.bodies} worlds drawn`);
  check(v === 'system', `the system opens (view: ${v})`);
  await page.evaluate((id) => window.__stel.select('body', id), info.world);
  await page.waitForTimeout(1000);
  const rows = await page.evaluate(() => { const o = {}; for (const dt of document.querySelectorAll('.drawer dl.kv dt')) o[dt.textContent.trim()] = dt.nextElementSibling?.textContent.trim(); return o; });
  console.log(`  world: Orbit "${rows['Orbit']}", Falls inward "${rows['Falls inward']}"`);
  check(rows['Orbit'] === 'none: adrift', `its world reads adrift`);
  await ck.shot('evap-system.png');
  await finish('EVAP UI', ck);
});
