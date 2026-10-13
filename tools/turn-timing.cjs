// End Turn as a phone feels it (the new version, part 2a-6). Chromium with its CPU slowed down
// (the DevTools protocol's Emulation.setCPUThrottlingRate), a game whose choices the autoplayer
// makes, and its turns ended by the End Turn button itself, as a player ends them. For each turn:
// the time from the click until the turn is done, and the longest task the browser reports while it
// runs (PerformanceObserver 'longtask': only tasks over 50 ms are reported, so a turn with none
// counts as under 50).
//
// Usage: node tools/turn-timing.cjs http://localhost:4173/ [turns=40] [slowdown=4] [seed=8919]
const { chromium } = require('playwright');

const [url = 'http://localhost:4173/', turnsArg = '40', slowArg = '4', seedArg = '8919'] = process.argv.slice(2);
const TURNS = Number(turnsArg);
const SLOW = Number(slowArg);
const SEED = Number(seedArg);

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
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
    const before = await page.evaluate(() => ({ turn: window.__stel.state().turn, t: performance.now(), outcome: !!window.__stel.state().civ.outcome }));
    if (before.outcome) break;
    await page.click('button.endturn', { timeout: 20000 }).catch(() => {});
    const done = await page
      .waitForFunction((t) => window.__stel.state().turn > t && !document.querySelector('button.endturn')?.hasAttribute('disabled'), before.turn, { timeout: 60000, polling: 5 })
      .then(() => page.evaluate(() => performance.now()))
      .catch(() => null);
    if (done === null) break;
    const long = await page.evaluate(([a, b]) => window.__long.filter((x) => x.at >= a - 1 && x.at <= b).map((x) => x.ms), [before.t, done]);
    rows.push({ turn: before.turn, ms: done - before.t, longest: long.length ? Math.max(...long) : 0, longTasks: long.length });
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
})();
