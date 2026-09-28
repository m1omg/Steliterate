import { signal } from '@preact/signals';
import type { Engine, Quality } from '../render/engine';
import { saveGame } from '../game/save';
import type { GameState } from '../game/types';

// UI state around the simulation. The game state is mutated in place by the simulation;
// `rev` bumps after every change so components re-render.

export type Screen = 'menu' | 'setup' | 'game';
export type Modal =
  | { kind: 'research' }
  | { kind: 'fleets' }
  | { kind: 'settlements'; tab?: 'worlds' }
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
}
export const toasts = signal<Toast[]>([]);
let toastId = 0;
export const busy = signal(false);
/** A fleet waiting for the player to pick its destination on the map. */
export const targeting = signal<{ fleetId: string; order: 'move' | 'survey' } | null>(null);
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

export function notify(text: string, kind: 'info' | 'bad' | 'good' = 'info') {
  // the same message twice in a row is one message
  if (toasts.value.some((t) => t.text === text)) return;
  const t: Toast = { id: ++toastId, text, kind };
  toasts.value = [...toasts.value, t].slice(-3);
  window.setTimeout(() => dismissToast(t.id), kind === 'bad' ? 6000 : 4500);
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
  const d: Settings = { music: 0.7, sfx: 0.7, quality: 'high', uiScale: 1 };
  try {
    const t = localStorage.getItem('steliterate.settings');
    return t ? { ...d, ...JSON.parse(t) } : d;
  } catch {
    return d;
  }
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
}
function loadHudPrefs(): HudPrefs {
  const d: HudPrefs = { forecasts: true, feed: true, orbitsPaused: false };
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
export function toggleOrbits() {
  const paused = !hudPrefs.value.orbitsPaused;
  setHudPrefs({ orbitsPaused: paused });
  const e = engine();
  if (e) e.orbitsPaused = paused;
}
