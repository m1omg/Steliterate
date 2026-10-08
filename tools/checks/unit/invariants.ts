// Whole games with the competent autoplayer, checked after every turn: no NaN anywhere in the
// state, no negative people, stores or sleepers, no settlement on a world that is gone (unless it
// lives on decay-proof substrate, which outlasts its world by design), survivors'
// health within 0..1, no ship left at zero hit points.
//   npx tsx tools/checks/unit/invariants.ts [games=12]
import { autoPlay } from '../../../src/game/auto';
import { newGame } from '../../../src/game/newGame';
import { STRUCTURE_BY_ID } from '../../../src/game/data/structures';
import { endTurn } from '../../../src/game/sim/turn';
import { THREADS } from '../../../src/game/types';
import { args, check, done } from '../lib';

function nans(o: unknown, path: string, out: string[]) {
  if (out.length > 3) return;
  if (typeof o === 'number') {
    if (Number.isNaN(o)) out.push(path);
    return;
  }
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) nans(v, `${path}.${k}`, out);
}

const games = Number(args[0] ?? 12);
const counts: Record<string, number> = {};
const example: Record<string, string> = {};
const hit = (k: string, e: string) => {
  counts[k] = (counts[k] ?? 0) + 1;
  example[k] ??= e;
};
const outcomes: Record<string, number> = {};
let turns = 0;
for (let g = 0; g < games; g++) {
  const seed = 1000 + g * 7919;
  const s = newGame({ seed, length: 'standard', survivors: 3, difficulty: 'standard' });
  let guard = 0;
  while (!s.outcome && guard++ < 1200) {
    autoPlay(s, 'competent');
    const era0 = s.era;
    endTurn(s);
    turns++;
    const tag = `seed ${seed} turn ${s.turn} ${era0}->${s.era}`;
    const bad: string[] = [];
    nans(s, 's', bad);
    if (bad.length) hit('NaN in the state', `${tag}: ${bad.join(', ')}`);
    for (const c of Object.values(s.colonies)) {
      for (const t of THREADS) if (c.pops[t] < 0) hit('negative people', `${tag} ${c.name} ${t} ${c.pops[t]}`);
      if (c.cryo < 0) hit('negative sleepers', tag);
      if (s.bodies[c.bodyId]?.dissolved && !Object.keys(c.structures).some((k) => STRUCTURE_BY_ID[k]?.decayProof)) hit('a settlement on a world that is gone', `${tag} ${c.name}`);
    }
    if (s.civ.energy < 0) hit('negative energy', `${tag} ${s.civ.energy}`);
    if (s.civ.matter < 0) hit('negative matter', `${tag} ${s.civ.matter}`);
    for (const sv of Object.values(s.survivors)) if (sv.alive && (sv.health < 0 || sv.health > 1)) hit('survivor health outside 0..1', `${tag} ${sv.name} ${sv.health.toFixed(3)}`);
    for (const f of Object.values(s.fleets)) for (const x of f.ships) if (x.hp <= 0) hit('a ship at zero hit points', tag);
  }
  const k = s.outcome ? s.outcome.kind : 'unfinished';
  outcomes[k] = (outcomes[k] ?? 0) + 1;
}
console.log(`  ${games} games, ${turns} turns: ${Object.entries(outcomes).map(([k, n]) => `${k} ${n}`).join(', ')}`);
check(!outcomes.unfinished, 'every game ends');
for (const k of ['NaN in the state', 'negative people', 'negative sleepers', 'a settlement on a world that is gone', 'negative energy', 'negative matter', 'survivor health outside 0..1', 'a ship at zero hit points']) {
  check(!counts[k], counts[k] ? `${k}: ${counts[k]} times (e.g. ${example[k]})` : `never ${k}`);
}
done('INVARIANTS', `${games} games`);
