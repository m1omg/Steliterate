// Browser check: the Systems window's Star types tab (26 Oct, the player: "add options to systems
// menu to select different star types + black holes"): a button for each kind of star on our map,
// black holes too, each listing those stars, the nearest first; and the Black holes tab in the Dusk
// too, once one is on our map.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('star-types');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(800);
  const hole = await page.evaluate(() => {
    const s = window.__stel.state();
    const h = Object.values(s.systems).find((x) => x.primary.kind === 'black_hole' && !x.gone);
    s.civ.known[h.id] = 1;
    window.__stel.refresh();
    return h.name;
  });
  await page.keyboard.press('s');
  await page.waitForTimeout(500);
  check((await page.locator('.modal button', { hasText: 'Black holes' }).count()) === 1, 'in the Dusk the Systems window has a Black holes tab once one is on our map');
  await page.locator('.modal button', { hasText: 'Star types' }).click();
  await page.waitForTimeout(400);
  const kinds = await page.evaluate(() => [...document.querySelectorAll('.modal .btn.ghost')].map((b) => b.textContent.trim()));
  console.log(`  kinds: ${kinds.join(' | ')}`);
  check(kinds.some((k) => k.startsWith('Red dwarf')) && kinds.some((k) => k.startsWith('Black hole')), 'it offers each kind on our map, black holes too');
  const first = await page.evaluate(() => [...document.querySelectorAll('.modal .list-item')].map((r) => r.textContent).slice(0, 3));
  check(first.length > 0, `it opens on our capital’s kind of star (${first.length ? first[0].slice(0, 40) : 'none'})`);
  await page.locator('.modal .btn.ghost', { hasText: /^Black hole/ }).first().click();
  await page.waitForTimeout(400);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.modal .list-item')].map((r) => r.textContent));
  check(rows.length === 1 && rows[0].includes(hole) && rows[0].includes('not surveyed'), `Black hole lists the one on our map (${hole})`);
  await ck.shot('star-types.png');
  // each surveyed star's measures, and sorted by one, the unsurveyed last (the player: "make it
  // shows matter/energy/lifetime etc when sorting by star type")
  await page.evaluate(() => {
    const s = window.__stel.state();
    for (const x of Object.values(s.systems)) if (x.primary.kind === 'red_dwarf' && !x.gone && s.civ.known[x.id]) s.civ.known[x.id] = 2;
    const far = Object.values(s.systems).find((x) => x.primary.kind === 'red_dwarf' && !x.gone && !s.civ.known[x.id]);
    if (far) s.civ.known[far.id] = 1;
    window.__stel.refresh();
  });
  await page.locator('.modal .btn.ghost', { hasText: /^Red dwarf/ }).first().click();
  await page.waitForTimeout(300);
  await page.locator('.modal .btn.ghost', { hasText: /^\s*Matter$/ }).first().click();
  await page.waitForTimeout(400);
  const red = await page.evaluate(() =>
    [...document.querySelectorAll('.modal .list-item')].map((r) => ({
      text: r.textContent,
      strip: r.querySelectorAll('.site-strip > .mark').length,
      matter: r.querySelector('.site-strip .sorted')?.textContent?.trim() ?? null,
    })),
  );
  console.log(`  red dwarfs by matter: ${red.slice(0, 4).map((r) => `[${r.matter}]`).join(' ')} … ${red.length} stars`);
  const surveyed = red.filter((r) => !r.text.includes('not surveyed'));
  check(surveyed.length > 1 && surveyed.every((r) => r.strip === 4), `each surveyed star shows its four measures (${surveyed.length} stars)`);
  const firstOut = red.findIndex((r) => r.text.includes('not surveyed'));
  check(firstOut === -1 || red.slice(firstOut).every((r) => r.text.includes('not surveyed')), 'the unsurveyed last');
  const vals = surveyed.map((r) => (/none/.test(r.matter ?? '') ? -1 : Number((r.matter ?? '').replace(/[^\d.]/g, '')) || 0));
  check(vals.every((v, i) => i === 0 || v <= vals[i - 1] + 1e-9), `Matter: the most first, marked (${vals.slice(0, 6).join(', ')})`);
  await ck.shot('star-types-matter.png');
  // each star's state in a word, its light's label for the tip (the player: "systems view should
  // show if white dwarf is cold, still cooling, or an ember etc.")
  await page.locator('.modal .btn.ghost', { hasText: /^White dwarf/ }).first().click();
  await page.waitForTimeout(400);
  const whites = await page.evaluate(() =>
    [...document.querySelectorAll('.modal .list-item')].map((r) => {
      const chip = [...r.querySelectorAll('.chip')].find((c) => /^(cooling|nearly cold|cold|ember|ember, fading|ember, dimming|rekindled)$/.test(c.textContent.trim()));
      return { name: r.querySelector('.grow')?.firstChild?.textContent ?? '', state: chip?.textContent.trim() ?? null, tip: chip?.getAttribute('data-tip') ?? '' };
    }),
  );
  console.log(`  white dwarfs: ${whites.map((w) => `${w.name} [${w.state}]`).join(', ')}`);
  check(whites.length > 0 && whites.every((w) => w.state && /white dwarf|Ember/i.test(w.tip)), 'every white dwarf says how it is (cooling, nearly cold, an ember, cold…), its light’s words in the tip');
  // and wherever the window names a star's kind: Our settlements' headers, Surveyed worlds one line
  // per star (27 Oct, the player, on Our settlements: "still no ember/cooling description etc or where
  // is it?")
  const wd = await page.evaluate((name) => {
    const s = window.__stel.state();
    const sys = Object.values(s.systems).find((x) => x.name === name);
    const body = sys.bodies.map((id) => s.bodies[id]).find((b) => b && b.kind !== 'deep' && !b.colonyId);
    const cap = s.colonies[s.civ.capitalId];
    s.colonies.check_wd = { ...structuredClone(cap), id: 'check_wd', name: `${sys.name} test`, systemId: sys.id, bodyId: body.id, queue: [], form: 'leptonic' };
    body.colonyId = 'check_wd';
    s.civ.known[sys.id] = 2;
    // and the capital a third of the way through the Passage
    cap.queue = [{ uid: 'q-check-passage', kind: 'passage', key: 'passage', progress: 30, cost: 90, paid: { matter: 0, energy: 0 } }];
    window.__stel.refresh();
    return sys.name;
  }, whites[0].name);
  await page.locator('.modal button', { hasText: 'Our settlements' }).click();
  await page.waitForTimeout(400);
  const head = await page.evaluate((name) => {
    const h = [...document.querySelectorAll('.modal .section > h3')].find((x) => x.textContent.includes(name));
    const chip = h?.querySelector('.chip');
    return h ? { text: h.textContent, state: chip?.textContent.trim() ?? null, tip: chip?.getAttribute('data-tip') ?? '', transform: chip ? getComputedStyle(chip).textTransform : '' } : null;
  }, wd);
  console.log(`  Our settlements: ${head?.text}`);
  check(!!head && head.state === whites[0].state && head.tip === whites[0].tip && head.transform === 'none', `Our settlements: ${wd}’s header says how its star is (${head?.state}), as Star types does, in lower case`);
  // and each settlement not of matter says what it is made of (27 Oct, the player: "should show which
  // settlements are leptonic pls"), the capital nothing
  const forms = await page.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll('.modal .settlement-row')].map((r) => [r.querySelector('.grow')?.firstChild?.textContent?.trim(), r.querySelector('.form-chip')?.textContent.trim() ?? null])),
  );
  console.log(`  forms: ${JSON.stringify(forms)}`);
  check(forms[`${wd} test`] === 'leptonic' && Object.entries(forms).filter(([n]) => n !== `${wd} test`).every(([, f]) => f === null), 'Our settlements: the leptonic one says so, the others of matter nothing');
  // a settlement making the Passage says how far along it is (28 Oct, the player: "make the system
  // view shows systems that are inprogress of the leptonic Passage")
  const passing = await page.evaluate(() =>
    [...document.querySelectorAll('.modal .settlement-row')].flatMap((r) => [...r.querySelectorAll('.form-work')].map((x) => ({ name: r.querySelector('.grow')?.firstChild?.textContent?.trim(), text: x.textContent.trim(), tip: x.getAttribute('data-tip') }))),
  );
  console.log(`  under way: ${JSON.stringify(passing)}`);
  check(passing.length === 1 && passing[0].text === 'Passage 33%' && /^The Passage under way: 33% done, (about \d+ turns? more|stalled)/.test(passing[0].tip), `Our settlements: the one making the Passage says so (${passing[0]?.name}: ${passing[0]?.text})`);
  await ck.shot('star-state-settlements.png');
  await page.locator('.modal button', { hasText: 'Surveyed worlds' }).click();
  await page.waitForTimeout(400);
  await page.locator('.modal .seg .btn', { hasText: /^\s*Systems\s*$/ }).click();
  await page.locator('.modal .btn', { hasText: 'Unsettled only' }).click(); // its one world is ours now
  await page.waitForTimeout(400);
  const row = await page.evaluate((name) => {
    const r = [...document.querySelectorAll('.modal .list-item')].find((x) => x.querySelector('.grow')?.firstChild?.textContent?.trim() === name);
    return r ? [...r.querySelectorAll('.chip')].map((c) => c.textContent.trim()) : null;
  }, wd);
  console.log(`  Surveyed worlds, Systems: ${wd} ${JSON.stringify(row)}`);
  check(!!row && row.includes(whites[0].state), `Surveyed worlds, one line per star: ${wd} says it too`);
  await finish('STAR TYPES', ck);
});
