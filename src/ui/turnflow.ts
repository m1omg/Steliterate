import { endTurn } from '../game/sim/turn';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { autosave, busy, bump, game, modal, notify } from './store';

// Ending a turn: run the simulation, refresh the views, and surface what needs attention.
// A Long Sleep keeps ending turns on its own, pausing whenever something happens.

export function doEndTurn() {
  const s = game.value;
  if (!s || busy.value || s.outcome) return;
  busy.value = true;
  sfx('endturn');
  const eraBefore = s.era;
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
  if (s.civ.sleepTurns > 0 && s.pending.length === 0) {
    window.setTimeout(doEndTurn, 420);
  }
}
