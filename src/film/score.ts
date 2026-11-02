import type { FilmId } from './films';

// The films' music, composed (1 Nov, the player: "please improve the music in the vids and dont
// use the same melody for every vid"; asked, "Rewrite the synth"). Each film has a score of its
// own: a key and a mode, a chord for each scene falling on the film's cuts, a melody of its own
// stated and varied over the scenes, an arpeggio, a bass line, its instruments and how loud each
// scene is. A score is composed here into plain events (this file has no sound in it, so a check
// can read every film's music), and `cue.ts` plays them, in step with the film's beat grid. Until
// 1 Nov every film had one pattern: a drone, a bell on each cut stepping down nearly the same
// notes, a pad, the reel's tick. With them (the player: "add a bit of Terminator 1 synth
// soundtrack energy to the cutscene music, not a full style overwhelm, just a bit"): an analog
// sequencer's pulsing bass, a metallic clank struck in an uneven pulse (groups of 3, 3, 3, 2, 2
// sixteenths and the like), and a detuned lead that glides, in the darker films above all and a
// touch in the others; the melodies are the game's own.

/** What plays an event (cue.ts makes each). */
export type Voice =
  // pads: a chord held under a scene
  | 'pad' // warm: detuned saws through an opening low-pass
  | 'dark' // a low, closed saw and a sine
  | 'glass' // sines and triangles
  | 'choir' // saws through two vowel formants, with vibrato
  // lines: one note at a time
  | 'flute'
  | 'horn'
  | 'lead' // glassy, bell-like
  | 'voice' // one voice of the choir
  | 'harp' // a plucked note, for arpeggios
  | 'bass'
  | 'synth' // an analog lead: detuned saw and square, gliding from note to note
  | 'seq' // an analog sequencer's note: a saw through a resonant filter snapping shut
  | 'bell' // a struck bell, the accent on a cut
  | 'drone' // the root and its fifth, very low, held
  // percussion and effects
  | 'kick'
  | 'snare' // an 80s gated snare: a crack of noise, its room held a moment and then shut
  | 'tom'
  | 'shaker'
  | 'metal' // a metallic clank (two FM pairs), struck in an uneven pulse
  | 'chirp'
  | 'thump'
  | 'boom'
  | 'swell'
  | 'tick'; // the reel's, on each bar

/** One event of a film's music: when (beats), what, which pitches (Hz), how long (beats), how loud (0..1). */
export interface ScoreEvent {
  b: number;
  v: Voice;
  hz: number[];
  len: number;
  amp: number;
  /** (chirp) the pitch it rises to */
  to?: number;
  /** (synth) the pitch it glides from: the note before it, if it follows straight on */
  from?: number;
  /** a melody note (for the checks) */
  melody?: boolean;
  /** the accent on a cut (for the checks) */
  cut?: boolean;
}

/**
 * Oscillators each voice makes, at full quality and below it (pads and the choir: for
 * each note of the chord, and the choir one more for its vibrato). The checks count from these how
 * many sound at once; cue.ts makes exactly these.
 */
export const OSCILLATORS: Record<Voice, [number, number]> = {
  pad: [2, 1],
  dark: [2, 1],
  glass: [2, 1],
  choir: [1, 1],
  flute: [3, 2],
  horn: [2, 2],
  lead: [3, 2],
  voice: [2, 2],
  harp: [2, 1],
  bass: [2, 1],
  synth: [3, 2],
  seq: [2, 1],
  bell: [4, 3],
  drone: [2, 2],
  kick: [1, 1],
  snare: [1, 1],
  tom: [1, 1],
  shaker: [0, 0],
  metal: [4, 2],
  chirp: [1, 1],
  thump: [1, 1],
  boom: [1, 1],
  swell: [0, 0],
  tick: [0, 0],
};
export const PER_NOTE: ReadonlySet<Voice> = new Set<Voice>(['pad', 'dark', 'glass', 'choir']);

/** How long (seconds) each voice rings on after its note's length. */
export const TAIL: Record<Voice, number> = {
  pad: 2.6,
  dark: 3,
  glass: 3,
  choir: 2.4,
  flute: 0.35,
  horn: 0.6,
  lead: 1.1,
  voice: 0.5,
  harp: 1.3,
  bass: 0.7,
  synth: 0.5,
  seq: 0.15,
  bell: 2.6,
  drone: 3,
  kick: 0.4,
  snare: 0.3,
  tom: 0.5,
  shaker: 0.1,
  metal: 0.6,
  chirp: 0.12,
  thump: 0.4,
  boom: 3.7,
  swell: 0.7,
  tick: 0.05,
};

/** Oscillators an event makes at a quality. */
export function oscillatorsOf(e: Pick<ScoreEvent, 'v' | 'hz'>, low = false): number {
  const n = OSCILLATORS[e.v][low ? 1 : 0];
  return PER_NOTE.has(e.v) ? n * e.hz.length + (e.v === 'choir' ? 1 : 0) : n;
}

/** The most oscillators sounding at once in a film's music (the checks: a phone's load). */
export function mostAtOnce(events: ScoreEvent[], bpm: number, low = false): number {
  const beat = 60 / bpm;
  const marks: [number, number][] = [];
  for (const e of events) {
    const n = oscillatorsOf(e, low);
    if (!n) continue;
    marks.push([e.b * beat, n], [(e.b + e.len) * beat + TAIL[e.v], -n]);
  }
  marks.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let now = 0;
  let most = 0;
  for (const [, d] of marks) most = Math.max(most, (now += d));
  return most;
}

