import { EVENT_BY_ID, choiceHint, choiceOk, choiceShown } from './data/events';
import { STRUCTURE_BY_ID, type EnergyMode } from './data/structures';
import { TECHS } from './data/techs';
import { WORK_BY_ID } from './data/works';
import { ERA_BY_ID, logTurnLength, stepTime } from './eras';
import { clockCiv, effectivePace, livedShare, paceMatters, starClockTerms, turnStep, turnsUntilYears, upkeepShare } from './sim/flare';
import { emberShare, haloDrawn, sourceLight, vitalityLoss } from './physics';
import {
  answerEvent,
  answerSignal,
  buildCost,
  charterAvailable,
  convert,
  dismantle,
  dismantleTerms,
  disbandFleet,
  enactCharter,
  longSleep,
  makeGesture,
  orderFleet,
  queueBuild,
  removeQueued,
  rushBuild,
  setDormant,
  setPace,
  setResearch,
  startWork,
  structureCheck,
} from './sim/actions';
import { capacity, reserveCapacity } from './sim/economy';
import { workCost, workRequirementMet } from './sim/endings';
import { DARK_STARVE, continuityLoss } from './sim/continuity';
import { computeMods, strainFor } from './sim/mods';
import { patternAnswer } from './sim/minds';
import { project } from './sim/projection';
import { availableTechs, techCost } from './sim/research';
import { FORTIFY_BONUS, canSettle, fleetUpkeep, launchCost, travelEstimate } from './sim/fleets';
import { allColonies, allFleets, capital, colonies, distLy, eraIndex, fleets, formOf, hasTech, leftBehind, popsOf, swarmSeenAt, temperament, threadTotals } from './sim/util';
import { beginPassage, endForeseen, etaToEndOfMatter, passageEta, passageTerms } from './sim/passage';
import { IRON_ETA, ironAge, turnsToCollapse, turnsToEta } from './sim/deeptime';
import { LEAVE_MARGIN, SPENT_SPIN, holeFailing } from './sim/crossing';
import { beginHorizon, driftToAnotherHole, horizonCheck } from './sim/horizon';
import { beginWeave, leaveWeave, positroniumComes, positroniumGone, positroniumHere, turnsToDecay, weaveCheck } from './sim/positronium';
import type { Body, Colony, Fate, Fleet, GameState, StarSystem, SurvivorWay, TacticId, ThreadId, War } from './types';
import { THREADS } from './types';
import { THREAD_DEFS } from './data/threads';
import { accordCheck, accordCost, spendAccord, type AccordUse } from './sim/accord';
import { DEGENERATE_END, MATTER_END, calendarEra, fateKnown, fateOf, inAge, matterGone } from './fate';
import { FLOW_ETA, flowAhead, flowing, keeping } from './sim/flow';
import { PACT_KINDS, PACTS, hasPact, pactBlocked, pactCost, proposePact } from './sim/pacts';
import { HUNGER_CAUSE, WAR_ACCORD, anyWar, declareWar, makePeace, seizeBlocked, warBlocked, warCause, warDefence } from './sim/war';
import { declareOn, enemiesOf, fleetFire, frontOf, guardAt, launchStrike, peaceBetween, strikeBlocked, walled, warOf } from './sim/conflict';
import { CORRUPT_AT, JUST_CAUSE_AT, SANCTION_AT } from './sim/judge';
import { raidStrength, seizeSurvivor } from './sim/survivors';
import { SHIP_BY_ID, isWarship, strength } from './data/ships';
import { SEED_MIN, terraformSummary } from './sim/terraform';
import { othersPlaying, planTies, tieKey } from './sim/ties';
import { newStarNear } from './sim/ways';
import { plight } from './sim/plight';

// when the autoplayer spends accord, and how much it keeps for the next law (the dearest costs 30)
const ACCORD_KEEP = 30;
// a Lattice-led autoplayer builds a Search Foundry where a settlement makes this many times what the
// foundries there would draw, and a Protocol Registry while its accord is below this
const SEARCH_SPARE = 3;
const REGISTRY_BELOW = 40;
const ACCORD_RALLY_BELOW = 40;
const ACCORD_CALM_ABOVE = 40;
const ACCORD_HEAR_BELOW = 35;

// An autoplayer. It powers the balance harness, and can later back an in-game advisor. Since the
// new version (part 2a-2) it also plays the other civilizations, each under its own perspective:
// the same decisions as ours, and where its way of life needs others (wayOf), those, for it alone,
// so that our own autoplayer, and the harness's numbers, stay what they were.

/** The way our own autoplayer plays in this call: none, as it always has, or for the 'lattice' strategy, the Lattice's. */
let ourWay: SurvivorWay | null = null;

/** Another civilization's way of life (others.ts); for ours, the strategy's (ourWay), null as it always was. */
function wayOf(state: GameState): SurvivorWay | null {
  return state.civ.id === state.player ? ourWay : (state.survivors[state.civ.id]?.way ?? null);
}

/**
 * Whether a swarm threatens this star: one on its way to it, or, within a swarm's reach of it
 * (90 ly in the Dusk, anywhere after), one awake, or one asleep at a star this civilization has
 * surveyed. (Not a tamed one.)
 */
function swarmThreat(state: GameState, systemId: string): boolean {
  const here = state.systems[systemId];
  const reach = calendarEra(state) === 'dusk' ? 90 : Infinity;
  return Object.values(state.swarms).some(
    (s) => !s.tamed && (s.to === systemId || (!!s.systemId && (s.awake || state.civ.known[s.systemId] === 2) && distLy(state.systems[s.systemId], here) <= reach)),
  );
}

/** How long another civilization keeps a war it began, unless it has lost its warships first. */
const WAR_TIRES = 30;
/** How much stronger than what stands at the front its warships must be before it goes. */
const WAR_ODDS = 1.5;

/** Plight from which another civilization is desperate (plight.ts), and how many turns running it must have been so before it weighs a war for its life. */
const DESPERATE = 0.6;
const DESPERATE_FOR = 5;
/** Only one bolder than this (its caution under it) goes to war for its life; the others plead. */
const DESPERATE_BOLD = 0.4;
/** Its plight eased below this, the desperate make peace. */
const EASED = 0.4;
/** What makes a neighbour worth a desperate's war: stores RICHER times its own, and at least RICH_MIN, and plight under CONTENT. */
const RICHER = 3;
const RICH_MIN = 100;
const CONTENT = 0.3;
/** Regard from which it counts another a friend, and does not fall on it. */
const FRIEND = 20;
/** The turns within which its nearest warships must reach the front: a war it cannot reach in time is no use to the desperate. */
const REACH_TURNS = 5;
/** The galaxy's free energy under which the desperate start no war: every taking spends some of it, and what is left is too little to spend. */
const GFE_SPARE = 0.2;


/**
 * Another civilization's wars (parts 2c-2 and 2d). It fights for few causes:
 * - the Hunger it has heard of in another, if it is not on that path itself (a just cause, no
 *   infamy);
 * - far down that path itself (its own Taint from CORRUPT_AT), the weakest it knows, to feed on;
 * - desperate DESPERATE_FOR turns running, and bold (caution under DESPERATE_BOLD), the richest
 *   neighbour within its reach, much better off than itself, not a friend and bound to it by no
 *   pact (`worthWar`). It arms while it can, and goes only once its warships would carry all they
 *   would meet there; it takes (never razes), carries off what its sieges drain, and makes peace
 *   once it has taken a settlement or its plight has eased.
 * For a cause it arms first (a Breacher against walls; Hunters against the Hunger, once it knows
 * them; Wardens otherwise), and goes when its warships are WAR_ODDS times what stands at the
 * front: the enemy's settlement nearest its capital. At war, whoever began it, it fights as
 * `fightWar` says (the combat system, 20 Oct: before, attacked, it only gathered what it had at the
 * front, dug in). It makes peace once a war it began has lasted WAR_TIRES turns, its warships are
 * gone, or it has lost a settlement in it or cannot break a siege of its own. An enemy that could
 * strike with a Kinetic Lance makes it keep a Picket at its capital; far down the Hunger's path, it
 * strikes with one itself. (A fleet of Pickets keeps its watch where it is.)
 */
function planWarAI(state: GameState) {
  const civ = state.civ;
  if (civ.id === state.player) return;
  const me = civ.id;
  // desperate since when, turn by turn
  if (plight(state, me) >= DESPERATE) civ.flags.desperate_since ??= state.turn;
  else delete civ.flags.desperate_since;
  const line = lineOfBattle(state);
  const foes = enemiesOf(state, me);
  if (foes.some((o) => state.civs[o]?.techs.includes('relativistic_arks'))) keepWatch(state);
  const force = line.reduce((a, f) => a + fleetFire(f), 0);
  const fighting: string[] = [];
  for (const foe of foes) {
    const w = warOf(state, me, foe)!;
    if (w.by === me) {
      const done = w.motive === 'desperate' && ((w.took ?? 0) > 0 || plight(state, me) < EASED);
      // losing it: a settlement lost in it, or a siege of ours it cannot break
      const losing = (w.lost ?? 0) > 0 || colonies(state).some((c) => c.siege?.by === foe && force < guardAt(state, c.systemId, foe));
      if (state.turn - w.since > WAR_TIRES || !line.length || done || losing) {
        peaceBetween(state, me, foe);
        continue;
      }
    }
    fighting.push(foe);
  }
  if (fighting.length) {
    fightWar(state, fighting, line, true);
    return;
  }
  if (foes.length) return;
  comeHome(state, line);
  const target = warTarget(state, line);
  if (!target) return;
  const front = frontOf(state, target.id, me);
  if (!front) return;
  // (the desperate have weighed their own odds, against all they would meet: worthWar)
  const go = target.motive === 'desperate' ? !!target.ready : force >= WAR_ODDS * Math.max(1, guardAt(state, front, target.id));
  if (go && civ.accord >= WAR_ACCORD) {
    if (declareOn(state, me, target.id, target.cause, front, target.motive) === null) for (const f of line) if (f.at && !f.to) orderFleet(state, f.id, front, 'move');
    return;
  }
  civ.flags.arming = state.turn;
  // arm: a Breacher first if the front is walled, then Hunters against the Hunger, or Wardens
  if (needsBreacher(state, target.id, front, line)) arm(state, 'breacher', true);
  else if (line.length < 6) arm(state, target.cause === HUNGER_CAUSE && hasTech(state, 'hunger_studies') ? 'hunter' : 'warden');
}

