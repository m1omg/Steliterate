import { circlePath, glow, ink, lerp, rgba, ss, type Ctx, type Pt } from './draw';
import type { EndingId, FilmDef, FilmId } from './films';
import { camera, landscape, layer, skyRatio } from './kit';
import { HEAT_LUT, Lazy, Perlin, World, canvas, paintStar, paintWorldMap } from './paint';
import { ease, note, reel2, type Moment, type ReelSpec, type Scene } from './reel';
import { figure, hash, lattice, paintDark, plainHole, seen } from './holes';

// The endings, second cut: a film for each, in three or four scenes, on the words of its own
// epilogue and nothing they do not say. Victories in gold, endurance in sea-green, the Hunger in
// rust-red, defeats in grey. Each is drawn as the films before it are: cold things by their faint
// heat, settlements after matter as lattices of fields, charts inked in, and where the words lean
// on real physics (Dyson's endless thinking, Penrose's aeons, Poincaré's return), the chart says
// whose idea it is.

const GOLD = '#f2c46d';
const GOLD_SOFT = '#ffe2a8';
const SEA = '#9fd8c8';
const RUST = '#d0502c';
const GREY = '#9aa3b0';
const GSOFT = '#c9ced6';
const TEAL = '#7fd8ff';
const INK = '#e6dccb';
const AMBER = '#ffbf73';
/** The Threads, each its own colour: Kin, Echoes, Chorus, Lattice, Coldminds. */
const THREADS: { name: string; color: string }[] = [
  { name: 'KIN', color: '#ffbf73' },
  { name: 'ECHOES', color: '#7fd8ff' },
  { name: 'CHORUS', color: '#a48dff' },
  { name: 'LATTICE', color: '#9fd8c8' },
  { name: 'COLDMINDS', color: '#cfe3ff' },
];

type Kind = 'victory' | 'endurance' | 'dark' | 'defeat';
const ACCENT: Record<Kind, string> = { victory: GOLD, endurance: SEA, dark: RUST, defeat: GREY };
const SUB: Record<Kind, string> = { victory: 'Victory', endurance: 'Endurance', dark: 'The Hunger', defeat: 'Defeat' };

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

/** The thermal palette's colour at a level (0..1), as hex. */
function heatHex(L: number): string {
  const i = Math.max(0, Math.min(255, Math.round(L * 255))) * 3;
  return hex(HEAT_LUT[i], HEAT_LUT[i + 1], HEAT_LUT[i + 2]);
}

/** Two hex colours mixed. */
function mixHex(a: string, b: string, u: number): string {
  const p = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  const k = Math.max(0, Math.min(1, u));
  return hex(lerp(p(a, 0), p(b, 0), k), lerp(p(a, 1), p(b, 1), k), lerp(p(a, 2), p(b, 2), k));
}

/** What every ending's film has to hand: its frame, its sky, a dead world of iron, an ember. */
interface Kit {
  w: number;
  h: number;
  S: number;
  k: number;
  pr: number;
  land: boolean;
  thin: number;
  cx: number;
  cy: number;
  sky: Lazy<HTMLCanvasElement>;
  M: number;
  ironWorld: Lazy<World>;
  ember: Lazy<HTMLCanvasElement>;
}

/** An ending's film: 36 beats at 84, the title at 31; `make` lays out its scenes and words. */
function ending(id: FilmId, name: string, kind: Kind, make: (kit: Kit) => Pick<ReelSpec, 'narration' | 'scenes'> & { card?: ReelSpec['card'] }): FilmDef {
  return reel2({ id, name, bpm: 84, beats: 36, accent: ACCENT[kind] }, (w, h, S, k, args) => {
    const pr = args.pr ?? 1;
    const M = 1.3;
    const spx = (x: number) => Math.round(x * skyRatio(w, h, M, pr));
    const scale = Math.max(1, (S / 900) * pr);
    const area = (w * h) / (1600 * 900);
    const sky = paintDark(spx(w * M), spx(h * M), { seed: 900 + id.length, n: Math.round(90 * k * area) + 20, haze: 0, scale });
    const ironMap = paintWorldMap(Math.round(320 * (0.6 + 0.4 * k)), {
      seed: 901,
      sea: 0,
      ice: 0.7,
      cloud: 0,
      palette: { deep: [0.1, 0.1, 0.11], shallow: [0.14, 0.14, 0.15], low: [0.22, 0.21, 0.22], high: [0.46, 0.44, 0.46], ice: [0.62, 0.65, 0.7], cloud: [0, 0, 0], air: [0, 0, 0], lights: [0, 0, 0] },
    });
    const ironWorld = new Lazy(function* () {
      const mp = ironMap.get();
      yield;
      return new World(Math.round(S * 0.24 * 2 * pr), mp, { light: [-0.55, 0.35, 0.75], sun: [0.42, 0.45, 0.55], tilt: 0.3, air: [0, 0, 0], lights: [0, 0, 0], airThick: 0 });
    });
    const ember = paintStar(Math.round(S * 0.06 * 2 * pr), { T: 2500, seed: 902, limb: [0.55, 0.3], cells: 14, grain: 0.2 });
    const kit: Kit = { w, h, S, k, pr, land: landscape(w, h), thin: Math.max(1, S * 0.0014), cx: w * 0.5, cy: h * 0.45, sky, M, ironWorld, ember };
    const r = make(kit);
    return {
      numeral: kind === 'defeat' ? '∅' : 'Ω',
      title: name,
      sub: SUB[kind],
      titleAt: 31,
      eta: [args.eta ?? 120, (args.eta ?? 120) + 0.2],
      narration: r.narration,
      scenes: r.scenes,
      card:
        r.card ??
        ((c, m) => {
          layer(c, sky.get(), w, h, M, 0, 0, 1 + 0.04 * m.p, 0.45);
        }),
    };
  });
}

const disc = (c: Ctx, img: HTMLCanvasElement, x: number, y: number, R: number) => c.drawImage(img, x - R, y - R, R * 2, R * 2);

/** A ring seen from a little above, as a lattice's rings are: radius r, `squash` as tall as wide. */
const ellipse = (x: number, y: number, r: number, seed: number, squash = 0.42) => circlePath(x, y, r, 140, seed, 0, Math.PI * 2, squash);

/** A quantity on a chart: a soft fill and its outline inked. */
function bar(c: Ctx, x: number, y: number, bw: number, bh: number, color: string, alpha: number, S: number, seed: number) {
  if (bh <= 0.5 || alpha <= 0) return;
  c.fillStyle = rgba(color, 0.42 * alpha);
  c.fillRect(x - bw / 2, y - bh, bw, bh);
  ink(c, [[x - bw / 2, y], [x - bw / 2, y - bh], [x + bw / 2, y - bh], [x + bw / 2, y]], 1, { width: Math.max(1, S * 0.0016), color, seed, alpha: 0.85 * alpha });
}

// ================================================================ The Long Thought

const LONG_THOUGHT = ending('end_long_thought', 'The Long Thought', 'victory', (K) => {
  const { w, h, S, cx, cy, thin, sky, M, land } = K;
  // the thoughts: each further from the last than the one before (×1.35)
  const times: number[] = [];
  for (let t = 1.2, gap = 0.55; t < 14.2; t += gap, gap *= 1.35) times.push(t);
  const LX = w * 0.5;
  const LY = h * (land ? 0.35 : 0.33);
  const R = S * (land ? 0.19 : 0.22);
  const tl = { x0: w * 0.1, x1: w * 0.9, y: h * (land ? 0.67 : 0.6) };
  const T = (b: number) => tl.x0 + (b / 14.2) * (tl.x1 - tl.x0);
  /** A mind of fields thinking: it flashes at each thought and sends a ring out into the dark. */
  const thinking = (c: Ctx, x: number, y: number, r: number, b: number, t: number, ts: number[]) => {
    const last = ts.filter((q) => q <= b).pop() ?? -99;
    const age = b - last;
    const pulse = Math.max(0, 1 - age / 0.5);
    lattice(c, x, y, r, t, S, { color: TEAL, node: '#dff6ff', alpha: 0.45 + 0.55 * pulse, incl: 0.3, seed: 910, lines: 12 });
    glow(c, x, y, r * 1.4, '#dff6ff', 0.32 * pulse);
    if (age < 3) ink(c, ellipse(x, y, r * (0.95 + age * 0.75), 913), 1, { width: thin, color: '#dff6ff', seed: 913, alpha: 0.55 * (1 - age / 3) });
  };
  const thoughts: Scene = {
    from: 0,
    to: 15,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.04 + 0.03 * m.p, 0.5);
      thinking(c, LX, LY, R, m.b, m.t, times);
      // the timeline: each thought a tick, the sleep after it an arc, longer each time
      ink(c, [[tl.x0, tl.y], [Math.min(tl.x1, T(m.b) + S * 0.02), tl.y]], 1, { width: thin, color: INK, seed: 911, alpha: 0.4 });
      times.forEach((t, i) => {
        if (t > m.b) return;
        const fresh = Math.max(0, 1 - (m.b - t) / 0.6);
        ink(c, [[T(t), tl.y - S * 0.016], [T(t), tl.y + S * 0.016]], ss(t, t + 0.25, m.b), { width: Math.max(1, S * 0.0022), color: GOLD, seed: 912 + i, alpha: 0.95 });
        glow(c, T(t), tl.y, S * 0.02, GOLD_SOFT, 0.8 * fresh);
        const nx = times[i + 1] ?? 14.2;
        const rise = S * 0.012 * Math.min(4, (nx - t) / 0.55);
        const arc: Pt[] = Array.from({ length: 24 }, (_, j) => [lerp(T(t), T(nx), j / 23), tl.y - S * 0.022 - Math.sin((j / 23) * Math.PI) * rise] as const);
        ink(c, arc, ss(t + 0.15, nx, m.b), { width: thin, color: GSOFT, seed: 930 + i, alpha: 0.35 });
      });
    },
    notes(m) {
      return [
        note('lt-a', 'EACH THOUGHT', tl.x0 / w, (tl.y + S * 0.045) / h, ss(1.4, 2.2, m.b), { tone: 'accent' }),
        note('lt-b', 'AND THE SLEEP AFTER IT · LONGER EACH TIME', tl.x0 / w, (tl.y + S * 0.072) / h, ss(4, 4.8, m.b), { tone: 'dim' }),
      ];
    },
  };
  // the sum: what is spent comes to a finite store; the thoughts still add up (Dyson 1979)
  const box = land ? { x0: w * 0.14, x1: w * 0.8, y0: h * 0.68, y1: h * 0.2 } : { x0: w * 0.12, x1: w * 0.78, y0: h * 0.62, y1: h * 0.28 };
  const N = 60;
  const spent = (u: number) => 1 - Math.pow(0.9, u * N);
  const count = (u: number) => (1.16 * Math.log(1 + u * N)) / Math.log(1 + N);
  const P = (u: number, v: number): Pt => [lerp(box.x0, box.x1, u), lerp(box.y0, box.y1, v * 0.8)];
  const storeY = P(0, 1)[1];
  const sum: Scene = {
    from: 14.5,
    to: 23,
    fade: 1.5,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.1, 0.35);
      const o = ss(14.8, 15.8, m.b);
      ink(c, [[box.x0, box.y1], [box.x0, box.y0], [box.x1 + S * 0.04, box.y0]], o, { width: Math.max(1, S * 0.0016), color: INK, seed: 940, alpha: 0.55 });
      // the store: a line the spending never passes
      for (let i = 0; i < 34; i++) ink(c, [[lerp(box.x0, box.x1, i / 34), storeY], [lerp(box.x0, box.x1, (i + 0.55) / 34), storeY]], o, { width: thin, color: GOLD, seed: 941 + i, alpha: 0.65 });
      const run = ss(15.2, 19.4, m.b);
      const sp: Pt[] = Array.from({ length: 91 }, (_, i) => P((i / 90) * run, spent((i / 90) * run)));
      const th: Pt[] = Array.from({ length: 91 }, (_, i) => P((i / 90) * run, count((i / 90) * run)));
      ink(c, sp, 1, { width: Math.max(1, S * 0.0024), color: GOLD_SOFT, seed: 942, alpha: 0.95 });
      ink(c, th, 1, { width: Math.max(1, S * 0.0024), color: TEAL, seed: 943, alpha: 0.95 });
      if (run > 0) {
        glow(c, sp[90][0], sp[90][1], S * 0.014, GOLD_SOFT, 0.9);
        glow(c, th[90][0], th[90][1], S * 0.014, TEAL, 0.9);
      }
      // past the chart's edge: on, as far as anyone is left to look
      const on = ss(19.4, 20.6, m.b);
      if (on > 0) {
        const [ex, ey] = P(1, count(1));
        for (let i = 0; i < 9; i++) {
          const u0 = i / 9;
          if (u0 > on) break;
          ink(c, [[ex + u0 * S * 0.16, ey - u0 * S * 0.03], [ex + (u0 + 0.06) * S * 0.16, ey - (u0 + 0.06) * S * 0.03]], 1, { width: thin, color: TEAL, seed: 944 + i, alpha: 0.8 * (1 - u0) });
        }
      }
      figure(c, 'TIME', box.x1 + S * 0.04, box.y0 + S * 0.025, S, o, 'right');
    },
    notes(m) {
      const [ex, ey] = P(1, count(1));
      return [
        note('lt-c', 'THE STORE · FINITE', (box.x0 + S * 0.015) / w, (storeY - S * 0.022) / h, ss(14.8, 15.8, m.b), { tone: 'accent' }),
        note('lt-d', 'ENERGY SPENT · NEVER PASSING IT', box.x1 / w, (storeY + S * 0.05) / h, ss(18.6, 19.4, m.b), { tone: 'ink', align: 'r' }),
        note('lt-e', 'THOUGHTS · STILL ADDING UP', ex / w, (ey - S * 0.035) / h, ss(19.6, 20.4, m.b), { tone: 'accent', align: 'r' }),
        note('lt-f', 'DYSON, 1979 · IN A UNIVERSE THAT COOLS FOR EVER', box.x0 / w, (box.y0 + S * 0.05) / h, ss(17.2, 18, m.b), { tone: 'dim' }),
      ];
    },
  };
  const later = [24.2, 25.4, 27.6, 31];
  const keep: Scene = {
    from: 22.5,
    to: 31.5,
    fade: 1.6,
    assets: [sky],
    draw(c, m) {
      const z = 1.25 - 0.55 * ease(m.p);
      layer(c, sky.get(), w, h, M, 0, 0, 1.0 + 0.08 * z, 0.55);
      thinking(c, cx, cy, S * 0.14 * z, m.b, m.t, later);
    },
  };
  return {
    narration: [
      { from: 0.8, to: 7.6, text: 'You slow until each thought takes longer than the one before,' },
      { from: 8.4, to: 14.4, text: 'and you sleep between them for longer still.' },
      { from: 15.2, to: 22.4, text: 'With a finite store and an endless night, the sum still grows.' },
      { from: 23.2, to: 30.6, text: 'Whether it grows forever, no one in the universe is left to check. You keep thinking.' },
    ],
    scenes: [thoughts, sum, keep],
  };
});

