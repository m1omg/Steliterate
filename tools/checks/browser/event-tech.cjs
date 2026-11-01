// Browser check: an event's choices need their technology (31 Oct, the player: "The types of random
// Events should be unlocked by technology. (how does one harvest a comet without ships in-systems
// or an orbital shipyard?)"). A comet's window names the star it falls through and who can meet it;
// without the technologies, shepherding and mining are greyed out, each saying what it needs, and
// studying it is not; with Orbital Industry, mining it can be chosen, and pays.
const { check, start, finish, run } = require('../lib.cjs');
run(async () => {
  const ck = await start('event-tech', { width: 1400, height: 1000 });
  const { page } = ck;
  await page.evaluate(() => window.__stel.newGame({ seed: 1000 }));
  await page.waitForTimeout(1200);
  const home = await page.evaluate(() => {
    const s = window.__stel.state();
    s.civ.techs = s.civ.techs.filter((t) => t !== 'orbital_industry' && t !== 'comet_shepherding');
    const sys = s.systems[s.colonies[s.civ.capitalId].systemId];
    s.civ.pending.push({ uid: 'ev_comet', defId: 'comet', data: { systemId: sys.id, n: 1 } });
    window.__stel.refresh();
    return sys.name;
  });
  await page.waitForTimeout(800);
  const read = () =>
    page.evaluate(() => ({
      open: !!document.querySelector('.modal.event'),
      text: document.querySelector('.modal.event .event-text')?.textContent ?? '',
      choices: [...document.querySelectorAll('.modal.event .btn.choice')].map((b) => ({ label: b.querySelector('span')?.textContent ?? '', hint: b.querySelector('.h')?.textContent ?? '', disabled: b.disabled })),
    }));
  const a = await read();
  check(a.open && a.text.includes(home) && /Our ships there can meet it|Shipyard there can send tugs/.test(a.text), `the comet falls through ${home}, and says who can meet it (${a.text.slice(0, 120)})`);
  check(a.choices.length === 3 && a.choices[0].disabled && /Needs Volatile Shepherding\.$/.test(a.choices[0].hint) && a.choices[1].disabled && /Needs Orbital Industry\.$/.test(a.choices[1].hint), `without the technologies, shepherding and mining are greyed out, each saying what it needs (${a.choices.map((c) => c.hint).join(' | ')})`);
  check(!a.choices[2].disabled && a.choices[2].label === 'Study it', `studying it is not (${a.choices[2].hint})`);
  await ck.shot('event-tech-locked.png');
  const m0 = await page.evaluate(() => {
    const s = window.__stel.state();
    s.civ.techs.push('orbital_industry');
    window.__stel.refresh();
    return s.civ.matter;
  });
  await page.waitForTimeout(500);
  const b = await read();
  check(b.choices[0].disabled && !b.choices[1].disabled && !/Needs/.test(b.choices[1].hint), `with Orbital Industry, mining it can be chosen (${b.choices[1].hint}); shepherding still waits`);
  await page.locator('.modal.event .btn.choice', { hasText: 'Mine it' }).click();
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({ matter: window.__stel.state().civ.matter, open: !!document.querySelector('.modal.event') }));
  check(!after.open && Math.abs(after.matter - (m0 + 40)) < 1e-6, `mined: matter ${m0} → ${after.matter}, the window closed`);
  await finish('EVENT TECH', ck);
});
