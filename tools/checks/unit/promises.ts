// The game keeps its word (19 Oct; the player, on what the texts promised: "Code matches the
// text"). Four promises the code had not kept:
// - The Long Record: "+1 Accord per settlement" (it gave a quarter);
// - Hunger Studies: "Reveals swarms within detection range and forecasts their paths" (it did
//   neither): a swarm under way is seen only within our eyes' range, a sleeping one in range only
//   with it, and with it the forecast of one coming for us has its date;
// - the Communion Charter: "Swarms merge into your Lattice instead of attacking you" (they had to
//   be tamed first): a swarm at our settlement merges into its Lattice, Taint +8;
// - Harsh: "crueller crossings" (it changed none): a crossing takes a quarter more.
import { newGame } from '../../../src/game/newGame';
import { HARSH_CROSSING, crossingHarm, runCrossing } from '../../../src/game/sim/crossing';
import { createColony } from '../../../src/game/sim/fleets';
import { updateForecasts } from '../../../src/game/sim/forecast';
import { COMMUNION_TAINT, updateHunger } from '../../../src/game/sim/hunger';
import { computeMods } from '../../../src/game/sim/mods';
import { project } from '../../../src/game/sim/projection';
import { swarmArrives, swarmSight } from '../../../src/game/sim/sight';
import { colonies, distLy } from '../../../src/game/sim/util';
import { copyState } from '../../../src/game/save';
import type { GameState, Swarm } from '../../../src/game/types';
import { check, done } from '../lib';

const fresh = (difficulty: 'standard' | 'harsh' = 'standard') => {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty, protonFate: 'stable', civsAsleep: true }) as GameState;
  s.swarms = {};
  s.civ.flags.first_swarm = 1;
  return s;
};
const swarm = (id: string, p: Partial<Swarm>): Swarm => ({ id, systemId: null, from: null, to: null, traveled: 0, distance: 0, size: 3, awake: true, tamed: false, appetite: 1, ...p });

// ---- The Long Record: +1 accord at each settlement
{
  const s = fresh();
  const home = colonies(s)[0];
  // a second settlement, so "per settlement" is seen
  const near = Object.values(s.systems).filter((x) => x.id !== home.systemId && !x.special && x.bodies.some((b) => s.bodies[b].kind !== 'deep' && !s.bodies[b].colonyId)).sort((a, b) => distLy(s.systems[home.systemId], a) - distLy(s.systems[home.systemId], b))[0];
  createColony(s, s.bodies[near.bodies.find((b) => s.bodies[b].kind !== 'deep')!], { kin: 2 });
  s.civ.techs = s.civ.techs.filter((t) => t !== 'the_long_record');
  const without = project(s).accord;
  s.civ.techs.push('the_long_record');
  const withIt = project(s).accord;
  check(Math.abs(withIt - without - colonies(s).length) < 1e-9, `The Long Record adds 1 accord a turn at each of our ${colonies(s).length} settlements (${without.toFixed(2)} → ${withIt.toFixed(2)})`);
}

// ---- Hunger Studies: what we see, and when it comes
{
  const s = fresh();
  const home = s.systems[colonies(s)[0].systemId];
  const range = computeMods(s).detect;
  const byDist = Object.values(s.systems).filter((x) => x.id !== home.id && !x.gone).sort((a, b) => distLy(home, a) - distLy(home, b));
  const inside = byDist.find((x) => distLy(home, x) < range * 0.5)!;
  const far = byDist.filter((x) => distLy(home, x) > range * 4);
  const [fa, fb] = [far[0], far[1]];
  // one under way far beyond our eyes, one under way to us from inside them, one asleep inside them
  s.swarms.far = swarm('far', { from: fa.id, to: fb.id, distance: distLy(fa, fb), traveled: 0 });
  s.swarms.coming = swarm('coming', { from: inside.id, to: home.id, distance: distLy(inside, home), traveled: distLy(inside, home) * 0.25 });
  s.swarms.nest = swarm('nest', { systemId: inside.id, awake: false });
  s.civ.known[inside.id] = 2;
  s.civ.techs = s.civ.techs.filter((t) => t !== 'hunger_studies');
  let seen = swarmSight(s);
  check(!seen(s.swarms.far), `a swarm under way ${Math.round(distLy(home, fa))} ly off, beyond our eyes (${Math.round(range)} ly), is not seen`);
  check(seen(s.swarms.coming), 'one under way within our eyes is seen');
  check(!seen(s.swarms.nest), 'a sleeping one is not seen without Hunger Studies');
  updateForecasts(s);
  let fc = s.civ.forecasts.find((f) => f.kind === 'hunger');
  check(!!fc && !isFinite(fc.dueYears), `without Hunger Studies the swarm coming for us is forecast, without a date (${fc?.title})`);
  s.civ.techs.push('hunger_studies');
  seen = swarmSight(s);
  check(seen(s.swarms.nest) && !seen(s.swarms.far), 'with Hunger Studies the sleeping one in range is seen too, the far one still not');
  updateForecasts(s);
  fc = s.civ.forecasts.find((f) => f.kind === 'hunger');
  const due = swarmArrives(s, s.swarms.coming);
  const want = s.years + (distLy(inside, home) * 0.75) / 0.05;
  check(!!fc && fc.dueYears === due && Math.abs(due - want) < 1e-6 * want, `with it the forecast has the arrival: ${fc ? Math.round(fc.dueYears - s.years) : '?'} years from now (three quarters of the way at 0.05 c)`);
  check(fc?.uid === 'hunger:coming', `the forecast is keyed by its swarm (${fc?.uid})`);
}

