// The Hunger among the civilizations (the new version, part 2b). A Hunger act (a Hunger technology
// taken up, a dark charter enacted, a swarm taken in or fed on, a civilization devoured, a star
// seized without cause) is its own Taint at once, and its news sets out at the speed of light.
// Whoever hears it thinks less of the one who did it, by what it was and by how desperate that one
// was then: the desperate are judged at 30%. Everything the others decide by our Taint, or each
// other's, reads the Taint they have heard of, never the true one.
import type { GameState, Survivor } from '../types';
import { MAX_SWARMS } from './hunger';
import { plight } from './plight';
import { distanceToThem, inStep, spreadNews, voice } from './survivors';
import { othersPlaying, tieOf } from './ties';
import { distLy, log, uid } from './util';
import { sendSignal } from './signals';

/** How much a point of Taint lowers what each hearer thinks of the one who took it on, at worst. */
export const JUDGE = 0.6;
/** How much of that the desperate are spared: at full plight they are judged at 30%. */
export const DESPERATE_EASE = 0.7;
/** Taint heard of from which those not on the Hunger's path will make no new pact or trade with one, and end Open Archives. */
export const SANCTION_AT = 30;
/** Taint heard of from which the Hunger in one is cause enough for war against it, with no infamy for it. */
export const JUST_CAUSE_AT = 60;
/** Its own Taint from which a civilization turns on the weak: it raids anyone not its friend. */
export const CORRUPT_AT = 60;
/** How far each point of Taint heard of lowers the most anyone can think of the one who took it on (from 100). */
export const HEARD_CEILING = 1.5;

/** What the others think of a Hunger act of `taint` by a civilization in plight `p` (0 to 1). */
export function judgement(taint: number, p: number): number {
  return -JUDGE * taint * (1 - DESPERATE_EASE * p);
}

/**
 * A Hunger act by civilization `actor`: `taint` is its own at once, and the news of it sets out from
 * `systemId`. `act` says what it did, as a verb phrase ("took up Hunger Engines"). `delta`: what the
 * act costs it in the others' eyes, where the act itself says (a devouring); otherwise judgement.
 */
export function hungerAct(state: GameState, actor: string, taint: number, systemId: string, act: string, delta?: number): void {
  const civ = state.civs[actor];
  if (!civ || taint <= 0) return;
  civ.taint = Math.min(100, civ.taint + taint);
  const d = delta ?? judgement(taint, plight(state, actor));
  if (actor === state.player) {
    spreadNews(state, systemId, d, `you ${act}`, undefined, undefined, taint);
    return;
  }
  const from = state.systems[systemId];
  // the others among themselves, each when the light reaches it
  for (const o of othersPlaying(state)) {
    if (o.id === actor) continue;
    const t = tieOf(state, actor, o.id);
    const home = state.systems[o.capitalId ? (state.colonies[o.capitalId]?.systemId ?? o.homeSystemId) : o.homeSystemId];
    (t.news ??= []).push({ to: o.id, at: lightAt(state, from && home ? distLy(from, home) : 0), delta: d, taint });
  }
  // and we, when it reaches our capital
  const me = state.civs[state.player];
  const here = state.systems[me.capitalId ? (state.colonies[me.capitalId]?.systemId ?? me.homeSystemId) : me.homeSystemId];
  (state.tidings ??= []).push({ at: lightAt(state, from && here ? distLy(from, here) : 0), text: `${civ.name} ${act}.`, systemId, taintOf: actor, taint });
}

/** A fall in a civilization's Taint (Hear the warning): its own, and no one hears of it. */
export function easeTaint(state: GameState, id: string, by: number): void {
  const civ = state.civs[id];
  if (civ) civ.taint = Math.max(0, civ.taint - by);
}

/** When light sent now arrives `ly` light-years away (at once in deep time). */
function lightAt(state: GameState, ly: number): number {
  return isFinite(state.years) ? state.years + Math.max(0, ly) : state.years;
}

/**
 * Another civilization whose Taint has reached 100 becomes the Hunger: its capital buds a swarm
 * (within the galaxy's limit), and the rest of it goes dark with its game (the Hunger ending, as
 * ours would be). We hear of it when its light reaches us.
 */
export function becomeHunger(state: GameState, id: string): void {
  const civ = state.civs[id];
  if (!civ || id === state.player) return;
  const at = civ.capitalId ? state.colonies[civ.capitalId]?.systemId : undefined;
  if (at && Object.keys(state.swarms).length < MAX_SWARMS[state.settings.difficulty]) {
    const sw = { id: uid(state, 'hg'), systemId: at, from: null, to: null, traveled: 0, distance: 0, size: 6, awake: true, tamed: false, appetite: 1 };
    state.swarms[sw.id] = sw;
  }
  log(state, 'What we were is gone. Something hungry wears our name.', 'bad', at);
}

/** Whether a neighbour shuns us for the Hunger it has heard of in us: unless it is on that path itself. */
export function shuns(state: GameState, sv: Survivor): boolean {
  if ((sv.heardTaint ?? 0) < SANCTION_AT) return false;
  return (state.civs[sv.id]?.taint ?? 0) < SANCTION_AT;
}

/**
 * The news of a Hunger act of ours has reached a neighbour: it counts its Taint as heard. Once that
 * is past what it will stand, it shuns us (no new pact or trade) and ends Open Archives, and says
 * why, if it can speak to us. (The Tessellate keeps an agreement to the letter even so.)
 */
export function heardOfUs(state: GameState, sv: Survivor, taint: number): void {
  const was = shuns(state, sv);
  sv.heardTaint = Math.min(100, (sv.heardTaint ?? 0) + taint);
  if (was || !shuns(state, sv)) return;
  const archives = sv.pacts?.archives !== undefined && sv.way !== 'lattice';
  if (archives) delete sv.pacts!.archives;
  if (sv.contact && inStep(state, sv)) {
    sendSignal(state, {
      from: sv.id,
      kind: 'shunned',
      distanceLy: distanceToThem(state, sv),
      title: `${sv.name} will deal with us no more`,
      text: voice(
        sv,
        `We have heard what you have taken into yourselves. We will make no new pact with you and trade nothing more${archives ? ', and our archives are closed to you. Our other agreements stand.' : '. What we agreed before, we keep.'}`,
        `HUNGER CONTAMINATION OBSERVED IN COUNTERPARTY. NEW AGREEMENTS AND EXCHANGE SUSPENDED.${archives ? ' ARCHIVE ACCESS WITHDRAWN.' : ''} EXISTING TERMS KEPT.`,
      ),
    });
  }
}

