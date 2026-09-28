import { signal } from '@preact/signals';
import type { Engine, Quality } from '../render/engine';
import { saveGame } from '../game/save';
import type { GameState } from '../game/types';

// UI state around the simulation. The game state is mutated in place by the simulation;
// `rev` bumps after every change so components re-render.

export type Screen = 'menu' | 'setup' | 'game';
export type Modal =
  | { kind: 'research' }
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
export const toast = signal<{ text: string; kind: 'info' | 'bad' | 'good'; at: number } | null>(null);
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
  toast.value = { text, kind, at: performance.now() };
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
