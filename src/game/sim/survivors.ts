import { sourceLight } from '../physics';
import { SHIP_BY_ID } from '../data/ships';
import type { GameState, Survivor, ThreadId } from '../types';
import { createColony, isWarFleet } from './fleets';
import type { Mods } from './mods';
import { canConverse, sendSignal, voiceClock } from './signals';
import { queueEvent } from './events';
import { survivorWorld } from './homes';
import { formatDistance, formatYears } from '../eras';
import { capital, clamp, distLy, hasCharter, log, withRng } from './util';

// Fellow survivors: other young civilizations facing the same end. Simulated lightly: their
// fate follows the same physics, and they talk to you across light-years.

const WAY_DRAIN: Record<Survivor['way'], number> = { garden: 1.5, upload: 0.8, chorus: 0.9, dormant: 0.55, lattice: 0.7, fork: 1 };

function voice(sv: Survivor, human: string, protocol: string): string {
  return sv.way === 'lattice' ? protocol : human;
}

function distanceTo(state: GameState, sv: Survivor): number {
  const cap = capital(state);
  const a = cap ? state.systems[cap.systemId] : state.systems[state.civ.homeSystemId];
  const b = state.systems[sv.homeSystemId];
  return a && b ? distLy(a, b) : 0;
}

export function updateSurvivors(state: GameState, logL: number, mods: Mods, L: number) {
  const civ = state.civ;
  const myClock = voiceClock(state, logL);
  withRng(state, (rng) => {
    for (const sv of Object.values(state.survivors)) {
      if (!sv.alive) continue;
      const home = state.systems[sv.homeSystemId];
      // their clock drifts toward the age, as ours does
      sv.clock += (Math.min(logL, sv.way === 'garden' ? 1.7 : sv.way === 'dormant' ? logL + 1 : logL) - sv.clock) * 0.25;
      // the universe drains them
      let drain = 0.004;
      if (state.era === 'dusk') {
        const light = home ? sourceLight(state, home, state.years, isFinite(L) ? L : 0).light : 0;
        drain = light < 0.3 ? 0.03 : 0.004;
      } else if (state.era === 'degenerate') drain = 0.02;
      else if (state.era === 'blackhole') drain = 0.025;
      else drain = 0.04;
      drain *= WAY_DRAIN[sv.way] / (0.5 + state.gfe * 0.5);
      if (sv.way === 'garden' && state.era !== 'dusk' && state.protonsDecay) drain *= 1.4;
      sv.health = clamp(sv.health - drain + rng.range(-0.004, 0.006), 0, 1);
      sv.pop = Math.max(0, sv.pop * (0.98 + sv.health * 0.03));

      const dist = distanceTo(state, sv);
      // a living civilization is far louder than a star: its lights, heat and chatter carry
      // twenty-five times as far as we can see stars; and a ship that surveys its star meets it
      const listening = civ.techs.includes('deep_listening') || dist <= mods.detect * 25 || civ.known[sv.homeSystemId] === 2;
      if (!sv.contact && listening) {
        sv.contact = true;
        civ.known[sv.homeSystemId] = Math.max(civ.known[sv.homeSystemId] ?? 0, 1) as 1 | 2;
        // first contact is a moment, not a line in the log
        queueEvent(state, 'first_contact', {
          survivorId: sv.id,
          systemId: sv.homeSystemId,
          name: sv.name,
          star: home?.name ?? 'a distant star',
          dist: formatDistance(dist),
          age: formatYears(dist),
          words: voice(sv, firstWords(sv), `PROTOCOL HANDSHAKE. ORIGIN: ${sv.name.toUpperCase()}. STATUS: CONTINUING.`),
        });
        sendSignal(state, {
          from: sv.id,
          kind: 'hello',
          distanceLy: dist,
          title: `${sv.name}: first contact`,
          text: voice(
            sv,
            firstWords(sv),
            `PROTOCOL HANDSHAKE. ORIGIN: ${sv.name.toUpperCase()}. STATUS: CONTINUING. CONSCIOUS OPERATORS: NONE. REQUEST: EXCHANGE OF SURPLUS. THIS PROCESS WILL KEEP ITS AGREEMENTS.`,
          ),
        });
        continue;
      }
      const talk = sv.contact && canConverse(myClock, sv.clock, sv.way === 'lattice' ? 6 : 3);

      // with nothing left they fade, whether or not we can hear them go
      if (sv.health <= 0.02) {
        sv.alive = false;
        sv.fate = 'faded';
        for (const sid of sv.systems) {
          const s = state.systems[sid];
          if (!s) continue;
          const b = s.bodies.map((id) => state.bodies[id]).find((x) => x && x.kind !== 'deep' && !x.relic && !x.dissolved);
          // a tomb we know of if we knew them; otherwise one for a survey to find
          if (b) b.relic = { kind: 'tomb', state: sv.contact ? 'found' : 'hidden' };
        }
        if (!sv.contact) continue;
        if (!talk) {
          log(state, `${sv.name}’s lights have gone out. Whatever they said at the end, their clock and ours were too far apart for us to follow.`, 'bad', sv.homeSystemId);
          continue;
        }
        sv.lastSent = state.turn;
        sendSignal(state, {
          from: sv.id,
          kind: 'last',
          distanceLy: dist,
          title: `${sv.name}: last transmission`,
          text: voice(
            sv,
            `This is the last of us. We are sending everything we know, in case it helps. Remember that we were here. Remember that we tried.`,
            `FINAL STATE. OPERATIONS CEASE. ATTACHED: COMPLETE RECORDS. NO FURTHER REPLIES WILL BE GENERATED.`,
          ),
          data: { insight: Math.round(60 + sv.pop * 4) },
        });
        continue;
      }
      if (!sv.contact) continue;
      if (state.turn - sv.lastSent < 5 || !talk) continue;

      // what do they need, and how do they feel about us
      if (sv.health < 0.45 && rng.chance(0.55)) {
        const ask = Math.round(20 + (1 - sv.health) * 50);
        sv.lastSent = state.turn;
        sendSignal(state, {
          from: sv.id,
          kind: 'aid',
          distanceLy: dist,
          title: `${sv.name} asks for help`,
          text: voice(sv, `Our sources are failing faster than we planned. Can you spare ${ask} energy? We will not forget it.`, `DEFICIT PROJECTED. REQUEST: ${ask} ENERGY UNITS. RECIPROCITY WILL BE LOGGED.`),
          data: { ask },
          choices: [
            { id: 'give', label: `Send ${ask} energy`, hint: 'They recover a little and trust you more.' },
            { id: 'refuse', label: 'Refuse', hint: 'They will remember.' },
          ],
        });
      } else if (sv.health < 0.3 && hasCharter(state, 'sanctuary') && rng.chance(0.5)) {
        sv.lastSent = state.turn;
        const n = Math.max(1, Math.round(sv.pop / 8));
        sendSignal(state, {
          from: sv.id,
          kind: 'refugees',
          distanceLy: dist,
          title: `${sv.name}: refugees`,
          text: voice(sv, `Some of us want to come to you while we still can. ${n} of us are ready to travel. Will you take them?`, `SURPLUS UNITS: ${n}. TRANSFER PROPOSED. UNITS WILL ACCEPT YOUR PROTOCOLS.`),
          data: { n },
          choices: [
            { id: 'accept', label: `Take in ${n}`, hint: 'They arrive at your capital as a new part of you.' },
            { id: 'refuse', label: 'Turn them away' },
          ],
        });
      } else if ((sv.health < 0.22 || (sv.raidedAt !== undefined && sv.disposition < -50) || (sv.tempted !== undefined && state.turn - sv.tempted < 10)) && sv.disposition < -20 && rng.chance(0.35)) {
        // the desperate take what they can; those we raided come back for what we took; and
        // the hostile we begged for help know we are weak
        const revenge = sv.health >= 0.22 && sv.raidedAt !== undefined;
        const opening = sv.health >= 0.22 && !revenge;
        sv.lastSent = state.turn;
        const took = Math.round(Math.min(civ.energy * 0.2, 60));
        const cap = capital(state);
        // a defence grid, or warships fortified over the capital, turns raiders away
        const defended = cap && ((cap.structures.defense_grid ?? 0) > 0 || Object.values(state.fleets).some((f) => f.at === cap.systemId && f.order === 'fortify'));
        if (!defended && took > 0) civ.energy -= took;
        sendSignal(state, {
          from: sv.id,
          kind: 'raid',
          distanceLy: 0,
          title: defended ? `${sv.name} tried to raid you` : `${sv.name} raided your reserves`,
          text: defended
            ? 'Your defences turned their raiders away. They did not answer our hails afterwards.'
            : revenge
              ? `Their ships came back for what we took from them, and ${took} energy more. They did not answer our hails afterwards.`
              : opening
                ? `We told them we were weak when we asked them for help. They came for ${took} energy of what little we had.`
                : `Desperate ships drained ${took} energy from the reserve before anyone understood what was happening.`,
        });
      } else if (sv.disposition > 35 && sv.health > 0.4 && rng.chance(0.25) && !civ.flags[`joint_${sv.id}`]) {
        sv.lastSent = state.turn;
        sendSignal(state, {
          from: sv.id,
          kind: 'joint',
          distanceLy: dist,
          title: `${sv.name} proposes a shared work`,
          text: voice(sv, `Together we could build what neither of us can alone: a shared collector field, split fairly. It costs 60 matter from each of us.`, `JOINT CONSTRUCTION PROPOSED. INPUT: 60 MATTER. OUTPUT: SHARED ENERGY STREAM. TERMS IMMUTABLE.`),
          choices: [
            { id: 'join', label: 'Commit 60 matter', hint: '+6 energy per turn for as long as they endure.' },
            { id: 'decline', label: 'Decline' },
          ],
        });
      } else if (rng.chance(0.2)) {
        sv.lastSent = state.turn;
        sendSignal(state, {
          from: sv.id,
          kind: 'trade',
          distanceLy: dist,
          title: `${sv.name} offers a trade`,
          text: voice(sv, `We have knowledge we cannot use and need matter we cannot find. 40 matter for what we have learned?`, `EXCHANGE: 40 MATTER FOR ONE DATA PACKAGE (INSIGHT). ACCEPT/REJECT.`),
          choices: [
            { id: 'trade', label: 'Trade 40 matter', hint: 'Receive their research.' },
            { id: 'decline', label: 'Decline' },
          ],
        });
      }
    }
  });
}

