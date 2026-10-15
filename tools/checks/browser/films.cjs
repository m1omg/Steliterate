// Browser check: the films (the new version, part 4). Beginning a game plays the Long Dusk's film
// before the age's own words: full screen, its words real text over the canvas, a Skip button with
// the focus; skipped, the age's introduction follows. The Codex keeps the films seen, to play
// again; Escape skips one there, back to the Codex. Enter under a film ends no turn. Off in
// Settings, a new game goes straight to the introduction. A film draws the same picture at the
// same moment whatever came before it: two seconds stepped at 30 and at 144 frames a second end
// on the same frame, and a moment drawn twice is the same. The other checks run without films.
// On a tablet (15 Oct): the music falls silent and pauses under a film and carries on after it;
// the film's sound makes its voices as they come, not all at once; and its pictures, painted in a
// thread of their own, draw the same frames as pictures painted on the page.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('films', { films: true });
  const { page } = ck;
  // from the menu: New game, then Begin
  await page.locator('.menu .btn', { hasText: /^New game$/ }).click();
  await page.waitForTimeout(500);
  // (the film's sound: how many voices it makes, counted from here)
  await page.evaluate(() => {
    window.__voices = 0;
    const make = BaseAudioContext.prototype.createOscillator;
    BaseAudioContext.prototype.createOscillator = function () {
      window.__voices++;
      return make.call(this);
    };
  });
  const before = await page.evaluate(() => {
    const L = window.__stel.music().layer;
    return { recording: !!L?.track && !L.track.el.paused };
  });
  await page.locator('.btn', { hasText: /^Begin$/ }).first().click();
  // it begins once its first scene's pictures are painted (in their own thread): its corner label shows
  const begun = await page
    .waitForFunction(() => [...document.querySelectorAll('.film-screen .film-line.label')].some((x) => /STELITERATE · REEL/.test(x.textContent) && !x.hidden), null, { timeout: 20000, polling: 100 })
    .then(() => true, () => false);
  await page.waitForTimeout(400);
  const open = await page.evaluate(() => {
    const f = document.querySelector('.film-screen');
    return {
      film: !!f,
      label: f?.getAttribute('aria-label') ?? '',
      canvas: !!f?.querySelector('canvas.film-canvas'),
      lines: [...(f?.querySelectorAll('.film-line') ?? [])].filter((x) => !x.hidden).map((x) => x.textContent),
      focus: document.activeElement?.textContent?.trim() ?? '',
      turn: window.__stel.state()?.turn,
    };
  });
  await ck.shot('film-open.png');
  check(open.film && open.canvas && open.label === 'Film: The Long Dusk', `beginning a game plays the Long Dusk's film, full screen on its own canvas (${open.label})`);
  check(open.lines.some((x) => /STELITERATE · REEL I/.test(x)) && open.lines.some((x) => /^η \d/.test(x)), `its words are text over it: ${open.lines.join(' | ')}`);
  check(begun && open.focus === 'Skip', `it begins, and its Skip button has the focus (${open.focus})`);
  // a device that cannot keep up draws it with fewer pixels (here, drawn in software, frames come slowly)
  const pace = await page.evaluate(
    () =>
      new Promise((done) => {
        const c = document.querySelector('.film-screen canvas.film-canvas');
        const w0 = c.width;
        const t = [];
        const step = (now) => {
          t.push(now);
          if (now - t[0] < 2400) requestAnimationFrame(step);
          else {
            const gaps = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
            done({ w0, w1: c.width, cssW: c.clientWidth, gap: gaps[gaps.length >> 1] });
          }
        };
        requestAnimationFrame(step);
      }),
  );
  check(pace.gap > 50 ? pace.w1 < pace.w0 : pace.w1 === pace.w0, `frames ${Math.round(pace.gap)} ms apart: drawn at ${pace.w0} pixels across, then ${pace.w1} (on a page ${pace.cssW} wide)`);
  // the music is silent and paused under it (it had only stepped back, and played on under the films)
  const under = await page.evaluate(() => {
    const m = window.__stel.music();
    const L = m.layer;
    return { holding: m.holding, duck: window.__stel.audio()?.duck.gain.value ?? 0, playing: !!L?.track && !L.track.el.paused, voices: window.__voices };
  });
  check(under.holding && under.duck < 0.02 && !under.playing, `the music is silent and paused under the film (gain ${under.duck.toFixed(3)}, a recording ${under.playing ? 'still playing' : 'paused'})`);
  // its voices come as they are due: two seconds in, those of its first seconds only (all at once were 119)
  check(under.voices <= 40 && under.voices > 0, `its sound makes its voices as they come: ${under.voices} by its second second, of the 119 it makes`);
  // the narration comes in as it plays (the Long Dusk's first line at beat 2.5, 1.7 s in; the film's
  // first frame can take 2 to 3 s here while its paintings are made, so wait for it, up to 10 s)
  let later = [];
  for (let i = 0; i < 50 && !later.length; i++) {
    await page.waitForTimeout(200);
    later = await page.evaluate(() => [...document.querySelectorAll('.film-screen .film-line.narration')].filter((x) => !x.hidden && Number(x.style.opacity) > 0.05).map((x) => x.textContent));
  }
  check(later.length >= 1, `the narration comes in as it plays (${later.join(' | ')})`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({ film: !!document.querySelector('.film-screen'), intro: !!document.querySelector('.crossing[role="dialog"]'), turn: window.__stel.state()?.turn }));
  check(!after.film && after.intro && after.turn === open.turn, `Enter skips it, ending no turn (turn ${open.turn} → ${after.turn}), and the age's introduction follows`);
  await page.waitForTimeout(1800);
  const resumed = await page.evaluate(() => {
    const m = window.__stel.music();
    const L = m.layer;
    return { holding: m.holding, duck: window.__stel.audio()?.duck.gain.value ?? 0, playing: !!L?.track && !L.track.el.paused, synth: !!L && !L.silenced };
  });
  check(!resumed.holding && resumed.duck > 0.9 && (resumed.playing || resumed.synth || !before.recording), `after it the music comes back (gain ${resumed.duck.toFixed(2)}, ${resumed.playing ? 'its recording playing on' : resumed.synth ? 'the synth' : 'none'})`);
  await page.locator('.crossing .btn', { hasText: /^Begin$/ }).click();
  await page.waitForTimeout(400);
  // the Codex keeps it, to play again; Escape skips it, back to the Codex
  await page.evaluate(() => window.__stel.refresh());
  await page.keyboard.press('k');
  await page.waitForTimeout(500);
  await page.locator('.codex-nav .btn', { hasText: /^Films seen$/ }).click();
  await page.waitForTimeout(300);
  const listed = await page.locator('.codex-body .btn').allTextContents();
  check(listed.some((x) => /The Long Dusk/.test(x)), `the Codex lists the films seen (${listed.join(', ')})`);
  await page.locator('.codex-body .btn', { hasText: /The Long Dusk/ }).click();
  await page.waitForTimeout(800);
  const replay = await page.evaluate(() => !!document.querySelector('.film-screen'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  const back = await page.evaluate(() => ({ film: !!document.querySelector('.film-screen'), codex: !!document.querySelector('.codex-nav') }));
  check(replay && !back.film && back.codex, 'it plays again from there, and Escape skips it back to the Codex');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // the same moment draws the same picture, whatever was drawn before it
  const frames = await page.evaluate(() => {
    const steps = (fps) => Array.from({ length: 2 * fps + 1 }, (_, i) => 3 + i / fps);
    const a = window.__stel.filmFrames('dusk', steps(30));
    const b = window.__stel.filmFrames('dusk', steps(144));
    const again = window.__stel.filmFrames('dusk', [5, 1, 5]);
    return { a: a[a.length - 1], b: b[b.length - 1], again };
  });
  check(frames.a === frames.b && frames.again[0] === frames.again[2] && frames.again[0] !== frames.again[1], `two seconds at 30 and at 144 frames a second end on the same frame (${frames.a} / ${frames.b}), and a moment drawn twice is the same`);
  // every film draws, at its start, middle and end, without an error
  const all = await page.evaluate(() => Object.keys(window.__stel.filmList()).map((id) => [id, window.__stel.filmFrames(id, [0.2, 4, 9.6], 320, 180).length]));
  check(all.length >= 16 && all.every(([, n]) => n === 3), `all ${all.length} films draw from start to end`);
  // pictures painted in the painter thread draw the same frames as pictures painted on the page
  const apart = [];
  for (const [id] of all) {
    apart.push(
      await page.evaluate(async (id) => {
        const times = [0.3, 4, 9.5, 15, 21, 27, 33, 39, 45];
        const here = window.__stel.filmFrames(id, times, 320, 180, 'medium');
        const there = await window.__stel.filmFramesApart(id, times, 320, 180, 'medium');
        return { id, same: here.every((x, i) => x === there.frames[i]), sent: there.sent };
      }, id),
    );
  }
  const differ = apart.filter((x) => !x.same || x.sent < 1);
  check(!differ.length, `pictures painted in their own thread draw the same frames as on the page, in all ${apart.length} films (${apart.reduce((n, x) => n + x.sent, 0)} pictures sent${differ.length ? `; not in ${differ.map((x) => x.id).join(', ')}` : ''})`);
  // off in Settings: a new game goes straight to the introduction
  await page.reload();
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__stel.films(false));
  await page.locator('.menu .btn', { hasText: /^New game$/ }).click();
  await page.waitForTimeout(500);
  await page.locator('.btn', { hasText: /^Begin$/ }).first().click();
  await page.waitForTimeout(900);
  const off = await page.evaluate(() => ({ film: !!document.querySelector('.film-screen'), intro: !!document.querySelector('.crossing[role="dialog"]') }));
  check(!off.film && off.intro, 'with films off a new game goes straight to the introduction');
  await finish('FILMS', ck);
});
