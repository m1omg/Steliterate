import type { FilmId, FilmQuality } from './films';
import { compose, oscillatorsOf, scoreOf, TAIL, type Score, type ScoreEvent, type Voice as Instrument } from './score';

// The films' sound (part 4; rewritten 1 Nov): each film's music is composed in score.ts, its own
// key, mode, melody, chords, arpeggios, bass and instruments, and played here, every note scheduled
// on an audio clock from the moment the film starts, so its cuts and its sound keep time; the same
// function renders it offline for the exported video. A cue is a list of notes, each made a few
// seconds before it sounds (15 Oct: made all at once, a film's three hundred voices waited in the
// sound's graph from the start, and on a tablet the sound crackled); offline, all are made at once.
// The instruments are Web Audio's own oscillators, filters and noise, through a room of their own
// (a reverb made from decaying noise). Below the high quality setting (a tablet's or a phone's
// medium, by default) each makes fewer oscillators, at most about thirty sounding at once; at the
// low setting there is no room either.

interface Voice {
  /** Fade it all out from now over `secs` (a skip). */
  stop(secs?: number): void;
}

/**
 * Where a note goes: dry, and into the room (none at low quality), with the noise its breath and its
 * drums are cut from; `low`: the lighter instruments (fewer oscillators). A synthwave score's
 * (3 Nov) also: the pump, a dry and a room bus that each kick dips, as a sidechain does, for the
 * pads, the basses and the sequencer; the echo, a ping-pong delay in time with the beat (none at low
 * quality); and a longer noise for the crash.
 */
interface Out {
  dry: AudioNode;
  wet: AudioNode | null;
  n: AudioBuffer;
  low: boolean;
  pump?: { dry: GainNode; wet: GainNode | null; depth: number };
  echo?: AudioNode;
  long?: AudioBuffer;
}

/** A deterministic noise (the same sound every time, for the videos). */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s / 2147483647) * 2 - 1;
  };
}

function noise(ctx: BaseAudioContext, secs = 0.5, seed = 12345): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * secs), ctx.sampleRate);
  const d = buf.getChannelData(0);
  const r = rng(seed);
  for (let i = 0; i < d.length; i++) d[i] = r();
  return buf;
}

/** The room: two seconds and a half of noise dying away, darker as it goes, a little different in each ear. */
function room(ctx: BaseAudioContext): AudioBuffer {
  const secs = 2.5;
  const len = Math.floor(ctx.sampleRate * secs);
  const pre = Math.floor(ctx.sampleRate * 0.018);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    const r = rng(777 + ch * 1013);
    let y = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / ctx.sampleRate;
      // a one-pole low-pass closing as the tail goes on: bright early, dark late
      const a = 0.85 - 0.7 * Math.min(1, t / secs);
      y += a * (r() - y);
      d[i] = y * Math.exp(-t / 0.36) * Math.min(1, (i - pre) / 200);
    }
  }
  return buf;
}

/** How loud each instrument is at full strength, and how much of it goes into the room. */
const LEVEL: Record<Instrument, number> = {
  pad: 0.25,
  dark: 0.28,
  glass: 0.39,
  choir: 0.77,
  flute: 0.14,
  horn: 0.14,
  lead: 0.13,
  voice: 0.42,
  harp: 0.28,
  bass: 0.14,
  synth: 0.14,
  seq: 0.21,
  sbass: 0.13,
  stab: 0.16,
  bell: 0.18,
  drone: 0.1,
  kick: 0.6,
  snare: 0.6,
  hat: 0.65,
  open: 0.3,
  crash: 0.22,
  tom: 0.46,
  shaker: 0.84,
  metal: 0.42,
  chirp: 0.06,
  thump: 0.32,
  boom: 0.36,
  swell: 0.09,
  tick: 0.07,
};
const WET: Record<Instrument, number> = {
  pad: 0.35,
  dark: 0.3,
  glass: 0.5,
  choir: 0.45,
  flute: 0.35,
  horn: 0.3,
  lead: 0.5,
  voice: 0.4,
  harp: 0.4,
  bass: 0.04,
  synth: 0.4,
  seq: 0.25,
  sbass: 0.03,
  stab: 0.35,
  bell: 0.5,
  drone: 0.1,
  kick: 0.05,
  snare: 0.3,
  hat: 0.12,
  open: 0.2,
  crash: 0.45,
  tom: 0.15,
  shaker: 0.2,
  metal: 0.7,
  chirp: 0.2,
  thump: 0,
  boom: 0.25,
  swell: 0.3,
  tick: 0,
};

