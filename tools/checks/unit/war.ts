// War (living neighbours, phase 4), narrow and costly. Declaring it needs an accord vote and costs
// resolve, calm and every Thread's standing; our pacts with them end; they and everyone else hear
// of it when the light arrives. A siege is warships at their first star, turn after turn, while
// they arm; only after three turns can we try to take it, in a battle we can lose. A war's heat
// draws the Hunger, those who hate us join against us, and while it lasts there are no pacts, no
// asking, no refuge. Against a fork, or a neighbour who keeps raiding us, few blame us, and taking
// the star back carries no Taint.
import { autoPlay } from '../../../src/game/auto';
import { newGame } from '../../../src/game/newGame';
import { endTurn } from '../../../src/game/sim/turn';
import { askBlocked, jointIncome, seizeSurvivor } from '../../../src/game/sim/survivors';
import { pactBlocked } from '../../../src/game/sim/pacts';
import { mayComeToUs } from '../../../src/game/sim/refuge';
import { ARMING, SIEGE_TURNS, WAR_ACCORD, declareWar, inCoalition, makePeace, raidedUs, seizeBlocked, warBlocked, warCause, warDefence, warHeat, warTurn } from '../../../src/game/sim/war';
import { newFleet } from '../../../src/game/sim/fleets';
import { capital, colonies } from '../../../src/game/sim/util';
import type { GameState, Survivor } from '../../../src/game/types';
import { THREADS } from '../../../src/game/types';
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
const setup = () => {
  const s = clone(base);
  const [sv, other] = Object.values(s.survivors);
  for (const o of [sv, other]) {
    Object.assign(o, { alive: true, contact: true, health: 0.8, pop: 24, disposition: 10 });
    delete o.fate;
  }
  s.civ.accord = 200;
  s.civ.resolve = 60;
  s.civ.dissent = 10;
  return { s, sv, other };
};
/** Warships parked at their first star: `n` Wardens. */
const fleetAt = (s: GameState, sv: Survivor, n: number) => newFleet(s, sv.homeSystemId, Array(n).fill('warden'));

// ---------------------------------------------------------------- declaring it
{
  const { s, sv, other } = setup();
  sv.pacts = { aid: s.turn, archives: s.turn };
  s.civ.accord = WAR_ACCORD - 1;
  check(warBlocked(s, sv) === `The Threads must consent: ${WAR_ACCORD} accord.`, 'the Threads must consent: an accord vote');
  s.civ.accord = 200;
  const standing = { ...s.civ.standing };
  check(warCause(s, sv) === null && declareWar(s, sv.id) === null && !!sv.war, 'war declared, with no cause anyone accepts');
  check(s.civ.accord === 200 - WAR_ACCORD && s.civ.resolve === 55 && s.civ.dissent === 18, `it costs accord, resolve and calm (${s.civ.accord}, ${s.civ.resolve}, ${s.civ.dissent})`);
  check(THREADS.every((t) => s.civ.standing[t] === Math.max(0, standing[t] - 3)), 'every Thread thinks less of us (−3)');
  check(!sv.pacts?.aid && !sv.pacts?.archives, 'our pacts with them end');
  check((sv.news ?? []).some((n) => n.delta === -40) && (other.news ?? []).some((n) => n.delta === -15 && /went to war/.test(n.what)), 'they hear of it (−40), and so does everyone else (−15), each when the light arrives');
  check(pactBlocked(s, sv, 'watch') === 'We are at war with them.' && askBlocked(s, sv) === 'We are at war with them.' && !mayComeToUs(s, sv), 'no pacts, no asking, no refuge');
  s.civ.flags[`joint_${sv.id}`] = 1;
  check(jointIncome(s) === 0, 'and a shared work stops paying');
  other.disposition = -30;
  check(inCoalition(s, other), 'a civilization that hates us joins against us');
  const cap = capital(s)!;
  fleetAt(s, sv, 1);
  const heat = warHeat(s);
  check(heat.get(cap.systemId) === 8 && heat.get(sv.homeSystemId) === 10, 'the heat of it draws the Hunger, to our capital and to the siege');
  check(makePeace(s, sv.id) === null && !sv.war && (sv.news ?? []).some((n) => n.delta === 10), 'we can make peace; they hear of it when the light arrives');
}

