// Browser check: the magnifier mode (Settings; a11y.ts), for a player with low vision who plays
// through a screen magnifier (the player's friend, 9 Oct). At 1280×720 and twice the size: the HUD
// in one scrolling column beside the map, the selection's panel last; faint text at 4.5:1 or more;
// the focus (which a magnifier follows) going to what opens; tooltips for the focus, beside the
// column; N, B and M; messages that stay; the map's names, markers and the name under the
// pointer; a probe sent to a star seen from afar from the Systems window; the camera keeping what
// is selected in the middle of the free part of the screen. A link (?lowvision) turns it on, and
// turning it off puts everything back.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('lowvision', { width: 1280, height: 720 });
  const { page } = ck;
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('steliterate.settings') || '{}');
    localStorage.setItem('steliterate.settings', JSON.stringify({ ...st, lowVision: true, uiScale: 2 }));
  });
  await page.reload();
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const s = window.__stel.state();
    for (const k of Object.keys(s.flags)) if (k.startsWith('tut')) delete s.flags[k];
    window.__stel.refresh();
  });
  await page.waitForTimeout(400);
  const z = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--z').trim());
  check(Number(z) === 2 && (await page.evaluate(() => document.documentElement.classList.contains('lv'))), `the mode is on, at twice the size (--z ${z})`);
  // the column: on the right, every part inside it, none over another, the panel last
  await page.evaluate(() => {
    const s = window.__stel.state();
    window.__stel.select('body', s.colonies[s.civ.capitalId].bodyId);
  });
  await page.waitForTimeout(800);
  const col = await page.evaluate(() => {
    const hud = document.querySelector('.hud').getBoundingClientRect();
    const parts = ['.chrono', '.resources', '.turnbox', '.rail', '.bottom-left', '.viewswitch', '.drawer'].map((sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return { sel, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    });
    const inside = parts.every((p) => p.left >= hud.left - 1 && p.right <= hud.right + 1);
    const ordered = [...parts].sort((a, b) => a.top - b.top);
    const apart = ordered.every((p, i) => i === 0 || ordered[i - 1].bottom <= p.top + 1);
    return { left: hud.left, width: hud.width, right: hud.right, w: innerWidth, inside, apart, last: ordered[ordered.length - 1].sel, order: ordered.map((p) => p.sel).join(' ') };
  });
  check(col.right >= col.w - 1 && col.width > 700 && col.width < col.w * 0.75, `one column on the right, ${Math.round(col.width)} of ${col.w} px`);
  check(col.inside && col.apart, `every part in the column, none over another (${col.order})`);
  check(col.last === '.drawer', 'the selection’s panel comes last, so nothing else moves when it changes');
  // the focus went to the panel
  const f1 = await page.evaluate(() => ({ h2: document.activeElement?.matches('.drawer-head h2'), name: document.activeElement?.textContent }));
  check(f1.h2, `choosing the capital sent the focus to its panel’s title (${f1.name})`);
  // the panel can be read whole: scroll to its end
  const reach = await page.evaluate(() => {
    const hud = document.querySelector('.hud');
    hud.scrollTop = hud.scrollHeight;
    const d = document.querySelector('.drawer').getBoundingClientRect();
    return d.bottom <= innerHeight + 1 && hud.scrollHeight > hud.clientHeight;
  });
  check(reach, 'the column scrolls, and the panel’s end comes into view');
  await ck.shot('lowvision-panel.png');
  // contrast: faint text and the edges of controls
  const contrast = await page.evaluate(() => {
    const lum = (c) => {
      const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map((x) => Number(x) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const bg = lum('rgb(13, 12, 14)');
    const ratio = (c) => (lum(c) + 0.05) / (bg + 0.05);
    const faint = getComputedStyle(document.querySelector('.drawer .faint, .faint')).color;
    const dim = getComputedStyle(document.querySelector('.dim') ?? document.body).color;
    return { faint: ratio(faint), dim: ratio(dim) };
  });
  check(contrast.faint >= 4.5 && contrast.dim >= 4.5, `faint text ${contrast.faint.toFixed(1)}:1 and dim text ${contrast.dim.toFixed(1)}:1 on the panels (at least 4.5)`);
  // B: the Build tab, focus on its list; Tab goes on to the first row, which shows its tooltip beside the column; Enter queues it
  await page.keyboard.press('b');
  await page.waitForTimeout(600);
  const onList = await page.evaluate(() => document.activeElement?.matches('.drawer .list-head'));
  check(onList, 'B opens the Build tab, the focus on its list');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);
  const row = await page.evaluate(() => {
    const a = document.activeElement;
    const tip = document.querySelector('.tip');
    const hud = document.querySelector('.hud').getBoundingClientRect();
    const t = tip?.getBoundingClientRect();
    return { row: a?.matches('.list-item.build'), name: a?.textContent?.slice(0, 30), tip: tip?.textContent?.slice(0, 40) ?? '', beside: !!t && t.right <= hud.left + 1 };
  });
  check(row.row, `Tab goes on to the first Build row (${row.name})`);
  check(!!row.tip && row.beside, `the focused row shows its tooltip beside the column (${row.tip})`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const esc = await page.evaluate(() => ({ tip: !!document.querySelector('.tip'), panel: !!document.querySelector('.drawer') }));
  check(!esc.tip && esc.panel, 'Escape puts the tooltip away, and only that');
  const q0 = await page.evaluate(() => window.__stel.state().colonies[window.__stel.state().civ.capitalId].queue.length);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const q1 = await page.evaluate(() => ({ q: window.__stel.state().colonies[window.__stel.state().civ.capitalId].queue.length, turn: window.__stel.state().turn }));
  check(q1.q === q0 + 1 && q1.turn === 1, `Enter queues it (queue ${q0} → ${q1.q}), the turn stays`);
  // N: what needs attention, one at a time (research first: the window opens on its title)
  await page.evaluate(() => {
    document.activeElement?.blur();
    const s = window.__stel.state();
    s.colonies[s.civ.capitalId].queue.length = 0;
    window.__stel.refresh();
  });
  await page.waitForTimeout(300);
  await page.keyboard.press('n');
  let n1 = { modal: '', focus: '' };
  for (let i = 0; i < 10 && n1.focus !== 'H1'; i++) {
    await page.waitForTimeout(200);
    n1 = await page.evaluate(() => ({ modal: document.querySelector('.modal h1')?.textContent, focus: document.activeElement?.tagName, cls: document.activeElement?.className }));
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.keyboard.press('n');
  await page.waitForTimeout(800);
  const n2 = await page.evaluate(() => ({ list: document.activeElement?.matches('.drawer .list-head'), panel: document.querySelector('.drawer-head h2')?.textContent, cap: window.__stel.state().colonies[window.__stel.state().civ.capitalId].name }));
  check(/Research/i.test(n1.modal ?? '') && n1.focus === 'H1', `N first opens Research, on its title (${n1.modal}; focus ${n1.focus} ${n1.cls ?? ''})`);
  check(n2.list && n2.panel === n2.cap, `N again: the idle settlement’s Build tab, the focus on its list (${n2.panel})`);
  // M folds the column away, and back
  await page.keyboard.press('m');
  await page.waitForTimeout(400);
  const folded = await page.evaluate(() => ({ w: document.querySelector('.hud').getBoundingClientRect().width, end: !!document.querySelector('.endturn')?.offsetParent }));
  await page.keyboard.press('m');
  await page.waitForTimeout(400);
  const unfolded = await page.evaluate(() => document.querySelector('.hud').getBoundingClientRect().width);
  check(folded.w < 400 && !folded.end && unfolded > 700, `M folds the column away (${Math.round(folded.w)} px) and back (${Math.round(unfolded)} px)`);
  // the camera keeps what is selected in the middle of the free part (it eases there on elapsed
  // time; a slow software renderer can take a few seconds, its frames capped at a tenth of one)
  let cam = { off: 0, want: Infinity };
  for (let i = 0; i < 30 && !(Math.abs(cam.off - cam.want) < 3); i++) {
    await page.waitForTimeout(200);
    cam = await page.evaluate(() => {
      const e = window.__stel.engine();
      const hud = document.querySelector('.hud').getBoundingClientRect();
      return { off: e.camera.view?.offsetX ?? 0, want: innerWidth / 2 - hud.left / 2 };
    });
  }
  check(Math.abs(cam.off - cam.want) < 3, `the view is shifted to centre the free part (${cam.off.toFixed(1)} px, wanted ${cam.want.toFixed(1)})`);
  // messages stay until closed (or the turn ends), with a button to close them
  await page.evaluate(() => window.__stel.notify('A check message.'));
  await page.waitForTimeout(7000);
  const toast = await page.evaluate(() => ({ there: [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('A check message.')), x: !!document.querySelector('.toast .toast-x') }));
  check(toast.there && toast.x, 'a message is still there after 7 s, with a button to close it');
  await page.locator('.toast .toast-x').first().click();
  await page.waitForTimeout(300);
  check(!(await page.evaluate(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('A check message.')))), 'and the button closes it');
  // the map: larger names, larger markers, no grain or vignette, the name under the pointer
  await page.locator('.viewswitch button', { hasText: 'Galaxy' }).click();
  let map = { font: 0 };
  for (let i = 0; i < 25 && !map.font; i++) {
    await page.waitForTimeout(200);
    map = await page.evaluate(() => {
      const e = window.__stel.engine();
      const lab = [...document.querySelectorAll('.map-label')].find((x) => x.style.display === 'block');
      const u = e.post.finish.uniforms;
      return { font: lab ? parseFloat(getComputedStyle(lab).fontSize) : 0, px: e.galaxy.nodeMat.uniforms.uPixel.value, pr: Math.min(devicePixelRatio || 1, 2), grain: u.uGrain.value, vig: u.uVignette.value, ca: u.uCA.value };
    });
  }
  check(map.font >= 29, `the map’s names at ${map.font} px (15 px at twice the size)`);
  check(Math.abs(map.px - map.pr * 1.5) < 1e-6 && map.grain === 0 && map.vig === 0 && map.ca === 0, `markers drawn 1.5× (${map.px}), no grain, vignette or colour fringes`);
  // (once the view has stopped moving: the star stays put on screen)
  // once the view has stopped moving (the camera still for a moment), a star in view in the free
  // part of the screen, nearest the middle of it (where a fleet waits at it, the fleet is named,
  // and where it is)
  let prevCam = '';
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(250);
    const c = await page.evaluate(() => {
      const e = window.__stel.engine();
      // (while the view changes over, the camera waits under the fade)
      if (e.pendingSwitch || e.fade > 0.02) return 'switching';
      const p = e.camera.position;
      return [p.x, p.y, p.z].map((v) => v.toFixed(3)).join(',');
    });
    if (c === prevCam && !c.startsWith('switching')) break;
    prevCam = c;
  }
  const star = await page.evaluate(() => {
    const s = window.__stel.state();
    const e = window.__stel.engine();
    const free = document.querySelector('.hud').getBoundingClientRect().left;
    let best = null;
    for (const p of e.galaxy.pickables) {
      if (p.kind !== 'system' || !s.systems[p.id]) continue;
      const at = e.screenOf(p.pos);
      if (!at.visible || at.x < 40 || at.x > free - 60 || at.y < 60 || at.y > innerHeight - 60) continue;
      const d = Math.hypot(at.x - free / 2, at.y - innerHeight / 2);
      if (!best || d < best.d) best = { id: p.id, d };
    }
    return best?.id ?? null;
  });
  const where = () =>
    page.evaluate((id) => {
      const s = window.__stel.state();
      const e = window.__stel.engine();
      const p = e.galaxy.pickables.find((x) => x.id === id);
      const at = p ? e.screenOf(p.pos) : { x: -1, y: -1 };
      return { x: at.x, y: at.y, name: s.systems[id]?.name ?? '?' };
    }, star);
  let spot = await where();
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(200);
    const next = await where();
    const still = Math.hypot(next.x - spot.x, next.y - spot.y) < 0.5;
    spot = next;
    if (still) break;
  }
  let hover = '';
  for (let i = 0; i < 6 && !hover.includes(spot.name); i++) {
    await page.mouse.move(spot.x - 40, spot.y - 40);
    await page.mouse.move(spot.x + (i % 2), spot.y, { steps: 5 });
    await page.waitForTimeout(300);
    hover = await page.evaluate(() => document.querySelector('.map-hover')?.textContent ?? '');
  }
  check(hover.includes(spot.name), `the star under the pointer is named beside it ("${hover}")`);
  await ck.shot('lowvision-map.png');
  // a probe sent to a star seen from afar, from the Systems window
  const probe = await page.evaluate(() => {
    const s = window.__stel.state();
    const f = Object.values(s.fleets).find((x) => x.at && x.ships.some((y) => y.cls === 'probe'));
    window.__stel.select('fleet', f.id);
    return f.id;
  });
  await page.waitForTimeout(600);
  await page.locator('.drawer button.more-dests').click();
  await page.waitForTimeout(600);
  const afar = await page.evaluate(() => ({ tab: [...document.querySelectorAll('.modal button')].find((b) => /Seen from afar/.test(b.textContent))?.classList.contains('primary'), rows: document.querySelectorAll('.modal .list-item').length, sends: document.querySelectorAll('.modal .send-here').length, focus: document.activeElement?.tagName }));
  check(afar.tab && afar.rows > 0 && afar.sends > 0, `a probe’s Systems window opens on the stars seen from afar (${afar.rows}, each with Send)`);
  await ck.shot('lowvision-afar.png');
  const target = await page.evaluate(() => document.querySelector('.modal .list-item')?.textContent.split(/\s+/).slice(0, 3).join(' '));
  await page.locator('.modal .send-here').first().click();
  await page.waitForTimeout(600);
  const sent = await page.evaluate((id) => {
    const s = window.__stel.state();
    const f = s.fleets[id];
    return { to: f.to, known: f.to ? s.civ.known[f.to] : null, name: f.to ? s.systems[f.to].name : '' };
  }, probe);
  check(!!sent.to && sent.known === 1, `and Send sets it out for one of them (${sent.name}, from "${target}")`);
  // turning the mode off puts things back
  await page.evaluate(() => {
    document.activeElement?.blur();
  });
  await page.locator('.rail button[aria-label^="Menu"]').click();
  await page.waitForTimeout(500);
  await page.locator('.modal .field', { hasText: 'Magnifier mode' }).locator('button', { hasText: /^Off$/ }).click();
  await page.waitForTimeout(500);
  const off = await page.evaluate(() => ({ lv: document.documentElement.classList.contains('lv'), z: getComputedStyle(document.documentElement).getPropertyValue('--z').trim(), hud: getComputedStyle(document.querySelector('.hud')).display, scale: JSON.parse(localStorage.getItem('steliterate.settings')).uiScale }));
  check(!off.lv && off.hud === 'contents' && off.scale <= 1.4, `Off: the HUD as before (${off.hud}), the size back within the usual ones (${off.scale}, --z ${off.z})`);
  // a link turns it on (a fresh browser profile)
  const other = await ck.another(1280, 720);
  await other.goto(`${process.argv[2] || 'http://localhost:4173/'}?lowvision`, { timeout: 90000, waitUntil: 'domcontentloaded' });
  await other.waitForTimeout(1500);
  const linked = await other.evaluate(() => ({ lv: document.documentElement.classList.contains('lv'), saved: JSON.parse(localStorage.getItem('steliterate.settings') || '{}').lowVision }));
  check(linked.lv && linked.saved === true, 'the link …/?lowvision turns it on, and it is kept');
  await finish('LOW VISION', ck);
});
