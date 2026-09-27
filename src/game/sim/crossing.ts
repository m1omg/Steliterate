import { ERA_BY_ID, eta, nextEra, tideLength } from '../eras';
import { STRUCTURE_BY_ID } from '../data/structures';
import type { Colony, CrossingReport, EraId, GameState } from '../types';
import { THREADS } from '../types';
import { capacity, reserveCapacity } from './economy';
import { destroyColony } from './fleets';
import type { Mods } from './mods';
import { colonies, log, popsOf, totalPops, withRng } from './util';

// The three great storms. Each transforms the world; your preparation decides what survives.

function decayProof(c: Colony): boolean {
  return Object.entries(c.structures).some(([id, n]) => n > 0 && STRUCTURE_BY_ID[id]?.decayProof);
}

function hasStarlessSource(state: GameState, c: Colony): boolean {
  const b = state.bodies[c.bodyId];
  if ((c.structures.geothermal_tap ?? 0) > 0 && b.coreHeat > 0.1) return true;
  return ['fusion_plant', 'accretion_engine', 'pulsar_brake'].some((k) => (c.structures[k] ?? 0) > 0);
}

/** After the protons go, what survives drifts to the black holes. Vaults arriving at the same hole merge. */
function migrateToBlackHoles(state: GameState): number {
  const holes = Object.values(state.systems).filter((s) => (s.primary.kind === 'black_hole' || s.primary.kind === 'smbh') && !s.gone);
  if (!holes.length) return 0;
  let moved = 0;
  for (const c of colonies(state)) {
    const here = state.systems[c.systemId];
    if (here.primary.kind === 'black_hole' || here.primary.kind === 'smbh') continue;
    const target = holes.slice().sort((a, b) => Math.hypot(a.phys.x - here.phys.x, a.phys.y - here.phys.y, a.phys.z - here.phys.z) - Math.hypot(b.phys.x - here.phys.x, b.phys.y - here.phys.y, b.phys.z - here.phys.z))[0];
    const deep = state.bodies[target.bodies[0]];
    const oldBody = state.bodies[c.bodyId];
    if (oldBody) oldBody.colonyId = null;
    moved++;
    if (deep.colonyId && state.colonies[deep.colonyId]) {
      const host = state.colonies[deep.colonyId];
      for (const t of THREADS) host.pops[t] += c.pops[t];
      host.cryo += c.cryo;
      for (const [k, n] of Object.entries(c.structures)) host.structures[k] = (host.structures[k] ?? 0) + n;
      if (state.civ.capitalId === c.id) state.civ.capitalId = host.id;
      delete state.colonies[c.id];
    } else {
      c.bodyId = deep.id;
      c.systemId = target.id;
      c.name = `${target.name} Vault`;
      deep.colonyId = c.id;
      state.civ.known[target.id] = 2;
    }
  }
  return moved;
}

