import { autoPlay } from '../auto';
import { asCiv, flushOutbox } from '../civs';
import { tiesTurn } from './ties';
import { SHIP_BY_ID } from '../data/ships';
import { STRUCTURE_BY_ID, dismantledKey, structureLabel } from '../data/structures';
import { ERA_BY_ID, POSITRONIUM_ETA, formatYears, logTurnLength, tideLength } from '../eras';
import { ICE_MELTS_K, LIFE_LIMIT_K, SURFACE_LIFE, bodyClimate, drainHalo, evolveUniverse, flashSheltered, giantWorld, lampsOver, seededLifeUnkept, siphonsRunning, steamWorld, sunGone, turnsToFreeze, vitalityLoss, type EvolutionNote } from '../physics';
import type { Body, Colony, CrossingReport, GameState, Outcome, Signal, StarSystem } from '../types';
import { THREADS } from '../types';
import { NEAR_BURST_LY, burstShare, decayProof, finalBurstCatch, flashReach, goLeptonic, goOnAlone, greatEvaporation, moveToHole, protocolsMult, runCrossing } from './crossing';
import { completePassage } from './passage';
import { flowComes, theLongFlow } from './flow';
import { theThinning } from './thinning';
import { completeHorizon, horizonGone } from './horizon';
import { POSITRONIUM_DECAY, completeWeave, positroniumComes, positroniumHere, theWeaveEnds, turnsToDecay } from './positronium';
import { continuityLoss } from './continuity';
import { deepTime } from './deeptime';
import { answerArrived, pactsTurn } from './pacts';
import { warTurn } from './war';
import { battlesTurn } from './conflict';
import { feedBeacons } from './beacons';
import { spareYield, type SpareYield } from './spare';
import { coolAccord } from './accord';
import { MATTER_AS_ENERGY, capacity, colonyTurn, latticeAlienation, reserveCapacity, type TurnContext } from './economy';
import { checkEndings, workCost } from './endings';
import { pruneFinds, queueEvent, rollRandomEvent } from './events';
import { advanceFleets, autoExplore, createColony, deepFor, destroyColony, fleetUpkeep, newFleet, repairFleets, surveyWhereStationed, updateDetection } from './fleets';
import { updateForecasts } from './forecast';
import { wakeArchivedEchoes } from './archive';
import { clearStarClock, flareData, livedShare, scorched, turnStep } from './flare';
import { firstSwarm, swarmsHunt, updateHunger } from './hunger';
import { gatherTheLastStar, updateMinds } from './minds';
import { computeMods, type Mods } from './mods';
import { completeTech, discoverFromSurplus, IDLE_STUDY, researchDraw, techCost } from './research';
import { deliverSignals } from './signals';
import { updateSociety } from './society';
import { jointIncome, updateSurvivors } from './survivors';
import { allColonies, clamp, colonies, distLy, fleets, formOf, hasCharter, inItsSystem, leftBehind, log, logTo, popsOf, totalPops, withRng } from './util';
import { becomeHunger } from './judge';
import { WORKS_WATER, seededVitality } from './terraform';
import { FATE_SHOWN_AT, MATTER_END, ageOver, calendarEra, calendarTurnDue, fateKnown, fateOf, matterGone } from '../fate';

export interface TurnResult {
  crossing: CrossingReport | null;
  outcome: Outcome | null;
  arrived: Signal[];
  notes: EvolutionNote[];
  wasted: number;
}

/** Industry drives the build queue; leftover goes to the settlement's spare work. Returns what that made (its resolve already given). */
function applyIndustry(state: GameState, c: Colony, industry: number, energyMade: number, mods: Mods): SpareYield {
  let left = Math.max(industry, c.queue[0] && c.queue[0].progress >= c.queue[0].cost - 0.01 ? 0.01 : 0);
  let guard = 0;
  while (left > 0 && c.queue.length && guard++ < 8) {
    const item = c.queue[0];
    const need = item.cost - item.progress;
    const use = Math.min(need, left);
    item.progress += use;
    left -= use;
    if (item.progress >= item.cost - 1e-6) {
      c.queue.shift();
      if (item.kind === 'structure') {
        const d = STRUCTURE_BY_ID[item.key];
        c.structures[item.key] = (c.structures[item.key] ?? 0) + 1;
        // what a building does once, it does the first time: one taken apart here and built again does not repeat it
        const again = dismantledKey(c.id, item.key);
        if ((state.civ.flags[again] ?? 0) > 0) {
          state.civ.flags[again]--;
          if (state.civ.flags[again] <= 0) delete state.civ.flags[again];
        } else {
          if (d?.vitalityOnce) {
            const b = state.bodies[c.bodyId];
            b.vitality = Math.min(1, b.vitality + d.vitalityOnce);
          }
          if (d?.coreHeatBonus) {
            const b = state.bodies[c.bodyId];
            b.coreHeat = Math.min(1, b.coreHeat + d.coreHeatBonus);
          }
          // the volatiles steered in to build the air bring water with them
          if (d?.terraform === 'works') {
            const b = state.bodies[c.bodyId];
            b.water = Math.max(b.water ?? 0, WORKS_WATER);
          }
          if (d?.enables === 'merge') state.civ.flags.chorus_nodes_built = (state.civ.flags.chorus_nodes_built ?? 0) + 1;
        }
        log(state, `${c.name}: ${structureLabel(item.key, state.systems[c.systemId], formOf(c)).name} complete.`, 'good', c.systemId);
      } else if (item.kind === 'passage') completePassage(state, c);
      else if (item.kind === 'horizon') completeHorizon(state, c);
      else if (item.kind === 'weave') completeWeave(state, c);
      else {
        const def = SHIP_BY_ID[item.key];
        if (def?.crew) c.pops.kin = Math.max(0, c.pops.kin - def.crew);
        const existing = fleets(state).find((f) => f.at === c.systemId && f.order === 'idle' && !f.auto && f.ships.every((s) => s.cls === item.key) && !def?.settles && !def?.survey);
        if (existing) existing.ships.push({ cls: item.key, hp: def?.hp ?? 5 });
        else newFleet(state, c.systemId, [item.key]);
        log(state, `${c.name}: ${def?.name ?? item.key} launched from the slips.`, 'good', c.systemId);
      }
    }
  }
  void mods;
  if (!(left > 0) || c.queue.length || state.civ.dormant) return { matter: 0, energy: 0, insight: 0, resolve: 0 };
  const y = spareYield(state, c, left, energyMade);
  if (y.resolve) state.civ.resolve = clamp(state.civ.resolve + y.resolve, 0, 100);
  return y;
}

/** After the Last Light a world's core heat keeps this share of itself each turn: half is gone in three turns, nearly all of it in eighteen. */
export const CORE_FADE = 0.8;

