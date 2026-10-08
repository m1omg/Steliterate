import { SHIP_BY_ID } from '../data/ships';
import { STRUCTURE_BY_ID, structureLabel } from '../data/structures';
import type { Fleet, GameState, StarSystem, Swarm } from '../types';
import { FORTIFY_BONUS, destroyColony, isWarFleet, signatureOf } from './fleets';
import type { Mods } from './mods';
import { colonies, distLy, hasCharter, log, uid, withRng } from './util';
import { queueEvent } from './events';
import { foughtFor, theirWarmth } from './claims';
import { warHeat } from './war';
import { calendarEra } from '../fate';

// The Hunger: harvesters left running by a civilization that died long ago. Its makers built
// it to survive; it still does, the way a tumour does. It has no plan beyond the next meal,
// and it starves when a region is stripped. It is drawn to light and heat.

const MAX_SWARMS = { gentle: 4, standard: 6, harsh: 8 } as const;

export function systemMatter(state: GameState, sys: StarSystem): number {
  let m = 0;
  for (const bid of sys.bodies) {
    const b = state.bodies[bid];
    if (!b || b.dissolved) continue;
    m += b.richness + b.hydrogen * 0.5;
  }
  if (sys.primary.kind === 'brown_dwarf') m += 2;
  return m;
}

function defenseAt(state: GameState, systemId: string, mods: Mods): number {
  let d = 0;
  for (const c of colonies(state)) {
    if (c.systemId !== systemId) continue;
    for (const [id, n] of Object.entries(c.structures)) d += (STRUCTURE_BY_ID[id]?.defense ?? 0) * n;
  }
  for (const f of Object.values(state.fleets)) {
    if (f.at !== systemId) continue;
    // dug in with the settlement's own grid, a fortified fleet defends twice as well
    const k = f.order === 'fortify' ? FORTIFY_BONUS : 1;
    for (const s of f.ships) d += (SHIP_BY_ID[s.cls]?.attack ?? 0) * k;
  }
  if (mods.flags.has('charter:wardens_oath')) d *= 1.5;
  // Shared Watch: a partner's warning, and a little of their strength (never a shield)
  for (const sv of Object.values(state.survivors)) if (sv.alive && sv.pacts?.watch !== undefined) d += 0.5;
  return d;
}

/**
 * The first swarm one of our ships comes near, asleep or awake. Often a part of it comes for the
 * ship (a warship can kill it there; anything else is mauled but gets away) and what is left of
 * that part goes for the nearest warmth, our settlements; sometimes it lets the ship go.
 */
export function firstSwarm(state: GameState) {
  if (state.flags.first_swarm) return;
  for (const f of Object.values(state.fleets)) {
    if (!f.at) continue;
    const here = state.systems[f.at];
    // a swarm notices a warm ship anywhere nearby, not only in its own system
    const sw = Object.values(state.swarms).find((w) => w.systemId && !w.tamed && distLy(here, state.systems[w.systemId]) <= FIRST_SWARM_REACH);
    if (!sw) continue;
    const nest = state.systems[sw.systemId!];
    state.flags.first_swarm = state.turn;
    if (!state.civ.known[nest.id]) state.civ.known[nest.id] = 1;
    let outcome = '';
    withRng(state, (rng) => {
      // not every swarm cares: some let the ship go, for now
      if (!rng.chance(0.55)) {
        outcome = `It paid ${f.name} no attention. Yet.`;
        log(state, `${f.name} came near the swarm at ${nest.name}. It did not react.`, 'info', here.id);
        return;
      }
      const size = Math.min(1.6, Math.max(1, sw.size * 0.3));
      sw.size = Math.max(0.8, sw.size - size * 0.5);
      const frag: Swarm = { id: uid(state, 'sw'), systemId: here.id, from: null, to: null, traveled: 0, distance: 0, size, awake: true, tamed: false, appetite: sw.appetite };
      const attack = f.ships.reduce((a, s) => a + (SHIP_BY_ID[s.cls]?.attack ?? 0), 0);
      if (attack > 0 && attack >= size * 1.2 * rng.range(0.6, 1.1)) {
        state.civ.matter += size * 2;
        for (const s of f.ships) s.hp = Math.max(1, s.hp - rng.range(0, size));
        outcome = `${f.name} fought, and burned it out of the sky (+${Math.round(size * 2)} salvaged matter). The rest of the swarm stays at ${nest.name}, eating.`;
        log(state, `Part of the swarm at ${nest.name} came for ${f.name} at ${here.name}. It was destroyed.`, 'combat', here.id);
        return;
      }
      // mauled, but it gets away
      for (const s of f.ships) s.hp = Math.max(1, s.hp - rng.range(0.6, 1.6));
      state.swarms[frag.id] = frag;
      const target = colonies(state)
        .map((c) => state.systems[c.systemId])
        .sort((a, b) => distLy(here, a) - distLy(here, b))[0];
      if (target && target.id !== here.id) {
        frag.systemId = null;
        frag.from = here.id;
        frag.to = target.id;
        frag.distance = distLy(here, target);
        outcome = `${f.name} was mauled but got away. What came for it is heading for the warmth of ${target.name}.`;
      } else outcome = `${f.name} was mauled but got away. What came for it is still at ${here.name}.`;
      log(state, `Part of the swarm at ${nest.name} came for ${f.name} at ${here.name}. ${outcome}`, 'combat', here.id);
    });
    state.flags.hunger_woke = (state.flags.hunger_woke ?? 0) + 1;
    queueEvent(state, 'rust_in_the_belt', { systemId: nest.id, fleet: f.name, outcome });
    return;
  }
}

