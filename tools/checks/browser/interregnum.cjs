// Browser check: the Twilight Interregnum (1 Nov, the player: "a sort of a prequel mode where you
// start earlier, from 1e12 years", "For the next and only for the next version, not for the main
// one", "twilight interregnum mode should be optional", "make sure the twilight galaxy looks
// livelier and brighter than the dusk one").
// - At /next/ (here: a local server) New Game offers Begin: At the Long Dusk (the default) or In the
//   Twilight Interregnum; at the main address (here `?main`) it does not.
// - Begun in it: its own words, then turn 1 at 10¹² years, η 12, under its name, the Chronometer's
//   ruler beginning with it; its galaxy brighter than the Dusk's, with its nebulae drawn: a few,
//   the rest of the gas thin and dark, not drawn as clouds (1 Nov: "nebulas should be kind of rare").
// - A nebula, thin gas and a young star in the system view, named for what they are; the nebula a
//   cloud, drawn by the view's march through it (nebulaCloud.ts).
// - Its save is listed at /next/, and not at the main address.
const { check, start, finish, run } = require('../lib.cjs');

run(async () => {
  const ck = await start('interregnum', { width: 1400, height: 900 });
  const { page } = ck;
  const toSetup = async (p) => {
    await p.locator('.menu .btn', { hasText: /^New game$/ }).click();
    await p.waitForTimeout(500);
  };
  await toSetup(page);
  const choice = page.locator('.field', { hasText: /^Begin/ });
  check((await choice.count()) === 1 && /At the Long Dusk/.test(await choice.textContent()) && /In the Twilight Interregnum/.test(await choice.textContent()), 'New Game offers Begin: the Dusk or the Interregnum');
  const dflt = await choice.locator('.btn.primary').textContent();
  check(/At the Long Dusk/.test(dflt), `the Dusk is the default (${dflt})`);
  await choice.locator('.btn', { hasText: 'In the Twilight Interregnum' }).click();
  await page.waitForTimeout(300);
  check(/The Twilight Interregnum/.test(await page.locator('.menu h1').textContent()) && (await page.locator('label[for="home-name"]').textContent()) === 'Your world', 'chosen: the title is the Interregnum’s, and the world not yet a dying one');
  await ck.shot('interregnum-setup.png');
  // the guide off, then Begin
  await page.locator('.field', { hasText: /^Guide/ }).locator('.btn', { hasText: 'No guide' }).click();
  await page.locator('.btn', { hasText: /^Begin$/ }).first().click();
  await page.waitForTimeout(1500);
  const intro = await page.evaluate(() => document.querySelector('.crossing')?.textContent ?? '');
  check(/The Twilight Interregnum/.test(intro) && /trillion years after the first light/.test(intro), `its own words first (${intro.slice(0, 80)})`);
  await page.locator('.crossing .btn', { hasText: /^Begin$/ }).click();
  await page.waitForTimeout(1200);
  const st = await page.evaluate(() => {
    const s = window.__stel.state();
    return { era: s.era, years: s.years, inter: !!s.settings.interregnum, chrono: document.querySelector('.chrono')?.textContent ?? '' };
  });
  check(st.era === 'interregnum' && st.years === 1e12 && st.inter, `begun at 10¹² years (${st.era}, ${st.years})`);
  check(/THE TWILIGHT INTERREGNUM|The Twilight Interregnum/i.test(st.chrono) && /η\s*12\.0000/.test(st.chrono) && /1 trillion years since the Big Bang/.test(st.chrono) && /0 STELLIFEROUS|0 Stelliferous/i.test(st.chrono), `the Chronometer: its name, η 12, its segment first`);
  await ck.shot('interregnum-galaxy.png');
  // brighter than the Dusk: the galaxy's light, and its nebulae drawn
  const look = await page.evaluate(() => {
    const g = window.__stel.engine().galaxy;
    const sys = Object.values(window.__stel.state().systems);
    return { bright: g.dustMat.uniforms.uBright.value, tint: g.dustMat.uniforms.uTint.value.r, nebulae: g.nebulae.size, gathered: sys.filter((x) => x.primary.kind === 'nebula' && x.primary.condenseAt === undefined).length, thin: sys.filter((x) => x.primary.condenseAt !== undefined).length };
  });
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1200);
  const duskLook = await page.evaluate(() => {
    const g = window.__stel.engine().galaxy;
    return { bright: g.dustMat.uniforms.uBright.value, tint: g.dustMat.uniforms.uTint.value.r, nebulae: g.nebulae.size };
  });
  check(look.bright * look.tint > 1.5 * duskLook.bright * duskLook.tint && duskLook.nebulae === 0, `its galaxy brighter than the Dusk’s (${(look.bright * look.tint).toFixed(2)} vs ${(duskLook.bright * duskLook.tint).toFixed(2)})`);
  // (a few, or none at all in some galaxies: about three in a galaxy on average)
  check(look.nebulae <= 8 && look.nebulae === look.gathered && look.thin > 5 * Math.max(1, look.nebulae), `${look.nebulae} nebulae drawn, the gas of ${look.thin} more stars thin and dark, not drawn as clouds`);
  // a nebula and a young star, up close
  await page.evaluate(() => window.__stel.newGame({ seed: 1000, interregnum: true }));
  await page.waitForTimeout(1200);
  const ids = await page.evaluate(() => {
    const s = window.__stel.state();
    const all = Object.values(s.systems);
    const neb = all.find((x) => x.primary.kind === 'nebula' && x.primary.condenseAt === undefined);
    const thin = all.find((x) => x.primary.condenseAt !== undefined);
    const young = all.find((x) => x.primary.kind === 'young_star' && x.primary.cls !== 'B') ?? all.find((x) => x.primary.kind === 'young_star');
    s.civ.known[neb.id] = 2;
    s.civ.known[thin.id] = 2;
    s.civ.known[young.id] = 2;
    window.__stel.refresh();
    return { neb: neb.id, thin: thin.id, young: young.id };
  });
  for (const [what, id, re] of [['nebula', ids.neb, /Nebula/], ['thin gas', ids.thin, /Thin gas/], ['young star', ids.young, /dwarf \([KG]\)|star \([FA]\)|giant \(B\)/]]) {
    await page.evaluate((x) => window.__stel.select('system', x), id);
    await page.evaluate((x) => window.__stel.engine().showSystem(x), id);
    // (until the view has faded over to it: slow in a software renderer)
    await page.waitForFunction((x) => window.__stel.engine().view === 'system' && window.__stel.engine().system.systemId === x, id, { timeout: 60000, polling: 250 });
    await page.waitForTimeout(1500);
    const panel = await page.evaluate(() => document.querySelector('.drawer')?.textContent ?? '');
    check(re.test(panel) && !/WD \d/.test(panel.slice(0, 60)), `a ${what} in the system view, named for what it is (${panel.slice(0, 70)})`);
    if (what !== 'young star') {
      // a cloud, marched through, drawn before the rest of the see-through things
      // (in a scene of its own, drawn into a buffer, laid over the stars by a quad in the view's group)
      const cloud = await page.evaluate(() => {
        const v = window.__stel.engine().system;
        const m = v.cloud;
        let quad = null;
        v.group.traverse((o) => {
          if (o.material?.uniforms?.uTex) quad = o.renderOrder;
        });
        return m ? { inScene: v.cloudScene.children.includes(m), thin: m.material.uniforms.uCore.value === 0, steps: m.material.defines.STEPS, quad, buffer: v.cloudTarget ? [v.cloudTarget.width, v.cloudTarget.height] : null } : null;
      });
      check(!!cloud && cloud.inScene && cloud.quad === -1 && cloud.thin === (what === 'thin gas') && cloud.steps >= 10 && !!cloud.buffer, `drawn as a cloud (${JSON.stringify(cloud)})`);
    }
    await ck.shot(`interregnum-${what.replace(' ', '-')}.png`);
  }
  // its save: listed here, not at the main address
  await page.evaluate(() => (window.__stel.state().civ.pending.length = 0));
  await page.keyboard.press('Escape');
  await page.locator('button[aria-label="Save and load"]').click();
  await page.waitForTimeout(500);
  await page.locator('input[aria-label="Name of the new save"]').fill('Twilight slot');
  await page.locator('.modal button', { hasText: 'Save to a new slot' }).click();
  await page.waitForTimeout(800);
  const here = await page.evaluate(() => [...document.querySelectorAll('.modal .save-slots .list-item')].map((x) => x.textContent).join(' | '));
  check(/Twilight slot/.test(here), 'its save is listed here');
  // the main address, as it were (the same page: a second one in this browser can hang as it loads)
  await page.keyboard.press('Escape');
  const main = page;
  await main.goto(page.url().replace(/\?.*$/, '') + '?main&nofilms', { timeout: 90000 });
  await main.waitForTimeout(1500);
  await main.locator('.menu .btn', { hasText: /^New game$/ }).click();
  await main.waitForTimeout(500);
  check((await main.locator('.field', { hasText: /^Begin/ }).count()) === 0, 'at the main address New Game offers no such choice');
  await main.locator('.btn', { hasText: /^Back$/ }).click();
  await main.waitForTimeout(300);
  await main.locator('.menu .btn', { hasText: /Save|Load/ }).first().click();
  await main.waitForTimeout(600);
  const there = await main.evaluate(() => document.querySelector('.modal')?.textContent ?? '');
  check(!/Twilight slot/.test(there), 'and its save is not listed there');
  await main.screenshot({ path: `${ck.out}/interregnum-main-saves.png` });
  await finish('INTERREGNUM', ck);
});
