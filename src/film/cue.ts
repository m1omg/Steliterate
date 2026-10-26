import type { FilmId } from './films';

// The films' sound (part 4): each film's cue is scheduled on an audio clock from the moment it
// starts, so the cuts and the sound keep time together; the same function renders it offline for
// the exported video. Programmatic, like the pictures: a drone, a bell on each cut, the reel's
// tick on each beat. A cue is a list of notes, each made a few seconds before it sounds (15 Oct:
// made all at once, a film's three hundred voices waited in the sound's graph from the start, and
// on a tablet the sound crackled); offline, all are made at once.

interface Voice {
  /** Fade it all out from now over `secs` (a skip). */
  stop(secs?: number): void;
}

function noise(ctx: BaseAudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < d.length; i++) {
    s = (s * 16807) % 2147483647;
    d[i] = (s / 2147483647) * 2 - 1;
  }
  return buf;
}

/** A sine that swells in and dies away. */
function tone(ctx: BaseAudioContext, out: AudioNode, hz: number, at: number, attack: number, hold: number, release: number, gain: number) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = hz;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + attack);
  g.gain.setValueAtTime(gain, at + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + attack + hold + release + 0.05);
}

/** A struck bell: a few inharmonic partials, each dying away at its own rate. */
function bell(ctx: BaseAudioContext, out: AudioNode, hz: number, at: number, gain: number) {
  [1, 2.76, 5.4, 8.93].forEach((p, i) => tone(ctx, out, hz * p, at, 0.004, 0, 2.6 / (1 + i * 0.9), gain / (1 + i * 1.6)));
}

/** The reel's tick: a dry click of filtered noise. */
function tick(ctx: BaseAudioContext, out: AudioNode, buf: AudioBuffer, at: number, gain: number) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 3200;
  f.Q.value = 6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
  src.connect(f).connect(g).connect(out);
  src.start(at, 0, 0.05);
}

/** A film's cue: its root and the fifth swelling under it, a bell on each cut, the reel ticking on the beat until the title, and a chord under the title. */
interface CueSpec {
  bpm: number;
  /** The root of the drone (Hz): it and its fifth hold under the shots. */
  root: number;
  /** A bell on each cut (in beats), each its own note. */
  cuts: [number, number][];
  titleAt: number;
  /** The chord under the title (Hz). */
  chord: number[];
  /** A long film's: a soft chord under each scene, built on its cut's note, and the reel's tick only on each bar. */
  pads?: boolean;
  /** (the Supernova's) the gravitational waves' chirp as two stars spiral in: from beat, to beat, Hz at each end. */
  chirp?: [number, number, number, number];
  /** (the Supernova's) low thumps, a heartbeat quickening, at these beats. */
  thumps?: number[];
  /** (the Supernova's) the detonation: a breath of noise rising into it over `swell` beats, then a deep boom, at this beat. */
  boom?: { at: number; swell: number };
}

/** A soft pad: a few detuned sines, swelling in over `attack` and away over `release`. */
function pad(ctx: BaseAudioContext, out: AudioNode, notes: number[], at: number, attack: number, hold: number, release: number, gain: number) {
  for (const hz of notes) for (const d of [-0.004, 0.004]) tone(ctx, out, hz * (1 + d), at, attack, hold, release, gain / notes.length);
}

/** A rising breath of noise into a moment (the title), over `secs`. */
function swell(ctx: BaseAudioContext, out: AudioNode, buf: AudioBuffer, at: number, secs: number, gain: number) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(300, at - secs);
  f.frequency.exponentialRampToValueAtTime(2400, at);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at - secs);
  g.gain.exponentialRampToValueAtTime(gain, at - 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
  src.connect(f).connect(g).connect(out);
  src.start(at - secs);
  src.stop(at + 0.7);
}

/**
 * A chirp: the gravitational waves of two stars spiralling in, their pitch rising as (t_c − t)^(−3/8)
 * and their loudness with it, cut off as they merge. A triangle wave, so a phone's small speaker
 * still gives it voice.
 */