function firstWords(sv: Survivor): string {
  switch (sv.way) {
    case 'garden':
      return 'We hear you. We thought we were alone. We are still living on our world, under our own sky, and we mean to keep it that way as long as we can. Are you well?';
    case 'upload':
      return 'Greetings from the Archive. We left our bodies long ago and keep everything that was ever written. We would like to trade what we know for what you know.';
    case 'chorus':
      return 'We are the Choir, and we greet you as one voice. We were many once. You are still many, we can tell. It will get easier.';
    case 'dormant':
      return 'This message will reach you long after we sent it, and we will be asleep when you answer. We sleep through the lean ages and wake to listen. Leave us a message.';
    default:
      return 'We hear you.';
  }
}

export function resolveSurvivorSignal(state: GameState, sigUid: string, choice: string): string | null {
  const sig = state.signals.find((s) => s.uid === sigUid);
  if (!sig || sig.resolved) return 'Already answered.';
  const sv = state.survivors[sig.from];
  const civ = state.civ;
  switch (sig.kind) {
    case 'aid': {
      const ask = Number(sig.data.ask);
      if (choice === 'give') {
        if (civ.energy < ask) return `You have only ${civ.energy.toFixed(0)} energy.`;
        civ.energy -= ask;
        if (sv) {
          sv.health = Math.min(1, sv.health + 0.12 + ask / 600);
          sv.disposition = Math.min(100, sv.disposition + 15);
          sv.aidGiven += ask;
        }
        civ.resolve = Math.min(100, civ.resolve + 1);
      } else if (sv) sv.disposition -= 12;
      break;
    }
    case 'refugees': {
      if (choice === 'accept' && sv) {
        const cap = capital(state);
        if (!cap) return 'You have no capital to receive them.';
        const n = Number(sig.data.n);
        const t: ThreadId = sv.way === 'lattice' ? 'lattice' : sv.way === 'upload' || sv.way === 'dormant' ? 'echoes' : sv.way === 'chorus' ? 'chorus' : 'kin';
        cap.pops[t] += n;
        sv.pop = Math.max(0, sv.pop - n * 2);
        sv.disposition += 10;
        civ.resolve = Math.min(100, civ.resolve + 3);
        civ.flags.refugees = (civ.flags.refugees ?? 0) + n;
        log(state, `${n} refugees from ${sv.name} have joined you at ${cap.name}.`, 'good', cap.systemId);
      } else if (sv) sv.disposition -= 8;
      break;
    }
    case 'joint': {
      if (choice === 'join' && sv) {
        if (civ.matter < 60) return 'You need 60 matter.';
        civ.matter -= 60;
        civ.flags[`joint_${sv.id}`] = 1;
        sv.health = Math.min(1, sv.health + 0.15);
        sv.disposition += 10;
        log(state, `A shared collector field with ${sv.name} begins to take shape.`, 'good');
      }
      break;
    }
    case 'trade': {
      if (choice === 'trade') {
        if (civ.matter < 40) return 'You need 40 matter.';
        civ.matter -= 40;
        const gain = 60 + state.turn * 0.5;
        if (civ.researching) civ.research[civ.researching] = (civ.research[civ.researching] ?? 0) + gain;
        else civ.flags.insight_bank = (civ.flags.insight_bank ?? 0) + gain;
        if (sv) sv.health = Math.min(1, sv.health + 0.05);
      }
      break;
    }
    default:
      break;
  }
  sig.resolved = choice;
  return null;
}

