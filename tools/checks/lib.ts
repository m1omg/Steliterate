// Shared helpers for the unit checks in tools/checks/unit. Run one with
//   npx tsx tools/checks/unit/<name>.ts
// or all of them with npm run check (tools/checks/run.mjs). Each prints `ok` or `BAD` per check
// and ends with `TAG OK` or `TAG FAILED (n)`, setting the exit code.

import { readSave } from '../../src/game/save';
import type { GameState } from '../../src/game/types';

// No @types/node in this project (see tools/sim.ts), so the few Node APIs used are declared here.
declare const process: { argv: string[]; exitCode?: number; getBuiltinModule(id: string): unknown };
const fs = process.getBuiltinModule('node:fs') as { readFileSync(p: string | URL): Uint8Array };
const zlib = process.getBuiltinModule('node:zlib') as { gunzipSync(b: Uint8Array): Uint8Array };

/** Arguments after the script name. */
export const args = process.argv.slice(2);

let bad = 0;

/** One check: prints `ok` or `BAD` with what was checked, and counts failures. */
export function check(ok: boolean, what: string): boolean {
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'BAD'} ${what}`);
  return ok;
}

/** A number within a relative tolerance of what it should be. */
export function near(what: string, got: number, want: number, tol = 1e-9): boolean {
  const ok = Math.abs(got - want) <= tol * Math.max(1, Math.abs(want));
  return check(ok, `${what}: ${got.toPrecision(6)} (want ${want.toPrecision(6)})`);
}

/** Ends the check: `TAG OK` (with an optional note) or `TAG FAILED (n)`, and the exit code. */
export function done(tag: string, note = ''): void {
  console.log(bad ? `${tag} FAILED (${bad})` : `${tag} OK${note ? ` (${note})` : ''}`);
  process.exitCode = bad ? 1 : 0;
}

/** A save from tools/saves/ (JSON or a save code, gzipped or not), migrated as the game loads it. */
export function loadSave(name: string): GameState {
  const bytes = fs.readFileSync(new URL(`../saves/${name}`, import.meta.url));
  const text = new TextDecoder().decode(name.endsWith('.gz') ? zlib.gunzipSync(bytes) : bytes);
  const state = readSave(text);
  if (!state) throw new Error(`${name} is not a readable save`);
  return state;
}
