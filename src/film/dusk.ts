import { Rng } from '../game/rng';
import { circlePath, glow, ink, ss, type Ctx, type Pt } from './draw';
import { camera, landscape, layer, put, reticle, ship, skyRatio } from './kit';
import type { FilmDef } from './films';
import { Population, msL, msT } from './hr';
import { Lazy, World, dotSprite, kelvin, paintElliptical, paintSky, paintStar, paintWorldMap, tint, type RGB } from './paint';
import { ease, note, reel2, timecode, type Moment, type Scene } from './reel';

// The Long Dusk (Age I), second cut, in eleven shots: the embers of the sky, a few going out;
// into the galaxy's band and out to the galaxy itself, an old elliptical round the Heart, its
// star-making long over; that history as a curve; a generation of stars on the
// Hertzsprung–Russell diagram, the big ones going first, until only the smallest red dwarfs are
// left; one of them, and a flare off its limb up close; across to the world that circles it,
// locked to it, its night side's lights, its air streaming off in the star's wind; a ship
// leaving; the title. The words are the age's own introduction.

const INK = '#e6dccb';
const ACC = '#f28a4f';
const DWARF: RGB = kelvin(2800);

export const DUSK2: FilmDef = reel2({ id: 'dusk', name: 'The Long Dusk', bpm: 90, beats: 72, accent: ACC }, (w, h, S, k, args) => {
  const pr = args.pr ?? 1;
  const land = landscape(w, h);
  const M = 1.3; // the sky's canvases are this much larger than the frame
  const dpx = (x: number) => Math.round(x * pr);
  const spx = (x: number) => Math.round(x * skyRatio(w, h, M, pr));
  const scale = Math.max(1, (S / 900) * pr);
  const area = (w * h) / (1600 * 900);

  // ------------------------------------------------------------ paintings
  const farSky = paintSky(spx(w * M), spx(h * M), {
    seed: 101,
    n: Math.round(5200 * k * area),
    temps: [
      [70, 3000],
      [12, 3600],
      [6, 5200],
      [3, 9000],
    ],
    band: { color: [1, 0.55, 0.35], alpha: 0.5, angle: land ? -0.32 : -1.1 },
    scale,
  });
  const nearSky = paintSky(spx(w * M), spx(h * M), {
    seed: 102,
    n: Math.round(420 * k * area) + 40,
    temps: [
      [8, 2900],
      [2, 3500],
      [1, 6000],
    ],
    spikes: 5,
    scale: scale * 1.2,
  });
  const GAL = Math.round(Math.min(2400, S * 1.4 * pr));
  const galaxy = paintElliptical(GAL, { seed: 103, n: Math.round(90000 * k), scale: Math.max(1, GAL / 1300), flat: 0.7, angle: 0.32 });
  const R4 = S * (land ? 0.3 : 0.27);
  const starLook = { T: 2750, seed: 104, limb: [0.5, 0.3] as const, spots: 4, spotSize: 0.085, cells: 36, grain: 0.36 };
  const star = paintStar(dpx(R4 * 2), starLook);
  const star2 = paintStar(dpx(R4 * 2), { ...starLook, phase: 1 });
  const R5 = S * (land ? 0.27 : 0.3);
  const lights: [number, number][] = [];
  {
    const rng = new Rng(105);
    // the settlements, along the cold edge of the day, just inside the night
    for (let i = 0; i < 14; i++) lights.push([-(1.62 + rng.range(0, 0.45)), rng.range(-1.05, 1.05)]);
  }
  const map = paintWorldMap(Math.round(512 * (0.6 + 0.4 * k)), {
    seed: 106,
    sea: 0.46,
    ice: 0.58,
    locked: true,
    cloud: 0.3,
    lights,
    palette: {
      deep: [0.02, 0.05, 0.09],
      shallow: [0.07, 0.18, 0.23],
      low: [0.25, 0.21, 0.18],
      high: [0.52, 0.46, 0.4],
      ice: [0.8, 0.84, 0.88],
      cloud: [0.85, 0.82, 0.78],
      air: [1, 0.6, 0.42],
      lights: [1, 0.85, 0.62],
    },
  });
  const LIGHT: [number, number, number] = [0.96, 0.2, 0.2];
  // (painted at the close-up's size, so the lights stay sharp when the camera comes in)
  const world = new Lazy(function* () {
    const mp = map.get();
    yield;
    const wd = new World(dpx(R5 * 2 * 1.6), mp, { light: LIGHT, sun: [DWARF[0] * 1.35, DWARF[1] * 1.25, DWARF[2] * 1.15], tilt: 0.28, air: [1, 0.48, 0.3], lights: [1, 0.8, 0.52], airThick: 1.3 });
    yield;
    // locked to its star: the point under the star turned to face it (map longitude 0 at the light's)
    wd.paint(-Math.atan2(LIGHT[0], LIGHT[2]));
    return wd;
  });
  const pop = new Population(107, Math.round(2400 * (0.5 + 0.5 * k)));
  const sprites = [4, 6, 9, 14].map((r) => dotSprite(r * scale));

  // ------------------------------------------------------------ 1. the embers of the sky, a few going out
  const near = { x: land ? w * 0.36 : w * 0.5, y: land ? h * 0.42 : h * 0.38 };
  const winks = Array.from({ length: 5 }, (_, i) => {
    const r = new Rng(120 + i);
    return { x: r.range(0.12, 0.88) * w, y: r.range(0.14, 0.66) * h, at: 2.2 + i * 0.9 + r.range(0, 0.4) };
  });
  const skyWide: Scene = {
    from: 0,
    to: 6.5,
    assets: [farSky, nearSky],
    draw(c, m) {
      const z = 1 + 0.08 * ease(m.b / 11);
      layer(c, farSky.get(), w, h, M, -w * 0.015 * (m.b / 6), 0, z, 0.95);
      layer(c, nearSky.get(), w, h, M, -w * 0.035 * (m.b / 6), -h * 0.01 * (m.b / 6), z * 1.04, 1);
      const lit = ss(1, 4, m.b);
      glow(c, near.x, near.y, S * 0.2 * z, '#ff5a32', 0.2 * lit);
      glow(c, near.x, near.y, S * 0.05 * z, '#ffb38a', 0.6 * lit);
      put(c, tint(dotSprite(9 * scale), [1, 0.86, 0.72]), near.x, near.y, pr);
      // a few of the last stars going out: a red point, brightening a moment as it turns blue, then nothing
      for (const s of winks) {
        const before = 1 - ss(s.at, s.at + 0.9, m.b);
        const flare = ss(s.at - 0.3, s.at, m.b) * (1 - ss(s.at, s.at + 0.6, m.b));
        if (before > 0) glow(c, s.x, s.y, S * 0.012, '#ff8a5a', 0.5 * before);
        if (flare > 0) glow(c, s.x, s.y, S * 0.03, '#cfe0ff', 0.6 * flare);
      }
    },
  };

  // ------------------------------------------------------------ 2. into the band of the galaxy
  const bandAt = { x: land ? w * 0.6 : w * 0.45, y: land ? h * 0.47 : h * 0.55 };
  const intoBand: Scene = {
    from: 6,
    to: 11,
    fade: 1,
    draw(c, m) {
      const z = 1.08 + 1.6 * Math.pow(m.p, 1.6);
      camera(c, bandAt.x, bandAt.y, z, 0, 0, () => {
        layer(c, farSky.get(), w, h, M, -w * 0.015, 0, 1.08, 0.95);
        layer(c, nearSky.get(), w, h, M, -w * 0.035, -h * 0.01, 1.12, 1 - ss(0.4, 1, m.p));
      });
    },
  };

  // ------------------------------------------------------------ 3. the galaxy: an old elliptical round the Heart
  const gx = land ? w * 0.42 : w * 0.5;
  const gy = land ? h * 0.48 : h * 0.5;
  const gsize = S * (land ? 1.15 : 1.25);
  const home = { x: gx + gsize * 0.25, y: gy + gsize * 0.11 };
  const drawGalaxy = (c: Ctx, z: number, rot: number, alpha: number) => {
    const img = galaxy.get();
    c.save();
    c.globalAlpha = alpha;
    c.translate(gx, gy);
    c.rotate(rot);
    c.scale(z, z);
    c.globalCompositeOperation = 'lighter';
    c.drawImage(img, -gsize / 2, -gsize / 2, gsize, gsize);
    c.restore();
  };
  const galaxyShot: Scene = {
    from: 10.5,
    to: 17.5,
    enter: 'zoom',
    fade: 1.5,
    assets: [galaxy],
    draw(c, m) {
      layer(c, farSky.get(), w, h, M, 0, 0, 1.15, 0.35);
      const z = 1.55 - 0.55 * ease(ss(0, 0.85, m.p));
      drawGalaxy(c, z, 0.04 * m.p, 1);
      reticle(c, gx, gy, S * 0.03 * z, S, ss(12.5, 13.7, m.b), 81, ACC);
      const hx = gx + (home.x - gx) * z;
      const hy = gy + (home.y - gy) * z;
      reticle(c, hx, hy, S * 0.012 * z, S, ss(14, 15, m.b), 85);
    },
    notes(m) {
      const z = 1.55 - 0.55 * ease(ss(0, 0.85, m.p));
      return [
        note('g-heart', 'THE HEART', (gx + S * 0.055 * z) / w, (gy - S * 0.035 * z) / h, ss(13, 14, m.b), { tone: 'accent' }),
        note('g-home', 'HOME', (gx + (home.x - gx) * z + S * 0.03 * z) / w, (gy + (home.y - gy) * z) / h, ss(14.5, 15.5, m.b), { tone: 'ink' }),
      ];
    },
  };

  // ------------------------------------------------------------ 4. its star-making, as a curve over its life
  const box = land ? { x0: w * 0.5, x1: w * 0.88, y0: h * 0.2, y1: h * 0.62 } : { x0: w * 0.1, x1: w * 0.9, y0: h * 0.18, y1: h * 0.46 };
  const ETA0 = 7.5;
  const etaX = (eta: number) => box.x0 + ((eta - ETA0) / (14.2 - ETA0)) * (box.x1 - box.x0);
  const sfr = (eta: number) => {
    const t = Math.pow(10, eta);
    // a rise over the first few billion years, a long decline since as the gas runs out
    return Math.pow(t / 3e9, 1.1) / (1 + Math.pow(t / 3e9, 2.05));
  };
  let peak = 0;
  for (let e = ETA0; e <= 14.2; e += 0.05) peak = Math.max(peak, sfr(e));
  const curve: Pt[] = Array.from({ length: 180 }, (_, i) => {
    const e = ETA0 + ((14.2 - ETA0) * i) / 179;
    return [etaX(e), box.y1 - (sfr(e) / peak) * (box.y1 - box.y0) * 0.92] as const;
  });
  const now = 13.954;
  const graph: Scene = {
    from: 17,
    to: 23.5,
    fade: 1.5,
    draw(c, m) {
      layer(c, farSky.get(), w, h, M, 0, 0, 1.15, 0.3);
      // the galaxy, set back and dimmed behind the curve
      c.save();
      if (land) c.translate(-w * 0.12 * ease(m.p * 2), 0);
      drawGalaxy(c, 1 - 0.1 * ease(m.p * 2), 0.04 + 0.02 * m.p, 0.45);
      c.restore();
      const show = ss(17.3, 18.5, m.b);
      c.save();
      c.globalAlpha = show;
      c.strokeStyle = 'rgba(230,220,203,0.4)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(box.x0, box.y0);
      c.lineTo(box.x0, box.y1);
      c.lineTo(box.x1, box.y1);
      c.stroke();
      c.font = `${Math.max(10, S * 0.0135)}px "IBM Plex Mono", monospace`;
      c.fillStyle = 'rgba(230,220,203,0.62)';
      c.textAlign = 'center';
      for (const e of [8, 10, 12, 14]) {
        c.fillRect(etaX(e) - 0.5, box.y1, 1, S * 0.008);
        c.fillText(`η ${e}`, etaX(e), box.y1 + S * 0.03);
      }
      c.restore();
      const drawn = ss(18, 21.5, m.b);
      c.save();
      c.beginPath();
      c.rect(box.x0, box.y0 - 2, (box.x1 - box.x0) * drawn, box.y1 - box.y0 + 2);
      c.clip();
      c.beginPath();
      c.moveTo(curve[0][0], box.y1);
      for (const p of curve) c.lineTo(p[0], p[1]);
      c.lineTo(curve[curve.length - 1][0], box.y1);
      c.closePath();
      c.fillStyle = 'rgba(242,138,79,0.14)';
      c.fill();
      c.restore();
      ink(c, curve, drawn, { width: S * 0.0026, color: ACC, seed: 21, alpha: 0.95 * show });
      const at = ss(21.5, 22.3, m.b);
      if (at > 0) {
        const x = etaX(now);
        ink(c, [[x, box.y1], [x, box.y0 + (box.y1 - box.y0) * 0.3]], at, { width: S * 0.0016, color: INK, seed: 22, alpha: 0.7 });
        glow(c, x, box.y1, S * 0.022 * (1 + 0.25 * Math.sin(m.t * 5)), ACC, 0.75 * at);
      }
    },
    notes(m) {
      return [
        note('sfr', 'STARS BORN · PER YEAR', box.x0 / w, (box.y0 - S * 0.03) / h, ss(17.5, 18.5, m.b), { tone: 'dim' }),
        note('sfr-peak', 'THE GALAXY’S YOUTH', (etaX(9.55) + S * 0.02) / w, (box.y0 + S * 0.02) / h, ss(19.5, 20.5, m.b), { tone: 'ink' }),
        note('now', 'NOW', (etaX(now) - S * 0.012) / w, (box.y0 + (box.y1 - box.y0) * 0.3) / h, ss(22, 22.8, m.b), { tone: 'accent', align: 'r' }),
      ];
    },
  };

  // ------------------------------------------------------------ 5. a generation of stars, on the H–R diagram
  const hw = land ? Math.min(w * 0.6, S * 1.2) : w * 0.84;
  const hh = land ? hw * 0.6 : hw * 0.95;
  const hx0 = (w - hw) / 2 + (land ? w * 0.02 : 0);
  const hy0 = land ? h * 0.17 : h * 0.2;
  const LT0 = 4.62;
  const LT1 = 3.15;
  const px = (logT: number) => hx0 + ((LT0 - logT) / (LT0 - LT1)) * hw;
  const py = (logL: number) => hy0 + ((4 - logL) / 9) * hh;
  const sweep = (m: Moment) => 7.0 + (now - 7.0) * Math.pow(ss(25.2, 34.6, m.b), 1.35);
  const ghost: Pt[] = Array.from({ length: 60 }, (_, i) => {
    const mass = 0.08 * Math.pow(20 / 0.08, i / 59);
    return [px(Math.log10(msT(mass))), py(Math.log10(msL(mass)))] as const;
  });
  const hrShot: Scene = {
    from: 23,
    to: 36.5,
    fade: 1.5,
    draw(c, m) {
      layer(c, farSky.get(), w, h, M, 0, 0, 1.15, 0.28);
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
      for (const s of pop.stars) {
        const pt = pop.at(s, eta);
        if (pt.a <= 0.01 || pt.logL < -5.2 || pt.logL > 4.6) continue;
        const cold = ss(LT1, LT1 + 0.12, pt.logT);
        if (cold <= 0 || pt.logT > LT0 + 0.05) continue;
        const sz = pt.logL > 1.5 ? 3 : pt.logL > -0.5 ? 2 : pt.logL > -2.6 ? 1 : 0;
        const spr = sprites[sz];
        // (many lie on top of one another: each faint, so the crowd glows in its own colour)
        c.globalAlpha = show * pt.a * cold * (0.32 + 0.2 * Math.sin(m.t * 2.2 + s.k * 60) ** 2) * (pt.kind === 'wd' ? 0.8 : 1);
        put(c, tint(spr, kelvin(Math.pow(10, pt.logT))), px(pt.logT), py(pt.logL), pr);
      }
      c.restore();
    },
    notes(m) {
      const lab = ss(25, 26.5, m.b);
      const late = ss(32, 34, m.b);
      return [
        note('hr-t', 'TEMPERATURE', (hx0 + hw / 2) / w, (hy0 + hh + S * 0.065) / h, lab * 0.9, { align: 'c', tone: 'dim' }),
        note('hr-l', 'LUMINOSITY · SUNS', hx0 / w, (hy0 - S * 0.035) / h, lab * 0.9, { tone: 'dim' }),
        note('hr-ms', 'MAIN SEQUENCE', px(4.15) / w, py(2.6) / h, lab * (1 - late * 0.6), { tone: 'ink' }),
        note('hr-wd', 'WHITE DWARFS', px(4.12) / w, py(-3.4) / h, ss(27, 28.5, m.b) * (1 - ss(33, 35, m.b) * 0.7), { tone: 'ink' }),
        note('hr-rd', 'THE LAST RED DWARFS', px(3.5) / w, py(-1.9) / h, late, { tone: 'accent', align: 'c' }),
        note('hr-eta', timecode(sweep(m)), (hx0 + hw) / w, (hy0 + S * 0.01) / h, ss(24, 25, m.b), { align: 'r', tone: 'accent', size: 'm' }),
      ];
    },
  };

  // ------------------------------------------------------------ 6-8. one of them, a flare up close, across to its world
  const sx = land ? w * 0.56 : w * 0.5;
  const sy = land ? h * 0.5 : h * 0.44;
  const flare = { a: -0.72, at: 42 };
  const loops = [0.5, 0.75, 1].map((s, i) => {
    const a0 = flare.a - 0.1 * s - 0.03;
    const a1 = flare.a + 0.1 * s + 0.03;
    const top = 1.12 + 0.2 * s;
    return Array.from({ length: 40 }, (_, j) => {
      const u = j / 39;
      const a = a0 + (a1 - a0) * u;
      const r = 1 + (top - 1) * Math.sin(Math.PI * u) + 0.01 * Math.sin(u * 17 + i);
      return [Math.cos(a) * r, Math.sin(a) * r] as const;
    });
  });
  const flarePoint = (R: number, x: number, y: number): Pt => [x + Math.cos(flare.a) * R * 0.95, y + Math.sin(flare.a) * R * 0.95];
  /** The star at (x, y), radius R, as it is at this moment: seething, its rim, the flare. */
  const drawStar = (c: Ctx, m: Moment, x: number, y: number, R: number) => {
    const breathe = 1 + 0.02 * Math.sin(m.t * 1.3);
    const fl = ss(flare.at, flare.at + 0.8, m.b) * (1 - ss(flare.at + 1.2, flare.at + 5, m.b));
    glow(c, x, y, R * 3.6, '#ff3a1c', 0.1 * breathe + 0.06 * fl);
    glow(c, x, y, R * 1.9, '#ff6a3a', 0.32 * breathe + 0.15 * fl);
    c.drawImage(star.get(), x - R, y - R, R * 2, R * 2);
    c.save();
    c.globalAlpha = 0.5 + 0.5 * Math.sin(m.t * 0.9);
    c.drawImage(star2.get(), x - R, y - R, R * 2, R * 2);
    c.restore();
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(255,120,80,${0.25 + 0.2 * fl})`;
    c.lineWidth = Math.max(1, S * 0.003);
    c.beginPath();
    c.arc(x, y, R * 1.003, 0, Math.PI * 2);
    c.stroke();
    c.restore();
    if (fl > 0) {
      const fx = x + Math.cos(flare.a) * R * 0.86;
      const fy = y + Math.sin(flare.a) * R * 0.86;
      glow(c, fx, fy, R * 0.5, '#ffd9a8', 0.9 * fl);
      glow(c, fx, fy, R * 0.16, '#ffffff', fl);
      const rise = ss(flare.at, flare.at + 2.2, m.b);
      loops.forEach((lp, i) => {
        const path = lp.map(([lx, ly]) => [x + lx * R, y + ly * R] as const);
        ink(c, path, rise, { width: Math.max(1, R * 0.013), color: '#ffc58f', seed: 41 + i, alpha: 0.9 * fl });
        c.save();
        c.globalCompositeOperation = 'lighter';
        ink(c, path, rise, { width: Math.max(2, R * 0.045), color: '#ff7a40', seed: 44 + i, alpha: 0.18 * fl });
        c.restore();
      });
    }
  };
  const leader = (R: number) => {
    const la = land ? -2.45 : -2.2;
    const p0: Pt = [sx + Math.cos(la) * R * 1.04, sy + Math.sin(la) * R * 1.04];
    const p1: Pt = [sx + Math.cos(la) * R * 1.3, sy + Math.sin(la) * R * 1.3];
    return [p0, p1, [p1[0] - S * 0.12, p1[1]]] as Pt[];
  };
  const gauge = (R: number) => ({ x: sx + Math.cos(0.9) * R * 1.32, y: sy + Math.sin(0.9) * R * 1.32, r: S * 0.045 });
  const starWide: Scene = {
    from: 36,
    to: 41.5,
    enter: 'zoom',
    fade: 1.5,
    assets: [star, star2],
    draw(c, m) {
      layer(c, farSky.get(), w, h, M, w * 0.02 * m.p, 0, 1.2, 0.45);
      const R = R4 * (1 + 0.04 * ease(m.p));
      drawStar(c, m, sx, sy, R);
      ink(c, leader(R), ss(37.5, 38.8, m.b), { width: S * 0.0016, color: INK, seed: 45, alpha: 0.7 });
      const g = gauge(R);
      ink(c, circlePath(g.x, g.y, g.r, 80, 46, -Math.PI / 2, Math.PI * 1.5), ss(38.5, 39.8, m.b), { width: S * 0.0018, color: INK, seed: 46, alpha: 0.3 });
      ink(c, circlePath(g.x, g.y, g.r, 30, 47, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.08), ss(39, 40.5, m.b), { width: S * 0.005, color: ACC, seed: 47, alpha: 0.95 });
    },
    notes(m) {
      const R = R4 * (1 + 0.04 * ease(m.p));
      const end = leader(R)[2];
      const g = gauge(R);
      const inst = ss(38.3, 39.3, m.b);
      return [
        note('st-a', 'RED DWARF', (end[0] - S * 0.008) / w, (end[1] - S * 0.022) / h, inst, { align: 'r', tone: 'accent', size: 'm' }),
        note('st-b', '0.09 M☉ · 2,800 K', (end[0] - S * 0.008) / w, (end[1] + S * 0.016) / h, inst * 0.9, { align: 'r' }),
        note('st-c', 'HYDROGEN LEFT · 8%', (g.x + S * 0.065) / w, g.y / h, ss(39.5, 40.5, m.b), { tone: 'dim' }),
      ];
    },
  };
  const flareClose: Scene = {
    from: 41,
    to: 46,
    enter: 'zoom',
    fade: 1,
    draw(c, m) {
      layer(c, farSky.get(), w, h, M, w * 0.03, 0, 1.25, 0.35);
      const R = R4 * 1.04;
      const [fx, fy] = flarePoint(R, sx, sy);
      // in on the flare: the limb across the frame, the loops rising off it
      const z = 2.5 + 0.25 * ease(m.p);
      camera(c, fx, fy, z, w * 0.5 - fx, h * 0.55 - fy, () => drawStar(c, m, sx, sy, R));
    },
    notes(m) {
      return [
        note('fl', 'FLARE', 0.5 + (S * 0.16) / w, 0.3, ss(42.5, 43.2, m.b) * (1 - ss(44.8, 45.8, m.b)), { tone: 'accent', size: 'm' }),
        note('fl-b', 'THE STAR’S LIGHT DOUBLED FOR AN HOUR', 0.5 + (S * 0.16) / w, 0.3 + (S * 0.03) / h, ss(43, 43.8, m.b) * (1 - ss(44.8, 45.8, m.b)), { tone: 'dim' }),
      ];
    },
  };

  // the world: lit from the side, its towns along the night's edge
  const wx = land ? w * 0.47 : w * 0.5;
  const wy = land ? h * 0.5 : h * 0.47;
  const drawWorld = (c: Ctx, x: number, y: number, R: number) => {
    const wd = world.get();
    glow(c, x + LIGHT[0] * R * 0.2, y - LIGHT[1] * R * 0.2, R * 1.35, '#ff7a4a', 0.12);
    c.drawImage(wd.canvas, x - R, y - R, R * 2, R * 2);
  };
  const across: Scene = {
    from: 45.5,
    to: 50,
    fade: 1,
    assets: [map, world],
    draw(c, m) {
      // the camera swings from the star to the world: the star goes off to the right, the world comes in
      const u = ease(m.p);
      layer(c, farSky.get(), w, h, M, -w * 0.12 * u, 0, 1.2, 0.5);
      layer(c, nearSky.get(), w, h, M, -w * 0.25 * u, 0, 1.2, 0.6);
      drawStar(c, m, sx + w * 0.9 * u, sy, R4 * (1 - 0.35 * u));
      drawWorld(c, wx - w * 0.75 * (1 - u), wy, R5 * (0.75 + 0.25 * u));
    },
  };
  const graticule = (R: number, tilt: number) => {
    const out: Pt[][] = [];
    const project = (la: number, lo: number): [number, number, number] => {
      const x = Math.cos(la) * Math.sin(lo);
      const y0 = Math.sin(la);
      const z0 = Math.cos(la) * Math.cos(lo);
      return [x, y0 * Math.cos(tilt) - z0 * Math.sin(tilt), y0 * Math.sin(tilt) + z0 * Math.cos(tilt)];
    };
    for (const lat of [-60, -30, 0, 30, 60]) {
      let pts: Pt[] = [];
      for (let i = 0; i <= 64; i++) {
        const [x, y, z] = project((lat * Math.PI) / 180, (i / 64) * Math.PI * 2);
        if (z > 0) pts.push([wx + x * R, wy - y * R]);
        else {
          if (pts.length > 1) out.push(pts);
          pts = [];
        }
      }
      if (pts.length > 1) out.push(pts);
    }
    for (let lon = 0; lon < 180; lon += 30) {
      const pts: Pt[] = [];
      for (let i = 0; i <= 64; i++) {
        const [x, y, z] = project(-Math.PI / 2 + (i / 64) * Math.PI, ((lon + 15) * Math.PI) / 180);
        if (z > 0) pts.push([wx + x * R, wy - y * R]);
      }
      if (pts.length > 1) out.push(pts);
    }
    return out;
  };
  const grid = graticule(R5, 0.28);
  const sunAt: Pt = [wx + LIGHT[0] * S * 1.1, wy - LIGHT[1] * S * 1.1];
  const wind = Array.from({ length: Math.round(260 * k) + 60 }, (_, i) => {
    const r = new Rng(500 + i);
    return { y: r.range(-1.6, 1.6), v: r.range(0.6, 1.4), o: r.next(), len: r.range(0.02, 0.07) };
  });
  const strip = Array.from({ length: Math.round(220 * k) + 40 }, (_, i) => {
    const r = new Rng(900 + i);
    return { a: r.range(Math.PI * 0.6, Math.PI * 1.4), v: r.range(0.25, 0.8), o: r.next() };
  });
  /** The star's wind streaming past the world, bending round what is left of its field, and the air dragged off the night side. */
  const drawWind = (c: Ctx, m: Moment, x0: number, y0: number, R: number) => {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.lineWidth = Math.max(1, S * 0.0014);
    for (const p of wind) {
      const u = (p.o + m.t * 0.11 * p.v) % 1;
      const x = x0 + R * 4 - u * R * 8;
      let y = y0 + p.y * R;
      const dx = x - x0;
      const dy = y - y0;
      const d = Math.hypot(dx, dy);
      const bow = R * 1.22;
      if (d < bow * 1.6 && dx > -R * 0.4) y += Math.sign(dy || 1) * (bow * 1.6 - d) * 0.55;
      c.strokeStyle = `rgba(255,180,130,${0.22 * Math.sin(Math.PI * u)})`;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + p.len * R * 2.5, y);
      c.stroke();
    }
    for (const s of strip) {
      const u = (s.o + m.t * 0.06 * s.v) % 1;
      const r = R * (1.02 + u * 1.4);
      const x = x0 + Math.cos(s.a) * r - u * R * 0.6;
      const y = y0 + Math.sin(s.a) * r * 0.8;
      c.fillStyle = `rgba(170,195,235,${0.4 * (1 - u)})`;
      c.fillRect(x, y, Math.max(1, S * 0.0018), Math.max(1, S * 0.0018));
    }
    c.restore();
  };
  const worldWide: Scene = {
    from: 49.5,
    to: 56,
    fade: 1,
    draw(c, m) {
      const u = ease(m.p);
      layer(c, farSky.get(), w, h, M, -w * 0.12 - w * 0.02 * u, 0, 1.2, 0.5);
      layer(c, nearSky.get(), w, h, M, -w * 0.25 - w * 0.04 * u, 0, 1.2, 0.6);
      glow(c, sunAt[0], sunAt[1], S * 0.5, '#ff4a26', 0.16);
      const z = 1 + 0.14 * u;
      camera(c, wx, wy, z, 0, 0, () => {
        drawWind(c, m, wx, wy, R5);
        drawWorld(c, wx, wy, R5);
        grid.forEach((g2, i) => ink(c, g2, ss(50.5 + i * 0.22, 53 + i * 0.22, m.b), { width: Math.max(1, S * 0.0011), color: INK, seed: 60 + i, alpha: 0.22 }));
      });
    },
    notes(m) {
      const R = R5 * (1 + 0.14 * ease(m.p));
      return [
        note('w-day', 'DAY', (wx + R * 0.62) / w, (wy - R * 1.04) / h, ss(51.5, 52.5, m.b) * 0.9, { tone: 'dim', align: 'c' }),
        note('w-night', 'NIGHT', (wx - R * 0.66) / w, (wy - R * 1.04) / h, ss(52, 53, m.b) * 0.9, { tone: 'dim', align: 'c' }),
        note('w-lock', 'ONE FACE TO ITS STAR', (wx + R * 1.12) / w, (wy + R * 0.5) / h, ss(53, 54, m.b), { tone: 'ink' }),
      ];
    },
  };
  // close on the night side's edge: the towns, the wind, the air going
  const townsAt: Pt = [wx - R5 * 0.42, wy + R5 * 0.05];
  const lightsClose: Scene = {
    from: 55.5,
    to: 61,
    enter: 'zoom',
    fade: 1,
    draw(c, m) {
      const u = ease(m.p);
      layer(c, farSky.get(), w, h, M, -w * 0.16, 0, 1.3, 0.4);
      const z = 1.9 + 0.2 * u;
      camera(c, townsAt[0], townsAt[1], z, w * 0.5 - townsAt[0], h * 0.5 - townsAt[1], () => {
        drawWorld(c, wx, wy, R5);
        drawWind(c, m, wx, wy, R5);
      });
    },
    notes(m) {
      return [note('w-home', 'OUR SETTLEMENTS', 0.5 - (S * 0.12) / w, 0.5 + (S * 0.16) / h, ss(56.5, 57.5, m.b), { tone: 'accent', align: 'r' })];
    },
  };

  // ------------------------------------------------------------ 9. leaving
  const hr = Math.max(w, h) * 1.4;
  const hx = w * 0.5;
  const hcy = h * 0.68 + hr;
  const lift: Pt[] = Array.from({ length: 80 }, (_, i) => {
    const u = i / 79;
    return [w * (0.36 + 0.34 * u + 0.04 * Math.sin(u * 2.6)), h * (0.7 - 0.42 * u - 0.12 * u * u)] as const;
  });
  const towns = Array.from({ length: Math.round(160 * k) + 40 }, (_, i) => {
    const r = new Rng(700 + i);
    return { a: r.range(-0.42, 0.42), d: Math.pow(r.next(), 1.5) * 0.1, b: r.next(), s: r.range(0.6, 1.6) };
  });
  const leaving: Scene = {
    from: 60.5,
    to: 66.5,
    fade: 1.5,
    draw(c, m) {
      const tiltUp = ease(m.p);
      layer(c, nearSky.get(), w, h, M, 0, h * 0.05 * tiltUp, 1.05, 1);
      layer(c, farSky.get(), w, h, M, 0, h * 0.025 * tiltUp, 1.02, 0.9);
      const cy = hcy + h * 0.1 * tiltUp;
      const sunX = hx + Math.cos(-1.32) * hr * 1.005;
      const sunY = cy + Math.sin(-1.32) * hr * 1.005;
      glow(c, sunX, sunY + S * 0.02, S * 0.7, '#ff4a1e', 0.22);
      glow(c, sunX, sunY + S * 0.03, S * 0.18, '#ffb98a', 0.45);
      c.save();
      c.beginPath();
      c.arc(hx, cy, hr, 0, Math.PI * 2);
      c.fillStyle = '#040302';
      c.fill();
      c.restore();
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (const [wd, al] of [
        [S * 0.004, 0.55],
        [S * 0.02, 0.18],
        [S * 0.07, 0.06],
      ] as const) {
        const grd = c.createLinearGradient(0, 0, w, 0);
        for (let i = 0; i <= 10; i++) {
          const x = i / 10;
          const nearSun = Math.exp(-Math.pow((x - sunX / w) / 0.16, 2));
          grd.addColorStop(x, `rgba(255,${Math.round(110 + 100 * nearSun)},${Math.round(70 + 70 * nearSun)},${al * (0.3 + 1.6 * nearSun)})`);
        }
        c.strokeStyle = grd;
        c.lineWidth = wd;
        c.beginPath();
        c.arc(hx, cy, hr + wd * 0.25, -Math.PI / 2 - 0.7, -Math.PI / 2 + 0.7);
        c.stroke();
      }
      for (const t of towns) {
        const a = -Math.PI / 2 + t.a;
        const r = hr * (1 - 0.004 - t.d * 0.25);
        c.fillStyle = `rgba(255,205,140,${(0.25 + 0.6 * t.b) * (1 - t.d * 8)})`;
        const sz = Math.max(1, S * 0.0016 * t.s);
        c.fillRect(hx + Math.cos(a) * r, cy + Math.sin(a) * r, sz, sz * 0.6);
      }
      c.restore();
      const go = ss(60.9, 66.3, m.b);
      const i = Math.min(lift.length - 2, Math.floor(go * (lift.length - 1)));
      const [x, y] = lift[i];
      const [x2, y2] = lift[i + 1];
      c.save();
      c.globalCompositeOperation = 'lighter';
      ink(c, lift, go, { width: S * 0.008, color: '#ff7a40', seed: 70, alpha: 0.12 });
      c.restore();
      ink(c, lift, go, { width: S * 0.0022, color: '#ffc58f', seed: 71, alpha: 0.7 });
      ship(c, x, y, Math.atan2(y2 - y, x2 - x), S * 0.15 * (1 - 0.6 * go), 0.75 + 0.25 * Math.sin(m.t * 30) ** 2);
    },
  };

  return {
    numeral: 'I',
    title: 'The Long Dusk',
    sub: 'Age I · the Late Stelliferous Era',
    titleAt: 66,
    eta: [Math.log10(9.0e13), 13.99],
    narration: [
      { from: 2.5, to: 9.5, text: 'Ninety trillion years after the first light,' },
      { from: 11, to: 22.5, text: 'the galaxy has run out of gas to make new stars.' },
      { from: 25, to: 35.5, text: 'Only the smallest red dwarfs still burn, and they are near the end of their fuel.' },
      { from: 37.5, to: 48, text: 'Your world circles one of them.' },
      { from: 50, to: 60.5, text: 'Its core is cooling and its magnetic field is failing, and the star’s wind has begun to strip the air away.' },
    ],
    scenes: [skyWide, intoBand, galaxyShot, graph, hrShot, starWide, flareClose, across, worldWide, lightsClose, leaving],
    card(c, m) {
      layer(c, farSky.get(), w, h, M, 0, 0, 1.0 + 0.04 * m.p, 0.5);
      glow(c, w * 0.5, h * 0.5, S * 0.6, '#ff4a26', 0.08 * (1 - m.p));
    },
  };
});
