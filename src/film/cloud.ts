import { circlePath, glow, ink, lerp, rgba, ss, type Ctx } from './draw';
import type { FilmDef } from './films';
import { hash, lattice, paintDark } from './holes';
import { landscape, layer, skyRatio } from './kit';
import { paintStar } from './paint';
import { ease, note, reel2, type Scene } from './reel';

// A cloud out of nothing (7 Nov; the player: "Big enough, it would collapse and light: a real light
// in the Dark, once, late, with its own film"). It plays before its card, "A Light in the Dark"
// (turnflow.ts). What happens, as the game has it (sim/fluctuations.ts): late in the Dark Era, by our
// own Boltzmann reckoning near 10^(10⁹⁹) years, a Sun's mass of cold hydrogen fluctuates into being;
// big enough to fall in on itself (its own Jeans mass), it collapses, spinning up and flattening as
// it falls; its core warms, and lights; it burns for some ten billion years (an instant of a turn
// that long), swells into a red giant, sheds its envelope and leaves a white dwarf, which cools and
// goes out. Where the film bends it: the collapse takes some ten million years and the life ten
// billion, shown in moments; the gas is drawn by a faint false colour (it is far too cold to see);
// its specks out of the noise stand for a fluctuation, which has no shape we could watch.

const INK = '#e6dccb';
const ACC = '#ffd98f';
const TEAL = '#7fd8ff';
const COLD = '#7d8fc2';

