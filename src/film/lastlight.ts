import { Rng } from '../game/rng';
import { circlePath, glow, ink, ss, type Pt } from './draw';
import type { FilmDef } from './films';
import { falseColour, landscape, layer, put, reticle, ship, skyRatio } from './kit';
import { HEAT_LUT, Lazy, css, dotSprite, heatOf, kelvin, paintBanded, paintElliptical, paintLens, paintSky, paintStar, tint } from './paint';
import { ease, note, reel2, type Scene } from './reel';
import { pow10 } from '../ui/fmt';
import { brownCoolingK, dwarfCoolingK } from '../game/physics';
import type { Primary } from '../game/types';

// The Degenerate Age (Age II), second cut: the last red dwarf turning blue as it burns out and
// shrinking to a white dwarf; the dark that is left; the corpses laid out as specimens (a white
// dwarf, a brown dwarf, a pulsar, a black hole bending the stars behind it); dark matter falling
// into a dwarf and keeping it faintly warm; two brown dwarfs colliding into a small new star; two
// white dwarfs merging into a brilliant, brief helium star; the galaxy flinging its remnants into
// the void; the proton's open question; a settlement round an ember; the title. The words are the
// age's own introduction. (14 Oct, the player: more dimming as the age begins, and the remnants
// "visibly cooling with stated temps lowering as the time goes by": the last red dwarfs go out one
// by one as the sky darkens, and the specimens cool by the game's own laws as their age runs on.
// The version first sent is kept in saved/lastlight-v1.ts.)

const INK = '#e6dccb';
const ACC = '#93c4ff';
const SOFT = '#cfe3ff';