function chirp(ctx: BaseAudioContext, out: AudioNode, at: number, secs: number, hz0: number, hz1: number, gain: number) {
  const n = 96;
  const f = new Float32Array(n);
  const a = new Float32Array(n);
  const k = 1 - Math.pow(hz0 / hz1, 8 / 3);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    f[i] = hz0 * Math.pow(1 - u * k, -3 / 8);
    a[i] = gain * Math.pow(f[i] / hz1, 2 / 3) * Math.min(1, u * 12);
  }
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueCurveAtTime(f, at, secs);
  const g = ctx.createGain();
  g.gain.setValueCurveAtTime(a, at, secs);
  g.gain.setValueAtTime(gain, at + secs);
  g.gain.exponentialRampToValueAtTime(0.0001, at + secs + 0.08);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + secs + 0.12);
}

/** A low thump: a sine falling from 70 to 38 Hz and gone in a third of a second. */
function thump(ctx: BaseAudioContext, out: AudioNode, at: number, gain: number) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(70, at);
  o.frequency.exponentialRampToValueAtTime(38, at + 0.3);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.36);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + 0.4);
}

/** A detonation: a deep sine falling away under a burst of noise that darkens as it fades. */
function boom(ctx: BaseAudioContext, out: AudioNode, buf: AudioBuffer, at: number, gain: number) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(96, at);
  o.frequency.exponentialRampToValueAtTime(24, at + 3);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 3.6);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + 3.7);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(5200, at);
  f.frequency.exponentialRampToValueAtTime(140, at + 2.4);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, at);
  ng.gain.exponentialRampToValueAtTime(gain * 0.7, at + 0.01);
  ng.gain.exponentialRampToValueAtTime(0.0001, at + 2.6);
  src.connect(f).connect(ng).connect(out);
  src.start(at);
  src.stop(at + 2.7);
}

/** A note of a cue: when it begins (seconds from the cue's start) and what makes it, given the moment the cue starts. */
interface CueNote {
  at: number;
  make(ctx: BaseAudioContext, out: AudioNode, t0: number, n: AudioBuffer): void;
}

function reelCue(spec: CueSpec): CueNote[] {
  const beat = 60 / spec.bpm;
  const hold = spec.titleAt * beat;
  const notes: CueNote[] = [];
  const add = (at: number, make: CueNote['make']) => notes.push({ at, make });
  add(0, (ctx, out, t0) => tone(ctx, out, spec.root, t0, 1.6, hold - 1.6, 2, 0.16));
  add(0.4, (ctx, out, t0) => tone(ctx, out, spec.root * 1.4983, t0 + 0.4, 1.8, hold - 2.2, 2.2, 0.08));
  spec.cuts.forEach(([b, hz], i) => {
    add(b * beat, (ctx, out, t0) => bell(ctx, out, hz, t0 + b * beat, 0.09));
    if (!spec.pads) return;
    // under the scene, its cut's note two octaves down with its fifth and tenth, until the next cut
    const end = (spec.cuts[i + 1]?.[0] ?? spec.titleAt) * beat;
    const start = b * beat;
    add(start, (ctx, out, t0) => pad(ctx, out, [hz / 4, (hz / 4) * 1.4983, (hz / 4) * 2.52], t0 + start, 1.8, Math.max(0.2, end - start - 1.8), 2.4, 0.05));
  });
  for (let i = 0; i < Math.floor(spec.titleAt); i++) {
    if (spec.pads && i % 4 !== 0) continue;
    add(i * beat, (ctx, out, t0, n) => tick(ctx, out, n, t0 + i * beat, i % 4 === 0 ? 0.07 : 0.035));
  }
  if (spec.pads) add(hold - beat * 3, (ctx, out, t0, n) => swell(ctx, out, n, t0 + hold, beat * 3, 0.05));
  if (spec.chirp) {
    const [b0, b1, hz0, hz1] = spec.chirp;
    add(b0 * beat, (ctx, out, t0) => chirp(ctx, out, t0 + b0 * beat, (b1 - b0) * beat, hz0, hz1, 0.06));
  }
  for (const b of spec.thumps ?? []) add(b * beat, (ctx, out, t0) => thump(ctx, out, t0 + b * beat, 0.32));
  if (spec.boom) {
    const { at: b, swell: sb } = spec.boom;
    add((b - sb) * beat, (ctx, out, t0, n) => swell(ctx, out, n, t0 + b * beat, sb * beat, 0.09));
    add(b * beat, (ctx, out, t0, n) => boom(ctx, out, n, t0 + b * beat, 0.5));
  }
  for (const hz of spec.chord) add(hold, (ctx, out, t0) => tone(ctx, out, hz, t0 + hold, 0.5, spec.pads ? 3 : 1.4, spec.pads ? 3 : 1.6, 0.06));
  add(hold, (ctx, out, t0) => bell(ctx, out, spec.chord[0] * 2, t0 + hold, 0.07));
  return notes.sort((a, b) => a.at - b.at);
}

