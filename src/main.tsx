import { effect } from '@preact/signals';
import { render } from 'preact';
import { newGame } from './game/newGame';
import { orderFleet } from './game/sim/actions';
import { endTurn } from './game/sim/turn';
import { autoPlay } from './game/auto';
import { exportCode, importCode, loadGame, saveGame } from './game/save';
import type { GameState } from './game/types';
import { installUnlock, setVolumes } from './audio/core';
import { music } from './audio/music';
import { sfx } from './audio/sfx';
import { Engine } from './render/engine';
import { App } from './ui/App';
import { act, bump, engine, game, hudPrefs, modal, notify, screen, selection, setEngine, settings, targeting, toggleOrbits, view } from './ui/store';
import { doEndTurn } from './ui/turnflow';
import { startLoaded } from './ui/screens/Misc';
import './ui/styles.css';

const stage = document.getElementById('stage')!;
const eng = new Engine(stage, {
  onPick(p, v, pointerType) {
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
    // on a touchscreen there is no double-click: tapping the selected star again looks inside
    const sel = selection.value;
    if (v === 'galaxy' && pointerType !== 'mouse' && p.kind === 'system' && !p.id.startsWith('body:') && sel?.kind === 'system' && sel.id === p.id) {
      sfx('select');
      view.value = 'system';
      eng.showSystem(p.id);
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
    eng.select(id);
    view.value = 'system';
    eng.showSystem(id);
  },
  onLeaveSystem() {
    if (screen.value !== 'game') return;
    view.value = 'galaxy';
    eng.showGalaxy();
  },
});
setEngine(eng);
eng.setQuality(settings.value.quality);
eng.orbitsPaused = hudPrefs.value.orbitsPaused;
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

// When the page is republished while open, carry the game across.
interface Hot {
  snapshot?: (fn: () => unknown) => void;
  ready?: (fn: (data: unknown) => void) => void;
  data?: unknown;
}
const hot = (window as unknown as { claude?: { hot?: Hot } }).claude?.hot;
hot?.snapshot?.(() => (game.value && screen.value === 'game' ? { save: exportCode(game.value) } : {}));
const boot = (data: unknown) => {
  const code = (data as { save?: string } | null)?.save;
  if (!code) return;
  const g = importCode(code);
  if (g) startLoaded(g);
};
if (hot?.ready) hot.ready(boot);
else boot(hot?.data ?? null);

// The GPU context: phones take it away in the background. Usually it comes back by itself;
// if it will not, save, reload the page, and pick the game up again where it was.
const RESUME = 'steliterate.resume';
eng.onContextChange = (st) => {
  if (st === 'lost') notify('The browser paused the graphics. Restoring…');
  else if (st === 'restored') notify('Graphics restored.', 'good');
  else if (screen.value === 'game' && game.value) {
    let ok = saveGame(game.value, true);
    try {
      sessionStorage.setItem(RESUME, '1');
    } catch {
      ok = false;
    }
    if (ok) location.reload();
    else notify('The graphics could not be restored. Make a save code (Save), then reload the page.', 'bad');
  } else location.reload();
};
try {
  if (sessionStorage.getItem(RESUME)) {
    sessionStorage.removeItem(RESUME);
    const g = loadGame(true);
    if (g && screen.value !== 'game') startLoaded(g);
  }
} catch {
  // no session storage: start at the menu as usual
}

// Keys: Enter ends the turn; letters open the main screens; H goes home.
const SCREEN_KEYS: Record<string, 'research' | 'settlements' | 'fleets' | 'threads' | 'charters' | 'signals' | 'log' | 'codex'> = {
  r: 'research',
  s: 'settlements',
  f: 'fleets',
  t: 'threads',
  c: 'charters',
  g: 'signals',
  l: 'log',
  k: 'codex',
};
window.addEventListener('keydown', (e) => {
  if (screen.value !== 'game' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  const key = e.key.toLowerCase();
  const open = modal.value?.kind;
  const target = SCREEN_KEYS[key];
  // Screens swap into each other; story dialogs (events, crossings) are never skipped this way.
  if (target && (!open || Object.values(SCREEN_KEYS).includes(open as never) || open === 'save' || open === 'settings')) {
    e.preventDefault();
    sfx('click');
    modal.value = open === target ? null : { kind: target };
    return;
  }
  // W: the list of every surveyed world (a tab of the Settlements window)
  if (key === 'w' && (!open || Object.values(SCREEN_KEYS).includes(open as never) || open === 'save' || open === 'settings')) {
    e.preventDefault();
    sfx('click');
    const m = modal.value;
    modal.value = m?.kind === 'settlements' && m.tab === 'worlds' ? null : { kind: 'settlements', tab: 'worlds' };
    return;
  }
  if (open) return;
  if (key === 'p') {
    e.preventDefault();
    toggleOrbits();
    return;
  }
  if (key === 'h') {
    const s = game.value;
    if (!s) return;
    sfx('select');
    const cap = s.civ.capitalId ? s.colonies[s.civ.capitalId] : null;
    const id = cap?.systemId ?? s.civ.homeSystemId;
    if (view.value === 'system') eng.showSystem(id);
    else eng.focusGalaxyOn(id, 150);
    selection.value = { kind: 'system', id };
    eng.select(id);
    return;
  }
  if (tag === 'BUTTON') return;
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
    if (opts.tutorial) game.value.flags.tut = 0;
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
  orderFleet(fleetId: string, systemId: string, order: 'move' | 'survey' | 'colonize' = 'survey') {
    return act((g) => orderFleet(g, fleetId, systemId, order));
  },
  state: () => game.value,
  engine: () => engine(),
};