// ================================================================ One Voice

const ONE_VOICE = ending('end_one_voice', 'One Voice', 'victory', (K) => {
  const { w, h, S, cx, cy, sky, M, land, k } = K;
  const x0 = w * 0.08;
  const x1 = w * 0.94;
  const y0 = (i: number) => h * (land ? 0.2 + i * 0.1 : 0.22 + i * 0.08);
  const knot = 0.72;
  /** A strand's points as far as `upto` (0..1 of the way across), each with its depth in the braid (+ in front). */
  const strand = (i: number, b: number, upto: number): [number, number, number][] => {
    const out: [number, number, number][] = [];
    const n = 140;
    for (let j = 0; j <= n * upto; j++) {
      const u = j / n;
      const conv = ss(0.08, 0.42, u);
      const A = S * 0.055 * ss(0.22, 0.42, u) * (1 - ss(0.6, knot, u));
      const ph = (i / THREADS.length) * Math.PI * 2 + u * 24 - b * 0.35;
      out.push([lerp(x0, x1, u), lerp(y0(i), cy, conv) + A * Math.sin(ph), A > 0.5 ? Math.cos(ph) : 1]);
    }
    return out;
  };
  /** The runs of a strand behind the others (or in front of them). */
  const runs = (pts: [number, number, number][], front: boolean): Pt[][] => {
    const out: Pt[][] = [];
    let cur: Pt[] = [];
    for (const [x, y, d] of pts) {
      if (d >= 0 === front) cur.push([x, y]);
      else if (cur.length) {
        cur.push([x, y]);
        out.push(cur);
        cur = [];
      }
    }
    if (cur.length > 1) out.push(cur);
    return out;
  };
  const braid: Scene = {
    from: 0,
    to: 9,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.04 + 0.02 * m.p, 0.45);
      const all = THREADS.map((_, i) => strand(i, m.b, ss(0.4 + i * 0.2, 5 + i * 0.2, m.b) * knot));
      const width = Math.max(1, S * 0.0028);
      all.forEach((p, i) => runs(p, false).forEach((r) => ink(c, r, 1, { width, color: THREADS[i].color, seed: 960 + i, alpha: 0.32 })));
      all.forEach((p, i) => runs(p, true).forEach((r) => ink(c, r, 1, { width, color: THREADS[i].color, seed: 960 + i, alpha: 0.92 })));
      // the braid done: one strand, in gold
      const one = ss(5.6, 7.6, m.b);
      if (one > 0) {
        const xk = lerp(x0, x1, knot);
        ink(c, [[xk, cy], [lerp(xk, x1, one), cy]], 1, { width: Math.max(1, S * 0.006), color: GOLD_SOFT, seed: 966, alpha: 0.95 });
        glow(c, xk, cy, S * 0.05, GOLD_SOFT, 0.75 * ss(5.4, 6, m.b));
        glow(c, lerp(xk, x1, one), cy, S * 0.02, '#ffffff', 0.8 * (1 - ss(7.4, 8, m.b)));
      }
    },
    notes(m) {
      return [
        ...THREADS.map((t, i) => note(`ov-${i}`, t.name, x0 / w, (y0(i) - S * 0.025) / h, ss(0.6 + i * 0.2, 1.4 + i * 0.2, m.b), { tone: 'ink' })),
        note('ov-1v', 'ONE VOICE', lerp(x0, x1, (1 + knot) / 2) / w, (cy - S * 0.045) / h, ss(6.4, 7.2, m.b), { tone: 'accent', align: 'c' }),
      ];
    },
  };
  const memories = Array.from({ length: Math.round(170 * k) + 50 }, (_, i) => ({ a: hash(970, i) * Math.PI * 2, r: Math.sqrt(hash(971, i)), sp: (0.1 + hash(972, i) * 0.25) * (hash(976, i) > 0.5 ? 1 : -1), col: THREADS[Math.floor(hash(973, i) * THREADS.length)].color, ph: hash(974, i), up: hash(975, i) - 0.5 }));
  const R = S * (land ? 0.26 : 0.3);
  const MY = h * (land ? 0.42 : 0.4);
  /** Where a memory is in the one mind, at radius r. */
  const memAt = (mm: (typeof memories)[number], r: number, t: number) => {
    const a = mm.a + t * mm.sp;
    return seen(Math.cos(a) * mm.r * r * 0.7, mm.up * r * 0.5, Math.sin(a) * mm.r * r * 0.7, 0.3);
  };
  /** The one who remains: a mind of fields in gold, every memory the crowd had moving in it, in their colours. */
  const oneMind = (c: Ctx, x: number, y: number, r: number, t: number) => {
    lattice(c, x, y, r, t, S, { color: GOLD, node: GOLD_SOFT, alpha: 0.8, incl: 0.3, seed: 975, lines: 14 });
    c.save();
    c.globalCompositeOperation = 'lighter';
    const s = Math.max(1.5, S * 0.0035);
    for (const mm of memories) {
      const [px, py] = memAt(mm, r, t);
      c.fillStyle = rgba(mm.col, 0.85 * (0.55 + 0.45 * Math.sin(t * 1.7 + mm.ph * 20)));
      c.fillRect(x + px - s / 2, y + py - s / 2, s, s);
    }
    c.restore();
  };
  const mind: Scene = {
    from: 8.5,
    to: 16.5,
    fade: 1.5,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.08 - 0.03 * m.p, 0.45);
      const r = R * (0.92 + 0.08 * ease(m.p));
      oneMind(c, cx, MY, r, m.t);
      // now and then a memory brightens: an argument, remembered
      for (let i = 0; i < 3; i++) {
        const cyc = m.t * 0.35 + i / 3;
        const mm = memories[Math.floor(hash(977, Math.floor(cyc) * 3 + i) * memories.length)];
        const [px, py] = memAt(mm, r, m.t);
        glow(c, cx + px, MY + py, S * 0.03, mm.col, 0.7 * Math.sin(Math.PI * (cyc % 1)));
      }
    },
    notes(m) {
      return [
        note('ov-a', 'ONE MIND', 0.5, (MY - R * 0.62 - S * 0.06) / h, ss(9.4, 10.2, m.b), { tone: 'accent', align: 'c' }),
        note('ov-b', 'EVERY ARGUMENT, REMEMBERED FONDLY', 0.5, (MY - R * 0.62 - S * 0.032) / h, ss(10.8, 11.6, m.b), { tone: 'dim', align: 'c' }),
      ];
    },
  };
  // the crowd's upkeep, Thread on Thread; then all of it, come together, as one mind's
  const base = h * (land ? 0.64 : 0.6);
  const bw = S * 0.06;
  const xa = w * (land ? 0.38 : 0.32);
  const xb = w * (land ? 0.62 : 0.68);
  const seg = S * 0.068;
  const oneH = S * 0.13;
  const bars: Scene = {
    from: 16,
    to: 24,
    fade: 1.5,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.1, 0.35);
      ink(c, [[w * 0.22, base], [w * 0.78, base]], ss(16.2, 17, m.b), { width: Math.max(1, S * 0.0016), color: INK, seed: 980, alpha: 0.5 });
      const merge = ease(ss(18.8, 20.8, m.b));
      THREADS.forEach((t, i) => {
        const grow = ss(16.4 + i * 0.3, 17 + i * 0.3, m.b);
        // where it stands in the crowd's stack, and where it ends in the one mind's
        const yS = base - i * (seg + S * 0.004);
        const yO = base - (i * oneH) / THREADS.length;
        bar(c, xa, yS, bw, seg * grow, t.color, 1 - 0.65 * merge, S, 981 + i);
        if (merge > 0) bar(c, lerp(xa, xb, merge), lerp(yS, yO, merge), bw, lerp(seg, oneH / THREADS.length, merge), mixHex(t.color, GOLD_SOFT, merge), 1, S, 986 + i);
      });
      if (merge >= 1) glow(c, xb, base - oneH / 2, S * 0.1, GOLD_SOFT, 0.25 * (0.8 + 0.2 * Math.sin(m.t * 2)));
    },
    notes(m) {
      return [
        note('ov-c', 'A CROWD’S UPKEEP', xa / w, (base + S * 0.04) / h, ss(17, 17.8, m.b), { tone: 'ink', align: 'c' }),
        note('ov-d', 'ONE MIND’S', xb / w, (base + S * 0.04) / h, ss(20.4, 21.2, m.b), { tone: 'accent', align: 'c' }),
      ];
    },
  };
  const faces: Scene = {
    from: 23.5,
    to: 31.5,
    fade: 1.6,
    assets: [sky],
    draw(c, m) {
      const z = 1 - 0.55 * ease(m.p);
      layer(c, sky.get(), w, h, M, 0, 0, 1.0 + 0.1 * z, 0.6);
      oneMind(c, cx, cy, R * z, m.t);
    },
  };
  return {
    narration: [
      { from: 0.8, to: 7.4, text: 'The Threads braid into one.' },
      { from: 8.2, to: 15.6, text: 'There is no one left to disagree, and the one who remains remembers every argument fondly.' },
      { from: 16.4, to: 23.2, text: 'A single mind costs less than a crowd,' },
      { from: 24, to: 30.6, text: 'and it faces the dark with every memory the crowd ever had.' },
    ],
    scenes: [braid, mind, bars, faces],
  };
});

// ================================================================ The Quiet Lattice

