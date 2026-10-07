// Refuge. A civilization that trusts us and is dying can come to us: a partner in any pact, or,
// while Sanctuary stands, anyone who thinks well of us. Our answer crosses at the speed of light,
// they set out when it reaches them (minds as light, flesh by ship, as slow as ours were at
// first), and they live on among us: their fate is 'saved'. The Choir, already one voice made of
// many, asks to join our Chorus instead, if we have a Confluence of our own, and is 'absorbed'.
// Sanctuary, the law that opens our doors, is heard of everywhere and trusted.

import type { GameState, Survivor, ThreadId } from '../types';
import { formatYears } from '../eras';
import { welcomeEchoes } from './archive';
import { capacity } from './economy';
import { computeMods } from './mods';
import { pactsWith } from './pacts';
import { sendSignal } from './signals';
import { distanceToThem, lightArrived, lightAt, newcomerThread, settleNewcomers, spreadNews, voice } from './survivors';
import { capital, colonies, hasCharter, hasTech, log } from './util';

/** A civilization this far gone (health) asks to come to us, if it trusts us. */
export const DYING = 0.2;
/** Their ships cross as slowly as ours did at first: this fraction of the speed of light. */
export const EXODUS_SPEED = 0.02;
/** While Sanctuary stands, everyone's goodwill toward us drifts up to this, half a point a turn. */
export const SANCTUARY_TRUST = 25;
/** Insight from each mind of the Choir with no room in our Confluence: it joins us as memory. */
export const MEMORY_INSIGHT = 20;

/** What they become among us: the Choir joins our Chorus if we merge minds too, or runs as Echoes. */
export function arrivalThread(state: GameState, sv: Survivor): ThreadId {
  if (sv.way === 'chorus') return hasTech(state, 'mind_merging') ? 'chorus' : 'echoes';
  return newcomerThread(sv);
}

/** The Choir merging into our Chorus, rather than coming as a people. */
export function merging(state: GameState, sv: Survivor): boolean {
  return sv.way === 'chorus' && arrivalThread(state, sv) === 'chorus';
}

/** Minds can be sent as light; flesh must travel. */
export function crossesAsLight(state: GameState, sv: Survivor): boolean {
  return arrivalThread(state, sv) !== 'kin';
}

/** How many would come: those who can still travel. */
export function exodusSize(sv: Survivor): number {
  return Math.max(2, Math.round(sv.pop / 3));
}

/** Years from our answer to their arrival: our answer's light, then their crossing. */
export function crossingYears(state: GameState, sv: Survivor): number {
  const ly = distanceToThem(state, sv);
  return ly + ly / (crossesAsLight(state, sv) ? 1 : EXODUS_SPEED);
}

/** Room among us for newcomers of one kind, awake (and for Kin, asleep in free berths). */
export function roomFor(state: GameState, t: ThreadId): number {
  const mods = computeMods(state);
  let room = 0;
  for (const c of colonies(state)) {
    const cap = capacity(state, c, mods);
    room += Math.max(0, cap[t] - c.pops[t]);
    if (t === 'kin') room += Math.max(0, cap.cryo - c.cryo);
  }
  return room;
}

/** Whether they trust us enough to come: a pact; Sanctuary and goodwill; or, for the Choir, our own Confluence. */
export function mayComeToUs(state: GameState, sv: Survivor): boolean {
  if (sv.disposition < 0) return false;
  if (pactsWith(sv).length > 0) return true;
  if (hasCharter(state, 'sanctuary') && sv.disposition >= 20) return true;
  return merging(state, sv) && sv.disposition >= 10;
}

/** A dying civilization that trusts us asks, once, to come to us. Returns true if it asked. */
export function askRefuge(state: GameState, sv: Survivor): boolean {
  if (sv.exodusAsked !== undefined || sv.exodus || sv.health >= DYING || !mayComeToUs(state, sv)) return false;
  sv.exodusAsked = state.turn;
  sv.lastSent = state.turn;
  const n = exodusSize(sv);
  const t = arrivalThread(state, sv);
  const merge = merging(state, sv);
  const years = crossingYears(state, sv);
  const when = years > 0 ? `in ${formatYears(years)}` : 'at once';
  const where =
    t === 'echoes'
      ? 'They run on our substrate where it has room; the rest wait in the archive until it does.'
      : t === 'kin'
        ? 'They live where we have room for them, or sleep in free Cold Sleep berths; any we cannot house crowd in at the capital, and without more room not all of them will last.'
        : `They live where we have room for them; any we cannot house crowd in at the capital, and without more room not all of them will last.`;
  sendSignal(state, {
    from: sv.id,
    kind: 'exodus',
    distanceLy: distanceToThem(state, sv),
    title: merge ? `${sv.name} asks to join our Chorus` : `${sv.name} asks to come to us`,
    text: merge
      ? `We are failing, and we would rather not end. We have been one voice for a long time; let us be part of yours. Open your Confluence to us and we will cross to you as we are: as thought, at the speed of light.`
      : voice(
          sv,
          `Our sources are failing and will not come back. We would rather live among you than die here. ${n} of us could make the crossing. Will you take us in?`,
          `OPERATIONS UNSUSTAINABLE AT ORIGIN. PROPOSAL: TRANSFER OF ${n} UNITS TO YOUR CUSTODY. UNITS WILL OPERATE UNDER YOUR PROTOCOLS.`,
        ),
    data: { n },
    choices: [
      {
        id: 'take',
        label: merge ? 'Open the Confluence' : 'Take them in',
        hint: merge
          ? `They set out as light when our answer reaches them and arrive ${when}: ${n} minds join our Chorus where a Confluence Node has room, the rest as memory (insight). They live on as part of us.`
          : `They set out when our answer reaches them and arrive ${when}: ${n} of them, with their archive. ${where}`,
      },
      { id: 'refuse', label: merge ? 'Let them go' : 'We cannot', hint: 'They will go dark where they are.' },
    ],
  });
  return true;
}

