import { Rng } from '../game/rng';
import { pow10 } from '../ui/fmt';
import { Hatch, Stipple, circlePath, corners, glow, grain, ink, rgba, ss, vignette, type Ctx, type Pt } from './draw';

// The films (the new version, part 4): one for each age and each ending, every frame drawn by
// code from the film's time. A film is laid out once for its size and quality (`setup`), then
// draws any moment of itself (`draw`) and says what text stands over it then (`text`, real DOM
// text, for translation and screen readers). Its cuts fall on a beat grid; its sound is in cue.ts.
// The words are the game's own: each age's introduction, each ending's epilogue, and nothing of
// what an ending's text does not say.

export type FilmQuality = 'low' | 'medium' | 'high';
export type FilmId =
  | 'dusk'
  | 'last_light'
  | 'great_decay'
  | 'last_warmth'
  | 'great_evaporation'
  | 'last_horizon'
  | 'end_long_thought'
  | 'end_one_voice'
  | 'end_quiet_lattice'
  | 'end_aeon_seed'
  | 'end_last_garden'
  | 'end_hunger'
  | 'end_recurrence'
  | 'end_silence'
  | 'end_fade'
  | 'end_will_fails';

/** What a film is told of the game it is shown in (the fate of matter, the moment), for its words and its timecode. */
export interface FilmArgs {
  fate?: 'decay' | 'stable' | 'curvature';
  eta?: number;
}

/** A line of text over the film: where, in which voice, and how present it is now (0..1). */
export interface FilmText {
  id: string;
  text: string;
  /** title (display face), sub (mono, spaced), narration (serif italic), label and code (mono, small, in a corner) */
  kind: 'title' | 'sub' | 'narration' | 'label' | 'code';
  at: 'tl' | 'tr' | 'bl' | 'br' | 'mid' | 'low';
  opacity: number;
}

export interface FilmScene {
  draw(c: Ctx, t: number): void;
  text(t: number): FilmText[];
}

export interface FilmDef {
  id: FilmId;
  /** Its name, for the Codex's list of films. */
  name: string;
  bpm: number;
  beats: number;
  accent: string;
  setup(w: number, h: number, q: FilmQuality, args?: FilmArgs): FilmScene;
}

/** How long a film runs, in seconds. */
export const filmLength = (f: FilmDef) => (f.beats * 60) / f.bpm;

const INK = '#e6dccb';
const VOID = '#030304';
const DWARF = '#ff7a4c';
const PEACH = '#ffd2a8';

/** Present from a0 to a1 (in beats), easing in and out over `e` beats. */
const span = (b: number, a0: number, a1: number, e = 0.5) => ss(a0, a0 + e, b) * (1 - ss(a1 - e, a1, b));

/** Years as the reel's timecode writes them: η and the mantissa × 10^n (in deep time, a power of a power). */
function timecode(eta: number): string {
  if (eta > 300) return `η ${eta.toFixed(0)} · 10^${pow10(Math.log10(eta))} YR`;
  const e = Math.floor(eta);
  const m = Math.pow(10, eta - e);
  return `η ${eta.toFixed(2)} · ${m.toFixed(1)}×${pow10(e)} YR`;
}

// ------------------------------------------------------------------ the reel

interface Shot {
  from: number;
  to: number;
  draw(c: Ctx, b: number, t: number): void;
}

interface Reel {
  numeral: string;
  title: string;
  sub: string;
  /** The beat the title card comes in. */
  titleAt: number;
  /** η from the first beat to the title card (the timecode runs between). */
  eta: [number, number];
  narration: { from: number; to: number; text: string }[];
  shots: Shot[];
}

/** Lays a film out as a reel: its shots cut on the beat, the frame's corners, labels and timecode, the narration, and the title card that ends it. */
function reel(def: Omit<FilmDef, 'setup'>, make: (w: number, h: number, S: number, k: number, args: FilmArgs) => Reel): FilmDef {
  return {
    ...def,
    setup(w, h, q, args = {}) {
      const S = Math.min(w, h);
      const k = q === 'low' ? 0.45 : q === 'medium' ? 0.7 : 1;
      const r = make(w, h, S, k, args);
      const underline: Pt[] = Array.from({ length: 48 }, (_, i) => [w * 0.5 + S * (-0.3 + 0.6 * (i / 47)), h * 0.553 + S * 0.0018 * Math.sin((i / 47) * Math.PI * 2)] as const);
      const beat = (t: number) => (t * def.bpm) / 60;
      return {
        draw(c, t) {
          const b = beat(t);
          c.fillStyle = VOID;
          c.fillRect(0, 0, w, h);
          const shot = r.shots.find((s) => b >= s.from && b < s.to);
          if (shot && b < r.titleAt) shot.draw(c, b, t);
          if (b >= r.titleAt) ink(c, underline, ss(r.titleAt + 0.3, r.titleAt + 1.5, b), { width: S * 0.003, color: def.accent, seed: 8, alpha: 0.9 });
          if (b < r.titleAt) corners(c, w, h, ss(0, 1.6, b) * (1 - ss(r.titleAt - 0.4, r.titleAt, b)), INK);
          vignette(c, w, h, 0.6);
          grain(c, w, h, t, 0.14);
          // the last beat goes to black
          const out = ss(def.beats - 0.8, def.beats, b);
          if (out > 0) {
            c.fillStyle = `rgba(3,3,4,${out})`;
            c.fillRect(0, 0, w, h);
          }
        },
        text(t) {
          const b = beat(t);
          const n = r.shots.findIndex((s) => b >= s.from && b < s.to);
          const eta = r.eta[0] + (r.eta[1] - r.eta[0]) * Math.min(1, b / r.titleAt);
          return [
            { id: 'reel', kind: 'label', at: 'tl', text: `STELITERATE · REEL ${r.numeral}`, opacity: span(b, 0.5, r.titleAt) },
            { id: 'shot', kind: 'label', at: 'tr', text: `SHOT 0${Math.max(1, n + 1)} / 0${r.shots.length}`, opacity: span(b, 0.5, r.titleAt) },
            { id: 'code', kind: 'code', at: 'bl', text: timecode(eta), opacity: span(b, 0.8, r.titleAt) },
            ...r.narration.map((x, i) => ({ id: `n${i}`, kind: 'narration' as const, at: 'low' as const, text: x.text, opacity: span(b, x.from, x.to, 0.4) })),
            { id: 'title', kind: 'title', at: 'mid', text: r.title, opacity: span(b, r.titleAt + 0.1, def.beats + 0.2, 0.6) },
            { id: 'sub', kind: 'sub', at: 'mid', text: r.sub, opacity: span(b, r.titleAt + 0.7, def.beats + 0.2, 0.6) },
          ];
        },
      };
    },
  };
}

