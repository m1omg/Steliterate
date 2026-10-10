// Browser check: the phone layouts (styles.css, the phones block; store.ts isPhone), with a
// touchscreen, upright at three sizes and held sideways. The top bar says the turn and how long
// this turn and the next are, and a tap on that line opens the timeline, the forecasts and the
// Record. Nothing in the HUD overlaps, the page never scrolls sideways, and every name on the rail
// fits (when the real fonts are at hand: STEL_FONTS, lib.cjs). A star tapped on the map opens its
// sheet small and stays in sight above (or beside) it; dragging the map lowers the sheet; its
// handle steps it up. A tap leaves no tooltip, a long press shows one and presses nothing. Choose
// on map shows the trip at the first tap and sends at Send. The magnifier mode and a PC screen keep
// their own layouts.
const { check, start, finish, run } = require('../lib.cjs');

const SIZES = [
  ['upright', 390, 844],
  ['small', 360, 740],
  ['tablet', 625, 1000],
  ['sideways', 844, 390],
];

/** Where the star (or world) with this id is on screen, and what is there. */
const onScreen = (page, id) =>
  page.evaluate((sid) => {
    const e = window.__stel.engine();
    const list = e.view === 'galaxy' ? e.galaxy.pickables : e.system.pickables;
    const p = list.find((x) => x.id === sid);
    if (!p) return null;
    const v = p.pos.clone().project(e.camera);
    const r = e.renderer.domElement.getBoundingClientRect();
    const x = r.left + ((v.x + 1) / 2) * r.width;
    const y = r.top + ((1 - v.y) / 2) * r.height;
    const at = document.elementFromPoint(x, y);
    return { x, y, inside: x > 0 && y > 0 && x < innerWidth && y < innerHeight, map: !!at && (at.tagName === 'CANVAS' || at.classList.contains('map-label') || at.classList.contains('label-layer')) };
  }, id);

/**
 * Waits until the star with this id stops moving on screen (a camera flight or the view sliding
 * for a panel eases on elapsed time, and the software renderer can be slow: DEV-NOTES, Gotchas).
 */
async function settled(page, id, still = 3) {
  let last = await onScreen(page, id);
  let calm = 0;
  for (let i = 0; i < 40 && calm < still; i++) {
    await page.waitForTimeout(250);
    const now = await onScreen(page, id);
    calm = last && now && Math.hypot(now.x - last.x, now.y - last.y) < 0.75 ? calm + 1 : 0;
    last = now;
  }
  return last;
}

/** Waits until the view is no longer slid aside for a panel (the slide's goal follows a redraw, which a slow renderer delays). */
async function unshifted(page) {
  for (let i = 0; i < 60; i++) {
    const off = await page.evaluate(() => { const v = window.__stel.engine().camera.view; return v && v.enabled ? Math.abs(v.offsetY) + Math.abs(v.offsetX) : 0; });
    if (off < 0.5) return true;
    await page.waitForTimeout(200);
  }
  return false;
}

/** A long press with one finger (CDP touch events), held for ms. */
async function longPress(page, x, y, ms = 750) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(ms);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** A one-finger drag across the map. */
async function drag(page, x, y, dx, dy) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / 8, y: y + (dy * i) / 8 }] });
    await page.waitForTimeout(30);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

const rectOf = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, shown: r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' };
  }, sel);

