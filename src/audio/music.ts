import type { EraId } from '../game/types';
import { audio, midiHz, onAudioReady } from './core';

// Procedural score. Dusk is worn synthwave over a dark-ambient bed; each age strips a layer away
// until the Dark Era is a drone and the occasional distant tone. Notes are scheduled ahead on
// the audio clock by a lookahead timer, so tempo never depends on the display.

export type Mood = 'menu' | 'calm' | 'tension' | 'outcome';

interface Style {
  bpm: number;
  root: number; // midi note of the tonic
  scale: number[];
  prog: number[]; // chord roots as scale degrees
  chordBars: number;
  pad: { type: OscillatorType; cutoff: number; detune: number; vol: number } | null;
  arp: { type: OscillatorType; vol: number; cutoff: number; every: number; pattern: number[]; octave: number; prob: number } | null;
  bass: { vol: number; pattern: number[] } | null;
  drums: { vol: number; kick: number[]; snare: number[]; hat: number[] } | null;
  drone: { vol: number; notes: number[]; cutoff: number } | null;
  bells: { vol: number; prob: number } | null;
  boomEvery: number; // bars, 0 = never
  crackle: number; // grains per second
  hiss: number;
}

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];

const x16 = (s: string) => s.split('').map((c) => (c === 'x' ? 1 : c === 'o' ? 0.55 : 0));

const STYLES: Record<EraId | 'menu' | 'outcome', Style> = {
  menu: {
    bpm: 74,
    root: 57,
    scale: MINOR,
    prog: [0, 5, 2, 6],
    chordBars: 2,
    pad: { type: 'sawtooth', cutoff: 1100, detune: 9, vol: 0.05 },
    arp: { type: 'square', vol: 0.03, cutoff: 1400, every: 2, pattern: [0, 1, 2, 3, 2, 1, 2, 4], octave: 1, prob: 0.85 },
    bass: { vol: 0.09, pattern: x16('x.......x.......') },
    drums: null,
    drone: { vol: 0.03, notes: [-24, -17], cutoff: 400 },
    bells: null,
    boomEvery: 0,
    crackle: 0.2,
    hiss: 0.001,
  },
  dusk: {
    bpm: 84,
    root: 50,
    scale: DORIAN,
    prog: [0, 5, 3, 4],
    chordBars: 2,
    pad: { type: 'sawtooth', cutoff: 1300, detune: 11, vol: 0.045 },
    arp: { type: 'sawtooth', vol: 0.026, cutoff: 1800, every: 1, pattern: [0, 2, 1, 3, 0, 2, 4, 3], octave: 2, prob: 0.9 },
    bass: { vol: 0.1, pattern: x16('x.x.x.x.x.x.x.xo') },
    drums: { vol: 0.8, kick: x16('x.......x.......'), snare: x16('....x.......x...'), hat: x16('..x...x...x...xo') },
    drone: { vol: 0.03, notes: [-24, -12], cutoff: 500 },
    bells: null,
    boomEvery: 0,
    crackle: 0.25,
    hiss: 0.001,
  },
  degenerate: {
    bpm: 64,
    root: 52,
    scale: [0, 2, 3, 7, 9, 10, 14],
    prog: [0, 3, 5, 1],
    chordBars: 4,
    pad: { type: 'triangle', cutoff: 2600, detune: 5, vol: 0.05 },
    arp: { type: 'sine', vol: 0.05, cutoff: 5000, every: 4, pattern: [4, 2, 5, 1, 3, 0], octave: 2, prob: 0.45 },
    bass: null,
    drums: null,
    drone: { vol: 0.04, notes: [-24, -17, -12], cutoff: 700 },
    bells: { vol: 0.05, prob: 0.35 },
    boomEvery: 0,
    crackle: 0.12,
    hiss: 0.0006,
  },
  blackhole: {
    bpm: 50,
    root: 49,
    scale: PHRYGIAN,
    prog: [0, 1, 0, 6],
    chordBars: 4,
    pad: { type: 'sawtooth', cutoff: 380, detune: 14, vol: 0.05 },
    arp: null,
    bass: null,
    drums: null,
    drone: { vol: 0.07, notes: [-36, -24, -17], cutoff: 260 },
    bells: { vol: 0.045, prob: 0.25 },
    boomEvery: 8,
    crackle: 1.0,
    hiss: 0.0005,
  },
  dark: {
    bpm: 40,
    root: 45,
    scale: MINOR,
    prog: [0],
    chordBars: 8,
    pad: null,
    arp: null,
    bass: null,
    drums: null,
    drone: { vol: 0.035, notes: [-24, -5], cutoff: 180 },
    bells: { vol: 0.03, prob: 0.1 },
    boomEvery: 0,
    crackle: 0.06,
    hiss: 0,
  },
  outcome: {
    bpm: 56,
    root: 50,
    scale: [0, 2, 4, 5, 7, 9, 11],
    prog: [3, 0, 4, 5],
    chordBars: 4,
    pad: { type: 'sawtooth', cutoff: 1500, detune: 8, vol: 0.05 },
    arp: { type: 'triangle', vol: 0.03, cutoff: 3000, every: 4, pattern: [0, 1, 2, 4], octave: 2, prob: 0.6 },
    bass: null,
    drums: null,
    drone: { vol: 0.03, notes: [-24], cutoff: 400 },
    bells: { vol: 0.03, prob: 0.2 },
    boomEvery: 0,
    crackle: 0.08,
    hiss: 0.0005,
  },
};