// ------------------------------------------------------------------ pieces drawn in more than one film

/** A black hole: its shadow, the photon ring glowing round it, an ink rim, and a thin disk of ink ellipses across it. */
function hole(c: Ctx, x: number, y: number, r: number, S: number, o: { disk?: number; ring?: number; seed?: number } = {}) {
  const disk = o.disk ?? 1;
  const seed = o.seed ?? 1;
  const back = [1.9, 2.5, 3.2].map((k, i) => circlePath(x, y, r * k, 140, seed + i, Math.PI, Math.PI * 2, 0.26));
  const front = [1.9, 2.5, 3.2].map((k, i) => circlePath(x, y, r * k, 140, seed + i, 0, Math.PI, 0.26));
  // the far half of the disk behind it, the near half over it
  for (const e of back) ink(c, e, disk, { width: S * 0.0016, color: PEACH, seed: 3, alpha: 0.45 * disk });
  glow(c, x, y, r * 2.6, PEACH, 0.22 * (o.ring ?? 1));
  c.fillStyle = '#000';
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  ink(c, circlePath(x, y, r * 1.04, 120, 11), 1, { width: S * 0.0034, color: PEACH, seed: 11, alpha: 0.85 * (o.ring ?? 1) });
  for (const e of front) ink(c, e, disk, { width: S * 0.0016, color: PEACH, seed: 4, alpha: 0.55 * disk });
}

/** A flash: a glow that blooms and fades, and ink rays thrown out from it (p from 0 to 1). */
function burst(c: Ctx, x: number, y: number, r: number, S: number, p: number, color: string, seed: number) {
  if (p <= 0 || p >= 1) return;
  glow(c, x, y, r * (0.6 + 1.6 * p), color, 0.9 * (1 - p));
  const rng = new Rng(seed);
  for (let i = 0; i < 14; i++) {
    const a = rng.range(0, Math.PI * 2);
    const l0 = r * 0.3;
    const l1 = r * rng.range(1.1, 2.2);
    ink(c, [[x + Math.cos(a) * l0, y + Math.sin(a) * l0], [x + Math.cos(a) * l1, y + Math.sin(a) * l1]], ss(0, 0.6, p), { width: S * 0.0018, color, seed: seed + i, alpha: 0.8 * (1 - p) });
  }
}

/** Faint, vast ellipses (the positronium), about a centre far off the frame. */
function ellipses(c: Ctx, w: number, h: number, S: number, reveal: number, color: string, alpha: number) {
  for (let k = 0; k < 6; k++) {
    const r = S * (1.6 - 0.18 * k);
    ink(c, circlePath(w * 1.15, h * 0.2, r, 200, 30 + k, Math.PI * 0.45, Math.PI * 1.15, 0.62), reveal, { width: S * 0.0012, color, seed: 30 + k, alpha });
  }
}

/** A field of small stars, laid out once, each with a beat it goes out at (99: it stays), clear of where the words stand. */
function starField(w: number, h: number, S: number, n: number, seed: number, outShare: number, outFrom: number, outTo: number) {
  const rng = new Rng(seed);
  const clear = (x: number, y: number) => (y > h * 0.74 && y < h * 0.9 && x > w * 0.18 && x < w * 0.82) || ((y < h * 0.14 || y > h * 0.86) && (x < w * 0.25 || x > w * 0.75));
  const out: { x: number; y: number; r: number; out: number }[] = [];
  for (let i = 0; out.length < n && i < n * 30; i++) {
    const x = rng.next() * w;
    const y = rng.next() * h;
    if (!clear(x, y)) out.push({ x, y, r: S * rng.range(0.005, 0.015), out: rng.chance(outShare) ? rng.range(outFrom, outTo) : 99 });
  }
  return out;
}

