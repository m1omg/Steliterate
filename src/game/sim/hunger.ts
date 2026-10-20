import { SHIP_BY_ID, strength } from '../data/ships';
import { fleetDug, shareHurt, tacticOf } from '../data/tactics';
import { watchPartners } from './ties';
import { STRUCTURE_BY_ID, structureLabel } from '../data/structures';
import type { Colony, Fleet, GameState, StarSystem, Swarm } from '../types';
import { FORTIFY_BONUS, destroyColony, isWarFleet, signatureOf } from './fleets';
import type { Mods } from './mods';
import { allColonies, allFleets, colonies, distLy, fleets, hasCharter, log, logTo, ownColony, ownFleet, tellKnown, uid, withRng } from './util';
import { hungerAct } from './judge';
import { queueEvent } from './events';
import { foughtFor, theirWarmth } from './claims';
import { warHeat } from './war';
import { calendarEra } from '../fate';
import { swarmSpeed } from './sight';

// The Hunger: harvesters left running by a civilization that died long ago. Its makers built
// it to survive; it still does, the way a tumour does. It has no plan beyond the next meal,
// and it starves when a region is stripped. It is drawn to light and heat.

export const MAX_SWARMS = { gentle: 4, standard: 6, harsh: 8 } as const;

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

/** One civilization's defence at a star against a swarm: its settlements' grids and its warships there. */
export function defenseAt(state: GameState, systemId: string, mods: Mods, owner = state.civ.id): number {
  let d = 0;
  for (const c of allColonies(state)) {
    if (c.systemId !== systemId || c.owner !== owner) continue;
    for (const [id, n] of Object.entries(c.structures)) d += (STRUCTURE_BY_ID[id]?.defense ?? 0) * n;
  }
  for (const f of allFleets(state)) {
    if (f.at !== systemId || f.owner !== owner) continue;
    // dug in with the settlement's own grid, a fortified fleet defends twice as well; by its tactic
    const dug = fleetDug(f);
    const dealt = tacticOf(f).dealt;
    for (const s of f.ships) d += strength(s.cls, 'swarms') * (dug ? (SHIP_BY_ID[s.cls]?.dugIn ?? FORTIFY_BONUS) : 1) * dealt;
  }
  if (mods.flags.has('charter:wardens_oath')) d *= 1.5;
  // Shared Watch: a partner's warning, and a little of their strength (never a shield); the
  // neighbours' pacts are the player's
  if (owner === state.player) for (const sv of Object.values(state.survivors)) if (sv.alive && sv.pacts?.watch !== undefined) d += 0.5;
  // and another civilization's Shared Watch partners among the others (ties.ts)
  else d += 0.5 * watchPartners(state, owner);
  return d;
}

/** Each civilization's mods (or one civilization's, for all: the checks). */
export type ModsBy = Mods | ((id: string) => Mods);
function byCiv(m: ModsBy): (id: string) => Mods {
  return typeof m === 'function' ? m : () => m;
}

/** Whether a civilization lives under the Communion Charter: the swarms take it for their own. */
function communes(state: GameState, id: string): boolean {
  return !!state.civs[id]?.charters.includes('communion_charter');
}

/** The stars each civilization has settled (`settledBy(state)(id)`), worked out once. */
function settledBy(state: GameState): (id: string) => Set<string> {
  const by = new Map<string, Set<string>>();
  for (const c of allColonies(state)) {
    if (!by.has(c.owner)) by.set(c.owner, new Set());
    by.get(c.owner)!.add(c.systemId);
  }
  return (id) => by.get(id) ?? new Set();
}

/**
 * The first swarm one of our ships comes near, asleep or awake. Often a part of it comes for the
 * ship (a warship can kill it there; anything else is mauled but gets away) and what is left of
 * that part goes for the nearest warmth, our settlements; sometimes it lets the ship go.
 */