/** An ending's cue (36 beats at 84, the title at 31): a bell on each scene's cut, a pad under it. */
const END = (root: number, cuts: [number, number][], chord: number[]): CueSpec => ({ bpm: 84, root, cuts, titleAt: 31, chord, pads: true });
const VICTORY = [87.31, 110, 130.81];
const DEFEAT = [110, 130.81, 164.81];
const SPECS: Record<FilmId, CueSpec> = {
  // (the Long Dusk's second cut: 72 beats at 90, a cut at each scene)
  dusk: { bpm: 90, root: 55, cuts: [[0, 440], [6, 392], [10.5, 329.63], [17, 293.66], [23, 261.63], [36, 329.63], [41, 220], [45.5, 246.94], [49.5, 196], [55.5, 220], [60.5, 164.81]], titleAt: 66, chord: [110, 164.81, 277.18], pads: true },
  // (the Supernova's: a chirp as the two spiral in, a heartbeat as the remnant passes its limit, the boom)
  supernova: { bpm: 90, root: 36.71, cuts: [[0, 392], [8.5, 329.63], [16.5, 293.66], [25.5, 220], [32.5, 261.63], [42.5, 246.94], [48.5, 196]], titleAt: 54, chord: [73.42, 110, 146.83], pads: true, chirp: [0.5, 15.5, 48, 330], thumps: [17.5, 19.5, 21, 22.2, 23.1, 23.8, 24.35, 24.8, 25.15], boom: { at: 25.5, swell: 3 } },
  last_light: { bpm: 90, root: 41.2, cuts: [[0, 392], [6.5, 329.63], [12, 293.66], [18.3, 246.94], [30, 329.63], [37.5, 392], [44.5, 246.94], [51.5, 220], [58.5, 196]], titleAt: 64, chord: [82.41, 98, 123.47], pads: true },
  // (the Black Hole Age's second cut: 74 beats at 90, a cut at each scene; the Last Warmth's under curvature radiation below)
  great_decay: { bpm: 90, root: 36.71, cuts: [[0, 349.23], [8, 293.66], [15.5, 261.63], [22.5, 220], [30.5, 233.08], [38.5, 196], [46.5, 174.61], [55.5, 146.83]], titleAt: 68, chord: [73.42, 87.31, 110], pads: true },
  last_warmth: { bpm: 90, root: 36.71, cuts: [[0, 349.23], [7.5, 293.66], [15, 261.63], [22, 220], [30, 196], [38, 233.08], [46, 220], [54, 174.61], [61, 146.83]], titleAt: 68, chord: [73.42, 87.31, 110], pads: true },
  great_evaporation: { bpm: 90, root: 32.7, cuts: [[0, 311.13], [8.5, 261.63], [16.5, 233.08], [25.5, 196], [33.5, 174.61]], titleAt: 42, chord: [65.41, 77.78, 98], pads: true },
  last_horizon: { bpm: 90, root: 30.87, cuts: [[0, 293.66], [8, 246.94], [15.5, 220], [23.5, 185], [33.5, 196], [43, 164.81], [52.5, 146.83]], titleAt: 62, chord: [61.74, 73.42, 92.5], pads: true },
  // (the endings' second cut: a cut at each scene; Recurrence comes back to the note it began on)
  end_long_thought: END(43.65, [[0, 349.23], [14.5, 293.66], [22.5, 261.63]], VICTORY),
  end_one_voice: END(43.65, [[0, 440], [8.5, 349.23], [16, 293.66], [23.5, 261.63]], VICTORY),
  end_quiet_lattice: END(43.65, [[0, 392], [7, 329.63], [19.5, 261.63]], VICTORY),
  end_aeon_seed: END(43.65, [[0, 349.23], [8, 440], [16, 392], [24, 523.25]], VICTORY),
  end_last_garden: END(43.65, [[0, 293.66], [8, 349.23], [16, 392], [24, 440]], VICTORY),
  end_hunger: END(32.7, [[0, 311.13], [7.5, 277.18], [15.5, 233.08]], [65.41, 77.78, 92.5]),
  end_recurrence: END(49, [[0, 392], [8.5, 293.66], [18.5, 392]], [98, 146.83, 196]),
  end_silence: END(55, [[0, 329.63], [7.5, 261.63], [15.5, 220]], DEFEAT),
  end_fade: END(55, [[0, 329.63], [8.5, 261.63], [16.5, 196]], DEFEAT),
  end_will_fails: END(55, [[0, 329.63], [8, 246.94], [16, 220]], DEFEAT),
};

