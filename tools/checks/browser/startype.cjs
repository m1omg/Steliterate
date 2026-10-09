// Browser check: the Surveyed worlds list sorts by the kind of star (the player's ask, 8 Oct, one
// more button, no new panel): black holes first, then neutron stars, dwarfs and the rest, nearest
// first within each. In Systems view every surveyed star is listed, those with no worlds (only
// their Deep: most black holes) too; in Planets view each world names its star's kind.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('startype');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1000);
  const expect = await page.evaluate(() => {
    const s = window.__stel.state();
    for (const x of Object.values(s.systems)) s.civ.known[x.id] = 2;
    window.__stel.refresh();
    const holes = Object.values(s.systems).filter((x) => x.primary.kind === 'black_hole' || x.primary.kind === 'smbh');
    return { holes: holes.length, bare: holes.filter((x) => !x.bodies.some((id) => s.bodies[id].kind !== 'deep')).length };
  });
  await page.keyboard.press('w');
  await page.waitForTimeout(500);
  const sysView = page.locator('.modal button', { hasText: /^Systems$/ });
  await sysView.click();
  await page.waitForTimeout(300);
  await page.locator('.modal button', { hasText: /^Type$/ }).click();
  await page.waitForTimeout(500);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.modal .list-item')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  const kinds = rows.map((r) => (/Supermassive black hole/.test(r) ? 'smbh' : /Black hole/.test(r) ? 'hole' : /Neutron star/.test(r) ? 'neutron' : /White dwarf/.test(r) ? 'white' : /Brown dwarf/.test(r) ? 'brown' : /Red dwarf/.test(r) ? 'red' : 'other'));
  const order = ['smbh', 'hole', 'neutron', 'white', 'brown', 'red', 'other'];
  const sorted = kinds.every((k, i) => i === 0 || order.indexOf(kinds[i - 1]) <= order.indexOf(k));
  console.log(`  ${rows.length} stars; first: ${rows.slice(0, 3).map((r) => r.slice(0, 60)).join(' / ')}`);
  check(sorted && kinds[0] === 'smbh', `sorted by kind: the Heart, the black holes, neutron stars, white, brown and red dwarfs (${[...new Set(kinds)].join(', ')})`);
  const holeRows = rows.filter((r) => /Black hole|Supermassive/.test(r));
  check(holeRows.length === expect.holes, `every black hole is listed, those with no worlds too (${holeRows.length} of ${expect.holes}; ${expect.bare} have only their Deep)`);
  check(rows.some((r) => /no worlds, only its Deep/.test(r)), 'a star with no worlds says so');
  await ck.shot('startype-systems.png');
  // the Planets view, sorted by type, names each world's star
  await page.locator('.modal button', { hasText: /^Planets$/ }).click();
  await page.waitForTimeout(400);
  const planets = await page.evaluate(() => [...document.querySelectorAll('.modal .list-item')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  check(planets.length > 0 && /\((Black hole|Neutron star|White dwarf|Brown dwarf|Red dwarf)/.test(planets[0]), `planets name their star's kind when sorted by it (${planets[0]?.slice(0, 70)})`);
  // and only then
  await page.locator('.modal button', { hasText: /^Nearest$/ }).click();
  await page.waitForTimeout(400);
  const near = await page.evaluate(() => document.querySelector('.modal .list-item')?.textContent.replace(/\s+/g, ' ').trim() ?? '');
  check(!/\((Black hole|Neutron star|White dwarf|Brown dwarf|Red dwarf|Blue dwarf)\)/.test(near), 'sorted otherwise, the line stays as it was');
  await finish('STAR TYPE', ck);
});
