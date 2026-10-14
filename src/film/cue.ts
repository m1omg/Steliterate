import type { FilmId } from './films';

// The films' sound (part 4): each film's cue is scheduled on an audio clock from the moment it
// starts, so the cuts and the sound keep time together; the same function renders it offline for
// the exported video. Programmatic, like the pictures: a drone, a bell on each cut, the reel's
// tick on each beat.

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
}

function reelCue(spec: CueSpec) {
  return (ctx: BaseAudioContext, out: AudioNode, at: number) => {
    const beat = 60 / spec.bpm;
    const n = noise(ctx);
    const hold = spec.titleAt * beat;
    tone(ctx, out, spec.root, at, 1.6, hold - 1.6, 2, 0.16);
    tone(ctx, out, spec.root * 1.4983, at + 0.4, 1.8, hold - 2.2, 2.2, 0.08);
    for (const [b, hz] of spec.cuts) bell(ctx, out, hz, at + b * beat, 0.09);
    for (let i = 0; i < Math.floor(spec.titleAt); i++) tick(ctx, out, n, at + i * beat, i % 4 === 0 ? 0.07 : 0.035);
    for (const hz of spec.chord) tone(ctx, out, hz, at + hold, 0.5, 1.4, 1.6, 0.06);
    bell(ctx, out, spec.chord[0] * 2, at + hold, 0.07);
  };
}

const AGE = (root: number, notes: [number, number, number], chord: number[]): CueSpec => ({ bpm: 96, root, cuts: [[0, notes[0]], [4, notes[1]], [8, notes[2]]], titleAt: 12, chord });
const END = (root: number, notes: [number, number], chord: number[]): CueSpec => ({ bpm: 84, root, cuts: [[0, notes[0]], [5.5, notes[1]]], titleAt: 11, chord });

// the ages go down as they go on: A, E, D, C, B; the endings, F major for a victory, G for endurance, C minor for the Hunger, A minor for a defeat
const VICTORY = END(43.65, [349.23, 440], [87.31, 110, 130.81]);
const DEFEAT = END(55, [329.63, 261.63], [110, 130.81, 164.81]);
const SPECS: Record<FilmId, CueSpec> = {
  dusk: AGE(55, [440, 329.63, 293.66], [110, 164.81, 277.18]),
  last_light: AGE(41.2, [392, 329.63, 246.94], [82.41, 98, 123.47]),
  great_decay: AGE(36.71, [349.23, 293.66, 220], [73.42, 87.31, 110]),
  last_warmth: AGE(36.71, [349.23, 293.66, 220], [73.42, 87.31, 110]),
  great_evaporation: AGE(32.7, [311.13, 261.63, 196], [65.41, 77.78, 98]),
  last_horizon: AGE(30.87, [293.66, 246.94, 185], [61.74, 73.42, 92.5]),
  end_long_thought: VICTORY,
  end_one_voice: VICTORY,
  end_quiet_lattice: VICTORY,
  end_aeon_seed: VICTORY,
  end_last_garden: VICTORY,
  end_hunger: END(32.7, [311.13, 277.18], [65.41, 77.78, 92.5]),
  end_recurrence: END(49, [392, 293.66], [98, 146.83, 196]),
  end_silence: DEFEAT,
  end_fade: DEFEAT,
  end_will_fails: DEFEAT,
};

const CUES = Object.fromEntries(Object.entries(SPECS).map(([id, spec]) => [id, reelCue(spec)])) as Record<FilmId, (ctx: BaseAudioContext, out: AudioNode, at: number) => void>;

/** Play a film's cue into `out` from `at` (on its context's clock). */
export function playCue(id: FilmId, ctx: BaseAudioContext, out: AudioNode, at: number): Voice {
  const bus = ctx.createGain();
  bus.gain.value = 1;
  bus.connect(out);
  CUES[id](ctx, bus, at);
  return {
    stop(secs = 0.4) {
      const now = ctx.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(bus.gain.value, now);
      bus.gain.linearRampToValueAtTime(0, now + secs);
      setTimeout(() => bus.disconnect(), (secs + 0.1) * 1000);
    },
  };
}

/** A film's cue rendered offline (for the exported video): stereo samples at `rate`. */
export async function renderCue(id: FilmId, secs: number, rate = 48000): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(secs * rate), rate);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3;
  comp.connect(ctx.destination);
  CUES[id](ctx, comp, 0);
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
