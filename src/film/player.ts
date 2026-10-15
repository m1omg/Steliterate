import { grainOffset, grainTile256 } from './draw';
import { FILMS, filmLength, type FilmArgs, type FilmId, type FilmQuality, type FilmScene, type FilmText } from './films';
import type { PaintJob, PaintReply } from './paintWorker';
import { unpack } from './transfer';

// Plays a film (part 4) on one full-screen 2D canvas, with its words as real text over it. The
// film's time comes from the audio clock while its cue plays (so the cuts keep time with the
// sound), else from elapsed time; every frame is drawn from that time alone, never from a frame
// count. `exportFrame` draws any moment exactly, for tools/film-render.mjs.
//
// On a tablet (15 Oct) a film stopped for a second or two whenever a scene began, its pictures
// being painted then. Played in the game (`painter`), its pictures are painted in a thread of their
// own (paintWorker.ts), in the order the film needs them, while the page draws; the film begins once
// its first scene's are there (`ready`). Where that thread cannot run, the page paints them as
// before. And a device that cannot keep up draws the frame with fewer pixels, a step at a time.
//
// In the game (`pageOverlays`) the vignette and the grain are layers of the page over the canvas,
// put together by the browser's compositor for nothing where it composes on the graphics chip,
// instead of two passes over every pixel of every frame (16 ms a frame at 1920×1080 where the
// canvas is drawn without the chip, as Firefox may draw it: 15 Oct). Where the compositor works
// without the chip too, each layer costs more than its pass did: so a device whose frames come
// slowly tries them in the canvas for half a second, and keeps whichever came quicker. The exported
// videos and the checks' frames keep them in the canvas.

export interface FilmClock {
  /** Seconds of film shown at the page's time `at` (ms, on performance.now's clock: the frame's own time; now if not given). */
  now(at?: number): number;
}

/** Whether pictures can be painted in a thread of their own here (a worker with canvases off the page). */
const canPaintApart = () => typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined';

let jobs = 0;

/** A painter thread (paintWorker.ts). */
const newPainter = () => new Worker(new URL('./paintWorker.ts', import.meta.url), { type: 'module' });

/** The painter's first answer to a job (the checks: a film it cannot lay out is answered `failed`, so the page paints it itself). */
export function askPainter(job: PaintJob): Promise<PaintReply | null> {
  return new Promise((done) => {
    if (!canPaintApart()) return done(null);
    const w = newPainter();
    const end = (r: PaintReply | null) => {
      w.terminate();
      done(r);
    };
    w.onmessage = (e: MessageEvent<PaintReply>) => end(e.data);
    w.onerror = () => end(null);
    setTimeout(() => end(null), 10000);
    w.postMessage(job);
  });
}

export class FilmPlayer {
  /** The last frames played, as [film time (s), the page's time (ms)] (the checks: film time moves with the page's, frame by frame). */
  static times: [number, number][] = [];
  /** The last trial of where the vignette and grain go (the checks): the frames' gaps (ms) each way, and the way kept. */
  static overlayTrial: { page: number; canvas: number; kept: 'page' | 'canvas' } | null = null;
  readonly canvas: HTMLCanvasElement;
  readonly layer: HTMLDivElement;
  readonly length: number;
  /** Resolves once the first scene's pictures are painted: the film can begin. */
  readonly ready: Promise<void>;
  /** Resolves once the painter thread has sent all it can (at once without one), and how many pictures it sent (the checks). */
  readonly painted: Promise<void>;
  sent = 0;
  private allSent: () => void = () => {};
  private c: CanvasRenderingContext2D;
  private scene: FilmScene;
  private texts = new Map<string, HTMLDivElement>();
  private raf = 0;
  private done = false;
  private worker: Worker | null = null;
  /** The painter thread is doing the painting (else the page warms its pictures itself). */
  private apart = false;
  private w: number;
  private h: number;
  /** The grain laid over the frame by the page, and where its tile was last put. */
  private grainEl: HTMLDivElement | null = null;
  private vignetteEl: HTMLDivElement | null = null;
  private grainAt = '';
  /** The scene's args (where the vignette and grain go is read from them as each frame is drawn). */
  private args: FilmArgs;
  /** The trial of the overlays: not yet, under way (with the gap the page's layers gave), or over. */
  private trial: { state: 'ready' | 'trying' | 'over'; page: number } = { state: 'over', page: 0 };
  /** (the grain holds still where the system asks for less motion) */
  private still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** Device pixels per CSS pixel the frame is drawn at now, and the least it may come down to. */
  private pr: number;
  private minPr: number;

