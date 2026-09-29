import { EVENT_BY_ID } from './data/events';
import { STRUCTURE_BY_ID } from './data/structures';
import { TECHS } from './data/techs';
import { WORK_BY_ID } from './data/works';
import { logTurnLength } from './eras';
import { turnStep } from './sim/flare';
import { sourceLight, vitalityLoss } from './physics';
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
import { project } from './sim/projection';
import { availableTechs, techCost } from './sim/research';
import { canSettle } from './sim/fleets';
import { colonies, distLy, eraIndex, hasTech, swarmSeenAt, threadTotals } from './sim/util';
import type { Body, Colony, GameState, ThreadId } from './types';

// An autoplayer. It powers the balance harness, and can later back an in-game advisor.

export type Strategy = 'competent' | 'passive';

const TECH_PRIORITY = [
  'energy_storage', 'magnetospherics', 'the_long_record', 'orbital_collectors', 'survey_optics', 'mind_substrate', 'fusion_drives', 'hardy_lineages',
  'subterranean_cities', 'orbital_industry', 'fusion', 'upload', 'cold_sleep', 'slow_instancing', 'ember_harvest', 'orbital_defense', 'dyson_swarms',
  'last_light_protocols', 'reversible_logic', 'hibernation_protocols', 'deep_listening', 'hunger_studies', 'magnetic_sails', 'comet_shepherding', 'assembly_of_threads',
  'horizon_physics', 'accretion_engines', 'proton_question', 'deep_mantle', 'catalyzed_drives', 'mind_merging', 'halo_dynamics', 'pulsar_braking', 'hunger_lures',
  // degenerate
  'cold_computation', 'glacial_cognition', 'relativistic_arks', 'deep_time_protocols', 'baryon_decay_harvest', 'leptonic_computation', 'penrose_process',
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

function planBuilds(state: GameState) {
  const civ = state.civ;
  const mods = computeMods(state);
  const cap = reserveCapacity(state, mods);
  const net = civ.flags.last_energy_net ?? 0;
  const lateDusk = state.era === 'dusk' && state.eta > 13.99;
  const preDecay = state.era === 'degenerate' && state.eta > 27;
  const t = threadTotals(state);
  for (const c of colonies(state)) {
    // before the protons go, re-encoding goes to the front of the queue
    if (preDecay && state.protonsDecay && hasTech(state, 'leptonic_computation') && (c.structures.lepton_substrate ?? 0) < 2) {
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
    if (preDecay && state.protonsDecay) plan.push('lepton_substrate');
    if (state.era === 'blackhole') plan.push('penrose_harvester', 'hawking_collector', 'bastion', 'horizon_vault');
    if (state.era === 'degenerate' && state.eta > 30) plan.push('penrose_harvester', 'hawking_collector');
    if (state.era === 'dark') plan.push('preservation_array', 'horizon_siphon');
    // after the embers: burn matter (it is going anyway), feed black holes, catch the decay
    if (state.era === 'degenerate' && light < 0.3) {
      if (state.protonsDecay && state.eta > 29) plan.push('decay_harvester');
      if (civ.matter > 60) plan.push('accretion_engine', 'fusion_plant');
    }
    if (energyFirst) {
      if (light > 0.3) plan.push('dyson_swarm', 'orbital_collector', 'ember_collector', 'solar_array');
      plan.push('disk_skimmer', 'accretion_engine', 'pulsar_brake', 'geothermal_tap', 'fusion_plant', 'decay_harvester');
    }
    // its star has died: light Orbital Lamps while there is still life to keep
    if (state.era === 'dusk' && b.vitality >= 0.2 && vitalityLoss(state, b, c).freeze > 0) plan.unshift('orbital_lamps');
    if (b.traits.includes('homeworld') && state.era === 'dusk') plan.push('mag_shield', 'comet_shepherd', 'core_stimulator');
    if (c.pops.kin >= capc.kin - 1 && state.era === 'dusk') plan.push('warrens', 'habitat_dome');
    if (hasTech(state, 'mind_substrate') && c.pops.echoes >= capc.echoes - 1) plan.push('substrate_core');
    if (hasTech(state, 'cold_computation') && c.pops.coldminds >= capc.coldminds - 1) plan.unshift('cold_vault');
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
  // late in the Dusk, look ahead: dark-matter embers and black holes will be all that is left
  if (state.era === 'dusk' && state.eta > 13.99 && (sys.primary.halo || sys.primary.kind === 'black_hole')) s += 2.5;
  if (sys.special === 'core' && eraIndex(state.era) >= 1) s += 4;
  if (eraIndex(state.era) >= 2 && (sys.primary.kind === 'black_hole' || sys.primary.kind === 'smbh')) s += 2 + Math.min(6, sys.primary.spin / 200);
  // matter will dissolve: the future is at the black holes
  if (state.era === 'degenerate' && state.protonsDecay && state.eta > 24 && (sys.primary.kind === 'black_hole' || sys.primary.kind === 'smbh')) s += 10;
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
        .filter((s) => !s.gone && !swarmSeenAt(state, s.id) && !Object.values(state.fleets).some((o) => o.to === s.id))
        .sort((a, b) => distLy(here, a) - distLy(here, b))[0];
      if (target && civ.energy > 20) orderFleet(state, f.id, target.id, 'survey');
    }
  }
  // build settlers
  const nCol = colonies(state).length;
  const want = state.era === 'dusk' ? 3 + Math.floor(state.eraTurn / 12) : 4 + Math.floor(state.eraTurn / 10);
  const inFlight = Object.values(state.fleets).filter((f) => f.ships.some((s) => ['ark', 'seedcore', 'spore', 'vaultship', 'lighter'].includes(s.cls))).length + capital.queue.filter((q) => q.kind === 'ship').length;
  // only expand what the economy can carry: new settlements cost upkeep long before they pay
  const pr = project(state);
  const netNow = pr.energyIn - pr.energyOut;
  const affordable = netNow > 2 + nCol * 1.5 && civ.energy > reserveCapacity(state, computeMods(state)) * 0.4;
  const atHole = colonies(state).some((c) => ['black_hole', 'smbh'].includes(state.systems[c.systemId].primary.kind));
  const needHole = state.era === 'degenerate' && state.protonsDecay && state.eta > 22 && !atHole && inFlight === 0 && civ.matter > 80;
  if ((affordable || needHole) && nCol + inFlight < want + (needHole ? 1 : 0) && (capital.structures.shipyard ?? 0) > 0 && capital.queue.length < 3) {
    const opts = state.era === 'dusk' ? ['seedcore', 'ark', 'spore'] : ['vaultship', 'seedcore', 'spore'];
    if (eraIndex(state.era) >= 2) opts.unshift('vaultship');
    for (const k of opts) if (!queueBuild(state, capital.id, 'ship', k)) break;
  }
  const lighterBusy = Object.values(state.fleets).some((f) => f.ships.some((x) => x.cls === 'lighter')) || capital.queue.some((q) => q.key === 'lighter');
  const homeCols = colonies(state).filter((c) => c.systemId === capital.systemId).length;
  // only worth a Lighter where the world itself still has room to live
  const freeHere = home.bodies.some((bid) => {
    const b = state.bodies[bid];
    return b && !b.colonyId && !canSettle(state, b, 'kin') && b.habitability * b.vitality > 0.05;
  });
  if (state.era === 'dusk' && affordable && !lighterBusy && freeHere && homeCols < 2 && capital.pops.kin >= 6 && capital.queue.length < 3) queueBuild(state, capital.id, 'ship', 'lighter');
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