/** A dark sphere, hatched on its night side and inked round. */
function hatchedBall(c: Ctx, x: number, y: number, R: number, S: number, hatch: Hatch, o: { color: string; rim: string; reveal?: number; alpha?: number; seed: number }) {
  c.fillStyle = '#0a0807';
  c.beginPath();
  c.arc(x, y, R, 0, Math.PI * 2);
  c.fill();
  hatch.draw(c, x, y, R, { color: o.color, width: Math.max(1, S * 0.0014), reveal: o.reveal, alpha: o.alpha ?? 0.8 });
  ink(c, circlePath(x, y, R, 60, o.seed), o.reveal ?? 1, { width: Math.max(1, S * 0.0016), color: o.rim, seed: o.seed, alpha: 0.8 });
}

// ------------------------------------------------------------------ the ages

/** The Long Dusk: the reel opens on one red dwarf, cuts to the dying world in its light, then to the last stars going out one by one. */
const DUSK = reel({ id: 'dusk', name: 'The Long Dusk', bpm: 96, beats: 16, accent: '#f28a4f' }, (w, h, S, k) => {
  const star = new Stipple(11, Math.round(1500 * k), (r) => Math.pow(1 - r, 2.4));
  const small = new Stipple(13, Math.round(140 * k), (r) => Math.pow(1 - r, 1.6));
  const world = new Hatch(12, Math.round(54 * k), [1, -0.35]);
  const field = starField(w, h, S, Math.round(90 * k), 21, 0.45, 8.6, 11.8);
  const [wx, wy] = [w * 0.42, h * 0.46];
  const toWorld = Math.atan2(wy - h * 0.2, wx - w * 0.9);
  const orbit = circlePath(w * 0.9, h * 0.2, Math.hypot(w * 0.48, h * 0.26), 160, 5, toWorld - 0.5, toWorld + 0.27);
  const rim = circlePath(wx, wy, S * 0.25, 120, 9);
  const path: Pt[] = Array.from({ length: 80 }, (_, i) => [w * (0.05 + 0.9 * (i / 79)), h * (0.58 - 0.16 * Math.sin((i / 79) * Math.PI)) + S * 0.012 * Math.sin((i / 79) * Math.PI * 3)] as const);
  return {
    numeral: 'I',
    title: 'The Long Dusk',
    sub: 'Age I · the Late Stelliferous Era',
    titleAt: 12,
    eta: [Math.log10(9.0e13), 14],
    narration: [
      { from: 4.3, to: 8, text: 'Ninety trillion years after the first light,' },
      { from: 8.3, to: 11.9, text: 'the galaxy has run out of gas to make new stars.' },
    ],
    shots: [
      {
        from: 0,
        to: 4,
        draw(c, b, t) {
          const show = ss(0.3, 3.2, b);
          glow(c, w * 0.5, h * 0.5, S * 0.3, DWARF, 0.32 * show);
          star.draw(c, w * 0.5, h * 0.5, S * 0.075, { color: DWARF, dot: S * 0.0026, show, t });
        },
      },
      {
        from: 4,
        to: 8,
        draw(c, b, t) {
          const z = 1 + 0.05 * ((b - 4) / 4);
          c.save();
          c.translate(wx, wy);
          c.scale(z, z);
          c.translate(-wx, -wy);
          ink(c, orbit, ss(4.4, 7.6, b), { width: S * 0.0024, color: INK, seed: 4, alpha: 0.55 });
          glow(c, w * 0.9, h * 0.2, S * 0.22, DWARF, 0.3);
          small.draw(c, w * 0.9, h * 0.2, S * 0.03, { color: DWARF, dot: S * 0.003, t });
          const R = S * 0.25;
          c.fillStyle = '#0a0807';
          c.beginPath();
          c.arc(wx, wy, R, 0, Math.PI * 2);
          c.fill();
          glow(c, wx + R * 0.55, wy - R * 0.25, R * 0.9, DWARF, 0.12);
          world.draw(c, wx, wy, R, { color: INK, width: S * 0.0018, reveal: ss(4.1, 6.8, b), alpha: 0.8 });
          ink(c, rim, ss(4, 5.4, b), { width: S * 0.003, color: INK, seed: 9, alpha: 0.9 });
          c.restore();
        },
      },
      {
        from: 8,
        to: 12,
        draw(c, b, t) {
          for (const f of field) {
            const gone = ss(f.out, f.out + 0.35, b);
            if (gone >= 1) continue;
            glow(c, f.x, f.y, f.r * 5, DWARF, 0.18 * (1 - gone));
            small.draw(c, f.x, f.y, f.r, { color: DWARF, dot: Math.max(1, S * 0.0018), gone, t });
          }
          ink(c, path, ss(8.2, 11.6, b), { width: S * 0.0016, color: INK, seed: 6, alpha: 0.6 });
        },
      },
    ],
  };
});

