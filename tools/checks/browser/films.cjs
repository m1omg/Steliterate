// Browser check: the films (the new version, part 4). Beginning a game plays the Long Dusk's film
// before the age's own words: full screen, its words real text over the canvas, a Skip button with
// the focus; skipped, the age's introduction follows. The Codex keeps the films seen, to play
// again; Escape skips one there, back to the Codex. Enter under a film ends no turn. Off in
// Settings, a new game goes straight to the introduction. A film draws the same picture at the
// same moment whatever came before it: two seconds stepped at 30 and at 144 frames a second end
// on the same frame, and a moment drawn twice is the same. The other checks run without films.
// On a tablet (15 Oct): the music falls silent and pauses under a film and carries on after it;
// the film's sound makes its voices as they come, not all at once; and its pictures, painted in a
// thread of their own, draw the same frames as pictures painted on the page. Its time moves with
// the page's, frame by frame (not in the audio clock's steps), and its vignette and grain are
// layers of the page, or in the canvas where that draws quicker. The project check (15 Oct): the
// grain in the canvas holds still when asked, as the page's does, and a film the painter thread
// cannot lay out it says so, for the page to paint.
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
            done({ w0, w1: c.width, cssW: c.clientWidth, dpr: devicePixelRatio, gap: gaps[gaps.length >> 1] });
          }
        };
        requestAnimationFrame(step);
      }),
  );
  // (since 15 Oct it comes down within a second or two, often before this looks)
  check(pace.gap > 50 ? pace.w1 < pace.cssW * pace.dpr : pace.w1 === pace.w0, `frames ${Math.round(pace.gap)} ms apart: drawn at ${pace.w0} pixels across, then ${pace.w1} (on a page ${pace.cssW} wide)`);
  // its time moves with the page's, frame by frame (15 Oct: read straight from the audio clock, which
  // moves in steps of its buffer, a frame in four repeated the one before and the next jumped)
  const steps = await page.evaluate(() => {
    const f = window.__stel.filmTimes().slice(-40);
    const d = f.slice(1).map(([t, n], i) => [t - f[i][0], (n - f[i][1]) / 1000]);
    const off = d.map(([a, b]) => Math.abs(a - b)).sort((x, y) => x - y);
    return { frames: f.length, repeats: d.filter(([a]) => a === 0).length, mid: off[off.length >> 1] ?? 1 };
  });
  check(steps.frames >= 10 && steps.repeats === 0 && steps.mid < 0.004, `its time moves with the page's, frame by frame (${steps.repeats} repeated of ${steps.frames}; off by ${(steps.mid * 1000).toFixed(1)} ms at the median)`);
  // the vignette and the grain are layers of the page over the frame, under its words; with frames
  // slow (over 45 ms apart: a compositor without the graphics chip), it tried them in the canvas and
  // kept the quicker way; at full speed it tries nothing and keeps them on the page (27 Oct: frames
  // came 17 ms apart in this container, and the check had taken slow frames for granted)
  const lay = await page.evaluate(() => {
    const kids = [...document.querySelector('.film-screen').children];
    return { order: kids.map((x) => x.className.split(' ')[0]).join(' '), shown: !document.querySelector('.film-grain').hidden, trial: window.__stel.filmOverlays() };
  });
  check(/film-canvas film-vignette film-grain film-text/.test(lay.order), `the vignette and the grain lie over the frame, under its words (${lay.order})`);
  const tr = lay.trial;
  if (pace.gap > 45) check(!!tr && tr.kept === (tr.canvas < tr.page * 0.9 ? 'canvas' : 'page') && lay.shown === (tr.kept === 'page'), `slow, it tried them in the canvas and kept the quicker way (${tr ? `${Math.round(tr.page)} ms a frame as layers, ${Math.round(tr.canvas)} in the canvas: ${tr.kept}` : 'no trial'})`);
  else check(!tr && lay.shown, `at full speed (${Math.round(pace.gap)} ms a frame) it keeps them on the page, untried (${tr ? 'tried' : 'no trial'})`);
  // the music is silent and paused under it (it had only stepped back, and played on under the films)
  const under = await page.evaluate(() => {
    const m = window.__stel.music();
    const L = m.layer;
    return { holding: m.holding, duck: window.__stel.audio()?.duck.gain.value ?? 0, vol: L?.track?.el.volume ?? 0, playing: !!L?.track && !L.track.el.paused, voices: window.__voices, t: window.__stel.filmTimes().at(-1)?.[0] ?? 0 };
  });
  check(under.holding && under.duck < 0.02 && under.vol < 0.01 && !under.playing, `the music is silent and paused under the film (gain ${under.duck.toFixed(3)}, volume ${under.vol.toFixed(3)}, a recording ${under.playing ? 'still playing' : 'paused'})`);
  // its voices come as they are due, not all at once (all at once were 119): fewer than all of them
  // so far, and more a few seconds on (27 Oct: read by the film's own clock, which can be well past
  // its second second by now on a page that starts it before this sees it begin)
  // the narration comes in as it plays (the Long Dusk's first line at beat 2.5, 1.7 s in; the film's
  // first frame can take 2 to 3 s here while its paintings are made, so wait for it, up to 10 s)
  let later = [];
  for (let i = 0; i < 50 && !later.length; i++) {
    await page.waitForTimeout(200);
    later = await page.evaluate(() => [...document.querySelectorAll('.film-screen .film-line.narration')].filter((x) => !x.hidden && Number(x.style.opacity) > 0.05).map((x) => x.textContent));
  }
  check(later.length >= 1, `the narration comes in as it plays (${later.join(' | ')})`);
  await page.waitForFunction((t) => (window.__stel.filmTimes().at(-1)?.[0] ?? 0) > t + 3, under.t, { timeout: 20000, polling: 100 }).catch(() => {});
  const on = await page.evaluate(() => ({ voices: window.__voices, t: window.__stel.filmTimes().at(-1)?.[0] ?? 0 }));
  check(under.voices > 0 && under.voices < 119 && on.voices > under.voices, `its sound makes its voices as they come: ${under.voices} by ${under.t.toFixed(1)} s, ${on.voices} by ${on.t.toFixed(1)} s, of the 119 it makes`);
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
  // the grain drawn into the frame (a slow device's way) holds still where the system asks for less
  // motion, as the page's layer does (the project check, 15 Oct): over one step of the grain a frame
  // changes far less with it held
  const grainMoves = await page.evaluate(() =>
    [3, 30].map((t) => {
      const d = 1 / 24 + 0.002;
      return [window.__stel.filmChange('dusk', t, t + d, {}), window.__stel.filmChange('dusk', t, t + d, { stillGrain: true })];
    }),
  );
  check(
    grainMoves.every(([m, s]) => s < m * 0.5),
    `the grain in the frame holds still when asked (a frame changes ${grainMoves.map(([m, s]) => `${s.toFixed(2)} held, ${m.toFixed(2)} moving`).join('; ')})`,
  );
  // a film the painter thread cannot lay out is answered as such, and the page paints it itself
  // (an error in its handler, which is async, used to reach the page as no error at all)
  const painter = await page.evaluate(() =>
    Promise.all([
      window.__stel.askPainter({ job: 7, id: 'none', w: 64, h: 36, q: 'low', args: {} }),
      window.__stel.askPainter({ job: 8, id: 'dusk', w: 64, h: 36, q: 'low', args: {} }),
    ]),
  );
  check(painter[0]?.failed === true && painter[1]?.i === 0, `a film the painter cannot lay out it answers "failed" (${JSON.stringify(painter[0])}), and paints one it can`);
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
