import { CHARTER_BY_ID, CHARTERS } from '../data/charters';
import { SHIP_BY_ID, SHIPS, type ShipDef } from '../data/ships';
import { STRUCTURE_BY_ID, STRUCTURES, type StructureDef } from '../data/structures';
import { WORK_BY_ID } from '../data/works';
import type { Colony, Focus, GameState } from '../types';
import { capacity } from './economy';
import { workRequirementMet } from './endings';
import { resolveEvent } from './events';
import { autoExplore, canSurvey, isWarFleet, orderMove } from './fleets';
import { absorbSwarm, tameSwarm } from './hunger';
import { gesture, resolveMindSignal } from './minds';
import { computeMods } from './mods';
import { completeTech, techAvailable, techCost } from './research';
import { devourSurvivor, raidSurvivor, requestAid, resolveSurvivorSignal, seizeSurvivor } from './survivors';
import { eraIndex, hasCharter, hasTech, log, savableName, uid } from './util';

export type ActionResult = string | null; // error message or null on success

/** In ages without ordinary matter, construction is paid in energy instead. */
export function matterIsEnergy(state: GameState): boolean {
  return state.protonsDecay && eraIndex(state.era) >= 2;
}

export function structureCheck(state: GameState, c: Colony, d: StructureDef): string | null {
  if (d.tech && !hasTech(state, d.tech)) return 'Not yet researched.';
  if (eraIndex(d.era) > eraIndex(state.era)) return 'Not in this age.';
  const b = state.bodies[c.bodyId];
  const sys = state.systems[c.systemId];
  const have = (c.structures[d.id] ?? 0) + c.queue.filter((q) => q.key === d.id).length;
  if (have >= d.max) return `At most ${d.max} here.`;
  // structures that live in orbit around the star can be built from anywhere in the system
  if (d.bodies && !d.bodies.includes(b.kind) && !d.bodies.includes('deep')) return `Must be built on ${d.bodies.join(' or ')}.`;
  if (d.notBodies && d.notBodies.includes(b.kind)) return 'Cannot be built here.';
  if (d.primaries && !d.primaries.includes(sys.primary.kind)) return 'Needs a different kind of star or remnant.';
  if (d.habitable && b.habitability < 0.3) return 'Only on a living world.';
  if (d.id === 'relic_dig' && !(b.relic && b.relic.state !== 'hidden')) return 'Needs ruins.';
  if (d.id === 'disk_skimmer' && !(sys.primary.rekindle && sys.primary.rekindle > 0)) return 'Needs a world feeding its dead star.';
  if (d.systemUnique) {
    for (const o of Object.values(state.colonies)) {
      if (o.systemId !== c.systemId) continue;
      if ((o.structures[d.id] ?? 0) > 0 || o.queue.some((q) => q.key === d.id)) return 'Only one per system.';
    }
  }
  if (matterIsEnergy(state) && d.matter > 0 && d.era !== 'blackhole' && d.era !== 'dark' && !d.decayProof && !d.cap && !d.reserveCap && !d.burstCap && !d.continuityMult) {
    if (d.energy && (d.energy.mode === 'fusion' || d.energy.mode === 'accretion')) return 'There is no matter left to burn.';
  }
  return null;
}

export function buildCost(state: GameState, d: StructureDef | ShipDef, isShip: boolean): { industry: number; matter: number; energy: number } {
  let industry = d.cost;
  let matter = d.matter;
  if (isShip && hasCharter(state, 'wardens_oath') && (d.id === 'warden' || d.id === 'aegis')) {
    industry *= 0.75;
    matter *= 0.75;
  }
  if (isShip && hasCharter(state, 'expansion_mandate')) industry *= 0.8;
  if (matterIsEnergy(state)) return { industry: Math.round(industry), matter: 0, energy: Math.round(matter * 1.5) };
  return { industry: Math.round(industry), matter: Math.round(matter), energy: 0 };
}

export function buildableStructures(state: GameState, c: Colony): { def: StructureDef; error: string | null }[] {
  return STRUCTURES.filter((d) => !d.tech || hasTech(state, d.tech) || eraIndex(d.era) <= eraIndex(state.era))
    .map((def) => ({ def, error: structureCheck(state, c, def) }))
    .filter((x) => x.error !== 'Not yet researched.' && x.error !== 'Not in this age.');
}

