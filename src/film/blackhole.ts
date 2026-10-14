import { Rng } from '../game/rng';
import { pow10 } from '../ui/fmt';
import { Stipple, circlePath, glow, ink, lerp, rgba, ss, type Ctx, type Pt } from './draw';
import type { FilmDef } from './films';
import { camera, landscape, layer, reticle, ship, skyRatio } from './kit';
import { Lazy, Perlin, World, canvas, clamp01, css, dotSprite, heatOf, paintBanded, paintLens, paintStar, paintWorldMap, tint, type RGB } from './paint';
import { ease, note, reel2, type Moment, type Scene } from './reel';

// Into the Black Hole Age (Age III), second cut, in three versions by the fate of matter. The
// Great Decay: a dead world sparking away proton by proton, the dead laid out as they dissolve, the
// thin haze of electrons and positrons that is left. The Last Warmth with stable matter: the last
// neutron star cooling below a black hole's Hawking glow, the crossing on a chart, the ladder of
// temperatures the holes now top, matter tunnelling toward iron, a dead world fed to a hole. The
// Last Warmth under curvature radiation: a neutron star at a tenth of a Sun bursting, the chart of
// its long loss, the dwarfs and worlds being unmade, the dates they go. Then, in every version, the
// holes: one bending our own lights round its shadow (the point-lens equation, as the game draws
// it), its spin drawn as Kerr's ergosphere with the Penrose process, its slow evaporation on a
// chart of lifetimes, a small one's last flash as its people leave for a larger, and a Bastion
// Shell of fields round the last of them. The words are the age's own introduction.

const INK = '#e6dccb';
const ACC = '#a48dff';
const SOFT = '#d2c6ff';
const AMBER = '#ffbf73';
const AMBER_RGB: RGB = [1, 0.76, 0.46];
const TEAL_RGB: RGB = [0.5, 0.85, 1];
const ELECTRON = '#a9c8ff';

/** A number of its own for (seed, k), 0..1. */
function hash(seed: number, k: number): number {
  let v = Math.imul((k + seed * 374761393) | 0, 668265263);
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}

/**
 * The two images a point lens makes of a point at (dx, dy) from it (the point-lens equation,
 * θ = (β ± √(β² + 4θE²)) / 2): the outer on the point's own side, pushed out; the inner on the far
 * side, close in and faint; each with its magnification (capped: right behind the hole it is a ring).
 */
function lensed(dx: number, dy: number, thE: number): [number, number, number][] {
  const b = Math.hypot(dx, dy);
  if (thE <= 0) return [[dx, dy, 1]];
  const ux = b > 1e-9 ? dx / b : 0;
  const uy = b > 1e-9 ? dy / b : -1;
  const root = Math.sqrt(b * b + 4 * thE * thE);
  const u = Math.max(0.05, b / thE);
  const base = (u * u + 2) / (2 * u * Math.sqrt(u * u + 4));
  return [
    [(ux * (b + root)) / 2, (uy * (b + root)) / 2, Math.min(3.5, base + 0.5)],
    [(ux * (b - root)) / 2, (uy * (b - root)) / 2, Math.min(2.5, Math.max(0, base - 0.5))],
  ];
}

/** A ring round a hole: our structures, a disk, a field's loop. Sizes in the frame's pixels at the hole. */
interface RingLook {
  a: number;
  /** Its tilt from edge-on (radians): the far side shows above the hole. */
  incl: number;
  /** Lights on it, how fast they go round (radians a second), their colour and size. */
  n: number;
  speed: number;
  color: RGB;
  size: number;
  /** The Einstein radius for what is right behind the hole at the ring's distance, and the shadow's radius. */
  thE: number;
  rsh: number;
  /** The continuous band's strength, and the lights' (0..1). */
  band: number;
  lights: number;
  width: number;
  seed: number;
  pr: number;
  /** How much brighter the side coming toward us is (a disk's, near the hole; 0: none). */
  beam?: number;
}

function ringAt(r: RingLook, phi: number) {
  const along = r.a * Math.sin(phi);
  return { x: r.a * Math.cos(phi), y: -along * Math.sin(r.incl), depth: along * Math.cos(r.incl) };
}

/**
 * A ring round a hole at (hx, hy): its far half (`back`) bent by the hole (outward over the top, and
 * a faint second image hugging the shadow below), or its near half (`front`), crossing the shadow
 * unbent. Drawn back, then the hole's shadow, then front.
 */
function drawRing(c: Ctx, hx: number, hy: number, r: RingLook, t: number, part: 'back' | 'front', fade = 1) {
  if (fade <= 0) return;
  const beam = (phi: number) => (r.beam ? Math.pow(1 / (1 + r.beam * Math.cos(phi) * Math.cos(r.incl)), 3) : 1);
  const thE = (depth: number) => r.thE * Math.sqrt(Math.max(0, depth) / r.a);
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.lineCap = 'round';
  if (r.band > 0) {
    const N = 280;
    let prev: { p: Pt; q: Pt | null } | null = null;
    for (let i = 0; i <= N; i++) {
      const phi = (i / N) * Math.PI * 2 + r.speed * t * 0.15;
      const { x, y, depth } = ringAt(r, phi);
      const back = depth > 0;
      if ((part === 'back') !== back) {
        prev = null;
        continue;
      }
      let p: Pt = [hx + x, hy + y];
      let mag = 1;
      let q: Pt | null = null;
      let qmag = 0;
      if (back) {
        const [[px, py, pm], [sx, sy, sm]] = lensed(x, y, thE(depth));
        p = [hx + px, hy + py];
        mag = pm;
        if (Math.hypot(sx, sy) > r.rsh * 1.04) {
          q = [hx + sx, hy + sy];
          qmag = sm;
        }
      }
      if (prev) {
        const a = clamp01(r.band * fade * Math.min(1.8, mag) * beam(phi));
        c.strokeStyle = css(r.color, a);
        c.lineWidth = r.width;
        c.beginPath();
        c.moveTo(prev.p[0], prev.p[1]);
        c.lineTo(p[0], p[1]);
        c.stroke();
        if (q && prev.q) {
          c.strokeStyle = css(r.color, clamp01(r.band * fade * qmag * beam(phi) * 0.8));
          c.lineWidth = r.width * 0.6;
          c.beginPath();
          c.moveTo(prev.q[0], prev.q[1]);
          c.lineTo(q[0], q[1]);
          c.stroke();
        }
      }
      prev = { p, q };
    }
  }
  if (r.lights > 0 && r.n > 0) {
    const spr = tint(dotSprite(Math.max(2, r.size * 2.2 * r.pr)), r.color);
    for (let j = 0; j < r.n; j++) {
      const tw = hash(r.seed, j);
      const phi = (j / r.n) * Math.PI * 2 + (tw - 0.5) * 0.04 + r.speed * t;
      const { x, y, depth } = ringAt(r, phi);
      const back = depth > 0;
      if ((part === 'back') !== back) continue;
      const twinkle = 0.7 + 0.3 * Math.sin(t * (1.1 + tw * 2.3) + tw * 40);
      const imgs: [number, number, number][] = back ? lensed(x, y, thE(depth)) : [[x, y, 1]];
      imgs.forEach(([ix, iy, im], k) => {
        const d = Math.hypot(ix, iy);
        if (d < r.rsh * (k ? 1.04 : 1)) return;
        const a = clamp01(r.lights * fade * twinkle * Math.min(1.6, im) * beam(phi));
        if (a <= 0.01) return;
        const s = Math.sqrt(Math.max(0.25, Math.min(2.5, im)));
        const dw = (spr.width / r.pr) * s;
        c.globalAlpha = a;
        c.drawImage(spr, hx + ix - dw / 2, hy + iy - dw / 2, dw, dw);
      });
    }
  }
  c.restore();
}

/** A point (x across, up, toward the far side) round a hole, as the frame sees it from `incl` above its equator: where it falls on the screen from the hole, and how far behind the hole it is. */
function seen(x: number, up: number, far: number, incl: number): [number, number, number] {
  return [x, -(up * Math.cos(incl) + far * Math.sin(incl)), far * Math.cos(incl) - up * Math.sin(incl)];
}

/** A path round a hole at (hx, hy), its points (x, y, depth) from it: drawn where it is behind (bent round the shadow) or in front, by `part`. */
function lensedPath(c: Ctx, hx: number, hy: number, pts: readonly (readonly [number, number, number])[], part: 'back' | 'front', o: { thE: number; reach: number; rsh: number; color: string; alpha: number; width: number }) {
  if (o.alpha <= 0) return;
  let prev: Pt | null = null;
  c.strokeStyle = rgba(o.color, o.alpha);
  c.lineWidth = o.width;
  c.beginPath();
  for (const [x, y, depth] of pts) {
    const back = depth > 0;
    if ((part === 'back') !== back) {
      prev = null;
      continue;
    }
    let p: Pt = [hx + x, hy + y];
    if (back) {
      const [[px, py]] = lensed(x, y, o.thE * Math.sqrt(Math.min(1, depth / o.reach)));
      if (Math.hypot(px, py) < o.rsh) {
        prev = null;
        continue;
      }
      p = [hx + px, hy + py];
    }
    if (prev) {
      c.moveTo(prev[0], prev[1]);
      c.lineTo(p[0], p[1]);
    }
    prev = p;
  }
  c.stroke();
}

