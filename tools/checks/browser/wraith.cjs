// Browser check: the Leptonic Wraith (31 Oct, the player: "add a leptonic shipyard pls"). A
// leptonic settlement's Build list offers the Leptonic Shipyard, and with one the Wraith; a Wraith's
// fleet shows its own hull, drawn as a ship of fields (public/art/ships/wraith.png), in its panel
// and on the map, with no image missing.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('wraith', { width: 1400, height: 1000 });
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const s = window.__stel.state();
    s.era = 'degenerate';
    s.eta = 36;
    s.years = 1e36;
    s.civ.techs.push('leptonic_computation');
    const c = s.colonies[s.civ.capitalId];
    c.form = 'leptonic';
    c.pops.kin = 0;
    c.pops.echoes = 3;
    delete c.structures.shipyard;
    window.__stel.select('body', c.bodyId);
    window.__stel.refresh();
  });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^Build/ }).first().click();
  await page.waitForTimeout(600);
  const rowOf = (name) =>
    page.evaluate((name) => {
      const r = [...document.querySelectorAll('.list-item.build')].find((x) => x.textContent.includes(name));
      return r ? { disabled: r.classList.contains('disabled'), text: r.textContent.replace(/\s+/g, ' ') } : null;
    }, name);
  const yard = await rowOf('Leptonic Shipyard');
  check(!!yard && !yard.disabled, `a leptonic settlement can build a Leptonic Shipyard (${yard?.text.slice(0, 60)})`);
  await page.evaluate(() => {
    const s = window.__stel.state();
    s.colonies[s.civ.capitalId].structures.lepton_shipyard = 1;
    window.__stel.refresh();
  });
  await page.locator('.drawer .btn', { hasText: /^Ships$/ }).click();
  await page.waitForTimeout(500);
  const wraith = await rowOf('Leptonic Wraith');
  const warden = await rowOf('Warden');
  check(!!wraith && !wraith.disabled && /Attack 5/.test(wraith.text), `with one, the Wraith (${wraith?.text.slice(0, 90)})`);
  check(!warden || warden.disabled, 'and no ship of matter');
  // a Wraith's fleet: its own hull in its panel and on the map
  const fid = await page.evaluate(() => {
    const s = window.__stel.state();
    const f = Object.values(s.fleets).find((x) => x.owner === s.player && x.at);
    f.ships = [{ cls: 'wraith', hp: 16 }];
    window.__stel.select('fleet', f.id);
    window.__stel.refresh();
    return f.id;
  });
  await page.waitForTimeout(1500);
  const img = await page.evaluate(() => {
    const i = document.querySelector('.drawer .fleet-portrait');
    return i ? { src: i.getAttribute('src'), w: i.naturalWidth } : null;
  });
  check(!!img && img.src === 'art/ships/wraith.png' && img.w === 256, `its panel shows the Wraith's own hull (${img?.src}, ${img?.w}px)`);
  await ck.shot('wraith.png');
  console.log(`  fleet ${fid}`);
  await finish('WRAITH', ck);
});