run(async () => {
  const ck = await start('mobile');
  for (const [name, w, h] of SIZES) {
    const page = await ck.phone(w, h);
    const shot = (f) => page.screenshot({ path: `${ck.out}/${name}-${f}.png` });
    await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
    await page.waitForTimeout(1800);
    const upright = w <= 760;

    // the turn line
    const line = await page.evaluate(() => {
      const el = document.querySelector('.chrono-line');
      const r = el?.getBoundingClientRect();
      return el && r ? { text: el.textContent, shown: r.width > 0 && r.height > 0, inside: r.left >= 0 && r.right <= innerWidth + 0.5 && r.top >= 0 } : null;
    });
    check(!!line?.shown && line.inside && /Turn\s*1/.test(line.text) && /this turn 40 yr/.test(line.text) && /next 40 yr/.test(line.text), `${name}: the top bar says the turn, this turn's span and the next's (${line?.text})`);

    // nothing overlaps, nothing scrolls sideways, every name on the rail fits
    const layout = await page.evaluate(() => {
      const parts = ['.chrono', '.resources', '.rail', '.turnbox .pace', '.endturn', '.viewswitch', '.todo'];
      const rs = parts.map((s) => [s, document.querySelector(s)?.getBoundingClientRect()]).filter(([, r]) => r && r.width > 0);
      const over = [];
      for (let i = 0; i < rs.length; i++)
        for (let j = i + 1; j < rs.length; j++) {
          const [a, ra] = rs[i];
          const [b, rb] = rs[j];
          const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (ox > 1 && oy > 1) over.push(`${a}×${b}`);
        }
      const fonts = document.fonts.check('10px "Saira Semi Condensed"');
      const clipped = [...document.querySelectorAll('.rail .iconbtn')].filter((b) => b.offsetParent).map((b) => b.querySelector('.rl-short')).filter((l) => l && l.parentElement.scrollWidth > l.parentElement.clientWidth + 0.5).map((l) => l.textContent);
      const off = [...document.querySelectorAll('.rail, .turnbox, .chrono, .resources')].some((el) => { const r = el.getBoundingClientRect(); return r.right > innerWidth + 0.5 || r.left < -0.5; });
      return { over, sideways: document.documentElement.scrollWidth > innerWidth + 0.5, fonts, clipped, off, rail: [...document.querySelectorAll('.rail .iconbtn')].filter((b) => b.offsetParent).length };
    });
    check(layout.over.length === 0, `${name}: the HUD's parts do not overlap${layout.over.length ? ` (${layout.over.join(', ')})` : ''}`);
    check(!layout.sideways && !layout.off, `${name}: nothing runs off the side of the screen`);
    check(layout.rail === 8, `${name}: the rail has its 8 buttons (Codex and Save are in Menu)`);
    if (layout.fonts) check(layout.clipped.length === 0, `${name}: every name on the rail fits${layout.clipped.length ? ` (cut: ${layout.clipped.join(', ')})` : ''}`);
    else console.log(`   (${name}: the game's fonts are not at hand here, so the rail's names are not measured; STEL_FONTS)`);
    await shot('1-start');

    // a star tapped on the map: its sheet opens small, and the star stays in sight
    const home = await page.evaluate(() => window.__stel.state().civ.homeSystemId);
    const at = await settled(page, home);
    await page.touchscreen.tap(at.x, at.y);
    await page.waitForTimeout(600);
    await settled(page, home);
    const picked = await page.evaluate(() => ({ sel: window.__stel.state() && document.querySelector('.drawer')?.className, title: document.querySelector('.drawer-head h2')?.textContent }));
    const after = await onScreen(page, home);
    const drawer = await rectOf(page, '.drawer');
    check(!!picked.sel && (!upright || /\bs0\b/.test(picked.sel)), `${name}: the tapped star's panel opens${upright ? ' small' : ''} (${picked.title})`);
    check(after.inside && after.map, `${name}: the tapped star is still in sight, not under a panel`);
    if (upright) check(drawer.height <= h * 0.36, `${name}: the small sheet leaves the map most of the screen (${Math.round(drawer.height)} of ${h} px)`);
    else check(drawer.left > w * 0.4 && after.x < drawer.left, `${name}: held sideways, the panel is on the right and the star to its left`);
    await shot('2-tap-star');

    // a tap leaves no tooltip
    await page.locator('.pace-pick').tap();
    await page.waitForTimeout(400);
    const menu = await page.evaluate(() => ({ open: !!document.querySelector('.pace-menu'), opts: [...document.querySelectorAll('.pace-menu .pm-opt')].map((b) => b.querySelector('b')?.textContent + ': ' + b.querySelector('.pm-why')?.textContent), tip: !!document.querySelector('.tip') }));
    check(menu.open && menu.opts.length >= 3 && menu.opts.every((o) => o.length > 20), `${name}: the pace opens as a list, each choice explained (${menu.opts.length})`);
    check(!menu.tip, `${name}: tapping leaves no tooltip over the screen`);
    await shot('3-pace');
    await page.locator('.pace-pick').tap();
    await page.waitForTimeout(300);

    // a long press shows a tip and presses nothing
    const rb = await rectOf(page, '.rail .iconbtn');
    await longPress(page, rb.left + rb.width / 2, rb.top + rb.height / 2);
    await page.waitForTimeout(400);
    const lp = await page.evaluate(() => ({ tip: document.querySelector('.tip')?.textContent ?? '', modal: !!document.querySelector('.modal') }));
    check(/Research/.test(lp.tip) && !lp.modal, `${name}: a long press on Research shows its tip and opens nothing (${lp.tip.slice(0, 40)})`);
    await shot('4-long-press');
    await page.touchscreen.tap(w / 2, upright ? (await rectOf(page, '.resources')).bottom + 40 : h / 2);
    await page.waitForTimeout(300);
    check(!(await page.evaluate(() => !!document.querySelector('.tip'))), `${name}: the next touch puts the tip away`);

    // the turn line opens the timeline, the forecasts and the Record
    await page.locator('.chrono-line').tap();
    await page.waitForTimeout(500);
    const more = await page.evaluate(() => {
      const bl = document.querySelector('.bottom-left');
      const ruler = document.querySelector('.chrono .ruler');
      const res = document.querySelector('.resources').getBoundingClientRect();
      const ch = document.querySelector('.chrono').getBoundingClientRect();
      return { open: !!bl && bl.classList.contains('open') && bl.getBoundingClientRect().height > 0, forecasts: bl?.querySelectorAll('.forecast').length ?? 0, ruler: (ruler?.getBoundingClientRect().height ?? 0) > 20, clear: res.top >= ch.bottom - 1 };
    });
    check(more.open && more.forecasts > 0 && more.ruler && more.clear, `${name}: the turn line opens the timeline and the forecasts (${more.forecasts}), the resources moving down for them`);
    await shot('5-more');
    await page.locator('.chrono-line').tap();
    await page.waitForTimeout(300);

    if (upright) {
      // from a button or a list, the sheet opens at the size last set; the handle steps it up;
      // dragging the map lowers it again
      await page.evaluate(() => { const g = window.__stel.state(); window.__stel.select('body', Object.values(g.colonies)[0].bodyId); });
      await page.waitForTimeout(1200);
      const s1 = await page.evaluate(() => document.querySelector('.drawer')?.className ?? '');
      check(/\bs1\b/.test(s1), `${name}: chosen from elsewhere, the sheet opens at half (${s1})`);
      await page.locator('.sheet-handle').tap();
      await page.waitForTimeout(500);
      const s2 = await page.evaluate(() => document.querySelector('.drawer')?.className ?? '');
      check(/\bs2\b/.test(s2), `${name}: a tap on the handle steps it up to full`);
      await page.locator('.sheet-handle').tap();
      await page.waitForTimeout(300);
      await page.locator('.sheet-handle').tap();
      await page.waitForTimeout(300);
      const res = await rectOf(page, '.resources');
      await drag(page, w / 2, res.bottom + 30, 80, 0);
      await page.waitForTimeout(500);
      const s0 = await page.evaluate(() => document.querySelector('.drawer')?.className ?? '');
      check(/\bs0\b/.test(s0), `${name}: dragging the map lowers the sheet to small`);
      await page.evaluate(() => { const hp = JSON.parse(localStorage.getItem('steliterate.hud') || '{}'); return hp.sheet; }).then((v) => check(v === 1, `${name}: the size set with the handle is remembered (${v})`));
    }

    // Choose on map, by touch: the first tap shows the trip, Send sends
    const probe = await page.evaluate(() => {
      const g = window.__stel.state();
      const f = Object.values(g.fleets).find((x) => x.at && x.ships.some((s) => s.cls === 'probe'));
      window.__stel.select('fleet', f.id);
      window.__stel.engine().showGalaxy(f.at, 60, true);
      return f.id;
    });
    await page.waitForTimeout(1200);
    await page.locator('.drawer button:has-text("Choose on map")').first().tap();
    await page.waitForTimeout(1600);
    const picking = await page.evaluate(() => ({ banner: !!document.querySelector('.targeting'), drawer: (() => { const d = document.querySelector('.drawer'); return !!d && d.getBoundingClientRect().height > 0; })() }));
    check(picking.banner && !picking.drawer, `${name}: choosing a destination, the panel folds away and the banner shows`);
    check(await unshifted(page), `${name}: with the panel away, the map is no longer slid aside for it`);
    const dest = await page.evaluate((fid) => {
      const g = window.__stel.state();
      const e = window.__stel.engine();
      const here = g.fleets[fid].at;
      const r = e.renderer.domElement.getBoundingClientRect();
      const top = document.querySelector('.targeting').getBoundingClientRect().bottom + 20;
      const bottom = document.querySelector('.rail').getBoundingClientRect().top - 20;
      const right = document.querySelector('.viewswitch').getBoundingClientRect().left - 20;
      for (const p of e.galaxy.pickables) {
        if (p.kind !== 'system' || p.id === here || g.systems[p.id]?.gone) continue;
        const v = p.pos.clone().project(e.camera);
        const x = r.left + ((v.x + 1) / 2) * r.width;
        const y = r.top + ((1 - v.y) / 2) * r.height;
        if (v.z < 1 && x > 40 && x < right && y > top && y < bottom) return { id: p.id, name: g.systems[p.id].name, x, y };
      }
      return null;
    }, probe);
    check(!!dest, `${name}: a star to send it to is in sight`);
    if (dest) {
      const there = await settled(page, dest.id);
      await page.touchscreen.tap(there.x, there.y);
      await page.waitForTimeout(500);
      const shown = await page.evaluate((fid) => ({ est: document.querySelector('.targeting .target-est')?.textContent ?? '', send: !!document.querySelector('.targeting .btn.primary'), to: window.__stel.state().fleets[fid].to ?? null }), probe);
      check(shown.send && shown.est.length > 0 && shown.to === null, `${name}: the first tap shows the trip and sends nothing yet (${shown.est.slice(0, 50)})`);
      await shot('6-choose');
      await page.locator('.targeting .btn.primary').tap();
      await page.waitForTimeout(600);
      const sent = await page.evaluate((fid) => ({ to: window.__stel.state().fleets[fid].to ?? null, banner: !!document.querySelector('.targeting') }), probe);
      check(!!sent.to && !sent.banner, `${name}: Send sends it, and the banner goes`);
    }
    await page.context().close();
  }

  // the magnifier mode keeps its column on a phone; a PC keeps its own layout
  const lv = await ck.phone(390, 844, '?lowvision');
  await lv.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await lv.waitForTimeout(1500);
  const lvl = await lv.evaluate(() => ({ line: getComputedStyle(document.querySelector('.chrono-line')).display, hud: getComputedStyle(document.querySelector('.hud')).display, codex: !!document.querySelector('.rail button[aria-label^="Codex"]')?.offsetParent }));
  check(lvl.line === 'none' && lvl.hud === 'flex' && lvl.codex, `the magnifier mode on a phone keeps its own column (${JSON.stringify(lvl)})`);
  await lv.screenshot({ path: `${ck.out}/lowvision-phone.png` });
  await lv.context().close();
  const pc = ck.page;
  await pc.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await pc.waitForTimeout(1200);
  const pcl = await pc.evaluate(() => ({ line: getComputedStyle(document.querySelector('.chrono-line')).display, pace: getComputedStyle(document.querySelector('.pace-phone')).display, opts: getComputedStyle(document.querySelector('.pace .opts')).display, rail: [...document.querySelectorAll('.rail .iconbtn')].filter((b) => b.offsetParent).length, handle: !!document.querySelector('.sheet-handle')?.offsetParent }));
  check(pcl.line === 'none' && pcl.pace === 'none' && pcl.opts !== 'none' && pcl.rail === 10 && !pcl.handle, `a PC screen keeps its layout: no turn line, pace buttons, all 10 on the rail (${JSON.stringify(pcl)})`);
  await finish('MOBILE', ck);
});
