// Browser check: the Long Flow (stable matter, η 65). Before it the timeline marks it and a
// forecast warns of it; when it comes, its event tells what it is; after it the worlds' ground has
// run smooth (the shader's uFlow) and the stones of a belt are round.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('flow');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000, protonFate: 'stable' }));
  await page.waitForTimeout(800);
  // play as the harness does until the next turn could reach η 65
  const pre = await page.evaluate(() => {
    const s = window.__stel.state();
    let prev = s.eta;
    for (let i = 0; i < 700 && !s.outcome; i++) {
      if (s.eta + Math.max(s.eta - prev, 0.05) >= 65) break;
      prev = s.eta;
      window.__stel.endTurns(1, true, true);
    }
    s.pending.length = 0;
    window.__stel.refresh();
    return { eta: s.eta, outcome: s.outcome ? s.outcome.ending : null, home: s.civ.homeSystemId };
  });
  check(!pre.outcome && pre.eta < 65 && pre.eta > 62, `stable, η ${pre.eta.toFixed(1)}: just before the flow`);
  const tips = await page.evaluate(() => [...document.querySelectorAll('.chrono [data-tip]')].map((x) => x.dataset.tip.split('\n')[0]));
  check(tips.includes('The Long Flow'), 'the timeline marks the Long Flow, and a forecast warns of it');
  // look at home, where there is a belt
  const world = async () =>
    page.evaluate(() => {
      const e = window.__stel.engine();
      const ps = e.system.planets;
      return {
        view: e.view,
        flow: ps.filter((p) => p.mat).map((p) => p.mat.uniforms.uFlow.value),
        belts: ps.filter((p) => !p.mat && p.body.kind === 'asteroids').map((p) => p.mesh.geometry.parameters.detail),
      };
    });
  await page.evaluate((id) => window.__stel.engine().showSystem(id), pre.home);
  let w = { view: 'galaxy' };
  for (let i = 0; i < 40 && w.view !== 'system'; i++) {
    await page.waitForTimeout(400);
    w = await world();
  }
  check(w.view === 'system' && w.flow.length > 0 && w.flow.every((v) => v === 0) && w.belts.length > 0 && w.belts.every((d) => d === 0), `before: worlds rugged, stones jagged (${JSON.stringify(w)})`);
  await ck.shot('before-flow.png');
  // End turn, as the autoplayer would play it, until the flow comes
  let ev = null;
  for (let i = 0; i < 8 && !ev; i++) {
    await page.evaluate(() => {
      window.__stel.autoPlay();
      window.__stel.state().pending.length = 0;
      window.__stel.refresh();
    });
    await page.waitForTimeout(300);
    await page.locator('button.endturn').click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
    ev = await page.evaluate(() => {
      const m = document.querySelector('.modal.event');
      return m && m.querySelector('.event-title')?.textContent === 'The Long Flow' ? { text: m.querySelector('.event-text')?.textContent ?? '', choices: [...m.querySelectorAll('.btn.choice')].map((b) => b.querySelector('span')?.textContent) } : null;
    });
  }
  const eta = await page.evaluate(() => window.__stel.state().eta);
  check(!!ev && /^Ten to the sixty-five years\./.test(ev.text) && /keep watchers awake/.test(ev.text), `at η ${eta.toFixed(1)} the Long Flow comes, and its event says what it is`);
  check(ev?.choices.join(' / ') === 'Set the watches / Study the flowing iron', `with two answers (${ev?.choices.join(' / ')})`);
  await ck.shot('flow-event.png');
  if (ev) {
    await page.locator('.modal.event .btn.choice').first().click();
    await page.waitForTimeout(500);
    await page.locator('.modal button', { hasText: 'Continue' }).click().catch(() => {});
    await page.waitForTimeout(800);
  }
  w = await world();
  check(w.view === 'system' && w.flow.every((v) => v === 1) && w.belts.every((d) => d === 1), `after: the ground has run smooth and the stones are round (${JSON.stringify(w)})`);
  await ck.shot('after-flow.png');
  await finish('FLOW UI', ck);
});
