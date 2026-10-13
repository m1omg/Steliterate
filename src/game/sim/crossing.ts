import { asCiv } from '../civs';
import { ERA_BY_ID, ageIntro, crossingName, eta, nextEra, tideLength } from '../eras';
import { calendarEra, fateKnown, fateOf } from '../fate';
import { STRUCTURE_BY_ID } from '../data/structures';
import { TECH_BY_ID } from '../data/techs';
import type { Colony, CrossingReport, EraId, GameState } from '../types';
import { THREADS } from '../types';
import { evaporateHole } from '../physics';
import { capacity, reserveCapacity } from './economy';
import { deepFor, destroyColony } from './fleets';
import { starGoneEarly } from './flare';
import type { Mods } from './mods';
import { colonies, distLy, inItsSystem, log, popsOf, totalPops, withRng } from './util';

// The three great storms. Each transforms the world; your preparation decides what survives.

/** Each crossing's protocols: they halve the losses of that crossing only, as they say. */
const PROTOCOLS: Partial<Record<EraId, string>> = { dusk: 'last_light_protocols', degenerate: 'great_decay_protocols', blackhole: 'last_horizon_protocols' };

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
    const atHole = here.primary.kind === 'black_hole' || here.primary.kind === 'smbh';
    // a vault already at a hole stays there, but a planet it stood on has dissolved: into the Deep
    if (atHole && state.bodies[c.bodyId]?.kind === 'deep') continue;
    const target = atHole ? here : holes.slice().sort((a, b) => Math.hypot(a.phys.x - here.phys.x, a.phys.y - here.phys.y, a.phys.z - here.phys.z) - Math.hypot(b.phys.x - here.phys.x, b.phys.y - here.phys.y, b.phys.z - here.phys.z))[0];
    // its own civilization's vault at the hole, beside any other's
    const deep = deepFor(state, target, c.owner) ?? state.bodies[target.bodies[0]];
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
  // the migrants bring what they know how to build: a harvester for the hole's spin
  if (moved && state.civ.techs.includes('penrose_process')) {
    for (const c of colonies(state)) {
      const k = state.systems[c.systemId].primary.kind;
      if ((k === 'black_hole' || k === 'smbh') && !(c.structures.penrose_harvester ?? 0)) c.structures.penrose_harvester = 1;
    }
  }
  return moved;
}

/** What a Burst Catcher banks from a black hole's final burst, or from a neutron star's burst close by. */
export const BURST_CATCH = 250;
/** Within this many light-years a neutron star's burst gives a catcher all of BURST_CATCH. */
export const NEAR_BURST_LY = 10;

/**
 * What one Burst Catcher banks from a neutron star bursting `ly` light-years away: all of
 * BURST_CATCH within NEAR_BURST_LY, and beyond it less with the square of the distance (about 63 at
 * 20 ly, 10 at 50). The player chose "By distance", 12 Oct.
 */
export function burstShare(ly: number): number {
  return Math.round(BURST_CATCH * Math.min(1, (NEAR_BURST_LY / Math.max(ly, 1e-9)) ** 2));
}

/**
 * What Burst Catchers bank from a black hole's final burst: BURST_CATCH each, in its Deep or on a
 * world it held until then (`held`, from `evaporateHole`). A world flung loose long before is far away.
 */
export function finalBurstCatch(state: GameState, systemId: string, held: readonly string[] = []): number {
  let catchers = 0;
  for (const c of colonies(state)) if (c.systemId === systemId && inItsSystem(state, c, held)) catchers += c.structures.burst_catcher ?? 0;
  return BURST_CATCH * catchers;
}

/** Each civilization's lines in a crossing's report, by id. */
type Reports = Record<string, CrossingReport['lines']>;

/** Every civilization plays its part of a crossing, under its own perspective, the player first. */
function eachCiv(state: GameState, ids: readonly string[], part: (id: string) => void) {
  for (const id of ids) asCiv(state, id, () => part(id));
}

/** A line about the universe: every civilization's report has it, where it falls among its own. */
function toAll(lines: Reports, line: CrossingReport['lines'][number]) {
  for (const l of Object.values(lines)) l.push(line);
}

/** A crossing's protocols, if this civilization has them: they halve its losses (as they say). */
function protocolsMult(state: GameState, era: EraId): number {
  const protocols = PROTOCOLS[era];
  return protocols && state.civ.techs.includes(protocols) ? (TECH_BY_ID[protocols]?.effects?.crossing ?? 1) : 1;
}

