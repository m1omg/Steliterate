// Browser check: a world's panel agrees with its climate, in any game (display rules, computed live).
// - A world with no star shows its real temperature (the galaxy's glow, about 1 K in the Dusk, and
//   its own heat), and Sunlight and Orbit "none: no star".
// - Gas and ice giants show a temperature; neither has a Water row, a gas giant no Sunlight.
// - A black hole's disk warms its world; the hole's light for collectors reads ×0.05, not ×0.1.
// - A white dwarf of the Dusk too cool to glow is drawn as an ember is, a little more copper.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('worlds');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(800);
  const ids = await page.evaluate(() => {
    const s = window.__stel.state();
    const all = Object.values(s.systems);
    const free = (b) => b && !b.dissolved && b.kind !== 'deep' && !b.colonyId;
    const find = (sys, f) => { for (const x of sys) { const b = x.bodies.map((id) => s.bodies[id]).find((b) => free(b) && f(b)); if (b) return b; } return null; };
    const starless = find(all.filter((x) => x.primary.kind === 'rogue'), () => true);
    const gas = find(all, (b) => b.kind === 'gas_giant');
    const ice = find(all, (b) => b.kind === 'ice_giant');
    const hole = find(all.filter((x) => x.primary.kind === 'black_hole'), () => true);
    const wd = all.find((x) => x.primary.kind === 'white_dwarf' && !x.special && !x.primary.whiteAt && x.bodies.some((id) => free(s.bodies[id])));
    for (const b of [starless, gas, ice, hole]) if (b) s.civ.known[b.systemId] = 2;
    s.civ.known[wd.id] = 2;
    window.__stel.refresh();
    return { starless: starless?.id, gas: gas?.id, ice: ice?.id, hole: hole?.id, holeSys: hole?.systemId, wd: wd.id };
  });
  check(ids.starless && ids.gas && ids.ice && ids.hole, `seed 1000 has a starless world, both giants and a black hole's world`);
  const rows = () => page.evaluate(() => {
    const out = {};
    for (const dt of document.querySelectorAll('.drawer dl.kv dt')) out[dt.textContent.trim()] = dt.nextElementSibling?.textContent.trim();
    return out;
  });
  const show = async (kind, id) => { await page.evaluate(([k, id]) => window.__stel.select(k, id), [kind, id]); await page.waitForTimeout(600); return rows(); };
  const kelvins = (t) => { const m = /^([\d.,]+) (K|mK)/.exec(t ?? ''); return m ? Number(m[1].replace(/,/g, '')) * (m[2] === 'mK' ? 1e-3 : 1) : NaN; };

  const r = await show('body', ids.starless);
  console.log(`  starless: Temperature "${r['Temperature']}", Sunlight "${r['Sunlight']}", Orbit "${r['Orbit']}"`);
  check(kelvins(r['Temperature']) >= 1 && !/horizon/.test(r['Temperature']), `a world with no star shows the glow and its own heat, not the horizon's`);
  check(r['Sunlight'] === 'none: no star' && r['Orbit'] === 'none: no star', `no sunlight and no orbit, for want of a star`);
  await ck.shot('starless.png', { clip: { x: 900, y: 60, width: 500, height: 760 } });

  const g = await show('body', ids.gas);
  console.log(`  gas giant: Temperature "${g['Temperature']}", Water ${g['Water'] === undefined ? 'none' : `"${g['Water']}"`}, Sunlight ${g['Sunlight'] === undefined ? 'none' : `"${g['Sunlight']}"`}`);
  check(kelvins(g['Temperature']) > 0 && g['Water'] === undefined && g['Sunlight'] === undefined, `a gas giant shows its temperature, and no water or sunlight row`);
  const i = await show('body', ids.ice);
  console.log(`  ice giant: Temperature "${i['Temperature']}", Water ${i['Water'] === undefined ? 'none' : `"${i['Water']}"`}`);
  check(kelvins(i['Temperature']) > 0 && i['Water'] === undefined, `an ice giant shows its temperature, and no water row`);

  const h = await show('body', ids.hole);
  console.log(`  black hole's world: Temperature "${h['Temperature']}"`);
  check(kelvins(h['Temperature']) > 4, `its black hole's faint disk warms it past 4 K`);
  const star = await show('system', ids.holeSys);
  console.log(`  the hole: Light for collectors "${star['Light for collectors']}", Hawking temperature "${star['Hawking temperature']}"`);
  check(star['Light for collectors'] === '×0.05', `a faint disk's light reads ×0.05`);

  // a cold white dwarf, looked at from inside its system
  await page.evaluate((id) => window.__stel.select('system', id), ids.wd);
  await page.waitForTimeout(600);
  const temp = (await rows())['Temperature'];
  console.log(`  white dwarf: Temperature "${temp}"`);
  await page.locator('.drawer button', { hasText: /Look inside/ }).first().click();
  let view = 'galaxy';
  for (let n = 0; n < 40 && view !== 'system'; n++) { await page.waitForTimeout(250); view = await page.evaluate(() => window.__stel.engine().view); }
  check(view === 'system' && kelvins(temp) < 780, `inside a white dwarf's system (${view}), the dwarf ${temp}, too cool to glow`);
  await page.waitForTimeout(1500);
  await ck.shot('cold-white-dwarf.png');
  await finish('WORLDS UI', ck);
});
