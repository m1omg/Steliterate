import { Rng } from '../game/rng';
import { glow, ink, lerp, rgba, ss, type Ctx, type Pt } from './draw';
import { Lazy, Perlin, canvas, clamp01, css, dotSprite, tint, type RGB } from './paint';

// What the films of the black holes and after share: the lens a hole makes of what is behind it
// (the point-lens equation, for each light and each line), rings and paths round a hole, a hole's
// shadow and photon ring, its Hawking quanta, the charts' axes and figures, light drawn as a wave,
// and the sky of the late ages (black but for our own far lights, and the haze where matter decayed).

export const INK = '#e6dccb';
export const ACC = '#a48dff';
export const SOFT = '#d2c6ff';
export const AMBER = '#ffbf73';
export const AMBER_RGB: RGB = [1, 0.76, 0.46];
export const TEAL_RGB: RGB = [0.5, 0.85, 1];
export const ELECTRON = '#a9c8ff';

/** A number of its own for (seed, k), 0..1. */
export function hash(seed: number, k: number): number {
  let v = Math.imul((k + seed * 374761393) | 0, 668265263);
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}

/**
 * The two images a point lens makes of a point at (dx, dy) from it (the point-lens equation,
 * θ = (β ± √(β² + 4θE²)) / 2): the outer on the point's own side, pushed out; the inner on the far
 * side, close in and faint; each with its magnification (capped: right behind the hole it is a ring).
 */