/** How much of each voice goes into the echo, where a score has one. */
const ECHO: Partial<Record<Instrument, number>> = { synth: 0.34, lead: 0.3, seq: 0.24, stab: 0.22 };
/** The voices the pump dips with each kick, where a score has one: the pads, the basses, the sequencer. */
const PUMPED: ReadonlySet<Instrument> = new Set<Instrument>(['pad', 'dark', 'glass', 'choir', 'bass', 'sbass', 'seq', 'drone']);

/** A note's way out: dry, and some into the room; for a synthwave score's (`v`), through the pump and into the echo. */
function send(ctx: BaseAudioContext, o: Out, node: AudioNode, wet: number, v?: Instrument) {
  const pump = v && PUMPED.has(v) ? o.pump : undefined;
  node.connect(pump?.dry ?? o.dry);
  const room = pump ? pump.wet : o.wet;
  if (room && wet > 0) {
    const s = ctx.createGain();
    s.gain.value = wet;
    node.connect(s).connect(room);
  }
  const echo = v ? ECHO[v] : undefined;
  if (o.echo && echo) {
    const s = ctx.createGain();
    s.gain.value = echo;
    node.connect(s).connect(o.echo);
  }
}

/** A kick's dip of the pumped voices: down at once, back over about a quarter of a second. */
function duck(o: Out, at: number) {
  if (!o.pump) return;
  for (const g of [o.pump.dry, o.pump.wet]) {
    if (!g) continue;
    g.gain.setValueAtTime(1 - o.pump.depth, at);
    g.gain.setTargetAtTime(1, at + 0.02, 0.075);
  }
}

/** A gain that swells in over `attack`, holds, and dies away over `release`. */
function env(ctx: BaseAudioContext, at: number, attack: number, hold: number, release: number, peak: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + attack);
  g.gain.setValueAtTime(peak, at + attack + Math.max(0, hold));
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + Math.max(0, hold) + release);
  return g;
}

/** A struck envelope: at once to `peak`, then dying away over `decay` (to a thousandth). */
function strike(ctx: BaseAudioContext, at: number, decay: number, peak: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.004 + decay);
  return g;
}

function osc(ctx: BaseAudioContext, type: OscillatorType, hz: number, at: number, end: number, cents = 0): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = hz;
  o.detune.value = cents;
  o.start(at);
  o.stop(end);
  return o;
}

function panned(ctx: BaseAudioContext, node: AudioNode, pan: number): AudioNode {
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  return node.connect(p);
}

/** A vibrato (cents), coming in after `delay`, into these oscillators' detune. */
function vibrato(ctx: BaseAudioContext, oscs: OscillatorNode[], at: number, end: number, rate: number, cents: number, delay: number) {
  const lfo = osc(ctx, 'sine', rate, at, end);
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, at);
  depth.gain.linearRampToValueAtTime(cents, at + delay);
  lfo.connect(depth);
  for (const x of oscs) depth.connect(x.detune);
}

/** A breath of noise through a band (a flute's air, a shaker). */
function breath(ctx: BaseAudioContext, o: Out, at: number, end: number, centre: number, q: number): AudioNode {
  const src = ctx.createBufferSource();
  src.buffer = o.n;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = centre;
  f.Q.value = q;
  src.connect(f);
  src.start(at, (at * 7.31) % 0.4);
  src.stop(end);
  return f;
}

// ------------------------------------------------------------ the instruments
// Each plays one event: from `at` (seconds on its context's clock), held `secs`, at its strength.

type Play = (ctx: BaseAudioContext, o: Out, e: ScoreEvent, at: number, secs: number) => void;