// ------------------------------------------------------------ the theory

/** The modes, as semitones above the tonic. */
export const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  wholetone: [0, 2, 4, 6, 8, 10],
} as const;
export type Mode = keyof typeof MODES;

/** Semitones above the tonic of a degree of a mode (0 the tonic; past the top, the next octave up; below 0, down). */
export function semis(mode: Mode, degree: number, alt = 0): number {
  const s = MODES[mode];
  const n = s.length;
  const oct = Math.floor(degree / n);
  return s[((degree % n) + n) % n] + 12 * oct + alt;
}

const hzOf = (tonic: number, st: number) => tonic * Math.pow(2, st / 12);

/** A motif's note: beats from its start, the degree, its length (beats), and a chromatic step off the mode. */
export type MotifNote = [number, number, number, number?];

/** Where the melody is stated: at a beat, its degrees shifted (a sequence), an octave moved, its last notes dropped, played by another voice. */
export interface Statement {
  at: number;
  shift?: number;
  octave?: number;
  /** leave out its last n notes (a motif that loses its notes; one that stops mid-phrase) */
  drop?: number;
  voice?: Voice;
  /** how loud (default 1) */
  amp?: number;
  /** the third of the mode raised (a minor melody turned major) */
  major?: boolean;
  /** a second motif of the film, in place of its first */
  alt?: boolean;
}

/** An arpeggio: from a beat to a beat, a note every `step` beats, through the scene's chord (0 root, 1 third, 2 fifth, 3 the root an octave up…). */
export interface Arp {
  from: number;
  to: number;
  step: number;
  pattern: number[];
  voice?: Voice;
  /** octaves above the chord's register (default 1) */
  octave?: number;
  amp?: number;
}

/** A film's score, before it is composed. */
export interface Score {
  bpm: number;
  beats: number;
  titleAt: number;
  /** the key: the tonic (Hz, near the melody's register) and the mode */
  tonic: number;
  mode: Mode;
  /** the film's cuts (beats), each starting a scene, and the chord under each (a degree of the mode) */
  cuts: number[];
  chords: number[];
  /** the chord under the title: its degree, and its colour (a triad of the mode, major, minor, a bare fifth, or an added ninth) */
  title: { degree: number; colour?: 'mode' | 'major' | 'minor' | 'fifth' | 'add9' };
  /** the film's melody, a second one if it has one, and where each is stated */
  motif: MotifNote[];
  motif2?: MotifNote[];
  melody: Statement[];
  /** the melody's usual voice, and the pad's (a list: from a beat, which pad) */
  lead: Voice;
  pads: [number, Voice][];
  arps?: Arp[];
  bass?: boolean;
  drone?: boolean;
  /** the accent on each cut: a bell (default), or the harp */
  accent?: 'bell' | 'harp';
  /**
   * a pulse: a voice on a grid of `every` beats, between two beats; with `groups`, struck only at
   * the start of each group of steps (3, 3, 2…: an uneven pulse), the first of a cycle the hardest
   */
  pulse?: { v: 'kick' | 'snare' | 'tom' | 'shaker' | 'metal'; from: number; to: number; every: number; amp?: number; skip?: number[]; groups?: number[] }[];
  /** how loud each scene is (0..1; default 0.7) */
  dyn?: number[];
  /** the Supernova's and the Last Horizon's own sounds */
  chirp?: [number, number, number, number];
  thumps?: number[];
  boom?: { at: number; swell: number };
}

/** The scene a beat falls in. */
function sceneAt(s: Score, b: number): number {
  let i = 0;
  for (let k = 0; k < s.cuts.length; k++) if (b >= s.cuts[k]) i = k;
  return i;
}

/** A triad on a degree of the mode, as semitones above the tonic (root, third, fifth, root an octave up, third up…). */
function triad(s: Score, degree: number, n = 6): number[] {
  return Array.from({ length: n }, (_, i) => semis(s.mode, degree + (i % 3) * 2) + 12 * Math.floor(i / 3));
}

/** The title's chord, as semitones above the tonic. */
function titleChord(s: Score): number[] {
  const r = semis(s.mode, s.title.degree);
  switch (s.title.colour ?? 'mode') {
    case 'major':
      return [r, r + 4, r + 7];
    case 'minor':
      return [r, r + 3, r + 7];
    case 'fifth':
      return [r, r + 7, r + 12];
    case 'add9':
      return [...triad(s, s.title.degree, 3), r + 14];
    default:
      return triad(s, s.title.degree, 3);
  }
}

/** A note of the melody: its beat, semitones above the tonic, its length (beats), the statement it is in, and whether it steps off the mode (a chromatic step, or a third raised). */
export interface MelodyNote {
  b: number;
  st: number;
  len: number;
  of: Statement;
  off: boolean;
}

/** The melody's notes, as composed from its statements (an octave above the tonic). */
export function melodyNotes(s: Score): MelodyNote[] {
  const out: MelodyNote[] = [];
  const n = MODES[s.mode].length;
  for (const of of s.melody) {
    const m = of.alt && s.motif2 ? s.motif2 : s.motif;
    const keep = m.slice(0, Math.max(0, m.length - (of.drop ?? 0)));
    for (const [o, d, len, alt] of keep) {
      const deg = d + (of.shift ?? 0);
      let st = semis(s.mode, deg, alt ?? 0) + 12 * (1 + (of.octave ?? 0));
      // (a minor melody stated in the major: its thirds raised)
      const raise = !!of.major && (((deg % n) + n) % n) === 2 && MODES[s.mode][2] === 3;
      if (raise) st += 1;
      out.push({ b: of.at + o, st, len, of, off: raise || !!alt });
    }
  }
  return out;
}

