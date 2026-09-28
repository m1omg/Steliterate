// Shared Web Audio graph. Browsers only allow sound after a user gesture, so the context is
// created on the first pointer or key press. Everything is scheduled on the audio clock,
// which is independent of the display's refresh rate.

export interface AudioCore {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  sfx: GainNode;
  reverb: ConvolverNode;
  reverbIn: GainNode;
  noise: AudioBuffer;
}

let core: AudioCore | null = null;
let volumes = { music: 0.7, sfx: 0.7 };
const listeners: (() => void)[] = [];

export function audio(): AudioCore | null {
  return core;
}

/** Run once audio exists (immediately if it already does). */
export function onAudioReady(fn: () => void) {
  if (core) fn();
  else listeners.push(fn);
}

function impulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // dense early part, darker long tail
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 400 ? i / 400 : 1);
    }
  }
  return buf;
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export function unlockAudio() {
  if (core) {
    if (core.ctx.state === 'suspended') void core.ctx.resume();
    return;
  }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  let ctx: AudioContext;
  try {
    ctx = new Ctor({ latencyHint: 'playback' });
  } catch {
    return;
  }
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3;
  comp.attack.value = 0.02;
  comp.release.value = 0.4;
  master.connect(comp).connect(ctx.destination);
  const music = ctx.createGain();
  const sfx = ctx.createGain();
  music.gain.value = volumes.music * volumes.music;
  sfx.gain.value = volumes.sfx * volumes.sfx;
  music.connect(master);
  sfx.connect(master);
  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 5.5, 3.2);
  const reverbIn = ctx.createGain();
  reverbIn.gain.value = 1;
  const reverbOut = ctx.createGain();
  reverbOut.gain.value = 0.55;
  reverbIn.connect(reverb).connect(reverbOut).connect(master);
  core = { ctx, master, music, sfx, reverb, reverbIn, noise: noiseBuffer(ctx) };
  void ctx.resume();
  for (const fn of listeners.splice(0)) fn();
}

export function setVolumes(music: number, sfx: number) {
  volumes = { music, sfx };
  if (!core) return;
  const t = core.ctx.currentTime;
  // perceptual (squared) volume curve
  core.music.gain.setTargetAtTime(music * music, t, 0.1);
  core.sfx.gain.setTargetAtTime(sfx * sfx, t, 0.05);
}

export function installUnlock() {
  const go = () => {
    unlockAudio();
    window.removeEventListener('pointerdown', go);
    window.removeEventListener('keydown', go);
  };
  window.addEventListener('pointerdown', go);
  window.addEventListener('keydown', go);
}

export function midiHz(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}