/** A hole drawn plainly (nothing lensed behind it): its shadow, the photon ring's thin light, a faint glow. */
function plainHole(c: Ctx, x: number, y: number, rsh: number, S: number, o: { glow?: number; ring?: number; color?: string } = {}) {
  glow(c, x, y, rsh * 3.4, o.color ?? ACC, 0.12 * (o.glow ?? 1));
  c.save();
  c.fillStyle = '#000';
  c.beginPath();
  c.arc(x, y, rsh, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = rgba(SOFT, 0.6 * (o.ring ?? 1));
  c.lineWidth = Math.max(1, S * 0.0016);
  c.beginPath();
  c.arc(x, y, rsh * 1.03, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = rgba(SOFT, 0.16 * (o.ring ?? 1));
  c.lineWidth = Math.max(1, S * 0.006);
  c.beginPath();
  c.arc(x, y, rsh * 1.07, 0, Math.PI * 2);
  c.stroke();
  c.restore();
}

/**
 * Hawking radiation from a hole at (x, y): wave packets leaving at the speed of light in every
 * direction, each longer than the hole is wide (the peak of its spectrum is some sixteen horizon
 * radii long). `rate`: packets a second.
 */
function quanta(c: Ctx, x: number, y: number, rsh: number, t: number, S: number, o: { rate: number; seed: number; color?: string; alpha?: number; reach?: number; life?: number }) {
  const life = o.life ?? 1.8;
  const n = Math.ceil(o.rate * life) + 1;
  // (a crest a hole-and-a-half long: the real peak is longer still, some six shadow radii)
  const lam = rsh * 3;
  const reach = o.reach ?? S * 0.2;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.lineWidth = Math.max(1, S * 0.0014);
  for (let i = 0; i < n; i++) {
    const k = Math.floor(t * o.rate) - i;
    const age = t - k / o.rate;
    if (age < 0 || age > life) continue;
    const dir = hash(o.seed, k) * Math.PI * 2;
    const d = rsh * 1.3 + (age / life) * reach;
    const fade = Math.pow(1 - age / life, 1.5) * ss(0, 0.2, age);
    const L = lam * 2;
    const ux = Math.cos(dir);
    const uy = Math.sin(dir);
    c.strokeStyle = rgba(o.color ?? SOFT, (o.alpha ?? 0.7) * fade);
    c.beginPath();
    let first = true;
    for (let s = 0; s <= 28; s++) {
      const u = s / 28 - 0.5;
      const along = d + u * L;
      if (along < rsh * 1.15) continue;
      const off = Math.sin(((u * L) / lam) * Math.PI * 2 - age * 9) * Math.exp(-u * u * 14) * rsh * 0.36;
      const px = x + ux * along - uy * off;
      const py = y + uy * along + ux * off;
      if (first) c.moveTo(px, py);
      else c.lineTo(px, py);
      first = false;
    }
    c.stroke();
  }
  c.restore();
}

/** Numbers on a chart, in the reel's mono (the words stay in the page, as notes). */
function figure(c: Ctx, text: string, x: number, y: number, S: number, alpha: number, align: CanvasTextAlign = 'center') {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha = alpha;
  c.font = `${Math.max(10, S * 0.0135)}px "IBM Plex Mono", monospace`;
  c.fillStyle = 'rgba(230,220,203,0.62)';
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(text, x, y);
  c.restore();
}

/** A chart's two axes, inked in from their corner. */
function axes(c: Ctx, x0: number, y0: number, x1: number, y1: number, reveal: number, S: number, seed: number) {
  ink(c, [[x0, y1], [x0, y0], [x1, y0]], reveal, { width: Math.max(1, S * 0.0016), color: INK, seed, alpha: 0.55 });
}

/** A wavy line from a to b: light (a photon), `waves` crests long, drawn up to `reveal`. */
function wavy(a: Pt, b: Pt, waves: number, amp: number, reveal: number, t: number): Pt[] {
  const n = Math.max(8, Math.round(waves * 10));
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const pts: Pt[] = [];
  for (let i = 0; i <= n * clamp01(reveal); i++) {
    const u = i / n;
    const off = Math.sin(u * waves * Math.PI * 2 - t * 8) * amp;
    pts.push([a[0] + dx * u - (dy / L) * off, a[1] + dy * u + (dx / L) * off]);
  }
  return pts;
}

/** The sky of this age, painted once: black, but for the far lights of settlements (ours and others'), and, where matter decayed, the false-colour haze of what it left. */
function paintDark(w: number, h: number, o: { seed: number; n: number; haze: number; scale: number }): Lazy<HTMLCanvasElement> {
  return new Lazy(function* () {
    const cv = canvas(w, h);
    const g = cv.getContext('2d')!;
    const rng = new Rng(o.seed);
    if (o.haze > 0) {
      const bw = Math.max(16, Math.round(w / 5));
      const bh = Math.max(16, Math.round(h / 5));
      const small = canvas(bw, bh);
      const sg = small.getContext('2d')!;
      const img = sg.createImageData(bw, bh);
      const noise = new Perlin(o.seed + 3);
      for (let j = 0; j < bh; j++) {
        for (let i = 0; i < bw; i++) {
          const x = (i / bw) * 4;
          const y = (j / bh) * 4 * (h / w);
          const v = noise.fbm(x, y, 0.3, 5) * 0.5 + 0.5;
          const wisp = Math.pow(clamp01((v - 0.32) / 0.5), 1.7);
          const tone = noise.fbm(x * 0.6 + 7, y * 0.6, 1.7, 3) * 0.5 + 0.5;
          const k = (j * bw + i) * 4;
          img.data[k] = 255 * lerp(0.5, 0.68, tone);
          img.data[k + 1] = 255 * lerp(0.62, 0.52, tone);
          img.data[k + 2] = 255;
          img.data[k + 3] = 255 * wisp * o.haze;
        }
        if (j % 16 === 15) yield;
      }
      sg.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(small, 0, 0, w, h);
    }
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < o.n; i++) {
      const x = rng.next() * w;
      const y = rng.next() * h;
      const b = Math.pow(rng.next(), 4);
      const col: RGB = rng.chance(0.72) ? AMBER_RGB : TEAL_RGB;
      const r = (0.7 + b * 3.2) * o.scale;
      if (r < 1.3) {
        g.fillStyle = css(col, 0.18 + b * 2);
        g.fillRect(x, y, Math.max(1, o.scale * 0.9), Math.max(1, o.scale * 0.9));
      } else {
        const s = dotSprite(r * 2.2);
        g.globalAlpha = Math.min(1, 0.28 + b * 1.2);
        g.drawImage(tint(s, col), x - s.width / 2, y - s.height / 2);
        g.globalAlpha = 1;
      }
      if (i % 400 === 399) yield;
    }
    return cv;
  });
}

type Fate = 'decay' | 'stable' | 'curvature';

/** Into the Black Hole Age: the Great Decay (protons decay), or the Last Warmth (stable matter, or curvature radiation). */
export function blackHoleAge2(id: 'great_decay' | 'last_warmth', name: string): FilmDef {
  return reel2({ id, name, bpm: 90, beats: 74, accent: ACC }, (w, h, S, k, args) => {
    const fate: Fate = args.fate ?? (id === 'great_decay' ? 'decay' : 'stable');
    const pr = args.pr ?? 1;
    const land = landscape(w, h);
    const M = 1.3;
    const dpx = (x: number) => Math.round(x * pr);
    const spx = (x: number) => Math.round(x * skyRatio(w, h, M, pr));
    const scale = Math.max(1, (S / 900) * pr);
    const area = (w * h) / (1600 * 900);
    const thin = Math.max(1, S * 0.0014);

    // ------------------------------------------------------------ paintings
    const sky = paintDark(spx(w * M), spx(h * M), { seed: 301, n: Math.round(200 * k * area) + 40, haze: fate === 'decay' ? 0.46 : 0.07, scale });
    // the hero hole, and its lens over the sky as the hole's scenes draw it (the sky at zoom Z0)
    const HX = w * 0.5;
    const HY = h * 0.46;
    const RSH = S * (land ? 0.085 : 0.1);
    const Z0 = 1.1;
    const skyPerScreen = spx(w * M) / (w * M * Z0);
    const toSky = (p: Pt): Pt => {
      const lw = w * M * Z0;
      const lh = h * M * Z0;
      return [((p[0] - (w / 2 - lw / 2)) / lw) * spx(w * M), ((p[1] - (h / 2 - lh / 2)) / lh) * spx(h * M)];
    };
    const holeSky = toSky([HX, HY]);
    const lens = new Lazy(function* () {
      const bg = sky.get();
      yield;
      return yield* (function* () {
        const l = paintLens(bg, holeSky[0], holeSky[1], RSH * skyPerScreen, { reach: 5.6, ring: [0.84, 0.78, 1], ringGain: 0.8 });
        while (!l.warm(performance.now() + 2)) yield;
        return l.get();
      })();
    });
    // a dead world, as the instruments see it by its faint heat
    const deadMap = paintWorldMap(Math.round(384 * (0.6 + 0.4 * k)), {
      seed: 302,
      sea: 0,
      ice: 0.75,
      cloud: 0,
      palette: {
        deep: [0.1, 0.1, 0.11],
        shallow: [0.14, 0.14, 0.15],
        low: [0.2, 0.19, 0.21],
        high: [0.46, 0.44, 0.47],
        ice: [0.62, 0.64, 0.68],
        cloud: [0, 0, 0],
        air: [0, 0, 0],
        lights: [0, 0, 0],
      },
    });
    const DEAD_LIGHT: [number, number, number] = [-0.25, 0.3, 1];
    const worldOf = (px: number) =>
      new Lazy(function* () {
        const mp = deadMap.get();
        yield;
        return new World(dpx(px), mp, { light: DEAD_LIGHT, sun: [0.85, 0.82, 0.92], tilt: 0.3, air: [0, 0, 0], lights: [0, 0, 0], airThick: 0, heat: 1.75 });
      });
    const bigWorld = worldOf(S * (land ? 0.25 : 0.28) * 2);
    const smallWorld = worldOf(S * 0.1 * 2);
    // a white dwarf and a brown dwarf, by their faint heat too
    const dwarfPaint = paintStar(dpx(S * 0.09 * 2), { T: 5200, seed: 303, limb: [0.55, 0.3], cells: 18, grain: 0.16 });
    const dwarfDisc = new Lazy(function* () {
      const d = dwarfPaint.get();
      yield;
      return heatOf(d, 1.05);
    });
    const brownPaint = paintBanded(dpx(S * 0.1 * 2), { seed: 304, T: 900, bands: 8, tilt: 0.25 });
    const brownDisc = new Lazy(function* () {
      const d = brownPaint.get();
      yield;
      return heatOf(d, 2.2);
    });
    /** A disc painted in the thermal palette, drawn at (x, y), radius R. */
    const disc = (c: Ctx, img: HTMLCanvasElement, x: number, y: number, R: number) => c.drawImage(img, x - R, y - R, R * 2, R * 2);

    // our collectors round the hero hole: the light there is ours
    const collectors = (a: number, incl: number, fade = 1): RingLook => ({
      a,
      incl,
      n: Math.round(240 * k) + 60,
      speed: 0.09,
      color: AMBER_RGB,
      size: Math.max(1.8, S * 0.0032),
      thE: RSH * 1.4,
      rsh: RSH,
      band: 0.45 * fade,
      lights: 1 * fade,
      width: Math.max(1, S * 0.0018),
      seed: 310,
      pr,
    });

    /** The hero hole and its lensed sky, through the camera. */
    const heroHole = (c: Ctx, m: Moment, o: { z: number; ox: number; oy: number; sky: number; lens: number; ring?: RingLook | null; ringFade?: number; extra?: (part: 'back' | 'front') => void }) => {
      camera(c, HX, HY, o.z, o.ox, o.oy, () => {
        layer(c, sky.get(), w, h, M, 0, 0, Z0, o.sky);
        if (o.lens > 0) {
          const patch = lens.get();
          const sz = patch.width / skyPerScreen;
          c.save();
          c.globalAlpha = o.lens;
          c.drawImage(patch, HX - sz / 2, HY - sz / 2, sz, sz);
          c.restore();
        }
        o.extra?.('back');
        if (o.ring) drawRing(c, HX, HY, o.ring, m.t, 'back', o.ringFade ?? 1);
        o.extra?.('front');
        if (o.ring) drawRing(c, HX, HY, o.ring, m.t, 'front', o.ringFade ?? 1);
      });
    };
    /** Where a point under the camera lands on the screen. */
    const onScreen = (x: number, y: number, z: number, ox: number, oy: number): Pt => [HX + ox + (x - HX) * z, HY + oy + (y - HY) * z];

    // ================================================================ the holes (every version)

    /** A black hole, the warmest thing there is now: it bends our own lights round its shadow. */
    const holeReveal = (from: number, to: number): Scene => {
      const ring = collectors(RSH * 3.3, 0.2);
      // Penrose Harvesters, nearer in and steeper, going round faster
      const inner: RingLook = { ...collectors(RSH * 2.15, 0.42), color: TEAL_RGB, n: Math.round(70 * k) + 24, speed: 0.22, thE: RSH * 1.1, band: 0.3, seed: 311 };
      const cam = (m: Moment) => ({ z: 0.86 + 0.24 * ease(m.p), ox: w * 0.025 * (1 - ease(m.p)), oy: 0 });
      return {
        from,
        to,
        enter: 'zoom',
        assets: [sky, lens],
        draw(c, m) {
          const { z, ox, oy } = cam(m);
          const rf = ss(from + 2, from + 4, m.b);
          heroHole(c, m, { z, ox, oy, sky: 0.95, lens: ss(from + 0.3, from + 2.2, m.b), ring, ringFade: rf, extra: (part) => drawRing(c, HX, HY, inner, m.t, part, ss(from + 3, from + 5, m.b)) });
          const [sx, sy] = onScreen(HX, HY, z, ox, oy);
          reticle(c, sx, sy, RSH * z * 1.25, S, ss(from + 3.2, from + 4.6, m.b), 320, SOFT);
        },
        notes(m) {
          const { z, ox, oy } = cam(m);
          const [sx, sy] = land ? onScreen(HX + RSH * 2.2, HY - RSH * 2.6, z, ox, oy) : onScreen(HX, HY - RSH * 4.6, z, ox, oy);
          const [ax, ay] = land ? onScreen(HX - RSH * 3.6, HY - RSH * 2.2, z, ox, oy) : onScreen(HX, HY + RSH * 2.4, z, ox, oy);
          const al = land ? 'l' : 'c';
          return [
            note('hr-a', 'BLACK HOLE · TEN SUNS', sx / w, sy / h, ss(from + 3.6, from + 4.4, m.b), { tone: 'accent', align: al }),
            note('hr-b', 'ITS SHADOW · 2.6 TIMES ITS HORIZON', sx / w, (sy + S * 0.03) / h, ss(from + 4, from + 4.8, m.b), { tone: 'dim', align: al }),
            note('hr-c', 'HAWKING GLOW · 6 × 10⁻⁹ K', sx / w, (sy + S * 0.06) / h, ss(from + 4.4, from + 5.2, m.b), { tone: 'dim', align: al }),
            note('hr-d', 'OUR COLLECTORS · ITS FAR SIDE BENT OVER THE TOP', ax / w, ay / h, ss(from + 5, from + 5.8, m.b), { tone: 'ink', align: land ? 'r' : 'c' }),
            note('hr-e', 'NEARER IN · OUR HARVESTERS', ax / w, (ay + S * 0.03) / h, ss(from + 5.6, from + 6.4, m.b), { tone: 'dim', align: land ? 'r' : 'c' }),
          ];
        },
      };
    };

    /** The spin: Kerr's horizon and ergosphere, side on, everything in it dragged round; the Penrose process taking energy out. */
    const kerr = (from: number, to: number): Scene => {
      const a = 0.95;
      const rp = 1 + Math.sqrt(1 - a * a);
      const U = S * (land ? 0.115 : 0.1);
      const cx = land ? w * 0.42 : w * 0.5;
      const cy = h * 0.45;
      // the ergosphere's edge, r = M + √(M² − a² cos² θ), θ from the spin axis
      const ergo: Pt[] = Array.from({ length: 181 }, (_, i) => {
        const th = (i / 180) * Math.PI * 2;
        const r = 1 + Math.sqrt(1 - a * a * Math.cos(th) ** 2);
        return [cx + r * Math.sin(th) * U, cy - r * Math.cos(th) * U] as const;
      });
      const horizon = circlePath(cx, cy, rp * U, 120, 331);
      // circles of latitude just inside the ergosphere's edge, seen a little from above
      const lats = [0.7, 1.05, Math.PI / 2, Math.PI - 1.05, Math.PI - 0.7].map((th) => {
        const r = 1 + Math.sqrt(1 - a * a * Math.cos(th) ** 2) - 0.1;
        return { r, rho: r * Math.sin(th) * U, yc: cy - r * Math.cos(th) * U };
      });
      const TILT = 0.24;
      /** The latitude circles' halves (back before the horizon, front after) and what is dragged round them (ω ∝ 1/r³). */
      const dragged = (c: Ctx, m: Moment, o: number, front: boolean) => {
        c.save();
        c.globalCompositeOperation = 'lighter';
        lats.forEach((L, li) => {
          const half: Pt[] = Array.from({ length: 49 }, (_, i) => {
            const ph = (front ? 0 : Math.PI) + (i / 48) * Math.PI;
            return [cx + Math.cos(ph) * L.rho, L.yc + Math.sin(ph) * L.rho * TILT] as const;
          });
          ink(c, half, o, { width: thin, color: ACC, seed: 345 + li * 2 + (front ? 1 : 0), alpha: front ? 0.5 : 0.2 });
          const om = 2.4 / Math.pow(L.r, 3);
          for (let j = 0; j < 6; j++) {
            const ph = (j / 6) * Math.PI * 2 + m.t * om + li;
            if (Math.sin(ph) > 0 !== front) continue;
            const x = cx + Math.cos(ph) * L.rho;
            const y = L.yc + Math.sin(ph) * L.rho * TILT;
            const trail: Pt[] = Array.from({ length: 10 }, (_, q) => {
              const p2 = ph - (9 - q) * 0.06;
              return [cx + Math.cos(p2) * L.rho, L.yc + Math.sin(p2) * L.rho * TILT] as const;
            });
            ink(c, trail, 1, { width: Math.max(1, S * 0.002), color: SOFT, seed: 360 + j, alpha: (front ? 0.55 : 0.2) * o });
            glow(c, x, y, U * 0.07, front ? SOFT : ACC, (front ? 0.95 : 0.35) * o);
          }
        });
        c.restore();
      };
      // the Penrose process: in from the right, split in the ergosphere, one piece in, one out heavier
      const P: Pt = [cx + 1.72 * U, cy - 0.12 * U];
      const inPath: Pt[] = Array.from({ length: 40 }, (_, i) => {
        const u = i / 39;
        return [lerp(cx + 4.6 * U, P[0], u) + Math.sin(u * Math.PI) * 0.3 * U, lerp(cy - 1.5 * U, P[1], Math.pow(u, 0.8))] as const;
      });
      const fallPath: Pt[] = Array.from({ length: 60 }, (_, i) => {
        const u = i / 59;
        const r = lerp(1.72, rp * 1.02, Math.pow(u, 0.7));
        const ang = -0.07 + u * 3.2;
        return [cx + Math.cos(ang) * r * U, cy - Math.sin(ang) * r * U * 0.32] as const;
      });
      const outPath: Pt[] = Array.from({ length: 60 }, (_, i) => {
        const u = i / 59;
        const ang = -0.07 - u * 2.3;
        const r = 1.72 + u * u * 2.6;
        return [cx + Math.cos(ang) * r * U, cy + Math.sin(ang) * r * U * 0.55 - u * 0.6 * U] as const;
      });
      const split = from + 4.2;
      return {
        from,
        to,
        fade: 1.5,
        assets: [sky],
        draw(c, m) {
          layer(c, sky.get(), w, h, M, 0, 0, 1.15 + 0.03 * m.p, 0.35);
          const z = 1 + 0.06 * ease(m.p);
          camera(c, cx, cy, z, 0, 0, () => {
            const o = ss(from + 0.2, from + 1.8, m.b);
            // the region where nothing can stand still, faintly
            c.save();
            c.globalAlpha = 0.09 * o;
            c.fillStyle = ACC;
            c.beginPath();
            ergo.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
            c.closePath();
            c.fill();
            c.restore();
            // dragged round: whatever is in it goes round with the hole, faster the nearer in
            dragged(c, m, o, false);
            // the horizon: black, its edge inked
            c.fillStyle = '#000';
            c.beginPath();
            c.arc(cx, cy, rp * U, 0, Math.PI * 2);
            c.fill();
            glow(c, cx, cy, rp * U * 1.6, ACC, 0.08 * o);
            ink(c, horizon, o, { width: Math.max(1, S * 0.002), color: SOFT, seed: 331, alpha: 0.85 });
            dragged(c, m, o, true);
            ink(c, ergo, ss(from + 0.8, from + 2.6, m.b), { width: Math.max(1, S * 0.0018), color: ACC, seed: 335, alpha: 0.85 });
            // the spin axis and its turning
            const ax = ss(from + 1.4, from + 2.6, m.b);
            for (let i = 0; i < 9; i++) {
              const y0 = cy - 3 * U + (i * 6 * U) / 9;
              ink(c, [[cx, y0], [cx, y0 + U * 0.35]], ax, { width: thin, color: INK, seed: 336 + i, alpha: 0.4 });
            }
            const arc = circlePath(cx, cy - 2.7 * U, U * 0.5, 40, 340, Math.PI * 0.15, Math.PI * 1.6, 0.3);
            ink(c, arc, ax, { width: thin, color: INK, seed: 340, alpha: 0.6 });
            if (ax > 0.95) {
              const [ex, ey] = arc[arc.length - 1];
              ink(c, [[ex - U * 0.12, ey - U * 0.08], [ex, ey], [ex - U * 0.13, ey + U * 0.06]], 1, { width: thin, color: INK, seed: 341, alpha: 0.6 });
            }
            // the Penrose process
            const inR = ss(from + 2.6, split, m.b);
            ink(c, inPath, inR, { width: Math.max(1, S * 0.0018), color: INK, seed: 342, alpha: 0.75 });
            if (m.b < split + 0.4) {
              const head = inPath[Math.min(inPath.length - 1, Math.floor(inR * (inPath.length - 1)))];
              if (inR > 0) glow(c, head[0], head[1], U * 0.12, '#fff1d6', 0.8);
            }
            const flash = ss(split - 0.1, split + 0.2, m.b) * (1 - ss(split + 0.2, split + 1.4, m.b));
            glow(c, P[0], P[1], U * 0.6, '#ffffff', 0.7 * flash);
            const fallR = ss(split, split + 2.2, m.b);
            ink(c, fallPath, fallR, { width: Math.max(1, S * 0.0016), color: ACC, seed: 343, alpha: 0.7 * (1 - ss(split + 2.2, split + 3, m.b) * 0.6) });
            const outR = ss(split, split + 1.8, m.b);
            ink(c, outPath, outR, { width: Math.max(1, S * 0.0026), color: '#fff1d6', seed: 344, alpha: 0.9 });
            if (outR > 0 && outR < 1) {
              const head = outPath[Math.floor(outR * (outPath.length - 1))];
              glow(c, head[0], head[1], U * 0.2, '#fff1d6', 0.9);
            }
          });
        },
        notes(m) {
          const z = 1 + 0.06 * ease(m.p);
          const at = (x: number, y: number): Pt => [cx + (x - cx) * z, cy + (y - cy) * z];
          const [hx, hy] = at(cx - rp * U * 0.7, cy + rp * U + S * 0.02);
          const [ex, ey] = at(cx - 2.05 * U, cy + 0.15 * U);
          const [ix, iy] = at(cx + 4.4 * U, cy - 1.75 * U);
          const [fx, fy] = at(cx + 0.2 * U, cy + 0.75 * U);
          const [ox, oy] = at(cx - 3.1 * U, cy - 1.92 * U);
          const sideX = land ? 0.74 : 0.5;
          const sideY = land ? 0.3 : 0.78;
          return [
            note('k-h', 'HORIZON', hx / w, hy / h, ss(from + 1, from + 1.8, m.b), { tone: 'ink', align: 'c' }),
            note('k-e', 'ERGOSPHERE', ex / w, ey / h, ss(from + 2, from + 2.8, m.b), { tone: 'accent', align: 'r' }),
            note('k-e2', 'NOTHING IN IT CAN STAND STILL', ex / w, (ey + S * 0.03) / h, ss(from + 2.4, from + 3.2, m.b), { tone: 'dim', align: 'r' }),
            note('k-in', 'THROWN IN · 1', Math.min(ix / w, 0.9), iy / h, ss(from + 2.8, from + 3.6, m.b), { tone: 'ink', align: ix / w > 0.85 ? 'r' : 'c' }),
            note('k-f', 'FALLS IN · LESS THAN NOTHING', fx / w, fy / h, ss(split + 0.6, split + 1.4, m.b), { tone: 'accent', align: 'c' }),
            note('k-o', 'COMES BACK · UP TO 1.21', ox / w, oy / h, ss(split + 1, split + 1.8, m.b), { tone: 'ink', align: 'c' }),
            note('k-s', 'THE PENROSE PROCESS', sideX, sideY, ss(from + 3, from + 3.8, m.b), { tone: 'accent', align: land ? 'l' : 'c' }),
            note('k-s2', 'UP TO 29% OF A HOLE’S MASS IS ITS SPIN', sideX, sideY + S * 0.032 / h, ss(split + 1.6, split + 2.4, m.b), { tone: 'dim', align: land ? 'l' : 'c' }),
          ];
        },
      };
    };

    /** The slow evaporation: a small hole's quanta, and a chart of how long holes last (life ∝ mass³). */
    const hawking = (from: number, to: number): Scene => {
      const sh = land ? { x: w * 0.25, y: h * 0.45 } : { x: w * 0.5, y: h * 0.25 };
      const rs = S * 0.045;
      const box = land ? { x0: w * 0.5, x1: w * 0.88, y0: h * 0.7, y1: h * 0.2 } : { x0: w * 0.16, x1: w * 0.88, y0: h * 0.76, y1: h * 0.44 };
      const X = (lgM: number) => box.x0 + (lgM / 12) * (box.x1 - box.x0);
      const Y = (eta: number) => box.y0 + ((eta - 66) / (104 - 66)) * (box.y1 - box.y0);
      const life = (lgM: number) => 67.32 + 3 * lgM;
      const line: Pt[] = Array.from({ length: 61 }, (_, i) => [X((i / 60) * 12), Y(life((i / 60) * 12))] as const);
      const marks = [
        { lg: Math.log10(3), id: 'hw-m1', text: 'STELLAR HOLES · η 69' },
        { lg: 6, id: 'hw-m2', text: 'A MILLION SUNS · η 85' },
        { lg: 10.5, id: 'hw-m3', text: 'THE LARGEST · η 99' },
      ];
      const draw = ss(from + 1.4, from + 6.2, 0);
      void draw;
      return {
        from,
        to,
        fade: 1.5,
        assets: [sky],
        draw(c, m) {
          layer(c, sky.get(), w, h, M, -w * 0.02 * m.p, 0, 1.12, 0.4);
          plainHole(c, sh.x, sh.y, rs, S, { glow: 1.4 });
          quanta(c, sh.x, sh.y, rs, m.t, S, { rate: 5, seed: 350, reach: S * 0.2, alpha: 0.85 });
          const o = ss(from + 0.6, from + 1.8, m.b);
          axes(c, box.x0, box.y0, box.x1, box.y1, o, S, 351);
          for (const lg of [0, 3, 6, 9, 12]) figure(c, lg === 0 ? '1' : pow10(lg), X(lg), box.y0 + S * 0.03, S, o);
          for (const e of [70, 80, 90, 100]) figure(c, String(e), box.x0 - S * 0.02, Y(e), S, o, 'right');
          const run = ss(from + 1.6, from + 6.4, m.b);
          ink(c, line, run, { width: Math.max(1, S * 0.0022), color: ACC, seed: 352, alpha: 0.9 });
          const i = Math.min(line.length - 1, Math.floor(run * (line.length - 1)));
          if (run > 0) glow(c, line[i][0], line[i][1], S * 0.012, SOFT, 0.9);
          for (const mk of marks) {
            const on = ss(mk.lg / 12 - 0.02, mk.lg / 12 + 0.04, run);
            if (on <= 0) continue;
            const x = X(mk.lg);
            const y = Y(life(mk.lg));
            ink(c, [[x, box.y0], [x, y]], on, { width: thin, color: INK, seed: 353, alpha: 0.35 });
            glow(c, x, y, S * 0.01, SOFT, on);
          }
        },
        notes(m) {
          const run = ss(from + 1.6, from + 6.4, m.b);
          const o = ss(from + 0.6, from + 1.8, m.b);
          return [
            note('hw-x', 'MASS · SUNS', (box.x1 - S * 0.0) / w, (box.y0 + S * 0.065) / h, o, { tone: 'dim', align: 'r' }),
            note('hw-y', 'EVAPORATES BY · η', box.x0 / w, (box.y1 - S * 0.04) / h, o, { tone: 'dim' }),
            note('hw-l', 'LIFETIME ∝ MASS³', (box.x0 + S * 0.03) / w, (box.y1 + S * 0.0) / h, ss(from + 4, from + 4.8, m.b), { tone: 'accent' }),
            ...marks.map((mk) => note(mk.id, mk.text, (X(mk.lg) + S * 0.015) / w, (Y(life(mk.lg)) + S * 0.025) / h, ss(mk.lg / 12 - 0.01, mk.lg / 12 + 0.06, run), { tone: 'ink' })),
            note('hw-h', 'THE SMALLER, THE HOTTER · T ∝ 1/M', sh.x / w, (sh.y + rs + S * 0.22 + S * 0.03) / h, ss(from + 2.4, from + 3.2, m.b), { tone: 'accent', align: 'c' }),
            note('hw-h2', 'ITS LIGHT IS LONGER THAN THE HOLE IS WIDE', sh.x / w, (sh.y + rs + S * 0.22 + S * 0.06) / h, ss(from + 3, from + 3.8, m.b), { tone: 'dim', align: 'c' }),
          ];
        },
      };
    };

    /** A small hole's end: its people leave for a larger one, and its last flash is banked. */
    const leaving = (from: number, to: number, preview: boolean): Scene => {
      const A: Pt = land ? [w * 0.3, h * 0.5] : [w * 0.32, h * 0.62];
      const B: Pt = land ? [w * 0.8, h * 0.34] : [w * 0.72, h * 0.28];
      const rbB = S * 0.06;
      const big: RingLook = { ...collectors(rbB * 3.2, 0.24), thE: rbB * 1.4, rsh: rbB, n: Math.round(90 * k) + 30 };
      const end = from + 6.2;
      const catchers = Array.from({ length: 5 }, (_, i) => {
        const ang = -2.4 + i * 1.15;
        return { x: A[0] + Math.cos(ang) * S * 0.11, y: A[1] + Math.sin(ang) * S * 0.06, ang };
      });
      const ships = Array.from({ length: 7 }, (_, i) => ({ at: from + 0.8 + i * 0.55, side: hash(360, i) - 0.5 }));
      const path = (u: number, side: number): Pt => {
        const cx = (A[0] + B[0]) / 2 + side * S * 0.05;
        const cy = Math.min(A[1], B[1]) - S * 0.16;
        const v = 1 - u;
        return [v * v * A[0] + 2 * v * u * cx + u * u * B[0], v * v * A[1] + 2 * v * u * cy + u * u * B[1]];
      };
      return {
        from,
        to,
        fade: 1.5,
        assets: [sky],
        draw(c, m) {
          layer(c, sky.get(), w, h, M, w * 0.015 * m.p, 0, 1.12, 0.7);
          // the larger hole, its collectors' light bent round it
          drawRing(c, B[0], B[1], big, m.t, 'back');
          plainHole(c, B[0], B[1], rbB, S);
          drawRing(c, B[0], B[1], big, m.t, 'front');
          // the small one shrinks, hotter and brighter as it goes (T ∝ 1/M), until it is gone in a flash
          const u = ss(from, end, m.b);
          const rs = S * lerp(0.034, 0.006, Math.pow(u, 2.2));
          const heat = 1 / Math.max(0.15, 1 - u * 0.92);
          if (m.b < end) {
            glow(c, A[0], A[1], rs * 4 * Math.min(3, heat), u > 0.7 ? '#efe8ff' : ACC, Math.min(0.9, 0.12 * heat));
            plainHole(c, A[0], A[1], rs, S, { glow: heat * 0.5 });
            quanta(c, A[0], A[1], rs, m.t, S, { rate: 2 + 10 * u * u, seed: 361, reach: S * 0.18, alpha: 0.5 + 0.4 * u, color: u > 0.6 ? '#f2eefc' : SOFT });
          }
          const flash = ss(end - 0.1, end + 0.15, m.b) * (1 - ss(end + 0.15, end + 1.4, m.b));
          glow(c, A[0], A[1], S * 0.26, '#f4efff', 0.9 * flash);
          glow(c, A[0], A[1], S * 0.05, '#ffffff', flash);
          if (m.b >= end) {
            for (let i = 0; i < 2; i++) {
              const ringU = ss(end + i * 0.25, end + 2.4 + i * 0.25, m.b);
              ink(c, circlePath(A[0], A[1], S * (0.02 + 0.42 * ringU), 120, 362 + i), 1, { width: Math.max(1, S * (0.0026 - i * 0.001)), color: i ? ACC : '#f4efff', seed: 362 + i, alpha: 0.85 * (1 - ringU) });
            }
          }
          // its Burst Catchers, banking the flash
          for (const ct of catchers) {
            const lit = ss(end, end + 0.5, m.b);
            c.save();
            c.translate(ct.x, ct.y);
            c.rotate(ct.ang + Math.PI / 2);
            c.fillStyle = `rgba(${Math.round(40 + 180 * lit)},${Math.round(36 + 140 * lit)},${Math.round(46 + 60 * lit)},0.95)`;
            c.fillRect(-S * 0.012, -S * 0.005, S * 0.024, S * 0.01);
            c.restore();
            glow(c, ct.x, ct.y, S * 0.02, AMBER, 0.4 + 0.5 * lit * (1 - ss(end + 1, end + 3, m.b) * 0.6));
          }
          // its people, leaving
          for (const sp of ships) {
            const v = ss(sp.at, sp.at + 3.2, m.b);
            if (v <= 0 || v >= 1) continue;
            const trail: Pt[] = Array.from({ length: 14 }, (_, i) => path(Math.max(0, v - (13 - i) * 0.018), sp.side));
            ink(c, trail, 1, { width: thin, color: AMBER, seed: 363, alpha: 0.4 });
            const [x, y] = path(v, sp.side);
            glow(c, x, y, S * 0.01, AMBER, 0.9);
          }
          const hv = ss(from + 1.5, from + 6.8, m.b);
          if (hv > 0 && hv < 1) {
            const [x, y] = path(hv, 0.2);
            const [x2, y2] = path(Math.min(1, hv + 0.01), 0.2);
            ship(c, x, y, Math.atan2(y2 - y, x2 - x), S * 0.045, 0.8);
          }
        },
        notes(m) {
          return [
            note('lv-a', 'A SMALL HOLE · SHRINKING, HOTTER', A[0] / w, (A[1] + S * 0.1) / h, ss(from + 0.6, from + 1.4, m.b) * (1 - ss(end - 0.4, end, m.b)), { tone: 'accent', align: 'c' }),
            note('lv-b', 'ITS PEOPLE LEAVE FOR A LARGER ONE', ((A[0] + B[0]) / 2) / w, (Math.min(A[1], B[1]) - S * 0.2) / h, ss(from + 1.8, from + 2.6, m.b), { tone: 'ink', align: 'c' }),
            note('lv-c', 'ITS LAST FLASH · BANKED BY BURST CATCHERS', A[0] / w, (A[1] + S * 0.1) / h, ss(end + 0.4, end + 1.2, m.b), { tone: 'accent', align: 'c' }),
            ...(preview ? [note('lv-d', 'FROM ABOUT η 69 · THE LIGHTEST FIRST', A[0] / w, (A[1] + S * 0.13) / h, ss(from + 1, from + 1.8, m.b), { tone: 'dim', align: 'c' })] : []),
          ];
        },
      };
    };

    /** Round the last of them: a Bastion Shell of fields, our collectors, the ships that keep coming. */
    const around = (from: number, to: number, words: string): Scene => {
      const meridians = Array.from({ length: 8 }, (_, j) => ({ az: (j / 8) * Math.PI * 2, L: j % 2 ? 2.4 : 3.1, seed: 370 + j }));
      const latitudes = [-0.9, 0.9];
      const cam = (m: Moment) => ({ z: 0.95 + 0.22 * ease(m.p), ox: -w * 0.03 * m.p, oy: h * 0.01 * m.p });
      return {
        from,
        to,
        fade: 1.8,
        assets: [sky, lens],
        draw(c, m) {
          const { z, ox, oy } = cam(m);
          const incl = 0.2 + 0.08 * m.p;
          const ring = collectors(RSH * 3.6, incl);
          const breath = 1 + 0.035 * Math.sin(m.t * 0.9);
          const o = ss(from + 0.6, from + 2.6, m.b);
          const spin = m.t * 0.06;
          heroHole(c, m, {
            z,
            ox,
            oy,
            sky: 0.9,
            lens: 1,
            ring,
            extra: (part) => {
              c.save();
              c.globalCompositeOperation = 'lighter';
              // the Shell: field lines round the hole (r = L sin²θ), breathing, turning slowly
              for (const f of meridians) {
                const pts = Array.from({ length: 72 }, (_, i) => {
                  const th = 0.16 + (i / 71) * (Math.PI - 0.32);
                  const r = f.L * breath * Math.sin(th) ** 2 * RSH;
                  const az = f.az + spin;
                  return seen(r * Math.sin(th) * Math.cos(az), r * Math.cos(th), r * Math.sin(th) * Math.sin(az), incl);
                });
                lensedPath(c, HX, HY, pts, part, { thE: RSH * 1.4, reach: RSH * 3, rsh: RSH, color: ACC, alpha: (part === 'back' ? 0.3 : 0.5) * o * (0.8 + 0.2 * Math.sin(m.t * 1.3 + f.seed)), width: thin });
                // a mind riding the line
                const u = ((m.t * 0.05 + f.seed * 0.137) % 1 + 1) % 1;
                const th = 0.16 + u * (Math.PI - 0.32);
                const r = f.L * breath * Math.sin(th) ** 2 * RSH;
                const az = f.az + spin;
                const [x, y, depth] = seen(r * Math.sin(th) * Math.cos(az), r * Math.cos(th), r * Math.sin(th) * Math.sin(az), incl);
                if ((part === 'back') === depth > 0) {
                  const [[px, py]] = depth > 0 ? lensed(x, y, RSH * 1.4 * Math.sqrt(Math.min(1, depth / (RSH * 3)))) : [[x, y, 1]];
                  if (Math.hypot(px, py) > RSH) glow(c, HX + px, HY + py, S * 0.012, SOFT, 0.85 * o);
                }
              }
              // standing rings above and below its equator
              for (const up of latitudes) {
                const rho = RSH * 2.3 * breath;
                const pts = Array.from({ length: 97 }, (_, i) => {
                  const ph = (i / 96) * Math.PI * 2;
                  return seen(rho * Math.cos(ph), up * RSH, rho * Math.sin(ph), incl);
                });
                lensedPath(c, HX, HY, pts, part, { thE: RSH * 1.3, reach: RSH * 2.3, rsh: RSH, color: '#b9a6ff', alpha: (part === 'back' ? 0.35 : 0.6) * o, width: Math.max(1, S * 0.0018) });
              }
              c.restore();
            },
          });
          // ships keep coming
          for (let i = 0; i < 3; i++) {
            const v = ss(from + 1 + i * 2.2, from + 5 + i * 2.2, m.b);
            if (v <= 0 || v >= 1) continue;
            const sx = lerp(i % 2 ? w * 1.05 : -w * 0.05, HX + (i % 2 ? 1 : -1) * RSH * 4.2 * z, ease(v));
            const sy = lerp(h * (0.2 + i * 0.25), HY + RSH * (i - 1) * 1.2 * z, ease(v));
            ship(c, sx, sy, i % 2 ? Math.PI + 0.1 : -0.1, S * 0.04, 0.7);
          }
        },
        notes(m) {
          const { z, ox, oy } = cam(m);
          const [bx, by] = land ? onScreen(HX + RSH * 3.4, HY - RSH * 2.6, z, ox, oy) : onScreen(HX, HY - RSH * 4.4, z, ox, oy);
          const al = land ? 'l' : 'c';
          return [
            note('ar-a', 'A BASTION SHELL · HELD BY FIELDS, NOT MATTER', Math.min(0.9, bx / w), by / h, ss(from + 2, from + 2.8, m.b) * (1 - ss(to - 1.2, to - 0.4, m.b)), { tone: 'accent', align: al }),
            note('ar-b', words, Math.min(0.9, bx / w), (by + S * 0.03) / h, ss(from + 2.6, from + 3.4, m.b) * (1 - ss(to - 1.2, to - 0.4, m.b)), { tone: 'dim', align: al }),
          ];
        },
      };
    };

    // ================================================================ the Great Decay

    /** A dead world, sparking away a proton at a time. */
    const dissolveWorld = (from: number, to: number): Scene => {
      const cx = land ? w * 0.4 : w * 0.5;
      const cy = land ? h * 0.47 : h * 0.38;
      const R0 = S * (land ? 0.25 : 0.28);
      const sparks = Array.from({ length: Math.round(520 * k) + 120 }, (_, i) => {
        const r = Math.sqrt(hash(390, i));
        const a = hash(391, i) * Math.PI * 2;
        return { u: Math.cos(a) * r, v: Math.sin(a) * r, f: 0.25 + hash(392, i) * 0.6, ph: hash(393, i) };
      });
      const leaving = Array.from({ length: Math.round(420 * k) + 100 }, (_, i) => ({ a: hash(394, i) * Math.PI * 2, v: 0.06 + hash(395, i) * 0.12, ph: hash(396, i), plus: hash(397, i) < 0.5, d: 0.5 + hash(398, i) }));
      const L: Pt = land ? [w * 0.77, h * 0.36] : [w * 0.5, h * 0.74];
      const RL = S * (land ? 0.13 : 0.12);
      const decayAt = from + 4.4;
      const q: Pt[] = [0, 1, 2].map((i) => [L[0] + Math.cos(-Math.PI / 2 + (i * Math.PI * 2) / 3) * RL * 0.22, L[1] + Math.sin(-Math.PI / 2 + (i * Math.PI * 2) / 3) * RL * 0.22] as const);
      const target: Pt = [cx + R0 * 0.38, cy - R0 * 0.22];
      return {
        from,
        to,
        assets: [sky, bigWorld],
        draw(c, m) {
          layer(c, sky.get(), w, h, M, 0, 0, 1.02 + 0.05 * m.p, 0.55);
          const R = R0 * (1 - 0.08 * ease(m.p));
          glow(c, cx, cy, R * 1.7, ACC, 0.1);
          const wd = bigWorld.get();
          disc(c, wd.paint(m.t * 0.05), cx, cy, R);
          // each spark a proton gone (its positron and gamma rays, as the instruments see them)
          c.save();
          c.globalCompositeOperation = 'lighter';
          const spark = tint(dotSprite(Math.max(3, S * 0.006 * pr)), [1, 0.96, 1]);
          for (const s of sparks) {
            const f = ((m.t * s.f + s.ph) % 1 + 1) % 1;
            const a = Math.pow(Math.max(0, 1 - f / 0.09), 1.5) * (1 - 0.5 * (s.u * s.u + s.v * s.v));
            if (a <= 0.02) continue;
            const sz = (spark.width / pr) * (0.6 + 0.8 * a);
            c.globalAlpha = a;
            c.drawImage(spark, cx + s.u * R - sz / 2, cy + s.v * R - sz / 2, sz, sz);
          }
          c.globalAlpha = 1;
          // and what leaves it: a haze of positrons and electrons going out from its limb
          for (const p of leaving) {
            const f = ((m.t * p.v + p.ph) % 1 + 1) % 1;
            const r = R * (1.01 + f * 0.9 * p.d);
            c.fillStyle = rgba(p.plus ? ACC : ELECTRON, 0.75 * (1 - f) * ss(0, 0.08, f));
            const sz = Math.max(1, S * 0.0026);
            c.fillRect(cx + Math.cos(p.a) * r - sz / 2, cy + Math.sin(p.a) * r - sz / 2, sz, sz);
          }
          c.restore();
          // the loupe: one proton, then what it becomes
          const lo = ss(from + 1.4, from + 2.8, m.b);
          if (lo > 0) {
            ink(c, [target, [L[0] + (target[0] < L[0] ? -RL : RL) * 0.72, L[1] + (target[1] < L[1] ? -RL : RL) * 0.7]], lo, { width: thin, color: INK, seed: 398, alpha: 0.4 });
            glow(c, target[0], target[1], S * 0.012, '#ffffff', 0.7 * lo);
            c.save();
            c.fillStyle = 'rgba(3,3,4,0.85)';
            c.beginPath();
            c.arc(L[0], L[1], RL, 0, Math.PI * 2);
            c.fill();
            c.restore();
            ink(c, circlePath(L[0], L[1], RL, 120, 399), lo, { width: Math.max(1, S * 0.0018), color: INK, seed: 399, alpha: 0.8 });
            const gone = ss(decayAt - 0.1, decayAt + 0.3, m.b);
            if (gone < 1) {
              c.save();
              c.globalAlpha = 1 - gone;
              ink(c, circlePath(L[0], L[1], RL * 0.4, 60, 400), ss(from + 2.2, from + 3, m.b), { width: thin, color: INK, seed: 400, alpha: 0.7 });
              q.forEach(([x, y], i) => {
                glow(c, x, y, RL * 0.09, i === 2 ? '#7fb2ff' : '#ff8a6a', 0.8 * ss(from + 2.4, from + 3, m.b));
                const [x2, y2] = q[(i + 1) % 3];
                ink(c, wavy([x, y], [x2, y2], 5, RL * 0.015, 1, m.t), ss(from + 2.8, from + 3.4, m.b), { width: thin, color: INK, seed: 401 + i, alpha: 0.45 });
              });
              c.restore();
            }
            glow(c, L[0], L[1], RL * 0.5, '#ffffff', 0.9 * ss(decayAt - 0.1, decayAt + 0.1, m.b) * (1 - ss(decayAt + 0.1, decayAt + 1, m.b)));
            const out = ss(decayAt, decayAt + 1.2, m.b);
            const e: Pt = [L[0] + RL * 0.78, L[1] - RL * 0.4];
            ink(c, [[L[0], L[1]], e], out, { width: Math.max(1, S * 0.0022), color: ACC, seed: 404, alpha: 0.9 });
            const pi: Pt = [L[0] - RL * 0.2, L[1] + RL * 0.3];
            ink(c, [[L[0], L[1]], pi], out, { width: Math.max(1, S * 0.0018), color: '#ffb38a', seed: 405, alpha: 0.8 });
            const g = ss(decayAt + 0.9, decayAt + 2, m.b);
            ink(c, wavy(pi, [L[0] - RL * 0.78, L[1] + RL * 0.1], 4, RL * 0.04, 1, m.t), g, { width: thin, color: '#fff1d6', seed: 406, alpha: 0.85 });
            ink(c, wavy(pi, [L[0] - RL * 0.05, L[1] + RL * 0.82], 4, RL * 0.04, 1, m.t), g, { width: thin, color: '#fff1d6', seed: 407, alpha: 0.85 });
          }
        },
        notes(m) {
          return [
            note('dw-a', 'A DEAD WORLD · SEEN BY ITS FAINT HEAT', cx / w, (cy + R0 + S * 0.05) / h, ss(from + 0.8, from + 1.6, m.b), { tone: 'dim', align: 'c' }),
            note('dw-b', 'EACH SPARK, A PROTON GOING', cx / w, (cy + R0 + S * 0.08) / h, ss(from + 2, from + 2.8, m.b), { tone: 'accent', align: 'c' }),
            note('dw-p', 'PROTON', L[0] / w, (L[1] + RL * 0.55) / h, ss(from + 2.6, from + 3.2, m.b) * (1 - ss(decayAt - 0.2, decayAt, m.b)), { tone: 'ink', align: 'c' }),
            note('dw-e', 'e⁺', (L[0] + RL * 0.82) / w, (L[1] - RL * 0.5) / h, ss(decayAt + 0.6, decayAt + 1.2, m.b), { tone: 'accent' }),
            note('dw-pi', 'π⁰ → γ γ', (L[0] - RL * 0.3) / w, (L[1] + RL * 0.36) / h, ss(decayAt + 0.8, decayAt + 1.4, m.b), { tone: 'ink', align: 'r' }),
            note('dw-l', 'p → e⁺ + π⁰', L[0] / w, (L[1] - RL - S * 0.025) / h, ss(decayAt + 0.4, decayAt + 1.2, m.b), { tone: 'accent', align: 'c' }),
          ];
        },
      };
    };

    /** The dead laid out, each dissolving in turn: a world, a white dwarf (it swells as it goes), a neutron star. */
    const specimens = (from: number, to: number): Scene => {
      const slots: Pt[] = land ? [0.25, 0.5, 0.75].map((x) => [w * x, h * 0.42] as const) : [0.24, 0.46, 0.68].map((y) => [w * 0.5, h * y] as const);
      const spec = S * (land ? 0.09 : 0.072);
      const clouds = [0, 1, 2].map((i) => new Stipple(410 + i, Math.round(420 * k) + 80, (r) => 1 - r * 0.6));
      const at = (i: number) => from + 2.4 + i * 1.6;
      const names = ['A WORLD', 'A WHITE DWARF', 'A NEUTRON STAR'];
      const facts = ['~4 × 10⁵¹ NUCLEONS', '~7 × 10⁵⁶ · SWELLING AS IT GOES', '~2 × 10⁵⁷'];
      return {
        from,
        to,
        fade: 1.5,
        assets: [sky, smallWorld, dwarfDisc],
        draw(c, m) {
          layer(c, sky.get(), w, h, M, w * 0.02 * m.p, 0, 1.1, 0.5);
          slots.forEach(([x, y], i) => {
            const u = ss(at(i), at(i) + 2.4, m.b);
            const on = ss(from + 0.2 + i * 0.4, from + 1.2 + i * 0.4, m.b);
            const alpha = on * (1 - u);
            if (alpha > 0) {
              c.save();
              c.globalAlpha = alpha;
              if (i === 0) disc(c, smallWorld.get().paint(m.t * 0.07), x, y, spec * (1 - 0.25 * u));
              else if (i === 1) {
                const R = spec * 0.55 * (1 + 0.35 * u);
                glow(c, x, y, R * 2.4, ACC, 0.25);
                disc(c, dwarfDisc.get(), x, y, R);
              } else {
                glow(c, x, y, spec * 1.2, '#cfd8ff', 0.5);
                glow(c, x, y, spec * 0.25, '#ffffff', 0.9);
              }
              c.restore();
            }
            // what it was, going out as light and a haze of electrons and positrons
            clouds[i].draw(c, x, y, spec * (0.9 + 1.8 * u), { color: i === 2 ? ELECTRON : ACC, dot: Math.max(1, S * 0.0024), show: u * 1.4, gone: ss(at(i) + 2.2, at(i) + 5, m.b), t: m.t, alpha: 0.85 });
            if (u > 0 && u < 1) {
              c.save();
              c.globalCompositeOperation = 'lighter';
              const spark = tint(dotSprite(Math.max(3, S * 0.005 * pr)), [1, 0.96, 1]);
              for (let j = 0; j < 90; j++) {
                const f = ((m.t * (0.5 + hash(420 + i, j) * 0.9) + hash(421 + i, j)) % 1 + 1) % 1;
                const a = Math.pow(Math.max(0, 1 - f / 0.1), 1.5) * Math.sin(Math.PI * u);
                if (a <= 0.02) continue;
                const rr = Math.sqrt(hash(422 + i, j)) * spec * (i === 2 ? 0.3 : 0.7);
                const aa = hash(423 + i, j) * Math.PI * 2;
                const sz = spark.width / pr;
                c.globalAlpha = a;
                c.drawImage(spark, x + Math.cos(aa) * rr - sz / 2, y + Math.sin(aa) * rr - sz / 2, sz, sz);
              }
              c.globalAlpha = 1;
              c.restore();
            }
            ink(c, [[x - spec * 1.1, y + spec * 1.45], [x + spec * 1.1, y + spec * 1.45]], on, { width: thin, color: INK, seed: 424 + i, alpha: 0.4 });
          });
        },
        notes(m) {
          return slots.flatMap(([x, y], i) => {
            const o = ss(from + 0.6 + i * 0.4, from + 1.4 + i * 0.4, m.b);
            return [note(`sp2-${i}`, names[i], x / w, (y + spec * 1.75) / h, o, { tone: 'accent', align: 'c' }), note(`sp2-f${i}`, facts[i], x / w, (y + spec * 1.75 + S * 0.03) / h, o * 0.85, { tone: 'dim', align: 'c' })];
          });
        },
      };
    };

    /** The haze that is left: electrons and positrons, drifting apart as space stretches; now and then a pair meets. */
    const haze = (from: number, to: number): Scene => {
      const motes = Array.from({ length: Math.round(900 * k * Math.sqrt(area)) + 160 }, (_, i) => ({ x: hash(430, i), y: hash(431, i), plus: hash(432, i) < 0.5, near: hash(433, i) < 0.22, ph: hash(434, i) }));
      const dotE = tint(dotSprite(Math.max(3, S * 0.009 * pr)), [0.66, 0.78, 1]);
      const dotP = tint(dotSprite(Math.max(3, S * 0.009 * pr)), [0.64, 0.55, 1]);
      const meets = Array.from({ length: 4 }, (_, i) => ({ at: from + 1.6 + i * 1.6 + hash(435, i) * 0.6, x: w * (0.36 + 0.5 * hash(436, i)), y: h * (0.3 + 0.38 * hash(437, i)), dir: hash(438, i) * Math.PI }));
      const legend = land ? { x: w * 0.09, y: h * 0.2 } : { x: w * 0.12, y: h * 0.14 };
      return {
        from,
        to,
        fade: 1.6,
        assets: [sky],
        draw(c, m) {
          const u = m.b - from;
          layer(c, sky.get(), w, h, M, -w * 0.02 * m.p, 0, 1.08 + 0.06 * m.p, 0.85);
          c.save();
          c.globalCompositeOperation = 'lighter';
          for (const p of motes) {
            // drifting apart: everything a little farther from everything else each beat
            const grow = Math.exp(u * (p.near ? 0.035 : 0.02));
            const x = w / 2 + (p.x * w * 1.2 - w * 0.6) * grow + noise1x(p.ph * 50, m.t * 0.25) * S * 0.012;
            const y = h / 2 + (p.y * h * 1.2 - h * 0.6) * grow + noise1x(p.ph * 70, m.t * 0.25) * S * 0.012;
            if (x < -10 || y < -10 || x > w + 10 || y > h + 10) continue;
            const spr = p.plus ? dotP : dotE;
            const sz = (spr.width / pr) * (p.near ? 1 : 0.45);
            c.globalAlpha = (p.near ? 0.95 : 0.55) * (0.75 + 0.25 * Math.sin(m.t * 1.7 + p.ph * 30));
            c.drawImage(spr, x - sz / 2, y - sz / 2, sz, sz);
          }
          c.globalAlpha = 1;
          // a pair meets: they close, flash, and two gamma rays leave back to back
          for (const e of meets) {
            const close = ss(e.at - 1.4, e.at, m.b);
            if (m.b < e.at) {
              const d = S * 0.06 * (1 - close);
              for (const s of [1, -1]) {
                const x = e.x + Math.cos(e.dir) * d * s;
                const y = e.y + Math.sin(e.dir) * d * s;
                glow(c, x, y, S * 0.008, s > 0 ? ACC : ELECTRON, 0.9 * ss(e.at - 1.6, e.at - 1.2, m.b));
              }
            }
            const f = ss(e.at - 0.05, e.at + 0.15, m.b) * (1 - ss(e.at + 0.15, e.at + 0.9, m.b));
            glow(c, e.x, e.y, S * 0.07, '#ffffff', f);
            glow(c, e.x, e.y, S * 0.015, '#ffffff', f);
            const g = ss(e.at, e.at + 1.6, m.b);
            if (g > 0 && g < 1) {
              const L = S * 0.3 * g;
              for (const s of [1, -1]) {
                const a2 = e.dir + Math.PI / 2;
                const tip: Pt = [e.x + Math.cos(a2) * L * s, e.y + Math.sin(a2) * L * s];
                const tail: Pt = [e.x + Math.cos(a2) * Math.max(0, L - S * 0.08) * s, e.y + Math.sin(a2) * Math.max(0, L - S * 0.08) * s];
                ink(c, wavy(tail, tip, 3, S * 0.005, 1, m.t), 1, { width: Math.max(1, S * 0.002), color: '#fff1d6', seed: 439, alpha: 0.95 * (1 - g) });
              }
            }
          }
          c.restore();
          // the legend
          const o = ss(from + 0.6, from + 1.6, m.b);
          glow(c, legend.x, legend.y, S * 0.008, ELECTRON, 0.9 * o);
          glow(c, legend.x, legend.y + S * 0.035, S * 0.008, ACC, 0.9 * o);
          ink(c, wavy([legend.x - S * 0.012, legend.y + S * 0.07], [legend.x + S * 0.012, legend.y + S * 0.07], 2, S * 0.003, 1, m.t), o, { width: thin, color: '#fff1d6', seed: 440, alpha: 0.85 });
        },
        notes(m) {
          const o = ss(from + 0.6, from + 1.6, m.b);
          const lx = (legend.x + S * 0.025) / w;
          return [
            note('hz-e', 'e⁻ · ELECTRON', lx, legend.y / h, o, { tone: 'ink' }),
            note('hz-p', 'e⁺ · POSITRON', lx, (legend.y + S * 0.035) / h, o, { tone: 'accent' }),
            note('hz-g', 'γ · LIGHT', lx, (legend.y + S * 0.07) / h, o, { tone: 'ink' }),
            note('hz-a', 'FALSE COLOUR · NONE OF IT GLOWS', lx, (legend.y + S * 0.11) / h, ss(from + 1.2, from + 2, m.b), { tone: 'dim' }),
            note('hz-b', 'NOW AND THEN A PAIR MEETS', meets[0].x / w, (meets[0].y + S * 0.06) / h, ss(meets[0].at, meets[0].at + 0.6, m.b) * (1 - ss(meets[0].at + 2.4, meets[0].at + 3, m.b)), { tone: 'accent', align: 'c' }),
          ];
        },
      };
    };

    // ================================================================ the Last Warmth, matter stable

    /** The game's own law for a neutron star's last heat (K) at η, and a black hole's Hawking temperature (K) for its mass in Suns. */
    const nsK = (eta: number) => 7e6 * Math.pow(10, -eta / 2);
    const holeK = (suns: number) => 6.17e-8 / suns;
    const kelvinText = (T: number) => {
      const e = Math.floor(Math.log10(T));
      return `${(T / Math.pow(10, e)).toFixed(1)} × ${pow10(e)} K`;
    };

    /** The last neutron star cooling below a black hole's glow, both seen by their faint heat. */
    const nsCool = (from: number, to: number): Scene => {
      const A: Pt = land ? [w * 0.32, h * 0.42] : [w * 0.5, h * 0.27];
      const B: Pt = land ? [w * 0.68, h * 0.42] : [w * 0.5, h * 0.6];
      const rb = S * 0.05;
      const etaAt = (b: number) => lerp(29.45, 30.4, ss(from + 1, to - 0.8, b));
      const crossAt = (() => {
        for (let b = from; b < to; b += 0.05) if (nsK(etaAt(b)) < holeK(10)) return b;
        return to;
      })();
      return {
        from,
        to,
        assets: [sky],
        draw(c, m) {
          layer(c, sky.get(), w, h, M, 0, 0, 1.04 + 0.04 * m.p, 0.5);
          const T = nsK(etaAt(m.b));
          const rel = clamp01((Math.log10(T) + 9) / 1.3);
          glow(c, A[0], A[1], S * (0.06 + 0.14 * rel), '#b9a6ff', 0.25 + 0.6 * rel);
          glow(c, A[0], A[1], S * 0.012, '#f2eefc', 0.4 + 0.6 * rel);
          plainHole(c, B[0], B[1], rb, S, { glow: 2.2, ring: 0.8 });
          glow(c, B[0], B[1], rb * 3, '#b9a6ff', 0.32);
          // their thermometers: a log scale from 10⁻⁷ K down to 10⁻⁹ K
          const o = ss(from + 0.6, from + 1.6, m.b);
          for (const [P, temp, seed] of [[A, T, 450], [B, holeK(10), 451]] as const) {
            const x0 = P[0] - S * 0.1;
            const x1 = P[0] + S * 0.1;
            const y = P[1] + S * 0.14;
            ink(c, [[x0, y], [x1, y]], o, { width: thin, color: INK, seed, alpha: 0.5 });
            const tx = lerp(x0, x1, clamp01((Math.log10(temp) + 9) / 2));
            glow(c, tx, y, S * 0.01, seed === 450 ? '#f2eefc' : ACC, 0.9 * o);
            for (const e of [-9, -8, -7]) figure(c, pow10(e), lerp(x0, x1, (e + 9) / 2), y + S * 0.025, S, o * 0.8);
          }
          if (m.b > crossAt) ink(c, circlePath(B[0], B[1], rb * 1.9, 80, 452), ss(crossAt, crossAt + 1, m.b), { width: thin, color: ACC, seed: 452, alpha: 0.8 });
        },
        notes(m) {
          const o = ss(from + 0.6, from + 1.6, m.b);
          const T = nsK(etaAt(m.b));
          return [
            note('nc-a', 'THE LAST NEUTRON STAR', A[0] / w, (A[1] - S * 0.1) / h, o, { tone: 'accent', align: 'c' }),
            note('nc-at', kelvinText(T), A[0] / w, (A[1] + S * 0.2) / h, o, { tone: 'ink', align: 'c' }),
            note('nc-b', 'A BLACK HOLE · TEN SUNS', B[0] / w, (B[1] - S * 0.1) / h, o, { tone: 'accent', align: 'c' }),
            note('nc-bt', kelvinText(holeK(10)), B[0] / w, (B[1] + S * 0.2) / h, o, { tone: 'ink', align: 'c' }),
            note('nc-c', 'SEEN BY THEIR FAINT HEAT · FALSE COLOUR', 0.5, land ? 0.2 : 0.43, ss(from + 1.2, from + 2, m.b), { tone: 'dim', align: 'c' }),
            note('nc-d', 'NOW THE HOLE IS THE WARMER', B[0] / w, (B[1] + S * 0.235) / h, ss(crossAt + 0.3, crossAt + 1.1, m.b), { tone: 'accent', align: 'c' }),
          ];
        },
      };
    };

    /** The crossing on a chart: the neutron stars' heat falling (the game's law), the holes' flat glow, the Last Warmth where they cross. */
    const crossing = (from: number, to: number): Scene => {
      const box = land ? { x0: w * 0.18, x1: w * 0.84, y0: h * 0.72, y1: h * 0.18 } : { x0: w * 0.14, x1: w * 0.88, y0: h * 0.7, y1: h * 0.24 };
      const X = (eta: number) => box.x0 + ((eta - 20) / 14) * (box.x1 - box.x0);
      const Y = (lg: number) => box.y0 + ((lg + 11) / 9) * (box.y1 - box.y0);
      const ns: Pt[] = Array.from({ length: 57 }, (_, i) => {
        const eta = 20 + (i / 56) * 14;
        return [X(eta), Y(Math.log10(nsK(eta)))] as const;
      });
      const hole: Pt[] = [[X(20), Y(Math.log10(holeK(10)))], [X(34), Y(Math.log10(holeK(10)))]];
      const crossEta = 2 * Math.log10(7e6 / holeK(10));
      const run = (b: number) => ss(from + 1.4, from + 5.6, b);
      return {
        from,
        to,
        fade: 1.5,
        assets: [sky],
        draw(c, m) {
          layer(c, sky.get(), w, h, M, 0, 0, 1.1, 0.35);
          const o = ss(from + 0.4, from + 1.4, m.b);
          axes(c, box.x0, box.y0, box.x1, box.y1, o, S, 460);
          for (const e of [20, 25, 30, 34]) figure(c, `η ${e}`, X(e), box.y0 + S * 0.03, S, o);
          for (const lg of [-10, -8, -6, -4, -2]) figure(c, pow10(lg), box.x0 - S * 0.02, Y(lg), S, o, 'right');
          ink(c, hole, ss(from + 1, from + 2.4, m.b), { width: Math.max(1, S * 0.0022), color: ACC, seed: 461, alpha: 0.9 });
          ink(c, ns, run(m.b), { width: Math.max(1, S * 0.0022), color: '#f2eefc', seed: 462, alpha: 0.9 });
          const i = Math.min(ns.length - 1, Math.floor(run(m.b) * (ns.length - 1)));
          if (run(m.b) > 0) glow(c, ns[i][0], ns[i][1], S * 0.014, '#f2eefc', 0.9);
          const cx = X(crossEta);
          const cy = Y(Math.log10(holeK(10)));
          const hit = ss((crossEta - 20) / 14, (crossEta - 20) / 14 + 0.05, run(m.b));
          if (hit > 0) {
            glow(c, cx, cy, S * 0.03 * (1 + Math.sin(m.t * 3) * 0.1), ACC, 0.9 * hit);
            ink(c, [[cx, box.y0], [cx, cy]], hit, { width: thin, color: INK, seed: 463, alpha: 0.45 });
          }
        },
        notes(m) {
          const o = ss(from + 0.4, from + 1.4, m.b);
          const hit = ss((crossEta - 20) / 14, (crossEta - 20) / 14 + 0.05, run(m.b));
          return [
            note('cr-y', 'TEMPERATURE · K', box.x0 / w, (box.y1 - S * 0.04) / h, o, { tone: 'dim' }),
            note('cr-ns', 'A NEUTRON STAR’S LAST HEAT', X(23) / w, (Y(Math.log10(nsK(23))) - S * 0.04) / h, ss(from + 2, from + 2.8, m.b), { tone: 'ink' }),
            note('cr-h', 'A BLACK HOLE OF TEN SUNS · ITS HAWKING GLOW', X(20.4) / w, (Y(Math.log10(holeK(10))) + S * 0.035) / h, ss(from + 1.6, from + 2.4, m.b), { tone: 'accent' }),
            note('cr-x', `THE LAST WARMTH · η ${crossEta.toFixed(1)}`, (X(crossEta) + S * 0.02) / w, (Y(Math.log10(holeK(10))) - S * 0.045) / h, hit, { tone: 'accent' }),
          ];
        },
      };
    };

    /** The ladder of temperatures: everything that was warm slides below the holes, which stay put. */
    const ladder = (from: number, to: number): Scene => {
      const ax = land ? w * 0.6 : w * 0.3;
      const top = land ? h * 0.13 : h * 0.32;
      const bot = land ? h * 0.66 : h * 0.72;
      const Y = (lg: number) => top + ((4 - lg) / 14) * (bot - top);
      const things = [
        { id: 'ld-r', text: 'A RED DWARF’S SURFACE', T0: Math.log10(3000), T1: -9.7, at: 0.4 },
        { id: 'ld-c', text: 'THE SKY’S AFTERGLOW, IN OUR DAY', T0: Math.log10(2.7), T1: -9.9, at: 1.2 },
        { id: 'ld-w', text: 'A WHITE DWARF, KEPT WARM', T0: Math.log10(63), T1: -9.4, at: 2 },
        { id: 'ld-n', text: 'THE LAST NEUTRON STAR', T0: Math.log10(900), T1: -8.75, at: 2.8 },
      ];
      const hole = Math.log10(holeK(10));
      const pos = (th: (typeof things)[number], b: number) => lerp(th.T0, th.T1, ease(ss(from + 1.2 + th.at, from + 5.6 + th.at * 0.5, b)));
      const hx = land ? w * 0.28 : w * 0.5;
      const hy = land ? h * 0.46 : h * 0.16;
      return {
        from,
        to,
        fade: 1.5,
        assets: [sky],
        draw(c, m) {
          layer(c, sky.get(), w, h, M, 0, 0, 1.12, 0.45);
          plainHole(c, hx, hy, S * 0.06, S, { glow: 1.6 });
          quanta(c, hx, hy, S * 0.06, m.t, S, { rate: 1.6, seed: 470, reach: S * 0.16, alpha: 0.5 });
          const o = ss(from + 0.4, from + 1.4, m.b);
          ink(c, [[ax, top], [ax, bot]], o, { width: Math.max(1, S * 0.0018), color: INK, seed: 471, alpha: 0.55 });
          for (let lg = 4; lg >= -10; lg -= 2) {
            ink(c, [[ax - S * 0.008, Y(lg)], [ax + S * 0.008, Y(lg)]], o, { width: thin, color: INK, seed: 472 + lg, alpha: 0.5 });
            figure(c, pow10(lg), ax - S * 0.02, Y(lg), S, o, 'right');
          }
          // the hole's mark: where it was all along
          const hy2 = Y(hole);
          ink(c, [[ax - S * 0.03, hy2], [ax + S * 0.03, hy2]], o, { width: Math.max(1, S * 0.003), color: ACC, seed: 480, alpha: 0.95 });
          ink(c, [land ? [hx + S * 0.07, hy] : [hx, hy + S * 0.07], [ax - S * 0.04, hy2]], ss(from + 0.8, from + 1.8, m.b), { width: thin, color: ACC, seed: 481, alpha: 0.35 });
          for (const th of things) {
            const lg = pos(th, m.b);
            const below = lg < hole;
            glow(c, ax, Y(lg), S * 0.012, below ? '#6d6a78' : '#f2eefc', (below ? 0.45 : 0.95) * ss(from + 0.6 + th.at * 0.3, from + 1.2 + th.at * 0.3, m.b));
          }
        },
        notes(m) {
          const o = ss(from + 0.4, from + 1.4, m.b);
          const side = land ? 'l' : 'l';
          return [
            note('ld-y', 'TEMPERATURE · K', ax / w, (top - S * 0.035) / h, o, { tone: 'dim', align: 'c' }),
            note('ld-h', 'A BLACK HOLE OF TEN SUNS', (ax + S * 0.045) / w, Y(hole) / h, o, { tone: 'accent', align: side }),
            ...things.map((th) => {
              const lg = pos(th, m.b);
              // (once well below the hole, a name goes quiet, all but the last neutron star's)
              const fade = ss(from + 0.8 + th.at * 0.3, from + 1.4 + th.at * 0.3, m.b) * (th.id === 'ld-n' ? (lg < hole ? 0.6 : 1) : 1 - ss(hole - 0.1, hole - 0.7, lg));
              return note(th.id, th.text, (ax + S * 0.045) / w, (Y(lg) + (Math.abs(lg - hole) < 0.5 ? S * 0.03 : 0)) / h, fade, { tone: lg < hole ? 'dim' : 'ink', align: side });
            }),
            note('ld-n2', 'NOW THE WARMEST THING THERE IS', (ax + S * 0.045) / w, (Y(hole) - S * 0.035) / h, ss(to - 3, to - 2.2, m.b), { tone: 'accent', align: side }),
          ];
        },
      };
    };

    /** Matter enduring, tunnelling toward iron: the curve of binding energy, the nuclei sliding to its peak. */
    const iron = (from: number, to: number): Scene => {
      const box = land ? { x0: w * 0.36, x1: w * 0.88, y0: h * 0.72, y1: h * 0.2 } : { x0: w * 0.14, x1: w * 0.88, y0: h * 0.78, y1: h * 0.46 };
      // binding energy per nucleon (MeV): the semi-empirical formula along the valley of stability
      const B = (A: number) => {
        if (A < 2) return 0;
        const Z = A / (2 + 0.0155 * Math.pow(A, 2 / 3));
        return Math.max(0, 15.75 - 17.8 * Math.pow(A, -1 / 3) - (0.711 * Z * Z) / Math.pow(A, 4 / 3) - (23.7 * (A - 2 * Z) ** 2) / (A * A));
      };
      const X = (A: number) => box.x0 + (Math.log10(A) / Math.log10(260)) * (box.x1 - box.x0);
      const Y = (be: number) => box.y0 + (be / 9.5) * (box.y1 - box.y0);
      const curve: Pt[] = Array.from({ length: 90 }, (_, i) => {
        const A = Math.pow(10, 0.6 + (i / 89) * (Math.log10(250) - 0.6));
        return [X(A), Y(B(A))] as const;
      });
      const real: [string, number, number][] = [
        ['H', 1, 0],
        ['He', 4, 7.07],
        ['C', 12, 7.68],
        ['O', 16, 7.98],
        ['Fe', 56, 8.79],
        ['U', 238, 7.57],
      ];
      const slide = Array.from({ length: 14 }, (_, i) => ({ A0: i < 9 ? 4 + hash(490, i) * 30 : 120 + hash(491, i) * 120, sp: 0.6 + hash(492, i) * 0.6 }));
      const cold: Pt = land ? [w * 0.18, h * 0.42] : [w * 0.5, h * 0.24];
      const R = S * (land ? 0.11 : 0.1);
      return {
        from,
        to,
        fade: 1.5,
        assets: [sky, smallWorld],
        draw(c, m) {
          layer(c, sky.get(), w, h, M, 0, 0, 1.1, 0.35);
          disc(c, smallWorld.get().paint(m.t * 0.04), cold[0], cold[1], R);
          const o = ss(from + 0.4, from + 1.4, m.b);
          axes(c, box.x0, box.y0, box.x1, box.y1, o, S, 493);
          for (const A of [1, 10, 100]) figure(c, String(A), X(A), box.y0 + S * 0.03, S, o);
          for (const be of [0, 4, 8]) figure(c, String(be), box.x0 - S * 0.02, Y(be), S, o, 'right');
          const draw = ss(from + 1, from + 3.6, m.b);
          ink(c, curve, draw, { width: Math.max(1, S * 0.0022), color: INK, seed: 494, alpha: 0.85 });
          real.forEach(([, A, be], i) => glow(c, X(A), Y(be), S * 0.01, i === 4 ? AMBER : SOFT, 0.9 * ss(from + 1.4 + i * 0.3, from + 2 + i * 0.3, m.b)));
          // nuclei sliding to the bottom of the valley, the light fusing up, the heavy splitting down
          const flow = ss(from + 3.4, to, m.b);
          c.save();
          c.globalCompositeOperation = 'lighter';
          for (const n of slide) {
            const A = Math.exp(lerp(Math.log(n.A0), Math.log(56), ease(clamp01(flow * n.sp * 1.3))));
            glow(c, X(A), Y(B(A)) - S * 0.008, S * 0.007, n.A0 < 56 ? '#9fd8ff' : '#ffb38a', 0.8 * flow);
          }
          c.restore();
        },
        notes(m) {
          const o = ss(from + 0.4, from + 1.4, m.b);
          return [
            note('ir-y', 'BINDING ENERGY PER NUCLEON · MeV', box.x0 / w, (box.y1 - S * 0.04) / h, o, { tone: 'dim' }),
            note('ir-x', 'NUCLEONS IN THE NUCLEUS', box.x1 / w, (box.y0 + S * 0.065) / h, o, { tone: 'dim', align: 'r' }),
            ...real.map(([el, A, be], i) => note(`ir-${el}`, el, (X(A) + S * 0.012) / w, (Y(be) - S * 0.02) / h, ss(from + 1.6 + i * 0.3, from + 2.2 + i * 0.3, m.b), { tone: i === 4 ? 'accent' : 'ink' })),
            note('ir-fe', 'IRON · THE BOTTOM OF THE VALLEY', X(56) / w, (Y(8.79) - S * 0.06) / h, ss(from + 3.4, from + 4.2, m.b), { tone: 'accent', align: 'c' }),
            note('ir-t', 'BY TUNNELLING · ALL OF IT BY 10¹⁵⁰⁰ YEARS', box.x1 / w, (box.y0 - S * 0.04) / h, ss(from + 4.4, from + 5.2, m.b), { tone: 'ink', align: 'r' }),
            note('ir-w', 'A DEAD WORLD · COLD AND DARK', cold[0] / w, (cold[1] + R + S * 0.04) / h, ss(from + 0.8, from + 1.6, m.b), { tone: 'dim', align: 'c' }),
          ];
        },
      };
    };

    /** Fuel, not a source: a dead world fed to a hole, its fall the only new light (an Accretion Engine). */
    const fuel = (from: number, to: number): Scene => {
      const hx = land ? w * 0.56 : w * 0.5;
      const hy = h * 0.47;
      const rs = S * 0.06;
      const disk: RingLook[] = [3.2, 3.8, 4.5, 5.3, 6.2].map((f, i) => ({ a: rs * f, incl: 0.16, n: 0, speed: 0.6 / f, color: [1, lerp(0.86, 0.55, i / 4), lerp(0.7, 0.3, i / 4)] as RGB, size: 1, thE: rs * 1.45, rsh: rs, band: 0.5 - i * 0.07, lights: 0, width: Math.max(1, S * (0.0048 - i * 0.0006)), seed: 500 + i, pr, beam: 0.42 - i * 0.05 }));
      const W0: Pt = land ? [w * 0.17, h * 0.3] : [w * 0.22, h * 0.2];
      const wr = S * 0.065;
      const stream = (u: number): Pt => {
        // from the world's near side, spiralling in to the disk's outer edge
        const ang = lerp(Math.atan2(W0[1] - hy, W0[0] - hx), Math.atan2(W0[1] - hy, W0[0] - hx) + 2.4, u);
        const r = lerp(Math.hypot(W0[0] - hx, W0[1] - hy) - wr, rs * 6.2, Math.pow(u, 0.8));
        return [hx + Math.cos(ang) * r, hy + Math.sin(ang) * r * lerp(1, 0.16, Math.pow(u, 0.6))];
      };
      return {
        from,
        to,
        fade: 1.5,
        assets: [sky, smallWorld],
        draw(c, m) {
          layer(c, sky.get(), w, h, M, w * 0.02 * m.p, 0, 1.12, 0.6);
          const on = ss(from + 0.6, from + 3, m.b);
          // the world, torn at its near edge
          disc(c, smallWorld.get().paint(m.t * 0.05), W0[0], W0[1], wr);
          c.save();
          c.globalCompositeOperation = 'lighter';
          c.lineCap = 'round';
          for (let i = 0; i < 60; i++) {
            const u0 = i / 60;
            const u1 = (i + 1) / 60;
            const [x0, y0] = stream(u0);
            const [x1, y1] = stream(u1);
            c.strokeStyle = `rgba(255,${Math.round(lerp(120, 225, u0))},${Math.round(lerp(90, 180, u0))},${0.35 * on * Math.min(1, u0 * 4)})`;
            c.lineWidth = Math.max(1, S * lerp(0.007, 0.0025, u0));
            c.beginPath();
            c.moveTo(x0, y0);
            c.lineTo(x1, y1);
            c.stroke();
          }
          // clumps going down it
          for (let i = 0; i < 40; i++) {
            const u = ((i / 40 + m.t * 0.07) % 1 + 1) % 1;
            const [x, y] = stream(u);
            glow(c, x, y, S * 0.008, '#ffd9a8', 0.6 * on * Math.sin(Math.PI * Math.min(1, u * 1.1)));
          }
          c.restore();
          for (const d of disk) drawRing(c, hx, hy, d, m.t, 'back', on);
          plainHole(c, hx, hy, rs, S, { glow: 0.6 });
          for (const d of disk) drawRing(c, hx, hy, d, m.t, 'front', on);
          glow(c, hx - rs * 3.4, hy, rs * 2.2, '#ffd9a8', 0.25 * on);
        },
        notes(m) {
          return [
            note('fu-a', 'AN ACCRETION ENGINE', land ? (hx + rs * 4.6) / w : 0.5, land ? (hy - rs * 2.4) / h : (hy + rs * 3.4) / h, ss(from + 1.6, from + 2.4, m.b), { tone: 'accent', align: land ? 'l' : 'c' }),
            note('fu-b', 'UP TO 42% OF WHAT FALLS, AS LIGHT', land ? (hx + rs * 4.6) / w : 0.5, land ? (hy - rs * 2.4 + S * 0.03) / h : (hy + rs * 3.4 + S * 0.03) / h, ss(from + 2.2, from + 3, m.b), { tone: 'dim', align: land ? 'l' : 'c' }),
            note('fu-c', 'A DEAD WORLD, FED TO IT', W0[0] / w, (W0[1] + wr + S * 0.04) / h, ss(from + 1, from + 1.8, m.b), { tone: 'ink', align: 'c' }),
            note('fu-d', 'THE SIDE COMING TOWARD US, BRIGHTER', land ? (hx - rs * 5) / w : 0.5, land ? (hy + rs * 1.6) / h : (hy + rs * 3.4 + S * 0.06) / h, ss(from + 3.4, from + 4.2, m.b), { tone: 'dim', align: 'c' }),
          ];
        },
      };
    };

    // ================================================================ the Last Warmth, curvature radiation

    /** A neutron star at a tenth of a Sun, swollen as it lost its mass, bursting. */
    const nsBurst = (from: number, to: number): Scene => {
      const cx = w * 0.5;
      const cy = h * 0.45;
      const go = from + 3.4;
      const debris = new Stipple(510, Math.round(700 * k) + 120, (r) => 0.3 + 0.7 * r);
      const lines: Pt[][] = [0.6, 0.9, 1.3].flatMap((L) =>
        [1, -1].map((side) =>
          Array.from({ length: 40 }, (_, i) => {
            const th = 0.15 + (i / 39) * (Math.PI - 0.3);
            const r = L * Math.sin(th) ** 2;
            return [side * Math.sin(th) * r, -Math.cos(th) * r] as const;
          }),
        ),
      );
      return {
        from,
        to,
        assets: [sky],
        draw(c, m) {
          layer(c, sky.get(), w, h, M, 0, 0, 1.04 + 0.05 * m.p, 0.5);
          const pre = 1 - ss(go - 0.1, go + 0.1, m.b);
          const R = S * lerp(0.03, 0.055, ss(from, go, m.b));
          if (pre > 0) {
            c.save();
            c.globalAlpha = pre * ss(from + 0.2, from + 1.4, m.b);
            c.translate(cx, cy);
            c.rotate(0.3);
            lines.forEach((ln, i) => ink(c, ln.map(([a, b]) => [a * S * 0.17, b * S * 0.17] as const), 1, { width: thin, color: ACC, seed: 511 + i, alpha: 0.4 }));
            c.restore();
            glow(c, cx, cy, R * 4, '#b9a6ff', 0.5 * pre);
            glow(c, cx, cy, R, '#f2eefc', 0.95 * pre);
          }
          const flash = ss(go - 0.1, go + 0.15, m.b) * (1 - ss(go + 0.15, go + 1.8, m.b));
          glow(c, cx, cy, S * 0.34, '#f4efff', 0.9 * flash);
          glow(c, cx, cy, S * 0.06, '#ffffff', flash);
          const u = ss(go, go + 7, m.b);
          if (u > 0) {
            for (let i = 0; i < 3; i++) ink(c, circlePath(cx, cy, S * (0.03 + (0.5 - i * 0.11) * Math.sqrt(u)), 140, 520 + i), 1, { width: Math.max(1, S * 0.0018), color: i ? ACC : SOFT, seed: 520 + i, alpha: 0.75 * (1 - u * 0.8) });
            debris.draw(c, cx, cy, S * (0.05 + 0.45 * Math.sqrt(u)), { color: SOFT, dot: Math.max(1, S * 0.0022), show: 1, gone: ss(go + 3.5, go + 8, m.b) * 0.8, t: m.t, alpha: 0.85 });
          }
        },
        notes(m) {
          return [
            note('nb-a', 'A NEUTRON STAR · A TENTH OF A SUN LEFT', 0.5, (cy + S * 0.12) / h, ss(from + 0.6, from + 1.4, m.b) * (1 - ss(go - 0.4, go, m.b)), { tone: 'accent', align: 'c' }),
            note('nb-b', 'SWOLLEN AS IT LOST ITS MASS', 0.5, (cy + S * 0.15) / h, ss(from + 1.2, from + 2, m.b) * (1 - ss(go - 0.4, go, m.b)), { tone: 'dim', align: 'c' }),
            note('nb-c', 'ITS LAST FLASH · PARTICLES AND NEUTRINOS', 0.5, (cy + S * 0.2) / h, ss(go + 1, go + 1.8, m.b), { tone: 'accent', align: 'c' }),
          ];
        },
      };
    };

    /** Its long loss on a chart: the mass held for most of 10⁶⁸ years, then falling to the floor. */
    const massCurve = (from: number, to: number): Scene => {
      const box = land ? { x0: w * 0.14, x1: w * 0.86, y0: h * 0.7, y1: h * 0.22 } : { x0: w * 0.14, x1: w * 0.88, y0: h * 0.68, y1: h * 0.26 };
      const X = (eta: number) => box.x0 + ((eta - 14) / (70 - 14)) * (box.x1 - box.x0);
      const Y = (mass: number) => box.y0 + (mass / 1.6) * (box.y1 - box.y0);
      // a lifetime process: almost all of its mass kept until the last few decades of η
      const mOf = (eta: number) => Math.max(0.1, 1.4 * Math.pow(Math.max(0, 1 - Math.pow(10, eta - 68)), 0.35));
      const line: Pt[] = Array.from({ length: 141 }, (_, i) => {
        const eta = 14 + (i / 140) * (68 - 14);
        return [X(eta), Y(mOf(eta))] as const;
      });
      const run = (b: number) => ss(from + 1.6, from + 9.5, b);
      return {
        from,
        to,
        fade: 1.5,
        assets: [sky],
        draw(c, m) {
          // the chart is wide: the camera walks along it to the burst
          const pan = -w * 0.06 * ease(ss(from + 6, to - 1, m.b));
          layer(c, sky.get(), w, h, M, pan * 0.3, 0, 1.12, 0.35);
          c.save();
          c.translate(pan, 0);
          const o = ss(from + 0.4, from + 1.4, m.b);
          axes(c, box.x0, box.y0, box.x1, box.y1, o, S, 530);
          for (const e of [14, 30, 50, 68]) figure(c, `η ${e}`, X(e), box.y0 + S * 0.03, S, o);
          for (const mass of [0.1, 0.5, 1, 1.4]) figure(c, mass.toFixed(1), box.x0 - S * 0.02, Y(mass), S, o, 'right');
          // the floor: the least a neutron star can be
          for (let i = 0; i < 24; i++) {
            const x = lerp(box.x0, box.x1, i / 24);
            ink(c, [[x, Y(0.1)], [x + (box.x1 - box.x0) / 48, Y(0.1)]], ss(from + 1, from + 2.4, m.b), { width: thin, color: ACC, seed: 531 + i, alpha: 0.6 });
          }
          ink(c, line, run(m.b), { width: Math.max(1, S * 0.0024), color: '#f2eefc', seed: 560, alpha: 0.9 });
          const i = Math.min(line.length - 1, Math.floor(run(m.b) * (line.length - 1)));
          if (run(m.b) > 0) glow(c, line[i][0], line[i][1], S * 0.014, '#f2eefc', 0.9);
          const burst = ss(0.98, 1, run(m.b));
          if (burst > 0) {
            const [bx, by] = line[line.length - 1];
            glow(c, bx, by, S * 0.08 * (1 + 0.3 * Math.sin(m.t * 4)), '#f4efff', 0.9 * burst);
            for (let k2 = 0; k2 < 8; k2++) {
              const a = (k2 / 8) * Math.PI * 2;
              ink(c, [[bx + Math.cos(a) * S * 0.02, by + Math.sin(a) * S * 0.02], [bx + Math.cos(a) * S * 0.05, by + Math.sin(a) * S * 0.05]], burst, { width: thin, color: SOFT, seed: 561 + k2, alpha: 0.8 });
            }
          }
          c.restore();
        },
        notes(m) {
          const pan = -w * 0.06 * ease(ss(from + 6, to - 1, m.b));
          const o = ss(from + 0.4, from + 1.4, m.b);
          const px = (x: number) => (x + pan) / w;
          return [
            note('mc-y', 'MASS · SUNS', px(box.x0), (box.y1 - S * 0.04) / h, o, { tone: 'dim' }),
            note('mc-f', 'THE LEAST A NEUTRON STAR CAN BE', px(X(20)), (Y(0.1) - S * 0.03) / h, ss(from + 2, from + 2.8, m.b), { tone: 'accent' }),
            note('mc-g', 'GIVEN, A LITTLE AT A TIME, TO THE CURVATURE OF SPACE', px(X(22)), (Y(1.4) - S * 0.04) / h, ss(from + 3, from + 3.8, m.b), { tone: 'ink' }),
            note('mc-b', 'BURST · η 68', px(X(68)), (Y(0.1) - S * 0.09) / h, ss(0.98, 1, run(m.b)), { tone: 'accent', align: 'r' }),
          ];
        },
      };
    };

    /** The dwarfs and worlds that remain, cold and dark, being unmade: pairs born of space's bending near them, leaving. */
    const unmaking = (from: number, to: number): Scene => {
      const slots: Pt[] = land ? [0.24, 0.5, 0.76].map((x) => [w * x, h * 0.42] as const) : [0.24, 0.46, 0.68].map((y) => [w * 0.5, h * y] as const);
      const spec = S * (land ? 0.08 : 0.065);
      return {
        from,
        to,
        fade: 1.5,
        assets: [sky, dwarfDisc, brownDisc, smallWorld],
        draw(c, m) {
          layer(c, sky.get(), w, h, M, -w * 0.02 * m.p, 0, 1.1, 0.5);
          slots.forEach(([x, y], i) => {
            const on = ss(from + 0.2 + i * 0.5, from + 1.2 + i * 0.5, m.b);
            if (on <= 0) return;
            c.save();
            c.globalAlpha = on;
            if (i === 0) {
              glow(c, x, y, spec * 1.4, ACC, 0.15);
              disc(c, dwarfDisc.get(), x, y, spec * 0.5);
            } else if (i === 1) disc(c, brownDisc.get(), x, y, spec * 0.85);
            else disc(c, smallWorld.get().paint(m.t * 0.06), x, y, spec * 0.75);
            c.restore();
            // pairs appearing near it, out of the curvature, and leaving
            c.save();
            c.globalCompositeOperation = 'lighter';
            const R = spec * (i === 0 ? 0.5 : i === 1 ? 0.85 : 0.75);
            for (let j = 0; j < 36; j++) {
              const f = ((m.t * (0.2 + hash(570 + i, j) * 0.25) + hash(571 + i, j)) % 1 + 1) % 1;
              const a0 = hash(572 + i, j) * Math.PI * 2;
              const r = R * (1.05 + f * 1.6);
              const spread = 0.05 + f * 0.08;
              for (const s of [1, -1]) {
                c.fillStyle = rgba(s > 0 ? ACC : ELECTRON, 0.7 * on * Math.sin(Math.PI * f));
                const sz = Math.max(1, S * 0.0018);
                c.fillRect(x + Math.cos(a0 + s * spread) * r - sz / 2, y + Math.sin(a0 + s * spread) * r - sz / 2, sz, sz);
              }
            }
            c.restore();
          });
        },
        notes(m) {
          const names = ['WHITE DWARFS', 'BROWN DWARFS', 'WORLDS'];
          return [
            ...slots.map(([x, y], i) => note(`um-${i}`, names[i], x / w, (y + spec * 1.6) / h, ss(from + 0.6 + i * 0.5, from + 1.4 + i * 0.5, m.b), { tone: 'accent', align: 'c' })),
            note('um-a', 'CURVATURE RADIATION · PAIRS FROM SPACE’S BENDING', 0.5, land ? 0.2 : 0.1, ss(from + 2, from + 2.8, m.b), { tone: 'dim', align: 'c' }),
          ];
        },
      };
    };

    /** The dates they go, on the age's ruler: the heaviest white dwarfs first, every world by η 89.5. */
    const fateRuler = (from: number, to: number): Scene => {
      // along the frame on a wide screen; down it on a phone, the names beside the ruler
      const P = (eta: number): Pt => {
        const u = (eta - 68) / (92 - 68);
        return land ? [lerp(w * 0.1, w * 0.9, u), h * 0.52] : [w * 0.3, lerp(h * 0.18, h * 0.72, u)];
      };
      const marks = [
        { eta: 78.5, id: 'fr-1', text: 'THE HEAVIEST WHITE DWARFS', kind: 0 },
        { eta: 82, id: 'fr-2', text: 'A TYPICAL ONE', kind: 0 },
        { eta: 85, id: 'fr-3', text: 'THE LIGHTEST', kind: 0 },
        { eta: 87, id: 'fr-4', text: 'BROWN DWARFS', kind: 1 },
        { eta: 89.5, id: 'fr-5', text: 'EVERY WORLD', kind: 2 },
      ];
      /** Where a mark's picture sits, off the ruler: above and below it in turn, or to its left. */
      const icon = (eta: number, i: number): Pt => {
        const [x, y] = P(eta);
        return land ? [x, y - (i % 2 ? -1 : 1) * S * 0.11] : [x - S * 0.12, y];
      };
      const sweep = (b: number) => lerp(68, 91, ss(from + 1.6, to - 1, b));
      const tick = (eta: number, len: number): Pt[] => {
        const [x, y] = P(eta);
        return land ? [[x, y - len], [x, y + len]] : [[x - len, y], [x + len, y]];
      };
      return {
        from,
        to,
        fade: 1.5,
        assets: [sky, dwarfDisc, brownDisc, smallWorld],
        draw(c, m) {
          layer(c, sky.get(), w, h, M, 0, 0, 1.1, 0.35);
          const o = ss(from + 0.4, from + 1.4, m.b);
          ink(c, [P(68), P(92)], o, { width: Math.max(1, S * 0.0018), color: INK, seed: 580, alpha: 0.55 });
          for (let e = 68; e <= 92; e += 2) ink(c, tick(e, S * 0.006), o, { width: thin, color: INK, seed: 581 + e, alpha: 0.45 });
          for (const e of [70, 80, 90]) {
            const [x, y] = P(e);
            figure(c, `η ${e}`, land ? x : x - S * 0.025, land ? y + S * 0.035 : y, S, o, land ? 'center' : 'right');
          }
          const now = sweep(m.b);
          ink(c, [P(68), P(now)], 1, { width: Math.max(1, S * 0.003), color: ACC, seed: 582, alpha: 0.8 });
          glow(c, P(now)[0], P(now)[1], S * 0.012, SOFT, 0.9 * o);
          marks.forEach((mk, i) => {
            const [x, y] = P(mk.eta);
            const [ix, iy] = icon(mk.eta, i);
            const gone = ss(mk.eta - 0.2, mk.eta + 0.6, now);
            const show = ss(from + 0.8 + i * 0.3, from + 1.4 + i * 0.3, m.b);
            ink(c, [[x, y], [lerp(x, ix, 0.62), lerp(y, iy, 0.62)]], show, { width: thin, color: INK, seed: 590 + i, alpha: 0.4 });
            if (show <= 0) return;
            c.save();
            c.globalAlpha = show * (1 - gone);
            const r = S * (land ? 0.03 : 0.024);
            if (mk.kind === 0) disc(c, dwarfDisc.get(), ix, iy, r * (1 - i * 0.12));
            else if (mk.kind === 1) disc(c, brownDisc.get(), ix, iy, r);
            else disc(c, smallWorld.get().paint(m.t * 0.06), ix, iy, r);
            c.restore();
            if (gone > 0 && gone < 1) glow(c, ix, iy, S * 0.04, SOFT, 0.6 * Math.sin(Math.PI * gone));
          });
        },
        notes(m) {
          const now = sweep(m.b);
          return marks.map((mk, i) => {
            const [x, y] = P(mk.eta);
            const [ix, iy] = icon(mk.eta, i);
            const up = i % 2 ? -1 : 1;
            const at: Pt = land ? [ix, iy - up * S * 0.055] : [x + S * 0.05, y];
            return note(mk.id, `${mk.text} · η ${mk.eta}`, at[0] / w, at[1] / h, ss(from + 1 + i * 0.3, from + 1.6 + i * 0.3, m.b) * (now > mk.eta + 0.6 ? 0.45 : 1), { tone: now > mk.eta ? 'dim' : 'ink', align: land ? 'c' : 'l' });
          });
        },
      };
    };

    // ================================================================ the versions

    const card = (c: Ctx, m: Moment) => heroHole(c, m, { z: 0.7 + 0.06 * m.p, ox: 0, oy: -h * 0.06, sky: 0.5, lens: 0.45, ring: collectors(RSH * 3.3, 0.2), ringFade: 0.35 });

    if (fate === 'decay') {
      return {
        numeral: 'III',
        title: 'The Black Hole Age',
        sub: `Age III · ${name}`,
        titleAt: 68,
        eta: [38.6, 40],
        narration: [
          { from: 0.8, to: 7.4, text: 'Ordinary matter has decayed away.' },
          { from: 8.4, to: 15, text: 'Planets, white dwarfs and neutron stars have dissolved' },
          { from: 15.8, to: 22.4, text: 'into radiation and a thin haze of electrons and positrons.' },
          { from: 23.4, to: 30, text: 'Only the black holes remain.' },
          { from: 31.2, to: 38, text: 'They spin,' },
          { from: 39.2, to: 46, text: 'and they very slowly evaporate.' },
          { from: 57.4, to: 67.4, text: 'Whatever you are now, you live around them.' },
        ],
        scenes: [dissolveWorld(0, 8.5), specimens(8, 16), haze(15.5, 23), holeReveal(22.5, 31), kerr(30.5, 39), hawking(38.5, 47), leaving(46.5, 56, true), around(55.5, 68.5, 'WHERE WE LIVE NOW')],
        card,
      };
    }
    if (fate === 'curvature') {
      return {
        numeral: 'III',
        title: 'The Black Hole Age',
        sub: `Age III · ${name}`,
        titleAt: 68,
        eta: [67.7, 68.6],
        narration: [
          { from: 0.8, to: 4.8, text: 'The neutron stars have burst.' },
          { from: 5.6, to: 14.6, text: 'For 10⁶⁸ years each gave its mass, a little at a time, to the curvature of space around it;' },
          { from: 15.4, to: 21.4, text: 'at a tenth of a Sun it could hold together no longer.' },
          { from: 22.4, to: 27.4, text: 'They were the last things warm of their own accord.' },
          { from: 28, to: 33.4, text: 'Now the black holes are the warmest things in the universe,' },
          { from: 34, to: 38.4, text: 'and the lightest of them are already bursting too.' },
          { from: 39, to: 46.6, text: 'White dwarfs, brown dwarfs and worlds remain, cold and dark, and space is unmaking them as well, slowly:' },
          { from: 47.4, to: 54, text: 'the dwarfs will fade by η 85, every world by η 90.' },
          { from: 61.6, to: 67.4, text: 'Whatever you are now, you live around the holes.' },
        ],
        scenes: [nsBurst(0, 8), massCurve(7.5, 22), holeReveal(21.5, 30), leaving(29.5, 38.5, false), unmaking(38, 47), fateRuler(46.5, 54.5), kerr(54, 61.5), around(61, 68.5, 'WHERE WE LIVE NOW')],
        card,
      };
    }
    return {
      numeral: 'III',
      title: 'The Black Hole Age',
      sub: `Age III · ${name}`,
      titleAt: 68,
      eta: [29.9, 30.3],
      narration: [
        { from: 0.8, to: 6.8, text: 'The protons held, and nothing marked the moment:' },
        { from: 7.8, to: 14.2, text: 'the neutron stars, the last things warm of their own accord,' },
        { from: 15, to: 21.6, text: 'have cooled below the faint glow of the black holes.' },
        { from: 22.4, to: 30, text: 'For the whole life of the universe the holes were the coldest things in it; now they are the warmest.' },
        { from: 30.8, to: 37.6, text: 'Matter endures, cold and dark, slowly tunnelling toward iron,' },
        { from: 38.4, to: 45.6, text: 'and the dead stars and worlds are fuel now, not sources.' },
        { from: 46.6, to: 53.4, text: 'The holes spin,' },
        { from: 54.4, to: 60.6, text: 'and they very slowly evaporate.' },
        { from: 61.4, to: 67.4, text: 'Whatever you are now, you live around them.' },
      ],
      scenes: [nsCool(0, 8), crossing(7.5, 15.5), holeReveal(15, 22.5), ladder(22, 30.5), iron(30, 38.5), fuel(38, 46.5), kerr(46, 54.5), hawking(54, 61.5), around(61, 68.5, 'WHERE WE LIVE NOW')],
      card,
    };
  });
}

/** Smooth value noise (−1..1) for a mote's own wander. */
function noise1x(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash(Math.round(seed), i) * (1 - u) + hash(Math.round(seed), i + 1) * u) * 2 - 1;
}
