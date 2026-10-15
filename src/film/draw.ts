import { Rng } from '../game/rng';

// The films' drawing kit (the new version, part 4): every frame is drawn by code on one 2D
// canvas, from the film's time alone, so the same moment always draws the same picture, at any
// frame rate, in the game or exported frame by frame. The look borrows from three things: an ink
// line that draws itself, a timecoded reel with frame corners and mono labels cut on the beat,
// and hatched, stippled, grained illustration.

export type Ctx = CanvasRenderingContext2D;
export type Pt = readonly [number, number];

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** 0 below a, 1 above b, smooth between. */
export const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smooth value noise in one dimension (deterministic by seed): -1..1. */
export function noise1(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number) => {
    let v = Math.imul((n + seed * 374761393) | 0, 668265263);
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
  };
  const u = f * f * (3 - 2 * f);
  return (h(i) * (1 - u) + h(i + 1) * u) * 2 - 1;
}

/** A colour with an alpha, from #rrggbb. */
export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/**
 * Ink: a stroke along `path` drawn up to `reveal` (0..1) of its length, its width swelling and
 * thinning as a pen's does and wavering a little, with a wet blot at its head while it draws.
 */
export function ink(c: Ctx, path: readonly Pt[], reveal: number, o: { width: number; color: string; seed: number; alpha?: number }) {
  if (reveal <= 0 || path.length < 2) return;
  const lens = [0];
  for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const L = lens[lens.length - 1];
  const upto = L * clamp01(reveal);
  c.save();
  c.strokeStyle = o.color;
  c.globalAlpha = o.alpha ?? 1;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  let head: Pt = path[0];
  for (let i = 1; i < path.length; i++) {
    const s0 = lens[i - 1];
    if (s0 >= upto) break;
    const s1 = Math.min(lens[i], upto);
    const k = lens[i] > s0 ? (s1 - s0) / (lens[i] - s0) : 1;
    const [x0, y0] = path[i - 1];
    const x1 = x0 + (path[i][0] - x0) * k;
    const y1 = y0 + (path[i][1] - y0) * k;
    const s = (s0 + s1) / 2 / L;
    c.lineWidth = o.width * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, s * 1.15))) * (0.85 + 0.3 * noise1(o.seed, s * 12));
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
    head = [x1, y1];
  }
  if (reveal < 1) {
    c.fillStyle = o.color;
    c.beginPath();
    c.arc(head[0], head[1], o.width * 0.75, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/** A circle (or an arc from a0 to a1) as a path of n points, a little out of round as a hand draws it. */
export function circlePath(cx: number, cy: number, r: number, n = 96, seed = 1, a0 = 0, a1 = Math.PI * 2, squash = 1): Pt[] {
  const out: Pt[] = [];
  // a few slow bumps round the whole circle, never more than a few pixels' worth
  const amp = Math.min(r * 0.012, 4);
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const rr = r + amp * noise1(seed, (a / (Math.PI * 2)) * 7);
    out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * squash]);
  }
  return out;
}

/**
 * Stipple: dots laid out once (seeded) by a density over the unit disc, drawn as small squares.
 * Each has its own order, so `show` (0..1) brings them in one by one and `gone` (0..1) takes them
 * away the other way round.
 */
export class Stipple {
  private pts: Float32Array;
  readonly n: number;
  constructor(seed: number, n: number, density: (r: number) => number) {
    const rng = new Rng(seed);
    const pts: number[] = [];
    let guard = 0;
    while (pts.length / 4 < n && guard++ < n * 60) {
      const x = rng.range(-1, 1);
      const y = rng.range(-1, 1);
      const r = Math.hypot(x, y);
      if (r > 1 || rng.next() > density(r)) continue;
      pts.push(x, y, rng.range(0.6, 1.4), rng.next());
    }
    this.pts = new Float32Array(pts);
    this.n = pts.length / 4;
  }
  draw(c: Ctx, cx: number, cy: number, R: number, o: { color: string; dot: number; show?: number; gone?: number; alpha?: number; t?: number }) {
    const show = o.show ?? 1;
    const gone = o.gone ?? 0;
    c.save();
    c.fillStyle = o.color;
    for (let i = 0; i < this.n; i++) {
      const ord = this.pts[i * 4 + 3];
      if (ord > show || 1 - ord < gone) continue;
      const s = o.dot * this.pts[i * 4 + 2];
      // a slow shimmer, dot by dot, on the film's time
      c.globalAlpha = (o.alpha ?? 1) * (o.t === undefined ? 1 : 0.7 + 0.3 * Math.sin(o.t * 2.1 + ord * 40));
      c.fillRect(cx + this.pts[i * 4] * R - s / 2, cy + this.pts[i * 4 + 1] * R - s / 2, s, s);
    }
    c.restore();
  }
}

/**
 * Hatching on a sphere lit from one side: strokes across the disc where it is in shadow, a second
 * layer crossing them where the shadow is deepest, and the terminator left soft. Laid out once;
 * `reveal` draws the strokes in from the dark limb toward the light.
 */
