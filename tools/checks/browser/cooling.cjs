// Browser check: honest temperatures. In the Degenerate Age a white dwarf nothing warms reads in
// millikelvins (or colder), not "5 K"; a black hole shows its Hawking temperature; a cold world
// reads below a kelvin, not "1 K"; a collector there says it has nothing to gather.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('cooling', { seed: 1000 });
  const { page } = ck;
  const ids = await page.evaluate(() => {
    const s = window.__stel.state();
    for (let i = 0; i < 60 && (s.era !== 'degenerate' || s.eta < 16); i++) window.__stel.endTurns(3);
    s.pending.length = 0;
    const free = (x) => !x.gone && !Object.values(s.colonies).some((c) => c.systemId === x.id) && x.bodies.some((id) => s.bodies[id] && s.bodies[id].kind !== 'deep' && !s.bodies[id].dissolved);
    const cold = Object.values(s.systems).find((x) => free(x) && (x.primary.kind === 'black_dwarf' || (x.primary.kind === 'white_dwarf' && !x.primary.halo)) && !x.primary.rekindle);
    const hole = Object.values(s.systems).find((x) => !x.gone && x.primary.kind === 'black_hole');
    for (const x of [cold, hole]) s.civ.known[x.id] = 2;
    const w = cold.bodies.map((id) => s.bodies[id]).find((b) => b && b.kind !== 'deep' && !b.dissolved);
    window.__stel.refresh();
    return { era: s.era, eta: s.eta, cold: cold.id, coldName: cold.name, hole: hole.id, world: w.id };
  });
  check(ids.era === 'degenerate', `in the Degenerate Age (η ${ids.eta.toFixed(2)})`);
  const rows = () =>
    page.evaluate(() => {
      const o = {};
      for (const dt of document.querySelectorAll('.drawer dl.kv dt')) o[dt.textContent.trim()] = { v: dt.nextElementSibling?.textContent.trim(), tip: dt.dataset.tip ?? '' };
      return o;
    });
  await page.evaluate((id) => window.__stel.select('system', id), ids.cold);
  await page.waitForTimeout(800);
  let r = await rows();
  console.log(`  ${ids.coldName}: ${JSON.stringify(r.Temperature)}; light ${JSON.stringify(r['Light for collectors']?.v)}`);
  check(/(mK|µK|nK|×10)/.test(r.Temperature?.v ?? ''), `a cold dwarf reads its real temperature (${r.Temperature?.v}), not 5 K`);
  check(/T⁴/.test(r.Temperature?.tip ?? ''), 'its tooltip says why usable energy falls as T⁴');
  check(r['Light for collectors']?.v === 'none', `and collectors get nothing there (${r['Light for collectors']?.v})`);
  await ck.shot('cold-dwarf.png', { clip: { x: 900, y: 60, width: 500, height: 700 } });
  await page.evaluate((id) => window.__stel.select('system', id), ids.hole);
  await page.waitForTimeout(800);
  r = await rows();
  check(/nK|×10/.test(r['Hawking temperature']?.v ?? ''), `a black hole shows its Hawking temperature (${r['Hawking temperature']?.v})`);
  await page.evaluate((id) => window.__stel.select('body', id), ids.world);
  await page.waitForTimeout(800);
  r = await rows();
  check(/(mK|µK|nK|×10)/.test(r.Temperature?.v ?? ''), `a world around it reads below a kelvin (${r.Temperature?.v}), not 1 K`);
  await ck.shot('cold-world.png', { clip: { x: 900, y: 60, width: 500, height: 700 } });
  await finish('COOLING UI', ck);
});