/** The pads: a chord held under a scene. */
const pads: Record<'pad' | 'dark' | 'glass' | 'choir', Play> = {
  // warm: two saws a little apart in pitch and in the ears, through a low-pass that opens as it swells
  pad(ctx, o, e, at, secs) {
    const attack = Math.min(1.8, Math.max(0.3, secs * 0.4));
    const end = at + attack + Math.max(0, secs - attack) + TAIL.pad + 0.05;
    const per = (e.amp * LEVEL.pad) / Math.sqrt(e.hz.length);
    e.hz.forEach((hz, i) => {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 0.5;
      f.frequency.setValueAtTime(hz * 1.6, at);
      f.frequency.exponentialRampToValueAtTime(Math.min(hz * 6, 3600), at + attack * 1.4);
      const g = env(ctx, at, attack, secs - attack, TAIL.pad, per);
      f.connect(g);
      send(ctx, o, g, WET.pad, 'pad');
      if (o.low) osc(ctx, 'sawtooth', hz, at, end, i * 2).connect(f);
      else [-7, 7].forEach((c, k) => panned(ctx, osc(ctx, 'sawtooth', hz, at, end, c + i * 2), (k ? 0.5 : -0.5) * (0.6 + 0.2 * i)).connect(f));
    });
  },
  // dark: a closed saw and a sine under it, slow to come
  dark(ctx, o, e, at, secs) {
    const attack = Math.min(2.4, Math.max(0.4, secs * 0.45));
    const end = at + attack + Math.max(0, secs - attack) + TAIL.dark + 0.05;
    const per = (e.amp * LEVEL.dark) / Math.sqrt(e.hz.length);
    e.hz.forEach((hz, i) => {
      const g = env(ctx, at, attack, secs - attack, TAIL.dark, per);
      send(ctx, o, g, WET.dark, 'dark');
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = Math.min(hz * 2.6, 900);
      f.Q.value = 0.9;
      f.connect(g);
      panned(ctx, osc(ctx, 'sawtooth', hz, at, end, -4 + i * 3), (i - 1) * 0.35).connect(f);
      if (!o.low) osc(ctx, 'sine', hz / 2, at, end).connect(g);
    });
  },
  // glass: sines with a triangle an octave up, bright and still
  glass(ctx, o, e, at, secs) {
    const attack = Math.min(1.4, Math.max(0.25, secs * 0.35));
    const end = at + attack + Math.max(0, secs - attack) + TAIL.glass + 0.05;
    const per = (e.amp * LEVEL.glass) / Math.sqrt(e.hz.length);
    e.hz.forEach((hz, i) => {
      const g = env(ctx, at, attack, secs - attack, TAIL.glass, per);
      send(ctx, o, g, WET.glass, 'glass');
      panned(ctx, osc(ctx, 'sine', hz, at, end, i * 3), (i - 1) * 0.45).connect(g);
      if (!o.low) {
        const t = ctx.createGain();
        t.gain.value = 0.22;
        panned(ctx, osc(ctx, 'triangle', hz * 2, at, end, -i * 4), (1 - i) * 0.45).connect(t).connect(g);
      }
    });
  },
  // choir: saws through two formants of an open vowel, with a slow vibrato
  choir(ctx, o, e, at, secs) {
    const attack = Math.min(1.6, Math.max(0.35, secs * 0.4));
    const end = at + attack + Math.max(0, secs - attack) + TAIL.choir + 0.05;
    const g = env(ctx, at, attack, secs - attack, TAIL.choir, e.amp * LEVEL.choir);
    send(ctx, o, g, WET.choir, 'choir');
    const mix = ctx.createGain();
    mix.gain.value = 1 / Math.sqrt(e.hz.length);
    formants(ctx, mix, g, 1);
    const oscs = e.hz.map((hz, i) => {
      const x = osc(ctx, 'sawtooth', hz, at, end, (i - 1) * 5);
      panned(ctx, x, (i - 1) * 0.4).connect(mix);
      return x;
    });
    vibrato(ctx, oscs, at, end, 4.6, 10, 0.8);
  },
};

/** An open vowel's two formants (and its body, under them), from `src` into `dst`. */
function formants(ctx: BaseAudioContext, src: AudioNode, dst: AudioNode, gain: number) {
  for (const [hz, q, g] of [
    [650, 7, 1.6],
    [1080, 9, 1.1],
    [2650, 12, 0.35],
  ] as const) {
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = hz;
    f.Q.value = q;
    const k = ctx.createGain();
    k.gain.value = g * gain;
    src.connect(f).connect(k).connect(dst);
  }
  const body = ctx.createBiquadFilter();
  body.type = 'lowpass';
  body.frequency.value = 500;
  const k = ctx.createGain();
  k.gain.value = 0.35 * gain;
  src.connect(body).connect(k).connect(dst);
}