/** The Last Light: the last red dwarf goes out; white dwarfs and brown dwarfs are what is left; now and then two brown dwarfs collide and a small star burns again. */
const LAST_LIGHT = reel({ id: 'last_light', name: 'The Last Light', bpm: 96, beats: 16, accent: '#93c4ff' }, (w, h, S, k) => {
  const star = new Stipple(31, Math.round(1300 * k), (r) => Math.pow(1 - r, 2.4));
  const white = new Stipple(32, Math.round(90 * k), (r) => Math.pow(1 - r, 2));
  const brown = new Hatch(33, Math.round(16 * k + 6), [1, -0.2]);
  const rng = new Rng(34);
  const remnants = Array.from({ length: Math.round(26 * k + 8) }, () => ({ x: rng.range(0.08, 0.92) * w, y: rng.range(0.16, 0.7) * h, r: S * rng.range(0.012, 0.03), white: rng.chance(0.55) }));
  const pathA: Pt[] = Array.from({ length: 40 }, (_, i) => [w * (0.28 + 0.22 * (i / 39)), h * (0.36 + 0.12 * (i / 39))] as const);
  const pathB: Pt[] = Array.from({ length: 40 }, (_, i) => [w * (0.72 - 0.22 * (i / 39)), h * (0.6 - 0.12 * (i / 39))] as const);
  return {
    numeral: 'II',
    title: 'The Degenerate Age',
    sub: 'Age II · the Degenerate Era',
    titleAt: 12,
    eta: [14, 15],
    narration: [
      { from: 0.6, to: 4, text: 'The last ordinary stars are gone.' },
      { from: 4.3, to: 8, text: 'What remains are their corpses.' },
      { from: 8.3, to: 11.9, text: 'Now and then two brown dwarfs collide, and a small star burns again.' },
    ],
    shots: [
      {
        from: 0,
        to: 4,
        draw(c, b, t) {
          // the last light: the red dwarf thins dot by dot to nothing
          const gone = ss(0.6, 3.6, b);
          glow(c, w * 0.5, h * 0.48, S * 0.3, DWARF, 0.32 * (1 - gone));
          star.draw(c, w * 0.5, h * 0.48, S * 0.075, { color: DWARF, dot: S * 0.0026, gone, t });
        },
      },
      {
        from: 4,
        to: 8,
        draw(c, b, t) {
          remnants.forEach((x, i) => {
            const show = ss(4 + i * 0.08, 4.6 + i * 0.08, b);
            if (x.white) {
              glow(c, x.x, x.y, x.r * 3, '#cfe3ff', 0.16 * show);
              white.draw(c, x.x, x.y, x.r * 0.5, { color: '#dfeaff', dot: Math.max(1, S * 0.0016), show, t });
            } else hatchedBall(c, x.x, x.y, x.r, S, brown, { color: '#9a6a52', rim: '#b98a6a', reveal: show, seed: i });
          });
        },
      },
      {
        from: 8,
        to: 12,
        draw(c, b, t) {
          // two brown dwarfs fall together, and a star burns again where they meet
          const p = ss(8, 10.2, b);
          const meet: Pt = [w * 0.5, h * 0.48];
          ink(c, pathA, p, { width: S * 0.0016, color: INK, seed: 41, alpha: 0.45 });
          ink(c, pathB, p, { width: S * 0.0016, color: INK, seed: 42, alpha: 0.45 });
          if (b < 10.2)
            for (const [path, seed] of [
              [pathA, 43],
              [pathB, 44],
            ] as const) {
              const at = path[Math.min(path.length - 1, Math.floor(p * (path.length - 1)))];
              hatchedBall(c, at[0], at[1], S * 0.05, S, brown, { color: '#9a6a52', rim: '#b98a6a', seed });
            }
          burst(c, meet[0], meet[1], S * 0.12, S, ss(10.1, 11.6, b), '#ffb38a', 45);
          if (b >= 10.4) {
            const lit = ss(10.4, 11.4, b);
            glow(c, meet[0], meet[1], S * 0.2, DWARF, 0.35 * lit);
            star.draw(c, meet[0], meet[1], S * 0.04, { color: DWARF, dot: S * 0.0022, show: lit, t });
          }
        },
      },
    ],
  };
});

