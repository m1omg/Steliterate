// Browser check: a rogue world's panel shows no fall-in year and no orbit; a bound world still does.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('rogue');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(800);
  const ids = await page.evaluate(() => {
    const s = window.__stel.state();
    const ws = s.systems[s.civ.homeSystemId].bodies.map((id) => s.bodies[id]).filter((b) => b.kind !== 'deep' && b.inspiralAt);
    const home = ws.find((b) => b.traits.includes('homeworld'));
    const others = ws.filter((b) => b !== home);
    others[0].rogue = true;
    window.__stel.refresh();
    return { rogue: others[0].id, bound: others[1].id, home: home.id };
  });
  // rows of the open panel, as "label: value"
  const rows = () => page.evaluate(() => {
    const out = {};
    const dts = document.querySelectorAll('.drawer dl.kv dt');
    for (const dt of dts) out[dt.textContent.trim()] = dt.nextElementSibling?.textContent.trim();
    return out;
  });
  const show = async (id) => { await page.evaluate((id) => window.__stel.select('body', id), id); await page.waitForTimeout(600); return rows(); };
  const r = await show(ids.rogue);
  console.log(`  rogue world: Orbit "${r['Orbit']}", Falls inward "${r['Falls inward']}"`);
  check(r['Orbit'] === 'none: adrift' && r['Falls inward'] === 'never: adrift', `a rogue world shows no orbit and never falls in`);
  const chips = await page.evaluate(() => [...document.querySelectorAll('.drawer .chip')].map((c) => c.textContent.trim()));
  check(chips.includes('rogue') && !chips.includes('Tidally locked'), `its chips: ${chips.join(', ')}`);
  await ck.shot('rogue-world.png', { clip: { x: 900, y: 60, width: 500, height: 760 } });
  const k = await show(ids.bound);
  console.log(`  bound world: Orbit "${k['Orbit']}", Falls inward "${k['Falls inward']}"`);
  check(/AU$/.test(k['Orbit'] ?? '') && /years$/.test(k['Falls inward'] ?? ''), `a bound world still shows its orbit and year`);
  await show(ids.home);
  const chipsK = await page.evaluate(() => [...document.querySelectorAll('.drawer .chip')].map((c) => c.textContent.trim()));
  check(chipsK.includes('Tidally locked'), `our homeworld, still bound and locked, keeps its chip: ${chipsK.join(', ')}`);
  // our own settlement, flung loose
  await page.evaluate((id) => { window.__stel.state().bodies[id].rogue = true; window.__stel.refresh(); }, ids.home);
  const h = await show(ids.home);
  console.log(`  our homeworld, flung loose: Falls inward "${h['Falls inward']}"`);
  check(h['Falls inward'] === 'never: adrift', `the settlement panel says so too`);
  const chipsH = await page.evaluate(() => [...document.querySelectorAll('.drawer .chip')].map((c) => c.textContent.trim()));
  check(!chipsH.includes('Tidally locked'), `and drops the locked chip: ${chipsH.join(', ')}`);
  await finish('ROGUE UI', ck);
});