export function lensed(dx: number, dy: number, thE: number): [number, number, number][] {
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
export interface RingLook {
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

export function ringAt(r: RingLook, phi: number) {
  const along = r.a * Math.sin(phi);
  return { x: r.a * Math.cos(phi), y: -along * Math.sin(r.incl), depth: along * Math.cos(r.incl) };
}

/**
 * A ring round a hole at (hx, hy): its far half (`back`) bent by the hole (outward over the top, and
 * a faint second image hugging the shadow below), or its near half (`front`), crossing the shadow
 * unbent. Drawn back, then the hole's shadow, then front.
 */
export function drawRing(c: Ctx, hx: number, hy: number, r: RingLook, t: number, part: 'back' | 'front', fade = 1) {
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
export function seen(x: number, up: number, far: number, incl: number): [number, number, number] {
  return [x, -(up * Math.cos(incl) + far * Math.sin(incl)), far * Math.cos(incl) - up * Math.sin(incl)];
}

/** A path round a hole at (hx, hy), its points (x, y, depth) from it: drawn where it is behind (bent round the shadow) or in front, by `part`. */
export function lensedPath(c: Ctx, hx: number, hy: number, pts: readonly (readonly [number, number, number])[], part: 'back' | 'front', o: { thE: number; reach: number; rsh: number; color: string; alpha: number; width: number }) {
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
export function plainHole(c: Ctx, x: number, y: number, rsh: number, S: number, o: { glow?: number; ring?: number; color?: string } = {}) {
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
export function quanta(c: Ctx, x: number, y: number, rsh: number, t: number, S: number, o: { rate: number; seed: number; color?: string; alpha?: number; reach?: number; life?: number; lam?: number }) {
  const life = o.life ?? 1.8;
  const n = Math.ceil(o.rate * life) + 1;
  // (a crest a hole-and-a-half long: the real peak is longer still, some six shadow radii)
  const lam = o.lam ?? rsh * 3;
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
export function figure(c: Ctx, text: string, x: number, y: number, S: number, alpha: number, align: CanvasTextAlign = 'center') {
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
export function axes(c: Ctx, x0: number, y0: number, x1: number, y1: number, reveal: number, S: number, seed: number) {
  ink(c, [[x0, y1], [x0, y0], [x1, y0]], reveal, { width: Math.max(1, S * 0.0016), color: INK, seed, alpha: 0.55 });
}

/** A wavy line from a to b: light (a photon), `waves` crests long, drawn up to `reveal`. */
export function wavy(a: Pt, b: Pt, waves: number, amp: number, reveal: number, t: number): Pt[] {
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
export function paintDark(w: number, h: number, o: { seed: number; n: number; haze: number; scale: number }): Lazy<HTMLCanvasElement> {
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

/** Smooth value noise (−1..1) for a mote's own wander. */
export function noise1x(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash(Math.round(seed), i) * (1 - u) + hash(Math.round(seed), i + 1) * u) * 2 - 1;
}

/** A settlement of fields, not matter (the game's look for life after matter): dipole field lines round an axis, standing rings, minds riding the lines, breathing. */
export function lattice(c: Ctx, x: number, y: number, R: number, t: number, S: number, o: { color: string; node: string; alpha: number; incl?: number; seed: number; lines?: number }) {
  if (o.alpha <= 0 || R <= 0) return;
  const incl = o.incl ?? 0.3;
  const breath = 1 + 0.04 * Math.sin(t * 0.9 + o.seed);
  const spin = t * 0.08 + o.seed;
  const n = o.lines ?? 8;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.lineWidth = Math.max(1, S * 0.0013);
  for (let j = 0; j < n; j++) {
    const az = (j / n) * Math.PI * 2 + spin;
    const L = (j % 2 ? 0.8 : 1) * R * breath;
    c.strokeStyle = rgba(o.color, o.alpha * (0.38 + 0.14 * Math.sin(t * 1.3 + j)));
    c.beginPath();
    for (let i = 0; i <= 48; i++) {
      const th = 0.15 + (i / 48) * (Math.PI - 0.3);
      const r = L * Math.sin(th) ** 2;
      const [px, py] = seen(r * Math.sin(th) * Math.cos(az), r * Math.cos(th), r * Math.sin(th) * Math.sin(az), incl);
      if (i === 0) c.moveTo(x + px, y + py);
      else c.lineTo(x + px, y + py);
    }
    c.stroke();
    // a mind, riding it
    const u = (((t * 0.07 + j * 0.37 + o.seed) % 1) + 1) % 1;
    const th = 0.15 + u * (Math.PI - 0.3);
    const r = L * Math.sin(th) ** 2;
    const [px, py] = seen(r * Math.sin(th) * Math.cos(az), r * Math.cos(th), r * Math.sin(th) * Math.sin(az), incl);
    glow(c, x + px, y + py, Math.max(2, R * 0.08), o.node, o.alpha * 0.9);
  }
  for (const up of [-0.35, 0, 0.35]) {
    const rho = R * (0.72 - Math.abs(up) * 0.6) * breath;
    c.strokeStyle = rgba(o.color, o.alpha * 0.5);
    c.beginPath();
    for (let i = 0; i <= 64; i++) {
      const ph = (i / 64) * Math.PI * 2;
      const [px, py] = seen(rho * Math.cos(ph), up * R, rho * Math.sin(ph), incl);
      if (i === 0) c.moveTo(x + px, y + py);
      else c.lineTo(x + px, y + py);
    }
    c.stroke();
  }
  glow(c, x, y, R * 0.6, o.color, o.alpha * 0.14);
  c.restore();
}

/** Pairs born of space's bending near a body at (x, y), radius R, flying off: electrons and positrons, `rate` a second. */
export function pairs(c: Ctx, x: number, y: number, R: number, t: number, S: number, o: { n: number; seed: number; alpha: number; speed?: number }) {
  if (o.alpha <= 0) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  const sz = Math.max(1, S * 0.0022);
  for (let j = 0; j < o.n; j++) {
    const f = (((t * (o.speed ?? 0.25) * (0.6 + hash(o.seed, j)) + hash(o.seed + 1, j)) % 1) + 1) % 1;
    const a0 = hash(o.seed + 2, j) * Math.PI * 2;
    const r = R * (1.02 + f * 1.4);
    const spread = 0.04 + f * 0.1;
    for (const s of [1, -1]) {
      c.fillStyle = rgba(s > 0 ? '#a48dff' : ELECTRON, o.alpha * 0.8 * Math.sin(Math.PI * f));
      c.fillRect(x + Math.cos(a0 + s * spread) * r - sz / 2, y + Math.sin(a0 + s * spread) * r - sz / 2, sz, sz);
    }
  }
  c.restore();
}
