import { sourceLight } from '../physics';
import type { GameState, Survivor, ThreadId } from '../types';
import { createColony } from './fleets';
import type { Mods } from './mods';
import { canConverse, sendSignal, voiceClock } from './signals';
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
      const listening = civ.techs.includes('deep_listening') || dist <= mods.detect;
      if (!sv.contact && listening) {
        sv.contact = true;
        civ.known[sv.homeSystemId] = Math.max(civ.known[sv.homeSystemId] ?? 0, 1) as 1 | 2;
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
      if (!sv.contact) continue;
      const talk = canConverse(myClock, sv.clock, sv.way === 'lattice' ? 6 : 3);
      if (state.turn - sv.lastSent < 5 || !talk) continue;

      if (sv.health <= 0.02) {
        sv.alive = false;
        sv.fate = 'faded';
        sv.lastSent = state.turn;
        for (const sid of sv.systems) {
          const s = state.systems[sid];
          if (!s) continue;
          const b = s.bodies.map((id) => state.bodies[id]).find((x) => x && x.kind !== 'deep' && !x.relic && !x.dissolved);
          if (b) b.relic = { kind: 'tomb', state: 'found' };
        }
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
      } else if (sv.health < 0.22 && sv.disposition < -20 && rng.chance(0.35)) {
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
          text: defended ? 'Your defences turned their raiders away. They did not answer our hails afterwards.' : `Desperate ships drained ${took} energy from the reserve before anyone understood what was happening.`,
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
  sv.alive = false;
  sv.fate = 'seized';
  const sys = state.systems[sv.homeSystemId];
  const b = sys.bodies.map((bid) => state.bodies[bid]).find((x) => x && !x.colonyId && !x.dissolved);
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
