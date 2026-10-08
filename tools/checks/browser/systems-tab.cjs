// Browser check: the Systems window (renamed from Settlements), its tabs and keys, and the
// Degenerate Age's Collision stars tab with burning and already-out stars; the map's ✦ labels.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('systems-tab');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1200);
  const modalState = () =>
    page.evaluate(() => {
      const m = document.querySelector('.modal');
      if (!m) return null;
      return {
        title: m.querySelector('.modal-head h1')?.textContent.trim(),
        eyebrow: m.querySelector('.modal-head .eyebrow')?.textContent.trim(),
        tabs: [...m.querySelectorAll('.modal-body > .row button, .row.wrap > button.btn.small')].slice(0, 3).map((b) => ({ text: b.textContent.trim(), on: b.classList.contains('primary') })),
        rows: [...m.querySelectorAll('.list-item')].map((x) => x.textContent.trim()),
        text: m.textContent,
      };
    });
  // the rail button
  const rail = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.rail button')].find((x) => x.querySelector('.rl-wide')?.textContent === 'Systems');
    return b ? { label: b.getAttribute('aria-label'), short: b.querySelector('.rl-short')?.textContent } : null;
  });
  check(rail && rail.label.startsWith('Systems:') && rail.short === 'Systems', `the rail button is Systems (${JSON.stringify(rail)})`);
  check(!rail?.label.includes('collision'), 'in the Dusk its tip does not mention collision stars');
  // S opens it on our settlements
  await page.keyboard.press('s');
  await page.waitForTimeout(400);
  let m = await modalState();
  check(m?.title === 'Systems' && m.eyebrow.startsWith('Our settlements:'), `S opens Systems on our settlements (${m?.title} / ${m?.eyebrow})`);
  const tabTexts = await page.evaluate(() => [...document.querySelectorAll('.modal button.btn.small')].map((b) => b.textContent.trim()).filter((t) => /settlements|Surveyed|Collision/.test(t)));
  check(tabTexts.length === 2 && !tabTexts.some((t) => t.includes('Collision')), `two tabs in the Dusk, no collision stars (${tabTexts.join(' | ')})`);
  check((m?.rows.length ?? 0) > 0, `the homeworld is listed (${m?.rows[0]?.slice(0, 40)})`);
  await ck.shot('systems-ours.png');
  // W while it is open switches to the surveyed worlds (it did nothing before), and W again closes it
  await page.keyboard.press('w');
  await page.waitForTimeout(300);
  m = await modalState();
  check(m?.title === 'Systems' && m.eyebrow.startsWith('Surveyed worlds'), `W switches the open window to surveyed worlds (${m?.eyebrow})`);
  await page.keyboard.press('w');
  await page.waitForTimeout(300);
  check((await modalState()) === null, 'W again closes it');
  // clicking a tab, then S closes
  await page.keyboard.press('s');
  await page.waitForTimeout(300);
  await page.locator('.modal button', { hasText: 'Surveyed worlds' }).click();
  await page.waitForTimeout(300);
  m = await modalState();
  check(m?.eyebrow.startsWith('Surveyed worlds'), `the Surveyed worlds tab opens by click (${m?.eyebrow})`);
  await page.keyboard.press('s');
  await page.waitForTimeout(300);
  check((await modalState()) === null, 'S closes the window from any tab');

  // into the Degenerate Age
  let era = 'dusk';
  for (let i = 0; i < 30 && era !== 'degenerate'; i++) {
    era = await page.evaluate(() => {
      window.__stel.endTurns(10);
      return window.__stel.state().era;
    });
  }
  check(era === 'degenerate', `autoplay reached the Degenerate Age (${era})`);
  await page.evaluate(() => {
    const s = window.__stel.state();
    window.__stel.engine()?.focusGalaxyOn(s.civ.homeSystemId, 150, true);
  });
  // three stars made by hand: one with several turns left, one going out this turn, one already out
  const made = await page.evaluate(() => {
    const s = window.__stel.state();
    const L = s.turnLength;
    const bds = Object.values(s.systems).filter((x) => x.primary.kind === 'brown_dwarf' && !x.gone && !x.ejected && s.civ.known[x.id]);
    const [a, b, c] = bds;
    const set = (sys, born, dies) => {
      sys.primary.kind = 'collision_star';
      sys.primary.mass = 0.1;
      sys.primary.bornAt = born;
      sys.primary.diesAt = dies;
    };
    set(a, s.years - 1e11, s.years + 40 * L);
    s.civ.known[a.id] = 2;
    set(b, s.years - 1e11, s.years + 0.3 * L);
    set(c, s.years - 0.6 * L, s.years - 0.1 * L); // lit and went out within the last turn, as they do
    window.__stel.refresh();
    const natural = Object.values(s.systems).filter((x) => x.primary.kind === 'collision_star' && ![a.id, b.id, c.id].includes(x.id) && !x.gone && s.civ.known[x.id] && x.primary.diesAt > s.years).length;
    return { long: a.name, short: b.name, gone: c.name, natural, L, years: s.years, pace: s.civ.pace };
  });
  console.log('made', JSON.stringify(made));
  await page.waitForTimeout(800);
  const rail2 = await page.evaluate(() => [...document.querySelectorAll('.rail button')].find((x) => x.querySelector('.rl-wide')?.textContent === 'Systems')?.getAttribute('aria-label'));
  check(rail2?.includes('collision stars'), `in the Degenerate Age the tip mentions the collision stars (${rail2})`);
  await page.keyboard.press('s');
  await page.waitForTimeout(400);
  const tabs3 = await page.evaluate(() => [...document.querySelectorAll('.modal button.btn.small')].map((b) => b.textContent.trim()).filter((t) => /settlements|Surveyed|Collision/.test(t)));
  const burningCount = 2 + made.natural;
  check(tabs3.length === 3 && tabs3[2] === `✦ Collision stars ${burningCount}`, `a third tab counts the burning stars (${tabs3.join(' | ')})`);
  await page.locator('.modal button', { hasText: 'Collision stars' }).click();
  await page.waitForTimeout(400);
  m = await modalState();
  check(m?.eyebrow === `Collision stars: ${burningCount} burning on our map`, `its eyebrow (${m?.eyebrow})`);
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('.modal .list-item')].map((x) => ({ text: x.textContent.trim(), out: !!x.closest('.section') })),
  );
  const burningRows = rows.filter((r) => !r.out);
  const outRows = rows.filter((r) => r.out);
  console.log(JSON.stringify(rows, null, 1));
  check(burningRows.length === burningCount, `${burningCount} burning rows (${burningRows.length})`);
  const longRow = burningRows.find((r) => r.text.includes(made.long));
  const shortRow = burningRows.find((r) => r.text.includes(made.short));
  check(burningRows[0]?.text.includes(made.long) || made.natural > 0, `the longest-burning comes first (${burningRows[0]?.text.slice(0, 60)})`);
  check(/\d+ turns left/.test(longRow?.text ?? '') && /×\d/.test(longRow?.text ?? ''), `the long one shows its light and turns left (${longRow?.text})`);
  check(/goes out this turn/.test(shortRow?.text ?? ''), `the short one goes out this turn (${shortRow?.text})`);
  check(/worlds? · /.test(longRow?.text ?? '') && /of light left/.test(longRow?.text ?? ''), 'the long one, surveyed, shows its worlds and light left');
  check(/worlds not charted/.test(shortRow?.text ?? '') || /world/.test(shortRow?.text ?? ''), 'the short one says whether its worlds are charted');
  check(outRows.length === 1 && outRows[0].text.includes(made.gone) && /burned for/.test(outRows[0].text), `the out one is listed apart (${outRows.map((r) => r.text).join(' | ')})`);
  check(m?.text.includes('Already out'), 'under Already out');
  await ck.shot('systems-beacons.png');
  // the map marks the burning ones with ✦, not the out one
  await page.keyboard.press('Escape');
  await page.evaluate((n) => {
    const s = window.__stel.state();
    const x = Object.values(s.systems).find((y) => y.name === n);
    window.__stel.engine().focusGalaxyOn(x.id, 150, true);
  }, made.long);
  await page.waitForTimeout(1500);
  const labels = await page.evaluate(() => [...document.querySelectorAll('.map-label.beacon')].filter((x) => x.offsetParent !== null || getComputedStyle(x).display !== 'none').map((x) => x.textContent));
  const plain = await page.evaluate(() => [...document.querySelectorAll('.map-label')].map((x) => x.className + ':' + x.textContent).filter((t) => t.includes('BD')).slice(0, 12));
  console.log('labels', JSON.stringify(labels), JSON.stringify(plain));
  await ck.shot('systems-map.png');
  check(labels.some((t) => t.includes(made.long)) && labels.some((t) => t.includes(made.short)), `the map names the burning ones with ✦ (${labels.join(', ')})`);
  check(!labels.some((t) => t.includes(made.gone)), 'the out one has no ✦');
  // a row leads to the system, whose panel tells the out one apart
  await page.keyboard.press('s');
  await page.waitForTimeout(300);
  await page.locator('.modal button', { hasText: 'Collision stars' }).click();
  await page.waitForTimeout(300);
  await page.locator('.modal .list-item', { hasText: made.gone }).click();
  await page.waitForTimeout(1200);
  const panel = await page.evaluate(() => document.querySelector('.drawer')?.textContent ?? '');
  check(panel.includes(made.gone) && panel.includes('already out') && panel.includes('Burnt out at'), `the out one's panel says it is out (${panel.slice(0, 160)})`);
  await ck.shot('systems-out-panel.png');
  // the long one's panel
  await page.keyboard.press('s');
  await page.waitForTimeout(300);
  await page.locator('.modal button', { hasText: 'Collision stars' }).click();
  await page.waitForTimeout(300);
  await page.locator('.modal .list-item', { hasText: made.long }).click();
  await page.waitForTimeout(1200);
  const panel2 = await page.evaluate(() => document.querySelector('.drawer')?.textContent ?? '');
  check(panel2.includes('Burns until') && !panel2.includes('already out'), 'the burning one says Burns until');
  const dists = await page.evaluate((names) => {
    const s = window.__stel.state();
    const cap = s.colonies[s.civ.capitalId];
    const home = s.systems[cap?.systemId ?? s.civ.homeSystemId];
    const d = (a, b) => Math.hypot(a.phys.x - b.phys.x, a.phys.y - b.phys.y, a.phys.z - b.phys.z);
    return { home: home.name, province: s.provinces.find((p) => p.id === home.provinceId)?.name, to: names.map((n) => { const x = Object.values(s.systems).find((y) => y.name === n); return [n, d(home, x).toFixed(1), s.provinces.find((p) => p.id === x.provinceId)?.name]; }) };
  }, [made.long, made.short, made.gone]);
  console.log('distances (ly)', JSON.stringify(dists));
  await page.close();
  // phone width: the tabs wrap and the window fits
  const phone = await ck.another(390, 844);
  await phone.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await phone.waitForTimeout(800);
  await phone.evaluate(() => {
    for (let i = 0; i < 30 && window.__stel.state().era !== 'degenerate'; i++) window.__stel.endTurns(10);
    const s = window.__stel.state();
    const a = Object.values(s.systems).find((x) => x.primary.kind === 'brown_dwarf' && !x.gone && !x.ejected && s.civ.known[x.id]);
    a.primary.kind = 'collision_star';
    a.primary.bornAt = s.years - 1e11;
    a.primary.diesAt = s.years + 40 * s.turnLength;
    window.__stel.refresh();
  });
  await phone.keyboard.press('s');
  await phone.waitForTimeout(300);
  await phone.locator('.modal button', { hasText: 'Collision stars' }).click();
  await phone.waitForTimeout(400);
  const fit = await phone.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth, modal: document.querySelector('.modal')?.getBoundingClientRect().width }));
  check(fit.sw <= fit.w && fit.modal <= fit.w, `fits a phone (${JSON.stringify(fit)})`);
  const railShort = await phone.evaluate(() => [...document.querySelectorAll('.rail .rl-short')].map((x) => x.textContent).includes('Systems'));
  check(railShort, 'the phone rail reads Systems');
  await phone.screenshot({ path: `${ck.out}/systems-phone.png` });
  await finish('SYSTEMS TAB', ck);
});
