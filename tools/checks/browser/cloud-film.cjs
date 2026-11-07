// Browser check: the cloud out of nothing has its own film (7 Nov; the player: "a real light in the
// Dark, once, late, with its own film"; sim/fluctuations.ts). A turn that ends with its card, "A
// Light in the Dark", waiting plays the film first, the card behind it, and marks the game
// (civ.flags.cloud_film); skipped, the card follows. The film is among the films after.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('cloud-film', { films: true });
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1200);
  const mark0 = await page.evaluate(() => window.__stel.state().civ.flags.cloud_film);
  check(mark0 === undefined, 'a new game has no mark');
  // its card left waiting as the turn ends
  await page.evaluate(() => {
    const s = window.__stel.state();
    s.civ.pending.push({ uid: `cloud${s.turn}`, defId: 'cloud_light', data: { systemId: s.civ.homeSystemId } });
  });
  await page.locator('button.endturn').click({ timeout: 8000 });
  const film = await page
    .waitForFunction(() => document.querySelector('.film-screen')?.getAttribute('aria-label') ?? null, null, { timeout: 20000, polling: 100 })
    .then((h) => h.jsonValue(), () => null);
  check(film === 'Film: A Light in the Dark', `the cloud plays its film (${film})`);
  await page.waitForTimeout(1500);
  const during = await page.evaluate(() => ({ card: !!document.querySelector('.event-title'), mark: window.__stel.state().civ.flags.cloud_film, turn: window.__stel.state().turn }));
  check(!during.card, 'its card waits behind the film');
  check(during.mark === during.turn, `the game is marked (cloud_film ${during.mark})`);
  await ck.shot('cloud-film.png');
  await page.locator('.film-screen .film-skip').click();
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => ({ film: !!document.querySelector('.film-screen'), title: document.querySelector('.event-title')?.textContent ?? '' }));
  check(!after.film && /A Light in the Dark/i.test(after.title), `skipped, its card follows (${after.title})`);
  const seen = await page.evaluate(() => window.__stel.filmList().cloud);
  check(seen === 'A Light in the Dark', 'it is among the films');
  await finish('CLOUD FILM', ck);
});
