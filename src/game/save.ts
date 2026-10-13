import { CHARTER_BY_ID } from './data/charters';
import { SHIP_BY_ID } from './data/ships';
import { STRUCTURE_BY_ID } from './data/structures';
import { TECH_BY_ID } from './data/techs';
import { defaultWater } from './gen';
import { surveyWhereStationed } from './sim/fleets';
import { queueEvent } from './sim/events';
import { relightTheLastStar } from './sim/minds';
import { waitsForAnswer } from './sim/signals';
import type { GameState } from './types';
import { PLAYER_ID, assertPlayerView, linkCivs } from './civs';
import { STORE } from '../keys';

// Saves live in this browser only. Every access is guarded: storage can be missing,
// full or blocked (private windows, previews), and the game must still run.

const KEY = `${STORE}save`;
const AUTO = `${STORE}autosave`;

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** The current save format. Bump it with a new step in migrate() whenever saved state changes shape. */
export const SAVE_VERSION = 4;

/**
 * The new version's first save format (13 Oct). A save older than it is from the build before the
 * new version, which keeps it (`OLDER_BUILD` in keys.ts): the game says so and does not load it.
 * Only the checks still read such saves, as fixtures (`legacy`), through the old steps below.
 */
export const FIRST_OF_THIS_LINE = 4;

/** Facts about the universe kept in the one civilization's flags before the new version (13 Oct). */
const UNIVERSE_FLAGS = ['halo_drawn', 'matter_gone', 'flowed'];
/** And one civilization's own, kept in the state's (with `fcd:<forecast>`, a forecast put away). */
const CIV_FLAGS = ['first_swarm', 'decay_lost', 'gfe_prev', 'tut'];

/**
 * Bring a save from any earlier version up to date, so old games keep working. Every step is
 * additive: fill in what the old format lacked, never throw away the player's progress.
 */