function declineWorlds(state: GameState) {
  // after the Last Light the deep warmth of every world runs out too (really it went long before;
  // the game keeps it through the Dusk), and Geothermal Taps wind down with it
  if (calendarEra(state) !== 'dusk') for (const b of Object.values(state.bodies)) if (b.coreHeat > 0) b.coreHeat = b.coreHeat < 0.02 ? 0 : b.coreHeat * CORE_FADE;
  // seeded life spreads over a terraformed world while its star burns (terraform.ts)
  for (const c of allColonies(state)) {
    const b = state.bodies[c.bodyId];
    if (b) b.vitality = seededVitality(state, b, c);
  }
  const byBody = new Map(allColonies(state).map((c) => [c.bodyId, c]));
  for (const b of Object.values(state.bodies)) {
    if (b.dissolved || b.vitality <= 0) continue;
    const c = byBody.get(b.id);
    // a steam world's seas are its sky, the ground past 1,500 K by night as by day: no ice left to
    // live under, no sea, and a turn is longer than an ocean takes to boil
    if (steamWorld(state, b)) {
      b.vitality = 0;
      tellOfWorld(state, b, c?.owner, `Nothing lives on ${b.name} now: its seas have boiled into a sky of steam.`);
      continue;
    }
    const loss = vitalityLoss(state, b, c);
    b.vitality = Math.max(0, b.vitality - loss.decline);
    if (c && b.traits.includes('homeworld') && calendarEra(state) === 'dusk') b.coreHeat = Math.max(0, b.coreHeat - 0.007 * ((c.structures.core_stimulator ?? 0) > 0 ? 0.4 : 1));
    if (b.vitality > 0) b.vitality = Math.max(0, b.vitality - loss.freeze);
    // one of its settlers' worlds begins to freeze, its dead star cooled at last: they hear it
    // once (the Last Light says it for every world)
    const owner = c ? state.civs[c.owner] : undefined;
    if (c && owner && loss.freeze > 0 && b.vitality > 0 && calendarEra(state) === 'dusk' && !b.rogue && !owner.flags[`frz_${b.id}`]) {
      owner.flags[`frz_${b.id}`] = state.turn;
      const n = turnsToFreeze(state, b, c);
      if (seededLifeUnkept(state, b, c)) logTo(state, owner, `The life seeded on ${b.name} has begun to freeze: nothing keeps the world warm now. It dies in about ${n} turn${n === 1 ? '' : 's'}.`, 'bad', b.systemId);
      else logTo(state, owner, `${b.name} has begun to freeze: its dead star no longer warms it. It dies in about ${n} turn${n === 1 ? '' : 's'} unless Orbital Lamps keep it warm.`, 'bad', b.systemId);
    }
    if (b.vitality <= 0) worldDies(state, b);
  }
}

/**
 * Tell of what befell a world: the civilization settled there (`owner`) hears it as its own loss,
 * and every other that has surveyed its system hears of it.
 */
function tellOfWorld(state: GameState, b: Body, owner: string | undefined, text: string) {
  for (const v of Object.values(state.civs)) {
    if (v.id === owner) logTo(state, v, text, 'bad', b.systemId);
    else if ((v.known[b.systemId] ?? 0) === 2) logTo(state, v, text, 'info', b.systemId);
  }
}

/**
 * What `share` of a flare does to a scorched world, living or dead: true if it had life and the
 * life is gone. Life dies over the flare, at once where even the night side is past the limit
 * of life. The seas boil into steam, and the steam is broken up and lost to space (a water-rich
 * world has far too much to lose in one flare).
 */
function scorch(state: GameState, b: Body, share: number): boolean {
  const alive = b.vitality > 0;
  if (alive) {
    const c = bodyClimate(state, b);
    b.vitality = (c.night ?? c.mean) >= LIFE_LIMIT_K ? 0 : Math.max(0, b.vitality - 0.6 * share);
  }
  if (b.water && !b.traits.includes('water_rich')) b.water *= 1 - 0.9 * share;
  return alive && b.vitality <= 0;
}

/**
 * A flaring star boils the seas of its worlds and strips their air. The damage follows the share
 * of the flare this turn lives through, so it comes to the same whether it passes in one turn or six.
 */
function scorchWorlds(state: GameState, from: number, to: number) {
  for (const b of Object.values(state.bodies)) {
    if (b.dissolved || !scorched(state, b)) continue;
    const p = state.systems[b.systemId].primary;
    const start = p.blueAt ?? from;
    const end = p.whiteAt ?? to;
    const share = end > start ? Math.max(0, Math.min(end, to) - Math.max(start, from)) / (end - start) : 1;
    if (share <= 0) continue;
    if (scorch(state, b, share)) worldDies(state, b, true);
  }
}

/**
 * A new galaxy whose stars are already flaring: their worlds have lived through the flare so far,
 * scorched as scorchWorlds scorches them, in one share (it comes to the same). Most such flares
 * are well on, so most of their living worlds start dead. Deterministic and after generation: no
 * random draw, so the galaxy's stars and orbits stay as they were.
 */
export function scorchedFromTheStart(state: GameState): number {
  let n = 0;
  for (const b of Object.values(state.bodies)) {
    if (b.dissolved || !scorched(state, b)) continue;
    const p = state.systems[b.systemId].primary;
    if (p.blueAt === undefined || p.whiteAt === undefined || p.whiteAt <= p.blueAt) continue;
    const share = Math.max(0, Math.min(1, (state.years - p.blueAt) / (p.whiteAt - p.blueAt)));
    if (share <= 0) continue;
    const alive = b.vitality > 0;
    if (scorch(state, b, share)) worldDies(state, b, true);
    if (alive) n++;
  }
  return n;
}

/**
 * A living world whose life is gone: it freezes, or dries to bare rock. What we hear says how it
 * died: boiled by a flare, frozen with its warmth gone, or (its slow decline, its star still
 * burning) dead with its sea still open under its star.
 */
function worldDies(state: GameState, b: Body, scorched = false) {
  if (!SURFACE_LIFE.includes(b.kind)) return;
  const was = b.kind;
  b.kind = !scorched && (b.water ?? 0) >= 0.1 ? 'ice' : 'barren';
  b.habitability = b.kind === 'ice' ? 0.05 : 0;
  b.vitality = 0;
  if (!b.traits.includes('once_alive')) b.traits.push('once_alive');
  // who hears of it: whoever lives there, and whoever has surveyed it
  const owner = b.colonyId ? (state.colonies[b.colonyId]?.owner ?? state.player) : undefined;
  if (owner || Object.values(state.civs).some((v) => (v.known[b.systemId] ?? 0) === 2)) {
    const c = bodyClimate(state, b);
    const open = !scorched && b.kind === 'ice' && (c.day ?? c.mean) >= ICE_MELTS_K;
    const what = scorched
      ? 'Its seas boiled away under the flare and its air went with them; it is bare rock now'
      : open
        ? `Nothing lives there now, though its star still keeps ${c.night !== undefined && c.night < ICE_MELTS_K ? 'a sea open on its day side, ice beyond it' : 'its seas open'}`
        : `${was === 'eyeball' ? 'Its sea has frozen from the terminator to the substellar point' : 'Its seas have frozen and its air has settled out as frost'}; it is ${b.kind === 'ice' ? 'an ice world' : 'bare rock'} now`;
    tellOfWorld(state, b, owner, `${b.name} has died. ${what}.`);
  }
}

