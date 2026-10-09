// Browser check: the game for everyone, at the size a sight-impaired player's screen gives it (the
// player's friend, 9 Oct). Her system makes everything bigger, which leaves the page about 960×460:
// the settlement panel kept its head and gave the Build list one row or none. Now it scrolls whole
// when short (a11y.ts), the rail keeps Menu within reach, rows work from the keyboard (and a mouse
// click leaves no focus on them, so Enter still ends the turn), windows and events take focus and
// give it back, and Enter never ends the turn under an event. At a full screen nothing changes.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('a11y', { width: 960, height: 460, seed: 1000 });
  const { page } = ck;
  const capital = async () =>
    page.evaluate(() => {
      const s = window.__stel.state();
      for (const k of Object.keys(s.flags)) if (k.startsWith('tut')) delete s.flags[k];
      const c = s.colonies[s.civ.capitalId];
      window.__stel.select('body', c.bodyId);
      return { id: c.id, queue: c.queue.length, turn: s.turn };
    });
  const before = await capital();
  await page.waitForTimeout(500);
  await page.locator('.drawer .drawer-head button', { hasText: /^Build/ }).click();
  await page.waitForTimeout(500);
  const fit = await page.evaluate(() => {
    const d = document.querySelector('.drawer');
    const r = d.getBoundingClientRect();
    const head = d.querySelector('.drawer-head').getBoundingClientRect();
    d.scrollTop = d.querySelector('.list-head').offsetTop;
    const seen = (x) => {
      const b = x.getBoundingClientRect();
      return b.top >= r.top - 1 && b.bottom <= r.bottom + 1;
    };
    const all = [...d.querySelectorAll('.list-item.build')];
    const inView = all.filter(seen).length;
    // every row can be scrolled fully into view
    const reached = all.filter((x) => {
      x.scrollIntoView({ block: 'nearest' });
      return seen(x);
    }).length;
    d.scrollTop = d.querySelector('.list-head').offsetTop;
    return { whole: d.classList.contains('whole'), panel: Math.round(r.height), head: Math.round(head.height), inView, reached, rows: all.length };
  });
  await ck.shot('a11y-build.png');
  console.log(`  panel ${fit.panel} px, head ${fit.head} px; ${fit.inView} of ${fit.rows} Build rows in view at once, ${fit.reached} reachable`);
  // (the head alone is taller than the panel here: before, the Build list got no room at all)
  check(fit.whole && fit.inView >= 1 && fit.reached === fit.rows, `the settlement panel scrolls whole: every Build row can be brought into view (${fit.reached} of ${fit.rows}), where its head alone (${fit.head} px) filled the panel (${fit.panel} px)`);
  // the rail keeps its last button within reach
  const rail = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.rail button')].pop();
    b.scrollIntoView({ block: 'nearest' });
    const r = b.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { label: b.getAttribute('aria-label'), clear: !!top && b.contains(top) };
  });
  check(rail.clear, `the rail's last button (${rail.label}) can be scrolled into view, clear of the forecasts`);
  // a row from the keyboard: Enter and Space queue it, and the turn stays
  const rows = page.locator('.drawer .list-item.build:not([aria-disabled="true"])');
  await rows.nth(0).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await rows.nth(1).focus();
  await page.keyboard.press(' ');
  await page.waitForTimeout(300);
  const typed = await page.evaluate((id) => ({ queue: window.__stel.state().colonies[id].queue.length, turn: window.__stel.state().turn }), before.id);
  check(typed.queue === before.queue + 2 && typed.turn === before.turn, `Enter and Space on a focused Build row queue it, and the turn stays (queue ${before.queue} → ${typed.queue}, turn ${typed.turn})`);
  // a mouse click on a row leaves no focus on it: the next Enter ends the turn and queues nothing
  await rows.nth(0).click();
  await page.waitForTimeout(300);
  const clicked = await page.evaluate((id) => ({ queue: window.__stel.state().colonies[id].queue.length, focus: document.activeElement?.className ?? '' }), before.id);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  const ended = await page.evaluate((id) => ({ queue: window.__stel.state().colonies[id].queue.length, turn: window.__stel.state().turn }), before.id);
  check(clicked.queue === typed.queue + 1 && !/list-item/.test(clicked.focus), `a click queues it once and leaves no focus on the row (${clicked.focus || 'body'})`);
  check(ended.turn === typed.turn + 1, `then Enter ends the turn, as before (turn ${typed.turn} → ${ended.turn})`);
  // clear whatever the turn brought
  await page.evaluate(() => {
    window.__stel.state().pending.length = 0;
    window.__stel.refresh();
  });
  for (let k = 0; k < 5 && (await page.locator('.modal').count()); k++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
  // a window takes focus on its title and gives it back to the button that opened it
  const research = page.locator('.rail button').first();
  await research.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const inWin = await page.evaluate(() => ({ tag: document.activeElement?.tagName, inModal: !!document.activeElement?.closest('.modal'), hudInert: document.querySelector('.hud')?.inert === true }));
  check(inWin.tag === 'H1' && inWin.inModal, `a window opened takes focus on its title (${inWin.tag})`);
  check(inWin.hudInert, 'the HUD behind it is out of reach of Tab');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const back = await page.evaluate(() => ({ label: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName, hudInert: document.querySelector('.hud')?.inert === true }));
  check(/^Research/.test(back.label ?? '') && !back.hudInert, `closing it gives focus back to the button that opened it (${back.label})`);
  // Enter under an event leaves the turn as it is; the event takes focus on its title, not a choice
  const t0 = await page.evaluate(() => {
    const s = window.__stel.state();
    s.pending.push({ uid: 'a11y-check', defId: 'comet', data: {} });
    window.__stel.refresh();
    return s.turn;
  });
  await page.waitForTimeout(600);
  const ev = await page.evaluate(() => ({ open: !!document.querySelector('.modal.event'), focus: document.activeElement?.className ?? '' }));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  const t1 = await page.evaluate(() => ({ turn: window.__stel.state().turn, open: !!document.querySelector('.modal.event') }));
  check(ev.open && /event-title/.test(ev.focus), `an event takes focus on its title (${ev.focus})`);
  check(t1.turn === t0 && t1.open, `Enter under an event leaves the turn as it is (turn ${t0} → ${t1.turn})`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => !!document.querySelector('.modal.event')), 'Escape does not dismiss an event');
  await page.evaluate(() => {
    window.__stel.state().pending.length = 0;
    window.__stel.refresh();
  });
  await page.waitForTimeout(400);
  // Escape with a button in focus still cancels choosing a destination
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.waitForTimeout(500);
  const probe = await page.evaluate(() => {
    const s = window.__stel.state();
    const f = Object.values(s.fleets).find((x) => x.at && x.ships.some((y) => y.cls === 'probe'));
    if (f) window.__stel.select('fleet', f.id);
    return f?.id ?? null;
  });
  await page.waitForTimeout(500);
  if (probe) {
    await page.locator('.drawer button', { hasText: 'Choose on map' }).click();
    await page.waitForTimeout(300);
    const on = await page.evaluate(() => ({ banner: !!document.querySelector('.targeting'), focus: document.activeElement?.tagName }));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const off = await page.evaluate(() => !document.querySelector('.targeting'));
    check(on.banner && on.focus === 'BUTTON' && off, `Escape cancels choosing a destination with a button in focus (${on.focus})`);
  } else check(false, 'a probe to send');
  // at a full screen, and on a phone, the panel is as it was
  const full = await page.evaluate(async () => {
    const s = window.__stel.state();
    window.__stel.select('body', s.colonies[s.civ.capitalId].bodyId);
    await new Promise((r) => setTimeout(r, 400));
    return document.querySelector('.drawer')?.classList.contains('whole');
  });
  check(full === false, 'at 1400×900 the settlement panel keeps its head (no whole scrolling)');
  const phone = await ck.another(390, 844);
  await phone.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await phone.waitForTimeout(800);
  await phone.evaluate(() => {
    const s = window.__stel.state();
    for (const k of Object.keys(s.flags)) if (k.startsWith('tut')) delete s.flags[k];
    window.__stel.select('body', s.colonies[s.civ.capitalId].bodyId);
  });
  await phone.waitForTimeout(500);
  await phone.locator('.drawer .drawer-head button', { hasText: /^Build/ }).click();
  await phone.waitForTimeout(500);
  const ph = await phone.evaluate(() => document.querySelector('.drawer')?.classList.contains('whole'));
  check(ph === false, 'on a phone (390×844) the Build tab keeps its head too');
  await finish('A11Y', ck);
});
