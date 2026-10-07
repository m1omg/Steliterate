// Browser check: a new star while we keep time with another can be followed on (event text, button,
// clock chip, Record entry naming the star); Study it charts the system; the Systems window opened
// from a ship sends it; dwarf panels show the cooling.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('follow-send');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1000);
  const at = await page.evaluate(() => {
    const s = window.__stel.state();
    for (let i = 0; i < 60 && (s.era !== 'degenerate' || s.years < 2e15); i++) window.__stel.endTurns(3);
    delete s.civ.flags.star_until; delete s.civ.flags.star_step; delete s.civ.flags.star_next;
    s.civ.pace = 0; s.pending.length = 0; s.civ.energy = 400;
    // a clock running for star A, four turns left
    const bds = Object.values(s.systems).filter((x) => x.primary.kind === 'brown_dwarf' && !x.gone && !x.ejected);
    const A = bds[0], B = bds[1], C = bds[2];
    A.primary.kind = 'collision_star'; A.primary.mass = 0.1; A.primary.bornAt = s.years; A.primary.diesAt = s.years + 4e12;
    s.civ.flags.star_until = A.primary.diesAt; s.civ.flags.star_step = 1e12;
    B.primary.kind = 'collision_star'; B.primary.mass = 0.1; B.primary.bornAt = s.years; B.primary.diesAt = A.primary.diesAt + 8e12;
    s.civ.known[A.id] = Math.max(1, s.civ.known[A.id] ?? 0); s.civ.known[B.id] = 1;
    s.pending.push({ uid: 'ev_follow', defId: 'new_star', data: { systemId: B.id } });
    window.__stel.refresh();
    return { era: s.era, turn: s.turn, years: s.years, A: A.name, B: B.name, Bid: B.id, Bdies: B.primary.diesAt, C: C.id };
  });
  console.log('at', JSON.stringify(at));
  await page.waitForTimeout(800);
  const event = () =>
    page.evaluate(() => {
      const m = document.querySelector('.modal.event');
      if (!m) return null;
      return { title: m.querySelector('.event-title')?.textContent, text: m.querySelector('.event-text')?.textContent, choices: [...m.querySelectorAll('.btn.choice')].map((b) => ({ t: b.querySelector('span')?.textContent, h: b.querySelector('.h')?.textContent ?? '', on: !b.disabled })) };
    });
  const e1 = await event();
  console.log(JSON.stringify(e1, null, 1));
  await ck.shot('follow-event.png');
  check(e1 && e1.text.includes(`longer than ${at.A}`) && e1.text.includes('4 more turns'), 'the text says we keep time with the first star, and for how long');
  check(e1 && !e1.text.includes('Faster minds would feast'), 'no "faster minds" line while we can follow on');
  check(e1 && e1.choices.length === 3 && e1.choices[1].t === 'Study it' && e1.choices[2].t === 'Tell the others', 'three choices: keep time, Study it, Tell the others');
  check(e1 && e1.choices[0].on && e1.choices[0].h.includes(`Once the clock of ${at.A} runs out`), 'the follow-on choice is open and says when its clock begins');
  await page.click('.modal.event .btn.choice >> nth=0');
  await page.waitForTimeout(600);
  const res1 = await page.evaluate(() => document.querySelector('.event-text')?.textContent ?? '');
  console.log('result:', res1);
  check(res1.includes('When the clock of') && res1.includes('we keep time with'), 'the result says when the second clock begins');
  const cont = await page.$('button:has-text("Continue")');
  if (cont) await cont.click();
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => {
    const s = window.__stel.state();
    const el = [...document.querySelectorAll('.chip.neon')].find((c) => c.textContent.includes('Star clock'));
    const chip = el?.textContent ?? '';
    return { next: s.civ.flags.star_next, chip, chipW: el ? el.getBoundingClientRect().right : 0, boxW: el ? el.closest('.turnbox').getBoundingClientRect().right : 0, log: s.log[s.log.length - 1], known: s.civ.known };
  });
  console.log(JSON.stringify({ next: after.next, chip: after.chip, log: after.log }));
  await ck.shot('pace-chip.png', { clip: { x: 1080, y: 690, width: 320, height: 130 } });
  check(after.next === at.Bdies, 'the second star waits to follow on');
  check(after.chip.includes(`then ${at.B}`) && after.chipW <= after.boxW + 1, 'the clock chip names the star that waits');
  check(after.log && after.log.text === `A New Star (${at.B}): Race for it, and keep time with it.` && after.log.systemId === at.Bid, 'the Record names the star and links to it');
  check(after.known[at.Bid] === 2, 'keeping time charts it');
  // Study it charts a third star
  const before = await page.evaluate((cid) => {
    const s = window.__stel.state();
    const C = s.systems[cid];
    C.primary.kind = 'collision_star'; C.primary.mass = 0.1; C.primary.bornAt = s.years; C.primary.diesAt = s.years + 2e12;
    s.civ.known[cid] = 1;
    s.pending.push({ uid: 'ev_study', defId: 'new_star', data: { systemId: cid } });
    window.__stel.refresh();
    const c = s.civ; return { insight: c.researching ? (c.research[c.researching] ?? 0) : (c.flags.insight_bank ?? 0), known: s.civ.known[cid] };
  }, at.C);
  await page.waitForTimeout(600);
  const e2 = await event();
  console.log('study event:', JSON.stringify(e2));
  await page.click('.modal.event .btn.choice:has-text("Study it")');
  await page.waitForTimeout(600);
  const cont2 = await page.$('button:has-text("Continue")');
  if (cont2) await cont2.click();
  await page.waitForTimeout(400);
  const st = await page.evaluate((cid) => ({ insight: ((c) => (c.researching ? (c.research[c.researching] ?? 0) : (c.flags.insight_bank ?? 0)))(window.__stel.state().civ), known: window.__stel.state().civ.known[cid], log: window.__stel.state().log.slice(-1)[0].text }), at.C);
  console.log(JSON.stringify({ before, st }));
  check(st.known === 2 && before.known === 1, 'Study it charts the system');
  check(st.insight >= before.insight + 25 - 1e-9, 'Study it still gives its insight');
  // the Systems window, opened from a ship
  const fl = await page.evaluate(() => {
    const s = window.__stel.state();
    const f = Object.values(s.fleets).find((x) => x.at && !x.to);
    if (!f) return null;
    window.__stel.select('fleet', f.id);
    window.__stel.refresh();
    return { id: f.id, name: f.name, at: f.at };
  });
  check(!!fl, 'a stationed fleet to send');
  await page.waitForTimeout(800);
  const more = await page.$('.more-dests');
  check(!!more, 'the fleet panel offers More in Systems');
  if (more) await more.click();
  await page.waitForTimeout(800);
  const win = await page.evaluate(() => ({ text: document.querySelector('.modal')?.textContent ?? '', sends: document.querySelectorAll('.send-here').length }));
  check(win.text.includes(`Where should ${fl?.name} go?`) && win.sends > 0, `the Systems window asks where it goes, with ${win.sends} Send buttons`);
  await ck.shot('systems-send.png');
  // and from the other tabs
  await page.click('.modal button:has-text("Surveyed worlds")');
  await page.waitForTimeout(500);
  const worlds = await page.evaluate(() => ({ text: document.querySelector('.modal')?.textContent ?? '', sends: document.querySelectorAll('.send-here').length }));
  check(worlds.text.includes('Where should') && worlds.sends > 0, `Surveyed worlds keeps the ship's choice, ${worlds.sends} Send buttons`);
  const target = await page.evaluate(() => document.querySelector('.send-here')?.closest('.list-item')?.textContent?.slice(0, 40) ?? '');
  await page.click('.send-here >> nth=0');
  await page.waitForTimeout(800);
  const sent = await page.evaluate((id) => {
    const s = window.__stel.state();
    const f = s.fleets[id];
    return { to: f.to, toName: f.to ? s.systems[f.to].name : null, modal: !!document.querySelector('.modal.systems, .modal .send-here'), sel: document.querySelector('.drawer-head h2')?.textContent ?? '' };
  }, fl?.id);
  console.log('sent', JSON.stringify(sent), 'row', target);
  check(!!sent.to && sent.to !== fl?.at, 'Send gave the ship its order');
  check(!sent.modal, 'the window closed and the fleet is shown');
  // the ship prompt offers it too
  const prompt = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('From Systems')));
  console.log('ship prompt button visible now:', prompt);
  // dwarf panels: an ember and a cooled one
  const dw = await page.evaluate(() => {
    const s = window.__stel.state();
    const ember = Object.values(s.systems).find((x) => x.primary.kind === 'white_dwarf' && x.primary.halo && !x.gone && s.civ.known[x.id]);
    const cold = Object.values(s.systems).find((x) => x.primary.kind === 'white_dwarf' && !x.primary.halo && !x.gone && s.civ.known[x.id]);
    return { ember: ember?.id, cold: cold?.id, years: s.years };
  });
  const panel = async (id) => {
    await page.evaluate((id) => { window.__stel.select('system', id); window.__stel.refresh(); }, id);
    await page.waitForTimeout(500);
    return page.evaluate(() => document.querySelector('.drawer-body')?.textContent ?? '');
  };
  if (dw.ember) {
    const t = await panel(dw.ember);
    check(t.includes('Ember') && t.includes('63 K'), 'an ember reads 63 K');
  }
  if (dw.cold) {
    const t = await panel(dw.cold);
    const m = t.match(/([\d.]+ (mK|µK|nK))/);
    console.log('cold dwarf panel:', t.slice(0, 160), '| years', dw.years.toExponential(2));
    check(t.includes('gone cold') && !!m, `an unwarmed dwarf reads ${m && m[1]}, gone cold (no 5 K floor)`);
    await ck.shot('cooling-panel.png');
  }
  await finish('FOLLOW SEND', ck);
});