/** Into the Black Hole Age: the worlds dissolve (the Great Decay), or the last warm things cool or burst (the Last Warmth); the black holes remain. */
function blackHoleAge(id: 'great_decay' | 'last_warmth', name: string): FilmDef {
  return reel({ id, name, bpm: 96, beats: 16, accent: '#a48dff' }, (w, h, S, k, args) => {
    const fate = args.fate ?? (id === 'great_decay' ? 'decay' : 'stable');
    const world = new Hatch(51, Math.round(48 * k), [1, -0.3]);
    const motes = new Stipple(52, Math.round(900 * k), (r) => 1 - r * 0.4);
    const ns = new Stipple(53, Math.round(220 * k), (r) => Math.pow(1 - r, 2));
    const rng = new Rng(54);
    const small = Array.from({ length: 7 }, (_, i) => ({ x: rng.range(0.12, 0.88) * w, y: rng.range(0.18, 0.66) * h, r: S * rng.range(0.012, 0.026), at: 8.6 + i * 0.45 }));
    const first =
      fate === 'decay'
        ? ['Ordinary matter has decayed away.', 'Only the black holes remain.']
        : fate === 'curvature'
          ? ['The neutron stars have burst.', 'Now the black holes are the warmest things in the universe.']
          : ['The protons held, and nothing marked the moment.', 'Now the black holes are the warmest things in the universe.'];
    return {
      numeral: 'III',
      title: 'The Black Hole Age',
      sub: `Age III · ${name}`,
      titleAt: 12,
      eta: [fate === 'decay' ? 38.6 : 39.2, 40],
      narration: [
        { from: 0.6, to: 4, text: first[0] },
        { from: 4.3, to: 8, text: first[1] },
        { from: 8.3, to: 11.9, text: 'They spin, and they very slowly evaporate.' },
      ],
      shots: [
        {
          from: 0,
          to: 4,
          draw(c, b, t) {
            const [x, y, R] = [w * 0.5, h * 0.46, S * 0.22];
            if (fate === 'decay') {
              // a world coming apart into motes
              const gone = ss(0.8, 3.8, b);
              c.save();
              c.globalAlpha = 1 - gone;
              hatchedBall(c, x, y, R, S, world, { color: INK, rim: INK, seed: 55 });
              c.restore();
              motes.draw(c, x, y, R * (1 + 0.9 * gone), { color: INK, dot: S * 0.0022, show: gone * 1.2, gone: ss(2.6, 4, b), t, alpha: 0.7 });
            } else {
              // a neutron star, the last thing warm of its own accord: it cools, or it bursts
              const fade = ss(0.8, 3.6, b);
              const r = S * 0.03;
              if (fate === 'curvature') {
                glow(c, x, y, S * 0.2, '#9cc3ff', 0.4 * (1 - ss(1.6, 2.2, b)));
                if (b < 2) ns.draw(c, x, y, r, { color: '#dde8ff', dot: S * 0.0022, t });
                burst(c, x, y, S * 0.2, S, ss(1.9, 3.6, b), '#cfe0ff', 56);
              } else {
                glow(c, x, y, S * 0.2, '#9cc3ff', 0.4 * (1 - fade));
                ns.draw(c, x, y, r, { color: '#dde8ff', dot: S * 0.0022, gone: fade * 0.85, t });
              }
            }
          },
        },
        {
          from: 4,
          to: 8,
          draw(c, b) {
            const z = 1 + 0.04 * ((b - 4) / 4);
            hole(c, w * 0.5, h * 0.46, S * 0.11 * z, S, { disk: ss(4.2, 6.5, b), seed: 57 });
          },
        },
        {
          from: 8,
          to: 12,
          draw(c, b) {
            // the small ones go first, each in a last burst
            small.forEach((s, i) => {
              if (b < s.at) hole(c, s.x, s.y, s.r, S, { disk: 0.5, ring: 0.8, seed: 58 + i });
              burst(c, s.x, s.y, s.r * 4, S, ss(s.at, s.at + 1, b), '#e9dcff', 59 + i);
            });
          },
        },
      ],
    };
  });
}

/** The Great Evaporation (where space unmakes matter): the last worlds evaporate into particles and light. */
const GREAT_EVAPORATION = reel({ id: 'great_evaporation', name: 'The Great Evaporation', bpm: 96, beats: 16, accent: '#a48dff' }, (w, h, S, k) => {
  const rng = new Rng(61);
  const worlds = Array.from({ length: Math.round(6 * k + 3) }, (_, i) => ({
    x: rng.range(0.14, 0.86) * w,
    y: rng.range(0.2, 0.66) * h,
    r: S * rng.range(0.03, 0.07),
    at: 1 + i * 0.9,
    hatch: new Hatch(62 + i, 18, [1, -0.3]),
    motes: new Stipple(70 + i, Math.round(160 * k + 40), (r) => 1 - r * 0.5),
  }));
  return {
    numeral: 'III',
    title: 'The Great Evaporation',
    sub: 'Every world, every dead star',
    titleAt: 12,
    eta: [88.6, 89.5],
    narration: [
      { from: 0.6, to: 6, text: 'Space took some 10⁹⁰ years to unmake it all, and now it is done.' },
      { from: 6.3, to: 11.9, text: 'Only what was re-encoded in electrons and positrons goes on.' },
    ],
    shots: [
      {
        from: 0,
        to: 12,
        draw(c, b, t) {
          worlds.forEach((x, i) => {
            const gone = ss(x.at, x.at + 2.4, b);
            if (gone < 1) {
              c.save();
              c.globalAlpha = 1 - gone;
              hatchedBall(c, x.x, x.y, x.r, S, x.hatch, { color: INK, rim: INK, seed: 64 + i });
              c.restore();
            }
            x.motes.draw(c, x.x, x.y, x.r * (1 + 2.2 * gone), { color: '#d2c6ff', dot: Math.max(1, S * 0.0018), show: gone * 1.3, gone: ss(x.at + 1.6, x.at + 3.4, b), t, alpha: 0.7 });
          });
          hole(c, w * 0.82, h * 0.3, S * 0.05, S, { disk: ss(6, 9, b) * 0.6, seed: 63 });
        },
      },
    ],
  };
});

