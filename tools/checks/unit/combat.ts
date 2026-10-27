// The combat system (20 Oct, docs/plans/2026-10-20-combat.md): battles fought out a round a turn,
// tactics as modifiers, and neighbours who fight back.
// - Tactics: Hold the line ×1/×1, Close in ×1.5/×1.5, Stand off ×0.5/×0.5 (holds no siege, cannot
//   storm or raid, not dug in), Escort ×0.75 dealt, its warships taking the fire meant for its
//   unarmed ships; a fleet without a warship holds the line, and cannot be given another.
// - Every ship at the star is a target, armed or not; every settlement fires with what it has (0.5,
//   0.075 a person, 6 at most, and its Defence Grids); fire falls on ships one at a time, the least
//   hull left first, so ships are lost one by one.
// - Between two fleets, Close in and Stand off change how fast a fight goes, not who wins it.
// - A siege is the settlement's, held by whoever holds its star (not standing off) with none of its
//   owner's warships there, in any war, whoever began it; a war's siege in a save before format 5
//   moves onto the settlement it was held at.
// - The others at war arm, go for what has come to their stars (or gather at the capital when far
//   too weak), pick tactics, bring an outmatched fleet home, and strike back at our settlement
//   nearest them once strong enough; our competent autoplayer defends, warlike strikes back.
// - A tactic counts against swarms too: Close in attacks a swarm half again as hard; an Escort's
//   warships take the hurt meant for its unarmed ships.
// - The forecast on a tactic's button: what a turn would deal and take, at an even draw.
// - The battle record keeps BATTLE_MEMORY turns, and each battle we are in is a line in our log.
import { autoPlay } from '../../../src/game/auto';
import { asCiv, flushOutbox } from '../../../src/game/civs';
import { TACTIC_BY_ID, shareHurt, tacticOf } from '../../../src/game/data/tactics';
import { newGame } from '../../../src/game/newGame';
import { migrate } from '../../../src/game/save';
import { setTactic, storm } from '../../../src/game/sim/actions';
import { BATTLE_MEMORY, SETTLEMENT_FIRE, SETTLEMENT_FIRE_MAX, SETTLEMENT_FIRE_PER, assaultBlocked, battleForecast, battlesTurn, declareOn, frontOf, settlementFire, warOf } from '../../../src/game/sim/conflict';
import { createColony, newFleet } from '../../../src/game/sim/fleets';
import { warshipsAt } from '../../../src/game/sim/hunger';
import { allColonies, allFleets, capital, popsOf } from '../../../src/game/sim/util';
import { HUNGER_CAUSE, SIEGE_TURNS, declareWar } from '../../../src/game/sim/war';
import type { GameState, TacticId } from '../../../src/game/types';
import { check, done, near } from '../lib';

const fresh = () => {
  const s = newGame({ seed: 1000, survivors: 3 });
  const [a, b, c] = Object.keys(s.survivors).filter((id) => s.civs[id]).sort();
  for (const x of Object.values(s.colonies)) delete x.foundedAt;
  return { s, a, b, c };
};
/** A star where no one lives and nothing is stopped. */
const empty = (s: GameState) => {
  const used = new Set([...Object.values(s.colonies).map((c) => c.systemId), ...Object.values(s.fleets).map((f) => f.at)]);
  return Object.values(s.systems).find((x) => !used.has(x.id) && !x.special && !x.gone)!.id;
};
/** Two civilizations at war, their fleets cleared away. */
const atWar = (s: GameState, a: string, b: string) => {
  s.civs[a].accord = 200;
  declareOn(s, a, b, HUNGER_CAUSE);
  flushOutbox(s);
  for (const f of Object.values(s.fleets)) if (f.owner === a || f.owner === b) delete s.fleets[f.id];
};
/** A second settlement of a civilization's, at the free star nearest its first. */
const second = (s: GameState, id: string) => {
  const home = s.systems[allColonies(s).find((x) => x.owner === id)!.systemId];
  const used = new Set(Object.values(s.colonies).map((c) => c.systemId));
  const free = Object.values(s.systems)
    .filter((x) => !x.special && !x.gone && !used.has(x.id) && x.bodies.some((b) => s.bodies[b].kind !== 'deep' && !s.bodies[b].colonyId))
    .sort((p, q) => Math.hypot(p.phys.x - home.phys.x, p.phys.y - home.phys.y, p.phys.z - home.phys.z) - Math.hypot(q.phys.x - home.phys.x, q.phys.y - home.phys.y, q.phys.z - home.phys.z))[0];
  const body = free.bodies.map((b) => s.bodies[b]).find((b) => b.kind !== 'deep' && !b.colonyId)!;
  return asCiv(s, id, () => createColony(s, body, { kin: 4 }));
};

