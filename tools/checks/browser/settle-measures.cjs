// Browser check: every measure, the sorted one marked. A Kin Ark's Where to settle list shows each
// world's livable ground, power, matter and lasting, sorted by Livable (its own) with that marked;
// Power re-sorts it and marks power; Nearest marks the trip instead. Its Nearby list follows the
// same sort. The Systems window lists each settlement's yields each turn, as its panel shows them,
// and Surveyed worlds shows every measure with its sort marked.
const { check, start, finish, run } = require('../lib.cjs');

/** The settle list's rows (or Nearby's): their strips, which cell is marked, and the trip mark. */
const rows = (page, heading) =>
  page.evaluate((heading) => {
    const h = [...document.querySelectorAll('.drawer h3')].find((x) => x.textContent.includes(heading));
    const list = h?.parentElement?.querySelector('.list');
    return [...(list?.querySelectorAll(':scope > .list-item') ?? [])].map((r) => {
      const cells = [...r.querySelectorAll('.site-strip > span')];
      return {
        cells: cells.map((c) => c.textContent.trim()),
        marked: cells.findIndex((c) => c.classList.contains('sorted')),
        trip: !!r.querySelector(':scope > .mark.sorted'),
        strip: cells.length > 0,
      };
    });
  }, heading);
const heading = (page, text) => page.evaluate((text) => [...document.querySelectorAll('.drawer h3')].find((x) => x.textContent.includes(text))?.textContent.replace(/\s+/g, ' ').trim() ?? '', text);
const num = (t) => Number((t.match(/-?[\d.]+/) ?? ['NaN'])[0]);
const nonIncreasing = (xs) => xs.every((x, i) => i === 0 || x <= xs[i - 1] + 1e-9);

