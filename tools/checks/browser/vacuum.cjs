// Browser check: the vacuum as a hidden fate (7 Nov; vacuum.ts). New Game asks "What of the
// vacuum?": Stable (the default, the game as it was), Unknown, Metastable or Landscape, each with
// its tip. An unknown vacuum puts the Vacuum Question in the research grid (none where it was
// chosen); a known metastable one in the Dark Era gives a forecast of its chance this turn.
const { check, start, finish, run } = require('../lib.cjs');

run(async () => {
  const ck = await start('vacuum', { width: 1400, height: 900 });
  const { page } = ck;
  await page.locator('.menu .btn', { hasText: /^New game$/ }).click();
  await page.waitForTimeout(500);
  const field = page.locator('.field', { hasText: /^What of the vacuum\?/ });
  const text = (await field.count()) ? await field.textContent() : '';
  check(/Stable/.test(text) && /Unknown/.test(text) && /Metastable/.test(text) && /Landscape/.test(text), `New Game asks what of the vacuum: ${text.replace(/\s+/g, ' ').slice(0, 80)}`);
  const dflt = await field.locator('.btn.primary').textContent();
  check(/Stable/.test(dflt), `Stable is the default (${dflt})`);
  const tip = await field.locator('.btn', { hasText: 'Metastable' }).getAttribute('data-tip');
  check(/no warning and no defence/.test(tip ?? ''), `its tips say what each means ("${(tip ?? '').slice(0, 70)}…")`);
  await field.locator('.btn', { hasText: 'Unknown' }).click();
  await page.locator('.field', { hasText: /^Guide/ }).locator('.btn', { hasText: 'No guide' }).click();
  await ck.shot('vacuum-setup.png');
  await page.locator('.btn', { hasText: /^Begin$/ }).first().click();
  await page.waitForTimeout(1500);
  await page.locator('.crossing .btn', { hasText: /^Begin$/ }).click().catch(() => {});
  await page.waitForTimeout(800);
  check((await page.evaluate(() => window.__stel.state().settings.vacuum)) === 'unknown', 'the game holds the choice');
  // the research grid: the Vacuum Question while it is unknown
  const names = async () => {
    await page.keyboard.press('Escape');
    await page.locator('.rail button[aria-label^="Research"]').click();
    await page.waitForTimeout(500);
    return page.evaluate(() => [...document.querySelectorAll('.techgrid .tech .nm')].map((x) => x.textContent.trim()));
  };
  check((await names()).includes('The Vacuum Question'), 'unknown: the Vacuum Question is in the grid');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(800);
  check(!(await names()).includes('The Vacuum Question'), 'chosen stable: nothing to find out, no Vacuum Question');
  await page.keyboard.press('Escape');
  // a known metastable vacuum in the Dark Era: its forecast, the chance this turn
  await page.evaluate(() => {
    window.__stel.newGame({ seed: 1000, vacuum: 'higgs' });
    const s = window.__stel.state();
    s.era = 'dark';
    s.years = Math.pow(10, 100.5);
    s.eta = Math.pow(10, 2.6);
    window.__stel.endTurns(1);
  });
  await page.waitForTimeout(800);
  const f = await page.evaluate(() => window.__stel.state().civ.forecasts.find((x) => x.kind === 'vacuum') ?? null);
  check(!!f && /^The vacuum may fall: \d+% this turn$/.test(f.title) && /within five turns/.test(f.text), `its forecast: "${f?.title}"`);
  const shown = await page.evaluate(() => document.querySelector('.forecast-list')?.textContent ?? '');
  check(/The vacuum may fall/.test(shown), 'and it is shown among the forecasts');
  await ck.shot('vacuum-forecast.png');
  await finish('VACUUM', ck);
});