/** What one civilization carries from one part of its turn to the next. */
export interface CivTurn {
  mods: Mods;
  /** Its Halo Siphons as the turn began (its economy reads them so): research or a shut-down counts from the next. */
  siphoning: boolean;
  ctx: TurnContext;
  /** Each settlement's energy net: the hungriest go cold first. */
  net: Record<string, number>;
  insight: number;
  starving: boolean;
  popsLost: number;
  /** Energy over the reserve's cap, thrown away. */
  wasted: number;
}

/**
 * The civilizations that play this turn: the player first, then the others still playing. Every
 * civilization plays the same game, each its part of each step under its own perspective (asCiv),
 * and the universe moves once between the steps (docs/plans/new-version.md, part 2a-0).
 */
export function turnOrder(state: GameState): string[] {
  return [state.player, ...Object.keys(state.civs).filter((id) => id !== state.player && !state.civs[id].outcome).sort()];
}

/**
 * The turn in slices (the new version, part 2a-6): it yields after each civilization's part of a
 * step, never inside one, so that the interface can let the browser breathe between them
 * (turnflow.ts, playTurn); endTurn plays it at once. The state between two slices is a turn half
 * done: nothing may act on it then.
 */
export function* turnSlices(state: GameState): Generator<void, TurnResult, void> {
  const result: TurnResult = { crossing: null, outcome: state.civ.outcome, arrived: [], notes: [], wasted: 0 };
  if (state.civ.outcome) return result;
  const me = state.player;
  const ids = turnOrder(state);
  const t: Record<string, CivTurn> = {};
  // each civilization plays its part of a step, the player first; then what they sent each other is delivered
  function* each(part: (c: CivTurn, id: string) => void): Generator<void, void, void> {
    for (const id of ids) {
      asCiv(state, id, () => part(t[id], id));
      yield;
    }
    flushOutbox(state);
  }
  // (the same at once, inside a step that must not be cut)
  const eachNow = (part: (c: CivTurn, id: string) => void) => {
    for (const id of ids) asCiv(state, id, () => part(t[id], id));
    flushOutbox(state);
  };

  // ------------------------------------------------ 0. each one's start: its mods, pace, siphons, sleep
  // (another civilization decides first, as the autoplayer decides for us; part 2a-5 of the new
  // version gives each a mind of its own)
  yield* each((_c, id) => {
    if (id !== me) autoPlay(state, 'competent');
    t[id] = beginTurn(state);
  });
  // the turn's time is the player's, its pace and clocks: everyone lives the same turn
  // (a turn stops when one of our stars begins its last flare; see flare.ts)
  const step = turnStep(state);
  const logL = logTurnLength(step);
  const paceFactor = livedShare(state, state.civ.pace, step);

  // ------------------------------------------------ 1-3. economy, starvation, research and works
  yield* each((c) => {
    c.ctx = { years: state.years, L: step.turnLength, logL, paceFactor, mods: c.mods };
    economy(state, c);
    overdriveAccidents(state);
    starvation(state, c);
    researchAndWorks(state, c);
  });
  result.wasted = t[me].wasted;

  // ------------------------------------------------ 4. growth, capacity, worlds
  // what the stars do to the worlds, once for everyone
  scorchWorlds(state, state.years, step.years);
  declineWorlds(state);
  yield* each((c) => {
    growth(state, c);
    // ---------------------------------------------- 5. society
    // Consume the Dead: nothing is buried any more
    if (c.popsLost > 0 && hasCharter(state, 'consume_the_dead')) state.civ.matter += c.popsLost * 4;
    updateSociety(state, logL, c.popsLost, c.starving);
    coolAccord(state);
    if (state.civ.wakeBonus > 0 && !state.civ.dormant) state.civ.wakeBonus--;
    // ---------------------------------------------- 6. fleets, hazards, other minds
    const flown = advanceFleets(state, step.turnLength, c.mods);
    surveyWhereStationed(state);
    repairFleets(state);
    // look around before exploring ships set off again, so they scan every star they reach
    updateDetection(state, c.mods, flown);
    firstSwarm(state);
  });
  // swarms go for ships that have just stopped at their star, before exploring probes move on
  // (each civilization's ships and settlements by its own mods; one no longer playing, by its own now)
  const modsOf = (id: string) => t[id]?.mods ?? asCiv(state, id, () => computeMods(state));
  swarmsHunt(state, modsOf);
  yield* each((c) => autoExplore(state, c.mods));
  updateHunger(state, step.turnLength, modsOf);
  // wherever civilizations at war meet, they fight, all at once; the sieges of wars the others began
  battlesTurn(state);
  // (the neighbours we know, our pacts and wars with them, and the other minds are the player's)
  yield* each((c, id) => {
    if (id !== me) return;
    updateSurvivors(state, logL, c.mods, step.turnLength, c.ctx.paceFactor);
    pactsTurn(state);
    withRng(state, (rng) => warTurn(state, () => rng.next()));
    updateMinds(state, logL, c.mods);
  });
  // the others among themselves: their pacts sealed and at work (and what we hear of it)
  tiesTurn(state);
  flushOutbox(state);

  // ------------------------------------------------ 7. the universe moves on
  const from = state.years;
  // while Halo Siphons run, the halo falls twice as fast: its clock gains this turn's years again
  if (ids.some((id) => t[id].siphoning)) drainHalo(state, from, step.years);
  const notes = withRng(state, (rng) => evolveUniverse(state, from, step.years, () => rng.next()));
  // matter stable: the heaviest dead stars explode, everything turns to iron, then tunnels into black holes (no draw)
  notes.push(...deepTime(state, state.eta, step.eta));
  result.notes = notes;
  // from 10^65 years solid matter flows: once, the ruins no one awake is digging run into smooth lumps
  flowComes(state, step.eta, logL, modsOf, Math.log10(paceFactor));
  // the widest atoms decay as this turn passes η 141: the never-ending annihilation counts its turns from here (positronium.ts)
  if (positroniumComes(state) && state.eta < POSITRONIUM_DECAY && step.eta >= POSITRONIUM_DECAY) state.flags.positronium_end = state.turn;
  yield* each((c, id) => {
    handleNotes(state, notes);
    // the Unlit's gathering is done: the Last Star lights as the turn ends, as every new star does
    if (id === me) {
      const lastStar = gatherTheLastStar(state, step.years);
      if (lastStar) queueEvent(state, 'last_star', { systemId: lastStar });
    }
    // from 10^65 years solid matter flows: what no one is awake to mend runs into smooth lumps
    theLongFlow(state, step.eta, logL, c.mods, Math.log10(c.ctx.paceFactor));
    // in the last decades of matter, what is still made of it thins with it
    theThinning(state, state.eta, step.eta);
    // and as positronium decays, whatever is still woven through it ends with it
    theWeaveEnds(state, state.eta, step.eta);
    continuity(state, c);
  });
  state.years = step.years;
  state.eta = step.eta;
  state.turnLength = step.turnLength;
  state.turn++;
  state.eraTurn++;
  // the turn's clock is the player's (flare.ts, clockCiv): one of our stars has just begun its
  // last flare (the turn stopped for it); a flare's clock or a new star's has run out
  yield* each((_c, id) => {
    if (id !== me) return;
    const civ = state.civ;
    for (const sys of new Set(colonies(state).map((c) => state.systems[c.systemId]))) {
      if (sys?.primary.kind === 'blue_dwarf' && sys.primary.blueAt === state.years) queueEvent(state, 'last_flare', flareData(state, sys));
    }
    if (civ.flags.flare_until && state.years >= civ.flags.flare_until) {
      delete civ.flags.flare_until;
      delete civ.flags.flare_step;
    }
    // the new star we kept time with has burned out: our own pace again
    clearStarClock(state);
  });
  // ------------------------------------------------ 8. signals, forecasts, events
  yield* each((_c, id) => {
    const arrived = signalsAndEvents(state);
    if (id === me) result.arrived = arrived;
  });

  // ------------------------------------------------ 9. crossings
  // the fate of matter shows itself: near η 30 the neutron stars tell the fates apart
  yield* each((_c, id) => {
    if (!fateKnown(state) && state.eta >= FATE_SHOWN_AT) {
      revealFate(state);
      if (id === me) updateForecasts(state);
    }
  });
  const crossed = (reports: Record<string, CrossingReport>) => {
    for (const id of ids) state.civs[id].crossing = reports[id];
    result.crossing = reports[me];
  };
  if (ageOver(state)) {
    if (state.era === 'dark') {
      // the deep-time ruler has run out: endurance
    } else {
      const atLastHorizon = state.era === 'blackhole';
      if (atLastHorizon) {
        const o = checkEndings(state, true);
        if (o) {
          result.outcome = o;
          return result;
        }
      }
      crossed(runCrossing(state, ids, Object.fromEntries(ids.map((id) => [id, t[id].mods]))));
      yield* each((_c, id) => id === me && updateForecasts(state));
    }
  }
  // the calendar turns without the age (a fate other than decay): the Black Hole Age's Tide
  else if (calendarTurnDue(state)) calendarTurn(state);
  // each one's mods as they are now (for a storm that comes after the turn's changes)
  const modsNow = () => {
    const m: Record<string, Mods> = {};
    eachNow((_c, id) => (m[id] = computeMods(state)));
    return m;
  };
  // curvature radiation unmakes the last ordinary matter: a storm of its own, inside the age
  if (fateOf(state) === 'curvature' && state.eta >= MATTER_END.curvature && state.flags.matter_gone === undefined && state.era !== 'dark') {
    crossed(greatEvaporation(state, ids, modsNow()));
    yield* each((_c, id) => id === me && updateForecasts(state));
  }
  // the last black hole may evaporate before the calendar says so
  if (state.era === 'blackhole' && !Object.values(state.systems).some((s) => (s.primary.kind === 'black_hole' || s.primary.kind === 'smbh') && !s.gone)) {
    const o = checkEndings(state, true);
    if (o) {
      result.outcome = o;
      return result;
    }
    crossed(runCrossing(state, ids, modsNow()));
  }

  // ------------------------------------------------ 10. endings, stats
  yield* each((_c, id) => {
    const had = !!state.civ.outcome;
    const o = checkEndings(state);
    if (id === me) result.outcome = o;
    // another civilization whose Taint has reached 100 becomes the Hunger (judge.ts)
    else if (!had && o?.kind === 'dark') becomeHunger(state, id);
    const civ = state.civ;
    civ.stats.pops.push(totalPops(state));
    civ.stats.energy.push(Math.round(civ.energy));
    civ.stats.resolve.push(Math.round(civ.resolve));
    for (const k of ['pops', 'energy', 'resolve'] as const) if (civ.stats[k].length > 500) civ.stats[k].shift();
    // (a capital lost, or taken by another: the most populous settlement left)
    if (!civ.capitalId || state.colonies[civ.capitalId]?.owner !== civ.id) civ.capitalId = colonies(state).sort((a, b) => popsOf(b) - popsOf(a))[0]?.id ?? null;
  });
  return result;
}

