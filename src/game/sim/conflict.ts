// War between any two civilizations (the new version, part 2c-2). Between us and another, the war
// is on its Survivor record (`sv.war`), as it always was; between two others, on their tie
// (`Tie.war`). By the same rules for everyone: the Threads' consent and its costs, the pacts
// between them ended, infamy at the speed of light (none for a war on the Hunger in them).
//
// Wherever warships of two civilizations at war are stopped at the same star, or warships at an
// enemy's settlement, they fight, once a turn and all of it at once (`battlesTurn`, in the
// universe's part of the turn): each side's fire is its warships' strength against ships (dug in,
// a fortified ship's own bonus) and a settlement's defences, on a draw; it falls on the hulls of
// the other side, each by its share. Warships holding a settlement's star with none of its owner's
// left there besiege it: its owner's stores and will run down while the siege holds. (Our sieges of
// the others' first stars count in `warTurn`, as before; a war they began, here.)

import { STRUCTURE_BY_ID } from '../data/structures';
import { SHIP_BY_ID, isWarship, strength } from '../data/ships';
import type { Colony, Fleet, GameState, Ship, War } from '../types';
import { THREADS } from '../types';
import { send } from '../civs';
import { FORTIFY_BONUS, destroyColony, newFleet, orderMove, screenAt } from './fleets';
import { endCiv, fleetSeen, settlementSeen } from './others';
import { sendSignal } from './signals';
import { distanceToThem, spreadNews, voice } from './survivors';
import { distanceBetween, hearOf, lightIn, othersPlaying, tieKey, tieOf } from './ties';
import { allColonies, allFleets, clamp, distLy, log, logTo, popsOf } from './util';
import { hashSeed } from '../rng';
import { BLOCKADE, HUNGER_CAUSE, SIEGE_TURNS, WAR_ACCORD } from './war';
import { CORRUPT_AT, hungerAct } from './judge';

/** The share of a side's fire that lands on the other's hulls in a turn of battle. */
export const FIRE = 0.5;

/** The war between two civilizations, if any: ours with another on its record, two others' on their tie (none once either's game is over). */
export function warOf(state: GameState, a: string, b: string): War | undefined {
  if (a === b) return undefined;
  if (a === state.player || b === state.player) {
    const sv = state.survivors[a === state.player ? b : a];
    return sv?.alive ? sv.war : undefined;
  }
  if (state.civs[a]?.outcome || state.civs[b]?.outcome) return undefined;
  return state.ties?.[tieKey(a, b)]?.war;
}

/** Whether two civilizations are at war. */
export function atWarWith(state: GameState, a: string, b: string): boolean {
  return !!warOf(state, a, b);
}

/** Every civilization still playing that is at war with this one. */
export function enemiesOf(state: GameState, id: string): string[] {
  return Object.keys(state.civs).filter((o) => o !== id && !state.civs[o].outcome && atWarWith(state, id, o));
}

/** A civilization's settlement nearest another's capital: where a war on it would be fought. */
export function frontOf(state: GameState, target: string, from: string): string | undefined {
  const home = capitalSystem(state, from);
  const theirs = allColonies(state).filter((c) => c.owner === target);
  if (!theirs.length) return undefined;
  if (!home) return theirs[0].systemId;
  const d = (id: string) => (state.systems[id] ? distLy(state.systems[id], home) : Infinity);
  return theirs.map((c) => c.systemId).sort((x, y) => d(x) - d(y))[0];
}

function capitalSystem(state: GameState, id: string) {
  const civ = state.civs[id];
  const cap = civ?.capitalId ? state.colonies[civ.capitalId] : undefined;
  return state.systems[cap?.systemId ?? civ?.homeSystemId ?? ''];
}

/** What a civilization's warships fight with against ships: their strength, fortified ones dug in. */
export function fleetFire(f: Fleet): number {
  const dug = f.order === 'fortify';
  return f.ships.reduce((a, s) => a + (isWarship(s.cls) ? strength(s.cls, 'ships') * (dug ? (SHIP_BY_ID[s.cls]?.dugIn ?? FORTIFY_BONUS) : 1) : 0), 0);
}

/** What stands for a civilization at a star: its warships stopped there and its settlements' defences. */
export function guardAt(state: GameState, systemId: string, owner: string): number {
  let g = 0;
  for (const f of allFleets(state)) if (f.owner === owner && f.at === systemId) g += fleetFire(f);
  for (const c of allColonies(state)) {
    if (c.owner !== owner || c.systemId !== systemId) continue;
    for (const [id, n] of Object.entries(c.structures)) g += (STRUCTURE_BY_ID[id]?.defense ?? 0) * n;
  }
  return g;
}

