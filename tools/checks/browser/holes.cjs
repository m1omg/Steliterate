// Browser check: the Black Hole Age as it is (12 Oct, the player). "An option to see black holes by
// their lifetime": the Systems window has a Black holes tab, every hole on our map, the
// longest-lasting first, with years and turns left; a hole's panel says when it evaporates; a
// Vault Ship's Lasting tells holes apart (it read ∞ at every one). A brown dwarf's mass reads in
// figures, not "0 M☉", and its words follow its warmth. And a finished Great Work says so instead
// of offering Resume (the player's Aeon Seed at 2,122 of 1,700).
const { check, start, finish, run } = require('../lib.cjs');

run(async () => {
  const ck = await start('holes', { seed: 1000 });
  const { page } = ck;
  // the Black Hole Age, η 60, every hole on the map and surveyed
  const want = await page.evaluate(() => {
    const s = window.__stel.state();
    s.era = 'blackhole';
    s.years = 1e60;
    s.eta = 60;
    s.civ.pending.length = 0;
    const holes = Object.values(s.systems).filter((x) => (x.primary.kind === 'black_hole' || x.primary.kind === 'smbh') && !x.gone);
    for (const h of holes) s.civ.known[h.id] = 2;
    window.__stel.refresh();
    return holes.sort((a, b) => b.primary.evaporateAt - a.primary.evaporateAt).map((h) => h.name);
  });
  await page.keyboard.press('s');
  await page.waitForTimeout(600);
  const tab = page.locator('.modal button', { hasText: 'Black holes' });
  check((await tab.count()) === 1, 'in the Black Hole Age the Systems window has a Black holes tab');
  await tab.click();
  await page.waitForTimeout(800);
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('.modal .list-item')].map((r) => ({
      name: r.querySelector('.grow')?.firstChild?.textContent?.trim() ?? '',
      text: r.textContent.replace(/\s+/g, ' ').trim(),
      left: r.querySelector(':scope > .mono')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
    })),
  );
  console.log(`  ${rows.length} holes: ${rows.slice(0, 4).map((r) => `${r.name} (${r.left})`).join(' | ')} … ${rows.slice(-1).map((r) => `${r.name} (${r.left})`)}`);
  check(rows.length === want.length && rows.every((r, i) => r.name === want[i]), `every hole on the map, the longest-lasting first (${rows.length}; first ${rows[0]?.name})`);
  check(rows[0]?.name === 'The Heart', 'the Heart, which lasts longest, at the top');
  check(rows.every((r) => /M☉/.test(r.text) && /yr/.test(r.left) && /turns left|goes this turn/.test(r.left)), 'each with its mass, its years left and its turns left');
  const eyebrow = await page.evaluate(() => document.querySelector('.modal .modal-head .eyebrow')?.textContent.trim());
  check(/^Black holes: \d+ on our map, the longest-lasting first$/.test(eyebrow ?? ''), `the eyebrow says so (${eyebrow})`);
  await ck.shot('holes-tab.png');
  // one about to go
  await page.evaluate(() => {
    const s = window.__stel.state();
    const h = Object.values(s.systems).filter((x) => x.primary.kind === 'black_hole' && !x.gone).sort((a, b) => a.primary.evaporateAt - b.primary.evaporateAt)[0];
    h.primary.evaporateAt = s.years * 1.5;
    window.__stel.refresh();
  });
  await page.waitForTimeout(500);
  const last = await page.evaluate(() => [...document.querySelectorAll('.modal .list-item')].slice(-1)[0]?.textContent.replace(/\s+/g, ' ').trim());
  check(/goes this turn/.test(last ?? ''), `one evaporating this turn says so, last (${(last ?? '').slice(-60)})`);
  // a hole's panel says when it evaporates
  await page.locator('.modal .list-item').first().click();
  await page.waitForTimeout(900);
  const evap = await page.evaluate(() => {
    const dt = [...document.querySelectorAll('.drawer dt')].find((x) => x.textContent.trim() === 'Evaporates');
    return dt ? dt.nextElementSibling.textContent.trim() : null;
  });
  check(!!evap && /^in 10/.test(evap) && /turns/.test(evap), `the Heart’s panel: Evaporates ${evap}`);
  const mass = await page.evaluate(() => {
    const dt = [...document.querySelectorAll('.drawer dt')].find((x) => x.textContent.trim() === 'Mass');
    return dt ? dt.nextElementSibling.textContent.trim() : null;
  });
  check(/×10/.test(mass ?? '') && !/e\+/.test(mass ?? ''), `its mass in powers of ten (${mass})`);
  await ck.shot('heart-panel.png');

  // a Vault Ship at the Heart: Lasting tells the holes apart
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const s = window.__stel.state();
    const heart = Object.values(s.systems).find((x) => x.primary.kind === 'smbh');
    const f = Object.values(s.fleets).find((x) => x.owner === s.player);
    Object.assign(f, { at: heart.id, to: null, from: null, traveled: 0, distance: 0, order: 'idle', auto: undefined, ships: [{ cls: 'vaultship', hp: 8 }] });
    s.civ.techs.push('cold_computation');
    window.__stel.refresh();
    window.__stel.select('fleet', f.id);
  });
  await page.waitForTimeout(900);
  const lasting = await page.evaluate(() => {
    const h = [...document.querySelectorAll('.drawer h3')].find((x) => x.textContent.includes('Where to settle'));
    const list = h?.parentElement?.querySelector('.list');
    return [...(list?.querySelectorAll(':scope > .list-item') ?? [])].map((r) => [...r.querySelectorAll('.site-strip > span')][3]?.textContent.trim() ?? '');
  });
  console.log(`  a Vault Ship’s Lasting: ${lasting.slice(0, 6).join(' | ')}`);
  check(lasting.length > 1 && lasting.filter((x) => x === '∞').length < lasting.length && lasting.some((x) => /10/.test(x)), 'a Vault Ship’s Lasting gives each hole its years (not ∞ at every one)');

  // a brown dwarf: its mass in figures, its words by its warmth
  const bd = await page.evaluate(() => {
    const s = window.__stel.state();
    const x = Object.values(s.systems).find((y) => y.primary.kind === 'brown_dwarf' && !y.gone);
    s.civ.known[x.id] = 2;
    window.__stel.select('system', x.id);
    window.__stel.refresh();
    return x.name;
  });
  await page.waitForTimeout(800);
  const bdPanel = await page.evaluate(() => {
    const dt = [...document.querySelectorAll('.drawer dt')].find((x) => x.textContent.trim() === 'Mass');
    return { mass: dt ? dt.nextElementSibling.textContent.trim() : null, words: document.querySelector('.drawer .flavor')?.textContent.trim() };
  });
  check(/^0\.0\d+ M☉$/.test(bdPanel.mass ?? ''), `${bd}: Mass ${bdPanel.mass} (it read “0 M☉”)`);
  check(/^Brown dwarf gone cold/.test(bdPanel.words ?? ''), `in the Black Hole Age: “${bdPanel.words}”`);
  await ck.shot('brown-dwarf.png');

  // a finished Great Work: no Resume
  await page.evaluate(() => {
    const s = window.__stel.state();
    s.civ.techs.push('conformal_mathematics');
    s.civ.works.aeon_seed = 2122;
    s.civ.work = null;
    window.__stel.select('fleet', null);
    window.__stel.refresh();
  });
  await page.locator('.rail button', { hasText: 'Research' }).first().click();
  await page.waitForTimeout(900);
  const card = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.modal .card')].find((x) => x.querySelector('h4')?.textContent.trim() === 'The Aeon Seed');
    const b = c?.querySelector('button');
    return c ? { button: b?.textContent.trim(), disabled: b?.disabled, tip: b?.dataset.tip, progress: c.querySelector('.mono.faint')?.textContent.trim(), bar: c.querySelector('.bar i')?.style.width } : null;
  });
  console.log(`  the Aeon Seed’s card: ${JSON.stringify(card)}`);
  check(!!card && card.disabled && /^Complete/.test(card.button) && !/Resume/.test(card.button), `finished, it says Complete and cannot be resumed (${card?.button})`);
  check(card?.progress === 'complete · 1700 / 1700' && card?.bar === '100%', `its bar full, not past its end (${card?.progress}, ${card?.bar})`);
  check(/when the Heart evaporates/.test(card?.tip ?? ''), 'its tip says when it ends');
  await ck.shot('aeon-card.png');
  await finish('HOLES', ck);
});
