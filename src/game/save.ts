import type { GameState } from './types';

// Saves live in this browser only. Every access is guarded: storage can be missing,
// full or blocked (private windows, previews), and the game must still run.

const KEY = 'steliterate.save.v1';
const AUTO = 'steliterate.autosave.v1';

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function serialize(state: GameState): string {
  // Infinity does not survive JSON; encode it
  return JSON.stringify(state, (_k, v) => (v === Infinity ? '__inf' : v === -Infinity ? '__-inf' : v));
}

export function deserialize(text: string): GameState | null {
  try {
    const s = JSON.parse(text, (_k, v) => (v === '__inf' ? Infinity : v === '__-inf' ? -Infinity : v)) as GameState;
    if (!s || typeof s !== 'object' || !s.systems || !s.civ) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState, auto = false): boolean {
  const store = ls();
  if (!store) return false;
  try {
    store.setItem(auto ? AUTO : KEY, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(auto = false): GameState | null {
  const store = ls();
  if (!store) return null;
  try {
    const t = store.getItem(auto ? AUTO : KEY);
    return t ? deserialize(t) : null;
  } catch {
    return null;
  }
}

export function hasSave(auto = false): boolean {
  const store = ls();
  if (!store) return false;
  try {
    return !!store.getItem(auto ? AUTO : KEY);
  } catch {
    return false;
  }
}

/** A portable save code the player can copy (downloads are blocked in the artifact viewer). */
export function exportCode(state: GameState): string {
  const json = serialize(state);
  try {
    return btoa(unescape(encodeURIComponent(json)));
  } catch {
    return '';
  }
}

export function importCode(code: string): GameState | null {
  try {
    return deserialize(decodeURIComponent(escape(atob(code.trim()))));
  } catch {
    return null;
  }
}

export function cloneState(state: GameState): GameState {
  return deserialize(serialize(state))!;
}
