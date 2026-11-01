// Browser check: the survey reveal before the turn's events, and charted systems opened at once (1
// Nov, the player: "the events often happen like, the slide opens, but then you get the automatic
// exploration … make sure that the exploration occurs first and then the event slide, and also
// create an optional option … for it to open the system automatically without you clicking on
// look").
// - An event about a system just charted, with the view in a system (so the event swings it there):
//   no slide at first; the view goes into that system and its reveal plays; once it is over (here,
//   skipped), the slide.
// - Settings, Open charted systems, At once: a turn that charts a system goes into it by itself,
//   its reveal playing, the turn's events waiting; With Look (the default) it does not.
const { check, start, finish, run } = require('../lib.cjs');

run(async () => {
  const ck = await start('reveal-first');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 4242 }));
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__stel.reveals(true));
  /** Send the probe to chart the nearest system seen, and end turns (clearing events) until it has. */
  const chart = async () => {
    const target = await page.evaluate(() => {
      const s = window.__stel.state();
      s.civ.pending.length = 0;
      const probe = Object.values(s.fleets).find((f) => f.owner === s.player && f.ships.some((x) => x.cls === 'probe') && f.at);
      const here = s.systems[probe.at];
      const d = (a, b) => Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y, a.pos.z - b.pos.z);
      const t = Object.values(s.systems).filter((x) => s.civ.known[x.id] === 1 && !x.gone).sort((a, b) => d(here, a) - d(here, b))[0];
      window.__stel.orderFleet(probe.id, t.id, 'survey');
      window.__stel.refresh();
      return { id: t.id, name: t.name };
    });
    for (let i = 0; i < 12; i++) {
      const done = await page.evaluate((id) => window.__stel.state().civ.known[id] === 2, target.id);
      if (done) break;
      await page.evaluate(() => {
        window.__stel.state().civ.pending.length = 0;
        window.__stel.refresh();
      });
      await page.keyboard.press('Escape');
      await page.locator('button.endturn').click();
      await page.waitForTimeout(900);
    }
    return target;
  };
  const state = () =>
    page.evaluate(() => {
      const e = window.__stel.engine();
      return { view: e.view, shown: e.system?.systemId ?? null, revealing: e.revealing, slide: document.querySelector('.modal .event-text, .modal h2')?.closest('.modal')?.textContent?.slice(0, 80) ?? null };
    });
  const waitFor = async (pred, ms = 30000) => {
    let st = await state();
    for (let t = 0; t < ms && !pred(st); t += 250) {
      await page.waitForTimeout(250);
      st = await state();
    }
    return st;
  };

  // ---------------------------------------------------------------- an event about it, in the system view
  const a = await chart();
  // into our home system, as a player would be (with Look not clicked: the charted one waits)
  await page.evaluate(() => {
    window.__stel.state().civ.pending.length = 0;
    window.__stel.refresh();
  });
  await page.keyboard.press('Escape');
  await page.locator('button[aria-label="Home"]').click();
  await page.waitForTimeout(300);
  await page.locator('button[aria-label="System"]').click();
  await waitFor((x) => x.view === 'system' && !!x.shown);
  const inView = await page.evaluate(() => window.__stel.engine().view);
  check(inView === 'system', `in our home system's view (${inView})`);
  // an event about the charted system arrives
  await page.evaluate((id) => {
    const s = window.__stel.state();
    s.civ.pending.push({ uid: 'check-reveal-first', defId: 'nebula_chemistry', data: { systemId: id } });
    window.__stel.refresh();
  }, a.id);
  await page.waitForTimeout(150);
  const first = await state();
  check(!first.slide, `no slide at first (${first.slide ?? 'none'})`);
  const flying = await waitFor((x) => x.revealing && x.shown === a.id);
  check(flying.revealing && flying.shown === a.id && !flying.slide, `the view goes into ${a.name} and its reveal plays, the slide waiting`);
  await ck.shot('reveal-first-flying.png');
  await page.evaluate(() => window.__stel.engine().skipReveal());
  const after = await waitFor((x) => !x.revealing && !!x.slide, 10000);
  check(!after.revealing && /Cold Chemistry/.test(after.slide ?? ''), `then the slide (${after.slide})`);
  await page.evaluate(() => {
    window.__stel.state().civ.pending.length = 0;
    window.__stel.refresh();
  });
  await page.keyboard.press('Escape');

  // ---------------------------------------------------------------- Settings: Open charted systems
  await page.locator('button[aria-label="Galaxy"]').click();
  await page.waitForTimeout(800);
  const openSettings = async () => {
    await page.keyboard.press('Escape');
    await page.locator('.rail button[aria-label^="Menu"]').click();
    await page.waitForTimeout(500);
  };
  await openSettings();
  const field = page.locator('.modal .field', { hasText: 'Open charted systems' });
  check((await field.locator('button[aria-pressed="true"]').textContent()).trim() === 'With Look', 'Open charted systems: With Look to begin with');
  await field.locator('button', { hasText: 'At once' }).click();
  await page.waitForTimeout(200);
  await ck.shot('reveal-first-settings.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // a probe charts another; the turn that does it goes there by itself
  const b = await chart();
  const opened = await waitFor((x) => x.view === 'system' && x.shown === b.id, 20000);
  check(opened.view === 'system' && opened.shown === b.id, `At once: the turn that charts ${b.name} goes into it by itself (${opened.view}, ${opened.shown})`);
  check(opened.revealing || (await waitFor((x) => x.revealing, 8000)).revealing, 'its survey reveal playing');
  await page.evaluate(() => window.__stel.engine().skipReveal(true));
  await finish('REVEAL FIRST', ck);
});
