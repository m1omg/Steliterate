// War, narrow and costly. A declaration needs the Threads' consent (an accord vote) and costs
// resolve, calm and every Thread's regard for us. The other side hears it when its light arrives,
// and so does everyone else; those who already hate us join against us and raid us. A siege is
// warships held at their first star turn after turn, while they arm; only after three turns of it
// can we try to take the star, and that is a battle we can lose. Battle heat draws the Hunger to
// both sides. While it lasts there are no pacts, no trade, no archives, no refuge. It is worth it
// only against our own people who left us (a fork), or a neighbour who keeps raiding us: then no
// one blames us much, and taking the star back carries no Taint.

import type { GameState, Survivor } from '../types';
import { THREADS } from '../types';
import { endPact, pactsWith } from './pacts';
import { distanceToThem, lightAt, raidStrength, spreadNews } from './survivors';
import { capital, clamp, log } from './util';

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

/** Why a war with them would be just, or null: our own people who left us, or a neighbour who keeps raiding us. */
export function warCause(state: GameState, sv: Survivor): string | null {
  if (sv.way === 'fork') return 'They are our own people, who left us.';
  const last = state.civ.flags[`raid_last_${sv.id}`];
  const prev = state.civ.flags[`raid_prev_${sv.id}`];
  if (last !== undefined && prev !== undefined && last - prev <= RAID_SPAN && state.turn - last <= RAID_SPAN) return 'They keep raiding us.';
  return null;
}

/** They raided us (or tried to): remembered, for a war's cause. */
export function raidedUs(state: GameState, sv: Survivor) {
  const f = state.civ.flags;
  if (f[`raid_last_${sv.id}`] !== undefined) f[`raid_prev_${sv.id}`] = f[`raid_last_${sv.id}`];
  f[`raid_last_${sv.id}`] = state.turn;
}

/** Their strength at their first star: what they are, and how long they have been arming. */
export function warDefence(state: GameState, sv: Survivor): number {
  const arming = sv.war ? state.turn - sv.war.since : 0;
  return Math.max(1, sv.pop * sv.health * 0.3) * (1 + ARMING * arming);
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
  sv.war = { since: state.turn, siege: 0 };
  civ.flags.wars = (civ.flags.wars ?? 0) + 1;
  // they hear it when the light arrives, and so does everyone else
  (sv.news ??= []).push({ at: lightAt(state, distanceToThem(state, sv)), delta: -40, what: 'you declared war on them' });
  const cap = capital(state);
  spreadNews(state, cap?.systemId ?? civ.homeSystemId, cause ? -5 : -15, `you went to war with ${sv.name}`, sv.id);
  log(state, `We declared war on ${sv.name}. ${cause ?? 'Everyone will hear of it when the light arrives.'}`, 'bad', sv.homeSystemId);
  return null;
}

/** Make peace: we stop. They hear it when the light arrives; a war's ill will takes longer to fade. */
export function makePeace(state: GameState, id: string): string | null {
  const sv = state.survivors[id];
  if (!sv || !atWar(sv)) return 'We are not at war with them.';
  delete sv.war;
  (sv.news ??= []).push({ at: lightAt(state, distanceToThem(state, sv)), delta: 10, what: 'you made peace with them' });
  const cap = capital(state);
  spreadNews(state, cap?.systemId ?? state.civ.homeSystemId, 3, `you made peace with ${sv.name}`, sv.id);
  log(state, `We made peace with ${sv.name}.`, 'info', sv.homeSystemId);
  return null;
}

/** Why we cannot try to take their star now, or null. */
export function seizeBlocked(state: GameState, sv: Survivor): string | null {
  if (!sv.alive) return 'They are gone.';
  if (!sv.war) return 'Only in a war: declare one first.';
  if (raidStrength(state, sv.homeSystemId) <= 0) return 'You need warships at their first star.';
  if (sv.war.siege < SIEGE_TURNS) return `Hold the siege: ${SIEGE_TURNS - sv.war.siege} more turn(s) of warships at their first star.`;
  return null;
}

/**
 * Each turn of war: a siege holds while our warships are at their first star (it costs them, and
 * their fire costs us); a war weighs on us; and those who hate us join against us (see the raids
 * in updateSurvivors).
 */
export function warTurn(state: GameState, chance: () => number) {
  const civ = state.civ;
  for (const sv of Object.values(state.survivors)) {
    if (!atWar(sv)) continue;
    civ.dissent = Math.min(100, civ.dissent + (warCause(state, sv) ? 0.2 : 0.5));
    const attack = raidStrength(state, sv.homeSystemId);
    if (attack <= 0) {
      sv.war!.siege = 0;
      continue;
    }
    sv.war!.siege++;
    sv.health = Math.max(0, sv.health - BLOCKADE);
    // their guns answer ours
    const def = warDefence(state, sv);
    const hurt = (def / (attack + def)) * 1.2;
    for (const f of Object.values(state.fleets)) {
      if (f.at !== sv.homeSystemId) continue;
      for (const s of f.ships) s.hp -= hurt * (0.5 + chance());
      f.ships = f.ships.filter((s) => s.hp > 0);
      if (!f.ships.length) {
        delete state.fleets[f.id];
        log(state, `${f.name} was destroyed in the siege of ${state.systems[sv.homeSystemId]?.name}.`, 'combat', sv.homeSystemId);
      }
    }
    state.battles.push({ systemId: sv.homeSystemId, turn: state.turn, text: `The siege of ${sv.name}, turn ${sv.war!.siege}.` });
  }
}

/** The heat of a war, which draws the Hunger to both sides: a star under siege, and our capital, arming. */
export function warHeat(state: GameState): Map<string, number> {
  const out = new Map<string, number>();
  if (!anyWar(state)) return out;
  const cap = capital(state);
  if (cap) out.set(cap.systemId, 8);
  for (const sv of Object.values(state.survivors)) if (atWar(sv) && raidStrength(state, sv.homeSystemId) > 0) out.set(sv.homeSystemId, (out.get(sv.homeSystemId) ?? 0) + 10);
  return out;
}

/** A civilization that hates us joins against us while we are at war with anyone. */
export function inCoalition(state: GameState, sv: Survivor): boolean {
  return !sv.war && sv.disposition < -20 && anyWar(state);
}
