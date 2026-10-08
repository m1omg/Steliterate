// Expansion (living neighbours, phase 3). A thriving civilization sends settlers to the stars of
// its cluster that suit its way of life (gardens: living worlds; uploads and the Choir: embers and
// holes; sleepers: cold worlds by new stars; the Tessellate: brown dwarfs and belts), never to a
// star we live at or another's; they cross at 0.02 c, and we see the star is theirs when its
// light reaches us. Every new star eases their decline. The Hunger smells them; when it feeds at
// one of their stars they ask for warships, and remember whether we came, and whether ours fought.
import { autoPlay } from '../../../src/game/auto';
import { newGame } from '../../../src/game/newGame';
import { endTurn } from '../../../src/game/sim/turn';
import { resolveSurvivorSignal, updateSurvivors } from '../../../src/game/sim/survivors';
import { deliverSignals, voiceClock } from '../../../src/game/sim/signals';
import { CLAIM_REACH, CLAIM_SPEED, PROMISE_TURNS, askAgainstHunger, claimEase, claimTarget, expand, foughtFor, judgePromise, seenThere, suits, theirWarmth } from '../../../src/game/sim/claims';
import { swarmsHunt } from '../../../src/game/sim/hunger';
import { createColony, newFleet } from '../../../src/game/sim/fleets';
import { computeMods } from '../../../src/game/sim/mods';
import { turnStep } from '../../../src/game/sim/flare';
import { logTurnLength } from '../../../src/game/eras';
import { capital, distLy } from '../../../src/game/sim/util';
import type { GameState, StarSystem, Survivor } from '../../../src/game/types';
import { check, done } from '../lib';

const clone = (s: GameState) => JSON.parse(JSON.stringify(s)) as GameState;
const base = (() => {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' });
  for (let g = 0; g < 30 && !s.outcome; g++) {
    autoPlay(s, 'competent');
    endTurn(s);
  }
  s.pending.length = 0;
  s.signals.length = 0;
  s.civ.taint = 0;
  return s;
})();
/** A copy of the game with one civilization alive, in contact, in step and thriving. */
const setup = (way: Survivor['way']) => {
  const s = clone(base);
  const sv = Object.values(s.survivors)[0];
  for (const o of Object.values(s.survivors)) if (o !== sv) o.alive = false;
  Object.assign(sv, { alive: true, contact: true, way, health: 0.9, pop: 24, disposition: 10, lastSent: -99, systems: [sv.homeSystemId] });
  delete sv.fate;
  delete sv.claim;
  delete sv.claimedAt;
  sv.clock = voiceClock(s, logTurnLength(turnStep(s)));
  return { s, sv };
};
const theirTurn = (s: GameState) => {
  const step = turnStep(s);
  updateSurvivors(s, logTurnLength(step), computeMods(s), step.turnLength);
};
const later = (s: GameState, years: number) => {
  s.years += years;
  s.eta = Math.log10(s.years);
};
/** A star near their home, made to suit (or not) by changing what is there. */
const nearby = (s: GameState, sv: Survivor) =>
  Object.values(s.systems)
    .filter((x) => x.id !== sv.homeSystemId && !x.special && !x.gone && distLy(x, s.systems[sv.homeSystemId]) <= CLAIM_REACH)
    .sort((a, b) => distLy(a, s.systems[sv.homeSystemId]) - distLy(b, s.systems[sv.homeSystemId]));

// ---------------------------------------------------------------- what suits whom
{
  const { s, sv } = setup('upload');
  const [a] = nearby(s, sv);
  a.primary.kind = 'white_dwarf';
  check(suits(s, sv, a), 'uploads: an ember (a white dwarf) suits them');
  a.primary.kind = 'black_hole';
  check(suits(s, sv, a), 'and a hole');
  a.primary.kind = 'red_dwarf';
  check(!suits(s, sv, a), 'a red dwarf does not');
  sv.way = 'lattice';
  a.primary.kind = 'brown_dwarf';
  check(suits(s, sv, a), 'the Tessellate: a brown dwarf');
  sv.way = 'dormant';
  check(!suits(s, sv, a), 'the sleepers: not a brown dwarf');
  a.primary.kind = 'collision_star';
  const cold = a.bodies.map((id) => s.bodies[id]).find((b) => b && ['barren', 'ice', 'ocean_ice'].includes(b.kind) && !b.dissolved);
  check(!cold || suits(s, sv, a), 'the sleepers: a cold world by a new star');
  sv.way = 'garden';
  check(!suits(s, sv, a) || a.bodies.some((id) => s.bodies[id] && s.bodies[id].vitality > 0), 'gardens: only a living world');
}

