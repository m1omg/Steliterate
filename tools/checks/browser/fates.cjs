// Browser check: the fates of matter. With the fate unknown the Chronometer hatches the stretch
// the Degenerate Age may end in, shows its dates as questions and the forecast asks; each fate ends
// the age on its own crossing screen: the Last Warmth (stable, η 30), the Great Decay (η 39), the
// Last Warmth with the neutron stars bursting (curvature, η 68) and, inside the Black Hole Age, the
// Great Evaporation (curvature, η 89.5).
const path = require('path');
const { check, start, finish, run } = require('../lib.cjs');

run(async () => {
  const ck = await start('fates');
  const { page } = ck;

  // ------------------------------------------------ an unknown fate, before anyone knows
  await page.evaluate(() => window.__stel.newGame({ seed: 1000, protonFate: 'unknown' }));
  await page.waitForTimeout(800);
  const at = await page.evaluate(() => {
    const s = window.__stel.state();
    // no one asks the Proton Question (the autoplayer would, or the scholars from spare insight)
    const blind = () => {
      s.civ.techs = s.civ.techs.filter((x) => x !== 'proton_question');
      delete s.civ.research.proton_question;
      if (s.civ.researching === 'proton_question') s.civ.researching = null;
      s.civ.flags.insight_bank = 0;
    };
    for (let i = 0; i < 80 && !s.outcome && s.eta < 24; i++) {
      window.__stel.endTurns(3);
      blind();
    }
    // one more turn with nothing found out, so the forecasts are drawn without the answer
    window.__stel.endTurns(1, false);
    blind();
    window.__stel.refresh();
    return { eta: s.eta, era: s.era };
  });
  await page.waitForTimeout(600);
  check(at.era === 'degenerate' && at.eta > 24 && at.eta < 30, `the Degenerate Age, η ${at.eta.toFixed(2)}, the fate unknown`);
  const chrono = await page.evaluate(() => {
    const c = document.querySelector('.chrono');
    const unsure = [...c.querySelectorAll('.eyebrow')].find((x) => x.textContent.trim() === 'II → III ?');
    return {
      tips: [...c.querySelectorAll('[data-tip]')].map((x) => x.dataset.tip.split('\n')[0]),
      unsure: unsure ? unsure.dataset.tip : null,
      hatched: !!c.querySelector('rect[fill="url(#chrono-unsure)"]'),
    };
  });
  check(chrono.hatched && /no one knows yet/.test(chrono.unsure ?? ''), 'the timeline hatches where the age may end, “II → III ?”, and says why');
  const asked = ['The Last Warmth?', 'Proton decay?', 'Neutron stars burst?', 'Great Evaporation?'];
  check(asked.every((l) => chrono.tips.includes(l)), `its dates are questions (${chrono.tips.filter((t) => t.endsWith('?')).join(', ')})`);
  const told = ['The Great Decay', 'The Last Warmth', 'Neutron stars burst', 'The Great Evaporation', 'White dwarfs fade', 'Positronium forms'];
  check(!told.some((l) => chrono.tips.includes(l)), 'and no fate’s own milestone shows');
  check(chrono.tips.includes('The end of the Degenerate Age?'), 'the forecast pin asks too');
  await page.locator('.chrono').screenshot({ path: path.join(ck.out, 'unknown-chronometer.png') });

  // ------------------------------------------------ each fate's crossing screen
  /** Autoplay (as the harness does) until the next turn could reach η `b`. */
  const playTo = (b) =>
    page.evaluate((b) => {
      const s = window.__stel.state();
      let prev = s.eta;
      for (let i = 0; i < 600 && !s.outcome; i++) {
        if (s.eta + Math.max(s.eta - prev, 0.05) >= b) break;
        prev = s.eta;
        window.__stel.endTurns(1, true, true);
      }
      window.__stel.refresh();
      return { eta: s.eta, outcome: s.outcome ? s.outcome.ending : null };
    }, b);
  /** The autoplayer's choices for this turn (its events answered), then End turn, pressed. */
  const pressEndTurn = async (fate) => {
    await page.evaluate(() => {
      window.__stel.autoPlay();
      window.__stel.state().pending.length = 0;
      window.__stel.refresh();
    });
    await page.waitForTimeout(300);
    const pressed = await page.locator('button.endturn').click({ timeout: 8000 }).then(() => true, () => false);
    if (!pressed) {
      await ck.shot(`stuck-${fate}.png`);
      console.log(`  could not press End turn: ${await page.evaluate(() => [...document.querySelectorAll('.modal, [role=dialog]')].map((m) => m.className + ': ' + m.textContent.slice(0, 120)).join(' | '))}`);
    }
    await page.waitForTimeout(900);
    return pressed;
  };
  /** A new game of `fate`, played to just short of η `boundary`; then End turn until a crossing screen shows. */
  const crossing = async (fate, boundary, file, seed = 1000) => {
    await page.evaluate(([f, sd]) => window.__stel.newGame({ seed: sd, protonFate: f }), [fate, seed]);
    await page.waitForTimeout(600);
    const pre = await playTo(boundary);
    console.log(`  ${fate} (seed ${seed}): played to η ${pre.eta.toFixed(2)}${pre.outcome ? `, where it ended: ${pre.outcome}` : ''}`);
    if (pre.outcome) return null;
    for (let i = 0; i < 6 && !(await page.locator('.crossing').count()); i++) if (!(await pressEndTurn(fate))) break;
    const r = await page.evaluate(() => {
      const c = document.querySelector('.crossing');
      if (!c) return null;
      const s = window.__stel.state();
      return {
        // the ending screen looks the same; only a crossing goes on
        goesOn: [...c.querySelectorAll('button')].some((b) => b.textContent.includes('Go on')),
        from: c.querySelector('.from')?.textContent.trim(),
        h1: c.querySelector('h1')?.textContent.trim(),
        intro: c.querySelector('.intro')?.textContent.trim(),
        lines: [...c.querySelectorAll('.lines > div')].map((x) => x.textContent.trim()),
        eta: s.eta,
      };
    });
    if (r) await ck.shot(file);
    console.log(`  ${r ? `${r.from} / ${r.h1} at η ${r.eta.toFixed(2)}` : 'no crossing screen'}`);
    return r;
  };
  const go = async (r) => {
    if (!r?.goesOn) return false;
    await page.locator('.crossing button', { hasText: 'Go on' }).click();
    await page.waitForTimeout(500);
    return true;
  };

  let r = await crossing('stable', 30, 'stable-last-warmth.png');
  check(r?.from === 'The end of The Degenerate Age · The Last Warmth' && r.h1 === 'The Black Hole Age', `stable: the Last Warmth opens the Black Hole Age (${r?.from} / ${r?.h1})`);
  check(!!r && r.eta >= 30 && r.eta < 31.5, `near η 30 (${r?.eta.toFixed(2)})`);
  check(!!r && r.intro.startsWith('The protons held') && !r.lines.some((l) => /decayed|dissolved/.test(l)), 'its intro and lines say matter endures, and nothing decayed');
  await go(r);

  // a game that lives through the Great Decay (seed 1000 does not, under decay; nor in the harness)
  r = await crossing('decays', 39, 'decay-great-decay.png', 48514);
  check(r?.from === 'The end of The Degenerate Age · The Great Decay' && r.h1 === 'The Black Hole Age', `decay: the Great Decay (${r?.from} / ${r?.h1})`);
  check(!!r && r.intro.startsWith('Ordinary matter has decayed away') && r.lines.some((l) => /has decayed\./.test(l)), 'matter has decayed, and it says so');
  await go(r);

  r = await crossing('curvature', 68, 'curvature-last-warmth.png');
  check(r?.from === 'The end of The Degenerate Age · The Last Warmth' && r.h1 === 'The Black Hole Age' && r.eta >= 68, `curvature: the Last Warmth at η ${r?.eta.toFixed(2)} (${r?.from})`);
  check(!!r && r.intro.startsWith('The neutron stars have burst') && r.lines.some((l) => /neutron stars have burst/.test(l)), 'the neutron stars have burst');
  if (await go(r)) {
    const pre = await playTo(89.5);
    let e = null;
    for (let i = 0; i < 6 && !pre.outcome && !e; i++) {
      if (!(await pressEndTurn('curvature'))) break;
      e = await page.evaluate(() => {
        const c = document.querySelector('.crossing');
        return c ? { from: c.querySelector('.from')?.textContent.trim(), h1: c.querySelector('h1')?.textContent.trim(), lines: [...c.querySelectorAll('.lines > div')].map((x) => x.textContent.trim()), eta: window.__stel.state().eta } : null;
      });
    }
    if (e) await ck.shot('curvature-great-evaporation.png');
    console.log(`  the Great Evaporation: from η ${pre.eta.toFixed(2)}${pre.outcome ? ` (ended: ${pre.outcome})` : ''}: ${e ? `${e.from} / ${e.h1} at η ${e.eta.toFixed(2)}` : 'none'}`);
    check(e?.from === 'The Black Hole Age' && e.h1 === 'The Great Evaporation' && e.eta >= 89.5, `the Great Evaporation comes inside the Black Hole Age (${e?.from} / ${e?.h1})`);
    check(!!e && e.lines.some((l) => /has evaporated\./.test(l)), 'every world has evaporated, and it says so');
  }
  await finish('FATES UI', ck);
});