/** How close a ship must come to a swarm for the first one to notice it (ly). */
const FIRST_SWARM_REACH = 60;

/** Each turn, how likely a swarm is to go for a ship stopped in its system: awake, and asleep. */
export const HUNT_AWAKE = 0.7;
export const HUNT_ASLEEP = 0.2;

/**
 * Swarms catch ships. A ship stopped where a swarm sits, with no settlement of ours there to
 * fight beside it, is often attacked: a warship may beat it off and salvage what it kills;
 * anything else is torn apart unless the swarm is small. It runs as ships arrive, before
 * exploring probes set off again, so a probe that surveys a swarm's star is at risk.
 */
export function swarmsHunt(state: GameState, mods: Mods) {
  // the first swarm has its own moment (firstSwarm), and under Communion they take us for their own
  if (state.flags.first_swarm === state.turn || hasCharter(state, 'communion_charter')) return;
  const dark = mods.flags.has('charter:blackout') ? 0.5 : 1;
  const settled = new Set(colonies(state).map((c) => c.systemId));
  withRng(state, (rng) => {
    for (const sw of Object.values(state.swarms)) {
      if (!sw.systemId || sw.tamed || settled.has(sw.systemId)) continue;
      const sys = state.systems[sw.systemId];
      if (!sys || sys.gone) continue;
      for (const f of Object.values(state.fleets)) {
        if (f.at !== sys.id || !f.ships.length) continue;
        if (!rng.chance((sw.awake ? HUNT_AWAKE : HUNT_ASLEEP) * dark)) continue;
        const what = sw.awake ? 'The swarm' : 'Something asleep';
        const k = f.order === 'fortify' ? FORTIFY_BONUS : 1;
        const attack = f.ships.reduce((a, s) => a + (SHIP_BY_ID[s.cls]?.attack ?? 0) * k, 0);
        if (attack > 0 && attack >= sw.size * 1.2 * rng.range(0.6, 1.1)) {
          const lost = Math.min(sw.size, attack * 0.3);
          sw.size -= lost;
          state.civ.matter += lost * 2;
          for (const s of f.ships) s.hp = Math.max(1, s.hp - rng.range(0, sw.size * 0.3));
          log(state, `${what} at ${sys.name} came for ${f.name}, and ${f.name} beat it off (+${Math.round(lost * 2)} salvaged matter).`, 'combat', sys.id);
          state.battles.push({ systemId: sys.id, turn: state.turn, text: `${f.name} beat off the swarm.` });
          if (sw.size <= 0.4) {
            delete state.swarms[sw.id];
            log(state, `The swarm at ${sys.name} is broken.`, 'good', sys.id);
            foughtFor(state, sys.id, true);
            break;
          }
          foughtFor(state, sys.id, false);
          continue;
        }
        // torn apart, unless the swarm is small
        const before = f.ships.length;
        for (const s of f.ships) s.hp -= rng.range(0.6, 1.2) * sw.size * 0.8;
        f.ships = f.ships.filter((s) => s.hp > 0);
        if (!f.ships.length) {
          delete state.fleets[f.id];
          log(state, `${what} at ${sys.name} caught ${f.name}. Nothing came back.`, 'combat', sys.id);
        } else {
          const gone = before - f.ships.length;
          log(state, `${what} at ${sys.name} caught ${f.name}${gone ? `: ${gone} ship${gone === 1 ? '' : 's'} lost` : ''}. What is left is damaged, and still there.`, 'combat', sys.id);
        }
        state.battles.push({ systemId: sys.id, turn: state.turn, text: `The swarm caught ${f.name}.` });
      }
    }
  });
}

