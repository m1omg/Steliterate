// A game saved and loaded (as a save code, and as a clone) plays on exactly as the original does:
// the same state after loading, and the same after sixty more turns with the autoplayer.
import { autoPlay } from '../../../src/game/auto';
import { newGame } from '../../../src/game/newGame';
import { cloneState, exportCode, importCode } from '../../../src/game/save';
import { endTurn } from '../../../src/game/sim/turn';
import type { GameState } from '../../../src/game/types';
import { check, done } from '../lib';

const plain = (s: GameState): unknown => JSON.parse(JSON.stringify(s, (_k, v) => (v === Infinity ? '__inf' : v === -Infinity ? '__-inf' : v)));
function firstDiff(a: unknown, b: unknown, path = 's'): string | null {
  if (typeof a !== typeof b) return `${path}: ${typeof a} vs ${typeof b}`;
  if (a && b && typeof a === 'object') {
    const ka = Object.keys(a),
      kb = Object.keys(b);
    if (ka.join('|') !== kb.join('|')) return `${path}: keys differ (${ka.filter((k) => !kb.includes(k)).join(',')} | ${kb.filter((k) => !ka.includes(k)).join(',')}) or order`;
    for (const k of ka) {
      const d = firstDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
      if (d) return d;
    }
    return null;
  }
  return Object.is(a, b) ? null : `${path}: ${String(a)} vs ${String(b)}`;
}
const play = (s: GameState) => {
  if (s.outcome) return;
  autoPlay(s, 'competent');
  endTurn(s);
};

for (const seed of [1000, 16838, 32676]) {
  for (const at of [40, 120]) {
    const a = newGame({ seed });
    for (let g = 0; !a.outcome && a.turn < at && g < 1200; g++) play(a);
    if (a.outcome) {
      console.log(`  seed ${seed}: ended before turn ${at}`);
      continue;
    }
    const b = importCode(exportCode(a))!;
    const c = cloneState(a);
    const loaded = firstDiff(plain(a), plain(b));
    for (let i = 0; i < 60; i++) for (const s of [a, b, c]) play(s);
    const byCode = firstDiff(plain(a), plain(b));
    const byClone = firstDiff(plain(a), plain(c));
    check(!loaded && !byCode && !byClone, `seed ${seed} from turn ${at} (${a.era}): loaded ${loaded ?? 'identical'}; sixty turns on, save code ${byCode ?? 'identical'}, clone ${byClone ?? 'identical'}`);
  }
}
done('DETERMINISM');
