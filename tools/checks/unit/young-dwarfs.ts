// A few young, glowing dwarfs at the start (13 Oct, the player: "Make somewhat fresh/hot, hot enough
// to glow in the visible spectrum, white and brown dwarfs a little bit more common in the early
// game", and "I'm not asking you to change the cooling physics"):
// - about one dwarf in ten the galaxy begins with is a straggler of the last star formation
//   (YOUNG_SHARE): white ones 1 to 12 billion years old, glowing at 3,000 K and more; brown ones
//   0.4 to 2 billion, glowing at 800 K and more; the rest as old as ever;
// - by the same cooling laws (dwarfCoolingK, brownCoolingK), from when they formed;
// - an old white dwarf gives collectors 0.02 in the Dusk, as before; a young one more, by the law a
//   red dwarf's remnant follows (youngDwarfLight);
// - generation draws exactly as before: what it makes for these seeds is byte for byte what main's
//   made before the change (the fingerprints were taken from main at 75efadc), but for the worlds
//   black holes were given since 20 Oct and where a hole's worlds are drawn (unit/hole-worlds):
//   since then they leave those out, taken again on 7c0c763, whose galaxies are 75efadc's; and
//   since 26 Oct the names (distinctNames gives a later twin, two clusters drawn alike, a name of its
//   own, drawing nothing: unit/names), taken again on 7c0c763 without them.
import { generateWorld } from '../../../src/game/gen';
import { DEFAULT_SETTINGS, newGame } from '../../../src/game/newGame';
import { ERA_BY_ID } from '../../../src/game/eras';
import { brownCoolingK, dwarfCoolingK, formedAt, primaryTemperature, sourceLight, YOUNG_BROWN_AGES, YOUNG_SHARE, YOUNG_WHITE_AGES, youngDwarfLight } from '../../../src/game/physics';
import { check, done, near } from '../lib';

declare const process: { getBuiltinModule(id: string): unknown };
const crypto = process.getBuiltinModule('node:crypto') as { createHash(a: string): { update(s: string): void; digest(e: string): string } };

const START = ERA_BY_ID.dusk.startYears;

// generation, untouched
const MAIN: Record<number, string> = { 1000: 'fff24874d800e046', 8919: '17c599c3e97a682b', 16838: '0aa94c8c4e22c7e6', 24757: '7123fa9bad610654' };
for (const [seed, want] of Object.entries(MAIN)) {
  const s = generateWorld({ ...DEFAULT_SETTINGS, seed: Number(seed), survivors: 3 });
  const h = crypto.createHash('sha256');
  // (the worlds a hole was given since 20 Oct left out, and where a hole's worlds are drawn)
  const added = (id: string) => s.bodies[id].traits.includes('hole_world');
  for (const id of Object.keys(s.systems).sort()) {
    const y = s.systems[id];
    h.update(JSON.stringify([id, y.primary, y.pos, y.phys, y.bodies.filter((b) => !added(b)), y.special ?? null]));
  }
  for (const id of Object.keys(s.bodies).sort()) {
    if (added(id)) continue;
    const { name, ...b } = s.bodies[id];
    void name;
    h.update(JSON.stringify(s.systems[b.systemId]?.primary.kind === 'black_hole' ? { ...b, orbit: 0 } : b));
  }
  h.update(JSON.stringify([s.rng, s.fate ?? null, Object.keys(s.survivors), Object.keys(s.swarms)]));
  const got = h.digest('hex').slice(0, 16);
  check(got === want, `seed ${seed}: generation makes what it made before (${got})`);
}

// the share, the ages and the temperatures, over 30 galaxies
let white = 0;
let brown = 0;
let youngWhite = 0;
let youngBrown = 0;
let whiteOk = true;
let brownOk = true;
let oldLight = true;
let youngLight = true;
let coldWhite = Infinity;
let hotWhite = 0;
let coldBrown = Infinity;
let hotBrown = 0;
for (let g = 0; g < 30; g++) {
  const s = newGame({ seed: 1000 + g * 7919, survivors: 3 });
  for (const sys of Object.values(s.systems)) {
    const p = sys.primary;
    if (p.kind === 'white_dwarf' && p.whiteAt === undefined) {
      white++;
      const age = START - formedAt(p);
      const T = primaryTemperature(p, s.years, 'dusk');
      const light = sourceLight(s, sys, s.years, 40).light;
      if (age <= YOUNG_WHITE_AGES[1] * 1.0001) {
        youngWhite++;
        coldWhite = Math.min(coldWhite, T);
        hotWhite = Math.max(hotWhite, T);
        if (!(age >= YOUNG_WHITE_AGES[0] * 0.9999 && T >= 3000)) whiteOk = false;
        if (!(light > 0.02 && Math.abs(light - youngDwarfLight(s.years - formedAt(p), s.years - formedAt(p) + 40)) < 1e-12)) youngLight = false;
      } else if (light !== 0.02 && !p.halo) oldLight = false;
      if (Math.abs(T - primaryTemperature(p, s.years, 'dusk')) > 1e-9 || Math.abs(dwarfCoolingK(p, age) - dwarfCoolingK(p, START - formedAt(p))) > 1e-9) whiteOk = false;
    }
    if (p.kind === 'brown_dwarf') {
      brown++;
      const age = START - formedAt(p);
      if (age <= YOUNG_BROWN_AGES[1] * 1.0001) {
        youngBrown++;
        const T = brownCoolingK(p, age);
        coldBrown = Math.min(coldBrown, T);
        hotBrown = Math.max(hotBrown, T);
        if (!(age >= YOUNG_BROWN_AGES[0] * 0.9999 && T >= 800)) brownOk = false;
      }
    }
  }
}
const shareW = youngWhite / white;
const shareB = youngBrown / brown;
check(Math.abs(shareW - YOUNG_SHARE) < 0.04, `about one white dwarf in ten is young: ${youngWhite} of ${white} (${(100 * shareW).toFixed(1)}%)`);
check(Math.abs(shareB - YOUNG_SHARE) < 0.05, `about one brown dwarf in ten is young: ${youngBrown} of ${brown} (${(100 * shareB).toFixed(1)}%)`);
check(whiteOk, `every young white dwarf is 1 to 12 billion years old and glows: ${Math.round(coldWhite)} to ${Math.round(hotWhite)} K`);
check(brownOk, `every young brown dwarf is 0.4 to 2 billion years old and glows: ${Math.round(coldBrown)} to ${Math.round(hotBrown)} K`);
check(oldLight, 'an old white dwarf still gives collectors 0.02 in the Dusk, as before');
check(youngLight, 'a young one more, by the law a red dwarf’s remnant follows from its collapse');
// the laws themselves, unchanged (as the cooling check has them)
near('a 0.05 M☉ brown dwarf at 1 billion years is still Burrows’ 1,550 K', brownCoolingK({ kind: 'brown_dwarf', mass: 0.05, lum: 0, spin: 0, spinMax: 0 }, 1e9), 1550, 1e-12);
const wd = { kind: 'white_dwarf' as const, mass: 0.6, lum: 0, spin: 0, spinMax: 0 };
check(dwarfCoolingK(wd, 1e10) > 3000 && dwarfCoolingK(wd, 1e10) < 4500, `a white dwarf at 10 billion years is still Mestel’s ${Math.round(dwarfCoolingK(wd, 1e10))} K`);
done('YOUNG DWARFS');