/**
 * The turn after a war of the active civilization's ends (`civ.flags.peace_at`, conflict.ts
 * `warOver`): every fleet holds the line again, and its warships away from its own stars come home
 * to its capital, once.
 */
function comeHome(state: GameState, line: Fleet[]) {
  const civ = state.civ;
  if (civ.flags.peace_at === undefined) return;
  delete civ.flags.peace_at;
  const cap = capital(state);
  const mine = new Set(colonies(state).map((c) => c.systemId));
  for (const f of fleets(state)) delete f.tactic;
  if (cap) for (const f of line) if (f.at && !f.to && !mine.has(f.at)) orderFleet(state, f.id, cap.systemId, 'move');
}

/** The share of what has come to its star from which a civilization's warships go and hold out there (standing off, they keep a siege from holding); under it, they gather at the capital. */
const HOLD_OUT = 0.5;
/** Enemy fire this many times a fleet's own side's where it is (away from its capital): it withdraws. */
const WITHDRAW_AT = 2;

/** The stars of the active civilization's settlements where its enemies' ships are stopped, and what their warships fire there: its capital's first, then the most dangerous. */
function threatened(state: GameState, foes: string[]): { systemId: string; fire: number }[] {
  const mine = new Set(colonies(state).map((c) => c.systemId));
  const cap = capital(state)?.systemId;
  const out = new Map<string, number>();
  for (const f of allFleets(state)) {
    if (!f.at || f.order === 'strike' || !mine.has(f.at) || !foes.includes(f.owner)) continue;
    out.set(f.at, (out.get(f.at) ?? 0) + fleetFire(f));
  }
  return [...out.entries()]
    .map(([systemId, fire]) => ({ systemId, fire }))
    .sort((a, b) => Number(b.systemId === cap) - Number(a.systemId === cap) || b.fire - a.fire || (a.systemId < b.systemId ? -1 : 1));
}

/**
 * How a fleet of the active civilization fights at a star where its enemies are (none where they
 * are not: it holds the line, as every fleet does outside a war). With unarmed ships aboard, it
 * escorts them. Half again their fire there, or more (its own side's: its warships and settlements
 * there, and it), it closes in; less, it holds the line where it must hold a siege or dug in at its
 * own star, and stands off anywhere else.
 */
function tacticFor(state: GameState, f: Fleet, at: string, foes: string[]): TacticId | undefined {
  if (!f.ships.some((s) => isWarship(s.cls))) return undefined;
  const theirShips = allFleets(state).filter((x) => x.at === at && x.order !== 'strike' && foes.includes(x.owner) && x.ships.length > 0);
  const theirs = allColonies(state).some((c) => c.systemId === at && foes.includes(c.owner));
  if (!theirShips.length && !theirs) return undefined;
  if (f.ships.some((s) => !isWarship(s.cls))) return 'escort';
  const them = foes.reduce((a, o) => a + guardAt(state, at, o), 0);
  const us = guardAt(state, at, f.owner) + (f.at === at ? 0 : fleetFire(f));
  if (us >= WAR_ODDS * them) return 'close';
  const siege = theirs && !theirShips.some((x) => x.ships.some((s) => isWarship(s.cls)));
  const home = colonies(state).some((c) => c.systemId === at) && f.order === 'fortify';
  return siege || home ? undefined : 'standoff';
}

/** A warship for the war, at the capital: an Aegis once it can build one and has the energy, a Warden otherwise. */
function armWarship(state: GameState) {
  arm(state, hasTech(state, 'aegis_lattices') && state.civ.energy > 250 ? 'aegis' : 'warden');
}

/**
 * A war's turn for the active civilization (the combat system, 20 Oct), the others' and our
 * autoplayer's alike, whoever began it:
 * - it arms while its warships fall short of half again what threatens it: what has come to its
 *   stars and is on its way to them, and what stands where it would carry the war;
 * - it goes for what has come to its own stars, the most dangerous first (its capital's before any
 *   other), with every warship it has, once they and what stands there with them are at least
 *   HOLD_OUT of it, to win or to hold out (standing off, they keep a siege from holding); under
 *   that, it gathers them at its capital; its capital itself it always defends;
 * - with nothing at its stars, it carries the war to the enemy: to the front of a war it began, or,
 *   `strikeBack`, to the enemy's settlement nearest it once its warships are WAR_ODDS times what
 *   stands there (there it holds the siege, and storms it when it can: conflict.ts); else it waits,
 *   at the settlement they are coming for or at its capital;
 * - each fleet where it fights picks its tactic (`tacticFor`), dug in at its own stars, and one
 *   outmatched WITHDRAW_AT to one away from its capital comes home.
 */
function fightWar(state: GameState, foes: string[], line: Fleet[], strikeBack: boolean) {
  const civ = state.civ;
  const me = civ.id;
  const cap = capital(state);
  const mine = new Set(colonies(state).map((c) => c.systemId));
  const force = line.reduce((a, f) => a + fleetFire(f), 0);
  const threats = threatened(state, foes);
  const foe = foes[0];
  const w = warOf(state, me, foe);
  if (!w) return;
  const target = w.by === me ? w.at : strikeBack ? frontOf(state, foe, me) : undefined;
  const coming = allFleets(state)
    .filter((f) => foes.includes(f.owner) && f.to && mine.has(f.to))
    .reduce((a, f) => a + fleetFire(f), 0);
  const need = Math.max(threats.reduce((a, t) => a + t.fire, 0) + coming, target ? guardAt(state, target, foe) : 0);
  if (force < WAR_ODDS * need) armWarship(state);
  if (target && needsBreacher(state, foe, target, line)) arm(state, 'breacher', true);
  if (civ.taint >= CORRUPT_AT) lanceAt(state, foe);
  const go = (f: Fleet, to: string) => {
    if (!f.at || f.to || f.at === to) return;
    if (orderFleet(state, f.id, to, 'move') === null) f.tactic = tacticFor(state, f, to, foes);
  };
  const t = threats.find((x) => x.fire > 0);
  if (t) {
    const ours = guardAt(state, t.systemId, me) + line.filter((f) => f.at !== t.systemId).reduce((a, f) => a + fleetFire(f), 0);
    if (ours >= HOLD_OUT * t.fire || t.systemId === cap?.systemId) for (const f of line) go(f, t.systemId);
    else if (cap) for (const f of line) go(f, cap.systemId);
  } else if (target && (w.by === me || force >= (line.some((f) => f.at === target || f.to === target) ? HOLD_OUT : WAR_ODDS) * Math.max(1, guardAt(state, target, foe)))) {
    // (once on its way it keeps on, while it is at least HOLD_OUT of what stands there)
    for (const f of line) go(f, target);
  } else {
    // nothing to do but wait: at the settlement of its own they are coming for, else at its capital
    const post = w.by !== me && w.at && mine.has(w.at) ? w.at : cap?.systemId;
    if (post) for (const f of line) go(f, post);
  }
  for (const f of fleets(state)) {
    if (!f.at || f.to) continue;
    // dug in at its own stars (a fleet parked there, too)
    if (line.includes(f) && mine.has(f.at) && (f.order === 'idle' || f.order === 'hold')) f.order = 'fortify';
    f.tactic = tacticFor(state, f, f.at, foes);
    // outmatched away from its capital: home, to mend
    if (!line.includes(f) || !cap || f.at === cap.systemId) continue;
    const them = foes.reduce((a, o) => a + guardAt(state, f.at!, o), 0);
    if (them > 0 && them >= WITHDRAW_AT * guardAt(state, f.at, me)) go(f, cap.systemId);
  }
}

/** A civilization's fleets that fight a war where it is fought: its warships, but not a fleet of Pickets alone, which keeps its watch where it is. */
function lineOfBattle(state: GameState): Fleet[] {
  return fleets(state).filter((f) => f.ships.some((s) => isWarship(s.cls)) && !f.ships.every((s) => s.cls === 'picket'));
}

/** A Picket at the capital, built if there is none and none is coming: its screen may turn a Kinetic Lance (or a raid) aside. */
function keepWatch(state: GameState) {
  const cap = capital(state);
  if (!cap || !hasTech(state, 'orbital_defense')) return;
  if (fleets(state).some((f) => f.ships.some((s) => s.cls === 'picket') && (f.at === cap.systemId || f.to === cap.systemId))) return;
  arm(state, 'picket', true);
}

/** Far down the Hunger's path, at war: a Kinetic Lance built at the capital, and struck at the enemy's most peopled settlement. */
function lanceAt(state: GameState, foe: string) {
  if (!hasTech(state, 'relativistic_arks')) return;
  const lances = fleets(state).filter((f) => f.ships.some((s) => SHIP_BY_ID[s.cls]?.lance));
  if (!lances.length) {
    if (!colonies(state).some((c) => c.queue.some((q) => q.key === 'lance'))) arm(state, 'lance', true);
    return;
  }
  const target = allColonies(state)
    .filter((c) => c.owner === foe)
    .sort((a, b) => popsOf(b) - popsOf(a))[0];
  if (!target) return;
  const ready = lances.find((f) => f.at && f.order !== 'strike' && strikeBlocked(state, f.id, target.id) === null);
  if (ready) launchStrike(state, ready.id, target.id);
}

/** Whether the enemy's settlement at the front is walled, a Breacher can be built, and none is on its way there or being built. */
function needsBreacher(state: GameState, foe: string, front: string | undefined, warships: Fleet[]): boolean {
  if (!front || !hasTech(state, 'aegis_lattices')) return false;
  const c = allColonies(state).find((x) => x.owner === foe && x.systemId === front);
  if (!c || !walled(c)) return false;
  return !warships.some((f) => f.ships.some((s) => SHIP_BY_ID[s.cls]?.breaches)) && !colonies(state).some((x) => x.queue.some((q) => q.key === 'breacher'));
}

/** Build a warship at the capital, if it has a Shipyard, room in its queue and energy to spare (`once`: unless one is already queued there). */
function arm(state: GameState, cls: string, once = false) {
  const civ = state.civ;
  const cap = civ.capitalId ? state.colonies[civ.capitalId] : undefined;
  if (!cap || !((cap.structures.shipyard ?? 0) > 0) || cap.queue.length >= 3 || civ.energy <= 100) return;
  if (once && cap.queue.some((q) => q.key === cls)) return;
  queueBuild(state, cap.id, 'ship', cls);
}