// ---------------------------------------------------------------- a just cause
{
  const { s, sv, other } = setup();
  check(warCause(s, sv) === null, 'one raid is not a cause');
  s.civ.flags[`raid_last_${sv.id}`] = s.turn - 15;
  raidedUs(s, sv);
  check(warCause(s, sv) === 'They keep raiding us.', 'two raids within twenty turns are');
  const standing = { ...s.civ.standing };
  declareWar(s, sv.id);
  check(THREADS.every((t) => s.civ.standing[t] === Math.max(0, standing[t] - 1)) && (other.news ?? []).some((n) => n.delta === -5), 'then the Threads mind less (−1), and few blame us (−5)');
}

// ---------------------------------------------------------------- the siege, and the assault
{
  const { s, sv } = setup();
  declareWar(s, sv.id);
  check(seizeBlocked(s, sv) === 'You need warships at their first star.', 'no siege without warships');
  const def0 = warDefence(s, sv);
  const f = fleetAt(s, sv, 6);
  const hp0 = f.ships.reduce((a, x) => a + x.hp, 0);
  const h0 = sv.health;
  warTurn(s, () => 0.5);
  check(sv.war!.siege === 1 && sv.health < h0 && f.ships.reduce((a, x) => a + x.hp, 0) < hp0, 'a turn of siege costs them, and their guns answer ours');
  check(seizeBlocked(s, sv) === `Hold the siege: ${SIEGE_TURNS - 1} more turn(s) of warships at their first star.`, `${SIEGE_TURNS} turns before we can try to take it`);
  s.turn += 4;
  check(Math.abs(warDefence(s, sv) / def0 - (1 + ARMING * 4) * (sv.health / h0)) < 1e-9, `they arm as the war goes on (+${ARMING * 100}% a turn)`);
  const moved = clone(s);
  for (const x of Object.values(moved.fleets)) if (x.at === sv.homeSystemId) x.at = capital(moved)!.systemId;
  warTurn(moved, () => 0.5);
  check(moved.survivors[sv.id].war!.siege === 0, 'take the warships away and the siege is over');
  warTurn(s, () => 0.5);
  warTurn(s, () => 0.5);
  check(seizeBlocked(s, sv) === null, 'held three turns: we can try');
  // a weak assault is thrown back
  const weak = clone(s);
  for (const x of Object.values(weak.fleets)) if (x.at === sv.homeSystemId) x.ships = x.ships.slice(0, 1);
  weak.survivors[sv.id].pop = 400;
  check(seizeSurvivor(weak, sv.id) === null && weak.survivors[sv.id].alive && weak.survivors[sv.id].war!.siege === 0, 'against their strength one Warden is thrown back, and the siege must begin again');
  // a strong one takes it, with Taint, for no cause
  const t0 = s.civ.taint;
  sv.pop = 6;
  const before = colonies(s).length;
  check(seizeSurvivor(s, sv.id) === null && !sv.alive && sv.fate === 'seized' && !sv.war, 'with strength enough, their star is ours');
  check(s.civ.taint === t0 + 5 && colonies(s).length === before + 1, 'with Taint, and some of them as our people');
}

// ---------------------------------------------------------------- our own people, back
{
  const { s, sv } = setup();
  sv.way = 'fork';
  sv.forkOf = 'echoes';
  const free = Object.values(s.systems).filter((x) => !x.special && !x.gone && !Object.values(s.colonies).some((c) => c.systemId === x.id) && x.bodies.some((id) => s.bodies[id] && !s.bodies[id].dissolved));
  sv.homeSystemId = free[0].id;
  sv.systems = [free[0].id, free[1].id];
  check(warCause(s, sv) === 'They are our own people, who left us.', 'a fork is a cause');
  declareWar(s, sv.id);
  fleetAt(s, sv, 8);
  for (let i = 0; i < SIEGE_TURNS; i++) warTurn(s, () => 0.5);
  sv.pop = 6;
  const t0 = s.civ.taint;
  const before = colonies(s).length;
  seizeSurvivor(s, sv.id);
  check(sv.fate === 'seized' && s.civ.taint === t0, 'retaken without Taint');
  check(colonies(s).length === before + 2 && colonies(s).slice(-2).every((c) => c.pops.echoes > 0), 'and every settlement they held is ours again, with its people');
}

// ---------------------------------------------------------------- the warlike autoplayer: a whole game, no crash
{
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' });
  for (let g = 0; g < 200 && !s.outcome; g++) {
    autoPlay(s, 'warlike');
    endTurn(s);
  }
  check(s.turn > 1, `the warlike autoplayer plays (${s.turn} turns, ${s.civ.flags.wars ?? 0} wars)`);
}
done('WAR');