export function migrate(s: GameState): GameState {
  const v = s.saveVersion ?? 1;
  // before the new version (13 Oct) the game had one civilization, the state's own `civ`: it is
  // the player's of the civilizations now (only the checks' fixtures still come this way)
  if (!s.civs) {
    s.civ.id ??= PLAYER_ID;
    s.civs = { [s.civ.id]: s.civ };
    s.player = s.civ.id;
  }
  linkCivs(s);
  // and these lists were the state's own; they are the civilization's now
  const loose = s as unknown as Record<string, unknown>;
  const civ = s.civ as unknown as Record<string, unknown>;
  for (const k of ['signals', 'forecasts', 'pending', 'log', 'crossing', 'outcome', 'fired']) {
    if (!(k in loose)) continue;
    if (civ[k] === undefined) civ[k] = loose[k];
    delete loose[k];
  }
  // containers a partial or hand-edited save might lack
  s.flags ??= {};
  s.civ.flags ??= {};
  // and some facts were kept with the wrong owner: what is true of the universe lives in the
  // state's flags, what is true of one civilization in its own
  for (const k of UNIVERSE_FLAGS) {
    if (!(k in s.civ.flags)) continue;
    s.flags[k] ??= s.civ.flags[k];
    delete s.civ.flags[k];
  }
  for (const k of Object.keys(s.flags)) {
    if (!CIV_FLAGS.includes(k) && !k.startsWith('fcd:')) continue;
    s.civ.flags[k] ??= s.flags[k];
    delete s.flags[k];
  }
  s.civ.fired ??= {};
  s.civ.pending ??= [];
  s.civ.log ??= [];
  s.civ.crossing ??= null;
  s.civ.outcome ??= null;
  s.battles ??= [];
  s.fleets ??= {};
  s.swarms ??= {};
  s.survivors ??= {};
  s.civ.signals ??= [];
  s.civ.forecasts ??= [];
  s.civ.research ??= {};
  s.civ.techs ??= [];
  s.civ.charters ??= [];
  if (v < 2) {
    // v2: every world has water coverage (it decides whether a dead world ices over)
    for (const b of Object.values(s.bodies)) {
      if (b.water === undefined) b.water = b.traits.includes('homeworld') ? 0.42 : defaultWater(b.kind, (b.seed % 1000) / 1000);
    }
  }
  if (v < 3) {
    // v3: the fate of matter has three answers; a game from before keeps the one it had
    s.fate ??= s.protonsDecay ? 'decay' : 'stable';
  }
  // a settlement keeps its system: one placed in the Deep of a hole that had evaporated while only
  // others lived there (taking back our own people who left) was left in a system marked gone,
  // with nothing on the map to click and no way for ships to reach it
  for (const c of Object.values(s.colonies)) {
    const sys = s.systems[c.systemId];
    const b = s.bodies[c.bodyId];
    if (sys?.gone && sys.primary.kind === 'void' && b && !b.dissolved) sys.gone = false;
  }
  // a system that fell into the Heart took its worlds with it (older games left them behind,
  // some feeding a star that was gone): every other way a system goes, its worlds are gone or adrift
  for (const sys of Object.values(s.systems)) {
    if (!sys.gone) continue;
    for (const id of sys.bodies) {
      const b = s.bodies[id];
      if (b && b.kind !== 'deep' && !b.dissolved && !b.rogue) b.dissolved = true;
    }
  }
  // anything this version of the game no longer knows is dropped rather than left to break it
  s.civ.techs = s.civ.techs.filter((t) => TECH_BY_ID[t]);
  s.civ.charters = s.civ.charters.filter((c) => CHARTER_BY_ID[c]);
  if (s.civ.researching && !TECH_BY_ID[s.civ.researching]) s.civ.researching = null;
  for (const c of Object.values(s.colonies)) {
    // (before the new version every settlement and fleet was the one civilization's)
    c.owner ??= s.player;
    c.structures ??= {};
    c.queue ??= [];
    for (const k of Object.keys(c.structures)) if (!STRUCTURE_BY_ID[k]) delete c.structures[k];
    c.queue = c.queue.filter((q) => (q.kind === 'ship' ? SHIP_BY_ID[q.key] : q.kind === 'passage' || q.kind === 'horizon' ? true : STRUCTURE_BY_ID[q.key]));
  }
  for (const f of Object.values(s.fleets)) {
    f.owner ??= s.player;
    f.ships = f.ships.filter((x) => SHIP_BY_ID[x.cls]);
    if (!f.ships.length) delete s.fleets[f.id];
  }
  // ships parked at stars they could not chart before (only probes could survey) chart them now
  surveyWhereStationed(s);
  // the Unlit's messages wait for an answer now (11 Oct): one that lapsed before opens again
  for (const sig of s.civ.signals) if (sig.resolved === 'lapsed' && waitsForAnswer(sig)) sig.resolved = null;
  // a Last Star lit by the old rule (before 12 Oct) burned out within a turn: it lights again,
  // while matter lasts, and its event offers its clock (the player's choice)
  const relit = relightTheLastStar(s);
  if (relit) queueEvent(s, 'last_star', { systemId: relit });
  s.saveVersion = SAVE_VERSION;
  return s;
}

function serialize(state: GameState): string {
  assertPlayerView(state, 'save');
  // Infinity does not survive JSON; encode it (and `civ`, a pointer into `civs`, is left out)
  return JSON.stringify(state, (_k, v) => (v === Infinity ? '__inf' : v === -Infinity ? '__-inf' : v));
}

function parse(text: string): GameState | null {
  try {
    const s = JSON.parse(text, (_k, v) => (v === '__inf' ? Infinity : v === '__-inf' ? -Infinity : v)) as GameState;
    return s && typeof s === 'object' && s.systems && (s.civs || s.civ) ? s : null;
  } catch {
    return null;
  }
}

/** A save as text, ready to play; null when it is not a save, or is from the build before the new version (unless `legacy`, for the checks' fixtures). */
export function deserialize(text: string, legacy = false): GameState | null {
  const s = parse(text);
  if (!s || (!legacy && (s.saveVersion ?? 1) < FIRST_OF_THIS_LINE)) return null;
  try {
    return migrate(s);
  } catch {
    return null;
  }
}

