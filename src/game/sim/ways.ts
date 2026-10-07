// Ways that meet: what each way of life wants of the universe, and of us.
//  - The sleepers wake when a new star lights near them, and race for it.
//  - The Tessellate keeps its agreements to the letter: it never renounces a pact, pays its side
//    of Mutual Aid even while failing, and holds us to ours (two breaches and it is over).
//  - The Choir would gather some of our Echoes into itself, if they wish it.
//  - A new star whose clock a partner keeps too costs us half (flare.ts, clockPartner).
//  - In the Black Hole Age a hole's spin is a commons: those who live there draw on it too, a
//    partner only its share.

import type { GameState, StarSystem, Survivor } from '../types';
import { calendarEra } from '../fate';
import { CLAIM_SPEED, MAX_CLAIMS, claimedStars } from './claims';
import { sendSignal } from './signals';
import { pactsWith } from './pacts';
import { distanceToThem, inStep, lightAt, voice } from './survivors';
import { colonies, distLy, log } from './util';

/** How far a new star's light wakes the sleepers (ly): their own cluster. */
export const WAKE_REACH = 100;
/** The Choir asks for our Echoes at most once in this many turns. */
export const CHOIR_EVERY = 25;
/** How many of our Echoes go to the Choir when we let those who wish go. */
export const CHOIR_TAKES = 2;
/** Breaches of Mutual Aid the Tessellate tolerates before it ends every pact with us. */
export const BREACHES = 2;
/** Spin a civilization at a hole draws a turn in the Black Hole Age, per person at full health. */
export const SPIN_DRAW = 0.04;

const NEW_STARS = new Set(['collision_star', 'helium_star', 'helium_giant']);
const COLD = new Set(['barren', 'ice', 'ocean_ice']);

/** A new star burning near them with a cold world free to wait by: what wakes the sleepers. */
export function newStarNear(state: GameState, sv: Survivor): StarSystem | null {
  const mine = sv.systems.map((id) => state.systems[id]).filter((x): x is StarSystem => !!x && !x.gone);
  let best: StarSystem | null = null;
  let bestD = Infinity;
  for (const sys of Object.values(state.systems)) {
    const p = sys.primary;
    if (sys.gone || !NEW_STARS.has(p.kind) || !p.diesAt || p.diesAt <= state.years) continue;
    if (Object.values(state.colonies).some((c) => c.systemId === sys.id)) continue;
    if (Object.values(state.survivors).some((o) => o.alive && (o.systems.includes(sys.id) || o.claim?.systemId === sys.id))) continue;
    if (!sys.bodies.some((id) => state.bodies[id] && !state.bodies[id].dissolved && COLD.has(state.bodies[id].kind))) continue;
    const d = Math.min(...mine.map((m) => distLy(m, sys)));
    if (d <= WAKE_REACH && d < bestD) {
      best = sys;
      bestD = d;
    }
  }
  return best;
}

/**
 * The sleepers, each of their turns: a new star near them wakes them, and they set out for it at
 * once, if they can still travel; if we know them, they tell us. Returns true if they set out.
 */
export function wakeForNewStar(state: GameState, sv: Survivor): boolean {
  if (sv.way !== 'dormant' || sv.claim || sv.health <= 0.25 || claimedStars(state, sv) >= MAX_CLAIMS) return false;
  const sys = newStarNear(state, sv);
  if (!sys) return false;
  const d = Math.min(...sv.systems.map((id) => state.systems[id]).filter((x) => !!x).map((m) => distLy(m, sys)));
  sv.claim = { systemId: sys.id, at: isFinite(state.years) ? state.years + d / CLAIM_SPEED : state.years };
  if (sv.contact && inStep(state, sv)) {
    sendSignal(state, {
      from: sv.id,
      kind: 'woken',
      distanceLy: distanceToThem(state, sv),
      title: `${sv.name} have woken`,
      text: `A new star burns at ${sys.name}. We have slept through ages for a light like this; our ships are already on their way to it.`,
    });
  }
  return true;
}

/**
 * The Choir would gather some of our Echoes into itself, those who wish it: it asks now and then,
 * while it thinks well of us and we have Echoes to spare. Returns true if it asked.
 */