/** The Last Horizon: the last black hole shrinks and bursts; after it only the dark, and what was saved. */
const LAST_HORIZON = reel({ id: 'last_horizon', name: 'The Last Horizon', bpm: 96, beats: 16, accent: '#9aa3b0' }, (w, h, S, k, args) => {
  const stable = args.fate === 'stable';
  const iron = new Hatch(81, Math.round(30 * k + 10), [1, -0.3]);
  const rng = new Rng(82);
  const dead = Array.from({ length: Math.round(10 * k + 4) }, () => ({ x: rng.range(0.1, 0.9) * w, y: rng.range(0.18, 0.7) * h, r: S * rng.range(0.012, 0.03) }));
  return {
    numeral: 'IV',
    title: 'The Dark Era',
    sub: 'Age IV · nothing warmer than the sky',
    titleAt: 12,
    eta: [99.4, 100.2],
    narration: [
      { from: 0.6, to: 4, text: 'The last black hole has evaporated.' },
      { from: 4.3, to: 8, text: 'There are no more sources, only what you saved.' },
      { from: 8.3, to: 11.9, text: stable ? 'The matter is still here, as cold as the sky itself.' : 'Positronium atoms wider than the old observable universe drift through the dark.' },
    ],
    shots: [
      {
        from: 0,
        to: 4,
        draw(c, b) {
          // the last horizon tightens, and goes
          const shrink = 1 - ss(0.4, 3.0, b) * 0.85;
          if (b < 3.1) hole(c, w * 0.5, h * 0.46, S * 0.12 * shrink, S, { disk: 0, ring: 1, seed: 83 });
          burst(c, w * 0.5, h * 0.46, S * 0.3, S, ss(3.0, 4, b), '#f2eefc', 84);
        },
      },
      {
        from: 4,
        to: 8,
        draw(c, b) {
          // nothing: the frame, the grain, and a faint afterglow going
          glow(c, w * 0.5, h * 0.46, S * 0.5, '#c9ced6', 0.06 * (1 - ss(4, 7.5, b)));
        },
      },
      {
        from: 8,
        to: 12,
        draw(c, b) {
          if (stable)
            dead.forEach((d, i) => hatchedBall(c, d.x, d.y, d.r, S, iron, { color: '#9aa3b0', rim: '#b9c0ca', reveal: ss(8.2 + i * 0.12, 9 + i * 0.12, b), alpha: 0.7, seed: 85 + i }));
          else ellipses(c, w, h, S, ss(8.2, 11.5, b), '#c9ced6', 0.35);
        },
      },
    ],
  };
});

// ------------------------------------------------------------------ the endings

/** An ending's film: its motif across two shots, then its name. Only what its own words say. */
function endingFilm(id: FilmId, name: string, kind: 'victory' | 'endurance' | 'dark' | 'defeat', words: [string, string], motif: (w: number, h: number, S: number, k: number) => (c: Ctx, b: number, t: number) => void): FilmDef {
  const accent = kind === 'victory' ? '#f2c46d' : kind === 'endurance' ? '#9fd8c8' : kind === 'dark' ? '#d0502c' : '#9aa3b0';
  return reel({ id, name, bpm: 84, beats: 16, accent }, (w, h, S, k, args) => {
    const draw = motif(w, h, S, k);
    const eta = args.eta ?? 120;
    return {
      numeral: kind === 'defeat' ? '∅' : 'Ω',
      title: name,
      sub: kind === 'victory' ? 'Victory' : kind === 'endurance' ? 'Endurance' : kind === 'dark' ? 'The Hunger' : 'Defeat',
      titleAt: 11,
      eta: [eta - 0.4, eta],
      narration: [
        { from: 0.6, to: 5.4, text: words[0] },
        { from: 5.7, to: 10.9, text: words[1] },
      ],
      shots: [
        { from: 0, to: 5.5, draw },
        { from: 5.5, to: 11, draw },
      ],
    };
  });
}

const LONG_THOUGHT = endingFilm('end_long_thought', 'The Long Thought', 'victory', ['You slow until each thought takes longer than the one before,', 'and you sleep between them for longer still.'], (w, h, S) => {
  // thoughts along a spiral, each further on than the last
  const pts: Pt[] = [];
  for (let i = 0; i < 26; i++) {
    const a = Math.sqrt(i) * 2.4;
    const r = S * 0.02 * Math.pow(i + 1, 0.9);
    pts.push([w * 0.5 + Math.cos(a) * r, h * 0.46 + Math.sin(a) * r * 0.8]);
  }
  return (c, b) => {
    // ever longer between one thought and the next
    const shown = Math.min(pts.length, Math.floor(Math.pow(b / 11, 0.6) * pts.length) + 1);
    ink(c, pts.slice(0, shown), 1, { width: S * 0.0014, color: INK, seed: 91, alpha: 0.45 });
    pts.slice(0, shown).forEach(([x, y], i) => glow(c, x, y, S * 0.03, '#f2c46d', i === shown - 1 ? 0.5 : 0.15));
  };
});

const ONE_VOICE = endingFilm('end_one_voice', 'One Voice', 'victory', ['The Threads braid into one.', 'There is no one left to disagree.'], (w, h, S) => {
  const threads = Array.from({ length: 5 }, (_, j) =>
    Array.from({ length: 90 }, (_, i) => {
      const u = i / 89;
      const spread = (1 - ss(0.35, 0.85, u)) * S * 0.16;
      return [w * (0.08 + 0.84 * u), h * 0.46 + (j - 2) * spread + Math.sin(u * 14 + j * 1.3) * S * 0.012 * (1 - u * 0.6)] as Pt;
    }),
  );
  return (c, b) => threads.forEach((p, j) => ink(c, p, ss(0.2 + j * 0.15, 9.5, b), { width: S * 0.0022, color: j === 2 ? '#f2c46d' : INK, seed: 100 + j, alpha: 0.75 }));
});