export const CLOUD_FILM: FilmDef = reel2({ id: 'cloud', name: 'A Light in the Dark', bpm: 84, beats: 48, accent: ACC }, (w, h, S, k, args) => {
  const pr = args.pr ?? 1;
  const land = landscape(w, h);
  const M = 1.3;
  const spx = (x: number) => Math.round(x * skyRatio(w, h, M, pr));
  const scale = Math.max(1, (S / 900) * pr);
  const area = (w * h) / (1600 * 900);
  const thin = Math.max(1, S * 0.0014);
  const sky = paintDark(spx(w * M), spx(h * M), { seed: 1501, n: Math.round(70 * k * area) + 16, haze: 0, scale });
  const RS = S * 0.06;
  const sun = paintStar(Math.round(RS * 2 * pr), { T: 5800, seed: 1502, limb: [0.45, 0.2], cells: 22, grain: 0.22, spots: 2, spotSize: 0.05 });
  const giant = paintStar(Math.round(RS * 2 * pr), { T: 3500, seed: 1503, limb: [0.6, 0.3], cells: 9, grain: 0.35 });
  const cx = w * 0.5;
  const cy = h * (land ? 0.42 : 0.4);
  // our settlement, a lattice of fields, low in the frame
  const ux = land ? w * 0.18 : w * 0.24;
  const uy = h * (land ? 0.78 : 0.8);
  const UR = S * 0.05;
  const N = Math.round(900 * k) + 240;

  /** A speck of the cloud: where noise first throws it, and where it settles in the cloud. */
  const speck = (j: number) => {
    const a = hash(1510, j) * Math.PI * 2;
    // (a cloud's mass is mostly near its middle: a rough Gaussian from three draws)
    const g = (hash(1511, j) + hash(1512, j) + hash(1513, j) - 1.5) * 0.9;
    return { x0: hash(1514, j) * w, y0: hash(1515, j) * h, r: Math.abs(g) * S * 0.36, a, z: hash(1516, j) };
  };
  const specks = Array.from({ length: N }, (_, j) => speck(j));

  /** Our lattice in the dark, lit by the new star while it shines (`lit` 0..1, `hue` its colour). */
  const us = (c: Ctx, t: number, alpha: number, lit = 0, hue = ACC) => {
    lattice(c, ux, uy, UR, t, S, { color: TEAL, node: '#dff6ff', alpha, incl: 0.3, seed: 1520, lines: 10 });
    if (lit > 0) {
      glow(c, ux, uy, UR * 2.2, hue, 0.35 * lit * alpha);
      // the Burst Catchers' rings, filling
      for (let i = 0; i < 2; i++) ink(c, circlePath(ux, uy, UR * (1.25 + i * 0.22), 72, 1521 + i, 0, Math.PI * 2, 0.42), lit, { width: thin * 1.4, color: hue, seed: 1521 + i, alpha: 0.8 * lit * alpha });
    }
  };

  const dark: Scene = {
    from: 0,
    to: 8.5,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.06 - 0.04 * m.p, 0.55);
      us(c, m.t, 0.7 * ss(0.5, 3, m.b));
    },
    notes(m) {
      return [note('cl-dark', 'THE DARK ERA · NOTHING WARMER THAN THE SKY', 0.5, land ? 0.12 : 0.1, ss(1.5, 3, m.b) * (1 - ss(7, 8.5, m.b)), { align: 'c', tone: 'dim' })];
    },
  };

  const outOfNothing: Scene = {
    from: 7.5,
    to: 16.5,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.02, 0.45);
      us(c, m.t, 0.55);
      // the noise: specks flickering everywhere, then fewer, gathering into one cloud
      const gather = ease(ss(9, 16, m.b));
      const flick = Math.floor(m.t * 9);
      c.save();
      c.globalCompositeOperation = 'lighter';
      const sz = Math.max(1, S * 0.0019);
      for (let j = 0; j < N; j++) {
        const p = specks[j];
        const tx = cx + Math.cos(p.a) * p.r;
        const ty = cy + Math.sin(p.a) * p.r * 0.8;
        const x = lerp(p.x0, tx, gather);
        const y = lerp(p.y0, ty, gather);
        // (out of the noise: at first each speck is there only now and then)
        const on = gather > 0.6 ? 1 : hash(1517 + flick, j) < 0.25 + gather ? 1 : 0;
        if (!on) continue;
        c.fillStyle = rgba(COLD, (0.25 + 0.45 * p.z) * ss(7.5, 9.5, m.b));
        c.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      }
      glow(c, cx, cy, S * 0.3, COLD, 0.18 * gather);
      c.restore();
    },
    notes(m) {
      return [
        note('cl-mass', 'A SUN’S MASS OF COLD HYDROGEN', land ? 0.66 : 0.5, land ? 0.2 : 0.14, ss(11, 12.5, m.b) * (1 - ss(15.5, 16.5, m.b)), { align: land ? 'l' : 'c', tone: 'accent' }),
        note('cl-once', 'OUT OF NOTHING · ONCE IN SOME 10^(10⁹⁹) YEARS', land ? 0.66 : 0.5, land ? 0.25 : 0.18, ss(12, 13.5, m.b) * (1 - ss(15.5, 16.5, m.b)), { align: land ? 'l' : 'c', tone: 'dim' }),
      ];
    },
  };

  const collapse: Scene = {
    from: 15.5,
    to: 24.5,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.02, 0.4);
      us(c, m.t, 0.5);
      // it falls in: smaller, flatter, spinning faster as it shrinks (its spin kept: Ω ∝ 1/r²)
      const fall = ease(ss(16, 23.5, m.b));
      const shrink = 1 - 0.86 * fall;
      const flat = lerp(0.8, 0.22, fall);
      c.save();
      c.globalCompositeOperation = 'lighter';
      const sz = Math.max(1, S * 0.0019);
      for (let j = 0; j < N; j++) {
        const p = specks[j];
        const r = p.r * shrink * (0.4 + 0.6 * Math.sqrt(p.z));
        const spin = (m.t - 11) * (0.15 + 0.9 * fall) / Math.max(0.15, shrink);
        const a = p.a + spin * (0.6 + 0.8 * (1 - p.z));
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r * flat;
        const warm = ss(0.1, 0.5, fall) * (1 - Math.min(1, r / (S * 0.12)));
        c.fillStyle = rgba(warm > 0.2 ? '#ff9a5c' : COLD, 0.25 + 0.5 * p.z);
        c.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      }
      // the core warming: deep red, then orange
      const core = ss(18, 24, m.b);
      glow(c, cx, cy, S * (0.04 + 0.05 * core), core > 0.6 ? '#ffb070' : '#ff5a2a', 0.25 + 0.6 * core);
      c.restore();
    },
    notes(m) {
      return [
        note('cl-falls', 'BIG ENOUGH TO FALL IN ON ITSELF', 0.5, land ? 0.14 : 0.12, ss(16.5, 18, m.b) * (1 - ss(21, 22.5, m.b)), { align: 'c', tone: 'ink' }),
        note('cl-proto', 'A PROTOSTAR · ITS CORE WARMING', 0.5, land ? 0.66 : 0.62, ss(20, 21.5, m.b) * (1 - ss(23.5, 24.5, m.b)), { align: 'c', tone: 'accent' }),
      ];
    },
  };

  const ignition: Scene = {
    from: 24,
    to: 31.5,
    enter: 'cut',
    assets: [sky, sun],
    draw(c, m) {
      const flash = 1 - ss(24, 26, m.b);
      layer(c, sky.get(), w, h, M, 0, 0, 1.02, 0.4 + 0.3 * flash);
      const lit = ss(24, 25.5, m.b);
      // the light floods out
      glow(c, cx, cy, S * (0.5 + 0.6 * flash), '#fff2d6', 0.55 * flash + 0.25);
      glow(c, cx, cy, RS * 4, ACC, 0.5);
      c.drawImage(sun.get(), cx - RS, cy - RS, RS * 2, RS * 2);
      // rays reaching us
      c.save();
      c.globalCompositeOperation = 'lighter';
      const dx = ux - cx;
      const dy = uy - cy;
      for (let i = 0; i < 5; i++) {
        const u = ((m.t * 0.5 + i / 5) % 1 + 1) % 1;
        glow(c, cx + dx * u, cy + dy * u, S * 0.006, ACC, 0.6 * lit * Math.sin(Math.PI * u));
      }
      c.restore();
      us(c, m.t, 0.75, lit);
    },
    notes(m) {
      return [
        note('cl-lit', 'IGNITION · HYDROGEN INTO HELIUM', land ? 0.62 : 0.5, land ? 0.36 : 0.22, ss(25, 26.5, m.b) * (1 - ss(30.5, 31.5, m.b)), { align: land ? 'l' : 'c', tone: 'accent' }),
        note('cl-first', 'THE FIRST STAR IN SOME 10^(10⁹⁹) YEARS · AND THE LAST', land ? 0.62 : 0.5, land ? 0.41 : 0.26, ss(26, 27.5, m.b) * (1 - ss(30.5, 31.5, m.b)), { align: land ? 'l' : 'c', tone: 'ink' }),
        note('cl-ours', 'OUR BURST CATCHERS FILLING', ux / w, (uy - UR * 1.9) / h, ss(26.5, 28, m.b) * (1 - ss(30.5, 31.5, m.b)), { align: 'c', tone: 'dim' }),
      ];
    },
  };

  // its life at speed: the main sequence, a red giant, the shell it sheds, a white dwarf
  const LIFE0 = 31;
  const LIFE1 = 38.5;
  const life: Scene = {
    from: LIFE0,
    to: LIFE1 + 0.5,
    assets: [sky, sun, giant],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.02, 0.4);
      const u = ss(LIFE0, LIFE1, m.b);
      const ms = 1 - ss(0.45, 0.6, u);
      const rg = ss(0.45, 0.6, u) * (1 - ss(0.72, 0.8, u));
      const wd = ss(0.76, 0.84, u);
      // on the main sequence, brightening a little
      if (ms > 0) {
        glow(c, cx, cy, RS * (4 + 0.6 * u), ACC, 0.5 * ms);
        c.globalAlpha = ms;
        c.drawImage(sun.get(), cx - RS, cy - RS, RS * 2, RS * 2);
        c.globalAlpha = 1;
      }
      // a red giant, swelling
      if (rg > 0) {
        const R = RS * (1 + 2.6 * ss(0.45, 0.7, u));
        glow(c, cx, cy, R * 2.4, '#ff8a4a', 0.45 * rg);
        c.globalAlpha = rg;
        c.drawImage(giant.get(), cx - R, cy - R, R * 2, R * 2);
        c.globalAlpha = 1;
      }
      // the shell it sheds, and the white dwarf at its heart
      if (wd > 0) {
        const shell = ss(0.74, 1, u);
        ink(c, circlePath(cx, cy, RS * (2.4 + 3 * shell), 120, 1530), 1, { width: thin * 2, color: '#a8d8ff', seed: 1530, alpha: 0.55 * wd * (1 - shell * 0.7) });
        glow(c, cx, cy, RS * (2.2 + 3 * shell), '#7fc4ff', 0.12 * wd * (1 - shell));
        glow(c, cx, cy, S * 0.012, '#eef4ff', 0.95 * wd);
      }
      us(c, m.t, 0.75, ms * 0.8 + rg * 0.6, rg > ms ? '#ff9a5c' : ACC);
      // its life along the bottom: ten billion years, an instant of the turn
      const y = h * (land ? 0.17 : 0.15);
      const x0 = w * 0.18;
      const x1 = w * 0.82;
      ink(c, [[x0, y], [x1, y]], ss(LIFE0, LIFE0 + 1, m.b), { width: thin, color: INK, seed: 1531, alpha: 0.5 });
      glow(c, lerp(x0, x1, u), y, S * 0.006, ACC, 0.9);
    },
    notes(m) {
      const u = ss(LIFE0, LIFE1, m.b);
      const y = land ? 0.13 : 0.115;
      return [
        note('cl-ms', 'MAIN SEQUENCE', 0.2, y, ss(LIFE0 + 0.5, LIFE0 + 1.5, m.b) * (1 - ss(LIFE1, LIFE1 + 0.5, m.b)), { tone: u < 0.5 ? 'accent' : 'dim' }),
        note('cl-rg', 'RED GIANT', 0.52, y, ss(LIFE0 + 3, LIFE0 + 4, m.b) * (1 - ss(LIFE1, LIFE1 + 0.5, m.b)), { align: 'c', tone: u >= 0.45 && u < 0.78 ? 'accent' : 'dim' }),
        note('cl-wd', 'WHITE DWARF', 0.8, y, ss(LIFE0 + 5, LIFE0 + 6, m.b) * (1 - ss(LIFE1, LIFE1 + 0.5, m.b)), { align: 'r', tone: u >= 0.78 ? 'accent' : 'dim' }),
        note('cl-span', '10¹⁰ YEARS · AN INSTANT OF THIS TURN', 0.5, land ? 0.215 : 0.19, ss(LIFE0 + 1, LIFE0 + 2, m.b) * (1 - ss(LIFE1, LIFE1 + 0.5, m.b)), { align: 'c', tone: 'dim' }),
      ];
    },
  };

  const out: Scene = {
    from: LIFE1,
    to: 42,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.02, 0.5);
      const fade = 1 - ss(LIFE1, 41, m.b);
      glow(c, cx, cy, S * 0.012, '#eef4ff', 0.95 * fade);
      glow(c, cx, cy, S * 0.03, '#ffb070', 0.4 * fade * fade);
      us(c, m.t, 0.7);
    },
  };

  return {
    numeral: 'IV',
    title: 'A Light in the Dark',
    sub: 'Once, late',
    titleAt: 42,
    eta: [args.eta ?? Math.pow(10, 99.4), (args.eta ?? Math.pow(10, 99.4)) * 1.0001],
    narration: [
      { from: 1, to: 7.5, text: 'Given long enough, anything that can happen does.' },
      { from: 9, to: 15.5, text: 'A cloud: a Sun’s mass of cold hydrogen, out of nothing.' },
      { from: 17, to: 23.5, text: 'It was big enough to fall in on itself.' },
      { from: 25, to: 31, text: 'It lit: a star, the first in some 10^(10⁹⁹) years, and the last there will be.' },
      { from: 32, to: 38, text: 'It burned for some ten billion years, an instant of this turn,' },
      { from: 38.6, to: 41.6, text: 'and went out.' },
    ],
    scenes: [dark, outOfNothing, collapse, ignition, life, out],
    card(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1 + 0.04 * m.p, 0.45);
    },
  };
});
