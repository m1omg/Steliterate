import { SHIP_BY_ID } from '../game/data/ships';
import { turnSlices, type TurnResult } from '../game/sim/turn';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { autosave, busy, bump, engine, filmsOn, game, modal, notify, playFilm, selection, settings, toasts } from './store';
import { crossingFilm, endingFilmFor } from '../film/films';
import { fateOf } from '../game/fate';
import { goToBody, goToFleet, pivotToSystem } from './screens/Lists';
import { TECH_BY_ID } from '../game/data/techs';
import { isIdleFleet, livingWorlds, naturalKinRoom } from '../game/sim/fleets';
import { shipQueue } from './hud/ShipPrompt';
import { researchPrompt } from './hud/ResearchPrompt';
import { colonies, fleets } from '../game/sim/util';
import type { GameState } from '../game/types';

// Ending a turn: run the simulation, refresh the views, and surface what needs attention.
// A Long Sleep keeps ending turns on its own, pausing whenever something happens.

/**
 * How long a slice of the turn may run before the browser gets a breath: the music schedules its
 * notes only 0.3 s ahead (music.ts), and a phone takes several times as long as this machine.
 */
const SLICE_MS = 12;

/**
 * At least this often a breath waits for a timer: a message to ourselves can run ahead of the
 * timers that are due, and the synth's lookahead timer (every 40 ms, music.ts) needs its turn.
 */
const TIMER_MS = 40;

/** For the checks (`__stel.slowSlices`): every slice of the turn made to take at least this long (ms), as on a slow phone. */
let slowSlices = 0;
export function setSlowSlices(ms: number) {
  slowSlices = ms;
}

/** At most this many of a turn's deep-dark flashes are marked on the map. */
const MAX_FLASH_PINGS = 16;

/** Let the browser breathe: a task of its own (a message to ourselves, without a timer's clamp), or, with `timer`, after the timers due. */
function breathe(timer: boolean): Promise<void> {
  return new Promise((done) => {
    if (timer) {
      setTimeout(done, 0);
      return;
    }
    const ch = new MessageChannel();
    ch.port1.onmessage = () => done();
    ch.port2.postMessage(0);
  });
}

/**
 * Play the turn in its slices (turnSlices: each civilization's part of a step whole), breathing
 * whenever they have run for long. Nothing acts on the game meanwhile (busy: act refuses).
 */
async function playTurn(s: GameState): Promise<TurnResult> {
  const g = turnSlices(s);
  const start = performance.now();
  let t0 = start;
  let timed = start;
  let work = 0;
  let longest = 0;
  for (;;) {
    const a = performance.now();
    const r = g.next();
    // (a check's slow phone: the slice runs on until it has taken that long)
    if (slowSlices > 0) for (const until = a + slowSlices; performance.now() < until; );
    const b = performance.now();
    work += b - a;
    if (r.done) {
      longest = Math.max(longest, b - t0);
      lastTurn = { work, longest, wall: b - start };
      return r.value;
    }
    if (b - t0 > SLICE_MS) {
      longest = Math.max(longest, b - t0);
      const timer = b - timed > TIMER_MS;
      await breathe(timer);
      t0 = performance.now();
      if (timer) timed = t0;
    }
  }
}

/** The last turn's time, for tools/turn-timing.cjs: its own work, its longest run without a breath, and from start to end. */
export let lastTurn: { work: number; longest: number; wall: number } | null = null;