/**
 * Another civilization declares war (ours is `declareWar`, war.ts): the Threads' consent (WAR_ACCORD)
 * and what it costs, as ours does; the pacts between them end; the one it falls on thinks far less
 * of it, and everyone else hears of it when the light arrives (no infamy for the Hunger in them).
 * `at`: the star the war will be fought at, the settlement of theirs nearest its capital unless
 * given; `motive`, why it began it (part 2d). Returns why not, or null.
 */
export function declareOn(state: GameState, by: string, on: string, cause?: string, at?: string, motive?: War['motive']): string | null {
  const civ = state.civs[by];
  const them = state.civs[on];
  if (!civ || !them || by === state.player) return 'Not a civilization of its own.';
  if (atWarWith(state, by, on)) return 'Already at war.';
  if (civ.accord < WAR_ACCORD) return `The Threads must consent: ${WAR_ACCORD} accord.`;
  const front = at ?? frontOf(state, on, by);
  if (!front) return 'Nowhere to fight them.';
  civ.accord -= WAR_ACCORD;
  civ.resolve = Math.max(0, civ.resolve - 5);
  civ.dissent = Math.min(100, civ.dissent + 8);
  for (const t of THREADS) civ.standing[t] = clamp(civ.standing[t] - (cause ? 1 : 3), 0, 100);
  civ.flags.wars = (civ.flags.wars ?? 0) + 1;
  const war: War = { since: state.turn, siege: 0, by, at: front, ...(cause ? { cause } : {}), ...(motive ? { motive } : {}) };
  if (motive) civ.flags[`war_${motive}`] = (civ.flags[`war_${motive}`] ?? 0) + 1;
  const why = cause ? ` ${cause}` : motive === 'desperate' ? ' We are dying, and you have what we need.' : '';
  if (on === state.player) {
    // on us: what was between us ends, and their declaration crosses to us as light
    const sv = state.survivors[by];
    delete sv.pacts;
    delete sv.proposal;
    delete sv.promised;
    sv.war = war;
    sv.disposition = Math.min(sv.disposition, -40);
    sendSignal(state, {
      from: by,
      kind: 'war_on_us',
      distanceLy: distanceToThem(state, sv),
      to: state.player,
      title: `${sv.name} has declared war on us`,
      text: voice(sv, `We are at war with you.${why} Our ships are coming for ${state.systems[front]?.name ?? 'your star'}.`, `STATE OF WAR DECLARED.${cause ? ` GROUNDS: ${cause.toUpperCase()}` : ''} TARGET: ${(state.systems[front]?.name ?? 'UNKNOWN').toUpperCase()}.`),
    });
  } else {
    const t = tieOf(state, by, on);
    delete t.pacts;
    delete t.proposal;
    t.war = war;
    t.regard[on] = (t.regard[on] ?? 0) - 40;
    hearOf(state, by, on, `${civ.name} went to war with ${them.name}.${why}`);
  }
  // everyone else, each when the light reaches it (no infamy for a war on the Hunger in them)
  const infamy = cause === HUNGER_CAUSE ? 0 : cause ? -5 : -15;
  for (const o of othersPlaying(state)) {
    if (o.id === by || o.id === on) continue;
    const t = tieOf(state, by, o.id);
    (t.news ??= []).push({ to: o.id, at: lightIn(state, distanceBetween(state, by, o.id)), delta: infamy, taint: 0 });
  }
  return null;
}

/** Two civilizations make peace: the war ends, and they hear of it, each when the light arrives. */
export function peaceBetween(state: GameState, a: string, b: string): void {
  if (a === state.player || b === state.player) {
    const sv = state.survivors[a === state.player ? b : a];
    if (!sv?.war) return;
    delete sv.war;
    sendSignal(state, {
      from: sv.id,
      kind: 'peace',
      distanceLy: distanceToThem(state, sv),
      to: state.player,
      title: `${sv.name} makes peace`,
      text: voice(sv, 'We have had enough of this war. It is over, as far as we are concerned.', 'HOSTILITIES CEASED. TERMS: NONE.'),
    });
    return;
  }
  const t = state.ties?.[tieKey(a, b)];
  if (!t?.war) return;
  delete t.war;
  hearOf(state, a, b, `${state.civs[a]?.name} and ${state.civs[b]?.name} made peace.`);
}

