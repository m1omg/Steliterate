// Finds only where they can be (20 Oct; the player, 16 Oct: "Life Under the Ice" found "about a
// planetless system").
// - Vent life asks for a buried ocean the Water row calls liquid (buriedOcean): around a star, not
//   in a starless Drift, not on a world flung loose, not frozen through; and not on a world falling
//   into its star. Every ocean_ice world is given a buried ocean as it is made, the Drifts' too, so
//   the old test (an ocean under ice, no settlement, not steam) found vent life in Drifts whose
//   Water row says "frozen through" at a few kelvin.
// - A survey offers nothing about a world falling into its star.
// - A find is queued as the survey charts a system, before the universe moves on in that same
//   turn, which can tear the world apart, swallow it, fling it loose or boil it. Once the universe
//   has moved, a find that no longer fits its world is dropped, its mark taken off the world and the
//   find counted as not made, so it can still be made elsewhere. The others stay, in their order.
// - "Kept Warm by Its Neighbours" counts the worlds around a star: not the Deep (it counted as one,
//   so three worlds drifting in a Drift would do), and not a world flung loose or gone.
import { newGame } from '../../../src/game/newGame';
import { ANOMALIES } from '../../../src/game/data/events';
import { bodyClimate, buriedOcean, steamWorld, waterState } from '../../../src/game/physics';
import { pruneFinds } from '../../../src/game/sim/events';
import { survey } from '../../../src/game/sim/fleets';
import { endTurn } from '../../../src/game/sim/turn';
import type { Body, GameState } from '../../../src/game/types';
import { check, done } from '../lib';

