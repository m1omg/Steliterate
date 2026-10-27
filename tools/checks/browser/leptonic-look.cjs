// Browser check: the look of what is not matter (the new version, part 3-7). After the end of
// matter a leptonic settlement in a black hole's Deep is drawn as its fields (filaments, a
// standing wave, motes, a current loop for each Field Store, a cage for Burst Catchers), with
// fewer of them on Low; one written into a horizon rides the hole's photon ring; a Bastion Shell
// is a cage of field lines round its hole; the positronium lies across the system as faint
// ellipses while it lasts; the galaxy map gives each form's settlement a ring of its own. During
// the Thinning what is still made of matter dissolves into motes; where matter is stable, past
// 10^1500 years, the worlds and dead stars are iron. Everything moves on elapsed time only: the
// same frame after the same time at 30 and at 144 frames a second.
const { check, start, finish, run } = require('../lib.cjs');

/** A new game (seed 1000, the neighbours asleep), set up in the page by `fn` (a string of its body, given s and helpers). */
async function scene(page, fate, body) {
  await page.evaluate((f) => window.__stel.newGame({ seed: 1000, protonFate: f, civsAsleep: true }), fate);
  await page.waitForTimeout(600);
  return page.evaluate(
    new Function(
      'arg',
      `const s = window.__stel.state();
       for (const k of Object.keys(s.flags)) if (k.startsWith('tut')) delete s.flags[k];
       const holes = Object.values(s.systems).filter((x) => (x.primary.kind === 'black_hole' || x.primary.kind === 'smbh') && !x.gone);
       const deepOf = (sys) => s.bodies[sys.bodies.find((id) => s.bodies[id] && s.bodies[id].kind === 'deep')];
       // move a settlement of ours to another body, as a drift or a migration would
       const moveTo = (c, b) => {
         if (s.bodies[c.bodyId]) s.bodies[c.bodyId].colonyId = null;
         c.bodyId = b.id;
         c.systemId = b.systemId;
         c.name = b.name;
         b.colonyId = c.id;
         s.civ.known[b.systemId] = 2;
       };
       // the end of matter, as endOfMatter leaves it: every system but the holes gone, every world dissolved
       const endMatter = () => {
         for (const x of Object.values(s.systems)) if (x.primary.kind !== 'black_hole' && x.primary.kind !== 'smbh') { x.primary.kind = 'void'; x.primary.lum = 0; x.gone = true; }
         for (const b of Object.values(s.bodies)) if (b.kind !== 'deep') b.dissolved = true;
         s.flags.matter_gone = s.turn;
       };
       const c = s.colonies[s.civ.capitalId];
       const out = (${body})();
       window.__stel.refresh();
       return out;`,
    ),
    null,
  );
}

/**
 * Into a system's view (waiting until it is there), close to one of its bodies if given, and a
 * moment there for the camera to settle. Returns what the view drew (SystemView.look).
 */
async function look(page, systemId, bodyId = null, ms = 2600) {
  const there = (id) => {
    const e = window.__stel.engine();
    return e.view === 'system' && e.system.systemId === id;
  };
  // (out to the galaxy first, so the camera comes in as it does in play)
  if (await page.evaluate(() => window.__stel.engine().view === 'system')) {
    await page.evaluate(() => window.__stel.engine().showGalaxy());
    await page.waitForFunction(() => window.__stel.engine().view === 'galaxy', null, { timeout: 20000 });
  }
  await page.evaluate((id) => window.__stel.engine().showSystem(id), systemId);
  await page.waitForFunction(there, systemId, { timeout: 20000 });
  // (selected as a click selects it: the panel, and the camera flying in to follow it)
  if (bodyId)
    await page.evaluate((id) => {
      window.__stel.select('body', id);
      window.__stel.engine().select(`body:${id}`);
    }, bodyId);
  await page.waitForTimeout(ms);
  return page.evaluate(() => ({ ...window.__stel.engine().system.look }));
}