interface Layer {
  style: Style;
  bus: GainNode;
  arpIn: GainNode;
  wobble: GainNode; // tape wobble, in cents, fed to every oscillator
  persistent: AudioScheduledSourceNode[];
  silenced: boolean; // a recorded track is playing instead
  track: { el: HTMLAudioElement; gain: GainNode } | null;
  hiss: GainNode | null; // the synth's tape hiss: part of the synth, so it goes when a recording plays
  hushAt: number; // audio-clock time at which the fading synth stops scheduling notes (0 = none)
  synthUntil: number; // audio-clock time at which a synthesized piece gives way to the next (0 = none)
  onSynthEnd: (() => void) | null;
  intro: boolean; // the overture is playing
}

type StyleKey = keyof typeof STYLES;
/** Everything that can be playing: a style, or the Canon on its own. */
export type TrackKey = StyleKey | 'canon';

/** Tracks the player can pick by hand (Settings); null = automatic, following the age and the moment. */
export const TRACK_CHOICES: { key: TrackKey; name: string }[] = [
  { key: 'menu', name: 'Title' },
  { key: 'dusk', name: 'The Long Dusk' },
  { key: 'canon', name: 'Canon in D (the Degenerate Age’s overture)' },
  { key: 'degenerate', name: 'The Degenerate Age' },
  { key: 'blackhole', name: 'The Black Hole Age' },
  { key: 'dark', name: 'The Dark' },
  { key: 'outcome', name: 'The Ending' },
];

/** One piece an age can play: a recorded track (generated instrumental), or, with no file, the synthesized score. */
export interface Piece {
  id: string;
  name: string;
  url?: string;
}

// What each age can play, in order. The player chooses which (Settings → Playlist); the chosen
// ones take turns, each fading across to the next, and a lone one loops. By default the
// recordings play and the synthesized score stands by for any that will not load.
export const PIECES: Record<TrackKey, Piece[]> = {
  menu: [{ id: 'title', name: 'Recorded', url: 'music/title.mp3' }, { id: 'menu.synth', name: 'Synthesized' }],
  dusk: [{ id: 'dusk', name: 'Recorded I', url: 'music/dusk.mp3' }, { id: 'dusk2', name: 'Recorded II', url: 'music/dusk2.mp3' }, { id: 'dusk.synth', name: 'Synthesized' }],
  canon: [{ id: 'canon', name: 'Arranged', url: 'music/canon.mp3' }],
  degenerate: [{ id: 'degenerate', name: 'Recorded I', url: 'music/degenerate.mp3' }, { id: 'degenerate2', name: 'Recorded II', url: 'music/degenerate2.mp3' }, { id: 'degenerate.synth', name: 'Synthesized' }],
  blackhole: [{ id: 'blackhole', name: 'Recorded I', url: 'music/blackhole.mp3' }, { id: 'blackhole2', name: 'Recorded II', url: 'music/blackhole2.mp3' }, { id: 'blackhole.synth', name: 'Synthesized' }],
  dark: [{ id: 'dark', name: 'Recorded', url: 'music/dark.mp3' }, { id: 'dark.synth', name: 'Synthesized' }],
  outcome: [{ id: 'outcome', name: 'Recorded', url: 'music/outcome.mp3' }, { id: 'outcome.synth', name: 'Synthesized' }],
};

