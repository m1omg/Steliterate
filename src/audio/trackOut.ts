import { audio, musicLevel, onVolumes, type AudioCore } from './core';

// How a recording reaches the speakers (15 Oct: the player heard the music stutter, in the films
// and out of them, worst in Firefox). Played through the sound's graph (a MediaElementSource), its
// samples crossed into the graph on the audio thread, resampled, and gave out when the browser was
// busy. Now the audio element plays it itself, through the browser's media pipeline, with buffers
// of its own and decoding on threads of its own; its loudness is the element's volume: the piece's
// level (fading in and out on a timer) times the music's volume. Where a page cannot set an
// element's volume (iOS Safari reads it back as 1), the graph's route stays.

export interface TrackOut {
  /** Fade to `to` (0..1, before the music's volume) over `secs`. */
  fade(to: number, secs: number): void;
  /** Its level now, 0..1 (the checks). */
  readonly level: number;
  /** Which way it goes: by the element itself, or through the sound's graph. */
  readonly route: 'element' | 'graph';
  dispose(): void;
}

let volumeWorks: boolean | null = null;
/** Whether this browser lets a page set an audio element's volume. */
export function elementVolumeWorks(): boolean {
  if (volumeWorks === null) {
    try {
      const a = new Audio();
      a.volume = 0.5;
      volumeWorks = Math.abs(a.volume - 0.5) < 0.01;
    } catch {
      volumeWorks = false;
    }
  }
  return volumeWorks;
}

/** The master's gain, which the graph's route passes through: an element's volume takes it too, so both play as loud. */
const MASTER = 0.9;

interface Ramp {
  from: number;
  to: number;
  t0: number;
  dur: number;
}
const now = () => performance.now();
const valueOf = (r: Ramp) => (r.dur <= 0 ? r.to : r.from + (r.to - r.from) * Math.min(1, Math.max(0, (now() - r.t0) / r.dur)));
const moving = (r: Ramp) => now() < r.t0 + r.dur;

// every recording its element plays, and the hold under a film they all share
const live = new Set<ElementOut>();
let hold: Ramp = { from: 1, to: 1, t0: 0, dur: 0 };
let timer = 0;

function tick() {
  for (const x of live) x.apply();
  if (!moving(hold) && ![...live].some((x) => x.moving())) {
    window.clearInterval(timer);
    timer = 0;
  }
}

/** Set the volumes now, and keep doing so while anything is fading (a timer of 40 ms: fades are seconds long). */
function wake() {
  tick();
  if (!timer && (moving(hold) || [...live].some((x) => x.moving()))) timer = window.setInterval(tick, 40);
}

onVolumes(() => {
  for (const x of live) x.apply();
});

/** Under a film every recording its element plays fades out (in 0.6 s) and back in after (1.2 s), as the graph's duck does. */
export function holdElements(on: boolean) {
  hold = { from: valueOf(hold), to: on ? 0 : 1, t0: now(), dur: on ? 600 : 1200 };
  wake();
}

class ElementOut implements TrackOut {
  readonly route = 'element';
  private r: Ramp = { from: 0, to: 0, t0: 0, dur: 0 };
  constructor(private el: HTMLAudioElement) {
    el.volume = 0;
    live.add(this);
  }
  get level() {
    return valueOf(this.r);
  }
  moving() {
    return moving(this.r);
  }
  fade(to: number, secs: number) {
    this.r = { from: this.level, to, t0: now(), dur: secs * 1000 };
    wake();
  }
  apply() {
    this.el.volume = Math.min(1, Math.max(0, this.level * valueOf(hold) * musicLevel() * MASTER));
  }
  dispose() {
    live.delete(this);
  }
}

class GraphOut implements TrackOut {
  readonly route = 'graph';
  constructor(
    private a: AudioCore,
    private gain: GainNode,
  ) {}
  get level() {
    return this.gain.gain.value;
  }
  fade(to: number, secs: number) {
    const t = this.a.ctx.currentTime;
    const p = this.gain.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(to, t + secs);
  }
  dispose() {
    this.gain.disconnect();
  }
}

/** The way out for a recording's element: its own volume where the browser allows it, else through the sound's graph (null if neither). */
export function trackOut(el: HTMLAudioElement): TrackOut | null {
  if (elementVolumeWorks()) return new ElementOut(el);
  const a = audio();
  if (!a) return null;
  try {
    const src = a.ctx.createMediaElementSource(el);
    const gain = a.ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain).connect(a.music);
    return new GraphOut(a, gain);
  } catch {
    return null;
  }
}