/** The whole turn at once: the harness, the checks, and whatever needs it done before going on. */
export function endTurn(state: GameState): TurnResult {
  const g = turnSlices(state);
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}

/** A civilization's turn begins: its mods, its pace within them, its Halo Siphons, its Long Sleep. */
function beginTurn(state: GameState): CivTurn {
  const civ = state.civ;
  const mods = computeMods(state);
  civ.pace = clamp(civ.pace, mods.paceMin, mods.paceMax);
  // Halo Siphons as the turn begins (its economy reads them so): research finished or siphons shut
  // during it count from the next
  const siphoning = siphonsRunning(state);

  // Long Sleep
  if (civ.sleepTurns > 0) {
    civ.dormant = true;
    civ.sleepTurns--;
    if (civ.sleepTurns === 0) {
      civ.dormant = false;
      civ.wakeBonus = hasCharter(state, 'the_long_watch') ? 2 : 1;
      log(state, 'We wake.', 'info');
    }
  }
  return { mods, siphoning, ctx: null as unknown as TurnContext, net: {}, insight: 0, starving: false, popsLost: 0, wasted: 0 };
}

/** 1. The economy: every settlement's yields and upkeep, and what they come to for the civilization. */
function economy(state: GameState, t: CivTurn) {
  const civ = state.civ;
  const { ctx, mods, net } = t;
  let eIn = 0;
  let eOut = 0;
  let mIn = 0;
  let mOut = 0;
  let insight = 0;
  let accord = 0;
  let matterAvail = civ.matter;
  for (const c of colonies(state)) {
    const y = colonyTurn(state, c, ctx, matterAvail);
    matterAvail -= y.matterBurn;
    c.last = y.y;
    eIn += y.y.energy;
    eOut += y.y.energyUpkeep;
    mIn += y.y.matter;
    mOut += y.y.matterUpkeep;
    insight += y.y.insight;
    accord += y.y.accord;
    net[c.id] = y.y.energy - y.y.energyUpkeep;
    const sys = state.systems[c.systemId];
    sys.primary.spin = Math.max(0, sys.primary.spin - y.spinDraw);
    if (y.depletion > 0) {
      const b = state.bodies[c.bodyId];
      b.richness = Math.max(0.05, b.richness - y.depletion * 0.0006);
      b.hydrogen = Math.max(0, b.hydrogen - y.depletion * 0.0004);
    }
    if (c.overdrive) {
      c.damage = Math.min(1, c.damage + 0.04);
      state.gfe = Math.max(0.05, state.gfe - 0.0002);
    } else c.damage = Math.max(0, c.damage - 0.02);
    for (const [id, n] of Object.entries(c.structures)) {
      const d = STRUCTURE_BY_ID[id];
      // (a lifter left behind by a world flung loose lifts nothing, and drains nothing)
      if (d?.gfeDrain && n && !leftBehind(state, c, d)) state.gfe = Math.max(0.05, state.gfe - d.gfeDrain * n * ctx.paceFactor);
    }
    // spare work's yields count in the turn's own (and so in the energy net it reports: until
    // 19 Oct they went straight into the stores, unreported)
    const spare = applyIndustry(state, c, y.y.industry, y.y.energy, mods);
    insight += spare.insight;
    eIn += spare.energy;
    mIn += spare.matter;
  }
  eIn += jointIncome(state) * ctx.paceFactor;
  eOut += fleetUpkeep(state, ctx.paceFactor);
  eOut += researchDraw(state, insight);
  accord -= latticeAlienation(state, mods);
  civ.energy += eIn - eOut;
  // decoy beacons burn only while we feed them
  const beacons = feedBeacons(state, ctx.paceFactor);
  civ.matter += mIn - mOut;
  civ.accord = clamp(civ.accord + accord, 0, 999);
  const cap = reserveCapacity(state, mods);
  civ.flags.reserve_cap = cap;
  if (civ.energy > cap) {
    t.wasted = civ.energy - cap;
    civ.energy = cap;
  }
  civ.flags.last_energy_net = eIn - eOut - beacons;
  civ.flags.last_matter_net = mIn - mOut;
  civ.flags.last_insight = insight;
  civ.flags.last_accord = accord;
  t.insight = insight;
}

