// Browser check: how the recorded music reaches the speakers (15 Oct). The player heard it stutter,
// "irregular pops", worst in Firefox: it went through the sound's graph (a MediaElementSource),
// whose samples cross into the graph on its audio thread, and gave out when the browser was busy.
// Now the audio element plays it itself, by its own volume: the piece's level times the music's
// volume (the slider), fading in and out on a timer. The interface's sounds share one reverb, and
// no sound the game makes here makes a MediaElementSource.
const { check, start, finish, run } = require('../lib.cjs');

function hooks() {
  window.__sources = 0;
  const make = AudioContext.prototype.createMediaElementSource;
  AudioContext.prototype.createMediaElementSource = function (...a) {
    window.__sources++;
    return make.apply(this, a);
  };
  window.__gains = 0;
  const gain = AudioContext.prototype.createGain;
  AudioContext.prototype.createGain = function (...a) {
    window.__gains++;
    return gain.apply(this, a);
  };
}

const look = (page) =>
  page.evaluate(() => {
    const L = window.__stel.music().layer;
    const tr = L?.track;
    return {
      src: tr ? tr.el.src.split('/').pop() : null,
      route: tr?.out.route ?? null,
      level: tr?.out.level ?? 0,
      vol: tr ? tr.el.volume : 0,
      t: tr ? tr.el.currentTime : 0,
      paused: tr ? tr.el.paused : null,
      sources: window.__sources,
    };
  });

run(async () => {
  const ck = await start('music-route');
  const { page } = ck;
  await page.context().addInitScript(hooks);
  await page.reload();
  await page.waitForTimeout(1500);
  // sound starts with the first gesture; then a game, and its age's recording, fading in
  await page.mouse.click(1300, 120);
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__stel.newGame({ seed: 31 }));
  await page.waitForTimeout(1500);
  let a = await look(page);
  for (let i = 0; i < 60 && !(a.t > 3.2 && a.level > 0.3); i++) {
    await page.waitForTimeout(250);
    a = await look(page);
  }
  check(a.src && a.route === 'element' && a.paused === false, `the recording plays by its element (${a.src}, ${a.route})`);
  check(a.sources === 0, `no sound goes through a MediaElementSource (${a.sources} made)`);
  // its volume is its level times the music's volume, as the master's gain had it
  await page.evaluate(() => window.__stel.setVolumes(0.7, 0.7));
  const b = await look(page);
  const want = (lv, m) => lv * m * m * 0.9;
  check(Math.abs(b.vol - want(b.level, 0.7)) < 0.03 && b.vol > 0.05, `at the music's volume 70% it plays at ${b.vol.toFixed(3)} (its level ${b.level.toFixed(2)})`);
  await page.evaluate(() => window.__stel.setVolumes(0.35, 0.7));
  const c = await look(page);
  check(Math.abs(c.vol - want(c.level, 0.35)) < 0.03 && c.vol < b.vol * 0.4, `the slider at 35%: ${c.vol.toFixed(3)}, a quarter as loud`);
  await page.evaluate(() => window.__stel.setVolumes(0, 0.7));
  const d = await look(page);
  check(d.vol === 0, `at 0 it is silent (${d.vol})`);
  await page.evaluate(() => window.__stel.setVolumes(0.7, 0.7));
  // the interface's sounds share one way into the reverb: a sound with an echo makes its own tones'
  // gains and no more (two more for each, before)
  const made = await page.evaluate(async () => {
    window.__stel.sfx('select');
    const g0 = window.__gains;
    for (let i = 0; i < 10; i++) window.__stel.sfx('select');
    return window.__gains - g0;
  });
  check(made === 20, `ten sounds with an echo make 20 gains, their tones' own (${made})`);
  await finish('MUSIC ROUTE', ck);
});
