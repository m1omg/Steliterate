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

export interface FilmClock {
  /** Seconds of film shown now. */
  now(): number;
}

/** Whether pictures can be painted in a thread of their own here (a worker with canvases off the page). */
const canPaintApart = () => typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined';

let jobs = 0;

export class FilmPlayer {
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
  /** Device pixels per CSS pixel the frame is drawn at now, and the least it may come down to. */
  private pr: number;
  private minPr: number;

  constructor(
    host: HTMLElement,
    readonly id: FilmId,
    private opts: { quality: FilmQuality; args?: FilmArgs; width?: number; height?: number; pixelRatio?: number; onEnd?: () => void; painter?: boolean },
  ) {
    const def = FILMS[id];
    this.length = filmLength(def);
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'film-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.layer = document.createElement('div');
    this.layer.className = 'film-text';
    host.append(this.canvas, this.layer);
    const w = (this.w = opts.width ?? host.clientWidth ?? window.innerWidth);
    const h = (this.h = opts.height ?? host.clientHeight ?? window.innerHeight);
    // fewer pixels on Medium and Low, as the game's own view draws
    const pr = opts.pixelRatio ?? Math.min(window.devicePixelRatio || 1, opts.quality === 'high' ? 2 : opts.quality === 'medium' ? 1.25 : 1);
    this.pr = pr;
    this.minPr = Math.min(pr, 0.75);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.c = this.canvas.getContext('2d')!;
    this.resize(pr);
    const args = { ...opts.args, pr };
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
  }

  /** Play on this clock until the film ends (or `stop`). */
  play(clock: FilmClock) {
    // how long frames take to come round (ms): a second's worth, to see whether the device keeps up
    const gaps: number[] = [];
    let prev = 0;
    let judged = 0;
    const loop = (now: number) => {
      if (this.done) return;
      const t = clock.now();
      if (prev) {
        const gap = now - prev;
        // (a frame held up by a picture painted on demand says nothing of the frame rate)
        if (gap < 250) gaps.push(gap);
      }
      prev = now;
      // drawing slower than about 22 frames a second for a second: a fifth fewer pixels each way, down to the least
      if (t - judged >= 1 && gaps.length >= 12) {
        const mid = [...gaps].sort((a, b) => a - b)[gaps.length >> 1];
        if (mid > 45 && this.pr > this.minPr) this.resize(Math.max(this.minPr, this.pr * 0.8));
        gaps.length = 0;
        judged = t;
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
    this.layer.remove();
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
        worker = new Worker(new URL('./paintWorker.ts', import.meta.url), { type: 'module' });
      } catch {
        fallBack();
        return;
      }
      this.worker = worker;
      const job = ++jobs;
      worker.onmessage = (e: MessageEvent<PaintReply>) => {
        const d = e.data;
        if (d.job !== job || this.done) return;
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

/** A clock from elapsed time (when there is no sound to keep time with). */
export function elapsedClock(): FilmClock {
  const t0 = performance.now();
  return { now: () => (performance.now() - t0) / 1000 };
}
