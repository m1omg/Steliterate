// Browser check: the turn's fights in a window of their own (26 Oct, the player: "there also should
// be popups for combat, rn often you defeat a swarm or get your fleet destroyed with just tiny text
// footnote in events"). Two Wardens beat off part of a swarm sent after them, and a lone probe is
// caught by another: End turn opens "Combat", the loss first, marked red, the win green, each with
// Look; Look goes to the ship; a turn with no fight opens nothing.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('combat-report');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1000);
  const ids = await page.evaluate(() => {
    const s = window.__stel.state();
    const settled = new Set(Object.values(s.colonies).map((c) => c.systemId));
    const free = Object.values(s.systems).filter((x) => !x.gone && !x.special && !settled.has(x.id));
    const [a, b] = [free[0], free[free.length - 1]];
    s.swarms = {};
    s.swarms.w1 = { id: 'w1', systemId: a.id, from: null, to: null, traveled: 0, distance: 0, size: 0.5, awake: true, tamed: false, appetite: 1, prey: 'spear' };
    s.swarms.w2 = { id: 'w2', systemId: b.id, from: null, to: null, traveled: 0, distance: 0, size: 1.6, awake: true, tamed: false, appetite: 1, prey: 'lamp' };
    s.fleets.spear = { id: 'spear', owner: s.player, name: 'Spear', ships: [{ cls: 'warden', hp: 10 }, { cls: 'warden', hp: 10 }], at: a.id, from: null, to: null, traveled: 0, distance: 0, order: 'hold' };
    s.fleets.lamp = { id: 'lamp', owner: s.player, name: 'Lamp', ships: [{ cls: 'probe', hp: 2 }], at: b.id, from: null, to: null, traveled: 0, distance: 0, order: 'hold' };
    s.civ.known[a.id] = 2;
    s.civ.known[b.id] = 2;
    s.civ.flags.first_swarm = -1;
    s.civ.pending.length = 0;
    window.__stel.refresh();
    return { a: a.name, b: b.name };
  });
  await page.locator('button.endturn').click({ timeout: 8000 });
  await page.waitForTimeout(1500);
  const report = await page.evaluate(() => {
    const m = document.querySelector('.modal[aria-label="Combat"]');
    return m
      ? {
          eyebrow: m.querySelector('.eyebrow')?.textContent ?? '',
          lines: [...m.querySelectorAll('.combat-line')].map((r) => ({ tone: r.classList.contains('bad') ? 'bad' : r.classList.contains('good') ? 'good' : '', text: r.textContent, look: !!r.querySelector('button') })),
        }
      : null;
  });
  console.log(`  ${report ? `${report.eyebrow}: ${report.lines.map((l) => `[${l.tone}] ${l.text.slice(0, 70)}`).join(' | ')}` : 'no report'}`);
  check(!!report, 'End turn opens the Combat window');
  const won = report?.lines.find((l) => /Spear/.test(l.text) && /beat it off/.test(l.text));
  const lost = report?.lines.find((l) => /Lamp/.test(l.text) && /caught/.test(l.text));
  check(won?.tone === 'good' && lost?.tone === 'bad', 'the Wardens’ win marked green, the probe’s loss red');
  check(report?.lines[0] === lost, 'the loss first');
  check(!!won?.look && !!lost?.look, 'each with Look');
  check(/1 won, 1 lost/.test(report?.eyebrow ?? ''), `its head counts them (${report?.eyebrow})`);
  const behind = await page.evaluate(() => !document.querySelector('.event-modal, .modal.event'));
  check(behind, 'the turn’s events wait behind it');
  await ck.shot('combat-report.png');
  await page.locator('.modal .combat-line', { hasText: 'Spear' }).locator('button').click();
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({ open: !!document.querySelector('.modal[aria-label="Combat"]'), head: document.querySelector('.drawer h2')?.textContent ?? '' }));
  check(!after.open && after.head === 'Spear', `Look goes to the ship (${after.head})`);
  // a quiet turn: nothing
  await page.evaluate(() => {
    const s = window.__stel.state();
    s.swarms = {};
    s.civ.pending.length = 0;
    window.__stel.refresh();
  });
  await page.keyboard.press('Escape');
  await page.locator('button.endturn').click({ timeout: 8000 });
  await page.waitForTimeout(1500);
  check(!(await page.evaluate(() => !!document.querySelector('.modal[aria-label="Combat"]'))), 'a turn with no fight opens nothing');
  await finish('COMBAT REPORT', ck);
});