/** Compose a score into its events, sorted by beat. */
export function compose(s: Score): ScoreEvent[] {
  const ev: ScoreEvent[] = [];
  const add = (e: ScoreEvent) => ev.push(e);
  const T = s.tonic;
  const end = s.titleAt;
  const sceneEnd = (i: number) => s.cuts[i + 1] ?? end;
  const dyn = (i: number) => s.dyn?.[i] ?? 0.7;
  const padAt = (b: number) => {
    let v: Voice = s.pads[0]?.[1] ?? 'pad';
    for (const [from, p] of s.pads) if (b >= from) v = p;
    return v;
  };
  // the drone, under it all until the title
  if (s.drone) add({ b: 0, v: 'drone', hz: [hzOf(T, -24), hzOf(T, -17)], len: end, amp: 0.55 });
  s.cuts.forEach((c, i) => {
    const len = sceneEnd(i) - c;
    const chord = triad(s, s.chords[i], 3);
    const d = dyn(i);
    // the scene's chord, in the tonic's octave, below the melody
    add({ b: c, v: padAt(c), hz: chord.map((x) => hzOf(T, x)), len, amp: 0.55 * d });
    // the bass: the chord's root an octave down, struck on the cut and again on each bar after it
    if (s.bass) {
      const root = hzOf(T, semis(s.mode, s.chords[i]) - 12);
      for (let b = c; b < c + len - 0.5; b = Math.floor(b / 4) * 4 + 4) add({ b, v: 'bass', hz: [root], len: Math.min(Math.floor(b / 4) * 4 + 4, c + len) - b, amp: (b === c ? 0.75 : 0.55) * d });
    }
    // the accent on the cut: a tone of its chord, an octave above it
    const top = semis(s.mode, s.chords[i] + (i % 2 ? 4 : 2)) + 12;
    add({ b: c, v: s.accent ?? 'bell', hz: [hzOf(T, top)], len: 2, amp: 0.6 + 0.3 * d, cut: true });
  });
  // the reel's tick on each bar, until the title
  for (let b = 0; b < end; b += 4) add({ b, v: 'tick', hz: [0], len: 0.1, amp: 1 });
  // the melody (an analog lead glides into a note that follows straight on from the one before)
  let prev: MelodyNote | null = null;
  for (const m of melodyNotes(s)) {
    if (m.b >= end + 4) continue;
    const v = m.of.voice ?? s.lead;
    const glide = v === 'synth' && prev && prev.of === m.of && Math.abs(prev.b + prev.len - m.b) < 0.01 ? hzOf(T, prev.st) : undefined;
    add({ b: m.b, v, hz: [hzOf(T, m.st)], len: m.len, amp: (m.of.amp ?? 1) * (0.6 + 0.4 * dyn(sceneAt(s, m.b))), melody: true, ...(glide ? { from: glide } : {}) });
    prev = m;
  }
  // arpeggios through each scene's chord
  for (const a of s.arps ?? []) {
    let k = 0;
    for (let b = a.from; b < a.to - 1e-6; b += a.step, k++) {
      const i = sceneAt(s, b);
      const chord = triad(s, s.chords[i], 6);
      const st = chord[a.pattern[k % a.pattern.length] % chord.length] + 12 * ((a.octave ?? 1) - 1);
      add({ b: Math.round(b * 1000) / 1000, v: a.voice ?? 'harp', hz: [hzOf(T, st)], len: Math.max(0.5, a.step * 2), amp: (a.amp ?? 0.7) * (0.5 + 0.5 * dyn(i)) });
    }
  }
  // a pulse
  for (const p of s.pulse ?? []) {
    // where in a cycle of groups each step falls: 1 the cycle's first, 0.75 another group's, 0 between
    const starts: number[] = [];
    if (p.groups) p.groups.reduce((at, g) => (starts.push(at), at + g), 0);
    const cycle = p.groups?.reduce((a, g) => a + g, 0) ?? 1;
    for (let b = p.from, k = 0; b < p.to - 1e-6; b += p.every, k++) {
      if (p.skip?.includes(k)) continue;
      const accent = !p.groups ? 1 : k % cycle === 0 ? 1 : starts.includes(k % cycle) ? 0.7 : 0;
      if (!accent) continue;
      const hz = p.v === 'tom' ? hzOf(T, -12) : p.v === 'metal' ? hzOf(T, 12) : 0;
      add({ b: Math.round(b * 1000) / 1000, v: p.v, hz: [hz], len: 0.5, amp: accent * (p.amp ?? 0.6) * (0.5 + 0.5 * dyn(sceneAt(s, b))) });
    }
  }
  // the Supernova's and the Last Horizon's own sounds
  if (s.chirp) {
    const [b0, b1, hz0, hz1] = s.chirp;
    add({ b: b0, v: 'chirp', hz: [hz0], to: hz1, len: b1 - b0, amp: 1 });
  }
  for (const b of s.thumps ?? []) add({ b, v: 'thump', hz: [70], len: 0.5, amp: 1 });
  if (s.boom) {
    add({ b: s.boom.at - s.boom.swell, v: 'swell', hz: [0], len: s.boom.swell, amp: 1 });
    add({ b: s.boom.at, v: 'boom', hz: [96], len: 4, amp: 1 });
  }
  // into the title: a breath, then its chord held to the end, and its bell
  add({ b: end - 3, v: 'swell', hz: [0], len: 3, amp: 0.5 });
  const tc = titleChord(s);
  add({ b: end, v: padAt(end), hz: tc.map((x) => hzOf(T, x)), len: s.beats - end, amp: 0.7 });
  if (s.bass) add({ b: end, v: 'bass', hz: [hzOf(T, tc[0] - 12)], len: s.beats - end, amp: 0.75 });
  add({ b: end, v: 'bell', hz: [hzOf(T, tc[0] + 12)], len: 3, amp: 0.8, cut: true });
  return ev.sort((a, b) => a.b - b.b);
}

