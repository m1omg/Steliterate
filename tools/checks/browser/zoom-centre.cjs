// Browser check: zooming keeps what is in focus in the middle (wheel and pinch); after a pan the
// wheel heads for the pointer again; zooming in on a centred star still enters it.
const { check, start, finish, run, url } = require('../lib.cjs');
const IGNORE = /fonts\.g|ERR_CERT|net::ERR_|GPU stall|Automatic fallback to software WebGL/;

/** Where a star (galaxy view) or a body (system view) is on screen, and the canvas centre. */
async function onScreen(page, kind, id) {
  return page.evaluate(
    ([kind, id]) => {
      const e = window.__stel.engine();
      const pos = kind === 'star' ? e.galaxy.pickables.find((x) => x.kind === 'system' && x.id === id)?.pos : e.system.bodyFocus(id)?.pos;
      if (!pos) return null;
      const v = pos.clone().project(e.camera);
      const r = e.renderer.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    },
    [kind, id],
  );
}
const off = (p) => Math.hypot(p.x - p.cx, p.y - p.cy);

/** A known star on screen, off centre, clear of the panels; not one of `not`. */
async function pickStar(page, not) {
  return page.evaluate((not) => {
    const e = window.__stel.engine();
    const s = window.__stel.state();
    const r = e.renderer.domElement.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let best = null;
    for (const p of e.galaxy.pickables) {
      if (p.kind !== 'system' || not.includes(p.id) || !(s.civ.known[p.id] > 0)) continue;
      const v = p.pos.clone().project(e.camera);
      if (v.z > 1) continue;
      const x = r.left + ((v.x + 1) / 2) * r.width;
      const y = r.top + ((1 - v.y) / 2) * r.height;
      if (x < 320 || x > 980 || y < 200 || y > 640) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d < 120) continue;
      // nothing else close by on screen, so the click picks this one
      const crowd = e.galaxy.pickables.some((q) => {
        if (q === p) return false;
        const w = q.pos.clone().project(e.camera);
        return Math.hypot(r.left + ((w.x + 1) / 2) * r.width - x, r.top + ((1 - w.y) / 2) * r.height - y) < 22;
      });
      if (crowd) continue;
      if (!best || d < best.d) best = { id: p.id, d };
    }
    return best?.id ?? null;
  }, not);
}


/**
 * Let the camera finish moving: wait for `sim` seconds of the engine's own clock (its frames
 * run on elapsed time with dt capped at 0.1 s, so slow software-GL frames stretch real time).
 */
async function settle(page, sim = 3.5, max = 60000) {
  const t0 = Date.now();
  const n0 = await page.evaluate(() => window.__stel.engine().now);
  while (Date.now() - t0 < max) {
    await page.waitForTimeout(150);
    const n = await page.evaluate(() => window.__stel.engine().now);
    if (n - n0 >= sim) return;
  }
  console.log('    (the engine clock stalled)');
}

async function wheel(page, steps, dy, gap = 80) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy);
    await page.waitForTimeout(gap);
  }
}

async function fresh(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !IGNORE.test(m.text()) && page.errors.push(m.text()));
  await page.goto(url, { timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1500);
  return { ctx, page };
}

