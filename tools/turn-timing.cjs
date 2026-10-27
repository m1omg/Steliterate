// End Turn as a phone feels it (the new version, part 2a-6). Chromium with its CPU slowed down
// (the DevTools protocol's Emulation.setCPUThrottlingRate), a game whose choices the autoplayer
// makes, and its turns ended by the End Turn button itself, as a player ends them. For each turn:
// the time from the click until the turn is done and the next frame drawn, and the longest task the
// browser reports meanwhile (PerformanceObserver 'longtask': only tasks over 50 ms are reported, so a turn with none
// counts as under 50).
//
// Usage: node tools/turn-timing.cjs http://localhost:4173/ [turns=40] [slowdown=4] [seed=8919]
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const [url = 'http://localhost:4173/', turnsArg = '40', slowArg = '4', seedArg = '8919'] = process.argv.slice(2);
const TURNS = Number(turnsArg);
const SLOW = Number(slowArg);
const SEED = Number(seedArg);

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(url);
  await page.waitForFunction(() => !!window.__stel);
  await page.evaluate((seed) => window.__stel.newGame({ seed }), SEED);
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.__long = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__long.push({ at: e.startTime, ms: e.duration });
    }).observe({ type: 'longtask', buffered: false });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: SLOW });
  const rows = [];
  for (let i = 0; i < TURNS; i++) {
    // our choices for the turn, by the autoplayer; whatever it opened, closed
    await page.evaluate(() => window.__stel.autoPlay());
    for (let k = 0; k < 3; k++) await page.keyboard.press('Escape');
    if (await page.evaluate(() => !!window.__stel.state().civ.outcome)) break;
    // the click in the page itself (a click from outside waits for the page to sit still over two
    // frames first, and here, drawing in software, a frame takes long); timed in the page, until the
    // turn is done and the first frame after it has been drawn
    const res = await page
      .evaluate(
        () =>
          new Promise((resolve) => {
            const turn = window.__stel.state().turn;
            const t = performance.now();
            const btn = document.querySelector('button.endturn');
            if (!btn || btn.disabled) return resolve(null);
            btn.click();
            const poll = () => {
              if (window.__stel.state().turn > turn && !document.querySelector('button.endturn')?.disabled) requestAnimationFrame(() => resolve({ turn, t, done: performance.now() }));
              else setTimeout(poll, 0);
            };
            poll();
          }),
      )
      .catch(() => null);
    if (!res) break;
    const before = { turn: res.turn, t: res.t };
    const done = res.done;
    const long = await page.evaluate(([a, b]) => window.__long.filter((x) => x.at >= a - 1 && x.at <= b).map((x) => x.ms), [before.t, done]);
    const own = await page.evaluate(() => window.__stel.lastTurn?.() ?? null);
    rows.push({ turn: before.turn, ms: done - before.t, longest: long.length ? Math.max(...long) : 0, longTasks: long.length, own });
  }
  const era = await page.evaluate(() => `${window.__stel.state().era}, turn ${window.__stel.state().turn}`);
  await browser.close();
  const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
  const longest = rows.map((r) => r.longest).sort((a, b) => a - b);
  const q = (v, p) => v[Math.min(v.length - 1, Math.floor(v.length * p))] ?? 0;
  console.log(`seed ${SEED}, CPU slowed ${SLOW}x, ${rows.length} turns (to ${era})`);
  console.log(`  click to done: median ${q(ms, 0.5).toFixed(0)} ms, 95th ${q(ms, 0.95).toFixed(0)} ms, worst ${q(ms, 1).toFixed(0)} ms`);
  console.log(`  longest task in a turn: median ${q(longest, 0.5).toFixed(0)} ms, 95th ${q(longest, 0.95).toFixed(0)} ms, worst ${q(longest, 1).toFixed(0)} ms (0: none over 50 ms)`);
  console.log(`  turns with a task over 50 ms: ${rows.filter((r) => r.longTasks > 0).length} of ${rows.length}; over 100 ms: ${rows.filter((r) => r.longest > 100).length}`);
  // the turn's own work, as End Turn played it (absent from a build before part 2a-6)
  const own = rows.filter((r) => r.own);
  if (own.length) {
    const w = own.map((r) => r.own.work).sort((a, b) => a - b);
    const l = own.map((r) => r.own.longest).sort((a, b) => a - b);
    console.log(`  the turn itself: work median ${q(w, 0.5).toFixed(0)} ms, worst ${q(w, 1).toFixed(0)} ms; longest run without a breath median ${q(l, 0.5).toFixed(0)} ms, 95th ${q(l, 0.95).toFixed(0)} ms, worst ${q(l, 1).toFixed(0)} ms`);
  }
})();