// ------------------------------------------------------------ the films' scores

/** An ending's frame: 36 beats at 84, the title at 31. */
const END = { bpm: 84, beats: 36, titleAt: 31 } as const;

const NOTE = {
  C3: 130.81,
  Db3: 138.59,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  Fs3: 185,
  G3: 196,
  A3: 220,
  Bb2: 116.54,
  B2: 123.47,
} as const;

export const SCORES: Record<FilmId, Score> = {
  // The Twilight Interregnum: wistful synthwave (2 Nov, the player: the Interregnum's and the Dusk's
  // music sounded "too unsynthwave, happy etc more like for a fantasy game"; asked, "Interregnum
  // wistful, Dusk dark", light drums for the Interregnum only). D Aeolian, the minor's i–VI–III–VII,
  // an analog lead gliding through a melody of long notes and an octave's leap, a sequencer's
  // sixteenths over a pulsing bass, a kick and a gated snare once the new stars are forming; a
  // minor ninth under the title. No clank: the warm one.
  interregnum: {
    bpm: 90,
    beats: 76,
    titleAt: 70,
    tonic: NOTE.D3,
    mode: 'aeolian',
    cuts: [0, 5.5, 10.5, 17, 23, 30.5, 37, 43.5, 49, 57, 63.5],
    chords: [0, 5, 2, 6, 0, 5, 3, 6, 0, 5, 6],
    title: { degree: 0, colour: 'add9' },
    motif: [[0, 0, 1], [1, 4, 1], [2, 7, 2.5], [4.5, 6, 0.5], [5, 4, 1], [6, 5, 2]],
    motif2: [[0, 2, 1.5], [1.5, 4, 0.5], [2, 5, 2], [4, 4, 1], [5, 3, 1], [6, 2, 2]],
    melody: [{ at: 2 }, { at: 11.5, octave: 1, voice: 'lead', amp: 0.7 }, { at: 24, alt: true, amp: 0.85 }, { at: 31.5, shift: -2, amp: 0.85 }, { at: 38 }, { at: 50, alt: true }, { at: 58 }, { at: 64.5, shift: 2, drop: 2 }],
    lead: 'synth',
    pads: [[0, 'pad'], [23, 'dark'], [37, 'pad']],
    arps: [
      { from: 5.5, to: 23, step: 0.25, pattern: [0, 2, 3, 4, 3, 2, 4, 1], voice: 'seq', octave: 2, amp: 0.3 },
      { from: 23, to: 37, step: 0.5, pattern: [0, 2, 4, 2], voice: 'seq', octave: 2, amp: 0.26 },
      { from: 37, to: 70, step: 0.25, pattern: [0, 2, 3, 4, 3, 2, 4, 1], voice: 'seq', octave: 2, amp: 0.34 },
      { from: 10.5, to: 70, step: 0.5, pattern: [0, 0, 0, 0, 0, 0, 3, 0], voice: 'seq', octave: 0, amp: 0.38 },
    ],
    pulse: [
      { v: 'kick', from: 36, to: 57, every: 2, amp: 0.55 },
      { v: 'snare', from: 37, to: 57, every: 2, amp: 0.5 },
      { v: 'shaker', from: 44, to: 57, every: 0.5, amp: 0.22 },
    ],
    bass: true,
    dyn: [0.45, 0.5, 0.6, 0.6, 0.55, 0.5, 0.65, 0.7, 0.75, 0.85, 0.8],
  },
  // The Long Dusk: dark synthwave (2 Nov, the player, as above: "Dusk dark"). E Aeolian, slow dark
  // chords (i, VI, iv, v, VII), a brassy analog lead swelling and gliding through long notes (a
  // minor sixth's leap and a fall), the choir's voice once, a drone, a quiet sequencer pulse an
  // octave down and a slow arpeggio over it; no drums
  dusk: {
    bpm: 90,
    beats: 72,
    titleAt: 66,
    tonic: NOTE.E3,
    mode: 'aeolian',
    cuts: [0, 6, 10.5, 17, 23, 36, 41, 45.5, 49.5, 55.5, 60.5],
    chords: [0, 5, 3, 4, 0, 5, 3, 6, 5, 4, 0],
    title: { degree: 0, colour: 'minor' },
    motif: [[0, 0, 3], [3, 4, 1], [4, 5, 3], [7, 4, 1], [8, 3, 4]],
    melody: [{ at: 3 }, { at: 18, voice: 'voice', amp: 0.8 }, { at: 37 }, { at: 49.5, shift: -2, drop: 1 }, { at: 61, drop: 2 }],
    lead: 'synth',
    pads: [[0, 'dark'], [23, 'pad'], [45.5, 'choir']],
    arps: [
      { from: 23, to: 60.5, step: 0.5, pattern: [0, 0, 0, 0, 0, 0, 0, 0], voice: 'seq', octave: 0, amp: 0.32 },
      { from: 36, to: 49.5, step: 1, pattern: [0, 2, 4, 2], voice: 'seq', octave: 2, amp: 0.22 },
    ],
    bass: true,
    drone: true,
    dyn: [0.5, 0.55, 0.6, 0.6, 0.65, 0.7, 0.7, 0.65, 0.7, 0.75, 0.65],
  },
  // The Last Light: C♯ Phrygian, a slow chromatic fall in the choir, the title on a bare fifth
  last_light: {
    bpm: 90,
    beats: 70,
    titleAt: 64,
    tonic: NOTE.Db3,
    mode: 'phrygian',
    cuts: [0, 6.5, 12, 18.3, 30, 37.5, 44.5, 51.5, 58.5],
    chords: [0, 1, 0, 6, 5, 1, 3, 1, 0],
    title: { degree: 0, colour: 'fifth' },
    motif: [[0, 4, 2], [2, 4, 2, -1], [4, 3, 2], [6, 3, 2, -1], [8, 2, 4]],
    melody: [{ at: 2 }, { at: 19, octave: 1, voice: 'lead', amp: 0.7 }, { at: 38 }, { at: 52, shift: -1, voice: 'horn' }],
    lead: 'voice',
    pads: [[0, 'dark'], [30, 'choir']],
    arps: [{ from: 30, to: 51.5, step: 0.5, pattern: [0, 0, 1, 0, 0, 2, 0, 1], voice: 'seq', octave: 0, amp: 0.45 }],
    pulse: [{ v: 'metal', from: 30, to: 51.5, every: 0.5, groups: [3, 3, 3, 2, 2], amp: 0.4 }],
    bass: true,
    drone: true,
    dyn: [0.5, 0.55, 0.6, 0.65, 0.7, 0.6, 0.55, 0.5, 0.45],
  },
  // The Supernova: D harmonic minor, an ostinato that tightens with the chirp, the heartbeat and the
  // boom, then the melody in the major as its light floods out
  supernova: {
    bpm: 90,
    beats: 60,
    titleAt: 54,
    tonic: NOTE.D3,
    mode: 'harmonic',
    cuts: [0, 8.5, 16.5, 25.5, 32.5, 42.5, 48.5],
    chords: [0, 5, 4, 0, 5, 3, 4],
    title: { degree: 0, colour: 'major' },
    motif: [[0, 0, 0.5], [0.5, 2, 0.5], [1, 4, 0.5], [1.5, 7, 1], [3, 6, 0.5], [3.5, 7, 1.5]],
    motif2: [[0, 4, 2], [2, 7, 2], [4, 9, 1], [5, 7, 3]],
    melody: [{ at: 1, voice: 'lead', amp: 0.7 }, { at: 9, shift: -2, voice: 'lead', amp: 0.75 }, { at: 27, alt: true, major: true }, { at: 34, alt: true, shift: 2, major: true }, { at: 43.5, major: true, voice: 'lead' }],
    lead: 'flute',
    pads: [[0, 'dark'], [25.5, 'pad']],
    arps: [
      { from: 0, to: 8.5, step: 0.5, pattern: [0, 1, 2, 1], voice: 'harp', octave: 1, amp: 0.55 },
      { from: 8.5, to: 16.5, step: 0.5, pattern: [0, 0, 2, 0, 3, 0, 2, 1], voice: 'seq', octave: 0, amp: 0.5 },
      { from: 16.5, to: 25.5, step: 0.25, pattern: [0, 1, 2, 3], voice: 'seq', octave: 1, amp: 0.5 },
      { from: 32.5, to: 54, step: 1, pattern: [0, 2, 4, 2], voice: 'harp', octave: 2, amp: 0.45 },
    ],
    bass: true,
    pulse: [{ v: 'metal', from: 8.5, to: 25.5, every: 0.25, groups: [3, 3, 2, 3, 2], amp: 0.45 }],
    dyn: [0.5, 0.6, 0.75, 0.9, 0.75, 0.7, 0.65],
    chirp: [0.5, 15.5, 48, 330],
    thumps: [17.5, 19.5, 21, 22.2, 23.1, 23.8, 24.35, 24.8, 25.15],
    boom: { at: 25.5, swell: 3 },
  },
  // The Great Decay: B♭ Aeolian, a low choir, a melody that loses a note at each statement
  great_decay: {
    bpm: 90,
    beats: 74,
    titleAt: 68,
    tonic: NOTE.Bb2,
    mode: 'aeolian',
    cuts: [0, 8, 15.5, 22.5, 30.5, 38.5, 46.5, 55.5],
    chords: [0, 5, 6, 2, 3, 0, 5, 3],
    title: { degree: 0, colour: 'fifth' },
    motif: [[0, 0, 1], [1, 4, 1], [2, 3, 1], [3, 2, 1], [4, 1, 1], [5, 2, 1], [6, 0, 2]],
    melody: [{ at: 1 }, { at: 16, drop: 1 }, { at: 31, drop: 2, voice: 'horn' }, { at: 47, drop: 4 }, { at: 56.5, drop: 5, voice: 'lead', amp: 0.6 }],
    lead: 'voice',
    pads: [[0, 'dark'], [22.5, 'choir']],
    arps: [{ from: 22.5, to: 46.5, step: 0.5, pattern: [0, 0, 2, 0, 1, 0, 2, 3], voice: 'seq', octave: 0, amp: 0.4 }],
    pulse: [{ v: 'metal', from: 30.5, to: 46.5, every: 0.5, groups: [3, 3, 3, 2, 2], amp: 0.35 }],
    bass: true,
    drone: true,
    dyn: [0.6, 0.65, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45],
  },
  // The Last Warmth: F♯ Dorian, glass, a melody that cools, an arpeggio slowing
  last_warmth: {
    bpm: 90,
    beats: 74,
    titleAt: 68,
    tonic: NOTE.Fs3,
    mode: 'dorian',
    cuts: [0, 7.5, 15, 22, 30, 38, 46, 54, 61],
    chords: [0, 3, 6, 2, 0, 4, 6, 3, 0],
    title: { degree: 0, colour: 'minor' },
    motif: [[0, 4, 1], [1, 2, 1], [2, 1, 2], [4, 2, 1], [5, 0, 3]],
    melody: [{ at: 1 }, { at: 16, shift: -1, voice: 'synth', amp: 0.8 }, { at: 31, voice: 'flute' }, { at: 47, shift: -2, drop: 1 }, { at: 62, drop: 2, amp: 0.7 }],
    lead: 'lead',
    pads: [[0, 'glass']],
    arps: [
      { from: 0, to: 22, step: 0.5, pattern: [0, 2, 4, 2], voice: 'harp', octave: 2, amp: 0.45 },
      { from: 22, to: 46, step: 1, pattern: [0, 2, 4, 2], voice: 'harp', octave: 2, amp: 0.4 },
      { from: 46, to: 66, step: 2, pattern: [0, 2, 4], voice: 'harp', octave: 2, amp: 0.35 },
    ],
    bass: true,
    drone: true,
    dyn: [0.65, 0.65, 0.6, 0.6, 0.55, 0.55, 0.5, 0.45, 0.4],
  },
  // The Great Evaporation: whole tones, arpeggios rising and thinning away, the title unresolved
  great_evaporation: {
    bpm: 90,
    beats: 48,
    titleAt: 42,
    tonic: NOTE.C3,
    mode: 'wholetone',
    cuts: [0, 8.5, 16.5, 25.5, 33.5],
    chords: [0, 1, 2, 4, 3],
    title: { degree: 0 },
    motif: [[0, 0, 0.5], [0.5, 1, 0.5], [1, 2, 0.5], [1.5, 3, 0.5], [2, 4, 1], [3, 7, 2]],
    melody: [{ at: 2 }, { at: 10, shift: 1, drop: 1 }, { at: 18, shift: 2, drop: 2, voice: 'voice' }, { at: 27, shift: 3, drop: 3 }, { at: 35, shift: 4, drop: 4, amp: 0.6 }],
    lead: 'lead',
    pads: [[0, 'glass']],
    arps: [
      { from: 0, to: 33.5, step: 0.5, pattern: [0, 1, 2, 3, 4, 5], voice: 'harp', octave: 2, amp: 0.5 },
      { from: 0, to: 25.5, step: 0.5, pattern: [0, 0, 1, 0, 2, 0, 1, 0], voice: 'seq', octave: 0, amp: 0.35 },
      { from: 33.5, to: 41, step: 1, pattern: [0, 2, 4], voice: 'harp', octave: 3, amp: 0.35 },
    ],
    bass: true,
    dyn: [0.65, 0.65, 0.6, 0.5, 0.4],
  },
  // The Last Horizon: B minor, a deep drone, a slow three-note figure, the heartbeat and the boom
  last_horizon: {
    bpm: 90,
    beats: 82,
    titleAt: 76,
    tonic: NOTE.B2,
    mode: 'aeolian',
    cuts: [0, 7, 14, 22, 29.5, 37.5, 47.5, 57, 66.5],
    chords: [0, 5, 3, 0, 6, 5, 3, 4, 0],
    title: { degree: 0, colour: 'fifth' },
    motif: [[0, 0, 3], [3, 2, 2], [5, 1, 4]],
    melody: [{ at: 1 }, { at: 23, shift: 2, voice: 'voice' }, { at: 38, voice: 'synth', amp: 0.8 }, { at: 48, shift: -1, voice: 'lead', amp: 0.6 }, { at: 58 }, { at: 67.5, shift: -2 }],
    lead: 'horn',
    pads: [[0, 'dark'], [22, 'choir']],
    arps: [{ from: 22, to: 47.5, step: 0.5, pattern: [0, 0, 2, 0, 0, 1, 0, 2], voice: 'seq', octave: 0, amp: 0.4 }],
    pulse: [{ v: 'metal', from: 29.5, to: 47.5, every: 0.5, groups: [3, 3, 2, 2, 3], amp: 0.35 }],
    bass: true,
    drone: true,
    dyn: [0.55, 0.6, 0.75, 0.6, 0.55, 0.5, 0.5, 0.45, 0.45],
    thumps: [14.6, 16, 17.1, 18, 18.7, 19.2, 19.6],
    boom: { at: 19.95, swell: 2.5 },
  },
  // ---- the endings (36 beats at 84, the title at 31), each with its own melody
  end_long_thought: {
    ...END,
    tonic: NOTE.F3,
    mode: 'lydian',
    cuts: [0, 14.5, 22.5],
    chords: [0, 1, 4],
    title: { degree: 0, colour: 'add9' },
    motif: [[0, 0, 2], [2, 3, 2], [4, 4, 2], [6, 6, 3]],
    melody: [{ at: 2 }, { at: 15.5, shift: 1, voice: 'synth', amp: 0.8 }, { at: 23.5, octave: 1, voice: 'flute' }],
    lead: 'lead',
    pads: [[0, 'glass']],
    arps: [{ from: 0, to: 31, step: 1, pattern: [0, 1, 2, 3, 4, 3, 2, 1], voice: 'harp', octave: 1, amp: 0.5 }],
    bass: true,
    dyn: [0.55, 0.65, 0.75],
  },
  end_one_voice: {
    ...END,
    tonic: NOTE.A3,
    mode: 'ionian',
    cuts: [0, 8.5, 16, 23.5],
    chords: [0, 5, 3, 4],
    title: { degree: 0, colour: 'major' },
    motif: [[0, 4, 1], [1, 5, 1], [2, 4, 1], [3, 2, 1], [4, 0, 2]],
    melody: [{ at: 1.5 }, { at: 9.5, shift: 1 }, { at: 17, shift: 2, amp: 0.8 }, { at: 24.5, voice: 'voice' }],
    lead: 'voice',
    pads: [[0, 'pad'], [16, 'choir']],
    bass: true,
    dyn: [0.5, 0.6, 0.7, 0.8],
  },
  end_quiet_lattice: {
    ...END,
    tonic: NOTE.G3,
    mode: 'mixolydian',
    cuts: [0, 7, 19.5],
    chords: [0, 6, 3],
    title: { degree: 0, colour: 'mode' },
    motif: [[0, 0, 0.5], [0.5, 4, 0.5], [1, 2, 0.5], [1.5, 6, 1], [2.5, 4, 1.5]],
    melody: [{ at: 2 }, { at: 8, shift: -1 }, { at: 14 }, { at: 20.5, shift: 2 }, { at: 26 }],
    lead: 'lead',
    pads: [[0, 'glass']],
    arps: [{ from: 0, to: 31, step: 0.5, pattern: [0, 2, 1, 3, 2, 0], voice: 'harp', octave: 1, amp: 0.5 }],
    pulse: [{ v: 'shaker', from: 0, to: 31, every: 0.5, amp: 0.35 }],
    bass: true,
    dyn: [0.55, 0.6, 0.7],
  },
  end_aeon_seed: {
    ...END,
    tonic: NOTE.F3,
    mode: 'ionian',
    cuts: [0, 8, 16, 24],
    chords: [0, 3, 4, 5],
    title: { degree: 0, colour: 'add9' },
    motif: [[0, 0, 1], [1, 2, 1], [2, 4, 2]],
    melody: [{ at: 1 }, { at: 5, shift: 1 }, { at: 9, shift: 2 }, { at: 13, shift: 3 }, { at: 17, shift: 4 }, { at: 21, shift: 5 }, { at: 25, octave: 1 }],
    lead: 'flute',
    pads: [[0, 'pad']],
    arps: [
      { from: 8, to: 16, step: 0.5, pattern: [0, 1, 2, 3], voice: 'harp', octave: 1, amp: 0.45 },
      { from: 16, to: 31, step: 0.25, pattern: [0, 1, 2, 3, 4, 3, 2, 1], voice: 'seq', octave: 1, amp: 0.35 },
    ],
    bass: true,
    dyn: [0.5, 0.6, 0.7, 0.85],
  },
  end_last_garden: {
    ...END,
    tonic: NOTE.D3,
    mode: 'ionian',
    cuts: [0, 8, 16, 24],
    chords: [0, 4, 5, 3],
    title: { degree: 0, colour: 'major' },
    motif: [[0, 2, 1], [1, 4, 1], [2, 5, 1], [3, 4, 1], [4, 2, 1], [5, 0, 3]],
    melody: [{ at: 1 }, { at: 9 }, { at: 17, shift: 2 }, { at: 25, octave: 1, voice: 'lead', amp: 0.8 }],
    lead: 'flute',
    pads: [[0, 'pad']],
    arps: [{ from: 0, to: 31, step: 1, pattern: [0, 2, 3, 2], voice: 'harp', octave: 1, amp: 0.5 }],
    bass: true,
    dyn: [0.55, 0.6, 0.7, 0.75],
  },
  end_hunger: {
    ...END,
    tonic: NOTE.C3,
    mode: 'phrygian',
    cuts: [0, 7.5, 15.5],
    chords: [0, 1, 0],
    title: { degree: 0, colour: 'minor' },
    motif: [[0, 0, 1], [1, 1, 1], [2, 0, 2], [4, -2, 2]],
    melody: [{ at: 2 }, { at: 8.5 }, { at: 16.5, octave: 1 }, { at: 22.5, shift: 1 }, { at: 27 }],
    lead: 'horn',
    pads: [[0, 'dark']],
    arps: [{ from: 7.5, to: 31, step: 0.25, pattern: [0, 0, 0, 1, 0, 0, 2, 0], voice: 'seq', octave: 0, amp: 0.45 }],
    pulse: [{ v: 'metal', from: 0, to: 31, every: 0.25, groups: [3, 3, 3, 2, 2], amp: 0.5 }, { v: 'tom', from: 15.5, to: 31, every: 2, amp: 0.45 }],
    bass: true,
    drone: true,
    dyn: [0.45, 0.5, 0.6],
  },
  end_recurrence: {
    ...END,
    tonic: NOTE.G3,
    mode: 'dorian',
    cuts: [0, 8.5, 18.5],
    chords: [0, 3, 0],
    title: { degree: 0, colour: 'minor' },
    motif: [[0, 0, 1], [1, 2, 1], [2, 4, 1], [3, 3, 1], [4, 1, 1], [5, 0, 2]],
    melody: [{ at: 1 }, { at: 9.5, shift: 3 }, { at: 16, shift: 1, voice: 'lead', amp: 0.7 }, { at: 24 }],
    lead: 'flute',
    pads: [[0, 'pad'], [8.5, 'glass'], [18.5, 'pad']],
    arps: [
      { from: 0, to: 31, step: 1, pattern: [0, 1, 2, 1], voice: 'harp', octave: 1, amp: 0.45 },
      { from: 8.5, to: 18.5, step: 0.5, pattern: [0, 0, 2, 0, 1, 0, 2, 0], voice: 'seq', octave: 0, amp: 0.35 },
    ],
    bass: true,
    dyn: [0.55, 0.6, 0.55],
  },
  end_silence: {
    ...END,
    tonic: NOTE.A3,
    mode: 'aeolian',
    cuts: [0, 7.5, 15.5],
    chords: [0, 5, 3],
    title: { degree: 0, colour: 'minor' },
    motif: [[0, 2, 1], [1, 1, 1], [2, 2, 1], [3, 4, 1], [4, 0, 3]],
    melody: [{ at: 1.5 }, { at: 8.5, drop: 1 }, { at: 16.5, drop: 3 }, { at: 22, drop: 4, amp: 0.6 }],
    lead: 'lead',
    pads: [[0, 'glass']],
    bass: true,
    dyn: [0.55, 0.45, 0.35],
  },
  end_fade: {
    ...END,
    tonic: NOTE.A3,
    mode: 'aeolian',
    cuts: [0, 8.5, 16.5],
    chords: [0, 3, 5],
    title: { degree: 0, colour: 'fifth' },
    motif: [[0, 2, 2], [2, 1, 1], [3, 0, 1], [4, -2, 4]],
    melody: [{ at: 1 }, { at: 9.5, amp: 0.75 }, { at: 17.5, amp: 0.55 }, { at: 24.5, amp: 0.35, drop: 1 }],
    lead: 'flute',
    pads: [[0, 'pad'], [16.5, 'dark']],
    arps: [{ from: 0, to: 24, step: 1, pattern: [0, 2, 1], voice: 'harp', octave: 1, amp: 0.4 }],
    bass: true,
    dyn: [0.6, 0.45, 0.3],
  },
  end_will_fails: {
    ...END,
    tonic: NOTE.E3,
    mode: 'phrygian',
    cuts: [0, 8, 16],
    chords: [0, 1, 6],
    title: { degree: 0, colour: 'minor' },
    motif: [[0, 0, 1], [1, 1, 1], [2, 3, 0.5], [2.5, 1, 0.5], [3.5, 0, 0.75], [4.5, -1, 2]],
    melody: [{ at: 1 }, { at: 9, shift: 1 }, { at: 17 }, { at: 23, shift: -1, drop: 1 }],
    lead: 'horn',
    pads: [[0, 'dark']],
    arps: [{ from: 0, to: 16, step: 0.5, pattern: [0, 0, 1, 0, 0, 2, 0, 1], voice: 'seq', octave: 0, amp: 0.4 }],
    pulse: [{ v: 'tom', from: 0, to: 30, every: 1.5, amp: 0.4, skip: [3, 7, 8, 12, 15, 16, 17] }],
    bass: true,
    drone: true,
    dyn: [0.6, 0.55, 0.5],
  },
};