export class Hatch {
  private segs: number[] = [];
  constructor(seed: number, lines: number, light: Pt, angle = -0.5) {
    const rng = new Rng(seed);
    const [lx, ly] = light;
    const ll = Math.hypot(lx, ly) || 1;
    const shadeAt = (x: number, y: number) => {
      const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
      // lit from the side (and a little from the front, so the terminator lies across the disc)
      return clamp01(-((x * lx + y * ly) / ll) * 0.9 + z * 0.1 + 0.15);
    };
    for (const [layer, ang, from] of [
      [0, angle, 0.38],
      [1, angle + 1.05, 0.66],
    ] as const) {
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      for (let i = 0; i < lines; i++) {
        const off = -1 + (2 * (i + rng.range(0.2, 0.8))) / lines;
        let start: number | null = null;
        const steps = 40;
        for (let j = 0; j <= steps; j++) {
          const u = -1 + (2 * j) / steps;
          const x = ca * u - sa * off;
          const y = sa * u + ca * off;
          const inside = x * x + y * y < 0.985;
          const dark = inside && shadeAt(x, y) > from + 0.05 * rng.range(-1, 1);
          if (dark && start === null) start = u;
          if ((!dark || j === steps) && start !== null) {
            const end = u;
            if (end - start > 0.04) {
              const x0 = ca * start - sa * off;
              const y0 = sa * start + ca * off;
              const x1 = ca * end - sa * off;
              const y1 = sa * end + ca * off;
              this.segs.push(x0, y0, x1, y1, layer, shadeAt((x0 + x1) / 2, (y0 + y1) / 2));
            }
            start = null;
          }
        }
      }
    }
  }
  draw(c: Ctx, cx: number, cy: number, R: number, o: { color: string; width: number; reveal?: number; alpha?: number }) {
    const reveal = o.reveal ?? 1;
    c.save();
    c.strokeStyle = o.color;
    c.lineCap = 'round';
    for (let i = 0; i < this.segs.length; i += 6) {
      const shade = this.segs[i + 5];
      // the darkest strokes come first
      if (1 - shade > reveal) continue;
      c.globalAlpha = (o.alpha ?? 1) * (0.55 + 0.45 * shade);
      c.lineWidth = o.width * (this.segs[i + 4] ? 0.8 : 1);
      c.beginPath();
      c.moveTo(cx + this.segs[i] * R, cy + this.segs[i + 1] * R);
      c.lineTo(cx + this.segs[i + 2] * R, cy + this.segs[i + 3] * R);
      c.stroke();
    }
    c.restore();
  }
}

/** A soft glow, added to what is there. */
export function glow(c: Ctx, x: number, y: number, r: number, color: string, alpha: number) {
  if (alpha <= 0 || r <= 0) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.35, rgba(color, alpha * 0.35));
  g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}

let grainTile: HTMLCanvasElement | null = null;

/** The grain's noise tile, 256 pixels square, made once (the same noise every time). */
export function grainTile256(): HTMLCanvasElement {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = grainTile.height = 256;
    const g = grainTile.getContext('2d')!;
    const img = g.createImageData(256, 256);
    const rng = new Rng(7);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(rng.next() * 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  return grainTile;
}

/** Where the grain's tile sits at film time `t`: it moves 24 times a second of film time. */
export function grainOffset(t: number): [number, number] {
  const k = Math.floor(t * 24);
  return [(k * 97) % 256, (k * 57) % 256];
}

/** Film grain: a noise tile made once, laid over the frame at an offset that changes 24 times a second of film time. */
export function grain(c: Ctx, w: number, h: number, t: number, alpha: number) {
  if (alpha <= 0) return;
  const tile = grainTile256();
  const [ox, oy] = grainOffset(t);
  c.save();
  c.globalAlpha = alpha;
  c.globalCompositeOperation = 'overlay';
  const pat = c.createPattern(tile, 'repeat');
  if (pat) {
    c.translate(-ox, -oy);
    c.fillStyle = pat;
    c.fillRect(ox, oy, w, h);
  }
  c.restore();
}

/** The reel's frame corners: an L at each corner, inked in as `reveal` goes from 0 to 1. */
export function corners(c: Ctx, w: number, h: number, reveal: number, color: string, seed = 3) {
  const m = Math.min(w, h) * 0.05;
  const l = Math.min(w, h) * 0.06;
  const lw = Math.max(1, Math.min(w, h) * 0.0022);
  const at: [number, number, number, number][] = [
    [m, m, 1, 1],
    [w - m, m, -1, 1],
    [m, h - m, 1, -1],
    [w - m, h - m, -1, -1],
  ];
  at.forEach(([x, y, sx, sy], i) => {
    ink(c, [[x, y + sy * l], [x, y], [x + sx * l, y]], ss(i * 0.12, 0.6 + i * 0.12, reveal), { width: lw, color, seed: seed + i, alpha: 0.85 });
  });
}

/** A vignette: the frame's edges a little darker, as an old lens leaves them. */
export function vignette(c: Ctx, w: number, h: number, strength: number) {
  c.save();
  const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.restore();
}
