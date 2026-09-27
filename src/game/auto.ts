import { EVENT_BY_ID } from './data/events';
import { STRUCTURE_BY_ID } from './data/structures';
import { TECHS } from './data/techs';
import { WORK_BY_ID } from './data/works';
import { logTurnLength, stepTime } from './eras';
import { sourceLight } from './physics';
import {
  answerEvent,
  answerSignal,
  buildCost,
  charterAvailable,
  convert,
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
import { availableTechs, techCost } from './sim/research';
import { canSettle } from './sim/fleets';
import { colonies, distLy, eraIndex, hasTech, threadTotals } from './sim/util';
import type { Body, Colony, GameState, ThreadId } from './types';

// An autoplayer. It powers the balance harness, and can later back an in-game advisor.

export type Strategy = 'competent' | 'passive';

const TECH_PRIORITY = [
  'energy_storage', 'magnetospherics', 'the_long_record', 'orbital_collectors', 'survey_optics', 'mind_substrate', 'fusion_drives', 'hardy_lineages',
  'subterranean_cities', 'orbital_industry', 'fusion', 'upload', 'cold_sleep', 'slow_instancing', 'orbital_defense', 'dyson_swarms', 'deep_listening',
  'reversible_logic', 'hibernation_protocols', 'hunger_studies', 'magnetic_sails', 'comet_shepherding', 'last_light_protocols', 'assembly_of_threads',
  'horizon_physics', 'accretion_engines', 'proton_question', 'deep_mantle', 'catalyzed_drives', 'mind_merging', 'halo_dynamics', 'pulsar_braking', 'hunger_lures',
  'ember_harvest',
  // degenerate
  'cold_computation', 'glacial_cognition', 'deep_time_protocols', 'leptonic_computation', 'deep_storage', 'brown_dwarf_mining', 'accretion_modelling', 'gravitic_semaphore', 'burst_capture',
  'horizon_storage', 'abyssal_thought', 'great_decay_protocols', 'baryon_decay_harvest', 'quickening', 'relativistic_arks',
  'garden_arks', 'aegis_lattices', 'command_language',
  // black hole
  'bastion_architecture', 'penrose_process', 'hawking_capture', 'horizon_cognition', 'error_correction', 'hawking_patience', 'last_horizon_protocols',
  'conformal_mathematics', 'archive_theory', 'total_confluence', 'ultimate_slowness',
  // dark
  'asymptotic_mind', 'horizon_siphon', 'garden_of_embers',
];

function pickResearch(state: GameState) {
  if (state.civ.researching) return;
  const avail = new Set(availableTechs(state).map((t) => t.id));
  const next = TECH_PRIORITY.find((id) => avail.has(id));
  if (next) setResearch(state, next);
  else {
    const cheapest = [...avail].filter((id) => !TECHS.find((t) => t.id === id)?.taint).sort((a, b) => techCost(state, a) - techCost(state, b))[0];
    if (cheapest) setResearch(state, cheapest);
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
    if (state.civ.matter < cost.matter + 10 || state.civ.energy < cost.energy + 20) continue;
    if (!queueBuild(state, c.id, 'structure', id)) return true;
  }
  return false;
}

function planBuilds(state: GameState) {
  const civ = state.civ;
  const mods = computeMods(state);
  const cap = reserveCapacity(state, mods);
  const net = civ.flags.last_energy_net ?? 0;
  const lateDusk = state.era === 'dusk' && state.eta > 13.99;
  const preDecay = state.era === 'degenerate' && state.eta > 27;
  const t = threadTotals(state);
  for (const c of colonies(state)) {
    // before the protons go, re-encoding comes first
    if (preDecay && state.protonsDecay && hasTech(state, 'leptonic_computation') && (c.structures.lepton_substrate ?? 0) < 2) {
      if (!c.queue.some((q) => q.key === 'lepton_substrate')) {
        while (c.queue.length) removeQueued(state, c.id, c.queue[0].uid);
        tryBuild(state, c, ['lepton_substrate']);
      }
      if (c.queue[0]?.key === 'lepton_substrate') rushBuild(state, c.id);
      continue;
    }
    if (c.queue[0] && civ.matter > 600) rushBuild(state, c.id);
    if (c.queue.length >= 2) continue;
    const b = state.bodies[c.bodyId];
    const capc = capacity(state, c, mods);
    const light = lightAt(state, c);
    const energyFirst = net < 3 || civ.energy < cap * 0.25;
    const plan: string[] = [];
    if (preDecay && state.protonsDecay) plan.push('lepton_substrate');
    if (state.era === 'blackhole') plan.push('bastion', 'penrose_harvester', 'hawking_collector', 'horizon_vault');
    if (state.era === 'dark') plan.push('preservation_array', 'horizon_siphon');
    if (energyFirst) {
      if (light > 0.3) plan.push('dyson_swarm', 'orbital_collector', 'ember_collector', 'solar_array');
      plan.push('disk_skimmer', 'accretion_engine', 'pulsar_brake', 'geothermal_tap', 'fusion_plant', 'decay_harvester');
    }
    if (b.traits.includes('homeworld') && state.era === 'dusk') plan.push('mag_shield', 'comet_shepherd', 'core_stimulator');
    if (c.pops.kin >= capc.kin - 1 && state.era === 'dusk') plan.push('warrens', 'habitat_dome');
    if (hasTech(state, 'mind_substrate') && c.pops.echoes >= capc.echoes - 1) plan.push('substrate_core');
    if (hasTech(state, 'cold_computation') && c.pops.coldminds >= capc.coldminds - 1) plan.push('cold_vault');
    if (lateDusk && c.pops.kin > 0) plan.push('cryo_hall');
    if (state.era === 'dusk' && state.eta > 13.985) plan.push('ember_collector', 'fusion_plant', 'accretion_engine', 'reserve_vault');
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
  if (state.era === 'degenerate' && (sys.primary.kind === 'black_hole' || sys.primary.kind === 'smbh')) s += 3;
  if (state.era === 'degenerate' && sys.primary.halo) s += 2;
  if (sys.special === 'core' && eraIndex(state.era) >= 1) s += 4;
  if (eraIndex(state.era) >= 2 && (sys.primary.kind === 'black_hole' || sys.primary.kind === 'smbh')) s += 2 + Math.min(6, sys.primary.spin / 200);
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
    const settler = f.ships.find((s) => ['ark', 'seedcore', 'spore', 'vaultship'].includes(s.cls));
    if (settler) {
      const thread: ThreadId = settler.cls === 'ark' ? 'kin' : settler.cls === 'spore' ? 'lattice' : settler.cls === 'vaultship' ? 'coldminds' : 'echoes';
      let best: Body | null = null;
      let bestS = 0;
      for (const [sid, k] of Object.entries(civ.known)) {
        if (!k) continue;
        const sys = state.systems[sid];
        const d = distLy(here, sys);
        for (const bid of sys.bodies) {
          const b = state.bodies[bid];
          const s = settleScore(state, b, thread) / (1 + d / (state.era === 'dusk' ? 40 : 1e6));
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
        .filter((s) => !s.gone && !Object.values(state.fleets).some((o) => o.to === s.id))
        .sort((a, b) => distLy(here, a) - distLy(here, b))[0];
      if (target && civ.energy > 20) orderFleet(state, f.id, target.id, 'survey');
    }
  }
  // build settlers
  const nCol = colonies(state).length;
  const want = state.era === 'dusk' ? 3 + Math.floor(state.eraTurn / 12) : 4 + Math.floor(state.eraTurn / 10);
  const inFlight = Object.values(state.fleets).filter((f) => f.ships.some((s) => ['ark', 'seedcore', 'spore', 'vaultship'].includes(s.cls))).length + capital.queue.filter((q) => q.kind === 'ship').length;
  if (nCol + inFlight < want && (capital.structures.shipyard ?? 0) > 0 && capital.queue.length < 3) {
    const opts = state.era === 'dusk' ? ['seedcore', 'ark', 'spore'] : ['vaultship', 'seedcore', 'spore'];
    if (eraIndex(state.era) >= 2) opts.unshift('vaultship');
    for (const k of opts) if (!queueBuild(state, capital.id, 'ship', k)) break;
  }
  if (state.eraTurn % 25 === 3 && Object.values(state.fleets).filter((f) => f.ships.some((s) => s.cls === 'probe')).length < 2) queueBuild(state, capital.id, 'ship', 'probe');
  void home;
}

function planThreads(state: GameState) {
  const mods = computeMods(state);
  const step = stepTime(state.era, state.years, state.eta, state.civ.pace, state.settings.length);
  const logL = logTurnLength(step);
  const kinStrain = strainFor('kin', logL, mods).m;
  const echoStrain = strainFor('echoes', logL, mods).m;
  for (const c of colonies(state)) {
    for (let i = 0; i < 2; i++) {
      if (kinStrain > 2 && c.pops.kin > 1) {
        if (convert(state, c.id, 'upload')) convert(state, c.id, 'freeze');
      }
      if (echoStrain > 1 && c.pops.echoes > 0) convert(state, c.id, 'cool');
      if (state.era === 'dusk' && state.eta > 13.995 && c.pops.kin > 0) convert(state, c.id, 'freeze');
    }
  }
}

function planCharters(state: GameState) {
  const order = ['open_archives', 'right_to_stop', 'thread_parity', 'merge_consent', 'sanctuary', 'the_long_watch', 'lattice_compact'];
  for (const id of order) if (!charterAvailable(state, id)) enactCharter(state, id);
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

function planEvents(state: GameState) {
  for (const p of [...state.pending]) {
    const def = EVENT_BY_ID[p.defId];
    if (!def) continue;
    let done = false;
    for (let i = 0; i < def.choices.length && !done; i++) {
      const ch = def.choices[i];
      if (ch.ok && !ch.ok(state, p.data)) continue;
      if (/Taint|Devour|Strip/.test(ch.label + (ch.hint ?? ''))) continue;
      done = answerEvent(state, p.uid, i).ok;
    }
    if (!done) answerEvent(state, p.uid, def.choices.length - 1);
  }
}

function planPace(state: GameState) {
  const civ = state.civ;
  const mods = computeMods(state);
  const cap = reserveCapacity(state, mods);
  const net = civ.flags.last_energy_net ?? 0;
  if (civ.energy >= cap * 0.95 && net > cap * 0.05 && civ.pace < mods.paceMax) setPace(state, civ.pace + 1);
  else if ((net < 0 && civ.energy < cap * 0.2) && civ.pace > mods.paceMin) setPace(state, civ.pace - 1);
  else if (civ.pace > 0 && net < 0) setPace(state, civ.pace - 1);
  else if (civ.pace < 0 && net > 0 && civ.energy > cap * 0.5) setPace(state, civ.pace + 1);
}

function planWorks(state: GameState) {
  const civ = state.civ;
  if (civ.work) return;
  for (const id of ['aeon_seed', 'hibernal_cascade', 'archive_of_everything', 'confluence', 'garden_of_embers']) {
    const w = WORK_BY_ID[id];
    if (!hasTech(state, w.tech) || !w.eras.includes(state.era)) continue;
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
  planThreads(state);
  planBuilds(state);
  planFleets(state);
  planSignals(state);
  planPace(state);
  planWorks(state);
}

export const _techCount = TECHS.length;