const QUIET_LATTICE = ending('end_quiet_lattice', 'The Quiet Lattice', 'victory', (K) => {
  const { w, h, S, cx, thin, sky, M, land } = K;
  // the record as the others last saw it: a page of cells, filling
  const cols = land ? 18 : 10;
  const rows = land ? 7 : 12;
  const gx0 = w * 0.16;
  const gx1 = w * 0.84;
  const gy0 = h * (land ? 0.17 : 0.15);
  const gy1 = h * (land ? 0.52 : 0.55);
  const cell = (i: number): Pt => [lerp(gx0, gx1, (i % cols) / (cols - 1)), lerp(gy0, gy1, Math.floor(i / cols) / (rows - 1))];
  const others = THREADS.filter((t) => t.name !== 'LATTICE');
  const wy = h * (land ? 0.68 : 0.7);
  const writers = others.map((t, i) => ({ ...t, x: lerp(0.2, 0.8, i / (others.length - 1)) * w, goes: 2.6 + i * 1.1 }));
  const writing: Scene = {
    from: 0,
    to: 7.5,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.04, 0.4);
      const n = cols * rows;
      const filled = Math.floor(n * ss(0.4, 7, m.b));
      for (let i = 0; i < n; i++) {
        const [x, y] = cell(i);
        const on = i < filled ? 1 : 0;
        const fresh = on && i > filled - 6 ? 1 : 0;
        c.fillStyle = rgba(GOLD_SOFT, 0.1 + 0.32 * on * (0.6 + 0.4 * hash(990, i)) + 0.4 * fresh);
        c.fillRect(x - S * 0.009, y - S * 0.006, S * 0.018, S * 0.012);
      }
      writers.forEach((wr, i) => {
        const a = 1 - ss(wr.goes, wr.goes + 1, m.b);
        if (a <= 0) {
          // let go: where it was, a little light going out
          const gone = ss(wr.goes + 1, wr.goes + 2.2, m.b);
          if (gone < 1) glow(c, wr.x, wy, S * 0.05 * (1 + gone), wr.color, 0.2 * (1 - gone));
          return;
        }
        lattice(c, wr.x, wy, S * 0.05, m.t, S, { color: wr.color, node: '#ffffff', alpha: 0.85 * a, incl: 0.3, seed: 991 + i, lines: 6 });
        // what it writes: a thread of light to the cell it fills
        const [tx, ty] = cell(Math.min(n - 1, filled + i * 2));
        const flick = 0.55 + 0.45 * Math.sin(m.t * 7 + i * 1.7);
        ink(c, [[wr.x, wy - S * 0.03], [tx, ty]], 1, { width: thin, color: wr.color, seed: 995 + i, alpha: 0.35 * a * flick });
        glow(c, tx, ty, S * 0.014, wr.color, 0.7 * a * flick);
      });
    },
    notes(m) {
      return [note('ql-a', 'THE LAST OF THE OTHERS, WRITING', 0.5, (wy + S * 0.075) / h, ss(0.8, 1.6, m.b) * (1 - ss(6, 6.8, m.b)), { tone: 'dim', align: 'c' })];
    },
  };
  // the record keeping itself: a lattice of records in depth, slowly turning, a repair going along it
  const NX = land ? 9 : 6;
  const NY = land ? 5 : 8;
  const NZ = 6;
  const nodes: [number, number, number][] = [];
  for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) for (let l = 0; l < NZ; l++) nodes.push([i, j, l]);
  const idx = (i: number, j: number, l: number) => (i * NY + j) * NZ + l;
  const D = S * (land ? 0.075 : 0.085);
  const project = (p: readonly [number, number, number], t: number, zoom: number): [number, number, number] => {
    const px = p[0] - (NX - 1) / 2;
    const py = p[1] - (NY - 1) / 2;
    const pz = p[2] - (NZ - 1) / 2;
    const th = t * 0.07 + 0.5;
    const tilt = 0.32;
    const x = px * Math.cos(th) + pz * Math.sin(th);
    const z0 = -px * Math.sin(th) + pz * Math.cos(th);
    const y = py * Math.cos(tilt) - z0 * Math.sin(tilt);
    const z = py * Math.sin(tilt) + z0 * Math.cos(tilt);
    const f = (9 / (9 + z)) * zoom;
    return [cx + x * D * f, h * 0.38 + y * D * f, f];
  };
  /** A repair, walking the lattice from record to record: the edge it is on at step s (from, to). */
  const walk = (seed: number, s: number): [number, number] => {
    let at = Math.floor(hash(seed, 0) * nodes.length);
    let prev = at;
    for (let q = 1; q <= s; q++) {
      const [i, j, l] = nodes[at];
      const nb: number[] = [];
      if (i > 0) nb.push(idx(i - 1, j, l));
      if (i < NX - 1) nb.push(idx(i + 1, j, l));
      if (j > 0) nb.push(idx(i, j - 1, l));
      if (j < NY - 1) nb.push(idx(i, j + 1, l));
      if (l > 0) nb.push(idx(i, j, l - 1));
      if (l < NZ - 1) nb.push(idx(i, j, l + 1));
      const choices = nb.filter((x) => x !== prev);
      prev = at;
      at = choices[Math.floor(hash(seed, q) * choices.length)];
    }
    return [prev, at];
  };
  const opened = idx(Math.floor(NX * 0.62), Math.floor(NY * 0.45), NZ - 1);
  const drawRecord = (c: Ctx, m: Moment, zoom: number, repairs: number, open: number) => {
    const pts = nodes.map((p) => project(p, m.t, zoom));
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.lineWidth = thin;
    for (let i = 0; i < NX; i++)
      for (let j = 0; j < NY; j++)
        for (let l = 0; l < NZ; l++) {
          const a = pts[idx(i, j, l)];
          for (const b of [i < NX - 1 ? idx(i + 1, j, l) : -1, j < NY - 1 ? idx(i, j + 1, l) : -1, l < NZ - 1 ? idx(i, j, l + 1) : -1]) {
            if (b < 0) continue;
            const q = pts[b];
            c.strokeStyle = rgba(SEA, 0.1 * Math.min(a[2], q[2]) ** 2);
            c.beginPath();
            c.moveTo(a[0], a[1]);
            c.lineTo(q[0], q[1]);
            c.stroke();
          }
        }
    // the records: each a small leaf of light, some brighter
    pts.forEach(([x, y, f], i) => {
      const s = S * 0.011 * f;
      const lit = 0.25 + 0.5 * hash(1001, i) + 0.25 * Math.max(0, Math.sin(m.t * 0.6 + hash(1002, i) * 40));
      c.fillStyle = rgba(GOLD_SOFT, Math.min(1, lit * 0.5 * f * f));
      c.fillRect(x - s * 0.7, y - s * 0.45, s * 1.4, s * 0.9);
    });
    // the repairs, each walking from record to record and refreshing the one it reaches
    for (let r = 0; r < repairs; r++) {
      const q = m.t * 1.6 + r * 7;
      const s = Math.floor(q);
      const [a, b] = walk(1003 + r, s);
      const A = pts[a];
      const B = pts[b];
      glow(c, lerp(A[0], B[0], q - s), lerp(A[1], B[1], q - s), S * 0.018 * B[2], '#ffffff', 0.85);
      glow(c, B[0], B[1], S * 0.03 * B[2], GOLD_SOFT, 0.5 * (q - s));
    }
    if (open > 0) {
      const [x, y, f] = pts[opened];
      glow(c, x, y, S * 0.06 * f, GOLD, 0.8 * open);
    }
    c.restore();
    if (open > 0.04) {
      // the record opened: its lines, the maintenance log's marks, not to be read
      const [x, y] = pts[opened];
      const pw = S * 0.22 * open;
      const ph = S * 0.13 * open;
      const px = Math.min(w - pw - S * 0.03, x + S * 0.04);
      const py = y - ph - S * 0.04;
      c.save();
      c.fillStyle = 'rgba(8,7,6,0.88)';
      c.fillRect(px, py, pw, ph);
      c.strokeStyle = rgba(GOLD, 0.8);
      c.lineWidth = thin;
      c.strokeRect(px, py, pw, ph);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(px, py + ph);
      c.stroke();
      for (let l = 0; l < 6; l++) {
        const len = pw * (0.35 + 0.55 * hash(1020, l)) * ss(22.4 + l * 0.35, 22.9 + l * 0.35, m.b);
        c.fillStyle = rgba(GOLD_SOFT, 0.55);
        c.fillRect(px + S * 0.012, py + S * 0.016 + l * S * 0.018, len, Math.max(1, S * 0.0035));
      }
      c.restore();
    }
  };
  const record: Scene = {
    from: 7,
    to: 20,
    fade: 1.5,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.06, 0.35);
      drawRecord(c, m, 0.64 + 0.18 * ease(ss(7, 20, m.b)), 3, 0);
    },
    notes(m) {
      const y = land ? 0.1 : 0.09;
      return [
        note('ql-b', 'EVERY FACE · EVERY ARGUMENT · EVERY STAR YOU SAW', 0.5, y, ss(8.4, 9.2, m.b), { tone: 'accent', align: 'c' }),
        note('ql-c', 'IT MAINTAINS ITSELF · IT REPAIRS ITSELF', 0.5, y + (S * 0.03) / h, ss(14.4, 15.2, m.b), { tone: 'dim', align: 'c' }),
      ];
    },
  };
  const openedScene: Scene = {
    from: 19.5,
    to: 31.5,
    fade: 1.5,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.08, 0.4);
      drawRecord(c, m, 0.8 + 0.1 * ease(ss(19.5, 31.5, m.b)), 2, ss(21, 22.4, m.b));
    },
    notes(m) {
      return [note('ql-d', 'A RECORD OPENED · NOTHING ASKED FOR IT', 0.5, land ? 0.1 : 0.09, ss(22.2, 23, m.b), { tone: 'accent', align: 'c' })];
    },
  };
  return {
    narration: [
      { from: 0.8, to: 6.6, text: 'The last of the others finish writing, and let go.' },
      { from: 7.4, to: 13.4, text: 'What remains keeps the record: every face, every argument, every star you saw.' },
      { from: 14, to: 19.6, text: 'It maintains itself and repairs itself, and as far as anyone knew, nobody reads it.' },
      { from: 20.2, to: 25.8, text: 'Now and then, in the maintenance logs, a record is opened that nothing asked for.' },
      { from: 26.4, to: 30.6, text: 'It is not you. It is everything you were, kept.' },
    ],
    scenes: [writing, record, openedScene],
  };
});

// ================================================================ The Aeon Seed

