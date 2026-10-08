// Terraforming (sim/terraform.ts). Orbital Mirrors and Atmosphere Works raise a dead world's
// habitability as far as its warmest ground becomes livable (the mirrors by up to 20 points, the
// works by up to 25), never past 55%, so a world already that habitable gains nothing. Biosphere
// Seeding needs 30% and some water, not on a world with life of its own, and spreads life 4% a
// turn up to 80% exactly; room for Kin follows. The works bring water with the air. All of it only
// by a red dwarf in the Dusk: by a flaring or dead star, or after the Dusk, nothing, and seeded
// life freezes. A new star boils its worlds as before. Old saves are unchanged.
import { autoPlay } from '../../../src/game/auto';
import { newGame } from '../../../src/game/newGame';
import { endTurn } from '../../../src/game/sim/turn';
import { queueBuild, structureCheck } from '../../../src/game/sim/actions';
import { STRUCTURE_BY_ID } from '../../../src/game/data/structures';
import { createColony, naturalKinRoom } from '../../../src/game/sim/fleets';
import { kinBaseCapacity } from '../../../src/game/sim/economy';
import { computeMods } from '../../../src/game/sim/mods';
import { structureEffect, project } from '../../../src/game/sim/projection';
import { NO_TERRAFORMING, boilsUnder, livableWarmth, seededLifeUnkept, starClimate, terraformLit, vitalityLoss } from '../../../src/game/physics';
import { SEED_CAP, SEED_MIN, SEED_RATE, TERRAFORM_CEILING, WORKS_WATER, habitabilityOf, seededVitality, seedingBlocked, terraformBlocked, terraformSummary } from '../../../src/game/sim/terraform';
import type { Body, Colony, GameState } from '../../../src/game/types';
import { check, done, loadSave } from '../lib';

const clone = (s: GameState) => JSON.parse(JSON.stringify(s)) as GameState;
const base = (() => {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' });
  for (let g = 0; g < 10 && !s.outcome; g++) {
    autoPlay(s, 'competent');
    endTurn(s);
  }
  s.pending.length = 0;
  s.swarms = {};
  if (!s.civ.techs.includes('terraforming')) s.civ.techs.push('terraforming');
  return s;
})();
const MIRRORS = STRUCTURE_BY_ID.orbital_mirrors;
const WORKS = STRUCTURE_BY_ID.atmosphere_works;
const SEEDING = STRUCTURE_BY_ID.biosphere_seeding;
const warmest = (s: GameState, b: Body, tf = { mirrors: false, works: false }) => {
  const cl = starClimate(s, b, undefined, tf);
  return cl.day ?? cl.mean;
};
/** A copy of the game with a settlement of ours on an unsettled world of this kind that `ok` likes. */
const settle = (kind: Body['kind'], ok: (s: GameState, b: Body) => boolean): { s: GameState; b: Body; c: Colony } => {
  const s = clone(base);
  const b = Object.values(s.bodies).find((x) => x.kind === kind && !x.colonyId && !x.dissolved && terraformLit(s, x) && ok(s, x));
  if (!b) throw new Error(`no ${kind} world to try`);
  const c = createColony(s, b, { kin: 2 });
  return { s, b, c };
};
const room = (s: GameState, c: Colony) => kinBaseCapacity(s, c, computeMods(s));