run(async () => {
  const ck = await start('zoom-centre');
  const browser = ck.browser;
  await ck.page.close();

  // ---------------------------------------------------------------- galaxy view, mouse
  {
    const { ctx, page } = await fresh(browser);
    const a = await pickStar(page, []);
    check(!!a, `an off-centre star to click (${a})`);
    const a0 = await onScreen(page, 'star', a);
    await page.mouse.click(a0.x, a0.y);
    await settle(page);
    check((await page.evaluate(() => window.__stel.engine().galaxy.selected)) === a, 'the click selects it');
    let p = await onScreen(page, 'star', a);
    check(off(p) < 2, `it flies to the middle (${off(p).toFixed(2)} px off)`);
    // the pointer rests where the star was: wheel out five steps, then in five
    await page.mouse.move(a0.x, a0.y);
    await wheel(page, 5, 120);
    await settle(page);
    p = await onScreen(page, 'star', a);
    check(off(p) < 2, `wheel out, pointer aside: still in the middle (${off(p).toFixed(2)} px off)`);
    await wheel(page, 5, -120);
    await settle(page);
    p = await onScreen(page, 'star', a);
    check(off(p) < 2, `wheel in, pointer aside: still in the middle (${off(p).toFixed(2)} px off)`);

    // a wheel turn during the centring flight
    const b = await pickStar(page, [a]);
    const b0 = await onScreen(page, 'star', b);
    await page.mouse.click(b0.x, b0.y);
    await page.mouse.move(260, 240);
    await wheel(page, 3, 120, 40);
    await settle(page);
    p = await onScreen(page, 'star', b);
    check(off(p) < 2, `wheel during the centring flight: it still lands in the middle (${off(p).toFixed(2)} px off)`);

    // a right-drag pan lets go: the wheel heads for the pointer again
    await page.mouse.move(700, 450);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(770, 490, { steps: 8 });
    await page.mouse.up({ button: 'right' });
    await settle(page);
    check((await page.evaluate(() => window.__stel.engine().rig.centred)) === false, 'a pan lets go of the centre');
    const P = { x: 430, y: 320 };
    const A = await page.evaluate(([x, y]) => {
      const a = window.__stel.engine().zoomAnchorAt(x, y);
      return a ? [a.x, a.y, a.z] : null;
    }, [P.x, P.y]);
    check(!!A, 'there is something under the pointer to zoom toward');
    await page.mouse.move(P.x, P.y);
    await wheel(page, 3, -120);
    await settle(page);
    const Ap = await page.evaluate((A) => {
      const e = window.__stel.engine();
      const v = e.camera.position.clone().set(A[0], A[1], A[2]).project(e.camera);
      const r = e.renderer.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    }, A);
    const drift = Math.hypot(Ap.x - P.x, Ap.y - P.y);
    check(drift < 3, `roaming free: what is under the pointer stays under it (${drift.toFixed(2)} px)`);

    // zooming in on a centred star still enters it
    await page.evaluate(() => window.__stel.engine().focusGalaxyOn(window.__stel.state().civ.homeSystemId, 150, true));
    await settle(page);
    const c = await pickStar(page, [a, b]);
    const c0 = await onScreen(page, 'star', c);
    await page.mouse.click(c0.x, c0.y);
    await settle(page);
    await page.mouse.move(260, 240);
    await wheel(page, 16, -120);
    await settle(page);
    const inside = await page.evaluate(() => {
      const e = window.__stel.engine();
      return { view: e.view, id: e.system.systemId };
    });
    check(inside.view === 'system' && inside.id === c, `zooming in on the centred star enters it (${inside.view} ${inside.id}, wanted ${c})`);
    check(page.errors.length === 0, `no page errors (${page.errors.slice(0, 3).join(' | ')})`);
    await ctx.close();
  }

  // ---------------------------------------------------------------- system view, touch
  {
    const { ctx, page } = await fresh(browser, { hasTouch: true });
    // the homeworld, focused and followed (as the Systems list does)
    const home = await page.evaluate(() => {
      const s = window.__stel.state();
      return s.systems[s.civ.homeSystemId].bodies.find((id) => s.bodies[id].colonyId) ?? null;
    });
    check(!!home, `the homeworld (${home})`);
    await page.evaluate(() => { window.__stel.engine().orbitsPaused = true; });
    await page.evaluate((id) => {
      const s = window.__stel.state();
      window.__stel.engine().showSystem(s.civ.homeSystemId, id);
    }, home);
    await settle(page);
    let p = await onScreen(page, 'body', home);
    check(p && off(p) < 2, `the followed homeworld sits in the middle (${p && off(p).toFixed(2)} px off)`);
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
    const cx = 700;
    const cy = 450;
    // an uneven pinch: one finger still, the other opening 150 px
    await touch('touchStart', [[cx - 100, cy], [cx + 40, cy]]);
    for (let i = 1; i <= 15; i++) {
      await touch('touchMove', [[cx - 100, cy], [cx + 40 + 10 * i, cy]]);
      await page.waitForTimeout(16);
    }
    await touch('touchEnd', []);
    await settle(page);
    p = await onScreen(page, 'body', home);
    const d0 = await page.evaluate(() => window.__stel.engine().rig.distance);
    check(off(p) < 3, `an uneven pinch leaves it in the middle (${off(p).toFixed(2)} px off; zoom now ${d0.toFixed(2)})`);
    // a short pinch whose last finger lingers and slides 15 px before lifting: not a drag
    const raw = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
    await raw('touchStart', [[cx - 100, cy, 1], [cx + 100, cy, 2]]);
    await raw('touchMove', [[cx - 100, cy, 1], [cx + 70, cy, 2]]);
    await page.waitForTimeout(16);
    await raw('touchMove', [[cx + 70, cy, 2]]); // finger 1 lifts
    for (let i = 1; i <= 3; i++) {
      await raw('touchMove', [[cx + 70 + 5 * i, cy, 2]]);
      await page.waitForTimeout(16);
    }
    await raw('touchEnd', []);
    await settle(page);
    p = await onScreen(page, 'body', home);
    check(off(p) < 3, `a short pinch with a lingering finger leaves it in the middle (${off(p).toFixed(2)} px off)`);
    // a parallel two-finger drag still pans
    await touch('touchStart', [[cx - 100, cy], [cx + 100, cy]]);
    for (let i = 1; i <= 10; i++) {
      await touch('touchMove', [[cx - 100, cy + 10 * i], [cx + 100, cy + 10 * i]]);
      await page.waitForTimeout(16);
    }
    await touch('touchEnd', []);
    await settle(page);
    p = await onScreen(page, 'body', home);
    check(off(p) > 50, `a two-finger drag still slides the view (${off(p).toFixed(2)} px off)`);
    check(page.errors.length === 0, `no page errors (${page.errors.slice(0, 3).join(' | ')})`);
    await ctx.close();
  }

  await finish('ZOOM CENTRE', ck);
});