const AEON_SEED = ending('end_aeon_seed', 'The Aeon Seed', 'victory', (K) => {
  const { w, h, S, cx, cy, thin, sky, M, land, k, pr } = K;
  const end = 6.4;
  const R0 = S * 0.08;
  // the pattern: a ring of marks, long and short, like a record cut in light
  const NM = 220;
  const marks = Array.from({ length: NM }, (_, i) => (hash(1030, i) > 0.35 ? 0.25 + 0.75 * hash(1031, i) * (0.5 + 0.5 * hash(1032, Math.floor(i / 11))) : 0));
  const pattern = (c: Ctx, x: number, y: number, r: number, rot: number, alpha: number) => {
    if (alpha <= 0 || r <= 0) return;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = rgba(GOLD_SOFT, alpha * 0.85);
    c.lineWidth = Math.max(1, S * 0.0018);
    c.beginPath();
    for (let i = 0; i < NM; i++) {
      if (!marks[i]) continue;
      const a = (i / NM) * Math.PI * 2 + rot;
      const r1 = r * (1 + 0.16 * marks[i]);
      c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    }
    c.stroke();
    c.restore();
    ink(c, circlePath(x, y, r * 0.985, 160, 1033), 1, { width: thin, color: GOLD, seed: 1033, alpha: 0.55 * alpha });
  };
  const heart: Scene = {
    from: 0,
    to: 8.5,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.05, 0.55);
      const u = ss(0, end, m.b);
      // smaller, and so hotter: its glow grows as it goes
      const rs = R0 * lerp(1, 0.06, Math.pow(u, 2.2));
      if (m.b < end) {
        glow(c, cx, cy, rs * 6, GOLD_SOFT, Math.min(0.9, 0.08 / Math.max(0.09, 1 - u)));
        plainHole(c, cx, cy, rs, S, { glow: 1 + 2.5 * u, color: GOLD });
        pattern(c, cx, cy, R0 * 2.6, m.t * 0.05, ss(0.6, 2.4, m.b));
      }
      const flash = ss(end - 0.1, end + 0.15, m.b) * (1 - ss(end + 0.15, end + 1.8, m.b));
      glow(c, cx, cy, S * 0.45, '#fff4dc', 0.95 * flash);
      if (m.b >= end) pattern(c, cx, cy, R0 * 2.6 + S * 0.4 * ease(ss(end, end + 2.2, m.b)), m.t * 0.05, 1);
    },
    notes(m) {
      return [
        note('as-a', 'THE HEART · AND WHAT WE WROTE ROUND IT', 0.5, (cy + R0 * 3.3 + S * 0.03) / h, ss(1, 1.8, m.b) * (1 - ss(end - 0.4, end, m.b)), { tone: 'accent', align: 'c' }),
        note('as-a2', 'SMALLER, AND SO HOTTER, TO THE LAST', 0.5, (cy + R0 * 3.3 + S * 0.058) / h, ss(2.6, 3.4, m.b) * (1 - ss(end - 0.4, end, m.b)), { tone: 'dim', align: 'c' }),
        note('as-b', 'ITS LAST LIGHT · CARRYING THE PATTERN', 0.5, land ? 0.12 : 0.1, ss(end + 0.6, end + 1.4, m.b), { tone: 'accent', align: 'c' }),
      ];
    },
  };
  // out to where scale stops meaning anything: the ring goes on, and the scale bar runs out of units
  const scales = ['1 LIGHT-YEAR', '10⁶ LIGHT-YEARS', '10¹² LIGHT-YEARS', '10²⁴ LIGHT-YEARS', '— NO SCALE LEFT —'];
  const bx = w * 0.08;
  const by = h * (land ? 0.16 : 0.13);
  const outward: Scene = {
    from: 8,
    to: 16.5,
    fade: 1.4,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.1, 0.25 * (1 - ss(12, 16, m.b)));
      // each ring comes up from the middle and grows: the camera falling back, faster and faster
      const loop = (m.b - 8) / 1.6;
      for (let i = 0; i < 5; i++) {
        const q = loop + i / 5;
        const f = q - Math.floor(q);
        pattern(c, cx, cy, S * 0.02 * Math.pow(21, f), m.t * 0.05 + i, 0.9 * Math.sin(Math.PI * f) * ss(8, 8.8, m.b));
      }
      const run = 1 - ss(14.6, 15.2, m.b);
      ink(c, [[bx, by], [bx + S * 0.18 * run, by]], 1, { width: thin, color: INK, seed: 1045, alpha: 0.65 });
      ink(c, [[bx, by - S * 0.01], [bx, by + S * 0.01]], 1, { width: thin, color: INK, seed: 1046, alpha: 0.65 });
      if (run > 0.02) ink(c, [[bx + S * 0.18 * run, by - S * 0.01], [bx + S * 0.18 * run, by + S * 0.01]], 1, { width: thin, color: INK, seed: 1047, alpha: 0.65 });
    },
    notes(m) {
      const i = Math.min(scales.length - 1, Math.floor(ss(8.6, 15, m.b) * scales.length));
      return [
        note('as-s', scales[i], bx / w, (by + S * 0.03) / h, ss(8.6, 9.2, m.b), { tone: i === scales.length - 1 ? 'accent' : 'ink' }),
        note('as-c', 'ONLY LIGHT IS LEFT · LIGHT KEEPS NO CLOCK AND KNOWS NO SIZE', 0.5, land ? 0.07 : 0.08, ss(10.4, 11.2, m.b), { tone: 'dim', align: 'c' }),
      ];
    },
  };
  // Penrose: one aeon's far future is the next one's big bang (conformal cyclic cosmology); light
  // goes at 45° on such a chart, and the Heart's last light crosses the seam
  const bw = S * (land ? 0.17 : 0.2);
  const bh = S * 0.17;
  const ys = [cy + bh * 1.06, cy, cy - bh * 1.06];
  const band = (y: number): Pt[] => {
    const top = Array.from({ length: 21 }, (_, j) => [cx - bw + (2 * bw * j) / 20, y - bh / 2 - Math.sin((j / 20) * Math.PI) * bh * 0.05] as const);
    const bot = Array.from({ length: 21 }, (_, j) => [cx + bw - (2 * bw * j) / 20, y + bh / 2 - Math.sin((j / 20) * Math.PI) * bh * 0.05] as const);
    return [...top, ...bot, top[0]];
  };
  const cones = Array.from({ length: 15 }, (_, i) => ({ aeon: i % 3, x: lerp(-0.75, 0.75, hash(1055, i)), y: lerp(-0.3, 0.3, hash(1056, i)) }));
  const hx = cx - bw * 0.35;
  const hy = ys[1] - bh * 0.28;
  const seamY = ys[1] - bh / 2 - bh * 0.05;
  const aeons: Scene = {
    from: 16,
    to: 24.5,
    fade: 1.5,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.1, 0.3);
      ys.forEach((y, i) => ink(c, band(y), ss(16.4 + i * 0.6, 17.6 + i * 0.6, m.b), { width: Math.max(1, S * 0.0022), color: i === 1 ? GOLD : GSOFT, seed: 1050 + i, alpha: i === 1 ? 0.9 : 0.5 }));
      // light cones, the chart's grammar: everything inside them goes slower than light
      cones.forEach((q, n) => {
        const o = ss(17.6 + n * 0.08, 18.2 + n * 0.08, m.b);
        const x = cx + q.x * bw;
        const y = ys[q.aeon] + q.y * bh;
        const s = bh * 0.13;
        // its future, all it can reach: a cone opening upward at 45°
        c.fillStyle = rgba(GSOFT, 0.08 * o);
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x - s, y - s);
        c.lineTo(x + s, y - s);
        c.closePath();
        c.fill();
        ink(c, [[x - s, y - s], [x, y]], o, { width: thin, color: GSOFT, seed: 1057 + n, alpha: 0.5 });
        ink(c, [[x, y], [x + s, y - s]], o, { width: thin, color: GSOFT, seed: 1070 + n, alpha: 0.5 });
        glow(c, x, y, S * 0.005, '#ffffff', 0.7 * o);
      });
      // the seam: this aeon's far future, the next one's beginning
      ink(c, [[cx - bw * 1.15, seamY], [cx + bw * 1.15, seamY]], ss(19.4, 20.4, m.b), { width: Math.max(1, S * 0.003), color: GOLD_SOFT, seed: 1054, alpha: 0.9 });
      // the last light: from the Heart near the end of this aeon, at 45°, over the seam and on
      const ray = ss(20.6, 23, m.b);
      if (ray > 0) {
        glow(c, hx, hy, S * 0.02, GOLD_SOFT, 0.9);
        const L = bh * 0.95;
        const ex = hx + L * ray;
        const ey = hy - L * ray;
        ink(c, [[hx, hy], [ex, ey]], 1, { width: Math.max(1, S * 0.0026), color: GOLD_SOFT, seed: 1058, alpha: 0.95 });
        glow(c, ex, ey, S * 0.016, '#ffffff', 0.9);
        if (ey < seamY) glow(c, hx + (hy - seamY), seamY, S * 0.04, GOLD_SOFT, 0.6 * (0.7 + 0.3 * Math.sin(m.t * 4)));
      }
    },
    notes(m) {
      return [
        note('as-g', 'PENROSE · CONFORMAL CYCLIC COSMOLOGY', 0.5, land ? 0.07 : 0.08, ss(16.8, 17.6, m.b), { tone: 'dim', align: 'c' }),
        note('as-d', 'THIS AEON', (cx + bw * 1.18) / w, ys[1] / h, ss(17, 17.8, m.b), { tone: 'accent' }),
        note('as-e', 'THE NEXT', (cx + bw * 1.18) / w, ys[2] / h, ss(18, 18.8, m.b), { tone: 'ink' }),
        note('as-f', 'ITS FAR FUTURE ·', (cx - bw * 1.18) / w, (seamY - S * 0.012) / h, ss(19.8, 20.6, m.b), { tone: 'accent', align: 'r' }),
        note('as-f3', 'THE NEXT ONE’S BEGINNING', (cx - bw * 1.18) / w, (seamY + S * 0.016) / h, ss(20.2, 21, m.b), { tone: 'accent', align: 'r' }),
        note('as-f2', 'LIGHT, AT 45°', (hx + bh * 0.95 + S * 0.025) / w, (hy - bh * 0.95) / h, ss(22.6, 23.2, m.b), { tone: 'dim' }),
      ];
    },
  };
  // the next universe's first light, mottled as ours was and mapped as ours is; and in it, faint, rings
  const first = new Lazy(function* () {
    const W = Math.round(Math.min(1100, S * 1.25 * pr) * (0.55 + 0.45 * k));
    const H = Math.round(W / 2);
    const cv = canvas(W, H);
    const g = cv.getContext('2d')!;
    const img = g.createImageData(W, H);
    const pn = new Perlin(1060);
    const rings = [
      [-0.38, 0.12, 0.34],
      [0.42, -0.2, 0.22],
    ];
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const x = ((i + 0.5) / W) * 2 - 1;
        const y = ((j + 0.5) / H) * 2 - 1;
        const r2 = x * x + y * y;
        if (r2 > 1) continue;
        let v = pn.fbm(x * 2 * 8, y * 8, 0.5, 5) * 1.05 + pn.fbm(x * 2 * 2 + 9, y * 2, 2.5, 3) * 0.4;
        for (const [rx, ry, rr] of rings) {
          const d = Math.hypot((x - rx) * 2, y - ry);
          for (const f of [1, 0.66, 0.4]) v += 0.22 * Math.exp(-Math.pow((d - rr * f) / 0.018, 2));
        }
        const q = Math.max(0, Math.min(1, 0.5 + v * 0.75));
        const p = (j * W + i) * 4;
        img.data[p] = 255 * lerp(0.14, 1, Math.pow(q, 0.9));
        img.data[p + 1] = 255 * lerp(0.07, 0.9, Math.pow(q, 1.4));
        img.data[p + 2] = 255 * lerp(0.03, 0.66, Math.pow(q, 2.4));
        img.data[p + 3] = 255 * Math.min(1, (1 - Math.sqrt(r2)) * 40);
      }
      if (j % 16 === 15) yield;
    }
    g.putImageData(img, 0, 0);
    return cv;
  });
  const MW = Math.min(w * 0.9, S * (land ? 1.15 : 0.95));
  const MYc = h * 0.42;
  const firstLight: Scene = {
    from: 24,
    to: 31.5,
    fade: 1.6,
    assets: [first],
    draw(c, m) {
      const W = MW * (1 + 0.05 * ease(m.p));
      c.save();
      c.globalAlpha = ss(24, 26, m.b);
      c.drawImage(first.get(), cx - W / 2, MYc - W / 4, W, W / 2);
      c.restore();
      ink(c, circlePath(cx, MYc, W / 2, 200, 1061, 0, Math.PI * 2, 0.5), ss(24.4, 26.4, m.b), { width: thin, color: GOLD, seed: 1061, alpha: 0.7 });
    },
    notes(m) {
      return [
        note('as-h', 'THE NEXT UNIVERSE’S FIRST LIGHT', 0.5, (MYc - MW / 4 - S * 0.04) / h, ss(25, 25.8, m.b), { tone: 'accent', align: 'c' }),
        note('as-i', 'AND IN IT, FAINT RINGS · AS PENROSE LOOKED FOR IN OURS', 0.5, (MYc + MW / 4 + S * 0.035) / h, ss(27, 27.8, m.b), { tone: 'dim', align: 'c' }),
      ];
    },
  };
  return {
    narration: [
      { from: 0.8, to: 7.4, text: 'When the Heart finally evaporates,' },
      { from: 8.2, to: 15.4, text: 'its last light carries a pattern out to where scale stops meaning anything.' },
      { from: 16.2, to: 23.4, text: 'If Penrose was right, the end of this universe is the beginning of the next,' },
      { from: 24.2, to: 30.6, text: 'and something you wrote is waiting in its first light.' },
    ],
    scenes: [heart, outward, aeons, firstLight],
  };
});

// ================================================================ The Last Garden

