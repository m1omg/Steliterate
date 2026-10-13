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
import type { Fleet, GameState, Ship, War } from '../types';
import { THREADS } from '../types';
import { send } from '../civs';
import { FORTIFY_BONUS } from './fleets';
import { sendSignal } from './signals';
import { distanceToThem, voice } from './survivors';
import { distanceBetween, hearOf, lightIn, othersPlaying, tieKey, tieOf } from './ties';
import { allColonies, allFleets, clamp, distLy, log, logTo } from './util';
import { hashSeed } from '../rng';
import { BLOCKADE, HUNGER_CAUSE, WAR_ACCORD } from './war';

/** The share of a side's fire that lands on the other's hulls in a turn of battle. */
export const FIRE = 0.5;

/** The war between two civilizations, if any: ours with another on its record, two others' on their tie. */
export function warOf(state: GameState, a: string, b: string): War | undefined {
  if (a === b) return undefined;
  if (a === state.player || b === state.player) {
    const sv = state.survivors[a === state.player ? b : a];
    return sv?.alive ? sv.war : undefined;
  }
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
 * given. Returns why not, or null.
 */
export function declareOn(state: GameState, by: string, on: string, cause?: string, at?: string): string | null {
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
  const war: War = { since: state.turn, siege: 0, by, at: front, ...(cause ? { cause } : {}) };
  const why = cause ? ` ${cause}` : '';
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
 * besieged. Our own sieges are `warTurn`'s (war.ts).
 */
export function battlesTurn(state: GameState): void {
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
      continue;
    }
    if (guarded) continue;
    w.siege++;
    // a blockade: the besieged's stores and will run down
    if (on === state.player) {
      const me = state.civs[state.player];
      me.energy = Math.max(0, me.energy - Math.round(BLOCKADE * 400));
      me.resolve = Math.max(0, me.resolve - 1);
      log(state, `${state.civs[by]?.name}'s warships hold ${state.systems[w.at]?.name} under siege (turn ${w.siege}): our stores and our will run down.`, 'combat', w.at);
    } else send(state, on, { energy: -Math.round(BLOCKADE * 400), resolve: -1 });
    if (!fought.has(w.at)) state.battles.push({ systemId: w.at, turn: state.turn, text: `The siege of ${state.systems[w.at]?.name}, turn ${w.siege}.` });
  }
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
