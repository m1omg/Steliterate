// SAVED (26 Oct, the player: "extend the last horizon cutscene with the Heart evaporating as the
// last BH while backing up this version"): the Last Horizon's film, second cut, as it was before the
// Heart's evaporation opened it (commit eb70648): 68 beats at 90, the title at 62, its first shot
// the last hole's last flash. Not imported, so not in the game. To bring it back: in films.ts import
// LAST_HORIZON_V1 from './saved/lasthorizon-v1' and set `last_horizon: LAST_HORIZON_V1`, and in
// cue.ts put back its cues:
//   SPECS.last_horizon: { bpm: 90, root: 30.87, cuts: [[0, 293.66], [8, 246.94], [15.5, 220], [23.5, 185], [33.5, 196], [43, 164.81], [52.5, 146.83]], titleAt: 62, chord: [61.74, 73.42, 92.5], pads: true }
//   FATE_SPECS['last_horizon:stable']: { bpm: 90, root: 30.87, cuts: [[0, 293.66], [6, 246.94], [12, 220], [20, 196], [26.5, 233.08], [34.5, 185], [40, 196], [46.5, 164.81], [53.5, 146.83]], titleAt: 62, chord: [61.74, 73.42, 92.5], pads: true }

import { pow10 } from '../../ui/fmt';
import { Stipple, circlePath, glow, ink, lerp, rgba, ss, type Ctx, type Pt } from '../draw';
import type { FilmDef } from '../films';
import { camera, landscape, layer, skyRatio } from '../kit';
import { Lazy, World, heatOf, paintStar, paintWorldMap } from '../paint';
import { ease, note, reel2, type Moment, type Scene } from '../reel';
import { ELECTRON, INK, TEAL_RGB, drawRing, figure, hash, lattice, noise1x, paintDark, plainHole, quanta, seen, wavy, type RingLook } from '../holes';


const VIOLET = '#a48dff';
const GREY = '#9aa3b0';
const GSOFT = '#c9ced6';
const TEAL = '#7fd8ff';