// the tactics
{
  const t = TACTIC_BY_ID;
  check(t.line.dealt === 1 && t.line.taken === 1 && t.close.dealt === 1.5 && t.close.taken === 1.5 && t.standoff.dealt === 0.5 && t.standoff.taken === 0.5 && t.escort.dealt === 0.75 && t.escort.taken === 1, 'Hold the line ×1/×1, Close in ×1.5/×1.5, Stand off ×0.5/×0.5, Escort ×0.75/×1');
  check(t.line.holds && t.close.holds && t.escort.holds && !t.standoff.holds && !!t.escort.escorts, 'only Stand off holds no siege; Escort escorts');
  const { s } = fresh();
  const at = empty(s);
  const probe = newFleet(s, at, ['probe'], 'Eyes');
  check(/Only warships/.test(setTactic(s, probe.id, 'close') ?? '') && tacticOf({ ...probe, tactic: 'standoff' }).id === 'line', 'a fleet without a warship holds the line, and cannot be given another');
  const w = newFleet(s, at, ['warden'], 'Guard');
  check(setTactic(s, w.id, 'standoff') === null && w.tactic === 'standoff' && setTactic(s, w.id, 'line') === null && w.tactic === undefined, 'a warship takes any; Hold the line is no tactic stored at all, as before');
}

// fire falls on ships one at a time, and every ship is a target
{
  const { s, a, b } = fresh();
  atWar(s, a, b);
  const at = empty(s);
  const A = asCiv(s, a, () => newFleet(s, at, ['warden', 'warden', 'warden', 'warden'], 'Host'));
  const B = asCiv(s, b, () => newFleet(s, at, ['warden', 'warden', 'warden', 'probe'], 'Guard'));
  battlesTurn(s);
  const hurt = B.ships.filter((x) => x.hp < 10 && x.cls === 'warden').length;
  check(!B.ships.some((x) => x.cls === 'probe') && hurt <= 1, `their probe went first, then the fire fell on one Warden at a time (${B.ships.map((x) => `${x.cls} ${x.hp.toFixed(1)}`).join(', ')})`);
  check(A.ships.filter((x) => x.hp < 10).length <= 1, `and theirs on ours the same way (${A.ships.map((x) => x.hp.toFixed(1)).join(', ')})`);
  const rec = s.battles.find((x) => x.systemId === at && x.sides);
  check(!!rec && rec.sides!.length === 2 && (rec.sides!.find((x) => x.owner === b)?.lost.probe ?? 0) === 1, 'the battle is on the record, both sides, with what each lost');
}

// every settlement fires, with what it has, at any ship of an enemy's in its sky
{
  const { s, b } = fresh();
  const sv = s.survivors[b];
  sv.contact = true;
  s.civ.accord = 200;
  sv.taintSeen = 70;
  check(declareWar(s, b) === null, `we go to war on ${sv.name}`);
  const front = sv.war!.at!;
  for (const f of Object.values(s.fleets)) if (f.owner === b && f.at === front) delete s.fleets[f.id];
  const c = allColonies(s).find((x) => x.owner === b && x.systemId === front)!;
  delete c.structures.defense_grid;
  near(`without a Defence Grid, ${c.name} fires 0.5 and 0.075 for each of its ${popsOf(c)} people`, settlementFire(c), Math.min(SETTLEMENT_FIRE_MAX, SETTLEMENT_FIRE + SETTLEMENT_FIRE_PER * popsOf(c)));
  c.structures.defense_grid = 1;
  near('and a Defence Grid adds its 8', settlementFire(c), Math.min(SETTLEMENT_FIRE_MAX, SETTLEMENT_FIRE + SETTLEMENT_FIRE_PER * popsOf(c)) + 8);
  delete c.structures.defense_grid;
  const p = newFleet(s, front, ['probe'], 'Eyes');
  for (let i = 0; i < 8 && s.fleets[p.id]; i++) {
    battlesTurn(s);
    s.turn++;
  }
  check(!s.fleets[p.id], `a probe of ours at ${s.systems[front].name}, in a war with them, is shot down by the settlement there (it was untouched before)`);
  check(s.civ.log.some((l) => /^Battle at /.test(l.text)), 'and our log has a line for the battle');
}

