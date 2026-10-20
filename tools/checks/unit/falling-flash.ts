// Falling worlds break up, and giants fall in a flash (20 Oct; the player, 19 Oct: "make the black
// hole flashes harvestable"; a falling world "should then break up into asteroids and eventually
// be… accreted"; a giant's flash "would destroy the planets around the objects… only burst
// catchers in other systems would really catch it"; molten worlds stay molten, "perhaps some
// measures may need to be taken to shelter"). In a game begun since then (`flags.rubble`):
// - a rocky or icy world at its dead star's (or brown dwarf's) tidal limit becomes a ring of
//   rubble: an asteroid belt, its core laid open (richness ×2), thinning as it rains in, half
//   that at t = τ; it feeds the star as before, with the same draws;
// - one torn apart by a black hole feeds the hole within the turn, a faint flash that harms
//   nothing: Burst Catchers in its system bank 250 each, others out to its reach (an Earth's
//   2.3 ly), less beyond;
// - a giant falls in a flash at its star's limit brightness: worlds near it boil away, the rest
//   inside its melt line melt (their air and seas gone); of the settlements there only what is
//   sheltered lives (a locked world: a Flash Shelter or Deep Warrens; a turning world, a belt, a
//   giant's clouds, the Deep: a Shadow Shield), and nothing on a world it boils away; beyond the
//   melt line nothing is harmed; every Burst Catcher in reach banks it;
// - "A World Falls" offers a third, dark choice, only at Taint 60 and more: its people taken
//   apart with the rubble;
// - the shelters are built only in such a game, the Flash Shelter only on a locked world;
// - a game begun before keeps today's rule.
import { newGame } from '../../../src/game/newGame';
import { EVENT_BY_ID, choiceShown } from '../../../src/game/data/events';
import { STRUCTURE_BY_ID } from '../../../src/game/data/structures';
import { evolveUniverse, flashBoils, giantFlash, meltLineAU, rubbleGame } from '../../../src/game/physics';
import { buildableStructures, structureCheck } from '../../../src/game/sim/actions';
import { burstShare, flashReach } from '../../../src/game/sim/crossing';
import { createColony } from '../../../src/game/sim/fleets';
import { updateForecasts } from '../../../src/game/sim/forecast';
import { handleNotes } from '../../../src/game/sim/turn';
import { capital, colonies } from '../../../src/game/sim/util';
import { Rng } from '../../../src/game/rng';
import type { Body, BodyKind, GameState, Primary, StarSystem } from '../../../src/game/types';
import { check, done, loadSave, near } from '../lib';

const fresh = () => newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable', civsAsleep: true }) as GameState;
/** Into the Degenerate Age, at these years. */
const at = (s: GameState, years: number) => {
  s.era = 'degenerate';
  s.years = years;
  s.eta = Math.log10(years);
};
/** Free systems, far from anyone (no settlement, not of note), placed where we want them. */
const freeSystems = (s: GameState) => {
  const settled = new Set(Object.values(s.colonies).map((c) => c.systemId));
  return Object.values(s.systems).filter((x) => !x.special && !x.gone && !settled.has(x.id) && !Object.values(s.swarms).some((w) => w.systemId === x.id));
};
/**
 * A system made into what a case needs: its star, its place (ly along x, far out of everyone's
 * way) and only its Deep. (Every step here draws 0.999, so no close pass flings a world loose.)
 */
const stage = (s: GameState, sys: StarSystem, primary: Partial<Primary>, ly: number) => {
  Object.assign(sys.primary, { lum: 0.02, spin: 0, spinMax: 0, ...primary });
  delete sys.primary.rekindle;
  Object.assign(sys.phys, { x: 5e6 + ly, y: 0, z: 0 });
  sys.bodies = sys.bodies.filter((id) => s.bodies[id]?.kind === 'deep');
  return sys;
};
let made = 0;
/** A world of ours to place: falling in at `falls` (years), or never. */
const world = (s: GameState, sys: StarSystem, kind: BodyKind, aAU: number, massEarth: number, extra: Partial<Body> = {}): Body => {
  const b: Body = {
    id: `t${made++}`,
    systemId: sys.id,
    name: `${sys.name} test ${made}`,
    kind,
    orbit: 16 + made,
    phase: 0,
    size: 1,
    seed: made,
    orbitAU: aAU,
    massEarth,
    habitability: 0.5,
    vitality: 0,
    decline: 0,
    coreHeat: 0.1,
    richness: 1.2,
    hydrogen: 0,
    water: 0.4,
    traits: [],
    colonyId: null,
    inspiralAt: 1e60,
    ...extra,
  };
  s.bodies[b.id] = b;
  sys.bodies.push(b.id);
  return b;
};
const deepOf = (s: GameState, sys: StarSystem) => s.bodies[sys.bodies.find((id) => s.bodies[id]?.kind === 'deep')!];
const settle = (s: GameState, b: Body, structures: Record<string, number> = {}) => {
  const c = createColony(s, b, { kin: 4, echoes: 4 });
  Object.assign(c.structures, structures);
  return c;
};
/** One step of the universe from just before `date` to just after, and what our part of the turn makes of it. */
const step = (s: GameState, date: number) => {
  const notes = evolveUniverse(s, date * 0.9999999, date * 1.0000001, () => 0.999);
  const before = s.civ.energy;
  handleNotes(s, notes);
  return { notes, banked: s.civ.energy - before };
};