/**
 * Curvature radiation: each neutron star, its mass given to the curvature of space for 10^68 years,
 * bursts at a tenth of a Sun in a last flash of particles and neutrinos (some 10^42 J): whatever we
 * had settled at one is lost, in its Deep or on a world it still held, and its worlds are blasted
 * loose. A world flung loose from it long before has drifted far away, and loses nothing. Burst
 * Catchers in other systems bank a share of the flash by its distance (`burstShare`), once each,
 * from the nearest: returned, by civilization, for the crossing to add after its own cost.
 */
export function burstNeutronStars(state: GameState, lines: Reports, ids: readonly string[] = Object.keys(lines)): Record<string, number> {
  // every one bursts, even one flung out of the galaxy with nothing left around it
  const stars = Object.values(state.systems).filter((s) => s.primary.kind === 'neutron_star');
  const bursting = new Set(stars.map((s) => s.id));
  const caught: Record<string, number> = {};
  const own: Reports = {};
  // each civilization's part, while every star is still there: what reaches its catchers elsewhere
  // (a system cast out of the galaxy is far from all the rest), and what it had at the stars
  eachCiv(state, ids, (id) => {
    let got = 0;
    let catching = 0;
    for (const c of colonies(state)) {
      const n = c.structures.burst_catcher ?? 0;
      const home = state.systems[c.systemId];
      if (!n || bursting.has(c.systemId) || home.ejected || !inItsSystem(state, c)) continue;
      let share = 0;
      for (const s of stars) if (!s.ejected) share = Math.max(share, burstShare(distLy(home, s)));
      if (share > 0) {
        got += share * n;
        catching++;
      }
    }
    let lostHere = 0;
    let people = 0;
    let farAway = 0;
    for (const s of stars) {
      for (const c of colonies(state)) {
        if (c.systemId !== s.id) continue;
        if (!inItsSystem(state, c)) {
          farAway++;
          continue;
        }
        lostHere++;
        people += popsOf(c) + c.cryo;
        destroyColony(state, c, 'its neutron star burst');
      }
    }
    caught[id] = got;
    const l: CrossingReport['lines'] = (own[id] = []);
    if (lostHere) l.push({ text: `${lostHere} of our settlements at neutron stars went with them${people ? `, and ${people} of our people` : ''}.`, kind: 'bad' });
    if (farAway) l.push({ text: farAway === 1 ? 'One of our settlements was on a world flung loose from its neutron star long before, and far away when it burst.' : `${farAway} of our settlements were on worlds flung loose from neutron stars long before, and far away when they burst.`, kind: 'good' });
    if (got) l.push({ text: `Burst Catchers at ${catching === 1 ? 'one of our settlements' : `${catching} of our settlements`} caught the flash from afar: +${got} energy.`, kind: 'good' });
  });
  // the universe's part: the stars go, their worlds blasted loose
  for (const s of stars) {
    s.primary.kind = 'void';
    s.primary.lum = 0;
    s.primary.spin = 0;
    s.primary.spinMax = 0;
    let left = false;
    for (const id of s.bodies) {
      const b = state.bodies[id];
      if (!b || b.dissolved || b.kind === 'deep') continue;
      b.rogue = true;
      left = true;
    }
    s.gone = s.gone || !left;
  }
  toAll(lines, { text: `The neutron stars have burst: ${stars.length} of them, each at a tenth of a Sun, in a last flash of particles and neutrinos. They had given their mass to the curvature of space for 10⁶⁸ years.`, kind: 'info' });
  for (const id of ids) lines[id].push(...own[id]);
  return caught;
}

/**
 * The end of ordinary matter, by proton decay (the Great Decay) or by curvature radiation (the
 * Great Evaporation): every system but the black holes is gone with every world in it; only
 * settlements on decay-proof (leptonic) substrate go on, keeping only that, and drift to the
 * nearest black holes; the Hunger, made of matter too, nearly ends; so do the civilizations that
 * live on worlds. The universe's part, then each civilization's, then the universe's again.
 */
