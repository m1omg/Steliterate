import { EVENT_BY_ID, choiceHint } from './data/events';
import { STRUCTURE_BY_ID, type EnergyMode } from './data/structures';
import { TECHS } from './data/techs';
import { WORK_BY_ID } from './data/works';
import { logTurnLength } from './eras';
import { starClockTerms, turnStep } from './sim/flare';
import { emberShare, sourceLight, vitalityLoss } from './physics';
import {
  answerEvent,
  answerSignal,
  buildCost,
  charterAvailable,
  convert,
  dismantle,
  dismantleTerms,
  enactCharter,
  makeGesture,
  orderFleet,
  queueBuild,
  removeQueued,
  rushBuild,
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
import { canSettle } from './sim/fleets';
import { colonies, distLy, eraIndex, hasTech, swarmSeenAt, threadTotals } from './sim/util';
import type { Body, Colony, Fate, GameState, ThreadId } from './types';
import { THREADS } from './types';
import { THREAD_DEFS } from './data/threads';
import { accordCheck, accordCost, spendAccord, type AccordUse } from './sim/accord';
import { DEGENERATE_END, MATTER_END, calendarEra, fateKnown, fateOf, inAge, matterGone } from './fate';
import { FLOW_ETA, flowAhead, flowing, keeping } from './sim/flow';

// when the autoplayer spends accord, and how much it keeps for the next law (the dearest costs 30)
const ACCORD_KEEP = 30;
const ACCORD_RALLY_BELOW = 40;
const ACCORD_CALM_ABOVE = 40;
const ACCORD_HEAR_BELOW = 35;

// An autoplayer. It powers the balance harness, and can later back an in-game advisor.

export type Strategy = 'competent' | 'passive';

const TECH_PRIORITY = [
  'energy_storage', 'magnetospherics', 'the_long_record', 'orbital_collectors', 'survey_optics', 'mind_substrate', 'fusion_drives', 'hardy_lineages',
  'subterranean_cities', 'orbital_industry', 'fusion', 'upload', 'cold_sleep', 'slow_instancing', 'ember_harvest', 'orbital_defense', 'dyson_swarms',
  'last_light_protocols', 'reversible_logic', 'hibernation_protocols', 'deep_listening', 'hunger_studies', 'magnetic_sails', 'comet_shepherding', 'assembly_of_threads',
  'horizon_physics', 'accretion_engines', 'proton_question', 'deep_mantle', 'catalyzed_drives', 'mind_merging', 'halo_dynamics', 'pulsar_braking', 'hunger_lures',
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
    const next = TECH_PRIORITY.find((id) => avail.has(id)) ?? [...avail].filter((id) => !TECHS.find((t) => t.id === id)?.taint).sort((a, b) => techCost(state, a) - techCost(state, b))[0];
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
  const logL = logTurnLength(turnStep(state, civ.pace));
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
      // only where the source is gone for good: decay and curvature harvesters wait for their time
      if (!d?.matter || !d.energy || !GONE_FOR_GOOD.includes(d.energy.mode)) continue;
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
    const energyFirst = net < 3 || civ.energy < cap * 0.25;
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
      if (light > 0.3) plan.push('dyson_swarm', 'orbital_collector', 'ember_collector', 'solar_array');
      plan.push('disk_skimmer', 'accretion_engine', 'pulsar_brake', 'geothermal_tap', 'fusion_plant', 'decay_harvester');
    }
    // its star has died: light Orbital Lamps while there is still life to keep
    if (calendarEra(state) === 'dusk' && b.vitality >= 0.2 && vitalityLoss(state, b, c).freeze > 0) plan.unshift('orbital_lamps');
    if (b.traits.includes('homeworld') && calendarEra(state) === 'dusk') plan.push('mag_shield', 'comet_shepherd', 'core_stimulator');
    if (c.pops.kin >= capc.kin - 1 && calendarEra(state) === 'dusk') plan.push('warrens', 'habitat_dome');
    if (hasTech(state, 'mind_substrate') && c.pops.echoes >= capc.echoes - 1) plan.push('substrate_core');
    if (hasTech(state, 'cold_computation') && c.pops.coldminds >= capc.coldminds - 1) plan.unshift('cold_vault');
    if (lateDusk && c.pops.kin > 0) plan.push('cryo_hall');
    if (calendarEra(state) === 'dusk' && state.eta > 13.985) plan.push('ember_collector', 'fusion_plant', 'accretion_engine', 'reserve_vault');
    if (civ.energy > cap * 0.8) plan.push('reserve_vault', 'superconducting_ring', 'horizon_vault', 'burst_catcher');
    if (civ.matter < 80) plan.push('mine', 'hydrogen_skimmer', 'brown_siphon');
    if (t.echoes > 0 && hasTech(state, 'upload')) plan.push('upload_clinic');
    if (hasTech(state, 'cold_computation')) plan.push('cold_vault');
    if (Object.values(state.swarms).some((s) => !s.tamed && s.awake)) plan.push('defense_grid');
    plan.push('archive_spire', 'orbital_collector', 'solar_array', 'foundry', 'ember_collector', 'relic_dig', 'commons', 'reserve_vault');
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
  if (calendarEra(state) === 'degenerate' && emberShare(sys.primary, state.years) > 0) s += 2;
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
  for (const f of Object.values(state.fleets)) {
    if (!f.at || f.order !== 'idle') continue;
    const here = state.systems[f.at];
    const settler = f.ships.find((s) => ['ark', 'seedcore', 'spore', 'vaultship', 'lighter'].includes(s.cls));
    if (settler) {
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
        .filter((s) => !s.gone && !swarmSeenAt(state, s.id) && !Object.values(state.fleets).some((o) => o.to === s.id))
        .sort((a, b) => distLy(here, a) - distLy(here, b))[0];
      if (target && civ.energy > 20) orderFleet(state, f.id, target.id, 'survey');
    }
  }
  // build settlers
  const nCol = colonies(state).length;
  const want = calendarEra(state) === 'dusk' ? 3 + Math.floor(state.eraTurn / 12) : 4 + Math.floor(state.eraTurn / 10);
  const inFlight = Object.values(state.fleets).filter((f) => f.ships.some((s) => ['ark', 'seedcore', 'spore', 'vaultship', 'lighter'].includes(s.cls))).length + capital.queue.filter((q) => q.kind === 'ship').length;
  // only expand what the economy can carry: new settlements cost upkeep long before they pay
  const pr = project(state);
  const netNow = pr.energyIn - pr.energyOut;
  const affordable = netNow > 2 + nCol * 1.5 && civ.energy > reserveCapacity(state, computeMods(state)) * 0.4;
  const fate = plannedFate(state);
  // a black hole that will outlast the end of matter (under curvature, only the big ones do)
  const lasting = (k: string, at?: number) => (k === 'black_hole' || k === 'smbh') && (fate !== 'curvature' || (at ?? Infinity) > Math.pow(10, MATTER_END.curvature));
  const atHole = colonies(state).some((c) => lasting(state.systems[c.systemId].primary.kind, state.systems[c.systemId].primary.evaporateAt));
  const needHole = ((fate === 'decay' && calendarEra(state) === 'degenerate' && state.eta > 22) || (fate === 'curvature' && state.eta > 50 && !matterGone(state))) && !atHole && inFlight === 0 && civ.matter > 80;
  if ((affordable || needHole) && nCol + inFlight < want + (needHole ? 1 : 0) && (capital.structures.shipyard ?? 0) > 0 && capital.queue.length < 3) {
    const opts = calendarEra(state) === 'dusk' ? ['seedcore', 'ark', 'spore'] : ['vaultship', 'seedcore', 'spore'];
    if (eraIndex(calendarEra(state)) >= 2) opts.unshift('vaultship');
    for (const k of opts) if (!queueBuild(state, capital.id, 'ship', k)) break;
  }
  const lighterBusy = Object.values(state.fleets).some((f) => f.ships.some((x) => x.cls === 'lighter')) || capital.queue.some((q) => q.key === 'lighter');
  const homeCols = colonies(state).filter((c) => c.systemId === capital.systemId).length;
  // only worth a Lighter where the world itself still has room to live
  const freeHere = home.bodies.some((bid) => {
    const b = state.bodies[bid];
    return b && !b.colonyId && !canSettle(state, b, 'kin') && b.habitability * b.vitality > 0.05;
  });
  if (calendarEra(state) === 'dusk' && affordable && !lighterBusy && freeHere && homeCols < 2 && capital.pops.kin >= 6 && capital.queue.length < 3) queueBuild(state, capital.id, 'ship', 'lighter');
  if (state.eraTurn % 25 === 3 && Object.values(state.fleets).filter((f) => f.ships.some((s) => s.cls === 'probe')).length < 2) queueBuild(state, capital.id, 'ship', 'probe');
}