// Escort: its warships take the fire meant for its unarmed ships
{
  const run = (t: TacticId) => {
    const { s, a, b } = fresh();
    atWar(s, a, b);
    const at = empty(s);
    asCiv(s, a, () => newFleet(s, at, ['warden', 'warden'], 'Host'));
    const B = asCiv(s, b, () => newFleet(s, at, ['warden', 'warden', 'ark'], 'Convoy'));
    B.tactic = t;
    battlesTurn(s);
    return B.ships.find((x) => x.cls === 'ark')?.hp ?? 0;
  };
  const line = run('line');
  const esc = run('escort');
  check(line < 6 && esc === 6, `an Ark in a fleet holding the line is hit first (hull ${line.toFixed(1)} of 6); escorted, its warships take it (6 of 6)`);
}

// Close in and Stand off: between two fleets, how fast, not who
{
  const fight = (ta: TacticId, tb: TacticId) => {
    const { s, a, b } = fresh();
    atWar(s, a, b);
    const at = empty(s);
    const A = asCiv(s, a, () => newFleet(s, at, Array(6).fill('warden'), 'A'));
    const B = asCiv(s, b, () => newFleet(s, at, Array(4).fill('warden'), 'B'));
    A.tactic = ta;
    B.tactic = tb;
    let turns = 0;
    while (s.fleets[A.id] && s.fleets[B.id] && turns < 200) {
      battlesTurn(s);
      s.turn++;
      turns++;
    }
    return { turns, a: s.fleets[A.id]?.ships.length ?? 0, b: s.fleets[B.id]?.ships.length ?? 0 };
  };
  const line = fight('line', 'line');
  const close = fight('close', 'line');
  const stand = fight('line', 'standoff');
  check(line.b === 0 && close.b === 0 && stand.b === 0, `six Wardens beat four whatever the tactics (left: ${line.a}, ${close.a}, ${stand.a})`);
  check(close.turns < line.turns && line.turns < stand.turns, `closing in it is over sooner (${close.turns} turns), standing off later (${stand.turns}), than holding the line (${line.turns})`);
}

// a settlement's guns hit a fleet closing in harder, and a fleet standing off holds no siege
{
  const { s, b } = fresh();
  const sv = s.survivors[b];
  sv.contact = true;
  s.civ.accord = 200;
  sv.taintSeen = 70;
  declareWar(s, b);
  const front = sv.war!.at!;
  for (const f of Object.values(s.fleets)) if (f.owner === b && f.at === front) delete s.fleets[f.id];
  const c = allColonies(s).find((x) => x.owner === b && x.systemId === front)!;
  const host = newFleet(s, front, ['warden', 'warden', 'warden'], 'Host');
  const fc = (t: TacticId) => battleForecast(s, front, host.id, t)!;
  check(fc('close').taken > fc('line').taken && fc('line').taken > fc('standoff').taken, `their guns would take ${fc('close').taken.toFixed(2)} closing in, ${fc('line').taken.toFixed(2)} holding the line, ${fc('standoff').taken.toFixed(2)} standing off`);
  // (with a warship of theirs there, the forecast deals too)
  const guard = asCiv(s, b, () => newFleet(s, front, ['aegis'], 'Guard'));
  near('the forecast: standing off, we would deal half what the line deals', fc('standoff').dealt, fc('line').dealt / 2, 1e-9);
  near('closing in, half again', fc('close').dealt, fc('line').dealt * 1.5, 1e-9);
  delete s.fleets[guard.id];
  host.tactic = 'standoff';
  battlesTurn(s);
  check(!c.siege, 'standing off, our warships hold no siege');
  check(/standing off cannot storm/.test(assaultBlocked(s, s.player, c) ?? ''), 'nor can they storm it');
  host.tactic = 'close';
  battlesTurn(s);
  check(c.siege?.by === s.player && c.siege.turns === 1, 'closing in, the siege begins');
}