/**
 * Whom another civilization would go to war with, and why: the Hunger it has heard of in one; far
 * down that path itself, the weakest it knows; desperate and bold, the richest it can beat.
 */
function warTarget(state: GameState, line: Fleet[]): { id: string; cause?: string; motive: NonNullable<War['motive']>; ready?: boolean } | null {
  const civ = state.civ;
  const me = civ.id;
  const others = othersPlaying(state).filter((o) => o.id !== me).map((o) => o.id);
  if (civ.taint < SANCTION_AT) {
    // what it has heard of us is on our record of it; of the others, on its tie with each
    if ((state.survivors[me]?.heardTaint ?? 0) >= JUST_CAUSE_AT) return { id: state.player, cause: HUNGER_CAUSE, motive: 'hunger' };
    for (const o of others) if ((state.ties?.[tieKey(me, o)]?.taintHeard?.[me] ?? 0) >= JUST_CAUSE_AT) return { id: o, cause: HUNGER_CAUSE, motive: 'hunger' };
  }
  if (civ.taint >= CORRUPT_AT) {
    const weakest = [...others, state.player]
      .map((id) => ({ id, front: frontOf(state, id, me) }))
      .filter((x): x is { id: string; front: string } => !!x.front)
      .map((x) => ({ id: x.id, g: guardAt(state, x.front, x.id) }))
      .sort((a, b) => a.g - b.g)[0];
    return weakest ? { id: weakest.id, motive: 'corrupted' } : null;
  }
  const since = civ.flags.desperate_since;
  if (since !== undefined && state.turn - since + 1 >= DESPERATE_FOR && temperament(state, me).caution < DESPERATE_BOLD) {
    const force = line.reduce((a, f) => a + fleetFire(f), 0);
    const pick = [...others, state.player]
      .map((o) => ({ o, how: worthWar(state, me, o, force, line) }))
      .filter((x) => x.how !== 'no')
      .sort((a, b) => (state.civs[b.o]?.energy ?? 0) - (state.civs[a.o]?.energy ?? 0))[0];
    if (pick) return { id: pick.o, motive: 'desperate', ready: pick.how === 'go' };
  }
  return null;
}

/**
 * What a desperate civilization makes of another (`warTarget`): 'no' once the galaxy's free energy
 * is down to GFE_SPARE (a taking spends it), and unless the other is much better off than itself (RICHER times its stores, and RICH_MIN, its plight under CONTENT), not a friend
 * (regard under FRIEND), bound to it by no pact, and its front within REACH_TURNS of its capital
 * or of a fleet of its warships;
 * then 'go' once its warships outweigh WAR_ODDS times all they would meet there (what stands at the
 * front, and every warship of theirs, which comes to it dug in when attacked) and one of them can
 * be launched there from what it has; 'arm' until then.
 */
function worthWar(state: GameState, me: string, o: string, force: number, line: Fleet[]): 'no' | 'arm' | 'go' {
  const civ = state.civs[me];
  const them = state.civs[o];
  if (!civ || !them || them.outcome || state.gfe < GFE_SPARE) return 'no';
  if (them.energy < Math.max(RICH_MIN, RICHER * civ.energy) || plight(state, o) >= CONTENT) return 'no';
  const sv = state.survivors[me];
  if (o === state.player && !sv?.contact) return 'no';
  const t = o === state.player ? undefined : state.ties?.[tieKey(me, o)];
  const regard = o === state.player ? (sv?.disposition ?? 0) : (t?.regard?.[me] ?? 0);
  const pacts = o === state.player ? sv?.pacts : t?.pacts;
  if (regard >= FRIEND || (pacts && Object.keys(pacts).length > 0)) return 'no';
  const front = frontOf(state, o, me);
  const cap = capital(state);
  if (!front || !cap) return 'no';
  const there = state.systems[front];
  const mods = computeMods(state);
  const from = [cap.systemId, ...line.map((f) => f.at).filter((x): x is string => !!x)];
  if (!from.some((id) => id === front || travelEstimate(state, distLy(state.systems[id], there), mods).turns <= REACH_TURNS)) return 'no';
  const coming = allFleets(state).filter((f) => f.owner === o && f.at !== front).reduce((a, f) => a + fleetFire(f), 0);
  if (force < WAR_ODDS * Math.max(1, guardAt(state, front, o) + coming * FORTIFY_BONUS)) return 'arm';
  const launched = line.some((f) => f.at && (f.at === front || launchCost(state, f, distLy(state.systems[f.at], there), mods) <= civ.energy));
  return launched ? 'go' : 'arm';
}

/** How much of what a turn gains before upkeep idle warships may cost before they are stood down. */
const STAND_DOWN_SHARE = 0.15;

/**
 * Warships cost upkeep (part 2c), the more the longer the turns. After the Dusk, with no war and
 * no swarm that threatens any of our settlements, once they cost more than STAND_DOWN_SHARE of
 * what a turn gains, the idle ones are scrapped where they wait (some matter back).
 */
function planStandDown(state: GameState) {
  const civ = state.civ;
  // (in the Dusk an escort costs next to nothing, and the first swarms come for the weak)
  if (calendarEra(state) === 'dusk') return;
  const war = civ.id === state.player ? anyWar(state) : enemiesOf(state, civ.id).length > 0;
  // (nor while it arms for a war of its own: planWarAI)
  if (war || state.turn - (civ.flags.arming ?? -99) < 10 || colonies(state).some((c) => swarmThreat(state, c.systemId))) return;
  const up = fleetUpkeep(state, upkeepShare(state));
  if (up <= 0 || up <= STAND_DOWN_SHARE * Math.max(1, (civ.flags.last_energy_net ?? 0) + up)) return;
  for (const f of fleets(state)) if (f.at && !f.to && f.ships.length && f.ships.every((s) => isWarship(s.cls))) disbandFleet(state, f.id);
}

/** The settlers another civilization builds: ships of its own Threads. */
const WAY_SETTLERS: Record<SurvivorWay, string[]> = {
  garden: ['ark', 'seedcore'],
  upload: ['seedcore'],
  chorus: ['seedcore'],
  dormant: ['ark'],
  lattice: ['spore'],
  fork: ['seedcore', 'ark', 'spore'],
};

/**
 * 'warlike' plays as 'competent', and also wages the wars worth waging (for the harness: does war pay?).
 * 'lattice' plays as 'competent' led by the Lattice, as the Tessellate plays, and builds only the
 * Archive of Everything (for the harness: is the Quiet Lattice within reach, and no easier than the rest?).
 */
export type Strategy = 'competent' | 'passive' | 'warlike' | 'lattice';

/**
 * What each way of life learns first, as soon as it can (the rest in the common order): what keeps
 * its own kind going, and the theory of its own Great Work. (A Lattice-led player of ours learns the
 * Lattice itself first: the Tessellate begins knowing it.)
 */
export const WAY_RESEARCH: Record<SurvivorWay, string[]> = {
  garden: ['hardy_lineages', 'subterranean_cities', 'terraforming', 'garden_arks', 'garden_of_embers'],
  upload: ['slow_instancing', 'reversible_logic', 'cold_computation', 'glacial_cognition', 'asymptotic_mind'],
  chorus: ['assembly_of_threads', 'total_confluence'],
  dormant: ['hibernation_protocols', 'fusion_drives', 'deep_time_protocols', 'garden_of_embers'],
  lattice: ['autonomous_replicators', 'archive_theory'],
  fork: [],
};

/** The Great Work each way of life builds toward, and only that (works.ts): sleepers keep their Kin for the Last Garden. */
export const WAY_WORK: Record<SurvivorWay, string | null> = {
  garden: 'garden_of_embers',
  upload: 'hibernal_cascade',
  chorus: 'confluence',
  dormant: 'garden_of_embers',
  lattice: 'archive_of_everything',
  fork: null,
};

const TECH_PRIORITY = [
  'energy_storage', 'magnetospherics', 'the_long_record', 'orbital_collectors', 'survey_optics', 'mind_substrate', 'fusion_drives', 'hardy_lineages',
  'subterranean_cities', 'orbital_industry', 'fusion', 'upload', 'cold_sleep', 'slow_instancing', 'ember_harvest', 'orbital_defense', 'dyson_swarms',
  'last_light_protocols', 'reversible_logic', 'hibernation_protocols', 'deep_listening', 'hunger_studies', 'magnetic_sails', 'comet_shepherding', 'assembly_of_threads',
  'horizon_physics', 'accretion_engines', 'proton_question', 'deep_mantle', 'catalyzed_drives', 'mind_merging', 'halo_dynamics', 'pulsar_braking', 'hunger_lures', 'terraforming',
  // degenerate
  'cold_computation', 'glacial_cognition', 'relativistic_arks', 'deep_time_protocols', 'baryon_decay_harvest', 'curvature_harvest', 'leptonic_computation', 'penrose_process',
  'great_decay_protocols', 'hawking_capture',
  'deep_storage', 'brown_dwarf_mining', 'accretion_modelling', 'burst_capture', 'horizon_storage', 'abyssal_thought', 'gravitic_semaphore', 'quickening',
  'garden_arks', 'aegis_lattices', 'command_language',
  // black hole
  'bastion_architecture', 'horizon_cognition', 'error_correction', 'hawking_patience', 'horizon_writing', 'last_horizon_protocols',
  'conformal_mathematics', 'archive_theory', 'total_confluence', 'ultimate_slowness', 'positronium_weaving',
  // dark
  'asymptotic_mind', 'horizon_siphon', 'garden_of_embers',
];