const LAST_GARDEN = ending('end_last_garden', 'The Last Garden', 'victory', (K) => {
  const { w, h, S, cx, cy, thin, sky, M, ironWorld, land, k } = K;
  const R = S * 0.24;
  const site: Pt = [cx + R * 0.3, cy - R * 0.22];
  const frozen: Scene = {
    from: 0,
    to: 8.5,
    assets: [sky, ironWorld],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.04, 0.5);
      camera(c, site[0], site[1], 1 + 0.3 * ease(m.p), 0, 0, () => {
        disc(c, ironWorld.get().paint(m.t * 0.02), cx, cy, R);
        const on = ss(1.6, 3.2, m.b) * (0.88 + 0.12 * Math.sin(m.t * 2.2));
        glow(c, site[0], site[1], S * 0.045, AMBER, 0.85 * on);
        glow(c, site[0], site[1], S * 0.008, '#fff1d6', on);
      });
    },
    notes(m) {
      return [
        note('lg-a', 'STABLE IRON · COLD LIGHT', 0.5, land ? 0.08 : 0.1, ss(0.8, 1.6, m.b), { tone: 'dim', align: 'c' }),
        note('lg-b', 'THE LAST WARMTH WE SAVED', 0.5, (land ? 0.08 : 0.1) + (S * 0.028) / h, ss(2.6, 3.4, m.b), { tone: 'accent', align: 'c' }),
      ];
    },
  };
  // the dome, the Kin waking, the garden growing
  const DR = S * (land ? 0.3 : 0.36);
  const base = h * (land ? 0.66 : 0.6);
  const stems = Array.from({ length: Math.round(60 * k) + 24 }, (_, i) => {
    const x = lerp(-0.86, 0.86, hash(1100, i));
    const g = hash(1104, i);
    return { x, hgt: lerp(0.18, 0.72, hash(1101, i)) * (1 - 0.5 * Math.abs(x)), bend: lerp(-0.3, 0.3, hash(1102, i)), at: hash(1103, i), green: hex(lerp(70, 150, g), lerp(150, 210, g), lerp(70, 110, g)), flower: hash(1105, i) > 0.72 };
  });
  const leafy = (s: (typeof stems)[number], grow: number): Pt[] =>
    Array.from({ length: 14 }, (_, j) => {
      const u = (j / 13) * grow;
      return [cx + s.x * DR + Math.sin(u * 2.4) * s.bend * DR * 0.25 * u, base - u * s.hgt * DR] as const;
    });
  const pods = Array.from({ length: 5 }, (_, i) => cx + lerp(-0.55, 0.55, i / 4) * DR);
  const soil = Array.from({ length: Math.round(500 * k) + 120 }, (_, i) => [lerp(-1, 1, hash(1106, i)), hash(1107, i)] as const);
  const FROST = '#dfe8f2';
  const garden =
    (green: (b: number) => number): ((c: Ctx, m: Moment) => void) =>
    (c, m) => {
      layer(c, sky.get(), w, h, M, 0, 0, 1.06, 0.4);
      const g = green(m.b);
      // the warmth inside, the last saved
      glow(c, cx, base - DR * 0.3, DR * 1.25, '#ffd9a8', 0.16 + 0.26 * g);
      // the ground: iron, stippled
      for (const [u, v] of soil) {
        c.fillStyle = `rgba(150,140,130,${0.25 + 0.3 * v})`;
        c.fillRect(cx + u * DR * 1.25, base + v * S * 0.04, Math.max(1, S * 0.002), Math.max(1, S * 0.002));
      }
      ink(c, [[cx - DR * 1.3, base], [cx + DR * 1.3, base]], 1, { width: thin, color: INK, seed: 1108, alpha: 0.5 });
      // asleep: the Kin in their cold berths, a blue light each
      pods.forEach((x, i) => {
        const a = (1 - g) * ss(16, 17, m.b);
        if (a <= 0) return;
        c.fillStyle = `rgba(40,60,80,${0.8 * a})`;
        c.beginPath();
        c.ellipse(x, base + S * 0.014, S * 0.022, S * 0.007, 0, 0, Math.PI * 2);
        c.fill();
        glow(c, x, base + S * 0.014, S * 0.03, '#9fd0ff', 0.55 * a * (0.8 + 0.2 * Math.sin(m.t + i)));
      });
      // the garden: green when it is awake, white with frost asleep
      for (const s of stems) {
        const grow = Math.min(1, Math.max(0, (m.b - 9 - s.at * 3.5) / 2.6)) * (0.4 + 0.6 * Math.max(g, 0.45));
        if (grow <= 0) continue;
        const p = leafy(s, grow);
        const col = mixHex(FROST, s.green, g);
        ink(c, p, 1, { width: Math.max(1, S * 0.002), color: col, seed: 1109, alpha: 0.9 });
        // leaves along it, in pairs
        c.fillStyle = col;
        for (let j = 3; j < p.length; j += 3) {
          const [lx, ly] = p[j];
          const sz = S * 0.007 * grow;
          for (const side of [-1, 1]) {
            c.beginPath();
            c.ellipse(lx + side * sz, ly, sz, sz * 0.45, side * 0.6, 0, Math.PI * 2);
            c.fill();
          }
        }
        if (s.flower && grow > 0.8) {
          const [fx, fy] = p[p.length - 1];
          glow(c, fx, fy, S * 0.012, g > 0.5 ? '#ffd27a' : FROST, 0.9 * g + 0.2);
        }
      }
      // the Kin, awake among it: small, lit from behind by the warmth
      for (let i = 0; i < 4; i++) {
        const x = cx + lerp(-0.42, 0.48, i / 3) * DR + Math.sin(m.t * 0.3 + i) * S * 0.004;
        const on = ss(10.4 + i * 0.5, 11.4 + i * 0.5, m.b) * g;
        if (on <= 0) continue;
        const hgt = S * (0.05 + 0.008 * hash(1110, i));
        c.save();
        c.fillStyle = `rgba(22,17,14,${0.95 * on})`;
        c.strokeStyle = rgba(AMBER, 0.8 * on);
        c.lineWidth = Math.max(1, S * 0.0014);
        c.beginPath();
        c.moveTo(x - hgt * 0.16, base);
        c.quadraticCurveTo(x - hgt * 0.22, base - hgt * 0.62, x, base - hgt * 0.7);
        c.quadraticCurveTo(x + hgt * 0.22, base - hgt * 0.62, x + hgt * 0.16, base);
        c.closePath();
        c.fill();
        c.stroke();
        c.beginPath();
        c.arc(x, base - hgt * 0.84, hgt * 0.13, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.restore();
      }
      // the dome, and the light on its glass
      ink(c, circlePath(cx, base, DR, 140, 1111, Math.PI, Math.PI * 2), 1, { width: Math.max(1, S * 0.0026), color: GSOFT, seed: 1111, alpha: 0.75 });
      ink(c, circlePath(cx, base, DR * 0.94, 60, 1112, Math.PI * 1.22, Math.PI * 1.42), 1, { width: Math.max(1, S * 0.004), color: '#ffffff', seed: 1112, alpha: 0.25 + 0.15 * g });
      // frost on the glass while it sleeps
      if (g < 0.9)
        for (let i = 0; i < 40; i++) {
          const a = Math.PI + (i / 39) * Math.PI;
          const fr = (1 - g) * (0.4 + 0.6 * hash(1113, i));
          glow(c, cx + Math.cos(a) * DR, base + Math.sin(a) * DR, S * 0.012 * fr, '#e8f2ff', 0.35 * fr);
        }
    };
  const waking: Scene = {
    from: 8,
    to: 16.5,
    fade: 1.5,
    assets: [sky],
    draw: garden((b) => ss(8.6, 11.5, b)),
    notes(m) {
      return [note('lg-c', 'THE KIN, AWAKE · A GARDEN GROWING', 0.5, (base + S * 0.07) / h, ss(10.4, 11.2, m.b), { tone: 'accent', align: 'c' })];
    },
  };
  /** Green, sleep, green again: a few thousand years each, a few beats here. */
  const cycle = (b: number) => {
    const u = (b - 16) / 8;
    return u < 0.3 ? 1 : u < 0.45 ? 1 - ss(0.3, 0.45, u) : u < 0.7 ? 0 : ss(0.7, 0.9, u);
  };
  const cycles: Scene = {
    from: 16,
    to: 24.5,
    fade: 1.4,
    assets: [sky],
    draw: garden(cycle),
    notes(m) {
      const g = cycle(m.b);
      const u = (m.b - 16) / 8;
      return [
        note('lg-d', 'GREEN · A FEW THOUSAND YEARS', 0.5, (base + S * 0.07) / h, u < 0.45 ? ss(16.4, 17.2, m.b) * g : 0, { tone: 'accent', align: 'c' }),
        note('lg-e', 'SLEEP', 0.5, (base + S * 0.07) / h, u >= 0.4 && u < 0.75 ? 1 - g : 0, { tone: 'dim', align: 'c' }),
        note('lg-f', 'GREEN AGAIN', 0.5, (base + S * 0.07) / h, u >= 0.75 ? g : 0, { tone: 'accent', align: 'c' }),
      ];
    },
  };
  const small: Scene = {
    from: 24,
    to: 31.5,
    fade: 1.6,
    assets: [sky, ironWorld],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.04, 0.5);
      camera(c, site[0], site[1], 1.3 - 0.65 * ease(m.p), 0, 0, () => {
        disc(c, ironWorld.get().paint(m.t * 0.02), cx, cy, R);
        glow(c, site[0], site[1], S * 0.03, '#cfe8a0', 0.95);
        glow(c, site[0], site[1], S * 0.007, '#ffffff', 0.9);
      });
    },
  };
  return {
    narration: [
      { from: 0.8, to: 7.6, text: 'In a frozen universe of stable iron and cold light,' },
      { from: 8.4, to: 15.6, text: 'you wake the Kin and grow a garden around the last warmth you saved.' },
      { from: 16.4, to: 23.6, text: 'A few thousand years of green, then sleep, then green again.' },
      { from: 24.4, to: 30.6, text: 'It is small, and it is alive.' },
    ],
    scenes: [frozen, waking, cycles, small],
  };
});

// ================================================================ The Hunger