/** A war's record by key, with both sides: ours on the Survivor records, the others' on their ties. */
function wars(state: GameState): { a: string; b: string; w: War }[] {
  const out: { a: string; b: string; w: War }[] = [];
  for (const sv of Object.values(state.survivors)) if (sv.alive && sv.war && state.civs[sv.id]) out.push({ a: state.player, b: sv.id, w: sv.war });
  for (const [k, t] of Object.entries(state.ties ?? {})) {
    if (!t.war) continue;
    const [a, b] = k.split('|');
    if (state.civs[a]?.outcome || state.civs[b]?.outcome) {
      delete t.war;
      continue;
    }
    out.push({ a, b, w: t.war });
  }
  return out;
}

/**
 * The battles of a turn, everywhere at once: at every star where civilizations at war stand (warships
 * stopped there, or a settlement), each side fires on the others' hulls with what stood at the start;
 * then the sieges of the wars the others began are counted, and their blockades run down the
 * besieged; held long enough, and its walls breached, a settlement is stormed. Our own sieges are
 * `warTurn`'s (war.ts), and our own assaults our choice. A Kinetic Lance strikes before all of it.
 */
export function battlesTurn(state: GameState): void {
  // a Kinetic Lance strikes as it arrives, before any battle
  strikesTurn(state);
  const fought = battles(state);
  for (const { a, b, w } of wars(state)) {
    // a war we began counts its siege in warTurn
    if (!w.by || w.by === state.player || !w.at) continue;
    const by = w.by;
    const on = by === a ? b : a;
    const here = allFleets(state).some((f) => f.owner === by && f.at === w.at && f.ships.some((s) => isWarship(s.cls)));
    const held = allColonies(state).some((c) => c.owner === on && c.systemId === w.at);
    const guarded = allFleets(state).some((f) => f.owner === on && f.at === w.at && f.ships.some((s) => isWarship(s.cls)));
    if (!here || !held) {
      w.siege = 0;
      // what the war was fought at is gone: on to the next of theirs
      if (!held) w.at = frontOf(state, on, by) ?? w.at;
      continue;
    }
    if (guarded) continue;
    w.siege++;
    // a blockade: the besieged's stores and will run down, and the besiegers carry off what it drains
    const take = plunder(state, on);
    if (on === state.player) {
      const me = state.civs[state.player];
      me.energy -= take;
      me.resolve = Math.max(0, me.resolve - 1);
      log(state, `${state.civs[by]?.name}'s warships hold ${state.systems[w.at]?.name} under siege (turn ${w.siege}): they carry off ${take} energy of our stores, and our will runs down.`, 'combat', w.at);
    } else send(state, on, { energy: -take, resolve: -1 });
    if (take > 0) send(state, by, { energy: take });
    if (!fought.has(w.at)) state.battles.push({ systemId: w.at, turn: state.turn, text: `The siege of ${state.systems[w.at]?.name}, turn ${w.siege}.` });
    // held long enough, and its walls breached: they storm it (one far down the Hunger's path razes it)
    const c = allColonies(state).find((x) => x.owner === on && x.systemId === w.at);
    if (c && !assaultBlocked(state, by, c)) assault(state, by, c.id, (state.civs[by]?.taint ?? 0) >= CORRUPT_AT);
  }
}

/**
 * What a siege carries off a turn: the energy its blockade costs the besieged (BLOCKADE of 400),
 * as much of it as they have, taken home by the besiegers (part 2d; before, it was only lost).
 */
export function plunder(state: GameState, on: string): number {
  return Math.min(Math.round(BLOCKADE * 400), Math.max(0, Math.floor(state.civs[on]?.energy ?? 0)));
}

/**
 * A side's luck in a battle, 0.6 to 1.4: from the seed, the turn, the star and the side, never the
 * dice, so that no side's turn order or place in a list decides anything.
 */
export function luck(state: GameState, systemId: string, id: string): number {
  return 0.6 + 0.8 * ((hashSeed(`${state.settings.seed}:battle:${state.turn}:${systemId}:${id}`) % 10007) / 10007);
}

