// Browser check: with Quickening at Quick x10 the star clock chip counts sixtieths; a cast-out ember's
// panel says it is dimming, and the Cast Out event says why.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('quick-castout');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1000);
  const at = await page.evaluate(() => {
    const s = window.__stel.state();
    for (let i = 0; i < 60 && (s.era !== 'degenerate' || s.years < 2e15); i++) window.__stel.endTurns(3);
    s.pending.length = 0;
    delete s.civ.flags.star_until; delete s.civ.flags.star_step; delete s.civ.flags.star_next;
    const A = Object.values(s.systems).find((x) => x.primary.kind === 'brown_dwarf' && !x.gone && !x.ejected);
    A.primary.kind = 'collision_star'; A.primary.mass = 0.1; A.primary.bornAt = s.years; A.primary.diesAt = s.years + 6e12;
    s.civ.flags.star_until = A.primary.diesAt; s.civ.flags.star_step = 1e12;
    if (!s.civ.techs.includes('quickening')) s.civ.techs.push('quickening');
    s.civ.pace = 1;
    // an ember, cast out half a decade of years ago
    const E = Object.values(s.systems).find((x) => x.primary.kind === 'white_dwarf' && x.primary.halo && !x.gone && s.civ.known[x.id]);
    E.ejected = true; E.primary.haloLeft = s.years / Math.pow(10, 0.5);
    s.pending.push({ uid: 'ev_cast', defId: 'cast_out', data: { systemId: E.id } });
    window.__stel.refresh();
    return { A: A.name, E: E.id, Ename: E.name };
  });
  await page.waitForTimeout(800);
  const ev = await page.evaluate(() => document.querySelector('.modal.event .event-text')?.textContent ?? '');
  console.log('cast out:', ev);
  check(ev.includes('its ember will dim and go out'), 'Cast Out says the ember will dim');
  await page.click('.modal.event .btn.choice >> nth=1');
  await page.waitForTimeout(400);
  const cont = await page.$('button:has-text("Continue")');
  if (cont) await cont.click();
  await page.waitForTimeout(400);
  const chip = await page.evaluate(() => [...document.querySelectorAll('.chip.neon')].map((c) => c.textContent).find((t) => t.includes('Star clock')) ?? '');
  const next = await page.evaluate(() => document.querySelector('.turnbox')?.textContent?.match(/next turn ([^A-Z]*?years)/)?.[1] ?? '');
  console.log('chip:', chip, '| next turn:', next);
  check(/of 60/.test(chip), 'the clock chip counts sixty turns at Quick ×10');
  check(/100(\.0)? billion years/.test(next), `the next turn is a tenth of a clock step (${next})`);
  await ck.shot('quick-chip.png', { clip: { x: 1080, y: 690, width: 320, height: 130 } });
  await page.evaluate((id) => { window.__stel.select('system', id); window.__stel.refresh(); }, at.E);
  await page.waitForTimeout(600);
  const panel = await page.evaluate(() => document.querySelector('.drawer-body')?.textContent ?? '');
  const m = panel.match(/(\d+) K/);
  console.log('ember panel:', panel.slice(0, 200));
  check(panel.includes('Ember, dimming') && m && Number(m[1]) < 63 && Number(m[1]) > 45, `a cast-out ember reads dimming, ${m && m[1]} K`);
  await finish('QUICK CASTOUT', ck);
});
