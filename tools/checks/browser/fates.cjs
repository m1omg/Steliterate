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
    // a turn at a time: this turn and the last one below must stay short of η 30, where the
    // neutron stars would tell (the autoplayer goes slow here, and a slow turn is long)
    let prev = s.eta;
    for (let i = 0; i < 240 && !s.outcome && s.eta < 24; i++) {
      if (s.eta + 2 * Math.max(s.eta - prev, 0.5) >= 29.5) break;
      prev = s.eta;
      window.__stel.endTurns(1);
      blind();
    }
    // one more turn with nothing found out, so the forecasts are drawn without the answer
    window.__stel.endTurns(1, false);
    blind();
    window.__stel.refresh();
    return { eta: s.eta, era: s.era };
  });
  await page.waitForTimeout(600);
  check(at.era === 'degenerate' && at.eta > 22 && at.eta < 30, `the Degenerate Age, η ${at.eta.toFixed(2)}, the fate unknown`);
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
  const asked = ['The Last Warmth?', 'Proton decay?', 'Long Flow?', 'Neutron stars burst?', 'Great Evaporation?'];
  check(asked.every((l) => chrono.tips.includes(l)), `its dates are questions (${chrono.tips.filter((t) => t.endsWith('?')).join(', ')})`);
  const told = ['The Great Decay', 'The Last Warmth', 'The Long Flow', 'Neutron stars burst', 'The Great Evaporation', 'White dwarfs fade', 'Positronium forms'];
  check(!told.some((l) => chrono.tips.includes(l)), 'and no fate’s own milestone shows');
  check(chrono.tips.includes('The end of the Degenerate Age?'), 'the forecast pin asks too');
  await page.locator('.chrono').screenshot({ path: path.join(ck.out, 'unknown-chronometer.png') });

  // ------------------------------------------------ each fate's crossing screen
  /**
   * Autoplay (as the harness does) until the next turn could reach η `b`. In the last four decades
   * the turns keep to the Tide (the autoplayer's other choices stand): short of energy it may take
   * a turn ten times longer, which would cross `b` before the crossing screen could be seen.
   */
  const playTo = (b) =>
    page.evaluate((b) => {
      const s = window.__stel.state();
      let prev = s.eta;
      for (let i = 0; i < 600 && !s.outcome; i++) {
        // with room for a turn twice as long as the last
        if (s.eta + 2 * Math.max(s.eta - prev, 0.05) >= b) break;
        prev = s.eta;
        if (s.eta < b - 4) window.__stel.endTurns(1, true, true);
        else {
          window.__stel.autoPlay();
          s.civ.pace = 0;
          window.__stel.endTurns(1, false, true);
        }
      }
      window.__stel.refresh();
      return { eta: s.eta, outcome: s.outcome ? s.outcome.ending : null };
    }, b);
  /** The autoplayer's choices for this turn (its events answered), then End turn, pressed. */
  const pressEndTurn = async (fate) => {
    await page.evaluate(() => {
      window.__stel.autoPlay();
      const s = window.__stel.state();
      s.pending.length = 0;
      // (at the Tide, as playTo's last decades)
      s.civ.pace = 0;
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
  /**
   * Someone must outlast matter for its crossing to show, however this seed's game went (the others
   * playing change it): our capital keeps a refuge, two Echoes on a Leptonic Substrate.
   */
  const keepRefuge = () =>
    page.evaluate(() => {
      const s = window.__stel.state();
      const c = s.colonies[s.civ.capitalId];
      if (!c) return;
      c.structures.lepton_substrate = Math.max(1, c.structures.lepton_substrate ?? 0);
      c.pops.echoes = Math.max(2, c.pops.echoes);
      window.__stel.refresh();
    });
  /** A new game of `fate`, played to just short of η `boundary`; then End turn until a crossing screen shows. */
  const crossing = async (fate, boundary, file, seed = 1000, refuge = false) => {
    await page.evaluate(([f, sd]) => window.__stel.newGame({ seed: sd, protonFate: f }), [fate, seed]);
    await page.waitForTimeout(600);
    const pre = await playTo(boundary);
    console.log(`  ${fate} (seed ${seed}): played to η ${pre.eta.toFixed(2)}${pre.outcome ? `, where it ended: ${pre.outcome}` : ''}`);
    // (a game that ended short of the boundary has no crossing to show: said so, for a caller
    // that would rather try another game)
    if (pre.outcome) return { ended: pre.outcome };
    if (refuge) await keepRefuge();
    // up to twenty turns at the Tide (some 0.45 η each late in the Degenerate Age): playTo stops early
    // after a long turn of the autoplayer's (20 Oct: at η 24.8 for η 30, after a slow one)
    for (let i = 0; i < 20 && !(await page.locator('.crossing').count()); i++) if (!(await pressEndTurn(fate))) break;
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

  // the harness's seeds (1000 + 7919·g): a check of the universe's rules rides the course of the
  // game it plays, and the autoplayer loses some games, so where one ends short of the moment
  // checked, or crosses it in a turn too long to show it, the next seed's game is played instead
  // (20 Oct: the finds' tests re-rolled seed 1000's games). Only a game that ended, or ran past the
  // moment, moves on; a living one with no crossing screen still fails.
  const SEEDS = [1000, 8919, 16838, 24757, 32676, 40595, 48514, 56433];

  let r;
  for (const seed of SEEDS) {
    r = await crossing('stable', 30, 'stable-last-warmth.png', seed);
    if (!r?.ended && !(r && r.eta >= 31.5)) break;
  }
  check(r?.from === 'The end of The Degenerate Age · The Last Warmth' && r.h1 === 'The Black Hole Age', `stable: the Last Warmth opens the Black Hole Age (${r?.from} / ${r?.h1})`);
  check(!!r && r.eta >= 30 && r.eta < 31.5, `near η 30 (${r?.eta.toFixed(2)})`);
  check(!!r && r.intro.startsWith('The protons held') && !r.lines.some((l) => /decayed|dissolved/.test(l)), 'its intro and lines say matter endures, and nothing decayed');
  await go(r);

  // a game that lives through the Great Decay, with a refuge kept at the capital (seed 48514 had one
  // of its own until the others played the same game, and since 19 Oct dies out at η 38.3)
  for (const seed of [48514, ...SEEDS.filter((x) => x !== 48514)]) {
    r = await crossing('decays', 39, 'decay-great-decay.png', seed, true);
    if (!r?.ended) break;
  }
  check(r?.from === 'The end of The Degenerate Age · The Great Decay' && r.h1 === 'The Black Hole Age', `decay: the Great Decay (${r?.from} / ${r?.h1})`);
  check(!!r && r.intro.startsWith('Ordinary matter has decayed away') && r.lines.some((l) => /has decayed\./.test(l)), 'matter has decayed, and it says so');
  await go(r);

  // curvature: the Last Warmth at η 68, then, in the same game, the Great Evaporation at η 89.5
  let e = null;
  let evaporation = '';
  for (const seed of SEEDS) {
    r = await crossing('curvature', 68, 'curvature-last-warmth.png', seed);
    if (r?.ended) continue;
    if (!(await go(r))) break;
    const pre = await playTo(89.5);
    evaporation = `from η ${pre.eta.toFixed(2)}${pre.outcome ? ` (ended: ${pre.outcome})` : ''}`;
    if (pre.outcome) continue;
    await keepRefuge();
    for (let i = 0; i < 20 && !e; i++) {
      if (!(await pressEndTurn('curvature'))) break;
      e = await page.evaluate(() => {
        const c = document.querySelector('.crossing');
        return c ? { from: c.querySelector('.from')?.textContent.trim(), h1: c.querySelector('h1')?.textContent.trim(), lines: [...c.querySelectorAll('.lines > div')].map((x) => x.textContent.trim()), eta: window.__stel.state().eta } : null;
      });
    }
    break;
  }
  check(r?.from === 'The end of The Degenerate Age · The Last Warmth' && r.h1 === 'The Black Hole Age' && r.eta >= 68, `curvature: the Last Warmth at η ${r?.eta?.toFixed(2)} (${r?.from})`);
  check(!!r?.intro && r.intro.startsWith('The neutron stars have burst') && r.lines.some((l) => /neutron stars have burst/.test(l)), 'the neutron stars have burst');
  if (e) await ck.shot('curvature-great-evaporation.png');
  console.log(`  the Great Evaporation: ${evaporation}: ${e ? `${e.from} / ${e.h1} at η ${e.eta.toFixed(2)}` : 'none'}`);
  check(e?.from === 'The Black Hole Age' && e.h1 === 'The Great Evaporation' && e.eta >= 89.5, `the Great Evaporation comes inside the Black Hole Age (${e?.from} / ${e?.h1})`);
  check(!!e && e.lines.some((l) => /has evaporated\./.test(l)), 'every world has evaporated, and it says so');
  await finish('FATES UI', ck);
});
