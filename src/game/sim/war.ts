// War, narrow and costly. A declaration needs the Threads' consent (an accord vote) and costs
// resolve, calm and every Thread's regard for us. The other side hears it when its light arrives,
// and so does everyone else; those who already hate us join against us and raid us. A siege is
// warships held at a settlement's star turn after turn (with a neighbour that has no civilization
// of its own, an older game's, at its first star), while they arm; only after three turns of it can
// we try to take it, and that is a battle we can lose. With a civilization of its own, either side
// besieges and storms the other's settlements, whoever began it, and the battles and sieges are
// everyone's at once (conflict.ts). Battle heat draws the Hunger to both sides. While it lasts
// there are no pacts, no trade, no archives, no refuge. It is worth it only against our own people
// who left us (a fork), or a neighbour who keeps raiding us: then no one blames us much, and
// taking the star back carries no Taint.

import type { Colony, GameState, Survivor } from '../types';
import { THREADS } from '../types';
import { endPact, pactsWith } from './pacts';
import { dealSize, distanceToThem, lightAt, raidStrength, spreadNews } from './survivors';
import { allColonies, capital, clamp, fleets, log, marks } from './util';
import { isWarship, strength } from '../data/ships';
import { tacticOf } from '../data/tactics';
import { JUST_CAUSE_AT } from './judge';
import { assaultBlocked, besieged, frontOf, holdsSiege, warOver } from './conflict';

/** Accord the Threads' consent to a war costs. */
export const WAR_ACCORD = 60;
/** Consecutive turns of warships at their first star before we can try to take it. */
export const SIEGE_TURNS = 3;
/** Their defence grows by this share for every turn of war: they arm. */
export const ARMING = 0.15;
/** A turn of siege costs them this much of their prospects. */
export const BLOCKADE = 0.03;
/** Raids on us this close together (turns) make a neighbour one who keeps raiding us. */
export const RAID_SPAN = 20;

export function atWar(sv: Survivor): boolean {
  return sv.alive && sv.war !== undefined;
}

/** Whether we are at war with anyone. */
export function anyWar(state: GameState): boolean {
  return Object.values(state.survivors).some(atWar);
}

/** The cause no one holds against us: the Hunger we have heard of in them. */
export const HUNGER_CAUSE = 'The Hunger is in them.';

/** The cause of the side a war fell on, when it strikes back and takes what it can: it did not begin it. */
export const DEFENCE_CAUSE = 'They began this war.';

/** Whether we have heard of enough of the Hunger in a civilization for that to be cause for war. */
export function hungerCause(sv: Survivor): boolean {
  return (sv.taintSeen ?? 0) >= JUST_CAUSE_AT;
}

/** Why a war with them would be just, or null: our own people who left us, the Hunger in them, or a neighbour who keeps raiding us. */
export function warCause(state: GameState, sv: Survivor): string | null {
  if (sv.way === 'fork') return 'They are our own people, who left us.';
  // the Hunger heard of in a civilization of its own (judge.ts): a war on it carries no infamy
  if (hungerCause(sv)) return HUNGER_CAUSE;
  const last = sv.marks?.raid_last;
  const prev = sv.marks?.raid_prev;
  if (last !== undefined && prev !== undefined && last - prev <= RAID_SPAN && state.turn - last <= RAID_SPAN) return 'They keep raiding us.';
  return null;
}

/** They raided us (or tried to): remembered, for a war's cause. */
export function raidedUs(state: GameState, sv: Survivor) {
  const f = marks(sv);
  if (f.raid_last !== undefined) f.raid_prev = f.raid_last;
  f.raid_last = state.turn;
}

/** Their strength at their first star: what they are, and how long they have been arming. */
export function warDefence(state: GameState, sv: Survivor): number {
  const arming = sv.war ? state.turn - sv.war.since : 0;
  return Math.max(1, dealSize(state, sv) * sv.health * 0.3) * (1 + ARMING * arming);
}

