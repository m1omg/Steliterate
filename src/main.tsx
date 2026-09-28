import { effect } from '@preact/signals';
import { render } from 'preact';
import { newGame } from './game/newGame';
import { orderFleet } from './game/sim/actions';
import { endTurn } from './game/sim/turn';
import { autoPlay } from './game/auto';
import type { GameState } from './game/types';
import { installUnlock, setVolumes } from './audio/core';
import { music } from './audio/music';
import { sfx } from './audio/sfx';
import { Engine } from './render/engine';
import { App } from './ui/App';
import { act, bump, engine, game, modal, screen, selection, setEngine, settings, targeting, view } from './ui/store';
import { doEndTurn } from './ui/turnflow';
import './ui/styles.css';

const stage = document.getElementById('stage')!;
const eng = new Engine(stage, {
  onPick(p) {
    const t = targeting.value;
    if (t && p && p.kind === 'system' && !p.id.startsWith('body:')) {
      targeting.value = null;
      if (act((g) => orderFleet(g, t.fleetId, p.id, t.order))) sfx('select');
      return;
    }
    if (screen.value !== 'game') return;
    if (!p) {
      selection.value = null;
      eng.select(null);
      return;
    }
    sfx('select');
    if (p.kind === 'system') {
      if (p.id.startsWith('body:')) selection.value = { kind: 'body', id: p.id.slice(5) };
      else selection.value = { kind: 'system', id: p.id };
    } else selection.value = { kind: p.kind, id: p.id };
    eng.select(p.id);
  },
  onHover() {},
  onEnterSystem(id) {
    if (screen.value !== 'game') return;
    selection.value = { kind: 'system', id };
    view.value = 'system';
    eng.showSystem(id);
  },
});
setEngine(eng);
eng.setQuality(settings.value.quality);
eng.start();
document.documentElement.style.fontSize = `${14 * settings.value.uiScale}px`;

// Sound: allowed only after the first gesture.
installUnlock();
setVolumes(settings.value.music, settings.value.sfx);
music.start();

// Behind the menu, the Coalescence of a preview world turns slowly.
let preview: GameState | null = null;
effect(() => {
  const sc = screen.value;
  if (sc === 'game') {
    eng.showLabels = true;
    eng.rig.autoYaw = 0;
    return;
  }
  eng.showLabels = false;
  eng.rig.autoYaw = 0.025;
  if (view.value === 'system') {
    view.value = 'galaxy';
    eng.showGalaxy();
  }
  if (!preview) preview = newGame({ seed: 7 });
  eng.setState(preview);
  const core = Object.values(preview.systems).find((x) => x.special === 'core');
  if (core) eng.focusGalaxyOn(core.id, 1500, true);
});

render(<App />, document.getElementById('ui')!);

// Enter ends the turn when nothing else has focus.
window.addEventListener('keydown', (e) => {
  if (screen.value !== 'game' || modal.value) return;
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
  if (e.key === 'Enter') doEndTurn();
  if (e.key === 'Escape') {
    targeting.value = null;
    selection.value = null;
    eng.select(null);
  }
});

// Debug and test hooks (used by the automated playtests).
declare global {
  interface Window {
    __stel: unknown;
  }
}
window.__stel = {
  newGame(opts: Record<string, unknown> = {}) {
    game.value = newGame(opts);
    screen.value = 'game';
    modal.value = null;
    bump();
    const s = game.value!;
    engine()?.focusGalaxyOn(s.civ.homeSystemId, 150, true);
  },
  endTurns(n: number, auto = true) {
    const s = game.value;
    if (!s) return;
    for (let i = 0; i < n && !s.outcome; i++) {
      if (auto) autoPlay(s, 'competent');
      endTurn(s);
      s.crossing = null;
      s.pending.length = 0;
    }
    bump();
  },
  state: () => game.value,
  engine: () => engine(),
};