function pickResearch(state: GameState) {
  const civ = state.civ;
  const cap = reserveCapacity(state, computeMods(state));
  const net = civ.flags.last_energy_net ?? 0;
  // in an energy crisis, stand the labs down; resume once the reserve recovers
  if (civ.researching && net < 0 && civ.energy < cap * 0.12) {
    civ.flags.auto_paused = 1;
    setResearch(state, null);
    return;
  }
  if (civ.flags.auto_paused && civ.energy < cap * 0.35) return;
  civ.flags.auto_paused = 0;
  // research that can never be of use in this game: Horizon Writing where matter is stable or no
  // hole would hold a vault ten decades more, Positronium Weaving where no positronium forms, once
  // it has decayed, or in the Dark Era (where what a civilization needs is the age's own research)
  const never = (id: string) =>
    (id === 'horizon_writing' && ((fateKnown(state) && fateOf(state) === 'stable') || state.eta > ERA_BY_ID.blackhole.endEta - 2 * LEAVE_MARGIN)) ||
    (id === 'positronium_weaving' && (!positroniumComes(state) || positroniumGone(state) || calendarEra(state) === 'dark'));
  // and research of no use now, which the list waits with (the cheapest-left fallback may still
  // take it: insight left idle is banked at half). Horizon Writing once something of ours is
  // leptonic; Positronium Weaving in the Black Hole Age's part of the window once matter is gone,
  // where it would weave a vault in (its reserve would not last to the decay at its net, with time
  // left to use it): before the Great Evaporation the crossing changes the reserve
  const leptonic = colonies(state).some((c) => formOf(c) === 'leptonic');
  const useless = (id: string) =>
    never(id) ||
    (id === 'horizon_writing' && !leptonic) ||
    (id === 'positronium_weaving' && (!leptonic || !positroniumHere(state) || !matterGone(state) || state.eta > WEAVE_WORTH || net >= 0 || civ.energy >= -net * turnsToDecay(state) || turnsToDecay(state) < WEAVE_TURNS));
  // what can no longer be of use is put down (what was put into it stays)
  if (civ.researching && never(civ.researching)) setResearch(state, null);
  // a pick that stored insight already covers is done at once: pick again, as a player would
  for (let i = 0; i < 6 && !civ.researching; i++) {
    const avail = new Set(availableTechs(state).map((t) => t.id));
    // (another civilization never falls back on a deliberate choice, noAuto: Halo Siphons, say;
    // with a swarm near, or at war, it learns to defend itself first: warships need it)
    const mine = civ.id === state.player;
    const guard = !mine && avail.has('orbital_defense') && (colonies(state).some((c) => swarmThreat(state, c.systemId)) || enemiesOf(state, civ.id).length > 0) ? 'orbital_defense' : undefined;
    const way = wayOf(state);
    const dark = hungerSteps(state);
    const order = [...(dark ? HUNGER_FIRST : []), ...(way ? WAY_RESEARCH[way] : []), ...TECH_PRIORITY];
    // (and the cheapest left, when the list is done, never one that can be of no use, nor the
    // weaving unless it would weave now: it is seldom of use, and idle insight is kept for what is)
    const next = guard ?? order.find((id) => avail.has(id) && !useless(id)) ?? [...avail].filter((id) => !never(id) && !(id === 'positronium_weaving' && useless(id)) && (dark || !TECHS.find((t) => t.id === id)?.taint) && (mine || !TECHS.find((t) => t.id === id)?.noAuto)).sort((a, b) => techCost(state, a) - techCost(state, b))[0];
    if (!next) break;
    setResearch(state, next);
  }
}

function lightAt(state: GameState, c: Colony): number {
  return sourceLight(state, state.systems[c.systemId], state.years, isFinite(state.turnLength) ? state.turnLength : 0).light;
}

function tryBuild(state: GameState, c: Colony, ids: string[]): boolean {
  for (const id of ids) {
    const d = STRUCTURE_BY_ID[id];
    if (!d) continue;
    if (structureCheck(state, c, d)) continue;
    const cost = buildCost(state, d, false);
    if ((cost.matter > 0 && state.civ.matter < cost.matter + 10) || (cost.energy > 0 && state.civ.energy < cost.energy + 20)) continue;
    if (!queueBuild(state, c.id, 'structure', id)) return true;
  }
  return false;
}

/** The fate of matter we plan for: the one we know, or, not knowing yet, the worst (decay, the soonest end). */
function plannedFate(state: GameState): Fate {
  return fateKnown(state) ? fateOf(state) : 'decay';
}

/**
 * The Long Flow, from a few turns before it: at a settlement no one keeps, wake a sleeper (one
 * awake keeps everything). With no one to wake, take apart what would flow and gives no power,
 * the dearest first, while its matter can still come back, never with energy we need; collectors
 * there go on gathering until they flow.
 */
function planFlow(state: GameState) {
  if (!flowing(state) && !(flowAhead(state) && fateKnown(state) && state.eta > FLOW_ETA - 3)) return;
  const civ = state.civ;
  const mods = computeMods(state);
  const logL = logTurnLength(turnStep(state));
  const spare = reserveCapacity(state, mods) * 0.3;
  for (const c of colonies(state)) {
    if (keeping(c, logL, mods) !== 'unmanned') continue;
    if (c.cryo > 0 && convert(state, c.id, 'thaw') === null) continue;
    const ids = Object.keys(c.structures).filter((id) => {
      const d = STRUCTURE_BY_ID[id];
      return (c.structures[id] ?? 0) > 0 && d && !d.decayProof && !d.energy && !d.reserveCap && id !== 'cryo_hall' && d.matter > 0;
    });
    ids.sort((a, b) => STRUCTURE_BY_ID[b].matter - STRUCTURE_BY_ID[a].matter || a.localeCompare(b));
    for (const id of ids) {
      if (civ.energy < dismantleTerms(state, STRUCTURE_BY_ID[id]).cost + spare) break;
      if (dismantle(state, c.id, id) === null) break;
    }
  }
}

/** Collectors whose source, once it gives nothing, never gives again: a star gone cold, a spent core or spin, a hole gone. */
const GONE_FOR_GOOD: EnergyMode[] = ['light', 'geo', 'spin', 'hawking', 'rekindle'];

/**
 * Short of matter, take apart one collector that gathers nothing (arrays under a star gone cold, a
 * tap on a spent core): the matter it cost comes back. One a turn, keeping energy in hand.
 */
function planDismantle(state: GameState) {
  const civ = state.civ;
  if (matterGone(state) || civ.matter >= 40) return;
  const pr = project(state);
  for (const c of colonies(state)) {
    for (const l of pr.perColony[c.id]?.y.lines ?? []) {
      const d = l.idle ? STRUCTURE_BY_ID[l.idle] : undefined;
      // only where the source is gone for good: decay and curvature harvesters wait for their time;
      // whatever a world flung loose left behind at its star is gone for good too
      if (!d?.matter || !(leftBehind(state, c, d) || (d.energy && GONE_FOR_GOOD.includes(d.energy.mode)))) continue;
      if (civ.energy < dismantleTerms(state, d).cost + 40) return;
      if (dismantle(state, c.id, d.id) === null) return;
    }
  }
}

/**
 * Decades of η the autoplayer leaves between a settlement's Passage done and the end of matter
 * (under decay, matter begins to dissolve a decade and a half before it: physics.ts).
 */
const PASSAGE_SPARE = 2;
/** Matter stable: Leptonic Substrate built from this many turns before matter can begin to tunnel into black holes (deeptime.ts). */
const COLLAPSE_PREPARE = 12;
/** The Passage begun this many turns before everything is iron (deeptime.ts). */
const IRON_LEAD = 2;

/** Turns of its own industry the Passage (or what is left of it) would take here: Infinity with none. */
function passageTurns(c: Colony, industry: number): number {
  const per = c.last?.industry ?? 0;
  return per > 0 ? Math.ceil(industry / per) : Infinity;
}

/**
 * How many decades the Passage would take here: at the Tide, or at our pace if it is quicker. A
 * slower pace covers more decades a turn, and minds work a turn's worth whatever its length, so
 * then it would take longer; planning on the Tide, it is rushed at the end if need be.
 */
function passageNeeds(state: GameState, c: Colony, industry: number): number {
  return Math.min(passageEta(state, c, industry, 0), passageEta(state, c, industry));
}

/**
 * Is the Passage due at this settlement: begun now, would its own industry finish it about
 * PASSAGE_SPARE decades before matter ends, and no sooner (what it takes apart gives nothing
 * after)? And is there energy for it, and some? Measured in decades, not turns, which the pace
 * makes longer or shorter.
 */
function passageDue(state: GameState, c: Colony): boolean {
  if (formOf(c) !== 'baryonic' || c.queue.some((q) => q.kind === 'passage')) return false;
  if (!hasTech(state, 'leptonic_computation') || !endForeseen(state)) return false;
  const terms = passageTerms(state, c);
  if (state.civ.energy < terms.energy + 20) return false;
  // matter stable: it tunnels into black holes deep in the Dark Era, where one turn spans more
  // decades than the rule below could count. What it gives (fusion, a Hearth's fuel) it gives
  // until everything is iron: so it is kept until then, and the Passage begun two turns before
  // (or at once, past it), and rushed the turn before, while that last energy can pay for it, with
  // matter that is about to be worth nothing (passageLate)
  if (plannedFate(state) === 'stable') {
    if (state.era !== 'dark') return false;
    const pace = clockCiv(state).pace;
    if (!isFinite(turnsToCollapse(state, pace))) return false;
    return ironAge(state) || turnsToEta(state, IRON_ETA, pace) <= IRON_LEAD;
  }
  const left = etaToEndOfMatter(state);
  const need = passageNeeds(state, c, terms.industry);
  return need < left && left <= need + PASSAGE_SPARE;
}

/**
 * Is the Passage under way here, in the last decades before matter ends, and at our pace its own
 * industry would not finish it a decade before the end? Then it is rushed, with matter that will
 * soon be gone anyway.
 */
function passageLate(state: GameState, c: Colony): boolean {
  const q = c.queue[0];
  if (q?.kind === 'passage' && plannedFate(state) === 'stable') {
    const pace = clockCiv(state).pace;
    return ironAge(state) || turnsToEta(state, IRON_ETA, pace) <= 1 || turnsToCollapse(state, pace) <= passageTurns(c, q.cost - q.progress) + 1;
  }
  const left = etaToEndOfMatter(state);
  return q?.kind === 'passage' && left <= PASSAGE_SPARE + 1 && passageEta(state, c, q.cost - q.progress) > left - 1;
}

/**
 * A leptonic settlement at a hole that is failing it, drained of spin or gone (or soon to
 * evaporate, unless its Burst Catchers wait for the final burst), drifts to a better one.
 */
function planDrift(state: GameState) {
  for (const c of colonies(state)) {
    if (formOf(c) !== 'leptonic') continue;
    const sys = state.systems[c.systemId];
    if (!holeFailing(state, sys)) continue;
    const p = sys.primary;
    const hole = p.kind === 'black_hole' || p.kind === 'smbh';
    // (only evaporating: Burst Catchers here bank its final burst first, and then it leaves)
    if (hole && p.spin >= SPENT_SPIN && (c.structures.burst_catcher ?? 0) > 0) continue;
    driftToAnotherHole(state, c.id);
  }
}

