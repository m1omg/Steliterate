// Ways that meet (living neighbours, phase 5). The sleepers wake for a new star near them and set
// out for it at once. The Tessellate keeps agreements to the letter: it never renounces a pact,
// pays its side of Mutual Aid even while failing, and two breaches of ours end everything. The
// Choir would gather those of our Echoes who wish it. A partner living at a new star keeps its
// clock with us, at half the cost. In the Black Hole Age a hole's spin is a commons: those who
// live there draw on it, a partner half.
import { autoPlay } from '../../../src/game/auto';
import { newGame } from '../../../src/game/newGame';
import { endTurn } from '../../../src/game/sim/turn';
import { resolveSurvivorSignal } from '../../../src/game/sim/survivors';
import { deliverSignals, voiceClock } from '../../../src/game/sim/signals';
import { AID_EVERY, pactsTurn, theirPacts } from '../../../src/game/sim/pacts';
import { CHOIR_TAKES, SPIN_DRAW, choirWish, drawTheirSpin, spinSharers, wakeForNewStar } from '../../../src/game/sim/ways';
import { starClockTerms, turnStep } from '../../../src/game/sim/flare';
import { createColony } from '../../../src/game/sim/fleets';
import { GIANT_LIFE } from '../../../src/game/physics';
import { reserveCapacity } from '../../../src/game/sim/economy';
import { computeMods } from '../../../src/game/sim/mods';
import { logTurnLength } from '../../../src/game/eras';
import { calendarEra } from '../../../src/game/fate';
import { colonies, distLy } from '../../../src/game/sim/util';
import type { GameState, StarSystem, Survivor } from '../../../src/game/types';
import { check, done } from '../lib';

const clone = (s: GameState) => JSON.parse(JSON.stringify(s)) as GameState;
const play = (seed: number, until: (s: GameState) => boolean, fate: 'stable' | 'decays' | 'curvature' = 'stable') => {
  const s = newGame({ seed, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: fate });
  for (let g = 0; g < 900 && !s.outcome && !until(s); g++) {
    autoPlay(s, 'competent');
    endTurn(s);
  }
  s.pending.length = 0;
  s.signals.length = 0;
  s.civ.taint = 0;
  return s;
};
/** One civilization alive, in contact and in step with us; the others gone. */
const only = (s: GameState, way: Survivor['way']) => {
  const sv = Object.values(s.survivors)[0];
  for (const o of Object.values(s.survivors)) if (o !== sv) o.alive = false;
  Object.assign(sv, { alive: true, contact: true, way, health: 0.8, pop: 24, disposition: 30, lastSent: -99, systems: [sv.homeSystemId] });
  delete sv.fate;
  delete sv.pacts;
  delete sv.claim;
  sv.clock = voiceClock(s, logTurnLength(turnStep(s)));
  return sv;
};
const near = (s: GameState, sv: Survivor) =>
  Object.values(s.systems)
    .filter((x) => x.id !== sv.homeSystemId && !x.special && !x.gone && distLy(x, s.systems[sv.homeSystemId]) <= 100 && !Object.values(s.colonies).some((c) => c.systemId === x.id))
    .sort((a, b) => distLy(a, s.systems[sv.homeSystemId]) - distLy(b, s.systems[sv.homeSystemId]));
/** Light a new star (a helium giant) at a system, with a cold world by it. */
const light = (s: GameState, sys: StarSystem) => {
  sys.primary.kind = 'helium_giant';
  sys.primary.bornAt = s.years;
  sys.primary.diesAt = s.years + GIANT_LIFE;
  const b = sys.bodies.map((id) => s.bodies[id]).find((x) => x && !x.dissolved && x.kind !== 'deep');
  if (b) b.kind = 'ice';
};

const degenerate = play(8919, (s) => s.era === 'degenerate' && s.eta >= 17.6);

// ---------------------------------------------------------------- the sleepers wake
{
  const s = clone(degenerate);
  const sv = only(s, 'dormant');
  sv.health = 0.3;
  check(!wakeForNewStar(s, sv), 'no new star near them: they sleep on');
  const sys = near(s, sv)[0];
  light(s, sys);
  check(wakeForNewStar(s, sv) && sv.claim?.systemId === sys.id, `a new star lights at ${sys.name}: they wake, and set out for it at once`);
  check(s.signals.some((x) => x.kind === 'woken' && /our ships are already on their way/.test(x.text)), 'and tell us so');
  const t = clone(degenerate);
  const tv = only(t, 'dormant');
  const tsys = t.systems[sys.id];
  light(t, tsys);
  const w = tsys.bodies.map((id) => t.bodies[id]).find((x) => x && !x.dissolved && !x.colonyId)!;
  createColony(t, w, { echoes: 1 });
  check(!wakeForNewStar(t, tv), 'if we got there first, it is not theirs to race for');
}

