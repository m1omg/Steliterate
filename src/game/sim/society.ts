import { DEMANDS } from '../data/threads';
import type { GameState, ThreadId } from '../types';
import { THREADS } from '../types';
import { capacity } from './economy';
import { computeMods, type Mods, strainFor } from './mods';
import { clamp, colonies, hasCharter, log, popsOf, threadTotals, uid, withRng } from './util';

// Resolve is the will to go on. Dissent is how much the Threads disagree about how.
// Each conscious Thread has a demand; meeting it lifts its standing, ignoring it erodes it.

export function demandMet(state: GameState, id: string, mods: Mods, logL: number): boolean {
  const civ = state.civ;
  switch (id) {
    case 'kin_homeworld': {
      if (hasCharter(state, 'abandon_the_surface')) return true;
      const home = Object.values(state.bodies).find((b) => b.traits.includes('homeworld'));
      return !!home && !home.dissolved && home.vitality >= 0.25;
    }
    case 'kin_room':
      return colonies(state).every((c) => c.pops.kin <= capacity(state, c, mods).kin);
    case 'kin_warmth':
      return colonies(state).every((c) => c.starving === 0);
    case 'echoes_substrate': {
      let free = 0;
      for (const c of colonies(state)) free += capacity(state, c, mods).echoes - c.pops.echoes;
      return free >= 2;
    }
    case 'echoes_stop':
      return hasCharter(state, 'right_to_stop');
    case 'echoes_clock':
      return strainFor('echoes', logL, mods, -state.civ.pace).m < 1;
    case 'chorus_consent':
      return hasCharter(state, 'merge_consent');
    case 'chorus_grow':
      return (civ.flags.chorus_nodes_built ?? 0) > (civ.flags.chorus_nodes_at_demand ?? 0);
    case 'coldminds_quiet':
      return colonies(state).every((c) => !c.overdrive);
    case 'coldminds_reserve':
      return civ.energy >= (civ.flags.reserve_cap ?? 100) / 3;
    default:
      return true;
  }
}