/** Joint projects pay out while the partner endures. */
export function jointIncome(state: GameState): number {
  let e = 0;
  for (const sv of Object.values(state.survivors)) if (sv.alive && state.civ.flags[`joint_${sv.id}`]) e += 6;
  return e;
}

/** Take a survivor's star by force. A heavy choice. */
export function seizeSurvivor(state: GameState, id: string): string | null {
  const sv = state.survivors[id];
  if (!sv || !sv.alive) return 'They are gone.';
  const civ = state.civ;
  const fleetThere = Object.values(state.fleets).some((f) => f.at === sv.homeSystemId && f.ships.some((s) => s.cls === 'warden' || s.cls === 'aegis'));
  if (!fleetThere) return 'You need warships at their home system.';
  const sys = state.systems[sv.homeSystemId];
  // we take the world they lived on
  const b = survivorWorld(state, sv) ?? sys.bodies.map((bid) => state.bodies[bid]).find((x) => x && !x.colonyId && !x.dissolved);
  sv.alive = false;
  sv.fate = 'seized';
  if (b) {
    const t: ThreadId = sv.way === 'lattice' ? 'lattice' : sv.way === 'garden' ? 'kin' : 'echoes';
    createColony(state, b, { [t]: Math.max(1, Math.round(sv.pop / 6)) });
  }
  civ.resolve = Math.max(0, civ.resolve - 8);
  civ.dissent = Math.min(100, civ.dissent + 10);
  civ.taint = Math.min(100, civ.taint + 5);
  for (const o of Object.values(state.survivors)) if (o.alive) o.disposition -= 30;
  log(state, `You took ${sv.name}’s star. Some of them live on as your people now. The rest do not.`, 'bad', sys.id);
  return null;
}