export function firstSwarm(state: GameState) {
  if (state.civ.flags.first_swarm) return;
  for (const f of fleets(state)) {
    if (!f.at) continue;
    const here = state.systems[f.at];
    // a swarm notices a warm ship anywhere nearby, not only in its own system
    const sw = Object.values(state.swarms).find((w) => w.systemId && !w.tamed && distLy(here, state.systems[w.systemId]) <= FIRST_SWARM_REACH);
    if (!sw) continue;
    const nest = state.systems[sw.systemId!];
    state.civ.flags.first_swarm = state.turn;
    if (!state.civ.known[nest.id]) state.civ.known[nest.id] = 1;
    let outcome = '';
    // under the Communion Charter it takes us for its own
    if (communes(state, state.civ.id)) {
      outcome = `It knew ${f.name} for one of its own, and let it be.`;
      log(state, `${f.name} came near the swarm at ${nest.name}. Under the Communion Charter it knew the ship for one of its own.`, 'info', here.id);
    } else withRng(state, (rng) => {
      // not every swarm cares: some let the ship go, for now
      if (!rng.chance(0.55)) {
        outcome = `It paid ${f.name} no attention. Yet.`;
        log(state, `${f.name} came near the swarm at ${nest.name}. It did not react.`, 'info', here.id);
        return;
      }
      const size = Math.min(1.6, Math.max(1, sw.size * 0.3));
      sw.size = Math.max(0.8, sw.size - size * 0.5);
      const frag: Swarm = { id: uid(state, 'sw'), systemId: here.id, from: null, to: null, traveled: 0, distance: 0, size, awake: true, tamed: false, appetite: sw.appetite };
      const attack = f.ships.reduce((a, s) => a + strength(s.cls, 'swarms'), 0);
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
      const target = nearestSettlement(state, here);
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

/** The star of our settlement nearest to this one (it may be this one); null if we have none. */
function nearestSettlement(state: GameState, here: StarSystem): StarSystem | null {
  return (
    colonies(state)
      .map((c) => state.systems[c.systemId])
      .sort((a, b) => distLy(here, a) - distLy(here, b))[0] ?? null
  );
}

/**
 * How far an awake swarm notices one of our ships stopped at another star (ly). Neighbouring stars
 * are about 17 ly apart; at 25, nearly every swarm has a star or two in reach (the player's ask,
 * 11 Oct: "swarm never really attacks my ship", when it sat at a star near one).
 */
export const HUNT_REACH = 25;
/** Each turn, how likely an awake swarm is to send part of itself after the nearest such ship. */
export const HUNT_NOTICE = 0.3;
/** A swarm smaller than this has nothing to spare for a hunt. */
export const HUNT_MIN_SIZE = 2;

/**
 * An awake swarm notices the nearest of our ships stopped within HUNT_REACH, at a star where we
 * have no settlement and no swarm sits, and may send part of itself after it, as the first swarm
 * does. The part keeps after that ship (`prey`): it strikes it wherever it finds it stopped
 * (`swarmsHunt`), and once the ship is gone it goes on to the ship's nearest settlement (`loseTheScent`). One part per
 * ship; not before the first swarm's own moment; noticed half as often under the Blackout.
 */
function sendHunter(state: GameState, sw: Swarm, sys: StarSystem, rng: { chance(p: number): boolean }, noticed: (owner: string) => number) {
  if (sw.size < HUNT_MIN_SIZE) return;
  // a ship's own civilization must have had its first swarm's moment, and not live in Communion
  const ready = (id: string) => {
    const o = state.civs[id];
    return !!o && !!o.flags.first_swarm && o.flags.first_swarm !== state.turn && !communes(state, id);
  };
  const settled = settledBy(state);
  const held = new Set(Object.values(state.swarms).filter((w) => w.systemId && !w.tamed).map((w) => w.systemId!));
  const hunted = new Set(Object.values(state.swarms).map((w) => w.prey));
  let prey: Fleet | null = null;
  let best = Infinity;
  for (const f of allFleets(state)) {
    if (!f.at || !f.ships.length || !ready(f.owner) || settled(f.owner).has(f.at) || held.has(f.at) || hunted.has(f.id)) continue;
    const d = distLy(sys, state.systems[f.at]);
    if (d <= HUNT_REACH && d < best) {
      prey = f;
      best = d;
    }
  }
  if (!prey || !rng.chance(HUNT_NOTICE * noticed(prey.owner))) return;
  const there = state.systems[prey.at!];
  const size = Math.min(1.6, Math.max(1, sw.size * 0.3));
  sw.size -= size;
  const part: Swarm = { id: uid(state, 'sw'), systemId: null, from: sys.id, to: there.id, traveled: 0, distance: best, size, awake: true, tamed: false, appetite: sw.appetite, prey: prey.id, nest: sw.id, preyOwner: prey.owner };
  state.swarms[part.id] = part;
  // its ship sees it coming, and where from
  const owner = state.civs[prey.owner];
  if (!owner.known[sys.id]) owner.known[sys.id] = 1;
  logTo(state, owner, `Part of the swarm at ${sys.name} broke away and is coming for ${prey.name} at ${there.name}.`, 'bad', there.id, prey.id);
}

/** Where a part's swarm is, or is going (null: it is gone or tamed, and the part is on its own). */
function nestStar(state: GameState, sw: Swarm): string | null {
  const nest = sw.nest ? state.swarms[sw.nest] : null;
  return nest && !nest.tamed ? nest.systemId ?? nest.to : null;
}

/** Send a part on its way to its swarm (true), or, with its swarm gone, leave it here on its own. */
function headForNest(state: GameState, sw: Swarm): boolean {
  const to = nestStar(state, sw);
  if (!to || !sw.systemId) {
    delete sw.nest;
    return false;
  }
  const here = state.systems[sw.systemId];
  sw.from = here.id;
  sw.to = to;
  sw.systemId = null;
  sw.traveled = 0;
  sw.distance = distLy(here, state.systems[to]);
  return true;
}

/** The star of this civilization's settlement nearest to `here` (it may be `here`); null if it has none. */
function nearestOf(state: GameState, owner: string, here: StarSystem): StarSystem | null {
  let best: StarSystem | null = null;
  let d = Infinity;
  for (const c of allColonies(state)) {
    if (c.owner !== owner) continue;
    const s = state.systems[c.systemId];
    const x = distLy(here, s);
    if (x < d) {
      best = s;
      d = x;
    }
  }
  return best;
}

/**
 * A part sent after a ship, where the ship is not (moved on, or gone): it forgets it and goes on to
 * the warmth the ship came from, the nearest settlement of the ship's civilization, as the first
 * swarm's part does, a swarm of its own from then on. With none to go to, it goes back to the swarm
 * it broke away from (`nest`), following it if it has moved on; with that swarm gone or tamed, it
 * stays where it is as a swarm of its own. True if it set off (false where it stays: the ship's
 * people settled right there, and it turns on them as any swarm). Takes no random draw.
 *
 * (11 Oct it went back to its swarm, the gentler version, chosen then; 14 Oct, the player: "make
 * it harder pls".)
 */
function loseTheScent(state: GameState, sw: Swarm): boolean {
  if (!sw.prey || !sw.systemId) return false;
  const f = state.fleets[sw.prey];
  if (f && f.at === sw.systemId && f.ships.length) return false;
  delete sw.prey;
  const here = state.systems[sw.systemId];
  const owner = state.civs[f?.owner ?? sw.preyOwner ?? state.player];
  delete sw.preyOwner;
  const what = f ? `What came for ${f.name} at ${here.name} found it gone` : `What came for our ship at ${here.name} has had it`;
  const warmth = owner && !communes(state, owner.id) ? nearestOf(state, owner.id, here) : null;
  if (warmth) {
    delete sw.nest;
    // (the ship's people settled right here, an ark that came down: it turns on them where it is)
    if (warmth.id === here.id) {
      logTo(state, owner, `${what}, and has turned on our settlement there.`, 'bad', here.id, f?.id);
      return false;
    }
    sw.from = here.id;
    sw.to = warmth.id;
    sw.systemId = null;
    sw.traveled = 0;
    sw.distance = distLy(here, warmth);
    logTo(state, owner, `${what}, and is heading for the warmth of ${warmth.name}.`, 'bad', warmth.id, f?.id);
    return true;
  }
  if (!headForNest(state, sw)) return false;
  if (owner) logTo(state, owner, `${what}, and is going back to its swarm.`, 'info', here.id, f?.id);
  return true;
}

/**
 * A part on its way back, arrived: where its swarm sits, it rejoins it (true); if the swarm has
 * moved on, it follows (true); with the swarm gone, it stays here on its own. Takes no random draw.
 */
function rejoin(state: GameState, sw: Swarm): boolean {
  if (!sw.nest || sw.prey || !sw.systemId) return false;
  const nest = state.swarms[sw.nest];
  if (nest && !nest.tamed && nest.systemId === sw.systemId) {
    nest.size += sw.size;
    delete state.swarms[sw.id];
    return true;
  }
  return headForNest(state, sw);
}

/**
 * Every ship of ours at this star takes a hit (one draw each); a fleet that loses ships says so.
 * Defenders who drive a swarm back are scratched; when it breaks through, the ships there share
 * the settlement's losses (11 Oct: before, they came through a lost fight untouched).
 */
function hurtShipsAt(state: GameState, sys: StarSystem, hit: () => number, owner: string) {
  const civ = state.civs[owner];
  for (const f of allFleets(state)) {
    if (f.at !== sys.id || f.owner !== owner) continue;
    const before = f.ships.length;
    // (by its tactic: the same draws, its share of them, an Escort's warships taking the unarmed's)
    const hurt = shareHurt(f, f.ships.map(() => hit()));
    f.ships.forEach((s, i) => (s.hp -= hurt[i]));
    f.ships = f.ships.filter((s) => s.hp > 0);
    if (!f.ships.length) {
      delete state.fleets[f.id];
      if (before) logTo(state, civ, `${f.name} was lost in the fighting at ${sys.name}.`, 'combat', sys.id, f.id);
    } else if (f.ships.length < before) {
      const gone = before - f.ships.length;
      logTo(state, civ, `${f.name} lost ${gone} ship${gone === 1 ? '' : 's'} in the fighting at ${sys.name}.`, 'combat', sys.id, f.id);
    }
  }
}

/** Each turn, how likely a swarm is to go for a ship stopped in its system: awake, and asleep. */
export const HUNT_AWAKE = 0.7;
export const HUNT_ASLEEP = 0.2;

/**
 * Swarms catch ships. A ship stopped where a swarm sits, with no settlement of ours there to
 * fight beside it, is often attacked: a warship may beat it off and salvage what it kills;
 * anything else is torn apart unless the swarm is small. It runs as ships arrive, before
 * exploring probes set off again, so a probe that surveys a swarm's star is at risk.
 */
export function swarmsHunt(state: GameState, mods: ModsBy) {
  const modsOf = byCiv(mods);
  const settled = settledBy(state);
  withRng(state, (rng) => {
    for (const sw of Object.values(state.swarms)) {
      if (!sw.systemId || sw.tamed) continue;
      const sys = state.systems[sw.systemId];
      if (!sys || sys.gone) continue;
      for (const f of allFleets(state)) {
        // (a Kinetic Lance does not stop where it strikes)
        if (f.at !== sys.id || !f.ships.length || f.order === 'strike') continue;
        // its civilization's first swarm has its own moment (firstSwarm); under Communion they take
        // it for their own; and a ship where it has a settlement fights beside it (updateHunger)
        const owner = state.civs[f.owner];
        if (!owner || owner.flags.first_swarm === state.turn || communes(state, f.owner) || settled(f.owner).has(sys.id)) continue;
        const dark = modsOf(f.owner).flags.has('charter:blackout') ? 0.5 : 1;
        // a part sent after this very ship strikes it surely
        if (sw.prey !== f.id && !rng.chance((sw.awake ? HUNT_AWAKE : HUNT_ASLEEP) * dark)) continue;
        const what = sw.awake ? 'The swarm' : 'Something asleep';
        const dug = fleetDug(f);
        const dealt = tacticOf(f).dealt;
        const attack = f.ships.reduce((a, s) => a + strength(s.cls, 'swarms') * (dug ? (SHIP_BY_ID[s.cls]?.dugIn ?? FORTIFY_BONUS) : 1) * dealt, 0);
        if (attack > 0 && attack >= sw.size * 1.2 * rng.range(0.6, 1.1)) {
          const lost = Math.min(sw.size, attack * 0.3);
          sw.size -= lost;
          owner.matter += lost * 2;
          const scratch = shareHurt(f, f.ships.map(() => rng.range(0, sw.size * 0.3)));
          f.ships.forEach((s, i) => (s.hp = Math.max(1, s.hp - scratch[i])));
          logTo(state, owner, `${what} at ${sys.name} came for ${f.name}, and ${f.name} beat it off (+${Math.round(lost * 2)} salvaged matter).`, 'combat', sys.id, f.id);
          state.battles.push({ systemId: sys.id, turn: state.turn, text: `${f.name} beat off the swarm.` });
          // (the neighbours who see it are the player's)
          const mine = f.owner === state.player;
          if (sw.size <= 0.4) {
            delete state.swarms[sw.id];
            logTo(state, owner, `The swarm at ${sys.name} is broken.`, 'good', sys.id);
            if (mine) foughtFor(state, sys.id, true);
            break;
          }
          if (mine) foughtFor(state, sys.id, false);
          continue;
        }
        // torn apart, unless the swarm is small
        const before = f.ships.length;
        const torn = shareHurt(f, f.ships.map(() => rng.range(0.6, 1.2) * sw.size * 0.8));
        f.ships.forEach((s, i) => (s.hp -= torn[i]));
        f.ships = f.ships.filter((s) => s.hp > 0);
        if (!f.ships.length) {
          delete state.fleets[f.id];
          logTo(state, owner, `${what} at ${sys.name} caught ${f.name}. Nothing came back.`, 'combat', sys.id, f.id);
        } else {
          const gone = before - f.ships.length;
          logTo(state, owner, `${what} at ${sys.name} caught ${f.name}${gone ? `: ${gone} ship${gone === 1 ? '' : 's'} lost` : ''}. What is left is damaged, and still there.`, 'combat', sys.id, f.id);
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

/** Every warship of ours at this star, their attack added up (at their plain strength: attacking, they leave any fortifications; by each fleet's tactic). */
export function warshipsAt(state: GameState, systemId: string): { fleets: Fleet[]; attack: number } {
  const here = fleets(state).filter((x) => x.at === systemId && isWarFleet(x));
  const attack = here.reduce((a, x) => a + x.ships.reduce((b, sh) => b + (SHIP_BY_ID[sh.cls]?.settles ? 0 : strength(sh.cls, 'swarms')), 0) * tacticOf(x).dealt, 0);
  return { fleets: here, attack };
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
  const f = ownFleet(state, fleetId);
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
      for (const x of fleets) {
        const scratch = shareHurt(x, x.ships.map(() => rng.range(0, sw.size * 0.3)));
        x.ships.forEach((sh, i) => (sh.hp = Math.max(1, sh.hp - scratch[i])));
      }
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
        const torn = shareHurt(x, x.ships.map(() => rng.range(0.6, 1.2) * sw.size * 0.8));
        x.ships.forEach((sh, i) => (sh.hp -= torn[i]));
        x.ships = x.ships.filter((sh) => sh.hp > 0);
        gone += before - x.ships.length;
        if (!x.ships.length) delete state.fleets[x.id];
      }
      result = { ok: false, text: `Our warships went for the swarm at ${sys.name}, and it was too much for them${gone ? `: ${gone} ship${gone === 1 ? '' : 's'} lost` : ''}. What is left is hurt.` };
    }
  });
  const mine = state.civ.id === state.player;
  if (broke) {
    delete state.swarms[sw.id];
    if (mine) foughtFor(state, sys.id, true);
  } else {
    if (result.ok && mine) foughtFor(state, sys.id, false);
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

/**
 * The Hunger's turn, once for everyone: swarms wake, travel, feed, grow, strike the settlements at
 * their star (each civilization's by its own defence, the player's first), hunt ships nearby, bud
 * and move on toward warmth. A civilization under Communion is spared, and a swarm it tamed
 * works for it; a Blackout hides its warmth and its ships.
 */
export function updateHunger(state: GameState, L: number, mods: ModsBy, share = 1) {
  const modsOf = byCiv(mods);
  const swarms = Object.values(state.swarms);
  const maxSwarms = MAX_SWARMS[state.settings.difficulty];
  const ids = [state.player, ...Object.keys(state.civs).filter((id) => id !== state.player).sort()];
  // swarms fed by a civilization in Communion eat the commons faster
  const communion = ids.some((id) => communes(state, id));
  const blackout = (id: string) => (modsOf(id).flags.has('charter:blackout') ? 0.3 : 1);
  const noticed = (id: string) => (modsOf(id).flags.has('charter:blackout') ? 0.5 : 1);

  withRng(state, (rng) => {
    for (const sw of swarms) {
      // waking
      if (!sw.awake) {
        const p = calendarEra(state) === 'dusk' ? (state.eraTurn > 18 ? 0.035 : 0) : 0.1;
        if (rng.chance(p)) {
          sw.awake = true;
          const sys = sw.systemId ? state.systems[sw.systemId] : null;
          if (sys) tellKnown(state, sys.id, `Something has begun eating the worlds of ${sys.name}.`, 'bad');
          state.flags.hunger_woke = (state.flags.hunger_woke ?? 0) + 1;
        }
        continue;
      }
      // travelling
      if (!sw.systemId && sw.to) {
        const step = isFinite(L) ? swarmSpeed(state) * L : Infinity;
        sw.traveled += step;
        if (sw.traveled >= sw.distance) {
          sw.systemId = sw.to;
          sw.to = null;
          sw.from = null;
          sw.traveled = 0;
          const sys = state.systems[sw.systemId];
          // a part back with its swarm rejoins it; one whose ship is not here turns back
          if (rejoin(state, sw) || loseTheScent(state, sw)) continue;
          // come to a settlement under the Communion Charter, it merges into its Lattice
          if (!sw.tamed && commune(state, sw, ids)) continue;
          for (const v of Object.values(state.civs)) {
            if (!v.known[sys.id]) continue;
            const ours = sw.tamed && (sw.tamedBy ?? state.player) === v.id;
            logTo(state, v, `A ${sw.tamed ? (ours ? 'swarm under your command' : 'tamed swarm') : 'swarm'} has arrived at ${sys.name}.`, sw.tamed ? 'info' : 'bad', sys.id);
          }
        }
        continue;
      }
      const sys = sw.systemId ? state.systems[sw.systemId] : null;
      if (!sys || sys.gone) {
        delete state.swarms[sw.id];
        continue;
      }

      // tamed swarms work for whoever tamed them, and may relapse (what they bring, and the Taint
      // of feeding them, by the Tide turns the turn covers, as the bites below)
      if (sw.tamed) {
        const tamer = state.civs[sw.tamedBy ?? state.player];
        const its = !!tamer && communes(state, tamer.id);
        if (tamer) {
          tamer.matter += sw.size * (its ? 0.8 : 0.4) * share;
          // communing with them is a Hunger act, heard of a point of Taint at a time (judge.ts)
          if (its) {
            const fed = (tamer.flags.taint_fed ?? 0) + 0.12 * sw.size * share;
            const whole = Math.floor(fed);
            tamer.flags.taint_fed = fed - whole;
            if (whole > 0) hungerAct(state, tamer.id, whole, sys.id, 'communed with the swarms');
          }
        }
        const relapse = (tamer && modsOf(tamer.id).flags.has('charter:lattice_compact')) || its ? 0.005 : 0.02;
        if (rng.chance(relapse)) {
          sw.tamed = false;
          delete sw.tamedBy;
          if (tamer) logTo(state, tamer, `A tamed swarm at ${sys.name} has slipped its commands. It is hungry again.`, 'bad', sys.id);
        }
        continue;
      }

      // sent after a ship that has gone: on to the ship's people, or back to its swarm
      if (loseTheScent(state, sw)) continue;
      // at a settlement under the Communion Charter (enacted since it came), it merges in
      if (commune(state, sw, ids)) continue;

      // eat
      const matter = systemMatter(state, sys);
      // (what a swarm eats and how it rusts a system, by the Tide turns the turn covers: the same
      // in a year whatever the pace, since 20 Oct)
      const bite = Math.min(matter, 0.05 * sw.size * share);
      for (const bid of sys.bodies) {
        const b = state.bodies[bid];
        if (!b || b.dissolved || b.kind === 'deep') continue;
        b.richness = Math.max(0, b.richness - bite * 0.3);
        b.hydrogen = Math.max(0, b.hydrogen - bite * 0.15);
      }
      state.gfe = Math.max(0.05, state.gfe - 0.00006 * sw.size * share * (communion ? 1.5 : 1));
      sys.rust = Math.min(1, (sys.rust ?? 0) + (0.04 + sw.size * 0.004) * share);
      // logistic growth limited by what is left here; starvation shrinks it
      const cap = 3 + matter * 2.2;
      sw.size += 0.1 * sw.size * (1 - sw.size / Math.max(1, cap));
      if (matter < 0.6) sw.size -= 0.25;
      if (sw.size <= 0.4) {
        for (const v of Object.values(state.civs)) logTo(state, v, `The swarm at ${sys.name} has starved and gone still.`, 'good', sys.id);
        delete state.swarms[sw.id];
        continue;
      }

      // collide with settlements: each civilization's here, by its own defence (the player's first)
      let broken = false;
      for (const id of ids) {
        const here = allColonies(state).filter((c) => c.systemId === sys.id && c.owner === id);
        if (!here.length || communes(state, id)) continue;
        const civ = state.civs[id];
        const def = defenseAt(state, sys.id, modsOf(id), id);
        const power = sw.size * 1.2;
        if (def >= power * rng.range(0.6, 1.1)) {
          const lost = Math.min(sw.size, def * 0.3);
          sw.size -= lost;
          civ.matter += lost * 2;
          state.battles.push({ systemId: sys.id, turn: state.turn, text: `Defenders drove back the swarm (+${(lost * 2).toFixed(0)} salvaged matter).` });
          logTo(state, civ, `Defenders at ${sys.name} drove back the swarm and salvaged its dead.`, 'combat', sys.id);
          // damage escorts
          hurtShipsAt(state, sys, () => rng.range(0, sw.size * 0.4), id);
          if (sw.size <= 0.4) {
            delete state.swarms[sw.id];
            broken = true;
            break;
          }
        } else {
          const c = rng.pick(here);
          const structs = Object.keys(c.structures).filter((k) => c.structures[k] > 0 && k !== 'shipyard');
          if (structs.length) {
            const k = rng.weighted(structs, (s) => (STRUCTURE_BY_ID[s]?.signature ?? 1) + 0.5);
            c.structures[k]--;
            if (c.structures[k] <= 0) delete c.structures[k];
            logTo(state, civ, `The swarm stripped ${structureLabel(k, sys).name} at ${c.name}.`, 'combat', sys.id);
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
          // the ships there fought beside it, and share its losses
          hurtShipsAt(state, sys, () => rng.range(0.2, 0.6) * sw.size, id);
          sw.size += 0.5;
          state.battles.push({ systemId: sys.id, turn: state.turn, text: 'The swarm broke through.' });
        }
      }
      if (broken) continue;
      // survivors suffer too (less, with our watch beside theirs)
      for (const sv of Object.values(state.survivors)) {
        if (sv.alive && !state.civs[sv.id] && sv.systems.includes(sys.id)) sv.health = Math.max(0, sv.health - 0.012 * sw.size * (sv.pacts?.watch !== undefined ? 0.7 : 1));
      }

      // a ship stopped nearby: part of it may go after the ship
      if (!sw.prey) sendHunter(state, sw, sys, rng, noticed);

      // bud
      if (sw.size > 9 && Object.keys(state.swarms).length < maxSwarms) {
        sw.size /= 2;
        const child: Swarm = { id: uid(state, 'hg'), systemId: sys.id, from: null, to: null, traveled: 0, distance: 0, size: sw.size, awake: true, tamed: false, appetite: 1 };
        state.swarms[child.id] = child;
        moveSwarm(state, child, () => rng.next(), blackout);
      }
      // move on when the pickings are thin (not while the ship it came for is here)
      if (!sw.prey && (matter < 1.2 || rng.chance(0.08))) moveSwarm(state, sw, () => rng.next(), blackout);
    }
  });
  fadeRust(state, share);
}

/** Rust fades by this share a turn where no swarm of the Hunger is. */
export const RUST_FADE = 0.1;

/**
 * Where no untamed swarm is (feeding, or asleep in its nest), rust fades, a tenth a turn at the
 * Tide (by the Tide turns the turn covers, as it builds), and is gone below 1%: about 45 Tide
 * turns after a swarm fed its fill. Takes no random draw.
 */
function fadeRust(state: GameState, share: number) {
  const held = new Set(Object.values(state.swarms).filter((w) => !w.tamed && w.systemId).map((w) => w.systemId!));
  for (const sys of Object.values(state.systems)) {
    if (!sys.rust || held.has(sys.id)) continue;
    sys.rust *= share === 1 ? 1 - RUST_FADE : Math.pow(1 - RUST_FADE, share);
    if (sys.rust < 0.01) delete sys.rust;
  }
}

function moveSwarm(state: GameState, sw: Swarm, rand: () => number, blackout: (id: string) => number) {
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
    // every civilization's warmth (each one's Blackout hides its own), the neighbours', and the heat of a war
    let sig = theirWarmth(state, s.id) + (heat.get(s.id) ?? 0);
    for (const id of Object.keys(state.civs)) sig += signatureOf(state, s.id, id) * blackout(id);
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
  delete best.prey;
  delete best.nest;
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
  const tender = fleets(state).find((f) => f.at === sw.systemId && f.ships.some((s) => SHIP_BY_ID[s.cls]?.tames));
  if (!tender) return 'A Swarm Tender must be in the same system.';
  const cost = Math.round(15 + sw.size * 6);
  if (state.civ.energy < cost) return `Broadcasting the command language needs ${cost} energy.`;
  state.civ.energy -= cost;
  sw.tamed = true;
  sw.tamedBy = state.civ.id;
  sw.awake = true;
  delete sw.prey;
  delete sw.nest;
  delete sw.preyOwner;
  state.civ.flags.tamed = (state.civ.flags.tamed ?? 0) + 1;
  log(state, `The swarm at ${state.systems[sw.systemId].name} answers the dead makers’ commands. It is yours now.`, 'good', sw.systemId);
  return null;
}

/** Fold a tamed swarm into a settlement as Lattice. Communion makes this taint you. */
export function absorbSwarm(state: GameState, swarmId: string, colonyId: string): string | null {
  const sw = state.swarms[swarmId];
  const c = ownColony(state, colonyId);
  if (!sw || !sw.tamed || !c || (sw.tamedBy ?? state.player) !== state.civ.id || c.owner !== state.civ.id) return 'Only a tamed swarm can be absorbed.';
  if (sw.systemId !== c.systemId) return 'The swarm must be at that settlement.';
  const pops = foldIn(state, sw, c, hasCharter(state, 'communion_charter') ? COMMUNION_TAINT : 3);
  log(state, `${pops} Lattice formed from the swarm at ${c.name}. Something of its appetite comes with them.`, 'event', c.systemId);
  return null;
}

/** What a swarm taken in under the Communion Charter adds to its taker's Taint. */
export const COMMUNION_TAINT = 8;

/** A swarm folded into a settlement as Lattice (a Lattice Foundry to keep them), and gone; its appetite taints the settlement's people. Returns the Lattice made. */
function foldIn(state: GameState, sw: Swarm, c: Colony, taint: number): number {
  const pops = Math.max(1, Math.round(sw.size / 1.5));
  c.pops.lattice += pops;
  c.structures.lattice_foundry = Math.max(c.structures.lattice_foundry ?? 0, Math.ceil(pops / 6));
  delete state.swarms[sw.id];
  hungerAct(state, c.owner, taint, c.systemId, 'took a swarm in');
  return pops;
}

/**
 * The Communion Charter ("Swarms merge into your Lattice instead of attacking you"): an untamed
 * swarm at a star where a civilization under it has a settlement merges into that settlement, as
 * an absorbed swarm does, with no taming, and its appetite comes with it. The first such
 * civilization in turn order takes it, at its first settlement there. No draw.
 */
function commune(state: GameState, sw: Swarm, ids: string[]): boolean {
  if (sw.tamed || !sw.systemId) return false;
  for (const id of ids) {
    if (!communes(state, id)) continue;
    const c = allColonies(state).find((x) => x.systemId === sw.systemId && x.owner === id);
    if (!c) continue;
    const pops = foldIn(state, sw, c, COMMUNION_TAINT);
    const civ = state.civs[id];
    if (civ) logTo(state, civ, `A swarm came to ${c.name} and merged into its Lattice: ${pops} Lattice, and something of its appetite with them.`, 'event', c.systemId);
    return true;
  }
  return false;
}
