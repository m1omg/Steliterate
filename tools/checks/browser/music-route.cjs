// Browser check: how the recorded music reaches the speakers (15 Oct). The player heard it stutter,
// "irregular pops", in the films and out of them, worst in Firefox: it went through the sound's
// graph (a MediaElementSource), whose samples cross into the graph on its audio thread, and gave out
// when the browser was busy. Now the audio element plays it itself, by its own volume: the piece's
// level times the music's volume (the slider), fading in and out on a timer; under a film it falls
// silent and pauses, and comes back after. The interface's sounds share one reverb, and no sound
// the game makes here makes a MediaElementSource. The project check (15 Oct): the synth's echo
// follows the slider and falls silent under a film, and a hold taken again soon after one let go is
// not cut short.
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
  // the synth's echo goes into the reverb at the music's volume too, as loud as before at 70% (it
  // went in at full whatever the slider, the project check found, 15 Oct)
  const wetAt = async (m) => {
    await page.evaluate((m) => window.__stel.setVolumes(m, 0.7), m);
    await page.waitForTimeout(700);
    return page.evaluate(() => window.__stel.audio().musicWet.gain.value);
  };
  const w0 = await wetAt(0);
  const w35 = await wetAt(0.35);
  const w70 = await wetAt(0.7);
  check(w0 < 0.01 && Math.abs(w35 - 0.25) < 0.02 && Math.abs(w70 - 1) < 0.02, `the synth's echo follows the slider: ${w0.toFixed(3)} at 0, ${w35.toFixed(2)} at 35%, ${w70.toFixed(2)} at 70% (as before)`);
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
  // under a film it falls silent and pauses; after it, it fades back in
  await page.evaluate(() => {
    window.__stel.films(true);
    window.__stel.playFilm('dusk');
  });
  await page.waitForTimeout(2500);
  const e = await look(page);
  check(e.vol < 0.01 && e.paused === true, `under a film it is silent and paused (volume ${e.vol.toFixed(3)})`);
  const wetUnder = await page.evaluate(() => window.__stel.audio().wetDuck.gain.value);
  check(wetUnder < 0.01, `and the synth's echo with it (${wetUnder.toFixed(3)})`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2500);
  const f = await look(page);
  check(f.paused === false && f.vol > 0.02, `after it, it plays again (volume ${f.vol.toFixed(3)}, rising)`);
  // a hold let go and taken again soon after (a film skipped at once, then another) is not cut
  // short by the first hold's pause, which came 0.7 s after it and paused the recording part-way
  // through the second's fade (the project check, 15 Oct)
  const again = await page.evaluate(async () => {
    const m = window.__stel.music();
    const el = () => m.layer?.track?.el;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    // (the three within half a second, no timer between them however busy the page: the first
    // hold's pause, due at 0.7 s, then comes after the second hold, as it would in play)
    const spin = (ms) => {
      const end = performance.now() + ms;
      while (performance.now() < end);
    };
    m.hold(true);
    spin(300);
    m.hold(false);
    spin(200);
    m.hold(true);
    await wait(350);
    const mid = el()?.paused;
    await wait(900);
    const end = el()?.paused;
    m.hold(false);
    return { mid, end };
  });
  check(again.mid === false && again.end === true, `held, let go and held again: still playing 0.35 s into the second hold (${again.mid ? 'paused' : 'playing'}), paused once it has faded (${again.end ? 'paused' : 'playing'})`);
  await finish('MUSIC ROUTE', ck);
});