export function runCrossing(state: GameState, mods: Mods): CrossingReport {
  const from = state.era;
  const to = nextEra(from) as EraId;
  const lines: CrossingReport['lines'] = [];
  const popsBefore = totalPops(state);
  const coloniesBefore = colonies(state).length;
  const civ = state.civ;
  const crossingMult = mods.crossing;

  withRng(state, (rng) => {
    if (from === 'dusk') {
      // ---------------------------------------------------------------- The Last Light
      let converted = 0;
      for (const s of Object.values(state.systems)) {
        const k = s.primary.kind;
        if (k === 'red_dwarf' || k === 'blue_dwarf') {
          s.primary.kind = 'white_dwarf';
          s.primary.halo = rng.chance(0.6);
          s.primary.whiteAt = state.years;
          converted++;
        }
      }
      lines.push({ text: converted > 0 ? `${converted} of the last red dwarfs went out during the crossing. The last ordinary starlight is gone.` : 'The last ordinary starlight is gone. Every star that ever formed from gas has burned out.', kind: 'info' });
      const cs = colonies(state);
      const reserveScore = Math.min(1, civ.energy / 220);
      const sourceScore = cs.length ? cs.filter((c) => hasStarlessSource(state, c)).length / cs.length : 0;
      let kin = 0;
      let cryoCap = 0;
      for (const c of cs) {
        kin += c.pops.kin;
        cryoCap += capacity(state, c, mods).cryo;
      }
      const cryoScore = kin > 0 ? Math.min(1, cryoCap / kin) : 1;
      const prep = 0.4 * reserveScore + 0.35 * sourceScore + 0.25 * cryoScore;
      lines.push({ text: `Preparation: reserve ${Math.round(reserveScore * 100)}%, starless power ${Math.round(sourceScore * 100)}%, cold sleep ${Math.round(cryoScore * 100)}%.`, kind: 'info' });
      let lost = 0;
      for (const c of cs) {
        const kinLoss = Math.round(c.pops.kin * (1 - prep) * 0.7 * crossingMult);
        const echoLoss = Math.round((c.pops.echoes + c.pops.chorus) * (1 - prep) * 0.25 * crossingMult);
        const latLoss = Math.round(c.pops.lattice * (1 - prep) * 0.15 * crossingMult);
        c.pops.kin -= kinLoss;
        const e1 = Math.min(c.pops.echoes, echoLoss);
        c.pops.echoes -= e1;
        c.pops.chorus = Math.max(0, c.pops.chorus - (echoLoss - e1));
        c.pops.lattice -= latLoss;
        if (prep < 0.15) c.cryo = Math.floor(c.cryo / 2);
        lost += kinLoss + echoLoss + latLoss;
        const b = state.bodies[c.bodyId];
        b.vitality = Math.max(0, b.vitality - 0.5);
      }
      lines.push({ text: lost > 0 ? `${lost} of our people did not survive the dark.` : 'Everyone made it through.', kind: lost > 0 ? 'bad' : 'good' });
      if (!civ.dormant && state.minds.slow.stage >= 2) {
        state.minds.slow.understanding += 15;
        lines.push({ text: 'We were awake to watch the last light go out, as the Slow Ones were. They noticed.', kind: 'good' });
      }
      for (const sw of Object.values(state.swarms)) sw.size *= 0.7;
      for (const sv of Object.values(state.survivors)) if (sv.alive) sv.health -= sv.way === 'garden' ? 0.6 : sv.way === 'dormant' ? 0.15 : 0.35;
      civ.energy *= 0.6;
    } else if (from === 'degenerate') {
      // ---------------------------------------------------------------- The Great Decay
      if (state.protonsDecay) {
        let dissolved = 0;
        for (const s of Object.values(state.systems)) {
          if (s.primary.kind === 'black_hole' || s.primary.kind === 'smbh') continue;
          if (!s.gone) dissolved++;
          s.primary.kind = 'void';
          s.primary.lum = 0;
          s.gone = true;
        }
        for (const b of Object.values(state.bodies)) if (b.kind !== 'deep') b.dissolved = true;
        lines.push({ text: `Every planet, every dead star and every scrap of ordinary matter has decayed. ${dissolved} systems are simply gone.`, kind: 'info' });
        const cs = colonies(state);
        const cap = cs.find((c) => c.id === civ.capitalId && decayProof(c)) ?? cs.find((c) => decayProof(c));
        let saved = 0;
        let lost = 0;
        for (const c of cs) {
          if (decayProof(c)) {
            // only what was re-encoded survives
            for (const k of Object.keys(c.structures)) if (!STRUCTURE_BY_ID[k]?.decayProof) delete c.structures[k];
            c.queue = [];
            lost += c.pops.kin + c.cryo;
            c.pops.kin = 0;
            c.cryo = 0;
            const lat = Math.round(c.pops.lattice * 0.5 * crossingMult);
            c.pops.lattice -= lat;
            lost += lat;
            continue;
          }
          // migration through the protocols
          if (cap && crossingMult < 1) {
            for (const t of ['echoes', 'coldminds', 'chorus'] as const) {
              const m = Math.floor(c.pops[t] * 0.35);
              cap.pops[t] += m;
              saved += m;
            }
          }
          lost += popsOf(c) + c.cryo;
          destroyColony(state, c, 'dissolved with the protons');
        }
        // what does not fit on the new substrate is lost
        for (const c of colonies(state)) {
          const capc = capacity(state, c, mods);
          for (const t of THREADS) {
            if (c.pops[t] > capc[t]) {
              lost += c.pops[t] - capc[t];
              c.pops[t] = capc[t];
            }
          }
        }
        lost += state.flags.decay_lost ?? 0;
        state.flags.decay_lost = 0;
        const moved = migrateToBlackHoles(state);
        if (moved) lines.push({ text: `The Migration: ${moved} leptonic vault(s) fell toward the nearest black holes, the only sources left.`, kind: 'info' });
        if (saved) lines.push({ text: `${saved} minds were carried onto leptonic substrate before their homes dissolved.`, kind: 'good' });
        lines.push({ text: lost > 0 ? `${lost} of our people dissolved with the matter they were made of.` : 'No one was lost.', kind: lost > 0 ? 'bad' : 'good' });
        civ.matter = 0;
        for (const sw of Object.values(state.swarms)) {
          const at = sw.systemId ? state.systems[sw.systemId] : null;
          if (at && (at.primary.kind === 'black_hole' || at.primary.kind === 'smbh') && rng.chance(0.4)) sw.size *= 0.2;
          else delete state.swarms[sw.id];
        }
        lines.push({ text: 'The Hunger was made of matter too. Only a few starving swarms cling on at the black holes.', kind: 'info' });
        for (const sv of Object.values(state.survivors)) {
          if (!sv.alive) continue;
          if (sv.way === 'garden' || sv.way === 'fork') {
            sv.alive = false;
            sv.fate = 'faded';
          } else sv.health -= 0.45;
        }
      } else {
        for (const s of Object.values(state.systems)) if (s.primary.kind === 'white_dwarf') s.primary.kind = 'black_dwarf';
        lines.push({ text: 'The protons held. Matter endures, cold and dark, slowly tunnelling toward iron.', kind: 'good' });
        let lost = 0;
        for (const c of colonies(state)) {
          const cap = capacity(state, c, mods);
          const room = cap.kin;
          if (c.pops.kin > room) {
            const l = Math.round((c.pops.kin - room) * 0.6 * crossingMult);
            c.pops.kin -= l;
            lost += l;
          }
        }
        lines.push({ text: lost ? `${lost} Kin could not be kept warm.` : 'Everyone who needed warmth had it.', kind: lost ? 'bad' : 'good' });
        for (const sv of Object.values(state.survivors)) if (sv.alive) sv.health -= 0.25;
      }
      civ.energy *= 0.6;
    } else if (from === 'blackhole') {
      // ---------------------------------------------------------------- The Last Horizon
      for (const s of Object.values(state.systems)) {
        if (s.primary.kind === 'black_hole' || s.primary.kind === 'smbh') {
          s.primary.kind = 'void';
          s.gone = true;
        }
      }
      lines.push({ text: 'The Heart, the last and largest black hole, has evaporated. Nothing in the universe is making light any more.', kind: 'info' });
      const prep = Math.min(1, civ.energy / Math.max(200, reserveCapacity(state, mods) * 0.5));
      civ.continuity = Math.round(100 * (0.5 + 0.5 * prep));
      lines.push({ text: `We enter the dark with ${Math.round(civ.energy)} energy saved, and Continuity at ${civ.continuity}.`, kind: prep > 0.6 ? 'good' : 'bad' });
      for (const c of colonies(state)) {
        if (c.pops.kin > 0 && !((c.structures.garden_ark ?? 0) > 0)) {
          c.cryo += c.pops.kin;
          c.pops.kin = 0;
        }
      }
      for (const sv of Object.values(state.survivors)) if (sv.alive) sv.health -= 0.4;
      civ.energy *= 0.85;
    }
  });

  // clean up settlements that are now empty
  for (const c of colonies(state)) if (popsOf(c) + c.cryo <= 0) destroyColony(state, c, 'no one is left there');

  // enter the new era
  state.era = to;
  state.eraTurn = 0;
  state.years = ERA_BY_ID[to].startYears;
  state.eta = eta(state.years);
  state.turnLength = to === 'dark' ? Infinity : tideLength(to, state.years, state.settings.length);
  civ.pace = 0;
  civ.dormant = false;
  civ.sleepTurns = 0;
  log(state, `${ERA_BY_ID[to].name} begins.`, 'era');

  return {
    from,
    to,
    lines,
    popsBefore,
    popsAfter: totalPops(state),
    coloniesBefore,
    coloniesAfter: colonies(state).length,
  };
}

export { THREADS };
