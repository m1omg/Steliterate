import { pow10 } from '../ui/fmt';
import { corners, grain, ink, ss, vignette, type Ctx, type Pt } from './draw';
import type { FilmArgs, FilmDef, FilmQuality, FilmScene, FilmText } from './films';
import { canvas, type Lazy } from './paint';

// The films' reel, second cut: a film is a run of scenes on a beat grid, each drawn from the
// moment alone (`Moment`), crossfading or zooming into the next; the reel lays the frame's
// corners, its labels and timecode, the narration and the title card over them. Scenes say what
// heavy paintings they need (`assets`); the reel paints the first scene's before the film starts
// and the rest a slice at a time while it plays (`warm`), and any frame drawn on demand paints
// what it needs at once, so every moment draws the same picture however it is reached.

export interface Moment {
  /** Beat of the film, seconds of the film, and how far through this scene (0..1). */
  b: number;
  t: number;
  p: number;
  w: number;
  h: number;
  /** The frame's smaller side, and the quality's share of detail (1, 0.7, 0.45). */
  S: number;
  k: number;
  q: FilmQuality;
}

export interface Scene {
  from: number;
  to: number;
  /** How it comes in: a crossfade over `fade` beats (default 1.5), a zoom through, or a cut on the beat. */
  enter?: 'fade' | 'zoom' | 'cut';
  fade?: number;
  draw(c: Ctx, m: Moment): void;
  /** Words standing in the frame while it shows (labels on a diagram, figures beside a star). */
  notes?(m: Moment): FilmText[];
  assets?: Lazy<unknown>[];
}

export interface ReelSpec {
  numeral: string;
  title: string;
  sub: string;
  /** The beat the title card comes in, and the film's last beat. */
  titleAt: number;
  /** η from the first beat to the title (the corner's timecode runs between). */
  eta: [number, number];
  narration: { from: number; to: number; text: string }[];
  scenes: Scene[];
  /** Drawn under the title card (after the last scene has gone). */
  card?(c: Ctx, m: Moment): void;
}

/** Years as the reel's timecode writes them: η and the mantissa × 10^n (in deep time, a power of a power). */
export function timecode(eta: number): string {
  if (eta > 300) return `η ${eta.toFixed(0)} · 10^${pow10(Math.log10(eta))} YR`;
  const e = Math.floor(eta);
  const m = Math.pow(10, eta - e);
  return `η ${eta.toFixed(2)} · ${m.toFixed(1)}×${pow10(e)} YR`;
}

/** Present from a0 to a1 (beats), easing in and out over `e` beats. */
export const span = (b: number, a0: number, a1: number, e = 0.5) => ss(a0, a0 + e, b) * (1 - ss(a1 - e, a1, b));

/** An ease in and out over 0..1. */
export const ease = (x: number) => {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
};

/** A note: a short label at a place in the frame (fractions of width and height), mono, in the film's accent or ink. */
export function note(id: string, text: string, x: number, y: number, opacity: number, o: { align?: 'l' | 'c' | 'r'; tone?: 'accent' | 'ink' | 'dim'; size?: 's' | 'm' } = {}): FilmText {
  return { id, text, kind: 'note', at: 'free', x, y, align: o.align ?? 'l', tone: o.tone ?? 'ink', size: o.size ?? 's', opacity };
}