/** The lines and the percussion. */
const lines: Record<Exclude<Instrument, keyof typeof pads>, Play> = {
  // a flute: a sine and a soft triangle, a breath of air at its start, a vibrato that comes in late
  flute(ctx, o, e, at, secs) {
    const hz = e.hz[0];
    const end = at + secs + TAIL.flute + 0.1;
    const g = env(ctx, at, 0.07, secs - 0.07, TAIL.flute, e.amp * LEVEL.flute);
    send(ctx, o, g, WET.flute);
    const a = osc(ctx, 'sine', hz, at, end);
    a.connect(g);
    const oscs = [a];
    if (!o.low) {
      const t = ctx.createGain();
      t.gain.value = 0.18;
      const b = osc(ctx, 'triangle', hz, at, end, 3);
      b.connect(t).connect(g);
      oscs.push(b);
      const air = breath(ctx, o, at, Math.min(end, at + 0.5), hz * 2.2, 1.5);
      air.connect(strike(ctx, at, 0.25, 0.5)).connect(g);
    }
    vibrato(ctx, oscs, at, end, 5.2, 9, Math.min(0.6, secs * 0.6));
  },
  // a horn: a saw whose filter opens as it is blown, and a sine for its body
  horn(ctx, o, e, at, secs) {
    const hz = e.hz[0];
    const end = at + secs + TAIL.horn + 0.1;
    const g = env(ctx, at, 0.12, secs - 0.12, TAIL.horn, e.amp * LEVEL.horn);
    send(ctx, o, g, WET.horn);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(hz * 1.3, at);
    f.frequency.exponentialRampToValueAtTime(hz * 4.2, at + Math.min(0.35, secs * 0.5));
    f.frequency.exponentialRampToValueAtTime(hz * 2.4, at + secs + TAIL.horn);
    f.connect(g);
    osc(ctx, 'sawtooth', hz, at, end).connect(f);
    const s = ctx.createGain();
    s.gain.value = 0.6;
    osc(ctx, 'sine', hz, at, end).connect(s).connect(g);
  },
  // a glassy lead: a sine, its octave dying quickly over it, and a gentle vibrato
  lead(ctx, o, e, at, secs) {
    const hz = e.hz[0];
    const end = at + secs + TAIL.lead + 0.1;
    const g = env(ctx, at, 0.02, secs - 0.02, TAIL.lead, e.amp * LEVEL.lead);
    send(ctx, o, g, WET.lead, 'lead');
    const a = osc(ctx, 'sine', hz, at, end);
    a.connect(g);
    if (!o.low) osc(ctx, 'sine', hz * 2, at, end).connect(strike(ctx, at, 0.6, 0.35)).connect(g);
    vibrato(ctx, [a], at, end, 4.8, 7, Math.min(0.5, secs * 0.5));
  },
  // one voice of the choir
  voice(ctx, o, e, at, secs) {
    const hz = e.hz[0];
    const end = at + secs + TAIL.voice + 0.1;
    const g = env(ctx, at, 0.16, secs - 0.16, TAIL.voice, e.amp * LEVEL.voice);
    send(ctx, o, g, WET.voice);
    const x = osc(ctx, 'sawtooth', hz, at, end);
    formants(ctx, x, g, 1);
    vibrato(ctx, [x], at, end, 5, 14, Math.min(0.5, secs * 0.5));
  },
  // a harp: a plucked triangle whose brightness closes, placed in the ears by its pitch
  harp(ctx, o, e, at) {
    const hz = e.hz[0];
    const end = at + TAIL.harp + 0.05;
    const g = strike(ctx, at, TAIL.harp, e.amp * LEVEL.harp);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(Math.min(hz * 7, 9000), at);
    f.frequency.exponentialRampToValueAtTime(hz * 1.6, at + 0.45);
    f.connect(g);
    send(ctx, o, panned(ctx, g, Math.max(-0.7, Math.min(0.7, Math.log2(hz / 330) * 0.45))), WET.harp);
    osc(ctx, 'triangle', hz, at, end).connect(f);
    if (!o.low) osc(ctx, 'sine', hz * 2, at, end).connect(strike(ctx, at, 0.4, 0.25)).connect(f);
  },
  // the bass: a sine, with a triangle an octave up so a small speaker still sounds it
  bass(ctx, o, e, at, secs) {
    const hz = e.hz[0];
    const end = at + secs + TAIL.bass + 0.1;
    const g = env(ctx, at, 0.05, secs - 0.05, TAIL.bass, e.amp * LEVEL.bass);
    send(ctx, o, g, WET.bass, 'bass');
    if (o.low) {
      osc(ctx, 'triangle', hz, at, end).connect(g);
      return;
    }
    osc(ctx, 'sine', hz, at, end).connect(g);
    const t = ctx.createGain();
    t.gain.value = 0.22;
    osc(ctx, 'triangle', hz * 2, at, end).connect(t).connect(g);
  },
  // an analog lead: a saw and a square a little apart, through a low-pass, gliding into a note that
  // follows straight on from the one before
  synth(ctx, o, e, at, secs) {
    const hz = e.hz[0];
    const end = at + secs + TAIL.synth + 0.1;
    const g = env(ctx, at, 0.03, secs - 0.03, TAIL.synth, e.amp * LEVEL.synth);
    send(ctx, o, g, WET.synth, 'synth');
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(Math.min(hz * 8, 5000), at);
    f.frequency.exponentialRampToValueAtTime(Math.min(hz * 4.5, 3200), at + 0.3);
    f.connect(g);
    const oscs = [osc(ctx, 'sawtooth', hz, at, end, -6)];
    if (!o.low) {
      const sq = ctx.createGain();
      sq.gain.value = 0.55;
      const b = osc(ctx, 'square', hz, at, end, 6);
      b.connect(sq).connect(f);
      oscs.push(b);
    }
    oscs[0].connect(f);
    if (e.from)
      for (const x of oscs) {
        x.frequency.setValueAtTime(e.from, at);
        x.frequency.exponentialRampToValueAtTime(hz, at + 0.07);
      }
    vibrato(ctx, oscs, at, end, 5.5, 8, Math.min(0.5, secs * 0.6));
  },
  // an analog sequencer's note: two saws through a resonant low-pass that snaps shut, short and dry
  seq(ctx, o, e, at, secs) {
    const hz = e.hz[0];
    const gate = Math.min(secs * 0.45, 0.2);
    const end = at + gate + TAIL.seq + 0.05;
    const g = env(ctx, at, 0.004, gate, TAIL.seq, e.amp * LEVEL.seq);
    send(ctx, o, panned(ctx, g, Math.max(-0.4, Math.min(0.4, Math.log2(hz / 200) * 0.3))), WET.seq, 'seq');
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 7;
    f.frequency.setValueAtTime(Math.min(hz * 9, 6000), at);
    f.frequency.exponentialRampToValueAtTime(Math.max(120, hz * 1.4), at + 0.16);
    f.connect(g);
    osc(ctx, 'sawtooth', hz, at, end, -8).connect(f);
    if (!o.low) osc(ctx, 'sawtooth', hz, at, end, 8).connect(f);
  },
  // a metallic clank: two pairs of sines, each frequency-modulated at an inharmonic ratio, the
  // modulation dying fast, high-passed, into a large room
  metal(ctx, o, e, at) {
    const hz = e.hz[0];
    const end = at + TAIL.metal + 0.05;
    const g = strike(ctx, at, TAIL.metal, e.amp * LEVEL.metal);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 350;
    hp.connect(g);
    send(ctx, o, panned(ctx, g, -0.15), WET.metal);
    for (const [k, ratio, index] of o.low ? [[1, 2.41, 5]] : [[1, 2.41, 5], [1.53, 3.17, 3]]) {
      const c = osc(ctx, 'sine', hz * k, at, end);
      const m = osc(ctx, 'sine', hz * k * ratio, at, end);
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(hz * k * index, at);
      depth.gain.exponentialRampToValueAtTime(hz * k * 0.3, at + 0.2);
      m.connect(depth).connect(c.frequency);
      const lv = ctx.createGain();
      lv.gain.value = k === 1 ? 1 : 0.6;
      c.connect(lv).connect(hp);
    }
  },
  // a struck bell: a few inharmonic partials, each dying away at its own rate
  bell(ctx, o, e, at) {
    const hz = e.hz[0];
    const parts = o.low ? [1, 2.76, 5.4] : [1, 2.76, 5.4, 8.93];
    parts.forEach((p, i) => {
      const d = TAIL.bell / (1 + i * 0.9);
      const g = strike(ctx, at, d, (e.amp * LEVEL.bell) / (1 + i * 1.6));
      send(ctx, o, g, WET.bell);
      osc(ctx, 'sine', hz * p, at, at + d + 0.05).connect(g);
    });
  },
  // the drone: the root and its fifth, very low, held under it all
  drone(ctx, o, e, at, secs) {
    const end = at + secs + TAIL.drone + 0.1;
    e.hz.forEach((hz, i) => {
      const g = env(ctx, at + i * 0.4, 2.4, secs - 2.4 - i * 0.4, TAIL.drone, (e.amp * LEVEL.drone) / (1 + i));
      send(ctx, o, g, WET.drone, 'drone');
      osc(ctx, 'sine', hz, at + i * 0.4, end, i ? 2 : 0).connect(g);
    });
  },
  // an 80s drum machine's kick: a sine falling fast from 150 to 48 Hz, with a click of noise on its
  // front; it dips the pumped voices (3 Nov: before, a soft sine from 110 Hz, only the Interregnum's)
  kick(ctx, o, e, at) {
    const x = osc(ctx, 'sine', 150, at, at + TAIL.kick + 0.05);
    x.frequency.setValueAtTime(150, at);
    x.frequency.exponentialRampToValueAtTime(48, at + 0.08);
    const g = strike(ctx, at, TAIL.kick, e.amp * LEVEL.kick);
    send(ctx, o, g, WET.kick);
    x.connect(g);
    if (!o.low) {
      const click = strike(ctx, at, 0.012, e.amp * LEVEL.kick * 0.35);
      breath(ctx, o, at, at + 0.03, 3200, 0.7).connect(click);
      send(ctx, o, click, 0);
    }
    duck(o, at);
  },
  // an 80s gated snare: a crack of noise (its body a short falling tone), the room's sound held at
  // half strength for a moment and then shut, as a noise gate on a big reverb shut it in 1985
  snare(ctx, o, e, at) {
    const end = at + TAIL.snare + 0.05;
    const peak = e.amp * LEVEL.snare;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.003);
    g.gain.exponentialRampToValueAtTime(peak * 0.45, at + 0.05);
    g.gain.setValueAtTime(peak * 0.45, at + 0.17);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.21);
    send(ctx, o, panned(ctx, g, -0.08), WET.snare);
    breath(ctx, o, at, end, 1800, 0.7).connect(g);
    if (!o.low) breath(ctx, o, at, end, 5200, 1.1).connect(g);
    const t = osc(ctx, 'triangle', 220, at, at + 0.14);
    t.frequency.setValueAtTime(220, at);
    t.frequency.exponentialRampToValueAtTime(165, at + 0.08);
    const tg = strike(ctx, at, 0.1, peak * 0.7);
    send(ctx, o, tg, WET.snare * 0.5);
    t.connect(tg);
  },
  // a closed hi-hat: a tick of noise above 7 kHz, a little to the right
  hat(ctx, o, e, at) {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = strike(ctx, at, TAIL.hat, e.amp * LEVEL.hat);
    breath(ctx, o, at, at + TAIL.hat + 0.03, 9500, 0.8).connect(hp).connect(g);
    send(ctx, o, panned(ctx, g, 0.22), WET.hat);
  },
  // an open hi-hat: the same noise, ringing a third of a second
  open(ctx, o, e, at) {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000;
    const g = strike(ctx, at, TAIL.open, e.amp * LEVEL.open);
    breath(ctx, o, at, at + TAIL.open + 0.05, 8500, 0.7).connect(hp).connect(g);
    send(ctx, o, panned(ctx, g, 0.22), WET.open);
  },
  // a crash cymbal: two seconds of noise above 4 kHz, ringing into the room, a little to the left
  crash(ctx, o, e, at) {
    const src = ctx.createBufferSource();
    src.buffer = o.long ?? o.n;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(e.amp * LEVEL.crash, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + TAIL.crash);
    src.connect(hp).connect(g);
    send(ctx, o, panned(ctx, g, -0.2), WET.crash);
    src.start(at, (at * 3.7) % 1);
    src.stop(at + TAIL.crash + 0.05);
  },
  // a synth bass: a saw through a resonant low-pass snapping shut, a sine under it, gated short
  // (struck in eighths, the rolling bass of synthwave)
  sbass(ctx, o, e, at, secs) {
    const hz = e.hz[0];
    const gate = Math.min(secs * 0.42, 0.3);
    const end = at + gate + TAIL.sbass + 0.05;
    const g = env(ctx, at, 0.005, gate, TAIL.sbass, e.amp * LEVEL.sbass);
    send(ctx, o, g, WET.sbass, 'sbass');
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 4.5;
    f.frequency.setValueAtTime(Math.min(hz * 16, 3200), at);
    f.frequency.exponentialRampToValueAtTime(Math.max(220, hz * 3.5), at + 0.14);
    f.connect(g);
    osc(ctx, 'sawtooth', hz, at, end).connect(f);
    if (!o.low) {
      const s = ctx.createGain();
      s.gain.value = 0.6;
      osc(ctx, 'sine', hz, at, end).connect(s).connect(g);
    }
  },
  // a stab: the chord struck once on brassy saws whose filter opens and shuts in a quarter of a second
  stab(ctx, o, e, at) {
    const per = (e.amp * LEVEL.stab) / Math.sqrt(e.hz.length);
    const end = at + 0.07 + TAIL.stab + 0.05;
    e.hz.forEach((hz, i) => {
      const g = env(ctx, at, 0.006, 0.06, TAIL.stab, per);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 1.4;
      f.frequency.setValueAtTime(Math.min(hz * 9, 7000), at);
      f.frequency.exponentialRampToValueAtTime(Math.max(200, hz * 2), at + 0.25);
      f.connect(g);
      send(ctx, o, panned(ctx, g, (i - 1) * 0.35), WET.stab, 'stab');
      osc(ctx, 'sawtooth', hz, at, end, -9).connect(f);
      if (!o.low) osc(ctx, 'sawtooth', hz, at, end, 9).connect(f);
    });
  },
  // a tom: a low sine sagging as it dies
  tom(ctx, o, e, at) {
    const hz = Math.max(60, Math.min(130, e.hz[0]));
    const x = osc(ctx, 'sine', hz * 1.25, at, at + TAIL.tom + 0.05);
    x.frequency.setValueAtTime(hz * 1.25, at);
    x.frequency.exponentialRampToValueAtTime(hz, at + 0.25);
    const g = strike(ctx, at, TAIL.tom, e.amp * LEVEL.tom);
    send(ctx, o, g, WET.tom);
    x.connect(g);
  },
  // a shaker: a breath of high noise
  shaker(ctx, o, e, at) {
    const s = breath(ctx, o, at, at + TAIL.shaker + 0.05, 7000, 0.8);
    const g = strike(ctx, at, TAIL.shaker, e.amp * LEVEL.shaker);
    send(ctx, o, panned(ctx, g, 0.3), WET.shaker);
    s.connect(g);
  },
  // the reel's tick: a dry click of filtered noise
  tick(ctx, o, e, at) {
    const s = breath(ctx, o, at, at + 0.06, 3200, 6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(e.amp * LEVEL.tick, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
    send(ctx, o, g, WET.tick);
    s.connect(g);
  },
  // the gravitational waves of two stars spiralling in, their pitch rising as (t_c − t)^(−3/8) and
  // their loudness with it, cut off as they merge (a triangle, so a phone's small speaker gives it voice)
  chirp(ctx, o, e, at, secs) {
    const [hz0, hz1] = [e.hz[0], e.to ?? e.hz[0] * 4];
    const gain = e.amp * LEVEL.chirp;
    const n = 96;
    const f = new Float32Array(n);
    const a = new Float32Array(n);
    const k = 1 - Math.pow(hz0 / hz1, 8 / 3);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      f[i] = hz0 * Math.pow(1 - u * k, -3 / 8);
      a[i] = gain * Math.pow(f[i] / hz1, 2 / 3) * Math.min(1, u * 12);
    }
    const x = osc(ctx, 'triangle', hz0, at, at + secs + TAIL.chirp);
    x.frequency.setValueCurveAtTime(f, at, secs);
    const g = ctx.createGain();
    g.gain.setValueCurveAtTime(a, at, secs);
    g.gain.setValueAtTime(gain, at + secs);
    g.gain.exponentialRampToValueAtTime(0.0001, at + secs + 0.08);
    send(ctx, o, g, WET.chirp);
    x.connect(g);
  },
  // a heartbeat: a sine falling from 70 to 38 Hz and gone in a third of a second
  thump(ctx, o, e, at) {
    const x = osc(ctx, 'sine', 70, at, at + TAIL.thump);
    x.frequency.setValueAtTime(70, at);
    x.frequency.exponentialRampToValueAtTime(38, at + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(e.amp * LEVEL.thump, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.36);
    send(ctx, o, g, WET.thump);
    x.connect(g);
  },
  // a detonation: a deep sine falling away under a burst of noise that darkens as it fades
  boom(ctx, o, e, at) {
    const gain = e.amp * LEVEL.boom;
    const x = osc(ctx, 'sine', 96, at, at + 3.7);
    x.frequency.setValueAtTime(96, at);
    x.frequency.exponentialRampToValueAtTime(24, at + 3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 3.6);
    send(ctx, o, g, WET.boom);
    x.connect(g);
    const src = ctx.createBufferSource();
    src.buffer = o.n;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(5200, at);
    f.frequency.exponentialRampToValueAtTime(140, at + 2.4);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, at);
    ng.gain.exponentialRampToValueAtTime(gain * 0.7, at + 0.01);
    ng.gain.exponentialRampToValueAtTime(0.0001, at + 2.6);
    src.connect(f).connect(ng);
    send(ctx, o, ng, WET.boom);
    src.start(at);
    src.stop(at + 2.7);
  },
  // a rising breath of noise into a moment, over the event's length
  swell(ctx, o, e, at, secs) {
    const src = ctx.createBufferSource();
    src.buffer = o.n;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, at);
    f.frequency.exponentialRampToValueAtTime(2400, at + secs);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(e.amp * LEVEL.swell, at + secs - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, at + secs + 0.6);
    src.connect(f).connect(g);
    send(ctx, o, g, WET.swell);
    src.start(at);
    src.stop(at + secs + TAIL.swell);
  },
};