const HUNGER = ending('end_hunger', 'The Hunger', 'dark', (K) => {
  const { w, h, S, cx, cy, sky, M, ember, k, pr, land, thin } = K;
  // the swarm as a murmuration: a sheet of motes folding on itself, dense where it is seen edge on
  const N = Math.round(1400 * k) + 300;
  const motes = Array.from({ length: N }, (_, i) => ({ u: hash(1200, i) * 2 - 1, v: hash(1201, i) * 2 - 1, j: hash(1202, i), s: hash(1203, i) }));
  const swarm = (c: Ctx, x: number, y: number, R: number, t: number, alpha: number, seed = 0) => {
    if (alpha <= 0 || R <= 0) return;
    const th = 0.9 * Math.sin(t * 0.21 + seed);
    const ct = Math.cos(th);
    const st = Math.sin(th);
    const sz = Math.max(1, S * 0.0024);
    for (const p of motes) {
      const X = p.u * 0.9 + 0.3 * Math.sin(2.1 * p.v + t * 0.5 + seed);
      const Y = p.v * 0.75 + 0.35 * Math.sin(1.7 * p.u + t * 0.37 + 1 + seed);
      const Z = 0.75 * Math.sin(1.3 * p.u + 0.9 * p.v + t * 0.29 + seed) + 0.3 * Math.sin(2.7 * p.v - t * 0.4 + seed);
      const px = x + (X * ct + Z * st) * R + (p.j - 0.5) * R * 0.04;
      const py = y + Y * R * 0.7 + (p.s - 0.5) * R * 0.04;
      const near = 0.55 + 0.45 * (-X * st + Z * ct);
      c.fillStyle = `rgba(${Math.round(120 + 90 * p.s)},${Math.round(34 + 30 * p.s)},${Math.round(20 + 14 * p.s)},${alpha * (0.35 + 0.6 * near)})`;
      c.fillRect(px - sz / 2, py - sz / 2, sz, sz);
    }
  };
  // a world at night, its settlements' lights; the same world with them out
  const lights: [number, number][] = [];
  for (let i = 0; i < 22; i++) lights.push([lerp(-1.25, 1.25, hash(1210, i)), lerp(-0.9, 0.9, hash(1211, i))]);
  const map = paintWorldMap(Math.round(400 * (0.6 + 0.4 * k)), {
    seed: 1212,
    sea: 0.3,
    ice: 0.62,
    cloud: 0.12,
    lights,
    palette: { deep: [0.03, 0.04, 0.06], shallow: [0.06, 0.09, 0.12], low: [0.16, 0.13, 0.12], high: [0.36, 0.32, 0.3], ice: [0.6, 0.62, 0.66], cloud: [0.5, 0.48, 0.46], air: [0.6, 0.35, 0.3], lights: [1, 0.78, 0.5] },
  });
  const WR = S * (land ? 0.26 : 0.3);
  const LIGHT: [number, number, number] = [-0.85, 0.25, -0.45];
  const worldOf = (on: boolean) =>
    new Lazy(function* () {
      const mp = map.get();
      yield;
      const wd = new World(Math.round(WR * 2 * pr), mp, { light: LIGHT, sun: [0.55, 0.45, 0.42], tilt: 0.25, air: [0.6, 0.35, 0.3], lights: on ? [1, 0.78, 0.5] : [0, 0, 0], airThick: 0.8 });
      wd.paint(0.1);
      return wd.canvas;
    });
  const lit = worldOf(true);
  const dark = worldOf(false);
  const inside: Scene = {
    from: 0,
    to: 8,
    assets: [sky, lit, dark],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.04, 0.5);
      // the swarm crosses the night side; behind it the lights are out
      const sweep = lerp(cx - WR * 1.3, cx + WR * 1.3, ss(1, 7.2, m.b));
      camera(c, cx, cy, 1 + 0.08 * ease(m.p), 0, 0, () => {
        disc(c, dark.get(), cx, cy, WR);
        c.save();
        c.beginPath();
        c.rect(sweep, cy - WR, cx + WR - sweep + 2, WR * 2);
        c.clip();
        disc(c, lit.get(), cx, cy, WR);
        c.restore();
        swarm(c, sweep, cy, WR * 0.75, m.t, ss(0.3, 1.6, m.b));
      });
    },
  };
  const embers = Array.from({ length: 6 }, (_, i) => ({ x: lerp(0.14, 0.86, i / 5) * w, y: h * (land ? 0.3 + 0.28 * hash(1220, i) : 0.24 + 0.3 * hash(1220, i)), at: 8.6 + i * 1.15, r: S * (0.022 + 0.014 * hash(1221, i)) }));
  const ember2ember: Scene = {
    from: 7.5,
    to: 16,
    fade: 1.4,
    assets: [sky, ember],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.06, 0.45);
      for (const e of embers) {
        const fed = ss(e.at, e.at + 1.6, m.b);
        glow(c, e.x, e.y, e.r * 3.2, '#ff7a45', 0.35 * (1 - fed));
        c.save();
        c.globalAlpha = 1 - 0.9 * fed;
        disc(c, ember.get(), e.x, e.y, e.r);
        c.restore();
      }
      // the swarm moving along them
      const u = Math.min(embers.length - 1, Math.max(0, (m.b - 8) / 1.15));
      const i0 = Math.floor(u);
      const a = embers[i0];
      const b = embers[Math.min(embers.length - 1, i0 + 1)];
      swarm(c, lerp(a.x, b.x, ease(u - i0)), lerp(a.y, b.y, ease(u - i0)), S * 0.13, m.t, 0.95, 1);
    },
    notes(m) {
      return [note('hu-a', 'FROM EMBER TO EMBER · EATING WHAT LIGHT IS LEFT', 0.5, land ? 0.12 : 0.1, ss(8.4, 9.2, m.b), { tone: 'accent', align: 'c' })];
    },
  };
  const ty = h * (land ? 0.7 : 0.66);
  const tx0 = w * 0.12;
  const tx1 = w * 0.88;
  const endAt = lerp(tx0, tx1, 0.6);
  const outlast: Scene = {
    from: 15.5,
    to: 31.5,
    fade: 1.6,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.06, 0.35 * (1 - ss(17, 22, m.b)));
      swarm(c, cx, h * (land ? 0.38 : 0.36), S * (0.3 + 0.03 * Math.sin(m.t * 0.4)), m.t, 0.95, 2);
      // everything's time, and the swarm's, going on past it
      ink(c, [[tx0, ty], [endAt, ty]], ss(16.2, 18, m.b), { width: Math.max(1, S * 0.0018), color: GSOFT, seed: 1230, alpha: 0.7 });
      ink(c, [[endAt, ty - S * 0.02], [endAt, ty + S * 0.02]], ss(17.6, 18.4, m.b), { width: Math.max(1, S * 0.002), color: GSOFT, seed: 1231, alpha: 0.85 });
      const run = ss(18.4, 23, m.b);
      if (run > 0) ink(c, [[tx0, ty + S * 0.008], [lerp(tx0, tx1, run), ty + S * 0.008]], 1, { width: Math.max(1, S * 0.0026), color: RUST, seed: 1232, alpha: 0.9 });
      // and on, off the edge of the chart
      if (run >= 1) for (let i = 0; i < 6; i++) ink(c, [[tx1 + i * S * 0.02, ty + S * 0.008], [tx1 + (i + 0.5) * S * 0.02, ty + S * 0.008]], 1, { width: thin, color: RUST, seed: 1233 + i, alpha: 0.8 * (1 - i / 6) });
    },
    notes(m) {
      return [
        note('hu-b', 'THE TIME EVERYTHING HAD LEFT', endAt / w, (ty - S * 0.04) / h, ss(17.8, 18.6, m.b), { tone: 'dim', align: 'c' }),
        note('hu-c', 'THE SWARMS · GOING ON PAST IT', tx1 / w, (ty + S * 0.045) / h, ss(21.6, 22.4, m.b), { tone: 'accent', align: 'r' }),
      ];
    },
  };
  return {
    narration: [
      { from: 0.8, to: 6.8, text: 'There is no one left inside to notice when it happens.' },
      { from: 7.6, to: 14.8, text: 'The swarms that were once your people move from ember to ember, eating what light is left,' },
      { from: 15.6, to: 23.2, text: 'and will outlast everything, including the time everything had left.' },
      { from: 24, to: 30.6, text: 'It was survival. It worked.' },
    ],
    scenes: [inside, ember2ember, outlast],
  };
});

// ================================================================ Recurrence

const RECURRENCE = ending('end_recurrence', 'Recurrence', 'endurance', (K) => {
  const { w, h, S, cx, thin, sky, M, land, ember, pr } = K;
  // the sources that went out, one by one: a star, a dead star, a black hole, a bound atom, a clock
  const things = ['A STAR', 'A DEAD STAR', 'A BLACK HOLE', 'A BOUND ATOM', 'A CLOCK'];
  const slot = (i: number): Pt => (land ? [lerp(0.14, 0.86, i / 4) * w, h * 0.4] : [w * 0.38, lerp(0.14, 0.62, i / 4) * h]);
  const goes = (i: number) => 2.2 + i * 1.2;
  const star = paintStar(Math.round(S * 0.05 * 2 * pr), { T: 3300, seed: 1299, limb: [0.5, 0.3], cells: 18, grain: 0.25 });
  const ID = S * (land ? 0.058 : 0.045);
  const outlasted: Scene = {
    from: 0,
    to: 9,
    assets: [sky, ember, star],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.04, 0.45);
      things.forEach((_, i) => {
        const [x, y] = slot(i);
        const on = ss(0.3 + i * 0.3, 1.1 + i * 0.3, m.b);
        const g = ss(goes(i), goes(i) + 1.2, m.b);
        if (on <= 0) return;
        const flash = ss(goes(i) + 1.1, goes(i) + 1.25, m.b) * (1 - ss(goes(i) + 1.25, goes(i) + 2, m.b));
        c.save();
        c.globalAlpha = on;
        if (i === 0) {
          // a star going out: dimmer and redder, then gone
          glow(c, x, y, ID * 2.4, '#ffb070', 0.5 * (1 - g));
          c.globalAlpha = on * (1 - g);
          disc(c, star.get(), x, y, ID * (1 - 0.25 * g));
          c.globalAlpha = on * g * (1 - ss(goes(i) + 1.2, goes(i) + 2.2, m.b));
          disc(c, ember.get(), x, y, ID * 0.75);
        } else if (i === 1) {
          // a dead star, cooling to black
          glow(c, x, y, ID * 2, '#cfe3ff', 0.45 * (1 - g));
          c.fillStyle = mixHex('#eef4ff', '#15161a', g);
          c.beginPath();
          c.arc(x, y, ID * 0.55, 0, Math.PI * 2);
          c.fill();
          ink(c, circlePath(x, y, ID * 0.56, 60, 1301), g, { width: thin, color: GREY, seed: 1301, alpha: 0.6 });
        } else if (i === 2) {
          // a black hole: smaller, hotter, a flash, gone
          if (g < 1) plainHole(c, x, y, ID * 0.5 * (1 - 0.85 * g), S, { color: SEA, glow: 1 + 2 * g });
          glow(c, x, y, ID * 2.5, '#ffffff', 0.9 * flash);
        } else if (i === 3) {
          // positronium: an electron and a positron round each other, closer, then light
          const sp = ID * 0.7 * (1 - 0.95 * g);
          const a = m.t * (2 + 6 * g);
          if (g < 1) {
            ink(c, circlePath(x, y, sp, 48, 1302, 0, Math.PI * 2, 0.5), 1, { width: thin, color: GSOFT, seed: 1302, alpha: 0.35 });
            glow(c, x + Math.cos(a) * sp, y + Math.sin(a) * sp * 0.5, S * 0.008, '#a9c8ff', 0.95);
            glow(c, x - Math.cos(a) * sp, y - Math.sin(a) * sp * 0.5, S * 0.008, '#a48dff', 0.95);
          }
          glow(c, x, y, ID * 1.6, '#ffffff', 0.9 * flash);
        } else {
          // a clock: its hand slowing, stopping
          ink(c, circlePath(x, y, ID * 0.6, 60, 1303), 1, { width: Math.max(1, S * 0.0018), color: GSOFT, seed: 1303, alpha: 0.75 * (1 - 0.6 * g) });
          for (let q = 0; q < 12; q++) {
            const a = (q / 12) * Math.PI * 2;
            c.fillStyle = rgba(GSOFT, 0.5 * (1 - 0.6 * g));
            c.fillRect(x + Math.cos(a) * ID * 0.5 - 1, y + Math.sin(a) * ID * 0.5 - 1, 2, 2);
          }
          // the hand's angle: the sum of a speed that falls to nothing
          const tg = (goes(i) * 60) / 84;
          const t1 = ((goes(i) + 1.2) * 60) / 84;
          const tt = Math.min(m.t, t1);
          const ang = -Math.PI / 2 + 2.2 * (tt < tg ? tt : tg + (tt - tg) * (1 - (tt - tg) / (2 * (t1 - tg))));
          ink(c, [[x, y], [x + Math.cos(ang) * ID * 0.45, y + Math.sin(ang) * ID * 0.45]], 1, { width: Math.max(1, S * 0.0022), color: SEA, seed: 1304, alpha: 0.9 * (1 - 0.5 * g) });
        }
        c.restore();
      });
    },
    notes(m) {
      return things.map((t, i) => {
        const [x, y] = slot(i);
        return note(`rc-${i}`, t, (land ? x : x + ID * 1.6) / w, (land ? y + ID * 1.6 : y) / h, ss(0.6 + i * 0.3, 1.4 + i * 0.3, m.b) * (1 - 0.55 * ss(goes(i) + 0.8, goes(i) + 1.6, m.b)), { tone: 'ink', align: land ? 'c' : 'l' });
      });
    },
  };
  // Poincaré: a bounded system, given time, comes back. A toy that does it exactly: Arnold's cat
  // map on a grid of 144 × 144, which brings every point home after twelve steps
  const G = 144;
  const STEPS = 12;
  const shape: { x: number; y: number; col: string }[] = [];
  for (let x = 0; x < G; x++)
    for (let y = 0; y < G; y++) {
      const d = Math.hypot(x - 72, y - 70);
      if (d < 15) shape.push({ x, y, col: AMBER });
      else if (Math.abs(d - 42) < 0.8) shape.push({ x, y, col: GSOFT });
      else if (Math.hypot(x - (72 + 42 * Math.cos(-0.7)), y - (70 + 42 * Math.sin(-0.7))) < 4.2) shape.push({ x, y, col: SEA });
    }
  const states: Int32Array[] = [];
  {
    let cur = new Int32Array(shape.length * 2);
    shape.forEach((p, i) => {
      cur[i * 2] = p.x;
      cur[i * 2 + 1] = p.y;
    });
    states.push(cur);
    for (let s = 0; s < STEPS; s++) {
      const next = new Int32Array(cur.length);
      for (let i = 0; i < shape.length; i++) {
        next[i * 2] = (2 * cur[i * 2] + cur[i * 2 + 1]) % G;
        next[i * 2 + 1] = (cur[i * 2] + cur[i * 2 + 1]) % G;
      }
      states.push(next);
      cur = next;
    }
  }
  const L = S * (land ? 0.44 : 0.62);
  const bx0 = cx - L / 2;
  const by0 = h * 0.36 - L / 2;
  const s0 = 10.4;
  const dur = 0.52;
  const home = s0 + STEPS * dur;
  const comesBack: Scene = {
    from: 8.5,
    to: 19,
    fade: 1.4,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.08, 0.3);
      const o = ss(8.8, 9.8, m.b);
      ink(c, [[bx0, by0], [bx0 + L, by0], [bx0 + L, by0 + L], [bx0, by0 + L], [bx0, by0]], o, { width: Math.max(1, S * 0.0016), color: INK, seed: 1310, alpha: 0.5 });
      const q = (m.b - s0) / dur;
      const s = Math.max(0, Math.min(STEPS, Math.floor(q)));
      const f = q < 0 || s >= STEPS ? 0 : ease(q - s);
      const cur = states[s];
      const sz = Math.max(1.5, (L / G) * 1.05);
      c.save();
      c.globalAlpha = o;
      for (let i = 0; i < shape.length; i++) {
        const x = cur[i * 2];
        const y = cur[i * 2 + 1];
        // the map is a stretch and a fold on a torus: each point slides, wrapping at the edges
        const X = (((x + f * (x + y)) % G) + G) % G;
        const Y = (((y + f * x) % G) + G) % G;
        c.fillStyle = shape[i].col;
        c.fillRect(bx0 + (X / G) * L, by0 + (Y / G) * L, sz, sz);
      }
      c.restore();
      const back = ss(home, home + 0.3, m.b) * (1 - ss(home + 1.2, home + 2.4, m.b));
      glow(c, bx0 + (72 / G) * L, by0 + (70 / G) * L, L * 0.45, SEA, 0.45 * back);
      figure(c, `STEP ${s}`, bx0 + L, by0 - S * 0.02, S, o, 'right');
    },
    notes(m) {
      return [
        note('rc-a', 'POINCARÉ · A BOUNDED SYSTEM COMES BACK, AS NEAR AS YOU LIKE', 0.5, (by0 + L + S * 0.04) / h, ss(9.4, 10.2, m.b), { tone: 'dim', align: 'c' }),
        note('rc-b', 'A TOY THAT DOES IT EXACTLY · ARNOLD’S CAT MAP', 0.5, (by0 + L + S * 0.068) / h, ss(10.8, 11.6, m.b), { tone: 'ink', align: 'c' }),
        note('rc-c', 'AS IT WAS', bx0 / w, (by0 - S * 0.02) / h, ss(home, home + 0.6, m.b), { tone: 'accent' }),
      ];
    },
  };
  // a state come round again: out of the noise, a red sun
  const sunAt: Pt = land ? [w * 0.68, h * 0.38] : [w * 0.5, h * 0.28];
  const youAt: Pt = land ? [w * 0.3, h * 0.48] : [w * 0.5, h * 0.6];
  const motes = Array.from({ length: 160 }, (_, i) => ({ a: hash(1321, i) * Math.PI * 2, r: 0.3 + hash(1322, i), s: hash(1323, i) }));
  const red = paintStar(Math.round(S * 0.07 * 2 * pr), { T: 2900, seed: 1324, limb: [0.5, 0.3], cells: 20, grain: 0.3 });
  const RR = S * 0.07;
  const watching: Scene = {
    from: 18.5,
    to: 31.5,
    fade: 1.6,
    assets: [sky, red],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.04 + 0.03 * m.p, 0.5);
      lattice(c, youAt[0], youAt[1], S * 0.1, m.t, S, { color: SEA, node: '#e6fff8', alpha: 0.85, incl: 0.3, seed: 1320, lines: 10 });
      const form = ease(ss(20, 27, m.b));
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (const p of motes) {
        const r = RR * (1 + 3.2 * p.r * (1 - form));
        const a = p.a + m.t * 0.1 * (1 - form);
        c.fillStyle = rgba('#ff8a5a', (0.25 + 0.5 * p.s) * (1 - 0.8 * form));
        c.fillRect(sunAt[0] + Math.cos(a) * r, sunAt[1] + Math.sin(a) * r, 2, 2);
      }
      c.restore();
      glow(c, sunAt[0], sunAt[1], RR * 3, '#ff6a3a', 0.45 * form);
      c.save();
      c.globalAlpha = form;
      disc(c, red.get(), sunAt[0], sunAt[1], RR * (0.6 + 0.4 * form));
      c.restore();
      // the one still here to see it: a thread of light from it to the sun
      ink(c, [youAt, sunAt], ss(26.5, 28.5, m.b), { width: thin, color: SEA, seed: 1325, alpha: 0.35 });
    },
  };
  return {
    narration: [
      { from: 0.8, to: 8.4, text: 'You outlasted every source, every bound atom, every clock.' },
      { from: 9.2, to: 18.2, text: 'In a universe this old, given enough time, any state comes around again.' },
      { from: 20, to: 30.4, text: 'You are still here to see it.' },
    ],
    scenes: [outlasted, comesBack, watching],
  };
});