/** A film whose scenes fall on other beats in another fate of matter: its cue for that fate (`id:fate`). */
const FATE_SPECS: Record<string, CueSpec> = {
  'last_horizon:stable': { bpm: 90, root: 30.87, cuts: [[0, 293.66], [6, 246.94], [12, 220], [20, 196], [26.5, 233.08], [34.5, 185], [40, 196], [46.5, 164.81], [53.5, 146.83]], titleAt: 62, chord: [61.74, 73.42, 92.5], pads: true },
  'last_warmth:curvature': { bpm: 90, root: 36.71, cuts: [[0, 392], [7.5, 293.66], [21.5, 220], [29.5, 261.63], [38, 196], [46.5, 233.08], [54, 174.61], [61, 146.83]], titleAt: 68, chord: [73.42, 87.31, 110], pads: true },
};

const CUES = Object.fromEntries(Object.entries(SPECS).map(([id, spec]) => [id, reelCue(spec)])) as Record<FilmId, CueNote[]>;
const FATE_CUES: Record<string, CueNote[]> = Object.fromEntries(Object.entries(FATE_SPECS).map(([id, spec]) => [id, reelCue(spec)]));
const cueOf = (id: FilmId, fate?: string): CueNote[] => (fate && FATE_CUES[`${id}:${fate}`]) || CUES[id];

/** How far ahead (seconds) a playing cue's notes are made, and how often it looks. */
const AHEAD = 3;
const EVERY = 250;

/** Play a film's cue into `out` from `at` (on its context's clock): each note made a few seconds before it sounds. */
export function playCue(id: FilmId, ctx: BaseAudioContext, out: AudioNode, at: number, fate?: string): Voice {
  const bus = ctx.createGain();
  bus.gain.value = 1;
  bus.connect(out);
  const notes = cueOf(id, fate);
  const n = noise(ctx);
  let next = 0;
  const feed = () => {
    while (next < notes.length && at + notes[next].at <= ctx.currentTime + AHEAD) notes[next++].make(ctx, bus, at, n);
    if (next >= notes.length) clearInterval(timer);
  };
  const timer = setInterval(feed, EVERY);
  feed();
  return {
    stop(secs = 0.4) {
      clearInterval(timer);
      const now = ctx.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(bus.gain.value, now);
      bus.gain.linearRampToValueAtTime(0, now + secs);
      setTimeout(() => bus.disconnect(), (secs + 0.1) * 1000);
    },
  };
}

/** How many notes a cue makes, and how many of them a playing cue has made `secs` after it starts (the checks: they are made as they come). */
export function cueNotes(id: FilmId, secs: number, fate?: string): { all: number; made: number } {
  const notes = cueOf(id, fate);
  return { all: notes.length, made: notes.filter((x) => x.at <= secs + AHEAD).length };
}

/** A film's cue rendered offline (for the exported video): stereo samples at `rate`. */
export async function renderCue(id: FilmId, secs: number, rate = 48000, fate?: string): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(secs * rate), rate);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3;
  comp.connect(ctx.destination);
  const n = noise(ctx);
  for (const x of cueOf(id, fate)) x.make(ctx, comp, 0, n);
  return ctx.startRendering();
}

/** 16-bit PCM WAV bytes of an audio buffer, as base64 (for the export tool). */
export function wavBase64(buf: AudioBuffer): string {
  const ch = buf.numberOfChannels;
  const len = buf.length;
  const bytes = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => bytes.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  bytes.setUint32(4, 36 + len * ch * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  bytes.setUint32(16, 16, true);
  bytes.setUint16(20, 1, true);
  bytes.setUint16(22, ch, true);
  bytes.setUint32(24, buf.sampleRate, true);
  bytes.setUint32(28, buf.sampleRate * ch * 2, true);
  bytes.setUint16(32, ch * 2, true);
  bytes.setUint16(34, 16, true);
  str(36, 'data');
  bytes.setUint32(40, len * ch * 2, true);
  const data = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < len; i++)
    for (let c = 0; c < ch; c++) {
      bytes.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 32767, true);
      o += 2;
    }
  let bin = '';
  const u8 = new Uint8Array(bytes.buffer);
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(bin);
}
