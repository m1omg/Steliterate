// Save compatibility: load saves written by earlier versions, check that they migrate, and play
// each to the end of time with the autoplayer. Old saves must always load.
// Usage: npm run savecompat [-- file...]   (default: every save in tools/saves/; JSON or save codes, .gz allowed)
// tools/saves/551fb1a-seed24757-turn71.json.gz is from the first published version (551fb1a):
// seed 24757, the competent autoplayer, 71 turns. When SAVE_VERSION goes up, add a save from the old version.

import { autoPlay } from '../src/game/auto';
import { formatEta } from '../src/game/eras';
import { exportCode, importCode, readSave, saveFile, SAVE_VERSION } from '../src/game/save';
import { endTurn } from '../src/game/sim/turn';
import { totalPops } from '../src/game/sim/util';

// No @types/node in this project (see sim.ts), so the few Node APIs used are declared here.
declare const process: { argv: string[]; exitCode?: number; getBuiltinModule(id: string): unknown };
const fs = process.getBuiltinModule('node:fs') as { readFileSync(p: string | URL): Uint8Array; readdirSync(p: string | URL): string[] };
const zlib = process.getBuiltinModule('node:zlib') as { gunzipSync(b: Uint8Array): Uint8Array };

const dir = new URL('./saves/', import.meta.url);
const args = process.argv.slice(2);
const targets: (string | URL)[] = args.length ? args : fs.readdirSync(dir).filter((f) => /\.(json|txt)(\.gz)?$/.test(f)).sort().map((f) => new URL(f, dir));

const read = (t: string | URL) => {
  const bytes = fs.readFileSync(t);
  return new TextDecoder().decode(String(t).endsWith('.gz') ? zlib.gunzipSync(bytes) : bytes);
};

let failures = 0;
for (const t of targets) {
  const name = String(t).split('/').pop();
  const state = readSave(read(t));
  if (!state) {
    failures++;
    console.log(`FAIL ${name}: not a readable save`);
    continue;
  }
  const problems: string[] = [];
  if (state.saveVersion !== SAVE_VERSION) problems.push(`saveVersion ${state.saveVersion} after migrate, expected ${SAVE_VERSION}`);
  const from = state.turn;
  let guard = 0;
  while (!state.outcome && guard++ < 1200) {
    autoPlay(state, 'competent');
    endTurn(state);
    const civ = state.civ;
    for (const [k, v] of Object.entries({ energy: civ.energy, matter: civ.matter, resolve: civ.resolve, dissent: civ.dissent, gfe: state.gfe })) {
      if (!Number.isFinite(v)) problems.push(`turn ${state.turn}: ${k} is ${v}`);
    }
    if (state.turn === from + 10) {
      // what this version writes must load again, as a save code and as a save file
      if (importCode(exportCode(state))?.turn !== state.turn) problems.push(`save code round trip failed at turn ${state.turn}`);
      if (readSave(saveFile(state).text)?.turn !== state.turn) problems.push(`save file round trip failed at turn ${state.turn}`);
    }
  }
  if (!state.outcome) problems.push(`unfinished after ${guard} turns`);
  const end = state.outcome ? `${state.outcome.kind.toUpperCase()} "${state.outcome.ending}"` : 'unfinished';
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${name}: turn ${from} → ${end} at turn ${state.turn} (${state.era}, η ${formatEta(state.eta, state.era)}), pops ${totalPops(state)}`);
  for (const p of problems.slice(0, 8)) console.log(`  ${p}`);
  if (problems.length) failures++;
}
console.log(failures ? `${failures} save(s) failed` : `SAVE COMPAT OK (${targets.length} save${targets.length === 1 ? '' : 's'})`);
process.exitCode = failures ? 1 : 0;