// a siege, whoever began the war: theirs on ours, ours on theirs in their own war
{
  const { s, a } = fresh();
  s.civs[a].accord = 200;
  const front = frontOf(s, s.player, a)!;
  declareOn(s, a, s.player, HUNGER_CAUSE, front);
  flushOutbox(s);
  for (const f of Object.values(s.fleets)) if (f.at === front) delete s.fleets[f.id];
  const mine = allColonies(s).find((x) => x.owner === s.player && x.systemId === front)!;
  asCiv(s, a, () => newFleet(s, front, ['warden', 'warden', 'warden', 'warden'], 'Host'));
  battlesTurn(s);
  flushOutbox(s);
  check(mine.siege?.by === a && mine.siege.turns === 1, `${s.civs[a].name} hold ${mine.name} under siege`);
  const theirs = frontOf(s, a, s.player)!;
  for (const f of Object.values(s.fleets)) if (f.owner === a && f.at === theirs) delete s.fleets[f.id];
  const c = allColonies(s).find((x) => x.owner === a && x.systemId === theirs)!;
  newFleet(s, theirs, ['warden', 'warden', 'warden', 'warden'], 'Spear');
  for (let i = 0; i < SIEGE_TURNS; i++) battlesTurn(s);
  flushOutbox(s);
  check(c.siege?.by === s.player && c.siege.turns === SIEGE_TURNS, `and we hold ${c.name} under siege in the war they began, ${SIEGE_TURNS} turns`);
}

// a save from before format 5: the war's siege moves onto the settlement it was held at
{
  const { s, b } = fresh();
  const sv = s.survivors[b];
  sv.contact = true;
  s.civ.accord = 200;
  sv.taintSeen = 70;
  declareWar(s, b);
  const w = sv.war!;
  w.siege = 2;
  s.saveVersion = 4;
  const fleet = newFleet(s, w.at!, ['warden'], 'Old');
  delete fleet.tactic;
  s.battles.push({ systemId: w.at!, turn: s.turn - BATTLE_MEMORY - 5, text: 'Long ago.' });
  migrate(s);
  const c = allColonies(s).find((x) => x.owner === b && x.systemId === w.at)!;
  check(c.siege?.by === s.player && c.siege.turns === 2 && w.siege === 0, `the siege of 2 turns is ${c.name}'s now (${JSON.stringify(c.siege)})`);
  check(tacticOf(fleet).id === 'line', 'a fleet from before holds the line');
  check(!s.battles.some((x) => x.text === 'Long ago.'), `a battle older than ${BATTLE_MEMORY} turns is off the record`);
}

// the others at war: they arm, go for what has come, pick tactics, come home outmatched, strike back
{
  const { s, b } = fresh();
  const sv = s.survivors[b];
  sv.contact = true;
  s.civ.accord = 200;
  sv.taintSeen = 70;
  declareWar(s, b);
  const civ = s.civs[b];
  const cap = s.colonies[civ.capitalId!];
  for (const f of Object.values(s.fleets)) if (f.owner === b) delete s.fleets[f.id];
  civ.energy = 1000;
  cap.structures.shipyard = Math.max(1, cap.structures.shipyard ?? 0);
  cap.queue = [];
  // nothing of theirs: they learn to build warships first, and build them
  const ours = newFleet(s, cap.systemId, ['warden'], 'Raiders');
  civ.techs = civ.techs.filter((t) => t !== 'orbital_defense');
  civ.researching = null;
  asCiv(s, b, () => autoPlay(s, 'competent'));
  check(civ.researching === 'orbital_defense', `attacked, and unable to build a warship, they research one first (${civ.researching})`);
  civ.techs.push('orbital_defense');
  cap.queue = [];
  asCiv(s, b, () => autoPlay(s, 'competent'));
  check(cap.queue.some((q) => q.kind === 'ship' && ['warden', 'aegis'].includes(q.key)), `attacked, with no warships, they build some (${cap.queue.map((q) => q.key).join(', ')})`);
  // a host of theirs at the capital, ours at another settlement of theirs: they go for it, closing in
  delete s.fleets[ours.id];
  const other = allColonies(s).find((x) => x.owner === b && x.systemId !== cap.systemId) ?? second(s, b);
  const lone = newFleet(s, other.systemId, ['warden'], 'Lone');
  const host = asCiv(s, b, () => newFleet(s, cap.systemId, Array(6).fill('warden'), 'Host'));
  asCiv(s, b, () => autoPlay(s, 'competent'));
  check(host.to === other.systemId && host.tactic === 'close', `our lone Warden at ${s.systems[other.systemId].name}: their six go for it, closing in (${s.systems[host.to ?? '']?.name}, ${host.tactic})`);
  delete s.fleets[lone.id];
  delete s.fleets[host.id];
  // outmatched away from home: it comes home
  const away = empty(s);
  const few = asCiv(s, b, () => newFleet(s, away, ['warden'], 'Few'));
  newFleet(s, away, Array(6).fill('warden'), 'Many');
  asCiv(s, b, () => autoPlay(s, 'competent'));
  check(few.to === cap.systemId, `one Warden of theirs against six of ours, away from its capital: it heads home (${s.systems[few.to ?? '']?.name})`);
}