/** A film whose scenes fall on other beats in another fate of matter: its score for that fate (`id:fate`). */
export const FATE_SCORES: Record<string, Score> = {
  'last_horizon:stable': {
    ...SCORES.last_horizon,
    cuts: [0, 7, 14, 20, 26, 34, 40.5, 48.5, 54, 60.5, 67.5],
    chords: [0, 5, 3, 0, 6, 2, 5, 3, 4, 6, 0],
    melody: [{ at: 1 }, { at: 21, shift: 2, voice: 'voice' }, { at: 35, voice: 'synth', amp: 0.8 }, { at: 49.5, shift: -1, voice: 'lead', amp: 0.6 }, { at: 61.5 }, { at: 68.5, shift: -2 }],
    arps: [{ from: 20, to: 48.5, step: 0.5, pattern: [0, 0, 2, 0, 0, 1, 0, 2], voice: 'seq', octave: 0, amp: 0.4 }],
    pulse: [{ v: 'metal', from: 26, to: 48.5, every: 0.5, groups: [3, 3, 2, 2, 3], amp: 0.35 }],
    dyn: [0.55, 0.6, 0.75, 0.6, 0.55, 0.5, 0.5, 0.5, 0.45, 0.45, 0.45],
    thumps: [14.6, 15.8, 16.8, 17.5, 18, 18.3],
    boom: { at: 18.55, swell: 2.5 },
  },
  'last_warmth:curvature': {
    ...SCORES.last_warmth,
    cuts: [0, 7.5, 21.5, 29.5, 38, 46.5, 54, 61],
    chords: [0, 3, 2, 0, 4, 6, 3, 0],
    dyn: [0.65, 0.65, 0.6, 0.55, 0.55, 0.5, 0.45, 0.4],
  },
};

/** A film's score, in a fate of matter if it has one there. */
export function scoreOf(id: FilmId, fate?: string): Score {
  return (fate && FATE_SCORES[`${id}:${fate}`]) || SCORES[id];
}