// ---------------------------------------------------------------- never ours, never another's
{
  const { s, sv } = setup('upload');
  const near = nearby(s, sv);
  for (const x of near) x.primary.kind = 'red_dwarf';
  const [a, b] = near;
  a.primary.kind = 'white_dwarf';
  b.primary.kind = 'white_dwarf';
  check(claimTarget(s, sv)?.sys.id === a.id, `the nearest that suits them (${a.name})`);
  const world = a.bodies.map((id) => s.bodies[id]).find((x) => x && !x.dissolved && !x.colonyId)!;
  createColony(s, world, { echoes: 1 });
  check(claimTarget(s, sv)?.sys.id === b.id, 'never a star we live at');
  const other = Object.values(s.survivors).find((o) => o !== sv)!;
  Object.assign(other, { alive: true, systems: [other.homeSystemId, b.id] });
  delete other.fate;
  check(claimTarget(s, sv) === null, 'nor one another civilization lives at');
}

// ---------------------------------------------------------------- settlers cross, and the star is theirs
{
  const { s, sv } = setup('upload');
  const near = nearby(s, sv);
  for (const x of near) x.primary.kind = 'red_dwarf';
  const a = near[0];
  a.primary.kind = 'neutron_star';
  const d = distLy(a, s.systems[sv.homeSystemId]);
  expand(s, sv, () => 1);
  check(!sv.claim, 'most turns they send no one');
  expand(s, sv, () => 0);
  check(sv.claim?.systemId === a.id && Math.abs(sv.claim.at - (s.years + d / CLAIM_SPEED)) < 1e-6 * s.years, `settlers set out for ${a.name}, ${d.toFixed(0)} ly at ${CLAIM_SPEED} c`);
  later(s, (d / CLAIM_SPEED) * 0.5);
  expand(s, sv, () => 0);
  check(!sv.systems.includes(a.id), 'not there yet');
  const h = sv.health;
  later(s, d / CLAIM_SPEED);
  expand(s, sv, () => 0);
  check(sv.systems.includes(a.id) && sv.claimedAt?.[a.id] === s.years && Math.abs(sv.health - (h + 0.05)) < 1e-9, 'they arrive: the star is theirs, and a new source lifts them');
  check(Math.abs(claimEase(s, sv) - 1 / 1.25) < 1e-9, `it eases their decline (drain ×${claimEase(s, sv).toFixed(2)})`);
  const cap = s.systems[capital(s)!.systemId];
  const back = distLy(a, cap);
  check(!seenThere(s, sv, a.id), `we cannot see it yet: its light is ${back.toFixed(0)} ly from us`);
  later(s, back);
  check(seenThere(s, sv, a.id), 'when the light arrives, we see it');
  check(theirWarmth(s, a.id) > 0 && theirWarmth(s, near[1].id) === 0, `the Hunger smells them there (${theirWarmth(s, a.id).toFixed(1)})`);
  // settlers who find the star taken turn back
  const t = setup('upload');
  const tn = nearby(t.s, t.sv);
  for (const x of tn) x.primary.kind = 'red_dwarf';
  tn[0].primary.kind = 'white_dwarf';
  expand(t.s, t.sv, () => 0);
  const w = tn[0].bodies.map((id) => t.s.bodies[id]).find((x) => x && !x.dissolved && !x.colonyId)!;
  createColony(t.s, w, { echoes: 1 });
  later(t.s, 1e12);
  expand(t.s, t.sv, () => 1);
  check(!t.sv.systems.includes(tn[0].id) && !t.sv.claim, 'if we settled it first, their settlers find it taken');
}

