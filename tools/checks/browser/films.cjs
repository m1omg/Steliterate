// Browser check: the films (the new version, part 4). Beginning a game plays the Long Dusk's film
// before the age's own words: full screen, its words real text over the canvas, a Skip button with
// the focus; skipped, the age's introduction follows. The Codex keeps the films seen, to play
// again; Escape skips one there, back to the Codex. Enter under a film ends no turn. Off in
// Settings, a new game goes straight to the introduction. A film draws the same picture at the
// same moment whatever came before it: two seconds stepped at 30 and at 144 frames a second end
// on the same frame, and a moment drawn twice is the same. The other checks run without films.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('films', { films: true });
  const { page } = ck;
  // from the menu: New game, then Begin
  await page.locator('.menu .btn', { hasText: /^New game$/ }).click();
  await page.waitForTimeout(500);
  await page.locator('.btn', { hasText: /^Begin$/ }).first().click();
  await page.waitForTimeout(1200);
  const open = await page.evaluate(() => {
    const f = document.querySelector('.film-screen');
    return {
      film: !!f,
      label: f?.getAttribute('aria-label') ?? '',
      canvas: !!f?.querySelector('canvas.film-canvas'),
      lines: [...(f?.querySelectorAll('.film-line') ?? [])].filter((x) => !x.hidden).map((x) => x.textContent),
      focus: document.activeElement?.textContent?.trim() ?? '',
      turn: window.__stel.state()?.turn,
    };
  });
  await ck.shot('film-open.png');
  check(open.film && open.canvas && open.label === 'Film: The Long Dusk', `beginning a game plays the Long Dusk's film, full screen on its own canvas (${open.label})`);
  check(open.lines.some((x) => /STELITERATE · REEL I/.test(x)) && open.lines.some((x) => /^η \d/.test(x)), `its words are text over it: ${open.lines.join(' | ')}`);
  check(open.focus === 'Skip', `its Skip button has the focus (${open.focus})`);
  // the narration comes in as it plays
  await page.waitForTimeout(2600);
  const later = await page.evaluate(() => [...document.querySelectorAll('.film-screen .film-line.narration')].filter((x) => !x.hidden && Number(x.style.opacity) > 0.05).map((x) => x.textContent));
  check(later.length >= 1, `the narration comes in as it plays (${later.join(' | ')})`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({ film: !!document.querySelector('.film-screen'), intro: !!document.querySelector('.crossing[role="dialog"]'), turn: window.__stel.state()?.turn }));
  check(!after.film && after.intro && after.turn === open.turn, `Enter skips it, ending no turn (turn ${open.turn} → ${after.turn}), and the age's introduction follows`);
  await page.locator('.crossing .btn', { hasText: /^Begin$/ }).click();
  await page.waitForTimeout(400);
  // the Codex keeps it, to play again; Escape skips it, back to the Codex
  await page.evaluate(() => window.__stel.refresh());
  await page.keyboard.press('k');
  await page.waitForTimeout(500);
  await page.locator('.codex-nav .btn', { hasText: /^Films seen$/ }).click();
  await page.waitForTimeout(300);
  const listed = await page.locator('.codex-body .btn').allTextContents();
  check(listed.some((x) => /The Long Dusk/.test(x)), `the Codex lists the films seen (${listed.join(', ')})`);
  await page.locator('.codex-body .btn', { hasText: /The Long Dusk/ }).click();
  await page.waitForTimeout(800);
  const replay = await page.evaluate(() => !!document.querySelector('.film-screen'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  const back = await page.evaluate(() => ({ film: !!document.querySelector('.film-screen'), codex: !!document.querySelector('.codex-nav') }));
  check(replay && !back.film && back.codex, 'it plays again from there, and Escape skips it back to the Codex');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // the same moment draws the same picture, whatever was drawn before it
  const frames = await page.evaluate(() => {
    const steps = (fps) => Array.from({ length: 2 * fps + 1 }, (_, i) => 3 + i / fps);
    const a = window.__stel.filmFrames('dusk', steps(30));
    const b = window.__stel.filmFrames('dusk', steps(144));
    const again = window.__stel.filmFrames('dusk', [5, 1, 5]);
    return { a: a[a.length - 1], b: b[b.length - 1], again };
  });
  check(frames.a === frames.b && frames.again[0] === frames.again[2] && frames.again[0] !== frames.again[1], `two seconds at 30 and at 144 frames a second end on the same frame (${frames.a} / ${frames.b}), and a moment drawn twice is the same`);
  // every film draws, at its start, middle and end, without an error
  const all = await page.evaluate(() => Object.keys(window.__stel.filmList()).map((id) => [id, window.__stel.filmFrames(id, [0.2, 4, 9.6], 320, 180).length]));
  check(all.length >= 16 && all.every(([, n]) => n === 3), `all ${all.length} films draw from start to end`);
  // off in Settings: a new game goes straight to the introduction
  await page.reload();
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__stel.films(false));
  await page.locator('.menu .btn', { hasText: /^New game$/ }).click();
  await page.waitForTimeout(500);
  await page.locator('.btn', { hasText: /^Begin$/ }).first().click();
  await page.waitForTimeout(900);
  const off = await page.evaluate(() => ({ film: !!document.querySelector('.film-screen'), intro: !!document.querySelector('.crossing[role="dialog"]') }));
  check(!off.film && off.intro, 'with films off a new game goes straight to the introduction');
  await finish('FILMS', ck);
});