/** Why we cannot declare war on them now, or null. */
export function warBlocked(state: GameState, sv: Survivor): string | null {
  if (!sv.alive) return 'They are gone.';
  if (!sv.contact) return 'We have not made contact.';
  if (sv.war) return 'We are already at war with them.';
  if (sv.exodus) return 'They are on their way to live among us.';
  if (state.civ.accord < WAR_ACCORD) return `The Threads must consent: ${WAR_ACCORD} accord.`;
  return null;
}

/** Declare war. */
export function declareWar(state: GameState, id: string): string | null {
  const sv = state.survivors[id];
  if (!sv) return 'They are gone.';
  const err = warBlocked(state, sv);
  if (err) return err;
  const civ = state.civ;
  const cause = warCause(state, sv);
  civ.accord -= WAR_ACCORD;
  civ.resolve = Math.max(0, civ.resolve - 5);
  civ.dissent = Math.min(100, civ.dissent + 8);
  for (const t of THREADS) civ.standing[t] = clamp(civ.standing[t] - (cause ? 1 : 3), 0, 100);
  // whatever was between us ends, and is heard as broken
  for (const k of pactsWith(sv)) endPact(state, sv.id, k);
  delete sv.proposal;
  delete sv.promised;
  // (with a civilization of its own, the war is fought at its settlement nearest us: conflict.ts)
  const front = state.civs[sv.id] ? frontOf(state, sv.id, civ.id) : undefined;
  sv.war = { since: state.turn, siege: 0, ...(front ? { at: front } : {}), ...(cause ? { cause } : {}) };
  civ.flags.wars = (civ.flags.wars ?? 0) + 1;
  // they hear it when the light arrives, and so does everyone else
  (sv.news ??= []).push({ at: lightAt(state, distanceToThem(state, sv)), delta: -40, what: 'you declared war on them' });
  const cap = capital(state);
  spreadNews(state, cap?.systemId ?? civ.homeSystemId, cause === HUNGER_CAUSE ? 0 : cause ? -5 : -15, `you went to war with ${sv.name}${cause === HUNGER_CAUSE ? ', for the Hunger in them' : ''}`, sv.id);
  log(state, `We declared war on ${sv.name}. ${cause ?? 'Everyone will hear of it when the light arrives.'}`, 'bad', sv.homeSystemId);
  return null;
}

/** Make peace: we stop. They hear it when the light arrives; a war's ill will takes longer to fade. */
export function makePeace(state: GameState, id: string): string | null {
  const sv = state.survivors[id];
  if (!sv || !atWar(sv)) return 'We are not at war with them.';
  // a war they began ends when they make peace: once it has gone on long enough, or badly for them (conflict.ts)
  if (sv.war!.by && sv.war!.by !== state.civ.id) return 'They began this war, and it ends when they make peace.';
  delete sv.war;
  warOver(state, sv.id);
  warOver(state, state.civ.id);
  (sv.news ??= []).push({ at: lightAt(state, distanceToThem(state, sv)), delta: 10, what: 'you made peace with them' });
  const cap = capital(state);
  spreadNews(state, cap?.systemId ?? state.civ.homeSystemId, 3, `you made peace with ${sv.name}`, sv.id);
  log(state, `We made peace with ${sv.name}.`, 'info', sv.homeSystemId);
  return null;
}

/**
 * Where we would storm a civilization of its own now: the settlement of theirs we hold the longest
 * siege on, else the one the war is fought at (its front; in a war they began, theirs nearest us),
 * if it still stands.
 */
export function stormTarget(state: GameState, sv: Survivor): Colony | undefined {
  const held = besieged(state, state.civ.id, sv.id);
  if (held) return held;
  // (a war they began is fought at ours: we strike back at theirs nearest us)
  const at = sv.war?.by && sv.war.by !== state.civ.id ? frontOf(state, sv.id, state.civ.id) : (sv.war?.at ?? sv.homeSystemId);
  return allColonies(state).find((x) => x.owner === sv.id && x.systemId === at);
}