/** Whether the player has a piece in its age's rotation (recordings are in unless taken out). */
export function pieceOn(prefs: Record<string, boolean> | undefined, p: Piece): boolean {
  return prefs?.[p.id] ?? !!p.url;
}

/** How loud a recorded track plays (mastered tracks are much louder than the synth). */
const TRACK_GAIN = 0.5;
/** Seconds over which one track of an age fades out before the next begins. */
const TRACK_CHANGE = 4;
/** Seconds a synthesized piece plays before the next piece of its age, about a recording's length. */
const SYNTH_SPAN = 170;

// Played once, before a style's own track, the first time that style comes up in a session.
// The Degenerate Age opens with Pachelbel's Canon in D (public domain), arranged for the game:
// see tools/music/canon.py.
const INTROS: Partial<Record<StyleKey, string>> = {
  degenerate: 'music/canon.mp3',
};

class Music {
  private layer: Layer | null = null;
  private layerKey: TrackKey | null = null;
  private override: TrackKey | null = null;
  private introsPlayed = new Set<StyleKey>();
  private prefs: Record<string, boolean> = {};
  private overture = true;
  private era: EraId = 'dusk';
  private mood: Mood = 'menu';
  private step = 0;
  private next = 0;
  private started = false;

  start() {
    if (this.started) return;
    this.started = true;
    onAudioReady(() => {
      this.apply();
      window.setInterval(() => this.tick(), 40);
      document.addEventListener('visibilitychange', () => {
        const a = audio();
        if (!a) return;
        if (document.hidden) void a.ctx.suspend();
        else void a.ctx.resume();
      });
    });
  }

  setEra(era: EraId) {
    if (era === this.era && this.mood !== 'menu' && this.mood !== 'outcome') return;
    this.era = era;
    if (this.mood === 'menu' || this.mood === 'outcome') this.mood = 'calm';
    this.apply();
  }

  setMood(mood: Mood) {
    if (mood === this.mood) return;
    const was = this.styleKey();
    this.mood = mood;
    if (this.styleKey() !== was) this.apply();
  }

  /** Play one track by hand until set back to null (automatic). */
  setTrack(key: TrackKey | null) {
    this.override = key;
    this.apply();
  }

  /** The track playing (or about to): the chosen one, or the one the age and the moment call for. */
  current(): TrackKey {
    return this.styleKey();
  }

  get chosen(): TrackKey | null {
    return this.override;
  }

  /**
   * The player's playlist: which pieces each age plays (piece id → on; see pieceOn) and whether
   * the Canon opens the Degenerate Age. What is playing changes at once if it is affected.
   */
  setPlaylist(prefs: Record<string, boolean>, overture: boolean) {
    const key = this.styleKey();
    const before = this.rotation(key).map((p) => p.id).join();
    const cutIntro = this.layer?.intro && this.overture && !overture;
    this.prefs = { ...prefs };
    this.overture = overture;
    if (this.layer && (cutIntro || this.rotation(key).map((p) => p.id).join() !== before)) {
      this.layerKey = null;
      this.apply();
    }
  }

  /** The pieces a style plays in turn: the chosen ones, or the synthesized score if none is chosen. */
  private rotation(key: TrackKey): Piece[] {
    const all = PIECES[key];
    const on = all.filter((p) => pieceOn(this.prefs, p));
    return on.length ? on : [all.find((p) => !p.url) ?? all[0]];
  }

  private styleKey(): TrackKey {
    if (this.override) return this.override;
    if (this.mood === 'menu') return 'menu';
    if (this.mood === 'outcome') return 'outcome';
    return this.era;
  }