/**
 * In the Black Hole Age, where the reserve would not last the age at the rate it is going, a
 * leptonic vault at a hole that will long outlive it is written into the horizon: a tenth of the
 * upkeep, a quarter of the pace.
 */
function planHorizon(state: GameState) {
  if (calendarEra(state) !== 'blackhole' || !hasTech(state, 'horizon_writing')) return;
  const civ = state.civ;
  const net = civ.flags.last_energy_net ?? 0;
  // (the turns left in the age at our pace)
  const left = Math.max(5, turnsUntilYears(state, Math.pow(10, ERA_BY_ID.blackhole.endEta)));
  if (net >= 0 || civ.energy >= -net * left) return;
  for (const c of colonies(state)) {
    const p = state.systems[c.systemId].primary;
    if (p.evaporateAt && Math.log10(p.evaporateAt) - state.eta < 2 * LEAVE_MARGIN) continue;
    if (horizonCheck(state, c) === null && beginHorizon(state, c.id) === null) c.queue.unshift(c.queue.pop()!);
  }
}

/** Past this η a weaving or a net would not pay for itself before the atoms decay (η 141). */
const WEAVE_WORTH = 130;
/** Fewer turns than this before the decay, the weaving is not worth researching: the research, the weaving and a few turns in the weave. */
const WEAVE_TURNS = 6;

/**
 * In the positronium's window, where the reserve would run out before the atoms decay at the
 * rate it is going, a leptonic settlement is woven through them (a fiftieth of the upkeep, a tenth
 * of the pace); and every settlement in the weave leaves it when the decay is within two turns at
 * our pace (only those still in it then are lost).
 */
function planWeave(state: GameState) {
  if (!positroniumHere(state)) return;
  const civ = state.civ;
  const left = turnsToDecay(state);
  for (const c of colonies(state)) if (formOf(c) === 'positronium' && left <= 2) leaveWeave(state, c.id);
  if (!hasTech(state, 'positronium_weaving') || state.eta > WEAVE_WORTH || left < 4) return;
  const net = civ.flags.last_energy_net ?? 0;
  if (net >= 0 || civ.energy >= -net * left) return;
  for (const c of colonies(state)) if (weaveCheck(state, c) === null && beginWeave(state, c.id) === null) c.queue.unshift(c.queue.pop()!);
}

function planBuilds(state: GameState) {
  const civ = state.civ;
  const mods = computeMods(state);
  const cap = reserveCapacity(state, mods);
  const net = civ.flags.last_energy_net ?? 0;
  const lateDusk = calendarEra(state) === 'dusk' && state.eta > 13.99;
  // before matter ends (the Great Decay, or the Great Evaporation), re-encode onto leptonic substrate
  const fate = plannedFate(state);
  // about as many turns ahead for either: the Black Hole Age's Tide covers a decade a turn, the Degenerate Age's under half
  const preEnd =
    fate === 'decay'
      ? calendarEra(state) === 'degenerate' && state.eta > 27
      : fate === 'curvature'
        ? state.eta > 62 && !matterGone(state)
        : state.era === 'dark' && !matterGone(state) && turnsToCollapse(state, clockCiv(state).pace) <= COLLAPSE_PREPARE;
  // under curvature the end is far off, but a settlement's matter runs out long before it (near η
  // 45 to 55), and a Bastion Shell, which costs none, stands only at a black hole: so from η 27 it
  // re-encodes too, in the ordinary way, after what it needs for energy, from matter to spare
  const reencode = fate === 'curvature' && state.eta > 27 && !preEnd && !matterGone(state) && civ.matter > 200;
  const t = threadTotals(state);
  const way = wayOf(state);
  for (const c of colonies(state)) {
    // the Passage, where its own industry can finish it a little before matter ends, and no
    // sooner: at the front of the queue, and rushed only if it would not be done in time
    if (passageDue(state, c)) {
      if (c.queue.length >= 6) removeQueued(state, c.id, c.queue[c.queue.length - 1].uid);
      if (!beginPassage(state, c.id)) c.queue.unshift(c.queue.pop()!);
    }
    if (passageLate(state, c)) rushBuild(state, c.id);
    // (a settlement making the Passage, or past it, needs no substrate to go on)
    const passing = formOf(c) !== 'baryonic' || c.queue.some((q) => q.kind === 'passage');
    // before the protons go, re-encoding goes to the front of the queue
    if (!passing && preEnd && hasTech(state, 'leptonic_computation') && (c.structures.lepton_substrate ?? 0) < 2) {
      if (!c.queue.some((q) => q.key === 'lepton_substrate')) {
        if (c.queue.length >= 6) removeQueued(state, c.id, c.queue[c.queue.length - 1].uid);
        if (tryBuild(state, c, ['lepton_substrate'])) {
          const q = c.queue.pop()!;
          c.queue.unshift(q);
        }
      }
      if (c.queue[0]?.key === 'lepton_substrate') rushBuild(state, c.id);
    }
    // and for its Chorus, which has no room on substrate, a Leptonic Confluence, right behind it
    const confluences = Math.min(3, Math.ceil(c.pops.chorus / 3));
    if (!passing && preEnd && hasTech(state, 'leptonic_computation') && (c.structures.lepton_confluence ?? 0) < confluences && !c.queue.some((q) => q.key === 'lepton_confluence')) {
      if (c.queue.length >= 6) removeQueued(state, c.id, c.queue[c.queue.length - 1].uid);
      if (tryBuild(state, c, ['lepton_confluence'])) c.queue.splice(c.queue[0]?.key === 'lepton_substrate' ? 1 : 0, 0, c.queue.pop()!);
    }
    if (preEnd && c.queue[0]?.key === 'lepton_confluence') rushBuild(state, c.id);
    if (c.queue[0] && c.queue[0].kind !== 'passage' && civ.matter > 600) rushBuild(state, c.id);
    // while the Passage rewrites it, nothing else is built there
    if (c.queue.length >= 2 || c.queue.some((q) => q.kind === 'passage' || q.kind === 'horizon' || q.kind === 'weave')) continue;
    const b = state.bodies[c.bodyId];
    const capc = capacity(state, c, mods);
    const light = lightAt(state, c);
    // (another civilization keeps as much in hand as its caution asks: about ours on the whole)
    const caution = way && civ.id !== state.player ? temperament(state, civ.id).caution : 0.5;
    const energyFirst = net < 2 + 2 * caution || civ.energy < cap * (0.15 + 0.2 * caution);
    const plan: string[] = [];
    if (preEnd) plan.push('lepton_substrate');
    if (calendarEra(state) === 'blackhole') plan.push('penrose_harvester', 'hawking_collector', 'bastion', 'horizon_vault');
    if (calendarEra(state) === 'degenerate' && state.eta > 30) plan.push('penrose_harvester', 'hawking_collector');
    if (calendarEra(state) === 'dark') plan.push('preservation_array', 'horizon_siphon');
    // matter stable: the last flashes and the collapse, banked (deeptime.ts)
    if (calendarEra(state) === 'dark' && fate === 'stable' && !matterGone(state)) plan.push('burst_catcher');
    if (fate === 'curvature' && state.eta > 29 && state.eta < DEGENERATE_END.curvature) plan.push('curvature_collector');
    // after the embers: burn matter (it is going anyway), feed black holes, catch the decay
    if (calendarEra(state) === 'degenerate' && light < 0.3) {
      if (fate === 'decay' && state.eta > 29) plan.push('decay_harvester');
      if (civ.matter > 60) plan.push('accretion_engine', 'fusion_plant');
    }
    if (energyFirst) {
      if (light > 0.3) plan.push('dyson_swarm', 'orbital_collector', 'ember_collector', 'infrared_shroud', 'solar_array');
      plan.push('disk_skimmer', 'accretion_engine', 'pulsar_brake', 'geothermal_tap', 'fusion_plant', 'decay_harvester');
    }
    if (reencode && !passing && (c.structures.lepton_substrate ?? 0) + c.queue.filter((q) => q.key === 'lepton_substrate').length < 2) plan.push('lepton_substrate');
    if (reencode && !passing && (c.structures.lepton_confluence ?? 0) + c.queue.filter((q) => q.key === 'lepton_confluence').length < confluences) plan.push('lepton_confluence');
    // (another civilization builds for Kin only where Kin live)
    const forKin = !way || c.pops.kin > 0;
    // its star has died: light Orbital Lamps while there is still life to keep
    if (forKin && calendarEra(state) === 'dusk' && b.vitality >= 0.2 && vitalityLoss(state, b, c).freeze > 0) plan.unshift('orbital_lamps');
    if (b.traits.includes('homeworld') && calendarEra(state) === 'dusk') plan.push('mag_shield', 'comet_shepherd', 'core_stimulator');
    if (forKin && c.pops.kin >= capc.kin - 1 && calendarEra(state) === 'dusk') {
      plan.push('warrens', 'habitat_dome');
      // then make the world itself more livable, where that can bring it to life
      if (terraformSummary(state, b, c).full >= SEED_MIN) plan.push('orbital_mirrors', 'atmosphere_works', 'biosphere_seeding');
    }
    // (the Tessellate makes no minds: empty substrate would fill with Echoes)
    if (way !== 'lattice' && hasTech(state, 'mind_substrate') && c.pops.echoes >= capc.echoes - 1) plan.push('substrate_core');
    if (way) {
      // room for its own: a Chorus with Echoes to gather, a Lattice that has filled its beds
      if (hasTech(state, 'mind_merging') && c.pops.chorus >= capc.chorus - 1 && c.pops.echoes >= 2) plan.push('confluence_node');
      if (hasTech(state, 'autonomous_replicators') && c.pops.lattice >= capc.lattice - 1) plan.push('lattice_foundry');
      // the Tessellate's own thinking, where the settlement makes three times what a Search Foundry
      // more would take (its building goes on), and its agreements while its accord runs short
      if (way === 'lattice' && c.pops.lattice > 0) {
        const made = c.last?.industry ?? 0;
        if (made >= SEARCH_SPARE * (STRUCTURE_BY_ID.search_foundry.search?.draw ?? 0) * ((c.structures.search_foundry ?? 0) + 1)) plan.push('search_foundry');
        if (civ.accord < REGISTRY_BELOW && made >= SEARCH_SPARE * (STRUCTURE_BY_ID.protocol_registry.search?.draw ?? 0)) plan.push('protocol_registry');
      }
      // a swarm near: defences first
      if (swarmThreat(state, c.systemId)) plan.unshift('defense_grid');
    }
    if (way !== 'lattice' && hasTech(state, 'cold_computation') && c.pops.coldminds >= capc.coldminds - 1) plan.unshift('cold_vault');
    if (lateDusk && c.pops.kin > 0) plan.push('cryo_hall');
    if (calendarEra(state) === 'dusk' && state.eta > 13.985) plan.push('ember_collector', 'infrared_shroud', 'fusion_plant', 'accretion_engine', 'reserve_vault');
    if (civ.energy > cap * 0.8) plan.push('reserve_vault', 'superconducting_ring', 'horizon_vault', 'burst_catcher');
    if (civ.matter < 80) plan.push('mine', 'hydrogen_skimmer', 'brown_siphon');
    if (t.echoes > 0 && hasTech(state, 'upload')) plan.push('upload_clinic');
    if (way !== 'lattice' && hasTech(state, 'cold_computation')) plan.push('cold_vault');
    if (Object.values(state.swarms).some((s) => !s.tamed && s.awake)) plan.push('defense_grid');
    // nets for the widest atoms, while what is left of their light still pays for them, and only
    // from spare energy: they pay back mostly near the decay, after the Last Horizon, whose
    // Continuity counts the reserve saved
    if (positroniumHere(state) && state.eta < WEAVE_WORTH && civ.energy > cap * 0.8) plan.push('positronium_net');
    plan.push('archive_spire', 'orbital_collector', 'solar_array', 'foundry', 'ember_collector', 'infrared_shroud', 'relic_dig', 'commons', 'reserve_vault');
    tryBuild(state, c, plan);
  }
}

