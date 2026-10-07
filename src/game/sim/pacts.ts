// Pacts with other civilizations. A proposal crosses the dark at the speed of light, they decide
// when it arrives, and their answer takes as long to come back: with a neighbour 30,000 light-years
// away a pact takes 60,000 years to seal. Each is priced in accord, the Threads' consent to bind
// us, and every pact in force makes the next one dearer. Breaking one is heard everywhere.
//  - Mutual Aid: whichever of us is in trouble, the other beams help, unasked.
//  - Shared Watch: their eyes on the Hunger and ours; each of us stands a little stronger against
//    it (eyes and a little strength, never a shield).
//  - Open Archives: what each of us learns, the other may read: a little insight every turn, and
//    now and then their notes on something we are working toward.

import { TECH_BY_ID } from '../data/techs';
import type { GameState, PactKind, Survivor } from '../types';
import { availableTechs, techCost } from './research';
import { reserveCapacity } from './economy';
import { computeMods } from './mods';
import { sendSignal } from './signals';
import { beamEnergy, distanceToThem, inStep, lightAt, spreadNews, voice } from './survivors';
import { distLy, log } from './util';
import { breach } from './ways';

export const PACT_KINDS: PactKind[] = ['aid', 'archives', 'watch'];

export const PACTS: Record<PactKind, { name: string; desc: string; need: number }> = {
  aid: { name: 'Mutual Aid', desc: 'Whichever of us is in trouble, the other beams help, unasked.', need: 10 },
  archives: { name: 'Open Archives', desc: 'What each of us learns, the other may read: a little insight every turn, and now and then their notes on something we are working toward.', need: 0 },
  watch: { name: 'Shared Watch', desc: 'Their eyes on the Hunger, and ours: we see the stars they watch, and each of us stands a little stronger against it.', need: 20 },
};

/** Accord for the first pact; each pact in force (or proposed) makes the next dearer by this factor. */
export const PACT_BASE = 30;
export const PACT_RISE = 1.6;
/** Mutual Aid answers at most once in this many turns, each way. */
export const AID_EVERY = 6;
/** Open Archives: notes on a project every this many turns. */
export const NOTES_EVERY = 10;

/** Pacts in force with them. */
export function pactsWith(sv: Survivor): PactKind[] {
  return sv.alive ? PACT_KINDS.filter((k) => sv.pacts?.[k] !== undefined) : [];
}

export function hasPact(sv: Survivor, kind: PactKind): boolean {
  return sv.alive && sv.pacts?.[kind] !== undefined;
}

/** Accord the next pact costs: dearer for every pact in force or on its way. */
export function pactCost(state: GameState): number {
  let n = 0;
  for (const sv of Object.values(state.survivors)) n += pactsWith(sv).length + (sv.alive && sv.proposal ? 1 : 0);
  return Math.round(PACT_BASE * Math.pow(PACT_RISE, n));
}

/** Why we cannot propose this pact to them now, or null. */
export function pactBlocked(state: GameState, sv: Survivor, kind: PactKind): string | null {
  if (!sv.alive) return 'They are gone.';
  if (!sv.contact) return 'We have not made contact.';
  if (hasPact(sv, kind)) return 'It is in force.';
  if (sv.war) return 'We are at war with them.';
  if (sv.proposal) return `Our proposal of ${PACTS[sv.proposal.kind].name} is still crossing to them, or their answer is.`;
  if (!inStep(state, sv)) return 'Our clocks are too far apart to agree on anything.';
  if (state.civ.taint >= 60) return 'They will not bind themselves to what we are becoming.';
  if (sv.disposition < -20) return 'They would not hear of it.';
  const cost = pactCost(state);
  if (state.civ.accord < cost) return `Needs ${cost} accord.`;
  return null;
}

/** Propose a pact: the Threads consent (accord), and the proposal sets out at the speed of light. */
export function proposePact(state: GameState, id: string, kind: PactKind): string | null {
  const sv = state.survivors[id];
  if (!sv) return 'They are gone.';
  const err = pactBlocked(state, sv, kind);
  if (err) return err;
  const cost = pactCost(state);
  state.civ.accord -= cost;
  const ly = distanceToThem(state, sv);
  sv.proposal = { kind, at: lightAt(state, ly), cost };
  log(state, `We proposed ${PACTS[kind].name} to ${sv.name}. Their answer can be back in ${ly > 0 ? `${Math.round(ly * 2).toLocaleString('en-US')} years` : 'no time'}.`, 'info', sv.homeSystemId);
  return null;
}