export async function doEndTurn() {
  const s = game.value;
  if (!s || busy.value || s.civ.outcome) return;
  busy.value = true;
  sfx('endturn');
  // the magnifier mode keeps a turn's messages until the next one
  if (settings.value.lowVision) toasts.value = [];
  const eraBefore = s.era;
  const fleetsBefore = new Set(fleets(s).map((f) => f.id));
  const knownBefore = { ...s.civ.known };
  const researchingBefore = s.civ.researching;
  const techsBefore = new Set(s.civ.techs);
  const idleBefore = new Set(fleets(s).filter(isIdleFleet).map((f) => f.id));
  const contactBefore = new Set(Object.values(s.survivors).filter((v) => v.contact).map((v) => v.id));
  const shipsBefore = new Map(fleets(s).map((f) => [f.id, f.ships.length]));
  const lastLog = s.civ.log[s.civ.log.length - 1];
  let r: TurnResult;
  try {
    r = await playTurn(s);
  } finally {
    busy.value = false;
  }
  bump();
  autosave();
  if (r.outcome) {
    // the ending's film first, where it has one (the music turns once the film is over)
    const film = endingFilmFor(r.outcome.ending);
    if (film && filmsOn()) playFilm(film, { kind: 'outcome' }, { eta: s.eta, fate: fateOf(s) });
    else {
      modal.value = { kind: 'outcome' };
      music.setMood('outcome');
    }
    return;
  }
  if (r.crossing) {
    // the crossing's film, then its report
    const film = crossingFilm(r.crossing.title, r.crossing.to);
    if (film) playFilm(film, { kind: 'crossing' }, { fate: fateOf(s) });
    else modal.value = { kind: 'crossing' };
    sfx('crossing');
    return;
  }
  if (s.era !== eraBefore) music.setEra(s.era);
  if (r.arrived.some((a) => a.choices.length)) {
    notify(`${r.arrived.length === 1 ? 'A signal has' : `${r.arrived.length} signals have`} arrived.`, 'info');
    sfx('signal');
  }
  // first contact: we are not alone, and it should feel like it
  for (const v of Object.values(s.survivors)) {
    if (!v.contact || contactBefore.has(v.id)) continue;
    // the First Contact event tells the story; the map shows where
    const home = s.systems[v.homeSystemId];
    if (home) engine()?.ping(home.id, v.color);
    sfx('signal');
  }
  // a swarm going for one of our ships: say so (two at most; the Record keeps the rest)
  const at = lastLog ? s.civ.log.lastIndexOf(lastLog) : -1;
  const fresh = lastLog && at < 0 ? [] : s.civ.log.slice(at + 1);
  for (const e of fresh.filter((x) => x.fleet).slice(0, 2)) {
    const f = s.fleets[e.fleet!];
    const lost = !f || f.ships.length < (shipsBefore.get(e.fleet!) ?? 0);
    notify(e.text, e.kind === 'bad' || lost ? 'bad' : 'info', f ? { label: 'Look', tip: `Go to ${f.name}`, run: () => goToFleet(s, f) } : undefined);
  }
  if (r.wasted > 5) notify(`${Math.round(r.wasted)} energy was lost: the reserve is full.`, 'bad');
  if (researchingBefore && !s.civ.researching && s.civ.techs.includes(researchingBefore)) {
    researchPrompt.value = { done: researchingBefore };
    sfx('good');
  }
  // ships that have just run out of orders (arrived, surveyed, or newly built): ask about them
  const nowIdle = fleets(s).filter((f) => isIdleFleet(f) && !idleBefore.has(f.id) && !f.ships.some((x) => SHIP_BY_ID[x.cls]?.settles)).map((f) => f.id);
  if (nowIdle.length) shipQueue.value = [...shipQueue.value.filter((id) => s.fleets[id] && isIdleFleet(s.fleets[id])), ...nowIdle];
  // worked out from surplus insight, without being asked
  const surplus = s.civ.techs.filter((t) => !techsBefore.has(t) && t !== researchingBefore);
  if (surplus.length) notify(`With insight to spare: ${surplus.map((t) => TECH_BY_ID[t]?.name ?? t).join(', ')}.`, 'good');
  // discoveries: new stars on the map, and systems charted by probes
  const detected = Object.keys(s.civ.known).filter((id) => s.civ.known[id] === 1 && !knownBefore[id]);
  const surveyed = Object.keys(s.civ.known).filter((id) => s.civ.known[id] === 2 && knownBefore[id] !== 2 && !colonies(s).some((c) => c.systemId === id));
  for (const id of detected) engine()?.ping(id, '#bfe9ff');
  for (const id of surveyed) engine()?.ping(id, '#9ff5e6');
  // the deep dark's flashes, where matter is stable: a black dwarf exploding, a system's matter
  // tunnelling into black holes (a few at most: in a turn of the collapse there can be many)
  const flashes = r.notes.filter((n) => (n.kind === 'blackdwarf_sn' || n.kind === 'collapse') && s.civ.known[n.systemId]);
  for (const n of flashes.slice(0, MAX_FLASH_PINGS)) engine()?.ping(n.systemId, n.kind === 'blackdwarf_sn' ? '#fff3dc' : '#cdbcff');
  const living = surveyed.flatMap((id) => livingWorlds(s, id));
  if (living.length) {
    const b = living.sort((x, y) => y.habitability * y.vitality - x.habitability * x.vitality)[0];
    notify(`Living world found: ${b.name} in ${s.systems[b.systemId].name}, ${Math.round(b.habitability * b.vitality * 100)}% habitable, room for ${naturalKinRoom(b, s)} Kin${living.length > 1 ? ` (and ${living.length - 1} more)` : ''}.`, 'good', {
      label: 'Look',
      tip: `Go to ${b.name}`,
      run: () => goToBody(b),
    });
    for (const w of living) engine()?.ping(w.systemId, '#b8f5a0');
    sfx('good');
  }
  if (surveyed.length) {
    const sys = s.systems[surveyed[0]];
    const worlds = sys.bodies.filter((b) => s.bodies[b] && !s.bodies[b].dissolved && s.bodies[b].kind !== 'deep').length;
    notify(`Survey complete: ${sys.name}, ${worlds} world${worlds === 1 ? '' : 's'}${surveyed.length > 1 ? `, and ${surveyed.length - 1} more system${surveyed.length > 2 ? 's' : ''}` : ''}.`, 'good', {
      label: 'Look',
      tip: `Look inside ${sys.name}: its worlds, and what the survey found`,
      // inside the system, with its panel listing the worlds
      run: () => {
        selection.value = { kind: 'system', id: sys.id };
        pivotToSystem(sys.id, true);
      },
    });
    sfx('signal');
  } else if (detected.length) notify(`${detected.length} new star${detected.length === 1 ? '' : 's'} on the map.`, 'info');
  const newSettlers = fleets(s).filter((f) => !fleetsBefore.has(f.id) && f.ships.some((x) => SHIP_BY_ID[x.cls]?.settles));
  if (newSettlers.length) notify(`${newSettlers[0].name} is ready at ${s.systems[newSettlers[0].at ?? '']?.name ?? 'the shipyard'}. Open Fleets to choose a world.`, 'good');
  if (s.civ.sleepTurns > 0 && s.civ.pending.length === 0) {
    window.setTimeout(doEndTurn, 420);
  }
}
