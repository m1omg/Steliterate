// Browser check: the Last Star (12 Oct; the player never saw it: lit and out within one turn). The
// gathering done, End turn lights it as the turn ends; its event, Light in the Halo, offers to keep
// time with it, free whatever our pace, from the keyboard too; the Pace panel counts its six turns
// and the star's panel shows it burning; six real End Turns run it out. In the magnifier mode the
// event and its choice are there as well.
const { check, start, finish, run } = require('../lib.cjs');

// the page's own game played into the Degenerate Age as the harness plays it (a civilization that
// can live there: one moved from the Dusk's first turn dies within a few)
function intoTheAge() {
  const s = window.__stel.state();
  for (let i = 0; i < 300 && s.era !== 'degenerate'; i++) window.__stel.endTurns(1, true);
  return { era: s.era, turn: s.turn };
}

// the page's own game, moved to η 26 in the Degenerate Age, with the Unlit's gathering done this turn
function setUp() {
  const s = window.__stel.state();
  s.era = 'degenerate';
  s.years = 1e26;
  s.eta = 26;
  s.civ.pace = 0;
  s.civ.energy = 500;
  s.minds.dark.stage = 4;
  s.minds.dark.understanding = 80;
  s.minds.dark.flags.gathering = s.turn;
  s.civ.pending.length = 0;
  window.__stel.refresh();
}

// after End turn: only the Last Star's event waits (the jump to η 26 brings others)
function onlyTheStar() {
  const s = window.__stel.state();
  s.civ.pending = s.civ.pending.filter((p) => p.defId === 'last_star');
  window.__stel.refresh();
  const sys = Object.values(s.systems).find((x) => x.name === 'The Last Star');
  return sys ? { id: sys.id, kind: sys.primary.kind, born: sys.primary.bornAt, years: s.years, n: s.civ.pending.length } : null;
}

const event = (page) =>
  page.evaluate(() => {
    const m = document.querySelector('.modal.event');
    if (!m) return null;
    return { title: m.querySelector('.event-title')?.textContent, text: m.querySelector('.event-text')?.textContent ?? '', choices: [...m.querySelectorAll('.btn.choice')].map((b) => ({ t: b.querySelector('span')?.textContent, on: !b.disabled, all: b.textContent })) };
  });

