// Browser check: terraforming. With the research, a settlement on bare rock by a red dwarf can
// build Orbital Mirrors and Atmosphere Works, shown with the world's own structures, each saying how
// far it would raise habitability here; Biosphere Seeding waits, and says why. Once both stand and
// life is seeded, the world's panel shows its habitability as terraformed, its seeded life and
// the Kin room it makes.
const { check, start, finish, run } = require('../lib.cjs');

const rows = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.list-item.build')].map((r) => ({
      text: r.textContent.replace(/\s+/g, ' ').trim(),
      disabled: r.classList.contains('disabled'),
      world: !!r.querySelector('.kind-icon.kind-world, .kind-world'),
    })),
  );

run(async () => {
  const ck = await start('terraform', { seed: 1000 });
  const { page } = ck;
  const worlds = await page.evaluate(() => {
    window.__stel.endTurns(10);
    const s = window.__stel.state();
    if (!s.civ.techs.includes('terraforming')) s.civ.techs.push('terraforming');
    s.pending.length = 0;
    s.swarms = {};
    s.civ.matter = 500;
    return Object.values(s.bodies)
      .filter((b) => b.kind === 'barren' && !b.colonyId && !b.dissolved && !b.rogue && s.systems[b.systemId].primary.kind === 'red_dwarf')
      .map((b) => b.id)
      .slice(0, 12);
  });
  // a settlement on bare rock, as founding one makes it; the first where mirrors would help
  let found = null;
  for (const id of worlds) {
    await page.evaluate((id) => {
      const s = window.__stel.state();
      const b = s.bodies[id];
      for (const [cid, c] of Object.entries(s.colonies)) if (cid === 'c_tf') { s.bodies[c.bodyId].colonyId = null; delete s.colonies[cid]; }
      s.colonies.c_tf = {
        id: 'c_tf', bodyId: id, systemId: b.systemId, name: b.name, founded: s.turn,
        pops: { kin: 2, echoes: 0, chorus: 0, lattice: 0, coldminds: 0 }, growth: { kin: 0, echoes: 0, chorus: 0, lattice: 0, coldminds: 0 },
        cryo: 0, structures: {}, queue: [], focus: 'balanced', overdrive: false, damage: 0, starving: 0,
      };
      b.colonyId = 'c_tf';
      s.civ.known[b.systemId] = 2;
      window.__stel.refresh();
      window.__stel.select('body', id);
    }, id);
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: /^Build/ }).first().click();
    await page.waitForTimeout(700);
    const r = await rows(page);
    const m = r.find((x) => x.text.startsWith('Orbital Mirrors'));
    if (m && !m.disabled) {
      found = { id, r };
      break;
    }
  }
  check(!!found, `a settlement on bare rock where mirrors would help (${found ? found.id : 'none of ' + worlds.length})`);
  if (!found) return finish('TERRAFORM UI', ck);
  const mirrors = found.r.find((x) => x.text.startsWith('Orbital Mirrors'));
  const works = found.r.find((x) => x.text.startsWith('Atmosphere Works'));
  const seeding = found.r.find((x) => x.text.startsWith('Biosphere Seeding'));
  console.log('mirrors:', mirrors.text.slice(0, 200));
  check(/Habitability 0% → \d+% here \(warmest ground \d+ K\)/.test(mirrors.text) && /Biosphere Seeding/.test(mirrors.text), 'Orbital Mirrors says how far it raises habitability here, and that room needs life');
  check(!!works && !works.disabled && /Habitability 0% → \d+% here/.test(works.text) && /Brings water in with the air/.test(works.text), 'Atmosphere Works too, and that it brings water');
  check(!!seeding && seeding.disabled && /Too harsh for anything to take hold/.test(seeding.text), `Biosphere Seeding waits, and says why (${seeding ? seeding.text.slice(-120) : 'missing'})`);
  check(mirrors.world && works.world && seeding.world, 'all three are shown with the world’s own structures');
  await ck.shot('terraform-build.png');
  // queue the mirrors from the list
  await page.locator('.list-item.build', { hasText: 'Orbital Mirrors' }).first().click();
  await page.waitForTimeout(500);
  const queued = await page.evaluate(() => window.__stel.state().colonies.c_tf.queue.map((q) => q.key));
  check(queued.includes('orbital_mirrors'), `queued (${queued.join(', ')})`);
  // Kin room before: bare rock has none
  const kinRow = () =>
    page.evaluate(() => {
      const r = [...document.querySelectorAll('.drawer .pop-row')].find((x) => /Kin/.test(x.textContent));
      return r ? r.querySelector('.mono')?.textContent.trim() ?? '' : '';
    });
  const ov = page.getByRole('button', { name: /^Overview/ }).first();
  if (await ov.count()) await ov.click();
  await page.waitForTimeout(600);
  const before = await kinRow();
  // both built, life seeded and spreading
  await page.evaluate((id) => {
    const s = window.__stel.state();
    const c = s.colonies.c_tf;
    c.queue = [];
    c.structures = { orbital_mirrors: 1, atmosphere_works: 1, biosphere_seeding: 1 };
    s.bodies[id].water = Math.max(s.bodies[id].water ?? 0, 0.1);
    s.bodies[id].vitality = 0.4;
    window.__stel.refresh();
    window.__stel.select('body', id);
  }, found.id);
  await page.waitForTimeout(800);
  const kv = await page.evaluate(() => {
    const out = {};
    for (const dt of document.querySelectorAll('.drawer dl.kv dt')) {
      const dd = dt.nextElementSibling;
      out[dt.textContent.trim()] = { text: dd?.textContent.trim() ?? '', tip: dd?.dataset.tip ?? '', cls: dd?.className ?? '' };
    }
    return out;
  });
  const hab = kv.Habitability ?? {};
  console.log('habitability:', hab.text, '|', hab.tip);
  check(/^\d+%, terraformed$/.test(hab.text) && hab.cls.includes('good'), `the settlement’s World shows its habitability terraformed (${hab.text})`);
  check(/^0% of its own, raised by Orbital Mirrors and Atmosphere Works: its warmest ground is \d+ K\./.test(hab.tip), 'its tooltip gives its own, what raised it and the warmth');
  const vit = kv.Vitality ?? {};
  check(vit.text === '40%' && /Seeded life is spreading: \+4% a turn, up to 80%/.test(vit.tip), `Vitality: ${vit.text}, ${vit.tip}`);
  const after = await kinRow();
  const cap = (t) => Number((t.split('/')[1] ?? '').replace(/[^0-9]/g, '') || 0);
  check(cap(after) > cap(before), `room for Kin: ${before} before, ${after} now`);
  await ck.shot('terraform-world.png');
  await finish('TERRAFORM UI', ck);
});
