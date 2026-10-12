// A world flung loose from its star has left behind everything built in orbit around that star
// (12 Oct, the player: "check if Stellar lifters work on Rogue Planets too, because they should
// not"). They did: a settlement on a rogue world could build a Stellar Lifter at the star it had
// left and draw its matter, and at a black hole its spin, its Hawking light and a Horizon Vault's
// store, and its Hearth fed on the hole. Now none of it: what it built there before says it is out
// of reach, a lifter there no longer drains the galaxy, and one left behind does not stop a
// settlement still at the star from building its own. A bound world keeps all of it.
import { newGame } from '../../../src/game/newGame';
import { STRUCTURE_BY_ID } from '../../../src/game/data/structures';
import { structureCheck } from '../../../src/game/sim/actions';
import { colonyTurn, reserveCapacity } from '../../../src/game/sim/economy';
import { createColony } from '../../../src/game/sim/fleets';
import { computeMods } from '../../../src/game/sim/mods';
import { turnStep } from '../../../src/game/sim/flare';
import { matterAt, powerParts } from '../../../src/game/sim/sites';
import { endTurn } from '../../../src/game/sim/turn';
import { deserialize } from '../../../src/game/save';
import type { Body, Colony, GameState } from '../../../src/game/types';
import { check, done, loadSave } from '../lib';

const ctxFor = (g: GameState) => {
  const st = turnStep(g);
  return { mods: computeMods(g), years: g.years, L: st.turnLength, logL: Math.log10(st.turnLength), paceFactor: 1 };
};
const lines = (g: GameState, c: Colony) => colonyTurn(g, c, ctxFor(g), 1e9).y.lines;
const can = (g: GameState, c: Colony, id: string) => structureCheck(g, c, STRUCTURE_BY_ID[id]);

// ---------------------------------------------------------------- a Stellar Lifter at a red dwarf
{
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
  s.civ.techs.push('orbital_collectors', 'dyson_swarms', 'stellar_lifting');
  const home = s.systems[s.civ.homeSystemId];
  const world = home.bodies.map((id) => s.bodies[id]).find((b) => b.kind !== 'deep' && !b.colonyId && !b.dissolved)!;
  const deep = home.bodies.map((id) => s.bodies[id]).find((b) => b.kind === 'deep')!;
  const c = createColony(s, world, { kin: 3 });
  console.log(`  ${world.name} (${world.kind}) at ${home.name} (${home.primary.kind})`);
  check(can(s, c, 'stellar_lifter') === null, 'bound to its star: it can build a Stellar Lifter');
  c.structures.stellar_lifter = 1;
  const bound = lines(s, c).find((l) => /Stellar Lifter/.test(l.label));
  const mBound = matterAt(s, world);
  check(!!bound && (bound.matter ?? 0) > 0 && !bound.idle, `and it lifts matter (${(bound?.matter ?? 0).toFixed(1)} a turn)`);

  world.rogue = true;
  delete c.structures.stellar_lifter;
  check(/^Out of reach/.test(can(s, c, 'stellar_lifter') ?? ''), `flung loose: no Stellar Lifter (“${can(s, c, 'stellar_lifter')}”)`);
  check(/^Out of reach/.test(can(s, c, 'dyson_swarm') ?? ''), 'nor a Dyson Swarm');
  check(can(s, c, 'orbital_collector') === 'Nothing to gather: a rogue world has no sun.', 'nor Orbital Collectors (no sun), as Solar Arrays before');
  check(can(s, c, 'solar_array') === 'Nothing to gather: a rogue world has no sun.', 'nor Solar Arrays');
  check(can(s, c, 'mine') === null, 'its own ground is still its own: a Deep Mine');
  const mRogue = matterAt(s, world);
  check(mRogue < mBound, `Where to settle counts no lifter for it (matter ${mBound.toFixed(1)} → ${mRogue.toFixed(1)})`);

  // one built before the world was flung loose
  c.structures.stellar_lifter = 1;
  const left = lines(s, c).find((l) => /Stellar Lifter/.test(l.label));
  console.log(`  rogue: “${left?.label}”`);
  check(!!left && !(left.matter ?? 0) && left.idle === 'stellar_lifter' && /out of reach/.test(left.label), 'one built before lifts nothing, and says it is out of reach');
  const dc = createColony(s, deep, { lattice: 2 });
  check(can(s, dc, 'stellar_lifter') === null, 'a settlement still at the star can build its own: the one left behind works for no one');
  world.rogue = false;
  check(can(s, dc, 'stellar_lifter') === 'Only one per system.', '(while it was bound, one per system)');
  world.rogue = true;

  // and a lifter left behind no longer drains the galaxy's free energy
  const gfeAfter = (lifter: boolean, rogue: boolean) => {
    const g = deserialize(JSON.stringify(s))!;
    const gw = g.bodies[world.id];
    gw.rogue = rogue;
    const gc = g.colonies[c.id];
    if (lifter) gc.structures.stellar_lifter = 1;
    else delete gc.structures.stellar_lifter;
    for (const x of Object.values(g.colonies)) {
      x.queue = [];
      x.overdrive = false;
    }
    g.pending.length = 0;
    endTurn(g);
    return g.gfe;
  };
  const [rl, rn, bl, bn] = [gfeAfter(true, true), gfeAfter(false, true), gfeAfter(true, false), gfeAfter(false, false)];
  console.log(`  free energy after a turn: rogue ${rl} (with) / ${rn} (without); bound ${bl} / ${bn}`);
  check(rl === rn, 'left behind, it drains nothing');
  check(bl < bn, 'bound, it drains as before');
}