run(async () => {
  const ck = await start('last-star', { seed: 1000 });
  const { page } = ck;
  const age = await page.evaluate(intoTheAge);
  check(age.era === 'degenerate', `played into the Degenerate Age (turn ${age.turn})`);
  await page.evaluate(setUp);
  await page.waitForTimeout(400);
  await page.locator('button.endturn').click();
  await page.waitForTimeout(1500);
  const star = await page.evaluate(onlyTheStar);
  await page.waitForTimeout(600);
  check(!!star && star.kind === 'dark_star' && star.born === star.years && star.n === 1, `End turn lit the Last Star as the turn ended (${JSON.stringify(star)})`);
  const ev = await event(page);
  console.log('event', JSON.stringify(ev));
  check(ev?.title === 'Light in the Halo', `its event shows (${ev?.title})`);
  check(/costs nothing, whatever our pace\. Will we live in its light while it lasts\?$/.test(ev?.text ?? ''), 'it offers six turns of its light, costing nothing whatever our pace');
  check(ev?.choices.map((c) => c.t).join(' | ') === 'Keep time with it | Watch it burn' && ev.choices[0].on, `its choices (${ev?.choices.map((c) => c.t).join(' | ')}), Keep time open`);
  check(/Free, whatever our pace\./.test(ev?.choices[0]?.all ?? ''), 'Keep time says: free, whatever our pace');
  await ck.shot('last-star-event.png');
  // from the keyboard: the title has the focus; Tab to the first choice, Enter
  const focus0 = await page.evaluate(() => document.activeElement?.classList.contains('event-title') ?? false);
  check(focus0, 'the event takes the focus on its title');
  let onKeep = false;
  for (let i = 0; i < 6 && !onKeep; i++) {
    await page.keyboard.press('Tab');
    onKeep = await page.evaluate(() => document.activeElement?.matches('.modal.event .btn.choice') && document.activeElement.textContent.includes('Keep time with it'));
  }
  check(onKeep, 'Tab reaches Keep time with it');
  const energy = await page.evaluate(() => window.__stel.state().civ.energy);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const res = await page.evaluate(() => document.querySelector('.modal .event-text')?.textContent ?? '');
  check(/^We keep time with The Last Star now: 6 turns, each about .*, until it burns out\.$/.test(res), `the result says so (${res})`);
  check((await page.evaluate(() => window.__stel.state().civ.energy)) === energy, 'nothing was paid');
  await page.locator('.modal button', { hasText: 'Continue' }).click();
  await page.waitForTimeout(400);
  const chip = () => page.evaluate(() => [...document.querySelectorAll('.pace .chip')].map((x) => x.textContent.trim()).find((t) => t.startsWith('Star clock')) ?? null);
  check((await chip()) === 'Star clock · The Last Star · turn 1 of 6', `the Pace panel counts it (${await chip()})`);
  // its panel
  await page.evaluate((id) => window.__stel.select('system', id), star.id);
  await page.waitForTimeout(800);
  const panel = await page.evaluate(() => document.querySelector('.drawer')?.textContent ?? '');
  check(panel.includes('The Last Star: a star burning dark matter') && panel.includes('Burns until'), 'its panel: burning dark matter, and until when');
  await ck.shot('last-star-panel.png');
  // six real turns
  for (let k = 1; k <= 6; k++) {
    await page.evaluate(() => {
      const s = window.__stel.state();
      s.civ.pending.length = 0;
      s.civ.energy = Math.max(s.civ.energy, 500);
      window.__stel.refresh();
    });
    await page.waitForTimeout(150);
    const open = await page.evaluate(() => [...document.querySelectorAll('.modal, .crossing, [role=dialog]')].map((m) => `${m.className}: ${(m.querySelector('h1, h2, .event-title')?.textContent ?? '').slice(0, 60)}`));
    if (open.length) console.log(`   (before turn ${k + 1}: ${open.join(' | ')})`);
    await page.locator('button.endturn').click();
    await page.waitForTimeout(900);
    if (k < 6) {
      const c = await chip();
      check(c === `Star clock · The Last Star · turn ${k + 1} of 6`, `after turn ${k}: ${c}`);
    }
  }
  const end = await page.evaluate((id) => {
    const s = window.__stel.state();
    return { kind: s.systems[id].primary.kind, flags: !!s.civ.flags.star_until };
  }, star.id);
  check((await chip()) === null && !end.flags && end.kind === 'black_dwarf', `after six turns it is out, and the clock gone (${end.kind})`);
  // the magnifier mode (the first page closed: two software-rendered games at once can stall the second)
  await ck.shot('last-star-out.png');
  await page.context().close();
  const lv = await ck.another(1280, 720);
  await lv.goto(`${process.argv[2] || 'http://localhost:4173/'}?lowvision&nofilms`, { timeout: 90000, waitUntil: 'domcontentloaded' });
  await lv.waitForFunction(() => !!window.__stel, null, { timeout: 90000 });
  await lv.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await lv.waitForTimeout(1500);
  await lv.evaluate(setUp);
  await lv.waitForTimeout(400);
  await lv.locator('button.endturn').click({ timeout: 90000 });
  await lv.waitForTimeout(1500);
  await lv.evaluate(onlyTheStar);
  await lv.waitForTimeout(800);
  const lvKeep = lv.locator('.modal.event .btn.choice', { hasText: 'Keep time with it' });
  check((await lvKeep.count()) === 1 && (await lvKeep.isVisible()) && (await lvKeep.isEnabled()), 'in the magnifier mode its event offers Keep time with it');
  await lv.screenshot({ path: require('path').join(ck.out, 'last-star-lowvision.png') });
  await finish('LAST STAR UI', ck);
});