export function buildableShips(state: GameState, c: Colony): { def: ShipDef; error: string | null }[] {
  const hasYard = (c.structures.shipyard ?? 0) > 0;
  return SHIPS.filter((s) => !s.tech || hasTech(state, s.tech)).map((def) => ({
    def,
    error: !hasYard ? 'Needs a Shipyard.' : def.crew && c.pops.kin < def.crew + 1 ? `Needs at least ${def.crew + 1} Kin here.` : null,
  }));
}

export function queueBuild(state: GameState, colonyId: string, kind: 'structure' | 'ship', key: string): ActionResult {
  const c = state.colonies[colonyId];
  if (!c) return 'No such settlement.';
  const def = kind === 'structure' ? STRUCTURE_BY_ID[key] : SHIP_BY_ID[key];
  if (!def) return 'Unknown blueprint.';
  if (kind === 'structure') {
    const err = structureCheck(state, c, def as StructureDef);
    if (err) return err;
  } else {
    if (!((c.structures.shipyard ?? 0) > 0)) return 'Needs a Shipyard.';
    const s = def as ShipDef;
    if (s.tech && !hasTech(state, s.tech)) return 'Not yet researched.';
    if (s.crew && c.pops.kin < s.crew + 1) return `Needs at least ${s.crew + 1} Kin here: ${s.crew} of them will go.`;
  }
  const cost = buildCost(state, def, kind === 'ship');
  if (state.civ.matter < cost.matter) return `Needs ${cost.matter} matter.`;
  if (state.civ.energy < cost.energy) return `Needs ${cost.energy} energy.`;
  if (c.queue.length >= 6) return 'The queue is full.';
  state.civ.matter -= cost.matter;
  state.civ.energy -= cost.energy;
  c.queue.push({ uid: uid(state, 'q'), kind, key, progress: 0, cost: cost.industry });
  return null;
}

/** Emergency shifts: finish the first project in a queue now, paying for the remaining work. */
export function rushCost(state: GameState, colonyId: string): { matter: number; energy: number } | null {
  const c = state.colonies[colonyId];
  const q = c?.queue[0];
  if (!q) return null;
  const left = Math.max(0, q.cost - q.progress);
  if (matterIsEnergy(state)) return { matter: 0, energy: Math.ceil(left * 1.2) };
  return { matter: Math.ceil(left * 1.5), energy: Math.ceil(left * 0.3) };
}

export function rushBuild(state: GameState, colonyId: string): ActionResult {
  const c = state.colonies[colonyId];
  const cost = rushCost(state, colonyId);
  if (!c || !cost) return 'Nothing to rush.';
  if (state.civ.matter < cost.matter || state.civ.energy < cost.energy) return `Rushing needs ${cost.matter ? `${cost.matter} matter and ` : ''}${cost.energy} energy.`;
  if (c.flags_rushed === state.turn) return 'Only one rush per settlement per turn.';
  state.civ.matter -= cost.matter;
  state.civ.energy -= cost.energy;
  c.queue[0].progress = c.queue[0].cost - 0.001;
  c.flags_rushed = state.turn;
  state.civ.dissent = Math.min(100, state.civ.dissent + 1.5);
  return null;
}

export function removeQueued(state: GameState, colonyId: string, qid: string): ActionResult {
  const c = state.colonies[colonyId];
  if (!c) return 'No such settlement.';
  const i = c.queue.findIndex((q) => q.uid === qid);
  if (i < 0) return 'Not in the queue.';
  const q = c.queue[i];
  const def = q.kind === 'structure' ? STRUCTURE_BY_ID[q.key] : SHIP_BY_ID[q.key];
  if (def) {
    const cost = buildCost(state, def, q.kind === 'ship');
    state.civ.matter += cost.matter * 0.5;
    state.civ.energy += cost.energy * 0.5;
  }
  c.queue.splice(i, 1);
  return null;
}

export function moveQueued(state: GameState, colonyId: string, qid: string, dir: -1 | 1): ActionResult {
  const c = state.colonies[colonyId];
  if (!c) return 'No such settlement.';
  const i = c.queue.findIndex((q) => q.uid === qid);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= c.queue.length) return null;
  [c.queue[i], c.queue[j]] = [c.queue[j], c.queue[i]];
  return null;
}

export function setFocus(state: GameState, colonyId: string, focus: Focus): ActionResult {
  const c = state.colonies[colonyId];
  if (!c) return 'No such settlement.';
  c.focus = focus;
  return null;
}

export function toggleOverdrive(state: GameState, colonyId: string): ActionResult {
  const c = state.colonies[colonyId];
  if (!c) return 'No such settlement.';
  if (!hasCharter(state, 'overdrive_protocols')) return 'Enact the Overdrive Protocols charter first.';
  c.overdrive = !c.overdrive;
  return null;
}

