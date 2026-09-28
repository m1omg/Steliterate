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
    for (const i of [0, 1, 2, 3, 4, 5, 6, 7]) {
      await p.locator('.rail button').nth(i).click();
      await p.waitForTimeout(250);
      if (!(await p.locator('.modal').count())) fail(`${tag}: rail button ${i} opened nothing`);
      await p.keyboard.press('Escape');
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
  if (p.errors.length) fail(`parity page errors: ${p.errors.join('; ')}`);
  await browser.close();
  console.log(failures ? `${failures} failure(s)` : 'ALL CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})();
