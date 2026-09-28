import { useEffect, useState } from 'preact/hooks';

// Tooltips from a `data-tip` attribute anywhere in the UI. One listener, no per-element state.

let probe: HTMLElement | null = null;
/**
 * How many screen pixels one CSS pixel of the UI layer covers (the interface size). Measured,
 * not assumed, so pointer and layout coordinates agree whatever the browser does with zoom.
 */
export function uiFactor(): number {
  const w = probe?.getBoundingClientRect().width ?? 0;
  return w > 0 ? w / 100 : 1;
}

export function TipLayer() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  useEffect(() => {
    const over = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-tip]') as HTMLElement | null;
      if (!el) {
        setTip(null);
        return;
      }
      const text = el.getAttribute('data-tip') ?? '';
      if (!text) return setTip(null);
      setTip({ text, x: e.clientX, y: e.clientY });
    };
    const leave = () => setTip(null);
    window.addEventListener('pointermove', over);
    window.addEventListener('pointerdown', leave);
    return () => {
      window.removeEventListener('pointermove', over);
      window.removeEventListener('pointerdown', leave);
    };
  }, []);
  const measure = <div class="zoom-probe" aria-hidden="true" ref={(el) => {
    probe = el;
  }} />;
  if (!tip) return measure;
  // work in the UI layer's own pixels
  const f = uiFactor();
  const vw = window.innerWidth / f;
  const vh = window.innerHeight / f;
  const w = 320;
  const left = Math.min(vw - w - 12, tip.x / f + 14);
  const top = Math.min(vh - 120, tip.y / f + 16);
  return (
    <>
      {measure}
      <div class="tip panel" style={{ left: `${Math.max(8, left)}px`, top: `${top}px` }}>
        {tip.text.split('\n').map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </>
  );
}
