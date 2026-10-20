// Browser check: the survey reveal (the new version, part 4). A probe completes a survey through
// the real End Turn; Look opens the system, and its worlds come in one by one: at first only the
// star, its worlds hidden from the pointer and the map's names, a card naming each world as it is
// charted (kind, temperature, habitable...). Enter skips it, ending no turn, and every world is
// there at once; Escape skips one too. "Skip all" skips the others charted as well. The reveal at
// a moment is the same whatever the frame rate (stepped at 30 and at 144 frames a second). Off in
// Settings, a system opens with its worlds. In the magnifier mode the card has its place in the
// column. The other checks run without reveals (?nofilms).
const { check, start, finish, run, url } = require('../lib.cjs');
run(async () => {
  const ck = await start('survey-reveal', { films: true });
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 4242 }));
  await page.waitForTimeout(1200);
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
  let toast = false;
  for (let i = 0; i < 12 && !toast; i++) {
    await page.evaluate(() => {
      window.__stel.state().civ.pending.length = 0;
      window.__stel.refresh();
    });
    await page.keyboard.press('Escape');
    await page.locator('button.endturn').click();
    await page.waitForTimeout(900);
    toast = await page.evaluate(() => [...document.querySelectorAll('.toast')].some((x) => x.textContent.includes('Survey complete')));
  }
  check(toast, `the probe charts ${target.name}, and the toast says so`);
  // (what the survey found waits as an event, whose window would answer Enter itself)
  const turn = await page.evaluate(() => {
    window.__stel.state().civ.pending.length = 0;
    window.__stel.refresh();
    return window.__stel.state().turn;
  });
  await page.locator('.toast', { hasText: 'Survey complete' }).locator('.toast-act').click();
  // as soon as the system is shown: the star alone, its worlds waiting (the switch into its view
  // takes 0.8 to 3.3 s here, drawn in software: 15 Oct, a window of 2 s missed it on any build)
  let first = null;
  for (let i = 0; i < 300 && !first; i++) {
    await page.waitForTimeout(50);
    first = await page.evaluate((id) => {
      const e = window.__stel.engine();
      if (e.view !== 'system' || e.system.systemId !== id) return null;
      const s = window.__stel.state();
      const worlds = s.systems[id].bodies.filter((b) => e.system.pickables.some((p) => p.id === `body:${b}`));
      const names = worlds.map((b) => s.bodies[b].name);
      const labels = [...document.querySelectorAll('.map-label')].filter((l) => l.style.display !== 'none').map((l) => l.textContent);
      return { revealing: e.revealing, worlds: worlds.length, hidden: worlds.filter((b) => e.system.hidden(`body:${b}`)).length, labelled: names.filter((n) => labels.includes(n)).length, card: document.querySelector('.reveal-card')?.textContent ?? '' };
    }, target.id);
  }
  check(!!first && first.revealing && first.worlds > 0 && first.hidden === first.worlds, `Look plays the reveal: ${first?.hidden} of ${first?.worlds} worlds wait at first`);
  check(!!first && first.labelled === 0, `their names wait too (${first?.labelled} shown)`);
  check(/Survey · /.test(first?.card ?? ''), `a card says what is being charted (${(first?.card ?? '').slice(0, 60)})`);
  // its clock is the view's: with frames drawn in software here, slower than the wall's (each
  // frame counts 0.1 s at most), so wait for the first world to be charted rather than a time
  await page
    .waitForFunction(
      (id) => {
        const e = window.__stel.engine();
        const s = window.__stel.state();
        return s.systems[id].bodies.some((b) => e.system.pickables.some((p) => p.id === `body:${b}`) && !e.system.hidden(`body:${b}`));
      },
      target.id,
      { timeout: 20000, polling: 100 },
    )
    .catch(() => {});
  const mid = await page.evaluate((id) => {
    const e = window.__stel.engine();
    const s = window.__stel.state();
    const worlds = s.systems[id].bodies.filter((b) => e.system.pickables.some((p) => p.id === `body:${b}`));
    return {
      name: document.querySelector('.reveal-card .rc-name')?.textContent ?? '',
      facts: [...document.querySelectorAll('.reveal-card dt')].map((x) => x.textContent),
      names: worlds.map((b) => s.bodies[b].name),
      shown: worlds.filter((b) => !e.system.hidden(`body:${b}`)).length,
      hidden: worlds.filter((b) => e.system.hidden(`body:${b}`)).length,
    };
  }, target.id);
  await ck.shot('reveal-card.png');
  check(mid.names.includes(mid.name) && mid.facts.includes('Kind') && mid.facts.includes('Habitable'), `the card names a world as it is charted: ${mid.name} (${mid.facts.join(', ')})`);
  check(mid.shown >= 1 && (mid.hidden >= 1 || mid.names.length === 1), `one by one: ${mid.shown} charted, ${mid.hidden} still to come`);
  // Enter skips it, and ends no turn
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const skipped = await page.evaluate((id) => {
    const e = window.__stel.engine();
    const s = window.__stel.state();
    const worlds = s.systems[id].bodies.filter((b) => e.system.pickables.some((p) => p.id === `body:${b}`));
    return { revealing: e.revealing, card: !!document.querySelector('.reveal-card'), hidden: worlds.filter((b) => e.system.hidden(`body:${b}`)).length, turn: s.turn };
  }, target.id);
  check(!skipped.revealing && !skipped.card && skipped.hidden === 0, 'Enter skips it: every world at once, the card gone');
  check(skipped.turn === turn, `and ends no turn (turn ${turn} → ${skipped.turn})`);
  await ck.shot('reveal-skipped.png');
  // the same moment at any frame rate: the engine stepped by hand, 2 s at 30 and at 144 frames a second
  const rate = await page.evaluate((id) => {
    const e = window.__stel.engine();
    const s = window.__stel.state();
    e.stop();
    const at = (fps) => {
      e.showGalaxy(undefined, undefined, true);
      for (let i = 0; i < 200 && e.view !== 'galaxy'; i++) e.frame(1 / 60);
      e.markForReveal(s, [id]);
      e.showSystem(id);
      for (let i = 0; i < 400 && !e.revealing; i++) e.frame(1 / fps);
      const sv = e.system;
      const left = 2 - (sv.time - sv.reveal.start);
      const n = Math.max(1, Math.round(left * fps));
      for (let i = 0; i < n; i++) e.frame(left / n);
      const scans = sv.planets.filter((p) => p.mat).map((p) => Math.round(p.mat.uniforms.uReveal.value * 1e4) / 1e4);
      const hidden = s.systems[id].bodies.filter((b) => sv.hidden(`body:${b}`)).length;
      const t = Math.round((sv.time - sv.reveal.start) * 1e6) / 1e6;
      e.skipReveal();
      return JSON.stringify({ t, scans, hidden });
    };
    const a = at(30);
    const b = at(144);
    e.start();
    return { a, b };
  }, target.id);
  check(rate.a === rate.b, `2 s into it, the same at 30 and at 144 frames a second (${rate.a} / ${rate.b})`);
  // the browser drawing again: the hundreds of frames stepped by hand are still being drawn in
  // software, and no animation frame comes until they are (20 Oct: from 8 s to well over 20 s
  // here, on the build before as well), so the switch below is timed from the fifth one after
  await page.evaluate(() => {
    window.__frames = 0;
    const f = () => ++window.__frames < 5 && requestAnimationFrame(f);
    requestAnimationFrame(f);
  });
  await page.waitForFunction(() => window.__frames >= 5, null, { timeout: 300000, polling: 500 });
  // Escape skips one too; Skip all skips the others charted with it
  const other = await page.evaluate((id) => {
    const s = window.__stel.state();
    return Object.values(s.systems).find((x) => x.id !== id && s.civ.known[x.id] === 2 && x.bodies.length > 1 && !x.gone)?.id ?? null;
  }, target.id);
  // (into a system, the view switched: it may be the one already shown, so wait for the switch itself)
  const enter = async (id) => {
    await page.evaluate((x) => window.__stel.engine().showSystem(x), id);
    await page.waitForFunction((x) => {
      const e = window.__stel.engine();
      return !e.pendingSwitch && e.view === 'system' && e.system.systemId === x;
    }, id, { timeout: 20000, polling: 50 });
    await page.waitForTimeout(150);
  };
  await page.evaluate(([a, b]) => window.__stel.engine().markForReveal(window.__stel.state(), [a, b].filter(Boolean)), [target.id, other]);
  await enter(target.id);
  const esc0 = await page.evaluate(() => window.__stel.engine().revealing);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const esc1 = await page.evaluate(() => window.__stel.engine().revealing);
  check(esc0 && !esc1, 'Escape skips it as well');
  if (other) {
    await page.evaluate(([a, b]) => window.__stel.engine().markForReveal(window.__stel.state(), [a, b]), [target.id, other]);
    await enter(target.id);
    await page.locator('.reveal-card .btn', { hasText: /^Skip all$/ }).click();
    await page.waitForTimeout(300);
    await enter(other);
    const after = await page.evaluate(() => window.__stel.engine().revealing);
    check(!after, 'Skip all: the other system charted opens with its worlds');
  } else check(true, 'Skip all: no second charted system with worlds in this galaxy (skipped)');
  // off in Settings: a system opens with its worlds
  await page.evaluate((id) => {
    window.__stel.reveals(false);
    window.__stel.engine().markForReveal(window.__stel.state(), [id]);
  }, target.id);
  await enter(target.id);
  const off = await page.evaluate(() => window.__stel.engine().revealing);
  check(!off, 'with reveals off, it opens with its worlds');
  await page.evaluate(() => window.__stel.reveals(null));
  // the magnifier mode: the card has its place in the column (this page again: a second page in
  // the same browser can hang loading, lib.cjs)
  const lv = page;
  await lv.goto(`${url}?lowvision`, { timeout: 90000 });
  await lv.waitForTimeout(1500);
  await lv.evaluate(() => window.__stel.newGame({ seed: 4242 }));
  await lv.waitForTimeout(1200);
  const placed = await lv.evaluate(async () => {
    const s = window.__stel.state();
    s.civ.pending.length = 0;
    const id = Object.values(s.systems).find((x) => s.civ.known[x.id] === 1 && x.bodies.length > 1 && !x.gone).id;
    s.civ.known[id] = 2;
    window.__stel.refresh();
    const e = window.__stel.engine();
    e.markForReveal(s, [id]);
    e.showSystem(id);
    for (let i = 0; i < 200 && !e.revealing; i++) await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 600));
    const card = document.querySelector('.reveal-card');
    const col = document.querySelector('.hud');
    if (!card || !col) return null;
    const a = card.getBoundingClientRect();
    const c = col.getBoundingClientRect();
    return { inCol: card.parentElement === col && a.left >= c.left - 1 && a.right <= c.right + 1, w: Math.round(a.width), col: Math.round(c.width) };
  });
  check(!!placed && placed.inCol, `in the magnifier mode the card is in the column (${JSON.stringify(placed)})`);
  await lv.screenshot({ path: require('path').join(ck.out, 'reveal-lowvision.png') });
  await finish('SURVEY REVEAL', ck);
});
