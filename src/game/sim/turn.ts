import { SHIP_BY_ID } from '../data/ships';
import { STRUCTURE_BY_ID, structureLabel } from '../data/structures';
import { eraOver, logTurnLength } from '../eras';
import { SURFACE_LIFE, evolveUniverse, lampsOver, sunGone, turnsToFreeze, vitalityLoss, type EvolutionNote } from '../physics';
import type { Body, Colony, CrossingReport, GameState, Outcome, Signal } from '../types';
import { THREADS } from '../types';
import { runCrossing } from './crossing';
import { spareYield } from './spare';
import { capacity, colonyTurn, latticeAlienation, reserveCapacity, type TurnContext } from './economy';
import { checkEndings, workCost } from './endings';
import { queueEvent, rollRandomEvent } from './events';
import { advanceFleets, autoExplore, createColony, destroyColony, newFleet, surveyWhereStationed, updateDetection } from './fleets';
import { updateForecasts } from './forecast';
import { wakeArchivedEchoes } from './archive';
import { clearStarClock, flareData, livedShare, scorched, turnStep } from './flare';
import { firstSwarm, swarmsHunt, updateHunger } from './hunger';
import { updateMinds } from './minds';
import { computeMods, type Mods } from './mods';
import { completeTech, discoverFromSurplus, IDLE_STUDY, researchDraw, techCost } from './research';
import { deliverSignals } from './signals';
import { updateSociety } from './society';
import { jointIncome, updateSurvivors } from './survivors';
import { clamp, colonies, distLy, hasCharter, log, popsOf, totalPops, withRng } from './util';

export interface TurnResult {
  crossing: CrossingReport | null;
  outcome: Outcome | null;
  arrived: Signal[];
  notes: EvolutionNote[];
  wasted: number;
}

/** Industry drives the build queue; leftover goes to the settlement's spare work. Returns the insight it made. */
function applyIndustry(state: GameState, c: Colony, industry: number, energyMade: number, mods: Mods): number {
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
        if (d?.vitalityOnce) {
          const b = state.bodies[c.bodyId];
          b.vitality = Math.min(1, b.vitality + d.vitalityOnce);
        }
        if (d?.coreHeatBonus) {
          const b = state.bodies[c.bodyId];
          b.coreHeat = Math.min(1, b.coreHeat + d.coreHeatBonus);
        }
        if (item.key === 'confluence_node') state.civ.flags.chorus_nodes_built = (state.civ.flags.chorus_nodes_built ?? 0) + 1;
        log(state, `${c.name}: ${item.kind === 'structure' ? structureLabel(item.key, state.systems[c.systemId]).name : d?.name ?? item.key} complete.`, 'good', c.systemId);
      } else {
        const def = SHIP_BY_ID[item.key];
        if (def?.crew) c.pops.kin = Math.max(0, c.pops.kin - def.crew);
        const existing = Object.values(state.fleets).find((f) => f.at === c.systemId && f.order === 'idle' && !f.auto && f.ships.every((s) => s.cls === item.key) && !def?.settles && !def?.survey);
        if (existing) existing.ships.push({ cls: item.key, hp: def?.hp ?? 5 });
        else newFleet(state, c.systemId, [item.key]);
        log(state, `${c.name}: ${def?.name ?? item.key} launched from the slips.`, 'good', c.systemId);
      }
    }
  }
  void mods;
  if (!(left > 0) || c.queue.length || state.civ.dormant) return 0;
  const y = spareYield(state, c, left, energyMade);
  state.civ.matter += y.matter;
  state.civ.energy += y.energy;
  if (y.resolve) state.civ.resolve = clamp(state.civ.resolve + y.resolve, 0, 100);
  return y.insight;
}