// ---- Communion: a swarm at our settlement merges into its Lattice
{
  const s = fresh();
  const c = colonies(s)[0];
  const home = s.systems[c.systemId];
  const from = Object.values(s.systems).filter((x) => x.id !== home.id && !x.gone).sort((a, b) => distLy(home, a) - distLy(home, b))[0];
  const d = distLy(from, home);
  s.swarms.arriving = swarm('arriving', { from: from.id, to: home.id, distance: d, traveled: d * 0.999, size: 4.5 });
  const plain = copyState(s);
  s.civ.charters.push('communion_charter');
  const lattice = c.pops.lattice;
  const taint = s.civ.taint;
  updateHunger(s, 1e6, computeMods(s));
  const after = s.colonies[c.id];
  check(!s.swarms.arriving, 'under Communion the swarm that reaches our settlement is gone into it');
  check(after.pops.lattice === lattice + 3, `${after.pops.lattice - lattice} Lattice from a swarm of size 4.5 (round(4.5 / 1.5) = 3), with a Lattice Foundry (${after.structures.lattice_foundry ?? 0})`);
  check(Math.abs(s.civ.taint - taint - COMMUNION_TAINT) < 1e-9, `its appetite comes with it: Taint +${s.civ.taint - taint}`);
  updateHunger(plain, 1e6, computeMods(plain));
  check(!!plain.swarms.arriving && plain.colonies[c.id]?.pops.lattice === lattice, 'without the charter it arrives as a swarm, and merges into nothing');
  // one already sitting at our star when the charter is enacted merges too, on its next turn
  const sit = fresh();
  const c2 = colonies(sit)[0];
  sit.swarms.sitting = swarm('sitting', { systemId: c2.systemId, size: 2 });
  sit.civ.charters.push('communion_charter');
  const before = c2.pops.lattice;
  updateHunger(sit, 1e6, computeMods(sit));
  check(!sit.swarms.sitting && sit.colonies[c2.id].pops.lattice === before + 1, 'one sitting at our star merges too (size 2: 1 Lattice)');
}

// ---- Harsh: crueller crossings
{
  const s = fresh('harsh');
  check(crossingHarm(s, 'dusk') === HARSH_CROSSING, `at Harsh a crossing takes ×${crossingHarm(s, 'dusk')}`);
  s.civ.techs.push('last_light_protocols');
  check(Math.abs(crossingHarm(s, 'dusk') - 0.5 * HARSH_CROSSING) < 1e-12, `with its protocols, ×${crossingHarm(s, 'dusk')} (half of it)`);
  const lostAt = (difficulty: 'standard' | 'harsh') => {
    const g = fresh(difficulty);
    const col = colonies(g)[0];
    col.pops.kin = 40;
    col.cryo = 0;
    g.civ.energy = 0;
    runCrossing(g, [g.player], { [g.player]: computeMods(g) });
    return 40 - (g.colonies[col.id]?.pops.kin ?? 0);
  };
  const std = lostAt('standard');
  const harsh = lostAt('harsh');
  check(harsh > std && Math.abs(harsh - std * HARSH_CROSSING) <= 1, `the Last Light takes ${harsh} of 40 Kin at Harsh, ${std} at Standard (a quarter more, to the rounding)`);
}

done('PROMISES');