// ---------------------------------------------------------------- rubble
{
  const s = fresh();
  check(rubbleGame(s), 'a new game has falling worlds break up, and giants flash');
  const date = 3e19;
  at(s, date);
  const [a] = freeSystems(s);
  const sys = stage(s, a, { kind: 'white_dwarf', mass: 0.6, halo: false }, 0);
  const b = world(s, sys, 'barren', 0.01, 1, { inspiralAt: date, traits: ['tidally_locked'] });
  const rich = b.richness;
  // (the step ends on its date: none of it has fallen in yet)
  const notes = evolveUniverse(s, date * 0.99, date, () => 0.999);
  check(b.kind === 'asteroids' && b.traits.includes('rubble') && !b.traits.includes('tidally_locked') && !b.dissolved, `at its tidal limit ${b.name} becomes a ring of rubble (${b.kind}; ${b.traits.join(', ')})`);
  near('its core laid open: twice as rich', b.richness, 2 * rich);
  check(!!b.feeding && b.feeding.model === 'feed' && notes.some((n) => n.kind === 'feeding' && n.bodyId === b.id), `and it feeds its dead star as before (${b.feeding?.model}, τ 10^${Math.log10(b.feeding?.tau ?? 1).toFixed(1)} years)`);
  evolveUniverse(s, date, date + b.feeding!.tau, () => 0.999);
  near('thinning as it rains in: at t = τ half of that', b.richness, rich);
  // a brown dwarf's world as well (no draw)
  const s2 = fresh();
  at(s2, date);
  const bd = stage(s2, freeSystems(s2)[0], { kind: 'brown_dwarf', mass: 0.05 }, 0);
  const w = world(s2, bd, 'ice', 0.004, 0.5);
  const falls = date;
  w.inspiralAt = 1;
  // (a brown dwarf's date is its orbit's own decay: brought in to now)
  w.orbitAU = 0.1 * Math.pow((falls - 1e14) / (3e19 * (1 / 0.5) * Math.pow(0.6 / 0.05, 2)), 0.25);
  let draws = 0;
  evolveUniverse(s2, date * 0.99, date * 1.01, () => (draws++, 0.999));
  check(w.kind === 'asteroids' && w.traits.includes('rubble') && !!w.feeding, `a brown dwarf's world becomes rubble too (${w.kind}), with no draw of its own`);
}

// ---------------------------------------------------------------- a rocky world torn apart by a black hole
{
  const s = fresh();
  const date = 3e20;
  at(s, date);
  const [a, b2, b5, home] = freeSystems(s);
  const hole = stage(s, a, { kind: 'black_hole', mass: 10, lum: 0 }, 0);
  const w = world(s, hole, 'barren', 0.1, 1);
  w.orbitAU = 0.1 * Math.pow((date - 1e14) / (3e19 * Math.pow(0.6 / 10, 2)), 0.25);
  // two catchers in its Deep, one 2 ly off, one 5 ly off
  settle(s, deepOf(s, hole), { burst_catcher: 2 });
  for (const [sys, ly] of [[b2, 2], [b5, 5]] as const) {
    stage(s, sys, { kind: 'white_dwarf', mass: 0.6 }, ly);
    settle(s, world(s, sys, 'barren', 1, 1), { burst_catcher: 1 });
  }
  void home;
  const r = step(s, date);
  const f = r.notes.find((n) => n.kind === 'flash')?.flash;
  const reach = flashReach(f?.energy ?? 0);
  check(w.dissolved === true && !!f && f.inside.length === 0 && f.boiled.length === 0, `${w.name} is torn apart and gone within the turn, a faint flash that harms nothing (${f?.lum.toExponential(1)} Suns)`);
  check(reach > 2.2 && reach < 2.45, `an Earth's flash fills a Burst Catcher out to ${reach.toFixed(2)} ly`);
  const want = 2 * 250 + burstShare(2, reach) + burstShare(5, reach);
  check(burstShare(2, reach) === 250 && burstShare(5, reach) < 250 && burstShare(5, reach) > 0, `250 at 2 ly, ${burstShare(5, reach)} at 5 ly`);
  check(r.banked === want, `the catchers bank it: 500 in its own system, 250 at 2 ly, ${burstShare(5, reach)} at 5 ly (${r.banked} of ${want})`);
}