export function choirWish(state: GameState, sv: Survivor): boolean {
  if (sv.way !== 'chorus' || sv.war || sv.health <= 0.4 || sv.disposition <= 20) return false;
  const key = `choir_wish_${sv.id}`;
  if (state.turn - (state.civ.flags[key] ?? -99) < CHOIR_EVERY) return false;
  const echoes = colonies(state).reduce((a, c) => a + c.pops.echoes, 0);
  if (echoes < CHOIR_TAKES + 2) return false;
  state.civ.flags[key] = state.turn;
  sv.lastSent = state.turn;
  const consent = state.civ.charters.includes('merge_consent');
  sendSignal(state, {
    from: sv.id,
    kind: 'choir_wish',
    distanceLy: distanceToThem(state, sv),
    title: `${sv.name} would gather some of our Echoes`,
    text: 'Some of your Echoes listen to us. They are lonely in themselves, and we can hear it. Let those who wish it come to us, and they will never be alone again.',
    choices: [
      { id: 'let', label: 'Let those who wish go', hint: `${CHOIR_TAKES} Echoes leave us, as light, to become part of the Choir.${consent ? ' Under Merge Consent, only those who ask.' : ''} The Echoes think better of us for it; the Choir grows, and thinks better of us too.` },
      { id: 'keep', label: 'Ask them to stay', hint: 'The Echoes who wished to go will resent it, and the Choir will be hurt.' },
    ],
  });
  return true;
}

/** Our answer to the Choir. */
export function answerChoirWish(state: GameState, sv: Survivor, choice: string): string | null {
  const civ = state.civ;
  if (choice !== 'let') {
    civ.standing.echoes = Math.max(0, civ.standing.echoes - 3);
    sv.disposition = Math.max(-100, sv.disposition - 5);
    return null;
  }
  if (!sv.alive) return 'They are gone: there is no one left to go to.';
  let left = CHOIR_TAKES;
  for (const c of colonies(state).sort((a, b) => b.pops.echoes - a.pops.echoes)) {
    const k = Math.min(left, c.pops.echoes);
    c.pops.echoes -= k;
    left -= k;
    if (left <= 0) break;
  }
  const went = CHOIR_TAKES - left;
  if (went <= 0) return 'No Echoes are left to go.';
  civ.standing.echoes = Math.min(100, civ.standing.echoes + 3);
  // they cross as light, and are welcomed when they arrive
  (sv.news ??= []).push({ at: lightAt(state, distanceToThem(state, sv)), delta: 12, what: 'you let your Echoes come to us' });
  sv.pop += went;
  sv.health = Math.min(1, sv.health + 0.04 * went);
  log(state, `${went} Echo${went === 1 ? '' : 'es'} left us to become part of ${sv.name}.`, 'info', sv.homeSystemId);
  return null;
}

/**
 * The Black Hole Age: a hole's spin is a commons. Those who live at a hole draw on it as we do; a
 * partner (any pact) takes only half what it could. Returns the spin they drew.
 */
export function drawTheirSpin(state: GameState, sv: Survivor): number {
  if (calendarEra(state) !== 'blackhole' || !sv.alive) return 0;
  let drawn = 0;
  const share = pactsWith(sv).length > 0 ? 0.5 : 1;
  for (const id of sv.systems) {
    const p = state.systems[id]?.primary;
    if (!p || (p.kind !== 'black_hole' && p.kind !== 'smbh') || p.spin <= 0) continue;
    const d = Math.min(p.spin, SPIN_DRAW * sv.pop * sv.health * share);
    p.spin -= d;
    drawn += d;
  }
  return drawn;
}

/** Who else draws on this hole's spin (living civilizations at it, in the Black Hole Age). */
export function spinSharers(state: GameState, systemId: string): Survivor[] {
  const p = state.systems[systemId]?.primary;
  if (!p || (p.kind !== 'black_hole' && p.kind !== 'smbh') || calendarEra(state) !== 'blackhole') return [];
  return Object.values(state.survivors).filter((sv) => sv.alive && !sv.exodus && sv.systems.includes(systemId));
}

/** The Tessellate holds us to Mutual Aid to the letter: a breach when we could not pay our side. */
export function breach(state: GameState, sv: Survivor) {
  const key = `breach_${sv.id}`;
  const n = (state.civ.flags[key] ?? 0) + 1;
  state.civ.flags[key] = n;
  const dist = distanceToThem(state, sv);
  if (n < BREACHES) {
    sendSignal(state, {
      from: sv.id,
      kind: 'breach',
      distanceLy: dist,
      title: `${sv.name}: a breach of Mutual Aid`,
      text: voice(sv, '', `MUTUAL AID CLAUSE NOT EXECUTED BY COUNTERPARTY. BREACH ${n} OF ${BREACHES} LOGGED. AT ${BREACHES} THE AGREEMENTS TERMINATE.`),
    });
    return;
  }
  delete sv.pacts;
  sv.disposition = Math.max(-100, sv.disposition - 15);
  delete state.civ.flags[key];
  sendSignal(state, {
    from: sv.id,
    kind: 'pact_ended',
    distanceLy: dist,
    title: `${sv.name} ends our pacts`,
    text: voice(sv, '', `COUNTERPARTY NONCOMPLIANT: ${BREACHES} BREACHES. ALL AGREEMENTS TERMINATED, AS THEIR TERMS PROVIDE.`),
  });
}