/**
 * The chance our warships beat a swarm when they go for it: as when it comes for them, they win if
 * their attack is at least 1.2 × its size × a draw from 0.6 to 1.1. So a win is sure while its
 * size is at most attack / 1.32, and impossible once it is past attack / 0.72.
 */
export function attackOdds(attack: number, size: number): number {
  if (attack <= 0) return 0;
  return Math.max(0, Math.min(1, (attack / (1.2 * size) - 0.6) / 0.5));
}

/** Every warship of ours at this star, their attack added up (at their plain strength: attacking, they leave any fortifications). */
export function warshipsAt(state: GameState, systemId: string): { fleets: Fleet[]; attack: number } {
  const fleets = Object.values(state.fleets).filter((x) => x.at === systemId && isWarFleet(x));
  const attack = fleets.reduce((a, x) => a + x.ships.reduce((b, sh) => b + (SHIP_BY_ID[sh.cls]?.settles ? 0 : (SHIP_BY_ID[sh.cls]?.attack ?? 0)), 0), 0);
  return { fleets, attack };
}

/** The year-mark a star's warships last went for a swarm (civ.flags): once a turn. */
const attackedKey = (systemId: string) => `swarm_attack_${systemId}`;

/**
 * Our warships at a swarm's star go for it, every one of ours there together, once a turn. It is
 * the fight it would pick with them, at the moment we choose: win, and they kill a share of it
 * (0.3 × their attack) and we salvage what they kill, while what is left of it hurts them; break
 * it (to 0.4 or less) and it is gone. Lose, and it tears into every ship there. One asleep wakes
 * unless it is broken. Our neighbours who live there see us fight it, as when it comes for us.
 */
export function attackSwarm(state: GameState, fleetId: string): { ok: boolean; text: string } | string {
  const f = state.fleets[fleetId];
  if (!f || !f.at) return 'The fleet must be stationed at the swarm’s star.';
  if (!isWarFleet(f)) return 'Only warships can attack a swarm.';
  const sw = Object.values(state.swarms).find((w) => w.systemId === f.at && !w.tamed);
  if (!sw) return 'No swarm of the Hunger is here to attack.';
  if (hasCharter(state, 'communion_charter')) return 'Under the Communion Charter they take us for their own: we will not turn on them.';
  if (state.civ.flags[attackedKey(f.at)] === state.turn) return 'Our warships here have already fought it this turn.';
  const sys = state.systems[f.at];
  const { fleets, attack } = warshipsAt(state, f.at);
  state.civ.flags[attackedKey(f.at)] = state.turn;
  const asleep = !sw.awake;
  let result: { ok: boolean; text: string } = { ok: false, text: '' };
  let broke = false;
  withRng(state, (rng) => {
    if (attack >= sw.size * 1.2 * rng.range(0.6, 1.1)) {
      const lost = Math.min(sw.size, attack * 0.3);
      sw.size -= lost;
      state.civ.matter += lost * 2;
      for (const x of fleets) for (const sh of x.ships) sh.hp = Math.max(1, sh.hp - rng.range(0, sw.size * 0.3));
      broke = sw.size <= 0.4;
      result = {
        ok: true,
        text: broke
          ? `Our warships went for the swarm at ${sys.name} and broke it (+${Math.round(lost * 2)} salvaged matter).`
          : `Our warships went for the swarm at ${sys.name} and tore a ${lost >= 1 ? `great ` : ''}piece out of it (+${Math.round(lost * 2)} salvaged matter). It is ${sw.size < 2 ? 'small now' : 'still there'}.`,
      };
    } else {
      let gone = 0;
      for (const x of fleets) {
        const before = x.ships.length;
        for (const sh of x.ships) sh.hp -= rng.range(0.6, 1.2) * sw.size * 0.8;
        x.ships = x.ships.filter((sh) => sh.hp > 0);
        gone += before - x.ships.length;
        if (!x.ships.length) delete state.fleets[x.id];
      }
      result = { ok: false, text: `Our warships went for the swarm at ${sys.name}, and it was too much for them${gone ? `: ${gone} ship${gone === 1 ? '' : 's'} lost` : ''}. What is left is hurt.` };
    }
  });
  if (broke) {
    delete state.swarms[sw.id];
    foughtFor(state, sys.id, true);
  } else {
    if (result.ok) foughtFor(state, sys.id, false);
    if (asleep) {
      sw.awake = true;
      state.flags.hunger_woke = (state.flags.hunger_woke ?? 0) + 1;
      result.text += ' It was asleep. It is not now.';
    }
  }
  state.battles.push({ systemId: sys.id, turn: state.turn, text: result.text });
  log(state, result.text, 'combat', sys.id);
  return result;
}

