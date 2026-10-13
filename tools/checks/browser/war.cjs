// Browser check: war with a civilization of its own (parts 2c-3 and 2c-4). Declare war asks first;
// the card then shows the war, where it is fought, the siege and what that settlement holds. Storm
// waits for warships at its star and, behind a Defence Grid, for a Breacher; with the siege held it
// shows the odds, asks, and with strength enough the settlement is ours, the war going on at their
// next; Raze asks and destroys the next. A fleet with a Kinetic Lance lists the enemy's settlements
// it could strike, and the strike asks before it sets out.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('war', { seed: 1000 });
  const { page } = ck;
  const sv = await page.evaluate(() => {
    window.__stel.endTurns(30);
    const s = window.__stel.state();
    const v = Object.values(s.survivors).find((x) => x.alive && s.civs[x.id]);
    v.contact = true;
    s.civ.accord = 200;
    s.civ.energy = 1e6;
    s.civ.pending.length = 0;
    // three settlements of theirs (two more on free worlds of stars we know), each seen already
    const theirs = Object.values(s.colonies).filter((c) => c.owner === v.id);
    const free = Object.values(s.bodies).filter((b) => b.kind !== 'deep' && !b.colonyId && !b.dissolved && (s.civ.known[b.systemId] ?? 0) > 0 && !Object.values(s.colonies).some((c) => c.systemId === b.systemId));
    for (let i = 0; theirs.length < 3 && i < free.length; i += 7) {
      const b = free[i];
      const c = { ...JSON.parse(JSON.stringify(theirs[0])), id: `cw${i}`, bodyId: b.id, systemId: b.systemId, name: `${b.name} Hold`, queue: [] };
      s.colonies[c.id] = c;
      b.colonyId = c.id;
      theirs.push(c);
    }
    for (const c of theirs) delete c.foundedAt;
    window.__stel.refresh();
    return { id: v.id, name: v.name, n: theirs.length };
  });
  check(sv.n >= 3, `${sv.name} holds ${sv.n} settlements`);
  await page.locator('button[aria-label="Signals: the other minds"]').click();
  await page.waitForTimeout(500);
  await page.locator('.modal button', { hasText: /^Survivors$/ }).click();
  await page.waitForTimeout(400);
  const card = page.locator('.modal .card', { hasText: sv.name });
  const declare = card.locator('button', { hasText: /^Declare war$/ });
  check(/The Threads must consent \(60 accord\); resolve −5, dissent \+8, every Thread’s standing −3\. Our pacts with them end\./.test((await declare.getAttribute('data-tip')) ?? ''), 'Declare war says what it costs');
  await declare.click();
  await page.waitForTimeout(300);
  await card.locator('.confirm-heavy button', { hasText: 'Declare war' }).click();
  await page.waitForTimeout(400);
  const row = (label) =>
    card.evaluate((el, label) => {
      const dt = [...el.querySelectorAll('dt')].find((x) => x.textContent.trim() === label);
      return dt ? dt.nextElementSibling.textContent.trim() : null;
    }, label);
  const war = await row('War');
  check(/^since turn \d+ · at .+ · siege 0\/3 · it holds [\d.]+(, walled)?$/.test(war ?? ''), `at war: the card shows where it is fought and what that settlement holds (${war})`);
  const storm = card.locator('button', { hasText: /^Storm/ });
  const raze = card.locator('button', { hasText: /^Raze$/ });
  const state = async (b) => ({ off: (await b.getAttribute('class')).includes('disabled'), tip: (await b.getAttribute('data-tip')) ?? '', text: (await b.textContent()).trim() });
  let st = await state(storm);
  check(st.off && /^You need warships at its star\./.test(st.tip) && (await state(raze)).off, `Storm and Raze wait for warships at its star (${st.tip.split('\n')[0]})`);
  await ck.shot('war-declared.png');

  // warships at the front, theirs gone from it, the siege held: behind a Defence Grid it needs a Breacher
  const front = await page.evaluate((id) => {
    const s = window.__stel.state();
    const w = s.survivors[id].war;
    const c = Object.values(s.colonies).find((x) => x.owner === id && x.systemId === w.at);
    c.structures.defense_grid = 1;
    for (const f of Object.values(s.fleets)) if (f.owner === id && f.at === w.at) delete s.fleets[f.id];
    s.fleets.fwar = { id: 'fwar', owner: s.player, name: 'Spear', ships: Array(8).fill(0).map(() => ({ cls: 'warden', hp: 10 })), at: w.at, from: null, to: null, traveled: 0, distance: 0, order: 'idle' };
    w.siege = 3;
    window.__stel.refresh();
    return { id: c.id, name: c.name };
  }, sv.id);
  await page.waitForTimeout(400);
  st = await state(storm);
  check(st.off && /only a Breacher can break in/.test(st.tip), `behind a Defence Grid, Storm waits for a Breacher (${st.tip.split('\n')[0]})`);
  await page.evaluate(() => {
    const s = window.__stel.state();
    s.fleets.fwar.ships.push(...Array(6).fill(0).map(() => ({ cls: 'breacher', hp: 20 })));
    window.__stel.refresh();
  });
  await page.waitForTimeout(400);
  st = await state(storm);
  const odds = st.text.match(/^Storm \((\d+)%\)$/);
  check(!st.off && !!odds && /about \d+% to win/.test(st.tip), `with Breachers and the siege held, Storm shows its odds (${st.text})`);
  await storm.click();
  await page.waitForTimeout(300);
  const ask = (await card.locator('.confirm-heavy').textContent().catch(() => '')) ?? '';
  check(/^Storm .+\? About \d+% to take it\. Three tenths of its people would flee to their own/.test(ask), `Storm asks first (${ask.slice(0, 60)})`);
  await card.locator('.confirm-heavy button', { hasText: 'Storm it' }).click();
  await page.waitForTimeout(500);
  const taken = await page.evaluate(({ id, cid }) => {
    const s = window.__stel.state();
    return { owner: s.colonies[cid]?.owner, me: s.player, at: s.survivors[id].war?.at, from: s.colonies[cid]?.systemId, alive: s.survivors[id].alive };
  }, { id: sv.id, cid: front.id });
  check(taken.owner === taken.me, `stormed: ${front.name} is ours`);
  check(taken.alive && !!taken.at && taken.at !== taken.from, 'and the war goes on at their next settlement');
  const war2 = await row('War');
  check(/siege 0\/3/.test(war2 ?? '') && war2 !== war, `the card shows the new front (${war2})`);
  await ck.shot('war-stormed.png');

  // Raze the next
  const next = await page.evaluate((id) => {
    const s = window.__stel.state();
    const w = s.survivors[id].war;
    const c = Object.values(s.colonies).find((x) => x.owner === id && x.systemId === w.at);
    for (const f of Object.values(s.fleets)) if (f.owner === id && f.at === w.at) delete s.fleets[f.id];
    const fw = s.fleets.fwar;
    for (const sh of fw.ships) sh.hp = sh.cls === 'breacher' ? 20 : 10;
    fw.at = w.at;
    w.siege = 3;
    window.__stel.refresh();
    return { id: c.id, name: c.name };
  }, sv.id);
  await page.waitForTimeout(400);
  check(!(await state(raze)).off, 'Raze can be tried at the next');
  await raze.click();
  await page.waitForTimeout(300);
  const ask2 = (await card.locator('.confirm-heavy').textContent().catch(() => '')) ?? '';
  check(/^Raze .+\? About \d+% to destroy it, and everyone in it\./.test(ask2), `Raze asks first (${ask2.slice(0, 50)})`);
  await card.locator('.confirm-heavy button', { hasText: 'Raze it' }).click();
  await page.waitForTimeout(500);
  const razed = await page.evaluate((cid) => !window.__stel.state().colonies[cid], next.id);
  check(razed, `razed: ${next.name} is gone`);

  // a Kinetic Lance at our capital, struck at what is left of theirs
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const left = await page.evaluate((id) => {
    const s = window.__stel.state();
    const cap = s.colonies[s.civ.capitalId];
    s.fleets.flx = { id: 'flx', owner: s.player, name: 'Kinetic Lance', ships: [{ cls: 'lance', hp: 1 }], at: cap.systemId, from: null, to: null, traveled: 0, distance: 0, order: 'idle' };
    window.__stel.select('fleet', 'flx');
    window.__stel.refresh();
    return Object.values(s.colonies).filter((c) => c.owner === id).map((c) => c.name);
  }, sv.id);
  await page.waitForTimeout(500);
  const section = page.locator('.drawer .section', { hasText: 'Strike with the Kinetic Lance' });
  check((await section.count()) === 1, 'the fleet panel offers a strike');
  const target = section.locator('.row', { hasText: left[0] ?? '?' });
  const strikeBtn = target.locator('button', { hasText: 'Strike' });
  const stip = (await strikeBtn.getAttribute('data-tip')) ?? '';
  check(left.length > 0 && (await target.count()) === 1 && /at 99% of light/.test(stip) && /turn it aside \d+% of the time/.test(stip), `it lists ${left[0]}, with its flight and the screens seen there`);
  await strikeBtn.click();
  await page.waitForTimeout(200);
  check(/Really strike\?/.test((await strikeBtn.textContent()) ?? ''), 'the strike asks first');
  await strikeBtn.click();
  await page.waitForTimeout(500);
  const flying = await page.evaluate(() => {
    const f = window.__stel.state().fleets.flx;
    return f ? { order: f.order, to: f.to, target: f.targetColony } : null;
  });
  check(flying?.order === 'strike' && !!flying.to && !!flying.target, `the Lance is on its way (${JSON.stringify(flying)})`);
  check((await page.locator('.drawer .chip', { hasText: 'striking' }).count()) === 1, 'its panel says so');
  await ck.shot('war-lance.png');
  await finish('WAR UI', ck);
});
