// Browser check: pace buttons that change nothing are greyed out, say why, and do nothing when
// clicked; the pace the turn is lived at is lit, and one we chose that is greyed for now outlined;
// a slow pace whose turn would run on to the end of the age is greyed and says so (20 Oct).
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('pace-grey');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1000);
  const buttons = () => page.evaluate(() => [...document.querySelectorAll('.pace-opt')].map((b) => ({ t: b.textContent.trim(), grey: b.classList.contains('disabled'), on: b.classList.contains('primary') })));
  const fmt = (bs) => bs.map((b) => `${b.t}${b.grey ? ' (grey)' : ''}${b.on ? ' *' : ''}`).join(' | ');
  // the Degenerate Age, Quickening known, no clock; space unmaking matter, so the age runs on to η 68
  // and has room for a Slow ×100 turn (no slow turn ends an age, 20 Oct)
  await page.evaluate(() => {
    const s = window.__stel.state();
    for (let i = 0; i < 60 && (s.era !== 'degenerate' || s.years < 2e15); i++) window.__stel.endTurns(3);
    s.civ.pending.length = 0;
    delete s.civ.flags.star_until; delete s.civ.flags.star_step; delete s.civ.flags.star_next;
    if (!s.civ.techs.includes('quickening')) s.civ.techs.push('quickening');
    s.civ.pace = 1;
    s.fate = 'curvature';
    window.__stel.refresh();
  });
  await page.waitForTimeout(600);
  const free = await buttons();
  console.log('no clock:', fmt(free));
  check(free.length === 5 && free.every((b) => !b.grey), 'without a clock every pace is open');
  const by = (bs, t) => bs.find((b) => b.t === t);
  const tipOf = async (label) => {
    const el = await page.$(`.pace-opt:has-text("${label}")`);
    const bb = await el.boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.move(bb.x + bb.width / 2 + 2, bb.y + bb.height / 2 + 1);
    await page.waitForTimeout(300);
    return page.evaluate(() => document.querySelector('.tip')?.textContent ?? '');
  };
  // where protons decay the age ends at η 39, 67 turns of the Tide: a Slow ×100 turn would end it
  await page.evaluate(() => { const s = window.__stel.state(); s.fate = 'decay'; window.__stel.refresh(); });
  await page.waitForTimeout(500);
  const short = await buttons();
  console.log('protons decaying:', fmt(short));
  const why = await tipOf('Slow ×100');
  console.log('tip:', why);
  check(by(short, 'Slow ×100')?.grey && short.filter((b) => b.t !== 'Slow ×100').every((b) => !b.grey) && why.includes('end of the age'), 'where protons decay Slow ×100 is greyed, as its turn would run on to the end of the age, and says so');
  await page.mouse.move(10, 10);
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
  // a pace we chose that the clock greys (the player, 16 Oct: "the UI still stays with that pace
  // highlighted"): the pace the turn is lived at is lit, ours outlined, and it comes back by itself
  await page.evaluate(() => { const s = window.__stel.state(); s.civ.pace = 1; window.__stel.refresh(); });
  await page.waitForTimeout(500);
  const kept = await page.evaluate(() => [...document.querySelectorAll('.pace-opt')].map((b) => ({ t: b.textContent.trim(), on: b.classList.contains('primary'), stored: b.classList.contains('stored'), pressed: b.getAttribute('aria-pressed'), border: getComputedStyle(b).borderStyle })));
  console.log('Quick ×10 chosen under the clock, no Quickening:', kept.map((b) => `${b.t}${b.on ? ' lit' : ''}${b.stored ? ` outlined (${b.border})` : ''}`).join(' | '));
  check(by(kept, 'Tide')?.on && by(kept, 'Tide')?.pressed === 'true' && by(kept, 'Quick ×10')?.stored && !by(kept, 'Quick ×10')?.on && by(kept, 'Quick ×10')?.pressed === 'false' && by(kept, 'Quick ×10')?.border === 'dashed', 'the Tide, at which the turn is lived, is lit (and pressed); the Quick ×10 we chose is outlined, dashed');
  await ck.shot('pace-kept.png', { clip: { x: 1080, y: 640, width: 320, height: 180 } });
  await page.evaluate(() => { const s = window.__stel.state(); delete s.civ.flags.star_until; delete s.civ.flags.star_step; window.__stel.refresh(); });
  await page.waitForTimeout(500);
  const back = await page.evaluate(() => [...document.querySelectorAll('.pace-opt')].map((b) => ({ t: b.textContent.trim(), on: b.classList.contains('primary'), stored: b.classList.contains('stored') })));
  check(by(back, 'Quick ×10')?.on && !by(back, 'Quick ×10')?.stored && !by(back, 'Tide')?.on, 'once the clock is gone, Quick ×10 is lit again by itself');
  await finish('PACE GREY', ck);
});