// cast out of the galaxy, a system's own catchers still bank its own world's flash, and only that
{
  const s = fresh();
  const date = 3e20;
  at(s, date);
  const [a, b] = freeSystems(s);
  const hole = stage(s, a, { kind: 'black_hole', mass: 10, lum: 0 }, 0);
  hole.ejected = true;
  const w = world(s, hole, 'barren', 0.1, 1);
  w.orbitAU = 0.1 * Math.pow((date - 1e14) / (3e19 * Math.pow(0.6 / 10, 2)), 0.25);
  settle(s, deepOf(s, hole), { burst_catcher: 1 });
  const out = stage(s, b, { kind: 'white_dwarf', mass: 0.6 }, 1);
  out.ejected = true;
  settle(s, world(s, out, 'barren', 1, 1), { burst_catcher: 1 });
  const r = step(s, date);
  check(r.banked === 250, `cast out of the galaxy, its own catcher banks it (${r.banked}: 250), and none in another system cast out`);
}

// ---------------------------------------------------------------- a giant falling onto a white dwarf
const giantCase = (deepShield: boolean) => {
  const s = fresh();
  const date = 1e19;
  at(s, date);
  const [a, near1, near2] = freeSystems(s);
  const sys = stage(s, a, { kind: 'white_dwarf', mass: 0.6, halo: false }, 0);
  const giant = world(s, sys, 'gas_giant', 0.02, 318, { inspiralAt: date });
  const ws = {
    giant,
    tiny: world(s, sys, 'barren', 0.03, 0.1),
    turning: world(s, sys, 'terran', 1, 1, { vitality: 0.3 }),
    shielded: world(s, sys, 'terran', 1.4, 1, { vitality: 0.3 }),
    locked: world(s, sys, 'barren', 1.2, 1, { traits: ['tidally_locked'] }),
    warrens: world(s, sys, 'barren', 1.7, 1, { traits: ['tidally_locked'] }),
    bareLocked: world(s, sys, 'barren', 2, 1, { traits: ['tidally_locked'] }),
    far: world(s, sys, 'ice', 10, 1),
  };
  const cs = {
    giant: settle(s, ws.giant),
    tiny: settle(s, ws.tiny, { shadow_shield: 1 }),
    turning: settle(s, ws.turning),
    shielded: settle(s, ws.shielded, { shadow_shield: 1 }),
    locked: settle(s, ws.locked, { flash_shelter: 1 }),
    warrens: settle(s, ws.warrens, { warrens: 1 }),
    bareLocked: settle(s, ws.bareLocked),
    far: settle(s, ws.far, { burst_catcher: 1 }),
    deep: settle(s, deepOf(s, sys), deepShield ? { shadow_shield: 1 } : {}),
  };
  stage(s, near1, { kind: 'white_dwarf', mass: 0.6 }, 1);
  stage(s, near2, { kind: 'white_dwarf', mass: 0.6 }, 2);
  const c1 = settle(s, world(s, near1, 'barren', 1, 1), { burst_catcher: 1 });
  const c2 = settle(s, world(s, near2, 'barren', 1, 1), { burst_catcher: 1 });
  updateForecasts(s);
  const fc = s.civ.forecasts.find((x) => x.kind === 'flash' && x.bodyId === giant.id);
  const deepPeople = cs.deep.pops.kin + cs.deep.pops.echoes;
  const r = step(s, date);
  return { s, sys, ws, cs, c1, c2, r, fc, deepPeople };
};
{
  const { s, sys, ws, cs, c1, c2, r, fc } = giantCase(false);
  const f = giantFlash(sys.primary, ws.giant);
  const line = meltLineAU(f.lum);
  check(f.lum > 18000 && f.lum < 20000 && f.years > 50 && f.years < 100 && f.energy > 1.5e40 && f.energy < 2e40, `a Jupiter onto a 0.6-Sun white dwarf: ${f.energy.toExponential(2)} J, ${Math.round(f.lum)} Suns for ${Math.round(f.years)} years`);
  check(line > 3.5 && line < 4.5, `the ground melts out to ${line.toFixed(1)} AU`);
  check(!!fc && /in a flash/.test(fc.title) && /Shadow Shield/.test(fc.text) && /Flash Shelter/.test(fc.text) && /boil away/.test(fc.text), `the forecast warns ahead: "${fc?.title}": ${fc?.text}`);
  check(ws.giant.dissolved === true && !!r.notes.find((n) => n.kind === 'flash'), 'the giant falls in, in a flash');
  check(ws.tiny.dissolved === true && !s.colonies[cs.tiny.id], `a small world close in boils away, and the settlement on it with it, Shadow Shield and all`);
  check(!s.colonies[cs.turning.id] && ws.turning.traits.includes('flash_melted') && ws.turning.water === 0 && ws.turning.vitality === 0 && ws.turning.kind === 'barren', `on a turning world at 1 AU, without a Shadow Shield, the settlement is lost and the world melted to bare rock (${ws.turning.kind})`);
  check(!!s.colonies[cs.shielded.id] && !ws.shielded.traits.includes('flash_melted'), 'with one it lives, its world shaded');
  check(!!s.colonies[cs.locked.id] && ws.locked.traits.includes('flash_melted'), 'on a locked world a Flash Shelter keeps it, while the day side melts');
  check(!!s.colonies[cs.warrens.id], 'and so do Deep Warrens');
  check(!s.colonies[cs.bareLocked.id], 'a locked world with neither loses it');
  check(!s.colonies[cs.deep.id] && !colonies(s).some((c) => c.systemId === sys.id && s.bodies[c.bodyId].kind === 'deep'), 'the Deep, with nothing to hide behind, is lost without a Shadow Shield, and those who got off the giant with it');
  check(!!s.colonies[cs.far.id] && !ws.far.traits.includes('flash_melted'), 'at 10 AU, beyond the melt line, nothing is harmed');
  const reach = flashReach(f.energy);
  const want = 250 + burstShare(1, reach) + burstShare(2, reach);
  check(burstShare(1, reach) === 250 && burstShare(2, reach) < 250, `a catcher 1 ly away banks it all, one 2 ly away ${burstShare(2, reach)} (reach ${reach.toFixed(2)} ly)`);
  check(r.banked === want, `the catchers bank it: 250 at 10 AU, and by distance next door (${r.banked} of ${want})`);
  void c1;
  void c2;
}
{
  const { s, sys, cs, deepPeople } = giantCase(true);
  const deep = s.colonies[cs.deep.id];
  check(!!deep && deep.pops.kin + deep.pops.echoes > deepPeople, `with a Shadow Shield the Deep lives, and so do three in four of those who got off the giant (${deep ? deep.pops.kin + deep.pops.echoes : 0} people, ${deepPeople} before)`);
  void sys;
}
// a giant falling into a black hole: hotter, far wider
{
  const s = fresh();
  const hole = stage(s, freeSystems(s)[0], { kind: 'black_hole', mass: 10, lum: 0 }, 0);
  const g = world(s, hole, 'gas_giant', 0.05, 318);
  const f = giantFlash(hole.primary, g);
  const earth = (a: number) => world(s, hole, 'barren', a, 1);
  check(f.energy > 1.6e43 && f.energy < 1.8e43 && f.years > 3500 && f.years < 5500, `a Jupiter into a 10-Sun hole: ${f.energy.toExponential(2)} J for ${Math.round(f.years)} years`);
  check(flashBoils(s, earth(1.8), f) && !flashBoils(s, earth(1.95), f), 'an Earth boils away within about 1.9 AU of it');
  check(flashReach(f.energy) > 40 && flashReach(f.energy) < 42, `its catchers fill out to ${flashReach(f.energy).toFixed(0)} ly`);
}

