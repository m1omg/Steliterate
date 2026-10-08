// Cast-out embers dim over a decade of η after they leave, then turn black.
import { DWARF_COLD_AT, emberShare, primaryTemperature, sourceLight } from '../../../src/game/physics';
import { newGame } from '../../../src/game/newGame';
import { autoPlay } from '../../../src/game/auto';
import { endTurn } from '../../../src/game/sim/turn';
import { check, done, near } from '../lib';
const p = { kind: 'white_dwarf', halo: true, mass: 0.6, haloLeft: 1e19 } as any;
near('share as it leaves', emberShare(p, 1e19), 1);
near('share half a decade on', emberShare(p, Math.pow(10, 19.5)), 0.5);
near('share a decade on', emberShare(p, 1e20), 0);
near('T half a decade on', primaryTemperature(p, Math.pow(10, 19.5), 'degenerate'), 63 * Math.pow(0.5, 0.25));
const st = { era: 'degenerate', gfe: 1, years: 1e20 } as any;
near('light half a decade on: half the ember’s', sourceLight(st, { primary: p } as any, Math.pow(10, 19.5), 0).light, 0.525);
near('light a decade on: nothing (no floor)', sourceLight(st, { primary: p } as any, 1e20, 0).light, 0);
const late = { kind: 'white_dwarf', halo: true, mass: 0.6, haloLeft: Math.pow(10, 23) } as any;
near('cast out in the halo fade (η 23.5): both fades', emberShare(late, Math.pow(10, 23.5)), 0.5 * 0.5);
console.log('label:', sourceLight(st, { primary: p } as any, Math.pow(10, 19.5), 0).label);
// a real game: every ejected ember dims, and none is a white dwarf a decade after it left
let ejected = 0, turned = 0;
for (const seed of [1000, 8919, 16838]) {
  const s = newGame({ seed, length: 'standard', survivors: 3, difficulty: 'standard' });
  let guard = 0;
  while (!s.outcome && guard++ < 700 && s.eta < 22.5) {
    autoPlay(s, 'competent');
    endTurn(s);
    for (const x of Object.values(s.systems)) {
      const q = x.primary;
      if (!x.ejected || !q.halo || x.gone) continue;
      if (q.haloLeft === undefined && q.kind === 'white_dwarf') check(false, `${x.name} ejected with no haloLeft`);
      // a decade after leaving its warmth is gone; it is called black from η 16.7 (before that, an unwarmed white dwarf)
      if (q.haloLeft !== undefined && s.years >= q.haloLeft * 10 && q.kind === 'white_dwarf' && (s.years >= DWARF_COLD_AT || emberShare(q, s.years) > 0)) check(false, `${x.name} still warm, or still white after η 16.7, a decade after leaving`);
    }
  }
  const ej = Object.values(s.systems).filter((x) => x.ejected && x.primary.halo && x.primary.haloLeft !== undefined);
  ejected += ej.length;
  turned += ej.filter((x) => x.primary.kind === 'black_dwarf').length;
  console.log(`  seed ${seed}: η ${s.eta.toFixed(2)}, ${ej.length} embers cast out, ${ej.filter((x) => x.primary.kind === 'black_dwarf').length} gone black; still white: ${ej.filter((x) => x.primary.kind === 'white_dwarf').map((x) => `${x.name} ${emberShare(x.primary, s.years).toFixed(2)}`).join(', ')}`);
}
done('CASTOUT', `${ejected} cast-out embers, ${turned} gone black by η 22.5`);
