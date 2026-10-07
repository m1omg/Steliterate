// Check the white dwarf cooling figures, the embers, the Dusk, and the black-dwarf turn in a real game.
import { coldDwarfK, dwarfGlow, emberShare, DWARF_COLD_AT, sourceLight, primaryTemperature, primaryLuminosity } from '../../../src/game/physics';
import { newGame } from '../../../src/game/newGame';
import { autoPlay } from '../../../src/game/auto';
import { endTurn } from '../../../src/game/sim/turn';
import { check, done, near as nearBy } from '../lib';

const near = (what: string, got: number, want: number, tol = 1e-6) => nearBy(what, got, want, tol);
near('T at 1e14 (clamped)', coldDwarfK(1e14), 20);
near('T at 1e15', coldDwarfK(1e15), 20);
near('T at 1e16', coldDwarfK(1e16), 20 * Math.pow(10, -0.35));
near('cold at (years)', DWARF_COLD_AT, 1e15 * Math.pow(4, 1 / 0.35));
near('T at cold-at', coldDwarfK(DWARF_COLD_AT), 5);
near('T at 1e20', coldDwarfK(1e20), 5);
near('glow at 1e15', dwarfGlow(1e15), 1);
near('glow at 1e20', dwarfGlow(1e20), 0);
for (const gfe of [1, 0.4, 0]) {
  const gf = 0.35 + 0.65 * gfe;
  const st = { era: 'degenerate', gfe } as any;
  const wd = { primary: { kind: 'white_dwarf', halo: false, mass: 0.6 } } as any;
  near(`unwarmed light at 20 K, gfe ${gfe}`, sourceLight(st, wd, 1e15, 0).light, 0.05 * gf);
  near(`unwarmed light at 5 K, gfe ${gfe}`, sourceLight(st, wd, 1e18, 0).light, 0.01);
  const em = { primary: { kind: 'white_dwarf', halo: true, mass: 0.6 } } as any;
  for (const e of [15, 18, 21.9, 22.5, 23.5, 24.7, 24.99]) {
    const share = e < 22 ? 1 : (25 - e) / 3;
    near(`ember light at η ${e}, gfe ${gfe}`, sourceLight(st, em, Math.pow(10, e), 0).light, (0.05 + share) * gf);
  }
  near(`spent ember light at η 25.2`, sourceLight(st, em, Math.pow(10, 25.2), 0).light, 0.01);
}
const em = { kind: 'white_dwarf', halo: true, mass: 0.6 } as any;
near('ember T at η 20', primaryTemperature(em, 1e20, 'degenerate'), 63);
near('ember T at η 23.5 (half)', primaryTemperature(em, Math.pow(10, 23.5), 'degenerate'), 63 * Math.pow(0.5, 0.25));
near('ember T at η 24.7 (a tenth)', primaryTemperature(em, Math.pow(10, 24.7), 'degenerate'), 63 * Math.pow(0.1, 0.25));
near('spent ember T at η 25.1', primaryTemperature(em, Math.pow(10, 25.1), 'degenerate'), 5);
near('ember L at η 20', primaryLuminosity(em, 1e20, 'degenerate'), 4e-12);
near('ember L at η 23.5', primaryLuminosity(em, Math.pow(10, 23.5), 'degenerate'), 2e-12);
near('rekindled dwarf T', primaryTemperature({ kind: 'white_dwarf', halo: false, mass: 0.6, rekindle: 0.5 } as any, 1e17, 'degenerate'), 300);
const wd = { kind: 'white_dwarf', halo: false, mass: 0.6 } as any;
const r = 0.0125;
near('unwarmed L at 20 K', primaryLuminosity(wd, 1e15, 'degenerate'), Math.pow(20 / 5772, 4) * r * r);
near('unwarmed L at 5 K', primaryLuminosity(wd, 1e18, 'degenerate'), Math.pow(5 / 5772, 4) * r * r);
// the Dusk is untouched: same formula as before
for (const age of [0, 1e9, 1e12, 1e13]) {
  const p = { kind: 'white_dwarf', halo: true, mass: 0.6, whiteAt: 1e13 } as any;
  const L = 0.01 * Math.pow(1 + age / 1e8, -1.3);
  near(`Dusk T at age ${age}`, primaryTemperature(p, 1e13 + age, 'dusk'), 5772 * Math.pow(L / (r * r), 0.25));
}

// a real game: no unwarmed white dwarf after 5.2e16, embers stay white dwarfs to η 25, none after
let checked = 0;
for (const seed of [1000, 8919]) {
  const s = newGame({ seed, length: 'standard', survivors: 3, difficulty: 'standard' });
  let guard = 0;
  let sawCooling = false;
  let lastE = 0;
  while (!s.outcome && guard++ < 700 && s.eta < 26) {
    autoPlay(s, 'competent');
    endTurn(s);
    if (s.era !== 'degenerate') continue;
    const wds = Object.values(s.systems).filter((x) => !x.gone && x.primary.kind === 'white_dwarf');
    const unwarmed = wds.filter((x) => emberShare(x.primary, s.years) === 0);
    if (s.years < DWARF_COLD_AT && unwarmed.length && coldDwarfK(s.years) < 20 && coldDwarfK(s.years) > 5) sawCooling = true;
    if (s.years >= DWARF_COLD_AT && unwarmed.length) check(false, `seed ${seed} turn ${s.turn} η ${s.eta.toFixed(2)}: ${unwarmed.length} unwarmed white dwarfs left`);
    if (s.eta >= 25 && wds.length) check(false, `seed ${seed} η ${s.eta.toFixed(2)}: ${wds.length} white dwarfs left after the embers`);
    if (Math.floor(s.eta) !== lastE) {
      lastE = Math.floor(s.eta);
      const bl = Object.values(s.systems).filter((x) => !x.gone && x.primary.kind === 'black_dwarf').length;
      console.log(`  seed ${seed} turn ${s.turn} η ${s.eta.toFixed(2)}: ${wds.length} white dwarfs (${unwarmed.length} unwarmed, ${coldDwarfK(s.years).toFixed(1)} K), ${bl} black dwarfs`);
    }
    checked++;
  }
  console.log(`  seed ${seed}: ${s.outcome ? `ended (${s.outcome.kind ?? JSON.stringify(s.outcome).slice(0, 40)}) ` : ''}at η ${s.eta.toFixed(2)}, cooling seen: ${sawCooling}`);
}
done('COOL', `${checked} turns checked`);
