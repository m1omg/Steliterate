import { useEffect, useState } from 'preact/hooks';

// Tooltips from a `data-tip` attribute anywhere in the UI. One listener, no per-element state.

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
  if (!tip) return null;
  const w = 320;
  const left = Math.min(window.innerWidth - w - 12, tip.x + 14);
  const top = Math.min(window.innerHeight - 120, tip.y + 16);
  return (
    <div class="tip panel" style={{ left: `${Math.max(8, left)}px`, top: `${top}px` }}>
      {tip.text.split('\n').map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}