/** Lays a film out from its spec: the scenes cut on the beat, the frame's corners, labels and timecode, the narration, and the title card that ends it. */
export function reel2(def: Omit<FilmDef, 'setup'> & { ink?: string }, make: (w: number, h: number, S: number, k: number, args: FilmArgs, q: FilmQuality) => ReelSpec): FilmDef {
  const INK = def.ink ?? '#e6dccb';
  return {
    ...def,
    setup(w, h, q, args = {}, eager = true): FilmScene {
      const S = Math.min(w, h);
      const k = q === 'low' ? 0.45 : q === 'medium' ? 0.7 : 1;
      const r = make(w, h, S, k, args, q);
      // the paintings in the order the film needs them, each once: the first scene's before the
      // first frame (here, unless the painter thread makes them: `eager` false), the rest while it plays
      const sorted = [...r.scenes].sort((a, b) => a.from - b.from);
      const order = [...new Set(sorted.flatMap((s) => s.assets ?? []))];
      const first = new Set(sorted[0]?.assets ?? []).size;
      if (eager) for (const a of order.slice(0, first)) a.get();
      const underline: Pt[] = Array.from({ length: 64 }, (_, i) => [w * 0.5 + S * (-0.32 + 0.64 * (i / 63)), h * 0.553 + S * 0.0018 * Math.sin((i / 63) * Math.PI * 2)] as const);
      const beat = (t: number) => (t * def.bpm) / 60;
      let layer: HTMLCanvasElement | null = null;
      let lc: CanvasRenderingContext2D | null = null;
      const moment = (s: Scene, b: number, t: number): Moment => ({ b, t, p: Math.min(1, Math.max(0, (b - s.from) / (s.to - s.from))), w, h, S, k, q });
      return {
        draw(c, t) {
          const b = beat(t);
          c.fillStyle = '#030304';
          c.fillRect(0, 0, w, h);
          if (b < r.titleAt) {
            const live = r.scenes.filter((s) => b >= s.from && b < s.to);
            // the one coming in is drawn over the one going, faded (or zoomed) in on a layer of its own
            live.sort((a, b2) => a.from - b2.from);
            live.forEach((s, i) => {
              const fade = s.enter === 'cut' ? 0 : (s.fade ?? 1.5);
              const into = fade > 0 ? ss(s.from, s.from + fade, b) : 1;
              if (i === 0 || into >= 1) {
                s.draw(c, moment(s, b, t));
                return;
              }
              // (made again if the frame's resolution changed: a slow device's player lowers it)
              if (!layer || layer.width !== c.canvas.width || layer.height !== c.canvas.height) {
                layer = canvas(c.canvas.width, c.canvas.height);
                lc = layer.getContext('2d')!;
              }
              const g = lc!;
              g.setTransform(1, 0, 0, 1, 0, 0);
              g.clearRect(0, 0, layer.width, layer.height);
              g.setTransform(c.getTransform());
              s.draw(g, moment(s, b, t));
              c.save();
              c.setTransform(1, 0, 0, 1, 0, 0);
              c.globalAlpha = into;
              if (s.enter === 'zoom') {
                const z = 0.86 + 0.14 * into;
                c.translate(layer.width / 2, layer.height / 2);
                c.scale(z, z);
                c.translate(-layer.width / 2, -layer.height / 2);
              }
              c.drawImage(layer, 0, 0);
              c.restore();
            });
          } else {
            r.card?.(c, { b, t, p: ss(r.titleAt, def.beats, b), w, h, S, k, q });
            ink(c, underline, ss(r.titleAt + 0.3, r.titleAt + 1.8, b), { width: S * 0.003, color: def.accent, seed: 8, alpha: 0.9 });
          }
          if (b < r.titleAt) corners(c, w, h, ss(0, 1.6, b) * (1 - ss(r.titleAt - 0.4, r.titleAt, b)), INK);
          vignette(c, w, h, 0.62);
          grain(c, w, h, t, 0.12 * k + 0.04);
          // in from black, and the last beat goes to black
          const fin = 1 - ss(0, 1.2, b);
          const out = Math.max(fin, ss(def.beats - 1, def.beats, b));
          if (out > 0) {
            c.fillStyle = `rgba(3,3,4,${out})`;
            c.fillRect(0, 0, w, h);
          }
        },
        text(t) {
          const b = beat(t);
          const ord = [...r.scenes].sort((a, b2) => a.from - b2.from);
          const n = ord.reduce((at, s, i) => (b >= s.from ? i : at), 0);
          const eta = r.eta[0] + (r.eta[1] - r.eta[0]) * Math.min(1, b / r.titleAt);
          const notes: FilmText[] = [];
          for (const s of ord) {
            if (!s.notes) continue;
            // every note of every scene is always listed, present or not, so the words in the page stay put
            const m = moment(s, b, t);
            const live = b >= s.from && b < s.to && b < r.titleAt;
            for (const x of s.notes(m)) notes.push(live ? x : { ...x, opacity: 0 });
          }
          return [
            { id: 'reel', kind: 'label', at: 'tl', text: `STELITERATE · REEL ${r.numeral}`, opacity: span(b, 0.8, r.titleAt) },
            { id: 'shot', kind: 'label', at: 'tr', text: `SHOT ${String(n + 1).padStart(2, '0')} / ${String(ord.length).padStart(2, '0')}`, opacity: span(b, 0.8, r.titleAt) },
            { id: 'code', kind: 'code', at: 'bl', text: timecode(eta), opacity: span(b, 1, r.titleAt) },
            ...r.narration.map((x, i) => ({ id: `n${i}`, kind: 'narration' as const, at: 'low' as const, text: x.text, opacity: span(b, x.from, x.to, 0.6) })),
            ...notes,
            { id: 'title', kind: 'title', at: 'mid', text: r.title, opacity: span(b, r.titleAt + 0.2, def.beats + 0.2, 0.8) },
            { id: 'sub', kind: 'sub', at: 'mid', text: r.sub, opacity: span(b, r.titleAt + 1, def.beats + 0.2, 0.8) },
          ];
        },
        warm(until) {
          for (const a of order) if (!a.warm(until)) return;
        },
        assets: order,
        first,
      };
    },
  };
}