function endOfMatter(state: GameState, ids: readonly string[], mods: Record<string, Mods>, lines: Reports, protocolsEra: EraId, how: 'decayed' | 'evaporated') {
  let dissolved = 0;
  for (const s of Object.values(state.systems)) {
    if (s.primary.kind === 'black_hole' || s.primary.kind === 'smbh') continue;
    if (!s.gone) dissolved++;
    // the Last Star goes with the rest of matter, and a clock kept with it ends
    starGoneEarly(state, s);
    s.primary.kind = 'void';
    s.primary.lum = 0;
    s.gone = true;
  }
  for (const b of Object.values(state.bodies)) if (b.kind !== 'deep') b.dissolved = true;
  toAll(lines, { text: `Every planet, every dead star and every scrap of ordinary matter has ${how}. ${dissolved} systems are simply gone.`, kind: 'info' });
  eachCiv(state, ids, (id) => leftOnSubstrate(state, mods[id], lines[id], protocolsMult(state, protocolsEra), how));
  withRng(state, (rng) => {
    for (const sw of Object.values(state.swarms)) {
      const at = sw.systemId ? state.systems[sw.systemId] : null;
      if (at && (at.primary.kind === 'black_hole' || at.primary.kind === 'smbh') && rng.chance(0.4)) sw.size *= 0.2;
      else delete state.swarms[sw.id];
    }
  });
  toAll(lines, { text: 'The Hunger was made of matter too. Only a few starving swarms cling on at the black holes.', kind: 'info' });
  // (a neighbour of its own crosses as we do, in its own part)
  for (const sv of Object.values(state.survivors)) {
    if (!sv.alive || state.civs[sv.id]) continue;
    if (sv.way === 'garden' || sv.way === 'fork') {
      sv.alive = false;
      sv.fate = 'faded';
    } else sv.health = Math.max(0, sv.health - 0.45);
  }
  state.flags.matter_gone = state.turn;
}

/** One civilization at the end of matter: what was re-encoded goes on, a few minds carried over by the protocols; the rest is gone. */
function leftOnSubstrate(state: GameState, mods: Mods, lines: CrossingReport['lines'], crossingMult: number, how: 'decayed' | 'evaporated') {
  const cs = colonies(state);
  const cap = cs.find((c) => c.id === state.civ.capitalId && decayProof(c)) ?? cs.find((c) => decayProof(c));
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
    destroyColony(state, c, how === 'decayed' ? 'dissolved with the protons' : 'evaporated with the rest of matter');
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
  lost += state.civ.flags.decay_lost ?? 0;
  state.civ.flags.decay_lost = 0;
  const moved = migrateToBlackHoles(state);
  if (moved) lines.push({ text: `The Migration: ${moved} leptonic vault(s) fell toward the nearest black holes, the only sources left.`, kind: 'info' });
  if (saved) lines.push({ text: `${saved} minds were carried onto leptonic substrate before their homes ${how === 'decayed' ? 'dissolved' : 'evaporated'}.`, kind: 'good' });
  lines.push({ text: lost > 0 ? `${lost} of our people ${how === 'decayed' ? 'dissolved' : 'evaporated'} with the matter they were made of.` : 'No one was lost.', kind: lost > 0 ? 'bad' : 'good' });
  state.civ.matter = 0;
}

/** What each civilization had as a crossing began, for its report. */
function before(state: GameState, ids: readonly string[]): Record<string, { pops: number; colonies: number }> {
  const out: Record<string, { pops: number; colonies: number }> = {};
  eachCiv(state, ids, (id) => (out[id] = { pops: totalPops(state), colonies: colonies(state).length }));
  return out;
}

/**
 * A great storm between the ages: the universe changes once (the stars, the Hunger, the others),
 * and each civilization in `ids` loses what its preparation could not keep, measured before any
 * loss, under its own perspective. Each gets its own report, the universe's lines in it where
 * they fall among its own.
 */
