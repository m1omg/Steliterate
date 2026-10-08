// Browser check: a ship awaiting orders offers From Systems…, which opens the Systems window to send
// it; closing that window without choosing leaves the prompt; choosing sends it.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('prompt-systems');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1000);
  const sent = await page.evaluate(() => {
    // one autoplayed turn picks research (an open research prompt would hide the ship prompt)
    window.__stel.endTurns(1);
    const s = window.__stel.state();
    for (const x of Object.values(s.fleets)) { x.auto = undefined; }
    const f = Object.values(s.fleets).find((x) => x.at && x.ships.some((y) => y.cls === 'probe')) ?? Object.values(s.fleets).find((x) => x.at);
    const here = s.systems[f.at];
    const near = Object.values(s.systems).filter((x) => x.id !== here.id && s.civ.known[x.id]).map((x) => ({ x, d: Math.hypot(x.pos.x - here.pos.x, x.pos.y - here.pos.y, x.pos.z - here.pos.z) })).sort((a, b) => a.d - b.d)[0].x;
    window.__stel.orderFleet(f.id, near.id, 'survey');
    return { id: f.id, name: f.name, to: near.name };
  });
  console.log('sent', JSON.stringify(sent));
  let prompt = false;
  for (let i = 0; i < 12 && !prompt; i++) {
    // close whatever is open, then end the turn
    for (let k = 0; k < 4; k++) {
      const cont = await page.$('.modal button:has-text("Continue"), .modal .btn.choice');
      if (!cont) break;
      await cont.click().catch(() => {});
      await page.waitForTimeout(250);
    }
    await page.keyboard.press('Escape');
    await page.click('button.endturn').catch(() => {});
    await page.waitForTimeout(900);
    // research done: pick the next, or its prompt would hide the ship's
    const rp = await page.$('.rp-option');
    if (rp) { await rp.click().catch(() => {}); await page.waitForTimeout(400); }
    prompt = await page.evaluate((name) => !!document.querySelector('.ship-prompt') && document.querySelector('.ship-prompt').textContent.includes(name), sent.name);
    const dbg = await page.evaluate((id) => { const s = window.__stel.state(); const f = s.fleets[id]; return { turn: s.turn, at: f?.at, to: f?.to, order: f?.order, auto: f?.auto, research: s.civ.researching, modal: document.querySelector('.modal')?.textContent?.slice(0, 60) ?? null, sp: document.querySelector('.ship-prompt')?.textContent?.slice(0, 60) ?? null, rp: !!document.querySelector('.research-prompt:not(.ship-prompt)') }; }, sent.id);
    console.log('dbg', JSON.stringify(dbg));
  }
  await ck.shot('prompt-debug.png');
  check(prompt, `the ship prompt appears for ${sent.name}`);
  const btn = await page.$('.ship-prompt button:has-text("From Systems")');
  check(!!btn, 'it offers From Systems…');
  if (btn) {
    await btn.click();
    await page.waitForTimeout(700);
    const win = await page.evaluate(() => ({ text: document.querySelector('.modal')?.textContent ?? '', sends: document.querySelectorAll('.send-here').length }));
    check(win.text.includes(`Where should ${sent.name} go?`) && win.sends > 0, `the Systems window opens to send it (${win.sends} Send buttons)`);
    await ck.shot('prompt-systems.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const still = await page.evaluate(() => !!document.querySelector('.ship-prompt') && !document.querySelector('.send-here'));
    check(still, 'closing the window without choosing leaves the prompt');
    await page.click('.ship-prompt button:has-text("From Systems")');
    await page.waitForTimeout(600);
    await page.click('.send-here >> nth=0');
    await page.waitForTimeout(700);
    const after = await page.evaluate((id) => ({ to: window.__stel.state().fleets[id]?.to ?? null, prompt: !!document.querySelector('.ship-prompt') }), sent.id);
    check(!!after.to, 'Send gave it an order');
    check(!after.prompt || !(await page.evaluate((name) => document.querySelector('.ship-prompt')?.textContent.includes(name), sent.name)), 'its prompt is gone');
  }
  await finish('PROMPT SYSTEMS', ck);
});