export const LAST_LIGHT2: FilmDef = reel2({ id: 'last_light', name: 'The Last Light', bpm: 90, beats: 70, accent: ACC }, (w, h, S, k, args) => {
  const pr = args.pr ?? 1;
  const land = landscape(w, h);
  const M = 1.3;
  const dpx = (x: number) => Math.round(x * pr);
  const spx = (x: number) => Math.round(x * skyRatio(w, h, M, pr));
  const scale = Math.max(1, (S / 900) * pr);
  const area = (w * h) / (1600 * 900);

  // ------------------------------------------------------------ paintings
  // the sky of the dead: faint white dwarfs, dimmer cinders, no red dwarfs left
  const sky = paintSky(spx(w * M), spx(h * M), {
    seed: 201,
    n: Math.round(2600 * k * area),
    temps: [
      [40, 7000],
      [30, 11000],
      [20, 4800],
      [10, 3000],
    ],
    band: { color: [0.55, 0.62, 0.8], alpha: 0.22, angle: land ? -0.3 : -1.1 },
    scale,
  });
  const nearSky = paintSky(spx(w * M), spx(h * M), {
    seed: 202,
    n: Math.round(140 * k * area) + 20,
    temps: [
      [3, 9000],
      [1, 15000],
    ],
    spikes: 2,
    scale: scale * 1.1,
  });
  const R1 = S * (land ? 0.26 : 0.24);
  const red = paintStar(dpx(R1 * 2), { T: 3000, seed: 203, limb: [0.5, 0.3], spots: 3, spotSize: 0.07, cells: 32, grain: 0.32 });
  const blue = paintStar(dpx(R1 * 2), { T: 7600, seed: 203, limb: [0.45, 0.25], spots: 0, cells: 32, grain: 0.22 });
  const spec = S * (land ? 0.075 : 0.085);
  const wd = paintStar(dpx(spec * 2), { T: 10500, seed: 204, limb: [0.35, 0.2], cells: 18, grain: 0.1 });
  const bd = paintBanded(dpx(spec * 2.4), { seed: 205, T: 1100, bands: 8 });
  // once they are too cold to see: the same discs by their faint heat, at four levels of warmth
  // (the thermal palette from cream down to violet), so the instruments' picture cools too
  const heatLevels = (img: Lazy<HTMLCanvasElement>, gains: number[]) =>
    new Lazy(function* () {
      const src = img.get();
      const out: HTMLCanvasElement[] = [];
      for (const g of gains) {
        yield;
        out.push(heatOf(src, g));
      }
      return out;
    });
  const wdHeat = heatLevels(wd, [1.25, 0.8, 0.5, 0.3]);
  const bdHeat = heatLevels(bd, [2.3, 1.45, 0.9, 0.5]);
  /** A blackbody's colour at T, as hex (what glow() takes). */
  const kHex = (T: number) => `#${kelvin(T).map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
  /** Where a temperature below sight falls among the heat views: 0 at 560 K, 3 at about 1 K. */
  const heatLevel = (T: number) => Math.max(0, Math.min(3, ((Math.log10(560) - Math.log10(Math.max(1, T))) / Math.log10(560)) * 3));
  /** The thermal palette's colour for a point source at T (for the neutron star). */
  const heatHex = (T: number) => {
    const i = Math.round(Math.max(0, Math.min(1, 0.85 - heatLevel(T) * 0.22)) * 255) * 3;
    return `#${[HEAT_LUT[i], HEAT_LUT[i + 1], HEAT_LUT[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  };
  const ember = paintStar(dpx(S * 0.2 * 2), { T: 1600, seed: 206, limb: [0.4, 0.3], cells: 20, grain: 0.15 });
  const bdA = paintBanded(dpx(S * 0.1 * 2), { seed: 207, T: 1050, bands: 9, tilt: 0.3 });
  const bdB = paintBanded(dpx(S * 0.08 * 2), { seed: 208, T: 950, bands: 7, tilt: -0.2 });
  const newStar = paintStar(dpx(S * 0.07 * 2), { T: 3300, seed: 209, limb: [0.5, 0.3], cells: 26, grain: 0.3 });
  const GAL = Math.round(Math.min(2200, S * 1.3 * pr));
  const galaxy = paintElliptical(GAL, { seed: 210, n: Math.round(60000 * k), scale: Math.max(1, GAL / 1300), flat: 0.72, angle: 0.3 });

  // the specimens' places: in a row on a wide screen, two by two on a phone
  const slots: Pt[] = land
    ? [0.2, 0.4, 0.6, 0.8].map((x) => [w * x, h * 0.45] as const)
    : [
        [w * 0.3, h * 0.32],
        [w * 0.7, h * 0.32],
        [w * 0.3, h * 0.6],
        [w * 0.7, h * 0.6],
      ];
  // the black hole's lens, over the sky as the specimen shot draws it (the sky's canvas at zoom 1.1)
  const lensZ = 1.1;
  const toSky = (p: Pt): Pt => {
    const lw = w * M * lensZ;
    const lh = h * M * lensZ;
    const img = { w: spx(w * M), h: spx(h * M) };
    return [((p[0] - (w / 2 - lw / 2)) / lw) * img.w, ((p[1] - (h / 2 - lh / 2)) / lh) * img.h];
  };
  const holeAt = slots[3];
  const holeSky = toSky(holeAt);
  const skyPerScreen = spx(w * M) / (w * M * lensZ);
  const lens = new Lazy(function* () {
    const bg = sky.get();
    yield;
    return yield* (function* () {
      const l = paintLens(bg, holeSky[0], holeSky[1], spec * 0.55 * skyPerScreen, { reach: 4.2, ring: [0.85, 0.9, 1], ringGain: 0.9 });
      while (!l.warm(performance.now() + 2)) yield;
      return l.get();
    })();
  });

  // ------------------------------------------------------------ 1. the last red dwarf: blue, then a white dwarf
  const cx = w * 0.5;
  const cy = h * 0.46;
  // the last red dwarfs elsewhere, going out one by one as the age begins (clear of the middle and the words)
  const lastStars: { x: number; y: number; r: number; out: number; col: string }[] = [];
  {
    const rng = new Rng(219);
    for (let i = 0; lastStars.length < Math.round(46 * k) + 14 && i < 900; i++) {
      const x = rng.next() * w;
      const y = rng.next() * h * 0.8;
      if (Math.hypot(x - cx, y - cy) < R1 * 1.9) continue;
      lastStars.push({ x, y, r: S * rng.range(0.004, 0.011), out: rng.range(0.6, 5.2), col: rng.chance(0.6) ? '#ff8a5a' : '#ffb070' });
    }
  }
  /** How bright the sky of the dead is: the Dusk's end at first, then darker as the last stars go. */
  const skyA = (b: number) => 0.55 - 0.37 * ease(ss(0.4, 6.6, b));
  const lastRed: Scene = {
    from: 0,
    to: 7,
    assets: [sky, red, blue],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.05 + 0.03 * m.p, skyA(m.b));
      for (const st of lastStars) {
        const on = 1 - ss(st.out, st.out + 0.55, m.b);
        if (on <= 0) continue;
        glow(c, st.x, st.y, st.r * 3.2, st.col, 0.45 * on);
        glow(c, st.x, st.y, st.r * 0.8, '#fff1e0', 0.7 * on);
      }
      // it burns out hotter: red to blue-white, and brighter, then falls in on itself
      const hot = ss(0.8, 4.2, m.b);
      const shrink = ss(4.2, 5.6, m.b);
      const R = R1 * (1 + 0.06 * hot) * (1 - 0.97 * ease(shrink));
      const flash = ss(5.3, 5.7, m.b) * (1 - ss(5.7, 6.8, m.b));
      const col = hot < 0.5 ? '#ff6a3a' : '#9cc4ff';
      glow(c, cx, cy, R1 * 3 * (1 - 0.6 * shrink), col, (0.22 + 0.2 * hot) * (1 - shrink * 0.8));
      if (R > 1) {
        c.drawImage(red.get(), cx - R, cy - R, R * 2, R * 2);
        c.save();
        c.globalAlpha = hot;
        c.drawImage(blue.get(), cx - R, cy - R, R * 2, R * 2);
        c.restore();
      }
      glow(c, cx, cy, S * 0.25, '#dfeaff', 0.9 * flash);
      // what is left: a white dwarf, a hot point
      const wdOn = ss(5.4, 6.2, m.b);
      if (wdOn > 0) {
        glow(c, cx, cy, S * 0.05, SOFT, 0.7 * wdOn);
        const sp = dotSprite(6 * scale);
        put(c, tint(sp, [0.9, 0.95, 1]), cx, cy, pr);
      }
    },
    notes(m) {
      return [
        note('lr-a', 'THE LAST RED DWARFS · GOING OUT', 0.5, (cy + R1 * 1.35) / h, ss(0.8, 1.6, m.b) * (1 - ss(3.8, 4.4, m.b)), { align: 'c', tone: 'dim' }),
        note('lr-b', 'BURNING OUT · HOTTER AND BLUER', 0.5, (cy + R1 * 1.35) / h, ss(3.2, 3.9, m.b) * (1 - ss(5, 5.6, m.b)), { align: 'c', tone: 'accent' }),
        note('lr-c', 'A WHITE DWARF', 0.5, (cy + S * 0.08) / h, ss(6, 6.6, m.b), { align: 'c', tone: 'ink' }),
      ];
    },
  };

  // ------------------------------------------------------------ 2. the dark that is left
  const cinders = Array.from({ length: Math.round(18 * k) + 8 }, (_, i) => {
    const r = new Rng(220 + i);
    return { x: r.range(0.06, 0.94) * w, y: r.range(0.1, 0.8) * h, s: S * r.range(0.004, 0.012), T: r.chance(0.6) ? r.range(7000, 14000) : r.range(900, 1400) };
  });
  const dark: Scene = {
    from: 6.5,
    to: 12.5,
    fade: 1.5,
    notes(m) {
      return [note('dk-a', 'WHITE DWARFS, BROWN DWARFS · COOLING', 0.5, land ? 0.12 : 0.1, ss(8, 8.8, m.b) * (1 - ss(11.6, 12.4, m.b)), { align: 'c', tone: 'dim' })];
    },
    draw(c, m) {
      const u = ease(m.p);
      layer(c, sky.get(), w, h, M, -w * 0.03 * u, 0, 1.1, 0.2);
      layer(c, nearSky.get(), w, h, M, -w * 0.06 * u, 0, 1.12, 0.4);
      // the cinders cooling as we watch: redder and fainter
      const cool = 1 - 0.45 * ss(6.8, 12.5, m.b);
      for (const s of cinders) {
        const x = s.x - w * 0.045 * u;
        const T = s.T * cool;
        if (s.T > 3000) glow(c, x, s.y, s.s * 5, kHex(T), 0.55 * Math.pow(cool, 1.5));
        else glow(c, x, s.y, s.s * 4, kHex(T), 0.42 * Math.pow(cool, 2.5));
      }
    },
  };

  // ------------------------------------------------------------ 3. the specimens
  const rotBeam = (t: number) => t * 2.4;
  const field: Pt[][] = [0.5, 0.8, 1.15, 1.6].flatMap((L) =>
    [1, -1].map((side) =>
      Array.from({ length: 48 }, (_, i) => {
        // a dipole's field line: r = L sin²θ
        const th = 0.12 + (i / 47) * (Math.PI - 0.24);
        const r = L * Math.sin(th) ** 2;
        return [side * Math.sin(th) * r, -Math.cos(th) * r] as const;
      }),
    ),
  );
  // their age as the scene runs, a million years to a hundred trillion, and what each is at it, by
  // the game's own laws: Mestel's cooling, then the crystallised core's, for a white dwarf of 0.6
  // Suns (physics.ts, dwarfCoolingK); Burrows' fit for a brown dwarf of 0.05 (brownCoolingK); the
  // residual 7 × 10⁶ K / √t for a neutron star (its beams gone as it spins down, by 10⁹ years)
  const WD: Primary = { kind: 'white_dwarf', mass: 0.6 } as Primary;
  const BD: Primary = { kind: 'brown_dwarf', mass: 0.05 } as Primary;
  const ageAt = (b: number) => Math.pow(10, 6 + 8 * Math.min(1, Math.max(0, (b - 19.6) / 9.6)));
  const tempsAt = (b: number) => {
    const a = ageAt(b);
    return { wd: dwarfCoolingK(WD, a), bd: brownCoolingK(BD, a), ns: 7e6 / Math.sqrt(a), beams: 1 - ss(7.5, 9, Math.log10(a)) };
  };
  const kfmt = (T: number) => (T >= 1000 ? `${(Math.round(T / 100) * 100).toLocaleString('en-US')} K` : T >= 100 ? `${Math.round(T / 10) * 10} K` : T >= 10 ? `${Math.round(T)} K` : `${T.toFixed(1)} K`);
  /** How visible a body of temperature T still is (1 glowing, 0 seen only by its heat). */
  const visible = (T: number) => ss(560, 950, T);
  /** A disc painted at T0, drawn as it is at T: its blackbody colour and dimmer, or, once too cold to see, by its heat. */
  const cooled = (c: CanvasRenderingContext2D, img: HTMLCanvasElement, heat: HTMLCanvasElement[], x: number, y: number, R: number, T: number, T0: number, alpha: number) => {
    if (alpha <= 0) return;
    const v = visible(T);
    if (v > 0) {
      c.save();
      c.globalAlpha = alpha * v * Math.max(0.6, Math.min(1, Math.pow(T / T0, 0.3)));
      c.drawImage(img, x - R, y - R, R * 2, R * 2);
      c.globalCompositeOperation = 'color';
      c.fillStyle = css(kelvin(T));
      c.beginPath();
      c.arc(x, y, R * 0.98, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    if (v < 1) {
      // between the two views that bracket its warmth
      const f = heatLevel(T);
      const i0 = Math.min(2, Math.floor(f));
      const u = f - i0;
      c.save();
      c.globalAlpha = alpha * (1 - v);
      c.drawImage(heat[i0], x - R, y - R, R * 2, R * 2);
      if (u > 0) {
        c.globalAlpha = alpha * (1 - v) * u;
        c.drawImage(heat[i0 + 1], x - R, y - R, R * 2, R * 2);
      }
      c.restore();
    }
  };
  const specimens: Scene = {
    from: 18.3,
    to: 30.5,
    fade: 1.5,
    assets: [wd, bd, lens, wdHeat, bdHeat],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, lensZ, 0.45);
      const at = (i: number) => ss(18.8 + i * 1.6, 19.8 + i * 1.6, m.b);
      const T = tempsAt(m.b);
      // a white dwarf: white-hot when it is young, cooling: yellow, orange, red, then only its heat
      const [x0, y0] = slots[0];
      glow(c, x0, y0, spec * 3, kHex(T.wd), 0.3 * at(0) * visible(T.wd) * Math.min(1, T.wd / 6000 + 0.25));
      cooled(c, wd.get(), wdHeat.get(), x0, y0, spec * 0.5, T.wd, 10500, at(0));
      // a brown dwarf: never lit, glowing by its own heat, and less of it every year
      const [x1, y1] = slots[1];
      cooled(c, bd.get(), bdHeat.get(), x1, y1, spec * 1.2, T.bd, 1100, at(1));
      // a pulsar: a point spinning, its field's lines, its two beams sweeping round
      const [x2, y2] = slots[2];
      if (at(2) > 0) {
        c.save();
        c.globalAlpha = at(2);
        c.translate(x2, y2);
        c.rotate(0.35);
        field.forEach((ln, i) => ink(c, ln.map(([a, b]) => [a * spec, b * spec] as const), at(2), { width: Math.max(1, S * 0.0011), color: ACC, seed: 230 + i, alpha: 0.35 }));
        c.restore();
        const a = rotBeam(m.t) * (0.3 + 0.7 * T.beams);
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (const side of [0, Math.PI]) {
          const g2 = c.createRadialGradient(x2, y2, 0, x2, y2, spec * 2.2);
          g2.addColorStop(0, `rgba(210,225,255,${0.5 * at(2) * T.beams})`);
          g2.addColorStop(1, 'rgba(210,225,255,0)');
          c.fillStyle = g2;
          c.beginPath();
          c.moveTo(x2, y2);
          c.arc(x2, y2, spec * 2.2, a + side - 0.12, a + side + 0.12);
          c.closePath();
          c.fill();
        }
        c.restore();
        glow(c, x2, y2, spec * 0.5, kHex(T.ns), 0.9 * at(2) * visible(T.ns));
        if (visible(T.ns) < 1) glow(c, x2, y2, spec * 0.45, heatHex(T.ns), 0.85 * at(2) * (1 - visible(T.ns)));
      }
      // a black hole: nothing but the stars behind it bent into a ring round its shadow
      const [x3, y3] = slots[3];
      if (at(3) > 0) {
        const patch = lens.get();
        const sz = patch.width / skyPerScreen;
        c.save();
        c.globalAlpha = at(3) * 0.68;
        c.drawImage(patch, x3 - sz / 2, y3 - sz / 2, sz, sz);
        c.restore();
      }
      for (let i = 0; i < 4; i++) {
        const [x, y] = slots[i];
        ink(c, [[x - spec * 1.1, y + spec * 1.75], [x + spec * 1.1, y + spec * 1.75]], ss(19.2 + i * 1.6, 20.2 + i * 1.6, m.b), { width: Math.max(1, S * 0.0012), color: INK, seed: 240 + i, alpha: 0.45 });
      }
    },
    notes(m) {
      const T = tempsAt(m.b);
      const names = ['WHITE DWARF', 'BROWN DWARF', 'NEUTRON STAR', 'BLACK HOLE'];
      const heat = (t: number) => (visible(t) < 0.5 ? ' · BY ITS HEAT' : '');
      const facts = ['EARTH-SIZED', 'NEVER LIT', `CITY-SIZED · ${T.beams > 0.5 ? 'SPINNING' : T.beams > 0.02 ? 'SPINNING DOWN' : 'SPUN DOWN'}`, 'NO LIGHT OF ITS OWN'];
      const temps = [`${kfmt(T.wd)}${heat(T.wd)}`, `${kfmt(T.bd)}${heat(T.bd)}`, `${kfmt(T.ns)}${heat(T.ns)}`, '6 × 10⁻⁹ K'];
      const a = ageAt(m.b);
      const e = Math.floor(Math.log10(a) + 1e-9);
      const clock = `THEIR AGE · ${(a / Math.pow(10, e)).toFixed(1)}×${pow10(e)} YEARS`;
      return [
        note('sp-age', clock, 0.5, land ? 0.16 : 0.13, ss(19.2, 19.8, m.b) * (1 - ss(29.6, 30.4, m.b)), { align: 'c', tone: 'ink' }),
        note('sp-law', 'EACH COOLING AS IT AGES', 0.5, (land ? 0.16 : 0.13) + (S * 0.028) / h, ss(20.4, 21, m.b) * (1 - ss(29.6, 30.4, m.b)), { align: 'c', tone: 'dim' }),
        ...names.flatMap((n, i) => {
          const [x, y] = slots[i];
          const o = ss(19.4 + i * 1.6, 20.4 + i * 1.6, m.b);
          return [
            note(`sp-${i}`, n, x / w, (y + spec * 2.1) / h, o, { align: 'c', tone: 'accent' }),
            note(`sp-f${i}`, facts[i], x / w, (y + spec * 2.1 + S * 0.028) / h, o * 0.85, { align: 'c', tone: 'dim' }),
            note(`sp-t${i}`, temps[i], x / w, (y + spec * 2.1 + S * 0.058) / h, o, { align: 'c', tone: 'ink', size: 'm' }),
          ];
        }),
      ];
    },
  };

  // ------------------------------------------------------------ 4. dark matter keeping a dwarf warm
  const ex = land ? w * 0.52 : w * 0.5;
  const ey = h * 0.46;
  const ER = S * 0.2;
  const motes = Array.from({ length: Math.round(220 * k) + 60 }, (_, i) => {
    const r = new Rng(250 + i);
    return { a0: r.range(0, Math.PI * 2), r0: r.range(1.6, 3.6), sp: r.range(0.6, 1.4), ph: r.next(), tilt: r.range(0.3, 0.9) };
  });
  const darkMatter: Scene = {
    from: 12,
    to: 18.8,
    enter: 'zoom',
    fade: 1.5,
    assets: [ember],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.2, 0.32);
      // the ember: a dwarf long cooled, its faint heat shown as the instruments see it
      glow(c, ex, ey, ER * 2.4, '#8a5a8a', 0.18);
      falseColour(c, ember.get(), ex, ey, ER);
      // the halo's dark matter, captured on orbits that shrink through the star, annihilating at its heart
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (const p of motes) {
        const u = (p.ph + m.t * 0.09 * p.sp) % 1;
        const r = ER * p.r0 * (1 - 0.85 * u);
        const a = p.a0 + u * 7 * p.sp;
        const x = ex + Math.cos(a) * r;
        const y = ey + Math.sin(a) * r * p.tilt;
        const behind = Math.sin(a) < 0 && r < ER;
        if (behind) continue;
        c.fillStyle = `rgba(180,140,255,${0.5 * Math.sin(Math.PI * u)})`;
        c.fillRect(x, y, Math.max(1, S * 0.002), Math.max(1, S * 0.002));
      }
      c.restore();
      glow(c, ex, ey, ER * 0.5, '#b48cff', 0.28 + 0.08 * Math.sin(m.t * 3));
    },
    notes(m) {
      return [
        note('dm-a', 'WHITE DWARF · 63 K', (ex + ER * 1.5) / w, (ey - ER * 0.6) / h, ss(13, 14, m.b), { tone: 'accent' }),
        note('dm-b', 'SEEN BY ITS HEAT', (ex + ER * 1.5) / w, (ey - ER * 0.6 + S * 0.03) / h, ss(13.5, 14.5, m.b), { tone: 'dim' }),
        note('dm-c', 'DARK MATTER · CAPTURED, ANNIHILATING', (ex + ER * 1.5) / w, (ey + ER * 0.7) / h, ss(14.5, 15.5, m.b), { tone: 'ink' }),
      ];
    },
  };

  // ------------------------------------------------------------ 5. two brown dwarfs collide: a small star burns again
  const mx = w * 0.5;
  const my = h * 0.46;
  const collide: Scene = {
    from: 30,
    to: 38,
    fade: 1.5,
    assets: [bdA, bdB, newStar],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, w * 0.02 * m.p, 0, 1.15, 0.42);
      // the orbit shrinks as they spiral in (faster and faster), and they touch
      const meet = 35;
      const u = ss(30, meet, m.b);
      const sep = S * 0.36 * Math.pow(1 - u, 0.6) + S * 0.02;
      const ang = 1.3 + 9 * Math.pow(u, 1.7);
      const ra = S * 0.1;
      const rb = S * 0.08;
      const flash = ss(meet - 0.2, meet + 0.3, m.b) * (1 - ss(meet + 0.3, meet + 2, m.b));
      if (m.b < meet + 0.2) {
        const ax = mx + Math.cos(ang) * sep * 0.44;
        const ay = my + Math.sin(ang) * sep * 0.18;
        const bx = mx - Math.cos(ang) * sep * 0.56;
        const by = my - Math.sin(ang) * sep * 0.22;
        const order = Math.sin(ang) > 0 ? ['b', 'a'] : ['a', 'b'];
        for (const o of order) {
          if (o === 'a') c.drawImage(bdA.get(), ax - ra, ay - ra, ra * 2, ra * 2);
          else c.drawImage(bdB.get(), bx - rb, by - rb, rb * 2, rb * 2);
        }
        // their paths, inked behind them
        const trail: Pt[] = Array.from({ length: 40 }, (_, i) => {
          const uu = Math.max(0, u - i * 0.006);
          const s2 = S * 0.36 * Math.pow(1 - uu, 0.6) + S * 0.02;
          const a2 = 1.3 + 9 * Math.pow(uu, 1.7);
          return [mx + Math.cos(a2) * s2 * 0.44, my + Math.sin(a2) * s2 * 0.18] as const;
        });
        ink(c, trail, 1, { width: Math.max(1, S * 0.0012), color: INK, seed: 261, alpha: 0.25 });
      }
      glow(c, mx, my, S * 0.35, '#ffd6b0', 0.8 * flash);
      const lit = ss(meet + 0.2, meet + 1.6, m.b);
      if (lit > 0) {
        const R = S * 0.07 * (0.8 + 0.2 * lit);
        glow(c, mx, my, R * 3, '#ff6a3a', 0.3 * lit);
        c.save();
        c.globalAlpha = lit;
        c.drawImage(newStar.get(), mx - R, my - R, R * 2, R * 2);
        c.restore();
      }
    },
    notes(m) {
      return [note('cl-a', 'A RED DWARF, BORN OF TWO BROWN', 0.5, (my + S * 0.16) / h, ss(36, 37, m.b), { align: 'c', tone: 'accent' })];
    },
  };

  // ------------------------------------------------------------ 6. two white dwarfs merge: a brilliant, brief helium star
  const helium: Scene = {
    from: 37.5,
    to: 45,
    fade: 1.5,
    draw(c, m) {
      layer(c, sky.get(), w, h, M, -w * 0.02 * m.p, 0, 1.18, 0.42);
      const meet = 41.5;
      const u = ss(37.6, meet, m.b);
      const sep = S * 0.3 * Math.pow(1 - u, 0.5) + S * 0.005;
      const ang = 0.4 + 16 * Math.pow(u, 2);
      const sp = dotSprite(7 * scale);
      if (m.b < meet) {
        for (const side of [1, -1]) {
          const x = mx + Math.cos(ang) * sep * 0.5 * side;
          const y = my + Math.sin(ang) * sep * 0.2 * side;
          glow(c, x, y, S * 0.03, SOFT, 0.5);
          put(c, tint(sp, [0.92, 0.96, 1]), x, y, pr);
        }
        // the gravitational waves they shed as they close: rings going out, ever faster
        for (let i = 0; i < 6; i++) {
          const ph = (m.t * (0.6 + 2.4 * u) + i / 6) % 1;
          ink(c, circlePath(mx, my, S * 0.05 + ph * S * 0.5, 96, 270 + i, 0, Math.PI * 2, 0.4), 1, { width: Math.max(1, S * 0.001), color: ACC, seed: 270 + i, alpha: 0.25 * (1 - ph) });
        }
      }
      // the merged star: blazing blue-white, then going
      const blaze = ss(meet - 0.1, meet + 0.4, m.b);
      const fade = ss(meet + 1.5, meet + 3.5, m.b);
      if (blaze > 0) {
        glow(c, mx, my, S * 0.5, '#bcd6ff', 0.55 * blaze * (1 - fade * 0.7));
        glow(c, mx, my, S * 0.08, '#ffffff', blaze * (1 - fade * 0.6));
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 2; i++) {
          const L = S * (0.18 + 0.1 * i) * (1 - fade * 0.5);
          const grd = c.createLinearGradient(mx - L, my, mx + L, my);
          grd.addColorStop(0, 'rgba(200,220,255,0)');
          grd.addColorStop(0.5, `rgba(220,235,255,${0.6 * blaze * (1 - fade)})`);
          grd.addColorStop(1, 'rgba(200,220,255,0)');
          c.strokeStyle = grd;
          c.lineWidth = Math.max(1, S * 0.0018);
          c.beginPath();
          if (i === 0) {
            c.moveTo(mx - L, my);
            c.lineTo(mx + L, my);
          } else {
            c.moveTo(mx, my - L);
            c.lineTo(mx, my + L);
          }
          c.stroke();
        }
        c.restore();
      }
    },
    notes(m) {
      return [
        note('he-a', 'TWO WHITE DWARFS', 0.5, (my + S * 0.2) / h, ss(38, 39, m.b) * (1 - ss(41, 41.6, m.b)), { align: 'c', tone: 'dim' }),
        note('he-b', 'A HELIUM STAR · A FEW SHORT TURNS', 0.5, (my + S * 0.2) / h, ss(42.2, 43, m.b), { align: 'c', tone: 'accent' }),
      ];
    },
  };

  // ------------------------------------------------------------ 7. the galaxy flinging its remnants into the void
  const gx = w * 0.5;
  const gy = h * 0.47;
  const gsize = S * (land ? 1.0 : 1.1);
  const flung = Array.from({ length: Math.round(26 * k) + 10 }, (_, i) => {
    const r = new Rng(280 + i);
    return { a: r.range(0, Math.PI * 2), r0: r.range(0.03, 0.2), at: r.range(0, 1), v: r.range(0.5, 1.1), bend: r.range(-0.6, 0.6), T: r.chance(0.7) ? r.range(6000, 12000) : 1200 };
  });
  const flinging: Scene = {
    from: 44.5,
    to: 52,
    fade: 1.5,
    assets: [galaxy],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.1, 0.24);
      const z = 1 - 0.2 * ease(m.p);
      const img = galaxy.get();
      c.save();
      c.globalAlpha = 0.75;
      c.globalCompositeOperation = 'lighter';
      c.translate(gx, gy);
      c.scale(z, z);
      c.drawImage(img, -gsize / 2, -gsize / 2, gsize, gsize);
      c.restore();
      // the flung: close passes give a few remnants enough speed to leave for good
      c.save();
      c.globalCompositeOperation = 'lighter';
      // each one slung out on a slowly curving path, its trail fading behind it
      for (const f of flung) {
        const u = (f.at + m.t * 0.05 * f.v) % 1;
        const path: Pt[] = Array.from({ length: 24 }, (_, i) => {
          const uu = Math.max(0, u - (23 - i) * 0.012);
          const r = gsize * f.r0 * z + uu * uu * S * 0.75;
          const a = f.a + f.bend * uu;
          return [gx + Math.cos(a) * r, gy + Math.sin(a) * r * 0.75] as const;
        });
        const col = kelvin(f.T);
        ink(c, path, 1, { width: Math.max(1, S * 0.0012), color: `#${[0, 1, 2].map((j) => Math.round(col[j] * 255).toString(16).padStart(2, '0')).join('')}`, seed: 281, alpha: 0.5 * Math.sin(Math.PI * u) });
        const [hx, hy] = path[path.length - 1];
        glow(c, hx, hy, S * 0.006, '#dfeaff', 0.8 * Math.sin(Math.PI * u));
      }
      c.restore();
    },
    notes(m) {
      return [note('fl-a', 'CAST OUT · INTO THE VOID', (gx + gsize * 0.42) / w, (gy - gsize * 0.3) / h, ss(46, 47, m.b), { tone: 'accent' })];
    },
  };

  // ------------------------------------------------------------ 8. the protons themselves may not last
  const px = w * (land ? 0.36 : 0.5);
  const py = h * (land ? 0.45 : 0.36);
  const PR = S * 0.11;
  const quarks: Pt[] = [0, 1, 2].map((i) => [px + Math.cos(-Math.PI / 2 + (i * Math.PI * 2) / 3) * PR * 0.48, py + Math.sin(-Math.PI / 2 + (i * Math.PI * 2) / 3) * PR * 0.48] as const);
  const outA: Pt[] = [
    [px + PR * 1.1, py - PR * 0.2],
    [px + PR * 3.2, py - PR * 1.4],
  ];
  const outB: Pt[] = [
    [px + PR * 1.1, py + PR * 0.25],
    [px + PR * 2.6, py + PR * 1.1],
  ];
  const bar = land ? { x0: w * 0.56, x1: w * 0.9, y: h * 0.68 } : { x0: w * 0.1, x1: w * 0.9, y: h * 0.7 };
  const lx = (lg: number) => bar.x0 + ((lg - 30) / (45 - 30)) * (bar.x1 - bar.x0);
  const proton: Scene = {
    from: 51.5,
    to: 59,
    fade: 1.5,
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.15, 0.2);
      const o = ss(51.8, 53, m.b);
      ink(c, circlePath(px, py, PR, 120, 291), o, { width: Math.max(1, S * 0.0022), color: INK, seed: 291, alpha: 0.8 });
      // the three quarks, held by the strong force's gluon lines
      quarks.forEach(([x, y], i) => {
        glow(c, x, y, PR * 0.22, i === 2 ? '#7fb2ff' : '#ff8a6a', 0.7 * o);
        const [x2, y2] = quarks[(i + 1) % 3];
        const n = 14;
        const wav: Pt[] = Array.from({ length: n * 4 + 1 }, (_, j) => {
          const u = j / (n * 4);
          const nx = -(y2 - y);
          const ny = x2 - x;
          const L = Math.hypot(nx, ny) || 1;
          const wob = Math.sin(u * Math.PI * 2 * n + m.t * 6) * PR * 0.035;
          return [x + (x2 - x) * u + (nx / L) * wob, y + (y2 - y) * u + (ny / L) * wob] as const;
        });
        ink(c, wav, ss(52.5, 53.8, m.b), { width: Math.max(1, S * 0.0011), color: INK, seed: 292 + i, alpha: 0.4 });
      });
      // one way it might go: a positron and a neutral pion (which becomes two gamma rays)
      ink(c, outA, ss(54, 55, m.b), { width: Math.max(1, S * 0.0018), color: ACC, seed: 295, alpha: 0.85 });
      ink(c, outB, ss(54.3, 55.3, m.b), { width: Math.max(1, S * 0.0018), color: '#ffb38a', seed: 296, alpha: 0.85 });
      // its lifetime: at least this (measured), perhaps much longer, perhaps for ever
      const b2 = ss(55, 56.5, m.b);
      ink(c, [[bar.x0, bar.y], [bar.x1, bar.y]], b2, { width: Math.max(1, S * 0.0014), color: INK, seed: 297, alpha: 0.5 });
      c.save();
      c.globalAlpha = b2;
      c.font = `${Math.max(10, S * 0.0135)}px "IBM Plex Mono", monospace`;
      c.fillStyle = 'rgba(230,220,203,0.62)';
      c.textAlign = 'center';
      for (const lg of [30, 35, 40, 45]) {
        c.fillRect(lx(lg) - 0.5, bar.y, 1, S * 0.008);
        c.fillText(pow10(lg), lx(lg), bar.y + S * 0.03);
      }
      c.restore();
      const known = ss(56, 57, m.b);
      if (known > 0) {
        c.save();
        c.fillStyle = `rgba(147,196,255,${0.25 * known})`;
        c.fillRect(lx(34.2), bar.y - S * 0.012, (bar.x1 - lx(34.2)) * known, S * 0.024);
        c.restore();
        ink(c, [[lx(34.2), bar.y - S * 0.02], [lx(34.2), bar.y + S * 0.02]], known, { width: Math.max(1, S * 0.0022), color: ACC, seed: 298, alpha: 0.9 });
      }
    },
    notes(m) {
      return [
        note('p-a', 'PROTON', px / w, (py + PR * 1.35) / h, ss(52.5, 53.3, m.b), { align: 'c', tone: 'accent' }),
        note('p-u1', 'u', quarks[0][0] / w, (quarks[0][1] - PR * 0.3) / h, ss(52.8, 53.5, m.b), { align: 'c', tone: 'ink' }),
        note('p-u2', 'u', (quarks[1][0] + PR * 0.25) / w, quarks[1][1] / h, ss(52.9, 53.6, m.b), { align: 'l', tone: 'ink' }),
        note('p-d', 'd', (quarks[2][0] - PR * 0.25) / w, quarks[2][1] / h, ss(53, 53.7, m.b), { align: 'r', tone: 'ink' }),
        note('p-e', 'e⁺', (outA[1][0] + S * 0.01) / w, outA[1][1] / h, ss(55, 55.6, m.b), { tone: 'accent' }),
        note('p-pi', 'π⁰ → γγ', (outB[1][0] + S * 0.01) / w, outB[1][1] / h, ss(55.3, 55.9, m.b), { tone: 'ink' }),
        note('p-life', 'LIFETIME · YEARS', bar.x0 / w, (bar.y - S * 0.035) / h, ss(55.5, 56.3, m.b), { tone: 'dim' }),
        note('p-k', 'AT LEAST 1.6 × 10³⁴ · SUPER-KAMIOKANDE', lx(34.2) / w, (bar.y + S * 0.07) / h, ss(56.5, 57.3, m.b), { tone: 'accent' }),
      ];
    },
  };

  // ------------------------------------------------------------ 9. our people, round an ember
  const sx = w * 0.5;
  const sy = h * 0.47;
  const ringR = S * 0.34;
  const panels = Array.from({ length: 64 }, (_, i) => (i / 64) * Math.PI * 2);
  const ours: Scene = {
    from: 58.5,
    to: 64.5,
    fade: 1.5,
    assets: [ember],
    draw(c, m) {
      const u = ease(m.p);
      layer(c, sky.get(), w, h, M, w * 0.02 * u, 0, 1.12, 0.42);
      layer(c, nearSky.get(), w, h, M, w * 0.04 * u, 0, 1.14, 0.5);
      const R = S * 0.07;
      const spin = m.t * 0.15;
      const tilt = 0.3;
      // the collectors behind the star, the star, the collectors in front: a ring round its light
      const drawRing = (front: boolean) => {
        for (const a0 of panels) {
          const a = a0 + spin;
          if (Math.sin(a) > 0 !== front) continue;
          const x = sx + Math.cos(a) * ringR;
          const y = sy + Math.sin(a) * ringR * tilt;
          const lit = 0.35 + 0.65 * Math.max(0, -Math.cos(a));
          c.save();
          c.translate(x, y);
          c.rotate(a + Math.PI / 2);
          c.fillStyle = `rgba(${Math.round(60 + 90 * lit)},${Math.round(64 + 80 * lit)},${Math.round(80 + 70 * lit)},0.9)`;
          c.fillRect(-S * 0.012, -S * 0.004, S * 0.024, S * 0.008);
          c.restore();
          if (Math.floor(a0 * 10) % 7 === 0) glow(c, x, y, S * 0.008, '#7fd8ff', 0.6);
        }
      };
      drawRing(false);
      glow(c, sx, sy, R * 4, '#7a6a90', 0.16);
      falseColour(c, ember.get(), sx, sy, R);
      drawRing(true);
      reticle(c, sx, sy, R * 1.6, S, ss(59.5, 60.5, m.b), 301, ACC);
      // a ship crossing between embers
      const go = ss(59, 64.5, m.b);
      ship(c, w * (0.12 + 0.76 * go), h * (0.78 - 0.08 * go), -0.12, S * 0.05, 0.8);
    },
    notes(m) {
      return [note('o-a', 'A RING OF COLLECTORS · ITS LAST WARMTH', 0.5, (sy + ringR * 0.3 + S * 0.08) / h, ss(60, 61, m.b), { align: 'c', tone: 'accent' })];
    },
  };

  return {
    numeral: 'II',
    title: 'The Degenerate Age',
    sub: 'Age II · the Degenerate Era',
    titleAt: 64,
    eta: [14, 14.4],
    narration: [
      { from: 0.8, to: 6.4, text: 'The last ordinary stars are gone.' },
      { from: 7.3, to: 12.2, text: 'What remains are their corpses:' },
      { from: 13, to: 18.4, text: 'white dwarfs kept faintly warm by dark matter falling into them,' },
      { from: 19.4, to: 29.6, text: 'brown dwarfs that never ignited, neutron stars, and black holes.' },
      { from: 31, to: 37.4, text: 'Now and then two brown dwarfs collide and a small star burns again,' },
      { from: 38.4, to: 44.4, text: 'or two white dwarfs merge into a brilliant, brief helium star.' },
      { from: 45.4, to: 51.4, text: 'The galaxy has begun to throw its remnants into the void,' },
      { from: 52.2, to: 58.4, text: 'and the protons themselves may not last.' },
    ],
    scenes: [lastRed, dark, darkMatter, specimens, collide, helium, flinging, proton, ours],
    card(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.0 + 0.04 * m.p, 0.32);
      glow(c, w * 0.5, h * 0.5, S * 0.6, '#5a7ab0', 0.07 * (1 - m.p));
    },
  };
});