function settleScore(state: GameState, b: Body, thread: ThreadId): number {
  const sys = state.systems[b.systemId];
  if (sys.gone || b.dissolved || b.colonyId) return -1;
  if (canSettle(state, b, thread)) return -1;
  const light = sourceLight(state, sys, state.years, 0).light;
  let s = light * 3 + b.richness * 0.5;
  if (thread === 'kin') s += b.habitability * 4 * (0.3 + b.vitality);
  if (calendarEra(state) === 'degenerate' && (sys.primary.kind === 'black_hole' || sys.primary.kind === 'smbh')) s += 3;
  if (calendarEra(state) === 'degenerate' && emberShare(sys.primary, state.years, haloDrawn(state)) > 0) s += 2;
  // late in the Dusk, look ahead: dark-matter embers and black holes will be all that is left
  if (calendarEra(state) === 'dusk' && state.eta > 13.99 && (sys.primary.halo || sys.primary.kind === 'black_hole')) s += 2.5;
  if (sys.special === 'core' && eraIndex(calendarEra(state)) >= 1) s += 4;
  if (eraIndex(calendarEra(state)) >= 2 && (sys.primary.kind === 'black_hole' || sys.primary.kind === 'smbh')) s += 2 + Math.min(6, sys.primary.spin / 200);
  // matter will dissolve: the future is at the black holes (under curvature, the ones that outlast it)
  const fate = plannedFate(state);
  const hole = sys.primary.kind === 'black_hole' || sys.primary.kind === 'smbh';
  if (fate === 'decay' && calendarEra(state) === 'degenerate' && state.eta > 24 && hole) s += 10;
  if (fate === 'curvature' && state.eta > 50 && hole && (sys.primary.evaporateAt ?? Infinity) > Math.pow(10, MATTER_END.curvature)) s += 10;
  // a neutron star that will burst is no place to settle
  if (fate === 'curvature' && sys.primary.kind === 'neutron_star' && state.eta > 55) return -1;
  if (b.kind === 'deep' && thread !== 'kin') s += 0.5;
  return s;
}

function planFleets(state: GameState) {
  const civ = state.civ;
  const capital = civ.capitalId ? state.colonies[civ.capitalId] : colonies(state)[0];
  if (!capital) return;
  const home = state.systems[capital.systemId];
  for (const f of fleets(state)) {
    if (!f.at || f.order !== 'idle') continue;
    const here = state.systems[f.at];
    const settler = f.ships.find((s) => ['ark', 'seedcore', 'spore', 'vaultship', 'lighter'].includes(s.cls));
    if (settler) {
      // an Ark of the sleepers goes to the new star they race for, to a cold world there
      const race = settler.cls === 'ark' ? raceFor(state) : null;
      const goal = race ? race.bodies.map((id) => state.bodies[id]).filter((b) => b && settleScore(state, b, 'kin') > 0).sort((a, b) => settleScore(state, b, 'kin') - settleScore(state, a, 'kin'))[0] : undefined;
      if (goal) {
        orderFleet(state, f.id, goal.systemId, 'colonize', goal.id);
        continue;
      }
      const thread: ThreadId = settler.cls === 'ark' || settler.cls === 'lighter' ? 'kin' : settler.cls === 'spore' ? 'lattice' : settler.cls === 'vaultship' ? 'coldminds' : 'echoes';
      let best: Body | null = null;
      let bestS = 0;
      for (const [sid, k] of Object.entries(civ.known)) {
        if (!k) continue;
        if (settler.cls === 'lighter' && sid !== here.id) continue;
        const sys = state.systems[sid];
        const d = distLy(here, sys);
        for (const bid of sys.bodies) {
          const b = state.bodies[bid];
          const s = settleScore(state, b, thread) / (1 + d / (calendarEra(state) === 'dusk' ? 40 : 1e6));
          if (s > bestS) {
            bestS = s;
            best = b;
          }
        }
      }
      if (best) orderFleet(state, f.id, best.systemId, 'colonize', best.id);
      continue;
    }
    if (f.ships.some((s) => s.cls === 'probe')) {
      const target = Object.entries(civ.known)
        .filter(([, k]) => k === 1)
        .map(([id]) => state.systems[id])
        .filter((s) => !s.gone && !swarmSeenAt(state, s.id) && !fleets(state).some((o) => o.to === s.id))
        .sort((a, b) => distLy(here, a) - distLy(here, b))[0];
      if (target && civ.energy > 20) orderFleet(state, f.id, target.id, 'survey');
    }
  }
  // build settlers
  const nCol = colonies(state).length;
  const way = wayOf(state);
  // (another civilization spreads as far as its ambition takes it: a star fewer, or one more)
  const reach = way && civ.id !== state.player ? Math.round(2 * temperament(state, civ.id).ambition - 1) : 0;
  const want = (calendarEra(state) === 'dusk' ? 3 + Math.floor(state.eraTurn / 12) : 4 + Math.floor(state.eraTurn / 10)) + reach;
  const inFlight = fleets(state).filter((f) => f.ships.some((s) => ['ark', 'seedcore', 'spore', 'vaultship', 'lighter'].includes(s.cls))).length + capital.queue.filter((q) => q.kind === 'ship').length;
  const fate = plannedFate(state);
  // a black hole that will outlast the end of matter (under curvature, only the big ones do)
  const lasting = (k: string, at?: number) => (k === 'black_hole' || k === 'smbh') && (fate !== 'curvature' || (at ?? Infinity) > Math.pow(10, MATTER_END.curvature));
  const atHole = colonies(state).some((c) => lasting(state.systems[c.systemId].primary.kind, state.systems[c.systemId].primary.evaporateAt));
  const needHole = ((fate === 'decay' && calendarEra(state) === 'degenerate' && state.eta > 22) || (fate === 'curvature' && state.eta > 50 && !matterGone(state))) && !atHole && inFlight === 0 && civ.matter > 80;
  const settling = nCol + inFlight < want + (needHole ? 1 : 0) && (capital.structures.shipyard ?? 0) > 0 && capital.queue.length < 3;
  const lighterBusy = fleets(state).some((f) => f.ships.some((x) => x.cls === 'lighter')) || capital.queue.some((q) => q.key === 'lighter');
  const homeCols = colonies(state).filter((c) => c.systemId === capital.systemId).length;
  // only worth a Lighter where the world itself still has room to live
  const freeHere = home.bodies.some((bid) => {
    const b = state.bodies[bid];
    return b && !b.colonyId && !canSettle(state, b, 'kin') && b.habitability * b.vitality > 0.05;
  });
  const lighting = calendarEra(state) === 'dusk' && !lighterBusy && freeHere && homeCols < 2 && capital.pops.kin >= 6;
  // only expand what the economy can carry: new settlements cost upkeep long before they pay
  // (worked out only when a ship could be built: the projection is the dearest of a turn's decisions)
  let affordable = false;
  if (settling || lighting) {
    const pr = project(state);
    affordable = pr.energyIn - pr.energyOut > 2 + nCol * 1.5 && civ.energy > reserveCapacity(state, computeMods(state)) * 0.4;
  }
  // the sleepers race for a new star near them: an Ark at once, whatever else waits
  const race = raceFor(state);
  const settlerTo = (id: string) => fleets(state).some((f) => f.to === id && f.ships.some((x) => SHIP_BY_ID[x.cls]?.settles));
  if (race && !settlerTo(race.id) && !capital.queue.some((q) => q.key === 'ark') && (capital.structures.shipyard ?? 0) > 0) {
    if (capital.queue.length >= 3) removeQueued(state, capital.id, capital.queue[capital.queue.length - 1].uid);
    if (!queueBuild(state, capital.id, 'ship', 'ark')) {
      const q = capital.queue.pop()!;
      capital.queue.unshift(q);
    }
  }
  if ((affordable || needHole) && settling) {
    const opts = way ? [...WAY_SETTLERS[way]] : calendarEra(state) === 'dusk' ? ['seedcore', 'ark', 'spore'] : ['vaultship', 'seedcore', 'spore'];
    if (eraIndex(calendarEra(state)) >= (way ? 1 : 2)) opts.unshift('vaultship');
    for (const k of opts) if (!queueBuild(state, capital.id, 'ship', k)) break;
  }
  if (lighting && affordable && capital.queue.length < 3) queueBuild(state, capital.id, 'ship', 'lighter');
  if (state.eraTurn % 25 === 3 && fleets(state).filter((f) => f.ships.some((s) => s.cls === 'probe')).length < 2) queueBuild(state, capital.id, 'ship', 'probe');
}

/**
 * Whether another civilization takes Hunger steps (the new version, part 2b): only one desperate
 * enough (plight, from DESPERATE_AT) and bold enough (caution under BOLD_BELOW) to. Ours never, as
 * our autoplayer never has.
 */
const DESPERATE_AT = 0.6;
const BOLD_BELOW = 0.5;
function hungerSteps(state: GameState): boolean {
  const civ = state.civ;
  if (civ.id === state.player) return false;
  return plight(state, civ.id) >= DESPERATE_AT && temperament(state, civ.id).caution < BOLD_BELOW;
}

