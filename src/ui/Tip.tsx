import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { settings } from './store';

// Tooltips from a `data-tip` attribute anywhere in the UI. One listener, no per-element state.
// In the magnifier mode (a11y.ts) they also show for what has the keyboard's focus (once Tab is
// in use), sit beside what they explain (beside the column, over the map, for its parts) rather
// than at the pointer, stay while the pointer is on them so they can be read, and Escape puts
// them away.

let probe: HTMLElement | null = null;
/**
 * How many screen pixels one CSS pixel of the UI layer covers (the interface size). Measured,
 * not assumed, so pointer and layout coordinates agree whatever the browser does with zoom.
 */
export function uiFactor(): number {
  const w = probe?.getBoundingClientRect().width ?? 0;
  return w > 0 ? w / 100 : 1;
}

interface Tip {
  text: string;
  x: number;
  y: number;
  /** What it explains (the magnifier mode places it by this). */
  el?: Element;
  /** Shown for the keyboard's focus, not the pointer. */
  focus?: boolean;
}

export function TipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const shown = useRef<Tip | null>(null);
  shown.current = tip;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let hide = 0;
    const lv = () => !!settings.value.lowVision;
    // the pointer left it: a moment to cross to the tip itself (a tip for the focus stays)
    const later = () => {
      clearTimeout(hide);
      hide = window.setTimeout(() => setTip((t) => (t?.focus ? t : null)), 350);
    };
    const over = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (lv() && target?.closest?.('.tip')) return clearTimeout(hide);
      const el = target?.closest?.('[data-tip]') as HTMLElement | null;
      const text = el?.getAttribute('data-tip') ?? '';
      if (!el || !text) {
        if (lv()) later();
        else setTip(null);
        return;
      }
      clearTimeout(hide);
      if (!lv()) return setTip({ text, x: e.clientX, y: e.clientY });
      if (shown.current?.el !== el || shown.current.text !== text) setTip({ text, x: e.clientX, y: e.clientY, el });
    };
    const leave = () => setTip(null);
    // for the keyboard's focus (Tab in use): a button clicked keeps the focus, and its tip would
    // stay over the map
    const focusIn = (e: FocusEvent) => {
      if (!lv() || !document.documentElement.classList.contains('kbd')) return;
      const el = e.target as HTMLElement | null;
      const text = el?.getAttribute?.('data-tip');
      if (el && text) setTip({ text, x: 0, y: 0, el, focus: true });
    };
    const focusOut = () => setTip((t) => (t?.focus ? null : t));
    // Escape puts a tip away first, and does nothing else
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !lv() || !shown.current) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setTip(null);
    };
    window.addEventListener('pointermove', over);
    window.addEventListener('pointerdown', leave);
    window.addEventListener('focusin', focusIn);
    window.addEventListener('focusout', focusOut);
    window.addEventListener('keydown', esc, true);
    return () => {
      clearTimeout(hide);
      window.removeEventListener('pointermove', over);
      window.removeEventListener('pointerdown', leave);
      window.removeEventListener('focusin', focusIn);
      window.removeEventListener('focusout', focusOut);
      window.removeEventListener('keydown', esc, true);
    };
  }, []);
  // the magnifier mode: a tip that would run off the bottom moves up (its height is known only now)
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !tip?.el) return;
    const f = uiFactor();
    const vh = window.innerHeight / f;
    const h = el.getBoundingClientRect().height / f;
    const top = parseFloat(el.style.top);
    if (top + h <= vh - 8) return;
    const r = tip.el.getBoundingClientRect();
    const above = r.top / f - h - 6;
    el.style.top = `${Math.max(8, el.dataset.place === 'below' && above >= 8 ? above : vh - h - 8)}px`;
  });
  const measure = <div class="zoom-probe" aria-hidden="true" ref={(el) => {
    probe = el;
  }} />;
  if (!tip) return measure;
  // work in the UI layer's own pixels
  const f = uiFactor();
  const vw = window.innerWidth / f;
  const vh = window.innerHeight / f;
  let style: Record<string, string>;
  let place = 'pointer';
  if (tip.el && tip.el.isConnected) {
    const w = 440;
    const r = tip.el.getBoundingClientRect();
    const col = tip.el.closest('.hud') ? document.querySelector('.hud')?.getBoundingClientRect() : undefined;
    if (col && col.width > 0 && col.width < window.innerWidth * 0.8) {
      // beside the column, over the map, level with what it explains
      place = 'beside';
      const top = `${Math.max(8, r.top / f)}px`;
      style = col.left > 1 ? { right: `${vw - col.left / f + 8}px`, top } : { left: `${col.right / f + 8}px`, top };
    } else {
      // below what it explains (above, if there is no room below)
      place = 'below';
      style = { left: `${Math.max(8, Math.min(r.left / f, vw - w - 8))}px`, top: `${r.bottom / f + 6}px` };
    }
  } else {
    const w = 320;
    const left = Math.min(vw - w - 12, tip.x / f + 14);
    const top = Math.min(vh - 120, tip.y / f + 16);
    style = { left: `${Math.max(8, left)}px`, top: `${top}px` };
  }
  return (
    <>
      {measure}
      <div ref={box} class="tip panel" data-place={place} style={style}>
        {tip.text.split('\n').map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </>
  );
}