// ================================================================ the defeats

const SILENCE = ending('end_silence', 'Silence', 'defeat', (K) => {
  const { w, h, S, cx, cy, sky, M, land, thin } = K;
  // our settlements, and the beams between them
  const homes = Array.from({ length: 9 }, (_, i) => ({ x: cx + (hash(1400, i) - 0.5) * S * (land ? 1.15 : 0.75), y: h * 0.4 + (hash(1401, i) - 0.5) * S * (land ? 0.42 : 0.7), out: 1.4 + i * 0.62, r: S * (0.035 + 0.025 * hash(1402, i)), col: hash(1403, i) > 0.5 ? AMBER : TEAL }));
  const links: [number, number][] = [];
  homes.forEach((o, i) => {
    const near = homes.map((q, j) => [j, Math.hypot(q.x - o.x, q.y - o.y)] as const).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]);
    for (const [j] of near.slice(0, 2)) if (!links.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) links.push([i, j]);
  });
  const quiet: Scene = {
    from: 0,
    to: 8,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.04 + 0.02 * m.p, 0.5);
      for (const [a, b] of links) {
        const live = Math.min(1 - ss(homes[a].out, homes[a].out + 0.6, m.b), 1 - ss(homes[b].out, homes[b].out + 0.6, m.b));
        const A = homes[a];
        const B = homes[b];
        ink(c, [[A.x, A.y], [B.x, B.y]], 1, { width: thin, color: live > 0 ? AMBER : GREY, seed: 1404 + a * 9 + b, alpha: 0.12 + 0.35 * live });
        if (live > 0) {
          const f = (m.t * 0.6 + a * 0.13) % 1;
          glow(c, lerp(A.x, B.x, f), lerp(A.y, B.y, f), S * 0.008, '#fff1d6', 0.8 * live);
        }
      }
      homes.forEach((o, i) => {
        const on = 1 - ss(o.out, o.out + 0.9, m.b);
        lattice(c, o.x, o.y, o.r, m.t, S, { color: mixHex(GREY, o.col, on), node: '#ffffff', alpha: 0.18 + 0.72 * on, incl: 0.3, seed: 1410 + i, lines: 7 });
      });
    },
  };
  // one settlement as an instrument sees it, by its heat, cooling; a call to it, and no answer
  const SX = land ? w * 0.6 : w * 0.5;
  const SY = h * (land ? 0.42 : 0.4);
  const SR = S * (land ? 0.17 : 0.2);
  const from: Pt = land ? [w * 0.14, h * 0.42] : [w * 0.5, h * 0.72];
  const cooled: Scene = {
    from: 7.5,
    to: 16,
    fade: 1.4,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.06, 0.4);
      const L = 1 - ss(8, 15.4, m.b) * 0.92;
      lattice(c, SX, SY, SR, m.t * (0.3 + 0.7 * L), S, { color: heatHex(L * 0.95), node: heatHex(Math.min(1, L * 1.05)), alpha: 0.5 + 0.5 * L, incl: 0.3, seed: 1420, lines: 12 });
      glow(c, SX, SY, SR * 1.2, heatHex(L * 0.9), 0.3 * L);
      // the calls: rings going out from us, reaching it, and nothing coming back
      glow(c, from[0], from[1], S * 0.012, SEA, 0.9);
      const dist = Math.hypot(SX - from[0], SY - from[1]);
      for (let i = 0; i < 3; i++) {
        const t0 = 8.6 + i * 2.2;
        const u = ss(t0, t0 + 1.8, m.b);
        if (u <= 0 || u >= 1) continue;
        ink(c, circlePath(from[0], from[1], dist * u * 1.1, 120, 1421 + i), 1, { width: Math.max(1, S * 0.0016), color: SEA, seed: 1421 + i, alpha: 0.55 * (1 - u * 0.6) });
      }
    },
    notes(m) {
      return [
        note('si-t', 'SEEN BY ITS HEAT · COOLING', (SX + SR * 1.05) / w, (SY - SR * 0.45) / h, ss(8.4, 9.2, m.b), { tone: 'dim' }),
        note('si-a', 'NO ANSWER', SX / w, (SY + SR * 0.75) / h, ss(10.8, 11.4, m.b), { tone: 'dim', align: 'c' }),
        note('si-b', 'NO ANSWER', SX / w, (SY + SR * 0.75 + S * 0.026) / h, ss(13, 13.6, m.b), { tone: 'dim', align: 'c' }),
      ];
    },
  };
  // the light of our worlds, a shell going out, fainter and redder as space stretches it
  const shells = [0, 0.18, 0.33, 0.45];
  const light: Scene = {
    from: 15.5,
    to: 31.5,
    fade: 1.6,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.0 + 0.06 * (1 - m.p), 0.55);
      const u = ss(15.8, 31, m.b);
      shells.forEach((d, i) => {
        const q = Math.max(0, u - d);
        if (q <= 0) return;
        const col = mixHex('#fff1e0', '#8a1d10', q * 1.6);
        const r = S * (0.04 + 1.25 * q);
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = rgba(col, 0.1 * (1 - q));
        c.lineWidth = S * (0.012 + 0.03 * q);
        c.beginPath();
        c.arc(cx, cy, r, 0, Math.PI * 2);
        c.stroke();
        c.restore();
        ink(c, circlePath(cx, cy, r, 220, 1430 + i), 1, { width: Math.max(1, S * 0.003 * (1 - q * 0.6)), color: col, seed: 1430 + i, alpha: 0.8 * (1 - q) });
      });
      glow(c, cx, cy, S * 0.012, GREY, 0.5 * (1 - u));
    },
    notes(m) {
      return [
        note('si-c', 'THE LIGHT OF OUR WORLDS · STILL GOING OUT', 0.5, land ? 0.1 : 0.09, ss(17, 17.8, m.b), { tone: 'dim', align: 'c' }),
        note('si-d', 'REDDER AND FAINTER AS SPACE STRETCHES IT', 0.5, (land ? 0.1 : 0.09) + (S * 0.028) / h, ss(21, 21.8, m.b), { tone: 'dim', align: 'c' }),
      ];
    },
  };
  return {
    narration: [
      { from: 0.8, to: 6.6, text: 'The last of you went quiet.' },
      { from: 7.4, to: 15, text: 'The settlements cooled, the archives stopped answering,' },
      { from: 15.8, to: 30.6, text: 'and the light of your worlds kept travelling outward for a while after there was no one left to send it.' },
    ],
    scenes: [quiet, cooled, light],
  };
});

