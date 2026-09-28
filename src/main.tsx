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
import type { Pickable } from './render/galaxyView';
import { tripLabel } from './ui/trip';
import { computeMods } from './game/sim/mods';
import { App } from './ui/App';
import { act, applyUiScale, bump, cycleViewMode, following, hoverStar, engine, game, hudPrefs, modal, notify, screen, selection, setEngine, settings, targeting, toggleOrbits, view } from './ui/store';
import { doEndTurn } from './ui/turnflow';
import { startLoaded } from './ui/screens/Misc';
import './ui/styles.css';

const stage = document.getElementById('stage')!;
/** The star system a pick stands for: the star itself, or the one a fleet is parked at. */
function starOf(p: Pickable): string | null {
  if (p.kind === 'system') return p.id.startsWith('body:') ? null : p.id;
  if (p.kind === 'fleet') return game.value?.fleets[p.id]?.at ?? null;
  return null;
}

const eng = new Engine(stage, {
  onPick(p, v, pointerType) {
    const t = targeting.value;
    // choosing a destination: a star, or a fleet parked at one, means that star
    const dest = t && p ? starOf(p) : null;
    if (t && dest) {
      targeting.value = null;
      hoverStar.value = null;
      const f = game.value?.fleets[t.fleetId];
      if (act((g) => orderFleet(g, t.fleetId, dest, t.order))) {
        sfx('select');
        const g = game.value;
        if (g && f?.to) notify(`${f.name} sets out for ${g.systems[dest].name}: ${tripLabel(g, f.distance, computeMods(g), true)}.`, 'info');
      }
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
    if (pointerType !== 'mouse' && p.kind === 'fleet' && sel?.kind === 'fleet' && sel.id === p.id) {
      sfx('select');
      eng.focusFleet(p.id);
      return;
    }
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
    // with a mouse a click only selects (double-click flies there); a tap flies at once
    eng.select(p.id, pointerType !== 'mouse');
    // on the galaxy map a picked star becomes the centre of the view (same zoom)
    if (v === 'galaxy' && p.kind === 'system' && !p.id.startsWith('body:')) eng.centreOn(p.id);
  },
  onHover(p) {
    if (!targeting.value) {
      if (hoverStar.value) hoverStar.value = null;
      return;
    }
    const id = p ? starOf(p) : null;
    if (hoverStar.value !== id) hoverStar.value = id;
  },
  onFollow(f) {
    following.value = f;
  },
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
eng.viewMode = hudPrefs.value.viewMode;
eng.start();
applyUiScale(settings.value.uiScale);
// a crosshair over the map while a destination is being chosen
effect(() => {
  document.documentElement.classList.toggle('picking', !!targeting.value);
});
window.addEventListener('resize', () => applyUiScale(settings.value.uiScale));

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
  if (key === 'v') {
    e.preventDefault();
    sfx('click');
    cycleViewMode();
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
    hoverStar.value = null;
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
  select(kind: 'fleet' | 'system' | 'body', id: string) {
    selection.value = { kind, id } as never;
  },
  state: () => game.value,
  engine: () => engine(),
};