// strike back: attacked, nothing at its stars, strong enough, it goes for our nearest settlement
{
  const { s, b } = fresh();
  const sv = s.survivors[b];
  sv.contact = true;
  s.civ.accord = 200;
  sv.taintSeen = 70;
  declareWar(s, b);
  for (const f of Object.values(s.fleets)) delete s.fleets[f.id];
  const civ = s.civs[b];
  civ.energy = 5000;
  const cap = s.colonies[civ.capitalId!];
  const host = asCiv(s, b, () => newFleet(s, cap.systemId, Array(10).fill('warden'), 'Host'));
  asCiv(s, b, () => autoPlay(s, 'competent'));
  const target = frontOf(s, s.player, b);
  check(!!target && host.to === target, `attacked, with nothing of ours at its stars, it strikes back at ${s.systems[target ?? '']?.name}, our settlement nearest it`);
}

// our autoplayer, attacked: the competent defend at the settlement they come for; warlike strike back
{
  const { s, a } = fresh();
  s.civs[a].accord = 200;
  const front = frontOf(s, s.player, a)!;
  declareOn(s, a, s.player, HUNGER_CAUSE, front);
  flushOutbox(s);
  for (const f of Object.values(s.fleets)) delete s.fleets[f.id];
  s.civ.energy = 5000;
  const capSys = s.colonies[s.civ.capitalId!].systemId;
  const ours = newFleet(s, capSys, Array(12).fill('warden'), 'Home Guard');
  autoPlay(s, 'competent');
  check(ours.at === front ? ours.order === 'fortify' : ours.to === front, `the competent wait at ${s.systems[front].name}, dug in`);
  const twin = fresh();
  twin.s.civs[a].accord = 200;
  declareOn(twin.s, a, twin.s.player, HUNGER_CAUSE, front);
  flushOutbox(twin.s);
  for (const f of Object.values(twin.s.fleets)) delete twin.s.fleets[f.id];
  twin.s.civ.energy = 5000;
  const host = newFleet(twin.s, twin.s.colonies[twin.s.civ.capitalId!].systemId, Array(12).fill('warden'), 'Spear');
  autoPlay(twin.s, 'warlike');
  check(host.to === frontOf(twin.s, a, twin.s.player), 'warlike, they strike back at theirs nearest us');
}

// at a star where we have more than one settlement: one blockade, and one storm a turn
{
  const { s, a } = fresh();
  s.civs[a].accord = 200;
  const capSys = s.colonies[s.civ.capitalId!].systemId;
  declareOn(s, a, s.player, undefined, capSys);
  flushOutbox(s);
  for (const f of Object.values(s.fleets)) if (f.at === capSys) delete s.fleets[f.id];
  // a second settlement of ours at the capital's star
  const free = s.systems[capSys].bodies.map((x) => s.bodies[x]).find((x) => x.kind !== 'deep' && !x.colonyId)!;
  const extra = createColony(s, free, { kin: 2 });
  const here = allColonies(s).filter((c) => c.owner === s.player && c.systemId === capSys);
  for (const c of here) for (const k of ['defense_grid', 'bastion']) delete c.structures[k];
  asCiv(s, a, () => newFleet(s, capSys, Array(12).fill('breacher'), 'Host'));
  s.civ.energy = 1000;
  battlesTurn(s);
  flushOutbox(s);
  check(here.every((c) => c.siege?.by === a), `all ${here.length} of our settlements at ${s.systems[capSys].name} are under siege`);
  check(s.civ.energy === 1000 - 12, `and the blockade drains 12 energy once for the star, not once a settlement (${s.civ.energy})`);
  battlesTurn(s);
  battlesTurn(s);
  flushOutbox(s);
  const taken = here.filter((c) => c.owner === a).length;
  check(taken === 1, `held three turns, they storm one of them a turn (${taken} taken)`);
  const w = warOf(s, a, s.player);
  check(!!w && extra.id !== '', 'the war goes on');
}

