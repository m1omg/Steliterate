// Browser check: End Turn plays the turn in slices (the new version, part 2a-6). With the CPU
// slowed as a phone's would be, the browser gets its turn while the game's turn is under way (a
// timer runs in the middle of it, as the synth's lookahead timer must); meanwhile End Turn is
// disabled and an order is refused (act); when it is done, the turn has advanced once and the game
// is seen from our side again.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('turn-slices', { seed: 8919 });
  const { page } = ck;
  await page.evaluate(() => window.__stel.endTurns(30));
  await page.waitForTimeout(500);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  const r = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const s = window.__stel.state();
        const turn = s.turn;
        const f = Object.values(s.fleets).find((x) => x.owner === s.player && x.at);
        const to = Object.values(s.systems).find((x) => f && x.id !== f.at && s.civ.known[x.id]);
        let ticks = 0;
        let busyTicks = 0;
        let refused = null;
        // the longest the timers waited while the turn was under way
        const t0 = performance.now();
        let last = t0;
        let gap = 0;
        const id = setInterval(() => {
          ticks++;
          const busy = !!document.querySelector('button.endturn')?.disabled;
          const now = performance.now();
          gap = Math.max(gap, now - last);
          last = now;
          if (busy) {
            busyTicks++;
            // an order in the middle of the turn: refused
            if (refused === null && f && to) refused = window.__stel.orderFleet(f.id, to.id, 'move') === false && window.__stel.state().fleets[f.id].at === f.at;
          }
          const g = window.__stel.state();
          if (g.turn > turn && !busy) {
            clearInterval(id);
            resolve({ advanced: g.turn - turn, busyTicks, ticks, refused, ours: g.civ.id === g.player, wall: Math.round(now - t0), gap: Math.round(gap) });
          }
        }, 0);
        document.querySelector('button.endturn').click();
      }),
  );
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  console.log('slices', JSON.stringify(r));
  // (a breath waits for the timers due at least every 40 ms, turnflow.ts: a message to ourselves alone can run ahead of them)
  check(r.busyTicks > 0, `the browser had its turn while ours was under way (${r.busyTicks} timer ticks in the middle of its ${r.wall} ms; the timers waited ${r.gap} ms at most)`);
  check(r.refused === true, 'an order given in the middle of the turn is refused');
  check(r.advanced === 1 && r.ours, 'when it is done the turn has advanced once, and the game is seen from our side');
  await finish('TURN SLICES', ck);
});