// ---------------------------------------------------------------- a dead rock made livable
{
  // bare rock whose warmest ground, with mirrors and air, is fully livable
  const { s, b, c } = settle('barren', (s, x) => livableWarmth(warmest(s, x, { mirrors: true, works: true })) === 1 && (x.water ?? 0) < WORKS_WATER);
  check(b.habitability === 0 && b.vitality === 0, `${b.name}: bare rock (habitability ${b.habitability}, vitality ${b.vitality})`);
  check(structureCheck(s, c, MIRRORS) === null && structureCheck(s, c, WORKS) === null, 'Orbital Mirrors and Atmosphere Works can be built there');
  check(/Too harsh/.test(structureCheck(s, c, SEEDING) ?? ''), `seeding is refused on bare rock: "${structureCheck(s, c, SEEDING)}"`);
  // the mirrors alone, then the works alone: each as far as the warmest ground becomes livable
  c.structures.orbital_mirrors = 1;
  const wm = warmest(s, b, { mirrors: true, works: false });
  const hm = habitabilityOf(s, b);
  check(Math.abs(hm - 0.2 * livableWarmth(wm)) < 1e-9, `mirrors alone: habitability ${hm.toFixed(3)} (0.2 × ${livableWarmth(wm).toFixed(2)} at ${Math.round(wm)} K)`);
  delete c.structures.orbital_mirrors;
  c.structures.atmosphere_works = 1;
  const ww = warmest(s, b, { mirrors: false, works: true });
  const hw = habitabilityOf(s, b);
  check(Math.abs(hw - 0.25 * livableWarmth(ww)) < 1e-9, `works alone: habitability ${hw.toFixed(3)} (0.25 × ${livableWarmth(ww).toFixed(2)} at ${Math.round(ww)} K)`);
  c.structures.orbital_mirrors = 1;
  const h = habitabilityOf(s, b);
  check(Math.abs(h - 0.45) < 1e-9, `both: habitability ${h.toFixed(3)} (0.45)`);
  check(room(s, c) === 0 && naturalKinRoom(b, s) === 0, 'still no room for Kin while nothing lives there');
  // the build list says what they do
  const fx = structureEffect({ ...s }, { ...c, structures: { atmosphere_works: 1 } }, 'orbital_mirrors', project(s).ctx);
  check(fx.notes.some((n) => /Habitability .*→ 45% here/.test(n)) && fx.notes.some((n) => /Biosphere Seeding/.test(n)), `the build list: ${fx.notes.filter((n) => /Habitab|Seeding/.test(n)).join('; ')}`);
  // too dry for life until the works bring water
  b.water = 0;
  check(/Too dry/.test(seedingBlocked(s, b, c) ?? ''), 'too dry for life to start');
  b.water = WORKS_WATER;
  check(structureCheck(s, c, SEEDING) === null, 'with the air and its water, seeding can be built');
  // life spreads, 4% a turn, to 80% exactly
  c.structures.biosphere_seeding = 1;
  let v = b.vitality;
  const steps: number[] = [];
  for (let i = 0; i < 30; i++) {
    b.vitality = seededVitality(s, b, c);
    steps.push(b.vitality);
  }
  check(Math.abs(steps[0] - SEED_RATE) < 1e-12 && steps[19] === SEED_CAP && steps[29] === SEED_CAP, `vitality ${v} → ${steps[0]} → … ${steps[18]}, ${steps[19]} (20 turns), and no further`);
  const want = Math.floor(Math.round(12 * 0.45) * SEED_CAP);
  check(room(s, c) === want && naturalKinRoom(b, s) === want && want === 4, `room for Kin at 80% vitality: ${room(s, c)} (want ${want})`);
  // a whole turn: the seeded life spreads, and nothing else moves its vitality
  const t = clone(s);
  const tb = t.bodies[b.id];
  tb.vitality = 0.4;
  endTurn(t);
  check(Math.abs(tb.vitality - 0.44) < 1e-9, `a turn: vitality 40% → ${(tb.vitality * 100).toFixed(1)}%`);
  // its star flares, dies, or the Dusk ends: no terraforming, and the seeded life freezes
  for (const [what, set] of [
    ['its star flares', (x: GameState) => (x.systems[b.systemId].primary.kind = 'blue_dwarf')],
    ['its star has died', (x: GameState) => (x.systems[b.systemId].primary.kind = 'white_dwarf')],
    ['after the Dusk', (x: GameState) => (x.era = 'degenerate')],
  ] as const) {
    const x = clone(s);
    set(x);
    const xb = x.bodies[b.id];
    const xc = x.colonies[c.id];
    check(habitabilityOf(x, xb) === xb.habitability && seededVitality(x, xb, xc) === xb.vitality, `${what}: habitability back to its own (${xb.habitability}), and life no longer spreads`);
    check(vitalityLoss(x, xb, xc).freeze === 0.05 && /red dwarf/.test(terraformBlocked(x, xb, xc, 'mirrors') ?? ''), `${what}: the seeded life freezes, 5% a turn, and no terraforming can be built`);
  }
  // with the mirrors and the works both taken apart, it freezes too; with one left, it does not
  const y = clone(s);
  const yc = y.colonies[c.id];
  delete yc.structures.atmosphere_works;
  check(!seededLifeUnkept(y, y.bodies[b.id], yc), 'with the mirrors still there, the seeded life is kept');
  delete yc.structures.orbital_mirrors;
  check(seededLifeUnkept(y, y.bodies[b.id], yc) && vitalityLoss(y, y.bodies[b.id], yc).freeze === 0.05, 'with neither left, it freezes');
}

// ---------------------------------------------------------------- the air brings water
{
  const { s, b, c } = settle('barren', (s, x) => (x.water ?? 0) < WORKS_WATER && !terraformBlocked(s, x, undefined, 'works'));
  const w0 = b.water ?? 0;
  queueBuild(s, c.id, 'structure', 'atmosphere_works');
  const q = c.queue.find((x) => x.key === 'atmosphere_works');
  check(!!q, 'Atmosphere Works queued');
  if (q) q.progress = q.cost;
  endTurn(s);
  check((c.structures.atmosphere_works ?? 0) === 1 && (s.bodies[b.id].water ?? 0) === WORKS_WATER, `built: water ${w0} → ${s.bodies[b.id].water}`);
}

