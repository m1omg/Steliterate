// Browser check: the Charters screen offers Repeal… on a law in force, asks once, then repeals;
// the freed room takes another law; a dark law has no repeal.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('repeal', { width: 1400, height: 1000 });
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 4242 }));
  await page.waitForTimeout(1200);
  // a full book of five, as in the player's game
  await page.evaluate(() => {
    const s = window.__stel.state();
    s.pending.length = 0;
    for (const t of ['the_long_record', 'cold_sleep', 'mind_substrate', 'hunger_studies']) if (!s.civ.techs.includes(t)) s.civ.techs.push(t);
    s.civ.charters = ['sanctuary', 'open_archives', 'rationing', 'child_quotas', 'right_to_stop', 'consume_the_dead'];
    s.civ.accord = 200;
    window.__stel.refresh();
  });
  await page.locator('button[aria-label^="Charters"]').first().click();
  await page.waitForTimeout(700);
  const card = (name) => page.locator('.card', { has: page.locator('h4', { hasText: name }) });
  check((await card('Blackout').locator('button', { hasText: 'Enact' }).isDisabled()), 'with five laws the book is full');
  check((await page.locator('.modal').textContent()).includes('5 of 5 written'), 'the heading counts the book');
  check((await card('Consume the Dead').locator('button', { hasText: 'Repeal' }).count()) === 0, 'a dark law has no Repeal');
  const repeal = card('Sanctuary').getByRole('button', { name: 'Repeal…' });
  check((await repeal.count()) === 1, 'Sanctuary in force offers Repeal…');
  await repeal.click();
  await page.waitForTimeout(300);
  const confirmBtn = card('Sanctuary').getByRole('button', { name: /Repeal for 25 accord/ });
  check((await confirmBtn.count()) === 1, 'Repeal… asks first: Repeal for 25 accord / Keep it');
  await ck.shot('repeal-confirm.png');
  // Keep it backs out
  await card('Sanctuary').getByRole('button', { name: 'Keep it' }).click();
  await page.waitForTimeout(200);
  check((await page.evaluate(() => window.__stel.state().civ.charters.includes('sanctuary'))), 'Keep it changes nothing');
  await card('Sanctuary').getByRole('button', { name: 'Repeal…' }).click();
  await card('Sanctuary').getByRole('button', { name: /Repeal for 25 accord/ }).click();
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => {
    const s = window.__stel.state();
    return { has: s.civ.charters.includes('sanctuary'), accord: s.civ.accord, flag: s.civ.flags.repealed_sanctuary, log: s.log[s.log.length - 1]?.text };
  });
  check(!after.has && after.accord === 175 && after.flag !== undefined, `repealed: accord 200 → ${after.accord}, remembered`);
  check(after.log === 'Charter repealed: Sanctuary.', `the Record says so (${after.log})`);
  check((await card('Sanctuary').getByRole('button', { name: 'Enact again' }).count()) === 1, 'Sanctuary now offers Enact again');
  // the freed room takes another law
  const blackout = card('Blackout').getByRole('button', { name: 'Enact' });
  check(!(await blackout.isDisabled()), 'the freed room is open to Blackout');
  await blackout.click();
  await page.waitForTimeout(400);
  check(await page.evaluate(() => window.__stel.state().civ.charters.includes('blackout')), 'Blackout enacted in the freed room');
  await ck.shot('repeal-after.png');
  await finish('REPEAL UI', ck);
});