/** They decide on our proposal when it reaches them; their answer sets out back to us. */
export function weighProposal(state: GameState, sv: Survivor) {
  const p = sv.proposal;
  if (!p) return;
  // the Tessellate keeps any agreement to the letter, and so enters one readily
  const need = PACTS[p.kind].need + (sv.way === 'lattice' ? -15 : 0) - (p.kind === 'aid' && sv.health < 0.5 ? 15 : 0);
  const yes = sv.disposition >= need && state.civ.taint < 60;
  sendSignal(state, {
    from: sv.id,
    kind: 'pact_answer',
    distanceLy: distanceToThem(state, sv),
    title: yes ? `${sv.name} agrees to ${PACTS[p.kind].name}` : `${sv.name} declines ${PACTS[p.kind].name}`,
    text: yes
      ? voice(sv, `We accept. ${PACTS[p.kind].desc} We will keep our side of it.`, `AGREEMENT ACCEPTED: ${PACTS[p.kind].name.toUpperCase()}. TERMS WILL BE KEPT EXACTLY.`)
      : voice(sv, 'Not now. Perhaps when we know you better.', 'AGREEMENT DECLINED. COUNTERPARTY STANDING INSUFFICIENT.'),
    data: { pact: p.kind, yes: yes ? 1 : 0, refund: yes ? 0 : p.cost },
  });
  // we wait for their answer: the proposal stays out until it comes back
  p.answered = true;
}

/** Their answer has reached us: the pact is sealed, or the Threads' consent is not spent. */
export function answerArrived(state: GameState, svId: string, data: Record<string, number | string>) {
  const sv = state.survivors[svId];
  if (!sv) return;
  const kind = String(data.pact) as PactKind;
  delete sv.proposal;
  if (Number(data.yes) && sv.alive) {
    (sv.pacts ??= {})[kind] = state.turn;
    log(state, `${PACTS[kind].name} with ${sv.name} is in force.`, 'good', sv.homeSystemId);
  } else if (Number(data.refund) > 0) state.civ.accord += Number(data.refund);
}

/** Break a pact. Everyone hears of it, them first and worst. */
export function endPact(state: GameState, id: string, kind: PactKind): string | null {
  const sv = state.survivors[id];
  if (!sv || !hasPact(sv, kind)) return 'There is no such pact.';
  delete sv.pacts![kind];
  (sv.news ??= []).push({ at: lightAt(state, distanceToThem(state, sv)), delta: -25, what: `you broke ${PACTS[kind].name} with them` });
  spreadNews(state, sv.homeSystemId, -10, `you broke ${PACTS[kind].name} with ${sv.name}`, sv.id);
  log(state, `We ended ${PACTS[kind].name} with ${sv.name}. Everyone will hear of it.`, 'bad', sv.homeSystemId);
  return null;
}

/** Accept a pact they offered (a signal): the Threads consent now, and it is in force. */
export function acceptOffer(state: GameState, sv: Survivor, kind: PactKind): string | null {
  if (!sv.alive) return 'They are gone.';
  if (hasPact(sv, kind)) return null;
  const cost = pactCost(state);
  if (state.civ.accord < cost) return `Needs ${cost} accord.`;
  state.civ.accord -= cost;
  (sv.pacts ??= {})[kind] = state.turn;
  log(state, `${PACTS[kind].name} with ${sv.name} is in force.`, 'good', sv.homeSystemId);
  return null;
}

/**
 * Their side of our pacts, each of their turns: they offer one when they think well of us, and
 * renounce every one when they no longer do. Returns true if they sent us something.
 */
export function theirPacts(state: GameState, sv: Survivor, chance: () => number): boolean {
  const mine = pactsWith(sv);
  // the Tessellate keeps an agreement to the letter, whatever it thinks of us
  if (mine.length && sv.disposition < -10 && sv.way !== 'lattice') {
    delete sv.pacts;
    sendSignal(state, {
      from: sv.id,
      kind: 'pact_ended',
      distanceLy: distanceToThem(state, sv),
      title: `${sv.name} renounces our pacts`,
      text: voice(sv, 'We cannot stand beside you any longer. Whatever was between us is over.', 'AGREEMENTS TERMINATED. COUNTERPARTY STANDING BELOW THRESHOLD.'),
    });
    return true;
  }
  if (!sv.war && sv.disposition > 30 && mine.length < PACT_KINDS.length && !sv.proposal && state.civ.taint < 60 && chance() < 0.12) {
    // the pact they need most: help while they are failing, a watch while the Hunger is near them
    const kind = (sv.health < 0.6 && !mine.includes('aid') ? 'aid' : !mine.includes('watch') && hungerNear(state, sv) ? 'watch' : PACT_KINDS.find((k) => !mine.includes(k)))!;
    sendSignal(state, {
      from: sv.id,
      kind: 'pact_offer',
      distanceLy: distanceToThem(state, sv),
      title: `${sv.name} proposes ${PACTS[kind].name}`,
      text: voice(sv, `We would like to bind ourselves to you. ${PACTS[kind].desc}`, `AGREEMENT PROPOSED: ${PACTS[kind].name.toUpperCase()}. TERMS ATTACHED. THEY WILL BE KEPT EXACTLY.`),
      data: { pact: kind },
      choices: [
        { id: 'accept', label: 'Agree', hint: `The Threads must consent: ${pactCost(state)} accord now (dearer with every pact).` },
        { id: 'decline', label: 'Decline' },
      ],
    });
    return true;
  }
  return false;
}