export function runCrossing(state: GameState, ids: readonly string[], mods: Record<string, Mods>): Record<string, CrossingReport> {
  const from = state.era;
  const to = nextEra(from) as EraId;
  const lines: Reports = Object.fromEntries(ids.map((id) => [id, []]));
  const had = before(state, ids);

  if (from === 'dusk') {
    // ---------------------------------------------------------------- The Last Light
    let converted = 0;
    withRng(state, (rng) => {
      for (const s of Object.values(state.systems)) {
        const k = s.primary.kind;
        if (k === 'red_dwarf' || k === 'blue_dwarf') {
          s.primary.kind = 'white_dwarf';
          s.primary.halo = rng.chance(0.6);
          s.primary.whiteAt = state.years;
          converted++;
        }
      }
    });
    toAll(lines, { text: converted > 0 ? `${converted} of the last red dwarfs went out during the crossing. The last ordinary starlight is gone.` : 'The last ordinary starlight is gone. Every star that ever formed from gas has burned out.', kind: 'info' });
    eachCiv(state, ids, (id) => {
      const civ = state.civ;
      const crossingMult = protocolsMult(state, from);
      const cs = colonies(state);
      const reserveScore = Math.min(1, civ.energy / 220);
      const sourceScore = cs.length ? cs.filter((c) => hasStarlessSource(state, c)).length / cs.length : 0;
      let kin = 0;
      let cryoCap = 0;
      for (const c of cs) {
        kin += c.pops.kin;
        cryoCap += capacity(state, c, mods[id]).cryo;
      }
      const cryoScore = kin > 0 ? Math.min(1, cryoCap / kin) : 1;
      const prep = 0.4 * reserveScore + 0.35 * sourceScore + 0.25 * cryoScore;
      lines[id].push({ text: `Preparation: reserve ${Math.round(reserveScore * 100)}%, starless power ${Math.round(sourceScore * 100)}%, cold sleep ${Math.round(cryoScore * 100)}%.`, kind: 'info' });
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
      lines[id].push({ text: lost > 0 ? `${lost} of our people did not survive the dark.` : 'Everyone made it through.', kind: lost > 0 ? 'bad' : 'good' });
      // (the Slow Ones are the player's alone to know)
      if (id === state.player && !civ.dormant && state.minds.slow.stage >= 2) {
        state.minds.slow.understanding += 15;
        lines[id].push({ text: 'We were awake to watch the last light go out, as the Slow Ones were. They noticed.', kind: 'good' });
      }
    });
    for (const sw of Object.values(state.swarms)) sw.size *= 0.7;
    for (const sv of Object.values(state.survivors)) if (sv.alive && !state.civs[sv.id]) sv.health = Math.max(0, sv.health - (sv.way === 'garden' ? 0.6 : sv.way === 'dormant' ? 0.15 : 0.35));
    eachCiv(state, ids, () => (state.civ.energy *= 0.6));
  } else if (from === 'degenerate') {
    // ---------------------------------------------------------------- The Great Decay, or the Last Warmth
    // unless we found it out before (the Proton Question, or the neutron stars showing it earlier)
    eachCiv(state, ids, (id) => {
      const civ = state.civ;
      if (!fateKnown(state) || civ.flags.fate_known === state.turn) lines[id].push({ text: fateOf(state) === 'decay' ? 'The question is settled: the protons decay.' : fateOf(state) === 'curvature' ? 'The question is settled: space itself is unmaking matter.' : 'The question is settled: the protons are stable.', kind: 'info' });
      civ.flags.fate_known ??= state.turn;
    });
    let caught: Record<string, number> = {};
    if (fateOf(state) === 'decay') {
      endOfMatter(state, ids, mods, lines, from, 'decayed');
    } else {
      if (fateOf(state) === 'curvature') caught = burstNeutronStars(state, lines, ids);
      else toAll(lines, { text: 'The protons held. Matter endures, cold and dark, slowly tunnelling toward iron.', kind: 'good' });
      toAll(lines, { text: 'The neutron stars, the last things warm of their own accord, are colder now than the faint glow of the black holes. For the whole life of the universe the holes were the coldest things in it; from now on they are the warmest. The astronomers close the Degenerate Age here.', kind: 'info' });
      for (const s of Object.values(state.systems)) if (s.primary.kind === 'white_dwarf') s.primary.kind = 'black_dwarf';
      eachCiv(state, ids, (id) => {
        const crossingMult = protocolsMult(state, from);
        let lost = 0;
        for (const c of colonies(state)) {
          const cap = capacity(state, c, mods[id]);
          const room = cap.kin;
          if (c.pops.kin > room) {
            const l = Math.round((c.pops.kin - room) * 0.6 * crossingMult);
            c.pops.kin -= l;
            lost += l;
          }
        }
        lines[id].push({ text: lost ? `${lost} Kin could not be kept warm.` : 'Everyone who needed warmth had it.', kind: lost ? 'bad' : 'good' });
      });
      for (const sv of Object.values(state.survivors)) if (sv.alive && !state.civs[sv.id]) sv.health = Math.max(0, sv.health - 0.25);
    }
    // the crossing's cost falls on what we had saved; what the catchers caught comes after it
    eachCiv(state, ids, (id) => (state.civ.energy = state.civ.energy * 0.6 + (caught[id] ?? 0)));
  } else if (from === 'blackhole') {
    // ---------------------------------------------------------------- The Last Horizon
    // every hole left goes as one would on its own (physics.ts): its worlds drift loose, what we built stays
    for (const s of Object.values(state.systems)) if (s.primary.kind === 'black_hole' || s.primary.kind === 'smbh') evaporateHole(state, s);
    toAll(lines, { text: 'The Heart, the last and largest black hole, has evaporated. Nothing in the universe is making light any more.', kind: 'info' });
    eachCiv(state, ids, (id) => {
      const civ = state.civ;
      const crossingMult = protocolsMult(state, from);
      const prep = Math.min(1, civ.energy / Math.max(200, reserveCapacity(state, mods[id]) * 0.5));
      // what the crossing costs: Continuity short of 100, and energy (the protocols halve both)
      civ.continuity = Math.round(100 - 50 * (1 - prep) * crossingMult);
      lines[id].push({ text: `We enter the dark with ${Math.round(civ.energy)} energy saved, and Continuity at ${civ.continuity}.`, kind: prep > 0.6 ? 'good' : 'bad' });
      for (const c of colonies(state)) {
        if (c.pops.kin > 0 && !((c.structures.garden_ark ?? 0) > 0)) {
          c.cryo += c.pops.kin;
          c.pops.kin = 0;
        }
      }
    });
    for (const sv of Object.values(state.survivors)) if (sv.alive && !state.civs[sv.id]) sv.health = Math.max(0, sv.health - 0.4);
    eachCiv(state, ids, () => (state.civ.energy *= 1 - 0.15 * protocolsMult(state, from)));
  }

  // clean up settlements that are now empty
  eachCiv(state, ids, () => {
    for (const c of colonies(state)) if (popsOf(c) + c.cryo <= 0) destroyColony(state, c, 'no one is left there');
  });

  // enter the new era: the calendar skips ahead where it always did (into the Degenerate Age, into
  // the Dark, and with the Great Decay); the Last Warmth of a fate without decay keeps the calendar's
  // time and Tide
  state.era = to;
  state.eraTurn = 0;
  if (from !== 'degenerate' || fateOf(state) === 'decay') state.years = ERA_BY_ID[to].startYears;
  state.eta = eta(state.years);
  state.turnLength = to === 'dark' ? Infinity : tideLength(calendarEra(state), state.years, state.settings.length);
  const reports: Record<string, CrossingReport> = {};
  eachCiv(state, ids, (id) => {
    const civ = state.civ;
    civ.pace = 0;
    civ.dormant = false;
    civ.sleepTurns = 0;
    log(state, `${ERA_BY_ID[to].name} begins.`, 'era');
    reports[id] = {
      from,
      to,
      title: crossingName(from, fateOf(state)),
      intro: ageIntro(to, fateOf(state)),
      lines: lines[id],
      popsBefore: had[id].pops,
      popsAfter: totalPops(state),
      coloniesBefore: had[id].colonies,
      coloniesAfter: colonies(state).length,
    };
  });
  return reports;
}