export function setResearch(state: GameState, techId: string | null): ActionResult {
  if (techId === null) {
    state.civ.researching = null;
    return null;
  }
  if (!techAvailable(state, techId)) return 'Not available.';
  state.civ.researching = techId;
  // insight carried over (overflow, finds, idle study) goes straight into the new project
  const bank = state.civ.flags.insight_bank ?? 0;
  if (bank > 0) {
    state.civ.research[techId] = (state.civ.research[techId] ?? 0) + bank;
    state.civ.flags.insight_bank = 0;
  }
  // already paid for: it is done now, and what is left stays stored for the next choice
  const cost = techCost(state, techId);
  if ((state.civ.research[techId] ?? 0) >= cost) {
    state.civ.flags.insight_bank = (state.civ.research[techId] ?? 0) - cost;
    completeTech(state, techId, 'stored');
  }
  return null;
}

export function setPace(state: GameState, pace: number): ActionResult {
  const m = computeMods(state);
  if (pace > m.paceMax || pace < m.paceMin) return 'That pace is beyond us for now.';
  state.civ.pace = pace;
  return null;
}

export function setDormant(state: GameState, dormant: boolean): ActionResult {
  state.civ.dormant = dormant;
  if (!dormant) state.civ.sleepTurns = 0;
  return null;
}

export function longSleep(state: GameState, turns: number): ActionResult {
  if (!hasTech(state, 'hibernation_protocols')) return 'Research Hibernation Protocols first.';
  state.civ.sleepTurns = Math.max(1, Math.min(20, Math.round(turns)));
  state.civ.dormant = true;
  return null;
}

export function charterAvailable(state: GameState, id: string): string | null {
  const d = CHARTER_BY_ID[id];
  if (!d) return 'Unknown charter.';
  if (hasCharter(state, id)) return 'Already enacted.';
  if (!hasTech(state, 'the_long_record')) return 'Research The Long Record to begin writing Charters.';
  if (eraIndex(d.era) > eraIndex(state.era)) return 'Not in this age.';
  if (d.tech && !hasTech(state, d.tech)) return 'Needs research.';
  if (d.requiresCharter && !hasCharter(state, d.requiresCharter)) return `Requires ${CHARTER_BY_ID[d.requiresCharter]?.name}.`;
  if (d.excludes?.some((x) => hasCharter(state, x))) return 'Contradicts an existing charter.';
  if (state.civ.accord < d.cost) return `Needs ${d.cost} Accord.`;
  const limit = hasTech(state, 'assembly_of_threads') ? 9 : 5;
  if (state.civ.charters.filter((c) => !CHARTER_BY_ID[c]?.dark).length >= limit && !d.dark) return 'The book is full until the Assembly of Threads.';
  return null;
}

export function enactCharter(state: GameState, id: string): ActionResult {
  const err = charterAvailable(state, id);
  if (err) return err;
  const d = CHARTER_BY_ID[id];
  const civ = state.civ;
  civ.accord -= d.cost;
  civ.charters.push(id);
  for (const [t, v] of Object.entries(d.stances)) civ.standing[t as keyof typeof civ.standing] = Math.max(0, Math.min(100, civ.standing[t as keyof typeof civ.standing] + (v ?? 0)));
  if (d.resolve) civ.resolve = Math.max(0, Math.min(100, civ.resolve + d.resolve));
  if (d.dissent) civ.dissent = Math.max(0, Math.min(100, civ.dissent + d.dissent));
  if (d.taint) civ.taint = Math.min(100, civ.taint + d.taint);
  if (id === 'consume_the_dead' || id === 'salvage_the_dead') state.gfe = Math.max(0.05, state.gfe - 0.01);
  // stripping what is already dead and in reach pays at once
  if (id === 'salvage_the_dead') civ.matter += 40;
  if (id === 'consume_the_dead') civ.matter += hasCharter(state, 'salvage_the_dead') ? 80 : 120;
  log(state, `Charter enacted: ${d.name}.`, d.dark ? 'bad' : 'event');
  return null;
}

export type Conversion = 'upload' | 'merge' | 'cool' | 'freeze' | 'thaw';

