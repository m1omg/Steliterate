import { Rng } from '../game/rng';
import { circlePath, glow, ink, ss, type Ctx, type Pt } from './draw';
import { camera, landscape, layer, put, reticle, skyRatio } from './kit';
import type { FilmDef } from './films';
import { Population, msL, msT } from './hr';
import { Lazy, Perlin, World, canvas, css, dotSprite, kelvin, paintElliptical, paintNebula, paintSky, paintStar, paintWorldMap, tint, type RGB } from './paint';
import { ease, note, reel2, timecode, type Moment, type Scene } from './reel';

// The Twilight Interregnum (Age 0, 1 Nov; the player: "Make an intro for Twilight interregnum",
// warm and a little wistful, with the galaxy alone, stars dying and stars born, a nebula and a
// young star, our star and our world). In nine shots: a sky still full of stars, warmer and
// denser than the Dusk's, a rose band of gas across it; into the band and out to the galaxy, the
// last faint galaxies beyond it slipping away and the afterglow of the beginning fading; the
// galaxy itself, brighter and younger than in the Dusk, still flecked with gas; a generation on
// the Hertzsprung–Russell diagram from η 12, the heavier red dwarfs going first (blue, then down
// to the white dwarfs) and a few new stars arriving on the main sequence; a nebula, a knot of it
// lighting as a young yellow star, a blue giant burning beyond; that star up close; ours, one of
// the heavier red dwarfs; and our world, young, its seas open, auroras over its poles, its cities
// lit. The words are the age's own introduction.

const INK = '#e6dccb';
const ACC = '#f2b65a';
const STAR_T = 3250;
const SUN: RGB = kelvin(STAR_T);
const hex = (c: RGB) => `#${c.map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0')).join('')}`;

