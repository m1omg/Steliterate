import { EVENT_BY_ID, choiceHint } from './data/events';
import { STRUCTURE_BY_ID, type EnergyMode } from './data/structures';
import { TECHS } from './data/techs';
import { WORK_BY_ID } from './data/works';
import { logTurnLength } from './eras';
import { clockCiv, livedShare, starClockTerms, turnStep } from './sim/flare';
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
import { workRequirementMet } from './sim/endings';
import { computeMods, strainFor } from './sim/mods';
import { patternAnswer } from './sim/minds';
import { project } from './sim/projection';
import { availableTechs, techCost } from './sim/research';
import { FORTIFY_BONUS, canSettle, fleetUpkeep, launchCost, travelEstimate } from './sim/fleets';
import { allColonies, allFleets, capital, colonies, distLy, eraIndex, fleets, hasTech, leftBehind, popsOf, swarmSeenAt, temperament, threadTotals } from './sim/util';
import type { Body, Colony, Fate, Fleet, GameState, StarSystem, SurvivorWay, ThreadId, War } from './types';
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
 * front: the enemy's settlement nearest its capital. Attacked, it gathers its warships there, dug
 * in. It makes peace once a war it began has lasted WAR_TIRES turns, or its warships are gone. An
 * enemy that could strike with a Kinetic Lance makes it keep a Picket at its capital; far down the
 * Hunger's path, it strikes with one itself. (A fleet of Pickets keeps its watch where it is.)
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
  for (const foe of foes) {
    const w = warOf(state, me, foe)!;
    if (w.by !== me) {
      // attacked: to the front, dug in (a war we began on them is fought at their first star)
      const front = w.at ?? (foe === state.player ? state.survivors[me]?.homeSystemId : undefined);
      for (const f of line) {
        if (f.to) continue;
        if (front && f.at !== front && colonies(state).some((c) => c.systemId === front)) orderFleet(state, f.id, front, 'move');
        else if (f.at === front) f.order = 'fortify';
      }
      continue;
    }
    const done = w.motive === 'desperate' && ((w.took ?? 0) > 0 || plight(state, me) < EASED);
    if (state.turn - w.since > WAR_TIRES || !line.length || done) {
      peaceBetween(state, me, foe);
      continue;
    }
    for (const f of line) if (w.at && f.at && f.at !== w.at && !f.to) orderFleet(state, f.id, w.at, 'move');
    // behind a Defence Grid or a Bastion Shell: only a Breacher breaks in
    if (needsBreacher(state, foe, w.at, line)) arm(state, 'breacher', true);
    if (civ.taint >= CORRUPT_AT) lanceAt(state, foe);
  }
  if (foes.length) return;
  const target = warTarget(state, line);
  if (!target) return;
  const front = frontOf(state, target.id, me);
  if (!front) return;
  const force = line.reduce((a, f) => a + fleetFire(f), 0);
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
  const pace = clockCiv(state).pace;
  const up = fleetUpkeep(state, livedShare(state, pace, turnStep(state, pace)));
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
  'bastion_architecture', 'horizon_cognition', 'error_correction', 'hawking_patience', 'last_horizon_protocols',
  'conformal_mathematics', 'archive_theory', 'total_confluence', 'ultimate_slowness',
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
  // a pick that stored insight already covers is done at once: pick again, as a player would
  for (let i = 0; i < 6 && !civ.researching; i++) {
    const avail = new Set(availableTechs(state).map((t) => t.id));
    // (another civilization never falls back on a deliberate choice, noAuto: Halo Siphons, say;
    // with a swarm near, it learns to defend itself first)
    const mine = civ.id === state.player;
    const guard = !mine && avail.has('orbital_defense') && colonies(state).some((c) => swarmThreat(state, c.systemId)) ? 'orbital_defense' : undefined;
    const way = wayOf(state);
    const dark = hungerSteps(state);
    const order = [...(dark ? HUNGER_FIRST : []), ...(way ? WAY_RESEARCH[way] : []), ...TECH_PRIORITY];
    const next = guard ?? order.find((id) => avail.has(id)) ?? [...avail].filter((id) => (dark || !TECHS.find((t) => t.id === id)?.taint) && (mine || !TECHS.find((t) => t.id === id)?.noAuto)).sort((a, b) => techCost(state, a) - techCost(state, b))[0];
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

function planBuilds(state: GameState) {
  const civ = state.civ;
  const mods = computeMods(state);
  const cap = reserveCapacity(state, mods);
  const net = civ.flags.last_energy_net ?? 0;
  const lateDusk = calendarEra(state) === 'dusk' && state.eta > 13.99;
  // before matter ends (the Great Decay, or the Great Evaporation), re-encode onto leptonic substrate
  const fate = plannedFate(state);
  // about as many turns ahead for either: the Black Hole Age's Tide covers a decade a turn, the Degenerate Age's under half
  const preEnd = fate === 'decay' ? calendarEra(state) === 'degenerate' && state.eta > 27 : fate === 'curvature' ? state.eta > 62 && !matterGone(state) : false;
  const t = threadTotals(state);
  const way = wayOf(state);
  for (const c of colonies(state)) {
    // before the protons go, re-encoding goes to the front of the queue
    if (preEnd && hasTech(state, 'leptonic_computation') && (c.structures.lepton_substrate ?? 0) < 2) {
      if (!c.queue.some((q) => q.key === 'lepton_substrate')) {
        if (c.queue.length >= 6) removeQueued(state, c.id, c.queue[c.queue.length - 1].uid);
        if (tryBuild(state, c, ['lepton_substrate'])) {
          const q = c.queue.pop()!;
          c.queue.unshift(q);
        }
      }
      if (c.queue[0]?.key === 'lepton_substrate') rushBuild(state, c.id);
    }
    if (c.queue[0] && civ.matter > 600) rushBuild(state, c.id);
    if (c.queue.length >= 2) continue;
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

function planThreads(state: GameState) {
  const mods = computeMods(state);
  const step = turnStep(state);
  const logL = logTurnLength(step);
  const kinStrain = strainFor('kin', logL, mods).m;
  const echoStrain = strainFor('echoes', logL, mods).m;
  const way = wayOf(state);
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
 * War, for the 'warlike' strategy only: against our own people who left us, or a neighbour who
 * keeps raiding us, with warships enough to outmatch them. Build Wardens, declare, bring them to
 * the siege, take the star when the siege allows; make peace if it drags on.
 */
/**
 * A war another civilization began on us (part 2c-2), whatever our strategy: our warships to the
 * front, dug in, and more built while theirs outweigh what stands there.
 */
function planDefence(state: GameState) {
  const civ = state.civ;
  if (civ.id !== state.player) return;
  const cap = civ.capitalId ? state.colonies[civ.capitalId] : colonies(state)[0];
  const warships = lineOfBattle(state);
  // an enemy that could strike with a Kinetic Lance: a Picket kept at the capital (as the others do)
  if (Object.values(state.survivors).some((sv) => sv.alive && sv.war && state.civs[sv.id]?.techs.includes('relativistic_arks'))) keepWatch(state);
  for (const sv of Object.values(state.survivors)) {
    if (!sv.alive || !sv.war?.by || sv.war.by === civ.id || !sv.war.at) continue;
    const front = sv.war.at;
    for (const f of warships) {
      if (f.to) continue;
      if (f.at !== front) orderFleet(state, f.id, front, 'move');
      else f.order = 'fortify';
    }
    const theirs = allFleets(state).filter((f) => f.owner === sv.id).reduce((a, f) => a + fleetFire(f), 0);
    if (cap && guardAt(state, front, civ.id) < theirs && (cap.structures.shipyard ?? 0) > 0 && cap.queue.length < 3 && civ.energy > 80) queueBuild(state, cap.id, 'ship', 'warden');
  }
}

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
      if (seizeBlocked(state, sv) === null) seizeSurvivor(state, sv.id);
      else if (state.turn - sv.war.since > 30) makePeace(state, sv.id);
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
      if (ch.ok && !ch.ok(state, p.data)) continue;
      if (!hungerSteps(state) && /Taint|Devour|Strip/.test(ch.label + choiceHint(ch, state, p.data))) continue;
      if (clockTooDear(state, p.defId, i, String(p.data.systemId))) continue;
      done = answerEvent(state, p.uid, i).ok;
    }
    if (!done) answerEvent(state, p.uid, def.choices.length - 1);
  }
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
  const here = netAt(civ.pace);
  if (here < 0 || civ.energy < cap * 0.2) {
    // in trouble: take whichever neighbouring pace pays best right now
    let best = civ.pace;
    let bestNet = here;
    for (const p of [civ.pace - 1, civ.pace + 1]) {
      if (p < mods.paceMin || p > mods.paceMax) continue;
      const n = netAt(p);
      if (n > bestNet + 0.5) {
        best = p;
        bestNet = n;
      }
    }
    if (best !== civ.pace) setPace(state, best);
    return;
  }
  // comfortable and full: quicken for more turns out of the age, if it still pays
  if (civ.energy >= cap * 0.9 && civ.pace < mods.paceMax && netAt(civ.pace + 1) > 0) setPace(state, civ.pace + 1);
  else if (civ.pace < 0 && civ.energy > cap * 0.5 && netAt(civ.pace + 1) > 0) setPace(state, civ.pace + 1);
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
  planBuilds(state);
  planFleets(state);
  planWarAI(state);
  planStandDown(state);
  planSignals(state);
  planPace(state);
  planWorks(state);
  planDefence(state);
  if (strategy === 'warlike') planWar(state);
}

export const _techCount = TECHS.length;
