// Browser check: the sky (15 Oct). The player saw "this weird purplish blob around most of the
// playfield": the grade lifted the blacks with a little less green than red and blue, and the
// tone mapping, which takes a dark colour's grey part away, left a dark magenta, made an oval by
// the vignette. Now the empty sky is black, the same in every channel, in the galaxy and in a
// system. In its place, the galaxy's own light: a warm glow where its stars are, drawn back from,
// that fades as the view comes in among them and is gone once the stars have gone out.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('sky', { seed: 31 });
  const { page } = ck;
  // the sky's colour, read from the frame as drawn: the darkest pixel of a patch (the sky between the stars)
  const sky = (fx, fy) =>
    page.evaluate(
      ([fx, fy]) =>
        new Promise((done) =>
          requestAnimationFrame(() => {
            const e = window.__stel.engine();
            e.frame?.(0);
            const gl = e.renderer.getContext();
            const W = gl.drawingBufferWidth;
            const H = gl.drawingBufferHeight;
            const px = new Uint8Array(4 * 100);
            gl.readPixels(Math.round(W * fx) - 5, Math.round(H * fy) - 5, 10, 10, gl.RGBA, gl.UNSIGNED_BYTE, px);
            let best = null;
            for (let i = 0; i < px.length; i += 4) if (!best || px[i] + px[i + 1] + px[i + 2] < best[0] + best[1] + best[2]) best = [px[i], px[i + 1], px[i + 2]];
            done(best);
          }),
        ),
      [fx, fy],
    );
  const glows = () => page.evaluate(() => (window.__stel.engine().galaxy.glows ?? []).filter((x) => x.sprite.visible).length);
  // drawn back over the whole galaxy, from above
  await page.evaluate(() => {
    const e = window.__stel.engine();
    e.rig.goalPitch = 1.3;
    e.rig.jump(new (e.rig.target.constructor)(0, 0, 0), 2600);
  });
  await page.waitForTimeout(2500);
  await ck.shot('sky-far.png');
  const corner = await sky(0.03, 0.06);
  const middle = await sky(0.5, 0.5);
  const lit = await glows();
  check(Math.max(...corner) <= 2 && Math.abs(corner[0] - corner[1]) <= 1 && Math.abs(corner[2] - corner[1]) <= 1, `the empty sky is black, the same in every channel (${corner.join(',')})`);
  check(lit >= 3 && middle[0] > middle[2] + 6 && middle[0] >= 12, `the galaxy's own light is there, warm, drawn back from it (${lit} glows; ${middle.join(',')} at its middle)`);
  // among the stars it is no glow: they show one by one
  await page.evaluate(() => {
    const e = window.__stel.engine();
    e.rig.jump(new (e.rig.target.constructor)(0, 0, 0), 150);
  });
  await page.waitForTimeout(1200);
  check((await glows()) === 0, `close by, among the stars, it fades (${await glows()} glows shown)`);
  // once the stars have gone out, it is gone
  await page.evaluate(() => {
    const e = window.__stel.engine();
    const s = window.__stel.state();
    s.era = 'dark';
    window.__stel.refresh();
    e.rig.jump(new (e.rig.target.constructor)(0, 0, 0), 2600);
  });
  await page.waitForTimeout(1500);
  check((await glows()) === 0, `in the Dark it is gone (${await glows()} glows shown)`);
  // a system's sky is black too
  await page.evaluate(() => {
    const s = window.__stel.state();
    s.era = 'dusk';
    window.__stel.refresh();
    const home = window.__stel.state().civ.homeSystemId ?? Object.values(window.__stel.state().colonies)[0]?.systemId;
    window.__stel.engine().showSystem(home);
  });
  await page.waitForTimeout(2500);
  await ck.shot('sky-system.png');
  const sys = await sky(0.03, 0.06);
  check(Math.max(...sys) <= 2 && Math.abs(sys[0] - sys[1]) <= 1 && Math.abs(sys[2] - sys[1]) <= 1, `a system's empty sky is black too (${sys.join(',')})`);
  await finish('SKY', ck);
});