  constructor(
    host: HTMLElement,
    readonly id: FilmId,
    private opts: { quality: FilmQuality; args?: FilmArgs; width?: number; height?: number; pixelRatio?: number; onEnd?: () => void; painter?: boolean; pageOverlays?: boolean },
  ) {
    const def = FILMS[id];
    this.length = filmLength(def);
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'film-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.layer = document.createElement('div');
    this.layer.className = 'film-text';
    const w = (this.w = opts.width ?? host.clientWidth ?? window.innerWidth);
    const h = (this.h = opts.height ?? host.clientHeight ?? window.innerHeight);
    host.append(this.canvas);
    if (opts.pageOverlays) {
      // the lens's vignette (as draw.ts's: clear to 0.35 of the smaller side, 0.62 dark at 0.6 of the diagonal)
      const vig = document.createElement('div');
      vig.className = 'film-vignette';
      vig.setAttribute('aria-hidden', 'true');
      vig.style.background = `radial-gradient(circle at 50% 50%, rgba(0,0,0,0) ${(Math.min(w, h) * 0.35).toFixed(1)}px, rgba(0,0,0,0.62) ${(Math.hypot(w, h) * 0.6).toFixed(1)}px)`;
      // the grain: the same tile, blended as overlay at the same strength
      const k = opts.quality === 'low' ? 0.45 : opts.quality === 'medium' ? 0.7 : 1;
      const gr = document.createElement('div');
      gr.className = 'film-grain';
      gr.setAttribute('aria-hidden', 'true');
      gr.style.backgroundImage = `url(${grainTile256().toDataURL()})`;
      gr.style.opacity = String(0.12 * k + 0.04);
      this.grainEl = gr;
      this.vignetteEl = vig;
      host.append(vig, gr);
    }
    host.append(this.layer);
    // fewer pixels on Medium and Low, as the game's own view draws
    const pr = opts.pixelRatio ?? Math.min(window.devicePixelRatio || 1, opts.quality === 'high' ? 2 : opts.quality === 'medium' ? 1.25 : 1);
    this.pr = pr;
    this.minPr = Math.min(pr, 0.5);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.c = this.canvas.getContext('2d')!;
    this.resize(pr);
    const args = (this.args = { ...opts.args, pr, pageOverlays: !!opts.pageOverlays, stillGrain: opts.args?.stillGrain ?? (!!opts.pageOverlays && this.still) });
    if (opts.pageOverlays) this.trial.state = 'ready';
    this.apart = !!opts.painter && canPaintApart();
    this.scene = def.setup(w, h, opts.quality, args, !this.apart);
    this.painted = new Promise<void>((r) => (this.allSent = r));
    this.ready = this.apart ? this.paintApart(args) : Promise.resolve();
    if (!this.apart) this.allSent();
  }

  /** Draw the moment `t` (seconds), the picture and the words over it. */
  frame(t: number) {
    const tt = Math.max(0, Math.min(this.length, t));
    this.scene.draw(this.c, tt);
    this.setText(this.scene.text(tt));
    if (this.grainEl && !(this.still && this.grainAt)) {
      const [ox, oy] = grainOffset(tt);
      const at = `${-ox}px ${-oy}px`;
      if (at !== this.grainAt) {
        this.grainAt = at;
        this.grainEl.style.backgroundPosition = at;
      }
    }
  }