/** Every battle of the turn, settled at once. Returns the stars fought at. */
function battles(state: GameState): Set<string> {
  type Side = { ships: { f: Fleet; s: Ship }[]; defence: number };
  const at = new Map<string, Map<string, Side>>();
  const side = (sys: string, id: string): Side => {
    let m = at.get(sys);
    if (!m) at.set(sys, (m = new Map()));
    let x = m.get(id);
    if (!x) m.set(id, (x = { ships: [], defence: 0 }));
    return x;
  };
  for (const f of allFleets(state)) {
    if (!f.at || !state.civs[f.owner]) continue;
    for (const s of f.ships) if (isWarship(s.cls)) side(f.at, f.owner).ships.push({ f, s });
  }
  for (const c of allColonies(state)) {
    let d = 0;
    for (const [id, n] of Object.entries(c.structures)) d += (STRUCTURE_BY_ID[id]?.defense ?? 0) * n;
    side(c.systemId, c.owner).defence += d;
  }
  // where two sides at war meet, and one of them can fire
  const sites: { sys: string; sides: Map<string, Side> }[] = [];
  for (const [sys, sides] of at) {
    if (sides.size < 2) continue;
    const ids = [...sides.keys()];
    if (ids.some((x) => ids.some((y) => y !== x && atWarWith(state, x, y) && (sides.get(x)!.ships.length || sides.get(y)!.ships.length)))) sites.push({ sys, sides });
  }
  const fought = new Set<string>();
  if (!sites.length) return fought;
  const hits = new Map<Ship, number>();
  for (const { sys, sides } of sites) {
    for (const [id, me] of sides) {
      const foes = [...sides.keys()].filter((o) => o !== id && atWarWith(state, id, o));
      const targets = foes.flatMap((o) => sides.get(o)!.ships);
      const hp = targets.reduce((a, x) => a + x.s.hp, 0);
      const fire = (me.ships.reduce((a, x) => a + strength(x.s.cls, 'ships') * (x.f.order === 'fortify' ? (SHIP_BY_ID[x.s.cls]?.dugIn ?? FORTIFY_BONUS) : 1), 0) + me.defence) * FIRE * luck(state, sys, id);
      if (fire <= 0 || hp <= 0) continue;
      fought.add(sys);
      for (const x of targets) hits.set(x.s, (hits.get(x.s) ?? 0) + fire * (x.s.hp / hp));
    }
  }
  // every hull takes what fell on it; the lost are gone, and their owners are told
  for (const f of allFleets(state)) {
    if (!f.ships.some((s) => hits.has(s))) continue;
    const before = f.ships.length;
    for (const s of f.ships) s.hp -= hits.get(s) ?? 0;
    f.ships = f.ships.filter((s) => s.hp > 0);
    const sys = state.systems[f.at ?? ''];
    const owner = state.civs[f.owner];
    if (!f.ships.length) {
      delete state.fleets[f.id];
      if (owner) logTo(state, owner, `${f.name} was destroyed in battle at ${sys?.name}.`, 'combat', sys?.id);
    } else if (f.ships.length < before && owner) logTo(state, owner, `${f.name} lost ${before - f.ships.length} ship${before - f.ships.length > 1 ? 's' : ''} in battle at ${sys?.name}.`, 'combat', sys?.id);
  }
  for (const sys of fought) state.battles.push({ systemId: sys, turn: state.turn, text: `Battle at ${state.systems[sys]?.name}.` });
  return fought;
}

// ------------------------------------------------------------------ conquest (part 2c-3)

/** The share of a taken settlement's people who flee to their own nearest settlement (or are lost). */
export const FLEE = 0.3;
/** The share of each of a taken settlement's structures that survives the taking. */
export const SPOILS = 0.7;
/** The galaxy's free energy a conquest spends for each person and each structure the settlement held. */
export const CONQUEST_GFE = 0.0003;
/** The hearth damage a settlement takes in its taking (0 to 1, as overdrive's). */
export const TAKEN_DAMAGE = 0.25;
/** The galaxy's free energy a Kinetic Lance spends as it is driven to nearly the speed of light. */
export const LANCE_GFE = 0.005;
/** The share of a settlement in the Deep a Kinetic Lance destroys: one mass strikes a part of what is scattered around a star, and a world whole. */
export const LANCE_DEEP = 0.5;

/** How a settlement falls: taken, razed, or struck down by a Kinetic Lance. */
export type Fall = 'take' | 'raze' | 'lance';

/** The ill everyone thinks of a fall, a war's cause weighed: least for the Hunger in them. */
function infamyOf(how: Fall, cause?: string): number {
  return (cause === HUNGER_CAUSE ? -5 : cause ? -10 : -25) * (how === 'take' ? 1 : how === 'raze' ? 1.5 : 2);
}

/** The Taint of a fall without a cause: a Hunger act (judge.ts). */
const FALL_TAINT: Record<Fall, number> = { take: 5, raze: 8, lance: 10 };

/** What a settlement holds against an assault: its people, its Defence Grids, a Bastion Shell. */
export function holdOf(c: Colony): number {
  let d = 2 + 0.3 * popsOf(c);
  for (const [id, n] of Object.entries(c.structures)) d += (STRUCTURE_BY_ID[id]?.defense ?? 0) * n;
  if ((c.structures.bastion ?? 0) > 0) d += 10;
  return d;
}

