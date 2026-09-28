import { SHIP_BY_ID } from '../game/data/ships';
import { endTurn } from '../game/sim/turn';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { autosave, busy, bump, engine, game, modal, notify } from './store';
import { TECH_BY_ID } from '../game/data/techs';
import { isIdleFleet } from '../game/sim/fleets';
import { shipQueue } from './hud/ShipPrompt';
import { researchPrompt } from './hud/ResearchPrompt';

// Ending a turn: run the simulation, refresh the views, and surface what needs attention.
// A Long Sleep keeps ending turns on its own, pausing whenever something happens.

export function doEndTurn() {
  const s = game.value;
  if (!s || busy.value || s.outcome) return;
  busy.value = true;
  sfx('endturn');
  const eraBefore = s.era;
  const fleetsBefore = new Set(Object.keys(s.fleets));
  const knownBefore = { ...s.civ.known };
  const researchingBefore = s.civ.researching;
  const techsBefore = new Set(s.civ.techs);
  const idleBefore = new Set(Object.values(s.fleets).filter(isIdleFleet).map((f) => f.id));
  const r = endTurn(s);
  bump();
  autosave();
  busy.value = false;
  if (r.outcome) {
    modal.value = { kind: 'outcome' };
    music.setMood('outcome');
    return;
  }
  if (r.crossing) {
    modal.value = { kind: 'crossing' };
    sfx('crossing');
    return;
  }
  if (s.era !== eraBefore) music.setEra(s.era);
  if (r.arrived.some((a) => a.choices.length)) {
    notify(`${r.arrived.length === 1 ? 'A signal has' : `${r.arrived.length} signals have`} arrived.`, 'info');
    sfx('signal');
  }
  if (r.wasted > 5) notify(`${Math.round(r.wasted)} energy was lost: the reserve is full.`, 'bad');
  if (researchingBefore && !s.civ.researching && s.civ.techs.includes(researchingBefore)) {
    researchPrompt.value = { done: researchingBefore };
    sfx('good');
  }
  // ships that have just run out of orders (arrived, surveyed, or newly built): ask about them
  const nowIdle = Object.values(s.fleets).filter((f) => isIdleFleet(f) && !idleBefore.has(f.id) && !f.ships.some((x) => SHIP_BY_ID[x.cls]?.settles)).map((f) => f.id);
  if (nowIdle.length) shipQueue.value = [...shipQueue.value.filter((id) => s.fleets[id] && isIdleFleet(s.fleets[id])), ...nowIdle];
  // worked out from surplus insight, without being asked
  const surplus = s.civ.techs.filter((t) => !techsBefore.has(t) && t !== researchingBefore);
  if (surplus.length) notify(`With insight to spare: ${surplus.map((t) => TECH_BY_ID[t]?.name ?? t).join(', ')}.`, 'good');
  // discoveries: new stars on the map, and systems charted by probes
  const detected = Object.keys(s.civ.known).filter((id) => s.civ.known[id] === 1 && !knownBefore[id]);
  const surveyed = Object.keys(s.civ.known).filter((id) => s.civ.known[id] === 2 && knownBefore[id] !== 2 && !Object.values(s.colonies).some((c) => c.systemId === id));
  for (const id of detected) engine()?.ping(id, '#bfe9ff');
  for (const id of surveyed) engine()?.ping(id, '#9ff5e6');
  if (surveyed.length) {
    const sys = s.systems[surveyed[0]];
    const worlds = sys.bodies.filter((b) => s.bodies[b] && !s.bodies[b].dissolved && s.bodies[b].kind !== 'deep').length;
    notify(`Survey complete: ${sys.name}, ${worlds} world${worlds === 1 ? '' : 's'}${surveyed.length > 1 ? `, and ${surveyed.length - 1} more system${surveyed.length > 2 ? 's' : ''}` : ''}.`, 'good');
    sfx('signal');
  } else if (detected.length) notify(`${detected.length} new star${detected.length === 1 ? '' : 's'} on the map.`, 'info');
  const newSettlers = Object.values(s.fleets).filter((f) => !fleetsBefore.has(f.id) && f.ships.some((x) => SHIP_BY_ID[x.cls]?.settles));
  if (newSettlers.length) notify(`${newSettlers[0].name} is ready at ${s.systems[newSettlers[0].at ?? '']?.name ?? 'the shipyard'}. Open Fleets to choose a world.`, 'good');
  if (s.civ.sleepTurns > 0 && s.pending.length === 0) {
    window.setTimeout(doEndTurn, 420);
  }
}
