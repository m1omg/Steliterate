// Browser check: A New Star offers to keep time; choosing it starts the star clock (HUD chip, the
// Collision stars tab), six real End Turns run it out, and the Tide comes back. A second star while
// the clock runs cannot take it over; White Fire offers the same and can be let pass.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('star-clock');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1000);
  // into the Degenerate Age, far enough that a turn outlasts a collision star
  const at = await page.evaluate(() => {
    const s = window.__stel.state();
    for (let i = 0; i < 40 && (s.era !== 'degenerate' || s.turnLength < 2e13); i++) window.__stel.endTurns(5);
    delete s.civ.flags.star_until;
    delete s.civ.flags.star_step;
    s.civ.pace = 0;
    s.pending.length = 0;
    window.__stel.refresh();
    return { era: s.era, turn: s.turn, L: s.turnLength, years: s.years };
  });
  console.log('at', JSON.stringify(at));
  check(at.era === 'degenerate', `reached the Degenerate Age (${at.era})`);
  const made = await page.evaluate(() => {
    const s = window.__stel.state();
    const bds = Object.values(s.systems).filter((x) => x.primary.kind === 'brown_dwarf' && !x.gone && !x.ejected && s.civ.known[x.id]);
    const a = bds[0];
    a.primary.kind = 'collision_star';
    a.primary.mass = 0.1;
    a.primary.bornAt = s.years;
    a.primary.diesAt = s.years + 3e12;
    s.pending.push({ uid: 'ev_test_star', defId: 'new_star', data: { systemId: a.id } });
    window.__stel.refresh();
    return { id: a.id, name: a.name };
  });
  await page.waitForTimeout(800);
  const ev = await page.evaluate(() => {
    const m = document.querySelector('.modal.event');
    if (!m) return null;
    return { title: m.querySelector('.event-title')?.textContent, text: m.querySelector('.event-text')?.textContent, choices: [...m.querySelectorAll('.btn.choice')].map((b) => ({ t: b.querySelector('span')?.textContent, on: !b.disabled })) };
  });
  console.log('event', JSON.stringify(ev));
  check(ev?.title === 'A New Star', `A New Star shows (${ev?.title})`);
  check(/It will burn for about 3 trillion years, and at our pace the next turn alone would span .*: it would come and go inside it\. We are close enough to its pace to keep time with it, 6 turns of its light, at no cost\./.test(ev?.text ?? ''), 'it says how long the star burns and offers to keep time, free in tune');
  check(ev?.choices[0]?.t === 'Race for it, and keep time with it' && ev.choices[0].on, 'Keep time is the first choice, and open');
  await ck.shot('star-event.png');
  await page.locator('.modal.event .btn.choice').first().click();
  await page.waitForTimeout(500);
  const res = await page.evaluate(() => document.querySelector('.modal .event-text')?.textContent ?? '');
  check(/We keep time with .* now: 6 turns, each about 500 billion years, until it burns out\./.test(res), `the result says so (${res})`);
  await page.locator('.modal button', { hasText: 'Continue' }).click();
  await page.waitForTimeout(400);
  const chip = () => page.evaluate(() => [...document.querySelectorAll('.pace .chip')].map((x) => x.textContent.trim()).find((t) => t.startsWith('Star clock')) ?? null);
  check((await chip()) === `Star clock · ${made.name} · turn 1 of 6`, `the Pace panel counts it (${await chip()})`);
  const next = await page.evaluate(() => document.querySelector('.pace .row .mono')?.textContent ?? '');
  check(next.includes('500 billion years'), `next turn 500 billion years (${next})`);
  // the tab marks it
  await page.keyboard.press('s');
  await page.waitForTimeout(300);
  await page.locator('.modal button', { hasText: 'Collision stars' }).click();
  await page.waitForTimeout(300);
  const row = await page.evaluate((n) => [...document.querySelectorAll('.modal .list-item')].map((x) => x.textContent).find((t) => t.includes(n)) ?? '', made.name);
  check(row.includes('keeping time') && row.includes('6 turns left'), `the tab marks it, 6 turns left (${row})`);
  await ck.shot('star-tab.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  // a second new star while the clock runs, burning out before it: no taking the clock over
  await page.evaluate(() => {
    const s = window.__stel.state();
    const b = Object.values(s.systems).filter((x) => x.primary.kind === 'brown_dwarf' && !x.gone && !x.ejected && s.civ.known[x.id])[0];
    b.primary.kind = 'collision_star';
    b.primary.mass = 0.1;
    b.primary.bornAt = s.years;
    b.primary.diesAt = s.years + 1e12;
    s.pending.push({ uid: 'ev_test_star2', defId: 'new_star', data: { systemId: b.id } });
    window.__stel.refresh();
  });
  await page.waitForTimeout(600);
  const ev2 = await page.evaluate(() => {
    const m = document.querySelector('.modal.event');
    return m ? { text: m.querySelector('.event-text')?.textContent, first: !m.querySelector('.btn.choice').disabled } : null;
  });
  check(ev2 && !ev2.first && ev2.text.includes(`We are already keeping time with ${made.name}`), `a second star cannot take the clock over (${ev2?.text?.slice(0, 220)})`);
  await page.locator('.modal.event .btn.choice', { hasText: 'Study it' }).click();
  await page.waitForTimeout(400);
  // six real turns
  const lengths = [];
  for (let k = 1; k <= 6; k++) {
    await page.evaluate(() => {
      const s = window.__stel.state();
      s.pending.length = 0;
      window.__stel.refresh();
    });
    await page.waitForTimeout(150);
    const before = await page.evaluate(() => window.__stel.state().years);
    await page.locator('button.endturn').click();
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => window.__stel.state().years);
    lengths.push(after - before);
    if (k < 6) {
      const c = await chip();
      check(c === `Star clock · ${made.name} · turn ${k + 1} of 6`, `after turn ${k}: ${c}`);
    }
  }
  console.log('lengths', lengths.map((x) => x.toExponential(3)).join(' '));
  check(lengths.every((x) => Math.abs(x - 5e11) < 1e3), 'each of the six turns spanned 500 billion years');
  const endState = await page.evaluate((id) => {
    const s = window.__stel.state();
    return { kind: s.systems[id].primary.kind, flags: !!s.civ.flags.star_until, next: document.querySelector('.pace .row .mono')?.textContent ?? '' };
  }, made.id);
  check((await chip()) === null && !endState.flags, 'the clock is gone');
  check(endState.kind === 'white_dwarf', `the star burned out (${endState.kind})`);
  check(!endState.next.includes('500 billion'), `the next turn is our own pace again (${endState.next})`);
  // White Fire: the same offer; let it pass
  await page.evaluate(() => {
    const s = window.__stel.state();
    s.pending.length = 0;
    s.civ.energy = 100000; // enough for any price: the price itself is checked in star-price.cjs
    const w = Object.values(s.systems).find((x) => x.primary.kind === 'white_dwarf' && !x.gone);
    w.primary.kind = 'helium_star';
    w.primary.mass = 0.7;
    w.primary.bornAt = s.years;
    w.primary.diesAt = s.years + 2e8;
    s.pending.push({ uid: 'ev_test_white', defId: 'white_fire', data: { systemId: w.id } });
    window.__stel.refresh();
  });
  await page.waitForTimeout(600);
  const wf = await page.evaluate(() => {
    const m = document.querySelector('.modal.event');
    return m ? { title: m.querySelector('.event-title')?.textContent, text: m.querySelector('.event-text')?.textContent, choices: [...m.querySelectorAll('.btn.choice')].map((b) => ({ t: b.querySelector('span')?.textContent, on: !b.disabled })) } : null;
  });
  console.log('white fire', JSON.stringify(wf));
  check(wf?.title === 'White Fire' && wf.text.includes('It will burn for about 200 million years') && wf.text.includes('How fast will we choose to live while it lasts?'), 'White Fire says how long and asks');
  check(wf?.choices.map((c) => c.t).join(' | ') === 'Keep time with it | Watch the flash' && wf.choices[0].on, `its choices (${wf?.choices.map((c) => c.t).join(' | ')})`);
  await ck.shot('white-fire.png');
  await page.locator('.modal.event .btn.choice', { hasText: 'Watch the flash' }).click();
  await page.waitForTimeout(400);
  check((await chip()) === null, 'watching the flash starts no clock');
  await finish('STAR CLOCK', ck);
});