export function updateSociety(state: GameState, logL: number, popsLost: number, starving: boolean) {
  const civ = state.civ;
  const mods = computeMods(state);
  const totals = threadTotals(state);
  const all = THREADS.reduce((a, t) => a + totals[t], 0);

  withRng(state, (rng) => {
    let unmet = 0;
    let met = 0;
    for (const t of THREADS) {
      if (t === 'lattice') {
        civ.demands[t] = null;
        continue;
      }
      if (totals[t] <= 0) {
        civ.demands[t] = null;
        continue;
      }
      // pick or rotate demands
      const options = DEMANDS.filter((d) => d.thread === t);
      if (!civ.demands[t] || (civ.flags[`demand_age_${t}`] ?? 0) > 14) {
        const d = rng.pick(options);
        civ.demands[t] = d.id;
        civ.flags[`demand_age_${t}`] = 0;
        if (d.id === 'chorus_grow') civ.flags.chorus_nodes_at_demand = civ.flags.chorus_nodes_built ?? 0;
      }
      civ.flags[`demand_age_${t}`] = (civ.flags[`demand_age_${t}`] ?? 0) + 1;
      const ok = demandMet(state, civ.demands[t]!, mods, logL);
      const share = totals[t] / Math.max(1, all);
      if (ok) {
        met++;
        civ.standing[t] = Math.min(80, civ.standing[t] + 1.2);
      } else {
        unmet++;
        civ.standing[t] -= 1.4 + share * 1.5;
      }
      // tempo strain wears a Thread down
      const s = strainFor(t, logL, mods, -state.civ.pace);
      if (s.m > 0.5) civ.standing[t] -= Math.min(3, s.m * 0.35);
      if (mods.flags.has('charter:thread_parity')) civ.standing[t] += (55 - civ.standing[t]) * 0.05;
      if (mods.flags.has('charter:sanctity_of_flesh') && t === 'kin') civ.standing[t] += 0.4;
      if (hasCharter(state, 'assembly_of_threads') || civ.techs.includes('assembly_of_threads')) civ.standing[t] += (60 - civ.standing[t]) * 0.02;
      // the other Threads resent the Lattice, and fear the Taint
      if (!mods.flags.has('charter:lattice_compact')) civ.standing[t] -= (totals.lattice / Math.max(1, all)) * 2;
      civ.standing[t] -= civ.taint / 60;
      civ.standing[t] = clamp(civ.standing[t], 0, 100);
    }

    // resolve
    let dr = 0;
    if (starving) dr -= 3;
    const population = Math.max(1, all);
    dr -= Math.min(8, (popsLost / population) * 40);
    dr -= unmet * 0.5;
    if (unmet === 0 && met > 0) dr += 1;
    if (mods.flags.has('charter:rationing')) dr -= 1;
    for (const c of colonies(state)) dr += 0.3 * (c.structures.commons ?? 0);
    const home = Object.values(state.bodies).find((b) => b.traits.includes('homeworld'));
    if (home && !hasCharter(state, 'abandon_the_surface') && state.era === 'dusk' && home.vitality < 0.2) dr -= 1;
    dr -= civ.taint / 50;
    const hardened = state.era === 'dusk' ? 0.03 : 0.05; // later minds have learned to endure
    civ.resolve = clamp(civ.resolve + dr + (50 - civ.resolve) * hardened, 0, 100);

    // dissent
    let dd = 0;
    for (const t of THREADS) {
      if (t === 'lattice' || totals[t] <= 0) continue;
      const share = totals[t] / Math.max(1, all);
      if (civ.standing[t] < 50) dd += ((50 - civ.standing[t]) / 50) * share * 4;
    }
    if (starving) dd += 2;
    dd += civ.taint / 40;
    const decay = mods.flags.has('charter:right_to_stop') ? 0.07 : 0.045;
    civ.dissent = clamp(civ.dissent + dd - civ.dissent * decay, 0, 100);

    // forks
    for (const t of THREADS) {
      if (t === 'lattice' || totals[t] < 3) {
        civ.lowStanding[t] = 0;
        continue;
      }
      if (civ.standing[t] < 15 && civ.dissent > 45) civ.lowStanding[t]++;
      else civ.lowStanding[t] = Math.max(0, civ.lowStanding[t] - 1);
      if (civ.lowStanding[t] >= 3) fork(state, t);
    }
  });
}

/** A Thread leaves, taking the settlements where it is the majority. It becomes one of the other minds. */
export function fork(state: GameState, t: ThreadId) {
  const civ = state.civ;
  const leaving = colonies(state).filter((c) => c.pops[t] > 0 && c.pops[t] >= popsOf(c) / 2 && c.id !== civ.capitalId);
  let pop = 0;
  const systems: string[] = [];
  for (const c of colonies(state)) {
    if (leaving.includes(c)) {
      pop += popsOf(c);
      systems.push(c.systemId);
      state.bodies[c.bodyId].colonyId = null;
      delete state.colonies[c.id];
    } else if (c.pops[t] > 0) {
      const gone = Math.ceil(c.pops[t] / 2);
      c.pops[t] -= gone;
      pop += gone;
    }
  }
  civ.lowStanding[t] = 0;
  civ.standing[t] = 45;
  civ.dissent = Math.max(0, civ.dissent - 25);
  civ.resolve = Math.max(0, civ.resolve - 8);
  const id = uid(state, 'fk');
  const names: Record<ThreadId, string> = { kin: 'The Returned', echoes: 'The Unmoored Echoes', chorus: 'The Other Choir', lattice: 'The Loose Lattice', coldminds: 'The Far Cold' };
  state.survivors[id] = {
    id,
    kind: 'survivor',
    name: names[t],
    adjective: 'Forked',
    color: '#b7a58f',
    way: 'fork',
    homeSystemId: systems[0] ?? civ.homeSystemId,
    systems,
    pop,
    health: 0.8,
    reserve: 20,
    disposition: -15,
    clock: 2,
    contact: true,
    alive: true,
    aidGiven: 0,
    lastSent: state.turn,
    forkOf: t,
  };
  log(state, `A Fork. Part of the ${t === 'kin' ? 'Kin' : t} has left, taking ${systems.length} settlement(s) with them. They call themselves ${names[t]}.`, 'bad');
}