/** Whether a settlement is walled: behind a Defence Grid or a Bastion Shell, which only a Breacher breaks. */
export function walled(c: Colony): boolean {
  return Object.entries(c.structures).some(([id, n]) => n > 0 && (!!STRUCTURE_BY_ID[id]?.defense || id === 'bastion'));
}

/** The turns of siege `by` holds at a settlement's star, in the war it began (ours at their first star unless the war says where). */
export function siegeAt(state: GameState, by: string, c: Colony): number {
  const w = warOf(state, by, c.owner);
  if (!w) return 0;
  const declarer = w.by ?? state.player;
  const at = w.at ?? (declarer === state.player ? state.survivors[c.owner]?.homeSystemId : undefined);
  return declarer === by && at === c.systemId ? w.siege : 0;
}

/** Why `by` cannot storm the settlement `c` now, or null. */
export function assaultBlocked(state: GameState, by: string, c: Colony): string | null {
  const w = warOf(state, by, c.owner);
  if (!w) return 'Only in a war.';
  if ((w.by ?? state.player) !== by) return 'They began this war: you fight where they come, and cannot storm theirs.';
  const here = allFleets(state).filter((f) => f.owner === by && f.at === c.systemId);
  if (!here.some((f) => f.ships.some((s) => isWarship(s.cls)))) return 'You need warships at its star.';
  if (allFleets(state).some((f) => f.owner === c.owner && f.at === c.systemId && f.ships.some((s) => isWarship(s.cls)))) return 'Its own warships still hold its star.';
  const siege = siegeAt(state, by, c);
  if (siege < SIEGE_TURNS) return `Hold the siege: ${SIEGE_TURNS - siege} more turn(s) of warships at its star.`;
  if (walled(c) && !here.some((f) => f.ships.some((s) => SHIP_BY_ID[s.cls]?.breaches))) return 'It is behind a Defence Grid or a Bastion Shell: only a Breacher can break in.';
  return null;
}

/** What `by`'s warships at a settlement's star bring against it in an assault, before the draw. */
export function assaultForce(state: GameState, by: string, c: Colony): number {
  let a = 0;
  for (const f of allFleets(state)) if (f.owner === by && f.at === c.systemId) for (const s of f.ships) if (isWarship(s.cls)) a += strength(s.cls, 'settlements');
  return a;
}

/**
 * The chance `by`'s warships at a settlement's star take it if they storm it now: their strength
 * against settlements, times a draw from 0.6 to 1.4 (`luck`), must be at least what it holds.
 */
export function assaultOdds(state: GameState, by: string, c: Colony): number {
  const f = assaultForce(state, by, c);
  if (f <= 0) return 0;
  return Math.max(0, Math.min(1, (1.4 - holdOf(c) / f) / 0.8));
}

/** The settlement of theirs a war of ours with a civilization of its own is fought at, if it still stands. */
export function warFront(state: GameState, id: string): Colony | undefined {
  const sv = state.survivors[id];
  const at = sv?.war?.at;
  return at ? allColonies(state).find((c) => c.owner === id && c.systemId === at) : undefined;
}

/**
 * The screens we see a civilization's ships at a star carry, as the light that reaches our capital
 * shows them (fleetSeen): the chance they would turn a Kinetic Lance or a raid aside, as far as we
 * can tell. Ships come or gone since that light left, we cannot know of.
 */
export function screensSeen(state: GameState, systemId: string, owner: string): number {
  let through = 1;
  for (const f of allFleets(state)) {
    if (f.owner !== owner) continue;
    const seen = owner === state.player ? (f.at ? { at: f.at } : null) : fleetSeen(state, f);
    if (!seen || !('at' in seen) || seen.at !== systemId) continue;
    for (const s of f.ships) through *= 1 - (SHIP_BY_ID[s.cls]?.screen ?? 0);
  }
  return 1 - through;
}

/**
 * `by` storms the settlement `c`, its siege held and its walls breached: its warships' strength
 * against settlements, on a draw (0.6 to 1.4), against what the settlement holds. Won, the
 * settlement is taken (or, `raze`, destroyed), and the galaxy's free energy pays for what it held;
 * the war goes on at the enemy's next settlement. Lost, the siege must begin again. Either way it
 * costs hulls, more for a failure. Returns why not, or whether it won.
 */