/** What a civilization that takes Hunger steps learns first: Hunger Engines (matter +40%). */
const HUNGER_FIRST = ['hunger_studies', 'command_language', 'hunger_engines'];

/** The new star the sleepers race for (another civilization of the dormant way): one burning near them, with a cold world free. */
function raceFor(state: GameState): StarSystem | null {
  if (wayOf(state) !== 'dormant' || state.civ.id === state.player) return null;
  const sv = state.survivors[state.civ.id];
  return sv ? newStarNear(state, sv) : null;
}

/** Turns of reserve left below which the sleepers sleep through hard times, and how long they sleep. */
const SLEEP_BELOW = 12;
const SLEEP_FOR = 8;

/**
 * The sleepers (another civilization of the dormant way) sleep through hard times, as their way
 * has always done: with the reserve running out, the Long Sleep. A new star near wakes them, to
 * race for it (planFleets).
 */
function planSleep(state: GameState) {
  if (wayOf(state) !== 'dormant' || state.civ.id === state.player) return;
  const civ = state.civ;
  if (raceFor(state)) {
    if (civ.dormant) setDormant(state, false);
    return;
  }
  const net = civ.flags.last_energy_net ?? 0;
  if (!civ.dormant && net < 0 && civ.energy < -net * SLEEP_BELOW && hasTech(state, 'hibernation_protocols')) longSleep(state, SLEEP_FOR);
}

/** A starving civilization cools Echoes once its reserve would last fewer turns than this (in the Dark Era, than the age has left). */
const COOL_BELOW = 5;

function planThreads(state: GameState) {
  const mods = computeMods(state);
  const step = turnStep(state);
  const logL = logTurnLength(step);
  const kinStrain = strainFor('kin', logL, mods).m;
  const echoes = strainFor('echoes', logL, mods);
  const echoStrain = echoes.m;
  const way = wayOf(state);
  // starving, it cools Echoes into Coldminds, which cost a fraction as much, as many as it takes to
  // pay its way (in the Dark Era, to make the reserve last the age) and the vaults have room for:
  // cooling a mind costs nothing but the self it was
  // (in the Dark Era nothing refills the reserve: it must last to the end of the age)
  const civ = state.civ;
  const net = civ.flags.last_energy_net ?? 0;
  const dark = calendarEra(state) === 'dark';
  const horizon = dark ? Math.max(COOL_BELOW, darkTurnsLeft(state)) : COOL_BELOW;
  if (net < 0 && civ.energy < -net * horizon) {
    const cold = strainFor('coldminds', logL, mods);
    const saving = Math.max(0.01, THREAD_DEFS.echoes.energyUpkeep * echoes.upkeepMul * mods.upkeep.echoes - THREAD_DEFS.coldminds.energyUpkeep * cold.upkeepMul * mods.upkeep.coldminds);
    let short = -net - (dark ? civ.energy / horizon : 0);
    for (const c of colonies(state)) while (short > 0 && c.pops.echoes > 0 && convert(state, c.id, 'cool') === null) short -= saving;
  }
  for (const c of colonies(state)) {
    for (let i = 0; i < 2; i++) {
      if (kinStrain > 2 && c.pops.kin > 1) {
        if (convert(state, c.id, 'upload')) convert(state, c.id, 'freeze');
      }
      if (echoStrain > 0.5 && c.pops.echoes > 0) convert(state, c.id, 'cool');
      // (another civilization keeps two awake to keep each settlement)
      if (calendarEra(state) === 'dusk' && state.eta > 13.995 && c.pops.kin > (way ? 2 : 0)) convert(state, c.id, 'freeze');
      // the Chorus gathers its Echoes, two to each merged mind, keeping a few to grow from;
      // the sleepers sleep, all but those two
      if (way === 'chorus' && c.pops.echoes >= 4) convert(state, c.id, 'merge');
      if (way === 'dormant' && c.pops.kin > 2) convert(state, c.id, 'freeze');
    }
  }
}

function planCharters(state: GameState) {
  // (one desperate and bold enough takes what the dead left: Consume the Dead, matter at once)
  const order = [...(hungerSteps(state) ? ['consume_the_dead'] : []), 'open_archives', 'right_to_stop', 'thread_parity', 'merge_consent', 'sanctuary', 'the_long_watch', 'lattice_compact'];
  for (const id of order) if (!charterAvailable(state, id)) enactCharter(state, id);
}

/** Spend accord beyond what the next law might cost: on resolve when it runs low, on dissent when it runs high, and on the Thread most out of sorts. */
function planAccord(state: GameState) {
  const civ = state.civ;
  const keep = ACCORD_KEEP;
  const can = (use: AccordUse, t?: ThreadId) => !accordCheck(state, use, t) && civ.accord - accordCost(state, use, t) >= keep;
  if (civ.resolve < ACCORD_RALLY_BELOW && can('rally')) spendAccord(state, 'rally');
  if (civ.dissent > ACCORD_CALM_ABOVE && can('calm')) spendAccord(state, 'calm');
  const low = THREADS.filter((t) => THREAD_DEFS[t].conscious && civ.standing[t] < ACCORD_HEAR_BELOW).sort((a, b) => civ.standing[a] - civ.standing[b])[0];
  if (low && can('hear', low)) spendAccord(state, 'hear', low);
}

/** Pacts: propose one a turn to a neighbour who thinks well enough of us, while accord allows. */
function planPacts(state: GameState) {
  const civ = state.civ;
  // (between other civilizations, their ties: ties.ts)
  if (civ.id !== state.player) {
    if (wayOf(state)) planTies(state, ACCORD_KEEP);
    return;
  }
  for (const sv of Object.values(state.survivors)) {
    const kind = PACT_KINDS.find((k) => !hasPact(sv, k) && sv.disposition >= PACTS[k].need);
    if (!kind || pactBlocked(state, sv, kind) !== null) continue;
    if (civ.accord < pactCost(state) + ACCORD_KEEP) return;
    if (proposePact(state, sv.id, kind) === null) return;
  }
}

/**
 * A war another civilization began on us (part 2c-2), whatever our strategy: we fight it as the
 * others fight theirs (`fightWar`, the combat system, 20 Oct): we arm against what threatens us, go
 * for what comes to our stars, wait at the settlement they are coming for, dug in, and pick our
 * tactics; warlike, we strike back at theirs nearest us, and storm what we hold long enough.
 */
function planDefence(state: GameState, warlike: boolean) {
  const civ = state.civ;
  if (civ.id !== state.player) return;
  // an enemy that could strike with a Kinetic Lance: a Picket kept at the capital (as the others do)
  if (Object.values(state.survivors).some((sv) => sv.alive && sv.war && state.civs[sv.id]?.techs.includes('relativistic_arks'))) keepWatch(state);
  // a war a civilization of its own began on us: we fight it as the others do (fightWar), striking
  // back at theirs only when warlike (the competent defend, as they always have)
  const theirs = Object.values(state.survivors).filter((sv) => sv.alive && sv.war?.by && sv.war.by !== civ.id && state.civs[sv.id]);
  if (!Object.values(state.survivors).some((sv) => sv.alive && sv.war)) comeHome(state, lineOfBattle(state));
  if (!theirs.length) return;
  fightWar(state, theirs.map((sv) => sv.id), lineOfBattle(state), warlike);
  if (warlike) for (const sv of theirs) if (seizeBlocked(state, sv) === null) seizeSurvivor(state, sv.id);
}

/**
 * War, for the 'warlike' strategy only: against our own people who left us, or a neighbour who
 * keeps raiding us, with warships enough to outmatch them. Build Wardens, declare, bring them to
 * the siege (against a civilization of its own, as the others fight: `fightWar`), take the star
 * when the siege allows; make peace if it drags on.
 */
function planWar(state: GameState) {
  const civ = state.civ;
  if (civ.id !== state.player) return;
  const cap = civ.capitalId ? state.colonies[civ.capitalId] : colonies(state)[0];
  if (!cap) return;
  const warships = fleets(state).filter((f) => f.ships.some((x) => isWarship(x.cls)));
  const force = warships.reduce((a, f) => a + f.ships.reduce((b, x) => b + strength(x.cls, 'settlements'), 0), 0);
  for (const sv of Object.values(state.survivors)) {
    if (!sv.alive || !sv.contact) continue;
    // (a war they began on us is planDefence's)
    if (sv.war?.by && sv.war.by !== civ.id) continue;
    if (sv.war) {
      // (losing it, as the others judge theirs: a settlement lost in it, or a siege of theirs we cannot break)
      const real = !!state.civs[sv.id];
      const losing = real && ((sv.war.lost ?? 0) > 0 || colonies(state).some((c) => c.siege?.by === sv.id && force < guardAt(state, c.systemId, sv.id)));
      if (seizeBlocked(state, sv) === null) seizeSurvivor(state, sv.id);
      else if (state.turn - sv.war.since > 30 || losing) makePeace(state, sv.id);
      // a civilization of its own fights back: we fight as the others do, to the front
      else if (real) fightWar(state, [sv.id], lineOfBattle(state), true);
      else if (raidStrength(state, sv.war.at ?? sv.homeSystemId) <= 0) for (const f of warships) if (f.at && f.at !== (sv.war.at ?? sv.homeSystemId)) orderFleet(state, f.id, sv.war.at ?? sv.homeSystemId, 'move');
      continue;
    }
    if (!warCause(state, sv)) continue;
    if (force >= warDefence(state, sv) * 2 && warBlocked(state, sv) === null && civ.accord >= WAR_ACCORD + ACCORD_KEEP) declareWar(state, sv.id);
    else if (force < warDefence(state, sv) * 2 && (cap.structures.shipyard ?? 0) > 0 && cap.queue.length < 3 && civ.energy > 120) queueBuild(state, cap.id, 'ship', 'warden');
  }
}

