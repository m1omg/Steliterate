// Browser check: the music plays on while the tab is hidden and is still the same recording, at a
// later point, when the tab is shown again (it used to be suspended, and Firefox then started the
// track over with the synth in between). While a recording plays the synth stays silent; when no
// recording will play, the synth does.
const { check, start, finish, run } = require('../lib.cjs');

/** Fake the tab's visibility, and note the media elements the game plays. */
function hooks() {
  window.__media = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) {
    if (!window.__media.includes(this)) window.__media.push(this);
    return play.apply(this, a);
  };
  let hidden = false;
  Object.defineProperty(document, 'hidden', { get: () => hidden, configurable: true });
  Object.defineProperty(document, 'visibilityState', { get: () => (hidden ? 'hidden' : 'visible'), configurable: true });
  window.__setHidden = (h) => {
    hidden = h;
    document.dispatchEvent(new Event('visibilitychange'));
  };
}

const look = (page) =>
  page.evaluate(() => {
    const m = window.__stel.music();
    const L = m.layer;
    const el = L?.track?.el ?? null;
    return {
      ctx: m && L ? L.bus.context.state : null,
      silenced: L ? L.silenced : null,
      synth: L ? L.bus.gain.value : null,
      src: el ? el.src.split('/').pop() : null,
      t: el ? el.currentTime : null,
      paused: el ? el.paused : null,
      media: (window.__media ?? []).length,
    };
  });

run(async () => {
  const ck = await start('music-hidden');
  const { page } = ck;
  await page.context().addInitScript(hooks);
  await page.reload();
  await page.waitForTimeout(1500);
  // sound starts with the first gesture: the title's recording
  await page.mouse.click(1300, 120);
  let a = await look(page);
  for (let i = 0; i < 40 && !(a.t > 1.5); i++) {
    await page.waitForTimeout(250);
    a = await look(page);
  }
  check(a.src === 'title.mp3' && a.paused === false && a.t > 1.5, `the title's recording plays (${a.src} at ${a.t?.toFixed(1)} s)`);
  check(a.silenced === true && a.synth === 0, `and the synth stays silent under it (gain ${a.synth})`);
  // the tab is hidden for a while
  await page.evaluate(() => window.__setHidden(true));
  await page.waitForTimeout(3000);
  const b = await look(page);
  check(b.ctx === 'running' && b.paused === false && b.t > a.t + 2, `hidden, it plays on (${a.t.toFixed(1)} → ${b.t.toFixed(1)} s, audio ${b.ctx})`);
  await page.evaluate(() => window.__setHidden(false));
  await page.waitForTimeout(1500);
  const c = await look(page);
  check(c.src === a.src && c.t > b.t && c.media === a.media, `shown again, the same recording carries on (${c.src} at ${c.t.toFixed(1)} s), not over from the start`);
  check(c.silenced === true && c.synth === 0, 'and no synth in between');
  // no recording to play (the files will not load): the synth plays instead
  const p2 = await ck.another(1400, 900);
  await p2.route(/\/music\/.*\.mp3$/, (r) => r.abort());
  await p2.mouse.click(1300, 120);
  let d = await look(p2);
  for (let i = 0; i < 40 && d.silenced !== false; i++) {
    await p2.waitForTimeout(250);
    d = await look(p2);
  }
  await p2.waitForTimeout(3500);
  d = await look(p2);
  check(d.silenced === false && d.synth > 0.5, `with no recording to play, the synth plays (gain ${d.synth?.toFixed(2)})`);
  // the aborted recordings are this check's doing, not the game's
  ck.errors.splice(0, ck.errors.length, ...ck.errors.filter((e) => !/mp3|ERR_FAILED|Failed to load|NotSupportedError|no supported source/i.test(e)));
  await finish('MUSIC HIDDEN', ck);
});