export function assault(state: GameState, by: string, colonyId: string, raze = false): { won: boolean } | string {
  const c = state.colonies[colonyId];
  if (!c) return 'No such settlement.';
  const why = assaultBlocked(state, by, c);
  if (why) return why;
  const w = warOf(state, by, c.owner)!;
  const from = c.owner;
  const here = allFleets(state).filter((f) => f.owner === by && f.at === c.systemId);
  const force = assaultForce(state, by, c) * luck(state, c.systemId, `${by}:assault`);
  const hold = holdOf(c);
  const won = force >= hold;
  const ships = here.flatMap((f) => f.ships.filter((s) => isWarship(s.cls)));
  for (const s of ships) s.hp -= (hold * (won ? 0.3 : 0.8)) / Math.max(1, ships.length);
  for (const f of here) {
    f.ships = f.ships.filter((s) => s.hp > 0);
    if (!f.ships.length) delete state.fleets[f.id];
  }
  w.siege = 0;
  const sys = state.systems[c.systemId];
  if (!won) {
    const actor = state.civs[by];
    if (actor) {
      actor.resolve = Math.max(0, actor.resolve - 2);
      logTo(state, actor, `The assault on ${c.name} at ${sys?.name} was thrown back. The siege must begin again.`, 'combat', sys?.id);
    }
    if (from === state.player) log(state, `We threw back ${actor?.name ?? 'the enemy'}’s assault on ${c.name}.`, 'combat', c.systemId);
    state.battles.push({ systemId: c.systemId, turn: state.turn, text: `An assault on ${c.name} thrown back.` });
    return { won: false };
  }
  // (what the side that began it has taken: the desperate stop once they have what they came for)
  if ((w.by ?? state.player) === by) w.took = (w.took ?? 0) + 1;
  conquer(state, by, c, raze ? 'raze' : 'take', w.cause);
  // on to the next of theirs, while the war goes on
  if (warOf(state, by, from) === w) {
    const next = frontOf(state, from, by);
    if (next) w.at = next;
  }
  return { won: true };
}

/**
 * A fall, heard of everywhere as its light arrives: without a cause, a Hunger act (judge.ts), its
 * Taint the conqueror's.
 */
function heardEverywhere(state: GameState, by: string, from: string, systemId: string, what: string, how: Fall, cause?: string): void {
  const infamy = infamyOf(how, cause);
  if (!cause) return hungerAct(state, by, FALL_TAINT[how], systemId, what, infamy);
  if (by === state.player) return spreadNews(state, systemId, infamy, `you ${what}`, from);
  for (const o of othersPlaying(state)) {
    if (o.id === by || o.id === from) continue;
    const t = tieOf(state, by, o.id);
    (t.news ??= []).push({ to: o.id, at: lightIn(state, distanceBetween(state, by, o.id)), delta: infamy, taint: 0 });
  }
  if (from !== state.player) hearOf(state, by, from, `${state.civs[by]?.name ?? 'Someone'} ${what}.`);
}

/**
 * A settlement falls to `by`: taken (some of its people flee to their own, the rest come with it
 * unwillingly, and part of what was built there is wreckage), razed, or struck down by a Kinetic
 * Lance. The galaxy's free energy pays for what it held, it weighs on the conqueror's people,
 * everyone hears of it when the light arrives, and a civilization that has lost its last settlement
 * is gone. Taking everyone wins nothing.
 */