const PLAY: Record<Instrument, Play> = { ...pads, ...lines };

/** A note of a cue: when it begins (seconds from the cue's start) and what makes it, given the moment the cue starts. */
interface CueNote {
  at: number;
  e: ScoreEvent;
  secs: number;
}

const cues = new Map<string, CueNote[]>();
function cueOf(id: FilmId, fate?: string): CueNote[] {
  const key = `${id}:${fate ?? ''}`;
  let c = cues.get(key);
  if (!c) {
    const s = scoreOf(id, fate);
    const beat = 60 / s.bpm;
    c = compose(s).map((e) => ({ at: e.b * beat, e, secs: e.len * beat }));
    cues.set(key, c);
  }
  return c;
}

function make(ctx: BaseAudioContext, o: Out, x: CueNote, t0: number) {
  PLAY[x.e.v](ctx, o, x.e, t0 + x.at, x.secs);
}

/** A ping-pong echo in time with the beat: the first repeat on the left, the next on the right, each darker and quieter than the last. */
function echoBus(ctx: BaseAudioContext, bus: AudioNode, secs: number): AudioNode {
  const into = ctx.createGain();
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 300;
  const left = ctx.createDelay(2);
  left.delayTime.value = secs;
  const right = ctx.createDelay(2);
  right.delayTime.value = secs;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2600;
  const back = ctx.createGain();
  back.gain.value = 0.42;
  into.connect(hp).connect(left);
  left.connect(right);
  right.connect(lp).connect(back).connect(left);
  const out = ctx.createGain();
  out.gain.value = 0.8;
  for (const [node, pan] of [
    [left, -0.7],
    [right, 0.7],
  ] as const) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    node.connect(p).connect(out);
  }
  out.connect(bus);
  return into;
}