function planThreads(state: GameState) {
  const mods = computeMods(state);
  const step = turnStep(state);
  const logL = logTurnLength(step);
  const kinStrain = strainFor('kin', logL, mods).m;
  const echoStrain = strainFor('echoes', logL, mods).m;
  for (const c of colonies(state)) {
    for (let i = 0; i < 2; i++) {
      if (kinStrain > 2 && c.pops.kin > 1) {
        if (convert(state, c.id, 'upload')) convert(state, c.id, 'freeze');
      }
      if (echoStrain > 0.5 && c.pops.echoes > 0) convert(state, c.id, 'cool');
      if (calendarEra(state) === 'dusk' && state.eta > 13.995 && c.pops.kin > 0) convert(state, c.id, 'freeze');
    }
  }
}

function planCharters(state: GameState) {
  const order = ['open_archives', 'right_to_stop', 'thread_parity', 'merge_consent', 'sanctuary', 'the_long_watch', 'lattice_compact'];
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

function planSignals(state: GameState) {
  const civ = state.civ;
  for (const s of state.signals) {
    if (s.resolved || s.arrivedTurn === null || !s.choices.length) continue;
    let choice = s.choices[s.choices.length - 1].id;
    if (s.kind === 'aid') choice = civ.energy > Number(s.data.ask) * 3 ? 'give' : 'refuse';
    if (s.kind === 'refugees') choice = 'accept';
    if (s.kind === 'joint') choice = civ.matter > 120 ? 'join' : 'decline';
    if (s.kind === 'trade') choice = civ.matter > 150 ? 'trade' : 'decline';
    if (s.kind === 'slow_first') choice = 'math';
    if (s.kind === 'dark_reveal1') choice = 'ease';
    if (s.kind === 'dark_reveal2') choice = 'help';
    if (answerSignal(state, s.uid, choice)) answerSignal(state, s.uid, s.choices[s.choices.length - 1].id);
  }
  const dark = state.minds.dark;
  if (dark.stage >= 2 && dark.stage < 5 && civ.energy > 80 && civ.matter > 40) makeGesture(state, patternAnswer(dark.lastPattern));
}

/** Pay to keep time with a new star only while half the store would remain afterwards. */
function clockTooDear(state: GameState, defId: string, choice: number, systemId: string): boolean {
  if ((defId !== 'new_star' && defId !== 'white_fire' && defId !== 'helium_giant') || choice !== 0) return false;
  const cost = starClockTerms(state, state.systems[systemId]).cost;
  return cost > 0 && state.civ.energy - cost < 0.5 * reserveCapacity(state, computeMods(state));
}

function planEvents(state: GameState) {
  for (const p of [...state.pending]) {
    const def = EVENT_BY_ID[p.defId];
    if (!def) continue;
    let done = false;
    for (let i = 0; i < def.choices.length && !done; i++) {
      const ch = def.choices[i];
      if (ch.ok && !ch.ok(state, p.data)) continue;
      if (/Taint|Devour|Strip/.test(ch.label + choiceHint(ch, state, p.data))) continue;
      if (clockTooDear(state, p.defId, i, String(p.data.systemId))) continue;
      done = answerEvent(state, p.uid, i).ok;
    }
    if (!done) answerEvent(state, p.uid, def.choices.length - 1);
  }
}

function planPace(state: GameState) {
  const civ = state.civ;
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
  for (const id of ['aeon_seed', 'hibernal_cascade', 'archive_of_everything', 'confluence', 'garden_of_embers']) {
    const w = WORK_BY_ID[id];
    if (!hasTech(state, w.tech) || !inAge(state, w.eras)) continue;
    if (!workRequirementMet(state, id)) continue;
    if (!startWork(state, id)) return;
  }
}

export function autoPlay(state: GameState, strategy: Strategy) {
  if (strategy === 'passive') {
    if (!state.civ.researching) {
      const t = availableTechs(state).sort((a, b) => techCost(state, a.id) - techCost(state, b.id))[0];
      if (t) setResearch(state, t.id);
    }
    for (const p of [...state.pending]) answerEvent(state, p.uid, 0);
    for (const s of state.signals) if (!s.resolved && s.arrivedTurn !== null && s.choices.length) answerSignal(state, s.uid, s.choices[s.choices.length - 1].id);
    return;
  }
  planEvents(state);
  pickResearch(state);
  planCharters(state);
  planAccord(state);
  planThreads(state);
  planFlow(state);
  planDismantle(state);
  planBuilds(state);
  planFleets(state);
  planSignals(state);
  planPace(state);
  planWorks(state);
}

export const _techCount = TECHS.length;