// ---------------------------------------------------------------- the Tessellate, to the letter
{
  const s = clone(degenerate);
  const sv = only(s, 'lattice');
  sv.pacts = { aid: s.turn, archives: s.turn };
  sv.disposition = -50;
  theirPacts(s, sv, () => 1);
  check(!!sv.pacts?.aid, 'it never renounces a pact, whatever it thinks of us');
  const o = clone(s);
  o.survivors[sv.id].way = 'upload';
  theirPacts(o, o.survivors[sv.id], () => 1);
  check(!o.survivors[sv.id].pacts, 'where another civilization would');
  // it pays its side even while failing
  sv.health = 0.2;
  s.civ.energy = 1;
  s.civ.flags.last_energy_net = -5;
  const n = s.signals.length;
  pactsTurn(s);
  check(s.signals.slice(n).some((x) => x.kind === 'aid_answer'), 'it pays its side of Mutual Aid even while failing');
  // and holds us to ours
  check(s.civ.flags[`breach_${sv.id}`] === 1 && s.signals.some((x) => x.kind === 'breach'), 'we could not pay ours: a breach, logged');
  s.turn += AID_EVERY;
  delete s.civ.flags[`pact_aid_in_${sv.id}`];
  pactsTurn(s);
  check(!sv.pacts && s.signals.some((x) => x.kind === 'pact_ended'), 'two breaches, and every agreement ends, as their terms provide');
}

// ---------------------------------------------------------------- the Choir gathers
{
  const s = clone(degenerate);
  const sv = only(s, 'chorus');
  const cap = colonies(s)[0];
  cap.pops.echoes = Math.max(cap.pops.echoes, 6);
  const echoes = colonies(s).reduce((a, c) => a + c.pops.echoes, 0);
  check(choirWish(s, sv), 'the Choir asks for those of our Echoes who wish to come');
  check(!choirWish(s, sv), 'now and then, not every turn');
  const sig = s.signals.find((x) => x.kind === 'choir_wish')!;
  const k = clone(s);
  s.years = Math.max(s.years, sig.arriveYears);
  deliverSignals(s);
  const standing = s.civ.standing.echoes;
  const pop = sv.pop;
  check(resolveSurvivorSignal(s, sig.uid, 'let') === null, 'we let those who wish go');
  check(colonies(s).reduce((a, c) => a + c.pops.echoes, 0) === echoes - CHOIR_TAKES && sv.pop === pop + CHOIR_TAKES, `${CHOIR_TAKES} Echoes leave us and join the Choir`);
  check(s.civ.standing.echoes === Math.min(100, standing + 3) && (sv.news ?? []).some((x) => x.delta === 12), 'the Echoes think better of us, and so will the Choir when they arrive');
  const ksig = k.signals.find((x) => x.kind === 'choir_wish')!;
  k.years = Math.max(k.years, ksig.arriveYears);
  deliverSignals(k);
  const kd = k.survivors[sv.id].disposition;
  const ks = k.civ.standing.echoes;
  resolveSurvivorSignal(k, ksig.uid, 'keep');
  check(k.civ.standing.echoes === Math.max(0, ks - 3) && k.survivors[sv.id].disposition === kd - 5, 'asking them to stay: the Echoes resent it, and the Choir is hurt');
}

// ---------------------------------------------------------------- a new star's clock, shared
{
  const s = clone(degenerate);
  const sv = only(s, 'dormant');
  const sys = Object.values(s.systems).find((x) => !x.gone && (x.primary.kind === 'white_dwarf' || x.primary.kind === 'black_dwarf') && !Object.values(s.colonies).some((c) => c.systemId === x.id))!;
  light(s, sys);
  s.civ.known[sys.id] = 2;
  for (const k of ['star_until', 'star_step', 'star_next', 'star_flash']) delete s.civ.flags[k];
  s.civ.pace = 0;
  s.civ.energy = Math.floor(reserveCapacity(s, computeMods(s)));
  const alone = starClockTerms(s, sys);
  sv.systems.push(sys.id);
  sv.pacts = { archives: s.turn };
  const shared = starClockTerms(s, sys);
  check(alone.possible && alone.cost > 0, `a clock with ${sys.name} costs ${alone.cost} alone`);
  check(shared.shared === sv.name && shared.cost === Math.ceil(alone.cost / 2), `with ${sv.name} living there, bound to us, half (${shared.cost})`);
  delete sv.pacts;
  check(starClockTerms(s, sys).cost === alone.cost, 'without a pact, nothing is shared');
}

// ---------------------------------------------------------------- spin, a commons
{
  const s = play(1000, (g) => calendarEra(g) === 'blackhole');
  check(calendarEra(s) === 'blackhole', `a stable game in the Black Hole Age (η ${s.eta.toFixed(1)})`);
  const sv = only(s, 'upload');
  const hole = Object.values(s.systems).find((x) => !x.gone && x.primary.kind === 'black_hole' && x.primary.spin > 10)!;
  sv.systems.push(hole.id);
  const spin = hole.primary.spin;
  const d = drawTheirSpin(s, sv);
  check(Math.abs(d - SPIN_DRAW * sv.pop * sv.health) < 1e-9 && Math.abs(hole.primary.spin - (spin - d)) < 1e-9, `a civilization at a hole draws on its spin (${d.toFixed(2)} a turn)`);
  sv.pacts = { aid: s.turn };
  const d2 = drawTheirSpin(s, sv);
  check(Math.abs(d2 - d / 2) < 1e-9, 'a partner only half');
  check(spinSharers(s, hole.id).includes(sv), 'and the hole’s panel says who shares it');
}
done('WAYS');