/** Can our warships at this star go for its swarm this turn? Why not, if not (null: they can). */
export function attackBlocked(state: GameState, systemId: string): string | null {
  if (!Object.values(state.swarms).some((w) => w.systemId === systemId && !w.tamed)) return 'No swarm is here.';
  if (hasCharter(state, 'communion_charter')) return 'Under the Communion Charter we will not turn on them.';
  if (state.civ.flags[attackedKey(systemId)] === state.turn) return 'Our warships here have already fought it this turn.';
  return null;
}

/** How far a swarm looks, and goes, for its next meal (ly). */
export function swarmReach(state: GameState): number {
  return rangeLy(state);
}

function rangeLy(state: GameState): number {
  return calendarEra(state) === 'dusk' ? 90 : calendarEra(state) === 'degenerate' ? 4e5 : 1e9;
}

export function updateHunger(state: GameState, L: number, mods: Mods) {
  const civ = state.civ;
  const swarms = Object.values(state.swarms);
  const maxSwarms = MAX_SWARMS[state.settings.difficulty];
  const communion = hasCharter(state, 'communion_charter');
  const blackout = mods.flags.has('charter:blackout') ? 0.3 : 1;

  withRng(state, (rng) => {
    for (const sw of swarms) {
      // waking
      if (!sw.awake) {
        const p = calendarEra(state) === 'dusk' ? (state.eraTurn > 18 ? 0.035 : 0) : 0.1;
        if (rng.chance(p)) {
          sw.awake = true;
          const sys = sw.systemId ? state.systems[sw.systemId] : null;
          if (sys && civ.known[sys.id]) log(state, `Something has begun eating the worlds of ${sys.name}.`, 'bad', sys.id);
          state.flags.hunger_woke = (state.flags.hunger_woke ?? 0) + 1;
        }
        continue;
      }
      // travelling
      if (!sw.systemId && sw.to) {
        const step = isFinite(L) ? (calendarEra(state) === 'dusk' ? 0.05 : 0.5) * L : Infinity;
        sw.traveled += step;
        if (sw.traveled >= sw.distance) {
          sw.systemId = sw.to;
          sw.to = null;
          sw.from = null;
          sw.traveled = 0;
          const sys = state.systems[sw.systemId];
          if (civ.known[sys.id]) log(state, `A swarm${sw.tamed ? ' under your command' : ''} has arrived at ${sys.name}.`, sw.tamed ? 'info' : 'bad', sys.id);
        }
        continue;
      }
      const sys = sw.systemId ? state.systems[sw.systemId] : null;
      if (!sys || sys.gone) {
        delete state.swarms[sw.id];
        continue;
      }

      // tamed swarms work for you, and may relapse
      if (sw.tamed) {
        const yieldM = sw.size * (communion ? 0.8 : 0.4);
        civ.matter += yieldM;
        if (communion) civ.taint = Math.min(100, civ.taint + 0.12 * sw.size);
        const relapse = mods.flags.has('charter:lattice_compact') || communion ? 0.005 : 0.02;
        if (rng.chance(relapse)) {
          sw.tamed = false;
          log(state, `A tamed swarm at ${sys.name} has slipped its commands. It is hungry again.`, 'bad', sys.id);
        }
        continue;
      }

      // eat
      const matter = systemMatter(state, sys);
      const bite = Math.min(matter, 0.05 * sw.size);
      for (const bid of sys.bodies) {
        const b = state.bodies[bid];
        if (!b || b.dissolved || b.kind === 'deep') continue;
        b.richness = Math.max(0, b.richness - bite * 0.3);
        b.hydrogen = Math.max(0, b.hydrogen - bite * 0.15);
      }
      state.gfe = Math.max(0.05, state.gfe - 0.00006 * sw.size * (communion ? 1.5 : 1));
      sys.rust = Math.min(1, (sys.rust ?? 0) + 0.04 + sw.size * 0.004);
      // logistic growth limited by what is left here; starvation shrinks it
      const cap = 3 + matter * 2.2;
      sw.size += 0.1 * sw.size * (1 - sw.size / Math.max(1, cap));
      if (matter < 0.6) sw.size -= 0.25;
      if (sw.size <= 0.4) {
        log(state, `The swarm at ${sys.name} has starved and gone still.`, 'good', sys.id);
        delete state.swarms[sw.id];
        continue;
      }

      // collide with settlements
      const here = colonies(state).filter((c) => c.systemId === sys.id);
      if (here.length && !communion) {
        const def = defenseAt(state, sys.id, mods);
        const power = sw.size * 1.2;
        if (def >= power * rng.range(0.6, 1.1)) {
          const lost = Math.min(sw.size, def * 0.3);
          sw.size -= lost;
          civ.matter += lost * 2;
          state.battles.push({ systemId: sys.id, turn: state.turn, text: `Defenders drove back the swarm (+${(lost * 2).toFixed(0)} salvaged matter).` });
          log(state, `Defenders at ${sys.name} drove back the swarm and salvaged its dead.`, 'combat', sys.id);
          // damage escorts
          for (const f of Object.values(state.fleets)) {
            if (f.at !== sys.id) continue;
            for (const s of f.ships) s.hp -= rng.range(0, sw.size * 0.4);
            f.ships = f.ships.filter((s) => s.hp > 0);
            if (!f.ships.length) delete state.fleets[f.id];
          }
          if (sw.size <= 0.4) {
            delete state.swarms[sw.id];
            continue;
          }
        } else {
          const c = rng.pick(here);
          const structs = Object.keys(c.structures).filter((k) => c.structures[k] > 0 && k !== 'shipyard');
          if (structs.length) {
            const k = rng.weighted(structs, (s) => (STRUCTURE_BY_ID[s]?.signature ?? 1) + 0.5);
            c.structures[k]--;
            if (c.structures[k] <= 0) delete c.structures[k];
            log(state, `The swarm stripped ${structureLabel(k, sys).name} at ${c.name}.`, 'combat', sys.id);
          }
          civ.matter = Math.max(0, civ.matter - sw.size * 2);
          if (rng.chance(0.35)) {
            const alive = (['lattice', 'echoes', 'kin', 'chorus', 'coldminds'] as const).filter((t) => c.pops[t] > 0);
            if (alive.length) {
              const t = rng.pick(alive);
              c.pops[t]--;
              civ.resolve = Math.max(0, civ.resolve - 2);
            }
          }
          if (Object.keys(c.structures).length === 0 && c.pops.kin + c.pops.echoes + c.pops.chorus + c.pops.lattice + c.pops.coldminds + c.cryo <= 0) {
            destroyColony(state, c, 'consumed by the Hunger');
          }
          sw.size += 0.5;
          state.battles.push({ systemId: sys.id, turn: state.turn, text: 'The swarm broke through.' });
        }
      }
      // survivors suffer too (less, with our watch beside theirs)
      for (const sv of Object.values(state.survivors)) {
        if (sv.alive && sv.systems.includes(sys.id)) sv.health = Math.max(0, sv.health - 0.012 * sw.size * (sv.pacts?.watch !== undefined ? 0.7 : 1));
      }

      // bud
      if (sw.size > 9 && Object.keys(state.swarms).length < maxSwarms) {
        sw.size /= 2;
        const child: Swarm = { id: uid(state, 'hg'), systemId: sys.id, from: null, to: null, traveled: 0, distance: 0, size: sw.size, awake: true, tamed: false, appetite: 1 };
        state.swarms[child.id] = child;
        moveSwarm(state, child, () => rng.next(), blackout);
      }
      // move on when the pickings are thin
      if (matter < 1.2 || rng.chance(0.08)) moveSwarm(state, sw, () => rng.next(), blackout);
    }
  });
  fadeRust(state);
}