export function conquer(state: GameState, by: string, c: Colony, how: Fall, cause?: string): void {
  const from = c.owner;
  const loser = state.civs[from];
  const winner = state.civs[by];
  const held = popsOf(c) + Object.values(c.structures).reduce((a, n) => a + n, 0);
  state.gfe = Math.max(0.05, state.gfe - CONQUEST_GFE * held);
  const verb = how === 'take' ? 'took' : how === 'raze' ? 'razed' : 'struck down';
  const what = `${verb} ${c.name}, ${from === state.player ? 'one of our settlements' : `a settlement of ${loser?.name ?? 'another'}`}${how === 'lance' ? ', with a Kinetic Lance' : ''}`;
  if (how !== 'take') destroyColony(state, c, how === 'raze' ? `razed by ${winner?.name ?? 'an enemy'}` : `struck down by ${winner?.name ?? 'an enemy'}’s Kinetic Lance`);
  else {
    // some flee to their own nearest settlement; the rest come with it
    const sys = state.systems[c.systemId];
    const refuge = allColonies(state)
      .filter((x) => x.owner === from && x.id !== c.id)
      .sort((a, b) => distLy(state.systems[a.systemId], sys) - distLy(state.systems[b.systemId], sys))[0];
    for (const t of THREADS) {
      const flee = Math.floor(c.pops[t] * FLEE);
      c.pops[t] -= flee;
      if (refuge) refuge.pops[t] += flee;
    }
    for (const k of Object.keys(c.structures)) {
      c.structures[k] = Math.floor(c.structures[k] * SPOILS);
      if (!c.structures[k]) delete c.structures[k];
    }
    c.queue = [];
    c.overdrive = false;
    c.damage = Math.min(1, c.damage + TAKEN_DAMAGE);
    c.owner = by;
    // a Deep beside the winner's own at that star joins it: each civilization holds one Deep there (deepFor)
    const own = state.bodies[c.bodyId]?.kind === 'deep' ? allColonies(state).find((x) => x.owner === by && x.id !== c.id && x.systemId === c.systemId && state.bodies[x.bodyId]?.kind === 'deep') : undefined;
    if (own) {
      for (const t of THREADS) own.pops[t] += c.pops[t];
      own.cryo += c.cryo;
      for (const [k, n] of Object.entries(c.structures)) own.structures[k] = Math.min(STRUCTURE_BY_ID[k]?.max ?? Infinity, (own.structures[k] ?? 0) + n);
      const b = state.bodies[c.bodyId];
      if (b) b.colonyId = null;
      delete state.colonies[c.id];
    }
  }
  if (winner) {
    winner.resolve = Math.max(0, winner.resolve - (cause ? 3 : 8));
    winner.dissent = Math.min(100, winner.dissent + (cause ? 4 : 10));
    winner.flags.conquests = (winner.flags.conquests ?? 0) + 1;
  }
  if (loser) loser.flags.lost = (loser.flags.lost ?? 0) + 1;
  state.battles.push({ systemId: c.systemId, turn: state.turn, text: `${c.name} ${how === 'take' ? 'taken' : how === 'raze' ? 'razed' : 'struck down'}.` });
  heardEverywhere(state, by, from, c.systemId, what, how, cause);
  if (by === state.player) log(state, `We ${verb} ${c.name}.${how === 'take' ? ' Some of its people fled to their own; the rest are ours now, and do not thank us.' : ''}`, 'bad', c.systemId);
  // (a settlement of ours razed or struck down: destroyColony has told us)
  else if (from === state.player && how === 'take') log(state, `${winner?.name ?? 'The enemy'} ${what}.`, 'bad', c.systemId);
  if (allColonies(state).some((x) => x.owner === from)) return;
  // the last of them: their game is over (ours too: a defeat of its own, endings.ts)
  if (from === state.player) {
    if (loser) loser.flags.conquered = state.turn;
    return;
  }
  const sv = state.survivors[from];
  if (sv) {
    if (by === state.player) {
      sv.alive = false;
      sv.fate = how === 'take' ? 'seized' : 'destroyed';
      delete sv.war;
    } else sv.fate = 'conquered';
    endCiv(state, sv, by === state.player ? 'Seized' : 'Conquered');
  }
  if (by === state.player && !othersPlaying(state).some((o) => o.id !== from)) log(state, 'No one is left to stand against us. It wins us nothing: the dark is still coming.', 'info');
}

// ------------------------------------------------------------------ the Kinetic Lance

/** Why the active civilization's fleet cannot strike the settlement with a Kinetic Lance now, or null. */
export function strikeBlocked(state: GameState, fleetId: string, colonyId: string): string | null {
  const me = state.civ.id;
  const f = state.fleets[fleetId];
  if (!f || f.owner !== me) return 'No such fleet.';
  if (!f.at) return 'Wait until it arrives.';
  if (!f.ships.some((s) => SHIP_BY_ID[s.cls]?.lance)) return 'Only a Kinetic Lance can strike.';
  const c = state.colonies[colonyId];
  if (!c || c.owner === me) return 'There is no settlement of theirs to strike.';
  if (!warOf(state, me, c.owner)) return 'Only in a war.';
  if (me === state.player && !settlementSeen(state, c)) return 'Its light has not reached us yet.';
  if (allFleets(state).some((x) => x.owner === me && x.order === 'strike')) return 'One Kinetic Lance in flight at a time.';
  return null;
}

/**
 * Strike a settlement with a Kinetic Lance: one leaves its fleet and sets out at once, at nearly
 * the speed of light (LANCE_SPEED), and strikes as it arrives (strikesTurn). Driving that much mass
 * so fast spends the galaxy's free energy. Returns why not, or null.
 */
