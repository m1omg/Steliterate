import { signal } from '@preact/signals';
import type { Engine, Quality } from '../render/engine';
import { saveGame } from '../game/save';
import type { GameState } from '../game/types';

// UI state around the simulation. The game state is mutated in place by the simulation;
// `rev` bumps after every change so components re-render.

export type Screen = 'menu' | 'setup' | 'game';
/** The Systems window's tabs past the first (our settlements): surveyed worlds, collision stars. */
export type SystemsTab = 'worlds' | 'beacons' | 'afar';
export type Modal =
  | { kind: 'research' }
  | { kind: 'fleets' }
  | { kind: 'settlements'; tab?: SystemsTab; send?: string }
  | { kind: 'charters' }
  | { kind: 'threads' }
  | { kind: 'signals' }
  | { kind: 'log' }
  | { kind: 'codex'; topic?: string }
  | { kind: 'settings' }
  | { kind: 'save' }
  | { kind: 'crossing' }
  | { kind: 'outcome' }
  | { kind: 'era_intro' }
  | null;

export interface Selection {
  kind: 'system' | 'body' | 'fleet' | 'swarm';
  id: string;
}

export interface Settings {
  music: number;
  sfx: number;
  quality: Quality;
  uiScale: number;
  /** Music playlist: piece id → in its age's rotation (unset: recordings in, the synthesized score out). */
  playlist: Record<string, boolean>;
  /** The Canon opens the Degenerate Age. */
  overture: boolean;
  /**
   * The magnifier mode, for low vision (a11y.ts): the HUD in one scrolling column, bigger sizes,
   * stronger contrast, focus that follows what opens. Unset in settings from before it.
   */
  lowVision?: boolean;
  /** The side its column keeps to. */
  lvSide?: 'left' | 'right';
}

export const game = signal<GameState | null>(null);
export const rev = signal(0);
export const screen = signal<Screen>('menu');
export const modal = signal<Modal>(null);
export const selection = signal<Selection | null>(null);
export const view = signal<'galaxy' | 'system'>('galaxy');
export const hover = signal<{ text: string; x: number; y: number } | null>(null);
export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'bad' | 'good';
  /** A button on the toast, such as Look; a toast with one stays up longer, to leave time to press it. */
  action?: { label: string; tip?: string; run: () => void };
}
export const toasts = signal<Toast[]>([]);
let toastId = 0;
export const busy = signal(false);
/** A fleet waiting for the player to pick its destination on the map. */
/** Open this settlement's Build tab when its panel next shows (from the idle-settlements reminder). */
export const openBuildFor = signal<string | null>(null);
export const targeting = signal<{ fleetId: string; order: 'move' | 'survey' } | null>(null);
/** While choosing a destination on the map: the star under the pointer. */
export const hoverStar = signal<string | null>(null);
/** What the camera is following (set by the engine). */
export const following = signal<{ kind: 'body' | 'fleet'; id: string; keepZoom?: boolean } | null>(null);

/** Interface sizes on offer; the whole UI layer is zoomed by the chosen factor. The two largest only in the magnifier mode, whose column scrolls. */
export const UI_SCALES: { v: number; label: string; lv?: boolean }[] = [
  { v: 0.85, label: 'Small' },
  { v: 1, label: 'Normal' },
  { v: 1.2, label: 'Large' },
  { v: 1.4, label: 'Huge' },
  { v: 1.6, label: '1.6×', lv: true },
  { v: 2, label: '2×', lv: true },
];
/** The largest size outside the magnifier mode. */
export const PLAIN_MAX_SCALE = 1.4;

// (after UI_SCALES, which loadSettings reads: before it, the read threw and the saved settings were ignored)
export const settings = signal<Settings>(loadSettings());

let engineRef: Engine | null = null;
export function setEngine(e: Engine) {
  engineRef = e;
}
export function engine(): Engine | null {
  return engineRef;
}

export function bump() {
  rev.value++;
  const g = game.value;
  if (g && engineRef) engineRef.setState(g);
}

export function notify(text: string, kind: 'info' | 'bad' | 'good' = 'info', action?: Toast['action']) {
  // the same message twice in a row is one message
  if (toasts.value.some((t) => t.text === text)) return;
  const t: Toast = { id: ++toastId, text, kind, action };
  toasts.value = [...toasts.value, t].slice(-3);
  // in the magnifier mode a message stays until it is closed or the turn ends: she may be looking elsewhere
  if (!settings.value.lowVision) window.setTimeout(() => dismissToast(t.id), action ? 12000 : kind === 'bad' ? 6000 : 4500);
}

/** Run a game action; show its error if any, refresh otherwise. */
export function act(fn: (s: GameState) => string | null | void): boolean {
  const g = game.value;
  if (!g) return false;
  const err = fn(g);
  if (typeof err === 'string' && err) {
    notify(err, 'bad');
    return false;
  }
  bump();
  return true;
}

export function autosave() {
  const g = game.value;
  if (g) saveGame(g, true);
}