export const INTERREGNUM_FILM: FilmDef = reel2({ id: 'interregnum', name: 'The Twilight Interregnum', bpm: 90, beats: 76, accent: ACC }, (w, h, S, k, args) => {
  const pr = args.pr ?? 1;
  const land = landscape(w, h);
  const M = 1.3; // the sky's canvases are this much larger than the frame
  const dpx = (x: number) => Math.round(x * pr);
  const spx = (x: number) => Math.round(x * skyRatio(w, h, M, pr));
  const scale = Math.max(1, (S / 900) * pr);
  const area = (w * h) / (1600 * 900);

  // ------------------------------------------------------------ paintings
  // (the sky of a galaxy still lit: more stars than the Dusk's, warmer and whiter, a few blue, and
  // the band rose with the gas still in it)
  const farSky = paintSky(spx(w * M), spx(h * M), {
    seed: 201,
    n: Math.round(8200 * k * area),
    temps: [
      [44, 3100],
      [18, 3700],
      [12, 4600],
      [9, 5600],
      [5, 7500],
      [2, 12000],
    ],
    band: { color: [1, 0.56, 0.6], alpha: 0.75, angle: land ? -0.32 : -1.1 },
    scale,
  });
  const nearSky = paintSky(spx(w * M), spx(h * M), {
    seed: 202,
    n: Math.round(640 * k * area) + 60,
    temps: [
      [6, 3200],
      [3, 4500],
      [2, 5800],
      [1, 9500],
    ],
    spikes: 8,
    scale: scale * 1.2,
  });
  const GAL = Math.round(Math.min(2400, S * 1.4 * pr));
  const galaxy = paintElliptical(GAL, { seed: 203, n: Math.round(110000 * k), scale: Math.max(1, GAL / 1300), flat: 0.7, angle: 0.32 });
  // what the Dusk's galaxy no longer has: rose knots of gas where stars still form, and the young
  // stars they have made, scattered through what is left of its disc
  const flecks = new Lazy(function* () {
    const cv = canvas(GAL, GAL);
    const g = cv.getContext('2d')!;
    g.globalCompositeOperation = 'lighter';
    const rng = new Rng(204);
    const s0 = Math.max(1, GAL / 1300);
    const ca = Math.cos(0.32);
    const sa = Math.sin(0.32);
    const R = GAL * 0.46;
    for (let i = 0; i < Math.round(2200 * k) + 300; i++) {
      const r = 0.12 + Math.pow(rng.next(), 0.8) * 0.6;
      const a = rng.range(0, Math.PI * 2);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r * 0.7;
      const px = GAL / 2 + (x * ca - y * sa) * R;
      const py = GAL / 2 + (x * sa + y * ca) * R;
      if (rng.chance(0.07)) {
        // a knot of glowing hydrogen
        const sz = s0 * rng.range(1.5, 4.5);
        const grd = g.createRadialGradient(px, py, 0, px, py, sz);
        grd.addColorStop(0, 'rgba(255,120,150,0.3)');
        grd.addColorStop(1, 'rgba(255,90,130,0)');
        g.fillStyle = grd;
        g.fillRect(px - sz, py - sz, sz * 2, sz * 2);
      } else {
        const T = rng.chance(0.3) ? rng.range(8000, 20000) : rng.range(4500, 6500);
        g.fillStyle = css(kelvin(T), rng.range(0.2, 0.5));
        const sz = s0 * rng.range(0.7, 1.2);
        g.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      }
      if (i % 500 === 499) yield;
    }
    return cv;
  });
  // the afterglow of the beginning: the faint mottled glow of the cosmic background, long since
  // stretched past any instrument's reach (drawn here as the film's way of showing it going)
  const afterglow = new Lazy(function* () {
    const aw = Math.max(32, Math.round((w * M) / 8));
    const ah = Math.max(32, Math.round((h * M) / 8));
    const small = canvas(aw, ah);
    const g = small.getContext('2d')!;
    const img = g.createImageData(aw, ah);
    const n = new Perlin(205);
    for (let j = 0; j < ah; j++) {
      for (let i = 0; i < aw; i++) {
        const v = n.fbm((i / aw) * 7, (j / ah) * 7 * (ah / aw), 0.7, 5) * 0.5 + 0.5;
        const q = (j * aw + i) * 4;
        img.data[q] = 150;
        img.data[q + 1] = 70;
        img.data[q + 2] = 45;
        img.data[q + 3] = Math.round(255 * Math.pow(v, 2.2) * 0.55);
      }
      if (j % 16 === 15) yield;
    }
    g.putImageData(img, 0, 0);
    const cv = canvas(spx(w * M), spx(h * M));
    const cg = cv.getContext('2d')!;
    cg.imageSmoothingEnabled = true;
    cg.drawImage(small, 0, 0, cv.width, cv.height);
    return cv;
  });
  const NEB = 1.25; // the nebula is painted this much larger than the frame, for the camera to move in
  const knot = [0.56, 0.47] as const;
  const nebula = paintNebula(dpx(w * NEB), dpx(h * NEB), { seed: 209, n: Math.round(320 * k * Math.max(0.5, area)) + 40, scale: scale * 0.9, knot });
  const RY = S * (land ? 0.2 : 0.22);
  const youngLook = { T: 5650, seed: 210, limb: [0.6, 0.2] as const, spots: 1, spotSize: 0.04, cells: 46, grain: 0.3 };
  const young = paintStar(dpx(RY * 2), youngLook);
  const young2 = paintStar(dpx(RY * 2), { ...youngLook, phase: 1 });
  const R4 = S * (land ? 0.32 : 0.29);
  const starLook = { T: STAR_T, seed: 211, limb: [0.5, 0.28] as const, spots: 6, spotSize: 0.1, cells: 36, grain: 0.34 };
  const star = paintStar(dpx(R4 * 2), starLook);
  const star2 = paintStar(dpx(R4 * 2), { ...starLook, phase: 1 });
  const R5 = S * (land ? 0.27 : 0.3);
  const lights: [number, number][] = [];
  {
    const rng = new Rng(212);
    // its cities: across the night side and along the day's edge, more than the Dusk's few
    for (let i = 0; i < 20; i++) lights.push([-rng.range(1.3, 2.9), rng.range(-0.95, 0.95)]);
  }
  const map = paintWorldMap(Math.round(640 * (0.6 + 0.4 * k)), {
    seed: 213,
    sea: 0.6,
    ice: 0.74,
    locked: true,
    cloud: 0.32,
    lights,
    palette: {
      deep: [0.02, 0.07, 0.15],
      shallow: [0.06, 0.24, 0.3],
      low: [0.2, 0.25, 0.14],
      high: [0.5, 0.44, 0.36],
      ice: [0.86, 0.89, 0.93],
      cloud: [0.92, 0.88, 0.84],
      air: [0.6, 0.7, 1],
      lights: [1, 0.85, 0.6],
    },
  });
  const LIGHT: [number, number, number] = [0.95, 0.22, 0.1];
  const world = new Lazy(function* () {
    const mp = map.get();
    yield;
    const wd = new World(dpx(R5 * 2 * 1.6), mp, { light: LIGHT, sun: [SUN[0] * 1.3, SUN[1] * 1.25, SUN[2] * 1.2], tilt: 0.3, air: [0.55, 0.62, 1], lights: [1, 0.82, 0.55], airThick: 1.6 });
    yield;
    // locked to its star: the point under the star turned to face it
    wd.paint(-Math.atan2(LIGHT[0], LIGHT[2]));
    return wd;
  });
  const pop = new Population(207, Math.round(2400 * (0.5 + 0.5 * k)));
  // the stars still forming: at any moment a crop of young ones on the main sequence (the heavier
  // ones live a few billion years, gone and replaced many times over within the shot), fewer as the
  // gas thins, each by its own share of what is left
  const newcomers = new Population(208, Math.round(700 * (0.5 + 0.5 * k))).stars.filter((s) => s.m >= 0.3);
  const gasAt = (eta: number) => 1 - (eta - 12) / 1.95;
  const sprites = [4, 6, 9, 14].map((r) => dotSprite(r * scale));

  // ------------------------------------------------------------ 1. a sky still full of stars
  const winks = Array.from({ length: 7 }, (_, i) => {
    const r = new Rng(220 + i);
    return { x: r.range(0.1, 0.9) * w, y: r.range(0.12, 0.7) * h, at: 0.8 + i * 0.6 + r.range(0, 0.3), T: r.chance(0.4) ? 9000 : 5200 };
  });
  const skyWide: Scene = {
    from: 0,
    to: 6,
    assets: [farSky, nearSky],
    draw(c, m) {
      const z = 1 + 0.08 * ease(m.b / 11);
      layer(c, farSky.get(), w, h, M, -w * 0.015 * (m.b / 6), 0, z, 1);
      layer(c, nearSky.get(), w, h, M, -w * 0.035 * (m.b / 6), -h * 0.01 * (m.b / 6), z * 1.04, 1);
      // stars in their prime: a few brighten into view and stay, twinkling
      for (const s of winks) {
        const on = ss(s.at, s.at + 1.2, m.b);
        if (on <= 0) continue;
        const tw = 0.8 + 0.2 * Math.sin(m.t * 3.1 + s.x);
        glow(c, s.x, s.y, S * 0.028, hex(kelvin(s.T)), 0.32 * on * tw);
        put(c, tint(dotSprite(5 * scale), kelvin(s.T)), s.x, s.y, pr);
      }
    },
  };

  // ------------------------------------------------------------ 2. into the band
  const bandAt = { x: land ? w * 0.6 : w * 0.45, y: land ? h * 0.47 : h * 0.55 };
  const intoBand: Scene = {
    from: 5.5,
    to: 11,
    fade: 1,
    draw(c, m) {
      const z = 1.08 + 1.6 * Math.pow(m.p, 1.6);
      camera(c, bandAt.x, bandAt.y, z, 0, 0, () => {
        layer(c, farSky.get(), w, h, M, -w * 0.015, 0, 1.08, 1);
        layer(c, nearSky.get(), w, h, M, -w * 0.035, -h * 0.01, 1.12, 1 - ss(0.4, 1, m.p));
      });
    },
  };

  // ------------------------------------------------------------ 3. the galaxy alone
  const gx = land ? w * 0.42 : w * 0.5;
  const gy = land ? h * 0.48 : h * 0.5;
  const gsize = S * (land ? 1.1 : 1.2);
  const home = { x: gx + gsize * 0.24, y: gy + gsize * 0.1 };
  const drawGalaxy = (c: Ctx, x: number, y: number, z: number, rot: number, alpha: number) => {
    c.save();
    c.globalAlpha = alpha;
    c.translate(x, y);
    c.rotate(rot);
    c.scale(z, z);
    c.globalCompositeOperation = 'lighter';
    c.drawImage(galaxy.get(), -gsize / 2, -gsize / 2, gsize, gsize);
    c.drawImage(flecks.get(), -gsize / 2, -gsize / 2, gsize, gsize);
    c.restore();
    // (lit as the Dusk's is not: its light whiter, and more of it)
    glow(c, x, y, gsize * 0.32 * z, '#ffd9a8', 0.22 * alpha);
  };
  // the last other galaxies, small and faint, slipping away past the horizon: dimmer and redder
  // as they go, then gone
  const others = Array.from({ length: 9 }, (_, i) => {
    const r = new Rng(230 + i);
    const a = r.range(0, Math.PI * 2);
    const d = r.range(0.42, 0.62);
    return { a, d, size: r.range(0.008, 0.02), tilt: r.range(0, Math.PI), flat: r.range(0.35, 0.8), out: 12 + i * 0.45 + r.range(0, 0.6) };
  });
  const aloneShot: Scene = {
    from: 10.5,
    to: 17.5,
    enter: 'zoom',
    fade: 1.5,
    assets: [galaxy, flecks, afterglow],
    draw(c, m) {
      // the afterglow behind it all, fading to nothing
      const fadeOut = 1 - ss(11, 16, m.b);
      layer(c, afterglow.get(), w, h, M, 0, 0, 1.1, 0.75 * fadeOut);
      layer(c, farSky.get(), w, h, M, 0, 0, 1.15, 0.28);
      const z = 0.78 - 0.1 * ease(m.p);
      drawGalaxy(c, gx, gy, z, 0.03 * m.p, 1);
      for (const o of others) {
        const go = ss(o.out - 1.5, o.out + 1.2, m.b);
        if (go >= 1) continue;
        const dd = S * o.d * (1 + 0.35 * go);
        const x = gx + Math.cos(o.a) * dd * (land ? 1.5 : 1);
        const y = gy + Math.sin(o.a) * dd;
        const R = S * o.size * (1 - 0.4 * go);
        const col = go < 0.5 ? '#f5e4c8' : '#c46a48';
        c.save();
        c.globalAlpha = 0.85 * (1 - go);
        c.translate(x, y);
        c.rotate(o.tilt);
        c.scale(1, o.flat);
        glow(c, 0, 0, R * 2.4, col, 0.55);
        glow(c, 0, 0, R * 0.6, '#fff4e0', 0.6 * (1 - go));
        c.restore();
      }
    },
    notes(m) {
      return [
        note('o-gal', 'THE LAST OTHER GALAXIES', (land ? 0.72 : 0.5), (land ? 0.2 : 0.14), ss(11.5, 12.5, m.b) * (1 - ss(15.5, 16.5, m.b)), { tone: 'ink', align: land ? 'l' : 'c' }),
        note('o-cmb', 'THE AFTERGLOW · FADING', (land ? 0.72 : 0.5), (land ? 0.2 : 0.14) + (S * 0.03) / h, ss(12.5, 13.5, m.b) * (1 - ss(15.5, 16.5, m.b)), { tone: 'dim', align: land ? 'l' : 'c' }),
      ];
    },
  };
  // the galaxy close: the Heart, home, and the gas still in it
  const galaxyShot: Scene = {
    from: 17,
    to: 23.5,
    fade: 1.5,
    draw(c, m) {
      layer(c, farSky.get(), w, h, M, 0, 0, 1.15, 0.3);
      const z = 1.05 + 0.2 * ease(m.p);
      drawGalaxy(c, gx, gy, z, 0.03 + 0.03 * m.p, 1);
      reticle(c, gx, gy, S * 0.03 * z, S, ss(18, 19.2, m.b), 81, ACC);
      const hx = gx + (home.x - gx) * z;
      const hy = gy + (home.y - gy) * z;
      reticle(c, hx, hy, S * 0.012 * z, S, ss(19.5, 20.5, m.b), 85);
    },
    notes(m) {
      const z = 1.05 + 0.2 * ease(m.p);
      return [
        note('g-heart', 'THE HEART', (gx + S * 0.055 * z) / w, (gy - S * 0.035 * z) / h, ss(18.5, 19.5, m.b), { tone: 'accent' }),
        note('g-home', 'HOME', (gx + (home.x - gx) * z + S * 0.03 * z) / w, (gy + (home.y - gy) * z) / h, ss(20, 21, m.b), { tone: 'ink' }),
        note('g-gas', 'GAS · STILL MAKING STARS', (gx - S * 0.3 * z) / w, (gy + S * 0.3 * z) / h, ss(21, 22, m.b), { tone: 'dim' }),
      ];
    },
  };

  // ------------------------------------------------------------ 4. stars dying, stars born, on the H–R diagram
  const hw = land ? Math.min(w * 0.6, S * 1.2) : w * 0.84;
  const hh = land ? hw * 0.6 : hw * 0.95;
  const hx0 = (w - hw) / 2 + (land ? w * 0.02 : 0);
  const hy0 = land ? h * 0.17 : h * 0.2;
  const LT0 = 4.62;
  const LT1 = 3.15;
  const px = (logT: number) => hx0 + ((LT0 - logT) / (LT0 - LT1)) * hw;
  const py = (logL: number) => hy0 + ((4 - logL) / 9) * hh;
  // from a trillion years to about four (η 12 to 12.6): the heavier red dwarfs going, the new ones coming
  const sweep = (m: Moment) => 12 + 0.6 * ss(24.5, 36, m.b);
  const ghost: Pt[] = Array.from({ length: 60 }, (_, i) => {
    const mass = 0.08 * Math.pow(20 / 0.08, i / 59);
    return [px(Math.log10(msT(mass))), py(Math.log10(msL(mass)))] as const;
  });
  const hrShot: Scene = {
    from: 23,
    to: 37.5,
    fade: 1.5,
    draw(c, m) {
      layer(c, farSky.get(), w, h, M, 0, 0, 1.15, 0.3);
      const axes = ss(23.2, 24.8, m.b);
      ink(c, [[hx0, hy0], [hx0, hy0 + hh], [hx0 + hw, hy0 + hh]], axes, { width: S * 0.0018, color: INK, seed: 31, alpha: 0.6 });
      c.save();
      c.setLineDash([S * 0.006, S * 0.008]);
      ink(c, ghost, ss(24.5, 26.5, m.b), { width: S * 0.0012, color: INK, seed: 32, alpha: 0.22 });
      c.restore();
      if (axes > 0.6) {
        c.save();
        c.globalAlpha = ss(0.6, 1, axes);
        c.font = `${Math.max(10, S * 0.0135)}px "IBM Plex Mono", monospace`;
        c.fillStyle = 'rgba(230,220,203,0.62)';
        c.textAlign = 'center';
        for (const T of [30000, 10000, 6000, 3000]) {
          const x = px(Math.log10(T));
          c.fillRect(x - 0.5, hy0 + hh, 1, S * 0.008);
          c.fillText(`${T.toLocaleString('en')} K`, x, hy0 + hh + S * 0.03);
        }
        c.textAlign = 'right';
        for (const [L, s] of [
          [3, '10³'],
          [1, '10'],
          [-1, '10⁻¹'],
          [-3, '10⁻³'],
          [-5, '10⁻⁵'],
        ] as const) {
          const y = py(L);
          c.fillRect(hx0 - S * 0.008, y - 0.5, S * 0.008, 1);
          c.fillText(s, hx0 - S * 0.014, y + S * 0.004);
        }
        c.restore();
      }
      const eta = sweep(m);
      const show = ss(23.8, 25.4, m.b);
      if (show <= 0) return;
      c.save();
      c.globalCompositeOperation = 'lighter';
      const plot = (p: Population, boost: number) => {
        for (const s of p.stars) {
          const pt = p.at(s, eta);
          if (pt.a <= 0.01 || pt.logL < -5.2 || pt.logL > 4.6) continue;
          const cold = ss(LT1, LT1 + 0.12, pt.logT);
          if (cold <= 0 || pt.logT > LT0 + 0.05) continue;
          const sz = pt.logL > 1.5 ? 3 : pt.logL > -0.5 ? 2 : pt.logL > -2.6 ? 1 : 0;
          c.globalAlpha = Math.min(1, show * pt.a * cold * (0.32 + 0.2 * Math.sin(m.t * 2.2 + s.k * 60) ** 2) * (pt.kind === 'wd' ? 0.8 : pt.kind === 'blue' ? 1.6 : 1) * boost);
          put(c, tint(sprites[sz], kelvin(Math.pow(10, pt.logT))), px(pt.logT), py(pt.logL), pr);
        }
      };
      plot(pop, 1);
      for (const s of newcomers) {
        const a = ss(30 + s.k * 2, 31 + s.k * 2, m.b) * ss(0, 0.04, gasAt(eta) - s.k * 0.9);
        if (a <= 0) continue;
        const logT = Math.log10(msT(s.m)) + s.dT;
        const logL = Math.log10(msL(s.m)) + s.dL * 0.5;
        const sz = logL > 1.5 ? 3 : logL > -0.5 ? 2 : 1;
        c.globalAlpha = Math.min(1, show * a * (0.55 + 0.25 * Math.sin(m.t * 2.2 + s.k * 60) ** 2));
        put(c, tint(sprites[sz], kelvin(Math.pow(10, logT))), px(logT), py(logL), pr);
      }
      c.restore();
    },
    notes(m) {
      const lab = ss(25, 26.5, m.b);
      return [
        note('hr-t', 'TEMPERATURE', (hx0 + hw / 2) / w, (hy0 + hh + S * 0.065) / h, lab * 0.9, { align: 'c', tone: 'dim' }),
        note('hr-l', 'LUMINOSITY · SUNS', hx0 / w, (hy0 - S * 0.035) / h, lab * 0.9, { tone: 'dim' }),
        note('hr-ms', 'MAIN SEQUENCE', px(4.15) / w, py(2.6) / h, lab, { tone: 'ink' }),
        note('hr-go', 'THE HEAVIER RED DWARFS', px(3.45) / w, py(-0.6) / h, ss(27.5, 29, m.b), { tone: 'accent' }),
        note('hr-go2', 'GOING FIRST: BLUE, THEN WHITE DWARFS', px(3.45) / w, py(-0.6) / h + (S * 0.03) / h, ss(28, 29.5, m.b) * 0.9, { tone: 'dim' }),
        note('hr-new', 'NEW STARS · STILL FORMING', px(4.25) / w, py(0.3) / h, ss(31.5, 33, m.b), { tone: 'accent', align: 'c' }),
        note('hr-eta', timecode(sweep(m)), (hx0 + hw) / w, (hy0 + S * 0.01) / h, ss(24, 25, m.b), { align: 'r', tone: 'accent', size: 'm' }),
      ];
    },
  };

  // ------------------------------------------------------------ 5. a nebula: a knot of it lighting as a young star
  const kx = w / 2 + (knot[0] - 0.5) * w * NEB;
  const ky = h / 2 + (knot[1] - 0.5) * h * NEB;
  const giant = { x: land ? w * 0.2 : w * 0.24, y: land ? h * 0.26 : h * 0.2 };
  const LIT = 41;
  const nebulaShot: Scene = {
    from: 37,
    to: 44,
    enter: 'zoom',
    fade: 1.5,
    assets: [nebula],
    draw(c, m) {
      const z = 1 + 0.12 * ease(m.p);
      camera(c, kx, ky, z, 0, 0, () => {
        layer(c, farSky.get(), w, h, M, 0, 0, 1.1, 0.5);
        layer(c, nebula.get(), w, h, NEB, 0, 0, 1, 1);
        // the blue giant beyond: bright, hot, brief
        glow(c, giant.x, giant.y, S * 0.16, '#9fc0ff', 0.22);
        glow(c, giant.x, giant.y, S * 0.035, '#e4eeff', 0.9);
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
        ]) {
          const L = S * 0.09;
          c.save();
          c.globalCompositeOperation = 'lighter';
          c.strokeStyle = 'rgba(200,220,255,0.45)';
          c.lineWidth = Math.max(1, S * 0.0014);
          c.beginPath();
          c.moveTo(giant.x - dx * L, giant.y - dy * L);
          c.lineTo(giant.x + dx * L, giant.y + dy * L);
          c.stroke();
          c.restore();
        }
        // the knot: a dark globule warming, then a star lighting inside it
        const warm = ss(38.5, LIT, m.b);
        const lit = ss(LIT, LIT + 0.8, m.b);
        glow(c, kx, ky, S * 0.05, '#ff7a5a', 0.3 * warm * (1 - lit));
        glow(c, kx, ky, S * 0.22, '#ffd9a0', 0.25 * lit);
        glow(c, kx, ky, S * 0.06, '#fff2d6', 0.85 * lit);
        glow(c, kx, ky, S * 0.015, '#ffffff', lit);
      });
    },
    notes(m) {
      return [
        note('n-neb', 'A NEBULA · HYDROGEN AND DUST', (land ? 0.62 : 0.5), (land ? 0.82 : 0.78), ss(38, 39, m.b), { tone: 'ink', align: land ? 'l' : 'c' }),
        note('n-new', 'A NEW STAR', (kx + S * 0.05) / w, (ky - S * 0.04) / h, ss(LIT + 0.5, LIT + 1.3, m.b), { tone: 'accent' }),
        note('n-giant', 'A BLUE GIANT · 12 M☉ · GONE IN 20 MILLION YEARS', (giant.x + S * 0.04) / w, (giant.y + S * 0.045) / h, ss(42, 43, m.b), { tone: 'dim' }),
      ];
    },
  };
  // the young star up close, the gas round it lit and blown back
  const yx = land ? w * 0.55 : w * 0.5;
  const yy = land ? h * 0.5 : h * 0.46;
  const youngShot: Scene = {
    from: 43.5,
    to: 49.5,
    enter: 'zoom',
    fade: 1,
    assets: [young, young2],
    draw(c, m) {
      const u = ease(m.p);
      layer(c, nebula.get(), w, h, NEB, -w * 0.05 * u, 0, 1.6 + 0.1 * u, 0.55);
      const R = RY * (1 + 0.05 * u);
      glow(c, yx, yy, R * 4, '#ffcf8a', 0.16);
      glow(c, yx, yy, R * 1.8, '#fff0cc', 0.35);
      // what is left of the disc of dust it formed from, nearly edge on, a lane cleared in it where a
      // world is forming: its far half behind the star, its near half before it
      const shown = ss(44.5, 46.5, m.b);
      const ring = (half: 0 | 1) => {
        if (shown <= 0) return;
        c.save();
        c.beginPath();
        c.rect(yx - R * 3, half ? yy : yy - R * 3, R * 6, R * 3);
        c.clip();
        c.translate(yx, yy);
        c.scale(1, 0.17);
        c.globalCompositeOperation = 'lighter';
        const a = shown * (half ? 0.8 : 1);
        const g = c.createRadialGradient(0, 0, R * 1.02, 0, 0, R * 2.9);
        g.addColorStop(0, 'rgba(255,196,140,0)');
        g.addColorStop(0.08, `rgba(255,196,140,${0.42 * a})`);
        g.addColorStop(0.38, `rgba(255,178,128,${0.22 * a})`);
        g.addColorStop(0.46, `rgba(255,178,128,${0.04 * a})`);
        g.addColorStop(0.54, `rgba(255,170,124,${0.2 * a})`);
        g.addColorStop(1, 'rgba(255,160,120,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(0, 0, R * 2.9, 0, Math.PI * 2);
        c.fill();
        c.restore();
      };
      ring(0);
      c.drawImage(young.get(), yx - R, yy - R, R * 2, R * 2);
      c.save();
      c.globalAlpha = 0.5 + 0.5 * Math.sin(m.t * 1.1);
      c.drawImage(young2.get(), yx - R, yy - R, R * 2, R * 2);
      c.restore();
      // (a yellow star's light: far brighter than the red dwarfs', so its disc burns white at the middle)
      glow(c, yx, yy, R * 1.05, '#fff4dc', 0.55);
      ring(1);
    },
    notes(m) {
      const R = RY * (1 + 0.05 * ease(m.p));
      return [
        note('y-a', 'A YOUNG STAR · LIKE THE SUN', (yx + R * 1.25) / w, (yy - R * 0.9) / h, ss(45, 46, m.b), { tone: 'accent', size: 'm' }),
        note('y-b', '0.95 M☉ · 5,650 K · WORLDS FORMING', (yx + R * 1.25) / w, (yy - R * 0.9) / h + (S * 0.035) / h, ss(45.5, 46.5, m.b) * 0.9, { tone: 'ink' }),
      ];
    },
  };

  // ------------------------------------------------------------ 6. our star
  const sx = land ? w * 0.56 : w * 0.5;
  const sy = land ? h * 0.5 : h * 0.44;
  const drawStar = (c: Ctx, m: Moment, x: number, y: number, R: number) => {
    const breathe = 1 + 0.02 * Math.sin(m.t * 1.3);
    glow(c, x, y, R * 3.6, '#ff6a2c', 0.12 * breathe);
    glow(c, x, y, R * 1.9, '#ff9a5a', 0.36 * breathe);
    c.drawImage(star.get(), x - R, y - R, R * 2, R * 2);
    c.save();
    c.globalAlpha = 0.5 + 0.5 * Math.sin(m.t * 0.9);
    c.drawImage(star2.get(), x - R, y - R, R * 2, R * 2);
    c.restore();
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = 'rgba(255,150,100,0.28)';
    c.lineWidth = Math.max(1, S * 0.003);
    c.beginPath();
    c.arc(x, y, R * 1.003, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  };
  const leader = (R: number) => {
    const la = land ? -2.45 : -2.2;
    const p0: Pt = [sx + Math.cos(la) * R * 1.04, sy + Math.sin(la) * R * 1.04];
    const p1: Pt = [sx + Math.cos(la) * R * 1.3, sy + Math.sin(la) * R * 1.3];
    return [p0, p1, [p1[0] - S * 0.12, p1[1]]] as Pt[];
  };
  const gauge = (R: number) => ({ x: sx + Math.cos(0.9) * R * 1.32, y: sy + Math.sin(0.9) * R * 1.32, r: S * 0.045 });
  const starShot: Scene = {
    from: 49,
    to: 57.5,
    enter: 'zoom',
    fade: 1.5,
    assets: [star, star2],
    draw(c, m) {
      layer(c, farSky.get(), w, h, M, w * 0.02 * m.p, 0, 1.2, 0.6);
      layer(c, nearSky.get(), w, h, M, w * 0.04 * m.p, 0, 1.2, 0.5);
      const R = R4 * (1 + 0.05 * ease(m.p));
      drawStar(c, m, sx, sy, R);
      ink(c, leader(R), ss(50.5, 51.8, m.b), { width: S * 0.0016, color: INK, seed: 45, alpha: 0.7 });
      const g = gauge(R);
      ink(c, circlePath(g.x, g.y, g.r, 80, 46, -Math.PI / 2, Math.PI * 1.5), ss(52, 53.3, m.b), { width: S * 0.0018, color: INK, seed: 46, alpha: 0.3 });
      ink(c, circlePath(g.x, g.y, g.r, 30, 47, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.33), ss(52.5, 54, m.b), { width: S * 0.005, color: ACC, seed: 47, alpha: 0.95 });
    },
    notes(m) {
      const R = R4 * (1 + 0.05 * ease(m.p));
      const end = leader(R)[2];
      const g = gauge(R);
      const inst = ss(51.3, 52.3, m.b);
      return [
        note('st-a', 'RED DWARF', (end[0] - S * 0.008) / w, (end[1] - S * 0.022) / h, inst, { align: 'r', tone: 'accent', size: 'm' }),
        note('st-b', '0.20 M☉ · 3,250 K', (end[0] - S * 0.008) / w, (end[1] + S * 0.016) / h, inst * 0.9, { align: 'r' }),
        note('st-c', 'HYDROGEN LEFT · A THIRD', (g.x + S * 0.065) / w, g.y / h, ss(53, 54, m.b), { tone: 'dim' }),
      ];
    },
  };

  // ------------------------------------------------------------ 7. our world, young
  const wx = land ? w * 0.47 : w * 0.5;
  const wy = land ? h * 0.5 : h * 0.47;
  const sunAt: Pt = [wx + LIGHT[0] * S * 1.1, wy - LIGHT[1] * S * 1.1];
  /** Auroras over its poles: curtains of green and crimson where its strong young field brings the star's wind down. */
  const aurora = (c: Ctx, m: Moment, x: number, y: number, R: number, a: number) => {
    if (a <= 0) return;
    // (the north pole tipped toward us by the world's tilt, so its oval shows whole; the south's
    // near half only, over the limb): soft curtains, green low and crimson above, brightening in
    // folds that drift round the oval
    for (const [pole, cy, rx, ry, a0, a1] of [
      [1, y - R * 0.78, R * 0.4, R * 0.11, 0, Math.PI * 2],
      [-1, y + R * 0.92, R * 0.32, R * 0.055, 0, Math.PI],
    ] as const) {
      const n = 30;
      for (let i = 0; i < n; i++) {
        const t = a0 + ((a1 - a0) * (i + 0.5)) / n;
        const fold = Math.pow(Math.max(0, Math.sin(t * 4 + m.t * 0.8 + pole) * 0.6 + Math.sin(t * 11 - m.t * 1.6) * 0.4 + 0.3), 1.5);
        if (fold <= 0.02) continue;
        const px0 = x + Math.cos(t) * rx;
        const py0 = cy + Math.sin(t) * ry;
        glow(c, px0, py0, R * 0.07, '#5affa0', 0.28 * a * fold);
        glow(c, px0, py0 - pole * R * 0.06, R * 0.06, '#ff4a7a', 0.12 * a * fold);
      }
    }
  };
  const drawWorld = (c: Ctx, x: number, y: number, R: number) => {
    const wd = world.get();
    glow(c, x + LIGHT[0] * R * 0.2, y - LIGHT[1] * R * 0.2, R * 1.4, '#9ab8ff', 0.12);
    c.drawImage(wd.canvas, x - R, y - R, R * 2, R * 2);
  };
  const worldShot: Scene = {
    from: 57,
    to: 64,
    enter: 'zoom',
    fade: 1.5,
    assets: [map, world],
    draw(c, m) {
      const u = ease(m.p);
      layer(c, farSky.get(), w, h, M, -w * 0.1 - w * 0.02 * u, 0, 1.2, 0.6);
      layer(c, nearSky.get(), w, h, M, -w * 0.2 - w * 0.04 * u, 0, 1.2, 0.6);
      glow(c, sunAt[0], sunAt[1], S * 0.5, '#ff7a3a', 0.2);
      const z = 1 + 0.12 * u;
      camera(c, wx, wy, z, 0, 0, () => {
        drawWorld(c, wx, wy, R5);
        aurora(c, m, wx, wy, R5, ss(58.5, 60.5, m.b));
      });
    },
    notes(m) {
      const R = R5 * (1 + 0.12 * ease(m.p));
      return [
        note('w-our', 'OUR WORLD', (wx + R * 1.12) / w, (wy - R * 0.55) / h, ss(58, 59, m.b), { tone: 'accent', size: 'm' }),
        note('w-sea', 'OPEN SEAS', (wx + R * 1.12) / w, (wy - R * 0.55) / h + (S * 0.035) / h, ss(59, 60, m.b) * 0.9, { tone: 'ink' }),
        note('w-field', 'A YOUNG CORE · A STRONG FIELD', (wx + R * 1.12) / w, (wy + R * 0.6) / h, ss(60.5, 61.5, m.b), { tone: 'dim' }),
      ];
    },
  };
  // close on its night side: the cities, the auroras over them
  const townsAt: Pt = [wx - R5 * 0.38, wy - R5 * 0.2];
  const citiesShot: Scene = {
    from: 63.5,
    to: 70.5,
    fade: 1.5,
    draw(c, m) {
      const u = ease(m.p);
      layer(c, farSky.get(), w, h, M, -w * 0.14, 0, 1.3, 0.55);
      const z = 1.45 + 0.2 * u;
      camera(c, townsAt[0], townsAt[1], z, w * 0.5 - townsAt[0], h * 0.5 - townsAt[1], () => {
        drawWorld(c, wx, wy, R5);
        aurora(c, m, wx, wy, R5, 1);
      });
    },
    notes(m) {
      return [note('w-home', 'OUR CITIES', 0.5 - (S * 0.12) / w, 0.5 + (S * 0.17) / h, ss(64.5, 65.5, m.b) * (1 - ss(68.5, 69.5, m.b)), { tone: 'accent', align: 'r' })];
    },
  };

  return {
    numeral: '0',
    title: 'The Twilight Interregnum',
    sub: 'Age 0 · the Stelliferous Era',
    titleAt: 70,
    eta: [12, 12.004],
    narration: [
      { from: 1.5, to: 9.5, text: 'A trillion years after the first light, our galaxy is alone.' },
      { from: 11, to: 22.5, text: 'Every other galaxy has slipped past the horizon, and the afterglow of the beginning has faded beyond any instrument.' },
      { from: 24.5, to: 36.5, text: 'Most of its stars are red dwarfs, and the oldest of them are coming to the end of their fuel, the heaviest first;' },
      { from: 37.5, to: 48.5, text: 'the gas to make new ones is thinning.' },
      { from: 50, to: 62.5, text: 'Your world circles one of the heavier ones, about a fifth of the Sun’s mass, near the end of its life.' },
      { from: 63.5, to: 69.5, text: 'It will not see the next trillion years.' },
    ],
    scenes: [skyWide, intoBand, aloneShot, galaxyShot, hrShot, nebulaShot, youngShot, starShot, worldShot, citiesShot],
    card(c, m) {
      layer(c, farSky.get(), w, h, M, 0, 0, 1.0 + 0.04 * m.p, 0.6);
      glow(c, w * 0.5, h * 0.5, S * 0.6, '#ff9a4a', 0.09 * (1 - m.p));
    },
  };
});