run(async () => {
  const ck = await start('settle-measures', { seed: 1000 });
  const { page } = ck;
  await page.evaluate(() => {
    window.__stel.endTurns(40);
    const s = window.__stel.state();
    const cap = s.colonies[s.civ.capitalId];
    const f = Object.values(s.fleets)[0];
    Object.assign(f, { at: cap.systemId, to: null, from: null, traveled: 0, distance: 0, order: 'idle', auto: undefined, ships: [{ cls: 'ark', hp: 6 }] });
    s.pending.length = 0;
    window.__stel.refresh();
    window.__stel.select('fleet', f.id);
  });
  await page.waitForTimeout(900);
  // Livable, the Ark's own
  let r = await rows(page, 'Where to settle');
  check(r.length > 1 && r.every((x) => x.cells.length === 4), `each world shows four measures (${r.length} worlds: ${r[0]?.cells.join(' | ')})`);
  check(r.every((x) => x.marked === 0 && !x.trip), 'sorted by Livable, the Kin’s own, and Livable is marked');
  const rooms = r.map((x) => (/(\d+) room/.test(x.cells[0]) ? Number(x.cells[0].match(/(\d+) room/)[1]) : 0));
  check(nonIncreasing(rooms), `most room first (${rooms.join(', ')})`);
  let nb = await rows(page, 'Nearby');
  check(/Nearby · most livable first/.test(await heading(page, 'Nearby')) && nb.filter((x) => x.strip).every((x) => x.marked === 0), 'Nearby follows it, Livable marked');
  await ck.shot('livable.png');
  // Power
  await page.locator('.drawer button', { hasText: /^Power$/ }).first().click();
  await page.waitForTimeout(500);
  r = await rows(page, 'Where to settle');
  const power = r.map((x) => num(x.cells[1]));
  check(r.every((x) => x.marked === 1) && nonIncreasing(power), `Power: marked, and the most power first (${power.join(', ')})`);
  nb = await rows(page, 'Nearby');
  const nbPower = nb.filter((x) => x.strip).map((x) => num(x.cells[1]));
  check(/most power first/.test(await heading(page, 'Nearby')) && nb.filter((x) => x.strip).every((x) => x.marked === 1) && nonIncreasing(nbPower), `Nearby too (${nbPower.join(', ')})`);
  await ck.shot('power.png');
  // Nearest: the trip is marked, no measure
  await page.locator('.drawer button', { hasText: /^Nearest$/ }).first().click();
  await page.waitForTimeout(500);
  r = await rows(page, 'Where to settle');
  check(r.every((x) => x.marked === -1 && x.trip), 'Nearest: the trip is marked instead');
  check(/Nearby · nearest first/.test(await heading(page, 'Nearby')), 'and Nearby is nearest first');
  // the Systems window: each settlement's yields, as its panel shows them
  await page.evaluate(() => window.__stel.select('fleet', null));
  await page.keyboard.press('s');
  await page.waitForTimeout(700);
  const list = await page.evaluate(() => ({
    heads: document.querySelectorAll('.yield-heads .yield-cells > span').length,
    rows: [...document.querySelectorAll('.settlement-row')].map((r) => ({
      name: r.querySelector('.grow')?.firstChild?.textContent?.trim() ?? '',
      cells: [...r.querySelectorAll('.yield-cells > span')].map((c) => c.textContent.trim()),
      tip: r.querySelector('.yield-cells > span')?.dataset.tip ?? '',
    })),
  }));
  check(list.heads === 5 && list.rows.length > 0 && list.rows.every((x) => x.cells.length === 5), `five columns under their icons, for ${list.rows.length} settlements (${list.rows[0]?.name}: ${list.rows[0]?.cells.join(' ')})`);
  check(/^Energy: captured minus upkeep/.test(list.rows[0]?.tip ?? ''), 'each value explains itself');
  await ck.shot('settlements.png');
  // the same numbers as the capital's own panel
  const panel = await page.evaluate(() => {
    const s = window.__stel.state();
    window.__stel.select('body', s.colonies[s.civ.capitalId].bodyId);
    return s.colonies[s.civ.capitalId].name;
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  const own = await page.evaluate(() => [...document.querySelectorAll('.drawer .yields .yv .mono')].map((x) => x.textContent.trim()));
  const capRow = list.rows.find((x) => x.name === panel);
  check(!!capRow && own.length === 5 && own.join(' ') === capRow.cells.join(' '), `${panel}: the list says what its panel says (${own.join(' ')})`);
  // Surveyed worlds: every measure, the sort marked
  await page.keyboard.press('w');
  await page.waitForTimeout(800);
  const strips = () =>
    page.evaluate(() => {
      const rs = [...document.querySelectorAll('.modal .world-row')];
      return {
        n: rs.length,
        four: rs.every((r) => r.querySelectorAll('.site-strip > span').length === 4),
        marked: [...new Set(rs.map((r) => [...r.querySelectorAll('.site-strip > span')].findIndex((c) => c.classList.contains('sorted'))))],
        dist: rs.every((r) => !!r.querySelector('.faint .mark.sorted')),
      };
    });
  let w = await strips();
  check(w.n > 0 && w.four && w.marked.length === 1 && w.marked[0] === 0, `Surveyed worlds: four measures on each of ${w.n}, Livable marked for Habitable`);
  await page.locator('.modal button', { hasText: /^Power$/ }).first().click();
  await page.waitForTimeout(500);
  w = await strips();
  check(w.marked.length === 1 && w.marked[0] === 1, 'Power marks power');
  await page.locator('.modal button', { hasText: /^Nearest$/ }).first().click();
  await page.waitForTimeout(500);
  w = await strips();
  check(w.marked.length === 1 && w.marked[0] === -1 && w.dist, 'Nearest marks the distance');
  await page.locator('.modal button', { hasText: /^Systems$/ }).first().click();
  await page.waitForTimeout(500);
  w = await strips();
  check(w.n > 0 && w.four && w.dist, `one line per star, with its best world for each measure (${w.n} stars)`);
  await ck.shot('worlds.png');
  await finish('SETTLE MEASURES', ck);
});