/** Step back to see the whole system (letting go of what was followed), and a moment for the camera. */
async function whole(page, ms = 2200) {
  await page.evaluate(() => {
    window.__stel.select('system', window.__stel.engine().system.systemId);
    window.__stel.engine().select(null);
    window.__stel.engine().frameSystem();
  });
  await page.waitForTimeout(ms);
}

run(async () => {
  const ck = await start('leptonic-look');
  const { page } = ck;
  const quality = (q) => page.evaluate((x) => window.__stel.engine().setQuality(x), q);

  // after the end of matter (protons decay): a leptonic vault at one hole, minds written into another's horizon
  const at = await scene(
    page,
    'decays',
    `() => {
      s.era = 'blackhole';
      s.eta = 50;
      s.years = 1e50;
      endMatter();
      const [a, b] = holes;
      moveTo(c, deepOf(a));
      c.form = 'leptonic';
      for (const k of Object.keys(c.pops)) c.pops[k] = 0;
      c.pops.echoes = 6;
      c.pops.coldminds = 4;
      c.cryo = 0;
      c.structures = { lepton_substrate: 2, cold_vault: 1, reserve_vault: 2, superconducting_ring: 1, burst_catcher: 1, penrose_harvester: 1, bastion: 2 };
      c.queue = [];
      const h = structuredClone(c);
      h.id = c.id + 'h';
      h.structures = { penrose_harvester: 1 };
      h.form = 'horizon';
      s.colonies[h.id] = h;
      moveTo(h, deepOf(b));
      return { vault: a.id, horizon: b.id, colony: c.id, deep: c.bodyId, hdeep: h.bodyId };
    }`,
  );
  const tiers = {};
  for (const q of ['high', 'medium', 'low']) {
    await quality(q);
    tiers[q] = await look(page, at.vault, at.deep);
    await ck.shot(`vault-${q}.png`);
  }
  await whole(page);
  await ck.shot('vault-system-low.png');
  const hi = tiers.high;
  const lo = tiers.low;
  check(hi.fields === 1 && hi.segments > 0 && hi.motes > 0, `a leptonic vault in a hole's Deep is drawn as its fields (${hi.segments} filament segments, ${hi.motes} motes)`);
  check(hi.loops === 3, `a current loop for each Field Store and Deep Field Store (${hi.loops})`);
  check(hi.cages === 2, `a cage of field lines for its Burst Catcher, and one round the hole for its Bastion Shells (${hi.cages})`);
  check(lo.segments < tiers.medium.segments && tiers.medium.segments < hi.segments && lo.motes < hi.motes, `fewer on Medium and fewer still on Low (segments ${hi.segments} / ${tiers.medium.segments} / ${lo.segments}, motes ${hi.motes} / ${tiers.medium.motes} / ${lo.motes})`);
  await quality('high');
  const writ = await look(page, at.horizon, at.hdeep);
  await ck.shot('horizon.png');
  check(writ.writ === 1 && writ.fields === 0, `minds written into a horizon ride its photon ring, and no fields stand in its Deep (${writ.writ}, ${writ.fields})`);

  // the galaxy map: a ring of its own for each form
  const forms = await page.evaluate(([v, h]) => {
    const e = window.__stel.engine();
    e.showGalaxy(v, 30, true);
    const g = e.galaxy;
    const nodes = g.nodes.geometry;
    const ids = g.pickables.map((p) => p.id);
    const f = nodes.getAttribute('aForm');
    return { vault: f.getX(ids.indexOf(v)), horizon: f.getX(ids.indexOf(h)), max: Math.max(...f.array) };
  }, [at.vault, at.horizon]);
  await page.waitForTimeout(1200);
  await ck.shot('map-forms.png');
  check(forms.vault === 1 && forms.horizon === 2, `on the map our settlements' rings say what they are made of: fields ${forms.vault}, a horizon ${forms.horizon}`);

  // the positronium: faint ellipses across every system while it lasts, brighter where we are woven through it
  const pz = await scene(
    page,
    'decays',
    `() => {
      s.era = 'blackhole';
      s.eta = 92;
      s.years = 1e92;
      endMatter();
      moveTo(c, deepOf(holes[0]));
      c.form = 'positronium';
      for (const k of Object.keys(c.pops)) c.pops[k] = 0;
      c.pops.echoes = 8;
      c.cryo = 0;
      c.structures = { lepton_substrate: 1, positronium_net: 2 };
      c.queue = [];
      return { woven: holes[0].id, other: holes[1].id, deep: c.bodyId };
    }`,
  );
  const woven = await look(page, pz.woven, pz.deep);
  await ck.shot('positronium-woven.png');
  await whole(page);
  await ck.shot('positronium-system.png');
  const plain = await look(page, pz.other);
  check(woven.veil >= 5 && plain.veil === woven.veil, `the positronium lies across every system as ${woven.veil} faint ellipses`);
  check(woven.fields === 1, 'a woven settlement keeps its fields, fainter');

  // the Thinning: what is still made of matter dissolves
  const thin = await scene(
    page,
    'decays',
    `() => {
      s.era = 'degenerate';
      s.eta = 38.4;
      s.years = Math.pow(10, 38.4);
      c.structures = { ...c.structures, dyson_swarm: 1, orbital_collector: 2 };
      return { sys: c.systemId, body: c.bodyId };
    }`,
  );
  const th = await look(page, thin.sys, thin.body);
  await ck.shot('thinning.png');
  check(th.thin > 0.5 && th.thin < 0.7, `during the Thinning what is made of matter dissolves by the share gone (${th.thin.toFixed(2)})`);

  // a settlement that made the Passage, still on its world: its fields round it, and no cities
  const pass = await scene(
    page,
    'decays',
    `() => {
      s.era = 'degenerate';
      s.eta = 36;
      s.years = 1e36;
      c.form = 'leptonic';
      for (const k of Object.keys(c.pops)) c.pops[k] = 0;
      c.pops.echoes = 5;
      c.cryo = 0;
      c.structures = { substrate_core: 2, reserve_vault: 1 };
      c.queue = [];
      return { sys: c.systemId, body: c.bodyId };
    }`,
  );
  const pw = await look(page, pass.sys, pass.body);
  await ck.shot('passage-world.png');
  const lights = await page.evaluate((id) => {
    const sv = window.__stel.engine().system;
    const rig = sv.planets.find((p) => p.body.id === id);
    return rig && rig.mat ? rig.mat.uniforms.uLights.value : null;
  }, pass.body);
  check(pw.fields === 1 && pw.loops === 1 && lights === 0, `a leptonic settlement on its world is its fields round it, with no cities on it (fields ${pw.fields}, lights ${lights})`);

  // matter stable, past 10^1500 years: iron
  const fe = await scene(
    page,
    'stable',
    `() => {
      s.era = 'dark';
      s.eta = 2000;
      s.years = Infinity;
      s.flags.iron = s.turn;
      const dwarf = Object.values(s.systems).find((x) => x.primary.kind === 'white_dwarf' && !x.gone);
      s.civ.known[dwarf.id] = 2;
      return { sys: c.systemId, body: c.bodyId, dwarf: dwarf.id };
    }`,
  );
  // (in the dark nothing lights them: seen with light amplification)
  await page.evaluate(() => (window.__stel.engine().viewMode = 1));
  const ir = await look(page, fe.sys, fe.body);
  await ck.shot('iron-home.png');
  const id = await look(page, fe.dwarf);
  await ck.shot('iron-dwarf.png');
  await page.evaluate(() => (window.__stel.engine().viewMode = 0));
  check(ir.iron > 0 && id.iron > 0, `past 10^1500 years the worlds and the dead stars are iron (${ir.iron} at home, ${id.iron} at a white dwarf)`);

  // a black dwarf exploding this turn flashes on the map
  const sn = await scene(
    page,
    'stable',
    `() => {
      s.era = 'dark';
      s.eta = 1099;
      s.years = Infinity;
      const dwarf = Object.values(s.systems).find((x) => x.primary.kind === 'white_dwarf' && !x.gone && !x.special);
      dwarf.primary.mass = 1.35;
      s.civ.known[dwarf.id] = 1;
      s.civ.energy = 5000;
      return { dwarf: dwarf.id };
    }`,
  );
  await page.evaluate(() => {
    const e = window.__stel.engine();
    if (e.view !== 'galaxy') e.showGalaxy();
  });
  await page.waitForTimeout(800);
  const before = await page.evaluate(() => window.__stel.engine().galaxy.pings.length);
  await page.locator('.endturn').click();
  await page.waitForFunction(() => window.__stel.state().turn > 1, null, { timeout: 60000 });
  // (the map is marked once the turn's report is in: a moment after the turn itself)
  await page.waitForFunction(() => window.__stel.engine().galaxy.pings.length > 0 || !!window.__stel.state().civ.outcome, null, { timeout: 5000 }).catch(() => {});
  const flashed = await page.evaluate((id) => {
    const s = window.__stel.state();
    const e = window.__stel.engine();
    const at = s.systems[id].pos;
    const here = e.galaxy.pings.filter((p) => Math.abs(p.mesh.position.x - at.x) < 1e-6 && Math.abs(p.mesh.position.z - at.z) < 1e-6);
    return { exploded: !!s.systems[id].primary.exploded, pings: here.length, colour: here[0] ? '#' + here[0].mesh.material.color.getHexString() : null, outcome: s.civ.outcome?.kind ?? null };
  }, sn.dwarf);
  check(flashed.exploded && flashed.pings > 0 && flashed.colour === '#fff3dc' && before === 0, `a black dwarf exploding flashes on the map (exploded ${flashed.exploded}, ${flashed.pings} rings, ${flashed.colour}${flashed.outcome ? `, outcome ${flashed.outcome}` : ''})`);
  for (let k = 0; k < 5 && (await page.locator('.modal').count()); k++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }

  // refresh-rate independence: the same frame after the same time at 30 and at 144 frames a second
  await scene(
    page,
    'decays',
    `() => {
      s.era = 'blackhole';
      s.eta = 50;
      s.years = 1e50;
      endMatter();
      moveTo(c, deepOf(holes[0]));
      c.form = 'leptonic';
      c.structures = { lepton_substrate: 2, reserve_vault: 1 };
      return {};
    }`,
  );
  const frames = await page.evaluate(async (sys) => {
    const e = window.__stel.engine();
    e.stop();
    const grab = (fps) => {
      e.showSystem(sys);
      for (let i = 0; i < 40; i++) e.frame(1 / 30);
      const sv = e.system;
      // from here, two seconds at this rate
      const t0 = sv.time;
      for (let i = 0; i < 2 * fps; i++) e.frame(1 / fps);
      return { dt: sv.time - t0, u: sv.fieldMats.map((m) => m.uniforms.uTime.value - t0) };
    };
    const a = grab(30);
    const b = grab(144);
    e.start();
    return { a, b };
  }, at.vault);
  const same = frames.a.u.length > 0 && frames.a.u.length === frames.b.u.length && frames.a.u.every((v, i) => Math.abs(v - frames.b.u[i]) < 1e-6) && Math.abs(frames.a.dt - frames.b.dt) < 1e-6;
  check(same, `two seconds at 30 and at 144 frames a second bring the fields to the same moment (${frames.a.dt.toFixed(4)} s and ${frames.b.dt.toFixed(4)} s)`);
  await finish('LEPTONIC LOOK', ck);
});
