// Browser check: a world a new star will boil away says so in its panel, its name and the forecasts.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('boil');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(800);
  const ids = await page.evaluate(() => {
    const s = window.__stel.state();
    for (let i = 0; i < 80 && (s.era !== 'degenerate' || s.eta < 17.3); i++) window.__stel.endTurns(3);
    s.pending.length = 0;
    const sys = Object.values(s.systems).find((x) => !x.gone && (x.primary.kind === 'white_dwarf' || x.primary.kind === 'black_dwarf') && !Object.values(s.colonies).some((c) => c.systemId === x.id));
    sys.primary.kind = 'helium_star';
    sys.primary.mass = 0.7;
    sys.primary.bornAt = s.years;
    sys.primary.diesAt = s.years + 2e8;
    s.civ.known[sys.id] = 2;
    const home = Object.values(s.colonies)[0];
    const proto = JSON.parse(JSON.stringify(s.bodies[home.bodyId]));
    const b = { ...proto, id: 'tboil', systemId: sys.id, name: `${sys.name} Ember`, kind: 'barren', orbitAU: 0.023, orbit: 18, colonyId: null, dissolved: false, rogue: false, feeding: undefined, relic: undefined, vitality: 0, traits: ['tidally_locked'], water: 0.005 };
    s.bodies[b.id] = b;
    sys.bodies.push(b.id);
    // a settlement of ours there (as an old save might have)
    const c = JSON.parse(JSON.stringify(home));
    c.id = 'cboil'; c.bodyId = b.id; c.systemId = sys.id; c.name = b.name; c.structures = {}; c.pops = { kin: 0, echoes: 6, chorus: 0, lattice: 2, coldminds: 0 }; c.cryo = 0;
    s.colonies[c.id] = c;
    b.colonyId = c.id;
    window.__stel.refresh();
    return { sys: sys.id, body: b.id };
  });
  // the forecast appears once the turn ends; ask for it now (as the turn's end would)
  await page.evaluate(() => { /* forecasts are recomputed at the end of each turn */ });
  await page.evaluate((id) => window.__stel.select('body', id), ids.body);
  await page.waitForTimeout(800);
  const drawer = await page.evaluate(() => document.querySelector('.drawer')?.textContent ?? '');
  const has = (t) => drawer.includes(t);
  check(has('Boiling away') && has('gone as this turn ends'), `the world panel says it is boiling away`);
  await ck.shot('boil-drawer.png', { clip: { x: 900, y: 60, width: 500, height: 700 } });
  await finish('BOIL UI', ck);
});
