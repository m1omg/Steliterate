// Browser check: the game does no work nobody sees or hears, and phones and tablets go lighter as
// the player chose (12 Oct: everything felt slower on a phone, "even the audio stuttered and had
// crackles"; then "No panel blur on touch" and "Touch devices start at Medium").
// - Under a recording, the synth's continuous sounds (drone, tape wobble, hiss) are not running;
//   when no recording will play, the synth sounds with them.
// - The canvas is not multisampled: every frame is drawn in the post chain (post.ts), and only its
//   last full-screen pass reaches the canvas.
// - Idle on the galaxy map, the labels are left as they stand, exactly as a fresh layout would place
//   them.
// - On a touchscreen the panels have no backdrop blur (with a mouse they keep it), and the graphics
//   start at medium unless they were picked by hand.
const { check, start, finish, run } = require('../lib.cjs');

const voice = (page) =>
  page.evaluate(() => {
    const L = window.__stel.music().layer;
    const el = L?.track?.el ?? null;
    return { running: L ? L.persistent.length : null, silenced: L ? L.silenced : null, synth: L ? L.bus.gain.value : null, t: el ? el.currentTime : null, paused: el ? el.paused : null };
  });

const quality = async (pg, saved) => {
  await pg.evaluate((s) => localStorage.setItem('steliterate.settings', JSON.stringify(s)), saved);
  await pg.reload();
  await pg.waitForFunction(() => !!window.__stel?.engine(), null, { timeout: 60000 });
  const q = await pg.evaluate(() => window.__stel.engine().quality);
  await pg.evaluate(() => localStorage.removeItem('steliterate.settings'));
  return q;
};

run(async () => {
  const ck = await start('lean');
  const { page } = ck;
  // with a mouse, graphics saved at high stay high
  const q0 = await quality(page, { quality: 'high' });
  check(q0 === 'high', `with a mouse, graphics saved at high stay high (${q0})`);
  await page.waitForTimeout(1000);
  // sound starts with the first gesture: the title's recording, with nothing of the synth running
  await page.mouse.click(1300, 120);
  let a = await voice(page);
  for (let i = 0; i < 40 && !(a.t > 1.5); i++) {
    await page.waitForTimeout(250);
    a = await voice(page);
  }
  check(a.paused === false && a.t > 1.5, `the title's recording plays (at ${a.t?.toFixed(1)} s)`);
  check(a.silenced === true && a.running === 0, `and none of the synth's continuous sounds runs under it (${a.running} running, synth gain ${a.synth})`);
  // no recording to play (the files will not load): the synth plays, its drone with it
  const p2 = await ck.another(1400, 900);
  await p2.route(/\/music\/.*\.mp3$/, (r) => r.abort());
  await p2.mouse.click(1300, 120);
  let b = await voice(p2);
  for (let i = 0; i < 40 && b.silenced !== false; i++) {
    await p2.waitForTimeout(250);
    b = await voice(p2);
  }
  await p2.waitForTimeout(3500);
  b = await voice(p2);
  check(b.silenced === false && b.synth > 0.5 && b.running > 0, `with no recording, the synth plays with its continuous sounds (${b.running} running, gain ${b.synth?.toFixed(2)})`);
  await p2.close();
  ck.errors.splice(0, ck.errors.length, ...ck.errors.filter((e) => !/mp3|ERR_FAILED|Failed to load|NotSupportedError|no supported source/i.test(e)));

  // the canvas
  const aa = await page.evaluate(() => window.__stel.engine().renderer.getContext().getContextAttributes().antialias);
  check(aa === false, `the canvas is not multisampled (antialias ${aa})`);

  // the galaxy map's labels, idle
  await page.evaluate(() => {
    window.__stel.newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
    window.__stel.endTurns(40, true);
  });
  await page.waitForTimeout(3000);
  const lab = await page.evaluate(() => {
    const eng = window.__stel.engine();
    eng.stop();
    // (no drawing meanwhile: only the labels are watched, and the software GPU here is slow)
    const draw = eng.post.composer.render;
    eng.post.composer.render = () => {};
    const orig = eng.labelsStand.bind(eng);
    const stood = [];
    eng.labelsStand = () => {
      const h = orig();
      stood.push(h);
      return h;
    };
    // the camera settles (its easing reaches its last digits in some fifteen seconds), then nothing moves
    for (let i = 0; i < 1800; i++) eng.frame(1 / 60);
    const last = stood.slice(-60).filter(Boolean).length;
    const snap = () => [...document.querySelectorAll('.map-label')].map((e) => `${e.style.display}|${e.textContent}|${e.style.transform}|${e.className}`).join('\n');
    const kept = snap();
    eng.labelsDirty = true;
    eng.frame(1 / 60);
    const fresh = snap();
    eng.labelsStand = orig;
    eng.post.composer.render = draw;
    eng.start();
    return { last, same: kept === fresh, shown: [...document.querySelectorAll('.map-label')].filter((e) => e.style.display !== 'none').length };
  });
  check(lab.last === 60, `idle, the labels stand frame after frame (${lab.last} of the last 60)`);
  check(lab.same && lab.shown > 0, `exactly as a fresh layout places them (${lab.shown} shown)`);
  // a turn, then a move of the camera, lays them out again
  const moved = await page.evaluate(() => {
    const eng = window.__stel.engine();
    const before = [...document.querySelectorAll('.map-label')].map((e) => e.style.transform).join();
    eng.focusGalaxyOn(window.__stel.state().civ.homeSystemId, 400, true);
    eng.frame(1 / 60);
    return before !== [...document.querySelectorAll('.map-label')].map((e) => e.style.transform).join();
  });
  check(moved, 'and when the camera moves, they move with it');

  // with a mouse the panels keep their blur; on a touchscreen they have none
  const blur = (pg) => pg.evaluate(() => { const p = document.querySelector('.panel'); return p ? getComputedStyle(p).backdropFilter : null; });
  const mouseBlur = await blur(page);
  check(mouseBlur === 'blur(3px)', `with a mouse the panels blur what is behind them (${mouseBlur})`);
  // (a page of its own: a second page's load can hang in a shared browser, lib.cjs)
  const phone = await ck.freshPhone(390, 844);
  // graphics: medium on a touchscreen unless picked by hand
  const q1 = await quality(phone, { quality: 'high' });
  check(q1 === 'medium', `a touchscreen with settings saved before starts at medium (${q1})`);
  const q2 = await quality(phone, { quality: 'high', qualityChosen: true });
  check(q2 === 'high', `unless high was picked by hand (${q2})`);
  await phone.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await phone.waitForTimeout(1500);
  const touchBlur = await blur(phone);
  check(touchBlur === 'none', `on a touchscreen the panels do not blur (${touchBlur})`);
  await phone.context().browser().close();
  await finish('LEAN', ck);
});
