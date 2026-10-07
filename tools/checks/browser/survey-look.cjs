// Browser check: a probe completes a survey through the real End Turn; the toast offers Look,
// and Look opens that system with its panel.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('survey-look');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 4242 }));
  await page.waitForTimeout(1200);
  const target = await page.evaluate(() => {
    const s = window.__stel.state();
    s.pending.length = 0;
    const probe = Object.values(s.fleets).find((f) => f.ships.some((x) => x.cls === 'probe') && f.at);
    const here = s.systems[probe.at];
    const d = (a, b) => Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y, a.pos.z - b.pos.z);
    const t = Object.values(s.systems).filter((x) => s.civ.known[x.id] === 1 && !x.gone).sort((a, b) => d(here, a) - d(here, b))[0];
    const err = window.__stel.orderFleet(probe.id, t.id, 'survey');
    window.__stel.refresh();
    return { id: t.id, name: t.name, err };
  });
  console.log('probe sent to', JSON.stringify(target));
  let toast = null;
  for (let i = 0; i < 12 && !toast; i++) {
    await page.evaluate(() => {
      const s = window.__stel.state();
      s.pending.length = 0;
      window.__stel.refresh();
    });
    await page.keyboard.press('Escape');
    await page.locator('button.endturn').click();
    await page.waitForTimeout(900);
    toast = await page.evaluate(() => {
      const t = [...document.querySelectorAll('.toast')].find((x) => x.textContent.includes('Survey complete'));
      return t ? { text: t.textContent.trim(), button: t.querySelector('.toast-act')?.textContent.trim() ?? null } : null;
    });
  }
  check(!!toast, `a Survey complete toast appeared (${toast?.text ?? 'none'})`);
  check(toast?.button?.endsWith('Look'), `it carries a Look button (${toast?.button})`);
  await ck.shot('survey-toast.png');
  await page.locator('.toast', { hasText: 'Survey complete' }).locator('.toast-act').click();
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => {
    const e = window.__stel.engine();
    return { view: e.view, shown: e.system?.systemId, toastLeft: !![...document.querySelectorAll('.toast')].find((x) => x.textContent.includes('Survey complete')), drawer: document.querySelector('.drawer h2, .drawer h1, .drawer-head h2')?.textContent ?? document.querySelector('.drawer')?.textContent.slice(0, 80) };
  });
  const surveyedName = toast?.text.match(/Survey complete: ([^,]+),/)?.[1];
  const shownName = await page.evaluate((id) => window.__stel.state().systems[id]?.name, after.shown);
  check(after.view === 'system' && shownName === surveyedName, `Look opens the system view of ${surveyedName} (view ${after.view}, showing ${shownName})`);
  check(!after.toastLeft, 'the toast closes');
  check((after.drawer ?? '').toUpperCase().includes((surveyedName ?? '#').toUpperCase()), `its panel is open (${(after.drawer ?? '').slice(0, 60)})`);
  await ck.shot('survey-look.png');
  await finish('SURVEY LOOK', ck);
});