/** An overdriven Hearth may fail and wreck what it powers. */
function overdriveAccidents(state: GameState) {
  withRng(state, (rng) => {
    for (const c of colonies(state)) {
      if (c.overdrive && c.damage > 0.5 && rng.chance(c.damage * 0.25)) {
        const keys = Object.keys(c.structures).filter((k) => STRUCTURE_BY_ID[k]?.energy);
        if (keys.length) {
          const k = rng.pick(keys);
          c.structures[k]--;
          if (c.structures[k] <= 0) delete c.structures[k];
          log(state, `An overdriven Hearth failed at ${c.name}: ${structureLabel(k, state.systems[c.systemId]).name} is wrecked.`, 'bad', c.systemId);
        }
        c.damage *= 0.5;
      }
    }
  });
}

/** 2. Starvation: an empty reserve, and the hungriest settlements go cold; no matter, and a Lattice wears out. */
function starvation(state: GameState, t: CivTurn) {
  const civ = state.civ;
  const { mods, net } = t;
  if (civ.energy < 0) {
    t.starving = true;
    civ.energy = 0;
    const hungry = colonies(state).filter((c) => (net[c.id] ?? 0) < 0).sort((a, b) => (net[a.id] ?? 0) - (net[b.id] ?? 0));
    for (const c of hungry.slice(0, 3)) {
      c.starving++;
      const lottery = hasCharter(state, 'cold_sleep_lottery') && capacity(state, c, mods).cryo > c.cryo;
      if (c.pops.kin > 0) {
        c.pops.kin--;
        if (lottery) c.cryo++;
        else {
          t.popsLost++;
          if (hasCharter(state, 'upload_at_death') && capacity(state, c, mods).echoes > c.pops.echoes && withRng(state, (r) => r.chance(0.5))) c.pops.echoes++;
        }
      } else if (c.pops.chorus + c.pops.echoes + c.pops.coldminds > 0 && c.starving % 2 === 0) {
        const th = c.pops.echoes > 0 ? 'echoes' : c.pops.chorus > 0 ? 'chorus' : 'coldminds';
        c.pops[th]--;
        t.popsLost++;
      }
    }
    log(state, 'The reserve is empty. Settlements are going cold.', 'bad');
    // after matter the Lattice mends itself with energy: with none left, one wears out, as one does without matter
    if (matterGone(state)) {
      const c = colonies(state).find((x) => x.pops.lattice > 0);
      if (c) {
        c.pops.lattice--;
        log(state, `Without energy for repairs, a Lattice at ${c.name} wore out.`, 'bad', c.systemId);
      }
    }
  } else {
    for (const c of colonies(state)) c.starving = 0;
  }
  if (civ.matter < 0) {
    civ.matter = 0;
    const c = colonies(state).find((x) => x.pops.lattice > 0);
    if (c) {
      c.pops.lattice--;
      log(state, `Without matter for repairs, a Lattice at ${c.name} wore out.`, 'bad', c.systemId);
    }
  }
}

/** 3. Research and the Great Work share the insight; a great deal left over fills in cheap projects. */
function researchAndWorks(state: GameState, t: CivTurn) {
  const civ = state.civ;
  const insight = t.insight;
  // (what it learns a turn: Open Archives between others share a part of it, ties.ts)
  if (civ.id !== state.player) civ.flags.last_insight = insight;
  let research = insight;
  if (civ.work) {
    const share = civ.researching ? 0.5 : 1;
    civ.works[civ.work] = (civ.works[civ.work] ?? 0) + insight * share;
    research = insight * (1 - share);
    if ((civ.works[civ.work] ?? 0) >= workCost(state, civ.work)) {
      log(state, `The Great Work is complete.`, 'era');
      civ.work = null;
    }
  }
  if (civ.researching) {
    const bank = civ.flags.insight_bank ?? 0;
    civ.research[civ.researching] = (civ.research[civ.researching] ?? 0) + research + bank;
    civ.flags.insight_bank = 0;
    const cost = techCost(state, civ.researching);
    if (civ.research[civ.researching] >= cost) {
      const id = civ.researching;
      civ.flags.insight_bank = civ.research[id] - cost;
      completeTech(state, id);
    }
  } else civ.flags.insight_bank = Math.min((civ.flags.insight_bank ?? 0) + research * IDLE_STUDY, 2000);
  // a great deal of insight left over: the scholars fill in the cheapest open projects themselves
  discoverFromSurplus(state);
}

/** 4. Growth: Echoes out of the archive first, then every Thread grows toward the room it has, or is crowded out. */
/** People grow where there is room (exported for the checks: unit/unwritten). */
export function growth(state: GameState, t: CivTurn) {
  const civ = state.civ;
  const { mods, starving } = t;
  // Echoes waiting in the archive move into any free substrate before anyone is counted
  wakeArchivedEchoes(state);
  // (after matter a Lattice is built from energy, as everything is)
  const noMatter = matterGone(state);
  for (const c of colonies(state)) {
    const capc = capacity(state, c, mods);
    const b = state.bodies[c.bodyId];
    if (!civ.dormant && !starving) {
      if (c.pops.kin > 0 && c.pops.kin < capc.kin) {
        c.growth.kin += 0.12 * (0.5 + 0.5 * b.vitality) * (hasCharter(state, 'child_quotas') ? 0.4 : 1);
      }
      if (c.pops.echoes < capc.echoes && (c.pops.echoes > 0 || capc.echoes > 0) && civ.energy > 15) c.growth.echoes += 0.22;
      if (c.pops.lattice < capc.lattice && (noMatter ? civ.energy > 15 : civ.matter >= 4)) c.growth.lattice += 0.35;
    }
    for (const th of THREADS) {
      // a grown point becomes a person where there is room, and is paid for then; without room it
      // waits, unpaid (until 19 Oct it was paid for and lost)
      if (c.growth[th] >= 1 && (c.pops[th] < capc[th] || (th === 'kin' && c.pops.kin === 0))) {
        c.growth[th] -= 1;
        if (th === 'lattice') {
          if (noMatter) civ.energy -= 3 * MATTER_AS_ENERGY;
          else civ.matter -= 3;
        }
        if (th === 'echoes') civ.energy -= 3;
        c.pops[th]++;
      }
      if (c.pops[th] > capc[th] && !(th === 'kin' && capc.kin === 0 && c.pops.kin <= 0)) {
        c.pops[th]--;
        t.popsLost++;
        if (th === 'kin' && hasCharter(state, 'cold_sleep_lottery') && capc.cryo > c.cryo) {
          c.cryo++;
          t.popsLost--;
        }
      }
    }
    if (c.cryo > capc.cryo) {
      const over = c.cryo - capc.cryo;
      c.cryo -= over;
      c.pops.kin += over;
    }
    if (popsOf(c) + c.cryo <= 0 && Object.keys(c.structures).length === 0) destroyColony(state, c, 'abandoned');
  }
}

