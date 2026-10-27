// Browser check: the survey reveal (the new version, part 4; since 21 Oct a flight of the camera,
// as the player pictured it from Endless Space 2). A probe completes a survey through the real End
// Turn; Look opens the system, and at first there is only the star: its worlds hidden from the
// pointer and the map's names, the rest of the interface stepped aside, a caption saying what is
// being charted. The camera flies to each world in turn and stays close to it while its caption
// types in its kind, its facts and four bars; the worlds still to come wait. Space goes on to the
// next world, and so does a click on the view. Enter skips it, ending no turn: every world there at
// once, the interface back. A moment of it, the camera's place too, is the same whatever the frame
// rate (stepped at 30 and at 144 frames a second, 2 s and 6 s in). Escape skips one too; "Skip all"
// skips the others charted as well; a drag takes the camera from it where it is. Off in Settings, a
// system opens with its worlds. In the magnifier mode the caption has its place in the column and
// the interface stays. A find's card waits for the flight (24 Oct). The other checks run without
// reveals (?nofilms).
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
      const rail = document.querySelector('.rail');
      return {
        revealing: e.revealing,
        worlds: worlds.length,
        hidden: worlds.filter((b) => e.system.hidden(`body:${b}`)).length,
        labelled: names.filter((n) => labels.includes(n)).length,
        card: document.querySelector('.reveal-card')?.textContent ?? '',
        cine: document.documentElement.classList.contains('cine'),
        rail: rail ? getComputedStyle(rail).visibility : 'none',
        flying: !!e.system.cinema,
      };
    }, target.id);
  }
  check(!!first && first.revealing && first.worlds > 0 && first.hidden === first.worlds, `Look plays the reveal: ${first?.hidden} of ${first?.worlds} worlds wait at first`);
  check(!!first && first.labelled === 0, `their names wait too (${first?.labelled} shown)`);
  check(/Survey · /.test(first?.card ?? ''), `a caption says what is being charted (${(first?.card ?? '').slice(0, 60)})`);
  check(!!first && first.flying, "and the camera is the reveal's");
  // its clock is the view's: with frames drawn in software here, slower than the wall's (each
  // frame counts 0.1 s at most), so wait for the camera to be at a world, its scan done, rather
  // than for a time
  const atWorld = () =>
    page
      .waitForFunction(
        () => {
          const sv = window.__stel.engine().system;
          if (!sv.reveal) return true;
          const sch = sv.schedule(sv.reveal);
          const t = sv.time - sv.reveal.start;
          return sch.at.some((a, i) => t >= a + 0.75 && t < a + sv.reveal.shots[i].hold) && !!document.querySelector('.reveal-card .rc-bar');
        },
        null,
        { timeout: 90000, polling: 100 },
      )
      .catch(() => {});
  await atWorld();
  await page.waitForTimeout(300);
  const aside = await page.evaluate(() => {
    const r = document.querySelector('.rail');
    return { cine: document.documentElement.classList.contains('cine'), rail: r ? getComputedStyle(r).visibility : 'none' };
  });
  check(aside.cine && aside.rail === 'hidden', `the rest of the interface has stepped aside (the rail ${aside.rail})`);
  const mid = await page.evaluate((id) => {
    const e = window.__stel.engine();
    const s = window.__stel.state();
    const sv = e.system;
    const worlds = s.systems[id].bodies.filter((b) => sv.pickables.some((p) => p.id === `body:${b}`));
    const name = document.querySelector('.reveal-card .rc-name')?.textContent ?? '';
    const w = worlds.find((b) => s.bodies[b].name === name);
    const at = w ? sv.pickables.find((p) => p.id === `body:${w}`) : null;
    const kind = w ? s.bodies[w].kind : null;
    return {
      name,
      kind,
      lines: [...document.querySelectorAll('.reveal-card .rc-line')].map((x) => x.textContent),
      bars: document.querySelectorAll('.reveal-card .rc-bar').length,
      names: worlds.map((b) => s.bodies[b].name),
      shown: worlds.filter((b) => !sv.hidden(`body:${b}`)).length,
      hidden: worlds.filter((b) => sv.hidden(`body:${b}`)).length,
      // how near the camera is to the world being charted, against the whole system's distance
      near: at ? e.camera.position.distanceTo(at.pos) / sv.frameDistance() : 1,
    };
  }, target.id);
  await ck.shot('reveal-world.png');
  check(mid.names.includes(mid.name) && mid.lines.length >= 2 && mid.bars === 4, `the caption names a world as it is charted: ${mid.name} (${mid.lines.slice(0, 3).join(' · ')}; ${mid.bars} bars)`);
  check(mid.kind === 'deep' || mid.kind === 'asteroids' || mid.near < 0.3, `the camera is close to it (${(mid.near * 100).toFixed(0)}% of the whole system's distance)`);
  check(mid.shown >= 1 && (mid.hidden >= 1 || mid.names.length === 1), `one by one: ${mid.shown} charted, ${mid.hidden} still to come`);
  // Space goes on to the next world; a click on the view does too
  const place = () => page.evaluate(() => {
    const m = (document.querySelector('.reveal-card .eyebrow')?.textContent ?? '').match(/(\d+) of (\d+)/);
    return m ? [+m[1], +m[2]] : null;
  });
  const before = await place();
  if (before && before[0] < before[1] - 1) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);
    const after = await place();
    check(!!after && after[0] === before[0] + 1, `Space goes on to the next world (${before?.join(' of ')} → ${after?.join(' of ')})`);
    await atWorld();
    const b2 = await place();
    const box = await page.locator('canvas.stage-canvas').boundingBox();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.6);
    await page.waitForTimeout(400);
    const a2 = await place();
    check(!!b2 && !!a2 && a2[0] === b2[0] + 1, `and so does a click on the view (${b2?.join(' of ')} → ${a2?.join(' of ')})`);
  } else check(true, `Space and a click: too few worlds here to go on (${before?.join(' of ')}; skipped)`);
  // Enter skips it, ends no turn, and brings the interface back
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const skipped = await page.evaluate((id) => {
    const e = window.__stel.engine();
    const s = window.__stel.state();
    const worlds = s.systems[id].bodies.filter((b) => e.system.pickables.some((p) => p.id === `body:${b}`));
    const rail = document.querySelector('.rail');
    return { revealing: e.revealing, card: !!document.querySelector('.reveal-card'), hidden: worlds.filter((b) => e.system.hidden(`body:${b}`)).length, turn: s.turn, cine: document.documentElement.classList.contains('cine'), rail: rail ? getComputedStyle(rail).visibility : 'none' };
  }, target.id);
  check(!skipped.revealing && !skipped.card && skipped.hidden === 0, 'Enter skips it: every world at once, the caption gone');
  check(!skipped.cine && skipped.rail === 'visible', `the interface is back (the rail ${skipped.rail})`);
  check(skipped.turn === turn, `and ends no turn (turn ${turn} → ${skipped.turn})`);
  await page.waitForTimeout(1500);
  await ck.shot('reveal-skipped.png');
  // the same moment at any frame rate, the camera's place too: the engine stepped by hand, at 30
  // and at 144 frames a second, to 2 s and to 6 s into it
  const rate = await page.evaluate((id) => {
    const e = window.__stel.engine();
    const s = window.__stel.state();
    e.stop();
    const at = (fps, when) => {
      e.showGalaxy(undefined, undefined, true);
      for (let i = 0; i < 200 && e.view !== 'galaxy'; i++) e.frame(1 / 60);
      e.markForReveal(s, [id]);
      e.showSystem(id);
      for (let i = 0; i < 400 && !e.revealing; i++) e.frame(1 / fps);
      const sv = e.system;
      // (the worlds where they were as it began, the same in both runs: the switch into the view
      // comes a frame sooner or later at one rate than at the other, and they keep going round)
      sv.orbitsPaused = false;
      sv.orbitTime = 100 + (sv.time - sv.reveal.start);
      const left = when - (sv.time - sv.reveal.start);
      const n = Math.max(1, Math.round(left * fps));
      for (let i = 0; i < n; i++) e.frame(left / n);
      const scans = sv.planets.filter((p) => p.mat).map((p) => Math.round(p.mat.uniforms.uReveal.value * 1e4) / 1e4);
      const hidden = s.systems[id].bodies.filter((b) => sv.hidden(`body:${b}`)).length;
      const t = Math.round((sv.time - sv.reveal.start) * 1e6) / 1e6;
      const cam = e.camera.position.toArray().map((x) => Math.round(x * 1e3) / 1e3);
      e.skipReveal();
      return JSON.stringify({ t, scans, hidden, cam });
    };
    const out = { a2: at(30, 2), b2: at(144, 2), a6: at(30, 6), b6: at(144, 6) };
    e.start();
    return out;
  }, target.id);
  check(rate.a2 === rate.b2, `2 s into it, the same at 30 and at 144 frames a second (${rate.a2} / ${rate.b2})`);
  check(rate.a6 === rate.b6, `6 s into it as well (${rate.a6} / ${rate.b6})`);
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
  // (into a system, the view switched: it may be the one already shown, so wait for the switch itself;
  // in software the first two took 45 s and 37 s on 27 Oct, behind the frames above, so as long a wait)
  const enter = async (id) => {
    await page.evaluate((x) => window.__stel.engine().showSystem(x), id);
    await page.waitForFunction((x) => {
      const e = window.__stel.engine();
      return !e.pendingSwitch && e.view === 'system' && e.system.systemId === x;
    }, id, { timeout: 300000, polling: 50 });
    await page.waitForTimeout(150);
  };
  await page.evaluate(([a, b]) => window.__stel.engine().markForReveal(window.__stel.state(), [a, b].filter(Boolean)), [target.id, other]);
  await enter(target.id);
  const esc0 = await page.evaluate(() => window.__stel.engine().revealing);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const esc1 = await page.evaluate(() => window.__stel.engine().revealing);
  check(esc0 && !esc1, 'Escape skips it as well');
  // a find's card waits while the camera flies, and comes once the flight is over (24 Oct, the
  // player: "the planet exploration popup occurs while it's showing all the planets")
  await page.evaluate((id) => {
    const s = window.__stel.state();
    const b = s.systems[id].bodies.find((x) => s.bodies[x].kind !== 'deep');
    s.civ.pending.push({ uid: 'ev-waits', defId: 'relic_archive', data: { systemId: id, bodyId: b } });
    window.__stel.engine().markForReveal(s, [id]);
    window.__stel.refresh();
  }, target.id);
  await enter(target.id);
  const during = await page.evaluate(() => ({ revealing: window.__stel.engine().revealing, card: !!document.querySelector('.modal.event') }));
  check(during.revealing && !during.card, `a find's card waits while the camera flies (flying ${during.revealing}, card ${during.card})`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ revealing: window.__stel.engine().revealing, card: !!document.querySelector('.modal.event') }));
  check(!after.revealing && after.card, `Enter still skips the flight, and the card comes then (flying ${after.revealing}, card ${after.card})`);
  await page.evaluate(() => {
    window.__stel.state().civ.pending.length = 0;
    window.__stel.refresh();
  });
  await page.waitForTimeout(200);
  if (other) {
    await page.evaluate(([a, b]) => window.__stel.engine().markForReveal(window.__stel.state(), [a, b]), [target.id, other]);
    await enter(target.id);
    await page.locator('.reveal-card .btn', { hasText: /^Skip all$/ }).click();
    await page.waitForTimeout(300);
    await enter(other);
    const after = await page.evaluate(() => window.__stel.engine().revealing);
    check(!after, 'Skip all: the other system charted opens with its worlds');
  } else check(true, 'Skip all: no second charted system with worlds in this galaxy (skipped)');
  // a drag on the view takes the camera from it, where it is
  await page.evaluate((id) => window.__stel.engine().markForReveal(window.__stel.state(), [id]), target.id);
  await enter(target.id);
  const box = await page.locator('canvas.stage-canvas').boundingBox();
  const d0 = await page.evaluate(() => window.__stel.engine().rig.distance);
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5 + 30, box.y + box.height * 0.6, { steps: 4 });
  await page.mouse.move(box.x + box.width * 0.5 + 60, box.y + box.height * 0.6, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const dragged = await page.evaluate(() => ({ revealing: window.__stel.engine().revealing, d: window.__stel.engine().rig.goalDistance, cine: document.documentElement.classList.contains('cine') }));
  check(!dragged.revealing && !dragged.cine, 'a drag on the view ends it, the interface back');
  check(Math.abs(dragged.d - d0) / d0 < 0.5, `and the camera stays where it was, not flown back out (${d0.toFixed(1)} → ${dragged.d.toFixed(1)})`);
  // off in Settings: a system opens with its worlds
  await page.evaluate((id) => {
    window.__stel.reveals(false);
    window.__stel.engine().markForReveal(window.__stel.state(), [id]);
  }, target.id);
  await enter(target.id);
  const off = await page.evaluate(() => window.__stel.engine().revealing);
  check(!off, 'with reveals off, it opens with its worlds');
  await page.evaluate(() => window.__stel.reveals(null));
  // the magnifier mode: the caption has its place in the column, and the interface stays (this
  // page again: a second page in the same browser can hang loading, lib.cjs)
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
    const chrono = document.querySelector('.chrono');
    if (!card || !col) return null;
    const a = card.getBoundingClientRect();
    const c = col.getBoundingClientRect();
    return { inCol: card.parentElement === col && a.left >= c.left - 1 && a.right <= c.right + 1, w: Math.round(a.width), col: Math.round(c.width), chrono: chrono ? getComputedStyle(chrono).visibility : 'none' };
  });
  check(!!placed && placed.inCol, `in the magnifier mode the caption is in the column (${JSON.stringify(placed)})`);
  check(!!placed && placed.chrono === 'visible', 'and the interface stays');
  await lv.screenshot({ path: require('path').join(ck.out, 'reveal-lowvision.png') });
  await finish('SURVEY REVEAL', ck);
});