/** How many turns must pass before we can ask the same civilization for help again. */
export const ASK_COOLDOWN = 8;

/** Why we cannot ask this civilization for help right now, or null. */
export function askBlocked(state: GameState, sv: Survivor): string | null {
  if (!sv.alive) return 'They are gone.';
  if (!sv.contact) return 'We have not made contact.';
  if (state.signals.some((x) => x.from === sv.id && x.kind === 'aid_answer' && x.arrivedTurn === null)) return 'Our last request is still on its way, or their answer is.';
  if (sv.askedAt !== undefined && state.turn - sv.askedAt < ASK_COOLDOWN) return `We asked them recently. Wait ${ASK_COOLDOWN - (state.turn - sv.askedAt)} more turn(s).`;
  return null;
}

/**
 * Ask a civilization for energy. The request goes out at the speed of light and their answer (and
 * the beam carrying what they give) comes back the same way, so it arrives after the round trip.
 * What they give depends on how they feel about us, how they are faring and what we have given
 * them; it costs them a little of their own health, and every request costs a little goodwill.
 * A hostile civilization refuses, and if we are weak, now knows it.
 */
export function requestAid(state: GameState, id: string): string | null {
  const sv = state.survivors[id];
  if (!sv) return 'They are gone.';
  const blocked = askBlocked(state, sv);
  if (blocked) return blocked;
  const civ = state.civ;
  const cap = capital(state);
  const home = state.systems[sv.homeSystemId];
  const dist = cap && home ? distLy(state.systems[cap.systemId], home) : 0;
  // asking again soon wears thin
  const again = sv.askedAt !== undefined && state.turn - sv.askedAt < ASK_COOLDOWN * 3;
  sv.askedAt = state.turn;
  sv.disposition = Math.max(-100, sv.disposition - (again ? 12 : 6));
  let energy = 0;
  let words: string;
  let protocol: string;
  if (sv.disposition < -20) {
    words = 'You took from us, or never helped us, and now you ask. No.';
    protocol = 'REQUEST DENIED. COUNTERPARTY STANDING: NEGATIVE.';
    if (civ.energy < 40) sv.tempted = state.turn;
  } else if (sv.health < 0.3) {
    words = 'We are sorry. We have nothing left to give; we are going dark ourselves.';
    protocol = 'REQUEST DENIED. SURPLUS: NONE. OPERATIONS CONTRACTING.';
  } else {
    const reciprocity = Math.min(30, sv.aidGiven / 5);
    energy = Math.round(Math.max(0, Math.min(60, sv.pop * sv.health * (0.4 + sv.disposition / 100) + reciprocity)));
    if (energy < 5) {
      energy = 0;
      words = 'We cannot spare anything now. Perhaps later, if things go better for us, or between us.';
      protocol = 'REQUEST DEFERRED. SURPLUS BELOW TRANSFER THRESHOLD.';
    } else {
      sv.health = clamp(sv.health - energy / 1200, 0, 1);
      words = reciprocity > 10 ? `You helped us when we needed it. Here is ${energy} energy; it is the least we can do.` : `We can spare ${energy} energy. It is on its way to you.`;
      protocol = `TRANSFER AUTHORISED: ${energy} UNITS BY BEAM. RECIPROCITY LOGGED.`;
    }
  }
  sendSignal(state, {
    from: sv.id,
    kind: 'aid_answer',
    distanceLy: dist * 2,
    title: energy > 0 ? `${sv.name} sends help` : `${sv.name} answers our request`,
    text: voice(sv, words, protocol),
    data: { energy },
  });
  log(state, `We asked ${sv.name} for help. The request travels at the speed of light; their answer will take ${dist > 0 ? formatYears(dist * 2) : 'no time'} to come back.`, 'info', sv.homeSystemId);
  return null;
}

