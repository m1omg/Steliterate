// The governor (27 Oct, the player: "add a governor like in alpha centauri to set a focus on building
// buildings of a certain category pls", "allow me to mark different worlds in system view to set the
// governor to"): a settlement handed one queues, whenever its queue is empty, the structure of its
// kind that gives it the most for what it costs, keeping 10 matter in store; at once when set, and
// again as soon as a build finishes in the turn. Not while asleep; what the player queues comes
// first; with nothing of its kind worth building it says so, and the settlement is idle.
import { newGame } from '../../../src/game/newGame';
import { endTurn } from '../../../src/game/sim/turn';
import { buildCost, buildableStructures, queueBuild } from '../../../src/game/sim/actions';
import { GOVERNOR_KEEPS, governorChoice, isIdle, setGovernor } from '../../../src/game/sim/governor';
import { project, structureEffect } from '../../../src/game/sim/projection';
import { govNoneKey } from '../../../src/game/sim/util';
import { MATTER_AS_ENERGY } from '../../../src/game/sim/economy';
import { STRUCTURE_BY_ID, structureKind } from '../../../src/game/data/structures';
import { migrate } from '../../../src/game/save';
import { check, done, loadSave } from '../lib';

check(structureKind(STRUCTURE_BY_ID.search_foundry) === 'insight' && structureKind(STRUCTURE_BY_ID.protocol_registry) === 'accord', 'a Search Foundry is Insight and a Protocol Registry Accord (they were People)');

const fresh = () => {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
  const c = s.colonies[s.civ.capitalId!];
  c.queue = [];
  s.civ.matter = 500;
  s.civ.energy = Math.max(s.civ.energy, 200);
  return { s, c };
};

// Energy: the most energy here for what it costs, of all it could build
{
  const { s, c } = fresh();
  const ctx = project(s).ctx;
  const best = buildableStructures(s, c)
    .filter((x) => !x.error && structureKind(x.def) === 'energy')
    .map(({ def }) => {
      const cost = buildCost(s, def, false);
      return { id: def.id, v: structureEffect(s, c, def.id, ctx).energy, cost: cost.industry + cost.matter + cost.energy / MATTER_AS_ENERGY };
    })
    .filter((x) => x.v > 0.05)
    .sort((a, b) => b.v / b.cost - a.v / a.cost)[0];
  const err = setGovernor(s, [c.id], 'energy');
  const q = c.queue[0];
  console.log(`  Energy: queued ${q?.key} (best per cost: ${best?.id}, +${best?.v.toFixed(2)} energy for ${best?.cost})`);
  check(!err && c.governor === 'energy' && !!q && q.key === best.id, 'set to Energy, it queues at once the energy structure worth the most here per cost');
  check(!isIdle(s, c), 'and the settlement is not idle');
}

// Matter: a matter structure
{
  const { s, c } = fresh();
  setGovernor(s, [c.id], 'matter');
  const q = c.queue[0];
  console.log(`  Matter: queued ${q?.key}`);
  check(!!q && structureKind(STRUCTURE_BY_ID[q.key]) === 'matter', 'set to Matter, it queues a matter structure');
}

// it keeps 10 matter: Energy's builds all cost 10 here, so with 19 it waits, and says for what; with 20 it builds
{
  const { s, c } = fresh();
  s.civ.matter = 19;
  setGovernor(s, [c.id], 'energy');
  const g = governorChoice(s, c, project(s).ctx);
  console.log(`  Energy with 19 matter: ${g.why}`);
  check(!c.queue.length && !g.pick && /^waiting for 20 matter for a /.test(g.why) && s.civ.flags[govNoneKey(c.id)] === 2, `it never spends the last ${GOVERNOR_KEEPS.matter} matter: it waits (${g.why})`);
  check(!isIdle(s, c), 'waiting, the settlement is not idle');
  s.civ.matter = 20;
  setGovernor(s, [c.id], 'energy');
  check(c.queue.length === 1 && s.civ.matter === 10 && s.civ.flags[govNoneKey(c.id)] === undefined, `with 20 it builds, and 10 are left (${s.civ.matter})`);
}

