// The others become civilizations (the new version, docs/plans/new-version.md, part 2a-2): each
// neighbour is a civilization of its own, playing the same game as ours.
// - It begins as ours does, by the same rules: its capital on a world of its home, people of its
//   way, every structure where such a structure may stand and its research known, energy to spare
//   (and matter, or matter in store where its ground gives none), a probe and an escort.
// - Generation is untouched: the galaxy, the swarms and the neighbours' records are those of a
//   game whose neighbours sleep (civsAsleep), and the main random stream is where it was; a seed's
//   neighbours begin the same every time.
// - It plays every turn, at our pace, and we know it by its civilization: its people, health and
//   stars read from it (syncSurvivor).
// - What passes between us is real, through the outbox: refugees leave its settlements, a trade
//   pays it what we pay, a shared work feeds it as it feeds us (by its star's light).
// - Its story and its game end together: one whose game ends is gone to us, its settlements empty.
import { STRUCTURE_BY_ID } from '../../../src/game/data/structures';
import { asCiv, flushOutbox, send } from '../../../src/game/civs';
import { newGame } from '../../../src/game/newGame';
import { project } from '../../../src/game/sim/projection';
import { endTurn } from '../../../src/game/sim/turn';
import { coloniesOf, marks } from '../../../src/game/sim/util';
import { copyState } from '../../../src/game/save';
import { livedShare } from '../../../src/game/sim/flare';
import { ARCHIVE_SHARE, NOTES_EVERY, pactsTurn } from '../../../src/game/sim/pacts';
import { availableTechs } from '../../../src/game/sim/research';
import { sourceLight } from '../../../src/game/physics';
import { sendSignal } from '../../../src/game/sim/signals';
import { jointYield, resolveSurvivorSignal } from '../../../src/game/sim/survivors';
import { autoPlay } from '../../../src/game/auto';
import type { Colony, GameState } from '../../../src/game/types';
import { check, done } from '../lib';

const SEEDS = [1000, 8919, 80190, 88109, 2, 7];

/** What is wrong with a structure standing where it does, by the rules a player builds by; null if nothing. */
function misplaced(s: GameState, c: Colony, id: string): string | null {
  const d = STRUCTURE_BY_ID[id];
  const b = s.bodies[c.bodyId];
  const kind = s.systems[c.systemId].primary.kind;
  if (!d) return `${id}: no such structure`;
  if (d.tech && !s.civs[c.owner].techs.includes(d.tech)) return `${id} without ${d.tech}`;
  if ((c.structures[id] ?? 0) > d.max) return `${c.structures[id]} ${id}, at most ${d.max}`;
  if (d.notBodies?.includes(b.kind) || (d.bodies && !d.bodies.includes(b.kind) && !d.bodies.includes('deep'))) return `${id} on a ${b.kind}`;
  if (d.primaries && !d.primaries.includes(kind)) return `${id} at a ${kind}`;
  if (d.notAt?.includes(kind)) return `${id} at a ${kind}`;
  return null;
}

// ---- the start
const wrong: string[] = [];
const poor: string[] = [];
const ways = new Set<string>();
for (const seed of SEEDS) {
  const s = newGame({ seed, survivors: 3 });
  for (const sv of Object.values(s.survivors)) {
    const civ = s.civs[sv.id];
    const cs = coloniesOf(s, sv.id);
    const cap = cs.find((c) => c.id === civ?.capitalId);
    if (!civ || !cap || cs.length !== 1 || cap.systemId !== sv.homeSystemId) {
      wrong.push(`${seed} ${sv.name}: no capital at home`);
      continue;
    }
    ways.add(sv.way);
    const people = cap.pops.kin + cap.pops.echoes + cap.pops.chorus + cap.pops.lattice + cap.cryo;
    const lead = { garden: cap.pops.kin, upload: cap.pops.echoes, chorus: cap.pops.chorus, dormant: cap.cryo, lattice: cap.pops.lattice, fork: cap.pops.kin }[sv.way];
    if (people < 4 || lead * 2 < people) wrong.push(`${seed} ${sv.name}: ${JSON.stringify(cap.pops)} cryo ${cap.cryo}, not led by its way`);
    for (const id of Object.keys(cap.structures)) {
      const why = misplaced(s, cap, id);
      if (why) wrong.push(`${seed} ${sv.name}: ${why}`);
    }
    const ships = Object.values(s.fleets).filter((f) => f.owner === sv.id).flatMap((f) => f.ships.map((x) => x.cls));
    if (ships.sort().join(' ') !== 'probe warden') wrong.push(`${seed} ${sv.name}: ships ${ships.join(' ')}`);
    asCiv(s, sv.id, () => {
      const p = project(s);
      const e = p.energyIn - p.energyOut;
      const m = p.matterIn - p.matterOut;
      // energy to spare; and matter, or enough in store for many turns
      if (e <= 0 || (m <= 0 && civ.matter < 150)) poor.push(`${seed} ${sv.name}: ${e.toFixed(1)} energy, ${m.toFixed(1)} matter a turn, ${civ.matter} in store`);
    });
  }
}
check(wrong.length === 0, `each neighbour begins at home, led by its way, every structure where it may stand and its research known, with a probe and an escort${wrong.length ? `; not: ${wrong.slice(0, 4).join('; ')}` : ''}`);
check(poor.length === 0, `and each begins with energy to spare, and matter or a store of it${poor.length ? `; not: ${poor.slice(0, 4).join('; ')}` : ''}`);
check(ways.size >= 4, `(the ways seen: ${[...ways].sort().join(', ')})`);