function declineWorlds(state: GameState) {
  const byBody = new Map(colonies(state).map((c) => [c.bodyId, c]));
  for (const b of Object.values(state.bodies)) {
    if (b.dissolved || b.vitality <= 0) continue;
    const c = byBody.get(b.id);
    const loss = vitalityLoss(state, b, c);
    b.vitality = Math.max(0, b.vitality - loss.decline);
    if (c && b.traits.includes('homeworld') && state.era === 'dusk') b.coreHeat = Math.max(0, b.coreHeat - 0.007 * ((c.structures.core_stimulator ?? 0) > 0 ? 0.4 : 1));
    if (b.vitality > 0) b.vitality = Math.max(0, b.vitality - loss.freeze);
    // one of ours begins to freeze, its dead star cooled at last: say so once (the Last Light
    // says it for every world)
    if (c && loss.freeze > 0 && b.vitality > 0 && state.era === 'dusk' && !b.rogue && !state.civ.flags[`frz_${b.id}`]) {
      state.civ.flags[`frz_${b.id}`] = state.turn;
      const n = turnsToFreeze(state, b, c);
      log(state, `${b.name} has begun to freeze: its dead star no longer warms it. It dies in about ${n} turn${n === 1 ? '' : 's'} unless Orbital Lamps keep it warm.`, 'bad', b.systemId);
    }
    if (b.vitality <= 0) worldDies(state, b);
  }
}

/**
 * A flaring star boils the seas of its worlds and strips their air. The damage follows the share
 * of the flare this turn lives through, so it comes to the same whether it passes in one turn or six.
 */
function scorchWorlds(state: GameState, from: number, to: number) {
  for (const b of Object.values(state.bodies)) {
    if (b.dissolved || b.vitality <= 0 || !scorched(state, b)) continue;
    const p = state.systems[b.systemId].primary;
    const start = p.blueAt ?? from;
    const end = p.whiteAt ?? to;
    const share = end > start ? Math.max(0, Math.min(end, to) - Math.max(start, from)) / (end - start) : 1;
    if (share <= 0) continue;
    b.vitality = Math.max(0, b.vitality - 0.6 * share);
    // the seas boil into steam, and the steam is broken up and lost to space
    if (b.water) b.water *= 1 - 0.9 * share;
    if (b.vitality <= 0) worldDies(state, b, true);
  }
}

/** A living world that has lost its warmth freezes, or dries to bare rock. */
function worldDies(state: GameState, b: Body, scorched = false) {
  if (!SURFACE_LIFE.includes(b.kind)) return;
  const was = b.kind;
  b.kind = !scorched && (b.water ?? 0) >= 0.1 ? 'ice' : 'barren';
  b.habitability = b.kind === 'ice' ? 0.05 : 0;
  b.vitality = 0;
  if (!b.traits.includes('once_alive')) b.traits.push('once_alive');
  const mine = !!b.colonyId;
  const seen = (state.civ.known[b.systemId] ?? 0) === 2;
  if (mine || seen) {
    const what = scorched
      ? 'Its seas boiled away under the flare and its air went with them'
      : was === 'eyeball'
        ? 'Its sea has frozen from the terminator to the substellar point'
        : 'Its seas have frozen and its air has settled out as frost';
    log(state, `${b.name} has died. ${what}; it is ${b.kind === 'ice' ? 'an ice world' : 'bare rock'} now.`, mine ? 'bad' : 'info', b.systemId);
  }
}