  /** Crossfade to the style for the current era and mood. */
  private apply() {
    const a = audio();
    if (!a) return;
    const key = this.styleKey();
    const style = STYLES[key === 'canon' ? 'degenerate' : key];
    if (this.layer && this.layerKey === key) return;
    this.layerKey = key;
    const t = a.ctx.currentTime;
    const old = this.layer;
    if (old) {
      old.bus.gain.cancelScheduledValues(t);
      old.bus.gain.setValueAtTime(old.bus.gain.value, t);
      old.bus.gain.linearRampToValueAtTime(0, t + 3.5);
      for (const n of old.persistent) n.stop(t + 3.6);
      const tr = old.track;
      if (tr) {
        tr.gain.gain.cancelScheduledValues(t);
        tr.gain.gain.setValueAtTime(tr.gain.gain.value, t);
        tr.gain.gain.linearRampToValueAtTime(0, t + 3.5);
      }
      window.setTimeout(() => {
        old.bus.disconnect();
        if (tr) {
          tr.el.pause();
          tr.gain.disconnect();
        }
      }, 5000);
    }
    const bus = a.ctx.createGain();
    bus.gain.setValueAtTime(0, t);
    bus.gain.linearRampToValueAtTime(1, t + 3);
    bus.connect(a.music);
    const send = a.ctx.createGain();
    send.gain.value = 0.6;
    bus.connect(send).connect(a.reverbIn);

    // arp bus: dry plus a dark dotted-eighth echo
    const arpIn = a.ctx.createGain();
    arpIn.connect(bus);
    const delay = a.ctx.createDelay(2);
    delay.delayTime.value = (60 / style.bpm) * 0.75;
    const fb = a.ctx.createGain();
    fb.gain.value = 0.38;
    const tone = a.ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2200;
    arpIn.connect(delay).connect(tone).connect(fb).connect(delay);
    const echo = a.ctx.createGain();
    echo.gain.value = 0.5;
    tone.connect(echo).connect(bus);

    // tape wobble
    const lfo = a.ctx.createOscillator();
    lfo.frequency.value = 0.27;
    const wobble = a.ctx.createGain();
    wobble.gain.value = 7;
    lfo.connect(wobble);
    lfo.start(t);
    const persistent: AudioScheduledSourceNode[] = [lfo];

    // drone
    if (style.drone) {
      const f = a.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = style.drone.cutoff;
      f.Q.value = 2;
      const g = a.ctx.createGain();
      g.gain.value = style.drone.vol;
      f.connect(g).connect(bus);
      const flfo = a.ctx.createOscillator();
      flfo.frequency.value = 0.041;
      const fdepth = a.ctx.createGain();
      fdepth.gain.value = style.drone.cutoff * 0.5;
      flfo.connect(fdepth).connect(f.frequency);
      flfo.start(t);
      persistent.push(flfo);
      for (const n of style.drone.notes) {
        for (const det of [-4, 5]) {
          const o = a.ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = midiHz(style.root + n);
          o.detune.value = det;
          wobble.connect(o.detune);
          o.connect(f);
          o.start(t);
          persistent.push(o);
        }
      }
    }
    // tape hiss
    let hissOut: GainNode | null = null;
    if (style.hiss > 0) {
      const src = a.ctx.createBufferSource();
      src.buffer = a.noise;
      src.loop = true;
      const hp = a.ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 3500;
      hp.Q.value = 0.4;
      const g = a.ctx.createGain();
      g.gain.value = style.hiss;
      hissOut = a.ctx.createGain();
      src.connect(hp).connect(g).connect(hissOut).connect(a.music);
      src.start(t);
      persistent.push(src);
    }
    const layer: Layer = { style, bus, arpIn, wobble, persistent, silenced: false, track: null, hiss: hissOut, hushAt: 0, synthUntil: 0, onSynthEnd: null, intro: false };
    this.layer = layer;
    this.step = 0;
    this.next = t + 0.1;
    this.startTrack(layer, this.styleKey());
  }

