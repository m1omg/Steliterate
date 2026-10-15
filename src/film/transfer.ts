import { World, canvas } from './paint';

// What the films' painter thread (paintWorker.ts) sends the page, and how the page takes it back
// (15 Oct): a picture goes as a bitmap and becomes a canvas again, a world as the numbers it paints
// from, and lists and plain records of these as they are. Anything else is not sent: the page
// paints that one itself.

export type Packed =
  | { $: 'bmp'; v: ImageBitmap }
  | { $: 'img'; v: ImageData }
  | { $: 'world'; v: Packed }
  | { $: 'list'; v: Packed[] }
  | { $: 'rec'; v: Record<string, Packed> }
  | { $: 'val'; v: unknown };

/** In the painter thread: a painting's result made ready to send (its bitmaps listed in `transfer`). Throws for what cannot go. */
export async function pack(v: unknown, transfer: Transferable[]): Promise<Packed> {
  if (typeof OffscreenCanvas !== 'undefined' && v instanceof OffscreenCanvas) {
    // a copy of its pixels as they are (a later painting may still read this canvas)
    try {
      const bmp = await createImageBitmap(v);
      transfer.push(bmp);
      return { $: 'bmp', v: bmp };
    } catch {
      const img = v.getContext('2d')!.getImageData(0, 0, v.width, v.height);
      transfer.push(img.data.buffer);
      return { $: 'img', v: img };
    }
  }
  if (v instanceof World) return { $: 'world', v: await pack(v.save(), transfer) };
  if (Array.isArray(v)) {
    const out: Packed[] = [];
    for (const x of v) out.push(await pack(x, transfer));
    return { $: 'list', v: out };
  }
  if (v !== null && typeof v === 'object' && !ArrayBuffer.isView(v)) {
    if (Object.getPrototypeOf(v) !== Object.prototype) throw new Error('not sent: made by the page');
    const out: Record<string, Packed> = {};
    for (const [k, x] of Object.entries(v)) out[k] = await pack(x, transfer);
    return { $: 'rec', v: out };
  }
  // typed arrays: a copy of each handed over whole, so the page takes it without copying it again (a
  // world's tables are megabytes: copied on the way, the page had stopped for a third of a second)
  if (ArrayBuffer.isView(v) && !(v instanceof DataView)) {
    const copy = (v as unknown as { slice(): ArrayBufferView }).slice();
    transfer.push(copy.buffer as ArrayBuffer);
    return { $: 'val', v: copy };
  }
  // numbers and strings
  return { $: 'val', v };
}

/** On the page: a painting's result as the film draws it (a picture on a canvas of its own). */
export function unpack(p: Packed): unknown {
  switch (p.$) {
    case 'bmp': {
      const c = canvas(p.v.width, p.v.height);
      c.getContext('2d')!.drawImage(p.v, 0, 0);
      p.v.close();
      return c;
    }
    case 'img': {
      const c = canvas(p.v.width, p.v.height);
      c.getContext('2d')!.putImageData(p.v, 0, 0);
      return c;
    }
    case 'world':
      return World.load(unpack(p.v) as ReturnType<World['save']>);
    case 'list':
      return p.v.map(unpack);
    case 'rec':
      return Object.fromEntries(Object.entries(p.v).map(([k, x]) => [k, unpack(x)]));
    default:
      return p.v;
  }
}