// ---------------------------------------------------------------- no use: too cold, or already habitable
{
  const s = clone(base);
  const frozen = Object.values(s.bodies).find((x) => (x.kind === 'ice' || x.kind === 'barren') && !x.colonyId && terraformLit(s, x) && warmest(s, x, { mirrors: true, works: true }) < 200);
  if (frozen) {
    const c = createColony(s, frozen, { kin: 2 });
    check(/No use here: .* frozen hard/.test(structureCheck(s, c, MIRRORS) ?? ''), `${frozen.name} at ${Math.round(warmest(s, frozen))} K: "${structureCheck(s, c, MIRRORS)}"`);
  } else check(false, 'a world too cold to terraform');
  // a living world: past the ceiling it gains nothing, and seeding is not for it
  const living = Object.values(s.bodies).find((x) => (x.kind === 'terran' || x.kind === 'eyeball') && !x.colonyId && terraformLit(s, x) && x.habitability >= TERRAFORM_CEILING);
  if (living) {
    const c = createColony(s, living, { kin: 2 });
    check(/Already as habitable/.test(structureCheck(s, c, MIRRORS) ?? ''), `${living.name} (${Math.round(living.habitability * 100)}%): "${structureCheck(s, c, MIRRORS)}"`);
    c.structures.orbital_mirrors = 1;
    c.structures.atmosphere_works = 1;
    check(habitabilityOf(s, living) === living.habitability, 'and with both somehow there, it is no more habitable');
    check(/life of its own/.test(seedingBlocked(s, living, c) ?? ''), 'seeding is for dead worlds');
  } else check(false, 'a living world above the ceiling');
  // a marginal living world: up to the ceiling, never past it
  const marginal = Object.values(s.bodies).find((x) => !x.colonyId && terraformLit(s, x) && x.habitability >= 0.4 && x.habitability < TERRAFORM_CEILING && terraformSummary(s, x).full > x.habitability);
  if (marginal) {
    const c = createColony(s, marginal, { kin: 2 });
    c.structures.orbital_mirrors = 1;
    c.structures.atmosphere_works = 1;
    const h = habitabilityOf(s, marginal);
    check(h > marginal.habitability && h <= TERRAFORM_CEILING, `${marginal.name} (${marginal.kind}, ${Math.round(marginal.habitability * 100)}%): raised to ${Math.round(h * 100)}%, not past ${Math.round(TERRAFORM_CEILING * 100)}%`);
  } else check(false, 'a marginal world');
  check(SEED_MIN === 0.3, 'seeding needs 30% habitability');
}

// ---------------------------------------------------------------- new stars boil worlds as before
{
  const s = clone(base);
  let same = 0;
  let all = 0;
  for (const b of Object.values(s.bodies)) {
    if (b.colonyId || b.dissolved || !terraformLit(s, b) || !['barren', 'ice', 'super_earth'].includes(b.kind)) continue;
    const before = [boilsUnder(s, b, 'helium_star'), boilsUnder(s, b, 'helium_giant')];
    const c = createColony(s, b, { kin: 1 });
    c.structures.orbital_mirrors = 1;
    c.structures.atmosphere_works = 1;
    const after = [boilsUnder(s, b, 'helium_star'), boilsUnder(s, b, 'helium_giant')];
    all++;
    if (before[0] === after[0] && before[1] === after[1]) same++;
    if (all >= 60) break;
  }
  check(all > 0 && same === all, `a new star boils the same worlds with mirrors and air as without (${same} of ${all})`);
}

// ---------------------------------------------------------------- old saves: nothing changes
{
  let worlds = 0;
  let changed = 0;
  for (const name of ['4fe2404-seed1000-turn87-clock.json.gz', '551fb1a-seed24757-turn71.json.gz', '9eea773-seed1000-turn120-giant.json.gz']) {
    const s = loadSave(name);
    for (const b of Object.values(s.bodies)) {
      worlds++;
      const a = starClimate(s, b);
      const z = starClimate(s, b, undefined, NO_TERRAFORMING);
      if (habitabilityOf(s, b) !== b.habitability || a.mean !== z.mean || a.day !== z.day || a.night !== z.night) changed++;
      if (b.colonyId && seededVitality(s, b, s.colonies[b.colonyId]) !== b.vitality) changed++;
    }
  }
  check(changed === 0, `old saves: every world as it was (${worlds} worlds, ${changed} changed)`);
}

done('TERRAFORM');