// ---------------------------------------------------------------- the dark choice
{
  const s = fresh();
  const date = 3e19;
  at(s, date);
  const sys = stage(s, freeSystems(s)[0], { kind: 'white_dwarf', mass: 0.6, halo: false }, 0);
  const b = world(s, sys, 'barren', 0.01, 1, { inspiralAt: date });
  const c = settle(s, b);
  evolveUniverse(s, date * 0.99, date, () => 0.999);
  const def = EVENT_BY_ID.world_falls;
  const d = { systemId: sys.id, bodyId: b.id };
  const dark = def.choices[2];
  check(/torn the world apart into a ring of rubble/.test(def.text(s, d)), `"A World Falls" tells of the rubble: ${def.text(s, d)}`);
  s.civ.taint = 59;
  check(!choiceShown(dark, s, d), 'at Taint 59 it offers no dark choice');
  s.civ.taint = 60;
  check(choiceShown(dark, s, d) && dark.label === 'Take them apart', `at Taint 60 it does: "${dark.label}"`);
  const people = c.pops.kin + c.pops.echoes + c.cryo;
  const cap = capital(s)!;
  const was = { matter: s.civ.matter, resolve: s.civ.resolve, kin: s.civ.standing.kin, taint: s.civ.taint, lattice: cap.pops.lattice };
  const text = dark.run(s, d, new Rng(1));
  check(!s.colonies[c.id], 'its people are not taken off');
  check(s.civ.matter - was.matter === 5 * people, `Matter +5 for each of the ${people} (${s.civ.matter - was.matter})`);
  check(cap.pops.lattice - was.lattice <= Math.floor(people / 3), `Lattice +${cap.pops.lattice - was.lattice} at the capital, at most one for every three`);
  check(s.civ.taint === was.taint + 8 && s.civ.resolve === was.resolve - 6 && s.civ.standing.kin === was.kin - 10, `Taint +8, Resolve −6, Kin standing −10 (${s.civ.taint - was.taint}, ${s.civ.resolve - was.resolve}, ${s.civ.standing.kin - was.kin})`);
  check(typeof text === 'string' && text.length > 0, `and it says what was done: "${text}"`);
  // not on a world that only falls in, as before: an older game's
  const old = fresh();
  delete old.flags.rubble;
  at(old, date);
  const os = stage(old, freeSystems(old)[0], { kind: 'white_dwarf', mass: 0.6, halo: false }, 0);
  const ob = world(old, os, 'barren', 0.01, 1, { inspiralAt: date });
  settle(old, ob);
  evolveUniverse(old, date * 0.99, date, () => 0.999);
  old.civ.taint = 80;
  check(!choiceShown(def.choices[2], old, { systemId: os.id, bodyId: ob.id }) && ob.kind === 'barren' && !!ob.feeding, 'in an older game the world feeds its star whole, as before, and no dark choice is offered');
}

