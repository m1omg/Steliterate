// Browser check: keeping time with a new star is free in tune and priced beyond; the price shows
// on the button and in the text, is taken once, and an unaffordable one is disabled; Study it and
// Watch the flash give resolve (and insight) to anyone.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('star-price');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1000);
  const at = await page.evaluate(() => {
    const s = window.__stel.state();
    for (let i = 0; i < 40 && (s.era !== 'degenerate' || s.turnLength < 2e13); i++) window.__stel.endTurns(5);
    delete s.civ.flags.star_until;
    delete s.civ.flags.star_step;
    s.civ.pace = 0;
    s.pending.length = 0;
    s.civ.energy = 400;
    window.__stel.refresh();
    return { era: s.era, turn: s.turn, L: s.turnLength };
  });
  console.log('at', JSON.stringify(at));
  const star = (life, kind = 'collision_star') =>
    page.evaluate(
      ([life, kind]) => {
        const s = window.__stel.state();
        const pool = Object.values(s.systems).filter((x) => (kind === 'collision_star' ? x.primary.kind === 'brown_dwarf' && !x.ejected : x.primary.kind === 'white_dwarf') && !x.gone && s.civ.known[x.id]);
        const a = pool[0];
        a.primary.kind = kind;
        a.primary.bornAt = s.years;
        a.primary.diesAt = s.years + life;
        const uid = 'ev_' + Math.random().toString(36).slice(2);
        s.pending.push({ uid, defId: kind === 'collision_star' ? 'new_star' : 'white_fire', data: { systemId: a.id } });
        window.__stel.refresh();
        // the next turn at our pace, for the caller's arithmetic
        return { id: a.id, name: a.name };
      },
      [life, kind],
    );
  const event = () =>
    page.evaluate(() => {
      const m = document.querySelector('.modal.event');
      if (!m) return null;
      return { title: m.querySelector('.event-title')?.textContent, text: m.querySelector('.event-text')?.textContent, choices: [...m.querySelectorAll('.btn.choice')].map((b) => ({ t: b.querySelector('span')?.textContent, h: b.querySelector('.h')?.textContent ?? '', on: !b.disabled })) };
    });
  const energy = () => page.evaluate(() => window.__stel.state().civ.energy);
  const resolve = () => page.evaluate(() => window.__stel.state().civ.resolve);
  const clearClock = () =>
    page.evaluate(() => {
      const s = window.__stel.state();
      delete s.civ.flags.star_until;
      delete s.civ.flags.star_step;
      window.__stel.refresh();
    });
  const tide = await page.evaluate(() => {
    const s = window.__stel.state();
    // the coming turn at the Tide: a fresh game's next turn grows by the age's factor
    return s.turnLength * 2.82;
  });
  void tide;

  // 1. in tune: free
  const L = await page.evaluate(() => {
    const s = window.__stel.state();
    const e = s.era;
    return { e, years: s.years };
  });
  void L;
  const next = await page.evaluate(() => {
    // read it from the Pace panel: "next turn X"
    return document.querySelector('.pace .row .mono')?.textContent ?? '';
  });
  console.log('pace panel', next);
  const nextYears = await page.evaluate(() => {
    const s = window.__stel.state();
    // the same formula as the game's calendar (eras.ts tideLength) for the standard length
    const d = 1e15;
    return 1e9 + (2.82 - 1) * Math.max(0, s.years - d);
  });
  await star(nextYears / 20);
  await page.waitForTimeout(600);
  let ev = await event();
  console.log('in tune', JSON.stringify(ev));
  check(ev?.title === 'A New Star' && ev.text.includes('at no cost') && ev.choices[0].on && ev.choices[0].h.includes('Free: we are in tune with it.'), 'in tune: free, said in the text and on the button');
  check(ev?.choices.map((c) => c.t).join(' | ') === 'Race for it, and keep time with it | Study it | Tell the others', `three choices (${ev?.choices.map((c) => c.t).join(' | ')})`);
  let e0 = await energy();
  await page.locator('.modal.event .btn.choice').first().click();
  await page.waitForTimeout(400);
  let res = await page.evaluate(() => document.querySelector('.modal .event-text')?.textContent ?? '');
  check(!res.includes('spent') && res.includes('We keep time with'), `kept for free (${res})`);
  check((await energy()) === e0, 'no energy taken');
  await page.locator('.modal button', { hasText: 'Continue' }).click();
  await page.waitForTimeout(300);
  await clearClock();

  // 2. out of tune, affordable: the price is shown and taken once
  await page.evaluate(() => (window.__stel.state().civ.energy = 100000));
  await star(nextYears / Math.pow(10, 4.53));
  await page.waitForTimeout(600);
  ev = await event();
  console.log('out of tune', JSON.stringify(ev));
  const price = Number(ev?.choices[0].h.match(/(\d+) energy, once/)?.[1]);
  check(price > 0 && ev.text.includes(`${price} energy, once (we have 100000)`) && ev.choices[0].on, `out of tune: ${price} energy, in the text and on the button`);
  check(ev?.text.includes('Whoever reaches it first will feast.'), 'and still a feast for whoever pays');
  await ck.shot('star-price.png');
  e0 = await energy();
  await page.locator('.modal.event .btn.choice').first().click();
  await page.waitForTimeout(400);
  res = await page.evaluate(() => document.querySelector('.modal .event-text')?.textContent ?? '');
  check(res.startsWith(`We spent ${price} energy to quicken to it.`), `the result says what was paid (${res})`);
  check(Math.abs((await energy()) - (e0 - price)) < 1e-9, `${price} taken once (${e0} → ${await energy()})`);
  await page.locator('.modal button', { hasText: 'Continue' }).click();
  await page.waitForTimeout(300);
  const chip = await page.evaluate(() => [...document.querySelectorAll('.pace .chip')].map((x) => x.textContent.trim()).find((t) => t.startsWith('Star clock')) ?? null);
  check(chip?.endsWith('turn 1 of 6'), `the clock runs (${chip})`);
  await clearClock();

  // 3. unaffordable: disabled, said plainly; Study it instead
  await page.evaluate(() => (window.__stel.state().civ.energy = 10));
  await star(nextYears / Math.pow(10, 4.53));
  await page.waitForTimeout(600);
  ev = await event();
  check(!ev?.choices[0].on && ev.choices[0].h.includes('more than we have') && ev.text.includes('more than the 10 we have') && ev.text.includes('Faster minds would feast on it; we can watch, and learn.'), 'too dear: disabled, and the text says so');
  await ck.shot('star-too-dear.png');
  let r0 = await resolve();
  await page.locator('.modal.event .btn.choice', { hasText: 'Study it' }).click();
  await page.waitForTimeout(400);
  check((await resolve()) === Math.min(100, r0 + 2), `Study it: resolve ${r0} → ${await resolve()}`);

  // 4. White Fire: priced for everyone, and Watch the flash
  await page.evaluate(() => (window.__stel.state().civ.energy = 400));
  await star(2e8, 'helium_star');
  await page.waitForTimeout(600);
  ev = await event();
  console.log('white fire', JSON.stringify(ev));
  const wprice = Number(ev?.choices[0].h.match(/(\d+) energy, once/)?.[1]);
  check(ev?.title === 'White Fire' && wprice > 0 && ev.choices.map((c) => c.t).join(' | ') === 'Keep time with it | Watch the flash', `White Fire costs ${wprice} and offers Watch the flash`);
  await ck.shot('white-fire-price.png');
  r0 = await resolve();
  await page.locator('.modal.event .btn.choice', { hasText: 'Watch the flash' }).click();
  await page.waitForTimeout(400);
  check((await resolve()) === Math.min(100, r0 + 2), `Watch the flash: resolve ${r0} → ${await resolve()}`);
  await finish('STAR PRICE', ck);
});