// waiting for matter, it queues once the turn's income is in, so the build shows while we play
{
  const { s, c } = fresh();
  s.civ.matter = 19;
  setGovernor(s, [c.id], 'energy');
  const before = c.queue.length;
  endTurn(s);
  const q = c.queue[0];
  console.log(`  waiting with 19 matter; after the turn ${s.civ.matter.toFixed(1)} left, queued ${q?.key} at ${q?.progress}`);
  check(before === 0 && !!q && structureKind(STRUCTURE_BY_ID[q.key]) === 'energy' && q.progress === 0 && s.civ.matter >= GOVERNOR_KEEPS.matter, 'waiting for matter, it queues its pick once the turn’s income is in');
}

// a build finishing in the turn is followed at once by the next, with the turn's industry
{
  const { s, c } = fresh();
  c.governor = 'energy';
  const r = queueBuild(s, c.id, 'structure', buildableStructures(s, c).find((x) => !x.error)!.def.id);
  check(r === null, `a build queued by hand (${r})`);
  const item = c.queue[0];
  item.progress = item.cost - 0.01;
  const turn = s.turn;
  endTurn(s);
  const q = c.queue[0];
  console.log(`  after the turn: ${item.key} built (${c.structures[item.key]}), then ${q?.key} at ${q?.progress.toFixed(1)} of ${q?.cost}`);
  check(s.turn === turn + 1 && (c.structures[item.key] ?? 0) > 0 && !!q && structureKind(STRUCTURE_BY_ID[q.key]) === 'energy' && q.progress > 0, 'the build finished, and the next energy build began with the same turn’s industry');
}

// what the player queues comes first
{
  const { s, c } = fresh();
  const hand = buildableStructures(s, c).find((x) => !x.error && structureKind(x.def) !== 'energy')!.def.id;
  queueBuild(s, c.id, 'structure', hand);
  setGovernor(s, [c.id], 'energy');
  check(c.queue.length === 1 && c.queue[0].key === hand, `a build queued by hand stays first and alone (${c.queue.map((q) => q.key).join(', ')})`);
}

// asleep, it picks nothing
{
  const { s, c } = fresh();
  s.civ.dormant = true;
  setGovernor(s, [c.id], 'energy');
  const g = governorChoice(s, c, project(s).ctx);
  check(!c.queue.length && /asleep/.test(g.why), `asleep it queues nothing (${g.why})`);
}

// nothing of its kind worth building: it says so, and the settlement is idle (its spare work goes on)
{
  const { s, c } = fresh();
  for (const x of buildableStructures(s, c)) if (structureKind(x.def) === 'defence') c.structures[x.def.id] = x.def.max;
  setGovernor(s, [c.id], 'defence');
  const g = governorChoice(s, c, project(s).ctx);
  console.log(`  Defence, all built: ${g.why}`);
  check(!c.queue.length && g.none && s.civ.flags[govNoneKey(c.id)] === 1 && isIdle(s, c), 'with nothing of its kind left to build it queues nothing, says so, and the settlement is idle');
  setGovernor(s, [c.id], null);
  check(!c.governor && s.civ.flags[govNoneKey(c.id)] === undefined, 'taken back, the governor and its note are gone');
}

// several at once, as from the system view
{
  const { s, c } = fresh();
  const other = Object.values(s.colonies).find((x) => x.owner === s.civ.id && x.id !== c.id);
  const ids = other ? [c.id, other.id] : [c.id];
  if (other) other.queue = [];
  setGovernor(s, ids, 'energy');
  check(ids.every((id) => s.colonies[id].governor === 'energy'), `set on ${ids.length} settlement${ids.length > 1 ? 's' : ''} at once`);
}

// saves: an older one loads as it was, with no governor; one this game does not know is dropped
{
  const s = loadSave('b1fc6a7-seed1000-turn61-next.json.gz');
  check(Object.values(s.colonies).every((c) => c.governor === undefined), 'an older save loads with no governors');
  const c = s.colonies[s.civ.capitalId!];
  (c as { governor?: string }).governor = 'bogus';
  const m = migrate(s);
  check(m.colonies[c.id].governor === undefined, 'a governor of a kind this game does not know is dropped on load');
}

done('GOVERNOR');