/** The music's way out: a bus, and the room beside it (none at low quality); the lighter instruments below high quality; a synthwave score's pump, echo (none at low quality) and the crash's longer noise. */
function outlet(ctx: BaseAudioContext, out: AudioNode, quality: FilmQuality, s?: Score, at = 0): { bus: GainNode; o: Out } {
  const bus = ctx.createGain();
  bus.gain.value = s?.gain ?? 1;
  bus.connect(out);
  // a score that stops dead (score.ts `silence`): the bus shut at its beat, room and echo with it, and opened again for the title
  if (s?.silence !== undefined) {
    const g = s.gain ?? 1;
    const t0 = at + (s.silence * 60) / s.bpm;
    const t1 = at + (s.titleAt * 60) / s.bpm;
    bus.gain.setValueAtTime(g, Math.max(0, t0 - 0.004));
    bus.gain.linearRampToValueAtTime(0, t0);
    bus.gain.setValueAtTime(0, Math.max(t0, t1 - 0.02));
    bus.gain.linearRampToValueAtTime(g, t1 + 0.6);
  }
  const low = quality !== 'high';
  let wet: AudioNode | null = null;
  if (quality !== 'low') {
    const conv = ctx.createConvolver();
    conv.buffer = room(ctx);
    const back = ctx.createGain();
    back.gain.value = 0.55;
    conv.connect(back).connect(bus);
    wet = conv;
  }
  const o: Out = { dry: bus, wet, n: noise(ctx), low };
  if (s?.pump) {
    const dry = ctx.createGain();
    dry.connect(bus);
    let w: GainNode | null = null;
    if (wet) {
      w = ctx.createGain();
      w.connect(wet);
    }
    o.pump = { dry, wet: w, depth: s.pump };
  }
  if (s?.echo && quality !== 'low') o.echo = echoBus(ctx, bus, (s.echo * 60) / s.bpm);
  if (s?.accent === 'stab' || s?.beat?.some((b) => b.crash)) o.long = noise(ctx, 2.2, 54321);
  return { bus, o };
}

