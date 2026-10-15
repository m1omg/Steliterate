import { FILMS, type FilmArgs, type FilmId, type FilmQuality } from './films';
import { pack, type Packed } from './transfer';

// The films' painter (15 Oct: on a tablet a film stopped for a second or two whenever a scene began,
// while its pictures were painted). In a thread of its own it lays out the same film the page
// plays, at the same size, and paints its pictures in the order the film needs them, sending each
// as it is done; the page draws frames meanwhile. A picture it cannot send, the page paints itself.

export interface PaintJob {
  job: number;
  id: FilmId;
  w: number;
  h: number;
  q: FilmQuality;
  args: FilmArgs;
}

export type PaintReply = { job: number; i: number; v: Packed } | { job: number; i: number; local: true } | { job: number; done: true };

// (the thread's own scope, typed as far as it is used here: the project's types are the page's)
const me = self as unknown as { onmessage: ((e: MessageEvent<PaintJob | { stop: number }>) => void) | null; postMessage(m: PaintReply, transfer?: Transferable[]): void };
let current = 0;
const breath = () => new Promise<void>((r) => setTimeout(r, 0));

me.onmessage = async (e: MessageEvent<PaintJob | { stop: number }>) => {
  const d = e.data;
  if ('stop' in d) {
    if (current === d.stop) current = 0;
    return;
  }
  current = d.job;
  const scene = FILMS[d.id].setup(d.w, d.h, d.q, d.args, false);
  const assets = scene.assets ?? [];
  for (let i = 0; i < assets.length; i++) {
    // (between pictures, a stop can come in: the film was skipped)
    await breath();
    if (current !== d.job) return;
    let reply: PaintReply;
    const transfer: Transferable[] = [];
    try {
      reply = { job: d.job, i, v: await pack(assets[i].get(), transfer) };
    } catch {
      reply = { job: d.job, i, local: true };
    }
    me.postMessage(reply, transfer);
  }
  me.postMessage({ job: d.job, done: true } satisfies PaintReply);
};
