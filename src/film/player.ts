import { FILMS, filmLength, type FilmArgs, type FilmId, type FilmQuality, type FilmScene, type FilmText } from './films';

// Plays a film (part 4) on one full-screen 2D canvas, with its words as real text over it. The
// film's time comes from the audio clock while its cue plays (so the cuts keep time with the
// sound), else from elapsed time; every frame is drawn from that time alone, never from a frame
// count. `exportFrame` draws any moment exactly, for tools/film-render.mjs.

export interface FilmClock {
  /** Seconds of film shown now. */
  now(): number;
}

export class FilmPlayer {
  readonly canvas: HTMLCanvasElement;
  readonly layer: HTMLDivElement;
  readonly length: number;
  private c: CanvasRenderingContext2D;
  private scene: FilmScene;
  private texts = new Map<string, HTMLDivElement>();
  private raf = 0;
  private done = false;

  constructor(
    host: HTMLElement,
    readonly id: FilmId,
    private opts: { quality: FilmQuality; args?: FilmArgs; width?: number; height?: number; pixelRatio?: number; onEnd?: () => void },
  ) {
    const def = FILMS[id];
    this.length = filmLength(def);
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'film-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.layer = document.createElement('div');
    this.layer.className = 'film-text';
    host.append(this.canvas, this.layer);
    const w = opts.width ?? host.clientWidth ?? window.innerWidth;
    const h = opts.height ?? host.clientHeight ?? window.innerHeight;
    // fewer pixels on Medium and Low, as the game's own view draws
    const pr = opts.pixelRatio ?? Math.min(window.devicePixelRatio || 1, opts.quality === 'high' ? 2 : opts.quality === 'medium' ? 1.25 : 1);
    this.canvas.width = Math.round(w * pr);
    this.canvas.height = Math.round(h * pr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.c = this.canvas.getContext('2d')!;
    this.c.scale(pr, pr);
    this.scene = def.setup(w, h, opts.quality, { ...opts.args, pr });
  }

  /** Draw the moment `t` (seconds), the picture and the words over it. */
  frame(t: number) {
    const tt = Math.max(0, Math.min(this.length, t));
    this.scene.draw(this.c, tt);
    this.setText(this.scene.text(tt));
  }

  /** Play on this clock until the film ends (or `stop`). */
  play(clock: FilmClock) {
    const loop = () => {
      if (this.done) return;
      const t = clock.now();
      this.frame(t);
      if (t >= this.length) {
        this.finish();
        return;
      }
      // the paintings of scenes to come, a slice a frame
      this.scene.warm?.(performance.now() + (this.opts.quality === 'high' ? 4 : this.opts.quality === 'medium' ? 3 : 2));
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** End it now (skipped, or over). */
  finish() {
    if (this.done) return;
    this.done = true;
    cancelAnimationFrame(this.raf);
    this.opts.onEnd?.();
  }

  dispose() {
    this.done = true;
    cancelAnimationFrame(this.raf);
    this.canvas.remove();
    this.layer.remove();
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
