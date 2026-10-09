import { effect } from '@preact/signals';
import { render } from 'preact';
// exponents drawn as raised digits of the font around them (before anything renders)
import './ui/sup';
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
import { PLAIN_MAX_SCALE, act, applyUiScale, bump, cycleViewMode, following, hoverStar, engine, game, hudPrefs, lvFolded, mapHover, modal, notify, saveSettings, screen, selection, setEngine, setViewMode, settings, targeting, toggleOrbits, view } from './ui/store';
import { PRIMARY_NAME, bodyKindName } from './ui/labels';
import { doEndTurn } from './ui/turnflow';
import { startLoaded } from './ui/screens/Misc';
import { guardTranslation } from './ui/translateGuard';
import { applyLowVision, trackKeyboard } from './ui/a11y';
import { buildSelected, nextTodo } from './ui/hud/Hud';
import { eventResult, loreView } from './ui/screens/Story';
import './ui/styles.css';

const stage = document.getElementById('stage')!;
/** The star system a pick stands for: the star itself, the one a fleet is parked at, or a swarm's (where it is, or where it is going). */
function starOf(p: Pickable): string | null {
  if (p.kind === 'system') return p.id.startsWith('body:') ? null : p.id;
  if (p.kind === 'fleet') return game.value?.fleets[p.id]?.at ?? null;
  if (p.kind === 'swarm') {
    const sw = game.value?.swarms[p.id];
    return sw?.systemId ?? sw?.to ?? null;
  }
  return null;
}

/** What the pointer is on, in a few words: a star and its kind (and whether surveyed or ours), a world, a fleet, a swarm. */
function hoverName(p: Pickable): string {
  const g = game.value;
  if (!g) return '';
  if (p.kind === 'system' && p.id.startsWith('body:')) {
    const b = g.bodies[p.id.slice(5)];
    return b ? `${b.colonyId ? g.colonies[b.colonyId]?.name ?? b.name : b.name} · ${bodyKindName(g, b)}` : '';
  }
  if (p.kind === 'system') {
    const sys = g.systems[p.id];
    if (!sys) return '';
    const ours = Object.values(g.colonies).some((c) => c.systemId === sys.id);
    return `${sys.name} · ${PRIMARY_NAME[sys.primary.kind]}${ours ? ' · ours' : g.civ.known[sys.id] === 2 ? '' : ' · not surveyed'}`;
  }
  if (p.kind === 'fleet') {
    const f = g.fleets[p.id];
    return f ? `${f.name} · ${f.at && g.systems[f.at] ? `at ${g.systems[f.at].name}` : 'under way'}` : '';
  }
  if (p.kind === 'swarm') return g.swarms[p.id]?.tamed ? 'Tamed swarm' : 'Hunger swarm';
  return '';
}

const eng = new Engine(stage, {
  onPick(p, v, pointerType) {
    const t = targeting.value;
    // choosing a destination: a star, a fleet parked at one or a swarm means that star
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
  onHover(p, x, y) {
    // the magnifier mode names what is under the pointer, in large type beside it
    if (settings.value.lowVision) mapHover.value = p ? { text: hoverName(p), x, y } : null;
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
// the magnifier mode can be switched on from a link: …/?lowvision (and off with ?lowvision=0)
{
  const q = new URLSearchParams(location.search).get('lowvision');
  if (q !== null) {
    const on = q !== '0' && q !== 'off';
    if (on !== !!settings.value.lowVision) {
      saveSettings({ ...settings.value, lowVision: on, uiScale: on ? settings.value.uiScale : Math.min(settings.value.uiScale, PLAIN_MAX_SCALE) });
      if (on) setViewMode(1);
    }
  }
}
applyLowVision();
// a crosshair over the map while a destination is being chosen
effect(() => {
  document.documentElement.classList.toggle('picking', !!targeting.value);
});
window.addEventListener('resize', () => applyUiScale(settings.value.uiScale));

// Sound: allowed only after the first gesture.
installUnlock();
setVolumes(settings.value.music, settings.value.sfx);
music.setPlaylist(settings.value.playlist, settings.value.overture);
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

// a page translated by the browser stays live (translateGuard.ts)
guardTranslation(document.getElementById('ui')!);
trackKeyboard();
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
  // W: the list of every surveyed world (a tab of the Systems window)
  if (key === 'w' && (!open || Object.values(SCREEN_KEYS).includes(open as never) || open === 'save' || open === 'settings')) {
    e.preventDefault();
    sfx('click');
    const m = modal.value;
    modal.value = m?.kind === 'settlements' && m.tab === 'worlds' ? null : { kind: 'settlements', tab: 'worlds' };
    return;
  }
  if (open) return;
  // an event (or what came of it) is answered with its own buttons; the survey report closes with Escape
  const g = game.value;
  const story = !!g && (g.pending.length > 0 || !!eventResult.value);
  // the magnifier mode: N what needs attention next, B the selected settlement's Build tab, M the column folded away
  if (settings.value.lowVision && !story && g && (key === 'n' || key === 'b' || key === 'm')) {
    e.preventDefault();
    sfx('click');
    if (key === 'n') nextTodo(g);
    else if (key === 'b') buildSelected(g);
    else lvFolded.value = !lvFolded.value;
    return;
  }
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
  if (e.key === 'Escape') {
    if (story) return;
    if (loreView.value) {
      loreView.value = null;
      return;
    }
    // whatever has focus (it used to do nothing while a button had it)
    targeting.value = null;
    hoverStar.value = null;
    selection.value = null;
    eng.select(null);
    return;
  }
  // a control in focus (a button, a row) answers Enter itself
  if (e.key === 'Enter' && !story && !loreView.value && !(e.target as Element | null)?.closest?.('button, a[href], [role="button"], summary')) doEndTurn();
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
  // `keep` leaves events waiting for the autoplayer to answer next turn, as the balance harness does
  endTurns(n: number, auto = true, keep = false) {
    const s = game.value;
    if (!s) return;
    for (let i = 0; i < n && !s.outcome; i++) {
      if (auto) autoPlay(s, 'competent');
      endTurn(s);
      s.crossing = null;
      if (!keep) s.pending.length = 0;
    }
    bump();
  },
  /** One turn's worth of the autoplayer's choices (events answered too), without ending the turn. */
  autoPlay() {
    const s = game.value;
    if (s && !s.outcome) autoPlay(s, 'competent');
    bump();
  },
  orderFleet(fleetId: string, systemId: string, order: 'move' | 'survey' | 'colonize' = 'survey') {
    return act((g) => orderFleet(g, fleetId, systemId, order));
  },
  select(kind: 'fleet' | 'system' | 'body', id: string) {
    selection.value = { kind, id } as never;
  },
  refresh: () => bump(),
  /** A message as the game shows them (the checks: how long it stays). */
  notify: (text: string, kind: 'info' | 'bad' | 'good' = 'info') => notify(text, kind),
  state: () => game.value,
  engine: () => engine(),
  /** The music player (its layer: the synth bus, and the recording playing), for the checks. */
  music: () => music,
};