/** Continuity in the Dark Era: every cycle risks a little of the pattern (continuity.ts). */
function continuity(state: GameState, t: CivTurn) {
  if (calendarEra(state) !== 'dark') return;
  state.civ.continuity = Math.max(0, state.civ.continuity - continuityLoss(state, t.starving));
}

/** 8. What has reached us: signals, their deliveries, the turn's events and forecasts. Returns the signals that arrived. */
function signalsAndEvents(state: GameState): Signal[] {
  const civ = state.civ;
  const mine = civ.id === state.player;
  // a find about a world the universe has just changed is dropped (events.ts)
  pruneFinds(state);
  const arrived = deliverSignals(state);
  for (const s of arrived) {
    // a pact's answer: sealed, or our accord back
    if (s.kind === 'pact_answer') answerArrived(state, s.from, s.data);
    // help we asked for, arriving by beam with their answer
    if (s.kind === 'aid_answer' && Number(s.data.energy) > 0) {
      civ.energy += Number(s.data.energy);
      log(state, `${Number(s.data.energy)} energy arrived by beam from ${state.survivors[s.from]?.name ?? 'afar'}.`, 'good');
    }
    if (s.kind === 'last' && s.data.insight) {
      const gain = Number(s.data.insight);
      civ.flags.insight_bank = (civ.flags.insight_bank ?? 0) + gain;
      // their dead worlds, stripped
      if (hasCharter(state, 'consume_the_dead')) civ.matter += gain;
      else if (hasCharter(state, 'salvage_the_dead')) civ.matter += gain * 0.5;
    }
  }
  if (state.turn === 3) queueEvent(state, 'dynamo_fails');
  if (state.turn === 7) queueEvent(state, 'first_night');
  if ((state.flags.hunger_woke ?? 0) > 0 && !state.civ.fired.rust_in_the_belt) {
    // our surveyors found it: say where (the woken swarm nearest the capital), and chart that star
    const capSys = state.systems[state.colonies[state.civ.capitalId ?? '']?.systemId ?? state.civ.homeSystemId];
    // (a swarm that has already set off was found where it fed: the system it left)
    const at = (w: (typeof state.swarms)[string]) => w.systemId ?? w.from ?? w.to ?? null;
    const sw = Object.values(state.swarms)
      .filter((w) => w.awake && at(w) && state.systems[at(w)!])
      .sort((a, b) => distLy(capSys, state.systems[at(a)!]) - distLy(capSys, state.systems[at(b)!]))[0];
    const where = sw ? at(sw) : null;
    if (where && !state.civ.known[where]) state.civ.known[where] = 1;
    queueEvent(state, 'rust_in_the_belt', where ? { systemId: where } : {});
  }
  rollRandomEvent(state);
  // positronium forms where matter has decayed or been unmade (η 85): news, once, after the random
  // roll so that it never changes what the roll draws (a game already past it hears it now)
  if (state.era === 'blackhole' && state.eta >= POSITRONIUM_ETA && fateOf(state) !== 'stable') queueEvent(state, 'positronium_forms');
  // matter stable: by 10^1500 years everything is iron (deeptime.ts), news once
  if (state.flags.iron !== undefined) queueEvent(state, 'iron_stars');
  // and the turn before they decay, for whoever has woven anything through them or strung nets
  if (mine && positroniumHere(state) && colonies(state).some((c) => formOf(c) === 'positronium' || (c.structures.positronium_net ?? 0) > 0) && turnsToDecay(state) <= 1) queueEvent(state, 'positronium_ends');
  // (the forecasts are for the player to read)
  if (mine) updateForecasts(state);
  return arrived;
}

