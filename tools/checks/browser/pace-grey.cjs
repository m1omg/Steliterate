// Browser check: pace buttons that change nothing are greyed out, say why, and do nothing when clicked.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('pace-grey');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1000);
  const buttons = () => page.evaluate(() => [...document.querySelectorAll('.pace-opt')].map((b) => ({ t: b.textContent.trim(), grey: b.classList.contains('disabled'), on: b.classList.contains('primary') })));
  const fmt = (bs) => bs.map((b) => `${b.t}${b.grey ? ' (grey)' : ''}${b.on ? ' *' : ''}`).join(' | ');
  // the Degenerate Age, Quickening known, no clock
  await page.evaluate(() => {
    const s = window.__stel.state();
    for (let i = 0; i < 60 && (s.era !== 'degenerate' || s.years < 2e15); i++) window.__stel.endTurns(3);
    s.pending.length = 0;
    delete s.civ.flags.star_until; delete s.civ.flags.star_step; delete s.civ.flags.star_next;
    if (!s.civ.techs.includes('quickening')) s.civ.techs.push('quickening');
    s.civ.pace = 1;
    window.__stel.refresh();
  });
  await page.waitForTimeout(600);
  const free = await buttons();
  console.log('no clock:', fmt(free));
  check(free.length === 5 && free.every((b) => !b.grey), 'without a clock every pace is open');
  // a star clock
  await page.evaluate(() => {
    const s = window.__stel.state();
    const A = Object.values(s.systems).find((x) => x.primary.kind === 'brown_dwarf' && !x.gone && !x.ejected);
    A.primary.kind = 'collision_star'; A.primary.mass = 0.1; A.primary.bornAt = s.years; A.primary.diesAt = s.years + 6e12;
    s.civ.flags.star_until = A.primary.diesAt; s.civ.flags.star_step = 1e12;
    window.__stel.refresh();
  });
  await page.waitForTimeout(600);
  const clock = await buttons();
  console.log('star clock, Quickening:', fmt(clock));
  const by = (bs, t) => bs.find((b) => b.t === t);
  check(by(clock, 'Quick ×100')?.grey && !by(clock, 'Quick ×10')?.grey && !by(clock, 'Tide')?.grey && by(clock, 'Slow ×10')?.grey && by(clock, 'Slow ×100')?.grey, 'during the clock: Quick ×100 and the slow paces grey, Quick ×10 and the Tide open');
  // its tooltip says why
  const q100 = await page.$('.pace-opt:has-text("Quick ×100")');
  const box = await q100.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2 + 1);
  await page.waitForTimeout(300);
  const tip = await page.evaluate(() => document.querySelector('.tip')?.textContent ?? '');
  console.log('tip:', tip);
  check(tip.includes('Not now') && tip.includes('Quick ×10'), 'a greyed button says why');
  await ck.shot('pace-grey.png', { clip: { x: 1080, y: 640, width: 320, height: 180 } });
  // clicking it changes nothing
  await q100.click({ force: true });
  await page.waitForTimeout(300);
  const pace = await page.evaluate(() => window.__stel.state().civ.pace);
  check(pace === 1, `clicking a greyed pace changes nothing (pace ${pace})`);
  // without Quickening, the clock greys Quick x10 too
  await page.evaluate(() => { const s = window.__stel.state(); s.civ.techs = s.civ.techs.filter((t) => t !== 'quickening'); s.civ.pace = 0; window.__stel.refresh(); });
  await page.waitForTimeout(500);
  const plain = await buttons();
  console.log('star clock, no Quickening:', fmt(plain));
  check(plain.filter((b) => !b.grey).map((b) => b.t).join() === 'Tide', 'without Quickening only the Tide is open during the clock');
  await finish('PACE GREY', ck);
});