const QUIET_LATTICE = endingFilm('end_quiet_lattice', 'The Quiet Lattice', 'victory', ['The last of the others finish writing, and let go.', 'What remains keeps the record.'], (w, h, S) => {
  const n = 9;
  const cell = S * 0.055;
  const x0 = w * 0.5 - (n * cell) / 2;
  const y0 = h * 0.46 - (n * cell) / 2;
  return (c, b) => {
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const at = 0.3 + ((i + j) / (2 * n)) * 8;
        const x = x0 + i * cell;
        const y = y0 + j * cell;
        const d = cell * 0.82;
        ink(c, [[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]], ss(at, at + 1.2, b), { width: Math.max(1, S * 0.0014), color: INK, seed: 120 + i * n + j, alpha: 0.6 });
      }
  };
});

const AEON_SEED = endingFilm('end_aeon_seed', 'The Aeon Seed', 'victory', ['When the Heart finally evaporates,', 'its last light carries a pattern out to where scale stops meaning anything.'], (w, h, S) => (c, b) => {
  if (b < 4) hole(c, w * 0.5, h * 0.46, S * 0.12 * (1 - ss(0.5, 3.6, b) * 0.85), S, { disk: 0, seed: 130 });
  burst(c, w * 0.5, h * 0.46, S * 0.3, S, ss(3.6, 5.6, b), '#fff3d6', 131);
  // the pattern carried out: a ring opening out to where scale stops meaning anything
  const r = S * 0.05 * Math.pow(1 + Math.max(0, b - 4), 1.6);
  if (b > 4) ink(c, circlePath(w * 0.5, h * 0.46, r, 160, 132), 1, { width: S * 0.002, color: '#f2c46d', seed: 132, alpha: 0.7 * (1 - ss(9, 11, b)) });
});

const LAST_GARDEN = endingFilm('end_last_garden', 'The Last Garden', 'victory', ['You wake the Kin and grow a garden around the last warmth you saved.', 'A few thousand years of green, then sleep, then green again.'], (w, h, S) => {
  const rng = new Rng(140);
  const leaves = Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2 + rng.range(-0.2, 0.2), r: S * rng.range(0.08, 0.2), l: S * rng.range(0.05, 0.09), at: 0.5 + i * 0.55 }));
  return (c, b) => {
    glow(c, w * 0.5, h * 0.46, S * 0.18, '#ffb36a', 0.4);
    for (const lf of leaves) {
      const cx = w * 0.5 + Math.cos(lf.a) * lf.r;
      const cy = h * 0.46 + Math.sin(lf.a) * lf.r;
      const tip: Pt = [cx + Math.cos(lf.a) * lf.l, cy + Math.sin(lf.a) * lf.l];
      const side = (s: number): Pt[] =>
        Array.from({ length: 12 }, (_, i) => {
          const u = i / 11;
          const off = Math.sin(u * Math.PI) * lf.l * 0.32 * s;
          return [cx + (tip[0] - cx) * u - Math.sin(lf.a) * off, cy + (tip[1] - cy) * u + Math.cos(lf.a) * off] as Pt;
        });
      const p = ss(lf.at, lf.at + 1.4, b);
      ink(c, side(1), p, { width: S * 0.0018, color: '#a9d48a', seed: 141, alpha: 0.85 });
      ink(c, side(-1), p, { width: S * 0.0018, color: '#a9d48a', seed: 142, alpha: 0.85 });
    }
  };
});

const HUNGER = endingFilm('end_hunger', 'The Hunger', 'dark', ['The swarms that were once your people', 'move from ember to ember, eating what light is left.'], (w, h, S, k) => {
  const embers = starField(w, h, S, Math.round(14 * k + 6), 150, 1, 1, 10.5);
  const rng = new Rng(151);
  const swarm = Array.from({ length: Math.round(220 * k + 60) }, () => [rng.gauss(), rng.gauss(), rng.next()] as const);
  return (c, b, t) => {
    for (const e of embers) if (b < e.out) glow(c, e.x, e.y, e.r * 4, '#ff8a5a', 0.3);
    // the swarm is at whichever ember goes out next
    const next = embers.filter((e) => e.out > b).sort((x, y) => x.out - y.out)[0] ?? embers[0];
    if (!next) return;
    const cx = next.x + Math.sin(t * 0.7) * S * 0.04;
    const cy = next.y + Math.cos(t * 0.6) * S * 0.03;
    c.save();
    c.fillStyle = '#d0502c';
    for (const [gx, gy, f] of swarm) {
      c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 5 + f * 30);
      c.fillRect(cx + gx * S * 0.05, cy + gy * S * 0.035, Math.max(1, S * 0.002), Math.max(1, S * 0.002));
    }
    c.restore();
  };
});

const RECURRENCE = endingFilm('end_recurrence', 'Recurrence', 'endurance', ['You outlasted every source, every bound atom, every clock.', 'Given enough time, any state comes around again.'], (w, h, S) => (c, b) => {
  // the same circle drawn again and again, never quite in the same line
  for (let i = 0; i < 6; i++) {
    const p = ss(i * 1.6, i * 1.6 + 1.5, b);
    if (p <= 0) break;
    ink(c, circlePath(w * 0.5, h * 0.46, S * 0.2 + i * S * 0.004, 160, 160 + i), p, { width: S * 0.002, color: i % 2 ? INK : '#9fd8c8', seed: 160 + i, alpha: 0.5 + 0.08 * i });
  }
});