/** Why we cannot try to take their star now, or null. */
export function seizeBlocked(state: GameState, sv: Survivor): string | null {
  if (!sv.alive) return 'They are gone.';
  if (!sv.war) return 'Only in a war: declare one first.';
  if (state.civs[sv.id]) {
    // (any settlement of theirs we hold under siege, whoever began the war: conflict.ts, assaultBlocked)
    const c = stormTarget(state, sv);
    return c ? assaultBlocked(state, state.civ.id, c) : 'They hold no settlement there now.';
  }
  if (siegeStrength(state, sv.homeSystemId) <= 0) return raidStrength(state, sv.homeSystemId) > 0 ? 'Warships standing off hold no siege: they must hold the line or close in.' : 'You need warships at their first star.';
  if (sv.war.siege < SIEGE_TURNS) return `Hold the siege: ${SIEGE_TURNS - sv.war.siege} more turn(s) of warships at their first star.`;
  return null;
}

/** The attack of our warships at a star that hold a siege there (not standing off): the siege of a neighbour without a civilization of its own. */
export function siegeStrength(state: GameState, systemId: string): number {
  let a = 0;
  for (const f of fleets(state)) if (f.at === systemId && holdsSiege(f)) for (const s of f.ships) if (isWarship(s.cls)) a += strength(s.cls, 'settlements') * tacticOf(f).dealt;
  return a;
}

/**
 * Each turn of war: a war weighs on us; and those who hate us join against us (see the raids in
 * updateSurvivors). A civilization of its own fights with what it has, everyone at once
 * (conflict.ts, battlesTurn: its battles and every siege). With a neighbour that has none (an older
 * game's), our siege holds while our warships are at its first star, holding the line or closing
 * in: it costs them, and their fire costs every ship of ours there, by its fleet's tactic.
 */
export function warTurn(state: GameState, chance: () => number) {
  const civ = state.civ;
  for (const sv of Object.values(state.survivors)) {
    if (!atWar(sv)) continue;
    civ.dissent = Math.min(100, civ.dissent + (warCause(state, sv) ? 0.2 : 0.5));
    if (state.civs[sv.id] || (sv.war!.by && sv.war!.by !== civ.id)) continue;
    const attack = siegeStrength(state, sv.homeSystemId);
    if (attack <= 0) {
      sv.war!.siege = 0;
      continue;
    }
    sv.war!.siege++;
    sv.health = Math.max(0, sv.health - BLOCKADE);
    // their guns answer ours
    const def = warDefence(state, sv);
    const hurt = (def / (attack + def)) * 1.2;
    for (const f of fleets(state)) {
      if (f.at !== sv.homeSystemId) continue;
      const taken = tacticOf(f).taken;
      for (const s of f.ships) s.hp -= hurt * (0.5 + chance()) * taken;
      f.ships = f.ships.filter((s) => s.hp > 0);
      if (!f.ships.length) {
        delete state.fleets[f.id];
        log(state, `${f.name} was destroyed in the siege of ${state.systems[sv.homeSystemId]?.name}.`, 'combat', sv.homeSystemId);
      }
    }
    state.battles.push({ systemId: sv.homeSystemId, turn: state.turn, text: `The siege of ${sv.name}, turn ${sv.war!.siege}.` });
  }
}

/** The heat of a war, which draws the Hunger to both sides: a star under siege, ours or theirs, and our capital, arming. */
export function warHeat(state: GameState): Map<string, number> {
  const out = new Map<string, number>();
  if (!anyWar(state)) return out;
  const cap = capital(state);
  if (cap) out.set(cap.systemId, 8);
  const me = state.civ.id;
  for (const c of allColonies(state)) if (c.siege && (c.owner === me || c.siege.by === me)) out.set(c.systemId, (out.get(c.systemId) ?? 0) + 10);
  for (const sv of Object.values(state.survivors)) if (atWar(sv) && !state.civs[sv.id] && siegeStrength(state, sv.homeSystemId) > 0) out.set(sv.homeSystemId, (out.get(sv.homeSystemId) ?? 0) + 10);
  return out;
}

/** A civilization that hates us joins against us while we are at war with anyone. */
export function inCoalition(state: GameState, sv: Survivor): boolean {
  return !sv.war && sv.disposition < -20 && anyWar(state);
}