export function convert(state: GameState, colonyId: string, kind: Conversion): ActionResult {
  const c = state.colonies[colonyId];
  if (!c) return 'No such settlement.';
  const civ = state.civ;
  const mods = computeMods(state);
  const cap = capacity(state, c, mods);
  switch (kind) {
    case 'upload':
      if (!(c.structures.upload_clinic ?? 0)) return 'Needs an Upload Clinic.';
      if (c.pops.kin < 1) return 'No Kin here.';
      if (c.pops.echoes >= cap.echoes) return 'No free substrate.';
      if (civ.energy < 6) return 'Needs 6 energy.';
      civ.energy -= 6;
      c.pops.kin--;
      c.pops.echoes++;
      if (hasCharter(state, 'sanctity_of_flesh')) civ.accord = Math.max(0, civ.accord - 4);
      else if (!hasCharter(state, 'upload_at_death')) civ.standing.kin = Math.max(0, civ.standing.kin - 0.7);
      return null;
    case 'merge':
      if (!(c.structures.confluence_node ?? 0)) return 'Needs a Confluence Node.';
      if (c.pops.echoes < 2) return 'Needs two Echoes.';
      if (c.pops.chorus >= cap.chorus) return 'The Chorus here is full.';
      if (civ.energy < 8) return 'Needs 8 energy.';
      if (hasCharter(state, 'merge_consent') && (civ.flags.merge_turn ?? -1) === state.turn) return 'Under Merge Consent, only one merge per turn.';
      civ.energy -= 8;
      c.pops.echoes -= 2;
      c.pops.chorus++;
      civ.flags.merge_turn = state.turn;
      if (!hasCharter(state, 'merge_consent')) civ.standing.echoes = Math.max(0, civ.standing.echoes - 1);
      if (hasCharter(state, 'sanctity_of_flesh')) civ.accord = Math.max(0, civ.accord - 4);
      return null;
    case 'cool':
      if (!(c.structures.cold_vault ?? 0) && !(c.structures.lepton_substrate ?? 0) && !(c.structures.bastion ?? 0)) return 'Needs a Cold Vault.';
      if (c.pops.echoes < 1) return 'Needs an Echo.';
      if (c.pops.coldminds >= cap.coldminds) return 'No room in the vaults.';
      // cooling a mind is how a starving civilization saves itself: it costs nothing but the self it was
      c.pops.echoes--;
      c.pops.coldminds++;
      return null;
    case 'freeze':
      if (c.pops.kin < 1) return 'No Kin here.';
      if (c.cryo >= cap.cryo) return 'No free cryo berths.';
      c.pops.kin--;
      c.cryo++;
      return null;
    case 'thaw':
      if (c.cryo < 1) return 'No one is sleeping here.';
      if (c.pops.kin >= cap.kin) return 'No room for them awake.';
      c.cryo--;
      c.pops.kin++;
      return null;
  }
  return null;
}

export function orderFleet(state: GameState, fleetId: string, systemId: string, order: 'move' | 'colonize' | 'survey' | 'tame' = 'move', bodyId?: string): ActionResult {
  const err = orderMove(state, fleetId, systemId, order, bodyId);
  // an order by hand ends standing orders
  if (!err && state.fleets[fleetId]) state.fleets[fleetId].auto = undefined;
  return err;
}

/** Set a survey ship exploring by itself (it sets out at once if it can), or call it off. */
export function setAutoExplore(state: GameState, fleetId: string, on: boolean): ActionResult {
  const f = state.fleets[fleetId];
  if (!f) return 'No such fleet.';
  if (on && !canSurvey(f)) return 'Only survey ships can explore by themselves.';
  f.auto = on ? 'explore' : undefined;
  if (on) {
    if (f.at) f.order = 'idle';
    autoExplore(state, computeMods(state));
    if (f.at && !f.to && f.auto) log(state, `${f.name} will explore as soon as the reserve allows.`, 'info', f.at);
  }
  return null;
}

export function disbandFleet(state: GameState, fleetId: string): ActionResult {
  const f = state.fleets[fleetId];
  if (!f) return 'No such fleet.';
  if (!f.at) return 'Wait until it arrives.';
  state.civ.matter += f.ships.reduce((a, s) => a + (SHIP_BY_ID[s.cls]?.matter ?? 0) * 0.4, 0);
  delete state.fleets[fleetId];
  return null;
}

export function placeBeacon(state: GameState, fleetId: string): ActionResult {
  if (!hasTech(state, 'hunger_lures')) return 'Research Decoy Beacons first.';
  const f = state.fleets[fleetId];
  if (!f || !f.at) return 'The fleet must be stationed.';
  const sys = state.systems[f.at];
  if (Object.values(state.colonies).some((c) => c.systemId === sys.id)) return 'Place beacons in empty systems, away from our people.';
  if (state.civ.energy < 30) return 'A beacon needs 30 energy.';
  state.civ.energy -= 30;
  sys.beacon = true;
  log(state, `A decoy beacon burns at ${sys.name}.`, 'info', sys.id);
  return null;
}