/** How many turns must pass before the same civilization can be raided again. */
export const RAID_COOLDOWN = 5;

const isRaider = (cls: string) => (SHIP_BY_ID[cls]?.attack ?? 0) > 0 && !SHIP_BY_ID[cls]?.settles;

/** The combined attack of every warship stationed at `systemId`: they all join a raid. */
export function raidStrength(state: GameState, systemId: string): number {
  let a = 0;
  for (const f of Object.values(state.fleets)) if (f.at === systemId) for (const s of f.ships) if (isRaider(s.cls)) a += SHIP_BY_ID[s.cls].attack;
  return a;
}

/** A civilization our warships at `systemId` could raid, if any. */
export function raidTarget(state: GameState, systemId: string): Survivor | null {
  return Object.values(state.survivors).find((v) => v.alive && v.contact && v.systems.includes(systemId)) ?? null;
}

/**
 * Raid another civilization with the warships parked at one of its stars: take part of its
 * reserve and some matter, if the ships get through. Whatever happens, they will not forget it,
 * the others hear of it, and our own people do not like what we have become.
 */
export function raidSurvivor(state: GameState, fleetId: string): { ok: boolean; text: string } | string {
  const f = state.fleets[fleetId];
  if (!f || !f.at) return 'The fleet must be stationed at their star.';
  const sv = raidTarget(state, f.at);
  if (!sv) return 'No civilization we know of lives here.';
  if (!isWarFleet(f)) return 'Only warships can raid.';
  const attack = raidStrength(state, f.at);
  if (sv.raidedAt !== undefined && state.turn - sv.raidedAt < RAID_COOLDOWN) return `They are on guard since the last raid. Wait ${RAID_COOLDOWN - (state.turn - sv.raidedAt)} more turn(s).`;
  const civ = state.civ;
  const sys = state.systems[f.at];
  sv.raidedAt = state.turn;
  let result: { ok: boolean; text: string } = { ok: false, text: '' };
  withRng(state, (rng) => {
    const defence = Math.max(1, sv.pop * sv.health * 0.3);
    const hurt = (lo: number, hi: number) => {
      for (const x of Object.values(state.fleets).filter((y) => y.at === f.at)) {
        for (const s of x.ships) if (isRaider(s.cls)) s.hp -= rng.range(lo, hi);
        x.ships = x.ships.filter((s) => s.hp > 0);
        if (!x.ships.length) delete state.fleets[x.id];
      }
    };
    if (attack * rng.range(0.6, 1.4) >= defence * 0.5) {
      const energy = Math.round(Math.min(60, 5 + sv.reserve * 0.4));
      const matter = Math.round(8 + sv.pop * 0.6);
      civ.energy += energy;
      civ.matter += matter;
      sv.reserve = Math.max(0, sv.reserve - energy);
      sv.health = clamp(sv.health - 0.06, 0, 1);
      sv.pop *= 0.96;
      hurt(0, 1.5);
      result = { ok: true, text: `Our warships raided ${sv.name} at ${sys.name}: +${energy} energy, +${matter} matter. Some of them died defending it.` };
    } else {
      hurt(1, 3.5);
      result = { ok: false, text: `${sv.name} drove our raiders off at ${sys.name}. We took nothing, and our ships are hurt.` };
    }
  });
  // what it costs, whatever happened
  sv.disposition = Math.max(-100, sv.disposition - 35);
  for (const o of Object.values(state.survivors)) if (o.alive && o.contact && o.id !== sv.id) o.disposition = Math.max(-100, o.disposition - 10);
  civ.resolve = Math.max(0, civ.resolve - 3);
  civ.dissent = Math.min(100, civ.dissent + 4);
  state.battles.push({ systemId: sys.id, turn: state.turn, text: result.text });
  log(state, result.text, 'combat', sys.id);
  sendSignal(state, {
    from: sv.id,
    kind: 'raided',
    distanceLy: 0,
    title: `${sv.name} answers the raid`,
    text: voice(sv, result.ok ? 'We thought you were the others who would make it. We were wrong about you. We will remember this for as long as we last.' : 'You came to take from the dying and could not even do that. We will remember this for as long as we last.', 'HOSTILE ACTION LOGGED. COUNTERPARTY RECLASSIFIED: PREDATOR. RECORD RETAINED.'),
  });
  return result;
}

/** The dark path: devour a failing survivor whole. */
export function devourSurvivor(state: GameState, id: string): string | null {
  const sv = state.survivors[id];
  if (!sv || !sv.alive) return 'They are gone.';
  if (!hasCharter(state, 'absorb_the_weak')) return 'Only a civilization that has enacted Absorb the Weak would do this.';
  if (sv.health > 0.4) return 'They are still strong enough to resist.';
  const civ = state.civ;
  sv.alive = false;
  sv.fate = 'devoured';
  civ.energy += 80 + sv.pop * 3;
  civ.matter += 60 + sv.pop * 4;
  civ.taint = Math.min(100, civ.taint + 10);
  civ.resolve = Math.max(0, civ.resolve - 6);
  state.gfe = Math.max(0.05, state.gfe - 0.01);
  for (const o of Object.values(state.survivors)) if (o.alive) o.disposition -= 40;
  log(state, `${sv.name} is gone. You are fuller than you have been in ages.`, 'bad', sv.homeSystemId);
  return null;
}