/** Our answer: come. They set out when it reaches them. */
export function takeThemIn(state: GameState, sv: Survivor, n: number): string | null {
  if (!sv.alive) return 'They are gone: they went dark before our answer could reach them.';
  if (sv.exodus) return null;
  const ly = distanceToThem(state, sv);
  const leaves = lightAt(state, ly);
  const at = isFinite(leaves) ? leaves + crossingYears(state, sv) - ly : leaves;
  sv.exodus = { leaves, at, n };
  state.civ.resolve = Math.min(100, state.civ.resolve + 3);
  const years = at - state.years;
  log(state, `We answered ${sv.name}: come. ${isFinite(years) && years > 0 ? `They will be with us in ${formatYears(years)}.` : 'They are on their way.'}`, 'good', sv.homeSystemId);
  return null;
}

/** They have reached us: they live on among us, and every other civilization hears of it. */
export function arriveAmongUs(state: GameState, sv: Survivor) {
  const ex = sv.exodus;
  if (!ex) return;
  const civ = state.civ;
  const t = arrivalThread(state, sv);
  const merge = merging(state, sv);
  let housed = 0;
  let archived = 0;
  let crowded = 0;
  let memory = 0;
  if (t === 'echoes') {
    archived = welcomeEchoes(state, ex.n);
    housed = ex.n - archived;
  } else {
    housed = settleNewcomers(state, t, ex.n);
    const left = ex.n - housed;
    const cap = capital(state) ?? colonies(state)[0];
    if (merge) memory = left;
    else if (left > 0 && cap) {
      cap.pops[t] += left;
      crowded = left;
    }
  }
  // they bring everything they knew
  const insight = Math.round(60 + sv.pop * 4) + memory * MEMORY_INSIGHT;
  if (civ.researching) civ.research[civ.researching] = (civ.research[civ.researching] ?? 0) + insight;
  else civ.flags.insight_bank = (civ.flags.insight_bank ?? 0) + insight;
  sv.alive = false;
  sv.fate = merge ? 'absorbed' : 'saved';
  delete sv.exodus;
  const cap = capital(state);
  spreadNews(state, cap?.systemId ?? civ.homeSystemId, 8, merge ? `you took ${sv.name} into your Chorus` : `you took in ${sv.name} when their sources failed`, sv.id);
  sendSignal(state, {
    from: sv.id,
    kind: 'arrived',
    distanceLy: 0,
    title: merge ? `${sv.name} has joined our Chorus` : `${sv.name} has come to us`,
    text: merge
      ? 'We are here. We are you now, and you are a little more of us. It is easier than you think.'
      : voice(sv, 'We made it. Thank you. We will make ourselves at home, and we will not forget who let us in.', 'TRANSFER COMPLETE. UNITS OPERATIONAL UNDER YOUR PROTOCOLS. ORIGIN DECOMMISSIONED.'),
  });
  const parts = [
    housed > 0 ? (merge ? `${housed} found room in our Confluence` : `${housed} found a place among us`) : '',
    archived > 0 ? `${archived} wait in the archive for substrate` : '',
    crowded > 0 ? `${crowded} crowd in at ${cap?.name ?? 'the capital'} with nowhere to live` : '',
    memory > 0 ? `${memory} joined us as memory` : '',
  ].filter(Boolean);
  log(state, `${merge ? `${sv.name} has joined our Chorus` : `${sv.name} has come to us`}: ${parts.join('; ')}. Their archive is ours: ${insight} insight.`, 'good', cap?.systemId);
}

/** Their side of an exodus, each of their turns: true while they are on their way (they do nothing else). */
export function onTheirWay(state: GameState, sv: Survivor): boolean {
  const ex = sv.exodus;
  if (!ex || !lightArrived(state, ex.leaves)) return false;
  if (lightArrived(state, ex.at)) arriveAmongUs(state, sv);
  return true;
}

/** Sanctuary enacted or repealed: every civilization hears of it when the light reaches it. */
export function sanctuaryHeard(state: GameState, open: boolean) {
  const cap = capital(state);
  spreadNews(state, cap?.systemId ?? state.civ.homeSystemId, open ? 10 : -10, open ? 'you opened your doors to the other survivors' : 'you closed your doors to the other survivors', undefined, 'sanctuary');
}

/**
 * While Sanctuary stands, and once they have heard of it, those who are not against us come to
 * trust us more (never past what our Taint allows). An open door does not move an enemy.
 */
export function sanctuaryTrust(state: GameState, sv: Survivor, ceiling: number) {
  const top = Math.min(SANCTUARY_TRUST, ceiling);
  if (!hasCharter(state, 'sanctuary') || sv.disposition < 0 || sv.disposition >= top) return;
  if ((sv.news ?? []).some((n) => n.tag === 'sanctuary')) return;
  sv.disposition = Math.min(top, sv.disposition + 0.5);
}