// ---- generation untouched, and the same every time
{
  const seed = 8919;
  const awake = newGame({ seed, survivors: 3 });
  const asleep = newGame({ seed, survivors: 3, civsAsleep: true });
  const bodies = (s: GameState) => JSON.stringify(Object.values(s.bodies).map((b) => ({ ...b, colonyId: null })));
  check(JSON.stringify(awake.systems) === JSON.stringify(asleep.systems) && bodies(awake) === bodies(asleep), 'the galaxy is the same whether the neighbours play or sleep');
  check(JSON.stringify(awake.swarms) === JSON.stringify(asleep.swarms) && JSON.stringify(awake.survivors) === JSON.stringify(asleep.survivors) && awake.rng === asleep.rng, 'and so are the swarms, the neighbours’ records and the main random stream');
  check(Object.keys(asleep.civs).join(' ') === 'us' && Object.keys(awake.civs).sort().join(' ') === ['us', ...Object.keys(awake.survivors)].sort().join(' '), `asleep, only we play; awake, every neighbour is a civilization (${Object.keys(awake.civs).join(', ')})`);
  const again = newGame({ seed, survivors: 3 });
  check(JSON.stringify(again.civs) === JSON.stringify(awake.civs) && JSON.stringify(again.colonies) === JSON.stringify(awake.colonies), 'a seed’s neighbours begin the same every time');
}