/** What the universe did this turn, for the civilization whose part it is (exported for the checks). */
export function handleNotes(state: GameState, notes: EvolutionNote[]) {
  const colonized = new Set(colonies(state).map((c) => c.systemId));
  const known = state.civ.known;
  // (each civilization sees to its own settlements, in its own part of the turn)
  const own = (id: string | null | undefined) => (id && state.colonies[id]?.owner === state.civ.id ? state.colonies[id] : undefined);
  // the deep dark's flashes this turn, and falling worlds', for the Burst Catchers (catchFlashes)
  const flashes: Flashed[] = [];
  for (const n of notes) {
    const sys = state.systems[n.systemId];
    if (!sys) continue;
    const mine = colonized.has(sys.id);
    const seen = !!known[sys.id];
    switch (n.kind) {
      case 'blue':
        if (seen) log(state, `${sys.name} has left the main sequence. It is brightening into a blue dwarf, its final flare of life.`, mine ? 'good' : 'info', sys.id);
        break;
      case 'white': {
        if (!seen) break;
        // our living worlds there will freeze as the light fades, unless something keeps them warm
        const cold = colonies(state)
          .filter((c) => c.systemId === sys.id)
          .map((c) => state.bodies[c.bodyId])
          .filter((b) => b && sunGone(state, b) && !lampsOver(state, b));
        const warn = cold.length ? ` Whatever lives on ${cold.map((b) => b.name).join(' and ')} will freeze as it fades, unless Orbital Lamps keep it warm.` : '';
        log(state, `${sys.name} has collapsed into a white dwarf. Its light is going out.${warn}`, mine ? 'bad' : 'info', sys.id);
        break;
      }
      case 'collision':
        queueEvent(state, 'new_star', { systemId: sys.id });
        known[sys.id] = Math.max(known[sys.id] ?? 0, 1) as 1 | 2;
        break;
      case 'merger':
        queueEvent(state, 'white_fire', { systemId: sys.id });
        known[sys.id] = Math.max(known[sys.id] ?? 0, 1) as 1 | 2;
        break;
      case 'giant':
        // blindingly bright and very brief: as with any new star, we may keep time with it (a flash)
        queueEvent(state, 'helium_giant', { systemId: sys.id });
        known[sys.id] = Math.max(known[sys.id] ?? 0, 1) as 1 | 2;
        break;
      case 'supernova':
        for (const c of colonies(state)) if (c.systemId === sys.id) destroyColony(state, c, 'a supernova');
        queueEvent(state, 'supernova', { systemId: sys.id });
        break;
      case 'burnout':
        if (seen) log(state, `The star at ${sys.name} has burned out.`, mine ? 'bad' : 'info', sys.id);
        break;
      case 'rogue':
        if (n.bodyId && own(state.bodies[n.bodyId]?.colonyId)) queueEvent(state, 'unmoored', { systemId: sys.id, bodyId: n.bodyId });
        break;
      case 'feeding':
      case 'rekindle':
        if (mine || state.bodies[n.bodyId ?? '']?.traits.includes('homeworld')) queueEvent(state, 'world_falls', { systemId: sys.id, bodyId: n.bodyId ?? '' });
        else if (seen) log(state, `A world is falling into the dead star at ${sys.name}, feeding it a faint new warmth.`, 'info', sys.id);
        break;
      case 'plunge':
        if (n.bodyId) {
          const b = state.bodies[n.bodyId];
          const c = own(b?.colonyId);
          // (into a black hole all at once: its tides tore the world apart, physics.ts)
          const hole = sys.primary.kind === 'black_hole';
          const giant = !!b && giantWorld(b) && !!n.inFlash;
          if (c) evacuate(state, c, giant ? `its world fell into its ${hole ? 'black hole' : 'star'} in a flash` : hole ? 'its world was torn apart by the black hole' : 'its world finished falling into its star');
          // (gone in a flash, since 20 Oct: the note after this one tells of it)
          if (n.inFlash) break;
          if (seen) log(state, hole ? `${b?.name} was torn apart by the black hole at ${sys.name} and fell in: one flash, then nothing.` : `The last of ${b?.name} has fallen into its star: one final flash.`, 'info', sys.id);
          state.civ.energy += colonized.has(sys.id) ? 20 : 0;
        }
        break;
      case 'flash': {
        // a world falling in, in a game begun since 20 Oct (physics.ts, flashSystem): the Burst
        // Catchers bank it out to its reach; a giant's melts what is near, and of our settlements
        // there only what is sheltered lives (in the Deep, any, however it came to be there)
        const f = n.flash;
        const src = state.bodies[n.bodyId ?? ''];
        if (!f || !src) break;
        flashes.push({ sys, reach: flashReach(f.energy), own: true });
        if (!giantWorld(src)) {
          if (seen) log(state, `${src.name} was torn apart by the black hole at ${sys.name}, and the hole took all of its rubble within the turn: a faint flash, harming nothing.`, 'info', sys.id);
          break;
        }
        const inside = (b: Body) => b.kind === 'deep' || f.inside.includes(b.id);
        const lost: string[] = [];
        const lived: string[] = [];
        let people = 0;
        for (const c of colonies(state)) {
          const b = state.bodies[c.bodyId];
          if (c.systemId !== sys.id || !b || formOf(c) === 'horizon' || !inside(b)) continue;
          const boiled = f.boiled.includes(b.id);
          if (!boiled && flashSheltered(c, b)) {
            lived.push(c.name);
            continue;
          }
          people += popsOf(c) + c.cryo;
          lost.push(c.name);
          destroyColony(state, c, boiled ? 'its world boiled away in a flash' : 'a flash melted its world');
        }
        if (!mine && !seen) break;
        const names = (xs: string[]) => (xs.length > 3 ? `${xs.slice(0, 3).join(', ')} and ${xs.length - 3} more` : xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0]);
        const boiledNames = f.boiled.map((id) => state.bodies[id]?.name).filter((x): x is string => !!x);
        const melted = f.inside.map((id) => state.bodies[id]).filter((b): b is Body => !!b && !b.dissolved && b.traits.includes('flash_melted')).map((b) => b.name);
        const said = [
          `${src.name} fell into the ${STAR_WORD[sys.primary.kind] ?? 'star'} at ${sys.name} in a flash: some ${suns(f.lum)} Suns for ${f.years < 2 ? 'about a year' : `about ${formatYears(Number(f.years.toPrecision(2)))}`}.`,
          boiledNames.length ? `${names(boiledNames)} boiled away.` : '',
          melted.length ? `The ground melted on ${names(melted)}.` : '',
          lost.length ? `${people ? `${people} of our people were lost` : 'We lost'} with ${names(lost)}.` : '',
          lived.length ? `${names(lived)} lived through it in shelter.` : '',
        ];
        log(state, said.filter(Boolean).join(' '), lost.length ? 'bad' : 'info', sys.id);
        break;
      }
      case 'boiled':
        if (n.bodyId) {
          const b = state.bodies[n.bodyId];
          if (seen) log(state, n.swallowed ? `${b?.name} was swallowed by the swelling giant at ${sys.name}.` : `${b?.name} boiled away in the heat of the new star at ${sys.name}.`, mine ? 'bad' : 'info', sys.id);
          const c = own(b?.colonyId);
          if (c) evacuate(state, c, n.swallowed ? 'its world was swallowed by its star' : 'its world boiled away');
        }
        break;
      case 'ejected':
        if (mine) queueEvent(state, 'cast_out', { systemId: sys.id });
        break;
      case 'swallowed':
        for (const c of colonies(state)) if (c.systemId === sys.id && !state.bodies[c.bodyId]?.rogue) destroyColony(state, c, 'the system fell into the Heart');
        if (seen) log(state, `${sys.name} fell into the Heart.`, 'info', sys.id);
        break;
      case 'evaporated': {
        // only what was there to catch it: in its Deep, or on a world it held until now
        const caught = finalBurstCatch(state, sys.id, n.held);
        if (caught) {
          state.civ.energy += caught;
          log(state, `Burst Catchers at ${sys.name} caught the black hole’s final burst: +${caught} energy.`, 'good', sys.id);
        }
        // its worlds drift loose and what we built there stays (physics.ts): nothing is lost with it;
        // what was written into its horizon is written back out, and drifts on (horizon.ts)
        for (const c of colonies(state)) if (c.systemId === sys.id && formOf(c) === 'horizon') horizonGone(state, c);
        if (mine) queueEvent(state, 'final_burst', { systemId: sys.id });
        else if (seen) log(state, `The black hole at ${sys.name} has evaporated in a final burst. Whatever orbited it drifts loose.`, 'info', sys.id);
        break;
      }
      case 'faded':
        // curvature radiation: a dwarf gone, its mass turned to particles; its worlds drift loose,
        // and what we built there stays (with nothing left there to warm it)
        if (mine || seen) log(state, `The dwarf at ${sys.name} is gone: space has turned the last of its mass into particles. Whatever orbited it drifts loose.`, mine ? 'bad' : 'info', sys.id);
        break;
      case 'blackdwarf_sn': {
        // a heavy black dwarf exploded (deeptime.ts): its worlds blown away, and whatever we had in its system with them
        let lost = 0;
        for (const c of colonies(state)) {
          if (c.systemId !== sys.id || !inItsSystem(state, c)) continue;
          lost += popsOf(c) + c.cryo;
          destroyColony(state, c, 'its dead star exploded');
        }
        flashes.push({ sys, reach: NEAR_BURST_LY });
        if (!state.civ.fired.black_dwarf_supernova) queueEvent(state, 'black_dwarf_supernova', { systemId: sys.id });
        else if (mine || seen) log(state, `The black dwarf at ${sys.name} has exploded, its core turned to iron.${lost ? ` ${lost} of our people were lost with it.` : ''}`, lost ? 'bad' : 'info', sys.id);
        break;
      }
      case 'collapse': {
        // its matter tunnelled into black holes, which evaporated at once (deeptime.ts): what is of
        // matter is lost; what is leptonic goes on, in the Deep where the system was. A settlement
        // of matter with decay-proof substrate goes on as at the end of matter in the other fates
        // (goLeptonic): what was re-encoded, its Kin and the rest of what was matter lost
        let lost = 0;
        for (const c of colonies(state)) {
          if (c.systemId !== sys.id) continue;
          if (formOf(c) === 'baryonic' && !decayProof(c)) {
            lost += popsOf(c) + c.cryo;
            destroyColony(state, c, 'its matter tunnelled into black holes');
            continue;
          }
          if (formOf(c) === 'baryonic') {
            const gone = goLeptonic(state, c, protocolsMult(state, 'degenerate'));
            lost += gone;
            log(state, `${c.name}: what was re-encoded on its substrate goes on as leptonic${gone ? `; ${gone} of its people, made of matter, were lost` : ''}.`, 'bad', sys.id);
          }
          if (state.bodies[c.bodyId]?.kind !== 'deep') moveToHole(state, c, sys);
        }
        flashes.push({ sys, reach: NEAR_BURST_LY });
        if (!state.civ.fired.tunnelling_collapse && (mine || seen || colonies(state).length)) queueEvent(state, 'tunnelling_collapse', { systemId: sys.id });
        else if (mine) log(state, `The matter at ${sys.name} has tunnelled into black holes and gone in a flash.${lost ? ` ${lost} of our people, still made of it, went with it.` : ''}`, lost ? 'bad' : 'info', sys.id);
        break;
      }
      case 'dissolved':
        for (const c of colonies(state)) {
          if (c.systemId !== sys.id) continue;
          // what made the Passage, or has something decay-proof, goes on alone: leptonic, to a
          // black hole now (the Thinning); the rest is gone, each loss counted for the report
          if (decayProof(c)) goOnAlone(state, c);
          else {
            state.civ.flags.decay_lost = (state.civ.flags.decay_lost ?? 0) + popsOf(c) + c.cryo;
            destroyColony(state, c, 'its matter decayed');
          }
        }
        break;
    }
  }
  if (flashes.length) catchFlashes(state, flashes);
}