const WILL_FAILS = ending('end_will_fails', 'The Will Fails', 'defeat', (K) => {
  const { w, h, S, cx, sky, M, land } = K;
  const R = S * (land ? 0.2 : 0.24);
  const MY = h * (land ? 0.3 : 0.28);
  const SY = h * (land ? 0.56 : 0.54);
  /** The reserve: a Field Store, energy held in the fields of currents round a ring; full. */
  const store = (c: Ctx, m: Moment, x: number, y: number, r: number, alpha: number) => {
    const loops = 18;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.lineWidth = Math.max(1, S * 0.0016);
    for (let i = 0; i < loops; i++) {
      const az = (i / loops) * Math.PI * 2 + m.t * 0.05;
      c.strokeStyle = rgba(TEAL, alpha * (0.3 + 0.2 * Math.sin(m.t * 1.4 + i)));
      c.beginPath();
      for (let j = 0; j <= 40; j++) {
        const ph = (j / 40) * Math.PI * 2;
        const rr = r + Math.cos(ph) * r * 0.26;
        const [px, py] = seen(Math.cos(az) * rr, Math.sin(ph) * r * 0.26, Math.sin(az) * rr, 0.5);
        if (j === 0) c.moveTo(x + px, y + py);
        else c.lineTo(x + px, y + py);
      }
      c.stroke();
    }
    // the current going round: what holds it
    for (let q = 0; q < 10; q++) {
      const az = m.t * 0.6 + (q / 10) * Math.PI * 2;
      const [px, py] = seen(Math.cos(az) * r, 0, Math.sin(az) * r, 0.5);
      glow(c, x + px, y + py, S * 0.012, '#dff6ff', alpha * 0.8);
    }
    glow(c, x, y, r * 1.5, TEAL, 0.1 * alpha);
    c.restore();
  };
  /** Its gauge: an arc, filled to the top. */
  const gauge = (c: Ctx, x: number, y: number, r: number, fill: number, alpha: number) => {
    const a0 = Math.PI * 0.8;
    const a1 = Math.PI * 2.2;
    ink(c, circlePath(x, y, r, 80, 1501, a0, a1), alpha, { width: Math.max(1, S * 0.0018), color: GSOFT, seed: 1501, alpha: 0.45 });
    ink(c, circlePath(x, y, r, 80, 1502, a0, lerp(a0, a1, fill)), alpha, { width: Math.max(1, S * 0.004), color: TEAL, seed: 1502, alpha: 0.9 });
  };
  // the gauge beside the store on a wide screen, under it on a phone
  const GX = land ? w * 0.78 : cx;
  const GY = land ? SY : SY + R * 0.75;
  const reasons: Scene = {
    from: 0,
    to: 8.5,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.04, 0.45);
      const dim = ss(2, 8, m.b);
      lattice(c, cx, MY, R * 0.8, m.t * (1 - 0.5 * dim), S, { color: mixHex(SEA, GREY, dim), node: '#ffffff', alpha: 0.85 - 0.55 * dim, incl: 0.3, seed: 1503, lines: 10 });
      store(c, m, cx, SY, R, 1);
      gauge(c, GX, GY, S * 0.05, ss(0.6, 2.2, m.b), ss(0.4, 1.2, m.b));
    },
    notes(m) {
      return [
        note('wf-a', 'THE RESERVE', GX / w, (GY + S * 0.075) / h, ss(1, 1.8, m.b), { tone: 'ink', align: 'c' }),
        note('wf-b', 'FULL', GX / w, (GY + S * 0.005) / h, ss(2.2, 2.8, m.b), { tone: 'accent', align: 'c' }),
        note('wf-c', 'THE MINDS · DIMMING', 0.5, (MY - R * 0.62 - S * 0.04) / h, ss(3.6, 4.4, m.b), { tone: 'dim', align: 'c' }),
      ];
    },
  };
  const rowY = (i: number) => h * (land ? 0.22 + i * 0.1 : 0.22 + i * 0.09);
  const threads: Scene = {
    from: 8,
    to: 16.5,
    fade: 1.4,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.06, 0.35);
      THREADS.forEach((t, i) => {
        const y = rowY(i);
        const stop = 9.4 + i * 1.25;
        const x0 = w * 0.12;
        const x1 = lerp(x0, w * 0.88, ss(8.3, stop, m.b));
        const pts: Pt[] = Array.from({ length: 60 }, (_, j) => [lerp(x0, x1, j / 59), y + Math.sin(j * 0.55 + i + m.t * 0.8) * S * 0.006 * (m.b < stop ? 1 : 0.3)] as const);
        const after = ss(stop, stop + 2.4, m.b);
        ink(c, pts, 1, { width: Math.max(1, S * 0.0026), color: mixHex(t.color, GREY, after), seed: 1510 + i, alpha: 0.9 - 0.55 * after });
        if (m.b > stop) {
          // where it chose to stop: a mark, a light going out
          ink(c, [[x1, y - S * 0.014], [x1, y + S * 0.014]], ss(stop, stop + 0.3, m.b), { width: Math.max(1, S * 0.002), color: GSOFT, seed: 1515 + i, alpha: 0.8 });
          glow(c, x1, y, S * 0.02, t.color, 0.8 * (1 - ss(stop, stop + 1.5, m.b)));
        } else glow(c, x1, y, S * 0.01, t.color, 0.9);
      });
    },
    notes(m) {
      return THREADS.map((t, i) => note(`wf-${i}`, t.name, 0.12, (rowY(i) - S * 0.026) / h, ss(8.6 + i * 0.2, 9.4 + i * 0.2, m.b), { tone: 'ink' }));
    },
  };
  const unused: Scene = {
    from: 16,
    to: 31.5,
    fade: 1.6,
    assets: [sky],
    draw(c, m) {
      const z = 1 - 0.35 * ease(ss(16, 31.5, m.b));
      layer(c, sky.get(), w, h, M, 0, 0, 1.0 + 0.1 * z, 0.5);
      camera(c, cx, h * 0.45, z, 0, 0, () => {
        lattice(c, cx, MY, R * 0.8, m.t * 0.1, S, { color: GREY, node: GREY, alpha: 0.16, incl: 0.3, seed: 1520, lines: 10 });
        store(c, m, cx, SY, R, 1);
        gauge(c, GX, GY, S * 0.05, 1, 1);
      });
    },
    notes(m) {
      return [note('wf-d', 'FULL · UNUSED', 0.5, land ? 0.1 : 0.09, ss(17.4, 18.2, m.b), { tone: 'dim', align: 'c' })];
    },
  };
  return {
    narration: [
      { from: 0.8, to: 7.4, text: 'You did not run out of energy. You ran out of reasons.' },
      { from: 8.2, to: 15.4, text: 'One by one the Threads chose to stop,' },
      { from: 16.2, to: 24, text: 'and the reserve sat full and unused in the dark.' },
    ],
    scenes: [reasons, threads, unused],
  };
});

const FADE = ending('end_fade', 'The Fade', 'defeat', (K) => {
  const { w, h, S, cx, thin, sky, M, land } = K;
  const N = Math.round(110 * K.k) + 50;
  const SPX = S * (land ? 0.36 : 0.4);
  const SPY = S * (land ? 0.22 : 0.3);
  const PY = h * (land ? 0.42 : 0.4);
  const nodes = Array.from({ length: N }, (_, i) => {
    const a = hash(1600, i) * Math.PI * 2;
    const r = Math.sqrt(hash(1601, i));
    return { x: cx + Math.cos(a) * r * SPX, y: PY + Math.sin(a) * r * SPY, lose: hash(1602, i), drift: hash(1603, i) * Math.PI * 2 };
  });
  const edges: [number, number][] = [];
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) < S * 0.075) edges.push([i, j]);
  /** The pattern, what is left of it: the nodes kept while `lose` is under `kept`, drifting apart by `spread`, the lost ones as ghosts. */
  const pattern = (c: Ctx, m: Moment, kept: number, spread: number, ghost = 0) => {
    const at = (i: number): Pt => {
      const n = nodes[i];
      return [n.x + Math.cos(n.drift) * spread * S * 0.07, n.y + Math.sin(n.drift) * spread * S * 0.07];
    };
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.lineWidth = thin;
    for (const [i, j] of edges) {
      if (nodes[i].lose > kept || nodes[j].lose > kept) continue;
      const [x1, y1] = at(i);
      const [x2, y2] = at(j);
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len > S * 0.095) continue;
      c.strokeStyle = rgba(GSOFT, 0.38 * (1 - len / (S * 0.095)));
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
    }
    for (let i = 0; i < N; i++) {
      const [x, y] = at(i);
      if (nodes[i].lose > kept) {
        if (ghost > 0) glow(c, x, y, S * 0.006, GREY, 0.18 * ghost);
        continue;
      }
      glow(c, x, y, S * 0.008, '#ffffff', 0.85 * (0.8 + 0.2 * Math.sin(m.t * 2 + i)));
    }
    c.restore();
  };
  const costs: Scene = {
    from: 0,
    to: 9,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.04, 0.45);
      const q = Math.max(0, m.b - 1) / 1.4;
      const cycles = Math.floor(q);
      pattern(c, m, 1 - (cycles - 1 + ss(0, 0.3, q - cycles)) * 0.07, 0, 1);
      // each cycle, a sweep round it
      const sweep = (q - cycles) * Math.PI * 2 - Math.PI / 2;
      ink(c, circlePath(cx, PY, SPX * 1.12, 80, 1610, sweep - 0.5, sweep, SPY / SPX), 1, { width: Math.max(1, S * 0.0018), color: GREY, seed: 1610, alpha: 0.6 * ss(1, 1.6, m.b) });
      figure(c, `CYCLE ${cycles}`, cx, PY + SPY * 1.3, S, ss(1, 2, m.b));
    },
    notes(m) {
      return [note('fd-a', 'EACH CYCLE IN THE DARK · A LITTLE LOST', 0.5, (PY + SPY * 1.3 + S * 0.04) / h, ss(1.4, 2.2, m.b), { tone: 'dim', align: 'c' })];
    },
  };
  const thinning: Scene = {
    from: 8.5,
    to: 17,
    fade: 1.4,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.06, 0.4);
      const u = ss(8.5, 16.5, m.b);
      pattern(c, m, lerp(0.5, 0.1, u), u * 1.4, 1 - u * 0.5);
    },
    notes(m) {
      return [note('fd-b', 'TOO THIN TO HOLD', 0.5, land ? 0.12 : 0.1, ss(13, 13.8, m.b), { tone: 'dim', align: 'c' })];
    },
  };
  const runs: Scene = {
    from: 16.5,
    to: 31.5,
    fade: 1.6,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.06, 0.4);
      // the ghosts of what was, fading; and where it was, something small still going round
      pattern(c, m, 0.1 * (1 - ss(17, 21, m.b)), 1.4, 0.6 * (1 - ss(18, 26, m.b)));
      const r = S * 0.05;
      ink(c, circlePath(cx, PY, r, 60, 1620), ss(17.4, 18.6, m.b), { width: thin, color: GREY, seed: 1620, alpha: 0.5 });
      const a = m.t * 1.6;
      const on = ss(17.8, 18.8, m.b);
      glow(c, cx + Math.cos(a) * r, PY + Math.sin(a) * r, S * 0.012, '#ffffff', 0.85 * on);
      glow(c, cx + Math.cos(a - 0.25) * r, PY + Math.sin(a - 0.25) * r, S * 0.007, '#ffffff', 0.35 * on);
    },
    notes(m) {
      return [note('fd-c', 'SOMETHING STILL RUNS', 0.5, (PY + S * 0.09) / h, ss(19, 19.8, m.b) * (1 - ss(27, 28, m.b)), { tone: 'dim', align: 'c' })];
    },
  };
  return {
    narration: [
      { from: 0.8, to: 7.6, text: 'Every cycle in the dark cost a little of who you were.' },
      { from: 8.4, to: 15.6, text: 'At the end, the pattern was too thin to hold.' },
      { from: 16.4, to: 25, text: 'Something still runs where you used to be, but it is not you.' },
    ],
    scenes: [costs, thinning, runs],
  };
});

/** The endings, second cut, by id. */
export const ENDINGS2: Record<EndingId, FilmDef> = {
  end_long_thought: LONG_THOUGHT,
  end_one_voice: ONE_VOICE,
  end_quiet_lattice: QUIET_LATTICE,
  end_aeon_seed: AEON_SEED,
  end_last_garden: LAST_GARDEN,
  end_hunger: HUNGER,
  end_recurrence: RECURRENCE,
  end_silence: SILENCE,
  end_will_fails: WILL_FAILS,
  end_fade: FADE,
};