/** Rust fades by this share a turn where no swarm of the Hunger is. */
export const RUST_FADE = 0.1;

/**
 * Where no untamed swarm is (feeding, or asleep in its nest), rust fades, a tenth a turn, and is
 * gone below 1%: about 45 turns after a swarm fed its fill. Takes no random draw.
 */
function fadeRust(state: GameState) {
  const held = new Set(Object.values(state.swarms).filter((w) => !w.tamed && w.systemId).map((w) => w.systemId!));
  for (const sys of Object.values(state.systems)) {
    if (!sys.rust || held.has(sys.id)) continue;
    sys.rust *= 1 - RUST_FADE;
    if (sys.rust < 0.01) delete sys.rust;
  }
}

function moveSwarm(state: GameState, sw: Swarm, rand: () => number, blackout: number) {
  const from = sw.systemId ? state.systems[sw.systemId] : null;
  if (!from) return;
  const R = rangeLy(state);
  let best: StarSystem | null = null;
  let bestScore = 0;
  const heat = warHeat(state);
  for (const s of Object.values(state.systems)) {
    if (s.id === from.id || s.gone) continue;
    const d = distLy(from, s);
    if (d > R) continue;
    // our warmth (which a Blackout hides), any other civilization's, and the heat of a war
    const sig = signatureOf(state, s.id) * blackout + theirWarmth(state, s.id) + (heat.get(s.id) ?? 0);
    const score = ((sig + systemMatter(state, s) * 0.8 + (s.beacon ? 25 : 0)) / (1 + d / 25)) * (0.7 + rand() * 0.6);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  if (!best) return;
  sw.from = from.id;
  sw.to = best.id;
  sw.systemId = null;
  sw.traveled = 0;
  sw.distance = distLy(from, best);
}

/**
 * Something warm has been noticed at a star (a restarted relic engine): the nearest awake,
 * untamed swarm within reach that is not already travelling turns toward it. Returns its star, or
 * null if none is near enough. Takes no random draw.
 */
export function drawSwarmTo(state: GameState, systemId: string): StarSystem | null {
  const to = state.systems[systemId];
  if (!to || to.gone) return null;
  const R = rangeLy(state);
  let best: Swarm | null = null;
  let bestD = Infinity;
  for (const sw of Object.values(state.swarms)) {
    if (!sw.awake || sw.tamed || !sw.systemId || sw.systemId === to.id) continue;
    const d = distLy(state.systems[sw.systemId], to);
    if (d <= R && d < bestD) {
      best = sw;
      bestD = d;
    }
  }
  if (!best) return null;
  const from = state.systems[best.systemId!];
  best.from = from.id;
  best.to = to.id;
  best.systemId = null;
  best.traveled = 0;
  best.distance = bestD;
  return from;
}

/** A Swarm Tender at the swarm's system calms and takes command of it. */
export function tameSwarm(state: GameState, swarmId: string): string | null {
  const sw = state.swarms[swarmId];
  if (!sw || !sw.systemId) return 'The swarm is moving; wait until it settles.';
  const tender = Object.values(state.fleets).find((f) => f.at === sw.systemId && f.ships.some((s) => SHIP_BY_ID[s.cls]?.tames));
  if (!tender) return 'A Swarm Tender must be in the same system.';
  const cost = Math.round(15 + sw.size * 6);
  if (state.civ.energy < cost) return `Broadcasting the command language needs ${cost} energy.`;
  state.civ.energy -= cost;
  sw.tamed = true;
  sw.awake = true;
  state.civ.flags.tamed = (state.civ.flags.tamed ?? 0) + 1;
  log(state, `The swarm at ${state.systems[sw.systemId].name} answers the dead makers’ commands. It is yours now.`, 'good', sw.systemId);
  return null;
}

/** Fold a tamed swarm into a settlement as Lattice. Communion makes this taint you. */
export function absorbSwarm(state: GameState, swarmId: string, colonyId: string): string | null {
  const sw = state.swarms[swarmId];
  const c = state.colonies[colonyId];
  if (!sw || !sw.tamed || !c) return 'Only a tamed swarm can be absorbed.';
  if (sw.systemId !== c.systemId) return 'The swarm must be at that settlement.';
  const pops = Math.max(1, Math.round(sw.size / 1.5));
  c.pops.lattice += pops;
  c.structures.lattice_foundry = Math.max(c.structures.lattice_foundry ?? 0, Math.ceil(pops / 6));
  delete state.swarms[swarmId];
  state.civ.taint = Math.min(100, state.civ.taint + (hasCharter(state, 'communion_charter') ? 8 : 3));
  log(state, `${pops} Lattice formed from the swarm at ${c.name}. Something of its appetite comes with them.`, 'event', c.systemId);
  return null;
}
