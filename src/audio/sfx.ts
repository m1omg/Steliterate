import { audio } from './core';

// Interface sounds, all synthesised: relays, radio, old machinery.

export type Sfx = 'click' | 'select' | 'open' | 'endturn' | 'signal' | 'crossing' | 'good' | 'bad' | 'build' | 'warn';

function tone(freq: number, start: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, glideTo?: number) {
  const a = audio()!;
  const o = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.01, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(dest);
  o.start(start);
  o.stop(start + dur + 0.02);
}

function noise(start: number, dur: number, vol: number, dest: AudioNode, filter: BiquadFilterType, freq: number, q = 1, sweepTo?: number) {
  const a = audio()!;
  const src = a.ctx.createBufferSource();
  src.buffer = a.noise;
  src.loopStart = Math.random();
  const f = a.ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, start);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, start + dur);
  f.Q.value = q;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.02, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(start, Math.random());
  src.stop(start + dur + 0.02);
}

let lastClick = 0;

export function sfx(name: Sfx) {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime + 0.005;
  const out = a.sfx;
  const wet = a.ctx.createGain();
  wet.gain.value = 0.35;
  wet.connect(a.reverbIn);
  const send = a.ctx.createGain();
  send.connect(out);
  send.connect(wet);
  switch (name) {
    case 'click':
      if (t - lastClick < 0.03) return;
      lastClick = t;
      noise(t, 0.018, 0.12, out, 'bandpass', 3200, 2);
      tone(1800, t, 0.03, 'square', 0.025, out, 900);
      break;
    case 'select':
      tone(660, t, 0.06, 'triangle', 0.06, send);
      tone(990, t + 0.05, 0.09, 'triangle', 0.05, send);
      break;
    case 'open':
      noise(t, 0.22, 0.05, send, 'bandpass', 600, 1.5, 2400);
      tone(220, t, 0.18, 'sine', 0.05, out, 330);
      break;
    case 'endturn':
      // a heavy relay closing, then the long hum of time passing
      tone(90, t, 0.35, 'sine', 0.35, out, 42);
      noise(t, 0.05, 0.2, out, 'lowpass', 1200);
      noise(t + 0.04, 1.4, 0.07, send, 'bandpass', 300, 3, 2600);
      tone(220, t + 0.1, 1.2, 'sawtooth', 0.02, send, 440);
      break;
    case 'signal': {
      // radio: a burst of static, then three tones
      noise(t, 0.35, 0.05, send, 'bandpass', 1800, 4);
      const n = [880, 1175, 988];
      n.forEach((f, i) => tone(f, t + 0.25 + i * 0.16, 0.12, 'sine', 0.08, send));
      break;
    }
    case 'crossing':
      tone(55, t, 5, 'sine', 0.4, send, 27.5);
      tone(82.4, t + 0.2, 4.5, 'sawtooth', 0.03, send, 41.2);
      noise(t, 4, 0.12, send, 'lowpass', 400, 0.7, 60);
      break;
    case 'good':
    case 'build':
      tone(523, t, 0.12, 'triangle', 0.07, send);
      tone(784, t + 0.09, 0.22, 'triangle', 0.06, send);
      break;
    case 'bad':
      tone(220, t, 0.28, 'sawtooth', 0.05, out, 150);
      tone(233, t, 0.28, 'sawtooth', 0.04, out, 156);
      break;
    case 'warn':
      tone(740, t, 0.12, 'square', 0.03, out);
      tone(740, t + 0.18, 0.12, 'square', 0.03, out);
      break;
  }
  // let the temporary buses be collected once the sound has rung out
  window.setTimeout(() => {
    send.disconnect();
    wet.disconnect();
  }, 6000);
}