// ---------------------------------------------------------------- the shelters, and an older game
{
  const s = fresh();
  at(s, 1e19);
  s.civ.techs.push('burst_capture');
  const sys = stage(s, freeSystems(s)[0], { kind: 'white_dwarf', mass: 0.6 }, 0);
  const turning = settle(s, world(s, sys, 'barren', 1, 1));
  const locked = settle(s, world(s, sys, 'barren', 0.05, 1, { traits: ['tidally_locked'] }));
  const deep = settle(s, deepOf(s, sys));
  const why = structureCheck(s, turning, STRUCTURE_BY_ID.flash_shelter);
  check(!!why && /tidally locked/.test(why), `no Flash Shelter on a turning world: "${why}"`);
  check(structureCheck(s, locked, STRUCTURE_BY_ID.flash_shelter) === null, 'one on a locked world');
  check(structureCheck(s, turning, STRUCTURE_BY_ID.shadow_shield) === null && structureCheck(s, deep, STRUCTURE_BY_ID.shadow_shield) === null, 'a Shadow Shield anywhere, the Deep too');
  check(structureCheck(s, deep, STRUCTURE_BY_ID.flash_shelter) !== null, 'but no Flash Shelter in the Deep');
  const old = loadSave('b1fc6a7-seed1000-turn61-next.json.gz');
  check(!rubbleGame(old), 'a game begun before 20 Oct keeps today’s rule');
  const oc = Object.values(old.colonies).find((c) => c.owner === old.civ.id)!;
  old.civ.techs.push('burst_capture');
  old.era = 'degenerate';
  check(structureCheck(old, oc, STRUCTURE_BY_ID.shadow_shield) === 'Not in this game.' && !buildableStructures(old, oc).some((x) => x.def.id === 'shadow_shield' || x.def.id === 'flash_shelter'), 'and has no shelters to build');
  // its giants feed their dead star as ever
  const ws = Object.values(old.systems).find((x) => !x.special && !x.gone && !Object.values(old.colonies).some((c) => c.systemId === x.id))!;
  at(old, 1e19);
  stage(old, ws, { kind: 'white_dwarf', mass: 0.6, halo: false }, 0);
  const g = world(old, ws, 'gas_giant', 0.02, 318, { inspiralAt: 1e19 });
  evolveUniverse(old, 1e19 * 0.99, 1e19 * 1.01, () => 0.999);
  check(!!g.feeding && !g.dissolved && g.kind === 'gas_giant', 'and its giants feed their dead star, as ever');
}

done('FALLING FLASH');