  /** Play on this clock until the film ends (or `stop`). */
  play(clock: FilmClock) {
    // how long frames take to come round (ms): half a second's worth, to see whether the device keeps up
    const gaps: number[] = [];
    let prev = 0;
    let judged = 0;
    const loop = (now: number) => {
      if (this.done) return;
      // (the frame's time, not the moment this code runs: on a busy device that comes later, by more or less)
      const t = clock.now(now);
      if (prev) {
        const gap = now - prev;
        // (a frame held up by a picture painted on demand says nothing of the frame rate)
        if (gap < 400) gaps.push(gap);
      }
      prev = now;
      FilmPlayer.times.push([t, now]);
      if (FilmPlayer.times.length > 240) FilmPlayer.times.shift();
      if (!judged) judged = now;
      // drawing slower than about 22 frames a second: fewer pixels each way, the slower the more
      // (a fifth to two fifths a step), every half second, down to half a pixel a point
      if (now - judged >= 500 && gaps.length >= 6) {
        const mid = [...gaps].sort((a, b) => a - b)[gaps.length >> 1];
        // slow with the page's layers: half a second with the vignette and grain in the canvas, and
        // back to the layers unless that came a tenth quicker (before any fewer pixels)
        if (this.trial.state === 'ready' && mid > 45) {
          this.trial = { state: 'trying', page: mid };
          this.overlaysOnPage(false);
        } else if (this.trial.state === 'trying') {
          const kept = mid < this.trial.page * 0.9 ? 'canvas' : 'page';
          FilmPlayer.overlayTrial = { page: this.trial.page, canvas: mid, kept };
          this.trial.state = 'over';
          if (kept === 'page') this.overlaysOnPage(true);
        } else if (mid > 45 && this.pr > this.minPr) this.resize(Math.max(this.minPr, this.pr * Math.min(0.85, Math.max(0.6, Math.sqrt(30 / mid)))));
        gaps.length = 0;
        judged = now;
      }
      this.frame(t);
      if (t >= this.length) {
        this.finish();
        return;
      }
      // the paintings of scenes to come, a slice a frame (when no thread of their own paints them)
      if (!this.apart) this.scene.warm?.(performance.now() + (this.opts.quality === 'high' ? 4 : this.opts.quality === 'medium' ? 3 : 2));
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** End it now (skipped, or over). */
  finish() {
    if (this.done) return;
    this.done = true;
    cancelAnimationFrame(this.raf);
    this.stopPainter();
    this.opts.onEnd?.();
  }

  dispose() {
    this.done = true;
    cancelAnimationFrame(this.raf);
    this.stopPainter();
    this.canvas.remove();
    this.vignetteEl?.remove();
    this.grainEl?.remove();
    this.layer.remove();
  }

  /** The vignette and grain as layers of the page (else drawn in the canvas). */
  private overlaysOnPage(on: boolean) {
    this.args.pageOverlays = on;
    if (this.grainEl) this.grainEl.hidden = !on;
    if (this.vignetteEl) this.vignetteEl.hidden = !on;
  }

  /** The frame's resolution (device pixels per CSS pixel); its size on the page stays. */
  private resize(pr: number) {
    this.pr = pr;
    this.canvas.width = Math.round(this.w * pr);
    this.canvas.height = Math.round(this.h * pr);
    this.c.setTransform(pr, 0, 0, pr, 0, 0);
  }

  /**
   * Paint the film's pictures in a thread of their own, taking each as it comes. Resolves when the
   * first scene's are all there. If the thread fails, the page paints what is left itself, a slice
   * a frame until the first scene's are done, and then as the film plays.
   */
  private paintApart(args: FilmArgs): Promise<void> {
    const assets = this.scene.assets ?? [];
    const first = assets.slice(0, this.scene.first ?? 0);
    return new Promise<void>((resolve) => {
      const check = () => {
        if (first.every((a) => a.ready)) resolve();
      };
      const fallBack = () => {
        this.stopPainter();
        this.apart = false;
        this.allSent();
        const step = () => {
          if (this.done) return resolve();
          const until = performance.now() + 12;
          for (const a of first) if (!a.warm(until)) break;
          if (first.every((a) => a.ready)) resolve();
          else requestAnimationFrame(step);
        };
        step();
      };
      let worker: Worker;
      try {
        worker = newPainter();
      } catch {
        fallBack();
        return;
      }
      this.worker = worker;
      const job = ++jobs;
      worker.onmessage = (e: MessageEvent<PaintReply>) => {
        const d = e.data;
        if (d.job !== job || this.done) return;
        // the film could not be laid out or sent there: the page paints it all
        if ('failed' in d) {
          fallBack();
          return;
        }
        // all sent: any it could not send the page warms as the film plays
        if ('done' in d) {
          this.stopPainter();
          this.apart = false;
          this.allSent();
          return;
        }
        // one it could not send: painted here (now if the first scene needs it, else as the film plays)
        if ('local' in d) {
          if (d.i < first.length) assets[d.i].get();
        } else {
          assets[d.i].fulfil(unpack(d.v));
          this.sent++;
        }
        check();
      };
      worker.onerror = () => {
        if (!this.done) fallBack();
      };
      worker.postMessage({ job, id: this.id, w: this.w, h: this.h, q: this.opts.quality, args } satisfies PaintJob);
      check();
    });
  }

  private stopPainter() {
    this.worker?.terminate();
    this.worker = null;
  }

  private setText(items: FilmText[]) {
    for (const it of items) {
      let el = this.texts.get(it.id);
      if (!el) {
        el = document.createElement('div');
        el.className = `film-line ${it.kind} at-${it.at}${it.kind === 'note' ? ` align-${it.align ?? 'l'} tone-${it.tone ?? 'ink'} size-${it.size ?? 's'}` : ''}`;
        // (a diagram's labels are for the eye: the narration says what it shows)
        if (it.kind === 'note') el.setAttribute('aria-hidden', 'true');
        this.layer.append(el);
        this.texts.set(it.id, el);
      }
      if (it.x !== undefined && it.y !== undefined) {
        const left = `${(it.x * 100).toFixed(2)}%`;
        const top = `${(it.y * 100).toFixed(2)}%`;
        if (el.style.left !== left) el.style.left = left;
        if (el.style.top !== top) el.style.top = top;
      }
      if (el.textContent !== it.text) el.textContent = it.text;
      const o = Math.round(it.opacity * 1000) / 1000;
      el.style.opacity = String(o);
      // (gone from the frame, gone for screen readers too)
      el.hidden = o <= 0.001;
    }
  }
}

/**
 * A clock from the sound being heard (15 Oct): the audio clock (`currentTime`) moves in steps of
 * its buffer (23 ms and more with the large buffers that keep the sound from breaking up), so
 * frames read from it repeated themselves and then jumped, a judder in every browser. The output's
 * timestamp, carried on by the page's own clock between its updates, moves with the frames, and is
 * the time of the sound reaching the ears (`currentTime` runs ahead of it by the output's latency).
 * Never backwards; seconds since `at` (the cue's start, on the context's clock).
 */
export function audioClock(ctx: AudioContext, at: number): FilmClock {
  let last = 0;
  let base = -1;
  let basePerf = 0;
  return {
    now(at2?: number) {
      const p = at2 ?? performance.now();
      const now = ctx.currentTime;
      let t = NaN;
      const ts = typeof ctx.getOutputTimestamp === 'function' ? ctx.getOutputTimestamp() : null;
      if (ts && ts.performanceTime && ts.contextTime !== undefined) t = ts.contextTime + (p - ts.performanceTime) / 1000;
      // (a timestamp that does not agree with the clock, ahead of it or more than a second behind,
      // as a wireless headset's might be at most, is not trusted)
      if (!(t <= now + 0.1 && t >= now - 1)) {
        // (no timestamp, or none to trust: the context's clock, carried on between its steps, for
        // 250 ms at most, more than its longest step, and only while it runs: a stopped sound
        // stops the film with it)
        if (now !== base) {
          base = now;
          basePerf = p;
        }
        t = base + (ctx.state === 'running' ? Math.min(p - basePerf, 250) : 0) / 1000;
      }
      last = Math.max(last, t - at);
      return last;
    },
  };
}

/** A clock from elapsed time (when there is no sound to keep time with). */
export function elapsedClock(): FilmClock {
  const t0 = performance.now();
  return { now: (at?: number) => Math.max(0, ((at ?? performance.now()) - t0) / 1000) };
}