/**
 * What our pacts do each turn: Mutual Aid beams help to whichever side is in trouble; Open
 * Archives pays a little insight, and now and then their notes on a project.
 */
export function pactsTurn(state: GameState) {
  const civ = state.civ;
  const cap = reserveCapacity(state, computeMods(state));
  const weak = civ.energy < cap * 0.15 && (civ.flags.last_energy_net ?? 0) < 0;
  for (const sv of Object.values(state.survivors)) {
    if (!sv.alive) continue;
    if (hasPact(sv, 'aid')) {
      const outKey = `pact_aid_out_${sv.id}`;
      const inKey = `pact_aid_in_${sv.id}`;
      // what they need, as far as we can spare it and keep 30% of our reserve
      const spare = civ.energy - cap * 0.3;
      const due = sv.health < 0.35 && state.turn - (civ.flags[outKey] ?? -99) >= AID_EVERY;
      if (due && spare < 5 && sv.way === 'lattice') {
        // the Tessellate holds us to our side of it, to the letter
        civ.flags[outKey] = state.turn;
        breach(state, sv);
        if (!hasPact(sv, 'aid')) continue;
      }
      if (due && spare >= 5) {
        const e = Math.floor(Math.min(15 + (0.35 - sv.health) * 100, spare));
        civ.energy -= e;
        beamEnergy(state, sv, e, true);
        civ.flags[outKey] = state.turn;
        log(state, `As our pact says, we beamed ${e} energy to ${sv.name}.`, 'info', sv.homeSystemId);
      }
      // they pay their side while they can; the Tessellate pays it even while failing
      if (weak && (sv.health > 0.4 || (sv.way === 'lattice' && sv.health > 0.05)) && state.turn - (civ.flags[inKey] ?? -99) >= AID_EVERY) {
        const e = Math.round(Math.min(60, Math.max(8, sv.pop * sv.health * 0.8)));
        sv.health = Math.max(0, sv.health - e / 1200);
        civ.flags[inKey] = state.turn;
        // they see our trouble when its light reaches them, and their beam takes as long again
        sendSignal(state, {
          from: sv.id,
          kind: 'aid_answer',
          distanceLy: distanceToThem(state, sv) * 2,
          title: `${sv.name} sends help, as our pact says`,
          text: voice(sv, `We saw you were in trouble. Here is ${e} energy; it is what the pact is for.`, `MUTUAL AID CLAUSE EXECUTED: ${e} UNITS BY BEAM.`),
          data: { energy: e },
        });
      }
    }
    if (hasPact(sv, 'archives')) {
      const gain = 0.5 + 0.02 * sv.pop * sv.health;
      if (civ.researching) civ.research[civ.researching] = (civ.research[civ.researching] ?? 0) + gain;
      else civ.flags.insight_bank = (civ.flags.insight_bank ?? 0) + gain;
      sv.health = Math.min(1, sv.health + 0.002);
      const since = state.turn - (sv.pacts!.archives ?? state.turn);
      if (since > 0 && since % NOTES_EVERY === 0) {
        const t = civ.researching ? TECH_BY_ID[civ.researching] : availableTechs(state).filter((x) => !x.taint).sort((a, b) => techCost(state, a.id) - techCost(state, b.id))[0];
        if (t) {
          const notes = Math.round(techCost(state, t.id) * 0.3);
          civ.research[t.id] = (civ.research[t.id] ?? 0) + notes;
          log(state, `From the archives of ${sv.name}: their notes on ${t.name} (${notes} insight toward it).`, 'good', sv.homeSystemId);
        }
      }
    }
  }
}

/** An awake swarm at one of their stars, or within a hundred light-years of one. */
function hungerNear(state: GameState, sv: Survivor): boolean {
  return Object.values(state.swarms).some((w) => {
    const at = w.systemId ? state.systems[w.systemId] : null;
    return !!at && w.awake && !w.tamed && sv.systems.some((id) => state.systems[id] && distLy(state.systems[id], at) <= 100);
  });
}

/** Shared Watch partners: their stars are eyes on the Hunger for us. */
export function watchPartners(state: GameState): Survivor[] {
  return Object.values(state.survivors).filter((sv) => hasPact(sv, 'watch'));
}