/** A flash this turn, and how far it fills a Burst Catcher (ly). */
interface Flashed {
  sys: StarSystem;
  reach: number;
  /** a world falling in: its own system's catchers bank it, even in a system cast out of the galaxy */
  own?: boolean;
}

/** A dead star's kind, as a falling world's flash names it. */
const STAR_WORD: Partial<Record<string, string>> = { white_dwarf: 'white dwarf', black_dwarf: 'black dwarf', neutron_star: 'neutron star', brown_dwarf: 'brown dwarf', black_hole: 'black hole' };

/** A brightness in Suns, to two figures (19,000; 320,000). */
function suns(lum: number): string {
  return Number(lum.toPrecision(2)).toLocaleString('en-US');
}

/**
 * The turn's flashes: in the deep dark (black dwarf supernovae, matter tunnelling into black holes,
 * a neutron star's reach each), and since 20 Oct worlds falling in (by their energy: flashReach).
 * Each of our Burst Catchers banks from the best of them, once, by its distance (`burstShare`: all
 * of it in its own system or within the flash's reach), as from a neutron star bursting. In a
 * system cast out of the galaxy only a world falling into its own star reaches them.
 */
function catchFlashes(state: GameState, flashes: Flashed[]) {
  let got = 0;
  const where: string[] = [];
  for (const c of colonies(state)) {
    const n = c.structures.burst_catcher ?? 0;
    const home = state.systems[c.systemId];
    if (!n || !home || !inItsSystem(state, c)) continue;
    let share = 0;
    // (nothing reaches a system cast out of the galaxy, but a world falling into its own star)
    for (const f of flashes) if (!home.ejected || (f.own && f.sys.id === home.id)) share = Math.max(share, burstShare(distLy(home, f.sys), f.reach));
    if (share > 0) {
      got += share * n;
      where.push(c.name);
    }
  }
  if (got > 0) {
    state.civ.energy += got;
    log(state, `Burst Catchers at ${where.length > 2 ? `${where.slice(0, 2).join(', ')} and ${where.length - 2} more` : where.join(' and ')} caught the flash: +${Math.round(got)} energy.`, 'good');
  }
}

/** A world is lost (it falls into its star, or boils away): whoever can get off is caught by the habitats of the Deep. */
function evacuate(state: GameState, c: Colony, reason: string) {
  const sys = state.systems[c.systemId];
  // (its own civilization's Deep, beside any other's)
  const deep = deepFor(state, sys, c.owner);
  const saved: Partial<Record<(typeof THREADS)[number], number>> = {};
  let n = 0;
  for (const t of THREADS) {
    saved[t] = Math.floor(c.pops[t] * 0.75);
    n += saved[t]!;
  }
  const cryo = Math.floor(c.cryo * 0.75);
  const orbital = Object.entries(c.structures).filter(([id]) => STRUCTURE_BY_ID[id]?.bodies?.includes('deep'));
  destroyColony(state, c, reason);
  if (!deep || n + cryo <= 0) return;
  let host = deep.colonyId ? state.colonies[deep.colonyId] : null;
  if (!host) {
    host = createColony(state, deep, {});
    host.name = `${sys.name} Deep`;
  }
  for (const t of THREADS) host.pops[t] += saved[t] ?? 0;
  host.cryo += cryo;
  for (const [id, k] of orbital) host.structures[id] = Math.max(host.structures[id] ?? 0, k);
  if (!host.structures.substrate_core && (saved.echoes ?? 0) > 0) host.structures.substrate_core = Math.ceil((saved.echoes ?? 0) / 4);
  log(state, `${n + cryo} of ${c.name}’s people escaped to the Deep before the end.`, 'good', sys.id);
}

/**
 * The fate of matter shows itself, if no one found it out first: near η 30 a neutron star should
 * be a few billionths of a degree above nothing. If protons decay their warmth holds it near two
 * degrees; under curvature radiation it holds at thirty billionths, paid for with its mass. If
 * neither, it cools below the black holes, and that is the end of the Degenerate Age (the crossing
 * says so).
 */
function revealFate(state: GameState) {
  state.civ.flags.fate_known = state.turn;
  const fate = fateOf(state);
  if (fate !== 'stable') queueEvent(state, fate === 'decay' ? 'decay_shown' : 'curvature_shown');
}

/**
 * The calendar turns without the age (a fate other than decay): at η 39 it skips to 10^40 years and
 * the Black Hole Age's Tide, as it always did there, while the age goes on as it is.
 */
function calendarTurn(state: GameState) {
  state.years = ERA_BY_ID.blackhole.startYears;
  state.eta = Math.log10(state.years);
  state.turnLength = tideLength('blackhole', state.years, state.settings.length);
}