/**
 * The Great Evaporation (curvature radiation only, near η 89.5): the last ordinary matter, worlds
 * and the last scraps of dead stars, is gone to curvature radiation. A storm inside the Black Hole
 * Age, with a screen of its own; its losses are the Great Decay's (and its protocols halve them).
 */
export function greatEvaporation(state: GameState, ids: readonly string[], mods: Record<string, Mods>): Record<string, CrossingReport> {
  const lines: Reports = Object.fromEntries(ids.map((id) => [id, []]));
  const had = before(state, ids);
  endOfMatter(state, ids, mods, lines, 'degenerate', 'evaporated');
  const reports: Record<string, CrossingReport> = {};
  eachCiv(state, ids, (id) => {
    state.civ.energy *= 0.6;
    for (const c of colonies(state)) if (popsOf(c) + c.cryo <= 0) destroyColony(state, c, 'no one is left there');
    log(state, 'The Great Evaporation: the last ordinary matter is gone.', 'era');
    reports[id] = {
      from: state.era,
      to: state.era,
      title: 'The Great Evaporation',
      intro: 'Space took some 10⁹⁰ years to unmake it all, and now it is done: every world, every dead star, every scrap of ordinary matter has evaporated into particles and light. Only what was carried onto leptonic substrate goes on, around the black holes that are left. The Heart will last a little longer than the rest.',
      lines: lines[id],
      popsBefore: had[id].pops,
      popsAfter: totalPops(state),
      coloniesBefore: had[id].colonies,
      coloniesAfter: colonies(state).length,
    };
  });
  return reports;
}

export { THREADS };