export function tame(state: GameState, swarmId: string): ActionResult {
  if (!hasTech(state, 'command_language')) return 'Research the Command Language first.';
  return tameSwarm(state, swarmId);
}

export function absorb(state: GameState, swarmId: string, colonyId: string): ActionResult {
  return absorbSwarm(state, swarmId, colonyId);
}

export function answerSignal(state: GameState, sigUid: string, choice: string): ActionResult {
  const s = state.signals.find((x) => x.uid === sigUid);
  if (!s) return 'No such message.';
  if (s.from === 'slow' || s.from === 'dark') return resolveMindSignal(state, sigUid, choice);
  return resolveSurvivorSignal(state, sigUid, choice);
}

export function makeGesture(state: GameState, answer: 'continue' | 'mirror' | 'resonance' | 'silence'): ActionResult {
  return gesture(state, answer);
}

export function seize(state: GameState, survivorId: string): ActionResult {
  return seizeSurvivor(state, survivorId);
}

/** Raid the civilization whose star this warship is parked at. Returns an error, or what happened. */
export function raid(state: GameState, fleetId: string): string | { ok: boolean; text: string } {
  return raidSurvivor(state, fleetId);
}

/** Ask a civilization for energy; the answer comes back after the light-speed round trip. */
export function askForAid(state: GameState, survivorId: string): ActionResult {
  return requestAid(state, survivorId);
}

export function devour(state: GameState, survivorId: string): ActionResult {
  return devourSurvivor(state, survivorId);
}

export function sendAid(state: GameState, survivorId: string, energy: number): ActionResult {
  const sv = state.survivors[survivorId];
  if (!sv || !sv.alive) return 'They are gone.';
  if (!sv.contact) return 'We have not made contact.';
  if (state.civ.energy < energy) return 'Not enough energy.';
  state.civ.energy -= energy;
  sv.health = Math.min(1, sv.health + energy / 400);
  sv.disposition = Math.min(100, sv.disposition + energy / 4);
  sv.aidGiven += energy;
  log(state, `We sent ${energy} energy to ${sv.name}.`, 'good');
  return null;
}

export function startWork(state: GameState, workId: string): ActionResult {
  const w = WORK_BY_ID[workId];
  if (!w) return 'Unknown Great Work.';
  if (!hasTech(state, w.tech)) return 'Needs research.';
  if (!w.eras.includes(state.era)) return 'Not in this age.';
  if (state.civ.taint > w.maxTaint) return 'What we have become cannot do this.';
  if (state.civ.work === workId) return null;
  if ((state.civ.works[workId] ?? 0) === 0) {
    if (state.civ.energy < w.energy) return `Beginning it needs ${w.energy} energy.`;
    state.civ.energy -= w.energy;
    state.civ.works[workId] = 1;
  }
  state.civ.work = workId;
  if (!workRequirementMet(state, workId)) log(state, `${w.name} begun. It cannot be finished until: ${w.requirement}`, 'info');
  else log(state, `${w.name} begun.`, 'era');
  return null;
}

export function answerEvent(state: GameState, eventUid: string, choice: number) {
  return resolveEvent(state, eventUid, choice);
}

export function renameColony(state: GameState, colonyId: string, name: string): ActionResult {
  const c = state.colonies[colonyId];
  if (!c) return 'No such settlement.';
  c.name = savableName(name.slice(0, 32)) || c.name;
  return null;
}

export const ALL_CHARTERS = CHARTERS;

/**
 * Give a stationed fleet a standing order. fortify: warships dig in and defend this system
 * (they count double against swarms, and turn raiders away from the capital). hold: park on
 * purpose, so the game stops asking. idle: back to waiting for orders.
 */
export function standFleet(state: GameState, fleetId: string, order: 'fortify' | 'hold' | 'idle'): ActionResult {
  const f = state.fleets[fleetId];
  if (!f || !f.at) return 'Only a fleet that has arrived can do that.';
  if (order === 'fortify' && !isWarFleet(f)) return 'Only warships can fortify.';
  f.order = order;
  f.auto = undefined;
  if (order === 'fortify') log(state, `${f.name} has fortified ${state.systems[f.at]?.name ?? 'its station'}.`, 'info', f.at);
  return null;
}
