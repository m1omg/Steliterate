// Browser check: the research projects that exist only under one fate of matter. Until the fate is
// known (the Proton Question, a fate chosen at the start, or the universe showing it) each shows as
// "???", saying the Proton Question would tell; once it is known, the projects of the other fates
// are gone from the grid (they will never exist in this universe), and none is left as "???"
// with a hint that no longer helps (seen 11 Oct, after the Proton Question).
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('research-fate');
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1000);
  const grid = () =>
    page.evaluate(() => {
      const cells = [...document.querySelectorAll('.techgrid .tech')];
      return {
        hidden: cells.filter((c) => c.querySelector('.nm')?.textContent?.trim() === '???').map((c) => c.getAttribute('data-tip') ?? ''),
        names: cells.map((c) => c.querySelector('.nm')?.textContent?.trim() ?? ''),
      };
    });
  const open = async () => {
    await page.keyboard.press('Escape');
    await page.locator('.rail button[aria-label^="Research"]').click();
    await page.waitForTimeout(500);
  };
  await open();
  const before = await grid();
  check(before.hidden.length === 3 && before.hidden.every((t) => /Proton Question/.test(t)), `before the fate is known, its projects show as ??? with the hint (${before.hidden.length})`);
  await ck.shot('research-before.png');
  // the Proton Question answered
  const fate = await page.evaluate(() => {
    const s = window.__stel.state();
    s.civ.techs.push('proton_question');
    window.__stel.refresh();
    return s.fate ?? (s.protonsDecay ? 'decay' : 'stable');
  });
  await open();
  const after = await grid();
  check(after.hidden.length === 0, `once it is known, no ??? is left (${after.hidden.length})`);
  check(after.names.length === before.names.length - 2, `the other fates' projects are gone, this one's shown (${before.names.length} → ${after.names.length}, fate ${fate})`);
  await ck.shot('research-after.png');
  await finish('RESEARCH FATE', ck);
});