/** How far ahead (seconds) a playing cue's notes are made, and how often it looks. */
const AHEAD = 3;
const EVERY = 250;

/** Play a film's cue into `out` from `at` (on its context's clock): each note made a few seconds before it sounds. */
export function playCue(id: FilmId, ctx: BaseAudioContext, out: AudioNode, at: number, fate?: string, quality: FilmQuality = 'high'): Voice {
  const { bus, o } = outlet(ctx, out, quality, scoreOf(id, fate), at);
  const notes = cueOf(id, fate);
  let next = 0;
  const feed = () => {
    while (next < notes.length && at + notes[next].at <= ctx.currentTime + AHEAD) make(ctx, o, notes[next++], at);
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

/** How many oscillators a cue makes in all, at a quality (the films' browser check counts them as they come). */
export function cueOscillators(id: FilmId, fate?: string, quality: FilmQuality = 'high'): number {
  return cueOf(id, fate).reduce((n, x) => n + oscillatorsOf(x.e, quality !== 'high'), 0);
}

/** A film's cue rendered offline (for the exported video): stereo samples at `rate`, through a compressor as the game's sound is (`only`: these instruments alone, for tools/cue-levels.mjs). */
export async function renderCue(id: FilmId, secs: number, rate = 48000, fate?: string, only?: string[]): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(secs * rate), rate);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3;
  comp.attack.value = 0.02;
  comp.release.value = 0.4;
  comp.connect(ctx.destination);
  const { o } = outlet(ctx, comp, 'high', scoreOf(id, fate));
  for (const x of cueOf(id, fate)) if (!only || only.includes(x.e.v)) make(ctx, o, x, 0);
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