// ---- it plays every turn, at our pace, and we know it by its civilization
{
  const s = newGame({ seed: 1000, survivors: 3 });
  s.civ.pace = -1;
  const ids = Object.keys(s.survivors);
  for (let i = 0; i < 12; i++) {
    autoPlay(s, 'competent');
    endTurn(s);
  }
  check(ids.every((id) => s.civs[id].stats.pops.length === 12), `each played every turn with us (${ids.map((id) => s.civs[id].stats.pops.length).join(', ')} turns of its own record)`);
  check(ids.every((id) => s.civs[id].pace === 0 || s.civs[id].pace === s.civ.pace), 'and never set a pace of its own');
  const known = ids.every((id) => {
    const sv = s.survivors[id];
    const cs = coloniesOf(s, id);
    const people = cs.reduce((n, c) => n + c.pops.kin + c.pops.echoes + 2 * c.pops.chorus + c.pops.lattice + c.pops.coldminds + c.cryo, 0);
    return sv.pop === people * 3 && cs.every((c) => sv.systems.includes(c.systemId)) && sv.systems[0] === s.colonies[s.civs[id].capitalId!]?.systemId;
  });
  check(known, `we know each by its civilization: its people and its stars, its capital’s first (${ids.map((id) => `${s.survivors[id].adjective} ${Math.round(s.survivors[id].pop)} in ${s.survivors[id].systems.length}`).join(', ')})`);
  check(ids.every((id) => s.survivors[id].health > 0.15 && s.survivors[id].health <= 1), `and its health from its reserve, its settlements and its will (${ids.map((id) => s.survivors[id].health.toFixed(2)).join(', ')})`);

  // what passes between us is real: who leaves it leaves its settlements, refugees we take in among them
  const id = ids[0];
  const theirPeople = () => coloniesOf(s, id).reduce((n, c) => n + c.pops.kin + c.pops.echoes + c.pops.chorus + c.pops.lattice + c.pops.coldminds, 0);
  const before = theirPeople();
  send(s, id, { people: { thread: 'kin', n: -2 } });
  flushOutbox(s);
  check(theirPeople() === before - 2, `two who leave it leave its settlements (${before} → ${theirPeople()})`);
  {
    const sv = s.survivors[id];
    const was = theirPeople();
    const ours = coloniesOf(s, s.player).reduce((n, c) => n + c.pops.kin + c.pops.echoes + c.cryo, 0);
    const sig = sendSignal(s, { from: sv.id, kind: 'refugees', distanceLy: 0, title: 'refugees', text: '', data: { n: 2 }, choices: [{ id: 'accept', label: 'accept' }, { id: 'refuse', label: 'refuse' }] });
    const err = resolveSurvivorSignal(s, sig.uid, 'accept');
    flushOutbox(s);
    const came = coloniesOf(s, s.player).reduce((n, c) => n + c.pops.kin + c.pops.echoes + c.cryo, 0) - ours;
    check(err === null && came > 0 && theirPeople() === was - came, `refugees we take in come from its settlements (${came} came; theirs ${was} → ${theirPeople()})`);
    // a trade pays them what we pay
    const m = s.civs[id].matter;
    const offer = sendSignal(s, { from: sv.id, kind: 'trade', distanceLy: 0, title: 'trade', text: '', data: { want: 'matter', ask: 30, insight: 20 }, choices: [{ id: 'trade', label: 'trade' }, { id: 'decline', label: 'decline' }] });
    s.civ.matter = Math.max(s.civ.matter, 100);
    const ourM = s.civ.matter;
    check(resolveSurvivorSignal(s, offer.uid, 'trade') === null && (flushOutbox(s), s.civs[id].matter === m + 30 && s.civ.matter === ourM - 30), `a trade pays them what we pay (30 matter: theirs ${Math.round(m)} → ${Math.round(s.civs[id].matter)})`);
    // a shared work feeds both its builders: the same turn with it and without
    const a = copyState(s);
    const b = copyState(s);
    marks(b.survivors[id]).joint = 1;
    a.civs[id].energy = b.civs[id].energy = 10;
    const pf = livedShare(a);
    endTurn(a);
    endTurn(b);
    const want = jointYield(a, a.survivors[id]) * pf;
    const got = b.civs[id].energy - a.civs[id].energy;
    check(want > 0 && Math.abs(got - want) < 1e-6, `a shared work we built together feeds them too: ${got.toFixed(2)} energy more a turn (its field gathers their star’s light: 6 under a full red sun)`);
  }

  // a shared work's field gathers its star's light: under a dark star, almost nothing
  {
    const g = copyState(s);
    const sv = g.survivors[ids[0]];
    const lit = jointYield(g, sv);
    const dark = Object.values(g.systems).find((x) => !x.gone && sourceLight(g, x, g.years, 0).light < 0.03);
    if (dark) sv.homeSystemId = dark.id;
    check(lit > 3 && !!dark && jointYield(g, sv) < 0.2, `a shared work gathers its star’s light: ${lit.toFixed(1)} a turn by a red sun, ${dark ? jointYield(g, sv).toFixed(2) : '?'} by a dark one`);
  }
  // Open Archives with a civilization of its own: a part of what it learns, and notes only on what it knows
  {
    const g = copyState(s);
    const sv = g.survivors[ids[0]];
    const theirs = g.civs[sv.id];
    theirs.flags.last_insight = 50;
    const unknown = availableTechs(g).find((t) => !t.taint && !theirs.techs.includes(t.id))!;
    g.civ.researching = unknown.id;
    sv.pacts = { archives: g.turn - NOTES_EVERY };
    const r0 = g.civ.research[unknown.id] ?? 0;
    pactsTurn(g);
    const read = (g.civ.research[unknown.id] ?? 0) - r0;
    check(Math.abs(read - 50 * ARCHIVE_SHARE) < 1e-9, `Open Archives: we read ${read.toFixed(2)} a turn of the ${50} it learns, and no notes on what it does not know`);
    theirs.techs.push(unknown.id);
    const r1 = g.civ.research[unknown.id] ?? 0;
    pactsTurn(g);
    check((g.civ.research[unknown.id] ?? 0) - r1 > 50 * ARCHIVE_SHARE + 1, `once it knows it, its notes on it come (${((g.civ.research[unknown.id] ?? 0) - r1).toFixed(0)} insight)`);
  }

  // its story and its game end together
  const sv = s.survivors[ids[1]];
  s.civs[sv.id].outcome = { kind: 'defeat', ending: 'test', turn: s.turn, eta: s.eta };
  autoPlay(s, 'competent');
  endTurn(s);
  check(!sv.alive && sv.fate === 'faded' && coloniesOf(s, sv.id).length === 0 && !Object.values(s.fleets).some((f) => f.owner === sv.id), `one whose game is over is gone to us, its settlements and ships with it (${sv.name}: ${sv.fate})`);
}

done('OTHERS');