// ---------------------------------------------------------------- a black hole, in the Degenerate Age
{
  const s = loadSave('9eea773-seed1000-turn119-merger.json.gz');
  for (const t of ['penrose_process', 'hawking_capture', 'horizon_storage', 'accretion_engines']) if (!s.civ.techs.includes(t)) s.civ.techs.push(t);
  // (by now close passes have flung loose the worlds of both holes with any: the first is taken as it was before)
  const free = (b: Body | undefined) => !!b && b.kind !== 'deep' && !b.dissolved && !b.colonyId;
  const hole = Object.values(s.systems).find((x) => x.primary.kind === 'black_hole' && !x.gone && x.primary.spin > 0 && x.bodies.some((id) => free(s.bodies[id])))!;
  check(!!hole, `a black hole with a world (${hole?.name})`);
  const world = s.bodies[hole.bodies.find((id) => free(s.bodies[id]))!];
  world.rogue = false;
  const c = createColony(s, world, { lattice: 4 });
  c.structures = { penrose_harvester: 1, hawking_collector: 1, horizon_vault: 1 };
  const show = (ls: ReturnType<typeof lines>) => ls.map((l) => `${l.label} ${(l.energy ?? 0).toFixed(2)}`).join(', ');
  const b0 = lines(s, c);
  const cap0 = reserveCapacity(s, computeMods(s));
  const p0 = powerParts(s, world);
  console.log(`  bound: ${show(b0)}`);
  const hearth0 = b0.find((l) => /^Hearth/.test(l.label))!.energy ?? 0;
  const pen0 = b0.find((l) => /Penrose/.test(l.label))?.energy ?? 0;
  check(pen0 > 0, `bound to the hole: the Penrose Harvester draws its spin (${pen0.toFixed(1)})`);
  for (const id of Object.keys(c.structures)) delete c.structures[id];
  check(can(s, c, 'penrose_harvester') === null && can(s, c, 'horizon_vault') === null, 'and can build at it');
  c.structures = { penrose_harvester: 1, hawking_collector: 1, horizon_vault: 1 };

  world.rogue = true;
  const b1 = lines(s, c);
  console.log(`  rogue: ${show(b1)}`);
  const hearth1 = b1.find((l) => /^Hearth/.test(l.label))!.energy ?? 0;
  check(['Penrose', 'Hawking'].every((k) => { const l = b1.find((x) => x.label.includes(k)); return !!l && !(l.energy ?? 0) && !!l.idle; }), 'flung loose: its Penrose Harvester and Hawking Collector give nothing');
  check(hearth1 < hearth0, `its Hearth no longer feeds on the hole (${hearth0.toFixed(2)} → ${hearth1.toFixed(2)})`);
  const cap1 = reserveCapacity(s, computeMods(s));
  check(Math.abs(cap0 - cap1 - 400 * computeMods(s).reserveMult) < 1e-9, `its Horizon Vault holds nothing for it (storage ${cap0} → ${cap1})`);
  for (const id of Object.keys(c.structures)) delete c.structures[id];
  check(['penrose_harvester', 'hawking_collector', 'horizon_vault', 'accretion_engine'].every((id) => /^Out of reach/.test(can(s, c, id) ?? '')), 'nor can it build any of them, nor an Accretion Engine');
  const p1 = powerParts(s, world);
  const sum = (ps: { e: number }[]) => ps.reduce((a, x) => a + x.e, 0);
  console.log(`  Power, as Where to settle counts it: ${sum(p0).toFixed(1)} → ${sum(p1).toFixed(1)} (${p1.map((x) => x.label).join(', ')})`);
  check(sum(p1) < sum(p0) && !p1.some((x) => /Penrose|Hawking/.test(x.label)), 'Where to settle counts none of it for a rogue world');
}

done('ROGUE REACH');
