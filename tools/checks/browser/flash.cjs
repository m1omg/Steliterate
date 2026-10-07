// Browser check: a helium giant's event, catching its flash (the chip, the greyed paces), then the turn after.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('flash');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(800);
  const sysId = await page.evaluate(() => {
    const s = window.__stel.state();
    for (let i = 0; i < 80 && (s.era !== 'degenerate' || s.eta < 17.5); i++) window.__stel.endTurns(3);
    s.pending.length = 0;
    for (const k of ['star_until', 'star_step', 'star_next', 'star_flash']) delete s.civ.flags[k];
    const sys = Object.values(s.systems).find((x) => !x.gone && (x.primary.kind === 'white_dwarf' || x.primary.kind === 'black_dwarf') && s.civ.known[x.id]);
    sys.primary.kind = 'helium_giant';
    sys.primary.bornAt = s.years;
    sys.primary.diesAt = s.years + 1.2e5;
    s.civ.energy = 5000;
    s.civ.pace = 0;
    s.pending.push({ uid: 'ev_test_giant', defId: 'helium_giant', data: { systemId: sys.id } });
    window.__stel.refresh();
    return sys.id;
  });
  await page.waitForTimeout(1200);
  const modal = await page.evaluate(() => document.querySelector('.modal')?.textContent ?? '');
  check(/A Helium Giant/.test(modal) && /catch its flash/.test(modal), `the event offers its flash`);
  await ck.shot('flash-event.png');
  // keep time with it
  const keep = page.locator('.modal .choice', { hasText: 'Keep time with it' });
  await keep.first().click();
  await page.waitForTimeout(800);
  for (let i = 0; i < 4 && (await page.locator('.modal').count()); i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  const chip = await page.evaluate(() => [...document.querySelectorAll('.chip')].map((c) => c.textContent).find((t) => /Star flash/.test(t)) ?? '');
  check(/Star flash · .+ · one turn/.test(chip), `the HUD shows "${chip}"`);
  const paces = await page.evaluate(() => [...document.querySelectorAll('.pace-opt')].map((b) => `${b.textContent.trim()}${b.classList.contains('disabled') ? ' (grey)' : ''}`).join(' | '));
  console.log(`   paces: ${paces}`);
  check(/Quick ×10 \(grey\)/.test(paces) && !/Tide \(grey\)/.test(paces), `Quick ×10 is greyed, the Tide is open`);
  const turn = await page.evaluate(() => { const s = window.__stel.state(); return { flags: { ...s.civ.flags }, years: s.years }; });
  await ck.shot('flash-hud.png');
  // end the turn
  await page.evaluate(() => window.__stel.endTurns(1, false));
  await page.waitForTimeout(1000);
  const after = await page.evaluate((id) => { const s = window.__stel.state(); return { kind: s.systems[id].primary.kind, flash: s.civ.flags.star_flash, until: s.civ.flags.star_until, dy: s.years }; }, sysId);
  const chipAfter = await page.evaluate(() => [...document.querySelectorAll('.chip')].some((c) => /Star flash/.test(c.textContent)));
  check(after.kind !== 'helium_giant' && after.flash === undefined && after.until === undefined && !chipAfter, `next turn: the giant is ${after.kind}, the flash is over (turn of ${(after.dy - turn.years).toExponential(3)} years)`);
  await ck.shot('flash-after.png');
  await finish('FLASH UI', ck);
});
