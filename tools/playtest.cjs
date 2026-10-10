// Automated playtest against a served build (npm run build && npx vite preview --port 4173).
//   node tools/playtest.cjs [url] [outDir]
// Checks: no console errors, every screen opens, every era renders at desktop and phone size,
// and the animation is independent of the display refresh rate (30 Hz vs 144 Hz).
/* eslint-disable */
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const url = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || 'playtest-shots';
const fs = require('fs');
fs.mkdirSync(out, { recursive: true });

const IGNORE = /fonts\.g|ERR_CERT|net::ERR_|GPU stall|Automatic fallback to software WebGL/;
let failures = 0;
const fail = (m) => {
  failures++;
  console.log('FAIL', m);
};

async function page(browser, w, h) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  p.errors = [];
  p.on('console', (m) => {
    if (m.type() === 'error' && !IGNORE.test(m.text())) p.errors.push(m.text());
  });
  p.on('pageerror', (e) => p.errors.push(String(e)));
  await p.goto(url);
  await p.waitForTimeout(1500);
  return p;
}

async function toEra(p, era) {
  await p.evaluate((target) => {
    const order = ['dusk', 'degenerate', 'blackhole', 'dark'];
    const S = window.__stel;
    for (let i = 0; i < 600; i++) {
      const s = S.state();
      if (!s || s.outcome || order.indexOf(s.era) >= order.indexOf(target)) break;
      S.endTurns(1);
    }
  }, era);
  await p.waitForTimeout(1200);
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  // ---------------------------------------------------------------- screens and eras, desktop + phone
  for (const [w, h, tag] of [
    [1440, 900, 'desk'],
    [400, 860, 'phone'],
  ]) {
    const p = await page(browser, w, h);
    await p.screenshot({ path: `${out}/${tag}-menu.png` });
    await p.evaluate(() => window.__stel.newGame({ seed: 24757 }));
    await p.waitForTimeout(1500);
    // (the rail's shown buttons: on a phone Codex and Save are under Menu, checked after)
    const railCount = await p.locator('.rail button:visible').count();
    for (let i = 0; i < railCount; i++) {
      await p.locator('.rail button:visible').nth(i).click();
      await p.waitForTimeout(250);
      if (!(await p.locator('.modal').count())) fail(`${tag}: rail button ${i} opened nothing`);
      await p.keyboard.press('Escape');
    }
    if (railCount < (await p.locator('.rail button').count())) {
      for (const what of ['Codex', 'Save slots']) {
        await p.locator('.rail button[aria-label^="Menu"]').click();
        await p.waitForTimeout(250);
        await p.locator(`.modal button:has-text("${what}")`).first().click();
        await p.waitForTimeout(250);
        if (!(await p.locator('.modal').count())) fail(`${tag}: ${what} under Menu opened nothing`);
        await p.keyboard.press('Escape');
      }
    }
    for (const era of ['dusk', 'degenerate', 'blackhole', 'dark']) {
      await toEra(p, era);
      await p.evaluate(() => {
        const s = window.__stel.state();
        window.__stel.engine().focusGalaxyOn(s.civ.homeSystemId, 400, true);
      });
      await p.waitForTimeout(900);
      await p.screenshot({ path: `${out}/${tag}-${era}-galaxy.png` });
      const cap = await p.evaluate(() => {
        const s = window.__stel.state();
        const c = Object.values(s.colonies)[0];
        return c ? c.systemId : null;
      });
      if (cap) {
        await p.evaluate((id) => window.__stel.engine().showSystem(id), cap);
        await p.waitForTimeout(1500);
        await p.screenshot({ path: `${out}/${tag}-${era}-system.png` });
        await p.evaluate(() => window.__stel.engine().showGalaxy());
        await p.waitForTimeout(600);
      }
    }
    if (p.errors.length) fail(`${tag}: console errors:\n  ${p.errors.slice(0, 8).join('\n  ')}`);
    await p.close();
  }

  // ---------------------------------------------------------------- features: guide, keys, prompts, focus
  {
    const p = await page(browser, 1440, 900);
    const shot = (name) => p.screenshot({ path: `${out}/feat-${name}.png` });
    // Close whatever story dialog a turn left open.
    const clearModals = async () => {
      for (let i = 0; i < 6 && (await p.locator('.modal').count()); i++) {
        await p.keyboard.press('Escape');
        await p.waitForTimeout(200);
        if (await p.locator('.modal').count()) {
          const b = p.locator('.modal .choice, .modal .modal-body button').first();
          if (await b.count()) await b.click();
          await p.waitForTimeout(300);
        }
      }
    };
    const endTurn = async () => {
      await clearModals();
      await p.locator('.endturn').click();
      await p.waitForTimeout(2600);
    };
    await p.evaluate(() => window.__stel.newGame({ seed: 24757, tutorial: true }));
    await p.waitForTimeout(1500);
    if (!(await p.locator('.tutorial').count())) fail('guide did not appear');
    await p.locator('.tutorial .btn.primary').click();
    await p.waitForTimeout(400);
    await shot('tutorial');
    // shortcuts: R opens and closes research, K opens the Codex on the manual
    await p.keyboard.press('r');
    await p.waitForTimeout(250);
    if (!(await p.locator('.modal').count())) fail('R did not open research');
    await p.keyboard.press('r');
    await p.waitForTimeout(250);
    if (await p.locator('.modal').count()) fail('R did not close research');
    await p.keyboard.press('k');
    await p.waitForTimeout(300);
    if (!(await p.locator('.codex-body.manual').count())) fail('K did not open the manual');
    await shot('manual');
    await p.keyboard.press('Escape');
    await p.locator('.tutorial [aria-label="End the guide"]').click();
    // research prompt after a finished project
    await p.evaluate(() => {
      const s = window.__stel.state();
      s.civ.researching = 'fusion';
      s.civ.research.fusion = 1e7;
      const probes = Object.values(s.fleets);
      const near = Object.values(s.systems)
        .filter((x) => x.id !== s.civ.homeSystemId && s.civ.known[x.id] === 1)
        .map((x) => { const h = s.systems[s.civ.homeSystemId].phys; return { x, d: Math.hypot(x.phys.x - h.x, x.phys.y - h.y, x.phys.z - h.z) }; })
        .sort((a, b) => a.d - b.d);
      probes.forEach((f, i) => near[i] && window.__stel.orderFleet(f.id, near[i].x.id, 'survey'));
    });
    await p.waitForTimeout(300);
    await p.evaluate(() => {
      const s = window.__stel.state();
      window.__stel.engine().focusGalaxyOn(s.civ.homeSystemId, 60, true);
    });
    await p.waitForTimeout(1200);
    await shot('fleets');
    await endTurn();
    if (!(await p.locator('.research-prompt').count())) fail('research prompt did not appear');
    await shot('research-prompt');
    for (let i = 0; i < 6; i++) {
      await endTurn();
      if (await p.locator('.toast').count()) break;
    }
    await p.evaluate(() => {
      const s = window.__stel.state();
      window.__stel.engine().focusGalaxyOn(s.civ.homeSystemId, 260, true);
    });
    await p.waitForTimeout(700);
    await shot('discovery');
    // an unsurveyed system: the star only
    const fog = await p.evaluate(() => {
      const s = window.__stel.state();
      const x = Object.values(s.systems).find((y) => s.civ.known[y.id] === 1);
      return x ? x.id : null;
    });
    if (fog) {
      await clearModals();
      await p.evaluate((id) => {
        window.__stel.engine().showSystem(id);
      }, fog);
      await p.waitForTimeout(1500);
      await shot('unsurveyed');
      await p.evaluate(() => window.__stel.engine().showGalaxy());
    }
    // settlements list -> the homeworld, focused and followed
    await clearModals();
    await p.keyboard.press('s');
    await p.waitForTimeout(300);
    await p.locator('.modal .list-item').first().click();
    await p.waitForTimeout(6000);
    await shot('homeworld-focus');
    if (p.errors.length) fail(`features: console errors:\n  ${p.errors.slice(0, 8).join('\n  ')}`);
    await p.close();
  }

  // ---------------------------------------------------------------- refresh-rate parity
  const p = await page(browser, 1280, 800);
  await p.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await p.waitForTimeout(800);
  const run = async (hz, seconds) =>
    p.evaluate(([rate, seconds]) => {
      const e = window.__stel.engine();
      e.stop();
      const s = window.__stel.state();
      // identical starting state for every run
      e.focusGalaxyOn(s.civ.homeSystemId, 150, true);
      e.rig.yaw = e.rig.goalYaw = 0.6;
      e.rig.pitch = e.rig.goalPitch = 0.85;
      e.rig.autoYaw = 0;
      const sys = Object.values(s.systems).find((x) => x.id !== s.civ.homeSystemId && s.civ.known[x.id]);
      e.focusGalaxyOn(sys.id, 90);
      e.rig.goalYaw += 0.8;
      const n = Math.round(seconds * rate);
      for (let i = 0; i < n; i++) e.frame(1 / rate);
      const r = e.rig;
      return { d: r.distance, yaw: r.yaw, pitch: r.pitch, x: r.target.x, y: r.target.y, z: r.target.z };
    }, [hz, seconds]);
  // mid-flight and settled, the two rates must agree
  for (const [seconds, tol] of [
    [0.5, 1e-6], // a whole number of frames at both 30 and 144 Hz
    [3.0, 1e-4],
  ]) {
    const a = await run(30, seconds);
    const b = await run(144, seconds);
    const diff = Math.max(...Object.keys(a).map((k) => Math.abs(a[k] - b[k]) / Math.max(1, Math.abs(a[k]))));
    console.log(`parity at ${seconds}s: 30 Hz ${JSON.stringify(a)}`);
    console.log(`parity at ${seconds}s: 144 Hz ${JSON.stringify(b)}`);
    console.log(`  max relative difference ${diff.toExponential(2)} (tolerance ${tol})`);
    if (!(diff < tol)) fail(`refresh-rate parity at ${seconds}s: difference ${diff}`);
  }
  // ---------------------------------------------------------------- zoom keeps the focus centred
  // a centred star stays in the middle when the wheel turns with the pointer off to one side
  const slid = await p.evaluate(() => {
    const e = window.__stel.engine();
    e.stop();
    const s = window.__stel.state();
    e.focusGalaxyOn(s.civ.homeSystemId, 150, true);
    const el = e.renderer.domElement;
    const r = el.getBoundingClientRect();
    const turn = (dy) => el.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, clientX: r.left + r.width * 0.2, clientY: r.top + r.height * 0.25, bubbles: true, cancelable: true }));
    for (let i = 0; i < 5; i++) {
      turn(120);
      e.frame(1 / 30);
    }
    for (let i = 0; i < 90; i++) e.frame(1 / 30);
    const v = e.galaxy.pickables.find((x) => x.kind === 'system' && x.id === s.civ.homeSystemId).pos.clone().project(e.camera);
    return Math.hypot((v.x * r.width) / 2, (v.y * r.height) / 2);
  });
  console.log(`zoom: the centred capital sits ${slid.toFixed(2)} px off the middle after five wheel turns`);
  if (!(slid < 1)) fail(`zoom: the centred capital slid ${slid.toFixed(1)} px off the middle`);
  if (p.errors.length) fail(`parity page errors: ${p.errors.join('; ')}`);
  await browser.close();
  console.log(failures ? `${failures} failure(s)` : 'ALL CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})();