const game = (seed: number) => newGame({ seed, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' }) as GameState;
const vent = ANOMALIES.find((a) => a.id === 'vent_life')!;
const resonance = ANOMALIES.find((a) => a.id === 'resonance')!;
const FOUND = new Set(ANOMALIES.map((a) => a.id));
const starless = (s: GameState, b: Body) => ['rogue', 'void'].includes(s.systems[b.systemId].primary.kind);
const water = (s: GameState, b: Body) => {
  const c = bodyClimate(s, b);
  return waterState(b, c, buriedOcean(s, b, c));
};
/** A find queued as the survey queues one. */
const find = (s: GameState, b: Body, id: string) => {
  b.traits.push(id);
  s.fired[`anom_${id}`] = (s.fired[`anom_${id}`] ?? 0) + 1;
  s.pending.push({ uid: `ev_${id}_${b.id}`, defId: `anom_${id}`, data: { bodyId: b.id, systemId: b.systemId } });
};
const pendingFind = (s: GameState, b: Body, id: string) => s.pending.some((p) => p.defId === `anom_${id}` && p.data.bodyId === b.id);

// forty galaxies: the Drifts, and the worlds around stars
let drifts = 0;
let oldDrift = 0;
let driftVent = 0;
let oldDriftKept = 0;
let driftKept = 0;
let starVent = 0;
let frozenVent = 0;
let starKept = 0;
let threeAndDeep = 0;
let example = '';
for (let seed = 1; seed <= 40; seed++) {
  const s = game(seed);
  for (const sys of Object.values(s.systems)) {
    const real = sys.bodies.map((id) => s.bodies[id]).filter((b) => b.kind !== 'deep');
    if (['rogue', 'void'].includes(sys.primary.kind) && real.length) drifts++;
    for (const b of real) {
      const before = (b.kind === 'ocean_ice' || b.traits.includes('subsurface_ocean')) && !b.colonyId && !steamWorld(s, b);
      const keptBefore = ['ice', 'ocean_ice', 'eyeball', 'terran', 'super_earth'].includes(b.kind) && sys.bodies.length >= 4;
      if (starless(s, b)) {
        if (before) oldDrift++;
        if (vent.fits(s, b)) driftVent++;
        if (keptBefore) oldDriftKept++;
        if (resonance.fits(s, b)) driftKept++;
        if (seed === 7 && b.name === 'Drift 5167 II') example = `${b.name}: ${water(s, b)}, vent life ${before ? 'was' : 'was not'} found there, ${vent.fits(s, b) ? 'still is' : 'now is not'}`;
      } else {
        if (vent.fits(s, b)) {
          starVent++;
          if (/frozen through/.test(water(s, b))) frozenVent++;
        }
        if (resonance.fits(s, b)) starKept++;
        else if (keptBefore && real.length === 3) threeAndDeep++;
      }
    }
  }
}
check(oldDrift > 20 && driftVent === 0, `${drifts} starless Drifts in forty galaxies: vent life fitted ${oldDrift} of their worlds, and now none (${driftVent})`);
check(/frozen through/.test(example) && /now is not/.test(example), `seed 7, ${example}`);
check(starVent > 100 && frozenVent === 0, `around stars it fits ${starVent} worlds, none of them frozen through by the Water row (${frozenVent})`);
check(oldDriftKept > 20 && driftKept === 0, `Kept Warm by Its Neighbours fitted ${oldDriftKept} worlds in Drifts, and now none (${driftKept})`);
check(starKept > 100 && threeAndDeep > 0, `around stars it fits ${starKept} worlds; ${threeAndDeep} with only two neighbours, the Deep counted as a third, no longer do`);

// a world flung loose, and one falling into its star
{
  const s = game(1000);
  const ocean = Object.values(s.bodies).find((b) => vent.fits(s, b) && !starless(s, b))!;
  ocean.rogue = true;
  check(!vent.fits(s, ocean), `${ocean.name} flung loose from its star: no vent life (its water ${water(s, ocean)})`);
  delete ocean.rogue;
  ocean.feeding = { start: s.years, tau: 1e9, base: 0, model: 'feed', revealed: true };
  check(!vent.fits(s, ocean), `${ocean.name} falling into its star: no vent life`);
  delete ocean.feeding;
  check(vent.fits(s, ocean), `${ocean.name} as it was: vent life fits`);
  // four worlds around a star, one of them flung loose: the other three are kept warm no longer
  const sys = Object.values(s.systems).find((x) => {
    const real = x.bodies.map((id) => s.bodies[id]).filter((b) => b.kind !== 'deep');
    return !starless(s, real[0] ?? ocean) && real.length === 4 && real.some((b) => resonance.fits(s, b));
  })!;
  const real = sys.bodies.map((id) => s.bodies[id]).filter((b) => b.kind !== 'deep');
  const warm = real.find((b) => resonance.fits(s, b))!;
  const other = real.find((b) => b !== warm)!;
  other.rogue = true;
  const loose = resonance.fits(s, warm);
  delete other.rogue;
  other.dissolved = true;
  const gone = resonance.fits(s, warm);
  delete other.dissolved;
  check(!loose && !gone && resonance.fits(s, warm), `${warm.name}: kept warm by three neighbours, not once one is flung loose or gone`);
}

// the survey: nothing about a world falling into its star
{
  const s = game(2000);
  const sys = Object.values(s.systems).find((x) => !['rogue', 'void'].includes(x.primary.kind) && x.bodies.filter((id) => s.bodies[id].kind !== 'deep').length >= 3)!;
  const real = sys.bodies.map((id) => s.bodies[id]).filter((b) => b.kind !== 'deep');
  const falling = new Set(real.slice(1).map((b) => b.id));
  for (const b of real.slice(1)) b.feeding = { start: s.years, tau: 1e9, base: 0, model: 'feed', revealed: true };
  s.pending.length = 0;
  let about = 0;
  let aboutFalling = 0;
  for (let i = 0; i < 80; i++) {
    survey(s, sys.id);
    for (const p of s.pending.filter((x) => x.defId.startsWith('anom_'))) {
      about++;
      if (falling.has(String(p.data.bodyId))) aboutFalling++;
    }
    s.pending.length = 0;
    for (const id of sys.bodies) s.bodies[id].traits = s.bodies[id].traits.filter((t) => !FOUND.has(t));
    for (const k of Object.keys(s.fired)) if (k.startsWith('anom_')) delete s.fired[k];
  }
  check(about > 10 && aboutFalling === 0, `eighty surveys of ${sys.name}, ${falling.size} of its ${real.length} worlds falling into its star: ${about} finds, ${aboutFalling} of them about a falling world`);
}

// a find about a world the universe changed is dropped; the rest stay, in order
{
  const s = game(3000);
  s.pending.length = 0;
  const oceans = Object.values(s.bodies).filter((b) => vent.fits(s, b) && !starless(s, b)).slice(0, 4);
  const [torn, loose, gone, kept] = oceans;
  s.pending.push({ uid: 'ev_other', defId: 'world_falls', data: { bodyId: torn.id } });
  for (const b of oceans) find(s, b, 'vent_life');
  const lens = Object.values(s.bodies).find((b) => b.kind !== 'deep' && !oceans.includes(b))!;
  find(s, lens, 'lens');
  torn.feeding = { start: s.years, tau: 1e9, base: 0, model: 'feed', revealed: true };
  loose.rogue = true;
  gone.dissolved = true;
  pruneFinds(s);
  check(s.pending.map((p) => p.uid).join() === `ev_other,ev_vent_life_${kept.id},ev_lens_${lens.id}`, `finds about a world falling, flung loose or gone are dropped; the rest stay, in order (${s.pending.map((p) => p.defId).join(', ')})`);
  check(![torn, loose, gone].some((b) => b.traits.includes('vent_life')) && kept.traits.includes('vent_life') && lens.traits.includes('lens'), 'the dropped finds’ marks are taken off their worlds');
  check(s.fired.anom_vent_life === 1 && s.fired.anom_lens === 1, `and counted as not made (vent life ${s.fired.anom_vent_life}, lens ${s.fired.anom_lens})`);
}

// in a whole turn: a find about a world that reaches its dead star's tidal limit within the turn
{
  const s = game(1000);
  s.pending.length = 0;
  const home = s.systems[s.civ.homeSystemId];
  Object.assign(home.primary, { kind: 'white_dwarf', mass: 0.6, lum: 0.02, halo: false });
  delete home.primary.blueAt;
  delete home.primary.whiteAt;
  const ocean = home.bodies.map((id) => s.bodies[id]).find((b) => b.traits.includes('subsurface_ocean') && !b.colonyId)!;
  const fitted = vent.fits(s, ocean);
  find(s, ocean, 'vent_life');
  ocean.inspiralAt = s.years + s.turnLength * 0.05;
  endTurn(s);
  const left = s.pending.filter((p) => p.defId === 'anom_vent_life').length;
  check(fitted && !!ocean.feeding && !pendingFind(s, ocean, 'vent_life') && !ocean.traits.includes('vent_life') && (s.fired.anom_vent_life ?? 0) === left, `${ocean.name}, found as the turn began, reached its white dwarf's tidal limit within it: the find is gone with it (${ocean.kind}, ${left} other finds of vent life waiting)`);
}

done('FINDS');