export function endTurn(state: GameState): TurnResult {
  const result: TurnResult = { crossing: null, outcome: state.outcome, arrived: [], notes: [], wasted: 0 };
  if (state.outcome) return result;
  const civ = state.civ;
  const mods = computeMods(state);
  civ.pace = clamp(civ.pace, mods.paceMin, mods.paceMax);

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

  // (a turn stops when one of our stars begins its last flare; see flare.ts)
  const step = turnStep(state);
  const logL = logTurnLength(step);
  const ctx: TurnContext = { years: state.years, L: step.turnLength, logL, paceFactor: livedShare(state, civ.pace, step), mods };

  // ------------------------------------------------ 1. economy
  let eIn = 0;
  let eOut = 0;
  let mIn = 0;
  let mOut = 0;
  let insight = 0;
  let accord = 0;
  let matterAvail = civ.matter;
  const net: Record<string, number> = {};
  for (const c of colonies(state)) {
    const t = colonyTurn(state, c, ctx, matterAvail);
    matterAvail -= t.matterBurn;
    c.last = t.y;
    eIn += t.y.energy;
    eOut += t.y.energyUpkeep;
    mIn += t.y.matter;
    mOut += t.y.matterUpkeep;
    insight += t.y.insight;
    accord += t.y.accord;
    net[c.id] = t.y.energy - t.y.energyUpkeep;
    const sys = state.systems[c.systemId];
    sys.primary.spin = Math.max(0, sys.primary.spin - t.spinDraw);
    if (t.depletion > 0) {
      const b = state.bodies[c.bodyId];
      b.richness = Math.max(0.05, b.richness - t.depletion * 0.0006);
      b.hydrogen = Math.max(0, b.hydrogen - t.depletion * 0.0004);
    }
    if (c.overdrive) {
      c.damage = Math.min(1, c.damage + 0.04);
      state.gfe = Math.max(0.05, state.gfe - 0.0002);
    } else c.damage = Math.max(0, c.damage - 0.02);
    for (const [id, n] of Object.entries(c.structures)) {
      const d = STRUCTURE_BY_ID[id];
      if (d?.gfeDrain && n) state.gfe = Math.max(0.05, state.gfe - d.gfeDrain * n * ctx.paceFactor);
    }
    insight += applyIndustry(state, c, t.y.industry, t.y.energy, mods);
  }
  eIn += jointIncome(state) * ctx.paceFactor;
  eOut += researchDraw(state, insight);
  accord -= latticeAlienation(state, mods);
  civ.energy += eIn - eOut;
  civ.matter += mIn - mOut;
  civ.accord = clamp(civ.accord + accord, 0, 999);
  const cap = reserveCapacity(state, mods);
  civ.flags.reserve_cap = cap;
  if (civ.energy > cap) {
    result.wasted = civ.energy - cap;
    civ.energy = cap;
  }
  civ.flags.last_energy_net = eIn - eOut;
  civ.flags.last_matter_net = mIn - mOut;
  civ.flags.last_insight = insight;
  civ.flags.last_accord = accord;

  // overdrive accidents
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

  // ------------------------------------------------ 2. starvation
  let starving = false;
  let popsLost = 0;
  if (civ.energy < 0) {
    starving = true;
    civ.energy = 0;
    const hungry = colonies(state).filter((c) => (net[c.id] ?? 0) < 0).sort((a, b) => (net[a.id] ?? 0) - (net[b.id] ?? 0));
    for (const c of hungry.slice(0, 3)) {
      c.starving++;
      const lottery = hasCharter(state, 'cold_sleep_lottery') && capacity(state, c, mods).cryo > c.cryo;
      if (c.pops.kin > 0) {
        c.pops.kin--;
        if (lottery) c.cryo++;
        else {
          popsLost++;
          if (hasCharter(state, 'upload_at_death') && capacity(state, c, mods).echoes > c.pops.echoes && withRng(state, (r) => r.chance(0.5))) c.pops.echoes++;
        }
      } else if (c.pops.chorus + c.pops.echoes + c.pops.coldminds > 0 && c.starving % 2 === 0) {
        const t = c.pops.echoes > 0 ? 'echoes' : c.pops.chorus > 0 ? 'chorus' : 'coldminds';
        c.pops[t]--;
        popsLost++;
      }
    }
    log(state, 'The reserve is empty. Settlements are going cold.', 'bad');
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

  // ------------------------------------------------ 3. research and works
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

  // ------------------------------------------------ 4. growth, capacity, worlds
  scorchWorlds(state, state.years, step.years);
  declineWorlds(state);
  // Echoes waiting in the archive move into any free substrate before anyone is counted
  wakeArchivedEchoes(state);
  for (const c of colonies(state)) {
    const capc = capacity(state, c, mods);
    const b = state.bodies[c.bodyId];
    if (!civ.dormant && !starving) {
      if (c.pops.kin > 0 && c.pops.kin < capc.kin) {
        c.growth.kin += 0.12 * (0.5 + 0.5 * b.vitality) * (hasCharter(state, 'child_quotas') ? 0.4 : 1);
      }
      if (c.pops.echoes < capc.echoes && (c.pops.echoes > 0 || capc.echoes > 0) && civ.energy > 15) c.growth.echoes += 0.22;
      if (c.pops.lattice < capc.lattice && civ.matter >= 4) c.growth.lattice += 0.35;
    }
    for (const t of THREADS) {
      if (c.growth[t] >= 1) {
        c.growth[t] -= 1;
        if (t === 'lattice') civ.matter -= 3;
        if (t === 'echoes') civ.energy -= 3;
        if (c.pops[t] < capc[t] || (t === 'kin' && c.pops.kin === 0)) c.pops[t]++;
      }
      if (c.pops[t] > capc[t] && !(t === 'kin' && capc.kin === 0 && c.pops.kin <= 0)) {
        c.pops[t]--;
        popsLost++;
        if (t === 'kin' && hasCharter(state, 'cold_sleep_lottery') && capc.cryo > c.cryo) {
          c.cryo++;
          popsLost--;
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

  // ------------------------------------------------ 5. society
  // Consume the Dead: nothing is buried any more
  if (popsLost > 0 && hasCharter(state, 'consume_the_dead')) civ.matter += popsLost * 4;
  updateSociety(state, logL, popsLost, starving);
  if (civ.wakeBonus > 0 && !civ.dormant) civ.wakeBonus--;

  // ------------------------------------------------ 6. fleets, hazards, other minds
  advanceFleets(state, step.turnLength, mods);
  surveyWhereStationed(state);
  // look around before exploring ships set off again, so they scan every star they reach
  updateDetection(state, mods);
  firstSwarm(state);
  // swarms go for ships that have just stopped at their star, before exploring probes move on
  swarmsHunt(state, mods);
  autoExplore(state, mods);
  updateHunger(state, step.turnLength, mods);
  updateSurvivors(state, logL, mods, step.turnLength);
  updateMinds(state, logL, mods);

  // ------------------------------------------------ 7. the universe moves on
  const from = state.years;
  const notes = withRng(state, (rng) => evolveUniverse(state, from, step.years, () => rng.next()));
  result.notes = notes;
  handleNotes(state, notes);
  if (state.era === 'dark') {
    // Continuity: every cycle risks a little of the pattern
    let decay = 2.2;
    for (const c of colonies(state)) {
      for (const [id, n] of Object.entries(c.structures)) {
        const d = STRUCTURE_BY_ID[id];
        if (d?.continuityMult && n) decay *= Math.pow(d.continuityMult, n);
      }
    }
    if (civ.dormant) decay *= 0.35;
    if (starving) decay += 5;
    civ.continuity = Math.max(0, civ.continuity - decay);
  }
  state.years = step.years;
  state.eta = step.eta;
  state.turnLength = step.turnLength;
  state.turn++;
  state.eraTurn++;
  // one of our stars has just begun its last flare (the turn stopped for it)
  for (const sys of new Set(colonies(state).map((c) => state.systems[c.systemId]))) {
    if (sys?.primary.kind === 'blue_dwarf' && sys.primary.blueAt === state.years) queueEvent(state, 'last_flare', flareData(state, sys));
  }
  if (civ.flags.flare_until && state.years >= civ.flags.flare_until) {
    delete civ.flags.flare_until;
    delete civ.flags.flare_step;
  }
  // the new star we kept time with has burned out: our own pace again
  clearStarClock(state);

  // ------------------------------------------------ 8. signals, forecasts, events
  result.arrived = deliverSignals(state);
  for (const s of result.arrived) {
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
  if ((state.flags.hunger_woke ?? 0) > 0 && !state.fired.rust_in_the_belt) {
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
  updateForecasts(state);

  // ------------------------------------------------ 9. crossings
  if (eraOver(state.era, state.eta)) {
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
      result.crossing = runCrossing(state, mods);
      state.crossing = result.crossing;
      updateForecasts(state);
    }
  }
  // the last black hole may evaporate before the calendar says so
  if (state.era === 'blackhole' && !Object.values(state.systems).some((s) => (s.primary.kind === 'black_hole' || s.primary.kind === 'smbh') && !s.gone)) {
    const o = checkEndings(state, true);
    if (o) {
      result.outcome = o;
      return result;
    }
    result.crossing = runCrossing(state, computeMods(state));
    state.crossing = result.crossing;
  }

  // ------------------------------------------------ 10. endings, stats
  result.outcome = checkEndings(state);
  civ.stats.pops.push(totalPops(state));
  civ.stats.energy.push(Math.round(civ.energy));
  civ.stats.resolve.push(Math.round(civ.resolve));
  for (const k of ['pops', 'energy', 'resolve'] as const) if (civ.stats[k].length > 500) civ.stats[k].shift();
  if (!civ.capitalId || !state.colonies[civ.capitalId]) civ.capitalId = colonies(state).sort((a, b) => popsOf(b) - popsOf(a))[0]?.id ?? null;
  return result;
}

function handleNotes(state: GameState, notes: EvolutionNote[]) {
  const colonized = new Set(colonies(state).map((c) => c.systemId));
  const known = state.civ.known;
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
        if (n.bodyId && state.bodies[n.bodyId]?.colonyId) queueEvent(state, 'unmoored', { systemId: sys.id, bodyId: n.bodyId });
        break;
      case 'feeding':
      case 'rekindle':
        if (mine || state.bodies[n.bodyId ?? '']?.traits.includes('homeworld')) queueEvent(state, 'world_falls', { systemId: sys.id, bodyId: n.bodyId ?? '' });
        else if (seen) log(state, `A world is falling into the dead star at ${sys.name}, feeding it a faint new warmth.`, 'info', sys.id);
        break;
      case 'plunge':
        if (n.bodyId) {
          const b = state.bodies[n.bodyId];
          if (b?.colonyId) {
            const c = state.colonies[b.colonyId];
            if (c) evacuate(state, c, 'its world finished falling into its star');
          }
          if (seen) log(state, `The last of ${b?.name} has fallen into its star: one final flash.`, 'info', sys.id);
          state.civ.energy += colonized.has(sys.id) ? 20 : 0;
        }
        break;
      case 'boiled':
        if (n.bodyId) {
          const b = state.bodies[n.bodyId];
          if (seen) log(state, n.swallowed ? `${b?.name} was swallowed by the swelling giant at ${sys.name}.` : `${b?.name} boiled away in the heat of the new star at ${sys.name}.`, mine ? 'bad' : 'info', sys.id);
          if (b?.colonyId) {
            const c = state.colonies[b.colonyId];
            if (c) evacuate(state, c, n.swallowed ? 'its world was swallowed by its star' : 'its world boiled away');
          }
        }
        break;
      case 'ejected':
        if (mine) queueEvent(state, 'cast_out', { systemId: sys.id });
        break;
      case 'swallowed':
        for (const c of colonies(state)) if (c.systemId === sys.id) destroyColony(state, c, 'the system fell into the Heart');
        if (seen) log(state, `${sys.name} fell into the Heart.`, 'info', sys.id);
        break;
      case 'evaporated': {
        let catchers = 0;
        for (const c of colonies(state)) if (c.systemId === sys.id) catchers += c.structures.burst_catcher ?? 0;
        if (catchers) {
          state.civ.energy += 250 * catchers;
          log(state, `Burst Catchers at ${sys.name} caught the black hole’s final burst.`, 'good', sys.id);
        }
        if (mine) queueEvent(state, 'final_burst', { systemId: sys.id });
        for (const c of colonies(state)) if (c.systemId === sys.id && !Object.keys(c.structures).some((k) => STRUCTURE_BY_ID[k]?.decayProof)) destroyColony(state, c, 'its black hole evaporated');
        break;
      }
      case 'dissolved':
        for (const c of colonies(state)) {
          if (c.systemId === sys.id && !Object.keys(c.structures).some((k) => STRUCTURE_BY_ID[k]?.decayProof)) {
            state.flags.decay_lost = (state.flags.decay_lost ?? 0) + popsOf(c) + c.cryo;
            destroyColony(state, c, 'its matter decayed');
          }
        }
        break;
    }
  }
}

/** A world is lost (it falls into its star, or boils away): whoever can get off is caught by the habitats of the Deep. */
function evacuate(state: GameState, c: Colony, reason: string) {
  const sys = state.systems[c.systemId];
  const deep = sys.bodies.map((id) => state.bodies[id]).find((b) => b && b.kind === 'deep' && !b.dissolved);
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