  /**
   * Play the style's pieces in turn, after the overture if one is due. A recording fades in as it
   * starts and hushes the synth under it; a synthesized piece brings the synth back for
   * SYNTH_SPAN seconds (for good, if it is the only piece). A lone recording loops.
   */
  private startTrack(layer: Layer, key: TrackKey) {
    const a = audio();
    if (!a) return;
    const list = this.rotation(key);
    // the overture comes once, on its own, when the age begins (not when a track is picked by hand)
    const overture = INTROS[key as StyleKey];
    const intro = !this.override && key !== 'canon' && this.overture && overture && !this.introsPlayed.has(key as StyleKey) ? overture : null;
    // nothing recorded to play: the synthesized score, as it is
    if (!intro && !list.some((p) => p.url)) return;
    if (intro) this.introsPlayed.add(key as StyleKey);
    const el = new Audio();
    el.preload = 'auto';
    let src: MediaElementAudioSourceNode;
    try {
      src = a.ctx.createMediaElementSource(el);
    } catch {
      return;
    }
    const gain = a.ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain).connect(a.music);
    layer.track = { el, gain };
    let idx = 0;
    let fails = 0;
    let fading = false;
    const ramp = (p: AudioParam, to: number, s: number) => {
      const t = a.ctx.currentTime;
      p.cancelScheduledValues(t);
      p.setValueAtTime(p.value, t);
      p.linearRampToValueAtTime(to, t + s);
    };
    // the synth comes back for a synthesized piece, or when nothing recorded will play
    const wakeSynth = (span: number) => {
      el.pause();
      ramp(gain.gain, 0, 0.5);
      if (layer.silenced) {
        layer.silenced = false;
        this.next = a.ctx.currentTime + 0.05;
      }
      layer.hushAt = 0;
      ramp(layer.bus.gain, 1, 3);
      if (layer.hiss) ramp(layer.hiss.gain, 1, 3);
      layer.synthUntil = span > 0 ? a.ctx.currentTime + span : 0;
    };
    const play = (p: Piece) => {
      if (!p.url) return wakeSynth(list.length > 1 ? SYNTH_SPAN : 0);
      layer.synthUntil = 0;
      el.src = p.url;
      el.loop = list.length === 1;
      el.play().catch(() => {});
    };
    const advance = () => {
      if (this.layer !== layer) return;
      if (layer.intro) layer.intro = false;
      else idx = (idx + 1) % list.length;
      play(list[idx]);
    };
    layer.onSynthEnd = advance;
    el.addEventListener('ended', advance);
    // a missing or broken file: the next piece, once round at most, and then the synth
    el.addEventListener('error', () => {
      if (this.layer !== layer) return;
      if (layer.intro || ++fails < list.length) advance();
      else wakeSynth(0);
    });
    // each recording fades in as it starts, and the synth fades out under it
    el.addEventListener('playing', () => {
      if (this.layer !== layer) return;
      fails = 0;
      fading = false;
      ramp(gain.gain, TRACK_GAIN, 3);
      if (!layer.silenced && !layer.hushAt) {
        ramp(layer.bus.gain, 0, 3);
        if (layer.hiss) ramp(layer.hiss.gain, 0, 3);
        layer.hushAt = a.ctx.currentTime + 3.2;
      }
    });
    // where another piece follows, a recording fades out over its last seconds (on the audio clock)
    el.addEventListener('timeupdate', () => {
      if (this.layer !== layer || fading || el.loop || layer.intro || !isFinite(el.duration)) return;
      const left = el.duration - el.currentTime;
      if (left > TRACK_CHANGE) return;
      fading = true;
      ramp(gain.gain, 0, Math.max(0.3, left));
    });
    if (intro) {
      layer.intro = true;
      el.src = intro;
      el.play().catch(() => {});
    } else play(list[0]);
  }

  private tick() {
    const a = audio();
    const L = this.layer;
    if (!a || !L) return;
    const now = a.ctx.currentTime;
    // the synth's fade under a recording is done: stop scheduling its notes
    if (L.hushAt && now >= L.hushAt) {
      L.hushAt = 0;
      L.silenced = true;
    }
    // a synthesized piece has had its turn
    if (L.synthUntil && now >= L.synthUntil) {
      L.synthUntil = 0;
      L.onSynthEnd?.();
    }
    if (L.silenced) return;
    if (this.next < now - 0.2) this.next = now + 0.05; // fell behind (tab was asleep): skip, don't burst
    const stepDur = 60 / L.style.bpm / 4;
    while (this.next < now + 0.3) {
      this.play(L, this.step, this.next, stepDur);
      this.next += stepDur;
      this.step++;
    }
  }

  private chordTones(st: Style, degree: number): number[] {
    const n = st.scale.length;
    const out: number[] = [];
    for (let k = 0; k < 5; k++) {
      const d = degree + k * 2;
      out.push(st.root + st.scale[d % n] + 12 * Math.floor(d / n));
    }
    return out; // root, third, fifth, seventh, ninth
  }

  private play(L: Layer, step: number, t: number, sd: number) {
    const st = L.style;
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const chordIdx = Math.floor(bar / st.chordBars) % st.prog.length;
    const chord = this.chordTones(st, st.prog[chordIdx]);
    const barDur = sd * 16;

    if (s === 0 && bar % st.chordBars === 0 && st.pad) this.pad(L, chord, t, barDur * st.chordBars);

    if (st.arp) {
      const ar = st.arp;
      const prob = this.mood === 'tension' ? Math.min(1, ar.prob + 0.1) : ar.prob;
      if (s % ar.every === 0 && Math.random() < prob) {
        const i = Math.floor(step / ar.every) % ar.pattern.length;
        const note = chord[ar.pattern[i] % chord.length] + 12 * (ar.octave - 1);
        this.pluck(L, note, t, sd * ar.every * 0.9, ar);
      }
    }

    if (st.bass && st.bass.pattern[s]) this.bass(L, chord[0] - 12, t, sd * 1.6, st.bass.vol * st.bass.pattern[s]);

    if (st.drums) {
      // drums come and go in sections; tension keeps them in
      const on = this.mood === 'tension' || bar % 24 >= 8;
      if (on) {
        const d = st.drums;
        if (d.kick[s]) this.kick(L, t, d.vol * d.kick[s]);
        if (d.snare[s]) this.snare(L, t, d.vol * d.snare[s]);
        if (d.hat[s]) this.hat(L, t, d.vol * d.hat[s] * (this.mood === 'tension' ? 1.2 : 0.8));
      }
    }

    if (st.bells && (s === 0 || s === 8) && Math.random() < st.bells.prob * 0.5) {
      const pick = chord[Math.floor(Math.random() * chord.length)] + 12;
      this.bell(L, pick, t, st.bells.vol);
    }

    if (st.boomEvery && s === 0 && bar % st.boomEvery === 0) this.boom(L, t);

    if (st.crackle > 0 && Math.random() < st.crackle * sd) this.grain(L, t + Math.random() * sd);
  }

  private osc(L: Layer, type: OscillatorType, hz: number, det: number, t: number, end: number, dest: AudioNode) {
    const a = audio()!;
    const o = a.ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    o.detune.value = det;
    L.wobble.connect(o.detune);
    o.connect(dest);
    o.start(t);
    o.stop(end);
    o.onended = () => L.wobble.disconnect(o.detune);
    return o;
  }

  private pad(L: Layer, chord: number[], t: number, dur: number) {
    const a = audio()!;
    const p = L.style.pad!;
    const f = a.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 0.7;
    f.frequency.setValueAtTime(p.cutoff * 0.35, t);
    f.frequency.linearRampToValueAtTime(p.cutoff, t + dur * 0.45);
    f.frequency.linearRampToValueAtTime(p.cutoff * 0.5, t + dur + 1.5);
    const g = a.ctx.createGain();
    const atk = Math.min(1.6, dur * 0.3);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(p.vol, t + atk);
    g.gain.setValueAtTime(p.vol, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 1.8);
    f.connect(g).connect(L.bus);
    const notes = [chord[0] - 12, chord[0], chord[1], chord[2], chord[3]];
    const end = t + dur + 2;
    notes.forEach((n, i) => {
      const pan = a.ctx.createStereoPanner();
      pan.pan.value = ((i % 2) * 2 - 1) * 0.35;
      pan.connect(f);
      this.osc(L, p.type, midiHz(n), -p.detune, t, end, pan);
      this.osc(L, p.type, midiHz(n), p.detune, t, end, pan);
    });
  }

  private pluck(L: Layer, note: number, t: number, dur: number, ar: NonNullable<Style['arp']>) {
    const a = audio()!;
    const f = a.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 4;
    f.frequency.setValueAtTime(ar.cutoff * 3, t);
    f.frequency.exponentialRampToValueAtTime(ar.cutoff * 0.6, t + 0.18);
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(ar.vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.12, dur * 1.4));
    const pan = a.ctx.createStereoPanner();
    pan.pan.value = Math.sin(t * 1.3) * 0.5;
    f.connect(g).connect(pan).connect(L.arpIn);
    this.osc(L, ar.type, midiHz(note), 0, t, t + dur * 1.5 + 0.05, f);
  }

  private bass(L: Layer, note: number, t: number, dur: number, vol: number) {
    const a = audio()!;
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = a.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(160, t + dur);
    f.connect(g).connect(L.bus);
    this.osc(L, 'sawtooth', midiHz(note), 0, t, t + dur + 0.05, f);
    this.osc(L, 'sine', midiHz(note - 12), 0, t, t + dur + 0.05, g);
  }

  private kick(L: Layer, t: number, vol: number) {
    const a = audio()!;
    const o = a.ctx.createOscillator();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32 * vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(L.bus);
    o.start(t);
    o.stop(t + 0.45);
  }

  private noiseHit(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, dest: AudioNode) {
    const a = audio()!;
    const src = a.ctx.createBufferSource();
    src.buffer = a.noise;
    const f = a.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
  }

  private snare(L: Layer, t: number, vol: number) {
    const a = audio()!;
    // big gated-room snare, run through extra reverb
    const wet = a.ctx.createGain();
    wet.gain.value = 1.3;
    wet.connect(a.reverbIn);
    this.noiseHit(t, 0.22, 0.12 * vol, 'bandpass', 1900, L.bus);
    this.noiseHit(t, 0.22, 0.12 * vol, 'bandpass', 1900, wet);
    const o = a.ctx.createOscillator();
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07 * vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(L.bus);
    o.start(t);
    o.stop(t + 0.14);
    window.setTimeout(() => wet.disconnect(), 8000);
  }

  private hat(L: Layer, t: number, vol: number) {
    this.noiseHit(t, 0.05, 0.035 * vol, 'highpass', 7500, L.bus);
  }

  private bell(L: Layer, note: number, t: number, vol: number) {
    const a = audio()!;
    const hz = midiHz(note);
    const car = a.ctx.createOscillator();
    car.frequency.value = hz;
    const mod = a.ctx.createOscillator();
    mod.frequency.value = hz * 3.51;
    const idx = a.ctx.createGain();
    idx.gain.setValueAtTime(hz * 2.2, t);
    idx.gain.exponentialRampToValueAtTime(hz * 0.05, t + 2.5);
    mod.connect(idx).connect(car.frequency);
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 6);
    const pan = a.ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.2 - 0.6;
    car.connect(g).connect(pan).connect(L.bus);
    car.start(t);
    mod.start(t);
    car.stop(t + 6.1);
    mod.stop(t + 6.1);
  }

  private boom(L: Layer, t: number) {
    const a = audio()!;
    const o = a.ctx.createOscillator();
    o.frequency.setValueAtTime(48, t);
    o.frequency.exponentialRampToValueAtTime(26, t + 4);
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5);
    o.connect(g).connect(L.bus);
    o.start(t);
    o.stop(t + 5.1);
  }

  private grain(L: Layer, t: number) {
    const a = audio()!;
    const pan = a.ctx.createStereoPanner();
    pan.pan.value = Math.random() * 2 - 1;
    pan.connect(L.bus);
    this.noiseHit(t, 0.002 + Math.random() * 0.01, 0.02 + Math.random() * 0.03, 'highpass', 2000 + Math.random() * 5000, pan);
  }
}

export const music = new Music();