export function launchStrike(state: GameState, fleetId: string, colonyId: string): string | null {
  const why = strikeBlocked(state, fleetId, colonyId);
  if (why) return why;
  const f = state.fleets[fleetId];
  const c = state.colonies[colonyId];
  let lance = f;
  if (f.ships.length > 1) {
    const i = f.ships.findIndex((s) => SHIP_BY_ID[s.cls]?.lance);
    lance = newFleet(state, f.at!, [], 'Kinetic Lance');
    lance.ships = f.ships.splice(i, 1);
  }
  const err = orderMove(state, lance.id, c.systemId, 'strike');
  if (err) {
    if (lance !== f) {
      f.ships.push(...lance.ships);
      delete state.fleets[lance.id];
    }
    return err;
  }
  lance.targetColony = c.id;
  state.civ.flags.lances = (state.civ.flags.lances ?? 0) + 1;
  state.gfe = Math.max(0.05, state.gfe - LANCE_GFE);
  logTo(state, state.civ, `${lance.name} set out for ${c.name} at nearly the speed of light. It will strike when it arrives.`, 'combat', c.systemId);
  return null;
}

/**
 * Every Kinetic Lance that has arrived strikes, and is spent. The screens of its target's own ships
 * at that star may turn it aside (a draw from the seed, the turn and the target, never the dice);
 * if not, a settlement on a world is struck down whole, and one in the Deep loses LANCE_DEEP of its
 * people and of all it built. Struck or not, everyone hears of it.
 */
function strikesTurn(state: GameState): void {
  for (const f of allFleets(state)) {
    if (f.order !== 'strike' || !f.at) continue;
    delete state.fleets[f.id];
    const by = f.owner;
    const actor = state.civs[by];
    const sys = state.systems[f.at];
    const c = f.targetColony ? state.colonies[f.targetColony] : undefined;
    const w = c ? warOf(state, by, c.owner) : undefined;
    if (!c || c.systemId !== f.at || !w) {
      if (actor) logTo(state, actor, `${f.name} found nothing of the enemy’s at ${sys?.name} and flew on into the dark.`, 'combat', f.at);
      continue;
    }
    const from = c.owner;
    const screen = screenAt(state, c.systemId, from);
    const draw = (hashSeed(`${state.settings.seed}:lance:${state.turn}:${c.id}:${by}`) % 10007) / 10007;
    if (draw < screen) {
      // turned aside: the attempt is seen everywhere all the same
      heardEverywhere(state, by, from, c.systemId, `struck at ${c.name}, ${from === state.player ? 'one of our settlements' : `a settlement of ${state.civs[from]?.name ?? 'another'}`}, with a Kinetic Lance, and was turned aside`, 'lance', w.cause);
      if (actor) logTo(state, actor, `${f.name} was turned aside at ${sys?.name} by the screens of the ships waiting there.`, 'combat', f.at);
      if (from === state.player) log(state, `A Kinetic Lance from ${actor?.name ?? 'the enemy'} struck at ${c.name}. The screens of our ships there turned it aside.`, 'combat', c.systemId);
      state.battles.push({ systemId: c.systemId, turn: state.turn, text: `A Kinetic Lance turned aside at ${c.name}.` });
      continue;
    }
    if (state.bodies[c.bodyId]?.kind !== 'deep') {
      conquer(state, by, c, 'lance', w.cause);
      continue;
    }
    // scattered through the space around its star, a settlement in the Deep loses a part of itself
    let lost = 0;
    for (const t of THREADS) {
      const k = Math.ceil(c.pops[t] * LANCE_DEEP);
      c.pops[t] -= k;
      lost += k;
    }
    for (const k of Object.keys(c.structures)) {
      const n = Math.ceil(c.structures[k] * LANCE_DEEP);
      c.structures[k] -= n;
      lost += n;
      if (!c.structures[k]) delete c.structures[k];
    }
    state.gfe = Math.max(0.05, state.gfe - CONQUEST_GFE * lost);
    heardEverywhere(state, by, from, c.systemId, `struck ${c.name}, ${from === state.player ? 'one of our settlements' : `a settlement of ${state.civs[from]?.name ?? 'another'}`}, with a Kinetic Lance`, 'lance', w.cause);
    if (actor) logTo(state, actor, `${f.name} struck ${c.name}. Scattered as it is through the Deep, half of it is gone, and half lives on.`, 'combat', f.at);
    if (from === state.player) log(state, `A Kinetic Lance from ${actor?.name ?? 'the enemy'} struck ${c.name}. Half of it is gone.`, 'bad', c.systemId);
    state.battles.push({ systemId: c.systemId, turn: state.turn, text: `A Kinetic Lance struck ${c.name}.` });
  }
}
