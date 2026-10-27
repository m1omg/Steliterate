// Browser check: a game's first supernova has a film (26 Oct, the player: "this warrants a
// cutscene like the ages ones, make a kickass one pls :D", the first one each game, "and for old
// saves it should play on the next supernova that occurs"). A turn that ends with a supernova's
// card waiting plays the film first, its card behind it, and marks the game (civ.flags.sn_film);
// skipped, the card follows; the next supernova shows only its card. A save from before has no
// mark, so its next supernova plays it, as the first does here.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('supernova-film', { films: true });
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1200);
  // a supernova's card left waiting as the turn ends (set without redrawing, so End turn is still there to press)
  const nova = () =>
    page.evaluate(() => {
      const s = window.__stel.state();
      const sys = Object.values(s.systems).find((x) => !x.gone && x.primary.kind === 'white_dwarf') ?? Object.values(s.systems)[1];
      s.civ.pending.push({ uid: `nova${s.turn}`, defId: 'supernova', data: { systemId: sys.id } });
    });
  const mark0 = await page.evaluate(() => window.__stel.state().civ.flags.sn_film);
  check(mark0 === undefined, 'a new game (or a save from before) has no mark');
  await nova();
  await page.locator('button.endturn').click({ timeout: 8000 });
  const film = await page
    .waitForFunction(() => document.querySelector('.film-screen')?.getAttribute('aria-label') ?? null, null, { timeout: 20000, polling: 100 })
    .then((h) => h.jsonValue(), () => null);
  check(film === 'Film: Supernova', `the turn's supernova plays the film (${film})`);
  await page.waitForTimeout(1500);
  const during = await page.evaluate(() => ({ card: !!document.querySelector('.event-title'), mark: window.__stel.state().civ.flags.sn_film, turn: window.__stel.state().turn }));
  check(!during.card, 'its card waits behind the film');
  check(during.mark === during.turn, `the game is marked (sn_film ${during.mark})`);
  await ck.shot('supernova-film.png');
  await page.locator('.film-screen .film-skip').click();
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => ({ film: !!document.querySelector('.film-screen'), title: document.querySelector('.event-title')?.textContent ?? '' }));
  check(!after.film && /Supernova/i.test(after.title), `skipped, its card follows (${after.title})`);
  // answer it, then a second supernova: the card alone
  await page.evaluate(() => {
    window.__stel.state().civ.pending.length = 0;
    window.__stel.refresh();
  });
  await page.waitForTimeout(400);
  await nova();
  await page.locator('button.endturn').click({ timeout: 8000 });
  await page.waitForTimeout(2500);
  const second = await page.evaluate(() => ({ film: !!document.querySelector('.film-screen'), title: document.querySelector('.event-title')?.textContent ?? '' }));
  check(!second.film && /Supernova/i.test(second.title), `the next supernova shows only its card (${second.title})`);
  // the film is in the Codex's Films seen now
  const seen = await page.evaluate(() => window.__stel.filmList().supernova);
  check(seen === 'Supernova', 'it is among the films');
  await finish('SUPERNOVA FILM', ck);
});