function loadSettings(): Settings {
  const d: Settings = { music: 0.7, sfx: 0.7, quality: 'high', uiScale: 1, playlist: {}, overture: true };
  try {
    const t = localStorage.getItem('steliterate.settings');
    const s: Settings = t ? { ...d, ...JSON.parse(t) } : d;
    // older versions offered 0.9 / 1 / 1.12: snap to the nearest size now offered
    s.uiScale = UI_SCALES.reduce((a, b) => (Math.abs(b.v - s.uiScale) < Math.abs(a.v - s.uiScale) ? b : a)).v;
    if (!s.lowVision) s.uiScale = Math.min(s.uiScale, PLAIN_MAX_SCALE);
    return s;
  } catch {
    return d;
  }
}

/** The zoom actually in use: a bigger size is capped where the screen has no room for it. */
export const uiZoom = signal(1);

/** Zoom the UI layer (the 3D view keeps its own resolution). */
export function applyUiScale(u: number) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  // the layouts need about this much room, in the UI's own pixels; the magnifier mode's column
  // scrolls, and needs only its width
  const room = settings.value.lowVision ? w / 360 : w <= 760 ? Math.min(w / 380, h / 700) : Math.min(w / 1000, h / 640);
  const z = u <= 1 ? u : Math.max(1, Math.min(u, room));
  uiZoom.value = z;
  document.documentElement.style.setProperty('--z', z.toFixed(3));
  engineRef?.setUiZoom(z);
}

export function saveSettings(s: Settings) {
  settings.value = s;
  try {
    localStorage.setItem('steliterate.settings', JSON.stringify(s));
  } catch {
    /* storage may be unavailable */
  }
}

export function dismissToast(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

/** What the player has chosen to show in the corners of the HUD (kept between sessions). */
export interface HudPrefs {
  forecasts: boolean;
  feed: boolean;
  orbitsPaused: boolean;
  /** After answering an event about a particular star, swing the view there. */
  eventPivot: boolean;
  /** 0 natural light, 1 enhanced, 2 thermal. */
  viewMode: number;
  /** On a phone: the selection's sheet as last set with its handle (0 small, 1 half, 2 full). */
  sheet?: 0 | 1 | 2;
}
function loadHudPrefs(): HudPrefs {
  const d: HudPrefs = { forecasts: true, feed: true, orbitsPaused: false, eventPivot: true, viewMode: 0 };
  try {
    const t = localStorage.getItem('steliterate.hud');
    return t ? { ...d, ...JSON.parse(t) } : d;
  } catch {
    return d;
  }
}
export const hudPrefs = signal<HudPrefs>(loadHudPrefs());
export function setHudPrefs(p: Partial<HudPrefs>) {
  hudPrefs.value = { ...hudPrefs.value, ...p };
  try {
    localStorage.setItem('steliterate.hud', JSON.stringify(hudPrefs.value));
  } catch {
    /* storage may be unavailable */
  }
}

/** Freeze or release the planets' orbits in the system view (remembered between sessions). */
export const VIEW_MODES = [
  { label: 'Natural', tip: 'Natural light: what an eye would see. Late in the universe that is very little.' },
  { label: 'Enhanced', tip: 'Enhanced: light amplification. Dark worlds, night sides and dead stars show their surfaces, and the map keeps every known star visible.' },
  { label: 'Thermal', tip: 'Thermal: false colour by temperature, from near absolute zero (indigo) to thousands of kelvin (white). Settlements show as warm spots.' },
];

/** Step to the next view mode (V). */
export function cycleViewMode() {
  setViewMode((hudPrefs.value.viewMode + 1) % VIEW_MODES.length);
}

/** Show the universe one way: 0 natural light, 1 enhanced, 2 thermal (kept between sessions). */
export function setViewMode(m: number) {
  setHudPrefs({ viewMode: m });
  const e = engine();
  if (e) e.viewMode = m;
}

/** The magnifier mode's column folded away, to see the whole map (M). */
export const lvFolded = signal(false);

// ---- phones (styles.css: the phone-width and sideways blocks)

/** The phone layouts: narrow, or short and held sideways. The same test as the stylesheet's. */
const PHONE_QUERY = '(max-width: 760px), (max-height: 500px)';
const phoneMql = typeof matchMedia === 'function' ? matchMedia(PHONE_QUERY) : null;
/** A phone layout is in use (never in the magnifier mode, which has its own column). */
export const phone = signal(!!phoneMql?.matches);
phoneMql?.addEventListener?.('change', () => (phone.value = phoneMql.matches));
export const isPhone = () => phone.value && !settings.value.lowVision;
/**
 * The selection's sheet on a phone: 0 small (the map keeps most of the screen), 1 half, 2 full.
 * What is picked on the map opens it small; anything else at the size last chosen with its handle.
 */
export const sheetSize = signal<0 | 1 | 2>(hudPrefs.value.sheet ?? 1);
/** The selection just made on the map (its kind:id), for the sheet to open small. */
export const sheetHint: { mapKey: string | null } = { mapKey: null };
/** The top bar's details on a phone: the timeline, the forecasts and the latest of the Record. */
export const phoneMore = signal(false);
/** What the player last touched the screen with: a finger (or pen) or a mouse. */
export const touchInput = signal(false);
/** The magnifier mode: what is under the pointer on the map, named in large type beside it. */
export const mapHover = signal<{ text: string; x: number; y: number } | null>(null);

export function toggleOrbits() {
  const paused = !hudPrefs.value.orbitsPaused;
  setHudPrefs({ orbitsPaused: paused });
  const e = engine();
  if (e) e.orbitsPaused = paused;
}
