import { CHARTER_BY_ID } from './data/charters';
import { SHIP_BY_ID } from './data/ships';
import { STRUCTURE_BY_ID } from './data/structures';
import { TECH_BY_ID } from './data/techs';
import { defaultWater } from './gen';
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

/** The current save format. Bump it with a new step in migrate() whenever saved state changes shape. */
export const SAVE_VERSION = 2;

/**
 * Bring a save from any earlier version up to date, so old games keep working. Every step is
 * additive: fill in what the old format lacked, never throw away the player's progress.
 */
export function migrate(s: GameState): GameState {
  const v = s.saveVersion ?? 1;
  // containers a partial or hand-edited save might lack
  s.flags ??= {};
  s.fired ??= {};
  s.pending ??= [];
  s.log ??= [];
  s.battles ??= [];
  s.fleets ??= {};
  s.swarms ??= {};
  s.survivors ??= {};
  s.signals ??= [];
  s.forecasts ??= [];
  s.civ.flags ??= {};
  s.civ.research ??= {};
  s.civ.techs ??= [];
  s.civ.charters ??= [];
  if (v < 2) {
    // v2: every world has water coverage (it decides whether a dead world ices over)
    for (const b of Object.values(s.bodies)) {
      if (b.water === undefined) b.water = b.traits.includes('homeworld') ? 0.42 : defaultWater(b.kind, (b.seed % 1000) / 1000);
    }
  }
  // anything this version of the game no longer knows is dropped rather than left to break it
  s.civ.techs = s.civ.techs.filter((t) => TECH_BY_ID[t]);
  s.civ.charters = s.civ.charters.filter((c) => CHARTER_BY_ID[c]);
  if (s.civ.researching && !TECH_BY_ID[s.civ.researching]) s.civ.researching = null;
  for (const c of Object.values(s.colonies)) {
    c.structures ??= {};
    c.queue ??= [];
    for (const k of Object.keys(c.structures)) if (!STRUCTURE_BY_ID[k]) delete c.structures[k];
    c.queue = c.queue.filter((q) => (q.kind === 'ship' ? SHIP_BY_ID[q.key] : STRUCTURE_BY_ID[q.key]));
  }
  for (const f of Object.values(s.fleets)) {
    f.ships = f.ships.filter((x) => SHIP_BY_ID[x.cls]);
    if (!f.ships.length) delete s.fleets[f.id];
  }
  s.saveVersion = SAVE_VERSION;
  return s;
}

function serialize(state: GameState): string {
  // Infinity does not survive JSON; encode it
  return JSON.stringify(state, (_k, v) => (v === Infinity ? '__inf' : v === -Infinity ? '__-inf' : v));
}

export function deserialize(text: string): GameState | null {
  try {
    const s = JSON.parse(text, (_k, v) => (v === '__inf' ? Infinity : v === '__-inf' ? -Infinity : v)) as GameState;
    if (!s || typeof s !== 'object' || !s.systems || !s.civ) return null;
    return migrate(s);
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

/** A save as a file of its own: the same JSON the browser keeps, under a readable name. */
export function saveFile(state: GameState): { name: string; text: string } {
  const civ = (state.settings.civName || 'civilization').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'civilization';
  return { name: `steliterate-${civ}-turn-${state.turn}.json`, text: serialize(state) };
}

/** Read a save from a file or pasted text: plain JSON or a save code, from any version. */
export function readSave(text: string): GameState | null {
  const t = text.trim().replace(/^\uFEFF/, '');
  return t.startsWith('{') ? deserialize(t) : importCode(t);
}

export function cloneState(state: GameState): GameState {
  return deserialize(serialize(state))!;
}