// striking back: what the side a war fell on takes is no Hunger act; and after peace, warships come home
{
  const { s, a } = fresh();
  s.civs[a].accord = 200;
  const front = frontOf(s, s.player, a)!;
  declareOn(s, a, s.player, undefined, front);
  flushOutbox(s);
  const theirs = frontOf(s, a, s.player)!;
  for (const f of Object.values(s.fleets)) if (f.owner === a && f.at === theirs) delete s.fleets[f.id];
  second(s, a);
  const c = allColonies(s).find((x) => x.owner === a && x.systemId === theirs)!;
  for (const k of ['defense_grid', 'bastion']) delete c.structures[k];
  const spear = newFleet(s, theirs, Array(8).fill('breacher'), 'Spear');
  for (let i = 0; i < SIEGE_TURNS; i++) battlesTurn(s);
  flushOutbox(s);
  const taint0 = s.civ.taint;
  check(storm(s, c.id) === null && c.owner === s.player, `we strike back and take ${c.name}`);
  check(s.civ.taint === taint0, `and it is no Hunger act: they began the war (Taint ${taint0} → ${s.civ.taint})`);
  // they make peace, having lost a settlement in a war they began; their warships come home
  const host = asCiv(s, a, () => newFleet(s, front, ['warden'], 'Host'));
  host.tactic = 'close';
  asCiv(s, a, () => autoPlay(s, 'competent'));
  flushOutbox(s);
  check(!warOf(s, a, s.player), 'having lost a settlement in the war it began, it makes peace');
  asCiv(s, a, () => autoPlay(s, 'competent'));
  // (its capital now: the one we took was its capital's star or not, whichever it holds still)
  const home = asCiv(s, a, () => capital(s))!.systemId;
  check(host.tactic === undefined && host.to === home, `and its warships come home, holding the line again (${host.tactic}, ${s.systems[host.to ?? '']?.name})`);
  void spear;
}

// against a swarm: Close in strikes half again as hard; an Escort's warships take the unarmed's hurt
{
  const { s } = fresh();
  const at = empty(s);
  const f = newFleet(s, at, ['warden', 'warden'], 'Hunters');
  const plain = warshipsAt(s, at).attack;
  f.tactic = 'close';
  near('closing in, two Wardens attack a swarm with 9, not 6', warshipsAt(s, at).attack, plain * 1.5);
  const convoy = newFleet(s, at, ['warden', 'ark'], 'Convoy');
  convoy.tactic = 'escort';
  const hurt = shareHurt(convoy, [2, 3]);
  check(hurt[0] === 5 && hurt[1] === 0, `escorting, the Warden takes the Ark's hurt too (${hurt.join(', ')})`);
  convoy.tactic = 'standoff';
  const half = shareHurt(convoy, [2, 3]);
  check(half[0] === 1 && half[1] === 1.5, `standing off, each takes half (${half.join(', ')})`);
}

// the order of the fleets decides nothing, with tactics and settlements in it
{
  const make = (reverse: boolean) => {
    const { s, a, b } = fresh();
    atWar(s, a, b);
    const at = frontOf(s, b, a)!;
    const fs = [
      () => asCiv(s, a, () => Object.assign(newFleet(s, at, ['warden', 'warden', 'probe'], 'A1'), { tactic: 'close' as TacticId })),
      () => asCiv(s, a, () => newFleet(s, at, ['aegis'], 'A2')),
      () => asCiv(s, b, () => Object.assign(newFleet(s, at, ['warden', 'ark'], 'B1'), { tactic: 'escort' as TacticId })),
    ];
    for (const f of reverse ? [...fs].reverse() : fs) f();
    battlesTurn(s);
    return allFleets(s)
      .filter((f) => f.at === at)
      .map((f) => `${f.name}:${f.ships.map((x) => x.hp.toFixed(9)).join('/')}`)
      .sort()
      .join(' ');
  };
  const one = make(false);
  check(one === make(true), `the same battle, its fleets made in the other order, ends the same (${one})`);
}

void warOf;
done('COMBAT');