// ---------------------------------------------------------------- a second star, in their turn
{
  const { s, sv } = setup('upload');
  const a = clone(s);
  const b = clone(s);
  const [x] = nearby(b, b.survivors[sv.id]);
  b.survivors[sv.id].systems.push(x.id);
  theirTurn(a);
  theirTurn(b);
  const ha = a.survivors[sv.id].health - 0.9;
  const hb = b.survivors[sv.id].health - 0.9;
  const sign = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(4)}`;
  check(hb > ha, `a second star slows their decline (health ${sign(hb)} this turn, against ${sign(ha)} with one)`);
}

// ---------------------------------------------------------------- the Hunger at their star
{
  const { s, sv } = setup('upload');
  const [a] = nearby(s, sv);
  sv.systems.push(a.id);
  sv.claimedAt = { [a.id]: 0 };
  const sw = { id: 'hgx', systemId: a.id, from: null, to: null, traveled: 0, distance: 0, size: 1.5, awake: true, tamed: false, appetite: 1 };
  s.swarms[sw.id] = sw;
  check(askAgainstHunger(s, sv), 'a swarm feeds at one of their stars: they ask us for warships');
  const sig = s.signals.find((x) => x.kind === 'swarm_plea')!;
  check(sig.choices[0].label === 'We will send warships' && String(sig.data.systemId) === a.id, `"${sig.title}"`);
  check(!askAgainstHunger(s, sv), `once in ${PROMISE_TURNS} turns`);
  s.years = Math.max(s.years, sig.arriveYears);
  deliverSignals(s);
  check(resolveSurvivorSignal(s, sig.uid, 'promise') === null && sv.promised?.systemId === a.id, 'we promise');
  // a broken promise, while the swarm still feeds there
  const broken = clone(s);
  broken.turn += PROMISE_TURNS;
  const bsv = broken.survivors[sv.id];
  const d0 = bsv.disposition;
  judgePromise(broken, bsv);
  check(bsv.disposition === d0 - 10 && !bsv.promised, 'if we never come, they remember it (−10)');
  // the swarm went elsewhere: nothing to judge
  const moot = clone(s);
  moot.turn += PROMISE_TURNS;
  delete moot.swarms[sw.id];
  const msv = moot.survivors[sv.id];
  judgePromise(moot, msv);
  check(msv.disposition === d0 && !msv.promised, 'if the swarm left anyway, nothing is held against us');
  // our warships go, and fight it there
  const f = newFleet(s, a.id, ['warden', 'warden', 'warden']);
  f.order = 'idle';
  const before = sv.disposition;
  for (let i = 0; i < 30 && s.swarms[sw.id]; i++) swarmsHunt(s, computeMods(s));
  check(!s.swarms[sw.id] && sv.disposition >= before + 20, `our warships broke the swarm there, and they will not forget it (${before} → ${sv.disposition})`);
  check(!!sv.promised?.kept, 'our promise is kept');
  s.turn += PROMISE_TURNS;
  const d1 = sv.disposition;
  judgePromise(s, sv);
  check(sv.disposition === d1 + 10, 'and when they see it, they think better of us still (+10)');
}

// ---------------------------------------------------------------- everyone hears of a swarm broken for another
{
  const { s, sv } = setup('upload');
  const other = Object.values(s.survivors).find((o) => o !== sv)!;
  Object.assign(other, { alive: true, contact: true, disposition: 0 });
  delete other.fate;
  foughtFor(s, sv.homeSystemId, true);
  check((other.news ?? []).some((n) => n.delta === 5 && /broke the Hunger/.test(n.what)), 'when we break the Hunger at their star, the others hear of it (+5)');
}

// ---------------------------------------------------------------- in a whole game
{
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' });
  let most = 0;
  for (let g = 0; g < 120 && !s.outcome; g++) {
    autoPlay(s, 'competent');
    endTurn(s);
    for (const v of Object.values(s.survivors)) most = Math.max(most, v.systems.length - 1);
  }
  check(most >= 1, `in 120 turns of seed 1000 a neighbour settles new stars (at most ${most})`);
  const held = Object.values(s.survivors).flatMap((v) => (v.alive ? v.systems : []));
  check(new Set(held).size === held.length, 'no star is held by two civilizations');
}
void ({} as StarSystem);
done('CLAIMS');