/** The Last Horizon, into the Dark Era: the last hole goes, and after it only what was saved. */
export const LAST_HORIZON_V1: FilmDef = reel2({ id: 'last_horizon', name: 'The Last Horizon', bpm: 90, beats: 68, accent: GREY }, (w, h, S, k, args) => {
  const stable = args.fate === 'stable';
  const pr = args.pr ?? 1;
  const land = landscape(w, h);
  const M = 1.3;
  const dpx = (x: number) => Math.round(x * pr);
  const spx = (x: number) => Math.round(x * skyRatio(w, h, M, pr));
  const scale = Math.max(1, (S / 900) * pr);
  const area = (w * h) / (1600 * 900);
  const thin = Math.max(1, S * 0.0014);
  // the dark: nothing but the far lights of what was saved
  const sky = paintDark(spx(w * M), spx(h * M), { seed: 701, n: Math.round(70 * k * area) + 14, haze: 0, scale });
  const cx = w * 0.5;
  const cy = h * 0.45;
  const deadMap = paintWorldMap(Math.round(320 * (0.6 + 0.4 * k)), {
    seed: 702,
    sea: 0,
    ice: 0.7,
    cloud: 0,
    palette: { deep: [0.1, 0.1, 0.11], shallow: [0.14, 0.14, 0.15], low: [0.2, 0.19, 0.21], high: [0.46, 0.44, 0.47], ice: [0.62, 0.64, 0.68], cloud: [0, 0, 0], air: [0, 0, 0], lights: [0, 0, 0] },
  });
  /** A body as cold as the sky: its heat no different from the dark's, the thermal palette all but black. */
  const coldWorld = new Lazy(function* () {
    const mp = deadMap.get();
    yield;
    return new World(dpx(S * 0.09 * 2), mp, { light: [-0.25, 0.3, 1], sun: [0.85, 0.82, 0.92], tilt: 0.3, air: [0, 0, 0], lights: [0, 0, 0], airThick: 0, heat: 0.45 });
  });
  const coldDwarf = new Lazy(function* () {
    const d = paintStar(dpx(S * 0.07 * 2), { T: 5200, seed: 703, limb: [0.55, 0.3], cells: 14, grain: 0.16 }).get();
    yield;
    return heatOf(d, 0.42);
  });
  const disc = (c: Ctx, img: HTMLCanvasElement, x: number, y: number, R: number) => c.drawImage(img, x - R, y - R, R * 2, R * 2);

  // ------------------------------------------------------------ the last hole, and its last flash
  const lastHole = (from: number, to: number): Scene => {
    const end = from + (to - from) * 0.7;
    const R0 = S * 0.07;
    const ring = (rs: number, fade: number): RingLook => ({ a: R0 * 3.3, incl: 0.2, n: Math.round(180 * k) + 50, speed: 0.07, color: TEAL_RGB, size: Math.max(1.6, S * 0.0028), thE: rs * 1.4, rsh: rs, band: 0.4 * fade, lights: fade, width: Math.max(1, S * 0.0017), seed: 710, pr });
    return {
      from,
      to,
      assets: [sky],
      draw(c, m) {
        layer(c, sky.get(), w, h, M, 0, 0, 1.05 + 0.03 * m.p, 0.6);
        const u = ss(from, end, m.b);
        const rs = R0 * lerp(1, 0.08, Math.pow(u, 2.4));
        const r = ring(rs, 1 - ss(end - 1.5, end, m.b) * 0.7);
        if (m.b < end) {
          drawRing(c, cx, cy, r, m.t, 'back');
          glow(c, cx, cy, rs * 5, u > 0.75 ? '#f4efff' : GSOFT, Math.min(0.9, 0.1 / Math.max(0.12, 1 - u)));
          plainHole(c, cx, cy, rs, S, { glow: 1 + 2 * u, color: GREY });
          drawRing(c, cx, cy, r, m.t, 'front');
          quanta(c, cx, cy, Math.max(rs, S * 0.008), m.t, S, { rate: 2 + 7 * u * u, seed: 711, reach: S * 0.18, color: GSOFT, alpha: 0.4 + 0.4 * u, lam: S * 0.03 });
        }
        const flash = ss(end - 0.1, end + 0.15, m.b) * (1 - ss(end + 0.15, end + 1.8, m.b));
        glow(c, cx, cy, S * 0.4, '#f4efff', 0.9 * flash);
        glow(c, cx, cy, S * 0.06, '#ffffff', flash);
        if (m.b >= end)
          for (let i = 0; i < 3; i++) {
            const ru = ss(end + i * 0.3, end + 3 + i * 0.3, m.b);
            ink(c, circlePath(cx, cy, S * (0.02 + 0.55 * ru), 140, 712 + i), 1, { width: Math.max(1, S * (0.0026 - i * 0.0006)), color: i ? GREY : '#f4efff', seed: 712 + i, alpha: 0.8 * (1 - ru) });
          }
      },
      notes(m) {
        return [
          note('lh-a', 'THE LAST BLACK HOLE', 0.5, (cy + R0 * 4.4) / h, ss(from + 0.6, from + 1.4, m.b) * (1 - ss(end - 0.4, end, m.b)), { tone: 'accent', align: 'c' }),
          note('lh-b', 'SMALLER, HOTTER, BRIGHTER', 0.5, (cy + R0 * 4.4 + S * 0.03) / h, ss(from + 2, from + 2.8, m.b) * (1 - ss(end - 0.4, end, m.b)), { tone: 'dim', align: 'c' }),
          note('lh-c', 'ITS LAST FLASH', 0.5, (cy + R0 * 4.4) / h, ss(end + 0.3, end + 1, m.b), { tone: 'accent', align: 'c' }),
        ];
      },
    };
  };

  // ------------------------------------------------------------ no sources: only what was saved
  const homes = Array.from({ length: 7 }, (_, i) => ({ x: lerp(0.12, 0.88, hash(720, i)) * w, y: lerp(0.18, 0.7, hash(721, i)) * h, r: S * lerp(0.025, 0.06, hash(722, i)), incl: lerp(0.15, 0.5, hash(723, i)) }));
  const noSources = (from: number, to: number): Scene => ({
    from,
    to,
    fade: 1.5,
    assets: [sky],
    draw(c, m) {
      const z = 1.08 - 0.08 * ease(m.p);
      layer(c, sky.get(), w, h, M, 0, 0, 1.08 * z, 0.7);
      camera(c, w / 2, h / 2, z, 0, 0, () => {
        homes.forEach((o, i) => lattice(c, o.x, o.y, o.r, m.t, S, { color: TEAL, node: '#dff6ff', alpha: 0.75 * ss(from + 0.4 + i * 0.4, from + 1.4 + i * 0.4, m.b), incl: o.incl, seed: 724 + i, lines: 6 }));
      });
      // the reserve: what there is, and nothing coming in
      const o = ss(from + 2, from + 3, m.b);
      const bx = land ? w * 0.72 : w * 0.2;
      const by = land ? h * 0.8 : h * 0.8;
      const bw = land ? w * 0.18 : w * 0.6;
      ink(c, [[bx, by], [bx + bw, by]], o, { width: Math.max(1, S * 0.004), color: GREY, seed: 730, alpha: 0.35 });
      ink(c, [[bx, by], [bx + bw * (0.8 - 0.05 * m.p), by]], o, { width: Math.max(1, S * 0.004), color: TEAL, seed: 731, alpha: 0.85 });
    },
    notes(m) {
      const o = ss(from + 2, from + 3, m.b);
      const bx = land ? w * 0.72 : w * 0.2;
      const by = land ? h * 0.8 : h * 0.8;
      return [
        note('lh-d', 'NO STAR, NO HOLE, NOTHING TO GATHER', 0.5, land ? 0.12 : 0.1, ss(from + 0.8, from + 1.6, m.b), { tone: 'dim', align: 'c' }),
        note('lh-e', 'OUR SETTLEMENTS · FIELDS, NOT MATTER', 0.5, (land ? 0.12 : 0.1) + (S * 0.03) / h, ss(from + 1.4, from + 2.2, m.b), { tone: 'accent', align: 'c' }),
        note('lh-f', 'THE RESERVE · NOTHING COMES IN', bx / w, (by - S * 0.03) / h, o, { tone: 'ink' }),
      ];
    },
  });

  // ------------------------------------------------------------ a photon of the last flash, stretched
  const photons = (from: number, to: number): Scene => {
    const gx = land ? w * 0.22 : w * 0.3;
    const gy = h * 0.3;
    return {
      from,
      to,
      fade: 1.5,
      assets: [sky],
      draw(c, m) {
        layer(c, sky.get(), w, h, M, 0, 0, 1.1, 0.4);
        // a galaxy as it once was, for scale (an elliptical, as ours became): about 100,000 light-years
        const G = S * 0.07;
        const o = ss(from + 0.4, from + 1.4, m.b);
        c.save();
        c.globalAlpha = 0.6 * o;
        const g = c.createRadialGradient(gx, gy, 0, gx, gy, G);
        g.addColorStop(0, 'rgba(230,226,240,0.9)');
        g.addColorStop(0.3, 'rgba(201,206,214,0.35)');
        g.addColorStop(1, 'rgba(201,206,214,0)');
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(gx, gy, G, G * 0.72, 0.3, 0, Math.PI * 2);
        c.fill();
        c.restore();
        ink(c, [[gx - G, gy + G * 1.2], [gx + G, gy + G * 1.2]], o, { width: thin, color: GSOFT, seed: 740, alpha: 0.6 });
        // the wave: its crests drawing apart as space grows, a little more each beat (λ ∝ the scale of the universe)
        const grow = Math.exp(ss(from + 1, to - 0.5, m.b) * 3.2);
        const lam = S * 0.05 * grow;
        const y0 = h * 0.56;
        const pts: Pt[] = [];
        const shift = m.t * S * 0.08;
        for (let x = -S * 0.1; x <= w + S * 0.1; x += Math.max(2, w / 400)) pts.push([x, y0 + Math.sin(((x - shift) / lam) * Math.PI * 2) * S * 0.035]);
        ink(c, pts, ss(from + 0.6, from + 2, m.b), { width: Math.max(1, S * 0.0022), color: '#f4efff', seed: 741, alpha: 0.85 });
        // one crest to the next, measured
        const crest = (x: number) => Math.round((x - shift) / lam - 0.25) * lam + shift + lam * 0.25;
        const c1 = crest(w * 0.3);
        ink(c, [[c1, y0 - S * 0.07], [c1 + lam, y0 - S * 0.07]], ss(from + 2, from + 3, m.b), { width: thin, color: GREY, seed: 742, alpha: 0.7 });
      },
      notes(m) {
        const G = S * 0.07;
        return [
          note('lh-g', 'A GALAXY, ONCE · ~100,000 LIGHT-YEARS', gx / w, (gy + G * 1.2 + S * 0.03) / h, ss(from + 0.8, from + 1.6, m.b), { tone: 'dim', align: 'c' }),
          note('lh-h', 'A PHOTON OF THE LAST FLASH · STRETCHED AS SPACE GROWS', 0.5, (h * 0.56 + S * 0.08) / h, ss(from + 1.6, from + 2.4, m.b), { tone: 'accent', align: 'c' }),
          note('lh-i', 'ONE CREST TO THE NEXT', 0.5, (h * 0.56 - S * 0.1) / h, ss(from + 2.4, from + 3.2, m.b), { tone: 'ink', align: 'c' }),
        ];
      },
    };
  };

  // ------------------------------------------------------------ positronium, wider than the old observable universe
  const positronium = (from: number, to: number): Scene => {
    const A = S * (land ? 0.36 : 0.4);
    return {
      from,
      to,
      fade: 1.6,
      assets: [sky],
      draw(c, m) {
        layer(c, sky.get(), w, h, M, 0, 0, 1.1 + 0.03 * m.p, 0.45);
        const o = ss(from + 0.4, from + 1.8, m.b);
        // the orbit: vast, faint, slowly shrinking as the pair spirals in
        const shrink = 1 - 0.08 * ease(m.p);
        for (let i = 0; i < 5; i++) {
          const r = A * shrink * (1 - i * 0.12);
          ink(c, circlePath(cx, cy, r, 160, 750 + i, 0, Math.PI * 2, 0.42), o, { width: thin, color: i ? GREY : GSOFT, seed: 750 + i, alpha: (i ? 0.22 : 0.5) * o });
        }
        const ang = m.t * 0.05 + 0.6;
        const ex = cx + Math.cos(ang) * A * shrink;
        const ey = cy + Math.sin(ang) * A * shrink * 0.42;
        const px = cx - Math.cos(ang) * A * shrink;
        const py = cy - Math.sin(ang) * A * shrink * 0.42;
        glow(c, ex, ey, S * 0.016, ELECTRON, 0.95 * o);
        glow(c, px, py, S * 0.016, VIOLET, 0.95 * o);
        // the old observable universe, for scale: a dot in the middle of it
        const ou = ss(from + 3, from + 4, m.b);
        ink(c, circlePath(cx, cy, S * 0.012, 40, 756), ou, { width: thin, color: GSOFT, seed: 756, alpha: 0.8 });
        // now and then it gives off the faintest light, longer still
        const g = (((m.t * 0.18) % 1) + 1) % 1;
        if (g < 0.5) ink(c, wavy([ex, ey], [ex + S * 0.25 * g * 2, ey - S * 0.12 * g * 2], 2, S * 0.008, 1, m.t), 1, { width: thin, color: GSOFT, seed: 757, alpha: 0.5 * (1 - g * 2) * o });
      },
      notes(m) {
        const ang = m.t * 0.05 + 0.6;
        const shrink = 1 - 0.08 * ease(m.p);
        const ex = cx + Math.cos(ang) * A * shrink;
        const ey = cy + Math.sin(ang) * A * shrink * 0.42;
        const px = cx - Math.cos(ang) * A * shrink;
        const py = cy - Math.sin(ang) * A * shrink * 0.42;
        return [
          note('lh-j', 'e⁻', (ex + S * 0.02) / w, (ey - S * 0.02) / h, ss(from + 1, from + 1.8, m.b), { tone: 'ink' }),
          note('lh-k', 'e⁺', (px + S * 0.02) / w, (py - S * 0.02) / h, ss(from + 1.2, from + 2, m.b), { tone: 'accent' }),
          note('lh-l', 'POSITRONIUM · ONE ATOM', 0.5, land ? 0.14 : 0.12, ss(from + 1.6, from + 2.4, m.b), { tone: 'accent', align: 'c' }),
          note('lh-m', 'THE OLD OBSERVABLE UNIVERSE, FOR SCALE', 0.5, (cy + S * 0.04) / h, ss(from + 3.4, from + 4.2, m.b), { tone: 'dim', align: 'c' }),
          note('lh-n', 'SPIRALLING IN · ALL GONE BY ABOUT η 141', 0.5, (land ? 0.14 : 0.12) + (S * 0.03) / h, ss(from + 5, from + 5.8, m.b), { tone: 'dim', align: 'c' }),
        ];
      },
    };
  };

  // ------------------------------------------------------------ a reserve that will never refill
  const reserve = (from: number, to: number): Scene => {
    const R = S * (land ? 0.17 : 0.2);
    return {
      from,
      to,
      fade: 1.5,
      assets: [sky],
      draw(c, m) {
        layer(c, sky.get(), w, h, M, 0, 0, 1.1, 0.5);
        lattice(c, cx, cy, R, m.t, S, { color: TEAL, node: '#dff6ff', alpha: 0.85, incl: 0.32, seed: 760, lines: 10 });
        // its store: a ring of current round it, dimming with each thought
        const left = 1 - 0.55 * ss(from + 1, to, m.b);
        const pulses = Math.floor((m.b - from) / 1.2);
        const since = (m.b - from) % 1.2;
        const flash = Math.max(0, 1 - since / 0.4) * (pulses > 0 ? 1 : 0);
        const pts: [number, number, number][] = Array.from({ length: 97 }, (_, i) => {
          const ph = (i / 96) * Math.PI * 2;
          return seen(R * 1.35 * Math.cos(ph), -R * 0.55, R * 1.35 * Math.sin(ph), 0.32);
        });
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = rgba(TEAL, 0.25 + 0.6 * left);
        c.lineWidth = Math.max(1, S * 0.004 * left + S * 0.001);
        c.beginPath();
        pts.forEach(([x, y], i) => (i ? c.lineTo(cx + x, cy + y) : c.moveTo(cx + x, cy + y)));
        c.stroke();
        c.restore();
        glow(c, cx, cy, R * 1.2, '#dff6ff', 0.35 * flash);
        // the gauge
        const gx0 = land ? w * 0.7 : w * 0.2;
        const gy = h * 0.78;
        const gw = land ? w * 0.18 : w * 0.6;
        ink(c, [[gx0, gy], [gx0 + gw, gy]], 1, { width: Math.max(1, S * 0.004), color: GREY, seed: 761, alpha: 0.35 });
        ink(c, [[gx0, gy], [gx0 + gw * left * 0.9, gy]], 1, { width: Math.max(1, S * 0.004), color: TEAL, seed: 762, alpha: 0.85 });
      },
      notes(m) {
        const gx0 = land ? w * 0.7 : w * 0.2;
        const gy = h * 0.78;
        return [
          note('lh-o', 'FIELD STORES · ENERGY IN CURRENTS OF ELECTRONS AND POSITRONS', 0.5, (cy - R * 1.6) / h, ss(from + 0.8, from + 1.6, m.b), { tone: 'accent', align: 'c' }),
          note('lh-p', 'EACH THOUGHT DRAWS ON IT', gx0 / w, (gy - S * 0.03) / h, ss(from + 1.6, from + 2.4, m.b), { tone: 'ink' }),
        ];
      },
    };
  };

  // ------------------------------------------------------------ time in powers of powers
  const powers = (from: number, to: number): Scene => {
    const y = h * 0.5;
    const x0 = w * 0.1;
    const x1 = w * 0.9;
    // a ruler of η itself (log₁₀ of the years) that keeps being rescaled: 10² across, then 10³, …
    return {
      from,
      to,
      fade: 1.5,
      assets: [sky],
      draw(c, m) {
        layer(c, sky.get(), w, h, M, 0, 0, 1.1, 0.35);
        const o = ss(from + 0.4, from + 1.4, m.b);
        const u = ss(from + 1, to - 0.5, m.b);
        // the ruler spans η from 10² to 10^top, top growing: each tick a power of ten of η
        const top = lerp(2.2, 7, ease(u));
        const X = (lgEta: number) => x0 + ((lgEta - 2) / (top - 2)) * (x1 - x0);
        ink(c, [[x0, y], [x1, y]], o, { width: Math.max(1, S * 0.0018), color: INK, seed: 770, alpha: 0.55 });
        for (let e = 2; e <= Math.floor(top); e++) {
          const x = X(e);
          if (x > x1 + 1) continue;
          ink(c, [[x, y - S * 0.012], [x, y + S * 0.012]], o, { width: thin, color: INK, seed: 771 + e, alpha: 0.6 });
          figure(c, pow10(e), x, y + S * 0.04, S, o * (1 - ss(x1 - S * 0.02, x1 + S * 0.02, x)));
        }
        // our turns: each a step that the ruler keeps shrinking
        for (let i = 0; i < 40; i++) {
          const lg = 2 + i * 0.12 * (1 + i * 0.08);
          if (lg > top) break;
          glow(c, X(lg), y - S * 0.03, S * 0.006, TEAL, 0.8 * o);
        }
        const now = X(top - 0.05);
        glow(c, now, y, S * 0.014, '#f4efff', 0.9 * o);
      },
      notes(m) {
        const o = ss(from + 0.4, from + 1.4, m.b);
        return [
          note('lh-q', 'YEARS · 10 TO THE η', 0.5, (y - S * 0.12) / h, o, { tone: 'dim', align: 'c' }),
          note('lh-r', 'AND η ITSELF · 10², 10³, 10⁴ …', 0.5, (y - S * 0.09) / h, ss(from + 1.6, from + 2.4, m.b), { tone: 'accent', align: 'c' }),
          note('lh-s', 'OUR TURNS', x0 / w, (y - S * 0.06) / h, ss(from + 2.4, from + 3.2, m.b), { tone: 'ink' }),
        ];
      },
    };
  };

  // ------------------------------------------------------------ what was saved, small in the dark
  const drift = (from: number, to: number, words: string): Scene => ({
    from,
    to,
    fade: 1.6,
    assets: [sky],
    draw(c, m) {
      const z = 1.25 - 0.55 * ease(m.p);
      layer(c, sky.get(), w, h, M, 0, 0, 1.0 + 0.1 * z, 0.6);
      lattice(c, cx, cy, S * 0.12 * z, m.t, S, { color: TEAL, node: '#dff6ff', alpha: 0.9, incl: 0.3, seed: 780, lines: 10 });
    },
    notes(m) {
      return [note('lh-t', words, 0.5, land ? 0.16 : 0.12, ss(from + 1.4, from + 2.2, m.b) * (1 - ss(to - 1.4, to - 0.6, m.b)), { tone: 'accent', align: 'c' })];
    },
  });

  // ------------------------------------------------------------ matter stable: as cold as the sky
  const coldMatter = (from: number, to: number): Scene => {
    const slots: Pt[] = land ? [0.3, 0.5, 0.7].map((x) => [w * x, h * 0.44] as const) : [0.3, 0.48, 0.66].map((y) => [w * 0.5, h * y] as const);
    return {
      from,
      to,
      fade: 1.5,
      assets: [sky, coldWorld, coldDwarf],
      draw(c, m) {
        layer(c, sky.get(), w, h, M, 0, 0, 1.1, 0.5);
        slots.forEach(([x, y], i) => {
          const on = ss(from + 0.4 + i * 0.5, from + 1.4 + i * 0.5, m.b);
          c.save();
          c.globalAlpha = on;
          if (i === 1) disc(c, coldDwarf.get(), x, y, S * 0.05);
          else disc(c, coldWorld.get().paint(m.t * 0.05 + i), x, y, S * (i ? 0.07 : 0.06));
          c.restore();
          ink(c, circlePath(x, y, S * (i === 1 ? 0.058 : i ? 0.078 : 0.068), 80, 790 + i), on, { width: thin, color: GREY, seed: 790 + i, alpha: 0.35 });
        });
      },
      notes(m) {
        return [
          note('st-a', 'DEAD STARS AND WORLDS · STILL HERE', 0.5, land ? 0.18 : 0.14, ss(from + 1, from + 1.8, m.b), { tone: 'accent', align: 'c' }),
          note('st-b', 'AS COLD AS THE SKY · 2 × 10⁻³⁰ K', 0.5, land ? 0.7 : 0.8, ss(from + 2, from + 2.8, m.b), { tone: 'ink', align: 'c' }),
          note('st-c', 'SEEN BY THEIR HEAT · THERE IS ALMOST NONE', 0.5, (land ? 0.7 : 0.8) + (S * 0.03) / h, ss(from + 2.6, from + 3.4, m.b), { tone: 'dim', align: 'c' }),
        ];
      },
    };
  };

  /** Nuclei settling, a few at a time, into iron: light ones fusing, heavy ones splitting, by tunnelling. */
  const ironTunnel = (from: number, to: number): Scene => {
    const N = 7;
    const cell = S * 0.06;
    const ox = cx - ((N - 1) * cell) / 2;
    const oy = cy - ((N - 1) * cell * 0.6) / 2;
    const sites = Array.from({ length: N * N }, (_, i) => ({ i, x: ox + (i % N) * cell + (Math.floor(i / N) % 2) * cell * 0.5, y: oy + Math.floor(i / N) * cell * 0.6, at: from + 1 + hash(800, i) * (to - from - 2.5), light: hash(801, i) < 0.6 }));
    return {
      from,
      to,
      fade: 1.5,
      assets: [sky],
      draw(c, m) {
        layer(c, sky.get(), w, h, M, 0, 0, 1.1, 0.35);
        const o = ss(from + 0.3, from + 1.2, m.b);
        for (const s of sites) {
          const done = ss(s.at, s.at + 0.6, m.b);
          const jit = (1 - done) * cell * 0.12;
          const x = s.x + noise1x(s.i * 3, m.t * 0.6) * jit;
          const y = s.y + noise1x(s.i * 5 + 1, m.t * 0.6) * jit;
          // before: a light nucleus (small, cool) or a heavy one (large, warm); after: iron (the same for all)
          const r0 = s.light ? S * 0.006 : S * 0.012;
          const r = lerp(r0, S * 0.009, done);
          glow(c, x, y, r * 2.4, done > 0.5 ? '#c9ced6' : s.light ? '#9fd8ff' : '#ffb38a', 0.6 * o);
          glow(c, x, y, r, '#ffffff', 0.5 * o);
          const flash = Math.max(0, 1 - Math.abs(m.b - s.at) / 0.25);
          if (flash > 0) glow(c, x, y, cell * 0.5, '#f4efff', 0.6 * flash);
        }
      },
      notes(m) {
        return [
          note('st-d', 'A FEW NUCLEI AT A TIME · BY TUNNELLING', 0.5, (oy - S * 0.08) / h, ss(from + 0.8, from + 1.6, m.b), { tone: 'accent', align: 'c' }),
          note('st-e', 'THE LIGHT FUSE · THE HEAVY SPLIT · ALL TOWARD IRON', 0.5, (oy + (N - 1) * cell * 0.6 + S * 0.08) / h, ss(from + 2, from + 2.8, m.b), { tone: 'dim', align: 'c' }),
        ];
      },
    };
  };

  /** The few dead stars born heavy enough explode as their cores turn to iron: the last flashes there will be. */
  const lastFlashes = (from: number, to: number): Scene => {
    const go = from + 3.6;
    const shell = new Stipple(810, Math.round(800 * k) + 150, (r) => 0.3 + 0.7 * r);
    return {
      from,
      to,
      fade: 1.5,
      assets: [sky, coldDwarf],
      draw(c, m) {
        layer(c, sky.get(), w, h, M, 0, 0, 1.06 + 0.04 * m.p, 0.5);
        const pre = 1 - ss(go - 0.15, go, m.b);
        if (pre > 0) {
          // its core collapsing: the disc tightening before it goes
          const R = S * 0.07 * (1 - 0.25 * ss(go - 1.2, go, m.b));
          c.save();
          c.globalAlpha = pre;
          disc(c, coldDwarf.get(), cx, cy, R);
          c.restore();
          ink(c, circlePath(cx, cy, R * 1.12, 80, 811), pre * ss(from + 0.4, from + 1.4, m.b), { width: thin, color: GREY, seed: 811, alpha: 0.5 });
        }
        const flash = ss(go - 0.1, go + 0.15, m.b) * (1 - ss(go + 0.15, go + 2.2, m.b));
        glow(c, cx, cy, S * 0.45, '#fff1d6', 0.9 * flash);
        glow(c, cx, cy, S * 0.07, '#ffffff', flash);
        const u = ss(go, to + 1, m.b);
        if (u > 0) {
          for (let i = 0; i < 3; i++) ink(c, circlePath(cx, cy, S * (0.03 + (0.5 - i * 0.1) * Math.sqrt(u)), 140, 812 + i), 1, { width: Math.max(1, S * 0.002), color: i ? '#ffb38a' : '#fff1d6', seed: 812 + i, alpha: 0.75 * (1 - u * 0.8) });
          shell.draw(c, cx, cy, S * (0.05 + 0.45 * Math.sqrt(u)), { color: '#ffd9a8', dot: Math.max(1, S * 0.0022), show: 1, gone: ss(go + 3, to + 1, m.b) * 0.8, t: m.t, alpha: 0.85 });
        }
      },
      notes(m) {
        return [
          note('st-f', 'ONE OF THE FEW BORN HEAVY · 1.2 TO 1.4 SUNS', 0.5, (cy + S * 0.12) / h, ss(from + 0.8, from + 1.6, m.b) * (1 - ss(go - 0.4, go, m.b)), { tone: 'accent', align: 'c' }),
          note('st-g', 'ITS CORE TURNING TO IRON', 0.5, (cy + S * 0.15) / h, ss(from + 1.6, from + 2.4, m.b) * (1 - ss(go - 0.4, go, m.b)), { tone: 'dim', align: 'c' }),
          note('st-h', 'A BLACK DWARF SUPERNOVA · ONE OF THE LAST FLASHES', 0.5, (cy + S * 0.22) / h, ss(go + 0.8, go + 1.6, m.b), { tone: 'accent', align: 'c' }),
        ];
      },
    };
  };

  /** In the end the matter itself tunnels, all at once, into black holes that evaporate at once. */
  const collapse = (from: number, to: number): Scene => {
    const go = from + 3.4;
    return {
      from,
      to,
      fade: 1.5,
      assets: [sky, coldWorld],
      draw(c, m) {
        layer(c, sky.get(), w, h, M, 0, 0, 1.08 + 0.04 * m.p, 0.5);
        const pre = 1 - ss(go - 0.05, go + 0.05, m.b);
        if (pre > 0) {
          c.save();
          c.globalAlpha = pre;
          disc(c, coldWorld.get().paint(m.t * 0.05), cx, cy, S * 0.08);
          c.restore();
        }
        // a hole for an instant, where it was; gone in a flash
        const hole = ss(go, go + 0.1, m.b) * (1 - ss(go + 0.5, go + 0.6, m.b));
        if (hole > 0) plainHole(c, cx, cy, S * 0.012, S, { glow: 2, color: GREY });
        const flash = ss(go + 0.5, go + 0.65, m.b) * (1 - ss(go + 0.65, go + 2.2, m.b));
        glow(c, cx, cy, S * 0.3, '#f4efff', 0.85 * flash);
        if (m.b > go + 0.5) {
          const ru = ss(go + 0.5, go + 3.5, m.b);
          ink(c, circlePath(cx, cy, S * (0.02 + 0.4 * ru), 120, 820), 1, { width: Math.max(1, S * 0.002), color: GSOFT, seed: 820, alpha: 0.8 * (1 - ru) });
        }
      },
      notes(m) {
        return [
          note('st-i', 'SOMEWHERE BETWEEN 10^(10²⁶) AND 10^(10⁷⁶) YEARS', 0.5, (cy + S * 0.13) / h, ss(from + 0.8, from + 1.6, m.b), { tone: 'dim', align: 'c' }),
          note('st-j', 'IT TUNNELS INTO A BLACK HOLE · GONE AT ONCE', 0.5, (cy + S * 0.16) / h, ss(go + 0.8, go + 1.6, m.b), { tone: 'accent', align: 'c' }),
        ];
      },
    };
  };

  const card = (c: Ctx, m: Moment) => {
    layer(c, sky.get(), w, h, M, 0, 0, 1 + 0.04 * m.p, 0.45);
    lattice(c, cx, h * 0.38, S * 0.05, m.t, S, { color: TEAL, node: '#dff6ff', alpha: 0.4 * (1 - m.p * 0.5), incl: 0.3, seed: 830, lines: 8 });
  };

  if (stable)
    return {
      numeral: 'IV',
      title: 'The Dark Era',
      sub: 'Age IV · nothing warmer than the sky',
      titleAt: 62,
      eta: [99.4, 100.2],
      narration: [
        { from: 0.6, to: 5.6, text: 'The last black hole has evaporated.' },
        { from: 6.2, to: 11.6, text: 'There are no more sources, only what you saved.' },
        { from: 12.2, to: 19.8, text: 'The matter is still here, dead stars and worlds as cold as the sky itself, giving nothing back,' },
        { from: 20.4, to: 26.2, text: 'and slowly, a few nuclei at a time, tunnelling toward iron:' },
        { from: 26.8, to: 34.2, text: 'the few dead stars born heavy enough will explode as their cores turn, the last flashes there will be.' },
        { from: 34.8, to: 39.8, text: 'Photons stretched longer than galaxies once were drift through the dark.' },
        { from: 40.4, to: 46.4, text: 'Every thought now draws on a reserve that will never refill,' },
        { from: 47, to: 53, text: 'and time itself now passes in powers of powers.' },
        { from: 53.8, to: 61.4, text: 'Even the matter will not last: in the end it tunnels into black holes.' },
      ],
      scenes: [lastHole(0, 6.5), noSources(6, 12.5), coldMatter(12, 20.5), ironTunnel(20, 27), lastFlashes(26.5, 35), photons(34.5, 40.5), reserve(40, 47), powers(46.5, 54), collapse(53.5, 62.5)],
      card,
    };
  return {
    numeral: 'IV',
    title: 'The Dark Era',
    sub: 'Age IV · nothing warmer than the sky',
    titleAt: 62,
    eta: [99.4, 100.2],
    narration: [
      { from: 0.8, to: 7.4, text: 'The last black hole has evaporated.' },
      { from: 8.4, to: 15.2, text: 'There are no more sources, only what you saved.' },
      { from: 16.2, to: 23.2, text: 'Photons stretched longer than galaxies once were,' },
      { from: 24.2, to: 33, text: 'and positronium atoms wider than the old observable universe, drift through the dark.' },
      { from: 34, to: 42.6, text: 'Every thought now draws on a reserve that will never refill,' },
      { from: 43.6, to: 52.4, text: 'and time itself now passes in powers of powers.' },
    ],
    scenes: [lastHole(0, 8.5), noSources(8, 16), photons(15.5, 24), positronium(23.5, 34), reserve(33.5, 43.5), powers(43, 53), drift(52.5, 62.5, 'WHAT YOU SAVED')],
    card,
  };
});