/** Whether this text (a save file or a save code) is a game from the build before the new version. */
export function fromOlderBuild(text: string): boolean {
  const t = text.trim().replace(/^\uFEFF/, '');
  let json = t;
  if (!t.startsWith('{')) {
    try {
      json = decodeURIComponent(escape(atob(t)));
    } catch {
      return false;
    }
  }
  const s = parse(json);
  return !!s && (s.saveVersion ?? 1) < FIRST_OF_THIS_LINE;
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

export function importCode(code: string, legacy = false): GameState | null {
  try {
    return deserialize(decodeURIComponent(escape(atob(code.trim()))), legacy);
  } catch {
    return null;
  }
}

// ---- save slots: as many named saves as the browser will hold, kept gzipped where it can

const SLOT_INDEX = `${STORE}slots`;
const slotKey = (id: string) => `${STORE}slot.${id}`;

export interface SlotInfo {
  id: string;
  name: string;
  civ: string;
  turn: number;
  era: string;
  savedAt: number; // ms since 1970
  bytes: number;
}

export function listSlots(): SlotInfo[] {
  const store = ls();
  if (!store) return [];
  try {
    const list = JSON.parse(store.getItem(SLOT_INDEX) ?? '[]') as SlotInfo[];
    return Array.isArray(list) ? list.sort((a, b) => b.savedAt - a.savedAt) : [];
  } catch {
    return [];
  }
}

function writeIndex(list: SlotInfo[]) {
  ls()?.setItem(SLOT_INDEX, JSON.stringify(list));
}

async function pack(text: string): Promise<string> {
  if (typeof CompressionStream === 'undefined') return `js:${text}`;
  const buf = new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `gz:${btoa(bin)}`;
}

async function unpack(stored: string): Promise<string> {
  if (stored.startsWith('js:')) return stored.slice(3);
  const bin = atob(stored.slice(3));
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

/**
 * Save into a slot: a new one, or over `id`. `savedAt` is now, unless the save keeps the time it
 * was made (one imported from a file of all saves). Resolves the slot, or an error to show.
 */
export async function saveToSlot(state: GameState, name: string, id?: string, savedAt = Date.now()): Promise<SlotInfo | string> {
  const store = ls();
  if (!store) return 'Storage is unavailable here. Export a file instead.';
  const slotId = id ?? `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  try {
    const data = await pack(serialize(state));
    store.setItem(slotKey(slotId), data);
    const info: SlotInfo = { id: slotId, name: name.trim() || `Turn ${state.turn}`, civ: state.settings.civName, turn: state.turn, era: state.era, savedAt, bytes: data.length };
    writeIndex([info, ...listSlots().filter((x) => x.id !== slotId)]);
    return info;
  } catch {
    return 'The browser’s storage is full. Delete a slot or two, or export this game to a file.';
  }
}

export async function loadSlot(id: string): Promise<GameState | null> {
  try {
    const stored = ls()?.getItem(slotKey(id));
    return stored ? deserialize(await unpack(stored)) : null;
  } catch {
    return null;
  }
}

export function deleteSlot(id: string) {
  try {
    ls()?.removeItem(slotKey(id));
    writeIndex(listSlots().filter((x) => x.id !== id));
  } catch {
    /* storage may be unavailable */
  }
}

// ---- every save at once (12 Oct, the player: "let me export all the saves from the browser, not
// just one"): one file with each slot, the quick save and the autosave, to keep them safe or to
// carry them all to another device, where importing it brings each back as a slot

const BUNDLE_KIND = 'steliterate-saves';

/** One save in a file of all saves: where it was kept, its name and time, and the save itself. */
export interface BundledSave {
  from: 'slot' | 'quick' | 'auto';
  name: string;
  /** When it was saved (ms since 1970); for the quick save and the autosave, when they were exported. */
  savedAt: number;
  /** The save as a save file holds it (JSON, with ±Infinity written as "__inf" and "__-inf"). */
  game: unknown;
}

interface SaveBundle {
  kind: typeof BUNDLE_KIND;
  version: 1;
  exported: string;
  saves: BundledSave[];
}

/** Every save this browser keeps, in one file. Resolves null when there is none (or no storage). */
export async function exportAllSaves(): Promise<{ name: string; text: string; count: number } | null> {
  const store = ls();
  if (!store) return null;
  const now = new Date();
  const saves: BundledSave[] = [];
  for (const x of listSlots()) {
    try {
      const stored = store.getItem(slotKey(x.id));
      if (stored) saves.push({ from: 'slot', name: x.name, savedAt: x.savedAt, game: JSON.parse(await unpack(stored)) });
    } catch {
      /* a slot that cannot be read is left out */
    }
  }
  for (const [from, key, name] of [['quick', KEY, 'Quick save'], ['auto', AUTO, 'Autosave']] as const) {
    try {
      const text = store.getItem(key);
      if (text) saves.push({ from, name, savedAt: now.getTime(), game: JSON.parse(text) });
    } catch {
      /* as above */
    }
  }
  if (!saves.length) return null;
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const bundle: SaveBundle = { kind: BUNDLE_KIND, version: 1, exported: now.toISOString(), saves };
  return { name: `steliterate-all-saves-${day}.json`, text: JSON.stringify(bundle), count: saves.length };
}

/** The saves in a file of all saves, or null when the text is not one. */
export function readSaveBundle(text: string): BundledSave[] | null {
  try {
    const b = JSON.parse(text.trim().replace(/^\uFEFF/, '')) as Partial<SaveBundle> | null;
    return b && b.kind === BUNDLE_KIND && Array.isArray(b.saves) ? b.saves : null;
  } catch {
    return null;
  }
}

/**
 * Each save from a file of all saves into a slot of its own, keeping its name and the time it was
 * saved; the quick save and the autosave come in as slots too, so this browser's own are never
 * overwritten. One already here (the same name, turn and time) is skipped, so a file imported
 * twice adds nothing. Resolves how many came in, were already here, and could not be read or did
 * not fit.
 */
export async function importSaveBundle(saves: BundledSave[]): Promise<{ added: number; skipped: number; failed: number; older: number }> {
  let added = 0;
  let skipped = 0;
  let failed = 0;
  let older = 0;
  for (const b of saves) {
    const text = b && typeof b === 'object' ? JSON.stringify(b.game) : '';
    const g = text ? deserialize(text) : null;
    if (!g) {
      if (text && fromOlderBuild(text)) older++;
      else failed++;
      continue;
    }
    const name = b.from === 'slot' ? String(b.name) : `${b.name}: ${g.settings.civName}, turn ${g.turn}`;
    const savedAt = Number.isFinite(b.savedAt) ? b.savedAt : Date.now();
    if (listSlots().some((x) => x.name === name && x.turn === g.turn && x.savedAt === savedAt)) {
      skipped++;
      continue;
    }
    const r = await saveToSlot(g, name, undefined, savedAt);
    if (typeof r === 'string') failed++;
    else added++;
  }
  return { added, skipped, failed, older };
}

/** A save as a file of its own: the same JSON the browser keeps, under a readable name. */
export function saveFile(state: GameState): { name: string; text: string } {
  const civ = (state.settings.civName || 'civilization').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'civilization';
  return { name: `steliterate-${civ}-turn-${state.turn}.json`, text: serialize(state) };
}

/** Read a save from a file or pasted text: plain JSON or a save code (of this version, unless `legacy`). */
export function readSave(text: string, legacy = false): GameState | null {
  const t = text.trim().replace(/^\uFEFF/, '');
  return t.startsWith('{') ? deserialize(t, legacy) : importCode(t, legacy);
}

export function cloneState(state: GameState): GameState {
  return deserialize(serialize(state))!;
}

/**
 * A deep copy, with nothing run on it (cloneState migrates its copy, as a load does): the checks
 * play out alternatives on these. A plain JSON copy would lose `state.civ`, a pointer JSON leaves
 * out; this one points it again.
 */
export function copyState(state: GameState): GameState {
  return linkCivs(parse(serialize(state))!);
}