const SILENCE = endingFilm('end_silence', 'Silence', 'defeat', ['The last of you went quiet.', 'The light of your worlds kept travelling outward for a while after there was no one left to send it.'], (w, h, S, k) => {
  const lights = starField(w, h, S, Math.round(40 * k + 12), 170, 1, 0.5, 9.5);
  return (c, b) => {
    for (const l of lights) {
      const on = 1 - ss(l.out, l.out + 0.4, b);
      if (on > 0) glow(c, l.x, l.y, l.r * 3, '#ffcf8a', 0.45 * on);
    }
    // what was sent still travels: a ring going out after the last of them
    const r = S * 0.1 * Math.max(0, b - 5);
    if (b > 5) ink(c, circlePath(w * 0.5, h * 0.46, r, 160, 171), 1, { width: S * 0.0014, color: INK, seed: 171, alpha: 0.35 * (1 - ss(8, 11, b)) });
  };
});

const FADE = endingFilm('end_fade', 'The Fade', 'defeat', ['Every cycle in the dark cost a little of who you were.', 'At the end, the pattern was too thin to hold.'], (w, h, S, k) => {
  const pattern = new Stipple(180, Math.round(1600 * k + 300), (r) => (Math.sin(r * 18) > 0 ? 0.9 : 0.15));
  return (c, b, t) => {
    const thin = ss(1, 10.5, b);
    pattern.draw(c, w * 0.5, h * 0.46, S * 0.24 * (1 + thin * 0.6), { color: INK, dot: S * 0.002 * (1 + thin), gone: thin, t, alpha: 0.75 - 0.4 * thin });
  };
});

const WILL_FAILS = endingFilm('end_will_fails', 'The Will Fails', 'defeat', ['You did not run out of energy. You ran out of reasons.', 'The reserve sat full and unused in the dark.'], (w, h, S) => {
  const threads = Array.from({ length: 5 }, (_, j) => Array.from({ length: 60 }, (_, i) => [w * (0.1 + 0.8 * (i / 59)), h * (0.3 + j * 0.07) + Math.sin(i * 0.3 + j) * S * 0.006] as Pt));
  return (c, b) => {
    // one by one the Threads stop
    threads.forEach((p, j) => ink(c, p, Math.min(ss(0.2, 9, b), 0.25 + j * 0.13), { width: S * 0.002, color: INK, seed: 190 + j, alpha: 0.7 }));
    // and the reserve, full
    const [x, y, bw, bh] = [w * 0.3, h * 0.68, w * 0.4, S * 0.03];
    ink(c, [[x, y], [x + bw, y], [x + bw, y + bh], [x, y + bh], [x, y]], ss(5.6, 7, b), { width: S * 0.0016, color: '#9aa3b0', seed: 195, alpha: 0.8 });
    c.fillStyle = rgba('#9aa3b0', 0.22 * ss(6.5, 7.5, b));
    c.fillRect(x, y, bw, bh);
  };
});

export const FILMS: Record<FilmId, FilmDef> = {
  dusk: DUSK,
  last_light: LAST_LIGHT,
  great_decay: blackHoleAge('great_decay', 'The Great Decay'),
  last_warmth: blackHoleAge('last_warmth', 'The Last Warmth'),
  great_evaporation: GREAT_EVAPORATION,
  last_horizon: LAST_HORIZON,
  end_long_thought: LONG_THOUGHT,
  end_one_voice: ONE_VOICE,
  end_quiet_lattice: QUIET_LATTICE,
  end_aeon_seed: AEON_SEED,
  end_last_garden: LAST_GARDEN,
  end_hunger: HUNGER,
  end_recurrence: RECURRENCE,
  end_silence: SILENCE,
  end_fade: FADE,
  end_will_fails: WILL_FAILS,
};

/** The film of a crossing, by its name (CrossingReport.title) and the age it goes to, or null for one with none. */
export function crossingFilm(title: string | undefined, to: string): FilmId | null {
  if (title === 'The Great Decay') return 'great_decay';
  if (title === 'The Last Warmth') return 'last_warmth';
  if (title === 'The Great Evaporation') return 'great_evaporation';
  if (title === 'The Last Light' || to === 'degenerate') return 'last_light';
  if (title === 'The Last Horizon' || to === 'dark') return 'last_horizon';
  return null;
}

/** The film of an ending, by its name, or null for one with none. */
export function endingFilmFor(ending: string): FilmId | null {
  const by: Record<string, FilmId> = {
    'The Long Thought': 'end_long_thought',
    'One Voice': 'end_one_voice',
    'The Quiet Lattice': 'end_quiet_lattice',
    'The Aeon Seed': 'end_aeon_seed',
    'The Last Garden': 'end_last_garden',
    'The Hunger': 'end_hunger',
    Recurrence: 'end_recurrence',
    Silence: 'end_silence',
    'The Fade': 'end_fade',
    'The Will Fails': 'end_will_fails',
  };
  return by[ending] ?? null;
}