function planSignals(state: GameState) {
  const civ = state.civ;
  for (const s of state.civ.signals) {
    if (s.resolved || s.arrivedTurn === null || !s.choices.length) continue;
    let choice = s.choices[s.choices.length - 1].id;
    if (s.kind === 'aid') choice = civ.energy > Number(s.data.ask) * 3 ? 'give' : 'refuse';
    if (s.kind === 'refugees') choice = 'accept';
    if (s.kind === 'exodus') choice = 'take';
    if (s.kind === 'choir_wish') choice = 'let';
    if (s.kind === 'pact_offer') choice = civ.accord >= pactCost(state) + ACCORD_KEEP ? 'accept' : 'decline';
    if (s.kind === 'joint') choice = civ.matter > 120 ? 'join' : 'decline';
    if (s.kind === 'trade') {
      // a deal we can afford three times over (an old offer: 40 matter, as it always was)
      const ask = s.data.ask !== undefined ? Number(s.data.ask) : 40;
      const have = s.data.want === 'energy' ? civ.energy : civ.matter;
      choice = have > Math.max(ask * 3, s.data.ask !== undefined ? 0 : 150) ? 'trade' : 'decline';
      // notes on Hunger knowledge are a Hunger act to take: only for one that takes such steps
      if (Number(s.data.taint ?? 0) > 0 && !hungerSteps(state)) choice = 'decline';
    }
    if (s.kind === 'slow_first') choice = 'math';
    if (s.kind === 'dark_reveal1') choice = 'ease';
    if (s.kind === 'dark_reveal2') choice = 'help';
    if (answerSignal(state, s.uid, choice)) answerSignal(state, s.uid, s.choices[s.choices.length - 1].id);
  }
  // (the Unlit speak to the player alone)
  const dark = state.minds.dark;
  if (civ.id === state.player && dark.stage >= 2 && dark.stage < 5 && civ.energy > 80 && civ.matter > 40) makeGesture(state, patternAnswer(dark.lastPattern));
}

/** Pay to keep time with a new star only while half the store would remain afterwards. */
function clockTooDear(state: GameState, defId: string, choice: number, systemId: string): boolean {
  if ((defId !== 'new_star' && defId !== 'white_fire' && defId !== 'helium_giant') || choice !== 0) return false;
  const cost = starClockTerms(state, state.systems[systemId]).cost;
  return cost > 0 && state.civ.energy - cost < 0.5 * reserveCapacity(state, computeMods(state));
}

function planEvents(state: GameState) {
  for (const p of [...state.civ.pending]) {
    const def = EVENT_BY_ID[p.defId];
    if (!def) continue;
    let done = false;
    for (let i = 0; i < def.choices.length && !done; i++) {
      const ch = def.choices[i];
      if (!choiceShown(ch, state, p.data) || !choiceOk(ch, state, p.data)) continue;
      if (!hungerSteps(state) && /Taint|Devour|Strip/.test(ch.label + choiceHint(ch, state, p.data))) continue;
      if (clockTooDear(state, p.defId, i, String(p.data.systemId))) continue;
      done = answerEvent(state, p.uid, i).ok;
    }
    // (else the last choice it is offered)
    if (!done) {
      let last = def.choices.length - 1;
      while (last > 0 && !choiceShown(def.choices[last], state, p.data)) last--;
      answerEvent(state, p.uid, last);
    }
  }
}

/** How far a turn at this pace takes us: decades of η, or in the Dark Era decades of log η, its ruler. */
function turnReach(state: GameState, pace: number): number {
  const step = turnStep(state, pace);
  if (!isFinite(step.eta)) return Infinity;
  if (calendarEra(state) === 'dark') return Math.log10(Math.max(step.eta, 1)) - Math.log10(Math.max(state.eta, 1));
  return step.eta - state.eta;
}

/** Turns left in the Dark Era at our pace, to its ruler's end (log η 122), as far as 300. */
function darkTurnsLeft(state: GameState, pace = clockCiv(state).pace): number {
  let years = state.years;
  let e = state.eta;
  for (let n = 0; n < 300; n++) {
    if (Math.log10(Math.max(e, 1)) >= ERA_BY_ID.dark.endEta || !isFinite(e)) return n;
    const step = stepTime('dark', years, e, pace, state.settings.length);
    years = step.years;
    e = step.eta;
  }
  return 300;
}

function planPace(state: GameState) {
  const civ = state.civ;
  // (time is the player's: another civilization lives at our pace)
  if (civ.id !== state.player) return;
  const mods = computeMods(state);
  const cap = reserveCapacity(state, mods);
  const netAt = (p: number) => {
    const pr = project(state, p);
    return pr.energyIn - pr.energyOut;
  };
  // the pace the coming turn is lived at (ours, unless it is greyed now), and the paces open now
  const cur = effectivePace(state);
  const open = (p: number) => p >= mods.paceMin && p <= mods.paceMax && paceMatters(state, p);
  const here = netAt(cur);
  // what a turn at a pace nets for each turn of the Tide's time it covers: since 20 Oct a turn pays
  // and costs by the time it covers, so a slower turn's larger net is only its longer time (until
  // then a slower turn paid more than its time, and this took the slowest that paid)
  const perTide = (p: number, n: number) => n / Math.max(1e-12, livedShare(state, p));
  // until the Dark Era turns are worth having (what they make grows), and a slower one now buys
  // nothing for its time but the upkeep of minds that slow their clocks, for ten times fewer turns:
  // no slower than the Tide in trouble, unless nothing pays at all once matter is gone (below)
  const dark = calendarEra(state) === 'dark';
  if (here < 0 || civ.energy < cap * 0.2) {
    // in trouble: take whichever neighbouring pace pays best for the time it covers
    let best = cur;
    let bestNet = perTide(cur, here);
    const nets = new Map<number, number>([[cur, here]]);
    for (const p of [cur - 1, cur + 1]) {
      if (!open(p)) continue;
      const n = netAt(p);
      nets.set(p, n);
      if (p < 0 && p < cur && !dark) continue;
      if (perTide(p, n) > bestNet + 0.5) {
        best = p;
        bestNet = perTide(p, n);
      }
    }
    // and if none pays after matter, or in the Dark Era, when all that is left is to last,
    // whichever drains the reserve least for the ground it covers: a quicker turn costs about as
    // much once nothing comes in, and there are that many more of them, each starving as surely
    // (until then turns are worth having: what they make grows)
    if (bestNet < 0 && (matterGone(state) || dark)) {
      const drain = (p: number) => -nets.get(p)! / Math.max(1e-12, turnReach(state, p));
      best = cur;
      for (const p of nets.keys()) if (drain(p) < drain(best) * 0.9) best = p;
    }
    if (best !== cur) setPace(state, best);
    return;
  }
  // comfortable and full: quicken for more turns out of the age, if it still pays
  if (civ.energy >= cap * 0.9 && open(cur + 1) && netAt(cur + 1) > 0) setPace(state, cur + 1);
  else if (cur < 0 && civ.energy > cap * 0.5 && open(cur + 1) && netAt(cur + 1) > 0) setPace(state, cur + 1);
}

/** The Long Sleep in the dark, as long as it can be taken at once (actions.ts). */
const DARK_SLEEP_FOR = 20;

/**
 * In the Dark Era little comes in: Halo Siphons, the positronium's nets, and with matter stable,
 * until everything is iron, what it still gives (deeptime.ts; until then this waits). Where the
 * reserve would not last to the end of the age at the rate it is going, and no Great Work would
 * be done while Continuity holds, the Long Sleep, Dyson's hibernation: a tenth of the upkeep (three
 * tenths while matter flows) and about a third of what a turn takes from Continuity. Awake again,
 * it looks again. (Our own play: another civilization keeps to its way.) Since 20 Oct under every
 * fate: until then a slow turn in the dark paid a hundred Tide turns' trickle, and slowing down
 * was enough to last.
 */
function planDarkSleep(state: GameState) {
  const civ = state.civ;
  if (civ.id !== state.player || civ.dormant || state.era !== 'dark') return;
  if (plannedFate(state) === 'stable' && !ironAge(state)) return;
  if (!hasTech(state, 'hibernation_protocols')) return;
  const pr = project(state);
  const drain = pr.energyOut - pr.energyIn;
  if (!(drain > 0)) return;
  const lasts = civ.energy / drain;
  if (lasts >= darkTurnsLeft(state)) return;
  // (a Great Work done while Continuity holds is worth staying awake for, even with the reserve
  // run dry for its last turns: then each turn costs it DARK_STARVE more; a turn's margin)
  if (civ.work) {
    const need = workCost(state, civ.work) - (civ.works[civ.work] ?? 0);
    const per = (civ.flags.last_insight ?? 0) * (civ.researching ? 0.5 : 1);
    const loss = continuityLoss(state, false);
    const after = civ.continuity - lasts * loss;
    const holds = after > 0 ? lasts + after / (loss + DARK_STARVE) : civ.continuity / Math.max(0.01, loss);
    if (per > 0 && need / per <= holds - 1) return;
  }
  longSleep(state, DARK_SLEEP_FOR);
}

function planWorks(state: GameState) {
  const civ = state.civ;
  if (civ.work) return;
  const way = wayOf(state);
  const own = way ? WAY_WORK[way] : null;
  const order = way ? (own ? [own] : []) : ['aeon_seed', 'hibernal_cascade', 'archive_of_everything', 'confluence', 'garden_of_embers'];
  for (const id of order) {
    const w = WORK_BY_ID[id];
    if (!hasTech(state, w.tech) || !inAge(state, w.eras)) continue;
    if (!workRequirementMet(state, id)) continue;
    if (!startWork(state, id)) return;
  }
}

export function autoPlay(state: GameState, strategy: Strategy) {
  ourWay = strategy === 'lattice' && state.civ.id === state.player ? 'lattice' : null;
  if (strategy === 'passive') {
    if (!state.civ.researching) {
      const t = availableTechs(state).sort((a, b) => techCost(state, a.id) - techCost(state, b.id))[0];
      if (t) setResearch(state, t.id);
    }
    for (const p of [...state.civ.pending]) answerEvent(state, p.uid, 0);
    for (const s of state.civ.signals) if (!s.resolved && s.arrivedTurn !== null && s.choices.length) answerSignal(state, s.uid, s.choices[s.choices.length - 1].id);
    return;
  }
  planEvents(state);
  pickResearch(state);
  planCharters(state);
  planPacts(state);
  planAccord(state);
  planThreads(state);
  planSleep(state);
  planFlow(state);
  planDismantle(state);
  planDrift(state);
  planHorizon(state);
  planWeave(state);
  planBuilds(state);
  planFleets(state);
  planWarAI(state);
  planStandDown(state);
  planSignals(state);
  planPace(state);
  planWorks(state);
  planDarkSleep(state);
  planDefence(state, strategy === 'warlike');
  if (strategy === 'warlike') planWar(state);
}

export const _techCount = TECHS.length;
